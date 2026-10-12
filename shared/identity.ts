// Who you are beyond your looks: the languages you speak and what matters to
// you. Both are choices, never penalties. Speaking someone's language helps
// you get on with them; your priorities make the things you care about feel
// better and steer Today's hustle towards them. English is a given.
import { TOWN_BY_ID, type RegionId } from "./ghana.ts";

export interface Language {
  id: string;
  name: string;
  /** A greeting we're sure of, shown when you use it. */
  hello?: string;
}
export const LANGUAGES: Record<string, Language> = {
  twi: { id: "twi", name: "Twi", hello: "Ɛte sɛn?" },
  fante: { id: "fante", name: "Fante", hello: "Akwaaba" },
  ga: { id: "ga", name: "Ga" },
  ewe: { id: "ewe", name: "Ewe", hello: "Ŋdi" },
  dagbani: { id: "dagbani", name: "Dagbani", hello: "Desiba" },
  hausa: { id: "hausa", name: "Hausa", hello: "Sannu" },
  gonja: { id: "gonja", name: "Gonja" },
  dagaare: { id: "dagaare", name: "Dagaare" },
  gurene: { id: "gurene", name: "Gurene (Frafra)" },
  nzema: { id: "nzema", name: "Nzema" },
};
export const MAX_LANGUAGES = 3;

/** Languages you'll hear most in a region, first one the most common. Twi travels far, Hausa fills every zongo. */
const BY_REGION: Record<RegionId, string[]> = {
  greater_accra: ["ga", "twi", "hausa"],
  ashanti: ["twi"], eastern: ["twi"], bono: ["twi"], bono_east: ["twi"], ahafo: ["twi"], western_north: ["twi"],
  central: ["fante", "twi"], western: ["fante", "nzema", "twi"],
  volta: ["ewe"], oti: ["ewe", "twi"],
  northern: ["dagbani", "hausa"], north_east: ["dagbani", "hausa"], savannah: ["gonja", "hausa"],
  upper_east: ["gurene", "hausa"], upper_west: ["dagaare", "hausa"],
};
export const languagesOfRegion = (r: RegionId) => BY_REGION[r] ?? ["twi"];
export const languagesOfCity = (city: string) => languagesOfRegion(TOWN_BY_ID[city]?.region ?? "greater_accra");
/** The language you'd most likely grow up with in a hometown. */
export const homeLanguage = (city: string) => languagesOfCity(city)[0];

export function sanitizeLanguages(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return [...new Set(v.filter((x): x is string => typeof x === "string" && x in LANGUAGES))].slice(0, MAX_LANGUAGES);
}

export type Priority = "family" | "faith" | "money" | "friends" | "health" | "fun";
export const PRIORITIES: Record<Priority, { id: Priority; icon: string; label: string; text: string }> = {
  family: { id: "family", icon: "👪", label: "Family", text: "Helping and seeing family lifts you more. Calls home come up in your goals." },
  faith: { id: "faith", icon: "🙏", label: "Faith", text: "Church or mosque means more to you. Worship comes up in your goals." },
  money: { id: "money", icon: "💰", label: "Getting ahead", text: "A productive day (work, trade, business) lifts your mood. Saving comes up in your goals." },
  friends: { id: "friends", icon: "🤝", label: "Friends", text: "Good company lifts you more. Talking to people comes up in your goals." },
  health: { id: "health", icon: "💪", label: "Health", text: "Rest and keeping fresh lift you more. Exercise comes up in your goals." },
  fun: { id: "fun", icon: "🎉", label: "Enjoying life", text: "Fun lifts you more. Going out comes up in your goals." },
};
export const MAX_PRIORITIES = 2;
export function sanitizePriorities(v: unknown): Priority[] {
  if (!Array.isArray(v)) return [];
  return [...new Set(v.filter((x): x is Priority => typeof x === "string" && x in PRIORITIES))].slice(0, MAX_PRIORITIES);
}

/** Moodlets that count for more when they're in an area you care about. */
export const PRIORITY_MOODLETS: Record<Priority, string[]> = {
  family: ["helped_family"],
  faith: ["fellowship"],
  money: ["productive"],
  friends: ["connected", "in_love"],
  health: ["rested", "fresh"],
  fun: ["fun", "full"],
};
/** Daily goals that come first when they're in an area you care about. */
export const PRIORITY_GOALS: Record<Priority, string[]> = {
  family: ["family"],
  faith: ["worship"],
  money: ["save", "trade"],
  friends: ["talk"],
  health: ["exercise", "clean"],
  fun: ["fun"],
};
