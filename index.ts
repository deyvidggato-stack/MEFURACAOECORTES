import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import path from "node:path";
import { randomBytes, scryptSync } from "node:crypto";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { ENV } from "./env";
import { getSessionCookieOptions } from "./cookies";
import { createChatVisitor, getChatVisitorByUsername } from "../db";
import { parse as parseCookieHeader } from "cookie";
import { serveStatic, setupVite } from "./vite";


const OAUTH_STATE_COOKIE = "me_oauth_state";
const OAUTH_CHAT_COOKIE = "me_oauth_chat_token";
const oauthStates = new Map<string, { provider: "google" | "facebook"; expiresAt: number }>();

function getPublicBaseUrl(req: express.Request) {
  if (ENV.oauthBaseUrl) return ENV.oauthBaseUrl.replace(/\/$/, "");
  const proto = String(req.headers["x-forwarded-proto"] || req.protocol).split(",")[0];
  const host = req.get("host");
  return `${proto}://${host}`;
}

function cleanOAuthStates() {
  const now = Date.now();
  for (const [state, value] of oauthStates) if (value.expiresAt <= now) oauthStates.delete(state);
}

function passwordHashForSocialLogin(value: string) {
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${scryptSync(value, salt, 64).toString("hex")}`;
}

async function createOrGetSocialVisitor(provider: "google" | "facebook", providerId: string, name: string, email?: string) {
  const username = `${provider}:${providerId}`.slice(0, 80);
  const existing = await getChatVisitorByUsername(username);
  if (existing) return existing.publicToken;
  const created = await createChatVisitor({
    publicToken: randomBytes(36).toString("hex"),
    username,
    passwordHash: passwordHashForSocialLogin(randomBytes(32).toString("hex")),
    name: name.trim().slice(0, 140) || "Cliente",
    email: email?.trim().slice(0, 320) || undefined,
  });
  return created.publicToken;
}

async function fetchJson(url: string, init?: RequestInit) {
  const response = await fetch(url, init);
  const text = await response.text();
  let data: any = {};
  try { data = JSON.parse(text); } catch { /* provider returned non-JSON */ }
  if (!response.ok) throw new Error(data.error_description || data.error?.message || `OAuth request failed (${response.status})`);
  return data;
}

async function startOAuth(req: express.Request, res: express.Response, provider: "google" | "facebook") {
  cleanOAuthStates();
  const state = randomBytes(24).toString("hex");
  oauthStates.set(state, { provider, expiresAt: Date.now() + 10 * 60 * 1000 });
  res.cookie(OAUTH_STATE_COOKIE, state, { ...getSessionCookieOptions(req), maxAge: 10 * 60 * 1000 });
  const redirectUri = `${getPublicBaseUrl(req)}/api/auth/${provider}/callback`;
  const params = new URLSearchParams();
  if (provider === "google") {
    if (!ENV.googleClientId || !ENV.googleClientSecret) return res.redirect("/?oauth=not-configured&provider=google");
    params.set("client_id", ENV.googleClientId);
    params.set("redirect_uri", redirectUri);
    params.set("response_type", "code");
    params.set("scope", "openid email profile");
    params.set("state", state);
    return res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
  }
  if (!ENV.facebookAppId || !ENV.facebookAppSecret) return res.redirect("/?oauth=not-configured&provider=facebook");
  params.set("client_id", ENV.facebookAppId);
  params.set("redirect_uri", redirectUri);
  params.set("response_type", "code");
  params.set("scope", "email,public_profile");
  params.set("state", state);
  return res.redirect(`https://www.facebook.com/dialog/oauth?${params}`);
}

async function finishOAuth(req: express.Request, res: express.Response, provider: "google" | "facebook") {
  try {
    cleanOAuthStates();
    const state = String(req.query.state || "");
    const storedState = oauthStates.get(state);
    oauthStates.delete(state);
    if (!state || !storedState || storedState.provider !== provider || parseCookieHeader(req.headers.cookie || {})[OAUTH_STATE_COOKIE] !== state) throw new Error("Estado OAuth inválido ou expirado.");

    const code = String(req.query.code || "");
    if (!code) throw new Error(String(req.query.error_description || req.query.error || "Login cancelado."));
    const redirectUri = `${getPublicBaseUrl(req)}/api/auth/${provider}/callback`;
    let profile: { id: string; name: string; email?: string };

    if (provider === "google") {
      const token = await fetchJson("https://oauth2.googleapis.com/token", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ code, client_id: ENV.googleClientId, client_secret: ENV.googleClientSecret, redirect_uri: redirectUri, grant_type: "authorization_code" }) });
      const google = await fetchJson("https://openidconnect.googleapis.com/v1/userinfo", { headers: { authorization: `Bearer ${token.access_token}` } });
      profile = { id: String(google.sub), name: String(google.name || google.email || "Cliente"), email: google.email ? String(google.email) : undefined };
    } else {
      const graph = `https://graph.facebook.com/${ENV.facebookGraphVersion}`;
      const token = await fetchJson(`${graph}/oauth/access_token?${new URLSearchParams({ client_id: ENV.facebookAppId, client_secret: ENV.facebookAppSecret, redirect_uri: redirectUri, code })}`);
      const facebook = await fetchJson(`${graph}/me?${new URLSearchParams({ fields: "id,name,email", access_token: token.access_token })}`);
      profile = { id: String(facebook.id), name: String(facebook.name || "Cliente"), email: facebook.email ? String(facebook.email) : undefined };
    }

    const publicToken = await createOrGetSocialVisitor(provider, profile.id, profile.name, profile.email);
    res.cookie(OAUTH_CHAT_COOKIE, publicToken, { ...getSessionCookieOptions(req), maxAge: 10 * 60 * 1000 });
    return res.redirect("/?oauth=success");
  } catch (error) {
    console.error(`[oauth:${provider}]`, error);
    return res.redirect(`/?oauth=error&provider=${provider}`);
  }
}

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  const app = express();
  const server = createServer(app);
  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  app.get("/api/auth/google", (req, res) => void startOAuth(req, res, "google"));
  app.get("/api/auth/google/callback", (req, res) => void finishOAuth(req, res, "google"));
  app.get("/api/auth/facebook", (req, res) => void startOAuth(req, res, "facebook"));
  app.get("/api/auth/facebook/callback", (req, res) => void finishOAuth(req, res, "facebook"));
  app.use("/uploads", express.static(path.resolve(process.cwd(), "uploads")));
  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}

startServer().catch(console.error);
