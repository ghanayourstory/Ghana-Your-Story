// Your own building site, drawn at its real construction stage: pegs and a
// "property of" sign, foundation, blockwork with scaffolding, roof, finished.
import * as THREE from "three";
import { Batcher, G, facadeBox } from "./batch.ts";
import * as T from "./textures.ts";

const FOOT: Record<string, [number, number, number]> = {
  chamber_hall: [8, 7, 3.2],
  bungalow: [12, 10, 3.4],
  family_house: [14, 12, 6.6],
  villa: [18, 13, 6.8],
  shop_block: [16, 7, 3.6],
  apartments: [16, 12, 9.9],
};

export interface SiteInfo {
  owned: boolean;
  owner: string;
  design?: string;
  quality?: string;
  stagesDone: number; // completed stages
  totalStages: number;
  building: boolean; // workers on site
}

const std = (p: THREE.MeshStandardMaterialParameters) => new THREE.MeshStandardMaterial({ roughness: 0.9, ...p });

export function buildSite(info: SiteInfo, side: number): THREE.Group {
  const b = new Batcher();
  const block = std({ map: T.concrete("#9d9a94", 77) });
  const conc = std({ map: T.concrete("#bdb6aa", 78) });
  const wood = std({ color: "#9a6b43" });
  const sandM = std({ map: T.sand(), color: "#c9a46a" });
  const signM = (t: string, sub: string) => std({ map: T.signboard(t, "#ffffff", "#C8452C", { sub }) });
  const box = (m: THREE.Material, x: number, y: number, z: number, w: number, h: number, d: number) => b.add(G.box, m, [x, y, z], [0, 0, 0], [w, h, d]);

  if (!info.owned) return new THREE.Group();
  const front = -side * 9; // towards the road (local)
  // The classic Accra land sign.
  box(wood, -4, 1.2, front + side * 0.5, 0.12, 2.4, 0.12);
  box(wood, -1.2, 1.2, front + side * 0.5, 0.12, 2.4, 0.12);
  box(signM("PROPERTY OF " + info.owner.toUpperCase(), "THIS LAND IS NOT FOR SALE"), -2.6, 2.2, front + side * 0.45, 3.4, 1.1, 0.06);
  for (const [x, z] of [[-8, -6], [8, -6], [-8, 6], [8, 6]]) box(std({ color: "#C8452C" }), x, 0.4, z, 0.15, 0.8, 0.15);

  const [w, d, h] = FOOT[info.design ?? "bungalow"] ?? FOOT.bungalow;
  const stage = info.design ? info.stagesDone : -1;
  if (stage >= 0 && info.building) {
    // Materials on site: block stacks, sand pile, cement bags.
    for (let i = 0; i < 3; i++) for (let k = 0; k < 4; k++) box(block, 6 + i * 0.5, 0.2 + k * 0.2, front + side * 3, 0.45, 0.2, 0.9);
    b.add(G.cone, sandM, [-6, 0.6, front + side * 3.5], [0, 0, 0], [1.6, 1.2, 1.6]);
    for (let i = 0; i < 6; i++) box(std({ color: "#d8d2c4" }), 3 + (i % 3) * 0.55, 0.15 + Math.floor(i / 3) * 0.25, front + side * 4.5, 0.5, 0.22, 0.8);
  }
  if (stage === 0 && info.building) {
    // Foundation trenches being dug.
    box(std({ color: "#7a4a2c" }), 0, 0.02, 0, w, 0.04, d);
    box(conc, 0, 0.15, -d / 2, w, 0.3, 0.4);
    box(conc, -w / 2, 0.15, 0, 0.4, 0.3, d);
  }
  if (stage >= 1) box(conc, 0, 0.25, 0, w + 0.6, 0.5, d + 0.6);
  if (stage === 2 || (stage === 1 && info.building)) {
    // Blockwork rising, with window openings and timber scaffolding.
    const wallH = stage === 2 ? h : h * 0.45;
    const wallM = std({ map: T.concrete("#8f8c86", 79) });
    for (const [x, z, ww, dd] of [[0, -d / 2, w, 0.25], [0, d / 2, w, 0.25], [-w / 2, 0, 0.25, d], [w / 2, 0, 0.25, d]] as const) {
      box(wallM, x, 0.5 + wallH / 2, z, ww, wallH, dd);
    }
    for (let x = -w / 2; x <= w / 2; x += 2.4) {
      box(wood, x, 0.5 + wallH / 2 + 0.5, -d / 2 - 1, 0.08, wallH + 1, 0.08);
      box(wood, x, 0.5 + wallH / 2 + 0.5, d / 2 + 1, 0.08, wallH + 1, 0.08);
    }
    box(wood, 0, 0.5 + wallH * 0.6, -d / 2 - 1, w, 0.06, 0.4);
    box(wood, 0, 0.5 + wallH * 0.6, d / 2 + 1, w, 0.06, 0.4);
  }
  if (stage === 3) {
    const wallM = std({ map: T.concrete("#8f8c86", 79) });
    b.add(facadeBox(w, h, d), wallM, [0, 0.5 + h / 2, 0]);
    b.add(new THREE.ConeGeometry(1, 1, 4), std({ map: T.corrugated(false), metalness: 0.5, roughness: 0.4 }), [0, 0.5 + h + 1.2, 0], [0, Math.PI / 4, 0], [w * 0.8, 2.4, d * 0.8]);
  }
  if (stage >= 4) {
    const q = info.quality ?? "basic";
    const color = q === "premium" ? "#F5F1E8" : q === "standard" ? "#F2E2C4" : "#E8D5B5";
    const f = T.facade(q === "basic" ? "louvre" : "modern");
    b.add(facadeBox(w, h, d), std({ color, map: f.map }), [0, 0.5 + h / 2, 0]);
    b.add(new THREE.ConeGeometry(1, 1, 4), std({ color: q === "premium" ? "#2F2F33" : "#8A3B2E", roughness: 0.6 }), [0, 0.5 + h + 1.2, 0], [0, Math.PI / 4, 0], [w * 0.8, 2.4, d * 0.8]);
    box(std({ color: "#5b3a29" }), 0, 1.6, -side * (d / 2 + 0.03), 1.2, 2.3, 0.06);
    // Compound wall and gate.
    const wallM = std({ color: "#e9e3d6" });
    box(wallM, -6.5, 1.2, front + side * 1.2, 7, 2.4, 0.25);
    box(wallM, 6.5, 1.2, front + side * 1.2, 7, 2.4, 0.25);
    box(std({ color: "#2b2d30", metalness: 0.5 }), 0, 1.1, front + side * 1.2, 6, 2.2, 0.08);
    if (info.design === "villa" && stage >= 5) {
      box(std({ color: "#2aa7c9", roughness: 0.05, metalness: 0.2 }), w / 2 + 4, 0.06, 0, 5, 0.1, 8);
      box(conc, w / 2 + 4, 0.03, 0, 6, 0.06, 9);
    }
  }
  const g = b.build();
  return g;
}

/** Room layouts by comfort level for the cut-away home interior. */
export function buildInterior(comfort: number): { group: THREE.Group; bed: THREE.Vector3; door: THREE.Vector3; size: [number, number] } {
  const W = comfort <= 1 ? 5 : comfort <= 3 ? 8 : 11;
  const D = comfort <= 1 ? 5 : comfort <= 3 ? 7 : 9;
  const b = new Batcher();
  const floor = comfort <= 1 ? std({ map: T.concrete("#a29a8c", 90) }) : std({ color: comfort >= 4 ? "#c9b08a" : "#8a5a3b", roughness: 0.6 });
  const wall = std({ map: T.plaster(), color: comfort >= 4 ? "#f6f1e7" : "#e9dfc9" });
  const box = (m: THREE.Material, x: number, y: number, z: number, w: number, h: number, d: number) => b.add(G.box, m, [x, y, z], [0, 0, 0], [w, h, d]);
  box(floor, 0, -0.05, 0, W, 0.1, D);
  // Cut-away walls: full height at the back, low at the front so the camera sees in.
  box(wall, 0, 1.5, -D / 2, W, 3, 0.15);
  box(wall, -W / 2, 1.5, 0, 0.15, 3, D);
  box(wall, W / 2, 0.5, 0, 0.15, 1, D);
  box(wall, -W / 4 - 0.5, 0.5, D / 2, W / 2 - 1, 1, 0.15);
  box(wall, W / 4 + 0.5, 0.5, D / 2, W / 2 - 1, 1, 0.15);
  const fabric = std({ map: T.fabric("wax", "#1F7A4D") });
  const kente = std({ map: T.fabric("kente", "#C8452C") });
  const dark = std({ color: "#222", roughness: 0.5 });
  const woodM = std({ color: "#6b4630", roughness: 0.7 });
  const white = std({ color: "#f3f1ea", roughness: 0.5 });
  // Bed.
  const bed = new THREE.Vector3(-W / 2 + 1.4, 0, -D / 2 + 1.4);
  if (comfort <= 1) {
    box(fabric, bed.x, 0.12, bed.z, 1.4, 0.24, 2);
  } else {
    box(woodM, bed.x, 0.25, bed.z, 1.8, 0.5, 2.2);
    box(white, bed.x, 0.6, bed.z + 0.1, 1.7, 0.2, 2.0);
    box(kente, bed.x, 0.72, bed.z + 0.4, 1.72, 0.06, 1.2);
    box(white, bed.x, 0.78, bed.z - 0.8, 1.2, 0.15, 0.4);
    box(woodM, bed.x, 0.8, bed.z - 1.1, 1.9, 1.2, 0.12);
  }
  // Standing fan or AC.
  if (comfort >= 4) box(white, 0, 2.5, -D / 2 + 0.2, 1.2, 0.35, 0.25);
  else {
    b.add(G.cyl8, dark, [W / 2 - 0.8, 0.6, -D / 2 + 0.8], [0, 0, 0], [0.04, 1.2, 0.04]);
    b.add(G.cyl, std({ color: "#2E86AB" }), [W / 2 - 0.8, 1.3, -D / 2 + 0.8], [Math.PI / 2, 0, 0], [0.32, 0.08, 0.32]);
  }
  // Bucket and plastic chair — every compound house room.
  b.add(G.cyl, std({ color: "#2e6fae" }), [-W / 2 + 0.5, 0.2, D / 2 - 0.8], [0, 0, 0], [0.22, 0.4, 0.22]);
  box(std({ color: "#c8352c" }), 1, 0.42, -0.5, 0.45, 0.05, 0.45);
  if (comfort >= 2) {
    // TV on a stand.
    box(woodM, 1.2, 0.3, -D / 2 + 0.4, 1.6, 0.6, 0.5);
    box(dark, 1.2, 1.1, -D / 2 + 0.3, 1.4, 0.8, 0.06);
    box(woodM, W / 2 - 0.6, 1.0, D / 2 - 1.6, 0.9, 2.0, 0.6); // wardrobe
  }
  if (comfort >= 3) {
    box(std({ color: "#8a8f96" }), 1.2, 0.35, 0.8, 2.2, 0.7, 0.9); // sofa
    box(std({ color: "#8a8f96" }), 1.2, 0.75, 1.15, 2.2, 0.5, 0.2);
    box(kente, 1.2, 0.01, -0.2, 2.6, 0.02, 1.8); // rug
    box(white, W / 2 - 0.5, 0.9, -D / 2 + 1.8, 0.7, 1.8, 0.7); // fridge
    box(std({ color: "#3b3f44" }), -W / 2 + 0.4, 0.45, D / 2 - 2.2, 0.7, 0.9, 1.6); // kitchen counter
  }
  if (comfort >= 4) {
    box(woodM, -1, 0.75, 1.8, 1.6, 0.06, 0.9);
    for (const [x, z] of [[-1.6, 1.8], [-0.4, 1.8]]) box(woodM, x, 0.45, z + 0.7, 0.45, 0.06, 0.45);
    b.add(G.cyl, std({ color: "#5a3a22" }), [W / 2 - 0.6, 0.3, 0.2], [0, 0, 0], [0.3, 0.6, 0.3]);
    b.add(G.ico, std({ color: "#3f6f2a" }), [W / 2 - 0.6, 1.0, 0.2], [0, 0, 0], [0.55, 0.6, 0.55]);
    box(kente, -W / 2 + 0.09, 1.8, 0.6, 0.02, 1.0, 1.6); // wall art
  }
  const group = b.build();
  const lamp = new THREE.PointLight("#ffe2b0", 6, W * 2.5, 1.5);
  lamp.position.set(0, 2.8, 0);
  group.add(lamp);
  return { group, bed: new THREE.Vector3(bed.x + 1.3, 0, bed.z + 0.4), door: new THREE.Vector3(0, 0, D / 2 + 0.6), size: [W, D] };
}
