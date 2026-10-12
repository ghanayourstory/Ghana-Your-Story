// Living at home, Sims-style: walking around the furniture (grid A*), poses for
// using things (lying in bed, sitting on the sofa, squatting at the coal pot,
// standing in the shower) and small effects that sell it (water, steam, the TV
// glow, Zzz).
import * as THREE from "three";
import type { Interior, Pose, SpotUse } from "./interiors.ts";
import type { Person } from "./people.ts";

// ---------------------------------------------------------------------------
// Paths

const CELL = 0.2;

/** Shortest walkable route between two points inside a home (8-way grid A*, then smoothed). */
export function findPath(it: Interior, from: THREE.Vector3, to: THREE.Vector3, radius = 0.26): THREE.Vector3[] {
  const b = it.bounds;
  const nx = Math.max(1, Math.ceil((b.maxX - b.minX) / CELL)), nz = Math.max(1, Math.ceil((b.maxZ - b.minZ) / CELL));
  const blocked = new Uint8Array(nx * nz);
  for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) {
    const x = b.minX + (i + 0.5) * CELL, z = b.minZ + (j + 0.5) * CELL;
    for (const c of it.colliders) {
      if (x > c.minX - radius && x < c.maxX + radius && z > c.minZ - radius && z < c.maxZ + radius) { blocked[i * nz + j] = 1; break; }
    }
  }
  const cellOf = (p: THREE.Vector3) => [THREE.MathUtils.clamp(Math.floor((p.x - b.minX) / CELL), 0, nx - 1), THREE.MathUtils.clamp(Math.floor((p.z - b.minZ) / CELL), 0, nz - 1)] as const;
  const free = (i: number, j: number) => i >= 0 && j >= 0 && i < nx && j < nz && !blocked[i * nz + j];
  const nearestFree = (c: readonly [number, number]) => {
    if (free(c[0], c[1])) return c;
    for (let r = 1; r < 12; r++) for (let di = -r; di <= r; di++) for (const dj of [-r, r]) {
      if (free(c[0] + di, c[1] + dj)) return [c[0] + di, c[1] + dj] as const;
      if (free(c[0] + dj, c[1] + di)) return [c[0] + dj, c[1] + di] as const;
    }
    return c;
  };
  const s = nearestFree(cellOf(from)), g = nearestFree(cellOf(to));
  const key = (i: number, j: number) => i * nz + j;
  const gScore = new Float32Array(nx * nz).fill(Infinity);
  const came = new Int32Array(nx * nz).fill(-1);
  const open: { k: number; f: number }[] = [{ k: key(s[0], s[1]), f: 0 }];
  gScore[key(s[0], s[1])] = 0;
  const h = (i: number, j: number) => Math.hypot(i - g[0], j - g[1]);
  const goal = key(g[0], g[1]);
  let found = false;
  let guard = 0;
  while (open.length && guard++ < 40000) {
    let bi = 0;
    for (let i = 1; i < open.length; i++) if (open[i].f < open[bi].f) bi = i;
    const { k } = open.splice(bi, 1)[0];
    if (k === goal) { found = true; break; }
    const ci = Math.floor(k / nz), cj = k % nz;
    for (let di = -1; di <= 1; di++) for (let dj = -1; dj <= 1; dj++) {
      if (!di && !dj) continue;
      const ni = ci + di, nj = cj + dj;
      if (!free(ni, nj)) continue;
      if (di && dj && (!free(ci + di, cj) || !free(ci, cj + dj))) continue; // no corner cutting
      const nk = key(ni, nj);
      const ng = gScore[k] + (di && dj ? 1.414 : 1);
      if (ng < gScore[nk]) {
        gScore[nk] = ng;
        came[nk] = k;
        open.push({ k: nk, f: ng + h(ni, nj) });
      }
    }
  }
  const centre = (k: number) => new THREE.Vector3(b.minX + (Math.floor(k / nz) + 0.5) * CELL, 0, b.minZ + ((k % nz) + 0.5) * CELL);
  if (!found) return [to.clone()];
  const cells: THREE.Vector3[] = [];
  for (let k = goal; k !== -1; k = came[k]) cells.push(centre(k));
  cells.reverse();
  cells[cells.length - 1] = to.clone().setY(0);
  // String-pull: drop points we can see past.
  const clear = (a: THREE.Vector3, c: THREE.Vector3) => {
    const n = Math.ceil(a.distanceTo(c) / (CELL * 0.5));
    for (let i = 1; i < n; i++) {
      const p = a.clone().lerp(c, i / n);
      const [ci, cj] = cellOf(p);
      if (!free(ci, cj)) return false;
    }
    return true;
  };
  const out: THREE.Vector3[] = [];
  let anchor = from.clone().setY(0);
  for (let i = 1; i < cells.length; i++) {
    if (!clear(anchor, cells[i])) {
      out.push(cells[i - 1]);
      anchor = cells[i - 1];
    }
  }
  out.push(cells[cells.length - 1]);
  return out;
}

// ---------------------------------------------------------------------------
// Poses

type Bones = Record<string, THREE.Bone>;
const bonesOf = (p: Person) => ((p as unknown as { real?: boolean }).real ? (p as unknown as { bones: Bones }).bones : null);

/** Height of the hip joint above the feet, measured once per person while standing. */
const hipCache = new WeakMap<object, number>();
export function hipHeight(p: Person): number {
  const cached = hipCache.get(p);
  if (cached) return cached;
  const b = bonesOf(p);
  let h = 0.9;
  if (b?.["upperleg01.L"]) {
    p.root.updateMatrixWorld(true);
    const w = b["upperleg01.L"].getWorldPosition(new THREE.Vector3());
    h = THREE.MathUtils.clamp(w.y - p.root.position.y, 0.6, 1.2);
  }
  hipCache.set(p, h);
  return h;
}

/** Put a person into a pose at a spot (call every frame after the normal animation). */
export function applyPose(p: Person, use: SpotUse, t: number) {
  const root = p.root;
  const b = bonesOf(p);
  const dx = use.look[0] - use.x, dz = use.look[1] - use.z;
  const len = Math.hypot(dx, dz) || 1;
  const d = { x: dx / len, z: dz / len };
  const set = (n: string, x: number, y = 0, z = 0) => b?.[n]?.rotation.set(x, y, z);
  root.rotation.order = "YXZ";
  root.visible = use.pose !== "hidden";
  const hip = hipHeight(p);
  switch (use.pose) {
    case "lie":
    case "swim": {
      // Feet at one end, head towards `look`; face up in bed, face down swimming.
      const up = use.pose === "lie";
      root.rotation.set(up ? -Math.PI / 2 : Math.PI / 2, up ? Math.atan2(-d.x, -d.z) : Math.atan2(d.x, d.z), 0);
      root.position.set(use.x - d.x * 0.85, use.y + 0.12 + (up ? 0 : Math.sin(t * 2) * 0.03), use.z - d.z * 0.85);
      if (b) {
        for (const s of ["L", "R"]) {
          set(`upperleg01.${s}`, 0, 0, s === "L" ? -0.06 : 0.06);
          set(`lowerleg01.${s}`, up ? 0.05 : Math.max(0, Math.sin(t * 6 + (s === "L" ? 0 : Math.PI))) * 0.4);
        }
        if (up) {
          set("upperarm01.L", 0.1, 0, -1.2);
          set("upperarm01.R", 0.1, 0, 1.2);
          set("neck02", -0.25);
        } else {
          // Breaststroke-ish arms.
          const k = (Math.sin(t * 2.4) + 1) / 2;
          set("upperarm01.L", -2.6 + k * 1.6, 0, -0.4 - k * 0.8);
          set("upperarm01.R", -2.6 + k * 1.6, 0, 0.4 + k * 0.8);
          set("neck02", 0.5);
        }
      }
      break;
    }
    case "sit":
    case "squat": {
      const low = use.pose === "squat";
      root.rotation.set(0, Math.atan2(d.x, d.z), 0);
      // Hips over the seat, a little back from its front edge.
      root.position.set(use.x - d.x * 0.12, use.y - hip + (low ? 0.08 : 0.04), use.z - d.z * 0.12);
      if (b) {
        for (const s of ["L", "R"]) {
          set(`upperleg01.${s}`, low ? -2.0 : -1.5, 0, s === "L" ? -0.12 : 0.12);
          set(`lowerleg01.${s}`, low ? 2.2 : 1.55, 0, 0);
          set(`foot.${s}`, low ? -0.35 : 0, 0, 0);
          set(`upperarm01.${s}`, low ? -0.6 : 0.35, 0, s === "L" ? -1.0 : 1.0);
        }
        set("spine03", low ? 0.35 : -0.05);
        if (low) {
          // Fanning the coals.
          set("lowerarm01.R", -1.2 + Math.sin(t * 9) * 0.25);
        }
      }
      break;
    }
    case "bath":
    case "stand": {
      root.rotation.set(0, Math.atan2(d.x, d.z), 0);
      root.position.set(use.x, use.y, use.z);
      if (b && use.pose === "bath") {
        // Scrubbing.
        set("upperarm01.L", -1.2 + Math.sin(t * 5) * 0.4, 0, -0.4);
        set("upperarm01.R", -1.0 + Math.cos(t * 5) * 0.4, 0, 0.4);
        set("lowerarm01.L", -1.4);
        set("lowerarm01.R", -1.4);
      }
      break;
    }
    case "hidden":
      root.position.set(use.x, use.y, use.z);
      break;
  }
}

/** Back to normal standing. */
export function clearPose(p: Person) {
  p.root.rotation.set(0, p.root.rotation.y, 0);
  p.root.visible = true;
}

// ---------------------------------------------------------------------------
// Effects

export interface Fx {
  group: THREE.Group;
  update: (dt: number, t: number) => void;
  dispose: () => void;
}

function particles(n: number, color: string, size: number, opacity: number, spawn: (v: THREE.Vector3) => void, step: (v: THREE.Vector3, vel: THREE.Vector3, dt: number) => boolean, velocity: (v: THREE.Vector3) => void): Fx {
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(n * 3);
  const vel = Array.from({ length: n }, () => new THREE.Vector3());
  const tmp = new THREE.Vector3();
  for (let i = 0; i < n; i++) {
    spawn(tmp);
    tmp.y += Math.random() * 1.5;
    pos.set([tmp.x, tmp.y, tmp.z], i * 3);
    velocity(vel[i]);
  }
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.PointsMaterial({ color, size, transparent: true, opacity, depthWrite: false, sizeAttenuation: true });
  const pts = new THREE.Points(geo, mat);
  const group = new THREE.Group();
  group.add(pts);
  return {
    group,
    update: (dt) => {
      for (let i = 0; i < n; i++) {
        tmp.fromArray(pos, i * 3);
        if (!step(tmp, vel[i], dt)) { spawn(tmp); velocity(vel[i]); }
        tmp.toArray(pos, i * 3);
      }
      geo.attributes.position.needsUpdate = true;
    },
    dispose: () => { geo.dispose(); mat.dispose(); },
  };
}

/** What you see while someone does a thing. */
export function activityFx(kind: "shower" | "steam" | "smoke" | "tv" | "sleep" | "splash", at: THREE.Vector3, look?: [number, number]): Fx {
  switch (kind) {
    case "shower":
      return particles(160, "#cfe9ff", 0.035, 0.75,
        (v) => v.set(at.x + (Math.random() - 0.5) * 0.5, at.y + 2.1, at.z + (Math.random() - 0.5) * 0.5),
        (v, vel, dt) => { v.addScaledVector(vel, dt); return v.y > at.y; },
        (vel) => vel.set(0, -3.5 - Math.random() * 1.5, 0));
    case "steam":
    case "smoke": {
      const smoke = kind === "smoke";
      return particles(70, smoke ? "#8d8a86" : "#f4f4f4", smoke ? 0.16 : 0.1, smoke ? 0.35 : 0.4,
        (v) => v.set(at.x + (Math.random() - 0.5) * 0.25, at.y, at.z + (Math.random() - 0.5) * 0.25),
        (v, vel, dt) => { v.addScaledVector(vel, dt); vel.x += (Math.random() - 0.5) * dt * 0.6; return v.y < at.y + 1.6; },
        (vel) => vel.set((Math.random() - 0.5) * 0.1, 0.5 + Math.random() * 0.4, (Math.random() - 0.5) * 0.1));
    }
    case "splash":
      return particles(60, "#e8fbff", 0.06, 0.7,
        (v) => v.set(at.x + (Math.random() - 0.5) * 1.2, at.y + 0.2, at.z + (Math.random() - 0.5) * 1.2),
        (v, vel, dt) => { v.addScaledVector(vel, dt); vel.y -= 9.8 * dt; return v.y > at.y; },
        (vel) => vel.set((Math.random() - 0.5) * 1.2, 1.5 + Math.random() * 1.5, (Math.random() - 0.5) * 1.2));
    case "tv": {
      // The screen's flicker on the room.
      const group = new THREE.Group();
      const l = new THREE.PointLight("#9cc4ff", 3, 7, 1.5);
      l.position.set(look ? look[0] : at.x, 1.3, look ? look[1] + 0.4 : at.z);
      group.add(l);
      return { group, update: (_dt, t) => { l.intensity = 2.2 + Math.sin(t * 13) * 0.6 + Math.sin(t * 5.3) * 0.8; l.color.setHSL(0.58 + Math.sin(t * 0.7) * 0.06, 0.6, 0.7); }, dispose: () => {} };
    }
    case "sleep": {
      const group = new THREE.Group();
      const c = document.createElement("canvas");
      c.width = c.height = 64;
      const g = c.getContext("2d")!;
      g.fillStyle = "#ffffff";
      g.font = "bold 46px sans-serif";
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.fillText("Z", 32, 34);
      const tex = new THREE.CanvasTexture(c);
      const mats: THREE.SpriteMaterial[] = [];
      const zs: THREE.Sprite[] = [];
      for (let i = 0; i < 3; i++) {
        const m = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false });
        const s = new THREE.Sprite(m);
        mats.push(m);
        zs.push(s);
        group.add(s);
      }
      return {
        group,
        update: (_dt, t) => zs.forEach((s, i) => {
          const k = (t * 0.35 + i / 3) % 1;
          s.position.set(at.x + Math.sin(k * 6) * 0.15, at.y + 0.4 + k * 1.1, at.z);
          s.scale.setScalar(0.18 + k * 0.22);
          (s.material as THREE.SpriteMaterial).opacity = Math.sin(k * Math.PI) * 0.9;
        }),
        dispose: () => { tex.dispose(); mats.forEach((m) => m.dispose()); },
      };
    }
  }
}

/** Which effect fits what's being done. */
export function fxFor(activity: string, pose: Pose): "shower" | "steam" | "smoke" | "tv" | "sleep" | "splash" | null {
  if (activity === "sleep" || activity === "nap") return "sleep";
  if (activity === "cook_coalpot") return "smoke";
  if (activity.startsWith("cook")) return "steam";
  if (activity === "watch_tv" || activity === "watch_football") return "tv";
  if (activity === "pool_swim") return "splash";
  if (activity === "shower" || (pose === "bath" && activity !== "laundry")) return "shower";
  if (pose === "hidden") return "steam";
  return null;
}
