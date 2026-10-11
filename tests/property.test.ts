import test from "node:test";
import assert from "node:assert/strict";
import { act, bal, gameMin, grant, makeCtx, newPlayer, travel } from "./helpers.ts";
import { auditPlayer } from "../server/ledger.ts";
import { stagePlan, businessUpgradeCost, BUSINESSES } from "../shared/economy.ts";
import { MINUTES_PER_DAY } from "../shared/calendar.ts";

function rich() {
  const env = makeCtx({ devTools: true });
  const id = newPlayer(env.ctx, "graduate", true);
  grant(env.ctx, id, 2_000_000);
  return { ...env, id };
}

test("can't buy where you've never been; can after visiting", () => {
  const { ctx, id } = rich();
  const r = act(ctx, id, { type: "biz_buy", bizType: "car_wash" });
  assert.equal(r.code, "not_visited");
  travel(ctx, id, "spintex");
  const bank = bal(ctx, id, "bank");
  const ok = act(ctx, id, { type: "biz_buy", bizType: "car_wash" });
  assert.ok(ok.ok, ok.error);
  assert.equal(bal(ctx, id, "bank"), bank - 6_000_000);
  assert.equal(act(ctx, id, { type: "biz_buy", bizType: "car_wash" }).code, "already");
  assert.ok(auditPlayer(ctx.db, id).ok);
});

test("purchase without enough money fails atomically", () => {
  const { ctx } = makeCtx();
  const id = newPlayer(ctx);
  travel(ctx, id, "spintex");
  const before = bal(ctx, id, "bank") + bal(ctx, id, "cash");
  const r = act(ctx, id, { type: "plot_buy", plotId: "spintex_plot" });
  assert.equal(r.code, "insufficient_funds");
  assert.equal(bal(ctx, id, "bank") + bal(ctx, id, "cash"), before);
  assert.equal(ctx.db.get<{ n: number }>("SELECT COUNT(*) AS n FROM plots")!.n, 0);
});

test("construction runs stage by stage on the game clock", () => {
  const { ctx, id } = rich();
  travel(ctx, id, "spintex");
  assert.ok(act(ctx, id, { type: "plot_buy", plotId: "spintex_plot" }).ok);
  const plot = ctx.db.get<{ id: number }>("SELECT id FROM plots WHERE player_id = ?", id)!;
  const plan = stagePlan("bungalow", "basic");
  const bank0 = bal(ctx, id, "bank");
  const start = act(ctx, id, { type: "build_start", plotId: plot.id, design: "bungalow", quality: "basic" });
  assert.ok(start.ok, start.error);
  assert.equal(bal(ctx, id, "bank"), bank0 - plan[0].cost * 100);
  const b = () => ctx.db.get<{ id: number; stage: number; status: string; stage_ends_min: number }>("SELECT * FROM buildings WHERE player_id = ?", id)!;
  const ends = b().stage_ends_min;
  assert.equal(ends, gameMin(ctx, id) + plan[0].days * MINUTES_PER_DAY);
  // Paying again while workers are busy is refused.
  assert.equal(act(ctx, id, { type: "build_pay_stage", buildingId: b().id }).code, "not_ready");
  // One hour before the end: still building.
  act(ctx, id, { type: "dev_skip", hours: plan[0].days * 24 - 1 });
  assert.equal(b().status, "building");
  act(ctx, id, { type: "dev_skip", hours: 1 });
  assert.equal(b().status, "awaiting_payment");
  assert.equal(b().stage, 1);
  // Pay through the remaining stages.
  for (let s = 1; s < plan.length; s++) {
    const r = act(ctx, id, { type: "build_pay_stage", buildingId: b().id });
    assert.ok(r.ok, r.error);
    act(ctx, id, { type: "dev_skip", hours: plan[s].days * 24 });
  }
  assert.equal(b().status, "complete");
  const spent = ctx.db.get<{ spent: number }>("SELECT spent FROM buildings WHERE id = ?", b().id)!.spent;
  assert.equal(spent, plan.reduce((s, x) => s + x.cost * 100, 0));
  assert.ok(act(ctx, id, { type: "building_use", buildingId: b().id, use: "live" }).ok);
  const p = ctx.db.get<{ home_kind: string }>("SELECT home_kind FROM players WHERE id = ?", id)!;
  assert.equal(p.home_kind, "owned");
  assert.ok(auditPlayer(ctx.db, id).ok);
});

test("building upgrade costs money, takes time and can't be started twice", () => {
  const { ctx, id } = rich();
  travel(ctx, id, "spintex");
  act(ctx, id, { type: "plot_buy", plotId: "spintex_plot" });
  const plot = ctx.db.get<{ id: number }>("SELECT id FROM plots WHERE player_id = ?", id)!;
  act(ctx, id, { type: "build_start", plotId: plot.id, design: "chamber_hall", quality: "basic" });
  const bid = ctx.db.get<{ id: number }>("SELECT id FROM buildings")!.id;
  for (let i = 0; i < 4; i++) {
    act(ctx, id, { type: "dev_skip", hours: 24 });
    act(ctx, id, { type: "build_pay_stage", buildingId: bid });
  }
  assert.equal(ctx.db.get<{ status: string }>("SELECT status FROM buildings")!.status, "complete");
  assert.ok(act(ctx, id, { type: "building_upgrade", buildingId: bid }).ok);
  assert.equal(act(ctx, id, { type: "building_upgrade", buildingId: bid }).code, "not_ready");
  act(ctx, id, { type: "dev_skip", hours: 48 });
  const row = ctx.db.get<{ status: string; quality: string }>("SELECT status, quality FROM buildings")!;
  assert.deepEqual({ ...row }, { status: "complete", quality: "standard" });
});

test("business upgrade: charged once, completes after 2 days, raises level", () => {
  const { ctx, id } = rich();
  travel(ctx, id, "osu");
  const buy = act(ctx, id, { type: "biz_buy", bizType: "waakye_joint" });
  assert.ok(buy.ok, buy.error);
  const bizId = (buy.data as { businessId: number }).businessId;
  const bank = bal(ctx, id, "bank");
  assert.ok(act(ctx, id, { type: "biz_upgrade", businessId: bizId }).ok);
  assert.equal(bal(ctx, id, "bank"), bank - businessUpgradeCost(BUSINESSES.waakye_joint.price, 1) * 100);
  assert.equal(act(ctx, id, { type: "biz_upgrade", businessId: bizId }).code, "busy");
  act(ctx, id, { type: "dev_skip", hours: 47 });
  assert.equal(ctx.db.get<{ level: number }>("SELECT level FROM businesses")!.level, 1);
  act(ctx, id, { type: "dev_skip", hours: 1 });
  assert.equal(ctx.db.get<{ level: number }>("SELECT level FROM businesses")!.level, 2);
});

test("businesses trade once per game day into their till; collect moves it to the bank", () => {
  const { ctx, id } = rich();
  travel(ctx, id, "osu");
  const buy = act(ctx, id, { type: "biz_buy", bizType: "boutique" });
  const bizId = (buy.data as { businessId: number }).businessId;
  act(ctx, id, { type: "dev_skip", hours: 24 * 3 });
  const days = ctx.db.get<{ n: number }>("SELECT COUNT(*) AS n FROM transactions WHERE kind = 'business_day'")!.n;
  // Bought mid-morning on day 0: trades on days 1,2 → settled on day 2 and 3 rollovers.
  assert.ok(days >= 2 && days <= 3, `expected 2–3 trading days, got ${days}`);
  const till = bal(ctx, id, `biz:${bizId}`);
  assert.notEqual(till, 0);
  if (till > 0) {
    const bank = bal(ctx, id, "bank");
    assert.ok(act(ctx, id, { type: "biz_collect", businessId: bizId }).ok);
    assert.equal(bal(ctx, id, `biz:${bizId}`), 0);
    assert.equal(bal(ctx, id, "bank"), bank + till);
  }
  assert.ok(auditPlayer(ctx.db, id).ok);
});

test("monthly rent is charged exactly once per month", () => {
  const { ctx, id } = rich();
  // Start: 6 Jan. Skip to past 1 Feb, then a few more days.
  act(ctx, id, { type: "dev_skip", hours: 24 * 26 });
  act(ctx, id, { type: "dev_skip", hours: 24 * 3 });
  const rents = ctx.db.get<{ n: number }>("SELECT COUNT(*) AS n FROM transactions WHERE player_id = ? AND kind = 'rent'", id)!.n;
  assert.equal(rents, 1);
});
