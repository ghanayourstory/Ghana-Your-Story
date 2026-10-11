// Ghana: the 16 regions, their capitals and major towns at real coordinates,
// and the major road corridors that connect them. Used for the country map,
// intercity travel times and fares, and for opening new cities over time.
import { haversineKm, type LatLon } from "./geo.ts";

export type RegionId =
  | "greater_accra" | "central" | "western" | "western_north" | "eastern" | "ashanti" | "ahafo" | "bono"
  | "bono_east" | "oti" | "volta" | "northern" | "savannah" | "north_east" | "upper_east" | "upper_west";

export interface Region {
  id: RegionId;
  name: string;
  capital: string; // town id
  /** Name used by the boundary dataset. */
  boundaryName: string;
  character: string;
}

export const REGIONS: Record<RegionId, Region> = {
  greater_accra: { id: "greater_accra", name: "Greater Accra", capital: "accra", boundaryName: "Greater Accra", character: "The capital: ministries, markets, beaches and traffic." },
  central: { id: "central", name: "Central", capital: "cape_coast", boundaryName: "Central", character: "Castles, fishing towns and Ghana's oldest schools." },
  western: { id: "western", name: "Western", capital: "takoradi", boundaryName: "Western", character: "Oil, gold, rainforest and a long Atlantic coast." },
  western_north: { id: "western_north", name: "Western North", capital: "sefwi_wiawso", boundaryName: "Western North", character: "Cocoa and timber country." },
  eastern: { id: "eastern", name: "Eastern", capital: "koforidua", boundaryName: "Eastern", character: "Hills, the Volta dam and beads at Koforidua." },
  ashanti: { id: "ashanti", name: "Ashanti", capital: "kumasi", boundaryName: "Ashanti", character: "The Garden City, Kejetia and the Asante kingdom." },
  ahafo: { id: "ahafo", name: "Ahafo", capital: "goaso", boundaryName: "Ahafo", character: "Gold mines and cocoa farms." },
  bono: { id: "bono", name: "Bono", capital: "sunyani", boundaryName: "Bono", character: "Sunyani, Ghana's cleanest city, and farming towns." },
  bono_east: { id: "bono_east", name: "Bono East", capital: "techiman", boundaryName: "Bono East", character: "Techiman's giant food market and the road north." },
  oti: { id: "oti", name: "Oti", capital: "dambai", boundaryName: "Oti", character: "Volta lake shores and the Eastern Corridor." },
  volta: { id: "volta", name: "Volta", capital: "ho", boundaryName: "Volta", character: "Mountains, waterfalls, Keta lagoon and Ewe culture." },
  northern: { id: "northern", name: "Northern", capital: "tamale", boundaryName: "Northern", character: "Tamale's motorbikes, shea butter and Dagbon." },
  savannah: { id: "savannah", name: "Savannah", capital: "damongo", boundaryName: "Savannah", character: "Mole National Park, Larabanga's mosque, Bole and Sawla." },
  north_east: { id: "north_east", name: "North East", capital: "nalerigu", boundaryName: "North East", character: "The Gambaga escarpment and Mamprugu." },
  upper_east: { id: "upper_east", name: "Upper East", capital: "bolgatanga", boundaryName: "Upper East", character: "Bolga baskets, Navrongo and painted Sirigu houses." },
  upper_west: { id: "upper_west", name: "Upper West", capital: "wa", boundaryName: "Upper West", character: "Wa Naa's palace, xylophones and the Black Volta." },
};

export interface Town {
  id: string;
  name: string;
  region: RegionId;
  at: LatLon;
  size: "capital" | "city" | "town";
}

const T = (id: string, name: string, region: RegionId, lat: number, lon: number, size: Town["size"] = "town"): Town => ({ id, name, region, at: { lat, lon }, size });

export const TOWNS: Town[] = [
  // Greater Accra
  T("accra", "Accra", "greater_accra", 5.6037, -0.187, "capital"),
  T("tema", "Tema", "greater_accra", 5.6698, -0.0166, "city"),
  T("ashaiman", "Ashaiman", "greater_accra", 5.6946, -0.0293),
  T("dodowa", "Dodowa", "greater_accra", 5.8826, -0.0985),
  T("ada", "Ada Foah", "greater_accra", 5.7836, 0.6345),
  // Central
  T("cape_coast", "Cape Coast", "central", 5.1053, -1.2466, "capital"),
  T("kasoa", "Kasoa", "central", 5.5345, -0.4168, "city"),
  T("winneba", "Winneba", "central", 5.3511, -0.6231),
  T("mankessim", "Mankessim", "central", 5.2667, -1.0167),
  T("elmina", "Elmina", "central", 5.0847, -1.3509),
  T("swedru", "Agona Swedru", "central", 5.5333, -0.7),
  T("assin_fosu", "Assin Fosu", "central", 5.7, -1.2667),
  T("dunkwa", "Dunkwa-on-Offin", "central", 5.9667, -1.7833),
  // Western
  T("takoradi", "Sekondi-Takoradi", "western", 4.8975, -1.7603, "capital"),
  T("tarkwa", "Tarkwa", "western", 5.3, -1.9833),
  T("prestea", "Prestea", "western", 5.4333, -2.15),
  T("agona_nkwanta", "Agona Nkwanta", "western", 4.8833, -1.9667),
  T("axim", "Axim", "western", 4.8667, -2.2333),
  T("elubo", "Elubo", "western", 5.2833, -2.7667),
  // Western North
  T("sefwi_wiawso", "Sefwi Wiawso", "western_north", 6.2058, -2.4891, "capital"),
  T("bibiani", "Bibiani", "western_north", 6.4667, -2.3167),
  T("enchi", "Enchi", "western_north", 5.8167, -2.8167),
  T("juaboso", "Juaboso", "western_north", 6.33, -2.82),
  // Eastern
  T("koforidua", "Koforidua", "eastern", 6.094, -0.2591, "capital"),
  T("nsawam", "Nsawam", "eastern", 5.8089, -0.3503),
  T("suhum", "Suhum", "eastern", 6.0333, -0.45),
  T("bunso", "Bunso", "eastern", 6.2833, -0.4667),
  T("nkawkaw", "Nkawkaw", "eastern", 6.55, -0.7667),
  T("akosombo", "Akosombo", "eastern", 6.3, 0.05),
  T("somanya", "Somanya", "eastern", 6.1, -0.0167),
  T("akim_oda", "Akim Oda", "eastern", 5.9167, -0.9833),
  T("kade", "Kade", "eastern", 6.0833, -0.8333),
  // Ashanti
  T("kumasi", "Kumasi", "ashanti", 6.6885, -1.6244, "capital"),
  T("ejisu", "Ejisu", "ashanti", 6.7167, -1.4667),
  T("konongo", "Konongo", "ashanti", 6.6167, -1.2167),
  T("obuasi", "Obuasi", "ashanti", 6.2, -1.6667, "city"),
  T("bekwai", "Bekwai", "ashanti", 6.45, -1.5833),
  T("offinso", "Offinso", "ashanti", 6.9333, -1.6667),
  T("mampong", "Mampong", "ashanti", 7.0667, -1.4),
  T("ejura", "Ejura", "ashanti", 7.3833, -1.3667),
  // Ahafo
  T("goaso", "Goaso", "ahafo", 6.8036, -2.5172, "capital"),
  T("kenyasi", "Kenyasi", "ahafo", 6.9667, -2.3833),
  T("bechem", "Bechem", "ahafo", 7.0833, -2.0333),
  // Bono
  T("sunyani", "Sunyani", "bono", 7.3349, -2.3123, "capital"),
  T("berekum", "Berekum", "bono", 7.45, -2.5833),
  T("dormaa", "Dormaa Ahenkro", "bono", 7.2833, -2.8667),
  T("wenchi", "Wenchi", "bono", 7.7333, -2.1),
  // Bono East
  T("techiman", "Techiman", "bono_east", 7.5866, -1.9381, "capital"),
  T("kintampo", "Kintampo", "bono_east", 8.0563, -1.7307),
  T("nkoranza", "Nkoranza", "bono_east", 7.5667, -1.7),
  T("atebubu", "Atebubu", "bono_east", 7.75, -0.9833),
  T("yeji", "Yeji", "bono_east", 8.2167, -0.65),
  // Oti
  T("dambai", "Dambai", "oti", 8.07, 0.179, "capital"),
  T("nkwanta", "Nkwanta", "oti", 8.2667, 0.5167),
  T("kete_krachi", "Kete Krachi", "oti", 7.8, -0.0333),
  T("jasikan", "Jasikan", "oti", 7.4, 0.4667),
  T("kadjebi", "Kadjebi", "oti", 7.5333, 0.4667),
  // Volta
  T("ho", "Ho", "volta", 6.6008, 0.4713, "capital"),
  T("hohoe", "Hohoe", "volta", 7.1519, 0.4736),
  T("kpando", "Kpando", "volta", 6.9944, 0.2931),
  T("sogakope", "Sogakope", "volta", 5.9989, 0.6034),
  T("keta", "Keta", "volta", 5.9178, 0.9895),
  T("aflao", "Aflao", "volta", 6.1167, 1.1833),
  // Northern
  T("tamale", "Tamale", "northern", 9.4008, -0.8393, "capital"),
  T("savelugu", "Savelugu", "northern", 9.6247, -0.8253),
  T("yendi", "Yendi", "northern", 9.4428, -0.0099),
  T("bimbilla", "Bimbilla", "northern", 8.8556, -0.0573),
  // Savannah
  T("damongo", "Damongo", "savannah", 9.0833, -1.8167, "capital"),
  T("larabanga", "Larabanga", "savannah", 9.2167, -1.85),
  T("bole", "Bole", "savannah", 9.0333, -2.4833),
  T("sawla", "Sawla", "savannah", 9.2833, -2.4167),
  T("buipe", "Buipe", "savannah", 8.7833, -1.4667),
  T("salaga", "Salaga", "savannah", 8.55, -0.5167),
  // North East
  T("nalerigu", "Nalerigu", "north_east", 10.5276, -0.3698, "capital"),
  T("gambaga", "Gambaga", "north_east", 10.5333, -0.4333),
  T("walewale", "Walewale", "north_east", 10.35, -0.8),
  // Upper East
  T("bolgatanga", "Bolgatanga", "upper_east", 10.7856, -0.8514, "capital"),
  T("navrongo", "Navrongo", "upper_east", 10.8956, -1.0921),
  T("paga", "Paga", "upper_east", 10.9833, -1.1167),
  T("bawku", "Bawku", "upper_east", 11.0616, -0.2417),
  T("zebilla", "Zebilla", "upper_east", 10.95, -0.47),
  // Upper West
  T("wa", "Wa", "upper_west", 10.0601, -2.5099, "capital"),
  T("tumu", "Tumu", "upper_west", 10.8833, -1.9833),
  T("lawra", "Lawra", "upper_west", 10.65, -2.9),
  T("nandom", "Nandom", "upper_west", 10.85, -2.75),
  T("jirapa", "Jirapa", "upper_west", 10.5333, -2.7),
];

export const TOWN_BY_ID: Record<string, Town> = Object.fromEntries(TOWNS.map((t) => [t.id, t]));

/** Major road corridors, as sequences of towns along the route. */
export const ROAD_CORRIDORS: { name: string; via: string[] }[] = [
  { name: "N1 Coastal Highway (Aflao–Accra–Takoradi–Elubo)", via: ["aflao", "sogakope", "tema", "accra", "kasoa", "winneba", "mankessim", "cape_coast", "elmina", "takoradi", "agona_nkwanta", "axim", "elubo"] },
  { name: "Aflao–Keta road", via: ["aflao", "keta", "sogakope"] },
  { name: "Accra–Ada road", via: ["tema", "ada"] },
  { name: "N6 Accra–Kumasi Highway", via: ["accra", "nsawam", "suhum", "bunso", "nkawkaw", "konongo", "ejisu", "kumasi"] },
  { name: "Nsawam–Koforidua road", via: ["nsawam", "koforidua", "bunso"] },
  { name: "Accra–Dodowa–Somanya road", via: ["accra", "dodowa", "somanya", "akosombo"] },
  { name: "Tema–Akosombo–Ho road", via: ["tema", "ashaiman", "akosombo", "ho"] },
  { name: "Ho–Aflao road", via: ["ho", "aflao"] },
  { name: "Eastern Corridor (Ho–Hohoe–Nkwanta–Yendi)", via: ["ho", "kpando", "hohoe", "jasikan", "kadjebi", "nkwanta", "bimbilla", "yendi"] },
  { name: "Jasikan–Dambai road", via: ["jasikan", "dambai", "kete_krachi"] },
  { name: "N8 Cape Coast–Kumasi road", via: ["cape_coast", "assin_fosu", "bekwai", "kumasi"] },
  { name: "Kumasi–Obuasi–Takoradi road", via: ["kumasi", "bekwai", "obuasi", "dunkwa", "tarkwa", "takoradi"] },
  { name: "Tarkwa–Prestea road", via: ["tarkwa", "prestea"] },
  { name: "Winneba–Swedru–Akim Oda road", via: ["winneba", "swedru", "akim_oda", "kade", "bunso"] },
  { name: "N10 Kumasi–Tamale–Paga Highway", via: ["kumasi", "offinso", "techiman", "kintampo", "buipe", "tamale", "savelugu", "walewale", "bolgatanga", "navrongo", "paga"] },
  { name: "Kumasi–Mampong–Ejura–Atebubu road", via: ["kumasi", "mampong", "ejura", "atebubu", "yeji"] },
  { name: "Techiman–Nkoranza–Kintampo road", via: ["techiman", "nkoranza", "kintampo"] },
  { name: "Kumasi–Sunyani road", via: ["kumasi", "bechem", "sunyani"] },
  { name: "Sunyani–Techiman road", via: ["sunyani", "techiman"] },
  { name: "Sunyani–Berekum–Dormaa road", via: ["sunyani", "berekum", "dormaa"] },
  { name: "Techiman–Wenchi–Bole–Sawla–Wa road", via: ["techiman", "wenchi", "bole", "sawla", "wa"] },
  { name: "Tamale–Damongo–Sawla road", via: ["tamale", "damongo", "larabanga", "sawla"] },
  { name: "Tamale–Salaga road", via: ["tamale", "salaga"] },
  { name: "Tamale–Yendi road", via: ["tamale", "yendi"] },
  { name: "Walewale–Gambaga–Nalerigu road", via: ["walewale", "gambaga", "nalerigu"] },
  { name: "Bolgatanga–Bawku road", via: ["bolgatanga", "zebilla", "bawku"] },
  { name: "Wa–Tumu–Navrongo road", via: ["wa", "tumu", "navrongo"] },
  { name: "Wa–Jirapa–Lawra–Nandom road", via: ["wa", "jirapa", "lawra", "nandom"] },
  { name: "Kumasi–Goaso road", via: ["kumasi", "goaso", "kenyasi", "sunyani"] },
  { name: "Kumasi–Bibiani–Sefwi Wiawso road", via: ["kumasi", "bibiani", "sefwi_wiawso", "juaboso", "enchi", "elubo"] },
];

/** Roads wind: the road distance is a bit longer than the straight line. */
export const INTERCITY_ROAD_FACTOR = 1.22;

interface Edge {
  to: string;
  km: number;
  road: string;
}

const GRAPH: Map<string, Edge[]> = (() => {
  const g = new Map<string, Edge[]>();
  const add = (a: string, b: string, road: string) => {
    const km = Math.round(haversineKm(TOWN_BY_ID[a].at, TOWN_BY_ID[b].at) * INTERCITY_ROAD_FACTOR);
    (g.get(a) ?? g.set(a, []).get(a)!).push({ to: b, km, road });
    (g.get(b) ?? g.set(b, []).get(b)!).push({ to: a, km, road });
  };
  for (const r of ROAD_CORRIDORS) for (let i = 1; i < r.via.length; i++) add(r.via[i - 1], r.via[i], r.name);
  return g;
})();

export interface Route {
  km: number;
  towns: string[];
  roads: string[];
}

/** Shortest road route between two towns (Dijkstra). */
export function routeBetween(from: string, to: string): Route | null {
  if (from === to) return { km: 0, towns: [from], roads: [] };
  const dist = new Map<string, number>([[from, 0]]);
  const prev = new Map<string, { town: string; road: string }>();
  const open = new Set<string>([from]);
  while (open.size) {
    let cur = "";
    let best = Infinity;
    for (const t of open) if ((dist.get(t) ?? Infinity) < best) { best = dist.get(t)!; cur = t; }
    open.delete(cur);
    if (cur === to) break;
    for (const e of GRAPH.get(cur) ?? []) {
      const nd = best + e.km;
      if (nd < (dist.get(e.to) ?? Infinity)) {
        dist.set(e.to, nd);
        prev.set(e.to, { town: cur, road: e.road });
        open.add(e.to);
      }
    }
  }
  if (!dist.has(to)) return null;
  const towns = [to];
  const roads: string[] = [];
  let c = to;
  while (c !== from) {
    const p = prev.get(c)!;
    if (roads[0] !== p.road) roads.unshift(p.road);
    towns.unshift(p.town);
    c = p.town;
  }
  return { km: dist.get(to)!, towns, roads };
}

export function roadSegments(): { a: LatLon; b: LatLon; road: string }[] {
  const out: { a: LatLon; b: LatLon; road: string }[] = [];
  for (const r of ROAD_CORRIDORS) for (let i = 1; i < r.via.length; i++) out.push({ a: TOWN_BY_ID[r.via[i - 1]].at, b: TOWN_BY_ID[r.via[i]].at, road: r.name });
  return out;
}
