import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import type { Db, SqlValue } from "./db.ts";

export function openNodeDb(file: string): Db {
  if (file !== ":memory:") mkdirSync(dirname(file), { recursive: true });
  const raw = new DatabaseSync(file);
  raw.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;");
  const cache = new Map<string, ReturnType<DatabaseSync["prepare"]>>();
  const stmt = (sql: string) => {
    let s = cache.get(sql);
    if (!s) {
      s = raw.prepare(sql);
      cache.set(sql, s);
    }
    return s;
  };
  return {
    exec: (sql) => raw.exec(sql),
    get: <T>(sql: string, ...p: SqlValue[]) => stmt(sql).get(...p) as T | undefined,
    all: <T>(sql: string, ...p: SqlValue[]) => stmt(sql).all(...p) as T[],
    run: (sql, ...p) => {
      const r = stmt(sql).run(...p);
      return { changes: Number(r.changes), lastInsertRowid: Number(r.lastInsertRowid) };
    },
  };
}
