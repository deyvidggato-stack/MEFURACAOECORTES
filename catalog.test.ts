import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

function context(user: TrpcContext["user"] = null): TrpcContext {
  return {
    user,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("catalog", () => {
  it("exposes gallery and products as public lists", async () => {
    const caller = appRouter.createCaller(context());
    const [gallery, products, services] = await Promise.all([
      caller.catalog.gallery(),
      caller.catalog.products(),
      caller.catalog.products({ category: "service" }),
    ]);
    expect(Array.isArray(gallery)).toBe(true);
    expect(Array.isArray(products)).toBe(true);
    expect(Array.isArray(services)).toBe(true);
  });

  it("protects catalog management from unauthenticated users", async () => {
    const caller = appRouter.createCaller(context());
    await expect(caller.adminCatalog.products()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("allows an admin to read all products", async () => {
    const caller = appRouter.createCaller(context({
      id: 1,
      openId: "admin",
      name: "Admin",
      email: "admin@example.com",
      loginMethod: "test",
      role: "admin",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    }));
    const products = await caller.adminCatalog.products();
    expect(Array.isArray(products)).toBe(true);
  });
});
