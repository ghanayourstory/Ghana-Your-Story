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

/** Set while restoring a backup, so the old game doesn't overwrite it on the way out. */
let frozen = false;

let ready: Promise<{ deps: ApiDeps; markDirty: () => void; flush: () => Promise<void>; SQL: SqlJsStatic }> | null = null;
const boot = async () => {
  const SQL = await loadSqlJs();
  const raw = new SQL.Database((await loadBytes()) ?? undefined);
  const db = adapt(raw);
  migrate(db);
  const ctx: Ctx = { db, now: () => Date.now(), config: { devTools: true, everyoneIsTester: true } };
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
    if (!dirty || frozen) return;
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
  addEventListener("pagehide", () => { if (!frozen) void saveBytes(exportDb(raw)); });
  return { deps, markDirty: () => { dirty = true; }, flush: () => (frozen ? Promise.resolve() : saveBytes(exportDb(raw))), SQL };
};

export async function offlineRequest(m: { method: string; path: string; body: unknown; token: string | null; idemKey: string | null }) {
  ready ??= boot();
  const { deps, markDirty, flush } = await ready;
  const out = await handle(deps, m);
  markDirty(); // even reads advance the game clock
  if (m.path === "/api/player") await flush();
  return out;
}

// ---------------------------------------------------------------------------
// Backups: until the game server is hosted, a save lives in one browser.
// A backup file holds the whole save (and your sign-in token) so you can keep
// it safe or move it to another device.

const SAVE_KIND = "ghana-your-story-save";
function toB64(bytes: Uint8Array) {
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}
function fromB64(b64: string) {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export async function exportSave(): Promise<string> {
  ready ??= boot();
  const r = await ready;
  await r.flush();
  const bytes = await loadBytes();
  if (!bytes) throw new Error("Nothing saved yet");
  let token: string | null = null;
  try { token = localStorage.getItem("sika.token"); } catch { /* ignore */ }
  return JSON.stringify({ kind: SAVE_KIND, v: 1, savedAt: new Date().toISOString(), token, db: toB64(bytes) });
}

/** Check a backup and, if it's good, replace this browser's save with it. The page reloads. */
export async function importSave(text: string): Promise<void> {
  let parsed: { kind?: string; token?: string | null; db?: string };
  try { parsed = JSON.parse(text); } catch { throw new Error("That isn't a Ghana: Your Story backup file."); }
  if (parsed.kind !== SAVE_KIND || typeof parsed.db !== "string") throw new Error("That isn't a Ghana: Your Story backup file.");
  const bytes = fromB64(parsed.db);
  const header = new TextDecoder().decode(bytes.subarray(0, 15));
  if (header !== "SQLite format 3") throw new Error("The backup is damaged.");
  ready ??= boot();
  const { SQL } = await ready;
  const test = new SQL.Database(bytes);
  try {
    const n = test.exec("SELECT COUNT(*) FROM players")[0]?.values[0][0];
    if (!n) throw new Error("The backup has no character in it.");
  } finally {
    test.close();
  }
  frozen = true;
  await saveBytes(bytes);
  try {
    if (parsed.token) localStorage.setItem("sika.token", parsed.token);
  } catch { /* ignore */ }
  location.reload();
}
