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
