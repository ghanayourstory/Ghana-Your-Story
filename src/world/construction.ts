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
export function buildInterior(comfort: number, items: string[] = []): { group: THREE.Group; bed: THREE.Vector3; door: THREE.Vector3; size: [number, number] } {
  const has = (id: string) => items.includes(id);
  const W = comfort <= 1 ? 5.5 : comfort <= 3 ? 8 : comfort <= 5 ? 11 : 13;
  const D = comfort <= 1 ? 5.5 : comfort <= 3 ? 7 : comfort <= 5 ? 9 : 10;
  const b = new Batcher();
  const floor = comfort <= 1 ? std({ map: T.concrete("#a29a8c", 90) }) : std({ color: comfort >= 4 ? "#d8c7a8" : "#8a5a3b", roughness: comfort >= 4 ? 0.35 : 0.6 });
  const wall = std({ map: T.plaster(), color: comfort >= 4 ? "#f6f1e7" : "#e9dfc9" });
  const box = (m: THREE.Material, x: number, y: number, z: number, w: number, h: number, d: number) => b.add(G.box, m, [x, y, z], [0, 0, 0], [w, h, d]);
  const cyl = (m: THREE.Material, x: number, y: number, z: number, r: number, h: number) => b.add(G.cyl, m, [x, y, z], [0, 0, 0], [r, h, r]);
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
  const steel = std({ color: "#c9ccd0", roughness: 0.3, metalness: 0.6 });
  const leather = std({ color: "#4a2d1f", roughness: 0.45 });
  const glassM = std({ color: "#bcd8e0", roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.55 });
  const redPlastic = std({ color: "#c8352c", roughness: 0.6 });
  const back = -D / 2 + 0.15;

  // Bed: what you bought, else what came with the room.
  const bed = new THREE.Vector3(-W / 2 + 1.4, 0, -D / 2 + 1.4);
  const king = has("king_bed");
  const frame = king || has("bed_frame") || comfort >= 2;
  const mattressH = has("spring_mattress") ? 0.32 : has("foam_mattress") ? 0.22 : 0.16;
  const bw = king ? 2.0 : 1.6;
  if (!frame) {
    box(fabric, bed.x, mattressH / 2, bed.z, 1.4, mattressH, 2);
  } else {
    box(king ? std({ color: "#7d6a5a", roughness: 0.8 }) : woodM, bed.x, 0.22, bed.z, bw + 0.1, 0.44, 2.2);
    box(white, bed.x, 0.44 + mattressH / 2, bed.z + 0.05, bw, mattressH, 2.05);
    box(kente, bed.x, 0.46 + mattressH, bed.z + 0.4, bw + 0.02, 0.05, 1.2);
    box(white, bed.x, 0.52 + mattressH, bed.z - 0.75, bw * 0.7, 0.14, 0.38);
    box(king ? std({ color: "#8e7b6b", roughness: 0.9 }) : woodM, bed.x, king ? 1.1 : 0.85, bed.z - 1.12, bw + 0.2, king ? 1.5 : 1.1, 0.12);
  }
  if (has("mosquito_net")) {
    const net = std({ color: "#ffffff", transparent: true, opacity: 0.22, roughness: 1, side: THREE.DoubleSide });
    box(net, bed.x, 1.4, bed.z, bw + 0.3, 2.2, 2.4);
  }
  // Cooling.
  if (has("split_ac") || (comfort >= 4 && !items.length)) {
    box(white, 0.5, 2.45, back + 0.12, 1.1, 0.32, 0.22);
    box(std({ color: "#d5d7d9" }), 0.5, 2.33, back + 0.24, 1.0, 0.03, 0.02);
  }
  if (has("ceiling_fan")) {
    cyl(dark, 0, 2.85, -0.4, 0.08, 0.3);
    for (let i = 0; i < 3; i++) b.add(G.box, woodM, [Math.cos((i * 2 * Math.PI) / 3) * 0.45, 2.7, -0.4 + Math.sin((i * 2 * Math.PI) / 3) * 0.45], [0, -(i * 2 * Math.PI) / 3, 0], [0.8, 0.02, 0.14]);
  }
  if (has("standing_fan") || (!has("split_ac") && !has("ceiling_fan") && comfort < 4)) {
    b.add(G.cyl8, dark, [W / 2 - 0.8, 0.6, -D / 2 + 0.8], [0, 0, 0], [0.04, 1.2, 0.04]);
    b.add(G.cyl, std({ color: "#2E86AB" }), [W / 2 - 0.8, 1.3, -D / 2 + 0.8], [Math.PI / 2, 0, 0], [0.32, 0.08, 0.32]);
  }
  // Every compound room: a bucket.
  cyl(std({ color: "#2e6fae" }), -W / 2 + 0.5, 0.2, D / 2 - 0.8, 0.22, 0.4);
  // Seating.
  const sx = 1.2, sz = 0.9;
  if (has("leather_sofa")) {
    box(leather, sx, 0.25, sz, 2.8, 0.5, 0.95);
    box(leather, sx, 0.65, sz + 0.4, 2.8, 0.55, 0.2);
    box(leather, sx - 1.5, 0.25, sz - 0.9, 0.95, 0.5, 2.2);
    box(leather, sx - 1.9, 0.65, sz - 0.9, 0.2, 0.55, 2.2);
  } else if (has("wooden_sofa") || comfort >= 3) {
    box(woodM, sx, 0.22, sz, 2.3, 0.1, 0.85);
    box(fabric, sx, 0.34, sz, 2.2, 0.16, 0.8);
    box(woodM, sx, 0.65, sz + 0.38, 2.3, 0.6, 0.08);
    box(fabric, sx, 0.62, sz + 0.3, 2.1, 0.45, 0.1);
    for (const dx of [-1.15, 1.15]) box(woodM, sx + dx, 0.4, sz, 0.08, 0.5, 0.85);
  }
  if (has("plastic_chairs") || (!has("leather_sofa") && !has("wooden_sofa") && comfort < 3)) {
    const cols = [redPlastic, white, redPlastic, white];
    const n = has("plastic_chairs") ? 4 : 1;
    for (let i = 0; i < n; i++) {
      const x = 1 + i * 0.6, z = -0.4;
      box(cols[i], x, 0.42, z, 0.45, 0.05, 0.45);
      box(cols[i], x, 0.7, z + 0.2, 0.45, 0.5, 0.05);
      for (const [dx, dz] of [[-0.2, -0.2], [0.2, -0.2], [-0.2, 0.2], [0.2, 0.2]]) box(cols[i], x + dx, 0.2, z + dz, 0.04, 0.42, 0.04);
    }
  }
  // Tables.
  if (has("centre_table")) {
    box(glassM, sx, 0.42, sz - 1.1, 1.1, 0.03, 0.6);
    box(steel, sx, 0.21, sz - 1.1, 0.9, 0.42, 0.04);
  }
  if (has("dining_set") || (comfort >= 4 && !items.length)) {
    const tx = -1, tz = D / 2 - 1.8;
    box(woodM, tx, 0.75, tz, 1.6, 0.06, 0.9);
    for (const [dx, dz] of [[-0.7, -0.4], [0.7, -0.4], [-0.7, 0.4], [0.7, 0.4]]) box(woodM, tx + dx, 0.37, tz + dz, 0.06, 0.74, 0.06);
    for (const [dx, dz] of [[-0.45, -0.75], [0.45, -0.75], [-0.45, 0.75], [0.45, 0.75]]) {
      box(woodM, tx + dx, 0.45, tz + dz, 0.42, 0.05, 0.42);
      box(woodM, tx + dx, 0.75, tz + dz + Math.sign(dz) * 0.2, 0.42, 0.6, 0.04);
    }
  }
  // Screen & sound.
  const tvBig = has("smart_tv65");
  if (tvBig || has("tv32") || (comfort >= 2 && !items.length)) {
    box(woodM, 1.2, 0.3, back + 0.3, tvBig ? 2.2 : 1.6, 0.6, 0.5);
    box(dark, 1.2, tvBig ? 1.35 : 1.1, back + 0.12, tvBig ? 1.9 : 1.0, tvBig ? 1.1 : 0.6, 0.05);
  }
  if (has("sound_system")) for (const dx of [-0.2, 2.6]) box(dark, dx, 0.55, back + 0.3, 0.3, 1.1, 0.3);
  // Storage.
  if (has("wardrobe") || (comfort >= 2 && !items.length)) {
    box(woodM, W / 2 - 0.6, 1.0, D / 2 - 1.6, 0.9, 2.0, 1.6);
    box(dark, W / 2 - 1.06, 1.0, D / 2 - 1.6, 0.01, 1.8, 0.02);
  }
  // Kitchen corner.
  const kx = -W / 2 + 0.45, kz = D / 2 - 2.3;
  if (has("standing_cooker") || has("gas_cooker") || has("fridge") || has("deep_freezer") || (comfort >= 3 && !items.length)) {
    box(std({ color: "#3b3f44" }), kx, 0.45, kz, 0.75, 0.9, 1.7);
  }
  if (has("standing_cooker")) { box(steel, kx, 0.45, kz - 1.3, 0.75, 0.9, 0.7); for (const dz of [-0.15, 0.15]) cyl(dark, kx, 0.92, kz - 1.3 + dz, 0.12, 0.02); }
  else if (has("gas_cooker")) { box(steel, kx, 0.95, kz + 0.2, 0.5, 0.1, 0.7); cyl(std({ color: "#1F5AA6" }), kx + 0.1, 0.3, kz - 1.1, 0.18, 0.6); }
  if (has("blender")) cyl(glassM, kx, 1.05, kz - 0.5, 0.08, 0.25);
  if (has("asanka")) cyl(std({ color: "#7a4a2c", roughness: 0.9 }), kx, 0.95, kz + 0.6, 0.18, 0.12);
  if (has("fridge") || (comfort >= 3 && !items.length)) box(white, W / 2 - 0.5, 0.9, -D / 2 + 1.8, 0.7, 1.8, 0.7);
  if (has("deep_freezer")) box(white, W / 2 - 0.55, 0.45, -D / 2 + 2.8, 0.7, 0.9, 1.1);
  if (has("washing_machine")) box(white, -W / 2 + 0.45, 0.45, -0.3, 0.6, 0.9, 0.6);
  // Decor.
  if (has("rug") || (comfort >= 3 && !items.length)) box(kente, sx, 0.01, sz - 1.1, 2.6, 0.02, 1.8);
  if (has("curtains")) for (const dx of [-W / 4, W / 4]) box(std({ color: "#f4efe6", transparent: true, opacity: 0.85 }), dx, 1.7, back + 0.05, 1.2, 1.8, 0.03);
  if (has("wall_art") || (comfort >= 4 && !items.length)) box(kente, -W / 2 + 0.09, 1.8, 0.6, 0.02, 1.0, 1.6);
  if (has("kente_cloth")) box(kente, -W / 2 + 0.1, 1.6, -1.6, 0.02, 1.4, 0.9);
  if (has("ashanti_stool")) { box(woodM, -0.6, 0.12, -1.2, 0.5, 0.06, 0.3); box(woodM, -0.6, 0.25, -1.2, 0.18, 0.22, 0.18); box(woodM, -0.6, 0.38, -1.2, 0.56, 0.05, 0.32); }
  if (has("bolga_basket")) cyl(std({ map: T.fabric("kente", "#E3A857") }), W / 2 - 0.5, 0.2, 0.9, 0.25, 0.4);
  if (has("generator")) { box(std({ color: "#c8352c" }), W / 2 - 0.5, 0.3, D / 2 - 0.6, 0.6, 0.55, 0.45); box(dark, W / 2 - 0.5, 0.62, D / 2 - 0.6, 0.5, 0.06, 0.06); }
  if (has("laptop")) { box(dark, sx + 0.1, 0.46, sz - 1.1, 0.34, 0.02, 0.24); }
  if (comfort >= 4 && !items.length) {
    cyl(std({ color: "#5a3a22" }), W / 2 - 0.6, 0.3, 0.2, 0.3, 0.6);
    b.add(G.ico, std({ color: "#3f6f2a" }), [W / 2 - 0.6, 1.0, 0.2], [0, 0, 0], [0.55, 0.6, 0.55]);
  }
  const group = b.build();
  const lamp = new THREE.PointLight("#ffe2b0", 6, W * 2.5, 1.5);
  lamp.position.set(0, 2.8, 0);
  group.add(lamp);
  return { group, bed: new THREE.Vector3(bed.x + 1.3, 0, bed.z + 0.4), door: new THREE.Vector3(0, 0, D / 2 + 0.6), size: [W, D] };
}
