// Ghana: Your Story game server: authoritative state, static hosting of the built client.
import { createServer } from "node:http";
import { createHash, randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { migrate } from "./db.ts";
import { openNodeDb } from "./sqlite-node.ts";
import { handle, type ApiDeps } from "./api.ts";
import { createHttpProvider, createMockProvider, refreshFixtures, settleBets, type MockMode } from "./football.ts";
import type { Ctx } from "./engine.ts";

const root = fileURLToPath(new URL("..", import.meta.url));
const PORT = Number(process.env.PORT ?? 8787);
const production = process.env.NODE_ENV === "production";
// Dev tools need BOTH a non-production server and an explicit opt-in.
const devTools = !production && process.env.SIKA_DEV_TOOLS === "1";

const db = openNodeDb(process.env.SIKA_DB ?? join(root, "data", "sika.db"));
migrate(db);
const ctx: Ctx = { db, now: () => Date.now(), config: { devTools } };

const provider = process.env.MATCH_API_URL && process.env.MATCH_API_KEY
  ? createHttpProvider(process.env.MATCH_API_URL, process.env.MATCH_API_KEY)
  : createMockProvider(() => (process.env.MOCK_FEED_MODE as MockMode) || "ok");

const deps: ApiDeps = {
  ctx,
  hashToken: async (t) => createHash("sha256").update(t).digest("hex"),
  newToken: () => randomBytes(32).toString("hex"),
};

async function footballTick() {
  try {
    const s = await refreshFixtures(ctx, provider);
    if (s.status === "ok") settleBets(ctx);
  } catch (err) {
    console.error("football tick failed", err);
  }
}
footballTick();
setInterval(footballTick, 20_000);

// Very small per-IP rate limiter (token bucket).
const buckets = new Map<string, { tokens: number; at: number }>();
function allow(ip: string) {
  const now = Date.now();
  const b = buckets.get(ip) ?? { tokens: 40, at: now };
  b.tokens = Math.min(40, b.tokens + ((now - b.at) / 1000) * 15);
  b.at = now;
  if (b.tokens < 1) return false;
  b.tokens -= 1;
  buckets.set(ip, b);
  return true;
}

const MIME: Record<string, string> = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".png": "image/png", ".json": "application/json", ".wasm": "application/wasm" };

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", "http://localhost");
  if (url.pathname.startsWith("/api/")) {
    if (!allow(req.socket.remoteAddress ?? "?")) {
      res.writeHead(429, { "content-type": "application/json" }).end(JSON.stringify({ ok: false, error: "Slow down" }));
      return;
    }
    let raw = "";
    for await (const chunk of req) {
      raw += chunk;
      if (raw.length > 32_000) {
        res.writeHead(413).end();
        return;
      }
    }
    let body: unknown = null;
    try {
      body = raw ? JSON.parse(raw) : null;
    } catch {
      res.writeHead(400, { "content-type": "application/json" }).end(JSON.stringify({ ok: false, error: "Bad JSON" }));
      return;
    }
    const auth = req.headers.authorization;
    const out = await handle(deps, {
      method: req.method ?? "GET",
      path: url.pathname,
      body,
      token: auth?.startsWith("Bearer ") ? auth.slice(7) : null,
      idemKey: (req.headers["idempotency-key"] as string | undefined) ?? null,
    });
    res.writeHead(out.status, { "content-type": "application/json", "cache-control": "no-store" }).end(JSON.stringify(out.json));
    return;
  }
  // Static client (production build).
  const dist = join(root, "dist");
  let file = normalize(join(dist, url.pathname === "/" ? "index.html" : url.pathname));
  if (!file.startsWith(dist)) file = join(dist, "index.html");
  try {
    const data = await readFile(file);
    res.writeHead(200, { "content-type": MIME[extname(file)] ?? "application/octet-stream" }).end(data);
  } catch {
    try {
      res.writeHead(200, { "content-type": MIME[".html"] }).end(await readFile(join(dist, "index.html")));
    } catch {
      res.writeHead(404).end("Build the client first: npm run build");
    }
  }
});

server.listen(PORT, () => {
  console.log(`Ghana: Your Story server on http://localhost:${PORT} (${production ? "production" : "development"}, dev tools ${devTools ? "ON" : "off"}, match data: ${provider.name})`);
});
