import test from "node:test";
import assert from "node:assert/strict";
import { bal, key, makeCtx, newPlayer } from "./helpers.ts";
import { placeBet, refreshFixtures, settleBets, marketsOpen, createMockProvider, type MatchDataProvider } from "../server/football.ts";
import { auditPlayer } from "../server/ledger.ts";
import { validateFeed, payoutFor } from "../shared/football.ts";

const T0 = Date.UTC(2026, 9, 11, 12, 0, 0);

function fixture(over: Record<string, unknown> = {}) {
  return {
    id: "m1", league: "Coastline Premier League", home: "Osu Lions", away: "Labadi Waves",
    kickoff: new Date(T0 + 10 * 60_000).toISOString(), status: "scheduled",
    odds: { home: 2.1, draw: 3.2, away: 3.5 }, ...over,
  };
}

function feed(get: () => unknown): MatchDataProvider {
  return { name: "test", fetchFixtures: async () => { const v = get(); if (v instanceof Error) throw v; return v; } };
}

async function setup() {
  const env = makeCtx();
  const id = newPlayer(env.ctx, "hustler"); // GH₵1,500 cash
  let current: unknown = [fixture()];
  const provider = feed(() => current);
  await refreshFixtures(env.ctx, provider);
  return { ...env, id, provider, setFeed: (v: unknown) => (current = v) };
}

test("bet uses server odds and debits cash; client cannot set odds", async () => {
  const { ctx, id } = await setup();
  const r = placeBet(ctx, id, key(), { fixtureId: "m1", selection: "home", stake: 10_000, odds: 99 } as never);
  const bet = ctx.db.get<{ odds: number; stake: number }>("SELECT * FROM bets WHERE id = ?", r.betId)!;
  assert.equal(bet.odds, 2.1);
  assert.equal(bal(ctx, id, "cash"), 150_000 - 10_000);
});

test("market closes at kickoff", async () => {
  const { ctx, clock, id, provider } = await setup();
  clock.now = T0 + 10 * 60_000; // exactly kickoff
  await refreshFixtures(ctx, provider);
  assert.throws(() => placeBet(ctx, id, key(), { fixtureId: "m1", selection: "home", stake: 1000 }), /closed at kickoff/);
  clock.now = T0 + 10 * 60_000 - 1;
  assert.doesNotThrow(() => placeBet(ctx, id, key(), { fixtureId: "m1", selection: "home", stake: 1000 }));
});

test("stake validation: bounds, integers and available cash", async () => {
  const { ctx, id } = await setup();
  for (const stake of [0, 50, 12.5, -100, 600_000, "100"]) {
    assert.throws(() => placeBet(ctx, id, key(), { fixtureId: "m1", selection: "home", stake }), undefined, `stake ${stake}`);
  }
  assert.throws(() => placeBet(ctx, id, key(), { fixtureId: "m1", selection: "both", stake: 1000 }));
  // More than you hold in cash:
  assert.throws(() => placeBet(ctx, id, key(), { fixtureId: "m1", selection: "home", stake: 200_000 }), /Not enough/);
});

test("same idempotency key places the bet once", async () => {
  const { ctx, id } = await setup();
  const k = key();
  placeBet(ctx, id, k, { fixtureId: "m1", selection: "draw", stake: 5_000 });
  const again = placeBet(ctx, id, k, { fixtureId: "m1", selection: "draw", stake: 5_000 });
  assert.equal((again as { replay?: boolean }).replay, true);
  assert.equal(ctx.db.get<{ n: number }>("SELECT COUNT(*) AS n FROM bets")!.n, 1);
  assert.equal(bal(ctx, id, "cash"), 150_000 - 5_000);
});

test("settlement pays winners exactly once, even if run repeatedly", async () => {
  const { ctx, clock, id, provider, setFeed } = await setup();
  placeBet(ctx, id, key(), { fixtureId: "m1", selection: "home", stake: 10_000 });
  placeBet(ctx, id, key(), { fixtureId: "m1", selection: "away", stake: 10_000 });
  clock.now = T0 + 20 * 60_000;
  setFeed([fixture({ status: "finished", score: { home: 2, away: 1 } })]);
  await refreshFixtures(ctx, provider);
  const cashBefore = bal(ctx, id, "cash");
  assert.equal(settleBets(ctx).settled, 2);
  assert.equal(settleBets(ctx).settled, 0);
  assert.equal(settleBets(ctx).settled, 0);
  assert.equal(bal(ctx, id, "cash"), cashBefore + payoutFor(10_000, 2.1));
  const statuses = ctx.db.all<{ status: string }>("SELECT status FROM bets ORDER BY id").map((b) => b.status);
  assert.deepEqual(statuses, ["won", "lost"]);
  assert.equal(ctx.db.get<{ n: number }>("SELECT COUNT(*) AS n FROM transactions WHERE kind = 'bet_payout'")!.n, 1);
  assert.ok(auditPlayer(ctx.db, id).ok);
});

test("a feed that later rewrites a final score is ignored", async () => {
  const { ctx, clock, id, provider, setFeed } = await setup();
  placeBet(ctx, id, key(), { fixtureId: "m1", selection: "home", stake: 10_000 });
  clock.now = T0 + 20 * 60_000;
  setFeed([fixture({ status: "finished", score: { home: 0, away: 1 } })]);
  await refreshFixtures(ctx, provider);
  setFeed([fixture({ status: "finished", score: { home: 3, away: 0 } })]);
  await refreshFixtures(ctx, provider);
  settleBets(ctx);
  assert.equal(ctx.db.get<{ status: string }>("SELECT status FROM bets")!.status, "lost");
});

test("invalid match data pauses betting and settlement, and pending bets are preserved", async () => {
  const { ctx, clock, id, provider, setFeed } = await setup();
  placeBet(ctx, id, key(), { fixtureId: "m1", selection: "home", stake: 10_000 });
  clock.now = T0 + 20 * 60_000;
  // Garbage: negative odds and a finished match with no score.
  setFeed([fixture({ status: "finished", odds: { home: -1, draw: 3, away: 3 } })]);
  await refreshFixtures(ctx, provider);
  assert.equal(marketsOpen(ctx.db, clock.now), false);
  assert.deepEqual(settleBets(ctx), { settled: 0, paused: true });
  assert.equal(ctx.db.get<{ status: string }>("SELECT status FROM bets")!.status, "pending");
  assert.throws(() => placeBet(ctx, id, key(), { fixtureId: "m1", selection: "home", stake: 1000 }), /paused/);
  // Provider down entirely.
  setFeed(new Error("timeout"));
  await refreshFixtures(ctx, provider);
  assert.equal(marketsOpen(ctx.db, clock.now), false);
  // Recovery with a valid final result settles the preserved bet.
  setFeed([fixture({ status: "finished", score: { home: 1, away: 0 } })]);
  await refreshFixtures(ctx, provider);
  assert.equal(settleBets(ctx).settled, 1);
  assert.equal(ctx.db.get<{ status: string }>("SELECT status FROM bets")!.status, "won");
});

test("stale feed pauses markets even without an explicit error", async () => {
  const { ctx, clock } = await setup();
  assert.equal(marketsOpen(ctx.db, clock.now), true);
  clock.now += 4 * 60_000;
  assert.equal(marketsOpen(ctx.db, clock.now), false);
});

test("cancelled matches refund the stake once", async () => {
  const { ctx, clock, id, provider, setFeed } = await setup();
  placeBet(ctx, id, key(), { fixtureId: "m1", selection: "home", stake: 10_000 });
  const after = bal(ctx, id, "cash");
  clock.now = T0 + 20 * 60_000;
  setFeed([fixture({ status: "cancelled" })]);
  await refreshFixtures(ctx, provider);
  settleBets(ctx);
  settleBets(ctx);
  assert.equal(bal(ctx, id, "cash"), after + 10_000);
});

test("feed validation rejects malformed fixtures", () => {
  assert.equal(validateFeed("nope").ok, false);
  assert.equal(validateFeed([fixture({ home: "Osu Lions", away: "Osu Lions" })]).ok, false);
  assert.equal(validateFeed([fixture({ kickoff: "tomorrow-ish" })]).ok, false);
  assert.equal(validateFeed([fixture({ status: "finished", score: { home: 1.5, away: 0 } })]).ok, false);
  assert.equal(validateFeed([fixture(), fixture()]).ok, false, "duplicate ids");
  assert.equal(validateFeed([fixture({ home: "<script>" })]).ok, false);
  assert.equal(validateFeed([fixture()]).ok, true);
});

test("mock provider produces a valid feed in every phase", async () => {
  const p = createMockProvider();
  for (const offset of [0, 3 * 60_000, 30 * 60_000]) {
    const v = validateFeed(await p.fetchFixtures(T0 + offset));
    assert.ok(v.ok, v.ok ? "" : v.error);
  }
  const bad = createMockProvider(() => "invalid");
  assert.equal(validateFeed(await bad.fetchFixtures(T0)).ok, false);
});
