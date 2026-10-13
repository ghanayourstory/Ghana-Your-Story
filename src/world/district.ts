// Builds a whole neighbourhood: roads, gutters, pavements, buildings with
// louvre windows and painted signs, poles and sagging wires, trees, stalls,
// the beach and the sea. Each district gets its own mood from shared data.
import * as THREE from "three";
import { Batcher, G, facadeBox, tiledPlane } from "./batch.ts";
import * as T from "./textures.ts";
import { DISTRICTS, PLACES, placesIn, type DistrictId, type DistrictStyle, type Place } from "../../shared/world.ts";
import { mulberry32 } from "../../shared/rng.ts";
import type { HomeTier } from "../../shared/homes.ts";
import { createOcean } from "./ocean.ts";
import { buildAircraft, buildVehicle } from "./vehicles.ts";
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
  trafficLight: { phase: () => "ew" | "ns"; amber: () => boolean; mats: Record<"ewGreen" | "ewAmber" | "ewRed" | "nsGreen" | "nsAmber" | "nsRed", THREE.MeshStandardMaterial> };
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

const HOME_SPOT: Record<string, { x: number; side: 1 | -1 }> = {
  kaneshie: { x: -60, side: 1 },
  osu: { x: -80, side: 1 },
  labadi: { x: -82, side: -1 },
  spintex: { x: -82, side: -1 },
  east_legon: { x: -84, side: 1 },
  trasacco: { x: -84, side: -1 },
};
const PLOT_SPOT: Record<string, { x: number; side: 1 | -1 }> = {
  kaneshie: { x: 82, side: -1 },
  osu: { x: 86, side: 1 },
  labadi: { x: 84, side: -1 },
  spintex: { x: 82, side: -1 },
  east_legon: { x: 84, side: -1 },
  trasacco: { x: 84, side: 1 },
};
/**
 * Regional towns: shared/regional.ts lays places out from x −76 (side −1) and
 * x −54 (side +1) eastwards, with the lorry stop at x −62, so the home goes at
 * the far west end and the plot at the far east end of the street.
 */
const homeSpotFor = (id: DistrictId, coastal: boolean) => HOME_SPOT[id] ?? { x: -84, side: coastal ? -1 : 1 };
const plotSpotFor = (id: DistrictId) => PLOT_SPOT[id] ?? { x: 86, side: -1 };

/** Bright paint the middle-belt towns love: lime, sky blue, salmon, MoMo yellow. */
const TOWN_PAINT = ["#E6C34A", "#3FA7A0", "#D96C4A", "#8DBF6A", "#5E8FC9", "#E79AA5", "#F2EEE4", "#C9B48F", "#9FD0C7", "#E9A23B"];
/** Fictional phone brands for shop banners. */
const PHONE_BRANDS: [string, string, string, string][] = [["LUMO", "#E4007C", "#ffffff", "SMARTPHONES"], ["ZIPCELL", "#00A3E0", "#ffffff", "4G • 5G READY"], ["NOVA-K", "#111111", "#7CFC00", "BIG BATTERY"], ["SIKAFONE", "#FFD400", "#111111", "CASH IN • CASH OUT"], ["ORBI", "#6A2CBF", "#ffffff", "CAMERA PHONES"]];

/** A square frustum (tapering pillar) of unit base and height, centred at the origin. */
const TAPER = (() => {
  const g = new THREE.CylinderGeometry(0.55 / Math.SQRT2, 1 / Math.SQRT2, 1, 4, 1);
  g.rotateY(Math.PI / 4);
  g.computeVertexNormals();
  return g;
})();
/** Conical roof with UVs running down the slope (for thatch). */
const HUT_ROOF = new THREE.ConeGeometry(1, 1, 18, 1, true);
/** Hipped roof (square pyramid, rotated to the walls). */
const HIP = new THREE.ConeGeometry(1, 1, 4);
/** Baobab trunk: fat, barely tapering. */
const BAOBAB_TRUNK = new THREE.CylinderGeometry(0.62, 1, 1, 12);

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

export function buildDistrict(id: DistrictId, homeTier?: HomeTier): DistrictScene {
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
  const savanna = d.style === "savanna";
  const town = d.style === "town";
  /** Towns from shared/regional.ts (anything without hand-placed Accra spots). */
  const regional = !(id in HOME_SPOT);
  const shoreZ = coastal ? 40 : null;

  // Shared materials for this district.
  const M = {
    asphalt: std({ map: T.asphalt(savanna), roughness: 0.92 }),
    earth: std({ map: upscale ? T.grass(d.style === "luxury") : savanna ? T.laterite("ochre") : town ? T.laterite("forest") : T.laterite(), roughness: 1 }),
    pavers: std({ map: T.pavers(), roughness: 0.9 }),
    // Pavements: savanna and middle-belt towns walk on packed earth, not pavers.
    walk: savanna ? std({ map: T.laterite("path"), color: "#e8d2b0", roughness: 1 }) : town ? std({ map: T.laterite("path"), color: "#d9a58a", roughness: 1 }) : std({ map: T.pavers(), roughness: 0.9 }),
    dust: std({ map: T.laterite(savanna ? "ochre" : "forest"), color: savanna ? "#f0dcc0" : "#e0b8a0", roughness: 1 }),
    paint: std({ color: savanna ? "#cfc5ad" : "#f3f1ea", roughness: 0.8 }),
    thatch: std({ map: T.thatch(), roughness: 1, side: THREE.DoubleSide }),
    mat: std({ map: T.mat(), roughness: 1, side: THREE.DoubleSide }),
    blocks: std({ map: T.blocks(), roughness: 1 }),
    rebar: std({ color: "#5a3a2a", roughness: 0.7, metalness: 0.5 }),
    toron: std({ color: "#4a3423", roughness: 1 }),
    dryGrass: std({ color: "#c9ae6a", roughness: 1 }),
    calabash: std({ color: "#c9a24a", roughness: 0.6 }),
    baobab: std({ map: T.concrete("#8f8273", 161), roughness: 1 }),
    darkLeaf: std({ color: "#3f7d2b", roughness: 0.9, flatShading: true }),
    savLeaf: std({ color: "#5f7a35", roughness: 0.9 }),
    plantainLeaf: std({ color: "#6f9e3c", roughness: 0.8, side: THREE.DoubleSide }),
    curb: std({ map: T.concrete("#d9d4c8", 3), roughness: 0.8 }),
    curbWhite: std({ map: T.concrete("#f1efe9", 5), roughness: 0.75 }),
    curbPaint: std({ color: "#17181a", roughness: 0.7 }),
    gutter: std({ color: "#2a2724", roughness: 1 }),
    drainWater: std({ color: "#3b3a2a", roughness: 0.15, metalness: 0.2, transparent: true, opacity: 0.92 }),
    algae: std({ color: "#3e4a2a", roughness: 1 }),
    silt: std({ color: "#4a4032", roughness: 1 }),
    sachet: std({ color: "#e8eef0", roughness: 0.3, transparent: true, opacity: 0.85 }),
    bottleBlue: std({ color: "#5a8fb8", roughness: 0.2, transparent: true, opacity: 0.8 }),
    bottleGreen: std({ color: "#3a7a4a", roughness: 0.2, transparent: true, opacity: 0.8 }),
    bottleClear: std({ color: "#dfe8ea", roughness: 0.1, transparent: true, opacity: 0.7 }),
    blackBag: std({ color: "#141414", roughness: 0.4 }),
    signalYellow: std({ color: "#f2c200", roughness: 0.6 }),
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
    leaf: std({ color: "#55a133", roughness: 0.9, side: THREE.DoubleSide, flatShading: true }),
    leaf2: std({ color: "#78bb3e", roughness: 0.9, side: THREE.DoubleSide, flatShading: true }),
    palmLeaf: std({ color: "#62a334", roughness: 0.85, side: THREE.DoubleSide, flatShading: true }),
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
  night.push({ mat: lampMat, on: savanna ? 1.9 : 3, off: 0 });
  /** Night-glow multiplier: the north is darker after sunset, fewer lit windows and signs. */
  const glow = savanna ? 0.55 : town ? 0.8 : 1;

  const facadeMats = new Map<string, THREE.MeshStandardMaterial>();
  const facadeMat = (color: string, kind: "louvre" | "glass" | "modern" | "small") => {
    const k = `${color}:${kind}`;
    let m = facadeMats.get(k);
    if (!m) {
      const f = T.facade(kind);
      m = std({ color: kind === "glass" ? "#ffffff" : color, map: f.map, emissiveMap: f.emissive, emissive: "#ffffff", emissiveIntensity: 0, roughness: kind === "glass" ? 0.25 : 0.85, metalness: kind === "glass" ? 0.4 : 0 });
      facadeMats.set(k, m);
      night.push({ mat: m, on: (kind === "glass" ? 1.1 : 0.9) * glow, off: 0 });
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
      night.push({ mat: m, on: 0.35 * glow, off: 0 });
    }
    return m;
  };

  const mudMats = new Map<string, THREE.MeshStandardMaterial>();
  /** Smooth mud / cement render in a given wash colour. */
  const mudMat = (c: string) => {
    let m = mudMats.get(c);
    if (!m) {
      m = std({ map: T.render(), color: c, roughness: 0.95 });
      mudMats.set(c, m);
    }
    return m;
  };
  const shade = (c: string, k: number) => "#" + new THREE.Color(c).multiplyScalar(k).getHexString();
  const pick = <V,>(a: V[]) => a[Math.floor(rnd() * a.length)];
  const wallColor = () => (town && rnd() < 0.6 ? pick(TOWN_PAINT) : pick(d.palette.walls));

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
  // (Faded and patchy up north.)
  if (savanna) {
    for (let x = -EXTENT_X - 20; x < EXTENT_X + 20; x += 7) if (rnd() < 0.75) box(M.paint, x + 1.5, 0.035, 0, 3.2, 0.01, 0.12);
  } else {
    for (const zz of [-0.12, 0.12]) box(M.yellowLine, 0, 0.035, zz, roadLen, 0.01, 0.1);
    for (let x = -EXTENT_X - 20; x < EXTENT_X + 20; x += 6) {
      if (Math.abs(x) < CROSS_HALF + 2) continue;
      for (const zz of [-ROAD_HALF + 0.4, ROAD_HALF - 0.4]) box(M.paint, x, 0.035, zz, 3, 0.01, 0.12);
    }
  }
  // Zebra crossings either side of the junction.
  for (const sx of [-1, 1]) for (let i = -5; i <= 5; i++) box(M.paint, sx * (CROSS_HALF + 2.2), 0.036, i * 1.05, 2.6, 0.01, 0.55);
  for (const sz of coastal ? [-1] : [-1, 1]) for (let i = -4; i <= 4; i++) box(M.paint, i * 1.05, 0.036, sz * (ROAD_HALF + 2.2 + 1.2), 0.55, 0.01, 2.6);
  if (savanna || town) {
    // Earth blown and washed over the tarmac edges, in uneven drifts.
    for (const sz of [-1, 1]) {
      if (coastal && sz === 1) continue;
      for (let x = -EXTENT_X - 16; x < EXTENT_X + 16; x += 5 + rnd() * 7) {
        if (Math.abs(x) < CROSS_HALF + 3) continue;
        const len = 4 + rnd() * 9, wd = 0.5 + rnd() * (savanna ? 1.4 : 0.7);
        batch.add(tiledPlane(len, wd, 4), M.dust, [x, 0.03, sz * (ROAD_HALF - wd / 2 + 0.05)], [-Math.PI / 2, 0, 0]);
      }
    }
  }

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
      box(savanna ? M.curb : M.curbWhite, cx, 0.12, side * (ROAD_HALF + 0.12), len, 0.24, 0.24);
      // Black-and-white painted kerb stones, painted over the top and the road face.
      if (!savanna) for (let x = x0 + 0.5; x < x1; x += 2) box(M.curbPaint, x, 0.122, side * (ROAD_HALF + 0.12), 1, 0.248, 0.252);
      // A real Accra open drain: rough concrete U-channel, murky water, silt,
      // algae stains along the waterline and the inevitable sachets and bottles.
      const gz = side * (ROAD_HALF + 0.55);
      batch.add(G.plane, M.gutter, [cx, -0.72, gz], [-Math.PI / 2, 0, 0], [len, 0.62, 1]);
      box(M.gutterWall, cx, -0.28, side * (ROAD_HALF + 0.22), len, 0.9, 0.06);
      box(M.gutterWall, cx, -0.28, side * (ROAD_HALF + 0.88), len, 0.95, 0.12);
      box(M.algae, cx, -0.52, side * (ROAD_HALF + 0.255), len, 0.18, 0.012);
      box(M.algae, cx, -0.52, side * (ROAD_HALF + 0.82), len, 0.18, 0.012);
      batch.add(G.plane, M.drainWater, [cx, -0.6, gz], [-Math.PI / 2, 0, 0], [len, 0.6, 1]);
      for (let x = x0 + 1; x < x1 - 1; x += 0.8 + rnd() * 2.4) {
        const r = rnd();
        const lz = gz + (rnd() - 0.5) * 0.4;
        if (r < 0.45) batch.add(G.box, M.sachet, [x, -0.58, lz], [0, rnd() * 3, 0.1], [0.16, 0.03, 0.1]); // "pure water" sachet
        else if (r < 0.65) batch.add(G.cyl8, [M.bottleBlue, M.bottleGreen, M.bottleClear][Math.floor(rnd() * 3)], [x, -0.57, lz], [0, 0, Math.PI / 2], [0.04, 0.24, 0.04]);
        else if (r < 0.8) batch.add(G.ico, M.silt, [x, -0.63, lz], [0, 0, 0], [0.2 + rnd() * 0.3, 0.06, 0.18]);
        else if (r < 0.88) batch.add(G.box, M.blackBag, [x, -0.55, lz], [0, rnd() * 3, 0], [0.28, 0.12, 0.2]);
      }
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
      batch.add(tiledPlane(len, WALK_OUT - WALK_IN, 3), M.walk, [cx, 0.16, side * ((WALK_IN + WALK_OUT) / 2)], [-Math.PI / 2, 0, 0]);
      box(M.curb, cx, 0.08, side * (WALK_OUT + 0.08), len, 0.16, 0.16);
    }
  }
  // Pavements on the cross street.
  for (const side of [-1, 1]) {
    for (const half of coastal ? [-1] : [-1, 1]) {
      const z0 = half < 0 ? -EXTENT_Z - 20 : WALK_OUT + 0.2;
      const z1 = half < 0 ? -WALK_OUT - 0.2 : EXTENT_Z + 20;
      const len = z1 - z0, cz = (z0 + z1) / 2;
      batch.add(tiledPlane(3, len, 3), M.walk, [side * (CROSS_HALF + 1.6), 0.16, cz], [-Math.PI / 2, 0, 0]);
      box(savanna ? M.curb : M.curbWhite, side * (CROSS_HALF + 0.1), 0.12, cz, 0.2, 0.24, len);
      if (!savanna) for (let z = z0 + 0.5; z < z1; z += 2) box(M.curbPaint, side * (CROSS_HALF + 0.1), 0.122, z, 0.21, 0.248, 1);
    }
  }

  // Traffic lights at the junction: galvanised poles with three-aspect heads
  // (red, amber, green) in black housings with visors and a yellow-bordered backplate.
  const tl = {
    ewGreen: std({ color: "#063", emissive: "#2f5", emissiveIntensity: 0 }),
    ewAmber: std({ color: "#530", emissive: "#fa2", emissiveIntensity: 0 }),
    ewRed: std({ color: "#500", emissive: "#f22", emissiveIntensity: 0 }),
    nsGreen: std({ color: "#063", emissive: "#2f5", emissiveIntensity: 0 }),
    nsAmber: std({ color: "#530", emissive: "#fa2", emissiveIntensity: 0 }),
    nsRed: std({ color: "#500", emissive: "#f22", emissiveIntensity: 0 }),
  };
  for (const [sx, sz, axis] of [[1, -1, "ew"], [-1, 1, "ew"], [-1, -1, "ns"], [1, 1, "ns"]] as const) {
    if (coastal && sz === 1) continue;
    const px = sx * (CROSS_HALF + 0.9), pz = sz * (ROAD_HALF + 1.1);
    box(M.metal, px, 2.3, pz, 0.12, 4.6, 0.12);
    box(M.signalYellow, px, 0.35, pz, 0.14, 0.7, 0.14); // painted base
    // Facing: ew heads face along x (towards approaching ew traffic); ns heads face along z.
    const fx = axis === "ew" ? -sx : 0, fz = axis === "ns" ? -sz : 0;
    const hx = px + fx * 0.22, hz = pz + fz * 0.22;
    const [hw, hd] = axis === "ew" ? [0.3, 0.36] : [0.36, 0.3];
    box(M.black, hx, 4.0, hz, hw, 1.05, hd);
    box(M.signalYellow, hx - fx * 0.05, 4.0, hz - fz * 0.05, axis === "ew" ? 0.03 : 0.62, 1.3, axis === "ew" ? 0.62 : 0.03);
    box(M.black, hx - fx * 0.06, 4.0, hz - fz * 0.06, axis === "ew" ? 0.035 : 0.54, 1.22, axis === "ew" ? 0.54 : 0.035);
    const g = axis === "ew" ? tl.ewGreen : tl.nsGreen, a = axis === "ew" ? tl.ewAmber : tl.nsAmber, r = axis === "ew" ? tl.ewRed : tl.nsRed;
    for (const [y, m] of [[4.33, r], [4.0, a], [3.67, g]] as const) {
      batch.add(G.cyl, m, [hx + fx * 0.16, y, hz + fz * 0.16], axis === "ew" ? [0, 0, Math.PI / 2] : [Math.PI / 2, 0, 0], [0.1, 0.03, 0.1]);
      // Visor (hood) over each lamp.
      box(M.black, hx + fx * 0.26, y + 0.12, hz + fz * 0.26, axis === "ew" ? 0.2 : 0.26, 0.03, axis === "ew" ? 0.26 : 0.2);
    }
    collide(px, pz, 0.3, 0.3);
  }
  const startMs = performance.now();
  const CYCLE = 14000, AMBER = 2500;
  const phase = () => (Math.floor((performance.now() - startMs) / CYCLE) % 2 === 0 ? "ew" : "ns");
  const amber = () => (performance.now() - startMs) % CYCLE > CYCLE - AMBER;

  // -------------------------------------------------------------------------
  // Places

  const takenX: Record<string, [number, number][]> = { "-1": [], "1": [] };
  const reserve = (side: number, x0: number, x1: number) => takenX[String(side)].push([x0, x1]);
  const isFree = (side: number, x0: number, x1: number) => takenX[String(side)].every(([a, b]) => x1 < a - 1 || x0 > b + 1) && (x1 < -CROSS_HALF - 3.5 || x0 > CROSS_HALF + 3.5);

  const home = homeSpotFor(id, coastal);
  const plot = plotSpotFor(id);
  reserve(home.side, home.x - 7, home.x + 7);
  reserve(plot.side, plot.x - 9, plot.x + 9);

  const labelSprite = (text: string, icon: string, y: number, x: number, z: number, bg?: string) => {
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

  const ICON: Record<string, string> = { food: "🍲", work: "💼", bank: "🏦", gym: "🏋🏾", clinic: "🩺", nightlife: "🎶", beach: "🏖️", market: "🧺", realtor: "🏘️", home: "🏠", church: "⛪", transport: "🚐", landmark: "⭐", shop: "✂️", school: "🎓", dealer: "🚙", mosque: "🕌", lodge: "🛏️", tour: "🧭", furniture: "🛋️", phone: "📱", mall: "🛍️" , shrine: "🏺", airport: "✈️", hangar: "🛩️" };

  const placeOnBeach = (p: Place) => coastal && p.pos[1] >= 28;

  // Regional towns are laid out automatically, which can drop a building onto
  // the cross street. Re-pack each side of the street in the same order,
  // jumping the junction and stopping short of the plot for sale.
  const packed = new Map<string, { x: number; w: number }>();
  if (regional) {
    const JX = CROSS_HALF + 4;
    for (const sd of [-1, 1]) {
      const row = placesIn(id).filter((p) => p.kind !== "transport" && !placeOnBeach(p) && Math.sign(p.pos[1]) === sd).sort((a, b) => a.pos[0] - b.pos[0]);
      if (!row.length) continue;
      const limit = sd === plot.side ? plot.x - 10 : sd === home.side && home.x > 0 ? home.x - 8 : EXTENT_X - 6;
      const start = Math.max(row[0].pos[0] - row[0].size[0] / 2, sd === home.side && home.x < 0 ? home.x + 8 : -EXTENT_X + 4);
      // Leave room for the lorry station (and its yard) on this side too.
      const stations = placesIn(id).filter((p) => p.kind === "transport" && Math.sign(p.pos[1]) === sd).map((p) => p.pos[0]);
      const pack = (scale: number, gap: number) => {
        const out: [string, number, number][] = [];
        let cur = start;
        for (const p of row) {
          const w = Math.max(6, Math.round(p.size[0] * scale));
          if (cur < JX && cur + w > -JX) cur = JX;
          for (const sx of stations) if (cur < sx + 7.5 && cur + w > sx - 7.5) cur = Math.max(cur, sx + 7.5);
          out.push([p.id, cur + w / 2, w]);
          cur += w + gap;
        }
        return { out, end: cur - gap };
      };
      let r = pack(1, 2.5);
      for (let k = 0; r.end > limit && k < 12; k++) r = pack(1 - k * 0.04, k > 3 ? 1.2 : 2);
      for (const [pid, px, pw] of r.out) packed.set(pid, { x: px, w: pw });
    }
  }

  for (const p of placesIn(id)) {
    const pk = packed.get(p.id);
    const [, depth, h] = p.size;
    const w = pk?.w ?? p.size[0];
    const x = pk?.x ?? p.pos[0];
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
      const big = /lorry|station|park/i.test(p.name) && !savanna && !(coastal && side > 0);
      if (big && isFree(side, x - 7, x + 7)) { lorryPark(p, x, side); reserve(side, x - 7, x + 7); }
      else reserve(side, x - 3, x + 3);
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
    else if (p.kind === "shop" || p.kind === "phone") music(cx, front, "afrobeats", 0.8, [p.open[0], p.open[1]]);
    else if (p.kind === "mall") music(cx, front, "afrobeats", 0.6, [p.open[0], p.open[1]]);
    else if (p.kind === "furniture" || p.kind === "lodge" || p.kind === "tour") music(cx, front, rnd() < 0.5 ? "highlife" : "gospel", 0.55, [p.open[0], Math.min(p.open[1], 21)]);
    else if (p.kind === "market") marketNoise(cx, front + faceDir * 2, 1.4, [p.open[0], p.open[1]]);
    // Mosques: no loudspeaker music. The street's own bustle carries over.
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
    if (p.id === "jamestown_lighthouse") return lighthouse(p, cx, cz, w, depth, faceDir);
    if (p.id === "market_circle") return marketCircle(p, cx, cz, w, depth, faceDir);
    if (p.id === "jackson_park") return townPark(p, cx, cz, w, depth, faceDir);
    if (p.id === "sunyani_cenotaph") return cenotaph(p, cx, cz, w, depth, faceDir);
    if (p.id === "nima_pitch") return pitch(p, cx, cz, w, depth, faceDir);
    if (p.kind === "church") return church(p, cx, cz, w, depth, h, faceDir);
    if (p.id === "bonwire_palace") return asantePalace(p, cx, cz, w, depth, faceDir);
    if (p.id === "osu_castle" || p.id === "cape_castle_place" || p.id === "james_fort" || p.id === "elmina_castle_place") {
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
      const [castleName, castleSub] = p.id === "osu_castle" ? ["OSU CASTLE", "FORT CHRISTIANSBORG • 1661"] : p.id === "james_fort" ? ["JAMES FORT", "BUILT 1673"] : p.id === "elmina_castle_place" ? ["ST GEORGE'S CASTLE", "ELMINA • 1482"] : ["CAPE COAST CASTLE", "WORLD HERITAGE SITE • 1653"];
      box(signMat(castleName, "#F4F1E6", "#3a2a1f", castleSub), cx, 3.9, front + faceDir * 0.06, 6, 1.1, 0.08);
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
    if (p.id === "kejetia_market") return kejetia(p, cx, cz, w, depth, h, faceDir);
    if (p.id === "manhyia") return manhyiaPalace(p, cx, cz, w, depth, h, faceDir);
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
    if (p.kind === "mosque") {
      if (savanna) sudanoSahelian(p, cx, cz, w, depth, h, faceDir, true);
      else modernMosque(p, cx, cz, w, depth, h, faceDir);
      return;
    }
    if (p.kind === "landmark" && savanna) {
      // Palaces and cultural centres of the north: mud, buttresses and toron.
      sudanoSahelian(p, cx, cz, w, depth, Math.min(h, 8), faceDir, false);
      return;
    }
    if (p.kind === "mall") return mallBuilding(p, cx, cz, w, depth, h, faceDir);
    if (p.kind === "phone") return phoneShop(p, cx, cz, w, depth, h, faceDir);
    if (p.kind === "furniture") return furnitureWorks(p, cx, cz, w, depth, h, faceDir);
    if (p.kind === "lodge") return guesthouse(p, cx, cz, w, depth, h, faceDir);
    if (p.kind === "tour") return tourDesk(p, cx, cz, w, depth, h, faceDir);
    if (p.kind === "market" && (savanna || town)) return openMarket(p, cx, cz, w, depth, faceDir);
    // Generic place building, styled by district.
    const glassy = style === "corporate" || (style === "suburban" && h > 10) || (p.kind === "bank" && h > 12);
    const m = glassy ? facadeMat("#ffffff", "glass") : facadeMat(p.color, upscale ? "modern" : savanna ? "small" : "louvre");
    batch.add(facadeBox(w, h, depth), m, [cx, h / 2, cz]);
    if (!glassy && !savanna) relief(upscale ? "modern" : "louvre", cx, cz, w, h, depth, faceDir);
    // Parapet / roof.
    if (savanna && !glassy) {
      mudParapet(cx, cz, w, depth, h, p.color);
      box(mudMat(shade(p.color, 0.7)), cx, 0.45, front + faceDir * 0.03, w + 0.04, 0.9, 0.04);
    } else if (style === "coastal" || (style === "market" && h < 5) || (town && h <= 7.5)) {
      roofPitched(cx, cz, w, depth, h, true, town ? 0.28 : 0.32, town ? facadeMat(p.color, "louvre") : M.plaster);
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
    if (!savanna) acUnits(cx, cz, w, depth, h, faceDir);
    else if (rnd() < 0.5) motorbike(cx + w / 2 - 1.2, front + faceDir * 1.3, 0.2);
    collide(cx, cz, w, depth, h + (town && h <= 7.5 ? 1.6 : 0));
  }

  // -------------------------------------------------------------------------
  // Building parts

  /**
   * A church: a gabled nave running back from the street, a bell tower over the
   * entrance with a pyramid cap and a cross, tall arched windows down the sides
   * and steps up to double doors.
   */
  function church(p: Place, cx: number, cz: number, w: number, depth: number, h: number, faceDir: number) {
    const front = cz + faceDir * (depth / 2);
    const nw = Math.min(w - 2, 10), wh = Math.min(Math.max(h * 0.6, 5), 7), pitchH = nw * 0.36;
    const wall = colorMat(p.color, 0.8), trim = M.white;
    const roofM = colorMat(["#8a3b26", "#2f5d8a", "#5a6b3a", "#7a2e2e"][Math.floor(rnd() * 4)], 0.6, 0.3);
    box(wall, cx, wh / 2, cz, nw, wh, depth);
    // Gable roof as a prism, ridge running back from the street.
    const tri = new THREE.Shape([new THREE.Vector2(-nw / 2 - 0.5, 0), new THREE.Vector2(nw / 2 + 0.5, 0), new THREE.Vector2(0, pitchH)]);
    const prism = new THREE.ExtrudeGeometry(tri, { depth: depth + 0.8, bevelEnabled: false });
    prism.translate(0, 0, -(depth + 0.8) / 2);
    batch.add(prism, roofM, [cx, wh, cz]);
    const gable = new THREE.ShapeGeometry(new THREE.Shape([new THREE.Vector2(-nw / 2, 0), new THREE.Vector2(nw / 2, 0), new THREE.Vector2(0, pitchH - 0.3)]));
    batch.add(gable, wall, [cx, wh, front + faceDir * 0.02], [0, faceDir > 0 ? 0 : Math.PI, 0]);
    // Tall arched windows down both sides.
    for (let z = -depth / 2 + 2; z <= depth / 2 - 2; z += 2.6) for (const sx of [-1, 1]) {
      box(colorMat("#2f4a63", 0.3, 0.2), cx + sx * (nw / 2 + 0.02), wh * 0.5, cz + z, 0.06, wh * 0.5, 0.9);
      batch.add(G.cyl, colorMat("#2f4a63", 0.3, 0.2), [cx + sx * (nw / 2 + 0.02), wh * 0.75, cz + z], [0, 0, Math.PI / 2], [0.45, 0.06, 0.45]);
      box(trim, cx + sx * (nw / 2 + 0.06), wh * 0.25 - 0.05, cz + z, 0.1, 0.08, 1.1);
    }
    // Bell tower over the entrance.
    const tw = 2.8, th = wh + pitchH + 4, tz = front - faceDir * 1.2;
    box(wall, cx, th / 2, tz, tw, th, tw);
    box(trim, cx, th - 1.6, tz, tw + 0.15, 0.15, tw + 0.15);
    for (const [dx, dz] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) box(colorMat("#2a241f", 0.9), cx + dx * (tw / 2 + 0.01), th - 0.8, tz + dz * (tw / 2 + 0.01), dx ? 0.05 : 0.9, 1.1, dz ? 0.05 : 0.9);
    batch.add(new THREE.ConeGeometry(1, 1, 4), roofM, [cx, th + 1.2, tz], [0, Math.PI / 4, 0], [tw * 0.78, 2.4, tw * 0.78]);
    box(M.white, cx, th + 3.1, tz, 0.12, 1.4, 0.12);
    box(M.white, cx, th + 3.3, tz, 0.7, 0.12, 0.12);
    // Doors, a round window above, steps.
    box(colorMat("#5a3420", 0.7), cx, 1.3, front + faceDir * 0.02 + faceDir * 0.18, 1.8, 2.6, 0.06);
    batch.add(G.cyl, colorMat("#2f4a63", 0.3, 0.2), [cx, 3.6, front + faceDir * 0.22], [Math.PI / 2, 0, 0], [0.55, 0.05, 0.55]);
    for (let i = 0; i < 3; i++) box(M.concrete, cx, 0.1 + i * 0.12, front + faceDir * (1.0 - i * 0.3), 4 - i * 0.6, 0.12, 1.2 - i * 0.3);
    box(signMat(p.sign ?? p.name.toUpperCase(), "#F4F1E6", "#2f4a63"), cx + nw / 2 + 1.6, 1.4, front + faceDir * 0.4, 2.6, 0.9, 0.06);
    box(M.metal, cx + nw / 2 + 1.6, 0.5, front + faceDir * 0.4, 0.08, 1.0, 0.08);
    collide(cx, cz, nw, depth, wh + pitchH);
  }

  /**
   * An Asante chief's palace: a compound behind red-ochre and white walls with
   * adinkra-style relief panels, a shaded audience pavilion, and the chief's
   * great umbrella.
   */
  function asantePalace(p: Place, cx: number, cz: number, w: number, depth: number, faceDir: number) {
    const front = cz + faceDir * (depth / 2);
    const ochre = colorMat("#9a4a2a", 0.9), white = colorMat("#f2ece0", 0.85), black = colorMat("#1d1a17", 0.8);
    batch.add(tiledPlane(w, depth, 3), std({ map: T.laterite(), roughness: 1 }), [cx, 0.04, cz], [-Math.PI / 2, 0, 0]);
    // Walls: ochre lower band, white above, relief panels on the street side.
    for (const [x, z, ww, dd] of [[cx - w / 4 - 0.8, front, w / 2 - 1.6, 0.35], [cx + w / 4 + 0.8, front, w / 2 - 1.6, 0.35], [cx, cz - faceDir * (depth / 2), w, 0.35], [cx - w / 2, cz, 0.35, depth], [cx + w / 2, cz, 0.35, depth]] as const) {
      box(ochre, x, 0.6, z, ww, 1.2, dd);
      box(white, x, 1.75, z, ww, 1.1, dd);
      collide(x, z, ww, dd, 2.3);
    }
    for (const sx of [-1, 1]) for (let i = 0; i < 2; i++) {
      const px = cx + sx * (2.4 + i * 2.2);
      // Relief panel: concentric diamonds, white on black.
      const fz = front + faceDir * 0.19, ry = faceDir > 0 ? 0 : Math.PI;
      box(black, px, 1.75, fz, 1.2, 0.8, 0.03);
      batch.add(G.plane, white, [px, 1.75, fz + faceDir * 0.02], [0, ry, Math.PI / 4], [0.48, 0.48, 1]);
      batch.add(G.plane, black, [px, 1.75, fz + faceDir * 0.025], [0, ry, Math.PI / 4], [0.3, 0.3, 1]);
      batch.add(G.plane, white, [px, 1.75, fz + faceDir * 0.03], [0, ry, Math.PI / 4], [0.12, 0.12, 1]);
    }
    // Audience pavilion with a high roof.
    const pz = cz - faceDir * 1.5;
    box(ochre, cx, 0.6, pz, 8, 1.2, 4.5);
    box(white, cx, 2.2, pz - faceDir * 1.9, 8, 2, 0.4);
    for (const sx of [-1, 1]) for (const dz of [-1, 1]) box(white, cx + sx * 3.7, 2.4, pz + dz * 2, 0.35, 2.4, 0.35);
    batch.add(new THREE.ConeGeometry(1, 1, 4), M.roofRust, [cx, 4.4, pz], [0, Math.PI / 4, 0], [6.4, 1.8, 3.8]);
    for (const sx of [-1, 1]) box(M.wood, cx + sx * 1.6, 1.45, pz, 1.2, 0.5, 0.6);
    // The chief's great umbrella (kyinie) in bright cloth.
    batch.add(G.cyl8, M.wood, [cx + 3, 1.8, pz + faceDir * 3], [0, 0, 0], [0.06, 3.6, 0.06]);
    batch.add(G.cone, colorMat("#c8452c", 0.8), [cx + 3, 3.9, pz + faceDir * 3], [0, 0, 0], [1.7, 0.9, 1.7]);
    batch.add(G.cyl, colorMat("#f2b705", 0.8), [cx + 3, 3.4, pz + faceDir * 3], [0, 0, 0], [1.72, 0.3, 1.72]);
    batch.add(G.ico, colorMat("#c9a227", 0.35, 0.6), [cx + 3, 4.5, pz + faceDir * 3], [0, 0, 0], [0.18, 0.18, 0.18]);
    box(signMat(p.sign ?? p.name.toUpperCase(), "#9a4a2a", "#f2ece0"), cx, 2.75, front + faceDir * 0.2, 4.2, 0.55, 0.06);
    collide(cx, pz, 8, 4.5, 4);
  }

  /** Jamestown Lighthouse: a tall red-and-white banded tower with a gallery and lantern, beside the keeper's house. */
  function lighthouse(p: Place, cx: number, cz: number, w: number, depth: number, faceDir: number) {
    const front = cz + faceDir * (depth / 2);
    const tx = cx + w / 4, H = 26;
    const red = colorMat("#c8322c", 0.6), white = M.white;
    for (let i = 0; i < 8; i++) {
      const y0 = (i * H) / 8, r0 = 2.2 - (i / 8) * 0.9, r1 = 2.2 - ((i + 1) / 8) * 0.9;
      batch.add(new THREE.CylinderGeometry(r1, r0, H / 8, 20), i % 2 ? white : red, [tx, y0 + H / 16, cz], [0, 0, 0]);
    }
    batch.add(new THREE.CylinderGeometry(1.8, 1.8, 0.25, 20), M.darkMetal, [tx, H + 0.1, cz], [0, 0, 0]);
    for (let a = 0; a < 16; a++) box(M.darkMetal, tx + Math.cos((a / 16) * Math.PI * 2) * 1.7, H + 0.6, cz + Math.sin((a / 16) * Math.PI * 2) * 1.7, 0.05, 0.8, 0.05);
    batch.add(new THREE.CylinderGeometry(0.9, 0.9, 1.6, 12), M.glass, [tx, H + 1.1, cz], [0, 0, 0]);
    batch.add(new THREE.ConeGeometry(1.05, 1.1, 12), red, [tx, H + 2.45, cz], [0, 0, 0]);
    for (let i = 1; i < 6; i++) box(colorMat("#2a2a2a"), tx, (i * H) / 6, cz + faceDir * (2.25 - (i / 6) * 0.9), 0.5, 0.8, 0.05);
    box(colorMat("#3a2a1f", 0.7), tx, 1.1, cz + faceDir * 2.21, 1.0, 2.2, 0.06);
    // Keeper's house and a compound wall.
    batch.add(facadeBox(w / 2 - 1, 3.4, depth - 3), facadeMat("#f1ece2", "louvre"), [cx - w / 4, 1.7, cz]);
    roofPitched(cx - w / 4, cz, w / 2 - 1, depth - 3, 3.4, true);
    box(M.white, cx, 0.6, front, w, 1.2, 0.25);
    box(signMat("JAMESTOWN LIGHTHOUSE", "#c8322c", "#ffffff"), cx, 1.5, front + faceDir * 0.15, 5, 0.6, 0.06);
    collide(tx, cz, 4.4, 4.4, H + 3);
    collide(cx - w / 4, cz, w / 2 - 1, depth - 3, 3.6);
  }

  /** Takoradi Market Circle: the round market hall under a ring roof, stalls round the outside. */
  function marketCircle(p: Place, cx: number, cz: number, w: number, depth: number, faceDir: number) {
    const front = cz + faceDir * (depth / 2);
    const R = Math.min(w, depth * 1.4) / 2 - 0.5, rz = cz;
    const wall = colorMat("#e9e1cf", 0.85), band = colorMat("#2E86AB", 0.7);
    batch.add(new THREE.CylinderGeometry(R, R, 4.2, 40, 1, true), wall, [cx, 2.1, rz], [0, 0, 0]);
    batch.add(new THREE.CylinderGeometry(R + 0.05, R + 0.05, 0.5, 40, 1, true), band, [cx, 3.2, rz], [0, 0, 0]);
    batch.add(new THREE.CylinderGeometry(R * 0.35, R + 1.4, 2.4, 40, 1, true), M.roofRust, [cx, 5.4, rz], [0, 0, 0]);
    batch.add(new THREE.CylinderGeometry(R * 0.36, R * 0.36, 1.4, 24), wall, [cx, 6.9, rz], [0, 0, 0]);
    batch.add(new THREE.ConeGeometry(R * 0.42, 1.2, 24), M.roofRust, [cx, 8.2, rz], [0, 0, 0]);
    // Arched openings all round.
    for (let a = 0; a < 18; a++) {
      const ang = (a / 18) * Math.PI * 2;
      box(colorMat("#2a241f", 0.9), cx + Math.sin(ang) * (R + 0.02), 1.3, rz + Math.cos(ang) * (R + 0.02), 1.3, 2.4, 0.06, ang);
    }
    box(signMat("MARKET CIRCLE", "#2E86AB", "#ffffff"), cx, 4.9, rz + faceDir * (R + 1.2), 5.5, 0.9, 0.08);
    for (let i = 0; i < 4; i++) stall(cx - R + 1 + i * ((2 * R - 2) / 3), front + faceDir * 2.5, true);
    collide(cx, rz, R * 1.7, R * 1.7, 9);
  }

  /** A town park (Jackson Park, Koforidua): lawn, paths, shade trees, benches and a bandstand. */
  function townPark(p: Place, cx: number, cz: number, w: number, depth: number, faceDir: number) {
    const front = cz + faceDir * (depth / 2);
    batch.add(tiledPlane(w, depth, 3), std({ map: T.grass(true), roughness: 1 }), [cx, 0.05, cz], [-Math.PI / 2, 0, 0]);
    box(M.concrete, cx, 0.07, cz, 2, 0.04, depth);
    box(M.concrete, cx, 0.07, cz, w, 0.04, 2);
    for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) neem(cx + dx * w * 0.3, cz + dz * depth * 0.3, 1.1);
    // Bandstand: a round platform, columns and a pointed roof.
    batch.add(new THREE.CylinderGeometry(2.4, 2.6, 0.5, 16), M.concrete, [cx, 0.25, cz], [0, 0, 0]);
    for (let a = 0; a < 8; a++) box(M.white, cx + Math.cos((a / 8) * Math.PI * 2) * 2.1, 1.8, cz + Math.sin((a / 8) * Math.PI * 2) * 2.1, 0.18, 2.6, 0.18);
    batch.add(new THREE.ConeGeometry(3, 1.6, 8), colorMat("#1F7A4D", 0.6), [cx, 3.9, cz], [0, Math.PI / 8, 0]);
    for (const sx of [-1, 1]) box(M.wood, cx + sx * 4.5, 0.45, front - faceDir * 1.5, 1.8, 0.1, 0.45);
    box(M.white, cx - w / 4 - 1, 0.4, front, w / 2 - 2, 0.8, 0.2);
    box(M.white, cx + w / 4 + 1, 0.4, front, w / 2 - 2, 0.8, 0.2);
    box(signMat(p.sign ?? p.name.toUpperCase(), "#1F7A4D", "#ffffff"), cx, 1.4, front + faceDir * 0.1, 4, 0.6, 0.06);
    collide(cx, cz, 5, 5, 4);
  }

  /** A war memorial cenotaph on a stepped plinth in a paved square. */
  function cenotaph(p: Place, cx: number, cz: number, w: number, depth: number, faceDir: number) {
    const front = cz + faceDir * (depth / 2);
    batch.add(tiledPlane(w, depth, 3), M.pavers, [cx, 0.05, cz], [-Math.PI / 2, 0, 0]);
    for (let i = 0; i < 3; i++) box(M.concrete, cx, 0.2 + i * 0.4, cz, 6 - i * 1.4, 0.4, 6 - i * 1.4);
    box(M.white, cx, 3.6, cz, 1.4, 4.4, 1.4);
    batch.add(new THREE.ConeGeometry(1, 1, 4), M.white, [cx, 6.3, cz], [0, Math.PI / 4, 0], [1, 1.0, 1]);
    box(colorMat("#2a2a2a"), cx, 2.8, cz + faceDir * 0.71, 1.0, 1.2, 0.03);
    for (const [c, dx] of [["#C8452C", -0.4], ["#F2B705", 0], ["#1F7A4D", 0.4]] as const) box(colorMat(c), cx + dx, 0.15, front - faceDir * 1.5, 0.4, 0.1, 0.8);
    for (const sx of [-1, 1]) neem(cx + sx * (w / 2 - 2), cz, 0.9);
    box(signMat(p.sign ?? p.name.toUpperCase(), "#f4f1e6", "#2a2a2a"), cx, 1.0, front + faceDir * 0.05, 4, 0.5, 0.06);
    collide(cx, cz, 6, 6, 7);
  }

  /** A dusty neighbourhood football pitch with goalposts and a low wall. */
  function pitch(p: Place, cx: number, cz: number, w: number, depth: number, faceDir: number) {
    const front = cz + faceDir * (depth / 2);
    // Astroturf where the name says so, otherwise bare red earth.
    const turf = /astro/i.test(p.name) ? std({ map: T.grass(true), color: "#9fd27a", roughness: 0.9 }) : std({ map: T.laterite(), roughness: 1 });
    batch.add(tiledPlane(w, depth, 4), turf, [cx, 0.05, cz], [-Math.PI / 2, 0, 0]);
    box(M.white, cx, 0.07, cz, 0.12, 0.01, depth - 1);
    for (const sx of [-1, 1]) {
      const gx = cx + sx * (w / 2 - 1.2);
      for (const dz of [-1, 1]) box(M.white, gx, 1.1, cz + dz * 1.8, 0.1, 2.2, 0.1);
      box(M.white, gx, 2.2, cz, 0.1, 0.1, 3.7);
    }
    box(M.plaster, cx, 0.6, cz - faceDir * (depth / 2), w, 1.2, 0.25);
    box(signMat(p.sign ?? p.name.toUpperCase(), "#1F7A4D", "#ffffff"), cx, 1.0, front + faceDir * 0.05, 4.2, 0.5, 0.06);
  }

  /**
   * A lorry park behind the shelter: a concrete yard, two long corrugated sheds,
   * trotros parked nose-in waiting to fill, the station master's booth and a
   * welded arch over the gate with the station's name.
   */
  function lorryPark(p: Place, x: number, side: number) {
    const z0 = side * BUILD_LINE, depth = 16, zc = side * (BUILD_LINE + depth / 2);
    batch.add(tiledPlane(14, depth, 4), M.concrete, [x, 0.03, zc], [-Math.PI / 2, 0, 0]);
    for (const sx of [-1, 1]) box(M.metal, x + sx * 6.9, 1.9, z0 + side * 0.2, 0.18, 3.8, 0.18);
    box(M.metal, x, 3.8, z0 + side * 0.2, 14, 0.2, 0.2);
    box(signMat(p.sign ?? p.name.toUpperCase(), "#1F7A4D", "#F2B705"), x, 4.35, z0 + side * 0.2 - side * 0.12, 9, 0.9, 0.08);
    // Sheds along the back and one side, with benches in their shade.
    for (const [sx, sz, sw, sd] of [[x, zc + side * 5.5, 13, 4], [x - 5.2, zc - side * 1.5, 3.5, 9]] as const) {
      for (const dx of [-1, 1]) for (const dz of [-1, 1]) box(M.metal, sx + dx * (sw / 2 - 0.2), 1.5, sz + dz * (sd / 2 - 0.2), 0.1, 3, 0.1);
      box(M.roofRust, sx, 3.05, sz, sw + 0.4, 0.08, sd + 0.4);
      box(M.wood, sx, 0.45, sz, sw * 0.8, 0.08, 0.5);
    }
    box(colorMat("#E9B872"), x + 5.4, 1.2, zc + side * 3, 2.2, 2.4, 2);
    box(signMat("STATION MASTER", "#F2B705", "#111"), x + 5.4, 2.0, zc + side * 3 - side * 1.02, 1.8, 0.35, 0.04);
    collide(x + 5.4, zc + side * 3, 2.2, 2, 2.6);
    // Trotros waiting to load, nose to the sheds.
    for (let i = 0; i < 4; i++) {
      const v = buildVehicle("trotro", Math.floor(x * 31 + i * 97) >>> 0);
      v.group.position.set(x - 1.6 + i * 2.35, 0, zc + side * 0.6);
      v.group.rotation.y = side > 0 ? 0 : Math.PI;
      v.group.traverse((o) => { o.castShadow = true; });
      group.add(v.group);
      collide(x - 1.6 + i * 2.35, zc + side * 0.6, v.width, v.length, 2.4);
    }
  }

  /** Kejetia Market (the 2017 redevelopment): a vast, layered block with deep sunshade fins, terracotta bands and a broad entrance. */
  function kejetia(p: Place, cx: number, cz: number, w: number, depth: number, h: number, faceDir: number) {
    const front = cz + faceDir * (depth / 2);
    const H = Math.max(h, 12);
    batch.add(facadeBox(w, H, depth), facadeMat("#e9e6df", "modern"), [cx, H / 2, cz]);
    const terra = colorMat("#b5532f", 0.85), white = M.white;
    for (let y = 3.2; y < H; y += 3.2) box(terra, cx, y, front + faceDir * 0.25, w + 0.6, 0.35, 0.5);
    for (let i = -w / 2 + 1; i <= w / 2 - 1; i += 1.4) box(white, cx + i, H / 2 + 1.6, front + faceDir * 0.35, 0.18, H - 3.2, 0.6);
    box(white, cx, H + 0.5, cz, w + 1.2, 1, depth + 1.2);
    box(terra, cx, H + 1.15, cz, w + 1.4, 0.3, depth + 1.4);
    // Entrance hall: a glazed recess under a deep canopy.
    box(M.glass, cx, 1.6, front + faceDir * 0.05, Math.min(10, w * 0.4), 3.0, 0.08);
    box(white, cx, 3.3, front + faceDir * 2, Math.min(14, w * 0.6), 0.25, 4);
    for (const sx of [-1, 1]) box(white, cx + sx * Math.min(6.8, w * 0.29), 1.6, front + faceDir * 3.8, 0.4, 3.2, 0.4);
    box(signMat(p.sign ?? "KEJETIA MARKET", "#b5532f", "#ffffff"), cx, 4.4, front + faceDir * 0.42, Math.min(16, w * 0.62), 1.6, 0.1);
    for (let i = 0; i < 5; i++) stall(cx - w / 2 + 3 + i * ((w - 6) / 4), front + faceDir * 6.2, true);
    collide(cx, cz, w, depth, H);
  }

  /**
   * Manhyia Palace: the old two-storey palace (now the museum) behind a white wall
   * and gold-topped gate piers, with arches below, a balcony above and a hipped roof.
   */
  function manhyiaPalace(p: Place, cx: number, cz: number, w: number, depth: number, h: number, faceDir: number) {
    const front = cz + faceDir * (depth / 2);
    const bw = Math.min(w - 2, 14), bd = Math.min(depth - 4, 7), bz = cz - faceDir * 1.5, bf = bz + faceDir * (bd / 2);
    const cream = colorMat("#f1e6cf", 0.8), trim = colorMat("#fbf7ee", 0.7), gold = colorMat("#c9a227", 0.35, 0.6), roof = colorMat("#8a3b26", 0.7);
    // Lawn and forecourt.
    batch.add(tiledPlane(w, depth, 3), std({ map: T.grass(true), roughness: 1 }), [cx, 0.04, cz], [-Math.PI / 2, 0, 0]);
    box(M.concrete, cx, 0.06, (bf + front) / 2, 3, 0.04, Math.abs(front - bf));
    // Two storeys with a ground-floor arcade and a first-floor balcony.
    box(cream, cx, 3.4, bz, bw, 6.8, bd);
    for (let i = 0; i < 7; i++) {
      const ax = cx - bw / 2 + 1 + i * ((bw - 2) / 6);
      box(trim, ax, 1.5, bf + faceDir * 1.2, 0.45, 3, 0.45);
      box(colorMat("#3a2a1f", 0.8), ax + (bw - 2) / 12, 1.4, bf + faceDir * 0.02, 1.0, 2.2, 0.05);
      box(colorMat("#3a2a1f", 0.8), ax + (bw - 2) / 12, 4.9, bf + faceDir * 0.02, 0.8, 1.6, 0.05);
    }
    box(cream, cx, 3.15, bf + faceDir * 1.2, bw, 0.3, 2.6);
    box(M.white, cx, 3.85, bf + faceDir * 2.45, bw, 0.08, 0.06);
    for (let i = 0; i <= 28; i++) box(M.white, cx - bw / 2 + (i * bw) / 28, 3.6, bf + faceDir * 2.45, 0.06, 0.5, 0.06);
    batch.add(new THREE.ConeGeometry(1, 1, 4), roof, [cx, 7.7, bz], [0, Math.PI / 4, 0], [bw * 0.76, 1.9, bd * 0.9]);
    // Boundary wall and gate piers topped in gold.
    for (const sx of [-1, 1]) {
      // Low wall with black railings, so the arcade shows over it.
      box(M.white, cx + sx * (w / 4 + 1), 0.45, front, w / 2 - 2, 0.9, 0.3);
      box(M.darkMetal, cx + sx * (w / 4 + 1), 1.75, front, w / 2 - 2, 0.06, 0.06);
      for (let i = 0; i < (w / 2 - 2) / 0.25; i++) box(M.darkMetal, cx + sx * 3 + sx * i * 0.25, 1.3, front, 0.03, 0.9, 0.03);
      box(M.white, cx + sx * 2, 1.4, front, 0.7, 2.8, 0.7);
      batch.add(G.ico, gold, [cx + sx * 2, 3.05, front], [0, 0, 0], [0.32, 0.32, 0.32]);
    }
    // Flag of gold, green and black stripes.
    batch.add(G.cyl8, M.darkMetal, [cx + bw / 2 - 1, 9, bz], [0, 0, 0], [0.05, 6, 0.05]);
    for (const [c, y] of [["#C9A227", 11.6], ["#1F7A4D", 11.2], ["#111111", 10.8]] as const) batch.add(G.plane, colorMat(c, 0.8), [cx + bw / 2 - 0.4, y, bz], [0, 0, 0], [1.2, 0.4, 1]);
    box(signMat("MANHYIA PALACE MUSEUM", "#111111", "#C9A227"), cx, 2.4, front + faceDir * 0.2, 4.6, 0.6, 0.06);
    collide(cx, bz, bw, bd, 8);
    for (const sx of [-1, 1]) collide(cx + sx * (w / 4 + 1), front, w / 2 - 2, 0.3, 2);
  }

  /**
   * Real depth on a painted facade: sills, lintels and jambs where the texture draws
   * its windows (one bay every 3 m, as in facade()), floor ledges, the odd split-AC
   * unit hung under a window and a rainwater downpipe. Upper floors only: the ground
   * floor has shopfronts and doors over it.
   */
  function relief(kind: "louvre" | "modern", cx: number, cz: number, w: number, h: number, depth: number, faceDir: number) {
    const front = cz + faceDir * (depth / 2);
    const [ww, bot, top] = kind === "modern" ? [1.76, 0.75, 2.27] : [1.22, 0.96, 2.27];
    const bays = Math.floor(w / 3);
    const ledge = M.concrete;
    for (let fy = 3; fy + 2.4 <= h; fy += 3) {
      box(ledge, cx, fy, front + faceDir * 0.05, w + 0.08, 0.14, 0.1);
      for (let k = 0; k < bays; k++) {
        const x = faceDir > 0 ? cx - w / 2 + (k + 0.5) * 3 : cx + w / 2 - (k + 0.5) * 3;
        box(ledge, x, fy + bot - 0.06, front + faceDir * 0.09, ww + 0.28, 0.07, 0.18);
        box(ledge, x, fy + top + 0.07, front + faceDir * 0.04, ww + 0.2, 0.1, 0.08);
        for (const sx of [-1, 1]) box(M.white, x + sx * (ww / 2 + 0.03), fy + (bot + top) / 2, front + faceDir * 0.03, 0.06, top - bot, 0.06);
        if (rnd() < 0.22) {
          // A split-AC condenser on brackets below the window, with its fan grille.
          const ax = x + (rnd() - 0.5) * 0.4, ay = fy + bot - 0.45, az = front + faceDir * 0.2;
          box(M.white, ax, ay, az, 0.8, 0.55, 0.3);
          batch.add(G.cyl, M.darkMetal, [ax + 0.12, ay, az + faceDir * 0.152], [Math.PI / 2, 0, 0], [0.19, 0.01, 0.19]);
          box(M.darkMetal, ax, ay - 0.3, front + faceDir * 0.16, 0.7, 0.04, 0.3);
        }
      }
    }
    if (h > 3.5) {
      const px = cx + (faceDir > 0 ? 1 : -1) * (w / 2 - 0.2);
      batch.add(G.cyl8, M.darkMetal, [px, h / 2, front + faceDir * 0.08], [0, 0, 0], [0.05, h, 0.05]);
    }
  }
  function parapet(cx: number, cz: number, w: number, depth: number, h: number) {
    box(M.concrete, cx, h + 0.3, cz - depth / 2 + 0.1, w, 0.6, 0.2);
    box(M.concrete, cx, h + 0.3, cz + depth / 2 - 0.1, w, 0.6, 0.2);
    box(M.concrete, cx - w / 2 + 0.1, h + 0.3, cz, 0.2, 0.6, depth);
    box(M.concrete, cx + w / 2 - 0.1, h + 0.3, cz, 0.2, 0.6, depth);
    box(M.concrete, cx, h + 0.02, cz, w - 0.2, 0.04, depth - 0.2);
  }
  function roofPitched(cx: number, cz: number, w: number, depth: number, h: number, rusty: boolean, pitch = 0.32, gable: THREE.Material = M.plaster) {
    const m = rusty ? M.roofRust : M.roofClean;
    const half = depth / 2 + 0.4;
    const slope = half / Math.cos(pitch);
    batch.add(tiledPlane(w + 0.8, slope, 3), m, [cx, h + Math.sin(pitch) * half * 0.5, cz - half / 2], [-Math.PI / 2 + pitch, 0, 0]);
    batch.add(tiledPlane(w + 0.8, slope, 3), m, [cx, h + Math.sin(pitch) * half * 0.5, cz + half / 2], [-Math.PI / 2 - pitch, 0, Math.PI]);
    batch.add(tiledPlane(w + 0.8, slope, 3), m, [cx, h + Math.sin(pitch) * half * 0.5 - 0.02, cz - half / 2], [Math.PI / 2 + pitch, 0, 0]);
    batch.add(tiledPlane(w + 0.8, slope, 3), m, [cx, h + Math.sin(pitch) * half * 0.5 - 0.02, cz + half / 2], [Math.PI / 2 - pitch, 0, Math.PI]);
    // Gable ends.
    const tri = new THREE.Shape([new THREE.Vector2(-depth / 2, 0), new THREE.Vector2(depth / 2, 0), new THREE.Vector2(0, Math.tan(pitch) * depth / 2)]);
    const tg = new THREE.ShapeGeometry(tri);
    batch.add(tg, gable, [cx - w / 2, h, cz], [0, -Math.PI / 2, 0]);
    batch.add(tg, gable, [cx + w / 2, h, cz], [0, Math.PI / 2, 0]);
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
  // -------------------------------------------------------------------------
  // Regional building parts: the savanna north and the middle-belt towns.

  const SAV_SIGNS = [
    "ALHAMDULILLAH ENTERPRISE", "MASHA ALLAH PROVISIONS", "NAA GBEWAA SPARE PARTS", "BARAKA WELDING WORKS", "INSHA ALLAH TAILORING",
    "ZONGO BARBERING SALON", "TI ZAA FOOD JOINT", "SUNGMAALE COSMETICS", "AL-HASSAN MOTOR SPARES", "DAGBON PHONES & MOMO",
    "PAGSUNG SHEA BUTTER", "NASARA BICYCLE REPAIRS", "NEEM TREE CHEMICALS", "SALAMATU FABRICS", "SAVANNA COLD STORE", "NYEBU GRINDING MILL",
  ];
  const TOWN_SIGNS = [
    "ONYAME BEKYERE ENTERPRISE", "ABUSUA YAM DEPOT", "COCOA HOUSE PROVISIONS", "AKWAABA SPOT", "FOREST GATE PHARMACY", "SANKOFA PHOTOS",
    "GOD FIRST TYRES", "MADAM AKOSUA FABRICS", "NKOSUO HARDWARE", "AWURADE KASA MOTORS", "ODO NI SIKA SALON", "OBRA YE BO AUTO", "EBEN-EZER WELDING",
  ];

  /** Tapering buttress / pinnacle of base `b`, height `ht`. */
  function pillar(m: THREE.Material, x: number, z: number, b: number, ht: number, y0 = 0) {
    batch.add(TAPER, m, [x, y0 + ht / 2, z], [0, 0, 0], [b, ht, b]);
  }
  /** Toron: the timber sticks left protruding from Sudano-Sahelian walls as scaffolding for re-plastering. */
  function toronOn(x: number, z: number, b: number, ht: number, faces: [number, number][], every = 1.2, perRow = 1, y0 = 0) {
    for (let y = y0 + 1.1; y < y0 + ht - 0.5; y += every) {
      const hw = (b / 2) * (1 - 0.45 * ((y - y0) / ht));
      for (const [fx, fz] of faces) {
        for (let k = 0; k < perRow; k++) {
          const off = perRow === 1 ? 0 : (k / (perRow - 1) - 0.5) * hw * 1.3;
          const px = x + fx * (hw + 0.28) + (fz !== 0 ? off : 0);
          const pz = z + fz * (hw + 0.28) + (fx !== 0 ? off : 0);
          box(M.toron, px, y, pz, fx ? 0.7 : 0.09, 0.09, fz ? 0.7 : 0.09);
        }
      }
    }
  }
  /** A flat mud roof behind a parapet, with corner pinnacles and rain spouts. */
  function mudParapet(cx: number, cz: number, w: number, depth: number, h: number, color: string, merlons = false) {
    const m = mudMat(color);
    const ph = 0.55;
    box(m, cx, h + ph / 2, cz - depth / 2 + 0.12, w, ph, 0.24);
    box(m, cx, h + ph / 2, cz + depth / 2 - 0.12, w, ph, 0.24);
    box(m, cx - w / 2 + 0.12, h + ph / 2, cz, 0.24, ph, depth);
    box(m, cx + w / 2 - 0.12, h + ph / 2, cz, 0.24, ph, depth);
    box(mudMat(shade(color, 0.82)), cx, h + 0.02, cz, w - 0.2, 0.04, depth - 0.2);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) batch.add(G.cone, m, [cx + sx * (w / 2 - 0.15), h + ph + 0.2, cz + sz * (depth / 2 - 0.15)], [0, 0, 0], [0.2, 0.4, 0.2]);
    if (merlons) {
      for (let i = -w / 2 + 1.2; i < w / 2 - 0.8; i += 1.3) for (const sz of [-1, 1]) batch.add(G.cone, m, [cx + i, h + ph + 0.15, cz + sz * (depth / 2 - 0.12)], [0, 0, 0], [0.14, 0.32, 0.14]);
    }
    // Spouts throw the rain clear of the walls.
    for (let i = -w / 2 + 1.5; i < w / 2 - 1; i += 3 + rnd() * 2) for (const sz of [-1, 1]) box(M.toron, cx + i, h + 0.12, cz + sz * (depth / 2 + 0.25), 0.12, 0.12, 0.6);
  }
  /** Painted plastic ablution kettles lined up by a mosque wall. */
  function kettles(x0: number, z: number, n: number) {
    const cols = ["#2E86AB", "#C8452C", "#1F7A4D", "#F2B705", "#6A2CBF", "#E35D3A"];
    for (let i = 0; i < n; i++) {
      const x = x0 + i * 0.4;
      const m = colorMat(cols[i % cols.length], 0.45);
      batch.add(G.sphere, m, [x, 0.17, z], [0, 0, 0], [0.13, 0.15, 0.13]);
      batch.add(G.cyl8, m, [x + 0.12, 0.22, z], [0, 0, 0.9], [0.025, 0.16, 0.025]);
    }
  }
  function archedDoor(x: number, z: number, faceDir: number, wd: number, ht: number, m: THREE.Material = colorMat("#2a1d14", 0.9)) {
    box(m, x, ht / 2, z + faceDir * 0.03, wd, ht, 0.06);
    batch.add(G.cyl, m, [x, ht, z + faceDir * 0.03], [Math.PI / 2, 0, 0], [wd / 2, 0.06, wd / 2]);
  }

  /**
   * Sudano-Sahelian mud architecture (Larabanga, Bole, Wa Naa's palace):
   * buttressed walls rising into pinnacles, timber toron, ostrich-egg finials
   * and, for a mosque, a tall tapering minaret tower that marks the town.
   */
  function sudanoSahelian(p: Place, cx: number, cz: number, w: number, depth: number, h: number, faceDir: number, mosque: boolean) {
    const front = cz + faceDir * (depth / 2);
    const wash = mosque ? (rnd() < 0.55 ? "#F1E9DA" : "#D9B98A") : p.color;
    const body = mudMat(wash), trim = mudMat(shade(wash, 0.72));
    const egg = colorMat("#f7f3ea", 0.4);
    const wallH = mosque ? Math.max(5, h * 0.6) : Math.max(4.5, h * 0.8);
    batch.add(facadeBox(w - 0.4, wallH, depth - 0.4), body, [cx, wallH / 2, cz]);
    box(trim, cx, 0.45, cz, w - 0.2, 0.9, depth - 0.2); // plinth splashed with red earth
    mudParapet(cx, cz, w - 0.4, depth - 0.4, wallH, wash, true);
    const towerX = cx - w * 0.27;
    // Buttresses along the front, rising above the parapet as pinnacles.
    const nb = Math.max(3, Math.round(w / 2.2));
    for (let i = 0; i <= nb; i++) {
      const bx = cx - w / 2 + 0.3 + (i / nb) * (w - 0.6);
      if (Math.abs(bx - cx) < 1.4) continue; // the entrance
      if (mosque && Math.abs(bx - towerX) < 2.2) continue; // the minaret
      const bz = front - faceDir * 0.1;
      const bh = wallH + 1.4 + (i % 2) * 0.5;
      pillar(body, bx, bz, 0.8, bh);
      batch.add(G.cone, body, [bx, bh + 0.15, bz], [0, 0, 0], [0.2, 0.4, 0.2]);
      batch.add(G.sphere, egg, [bx, bh + 0.42, bz], [0, 0, 0], [0.08, 0.11, 0.08]);
      toronOn(bx, bz, 0.8, bh, [[0, faceDir]], 1.3);
    }
    // Side buttresses.
    const ns = Math.max(2, Math.round(depth / 3));
    for (const sx of [-1, 1]) {
      for (let k = 1; k < ns; k++) {
        const bz = front - faceDir * ((k / ns) * depth);
        pillar(body, cx + sx * (w / 2 - 0.15), bz, 0.7, wallH + 1.1);
        batch.add(G.cone, body, [cx + sx * (w / 2 - 0.15), wallH + 1.25, bz], [0, 0, 0], [0.18, 0.35, 0.18]);
        toronOn(cx + sx * (w / 2 - 0.15), bz, 0.7, wallH + 1.1, [[sx, 0]], 1.4);
      }
    }
    // Corner towers.
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const tx = cx + sx * (w / 2 - 0.4), tz = cz + sz * (depth / 2 - 0.4);
        const th = wallH + 2.4;
        pillar(body, tx, tz, 1.5, th);
        batch.add(G.cone, body, [tx, th + 0.2, tz], [0, 0, 0], [0.32, 0.6, 0.32]);
        batch.add(G.sphere, egg, [tx, th + 0.58, tz], [0, 0, 0], [0.1, 0.14, 0.1]);
        toronOn(tx, tz, 1.5, th, [[sx, 0], [0, sz]], 1.2);
        collide(tx, tz, 1.5, 1.5, th);
      }
    }
    if (mosque) {
      // The minaret: a tall tapering tower bristling with toron, visible from the whole street.
      const tb = Math.min(4.2, Math.max(3, w * 0.28));
      const th = Math.max(h + 6, 15);
      const tz = front - faceDir * (tb / 2 - 0.6);
      pillar(body, towerX, tz, tb, th);
      // Stepped crown with a cluster of pinnacles.
      const topW = tb * 0.55;
      for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
        batch.add(G.cone, body, [towerX + dx * topW * 0.32, th + 0.45, tz + dz * topW * 0.32], [0, 0, 0], [0.22, 0.9, 0.22]);
      }
      batch.add(G.cone, body, [towerX, th + 0.8, tz], [0, 0, 0], [0.4, 1.6, 0.4]);
      batch.add(G.sphere, egg, [towerX, th + 1.7, tz], [0, 0, 0], [0.13, 0.18, 0.13]);
      toronOn(towerX, tz, tb, th, [[1, 0], [-1, 0], [0, 1], [0, -1]], 1.05, 3);
      // Little dark openings up the tower.
      for (let y = wallH + 1.5; y < th - 2; y += 2.6) box(colorMat("#2a1d14", 0.9), towerX, y, tz + faceDir * ((tb / 2) * (1 - 0.45 * (y / th)) + 0.02), 0.35, 0.6, 0.06);
      collide(towerX, tz, tb, tb, th);
      // Mihrab tower at the back.
      const mz = cz - faceDir * (depth / 2 - 0.6);
      pillar(body, cx + w * 0.1, mz, 2.6, wallH + 4.5);
      batch.add(G.cone, body, [cx + w * 0.1, wallH + 4.8, mz], [0, 0, 0], [0.3, 0.8, 0.3]);
      batch.add(G.sphere, egg, [cx + w * 0.1, wallH + 5.25, mz], [0, 0, 0], [0.1, 0.14, 0.1]);
      toronOn(cx + w * 0.1, mz, 2.6, wallH + 4.5, [[1, 0], [-1, 0], [0, -faceDir]], 1.2, 2);
      collide(cx + w * 0.1, mz, 2.6, 2.6, wallH + 4.5);
      kettles(cx + 1.6, front + faceDir * 0.45, 6);
    }
    archedDoor(cx, front - faceDir * 0.15, faceDir, 1.7, 2.5);
    // Small, deep window slits.
    for (const sx of [-1, 1]) {
      for (let k = 0; k < 2; k++) box(colorMat("#2a1d14", 0.9), cx + sx * (2.3 + k * 1.9), wallH * 0.6, front - faceDir * 0.17, 0.3, 0.8, 0.06);
    }
    // A modest painted board by the entrance.
    const [signText, sub] = p.sign.split(" • ");
    const sw = Math.min(4.2, w * 0.36);
    box(signMat(signText, mosque ? "#1F5E3B" : "#5b3a29", "#fff6e0", sub), cx + w * 0.24, 3.1, front + faceDir * 0.35, sw, sw / 5.3, 0.06);
    collide(cx, cz, w, depth, wallH + 1.4);
  }

  /** A modern zongo mosque: white walls, green dome and twin minarets. */
  function modernMosque(p: Place, cx: number, cz: number, w: number, depth: number, h: number, faceDir: number) {
    const front = cz + faceDir * (depth / 2);
    const hh = Math.max(6, h * 0.72);
    const green = colorMat("#1F7A4D", 0.35, 0.3);
    batch.add(facadeBox(w, hh, depth), facadeMat(p.color, "modern"), [cx, hh / 2, cz]);
    parapet(cx, cz, w, depth, hh);
    const r = Math.min(w, depth) * 0.3;
    batch.add(G.cyl, M.white, [cx, hh + 0.6, cz], [0, 0, 0], [r, 1.2, r]);
    batch.add(G.sphere, green, [cx, hh + 1.2, cz], [0, 0, 0], [r, r * 0.95, r]);
    batch.add(G.cyl8, colorMat("#d4af37", 0.3, 0.8), [cx, hh + 1.2 + r + 0.5, cz], [0, 0, 0], [0.05, 1, 0.05]);
    batch.add(G.sphere, colorMat("#d4af37", 0.3, 0.8), [cx, hh + 1.2 + r + 1.05, cz], [0, 0, 0], [0.16, 0.16, 0.16]);
    for (const sx of [-1, 1]) {
      const mx = cx + sx * (w / 2 - 0.9), mz = front - faceDir * 0.9;
      const mh = hh + 8;
      batch.add(G.cyl, M.white, [mx, mh / 2, mz], [0, 0, 0], [0.62, mh, 0.62]);
      batch.add(G.cyl, green, [mx, mh * 0.78, mz], [0, 0, 0], [0.95, 0.25, 0.95]);
      batch.add(G.cyl, M.white, [mx, mh * 0.78 + 0.5, mz], [0, 0, 0], [0.92, 0.06, 0.92]);
      batch.add(G.cone, green, [mx, mh + 0.9, mz], [0, 0, 0], [0.66, 1.8, 0.66]);
      collide(mx, mz, 1.4, 1.4, mh);
    }
    archedDoor(cx, front, faceDir, 2, 2.8, colorMat("#3a2a1f", 0.7));
    box(green, cx, 3.1, front + faceDir * 0.05, 2.6, 0.12, 0.12);
    for (const sx of [-1, 1]) for (let k = 1; k <= 2; k++) archedDoor(cx + sx * (k * w * 0.18 + 0.6), front, faceDir, 0.9, 1.6 + hh * 0.2, M.glass);
    const [signText, sub] = p.sign.split(" • ");
    const sw = Math.min(w * 0.55, 8);
    box(signMat(signText, "#1F5E3B", "#ffffff", sub), cx, Math.min(hh - 0.8, 4.3), front + faceDir * 0.07, sw, Math.min(1, sw / 5.3), 0.08);
    kettles(cx + 1.8, front + faceDir * 0.45, 6);
    collide(cx, cz, w, depth, hh + 2);
  }

  /** A shopping mall: glass core, clad wings, a roof-line brand band and a canopy. */
  function mallBuilding(p: Place, cx: number, cz: number, w: number, depth: number, h: number, faceDir: number) {
    const front = cz + faceDir * (depth / 2);
    const H = Math.max(8, h);
    const wing = Math.min(4, w * 0.18);
    batch.add(facadeBox(w - 2 * wing, H, depth), facadeMat("#ffffff", "glass"), [cx, H / 2, cz]);
    const clad = std({ map: T.concrete(p.color, 171), roughness: 0.5 });
    for (const sx of [-1, 1]) {
      batch.add(facadeBox(wing, H + 1, depth + 0.4), clad, [cx + sx * (w / 2 - wing / 2), (H + 1) / 2, cz]);
      // Vertical accent fins.
      for (let k = 0; k < 3; k++) box(colorMat("#B3123A", 0.4), cx + sx * (w / 2 - wing / 2) + (k - 1) * wing * 0.28, (H + 1) / 2, front + faceDir * 0.25, 0.12, H + 1, 0.12);
    }
    box(colorMat("#2b2d30", 0.5, 0.3), cx, H + 0.25, cz, w - 2 * wing + 0.2, 0.5, depth + 0.4);
    const [signText, sub] = p.sign.split(" • ");
    const sw = Math.min(w - 2 * wing - 1, 14);
    box(signMat(signText, "#B3123A", "#ffffff", sub), cx, H - 1.2, front + faceDir * 0.1, sw, Math.min(1.9, sw / 5.3), 0.1);
    const strip = std({ color: "#ffffff", emissive: "#9fe8ff", emissiveIntensity: 0 });
    night.push({ mat: strip, on: 2 * glow, off: 0 });
    box(strip, cx, H - 2.3, front + faceDir * 0.12, w - 2 * wing, 0.1, 0.1);
    // Entrance canopy on slim columns, sliding doors beneath.
    const cw = Math.min(10, w * 0.5);
    box(M.white, cx, 4.2, front + faceDir * 1.4, cw, 0.3, 2.8);
    for (const sx of [-1, 1]) {
      batch.add(G.cyl8, M.metal, [cx + sx * (cw / 2 - 0.3), 2.1, front + faceDir * 2.5], [0, 0, 0], [0.16, 4.2, 0.16]);
      collide(cx + sx * (cw / 2 - 0.3), front + faceDir * 2.5, 0.4, 0.4, 4.3);
    }
    box(colorMat("#1b2730", 0.1, 0.5), cx, 1.45, front + faceDir * 0.04, 4.2, 2.9, 0.06);
    box(M.metal, cx, 1.45, front + faceDir * 0.06, 0.06, 2.9, 0.06);
    // Bollards and planters along the frontage.
    for (let bx = cx - w / 2 + 1; bx <= cx + w / 2 - 1; bx += 2.4) {
      if (Math.abs(bx - cx) < cw / 2 + 0.4) continue;
      if (rnd() < 0.5) {
        box(M.concrete, bx, 0.4, front + faceDir * 0.6, 1.2, 0.8, 0.8);
        batch.add(G.ico, M.leaf2, [bx, 1.0, front + faceDir * 0.6], [0, rnd() * 3, 0], [0.6, 0.5, 0.6]);
        collide(bx, front + faceDir * 0.6, 1.2, 0.8, 1.2);
      } else {
        batch.add(G.cyl8, M.darkMetal, [bx, 0.45, front + faceDir * 0.6], [0, 0, 0], [0.11, 0.9, 0.11]);
        collide(bx, front + faceDir * 0.6, 0.25, 0.25, 0.9);
      }
    }
    collide(cx, cz, w, depth, H + 0.6);
  }

  /** A phone shop: bright paint, glazed front, brand banners and feather flags. */
  function phoneShop(p: Place, cx: number, cz: number, w: number, depth: number, h: number, faceDir: number) {
    const front = cz + faceDir * (depth / 2);
    const H = Math.max(3.6, h);
    const hash = [...p.id].reduce((a, ch) => a + ch.charCodeAt(0), 0);
    const brand = (k: number) => PHONE_BRANDS[(hash + k) % PHONE_BRANDS.length];
    const body = brand(0)[1] === "#111111" ? "#F2F2F2" : brand(0)[1];
    batch.add(facadeBox(w, H, depth), facadeMat(body, savanna ? "small" : "modern"), [cx, H / 2, cz]);
    if (savanna) mudParapet(cx, cz, w, depth, H, "#E3CBA4");
    else parapet(cx, cz, w, depth, H);
    box(M.glass, cx, 1.45, front + faceDir * 0.02, w - 1.2, 2.5, 0.06);
    box(M.metal, cx, 1.45, front + faceDir * 0.04, 0.06, 2.5, 0.06);
    const [signText, sub] = p.sign.split(" • ");
    const sh = Math.min(1.1, (w - 0.4) / 5.3);
    const signY = Math.max(3.25, H - 0.5);
    box(signMat(signText, "#FFD400", "#111111", sub ?? "PHONES • ACCESSORIES • REPAIRS"), cx, signY, front + faceDir * 0.08, w - 0.4, sh, 0.08);
    if (signY + sh / 2 > H) for (const sx of [-1, 1]) box(M.darkMetal, cx + sx * (w / 2 - 0.5), (H + signY) / 2, front + faceDir * 0.03, 0.08, signY - H + 0.4, 0.08);
    const neon = std({ color: "#7ff9ff", emissive: "#3ff0ff", emissiveIntensity: 0 });
    night.push({ mat: neon, on: 2.4 * glow, off: 0.1 });
    box(neon, cx, signY - sh / 2 - 0.1, front + faceDir * 0.1, w - 0.6, 0.07, 0.07);
    // Two brand boards over the glass.
    for (const sx of [-1, 1]) {
      const [b, bg, fg, tag] = brand(sx < 0 ? 1 : 2);
      box(signMat(b, bg, fg, tag), cx + sx * (w / 4 - 0.05), 2.85, front + faceDir * 0.08, w / 2 - 0.6, 0.42, 0.06);
    }
    // Feather flags at the kerb of the forecourt.
    for (const sx of [-1, 1]) {
      const [b, bg, fg] = brand(sx < 0 ? 3 : 4);
      const fx = cx + sx * (w / 2 - 0.35), fz = front + faceDir * 0.6;
      batch.add(G.cyl8, M.metal, [fx, 1.5, fz], [0, 0, 0], [0.025, 3, 0.025]);
      batch.add(G.plane, signMat(b, bg, fg), [fx - sx * 0.3, 1.75, fz], [0, faceDir > 0 ? 0 : Math.PI, Math.PI / 2], [2.4, 0.55, 1]);
      collide(fx, fz, 0.2, 0.2, 3);
    }
    // Glass display counter outside, and a MoMo table under a yellow umbrella.
    const dx = cx - Math.min(2.2, w * 0.27);
    box(M.darkMetal, dx, 0.4, front + faceDir * 0.55, 1.5, 0.8, 0.55);
    box(M.glass, dx, 1.0, front + faceDir * 0.55, 1.5, 0.4, 0.55);
    for (let k = 0; k < 4; k++) box(M.black, dx - 0.55 + k * 0.36, 0.84, front + faceDir * 0.55, 0.16, 0.02, 0.3);
    collide(dx, front + faceDir * 0.55, 1.6, 0.6, 1.2);
    const ux = cx + Math.min(2.2, w * 0.27);
    box(colorMat("#FFD400", 0.6), ux, 0.75, front + faceDir * 0.75, 0.9, 0.06, 0.6);
    box(colorMat("#FFD400", 0.6), ux, 0.38, front + faceDir * 0.75, 0.8, 0.72, 0.04);
    batch.add(G.cyl8, M.metal, [ux, 1.15, front + faceDir * 0.75], [0, 0, 0], [0.03, 2.3, 0.03]);
    batch.add(G.cone, colorMat("#FFD400", 0.8), [ux, 2.45, front + faceDir * 0.75], [0, 0, 0], [1.2, 0.45, 1.2]);
    collide(ux, front + faceDir * 0.75, 1, 0.7, 0.9);
    collide(cx, cz, w, depth, H + 0.6);
  }

  // Furniture pieces for the showroom forecourt (built facing the road, fd).
  function sofa(x: number, z: number, fd: number, color: string) {
    const m = colorMat(color, 0.9);
    box(M.wood, x, 0.12, z, 2, 0.24, 0.85);
    box(m, x, 0.37, z + fd * 0.05, 1.7, 0.24, 0.75);
    box(m, x, 0.72, z - fd * 0.33, 2, 0.62, 0.2);
    for (const sx of [-1, 1]) box(m, x + sx * 0.92, 0.52, z, 0.18, 0.42, 0.85);
    collide(x, z, 2.1, 0.9, 1);
  }
  function bed(x: number, z: number, fd: number) {
    box(M.wood, x, 0.27, z, 1.5, 0.22, 2);
    box(colorMat(pick(["#efe9f4", "#e8f0f4", "#f4ece0"]), 0.95), x, 0.47, z + fd * 0.04, 1.4, 0.2, 1.84);
    box(M.wood, x, 0.8, z - fd * 0.97, 1.6, 1.2, 0.08);
    for (const sx of [-1, 1]) box(M.wood, x + sx * 0.72, 0.15, z + fd * 0.95, 0.08, 0.3, 0.08);
    collide(x, z, 1.6, 2.1, 1.3);
  }
  function wardrobe(x: number, z: number, fd: number) {
    const m = colorMat(pick(["#7a4a2b", "#9a6a43", "#5e3a22"]), 0.75);
    box(m, x, 1.05, z, 1.2, 2.1, 0.6);
    box(M.black, x, 1.05, z + fd * 0.305, 0.02, 1.9, 0.01);
    box(M.glass, x + 0.3, 1.25, z + fd * 0.305, 0.38, 1.2, 0.01);
    for (const sx of [-1, 1]) box(colorMat("#d4af37", 0.3, 0.8), x + sx * 0.08, 1.05, z + fd * 0.32, 0.03, 0.18, 0.03);
    collide(x, z, 1.25, 0.65, 2.1);
  }
  /** Carpenters' workshop: open shed with planks and a workbench, showpieces out front. */
  function furnitureWorks(p: Place, cx: number, cz: number, w: number, depth: number, h: number, faceDir: number) {
    const front = cz + faceDir * (depth / 2);
    const H = Math.max(3.4, Math.min(h, 4.5));
    const shedD = Math.max(4, depth - 3.2);
    const shedCz = cz - faceDir * (depth / 2 - shedD / 2);
    const shedFront = shedCz + faceDir * (shedD / 2);
    const back = shedCz - faceDir * (shedD / 2 - 0.12);
    const wallM = savanna ? mudMat(p.color) : facadeMat(p.color, "louvre");
    box(wallM, cx, H / 2, back, w, H, 0.25);
    for (const sx of [-1, 1]) box(wallM, cx + sx * (w / 2 - 0.12), H / 2, shedCz, 0.25, H, shedD);
    collide(cx, back, w, 0.3, H);
    for (const sx of [-1, 1]) collide(cx + sx * (w / 2 - 0.12), shedCz, 0.3, shedD, H);
    for (const sx of [-1, 1]) box(M.wood, cx + sx * (w / 2 - 0.2), H / 2, shedFront, 0.2, H, 0.2);
    // Lean-to zinc roof, high at the front.
    batch.add(G.box, M.roofRust, [cx, H + 0.1, shedCz + faceDir * 0.3], [-faceDir * 0.1, 0, 0], [w + 0.6, 0.06, shedD + 1.2]);
    box(M.concrete, cx, 0.04, cz, w, 0.08, depth);
    // Sawdust, planks and the workbench in the shade.
    batch.add(G.plane, colorMat("#d9c08a", 1), [cx + w * 0.15, 0.09, shedCz], [-Math.PI / 2, 0, 0], [w * 0.5, shedD * 0.6, 1]);
    box(M.wood, cx - w * 0.15, 0.85, shedCz - faceDir * 0.4, 2.4, 0.1, 0.9);
    for (const sx of [-1, 1]) box(M.wood, cx - w * 0.15 + sx * 1.1, 0.42, shedCz - faceDir * 0.4, 0.1, 0.84, 0.8);
    for (let k = 0; k < 6; k++) box(colorMat(k % 2 ? "#a8774a" : "#8a5a3b", 0.9), cx + w / 2 - 0.5, 1.4, shedCz - faceDir * (shedD / 2 - 0.6 - k * 0.12), 0.05, 2.8, 0.25);
    collide(cx - w * 0.15, shedCz - faceDir * 0.4, 2.5, 1, 0.9);
    // Showpieces on the forecourt, entry clear in the middle.
    const yz = (shedFront + front) / 2 - faceDir * 0.1;
    const fabricCols = ["#7a1f2b", "#2f4f6f", "#c49a3a", "#3d5a3a", "#5a3a6a"];
    sofa(cx - w / 2 + 1.4, yz, faceDir, pick(fabricCols));
    if (w >= 7.5) bed(cx + w / 2 - 1.3, yz, faceDir);
    else sofa(cx + w / 2 - 1.4, yz, faceDir, pick(fabricCols));
    wardrobe(cx - w / 2 + 1.0, shedFront - faceDir * 0.6, faceDir);
    if (w >= 10) {
      wardrobe(cx + w / 2 - 1.0, shedFront - faceDir * 0.6, faceDir);
      sofa(cx - w / 2 + 3.7, yz, faceDir, pick(fabricCols));
    }
    const [signText, sub] = p.sign.split(" • ");
    const sw = Math.min(w * 0.85, 8);
    box(signMat(signText, "#5b3a29", "#F2B705", sub ?? "BEDS • SOFAS • WARDROBES"), cx, H + 0.8, shedFront + faceDir * 0.12, sw, Math.min(0.95, sw / 5.3), 0.08);
    for (const sx of [-1, 1]) box(M.wood, cx + sx * (sw / 2 - 0.3), H + 0.4, shedFront + faceDir * 0.08, 0.08, 0.9, 0.08);
  }

  /** Two-storey guesthouse with a first-floor balcony across the front. */
  function guesthouse(p: Place, cx: number, cz: number, w: number, depth: number, h: number, faceDir: number) {
    const front = cz + faceDir * (depth / 2);
    const H = Math.max(6.4, h);
    batch.add(facadeBox(w, H, depth), facadeMat(p.color, savanna ? "small" : "louvre"), [cx, H / 2, cz]);
    if (savanna) mudParapet(cx, cz, w, depth, H, p.color);
    else if (town || coastal) batch.add(HIP, M.roofRust, [cx, H + 1, cz], [0, Math.PI / 4, 0], [w * 0.76, 2, depth * 0.76]);
    else {
      parapet(cx, cz, w, depth, H);
      tank(cx + w / 2 - 1.2, cz - faceDir * depth / 4, H);
    }
    const bw = w - 1.2, bd = 1.5, by = 3.2;
    const rail = savanna ? mudMat(shade(p.color, 0.9)) : M.white;
    box(M.concrete, cx, by, front + faceDir * (bd / 2), bw, 0.2, bd);
    box(rail, cx, by + 1.0, front + faceDir * (bd - 0.05), bw, 0.08, 0.1);
    for (let bx = -bw / 2 + 0.1; bx <= bw / 2 - 0.05; bx += 0.32) box(rail, cx + bx, by + 0.55, front + faceDir * (bd - 0.05), 0.07, 0.9, 0.07);
    for (const sx of [-1, 1]) {
      box(rail, cx + sx * (bw / 2), by + 1.0, front + faceDir * (bd / 2), 0.08, 0.08, bd);
      box(rail, cx + sx * (bw / 2 - 0.12), by / 2, front + faceDir * (bd - 0.15), 0.25, by, 0.25);
      collide(cx + sx * (bw / 2 - 0.12), front + faceDir * (bd - 0.15), 0.3, 0.3, by);
    }
    const doors = w >= 10 ? [-1, 0, 1] : [-1, 1];
    for (const k of doors) box(colorMat("#4a3020", 0.7), cx + k * w * 0.28, by + 1.15, front + faceDir * 0.03, 0.9, 2.0, 0.05);
    box(colorMat("#5b3a29", 0.7), cx, 1.15, front + faceDir * 0.03, 1.4, 2.3, 0.06);
    const [signText, sub] = p.sign.split(" • ");
    const sw = Math.min(bw * 0.75, 6);
    box(signMat(signText, "#1F4E79", "#ffffff", sub ?? "ROOMS • A/C • HOT WATER"), cx, by + 0.55, front + faceDir * (bd + 0.02), sw, Math.min(0.85, sw / 5.3), 0.05);
    for (const sx of [-1, 1]) {
      const px = cx + sx * 1.5, pz = front + faceDir * 0.45;
      batch.add(G.cyl8, colorMat("#b5562f", 0.9), [px, 0.3, pz], [0, 0, 0], [0.28, 0.6, 0.28]);
      batch.add(G.ico, M.leaf2, [px, 0.95, pz], [0, rnd() * 3, 0], [0.42, 0.55, 0.42]);
      collide(px, pz, 0.6, 0.6, 1.1);
    }
    if (!savanna) acUnits(cx, cz, w, depth, H, faceDir);
    collide(cx, cz, w, depth, H + 1);
  }

  function safari4x4(x: number, z: number, fd: number) {
    const body = colorMat(savanna ? "#d8cfb8" : "#e9e7e1", 0.5, 0.2);
    box(body, x, 0.95, z, 1.85, 0.9, 4.4);
    box(body, x, 1.75, z - fd * 0.35, 1.75, 0.75, 2.9);
    box(M.glass, x, 1.78, z + fd * 1.11, 1.6, 0.55, 0.04);
    for (const sx of [-1, 1]) box(M.glass, x + sx * 0.88, 1.78, z - fd * 0.35, 0.02, 0.5, 2.6);
    box(M.darkMetal, x, 2.2, z - fd * 0.35, 1.7, 0.08, 2.7);
    box(colorMat("#3a3a3a", 0.6), x, 2.35, z - fd * 0.6, 1.3, 0.25, 1.2); // luggage
    box(M.darkMetal, x, 0.8, z + fd * 2.25, 1.9, 0.5, 0.12);
    batch.add(G.cyl, M.black, [x, 1.15, z - fd * 2.3], [Math.PI / 2, 0, 0], [0.38, 0.25, 0.38]);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) batch.add(G.cyl, M.black, [x + sx * 0.88, 0.4, z + sz * 1.4], [0, 0, Math.PI / 2], [0.4, 0.3, 0.4]);
    collide(x, z, 2, 4.7, 2.4);
  }
  function pragya(x: number, z: number, fd: number) {
    const c = colorMat(pick(["#C8452C", "#2E6FAE", "#F2B705", "#1F7A4D"]), 0.45, 0.2);
    box(c, x, 1.05, z + fd * 0.95, 1.1, 1.0, 0.9);
    box(M.glass, x, 1.35, z + fd * 1.41, 0.95, 0.45, 0.03);
    box(M.darkMetal, x, 1.9, z + fd * 0.1, 1.25, 0.06, 2.6);
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 0.3], [1, 0.3]]) box(M.darkMetal, x + sx * 0.58, 1.25, z + fd * sz, 0.05, 1.3, 0.05);
    box(colorMat("#2b2b2b", 0.8), x, 0.7, z - fd * 0.4, 1.15, 0.2, 1.4);
    box(c, x, 0.6, z - fd * 0.4, 1.2, 0.1, 1.5);
    batch.add(G.cyl, M.black, [x, 0.3, z + fd * 1.3], [0, 0, Math.PI / 2], [0.3, 0.14, 0.3]);
    for (const sx of [-1, 1]) batch.add(G.cyl, M.black, [x + sx * 0.6, 0.3, z - fd * 0.8], [0, 0, Math.PI / 2], [0.3, 0.14, 0.3]);
    collide(x, z, 1.4, 2.9, 1.9);
  }
  function motorbike(x: number, z: number, ry: number) {
    const c = colorMat(pick(["#b0161e", "#1d1d1f", "#2E6FAE", "#c9c9c9"]), 0.4, 0.4);
    const cs = Math.cos(ry), sn = Math.sin(ry);
    const at = (along: number): [number, number] => [x + cs * along, z - sn * along];
    for (const a of [-0.65, 0.65]) {
      const [wx, wz] = at(a);
      batch.addMatrix(G.cyl, M.black, new THREE.Matrix4().makeTranslation(wx, 0.32, wz).multiply(new THREE.Matrix4().makeRotationY(ry)).multiply(new THREE.Matrix4().makeRotationX(Math.PI / 2)).multiply(new THREE.Matrix4().makeScale(0.31, 0.1, 0.31)));
    }
    const [bx, bz] = at(0);
    batch.add(G.box, c, [bx, 0.62, bz], [0, ry, 0], [1.0, 0.3, 0.28]);
    batch.add(G.box, M.black, [at(-0.2)[0], 0.82, at(-0.2)[1]], [0, ry, 0], [0.6, 0.1, 0.26]);
    const [hx, hz] = at(0.55);
    batch.add(G.box, M.darkMetal, [hx, 1.0, hz], [0, ry, 0], [0.06, 0.06, 0.7]);
    batch.add(G.box, M.darkMetal, [hx, 0.7, hz], [0, ry, 0.35], [0.05, 0.6, 0.05]);
    collide(x, z, 1.2, 1.2, 1.1);
  }
  /** Day-trip desk: a kiosk, a signboard of destinations and the trip vehicle. */
  function tourDesk(p: Place, cx: number, cz: number, w: number, depth: number, h: number, faceDir: number) {
    const front = cz + faceDir * (depth / 2);
    const kw = Math.min(3.6, w * 0.45), kd = 2.8, kh = Math.min(Math.max(2.8, h - 0.4), 3.2);
    const kz = front - faceDir * (kd / 2 + 0.3);
    const km = savanna ? mudMat(p.color) : std({ map: T.corrugated(false), color: p.color, roughness: 0.6, metalness: 0.3 });
    box(km, cx, kh / 2, kz, kw, kh, kd);
    box(M.roofRust, cx, kh + 0.05, kz + faceDir * 0.35, kw + 0.6, 0.08, kd + 1.1);
    box(colorMat("#1a1714", 0.9), cx, 1.4, kz + faceDir * (kd / 2 + 0.01), kw - 0.8, 1.0, 0.04);
    box(M.wood, cx, 0.95, kz + faceDir * (kd / 2 + 0.2), kw - 0.6, 0.06, 0.4);
    const [signText, sub] = p.sign.split(" • ");
    box(signMat(signText, "#1F7A4D", "#ffffff", sub ?? "DAY TRIPS • SAFARIS • FESTIVALS"), cx, kh + 0.5, kz + faceDir * (kd / 2 + 0.1), kw + 0.6, Math.min(0.8, (kw + 0.6) / 5.3), 0.06);
    collide(cx, kz, kw, kd, kh + 0.8);
    if (w >= 7.5) {
      // Destination board on posts.
      const sx = cx - w / 2 + 1.1, sz = front - faceDir * 0.7;
      box(signMat("DAY TRIPS", "#F2B705", "#111111", savanna ? "SAFARI • MOSQUES • CROCODILES" : "WATERFALLS • MONKEYS • FORESTS"), sx, 2.1, sz, 1.9, 0.9, 0.06);
      for (const k of [-1, 1]) box(M.wood, sx + k * 0.8, 1.2, sz - faceDir * 0.05, 0.1, 2.4, 0.1);
      collide(sx, sz, 2, 0.4, 2.6);
      const vx = cx + w / 2 - 1.25;
      if (savanna || depth >= 6) safari4x4(vx, front - faceDir * 2.6, faceDir);
      else pragya(vx, front - faceDir * 1.8, faceDir);
    }
  }

  /** Woven mat on the ground with calabashes and baskets of goods; optional grass-mat shade. */
  function matStall(x: number, z: number, shadeRoof: boolean, y0 = 0.03) {
    batch.add(G.plane, M.mat, [x, y0 + 0.01, z], [-Math.PI / 2, 0, 0], [1.9, 1.3, 1]);
    const goods = ["#f3ead8", "#7a4a2b", "#c0392b", "#e2c25a", "#3c6e2f", "#2b2b2b"];
    for (let i = 0; i < 4; i++) {
      const gx = x - 0.6 + (i % 2) * 0.55 + (i > 1 ? 0.3 : 0), gz = z - 0.3 + (i > 1 ? 0.55 : 0);
      batch.add(G.sphere, M.calabash, [gx, y0 + 0.07, gz], [0, 0, 0], [0.28, 0.14, 0.28]);
      batch.add(G.sphere, colorMat(pick(goods), 0.8), [gx, y0 + 0.14, gz], [0, 0, 0], [0.22, 0.08, 0.22]);
    }
    const basket = colorMat("#b8955a", 0.95);
    batch.add(G.cyl8, basket, [x + 0.65, y0 + 0.18, z - 0.25], [0, 0, 0], [0.24, 0.36, 0.24]);
    batch.add(G.cyl8, colorMat(pick(["#c0392b", "#1F7A4D", "#2E6FAE"]), 0.9), [x + 0.65, y0 + 0.38, z - 0.25], [0, 0, 0], [0.26, 0.05, 0.26]);
    box(M.wood, x + 0.65, y0 + 0.15, z + 0.4, 0.4, 0.3, 0.3); // stool
    if (shadeRoof) {
      for (const [dx, dz] of [[-1, -0.8], [1, -0.8], [-1, 0.8], [1, 0.8]]) batch.add(G.cyl8, M.wood, [x + dx, y0 + 1.05, z + dz], [0, 0, 0], [0.04, 2.1, 0.04]);
      batch.add(G.box, M.mat, [x, y0 + 2.15, z], [0.06, 0, 0.04], [2.3, 0.05, 1.9]);
    }
    stalls.push(new THREE.Vector3(x, 0, z + (z > 0 ? -1.1 : 1.1)));
    if (!soundSpots.some((sp) => sp.kind === "market" && Math.hypot(sp.x - x, sp.z - z) < 18)) marketNoise(x, z, 0.7);
    collide(x, z, 2.1, 1.7, shadeRoof ? 2.2 : 0.5);
  }
  /** Open market sheds under rusty zinc, packed with tables (and mats up north). */
  function openMarket(p: Place, cx: number, cz: number, w: number, depth: number, faceDir: number) {
    const front = cz + faceDir * (depth / 2);
    const rows = depth >= 12 ? 2 : 1;
    const shedH = 3.3;
    const shedD = (depth - 2.2) / rows - 0.8;
    for (let r = 0; r < rows; r++) {
      const sz = front - faceDir * (1.6 + shedD / 2 + r * (shedD + 0.8));
      for (let px = cx - w / 2 + 0.3; px <= cx + w / 2 - 0.2; px += 3) {
        for (const e of [-1, 1]) box(M.wood, px, shedH / 2, sz + e * (shedD / 2 - 0.1), 0.15, shedH, 0.15);
      }
      batch.add(G.box, M.roofRust, [cx, shedH + 0.15, sz], [faceDir * 0.08, 0, 0], [w + 0.4, 0.06, shedD + 0.9]);
      for (let tx = cx - w / 2 + 1.4; tx < cx + w / 2 - 1; tx += 2.6) {
        for (const e of [-1, 1]) {
          const tz = sz + e * Math.min(1.25, shedD / 4);
          if (savanna && rnd() < 0.5) matStall(tx, tz, false);
          else stall(tx, tz, false);
        }
      }
      collide(cx, sz, w, shedD, shedH + 0.3);
    }
    const wm = savanna ? mudMat(p.color) : M.blocks;
    box(wm, cx, 0.9, cz - faceDir * (depth / 2 - 0.15), w, 1.8, 0.3);
    collide(cx, cz - faceDir * (depth / 2 - 0.15), w, 0.3, 1.8);
    const [signText, sub] = p.sign.split(" • ");
    const sw = Math.min(w * 0.5, 8);
    box(signMat(signText, savanna ? "#8C5A3C" : "#C8452C", "#fff6e0", sub), cx, 4.3, front - faceDir * 0.2, sw, Math.min(1.1, sw / 5.3), 0.08);
    for (const sx of [-1, 1]) {
      box(M.darkMetal, cx + sx * (sw / 2 - 0.2), 2.2, front - faceDir * 0.25, 0.12, 4.4, 0.12);
      collide(cx + sx * (sw / 2 - 0.2), front - faceDir * 0.25, 0.3, 0.3, 4.4);
    }
    // Sacks and basins at the front, and the plastic chairs of the food sellers.
    for (const sx of [-1, 1]) {
      const bx = cx + sx * (w / 2 - 1.6);
      for (let k = 0; k < 3; k++) batch.add(G.cyl8, colorMat(pick(["#efe7d6", "#d9cfb6", "#b8955a"]), 1), [bx + k * 0.55 - 0.55, 0.4, front - faceDir * 0.6], [0, rnd(), 0], [0.26, 0.8, 0.22]);
      collide(bx, front - faceDir * 0.6, 1.9, 0.6, 0.85);
    }
  }

  /** Round mud hut with a conical thatch roof. */
  function hut(x: number, z: number, r: number, color: string, side: number) {
    const wallH = 2.1 + rnd() * 0.3;
    batch.add(G.cyl, mudMat(color), [x, wallH / 2, z], [0, 0, 0], [r, wallH, r]);
    if (rnd() < 0.4) {
      // Painted band, Sirigu style.
      batch.add(G.cyl, colorMat("#2a1f1a", 0.9), [x, 0.35, z], [0, 0, 0], [r + 0.02, 0.7, r + 0.02]);
      batch.add(G.cyl, colorMat("#efe7da", 0.9), [x, 0.74, z], [0, 0, 0], [r + 0.025, 0.08, r + 0.025]);
      batch.add(G.cyl, colorMat("#9a3a22", 0.9), [x, 0.86, z], [0, 0, 0], [r + 0.02, 0.08, r + 0.02]);
    }
    box(colorMat("#2a1d14", 0.9), x, 0.8, z - side * (r - 0.02), 0.75, 1.55, 0.12);
    const rh = 1.5 + r * 0.35;
    batch.add(HUT_ROOF, M.thatch, [x, wallH + rh / 2 - 0.15, z], [0, rnd() * 3, 0], [r + 0.45, rh, r + 0.45]);
    batch.add(G.cone, colorMat("#6b5534", 1), [x, wallH + rh - 0.05, z], [0, 0, 0], [0.13, 0.4, 0.13]);
    collide(x, z, r * 2, r * 2, wallH + rh);
  }
  function granary(x: number, z: number, color: string) {
    for (const [dx, dz] of [[-0.4, -0.3], [0.4, -0.3], [0, 0.45]]) box(colorMat("#7a6a5a", 1), x + dx, 0.2, z + dz, 0.35, 0.4, 0.35);
    batch.add(G.cyl, mudMat(color), [x, 1.1, z], [0, 0, 0], [0.75, 1.4, 0.75]);
    batch.add(HUT_ROOF, M.thatch, [x, 2.15, z], [0, 0, 0], [1.0, 0.9, 1.0]);
    collide(x, z, 1.6, 1.6, 2.6);
  }
  /** A family compound: low mud walls around round huts, a granary and a flat-roofed room. */
  function compound(x: number, side: number, w: number, zFront = side * (BUILD_LINE + 0.4), cd = 10 + rnd() * 4) {
    const color = pick(d.palette.walls);
    const m = mudMat(color);
    const z0 = zFront, z1 = zFront + side * cd;
    const wh = 1.5 + rnd() * 0.3;
    const x0 = x - w / 2 + 0.4, x1 = x + w / 2 - 0.4;
    const gate = x + (rnd() - 0.5) * Math.max(0, w - 6);
    const seg = (a: number, b: number, zz: number) => {
      if (b - a < 0.2) return;
      box(m, (a + b) / 2, wh / 2, zz, b - a, wh, 0.3);
      colliders.push({ minX: a, maxX: b, minZ: zz - 0.18, maxZ: zz + 0.18, h: wh });
    };
    seg(x0, gate - 0.9, z0);
    seg(gate + 0.9, x1, z0);
    seg(x0, x1, z1);
    for (const xx of [x0, x1]) {
      box(m, xx, wh / 2, (z0 + z1) / 2, 0.3, wh, cd);
      colliders.push({ minX: xx - 0.18, maxX: xx + 0.18, minZ: Math.min(z0, z1), maxZ: Math.max(z0, z1), h: wh });
    }
    // Flat-roofed room along the back wall.
    const rw = Math.min(w * 0.5, 6), rz = z1 - side * 1.8;
    const rx = x + (rnd() < 0.5 ? -1 : 1) * (w / 2 - rw / 2 - 0.6);
    batch.add(facadeBox(rw, 2.8, 3), facadeMat(color, "small"), [rx, 1.4, rz]);
    mudParapet(rx, rz, rw, 3, 2.8, color);
    collide(rx, rz, rw, 3, 3.4);
    // Huts in front of it.
    const n = Math.max(1, Math.floor((w - 2) / 4.6));
    for (let i = 0; i < n; i++) {
      const hx = x0 + (x1 - x0) * ((i + 0.5) / n) + (rnd() - 0.5) * 0.6;
      const hz = z0 + side * (2.6 + rnd() * Math.max(0, cd - 8.2));
      if (Math.abs(hx - gate) < 2.2 && Math.abs(hz - z0) < 3) continue;
      hut(hx, hz, 1.5 + rnd() * 0.5, pick(d.palette.walls), side);
    }
    if (rnd() < 0.6) granary(rx - Math.sign(rx - x) * (rw / 2 + 1.4), rz, color);
    else shea(x0 + 1.2, z1 - side * 1.2, 0.8);
  }

  // Trees of the north and the middle belt.
  const up = new THREE.Vector3(0, 1, 0);
  function limb(m: THREE.Material, from: THREE.Vector3, dir: THREE.Vector3, len: number, r: number, geo: THREE.BufferGeometry = G.cyl8) {
    const q = new THREE.Quaternion().setFromUnitVectors(up, dir.clone().normalize());
    const pos = from.clone().addScaledVector(dir.clone().normalize(), len / 2);
    batch.addMatrix(geo, m, new THREE.Matrix4().compose(pos, q, new THREE.Vector3(r, len, r)));
    return from.clone().addScaledVector(dir.clone().normalize(), len);
  }
  function baobab(x: number, z: number, s = 1) {
    const th = (4.6 + rnd() * 1.4) * s;
    batch.add(BAOBAB_TRUNK, M.baobab, [x, th / 2, z], [0, rnd() * 3, 0], [1.35 * s, th, 1.35 * s]);
    const n = 6 + Math.floor(rnd() * 3);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + rnd() * 0.5, tilt = 0.6 + rnd() * 0.5;
      const dir = new THREE.Vector3(Math.sin(tilt) * Math.cos(a), Math.cos(tilt), Math.sin(tilt) * Math.sin(a));
      const end = limb(M.baobab, new THREE.Vector3(x, th - 0.4 * s, z), dir, (2.2 + rnd() * 1.6) * s, 0.24 * s);
      // A twig or two and a thin crown: the dry-season look.
      const end2 = limb(M.baobab, end, new THREE.Vector3(dir.x, dir.y + 0.8, dir.z), 1.1 * s, 0.09 * s);
      if (rnd() < 0.65) batch.add(G.ico, M.savLeaf, [end2.x, end2.y + 0.2, end2.z], [rnd(), rnd(), rnd()], [0.9 * s, 0.5 * s, 0.9 * s]);
    }
    collide(x, z, 2.5 * s, 2.5 * s, th);
  }
  function shea(x: number, z: number, s = 1) {
    const th = (2.2 + rnd() * 0.6) * s;
    const top = limb(colorMat("#3e3128", 1), new THREE.Vector3(x, 0, z), new THREE.Vector3((rnd() - 0.5) * 0.2, 1, (rnd() - 0.5) * 0.2), th, 0.2 * s);
    for (let i = 0; i < 3; i++) {
      const a = rnd() * Math.PI * 2;
      const end = limb(colorMat("#3e3128", 1), top, new THREE.Vector3(Math.cos(a), 1.1, Math.sin(a)), 1.4 * s, 0.1 * s);
      batch.add(G.ico, i % 2 ? M.darkLeaf : M.savLeaf, [end.x, end.y + 0.3 * s, end.z], [rnd(), rnd(), rnd()], [1.4 * s, 0.95 * s, 1.4 * s]);
    }
    batch.add(G.ico, M.darkLeaf, [top.x, top.y + 1.3 * s, top.z], [rnd(), rnd(), rnd()], [1.3 * s, 0.9 * s, 1.3 * s]);
    collide(x, z, 0.5, 0.5, th + 2);
  }
  function mango(x: number, z: number, s = 1) {
    batch.add(G.cyl8, M.trunk, [x, 1.1 * s, z], [0, 0, (rnd() - 0.5) * 0.1], [0.26 * s, 2.2 * s, 0.26 * s]);
    for (let i = 0; i < 7; i++) {
      const a = rnd() * Math.PI * 2, r = (0.6 + rnd() * 1.3) * s;
      batch.add(G.ico, i % 3 ? M.darkLeaf : M.leaf, [x + Math.cos(a) * r, (3.1 + rnd() * 1.4) * s, z + Math.sin(a) * r], [rnd(), rnd(), rnd()], [1.9 * s, 1.5 * s, 1.9 * s]);
    }
    collide(x, z, 0.5, 0.5, 5 * s);
  }
  function plantain(x: number, z: number) {
    const n = 2 + Math.floor(rnd() * 2);
    for (let k = 0; k < n; k++) {
      const px = x + (rnd() - 0.5) * 1.2, pz = z + (rnd() - 0.5) * 1.2;
      const sh = 2 + rnd() * 1.2;
      batch.add(G.cyl8, colorMat("#6d7a3c", 0.9), [px, sh / 2, pz], [0, 0, 0], [0.12, sh, 0.12]);
      const m = new THREE.Matrix4();
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 + rnd();
        m.makeTranslation(px, sh - 0.1, pz)
          .multiply(new THREE.Matrix4().makeRotationY(a))
          .multiply(new THREE.Matrix4().makeRotationX(0.35 + rnd() * 0.6))
          .multiply(new THREE.Matrix4().makeScale(0.8, 1.7 + rnd() * 0.5, 1));
        batch.addMatrix(FROND, i % 2 ? M.plantainLeaf : M.leaf2, m);
      }
      if (rnd() < 0.4) batch.add(G.sphere, colorMat("#5b7f2a", 0.8), [px + 0.2, sh - 0.6, pz], [0, 0, 0], [0.22, 0.38, 0.22]);
    }
    collide(x, z, 1.2, 1.2, 3);
  }
  function tuft(x: number, z: number, y0 = 0) {
    for (let k = 0; k < 3; k++) batch.add(G.cone, M.dryGrass, [x + (rnd() - 0.5) * 0.5, y0 + 0.25, z + (rnd() - 0.5) * 0.5], [(rnd() - 0.5) * 0.4, 0, (rnd() - 0.5) * 0.4], [0.16, 0.5 + rnd() * 0.35, 0.16]);
  }

  /** Savanna street frontage: single-storey render houses and shops, and compounds of huts. */
  function savannaFiller(x: number, side: number, w: number) {
    if (w >= 9 && rnd() < 0.3) return compound(x, side, w);
    const depth = 7 + rnd() * 5;
    const storeys = rnd() < 0.85 ? 1 : 2;
    const h = storeys === 1 ? 3.1 + rnd() * 0.4 : 6.2;
    const cz = side * (BUILD_LINE + depth / 2), front = cz - side * (depth / 2);
    const color = pick(d.palette.walls);
    const ww = w - 0.6;
    batch.add(facadeBox(ww, h, depth), facadeMat(color, "small"), [x, h / 2, cz]);
    box(mudMat(shade(color, 0.68)), x, 0.4, front - side * 0.03, ww + 0.04, 0.8, 0.04);
    if (rnd() < 0.65) mudParapet(x, cz, ww, depth, h, color);
    else roofPitched(x, cz, ww, depth, h, true, 0.1, mudMat(color));
    if (rnd() < 0.2) tank(x + (rnd() - 0.5) * (ww - 3), cz + side * depth / 4, h + 0.3);
    if (rnd() < 0.55) {
      // A little shop: open doorway or shutter, a hand-painted board and a shade.
      const uw = Math.min(ww - 1.5, 5);
      const ux = x + (rnd() - 0.5) * (ww - uw - 1);
      const open = rnd() < 0.7;
      box(open ? colorMat("#1a1714", 0.9) : M.shutter, ux, 1.15, front - side * 0.02, uw - 0.6, 2.3, 0.05);
      const [bg, fg] = pick(SIGN_COLORS);
      box(signMat(pick(SAV_SIGNS), bg, fg, `0${Math.floor(20 + rnd() * 39)} ${Math.floor(100 + rnd() * 899)} ${Math.floor(1000 + rnd() * 8999)}`), ux, Math.min(h - 0.45, 2.75), front - side * 0.06, uw, Math.min(0.75, uw / 5.3), 0.06);
      if (rnd() < 0.5) {
        batch.add(G.box, M.mat, [ux, 2.4, front - side * 0.9], [side * 0.12, 0, 0], [uw + 0.6, 0.05, 1.8]);
        for (const k of [-1, 1]) batch.add(G.cyl8, M.wood, [ux + k * (uw / 2), 1.15, front - side * 1.7], [0, 0, 0], [0.04, 2.3, 0.04]);
        collide(ux, front - side * 1.7, uw + 0.2, 0.2, 2.3);
      } else box(M.roofRust, ux, 2.35, front - side * 0.6, uw, 0.05, 1.1);
      if (open && rnd() < 0.25) music(ux, front, (["highlife", "afrobeats", "afrobeats"] as Genre[])[Math.floor(rnd() * 3)], 0.5, [9, 21]);
    } else {
      box(colorMat(pick(["#2f6f62", "#3b5d8c", "#6b3a2a"]), 0.6, 0.3), x + (rnd() - 0.5) * (ww - 3), 1.05, front - side * 0.03, 1.0, 2.1, 0.05);
      const bx = x + (rnd() - 0.5) * (ww - 3);
      box(M.wood, bx, 0.45, front - side * 0.45, 2, 0.08, 0.38);
      collide(bx, front - side * 0.45, 2.1, 0.45, 0.5);
    }
    if (rnd() < 0.35) motorbike(x + (rnd() - 0.5) * (ww - 2), front - side * 1.2, rnd() * 0.5 - 0.25);
    collide(x, cz, ww, depth, h + 0.6);
  }

  /** The eternal unfinished house: bare blocks, columns and rebar reaching for a second floor. */
  function unfinished(x: number, side: number, ww: number, depth: number) {
    const cz = side * (BUILD_LINE + depth / 2), front = cz - side * (depth / 2);
    const h1 = 3;
    const upper = rnd() < 0.6;
    batch.add(facadeBox(ww, h1, depth, 3), M.blocks, [x, h1 / 2, cz]);
    for (let k = -1; k <= 1; k++) box(colorMat("#1c1a18", 1), x + k * ww * 0.3, k === 0 ? 1.1 : 1.6, front - side * 0.02, k === 0 ? 1.1 : 1.2, k === 0 ? 2.2 : 1.1, 0.04);
    box(M.concrete, x, h1 + 0.12, cz, ww + 0.1, 0.25, depth + 0.1);
    const top = upper ? h1 + 3.25 : h1 + 0.25;
    for (const cxx of [x - ww / 2 + 0.2, x, x + ww / 2 - 0.2]) {
      for (const czz of [front - side * 0.2, cz + side * (depth / 2 - 0.2)]) {
        if (upper) box(M.concrete, cxx, h1 + 0.25 + 1.5, czz, 0.3, 3, 0.3);
        for (const [dx, dz] of [[-0.08, -0.08], [0.08, -0.08], [-0.08, 0.08], [0.08, 0.08]]) box(M.rebar, cxx + dx, top + 0.55, czz + dz, 0.025, 1.1, 0.025);
      }
    }
    if (upper) {
      box(M.blocks, x - ww / 4, h1 + 0.25 + 0.6, cz + side * (depth / 2 - 0.1), ww / 2, 1.2, 0.2);
      box(M.concrete, x, h1 + 3.25 + 0.1, front - side * 0.2, ww, 0.2, 0.3);
    }
    box(signMat("THIS HOUSE IS NOT FOR SALE", "#8d8a84", "#C8452C", "BEWARE OF FRAUDSTERS"), x, 2.4, front - side * 0.03, Math.min(ww - 1, 4.4), 0.7, 0.03);
    // A stack of new blocks and a heap of sand by the wall.
    const sx = x + ww / 2 - 1.1;
    for (let k = 0; k < 3; k++) box(M.blocks, sx, 0.13 + k * 0.23, front - side * 0.55, 1.4, 0.22, 0.45);
    batch.add(G.cone, std({ map: T.sand(), roughness: 1 }), [x - ww / 2 + 1.3, 0.35, front - side * 0.8], [0, 0, 0], [1, 0.7, 0.7]);
    collide(sx, front - side * 0.55, 1.5, 0.5, 0.75);
    collide(x - ww / 2 + 1.3, front - side * 0.8, 1.8, 1.2, 0.7);
    collide(x, cz, ww, depth, upper ? h1 + 3.4 : h1 + 1.4);
  }
  /** Middle-belt town frontage: colourful 1–2 storey buildings under rusty zinc, and plenty of unfinished ones. */
  function townFiller(x: number, side: number, w: number) {
    const depth = 8 + rnd() * 5;
    const ww = w - 0.6;
    if (rnd() < 0.2) return unfinished(x, side, ww, depth);
    const cz = side * (BUILD_LINE + depth / 2), front = cz - side * (depth / 2);
    const storeys = rnd() < 0.55 ? 1 : 2;
    const h = storeys * 3.1;
    const momo = rnd() < 0.1;
    const color = momo ? "#F2C200" : wallColor();
    batch.add(facadeBox(ww, h, depth), facadeMat(color, "louvre"), [x, h / 2, cz]);
    relief("louvre", x, cz, ww, h, depth, -side);
    box(colorMat(shade(color, 0.6), 0.9), x, 0.45, front - side * 0.03, ww + 0.04, 0.9, 0.04);
    if (rnd() < 0.85) roofPitched(x, cz, ww, depth, h, rnd() < 0.85, 0.3, facadeMat(color, "louvre"));
    else {
      parapet(x, cz, ww, depth, h);
      tank(x + (rnd() - 0.5) * (ww - 3), cz + side * depth / 4, h);
    }
    if (storeys === 2 && rnd() < 0.5) {
      // Upstairs verandah with a painted railing.
      box(M.concrete, x, 3.1, front - side * 0.7, ww - 0.6, 0.18, 1.4);
      box(colorMat(pick(["#f3f1ea", "#2e6fae", "#1F7A4D"]), 0.7), x, 4.0, front - side * 1.35, ww - 0.6, 0.08, 0.08);
      for (let k = -ww / 2 + 0.5; k < ww / 2 - 0.3; k += 0.5) box(M.metal, x + k, 3.6, front - side * 1.35, 0.04, 0.8, 0.04);
    }
    if (momo) box(signMat("MOBILE MONEY", "#F2C200", "#1a1a1a", "CASH IN • CASH OUT • AIRTIME"), x, h - 0.7, front - side * 0.04, Math.min(ww - 1, 6), Math.min(1, (ww - 1) / 5.3), 0.03);
    const units = ww > 10.5 ? 2 : 1;
    for (let u = 0; u < units; u++) {
      const ux = x - ww / 2 + ((u + 0.5) * ww) / units;
      const uw = ww / units - 0.6;
      const open = rnd() < 0.7;
      if (open && rnd() < 0.3) music(ux, front, (["highlife", "gospel", "afrobeats", "afrobeats"] as Genre[])[Math.floor(rnd() * 4)], 0.7);
      box(open ? colorMat("#1a1714", 0.9) : M.shutter, ux, 1.2, front - side * 0.02, uw - 0.4, 2.4, 0.05);
      if (!(momo && units === 1)) {
        const [bg, fg] = pick(SIGN_COLORS);
        box(signMat(pick(TOWN_SIGNS), bg, fg, `0${Math.floor(20 + rnd() * 39)} ${Math.floor(100 + rnd() * 899)} ${Math.floor(1000 + rnd() * 8999)}`), ux, 2.95, front - side * 0.06, uw, Math.min(0.75, uw / 5.3), 0.06);
      }
      box(M.roofRust, ux, 2.6, front - side * 0.65, uw, 0.05, 1.2);
      if (open && rnd() < 0.4) plasticSet(ux + (rnd() - 0.5) * 2, front - side * 2.2);
    }
    acUnits(x, cz, ww, depth, h, -side);
    collide(x, cz, ww, depth, h + 1.6);
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
    if (savanna) return savannaFiller(x, side, w);
    if (town) return townFiller(x, side, w);
    const storeysByStyle = ({ urban: [1, 4], market: [1, 3], corporate: [2, 6], coastal: [1, 2], suburban: [2, 2], luxury: [2, 3], savanna: [1, 1], town: [1, 2] } satisfies Record<DistrictStyle, [number, number]>)[style];
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
    if (!glassy) relief(style === "corporate" ? "modern" : "louvre", x, cz, w - 0.6, h, depth, -side);
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
    // Upper floors: balconies with railings (and washing), window frames with burglar bars.
    for (let f = 1; f < storeys && !glassy; f++) {
      const y = f * 3;
      if (rnd() < 0.55) {
        const bw = Math.min(w - 2, 3 + rnd() * 3), bx = x + (rnd() - 0.5) * (w - bw - 1.2);
        box(M.concrete, bx, y, front - side * 0.6, bw, 0.14, 1.2);
        box(M.darkMetal, bx, y + 0.55, front - side * 1.18, bw, 0.04, 0.04);
        for (let k = 0; k <= bw / 0.3; k++) box(M.darkMetal, bx - bw / 2 + k * 0.3, y + 0.28, front - side * 1.18, 0.025, 0.55, 0.025);
        if (rnd() < 0.5) for (let k = 0; k < 4; k++) box(colorMat(["#C8452C", "#1F5AA6", "#F2B705", "#ffffff", "#2E7D4F"][Math.floor(rnd() * 5)], 0.9), bx - bw / 2 + 0.5 + k * (bw - 1) / 3, y + 0.75, front - side * 1.15, 0.4, 0.5, 0.02);
        // Balcony door.
        box(colorMat("#5b3a29", 0.6), bx, y + 1.1, front - side * 0.03, 0.9, 2.1, 0.05);
      }
      for (let k = 0; k < Math.floor((w - 1) / 3); k++) {
        const wx = x - (w - 0.6) / 2 + 1.5 + k * 3;
        box(M.white, wx, y + 1.5, front - side * 0.05, 1.3, 1.25, 0.05);
        for (let b = 1; b < 5; b++) box(M.darkMetal, wx - 0.65 + b * 0.26, y + 1.5, front - side * 0.09, 0.025, 1.15, 0.025);
      }
    }
    if (!glassy && storeys >= 2 && rnd() < 0.5) {
      // Satellite dish on the roof.
      batch.add(G.sphere, M.white, [x + (rnd() - 0.5) * (w - 3), h + 0.9, cz + side * 1.5], [0.6, 0, 0], [0.45, 0.45, 0.12]);
      box(M.metal, x, h + 0.4, cz + side * 1.5, 0.06, 0.8, 0.06);
    }
    // Residential buildings without a shop get a proper front door with steps.
    if (style === "coastal" && rnd() < 0.5) {
      box(colorMat("#4a2f1e", 0.6), x, 1.05, front - side * 0.04, 1.0, 2.1, 0.06);
      box(M.white, x, 2.2, front - side * 0.05, 1.2, 0.12, 0.08);
      box(M.concrete, x, 0.08, front - side * 0.45, 1.6, 0.16, 0.8);
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
        const gap = rnd() < 0.28 ? 2.6 + rnd() * 3 : 0.2;
        if (gap > 1) {
          // An alley / walkway between buildings, paved, running back from the pavement.
          const ax = x + w + gap / 2;
          batch.add(tiledPlane(gap, 16, 3), M.walk, [ax, 0.12, side * (BUILD_LINE + 8)], [-Math.PI / 2, 0, 0]);
          if (upscale || rnd() < 0.3) {
            // Covered walkway (campus-style): posts and a light roof.
            for (let k = 0; k < 4; k++) box(M.white, ax - gap / 2 + 0.2, 1.3, side * (BUILD_LINE + 1.5 + k * 4), 0.12, 2.6, 0.12);
            box(M.roofClean, ax, 2.7, side * (BUILD_LINE + 7.5), gap - 0.2, 0.08, 15);
          }
        }
        x += w + gap;
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
  const hx = home.x, hs = home.side;
  const front = hs * (BUILD_LINE + 0.4);
  const gate = (w: number, color: string) => {
    // Sliding metal gate with a pedestrian door, set in the compound wall.
    box(colorMat(color, 0.45, 0.5), hx, 1.25, front, w, 2.5, 0.08);
    for (let i = 0; i < Math.floor(w / 0.25); i++) box(colorMat("#1d1d1f", 0.4, 0.6), hx - w / 2 + 0.12 + i * 0.25, 1.25, front - hs * 0.05, 0.03, 2.4, 0.03);
  };
  if (homeTier && id !== "kaneshie") {
    const wall = (color: string, h = 2.4) => compoundWall(hx - 7, hx + 7, front, h, hx, color);
    switch (homeTier) {
      case "compound_room":
      case "chamber_hall": {
        // Long single-storey compound house: rooms in a row, zinc roof, courtyard gate.
        const z = hs * (BUILD_LINE + 6);
        batch.add(facadeBox(13, 3.2, 9), facadeMat("#D9C9A3", "small"), [hx, 1.6, z]);
        roofPitched(hx, z, 13, 9, 3.2, true);
        for (let i = -2; i <= 2; i++) box(colorMat(["#1F7A4D", "#B03A62", "#2E86AB", "#E3A857", "#5b3a29"][i + 2], 0.7), hx + i * 2.4, 1.05, z - hs * 4.52, 0.85, 2.1, 0.05);
        collide(hx, z, 13, 9, 4);
        break;
      }
      case "northern_room": {
        for (const [dx, dz, r] of [[-3, 5, 2.2], [2.5, 6.5, 2.4], [0, 9.5, 2]] as const) {
          const cz = hs * (BUILD_LINE + dz);
          batch.add(G.cyl, colorMat("#b7834f", 1), [hx + dx, 1.1, cz], [0, 0, 0], [r, 2.2, r]);
          batch.add(G.cone, colorMat("#c8a86a", 1), [hx + dx, 2.9, cz], [0, 0, 0], [r * 1.25, 1.5, r * 1.25]);
          collide(hx + dx, cz, r * 2, r * 2, 3);
        }
        break;
      }
      case "self_contained":
      case "flat":
      case "apartment": {
        // Apartment block: three or four storeys, balconies, a gate.
        const storeys = homeTier === "apartment" ? 4 : 3, h = storeys * 3, z = hs * (BUILD_LINE + 6.5);
        batch.add(facadeBox(13, h, 10), facadeMat(homeTier === "apartment" ? "#EFE6D6" : "#E8D5B5", "louvre"), [hx, h / 2, z]);
        for (let f = 1; f < storeys; f++) {
          box(colorMat("#d8d0c2", 0.7), hx, f * 3, z - hs * 5.6, 12, 0.15, 1.2);
          box(colorMat("#2b2b2b", 0.4, 0.6), hx, f * 3 + 0.55, z - hs * 6.15, 12, 1.0, 0.04);
        }
        box(colorMat("#2E86AB", 0.5, 0.4), hx + 4, h + 0.8, z, 1.4, 1.6, 1.4); // polytank on the roof
        collide(hx, z, 13, 10, h);
        wall("#e9e3d6", 2.2);
        gate(4, "#2b3440");
        break;
      }
      case "townhouse":
        wall("#e9e3d6", 2.4);
        villa(hx, hs * (BUILD_LINE + 8.5), 11, 9, 2, "#F2E2C4", hs);
        gate(4, "#3a2a22");
        break;
      case "villa":
        wall("#f1e9da", 2.6);
        villa(hx, hs * (BUILD_LINE + 9), 12, 10, 2, "#FAF7F0", hs);
        gate(4.5, "#1d1d1f");
        break;
      case "mansion": {
        wall("#f4ede0", 3.2);
        villa(hx, hs * (BUILD_LINE + 9.5), 13.5, 11, 3, "#FAF7F0", hs);
        gate(5, "#b08d57");
        // Gatehouse with a guard light, columns at the porch.
        box(colorMat("#EDE6D6", 0.8), hx - 5.5, 1.5, hs * (BUILD_LINE + 2), 2.2, 3, 2.2);
        collide(hx - 5.5, hs * (BUILD_LINE + 2), 2.2, 2.2, 3);
        for (const dx of [-2.5, 2.5]) batch.add(G.cyl, colorMat("#ffffff", 0.5), [hx + dx, 3, hs * (BUILD_LINE + 3.6)], [0, 0, 0], [0.3, 6, 0.3]);
        break;
      }
      case "penthouse": {
        // Glass residential tower; your penthouse is the lit top floor.
        const h = 39, z = hs * (BUILD_LINE + 7);
        batch.add(facadeBox(13, h, 11), facadeMat("#8DA9C4", "glass"), [hx, h / 2, z]);
        box(colorMat("#fff2c4", 0.3), hx, h - 1.5, z - hs * 5.52, 12.6, 2.6, 0.05);
        box(colorMat("#2b2b2b", 0.3, 0.6), hx, h + 0.6, z, 13.4, 0.3, 11.4);
        collide(hx, z, 13, 11, h);
        box(colorMat("#cfd3d6", 0.5), hx, 1.6, hs * (BUILD_LINE + 1.4), 6, 0.2, 2.4); // entrance canopy
        break;
      }
    }
  } else if (id !== "kaneshie") {
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
      // Kumasi is the Garden City: noticeably more shade trees along its pavements.
      const r = rnd() - (d.city === "kumasi" ? 0.2 : 0);
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
  if (id === "airport_city") {
    // Behind the office blocks: apron, runway, control tower, hangar and parked aircraft.
    const apronZ = -77;
    batch.add(tiledPlane(240, 26, 8), colorMat("#8f9093", 0.85), [0, 0.03, apronZ], [-Math.PI / 2, 0, 0]);
    batch.add(G.plane, colorMat("#34353a", 0.9), [0, 0.04, apronZ - 18], [-Math.PI / 2, 0, 0], [240, 10, 1]);
    for (let x = -116; x < 116; x += 9) box(M.white, x, 0.05, apronZ - 18, 4.5, 0.01, 0.3);
    for (const z of [apronZ - 13.2, apronZ - 22.8]) box(M.white, 0, 0.05, z, 236, 0.01, 0.2);
    box(M.yellowLine, 0, 0.045, apronZ - 6, 230, 0.01, 0.25);
    const chainLink = std({ color: "#b8bec4", roughness: 0.5, metalness: 0.6, transparent: true, opacity: 0.28, depthWrite: false });
    // Airside security fence with a gate where the road meets the apron.
    for (const sx of [-1, 1]) {
      const x0 = sx * 7, x1 = sx * 118, cx = (x0 + x1) / 2, w = Math.abs(x1 - x0);
      box(chainLink, cx, 1.2, apronZ + 13.2, w, 2.4, 0.05);
      for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x += 4) box(M.concrete, x, 1.3, apronZ + 13.2, 0.12, 2.6, 0.12);
      collide(cx, apronZ + 13.2, w, 0.4, 2.6);
    }
    box(M.signalYellow ?? M.yellowLine, 0, 1.1, apronZ + 13.2, 12, 0.18, 0.18);
    collide(0, apronZ + 13.2, 14, 0.4, 2.6);
    // Control tower.
    batch.add(G.cyl, colorMat("#e9e6e0", 0.7), [104, 14, apronZ + 4], [0, 0, 0], [2.4, 28, 2.4]);
    batch.add(G.cyl, colorMat("#2b3440", 0.1, 0.3), [104, 29.5, apronZ + 4], [0, 0, 0], [4.4, 3.2, 4.4]);
    batch.add(G.cyl, colorMat("#e9e6e0", 0.7), [104, 31.4, apronZ + 4], [0, 0, 0], [4.8, 0.6, 4.8]);
    collide(104, apronZ + 4, 4.6, 4.6, 30);
    // Private hangar, doors open towards the city.
    box(colorMat("#cfd3d6", 0.5, 0.5), -62, 6, apronZ, 34, 12, 22);
    box(colorMat("#2a2c30", 0.9), -62, 5, apronZ + 11.05, 26, 10, 0.1);
    box(M.white, -62, 11, apronZ + 11.1, 30, 1.2, 0.1);
    collide(-62, apronZ, 34, 22, 12);
    labelSprite("General Aviation Hangars", "🛩️", 13.5, -62, apronZ + 11.5);
    // Airliners and a turboprop at the stands.
    for (const [x, kind, liv, stripe] of [[22, "airliner", "#f4f4f2", "#1F7A4D"], [66, "airliner", "#f4f4f2", "#C8452C"], [-26, "turboprop", "#f4f4f2", "#F2B705"]] as const) {
      const a = buildAircraft(kind, liv, stripe);
      a.position.set(x, 0, apronZ + 1);
      a.rotation.y = -Math.PI / 2;
      group.add(a);
      collide(x, apronZ + 1, kind === "airliner" ? 38 : 14, kind === "airliner" ? 30 : 16, 8);
    }
  }
  if (d.style === "luxury" || d.style === "suburban") {
    // Gated estate entrance across the main road: gatehouse, boom barriers, a
    // big sign, and a perimeter wall with railings along the estate.
    const ex = -EXTENT_X + 14;
    const estate = d.style === "luxury" ? "TRASACCO VALLEY ESTATE" : `${d.name.toUpperCase()} GARDENS ESTATE`;
    for (const s2 of [-1, 1]) {
      box(colorMat("#efe6d6", 0.8), ex, 2.2, s2 * (ROAD_HALF + 3.4), 1.6, 4.4, 1.6); // pillars
      box(colorMat("#b08d57", 0.4, 0.6), ex, 4.5, s2 * (ROAD_HALF + 3.4), 1.8, 0.25, 1.8);
      collide(ex, s2 * (ROAD_HALF + 3.4), 1.6, 1.6, 4.4);
      // Boom barrier (raised, so traffic and you can pass).
      box(M.darkMetal, ex + 1.2, 0.6, s2 * (ROAD_HALF - 0.4), 0.3, 1.2, 0.3);
      batch.add(G.box, colorMat("#d8261c", 0.6), [ex + 1.2, 2.8, s2 * (ROAD_HALF - 0.4)], [0, 0, 1.25], [4.6, 0.12, 0.12]);
    }
    box(signMat(estate, "#1F3A2A", "#E8C670", "WELCOME • RESIDENTS & GUESTS"), ex, 5.4, 0, 0.2, 1.1, ROAD_HALF * 2 + 6);
    box(colorMat("#b08d57", 0.4, 0.6), ex, 4.75, 0, 0.3, 0.2, ROAD_HALF * 2 + 7);
    // Gatehouse with a window.
    const ghz = -(ROAD_HALF + 6.5);
    box(colorMat("#efe6d6", 0.8), ex - 1, 1.5, ghz, 3.2, 3, 3);
    box(colorMat("#2b3440", 0.1), ex + 0.62, 1.7, ghz, 0.04, 1.0, 1.8);
    box(M.roofClean, ex - 1, 3.1, ghz, 3.8, 0.2, 3.6);
    collide(ex - 1, ghz, 3.2, 3, 3);
    labelSprite("Estate security", "🛡️", 3.9, ex - 1, ghz);
    // Perimeter walls with railings behind the pavements, west of the gate.
    for (const s2 of [-1, 1]) {
      box(colorMat("#efe6d6", 0.8), -EXTENT_X + 4, 1.1, s2 * (WALK_OUT + 0.4), 20, 2.2, 0.3);
      for (let x = -EXTENT_X - 5; x < ex - 2; x += 0.35) box(M.darkMetal, x, 2.6, s2 * (WALK_OUT + 0.4), 0.03, 0.9, 0.03);
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
    trafficLight: { phase, amber, mats: tl },
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
