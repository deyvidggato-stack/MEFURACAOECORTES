import express from "express";
import { createServer } from "http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { appRouter } from "./routers";
import { createContext } from "./context";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const server = createServer(app);

  app.set("trust proxy", 1);
  app.use(express.json({ limit: "12mb" }));
  app.use(express.urlencoded({ extended: true, limit: "12mb" }));

  app.get("/api/health", (_req, res) => res.json({ ok: true }));
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
