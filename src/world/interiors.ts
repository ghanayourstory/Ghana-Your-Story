// Homes from the inside, by what kind of home they are. A compound room opens
// onto a shared courtyard (the bathroom is at the far end, the coal pot by your
// door); a penthouse is glass, marble and an island kitchen over the city.
// Owned furniture and appliances show up on top of what the home comes with.
import * as THREE from "three";
import { Batcher, G } from "./batch.ts";
import * as T from "./textures.ts";
import type { HomeSpec } from "../../shared/homes.ts";
import { FINISHES, footprint, fullyFurnished, manorDims, type Finishes, type Furnishing, type PlacedPiece } from "../../shared/furnish.ts";

export type Pose = "lie" | "sit" | "squat" | "stand" | "bath" | "swim" | "hidden";
export interface SpotUse {
  /** Where the body goes (feet, or hips when sitting / lying). */
  x: number; y: number; z: number;
  /** What the person faces (or, lying down, where the head points). */
  look: [number, number];
  pose: Pose;
}
export interface InteriorSpot {
  id: "bed" | "bath" | "tv" | "kitchen" | "coalpot" | "neighbours" | "terrace" | "pool" | "exit";
  pos: THREE.Vector3;
  label: string;
  use?: SpotUse;
}
/** A wall the camera can cut down when it stands between you and the camera. */
export interface CutWall {
  mesh: THREE.Mesh;
  axis: "x" | "z";
  c: number;
  h: number;
  /** Bottom of the piece (0 for walls, above the door for lintels). */
  base: number;
}
export type Rect = { minX: number; maxX: number; minZ: number; maxZ: number };
/** One floor of a storey building. The ground floor has no group of its own (it's the interior group). */
export interface Level {
  y: number;
  group: THREE.Group | null;
  colliders: Rect[];
  /** Places on this floor with nothing to stand on (beyond the balcony rail). */
  blocked: Rect[];
}
export interface Interior {
  group: THREE.Group;
  /** Hand-placed pieces, for tapping them in edit mode. */
  placed?: { id: number; piece: string; level: number; minX: number; maxX: number; minZ: number; maxZ: number }[];
  /** Doorways to keep clear when placing furniture, by floor. */
  clear?: { level: number; minX: number; maxX: number; minZ: number; maxZ: number }[];
  /** Storey buildings: the floors, and the straight flights that climb from one to the next. */
  storeys?: { levels: Level[]; flights: { from: number; x0: number; x1: number; zStart: number; zEnd: number }[] };
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
  colliders: { minX: number; maxX: number; minZ: number; maxZ: number }[];
  spots: InteriorSpot[];
  walls: CutWall[];
  door: THREE.Vector3;
  bed: THREE.Vector3;
  size: [number, number];
}

// ---------------------------------------------------------------------------
// Surfaces

const texCache = new Map<string, THREE.Texture>();
function canvasTex(key: string, w: number, h: number, draw: (c: CanvasRenderingContext2D) => void, repeat: [number, number] = [1, 1]) {
  let t = texCache.get(key);
  if (!t) {
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    draw(c.getContext("2d")!);
    t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = 4;
    texCache.set(key, t);
  }
  const out = t.clone();
  out.repeat.set(...repeat);
  out.needsUpdate = true;
  return out;
}
const rnd = (() => { let s = 7; return () => ((s = (s * 16807) % 2147483647) / 2147483647); })();
const tiles = (base: string, grout: string, n = 4) => (c: CanvasRenderingContext2D) => {
  const S = 256, step = S / n;
  c.fillStyle = grout;
  c.fillRect(0, 0, S, S);
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    const v = 0.93 + rnd() * 0.1;
    const col = new THREE.Color(base).multiplyScalar(v);
    c.fillStyle = `#${col.getHexString()}`;
    c.fillRect(i * step + 1.5, j * step + 1.5, step - 3, step - 3);
  }
};
const marble = (base: string, vein: string) => (c: CanvasRenderingContext2D) => {
  c.fillStyle = base;
  c.fillRect(0, 0, 512, 512);
  c.strokeStyle = vein;
  for (let k = 0; k < 26; k++) {
    c.globalAlpha = 0.08 + rnd() * 0.2;
    c.lineWidth = 0.6 + rnd() * 2.2;
    c.beginPath();
    let x = rnd() * 512, y = rnd() * 512;
    c.moveTo(x, y);
    for (let i = 0; i < 8; i++) { x += (rnd() - 0.3) * 90; y += (rnd() - 0.5) * 90; c.lineTo(x, y); }
    c.stroke();
  }
  c.globalAlpha = 1;
  c.strokeStyle = "rgba(0,0,0,0.12)";
  c.lineWidth = 2;
  c.strokeRect(0, 0, 512, 512);
};
const woodFloor = (c: CanvasRenderingContext2D) => {
  for (let i = 0; i < 16; i++) {
    const col = new THREE.Color("#8a5a3b").multiplyScalar(0.85 + rnd() * 0.3);
    c.fillStyle = `#${col.getHexString()}`;
    c.fillRect(0, i * 32, 512, 31);
    c.fillStyle = "rgba(0,0,0,0.25)";
    c.fillRect(rnd() * 512, i * 32, 2, 32);
    for (let g = 0; g < 6; g++) { c.fillStyle = `rgba(40,20,10,${0.05 + rnd() * 0.08})`; c.fillRect(rnd() * 512, i * 32 + rnd() * 30, 60 + rnd() * 120, 1); }
  }
};
const skyline = (c: CanvasRenderingContext2D) => {
  const g = c.createLinearGradient(0, 0, 0, 512);
  g.addColorStop(0, "#1a2a4a");
  g.addColorStop(0.55, "#e0855a");
  g.addColorStop(1, "#3a2a2a");
  c.fillStyle = g;
  c.fillRect(0, 0, 1024, 512);
  for (let i = 0; i < 70; i++) {
    const w = 18 + rnd() * 50, h = 60 + rnd() * 240, x = rnd() * 1024;
    c.fillStyle = `rgba(${20 + rnd() * 30},${22 + rnd() * 30},${34 + rnd() * 30},0.95)`;
    c.fillRect(x, 512 - h, w, h);
    for (let k = 0; k < h / 9; k++) for (let m = 0; m < w / 8; m++) if (rnd() < 0.35) { c.fillStyle = rnd() < 0.8 ? "#ffd98a" : "#cfe6ff"; c.fillRect(x + 2 + m * 8, 512 - h + 4 + k * 9, 3, 4); }
  }
};

type M = THREE.Material;
const matCache = new Map<string, M>();
const mat = (key: string, make: () => M) => matCache.get(key) ?? (matCache.set(key, make()), matCache.get(key)!);
const std = (key: string, p: THREE.MeshStandardMaterialParameters) => mat(key, () => new THREE.MeshStandardMaterial({ roughness: 0.8, ...p }));

const MAT = {
  concreteFloor: () => std("cfloor", { map: T.concrete("#9c9488", 91), roughness: 0.95 }),
  terrazzo: () => std("terrazzo", { map: canvasTex("terrazzo", 256, 256, tiles("#cbbfae", "#8e8476", 4), [6, 6]), roughness: 0.55 }),
  floorTiles: () => std("ftiles", { map: canvasTex("ftile", 256, 256, tiles("#d8d2c6", "#9a948a", 4), [8, 8]), roughness: 0.35 }),
  bathTiles: () => std("btiles", { map: canvasTex("btile", 256, 256, tiles("#e9f1f2", "#a9b6b8", 8), [3, 3]), roughness: 0.2 }),
  marble: () => std("marble", { map: canvasTex("marble", 512, 512, marble("#efe9e0", "#7d746a"), [5, 5]), roughness: 0.12, metalness: 0.05 }),
  darkMarble: () => std("dmarble", { map: canvasTex("dmarble", 512, 512, marble("#2a2725", "#c9b78a"), [1, 1]), roughness: 0.15 }),
  wood: () => std("wfloor", { map: canvasTex("wood", 512, 512, woodFloor, [4, 4]), roughness: 0.45 }),
  plaster: (tint: string) => std(`plaster:${tint}`, { map: T.plaster(), color: tint, roughness: 0.92 }),
  mud: () => std("mud", { map: T.concrete("#b7834f", 57), roughness: 1 }),
  thatch: () => std("thatch", { map: T.thatch(), color: "#c8a86a", roughness: 1 }),
  zinc: () => std("zinc", { map: T.corrugated(true), roughness: 0.6, metalness: 0.4 }),
  doorWood: () => std("doorwood", { color: "#5b3a24", roughness: 0.6 }),
  darkWood: () => std("darkwood", { color: "#3b2416", roughness: 0.5 }),
  lightWood: () => std("lightwood", { color: "#a77b52", roughness: 0.6 }),
  white: () => std("white", { color: "#f4f2ec", roughness: 0.4 }),
  ceramic: () => std("ceramic", { color: "#fbfbf8", roughness: 0.15 }),
  steel: () => std("steel", { color: "#c9ccd0", roughness: 0.25, metalness: 0.8 }),
  black: () => std("black", { color: "#151515", roughness: 0.4 }),
  glass: () => mat("glass", () => new THREE.MeshPhysicalMaterial({ color: "#cfe3ea", roughness: 0.05, transmission: 0.6, transparent: true, opacity: 0.35, metalness: 0 })),
  water: () => std("poolwater", { color: "#2aa8c8", roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.85 }),
  grass: () => std("lawn", { map: T.grass(true), roughness: 1 }),
  // Indoors everything is plain cloth in softened colours: no wax-print or kente patterns on beds, rugs or curtains.
  fabric: (_pattern: "wax" | "kente" | "plain" | "stripe", color: string) => { const c = soften(color); return std(`fab:plain:${c}`, { map: T.fabric("plain", c), roughness: 0.95 }); },
  color: (c: string, rough = 0.7, metal = 0) => std(`c:${c}:${rough}:${metal}`, { color: c, roughness: rough, metalness: metal }),
  skyline: () => mat("skyline", () => new THREE.MeshBasicMaterial({ map: canvasTex("skyline", 1024, 512, skyline) })),
  bars: () => std("bars", { color: "#2b2b2b", roughness: 0.5, metalness: 0.6 }),
  glow: (c: string, i = 2.2) => std(`glow:${c}:${i}`, { color: c, emissive: c, emissiveIntensity: i, roughness: 0.4 }),
};

// ---------------------------------------------------------------------------
// Builder

/** Pull a bright colour towards a warm neutral, for fabrics. */
function soften(hex: string) {
  return "#" + new THREE.Color(hex).lerp(new THREE.Color("#d9d0c1"), 0.55).getHexString();
}

class Room {
  b = new Batcher();
  /** A local frame (origin and turn about y) for furnishing a room whichever wall the bed's on. */
  private xf: { ox: number; oz: number; a: number } | null = null;
  turned(ox: number, oz: number, a: number, fn: () => void) {
    const prev = this.xf;
    this.xf = { ox, oz, a };
    fn();
    this.xf = prev;
  }
  /** Local point to world (identity outside a turned frame). */
  pt(x: number, z: number): [number, number] {
    const f = this.xf;
    if (!f) return [x, z];
    const c = Math.cos(f.a), s = Math.sin(f.a);
    return [f.ox + x * c + z * s, f.oz - x * s + z * c];
  }
  private get swap() { return !!this.xf && Math.abs(Math.sin(this.xf.a)) > 0.5; }
  add(geo: THREE.BufferGeometry, m: M, pos: [number, number, number], rot: [number, number, number], scale: [number, number, number]) {
    const [x, z] = this.pt(pos[0], pos[2]);
    const a = this.xf?.a ?? 0, c = Math.cos(a), s = Math.sin(a);
    this.b.add(geo, m, [x, pos[1], z], [rot[0] * c + rot[2] * s, rot[1] + a, -rot[0] * s + rot[2] * c], scale);
  }
  /** Build things hung on a wall (AC, art, curtains) so they hide when the cutaway lowers that wall. */
  onWall(axis: "x" | "z", c: number, fn: () => void) {
    const prev = this.b;
    this.b = new Batcher();
    fn();
    const g = this.b.build();
    this.b = prev;
    this.extra.add(g);
    if (this.xf) {
      // A wall line in the local frame, as a world axis and position.
      const [wx, wz] = this.pt(axis === "x" ? 0 : c, axis === "x" ? c : 0);
      const turnedAxis = this.swap ? (axis === "x" ? "z" : "x") : axis;
      this.walls.push({ mesh: g as unknown as THREE.Mesh, axis: turnedAxis, c: turnedAxis === "x" ? wz : wx, h: 1, base: 1 });
    } else this.walls.push({ mesh: g as unknown as THREE.Mesh, axis, c, h: 1, base: 1 });
  }
  extra = new THREE.Group();
  colliders: Interior["colliders"] = [];
  spots: InteriorSpot[] = [];
  walls: CutWall[] = [];
  uses = new Map<InteriorSpot["id"], SpotUse>();
  /** Doorways: keep furniture out of these. */
  clear: { minX: number; maxX: number; minZ: number; maxZ: number }[] = [];
  /** Full wall height for this home; low "cut" walls are raised to it and cut by the camera instead. */
  wallH = 2.9;
  /** A solid, separately drawn wall piece (so it can be cut away). */
  cutBox(m: M, x: number, y: number, z: number, w: number, h: number, d: number, solid = true) {
    const mesh = new THREE.Mesh(G.box, m);
    mesh.position.set(x, y, z);
    mesh.scale.set(w, h, d);
    this.extra.add(mesh);
    const axis = w >= d ? "x" : "z";
    this.walls.push({ mesh, axis, c: axis === "x" ? z : x, h, base: y - h / 2 });
    if (solid) this.colliders.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2 });
  }
  use(id: InteriorSpot["id"], x: number, y: number, z: number, look: [number, number], pose: Pose) {
    this.uses.set(id, { x, y, z, look, pose });
  }
  box(m: M, x: number, y: number, z: number, w: number, h: number, d: number, solid = false, ry = 0) {
    this.add(G.box, m, [x, y, z], [0, ry, 0], [w, h, d]);
    if (solid) {
      const [wx, wz] = this.pt(x, z);
      const [cw, cd] = this.swap ? [d, w] : [w, d];
      this.colliders.push({ minX: wx - cw / 2, maxX: wx + cw / 2, minZ: wz - cd / 2, maxZ: wz + cd / 2 });
    }
  }
  cyl(m: M, x: number, y: number, z: number, r: number, h: number, rx = 0, rz = 0) {
    this.add(G.cyl, m, [x, y, z], [rx, 0, rz], [r, h, r]);
  }
  floor(m: M, x0: number, z0: number, x1: number, z1: number, y = 0) {
    this.box(m, (x0 + x1) / 2, y - 0.05, (z0 + z1) / 2, x1 - x0, 0.1, z1 - z0);
  }
  /** A wall from (x0,z0) to (x1,z1), axis-aligned, with optional door gap [from,to] along it. */
  wall(m: M, x0: number, z0: number, x1: number, z1: number, h: number, gap?: [number, number], t = 0.14) {
    if (h <= 1.2) h = this.wallH;
    const along = x0 === x1 ? "z" : "x";
    const a0 = along === "x" ? Math.min(x0, x1) : Math.min(z0, z1), a1 = along === "x" ? Math.max(x0, x1) : Math.max(z0, z1);
    const segs: [number, number][] = gap ? [[a0, gap[0]], [gap[1], a1]] : [[a0, a1]];
    for (const [s, e] of segs) {
      if (e - s < 0.05) continue;
      const mid = (s + e) / 2, len = e - s;
      if (along === "x") this.cutBox(m, mid, h / 2, z0, len, h, t);
      else this.cutBox(m, x0, h / 2, mid, t, h, len);
    }
    if (gap) this.clear.push(along === "x" ? { minX: gap[0], maxX: gap[1], minZ: z0 - 0.9, maxZ: z0 + 0.9 } : { minX: x0 - 0.9, maxX: x0 + 0.9, minZ: gap[0], maxZ: gap[1] });
    if (gap && h > 2.3) {
      // Lintel over the doorway.
      const mid = (gap[0] + gap[1]) / 2, len = gap[1] - gap[0];
      if (along === "x") this.cutBox(m, mid, (h + 2.1) / 2, z0, len, h - 2.1, t, false);
      else this.cutBox(m, x0, (h + 2.1) / 2, mid, t, h - 2.1, len, false);
    }
  }
  door(x: number, z: number, along: "x" | "z", open = 1.1) {
    // Frame and a leaf swung open.
    const fm = MAT.doorWood();
    if (along === "x") {
      this.box(fm, x - 0.47, 1.05, z, 0.06, 2.1, 0.16);
      this.box(fm, x + 0.47, 1.05, z, 0.06, 2.1, 0.16);
      this.box(fm, x, 2.1, z, 1.0, 0.08, 0.16);
      this.add(G.box, MAT.lightWood(), [x - 0.45 + Math.cos(open) * 0.43, 1.02, z + Math.sin(open) * 0.43], [0, -open, 0], [0.86, 2.0, 0.045]);
    } else {
      this.box(fm, x, 1.05, z - 0.47, 0.16, 2.1, 0.06);
      this.box(fm, x, 1.05, z + 0.47, 0.16, 2.1, 0.06);
      this.box(fm, x, 2.1, z, 0.16, 0.08, 1.0);
      this.add(G.box, MAT.lightWood(), [x + Math.sin(open) * 0.43, 1.02, z - 0.45 + Math.cos(open) * 0.43], [0, Math.PI / 2 - open, 0], [0.86, 2.0, 0.045]);
    }
  }
  /** Window on a back wall (facing +z): frame, glass, burglar bars and optional curtains. */
  window(x: number, z: number, w: number, y = 1.5, h = 1.2, curtains = "#e9e2d0", bars = true) {
    this.box(MAT.white(), x, y, z + 0.06, w + 0.12, h + 0.12, 0.05);
    this.box(MAT.glass(), x, y, z + 0.08, w, h, 0.02);
    if (bars) for (let i = 1; i < 6; i++) this.box(MAT.bars(), x - w / 2 + (i * w) / 6, y, z + 0.12, 0.025, h, 0.025);
    if (curtains) for (const s of [-1, 1]) this.box(MAT.color(curtains, 0.95), x + s * (w / 2 + 0.05), y + 0.05, z + 0.16, 0.3, h + 0.35, 0.04);
  }
  spot(id: InteriorSpot["id"], x: number, z: number, label: string) {
    this.spots.push({ id, pos: new THREE.Vector3(x, 0, z), label });
  }
}

// ---------------------------------------------------------------------------
// Furniture

function mattressFloor(r: Room, x: number, z: number, cloth = "#1F7A4D") {
  r.box(MAT.fabric("wax", cloth), x, 0.1, z, 1.3, 0.2, 1.95, true);
  r.box(MAT.white(), x, 0.24, z - 0.75, 0.9, 0.1, 0.35);
}
function bed(r: Room, x: number, z: number, size: "double" | "king", frame: "wood" | "upholstered", cloth = "#C8452C") {
  const w = size === "king" ? 2.0 : 1.55, d = 2.15;
  const fm = frame === "wood" ? MAT.darkWood() : MAT.color("#8e7b6b", 0.95);
  r.box(fm, x, 0.22, z, w + 0.1, 0.44, d, true);
  r.box(MAT.white(), x, 0.58, z + 0.04, w, 0.26, d - 0.1);
  r.box(MAT.fabric(size === "king" ? "plain" : "kente", cloth), x, 0.73, z + 0.38, w + 0.04, 0.05, 1.2);
  r.box(MAT.white(), x - w / 4, 0.78, z - 0.78, w * 0.4, 0.14, 0.38);
  r.box(MAT.white(), x + w / 4, 0.78, z - 0.78, w * 0.4, 0.14, 0.38);
  r.box(fm, x, frame === "wood" ? 0.95 : 1.25, z - d / 2 - 0.04, w + 0.25, frame === "wood" ? 1.0 : 1.6, 0.1);
  for (const s of [-1, 1]) {
    r.box(MAT.darkWood(), x + s * (w / 2 + 0.38), 0.27, z - 0.8, 0.5, 0.54, 0.42, true);
    r.cyl(MAT.color("#f0dcb0", 0.6), x + s * (w / 2 + 0.38), 0.72, z - 0.8, 0.13, 0.32);
  }
}
function wardrobe(r: Room, x: number, z: number, w = 1.5, ry = 0) {
  r.box(MAT.darkWood(), x, 1.05, z, ry ? 0.6 : w, 2.1, ry ? w : 0.6, true);
  if (!ry) for (let i = 1; i < 3; i++) r.box(MAT.black(), x - w / 2 + (i * w) / 3, 1.05, z + 0.31, 0.01, 1.9, 0.01);
}
function clothesLine(r: Room, x0: number, x1: number, z: number, y = 1.9) {
  r.box(MAT.color("#ddd"), (x0 + x1) / 2, y, z, x1 - x0, 0.01, 0.01);
  const cols = ["#C8452C", "#1F5AA6", "#F2B705", "#ffffff", "#2E7D4F", "#B03A62"];
  for (let i = 0; i < 6; i++) r.box(MAT.color(cols[i]), x0 + 0.4 + i * ((x1 - x0 - 0.8) / 5), y - 0.33, z, 0.42, 0.62, 0.02);
}
function sofaSet(r: Room, x: number, z: number, kind: "wooden" | "fabric" | "leather" | "l_shape", facing = -1) {
  const m = kind === "leather" || kind === "l_shape" ? MAT.color("#3a2418", 0.45) : kind === "fabric" ? MAT.color("#8d8a84", 0.95) : MAT.color("#c9bba3", 0.95);
  const frame = kind === "wooden" ? MAT.darkWood() : m;
  const len = kind === "l_shape" ? 3.2 : 2.2;
  const back = z - facing * 0.4;
  r.box(frame, x, 0.22, z, len, 0.44, 0.9, true);
  r.box(m, x, 0.5, z, len - 0.1, 0.14, 0.82);
  r.box(frame, x, 0.75, back, len, 0.65, 0.18);
  for (const s of [-1, 1]) r.box(frame, x + s * (len / 2 - 0.08), 0.6, z, 0.16, 0.4, 0.9);
  if (kind === "l_shape") {
    r.box(frame, x - len / 2 + 0.45, 0.22, z + facing * 1.2, 0.9, 0.44, 1.6, true);
    r.box(m, x - len / 2 + 0.45, 0.5, z + facing * 1.2, 0.82, 0.14, 1.5);
  } else if (kind !== "fabric") {
    // Two single seats either side — the classic Ghanaian living room set.
    for (const s of [-1, 1]) {
      const sx = x + s * (len / 2 + 0.9), sz = z + facing * 0.9;
      r.box(frame, sx, 0.22, sz, 0.9, 0.44, 0.9, true);
      r.box(m, sx, 0.5, sz, 0.8, 0.14, 0.8);
      r.box(frame, sx + s * 0.4, 0.75, sz, 0.14, 0.65, 0.9);
    }
  }
}
function tvWall(r: Room, x: number, z: number, big: boolean) {
  r.box(MAT.darkWood(), x, 0.3, z, big ? 2.4 : 1.6, 0.6, 0.45, true);
  r.box(MAT.black(), x, big ? 1.45 : 1.15, z - 0.12, big ? 1.95 : 1.0, big ? 1.1 : 0.62, 0.05);
  r.box(MAT.color("#22324a", 0.1), x, big ? 1.45 : 1.15, z - 0.09, big ? 1.85 : 0.94, big ? 1.02 : 0.56, 0.01);
  r.box(MAT.black(), x + (big ? 0.9 : 0.6), 0.66, z, 0.3, 0.12, 0.25); // decoder
}
function coffeeTable(r: Room, x: number, z: number, glassTop = true) {
  r.box(glassTop ? MAT.glass() : MAT.darkWood(), x, 0.42, z, 1.1, 0.04, 0.6);
  r.box(MAT.steel(), x, 0.2, z, 0.9, 0.4, 0.04, true);
}
function diningSet(r: Room, x: number, z: number, seats: number, top: M = MAT.darkWood()) {
  const len = 0.65 * (seats / 2) + 0.4;
  r.box(top, x, 0.75, z, len, 0.06, 1.0, true);
  for (const s of [-1, 1]) for (let i = 0; i < seats / 2; i++) {
    const cx = x - len / 2 + 0.45 + i * 0.65, cz = z + s * 0.75;
    r.box(MAT.darkWood(), cx, 0.45, cz, 0.44, 0.05, 0.44);
    r.box(MAT.darkWood(), cx, 0.8, cz + s * 0.2, 0.44, 0.65, 0.04);
  }
}
function plasticChairs(r: Room, x: number, z: number, n: number) {
  for (let i = 0; i < n; i++) {
    const m = MAT.color(i % 2 ? "#f2f2ee" : "#c8352c", 0.6);
    const cx = x + i * 0.62;
    r.box(m, cx, 0.42, z, 0.45, 0.05, 0.45);
    r.box(m, cx, 0.7, z - 0.2, 0.45, 0.5, 0.05);
    for (const [dx, dz] of [[-0.2, -0.2], [0.2, -0.2], [-0.2, 0.2], [0.2, 0.2]]) r.box(m, cx + dx, 0.2, z + dz, 0.04, 0.42, 0.04);
  }
}
function displayCabinet(r: Room, x: number, z: number) {
  // Glass cabinet with the good plates and family photos — every Ghanaian hall.
  r.box(MAT.darkWood(), x, 0.9, z, 1.2, 1.8, 0.45, true);
  r.box(MAT.glass(), x, 1.2, z + 0.23, 1.05, 1.1, 0.01);
  for (let i = 0; i < 4; i++) r.cyl(MAT.ceramic(), x - 0.4 + i * 0.27, 1.05, z + 0.05, 0.1, 0.02, Math.PI / 2);
}
function fan(r: Room, x: number, z: number) {
  r.add(G.cyl8, MAT.black(), [x, 0.6, z], [0, 0, 0], [0.04, 1.2, 0.04]);
  r.add(G.cyl, MAT.color("#2E86AB", 0.5), [x, 1.3, z], [Math.PI / 2, 0, 0], [0.32, 0.08, 0.32]);
}
function bucketAndKettle(r: Room, x: number, z: number) {
  r.cyl(MAT.color("#2e6fae", 0.6), x, 0.2, z, 0.22, 0.4);
  r.cyl(MAT.color("#7a2e2e", 0.5), x + 0.45, 0.14, z + 0.1, 0.12, 0.28); // plastic kettle for the toilet
}
function coalPot(r: Room, x: number, z: number) {
  r.cyl(MAT.color("#5b5f66", 0.5, 0.6), x, 0.15, z, 0.2, 0.3);
  r.cyl(MAT.color("#1d1d1d", 0.9), x, 0.32, z, 0.16, 0.04);
  r.cyl(MAT.color("#9aa1a8", 0.3, 0.8), x, 0.45, z, 0.18, 0.22); // pot
  r.cyl(MAT.color("#ff5a1a", 0.9), x, 0.3, z + 0.12, 0.05, 0.02); // glowing charcoal
  r.box(MAT.color("#7a5a3a"), x + 0.35, 0.02, z, 0.25, 0.04, 0.35); // cardboard fan
}
function gasCylinderCooker(r: Room, x: number, z: number) {
  r.cyl(MAT.color("#1F5AA6", 0.4, 0.4), x, 0.3, z, 0.17, 0.6);
  r.box(MAT.steel(), x + 0.55, 0.75, z, 0.6, 0.1, 0.42);
  r.box(MAT.darkWood(), x + 0.55, 0.35, z, 0.65, 0.7, 0.45, true);
}
function toilet(r: Room, x: number, z: number) {
  r.box(MAT.ceramic(), x, 0.2, z, 0.4, 0.4, 0.55, true);
  r.box(MAT.ceramic(), x, 0.6, z - 0.25, 0.42, 0.45, 0.18);
}
function sink(r: Room, x: number, z: number, mirror = true) {
  r.box(MAT.ceramic(), x, 0.82, z, 0.55, 0.12, 0.42, true);
  r.box(MAT.steel(), x, 0.95, z - 0.15, 0.04, 0.15, 0.04);
  if (mirror) r.box(MAT.color("#cfe3ea", 0.02, 0.9), x, 1.55, z - 0.2, 0.55, 0.7, 0.02);
}
function shower(r: Room, x: number, z: number, glassDoor: boolean) {
  r.box(MAT.bathTiles(), x, 0.02, z, 0.9, 0.04, 0.9);
  r.box(MAT.steel(), x, 2.0, z - 0.4, 0.03, 0.03, 0.25);
  r.cyl(MAT.steel(), x, 1.95, z - 0.28, 0.1, 0.02);
  if (glassDoor) r.box(MAT.glass(), x + 0.45, 1.0, z, 0.02, 2.0, 0.9);
}
function bathtub(r: Room, x: number, z: number) {
  r.box(MAT.ceramic(), x, 0.3, z, 1.7, 0.6, 0.8, true);
  r.box(MAT.color("#bfe3ee", 0.05), x, 0.55, z, 1.5, 0.02, 0.62);
}
function kitchenette(r: Room, x: number, z: number, along: "x" | "z") {
  const len = 1.8;
  const [w, d] = along === "x" ? [len, 0.6] : [0.6, len];
  r.box(MAT.color("#e7e2d8", 0.5), x, 0.45, z, w, 0.9, d, true);
  r.box(MAT.darkMarble(), x, 0.92, z, w + 0.02, 0.04, d + 0.02);
  const o = along === "x" ? [0.45, 0] : [0, 0.45];
  r.box(MAT.black(), x + o[0], 0.95, z + o[1], 0.5, 0.02, 0.4); // two-burner hob
  r.box(MAT.steel(), x - o[0], 0.93, z - o[1], 0.45, 0.03, 0.35); // sink
  r.box(MAT.lightWood(), x, 1.7, z + (along === "x" ? -0.18 : 0), along === "x" ? len : 0.3, 0.04, along === "x" ? 0.3 : len); // shelf
  r.cyl(MAT.color("#c8452c", 0.4), x - 0.2, 1.82, z, 0.07, 0.2);
  r.cyl(MAT.color("#F2B705", 0.4), x + 0.1, 1.82, z, 0.07, 0.2);
}
function fittedKitchen(r: Room, x0: number, z0: number, lenX: number, lenZ: number, chef: boolean) {
  // L-shaped run along the back wall (x) and the left wall (z), with upper cabinets.
  const body = chef ? MAT.color("#2b2f36", 0.35) : MAT.color("#efe9df", 0.45);
  const top = chef ? MAT.marble() : MAT.darkMarble();
  r.box(body, x0 + lenX / 2, 0.45, z0 + 0.3, lenX, 0.9, 0.6, true);
  r.box(top, x0 + lenX / 2, 0.92, z0 + 0.3, lenX + 0.02, 0.04, 0.62);
  r.box(body, x0 + 0.3, 0.45, z0 + 0.6 + lenZ / 2, 0.6, 0.9, lenZ, true);
  r.box(top, x0 + 0.3, 0.92, z0 + 0.6 + lenZ / 2, 0.62, 0.04, lenZ + 0.02);
  r.box(body, x0 + lenX / 2 + 0.3, 1.9, z0 + 0.18, lenX - 0.6, 0.7, 0.35); // upper cabinets
  r.box(MAT.bathTiles(), x0 + lenX / 2, 1.27, z0 + 0.02, lenX, 0.66, 0.02); // splashback
  r.box(MAT.black(), x0 + lenX * 0.55, 0.95, z0 + 0.3, 0.7, 0.02, 0.5); // hob
  r.box(MAT.steel(), x0 + lenX * 0.55, 1.75, z0 + 0.25, 0.75, 0.25, 0.45); // extractor hood
  r.box(MAT.black(), x0 + lenX * 0.55, 0.45, z0 + 0.61, 0.6, 0.6, 0.02); // oven door
  r.box(MAT.steel(), x0 + 0.3, 0.93, z0 + 1.1, 0.45, 0.03, 0.4); // sink
  r.box(MAT.steel(), x0 + lenX - 0.4, 1.0, z0 + 0.45, 0.8, 2.0, 0.75, true); // fridge (double-door)
  r.box(MAT.black(), x0 + lenX - 0.4, 1.0, z0 + 0.83, 0.01, 1.9, 0.01);
  if (chef) {
    // Island with stools and pendant lights.
    const ix = x0 + lenX / 2, iz = z0 + lenZ * 0.55 + 0.8;
    r.box(body, ix, 0.45, iz, 2.4, 0.9, 1.0, true);
    r.box(MAT.marble(), ix, 0.93, iz, 2.6, 0.05, 1.15);
    for (let i = 0; i < 3; i++) {
      r.cyl(MAT.color("#c8a86a", 0.4, 0.6), ix - 0.8 + i * 0.8, 0.65, iz + 0.8, 0.18, 0.06);
      r.cyl(MAT.steel(), ix - 0.8 + i * 0.8, 0.33, iz + 0.8, 0.03, 0.62);
      r.cyl(MAT.color("#f2d38a", 0.3), ix - 0.8 + i * 0.8, 2.2, iz, 0.12, 0.2);
      r.box(MAT.black(), ix - 0.8 + i * 0.8, 2.7, iz, 0.01, 0.8, 0.01);
    }
  }
}
// ---------------------------------------------------------------------------
// Small things that make a place look lived in.

/** The fluorescent tube on the wall that lights every Ghanaian room. Faces +z from a back wall at z. */
function tubeLight(r: Room, x: number, y: number, z: number) {
  r.box(MAT.white(), x, y, z + 0.03, 1.25, 0.08, 0.06);
  r.box(MAT.glow("#f4fbff", 2.6), x, y - 0.01, z + 0.07, 1.15, 0.05, 0.04);
}
function wallClock(r: Room, x: number, y: number, z: number) {
  r.cyl(MAT.white(), x, y, z + 0.02, 0.17, 0.03, Math.PI / 2);
  r.cyl(MAT.color("#c8452c", 0.5), x, y, z + 0.01, 0.19, 0.02, Math.PI / 2);
  r.box(MAT.black(), x, y + 0.05, z + 0.04, 0.012, 0.1, 0.01);
  r.box(MAT.black(), x + 0.04, y, z + 0.04, 0.08, 0.012, 0.01);
}
/** A church or shop calendar with a big photo. */
function calendar(r: Room, x: number, y: number, z: number, tint = "#1F5AA6") {
  r.box(MAT.white(), x, y, z + 0.01, 0.42, 0.62, 0.01);
  r.box(MAT.fabric("wax", tint), x, y + 0.14, z + 0.02, 0.38, 0.3, 0.005);
  r.box(MAT.color("#c8452c", 0.6), x, y + 0.33, z + 0.02, 0.42, 0.04, 0.01);
}
function radio(r: Room, x: number, y: number, z: number) {
  r.box(MAT.color("#2a2a2a", 0.5), x, y + 0.1, z, 0.36, 0.2, 0.12);
  r.cyl(MAT.color("#777", 0.6), x - 0.09, y + 0.1, z + 0.065, 0.06, 0.01, Math.PI / 2);
  r.cyl(MAT.color("#777", 0.6), x + 0.09, y + 0.1, z + 0.065, 0.06, 0.01, Math.PI / 2);
  r.box(MAT.steel(), x + 0.14, y + 0.35, z, 0.01, 0.35, 0.01);
}
/** Mortar and pestle for fufu. */
function mortarPestle(r: Room, x: number, z: number) {
  r.cyl(MAT.color("#7a4a28", 0.8), x, 0.25, z, 0.28, 0.5);
  r.cyl(MAT.color("#4a2a14", 0.9), x, 0.5, z, 0.23, 0.02);
  r.add(G.cyl8, MAT.color("#a3784e", 0.8), [x + 0.05, 0.95, z], [0, 0, 0.12], [0.05, 1.5, 0.05]);
}
function basins(r: Room, x: number, z: number) {
  const cols = ["#2E86AB", "#F2B705", "#c8452c"];
  cols.forEach((c, i) => r.cyl(MAT.color(c, 0.5), x + i * 0.55, 0.09 + (i === 2 ? 0.18 : 0), z, 0.26 - i * 0.03, 0.18));
}
function charcoalSack(r: Room, x: number, z: number) {
  r.add(G.sphere, MAT.color("#d9cfb5", 1), [x, 0.3, z], [0, 0, 0], [0.32, 0.38, 0.28]);
  r.add(G.sphere, MAT.color("#1d1d1d", 1), [x, 0.6, z], [0, 0, 0], [0.22, 0.08, 0.2]);
}
function chicken(r: Room, x: number, z: number, ry = 0, hen = true) {
  const c = hen ? "#a8673a" : "#f2efe8";
  r.add(G.sphere, MAT.color(c, 0.9), [x, 0.22, z], [0, ry, 0], [0.16, 0.14, 0.22]);
  r.add(G.sphere, MAT.color(c, 0.9), [x + Math.sin(ry) * 0.17, 0.36, z + Math.cos(ry) * 0.17], [0, 0, 0], [0.08, 0.09, 0.08]);
  r.add(G.sphere, MAT.color("#c8152c", 0.7), [x + Math.sin(ry) * 0.17, 0.45, z + Math.cos(ry) * 0.17], [0, 0, 0], [0.02, 0.04, 0.05]);
  r.box(MAT.color("#e8a33a", 0.7), x, 0.06, z, 0.12, 0.12, 0.02);
}
function waterDrum(r: Room, x: number, z: number) {
  r.cyl(MAT.color("#1F5AA6", 0.5), x, 0.45, z, 0.32, 0.9);
  r.cyl(MAT.color("#163f75", 0.5), x, 0.91, z, 0.2, 0.03);
}
function potsOnHob(r: Room, x: number, y: number, z: number) {
  r.cyl(MAT.steel(), x - 0.15, y + 0.1, z, 0.14, 0.18);
  r.cyl(MAT.color("#2b2b2b", 0.4), x + 0.2, y + 0.04, z, 0.14, 0.04); // frying pan
}
function fruitBowl(r: Room, x: number, y: number, z: number) {
  r.cyl(MAT.color("#7a4a28", 0.5), x, y + 0.04, z, 0.2, 0.08);
  for (const [dx, dz, c] of [[0, 0, "#f2b705"], [0.08, 0.05, "#e85d2a"], [-0.07, 0.04, "#3f8f2a"], [0.02, -0.08, "#f2b705"]] as const)
    r.add(G.sphere, MAT.color(c, 0.6), [x + dx, y + 0.12, z + dz], [0, 0, 0], [0.06, 0.06, 0.06]);
}
function pendantLamp(r: Room, x: number, y: number, z: number, h = 2.9) {
  r.box(MAT.black(), x, (y + h) / 2, z, 0.01, h - y, 0.01);
  r.cyl(MAT.color("#c8a86a", 0.4, 0.6), x, y, z, 0.22, 0.18);
  r.cyl(MAT.glow("#ffe2a8", 3), x, y - 0.1, z, 0.12, 0.02);
}
function sideTableLamp(r: Room, x: number, z: number) {
  r.box(MAT.darkWood(), x, 0.28, z, 0.45, 0.56, 0.45, true);
  r.cyl(MAT.color("#c8a86a", 0.4, 0.6), x, 0.7, z, 0.04, 0.28);
  r.cyl(MAT.glow("#fff0cc", 1.2), x, 0.95, z, 0.17, 0.24);
}
function books(r: Room, x: number, y: number, z: number) {
  const cols = ["#c8452c", "#1F5AA6", "#2E7D4F", "#F2B705", "#3a2418"];
  cols.forEach((c, i) => r.box(MAT.color(c, 0.8), x - 0.16 + i * 0.075, y + 0.12, z, 0.06, 0.24 - (i % 2) * 0.04, 0.18));
}
function shoeRack(r: Room, x: number, z: number) {
  r.box(MAT.lightWood(), x, 0.25, z, 0.8, 0.5, 0.3, true);
  const cols = ["#151515", "#8a5a3b", "#ffffff", "#c8452c"];
  cols.forEach((c, i) => r.box(MAT.color(c, 0.6), x - 0.28 + i * 0.19, 0.55, z, 0.12, 0.08, 0.25));
}
function floorLamp(r: Room, x: number, z: number) {
  r.cyl(MAT.black(), x, 0.8, z, 0.025, 1.6);
  r.cyl(MAT.glow("#fff0cc", 1.4), x, 1.7, z, 0.22, 0.3);
}

function plant(r: Room, x: number, z: number, big = false) {
  r.cyl(MAT.color("#5a3a22", 0.9), x, 0.25, z, big ? 0.3 : 0.2, 0.5);
  r.add(G.ico, MAT.color("#3f6f2a", 0.9), [x, big ? 1.3 : 0.85, z], [0, 0, 0], [big ? 0.6 : 0.4, big ? 1.0 : 0.6, big ? 0.6 : 0.4]);
}
function rug(r: Room, x: number, z: number, w: number, d: number, color = "#C8452C") {
  r.box(MAT.fabric("kente", color), x, 0.012, z, w, 0.02, d);
}
function frame(r: Room, x: number, y: number, z: number, w = 0.7, h = 0.5) {
  r.box(MAT.color("#b08d57", 0.3, 0.7), x, y, z, w, h, 0.03);
  r.box(MAT.color("#e9e2d4", 0.9), x, y, z + 0.02, w - 0.1, h - 0.1, 0.01);
  r.box(MAT.color("#8a8378", 0.9), x, y - 0.03, z + 0.025, w - 0.3, h - 0.3, 0.005);
}

/** Owned furniture that the base layout doesn't already cover. */
function ownedExtras(r: Room, items: string[], spots: { tv: [number, number]; fridge: [number, number]; gen: [number, number] }) {
  const has = (i: string) => items.includes(i);
  if (has("smart_tv65") || has("tv32")) tvWall(r, spots.tv[0], spots.tv[1], has("smart_tv65"));
  if (has("fridge")) r.box(MAT.white(), spots.fridge[0], 0.9, spots.fridge[1], 0.7, 1.8, 0.7, true);
  if (has("generator")) { r.box(MAT.color("#c8352c"), spots.gen[0], 0.3, spots.gen[1], 0.6, 0.55, 0.45, true); r.box(MAT.black(), spots.gen[0], 0.62, spots.gen[1], 0.5, 0.06, 0.06); }
  if (has("split_ac")) r.box(MAT.white(), spots.tv[0] - 1.5, 2.45, spots.tv[1] - 0.05, 1.0, 0.3, 0.22);
}

// ---------------------------------------------------------------------------
// Layouts by kind of home

/**
 * One piece of furniture drawn at the origin of the current frame, facing +z
 * (its back to -z). Used for hand-placed pieces and the placement ghost.
 */
export function drawPiece(r: Room, piece: string) {
  switch (piece) {
    case "king_bed": return bedDir(r, 0, 0, "king", 1, "#8a7a68");
    case "double_bed": return bedDir(r, 0, 0, "double", 1, "#6b7684");
    case "carpenter_bed": return bedDir(r, 0, 0, "double", 1, "#7d8a74", false);
    case "twin_beds":
      bedDir(r, -0.85, 0, "single", 1, "#7d8a74", false, false);
      bedDir(r, 0.85, 0, "single", 1, "#7d8fa3", false, false);
      r.box(MAT.darkWood(), 0, 0.28, -0.8, 0.45, 0.56, 0.4, true);
      return;
    case "wardrobe":
      r.box(MAT.color("#efe7da", 0.6), 0, 1.15, 0, 2.4, 2.3, 0.6, true);
      for (let i = 1; i < 3; i++) r.box(MAT.color("#d8cfc0", 0.6), -1.2 + (i * 2.4) / 3, 1.15, 0.305, 0.02, 2.2, 0.01);
      for (let i = 0; i < 3; i++) r.box(MAT.color("#c8a86a", 0.3, 0.7), -1.2 + ((i + 0.5) * 2.4) / 3 + 0.2, 1.15, 0.31, 0.02, 0.35, 0.02);
      return;
    case "dresser":
      r.box(MAT.color("#f1e9dc", 0.5), 0, 0.4, 0, 1.2, 0.8, 0.45, true);
      for (let i = 0; i < 3; i++) r.box(MAT.color("#c8a86a", 0.3, 0.7), 0, 0.18 + i * 0.25, 0.23, 0.12, 0.02, 0.01);
      r.box(MAT.color("#cfe3ea", 0.02, 0.9), 0, 1.35, -0.18, 0.8, 0.9, 0.03);
      r.box(MAT.color("#c8a86a", 0.3, 0.7), 0, 1.35, -0.2, 0.86, 0.96, 0.02);
      return;
    case "desk": return desk(r, 0, -0.35, 1);
    case "bookshelf": return bookshelf(r, 0, 0, 1.6, 1);
    case "rug": return lrug(r, 0, 0, 3, 2.2);
    case "plant": return plant(r, 0, 0, true);
    case "lights": return pendantLamp(r, 0, 2.6, 0, r.wallH);
    case "leather_sofa": return sofaSet(r, 0.05, -0.8, "l_shape", 1);
    case "fabric_sofa": return sofaSet(r, 0, 0, "fabric", 1);
    case "wooden_sofa": return sofaSet(r, 0, -0.45, "wooden", 1);
    case "tv65": return tvWall(r, 0, 0, true);
    case "tv32": return tvWall(r, 0, 0, false);
    case "coffee_table": coffeeTable(r, 0, 0); fruitBowl(r, 0, 0.44, 0); return;
    case "armchairs":
      r.box(MAT.color("#c9b28c", 0.9), 0, 0.22, 0, 0.85, 0.44, 0.85, true);
      r.box(MAT.color("#d8c4a0", 0.95), 0, 0.5, 0.04, 0.76, 0.14, 0.7);
      r.box(MAT.color("#c9b28c", 0.9), 0, 0.75, -0.36, 0.85, 0.6, 0.14);
      for (const s of [-1, 1]) r.box(MAT.color("#c9b28c", 0.9), s * 0.38, 0.55, 0, 0.1, 0.3, 0.85);
      return;
    case "piano":
      r.box(MAT.black(), 0, 0.75, -0.25, 1.5, 0.25, 1.9, true);
      for (const [x, z] of [[-0.6, -1], [0.6, -1], [0, 0.55]] as const) r.box(MAT.black(), x, 0.32, z, 0.08, 0.64, 0.08);
      r.box(MAT.black(), 0, 0.85, 0.8, 1.5, 0.3, 0.3);
      r.box(MAT.white(), 0, 0.75, 0.88, 1.3, 0.04, 0.16);
      r.box(MAT.black(), 0, 0.25, 1.15, 0.8, 0.5, 0.32);
      return;
    case "dining10": return diningSet(r, 0, 0, 10, MAT.darkMarble());
    case "dining6": return diningSet(r, 0, 0, 6, MAT.darkWood());
    case "cabinet":
      r.box(MAT.darkWood(), 0, 1.0, 0, 2.2, 2.0, 0.45, true);
      r.box(MAT.glass(), 0, 1.3, 0.23, 2.0, 1.2, 0.01);
      return;
  }
}
/** A piece on its own, for the placement ghost (drawn at the origin, facing +z). */
export function buildPieceGroup(piece: string) {
  const r = new Room();
  r.wallH = 3.4;
  drawPiece(r, piece);
  const g = r.b.build();
  g.add(r.extra);
  return g;
}
/** Hand-placed pieces on one floor, with their footprints for tapping. */
function drawPlaced(r: Room, placed: PlacedPiece[], level: number, out: NonNullable<Interior["placed"]>) {
  for (const it of placed) {
    if (it.level !== level) continue;
    r.turned(it.x, it.z, -it.rot * Math.PI / 2, () => drawPiece(r, it.piece));
    out.push({ id: it.id, piece: it.piece, level, ...footprint(it.piece, it.x, it.z, it.rot) });
  }
}
/** The floor material for a finish. */
function floorMat(f: string | undefined, fallback: M): M {
  return f === "walnut" ? MAT.darkWood() : f === "marble" ? MAT.marble() : f === "tiles" ? MAT.floorTiles() : f === "terrazzo" ? MAT.terrazzo() : f === "oak" ? MAT.wood() : fallback;
}

export function buildHomeInterior(spec: HomeSpec, items: string[], furnish: Furnishing | null = null, placed: PlacedPiece[] = [], finishes: Finishes = {}): Interior {
  if ((spec.tier as string) === "mansion" || (spec.tier as string) === "villa") return buildManor(spec, items, furnish, placed, finishes);
  const r = new Room();
  const has = (i: string) => items.includes(i);
  let bounds = { minX: -3, maxX: 3, minZ: -3, maxZ: 3 };
  let door = new THREE.Vector3(0, 0, 3), bedPos = new THREE.Vector3();
  const lamp = (x: number, y: number, z: number, i = 6, d = 9) => { const l = new THREE.PointLight("#ffe2b0", i, d, 1.6); l.position.set(x, y, z); r.extra.add(l); };

  switch (spec.tier) {
    case "compound_room":
    case "chamber_hall": {
      // Your room(s) at the back; the shared courtyard in front, with the
      // shared bathroom block, the tap, neighbours' doors and clothes lines.
      const hall = spec.tier === "chamber_hall";
      const W = 15, roomW = hall ? 6.6 : 3.8, roomD = 3.8;
      const z0 = -6, z1 = z0 + roomD, cz1 = 6;
      bounds = { minX: -W / 2, maxX: W / 2, minZ: z0, maxZ: cz1 };
      r.floor(MAT.concreteFloor(), -W / 2, z1, W / 2, cz1); // courtyard
      r.floor(hall ? MAT.terrazzo() : MAT.concreteFloor(), -roomW / 2, z0, roomW / 2, z1);
      const wallM = MAT.plaster("#e3d5b8");
      r.wall(wallM, -roomW / 2, z0, roomW / 2, z0, 3);
      r.wall(wallM, -roomW / 2, z0, -roomW / 2, z1, 3);
      r.wall(wallM, roomW / 2, z0, roomW / 2, z1, 3);
      r.wall(wallM, -roomW / 2, z1, roomW / 2, z1, 1.0, [-0.5, 0.5]); // front wall (cut away)
      r.door(0, z1, "x");
      r.window(-roomW / 4, z0, 0.9);
      tubeLight(r, roomW / 4 - 0.1, 2.55, z0 + 0.07);
      wallClock(r, roomW / 4 + 0.4, 2.05, z0 + 0.07);
      calendar(r, -roomW / 4 - 0.85, 1.55, z0 + 0.07, hall ? "#2E7D4F" : "#1F5AA6");
      if (hall) {
        // Chamber (left) and hall (right) split by a partition with a doorway.
        r.wall(wallM, -0.4, z0, -0.4, z1, 1.1, [z0 + 2.2, z0 + 3.1]);
        bed(r, -2.3, z0 + 1.25, "double", "wood", "#1F5AA6");
        bedPos = new THREE.Vector3(-1.2, 0, z0 + 2.2);
        r.use("bed", -2.3, 0.72, z0 + 1.35, [-2.3, z0], "lie");
        r.use("tv", 1.6, 0.5, z0 + 2.55, [0.6, z0 + 0.35], "sit");
        r.spot("tv", 1.6, z0 + 1.9, "Sit in the hall");
        wardrobe(r, -3.05, z0 + 3.1, 0.9, 1);
        sofaSet(r, 1.6, z0 + 2.55, "wooden", -1);
        coffeeTable(r, 1.6, z0 + 1.55, false);
        displayCabinet(r, 2.9, z0 + 0.35);
        frame(r, 1.2, 2.0, z0 + 0.09);
        if (!has("tv32") && !has("smart_tv65")) { r.box(MAT.darkWood(), 0.6, 0.3, z0 + 0.35, 1.1, 0.6, 0.45, true); r.box(MAT.black(), 0.6, 0.85, z0 + 0.3, 0.6, 0.45, 0.25); }
      } else {
        if (has("king_bed") || has("bed_frame")) { bed(r, -0.8, z0 + 1.25, "double", "wood", "#C8452C"); r.use("bed", -0.8, 0.72, z0 + 1.35, [-0.8, z0], "lie"); }
        else { mattressFloor(r, -1.1, z0 + 1.15); r.use("bed", -1.1, 0.22, z0 + 1.2, [-1.1, z0], "lie"); }
        bedPos = new THREE.Vector3(0.2, 0, z0 + 1.5);
        r.box(MAT.color("#4a6b8a", 0.6), 1.35, 0.35, z0 + 0.4, 0.9, 0.7, 0.5, true); // chest of drawers
        r.box(MAT.color("#ddd"), -1.85, 1.9, z0 + 2.2, 0.01, 0.01, 2.2); // rope wardrobe
        for (let i = 0; i < 4; i++) r.box(MAT.color(["#C8452C", "#1F5AA6", "#F2B705", "#fff"][i]), -1.83, 1.55, z0 + 1.4 + i * 0.45, 0.02, 0.6, 0.38);
        fan(r, 1.4, z0 + 2.9);
        radio(r, 1.35, 0.7, z0 + 0.4);
      }
      bucketAndKettle(r, roomW / 2 - 0.5, z1 - 0.5);
      // Courtyard: coal pot by your door (or gas cylinder on a chamber & hall veranda).
      if (hall) gasCylinderCooker(r, 1.6, z1 + 0.6); else coalPot(r, 1.3, z1 + 0.7);
      plasticChairs(r, -2.2, z1 + 1.2, 2);
      // Courtyard life: fufu mortar, basins, charcoal, chickens, the water drum, a radio on the bench.
      mortarPestle(r, -0.9, z1 + 1.9);
      basins(r, 3.1, z1 + 1.0);
      if (!hall) charcoalSack(r, 2.0, z1 + 0.45);
      chicken(r, -1.3, 4.9, 0.6);
      chicken(r, 0.7, 5.3, -2.2, false);
      chicken(r, 1.6, 4.7, 2.4);
      waterDrum(r, -6.5, 3.9);
      r.spot(hall ? "kitchen" : "coalpot", hall ? 2.1 : 1.3, z1 + 1.4, hall ? "Cook on the gas" : "Coal pot");
      if (hall) r.use("kitchen", 1.6, 0, z1 + 1.25, [1.6, z1 + 0.6], "stand");
      else r.use("coalpot", 1.3, 0, z1 + 1.3, [1.3, z1 + 0.7], "squat");
      // Neighbours' rooms along the sides with curtains in their doorways.
      for (const sx of [-1, 1]) for (let k = 0; k < 2; k++) {
        const x = sx * (roomW / 2 + 1.6 + k * 2.6);
        r.box(MAT.plaster("#d9c9a3"), x, 1.5, z0 + 1.9, 2.5, 3, roomD, true);
        r.box(MAT.fabric("wax", ["#1F7A4D", "#B03A62", "#2E86AB", "#E3A857"][k + (sx > 0 ? 2 : 0)]), x, 1.05, z1 + 0.02, 0.85, 2.0, 0.02);
        r.box(MAT.zinc(), x, 3.05, z0 + 1.9, 2.6, 0.08, roomD + 0.6);
      }
      // Shared bathroom & toilet block in the corner of the courtyard.
      r.box(MAT.plaster("#bcae94"), 6.2, 1.2, 4.2, 2.0, 2.4, 2.2, true);
      r.box(MAT.doorWood(), 5.18, 1.0, 3.7, 0.04, 1.9, 0.8);
      r.box(MAT.doorWood(), 5.18, 1.0, 4.7, 0.04, 1.9, 0.8);
      r.box(MAT.color("#1F5AA6"), 5.16, 2.15, 3.7, 0.02, 0.22, 0.6);
      r.box(MAT.color("#C8452C"), 5.16, 2.15, 4.7, 0.02, 0.22, 0.6);
      r.extra.add(signSprite("BATH • TOILET", 5.1, 2.6, 4.2));
      r.spot("bath", 4.6, 4.2, "Shared bathroom");
      r.use("bath", 5.0, 0, 3.7, [6.2, 3.7], "hidden");
      // Standpipe tap with gallons, clothes line, a bench for evening chats.
      r.cyl(MAT.steel(), -6.2, 0.5, 4.8, 0.04, 1.0);
      for (let i = 0; i < 3; i++) r.cyl(MAT.color("#F2B705", 0.5), -5.6 + i * 0.4, 0.25, 5.1, 0.15, 0.5);
      clothesLine(r, -5.8, -1.2, 2.2);
      r.box(MAT.darkWood(), -3.5, 0.4, 4.4, 2.2, 0.08, 0.4, true);
      radio(r, -2.8, 0.44, 4.4);
      r.spot("neighbours", -3.5, 3.9, "Neighbours");
      r.use("neighbours", -3.5, 0.44, 4.4, [-3.5, 2.5], "sit");
      r.cutBox(MAT.plaster("#cdbf9f"), -W / 4 - 0.4, 1.25, cz1 + 0.1, W / 2 - 0.8, 2.5, 0.2); // front compound wall
      r.cutBox(MAT.plaster("#cdbf9f"), W / 4 + 0.4, 1.25, cz1 + 0.1, W / 2 - 0.8, 2.5, 0.2);
      door = new THREE.Vector3(0, 0, cz1 - 0.6);
      lamp(0, 2.6, z0 + 1.9, 5, 7);
      lamp(0, 3, 3, 3, 12);
      break;
    }
    case "northern_room": {
      bounds = { minX: -7, maxX: 7, minZ: -6, maxZ: 6 };
      r.floor(MAT.color("#b98a5a", 1), -7, -6, 7, 6);
      // Round room with a thatched roof (front half cut away).
      const cx = 0, cz = -3.2, R = 2.4;
      for (let i = 0; i < 20; i++) {
        const a = (i / 20) * Math.PI * 2;
        const front = Math.sin(a) > 0.35;
        const h = front ? 0.9 : 2.4;
        r.add(G.box, MAT.mud(), [cx + Math.cos(a) * R, h / 2, cz + Math.sin(a) * R], [0, -a, 0], [0.25, h, 0.8]);
      }
      r.colliders.push({ minX: -2.6, maxX: 2.6, minZ: -5.7, maxZ: -5.4 });
      r.add(G.cone, MAT.thatch(), [cx, 3.3, cz - 0.6], [0, 0, 0], [2.9, 1.6, 2.2]);
      r.box(MAT.color("#d8b878"), cx - 0.7, 0.04, cz - 0.6, 1.2, 0.06, 1.9); // sleeping mat
      bedPos = new THREE.Vector3(cx + 0.4, 0, cz - 0.3);
      r.use("bed", cx - 0.7, 0.08, cz - 0.5, [cx - 0.7, cz - 2], "lie");
      for (let i = 0; i < 3; i++) r.cyl(MAT.color("#8a4b2a", 0.95), cx + 1.3, 0.25 + i * 0.4, cz - 1.2, 0.3 - i * 0.05, 0.38); // stacked clay pots
      r.cyl(MAT.color("#c9a227", 0.8), cx - 1.6, 0.15, cz - 0.3, 0.25, 0.25); // calabash
      // Courtyard: granary, bathing enclosure, coal pot, water pots.
      r.cyl(MAT.mud(), 4.5, 1.1, -2, 1.0, 2.2);
      r.add(G.cone, MAT.thatch(), [4.5, 2.7, -2], [0, 0, 0], [1.3, 1.1, 1.3]);
      r.colliders.push({ minX: 3.5, maxX: 5.5, minZ: -3, maxZ: -1 });
      r.wall(MAT.mud(), -5.5, 2, -3.5, 2, 1.3);
      r.wall(MAT.mud(), -5.5, 2, -5.5, 4, 1.3);
      r.cyl(MAT.color("#2e6fae", 0.6), -4.8, 0.2, 3, 0.22, 0.4);
      r.spot("bath", -3.8, 3.2, "Bucket bath");
      r.use("bath", -4.6, 0, 3.3, [-4.8, 3], "bath");
      coalPot(r, 1.8, 1.2);
      r.spot("coalpot", 1.8, 2, "Cook");
      r.use("coalpot", 1.8, 0, 1.75, [1.8, 1.2], "squat");
      for (let i = 0; i < 3; i++) r.cyl(MAT.color("#7a3f22", 0.95), -1.5 + i * 0.6, 0.35, 0.8, 0.3, 0.7);
      r.box(MAT.darkWood(), 3.5, 0.3, 3, 2, 0.08, 0.5, true);
      r.spot("neighbours", 3.5, 3.6, "Sit with the family");
      mortarPestle(r, 2.6, 0.6);
      basins(r, -1.6, 2.4);
      chicken(r, 0.4, 3.8, 1.2);
      chicken(r, -0.6, 4.4, -2.0);
      chicken(r, 5.4, 0.6, 0.3, false);
      r.use("neighbours", 3.5, 0.34, 3, [3.5, 5], "sit");
      r.wall(MAT.mud(), -7, 6, 7, 6, 1.4, [-0.8, 0.8]);
      door = new THREE.Vector3(0, 0, 5.4);
      lamp(0, 2, -3, 4, 7);
      lamp(0, 4, 2, 2, 14);
      break;
    }
    case "self_contained":
    case "flat": {
      const flat = spec.tier === "flat";
      const W = flat ? 9 : 6.5, D = flat ? 7.5 : 5.5;
      bounds = { minX: -W / 2, maxX: W / 2, minZ: -D / 2, maxZ: D / 2 + 1 };
      r.floor(MAT.floorTiles(), -W / 2, -D / 2, W / 2, D / 2);
      const wallM = MAT.plaster("#efe6d6");
      r.wall(wallM, -W / 2, -D / 2, W / 2, -D / 2, 3);
      r.wall(wallM, -W / 2, -D / 2, -W / 2, D / 2, 3);
      r.wall(wallM, W / 2, -D / 2, W / 2, D / 2, 3);
      r.wall(wallM, -W / 2, D / 2, W / 2, D / 2, 1.0, [-0.5, 0.5]);
      r.door(0, D / 2, "x");
      // Bathroom in the back-right corner: toilet, basin, shower.
      const bx0 = W / 2 - 2.2, bz1 = -D / 2 + 2.2;
      r.floor(MAT.bathTiles(), bx0, -D / 2, W / 2, bz1, 0.01);
      r.wall(MAT.bathTiles(), bx0, -D / 2, bx0, bz1, 2.4, [bz1 - 1.0, bz1 - 0.15]);
      r.wall(MAT.bathTiles(), bx0, bz1, W / 2, bz1, 1.1);
      toilet(r, W / 2 - 0.4, -D / 2 + 1.5);
      sink(r, bx0 + 0.8, -D / 2 + 0.3);
      shower(r, W / 2 - 0.55, -D / 2 + 0.55, flat);
      r.spot("bath", bx0 + 0.6, bz1 - 0.6, "Bathroom");
      r.use("bath", W / 2 - 0.55, 0, -D / 2 + 0.6, [W / 2 - 0.55, -D / 2], "bath");
      // Kitchenette along the left wall.
      kitchenette(r, -W / 2 + 0.4, flat ? 1.2 : 0.8, "z");
      r.spot("kitchen", -W / 2 + 1.3, flat ? 1.2 : 0.8, "Kitchenette");
      r.use("kitchen", -W / 2 + 1.0, 0, flat ? 1.2 : 0.8, [-W / 2, flat ? 1.2 : 0.8], "stand");
      if (flat) {
        // Bedroom back-left behind a partition; living room in front.
        r.wall(wallM, -W / 2, -0.4, 0.4, -0.4, 1.1, [-0.9, 0.0]);
        r.wall(wallM, 0.4, -D / 2, 0.4, -0.4, 3);
        bed(r, -2.4, -D / 2 + 1.3, "double", has("king_bed") ? "upholstered" : "wood", "#2E86AB");
        wardrobe(r, -0.4, -D / 2 + 0.6, 1.2);
        bedPos = new THREE.Vector3(-1.2, 0, -1.2);
        r.use("bed", -2.4, 0.72, -D / 2 + 1.4, [-2.4, -D / 2], "lie");
        r.use("tv", 1.6, 0.5, 2.4, [1.6, -0.2], "sit");
        sofaSet(r, 1.6, 2.4, has("leather_sofa") ? "leather" : "fabric", -1);
        coffeeTable(r, 1.6, 1.3);
        rug(r, 1.6, 1.4, 2.6, 1.8);
      } else {
        bed(r, -1.6, -D / 2 + 1.3, "double", "wood", "#C8452C");
        bedPos = new THREE.Vector3(-0.3, 0, -D / 2 + 1.8);
        r.use("bed", -1.6, 0.72, -D / 2 + 1.4, [-1.6, -D / 2], "lie");
        r.use("tv", 0.4, 0.45, 1.6, [0.2, -D / 2], "sit");
        plasticChairs(r, 0.4, 1.6, 2);
        fan(r, 1.6, 0.6);
      }
      r.window(-W / 4, -D / 2, 1.2);
      tubeLight(r, -W / 4 + 1.6, 2.55, -D / 2 + 0.07);
      wallClock(r, -W / 4 - 1.2, 2.1, -D / 2 + 0.07);
      calendar(r, flat ? -0.2 : 0.9, 1.55, -D / 2 + 0.07);
      potsOnHob(r, -W / 2 + 0.4, 0.95, (flat ? 1.2 : 0.8) + 0.45);
      shoeRack(r, 1.6, D / 2 - 0.3);
      ownedExtras(r, items, { tv: [flat ? 1.6 : 0.2, flat ? -0.2 : -D / 2 + 0.35], fridge: [-W / 2 + 0.45, flat ? 2.8 : 2.2], gen: [W / 2 - 0.5, D / 2 - 0.5] });
      if (has("tv32") || has("smart_tv65")) r.spot("tv", flat ? 1.6 : 0.2, flat ? 1.2 : -1, "TV");
      if (flat) { r.box(MAT.bars(), 0, 1.0, D / 2 + 0.9, W, 1.0, 0.04); r.floor(MAT.floorTiles(), -W / 2, D / 2, W / 2, D / 2 + 1); r.spot("terrace", 2.5, D / 2 + 0.5, "Balcony"); r.use("terrace", 2.5, 0, D / 2 + 0.7, [2.5, D / 2 + 4], "stand"); }
      door = new THREE.Vector3(0, 0, D / 2 + 0.6);
      lamp(0, 2.7, 0, 6, 10);
      break;
    }
    case "apartment":
    case "townhouse": {
      const big = spec.tier === "townhouse";
      const W = big ? 14 : 11.5, D = big ? 10 : 8.5;
      bounds = { minX: -W / 2, maxX: W / 2, minZ: -D / 2, maxZ: D / 2 + (big ? 4 : 1.2) };
      r.floor(big ? MAT.wood() : MAT.floorTiles(), -W / 2, -D / 2, W / 2, D / 2);
      const wallM = MAT.plaster("#f2ece0");
      r.wall(wallM, -W / 2, -D / 2, W / 2, -D / 2, 3);
      r.wall(wallM, -W / 2, -D / 2, -W / 2, D / 2, 3);
      r.wall(wallM, W / 2, -D / 2, W / 2, D / 2, 3);
      r.wall(wallM, -W / 2, D / 2, W / 2, D / 2, 1.0, [-0.6, 0.6]);
      r.door(0, D / 2, "x");
      // Bedrooms along the back, bathroom between them.
      const back = -D / 2 + 3.6;
      r.wall(wallM, -W / 2, back, W / 2, back, 1.1, [-W / 2 + 2.0, -W / 2 + 2.9]);
      r.wall(wallM, -1.0, -D / 2, -1.0, back, 3);
      r.wall(wallM, 1.6, -D / 2, 1.6, back, 3);
      bed(r, -W / 2 + 2.0, -D / 2 + 1.3, big ? "king" : "double", big ? "upholstered" : "wood", "#B03A62");
      wardrobe(r, -1.7, -D / 2 + 2.8, 1.2, 1);
      bedPos = new THREE.Vector3(-W / 2 + 2.6, 0, back - 0.8);
      r.use("bed", -W / 2 + 2.0, 0.72, -D / 2 + 1.4, [-W / 2 + 2.0, -D / 2], "lie");
      r.floor(MAT.bathTiles(), -1.0, -D / 2, 1.6, back, 0.01);
      toilet(r, 1.15, -D / 2 + 0.6);
      sink(r, -0.3, -D / 2 + 0.3);
      if (big) bathtub(r, 0.3, -D / 2 + 2.3); else shower(r, -0.5, -D / 2 + 1.6, true);
      r.spot("bath", 0.3, back + 0.6, "Bathroom");
      if (big) r.use("bath", 0.3, 0.35, -D / 2 + 2.3, [-0.6, -D / 2 + 2.3], "lie");
      else r.use("bath", -0.5, 0, -D / 2 + 1.6, [-0.5, -D / 2], "bath");
      bed(r, W / 2 - 2.0, -D / 2 + 1.3, "double", "wood", "#2E7D4F");
      r.window(-W / 2 + 2.0, -D / 2, 1.2);
      r.window(W / 2 - 2.0, -D / 2, 1.2);
      // Fitted kitchen front-left, living & dining front-right.
      fittedKitchen(r, -W / 2 + 0.15, back + 0.2, 3.4, 2.2, false);
      r.spot("kitchen", -W / 2 + 2.0, back + 2.0, "Kitchen");
      r.use("kitchen", -W / 2 + 1.0, 0, back + 1.4, [-W / 2, back + 1.4], "stand");
      diningSet(r, -W / 2 + 2.4, D / 2 - 1.3, 6);
      fruitBowl(r, -W / 2 + 2.4, 0.78, D / 2 - 1.3);
      pendantLamp(r, -W / 2 + 2.4, 2.2, D / 2 - 1.3);
      potsOnHob(r, -W / 2 + 0.15 + 3.4 * 0.55, 0.95, back + 0.5);
      sideTableLamp(r, W / 2 - 0.6, D / 2 - 1.0);
      books(r, W / 2 - 0.6, 0.56, D / 2 - 1.0);
      wallClock(r, -W / 2 + 4.6, 2.2, back + 0.07);
      shoeRack(r, 1.4, D / 2 - 0.3);
      sofaSet(r, W / 2 - 3.0, D / 2 - 1.0, has("leather_sofa") || big ? "l_shape" : "fabric", -1);
      coffeeTable(r, W / 2 - 3.0, D / 2 - 2.2);
      rug(r, W / 2 - 3.0, D / 2 - 2.1, 3.0, 2.2, "#1F7A4D");
      tvWall(r, W / 2 - 3.0, back + 0.35, has("smart_tv65") || big);
      r.spot("tv", W / 2 - 3.0, D / 2 - 2.6, "TV");
      r.use("tv", W / 2 - 3.0, 0.5, D / 2 - 1.0, [W / 2 - 3.0, back], "sit");
      plant(r, W / 2 - 0.5, D / 2 - 0.5, true);
      frame(r, 0.4, 2.0, back + 0.1, 1.0, 0.7);
      if (has("split_ac") || big) r.box(MAT.white(), W / 2 - 1.2, 2.5, back + 0.12, 1.0, 0.3, 0.22);
      if (big) {
        // Garden in front of the house, inside the compound wall.
        r.floor(MAT.grass(), -W / 2, D / 2, W / 2, D / 2 + 4);
        r.cutBox(MAT.plaster("#e9dcc6"), 0, 1.2, D / 2 + 4, W, 2.4, 0.25);
        for (const x of [-W / 2 + 1.5, W / 2 - 1.5]) plant(r, x, D / 2 + 2.5, true);
        r.spot("terrace", 3, D / 2 + 1.5, "Garden");
        r.use("terrace", 3, 0, D / 2 + 1.8, [3, D / 2 + 4], "stand");
        door = new THREE.Vector3(0, 0, D / 2 + 3.2);
      } else {
        r.floor(MAT.floorTiles(), -W / 2, D / 2, W / 2, D / 2 + 1.2);
        r.box(MAT.bars(), 0, 1.0, D / 2 + 1.15, W, 1.0, 0.04);
        r.spot("terrace", 3, D / 2 + 0.7, "Balcony");
        r.use("terrace", 3, 0, D / 2 + 0.85, [3, D / 2 + 4], "stand");
        door = new THREE.Vector3(0, 0, D / 2 + 0.7);
      }
      lamp(-2, 2.7, 1, 6, 12);
      lamp(2.5, 2.7, -2, 5, 10);
      break;
    }
    case "villa":
    case "penthouse":
    case "mansion": {
      const mansion = spec.tier === "mansion", pent = spec.tier === "penthouse";
      const W = mansion ? 22 : pent ? 17 : 16, D = mansion ? 14 : pent ? 11 : 11;
      const H = mansion ? 6 : 3.4;
      const outside = pent ? 0 : 7;
      r.wallH = H;
      bounds = { minX: -W / 2, maxX: W / 2, minZ: -D / 2, maxZ: D / 2 + outside + (pent ? 0 : 0) };
      r.floor(mansion ? MAT.marble() : pent ? MAT.wood() : MAT.marble(), -W / 2, -D / 2, W / 2, D / 2);
      const wallM = MAT.plaster(mansion ? "#f7f1e6" : "#f3efe8");
      if (pent) {
        // The back wall is glass: the city skyline behind it.
        for (let i = 0; i < 6; i++) r.box(MAT.black(), -W / 2 + (i + 0.5) * (W / 6), H / 2, -D / 2, 0.08, H, 0.1);
        r.box(MAT.glass(), 0, H / 2, -D / 2, W, H, 0.03);
        r.colliders.push({ minX: -W / 2, maxX: W / 2, minZ: -D / 2 - 0.2, maxZ: -D / 2 + 0.1 });
        const sky = new THREE.Mesh(new THREE.PlaneGeometry(90, 34), MAT.skyline());
        sky.position.set(0, 4, -D / 2 - 30);
        r.extra.add(sky);
      } else r.wall(wallM, -W / 2, -D / 2, W / 2, -D / 2, H);
      r.wall(wallM, -W / 2, -D / 2, -W / 2, D / 2, H);
      if (pent) {
        // Terrace on the right, through sliding glass.
        r.box(MAT.glass(), W / 2, H / 2, 0, 0.03, H, D);
        r.colliders.push({ minX: W / 2 - 0.1, maxX: W / 2 + 0.1, minZ: -D / 2, maxZ: 1.5 });
        r.floor(MAT.color("#8a8378", 0.9), W / 2, -D / 2, W / 2 + 5, D / 2);
        r.box(MAT.glass(), W / 2 + 5, 0.55, 0, 0.03, 1.1, D);
        r.box(MAT.steel(), W / 2 + 5, 1.12, 0, 0.06, 0.05, D);
        for (let i = 0; i < 3; i++) plant(r, W / 2 + 4.3, -D / 2 + 1.5 + i * 3.5, true);
        r.box(MAT.color("#efe9df", 0.9), W / 2 + 2.5, 0.25, 0, 2.2, 0.5, 0.9, true); // lounger
        bounds.maxX = W / 2 + 4.8;
        r.spot("terrace", W / 2 + 2.5, 1.4, "Terrace");
        r.use("terrace", W / 2 + 2.5, 0.5, 0.2, [W / 2 + 2.5, -1.2], "lie");
      } else r.wall(wallM, W / 2, -D / 2, W / 2, D / 2, H);
      r.wall(wallM, -W / 2, D / 2, W / 2, D / 2, 1.0, mansion ? [-1.4, 1.4] : [-0.8, 0.8]);
      if (mansion) {
        // Double-height hall: columns at the entrance, a chandelier, a staircase.
        for (const x of [-1.9, 1.9]) r.cyl(MAT.white(), x, H / 2, D / 2 - 0.3, 0.28, H);
        const ch = new THREE.Group();
        for (let i = 0; i < 24; i++) {
          const a = (i / 24) * Math.PI * 2, rr = 0.6 + (i % 3) * 0.25;
          const m = new THREE.Mesh(G.sphere, MAT.color("#fff6e0", 0.05, 0.2));
          m.scale.setScalar(0.07);
          m.position.set(Math.cos(a) * rr, -(i % 4) * 0.15, Math.sin(a) * rr);
          ch.add(m);
        }
        ch.position.set(0, H - 1.0, 0.5);
        r.extra.add(ch);
        lamp(0, H - 1.3, 0.5, 14, 20);
        for (let s = 0; s < 14; s++) r.box(MAT.white(), W / 2 - 1.5, 0.11 + s * 0.21, -D / 2 + 1 + s * 0.38, 2.4, 0.22, 0.38, s < 4);
        r.box(MAT.color("#b08d57", 0.3, 0.7), W / 2 - 2.75, 1.9, -D / 2 + 3.6, 0.05, 1.0, 5.4); // banister
        r.box(wallM, W / 2 - 1.5, 2.95, -D / 2 + 0.9, 2.6, 0.2, 1.6); // landing
        diningSet(r, -W / 2 + 4.5, 2.6, 10, MAT.darkMarble());
        frame(r, -2.5, 3.2, -D / 2 + 0.1, 2.2, 1.5);
        frame(r, 2.5, 3.2, -D / 2 + 0.1, 2.2, 1.5);
      }
      // Living: big sofa, rug, TV wall.
      const lx = mansion ? 1.5 : pent ? 2.5 : 3;
      sofaSet(r, lx, 2.6, "l_shape", -1);
      coffeeTable(r, lx, 1.2);
      rug(r, lx - 0.4, 1.3, 4, 3, "#1F3A5F");
      tvWall(r, lx, -1.8, true);
      floorLamp(r, lx + 2.3, 3.2);
      // Armchairs, a drinks cabinet, a console with a vase by the door, art on the walls.
      for (const dz of [-0.2, 1.2]) {
        r.box(MAT.color("#c9b28c", 0.9), lx + 3.2, 0.22, dz, 0.8, 0.44, 0.8, true);
        r.box(MAT.color("#d8c4a0", 0.95), lx + 3.2, 0.5, dz, 0.72, 0.14, 0.72);
        r.box(MAT.color("#c9b28c", 0.9), lx + 3.55, 0.75, dz, 0.14, 0.6, 0.8);
      }
      r.box(MAT.darkWood(), lx + 1.2, 0.9, -D / 2 + 0.3, 1.6, 1.8, 0.45, true);
      for (let i = 0; i < 5; i++) r.cyl(MAT.color(["#3a5f2a", "#6b1d1d", "#d9b65a", "#2a2a2a", "#9a6b2a"][i], 0.1), lx + 0.6 + i * 0.3, 1.95, -D / 2 + 0.3, 0.05, 0.32);
      r.box(MAT.darkWood(), -1.6, 0.45, D / 2 - 0.35, 1.4, 0.9, 0.4, true);
      r.cyl(MAT.color("#1F5AA6", 0.2), -1.6, 1.15, D / 2 - 0.35, 0.14, 0.5);
      frame(r, lx - 2.5, 2.0, -D / 2 + 0.08, 1.4, 1.0);
      frame(r, lx + 3.5, 2.0, -D / 2 + 0.08, 1.0, 1.2);
      rug(r, mansion ? -W / 2 + 4.5 : -W / 2 + 2.6, mansion ? 2.6 : D / 2 - 1.4, mansion ? 6.5 : 4.5, 2.6, "#7a2e2e");
      if (mansion) {
        // A grand piano by the window.
        r.box(MAT.black(), W / 2 - 4.5, 0.75, D / 2 - 2.2, 1.5, 0.25, 2.0, true);
        r.box(MAT.black(), W / 2 - 4.5, 0.85, D / 2 - 1.15, 1.5, 0.3, 0.3);
        r.box(MAT.white(), W / 2 - 4.5, 0.75, D / 2 - 1.1, 1.3, 0.04, 0.18);
        for (const dx of [-0.6, 0.6]) r.box(MAT.black(), W / 2 - 4.5 + dx, 0.32, D / 2 - 2.2, 0.08, 0.64, 0.08);
      }
      sideTableLamp(r, lx - 2.2, 2.6);
      books(r, lx - 2.2, 0.56, 2.6);
      fruitBowl(r, lx, 0.44, 1.2);
      r.spot("tv", lx, 0.6, "TV");
      r.use("tv", lx, 0.5, 2.6, [lx, -1.8], "sit");
      // Chef's kitchen.
      fittedKitchen(r, -W / 2 + 0.15, -D / 2 + (mansion ? 5 : 3.6), mansion ? 5 : 4.2, 2.2, true);
      r.spot("kitchen", -W / 2 + 2.4, -D / 2 + (mansion ? 8.3 : 6.9), "Kitchen");
      r.use("kitchen", -W / 2 + 1.0, 0, -D / 2 + (mansion ? 6.5 : 5.2), [-W / 2, -D / 2 + (mansion ? 6.5 : 5.2)], "stand");
      if (!mansion) {
        diningSet(r, -W / 2 + 2.6, D / 2 - 1.4, 8, MAT.darkMarble());
        for (const dx of [-0.8, 0.8]) pendantLamp(r, -W / 2 + 2.6 + dx, 2.3, D / 2 - 1.4, H);
      }
      potsOnHob(r, -W / 2 + 0.15 + (mansion ? 5 : 4.2) * 0.55, 0.95, -D / 2 + (mansion ? 5 : 3.6) + 0.5);
      // Master suite back-left with an ensuite and a freestanding tub.
      const sx0 = -W / 2, sx1 = -W / 2 + (mansion ? 7 : 6.5), sz1 = -D / 2 + 3.4;
      r.wall(wallM, sx0, sz1, sx1, sz1, 1.1, [sx1 - 1.4, sx1 - 0.5]);
      r.wall(wallM, sx1, -D / 2, sx1, sz1, pent ? 3.4 : H);
      bed(r, sx0 + 2.2, -D / 2 + 1.35, "king", "upholstered", "#2b2f36");
      bedPos = new THREE.Vector3(sx0 + 3.5, 0, sz1 - 0.8);
      r.use("bed", sx0 + 2.2, 0.72, -D / 2 + 1.45, [sx0 + 2.2, -D / 2], "lie");
      r.wall(wallM, sx1 - 2.6, -D / 2, sx1 - 2.6, sz1, 2.6, [sz1 - 1.2, sz1 - 0.3]);
      r.floor(MAT.marble(), sx1 - 2.6, -D / 2, sx1, sz1, 0.01);
      bathtub(r, sx1 - 1.3, -D / 2 + 0.8);
      sink(r, sx1 - 0.5, -D / 2 + 2.2);
      r.spot("bath", sx1 - 1.3, sz1 - 0.6, "Ensuite");
      r.use("bath", sx1 - 1.3, 0.35, -D / 2 + 0.8, [sx1 - 2.2, -D / 2 + 0.8], "lie");
      plant(r, -W / 2 + 0.6, D / 2 - 0.6, true);
      plant(r, W / 2 - 0.6, D / 2 - 0.6, true);
      if (!pent) {
        // Outside: garden, pool, compound wall with a gate.
        r.floor(MAT.grass(), -W / 2, D / 2, W / 2, D / 2 + outside);
        // Pool deck around a sunken pool.
        for (const [x, z, w, d] of [[0, D / 2 + 1.75, 10, 0.5], [0, D / 2 + 5.25, 10, 0.5], [-4.75, D / 2 + 3.5, 0.5, 3], [4.75, D / 2 + 3.5, 0.5, 3]] as const) r.box(MAT.color("#d8d0c2", 0.6), x, 0.04, z, w, 0.08, d);
        r.box(MAT.color("#7fd0e0", 0.3), 0, -0.5, D / 2 + 3.5, 9, 0.05, 3); // pool floor
        r.box(MAT.water(), 0, 0.02, D / 2 + 3.5, 9, 0.02, 3);
        r.colliders.push({ minX: -4, maxX: 4, minZ: D / 2 + 2, maxZ: D / 2 + 5 });
        r.spot("pool", 4.8, D / 2 + 3.5, "Pool");
        r.use("pool", 1, -0.25, D / 2 + 3.5, [-3, D / 2 + 3.5], "swim");
        for (let i = 0; i < 3; i++) r.box(MAT.white(), -7 + i * 1.2, 0.2, D / 2 + 3.5, 0.7, 0.3, 1.8, true);
        r.cutBox(MAT.plaster("#e9dcc6"), -W / 4 - 0.75, 1.4, D / 2 + outside, W / 2 - 1.5, 2.8, 0.3);
        r.cutBox(MAT.plaster("#e9dcc6"), W / 4 + 0.75, 1.4, D / 2 + outside, W / 2 - 1.5, 2.8, 0.3);
        r.cutBox(MAT.color("#2b2b2b", 0.4, 0.7), 0, 1.3, D / 2 + outside - 0.1, 3, 2.4, 0.08); // gate
        r.extra.add(signSprite(mansion ? "GATEHOUSE" : "GATE", -W / 2 + 2, 2.8, D / 2 + outside - 0.4));
        r.box(MAT.plaster("#e9dcc6"), -W / 2 + 2, 1.3, D / 2 + outside - 1.5, 2.4, 2.6, 2.2, true); // gatehouse
        door = new THREE.Vector3(0, 0, D / 2 + outside - 0.8);
        if (mansion) {
          r.box(MAT.plaster("#efe6d6"), W / 2 - 3, 1.4, D / 2 + outside - 2.2, 4, 2.8, 3, true); // staff quarters
          r.extra.add(signSprite("BOYS' QUARTERS", W / 2 - 3, 3.2, D / 2 + outside - 0.6));
        }
      } else door = new THREE.Vector3(0, 0, D / 2 - 0.4);
      lamp(-3, H - 0.6, 0, 8, 16);
      lamp(3, H - 0.6, -2, 8, 16);
      if (!pent) lamp(0, 3, D / 2 + 3.5, 6, 14);
      break;
    }
  }

  r.spot("bed", bedPos.x, bedPos.z, "Bed");
  r.spot("exit", door.x, door.z, "Go outside");
  for (const sp of r.spots) sp.use = r.uses.get(sp.id);
  const placedRects: NonNullable<Interior["placed"]> = [];
  drawPlaced(r, placed, 0, placedRects);
  const group = r.b.build();
  group.add(r.extra);
  group.traverse((o) => { if ((o as THREE.Mesh).isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return {
    group, bounds, colliders: r.colliders, spots: r.spots, walls: r.walls, door, bed: bedPos,
    size: [bounds.maxX - bounds.minX, bounds.maxZ - bounds.minZ],
    placed: placedRects, clear: r.clear.map((c) => ({ ...c, level: 0 })),
  };
}

function signSprite(text: string, x: number, y: number, z: number) {
  const tex = T.label(text, { bg: "rgba(20,18,30,0.82)" });
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: true }));
  const img = tex.image as HTMLCanvasElement;
  s.scale.set(0.45 * (img.width / img.height), 0.45, 1);
  s.position.set(x, y, z);
  return s;
}

// ---------------------------------------------------------------------------
// Storey buildings (villa: ground + first floor; mansion: ground, first and
// second floor). A stair core in the middle climbs floor to floor; bedrooms
// are spread over the floors, with a sitting room downstairs and a family
// lounge on the first floor. A house you buy comes empty (fitted kitchen and
// bathrooms only); each room shows exactly the furniture bought for it.
// Rented ones come furnished by the landlord.

type Has = (id: string) => boolean;
/** A plain wool rug with a border, in quiet colours. */
function lrug(r: Room, x: number, z: number, w: number, d: number, color = "#cbbfa8") {
  r.box(MAT.fabric("plain", color), x, 0.012, z, w, 0.02, d);
  r.box(MAT.fabric("plain", "#efe6d4"), x, 0.014, z, w - 0.3, 0.02, d - 0.3);
  r.box(MAT.fabric("plain", color), x, 0.016, z, w - 0.5, 0.02, d - 0.5);
}
/** An abstract canvas in a thin gold frame, hung on a wall along x facing +z (dir 1) or -z. */
function canvasArt(r: Room, x: number, y: number, z: number, w: number, h: number, dir: 1 | -1, seed = 0) {
  const pal = [["#8a8378", "#c9bba3", "#2b2b2b"], ["#5b6470", "#d9c9a8", "#b08d57"], ["#6e6a66", "#efe6d4", "#3a2418"], ["#9a8f80", "#d8d0c2", "#4a4642"]][seed % 4];
  r.box(MAT.color("#b08d57", 0.3, 0.7), x, y, z + dir * 0.02, w, h, 0.03);
  r.box(MAT.color("#f4efe6", 0.9), x, y, z + dir * 0.035, w - 0.08, h - 0.08, 0.01);
  for (let i = 0; i < 3; i++) r.box(MAT.color(pal[i], 0.8), x - w / 2 + 0.12 + ((i + 0.5) * (w - 0.24)) / 3, y - 0.04 + (i - 1) * 0.06, z + dir * 0.042, (w - 0.24) / 3 - 0.04, h * (0.45 + i * 0.12), 0.005);
}
/** A bed with the headboard at the back (-z, dir 1) or the front (+z, dir -1). */
function bedDir(r: Room, x: number, z: number, size: "single" | "double" | "king", dir: 1 | -1, cloth: string, upholstered = true, tables = true) {
  const w = size === "king" ? 2.0 : size === "double" ? 1.6 : 1.05, d = 2.1;
  const fm = upholstered ? MAT.color("#7d6a5a", 0.95) : MAT.darkWood();
  r.box(fm, x, 0.22, z, w + 0.1, 0.44, d, true);
  r.box(MAT.white(), x, 0.58, z, w, 0.26, d - 0.1);
  // Hotel-style: crisp cream duvet with a coloured throw (children's beds keep their bright covers).
  r.box(MAT.fabric("plain", upholstered ? "#f1ece2" : cloth), x, 0.73, z + dir * 0.4, w + 0.04, 0.05, 1.25);
  r.box(MAT.fabric("plain", upholstered ? cloth : "#f1ece2"), x, 0.765, z + dir * 0.85, w + 0.06, 0.03, 0.45); // throw at the foot
  if (upholstered) for (const s of size === "single" ? [0] : [-0.25, 0.25]) r.box(MAT.fabric("plain", cloth), x + s * w, 0.86, z - dir * 0.55, 0.4, 0.22, 0.12); // cushions
  for (const s of size === "single" ? [0] : [-1, 1]) r.box(MAT.white(), x + s * w / 4, 0.79, z - dir * 0.78, size === "single" ? w * 0.7 : w * 0.4, 0.15, 0.36);
  r.box(fm, x, upholstered ? 1.25 : 0.95, z - dir * (d / 2 + 0.05), w + 0.3, upholstered ? 1.6 : 1.0, 0.12);
  if (!tables) return;
  for (const s of size === "single" ? [1] : [-1, 1]) {
    r.box(MAT.darkWood(), x + s * (w / 2 + 0.36), 0.28, z - dir * 0.8, 0.48, 0.56, 0.42, true);
    r.cyl(MAT.color("#c8a86a", 0.4, 0.6), x + s * (w / 2 + 0.36), 0.68, z - dir * 0.8, 0.03, 0.24);
    r.cyl(MAT.glow("#fff0cc", 1.1), x + s * (w / 2 + 0.36), 0.9, z - dir * 0.8, 0.14, 0.2);
  }
}
/** Split air-conditioner high on a wall, blowing towards +z (dir 1) or -z (dir -1). */
function splitAC(r: Room, x: number, z: number, dir: 1 | -1 = 1, y = 2.6) {
  r.box(MAT.color("#f4f4f2", 0.3), x, y, z + dir * 0.12, 0.95, 0.3, 0.22);
  r.box(MAT.color("#d9d9d6", 0.4), x, y - 0.11, z + dir * 0.235, 0.85, 0.04, 0.01);
  r.box(MAT.glow("#7fd7ff", 1.5), x + 0.38, y + 0.05, z + dir * 0.235, 0.03, 0.02, 0.005);
}
/** Dressing table against a side wall (side -1 = the room's left wall, facing +x). */
function dresserSide(r: Room, x: number, z: number, side: 1 | -1) {
  r.box(MAT.color("#f1e9dc", 0.5), x, 0.4, z, 0.45, 0.8, 1.2, true);
  for (let i = 0; i < 3; i++) r.box(MAT.color("#c8a86a", 0.3, 0.7), x - side * 0.23, 0.18 + i * 0.25, z, 0.01, 0.02, 0.12);
  r.box(MAT.color("#cfe3ea", 0.02, 0.9), x + side * 0.18, 1.35, z, 0.03, 0.9, 0.8);
  r.box(MAT.color("#c8a86a", 0.3, 0.7), x + side * 0.2, 1.35, z, 0.02, 0.96, 0.86);
  r.cyl(MAT.color("#c9b28c", 0.2, 0.3), x, 0.88, z - 0.4, 0.04, 0.16); // perfume
  r.cyl(MAT.color("#e9e2d4", 0.2, 0.3), x, 0.86, z - 0.28, 0.03, 0.12);
  r.box(MAT.color("#efe7da", 0.8), x - side * 0.6, 0.25, z, 0.4, 0.5, 0.4); // pouffe
}
function desk(r: Room, x: number, z: number, dir: 1 | -1 = 1) {
  r.box(MAT.darkWood(), x, 0.74, z, 1.5, 0.05, 0.7, true);
  for (const s of [-1, 1]) r.box(MAT.darkWood(), x + s * 0.7, 0.37, z, 0.05, 0.74, 0.65);
  r.box(MAT.black(), x, 0.78, z, 0.38, 0.02, 0.26); // laptop
  r.box(MAT.color("#22324a", 0.1), x, 0.9, z - dir * 0.12, 0.38, 0.24, 0.015);
  r.box(MAT.black(), x, 0.48, z + dir * 0.65, 0.5, 0.08, 0.5); // office chair
  r.box(MAT.black(), x, 0.8, z + dir * 0.88, 0.48, 0.6, 0.06);
}
function bookshelf(r: Room, x: number, z: number, w = 1.2, dir: 1 | -1 = 1) {
  r.box(MAT.darkWood(), x, 1.0, z, w, 2.0, 0.35, true);
  for (let i = 0; i < 4; i++) for (let k = 0; k < 3; k++) books(r, x - w / 2 + 0.25 + k * (w / 3), 0.25 + i * 0.48, z + dir * 0.02);
}
/** A window with curtains on a wall that runs along x. */
function curtains(r: Room, x: number, z: number, w: number, dir: 1 | -1 = 1, color = "#e9e2d0", dressed = true) {
  r.box(MAT.glass(), x, 1.55, z + dir * 0.08, w, 1.3, 0.02);
  r.box(MAT.white(), x, 1.55, z + dir * 0.06, w + 0.12, 1.42, 0.04);
  if (!dressed) return;
  for (const s of [-1, 1]) r.box(MAT.color(color, 0.95), x + s * (w / 2 + 0.05), 1.65, z + dir * 0.16, 0.38, 1.85, 0.05);
  r.box(MAT.color("#b08d57", 0.3, 0.7), x, 2.62, z + dir * 0.16, w + 1.0, 0.04, 0.04); // rail
}
function wardrobeSide(r: Room, x: number, z: number, len: number, side: 1 | -1) {
  r.box(MAT.color("#efe7da", 0.6), x, 1.15, z, 0.6, 2.3, len, true);
  for (let i = 1; i < 3; i++) r.box(MAT.color("#d8cfc0", 0.6), x - side * 0.305, 1.15, z - len / 2 + (i * len) / 3, 0.01, 2.2, 0.02);
  for (let i = 0; i < 3; i++) r.box(MAT.color("#c8a86a", 0.3, 0.7), x - side * 0.31, 1.15, z - len / 2 + ((i + 0.5) * len) / 3 + 0.2, 0.02, 0.35, 0.02);
}
function label(r: Room, text: string, x: number, z: number, y = 2.75) {
  const [wx, wz] = r.pt(x, z);
  r.extra.add(signSprite(text, wx, y, wz));
}
/** Split a wall along x or z into pieces with several doorways. */
function wallDoors(r: Room, m: M, x0: number, z0: number, x1: number, z1: number, h: number, gaps: [number, number][]) {
  const along = x0 === x1 ? "z" : "x";
  let a = along === "x" ? Math.min(x0, x1) : Math.min(z0, z1);
  const end = along === "x" ? Math.max(x0, x1) : Math.max(z0, z1);
  for (const g of [...gaps].sort((p, q) => p[0] - q[0])) {
    if (along === "x") r.wall(m, a, z0, g[1], z1, h, g); else r.wall(m, x0, a, x1, g[1], h, g);
    a = g[1];
  }
  if (end - a > 0.05) { if (along === "x") r.wall(m, a, z0, end, z1, h); else r.wall(m, x0, a, x1, end, h); }
}

/**
 * Furnish one bedroom from what's been bought for it, in a local frame: the
 * bed's head wall runs along z = 0, the room spans x in [-hw, hw] and z in
 * [0, len]. `door` is the doorway in the same frame, so nothing blocks it.
 */
function bedroomLocal(r: Room, hw: number, len: number, door: [number, number], name: string, cloth: string, has: Has) {
  const x0 = -hw, x1 = hw;
  const bz = 1.12;
  const bed = has("king_bed") ? "king" : has("double_bed") || has("carpenter_bed") ? "double" : has("twin_beds") ? "twin" : null;
  const empty = !["king_bed", "double_bed", "carpenter_bed", "twin_beds", "wardrobe", "dresser", "desk", "split_ac", "curtains", "rug", "art", "plant", "lights"].some(has);
  if (bed === "twin") {
    bedDir(r, -0.85, bz, "single", 1, cloth, false, false);
    bedDir(r, 0.85, bz, "single", 1, "#7d8fa3", false, false);
    r.box(MAT.darkWood(), 0, 0.28, 0.3, 0.45, 0.56, 0.4, true);
    r.cyl(MAT.glow("#fff0cc", 1.1), 0, 0.75, 0.3, 0.13, 0.22);
  } else if (bed) bedDir(r, 0, bz, bed, 1, cloth, !has("carpenter_bed"));
  const bedHalf = bed === "king" ? 1.6 : bed ? 1.4 : 0.8;
  if (has("rug")) lrug(r, 0, bz + 1.2, Math.min(2 * hw - 1.6, 3.2), 2.2);
  // Which wall is the door on? Keep that side clear.
  const [du, dv] = door;
  const doorSide: "left" | "right" | "foot" = dv > len - 0.4 ? "foot" : du < 0 ? "left" : "right";
  const clear = (u: number, v0: number, v1: number) => !(doorSide !== "foot" && Math.sign(u) === Math.sign(du) && v1 > dv - 0.75 && v0 < dv + 0.75);
  const flip = has("_flip");
  const wardSide: 1 | -1 = doorSide === "left" ? 1 : doorSide === "right" ? -1 : flip ? -1 : 1;
  // Head wall: AC over the bed, a window one side, a painting the other.
  const avail = hw - bedHalf - 0.4;
  const ww = THREE.MathUtils.clamp(avail - 0.6, 0.7, 1.4);
  r.onWall("x", 0, () => {
    if (has("split_ac")) splitAC(r, 0, 0, 1);
    curtains(r, (flip ? 1 : -1) * (hw - 0.2 - avail / 2), 0, ww, 1, "#e6ddcc", has("curtains"));
    if (has("art") && avail > 0.9) canvasArt(r, (flip ? -1 : 1) * (hw - 0.2 - avail / 2), 1.6, 0, Math.min(0.9, avail - 0.2), 1.1, 1, Math.round(hw * 3));
  });
  const wLen = Math.min(2.4, len - 3.2);
  const wv = Math.min(len * 0.5, 3.9);
  if (has("wardrobe") && wLen > 1) wardrobeSide(r, wardSide * (hw - 0.34), wv, wLen, wardSide);
  if (has("dresser")) {
    const ds = (-wardSide) as 1 | -1;
    if (clear(ds * hw, 2.0, 3.2)) dresserSide(r, ds * (hw - 0.25), 2.6, ds);
    else if (len - 0.3 > wv + wLen / 2 + 1.4) dresserSide(r, wardSide * (hw - 0.25), len - 1.0, wardSide);
  }
  if (has("desk")) {
    const dxu = doorSide === "foot" ? (du > 0 ? -1 : 1) * (hw - 1.3) : (-Math.sign(du) || 1) * (hw - 1.3);
    desk(r, dxu, len - 0.5, -1);
  }
  if (has("lights")) pendantLamp(r, 0, 2.6, len / 2, r.wallH);
  if (has("plant")) plant(r, (doorSide === "left" ? 1 : -1) * (hw - 0.45), len - 0.45, true);
  label(r, empty ? `${name} · empty` : name, 0, len / 2);
}
type Side = "back" | "front" | "left" | "right";
/** Turn a room rectangle into the local frame bedroomLocal wants, with the head on `head`. */
function frameOf(x0: number, z0: number, x1: number, z1: number, head: Side) {
  const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
  if (head === "back") return { ox: cx, oz: z0, a: 0, hw: (x1 - x0) / 2, len: z1 - z0 };
  if (head === "front") return { ox: cx, oz: z1, a: Math.PI, hw: (x1 - x0) / 2, len: z1 - z0 };
  if (head === "left") return { ox: x0, oz: cz, a: Math.PI / 2, hw: (z1 - z0) / 2, len: x1 - x0 };
  return { ox: x1, oz: cz, a: -Math.PI / 2, hw: (z1 - z0) / 2, len: x1 - x0 };
}
/** World point → that frame's local (u, v). */
function toLocal(f: { ox: number; oz: number; a: number }, x: number, z: number): [number, number] {
  const dx = x - f.ox, dz = z - f.oz, c = Math.cos(f.a), s = Math.sin(f.a);
  return [dx * c - dz * s, dx * s + dz * c];
}
function seating(r: Room, cx: number, tvZ: number, sofaZ: number, has: Has) {
  // TV on the wall at tvZ, sofa facing it at sofaZ.
  const dir: 1 | -1 = sofaZ > tvZ ? -1 : 1;
  if (has("leather_sofa")) sofaSet(r, cx, sofaZ, "l_shape", dir);
  else if (has("fabric_sofa")) sofaSet(r, cx, sofaZ, "fabric", dir);
  else if (has("wooden_sofa")) sofaSet(r, cx, sofaZ, "wooden", dir);
  if (has("tv65") || has("tv32")) tvWall(r, cx, tvZ + (dir === -1 ? 0.4 : -0.4), has("tv65"));
  const mid = (tvZ + sofaZ) / 2 + (sofaZ - tvZ) * 0.15;
  if (has("coffee_table")) { coffeeTable(r, cx, mid); fruitBowl(r, cx, 0.44, mid); }
  if (has("rug")) lrug(r, cx, (tvZ + sofaZ) / 2 + (sofaZ - tvZ) * 0.1, 4.2, 3.0, "#9a8f80");
  if (has("armchairs")) for (const s of [-1, 1]) {
    const ax = cx + s * 2.6;
    r.box(MAT.color("#c9b28c", 0.9), ax, 0.22, mid, 0.85, 0.44, 0.85, true);
    r.box(MAT.color("#d8c4a0", 0.95), ax, 0.5, mid, 0.76, 0.14, 0.76);
    r.box(MAT.color("#c9b28c", 0.9), ax + s * 0.36, 0.75, mid, 0.14, 0.6, 0.85);
  }
}
function bathroomSet(r: Room, x0: number, z0: number, x1: number, z1: number, tub: boolean) {
  r.floor(MAT.bathTiles(), x0, z0, x1, z1, 0.006);
  r.box(MAT.bathTiles(), (x0 + x1) / 2, 1.0, z0 + 0.04, x1 - x0 - 0.1, 2.0, 0.02);
  toilet(r, x0 + 0.5, z0 + 0.45);
  sink(r, x0 + 1.35, z0 + 0.35);
  if (x1 - x0 > 3.4) sink(r, x0 + 2.0, z0 + 0.35);
  if (tub && x1 - x0 > 3.2) bathtub(r, x1 - 1.0, z0 + 0.55);
  shower(r, x1 - 0.55, z1 - 0.55, true);
  r.box(MAT.color("#ffffff", 0.9), x0 + 0.08, 1.2, (z0 + z1) / 2, 0.04, 0.6, 0.4); // towel
}
/** Glass balustrade with a brass handrail along x or z; solid to walk into. */
function balustrade(r: Room, x0: number, z0: number, x1: number, z1: number) {
  const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, alongX = Math.abs(x1 - x0) > Math.abs(z1 - z0);
  const w = alongX ? x1 - x0 : 0.04, d = alongX ? 0.04 : z1 - z0;
  r.box(MAT.glass(), cx, 0.5, cz, w, 1.0, d);
  r.box(MAT.color("#b08d57", 0.3, 0.7), cx, 1.02, cz, alongX ? w : 0.06, 0.05, alongX ? 0.06 : d);
  r.colliders.push({ minX: Math.min(x0, x1) - (alongX ? 0 : 0.08), maxX: Math.max(x0, x1) + (alongX ? 0 : 0.08), minZ: Math.min(z0, z1) - (alongX ? 0.08 : 0), maxZ: Math.max(z0, z1) + (alongX ? 0.08 : 0) });
}
/** Outdoor chairs and a table on a terrace or balcony. */
function terraceSet(r: Room, x: number, z: number) {
  r.cyl(MAT.color("#3a3a3a", 0.5, 0.4), x, 0.36, z, 0.45, 0.04);
  r.cyl(MAT.color("#3a3a3a", 0.5, 0.4), x, 0.18, z, 0.04, 0.36);
  for (const s of [-1, 1]) {
    r.box(MAT.color("#6b5a48", 0.8), x + s * 0.85, 0.22, z, 0.6, 0.06, 0.6, true);
    r.box(MAT.color("#6b5a48", 0.8), x + s * 1.12, 0.5, z, 0.06, 0.55, 0.6);
    r.box(MAT.fabric("plain", "#e6ddcc"), x + s * 0.85, 0.28, z, 0.55, 0.06, 0.55);
  }
}

export type Flight = { from: number; x0: number; x1: number; zStart: number; zEnd: number };

function buildManor(spec: HomeSpec, items: string[], furnish: Furnishing | null, placed: PlacedPiece[], finishes: Finishes): Interior {
  const mansion = spec.tier === "mansion";
  const dims = manorDims(spec.tier as "villa" | "mansion");
  const fl = (room: string, fallback: M) => floorMat(finishes.floors?.[room], fallback);
  const f = furnish ?? fullyFurnished(spec.tier);
  const hasIn = (room: string): Has => (id) => (f[room] ?? []).includes(id);
  const roomEmpty = (room: string) => !(f[room] ?? []).some((x) => x !== "_flip");
  // Shared with the server's placement checks, so the rooms line up.
  const { hx, hz, FY, NL, s0, s1, HW, outside } = dims; // the stair core runs from s0 (back) to s1 (front); the hall is x in [-HW, HW]
  const flights: Flight[] = [];
  for (let i = 0; i < NL - 1; i++) flights.push(i % 2 === 0 ? { from: i, x0: -1.5, x1: -0.1, zStart: s1, zEnd: s0 } : { from: i, x0: 0.1, x1: 1.5, zStart: s0, zEnd: s1 });
  const L: Room[] = [];
  for (let k = 0; k < NL; k++) { const rr = new Room(); rr.wallH = FY; L.push(rr); }
  const r = L[0];
  const lamp = (rr: Room, x: number, y: number, z: number, i = 7, d = 10) => { const l = new THREE.PointLight("#ffe2b0", i, d, 1.6); l.position.set(x, y, z); rr.extra.add(l); };
  const wallM = MAT.plaster(FINISHES.wall[finishes.wall ?? "cream"].color);
  const cols = ["#8a7a68", "#6b7684", "#7d8a74", "#a08c6c", "#857a8c", "#8c7466", "#7a7a72"];
  const D1 = [s0 - 2.2, s0 - 1.2] as [number, number]; // a door off the back hall
  const D2 = [s1 - 1.6, s1 - 0.6] as [number, number]; // a door off the stair-side corridor
  const D3 = [s1 + 0.8, s1 + 1.7] as [number, number]; // a door off the front landing
  const ARCH = [s1 + 0.6, hz - 0.6] as [number, number];
  const bedSpots: { id: string; level: number; x: number; z: number; lx: number; lz: number; mat: boolean }[] = [];

  /** A bedroom in a rectangle, head on `head`, door at (doorX, doorZ). */
  const bedroomAt = (k: number, id: string, name: string, x0: number, z0: number, x1: number, z1: number, head: Side, doorX: number, doorZ: number, ci: number) => {
    const rr = L[k];
    const fr = frameOf(x0, z0, x1, z1, head);
    const has = hasIn(id);
    rr.floor(fl(id, MAT.wood()), x0, z0, x1, z1, 0.005);
    rr.turned(fr.ox, fr.oz, fr.a, () => bedroomLocal(rr, fr.hw, fr.len, toLocal(fr, doorX, doorZ), name, cols[ci % cols.length], has));
    // Where you lie down (or the mat on the floor if there's no bed yet).
    const anyBed = ["king_bed", "double_bed", "carpenter_bed", "twin_beds"].some(has);
    let use: [number, number] = [0, 0], look: [number, number] = [0, 0], spot: [number, number] = [0, 0];
    rr.turned(fr.ox, fr.oz, fr.a, () => {
      const bx = has("twin_beds") ? -0.85 : 0;
      use = rr.pt(bx, 1.42); look = rr.pt(bx, 0.2); spot = rr.pt(bx + 1.4, 2.8);
    });
    bedSpots.push({ id, level: k, x: use[0], z: use[1], lx: look[0], lz: look[1], mat: !anyBed });
    void spot;
    lamp(rr, (x0 + x1) / 2, FY - 0.4, (z0 + z1) / 2, 5, 9);
  };

  // ---------------- Shell of every floor ----------------
  for (let k = 0; k < NL; k++) {
    const rr = L[k];
    // Floor slab, open where the stair arrives from below.
    const arr = flights.find((fl) => fl.from === k - 1);
    const fm = k === 0 ? MAT.marble() : MAT.marble();
    if (!arr) rr.floor(fm, -hx, -hz, hx, hz);
    else {
      rr.floor(fm, -hx, -hz, hx, s0);
      rr.floor(fm, -hx, s1, hx, hz);
      rr.floor(fm, -hx, s0, arr.x0, s1);
      rr.floor(fm, arr.x1, s0, hx, s1);
    }
    rr.wall(wallM, -hx, -hz, hx, -hz, FY);
    rr.wall(wallM, -hx, -hz, -hx, hz, FY);
    rr.wall(wallM, hx, -hz, hx, hz, FY);
    // Windows on the outside walls, every few metres.
    rr.onWall("x", -hz, () => { for (let x = -hx + 2; x < hx - 1; x += 4) { rr.box(MAT.glass(), x, 1.6, -hz + 0.08, 1.3, 1.3, 0.02); rr.box(MAT.white(), x, 1.6, -hz + 0.06, 1.42, 1.42, 0.03); } });
    // Stair core: the wall between the flights, rails and landings.
    rr.cutBox(MAT.plaster("#ece5d8"), 0, FY / 2, (s0 + s1) / 2, 0.2, FY, s1 - s0);
    lamp(rr, 0, FY - 0.3, s0 - 1.2, 6, 10);
    lamp(rr, 0, FY - 0.3, s1 + 1.2, 6, 10);
  }
  // The flights themselves: marble treads and risers, solid underneath, a glass and brass balustrade outside.
  for (const fl of flights) {
    const rr = L[fl.from];
    const steps = Math.round(FY / 0.17), run = (fl.zEnd - fl.zStart) / steps;
    const sx = (fl.x0 + fl.x1) / 2, sw = fl.x1 - fl.x0;
    for (let i = 0; i < steps; i++) {
      const z = fl.zStart + (i + 0.5) * run, y = ((i + 1) * FY) / steps;
      rr.box(MAT.marble(), sx, y - 0.04, z, sw, 0.08, Math.abs(run) + 0.03);
      rr.box(MAT.color("#ece5d8", 0.7), sx, (y - 0.08) / 2, z, sw, Math.max(0.02, y - 0.08), Math.abs(run) + 0.02);
    }
    const outer = fl.x0 < 0 ? fl.x0 - 0.04 : fl.x1 + 0.04;
    const dz = fl.zEnd - fl.zStart, len = Math.hypot(FY, dz), slope = dz < 0 ? Math.atan2(FY, -dz) : -Math.atan2(FY, dz);
    rr.add(G.box, MAT.glass(), [outer, FY / 2 + 0.5, (fl.zStart + fl.zEnd) / 2], [slope, 0, 0], [0.03, 0.9, len]);
    rr.add(G.box, MAT.color("#b08d57", 0.3, 0.7), [outer, FY / 2 + 0.97, (fl.zStart + fl.zEnd) / 2], [slope, 0, 0], [0.06, 0.05, len]);
    label(rr, "Stairs ↑", sx, fl.zStart - Math.sign(run) * 0.5, 2.2);
    if (L[fl.from + 1]) label(L[fl.from + 1], "Stairs ↓", sx, fl.zEnd + Math.sign(run) * 0.5, 2.2);
  }
  // What you can't walk through on each floor around the stairs.
  const levelColliders = (k: number): Rect[] => {
    const out: Rect[] = [{ minX: -0.1, maxX: 0.1, minZ: s0, maxZ: s1 }];
    const dep = flights.find((fl) => fl.from === k), arr = flights.find((fl) => fl.from === k - 1);
    const outerRail = (fl: Flight): Rect => fl.x0 < 0 ? { minX: fl.x0 - 0.12, maxX: fl.x0, minZ: s0, maxZ: s1 } : { minX: fl.x1, maxX: fl.x1 + 0.12, minZ: s0, maxZ: s1 };
    if (dep) {
      out.push(outerRail(dep));
      // You can't step onto the top end of a flight from its own floor.
      out.push(dep.zEnd < dep.zStart ? { minX: dep.x0, maxX: dep.x1, minZ: dep.zEnd - 0.1, maxZ: dep.zEnd + 1.3 } : { minX: dep.x0, maxX: dep.x1, minZ: dep.zEnd - 1.3, maxZ: dep.zEnd + 0.1 });
    }
    if (arr) {
      out.push(outerRail(arr));
      out.push({ minX: arr.x0, maxX: arr.x1, minZ: arr.zStart - 0.08, maxZ: arr.zStart + 0.08 }); // rail across the bottom end of the hole
    }
    // Any other flight on the ground floor is closed in underneath (a cupboard).
    if (k === 0) for (const fl of flights) if (fl !== dep) out.push({ minX: fl.x0, maxX: fl.x1, minZ: s0, maxZ: s1 });
    return out;
  };
  for (let k = 0; k < NL; k++) {
    const rr = L[k];
    const arr = flights.find((fl) => fl.from === k - 1);
    if (arr) {
      const ox = arr.x0 < 0 ? arr.x0 - 0.04 : arr.x1 + 0.04;
      rr.box(MAT.glass(), ox, 0.5, (s0 + s1) / 2, 0.03, 1.0, s1 - s0);
      rr.box(MAT.color("#b08d57", 0.3, 0.7), ox, 1.02, (s0 + s1) / 2, 0.06, 0.05, s1 - s0);
      rr.box(MAT.glass(), (arr.x0 + arr.x1) / 2, 0.5, arr.zStart, arr.x1 - arr.x0, 1.0, 0.03);
    }
    rr.colliders.push(...levelColliders(k));
  }

  // ---------------- Ground floor ----------------
  // Front wall with the main door; the hall walls to the wings.
  wallDoors(r, wallM, -hx, hz, hx, hz, FY, [[-1.1, 1.1]]);
  r.onWall("x", hz, () => { r.box(MAT.doorWood(), -0.55, 1.25, hz, 1.1, 2.5, 0.1); r.add(G.box, MAT.doorWood(), [1.0, 1.25, hz - 0.5], [0, -1.2, 0], [1.1, 2.5, 0.08]); });
  wallDoors(r, wallM, -HW, -hz, -HW, hz, FY, [[-4.6, -3.4], ARCH]);
  wallDoors(r, wallM, HW, -hz, HW, hz, FY, [[-4.6, -3.4], ARCH]);
  // Chandelier over the foyer.
  const ch = new THREE.Group();
  for (let i = 0; i < 36; i++) {
    const a = (i / 12) * Math.PI * 2, ring = Math.floor(i / 12), rr = 0.6 - ring * 0.15;
    const m = new THREE.Mesh(G.sphere, MAT.color("#fff6e0", 0.05, 0.2));
    m.scale.setScalar(0.06);
    m.position.set(Math.cos(a) * rr, -ring * 0.22, Math.sin(a) * rr);
    ch.add(m);
  }
  ch.position.set(0, FY - 0.6, (s1 + hz) / 2 + 0.3);
  r.extra.add(ch);
  lamp(r, 0, FY - 0.9, (s1 + hz) / 2 + 0.3, 10, 14);
  r.box(MAT.darkMarble(), 0, 0.004, (s1 + hz) / 2 + 0.3, 2.6, 0.008, 2.0);
  // Living room (sitting room) — front left.
  const lx0 = -hx, lx1 = -HW, lz0 = 0.5, lcx = (lx0 + lx1) / 2;
  const Lv = hasIn("living");
  r.wall(wallM, lx0, lz0, lx1, lz0, FY);
  r.floor(fl("living", MAT.wood()), lx0, lz0, lx1, hz, 0.005);
  seating(r, lcx, lz0, lz0 + 4.0, Lv);
  r.onWall("x", lz0, () => { if (Lv("split_ac")) splitAC(r, lcx + 2.8, lz0, 1, 2.7); if (Lv("art")) canvasArt(r, lcx - 2.9, 1.9, lz0, 1.4, 1.0, 1, 1); });
  r.onWall("x", hz, () => curtains(r, lcx, hz, 2.8, -1, "#e6ddcc", Lv("curtains")));
  if (Lv("piano")) {
    const px = Lv("_flip") ? lx1 - 1.6 : lx0 + 1.4;
    r.box(MAT.black(), px, 0.75, hz - 2.0, 1.5, 0.25, 2.0, true);
    r.box(MAT.black(), px, 0.85, hz - 0.85, 1.5, 0.3, 0.3);
    r.box(MAT.white(), px, 0.75, hz - 0.8, 1.3, 0.04, 0.18);
  }
  if (Lv("lights")) { floorLamp(r, lx0 + 0.6, lz0 + 4.0); pendantLamp(r, lcx, 2.9, lz0 + 2.5, FY); }
  if (Lv("plant")) plant(r, lx1 - 0.6, lz0 + 0.6, true);
  if (Lv("bookshelf")) r.turned(lx0 + 0.2, lz0 + 2.2, Math.PI / 2, () => bookshelf(r, 0, 0, 1.6, 1));
  label(r, roomEmpty("living") ? "Sitting room · empty" : "Sitting room", lcx, lz0 + 2.6);
  lamp(r, lcx, FY - 0.4, (lz0 + hz) / 2, 8, 12);
  // Guest bedroom with its own shower room, study, guest WC, the corridor between.
  const gx1 = -5.6, guestId = mansion ? "bed7" : "bed4";
  r.wall(wallM, gx1, -hz, gx1, lz0, FY, [-4.6, -3.4]);
  r.wall(wallM, gx1, -5, lx1, -5, FY, [-4.6, -3.6]);
  r.wall(wallM, gx1, -3, lx1, -3, FY, [-4.6, -3.6]);
  r.wall(wallM, -hx, -1.8, -hx + 2.6, -1.8, FY, [-hx + 1.4, -hx + 2.3]);
  r.wall(wallM, -hx + 2.6, -1.8, -hx + 2.6, lz0, FY);
  bathroomSet(r, -hx + 0.1, -1.7, -hx + 2.5, lz0 - 0.1, false);
  label(r, "Shower room", -hx + 1.3, -0.6);
  bedroomAt(0, guestId, "Guest bedroom", -hx, -hz, gx1, -1.8, "back", gx1, -4, 6);
  const St = hasIn("study"), scx = (gx1 + lx1) / 2;
  r.floor(fl("study", MAT.wood()), gx1, -3, lx1, lz0, 0.005);
  if (St("desk")) desk(r, scx, lz0 - 0.55, -1);
  if (St("bookshelf")) r.turned(gx1 + 0.2, -1.2, Math.PI / 2, () => bookshelf(r, 0, 0, 2.0, 1));
  if (St("split_ac")) r.onWall("x", lz0, () => splitAC(r, scx, lz0, -1));
  if (St("plant")) plant(r, lx1 - 0.4, -2.6, false);
  if (St("lights")) pendantLamp(r, scx, 2.6, -1.2, FY);
  label(r, roomEmpty("study") ? "Study · empty" : "Study", scx, -1.2);
  r.floor(MAT.bathTiles(), gx1, -hz, lx1, -5, 0.006);
  toilet(r, gx1 + 0.6, -hz + 0.5);
  sink(r, lx1 - 0.7, -hz + 0.35);
  label(r, "Guest WC", scx, -hz + 1.4);
  // Dining (front right) and the kitchen behind it.
  const dx0 = HW, dx1 = hx, dcx = (dx0 + dx1) / 2, kz = mansion ? 2 : 1.5, dcz = (kz + hz) / 2 + 0.3;
  const Dn = hasIn("dining");
  r.wall(wallM, dx0, kz, dx1, kz, FY, [dx0 + 1.4, dx0 + 3.9]);
  if (finishes.floors?.dining) r.floor(fl("dining", MAT.marble()), dx0, kz, dx1, hz, 0.005);
  if (Dn("dining10")) diningSet(r, dcx, dcz, 10, MAT.darkMarble());
  else if (Dn("dining6")) diningSet(r, dcx, dcz, 6, MAT.darkWood());
  if (Dn("lights")) for (const ddx of [-1, 1]) pendantLamp(r, dcx + ddx, 2.4, dcz, FY);
  if (Dn("cabinet")) { r.box(MAT.darkWood(), dx1 - 0.3, 1.0, dcz, 0.45, 2.0, 2.2, true); r.box(MAT.glass(), dx1 - 0.53, 1.3, dcz, 0.01, 1.2, 2.0); }
  r.onWall("x", hz, () => { if (Dn("split_ac")) splitAC(r, dcx, hz, -1, 2.7); curtains(r, dcx, hz, 2.8, -1, "#e6ddcc", Dn("curtains")); });
  r.onWall("x", kz, () => { if (Dn("art")) canvasArt(r, dcx + 1.6, 1.9, kz, 1.4, 1.0, 1, 2); });
  if (Dn("rug")) lrug(r, dcx, dcz, 5, 3.4, "#9a8f80");
  if (Dn("plant")) plant(r, dx1 - 0.6, hz - 0.6, true);
  label(r, roomEmpty("dining") ? "Dining room · empty" : "Dining room", dcx, dcz);
  r.floor(MAT.terrazzo(), dx0, -hz, dx1, kz, 0.005);
  fittedKitchen(r, dx0 + 0.15, -hz + 0.15, dx1 - dx0 - 0.3, 2.4, true);
  potsOnHob(r, dx0 + (dx1 - dx0) * 0.5, 0.95, -hz + 0.5);
  const kcz = (-hz + kz) / 2 + 0.4;
  r.box(MAT.darkMarble(), dcx, 0.47, kcz, 3.0, 0.94, 1.1, true); // island
  for (let i = -1; i <= 1; i++) r.cyl(MAT.color("#3a2418", 0.4), dcx + i * 0.9, 0.38, kcz + 0.85, 0.18, 0.76);
  r.box(MAT.steel(), dx1 - 0.5, 1.0, kz - 1.0, 0.9, 2.0, 0.75, true); // American fridge
  label(r, "Kitchen", dcx, kcz - 1.6);
  r.spot("kitchen", dcx, -hz + 2.0, "Kitchen");
  r.use("kitchen", dcx, 0, -hz + 1.1, [dcx, -hz], "stand");
  lamp(r, dcx, FY - 0.4, kcz, 8, 12);

  // ---------------- First floor ----------------
  const U1 = L[1];
  wallDoors(U1, wallM, -hx, hz, hx, hz, FY, mansion ? [[6.4 + 0.6, hx]] : [[6.4, hx]]);
  wallDoors(U1, wallM, -HW, -hz, -HW, hz, FY, [D1, ARCH]);
  wallDoors(U1, wallM, HW, -hz, HW, hz, FY, [D1, D2, D3]);
  // Family lounge — the upstairs sitting room, over the living room.
  const Lo = hasIn("lounge");
  U1.wall(wallM, -hx, lz0, -HW, lz0, FY);
  U1.floor(fl("lounge", MAT.wood()), -hx, lz0, -HW, hz, 0.005);
  seating(U1, lcx, lz0, lz0 + 4.0, Lo);
  if (Lo("bookshelf")) U1.turned(-hx + 0.2, lz0 + 2.2, Math.PI / 2, () => bookshelf(U1, 0, 0, 1.6, 1));
  U1.onWall("x", hz, () => { if (Lo("split_ac")) splitAC(U1, lcx, hz, -1); curtains(U1, lcx, hz, 2.6, -1, "#e6ddcc", Lo("curtains")); });
  U1.onWall("x", lz0, () => { if (Lo("art")) canvasArt(U1, lcx - 2.9, 1.8, lz0, 1.2, 0.9, 1, 3); });
  if (Lo("plant")) plant(U1, -HW - 0.5, hz - 0.5, true);
  if (Lo("lights")) pendantLamp(U1, lcx, 2.6, (lz0 + hz) / 2, FY);
  label(U1, roomEmpty("lounge") ? "Family lounge · empty" : "Family lounge", lcx, lz0 + 2.6);
  lamp(U1, lcx, FY - 0.4, (lz0 + hz) / 2, 7, 12);
  // Master suite (back left) with its ensuite.
  const ex1 = -hx + 4;
  U1.wall(wallM, ex1, lz0 - 3.2, ex1, lz0, FY, [lz0 - 2.4, lz0 - 1.5]);
  U1.wall(wallM, -hx, lz0 - 3.2, ex1, lz0 - 3.2, FY);
  bathroomSet(U1, -hx + 0.1, lz0 - 3.1, ex1 - 0.1, lz0 - 0.1, true);
  label(U1, "Ensuite", -hx + 2, lz0 - 1.6);
  U1.spot("bath", ex1 - 1.0, lz0 - 2.0, "Bath");
  U1.use("bath", ex1 - 1.0, 0.35, lz0 - 2.55, [ex1 - 2.2, lz0 - 2.55], "lie");
  bedroomAt(1, "bed1", "Master bedroom", -hx, -hz, -HW, lz0 - 3.2, "back", -HW, (D1[0] + D1[1]) / 2, 0);
  // Right wing: bedrooms 2 and 3, a bathroom and a balcony.
  const bxm = HW + (mansion ? 4.4 : 3.8);
  U1.wall(wallM, HW, s0, hx, s0, FY);
  U1.wall(wallM, HW, s1, hx, s1, FY, [bxm + 1.2, bxm + 2.1]);
  U1.wall(wallM, bxm, s1, bxm, hz, FY);
  bedroomAt(1, "bed2", "Bedroom 2", HW, -hz, hx, s0, "back", HW, (D1[0] + D1[1]) / 2, 1);
  bedroomAt(1, "bed3", "Bedroom 3", HW, s0, hx, s1, "back", HW, (D2[0] + D2[1]) / 2, 2);
  bathroomSet(U1, HW + 0.1, s1 + 0.1, bxm - 0.1, hz - 0.1, false);
  label(U1, "Bathroom", (HW + bxm) / 2, (s1 + hz) / 2);
  U1.floor(MAT.terrazzo(), bxm, s1, hx, hz, 0.006);
  balustrade(U1, bxm, hz, hx, hz);
  terraceSet(U1, (bxm + hx) / 2, (s1 + hz) / 2 + 0.3);
  plant(U1, hx - 0.5, hz - 0.5, true);
  label(U1, "Balcony", (bxm + hx) / 2, (s1 + hz) / 2 - 0.6);

  // ---------------- Second floor (mansion) ----------------
  if (mansion) {
    const U2 = L[2];
    wallDoors(U2, wallM, -hx, hz, hx, hz, FY, [[-hx, -HW], [HW, hx]]);
    wallDoors(U2, wallM, -HW, -hz, -HW, hz, FY, [D1, D2, D3]);
    wallDoors(U2, wallM, HW, -hz, HW, hz, FY, [D1, D2, D3]);
    U2.wall(wallM, -hx, s0, -HW, s0, FY);
    U2.wall(wallM, -hx, s1, -HW, s1, FY);
    U2.wall(wallM, HW, s0, hx, s0, FY);
    U2.wall(wallM, HW, s1, hx, s1, FY, [8.2, 9.1]);
    U2.wall(wallM, 7, s0, 7, s1, FY);
    bedroomAt(2, "bed4", "Bedroom 4", -hx, -hz, -HW, s0, "back", -HW, (D1[0] + D1[1]) / 2, 3);
    bedroomAt(2, "bed5", "Bedroom 5", -hx, s0, -HW, s1, "left", -HW, (D2[0] + D2[1]) / 2, 4);
    bedroomAt(2, "bed6", "Bedroom 6", HW, -hz, hx, s0, "back", HW, (D1[0] + D1[1]) / 2, 5);
    bathroomSet(U2, HW + 0.1, s0 + 0.1, 7 - 0.1, s1 - 0.1, false);
    label(U2, "Bathroom", (HW + 7) / 2, (s0 + s1) / 2);
    U2.floor(MAT.terrazzo(), 7, s0, hx, s1, 0.006);
    U2.box(MAT.white(), 9.5, 0.45, s0 + 0.45, 0.65, 0.9, 0.65, true); // washing machine
    U2.box(MAT.white(), 10.3, 0.45, s0 + 0.45, 0.65, 0.9, 0.65, true); // dryer
    U2.box(MAT.color("#d8d0c2", 0.8), 11.3, 0.8, (s0 + s1) / 2, 0.6, 1.6, 2.4, true); // linen press
    label(U2, "Laundry", 9.5, (s0 + s1) / 2);
    // Roof terraces at the front, either side of the landing.
    for (const [a, b] of [[-hx, -HW], [HW, hx]] as const) {
      U2.floor(MAT.terrazzo(), a, s1, b, hz, 0.006);
      balustrade(U2, a, hz, b, hz);
      terraceSet(U2, (a + b) / 2, (s1 + hz) / 2 + 0.4);
      plant(U2, a < 0 ? a + 0.5 : b - 0.5, hz - 0.5, true);
      label(U2, "Roof terrace", (a + b) / 2, (s1 + hz) / 2 - 0.5);
    }
    balustrade(U2, -HW, hz, HW, hz);
  } else {
    // Villa: the landing front looks out over the porch.
  }

  // Where you sleep: the master bed, or the first bedroom with a bed in it.
  const order = ["bed1", "bed2", "bed3", "bed4", "bed5", "bed6", "bed7"];
  const sleepIn = order.map((id) => bedSpots.find((b) => b.id === id)).find((b) => b && !b.mat) ?? bedSpots.find((b) => b.id === "bed1")!;
  const SR = L[sleepIn.level];
  if (sleepIn.mat) SR.box(MAT.fabric("plain", "#cbbfa8"), (sleepIn.x + sleepIn.lx) / 2, 0.03, (sleepIn.z + sleepIn.lz) / 2, 0.9, 0.05, 1.9);
  SR.use("bed", sleepIn.x, sleepIn.mat ? 0.08 : 0.72, sleepIn.z, [sleepIn.lx, sleepIn.lz], "lie");
  const sdx = sleepIn.x - sleepIn.lx, sdz = sleepIn.z - sleepIn.lz, sl = Math.hypot(sdx, sdz) || 1;
  SR.spot("bed", sleepIn.x + (sdx / sl) * 1.3 + (sdz / sl) * 1.2, sleepIn.z + (sdz / sl) * 1.3 - (sdx / sl) * 1.2, sleepIn.mat ? "Sleep on a mat" : "Bed");
  // TV: the sitting room downstairs, or the family lounge.
  const tvRoom = Lv("tv65") || Lv("tv32") ? 0 : Lo("tv65") || Lo("tv32") ? 1 : -1;
  if (tvRoom >= 0) {
    const TR = L[tvRoom], has = tvRoom === 0 ? Lv : Lo;
    const sofa = ["leather_sofa", "fabric_sofa", "wooden_sofa"].some(has);
    TR.spot("tv", lcx + 0.4, lz0 + 2.6, "TV");
    TR.use("tv", lcx, sofa ? 0.5 : 0, sofa ? lz0 + 4.0 : lz0 + 2.6, [lcx, lz0], sofa ? "sit" : "stand");
  }

  // ---------------- Outside: drive, garden, pool, gatehouse ----------------
  r.floor(MAT.grass(), -hx, hz, hx, hz + outside);
  r.floor(MAT.color("#d8d0c2", 0.7), -2.4, hz, 2.4, hz + outside, 0.01);
  for (const x of [-1.8, 1.8]) r.cyl(MAT.white(), x, FY / 2, hz + 1.2, 0.2, FY);
  r.box(MAT.white(), 0, FY + 0.1, hz + 1.2, 4.6, 0.2, 2.6); // porch canopy
  const pz = hz + 4.6, pxc = hx - 6.2, pw = 9.0, pd = 3.6;
  for (const [x, z, w, d] of [[pxc, pz - pd / 2 - 0.35, pw + 1.4, 0.7], [pxc, pz + pd / 2 + 0.35, pw + 1.4, 0.7], [pxc - pw / 2 - 0.35, pz, 0.7, pd], [pxc + pw / 2 + 0.35, pz, 0.7, pd]] as const) r.box(MAT.color("#e6ded0", 0.6), x, 0.04, z, w, 0.08, d);
  r.box(MAT.color("#5fc0d6", 0.3), pxc, -1.5, pz, pw, 0.05, pd);
  for (const [x, z, w, d] of [[pxc, pz - pd / 2, pw, 0.04], [pxc, pz + pd / 2, pw, 0.04], [pxc - pw / 2, pz, 0.04, pd], [pxc + pw / 2, pz, 0.04, pd]] as const) r.box(MAT.color("#9fdbe8", 0.3), x, -0.75, z, w, 1.5, d);
  r.box(MAT.water(), pxc, -0.12, pz, pw, 0.02, pd);
  for (let i = 0; i < 2; i++) r.box(MAT.steel(), pxc - pw / 2 + 0.3, 0.45, pz - 0.4 + i * 0.8, 0.04, 0.9, 0.04);
  r.spot("pool", pxc - pw / 2 - 0.9, pz, "Pool");
  r.use("pool", pxc - pw / 2 + 0.3, -0.3, pz, [pxc + pw / 2 - 0.3, pz], "swim");
  r.colliders.push({ minX: pxc - pw / 2, maxX: pxc + pw / 2, minZ: pz - pd / 2, maxZ: pz + pd / 2 });
  for (let i = 0; i < 3; i++) { r.box(MAT.white(), pxc - 3 + i * 1.7, 0.2, pz + pd / 2 + 1.5, 0.7, 0.3, 1.8, true); r.box(MAT.white(), pxc - 3 + i * 1.7, 0.45, pz + pd / 2 + 0.75, 0.7, 0.5, 0.1); }
  r.cutBox(MAT.plaster("#e9dcc6"), -hx / 2 - 1.25, 1.4, hz + outside, hx - 2.5, 2.8, 0.3);
  r.cutBox(MAT.plaster("#e9dcc6"), hx / 2 + 1.25, 1.4, hz + outside, hx - 2.5, 2.8, 0.3);
  r.cutBox(MAT.color("#2b2b2b", 0.4, 0.7), 0, 1.3, hz + outside - 0.1, 5, 2.4, 0.08, false);
  r.box(MAT.plaster("#e9dcc6"), -hx + 2, 1.3, hz + outside - 1.6, 2.6, 2.6, 2.4, true);
  label(r, mansion ? "Gatehouse" : "Gate", -hx + 2, hz + outside - 0.4, 3.0);
  if (mansion) {
    r.box(MAT.plaster("#efe6d6"), -hx + 6.5, 1.4, hz + outside - 2.2, 4, 2.8, 3, true);
    label(r, "Boys' quarters", -hx + 6.5, hz + outside - 0.5, 3.2);
  }
  for (let i = 0; i < 4; i++) plant(r, -hx + 1 + i * 1.6, hz + 1.0, true);
  lamp(r, pxc, 3, pz, 6, 14);
  ownedExtras(r, items.filter((i) => i === "generator"), { tv: [0, 0], fridge: [0, 0], gen: [hx - 1.2, hz + outside - 1.2] });

  const door = new THREE.Vector3(0, 0, hz + outside - 0.9);
  r.spot("exit", door.x, door.z, "Go outside");
  const placedRects: NonNullable<Interior["placed"]> = [];
  L.forEach((rr, k) => drawPlaced(rr, placed, k, placedRects));
  const group = r.b.build();
  group.add(r.extra);
  const levels: Level[] = [{ y: 0, group: null, colliders: r.colliders, blocked: [] }];
  for (let k = 0; k < NL; k++) {
    const rr = L[k], y = k * FY;
    for (const sp of rr.spots) { sp.pos.y = y; const u = rr.uses.get(sp.id); sp.use = u ? { ...u, y: u.y + y } : undefined; }
    if (k === 0) continue;
    const g = rr.b.build();
    g.add(rr.extra);
    g.position.y = y;
    g.visible = false;
    group.add(g);
    levels.push({ y, group: g, colliders: rr.colliders, blocked: [{ minX: -hx - 5, maxX: hx + 5, minZ: hz, maxZ: hz + outside + 2 }] });
  }
  group.traverse((o) => { if ((o as THREE.Mesh).isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  const bedUse = SR.uses.get("bed")!;
  return {
    group, bounds: { minX: -hx, maxX: hx, minZ: -hz, maxZ: hz + outside }, colliders: r.colliders,
    spots: L.flatMap((rr) => rr.spots), walls: L.flatMap((rr) => rr.walls), door,
    bed: new THREE.Vector3(bedUse.x, sleepIn.level * FY, bedUse.z),
    size: [2 * hx, 2 * hz + outside],
    storeys: { levels, flights },
    placed: placedRects,
    clear: L.flatMap((rr, k) => rr.clear.map((c) => ({ ...c, level: k }))),
  };
}
