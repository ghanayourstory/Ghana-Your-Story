import { randomUUID } from "node:crypto";
import { migrate } from "../server/db.ts";
import { openNodeDb } from "../server/sqlite-node.ts";
import { createPlayer, perform, type Action, type Ctx } from "../server/engine.ts";
import { balance } from "../server/ledger.ts";

export function makeCtx(opts: { devTools?: boolean; file?: string } = {}) {
  const clock = { now: Date.UTC(2026, 9, 11, 12, 0, 0) };
  const db = openNodeDb(opts.file ?? ":memory:");
  migrate(db);
  const ctx: Ctx = { db, now: () => clock.now, config: { devTools: opts.devTools ?? false } };
  return { ctx, clock, db };
}

export function newPlayer(ctx: Ctx, background = "graduate", isTest = false) {
  return createPlayer(ctx, { name: "Ama Test", look: {}, background, isTest });
}

export const key = () => randomUUID().replace(/-/g, "");

export function act(ctx: Ctx, id: number, action: Action, idem = key()) {
  return perform(ctx, id, idem, action);
}

export function bal(ctx: Ctx, id: number, code: string) {
  return balance(ctx.db, id, code);
}

/** Give a test player money through the audited dev-grant path. */
export function grant(ctx: Ctx, id: number, cedis: number) {
  const r = act(ctx, id, { type: "dev_grant", amount: cedis * 100 });
  if (!r.ok) throw new Error(r.error);
}

export function travel(ctx: Ctx, id: number, to: string, mode = "taxi") {
  const r = act(ctx, id, { type: "travel", to, mode });
  if (!r.ok) throw new Error(`travel failed: ${r.error}`);
  return r;
}

export function gameMin(ctx: Ctx, id: number): number {
  return ctx.db.get<{ game_min: number }>("SELECT game_min FROM players WHERE id = ?", id)!.game_min;
}
