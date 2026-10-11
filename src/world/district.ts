// Builds a whole neighbourhood: roads, gutters, pavements, buildings with
// louvre windows and painted signs, poles and sagging wires, trees, stalls,
// the beach and the sea. Each district gets its own mood from shared data.
import * as THREE from "three";
import { Batcher, G, facadeBox, tiledPlane } from "./batch.ts";
import * as T from "./textures.ts";
import { DISTRICTS, PLACES, placesIn, type DistrictId, type Place } from "../../shared/world.ts";
import { mulberry32 } from "../../shared/rng.ts";
import { createOcean } from "./ocean.ts";
import type { Genre, SoundSpot } from "./audio.ts";

export const ROAD_HALF = 6;
export const WALK_IN = 6.8;
export const WALK_OUT = 10;
export const BUILD_LINE = 10.5;
export const CROSS_HALF = 5;
export const EXTENT_X = 100;
export const EXTENT_Z = 80;

export interface Collider {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  /** Height in metres (the camera only avoids things taller than itself). */
  h: number;
  /** Gutters block walking but can be jumped over. */
  kind?: "solid" | "gutter";
}

export interface Interactable {
  id: string;
  kind: "place" | "home" | "stop" | "plot";
  placeId?: string;
  pos: THREE.Vector3;
  radius: number;
  label: string;
}

export interface DistrictScene {
  id: DistrictId;
  group: THREE.Group;
  colliders: Collider[];
  interactables: Interactable[];
  night: { mat: THREE.MeshStandardMaterial; on: number; off: number }[];
  lampSpots: THREE.Vector3[];
  ocean: ReturnType<typeof createOcean> | null;
  sidewalks: { z: number; x0: number; x1: number }[];
  spawn: THREE.Vector3;
  homeDoor: THREE.Vector3;
  plotSpot: THREE.Vector3;
  roadName: (x: number, z: number) => string;
  trafficLight: { phase: () => "ew" | "ns"; mats: { ewGreen: THREE.MeshStandardMaterial; ewRed: THREE.MeshStandardMaterial; nsGreen: THREE.MeshStandardMaterial; nsRed: THREE.MeshStandardMaterial } };
  stalls: THREE.Vector3[];
  shoreZ: number | null;
  placeDoors: Map<string, THREE.Vector3>;
  homeLabel: THREE.Sprite;
  /** Where the noise comes from: markets and shop speakers. */
  soundSpots: SoundSpot[];
  dispose: () => void;
}


const SIGN_NAMES = [
  "GOD IS GOOD ENTERPRISE", "BLESSED TOUCH SALON", "NANA YAA PROVISIONS", "ADOM CHEMICAL SELLER", "JESUS IS LORD PHONES",
  "SANKOFA FASHION HOUSE", "OBAAPA CATERING", "AYEKOO AUTO PARTS", "EBENEZER BUILDING MATERIALS", "FAITH SPOT", "PRECIOUS HANDS TAILORING",
  "NYAME NTI ELECTRICALS", "OSAGYEFO PRINTING PRESS", "UNITY CONTAINER SHOP", "MAAME FOODS", "PSALM 23 BOUTIQUE", "SPECIAL FAVOUR CAR WASH",
  "AWURADE NE HENE HARDWARE", "NKABOM COLD STORE", "SALVATION FURNITURE WORKS", "DIVINE GRACE PHARMACY", "BLACK STAR PHOTO STUDIO",
  "TIP TOP BARBERING", "KAYA BOYS SPARE PARTS", "ODO NI SIKA BEAUTY", "ANOINTED FINGERS NAILS", "AKWAABA CHOP BAR", "GYE NYAME MOTORS",
];
const SIGN_COLORS: [string, string][] = [["#F2B705", "#1a1a1a"], ["#C8452C", "#ffffff"], ["#1F7A4D", "#ffffff"], ["#2E86AB", "#ffffff"], ["#ffffff", "#C8452C"], ["#111111", "#F2B705"], ["#E35D3A", "#fff6e0"], ["#3A2E6E", "#F2B705"]];

const HOME_SPOT: Record<DistrictId, { x: number; side: 1 | -1 }> = {
  kaneshie: { x: -60, side: 1 },
  osu: { x: -80, side: 1 },
  labadi: { x: -82, side: -1 },
  spintex: { x: -82, side: -1 },
  east_legon: { x: -84, side: 1 },
  trasacco: { x: -84, side: -1 },
};
const PLOT_SPOT: Record<DistrictId, { x: number; side: 1 | -1 }> = {
  kaneshie: { x: 82, side: -1 },
  osu: { x: 86, side: 1 },
  labadi: { x: 84, side: -1 },
  spintex: { x: 82, side: -1 },
  east_legon: { x: 84, side: -1 },
  trasacco: { x: 84, side: 1 },
};

// ---------------------------------------------------------------------------
// Materials

function std(params: THREE.MeshStandardMaterialParameters) {
  return new THREE.MeshStandardMaterial({ roughness: 0.85, metalness: 0, ...params });
}

/** A drooping palm frond: a strip with leaflets that curves down along its length. */
const FROND = (() => {
  const g = new THREE.PlaneGeometry(0.9, 1, 4, 8);
  g.translate(0, 0.5, 0);
  const pos = g.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const t = pos.getY(i); // 0..1 along the frond
    const across = pos.getX(i);
    const width = Math.sin(Math.PI * Math.min(1, t * 1.1)) * (1 - t * 0.4);
    pos.setX(i, across * width);
    pos.setZ(i, -t * t * 0.55 - Math.abs(across) * 0.25);
  }
  g.computeVertexNormals();
  return g;
})();

export function buildDistrict(id: DistrictId): DistrictScene {
  const d = DISTRICTS[id];
  const rnd = mulberry32(id.length * 977 + id.charCodeAt(0));
  const group = new THREE.Group();
  const batch = new Batcher();
  const colliders: Collider[] = [];
  const interactables: Interactable[] = [];
  const night: DistrictScene["night"] = [];
  const lampSpots: THREE.Vector3[] = [];
  const stalls: THREE.Vector3[] = [];
  const placeDoors = new Map<string, THREE.Vector3>();
  const soundSpots: SoundSpot[] = [];
  const music = (x: number, z: number, genre: Genre, loud = 1, hours: [number, number] = [8, 22]) => soundSpots.push({ id: `m${soundSpots.length}`, kind: "music", x, z, genre, loud, hours });
  const marketNoise = (x: number, z: number, loud = 1, hours: [number, number] = [5, 20]) => soundSpots.push({ id: `k${soundSpots.length}`, kind: "market", x, z, loud, hours });
  const disposables: { dispose(): void }[] = [];
  const coastal = d.style === "coastal";
  const upscale = d.style === "suburban" || d.style === "luxury";
  const shoreZ = coastal ? 40 : null;

  // Shared materials for this district.
  const M = {
    asphalt: std({ map: T.asphalt(), roughness: 0.92 }),
    earth: std({ map: upscale ? T.grass(d.style === "luxury") : T.laterite(), roughness: 1 }),
    pavers: std({ map: T.pavers(), roughness: 0.9 }),
    curb: std({ map: T.concrete("#d9d4c8", 3), roughness: 0.8 }),
    curbPaint: std({ color: "#f2c200", roughness: 0.7 }),
    gutter: std({ color: "#2a2724", roughness: 1 }),
    gutterWall: std({ map: T.concrete("#7d776d", 5), roughness: 1 }),
    concrete: std({ map: T.concrete("#b5aea3", 41) }),
    white: std({ color: "#f3f1ea", roughness: 0.6 }),
    yellowLine: std({ color: "#e8b923", roughness: 0.6 }),
    roofRust: std({ map: T.corrugated(true), roughness: 0.7, metalness: 0.4 }),
    roofClean: std({ map: T.corrugated(false), roughness: 0.45, metalness: 0.6 }),
    tank: std({ color: "#1c1c1e", roughness: 0.55 }),
    pole: std({ map: T.concrete("#9c968c", 7), roughness: 0.9 }),
    metal: std({ color: "#55595e", roughness: 0.5, metalness: 0.7 }),
    darkMetal: std({ color: "#2b2d30", roughness: 0.6, metalness: 0.5 }),
    shutter: std({ map: T.shutter(), roughness: 0.6, metalness: 0.5 }),
    trunk: std({ color: "#5b4636", roughness: 1 }),
    palmTrunk: std({ color: "#7b6a55", roughness: 1 }),
    leaf: std({ color: "#3f6f2a", roughness: 0.9, side: THREE.DoubleSide }),
    leaf2: std({ color: "#5a8a34", roughness: 0.9, side: THREE.DoubleSide }),
    palmLeaf: std({ color: "#4d7a2e", roughness: 0.85, side: THREE.DoubleSide }),
    wood: std({ color: "#8a5a3b", roughness: 0.9 }),
    plaster: std({ map: T.plaster(), color: "#efe9dc" }),
    glass: new THREE.MeshPhysicalMaterial({ color: "#2c3c48", roughness: 0.05, metalness: 0.3, clearcoat: 1 }),
    sand: std({ map: T.sand(), roughness: 1 }),
    wetSand: std({ map: T.sand(), color: "#b8a27a", roughness: 0.5 }),
    lush: std({ map: T.grass(true), roughness: 1 }),
    chairRed: std({ color: "#c8352c", roughness: 0.5 }),
    chairBlue: std({ color: "#2e6fae", roughness: 0.5 }),
    black: std({ color: "#121214", roughness: 0.7 }),
  };
  M.asphalt.map!.repeat.set(1, 1);
  const lampMat = std({ color: "#fff6dc", emissive: "#ffd79a", emissiveIntensity: 0 });
  night.push({ mat: lampMat, on: 3, off: 0 });

  const facadeMats = new Map<string, THREE.MeshStandardMaterial>();
  const facadeMat = (color: string, kind: "louvre" | "glass" | "modern") => {
    const k = `${color}:${kind}`;
    let m = facadeMats.get(k);
    if (!m) {
      const f = T.facade(kind);
      m = std({ color: kind === "glass" ? "#ffffff" : color, map: f.map, emissiveMap: f.emissive, emissive: "#ffffff", emissiveIntensity: 0, roughness: kind === "glass" ? 0.25 : 0.85, metalness: kind === "glass" ? 0.4 : 0 });
      facadeMats.set(k, m);
      night.push({ mat: m, on: kind === "glass" ? 1.1 : 0.9, off: 0 });
    }
    return m;
  };
  const colorMats = new Map<string, THREE.MeshStandardMaterial>();
  const colorMat = (c: string, rough = 0.8, metal = 0) => {
    const k = `${c}:${rough}:${metal}`;
    let m = colorMats.get(k);
    if (!m) {
      m = std({ color: c, roughness: rough, metalness: metal });
      colorMats.set(k, m);
    }
    return m;
  };
  const signMats = new Map<string, THREE.MeshStandardMaterial>();
  const signMat = (text: string, bg: string, fg: string, sub?: string) => {
    const k = `${text}:${bg}:${fg}:${sub}`;
    let m = signMats.get(k);
    if (!m) {
      const map = T.signboard(text, bg, fg, { sub });
      m = std({ map, roughness: 0.75, emissiveMap: map, emissive: "#ffffff", emissiveIntensity: 0 });
      signMats.set(k, m);
      night.push({ mat: m, on: 0.35, off: 0 });
    }
    return m;
  };

  const box = (m: THREE.Material, x: number, y: number, z: number, w: number, h: number, dd: number, ry = 0) => batch.add(G.box, m, [x, y, z], [0, ry, 0], [w, h, dd]);
  const collide = (x: number, z: number, w: number, dd: number, h = 2.5) => colliders.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - dd / 2, maxZ: z + dd / 2, h });

  // -------------------------------------------------------------------------
  // Ground, roads, gutters, pavements

  // On the coast the land stops at the waterline so the sea shows through.
  const gz0 = -EXTENT_Z - 20, gz1 = coastal ? ROAD_HALF + 4 : EXTENT_Z + 20;
  const ground = new THREE.Mesh(tiledPlane(EXTENT_X * 2 + 40, gz1 - gz0, upscale ? 6 : 8), M.earth);
  ground.rotation.x = -Math.PI / 2;
  ground.position.z = (gz0 + gz1) / 2;
  ground.receiveShadow = true;
  group.add(ground);

  const roadLen = EXTENT_X * 2 + 40;
  const road = new THREE.Mesh(tiledPlane(roadLen, ROAD_HALF * 2, 8), M.asphalt);
  road.rotation.x = -Math.PI / 2;
  road.position.y = 0.02;
  road.receiveShadow = true;
  group.add(road);
  const crossLen = coastal ? EXTENT_Z - 10 : EXTENT_Z * 2 + 40;
  const cross = new THREE.Mesh(tiledPlane(CROSS_HALF * 2, crossLen, 8), M.asphalt);
  cross.rotation.x = -Math.PI / 2;
  cross.position.set(0, 0.025, coastal ? -crossLen / 2 + ROAD_HALF : 0);
  cross.receiveShadow = true;
  group.add(cross);

  // Lane markings: double yellow centre, dashed white edges.
  for (const zz of [-0.12, 0.12]) box(M.yellowLine, 0, 0.035, zz, roadLen, 0.01, 0.1);
  for (let x = -EXTENT_X - 20; x < EXTENT_X + 20; x += 6) {
    if (Math.abs(x) < CROSS_HALF + 2) continue;
    for (const zz of [-ROAD_HALF + 0.4, ROAD_HALF - 0.4]) box(M.white, x, 0.035, zz, 3, 0.01, 0.12);
  }
  // Zebra crossings either side of the junction.
  for (const sx of [-1, 1]) for (let i = -5; i <= 5; i++) box(M.white, sx * (CROSS_HALF + 2.2), 0.036, i * 1.05, 2.6, 0.01, 0.55);
  for (const sz of coastal ? [-1] : [-1, 1]) for (let i = -4; i <= 4; i++) box(M.white, i * 1.05, 0.036, sz * (ROAD_HALF + 2.2 + 1.2), 0.55, 0.01, 2.6);

  // Open gutters, curbs and pavements along the main road.
  for (const side of [-1, 1] as const) {
    if (coastal && side === 1) {
      // Beach side: a low sea wall and promenade instead of shops.
      box(M.curb, 0, 0.12, side * (ROAD_HALF + 0.15), roadLen, 0.24, 0.3);
      batch.add(tiledPlane(roadLen, 3.2, 3), M.pavers, [0, 0.13, side * (ROAD_HALF + 1.9)], [-Math.PI / 2, 0, 0]);
      box(M.plaster, 0, 0.45, side * (ROAD_HALF + 3.6), roadLen, 0.9, 0.35);
      continue;
    }
    for (const half of [-1, 1]) {
      const x0 = half < 0 ? -EXTENT_X - 20 : CROSS_HALF + 0.8;
      const x1 = half < 0 ? -CROSS_HALF - 0.8 : EXTENT_X + 20;
      const len = x1 - x0, cx = (x0 + x1) / 2;
      box(M.curb, cx, 0.12, side * (ROAD_HALF + 0.12), len, 0.24, 0.24);
      // Black-and-yellow painted curb stones.
      for (let x = x0 + 0.5; x < x1; x += 2) box(M.curbPaint, x, 0.245, side * (ROAD_HALF + 0.12), 1, 0.01, 0.25);
      batch.add(G.plane, M.gutter, [cx, -0.55, side * (ROAD_HALF + 0.55)], [-Math.PI / 2, 0, 0], [len, 0.6, 1]);
      box(M.gutterWall, cx, -0.2, side * (ROAD_HALF + 0.24), len, 0.7, 0.04);
      box(M.gutterWall, cx, -0.2, side * (ROAD_HALF + 0.86), len, 0.75, 0.12);
      // Concrete slabs bridging the gutter; between them it's an open drain you jump across.
      const slabs: number[] = [];
      for (let x = x0 + 4; x < x1 - 2; x += 9 + rnd() * 8) {
        box(M.concrete, x, 0.15, side * (ROAD_HALF + 0.55), 1.6, 0.12, 0.85);
        slabs.push(x);
      }
      let gx = x0;
      for (const sx of [...slabs, x1 + 0.8]) {
        if (sx - 0.8 > gx) colliders.push({ minX: gx, maxX: sx - 0.8, minZ: Math.min(side * (ROAD_HALF + 0.25), side * (ROAD_HALF + 0.85)), maxZ: Math.max(side * (ROAD_HALF + 0.25), side * (ROAD_HALF + 0.85)), h: 0, kind: "gutter" });
        gx = sx + 0.8;
      }
      batch.add(tiledPlane(len, WALK_OUT - WALK_IN, 3), M.pavers, [cx, 0.16, side * ((WALK_IN + WALK_OUT) / 2)], [-Math.PI / 2, 0, 0]);
      box(M.curb, cx, 0.08, side * (WALK_OUT + 0.08), len, 0.16, 0.16);
    }
  }
  // Pavements on the cross street.
  for (const side of [-1, 1]) {
    for (const half of coastal ? [-1] : [-1, 1]) {
      const z0 = half < 0 ? -EXTENT_Z - 20 : WALK_OUT + 0.2;
      const z1 = half < 0 ? -WALK_OUT - 0.2 : EXTENT_Z + 20;
      const len = z1 - z0, cz = (z0 + z1) / 2;
      batch.add(tiledPlane(3, len, 3), M.pavers, [side * (CROSS_HALF + 1.6), 0.16, cz], [-Math.PI / 2, 0, 0]);
      box(M.curb, side * (CROSS_HALF + 0.1), 0.12, cz, 0.2, 0.24, len);
    }
  }

  // Traffic lights at the junction.
  const tl = {
    ewGreen: std({ color: "#0b3", emissive: "#2f2", emissiveIntensity: 0 }),
    ewRed: std({ color: "#600", emissive: "#f22", emissiveIntensity: 0 }),
    nsGreen: std({ color: "#0b3", emissive: "#2f2", emissiveIntensity: 0 }),
    nsRed: std({ color: "#600", emissive: "#f22", emissiveIntensity: 0 }),
  };
  for (const [sx, sz, axis] of [[1, -1, "ew"], [-1, 1, "ew"], [-1, -1, "ns"], [1, 1, "ns"]] as const) {
    if (coastal && sz === 1) continue;
    const px = sx * (CROSS_HALF + 0.9), pz = sz * (ROAD_HALF + 1.1);
    box(M.darkMetal, px, 2.2, pz, 0.14, 4.4, 0.14);
    box(M.black, px, 4.0, pz, 0.35, 0.9, 0.3);
    const g = axis === "ew" ? tl.ewGreen : tl.nsGreen, r = axis === "ew" ? tl.ewRed : tl.nsRed;
    batch.add(G.sphere, r, [px, 4.25, pz + (axis === "ns" ? -sz * 0.16 : 0) ], [0, 0, 0], [0.1, 0.1, 0.1]);
    batch.add(G.sphere, g, [px, 3.8, pz + (axis === "ns" ? -sz * 0.16 : 0)], [0, 0, 0], [0.1, 0.1, 0.1]);
    collide(px, pz, 0.3, 0.3);
  }
  const startMs = performance.now();
  const phase = () => (Math.floor((performance.now() - startMs) / 14000) % 2 === 0 ? "ew" : "ns");

  // -------------------------------------------------------------------------
  // Places

  const takenX: Record<string, [number, number][]> = { "-1": [], "1": [] };
  const reserve = (side: number, x0: number, x1: number) => takenX[String(side)].push([x0, x1]);
  const isFree = (side: number, x0: number, x1: number) => takenX[String(side)].every(([a, b]) => x1 < a - 1 || x0 > b + 1) && (x1 < -CROSS_HALF - 3.5 || x0 > CROSS_HALF + 3.5);

  const home = HOME_SPOT[id];
  const plot = PLOT_SPOT[id];
  reserve(home.side, home.x - 7, home.x + 7);
  reserve(plot.side, plot.x - 9, plot.x + 9);

  const labelSprite = (text: string, icon: string, y: number, x: number, z: number, bg = "rgba(20,18,30,0.8)") => {
    const tex = T.label(text, { icon, bg });
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: true, transparent: true }));
    const aspect = (tex.image as HTMLCanvasElement).width / (tex.image as HTMLCanvasElement).height;
    s.scale.set(0.65 * aspect, 0.65, 1);
    s.position.set(x, y, z);
    s.renderOrder = 10;
    group.add(s);
    disposables.push(s.material);
    return s;
  };

  const ICON: Record<string, string> = { food: "🍲", work: "💼", bank: "🏦", gym: "🏋🏾", clinic: "🩺", nightlife: "🎶", beach: "🏖️", market: "🧺", realtor: "🏘️", home: "🏠", church: "⛪", transport: "🚐", landmark: "⭐", shop: "✂️", school: "🎓", dealer: "🚙" };

  const placeOnBeach = (p: Place) => coastal && p.pos[1] >= 28;

  for (const p of placesIn(id)) {
    const [w, depth, h] = p.size;
    const x = p.pos[0];
    if (p.kind === "transport") {
      const side = p.pos[1] > 0 ? 1 : -1;
      const z = side * (WALK_IN + 1.6);
      // Shelter.
      box(M.metal, x - 1.8, 1.3, z + side * 0.9, 0.1, 2.6, 0.1);
      box(M.metal, x + 1.8, 1.3, z + side * 0.9, 0.1, 2.6, 0.1);
      box(M.roofClean, x, 2.65, z + side * 0.4, 4.2, 0.08, 1.9);
      box(signMat(p.sign, "#F2B705", "#111"), x, 2.85, z - side * 0.5, 3.6, 0.5, 0.06);
      box(M.wood, x, 0.5, z + side * 0.7, 3.2, 0.08, 0.45);
      collide(x, z + side * 0.85, 3.8, 0.9, 2.7);
      const ip = new THREE.Vector3(x, 0, z - side * 0.6);
      interactables.push({ id: p.id, kind: "stop", placeId: p.id, pos: ip, radius: 2.6, label: p.name });
      placeDoors.set(p.id, ip);
      labelSprite(p.name, ICON.transport, 3.6, x, z);
      reserve(side, x - 3, x + 3);
      continue;
    }
    let cx: number, cz: number, side: number;
    if (placeOnBeach(p)) {
      side = -1; // faces the road (−z) from the beach
      cx = x;
      cz = p.pos[1];
    } else {
      side = p.pos[1] > 0 ? 1 : -1;
      cx = x;
      cz = side * (BUILD_LINE + depth / 2);
      reserve(side, x - w / 2, x + w / 2);
    }
    const front = placeOnBeach(p) ? cz - depth / 2 : cz - side * (depth / 2);
    const faceDir = placeOnBeach(p) ? -1 : -side; // +z or −z direction the door faces
    buildPlace(p, cx, cz, w, depth, h, faceDir);
    const door = new THREE.Vector3(cx, 0, front + faceDir * 1.4);
    placeDoors.set(p.id, door);
    if (p.kind === "nightlife") music(cx, front, "afrobeats", 1.6, [p.open[0], p.open[1]]);
    else if (p.kind === "church") music(cx, front, "gospel", 1.1, [6, 21]);
    else if (p.kind === "food") music(cx, front, rnd() < 0.6 ? "highlife" : "gospel", 0.8, [p.open[0], p.open[1]]);
    else if (p.kind === "shop") music(cx, front, "afrobeats", 0.8, [p.open[0], p.open[1]]);
    else if (p.kind === "market") marketNoise(cx, front + faceDir * 2, 1.4, [p.open[0], p.open[1]]);
    interactables.push({ id: p.id, kind: "place", placeId: p.id, pos: door, radius: 2.4, label: p.name });
    labelSprite(p.name, ICON[p.kind] ?? "📍", Math.min(h, 9) + 1.4, cx, front + faceDir * 0.6);
  }

  function buildPlace(p: Place, cx: number, cz: number, w: number, depth: number, h: number, faceDir: number) {
    const front = cz + faceDir * (depth / 2);
    if (p.kind === "landmark" && p.id === "black_star_square") {
      // The arch and the star: original stylisation.
      const m = M.white;
      box(m, cx - 6, 5, cz, 3, 10, 3);
      box(m, cx + 6, 5, cz, 3, 10, 3);
      box(m, cx, 10.5, cz, 15, 2.2, 3.2);
      box(m, cx - 6, 1.5, cz - 4, 8, 3, 1);
      batch.add(tiledPlane(30, 22, 3), M.pavers, [cx, 0.17, cz], [-Math.PI / 2, 0, 0]);
      const star = new THREE.Shape();
      for (let i = 0; i < 10; i++) {
        const r = i % 2 ? 0.75 : 1.8, a = (i / 10) * Math.PI * 2 + Math.PI / 2;
        if (i === 0) star.moveTo(Math.cos(a) * r, Math.sin(a) * r);
        else star.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      const sg = new THREE.ExtrudeGeometry(star, { depth: 0.5, bevelEnabled: false });
      batch.add(sg, M.black, [cx, 13.6, cz + 0.25], [0, 0, 0]);
      collide(cx - 6, cz, 3, 3);
      collide(cx + 6, cz, 3, 3);
      return;
    }
    if (p.id === "osu_castle") {
      // Whitewashed fort: curtain walls with crenellations and corner bastions.
      const m = M.plaster;
      box(m, cx, h / 2, cz, w, h, depth);
      for (let i = -w / 2 + 0.6; i <= w / 2 - 0.6; i += 1.2) box(m, cx + i, h + 0.35, front + faceDir * 0.15, 0.6, 0.7, 0.4);
      for (const sx of [-1, 1]) {
        box(m, cx + sx * (w / 2), h * 0.62, front, 3.2, h * 1.24, 3.2);
        for (const dz of [-1, 1]) box(m, cx + sx * (w / 2) + dz * 1.2, h * 1.24 + 0.35, front, 0.6, 0.7, 0.6);
      }
      box(colorMat("#3a2a1f", 0.7), cx, 1.6, front + faceDir * 0.03, 2.4, 3.2, 0.1);
      batch.add(G.cyl8, M.darkMetal, [cx + w / 2 - 1, h + 3, cz], [0, 0, 0], [0.05, 6, 0.05]);
      batch.add(G.plane, colorMat("#C8452C", 0.8), [cx + w / 2 - 0.4, h + 5.4, cz], [0, 0, 0], [1.1, 0.4, 1]);
      batch.add(G.plane, colorMat("#F2B705", 0.8), [cx + w / 2 - 0.4, h + 5.0, cz], [0, 0, 0], [1.1, 0.4, 1]);
      batch.add(G.plane, colorMat("#1F7A4D", 0.8), [cx + w / 2 - 0.4, h + 4.6, cz], [0, 0, 0], [1.1, 0.4, 1]);
      box(signMat("OSU CASTLE", "#F4F1E6", "#3a2a1f", "FORT CHRISTIANSBORG • 1661"), cx, 3.9, front + faceDir * 0.06, 6, 1.1, 0.08);
      collide(cx, cz, w + 3, depth, h * 1.3);
      return;
    }
    if (p.kind === "beach") {
      box(M.wood, cx, 1.6, cz, 0.15, 3.2, 0.15);
      box(signMat(p.sign, "#0E7C86", "#fff"), cx, 3.1, cz, 3.4, 0.7, 0.08);
      // Lifeguard tower.
      for (const [dx, dz] of [[-0.8, -0.8], [0.8, -0.8], [-0.8, 0.8], [0.8, 0.8]]) box(M.wood, cx + 6 + dx, 1.2, cz + 2 + dz, 0.12, 2.4, 0.12);
      box(M.wood, cx + 6, 2.45, cz + 2, 2, 0.12, 2);
      collide(cx + 6, cz + 2, 2, 2, 3.5);
      collide(cx, cz, 0.4, 0.4, 3.2);
      box(colorMat("#C8452C"), cx + 6, 3.5, cz + 2, 2.1, 0.1, 2.1);
      return;
    }
    const style = d.style;
    if (p.district === "labadi" && (p.id === "sunset_shack" || p.id === "fish_landing")) {
      // Bamboo beach bar / fish landing: posts and a thatched roof.
      for (let i = 0; i < 4; i++) for (const s of [-1, 1]) box(M.wood, cx - w / 2 + (i * w) / 3, h / 2, cz + s * (depth / 2), 0.25, h, 0.25);
      batch.add(G.cone, colorMat("#b8955a", 1), [cx, h + 1.1, cz], [0, Math.PI / 4, 0], [w * 0.78, 2.4, depth * 0.78]);
      box(M.wood, cx, 1.1, front - faceDir * 1.2, w * 0.8, 1.1, 0.8);
      box(signMat(p.sign, p.color, "#1a1a1a"), cx, h - 0.2, front, w * 0.7, 0.8, 0.08);
      for (let i = 0; i < 8; i++) {
        const tx = cx + (rnd() - 0.5) * w * 1.6, tz = front + faceDir * (3 + rnd() * 5);
        plasticSet(tx, tz);
      }
      collide(cx, cz, w * 0.8, depth * 0.6, h);
      return;
    }
    if (p.id === "kaneshie_market") {
      // Multi-storey market block with arcades and stalls in front.
      const m = facadeMat(p.color, "louvre");
      batch.add(facadeBox(w, h, depth), m, [cx, h / 2, cz]);
      box(M.concrete, cx, h + 0.4, cz, w + 0.4, 0.8, depth + 0.4);
      box(signMat(p.sign, "#C8452C", "#fff"), cx, h - 1.2, front + faceDir * 0.05, w * 0.6, 1.4, 0.1);
      for (let i = 0; i < 6; i++) {
        const sx = cx - w / 2 + 3 + i * ((w - 6) / 5);
        stall(sx, front + faceDir * 3.4, true);
      }
      collide(cx, cz, w, depth, h);
      return;
    }
    // Generic place building, styled by district.
    const glassy = style === "corporate" || (style === "suburban" && h > 10) || (p.kind === "bank" && h > 12);
    const m = glassy ? facadeMat("#ffffff", "glass") : facadeMat(p.color, upscale ? "modern" : "louvre");
    batch.add(facadeBox(w, h, depth), m, [cx, h / 2, cz]);
    // Parapet / roof.
    if (style === "coastal" || (style === "market" && h < 5)) {
      roofPitched(cx, cz, w, depth, h, true);
    } else {
      parapet(cx, cz, w, depth, h);
      if (!glassy) tank(cx + w / 2 - 1.2, cz - depth / 4, h);
    }
    // Ground-floor frontage: glazed entrance, canopy, big sign.
    box(M.glass, cx, 1.4, front + faceDir * 0.02, Math.min(w - 1, 6), 2.6, 0.06);
    box(M.darkMetal, cx, 2.9, front + faceDir * 0.8, Math.min(w, 8), 0.15, 1.6);
    const signText = p.sign.split(" • ")[0];
    const sub = p.sign.includes(" • ") ? p.sign.split(" • ")[1] : undefined;
    const [bg, fg] = p.kind === "nightlife" ? ["#111111", "#F2B705"] : p.kind === "bank" ? ["#0E7C86", "#ffffff"] : p.kind === "clinic" ? ["#ffffff", "#1F7A4D"] : SIGN_COLORS[(signText.length * 7) % SIGN_COLORS.length];
    const sw = Math.min(w * 0.8, 9);
    const sh = Math.min(1.1, sw / 5.3);
    // Above the canopy; on single-storey shops it rises over the roofline like real Accra signboards.
    const signY = Math.max(3.05 + sh / 2, Math.min(h - 0.6, 3.75));
    box(signMat(signText, bg, fg, sub), cx, signY, front + faceDir * 0.07, sw, sh, 0.08);
    if (signY + sh / 2 > h) {
      box(M.darkMetal, cx - sw / 2 + 0.2, (h + signY) / 2, front + faceDir * 0.02, 0.08, signY - h + 0.4, 0.08);
      box(M.darkMetal, cx + sw / 2 - 0.2, (h + signY) / 2, front + faceDir * 0.02, 0.08, signY - h + 0.4, 0.08);
    }
    if (p.kind === "nightlife") {
      const neon = std({ color: "#ff3fa4", emissive: "#ff3fa4", emissiveIntensity: 0 });
      night.push({ mat: neon, on: 2.5, off: 0.2 });
      box(neon, cx, signY + sh / 2 + 0.12, front + faceDir * 0.1, sw, 0.08, 0.08);
      box(neon, cx, signY - sh / 2 - 0.12, front + faceDir * 0.1, sw, 0.08, 0.08);
    }
    if (p.kind === "food" || p.kind === "market") {
      plasticSet(cx - w / 2 + 1.5, front + faceDir * 2.6);
      plasticSet(cx + w / 2 - 1.5, front + faceDir * 2.6);
    }
    acUnits(cx, cz, w, depth, h, faceDir);
    collide(cx, cz, w, depth, h);
  }

  // -------------------------------------------------------------------------
  // Building parts

  function parapet(cx: number, cz: number, w: number, depth: number, h: number) {
    box(M.concrete, cx, h + 0.3, cz - depth / 2 + 0.1, w, 0.6, 0.2);
    box(M.concrete, cx, h + 0.3, cz + depth / 2 - 0.1, w, 0.6, 0.2);
    box(M.concrete, cx - w / 2 + 0.1, h + 0.3, cz, 0.2, 0.6, depth);
    box(M.concrete, cx + w / 2 - 0.1, h + 0.3, cz, 0.2, 0.6, depth);
    box(M.concrete, cx, h + 0.02, cz, w - 0.2, 0.04, depth - 0.2);
  }
  function roofPitched(cx: number, cz: number, w: number, depth: number, h: number, rusty: boolean) {
    const m = rusty ? M.roofRust : M.roofClean;
    const pitch = 0.32;
    const half = depth / 2 + 0.4;
    const slope = half / Math.cos(pitch);
    batch.add(tiledPlane(w + 0.8, slope, 3), m, [cx, h + Math.sin(pitch) * half * 0.5, cz - half / 2], [-Math.PI / 2 + pitch, 0, 0]);
    batch.add(tiledPlane(w + 0.8, slope, 3), m, [cx, h + Math.sin(pitch) * half * 0.5, cz + half / 2], [-Math.PI / 2 - pitch, 0, Math.PI]);
    batch.add(tiledPlane(w + 0.8, slope, 3), m, [cx, h + Math.sin(pitch) * half * 0.5 - 0.02, cz - half / 2], [Math.PI / 2 + pitch, 0, 0]);
    batch.add(tiledPlane(w + 0.8, slope, 3), m, [cx, h + Math.sin(pitch) * half * 0.5 - 0.02, cz + half / 2], [Math.PI / 2 - pitch, 0, Math.PI]);
    // Gable ends.
    const tri = new THREE.Shape([new THREE.Vector2(-depth / 2, 0), new THREE.Vector2(depth / 2, 0), new THREE.Vector2(0, Math.tan(pitch) * depth / 2)]);
    const tg = new THREE.ShapeGeometry(tri);
    batch.add(tg, M.plaster, [cx - w / 2, h, cz], [0, -Math.PI / 2, 0]);
    batch.add(tg, M.plaster, [cx + w / 2, h, cz], [0, Math.PI / 2, 0]);
  }
  function tank(x: number, z: number, h: number) {
    batch.add(G.cyl, M.tank, [x, h + 0.9, z], [0, 0, 0], [0.65, 1.5, 0.65]);
    box(M.metal, x, h + 0.1, z, 1.5, 0.2, 1.5);
  }
  function acUnits(cx: number, cz: number, w: number, depth: number, h: number, faceDir: number) {
    const storeys = Math.floor(h / 3);
    for (let s = 1; s < storeys; s++) {
      if (rnd() < 0.5) box(colorMat("#e8e8e4", 0.5), cx - w / 2 + 1 + rnd() * (w - 2), s * 3 + 0.6, cz + faceDir * (depth / 2 + 0.25), 0.8, 0.55, 0.45);
    }
  }
  function plasticSet(x: number, z: number) {
    collide(x, z + 0.2, 2.2, 1.9, 0.9);
    const m = rnd() < 0.5 ? M.chairRed : M.chairBlue;
    box(colorMat("#f3f1ea", 0.5), x, 0.72, z, 0.9, 0.05, 0.9);
    batch.add(G.cyl8, colorMat("#f3f1ea", 0.5), [x, 0.36, z], [0, 0, 0], [0.06, 0.72, 0.06]);
    for (const [dx, dz] of [[0.75, 0], [-0.75, 0], [0, 0.75]]) {
      box(m, x + dx, 0.42, z + dz, 0.42, 0.05, 0.42);
      box(m, x + dx * 1.25, 0.7, z + dz * 1.25, dx ? 0.05 : 0.42, 0.5, dx ? 0.42 : 0.05);
      for (const [lx, lz] of [[-0.18, -0.18], [0.18, -0.18], [-0.18, 0.18], [0.18, 0.18]]) box(m, x + dx + lx, 0.2, z + dz + lz, 0.04, 0.4, 0.04);
    }
  }
  function umbrella(x: number, z: number, h = 2.4, r = 1.4) {
    const cols = ["#C8452C", "#F2B705", "#1F7A4D", "#2E86AB", "#F7F3E8", "#E35D3A"];
    batch.add(G.cyl8, M.metal, [x, h / 2, z], [0, 0, 0], [0.03, h, 0.03]);
    batch.add(G.cone, colorMat(cols[Math.floor(rnd() * cols.length)], 0.8), [x, h + 0.25, z], [0, rnd() * 3, 0], [r, 0.5, r]);
  }
  function stall(x: number, z: number, withUmbrella: boolean) {
    box(M.wood, x, 0.8, z, 1.8, 0.08, 1.0);
    for (const [dx, dz] of [[-0.8, -0.4], [0.8, -0.4], [-0.8, 0.4], [0.8, 0.4]]) box(M.wood, x + dx, 0.4, z + dz, 0.07, 0.8, 0.07);
    const produce = ["#d6341f", "#f2a007", "#3c8d2f", "#e9d8a6", "#7a3b1d", "#f5e663"];
    for (let i = 0; i < 6; i++) {
      const c = produce[Math.floor(rnd() * produce.length)];
      batch.add(G.sphere, colorMat(c, 0.6), [x - 0.6 + (i % 3) * 0.6, 0.95, z - 0.2 + Math.floor(i / 3) * 0.4], [0, 0, 0], [0.24, 0.12, 0.17]);
    }
    if (withUmbrella) umbrella(x, z, 2.4, 1.5);
    stalls.push(new THREE.Vector3(x, 0, z + (z > 0 ? -1.1 : 1.1)));
    if (!soundSpots.some((sp) => sp.kind === "market" && Math.hypot(sp.x - x, sp.z - z) < 18)) marketNoise(x, z, 0.8);
    collide(x, z, 1.9, 1.1);
  }
  function kiosk(x: number, z: number, side: number) {
    const cols: [string, string, string][] = [["#F2C200", "MOMO • AIRTIME", "#111"], ["#C8452C", "PURE WATER • COLD", "#fff"], ["#2E86AB", "PHONE REPAIRS", "#fff"], ["#1F7A4D", "PROVISIONS", "#fff"]];
    const [c, text, fg] = cols[Math.floor(rnd() * cols.length)];
    const m = std({ map: T.corrugated(rnd() < 0.5), color: c, roughness: 0.6, metalness: 0.3 });
    box(m, x, 1.3, z, 2.4, 2.6, 2.4);
    box(M.darkMetal, x, 1.2, z - side * 1.21, 1.6, 1.4, 0.04);
    box(signMat(text.split(" • ")[0], c, fg, text.split(" • ")[1]), x, 2.85, z - side * 1.25, 2.4, 0.5, 0.06);
    box(M.roofClean, x, 2.65, z - side * 1.6, 2.6, 0.06, 1.2);
    collide(x, z, 2.5, 2.5);
  }
  function neem(x: number, z: number, scale = 1) {
    batch.add(G.cyl8, M.trunk, [x, 1.6 * scale, z], [0, 0, (rnd() - 0.5) * 0.15], [0.18 * scale, 3.2 * scale, 0.18 * scale]);
    for (let i = 0; i < 5; i++) {
      const a = rnd() * Math.PI * 2, r = rnd() * 1.4 * scale;
      batch.add(G.ico, rnd() < 0.5 ? M.leaf : M.leaf2, [x + Math.cos(a) * r, (3.6 + rnd() * 1.4) * scale, z + Math.sin(a) * r], [rnd(), rnd(), rnd()], [1.5 * scale, 1.2 * scale, 1.5 * scale]);
    }
    collide(x, z, 0.4, 0.4);
  }
  function palm(x: number, z: number, h = 7 + rnd() * 3) {
    const lean = (rnd() - 0.5) * 0.25, leanZ = (rnd() - 0.5) * 0.25;
    const segs = 6;
    let px = x, py = 0, pz = z;
    for (let i = 0; i < segs; i++) {
      const seg = h / segs;
      const nx = px + Math.sin(lean) * seg * (i / segs + 0.3), nz = pz + Math.sin(leanZ) * seg * (i / segs + 0.3), ny = py + seg;
      batch.add(G.cyl8, M.palmTrunk, [(px + nx) / 2, (py + ny) / 2, (pz + nz) / 2], [leanZ * (i / segs + 0.3), 0, -lean * (i / segs + 0.3)], [0.2 - i * 0.012, seg * 1.02, 0.2 - i * 0.012]);
      px = nx; py = ny; pz = nz;
    }
    batch.add(G.sphere, colorMat("#5a4a26", 0.9), [px, py - 0.1, pz], [0, 0, 0], [0.26, 0.3, 0.26]);
    const m = new THREE.Matrix4();
    for (let i = 0; i < 11; i++) {
      const a = (i / 11) * Math.PI * 2 + rnd() * 0.3;
      const len = 2.6 + rnd() * 1.2;
      const tilt = 0.9 + rnd() * 0.5;
      m.makeTranslation(px, py, pz)
        .multiply(new THREE.Matrix4().makeRotationY(a))
        .multiply(new THREE.Matrix4().makeRotationX(tilt))
        .multiply(new THREE.Matrix4().makeScale(1, len, 1));
      batch.addMatrix(FROND, i % 2 ? M.palmLeaf : M.leaf, m);
    }
    collide(x, z, 0.5, 0.5);
  }
  function compoundWall(x0: number, x1: number, z: number, h: number, gateX: number | null, color: string) {
    const m = colorMat(color, 0.85);
    const len = x1 - x0;
    if (gateX === null) {
      box(m, (x0 + x1) / 2, h / 2, z, len, h, 0.25);
    } else {
      const g0 = gateX - 1.8, g1 = gateX + 1.8;
      if (g0 > x0) box(m, (x0 + g0) / 2, h / 2, z, g0 - x0, h, 0.25);
      if (x1 > g1) box(m, (g1 + x1) / 2, h / 2, z, x1 - g1, h, 0.25);
      box(M.darkMetal, gateX, h / 2 - 0.1, z, 3.6, h - 0.2, 0.08);
      box(colorMat("#b08d57", 0.4, 0.6), gateX, h - 0.1, z, 3.8, 0.12, 0.12);
    }
    // Wall coping and the ubiquitous razor wire.
    box(M.concrete, (x0 + x1) / 2, h + 0.06, z, len, 0.12, 0.35);
    if (d.style !== "luxury") box(M.darkMetal, (x0 + x1) / 2, h + 0.35, z, len, 0.3, 0.05);
    colliders.push({ minX: x0, maxX: x1, minZ: z - 0.2, maxZ: z + 0.2, h: h + 0.4 });
  }
  function villa(cx: number, cz: number, w: number, depth: number, storeys: number, color: string, side: number) {
    const h = storeys * 3.2;
    batch.add(facadeBox(w, h, depth), facadeMat(color, "modern"), [cx, h / 2, cz]);
    // Hipped roof as a squashed pyramid.
    batch.add(new THREE.ConeGeometry(1, 1, 4), colorMat(d.palette.roofs[Math.floor(rnd() * d.palette.roofs.length)], 0.6), [cx, h + 1.1, cz], [0, Math.PI / 4, 0], [w * 0.78, 2.2, depth * 0.78]);
    box(M.white, cx, 3.2, cz - side * (depth / 2 + 1.2), w * 0.5, 0.2, 2.4); // balcony
    for (const s of [-1, 1]) box(M.white, cx + s * w * 0.22, 1.6, cz - side * (depth / 2 + 2.2), 0.3, 3.2, 0.3);
    collide(cx, cz, w, depth, h + 2);
  }
  function filler(x: number, side: number, w: number) {
    const depth = 8 + rnd() * 6;
    const style = d.style;
    if (upscale) {
      // Walled compound with a villa set back from the road.
      const wallZ = side * (BUILD_LINE + 0.4);
      compoundWall(x - w / 2, x + w / 2, wallZ, style === "luxury" ? 2.6 : 2.4, x + (rnd() - 0.5) * (w - 6), d.palette.walls[Math.floor(rnd() * d.palette.walls.length)]);
      compoundWall(x - w / 2, x - w / 2 + 0.25, side * (BUILD_LINE + 0.4 + 9), 2.4, null, "#e9e3d6");
      const vw = Math.min(w - 4, 10 + rnd() * 4);
      villa(x, side * (BUILD_LINE + 5 + 12 / 2), vw, 10, style === "luxury" ? 2 + Math.floor(rnd() * 2) : 2, d.palette.walls[Math.floor(rnd() * d.palette.walls.length)], side);
      if (rnd() < 0.7) palm(x + w / 2 - 2, side * (BUILD_LINE + 3));
      else neem(x - w / 2 + 2.5, side * (BUILD_LINE + 3.5), 0.9);
      if (style === "luxury") batch.add(tiledPlane(w - 1, 12, 6), M.lush, [x, 0.03, side * (BUILD_LINE + 6.5)], [-Math.PI / 2, 0, 0]);
      return;
    }
    const storeysByStyle = { urban: [1, 4], market: [1, 3], corporate: [2, 6], coastal: [1, 2], suburban: [2, 2], luxury: [2, 3] }[style];
    const storeys = storeysByStyle[0] + Math.floor(rnd() * (storeysByStyle[1] - storeysByStyle[0] + 1));
    const h = storeys * 3;
    const cz = side * (BUILD_LINE + depth / 2);
    const front = cz - side * (depth / 2);
    const glassy = style === "corporate" && storeys >= 4 && rnd() < 0.6;
    const warehouse = style === "corporate" && !glassy && rnd() < 0.35;
    const color = d.palette.walls[Math.floor(rnd() * d.palette.walls.length)];
    if (warehouse) {
      const wm = std({ map: T.corrugated(rnd() < 0.3), color: ["#c9ccd0", "#9fb3c2", "#d7c4a3"][Math.floor(rnd() * 3)], roughness: 0.55, metalness: 0.4 });
      batch.add(facadeBox(w - 0.6, 7, depth, 3), wm, [x, 3.5, cz]); // corrugated tiles are single
      roofPitched(x, cz, w - 0.6, depth, 7, false);
      box(M.shutter, x, 2.2, front - side * 0.03, Math.min(6, w - 2), 4.4, 0.06);
      collide(x, cz, w - 0.6, depth, 8);
      return;
    }
    batch.add(facadeBox(w - 0.6, h, depth), facadeMat(color, glassy ? "glass" : style === "corporate" ? "modern" : "louvre"), [x, h / 2, cz]);
    if (!glassy && (style === "coastal" || (storeys <= 2 && rnd() < 0.45))) roofPitched(x, cz, w - 0.6, depth, h, rnd() < 0.7);
    else {
      parapet(x, cz, w - 0.6, depth, h);
      if (!glassy) tank(x + (rnd() - 0.5) * (w - 3), cz + side * depth / 4, h);
      if (!glassy && rnd() < 0.3) box(M.concrete, x - w / 4, h + 1.2, cz, 0.15, 2.4, 0.15); // rebar column stubs: "still building"
    }
    // Shop front: roller shutters (half up), signboard and a little awning.
    if (!glassy && style !== "coastal" || rnd() < 0.5) {
      const units = w > 11 ? 2 : 1;
      for (let u = 0; u < units; u++) {
        const ux = x - (w - 0.6) / 2 + ((u + 0.5) * (w - 0.6)) / units;
        const uw = (w - 0.6) / units - 0.6;
        const open = rnd() < 0.7;
        if (open && rnd() < 0.3) music(ux, front, (["highlife", "gospel", "afrobeats", "afrobeats"] as Genre[])[Math.floor(rnd() * 4)], 0.7);
        box(open ? colorMat("#1a1714", 0.9) : M.shutter, ux, 1.25, front - side * 0.02, uw - 0.4, 2.5, 0.05);
        if (open) box(M.shutter, ux, 2.7, front - side * 0.03, uw - 0.4, 0.4, 0.06);
        const name = SIGN_NAMES[Math.floor(rnd() * SIGN_NAMES.length)];
        const [bg, fg] = SIGN_COLORS[Math.floor(rnd() * SIGN_COLORS.length)];
        box(signMat(name, bg, fg, `0${Math.floor(20 + rnd() * 39)} ${Math.floor(100 + rnd() * 899)} ${Math.floor(1000 + rnd() * 8999)}`), ux, 3.35, front - side * 0.06, uw, 0.8, 0.06);
        box(M.roofRust, ux, 2.95, front - side * 0.7, uw, 0.05, 1.3);
        if (open && rnd() < 0.5) plasticSet(ux + (rnd() - 0.5) * 2, front - side * 2.2);
      }
    }
    acUnits(x, cz, w - 0.6, depth, h, -side);
    collide(x, cz, w - 0.6, depth, h + 0.6);
  }

  // Fill the frontage with buildings.
  for (const side of [-1, 1]) {
    if (coastal && side === 1) continue;
    let x = -EXTENT_X + 2;
    while (x < EXTENT_X - 2) {
      const w = upscale ? 20 + rnd() * 8 : 8 + Math.floor(rnd() * 3) * 3 + 1;
      if (isFree(side, x, x + w)) {
        filler(x + w / 2, side, w);
        reserve(side, x, x + w);
        x += w + (rnd() < 0.2 ? 3 + rnd() * 4 : 0.2);
      } else x += 2;
    }
    // A second row behind for depth.
    for (let bx = -EXTENT_X + 6; bx < EXTENT_X - 6; bx += 14 + rnd() * 8) {
      if (Math.abs(bx) < CROSS_HALF + 8) continue;
      const h = upscale ? 6 + rnd() * 4 : 3 * (1 + Math.floor(rnd() * (d.style === "corporate" ? 5 : 3)));
      const w = 9 + rnd() * 6, dd = 9 + rnd() * 5;
      const z = side * (34 + rnd() * 10);
      batch.add(facadeBox(w, h, dd), facadeMat(d.palette.walls[Math.floor(rnd() * d.palette.walls.length)], d.style === "corporate" && h > 9 ? "glass" : upscale ? "modern" : "louvre"), [bx, h / 2, z]);
      if (h <= 6 && !upscale) roofPitched(bx, z, w, dd, h, true);
      else parapet(bx, z, w, dd, h);
      collide(bx, z, w, dd, h);
    }
  }

  // Home building at the reserved spot.
  const homeZ = home.side * (BUILD_LINE + 6);
  if (id !== "kaneshie") {
    if (upscale) {
      compoundWall(home.x - 7, home.x + 7, home.side * (BUILD_LINE + 0.4), 2.4, home.x, "#e9e3d6");
      villa(home.x, home.side * (BUILD_LINE + 9), 10, 9, 2, "#F2E2C4", home.side);
    } else {
      batch.add(facadeBox(12, 6, 10), facadeMat("#E8D5B5", "louvre"), [home.x, 3, homeZ]);
      roofPitched(home.x, homeZ, 12, 10, 6, false);
      box(colorMat("#5b3a29", 0.7), home.x, 1.2, homeZ - home.side * 5.02, 1.2, 2.4, 0.06);
      collide(home.x, homeZ, 12, 10, 8);
    }
  }
  const homeDoor = id === "kaneshie" ? placeDoors.get("tetteh_compound")!.clone() : new THREE.Vector3(home.x, 0, home.side * (BUILD_LINE - 1.2));
  interactables.push({ id: "home", kind: "home", pos: homeDoor, radius: 2.2, label: "Home" });
  const homeLabel = labelSprite("Your home", "🏠", 5.2, homeDoor.x, homeDoor.z + home.side * 1.5, "rgba(31,122,77,0.92)");
  homeLabel.visible = false;

  const plotSpot = new THREE.Vector3(plot.x, 0, plot.side * (BUILD_LINE + 9));
  interactables.push({ id: "plot", kind: "plot", pos: new THREE.Vector3(plot.x, 0, plot.side * (BUILD_LINE - 1.2)), radius: 3, label: "Plot for sale" });
  // Survey pegs and a sign: "THIS LAND IS NOT FOR SALE" is the Accra classic; ours says it IS for sale.
  box(M.wood, plot.x - 3, 1.2, plot.side * (BUILD_LINE + 0.5), 0.12, 2.4, 0.12);
  box(signMat("LAND FOR SALE", "#ffffff", "#C8452C", "BOATENG REALTY"), plot.x - 3, 2.3, plot.side * (BUILD_LINE + 0.45), 2.6, 0.9, 0.06);
  collide(plot.x - 3, plot.side * (BUILD_LINE + 0.5), 0.4, 0.4, 2.5);

  // -------------------------------------------------------------------------
  // Street furniture: poles with sagging wires, lamps, trees, kiosks, stalls.

  const poleXs: number[] = [];
  for (let x = -EXTENT_X + 4; x < EXTENT_X; x += 22) if (Math.abs(x) > CROSS_HALF + 3) poleXs.push(x);
  const nearDoor = (x: number, side: number) => [...placeDoors.values()].some((p) => Math.sign(p.z) === side && Math.abs(p.x - x) < 3.2);
  const wirePts: number[] = [];
  for (const side of [-1, 1]) {
    if (coastal && side === 1) continue;
    const pz = side * (WALK_OUT - 0.5);
    let prev: number | null = null;
    for (const x0 of poleXs) {
      const x = nearDoor(x0, side) ? x0 + 4.5 : x0;
      batch.add(G.cyl8, M.pole, [x, 4.5, pz], [0, 0, 0], [0.16, 9, 0.16]);
      box(M.wood, x, 8.4, pz, 0.12, 0.12, 1.8);
      for (const off of [-0.7, 0, 0.7]) batch.add(G.cyl8, colorMat("#d9d4c8", 0.4), [x, 8.55, pz + off], [0, 0, 0], [0.05, 0.18, 0.05]);
      // Street lamp arm reaching over the road.
      box(M.darkMetal, x, 7.4, pz - side * 1.4, 0.08, 0.08, 2.8);
      box(lampMat, x, 7.32, pz - side * 2.75, 0.35, 0.08, 0.6);
      collide(x, pz, 0.35, 0.35);
      if (prev !== null) {
        for (const off of [-0.7, 0, 0.7]) {
          const N = 10;
          for (let i = 0; i < N; i++) {
            const t0 = i / N, t1 = (i + 1) / N;
            const sag = (t: number) => 8.62 - Math.sin(t * Math.PI) * 0.75;
            wirePts.push(prev + (x - prev) * t0, sag(t0), pz + off, prev + (x - prev) * t1, sag(t1), pz + off);
          }
        }
      }
      prev = x;
      lampSpots.push(new THREE.Vector3(x, 7.1, pz - side * 2.75));
    }
  }
  const wires = new THREE.LineSegments(new THREE.BufferGeometry().setAttribute("position", new THREE.Float32BufferAttribute(wirePts, 3)), new THREE.LineBasicMaterial({ color: "#151515" }));
  group.add(wires);
  disposables.push(wires.geometry, wires.material);

  // Trees, kiosks and stalls along the pavements.
  for (const side of [-1, 1]) {
    if (coastal && side === 1) continue;
    for (let x = -EXTENT_X + 10; x < EXTENT_X - 6; x += 9 + rnd() * 10) {
      if (Math.abs(x) < CROSS_HALF + 4) continue;
      if (poleXs.some((px) => Math.abs(px - x) < 2.5) || nearDoor(x, side)) continue;
      const z = side * (WALK_OUT - 1.1);
      const r = rnd();
      if (r < 0.28) (d.style === "coastal" || d.style === "luxury" || (d.style === "urban" && rnd() < 0.5) ? palm : neem)(x, z, 1);
      else if (r < 0.42 && !upscale) kiosk(x, z - side * -0.2, side);
      else if (r < 0.62 && (d.style === "market" || d.style === "urban" || d.style === "coastal")) stall(x, side * (WALK_IN + 1.1), rnd() < 0.7);
    }
  }

  // -------------------------------------------------------------------------
  // Beach and sea (Labadi)

  let ocean: DistrictScene["ocean"] = null;
  if (coastal) {
    const sandDepth = shoreZ! + 1 - (ROAD_HALF + 3.8);
    const sandMesh = new THREE.Mesh(tiledPlane(EXTENT_X * 2 + 40, sandDepth, 10), M.sand);
    sandMesh.rotation.x = -Math.PI / 2;
    sandMesh.position.set(0, 0.04, ROAD_HALF + 3.8 + sandDepth / 2);
    sandMesh.receiveShadow = true;
    group.add(sandMesh);
    const wet = new THREE.Mesh(tiledPlane(EXTENT_X * 2 + 40, 6, 10), M.wetSand);
    wet.rotation.x = -Math.PI / 2;
    wet.position.set(0, 0.045, shoreZ! - 2);
    group.add(wet);
    ocean = createOcean(shoreZ!);
    group.add(ocean.mesh);
    disposables.push(ocean);
    for (let x = -EXTENT_X; x < EXTENT_X; x += 7 + rnd() * 9) {
      if (rnd() < 0.55) palm(x, ROAD_HALF + 6 + rnd() * 6);
      if (rnd() < 0.35) umbrella(x + 2, 22 + rnd() * 14, 2.3, 1.6);
    }
    // Painted fishing canoes pulled up on the sand.
    for (let i = 0; i < 7; i++) {
      const x = 30 + i * 4.2 + rnd(), z = 31 + rnd() * 3;
      const cols = ["#C8452C", "#F2B705", "#1F7A4D", "#2E86AB"];
      const c1 = colorMat(cols[i % 4], 0.6), c2 = colorMat(cols[(i + 1) % 4], 0.6);
      batch.add(G.box, c1, [x, 0.45, z], [0, 0.2, 0], [1.3, 0.7, 8]);
      batch.add(G.box, c2, [x, 0.7, z], [0, 0.2, 0], [1.34, 0.18, 8.05]);
      batch.add(G.cone, c1, [x + Math.sin(0.2) * 4.6, 0.45, z + Math.cos(0.2) * 4.6], [Math.PI / 2, 0, 0], [0.65, 1.4, 0.35]);
      batch.add(G.cyl8, M.wood, [x, 2, z - 3], [0, 0, 0], [0.04, 3, 0.04]);
      batch.add(G.plane, colorMat(cols[(i + 2) % 4], 0.7), [x + 0.45, 3.2, z - 3], [0, Math.PI / 2, 0], [0.9, 0.55, 1]);
      colliders.push({ minX: x - 0.8, maxX: x + 0.8, minZ: z - 4, maxZ: z + 4, h: 1 });
    }
    // Drum circle: stools in a ring.
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      batch.add(G.cyl, colorMat("#6b3f2a", 0.7), [16 + Math.cos(a) * 2.2, 0.4, 28 + Math.sin(a) * 2.2], [0, 0, 0], [0.3, 0.8, 0.3]);
      collide(16 + Math.cos(a) * 2.2, 28 + Math.sin(a) * 2.2, 0.6, 0.6, 0.8);
    }
  }
  if (d.style === "luxury") {
    // Golf course behind the clubhouse.
    const golf = new THREE.Mesh(tiledPlane(80, 40, 6), M.lush);
    golf.rotation.x = -Math.PI / 2;
    golf.position.set(40, 0.035, 50);
    golf.receiveShadow = true;
    group.add(golf);
    for (const [fx, fz] of [[20, 45], [52, 58], [66, 40]]) {
      batch.add(G.cyl8, M.white, [fx, 1.2, fz], [0, 0, 0], [0.03, 2.4, 0.03]);
      batch.add(G.plane, colorMat("#C8452C", 0.7), [fx + 0.3, 2.2, fz], [0, 0, 0], [0.6, 0.4, 1]);
    }
    for (let x = -EXTENT_X + 6; x < EXTENT_X; x += 12) palm(x, -(WALK_OUT - 1.4), 9);
  }

  const statics = batch.build();
  group.add(statics);
  disposables.push(...statics.children.map((c) => (c as THREE.Mesh).geometry));

  // Bounds: invisible walls at the edge of the playable area.
  colliders.push({ minX: -EXTENT_X - 30, maxX: -EXTENT_X + 1, minZ: -EXTENT_Z - 30, maxZ: EXTENT_Z + 30, h: 0 });
  colliders.push({ minX: EXTENT_X - 1, maxX: EXTENT_X + 30, minZ: -EXTENT_Z - 30, maxZ: EXTENT_Z + 30, h: 0 });
  colliders.push({ minX: -EXTENT_X - 30, maxX: EXTENT_X + 30, minZ: -EXTENT_Z - 30, maxZ: -EXTENT_Z + 1, h: 0 });
  colliders.push({ minX: -EXTENT_X - 30, maxX: EXTENT_X + 30, minZ: coastal ? shoreZ! + 3 : EXTENT_Z - 1, maxZ: EXTENT_Z + 60, h: 0 });

  const spawnStop = PLACES.find((p) => p.district === id && p.kind === "transport");
  const spawn = spawnStop ? placeDoors.get(spawnStop.id)!.clone() : new THREE.Vector3(-58, 0, 8);

  const { main: mainRoad, cross: crossRoad } = d.roads;
  return {
    id,
    group,
    colliders,
    interactables,
    night,
    lampSpots,
    ocean,
    sidewalks: [
      { z: -(WALK_IN + WALK_OUT) / 2, x0: -EXTENT_X + 4, x1: EXTENT_X - 4 },
      ...(coastal ? [{ z: ROAD_HALF + 1.9, x0: -EXTENT_X + 4, x1: EXTENT_X - 4 }] : [{ z: (WALK_IN + WALK_OUT) / 2, x0: -EXTENT_X + 4, x1: EXTENT_X - 4 }]),
    ],
    spawn,
    homeDoor,
    plotSpot,
    roadName: (x, z) => (Math.abs(x) < CROSS_HALF + 4 && Math.abs(z) > ROAD_HALF + 4 ? crossRoad : coastal && z > 14 ? "Labadi Beach" : mainRoad),
    trafficLight: { phase, mats: tl },
    stalls,
    shoreZ,
    placeDoors,
    homeLabel,
    soundSpots,
    dispose: () => {
      group.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.geometry) m.geometry.dispose();
      });
      for (const x of disposables) x.dispose();
      for (const n of night) n.mat.dispose();
    },
  };
}
