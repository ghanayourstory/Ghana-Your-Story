// Furnishing a house you own, room by room. A house you buy is handed over
// empty: walls, floors, the fitted kitchen and the bathrooms. Everything else
// you choose and pay for, piece by piece, and it appears in the room. Rented
// villas and mansions come furnished by the landlord.

import type { HomeTier } from "./homes.ts";

export type RoomKind = "bedroom" | "living" | "dining" | "study" | "lounge";
export interface RoomPlan { id: string; name: string; kind: RoomKind; floor: 0 | 1 | 2 }

/** The rooms you can furnish in each two-storey house, matching its 3D layout. */
export const ROOM_PLANS: Partial<Record<HomeTier, RoomPlan[]>> = {
  // Ground, first and second floor.
  mansion: [
    { id: "living", name: "Sitting room (ground floor)", kind: "living", floor: 0 },
    { id: "dining", name: "Dining room (ground floor)", kind: "dining", floor: 0 },
    { id: "study", name: "Study (ground floor)", kind: "study", floor: 0 },
    { id: "bed7", name: "Guest bedroom (ground floor)", kind: "bedroom", floor: 0 },
    { id: "lounge", name: "Family lounge (first floor)", kind: "lounge", floor: 1 },
    { id: "bed1", name: "Master bedroom (first floor)", kind: "bedroom", floor: 1 },
    { id: "bed2", name: "Bedroom 2 (first floor)", kind: "bedroom", floor: 1 },
    { id: "bed3", name: "Bedroom 3 (first floor)", kind: "bedroom", floor: 1 },
    { id: "bed4", name: "Bedroom 4 (second floor)", kind: "bedroom", floor: 2 },
    { id: "bed5", name: "Bedroom 5 (second floor)", kind: "bedroom", floor: 2 },
    { id: "bed6", name: "Bedroom 6 (second floor)", kind: "bedroom", floor: 2 },
  ],
  // Ground and first floor.
  villa: [
    { id: "living", name: "Sitting room (ground floor)", kind: "living", floor: 0 },
    { id: "dining", name: "Dining room (ground floor)", kind: "dining", floor: 0 },
    { id: "study", name: "Study (ground floor)", kind: "study", floor: 0 },
    { id: "bed4", name: "Guest bedroom (ground floor)", kind: "bedroom", floor: 0 },
    { id: "lounge", name: "Family lounge (first floor)", kind: "lounge", floor: 1 },
    { id: "bed1", name: "Master bedroom (first floor)", kind: "bedroom", floor: 1 },
    { id: "bed2", name: "Bedroom 2 (first floor)", kind: "bedroom", floor: 1 },
    { id: "bed3", name: "Bedroom 3 (first floor)", kind: "bedroom", floor: 1 },
  ],
};

export interface Piece {
  id: string;
  name: string;
  /** GH₵ (fictional). */
  price: number;
  /** Pieces in the same slot replace each other (one bed per room). */
  slot: string;
  rooms: RoomKind[];
  comfort: number;
  /** Counts as this shop item for home activities (a TV lets you watch TV). */
  asItem?: string;
  blurb: string;
}
const P = (p: Piece) => p;
const BED: RoomKind[] = ["bedroom"];
const SIT: RoomKind[] = ["living", "lounge"];
const ANY: RoomKind[] = ["bedroom", "living", "dining", "study", "lounge"];
export const PIECES: Record<string, Piece> = {
  king_bed: P({ id: "king_bed", name: "Upholstered king bed & bedside tables", price: 16_500, slot: "bed", rooms: BED, comfort: 4, blurb: "Tufted headboard to the ceiling, orthopaedic mattress, two bedside lamps." }),
  double_bed: P({ id: "double_bed", name: "Double bed & bedside tables", price: 7_800, slot: "bed", rooms: BED, comfort: 3, blurb: "Padded headboard and a good spring mattress." }),
  twin_beds: P({ id: "twin_beds", name: "Twin beds (for the children)", price: 6_400, slot: "bed", rooms: BED, comfort: 2, blurb: "Two hardwood singles. Sleepovers sorted." }),
  carpenter_bed: P({ id: "carpenter_bed", name: "Carpenter-made hardwood bed", price: 3_200, slot: "bed", rooms: BED, comfort: 2, blurb: "Odum wood from Kaneshie, foam mattress." }),
  wardrobe: P({ id: "wardrobe", name: "Fitted wardrobe (floor to ceiling)", price: 6_800, slot: "wardrobe", rooms: BED, comfort: 1, blurb: "Sliding doors, gold handles, room for every kaba." }),
  dresser: P({ id: "dresser", name: "Dressing table & mirror", price: 2_900, slot: "dresser", rooms: BED, comfort: 1, blurb: "For the perfume, the gele and the last look before church." }),
  desk: P({ id: "desk", name: "Desk, chair & laptop corner", price: 3_400, slot: "desk", rooms: ["bedroom", "study"], comfort: 1, blurb: "Homework, Excel sheets, late-night business plans." }),
  bookshelf: P({ id: "bookshelf", name: "Bookshelves", price: 3_100, slot: "shelf", rooms: ["study", "lounge", "living"], comfort: 1, blurb: "Floor-to-ceiling, filled." }),
  split_ac: P({ id: "split_ac", name: "1.5HP split AC (installed)", price: 9_800, slot: "ac", rooms: ANY, comfort: 2, asItem: "split_ac", blurb: "Cold room, warm ECG bill." }),
  curtains: P({ id: "curtains", name: "Curtains & rails", price: 1_500, slot: "curtains", rooms: ANY, comfort: 1, blurb: "Blackout lining behind, sheer in front." }),
  rug: P({ id: "rug", name: "Large rug", price: 1_800, slot: "rug", rooms: ANY, comfort: 1, blurb: "Soft under bare feet." }),
  art: P({ id: "art", name: "Framed art", price: 1_400, slot: "art", rooms: ANY, comfort: 1, blurb: "Kente-pattern canvas in a gold frame." }),
  plant: P({ id: "plant", name: "Potted plant", price: 350, slot: "plant", rooms: ANY, comfort: 0, blurb: "A tall snake plant by the window." }),
  lights: P({ id: "lights", name: "Pendant light", price: 1_200, slot: "lights", rooms: ANY, comfort: 0, blurb: "Warm light from the ceiling." }),
  leather_sofa: P({ id: "leather_sofa", name: "L-shaped leather sectional", price: 24_000, slot: "sofa", rooms: SIT, comfort: 4, blurb: "Seats the whole family for the Black Stars." }),
  fabric_sofa: P({ id: "fabric_sofa", name: "Fabric sofa set (3+2)", price: 9_500, slot: "sofa", rooms: SIT, comfort: 3, blurb: "Deep cushions, easy to clean." }),
  wooden_sofa: P({ id: "wooden_sofa", name: "Wooden sofa set with cushions", price: 4_800, slot: "sofa", rooms: SIT, comfort: 2, blurb: "Carved arms, crocheted covers optional." }),
  tv65: P({ id: "tv65", name: "65-inch smart TV & media wall", price: 19_500, slot: "tv", rooms: SIT, comfort: 3, asItem: "smart_tv65", blurb: "Decoder, soundbar, Netflix for the in-laws." }),
  tv32: P({ id: "tv32", name: "32-inch TV & stand", price: 3_400, slot: "tv", rooms: SIT, comfort: 1, asItem: "tv32", blurb: "News at 7, telenovelas at 8." }),
  coffee_table: P({ id: "coffee_table", name: "Coffee table & fruit bowl", price: 1_900, slot: "table", rooms: SIT, comfort: 1, blurb: "Holds the remote, the Bible and the visitor's Fanta." }),
  armchairs: P({ id: "armchairs", name: "Pair of armchairs", price: 4_200, slot: "armchairs", rooms: SIT, comfort: 1, blurb: "For the elders when they visit." }),
  piano: P({ id: "piano", name: "Grand piano", price: 65_000, slot: "piano", rooms: ["living"], comfort: 2, blurb: "Black and gloss. Someone in the family will learn." }),
  dining10: P({ id: "dining10", name: "10-seater marble dining table", price: 21_000, slot: "dining", rooms: ["dining"], comfort: 3, blurb: "Christmas lunch for everyone." }),
  dining6: P({ id: "dining6", name: "6-seater dining set", price: 7_500, slot: "dining", rooms: ["dining"], comfort: 2, blurb: "Sunday rice and stew." }),
  cabinet: P({ id: "cabinet", name: "China cabinet", price: 5_200, slot: "cabinet", rooms: ["dining"], comfort: 1, blurb: "The good plates, for visitors only." }),
};
export const PIECE_IDS = Object.keys(PIECES);

/** What's in each room: room id → piece ids. */
export type Furnishing = Record<string, string[]>;

/** Everything in a fully furnished house (what a landlord puts in a rented villa or mansion). */
export function fullyFurnished(tier: HomeTier): Furnishing {
  const out: Furnishing = {};
  for (const r of ROOM_PLANS[tier] ?? []) {
    if (r.kind === "bedroom") out[r.id] = [r.id === "bed1" ? "king_bed" : r.id === "bed6" || (r.id === "bed3" && tier === "villa") ? "twin_beds" : "double_bed", "wardrobe", "dresser", "split_ac", "curtains", "rug", "art", "plant", "lights", ...(r.id === "bed3" || r.id === "bed6" ? ["desk"] : [])];
    else if (r.kind === "living") out[r.id] = ["leather_sofa", "tv65", "coffee_table", "armchairs", "split_ac", "curtains", "rug", "art", "plant", "lights", ...(tier === "mansion" ? ["piano"] : [])];
    else if (r.kind === "dining") out[r.id] = [tier === "mansion" ? "dining10" : "dining6", "cabinet", "split_ac", "curtains", "lights", "art"];
    else if (r.kind === "study") out[r.id] = ["desk", "bookshelf", "split_ac", "art"];
    else out[r.id] = ["fabric_sofa", "tv65", "bookshelf", "rug", "split_ac", "plant", "lights"];
  }
  return out;
}

/** Comfort from furnishing: the average furnished room, up to +4. */
export function furnishComfort(f: Furnishing, tier: HomeTier): number {
  const rooms = ROOM_PLANS[tier] ?? [];
  if (!rooms.length) return 0;
  const sum = rooms.reduce((a, r) => a + (f[r.id] ?? []).reduce((b, id) => b + (PIECES[id]?.comfort ?? 0), 0), 0);
  return Math.min(4, Math.round(sum / rooms.length / 3));
}

/** The shop items your furniture counts as (a TV in the lounge lets you watch TV). */
export const furnishItems = (f: Furnishing) => Object.values(f).flat().map((id) => PIECES[id]?.asItem).filter((x): x is string => !!x);

/** Buying a house furnished: every room fitted out, 15% cheaper than piece by piece (GH₵). */
export function furnishedPackage(tier: HomeTier): number {
  return Math.round(Object.values(fullyFurnished(tier)).flat().reduce((a, id) => a + PIECES[id].price, 0) * 0.85);
}

// ---------------------------------------------------------------------------
// Free placement. Each piece you place is its own item with a position and a
// turn; you can move it, put it in storage or sell it. Pieces that hang on a
// wall (AC, curtains, art) go in the room's wall spot instead.

export type Category = "sleep" | "comfort" | "dining" | "work" | "light" | "decor" | "cooling";
export const CATEGORY_LABEL: Record<Category, string> = { sleep: "🛏️ Sleep", comfort: "🛋️ Comfort", dining: "🍽️ Dining", work: "💻 Work & study", light: "💡 Light", decor: "🪴 Decor", cooling: "❄️ Cooling" };
export interface PieceInfo {
  category: Category;
  /** Footprint in metres before turning: width along the wall, depth out from it. */
  size: [number, number];
  /** Hung on a wall, so it uses the room's wall spot. */
  wall?: boolean;
  /** You can walk over it (rugs) or under it (ceiling lights). */
  passable?: boolean;
  use: string;
  power?: string;
}
export const PIECE_INFO: Record<string, PieceInfo> = {
  king_bed: { category: "sleep", size: [2.9, 2.3], use: "Sleep. Best rest in the house." },
  double_bed: { category: "sleep", size: [2.6, 2.2], use: "Sleep for one or two." },
  twin_beds: { category: "sleep", size: [2.9, 2.2], use: "Two children, or two guests." },
  carpenter_bed: { category: "sleep", size: [2.6, 2.2], use: "Sleep. Solid and simple." },
  wardrobe: { category: "sleep", size: [2.4, 0.65], use: "Storage for clothes and bags." },
  dresser: { category: "sleep", size: [1.2, 0.5], use: "Getting ready; a mirror and drawers." },
  desk: { category: "work", size: [1.5, 1.4], use: "Homework, work from home (with a laptop)." },
  bookshelf: { category: "work", size: [1.6, 0.4], use: "Books and files." },
  split_ac: { category: "cooling", size: [1, 0.3], wall: true, use: "Cool room, better sleep.", power: "High (about 1.5 HP)" },
  curtains: { category: "decor", size: [1.5, 0.2], wall: true, use: "Privacy and shade." },
  art: { category: "decor", size: [1, 0.1], wall: true, use: "Something to look at." },
  rug: { category: "decor", size: [3, 2.2], passable: true, use: "Soft underfoot." },
  plant: { category: "decor", size: [0.7, 0.7], use: "Greenery." },
  lights: { category: "light", size: [0.6, 0.6], passable: true, use: "Warm light from the ceiling.", power: "Low" },
  leather_sofa: { category: "comfort", size: [3.3, 2.5], use: "Seats five; watch TV in comfort." },
  fabric_sofa: { category: "comfort", size: [2.3, 0.95], use: "Seats three." },
  wooden_sofa: { category: "comfort", size: [4.9, 1.9], use: "Three-seater and two singles." },
  tv65: { category: "comfort", size: [2.4, 0.5], use: "Watch TV and football.", power: "Medium" },
  tv32: { category: "comfort", size: [1.6, 0.5], use: "Watch TV.", power: "Low" },
  coffee_table: { category: "comfort", size: [1.1, 0.6], use: "Somewhere to put things down." },
  armchairs: { category: "comfort", size: [0.9, 0.9], use: "One armchair. Buy two for a pair." },
  piano: { category: "comfort", size: [1.5, 2.4], use: "Practise; the house fills with music." },
  dining10: { category: "dining", size: [3.8, 2.1], use: "Seats ten." },
  dining6: { category: "dining", size: [2.5, 2.1], use: "Seats six." },
  cabinet: { category: "dining", size: [2.2, 0.45], use: "Display the good plates." },
};

/** A room you can lay out: its floor, and the rectangle you can place things in (world metres, that floor's local frame). */
export interface PlanRect { level: number; x0: number; z0: number; x1: number; z1: number }

/** Dimensions of the storey houses, shared by the 3D builder and the server's placement checks. */
export function manorDims(tier: "villa" | "mansion") {
  const mansion = tier === "mansion";
  const hx = mansion ? 12 : 10, hz = mansion ? 8 : 7;
  return { mansion, hx, hz, FY: 3.4, NL: mansion ? 3 : 2, s0: mansion ? -1.6 : -2, s1: mansion ? 4.4 : 3.6, HW: 2.6, lz0: 0.5, gx1: -5.6, kz: mansion ? 2 : 1.5, outside: 9 };
}

/** Where each furnishable room is, by home tier. */
export function roomRects(tier: HomeTier): Record<string, PlanRect> {
  if (tier === "mansion" || tier === "villa") {
    const d = manorDims(tier);
    const out: Record<string, PlanRect> = {
      living: { level: 0, x0: -d.hx, z0: d.lz0, x1: -d.HW, z1: d.hz },
      dining: { level: 0, x0: d.HW, z0: d.kz, x1: d.hx, z1: d.hz },
      study: { level: 0, x0: d.gx1, z0: -3, x1: -d.HW, z1: d.lz0 },
      [d.mansion ? "bed7" : "bed4"]: { level: 0, x0: -d.hx, z0: -d.hz, x1: d.gx1, z1: -1.8 },
      lounge: { level: 1, x0: -d.hx, z0: d.lz0, x1: -d.HW, z1: d.hz },
      bed1: { level: 1, x0: -d.hx, z0: -d.hz, x1: -d.HW, z1: d.lz0 - 3.2 },
      bed2: { level: 1, x0: d.HW, z0: -d.hz, x1: d.hx, z1: d.s0 },
      bed3: { level: 1, x0: d.HW, z0: d.s0, x1: d.hx, z1: d.s1 },
    };
    if (d.mansion) {
      out.bed4 = { level: 2, x0: -d.hx, z0: -d.hz, x1: -d.HW, z1: d.s0 };
      out.bed5 = { level: 2, x0: -d.hx, z0: d.s0, x1: -d.HW, z1: d.s1 };
      out.bed6 = { level: 2, x0: d.HW, z0: -d.hz, x1: d.hx, z1: d.s0 };
    }
    return out;
  }
  // A rented flat: the open-plan living space in front of the bedroom partition.
  if (tier === "flat") return { main: { level: 0, x0: -4.5, z0: -0.4, x1: 4.5, z1: 3.75 } };
  return {};
}
/** The rooms you can furnish freely, with their names and kinds. */
export function placeableRooms(tier: HomeTier): { id: string; name: string; kind: RoomKind | "any"; level: number }[] {
  const rects = roomRects(tier);
  const plans = ROOM_PLANS[tier];
  if (plans) return plans.filter((p) => rects[p.id]).map((p) => ({ id: p.id, name: p.name, kind: p.kind, level: rects[p.id].level }));
  return Object.entries(rects).map(([id, r]) => ({ id, name: "Living space", kind: "any" as const, level: r.level }));
}

/** The footprint of a piece at a position and quarter-turn, as a rectangle. */
export function footprint(piece: string, x: number, z: number, rot: number) {
  const [w, d] = PIECE_INFO[piece]?.size ?? [1, 1];
  const [fw, fd] = rot % 2 ? [d, w] : [w, d];
  return { minX: x - fw / 2, maxX: x + fw / 2, minZ: z - fd / 2, maxZ: z + fd / 2 };
}
export const overlaps = (a: { minX: number; maxX: number; minZ: number; maxZ: number }, b: { minX: number; maxX: number; minZ: number; maxZ: number }) =>
  a.minX < b.maxX - 0.02 && a.maxX > b.minX + 0.02 && a.minZ < b.maxZ - 0.02 && a.maxZ > b.minZ + 0.02;
/** Inside the room, with a hand's width from the walls. */
export function fitsRoom(piece: string, x: number, z: number, rot: number, r: PlanRect) {
  const f = footprint(piece, x, z, rot);
  return f.minX >= r.x0 + 0.08 && f.maxX <= r.x1 - 0.08 && f.minZ >= r.z0 + 0.08 && f.maxZ <= r.z1 - 0.08;
}

/** Delivery and setting up, charged with a new piece. */
export const deliveryFee = (price: number) => Math.max(40, Math.round(price * 0.03));
/** What a dealer pays for used furniture: 40% of what you paid, less wear. */
export const resaleValue = (paid: number, condition = 1) => Math.round(paid * RESALE_RATE * condition);
export const RESALE_RATE = 0.4;

/** Wall paint (the whole house) and floors (room by room). Prices in GH₵. */
export const FINISHES = {
  wall: {
    cream: { name: "Warm cream", color: "#f4eee3", price: 0 },
    white: { name: "Brilliant white", color: "#fbfaf6", price: 3_800 },
    sand: { name: "Sahel sand", color: "#e9dcc4", price: 4_200 },
    sage: { name: "Sage green", color: "#d3dccb", price: 4_200 },
    grey: { name: "Dove grey", color: "#dcdcd8", price: 4_200 },
    clay: { name: "Terracotta clay", color: "#e2c3ad", price: 4_600 },
  },
  floor: {
    oak: { name: "Oak boards", price: 0 },
    walnut: { name: "Dark walnut boards", price: 2_400 },
    marble: { name: "Polished marble", price: 5_200 },
    tiles: { name: "Porcelain tiles", price: 1_800 },
    terrazzo: { name: "Terrazzo", price: 2_900 },
  },
} as const;
export type WallFinish = keyof typeof FINISHES.wall;
export type FloorFinish = keyof typeof FINISHES.floor;
/** Finishes chosen for a home: the paint, and each room's floor. */
export type Finishes = { wall?: WallFinish; floors?: Record<string, FloorFinish> };
/** A piece placed by hand (positions are in the floor's own frame). */
export interface PlacedPiece { id: number; piece: string; room: string; level: number; x: number; z: number; rot: number }
