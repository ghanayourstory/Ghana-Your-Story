// The money ledger. Every balance change is a transaction with one or more
// legs, written in the same SQL transaction as the balance update. Balances
// can always be re-derived from the ledger (see auditPlayer).
import type { Db } from "./db.ts";
import type { Currency } from "../shared/money.ts";

export class GameError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

export const ACCOUNT_DEFS: Record<string, { currency: Currency; allowNegative: boolean; label: string }> = {
  cash: { currency: "GHS", allowNegative: false, label: "Cash" },
  bank: { currency: "GHS", allowNegative: false, label: "Bank savings" },
  momo: { currency: "GHS", allowNegative: false, label: "MoMo wallet" },
  usd: { currency: "USD", allowNegative: false, label: "Dollar account" },
  tbill: { currency: "GHS", allowNegative: false, label: "Treasury bills" },
  loan: { currency: "GHS", allowNegative: false, label: "Loan owed" },
};

export function accountDef(code: string) {
  if (code.startsWith("biz:")) return { currency: "GHS" as Currency, allowNegative: true, label: "Business till" };
  const d = ACCOUNT_DEFS[code];
  if (!d) throw new GameError("bad_account", `Unknown account ${code}`);
  return d;
}

export function ensureAccount(db: Db, playerId: number, code: string) {
  const d = accountDef(code);
  db.run(
    "INSERT OR IGNORE INTO accounts (player_id, code, currency, balance, allow_negative) VALUES (?, ?, ?, 0, ?)",
    playerId, code, d.currency, d.allowNegative ? 1 : 0,
  );
}

export function balance(db: Db, playerId: number, code: string): number {
  const r = db.get<{ balance: number }>("SELECT balance FROM accounts WHERE player_id = ? AND code = ?", playerId, code);
  return r ? Number(r.balance) : 0;
}

export interface Leg {
  account: string;
  amount: number; // signed minor units
}

export interface PostOpts {
  kind: string;
  memo: string;
  gameMin: number;
  nowMs: number;
  idemKey?: string;
}

/**
 * Post a transaction. Must be called inside tx(). Throws (and so rolls back
 * the whole action) if any account would go negative where not allowed.
 * Returns null if this idempotency key was already posted.
 */
export function post(db: Db, playerId: number, legs: Leg[], opts: PostOpts): number | null {
  if (!legs.length) throw new GameError("empty_tx", "Nothing to post");
  for (const l of legs) {
    if (!Number.isSafeInteger(l.amount)) throw new GameError("bad_amount", "Amounts must be whole minor units");
  }
  if (opts.idemKey) {
    const dup = db.get("SELECT id FROM transactions WHERE player_id = ? AND idem_key = ?", playerId, opts.idemKey);
    if (dup) return null;
  }
  const t = db.run(
    "INSERT INTO transactions (player_id, kind, memo, idem_key, game_min, created_ms) VALUES (?, ?, ?, ?, ?, ?)",
    playerId, opts.kind, opts.memo, opts.idemKey ?? null, opts.gameMin, opts.nowMs,
  );
  const txId = t.lastInsertRowid;
  for (const leg of legs) {
    if (leg.amount === 0) continue;
    ensureAccount(db, playerId, leg.account);
    const def = accountDef(leg.account);
    const before = balance(db, playerId, leg.account);
    const after = before + leg.amount;
    if (!def.allowNegative && after < 0) {
      throw new GameError("insufficient_funds", `Not enough in ${def.label.toLowerCase()}`);
    }
    db.run("UPDATE accounts SET balance = ? WHERE player_id = ? AND code = ?", after, playerId, leg.account);
    db.run(
      "INSERT INTO ledger (tx_id, player_id, account, currency, amount, balance_after) VALUES (?, ?, ?, ?, ?, ?)",
      txId, playerId, leg.account, def.currency, leg.amount, after,
    );
  }
  return txId;
}

/** Verify every account balance equals the sum of its ledger legs. */
export function auditPlayer(db: Db, playerId: number): { ok: boolean; mismatches: { account: string; balance: number; ledger: number }[] } {
  const rows = db.all<{ code: string; balance: number }>("SELECT code, balance FROM accounts WHERE player_id = ?", playerId);
  const mismatches = [];
  for (const r of rows) {
    const s = db.get<{ s: number | null }>("SELECT SUM(amount) AS s FROM ledger WHERE player_id = ? AND account = ?", playerId, r.code);
    const sum = Number(s?.s ?? 0);
    if (sum !== Number(r.balance)) mismatches.push({ account: r.code, balance: Number(r.balance), ledger: sum });
  }
  return { ok: mismatches.length === 0, mismatches };
}

export function recentLedger(db: Db, playerId: number, limit = 40) {
  return db.all<{ id: number; kind: string; memo: string; game_min: number; legs: string }>(
    `SELECT t.id, t.kind, t.memo, t.game_min,
            json_group_array(json_object('account', l.account, 'amount', l.amount, 'currency', l.currency)) AS legs
       FROM transactions t JOIN ledger l ON l.tx_id = t.id
      WHERE t.player_id = ?
      GROUP BY t.id ORDER BY t.id DESC LIMIT ?`,
    playerId, limit,
  ).map((r) => ({ id: r.id, kind: r.kind, memo: r.memo, gameMin: r.game_min, legs: JSON.parse(r.legs) as { account: string; amount: number; currency: Currency }[] }));
}
