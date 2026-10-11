// Pull real streets and building footprints for each district from
// OpenStreetMap (© OpenStreetMap contributors, ODbL) and save them as compact
// local-metre JSON in public/osm/<district>.json for the 3D builder.
//
// Needs network access to overpass-api.de. Run:  node scripts/import-osm.mjs [district ...]
import { writeFileSync, mkdirSync } from "node:fs";

const DISTRICTS = {
  osu: { lat: 5.5566, lon: -0.1826, bearing: 10 },
  labadi: { lat: 5.56, lon: -0.148, bearing: 70 },
  kaneshie: { lat: 5.568, lon: -0.235, bearing: 75 },
  spintex: { lat: 5.633, lon: -0.115, bearing: 80 },
  east_legon: { lat: 5.635, lon: -0.161, bearing: 90 },
  trasacco: { lat: 5.664, lon: -0.136, bearing: 90 },
};
const HALF_M = 220; // import a 440 m square around each district centre
const ENDPOINT = process.env.OVERPASS_URL ?? "https://overpass-api.de/api/interpreter";

function toLocal(lat, lon, o) {
  const x0 = (lon - o.lon) * 111320 * Math.cos((o.lat * Math.PI) / 180);
  const n0 = (lat - o.lat) * 110570;
  // Rotate so the district's main road lies along the scene's +x axis (scene z = south).
  const b = (o.bearing * Math.PI) / 180;
  const east = x0, north = n0;
  const x = east * Math.sin(b) + north * Math.cos(b);
  const zNorth = -east * Math.cos(b) + north * Math.sin(b);
  return [Math.round(x * 10) / 10, Math.round(-zNorth * 10) / 10];
}

async function importDistrict(id) {
  const o = DISTRICTS[id];
  const dLat = HALF_M / 110570, dLon = HALF_M / (111320 * Math.cos((o.lat * Math.PI) / 180));
  const bbox = `${o.lat - dLat},${o.lon - dLon},${o.lat + dLat},${o.lon + dLon}`;
  const q = `[out:json][timeout:60];(way["highway"](${bbox});way["building"](${bbox}););out geom tags;`;
  const res = await fetch(ENDPOINT, { method: "POST", body: "data=" + encodeURIComponent(q), headers: { "content-type": "application/x-www-form-urlencoded" } });
  if (!res.ok) throw new Error(`${id}: Overpass HTTP ${res.status}`);
  const json = await res.json();
  const roads = [], buildings = [];
  for (const el of json.elements) {
    if (!el.geometry) continue;
    const pts = el.geometry.map((g) => toLocal(g.lat, g.lon, o));
    if (el.tags?.highway) roads.push({ name: el.tags.name ?? null, kind: el.tags.highway, lanes: Number(el.tags.lanes) || null, pts });
    else if (el.tags?.building) buildings.push({ levels: Number(el.tags["building:levels"]) || null, kind: el.tags.building, name: el.tags.name ?? null, pts });
  }
  mkdirSync("public/osm", { recursive: true });
  writeFileSync(`public/osm/${id}.json`, JSON.stringify({ id, origin: o, attribution: "© OpenStreetMap contributors (ODbL)", roads, buildings }));
  console.log(`${id}: ${roads.length} roads, ${buildings.length} buildings`);
}

const ids = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(DISTRICTS);
for (const id of ids) await importDistrict(id);
