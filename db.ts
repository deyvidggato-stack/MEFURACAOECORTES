import { and, desc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { AuditLog, ChatMessage, GalleryImage, InsertUser, PanelAccount, Product, SiteSetting, auditLogs, chatConversations, chatMessages, chatVisitors, galleryImages, panelAccounts, products, siteSettings, users } from "./schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) return;
  const values: InsertUser = { openId: user.openId };
  const updateSet: Record<string, unknown> = {};
  const textFields = ["name", "email", "loginMethod"] as const;
  for (const field of textFields) {
    if (user[field] !== undefined) {
      values[field] = user[field] ?? null;
      updateSet[field] = user[field] ?? null;
    }
  }
  if (user.lastSignedIn !== undefined) {
    values.lastSignedIn = user.lastSignedIn;
    updateSet.lastSignedIn = user.lastSignedIn;
  }
  if (user.role !== undefined) {
    values.role = user.role;
    updateSet.role = user.role;
  } else if (user.openId === ENV.ownerOpenId) {
    values.role = "admin";
    updateSet.role = "admin";
  }
  if (user.panelRole !== undefined) {
    values.panelRole = user.panelRole;
    updateSet.panelRole = user.panelRole;
  }
  values.lastSignedIn ??= new Date();
  updateSet.lastSignedIn ??= new Date();
  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result[0];
}

export async function listGalleryImages(): Promise<GalleryImage[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(galleryImages).orderBy(desc(galleryImages.createdAt));
}

export async function listProducts(category?: "product" | "service"): Promise<Product[]> {
  const db = await getDb();
  if (!db) return [];
  const filters = category ? [eq(products.active, 1), eq(products.category, category)] : [eq(products.active, 1)];
  return db.select().from(products).where(and(...filters)).orderBy(desc(products.createdAt));
}

export async function listAllProducts(): Promise<Product[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(products).orderBy(desc(products.createdAt));
}

export async function addGalleryImage(input: Omit<typeof galleryImages.$inferInsert, "id" | "createdAt">) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.insert(galleryImages).values(input);
}

export async function addProduct(input: Omit<typeof products.$inferInsert, "id" | "createdAt" | "updatedAt">) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.insert(products).values(input);
}

export async function removeGalleryImage(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.delete(galleryImages).where(eq(galleryImages.id, id));
}

export async function removeProduct(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.delete(products).where(eq(products.id, id));
}

export async function listSiteSettings(): Promise<Record<string, string>> {
  const db = await getDb();
  if (!db) return {};
  const rows = await db.select().from(siteSettings);
  return Object.fromEntries(rows.map((row: SiteSetting) => [row.settingKey, row.settingValue]));
}

export async function saveSiteSettings(values: Record<string, string>) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  for (const [settingKey, settingValue] of Object.entries(values)) {
    await db.insert(siteSettings).values({ settingKey, settingValue }).onDuplicateKeyUpdate({ set: { settingValue } });
  }
}

export async function createPanelAccount(input: { username: string; passwordHash: string; displayName: string }) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.insert(panelAccounts).values(input);
}

export async function listPanelAccounts(): Promise<PanelAccount[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(panelAccounts).orderBy(desc(panelAccounts.createdAt));
}

export async function getPanelAccount(username: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(panelAccounts).where(eq(panelAccounts.username, username)).limit(1);
  return result[0];
}

export async function setPanelAccountActive(id: number, active: number) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.update(panelAccounts).set({ active }).where(eq(panelAccounts.id, id));
}

export async function markPanelLogin(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(panelAccounts).set({ lastLoginAt: new Date() }).where(eq(panelAccounts.id, id));
}

export async function addAuditLog(input: Omit<typeof auditLogs.$inferInsert, "id" | "createdAt">) {
  const db = await getDb();
  if (!db) return;
  await db.insert(auditLogs).values(input);
}

export async function listAuditLogs(limit = 200): Promise<AuditLog[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(auditLogs).orderBy(desc(auditLogs.createdAt)).limit(limit);
}

export async function createChatVisitor(input: { publicToken: string; username: string; passwordHash: string; name: string; email?: string; phone?: string }) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");

  // Create the visitor and its conversation atomically. Without a transaction,
  // a failed conversation insert could leave the username registered even
  // though the UI reported an error, causing the next attempt to say
  // "usuário já está cadastrado".
  return db.transaction(async tx => {
    await tx.insert(chatVisitors).values(input);

    // Do not rely on mysql2/Drizzle exposing insertId here. Depending on the
    // driver/runtime combination it can be undefined, which would turn the
    // visitorId into NaN and make the conversation INSERT fail. Read the
    // generated id back from the unique username inside the same transaction.
    const visitorRows = await tx
      .select({ id: chatVisitors.id })
      .from(chatVisitors)
      .where(eq(chatVisitors.username, input.username))
      .limit(1);
    const visitorId = visitorRows[0]?.id;
    if (!visitorId) throw new Error("Could not determine new visitor id");

    await tx.insert(chatConversations).values({ visitorId, status: "open" });

    // Fetch the newly-created conversation id rather than relying on insertId.
    const conversationRows = await tx
      .select({ id: chatConversations.id })
      .from(chatConversations)
      .where(eq(chatConversations.visitorId, visitorId))
      .orderBy(desc(chatConversations.id))
      .limit(1);
    const conversationId = conversationRows[0]?.id;
    if (!conversationId) throw new Error("Could not determine new conversation id");

    return { publicToken: input.publicToken, visitorId, conversationId };
  });
}

export async function getChatVisitorByUsername(username: string) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db.select().from(chatVisitors).where(eq(chatVisitors.username, username)).limit(1);
  return rows[0];
}

export async function getChatConversationByToken(publicToken: string) {
  const db = await getDb();
  if (!db) return undefined;
  const visitorRows = await db.select().from(chatVisitors).where(eq(chatVisitors.publicToken, publicToken)).limit(1);
  const visitor = visitorRows[0];
  if (!visitor) return undefined;
  const conversations = await db.select().from(chatConversations).where(eq(chatConversations.visitorId, visitor.id)).orderBy(desc(chatConversations.updatedAt)).limit(1);
  const conversation = conversations[0];
  if (!conversation) return undefined;
  const messages = await db.select().from(chatMessages).where(eq(chatMessages.conversationId, conversation.id)).orderBy(desc(chatMessages.createdAt));
  await db.update(chatVisitors).set({ lastSeenAt: new Date() }).where(eq(chatVisitors.id, visitor.id));
  return { visitor, conversation, messages: messages.reverse() };
}

export async function addChatMessage(input: { conversationId: number; senderType: "visitor" | "agent"; senderName: string; body: string }) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");

  // Keep the message insert and conversation timestamp update together so a
  // transient database error cannot make the send button appear to do nothing.
  await db.transaction(async tx => {
    await tx.insert(chatMessages).values(input);
    await tx.update(chatConversations).set({ updatedAt: new Date(), status: "open" }).where(eq(chatConversations.id, input.conversationId));
  });
}

export async function listChatConversations() {
  const db = await getDb();
  if (!db) return [];
  return db.select({ conversation: chatConversations, visitor: chatVisitors }).from(chatConversations).innerJoin(chatVisitors, eq(chatVisitors.id, chatConversations.visitorId)).orderBy(desc(chatConversations.updatedAt));
}

export async function getChatMessages(conversationId: number): Promise<ChatMessage[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(chatMessages).where(eq(chatMessages.conversationId, conversationId)).orderBy(desc(chatMessages.createdAt)).then(rows => rows.reverse());
}

export async function assignChatConversation(id: number, userId: number, username: string) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.update(chatConversations).set({ assignedUserId: userId, assignedUsername: username, updatedAt: new Date() }).where(eq(chatConversations.id, id));
}

export async function closeChatConversation(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.update(chatConversations).set({ status: "closed", updatedAt: new Date() }).where(eq(chatConversations.id, id));
}
