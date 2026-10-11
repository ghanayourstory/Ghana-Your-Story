import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// The game server (server/index.ts) owns /api. In development Vite proxies to it.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true,
    proxy: { "/api": "http://127.0.0.1:8787" },
  },
  build: { outDir: "dist", chunkSizeWarningLimit: 1200 },
});
