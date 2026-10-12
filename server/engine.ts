// The authoritative game engine. Every state change happens here, inside a
// single SQL transaction per action, with money moving only through the ledger.
import { DAILY_BONUS, DAILY_GOALS, pickDaily, swapCandidate, type DailyContext, type DailyState } from "../shared/daily.ts";
import { moodOf } from "../shared/mood.ts";
import { tx, type Db } from "./db.ts";
import { balance, ensureAccount, GameError, post, recentLedger, type Leg } from "./ledger.ts";
import {
  AKWASIDAE_OFFSET, dayOf, daysToAkwasidae, monthIndex, MINUTES_PER_DAY, START_MINUTE, TIME_SCALE, toGameDate, weatherAt,
} from "../shared/calendar.ts";
import { rand01 } from "../shared/rng.ts";
import {
  DISTRICTS, JOBS, MAX_RANK, PLACE_BY_ID, RANK_TITLES, SERVICES, SHIFTS_PER_RANK, TRAVEL_MODES,
  districtsIn, isOpenAt, priceFor, rankPay, travelQuote,
  type DistrictId, type EffectKey, type Effects, type TravelMode,
} from "../shared/world.ts";
import { NPC_BY_ID, NPCS, lineFor, npcLocation, tierFor, type Topic } from "../shared/people.ts";
import {
  BUSINESSES, BUSINESS_UPGRADE_DAYS, DESIGNS, LOAN_MIN_REPAYMENT, LOAN_RATE, MAX_BUSINESS_LEVEL, NEGLECT_DAYS,
  PHONE_DATA_MONTHLY, PLOTS, QUALITY, QUALITY_ORDER, RENTALS, SALARY_DAY, SAVINGS_RATE, STARTER_HOME, TBILLS,
  USD_RATE, VEHICLES, VEHICLE_DEPRECIATION_PER_MONTH, businessUpgradeCost, businessValue, builtValue,
  demandNoise, fxBuy, fxMid, fxSell, levelCosts, levelRevenue, loanLimit, stagePlan, upgradeCost,
  type Quality,
} from "../shared/economy.ts";
import { TOWN_BY_ID } from "../shared/ghana.ts";
import { HOME_ACTIVITIES, HOME_SPECS, tierForHome } from "../shared/homes.ts";
import { CITIES, INTERCITY_MODES, intercityQuote, type IntercityMode } from "../shared/cities.ts";
import {
  COURSES, CROPS, DEALER_STOCK, FARMLANDS, FARM_HARVEST_WINDOW_DAYS, ITEMS, POST_TYPES, furnishingScore, influencerDaily, stockFor,
} from "../shared/life.ts";
import { GOALS, LIFE_EVENTS, type ProgressSnapshot } from "../shared/progress.ts";
import { formatMoney } from "../shared/money.ts";

export interface EngineConfig {
  devTools: boolean;
  /** Single-player offline build: the only player is the tester. */
  everyoneIsTester?: boolean;
}

export interface Ctx {
  db: Db;
  now: () => number; // real wall-clock ms
  config: EngineConfig;
}

export interface PlayerRow {
  id: number;
  name: string;
  look: string;
  background: string;
  game_min: number;
  last_sync_ms: number;
  district: DistrictId;
  pos_x: number;
  pos_z: number;
  energy: number;
  hunger: number;
  health: number;
  social: number;
  fun: number;
  hygiene: number;
  bladder: number;
  daily: string;
  needs_pace: number;
  reputation: number;
  work: number;
  fitness: number;
  charisma: number;
  business: number;
  home_kind: "rental" | "owned";
  home_ref: string;
  job_id: string | null;
  job_rank: number;
  job_shifts: number;
  shifts_total: number;
  payroll_accrued: number;
  last_day_processed: number;
  last_month_billed: number;
  rent_arrears: number;
  rent_credit: number;
  credit_score: number;
  tbills_bought: number;
  bets_won: number;
  unlocks: string;
  visited: string;
  discovered: string;
  is_test: number;
}

export interface Change {
  k: string;
  d: number;
}
export interface FeedbackItem {
  text: string;
  changes: Change[];
  tone?: "good" | "bad" | "info" | "goal";
}

export class Feedback {
  items: FeedbackItem[] = [];
  add(text: string, changes: Change[] = [], tone: FeedbackItem["tone"] = "info") {
    this.items.push({ text, changes: changes.filter((c) => c.d !== 0), tone });
  }
}

const STAT_KEYS = ["energy", "hunger", "health", "social", "fun", "hygiene", "bladder"] as const;
const SKILL_KEYS = ["work", "fitness", "charisma", "business"] as const;
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const round1 = (n: number) => Math.round(n * 10) / 10;
export const minor = (cedis: number) => Math.round(cedis * 100);

// ---------------------------------------------------------------------------
// Player load / save

export function loadPlayer(db: Db, id: number): PlayerRow {
  const p = db.get<PlayerRow>("SELECT * FROM players WHERE id = ?", id);
  if (!p) throw new GameError("no_player", "Player not found");
  return p;
}

function savePlayer(db: Db, p: PlayerRow) {
  db.run(
    `UPDATE players SET game_min=?, last_sync_ms=?, district=?, pos_x=?, pos_z=?, energy=?, hunger=?, health=?, social=?, fun=?, hygiene=?, bladder=?, daily=?, needs_pace=?,
       reputation=?, work=?, fitness=?, charisma=?, business=?, home_kind=?, home_ref=?, job_id=?, job_rank=?, job_shifts=?,
       shifts_total=?, payroll_accrued=?, last_day_processed=?, last_month_billed=?, rent_arrears=?, rent_credit=?, credit_score=?,
       tbills_bought=?, bets_won=?, unlocks=?, visited=?, discovered=? WHERE id=?`,
    p.game_min, p.last_sync_ms, p.district, p.pos_x, p.pos_z, p.energy, p.hunger, p.health, p.social, p.fun, p.hygiene, p.bladder, p.daily, p.needs_pace,
    p.reputation, p.work, p.fitness, p.charisma, p.business, p.home_kind, p.home_ref, p.job_id, p.job_rank, p.job_shifts,
    p.shifts_total, p.payroll_accrued, p.last_day_processed, p.last_month_billed, p.rent_arrears, p.rent_credit, p.credit_score,
    p.tbills_bought, p.bets_won, p.unlocks, p.visited, p.discovered, p.id,
  );
}

const list = (json: string): string[] => JSON.parse(json) as string[];
const hasUnlock = (p: PlayerRow, u: string) => list(p.unlocks).includes(u);
function addToList(p: PlayerRow, field: "unlocks" | "visited" | "discovered", v: string): boolean {
  const l = list(p[field]);
  if (l.includes(v)) return false;
  l.push(v);
  p[field] = JSON.stringify(l);
  return true;
}

// ---------------------------------------------------------------------------
// Character creation

export const BACKGROUNDS = {
  graduate: { label: "Fresh graduate", cash: 600, bank: 2500, usd: 0, skills: { work: 15, charisma: 5, fitness: 5, business: 5 }, rep: 0, blurb: "A degree, a CV and big plans." },
  hustler: { label: "Street hustler", cash: 1500, bank: 400, usd: 0, skills: { work: 6, charisma: 14, fitness: 12, business: 8 }, rep: 3, blurb: "You know every shortcut in Kaneshie." },
  returnee: { label: "Returnee", cash: 400, bank: 800, usd: 450, skills: { work: 12, charisma: 8, fitness: 6, business: 10 }, rep: -3, blurb: "Back from abroad with a few dollars and an accent." },
} as const;
export type Background = keyof typeof BACKGROUNDS;

export const HAIR_STYLES = ["low", "afro", "braids", "bun", "wrap", "cap", "locs"] as const;
export const PATTERNS = ["plain", "kente", "wax", "stripe"] as const;

export interface LookInput {
  skin: string;
  shirt: string;
  pants: string;
  hair: string;
  feminine: boolean;
  height: number;
  build: number;
  hairStyle: (typeof HAIR_STYLES)[number];
  pattern: (typeof PATTERNS)[number];
  face?: number[];
}

const HEX = /^#[0-9a-fA-F]{6}$/;
export function sanitizeLook(l: unknown): LookInput {
  const o = (l && typeof l === "object" ? l : {}) as Record<string, unknown>;
  const col = (v: unknown, d: string) => (typeof v === "string" && HEX.test(v) ? v : d);
  const num = (v: unknown, lo: number, hi: number, d: number) => (typeof v === "number" && Number.isFinite(v) ? clamp(v, lo, hi) : d);
  return {
    skin: col(o.skin, "#5A3825"),
    shirt: col(o.shirt, "#1F7A4D"),
    pants: col(o.pants, "#2B2B2B"),
    hair: col(o.hair, "#111111"),
    feminine: o.feminine === true,
    height: num(o.height, 1.45, 2.05, 1.74),
    build: num(o.build, 0.78, 1.42, 1),
    face: Array.isArray(o.face) ? o.face.slice(0, 13).map((v) => num(v, -1, 1, 0)) : undefined,
    hairStyle: (HAIR_STYLES as readonly string[]).includes(o.hairStyle as string) ? (o.hairStyle as LookInput["hairStyle"]) : "low",
    pattern: (PATTERNS as readonly string[]).includes(o.pattern as string) ? (o.pattern as LookInput["pattern"]) : "plain",
  };
}

export function createPlayer(ctx: Ctx, input: { name: unknown; look: unknown; background: unknown; isTest?: boolean }): number {
  const name = typeof input.name === "string" ? input.name.trim().replace(/\s+/g, " ") : "";
  if (!/^[\p{L}\p{M}' .-]{2,24}$/u.test(name)) throw new GameError("bad_name", "Name must be 2–24 letters");
  const bgKey = (typeof input.background === "string" && input.background in BACKGROUNDS ? input.background : "graduate") as Background;
  const bg = BACKGROUNDS[bgKey];
  const look = sanitizeLook(input.look);
  const now = ctx.now();
  return tx(ctx.db, () => {
    const r = ctx.db.run(
      `INSERT INTO players (name, look, background, created_ms, game_min, last_sync_ms, district, pos_x, pos_z,
         energy, hunger, health, social, reputation, work, fitness, charisma, business, home_ref,
         last_day_processed, last_month_billed, visited, is_test)
       VALUES (?, ?, ?, ?, ?, ?, 'kaneshie', -60, 6, 85, 70, 90, 55, ?, ?, ?, ?, ?, ?, 0, 0, '["kaneshie"]', ?)`,
      name, JSON.stringify(look), bgKey, now, START_MINUTE, now, bg.rep, bg.skills.work, bg.skills.fitness, bg.skills.charisma, bg.skills.business,
      STARTER_HOME, input.isTest && ctx.config.devTools ? 1 : 0,
    );
    const id = r.lastInsertRowid;
    for (const code of ["cash", "bank", "usd", "tbill", "loan"]) ensureAccount(ctx.db, id, code);
    post(ctx.db, id, [
      { account: "cash", amount: minor(bg.cash) },
      { account: "bank", amount: minor(bg.bank) },
      { account: "usd", amount: bg.usd * 100 },
    ], { kind: "opening", memo: `Opening balances (${bg.label})`, gameMin: START_MINUTE, nowMs: now });
    // January's rent at Tetteh House is already paid.
    ctx.db.run("UPDATE players SET rent_credit = 0, last_month_billed = ? WHERE id = ?", monthIndex(START_MINUTE), id);
    logEntry(ctx.db, id, START_MINUTE, "story", `${name} arrives in Accra with a bag, a phone and a dream.`, []);
    return id;
  });
}

// ---------------------------------------------------------------------------
// Effects and stats

function skillGain(current: number, gain: number) {
  return gain > 0 ? gain * Math.max(0.2, 1 - current / 110) : gain;
}

export function applyEffects(p: PlayerRow, effects: Effects, fb: Feedback | null, text?: string, extra: Change[] = []) {
  const changes: Change[] = [];
  for (const [k, raw] of Object.entries(effects) as [EffectKey, number][]) {
    if (!raw) continue;
    const before = p[k];
    let after: number;
    if ((STAT_KEYS as readonly string[]).includes(k)) after = clamp(before + raw, 0, 100);
    else if (k === "reputation") after = clamp(before + raw, -100, 100);
    else after = clamp(before + skillGain(before, raw), 0, 100);
    p[k] = round1(after);
    const d = round1(after - before);
    if (d) changes.push({ k, d });
  }
  if (fb && text) fb.add(text, [...extra, ...changes], changes.some((c) => c.d < 0 && c.k !== "hunger") && !changes.some((c) => c.d > 0) ? "bad" : "good");
  return changes;
}

function logEntry(db: Db, playerId: number, gameMin: number, kind: string, text: string, changes: Change[]) {
  db.run("INSERT INTO log (player_id, game_min, kind, text, changes) VALUES (?, ?, ?, ?, ?)", playerId, gameMin, kind, text, JSON.stringify(changes));
}

function isPartnered(db: Db, playerId: number) {
  return !!db.get("SELECT 1 FROM relationships WHERE player_id = ? AND partner = 1", playerId);
}

/** Passive needs over time. */
function decay(p: PlayerRow, minutes: number, sleeping: boolean, partnered: boolean) {
  // Players can slow needs down or switch them off in settings.
  const h = (minutes / 60) * (p.needs_pace ?? 1);
  p.hunger = clamp(p.hunger - h * (sleeping ? 2.2 : 4.2), 0, 100);
  if (!sleeping) p.energy = clamp(p.energy - h * 3, 0, 100);
  if (!sleeping) p.social = clamp(p.social - h * (partnered ? 0.45 : 0.9), 0, 100);
  p.fun = clamp(p.fun - h * (sleeping ? 0.3 : 2.2), 0, 100);
  p.hygiene = clamp(p.hygiene - h * (sleeping ? 0.6 : 2.4), 0, 100);
  p.bladder = clamp(p.bladder - h * (sleeping ? 2.2 : 6), 0, 100);
  let dh = 0;
  if (p.hunger < 15) dh -= 1.5 * h;
  if (p.energy < 10) dh -= 1 * h;
  if (dh === 0 && p.hunger > 40 && p.energy > 30) dh = 0.15 * h;
  p.health = clamp(p.health + dh, 0, 100);
  for (const k of STAT_KEYS) p[k] = round1(p[k]);
}

// ---------------------------------------------------------------------------
// Money helpers

/** Charge cash first, then bank (mobile money). Throws if the total isn't there. */
function chargeStrict(ctx: Ctx, p: PlayerRow, amount: number, kind: string, memo: string, preferBank = false): Change[] {
  if (amount <= 0) return [];
  const cash = balance(ctx.db, p.id, "cash");
  const bank = balance(ctx.db, p.id, "bank");
  if (cash + bank < amount) throw new GameError("insufficient_funds", `You need ${formatMoney(amount)} but have ${formatMoney(cash + bank)} across cash and bank.`);
  const first = preferBank ? "bank" : "cash";
  const second = preferBank ? "cash" : "bank";
  const firstBal = preferBank ? bank : cash;
  const a = Math.min(firstBal, amount);
  const legs: Leg[] = [{ account: first, amount: -a }, { account: second, amount: -(amount - a) }];
  post(ctx.db, p.id, legs, { kind, memo, gameMin: p.game_min, nowMs: ctx.now() });
  return legs.filter((l) => l.amount).map((l) => ({ k: l.account, d: l.amount }));
}

/** Charge bank then cash, paying as much as possible. Returns the unpaid shortfall. */
function chargeFlexible(ctx: Ctx, p: PlayerRow, amount: number, kind: string, memo: string): { unpaid: number; changes: Change[] } {
  const bank = balance(ctx.db, p.id, "bank");
  const cash = balance(ctx.db, p.id, "cash");
  const fromBank = Math.min(bank, amount);
  const fromCash = Math.min(cash, amount - fromBank);
  const legs: Leg[] = [{ account: "bank", amount: -fromBank }, { account: "cash", amount: -fromCash }].filter((l) => l.amount);
  if (legs.length) post(ctx.db, p.id, legs, { kind, memo, gameMin: p.game_min, nowMs: ctx.now() });
  return { unpaid: amount - fromBank - fromCash, changes: legs.map((l) => ({ k: l.account, d: l.amount })) };
}

function credit(ctx: Ctx, p: PlayerRow, account: string, amount: number, kind: string, memo: string, idemKey?: string): Change[] {
  if (amount === 0) return [];
  post(ctx.db, p.id, [{ account, amount }], { kind, memo, gameMin: p.game_min, nowMs: ctx.now(), idemKey });
  return [{ k: account, d: amount }];
}

// ---------------------------------------------------------------------------
// Time

/** Bring the game clock up to date with real time spent in the city (capped). */
function catchUp(ctx: Ctx, p: PlayerRow, fb: Feedback) {
  const now = ctx.now();
  const elapsedSec = Math.max(0, (now - p.last_sync_ms) / 1000);
  // Time only flows while you're playing: long absences don't age your city.
  const minutes = Math.floor(Math.min(elapsedSec, 150) * TIME_SCALE);
  if (minutes > 0) {
    advance(ctx, p, minutes, fb, { quiet: true });
    p.last_sync_ms = now;
  } else if (elapsedSec > 150) {
    p.last_sync_ms = now;
  }
}

export function advance(ctx: Ctx, p: PlayerRow, minutes: number, fb: Feedback, opts: { sleeping?: boolean; quiet?: boolean } = {}) {
  if (minutes <= 0) return;
  const partnered = isPartnered(ctx.db, p.id);
  const before = { hunger: p.hunger, energy: p.energy, social: p.social, health: p.health };
  let remaining = Math.floor(minutes);
  while (remaining > 0) {
    const nextDay = (dayOf(p.game_min) + 1) * MINUTES_PER_DAY;
    const step = Math.min(remaining, nextDay - p.game_min);
    decay(p, step, !!opts.sleeping, partnered);
    if (p.bladder <= 0) {
      // Nobody makes it to the toilet forever.
      p.bladder = 100;
      p.hygiene = clamp(p.hygiene - 45, 0, 100);
      p.social = clamp(p.social - 12, 0, 100);
      fb.add("😳 Couldn't hold it any longer. You'll need a bath and a change of clothes.", [{ k: "hygiene", d: -45 }, { k: "social", d: -12 }], "bad");
    }
    p.game_min += step;
    remaining -= step;
    processTimed(ctx, p, fb);
    while (p.last_day_processed < dayOf(p.game_min)) {
      p.last_day_processed += 1;
      processNewDay(ctx, p, p.last_day_processed, fb);
    }
  }
  if (!opts.quiet && minutes >= 60) {
    const changes = (["hunger", "energy", "social", "health"] as const)
      .map((k) => ({ k, d: round1(p[k] - before[k]) }))
      .filter((c) => Math.abs(c.d) >= 1);
    if (changes.length) fb.add(`${Math.round(minutes / 6) / 10}h passed`, changes, "info");
  }
}

/** Things that complete at a specific minute: construction, T-bills, upgrades, missed dates. */
function processTimed(ctx: Ctx, p: PlayerRow, fb: Feedback) {
  const db = ctx.db;
  const now = p.game_min;
  for (const b of db.all<BuildingRow>("SELECT * FROM buildings WHERE player_id = ? AND status IN ('building','upgrading') AND stage_ends_min <= ?", p.id, now)) {
    const design = DESIGNS[b.design];
    if (b.status === "upgrading") {
      db.run("UPDATE buildings SET status='complete', quality=?, upgrade_to=NULL, stage_started_min=NULL, stage_ends_min=NULL WHERE id=?", b.upgrade_to, b.id);
      fb.add(`🏗️ Upgrade finished: your ${design.name} is now ${QUALITY[b.upgrade_to as Quality].label.toLowerCase()} quality.`, [], "good");
      logEntry(db, p.id, now, "property", `Upgrade complete on ${design.name}`, []);
      continue;
    }
    const plan = stagePlan(b.design, b.quality as Quality);
    const stage = b.stage + 1;
    if (stage >= plan.length) {
      db.run("UPDATE buildings SET stage=?, status='complete', completed_min=?, stage_started_min=NULL, stage_ends_min=NULL WHERE id=?", stage, now, b.id);
      fb.add(`🏠 Construction complete: your ${design.name} is finished!`, [], "goal");
      logEntry(db, p.id, now, "property", `${design.name} completed`, []);
      const changes = applyEffects(p, { reputation: design.kind === "home" ? 6 : 4, social: 10 }, null);
      fb.add("The neighbours came to see the new building.", changes, "good");
    } else {
      db.run("UPDATE buildings SET stage=?, status='awaiting_payment', stage_started_min=NULL, stage_ends_min=NULL WHERE id=?", stage, b.id);
      fb.add(`🧱 ${plan[b.stage].name} done on your ${design.name}. Pay for ${plan[stage].name.toLowerCase()} to continue.`, [], "info");
      logEntry(db, p.id, now, "property", `${plan[b.stage].name} finished on ${design.name}`, []);
    }
  }
  for (const t of db.all<{ id: number; product: string; principal: number; payout: number }>(
    "SELECT * FROM tbills WHERE player_id = ? AND status = 'active' AND matures_min <= ?", p.id, now,
  )) {
    db.run("UPDATE tbills SET status = 'matured' WHERE id = ? AND status = 'active'", t.id);
    post(db, p.id, [{ account: "tbill", amount: -t.principal }, { account: "bank", amount: t.payout }], {
      kind: "tbill_maturity", memo: `${TBILLS[t.product].name} matured`, gameMin: now, nowMs: ctx.now(), idemKey: `tbill-mature:${t.id}`,
    });
    fb.add(`📈 ${TBILLS[t.product].name} matured: ${formatMoney(t.payout)} paid to your bank (+${formatMoney(t.payout - t.principal)} interest).`, [{ k: "bank", d: t.payout }], "good");
  }
  for (const b of db.all<{ id: number; type: string; level: number }>(
    "SELECT * FROM businesses WHERE player_id = ? AND upgrading_until IS NOT NULL AND upgrading_until <= ?", p.id, now,
  )) {
    db.run("UPDATE businesses SET level = level + 1, upgrading_until = NULL WHERE id = ?", b.id);
    fb.add(`🛠️ Your ${BUSINESSES[b.type].name} reopened at level ${b.level + 1}.`, [], "good");
  }
  for (const d of db.all<{ id: number; npc_id: string; place_id: string }>(
    "SELECT * FROM dates WHERE player_id = ? AND status = 'pending' AND start_min + 180 < ?", p.id, now,
  )) {
    db.run("UPDATE dates SET status = 'missed' WHERE id = ?", d.id);
    const npc = NPC_BY_ID[d.npc_id];
    const rel = relationship(db, p.id, d.npc_id);
    const place = PLACE_BY_ID[d.place_id];
    rel.affinity = clamp(rel.affinity - 15, -100, 100);
    rel.romance = clamp(rel.romance - 20, 0, 100);
    pushMemory(rel, p.game_min, `you stood me up at ${place.name}`);
    saveRel(db, p.id, rel);
    fb.add(`💔 You missed your date with ${npc.name.split(" ")[0]} at ${place.name}.`, [{ k: `rel:${npc.id}`, d: -15 }], "bad");
  }
}

interface BuildingRow {
  id: number;
  plot_id: number;
  design: string;
  quality: string;
  stage: number;
  status: "awaiting_payment" | "building" | "complete" | "upgrading";
  stage_started_min: number | null;
  stage_ends_min: number | null;
  upgrade_to: string | null;
  use: "vacant" | "live" | "rent";
  spent: number;
  completed_min: number | null;
}

interface BusinessRow {
  id: number;
  type: string;
  level: number;
  bought_min: number;
  upgrading_until: number | null;
  last_visit_day: number;
  total_profit: number;
  last_day_profit: number;
  history: string;
}

function dayWasRainy(day: number) {
  const noon = day * MINUTES_PER_DAY + 12 * 60;
  const w = [weatherAt(noon - 180), weatherAt(noon), weatherAt(noon + 180)];
  return w.filter((x) => x === "rain" || x === "storm").length >= 2;
}

function eventMultiplier(db: Db, playerId: number, day: number): number {
  const ev = db.get<{ event_id: string }>("SELECT event_id FROM life_events WHERE player_id = ? AND day = ?", playerId, day);
  const def = ev && LIFE_EVENTS.find((e) => e.id === ev.event_id);
  return def?.auto?.businessMultiplier ?? 1;
}

/** Daily settlement. Runs once per game day per player (guarded by last_day_processed). */
function processNewDay(ctx: Ctx, p: PlayerRow, day: number, fb: Feedback) {
  const db = ctx.db;
  const y = day - 1;
  const ydate = toGameDate(y * MINUTES_PER_DAY + 12 * 60);
  const rainy = dayWasRainy(y);
  const evMult = eventMultiplier(db, p.id, y);
  const nowMs = ctx.now();

  // Businesses: yesterday's trading lands in each business's till.
  const promoDay = db.get<{ promo_day: number }>("SELECT promo_day FROM social WHERE player_id = ?", p.id)?.promo_day ?? -1;
  let bizTotal = 0;
  for (const b of db.all<BusinessRow>("SELECT * FROM businesses WHERE player_id = ? AND bought_min < ?", p.id, day * MINUTES_PER_DAY)) {
    const t = BUSINESSES[b.type];
    let rev = levelRevenue(t.revenue, b.level);
    if (ydate.isWeekend) rev *= t.weekend;
    if (rainy && t.outdoor) rev *= 0.72;
    rev *= demandNoise(b.id, y) * evMult;
    rev *= 1 + clamp(p.reputation, -50, 100) / 400;
    if (t.foodBusiness && hasUnlock(p, "esi_recipe")) rev *= 1.1;
    if (t.foodBusiness && hasUnlock(p, "cert_catering")) rev *= 1.1;
    if (promoDay === y) rev *= 1.12;
    const neglected = y - b.last_visit_day > NEGLECT_DAYS;
    if (neglected) rev *= 0.8;
    if (b.upgrading_until !== null) rev *= 0.5;
    const costs = levelCosts(t.costs, b.level);
    const profit = Math.round(minor(rev - costs));
    post(db, p.id, [{ account: `biz:${b.id}`, amount: profit }], {
      kind: "business_day", memo: `${t.name}: ${ydate.label} trading`, gameMin: p.game_min, nowMs, idemKey: `bizday:${b.id}:${y}`,
    });
    const hist = (JSON.parse(b.history) as number[]).concat(profit).slice(-14);
    db.run("UPDATE businesses SET total_profit = total_profit + ?, last_day_profit = ?, history = ? WHERE id = ?", profit, profit, JSON.stringify(hist), b.id);
    bizTotal += profit;
    if (neglected && rand01(`neglect:${b.id}:${y}`) < 0.3) fb.add(`⚠️ Staff at your ${t.name} say they haven't seen you in a while. Sales are slipping.`, [], "bad");
  }
  if (bizTotal !== 0) fb.add(`🏪 Your businesses made ${formatMoney(bizTotal)} yesterday (in their tills).`, [{ k: "business", d: bizTotal }], bizTotal > 0 ? "good" : "bad");

  // Work-and-pay: drivers pay daily (mostly), vehicles wear out.
  for (const v of db.all<{ id: number; type: string; condition: number }>("SELECT * FROM vehicles WHERE player_id = ? AND status = 'workpay'", p.id)) {
    const def = VEHICLES[v.type];
    const r = rand01(`workpay:${v.id}:${y}`);
    const cond = Math.max(0, v.condition - (0.6 + r * 0.6));
    db.run("UPDATE vehicles SET condition = ? WHERE id = ?", cond, v.id);
    if (ydate.weekdayIndex === 0) continue; // drivers rest (and go to church) on Sunday
    if (r < 0.07) {
      fb.add(`🛺 Your ${def.name} driver says the vehicle broke down yesterday. No payment.`, [], "bad");
      continue;
    }
    const pay = Math.round(minor(def.workPay ?? 0) * (0.55 + 0.45 * cond / 100) * (rainy ? 0.85 : 1));
    post(db, p.id, [{ account: "bank", amount: pay }], { kind: "workpay", memo: `Work-and-pay: ${def.name}`, gameMin: p.game_min, nowMs, idemKey: `workpay:${v.id}:${y}` });
  }

  // Brand deals once you have an audience.
  const soc = db.get<{ followers: number }>("SELECT followers FROM social WHERE player_id = ?", p.id);
  if (soc) {
    const lost = Math.floor(soc.followers * 0.004);
    if (lost > 0) db.run("UPDATE social SET followers = followers - ? WHERE player_id = ?", lost, p.id);
    const deal = influencerDaily(soc.followers);
    if (deal > 0) post(db, p.id, [{ account: "bank", amount: minor(deal) }], { kind: "influencer", memo: "Brand deals & creator payouts", gameMin: p.game_min, nowMs, idemKey: `influence:${y}` });
  }

  // Dumsor: the lights go off some nights. Generators and solar save your sleep.
  if (rand01(`dumsor:${y}`) < 0.18) {
    const backup = ownedItems(db, p).some((i) => ITEMS[i.item_id]?.slot === "power");
    if (backup) fb.add("💡 Dumsor last night. Your backup power kept the fan running.", [], "info");
    else fb.add("🌑 Dumsor last night: no fan, mosquitoes, poor sleep.", applyEffects(p, { energy: -8, health: -1 }, null), "bad");
  }

  // Rental income from buildings you let out.
  for (const b of db.all<BuildingRow & { price: number }>(
    "SELECT b.*, pl.price FROM buildings b JOIN plots pl ON pl.id = b.plot_id WHERE b.player_id = ? AND b.status = 'complete' AND b.use = 'rent'", p.id,
  )) {
    const value = builtValue(b.price / 100, b.design, b.quality as Quality);
    const daily = Math.round(minor((value * DESIGNS[b.design].rentYield) / 30));
    post(db, p.id, [{ account: "bank", amount: daily }], { kind: "rent_income", memo: `Tenants: ${DESIGNS[b.design].name}`, gameMin: p.game_min, nowMs, idemKey: `rentin:${b.id}:${y}` });
  }

  // Interest.
  const bank = balance(db, p.id, "bank");
  const bi = Math.floor((bank * SAVINGS_RATE) / 365);
  if (bi > 0) post(db, p.id, [{ account: "bank", amount: bi }], { kind: "interest", memo: "Savings interest", gameMin: p.game_min, nowMs, idemKey: `int:bank:${y}` });
  const usd = balance(db, p.id, "usd");
  const ui = Math.floor((usd * USD_RATE) / 365);
  if (ui > 0) post(db, p.id, [{ account: "usd", amount: ui }], { kind: "interest", memo: "Dollar account interest", gameMin: p.game_min, nowMs, idemKey: `int:usd:${y}` });
  const loan = balance(db, p.id, "loan");
  if (loan > 0) {
    const rate = LOAN_RATE - (hasUnlock(p, "akosua_rate") ? 0.02 : 0);
    const li = Math.ceil((loan * rate) / 365);
    post(db, p.id, [{ account: "loan", amount: li }], { kind: "loan_interest", memo: "Loan interest", gameMin: p.game_min, nowMs, idemKey: `int:loan:${y}` });
  }

  if (isPartnered(db, p.id)) applyEffects(p, { social: 3 }, null);

  const today = toGameDate(day * MINUTES_PER_DAY);
  // Month start bills.
  const mi = monthIndex(day * MINUTES_PER_DAY);
  if (mi > p.last_month_billed) {
    p.last_month_billed = mi;
    monthlyBills(ctx, p, fb, today.monthName);
  }
  // Salary day.
  if (today.date === SALARY_DAY && p.payroll_accrued > 0) {
    const pay = p.payroll_accrued;
    p.payroll_accrued = 0;
    post(db, p.id, [{ account: "bank", amount: pay }], { kind: "salary", memo: `${today.monthName} salary`, gameMin: p.game_min, nowMs, idemKey: `salary:${day}` });
    fb.add(`💼 Salary day! ${formatMoney(pay)} landed in your bank.`, [{ k: "bank", d: pay }], "good");
    logEntry(db, p.id, p.game_min, "money", `Salary paid: ${formatMoney(pay)}`, [{ k: "bank", d: pay }]);
  }
  rollLifeEvent(ctx, p, day, fb);
}

function baseComfort(db: Db, p: PlayerRow): number {
  if (p.home_kind === "rental") return RENTALS[p.home_ref]?.comfort ?? 1;
  const b = db.get<BuildingRow>("SELECT * FROM buildings WHERE id = ?", Number(p.home_ref));
  return b ? DESIGNS[b.design].comfort + QUALITY[b.quality as Quality].comfort : 1;
}

/** Building comfort plus what you've furnished it with (up to +3). */
function homeComfort(db: Db, p: PlayerRow): number {
  return baseComfort(db, p) + furnishingScore(ownedItems(db, p).map((i) => i.item_id)).bonus;
}

export function homeDistrict(db: Db, p: PlayerRow): DistrictId {
  if (p.home_kind === "rental") return RENTALS[p.home_ref].district;
  const b = db.get<{ plot_type: string }>("SELECT pl.plot_type FROM buildings b JOIN plots pl ON pl.id = b.plot_id WHERE b.id = ?", Number(p.home_ref));
  return b ? PLOTS[b.plot_type].district : "kaneshie";
}

function monthlyBills(ctx: Ctx, p: PlayerRow, fb: Feedback, monthName: string) {
  const db = ctx.db;
  let total = 0;
  const items: string[] = [];
  if (p.home_kind === "rental") {
    const r = RENTALS[p.home_ref];
    if (p.rent_credit > 0) {
      p.rent_credit -= 1;
      items.push("rent (prepaid)");
    } else {
      const rent = minor(r.rent * (r.id === "tetteh_room" && hasUnlock(p, "tetteh_discount") ? 0.85 : 1));
      const res = chargeFlexible(ctx, p, rent, "rent", `${monthName} rent: ${r.name}`);
      total += rent - res.unpaid;
      items.push("rent");
      if (res.unpaid > 0) {
        p.rent_arrears += res.unpaid;
        applyEffects(p, { reputation: -4, social: -5 }, null);
        fb.add(`🏚️ You couldn't cover ${monthName}'s rent. ${formatMoney(res.unpaid)} is now in arrears and your landlord is not happy.`, [{ k: "reputation", d: -4 }], "bad");
      }
    }
  }
  const owned = ownedItems(db, p).map((i) => i.item_id);
  const POWER_DRAW: Record<string, number> = { split_ac: 380, fridge: 90, deep_freezer: 85, smart_tv65: 35, washing_machine: 35, standing_cooker: 0, tv32: 15, ceiling_fan: 20, standing_fan: 12 };
  let power = owned.reduce((a, i) => a + (POWER_DRAW[i] ?? 0), 0);
  if (owned.includes("solar_inverter")) power *= 0.35;
  const baseUtil = p.home_kind === "rental" ? RENTALS[p.home_ref].utilities : 150 * baseComfort(db, p);
  const utilities = minor(baseUtil * (owned.includes("solar_inverter") ? 0.6 : 1) + power);
  // Personal vehicles: insurance, roadworthy, servicing.
  const running = db.all<{ type: string }>("SELECT type FROM vehicles WHERE player_id = ? AND status = 'personal'", p.id)
    .reduce((a, v) => a + Math.max(20, Math.round((VEHICLES[v.type]?.price ?? 0) * 0.0018)), 0);
  if (running) items.push("vehicle costs");
  const bills = utilities + minor(PHONE_DATA_MONTHLY) + minor(running);
  const ub = chargeFlexible(ctx, p, bills, "bills", `${monthName} ECG, water & phone data${running ? ", vehicle insurance & servicing" : ""}`);
  total += bills - ub.unpaid;
  items.push("utilities", "data");
  if (ub.unpaid > 0) {
    applyEffects(p, { social: -4, health: -3 }, null);
    fb.add("💡 ECG cut your power for unpaid bills.", [], "bad");
  }
  const loan = balance(db, p.id, "loan");
  if (loan > 0) {
    const due = Math.max(minor(50), Math.ceil(loan * LOAN_MIN_REPAYMENT));
    const amount = Math.min(due, loan);
    const bank = balance(db, p.id, "bank");
    if (bank >= amount) {
      post(db, p.id, [{ account: "bank", amount: -amount }, { account: "loan", amount: -amount }], { kind: "loan_repayment", memo: `${monthName} loan instalment`, gameMin: p.game_min, nowMs: ctx.now() });
      total += amount;
      p.credit_score = clamp(p.credit_score + 10, 300, 850);
      items.push("loan");
    } else {
      p.credit_score = clamp(p.credit_score - 45, 300, 850);
      applyEffects(p, { reputation: -3 }, null);
      fb.add(`🏦 Missed loan instalment of ${formatMoney(amount)}. Your credit score dropped.`, [{ k: "credit", d: -45 }], "bad");
    }
  }
  fb.add(`🧾 ${monthName} bills paid: ${formatMoney(total)} (${items.join(", ")}).`, [{ k: "bills", d: -total }], "info");
  logEntry(db, p.id, p.game_min, "money", `${monthName} bills: ${formatMoney(total)}`, []);
}

function rollLifeEvent(ctx: Ctx, p: PlayerRow, day: number, fb: Feedback) {
  const db = ctx.db;
  if (day < 1) return;
  if (rand01(`event:${p.id}:${day}`) > 0.3) return;
  if (db.get("SELECT 1 FROM life_events WHERE player_id = ? AND status = 'pending'", p.id)) return;
  const pool = LIFE_EVENTS.filter((e) => (e.minDay ?? 0) <= day);
  const total = pool.reduce((s, e) => s + e.weight, 0);
  let r = rand01(`eventpick:${p.id}:${day}`) * total;
  const ev = pool.find((e) => (r -= e.weight) < 0) ?? pool[0];
  if (ev.auto) {
    db.run("INSERT OR IGNORE INTO life_events (player_id, event_id, day, status, result) VALUES (?, ?, ?, 'auto', ?)", p.id, ev.id, day, ev.text);
    const changes = applyEffects(p, ev.auto.effects, null);
    if (ev.auto.cash) {
      const cash = balance(db, p.id, "cash");
      const amount = ev.auto.cash < 0 ? -Math.min(cash, minor(-ev.auto.cash)) : minor(ev.auto.cash);
      if (amount) changes.push(...credit(ctx, p, "cash", amount, "life_event", ev.title, `event:${day}`));
    }
    fb.add(`📰 ${ev.title}: ${ev.text}`, changes, "info");
    logEntry(db, p.id, p.game_min, "event", `${ev.title}: ${ev.text}`, changes);
  } else {
    db.run("INSERT OR IGNORE INTO life_events (player_id, event_id, day, status) VALUES (?, ?, ?, 'pending')", p.id, ev.id, day);
    fb.add(`📱 ${ev.title} — check your phone.`, [], "info");
  }
}

// ---------------------------------------------------------------------------
// Relationships

interface RelRow {
  npc_id: string;
  affinity: number;
  romance: number;
  partner: number;
  talks_today: number;
  last_talk_day: number;
  last_gift_day: number;
  last_topic: string | null;
  dates_done: number;
  memories: string;
}

function relationship(db: Db, playerId: number, npcId: string): RelRow {
  db.run("INSERT OR IGNORE INTO relationships (player_id, npc_id) VALUES (?, ?)", playerId, npcId);
  return db.get<RelRow>("SELECT * FROM relationships WHERE player_id = ? AND npc_id = ?", playerId, npcId)!;
}

function saveRel(db: Db, playerId: number, r: RelRow) {
  db.run(
    "UPDATE relationships SET affinity=?, romance=?, partner=?, talks_today=?, last_talk_day=?, last_gift_day=?, last_topic=?, dates_done=?, memories=? WHERE player_id=? AND npc_id=?",
    round1(r.affinity), round1(r.romance), r.partner, r.talks_today, r.last_talk_day, r.last_gift_day, r.last_topic, r.dates_done, r.memories, playerId, r.npc_id,
  );
}

function pushMemory(r: RelRow, gameMin: number, text: string) {
  const m = JSON.parse(r.memories) as { day: number; text: string }[];
  m.push({ day: dayOf(gameMin), text });
  r.memories = JSON.stringify(m.slice(-8));
}

function rememberAcrossDistrict(db: Db, p: PlayerRow, district: DistrictId, text: string) {
  for (const npc of NPCS.filter((n) => n.district === district)) {
    const r = db.get<RelRow>("SELECT * FROM relationships WHERE player_id = ? AND npc_id = ?", p.id, npc.id);
    if (r && r.affinity >= 15) {
      pushMemory(r, p.game_min, text);
      saveRel(db, p.id, r);
    }
  }
}

// ---------------------------------------------------------------------------
// Validation helpers

function requireAmount(v: unknown, label = "amount"): number {
  if (typeof v !== "number" || !Number.isSafeInteger(v) || v <= 0 || v > 1e13) throw new GameError("bad_amount", `Invalid ${label}`);
  return v;
}

function requireDistrict(p: PlayerRow, d: DistrictId, what: string) {
  if (p.district !== d) throw new GameError("wrong_place", `${what} is in ${DISTRICTS[d].name}. Travel there first.`);
}

function requirePlace(p: PlayerRow, placeId: unknown) {
  const place = typeof placeId === "string" ? PLACE_BY_ID[placeId] : undefined;
  if (!place) throw new GameError("bad_place", "Unknown place");
  requireDistrict(p, place.district, place.name);
  const hour = toGameDate(p.game_min).hour;
  if (!isOpenAt(place.open, hour)) throw new GameError("closed", `${place.name} is closed right now.`);
  return place;
}

function requireVisited(p: PlayerRow, d: DistrictId) {
  if (!list(p.visited).includes(d)) throw new GameError("not_visited", `Visit ${DISTRICTS[d].name} in person before doing business there.`);
}

function requireAwake(p: PlayerRow, energyNeeded: number, what: string) {
  if (p.health < 20) throw new GameError("too_sick", `You're too unwell to ${what}. See a doctor or rest.`);
  if (p.energy < energyNeeded) throw new GameError("too_tired", `You're too tired to ${what} (energy ${Math.round(p.energy)}/${energyNeeded}). Sleep or grab something to eat.`);
}

// ---------------------------------------------------------------------------
// Actions

export type Action = { type: string } & Record<string, unknown>;
export interface ActionResult {
  ok: boolean;
  error?: string;
  code?: string;
  feedback: FeedbackItem[];
  data?: unknown;
  replay?: boolean;
}

/**
 * Perform one player action atomically and idempotently. A retry with the
 * same key returns the original result without applying anything twice.
 */
export function perform(ctx: Ctx, playerId: number, idemKey: string, action: Action): ActionResult {
  if (typeof idemKey !== "string" || !/^[A-Za-z0-9_-]{8,80}$/.test(idemKey)) {
    return { ok: false, code: "bad_idempotency_key", error: "Missing or invalid idempotency key", feedback: [] };
  }
  try {
    return tx(ctx.db, () => {
      const seen = ctx.db.get<{ response: string }>("SELECT response FROM idempotency WHERE player_id = ? AND key = ?", playerId, idemKey);
      if (seen) return { ...(JSON.parse(seen.response) as ActionResult), replay: true };
      const p = loadPlayer(ctx.db, playerId);
      const fb = new Feedback();
      catchUp(ctx, p, fb);
      const discoveredBefore = p.discovered;
      const data = dispatch(ctx, p, action, fb);
      trackDaily(ctx, p, action, fb, discoveredBefore !== p.discovered);
      evaluateGoals(ctx, p, fb);
      savePlayer(ctx.db, p);
      for (const item of fb.items) {
        if (item.tone !== "info" || item.changes.length) logEntry(ctx.db, p.id, p.game_min, action.type, item.text, item.changes);
      }
      const result: ActionResult = { ok: true, feedback: fb.items, data };
      ctx.db.run("INSERT INTO idempotency (player_id, key, response, created_ms) VALUES (?, ?, ?, ?)", playerId, idemKey, JSON.stringify(result), ctx.now());
      return result;
    });
  } catch (err) {
    if (err instanceof GameError) return { ok: false, code: err.code, error: err.message, feedback: [] };
    throw err;
  }
}

function dispatch(ctx: Ctx, p: PlayerRow, a: Action, fb: Feedback): unknown {
  switch (a.type) {
    case "sync": return actSync(ctx, p, a);
    case "discover": return actDiscover(p, a);
    case "service": return actService(ctx, p, a, fb);
    case "sleep": return actSleep(ctx, p, a, fb);
    case "order_food": return actOrderFood(ctx, p, a, fb);
    case "travel": return actTravel(ctx, p, a, fb);
    case "job_apply": return actJobApply(p, a, fb);
    case "job_quit": return actJobQuit(p, fb);
    case "work": return actWork(ctx, p, fb);
    case "talk": return actTalk(ctx, p, a, fb);
    case "date_attend": return actDateAttend(ctx, p, a, fb);
    case "deposit": return actDeposit(ctx, p, a, fb, 1);
    case "withdraw": return actDeposit(ctx, p, a, fb, -1);
    case "fx_buy": return actFx(ctx, p, a, fb, "buy");
    case "fx_sell": return actFx(ctx, p, a, fb, "sell");
    case "tbill_buy": return actTbill(ctx, p, a, fb);
    case "loan_take": return actLoanTake(ctx, p, a, fb);
    case "loan_repay": return actLoanRepay(ctx, p, a, fb);
    case "pay_arrears": return actPayArrears(ctx, p, fb);
    case "rent_move": return actRentMove(ctx, p, a, fb);
    case "plot_buy": return actPlotBuy(ctx, p, a, fb);
    case "build_start": return actBuildStart(ctx, p, a, fb);
    case "build_pay_stage": return actBuildPayStage(ctx, p, a, fb);
    case "building_upgrade": return actBuildingUpgrade(ctx, p, a, fb);
    case "building_use": return actBuildingUse(ctx, p, a, fb);
    case "biz_buy": return actBizBuy(ctx, p, a, fb);
    case "biz_upgrade": return actBizUpgrade(ctx, p, a, fb);
    case "biz_collect": return actBizCollect(ctx, p, a, fb);
    case "biz_sell": return actBizSell(ctx, p, a, fb);
    case "vehicle_buy": return actVehicleBuy(ctx, p, a, fb);
    case "vehicle_sell": return actVehicleSell(ctx, p, a, fb);
    case "vehicle_workpay": return actVehicleWorkPay(ctx, p, a, fb);
    case "shop_buy": return actShopBuy(ctx, p, a, fb);
    case "item_sell": return actItemSell(ctx, p, a, fb);
    case "cook": return actCook(ctx, p, fb);
    case "home_activity": return actHomeActivity(ctx, p, a, fb);
    case "farm_buy": return actFarmBuy(ctx, p, a, fb);
    case "farm_plant": return actFarmPlant(ctx, p, a, fb);
    case "farm_harvest": return actFarmHarvest(ctx, p, a, fb);
    case "course_enrol": return actCourseEnrol(ctx, p, a, fb);
    case "course_attend": return actCourseAttend(ctx, p, a, fb);
    case "social_post": return actSocialPost(ctx, p, a, fb);
    case "event_choose": return actEventChoose(ctx, p, a, fb);
    case "daily_swap": return actDailySwap(ctx, p, a, fb);
    case "settings": return actSettings(p, a, fb);
    case "dev_grant": return actDevGrant(ctx, p, a, fb);
    case "dev_skip": return actDevSkip(ctx, p, a, fb);
    default:
      throw new GameError("bad_action", `Unknown action ${String(a.type)}`);
  }
}

function actSync(ctx: Ctx, p: PlayerRow, a: Action) {
  if (typeof a.x === "number" && typeof a.z === "number" && Number.isFinite(a.x) && Number.isFinite(a.z)) {
    p.pos_x = clamp(a.x, -95, 95);
    p.pos_z = clamp(a.z, -75, 75);
  }
  const types = Object.values(BUSINESSES).filter((b) => b.district === p.district).map((b) => b.id);
  if (types.length) {
    ctx.db.run(`UPDATE businesses SET last_visit_day = ? WHERE player_id = ? AND type IN (${types.map(() => "?").join(",")})`, dayOf(p.game_min), p.id, ...types);
  }
  return null;
}

function actDiscover(p: PlayerRow, a: Action) {
  const place = typeof a.placeId === "string" ? PLACE_BY_ID[a.placeId] : undefined;
  if (!place || place.district !== p.district) throw new GameError("bad_place", "Unknown place");
  addToList(p, "discovered", place.id);
  return null;
}

function actService(ctx: Ctx, p: PlayerRow, a: Action, fb: Feedback) {
  const place = requirePlace(p, a.placeId);
  const sid = typeof a.serviceId === "string" ? a.serviceId : "";
  if (!place.services.includes(sid)) throw new GameError("bad_service", "That's not offered here");
  const s = SERVICES[sid];
  const hour = toGameDate(p.game_min).hour;
  if (s.hours && !isOpenAt(s.hours, hour)) throw new GameError("closed", `${s.name} is only available ${s.hours[0]}:00–${s.hours[1] % 24}:00.`);
  if (s.requiresRep && p.reputation < s.requiresRep) throw new GameError("reputation", `The host looks you up and down. You need ${s.requiresRep} standing to get in.`);
  const gdNow = toGameDate(p.game_min);
  if (s.days && !s.days.includes(gdNow.weekdayIndex)) throw new GameError("closed", `${s.name} only happens on ${s.days.map((d) => WEEKDAY_NAMES[d]).join(", ")}.`);
  if (s.months && !s.months.includes(gdNow.month + 1)) throw new GameError("not_season", `${s.name} isn't on this month. It comes around in ${s.months.map((m) => MONTH_NAMES[m - 1]).join(" / ")}.`);
  if (s.cycle42 && dayOf(p.game_min) % 42 !== AKWASIDAE_OFFSET) throw new GameError("not_season", `${s.name} is held every sixth Sunday. Next one in ${daysToAkwasidae(dayOf(p.game_min))} days.`);
  if ((s.effects.energy ?? 0) < -10) requireAwake(p, Math.min(30, -(s.effects.energy ?? 0)), s.verb.toLowerCase());
  let cost = minor(priceFor(s.cost, place.district));
  if (sid === "clinic" && hasUnlock(p, "adjei_care")) cost = Math.round(cost / 2);
  if (s.site && hasUnlock(p, "guide_friend")) cost = Math.round(cost / 2);
  const money = chargeStrict(ctx, p, cost, "spend", `${s.name} at ${place.name}`);
  advance(ctx, p, s.minutes, fb, { quiet: true, sleeping: sid === "lodge" });
  applyEffects(p, s.effects, fb, s.site ? `Day trip: ${s.name}` : s.festival ? `🎉 ${s.name}` : `${s.verb} at ${place.name}`, money);
  if (s.site && addToList(p, "discovered", `site:${s.site}`)) {
    applyEffects(p, { social: 4, reputation: 1 }, fb, `📸 First visit to ${s.name}. Added to your travel album.`);
  }
  if (s.festival && hasUnlock(p, "dery_gyil")) applyEffects(p, { social: 8, reputation: 1 }, fb, "You joined the drummers. Dery's lessons paid off.");
  if (s.festival && addToList(p, "discovered", `fest:${s.festival}`)) {
    applyEffects(p, { social: 4, reputation: 2 }, fb, `First time at ${s.name}. You'll be telling this story for years.`);
  }
  if (!s.site && !s.festival && REGIONAL_DISH.has(sid) && addToList(p, "discovered", `dish:${sid}`)) {
    applyEffects(p, { social: 2 }, fb, `New taste unlocked: ${s.name}.`);
  }
  return null;
}

const REGIONAL_DISH = new Set(["tz", "wasawasa", "koko_koose", "tubaani", "pito", "brukina", "chichinga", "guinea_fowl", "abenkwan", "omo_tuo", "ampesi", "mpotompoto", "abunuabunu", "kokonte", "fried_yam", "roasted_plantain", "red_red", "palm_wine", "fante_kenkey", "akyeke", "akple", "abolo", "lake_fish", "waakye", "kelewele", "jollof", "fufu", "banku", "sobolo"]);
const WEEKDAY_NAMES = ["Sundays", "Mondays", "Tuesdays", "Wednesdays", "Thursdays", "Fridays", "Saturdays"];
const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/** Chop app: food delivered wherever you are, at a premium, paid by mobile money. */
export const DELIVERY_MENU = ["waakye", "jollof", "banku", "fufu", "kelewele"] as const;
export const DELIVERY_FEE = 15;

function actOrderFood(ctx: Ctx, p: PlayerRow, a: Action, fb: Feedback) {
  const sid = typeof a.serviceId === "string" ? a.serviceId : "";
  if (!(DELIVERY_MENU as readonly string[]).includes(sid)) throw new GameError("bad_service", "Not on the menu");
  const s = SERVICES[sid];
  const hour = toGameDate(p.game_min).hour;
  if (hour < 7 || hour >= 23) throw new GameError("closed", "Riders are off the road. Delivery runs 7:00–23:00.");
  const cost = minor(Math.round(priceFor(s.cost, p.district) * 1.3) + DELIVERY_FEE);
  const money = chargeStrict(ctx, p, cost, "spend", `Chop delivery: ${s.name}`, true);
  advance(ctx, p, 40, fb, { quiet: true });
  applyEffects(p, { ...s.effects, social: Math.min(2, s.effects.social ?? 0) }, fb, `Your ${s.name.toLowerCase()} arrived by okada rider`, money);
  return null;
}

function actSleep(ctx: Ctx, p: PlayerRow, a: Action, fb: Feedback) {
  if (p.district !== homeDistrict(ctx.db, p)) throw new GameError("wrong_place", "You can only sleep at home. Head home first.");
  const hours = a.hours === 2 ? 2 : 8;
  const comfort = homeComfort(ctx.db, p);
  advance(ctx, p, hours * 60, fb, { sleeping: true, quiet: true });
  const energy = hours === 8 ? 52 + comfort * 6 : 14 + comfort * 2;
  applyEffects(p, { energy, health: hours === 8 ? 2 + comfort : 0 }, fb, hours === 8 ? `Slept ${hours} hours (home comfort ${comfort})` : "Took a nap");
  return null;
}

function actTravel(ctx: Ctx, p: PlayerRow, a: Action, fb: Feedback) {
  const to = a.to as DistrictId;
  const mode = a.mode as TravelMode;
  if (!(to in DISTRICTS)) throw new GameError("bad_district", "Unknown destination");
  if (to === p.district) throw new GameError("same_place", "You're already here");
  if (DISTRICTS[to].city !== DISTRICTS[p.district].city) return actIntercity(ctx, p, a, fb);
  if (!(mode in TRAVEL_MODES)) throw new GameError("bad_mode", "Unknown way to travel");
  if (to === p.district) throw new GameError("same_place", "You're already here");
  if (DISTRICTS[to].city !== DISTRICTS[p.district].city) return actIntercity(ctx, p, a, fb);
  const gd = toGameDate(p.game_min);
  const m = TRAVEL_MODES[mode];
  if (m.hours && !isOpenAt(m.hours, gd.hour)) throw new GameError("no_service", `No ${m.name.toLowerCase()} running at this hour.`);
  if (mode === "car") {
    const v = drivable(ctx.db, p);
    if (!v) throw new GameError("no_car", "You don't own a vehicle you can drive yet (and keep one off work-and-pay).");
    if (v.licence && !hasUnlock(p, v.licence)) throw new GameError("no_licence", `You need a ${v.licence === "licence_a" ? "motorbike (A)" : "driving (B)"} licence. Driving schools can sort you out.`);
  }
  const w = weatherAt(p.game_min);
  const q = travelQuote(p.district, to, mode, gd.hour, gd.weekdayIndex, w === "rain" || w === "storm");
  if (mode === "walk" && q.km > 7) throw new GameError("too_far", "That's too far to walk. Take a trotro.");
  if (mode === "walk") requireAwake(p, 15, "walk that far");
  if (DISTRICTS[to].prestige > 0 && p.reputation < DISTRICTS[to].prestige && to === "trasacco" && mode !== "car") {
    fb.add("The guard at Valley Gate waves your trotro on: residents and guests only. You walk in from the junction.", [], "info");
  }
  let fare = minor(q.fare);
  if (mode === "trotro" && hasUnlock(p, "kobby_ride")) fare = 0;
  const money = mode === "ride" ? chargeStrict(ctx, p, fare, "transport", `Ride app to ${DISTRICTS[to].name}`, true) : chargeStrict(ctx, p, fare, "transport", `${m.name} to ${DISTRICTS[to].name}`);
  advance(ctx, p, q.minutes, fb, { quiet: true });
  const from = p.district;
  p.district = to;
  p.pos_x = -58;
  p.pos_z = 6;
  const first = addToList(p, "visited", to);
  applyEffects(p, { energy: q.energy, social: mode === "trotro" ? 2 : 0 }, fb, `${m.name} from ${DISTRICTS[from].name} to ${DISTRICTS[to].name} (${q.minutes} min)`, money);
  if (first) {
    applyEffects(p, { social: 4 }, fb, `First time in ${DISTRICTS[to].name}: ${DISTRICTS[to].tagline}.`);
  }
  actSync(ctx, p, {} as Action);
  return null;
}

/** Where you step off in a city, by how you arrived. */
export function arrivalDistrict(city: string, mode: IntercityMode): DistrictId {
  if (city === "accra") return mode === "flight" || mode === "own_plane" ? "airport_city" : "kaneshie";
  return districtsIn(city)[0];
}

function actIntercity(ctx: Ctx, p: PlayerRow, a: Action, fb: Feedback) {
  const mode = a.mode as IntercityMode;
  if (!(mode in INTERCITY_MODES)) throw new GameError("bad_mode", "Choose a bus, coach, flight or your own car for long trips.");
  const fromCity = DISTRICTS[p.district].city;
  const toCity = DISTRICTS[a.to as DistrictId].city;
  const q = intercityQuote(fromCity, toCity, mode);
  if (!q) throw new GameError("no_route", mode === "flight" || mode === "own_plane" ? "No airport there. Take the bus." : "No road route found.");
  if (mode === "own_plane") {
    const planes = ctx.db.all<{ type: string }>("SELECT type FROM vehicles WHERE player_id = ? AND status = 'personal'", p.id).map((v) => VEHICLES[v.type]).filter((v) => v?.category === "aircraft");
    if (!planes.length) throw new GameError("no_plane", "You don't own an aircraft. Skyline Aviation Sales in Airport City can fix that.");
    const best = planes.sort((a, b) => b.speedKmh - a.speedKmh)[0];
    q.minutes = Math.round((q.km / best.speedKmh) * 60) + 40;
    q.fare = Math.round(400 + best.perKm * q.km);
    q.energy = -4;
  }
  const m = INTERCITY_MODES[mode];
  const gd = toGameDate(p.game_min);
  if (!isOpenAt(m.hours, gd.hour)) throw new GameError("no_service", `No ${m.name.toLowerCase()} departures at this hour (${m.hours[0]}:00–${m.hours[1]}:00).`);
  if (mode === "car") {
    const owned = ctx.db.all<{ type: string }>("SELECT type FROM vehicles WHERE player_id = ? AND status = 'personal'", p.id).map((v) => VEHICLES[v.type]).filter((v) => v && v.longDistance);
    if (!owned.length) throw new GameError("no_car", "You need a car (or a sturdy motorbike) for that journey.");
    if (!owned.some((v) => !v.licence || hasUnlock(p, v.licence))) throw new GameError("no_licence", "The police at the barrier will want your licence. Get one at a driving school.");
  }
  if (q.minutes > 240) requireAwake(p, 20, "make that journey");
  const fare = minor(q.fare);
  const money = chargeStrict(ctx, p, fare, "transport", `${m.name}: ${CITIES[fromCity].name} → ${CITIES[toCity].name}`, mode === "flight" || mode === "own_plane");
  // On long journeys you doze in your seat (unless you're the one driving).
  advance(ctx, p, q.minutes, fb, { quiet: true, sleeping: q.minutes > 240 && mode !== "car" });
  const from = p.district;
  p.district = arrivalDistrict(toCity, mode);
  p.pos_x = -58;
  p.pos_z = 6;
  const via = q.route.roads.length && mode !== "flight" ? ` via ${q.route.roads.slice(0, 2).map((r) => r.split(" (")[0]).join(", ")}` : "";
  applyEffects(p, { energy: q.energy, social: mode === "bus" ? 4 : 1 }, fb, `${m.name} from ${CITIES[fromCity].name} to ${CITIES[toCity].name}: ${q.km} km, ${Math.floor(q.minutes / 60)}h ${q.minutes % 60}m${via}.`, money);
  if (addToList(p, "visited", p.district)) {
    applyEffects(p, { social: 6, reputation: 1 }, fb, `First time in ${CITIES[toCity].name} (${CITIES[toCity].region} Region): ${DISTRICTS[p.district].tagline}.`);
  }
  addToList(p, "discovered", `region:${CITIES[toCity].region}`);
  rememberAcrossDistrict(ctx.db, p, from, `you travelled to ${CITIES[toCity].name}`);
  actSync(ctx, p, {} as Action);
  return null;
}

function jobRequirements(p: PlayerRow, jobId: string) {
  const job = JOBS[jobId];
  const req = { ...job.requires };
  if (jobId === "beach_bar_staff" && hasUnlock(p, "selasi_job")) delete req.charisma;
  if (jobId === "software_dev" && hasUnlock(p, "efua_referral") && req.work) req.work -= 20;
  if (jobId === "trotro_mate" && hasUnlock(p, "kobby_ride")) delete req.work;
  return req;
}

function actJobApply(p: PlayerRow, a: Action, fb: Feedback) {
  const job = typeof a.jobId === "string" ? JOBS[a.jobId] : undefined;
  if (!job) throw new GameError("bad_job", "Unknown job");
  const place = PLACE_BY_ID[job.placeId];
  requireDistrict(p, place.district, place.name);
  if (p.job_id === job.id) throw new GameError("already", "You already work here");
  const req = jobRequirements(p, job.id);
  const missing = Object.entries(req).filter(([k, v]) => (p[k as keyof PlayerRow] as number) < (v as number)).map(([k, v]) => `${k} ${v}`);
  if (missing.length) throw new GameError("requirements", `Not yet. You need ${missing.join(", ")}.`);
  const previous = p.job_id ? JOBS[p.job_id].title : null;
  p.job_id = job.id;
  p.job_rank = 0;
  p.job_shifts = 0;
  applyEffects(p, { reputation: 1, social: 5 }, fb, previous ? `You left ${previous} and started as ${job.title} at ${place.name}.` : `Hired! You're now a ${job.title} at ${place.name}.`);
  return null;
}

function actJobQuit(p: PlayerRow, fb: Feedback) {
  if (!p.job_id) throw new GameError("no_job", "You don't have a job");
  fb.add(`You quit your job as ${JOBS[p.job_id].title}.`, [], "info");
  p.job_id = null;
  p.job_rank = 0;
  p.job_shifts = 0;
  return null;
}

function actWork(ctx: Ctx, p: PlayerRow, fb: Feedback) {
  if (!p.job_id) throw new GameError("no_job", "You need a job first. Look for places that are hiring.");
  const job = JOBS[p.job_id];
  const place = requirePlace(p, job.placeId);
  const gd = toGameDate(p.game_min);
  if (job.weekdaysOnly && gd.isWeekend) throw new GameError("closed", `${place.name} doesn't run weekend shifts.`);
  if (!isOpenAt(job.shiftWindow, gd.hour)) throw new GameError("shift_time", `Shifts start between ${job.shiftWindow[0]}:00 and ${job.shiftWindow[1]}:00.`);
  requireAwake(p, Math.round(job.energyCost * 0.6), "work a shift");
  // Tired, hungry, smelly or miserable people don't do their best work.
  const performance = clamp(0.75 + p.energy / 400 + p.health / 400 + p.hunger / 800 + (p.hygiene - 50) / 1500 + moodFor(ctx.db, p).score / 100, 0.72, 1.15);
  const pay = minor(rankPay(job.pay, p.job_rank) * performance);
  advance(ctx, p, job.hours * 60, fb, { quiet: true });
  let money: Change[] = [];
  if (job.salaried) {
    p.payroll_accrued += pay;
  } else {
    money = credit(ctx, p, "cash", pay, "wages", `${job.title} shift at ${place.name}`);
  }
  p.job_shifts += 1;
  p.shifts_total += 1;
  const title = `${RANK_TITLES[p.job_rank] ? RANK_TITLES[p.job_rank] + " " : ""}${job.title}`;
  applyEffects(
    p,
    { energy: -job.energyCost, hunger: -job.hours * 1.5, ...job.skillGain, reputation: 0.3 },
    fb,
    job.salaried
      ? `Worked a ${job.hours}h shift as ${title}. ${formatMoney(pay)} added to this month's salary (paid on the ${SALARY_DAY}th).`
      : `Worked a ${job.hours}h shift as ${title} and got paid ${formatMoney(pay)} in cash.`,
    job.salaried ? [{ k: "payroll", d: pay }] : money,
  );
  if (performance < 0.85) fb.add("Your supervisor noticed you were tired and hungry. Pay was docked.", [], "bad");
  if (p.job_rank < MAX_RANK && p.job_shifts >= SHIFTS_PER_RANK * (p.job_rank + 1)) {
    p.job_rank += 1;
    applyEffects(p, { reputation: 3, social: 6 }, fb, `🎉 Promoted to ${RANK_TITLES[p.job_rank]} ${job.title}! Pay is now ${formatMoney(minor(rankPay(job.pay, p.job_rank)))} per shift.`);
  }
  return null;
}

function actTalk(ctx: Ctx, p: PlayerRow, a: Action, fb: Feedback) {
  const npc = typeof a.npcId === "string" ? NPC_BY_ID[a.npcId] : undefined;
  if (!npc) throw new GameError("bad_npc", "Who?");
  const topic = a.topic as Topic;
  if (!["chat", "advice", "compliment", "gift", "ask_out", "favour"].includes(topic)) throw new GameError("bad_topic", "Unknown topic");
  const gd = toGameDate(p.game_min);
  const where = npcLocation(npc, gd.weekdayIndex, gd.hour);
  if (!where || PLACE_BY_ID[where].district !== p.district) throw new GameError("not_here", `${npc.name.split(" ")[0]} isn't around right now.`);
  const db = ctx.db;
  const rel = relationship(db, p.id, npc.id);
  const today = gd.day;
  if (rel.last_talk_day !== today) rel.talks_today = 0;
  const first = rel.last_talk_day < 0;
  const seed = `${p.id}:${npc.id}:${p.game_min}:${topic}`;
  const L = npc.lines;
  const tier = tierFor(rel.affinity);
  let reply = "";
  let delta = 0;
  let romance = 0;
  const extra: Change[] = [];
  let social = 4;

  const cold = p.reputation < -15;
  const late = gd.hour >= 22 || gd.hour < 5;
  const tiredNpc = p.energy < 12;
  const repeat = rel.talks_today >= 3;

  switch (topic) {
    case "chat":
      reply = lineFor(L.chat, seed);
      delta = 2 + npc.likes.chat * 1.2;
      break;
    case "advice":
      reply = lineFor(L.advice, seed);
      delta = 1.5 + npc.likes.advice * 1.2;
      applyEffects(p, { business: 0.4, work: 0.3 }, null);
      break;
    case "compliment":
      reply = npc.likes.compliment > 0 ? lineFor(L.complimentLiked, seed) : lineFor(L.complimentDisliked, seed);
      delta = npc.likes.compliment * 1.5 + p.charisma / 40;
      if (npc.romanceable && rel.affinity >= 30) romance = 3 + p.charisma / 25;
      break;
    case "gift": {
      if (rel.last_gift_day === today) throw new GameError("too_much", `You already gave ${npc.name.split(" ")[0]} something today.`);
      extra.push(...chargeStrict(ctx, p, minor(npc.gift.cost), "gift", `Gift for ${npc.name}: ${npc.gift.item}`));
      reply = lineFor(L.gift, seed);
      delta = 9;
      romance = npc.romanceable ? 4 : 0;
      rel.last_gift_day = today;
      pushMemory(rel, p.game_min, `you brought me ${npc.gift.item}`);
      break;
    }
    case "ask_out": {
      if (!npc.romanceable) {
        reply = lineFor(L.no, seed);
        delta = -1;
        break;
      }
      if (rel.partner) throw new GameError("already", `You and ${npc.name.split(" ")[0]} are already together.`);
      if (db.get("SELECT 1 FROM dates WHERE player_id = ? AND npc_id = ? AND status = 'pending'", p.id, npc.id)) throw new GameError("already", "You already have a date planned.");
      const chance = (rel.affinity - 45) / 30 + rel.romance / 60 + p.charisma / 150 + (p.reputation > 10 ? 0.1 : 0);
      if (rel.affinity >= 45 && rand01(`askout:${seed}`) < chance) {
        reply = lineFor(L.yes, seed);
        const placeId = npc.id === "selasi" ? "sunset_shack" : npc.id === "akosua" ? "legon_lounge" : "afro_lounge";
        const hour = npc.id === "selasi" ? 19 : npc.id === "akosua" ? 20 : 21;
        const start = (today + 1) * MINUTES_PER_DAY + hour * 60;
        db.run("INSERT INTO dates (player_id, npc_id, place_id, start_min) VALUES (?, ?, ?, ?)", p.id, npc.id, placeId, start);
        delta = 3;
        romance = 6;
        fb.add(`📅 Date with ${npc.name.split(" ")[0]}: ${toGameDate(start).label} at ${hour}:00, ${PLACE_BY_ID[placeId].name}. It's in your phone.`, [], "goal");
      } else {
        reply = lineFor(L.no, seed);
        delta = -3;
      }
      break;
    }
    case "favour": {
      if (hasUnlock(p, npc.favour.unlock)) throw new GameError("already", `${npc.name.split(" ")[0]} already helped you with that.`);
      if (rel.affinity >= npc.favour.threshold && !cold) {
        reply = L.favourYes;
        addToList(p, "unlocks", npc.favour.unlock);
        if (npc.favour.unlock === "nii_blessing") applyEffects(p, { reputation: 15 }, null);
        pushMemory(rel, p.game_min, `I helped you when you asked: "${npc.favour.ask}"`);
        fb.add(`🤝 ${npc.name.split(" ")[0]} helped you: ${npc.favour.reward}`, [], "goal");
        delta = 2;
      } else {
        reply = L.favourNo;
        delta = -1;
      }
      break;
    }
  }

  if (cold) {
    reply = L.coldRep;
    delta = Math.min(delta, 0.5);
    social = 1;
  } else if (late && topic === "chat") {
    reply = L.late;
    delta = Math.min(delta, 1);
  } else if (tiredNpc && topic === "chat") {
    reply = `${L.tired} ${reply}`;
  }
  if (repeat && topic !== "gift") {
    delta = delta > 0 ? delta * 0.2 - 1 : delta - 1;
    reply = `${reply} (${npc.name.split(" ")[0]} seems a bit talked-out today.)`;
  }
  const memories = JSON.parse(rel.memories) as { text: string }[];
  let memoryLine = "";
  if (memories.length && !cold && rand01(`mem:${seed}`) < 0.4) {
    memoryLine = lineFor(L.memory, seed).replace("{memory}", memories[Math.floor(rand01(`memi:${seed}`) * memories.length)].text);
  }
  const greet = first ? lineFor(L.greet.stranger, seed) : lineFor(L.greet[tier], seed);
  rel.affinity = clamp(rel.affinity + delta, -100, 100);
  rel.romance = clamp(rel.romance + romance, 0, 100);
  rel.talks_today += 1;
  rel.last_talk_day = today;
  rel.last_topic = topic;
  if (first) pushMemory(rel, p.game_min, `we first met at ${PLACE_BY_ID[where].name}`);
  saveRel(db, p.id, rel);
  const newTier = tierFor(rel.affinity);
  advance(ctx, p, topic === "chat" || topic === "advice" ? 15 : 8, fb, { quiet: true });
  const changes = applyEffects(p, { social, charisma: 0.3 }, null);
  fb.add(`Talked with ${npc.name}`, [...extra, { k: `rel:${npc.id}`, d: round1(delta) }, ...changes], delta >= 0 ? "good" : "bad");
  if (newTier !== tier && !first) fb.add(`${npc.name.split(" ")[0]} now sees you as ${newTier === "close" ? "a close friend" : `a${newTier === "acquaintance" ? "n" : ""} ${newTier}`}.`, [], "goal");
  return { npcId: npc.id, greet, reply, memory: memoryLine, tier: newTier, affinity: round1(rel.affinity) };
}

function actDateAttend(ctx: Ctx, p: PlayerRow, a: Action, fb: Feedback) {
  const d = ctx.db.get<{ id: number; npc_id: string; place_id: string; start_min: number; status: string }>(
    "SELECT * FROM dates WHERE id = ? AND player_id = ?", Number(a.dateId), p.id,
  );
  if (!d || d.status !== "pending") throw new GameError("bad_date", "No such date");
  const place = PLACE_BY_ID[d.place_id];
  requireDistrict(p, place.district, place.name);
  if (p.game_min < d.start_min - 30) throw new GameError("early", "You're early. Come back closer to the time.");
  if (p.game_min > d.start_min + 180) throw new GameError("late", "Too late. They've gone home.");
  const npc = NPC_BY_ID[d.npc_id];
  const money = chargeStrict(ctx, p, minor(priceFor(150, place.district)), "date", `Date with ${npc.name} at ${place.name}`);
  advance(ctx, p, 150, fb, { quiet: true });
  ctx.db.run("UPDATE dates SET status = 'attended' WHERE id = ?", d.id);
  const rel = relationship(ctx.db, p.id, npc.id);
  rel.affinity = clamp(rel.affinity + 10, -100, 100);
  rel.romance = clamp(rel.romance + 22, 0, 100);
  rel.dates_done += 1;
  pushMemory(rel, p.game_min, `we had a beautiful evening at ${place.name}`);
  let becamePartner = false;
  if (rel.dates_done >= 2 && rel.romance >= 50 && !isPartnered(ctx.db, p.id)) {
    rel.partner = 1;
    becamePartner = true;
  }
  saveRel(ctx.db, p.id, rel);
  applyEffects(p, { social: 22, energy: -10, hunger: 30 }, fb, `A lovely evening with ${npc.name.split(" ")[0]} at ${place.name}.`, [...money, { k: `rel:${npc.id}`, d: 10 }]);
  if (becamePartner) fb.add(`❤️ You and ${npc.name.split(" ")[0]} are now together.`, [], "goal");
  return null;
}

function bankFee(p: PlayerRow, a: Action, amount: number): number {
  const place = typeof a.placeId === "string" ? PLACE_BY_ID[a.placeId] : undefined;
  const atBank = place && place.kind === "bank" && place.district === p.district && isOpenAt(place.open, toGameDate(p.game_min).hour);
  return atBank ? 0 : Math.max(50, Math.round(amount * 0.005));
}

function actDeposit(ctx: Ctx, p: PlayerRow, a: Action, fb: Feedback, dir: 1 | -1) {
  const amount = requireAmount(a.amount);
  const fee = bankFee(p, a, amount);
  const legs: Leg[] = dir === 1
    ? [{ account: "cash", amount: -(amount + fee) }, { account: "bank", amount }]
    : [{ account: "bank", amount: -(amount + fee) }, { account: "cash", amount }];
  post(ctx.db, p.id, legs, { kind: dir === 1 ? "deposit" : "withdrawal", memo: `${dir === 1 ? "Deposit" : "Withdrawal"}${fee ? " via mobile money agent" : " at the bank"}`, gameMin: p.game_min, nowMs: ctx.now() });
  fb.add(`${dir === 1 ? "Deposited" : "Withdrew"} ${formatMoney(amount)}${fee ? ` (MoMo fee ${formatMoney(fee)})` : ""}.`, legs.map((l) => ({ k: l.account, d: l.amount })), "info");
  return null;
}

function actFx(ctx: Ctx, p: PlayerRow, a: Action, fb: Feedback, side: "buy" | "sell") {
  const usd = requireAmount(a.usd, "dollar amount");
  const day = dayOf(p.game_min);
  let legs: Leg[];
  if (side === "buy") {
    const ghs = Math.ceil(usd * fxBuy(day));
    legs = [{ account: "bank", amount: -ghs }, { account: "usd", amount: usd }];
  } else {
    const ghs = Math.floor(usd * fxSell(day));
    legs = [{ account: "usd", amount: -usd }, { account: "bank", amount: ghs }];
  }
  post(ctx.db, p.id, legs, { kind: `fx_${side}`, memo: `${side === "buy" ? "Bought" : "Sold"} $${(usd / 100).toFixed(2)} at ${(side === "buy" ? fxBuy(day) : fxSell(day)).toFixed(3)}`, gameMin: p.game_min, nowMs: ctx.now() });
  fb.add(`${side === "buy" ? "Bought" : "Sold"} ${formatMoney(usd, "USD")}.`, legs.map((l) => ({ k: l.account, d: l.amount })), "info");
  return null;
}

function actTbill(ctx: Ctx, p: PlayerRow, a: Action, fb: Feedback) {
  const product = typeof a.product === "string" ? TBILLS[a.product] : undefined;
  if (!product) throw new GameError("bad_product", "Unknown treasury bill");
  const amount = requireAmount(a.amount);
  if (amount < minor(product.min)) throw new GameError("too_small", `Minimum is ${formatMoney(minor(product.min))}`);
  const payout = amount + Math.floor((amount * product.rate * product.days) / 365);
  const matures = p.game_min + product.days * MINUTES_PER_DAY;
  post(ctx.db, p.id, [{ account: "bank", amount: -amount }, { account: "tbill", amount }], { kind: "tbill_buy", memo: `${product.name} at ${(product.rate * 100).toFixed(1)}%`, gameMin: p.game_min, nowMs: ctx.now() });
  ctx.db.run("INSERT INTO tbills (player_id, product, principal, payout, bought_min, matures_min) VALUES (?, ?, ?, ?, ?, ?)", p.id, product.id, amount, payout, p.game_min, matures);
  p.tbills_bought += 1;
  fb.add(`Bought a ${product.name}: ${formatMoney(amount)} → ${formatMoney(payout)} on ${toGameDate(matures).label}.`, [{ k: "bank", d: -amount }, { k: "tbill", d: amount }], "good");
  return null;
}

export function monthlyIncomeEstimate(db: Db, p: PlayerRow): number {
  let total = 0;
  if (p.job_id) {
    const j = JOBS[p.job_id];
    total += minor(rankPay(j.pay, p.job_rank)) * (j.weekdaysOnly ? 21 : 24);
  }
  for (const b of db.all<{ history: string }>("SELECT history FROM businesses WHERE player_id = ?", p.id)) {
    const h = JSON.parse(b.history) as number[];
    if (h.length) total += Math.round((h.reduce((s, x) => s + x, 0) / h.length) * 30);
  }
  for (const b of db.all<BuildingRow & { price: number }>("SELECT b.*, pl.price FROM buildings b JOIN plots pl ON pl.id = b.plot_id WHERE b.player_id = ? AND b.status = 'complete' AND b.use = 'rent'", p.id)) {
    total += minor(builtValue(b.price / 100, b.design, b.quality as Quality) * DESIGNS[b.design].rentYield);
  }
  return total;
}

function actLoanTake(ctx: Ctx, p: PlayerRow, a: Action, fb: Feedback) {
  const amount = requireAmount(a.amount);
  if (p.credit_score < 450) throw new GameError("credit", "The bank declined: your credit score is too low.");
  const owed = balance(ctx.db, p.id, "loan");
  const limit = loanLimit(monthlyIncomeEstimate(ctx.db, p), netWorth(ctx.db, p).total);
  if (owed + amount > limit) throw new GameError("limit", `Your limit is ${formatMoney(limit)} (you owe ${formatMoney(owed)}).`);
  const fee = Math.round(amount * 0.01);
  post(ctx.db, p.id, [{ account: "bank", amount: amount - fee }, { account: "loan", amount }], { kind: "loan", memo: `Loan drawn (1% arrangement fee ${formatMoney(fee)})`, gameMin: p.game_min, nowMs: ctx.now() });
  fb.add(`Borrowed ${formatMoney(amount)} at ${((LOAN_RATE - (hasUnlock(p, "akosua_rate") ? 0.02 : 0)) * 100).toFixed(0)}% a year. ${formatMoney(amount - fee)} received after the fee.`, [{ k: "bank", d: amount - fee }, { k: "loan", d: amount }], "info");
  return null;
}

function actLoanRepay(ctx: Ctx, p: PlayerRow, a: Action, fb: Feedback) {
  const owed = balance(ctx.db, p.id, "loan");
  if (owed <= 0) throw new GameError("no_loan", "You don't owe anything");
  const amount = Math.min(requireAmount(a.amount), owed);
  post(ctx.db, p.id, [{ account: "bank", amount: -amount }, { account: "loan", amount: -amount }], { kind: "loan_repayment", memo: "Loan repayment", gameMin: p.game_min, nowMs: ctx.now() });
  if (amount === owed) p.credit_score = clamp(p.credit_score + 25, 300, 850);
  fb.add(`Repaid ${formatMoney(amount)}${amount === owed ? " — loan cleared!" : ""}`, [{ k: "bank", d: -amount }, { k: "loan", d: -amount }], "good");
  return null;
}

function actPayArrears(ctx: Ctx, p: PlayerRow, fb: Feedback) {
  if (p.rent_arrears <= 0) throw new GameError("none", "No arrears");
  const amount = p.rent_arrears;
  const money = chargeStrict(ctx, p, amount, "rent", "Rent arrears", true);
  p.rent_arrears = 0;
  applyEffects(p, { reputation: 2 }, fb, `Cleared ${formatMoney(amount)} of rent arrears.`, money);
  return null;
}

function actRentMove(ctx: Ctx, p: PlayerRow, a: Action, fb: Feedback) {
  const r = typeof a.rentalId === "string" ? RENTALS[a.rentalId] : undefined;
  if (!r) throw new GameError("bad_rental", "Unknown rental");
  if (p.home_kind === "rental" && p.home_ref === r.id) throw new GameError("already", "You already live here");
  requireVisited(p, r.district);
  if (r.requiresRep && p.reputation < r.requiresRep) throw new GameError("reputation", `The landlord wants references. You need ${r.requiresRep} standing.`);
  if (p.rent_arrears > 0) throw new GameError("arrears", "Clear your rent arrears first. Landlords talk.");
  const months = Math.max(1, r.deposit);
  const cost = minor(r.rent * months);
  const money = chargeStrict(ctx, p, cost, "rent", `Rent advance (${months} months): ${r.name}`, true);
  if (p.home_kind === "owned") ctx.db.run("UPDATE buildings SET use = 'vacant' WHERE id = ?", Number(p.home_ref));
  p.home_kind = "rental";
  p.home_ref = r.id;
  p.rent_credit = months - 1; // this month is covered by the first month of the advance
  applyEffects(p, { social: 6, reputation: r.comfort >= 3 ? 2 : 0 }, fb, `Moved into ${r.name}. Paid ${months} month${months > 1 ? "s" : ""} advance.`, money);
  return null;
}

function actPlotBuy(ctx: Ctx, p: PlayerRow, a: Action, fb: Feedback) {
  const plot = typeof a.plotId === "string" ? PLOTS[a.plotId] : undefined;
  if (!plot) throw new GameError("bad_plot", "Unknown plot");
  requireVisited(p, plot.district);
  if (plot.requiresRep && p.reputation < plot.requiresRep) throw new GameError("reputation", `The family won't sell to you yet. You need ${plot.requiresRep} standing.`);
  if (plot.requiresUnlock && !hasUnlock(p, plot.requiresUnlock)) throw new GameError("locked", "This land is family land. You'll need an elder to speak for you.");
  if (ctx.db.get("SELECT 1 FROM plots WHERE player_id = ? AND plot_type = ?", p.id, plot.id)) throw new GameError("already", "You already own this plot");
  const price = minor(plot.price * (hasUnlock(p, "yaa_discount") ? 0.9 : 1));
  const money = chargeStrict(ctx, p, price, "land", `Land: ${plot.name}`, true);
  const ins = ctx.db.run("INSERT INTO plots (player_id, plot_type, price, bought_min) VALUES (?, ?, ?, ?)", p.id, plot.id, price, p.game_min);
  if (plot.ready) {
    // Turnkey homes: the building comes finished. Its value is part of the price, so the land row carries a fair share.
    const stages = stagePlan(plot.ready.design, plot.ready.quality).length;
    const buildShare = Math.min(price * 0.7, minor(DESIGNS[plot.ready.design].baseCost * QUALITY[plot.ready.quality].cost));
    ctx.db.run("UPDATE plots SET price = ? WHERE id = ?", price - Math.round(buildShare), ins.lastInsertRowid);
    ctx.db.run("INSERT INTO buildings (player_id, plot_id, design, quality, stage, status, spent, completed_min) VALUES (?, ?, ?, ?, ?, 'complete', ?, ?)",
      p.id, ins.lastInsertRowid, plot.ready.design, plot.ready.quality, stages, Math.round(buildShare), p.game_min);
  }
  rememberAcrossDistrict(ctx.db, p, plot.district, `you bought land here in ${DISTRICTS[plot.district].name}`);
  applyEffects(p, { reputation: 3, social: 5 }, fb, `You bought ${plot.name}. The indenture is registered in your name.`, money);
  return null;
}

function ownedPlot(ctx: Ctx, p: PlayerRow, plotRowId: unknown) {
  const row = ctx.db.get<{ id: number; plot_type: string; price: number }>("SELECT * FROM plots WHERE id = ? AND player_id = ?", Number(plotRowId), p.id);
  if (!row) throw new GameError("bad_plot", "You don't own that plot");
  return row;
}

function ownedBuilding(ctx: Ctx, p: PlayerRow, id: unknown) {
  const b = ctx.db.get<BuildingRow>("SELECT * FROM buildings WHERE id = ? AND player_id = ?", Number(id), p.id);
  if (!b) throw new GameError("bad_building", "You don't own that building");
  return b;
}

function actBuildStart(ctx: Ctx, p: PlayerRow, a: Action, fb: Feedback) {
  const plot = ownedPlot(ctx, p, a.plotId);
  const def = PLOTS[plot.plot_type];
  const design = typeof a.design === "string" ? DESIGNS[a.design] : undefined;
  if (!design || !def.allowed.includes(design.id)) throw new GameError("bad_design", "That design isn't allowed on this plot");
  const quality = a.quality as Quality;
  if (!QUALITY_ORDER.includes(quality)) throw new GameError("bad_quality", "Unknown quality");
  if (ctx.db.get("SELECT 1 FROM buildings WHERE plot_id = ?", plot.id)) throw new GameError("already", "There's already a building on this plot");
  const r = ctx.db.run("INSERT INTO buildings (player_id, plot_id, design, quality, stage, status) VALUES (?, ?, ?, ?, 0, 'awaiting_payment')", p.id, plot.id, design.id, quality);
  payStage(ctx, p, r.lastInsertRowid, fb);
  return { buildingId: r.lastInsertRowid };
}

function payStage(ctx: Ctx, p: PlayerRow, buildingId: number, fb: Feedback) {
  const b = ownedBuilding(ctx, p, buildingId);
  if (b.status !== "awaiting_payment") throw new GameError("not_ready", b.status === "building" ? "Workers are still on the current stage" : "Nothing to pay for");
  const plan = stagePlan(b.design, b.quality as Quality);
  const stage = plan[b.stage];
  const cost = minor(stage.cost);
  const money = chargeStrict(ctx, p, cost, "construction", `${DESIGNS[b.design].name}: ${stage.name}`, true);
  const ends = p.game_min + stage.days * MINUTES_PER_DAY;
  // Guarded update: only one payment can move a stage from awaiting to building.
  const upd = ctx.db.run("UPDATE buildings SET status='building', stage_started_min=?, stage_ends_min=?, spent=spent+? WHERE id=? AND status='awaiting_payment' AND stage=?", p.game_min, ends, cost, b.id, b.stage);
  if (upd.changes !== 1) throw new GameError("conflict", "That stage was already paid");
  fb.add(`🏗️ ${stage.name} started on your ${DESIGNS[b.design].name}. Done ${toGameDate(ends).label} at ${toGameDate(ends).clock}.`, money, "info");
}

function actBuildPayStage(ctx: Ctx, p: PlayerRow, a: Action, fb: Feedback) {
  payStage(ctx, p, Number(a.buildingId), fb);
  return null;
}

function actBuildingUpgrade(ctx: Ctx, p: PlayerRow, a: Action, fb: Feedback) {
  const b = ownedBuilding(ctx, p, a.buildingId);
  if (b.status !== "complete") throw new GameError("not_ready", "Finish construction first");
  const up = upgradeCost(b.design, b.quality as Quality);
  if (!up) throw new GameError("max", "Already premium quality");
  const money = chargeStrict(ctx, p, minor(up.cost), "construction", `Upgrade ${DESIGNS[b.design].name} to ${QUALITY[up.to].label}`, true);
  const ends = p.game_min + up.days * MINUTES_PER_DAY;
  const upd = ctx.db.run("UPDATE buildings SET status='upgrading', upgrade_to=?, stage_started_min=?, stage_ends_min=?, spent=spent+? WHERE id=? AND status='complete'", up.to, p.game_min, ends, minor(up.cost), b.id);
  if (upd.changes !== 1) throw new GameError("conflict", "Upgrade already in progress");
  fb.add(`🛠️ Upgrading to ${QUALITY[up.to].label}. Ready ${toGameDate(ends).label}.`, money, "info");
  return null;
}

function actBuildingUse(ctx: Ctx, p: PlayerRow, a: Action, fb: Feedback) {
  const b = ownedBuilding(ctx, p, a.buildingId);
  const use = a.use as BuildingRow["use"];
  if (!["live", "rent", "vacant"].includes(use)) throw new GameError("bad_use", "Unknown use");
  if (b.status !== "complete") throw new GameError("not_ready", "Not finished yet");
  const design = DESIGNS[b.design];
  if (use === "live") {
    if (design.kind !== "home") throw new GameError("bad_use", "You can't live in a shop block");
    if (p.home_kind === "owned" && Number(p.home_ref) !== b.id) ctx.db.run("UPDATE buildings SET use='vacant' WHERE id=?", Number(p.home_ref));
    p.home_kind = "owned";
    p.home_ref = String(b.id);
    p.rent_credit = 0;
    const plot = ctx.db.get<{ plot_type: string }>("SELECT plot_type FROM plots WHERE id = ?", b.plot_id)!;
    applyEffects(p, { social: 15, reputation: 5, health: 5 }, fb, `🏡 You moved into your own ${design.name} in ${DISTRICTS[PLOTS[plot.plot_type].district].name}. No more rent!`);
  } else {
    if (p.home_kind === "owned" && Number(p.home_ref) === b.id) throw new GameError("live_here", "You live here. Move somewhere else first.");
    fb.add(use === "rent" ? `Tenants are moving into your ${design.name}. Rent goes to your bank daily.` : `Your ${design.name} is now vacant.`, [], "info");
  }
  ctx.db.run("UPDATE buildings SET use = ? WHERE id = ?", use, b.id);
  return null;
}

function actBizBuy(ctx: Ctx, p: PlayerRow, a: Action, fb: Feedback) {
  const t = typeof a.bizType === "string" ? BUSINESSES[a.bizType] : undefined;
  if (!t) throw new GameError("bad_business", "Unknown business");
  requireVisited(p, t.district);
  if (t.requiresRep && p.reputation < t.requiresRep) throw new GameError("reputation", `The seller wants someone respected. You need ${t.requiresRep} standing.`);
  if (t.requiresUnlock && !hasUnlock(p, t.requiresUnlock)) throw new GameError("locked", t.requiresUnlock.startsWith("cert_") ? "You need the trade certificate first. Ask at the schools and workshops." : "Not available to you yet.");
  if (ctx.db.get("SELECT 1 FROM businesses WHERE player_id = ? AND type = ?", p.id, t.id)) throw new GameError("already", "You already own one of these");
  const money = chargeStrict(ctx, p, minor(t.price), "business_buy", `Bought ${t.name}`, true);
  const r = ctx.db.run("INSERT INTO businesses (player_id, type, bought_min, last_visit_day) VALUES (?, ?, ?, ?)", p.id, t.id, p.game_min, dayOf(p.game_min));
  ensureAccount(ctx.db, p.id, `biz:${r.lastInsertRowid}`);
  rememberAcrossDistrict(ctx.db, p, t.district, `you took over the ${t.name.toLowerCase()} here`);
  applyEffects(p, { reputation: 4, business: 2, social: 4 }, fb, `You're the new owner of a ${t.name} in ${DISTRICTS[t.district].name}. Profits land in its till each morning.`, money);
  return { businessId: r.lastInsertRowid };
}

function ownedBiz(ctx: Ctx, p: PlayerRow, id: unknown) {
  const b = ctx.db.get<BusinessRow>("SELECT * FROM businesses WHERE id = ? AND player_id = ?", Number(id), p.id);
  if (!b) throw new GameError("bad_business", "You don't own that business");
  return b;
}

function actBizUpgrade(ctx: Ctx, p: PlayerRow, a: Action, fb: Feedback) {
  const b = ownedBiz(ctx, p, a.businessId);
  const t = BUSINESSES[b.type];
  if (b.level >= MAX_BUSINESS_LEVEL) throw new GameError("max", "Already at the top level");
  if (b.upgrading_until !== null) throw new GameError("busy", "Renovation already under way");
  const cost = minor(businessUpgradeCost(t.price, b.level));
  const money = chargeStrict(ctx, p, cost, "business_upgrade", `${t.name} upgrade to level ${b.level + 1}`, true);
  const ends = p.game_min + BUSINESS_UPGRADE_DAYS * MINUTES_PER_DAY;
  const upd = ctx.db.run("UPDATE businesses SET upgrading_until = ? WHERE id = ? AND upgrading_until IS NULL AND level = ?", ends, b.id, b.level);
  if (upd.changes !== 1) throw new GameError("conflict", "Upgrade already started");
  applyEffects(p, { business: 1.5 }, fb, `Renovating your ${t.name} to level ${b.level + 1}. Half capacity until ${toGameDate(ends).label}.`, money);
  return null;
}

function actBizCollect(ctx: Ctx, p: PlayerRow, a: Action, fb: Feedback) {
  const rows = a.businessId === "all"
    ? ctx.db.all<BusinessRow>("SELECT * FROM businesses WHERE player_id = ?", p.id)
    : [ownedBiz(ctx, p, a.businessId)];
  let total = 0;
  for (const b of rows) {
    const till = balance(ctx.db, p.id, `biz:${b.id}`);
    if (till <= 0) continue;
    post(ctx.db, p.id, [{ account: `biz:${b.id}`, amount: -till }, { account: "bank", amount: till }], { kind: "business_collect", memo: `Collected from ${BUSINESSES[b.type].name}`, gameMin: p.game_min, nowMs: ctx.now() });
    total += till;
  }
  if (!total) throw new GameError("empty", "Nothing to collect. Tills are empty or in the red.");
  fb.add(`Moved ${formatMoney(total)} of business profit into your bank.`, [{ k: "bank", d: total }], "good");
  return null;
}

function actBizSell(ctx: Ctx, p: PlayerRow, a: Action, fb: Feedback) {
  const b = ownedBiz(ctx, p, a.businessId);
  const t = BUSINESSES[b.type];
  const price = Math.round(minor(businessValue(t.price, b.level)) * 0.85);
  const till = balance(ctx.db, p.id, `biz:${b.id}`);
  post(ctx.db, p.id, [{ account: "bank", amount: price + till }, { account: `biz:${b.id}`, amount: -till }], { kind: "business_sell", memo: `Sold ${t.name}`, gameMin: p.game_min, nowMs: ctx.now() });
  ctx.db.run("DELETE FROM businesses WHERE id = ?", b.id);
  fb.add(`Sold your ${t.name} for ${formatMoney(price)}${till ? ` (till settled: ${formatMoney(till)})` : ""}.`, [{ k: "bank", d: price + till }], "info");
  return null;
}

/** Your best personal vehicle for city driving (not on work-and-pay). */
function drivable(db: Db, p: PlayerRow) {
  const vs = db.all<{ type: string }>("SELECT type FROM vehicles WHERE player_id = ? AND status = 'personal'", p.id).map((v) => VEHICLES[v.type]).filter((v) => v && v.category !== "bicycle" && v.category !== "aircraft");
  vs.sort((x, y) => (hasUnlock(p, y.licence ?? "") ? 1 : 0) - (hasUnlock(p, x.licence ?? "") ? 1 : 0) || y.speedKmh - x.speedKmh);
  return vs[0] ?? null;
}

function actVehicleBuy(ctx: Ctx, p: PlayerRow, a: Action, fb: Feedback) {
  const v = typeof a.vehicleId === "string" ? VEHICLES[a.vehicleId] : undefined;
  if (!v) throw new GameError("bad_vehicle", "Unknown vehicle");
  const place = requirePlace(p, a.placeId);
  if (!(DEALER_STOCK[place.id] ?? []).includes(v.id)) throw new GameError("not_stocked", `${place.name} doesn't sell that.`);
  if (v.requiresRep && p.reputation < v.requiresRep) throw new GameError("reputation", `The dealer only sells this to established clients (${v.requiresRep} standing).`);
  if (v.category === "aircraft" && !ctx.db.get("SELECT 1 FROM buildings WHERE player_id = ? AND design = 'hangar' AND status IN ('complete','upgrading')", p.id)) {
    throw new GameError("no_hangar", "You need a hangar first. The General Aviation office next door has one for sale.");
  }
  const count = ctx.db.get<{ n: number }>("SELECT COUNT(*) AS n FROM vehicles WHERE player_id = ? AND type = ?", p.id, v.id)!.n;
  if (count >= (v.workPay ? 5 : 1)) throw new GameError("already", v.workPay ? "Five is the most you can manage. Even fleet owners sleep." : "You already own one");
  const discount = place.id === "tamale_motors" && hasUnlock(p, "abu_moto") ? 0.85 : 1;
  const money = chargeStrict(ctx, p, minor(v.price * discount), "vehicle", `Bought ${v.name}${discount < 1 ? " (Alhaji's price)" : ""}`, true);
  ctx.db.run("INSERT INTO vehicles (player_id, type, price, bought_min) VALUES (?, ?, ?, ?)", p.id, v.id, minor(v.price), p.game_min);
  const icon = v.category === "aircraft" ? "🛩️" : v.category === "bicycle" ? "🚲" : v.category === "motorbike" ? "🏍️" : v.category === "tricycle" ? "🛺" : v.category === "luxury" ? "🏎️" : "🚗";
  applyEffects(p, { reputation: v.reputation, social: v.category === "luxury" ? 16 : 8 }, fb, `${icon} You rode the ${v.name} out of ${place.name}.${v.licence && !hasUnlock(p, v.licence) ? " (You'll need a licence before you can drive it.)" : ""}`, money);
  return null;
}

function ownedVehicle(ctx: Ctx, p: PlayerRow, id: unknown) {
  const row = ctx.db.get<{ id: number; type: string; price: number; bought_min: number; status: string; condition: number }>("SELECT * FROM vehicles WHERE id = ? AND player_id = ?", Number(id), p.id);
  if (!row) throw new GameError("bad_vehicle", "You don't own that vehicle");
  return row;
}
const vehicleValue = (v: { price: number; bought_min: number; condition: number }, now: number) => {
  const months = (now - v.bought_min) / (30 * MINUTES_PER_DAY);
  return Math.round(v.price * Math.max(0.35, 1 - VEHICLE_DEPRECIATION_PER_MONTH * months) * (0.6 + 0.4 * v.condition / 100));
};

function actVehicleSell(ctx: Ctx, p: PlayerRow, a: Action, fb: Feedback) {
  const v = ownedVehicle(ctx, p, a.vehicleRowId);
  const value = Math.round(vehicleValue(v, p.game_min) * 0.85);
  ctx.db.run("DELETE FROM vehicles WHERE id = ?", v.id);
  const money = credit(ctx, p, "bank", value, "vehicle_sale", `Sold ${VEHICLES[v.type].name}`, `vsell:${v.id}`);
  fb.add(`You sold the ${VEHICLES[v.type].name} for ${formatMoney(value)}.`, money, "info");
  return null;
}

function actVehicleWorkPay(ctx: Ctx, p: PlayerRow, a: Action, fb: Feedback) {
  const v = ownedVehicle(ctx, p, a.vehicleRowId);
  const def = VEHICLES[v.type];
  if (!def.workPay) throw new GameError("not_commercial", "Nobody does work-and-pay with that.");
  const on = a.on === true;
  ctx.db.run("UPDATE vehicles SET status = ? WHERE id = ?", on ? "workpay" : "personal", v.id);
  fb.add(on ? `🤝 You handed the ${def.name} to a driver on work-and-pay: ${formatMoney(minor(def.workPay))} a day into your account, if all goes well.` : `You took the ${def.name} back from the driver.`, [], "info");
  return null;
}

// ---------------------------------------------------------------------------
// Shopping, furnishing and cooking

function ownedItems(db: Db, p: PlayerRow) {
  return db.all<{ id: number; item_id: string; price: number; bought_min: number }>("SELECT * FROM items WHERE player_id = ? ORDER BY id", p.id);
}

function actShopBuy(ctx: Ctx, p: PlayerRow, a: Action, fb: Feedback) {
  const place = requirePlace(p, a.placeId);
  const it = typeof a.itemId === "string" ? ITEMS[a.itemId] : undefined;
  if (!it || !stockFor(place.id, place.kind).includes(it.id)) throw new GameError("not_stocked", `${place.name} doesn't sell that.`);
  const n = ctx.db.get<{ n: number }>("SELECT COUNT(*) AS n FROM items WHERE player_id = ? AND item_id = ?", p.id, it.id)!.n;
  if (it.comfort && n >= 1 && it.slot !== "decor") throw new GameError("already", "You already have one at home.");
  if (n >= 3) throw new GameError("already", "You have plenty of those.");
  const kenteDeal = place.id === "kejetia_market" && hasUnlock(p, "kente_discount") && it.slot === "craft" ? 0.8 : 1;
  const price = minor(priceFor(it.price, place.district) * kenteDeal);
  const money = chargeStrict(ctx, p, price, "shopping", `${it.name} from ${place.name}`, price > minor(2_000));
  ctx.db.run("INSERT INTO items (player_id, item_id, price, bought_min) VALUES (?, ?, ?, ?)", p.id, it.id, price, p.game_min);
  advance(ctx, p, 30, fb, { quiet: true });
  const firstOfKind = n === 0;
  applyEffects(p, firstOfKind ? { social: 2, ...(it.effects ?? {}) } : {}, fb, `🛍️ Bought ${it.name} at ${place.name}.${it.comfort ? " Delivered to your home." : ""}`, money);
  return null;
}

function actItemSell(ctx: Ctx, p: PlayerRow, a: Action, fb: Feedback) {
  const row = ctx.db.get<{ id: number; item_id: string; price: number }>("SELECT * FROM items WHERE id = ? AND player_id = ?", Number(a.itemRowId), p.id);
  if (!row) throw new GameError("bad_item", "You don't own that");
  const value = Math.round(row.price * 0.4);
  ctx.db.run("DELETE FROM items WHERE id = ?", row.id);
  const money = credit(ctx, p, "cash", value, "item_sale", `Sold ${ITEMS[row.item_id].name} (second-hand)`, `isell:${row.id}`);
  fb.add(`Sold your ${ITEMS[row.item_id].name} to a second-hand buyer for ${formatMoney(value)}.`, money, "info");
  return null;
}

export function homeSpecFor(db: Db, p: PlayerRow) {
  let ref = p.home_ref;
  if (p.home_kind === "owned") ref = db.get<{ design: string }>("SELECT design FROM buildings WHERE id = ?", Number(p.home_ref))?.design ?? "bungalow";
  return HOME_SPECS[tierForHome(p.home_kind, ref)];
}

function actHomeActivity(ctx: Ctx, p: PlayerRow, a: Action, fb: Feedback) {
  if (p.district !== homeDistrict(ctx.db, p)) throw new GameError("wrong_place", "You're not at home.");
  const act = HOME_ACTIVITIES.find((x) => x.id === a.activity);
  if (!act) throw new GameError("bad_activity", "Unknown activity");
  const spec = homeSpecFor(ctx.db, p);
  const items = ownedItems(ctx.db, p).map((i) => i.item_id);
  if (!act.when(spec, items)) throw new GameError("not_here", `You can't do that in a ${spec.label.toLowerCase()}.`);
  if ((act.effects.energy ?? 0) < -5) requireAwake(p, 10, act.verb.toLowerCase());
  const money = act.cost ? chargeStrict(ctx, p, minor(act.cost), "spend", act.label) : [];
  advance(ctx, p, act.minutes, fb, { quiet: true });
  applyEffects(p, act.effects, fb, `${act.label}. ${act.note(spec)}`, money);
  return null;
}

function actCook(ctx: Ctx, p: PlayerRow, fb: Feedback) {
  if (p.district !== homeDistrict(ctx.db, p)) throw new GameError("wrong_place", "You can only cook at home.");
  const items = ownedItems(ctx.db, p).map((i) => i.item_id);
  if (!items.some((i) => ITEMS[i]?.slot === "kitchen" && (i === "gas_cooker" || i === "standing_cooker"))) throw new GameError("no_kitchen", "You need a gas cooker. Melcom sells them.");
  requireAwake(p, 8, "cook");
  const cost = minor(priceFor(14, p.district));
  const money = chargeStrict(ctx, p, cost, "spend", "Ingredients from the market");
  advance(ctx, p, 60, fb, { quiet: true });
  const fridge = items.some((i) => ITEMS[i]?.slot === "fridge");
  applyEffects(p, { hunger: fridge ? 60 : 50, health: 2, energy: -4, social: 2 }, fb, fridge ? "Cooked a proper pot of stew. Leftovers in the fridge for tomorrow." : "Cooked jollof at home. Cheaper and tastier than the chop bar.", money);
  return null;
}

// ---------------------------------------------------------------------------
// Farming

interface FarmRow { id: number; farm_type: string; price: number; bought_min: number; crop: string | null; planted_min: number | null; ready_min: number | null; status: string; harvests: number; total_income: number }

function ownedFarm(ctx: Ctx, p: PlayerRow, id: unknown) {
  const f = ctx.db.get<FarmRow>("SELECT * FROM farms WHERE id = ? AND player_id = ?", Number(id), p.id);
  if (!f) throw new GameError("bad_farm", "You don't own that farm");
  return f;
}

function actFarmBuy(ctx: Ctx, p: PlayerRow, a: Action, fb: Feedback) {
  const land = typeof a.farmId === "string" ? FARMLANDS[a.farmId] : undefined;
  if (!land) throw new GameError("bad_farm", "Unknown farmland");
  requireDistrict(p, land.district, `the land office in ${DISTRICTS[land.district].name}`);
  if (ctx.db.get("SELECT 1 FROM farms WHERE player_id = ? AND farm_type = ?", p.id, land.id)) throw new GameError("already", "You already own this land");
  const money = chargeStrict(ctx, p, minor(land.price), "land", `Farmland: ${land.name}`, true);
  ctx.db.run("INSERT INTO farms (player_id, farm_type, price, bought_min) VALUES (?, ?, ?, ?)", p.id, land.id, minor(land.price), p.game_min);
  rememberAcrossDistrict(ctx.db, p, land.district, "you bought farmland near here");
  applyEffects(p, { reputation: 2, business: 1 }, fb, `🌱 You bought ${land.acres} acres: ${land.name}. The chief's linguist witnessed the drinks.`, money);
  return null;
}

function actFarmPlant(ctx: Ctx, p: PlayerRow, a: Action, fb: Feedback) {
  const f = ownedFarm(ctx, p, a.farmRowId);
  const land = FARMLANDS[f.farm_type];
  requireDistrict(p, land.district, land.name);
  if (f.status !== "fallow") throw new GameError("busy", "The farm already has a crop in.");
  const crop = typeof a.crop === "string" && land.crops.includes(a.crop) ? CROPS[a.crop] : undefined;
  if (!crop) throw new GameError("bad_crop", "That crop doesn't suit this land.");
  const month = toGameDate(p.game_min).month + 1;
  if (crop.months !== "any" && !crop.months.includes(month)) throw new GameError("season", `Wrong season for ${crop.name}. Plant in ${crop.months.map((m) => MONTH_NAMES[m - 1].slice(0, 3)).join(", ")}.`);
  requireAwake(p, 25, "work on the farm");
  const cost = minor(crop.costPerAcre * land.acres);
  const money = chargeStrict(ctx, p, cost, "farm", `${crop.name}: seed, labour and inputs (${land.acres} acres)`, true);
  advance(ctx, p, 240, fb, { quiet: true });
  ctx.db.run("UPDATE farms SET crop = ?, planted_min = ?, ready_min = ?, status = 'growing' WHERE id = ?", crop.id, p.game_min, p.game_min + crop.days * MINUTES_PER_DAY, f.id);
  applyEffects(p, { energy: -22, hunger: -10, fitness: 1, business: 0.5 }, fb, `🌱 Planted ${crop.name} on ${land.acres} acres. Ready in about ${crop.days} days.`, money);
  return null;
}

/** Share of the growing season's days with rain (rain-fed crops need it). */
function seasonRain(fromMin: number, toMin: number) {
  const d0 = dayOf(fromMin), d1 = Math.max(d0 + 1, dayOf(toMin));
  let wet = 0;
  for (let d = d0; d < d1; d++) if (dayWasRainy(d)) wet++;
  return wet / (d1 - d0);
}

export function harvestValue(f: { id: number; farm_type: string; crop: string; planted_min: number; ready_min: number }, p: PlayerRow, now: number) {
  const land = FARMLANDS[f.farm_type];
  const crop = CROPS[f.crop];
  let v = crop.yieldPerAcre * land.acres;
  if (crop.rainFed) v *= clamp(0.55 + seasonRain(f.planted_min, f.ready_min) * 1.3, 0.55, 1.2);
  v *= 0.75 + rand01(`harvest:${f.id}:${f.planted_min}`) * 0.5;
  v *= 1 + Math.min(p.business, 60) / 300;
  if (hasUnlock(p, "agri")) v *= 1.15;
  const lateDays = Math.max(0, dayOf(now) - dayOf(f.ready_min) - FARM_HARVEST_WINDOW_DAYS);
  v *= Math.max(0.4, 1 - lateDays * 0.1);
  return Math.round(minor(v));
}

function actFarmHarvest(ctx: Ctx, p: PlayerRow, a: Action, fb: Feedback) {
  const f = ownedFarm(ctx, p, a.farmRowId);
  const land = FARMLANDS[f.farm_type];
  requireDistrict(p, land.district, land.name);
  if (f.status !== "growing" || f.ready_min === null || f.crop === null || f.planted_min === null) throw new GameError("nothing", "Nothing to harvest.");
  if (p.game_min < f.ready_min) throw new GameError("not_ready", `Not ready yet. Come back ${toGameDate(f.ready_min).label}.`);
  requireAwake(p, 25, "harvest");
  const value = harvestValue({ ...f, crop: f.crop, planted_min: f.planted_min, ready_min: f.ready_min }, p, p.game_min);
  advance(ctx, p, 300, fb, { quiet: true });
  ctx.db.run("UPDATE farms SET status = 'fallow', crop = NULL, planted_min = NULL, ready_min = NULL, harvests = harvests + 1, total_income = total_income + ? WHERE id = ?", value, f.id);
  const money = credit(ctx, p, "cash", value, "harvest", `${CROPS[f.crop].name} harvest from ${land.name}`, `harvest:${f.id}:${f.planted_min}`);
  applyEffects(p, { energy: -24, hunger: -12, fitness: 1, business: 1, reputation: 1 }, fb, `🧺 Harvested ${CROPS[f.crop].name} and sold it to the market queens for ${formatMoney(value)}.`, money);
  return null;
}

// ---------------------------------------------------------------------------
// Schools

interface CourseRow { course_id: string; sessions: number; status: string; enrolled_min: number; last_session_day: number; completed_min: number | null }

function actCourseEnrol(ctx: Ctx, p: PlayerRow, a: Action, fb: Feedback) {
  const c = typeof a.courseId === "string" ? COURSES[a.courseId] : undefined;
  if (!c) throw new GameError("bad_course", "Unknown course");
  const place = requirePlace(p, a.placeId);
  if (!c.places.includes(place.id)) throw new GameError("not_here", `${place.name} doesn't run that course.`);
  const row = ctx.db.get<CourseRow>("SELECT * FROM courses WHERE player_id = ? AND course_id = ?", p.id, c.id);
  if (row) throw new GameError("already", row.status === "done" ? "You already have that certificate." : "You're already enrolled.");
  const money = chargeStrict(ctx, p, minor(c.fee), "education", `Fees: ${c.name}`, true);
  ctx.db.run("INSERT INTO courses (player_id, course_id, enrolled_min) VALUES (?, ?, ?)", p.id, c.id, p.game_min);
  applyEffects(p, { social: 3 }, fb, `🎓 Enrolled: ${c.name}. ${c.sessions} sessions to go (one a day).`, money);
  return null;
}

function actCourseAttend(ctx: Ctx, p: PlayerRow, a: Action, fb: Feedback) {
  const c = typeof a.courseId === "string" ? COURSES[a.courseId] : undefined;
  if (!c) throw new GameError("bad_course", "Unknown course");
  const place = requirePlace(p, a.placeId);
  if (!c.places.includes(place.id)) throw new GameError("not_here", `${place.name} doesn't run that course.`);
  const row = ctx.db.get<CourseRow>("SELECT * FROM courses WHERE player_id = ? AND course_id = ?", p.id, c.id);
  if (!row || row.status !== "enrolled") throw new GameError("not_enrolled", "Enrol first.");
  if (row.last_session_day === dayOf(p.game_min)) throw new GameError("tomorrow", "One session a day. Let it sink in.");
  const hour = toGameDate(p.game_min).hour;
  if (!isOpenAt(c.hours, hour)) throw new GameError("closed", `Classes run ${c.hours[0]}:00–${c.hours[1]}:00.`);
  requireAwake(p, 20, "concentrate in class");
  advance(ctx, p, c.minutes, fb, { quiet: true });
  const sessions = row.sessions + 1;
  const done = sessions >= c.sessions;
  ctx.db.run("UPDATE courses SET sessions = ?, last_session_day = ?, status = ?, completed_min = ? WHERE player_id = ? AND course_id = ?", sessions, dayOf(p.game_min), done ? "done" : "enrolled", done ? p.game_min : null, p.id, c.id);
  applyEffects(p, { energy: -16, hunger: -8, ...c.perSession }, fb, `📚 ${c.name}: session ${sessions}/${c.sessions}.`);
  if (done) {
    if (c.unlock) addToList(p, "unlocks", c.unlock);
    applyEffects(p, { ...c.onComplete, social: 8 }, fb, `🎓 Certificate earned: ${c.name}!${c.unlock === "licence_b" ? " Your DVLA licence card arrives in the post (eventually)." : ""}`);
  }
  return null;
}

// ---------------------------------------------------------------------------
// Social media

interface SocialRow { followers: number; posts: number; posts_today: number; last_post_day: number; promo_day: number; feed: string }
function socialRow(db: Db, p: PlayerRow): SocialRow {
  db.run("INSERT OR IGNORE INTO social (player_id) VALUES (?)", p.id);
  return db.get<SocialRow>("SELECT * FROM social WHERE player_id = ?", p.id)!;
}
function bestCamera(db: Db, p: PlayerRow) {
  return Math.max(-1, ...ownedItems(db, p).map((i) => ITEMS[i.item_id]?.camera ?? -1));
}

function actSocialPost(ctx: Ctx, p: PlayerRow, a: Action, fb: Feedback) {
  const t = POST_TYPES.find((x) => x.id === a.kind);
  if (!t) throw new GameError("bad_post", "Unknown post type");
  const cam = bestCamera(ctx.db, p);
  if (cam < 1) throw new GameError("no_phone", "You need a smartphone to post. Phone shops sell them from GH₵1,400.");
  const s = socialRow(ctx.db, p);
  const day = dayOf(p.game_min);
  const today = s.last_post_day === day ? s.posts_today : 0;
  if (today >= 3) throw new GameError("too_many", "Three posts a day is enough. Your followers need to miss you.");
  const disc = list(p.discovered);
  const items = ownedItems(ctx.db, p).map((i) => ITEMS[i.item_id]);
  const has = {
    car: () => ctx.db.get("SELECT 1 FROM vehicles WHERE player_id = ?", p.id) !== undefined,
    home: () => p.home_kind === "owned",
    trip: () => disc.some((d) => d.startsWith("site:")),
    fest: () => disc.some((d) => d.startsWith("fest:")),
    business: () => ctx.db.get("SELECT 1 FROM businesses WHERE player_id = ?", p.id) !== undefined,
    outfit: () => items.some((i) => i && (i.slot === "clothing" || i.id === "kente_cloth" || i.id === "smock")),
  };
  if (t.needs && !has[t.needs]()) throw new GameError("needs", { car: "You need a car to flex.", home: "You need your own house for a house tour.", trip: "Go somewhere first: visit a waterfall, castle or park.", fest: "Attend a festival first.", business: "You need a business to promote.", outfit: "Buy an outfit first: wax print, a smock, kente or sneakers." }[t.needs]);
  requireAwake(p, 5, "post");
  advance(ctx, p, 25, fb, { quiet: true });
  const novelty = (JSON.parse(s.feed) as { kind: string }[]).slice(-3).filter((x) => x.kind === t.id).length;
  const camMult = [0, 0.6, 1, 1.4, 1.8][cam] ?? 1;
  const audience = 1 + Math.sqrt(s.followers) / 40;
  const viral = rand01(`post:${p.id}:${s.posts}`) < 0.06 ? 8 : 1;
  const gain = Math.round(t.base * camMult * (1 + p.charisma / 40) * audience * (novelty ? 0.45 : 1) * (0.7 + rand01(`postn:${p.id}:${s.posts}`) * 0.6) * viral);
  const feed = (JSON.parse(s.feed) as { kind: string; day: number; gain: number }[]).concat({ kind: t.id, day, gain }).slice(-20);
  ctx.db.run("UPDATE social SET followers = followers + ?, posts = posts + 1, posts_today = ?, last_post_day = ?, promo_day = ?, feed = ? WHERE player_id = ?",
    gain, today + 1, day, t.id === "business" ? day : s.promo_day, JSON.stringify(feed), p.id);
  applyEffects(p, { social: 3, charisma: 0.3, reputation: s.followers + gain >= 10_000 ? 0.5 : 0.1 }, fb, viral > 1 ? `🔥 Your ${t.name.toLowerCase()} went viral! +${gain.toLocaleString()} followers.` : `📱 Posted a ${t.name.toLowerCase()}: +${gain.toLocaleString()} followers.`, [{ k: "followers", d: gain }]);
  return null;
}

function actEventChoose(ctx: Ctx, p: PlayerRow, a: Action, fb: Feedback) {
  const ev = ctx.db.get<{ id: number; event_id: string; status: string }>("SELECT * FROM life_events WHERE id = ? AND player_id = ?", Number(a.eventId), p.id);
  if (!ev || ev.status !== "pending") throw new GameError("bad_event", "Nothing to decide");
  const def = LIFE_EVENTS.find((e) => e.id === ev.event_id)!;
  const choice = def.choices?.find((c) => c.id === a.choiceId);
  if (!choice) throw new GameError("bad_choice", "Unknown choice");
  const money = choice.cost ? chargeStrict(ctx, p, minor(choice.cost), "life_event", `${def.title}: ${choice.label}`) : [];
  const upd = ctx.db.run("UPDATE life_events SET status='resolved', choice=?, result=? WHERE id=? AND status='pending'", choice.id, choice.result, ev.id);
  if (upd.changes !== 1) throw new GameError("conflict", "Already decided");
  applyEffects(p, choice.effects, fb, `${def.title}: ${choice.result}`, money);
  return null;
}

function requireDev(ctx: Ctx, p: PlayerRow) {
  if (!ctx.config.devTools || !(p.is_test || ctx.config.everyoneIsTester)) throw new GameError("forbidden", "Developer tools are disabled");
}

function actDevGrant(ctx: Ctx, p: PlayerRow, a: Action, fb: Feedback) {
  requireDev(ctx, p);
  const amount = requireAmount(a.amount);
  if (amount > minor(1_000_000_000)) throw new GameError("bad_amount", "Too much");
  credit(ctx, p, "bank", amount, "dev_grant", "Developer test grant (test account)");
  fb.add(`[dev] Granted ${formatMoney(amount)} to bank.`, [{ k: "bank", d: amount }], "info");
  return null;
}

function actDevSkip(ctx: Ctx, p: PlayerRow, a: Action, fb: Feedback) {
  requireDev(ctx, p);
  const hours = typeof a.hours === "number" && Number.isInteger(a.hours) && a.hours > 0 && a.hours <= 24 * 30 ? a.hours : 0;
  if (!hours) throw new GameError("bad_amount", "1–720 hours");
  advance(ctx, p, hours * 60, fb, { sleeping: true });
  applyEffects(p, { energy: 100, hunger: 100, health: 100, fun: 100, hygiene: 100, bladder: 100 }, null);
  return null;
}

// ---------------------------------------------------------------------------
// Net worth, goals and the full state view

export function netWorth(db: Db, p: PlayerRow) {
  const day = dayOf(p.game_min);
  const cash = balance(db, p.id, "cash");
  const bank = balance(db, p.id, "bank");
  const usd = balance(db, p.id, "usd");
  const tbill = balance(db, p.id, "tbill");
  const loan = balance(db, p.id, "loan");
  const usdInGhs = Math.floor(usd * fxMid(day));
  let land = 0;
  let buildings = 0;
  for (const r of db.all<{ id: number; price: number; plot_type: string }>("SELECT * FROM plots WHERE player_id = ?", p.id)) {
    const b = db.get<BuildingRow>("SELECT * FROM buildings WHERE plot_id = ?", r.id);
    if (b && (b.status === "complete" || b.status === "upgrading")) buildings += minor(builtValue(r.price / 100, b.design, b.quality as Quality));
    else {
      land += r.price;
      if (b) buildings += Math.round(b.spent * 0.9);
    }
  }
  let biz = 0;
  for (const b of db.all<BusinessRow>("SELECT * FROM businesses WHERE player_id = ?", p.id)) {
    biz += minor(businessValue(BUSINESSES[b.type].price, b.level)) + balance(db, p.id, `biz:${b.id}`);
  }
  let vehicles = 0;
  for (const v of db.all<{ price: number; bought_min: number; condition: number }>("SELECT * FROM vehicles WHERE player_id = ?", p.id)) vehicles += vehicleValue(v, p.game_min);
  const goods = db.all<{ price: number }>("SELECT price FROM items WHERE player_id = ?", p.id).reduce((a, i) => a + Math.round(i.price * 0.4), 0);
  const farms = db.all<{ price: number }>("SELECT price FROM farms WHERE player_id = ?", p.id).reduce((a, f) => a + f.price, 0);
  land += farms;
  const total = cash + bank + usdInGhs + tbill + land + buildings + biz + vehicles + goods + p.payroll_accrued - loan - p.rent_arrears;
  return { cash, bank, usd, usdInGhs, tbill, loan, land, buildings, businesses: biz, vehicles, goods, payroll: p.payroll_accrued, arrears: p.rent_arrears, total };
}

// ---------------------------------------------------------------------------
// Today's hustle

function dailyContext(db: Db, p: PlayerRow): DailyContext {
  return {
    hasJob: !!p.job_id,
    hasBusiness: !!db.get("SELECT 1 FROM businesses WHERE player_id = ?", p.id),
    hasFarm: !!db.get("SELECT 1 FROM farms WHERE player_id = ?", p.id),
    enrolled: !!db.get("SELECT 1 FROM courses WHERE player_id = ? AND status != 'done'", p.id),
    hasKitchen: true,
    hasCar: !!db.get("SELECT 1 FROM vehicles WHERE player_id = ? AND status = 'personal'", p.id),
  };
}

/** Today's goals, rolled over to a fresh set each game day. */
function dailyState(db: Db, p: PlayerRow): DailyState {
  const day = dayOf(p.game_min);
  let st: DailyState | null = null;
  try { st = p.daily ? (JSON.parse(p.daily) as DailyState) : null; } catch { st = null; }
  if (!st || st.day !== day) {
    const prev = st;
    st = {
      day,
      goals: pickDaily(p.id, day, dailyContext(db, p)).map((id) => ({ id, progress: 0, done: false })),
      swapped: false,
      bonusPaid: false,
      streak: prev && prev.lastFullDay === day - 1 ? prev.streak : 0,
      lastFullDay: prev?.lastFullDay ?? -1,
    };
    p.daily = JSON.stringify(st);
  }
  return st;
}

const CLEAN_ACTS = ["shower", "shared_bath", "bucket_bath"];
const FUN_ACTS = ["watch_tv", "watch_football", "music", "neighbours", "pool_swim", "terrace"];

/** Which of today's goals did this action move forward? */
function dailyHits(a: Action, discovered: boolean): string[] {
  const hits: string[] = [];
  const act = typeof a.activity === "string" ? a.activity : "";
  switch (a.type) {
    case "work": hits.push("shift"); break;
    case "job_apply": hits.push("job_hunt"); break;
    case "talk": hits.push("talk"); break;
    case "travel": if (a.mode === "trotro") hits.push("trotro"); if (a.mode === "car") hits.push("drive"); break;
    case "deposit": if (Number(a.amount) >= 5000) hits.push("save"); break;
    case "home_activity":
      if (CLEAN_ACTS.includes(act)) hits.push("clean");
      if (act.startsWith("cook")) hits.push("cook");
      if (FUN_ACTS.includes(act)) hits.push("fun");
      break;
    case "cook": hits.push("cook"); break;
    case "service": {
      const s = SERVICES[String(a.serviceId)];
      if (s && (s.effects.hunger ?? 0) >= 15) hits.push("eat_local");
      if (s && (s.effects.fun ?? 0) > 0) hits.push("fun");
      break;
    }
    case "biz_collect": hits.push("business"); break;
    case "course_attend": hits.push("class"); break;
    case "farm_plant": case "farm_harvest": hits.push("farm"); break;
    case "social_post": hits.push("post"); break;
  }
  if (discovered) hits.push("explore");
  return hits;
}

function trackDaily(ctx: Ctx, p: PlayerRow, a: Action, fb: Feedback, discovered: boolean) {
  const st = dailyState(ctx.db, p);
  const hits = dailyHits(a, discovered);
  let changed = false;
  for (const g of st.goals) {
    if (g.done || !hits.includes(g.id)) continue;
    const def = DAILY_GOALS[g.id];
    g.progress += 1;
    changed = true;
    if (g.progress >= def.target) {
      g.done = true;
      const money = credit(ctx, p, "cash", minor(def.reward), "daily_goal", `Today's hustle: ${def.label}`, `daily:${p.id}:${st.day}:${g.id}`);
      fb.add(`🎯 Done: ${def.label}.`, money, "goal");
    }
  }
  if (changed && !st.bonusPaid && st.goals.every((g) => g.done)) {
    st.bonusPaid = true;
    st.streak = st.lastFullDay === st.day - 1 ? st.streak + 1 : 1;
    st.lastFullDay = st.day;
    const money = credit(ctx, p, "cash", minor(DAILY_BONUS), "daily_goal", "Today's hustle: all three done", `daily:${p.id}:${st.day}:bonus`);
    fb.add(`🏆 All of today's goals done${st.streak > 1 ? ` · ${st.streak}-day streak` : ""}.`, money, "goal");
  }
  p.daily = JSON.stringify(st);
}

function actSettings(p: PlayerRow, a: Action, fb: Feedback) {
  if (a.needsPace !== undefined) {
    const v = Number(a.needsPace);
    if (![0, 0.5, 1].includes(v)) throw new GameError("bad_setting", "Needs pace is off, slow or normal.");
    p.needs_pace = v;
    fb.add(v === 0 ? "Needs paused: they won't run down." : v === 0.5 ? "Needs run down at half speed." : "Needs run at normal speed.", [], "info");
  }
  return null;
}

function actDailySwap(ctx: Ctx, p: PlayerRow, a: Action, fb: Feedback) {
  const st = dailyState(ctx.db, p);
  if (st.swapped) throw new GameError("swapped", "You've already swapped a goal today. Fresh ones tomorrow.");
  const g = st.goals.find((x) => x.id === a.goalId);
  if (!g || g.done) throw new GameError("bad_goal", "Pick one of today's unfinished goals.");
  const next = swapCandidate(p.id, st.day, dailyContext(ctx.db, p), st.goals.map((x) => x.id));
  if (!next) throw new GameError("no_swap", "Nothing else to swap in today.");
  Object.assign(g, { id: next, progress: 0, done: false });
  st.swapped = true;
  p.daily = JSON.stringify(st);
  fb.add(`🔁 Swapped in: ${DAILY_GOALS[next].label}.`, [], "info");
  return null;
}

function dailyView(ctx: Ctx, p: PlayerRow) {
  const st = dailyState(ctx.db, p);
  return {
    day: st.day,
    swapped: st.swapped,
    streak: st.streak,
    bonus: DAILY_BONUS,
    bonusPaid: st.bonusPaid,
    goals: st.goals.map((g) => {
      const d = DAILY_GOALS[g.id];
      return { id: g.id, icon: d.icon, label: d.label, hint: d.hint, progress: g.progress, target: d.target, reward: d.reward, done: g.done };
    }),
  };
}

function moodFor(db: Db, p: PlayerRow) {
  return moodOf({
    stats: { energy: p.energy, hunger: p.hunger, health: p.health, social: p.social, fun: p.fun, hygiene: p.hygiene, bladder: p.bladder },
    homeTier: homeSpecFor(db, p).tier,
    comfort: homeComfort(db, p),
    partnered: isPartnered(db, p.id),
    rentArrears: p.rent_arrears > 0,
    hasCar: !!db.get("SELECT 1 FROM vehicles WHERE player_id = ? AND status = 'personal'", p.id),
  });
}

function snapshot(db: Db, p: PlayerRow): ProgressSnapshot {
  const rels = db.all<{ affinity: number; partner: number }>("SELECT affinity, partner FROM relationships WHERE player_id = ?", p.id);
  const nw = netWorth(db, p);
  return {
    shiftsWorked: p.shifts_total,
    hasJob: !!p.job_id,
    bankMinor: nw.bank,
    netWorthMinor: nw.total,
    tbillsBought: p.tbills_bought,
    friends: rels.filter((r) => r.affinity >= 40).length,
    closeFriends: rels.filter((r) => r.affinity >= 70).length,
    partner: rels.some((r) => r.partner === 1),
    businesses: (db.get<{ n: number }>("SELECT COUNT(*) AS n FROM businesses WHERE player_id = ?", p.id)?.n ?? 0),
    plots: (db.get<{ n: number }>("SELECT COUNT(*) AS n FROM plots WHERE player_id = ?", p.id)?.n ?? 0),
    housesBuilt: (db.get<{ n: number }>("SELECT COUNT(*) AS n FROM buildings b WHERE player_id = ? AND status IN ('complete','upgrading')", p.id)?.n ?? 0),
    vehicles: db.all<{ type: string }>("SELECT type FROM vehicles WHERE player_id = ?", p.id).map((v) => v.type),
    homeDistrict: homeDistrict(db, p),
    ownsHome: p.home_kind === "owned",
    reputation: p.reputation,
    districtsVisited: list(p.visited).length,
    usdMinor: nw.usd,
    betsWon: p.bets_won,
    maxBusinessLevel: db.get<{ m: number | null }>("SELECT MAX(level) AS m FROM businesses WHERE player_id = ?", p.id)?.m ?? 0,
    regionsVisited: new Set(list(p.visited).map((d) => (DISTRICTS[d] ? TOWN_BY_ID[DISTRICTS[d].city]?.region : undefined)).filter(Boolean)).size,
    sitesVisited: list(p.discovered).filter((d) => d.startsWith("site:")).length,
    dishesTasted: list(p.discovered).filter((d) => d.startsWith("dish:")).length,
    festivals: list(p.discovered).filter((d) => d.startsWith("fest:")).length,
    followers: db.get<{ followers: number }>("SELECT followers FROM social WHERE player_id = ?", p.id)?.followers ?? 0,
    harvests: db.get<{ n: number | null }>("SELECT SUM(harvests) AS n FROM farms WHERE player_id = ?", p.id)?.n ?? 0,
    certificates: db.get<{ n: number }>("SELECT COUNT(*) AS n FROM courses WHERE player_id = ? AND status = 'done'", p.id)!.n,
    licensed: hasUnlock(p, "licence_a") || hasUnlock(p, "licence_b"),
    furnishingPoints: furnishingScore(ownedItems(db, p).map((i) => i.item_id)).points,
    ownsMansion: !!db.get("SELECT 1 FROM buildings WHERE player_id = ? AND design = 'mansion' AND status IN ('complete','upgrading')", p.id),
    carCount: db.all<{ type: string }>("SELECT type FROM vehicles WHERE player_id = ?", p.id).filter((v) => ["car", "luxury"].includes(VEHICLES[v.type]?.category)).length,
  };
}

function evaluateGoals(ctx: Ctx, p: PlayerRow, fb: Feedback) {
  const done = new Set(ctx.db.all<{ goal_id: string }>("SELECT goal_id FROM goals WHERE player_id = ?", p.id).map((g) => g.goal_id));
  const s = snapshot(ctx.db, p);
  for (const g of GOALS) {
    if (done.has(g.id) || !g.check(s)) continue;
    const r = ctx.db.run("INSERT OR IGNORE INTO goals (player_id, goal_id, done_min) VALUES (?, ?, ?)", p.id, g.id, p.game_min);
    if (r.changes !== 1) continue;
    const changes: Change[] = [];
    if (g.reward.cash) changes.push(...credit(ctx, p, "cash", minor(g.reward.cash), "goal_reward", `Goal reward: ${g.title}`, `goal:${g.id}`));
    if (g.reward.reputation) changes.push(...applyEffects(p, { reputation: g.reward.reputation }, null));
    fb.add(`${g.achievement ? "🏅 Achievement" : "🏆 Goal complete"}: ${g.title}`, changes, "goal");
  }
}

/** Public action to just read state with the clock caught up. Not idempotency-keyed (no money moves). */
export function readState(ctx: Ctx, playerId: number) {
  return tx(ctx.db, () => {
    const p = loadPlayer(ctx.db, playerId);
    const fb = new Feedback();
    catchUp(ctx, p, fb);
    evaluateGoals(ctx, p, fb);
    savePlayer(ctx.db, p);
    for (const item of fb.items) if (item.tone !== "info" || item.changes.length) logEntry(ctx.db, p.id, p.game_min, "time", item.text, item.changes);
    return { state: buildState(ctx, p), feedback: fb.items };
  });
}

export function buildState(ctx: Ctx, p: PlayerRow) {
  const db = ctx.db;
  const gd = toGameDate(p.game_min);
  const day = gd.day;
  const nw = netWorth(db, p);
  const s = snapshot(db, p);
  const doneGoals = new Map(db.all<{ goal_id: string; done_min: number }>("SELECT * FROM goals WHERE player_id = ?", p.id).map((g) => [g.goal_id, g.done_min]));
  const rels = db.all<RelRow>("SELECT * FROM relationships WHERE player_id = ?", p.id);
  const pendingEvent = db.get<{ id: number; event_id: string }>("SELECT * FROM life_events WHERE player_id = ? AND status = 'pending' ORDER BY id LIMIT 1", p.id);
  const evDef = pendingEvent && LIFE_EVENTS.find((e) => e.id === pendingEvent.event_id);
  const income = monthlyIncomeEstimate(db, p);
  const rental = p.home_kind === "rental" ? RENTALS[p.home_ref] : null;
  const loanOwed = nw.loan;
  const expenses =
    (rental ? minor(rental.rent) : 0) +
    minor(rental ? rental.utilities : 150 * homeComfort(db, p)) +
    minor(PHONE_DATA_MONTHLY) +
    (loanOwed > 0 ? Math.max(minor(50), Math.ceil(loanOwed * LOAN_MIN_REPAYMENT)) : 0);
  const plots = db.all<{ id: number; plot_type: string; price: number; bought_min: number }>("SELECT * FROM plots WHERE player_id = ?", p.id);
  const buildings = db.all<BuildingRow>("SELECT * FROM buildings WHERE player_id = ?", p.id);
  return {
    player: {
      id: p.id, name: p.name, look: JSON.parse(p.look) as LookInput, background: p.background,
      district: p.district, pos: { x: p.pos_x, z: p.pos_z },
      stats: { energy: p.energy, hunger: p.hunger, health: p.health, social: p.social, fun: p.fun, hygiene: p.hygiene, bladder: p.bladder },
      mood: moodFor(db, p),
      daily: dailyView(ctx, p),
      settings: { needsPace: p.needs_pace },
      skills: { work: round1(p.work), fitness: round1(p.fitness), charisma: round1(p.charisma), business: round1(p.business) },
      reputation: round1(p.reputation), creditScore: p.credit_score,
      job: p.job_id ? { id: p.job_id, rank: p.job_rank, rankTitle: RANK_TITLES[p.job_rank], shifts: p.job_shifts, nextRankAt: p.job_rank < MAX_RANK ? SHIFTS_PER_RANK * (p.job_rank + 1) : null, payPerShift: minor(rankPay(JOBS[p.job_id].pay, p.job_rank)) } : null,
      home: { kind: p.home_kind, ref: p.home_ref, district: homeDistrict(db, p), comfort: homeComfort(db, p), rentCredit: p.rent_credit, spec: homeSpecFor(db, p) },
      unlocks: list(p.unlocks), visited: list(p.visited), discovered: list(p.discovered), isTest: !!p.is_test,
      jobRequirements: Object.fromEntries(Object.keys(JOBS).map((j) => [j, jobRequirements(p, j)])),
    },
    time: { ...gd, weather: weatherAt(p.game_min) },
    money: {
      ...nw,
      netWorth: nw.total,
      monthlyIncome: income,
      monthlyExpenses: expenses,
      fx: { mid: fxMid(day), buy: fxBuy(day), sell: fxSell(day), history: Array.from({ length: 14 }, (_, i) => fxMid(day - 13 + i)) },
      loanLimit: loanLimit(income, nw.total),
      loanRate: LOAN_RATE - (hasUnlock(p, "akosua_rate") ? 0.02 : 0),
      tbills: db.all("SELECT id, product, principal, payout, bought_min AS boughtMin, matures_min AS maturesMin, status FROM tbills WHERE player_id = ? ORDER BY id DESC LIMIT 20", p.id),
      ledger: recentLedger(db, p.id, 40),
    },
    relationships: rels.map((r) => ({
      npcId: r.npc_id, affinity: r.affinity, romance: r.romance, partner: !!r.partner, tier: tierFor(r.affinity),
      memories: JSON.parse(r.memories) as { day: number; text: string }[], lastTalkDay: r.last_talk_day,
    })),
    dates: db.all("SELECT id, npc_id AS npcId, place_id AS placeId, start_min AS startMin, status FROM dates WHERE player_id = ? ORDER BY id DESC LIMIT 10", p.id),
    plots: plots.map((pl) => ({ id: pl.id, type: pl.plot_type, price: pl.price, boughtMin: pl.bought_min })),
    buildings: buildings.map((b) => {
      const plan = stagePlan(b.design, b.quality as Quality);
      return {
        id: b.id, plotId: b.plot_id, design: b.design, quality: b.quality, stage: b.stage, status: b.status, use: b.use,
        stageStartedMin: b.stage_started_min, stageEndsMin: b.stage_ends_min, upgradeTo: b.upgrade_to, spent: b.spent, completedMin: b.completed_min,
        plan: plan.map((s) => ({ ...s, cost: minor(s.cost) })),
        upgrade: b.status === "complete" ? (() => { const u = upgradeCost(b.design, b.quality as Quality); return u ? { ...u, cost: minor(u.cost) } : null; })() : null,
      };
    }),
    businesses: db.all<BusinessRow>("SELECT * FROM businesses WHERE player_id = ?", p.id).map((b) => ({
      id: b.id, type: b.type, level: b.level, upgradingUntil: b.upgrading_until, lastVisitDay: b.last_visit_day,
      totalProfit: b.total_profit, lastDayProfit: b.last_day_profit, history: JSON.parse(b.history) as number[],
      till: balance(db, p.id, `biz:${b.id}`), neglected: day - b.last_visit_day > NEGLECT_DAYS,
      upgradeCost: b.level < MAX_BUSINESS_LEVEL ? minor(businessUpgradeCost(BUSINESSES[b.type].price, b.level)) : null,
      value: minor(businessValue(BUSINESSES[b.type].price, b.level)),
    })),
    vehicles: db.all<{ id: number; type: string; price: number; bought_min: number; status: string; condition: number }>("SELECT * FROM vehicles WHERE player_id = ?", p.id)
      .map((v) => ({ id: v.id, type: v.type, price: v.price, boughtMin: v.bought_min, status: v.status, condition: Math.round(v.condition), value: vehicleValue(v, p.game_min) })),
    items: ownedItems(db, p).map((i) => ({ id: i.id, itemId: i.item_id, price: i.price, boughtMin: i.bought_min })),
    furnishing: (() => { const f = furnishingScore(ownedItems(db, p).map((i) => i.item_id)); return { ...f, base: baseComfort(db, p) }; })(),
    farms: db.all<FarmRow>("SELECT * FROM farms WHERE player_id = ?", p.id).map((f) => ({
      id: f.id, type: f.farm_type, price: f.price, crop: f.crop, plantedMin: f.planted_min, readyMin: f.ready_min, status: f.status, harvests: f.harvests, totalIncome: f.total_income,
      estimate: f.status === "growing" && f.crop && f.planted_min !== null && f.ready_min !== null ? harvestValue({ ...f, crop: f.crop, planted_min: f.planted_min, ready_min: f.ready_min }, p, Math.max(p.game_min, f.ready_min)) : null,
    })),
    courses: db.all<CourseRow>("SELECT * FROM courses WHERE player_id = ?", p.id).map((c) => ({ id: c.course_id, sessions: c.sessions, status: c.status, lastSessionDay: c.last_session_day })),
    social: (() => {
      const s = db.get<SocialRow>("SELECT * FROM social WHERE player_id = ?", p.id);
      const today = dayOf(p.game_min);
      return { followers: s?.followers ?? 0, posts: s?.posts ?? 0, postsToday: s && s.last_post_day === today ? s.posts_today : 0, feed: s ? JSON.parse(s.feed) as { kind: string; day: number; gain: number }[] : [], camera: bestCamera(db, p), dailyDeal: influencerDaily(s?.followers ?? 0) };
    })(),
    goals: GOALS.map((g) => ({ id: g.id, done: doneGoals.has(g.id), doneMin: doneGoals.get(g.id) ?? null, progress: g.progress ? g.progress(s) : null })),
    event: pendingEvent && evDef ? { id: pendingEvent.id, eventId: evDef.id, title: evDef.title, text: evDef.text, choices: evDef.choices ?? [] } : null,
    log: db.all<{ id: number; game_min: number; kind: string; text: string; changes: string }>("SELECT * FROM log WHERE player_id = ? ORDER BY id DESC LIMIT 60", p.id)
      .map((l) => ({ id: l.id, gameMin: l.game_min, kind: l.kind, text: l.text, changes: JSON.parse(l.changes) as Change[] })),
    rentArrears: p.rent_arrears,
    devTools: ctx.config.devTools && (!!p.is_test || !!ctx.config.everyoneIsTester),
  };
}

export type GameState = ReturnType<typeof buildState>;
