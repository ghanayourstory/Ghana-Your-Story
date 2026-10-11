// Football predictions. The server pulls fixtures from a match-data provider,
// validates them strictly, and is the only party that decides odds, market
// closing and payouts. Game currency (cash) only.
import { tx, type Db } from "./db.ts";
import { balance, GameError, post } from "./ledger.ts";
import { loadPlayer, type Ctx } from "./engine.ts";
import {
  CLUBS, LEAGUE_NAME, MAX_OPEN_BETS, MAX_STAKE_MINOR, MIN_STAKE_MINOR, outcomeOf, payoutFor, validateFeed,
  type BetView, type Fixture, type Selection,
} from "../shared/football.ts";
import { hash32, mulberry32 } from "../shared/rng.ts";
import { formatMoney } from "../shared/money.ts";

export interface MatchDataProvider {
  name: string;
  fetchFixtures(nowMs: number): Promise<unknown>;
}

/** Fixtures older than this without a fresh, valid feed mean we pause. */
export const FEED_STALE_MS = 3 * 60_000;

// ---------------------------------------------------------------------------
// Mock provider: a fictional league with a match slot every 6 real minutes.

export const SLOT_MS = 6 * 60_000;
export const MATCH_MS = 4 * 60_000;

function slotFixtures(slot: number, nowMs: number): Fixture[] {
  const rnd = mulberry32(hash32(`slot:${slot}`));
  const order = CLUBS.map((c) => ({ c, r: rnd() })).sort((a, b) => a.r - b.r).map((x) => x.c);
  const kickoffMs = slot * SLOT_MS;
  const out: Fixture[] = [];
  for (let i = 0; i < 2; i++) {
    const home = order[i * 2];
    const away = order[i * 2 + 1];
    const diff = (home.rating + 4 - away.rating) / 12;
    const pHome = (1 / (1 + Math.exp(-diff))) * 0.74;
    const pDraw = 0.26;
    const pAway = Math.max(0.05, 1 - pHome - pDraw);
    const margin = 1.07;
    const o = (p: number) => Math.min(30, Math.max(1.05, Math.round((1 / (p * margin)) * 100) / 100));
    const status = nowMs < kickoffMs ? "scheduled" : nowMs < kickoffMs + MATCH_MS ? "live" : "finished";
    const fx: Fixture = {
      id: `cpl-${slot}-${i}`,
      league: LEAGUE_NAME,
      home: home.name,
      away: away.name,
      kickoff: new Date(kickoffMs).toISOString(),
      status,
      odds: { home: o(pHome), draw: o(pDraw), away: o(pAway) },
    };
    if (status === "finished") {
      const g = (lambda: number) => {
        let k = 0, p = Math.exp(-lambda), s = p;
        const u = rnd();
        while (u > s && k < 9) { k++; p *= lambda / k; s += p; }
        return k;
      };
      fx.score = { home: g(1.2 + diff * 0.5), away: g(Math.max(0.3, 1.0 - diff * 0.5)) };
    }
    out.push(fx);
  }
  return out;
}

export type MockMode = "ok" | "down" | "invalid";

export function createMockProvider(mode: () => MockMode = () => "ok"): MatchDataProvider {
  return {
    name: "mock",
    async fetchFixtures(nowMs: number) {
      const m = mode();
      if (m === "down") throw new Error("Mock feed is down");
      const cur = Math.floor(nowMs / SLOT_MS);
      const fixtures: Fixture[] = [];
      for (let s = cur - 4; s <= cur + 6; s++) fixtures.push(...slotFixtures(s, nowMs));
      if (m === "invalid") return fixtures.map((f, i) => (i === 0 ? { ...f, odds: { home: -3, draw: "x", away: 2 } } : f));
      return fixtures;
    },
  };
}

/**
 * A licensed HTTP provider. It must return the same JSON shape as the mock
 * (see shared/football.ts Fixture). The key stays on the server.
 */
export function createHttpProvider(url: string, apiKey: string): MatchDataProvider {
  return {
    name: "http",
    async fetchFixtures() {
      const res = await fetch(url, { headers: { authorization: `Bearer ${apiKey}`, accept: "application/json" }, signal: AbortSignal.timeout(8000) });
      if (!res.ok) throw new Error(`Match data HTTP ${res.status}`);
      return res.json();
    },
  };
}

// ---------------------------------------------------------------------------
// Feed refresh and provider health

export interface ProviderState {
  status: "ok" | "degraded" | "unknown";
  message: string;
  checked_ms: number;
  last_ok_ms: number;
}

export function providerState(db: Db): ProviderState {
  return db.get<ProviderState>("SELECT status, message, checked_ms, last_ok_ms FROM provider_state WHERE id = 1")!;
}

/** Healthy means the last check succeeded and is recent. */
export function marketsOpen(db: Db, nowMs: number): boolean {
  const s = providerState(db);
  return s.status === "ok" && nowMs - s.last_ok_ms < FEED_STALE_MS;
}

export async function refreshFixtures(ctx: Ctx, provider: MatchDataProvider): Promise<ProviderState> {
  const now = ctx.now();
  let raw: unknown;
  try {
    raw = await provider.fetchFixtures(now);
  } catch (err) {
    ctx.db.run("UPDATE provider_state SET status='degraded', message=?, checked_ms=? WHERE id=1", `Match data unavailable: ${(err as Error).message}`, now);
    return providerState(ctx.db);
  }
  const v = validateFeed(raw);
  if (!v.ok) {
    ctx.db.run("UPDATE provider_state SET status='degraded', message=?, checked_ms=? WHERE id=1", `Match data rejected: ${v.error}`, now);
    return providerState(ctx.db);
  }
  tx(ctx.db, () => {
    for (const f of v.fixtures) {
      const existing = ctx.db.get<{ data: string; status: string }>("SELECT data, status FROM fixtures WHERE id = ?", f.id);
      if (existing) {
        const old = JSON.parse(existing.data) as Fixture;
        // A finished result is final. A feed that later changes it is suspicious; keep the first.
        if (old.status === "finished" && (f.status !== "finished" || f.score?.home !== old.score?.home || f.score?.away !== old.score?.away)) continue;
        // Odds are frozen at kickoff: pending bets already locked theirs anyway.
        const merged = Date.parse(f.kickoff) <= now ? { ...f, odds: old.odds } : f;
        ctx.db.run("UPDATE fixtures SET data=?, status=?, kickoff_ms=?, fetched_ms=? WHERE id=?", JSON.stringify(merged), merged.status, Date.parse(merged.kickoff), now, f.id);
      } else {
        ctx.db.run("INSERT INTO fixtures (id, data, status, kickoff_ms, fetched_ms) VALUES (?, ?, ?, ?, ?)", f.id, JSON.stringify(f), f.status, Date.parse(f.kickoff), now);
      }
    }
    ctx.db.run("DELETE FROM fixtures WHERE kickoff_ms < ? AND id NOT IN (SELECT fixture_id FROM bets WHERE status = 'pending')", now - 6 * 3600_000);
    ctx.db.run("UPDATE provider_state SET status='ok', message='Live', checked_ms=?, last_ok_ms=? WHERE id=1", now, now);
  });
  return providerState(ctx.db);
}

// ---------------------------------------------------------------------------
// Bets

function getFixture(db: Db, id: string): Fixture | null {
  const r = db.get<{ data: string }>("SELECT data FROM fixtures WHERE id = ?", id);
  return r ? (JSON.parse(r.data) as Fixture) : null;
}

/**
 * Place a bet. The client sends only fixture, selection, stake and an
 * idempotency key; odds come from the server's stored snapshot.
 */
export function placeBet(ctx: Ctx, playerId: number, idemKey: string, input: { fixtureId: unknown; selection: unknown; stake: unknown }) {
  if (typeof idemKey !== "string" || !/^[A-Za-z0-9_-]{8,80}$/.test(idemKey)) throw new GameError("bad_idempotency_key", "Missing idempotency key");
  return tx(ctx.db, () => {
    const seen = ctx.db.get<{ response: string }>("SELECT response FROM idempotency WHERE player_id = ? AND key = ?", playerId, idemKey);
    if (seen) return { ...(JSON.parse(seen.response) as { betId: number; message: string }), replay: true };
    const now = ctx.now();
    if (!marketsOpen(ctx.db, now)) throw new GameError("markets_paused", "Betting is paused: match data is unavailable. Pending bets are safe.");
    const fixtureId = typeof input.fixtureId === "string" ? input.fixtureId : "";
    const f = getFixture(ctx.db, fixtureId);
    if (!f) throw new GameError("no_fixture", "Unknown fixture");
    if (f.status !== "scheduled" || Date.parse(f.kickoff) <= now) throw new GameError("market_closed", "This market closed at kickoff");
    const selection = input.selection as Selection;
    if (!["home", "draw", "away"].includes(selection)) throw new GameError("bad_selection", "Pick home, draw or away");
    const stake = input.stake;
    if (typeof stake !== "number" || !Number.isSafeInteger(stake) || stake < MIN_STAKE_MINOR || stake > MAX_STAKE_MINOR) {
      throw new GameError("bad_stake", `Stake must be between ${formatMoney(MIN_STAKE_MINOR)} and ${formatMoney(MAX_STAKE_MINOR)}`);
    }
    const open = ctx.db.get<{ n: number }>("SELECT COUNT(*) AS n FROM bets WHERE player_id = ? AND status = 'pending'", playerId)!.n;
    if (open >= MAX_OPEN_BETS) throw new GameError("too_many", "Too many open predictions");
    const p = loadPlayer(ctx.db, playerId);
    const odds = f.odds[selection];
    const r = ctx.db.run("INSERT INTO bets (player_id, fixture_id, selection, stake, odds, placed_ms) VALUES (?, ?, ?, ?, ?, ?)", playerId, f.id, selection, stake, odds, now);
    const betId = r.lastInsertRowid;
    post(ctx.db, playerId, [{ account: "cash", amount: -stake }], { kind: "bet_stake", memo: `Prediction #${betId}: ${f.home} v ${f.away} (${selection}) @ ${odds}`, gameMin: p.game_min, nowMs: now, idemKey: `bet-stake:${betId}` });
    const result = { betId, message: `Prediction placed: ${formatMoney(stake)} on ${selection === "draw" ? "a draw" : selection === "home" ? f.home : f.away} at ${odds.toFixed(2)}` };
    ctx.db.run("INSERT INTO idempotency (player_id, key, response, created_ms) VALUES (?, ?, ?, ?)", playerId, idemKey, JSON.stringify(result), now);
    return result;
  });
}

/**
 * Settle every pending bet whose fixture has a validated final result. Each
 * bet settles at most once: the status flip is guarded and the payout uses a
 * unique ledger key. Paused entirely while the feed is unhealthy.
 */
export function settleBets(ctx: Ctx): { settled: number; paused: boolean } {
  const now = ctx.now();
  if (!marketsOpen(ctx.db, now)) return { settled: 0, paused: true };
  let settled = 0;
  const pending = ctx.db.all<{ id: number; player_id: number; fixture_id: string; selection: Selection; stake: number; odds: number }>(
    "SELECT * FROM bets WHERE status = 'pending' ORDER BY id",
  );
  for (const b of pending) {
    const f = getFixture(ctx.db, b.fixture_id);
    if (!f || (f.status !== "finished" && f.status !== "cancelled")) continue;
    if (f.status === "finished" && !f.score) continue;
    tx(ctx.db, () => {
      const p = loadPlayer(ctx.db, b.player_id);
      let status: "won" | "lost" | "void";
      let payout = 0;
      if (f.status === "cancelled") {
        status = "void";
        payout = b.stake;
      } else if (outcomeOf(f.score!) === b.selection) {
        status = "won";
        payout = payoutFor(b.stake, b.odds);
      } else {
        status = "lost";
      }
      const upd = ctx.db.run("UPDATE bets SET status = ?, payout = ?, settled_ms = ? WHERE id = ? AND status = 'pending'", status, payout, now, b.id);
      if (upd.changes !== 1) return; // someone else settled it
      if (payout > 0) {
        const posted = post(ctx.db, b.player_id, [{ account: "cash", amount: payout }], {
          kind: status === "void" ? "bet_refund" : "bet_payout", memo: `Prediction #${b.id} ${status}: ${f.home} ${f.score?.home ?? ""}–${f.score?.away ?? ""} ${f.away}`,
          gameMin: p.game_min, nowMs: now, idemKey: `bet-settle:${b.id}`,
        });
        if (posted === null) throw new GameError("double_settle", `Bet ${b.id} payout already posted`);
      }
      if (status === "won") ctx.db.run("UPDATE players SET bets_won = bets_won + 1 WHERE id = ?", b.player_id);
      ctx.db.run("INSERT INTO log (player_id, game_min, kind, text, changes) VALUES (?, ?, 'football', ?, ?)", b.player_id, p.game_min,
        status === "won" ? `⚽ Prediction won! ${f.home} ${f.score!.home}–${f.score!.away} ${f.away}. Paid ${formatMoney(payout)}.` : status === "void" ? `⚽ ${f.home} v ${f.away} was cancelled. Stake refunded.` : `⚽ Prediction lost: ${f.home} ${f.score!.home}–${f.score!.away} ${f.away}.`,
        JSON.stringify(payout ? [{ k: "cash", d: payout }] : []));
      settled++;
    });
  }
  return { settled, paused: false };
}

export function footballView(ctx: Ctx, playerId: number, ebosTips: boolean) {
  const now = ctx.now();
  const fixtures = ctx.db.all<{ data: string }>("SELECT data FROM fixtures WHERE kickoff_ms > ? ORDER BY kickoff_ms LIMIT 30", now - 2 * 3600_000).map((r) => JSON.parse(r.data) as Fixture);
  const bets: BetView[] = ctx.db.all<{ id: number; fixture_id: string; selection: Selection; stake: number; odds: number; status: BetView["status"]; payout: number; placed_ms: number; settled_ms: number | null }>(
    "SELECT * FROM bets WHERE player_id = ? ORDER BY id DESC LIMIT 30", playerId,
  ).map((b) => {
    const f = getFixture(ctx.db, b.fixture_id);
    return {
      id: b.id, fixtureId: b.fixture_id, selection: b.selection, stakeMinor: b.stake, odds: b.odds, status: b.status, payoutMinor: b.payout,
      placedAt: new Date(b.placed_ms).toISOString(), settledAt: b.settled_ms ? new Date(b.settled_ms).toISOString() : undefined,
      fixture: f ? { home: f.home, away: f.away, kickoff: f.kickoff, status: f.status, score: f.score } : undefined,
    };
  });
  const s = providerState(ctx.db);
  const tips = ebosTips
    ? Object.fromEntries(fixtures.filter((f) => f.status === "scheduled").map((f) => {
        const best = (["home", "draw", "away"] as Selection[]).sort((a, b) => f.odds[a] - f.odds[b])[0];
        return [f.id, best];
      }))
    : {};
  return {
    serverNow: now,
    provider: { status: s.status, message: s.message, open: marketsOpen(ctx.db, now), lastOk: s.last_ok_ms },
    fixtures,
    bets,
    cash: balance(ctx.db, playerId, "cash"),
    limits: { min: MIN_STAKE_MINOR, max: MAX_STAKE_MINOR },
    tips,
  };
}
