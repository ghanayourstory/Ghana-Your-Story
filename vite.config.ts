import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// The game server (server/index.ts) owns /api. In development Vite proxies to it.
// `vite build --mode demo` makes the self-contained offline demo (engine in a worker).
export default defineConfig(({ mode }) => ({
  plugins: [react()],
  base: mode === "demo" ? "./" : "/",
  define: mode === "demo" ? { "import.meta.env.VITE_OFFLINE": JSON.stringify("1") } : {},
  server: {
    port: 5173,
    host: true,
    proxy: { "/api": "http://127.0.0.1:8787" },
  },
  worker: { format: "iife" },
  build: { outDir: mode === "demo" ? "dist-demo" : "dist", chunkSizeWarningLimit: 2500 },
}));
