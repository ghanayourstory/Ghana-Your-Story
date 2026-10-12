// Oware (Abapa rules), played on a board of 12 pits with 48 seeds. You own
// pits 0–5, your opponent 6–11; seeds are sown counter-clockwise (rising
// index), skipping the pit you started from when you lap the board. If your
// last seed lands in the opponent's row and makes 2 or 3, you capture it and
// any unbroken run of 2s and 3s before it in their row. You may not capture
// every seed they have (grand slam: no capture), and if they have no seeds
// you must give them some. First to 25 wins; 24–24 is a draw.
// Everything here is deterministic, so the server can replay and check it.

export interface OwareGame {
  pits: number[];
  store: [number, number];
  /** Whose turn: 0 = you, 1 = the opponent. */
  turn: 0 | 1;
  over: boolean;
  winner: 0 | 1 | null;
  moves: number;
  /** Last move by each side, for the board's highlight. */
  last: [number | null, number | null];
}

export const newOware = (): OwareGame => ({ pits: Array(12).fill(4), store: [0, 0], turn: 0, over: false, winner: null, moves: 0, last: [null, null] });

const own = (side: 0 | 1, i: number) => (side === 0 ? i >= 0 && i <= 5 : i >= 6 && i <= 11);
const seedsOf = (g: OwareGame, side: 0 | 1) => g.pits.reduce((n, v, i) => n + (own(side, i) ? v : 0), 0);

/** Sow from a pit and capture; returns the new game (no rule checks). */
function sow(g: OwareGame, pit: number): { next: OwareGame; captured: number } {
  const side = g.turn;
  const pits = [...g.pits];
  let seeds = pits[pit];
  pits[pit] = 0;
  let i = pit;
  while (seeds > 0) {
    i = (i + 1) % 12;
    if (i === pit) continue;
    pits[i]++;
    seeds--;
  }
  let captured = 0;
  const opp = (1 - side) as 0 | 1;
  if (own(opp, i)) {
    const trial = [...pits];
    let j = i;
    let take = 0;
    while (own(opp, j) && (trial[j] === 2 || trial[j] === 3)) {
      take += trial[j];
      trial[j] = 0;
      j--;
    }
    // Grand slam: taking everything they have isn't allowed, so nothing is taken.
    const left = trial.reduce((n, v, k) => n + (own(opp, k) ? v : 0), 0);
    if (take > 0 && left > 0) {
      captured = take;
      for (let k = 0; k < 12; k++) pits[k] = trial[k];
    }
  }
  const store: [number, number] = [...g.store];
  store[side] += captured;
  const last: [number | null, number | null] = [...g.last];
  last[side] = pit;
  return { next: { ...g, pits, store, turn: opp, moves: g.moves + 1, last }, captured };
}

/** Legal pits for whoever's turn it is (must feed an empty opponent if possible). */
export function legalMoves(g: OwareGame): number[] {
  if (g.over) return [];
  const side = g.turn;
  const mine = Array.from({ length: 6 }, (_, k) => k + (side === 0 ? 0 : 6)).filter((i) => g.pits[i] > 0);
  const opp = (1 - side) as 0 | 1;
  if (seedsOf(g, opp) > 0) return mine;
  return mine.filter((i) => seedsOf(sow(g, i).next, opp) > 0);
}

function finish(g: OwareGame): OwareGame {
  const out = { ...g, pits: [...g.pits], store: [...g.store] as [number, number] };
  if (out.store[0] >= 25 || out.store[1] >= 25 || (out.store[0] === 24 && out.store[1] === 24)) {
    out.over = true;
  } else if (legalMoves(out).length === 0) {
    // Nobody can feed: each side keeps what's on its own row.
    out.store[0] += seedsOf(out, 0);
    out.store[1] += seedsOf(out, 1);
    out.pits = Array(12).fill(0);
    out.over = true;
  } else if (out.moves >= 400) {
    out.over = true; // an endless shuffle: count what's left on the board
    out.store[0] += seedsOf(out, 0);
    out.store[1] += seedsOf(out, 1);
    out.pits = Array(12).fill(0);
  }
  if (out.over) out.winner = out.store[0] > out.store[1] ? 0 : out.store[1] > out.store[0] ? 1 : null;
  return out;
}

/** Play one move; throws on an illegal one. */
export function playMove(g: OwareGame, pit: number): { game: OwareGame; captured: number } {
  if (!legalMoves(g).includes(pit)) throw new Error("illegal");
  const { next, captured } = sow(g, pit);
  return { game: finish(next), captured };
}

/** The opponent: looks two moves ahead (its capture minus your best reply), with a little personality. */
export function aiMove(g: OwareGame, strength: number, seed: number): number {
  const moves = legalMoves(g);
  let best = moves[0];
  let bestScore = -Infinity;
  for (const m of moves) {
    const { game, captured } = playMove(g, m);
    let reply = 0;
    if (!game.over && strength > 0.3) for (const r of legalMoves(game)) reply = Math.max(reply, playMove(game, r).captured);
    const noise = ((Math.sin(seed * 9301 + m * 49297) + 1) / 2) * (1 - strength) * 3;
    const score = captured - reply * strength + (game.over && game.winner === 1 ? 50 : 0) + noise;
    if (score > bestScore) { bestScore = score; best = m; }
  }
  return best;
}
