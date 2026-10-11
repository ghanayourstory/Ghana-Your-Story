// Vehicles: sedans, Accra taxis (yellow corner panels), trotros with painted
// slogans, SUVs and the V8. Rounded bodies, clear-coat paint, glass, rims.
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { plate, signboard, trotroLivery } from "./textures.ts";
import { mulberry32 } from "../../shared/rng.ts";

export type VehicleKind = "sedan" | "taxi" | "trotro" | "suv" | "v8" | "pickup";

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

  if (kind === "trotro") {
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

export function setVehicleLights(v: VehicleRig, night: boolean, braking: boolean) {
  for (const m of v.lights) m.emissiveIntensity = night ? 2.4 : 0.05;
  v.brake.emissiveIntensity = braking ? 2.5 : night ? 0.9 : 0.12;
}

export function spinWheels(v: VehicleRig, distance: number) {
  for (const w of v.wheels) w.rotation.x += distance / 0.35;
}
