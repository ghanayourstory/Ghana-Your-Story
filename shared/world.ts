// The city: districts, the places inside them, what you can do there and the
// jobs on offer. Pure data shared by the server (rules) and client (rendering).
// Districts sit at their real coordinates and carry their real road names.
import { haversineKm, ROAD_FACTOR, type LatLon } from "./geo.ts";
import type { CityId } from "./cities.ts";
import { REGIONAL_DISTRICTS, REGIONAL_JOBS, REGIONAL_PLACES, REGIONAL_SERVICES, festsIn, tripsFrom } from "./regional.ts";

/** Accra districts are listed here; regional towns are added from regional.ts. */
export type DistrictId = string;
export type StatKey = "energy" | "hunger" | "health" | "social" | "fun" | "hygiene" | "bladder";
export type SkillKey = "work" | "fitness" | "charisma" | "business";
export type EffectKey = StatKey | SkillKey | "reputation";
export type Effects = Partial<Record<EffectKey, number>>;

export type DistrictStyle = "urban" | "coastal" | "market" | "corporate" | "suburban" | "luxury" | "savanna" | "town";

export interface District {
  id: DistrictId;
  name: string;
  tagline: string;
  mood: string;
  style: DistrictStyle;
  city: CityId;
  /** Real location of the stretch of road the district scene is built around. */
  geo: LatLon;
  /** Real road names: the main road (scene x axis) and the cross street (scene z axis). */
  roads: { main: string; cross: string };
  /** Compass bearing (degrees) the scene's +x axis points along, so the compass matches reality. */
  bearing: number;
  /** Price multiplier applied to food, leisure and rent in this area. */
  costOfLiving: number;
  crowd: number; // 0..1 baseline crowd density
  traffic: number; // 0..1 baseline traffic
  nightlife: number; // 0..1
  palette: { walls: string[]; roofs: string[]; ground: string; accent: string };
  landmark: string;
  /** Minimum reputation (community standing) to be welcome at the exclusive places here. */
  prestige: number;
}

export const DISTRICTS: Record<DistrictId, District> = {
  osu: {
    id: "osu",
    city: "accra",
    geo: { lat: 5.5566, lon: -0.1826 },
    roads: { main: "Oxford Street", cross: "Ring Road East" },
    bearing: 10,
    name: "Osu",
    tagline: "Oxford Street never sleeps",
    mood: "Busy, loud and stylish. Shops by day, music and grills by night.",
    style: "urban",
    costOfLiving: 1.25,
    crowd: 0.85,
    traffic: 0.8,
    nightlife: 0.95,
    palette: { walls: ["#E8D5B5", "#D9734E", "#F2C14E", "#7FB7BE", "#EFEFE6", "#C9A27E"], roofs: ["#8A3B2E", "#5B5F66", "#A0522D"], ground: "#B9A88E", accent: "#F2B705" },
    landmark: "Black Star Square",
    prestige: 0,
  },
  labadi: {
    id: "labadi",
    city: "accra",
    geo: { lat: 5.56, lon: -0.148 },
    roads: { main: "Labadi Road", cross: "La Beach Road" },
    bearing: 70,
    name: "Labadi",
    tagline: "Sand, drums and sunsets",
    mood: "Relaxed, musical and friendly. The beach comes alive on weekends.",
    style: "coastal",
    costOfLiving: 1.05,
    crowd: 0.65,
    traffic: 0.45,
    nightlife: 0.75,
    palette: { walls: ["#F4E3C1", "#5FA8A0", "#E9B872", "#F7F3E8", "#D46A4C"], roofs: ["#3E5641", "#8A3B2E", "#6D6875"], ground: "#D8C7A0", accent: "#0E7C86" },
    landmark: "Labadi Beach",
    prestige: 0,
  },
  kaneshie: {
    id: "kaneshie",
    city: "accra",
    geo: { lat: 5.568, lon: -0.235 },
    roads: { main: "Winneba Road", cross: "First Light Road" },
    bearing: 75,
    name: "Kaneshie",
    tagline: "If it's sold in Ghana, it's sold here",
    mood: "Crowded, cheap and hardworking. Trotros, traders and real hustle.",
    style: "market",
    costOfLiving: 0.8,
    crowd: 1,
    traffic: 1,
    nightlife: 0.3,
    palette: { walls: ["#D9C9A3", "#A9B4A0", "#E3A857", "#C47A5A", "#B8B8AA", "#8FA8C0"], roofs: ["#7A6A5A", "#8E5B3E", "#6B7076"], ground: "#9E8E74", accent: "#C8452C" },
    landmark: "Kaneshie Market",
    prestige: 0,
  },
  spintex: {
    id: "spintex",
    city: "accra",
    geo: { lat: 5.633, lon: -0.115 },
    roads: { main: "Spintex Road", cross: "Community 18 Road" },
    bearing: 80,
    name: "Spintex",
    tagline: "Where the 9-to-5 lives",
    mood: "Offices, warehouses and new estates. Ambitious and a little rushed.",
    style: "corporate",
    costOfLiving: 1.0,
    crowd: 0.55,
    traffic: 0.9,
    nightlife: 0.35,
    palette: { walls: ["#E6E6E0", "#B9C4CC", "#D7C4A3", "#8DA9C4", "#F0EAD6"], roofs: ["#4A5059", "#6E7681", "#8A3B2E"], ground: "#A8A08C", accent: "#2E86AB" },
    landmark: "Spintex Road",
    prestige: 0,
  },
  east_legon: {
    id: "east_legon",
    city: "accra",
    geo: { lat: 5.635, lon: -0.161 },
    roads: { main: "Boundary Road", cross: "Lagos Avenue" },
    bearing: 90,
    name: "East Legon",
    tagline: "Cafés, gates and big ambitions",
    mood: "Polished and aspirational. Who you know matters here.",
    style: "suburban",
    costOfLiving: 1.55,
    crowd: 0.45,
    traffic: 0.6,
    nightlife: 0.6,
    palette: { walls: ["#F5F1E8", "#E8DCC8", "#CFC6B8", "#BFD8D2", "#F2E2C4"], roofs: ["#3D3D3D", "#7A4B3A", "#55606E"], ground: "#9AA77F", accent: "#1F7A4D" },
    landmark: "Legon Boulevard",
    prestige: 10,
  },
  trasacco: {
    id: "trasacco",
    city: "accra",
    geo: { lat: 5.664, lon: -0.136 },
    roads: { main: "Trasacco Valley Road", cross: "Adjiringanor Road" },
    bearing: 90,
    name: "Trasacco Valley",
    tagline: "The dream, gated",
    mood: "Quiet, green and very expensive. Earned, not given.",
    style: "luxury",
    costOfLiving: 2.2,
    crowd: 0.15,
    traffic: 0.25,
    nightlife: 0.35,
    palette: { walls: ["#FAF7F0", "#EDE6D6", "#D9D4C7", "#F1E9DA"], roofs: ["#2F2F33", "#5E3B2B", "#3B4A54"], ground: "#7FA05A", accent: "#B08D57" },
    landmark: "Valley Golf Course",
    prestige: 35,
  },
};

for (const d of REGIONAL_DISTRICTS) DISTRICTS[d.id] = d;

export const DISTRICT_IDS = Object.keys(DISTRICTS) as DistrictId[];

// ---------------------------------------------------------------------------
// Services: things you can do at a place. Costs are base cedis, scaled by the
// district's cost of living. Effects are applied by the server.

export interface Service {
  id: string;
  name: string;
  verb: string;
  cost: number; // base cedis
  minutes: number;
  effects: Effects;
  hours?: [number, number]; // when the service is available (24h, end exclusive; may wrap)
  note?: string;
  requiresRep?: number;
  /** Only on these weekdays (0 = Sunday … 6 = Saturday). */
  days?: number[];
  /** Only in these months (1..12). */
  months?: number[];
  /** Only on the Akwasidae cycle (every 42 days, a Sunday). */
  cycle42?: boolean;
  /** Visiting counts as seeing this excursion site. */
  site?: string;
  /** Attending counts as this festival. */
  festival?: string;
}

export const SERVICES: Record<string, Service> = {
  public_toilet: { id: "public_toilet", name: "Public toilet", verb: "Use the toilet", cost: 1, minutes: 10, effects: { bladder: 100, hygiene: -2 } },
  waakye: { id: "waakye", name: "Waakye with shito & egg", verb: "Eat waakye", cost: 25, minutes: 25, effects: { hunger: 45, energy: 6, social: 3 }, hours: [5, 13] },
  kelewele: { id: "kelewele", name: "Kelewele & groundnuts", verb: "Buy kelewele", cost: 15, minutes: 15, effects: { hunger: 18, social: 4 }, hours: [17, 24] },
  jollof: { id: "jollof", name: "Jollof with grilled chicken", verb: "Have jollof", cost: 70, minutes: 45, effects: { hunger: 55, energy: 8, social: 6 }, hours: [11, 23] },
  fufu: { id: "fufu", name: "Fufu & light soup", verb: "Eat fufu", cost: 45, minutes: 40, effects: { hunger: 65, energy: -4, social: 4 }, hours: [10, 21] },
  banku: { id: "banku", name: "Banku & tilapia", verb: "Eat banku & tilapia", cost: 80, minutes: 50, effects: { hunger: 60, health: 2, social: 6 }, hours: [12, 23] },
  sobolo: { id: "sobolo", name: "Cold sobolo", verb: "Drink sobolo", cost: 8, minutes: 5, effects: { hunger: 4, energy: 4 } },
  coffee: { id: "coffee", name: "Flat white & pastry", verb: "Get coffee", cost: 65, minutes: 30, effects: { energy: 14, hunger: 12, social: 5 }, hours: [7, 20] },
  fine_dining: { id: "fine_dining", name: "Chef's tasting menu", verb: "Dine", cost: 650, minutes: 120, effects: { hunger: 70, social: 18, reputation: 2 }, hours: [18, 23], requiresRep: 25 },
  gym: { id: "gym", name: "Gym session", verb: "Work out", cost: 50, minutes: 90, effects: { energy: -22, hunger: -15, health: 6, fitness: 2 }, hours: [5, 22] },
  jog: { id: "jog", name: "Beach jog", verb: "Jog on the sand", cost: 0, minutes: 45, effects: { energy: -15, hunger: -8, health: 4, fitness: 1 }, hours: [5, 19] },
  swim: { id: "swim", name: "Swim & sun", verb: "Swim", cost: 20, minutes: 60, effects: { energy: -8, health: 3, social: 6 }, hours: [8, 18] },
  drum_circle: { id: "drum_circle", name: "Drum circle", verb: "Join the drummers", cost: 10, minutes: 60, effects: { social: 14, energy: -5, charisma: 1 }, hours: [15, 23] },
  club: { id: "club", name: "Night out", verb: "Dance till late", cost: 120, minutes: 180, effects: { social: 28, energy: -25, health: -3, charisma: 1 }, hours: [21, 4] },
  beach_bar: { id: "beach_bar", name: "Drinks at the shack", verb: "Hang out", cost: 45, minutes: 90, effects: { social: 16, energy: -6 }, hours: [12, 2] },
  clinic: { id: "clinic", name: "Doctor's consultation", verb: "See a doctor", cost: 150, minutes: 90, effects: { health: 30 } },
  pharmacy: { id: "pharmacy", name: "Vitamins & ORS", verb: "Buy medicine", cost: 35, minutes: 10, effects: { health: 8 } },
  haircut: { id: "haircut", name: "Fresh cut", verb: "Get a haircut", cost: 40, minutes: 40, effects: { social: 6, charisma: 1, reputation: 1 }, hours: [8, 21] },
  church: { id: "church", name: "Midweek fellowship", verb: "Attend fellowship", cost: 5, minutes: 90, effects: { social: 10, reputation: 1, energy: -3 } },
  sunday_service: { id: "sunday_service", name: "Sunday service", verb: "Go to church", cost: 10, minutes: 180, effects: { social: 20, fun: 10, reputation: 2, energy: -6 }, hours: [7, 12], days: [0] },
  nap: { id: "nap", name: "Nap", verb: "Take a nap", cost: 0, minutes: 120, effects: { energy: 22, hunger: -6 } },
  sleep: { id: "sleep", name: "Sleep", verb: "Sleep 8 hours", cost: 0, minutes: 480, effects: { energy: 70, hunger: -18, health: 4 } },
  course: { id: "course", name: "Evening course", verb: "Take a class", cost: 120, minutes: 180, effects: { energy: -18, work: 2, business: 1 }, hours: [17, 21] },
  coworking: { id: "coworking", name: "Co-working day", verb: "Study & network", cost: 90, minutes: 240, effects: { energy: -15, work: 2, social: 6, charisma: 1 }, hours: [8, 20] },
  golf: { id: "golf", name: "Nine holes", verb: "Play golf", cost: 900, minutes: 180, effects: { social: 20, health: 4, reputation: 3, business: 1 }, hours: [6, 18], requiresRep: 30 },
  view: { id: "view", name: "Take in the view", verb: "Look around", cost: 0, minutes: 20, effects: { social: 3, health: 1 } },
  ...REGIONAL_SERVICES,
};

// ---------------------------------------------------------------------------
// Jobs

export interface Job {
  id: string;
  title: string;
  placeId: string;
  /** Base pay per shift in cedis, before rank bonus. */
  pay: number;
  hours: number;
  shiftWindow: [number, number]; // shifts must start inside this window
  weekdaysOnly?: boolean;
  salaried?: boolean; // salaried jobs accrue and pay on the 28th of each month
  requires: Partial<Record<SkillKey | "reputation", number>>;
  energyCost: number;
  skillGain: Partial<Record<SkillKey, number>>;
  blurb: string;
  /** A licence or certificate you must hold (unlock id). */
  needsUnlock?: string;
  /** Gig work on your own wheels. */
  needsVehicle?: "car" | "motorbike";
}

export const JOBS: Record<string, Job> = {
  market_loader: { id: "market_loader", title: "Market loader", placeId: "kaneshie_market", pay: 90, hours: 6, shiftWindow: [5, 13], requires: {}, energyCost: 38, skillGain: { fitness: 1, work: 1 }, blurb: "Carry goods for traders. Hard on the back, paid in cash." },
  trotro_mate: { id: "trotro_mate", title: "Trotro mate", placeId: "kaneshie_station", pay: 130, hours: 8, shiftWindow: [5, 12], requires: {}, energyCost: 34, skillGain: { charisma: 1, work: 1 }, blurb: "Call the route, collect fares, keep the bus moving." },
  waakye_server: { id: "waakye_server", title: "Waakye server", placeId: "esi_waakye", pay: 100, hours: 6, shiftWindow: [5, 9], requires: {}, energyCost: 26, skillGain: { charisma: 1, business: 1 }, blurb: "Help Auntie Esi through the morning rush." },
  beach_bar_staff: { id: "beach_bar_staff", title: "Beach bar host", placeId: "sunset_shack", pay: 150, hours: 7, shiftWindow: [14, 19], requires: { charisma: 8 }, energyCost: 28, skillGain: { charisma: 2 }, blurb: "Pour drinks, run the music, keep the vibe right." },
  call_centre: { id: "call_centre", title: "Call centre agent", placeId: "coastline_callcentre", pay: 240, hours: 8, shiftWindow: [7, 11], weekdaysOnly: true, salaried: true, requires: { work: 12 }, energyCost: 30, skillGain: { work: 2, charisma: 1 }, blurb: "Headset on. Patience is the job." },
  bank_teller: { id: "bank_teller", title: "Bank officer", placeId: "coastline_bank_hq", pay: 420, hours: 8, shiftWindow: [7, 10], weekdaysOnly: true, salaried: true, requires: { work: 30, reputation: 10 }, energyCost: 28, skillGain: { work: 2, business: 1 }, blurb: "Accounts, transfers and very particular customers." },
  property_agent: { id: "property_agent", title: "Property agent", placeId: "boateng_realty", pay: 330, hours: 7, shiftWindow: [8, 12], requires: { charisma: 25, business: 10 }, energyCost: 26, skillGain: { charisma: 2, business: 2 }, blurb: "Show houses, close deals, earn trust." },
  software_dev: { id: "software_dev", title: "Software developer", placeId: "kente_labs", pay: 720, hours: 8, shiftWindow: [8, 12], weekdaysOnly: true, salaried: true, requires: { work: 50 }, energyCost: 30, skillGain: { work: 3, business: 1 }, blurb: "Ship features for fintechs across West Africa." },
  // Stage 2: trades, care, night work and gigs on your own wheels.
  chop_cook: { id: "chop_cook", title: "Chop bar cook", placeId: "mama_adwoa", pay: 115, hours: 7, shiftWindow: [9, 12], requires: {}, energyCost: 30, skillGain: { work: 1, business: 1 }, blurb: "Pound fufu, stir the light soup, keep the pots going for the lunch crowd." },
  barber_apprentice: { id: "barber_apprentice", title: "Barbering apprentice", placeId: "nima_barber", pay: 85, hours: 7, shiftWindow: [8, 13], requires: {}, energyCost: 18, skillGain: { charisma: 1, work: 1 }, blurb: "Sweep, line up the clippers, and learn the fades from the master." },
  tailor_apprentice: { id: "tailor_apprentice", title: "Tailoring apprentice", placeId: "nima_tailor", pay: 85, hours: 8, shiftWindow: [8, 12], requires: {}, energyCost: 16, skillGain: { work: 1, business: 1 }, blurb: "Cut kaba patterns, hem trousers, and run to the market for buttons." },
  night_watchman: { id: "night_watchman", title: "Night security", placeId: "sankofa_clinic", pay: 140, hours: 10, shiftWindow: [18, 22], requires: {}, energyCost: 30, skillGain: { fitness: 1 }, blurb: "A torch, a stool by the clinic gate and a long night. Paid every morning." },
  nursing_aide: { id: "nursing_aide", title: "Nursing aide", placeId: "mamobi_polyclinic", pay: 170, hours: 8, shiftWindow: [6, 9], requires: { work: 10 }, energyCost: 30, skillGain: { work: 1, charisma: 1 }, blurb: "Take vitals, help patients to the ward, keep the queue moving." },
  pupil_teacher: { id: "pupil_teacher", title: "Evening class tutor", placeId: "kaneshie_school", pay: 120, hours: 4, shiftWindow: [16, 18], weekdaysOnly: true, requires: { work: 15 }, energyCost: 18, skillGain: { charisma: 1, work: 1 }, blurb: "Teach WASSCE maths to adults resitting the exam after their day jobs." },
  fitting_mechanic: { id: "fitting_mechanic", title: "Fitting-shop mechanic", placeId: "tokunbo_lot", pay: 150, hours: 8, shiftWindow: [8, 10], requires: { work: 8, fitness: 5 }, energyCost: 34, skillGain: { work: 1, fitness: 1 }, blurb: "Under the bonnet of home-used cars all day. Oil to your elbows." },
  delivery_rider: { id: "delivery_rider", title: "Food delivery rider", placeId: "oxford_grill", pay: 160, hours: 6, shiftWindow: [11, 18], requires: {}, energyCost: 26, skillGain: { fitness: 1, work: 1 }, needsUnlock: "licence_a", needsVehicle: "motorbike", blurb: "Your own motorbike, a box on the back, and Oxford Street orders to the whole of Osu." },
  ride_driver: { id: "ride_driver", title: "Ride-app driver", placeId: "airport_stop", pay: 260, hours: 8, shiftWindow: [5, 16], requires: {}, energyCost: 28, skillGain: { charisma: 1, work: 1 }, needsUnlock: "licence_b", needsVehicle: "car", blurb: "Your own car, the app on your phone, and airport runs that pay the most." },
  hotel_manager: { id: "hotel_manager", title: "Hotel general manager", placeId: "royal_palm", pay: 1300, hours: 9, shiftWindow: [7, 11], salaried: true, requires: { work: 70, business: 40, reputation: 40 }, energyCost: 32, skillGain: { business: 3, charisma: 1 }, blurb: "Run the finest small hotel in the Valley." },
};

/** Promotions: every N shifts at a job raises your rank (max 4) and pay by 15% per rank. */
export const SHIFTS_PER_RANK = 10;
export const MAX_RANK = 4;
export const rankPay = (base: number, rank: number) => Math.round(base * (1 + 0.15 * rank));
export const RANK_TITLES = ["Junior", "", "Senior", "Lead", "Head"];

// ---------------------------------------------------------------------------
// Places

export type PlaceKind = "food" | "work" | "bank" | "gym" | "clinic" | "nightlife" | "beach" | "market" | "realtor" | "home" | "church" | "transport" | "landmark" | "shop" | "school" | "dealer" | "mosque" | "lodge" | "tour" | "furniture" | "phone" | "mall" | "shrine" | "airport" | "hangar" | "court";

export interface Place {
  id: string;
  district: DistrictId;
  name: string;
  kind: PlaceKind;
  sign: string;
  /** Local position in the district scene (metres). */
  pos: [number, number];
  /** Building footprint and height. */
  size: [number, number, number];
  color: string;
  open: [number, number];
  services: string[];
  blurb: string;
  /** Real coordinates for real public landmarks. */
  geo?: LatLon;
}

const P = (p: Place) => p;

export const PLACES: Place[] = [
  // --- Osu
  P({ id: "esi_waakye", district: "osu", name: "Auntie Esi's Waakye", kind: "food", sign: "AUNTIE ESI'S WAAKYE • GOD IS KING", pos: [-30, 15], size: [7, 6, 3.2], color: "#F2C14E", open: [5, 14], services: ["waakye", "sobolo"], blurb: "The best waakye on Oxford Street. Queue starts at dawn." }),
  P({ id: "oxford_grill", district: "osu", name: "Oxford Street Grill", kind: "food", sign: "OXFORD ST. GRILL & JOLLOF", pos: [-6, -16], size: [12, 9, 7], color: "#D9734E", open: [11, 24], services: ["jollof", "banku", "sobolo"], blurb: "Smoky grills, loud jollof debates." }),
  P({ id: "osu_night_market", district: "osu", name: "Osu Night Market", kind: "market", sign: "NIGHT MARKET", pos: [24, 16], size: [14, 8, 3.5], color: "#C8452C", open: [16, 2], services: ["kelewele", "sobolo"], blurb: "Kelewele, khebab and gossip under string lights." }),
  P({ id: "sankofa_clinic", district: "osu", name: "Sankofa Clinic", kind: "clinic", sign: "SANKOFA CLINIC & PHARMACY", pos: [40, -16], size: [12, 10, 8], color: "#EFEFE6", open: [0, 24], services: ["clinic", "pharmacy"], blurb: "Open day and night. Dr. Adjei runs the morning shift." }),
  P({ id: "afro_lounge", district: "osu", name: "Rhythm House", kind: "nightlife", sign: "RHYTHM HOUSE • LIVE AFROBEATS", pos: [-46, -16], size: [14, 10, 8], color: "#3A2E6E", open: [20, 5], services: ["club"], blurb: "Afrobeats, amapiano and the occasional highlife legend." }),
  P({ id: "ridge_fitness", district: "osu", name: "Ridge Fitness", kind: "gym", sign: "RIDGE FITNESS", pos: [56, 15], size: [12, 9, 6], color: "#7FB7BE", open: [5, 22], services: ["gym"], blurb: "Mirrors, weights and serious people." }),
  P({ id: "osu_bank", district: "osu", name: "Coastline Bank (Osu)", kind: "bank", sign: "COASTLINE BANK", pos: [10, 16], size: [12, 9, 9], color: "#E8D5B5", open: [8, 17], services: [], blurb: "Accounts, savings and the FX desk." }),
  P({ id: "osu_station", district: "osu", name: "Osu Trotro Stop", kind: "transport", sign: "TROTRO • TAXI", pos: [-62, 14], size: [8, 4, 3], color: "#F2B705", open: [0, 24], services: [], blurb: "Catch a ride across the city." }),
  P({ id: "black_star_square", district: "osu", name: "Black Star Square", kind: "landmark", sign: "BLACK STAR SQUARE", pos: [70, -26], size: [18, 10, 14], color: "#EDE6D6", open: [0, 24], services: ["view", "jog"], blurb: "Independence Arch and the Black Star Gate, facing the sea.", geo: { lat: 5.5477, lon: -0.1923 } }),
  P({ id: "osu_castle", district: "osu", name: "Osu Castle", kind: "landmark", sign: "OSU CASTLE • FORT CHRISTIANSBORG", pos: [-48, 30], size: [14, 12, 9], color: "#F4F1E6", open: [8, 18], services: ["view"], blurb: "Built in the 1600s, seat of government for decades. The sea crashes below its walls.", geo: { lat: 5.547, lon: -0.18 } }),

  P({ id: "melcom_osu", district: "osu", name: "Melcom Osu", kind: "shop", sign: "MELCOM • OSU", pos: [-24, -16], size: [12, 9, 7], color: "#E8D5B5", open: [8, 21], services: [], blurb: "Mattresses, fans, fridges, generators and back-to-school everything." }),
  P({ id: "osu_phones", district: "osu", name: "Oxford Street Phones", kind: "phone", sign: "OXFORD ST. PHONES • REPAIRS", pos: [41, 15], size: [8, 7, 4], color: "#7FB7BE", open: [8, 22], services: [], blurb: "New phones, tokunbo phones and a guy who can fix a cracked screen in twenty minutes." }),

  // --- Labadi
  P({ id: "sunset_shack", district: "labadi", name: "Sunset Shack", kind: "nightlife", sign: "SUNSET SHACK • BEACH BAR", pos: [-18, 30], size: [12, 8, 4], color: "#E9B872", open: [12, 3], services: ["beach_bar", "banku", "sobolo"], blurb: "Bamboo, reggae, cold drinks, Selasi on the decks." }),
  P({ id: "labadi_beach", district: "labadi", name: "Labadi Beach", kind: "beach", sign: "LABADI BEACH", pos: [16, 34], size: [6, 4, 3], color: "#5FA8A0", open: [6, 22], services: ["swim", "jog", "drum_circle", "view"], blurb: "Horse rides, drummers and the Gulf of Guinea.", geo: { lat: 5.5585, lon: -0.147 } }),
  P({ id: "fish_landing", district: "labadi", name: "La Fish Landing", kind: "market", sign: "LA FISHERMEN'S LANDING", pos: [44, 28], size: [10, 7, 3], color: "#5FA8A0", open: [5, 16], services: ["banku"], blurb: "Canoes come in before noon. Nii Armah holds court." }),
  P({ id: "la_church", district: "labadi", name: "La Presby Chapel", kind: "church", sign: "LA PRESBY CHAPEL", pos: [-46, -16], size: [12, 16, 10], color: "#F7F3E8", open: [6, 20], services: ["church"], blurb: "Sunday hymns you can hear from the beach." }),
  P({ id: "labadi_stop", district: "labadi", name: "La Junction", kind: "transport", sign: "LA JUNCTION", pos: [-62, -14], size: [8, 4, 3], color: "#F2B705", open: [0, 24], services: [], blurb: "Trotros to Osu and Teshie." }),
  P({ id: "la_kpa_shrine", district: "labadi", name: "La Kpa Shrine", kind: "shrine", sign: "LA KPA SHRINE • RESPECT", pos: [-20, -16], size: [6, 6, 3.2], color: "#f4efe2", open: [6, 19], services: ["libation", "view"], blurb: "Shrine of La's guardian deity. Shoes off, no photos without the priest's permission." }),
  P({ id: "la_pharmacy", district: "labadi", name: "Wave Pharmacy", kind: "clinic", sign: "WAVE PHARMACY", pos: [20, -16], size: [8, 7, 4], color: "#F4E3C1", open: [7, 22], services: ["pharmacy"], blurb: "Plasters, ORS and sunscreen." }),

  // --- Kaneshie
  P({ id: "kaneshie_market", district: "kaneshie", name: "Kaneshie Market", kind: "market", sign: "KANESHIE MARKET COMPLEX", pos: [-20, -20], size: [34, 18, 9], color: "#D9C9A3", open: [5, 19], services: ["sobolo"], blurb: "Three floors of everything. Mind your pockets.", geo: { lat: 5.5689, lon: -0.2363 } }),
  P({ id: "kaneshie_station", district: "kaneshie", name: "Kaneshie Station", kind: "transport", sign: "KANESHIE LORRY STATION", pos: [30, -18], size: [16, 8, 4], color: "#E3A857", open: [0, 24], services: [], blurb: "The loudest trotro station in Accra." }),
  P({ id: "mama_adwoa", district: "kaneshie", name: "Mama Adwoa's Chop Bar", kind: "food", sign: "MAMA ADWOA CHOP BAR • NO CONDITION IS PERMANENT", pos: [8, 16], size: [9, 7, 3.4], color: "#C47A5A", open: [9, 21], services: ["fufu", "banku", "sobolo"], blurb: "Fufu pounded to order. Goat light soup on Fridays." }),
  P({ id: "blessed_hands", district: "kaneshie", name: "Blessed Hands Barbering", kind: "shop", sign: "BLESSED HANDS BARBERING SALON", pos: [-38, 15], size: [7, 6, 3.2], color: "#8FA8C0", open: [8, 21], services: ["haircut"], blurb: "Uncle Ebo cuts hair and argues about football." }),
  P({ id: "tetteh_compound", district: "kaneshie", name: "Tetteh Compound House", kind: "home", sign: "TETTEH HOUSE • NO URINATING", pos: [-60, 16], size: [14, 12, 4], color: "#D9C9A3", open: [0, 24], services: ["sleep", "nap"], blurb: "Your first room in the city. Shared bathroom, shared everything." }),
  P({ id: "kaneshie_church", district: "kaneshie", name: "Mount Zion Assembly", kind: "church", sign: "MOUNT ZION ASSEMBLY", pos: [56, 16], size: [12, 14, 8], color: "#EDE6D6", open: [6, 21], services: ["church"], blurb: "Loud praise, warm people." }),
  P({ id: "kaneshie_school", district: "kaneshie", name: "Accra Evening Institute", kind: "school", sign: "ACCRA EVENING INSTITUTE", pos: [36, 16], size: [12, 9, 7], color: "#A9B4A0", open: [16, 22], services: ["course"], blurb: "Accounting, IT and business classes after work." }),

  P({ id: "kaneshie_mosque", district: "kaneshie", name: "Kaneshie Mosque", kind: "mosque", sign: "KANESHIE CENTRAL MOSQUE", pos: [-55, -18], size: [10, 10, 9], color: "#E8DCC0", open: [4, 22], services: ["mosque", "jumah"], blurb: "Traders slip in between sales for prayers." }),
  P({ id: "kaneshie_phones", district: "kaneshie", name: "Kaneshie Phone Market", kind: "phone", sign: "PHONES • ACCESSORIES • MOMO", pos: [-14, 15], size: [8, 7, 4], color: "#8FA8C0", open: [7, 20], services: [], blurb: "Rows of glass counters. Haggle hard." }),
  P({ id: "kaneshie_carpenters", district: "kaneshie", name: "Carpenters' Row", kind: "furniture", sign: "GOD'S TIME FURNITURE WORKS", pos: [-24, 15], size: [8, 7, 3.6], color: "#C47A5A", open: [7, 18], services: [], blurb: "Beds, wardrobes and sofas built to order in the open air." }),
  P({ id: "tokunbo_lot", district: "kaneshie", name: "Abossey Okai Tokunbo Lot", kind: "dealer", sign: "TOKUNBO CARS • ABOSSEY OKAI", pos: [55, -18], size: [16, 10, 5], color: "#B8B8AA", open: [8, 18], services: [], blurb: "Home-used cars from Europe and the US, and every spare part in Ghana around the corner." }),

  // --- Spintex
  P({ id: "coastline_callcentre", district: "spintex", name: "Coastline Contact Centre", kind: "work", sign: "COASTLINE CONTACT CENTRE", pos: [-28, -18], size: [20, 14, 14], color: "#B9C4CC", open: [7, 21], services: [], blurb: "Six floors of headsets." }),
  P({ id: "kente_labs", district: "spintex", name: "Kente Labs", kind: "work", sign: "KENTE LABS • BUILD AFRICA", pos: [10, -18], size: [18, 12, 12], color: "#8DA9C4", open: [7, 22], services: ["coworking"], blurb: "Glass, standing desks and very good Wi-Fi." }),
  P({ id: "spintex_plaza", district: "spintex", name: "Spintex Plaza", kind: "food", sign: "SPINTEX PLAZA • FOOD COURT", pos: [44, 16], size: [22, 14, 7], color: "#F0EAD6", open: [8, 22], services: ["jollof", "coffee", "sobolo"], blurb: "Supermarket, food court and air conditioning." }),
  P({ id: "spintex_stop", district: "spintex", name: "Spintex Junction", kind: "transport", sign: "SPINTEX JUNCTION", pos: [-62, 14], size: [8, 4, 3], color: "#F2B705", open: [0, 24], services: [], blurb: "Traffic capital of Accra." }),
  P({ id: "spintex_gym", district: "spintex", name: "Iron Works Gym", kind: "gym", sign: "IRON WORKS GYM", pos: [-6, 16], size: [10, 9, 5], color: "#D7C4A3", open: [5, 22], services: ["gym"], blurb: "No mirrors, just iron." }),

  P({ id: "accra_mall", district: "spintex", name: "Accra Mall", kind: "mall", sign: "ACCRA MALL • TETTEH QUARSHIE", pos: [50, -20], size: [26, 16, 10], color: "#F0EAD6", open: [9, 22], services: ["coffee", "jollof"], blurb: "Phones, appliances, fashion, a cinema and the coldest AC in the city." }),
  P({ id: "spintex_furniture", district: "spintex", name: "Spintex Furniture Gallery", kind: "furniture", sign: "FURNITURE GALLERY • SHOWROOM", pos: [-30, 16], size: [14, 9, 6], color: "#D7C4A3", open: [9, 19], services: [], blurb: "Showroom sofas, beds and dining sets, delivered on a truck." }),

  // --- East Legon
  P({ id: "coastline_bank_hq", district: "east_legon", name: "Coastline Bank HQ", kind: "bank", sign: "COASTLINE BANK • HEAD OFFICE", pos: [-24, -18], size: [18, 14, 18], color: "#F5F1E8", open: [8, 17], services: [], blurb: "Treasury desk, loans and private banking." }),
  P({ id: "boateng_realty", district: "east_legon", name: "Boateng Realty", kind: "realtor", sign: "BOATENG REALTY • LAND & HOMES", pos: [14, 16], size: [11, 9, 6], color: "#E8DCC8", open: [8, 18], services: [], blurb: "Land, houses and honest paperwork. Allegedly." }),
  P({ id: "lagoon_cafe", district: "east_legon", name: "Lagoon Café", kind: "food", sign: "LAGOON CAFÉ", pos: [-8, 16], size: [10, 8, 4.5], color: "#BFD8D2", open: [7, 22], services: ["coffee", "jollof"], blurb: "Brunch, laptops and deal-making." }),
  P({ id: "legon_prime", district: "east_legon", name: "Legon Prime Fitness", kind: "gym", sign: "LEGON PRIME", pos: [40, -16], size: [12, 10, 6], color: "#CFC6B8", open: [5, 22], services: ["gym", "swim"], blurb: "Pool, sauna and personal trainers." }),
  P({ id: "legon_lounge", district: "east_legon", name: "Skyline Lounge", kind: "nightlife", sign: "SKYLINE LOUNGE", pos: [46, 16], size: [12, 10, 10], color: "#55606E", open: [18, 3], services: ["club", "fine_dining"], blurb: "Rooftop cocktails and the city lights." }),
  P({ id: "ug_legon", district: "east_legon", name: "University of Ghana", kind: "school", sign: "UNIVERSITY OF GHANA • LEGON", pos: [-52, -18], size: [18, 12, 9], color: "#F2E2C4", open: [7, 21], services: ["course", "coworking"], blurb: "Balme Library, Commonwealth Hall and evening professional courses.", geo: { lat: 5.6508, lon: -0.187 } }),
  P({ id: "legon_stop", district: "east_legon", name: "Legon Junction", kind: "transport", sign: "LEGON JUNCTION", pos: [-62, 14], size: [8, 4, 3], color: "#F2B705", open: [0, 24], services: [], blurb: "Taxis wait under the neem tree." }),

  // --- Trasacco Valley
  P({ id: "royal_palm", district: "trasacco", name: "The Royal Palm", kind: "work", sign: "THE ROYAL PALM • BOUTIQUE HOTEL", pos: [-26, -20], size: [24, 16, 12], color: "#FAF7F0", open: [0, 24], services: ["fine_dining", "swim"], blurb: "Twenty suites, one infinity pool." }),
  P({ id: "valley_golf", district: "trasacco", name: "Valley Golf Club", kind: "landmark", sign: "VALLEY GOLF & COUNTRY CLUB", pos: [30, 20], size: [14, 10, 6], color: "#EDE6D6", open: [6, 20], services: ["golf", "view"], blurb: "Members, guests and quiet deals on the 9th hole." }),
  P({ id: "prestige_autos", district: "trasacco", name: "Prestige Autos", kind: "dealer", sign: "PRESTIGE AUTOS", pos: [20, -18], size: [16, 12, 7], color: "#D9D4C7", open: [9, 18], services: [], blurb: "From tidy Corollas to the V8 of your dreams." }),
  P({ id: "valley_gate", district: "trasacco", name: "Valley Gate", kind: "transport", sign: "TRASACCO VALLEY • GATE 1", pos: [-62, 14], size: [8, 5, 4], color: "#B08D57", open: [0, 24], services: [], blurb: "Security will check your name." }),
];

// Accra: day trips leave from the trotro stops; festivals happen at the landmarks.
for (const p of PLACES) {
  if (p.kind === "transport") p.services.push(...tripsFrom(p.district));
  if (["black_star_square", "labadi_beach", "legon_lounge"].includes(p.id)) p.services.push(...festsIn(p.district));
}
PLACES.push(...REGIONAL_PLACES);
Object.assign(JOBS, REGIONAL_JOBS);
const PLACE_BY_ID_EARLY = (id: string) => PLACES.find((p) => p.id === id);

// Everyday work exists in every town, not just Kaneshie: a loader at each
// market, a mate at each station, cooks, clinic aides and night security,
// evening tutors at schools, and app gig work in the bigger cities. Pay
// follows the local cost of living; shift windows fit the opening hours.
const GIG_CITIES = new Set(["kumasi", "tamale", "takoradi", "cape_coast", "ho", "koforidua", "sunyani"]);
{
  const make = (base: Job, place: Place) => {
    const d = DISTRICTS[place.district];
    if (Object.values(JOBS).some((j) => j.title === base.title && PLACE_BY_ID_EARLY(j.placeId)?.district === place.district)) return;
    const [o0, o1] = place.open;
    const w0 = Math.max(base.shiftWindow[0], o0 === 0 && o1 === 24 ? 0 : o0);
    const w1 = Math.min(base.shiftWindow[1], o0 === 0 && o1 === 24 ? 24 : o1 - 1);
    if (w1 < w0) return;
    const col = Math.min(1.15, Math.max(0.7, d?.costOfLiving ?? 1));
    const id = `${base.id}__${place.district}`;
    JOBS[id] = { ...base, id, placeId: place.id, shiftWindow: [w0, w1], pay: Math.round((base.pay * col) / 5) * 5 };
  };
  const first = (district: string, kind: PlaceKind) => PLACES.find((p) => p.district === district && p.kind === kind);
  for (const id of Object.keys(DISTRICTS)) {
    const market = first(id, "market"), station = first(id, "transport"), clinic = first(id, "clinic"), school = first(id, "school"), food = first(id, "food");
    if (market) make(JOBS.market_loader, market);
    if (station) make(JOBS.trotro_mate, station);
    if (food) make(JOBS.chop_cook, food);
    if (clinic) { make(JOBS.nursing_aide, clinic); make(JOBS.night_watchman, clinic); }
    if (school) make(JOBS.pupil_teacher, school);
    if (GIG_CITIES.has(DISTRICTS[id].city) && Object.keys(DISTRICTS).find((k) => DISTRICTS[k].city === DISTRICTS[id].city) === id) {
      if (food) make(JOBS.delivery_rider, food);
      if (station) make(JOBS.ride_driver, station);
    }
  }
}

// A shift can only start while the workplace is open.
for (const j of Object.values(JOBS)) {
  const pl = PLACE_BY_ID_EARLY(j.placeId);
  if (!pl || (pl.open[0] === 0 && pl.open[1] === 24) || pl.open[0] > pl.open[1]) continue;
  const w0 = Math.max(j.shiftWindow[0], pl.open[0]), w1 = Math.min(j.shiftWindow[1], pl.open[1] - 1);
  if (w0 <= w1) j.shiftWindow = [w0, w1];
}

// Every church holds its Sunday service.
for (const p of PLACES) if (p.kind === "church" && !p.services.includes("sunday_service")) p.services.unshift("sunday_service");

// Going out is fun as well as social: anything sociable lifts Fun too.
for (const s of Object.values(SERVICES)) if (!s.effects.fun && (s.effects.social ?? 0) >= 10) s.effects.fun = Math.round((s.effects.social ?? 0) * 1.2);

// Lorry stations, markets and malls all have a pay toilet (and the mall's is free).
for (const p of PLACES) if ((p.kind === "transport" || p.kind === "market" || p.kind === "mall") && !p.services.includes("public_toilet")) p.services.push("public_toilet");
export const PLACE_BY_ID: Record<string, Place> = Object.fromEntries(PLACES.map((p) => [p.id, p]));
export const placesIn = (d: DistrictId) => PLACES.filter((p) => p.district === d);

export function isOpenAt(range: [number, number], hour: number): boolean {
  const [a, b] = range;
  if (a === 0 && b === 24) return true;
  return a < b ? hour >= a && hour < b : hour >= a || hour < b;
}

export const priceFor = (base: number, district: DistrictId) => Math.round(base * DISTRICTS[district].costOfLiving);

// ---------------------------------------------------------------------------
// Travel

export type TravelMode = "walk" | "trotro" | "taxi" | "ride" | "car";
export const TRAVEL_MODES: Record<TravelMode, { name: string; perKm: number; base: number; speedKmh: number; hours?: [number, number]; note: string }> = {
  walk: { name: "Walk", perKm: 0, base: 0, speedKmh: 4.5, note: "Free, slow, good for your legs" },
  trotro: { name: "Trotro", perKm: 1.4, base: 3, speedKmh: 16, hours: [5, 23], note: "Cheap, crowded, full of stories" },
  taxi: { name: "Taxi", perKm: 7, base: 12, speedKmh: 24, note: "Haggle-free today" },
  ride: { name: "Ride app", perKm: 10, base: 15, speedKmh: 28, note: "Air-con and a playlist" },
  car: { name: "Your car", perKm: 3.2, base: 0, speedKmh: 30, note: "Fuel only, and people notice" },
};

/** Road distance between two districts, from their real coordinates. */
export function distanceKm(a: DistrictId, b: DistrictId): number {
  return Math.round(haversineKm(DISTRICTS[a].geo, DISTRICTS[b].geo) * ROAD_FACTOR * 10) / 10;
}

export const districtsIn = (city: CityId) => DISTRICT_IDS.filter((d) => DISTRICTS[d].city === city);

export function isRushHour(hour: number, weekday: number): boolean {
  if (weekday === 0 || weekday === 6) return false;
  return (hour >= 6 && hour < 9) || (hour >= 16 && hour < 19);
}

export function travelQuote(from: DistrictId, to: DistrictId, mode: TravelMode, hour: number, weekday: number, rainy: boolean) {
  const km = distanceKm(from, to);
  const m = TRAVEL_MODES[mode];
  let minutes = Math.round((km / m.speedKmh) * 60) + (mode === "trotro" ? 12 : mode === "walk" ? 0 : 4);
  if (mode !== "walk" && isRushHour(hour, weekday)) minutes = Math.round(minutes * 1.7);
  if (rainy && mode !== "walk") minutes = Math.round(minutes * 1.25);
  const fare = mode === "walk" ? 0 : Math.round(m.base + m.perKm * km * (rainy && mode !== "car" ? 1.2 : 1));
  const energy = mode === "walk" ? -Math.round(km * 6) : mode === "trotro" ? -Math.round(4 + km) : -2;
  return { km, minutes: Math.max(5, minutes), fare, energy };
}
