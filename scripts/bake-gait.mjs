// Bakes real walk and run cycles from the CMU Graphics Lab Motion Capture
// Database (BVH conversion by B. Hahne, cgspeed.com) onto the game's MakeHuman
// skeletons. CMU: "free for use in research and commercial projects worldwide."
// The data used in this project was obtained from mocap.cs.cmu.edu. The database
// was created with funding from NSF EIA-0196217.
//
// usage: node scripts/bake-gait.mjs <walk.bvh> <run.bvh> > src/world/gait-data.ts
import { readFileSync } from "node:fs";
import * as THREE from "three";
import { BVHLoader } from "three/examples/jsm/loaders/BVHLoader.js";

const [walkFile, runFile] = process.argv.slice(2);
const N = 40; // samples per cycle

// target bone ← source joint, with the child each uses to measure the bone's direction
const MAP = [
  ["root", "Hips", null, null],
  ["spine05", "LowerBack", "spine03", "Spine"],
  ["spine03", "Spine", "spine01", "Spine1"],
  ["spine01", "Spine1", "neck01", "Neck"],
  ["neck01", "Neck", "neck03", "Neck1"],
  ["neck03", "Neck1", "head", "Head"],
  ["head", "Head", null, null],
  ...["L", "R"].flatMap((s) => {
    const S = s === "L" ? "Left" : "Right";
    return [
      [`upperleg01.${s}`, `${S}UpLeg`, `lowerleg01.${s}`, `${S}Leg`],
      [`lowerleg01.${s}`, `${S}Leg`, `foot.${s}`, `${S}Foot`],
      [`foot.${s}`, `${S}Foot`, `toe1-1.${s}`, `${S}ToeBase`],
      [`clavicle.${s}`, `${S}Shoulder`, `upperarm01.${s}`, `${S}Arm`],
      [`upperarm01.${s}`, `${S}Arm`, `lowerarm01.${s}`, `${S}ForeArm`],
      [`lowerarm01.${s}`, `${S}ForeArm`, `wrist.${s}`, `${S}Hand`],
    ];
  }),
];

function sourceFrames(file) {
  const res = new BVHLoader().parse(readFileSync(file, "utf8"));
  const bones = res.skeleton.bones;
  const root = bones[0];
  const byName = Object.fromEntries(bones.map((b) => [b.name, b]));
  const mixer = new THREE.AnimationMixer(root);
  const action = mixer.clipAction(res.clip);
  action.play();
  const dt = res.clip.duration / (res.clip.tracks[0].times.length - 1);
  const count = res.clip.tracks[0].times.length;
  const frames = [];
  for (let f = 0; f < count; f++) {
    mixer.setTime(f * dt);
    root.updateMatrixWorld(true);
    const fr = {};
    for (const b of bones) {
      const q = new THREE.Quaternion(), p = new THREE.Vector3();
      b.getWorldQuaternion(q);
      b.getWorldPosition(p);
      fr[b.name] = { q, p };
    }
    frames.push(fr);
  }
  return { frames, dt, byName };
}

function bake(file, asset) {
  const { frames, dt } = sourceFrames(file);
  const t0 = frames[0]; // frame one is the T-pose
  // Our skeleton at rest: every local rotation is identity, so world rotations are identity too.
  const head = Object.fromEntries(asset.bones.map((b) => [b.name, new THREE.Vector3(...b.head)]));
  const parent = Object.fromEntries(asset.bones.map((b) => [b.name, b.parent >= 0 ? asset.bones[b.parent].name : null]));
  const align = {};
  for (const [dst, src, dc, sc] of MAP) {
    if (!dc) { align[dst] = new THREE.Quaternion(); continue; }
    const dRest = head[dc].clone().sub(head[dst]).normalize();
    const dSrc = t0[sc].p.clone().sub(t0[src].p).normalize();
    align[dst] = new THREE.Quaternion().setFromUnitVectors(dRest, dSrc);
  }
  // Travel direction → +z.
  const first = Math.max(3, Math.floor(frames.length * 0.1)), last = frames.length - 2;
  const travel = frames[last].Hips.p.clone().sub(frames[first].Hips.p).setY(0);
  const yaw = Math.atan2(travel.x, travel.z);
  const fix = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -yaw);
  const fwd = (p) => p.clone().applyQuaternion(fix);
  // Half a stride: left foot furthest forward to right foot furthest forward. The second half
  // is the first mirrored, so even short takes give a clean, symmetrical loop.
  const peaksOf = (joint) => {
    const sig = frames.map((f) => fwd(f[joint].p).z - fwd(f.Hips.p).z);
    const out = [];
    for (let i = 4; i < sig.length - 3; i++) if (sig[i] === Math.max(...sig.slice(i - 3, i + 4)) && sig[i] > 0) out.push(i);
    return out;
  };
  const lp = peaksOf("LeftFoot"), rp = peaksOf("RightFoot");
  const pairs = lp.map((l) => [l, rp.find((r) => r > l + 0.12 / dt)]).filter(([, r]) => r !== undefined && r - lp[0] < 2 / dt);
  if (!pairs.length) throw new Error(`no stride found in ${file}`);
  const [a, b] = pairs[Math.floor((pairs.length - 1) / 2)];
  // Scale: our leg length over theirs.
  const ourLeg = head["upperleg01.L"].y - head["foot.L"].y;
  const srcLeg = t0.LeftUpLeg.p.y - t0.LeftFoot.p.y;
  const scale = ourLeg / srcLeg;
  const stride = 2 * (fwd(frames[b].Hips.p).z - fwd(frames[a].Hips.p).z) * scale;
  const duration = 2 * (b - a) * dt;
  const out = { duration: +duration.toFixed(4), stride: +stride.toFixed(4), bones: {}, root: [] };
  const names = MAP.map((m) => m[0]);
  for (const n of names) out.bones[n] = [];
  const hy = [], hx = [];
  const H = N / 2;
  for (let k = 0; k < H; k++) {
    const ft = a + ((b - a) * k) / H;
    const i0 = Math.floor(ft), u = ft - i0;
    const F = (name) => {
      const q = frames[i0][name].q.clone().slerp(frames[i0 + 1][name].q, u);
      const p = frames[i0][name].p.clone().lerp(frames[i0 + 1][name].p, u);
      return { q, p };
    };
    // World rotation for each mapped target bone, then local = parent⁻¹ · world.
    const world = {};
    const worldOf = (n) => {
      if (world[n]) return world[n];
      const m = MAP.find((x) => x[0] === n);
      if (m) {
        const s = F(m[1]);
        const delta = s.q.clone().multiply(t0[m[1]].q.clone().invert());
        world[n] = fix.clone().multiply(delta).multiply(align[n]);
      } else world[n] = parent[n] ? worldOf(parent[n]) : new THREE.Quaternion();
      return world[n];
    };
    for (const n of names) {
      const w = worldOf(n);
      const p = parent[n] ? worldOf(parent[n]) : new THREE.Quaternion();
      const local = p.clone().invert().multiply(w);
      out.bones[n].push(...local.toArray().map((v) => +v.toFixed(4)));
    }
    const hp = fwd(F("Hips").p);
    hy.push(hp.y * scale);
    hx.push(hp.x * scale);
  }
  // Second half: mirror the first (swap sides, reflect across the body's midline).
  const swap = (n) => (n.endsWith(".L") ? n.slice(0, -2) + ".R" : n.endsWith(".R") ? n.slice(0, -2) + ".L" : n);
  const firstHalf = Object.fromEntries(names.map((n) => [n, out.bones[n].slice()]));
  for (const n of names) {
    const src = firstHalf[swap(n)];
    for (let k = 0; k < H; k++) {
      const [x, y, z, w] = src.slice(k * 4, k * 4 + 4);
      out.bones[n].push(x, -y, -z, w);
    }
  }
  for (let k = 0; k < H; k++) { hx.push(-hx[k]); hy.push(hy[k]); }
  const my = hy.reduce((s, v) => s + v, 0) / N;
  const mx = hx.reduce((s, v) => s + v, 0) / N;
  for (let k = 0; k < N; k++) out.root.push(+(hx[k] - mx).toFixed(4), +(hy[k] - my).toFixed(4));
  return out;
}

const male = JSON.parse(readFileSync(new URL("../public/humans/male.json", import.meta.url), "utf8"));
const female = JSON.parse(readFileSync(new URL("../public/humans/female.json", import.meta.url), "utf8"));
const data = {
  male: { walk: bake(walkFile, male), run: bake(runFile, male) },
  female: { walk: bake(walkFile, female), run: bake(runFile, female) },
};
for (const g of ["male"]) for (const c of ["walk", "run"]) console.error(g, c, data[g][c].duration + "s", data[g][c].stride + "m", (data[g][c].stride / data[g][c].duration).toFixed(2) + " m/s");
console.log(`// Generated by scripts/bake-gait.mjs from the CMU Graphics Lab Motion Capture Database
// (mocap.cs.cmu.edu; BVH conversion by B. Hahne). Free for research and commercial use.
// The database was created with funding from NSF EIA-0196217. Do not edit by hand.
// walk: ${walkFile.split("/").pop()}  run: ${runFile.split("/").pop()}
export interface GaitClip { duration: number; stride: number; bones: Record<string, number[]>; root: number[] }
export const GAIT: Record<"male" | "female", { walk: GaitClip; run: GaitClip }> = ${JSON.stringify(data)};`);
