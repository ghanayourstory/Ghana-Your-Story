// Homes from the inside, by what kind of home they are. A compound room opens
// onto a shared courtyard (the bathroom is at the far end, the coal pot by your
// door); a penthouse is glass, marble and an island kitchen over the city.
// Owned furniture and appliances show up on top of what the home comes with.
import * as THREE from "three";
import { Batcher, G } from "./batch.ts";
import * as T from "./textures.ts";
import type { HomeSpec } from "../../shared/homes.ts";

export interface InteriorSpot {
  id: "bed" | "bath" | "tv" | "kitchen" | "coalpot" | "neighbours" | "terrace" | "pool" | "exit";
  pos: THREE.Vector3;
  label: string;
}
export interface Interior {
  group: THREE.Group;
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
  colliders: { minX: number; maxX: number; minZ: number; maxZ: number }[];
  spots: InteriorSpot[];
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
  fabric: (pattern: "wax" | "kente" | "plain" | "stripe", color: string) => std(`fab:${pattern}:${color}`, { map: T.fabric(pattern, color), roughness: 0.95 }),
  color: (c: string, rough = 0.7, metal = 0) => std(`c:${c}:${rough}:${metal}`, { color: c, roughness: rough, metalness: metal }),
  skyline: () => mat("skyline", () => new THREE.MeshBasicMaterial({ map: canvasTex("skyline", 1024, 512, skyline) })),
  bars: () => std("bars", { color: "#2b2b2b", roughness: 0.5, metalness: 0.6 }),
};

// ---------------------------------------------------------------------------
// Builder

class Room {
  b = new Batcher();
  extra = new THREE.Group();
  colliders: Interior["colliders"] = [];
  spots: InteriorSpot[] = [];
  box(m: M, x: number, y: number, z: number, w: number, h: number, d: number, solid = false, ry = 0) {
    this.b.add(G.box, m, [x, y, z], [0, ry, 0], [w, h, d]);
    if (solid) this.colliders.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2 });
  }
  cyl(m: M, x: number, y: number, z: number, r: number, h: number, rx = 0, rz = 0) {
    this.b.add(G.cyl, m, [x, y, z], [rx, 0, rz], [r, h, r]);
  }
  floor(m: M, x0: number, z0: number, x1: number, z1: number, y = 0) {
    this.box(m, (x0 + x1) / 2, y - 0.05, (z0 + z1) / 2, x1 - x0, 0.1, z1 - z0);
  }
  /** A wall from (x0,z0) to (x1,z1), axis-aligned, with optional door gap [from,to] along it. */
  wall(m: M, x0: number, z0: number, x1: number, z1: number, h: number, gap?: [number, number], t = 0.14) {
    const along = x0 === x1 ? "z" : "x";
    const a0 = along === "x" ? Math.min(x0, x1) : Math.min(z0, z1), a1 = along === "x" ? Math.max(x0, x1) : Math.max(z0, z1);
    const segs: [number, number][] = gap ? [[a0, gap[0]], [gap[1], a1]] : [[a0, a1]];
    for (const [s, e] of segs) {
      if (e - s < 0.05) continue;
      const mid = (s + e) / 2, len = e - s;
      if (along === "x") this.box(m, mid, h / 2, z0, len, h, t, true);
      else this.box(m, x0, h / 2, mid, t, h, len, true);
    }
    if (gap && h > 2.3) {
      // Lintel over the doorway.
      const mid = (gap[0] + gap[1]) / 2, len = gap[1] - gap[0];
      if (along === "x") this.box(m, mid, (h + 2.1) / 2, z0, len, h - 2.1, t);
      else this.box(m, x0, (h + 2.1) / 2, mid, t, h - 2.1, len);
    }
  }
  door(x: number, z: number, along: "x" | "z", open = 1.1) {
    // Frame and a leaf swung open.
    const fm = MAT.doorWood();
    if (along === "x") {
      this.box(fm, x - 0.47, 1.05, z, 0.06, 2.1, 0.16);
      this.box(fm, x + 0.47, 1.05, z, 0.06, 2.1, 0.16);
      this.box(fm, x, 2.1, z, 1.0, 0.08, 0.16);
      this.b.add(G.box, MAT.lightWood(), [x - 0.45 + Math.cos(open) * 0.43, 1.02, z + Math.sin(open) * 0.43], [0, -open, 0], [0.86, 2.0, 0.045]);
    } else {
      this.box(fm, x, 1.05, z - 0.47, 0.16, 2.1, 0.06);
      this.box(fm, x, 1.05, z + 0.47, 0.16, 2.1, 0.06);
      this.box(fm, x, 2.1, z, 0.16, 0.08, 1.0);
      this.b.add(G.box, MAT.lightWood(), [x + Math.sin(open) * 0.43, 1.02, z - 0.45 + Math.cos(open) * 0.43], [0, Math.PI / 2 - open, 0], [0.86, 2.0, 0.045]);
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
  const m = kind === "leather" || kind === "l_shape" ? MAT.color("#3a2418", 0.45) : kind === "fabric" ? MAT.color("#6e7480", 0.95) : MAT.fabric("wax", "#B03A62");
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
  r.b.add(G.cyl8, MAT.black(), [x, 0.6, z], [0, 0, 0], [0.04, 1.2, 0.04]);
  r.b.add(G.cyl, MAT.color("#2E86AB", 0.5), [x, 1.3, z], [Math.PI / 2, 0, 0], [0.32, 0.08, 0.32]);
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
function plant(r: Room, x: number, z: number, big = false) {
  r.cyl(MAT.color("#5a3a22", 0.9), x, 0.25, z, big ? 0.3 : 0.2, 0.5);
  r.b.add(G.ico, MAT.color("#3f6f2a", 0.9), [x, big ? 1.3 : 0.85, z], [0, 0, 0], [big ? 0.6 : 0.4, big ? 1.0 : 0.6, big ? 0.6 : 0.4]);
}
function rug(r: Room, x: number, z: number, w: number, d: number, color = "#C8452C") {
  r.box(MAT.fabric("kente", color), x, 0.012, z, w, 0.02, d);
}
function frame(r: Room, x: number, y: number, z: number, w = 0.7, h = 0.5) {
  r.box(MAT.color("#b08d57", 0.3, 0.7), x, y, z, w, h, 0.03);
  r.box(MAT.fabric("kente", "#1F7A4D"), x, y, z + 0.02, w - 0.1, h - 0.1, 0.01);
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

export function buildHomeInterior(spec: HomeSpec, items: string[]): Interior {
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
      if (hall) {
        // Chamber (left) and hall (right) split by a partition with a doorway.
        r.wall(wallM, -0.4, z0, -0.4, z1, 1.1, [z0 + 2.2, z0 + 3.1]);
        bed(r, -2.3, z0 + 1.25, "double", "wood", "#1F5AA6");
        bedPos = new THREE.Vector3(-1.2, 0, z0 + 2.2);
        wardrobe(r, -3.05, z0 + 3.1, 0.9, 1);
        sofaSet(r, 1.6, z0 + 2.55, "wooden", 1);
        coffeeTable(r, 1.6, z0 + 1.55, false);
        displayCabinet(r, 2.9, z0 + 0.35);
        frame(r, 1.2, 2.0, z0 + 0.09);
        if (!has("tv32") && !has("smart_tv65")) { r.box(MAT.darkWood(), 0.6, 0.3, z0 + 0.35, 1.1, 0.6, 0.45, true); r.box(MAT.black(), 0.6, 0.85, z0 + 0.3, 0.6, 0.45, 0.25); }
      } else {
        if (has("king_bed") || has("bed_frame")) bed(r, -0.8, z0 + 1.25, "double", "wood", "#C8452C");
        else mattressFloor(r, -1.1, z0 + 1.15);
        bedPos = new THREE.Vector3(0.2, 0, z0 + 1.5);
        r.box(MAT.color("#4a6b8a", 0.6), 1.35, 0.35, z0 + 0.4, 0.9, 0.7, 0.5, true); // chest of drawers
        r.box(MAT.color("#ddd"), -1.85, 1.9, z0 + 2.2, 0.01, 0.01, 2.2); // rope wardrobe
        for (let i = 0; i < 4; i++) r.box(MAT.color(["#C8452C", "#1F5AA6", "#F2B705", "#fff"][i]), -1.83, 1.55, z0 + 1.4 + i * 0.45, 0.02, 0.6, 0.38);
        fan(r, 1.4, z0 + 2.9);
      }
      bucketAndKettle(r, roomW / 2 - 0.5, z1 - 0.5);
      // Courtyard: coal pot by your door (or gas cylinder on a chamber & hall veranda).
      if (hall) gasCylinderCooker(r, 1.6, z1 + 0.6); else coalPot(r, 1.3, z1 + 0.7);
      plasticChairs(r, -2.2, z1 + 1.2, 2);
      r.spot(hall ? "kitchen" : "coalpot", hall ? 2.1 : 1.3, z1 + 1.4, hall ? "Cook on the gas" : "Coal pot");
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
      // Standpipe tap with gallons, clothes line, a bench for evening chats.
      r.cyl(MAT.steel(), -6.2, 0.5, 4.8, 0.04, 1.0);
      for (let i = 0; i < 3; i++) r.cyl(MAT.color("#F2B705", 0.5), -5.6 + i * 0.4, 0.25, 5.1, 0.15, 0.5);
      clothesLine(r, -5.8, -1.2, 2.2);
      r.box(MAT.darkWood(), -3.5, 0.4, 4.4, 2.2, 0.08, 0.4, true);
      r.spot("neighbours", -3.5, 3.9, "Neighbours");
      r.box(MAT.plaster("#cdbf9f"), 0, 1.25, cz1 + 0.1, W, 2.5, 0.2); // front compound wall
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
        r.b.add(G.box, MAT.mud(), [cx + Math.cos(a) * R, h / 2, cz + Math.sin(a) * R], [0, -a, 0], [0.25, h, 0.8]);
      }
      r.colliders.push({ minX: -2.6, maxX: 2.6, minZ: -5.7, maxZ: -5.4 });
      r.b.add(G.cone, MAT.thatch(), [cx, 3.3, cz - 0.6], [0, 0, 0], [2.9, 1.6, 2.2]);
      r.box(MAT.color("#d8b878"), cx - 0.7, 0.04, cz - 0.6, 1.2, 0.06, 1.9); // sleeping mat
      bedPos = new THREE.Vector3(cx + 0.4, 0, cz - 0.3);
      for (let i = 0; i < 3; i++) r.cyl(MAT.color("#8a4b2a", 0.95), cx + 1.3, 0.25 + i * 0.4, cz - 1.2, 0.3 - i * 0.05, 0.38); // stacked clay pots
      r.cyl(MAT.color("#c9a227", 0.8), cx - 1.6, 0.15, cz - 0.3, 0.25, 0.25); // calabash
      // Courtyard: granary, bathing enclosure, coal pot, water pots.
      r.cyl(MAT.mud(), 4.5, 1.1, -2, 1.0, 2.2);
      r.b.add(G.cone, MAT.thatch(), [4.5, 2.7, -2], [0, 0, 0], [1.3, 1.1, 1.3]);
      r.colliders.push({ minX: 3.5, maxX: 5.5, minZ: -3, maxZ: -1 });
      r.wall(MAT.mud(), -5.5, 2, -3.5, 2, 1.3);
      r.wall(MAT.mud(), -5.5, 2, -5.5, 4, 1.3);
      r.cyl(MAT.color("#2e6fae", 0.6), -4.8, 0.2, 3, 0.22, 0.4);
      r.spot("bath", -3.8, 3.2, "Bucket bath");
      coalPot(r, 1.8, 1.2);
      r.spot("coalpot", 1.8, 2, "Cook");
      for (let i = 0; i < 3; i++) r.cyl(MAT.color("#7a3f22", 0.95), -1.5 + i * 0.6, 0.35, 0.8, 0.3, 0.7);
      r.box(MAT.darkWood(), 3.5, 0.3, 3, 2, 0.08, 0.5, true);
      r.spot("neighbours", 3.5, 3.6, "Sit with the family");
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
      // Kitchenette along the left wall.
      kitchenette(r, -W / 2 + 0.4, flat ? 1.2 : 0.8, "z");
      r.spot("kitchen", -W / 2 + 1.3, flat ? 1.2 : 0.8, "Kitchenette");
      if (flat) {
        // Bedroom back-left behind a partition; living room in front.
        r.wall(wallM, -W / 2, -0.4, 0.4, -0.4, 1.1, [-0.9, 0.0]);
        r.wall(wallM, 0.4, -D / 2, 0.4, -0.4, 3);
        bed(r, -2.4, -D / 2 + 1.3, "double", has("king_bed") ? "upholstered" : "wood", "#2E86AB");
        wardrobe(r, -0.4, -D / 2 + 0.6, 1.2);
        bedPos = new THREE.Vector3(-1.2, 0, -1.2);
        sofaSet(r, 1.6, 2.4, has("leather_sofa") ? "leather" : "fabric", 1);
        coffeeTable(r, 1.6, 1.3);
        rug(r, 1.6, 1.4, 2.6, 1.8);
      } else {
        bed(r, -1.6, -D / 2 + 1.3, "double", "wood", "#C8452C");
        bedPos = new THREE.Vector3(-0.3, 0, -D / 2 + 1.8);
        plasticChairs(r, 0.4, 1.6, 2);
        fan(r, 1.6, 0.6);
      }
      r.window(-W / 4, -D / 2, 1.2);
      ownedExtras(r, items, { tv: [flat ? 1.6 : 0.2, flat ? -0.2 : -D / 2 + 0.35], fridge: [-W / 2 + 0.45, flat ? 2.8 : 2.2], gen: [W / 2 - 0.5, D / 2 - 0.5] });
      if (has("tv32") || has("smart_tv65")) r.spot("tv", flat ? 1.6 : 0.2, flat ? 1.2 : -1, "TV");
      if (flat) { r.box(MAT.bars(), 0, 1.0, D / 2 + 0.9, W, 1.0, 0.04); r.floor(MAT.floorTiles(), -W / 2, D / 2, W / 2, D / 2 + 1); r.spot("terrace", 2.5, D / 2 + 0.5, "Balcony"); }
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
      r.floor(MAT.bathTiles(), -1.0, -D / 2, 1.6, back, 0.01);
      toilet(r, 1.15, -D / 2 + 0.6);
      sink(r, -0.3, -D / 2 + 0.3);
      if (big) bathtub(r, 0.3, -D / 2 + 2.3); else shower(r, -0.5, -D / 2 + 1.6, true);
      r.spot("bath", 0.3, back + 0.6, "Bathroom");
      bed(r, W / 2 - 2.0, -D / 2 + 1.3, "double", "wood", "#2E7D4F");
      r.window(-W / 2 + 2.0, -D / 2, 1.2);
      r.window(W / 2 - 2.0, -D / 2, 1.2);
      // Fitted kitchen front-left, living & dining front-right.
      fittedKitchen(r, -W / 2 + 0.15, back + 0.2, 3.4, 2.2, false);
      r.spot("kitchen", -W / 2 + 2.0, back + 2.0, "Kitchen");
      diningSet(r, -W / 2 + 2.4, D / 2 - 1.3, 6);
      sofaSet(r, W / 2 - 3.0, D / 2 - 1.0, has("leather_sofa") || big ? "l_shape" : "fabric", 1);
      coffeeTable(r, W / 2 - 3.0, D / 2 - 2.2);
      rug(r, W / 2 - 3.0, D / 2 - 2.1, 3.0, 2.2, "#1F7A4D");
      tvWall(r, W / 2 - 3.0, back + 0.35, has("smart_tv65") || big);
      r.spot("tv", W / 2 - 3.0, D / 2 - 2.6, "TV");
      plant(r, W / 2 - 0.5, D / 2 - 0.5, true);
      frame(r, 0.4, 2.0, back + 0.1, 1.0, 0.7);
      if (has("split_ac") || big) r.box(MAT.white(), W / 2 - 1.2, 2.5, back + 0.12, 1.0, 0.3, 0.22);
      if (big) {
        // Garden in front of the house, inside the compound wall.
        r.floor(MAT.grass(), -W / 2, D / 2, W / 2, D / 2 + 4);
        r.box(MAT.plaster("#e9dcc6"), 0, 1.2, D / 2 + 4, W, 2.4, 0.25, true);
        for (const x of [-W / 2 + 1.5, W / 2 - 1.5]) plant(r, x, D / 2 + 2.5, true);
        r.spot("terrace", 3, D / 2 + 1.5, "Garden");
        door = new THREE.Vector3(0, 0, D / 2 + 3.2);
      } else {
        r.floor(MAT.floorTiles(), -W / 2, D / 2, W / 2, D / 2 + 1.2);
        r.box(MAT.bars(), 0, 1.0, D / 2 + 1.15, W, 1.0, 0.04);
        r.spot("terrace", 3, D / 2 + 0.7, "Balcony");
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
      sofaSet(r, lx, 2.6, "l_shape", 1);
      coffeeTable(r, lx, 1.2);
      rug(r, lx - 0.4, 1.3, 4, 3, "#1F3A5F");
      tvWall(r, lx, -1.8, true);
      r.spot("tv", lx, 0.6, "TV");
      // Chef's kitchen.
      fittedKitchen(r, -W / 2 + 0.15, -D / 2 + (mansion ? 5 : 3.6), mansion ? 5 : 4.2, 2.2, true);
      r.spot("kitchen", -W / 2 + 2.4, -D / 2 + (mansion ? 8.3 : 6.9), "Kitchen");
      if (!mansion) diningSet(r, -W / 2 + 2.6, D / 2 - 1.4, 8, MAT.darkMarble());
      // Master suite back-left with an ensuite and a freestanding tub.
      const sx0 = -W / 2, sx1 = -W / 2 + (mansion ? 7 : 6.5), sz1 = -D / 2 + 3.4;
      r.wall(wallM, sx0, sz1, sx1, sz1, 1.1, [sx1 - 1.4, sx1 - 0.5]);
      r.wall(wallM, sx1, -D / 2, sx1, sz1, pent ? 3.4 : H);
      bed(r, sx0 + 2.2, -D / 2 + 1.35, "king", "upholstered", "#2b2f36");
      bedPos = new THREE.Vector3(sx0 + 3.5, 0, sz1 - 0.8);
      r.wall(wallM, sx1 - 2.6, -D / 2, sx1 - 2.6, sz1, 2.6, [sz1 - 1.2, sz1 - 0.3]);
      r.floor(MAT.marble(), sx1 - 2.6, -D / 2, sx1, sz1, 0.01);
      bathtub(r, sx1 - 1.3, -D / 2 + 0.8);
      sink(r, sx1 - 0.5, -D / 2 + 2.2);
      r.spot("bath", sx1 - 1.3, sz1 - 0.6, "Ensuite");
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
        for (let i = 0; i < 3; i++) r.box(MAT.white(), -7 + i * 1.2, 0.2, D / 2 + 3.5, 0.7, 0.3, 1.8, true);
        r.box(MAT.plaster("#e9dcc6"), 0, 1.4, D / 2 + outside, W, 2.8, 0.3, true);
        r.box(MAT.color("#2b2b2b", 0.4, 0.7), 0, 1.3, D / 2 + outside - 0.1, 3, 2.4, 0.08); // gate
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
  const group = r.b.build();
  group.add(r.extra);
  group.traverse((o) => { if ((o as THREE.Mesh).isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return {
    group, bounds, colliders: r.colliders, spots: r.spots, door, bed: bedPos,
    size: [bounds.maxX - bounds.minX, bounds.maxZ - bounds.minZ],
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
