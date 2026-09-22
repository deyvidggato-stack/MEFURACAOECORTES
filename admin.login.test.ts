import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

describe("auth.adminLogin", () => {
  it("accepts the configured administrator credentials", async () => {
    const username = process.env.ADMIN_USERNAME;
    const password = process.env.ADMIN_PASSWORD;
    if (!username || !password) throw new Error("Admin credentials are not configured");
    const headers: Record<string, string> = {};
    const ctx: TrpcContext = {
      user: null,
      req: { protocol: "https", headers } as TrpcContext["req"],
      res: { cookie: (name: string, value: string) => { headers[name] = value; } } as unknown as TrpcContext["res"],
    };
    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.adminLogin({ username, password });
    expect(result).toEqual({ success: true });
    expect(Object.keys(headers).length).toBeGreaterThan(0);
  });
});
