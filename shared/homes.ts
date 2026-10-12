// What a home actually is. A single room in a Kaneshie compound house has a
// shared bathroom at the end of the courtyard and a coal pot by the door; a
// penthouse has an ensuite and a chef's kitchen. This drives what you can do
// at home and how the 3D interior looks.
import type { Effects } from "./world.ts";

export type HomeTier =
  | "compound_room" | "northern_room" | "chamber_hall" | "self_contained" | "flat" | "apartment"
  | "townhouse" | "villa" | "penthouse" | "mansion";

export type Bathroom = "none" | "shared" | "private" | "ensuite";
export type Kitchen = "coalpot" | "shared" | "kitchenette" | "fitted" | "chef";

export interface HomeSpec {
  tier: HomeTier;
  label: string;
  bedrooms: number;
  bathroom: Bathroom;
  kitchen: Kitchen;
  /** Where water comes from. */
  water: "public_tap" | "compound_tap" | "polytank" | "running";
  living: boolean;
  extras: ("balcony" | "terrace" | "pool" | "garden" | "gatehouse" | "staff_quarters" | "city_view" | "sea_view" | "courtyard" | "generator")[];
  blurb: string;
}

const H = (h: HomeSpec) => h;
export const HOME_SPECS: Record<HomeTier, HomeSpec> = {
  compound_room: H({ tier: "compound_room", label: "Single room in a compound house", bedrooms: 0, bathroom: "shared", kitchen: "coalpot", water: "compound_tap", living: false, extras: ["courtyard"], blurb: "One room. The bathroom and toilet are shared with eight families; you cook on a coal pot outside your door." }),
  northern_room: H({ tier: "northern_room", label: "Room in a northern compound", bedrooms: 0, bathroom: "none", kitchen: "coalpot", water: "public_tap", living: false, extras: ["courtyard"], blurb: "A round room with a thatched roof. Bucket baths behind a low wall, water from the borehole." }),
  chamber_hall: H({ tier: "chamber_hall", label: "Chamber & hall", bedrooms: 1, bathroom: "shared", kitchen: "coalpot", water: "compound_tap", living: true, extras: ["courtyard"], blurb: "A bedroom and a hall for visitors. The bathroom is still shared; the gas cylinder lives on the veranda." }),
  self_contained: H({ tier: "self_contained", label: "Self-contained single room", bedrooms: 0, bathroom: "private", kitchen: "kitchenette", water: "polytank", living: false, extras: [], blurb: "Your own toilet and shower, a small kitchenette by the window. Privacy at last." }),
  flat: H({ tier: "flat", label: "1-bedroom flat", bedrooms: 1, bathroom: "private", kitchen: "kitchenette", water: "polytank", living: true, extras: ["balcony"], blurb: "A bedroom, a hall, a proper bathroom and a small kitchen." }),
  apartment: H({ tier: "apartment", label: "2-bedroom apartment", bedrooms: 2, bathroom: "private", kitchen: "fitted", water: "running", living: true, extras: ["balcony", "generator"], blurb: "Fitted kitchen, tiled bathroom, a generator for dumsor." }),
  townhouse: H({ tier: "townhouse", label: "Family house", bedrooms: 3, bathroom: "ensuite", kitchen: "fitted", water: "running", living: true, extras: ["garden", "generator"], blurb: "Walled compound, a garden, an ensuite master bedroom and a big family kitchen." }),
  villa: H({ tier: "villa", label: "Villa", bedrooms: 4, bathroom: "ensuite", kitchen: "chef", water: "running", living: true, extras: ["pool", "garden", "gatehouse", "generator"], blurb: "Marble floors, a pool, a gate with a watchman." }),
  penthouse: H({ tier: "penthouse", label: "Penthouse", bedrooms: 3, bathroom: "ensuite", kitchen: "chef", water: "running", living: true, extras: ["terrace", "city_view", "generator"], blurb: "Top floor. Floor-to-ceiling glass, a terrace over the city, an island kitchen." }),
  mansion: H({ tier: "mansion", label: "Mansion", bedrooms: 7, bathroom: "ensuite", kitchen: "chef", water: "running", living: true, extras: ["pool", "garden", "gatehouse", "staff_quarters", "generator"], blurb: "Double-height hall, a chandelier, staff quarters, a pool and a gatehouse." }),
};

/** Rentals and building designs → what kind of home they are. */
export const RENTAL_TIER: Record<string, HomeTier> = {
  tetteh_room: "compound_room", osu_single: "self_contained", labadi_flat: "flat", spintex_apartment: "apartment", legon_apartment: "apartment",
  kumasi_chamber: "chamber_hall", ahodwo_apartment: "apartment", tamale_room: "northern_room", tamale_house: "townhouse", kintampo_room: "compound_room",
  techiman_chamber: "chamber_hall", sunyani_flat: "flat", wa_room: "northern_room", bole_room: "northern_room", sawla_room: "northern_room",
  damongo_room: "northern_room", bolga_chamber: "chamber_hall", nalerigu_room: "northern_room", cape_flat: "flat", takoradi_apartment: "apartment",
  ho_chamber: "chamber_hall", kof_chamber: "chamber_hall", wiawso_room: "compound_room", goaso_room: "compound_room", dambai_room: "compound_room",
  legon_penthouse: "penthouse", osu_penthouse: "penthouse", trasacco_villa_rent: "villa",
};
export const DESIGN_TIER: Record<string, HomeTier> = {
  chamber_hall: "chamber_hall", bungalow: "apartment", family_house: "townhouse", villa: "villa", shop_block: "chamber_hall", apartments: "apartment",
  northern_compound: "northern_room", compound_house: "chamber_hall", guesthouse: "apartment", mansion: "mansion", penthouse_unit: "penthouse", hangar: "apartment",
};
export function tierForHome(kind: "rental" | "owned", ref: string): HomeTier {
  return kind === "rental" ? RENTAL_TIER[ref] ?? "compound_room" : DESIGN_TIER[ref] ?? "apartment";
}

// ---------------------------------------------------------------------------
// Things people do at home.

export interface HomeActivity {
  id: string;
  label: string;
  verb: string;
  minutes: number;
  cost: number; // cedis
  effects: Effects;
  /** Which homes allow it, and what else is needed. */
  when: (s: HomeSpec, items: string[]) => boolean;
  note: (s: HomeSpec) => string;
}

const has = (items: string[], ...ids: string[]) => ids.some((i) => items.includes(i));
export const HOME_ACTIVITIES: HomeActivity[] = [
  { id: "shower", label: "Shower", verb: "Shower", minutes: 15, cost: 0, effects: { hygiene: 80, health: 2, social: 2, energy: 4 }, when: (s) => s.bathroom === "private" || s.bathroom === "ensuite", note: (s) => (s.bathroom === "ensuite" ? "Rain shower in your ensuite." : "Your own bathroom.") },
  { id: "shared_bath", label: "Bath in the compound bathroom", verb: "Queue & bath", minutes: 35, cost: 0, effects: { hygiene: 65, health: 2, social: 2, energy: 2 }, when: (s) => s.bathroom === "shared", note: () => "Bucket in hand, wait for Auntie Akos to finish." },
  { id: "bucket_bath", label: "Bucket bath", verb: "Fetch water & bath", minutes: 40, cost: 1, effects: { hygiene: 60, health: 2, social: 2, energy: -2 }, when: (s) => s.bathroom === "none", note: () => "Fetch water from the tap, bath behind the low wall." },
  { id: "toilet", label: "Use the toilet", verb: "Go", minutes: 5, cost: 0, effects: { bladder: 100 }, when: (s) => s.bathroom !== "none", note: (s) => (s.bathroom === "shared" ? "The compound toilet. Knock first." : "Your own toilet.") },
  { id: "toilet_public", label: "Public toilet", verb: "Go", minutes: 15, cost: 1, effects: { bladder: 100, hygiene: -3 }, when: (s) => s.bathroom === "none", note: () => "GH₵1 at the community toilet." },
  { id: "pool_swim", label: "Swim in your pool", verb: "Swim", minutes: 45, cost: 0, effects: { fun: 30, hygiene: 10, health: 4, social: 4, energy: -6, fitness: 1 }, when: (s) => s.extras.includes("pool"), note: () => "Your own pool. The watchman pretends not to look." },
  { id: "terrace", label: "Drinks on the terrace", verb: "Relax", minutes: 60, cost: 20, effects: { fun: 20, social: 6, energy: 6 }, when: (s) => s.extras.includes("terrace") || s.extras.includes("balcony"), note: (s) => (s.extras.includes("city_view") ? "The whole city lit up below you." : "A breeze and the street below.") },
  { id: "watch_tv", label: "Watch TV", verb: "Watch", minutes: 60, cost: 0, effects: { fun: 30, energy: 6 }, when: (s, items) => has(items, "tv32", "smart_tv65") || ["villa", "penthouse", "mansion"].includes(s.tier), note: () => "News at 7, then the telenovela everyone's talking about." },
  { id: "watch_football", label: "Watch the Black Stars / Premier League", verb: "Watch", minutes: 110, cost: 0, effects: { fun: 45, social: 4, energy: 4 }, when: (s, items) => has(items, "tv32", "smart_tv65") || ["villa", "penthouse", "mansion"].includes(s.tier), note: () => "With the satellite decoder, if ECG allows." },
  { id: "neighbours", label: "Sit outside with the neighbours", verb: "Join them", minutes: 60, cost: 0, effects: { social: 16, fun: 12, energy: 2 }, when: (s) => s.extras.includes("courtyard"), note: () => "Gossip, groundnuts and somebody's radio playing highlife." },
  { id: "cook_coalpot", label: "Cook on the coal pot", verb: "Light the coal pot", minutes: 90, cost: 18, effects: { hunger: 55, health: 1, energy: -6, social: 2 }, when: (s) => s.kitchen === "coalpot", note: () => "Charcoal, a fan of cardboard, and patience." },
  { id: "cook_kitchen", label: "Cook in your kitchen", verb: "Cook", minutes: 60, cost: 14, effects: { hunger: 58, health: 2, energy: -4, social: 2 }, when: (s, items) => s.kitchen === "fitted" || s.kitchen === "chef" || (s.kitchen === "kitchenette" ? true : has(items, "gas_cooker", "standing_cooker")), note: (s) => (s.kitchen === "chef" ? "Island kitchen, gas hob, double oven." : s.kitchen === "fitted" ? "Fitted kitchen with a gas cooker." : "Two-burner kitchenette.") },
  { id: "devotion", label: "Morning devotion / prayers", verb: "Pray", minutes: 20, cost: 0, effects: { social: 3, health: 1 }, when: () => true, note: () => "Quiet time before the day begins." },
  { id: "laundry", label: "Wash clothes", verb: "Wash", minutes: 60, cost: 3, effects: { hygiene: 15, energy: -6 }, when: () => true, note: () => "Bucket, bar soap and the sun." },
  { id: "work_from_home", label: "Work from home", verb: "Work", minutes: 180, cost: 0, effects: { work: 1, business: 1, energy: -10 }, when: (_s, items) => items.includes("laptop"), note: () => "Laptop, Wi-Fi bundle, hope there's no dumsor." },
  { id: "music", label: "Play music", verb: "Play", minutes: 45, cost: 0, effects: { fun: 22, energy: 3 }, when: () => true, note: () => "Highlife, gospel or the latest afrobeats." },
];
