// Vehicles: sedans, Accra taxis (yellow corner panels), trotros with painted
// slogans, SUVs and the V8. Rounded bodies, clear-coat paint, glass, rims.
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { toCreasedNormals } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { plate, signboard, surfaceDetail, trotroLivery } from "./textures.ts";
import { mulberry32 } from "../../shared/rng.ts";
import { realCar } from "./carmodels.ts";

export type VehicleKind =
  | "sedan" | "taxi" | "trotro" | "suv" | "v8" | "pickup" | "compact" | "accordo" | "saloon" | "supercar" | "phantom"
  | "motorbike" | "pragya" | "aboboyaa" | "bicycle";

/** Map a shop catalogue model (shared/life.ts) to a 3D vehicle kind. */
export function vehicleKindForModel(model: string): VehicleKind {
  const known: VehicleKind[] = ["sedan", "taxi", "trotro", "suv", "v8", "pickup", "compact", "accordo", "saloon", "supercar", "phantom", "motorbike", "pragya", "aboboyaa", "bicycle"];
  return (known as string[]).includes(model) ? (model as VehicleKind) : "sedan";
}
export const isTwoWheeler = (k: VehicleKind) => k === "motorbike" || k === "bicycle";
export const isSmallVehicle = (k: VehicleKind) => isTwoWheeler(k) || k === "pragya" || k === "aboboyaa";

export interface VehicleRig {
  group: THREE.Group;
  wheels: THREE.Object3D[];
  lights: THREE.MeshStandardMaterial[];
  brake: THREE.MeshStandardMaterial;
  kind: VehicleKind;
  length: number;
  width: number;
}

const paints = new Map<string, THREE.MeshPhysicalMaterial>();
let paintClearcoatNormal: THREE.Texture | null = null;
let tireTreadNormal: THREE.Texture | null = null;

/** Fine orange-peel variation keeps clear-coat highlights from looking like plastic. */
function clearcoatNormal() {
  if (paintClearcoatNormal) return paintClearcoatNormal;
  const size = 96;
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const ctx = c.getContext("2d")!;
  const image = ctx.createImageData(size, size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const value = 128 + Math.sin(x * 0.43 + Math.sin(y * 0.19) * 1.8) * 8 + Math.cos(y * 0.37 + Math.sin(x * 0.23)) * 6;
    const i = (y * size + x) * 4;
    image.data[i] = image.data[i + 1] = image.data[i + 2] = value;
    image.data[i + 3] = 255;
  }
  ctx.putImageData(image, 0, 0);
  const source = new THREE.CanvasTexture(c);
  source.wrapS = source.wrapT = THREE.RepeatWrapping;
  source.repeat.set(12, 12);
  paintClearcoatNormal = surfaceDetail(source, 4).normalMap;
  return paintClearcoatNormal;
}

/** Shallow diagonal tread blocks give the tire crown detail at close range. */
function tireNormal() {
  if (tireTreadNormal) return tireTreadNormal;
  const size = 128;
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const ctx = c.getContext("2d")!;
  const image = ctx.createImageData(size, size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const row = Math.floor(y / 16);
    const groove = ((x + (row % 2) * 8 + y * 0.38) % 24 + 24) % 24;
    const shoulder = Math.min(x, size - x, y, size - y);
    const value = shoulder < 5 ? 105 : groove < 2.4 ? 64 : groove > 11 && groove < 13 ? 92 : 142;
    const i = (y * size + x) * 4;
    image.data[i] = image.data[i + 1] = image.data[i + 2] = value;
    image.data[i + 3] = 255;
  }
  ctx.putImageData(image, 0, 0);
  const source = new THREE.CanvasTexture(c);
  source.wrapS = source.wrapT = THREE.RepeatWrapping;
  source.repeat.set(2, 2);
  tireTreadNormal = surfaceDetail(source, 2.5).normalMap;
  return tireTreadNormal;
}

function paint(color: string) {
  let m = paints.get(color);
  if (!m) {
    m = new THREE.MeshPhysicalMaterial({
      color,
      metalness: 0.38,
      roughness: 0.32,
      clearcoat: 1,
      clearcoatRoughness: 0.14,
      clearcoatNormalMap: clearcoatNormal(),
      clearcoatNormalScale: new THREE.Vector2(0.28, 0.28),
    });
    paints.set(color, m);
  }
  return m;
}
const glass = new THREE.MeshPhysicalMaterial({ color: "#18232a", metalness: 0.08, roughness: 0.12, clearcoat: 0.65, clearcoatRoughness: 0.12, envMapIntensity: 1.6 });
const rubber = new THREE.MeshStandardMaterial({ color: "#151515", roughness: 0.96, normalScale: new THREE.Vector2(0.22, 0.22) });
const chrome = new THREE.MeshStandardMaterial({ color: "#d8dde2", metalness: 1, roughness: 0.18 });
const alloy = new THREE.MeshStandardMaterial({ color: "#9aa1a8", metalness: 0.9, roughness: 0.3 });
const black = new THREE.MeshStandardMaterial({ color: "#0e0e10", roughness: 0.55 });
const amber = new THREE.MeshStandardMaterial({ color: "#ff9a1a", emissive: "#ff7a00", emissiveIntensity: 0.25, roughness: 0.2 });
const yellow = new THREE.MeshPhysicalMaterial({ color: "#f2c200", metalness: 0.3, roughness: 0.35, clearcoat: 1 });

const geoCache = new Map<string, THREE.BufferGeometry>();
function rbox(w: number, h: number, l: number, r: number) {
  const k = `${w}:${h}:${l}:${r}`;
  let g = geoCache.get(k);
  if (!g) {
    g = new RoundedBoxGeometry(w, h, l, 3, r);
    geoCache.set(k, g);
  }
  return g;
}
const tireGeo = new THREE.CylinderGeometry(1, 1, 1, 40);
tireGeo.rotateZ(Math.PI / 2);
const rimGeo = new THREE.CylinderGeometry(1, 1, 1, 24);
rimGeo.rotateZ(Math.PI / 2);
const spokeGeo = new THREE.BoxGeometry(1, 1, 1);

function mesh(g: THREE.BufferGeometry, m: THREE.Material, x = 0, y = 0, z = 0) {
  const o = new THREE.Mesh(g, m);
  o.position.set(x, y, z);
  o.castShadow = true;
  o.receiveShadow = true;
  return o;
}

function wheel(r: number, w: number) {
  const g = new THREE.Group();
  const t = mesh(tireGeo, rubber);
  t.scale.set(w, r, r);
  g.add(t);
  const rim = mesh(rimGeo, alloy);
  rim.scale.set(w * 1.04, r * 0.62, r * 0.62);
  g.add(rim);
  for (let i = 0; i < 10; i++) {
    const spoke = mesh(spokeGeo, chrome);
    spoke.scale.set(w * 1.08, r * 0.1, r * 1.15);
    spoke.rotation.x = (i / 10) * Math.PI;
    g.add(spoke);
  }
  return g;
}


// ---------------------------------------------------------------------------
// Car bodies are extruded side profiles (real silhouettes with wheel arches),
// with a glass greenhouse, roof, pillars, mirrors, grille and trim on top.

interface CarSpec {
  L: number; W: number; R: number; clr: number;
  wf: number; wr: number; // wheel z positions
  tail: number; deck: number; belt: number; hood: number; nose: number;
  /** Greenhouse: rear base z, rear roof z, front roof z, windscreen base z, roof y. */
  cab: [number, number, number, number, number];
  rearSlope?: number; // how far the tail top leans in
  tumble?: number; // how much the cabin leans in towards the roof
  noseLen?: number; // how much the nose rounds off
}

const SPECS: Record<string, CarSpec> = {
  compact: { L: 4.3, W: 1.74, R: 0.31, clr: 0.17, wf: 1.36, wr: -1.26, tail: 0.86, deck: 0.92, belt: 0.92, hood: 0.86, nose: 0.68, cab: [-1.85, -1.55, 0.45, 0.98, 1.44], rearSlope: 0.12 },
  sedan: { L: 4.6, W: 1.78, R: 0.32, clr: 0.16, wf: 1.42, wr: -1.36, tail: 0.88, deck: 0.94, belt: 0.92, hood: 0.86, nose: 0.68, cab: [-1.35, -0.75, 0.45, 1.05, 1.44] },
  taxi: { L: 4.55, W: 1.76, R: 0.32, clr: 0.16, wf: 1.4, wr: -1.34, tail: 0.88, deck: 0.94, belt: 0.92, hood: 0.86, nose: 0.68, cab: [-1.35, -0.75, 0.45, 1.05, 1.44] },
  accordo: { L: 4.9, W: 1.86, R: 0.34, clr: 0.14, wf: 1.5, wr: -1.42, tail: 0.86, deck: 0.92, belt: 0.9, hood: 0.82, nose: 0.62, cab: [-1.65, -0.85, 0.35, 1.12, 1.42], noseLen: 0.35 },
  saloon: { L: 5.0, W: 1.86, R: 0.34, clr: 0.15, wf: 1.62, wr: -1.38, tail: 0.92, deck: 0.98, belt: 0.95, hood: 0.92, nose: 0.78, cab: [-1.45, -0.95, 0.2, 0.92, 1.46] },
  suv: { L: 4.6, W: 1.86, R: 0.38, clr: 0.24, wf: 1.42, wr: -1.32, tail: 1.08, deck: 1.12, belt: 1.12, hood: 1.05, nose: 0.92, cab: [-2.1, -1.95, 0.55, 1.05, 1.68], rearSlope: 0.1 },
  v8: { L: 5.0, W: 1.98, R: 0.42, clr: 0.3, wf: 1.52, wr: -1.42, tail: 1.22, deck: 1.26, belt: 1.26, hood: 1.2, nose: 1.12, cab: [-2.35, -2.3, 0.75, 1.15, 1.95], rearSlope: 0.04, noseLen: 0.12 },
  pickup: { L: 5.3, W: 1.86, R: 0.4, clr: 0.3, wf: 1.72, wr: -1.48, tail: 1.08, deck: 1.1, belt: 1.12, hood: 1.1, nose: 1.02, cab: [-0.55, -0.5, 0.7, 1.3, 1.86], rearSlope: 0.02, noseLen: 0.15 },
  supercar: { L: 4.6, W: 2.02, R: 0.35, clr: 0.1, wf: 1.42, wr: -1.38, tail: 0.92, deck: 0.98, belt: 0.86, hood: 0.66, nose: 0.42, cab: [-0.95, -0.25, 0.35, 1.25, 1.16], rearSlope: 0.06, noseLen: 0.55 },
  trotro: { L: 5.38, W: 1.88, R: 0.36, clr: 0.2, wf: 1.75, wr: -1.45, tail: 1.9, deck: 2.05, belt: 1.12, hood: 1.08, nose: 1.0, cab: [-2.62, -2.6, 1.62, 2.18, 2.28], rearSlope: 0.04, noseLen: 0.34, tumble: 0.07 },
  phantom: { L: 5.8, W: 2.0, R: 0.4, clr: 0.18, wf: 1.95, wr: -1.65, tail: 1.06, deck: 1.1, belt: 1.12, hood: 1.12, nose: 1.06, cab: [-1.95, -1.4, 0.55, 1.15, 1.66], noseLen: 0.08 },
};

const profileCache = new Map<string, { body: THREE.BufferGeometry; glass: THREE.BufferGeometry; roof: THREE.BufferGeometry }>();

/** Add points along long edges so the body can be curved in plan view, not just in profile. */
function densify(points: [number, number][], step = 0.18): [number, number][] {
  const out: [number, number][] = [];
  for (let i = 0; i < points.length; i++) {
    const a = points[i], b = points[(i + 1) % points.length];
    out.push(a);
    const n = Math.floor(Math.hypot(b[0] - a[0], b[1] - a[1]) / step);
    for (let k = 1; k < n; k++) out.push([a[0] + ((b[0] - a[0]) * k) / n, a[1] + ((b[1] - a[1]) * k) / n]);
  }
  return out;
}
function extrude(points: [number, number][], depth: number, bevel: number) {
  const shape = new THREE.Shape(densify(points).map(([z, y]) => new THREE.Vector2(z, y)));
  const g = new THREE.ExtrudeGeometry(shape, { depth: depth - bevel * 2, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel * 0.8, bevelSegments: 3, curveSegments: 8 });
  g.translate(0, 0, -(depth - bevel * 2) / 2);
  g.rotateY(-Math.PI / 2);
  g.computeVertexNormals();
  return g;
}

function carGeometry(kind: string) {
  const hit = profileCache.get(kind);
  if (hit) return hit;
  const c = SPECS[kind];
  const h = c.L / 2;
  const ra = c.R + 0.07;
  const arch = (zc: number): [number, number][] => {
    const pts: [number, number][] = [[zc + ra, c.clr]];
    for (let i = 0; i <= 10; i++) {
      const a = (i / 10) * Math.PI;
      pts.push([zc + Math.cos(a) * ra, Math.max(c.clr, c.R + Math.sin(a) * ra)]);
    }
    pts.push([zc - ra, c.clr]);
    return pts;
  };
  const nl = c.noseLen ?? 0.22;
  const rs = c.rearSlope ?? 0.18;
  const [rBase, rTop, fTop, fBase, roof] = c.cab;
  // Lower body, counter-clockwise from the rear bottom.
  const body: [number, number][] = [
    [-h + 0.12, c.clr], [-h, c.clr + 0.16], [-h + 0.02, c.tail], [-h + rs, c.deck],
    [rBase, c.belt], [fBase, c.belt], [fBase + 0.35, c.hood + (c.belt - c.hood) * 0.4], [h - nl, c.nose + 0.04],
    [h - 0.03, c.nose - 0.06], [h, c.clr + 0.22], [h - 0.1, c.clr],
    ...arch(c.wf), ...arch(c.wr),
  ];
  // Remove bottom points out of order: arches must run front → rear along the bottom.
  const greenhouse: [number, number][] = [[rBase + 0.02, c.belt - 0.02], [rTop, roof - 0.03], [fTop, roof - 0.03], [fBase - 0.02, c.belt - 0.02]];
  const roofSlab: [number, number][] = [[rTop - 0.04, roof - 0.07], [rTop + 0.06, roof + 0.02], [fTop - 0.06, roof + 0.02], [fTop + 0.05, roof - 0.07]];
  const out: Record<"body" | "glass" | "roof", THREE.BufferGeometry> = { body: extrude(body, c.W, 0.1), glass: extrude(greenhouse, c.W * 0.88, 0.05), roof: extrude(roofSlab, c.W * 0.9, 0.04) };
  // Sculpt: corners pulled in (rounded in plan), sides gently bowed, the cabin leaning in towards the roof.
  for (const k of Object.keys(out) as (keyof typeof out)[]) {
    const g = out[k];
    const pos = g.getAttribute("position") as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
      pos.setX(i, x * sideScale(c, y, z, k !== "body"));
      // The nose and tail are rounded in plan too: their middle stands proud of their corners.
      const edge = Math.abs(z) / (c.L / 2);
      if (edge > 0.82) pos.setZ(i, z * (1 - 0.035 * Math.pow(Math.abs(x) / (c.W / 2), 3)));
    }
    // Smooth shading over the curved panels, but keep the crisp edges where panels meet.
    out[k] = toCreasedNormals(g, Math.PI / 5);
    g.dispose();
  }
  profileCache.set(kind, out);
  return out;
}

/** How much narrower the body is at height y and length z than its full width (shared by trim placement). */
function sideScale(c: CarSpec, y: number, z: number, cabin: boolean) {
  const e = Math.min(1, Math.abs(z) / (c.L / 2));
  const plan = 1 - 0.12 * Math.pow(Math.max(0, (e - 0.55) / 0.45), 2.2);
  const mid = (c.clr + c.belt) / 2, half = Math.max(0.2, (c.belt - c.clr) / 2);
  const bow = 1 - 0.045 * Math.pow((y - mid) / half, 2);
  const tumble = cabin ? 1 - (c.tumble ?? 0.16) * Math.min(1, Math.max(0, (y - c.belt) / (c.cab[4] - c.belt))) : 1;
  return plan * (cabin ? 1 : Math.max(0.9, bow)) * tumble;
}

const darkTrim = new THREE.MeshStandardMaterial({ color: "#16171a", roughness: 0.45, metalness: 0.2 });
const grilleMat = new THREE.MeshStandardMaterial({ color: "#0b0b0c", roughness: 0.35, metalness: 0.5 });
/** Grille textures: a fine honeycomb for most cars, chrome slats for the big luxury ones. */
const grilleTexCache = new Map<string, THREE.CanvasTexture>();
function grilleTex(style: "mesh" | "slats" | "bars") {
  let t = grilleTexCache.get(style);
  if (t) return t;
  const cv = document.createElement("canvas");
  cv.width = 256; cv.height = 96;
  const g = cv.getContext("2d")!;
  g.fillStyle = "#08090a"; g.fillRect(0, 0, 256, 96);
  if (style === "mesh") {
    for (let y = 0; y < 96; y += 8) for (let x = (y / 8) % 2 ? 6 : 0; x < 256; x += 12) {
      g.fillStyle = "#2a2d31"; g.fillRect(x, y, 9, 2);
      g.fillStyle = "#16181a"; g.fillRect(x, y + 2, 9, 4);
    }
  } else if (style === "slats") {
    for (let y = 6; y < 96; y += 14) { g.fillStyle = "#3a3e43"; g.fillRect(0, y, 256, 4); g.fillStyle = "#6c7279"; g.fillRect(0, y, 256, 1); }
  } else {
    for (let x = 4; x < 256; x += 16) { g.fillStyle = "#c9ced3"; g.fillRect(x, 0, 7, 96); g.fillStyle = "#f4f6f8"; g.fillRect(x + 1, 0, 2, 96); }
  }
  t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  grilleTexCache.set(style, t);
  return t;
}
const grilleMats = new Map<string, THREE.MeshStandardMaterial>();
function grilleFace(style: "mesh" | "slats" | "bars") {
  let m = grilleMats.get(style);
  if (!m) grilleMats.set(style, (m = new THREE.MeshStandardMaterial({ map: grilleTex(style), roughness: 0.4, metalness: style === "bars" ? 0.8 : 0.3 })));
  return m;
}
const lens = new THREE.MeshPhysicalMaterial({ color: "#ffffff", transparent: true, opacity: 0.28, roughness: 0.02, clearcoat: 1, depthWrite: false });
const reflector = new THREE.MeshStandardMaterial({ color: "#e4e8ec", metalness: 1, roughness: 0.12 });
const tailLens = new THREE.MeshPhysicalMaterial({ color: "#7a0d10", roughness: 0.15, clearcoat: 1, transparent: true, opacity: 0.92 });

/** Where the body's surface is at a given height and width, found by casting a ray at the body. */
function surface(body: THREE.Mesh, x: number, y: number, dir: 1 | -1, far: number) {
  const ray = new THREE.Raycaster(new THREE.Vector3(x, y, dir * far), new THREE.Vector3(0, 0, -dir), 0, far * 2);
  const hit = ray.intersectObject(body, false)[0];
  return hit ? hit.point.z : dir * (far - 0.3);
}

const seamMat = new THREE.MeshBasicMaterial({ color: "#0a0a0a", transparent: true, opacity: 0.55 });
const canvasMat = new Map<string, THREE.MeshStandardMaterial>();
function fabricColor(c: string) {
  let m = canvasMat.get(c);
  if (!m) canvasMat.set(c, (m = new THREE.MeshStandardMaterial({ color: c, roughness: 0.9, side: THREE.DoubleSide })));
  return m;
}
const riderSkin = ["#4a2e1c", "#5c3a22", "#3e2616", "#6b4226"].map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.7 }));
const riderCloth = ["#C8452C", "#1F5AA6", "#2E7D4F", "#E3A857", "#f4efe6", "#222"].map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.85 }));
const helmetMat = ["#111", "#c8352c", "#f2f2f2", "#1F5AA6"].map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.25, metalness: 0.2 }));

/** A seated rider for motorbikes, bicycles and tricycles (traffic only). */
export function buildRider(seed: number, seatY: number, seatZ: number, pedal = false) {
  const rnd = mulberry32(seed);
  const g = new THREE.Group();
  const skin = riderSkin[Math.floor(rnd() * riderSkin.length)];
  const top = riderCloth[Math.floor(rnd() * riderCloth.length)];
  const legs = riderCloth[Math.floor(rnd() * riderCloth.length)];
  const torso = mesh(rbox(0.36, 0.55, 0.24, 0.08), top, 0, seatY + 0.33, seatZ + 0.05);
  torso.rotation.x = 0.25;
  g.add(torso);
  const head = mesh(new THREE.SphereGeometry(0.11, 14, 10), skin, 0, seatY + 0.72, seatZ + 0.16);
  g.add(head);
  if (!pedal && rnd() < 0.8) g.add(mesh(new THREE.SphereGeometry(0.135, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.6), helmetMat[Math.floor(rnd() * helmetMat.length)], 0, seatY + 0.74, seatZ + 0.16));
  for (const sx of [-1, 1]) {
    const thigh = mesh(rbox(0.13, 0.13, 0.42, 0.05), legs, sx * 0.12, seatY + 0.05, seatZ + 0.2);
    g.add(thigh);
    const shin = mesh(rbox(0.11, 0.42, 0.11, 0.04), legs, sx * 0.13, seatY - 0.17, seatZ + 0.42);
    g.add(shin);
    const arm = mesh(rbox(0.09, 0.09, 0.42, 0.04), top, sx * 0.2, seatY + 0.48, seatZ + 0.32);
    arm.rotation.x = 0.35;
    g.add(arm);
  }
  return g;
}

function buildSmall(kind: VehicleKind, rnd: () => number, group: THREE.Group, wheels: THREE.Object3D[], head: THREE.MeshStandardMaterial, brake: THREE.MeshStandardMaterial): [number, number] {
  const add = (o: THREE.Object3D) => { group.add(o); return o; };
  const wheelAt = (r: number, w: number, x: number, z: number) => {
    const wh = wheel(r, w);
    wh.position.set(x, r, z);
    add(wh);
    wheels.push(wh);
  };
  const colors = ["#9b1c1c", "#1a1a1a", "#1F5AA6", "#d4a017", "#e8e8e6", "#2E7D4F"];
  const bodyM = paint(colors[Math.floor(rnd() * colors.length)]);
  const frontBike = (zFront: number, seatZ: number) => {
    // Fork, handlebars, headlight, tank, seat.
    const fork = add(mesh(rbox(0.05, 0.75, 0.05, 0.02), chrome, 0, 0.62, zFront - 0.08));
    fork.rotation.x = -0.35;
    add(mesh(rbox(0.66, 0.04, 0.04, 0.02), black, 0, 1.02, zFront - 0.18));
    add(mesh(new THREE.SphereGeometry(0.09, 12, 8), head, 0, 0.88, zFront + 0.02));
    add(mesh(rbox(0.3, 0.22, 0.5, 0.1), bodyM, 0, 0.82, seatZ + 0.5));
    add(mesh(rbox(0.28, 0.1, 0.6, 0.05), black, 0, 0.8, seatZ));
    add(mesh(rbox(0.26, 0.3, 0.4, 0.06), darkTrim, 0, 0.42, seatZ + 0.25)); // engine
  };
  if (kind === "bicycle") {
    const frame = new THREE.MeshStandardMaterial({ color: "#151515", roughness: 0.4, metalness: 0.5 });
    wheelAt(0.34, 0.04, 0, 0.55);
    wheelAt(0.34, 0.04, 0, -0.55);
    const tube = (y: number, z: number, len: number, rot: number) => { const t = add(mesh(rbox(0.035, 0.035, len, 0.015), frame, 0, y, z)); t.rotation.x = rot; };
    tube(0.62, 0.05, 0.8, 0.1);
    tube(0.45, -0.25, 0.6, -0.5);
    tube(0.48, 0.32, 0.6, 0.9);
    add(mesh(rbox(0.5, 0.03, 0.03, 0.01), frame, 0, 0.95, 0.5));
    add(mesh(rbox(0.12, 0.05, 0.24, 0.03), black, 0, 0.86, -0.25));
    add(mesh(rbox(0.3, 0.03, 0.4, 0.01), frame, 0, 0.72, -0.55)); // carrier
    if (rnd() < 0.4) add(mesh(rbox(0.36, 0.3, 0.36, 0.05), new THREE.MeshStandardMaterial({ color: "#a37b45", roughness: 1 }), 0, 0.9, -0.55)); // a sack
    return [1.8, 0.55];
  }
  if (kind === "motorbike") {
    wheelAt(0.3, 0.1, 0, 0.68);
    wheelAt(0.3, 0.12, 0, -0.66);
    frontBike(0.82, -0.18);
    add(mesh(rbox(0.22, 0.05, 0.5, 0.02), bodyM, 0, 0.66, -0.62)); // rear fender
    const ex = add(mesh(new THREE.CylinderGeometry(0.045, 0.05, 0.75, 10), chrome, 0.16, 0.36, -0.35));
    ex.rotation.x = Math.PI / 2 - 0.15;
    add(mesh(rbox(0.12, 0.05, 0.04, 0.02), brake, 0, 0.72, -0.9));
    return [2.0, 0.7];
  }
  if (kind === "pragya" || kind === "aboboyaa") {
    const L = kind === "pragya" ? 2.8 : 3.1;
    wheelAt(0.26, 0.1, 0, L / 2 - 0.3);
    wheelAt(0.27, 0.14, -0.62, -L / 2 + 0.55);
    wheelAt(0.27, 0.14, 0.62, -L / 2 + 0.55);
    frontBike(L / 2 - 0.15, L / 2 - 0.9);
    add(mesh(rbox(1.25, 0.08, 0.1, 0.02), black, 0, 0.35, -L / 2 + 0.55)); // rear axle housing
    if (kind === "pragya") {
      const canopy = ["#d4a017", "#1F5AA6", "#2E7D4F", "#C8452C"][Math.floor(rnd() * 4)];
      add(mesh(rbox(1.3, 0.12, 1.5, 0.03), darkTrim, 0, 0.5, -L / 2 + 0.85)); // floor
      add(mesh(rbox(1.2, 0.12, 0.4, 0.04), fabricColor("#3b2a20"), 0, 0.82, -L / 2 + 0.35)); // rear bench
      add(mesh(rbox(1.2, 0.5, 0.08, 0.03), fabricColor("#3b2a20"), 0, 1.05, -L / 2 + 0.18));
      add(mesh(rbox(1.2, 0.12, 0.35, 0.04), fabricColor("#3b2a20"), 0, 0.82, -L / 2 + 1.2)); // middle bench
      add(mesh(rbox(1.4, 0.06, 2.4, 0.03), fabricColor(canopy), 0, 1.78, -0.15)); // canopy roof
      for (const [x, z] of [[-0.66, -L / 2 + 0.12], [0.66, -L / 2 + 0.12], [-0.62, L / 2 - 0.55], [0.62, L / 2 - 0.55]]) add(mesh(rbox(0.04, 1.3, 0.04, 0.01), black, x, 1.12, z));
      add(mesh(rbox(1.3, 0.35, 0.04, 0.02), fabricColor(canopy), 0, 1.5, -L / 2 + 0.1)); // rear flap
      add(mesh(rbox(0.9, 0.5, 0.03, 0.02), glass, 0, 1.35, L / 2 - 0.5)); // windscreen
    } else {
      const tray = paint(["#1f5aa6", "#6b7076", "#9b1c1c"][Math.floor(rnd() * 3)]);
      const z0 = -L / 2 + 0.85;
      add(mesh(rbox(1.35, 0.06, 1.7, 0.02), tray, 0, 0.62, z0));
      for (const sx of [-1, 1]) add(mesh(rbox(0.04, 0.4, 1.7, 0.01), tray, sx * 0.66, 0.83, z0));
      add(mesh(rbox(1.35, 0.4, 0.04, 0.01), tray, 0, 0.83, z0 - 0.85));
      add(mesh(rbox(1.35, 0.4, 0.04, 0.01), tray, 0, 0.83, z0 + 0.85));
      if (rnd() < 0.6) for (let i = 0; i < 5; i++) add(mesh(rbox(0.4, 0.25, 0.4, 0.06), new THREE.MeshStandardMaterial({ color: ["#a37b45", "#c9c2b3", "#6b4a2a"][i % 3], roughness: 1 }), (rnd() - 0.5) * 0.7, 0.8 + (i % 2) * 0.25, z0 + (rnd() - 0.5) * 1.1));
    }
    for (const sx of [-1, 1]) add(mesh(rbox(0.12, 0.06, 0.04, 0.02), brake, sx * 0.55, 0.6, -L / 2 + 0.06));
    return [L, 1.4];
  }
  return [2, 0.7];
}

function buildProfileCar(kind: VehicleKind, rnd: () => number, group: THREE.Group, addWheelsAt: (r: number, w: number, xs: number, zs: number[]) => void, head: THREE.MeshStandardMaterial, brake: THREE.MeshStandardMaterial, addPlate: (y: number, z: number, flip: boolean) => void, lights: THREE.MeshStandardMaterial[]): [number, number] {
  const c = SPECS[kind];
  const geo = carGeometry(kind);
  const palette: Record<string, string[]> = {
    compact: ["#b9c4cc", "#7A2E2E", "#1f3a5f", "#e8e8e6", "#2b2b2b", "#556B2F", "#c9a227", "#9aa3ad"],
    sedan: ["#b9c4cc", "#7A2E2E", "#1f3a5f", "#e8e8e6", "#2b2b2b", "#3b4a54", "#8a1c1c"],
    taxi: ["#e8e3d6", "#c9ccd0", "#d8d2c2", "#b7bcc2"],
    accordo: ["#2b2f36", "#e8e8e6", "#4a4f57", "#6e1f24", "#1d2a3a"],
    saloon: ["#11161c", "#cfd3d6", "#2b2f36", "#3a2a22"],
    suv: ["#7A2E2E", "#e8e8e6", "#3b4a54", "#1f3a5f", "#9aa3ad"],
    v8: ["#0d0d10", "#0d0d10", "#f2f2ee", "#2b2f36"],
    pickup: ["#f2f2ee", "#b9c4cc", "#7a2e2e", "#2b2f36"],
    supercar: ["#e8b100", "#c8152c", "#2a7a3a", "#f2f2ee", "#ff6a00"],
    phantom: ["#2a2340", "#11161c", "#f2f2ee", "#3b1a22"],
    trotro: ["#f4efe2", "#e9e2cf", "#fbfbf6", "#d8dde0"],
  };
  const color = palette[kind][Math.floor(rnd() * palette[kind].length)];
  const bm = paint(color);
  const roofM = kind === "phantom" ? paint(color === "#f2f2ee" ? "#2a2340" : "#cfd3d6") : bm;
  const body = mesh(geo.body, bm);
  group.add(body);
  group.add(mesh(geo.glass, glass));
  group.add(mesh(geo.roof, roofM));
  const [rBase, rTop, fTop, fBase, roof] = c.cab;
  const hW = c.W / 2;
  // Pillars and window trim.
  const chromeTrim = kind === "accordo" || kind === "saloon" || kind === "phantom" || kind === "v8";
  for (const sx of [-1, 1]) {
    const bz = (rTop + fTop) / 2 + (fTop - rTop) * 0.08;
    if (kind !== "trotro") group.add(mesh(rbox(0.04, roof - c.belt - 0.05, 0.1, 0.01), darkTrim, sx * (hW * 0.88 * sideScale(c, (roof + c.belt) / 2, bz, true) + 0.012), (roof + c.belt) / 2, bz));
    group.add(mesh(rbox(0.03, 0.035, fBase - rBase - 0.2, 0.01), chromeTrim ? chrome : darkTrim, sx * (hW * 0.88 * sideScale(c, c.belt, 0, true) + 0.01), c.belt + 0.01, (fBase + rBase) / 2));
    // Mirrors.
    group.add(mesh(rbox(0.16, 0.1, 0.12, 0.03), kind === "taxi" ? bm : darkTrim, sx * (hW * sideScale(c, c.belt, fBase, false) + 0.08), c.belt + 0.1, fBase - 0.1));
    // Door seams and handles.
    for (const z of kind === "supercar" ? [fBase - 0.05] : [fBase - 0.05, bz - 0.04, rBase + 0.25]) {
      const seam = new THREE.Mesh(new THREE.PlaneGeometry(0.012, c.belt - c.clr - 0.25), seamMat);
      seam.position.set(sx * (hW * sideScale(c, (c.belt + c.clr + 0.2) / 2, z, false) + 0.004), (c.belt + c.clr + 0.2) / 2, z);
      seam.rotation.y = (sx * Math.PI) / 2;
      group.add(seam);
    }
    if (kind !== "supercar") for (const z of [bz + 0.35, rBase + 0.6]) group.add(mesh(rbox(0.02, 0.03, 0.16, 0.01), chromeTrim ? chrome : darkTrim, sx * (hW * sideScale(c, c.belt - 0.12, z, false) + 0.006), c.belt - 0.12, z));
  }
  const h = c.L / 2;
  // Grille, lamps, bumpers.
  if (kind === "supercar") {
    for (const sx of [-1, 1]) {
      group.add(mesh(rbox(0.36, 0.06, 0.1, 0.02), head, sx * 0.7, c.nose + 0.02, h - 0.22));
      group.add(mesh(rbox(0.05, 0.28, 0.7, 0.02), grilleMat, sx * (hW + 0.004), 0.55, -0.35)); // side intakes
    }
    group.add(mesh(rbox(1.5, 0.12, 0.08, 0.03), grilleMat, 0, 0.22, h - 0.03)); // splitter intake
    group.add(mesh(rbox(1.6, 0.05, 0.3, 0.02), grilleMat, 0, 0.12, h - 0.1));
    group.add(mesh(rbox(1.7, 0.06, 0.35, 0.02), darkTrim, 0, 1.15, -h + 0.22)); // wing
    for (const sx of [-1, 1]) group.add(mesh(rbox(0.05, 0.22, 0.12, 0.01), darkTrim, sx * 0.55, 1.03, -h + 0.25));
    group.add(mesh(rbox(1.6, 0.06, 0.06, 0.02), brake, 0, c.tail - 0.06, -h + 0.03));
    group.add(mesh(rbox(1.5, 0.2, 0.1, 0.02), grilleMat, 0, 0.28, -h + 0.04)); // diffuser
  } else {
    body.updateMatrixWorld(true);
    const fz = (x: number, y: number) => surface(body, x, y, 1, h + 1);
    const rz = (x: number, y: number) => surface(body, x, y, -1, h + 1);
    const lux = kind === "phantom" || kind === "saloon";
    const truck = kind === "v8" || kind === "pickup" || kind === "suv";
    const grilleH = kind === "phantom" ? 0.5 : truck ? 0.34 : kind === "trotro" ? 0.2 : lux ? 0.26 : 0.16;
    const grilleW = kind === "phantom" ? 0.62 : truck ? 1.05 : kind === "trotro" ? 0.95 : lux ? 0.64 : 0.82;
    const gy = c.nose - grilleH / 2 - 0.07;
    // Upper grille: a recessed textured panel inside a surround.
    const gz = fz(0, gy) - 0.01;
    const face = mesh(new THREE.PlaneGeometry(grilleW, grilleH), grilleFace(lux ? "bars" : truck ? "slats" : "mesh"), 0, gy, gz + 0.012);
    group.add(face);
    const surround = lux || kind === "v8" || kind === "accordo" ? chrome : darkTrim;
    for (const sy of [-1, 1]) group.add(mesh(rbox(grilleW + 0.06, 0.035, 0.05, 0.012), surround, 0, gy + sy * (grilleH / 2 + 0.012), gz));
    for (const sx of [-1, 1]) group.add(mesh(rbox(0.035, grilleH + 0.05, 0.05, 0.012), surround, sx * (grilleW / 2 + 0.012), gy, gz));
    group.add(mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.02, 20).rotateX(Math.PI / 2), chrome, 0, gy + (lux ? grilleH / 2 + 0.06 : 0), gz + 0.03)); // badge
    // Headlamps: dark housing, chrome reflector, bright running-light strip, clear lens over the top.
    const lw = kind === "accordo" ? 0.46 : kind === "trotro" ? 0.3 : truck ? 0.36 : 0.34, lh = kind === "trotro" ? 0.2 : truck ? 0.15 : 0.12;
    for (const sx of [-1, 1]) {
      const lx = sx * (hW - 0.12 - lw / 2), ly = kind === "trotro" ? gy : c.nose - 0.09;
      const lz = Math.min(fz(lx - sx * lw * 0.4, ly), fz(lx + sx * lw * 0.4, ly)) - 0.015;
      group.add(mesh(rbox(lw, lh, 0.06, 0.02), black, lx, ly, lz));
      for (const k of [-1, 1]) group.add(mesh(new THREE.SphereGeometry(lh * 0.32, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2).rotateX(Math.PI / 2), reflector, lx + (k * lw) / 4.5, ly - lh * 0.08, lz + 0.03));
      group.add(mesh(rbox(lw * 0.9, 0.022, 0.03, 0.008), head, lx, ly + lh / 2 - 0.025, lz + 0.03));
      group.add(mesh(rbox(lw + 0.01, lh + 0.01, 0.025, 0.02), lens, lx, ly, lz + 0.045));
      // Taillights: red lens with a white reverse light and an amber indicator.
      const tw = kind === "accordo" || lux ? 0.5 : kind === "trotro" ? 0.18 : 0.34, th = kind === "trotro" ? 0.38 : 0.13;
      const tx = sx * (hW - 0.1 - tw / 2), ty = kind === "trotro" ? c.tail - 0.55 : c.tail - 0.1;
      const tz = Math.max(rz(tx - sx * tw * 0.4, ty), rz(tx + sx * tw * 0.4, ty)) + 0.015;
      group.add(mesh(rbox(tw, th, 0.05, 0.02), tailLens, tx, ty, tz));
      group.add(mesh(rbox(tw * 0.7, th * 0.35, 0.03, 0.01), brake, tx + sx * tw * 0.1, ty + th * 0.15, tz - 0.012));
      group.add(mesh(rbox(tw * 0.25, th * 0.3, 0.03, 0.01), head, tx - sx * tw * 0.3, ty - th * 0.25, tz - 0.012));
      group.add(mesh(rbox(tw * 0.25, th * 0.25, 0.03, 0.01), amber, tx + sx * tw * 0.3, ty - th * 0.28, tz - 0.012));
      // Fog lamps in the lower bumper.
      if (kind !== "trotro" && kind !== "compact") {
        const fy = c.clr + 0.2, fx = sx * (hW - 0.28);
        group.add(mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.03, 16).rotateX(Math.PI / 2), reflector, fx, fy, fz(fx, fy) + 0.0));
      }
    }
    if (kind === "accordo") group.add(mesh(rbox(c.W - 0.6, 0.03, 0.04, 0.01), brake, 0, c.tail - 0.1, rz(0, c.tail - 0.1) + 0.01)); // light bar
    // Lower intake below the bumper line.
    const iy = c.clr + 0.2;
    group.add(mesh(new THREE.PlaneGeometry(c.W * 0.46, 0.1), grilleFace("mesh"), 0, iy, fz(0, iy) + 0.006));
    if (truck) {
      group.add(mesh(rbox(c.W - 0.06, 0.18, 0.16, 0.05), darkTrim, 0, c.clr + 0.12, fz(0, c.clr + 0.12) - 0.03));
      group.add(mesh(rbox(c.W - 0.06, 0.18, 0.16, 0.05), darkTrim, 0, c.clr + 0.12, rz(0, c.clr + 0.12) + 0.03));
    }
    // Number plates front and back, sitting on the bumper.
    const py = c.clr + (truck ? 0.34 : 0.3);
    addPlate(py, fz(0, py) + 0.012, false);
    addPlate(py + (kind === "trotro" ? 0.1 : 0.05), rz(0, py) - 0.012, true);
    // Lower rear valance and exhaust tip.
    group.add(mesh(rbox(c.W * 0.7, 0.06, 0.04, 0.02), darkTrim, 0, c.clr + 0.08, rz(0, c.clr + 0.12) + 0.01));
    group.add(mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.12, 12).rotateX(Math.PI / 2), chrome, hW * 0.5, c.clr + 0.06, rz(hW * 0.5, c.clr + 0.12) - 0.02));
  }
  if (kind === "v8" || kind === "suv") for (const sx of [-1, 1]) group.add(mesh(rbox(0.05, 0.05, (fTop - rTop) * 0.9, 0.02), kind === "v8" ? chrome : darkTrim, sx * (hW * 0.72), roof + 0.06, (fTop + rTop) / 2));
  if (kind === "v8" || kind === "pickup") for (const sx of [-1, 1]) group.add(mesh(rbox(0.12, 0.05, c.wf - c.wr - 0.9, 0.02), darkTrim, sx * (hW + 0.05), c.clr + 0.12, (c.wf + c.wr) / 2)); // side steps
  if (kind === "pickup") {
    // Open bed: liner, rails and tailgate seam.
    const bedLen = rBase + h - 0.15;
    group.add(mesh(rbox(c.W - 0.24, 0.02, bedLen, 0.01), grilleMat, 0, c.belt - 0.005, -h + 0.08 + bedLen / 2));
    for (const sx of [-1, 1]) group.add(mesh(rbox(0.06, 0.05, bedLen, 0.02), darkTrim, sx * (hW - 0.08), c.belt + 0.03, -h + 0.08 + bedLen / 2));
  }
  if (kind === "taxi") {
    for (const z of [c.wf, c.wr])
      for (const sx of [-1, 1]) group.add(mesh(rbox(0.03, c.belt - c.clr - 0.2, 0.95, 0.02), yellow, sx * (hW + 0.006), (c.belt + c.clr + 0.12) / 2, z));
    group.add(mesh(rbox(c.W * 0.55, 0.03, 0.9, 0.01), yellow, 0, c.hood + 0.02, h - 0.6));
    const sign = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.16, 0.24), new THREE.MeshStandardMaterial({ color: "#f2c200", emissive: "#f2c200", emissiveIntensity: 0.2 }));
    sign.position.set(0, roof + 0.1, (rTop + fTop) / 2);
    group.add(sign);
    lights.push(sign.material as THREE.MeshStandardMaterial);
  }
  if (kind === "trotro") {
    // A Hiace-type minibus: sliding door seam, livery and slogan, destination board, roof rack and luggage.
    const stripe = ["#C8452C", "#1F7A4D", "#2E86AB", "#F2B705"][Math.floor(rnd() * 4)];
    const slogan = SLOGANS[Math.floor(rnd() * SLOGANS.length)];
    const route = ROUTES[Math.floor(rnd() * ROUTES.length)];
    const liv = new THREE.MeshStandardMaterial({ map: trotroLivery(slogan, `KANESHIE — ${route}`, color, stripe), roughness: 0.5, transparent: true, polygonOffset: true, polygonOffsetFactor: -2 });
    for (const sx of [-1, 1]) {
      const pl = new THREE.Mesh(new THREE.PlaneGeometry(c.L - 1.9, 0.7), liv);
      pl.position.set(sx * (hW * sideScale(c, 0.75, 0, false) + 0.006), 0.75, -0.25);
      pl.rotation.y = (sx * Math.PI) / 2;
      group.add(pl);
      const door = new THREE.Mesh(new THREE.PlaneGeometry(0.014, 1.6), seamMat);
      door.position.set(sx * (hW * sideScale(c, 1.1, 0.6, false) + 0.006), 1.1, 0.75);
      door.rotation.y = (sx * Math.PI) / 2;
      group.add(door);
      // Window pillars along the side.
      for (let i = 0; i < 4; i++) group.add(mesh(rbox(0.03, roof - c.belt - 0.1, 0.07, 0.01), bm, sx * (hW * 0.88 * sideScale(c, (roof + c.belt) / 2, 0, true) + 0.01), (roof + c.belt) / 2, -2.0 + i * 0.95));
    }
    const back = new THREE.Mesh(new THREE.PlaneGeometry(c.W - 0.5, 0.42), new THREE.MeshStandardMaterial({ map: signboard(slogan, color, "#1a1a1a", { h: 128, border: stripe }), roughness: 0.6 }));
    back.position.set(0, 1.45, -h - 0.02);
    back.rotation.y = Math.PI;
    group.add(back);
    const dest = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 0.2), new THREE.MeshStandardMaterial({ map: signboard(route, "#111", "#F2B705", { h: 96, border: "#111" }), emissive: "#f2b705", emissiveIntensity: 0.15 }));
    dest.position.set(0, roof - 0.16, fTop + 0.06);
    dest.rotation.x = -0.35;
    group.add(dest);
    group.add(mesh(rbox(c.W * 0.84, 0.05, c.L - 1.9, 0.02), black, 0, roof + 0.12, -0.45));
    for (let i = 0; i < 3; i++) if (rnd() < 0.6) group.add(mesh(rbox(0.6 + rnd() * 0.4, 0.3 + rnd() * 0.3, 0.6, 0.06), new THREE.MeshStandardMaterial({ color: ["#7a4b2a", "#2E86AB", "#C8452C", "#556B2F"][i], roughness: 0.9 }), (rnd() - 0.5) * 0.8, roof + 0.32, -1.6 + i * 1.1));
  }
  addWheelsAt(c.R, kind === "supercar" ? 0.3 : kind === "v8" || kind === "pickup" ? 0.3 : 0.23, hW - 0.14, [c.wf, c.wr]);
  if (kind === "supercar") addPlate(c.clr + 0.32, -h - 0.005, true);
  return [c.L, c.W];
}

const SLOGANS = ["EYE ADOM", "NYAME BEKYERE", "STILL I RISE", "NO CONDITION IS PERMANENT", "GOD NEVER SLEEPS", "SIKA NKO BIA", "ONE MAN NO CHOP", "SUCCESS IS A JOURNEY", "FEAR WOMEN", "OBAA YAA", "AWURADE KASA", "NO WAHALA"];
const ROUTES = ["CIRCLE", "KANESHIE", "LA", "MADINA", "TEMA STN", "ACHIMOTA", "OSU", "SPINTEX", "LAPAZ", "37"];

export function buildVehicle(kind: VehicleKind, seed: number): VehicleRig {
  rubber.normalMap ??= tireNormal();
  const rnd = mulberry32(seed);
  const group = new THREE.Group();
  const wheels: THREE.Object3D[] = [];
  const lights: THREE.MeshStandardMaterial[] = [];
  const head = new THREE.MeshStandardMaterial({ color: "#fffbe8", emissive: "#fff2c4", emissiveIntensity: 0.05, roughness: 0.1 });
  const brake = new THREE.MeshStandardMaterial({ color: "#7a0c0c", emissive: "#ff2010", emissiveIntensity: 0.15, roughness: 0.2 });
  lights.push(head);
  let L = 4.4, W = 1.75;

  const addWheels = (r: number, w: number, xs: number, zs: number[], y = r) => {
    for (const z of zs)
      for (const s of [-1, 1]) {
        const wh = wheel(r, w);
        wh.position.set(s * xs, y, z);
        group.add(wh);
        wheels.push(wh);
      }
  };
  const addLights = (w: number, y: number, zf: number, zb: number) => {
    for (const s of [-1, 1]) {
      group.add(mesh(rbox(0.32, 0.12, 0.06, 0.03), head, s * (w / 2 - 0.25), y, zf));
      group.add(mesh(rbox(0.3, 0.1, 0.06, 0.03), brake, s * (w / 2 - 0.22), y + 0.04, zb));
    }
  };
  let plateMat: THREE.MeshStandardMaterial | null = null; // the same number front and back
  const addPlate = (y: number, z: number, flip: boolean) => {
    plateMat ??= new THREE.MeshStandardMaterial({ map: plate(`GR ${1000 + Math.floor(rnd() * 8999)}-${20 + Math.floor(rnd() * 6)}`), roughness: 0.5 });
    const p = new THREE.Mesh(new THREE.PlaneGeometry(0.52, 0.13), plateMat);
    p.position.set(0, y, z);
    if (flip) p.rotation.y = Math.PI;
    group.add(p);
  };

  const real = realCar(kind, seed);
  if (real) {
    group.add(real.group);
    L = real.length;
    W = real.width;
    // Light glows near the real lamps: invisible by day, glowing at night or when braking.
    const glowHead = new THREE.MeshBasicMaterial({ color: "#fff6d8", transparent: true, opacity: 0, depthWrite: false });
    const glowTail = new THREE.MeshBasicMaterial({ color: "#ff2a1a", transparent: true, opacity: 0, depthWrite: false });
    glowHead.userData.glow = "head";
    glowTail.userData.glow = "tail";
    glowMats.set(group, [glowHead, glowTail]);
    for (const sx of [-1, 1]) {
      const hl = new THREE.Mesh(new THREE.PlaneGeometry(0.28, 0.1), glowHead);
      hl.position.set(sx * (W / 2 - 0.3), real.height * 0.42, L / 2 + 0.02);
      group.add(hl);
      const tl = new THREE.Mesh(new THREE.PlaneGeometry(0.26, 0.09), glowTail);
      tl.position.set(sx * (W / 2 - 0.28), real.height * 0.5, -L / 2 - 0.02);
      tl.rotation.y = Math.PI;
      group.add(tl);
    }
  } else if (kind === "trotro" && SPECS.trotro) {
    [L, W] = buildProfileCar(kind, rnd, group, addWheels, head, brake, addPlate, lights);
  } else if (kind === ("trotro_box" as VehicleKind)) {
    L = 5.6;
    W = 2.0;
    const colors = [["#f4efe2", "#C8452C"], ["#f4efe2", "#1F7A4D"], ["#e9e2cf", "#2E86AB"], ["#fbfbf6", "#F2B705"]];
    const [body, stripe] = colors[Math.floor(rnd() * colors.length)];
    const bm = paint(body);
    group.add(mesh(rbox(W, 1.55, L - 0.9, 0.18), bm, 0, 1.45, -0.35));
    group.add(mesh(rbox(W * 0.98, 0.9, 1.4, 0.2), bm, 0, 0.98, L / 2 - 0.75)); // hood
    group.add(mesh(rbox(W * 0.94, 0.62, 0.12, 0.05), glass, 0, 1.82, L / 2 - 1.45)); // windscreen
    for (const s of [-1, 1]) group.add(mesh(rbox(0.04, 0.55, L - 2.0, 0.02), glass, s * (W / 2 + 0.005), 1.78, -0.45));
    const slogan = SLOGANS[Math.floor(rnd() * SLOGANS.length)];
    const route = ROUTES[Math.floor(rnd() * ROUTES.length)];
    const liv = new THREE.MeshStandardMaterial({ map: trotroLivery(slogan, `KANESHIE — ${route}`, body, stripe), roughness: 0.6 });
    for (const s of [-1, 1]) {
      const pl = new THREE.Mesh(new THREE.PlaneGeometry(L - 1.2, 1.0), liv);
      pl.position.set(s * (W / 2 + 0.012), 1.08, -0.35);
      pl.rotation.y = (s * Math.PI) / 2;
      group.add(pl);
    }
    const back = new THREE.Mesh(new THREE.PlaneGeometry(W - 0.2, 0.5), new THREE.MeshStandardMaterial({ map: signboard(slogan, body, "#1a1a1a", { h: 128, border: stripe }), roughness: 0.6 }));
    back.position.set(0, 1.2, -L / 2 - 0.1 + 0.005);
    back.rotation.y = Math.PI;
    group.add(back);
    const dest = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.22), new THREE.MeshStandardMaterial({ map: signboard(route, "#111", "#F2B705", { h: 96, border: "#111" }), emissive: "#f2b705", emissiveIntensity: 0.15 }));
    dest.position.set(0, 2.05, L / 2 - 1.38);
    group.add(dest);
    // Roof rack with luggage.
    group.add(mesh(rbox(W * 0.9, 0.05, L - 1.6, 0.02), black, 0, 2.27, -0.4));
    for (let i = 0; i < 3; i++) if (rnd() < 0.6) group.add(mesh(rbox(0.6 + rnd() * 0.4, 0.3 + rnd() * 0.3, 0.6, 0.06), new THREE.MeshStandardMaterial({ color: ["#7a4b2a", "#2E86AB", "#C8452C", "#556B2F"][i], roughness: 0.9 }), (rnd() - 0.5) * 0.8, 2.45, -1.6 + i * 1.2));
    group.add(mesh(rbox(W * 0.96, 0.25, 0.18, 0.06), chrome, 0, 0.55, L / 2 - 0.02));
    addWheels(0.38, 0.24, W / 2 - 0.12, [L / 2 - 1.05, -L / 2 + 0.95]);
    addLights(W, 0.95, L / 2 + 0.0, -L / 2 + 0.05);
    addPlate(0.62, -L / 2 + 0.04, true);
  } else if (kind in SPECS) {
    [L, W] = buildProfileCar(kind, rnd, group, addWheels, head, brake, addPlate, lights);
  } else if (isSmallVehicle(kind)) {
    [L, W] = buildSmall(kind, rnd, group, wheels, head, brake);
  } else if (kind === "suv" || kind === "v8") {
    L = kind === "v8" ? 5.0 : 4.6;
    W = kind === "v8" ? 1.98 : 1.86;
    const color = kind === "v8" ? "#0d0d10" : ["#7A2E2E", "#e8e8e6", "#3b4a54", "#1f3a5f"][Math.floor(rnd() * 4)];
    const bm = paint(color);
    group.add(mesh(rbox(W, 0.95, L, 0.16), bm, 0, 0.98, 0));
    group.add(mesh(rbox(W * 0.94, 0.78, L * 0.62, 0.14), bm, 0, 1.78, -0.25));
    group.add(mesh(rbox(W * 0.95, 0.62, L * 0.6, 0.12), glass, 0, 1.76, -0.25));
    group.add(mesh(rbox(W * 0.9, 0.08, L * 0.56, 0.03), bm, 0, 2.18, -0.25));
    group.add(mesh(rbox(W * 0.7, 0.32, 0.06, 0.03), kind === "v8" ? chrome : black, 0, 1.08, L / 2 + 0.01));
    if (kind === "v8") for (const s of [-1, 1]) group.add(mesh(rbox(0.08, 0.06, L * 0.5, 0.02), chrome, s * (W / 2 - 0.05), 2.23, -0.25));
    addWheels(0.42, 0.3, W / 2 - 0.08, [L / 2 - 0.9, -L / 2 + 0.95]);
    addLights(W, 1.18, L / 2 + 0.02, -L / 2 - 0.02);
    addPlate(0.75, -L / 2 - 0.02, true);
  } else if (kind === "pickup") {
    L = 5.1;
    W = 1.82;
    const bm = paint(["#e8e8e6", "#b9c4cc", "#7a2e2e"][Math.floor(rnd() * 3)]);
    group.add(mesh(rbox(W, 0.8, L, 0.12), bm, 0, 0.9, 0));
    group.add(mesh(rbox(W * 0.94, 0.7, 1.9, 0.12), bm, 0, 1.6, 0.6));
    group.add(mesh(rbox(W * 0.95, 0.55, 1.8, 0.1), glass, 0, 1.6, 0.6));
    group.add(mesh(rbox(W * 0.9, 0.5, 2.0, 0.04), black, 0, 1.15, -1.4));
    addWheels(0.42, 0.28, W / 2 - 0.08, [L / 2 - 0.95, -L / 2 + 1.0]);
    addLights(W, 1.05, L / 2 + 0.01, -L / 2 - 0.01);
  } else {
    // Sedan or taxi.
    L = 4.5;
    W = 1.76;
    const color = kind === "taxi" ? ["#e8e3d6", "#c9ccd0", "#d8d2c2", "#b7bcc2"][Math.floor(rnd() * 4)] : ["#b9c4cc", "#7A2E2E", "#1f3a5f", "#e8e8e6", "#2b2b2b", "#556B2F", "#c9a227"][Math.floor(rnd() * 7)];
    const bm = paint(color);
    group.add(mesh(rbox(W, 0.62, L, 0.2), bm, 0, 0.66, 0));
    const cabin = mesh(rbox(W * 0.88, 0.56, L * 0.5, 0.2), glass, 0, 1.2, -0.15);
    group.add(cabin);
    group.add(mesh(rbox(W * 0.84, 0.08, L * 0.42, 0.04), bm, 0, 1.47, -0.18));
    for (const s of [-1, 1]) group.add(mesh(rbox(0.06, 0.5, 0.08, 0.02), bm, s * (W * 0.43), 1.2, -0.15));
    group.add(mesh(rbox(W * 0.6, 0.16, 0.05, 0.03), black, 0, 0.68, L / 2 + 0.005));
    if (kind === "taxi") {
      // Accra taxis: yellow front and rear quarter panels.
      for (const z of [L / 2 - 0.55, -L / 2 + 0.55])
        for (const s of [-1, 1]) {
          const p = mesh(rbox(0.04, 0.5, 1.0, 0.02), yellow, s * (W / 2 + 0.005), 0.66, z);
          group.add(p);
        }
      group.add(mesh(rbox(W * 0.5, 0.03, 1.0, 0.01), yellow, 0, 0.98, L / 2 - 0.55));
      const sign = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.16, 0.22), new THREE.MeshStandardMaterial({ color: "#f2c200", emissive: "#f2c200", emissiveIntensity: 0.2 }));
      sign.position.set(0, 1.6, -0.15);
      group.add(sign);
      lights.push(sign.material as THREE.MeshStandardMaterial);
    }
    addWheels(0.33, 0.22, W / 2 - 0.1, [L / 2 - 0.8, -L / 2 + 0.85]);
    addLights(W, 0.78, L / 2 + 0.01, -L / 2 - 0.01);
    addPlate(0.5, -L / 2 - 0.015, true);
  }
  // Soft contact shadow under the car to ground it.
  const blob = new THREE.Mesh(new THREE.PlaneGeometry(W * 1.15, L * 1.05), shadowBlob());
  blob.rotation.x = -Math.PI / 2;
  blob.position.y = 0.02;
  group.add(blob);
  return { group, wheels, lights, brake, kind, length: L, width: W };
}

let blobMat: THREE.MeshBasicMaterial | null = null;
export function shadowBlob() {
  if (blobMat) return blobMat;
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const ctx = c.getContext("2d")!;
  const g = ctx.createRadialGradient(64, 64, 10, 64, 64, 64);
  g.addColorStop(0, "rgba(0,0,0,0.55)");
  g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  blobMat = new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false });
  return blobMat;
}

const glowMats = new WeakMap<THREE.Object3D, [THREE.MeshBasicMaterial, THREE.MeshBasicMaterial]>();

export function setVehicleLights(v: VehicleRig, night: boolean, braking: boolean) {
  const g = glowMats.get(v.group);
  if (g) {
    g[0].opacity = night ? 0.95 : 0;
    g[1].opacity = braking ? 0.95 : night ? 0.55 : 0;
  }
  for (const m of v.lights) m.emissiveIntensity = night ? 2.4 : 0.05;
  v.brake.emissiveIntensity = braking ? 2.5 : night ? 0.9 : 0.12;
}

export function spinWheels(v: VehicleRig, distance: number) {
  for (const w of v.wheels) w.rotation.x += distance / 0.35;
}

// ---------------------------------------------------------------------------
// Aircraft (for the airport apron, hangars and the planes you own).

export type AircraftKind = "prop_plane" | "turboprop" | "bizjet" | "helicopter" | "airliner";

export function buildAircraft(kind: AircraftKind, livery = "#f4f4f2", stripe = "#c8452c"): THREE.Group {
  const g = new THREE.Group();
  const body = paint(livery);
  const accent = paint(stripe);
  const dark = black;
  const win = glass;
  const add = (o: THREE.Object3D) => (g.add(o), o);
  const cyl = (r0: number, r1: number, len: number, m: THREE.Material, z: number, y: number, x = 0) => {
    const c = mesh(new THREE.CylinderGeometry(r1, r0, len, 20), m, x, y, z);
    c.rotation.x = Math.PI / 2;
    return add(c);
  };
  const wing = (span: number, chordRoot: number, chordTip: number, y: number, z: number, sweep: number, m: THREE.Material = body) => {
    for (const s of [-1, 1]) {
      const shape = new THREE.Shape([new THREE.Vector2(0, 0), new THREE.Vector2(span / 2, -sweep), new THREE.Vector2(span / 2, -sweep - chordTip), new THREE.Vector2(0, -chordRoot)]);
      const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.12, bevelEnabled: false });
      geo.rotateX(Math.PI / 2);
      const w = mesh(geo, m, 0, y, z);
      w.scale.x = s;
      add(w);
    }
  };
  if (kind === "helicopter") {
    add(mesh(new THREE.SphereGeometry(1.1, 20, 14), body, 0, 1.5, 0.6)).scale.set(1, 0.9, 1.4);
    add(mesh(new THREE.SphereGeometry(0.95, 20, 14, 0, Math.PI * 2, 0, Math.PI / 2.2), win, 0, 1.55, 1.3)).rotation.x = 0.9;
    cyl(0.32, 0.12, 5.2, body, -2.8, 1.75);
    add(mesh(rbox(0.08, 1.2, 0.8, 0.03), accent, 0, 2.3, -5.2));
    for (const s of [-1, 1]) add(mesh(rbox(0.08, 0.08, 3.2, 0.03), dark, s * 0.85, 0.2, 0.5));
    for (const s of [-1, 1]) for (const z of [-0.4, 1.4]) add(mesh(rbox(0.06, 0.6, 0.06, 0.02), dark, s * 0.85, 0.5, z));
    add(mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.5, 10), dark, 0, 2.6, 0.5));
    for (let i = 0; i < 4; i++) { const b = add(mesh(rbox(0.25, 0.04, 9.5, 0.02), dark, 0, 2.86, 0.5)); b.rotation.y = (i * Math.PI) / 4; }
    return g;
  }
  const L = kind === "airliner" ? 38 : kind === "bizjet" ? 26 : kind === "turboprop" ? 13.5 : 8.3;
  const R = kind === "airliner" ? 2.0 : kind === "bizjet" ? 1.2 : kind === "turboprop" ? 0.85 : 0.6;
  const yc = kind === "prop_plane" ? 1.15 : R + (kind === "airliner" ? 1.6 : 0.9);
  cyl(R, R, L * 0.7, body, 0, yc);
  add(mesh(new THREE.SphereGeometry(R, 20, 14), body, 0, yc, L * 0.35)).scale.set(1, 1, 1.9);
  cyl(R, R * 0.25, L * 0.28, body, -L * 0.49, yc + R * 0.25);
  // Cockpit glass and a cabin window line.
  add(mesh(new THREE.SphereGeometry(R, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), win, 0, yc + R * 0.35, L * 0.37)).scale.set(0.82, 0.4, 0.9);
  for (const s of [-1, 1]) add(mesh(rbox(0.02, R * 0.13, L * 0.5, 0.01), dark, s * R * 0.99, yc + R * 0.3, -L * 0.02));
  add(mesh(rbox(R * 2.02, R * 0.18, L * 0.7, 0.02), accent, 0, yc - R * 0.2, 0)).scale.set(1, 1, 1);
  // Tail fin and stabilisers.
  const finH = kind === "airliner" ? 6 : kind === "bizjet" ? 4.2 : kind === "turboprop" ? 3 : 1.5;
  const fin = add(mesh(rbox(0.18, finH, L * 0.13, 0.05), accent, 0, yc + R * 0.4 + finH / 2, -L * 0.53));
  fin.rotation.x = -0.3;
  const tailY = kind === "bizjet" ? yc + R + finH - 0.4 : yc + R * 0.3;
  add(mesh(rbox(L * 0.36, 0.12, L * 0.08, 0.04), body, 0, tailY, -L * 0.58));
  if (kind === "prop_plane") {
    // High wing (Cessna-style) with struts and a nose propeller.
    add(mesh(rbox(11, 0.14, 1.5, 0.05), body, 0, yc + R + 0.15, L * 0.08));
    for (const s of [-1, 1]) { const st = add(mesh(rbox(0.06, 1.3, 0.08, 0.02), dark, s * 1.6, yc + 0.2, L * 0.08)); st.rotation.z = s * 0.7; }
    add(mesh(rbox(0.12, 1.9, 0.12, 0.03), dark, 0, yc, L * 0.35 + R * 1.9));
    for (const s of [-1, 1]) add(mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.95, 8), dark, s * 0.9, 0.48, L * 0.05));
    add(mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.95, 8), dark, 0, 0.48, L * 0.32));
  } else {
    const span = kind === "airliner" ? 34 : kind === "bizjet" ? 27 : 16;
    wing(span, L * 0.2, L * 0.07, yc - R * 0.5, L * 0.08, kind === "turboprop" ? 0.3 : L * 0.16);
    if (kind === "turboprop") {
      for (const s of [-1, 1]) {
        cyl(0.42, 0.42, 3, body, L * 0.12, yc - R * 0.35, s * 3.2);
        add(mesh(rbox(0.12, 2.6, 0.12, 0.03), dark, s * 3.2, yc - R * 0.35, L * 0.12 + 1.6));
      }
    } else {
      // Rear-mounted jet engines (bizjet) or under-wing engines (airliner).
      for (const s of [-1, 1]) {
        if (kind === "bizjet") { cyl(0.55, 0.5, 3.6, body, -L * 0.36, yc + R * 0.5, s * (R + 0.65)); add(mesh(rbox(0.7, 0.15, 1.4, 0.04), body, s * (R + 0.2), yc + R * 0.5, -L * 0.36)); }
        else { cyl(1.1, 1.0, 4.2, body, L * 0.12, yc - R - 0.6, s * 6); cyl(0.95, 0.95, 0.1, dark, L * 0.12 + 2.12, yc - R - 0.6, s * 6); add(mesh(rbox(0.25, 1.7, 3, 0.05), body, s * 6, yc - R + 0.55, L * 0.1)); }
      }
    }
    for (const s of [-1, 1]) add(mesh(new THREE.CylinderGeometry(0.12, 0.12, yc - R + 0.3, 8), dark, s * R * 1.4, (yc - R) / 2, -L * 0.05));
    add(mesh(new THREE.CylinderGeometry(0.1, 0.1, yc - R + 0.3, 8), dark, 0, (yc - R) / 2, L * 0.3));
  }
  return g;
}
