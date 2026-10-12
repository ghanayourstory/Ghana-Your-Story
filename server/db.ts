// A tiny synchronous SQL interface. The engine is written against this so it
// runs on Node's built-in SQLite (server) and on sql.js (offline browser demo).

export type SqlValue = string | number | null;

export interface Db {
  exec(sql: string): void;
  get<T = Record<string, unknown>>(sql: string, ...params: SqlValue[]): T | undefined;
  all<T = Record<string, unknown>>(sql: string, ...params: SqlValue[]): T[];
  run(sql: string, ...params: SqlValue[]): { changes: number; lastInsertRowid: number };
}

let depth = new WeakMap<Db, number>();

/**
 * Run fn atomically. Nested calls join the outer transaction. Any throw rolls
 * everything back, so a half-applied purchase can never be persisted.
 */
export function tx<T>(db: Db, fn: () => T): T {
  const d = depth.get(db) ?? 0;
  if (d > 0) {
    depth.set(db, d + 1);
    try {
      return fn();
    } finally {
      depth.set(db, (depth.get(db) ?? 1) - 1);
    }
  }
  db.exec("BEGIN IMMEDIATE");
  depth.set(db, 1);
  try {
    const out = fn();
    db.exec("COMMIT");
    return out;
  } catch (err) {
    try {
      db.exec("ROLLBACK");
    } catch {
      /* already rolled back */
    }
    throw err;
  } finally {
    depth.set(db, 0);
  }
}

export function resetTxState() {
  depth = new WeakMap();
}

export const SCHEMA_VERSION = 1;

export const SCHEMA = `
CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);

CREATE TABLE IF NOT EXISTS players (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  token_hash TEXT UNIQUE,
  name TEXT NOT NULL,
  look TEXT NOT NULL,
  background TEXT NOT NULL,
  created_ms INTEGER NOT NULL,
  game_min INTEGER NOT NULL,
  last_sync_ms INTEGER NOT NULL,
  district TEXT NOT NULL,
  pos_x REAL NOT NULL DEFAULT 0,
  pos_z REAL NOT NULL DEFAULT 0,
  energy REAL NOT NULL, hunger REAL NOT NULL, health REAL NOT NULL, social REAL NOT NULL,
  reputation REAL NOT NULL DEFAULT 0,
  work REAL NOT NULL DEFAULT 0, fitness REAL NOT NULL DEFAULT 0, charisma REAL NOT NULL DEFAULT 0, business REAL NOT NULL DEFAULT 0,
  home_kind TEXT NOT NULL DEFAULT 'rental',
  home_ref TEXT NOT NULL,
  job_id TEXT, job_rank INTEGER NOT NULL DEFAULT 0, job_shifts INTEGER NOT NULL DEFAULT 0,
  shifts_total INTEGER NOT NULL DEFAULT 0,
  payroll_accrued INTEGER NOT NULL DEFAULT 0,
  last_day_processed INTEGER NOT NULL,
  last_month_billed INTEGER NOT NULL,
  rent_arrears INTEGER NOT NULL DEFAULT 0,
  rent_credit INTEGER NOT NULL DEFAULT 0,
  credit_score INTEGER NOT NULL DEFAULT 600,
  tbills_bought INTEGER NOT NULL DEFAULT 0,
  bets_won INTEGER NOT NULL DEFAULT 0,
  unlocks TEXT NOT NULL DEFAULT '[]',
  visited TEXT NOT NULL DEFAULT '[]',
  discovered TEXT NOT NULL DEFAULT '[]',
  is_test INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS accounts (
  player_id INTEGER NOT NULL,
  code TEXT NOT NULL,
  currency TEXT NOT NULL,
  balance INTEGER NOT NULL DEFAULT 0,
  allow_negative INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (player_id, code)
);

CREATE TABLE IF NOT EXISTS transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  player_id INTEGER NOT NULL,
  kind TEXT NOT NULL,
  memo TEXT NOT NULL,
  idem_key TEXT,
  game_min INTEGER NOT NULL,
  created_ms INTEGER NOT NULL,
  UNIQUE (player_id, idem_key)
);

CREATE TABLE IF NOT EXISTS ledger (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tx_id INTEGER NOT NULL,
  player_id INTEGER NOT NULL,
  account TEXT NOT NULL,
  currency TEXT NOT NULL,
  amount INTEGER NOT NULL,
  balance_after INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS ledger_player ON ledger (player_id, account);

CREATE TABLE IF NOT EXISTS stock (
  player_id INTEGER NOT NULL,
  good_id TEXT NOT NULL,
  qty INTEGER NOT NULL,
  cost INTEGER NOT NULL,
  PRIMARY KEY (player_id, good_id)
);

CREATE TABLE IF NOT EXISTS trade_sales (
  player_id INTEGER NOT NULL,
  place_id TEXT NOT NULL,
  good_id TEXT NOT NULL,
  day INTEGER NOT NULL,
  sold INTEGER NOT NULL,
  PRIMARY KEY (player_id, place_id, good_id, day)
);

CREATE TABLE IF NOT EXISTS idempotency (
  player_id INTEGER NOT NULL,
  key TEXT NOT NULL,
  response TEXT NOT NULL,
  created_ms INTEGER NOT NULL,
  PRIMARY KEY (player_id, key)
);

CREATE TABLE IF NOT EXISTS relationships (
  player_id INTEGER NOT NULL,
  npc_id TEXT NOT NULL,
  affinity REAL NOT NULL DEFAULT 0,
  romance REAL NOT NULL DEFAULT 0,
  partner INTEGER NOT NULL DEFAULT 0,
  talks_today INTEGER NOT NULL DEFAULT 0,
  last_talk_day INTEGER NOT NULL DEFAULT -1,
  last_gift_day INTEGER NOT NULL DEFAULT -1,
  last_topic TEXT,
  dates_done INTEGER NOT NULL DEFAULT 0,
  memories TEXT NOT NULL DEFAULT '[]',
  PRIMARY KEY (player_id, npc_id)
);

CREATE TABLE IF NOT EXISTS dates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  player_id INTEGER NOT NULL,
  npc_id TEXT NOT NULL,
  place_id TEXT NOT NULL,
  start_min INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
);

CREATE TABLE IF NOT EXISTS plots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  player_id INTEGER NOT NULL,
  plot_type TEXT NOT NULL,
  price INTEGER NOT NULL,
  bought_min INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS buildings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  player_id INTEGER NOT NULL,
  plot_id INTEGER NOT NULL UNIQUE,
  design TEXT NOT NULL,
  quality TEXT NOT NULL,
  stage INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL,
  stage_started_min INTEGER,
  stage_ends_min INTEGER,
  upgrade_to TEXT,
  use TEXT NOT NULL DEFAULT 'vacant',
  spent INTEGER NOT NULL DEFAULT 0,
  completed_min INTEGER
);

CREATE TABLE IF NOT EXISTS businesses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  player_id INTEGER NOT NULL,
  type TEXT NOT NULL,
  level INTEGER NOT NULL DEFAULT 1,
  bought_min INTEGER NOT NULL,
  upgrading_until INTEGER,
  last_visit_day INTEGER NOT NULL,
  total_profit INTEGER NOT NULL DEFAULT 0,
  last_day_profit INTEGER NOT NULL DEFAULT 0,
  history TEXT NOT NULL DEFAULT '[]'
);

CREATE TABLE IF NOT EXISTS vehicles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  player_id INTEGER NOT NULL,
  type TEXT NOT NULL,
  price INTEGER NOT NULL,
  bought_min INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS tbills (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  player_id INTEGER NOT NULL,
  product TEXT NOT NULL,
  principal INTEGER NOT NULL,
  payout INTEGER NOT NULL,
  bought_min INTEGER NOT NULL,
  matures_min INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'active'
);

CREATE TABLE IF NOT EXISTS goals (
  player_id INTEGER NOT NULL,
  goal_id TEXT NOT NULL,
  done_min INTEGER NOT NULL,
  PRIMARY KEY (player_id, goal_id)
);

CREATE TABLE IF NOT EXISTS life_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  player_id INTEGER NOT NULL,
  event_id TEXT NOT NULL,
  day INTEGER NOT NULL,
  status TEXT NOT NULL,
  choice TEXT,
  result TEXT,
  UNIQUE (player_id, day)
);

CREATE TABLE IF NOT EXISTS log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  player_id INTEGER NOT NULL,
  game_min INTEGER NOT NULL,
  kind TEXT NOT NULL,
  text TEXT NOT NULL,
  changes TEXT NOT NULL DEFAULT '[]'
);
CREATE INDEX IF NOT EXISTS log_player ON log (player_id, id);

CREATE TABLE IF NOT EXISTS fixtures (
  id TEXT PRIMARY KEY,
  data TEXT NOT NULL,
  status TEXT NOT NULL,
  kickoff_ms INTEGER NOT NULL,
  fetched_ms INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS bets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  player_id INTEGER NOT NULL,
  fixture_id TEXT NOT NULL,
  selection TEXT NOT NULL,
  stake INTEGER NOT NULL,
  odds REAL NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  payout INTEGER NOT NULL DEFAULT 0,
  placed_ms INTEGER NOT NULL,
  settled_ms INTEGER
);
CREATE INDEX IF NOT EXISTS bets_pending ON bets (status, fixture_id);

CREATE TABLE IF NOT EXISTS items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  player_id INTEGER NOT NULL,
  item_id TEXT NOT NULL,
  price INTEGER NOT NULL,
  bought_min INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS items_player ON items (player_id);

CREATE TABLE IF NOT EXISTS farms (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  player_id INTEGER NOT NULL,
  farm_type TEXT NOT NULL,
  price INTEGER NOT NULL,
  bought_min INTEGER NOT NULL,
  crop TEXT,
  planted_min INTEGER,
  ready_min INTEGER,
  status TEXT NOT NULL DEFAULT 'fallow',
  harvests INTEGER NOT NULL DEFAULT 0,
  total_income INTEGER NOT NULL DEFAULT 0,
  UNIQUE (player_id, farm_type)
);

CREATE TABLE IF NOT EXISTS courses (
  player_id INTEGER NOT NULL,
  course_id TEXT NOT NULL,
  sessions INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'enrolled',
  enrolled_min INTEGER NOT NULL,
  last_session_day INTEGER NOT NULL DEFAULT -1,
  completed_min INTEGER,
  PRIMARY KEY (player_id, course_id)
);

CREATE TABLE IF NOT EXISTS social (
  player_id INTEGER PRIMARY KEY,
  followers INTEGER NOT NULL DEFAULT 0,
  posts INTEGER NOT NULL DEFAULT 0,
  posts_today INTEGER NOT NULL DEFAULT 0,
  last_post_day INTEGER NOT NULL DEFAULT -1,
  promo_day INTEGER NOT NULL DEFAULT -1,
  feed TEXT NOT NULL DEFAULT '[]'
);

CREATE TABLE IF NOT EXISTS provider_state (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  status TEXT NOT NULL,
  message TEXT NOT NULL,
  checked_ms INTEGER NOT NULL,
  last_ok_ms INTEGER NOT NULL DEFAULT 0
);
`;

/** Columns added after the first release: applied to older saves on load. */
const ADDED_COLUMNS: [table: string, column: string, def: string][] = [
  ["vehicles", "status", "TEXT NOT NULL DEFAULT 'personal'"],
  ["vehicles", "condition", "REAL NOT NULL DEFAULT 100"],
  ["players", "fun", "REAL NOT NULL DEFAULT 70"],
  ["players", "hygiene", "REAL NOT NULL DEFAULT 80"],
  ["players", "bladder", "REAL NOT NULL DEFAULT 80"],
  ["players", "daily", "TEXT NOT NULL DEFAULT ''"],
  ["players", "needs_pace", "REAL NOT NULL DEFAULT 1"],
];

export function migrate(db: Db) {
  // One statement at a time: lighter on small embedded SQLite builds.
  for (const stmt of SCHEMA.split(";").map((x) => x.trim()).filter(Boolean)) db.exec(stmt);
  for (const [table, column, def] of ADDED_COLUMNS) {
    const cols = db.all<{ name: string }>(`PRAGMA table_info(${table})`).map((c) => c.name);
    if (!cols.includes(column)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${def}`);
  }
  db.run("INSERT OR IGNORE INTO meta (key, value) VALUES ('schema_version', ?)", String(SCHEMA_VERSION));
  db.run("INSERT OR IGNORE INTO provider_state (id, status, message, checked_ms) VALUES (1, 'unknown', 'Waiting for match data', 0)");
}
