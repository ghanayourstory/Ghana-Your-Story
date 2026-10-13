// Articulated people built from primitives, with a procedural walk cycle.
import * as THREE from "three";
import { fabric } from "./textures.ts";
import { mulberry32 } from "../../shared/rng.ts";
import { animateHuman, buildHuman, humansReady, type HumanRig } from "./humans.ts";
import type { OutfitId, ShoeId } from "../../shared/clothing.ts";

export type Person = Rig | HumanRig;
/** Which people use the realistic skinned bodies: everyone, only key people, or nobody (old phones). */
let humanMode: "all" | "key" | "off" = "all";
export const setHumanMode = (m: typeof humanMode) => { humanMode = m; };

export type HairStyle = "low" | "afro" | "braids" | "bun" | "wrap" | "cap" | "locs";
export type Pattern = "plain" | "kente" | "wax" | "stripe";

export interface PersonLook {
  skin: string;
  shirt: string;
  pants: string;
  hair: string;
  feminine: boolean;
  height: number;
  build: number;
  hairStyle?: HairStyle;
  pattern?: Pattern;
  headwear?: "cap" | "headwrap" | "none";
  carry?: "tray" | "bag" | null;
  /** What they're wearing (cut) and on their feet. */
  outfit?: OutfitId;
  shoes?: ShoeId;
  /** Face shape mix (13 axes, -1..1): nose, jaw, chin, cheeks, eyes, lips, head shape, age. */
  face?: number[];
}

const mats = new Map<string, THREE.Material>();
function mat(key: string, make: () => THREE.Material) {
  let m = mats.get(key);
  if (!m) {
    m = make();
    mats.set(key, m);
  }
  return m;
}
const skinMat = (c: string) => mat(`skin:${c}`, () => new THREE.MeshStandardMaterial({ color: c, roughness: 0.62, metalness: 0 }));
const clothMat = (c: string, p: Pattern = "plain") =>
  mat(`cloth:${c}:${p}`, () => new THREE.MeshStandardMaterial({ color: p === "plain" ? c : "#ffffff", map: p === "plain" ? fabric("plain", "#ffffff") : fabric(p, c), roughness: 0.92 }));
const plainMat = (c: string, rough = 0.8, metal = 0) => mat(`plain:${c}:${rough}:${metal}`, () => new THREE.MeshStandardMaterial({ color: c, roughness: rough, metalness: metal }));

const geo = {
  sphere: new THREE.SphereGeometry(1, 20, 14),
  cyl: new THREE.CylinderGeometry(1, 1, 1, 14),
  box: new THREE.BoxGeometry(1, 1, 1),
  cone: new THREE.ConeGeometry(1, 1, 18, 1, true),
  torus: new THREE.TorusGeometry(1, 0.32, 8, 20),
};

function part(g: THREE.BufferGeometry, m: THREE.Material, sx: number, sy: number, sz: number, x = 0, y = 0, z = 0) {
  const mesh = new THREE.Mesh(g, m);
  mesh.scale.set(sx, sy, sz);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = false;
  return mesh;
}

const capsCache = new Map<string, THREE.CapsuleGeometry>();
/** A capsule segment hanging down from its pivot. */
function limb(r: number, len: number, m: THREE.Material) {
  const key = `${r.toFixed(3)}:${len.toFixed(3)}`;
  let g = capsCache.get(key);
  if (!g) {
    g = new THREE.CapsuleGeometry(r, Math.max(0.01, len - 2 * r), 5, 10);
    capsCache.set(key, g);
  }
  const pivot = new THREE.Group();
  const mesh = new THREE.Mesh(g, m);
  mesh.position.y = -len / 2;
  mesh.castShadow = true;
  pivot.add(mesh);
  return pivot;
}

export interface Rig {
  root: THREE.Group;
  body: THREE.Group;
  hips: THREE.Group;
  legL: THREE.Group;
  legR: THREE.Group;
  kneeL: THREE.Group;
  kneeR: THREE.Group;
  armL: THREE.Group;
  armR: THREE.Group;
  elbowL: THREE.Group;
  elbowR: THREE.Group;
  head: THREE.Group;
  phase: number;
  speed: number;
  talk: number;
  carry: boolean;
}

export function buildPerson(look: PersonLook, opts: { key?: boolean } = {}): Person {
  if (humansReady() && (humanMode === "all" || (humanMode === "key" && opts.key))) {
    const h = buildHuman(look);
    if (h) {
      if (look.carry === "tray") h.bones.head.add(trayMesh(look, 0.19));
      if (!opts.key) h.mesh.castShadow = humanMode === "all";
      return h;
    }
  }
  return buildSimplePerson(look);
}

function trayMesh(look: PersonLook, y: number) {
  const tray = new THREE.Group();
  tray.position.y = y;
  tray.add(part(geo.cyl, plainMat("#c0c4c8", 0.35, 0.8), 0.28, 0.06, 0.28, 0, 0, 0));
  const rnd = mulberry32(look.shirt.charCodeAt(2) * 31);
  const goods = ["#e04a2f", "#f2b705", "#3c8d2f", "#f7f3e8", "#8b4a2b"];
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    tray.add(part(geo.sphere, plainMat(goods[Math.floor(rnd() * goods.length)], 0.6), 0.06, 0.05, 0.06, Math.cos(a) * 0.16, 0.06, Math.sin(a) * 0.16));
  }
  return tray;
}

function buildSimplePerson(look: PersonLook): Rig {
  const s = look.height / 1.75;
  const b = look.build;
  const root = new THREE.Group();
  const body = new THREE.Group();
  body.scale.setScalar(s);
  root.add(body);
  const skin = skinMat(look.skin);
  const shirt = clothMat(look.shirt, look.pattern ?? "plain");
  const pants = clothMat(look.pants, "plain");
  const shoe = plainMat("#1b1b1b", 0.5);
  const legLen = 0.86;
  const hips = new THREE.Group();
  hips.position.y = legLen;
  body.add(hips);

  // Legs: thigh + shin with knee pivots.
  const mkLeg = (side: number) => {
    const leg = new THREE.Group();
    leg.position.set(0.1 * side * b, 0, 0);
    const thigh = limb(0.075 * b, 0.45, pants);
    leg.add(thigh);
    const knee = new THREE.Group();
    knee.position.y = -0.43;
    leg.add(knee);
    const shin = limb(0.062 * b, 0.43, look.feminine && look.pattern !== "plain" ? skin : pants);
    knee.add(shin);
    const foot = part(geo.box, shoe, 0.1, 0.07, 0.24, 0, -0.43, 0.05);
    knee.add(foot);
    hips.add(leg);
    return [leg, knee] as const;
  };
  const [legL, kneeL] = mkLeg(-1);
  const [legR, kneeR] = mkLeg(1);

  // Torso: slightly tapered, wider hips for feminine silhouettes.
  const torso = new THREE.Group();
  hips.add(torso);
  const pelvis = part(geo.sphere, pants, 0.17 * b * (look.feminine ? 1.12 : 1), 0.12, 0.12 * b, 0, 0.02, 0);
  torso.add(pelvis);
  const chest = new THREE.Mesh(new THREE.CylinderGeometry(0.19 * b * (look.feminine ? 0.95 : 1.06), 0.15 * b * (look.feminine ? 1.05 : 1), 0.5, 16), shirt);
  chest.position.y = 0.3;
  chest.scale.z = 0.68;
  chest.castShadow = true;
  torso.add(chest);
  const shoulders = part(geo.sphere, shirt, 0.21 * b * (look.feminine ? 0.92 : 1.05), 0.09, 0.13 * b, 0, 0.53, 0);
  torso.add(shoulders);
  if (look.feminine) {
    // Wrapper skirt / kaba slit when wearing a pattern.
    if (look.pattern && look.pattern !== "plain") {
      const skirt = new THREE.Mesh(geo.cone, clothMat(look.pants, look.pattern));
      skirt.scale.set(0.24 * b, 0.62, 0.2 * b);
      skirt.position.y = -0.27;
      skirt.rotation.x = Math.PI;
      skirt.castShadow = true;
      torso.add(skirt);
    }
  }

  // Neck and head.
  const neck = part(geo.cyl, skin, 0.055, 0.12, 0.055, 0, 0.62, 0);
  torso.add(neck);
  const head = new THREE.Group();
  head.position.y = 0.78;
  torso.add(head);
  head.add(part(geo.sphere, skin, 0.105, 0.125, 0.11, 0, 0, 0));
  head.add(part(geo.sphere, skin, 0.02, 0.03, 0.02, -0.105, 0, 0));
  head.add(part(geo.sphere, skin, 0.02, 0.03, 0.02, 0.105, 0, 0));
  head.add(part(geo.sphere, skin, 0.022, 0.03, 0.03, 0, -0.01, 0.105)); // nose
  const eye = plainMat("#120d0a", 0.2);
  head.add(part(geo.sphere, eye, 0.014, 0.012, 0.01, -0.038, 0.025, 0.098));
  head.add(part(geo.sphere, eye, 0.014, 0.012, 0.01, 0.038, 0.025, 0.098));
  head.add(part(geo.box, plainMat("#4a2a22", 0.6), 0.05, 0.008, 0.01, 0, -0.06, 0.1)); // lips
  const hairM = plainMat(look.hair, 0.95);
  const style: HairStyle = look.headwear === "headwrap" ? "wrap" : look.headwear === "cap" ? "cap" : look.hairStyle ?? (look.feminine ? "braids" : "low");
  switch (style) {
    case "low":
      head.add(part(geo.sphere, hairM, 0.11, 0.1, 0.115, 0, 0.035, -0.008));
      break;
    case "afro":
      head.add(part(geo.sphere, hairM, 0.165, 0.15, 0.16, 0, 0.07, -0.02));
      break;
    case "braids": {
      head.add(part(geo.sphere, hairM, 0.112, 0.11, 0.118, 0, 0.03, -0.01));
      for (let i = 0; i < 9; i++) {
        const a = -1.1 + (i / 8) * 2.2;
        const br = part(geo.cyl, hairM, 0.014, 0.32, 0.014, Math.sin(a) * 0.1, -0.12, -Math.cos(a) * 0.09);
        head.add(br);
      }
      break;
    }
    case "locs": {
      head.add(part(geo.sphere, hairM, 0.115, 0.11, 0.12, 0, 0.03, -0.01));
      for (let i = 0; i < 12; i++) {
        const a = -1.6 + (i / 11) * 3.2;
        head.add(part(geo.cyl, hairM, 0.018, 0.2, 0.018, Math.sin(a) * 0.105, -0.06, -Math.cos(a) * 0.1));
      }
      break;
    }
    case "bun":
      head.add(part(geo.sphere, hairM, 0.112, 0.105, 0.118, 0, 0.035, -0.01));
      head.add(part(geo.sphere, hairM, 0.07, 0.07, 0.07, 0, 0.13, -0.06));
      break;
    case "wrap": {
      const wrap = clothMat(look.shirt, "wax");
      head.add(part(geo.sphere, wrap, 0.125, 0.12, 0.13, 0, 0.06, -0.01));
      const knot = part(geo.torus, wrap, 0.09, 0.09, 0.11, 0, 0.15, -0.02);
      knot.rotation.x = Math.PI / 2.4;
      head.add(knot);
      break;
    }
    case "cap": {
      const capM = plainMat(look.pants === look.shirt ? "#C8452C" : look.pants, 0.7);
      head.add(part(geo.sphere, capM, 0.115, 0.08, 0.12, 0, 0.06, 0));
      head.add(part(geo.box, capM, 0.16, 0.012, 0.11, 0, 0.04, 0.12));
      break;
    }
  }

  // Arms: upper arm with sleeve, forearm skin, hand.
  const mkArm = (side: number) => {
    const arm = new THREE.Group();
    arm.position.set(0.22 * b * side * (look.feminine ? 0.92 : 1), 0.52, 0);
    const upper = limb(0.055 * b, 0.3, shirt);
    arm.add(upper);
    const elbow = new THREE.Group();
    elbow.position.y = -0.29;
    arm.add(elbow);
    elbow.add(limb(0.045 * b, 0.27, skin));
    elbow.add(part(geo.sphere, skin, 0.045, 0.06, 0.03, 0, -0.29, 0));
    torso.add(arm);
    return [arm, elbow] as const;
  };
  const [armL, elbowL] = mkArm(-1);
  const [armR, elbowR] = mkArm(1);

  // Things people carry.
  const carry = look.carry === "tray";
  if (carry) {
    const tray = new THREE.Group();
    tray.position.y = 0.95;
    torso.add(tray);
    tray.add(part(geo.cyl, plainMat("#c0c4c8", 0.35, 0.8), 0.28, 0.06, 0.28, 0, 0, 0));
    const rnd = mulberry32(look.shirt.charCodeAt(2) * 31);
    const goods = ["#e04a2f", "#f2b705", "#3c8d2f", "#f7f3e8", "#8b4a2b"];
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2;
      tray.add(part(geo.sphere, plainMat(goods[Math.floor(rnd() * goods.length)], 0.6), 0.06, 0.05, 0.06, Math.cos(a) * 0.16, 0.06, Math.sin(a) * 0.16));
    }
    armR.rotation.z = Math.PI * 0.85;
    elbowR.rotation.z = 0.3;
  } else if (look.carry === "bag") {
    elbowL.add(part(geo.box, plainMat("#6b3f2a", 0.6), 0.16, 0.2, 0.06, 0, -0.42, 0));
  }

  return { root, body, hips, legL, legR, kneeL, kneeR, armL, armR, elbowL, elbowR, head, phase: Math.random() * 10, speed: 0, talk: 0, carry };
}

/** Advance the procedural animation. speed in m/s. */
/** Where the camera's attention is: people far from it animate less often. */
const focus = new THREE.Vector3();
let frame = 0;
export function setAnimFocus(p: THREE.Vector3) { focus.copy(p); frame++; }
const skipped = new WeakMap<object, number>();
export function animatePerson(r: Person, dt: number, speed: number) {
  // Far away: update every 2nd or 4th frame with the time saved up (nobody can see the difference).
  const d2 = r.root.position.distanceToSquared(focus);
  const every = d2 > 70 * 70 ? 4 : d2 > 32 * 32 ? 2 : 1;
  if (every > 1) {
    const acc = (skipped.get(r) ?? 0) + dt;
    if ((frame + (r.root.id % every)) % every !== 0) { skipped.set(r, acc); return; }
    skipped.set(r, 0);
    dt = acc;
  }
  if ("real" in r) return animateHuman(r, dt, speed);
  r.speed += (speed - r.speed) * Math.min(1, dt * 8);
  const v = r.speed;
  const walking = v > 0.15;
  r.phase += dt * (walking ? 2.3 + v * 1.6 : 1.2);
  const ph = r.phase;
  const amp = Math.min(0.75, 0.25 + v * 0.18);
  if (walking) {
    const sw = Math.sin(ph);
    r.legL.rotation.x = sw * amp;
    r.legR.rotation.x = -sw * amp;
    r.kneeL.rotation.x = Math.max(0, -Math.cos(ph)) * amp * 1.3;
    r.kneeR.rotation.x = Math.max(0, Math.cos(ph)) * amp * 1.3;
    if (!r.carry) {
      r.armL.rotation.x = -sw * amp * 0.8;
      r.armR.rotation.x = sw * amp * 0.8;
      r.elbowL.rotation.x = -0.25 - Math.max(0, sw) * 0.3;
      r.elbowR.rotation.x = -0.25 - Math.max(0, -sw) * 0.3;
    } else {
      r.armL.rotation.x = -sw * amp * 0.6;
    }
    r.hips.position.y = 0.86 + Math.abs(Math.cos(ph)) * 0.035;
    r.hips.rotation.y = Math.sin(ph) * 0.06;
    r.body.rotation.x = Math.min(0.15, v * 0.025);
  } else {
    const br = Math.sin(ph * 1.3);
    r.legL.rotation.x *= 0.85;
    r.legR.rotation.x *= 0.85;
    r.kneeL.rotation.x *= 0.85;
    r.kneeR.rotation.x *= 0.85;
    r.hips.position.y = 0.86 + br * 0.004;
    r.hips.rotation.y *= 0.9;
    r.body.rotation.x *= 0.9;
    if (!r.carry) {
      const t = r.talk > 0 ? Math.sin(ph * 3) * 0.35 : 0;
      r.armL.rotation.x = br * 0.03;
      r.armR.rotation.x = -br * 0.03 - (r.talk > 0 ? 0.6 + t : 0);
      r.elbowR.rotation.x = r.talk > 0 ? -0.9 + t * 0.5 : -0.12;
      r.elbowL.rotation.x = -0.12;
      r.armL.rotation.z = -0.08;
      r.armR.rotation.z = 0.08;
    }
    r.head.rotation.y = Math.sin(ph * 0.4) * 0.25;
  }
  if (r.talk > 0) r.talk -= dt;
}

/** Ghana's real range: deep to light brown, plus fair (mixed, Fulani, Lebanese-Ghanaian) — weighted to how often you'd see them. */
export const SKIN_TONES = ["#2E1B10", "#3B2416", "#4A2C1A", "#5A3825", "#6B4226", "#7A4E2D", "#8D5B3A", "#A06A47", "#B57D57", "#C99470", "#DDAE8A", "#EBC6A6"];
const SKINS = [...SKIN_TONES.slice(0, 7), ...SKIN_TONES.slice(0, 7), ...SKIN_TONES.slice(1, 7), ...SKIN_TONES.slice(2, 6), ...SKIN_TONES.slice(7, 9)];
const CLOTH = ["#C8452C", "#F2B705", "#1F7A4D", "#2E86AB", "#E35D3A", "#F7F3E8", "#3A2E6E", "#B03A62", "#0E7C86", "#E9B872", "#1A1A1A", "#7FB7BE", "#D9734E", "#556B2F"];
const PANTS = ["#2B2B2B", "#3A4A5A", "#4A4036", "#1F3A5F", "#7A6A5A", "#E9DCC6", "#2E2E3A"];

/** Roughly normal random number (mean 0, sd 1). */
function gauss(r: () => number) {
  return (r() + r() + r() + r() - 2) * 1.73;
}

export function randomLook(seed: number, opts: { carry?: boolean } = {}): PersonLook {
  const r = mulberry32(seed);
  const pick = <T,>(a: T[]) => a[Math.floor(r() * a.length)];
  const feminine = r() < 0.5;
  const patterns: Pattern[] = ["plain", "plain", "wax", "kente", "stripe", "plain"];
  return {
    skin: pick(SKINS),
    shirt: pick(CLOTH),
    pants: feminine && r() < 0.5 ? pick(CLOTH) : pick(PANTS),
    hair: r() < 0.82 ? "#0f0c0a" : r() < 0.5 ? "#3b2a1e" : r() < 0.6 ? "#8a8580" : "#5a4636",
    feminine,
    // Real spread: some short, some very tall; thin, average and heavy.
    height: (feminine ? 1.62 : 1.73) + gauss(r) * (feminine ? 0.07 : 0.08),
    build: THREE.MathUtils.clamp(1.02 + gauss(r) * 0.14 + (r() < 0.12 ? 0.18 : 0), 0.78, 1.42),
    face: Array.from({ length: 13 }, (_, i) => (i === 12 ? Math.max(0, gauss(r) * 0.5 + (r() < 0.2 ? 0.6 : 0)) : THREE.MathUtils.clamp(gauss(r) * 0.55, -1, 1))),
    hairStyle: feminine ? pick(["braids", "bun", "afro", "wrap", "low", "locs"] as HairStyle[]) : pick(["low", "low", "afro", "cap", "locs"] as HairStyle[]),
    pattern: pick(patterns),
    // Everyday clothes on the street; a few suits and smocks, sandals everywhere.
    outfit: feminine ? pick(["tee", "kaba", "kaba", "dress", "dress", "shirt", "tee"] as OutfitId[]) : pick(["tee", "tee", "shirt", "shirt", "jersey", "smock", "suit"] as OutfitId[]),
    shoes: r() < 0.35 ? "sandals" : undefined,
    carry: opts.carry ? "tray" : r() < 0.15 ? "bag" : null,
  };
}
