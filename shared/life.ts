// The stuff of everyday life: what people buy, ride, grow and learn. Prices
// are in cedis at roughly 2025 levels. Brand names are fictional stand-ins
// for the cars and phones you see on Ghanaian roads.
import type { DistrictId, Effects, SkillKey } from "./world.ts";

// ---------------------------------------------------------------------------
// Vehicles

export type VehicleCategory = "bicycle" | "motorbike" | "tricycle" | "car" | "luxury";
export type VehicleModel =
  | "bicycle" | "motorbike" | "pragya" | "aboboyaa" | "compact" | "sedan" | "taxi" | "accordo" | "pickup" | "suv" | "saloon" | "v8" | "supercar" | "phantom";

export interface Vehicle {
  id: string;
  name: string;
  category: VehicleCategory;
  model: VehicleModel;
  price: number;
  reputation: number;
  color: string;
  blurb: string;
  requiresRep?: number;
  licence?: "licence_a" | "licence_b";
  /** Good for intercity trips. */
  longDistance?: boolean;
  /** Daily payment from a driver on a "work and pay" arrangement. */
  workPay?: number;
  /** Fuel/maintenance per in-city km (cedis). */
  perKm: number;
  speedKmh: number;
}

const V = (v: Vehicle) => v;
export const VEHICLES: Record<string, Vehicle> = {
  bicycle: V({ id: "bicycle", name: "Black roadster bicycle", category: "bicycle", model: "bicycle", price: 1_800, reputation: 0, color: "#1a1a1a", perKm: 0, speedKmh: 13, blurb: "The northern workhorse. Carries a sack of maize and a passenger." }),
  motorbike: V({ id: "motorbike", name: "Royal 125 motorbike", category: "motorbike", model: "motorbike", price: 16_500, reputation: 1, color: "#9b1c1c", licence: "licence_a", longDistance: true, perKm: 0.45, speedKmh: 34, blurb: "Tamale's favourite. Cheap on fuel, fast through traffic." }),
  pragya: V({ id: "pragya", name: "Pragya passenger tricycle", category: "tricycle", model: "pragya", price: 39_000, reputation: 1, color: "#d4a017", licence: "licence_a", workPay: 160, perKm: 0.6, speedKmh: 26, blurb: "Three wheels, five passengers (officially three). Give it out on work-and-pay." }),
  aboboyaa: V({ id: "aboboyaa", name: "Aboboyaa cargo tricycle", category: "tricycle", model: "aboboyaa", price: 33_000, reputation: 0, color: "#1f5aa6", licence: "licence_a", workPay: 140, perKm: 0.6, speedKmh: 24, blurb: "Hauls cement, yams, rubbish, furniture. Never idle." }),
  compact: V({ id: "compact", name: "Kaizen Corona (home-used)", category: "car", model: "compact", price: 95_000, reputation: 3, color: "#B9C4CC", licence: "licence_b", longDistance: true, perKm: 1.4, speedKmh: 30, blurb: "Tokunbo from Belgium, AC works (sometimes). Every mechanic knows it." }),
  taxi: V({ id: "taxi", name: "Kaizen Vista taxi", category: "car", model: "taxi", price: 118_000, reputation: 2, color: "#d8d8d2", licence: "licence_b", longDistance: true, workPay: 260, perKm: 1.4, speedKmh: 30, blurb: "Yellow corner panels, licensed and registered. Drive it or give it to a driver on work-and-pay." }),
  accordo: V({ id: "accordo", name: "Harmon Accordo 2.4", category: "car", model: "accordo", price: 215_000, reputation: 6, color: "#2b2f36", licence: "licence_b", longDistance: true, perKm: 1.7, speedKmh: 32, blurb: "The sensible-success sedan. Quiet cabin, leather, cruise control." }),
  pickup: V({ id: "pickup", name: "Kaizen Highlander pickup", category: "car", model: "pickup", price: 385_000, reputation: 6, color: "#f2f2ee", licence: "licence_b", longDistance: true, perKm: 2.1, speedKmh: 32, blurb: "Double cabin, 4x4. Farmers, contractors and pastors agree on this one." }),
  crossover: V({ id: "crossover", name: "Ridgeback crossover", category: "car", model: "suv", price: 320_000, reputation: 8, color: "#7A2E2E", licence: "licence_b", longDistance: true, perKm: 1.9, speedKmh: 32, blurb: "Comfortable, reliable, respectable." }),
  saloon: V({ id: "saloon", name: "Mercer E-Class saloon", category: "luxury", model: "saloon", price: 690_000, reputation: 14, color: "#11161c", licence: "licence_b", longDistance: true, perKm: 2.4, speedKmh: 34, requiresRep: 15, blurb: "The executive saloon. Your driver opens the door; you don't." }),
  v8: V({ id: "v8", name: "Savanna V8 SUV", category: "luxury", model: "v8", price: 1_350_000, reputation: 20, color: "#1A1A1A", licence: "licence_b", longDistance: true, perKm: 3.2, speedKmh: 34, requiresRep: 25, blurb: "Black, tinted, unmistakable. The dream on four wheels." }),
  supercar: V({ id: "supercar", name: "Vettore Furia V12", category: "luxury", model: "supercar", price: 5_400_000, reputation: 40, color: "#e8b100", licence: "licence_b", perKm: 6, speedKmh: 36, requiresRep: 55, blurb: "730 horsepower, ten centimetres of ground clearance and every speed bump in Accra as an enemy." }),
  phantom: V({ id: "phantom", name: "Imperial Phantom", category: "luxury", model: "phantom", price: 8_900_000, reputation: 55, color: "#2a2340", licence: "licence_b", longDistance: true, perKm: 6.5, speedKmh: 33, requiresRep: 70, blurb: "Starlight headliner, a chauffeur and total silence. You have arrived." }),
};
export const VEHICLE_DEPRECIATION_PER_MONTH = 0.012;

/** Which vehicles each dealer place sells. */
export const DEALER_STOCK: Record<string, string[]> = {
  prestige_autos: ["accordo", "crossover", "saloon", "v8", "supercar", "phantom"],
  tokunbo_lot: ["compact", "taxi", "accordo", "pickup", "crossover"],
  suame_magazine: ["compact", "taxi", "pickup", "motorbike", "pragya", "aboboyaa"],
  tamale_motors: ["bicycle", "motorbike", "pragya", "aboboyaa", "pickup"],
  kintampo_dealer: ["bicycle", "motorbike", "pragya", "aboboyaa"],
  techiman_dealer: ["motorbike", "pragya", "aboboyaa", "compact", "pickup"],
  wa_dealer: ["bicycle", "motorbike", "pragya"],
  bole_dealer: ["bicycle", "motorbike", "aboboyaa"],
  bolga_dealer: ["bicycle", "motorbike", "pragya", "aboboyaa"],
};

// ---------------------------------------------------------------------------
// Goods: furniture, appliances, phones, clothes and crafts.

export type ItemSlot =
  | "bed" | "mattress" | "seating" | "table" | "storage" | "cooling" | "kitchen" | "fridge" | "screen" | "sound" | "power" | "water"
  | "decor" | "laundry" | "phone" | "computer" | "clothing" | "craft" | "jewellery";

export interface Item {
  id: string;
  name: string;
  slot: ItemSlot;
  price: number;
  /** Home comfort points when placed at home. */
  comfort?: number;
  /** One-off effects on purchase (clothing, crafts). */
  effects?: Effects;
  /** Phones: camera tier 0..4 for social media. */
  camera?: number;
  blurb: string;
}

const I = (i: Item) => i;
export const ITEMS: Record<string, Item> = {
  // Bedroom
  foam_mattress: I({ id: "foam_mattress", name: "6-inch foam mattress", slot: "mattress", price: 1_300, comfort: 2, blurb: "Firm, local, lasts ten years if you turn it." }),
  spring_mattress: I({ id: "spring_mattress", name: "Orthopaedic spring mattress", slot: "mattress", price: 6_500, comfort: 4, blurb: "Hotel feel. Your back will thank you." }),
  bed_frame: I({ id: "bed_frame", name: "Hardwood bed frame (carpenter-made)", slot: "bed", price: 2_400, comfort: 2, blurb: "Odum wood, built to order." }),
  king_bed: I({ id: "king_bed", name: "Upholstered king bed", slot: "bed", price: 14_000, comfort: 4, blurb: "Tufted headboard, made for a big-man bedroom." }),
  wardrobe: I({ id: "wardrobe", name: "Three-door wardrobe", slot: "storage", price: 3_200, comfort: 1, blurb: "Finally, somewhere that isn't a chair for your clothes." }),
  mosquito_net: I({ id: "mosquito_net", name: "Treated mosquito net", slot: "decor", price: 80, comfort: 1, blurb: "Cheapest health insurance in Ghana." }),
  // Living room
  plastic_chairs: I({ id: "plastic_chairs", name: "Set of 4 plastic chairs", slot: "seating", price: 420, comfort: 1, blurb: "The national furniture. Stackable, indestructible, at every funeral." }),
  wooden_sofa: I({ id: "wooden_sofa", name: "Wooden sofa set with cushions", slot: "seating", price: 4_800, comfort: 2, blurb: "Three-seater, two singles, crocheted covers optional." }),
  leather_sofa: I({ id: "leather_sofa", name: "L-shaped leather sectional", slot: "seating", price: 22_000, comfort: 4, blurb: "For watching Black Stars matches in style." }),
  centre_table: I({ id: "centre_table", name: "Glass centre table", slot: "table", price: 1_600, comfort: 1, blurb: "Holds the remote, the Bible and the visitor's Fanta." }),
  dining_set: I({ id: "dining_set", name: "6-seater dining set", slot: "table", price: 7_500, comfort: 2, blurb: "Sunday lunch with the whole family." }),
  curtains: I({ id: "curtains", name: "Lace curtains & rods", slot: "decor", price: 900, comfort: 1, blurb: "Every Ghanaian living room's secret weapon." }),
  rug: I({ id: "rug", name: "Large area rug", slot: "decor", price: 1_400, comfort: 1, blurb: "Soft under bare feet." }),
  wall_art: I({ id: "wall_art", name: "Framed kente-pattern wall art", slot: "decor", price: 1_100, comfort: 1, blurb: "Adinkra symbols, gold frame." }),
  // Cooling
  standing_fan: I({ id: "standing_fan", name: "Standing fan", slot: "cooling", price: 650, comfort: 1, blurb: "Turns and hums all night." }),
  ceiling_fan: I({ id: "ceiling_fan", name: "Ceiling fan (installed)", slot: "cooling", price: 1_100, comfort: 2, blurb: "Quiet and strong." }),
  split_ac: I({ id: "split_ac", name: "1.5HP split air-conditioner", slot: "cooling", price: 9_800, comfort: 4, blurb: "Your ECG bill will notice. So will your sleep." }),
  // Kitchen
  gas_cooker: I({ id: "gas_cooker", name: "Table-top gas cooker & cylinder", slot: "kitchen", price: 1_500, comfort: 1, blurb: "Cook at home: cheaper than the chop bar." }),
  standing_cooker: I({ id: "standing_cooker", name: "4-burner cooker with oven", slot: "kitchen", price: 6_200, comfort: 2, blurb: "Bake bread, roast chicken, impress the in-laws." }),
  asanka: I({ id: "asanka", name: "Asanka & tapoli (grinding bowl)", slot: "kitchen", price: 90, comfort: 0, blurb: "For pepper that tastes right." }),
  blender: I({ id: "blender", name: "Blender", slot: "kitchen", price: 700, comfort: 0, blurb: "Pepper, tomatoes, smoothies." }),
  fridge: I({ id: "fridge", name: "Double-door fridge", slot: "fridge", price: 7_800, comfort: 2, blurb: "Cold water on demand. Leftovers survive." }),
  deep_freezer: I({ id: "deep_freezer", name: "Chest deep freezer", slot: "fridge", price: 6_900, comfort: 1, blurb: "Ice blocks to sell, fish to store." }),
  // Screens & sound
  tv32: I({ id: "tv32", name: "32-inch LED TV & decoder", slot: "screen", price: 3_400, comfort: 1, blurb: "News at 7, telenovelas at 8." }),
  smart_tv65: I({ id: "smart_tv65", name: "65-inch smart TV", slot: "screen", price: 18_500, comfort: 3, blurb: "The Champions League looks different on this." }),
  sound_system: I({ id: "sound_system", name: "Home theatre sound system", slot: "sound", price: 5_600, comfort: 1, blurb: "Your neighbours will also enjoy your gospel playlist." }),
  // Power & water (dumsor-proofing)
  generator: I({ id: "generator", name: "'I better pass my neighbour' generator", slot: "power", price: 4_200, comfort: 1, blurb: "Loud, smoky, beautiful when the lights go off." }),
  solar_inverter: I({ id: "solar_inverter", name: "Solar panels & inverter (3kW)", slot: "power", price: 38_000, comfort: 3, blurb: "Silent power through any dumsor, and lower bills." }),
  polytank: I({ id: "polytank", name: "Polytank & pump", slot: "water", price: 3_600, comfort: 2, blurb: "Water when the taps run dry." }),
  washing_machine: I({ id: "washing_machine", name: "Washing machine", slot: "laundry", price: 6_400, comfort: 1, blurb: "Saturday morning, reclaimed." }),
  // Phones & computers
  button_phone: I({ id: "button_phone", name: "Kabeba button phone", slot: "phone", price: 250, camera: 0, blurb: "Battery lasts a week. Torch included." }),
  kopa_k5: I({ id: "kopa_k5", name: "Kopa K5 smartphone", slot: "phone", price: 1_400, camera: 1, blurb: "Big battery, two SIM slots, very loud ringtone." }),
  nova_s11: I({ id: "nova_s11", name: "Nova S11", slot: "phone", price: 3_900, camera: 2, blurb: "A proper camera for the price." }),
  orion_15: I({ id: "orion_15", name: "Orion 15 Pro", slot: "phone", price: 17_500, camera: 4, blurb: "The flex. Night photos look like daytime." }),
  zen_fold: I({ id: "zen_fold", name: "Zen Fold 6", slot: "phone", price: 24_000, camera: 3, blurb: "It folds. People ask about it at weddings." }),
  laptop: I({ id: "laptop", name: "Laptop", slot: "computer", price: 9_500, blurb: "Work from anywhere with Wi-Fi.", effects: { work: 2 } }),
  power_bank: I({ id: "power_bank", name: "20,000mAh power bank", slot: "decor", price: 350, blurb: "Dumsor insurance for your phone." }),
  // Clothing
  wax_print: I({ id: "wax_print", name: "6 yards of wax print", slot: "clothing", price: 650, effects: { social: 4, charisma: 1 }, blurb: "Take it to a seamstress for a kaba or a shirt." }),
  sneakers: I({ id: "sneakers", name: "Designer sneakers", slot: "clothing", price: 3_200, effects: { social: 4, reputation: 1 }, blurb: "Clean. Keep them clean." }),
  suit: I({ id: "suit", name: "Tailored suit", slot: "clothing", price: 4_500, effects: { charisma: 2, reputation: 2 }, blurb: "For interviews, weddings and the bank manager." }),
  watch: I({ id: "watch", name: "Gold-tone wristwatch", slot: "jewellery", price: 12_000, effects: { reputation: 3 }, blurb: "People notice wrists." }),
  perfume: I({ id: "perfume", name: "Imported perfume", slot: "clothing", price: 1_800, effects: { charisma: 1, social: 3 }, blurb: "Arrives before you do." }),
  // Crafts (regional)
  kente_cloth: I({ id: "kente_cloth", name: "Bonwire kente cloth", slot: "craft", price: 5_500, effects: { reputation: 4, charisma: 1 }, blurb: "Hand-woven Asante kente. For weddings, festivals and graduations." }),
  adinkra_cloth: I({ id: "adinkra_cloth", name: "Ntonso adinkra cloth", slot: "craft", price: 900, effects: { reputation: 1 }, blurb: "Stamped by hand with symbols and proverbs." }),
  smock: I({ id: "smock", name: "Northern smock (batakari / fugu)", slot: "craft", price: 750, effects: { reputation: 2, charisma: 1 }, blurb: "Hand-woven strips, heavy and proud. Presidents wear them on Fridays." }),
  bolga_basket: I({ id: "bolga_basket", name: "Bolga basket", slot: "craft", price: 220, comfort: 1, blurb: "Dyed elephant grass, leather handle, lasts a lifetime." }),
  krobo_beads: I({ id: "krobo_beads", name: "Krobo glass beads", slot: "jewellery", price: 300, effects: { social: 2 }, blurb: "Recycled glass, fired and painted." }),
  shea_butter: I({ id: "shea_butter", name: "Raw shea butter (1 kg)", slot: "craft", price: 60, effects: { health: 2 }, blurb: "For skin, hair, cooking and everything else." }),
  leather_bag: I({ id: "leather_bag", name: "Tamale leather bag", slot: "craft", price: 480, effects: { social: 2 }, blurb: "Goat leather, dyed and tooled by hand." }),
  ashanti_stool: I({ id: "ashanti_stool", name: "Carved Ashanti stool", slot: "craft", price: 1_200, comfort: 1, blurb: "Carved from one block of wood." }),
  black_soap: I({ id: "black_soap", name: "Alata samina (black soap)", slot: "craft", price: 30, effects: { health: 1 }, blurb: "Plantain ash and palm oil." }),
};

/** What each store kind sells. Specific place ids can add regional stock. */
export const STORE_STOCK: Record<string, string[]> = {
  shop: ["foam_mattress", "spring_mattress", "plastic_chairs", "mosquito_net", "standing_fan", "ceiling_fan", "gas_cooker", "standing_cooker", "blender", "asanka", "fridge", "deep_freezer", "tv32", "curtains", "rug", "generator", "polytank", "washing_machine", "button_phone", "kopa_k5", "power_bank"],
  mall: ["spring_mattress", "king_bed", "leather_sofa", "dining_set", "split_ac", "smart_tv65", "sound_system", "solar_inverter", "fridge", "standing_cooker", "washing_machine", "wall_art", "laptop", "nova_s11", "orion_15", "zen_fold", "sneakers", "suit", "watch", "perfume"],
  furniture: ["bed_frame", "wardrobe", "wooden_sofa", "centre_table", "dining_set", "ashanti_stool"],
  phone: ["button_phone", "kopa_k5", "nova_s11", "orion_15", "zen_fold", "laptop", "power_bank"],
  market: ["wax_print", "plastic_chairs", "asanka", "mosquito_net", "black_soap", "shea_butter"],
};
export const PLACE_STOCK: Record<string, string[]> = {
  kejetia_market: ["kente_cloth", "adinkra_cloth", "ashanti_stool"],
  tamale_market: ["smock", "leather_bag", "shea_butter"],
  tamale_cultural: ["smock", "leather_bag"],
  bolga_crafts: ["bolga_basket", "smock", "leather_bag"],
  bolga_market: ["bolga_basket", "smock"],
  wa_market: ["smock", "shea_butter"],
  bole_market: ["shea_butter"],
  bead_market: ["krobo_beads"],
  kaneshie_market: ["wax_print"],
  osu_night_market: ["krobo_beads", "leather_bag"],
  ho_market: ["kente_cloth"],
  kotokuraba: ["wax_print"],
};
export function stockFor(placeId: string, kind: string): string[] {
  return [...new Set([...(STORE_STOCK[kind] ?? []), ...(PLACE_STOCK[placeId] ?? [])])];
}

/** Home comfort from furnishing: best item per slot, summed, worth up to +3 comfort. */
export function furnishingScore(itemIds: string[]): { points: number; bonus: number; slots: Record<string, string> } {
  const best: Record<string, string> = {};
  for (const id of itemIds) {
    const it = ITEMS[id];
    if (!it?.comfort) continue;
    if (!best[it.slot] || (ITEMS[best[it.slot]].comfort ?? 0) < it.comfort) best[it.slot] = id;
  }
  const points = Object.values(best).reduce((a, id) => a + (ITEMS[id].comfort ?? 0), 0);
  return { points, bonus: Math.min(3, Math.floor(points / 6)), slots: best };
}

// ---------------------------------------------------------------------------
// Social media ("Vibes")

export interface PostType {
  id: string;
  name: string;
  /** What you need for it. */
  needs?: "car" | "home" | "trip" | "fest" | "business" | "outfit";
  base: number; // follower gain at camera tier 2, charisma 20
  blurb: string;
}
export const POST_TYPES: PostType[] = [
  { id: "food", name: "Food pic", base: 14, blurb: "Waakye from above, natural light." },
  { id: "skit", name: "Comedy skit", base: 30, blurb: "You play the landlord, the tenant and the mosquito." },
  { id: "outfit", name: "Outfit of the day", needs: "outfit", base: 26, blurb: "Kente, smock or sneakers. The mirror never lies." },
  { id: "trip", name: "Travel post", needs: "trip", base: 45, blurb: "Waterfalls, castles, elephants. #SeeGhana" },
  { id: "fest", name: "Festival video", needs: "fest", base: 55, blurb: "Drums, dust and colour." },
  { id: "car", name: "Car flex", needs: "car", base: 40, blurb: "Keys in hand, leaning on the bonnet." },
  { id: "home", name: "House tour", needs: "home", base: 60, blurb: "Walk the camera through the gate." },
  { id: "business", name: "Business promo", needs: "business", base: 20, blurb: "Tag the shop. Sales go up tomorrow." },
];
/** Daily brand-deal income once you have an audience. */
export const influencerDaily = (followers: number) => (followers < 5_000 ? 0 : Math.round(followers * 0.0025));

// ---------------------------------------------------------------------------
// Farming

export interface Crop {
  id: string;
  name: string;
  /** Months (1..12) you can start a season. */
  months: number[] | "any";
  days: number;
  costPerAcre: number;
  yieldPerAcre: number;
  /** Needs rain during the season (rain-fed). */
  rainFed: boolean;
  blurb: string;
}
const C = (c: Crop) => c;
export const CROPS: Record<string, Crop> = {
  maize: C({ id: "maize", name: "Maize", months: [3, 4, 5, 8, 9], days: 8, costPerAcre: 900, yieldPerAcre: 1_650, rainFed: true, blurb: "Two seasons in the south, one in the north." }),
  maize_north: C({ id: "maize_north", name: "Maize (northern season)", months: [5, 6, 7], days: 8, costPerAcre: 850, yieldPerAcre: 1_600, rainFed: true, blurb: "One rainy season, one chance." }),
  yam: C({ id: "yam", name: "Yam", months: [11, 12, 1, 2, 3, 4], days: 14, costPerAcre: 3_000, yieldPerAcre: 6_600, rainFed: true, blurb: "Mounds, stakes and patience. The king of crops." }),
  cassava: C({ id: "cassava", name: "Cassava", months: "any", days: 16, costPerAcre: 800, yieldPerAcre: 2_100, rainFed: false, blurb: "Grows anywhere, feeds everyone: gari, kokonte, fufu." }),
  plantain: C({ id: "plantain", name: "Plantain", months: "any", days: 14, costPerAcre: 1_100, yieldPerAcre: 2_900, rainFed: false, blurb: "Fufu, ampesi, kelewele, chips." }),
  cocoa: C({ id: "cocoa", name: "Cocoa (main crop season)", months: [9, 10, 11, 12, 1, 2], days: 12, costPerAcre: 1_500, yieldPerAcre: 4_400, rainFed: false, blurb: "Weed, spray, harvest, ferment, dry, sell to COCOBOD." }),
  rice: C({ id: "rice", name: "Rice", months: [6, 7], days: 10, costPerAcre: 1_500, yieldPerAcre: 3_200, rainFed: true, blurb: "Lowland rice in the valleys." }),
  soya: C({ id: "soya", name: "Soybeans", months: [6, 7], days: 9, costPerAcre: 900, yieldPerAcre: 1_950, rainFed: true, blurb: "Poultry farmers buy everything you grow." }),
  groundnut: C({ id: "groundnut", name: "Groundnuts", months: [5, 6, 7], days: 8, costPerAcre: 800, yieldPerAcre: 1_750, rainFed: true, blurb: "Soup, paste, kulikuli and roasted snacks." }),
  millet: C({ id: "millet", name: "Millet", months: [5, 6], days: 9, costPerAcre: 600, yieldPerAcre: 1_350, rainFed: true, blurb: "TZ, koko and pito all start here." }),
  shea: C({ id: "shea", name: "Shea nut picking", months: [5, 6, 7, 8], days: 6, costPerAcre: 300, yieldPerAcre: 1_100, rainFed: false, blurb: "Wild trees in the parkland; women pick, you buy and process." }),
  cashew: C({ id: "cashew", name: "Cashew harvest", months: [2, 3, 4], days: 7, costPerAcre: 700, yieldPerAcre: 2_450, rainFed: false, blurb: "Pick the apples, keep the nuts, sell to the buyers from Vietnam and India." }),
  tomato: C({ id: "tomato", name: "Dry-season tomatoes (irrigated)", months: [11, 12, 1], days: 7, costPerAcre: 1_800, yieldPerAcre: 4_300, rainFed: false, blurb: "Big money if the price holds. Big loss if the Burkina trucks flood the market." }),
  onion: C({ id: "onion", name: "Onions (irrigated)", months: [11, 12, 1], days: 9, costPerAcre: 1_600, yieldPerAcre: 3_700, rainFed: false, blurb: "Bawku and Vea are famous for them." }),
  pineapple: C({ id: "pineapple", name: "Pineapple", months: "any", days: 18, costPerAcre: 2_500, yieldPerAcre: 6_000, rainFed: false, blurb: "Sugarloaf and MD2 for juice factories and export." }),
  oil_palm: C({ id: "oil_palm", name: "Oil palm harvest", months: [3, 4, 5, 6], days: 10, costPerAcre: 900, yieldPerAcre: 2_400, rainFed: false, blurb: "Bunches to the mill for red oil." }),
  coconut: C({ id: "coconut", name: "Coconuts", months: "any", days: 10, costPerAcre: 500, yieldPerAcre: 1_500, rainFed: false, blurb: "Roadside sellers buy by the truckload." }),
  citrus: C({ id: "citrus", name: "Oranges", months: [9, 10, 11], days: 9, costPerAcre: 700, yieldPerAcre: 2_000, rainFed: false, blurb: "Peeled and sold in nets at every junction." }),
  vegetables: C({ id: "vegetables", name: "Vegetables (garden eggs, pepper, okro)", months: "any", days: 6, costPerAcre: 1_200, yieldPerAcre: 2_350, rainFed: false, blurb: "Quick turnover for the city markets." }),
};

export interface Farmland {
  id: string;
  name: string;
  district: DistrictId;
  acres: number;
  price: number;
  crops: string[];
  blurb: string;
}
const F = (f: Farmland) => f;
export const FARMLANDS: Record<string, Farmland> = {
  dodowa_garden: F({ id: "dodowa_garden", name: "Vegetable garden near Dodowa", district: "spintex", acres: 2, price: 38_000, crops: ["vegetables", "maize", "cassava"], blurb: "Drip lines and a borehole, an hour from Accra." }),
  ashanti_cocoa: F({ id: "ashanti_cocoa", name: "Cocoa farm near Bekwai", district: "adum", acres: 5, price: 95_000, crops: ["cocoa", "plantain", "cassava"], blurb: "Mature trees under forest shade. Galamsey miners keep asking to buy it." }),
  kintampo_yam: F({ id: "kintampo_yam", name: "Yam & maize farm, Kintampo", district: "kintampo", acres: 8, price: 42_000, crops: ["yam", "maize", "cassava"], blurb: "Deep, loose soil in the heart of the yam belt." }),
  techiman_farm: F({ id: "techiman_farm", name: "Food farm outside Techiman", district: "techiman", acres: 6, price: 48_000, crops: ["maize", "yam", "tomato", "cassava"], blurb: "Close to the biggest food market in the country." }),
  sunyani_cashew: F({ id: "sunyani_cashew", name: "Cashew orchard, Berekum road", district: "sunyani", acres: 6, price: 72_000, crops: ["cashew", "maize", "plantain"], blurb: "Ten-year-old trees and a drying floor." }),
  tamale_rice: F({ id: "tamale_rice", name: "Rice & soya land, Nyankpala", district: "tamale", acres: 10, price: 30_000, crops: ["rice", "soya", "maize_north", "groundnut"], blurb: "Flat valley land near the agricultural research station." }),
  bole_shea: F({ id: "bole_shea", name: "Shea & cashew parkland, Bole", district: "bole", acres: 15, price: 22_000, crops: ["shea", "cashew", "yam", "groundnut"], blurb: "Old shea trees, young cashew and room for yam mounds." }),
  sawla_groundnut: F({ id: "sawla_groundnut", name: "Groundnut & maize farm, Sawla", district: "sawla", acres: 10, price: 18_000, crops: ["groundnut", "maize_north", "millet", "shea"], blurb: "Sandy soil and long sunny days." }),
  wa_millet: F({ id: "wa_millet", name: "Millet & groundnut farm, Wa", district: "wa", acres: 8, price: 20_000, crops: ["millet", "groundnut", "soya", "shea"], blurb: "Dagaaba farmland, with a family who'll help at harvest." }),
  damongo_farm: F({ id: "damongo_farm", name: "Savannah farm, Damongo", district: "damongo", acres: 12, price: 20_000, crops: ["yam", "soya", "maize_north", "shea"], blurb: "Wide land near the agric college." }),
  vea_garden: F({ id: "vea_garden", name: "Irrigated plot at Vea Dam", district: "bolgatanga", acres: 3, price: 28_000, crops: ["tomato", "onion", "rice", "millet"], blurb: "Dry-season farming with canal water." }),
  nalerigu_farm: F({ id: "nalerigu_farm", name: "Soya & millet farm, Nalerigu", district: "nalerigu", acres: 10, price: 16_000, crops: ["soya", "millet", "groundnut"], blurb: "Below the Gambaga escarpment." }),
  wiawso_cocoa: F({ id: "wiawso_cocoa", name: "Sefwi cocoa farm", district: "sefwi_wiawso", acres: 6, price: 110_000, crops: ["cocoa", "plantain"], blurb: "Some of the best cocoa land in the country." }),
  goaso_cocoa: F({ id: "goaso_cocoa", name: "Ahafo cocoa farm", district: "goaso", acres: 5, price: 88_000, crops: ["cocoa", "plantain", "cassava"], blurb: "Old trees, new seedlings." }),
  nsawam_pineapple: F({ id: "nsawam_pineapple", name: "Pineapple farm, Nsawam road", district: "koforidua", acres: 4, price: 64_000, crops: ["pineapple", "cassava", "plantain"], blurb: "A juice factory buys everything." }),
  ho_farm: F({ id: "ho_farm", name: "Food farm near Ho", district: "ho", acres: 5, price: 36_000, crops: ["maize", "cassava", "yam", "rice"], blurb: "Fertile foothills of the Volta mountains." }),
  dambai_yam: F({ id: "dambai_yam", name: "Lakeside yam farm, Dambai", district: "dambai", acres: 8, price: 24_000, crops: ["yam", "cassava", "rice"], blurb: "Yam for the New Yam Festival, shipped across the lake." }),
  assin_citrus: F({ id: "assin_citrus", name: "Citrus & oil palm farm, Assin", district: "cape_coast", acres: 6, price: 52_000, crops: ["citrus", "oil_palm", "cassava"], blurb: "Central Region's orange belt." }),
  ahanta_palm: F({ id: "ahanta_palm", name: "Oil palm & coconut plantation", district: "takoradi", acres: 8, price: 70_000, crops: ["oil_palm", "coconut", "cassava"], blurb: "Coastal palms, a small mill nearby." }),
};
export const FARM_HARVEST_WINDOW_DAYS = 5;

// ---------------------------------------------------------------------------
// Schools and courses

export interface Course {
  id: string;
  name: string;
  places: string[];
  fee: number;
  sessions: number;
  minutes: number;
  hours: [number, number];
  perSession: Partial<Record<SkillKey, number>>;
  onComplete: Partial<Record<SkillKey | "reputation", number>>;
  unlock?: string;
  blurb: string;
}
export const COURSES: Record<string, Course> = {
  driving_b: { id: "driving_b", name: "Driving school & DVLA test (licence B)", places: ["kaneshie_school", "knust_city", "uds_tamale", "ktu", "ucc", "uenr", "bolga_tech", "uhas"], fee: 2_200, sessions: 5, minutes: 120, hours: [7, 18], perSession: {}, onComplete: { reputation: 1 }, unlock: "licence_b", blurb: "Highway code, parking between two drums, then the DVLA examiner." },
  riding_a: { id: "riding_a", name: "Motorbike & tricycle licence (A)", places: ["uds_tamale", "kaneshie_school", "knust_city", "wa_university", "bolga_tech", "damongo_agric"], fee: 700, sessions: 2, minutes: 90, hours: [7, 17], perSession: {}, onComplete: {}, unlock: "licence_a", blurb: "Helmet on. Figure-of-eight around the cones." },
  tailoring: { id: "tailoring", name: "Fashion & tailoring certificate", places: ["ktu", "bolga_tech", "kaneshie_school"], fee: 1_500, sessions: 6, minutes: 180, hours: [8, 18], perSession: { business: 0.5 }, onComplete: { charisma: 3, business: 2 }, unlock: "cert_tailoring", blurb: "Pattern cutting, kaba & slit, smocks and suits." },
  mechanic: { id: "mechanic", name: "Auto mechanics apprenticeship", places: ["suame_magazine"], fee: 600, sessions: 8, minutes: 240, hours: [7, 15], perSession: { work: 1 }, onComplete: { work: 3 }, unlock: "cert_mechanic", blurb: "Learn engines from the masters of Suame Magazine." },
  ict: { id: "ict", name: "ICT & coding bootcamp", places: ["kente_labs", "ucc", "knust_city"], fee: 4_500, sessions: 8, minutes: 180, hours: [8, 20], perSession: { work: 1.5 }, onComplete: { work: 6 }, unlock: "cert_ict", blurb: "Web apps, mobile money APIs and a portfolio." },
  accounting: { id: "accounting", name: "Diploma in Accounting", places: ["kaneshie_school", "ucc", "wa_university", "knust_city"], fee: 3_000, sessions: 8, minutes: 180, hours: [16, 21], perSession: { work: 1, business: 0.5 }, onComplete: { business: 3 }, unlock: "cert_accounting", blurb: "Double entry, tax and payroll. Evening classes." },
  agribusiness: { id: "agribusiness", name: "Agribusiness & farm management", places: ["knust_city", "uds_tamale", "damongo_agric", "uenr"], fee: 1_800, sessions: 5, minutes: 180, hours: [8, 17], perSession: { business: 0.5 }, onComplete: { business: 2 }, unlock: "agri", blurb: "Soil, seed, spacing and selling at the right time. Farm yields +15%." },
  catering: { id: "catering", name: "Catering & pastry course", places: ["kaneshie_school", "ktu", "ucc"], fee: 1_200, sessions: 4, minutes: 180, hours: [8, 18], perSession: { business: 0.5 }, onComplete: { charisma: 1 }, unlock: "cert_catering", blurb: "Jollof for 300 guests, meat pies and wedding cakes. Food businesses +10%." },
  nursing: { id: "nursing", name: "Nursing assistant certificate", places: ["uhas", "uds_tamale", "ucc"], fee: 3_500, sessions: 10, minutes: 240, hours: [7, 17], perSession: { work: 1 }, onComplete: { work: 3, reputation: 3 }, unlock: "cert_nursing", blurb: "Vitals, wound care and night shifts." },
  tour_guide: { id: "tour_guide", name: "Tour guiding certificate", places: ["ucc", "kintampo_falls_gate", "mole_desk"], fee: 800, sessions: 3, minutes: 150, hours: [8, 16], perSession: { charisma: 1 }, onComplete: { charisma: 2 }, unlock: "cert_guide", blurb: "History, first aid and telling a good story." },
  mba: { id: "mba", name: "Executive MBA", places: ["ug_legon", "knust_city"], fee: 28_000, sessions: 12, minutes: 240, hours: [8, 20], perSession: { business: 1 }, onComplete: { business: 6, work: 3, reputation: 5 }, unlock: "mba", blurb: "Case studies, a network and letters after your name." },
};
