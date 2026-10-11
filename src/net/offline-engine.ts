// Offline demo: the authoritative engine running in this browser on sql.js,
// persisted to IndexedDB. Same code as the server — but because it runs on
// the player's own device, it's for testing/demo play, not cheat-proof.
import type { Database, Statement, SqlJsStatic } from "sql.js";
// The asm.js build of SQLite: no WebAssembly compile step, so it runs under strict
// page security policies. Loaded unbundled (minifying it breaks it) on the main
// thread (worker stacks are too small for it).
function loadSqlJs(): Promise<SqlJsStatic> {
  const g = globalThis as unknown as { initSqlJs?: (cfg?: object) => Promise<SqlJsStatic> };
  if (g.initSqlJs) return g.initSqlJs();
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = new URL("vendor/sql-asm.js", document.baseURI).href;
    s.onload = () => g.initSqlJs!().then(resolve, reject);
    s.onerror = () => reject(new Error("Could not load the game database"));
    document.head.appendChild(s);
  });
}
import { migrate, type Db, type SqlValue } from "../../server/db.ts";
import { handle, type ApiDeps } from "../../server/api.ts";
import { createMockProvider, refreshFixtures, settleBets } from "../../server/football.ts";
import type { Ctx } from "../../server/engine.ts";

const IDB = "sika-offline";
const STORE = "db";

function idb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const r = indexedDB.open(IDB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE);
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}
async function loadBytes(): Promise<Uint8Array | null> {
  try {
    const d = await idb();
    return await new Promise((resolve) => {
      const g = d.transaction(STORE).objectStore(STORE).get("main");
      g.onsuccess = () => resolve((g.result as Uint8Array) ?? null);
      g.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}
async function saveBytes(bytes: Uint8Array) {
  try {
    const d = await idb();
    await new Promise<void>((resolve) => {
      const t = d.transaction(STORE, "readwrite");
      t.objectStore(STORE).put(bytes, "main");
      t.oncomplete = () => resolve();
      t.onerror = () => resolve();
    });
  } catch {
    /* storage unavailable: session only */
  }
}

// sql.js closes every prepared statement on export(), so the cache is reset then.
const cache = new Map<string, Statement>();
function exportDb(raw: Database) {
  const bytes = raw.export();
  cache.clear();
  return bytes;
}

function adapt(raw: Database): Db {
  const stmt = (sql: string) => {
    let s = cache.get(sql);
    if (!s) {
      s = raw.prepare(sql);
      cache.set(sql, s);
    }
    return s;
  };
  return {
    exec: (sql) => {
      raw.exec(sql);
    },
    get: <T>(sql: string, ...p: SqlValue[]) => {
      const s = stmt(sql);
      try {
        s.bind(p);
        return (s.step() ? s.getAsObject() : undefined) as T | undefined;
      } finally {
        s.reset();
      }
    },
    all: <T>(sql: string, ...p: SqlValue[]) => {
      const s = stmt(sql);
      const out: T[] = [];
      try {
        s.bind(p);
        while (s.step()) out.push(s.getAsObject() as T);
      } finally {
        s.reset();
      }
      return out;
    },
    run: (sql, ...p) => {
      const s = stmt(sql);
      try {
        s.run(p);
      } finally {
        s.reset();
      }
      const changes = raw.getRowsModified();
      const id = raw.exec("SELECT last_insert_rowid() AS id")[0]?.values[0][0] as number;
      return { changes, lastInsertRowid: Number(id ?? 0) };
    },
  };
}

let ready: Promise<{ deps: ApiDeps; markDirty: () => void; flush: () => Promise<void> }> | null = null;
const boot = async () => {
  const SQL = await loadSqlJs();
  const raw = new SQL.Database((await loadBytes()) ?? undefined);
  const db = adapt(raw);
  migrate(db);
  const ctx: Ctx = { db, now: () => Date.now(), config: { devTools: true } };
  const provider = createMockProvider();
  let dirty = false;
  const tick = async () => {
    const s = await refreshFixtures(ctx, provider);
    if (s.status === "ok") settleBets(ctx);
    dirty = true;
  };
  await tick();
  setInterval(tick, 20_000);
  setInterval(() => {
    if (!dirty) return;
    dirty = false;
    void saveBytes(exportDb(raw));
  }, 4000);
  const deps: ApiDeps = {
    ctx,
    hashToken: async (t) => {
      const h = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(t));
      return Array.from(new Uint8Array(h), (b) => b.toString(16).padStart(2, "0")).join("");
    },
    newToken: () => Array.from(crypto.getRandomValues(new Uint8Array(32)), (b) => b.toString(16).padStart(2, "0")).join(""),
  };
  addEventListener("pagehide", () => void saveBytes(exportDb(raw)));
  return { deps, markDirty: () => { dirty = true; }, flush: () => saveBytes(exportDb(raw)) };
};

export async function offlineRequest(m: { method: string; path: string; body: unknown; token: string | null; idemKey: string | null }) {
  ready ??= boot();
  const { deps, markDirty, flush } = await ready;
  const out = await handle(deps, m);
  markDirty(); // even reads advance the game clock
  if (m.path === "/api/player") await flush();
  return out;
}
