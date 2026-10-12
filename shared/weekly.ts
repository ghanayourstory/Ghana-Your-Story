// The week has a rhythm: each market has its market days (cheaper stock, twice
// the buyers), churches fill on Sunday morning, mosques at Friday Jumu'ah, and
// on Saturdays somebody in town is holding a funeral or a wedding: everyone's
// invited, bring a little something. All deterministic from the day number.
import { MINUTES_PER_DAY, WEEKDAYS, toGameDate } from "./calendar.ts";
import { DISTRICTS, PLACES, type Place } from "./world.ts";
import { namePool } from "./family.ts";
import { TOWN_BY_ID } from "./ghana.ts";

const hash = (s: string) => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
};

/** The two market days of a market (weekday indexes, 0 = Sunday). Never Sunday. */
export function marketDays(placeId: string): [number, number] {
  const a = 1 + (hash(placeId) % 6);
  const b = 1 + ((a - 1 + 3) % 6);
  return a < b ? [a, b] : [b, a];
}
/** Weekday (0 = Sunday) of a game day number. */
export const weekdayOf = (day: number) => toGameDate(day * MINUTES_PER_DAY).weekdayIndex;
export const isMarketDay = (placeId: string, day: number) => marketDays(placeId).includes(weekdayOf(day));
export const marketDayNames = (placeId: string) => marketDays(placeId).map((d) => WEEKDAYS[d]).join(" & ");

export interface TownEvent {
  id: string;
  kind: "funeral" | "wedding";
  title: string;
  host: string;
  placeId: string;
  district: string;
  hours: [number, number];
  /** Suggested contribution in GH₵ (fictional): funeral donation or wedding gift. */
  gift: number;
  blurb: string;
  /** What guests wear: southern black-and-red / kente, or northern smocks. */
  dress: "south" | "north";
}

const NORTH_REGIONS = ["northern", "savannah", "north_east", "upper_east", "upper_west"];

/** How a funeral or wedding looks in each part of the country. */
function custom(region: string, kind: "funeral" | "wedding", venueKind: string): { title: (who: string) => string; blurb: string } {
  if (kind === "funeral") {
    if (region === "upper_west") return { title: (w) => `Final funeral rites of the late ${w}`, blurb: "The gyil (xylophone) plays for the departed, mourners dance in turns and the family receives everyone in the compound. Bring a contribution and greet the elders." };
    if (region === "upper_east") return { title: (w) => `Final funeral rites of the late ${w}`, blurb: "Drums, smocks and the warriors' dance. The family receives guests under the shade; pass by, greet, and give what you can." };
    if (MUSLIM.includes(region)) return { title: (w) => `Funeral prayers for the late ${w}`, blurb: "The burial was quick, as custom asks; today the family receives condolences, prayers are said and food is shared. Give something to help the family." };
    if (region === "volta" || region === "oti") return { title: (w) => `Funeral of the late ${w}`, blurb: "Black and red or black and white, agbadza drums and a long line to greet the family. Sign the book, make your donation, stay for food." };
    return { title: (w) => `Funeral of the late ${w}`, blurb: "Black and red cloth, a brass band and drummers, canopies along the road. Sign the book, make your donation, greet the family and stay for food." };
  }
  if (venueKind === "mosque") return { title: (w) => `${w}'s wedding`, blurb: "The marriage was blessed at the mosque this morning. Now it's drumming, dancing, rice and goat, and everyone in their best. Bring a gift for the couple." };
  if (NORTH_REGIONS.includes(region)) return { title: (w) => `${w}'s wedding`, blurb: "Smocks and lace, drummers and a long line of aunties. Food for everybody. Bring a gift for the couple." };
  return { title: (w) => `${w}'s wedding`, blurb: "Kente and lace, a long queue for the photo booth, jollof and a DJ who won't stop playing highlife. Bring a gift for the couple." };
}
const MUSLIM = ["northern", "savannah", "north_east"];

/** Saturday events in a city (Saturdays only; empty other days). */
export function townEvents(city: string, day: number): TownEvent[] {
  if (weekdayOf(day) !== 6) return [];
  const region = TOWN_BY_ID[city]?.region ?? "greater_accra";
  // Families hold these at the church, the mosque (where most people are Muslim), a school field or a landmark square.
  const kinds = MUSLIM.includes(region) ? ["mosque", "landmark", "school"] : ["church", "landmark", "school"];
  const venues = PLACES.filter((p) => DISTRICTS[p.district]?.city === city && kinds.includes(p.kind));
  if (!venues.length) return [];
  const h = hash(`${city}:${day}`);
  const dress = NORTH_REGIONS.includes(region) ? "north" : "south";
  const pool = namePool(region);
  const out: TownEvent[] = [];
  const n = 1 + (h % 2);
  for (let i = 0; i < n; i++) {
    const hh = hash(`${city}:${day}:${i}`);
    const v: Place = venues[hh % venues.length];
    if (out.some((e) => e.placeId === v.id)) continue;
    const surname = pool.surnames[hh % pool.surnames.length];
    const funeral = (hh >> 3) % 2 === 0;
    if (funeral) {
      const names = (hh >> 5) % 2 ? pool.m : pool.f;
      const elder = `${names[hh % names.length]} ${surname}`;
      const c = custom(region, "funeral", v.kind);
      out.push({ id: `ev:${city}:${day}:${i}`, kind: "funeral", title: c.title(elder), host: `the ${surname} family`, placeId: v.id, district: v.district, hours: [8, 15], gift: 20, blurb: c.blurb, dress });
    } else {
      const a = pool.m[(hh >> 7) % pool.m.length], b = pool.f[(hh >> 9) % pool.f.length];
      const c = custom(region, "wedding", v.kind);
      out.push({ id: `ev:${city}:${day}:${i}`, kind: "wedding", title: c.title(`${a} & ${b}`), host: `the ${surname} family`, placeId: v.id, district: v.district, hours: [10, 17], gift: 50, blurb: c.blurb, dress });
    }
  }
  return out;
}
