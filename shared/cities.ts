// Cities of Ghana. Accra is playable; others are registered at their real
// locations so the map, intercity travel and future content slot in cleanly.
import { haversineKm, type LatLon } from "./geo.ts";
import { REGIONS, TOWN_BY_ID, routeBetween } from "./ghana.ts";
import { REGIONAL_DISTRICTS, REGIONAL_PLACES, SITES } from "./regional.ts";

/** City ids are town ids from ghana.ts. */
export type CityId = string;

export interface City {
  id: CityId;
  name: string;
  region: string;
  center: LatLon;
  playable: boolean;
  tagline: string;
  /** Simplified real coastline (west → east) for the city map, if coastal. */
  coastline?: LatLon[];
  /** Real public landmarks shown on the map (not necessarily enterable yet). */
  landmarks: { name: string; at: LatLon; icon: string }[];
}

export const CITIES: Record<CityId, City> = {
  accra: {
    id: "accra",
    name: "Accra",
    region: "Greater Accra",
    center: { lat: 5.6037, lon: -0.187 },
    playable: true,
    tagline: "The capital. Hustle, coast and ambition.",
    coastline: [
      { lat: 5.523, lon: -0.29 }, { lat: 5.529, lon: -0.255 }, { lat: 5.528, lon: -0.226 }, { lat: 5.531, lon: -0.213 },
      { lat: 5.539, lon: -0.197 }, { lat: 5.546, lon: -0.18 }, { lat: 5.552, lon: -0.163 }, { lat: 5.557, lon: -0.148 },
      { lat: 5.566, lon: -0.127 }, { lat: 5.578, lon: -0.105 }, { lat: 5.595, lon: -0.075 }, { lat: 5.612, lon: -0.045 },
      { lat: 5.63, lon: -0.01 },
    ],
    landmarks: [
      { name: "Black Star Square", at: { lat: 5.5477, lon: -0.1923 }, icon: "⭐" },
      { name: "Osu Castle", at: { lat: 5.547, lon: -0.18 }, icon: "🏰" },
      { name: "Kwame Nkrumah Memorial Park", at: { lat: 5.5441, lon: -0.2041 }, icon: "🏛️" },
      { name: "Makola Market", at: { lat: 5.55, lon: -0.209 }, icon: "🧺" },
      { name: "Jamestown Lighthouse", at: { lat: 5.5325, lon: -0.212 }, icon: "🗼" },
      { name: "National Theatre", at: { lat: 5.555, lon: -0.2 }, icon: "🎭" },
      { name: "Kaneshie Market", at: { lat: 5.5689, lon: -0.2363 }, icon: "🧺" },
      { name: "Labadi Beach", at: { lat: 5.5585, lon: -0.147 }, icon: "🏖️" },
      { name: "Kotoka International Airport", at: { lat: 5.6052, lon: -0.1668 }, icon: "✈️" },
      { name: "University of Ghana", at: { lat: 5.6508, lon: -0.187 }, icon: "🎓" },
      { name: "Tetteh Quarshie Interchange", at: { lat: 5.6205, lon: -0.1722 }, icon: "🛣️" },
      { name: "Kwame Nkrumah Circle", at: { lat: 5.5697, lon: -0.2154 }, icon: "🔄" },
    ],
  },
};

export const CITY_IDS = Object.keys(CITIES) as CityId[];

// Every town with a playable district is a city you can live in.
for (const d of REGIONAL_DISTRICTS) {
  if (CITIES[d.city]) continue;
  const t = TOWN_BY_ID[d.city];
  CITIES[d.city] = {
    id: d.city, name: t.name, region: REGIONS[t.region].name, center: t.at, playable: true, tagline: d.tagline,
    landmarks: [
      ...REGIONAL_PLACES.filter((p) => p.district === d.id && p.geo).map((p) => ({ name: p.name, at: p.geo!, icon: p.kind === "clinic" ? "🏥" : p.kind === "market" ? "🧺" : p.kind === "school" ? "🎓" : "⭐" })),
      ...SITES.filter((s) => s.from.includes(d.id)).map((s) => ({ name: s.name, at: s.at, icon: s.kind === "waterfall" ? "💧" : s.kind === "wildlife" ? "🐘" : s.kind === "heritage" ? "🏛️" : s.kind === "beach" ? "🏖️" : s.kind === "dam" ? "⚡" : s.kind === "craft" ? "🧵" : "🌿" })),
    ],
  };
}

/** Intercity transport. Prices in cedis. */
export type IntercityMode = "bus" | "vip" | "flight" | "car" | "own_plane";
export const INTERCITY_MODES: Record<IntercityMode, { name: string; perKm: number; base: number; speedKmh: number; overhead: number; hours: [number, number]; note: string }> = {
  bus: { name: "Intercity bus", perKm: 0.48, base: 20, speedKmh: 48, overhead: 60, hours: [4, 22], note: "From the lorry station. Leaves when it's full." },
  vip: { name: "VIP / STC coach", perKm: 0.72, base: 35, speedKmh: 58, overhead: 45, hours: [5, 23], note: "Air-con, a movie and a reserved seat." },
  flight: { name: "Domestic flight", perKm: 2.6, base: 600, speedKmh: 420, overhead: 120, hours: [6, 20], note: "Only between towns with airports." },
  car: { name: "Drive yourself", perKm: 1.1, base: 0, speedKmh: 65, overhead: 0, hours: [0, 24], note: "Fuel only. Mind the potholes and the police barriers." },
  own_plane: { name: "Your aircraft", perKm: 9, base: 400, speedKmh: 300, overhead: 40, hours: [6, 19], note: "Fuel, landing fees and your pilot. Airports only, daylight (VFR)." },
};

/** Towns with commercial airports. */
export const AIRPORTS = ["accra", "kumasi", "tamale", "takoradi", "wa", "ho", "sunyani"];

export function intercityQuote(from: CityId, to: CityId, mode: IntercityMode) {
  const route = routeBetween(from, to);
  if (!route) return null;
  const m = INTERCITY_MODES[mode];
  if ((mode === "flight" || mode === "own_plane") && !(AIRPORTS.includes(from) && AIRPORTS.includes(to))) return null;
  const km = mode === "flight" || mode === "own_plane" ? Math.round(haversineKm(TOWN_BY_ID[from].at, TOWN_BY_ID[to].at)) : route.km;
  const minutes = Math.round((km / m.speedKmh) * 60) + m.overhead;
  const fare = Math.round(m.base + m.perKm * km);
  const energy = mode === "flight" ? -8 : mode === "car" ? -Math.min(45, Math.round(6 + km / 15)) : -Math.min(20, Math.round(4 + km / 40));
  return { km, minutes, fare, energy, route };
}
