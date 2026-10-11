// Real-world geography helpers. All places carry WGS84 coordinates so
// distances, fares and the city map match the real country.

export interface LatLon {
  lat: number;
  lon: number;
}

const R = 6371; // km

export function haversineKm(a: LatLon, b: LatLon): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

/** Equirectangular projection to km around an origin: x east, y north. Good enough at city scale. */
export function projectKm(p: LatLon, origin: LatLon): { x: number; y: number } {
  const kx = 111.32 * Math.cos((origin.lat * Math.PI) / 180);
  return { x: (p.lon - origin.lon) * kx, y: (p.lat - origin.lat) * 110.57 };
}

/** Accra roads are rarely straight: a detour factor turns crow-flies km into road km. */
export const ROAD_FACTOR = 1.3;
