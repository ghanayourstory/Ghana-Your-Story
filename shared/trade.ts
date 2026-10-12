// Buy-and-sell hustle: buy stock at a market, carry it, sell it where people
// want it (lorry stations, markets, busy streets). Prices are fictional game
// values, set so the margin pays for your time but not much more; perishables
// go off, and every spot has only so many buyers a day.
import type { DistrictId, Place } from "./world.ts";
import { DISTRICTS } from "./world.ts";
import { routeBetween } from "./ghana.ts";

export interface Good {
  id: string;
  name: string;
  icon: string;
  /** What one unit is. */
  unit: string;
  /** Wholesale price at a market (GH₵ per unit). */
  buy: number;
  /** Typical street price before location and time adjustments. */
  sell: number;
  /** Share that goes off each game day (0 = keeps). */
  spoil: number;
  /** Where buyers are: stations and roadsides, markets, or both. */
  sellAt: ("transport" | "market")[];
  /** Minutes to sell one unit by hawking. */
  minutesPerUnit: number;
  /** How many a single spot will buy in a day before prices sag. */
  demand: number;
  /**
   * Regional produce: only sold wholesale in these towns, cheap at the source and
   * worth more the further you carry it (yam from Kintampo, shea from Tamale…).
   */
  origin?: string[];
}

export const GOODS: Record<string, Good> = {
  pure_water: { id: "pure_water", name: "Sachet water", icon: "💧", unit: "bag of 30", buy: 7, sell: 11, spoil: 0, sellAt: ["transport", "market"], minutesPerUnit: 6, demand: 25 },
  oranges: { id: "oranges", name: "Peeled oranges", icon: "🍊", unit: "dozen", buy: 9, sell: 16, spoil: 0.35, sellAt: ["transport", "market"], minutesPerUnit: 7, demand: 18 },
  bread: { id: "bread", name: "Tea bread", icon: "🍞", unit: "loaf", buy: 6, sell: 9.5, spoil: 0.3, sellAt: ["transport", "market"], minutesPerUnit: 3, demand: 30 },
  plantain: { id: "plantain", name: "Plantain", icon: "🍌", unit: "bunch", buy: 28, sell: 40, spoil: 0.12, sellAt: ["market"], minutesPerUnit: 10, demand: 10 },
  tomatoes: { id: "tomatoes", name: "Tomatoes", icon: "🍅", unit: "small basket", buy: 45, sell: 65, spoil: 0.2, sellAt: ["market"], minutesPerUnit: 12, demand: 8 },
  airtime: { id: "airtime", name: "Airtime cards", icon: "📶", unit: "GH₵10 card", buy: 9.4, sell: 10.2, spoil: 0, sellAt: ["transport", "market"], minutesPerUnit: 2, demand: 40 },
  clothes: { id: "clothes", name: "Second-hand clothes", icon: "👕", unit: "bundle of 10", buy: 130, sell: 210, spoil: 0, sellAt: ["market"], minutesPerUnit: 35, demand: 4 },
  // Regional produce: buy at the source, sell far away.
  yam: { id: "yam", name: "Yam", icon: "🍠", unit: "pair of tubers", buy: 18, sell: 22, spoil: 0.02, sellAt: ["market"], minutesPerUnit: 8, demand: 12, origin: ["kintampo", "techiman"] },
  shea_butter: { id: "shea_butter", name: "Shea butter", icon: "🧈", unit: "1 kg ball", buy: 28, sell: 33, spoil: 0, sellAt: ["market"], minutesPerUnit: 6, demand: 10, origin: ["tamale", "bolgatanga", "wa", "bole", "damongo"] },
  smoked_fish: { id: "smoked_fish", name: "Smoked fish", icon: "🐟", unit: "basket", buy: 55, sell: 64, spoil: 0.05, sellAt: ["market"], minutesPerUnit: 10, demand: 8, origin: ["cape_coast", "takoradi"] },
  kente: { id: "kente", name: "Kente cloth", icon: "🧵", unit: "half piece", buy: 650, sell: 760, spoil: 0, sellAt: ["market"], minutesPerUnit: 40, demand: 2, origin: ["kumasi", "ho"] },
  basket: { id: "basket", name: "Bolga basket", icon: "🧺", unit: "basket", buy: 35, sell: 42, spoil: 0, sellAt: ["market"], minutesPerUnit: 12, demand: 6, origin: ["bolgatanga"] },
  beads: { id: "beads", name: "Krobo beads", icon: "📿", unit: "bundle of strands", buy: 22, sell: 27, spoil: 0, sellAt: ["market"], minutesPerUnit: 6, demand: 8, origin: ["koforidua"] },
};

const kmCache = new Map<string, number>();
/** Road distance from the nearest place a good comes from (0 at the source). */
export function kmFromSource(g: Good, city: string): number {
  if (!g.origin) return 0;
  const key = `${g.id}:${city}`;
  const hit = kmCache.get(key);
  if (hit !== undefined) return hit;
  let best = g.origin.includes(city) ? 0 : Infinity;
  for (const o of g.origin) if (best > 0) best = Math.min(best, routeBetween(o, city)?.km ?? Infinity);
  kmCache.set(key, best);
  return best;
}
/**
 * Regional price factor where you sell: a glut at the source (0.85), rising
 * with distance to nearly double far away. Local goods are 1 everywhere.
 */
export function regionalFactor(g: Good, city: string): number {
  if (!g.origin) return 1;
  const km = kmFromSource(g, city);
  if (km === 0) return 0.85;
  return 1 + Math.min(0.9, (Number.isFinite(km) ? km : 600) / 450);
}
/** Can you buy this good wholesale at this market? */
export function canBuyGood(p: Place, g: Good): boolean {
  if (p.kind !== "market") return false;
  return !g.origin || g.origin.includes(DISTRICTS[p.district]?.city);
}
/** Luggage on a bus or coach, per unit of stock. */
export const LUGGAGE_PER_UNIT = 1.5;

/** How much you can carry: a head pan and a bag on foot, much more with a car. */
export function carryCapacity(hasCar: boolean) {
  return hasCar ? 120 : 30;
}

/** Busy hours: morning rush, lunch, evening rush. */
export function rushHour(hour: number) {
  return (hour >= 6 && hour < 9) || (hour >= 12 && hour < 14) || (hour >= 16.5 && hour < 19.5);
}

/** Street price for the next unit here, now, after `soldToday` units at this spot. */
export function sellPrice(g: Good, district: DistrictId, hour: number, soldToday: number, marketDay = false): number {
  const d = DISTRICTS[district];
  const area = 1 + Math.max(0, d.prestige) / 200; // nicer areas pay a little more
  const rush = rushHour(hour) ? 1.12 : hour >= 21 || hour < 5 ? 0.8 : 1;
  const sag = Math.max(0.55, 1 - Math.max(0, soldToday - g.demand * (marketDay ? 2 : 1)) * 0.04);
  return Math.round(g.sell * area * rush * sag * regionalFactor(g, d.city) * 100) / 100;
}

export function canBuyHere(p: Place) {
  return p.kind === "market";
}
export function canSellHere(p: Place, g: Good) {
  return (g.sellAt as string[]).includes(p.kind);
}
