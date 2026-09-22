import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { getSessionCookieOptions } from "./_core/cookies";
import { ENV } from "./_core/env";
import { sdk } from "./_core/sdk";
import { systemRouter } from "./_core/systemRouter";
import { adminProcedure, publicProcedure, router } from "./_core/trpc";
import { storagePut } from "./storage";
import { addChatMessage, addAuditLog, addGalleryImage, addProduct, assignChatConversation, closeChatConversation, createChatVisitor, createPanelAccount, getChatConversationByToken, getChatMessages, getChatVisitorByUsername, getPanelAccount, listAllProducts, listAuditLogs, listChatConversations, listGalleryImages, listPanelAccounts, listProducts, listSiteSettings, markPanelLogin, removeGalleryImage, removeProduct, saveSiteSettings, setPanelAccountActive, upsertUser } from "./db";
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

const OAUTH_CHAT_COOKIE = "me_oauth_chat_token";

const uploadSchema = z.object({
  fileName: z.string().min(1).max(180),
  contentType: z.string().regex(/^image\//),
  dataBase64: z.string().min(20),
});

async function uploadImage(folder: string, input: z.infer<typeof uploadSchema>) {
  const raw = input.dataBase64.replace(/^data:[^;]+;base64,/, "");
  const buffer = Buffer.from(raw, "base64");
  if (buffer.byteLength > 8 * 1024 * 1024) throw new Error("A imagem deve ter no máximo 8 MB");
  return storagePut(`${folder}/${Date.now()}-${input.fileName.replace(/[^a-zA-Z0-9._-]/g, "-")}`, buffer, input.contentType);
}

const ownerProcedure = adminProcedure.use(async ({ ctx, next }) => {
  if (ctx.user.panelRole !== "owner") throw new TRPCError({ code: "FORBIDDEN", message: "Apenas o proprietário pode acessar este recurso." });
  return next();
});

function passwordHash(password: string, salt = randomBytes(16).toString("hex")) {
  return `${salt}:${scryptSync(password, salt, 64).toString("hex")}`;
}

function passwordMatches(password: string, stored: string) {
  const [salt, digest] = stored.split(":");
  if (!salt || !digest) return false;
  const expected = scryptSync(password, salt, 64);
  return timingSafeEqual(expected, Buffer.from(digest, "hex"));
}

function requestInfo(ctx: { req: any }) {
  const forwarded = ctx.req.headers["x-forwarded-for"];
  const ipAddress = (Array.isArray(forwarded) ? forwarded[0] : forwarded?.split(",")[0]) || ctx.req.ip || "desconhecido";
  const headers = ctx.req.headers as Record<string, string | undefined>;
  const location = headers["cf-ipcountry"] || headers["x-vercel-ip-country"] || headers["x-country"] || "não disponível";
  return { ipAddress, location, hostName: headers.host || "não disponível", userAgent: headers["user-agent"] || "não disponível", vpnStatus: "não verificado" };
}

async function audit(ctx: any, action: string, entity: string, details: string) {
  const info = requestInfo(ctx);
  await addAuditLog({ userId: ctx.user?.id, username: ctx.user?.name || ctx.user?.email || ctx.user?.openId || "desconhecido", action, entity, details, ...info });
}

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    adminLogin: publicProcedure.input(z.object({ username: z.string().min(1), password: z.string().min(1) })).mutation(async ({ input, ctx }) => {
      let openId = "";
      let displayName = "";
      let panelRole: "owner" | "editor" = "editor";
      if (ENV.adminUsername && ENV.adminPassword && input.username === ENV.adminUsername && input.password === ENV.adminPassword) {
        openId = `local-admin:${ENV.adminUsername}`; displayName = "Emanuel"; panelRole = "owner";
      } else {
        const account = await getPanelAccount(input.username);
        if (!account || !account.active || !passwordMatches(input.password, account.passwordHash)) throw new TRPCError({ code: "UNAUTHORIZED", message: "Usuário ou senha inválidos" });
        openId = `panel-account:${account.username}`; displayName = account.displayName;
        await markPanelLogin(account.id);
      }
      await upsertUser({ openId, name: displayName, role: "admin", panelRole, loginMethod: "password", lastSignedIn: new Date() });
      const token = await sdk.createSessionToken(openId, { name: displayName });
      ctx.res.cookie(COOKIE_NAME, token, { ...getSessionCookieOptions(ctx.req), maxAge: ONE_YEAR_MS });
      await audit({ ...ctx, user: { openId, name: displayName } }, "login", "painel", `Login realizado como ${panelRole}.`);
      return { success: true } as const;
    }),
    oauthSession: publicProcedure.query(({ ctx }) => {
      const cookies = (ctx.req.headers.cookie || "").split(";").reduce<Record<string, string>>((result, item) => { const [key, ...value] = item.trim().split("="); if (key) result[key] = decodeURIComponent(value.join("=")); return result; }, {});
      const token = cookies[OAUTH_CHAT_COOKIE];
      if (token) ctx.res.clearCookie(OAUTH_CHAT_COOKIE, { path: "/", httpOnly: true, sameSite: "lax", secure: ctx.req.protocol === "https" });
      return token || null;
    }),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  catalog: router({
    gallery: publicProcedure.query(() => listGalleryImages()),
    products: publicProcedure.input(z.object({ category: z.enum(["product", "service"]).optional() }).optional()).query(({ input }) => listProducts(input?.category)),
    settings: publicProcedure.query(() => listSiteSettings()),
  }),
  chat: router({
    start: publicProcedure.input(z.object({ username: z.string().trim().min(3).max(80), password: z.string().min(6).max(120), name: z.string().trim().min(2).max(140), email: z.string().trim().email().optional().or(z.literal("")), phone: z.string().trim().max(40).optional() })).mutation(async ({ input }) => {
      const username = input.username.trim();
      const existing = await getChatVisitorByUsername(username);
      if (existing) throw new TRPCError({ code: "CONFLICT", message: 'Este usuário já está cadastrado. Se você já criou este acesso, use a opção "Já tenho cadastro" para entrar.' });
      try {
        const publicToken = randomBytes(36).toString("hex");
        return await createChatVisitor({ publicToken, username, passwordHash: passwordHash(input.password), name: input.name.trim(), email: input.email || undefined, phone: input.phone || undefined });
      } catch (error: any) {
        // A concurrent registration can win the unique username constraint.
        if (error?.code === "ER_DUP_ENTRY" || error?.errno === 1062) {
          throw new TRPCError({ code: "CONFLICT", message: 'Este usuário já está cadastrado. Se você já criou este acesso, use a opção "Já tenho cadastro" para entrar.' });
        }
        throw error;
      }
    }),
    login: publicProcedure.input(z.object({ username: z.string().min(3), password: z.string().min(6) })).mutation(async ({ input }) => {
      const visitor = await getChatVisitorByUsername(input.username);
      if (!visitor || !passwordMatches(input.password, visitor.passwordHash)) throw new TRPCError({ code: "UNAUTHORIZED", message: "Usuário ou senha inválidos." });
      return { publicToken: visitor.publicToken };
    }),
    conversation: publicProcedure.input(z.object({ publicToken: z.string().min(20) })).query(({ input }) => getChatConversationByToken(input.publicToken)),
    send: publicProcedure.input(z.object({ publicToken: z.string().min(20), conversationId: z.number().int(), body: z.string().trim().min(1).max(2000) })).mutation(async ({ input }) => {
      const conversation = await getChatConversationByToken(input.publicToken);
      if (!conversation || conversation.conversation.id !== input.conversationId) throw new TRPCError({ code: "FORBIDDEN", message: "Conversa inválida. Atualize o atendimento e tente novamente." });
      if (conversation.conversation.status === "closed") throw new TRPCError({ code: "BAD_REQUEST", message: "Este atendimento foi encerrado. Inicie um novo atendimento para enviar outra mensagem." });
      await addChatMessage({ conversationId: input.conversationId, senderType: "visitor", senderName: conversation.visitor.name, body: input.body.trim() });
      return { success: true } as const;
    }),
  }),
  adminCatalog: router({
    products: adminProcedure.query(() => listAllProducts()),
    uploadImage: adminProcedure.input(uploadSchema).mutation(({ input }) => uploadImage("catalog", input)),
    createGalleryImage: adminProcedure.input(z.object({ title: z.string().min(2), description: z.string().optional(), imageUrl: z.string().url().or(z.string().startsWith("/uploads/")), imageKey: z.string().min(1) })).mutation(async ({ input, ctx }) => { await addGalleryImage(input); await audit(ctx, "criar", "galeria", input.title); }),
    createProduct: adminProcedure.input(z.object({ name: z.string().min(2), description: z.string().optional(), category: z.enum(["product", "service"]), priceCents: z.number().int().min(0), imageUrl: z.string().min(1), imageKey: z.string().min(1) })).mutation(async ({ input, ctx }) => { await addProduct({ ...input, active: 1 }); await audit(ctx, "criar", input.category, input.name); }),
    deleteGalleryImage: adminProcedure.input(z.object({ id: z.number().int() })).mutation(async ({ input, ctx }) => { await removeGalleryImage(input.id); await audit(ctx, "excluir", "galeria", `ID ${input.id}`); }),
    deleteProduct: adminProcedure.input(z.object({ id: z.number().int() })).mutation(async ({ input, ctx }) => { await removeProduct(input.id); await audit(ctx, "excluir", "catalogo", `ID ${input.id}`); }),
    settings: adminProcedure.query(() => listSiteSettings()),
    saveSettings: adminProcedure.input(z.object({ phone1: z.string().max(40), phone2: z.string().max(40), email: z.string().email().or(z.literal("")), city: z.string().max(120), address: z.string().max(240), completedServices: z.string().max(30), experienceYears: z.string().max(30), companyDescription: z.string().max(500), heroEyebrow: z.string().max(120), heroTitle: z.string().max(120), servicesTitle: z.string().max(160), aboutTitle: z.string().max(160), processTitle: z.string().max(160), contactTitle: z.string().max(160), logoUrl: z.string().max(600) })).mutation(async ({ input, ctx }) => { await saveSiteSettings(input); await audit(ctx, "editar", "configuracoes", "Configurações públicas atualizadas."); }),
    accounts: ownerProcedure.query(() => listPanelAccounts()),
    createAccount: ownerProcedure.input(z.object({ username: z.string().min(3).max(80), password: z.string().min(8).max(120), displayName: z.string().min(2).max(120) })).mutation(async ({ input, ctx }) => { await createPanelAccount({ username: input.username, displayName: input.displayName, passwordHash: passwordHash(input.password) }); await audit(ctx, "criar", "usuario", `Usuário ${input.username} criado.`); }),
    setAccountActive: ownerProcedure.input(z.object({ id: z.number().int(), active: z.number().int().min(0).max(1) })).mutation(async ({ input, ctx }) => { await setPanelAccountActive(input.id, input.active); await audit(ctx, "alterar", "usuario", `Conta ${input.id} ${input.active ? "ativada" : "desativada"}.`); }),
    auditLogs: ownerProcedure.query(() => listAuditLogs()),
    chatConversations: adminProcedure.query(() => listChatConversations()),
    chatMessages: adminProcedure.input(z.object({ conversationId: z.number().int() })).query(({ input }) => getChatMessages(input.conversationId)),
    chatSend: adminProcedure.input(z.object({ conversationId: z.number().int(), body: z.string().min(1).max(2000) })).mutation(async ({ input, ctx }) => { await addChatMessage({ conversationId: input.conversationId, senderType: "agent", senderName: ctx.user.name || "Equipe M&E", body: input.body }); await audit(ctx, "responder", "chat", `Conversa ${input.conversationId}`); return { success: true } as const; }),
    chatAssign: adminProcedure.input(z.object({ conversationId: z.number().int() })).mutation(async ({ input, ctx }) => { await assignChatConversation(input.conversationId, ctx.user.id, ctx.user.name || ctx.user.email || "Equipe M&E"); await audit(ctx, "assumir", "chat", `Conversa ${input.conversationId}`); return { success: true } as const; }),
    chatClose: adminProcedure.input(z.object({ conversationId: z.number().int() })).mutation(async ({ input, ctx }) => { await closeChatConversation(input.conversationId); await audit(ctx, "encerrar", "chat", `Conversa ${input.conversationId}`); return { success: true } as const; }),
  }),
});

export type AppRouter = typeof appRouter;
