// Football predictions: fixture types, strict validation of match data and
// payout maths. Game currency only. The server is the only place odds,
// results and payouts are trusted from.

export type Selection = "home" | "draw" | "away";
export type FixtureStatus = "scheduled" | "live" | "finished" | "cancelled";

export interface Fixture {
  id: string;
  league: string;
  home: string;
  away: string;
  kickoff: string; // ISO-8601 UTC
  status: FixtureStatus;
  odds: Record<Selection, number>;
  score?: { home: number; away: number };
}

export interface BetView {
  id: number;
  fixtureId: string;
  selection: Selection;
  stakeMinor: number;
  odds: number;
  status: "pending" | "won" | "lost" | "void";
  payoutMinor: number;
  placedAt: string;
  settledAt?: string;
  fixture?: Pick<Fixture, "home" | "away" | "kickoff" | "status" | "score">;
}

export const MIN_STAKE_MINOR = 100; // GH₵1
export const MAX_STAKE_MINOR = 500_000; // GH₵5,000 per bet
export const MAX_OPEN_BETS = 20;

const ID_RE = /^[A-Za-z0-9_.:-]{1,64}$/;
const NAME_RE = /^[\p{L}\p{N} .'&()-]{2,48}$/u;

export type ValidationResult = { ok: true; fixture: Fixture } | { ok: false; error: string };

/** Validate one fixture from an untrusted match-data feed. Rejects anything odd. */
export function validateFixture(raw: unknown): ValidationResult {
  if (!raw || typeof raw !== "object") return { ok: false, error: "fixture is not an object" };
  const f = raw as Record<string, unknown>;
  if (typeof f.id !== "string" || !ID_RE.test(f.id)) return { ok: false, error: "bad id" };
  for (const k of ["league", "home", "away"] as const) {
    if (typeof f[k] !== "string" || !NAME_RE.test(f[k] as string)) return { ok: false, error: `bad ${k}` };
  }
  if (f.home === f.away) return { ok: false, error: "home and away are the same team" };
  if (typeof f.kickoff !== "string" || Number.isNaN(Date.parse(f.kickoff))) return { ok: false, error: "bad kickoff" };
  if (!["scheduled", "live", "finished", "cancelled"].includes(f.status as string)) return { ok: false, error: "bad status" };
  const odds = f.odds as Record<string, unknown> | undefined;
  if (!odds || typeof odds !== "object") return { ok: false, error: "missing odds" };
  for (const s of ["home", "draw", "away"]) {
    const o = odds[s];
    if (typeof o !== "number" || !Number.isFinite(o) || o < 1.01 || o > 100) return { ok: false, error: `bad odds.${s}` };
  }
  let score: Fixture["score"];
  if (f.status === "finished") {
    const sc = f.score as Record<string, unknown> | undefined;
    if (!sc || !Number.isInteger(sc.home) || !Number.isInteger(sc.away) || (sc.home as number) < 0 || (sc.away as number) < 0 || (sc.home as number) > 30 || (sc.away as number) > 30) {
      return { ok: false, error: "finished fixture without a valid score" };
    }
    score = { home: sc.home as number, away: sc.away as number };
  }
  return {
    ok: true,
    fixture: {
      id: f.id as string,
      league: f.league as string,
      home: f.home as string,
      away: f.away as string,
      kickoff: new Date(f.kickoff as string).toISOString(),
      status: f.status as FixtureStatus,
      odds: { home: round2(odds.home as number), draw: round2(odds.draw as number), away: round2(odds.away as number) },
      score,
    },
  };
}

/** Validate a whole feed. Any invalid fixture invalidates the feed — we don't trust partial garbage. */
export function validateFeed(raw: unknown): { ok: true; fixtures: Fixture[] } | { ok: false; error: string } {
  if (!Array.isArray(raw)) return { ok: false, error: "feed is not a list" };
  if (raw.length > 500) return { ok: false, error: "feed too large" };
  const out: Fixture[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    const v = validateFixture(item);
    if (!v.ok) return { ok: false, error: v.error };
    if (seen.has(v.fixture.id)) return { ok: false, error: `duplicate fixture ${v.fixture.id}` };
    seen.add(v.fixture.id);
    out.push(v.fixture);
  }
  return { ok: true, fixtures: out };
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export function outcomeOf(score: { home: number; away: number }): Selection {
  return score.home > score.away ? "home" : score.home < score.away ? "away" : "draw";
}

/** Payout in minor units, rounded down so the house never pays fractions. */
export function payoutFor(stakeMinor: number, odds: number): number {
  return Math.floor((stakeMinor * Math.round(odds * 100)) / 100);
}

export const LEAGUE_NAME = "Coastline Premier League";
export const CLUBS: { name: string; rating: number }[] = [
  { name: "Labadi Waves", rating: 78 },
  { name: "Osu Lions", rating: 80 },
  { name: "Kaneshie Market Stars", rating: 72 },
  { name: "Spintex Engineers", rating: 70 },
  { name: "Legon Royals", rating: 76 },
  { name: "Tema Harbour", rating: 74 },
  { name: "Kumasi Gold", rating: 82 },
  { name: "Cape Coast Pirates", rating: 69 },
  { name: "Volta Rapids", rating: 71 },
  { name: "Tamale Savannah", rating: 73 },
];
