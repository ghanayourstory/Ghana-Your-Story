// Cities of Ghana. Accra is playable; others are registered at their real
// locations so the map, intercity travel and future content slot in cleanly.
import type { LatLon } from "./geo.ts";

export type CityId = "accra" | "tema" | "kumasi" | "cape_coast" | "takoradi" | "tamale" | "ho";

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
  tema: { id: "tema", name: "Tema", region: "Greater Accra", center: { lat: 5.6698, lon: -0.0166 }, playable: false, tagline: "Harbour city, factories and the motorway.", landmarks: [{ name: "Tema Harbour", at: { lat: 5.6346, lon: 0.0119 }, icon: "⚓" }] },
  kumasi: { id: "kumasi", name: "Kumasi", region: "Ashanti", center: { lat: 6.6885, lon: -1.6244 }, playable: false, tagline: "The Garden City and the heart of Asante.", landmarks: [{ name: "Kejetia Market", at: { lat: 6.6966, lon: -1.6233 }, icon: "🧺" }, { name: "Manhyia Palace", at: { lat: 6.7065, lon: -1.6153 }, icon: "👑" }] },
  cape_coast: { id: "cape_coast", name: "Cape Coast", region: "Central", center: { lat: 5.1053, lon: -1.2466 }, playable: false, tagline: "Castles, schools and the Atlantic.", landmarks: [{ name: "Cape Coast Castle", at: { lat: 5.1037, lon: -1.2414 }, icon: "🏰" }] },
  takoradi: { id: "takoradi", name: "Sekondi-Takoradi", region: "Western", center: { lat: 4.8975, lon: -1.7603 }, playable: false, tagline: "Oil City by the sea.", landmarks: [{ name: "Takoradi Market Circle", at: { lat: 4.8968, lon: -1.7556 }, icon: "🧺" }] },
  tamale: { id: "tamale", name: "Tamale", region: "Northern", center: { lat: 9.4008, lon: -0.8393 }, playable: false, tagline: "Gateway to the north.", landmarks: [{ name: "Tamale Central Market", at: { lat: 9.4034, lon: -0.8424 }, icon: "🧺" }] },
  ho: { id: "ho", name: "Ho", region: "Volta", center: { lat: 6.6008, lon: 0.4713 }, playable: false, tagline: "Hills, waterfalls and Volta hospitality.", landmarks: [] },
};

export const CITY_IDS = Object.keys(CITIES) as CityId[];

/** Intercity transport, for when more cities open. Prices in cedis. */
export const INTERCITY_MODES = {
  bus: { name: "Intercity bus", perKm: 0.55, base: 25, speedKmh: 55 },
  vip: { name: "VIP coach", perKm: 0.85, base: 40, speedKmh: 62 },
  flight: { name: "Domestic flight", perKm: 2.8, base: 650, speedKmh: 420 },
} as const;
