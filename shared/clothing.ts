// What people wear. An outfit decides the cut (sleeves, jacket, skirt,
// smock, cloth); the look's colours and pattern decide the fabric. Shoes are
// separate and modelled on the feet. Everyone can wear anything; some
// outfits just suit some days (a suit to the office, a kaba to church, a
// jersey to football).

export type OutfitId = "tee" | "shirt" | "suit" | "kaba" | "dress" | "smock" | "kente" | "jersey";
export type ShoeId = "sneakers" | "formal" | "sandals" | "heels" | "boots" | "barefoot";

export interface Outfit {
  id: OutfitId;
  name: string;
  icon: string;
  blurb: string;
  /** How far the sleeves reach: bare arms, short, elbow or full length. */
  sleeves: "none" | "short" | "elbow" | "long";
  /** What's below the waist. */
  lower: "trousers" | "shorts" | "long_skirt" | "knee_skirt" | "cloth";
  /** Which shoes it comes with unless you choose. */
  shoes: ShoeId;
  /** Forced fabric pattern for the top, if any (smocks are woven strips, kente is kente). */
  pattern?: "stripe" | "kente";
  jacket?: boolean;
  collar?: boolean;
}

export const OUTFITS: Record<OutfitId, Outfit> = {
  tee: { id: "tee", name: "T-shirt & jeans", icon: "👕", blurb: "Everyday wear.", sleeves: "short", lower: "trousers", shoes: "sneakers" },
  shirt: { id: "shirt", name: "Shirt & trousers", icon: "👔", blurb: "Smart casual: office, bank, a first date.", sleeves: "long", lower: "trousers", shoes: "formal", collar: true },
  suit: { id: "suit", name: "Suit & tie", icon: "🤵🏾", blurb: "Jacket, white shirt and a tie. Weddings, interviews, Sunday.", sleeves: "long", lower: "trousers", shoes: "formal", jacket: true },
  kaba: { id: "kaba", name: "Kaba & slit", icon: "👗", blurb: "A fitted top and a long wrapped skirt in wax print or kente.", sleeves: "short", lower: "long_skirt", shoes: "heels" },
  dress: { id: "dress", name: "Dress", icon: "👗", blurb: "A knee-length dress.", sleeves: "short", lower: "knee_skirt", shoes: "sandals" },
  smock: { id: "smock", name: "Smock (batakari)", icon: "🧥", blurb: "Hand-woven strips from the north, flared to the hips.", sleeves: "elbow", lower: "trousers", shoes: "sandals", pattern: "stripe" },
  kente: { id: "kente", name: "Kente cloth", icon: "🧣", blurb: "Woven kente wrapped and draped, for festivals and big days.", sleeves: "none", lower: "cloth", shoes: "sandals", pattern: "kente" },
  jersey: { id: "jersey", name: "Jersey & shorts", icon: "⚽", blurb: "Football, the gym, a jog on the beach.", sleeves: "short", lower: "shorts", shoes: "sneakers" },
};

export const SHOES: Record<ShoeId, { id: ShoeId; name: string }> = {
  sneakers: { id: "sneakers", name: "Sneakers" },
  formal: { id: "formal", name: "Leather shoes" },
  sandals: { id: "sandals", name: "Sandals (charlie wote)" },
  heels: { id: "heels", name: "Heels" },
  boots: { id: "boots", name: "Boots" },
  barefoot: { id: "barefoot", name: "Barefoot" },
};

export const OUTFIT_IDS = Object.keys(OUTFITS) as OutfitId[];
export const SHOE_IDS = Object.keys(SHOES) as ShoeId[];

/** The outfit someone wears when their look doesn't say (older saves, generated people). */
export function defaultOutfit(look: { feminine: boolean; pattern?: string }): OutfitId {
  if (look.feminine && look.pattern && look.pattern !== "plain") return "kaba";
  if (look.pattern === "stripe") return "smock";
  return "shirt";
}

/** What a named character wears day to day, from their work. */
export function outfitForRole(role: string, feminine: boolean): { outfit: OutfitId; shoes?: ShoeId } {
  const r = role.toLowerCase();
  if (/bank|treasury|lawyer|manager|officer|director|engineer|realtor|estate|accountant|lecturer|pastor/.test(r)) return feminine ? { outfit: "dress", shoes: "heels" } : { outfit: "suit" };
  if (/nurse|doctor|teacher|clerk|receptionist/.test(r)) return feminine ? { outfit: "dress", shoes: "formal" } : { outfit: "shirt" };
  if (/driver|mate|loader|mechanic|fitter|farm|fisher|porter|rider|okada|security|watch/.test(r)) return { outfit: "tee", shoes: "sandals" };
  if (/football|coach|gym|boxing/.test(r)) return { outfit: "jersey" };
  if (/chief|elder|nana|alhaji|imam/.test(r)) return feminine ? { outfit: "kaba" } : { outfit: /alhaji|imam/.test(r) ? "smock" : "kente", shoes: "sandals" };
  if (/trader|seller|market|vendor|chop|food|tz|waakye|seamstress|weaver/.test(r)) return feminine ? { outfit: "kaba", shoes: "sandals" } : { outfit: "shirt", shoes: "sandals" };
  if (/dj|artist|painter|musician|creator/.test(r)) return { outfit: "tee", shoes: "sneakers" };
  return feminine ? { outfit: "kaba" } : { outfit: "shirt" };
}
