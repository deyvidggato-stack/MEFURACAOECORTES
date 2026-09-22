import express from "express";
import { createServer } from "http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { appRouter } from "./routers";
import { createContext } from "./context";
import { ENV } from "./env";
import { createChatVisitor, getChatVisitorByUsername } from "./db";
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { getSessionCookieOptions } from "./cookies";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const server = createServer(app);

  app.set("trust proxy", 1);
  app.use(express.json({ limit: "12mb" }));
  app.use(express.urlencoded({ extended: true, limit: "12mb" }));

  app.get("/api/health", (_req, res) => res.json({ ok: true }));
  const oauthStateCookie = "me_oauth_state";
  const oauthChatCookie = "me_oauth_chat_token";
  const cookieOpts = (req: any) => ({ ...getSessionCookieOptions(req), maxAge: 10 * 60 * 1000 });
  const randomPasswordHash = () => {
    const salt = randomBytes(16).toString("hex");
    return `${salt}:${scryptSync(randomBytes(32).toString("hex"), salt, 64).toString("hex")}`;
  };
  const ensureOAuthVisitor = async (provider: string, id: string, name: string, email?: string) => {
    const username = `${provider}_${id}`.slice(0, 80);
    const existing = await getChatVisitorByUsername(username);
    if (existing) return existing.publicToken;
    const created = await createChatVisitor({ publicToken: randomBytes(36).toString("hex"), username, passwordHash: randomPasswordHash(), name: (name || "Cliente").slice(0, 140), email: email?.slice(0, 320) });
    return created.publicToken;
  };
  const startOAuth = (provider: "google" | "facebook", req: any, res: any) => {
    const state = randomBytes(24).toString("hex");
    res.cookie(oauthStateCookie, state, cookieOpts(req));
    const redirect = `${ENV.oauthBaseUrl || `${req.protocol}://${req.get("host")}`}/api/auth/${provider}/callback`;
    const url = provider === "google"
      ? `https://accounts.google.com/o/oauth2/v2/auth?client_id=${encodeURIComponent(ENV.googleClientId)}&redirect_uri=${encodeURIComponent(redirect)}&response_type=code&scope=${encodeURIComponent("openid email profile")}&state=${state}&access_type=online`
      : `https://www.facebook.com/v24.0/dialog/oauth?client_id=${encodeURIComponent(ENV.facebookAppId)}&redirect_uri=${encodeURIComponent(redirect)}&response_type=code&scope=email,public_profile&state=${state}`;
    res.redirect(url);
  };
  const finishOAuth = async (provider: "google" | "facebook", req: any, res: any) => {
    const state = req.query.state as string | undefined;
    const cookies = (req.headers.cookie || "").split(";").reduce((o: any, item: string) => { const [k, ...v] = item.trim().split("="); if (k) o[k] = decodeURIComponent(v.join("=")); return o; }, {});
    if (!state || state !== cookies[oauthStateCookie]) return res.status(400).send("OAuth inválido ou expirado.");
    const code = req.query.code as string | undefined;
    if (!code) return res.status(400).send("Código OAuth não recebido.");
    const redirect = `${ENV.oauthBaseUrl || `${req.protocol}://${req.get("host")}`}/api/auth/${provider}/callback`;
    let profile: { id: string; name: string; email?: string };
    if (provider === "google") {
      const tokenResponse = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ code, client_id: ENV.googleClientId, client_secret: ENV.googleClientSecret, redirect_uri: redirect, grant_type: "authorization_code" }) });
      if (!tokenResponse.ok) throw new Error("Falha ao trocar código Google.");
      const token = await tokenResponse.json() as { access_token?: string };
      const profileResponse = await fetch("https://openidconnect.googleapis.com/v1/userinfo", { headers: { Authorization: `Bearer ${token.access_token}` } });
      if (!profileResponse.ok) throw new Error("Falha ao obter perfil Google.");
      const p = await profileResponse.json() as { sub: string; name?: string; email?: string };
      profile = { id: p.sub, name: p.name || "Cliente Google", email: p.email };
    } else {
      const tokenResponse = await fetch(`https://graph.facebook.com/v24.0/oauth/access_token?client_id=${encodeURIComponent(ENV.facebookAppId)}&client_secret=${encodeURIComponent(ENV.facebookAppSecret)}&redirect_uri=${encodeURIComponent(redirect)}&code=${encodeURIComponent(code)}`);
      if (!tokenResponse.ok) throw new Error("Falha ao trocar código Facebook.");
      const token = await tokenResponse.json() as { access_token?: string };
      const profileResponse = await fetch(`https://graph.facebook.com/me?fields=id,name,email&access_token=${encodeURIComponent(token.access_token || "")}`);
      if (!profileResponse.ok) throw new Error("Falha ao obter perfil Facebook.");
      const p = await profileResponse.json() as { id: string; name?: string; email?: string };
      profile = { id: p.id, name: p.name || "Cliente Facebook", email: p.email };
    }
    const publicToken = await ensureOAuthVisitor(provider, profile.id, profile.name, profile.email);
    res.clearCookie(oauthStateCookie, { path: "/" });
    res.cookie(oauthChatCookie, publicToken, { ...getSessionCookieOptions(req), maxAge: 10 * 60 * 1000 });
    res.redirect("/?oauth=success");
  };
  app.get("/api/auth/google", (req, res) => { if (!ENV.googleClientId || !ENV.googleClientSecret) return res.status(503).send("Login Google ainda não foi configurado no Railway."); startOAuth("google", req, res); });
  app.get("/api/auth/google/callback", (req, res) => finishOAuth("google", req, res).catch(err => { console.error("[OAuth Google]", err); res.status(500).send("Não foi possível concluir o login com Google."); }));
  app.get("/api/auth/facebook", (req, res) => { if (!ENV.facebookAppId || !ENV.facebookAppSecret) return res.status(503).send("Login Facebook ainda não foi configurado no Railway."); startOAuth("facebook", req, res); });
  app.get("/api/auth/facebook/callback", (req, res) => finishOAuth("facebook", req, res).catch(err => { console.error("[OAuth Facebook]", err); res.status(500).send("Não foi possível concluir o login com Facebook."); }));

  app.use("/api/trpc", createExpressMiddleware({ router: appRouter, createContext }));

  const uploadsPath = path.resolve(process.cwd(), "uploads");
  app.use("/uploads", express.static(uploadsPath));

  const staticPath = path.resolve(__dirname, "public");
  app.use(express.static(staticPath));

  app.get("*", (_req, res) => {
    res.sendFile(path.join(staticPath, "index.html"));
  });

  const port = Number(process.env.PORT || 3000);
  server.listen(port, "0.0.0.0", () => {
    console.log(`Server running on port ${port}`);
  });
}

startServer().catch(error => {
  console.error(error);
  process.exit(1);
});
