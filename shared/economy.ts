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
}

export const PLOTS: Record<string, Plot> = {
  kaneshie_plot: { id: "kaneshie_plot", district: "kaneshie", name: "Half plot off Kaneshie First Light", price: 95_000, size: "50×50 ft", allowed: ["chamber_hall", "bungalow", "shop_block"] },
  spintex_plot: { id: "spintex_plot", district: "spintex", name: "Plot in Spintex Community 18", price: 150_000, size: "70×100 ft", allowed: ["chamber_hall", "bungalow", "family_house", "shop_block", "apartments"] },
  labadi_plot: { id: "labadi_plot", district: "labadi", name: "Beachfront plot, La", price: 520_000, size: "80×100 ft", requiresUnlock: "nii_blessing", allowed: ["bungalow", "family_house", "villa", "apartments"] },
  legon_plot: { id: "legon_plot", district: "east_legon", name: "Plot near Legon Boulevard", price: 480_000, size: "70×100 ft", requiresRep: 15, allowed: ["bungalow", "family_house", "villa", "apartments"] },
  trasacco_plot: { id: "trasacco_plot", district: "trasacco", name: "Valley plot with golf-course view", price: 1_900_000, size: "100×120 ft", requiresRep: 35, allowed: ["family_house", "villa"] },
};

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

export const MAX_BUSINESS_LEVEL = 5;
export const businessUpgradeCost = (price: number, level: number) => Math.round(price * 0.45 * level);
export const BUSINESS_UPGRADE_DAYS = 2;
export const levelRevenue = (base: number, level: number) => base * Math.pow(1.28, level - 1);
export const levelCosts = (base: number, level: number) => base * Math.pow(1.17, level - 1);
export const businessValue = (price: number, level: number) => Math.round(price * (1 + 0.35 * (level - 1)));
/** Days without the owner visiting the district before the business starts slipping. */
export const NEGLECT_DAYS = 7;

/** Deterministic daily demand noise for a business so tests are reproducible. */
export const demandNoise = (bizId: number | string, day: number) => 0.85 + rand01(`demand:${bizId}:${day}`) * 0.3;

// ---------------------------------------------------------------------------
// Vehicles

export interface Vehicle {
  id: string;
  name: string;
  price: number;
  reputation: number;
  color: string;
  blurb: string;
  requiresRep?: number;
}

export const VEHICLES: Record<string, Vehicle> = {
  compact: { id: "compact", name: "Used compact sedan", price: 95_000, reputation: 3, color: "#B9C4CC", blurb: "Home-used, AC works (sometimes)." },
  crossover: { id: "crossover", name: "Coastline crossover", price: 320_000, reputation: 8, color: "#7A2E2E", blurb: "Comfortable, reliable, respectable." },
  v8: { id: "v8", name: "Savanna V8 SUV", price: 1_350_000, reputation: 20, color: "#1A1A1A", requiresRep: 25, blurb: "Black, tinted, unmistakable. The dream on four wheels." },
};
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
