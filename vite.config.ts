import { jsxLocPlugin } from "@builder.io/vite-plugin-jsx-loc";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { defineConfig } from "vite";

const root = path.resolve(import.meta.dirname);

export default defineConfig({
  plugins: [react(), tailwindcss(), jsxLocPlugin()],
  resolve: {
    alias: [
      { find: "@shared", replacement: root },
      { find: "@/_core/hooks", replacement: root },
      { find: "@/components/ui", replacement: root },
      { find: "@/components", replacement: root },
      { find: "@/pages", replacement: root },
      { find: "@/contexts", replacement: root },
      { find: "@/lib", replacement: root },
      { find: "@", replacement: root },
      { find: "@assets", replacement: path.resolve(root, "attached_assets") },
    ],
  },
  envDir: root,
  root,
  publicDir: path.resolve(root, "public"),
  build: {
    outDir: path.resolve(root, "dist/public"),
    emptyOutDir: true,
  },
  server: { host: true, allowedHosts: true },
});
