// Vehicles: sedans, Accra taxis (yellow corner panels), trotros with painted
// slogans, SUVs and the V8. Rounded bodies, clear-coat paint, glass, rims.
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { plate, signboard, trotroLivery } from "./textures.ts";
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
function paint(color: string) {
  let m = paints.get(color);
  if (!m) {
    m = new THREE.MeshPhysicalMaterial({ color, metalness: 0.45, roughness: 0.32, clearcoat: 1, clearcoatRoughness: 0.08 });
    paints.set(color, m);
  }
  return m;
}
const glass = new THREE.MeshPhysicalMaterial({ color: "#1d2830", metalness: 0.2, roughness: 0.04, clearcoat: 1, envMapIntensity: 1.6 });
const rubber = new THREE.MeshStandardMaterial({ color: "#151515", roughness: 0.92 });
const chrome = new THREE.MeshStandardMaterial({ color: "#d8dde2", metalness: 1, roughness: 0.18 });
const alloy = new THREE.MeshStandardMaterial({ color: "#9aa1a8", metalness: 0.9, roughness: 0.3 });
const black = new THREE.MeshStandardMaterial({ color: "#0e0e10", roughness: 0.55 });
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
const tireGeo = new THREE.CylinderGeometry(1, 1, 1, 22);
tireGeo.rotateZ(Math.PI / 2);
const rimGeo = new THREE.CylinderGeometry(1, 1, 1, 10);
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
  for (let i = 0; i < 5; i++) {
    const spoke = mesh(spokeGeo, chrome);
    spoke.scale.set(w * 1.08, r * 0.1, r * 1.15);
    spoke.rotation.x = (i / 5) * Math.PI;
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
  phantom: { L: 5.8, W: 2.0, R: 0.4, clr: 0.18, wf: 1.95, wr: -1.65, tail: 1.06, deck: 1.1, belt: 1.12, hood: 1.12, nose: 1.06, cab: [-1.95, -1.4, 0.55, 1.15, 1.66], noseLen: 0.08 },
};

const profileCache = new Map<string, { body: THREE.BufferGeometry; glass: THREE.BufferGeometry; roof: THREE.BufferGeometry }>();

function extrude(points: [number, number][], depth: number, bevel: number) {
  const shape = new THREE.Shape(points.map(([z, y]) => new THREE.Vector2(z, y)));
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
  const out = { body: extrude(body, c.W, 0.08), glass: extrude(greenhouse, c.W * 0.86, 0.04), roof: extrude(roofSlab, c.W * 0.88, 0.03) };
  profileCache.set(kind, out);
  return out;
}

const darkTrim = new THREE.MeshStandardMaterial({ color: "#16171a", roughness: 0.45, metalness: 0.2 });
const grilleMat = new THREE.MeshStandardMaterial({ color: "#0b0b0c", roughness: 0.35, metalness: 0.5 });
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
    group.add(mesh(rbox(0.04, roof - c.belt - 0.05, 0.1, 0.01), darkTrim, sx * (hW * 0.86 + 0.005), (roof + c.belt) / 2, bz));
    group.add(mesh(rbox(0.03, 0.035, fBase - rBase - 0.2, 0.01), chromeTrim ? chrome : darkTrim, sx * (hW * 0.86 + 0.01), c.belt + 0.01, (fBase + rBase) / 2));
    // Mirrors.
    group.add(mesh(rbox(0.16, 0.1, 0.12, 0.03), kind === "taxi" ? bm : darkTrim, sx * (hW + 0.06), c.belt + 0.1, fBase - 0.1));
    // Door seams and handles.
    for (const z of kind === "supercar" ? [fBase - 0.05] : [fBase - 0.05, bz - 0.04, rBase + 0.25]) {
      const seam = new THREE.Mesh(new THREE.PlaneGeometry(0.012, c.belt - c.clr - 0.25), seamMat);
      seam.position.set(sx * (hW + 0.002), (c.belt + c.clr + 0.2) / 2, z);
      seam.rotation.y = (sx * Math.PI) / 2;
      group.add(seam);
    }
    if (kind !== "supercar") for (const z of [bz + 0.35, rBase + 0.6]) group.add(mesh(rbox(0.02, 0.03, 0.16, 0.01), chromeTrim ? chrome : darkTrim, sx * (hW + 0.004), c.belt - 0.12, z));
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
    const grilleH = kind === "phantom" ? 0.55 : kind === "v8" || kind === "pickup" ? 0.38 : kind === "saloon" ? 0.28 : 0.18;
    const grilleW = kind === "phantom" ? 0.62 : kind === "v8" || kind === "pickup" ? 1.2 : kind === "saloon" ? 0.62 : 0.9;
    const gy = c.nose - grilleH / 2 - 0.06;
    group.add(mesh(rbox(grilleW, grilleH, 0.06, 0.02), kind === "phantom" || kind === "saloon" || kind === "v8" ? chrome : grilleMat, 0, gy, h - 0.01));
    if (kind === "phantom" || kind === "saloon") for (let i = -3; i <= 3; i++) group.add(mesh(rbox(0.02, grilleH * 0.9, 0.07, 0.005), grilleMat, (i * grilleW) / 8, gy, h));
    for (const sx of [-1, 1]) {
      const hl = mesh(rbox(kind === "accordo" ? 0.45 : 0.34, kind === "v8" ? 0.16 : 0.12, 0.08, 0.03), head, sx * (hW - 0.32), c.nose - 0.08, h - 0.04);
      group.add(hl);
      group.add(mesh(rbox(kind === "accordo" || kind === "saloon" ? 0.5 : 0.32, 0.12, 0.06, 0.03), brake, sx * (hW - 0.3), c.tail - 0.1, -h + 0.03));
    }
    if (kind === "accordo") group.add(mesh(rbox(c.W - 0.6, 0.03, 0.04, 0.01), brake, 0, c.tail - 0.1, -h + 0.025)); // light bar
    group.add(mesh(rbox(c.W - 0.1, 0.16, 0.12, 0.05), kind === "v8" || kind === "pickup" ? darkTrim : bm, 0, c.clr + 0.16, h - 0.04));
    group.add(mesh(rbox(c.W - 0.1, 0.16, 0.12, 0.05), kind === "v8" || kind === "pickup" ? darkTrim : bm, 0, c.clr + 0.16, -h + 0.05));
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
  addWheelsAt(c.R, kind === "supercar" ? 0.3 : kind === "v8" || kind === "pickup" ? 0.3 : 0.23, hW - 0.14, [c.wf, c.wr]);
  addPlate(c.clr + 0.32, -h - 0.005, true);
  return [c.L, c.W];
}

const SLOGANS = ["EYE ADOM", "NYAME BEKYERE", "STILL I RISE", "NO CONDITION IS PERMANENT", "GOD NEVER SLEEPS", "SIKA NKO BIA", "ONE MAN NO CHOP", "SUCCESS IS A JOURNEY", "FEAR WOMEN", "OBAA YAA", "AWURADE KASA", "NO WAHALA"];
const ROUTES = ["CIRCLE", "KANESHIE", "LA", "MADINA", "TEMA STN", "ACHIMOTA", "OSU", "SPINTEX", "LAPAZ", "37"];

export function buildVehicle(kind: VehicleKind, seed: number): VehicleRig {
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
  const addPlate = (y: number, z: number, flip: boolean) => {
    const p = new THREE.Mesh(new THREE.PlaneGeometry(0.52, 0.13), new THREE.MeshStandardMaterial({ map: plate(`GR ${1000 + Math.floor(rnd() * 8999)}-${20 + Math.floor(rnd() * 6)}`), roughness: 0.5 }));
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
  } else if (kind === "trotro") {
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
