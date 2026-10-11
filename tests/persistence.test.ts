import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { act, bal, makeCtx, newPlayer, travel } from "./helpers.ts";
import { buildState, loadPlayer, readState } from "../server/engine.ts";
import { auditPlayer } from "../server/ledger.ts";

test("save and reload: state survives closing and reopening the database", () => {
  const dir = mkdtempSync(join(tmpdir(), "sika-"));
  const file = join(dir, "save.db");
  try {
    const first = makeCtx({ file });
    const id = newPlayer(first.ctx);
    travel(first.ctx, id, "osu");
    assert.ok(act(first.ctx, id, { type: "service", placeId: "esi_waakye", serviceId: "waakye" }).ok);
    assert.ok(act(first.ctx, id, { type: "tbill_buy", product: "t7", amount: 10_000 }).ok);
    const before = buildState(first.ctx, loadPlayer(first.ctx.db, id));

    const second = makeCtx({ file });
    second.clock.now = first.clock.now;
    const after = buildState(second.ctx, loadPlayer(second.ctx.db, id));
    assert.equal(after.player.district, "osu");
    assert.equal(after.time.minute, before.time.minute);
    assert.deepEqual(after.player.stats, before.player.stats);
    assert.equal(after.money.netWorth, before.money.netWorth);
    assert.equal(bal(second.ctx, id, "tbill"), 10_000);
    assert.ok(auditPlayer(second.ctx.db, id).ok);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("time only advances with real play time, capped for long absences", () => {
  const { ctx, clock } = makeCtx();
  const id = newPlayer(ctx);
  const m0 = readState(ctx, id).state.time.minute;
  clock.now += 30_000; // 30 real seconds
  const m1 = readState(ctx, id).state.time.minute;
  assert.equal(m1 - m0, 30);
  clock.now += 3 * 24 * 3600_000; // away for three days
  const m2 = readState(ctx, id).state.time.minute;
  assert.ok(m2 - m1 <= 150, "a long absence doesn't fast-forward the city");
});

test("each game day is settled exactly once", () => {
  const { ctx } = makeCtx({ devTools: true });
  const id = newPlayer(ctx, "graduate", true);
  act(ctx, id, { type: "dev_skip", hours: 24 * 5 });
  const days = ctx.db.all<{ memo: string }>("SELECT memo FROM transactions WHERE player_id = ? AND kind = 'interest'", id).map((r) => r.memo);
  assert.equal(days.length, 5);
  const p = loadPlayer(ctx.db, id);
  assert.equal(p.last_day_processed, Math.floor(p.game_min / 1440));
});

test("working a shift pays, costs energy and advances time", () => {
  const { ctx } = makeCtx();
  const id = newPlayer(ctx);
  // Day 0 is a Monday, 07:00, Kaneshie.
  assert.ok(act(ctx, id, { type: "job_apply", jobId: "market_loader" }).ok);
  const cash = bal(ctx, id, "cash");
  const energy = loadPlayer(ctx.db, id).energy;
  const r = act(ctx, id, { type: "work" });
  assert.ok(r.ok, r.error);
  assert.ok(bal(ctx, id, "cash") > cash);
  assert.ok(loadPlayer(ctx.db, id).energy < energy);
  assert.equal(loadPlayer(ctx.db, id).game_min, 7 * 60 + 6 * 60);
  // Goal "first pay day" granted exactly once.
  assert.equal(ctx.db.get<{ n: number }>("SELECT COUNT(*) AS n FROM goals WHERE player_id = ? AND goal_id = 'first_pay'", id)!.n, 1);
});

test("talking to someone who isn't there is refused; talking builds a remembered relationship", () => {
  const { ctx } = makeCtx();
  const id = newPlayer(ctx);
  assert.equal(act(ctx, id, { type: "talk", npcId: "esi", topic: "chat" }).code, "not_here");
  travel(ctx, id, "osu");
  const r = act(ctx, id, { type: "talk", npcId: "esi", topic: "chat" });
  assert.ok(r.ok, r.error);
  const rel = ctx.db.get<{ affinity: number; memories: string }>("SELECT * FROM relationships WHERE npc_id = 'esi'")!;
  assert.ok(rel.affinity > 0);
  assert.match(rel.memories, /first met/);
});
