// Homes, land, construction, businesses, vehicles and financial products.
// Prices are in cedis (major units) here; the server converts to pesewas.
import { rand01 } from "./rng.ts";
import type { DistrictId } from "./world.ts";

// ---------------------------------------------------------------------------
// Rentals

export interface Rental {
  id: string;
  district: DistrictId;
  name: string;
  rent: number; // per month
  deposit: number; // months of rent paid up front (Accra landlords love advance)
  comfort: number; // 1..5, improves sleep quality
  utilities: number; // per month
  requiresRep?: number;
  blurb: string;
}

export const RENTALS: Record<string, Rental> = {
  tetteh_room: { id: "tetteh_room", district: "kaneshie", name: "Room in Tetteh compound house", rent: 450, deposit: 0, comfort: 1, utilities: 80, blurb: "Shared bathroom, a fan and Mr. Tetteh's opinions." },
  osu_single: { id: "osu_single", district: "osu", name: "Self-contained single room, Osu", rent: 1600, deposit: 3, comfort: 2, utilities: 180, blurb: "Your own bathroom and the noise of Oxford Street." },
  labadi_flat: { id: "labadi_flat", district: "labadi", name: "1-bed flat near the beach", rent: 2200, deposit: 3, comfort: 3, utilities: 220, blurb: "You can hear the waves at night." },
  spintex_apartment: { id: "spintex_apartment", district: "spintex", name: "2-bed apartment, Spintex", rent: 3400, deposit: 6, comfort: 3, utilities: 300, blurb: "Gated, generator, 20 minutes from the office (on a good day)." },
  legon_apartment: { id: "legon_apartment", district: "east_legon", name: "Furnished 2-bed, East Legon", rent: 7200, deposit: 6, comfort: 4, utilities: 500, requiresRep: 15, blurb: "Pool, gym, and neighbours with drivers." },
};

const R = (id: string, district: string, name: string, rent: number, deposit: number, comfort: number, blurb: string, requiresRep?: number): Rental =>
  ({ id, district, name, rent, deposit, comfort, utilities: Math.round(rent * 0.14 + 30), blurb, requiresRep });
for (const r of [
  R("kumasi_chamber", "adum", "Chamber & hall, Asafo (Kumasi)", 650, 6, 2, "Shared compound, private rooms, a landlady who knows everyone."),
  R("ahodwo_apartment", "adum", "2-bed apartment, Ahodwo (Kumasi)", 3_800, 6, 4, "Kumasi's quiet upscale side. Generator and a watchman.", 10),
  R("tamale_room", "tamale", "Room in a compound house, Lamashegu", 280, 6, 1, "Courtyard life: cooking smoke, children and goats."),
  R("tamale_house", "tamale", "2-bedroom house, Vittin (Tamale)", 1_500, 6, 3, "Walled, with a neem tree and space for your motorbike."),
  R("kintampo_room", "kintampo", "Single room, Kintampo", 220, 6, 1, "Near the station. Trucks rumble past all night."),
  R("techiman_chamber", "techiman", "Chamber & hall, Techiman", 380, 6, 2, "Five minutes' walk from the market."),
  R("sunyani_flat", "sunyani", "1-bed flat, Sunyani", 1_100, 6, 3, "Clean streets, quiet nights."),
  R("wa_room", "wa", "Room in a family compound, Wa", 250, 6, 1, "The family adopts you by the second week."),
  R("bole_room", "bole", "Room near Bole market", 180, 6, 1, "Simple and cool under a thatch overhang."),
  R("sawla_room", "sawla", "Room at Sawla junction", 150, 6, 1, "You'll know every bus by its horn."),
  R("damongo_room", "damongo", "Room in Damongo", 200, 6, 1, "Rangers next door."),
  R("bolga_chamber", "bolgatanga", "Chamber & hall, Bolgatanga", 300, 6, 2, "Thick walls against the heat."),
  R("nalerigu_room", "nalerigu", "Room in Nalerigu", 160, 6, 1, "Quiet, under the escarpment."),
  R("cape_flat", "cape_coast", "1-bed flat near the university, Cape Coast", 1_300, 6, 3, "Sea breeze and students."),
  R("takoradi_apartment", "takoradi", "2-bed apartment, Anaji (Takoradi)", 2_400, 6, 3, "Oil-company neighbours."),
  R("ho_chamber", "ho", "Chamber & hall, Ho", 600, 6, 2, "View of the mountains."),
  R("kof_chamber", "koforidua", "Chamber & hall, Koforidua", 650, 6, 2, "Near the bead market."),
  R("wiawso_room", "sefwi_wiawso", "Room in Sefwi Wiawso", 250, 6, 1, "Forest town quiet."),
  R("goaso_room", "goaso", "Room in Goaso", 260, 6, 1, "Mining-town prices, farming-town people."),
  R("legon_penthouse", "east_legon", "Penthouse, East Legon (furnished)", 26_000, 12, 6, "Top floor, three bedrooms, a terrace over the city and a concierge.", 20),
  R("osu_penthouse", "osu", "Penthouse, Cantonments", 34_000, 12, 6, "Embassy neighbours, sea glimpses, an island kitchen and a lift that works.", 25),
  R("trasacco_villa_rent", "trasacco", "Villa in Trasacco Valley", 48_000, 12, 6, "Pool, gatehouse, staff quarters. The guard salutes.", 30),
  R("dambai_room", "dambai", "Room near the ferry, Dambai", 200, 6, 1, "Lake breeze."),
  R("bonwire_room", "bonwire", "Room in a weaver's compound, Bonwire", 140, 6, 1, "The looms start at dawn."),
  R("nyankpala_room", "nyankpala", "Room in a farming compound, Nyankpala", 100, 6, 1, "Guinea fowl at the door."),
  R("elmina_room", "elmina", "Room by the lagoon, Elmina", 220, 6, 1, "Smoke from the fish ovens, sea at night."),
  R("paga_room", "paga", "Room in a painted compound, Paga", 100, 6, 1, "Thick walls, cool nights."),
  R("wli_room", "wli", "Room in a family house, Wli", 120, 6, 1, "The falls in earshot."),
]) RENTALS[r.id] = r;

export const STARTER_HOME = "tetteh_room";

// ---------------------------------------------------------------------------
// Land and construction

export interface Plot {
  id: string;
  district: DistrictId;
  name: string;
  price: number;
  size: string;
  requiresRep?: number;
  requiresUnlock?: string;
  allowed: string[]; // building design ids
  /** Already built: you buy the finished home (penthouses, estate houses). */
  ready?: { design: string; quality: Quality };
  blurb?: string;
}

export const PLOTS: Record<string, Plot> = {
  kaneshie_plot: { id: "kaneshie_plot", district: "kaneshie", name: "Half plot off Kaneshie First Light", price: 95_000, size: "50×50 ft", allowed: ["chamber_hall", "bungalow", "shop_block"] },
  spintex_plot: { id: "spintex_plot", district: "spintex", name: "Plot in Spintex Community 18", price: 150_000, size: "70×100 ft", allowed: ["chamber_hall", "bungalow", "family_house", "shop_block", "apartments"] },
  labadi_plot: { id: "labadi_plot", district: "labadi", name: "Beachfront plot, La", price: 520_000, size: "80×100 ft", requiresUnlock: "nii_blessing", allowed: ["bungalow", "family_house", "villa", "apartments"] },
  legon_plot: { id: "legon_plot", district: "east_legon", name: "Plot near Legon Boulevard", price: 480_000, size: "70×100 ft", requiresRep: 15, allowed: ["bungalow", "family_house", "villa", "apartments"] },
  trasacco_plot: { id: "trasacco_plot", district: "trasacco", name: "Valley plot with golf-course view", price: 1_900_000, size: "100×120 ft", requiresRep: 35, allowed: ["family_house", "villa", "mansion"] },
};
PLOTS.legon_plot.allowed.push("mansion", "guesthouse");
PLOTS.spintex_plot.allowed.push("compound_house", "guesthouse");
PLOTS.kaneshie_plot.allowed.push("compound_house");

const PL = (id: string, district: string, name: string, price: number, size: string, allowed: string[], requiresRep?: number): Plot => ({ id, district, name, price, size, allowed, requiresRep });
for (const p of [
  PL("kumasi_plot", "adum", "Plot at Kwadaso, Kumasi", 85_000, "70×100 ft", ["chamber_hall", "bungalow", "family_house", "shop_block", "compound_house"]),
  PL("ahodwo_plot", "adum", "Plot in Ahodwo, Kumasi", 420_000, "100×100 ft", ["family_house", "villa", "mansion", "apartments", "guesthouse"], 15),
  PL("tamale_plot", "tamale", "Plot at Kalpohin, Tamale", 28_000, "70×100 ft", ["northern_compound", "chamber_hall", "bungalow", "family_house", "compound_house", "guesthouse", "shop_block"]),
  PL("kintampo_plot", "kintampo", "Roadside plot on the N10, Kintampo", 15_000, "70×100 ft", ["chamber_hall", "bungalow", "guesthouse", "shop_block", "compound_house"]),
  PL("techiman_plot", "techiman", "Plot near Techiman market", 30_000, "50×100 ft", ["chamber_hall", "bungalow", "shop_block", "compound_house"]),
  PL("sunyani_plot", "sunyani", "Plot at Abesim, Sunyani", 45_000, "70×100 ft", ["bungalow", "family_house", "apartments", "shop_block", "guesthouse"]),
  PL("wa_plot", "wa", "Plot in Wa", 14_000, "70×100 ft", ["northern_compound", "chamber_hall", "bungalow", "guesthouse"]),
  PL("bole_plot", "bole", "Family land in Bole", 9_000, "100×100 ft", ["northern_compound", "chamber_hall", "bungalow", "shop_block"]),
  PL("sawla_plot", "sawla", "Plot at Sawla junction", 7_000, "70×100 ft", ["northern_compound", "chamber_hall", "shop_block", "guesthouse"]),
  PL("damongo_plot", "damongo", "Plot on the Mole road, Damongo", 10_000, "70×100 ft", ["northern_compound", "bungalow", "guesthouse"]),
  PL("bolga_plot", "bolgatanga", "Plot in Bolgatanga", 13_000, "70×100 ft", ["northern_compound", "chamber_hall", "bungalow", "guesthouse"]),
  PL("nalerigu_plot", "nalerigu", "Family land, Nalerigu", 7_000, "100×100 ft", ["northern_compound", "chamber_hall"]),
  PL("cape_plot", "cape_coast", "Plot near the coast road, Cape Coast", 60_000, "70×100 ft", ["bungalow", "family_house", "guesthouse", "apartments"]),
  PL("takoradi_plot", "takoradi", "Plot at Anaji, Takoradi", 95_000, "70×100 ft", ["bungalow", "family_house", "apartments", "villa", "shop_block", "mansion"]),
  PL("ho_plot", "ho", "Plot in Ho", 38_000, "70×100 ft", ["chamber_hall", "bungalow", "family_house", "guesthouse"]),
  PL("kof_plot", "koforidua", "Plot in Koforidua", 48_000, "70×100 ft", ["bungalow", "family_house", "guesthouse"]),
  PL("wiawso_plot", "sefwi_wiawso", "Plot in Sefwi Wiawso", 18_000, "70×100 ft", ["chamber_hall", "bungalow", "compound_house"]),
  PL("goaso_plot", "goaso", "Plot in Goaso", 20_000, "70×100 ft", ["chamber_hall", "bungalow", "compound_house"]),
  { id: "legon_penthouse_unit", district: "east_legon", name: "Penthouse unit, East Legon tower", price: 3_400_000, size: "320 m², top floor", allowed: ["penthouse_unit"], requiresRep: 20, ready: { design: "penthouse_unit", quality: "premium" as const }, blurb: "Turnkey: three ensuite bedrooms, chef's kitchen, terrace." },
  { id: "osu_penthouse_unit", district: "osu", name: "Penthouse, Cantonments", price: 4_900_000, size: "410 m², top floor", allowed: ["penthouse_unit"], requiresRep: 25, ready: { design: "penthouse_unit", quality: "premium" as const }, blurb: "Sea glimpses, embassy row, private lift." },
  { id: "trasacco_mansion_ready", district: "trasacco", name: "Finished mansion, Trasacco Valley", price: 14_500_000, size: "1 acre", allowed: ["mansion"], requiresRep: 40, ready: { design: "mansion", quality: "premium" as const }, blurb: "Seven bedrooms, pool, staff quarters, gatehouse. Move in tomorrow." },
  { id: "kotoka_hangar", district: "airport_city", name: "Hangar 7, General Aviation, Kotoka", price: 9_500_000, size: "40×30 m hangar", allowed: ["hangar"], requiresRep: 20, ready: { design: "hangar", quality: "standard" as const }, blurb: "Space for a jet or two helicopters. Lease it out or park your own aircraft." },
  { id: "spintex_house_ready", district: "spintex", name: "Finished 4-bedroom house, Spintex estate", price: 1_250_000, size: "70×100 ft", allowed: ["family_house"], ready: { design: "family_house", quality: "standard" as const }, blurb: "Gated estate, walled compound, a garden." },
  PL("dambai_plot", "dambai", "Plot in Dambai", 12_000, "70×100 ft", ["chamber_hall", "bungalow", "guesthouse"]),
]) PLOTS[p.id] = p;

export interface Design {
  id: string;
  name: string;
  baseCost: number;
  /** Stages: name, share of total cost, build days at base quality. */
  stages: { name: string; share: number; days: number }[];
  comfort: number;
  rentYield: number; // monthly rent as a share of built value
  kind: "home" | "commercial";
}

const STD_STAGES = (days: number[]) => [
  { name: "Foundation", share: 0.2, days: days[0] },
  { name: "Blockwork", share: 0.3, days: days[1] },
  { name: "Roofing", share: 0.2, days: days[2] },
  { name: "Finishing", share: 0.3, days: days[3] },
];

export const DESIGNS: Record<string, Design> = {
  chamber_hall: { id: "chamber_hall", name: "Chamber & hall", baseCost: 70_000, stages: STD_STAGES([1, 1, 1, 1]), comfort: 2, rentYield: 0.009, kind: "home" },
  bungalow: { id: "bungalow", name: "2-bedroom bungalow", baseCost: 180_000, stages: STD_STAGES([1, 2, 1, 2]), comfort: 3, rentYield: 0.008, kind: "home" },
  family_house: { id: "family_house", name: "4-bedroom family house", baseCost: 420_000, stages: STD_STAGES([2, 3, 2, 3]), comfort: 4, rentYield: 0.0075, kind: "home" },
  villa: { id: "villa", name: "Luxury villa with pool", baseCost: 1_400_000, stages: [...STD_STAGES([2, 4, 2, 4]), { name: "Pool & landscaping", share: 0, days: 2 }].map((s, i, arr) => ({ ...s, share: i === arr.length - 1 ? 0.12 : s.share * 0.88 })), comfort: 5, rentYield: 0.007, kind: "home" },
  shop_block: { id: "shop_block", name: "Row of 4 shops", baseCost: 120_000, stages: STD_STAGES([1, 1, 1, 1]), comfort: 0, rentYield: 0.014, kind: "commercial" },
  apartments: { id: "apartments", name: "6-unit apartment block", baseCost: 900_000, stages: STD_STAGES([2, 4, 2, 4]), comfort: 3, rentYield: 0.011, kind: "commercial" },
  northern_compound: { id: "northern_compound", name: "Northern compound (round rooms & courtyard)", baseCost: 45_000, stages: [{ name: "Foundation", share: 0.15, days: 1 }, { name: "Mud & cement walls", share: 0.4, days: 1 }, { name: "Thatch & zinc roofs", share: 0.25, days: 1 }, { name: "Plaster & paint", share: 0.2, days: 1 }], comfort: 2, rentYield: 0.008, kind: "home" },
  compound_house: { id: "compound_house", name: "Compound house (10 rooms around a courtyard)", baseCost: 260_000, stages: STD_STAGES([1, 2, 1, 2]), comfort: 2, rentYield: 0.013, kind: "commercial" },
  guesthouse: { id: "guesthouse", name: "12-room guesthouse", baseCost: 650_000, stages: STD_STAGES([2, 3, 2, 3]), comfort: 3, rentYield: 0.013, kind: "commercial" },
  hangar: { id: "hangar", name: "Private aircraft hangar", baseCost: 6_500_000, stages: STD_STAGES([1, 1, 1, 1]), comfort: 0, rentYield: 0.009, kind: "commercial" },
  penthouse_unit: { id: "penthouse_unit", name: "Penthouse", baseCost: 2_400_000, stages: STD_STAGES([1, 1, 1, 1]), comfort: 6, rentYield: 0.007, kind: "home" },
  mansion: { id: "mansion", name: "Mansion (7 bedrooms, pool, gatehouse & boys' quarters)", baseCost: 3_800_000, stages: [...STD_STAGES([3, 5, 3, 5]), { name: "Pool, gardens & gatehouse", share: 0, days: 3 }].map((s, i, arr) => ({ ...s, share: i === arr.length - 1 ? 0.15 : s.share * 0.85 })), comfort: 6, rentYield: 0.0065, kind: "home" },
};

export type Quality = "basic" | "standard" | "premium";
export const QUALITY: Record<Quality, { label: string; cost: number; value: number; days: number; comfort: number }> = {
  basic: { label: "Basic", cost: 1, value: 1.15, days: 1, comfort: 0 },
  standard: { label: "Standard", cost: 1.45, value: 1.75, days: 1.25, comfort: 1 },
  premium: { label: "Premium", cost: 2.2, value: 2.75, days: 1.5, comfort: 2 },
};
export const QUALITY_ORDER: Quality[] = ["basic", "standard", "premium"];

export function stagePlan(designId: string, quality: Quality) {
  const d = DESIGNS[designId];
  const q = QUALITY[quality];
  const total = d.baseCost * q.cost;
  return d.stages.map((s) => ({ name: s.name, cost: Math.round(total * s.share), days: Math.max(1, Math.round(s.days * q.days)) }));
}

/** Upgrading a finished building to the next quality level. */
export function upgradeCost(designId: string, from: Quality): { to: Quality; cost: number; days: number } | null {
  const i = QUALITY_ORDER.indexOf(from);
  if (i < 0 || i >= QUALITY_ORDER.length - 1) return null;
  const to = QUALITY_ORDER[i + 1];
  const d = DESIGNS[designId];
  const cost = Math.round(d.baseCost * (QUALITY[to].cost - QUALITY[from].cost) * 1.1);
  return { to, cost, days: 2 + i };
}

export function builtValue(plotPrice: number, designId: string, quality: Quality): number {
  return Math.round(plotPrice * 1.1 + DESIGNS[designId].baseCost * QUALITY[quality].value);
}

// ---------------------------------------------------------------------------
// Businesses

export interface BusinessType {
  id: string;
  name: string;
  district: DistrictId;
  price: number;
  revenue: number; // daily at level 1
  costs: number; // daily at level 1
  outdoor: boolean; // rain hurts it
  weekend: number; // weekend revenue multiplier
  requiresRep?: number;
  requiresUnlock?: string;
  foodBusiness?: boolean;
  blurb: string;
}

export const BUSINESSES: Record<string, BusinessType> = {
  phone_kiosk: { id: "phone_kiosk", name: "Phone accessories kiosk", district: "kaneshie", price: 12_000, revenue: 300, costs: 175, outdoor: false, weekend: 1.1, blurb: "Chargers, screen guards and airtime." },
  barbershop: { id: "barbershop", name: "Barbershop", district: "kaneshie", price: 28_000, revenue: 620, costs: 390, outdoor: false, weekend: 1.3, blurb: "Two chairs, a TV and endless debate." },
  waakye_joint: { id: "waakye_joint", name: "Waakye joint", district: "osu", price: 35_000, revenue: 950, costs: 600, outdoor: true, weekend: 1.1, foodBusiness: true, blurb: "A morning queue is a beautiful thing." },
  boutique: { id: "boutique", name: "Fashion boutique", district: "osu", price: 90_000, revenue: 1_550, costs: 1_000, outdoor: false, weekend: 1.35, blurb: "Kente-inspired streetwear for the Oxford Street crowd." },
  car_wash: { id: "car_wash", name: "Car wash", district: "spintex", price: 60_000, revenue: 1_350, costs: 850, outdoor: true, weekend: 1.4, blurb: "Spintex dust is your business partner." },
  trotro_line: { id: "trotro_line", name: "Trotro (Kaneshie–Circle line)", district: "kaneshie", price: 160_000, revenue: 1_900, costs: 1_200, outdoor: true, weekend: 0.7, blurb: "A 15-seater, a driver and a mate." },
  beach_bar: { id: "beach_bar", name: "Beach bar", district: "labadi", price: 140_000, revenue: 2_700, costs: 1_750, outdoor: true, weekend: 1.6, requiresRep: 10, foodBusiness: true, blurb: "Cold drinks, hot grills and Sunday crowds." },
  cafe: { id: "cafe", name: "Specialty café", district: "east_legon", price: 260_000, revenue: 4_200, costs: 2_800, outdoor: false, weekend: 1.25, requiresRep: 15, foodBusiness: true, blurb: "Ghanaian coffee, laptops and brunch." },
  boutique_hotel: { id: "boutique_hotel", name: "Boutique hotel", district: "trasacco", price: 3_200_000, revenue: 34_000, costs: 22_500, outdoor: false, weekend: 1.3, requiresRep: 40, blurb: "Twelve suites for diplomats and returnees." },
};

const B = (b: BusinessType) => b;
for (const b of [
  B({ id: "momo_kiosk", name: "Mobile money kiosk", district: "osu", price: 8_000, revenue: 220, costs: 120, outdoor: true, weekend: 0.9, blurb: "Cash-in, cash-out, airtime. The umbrella is the office." }),
  B({ id: "phone_shop", name: "Phone shop, Oxford Street", district: "osu", price: 110_000, revenue: 2_100, costs: 1_400, outdoor: false, weekend: 1.3, blurb: "New and tokunbo phones, repairs and accessories." }),
  B({ id: "real_estate_agency", name: "Real estate agency", district: "east_legon", price: 350_000, revenue: 5_200, costs: 3_500, outdoor: false, weekend: 0.8, requiresRep: 20, blurb: "List, show and sell. Your commission is 5%." }),
  B({ id: "kejetia_stall", name: "Cloth stall in Kejetia", district: "adum", price: 25_000, revenue: 520, costs: 330, outdoor: false, weekend: 1.3, blurb: "Wax print and kente, folded high." }),
  B({ id: "kumasi_chop_bar", name: "Chop bar in Adum", district: "adum", price: 55_000, revenue: 1_250, costs: 820, outdoor: false, weekend: 1.2, foodBusiness: true, blurb: "Two fufu pounders, a big pot of light soup." }),
  B({ id: "fitting_shop", name: "Fitting shop, Suame Magazine", district: "adum", price: 70_000, revenue: 1_500, costs: 980, outdoor: true, weekend: 0.8, requiresUnlock: "cert_mechanic", blurb: "Engines, gearboxes and three apprentices." }),
  B({ id: "sokoban_workshop", name: "Furniture workshop, Sokoban", district: "adum", price: 85_000, revenue: 1_650, costs: 1_100, outdoor: true, weekend: 0.9, blurb: "Sawdust, varnish and orders from all over Ashanti." }),
  B({ id: "tamale_provision", name: "Provision shop, Tamale", district: "tamale", price: 18_000, revenue: 380, costs: 240, outdoor: false, weekend: 1.1, blurb: "Sugar, milk, Milo, rice, soap, credit for regulars." }),
  B({ id: "shea_processing", name: "Shea butter processing centre", district: "tamale", price: 60_000, revenue: 1_200, costs: 780, outdoor: true, weekend: 0.9, blurb: "Twenty women, roasters, a grinding mill and export buyers." }),
  B({ id: "smock_tailor", name: "Smock tailoring shop, Tamale", district: "tamale", price: 22_000, revenue: 480, costs: 300, outdoor: false, weekend: 1.2, requiresUnlock: "cert_tailoring", blurb: "Woven strips in, finished batakari out." }),
  B({ id: "kintampo_guesthouse", name: "Roadside guesthouse, Kintampo", district: "kintampo", price: 160_000, revenue: 2_400, costs: 1_550, outdoor: false, weekend: 1.2, blurb: "Drivers and waterfall tourists, every night." }),
  B({ id: "kintampo_chop", name: "Highway chop bar, Kintampo", district: "kintampo", price: 40_000, revenue: 1_000, costs: 650, outdoor: true, weekend: 1.1, foodBusiness: true, blurb: "Every bus stops. Every driver eats." }),
  B({ id: "yam_trade", name: "Yam trading, Techiman", district: "techiman", price: 75_000, revenue: 1_700, costs: 1_150, outdoor: true, weekend: 1, blurb: "Buy from the farm gate, sell to the Accra queens." }),
  B({ id: "cashew_trade", name: "Cashew aggregation, Bole", district: "bole", price: 90_000, revenue: 2_000, costs: 1_350, outdoor: false, weekend: 1, blurb: "Buy from farmers, sell to exporters by the container." }),
  B({ id: "pito_brewery", name: "Pito brewery, Wa", district: "wa", price: 12_000, revenue: 280, costs: 165, outdoor: true, weekend: 1.4, foodBusiness: true, blurb: "Big clay pots, millet and a loyal evening crowd." }),
  B({ id: "basket_export", name: "Basket export business, Bolga", district: "bolgatanga", price: 45_000, revenue: 950, costs: 620, outdoor: false, weekend: 1, blurb: "Pay weavers fairly, ship to shops in Europe." }),
  B({ id: "cape_guesthouse", name: "Beach guesthouse, Cape Coast", district: "cape_coast", price: 240_000, revenue: 3_400, costs: 2_200, outdoor: false, weekend: 1.4, requiresRep: 5, blurb: "Ten rooms facing the sea, full every Easter and December." }),
  B({ id: "cold_store", name: "Cold store, Takoradi", district: "takoradi", price: 120_000, revenue: 2_300, costs: 1_520, outdoor: false, weekend: 1, blurb: "Frozen mackerel and chicken by the carton." }),
  B({ id: "akple_joint", name: "Akple joint, Ho", district: "ho", price: 30_000, revenue: 720, costs: 460, outdoor: false, weekend: 1.2, foodBusiness: true, blurb: "Okro soup, crab and loyal customers." }),
  B({ id: "bead_workshop", name: "Bead workshop, Koforidua", district: "koforidua", price: 20_000, revenue: 450, costs: 280, outdoor: false, weekend: 1, blurb: "Glass, moulds and a kiln." }),
  B({ id: "chemical_shop", name: "Chemical shop, Sunyani", district: "sunyani", price: 65_000, revenue: 1_300, costs: 850, outdoor: false, weekend: 0.9, blurb: "Licensed over-the-counter medicines and good advice." }),
]) BUSINESSES[b.id] = b;

export const MAX_BUSINESS_LEVEL = 5;
export const businessUpgradeCost = (price: number, level: number) => Math.round(price * 0.45 * level);
export const BUSINESS_UPGRADE_DAYS = 2;
export const levelRevenue = (base: number, level: number) => base * Math.pow(1.28, level - 1);
export const levelCosts = (base: number, level: number) => base * Math.pow(1.17, level - 1);
export const businessValue = (price: number, level: number) => Math.round(price * (1 + 0.35 * (level - 1)));
/** Staff: attendants add trade (one per level, up to 3); a manager keeps it running when you're away. Wages come out of the till daily. */
export const attendantWage = (t: { revenue: number }) => Math.max(40, Math.round(t.revenue * 0.08));
export const managerWage = (t: { revenue: number }) => Math.max(90, Math.round(t.revenue * 0.15));
export const maxAttendants = (level: number) => Math.min(3, level);
export const ATTENDANT_BOOST = 0.15;
export const MANAGER_BOOST = 0.05;
/** Days of wages owed when you let someone go. */
export const SEVERANCE_DAYS = 3;
/** Days without the owner visiting the district before the business starts slipping. */
export const NEGLECT_DAYS = 7;

/** Deterministic daily demand noise for a business so tests are reproducible. */
export const demandNoise = (bizId: number | string, day: number) => 0.85 + rand01(`demand:${bizId}:${day}`) * 0.3;

// ---------------------------------------------------------------------------
// Vehicles

export { VEHICLES, type Vehicle } from "./life.ts";
export const VEHICLE_DEPRECIATION_PER_MONTH = 0.012;

// ---------------------------------------------------------------------------
// Finance products

export const SAVINGS_RATE = 0.06; // per year, paid daily
export const USD_RATE = 0.02;
export const LOAN_RATE = 0.32;
export const LOAN_MIN_REPAYMENT = 0.1; // share of balance due monthly
export const FX_SPREAD = 0.015;

export const TBILLS: Record<string, { id: string; name: string; days: number; rate: number; min: number }> = {
  t7: { id: "t7", name: "7-day bill", days: 7, rate: 0.18, min: 100 },
  t14: { id: "t14", name: "14-day bill", days: 14, rate: 0.21, min: 100 },
  t28: { id: "t28", name: "28-day bill", days: 28, rate: 0.245, min: 500 },
};

/** Mid-market USD→GHS rate for a game day. Smooth trend + daily noise. */
export function fxMid(day: number): number {
  const trend = 14.2 + 1.3 * Math.sin(day / 41) + 0.55 * Math.sin(day / 9 + 1.3);
  const noise = (rand01(`fx:${day}`) - 0.5) * 0.3;
  return Math.round((trend + noise) * 10000) / 10000;
}
export const fxBuy = (day: number) => fxMid(day) * (1 + FX_SPREAD); // GHS per USD when buying dollars
export const fxSell = (day: number) => fxMid(day) * (1 - FX_SPREAD); // GHS per USD when selling dollars

export function loanLimit(monthlyIncomeMinor: number, netWorthMinor: number): number {
  return Math.max(200_000, Math.round(monthlyIncomeMinor * 3 + Math.max(0, netWorthMinor) * 0.25));
}

export const SALARY_DAY = 28;
export const PHONE_DATA_MONTHLY = 60;
