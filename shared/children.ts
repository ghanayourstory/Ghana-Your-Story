// Children: entirely optional. A married couple can try for a baby, and
// anyone with their own place can adopt through Social Welfare. Babies are
// named at an outdooring on the eighth day or after. Children grow up a year
// every game month (so you see them grow), cost money each month, go to
// public or private school from age 4, and grow closer when you spend time
// with them. Not having children is never a penalty.
import { TOWN_BY_ID, type RegionId } from "./ghana.ts";
import { namePool } from "./family.ts";
import { mulberry32 } from "./rng.ts";

/** Game days per year of a child's life. */
export const DAYS_PER_CHILD_YEAR = 30;
/** From conceiving to birth, at the same pace (nine months). */
export const PREGNANCY_DAYS = 22;
export const ADOPTION_FEE = 1_500;
export const ADOPTION_DAYS = 21;
export const NAMING_DAY = 8;
export const NAMING_COST = 800;
export const SCHOOL_AGE = 4;
export const GROWN_AGE = 18;

export const childAge = (bornDay: number, today: number) => Math.max(0, Math.floor((today - bornDay) / DAYS_PER_CHILD_YEAR));

/** Monthly cost of a child in cedis: food, clothes, health, and school if private. Public basic school is fee-free, but there are still books and uniforms. */
export function childMonthly(age: number, school: "public" | "private"): number {
  if (age < SCHOOL_AGE) return 300;
  return school === "private" ? 950 : 280;
}

const AKAN_DAY = { m: ["Kwasi", "Kwadwo", "Kwabena", "Kwaku", "Yaw", "Kofi", "Kwame"], f: ["Akosua", "Adwoa", "Abena", "Akua", "Yaa", "Afua", "Ama"] };
const EWE_DAY = { m: ["Kɔsi", "Kɔdzo", "Kɔbla", "Kuku", "Yawo", "Kofi", "Kwami"], f: ["Kɔsiwa", "Adzo", "Abla", "Aku", "Yawa", "Afi", "Ama"] };
const AKAN: RegionId[] = ["ashanti", "eastern", "bono", "bono_east", "ahafo", "central", "western", "western_north"];

/** Names to suggest at the naming: a day name where that's the custom, plus a few from the region. */
export function suggestedNames(hometown: string, feminine: boolean, weekdayBorn: number, seed: number): string[] {
  const region = TOWN_BY_ID[hometown]?.region ?? "greater_accra";
  const pool = namePool(region);
  const r = mulberry32(seed);
  const regional = [...(feminine ? pool.f : pool.m)].sort(() => r() - 0.5).slice(0, 3);
  const day = AKAN.includes(region) ? (feminine ? AKAN_DAY.f : AKAN_DAY.m)[weekdayBorn]
    : region === "volta" || region === "oti" ? (feminine ? EWE_DAY.f : EWE_DAY.m)[weekdayBorn]
    : null;
  return [...new Set([...(day ? [day] : []), ...regional])];
}

export function namingName(hometown: string): string {
  const region = TOWN_BY_ID[hometown]?.region ?? "greater_accra";
  if (["northern", "savannah", "north_east"].includes(region)) return "Naming ceremony";
  return "Outdooring (naming ceremony)";
}

export const sanitizeChildName = (v: unknown) => (typeof v === "string" && /^[\p{L}\p{M}' .-]{2,20}$/u.test(v.trim()) ? v.trim() : null);
