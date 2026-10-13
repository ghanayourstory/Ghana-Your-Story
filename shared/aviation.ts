// Airports, scheduled flights, charters and private aircraft.
//
// Two things are kept apart on purpose:
//  1. Whether an airport exists and what it has (facts, with a source).
//  2. Whether a scheduled passenger route operates (also sourced). A route
//     that we could not confirm is shown but cannot be booked.
// Timetables, fares, delays and the airlines' names inside the game are game
// simulation, not real schedules or prices. Facts that change carry the date
// we last checked them; re-check before relying on them.

export type AirportType = "international" | "domestic" | "airstrip" | "helipad";
export type RunwayClass = "A" | "B" | "C" | "H"; // A: jets, B: turboprops, C: light aircraft, H: helicopters only

export interface Source { ref: string; url?: string; reviewed: string; confidence: "confirmed" | "reported" | "unverified" }

export interface Airport {
  id: string;
  name: string;
  iata?: string;
  /** Town the airport serves (a city id in the game). */
  city: string;
  region: string;
  type: AirportType;
  /** Game simplification for which aircraft may land (not real runway data). */
  runway: RunwayClass;
  status: "operating" | "limited" | "closed";
  statusNote: string;
  /** In-game facilities (game content; local review wanted). */
  facilities: string[];
  accessibility: string[];
  services: ("scheduled" | "charter" | "private" | "helicopter")[];
  /** Where in the game world you board (the district with the terminal). */
  district?: string;
  source: Source;
  /** Fictional places are game-only and say so. */
  fictional?: boolean;
}

const REVIEWED = "2026-10-13";
const GACL_WIKI: Source = { ref: "Wikipedia: Ghana Airports Company Limited (airports it manages)", url: "https://en.wikipedia.org/wiki/Ghana_Airports_Company_Limited", reviewed: REVIEWED, confidence: "reported" };

export const AIRPORTS_GH: Airport[] = [
  {
    id: "kotoka", name: "Kotoka International Airport", iata: "ACC", city: "accra", region: "Greater Accra", type: "international", runway: "A", district: "airport_city",
    status: "operating", statusNote: "Ghana's main airport; domestic flights leave from Terminal 3 in the game.",
    facilities: ["Departures & arrivals halls", "Pick-up and drop-off lanes", "Food court", "Shops & forex", "Business lounge", "Baggage services desk", "Taxis and ride-hail"],
    accessibility: ["Step-free terminal (game)", "Wheelchair assistance on request (game)"],
    services: ["scheduled", "charter", "private", "helicopter"],
    source: { ref: "CitiNewsroom, Sep 2026: GACL awards at ACI Africa; Kotoka record 3.62m passengers in 2025", url: "https://www.citinewsroom.com/2026/09/ghana-airports-company-limited-wins-two-global-awards/", reviewed: REVIEWED, confidence: "confirmed" },
  },
  {
    id: "kumasi", name: "Prempeh I International Airport", iata: "KMS", city: "kumasi", region: "Ashanti", type: "international", runway: "A",
    status: "operating", statusNote: "Kumasi's airport. In the game the terminal is reached by taxi from town.",
    facilities: ["Departures & arrivals halls", "Pick-up and drop-off", "Café", "Baggage desk"], accessibility: ["Wheelchair assistance on request (game)"],
    services: ["scheduled", "charter", "private", "helicopter"], source: GACL_WIKI,
  },
  {
    id: "tamale", name: "Yakubu Tali International Airport", iata: "TML", city: "tamale", region: "Northern", type: "international", runway: "A",
    status: "operating", statusNote: "The north's main airport.",
    facilities: ["Departures & arrivals halls", "Pick-up and drop-off", "Café", "Baggage desk"], accessibility: ["Wheelchair assistance on request (game)"],
    services: ["scheduled", "charter", "private", "helicopter"], source: { ref: "Wikipedia: Tamale International Airport", url: "https://en.wikipedia.org/wiki/Tamale_International_Airport", reviewed: REVIEWED, confidence: "reported" },
  },
  {
    id: "takoradi", name: "Takoradi Airport", iata: "TKD", city: "takoradi", region: "Western", type: "domestic", runway: "B",
    status: "operating", statusNote: "Serves Sekondi-Takoradi and the oil and gas industry. Not confirmed on the GACL list in our check.",
    facilities: ["Small terminal", "Pick-up and drop-off", "Kiosk"], accessibility: ["Ask staff for assistance (game)"],
    services: ["scheduled", "charter", "private", "helicopter"], source: { ref: "CitiNewsroom, Sep 2026: fare survey includes Accra–Takoradi", url: "https://www.citinewsroom.com/2026/09/are-domestic-airfares-really-high-in-ghana/", reviewed: REVIEWED, confidence: "reported" },
  },
  {
    id: "wa", name: "Wa Airport", iata: "WZA", city: "wa", region: "Upper West", type: "domestic", runway: "B",
    status: "limited", statusNote: "Operated by GACL. Current scheduled service could not be confirmed: charters and private flights only in the game.",
    facilities: ["Small terminal", "Pick-up and drop-off"], accessibility: ["Ask staff for assistance (game)"],
    services: ["charter", "private", "helicopter"], source: { ref: "Wikipedia: Wa Airport", url: "https://en.wikipedia.org/wiki/Wa_Airport", reviewed: REVIEWED, confidence: "reported" },
  },
  {
    id: "ho", name: "Ho Airport", iata: "HZO", city: "ho", region: "Volta", type: "domestic", runway: "B",
    status: "limited", statusNote: "Scheduled flights were suspended in March 2022 and we found no confirmed restart: charters and private flights only.",
    facilities: ["Small terminal", "Pick-up and drop-off"], accessibility: ["Ask staff for assistance (game)"],
    services: ["charter", "private", "helicopter"], source: { ref: "Wikipedia: Ho Airport (PassionAir suspended Ho flights, March 2022)", url: "https://en.wikipedia.org/wiki/Ho_Airport", reviewed: REVIEWED, confidence: "reported" },
  },
  {
    id: "sunyani", name: "Sunyani Airport", iata: "NYI", city: "sunyani", region: "Bono", type: "domestic", runway: "C",
    status: "limited", statusNote: "Reopened in 2022 after rehabilitation. A scheduled route was announced but we couldn't confirm it is flying now: charters and private flights only.",
    facilities: ["Small terminal", "Pick-up and drop-off"], accessibility: ["Ask staff for assistance (game)"],
    services: ["charter", "private", "helicopter"], source: { ref: "Wikipedia: Sunyani Airport", url: "https://en.wikipedia.org/wiki/Sunyani_Airport", reviewed: REVIEWED, confidence: "reported" },
  },
  // Game-only landing places (clearly fictional).
  {
    id: "trasacco_helipad", name: "Valley estate helipad (game)", city: "accra", region: "Greater Accra", type: "helipad", runway: "H", district: "trasacco", fictional: true,
    status: "operating", statusNote: "A private estate helipad in the game. Daylight only; noise rules apply.",
    facilities: ["Helipad", "Waiting room"], accessibility: ["Step-free (game)"], services: ["helicopter"],
    source: { ref: "Game content (fictional)", reviewed: REVIEWED, confidence: "unverified" },
  },
  {
    id: "mole_airstrip", name: "Savanna lodge airstrip (game)", city: "damongo", region: "Savannah", type: "airstrip", runway: "C", fictional: true,
    status: "operating", statusNote: "A grass airstrip near the national park in the game. Light aircraft and helicopters only, daylight.",
    facilities: ["Grass strip", "Shelter"], accessibility: ["Rough ground"], services: ["charter", "private", "helicopter"],
    source: { ref: "Game content (fictional)", reviewed: REVIEWED, confidence: "unverified" },
  },
];
export const AIRPORT_BY_ID = Object.fromEntries(AIRPORTS_GH.map((a) => [a.id, a]));
/** The main airport of a town (scheduled, charter or private), if it has one. */
export const airportOfCity = (city: string, kinds: AirportType[] = ["international", "domestic", "airstrip"]) => AIRPORTS_GH.find((a) => a.city === city && kinds.includes(a.type));

/** A scheduled passenger route between two airports. */
export interface Route {
  id: string;
  from: string;
  to: string;
  status: "operating" | "unverified" | "suspended";
  /** Real-world operators reported by the source (the game uses its own fictional carriers). */
  realOperators: string[];
  /** Fictional in-game carrier. */
  carrier: string;
  /** Game timetable: departure times (hour + minute/60) each day, both directions. */
  times: number[];
  source: Source;
}

const CITI_2026: Source = { ref: "CitiNewsroom, Sep 2026: 'Are domestic airfares really high in Ghana?'", url: "https://www.citinewsroom.com/2026/09/are-domestic-airfares-really-high-in-ghana/", reviewed: REVIEWED, confidence: "confirmed" };
export const ROUTES: Route[] = [
  { id: "acc-kms", from: "kotoka", to: "kumasi", status: "operating", realOperators: ["Africa World Airlines", "PassionAir"], carrier: "Akwaaba Air (game)", times: [6.5, 9.25, 12.5, 16.75, 19.5], source: CITI_2026 },
  { id: "acc-tml", from: "kotoka", to: "tamale", status: "operating", realOperators: ["Africa World Airlines", "PassionAir"], carrier: "Sahel Link (game)", times: [7, 12, 17.5], source: CITI_2026 },
  { id: "acc-tkd", from: "kotoka", to: "takoradi", status: "operating", realOperators: ["Africa World Airlines"], carrier: "Akwaaba Air (game)", times: [7.5, 17], source: { ...CITI_2026, confidence: "reported" } },
  { id: "acc-wza", from: "kotoka", to: "wa", status: "unverified", realOperators: ["PassionAir (announced, undated)"], carrier: "Sahel Link (game)", times: [], source: { ref: "Alternative Airlines: PassionAir route announcement (undated)", url: "https://www.alternativeairlines.com/passionair", reviewed: REVIEWED, confidence: "unverified" } },
  { id: "acc-nyi", from: "kotoka", to: "sunyani", status: "unverified", realOperators: ["PassionAir (announced, undated)"], carrier: "Sahel Link (game)", times: [], source: { ref: "Alternative Airlines: PassionAir route announcement (undated)", url: "https://www.alternativeairlines.com/passionair", reviewed: REVIEWED, confidence: "unverified" } },
  { id: "acc-hzo", from: "kotoka", to: "ho", status: "suspended", realOperators: ["PassionAir (suspended March 2022)"], carrier: "—", times: [], source: { ref: "Wikipedia: Ho Airport", url: "https://en.wikipedia.org/wiki/Ho_Airport", reviewed: REVIEWED, confidence: "reported" } },
  { id: "tml-wza", from: "tamale", to: "wa", status: "unverified", realOperators: ["Africa World Airlines (undated listing)"], carrier: "Sahel Link (game)", times: [], source: { ref: "Alternative Airlines: AWA listing (undated)", url: "https://www.alternativeairlines.com/africa-world-airlines", reviewed: REVIEWED, confidence: "unverified" } },
];
export const ROUTE_BY_ID = Object.fromEntries(ROUTES.map((r) => [r.id, r]));
/** Routes between two towns, in either direction. */
export function routesBetween(fromCity: string, toCity: string) {
  return ROUTES.filter((r) => {
    const a = AIRPORT_BY_ID[r.from], b = AIRPORT_BY_ID[r.to];
    return (a.city === fromCity && b.city === toCity) || (a.city === toCity && b.city === fromCity);
  });
}

// ---------------------------------------------------------------------------
// Distances and quotes (shared by the server and the screens).

import { haversineKm } from "./geo.ts";
import { TOWN_BY_ID } from "./ghana.ts";
import { toGameDate } from "./calendar.ts";

/** Flight time and distance between two landing places (great-circle at cruise speed, plus taxiing). */
export function flightLeg(fromId: string, toId: string, speedKmh = 420) {
  const a = AIRPORT_BY_ID[fromId], b = AIRPORT_BY_ID[toId];
  const km = Math.round(haversineKm(TOWN_BY_ID[a.city].at, TOWN_BY_ID[b.city].at)) || 12;
  return { km, minutes: Math.round((km / speedKmh) * 60) + 20 };
}
/** Game fare for a scheduled route, in GH₵. */
export const flightFare = (km: number) => Math.round(FLIGHT_RULES.fareBase + FLIGHT_RULES.farePerKm * km);
/** Fly in daylight only? */
export function daylightProblem(daylightOnly: boolean, depMin: number, minutes: number): string | null {
  if (!daylightOnly) return null;
  const g = toGameDate(depMin), h0 = g.hour + g.min / 60, h1 = h0 + minutes / 60;
  return h0 < 6 || h1 > 18 ? "That aircraft flies in daylight only (06:00–18:00)." : null;
}
export type CharterQuote = { km: number; minutes: number; wait: number; flying: number; positioning: number; landing: number; total: number };
/** A charter quote (game prices). Charter operators are based at Kotoka; positioning to you costs extra. */
export function charterQuoteOf(spec: AircraftSpec, fromId: string, toId: string, now: number): { ok: true; q: CharterQuote } | { ok: false; code: string; error: string } {
  const from = AIRPORT_BY_ID[fromId], to = AIRPORT_BY_ID[toId];
  if (!from || !to) return { ok: false, code: "bad_destination", error: "Choose where to fly." };
  if (!canUse(spec, to)) return { ok: false, code: "cant_land", error: `That aircraft can't use ${to.name}.` };
  if (fromId === toId) return { ok: false, code: "same_place", error: "You're already there." };
  const leg = flightLeg(fromId, toId, spec.speedKmh);
  if (leg.km > spec.rangeKm) return { ok: false, code: "range", error: `Too far for that aircraft (${spec.rangeKm} km range).` };
  const pos = fromId === "kotoka" ? { km: 0, minutes: 0 } : flightLeg("kotoka", fromId, spec.speedKmh);
  const wait = 45 + pos.minutes;
  const dl = daylightProblem(spec.daylightOnly, now + wait, leg.minutes);
  if (dl) return { ok: false, code: "daylight", error: dl };
  const flying = Math.max(spec.charterMin, Math.round(spec.charterPerKm * leg.km));
  const positioning = Math.round(spec.charterPerKm * 0.6 * pos.km);
  const landing = (from.type === "helipad" ? 0 : spec.landingFee) + spec.landingFee;
  return { ok: true, q: { km: leg.km, minutes: leg.minutes, wait, flying, positioning, landing, total: flying + positioning + landing } };
}
/** Refund for cancelling a booking yourself (minor units), by the game's rules. */
export function cancelRefund(b: { fare: number; bagFee: number; insurance: number; transfer: number; depMin: number; cancelled: boolean }, now: number) {
  const paid = b.fare + b.bagFee;
  const share = b.cancelled || b.insurance ? 1 : b.depMin - now >= FLIGHT_RULES.earlyHours * 60 ? FLIGHT_RULES.refundEarly : FLIGHT_RULES.refundLate;
  return Math.round(paid * share) + (b.cancelled ? b.insurance + b.transfer : b.transfer);
}

// ---------------------------------------------------------------------------
// Game rules for scheduled flights (fictional prices, in GH₵).

export const FLIGHT_RULES = {
  /** Game fare: base + per km. Not a real airline price. */
  fareBase: 520, farePerKm: 2.4,
  speedKmh: 420, taxiMinutes: 20,
  /** Cabin bag (7 kg) is included; a checked bag costs this. */
  checkedBag: 80,
  /** Optional travel insurance, as a share of the fare: full refund if you miss or cancel. */
  insuranceRate: 0.08,
  /** You can book up to this many days ahead, and up to this long before departure. */
  bookDaysAhead: 7, bookCutoffMin: 60,
  /** Online check-in opens 24 h before and closes 1 h before; the gate closes 15 min before take-off. */
  checkinOpenMin: 24 * 60, checkinCloseMin: 60, gateCloseMin: 15,
  /** Boarding opens 40 min before; arrive at the airport in time. */
  boardingOpenMin: 40,
  /** Cancelling yourself: refund share by notice (no insurance). */
  refundEarly: 0.9, refundLate: 0.5, earlyHours: 24,
  /** Missing the flight without insurance: only the airport charges come back. */
  refundMissed: 0.1,
  /** Change to a later flight on the same route. */
  changeFeeRate: 0.15,
  /** Baggage claim after landing. */
  baggageMinutes: 15,
};

/** Deterministic disruption for a departure: delay in minutes, or cancelled (game simulation). */
export function disruption(routeId: string, day: number, slot: number, stormy = false): { delay: number; cancelled: boolean; reason: string } {
  let h = 2166136261;
  for (const c of `${routeId}:${day}:${slot}`) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  const u = ((h >>> 0) % 10000) / 10000;
  if (u < (stormy ? 0.12 : 0.03)) return { delay: 0, cancelled: true, reason: stormy ? "Thunderstorms over the route" : "Aircraft technical check" };
  if (u < (stormy ? 0.45 : 0.18)) return { delay: 15 * (1 + Math.floor((u * 1000) % 6)), cancelled: false, reason: stormy ? "Weather" : u < 0.1 ? "Late inbound aircraft" : "Air traffic flow" };
  return { delay: 0, cancelled: false, reason: "" };
}

// ---------------------------------------------------------------------------
// Charters and private aircraft (game prices in GH₵; not real quotes).

export interface AircraftSpec {
  type: string;
  seats: number;
  cargoKg: number;
  rangeKm: number;
  /** Lowest runway class it can use (H = helipads too). */
  needs: RunwayClass[];
  speedKmh: number;
  /** Variable trip costs. */
  fuelPerKm: number;
  landingFee: number;
  /** Recurring weekly costs when you own one. */
  weekly: { crew: number; hangar: number; insurance: number; maintenance: number };
  crew: string;
  /** Charter: per km, plus repositioning if it's based elsewhere. */
  charterPerKm: number;
  charterMin: number;
  daylightOnly: boolean;
  noise: string;
}
export const AIRCRAFT_SPECS: Record<string, AircraftSpec> = {
  prop_plane: { type: "prop_plane", seats: 3, cargoKg: 150, rangeKm: 1100, needs: ["A", "B", "C"], speedKmh: 230, fuelPerKm: 6, landingFee: 250, weekly: { crew: 0, hangar: 1_800, insurance: 2_600, maintenance: 1_400 }, crew: "You fly it yourself with a private pilot licence, or hire a pilot (GH₵3,500/week).", charterPerKm: 16, charterMin: 4_500, daylightOnly: true, noise: "Quiet; any airport or airstrip." },
  helicopter: { type: "helicopter", seats: 3, cargoKg: 250, rangeKm: 550, needs: ["A", "B", "C", "H"], speedKmh: 220, fuelPerKm: 22, landingFee: 400, weekly: { crew: 7_000, hangar: 2_800, insurance: 9_500, maintenance: 6_000 }, crew: "One pilot (included in the weekly crew cost).", charterPerKm: 55, charterMin: 12_000, daylightOnly: true, noise: "Loud: helipads and airports only, never in neighbourhoods; daylight only." },
  turboprop: { type: "turboprop", seats: 8, cargoKg: 900, rangeKm: 2000, needs: ["A", "B"], speedKmh: 480, fuelPerKm: 26, landingFee: 900, weekly: { crew: 14_000, hangar: 4_500, insurance: 22_000, maintenance: 12_000 }, crew: "Two pilots (included in the weekly crew cost).", charterPerKm: 70, charterMin: 18_000, daylightOnly: false, noise: "Airports with a paved runway." },
  bizjet: { type: "bizjet", seats: 12, cargoKg: 1_200, rangeKm: 11_000, needs: ["A"], speedKmh: 820, fuelPerKm: 85, landingFee: 3_500, weekly: { crew: 38_000, hangar: 12_000, insurance: 120_000, maintenance: 45_000 }, crew: "Two pilots and a cabin attendant (included in the weekly crew cost).", charterPerKm: 210, charterMin: 60_000, daylightOnly: false, noise: "Major airports only (long runway)." },
};
export const weeklyCost = (s: AircraftSpec) => s.weekly.crew + s.weekly.hangar + s.weekly.insurance + s.weekly.maintenance;
/** Can this aircraft use that landing place? */
export const canUse = (s: AircraftSpec, a: Airport) => a.status !== "closed" && s.needs.includes(a.runway) && (a.type !== "helipad" || s.needs.includes("H")) && (a.services.includes("private") || a.services.includes("charter") || (a.type === "helipad" && s.needs.includes("H")));
/** Resale: what a broker offers, falling with age (game rule). */
export const aircraftResale = (price: number, ageDays: number) => Math.round(price * Math.max(0.45, 0.8 - ageDays * 0.0006));
