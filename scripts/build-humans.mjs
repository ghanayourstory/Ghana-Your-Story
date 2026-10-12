// Bakes realistic, rigged human bodies for the game from the MakeHuman CC0
// assets (base mesh, African macro targets, default skeleton + weights).
//
//   node scripts/build-humans.mjs <makehuman-data-dir>
//
// Output: public/humans/{male,female}.json — positions, UVs, skin weights,
// clothing regions and body-type morphs, plus a reduced game skeleton.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const DATA = process.argv[2];
if (!DATA) throw new Error("usage: node scripts/build-humans.mjs <makehuman/data>");

// ---------------------------------------------------------------------------
// Base mesh

const V = [], VT = [], faces = [];
let group = null;
const groupVerts = new Map();
for (const line of readFileSync(join(DATA, "3dobjs/base.obj"), "utf8").split("\n")) {
  if (line.startsWith("v ")) V.push(line.split(/\s+/).slice(1, 4).map(Number));
  else if (line.startsWith("vt ")) VT.push(line.split(/\s+/).slice(1, 3).map(Number));
  else if (line.startsWith("g ")) group = line.slice(2).trim();
  else if (line.startsWith("f ")) {
    const f = line.split(/\s+/).slice(1).filter(Boolean).map((t) => t.split("/").map((x) => Number(x) - 1));
    if (group === "body") faces.push(f);
  }
}
console.log(`base: ${V.length} verts, ${faces.length} body faces`);

function readTarget(name) {
  const d = new Map();
  const file = name.includes("/") ? join(DATA, "targets", name + ".target") : join(DATA, "targets/macrodetails", name + ".target");
  for (const line of readFileSync(file, "utf8").split("\n")) {
    if (!line || line.startsWith("#")) continue;
    const [i, x, y, z] = line.trim().split(/\s+/).map(Number);
    d.set(i, [x, y, z]);
  }
  return d;
}
function apply(base, target, w) {
  const out = base.map((p) => p.slice());
  for (const [i, dv] of target) for (let k = 0; k < 3; k++) out[i][k] += dv[k] * w;
  return out;
}

// ---------------------------------------------------------------------------
// Skeleton: keep the bones a game needs; fold the rest into their ancestors.

const sk = JSON.parse(readFileSync(join(DATA, "rigs/default.mhskel"), "utf8"));
const wts = JSON.parse(readFileSync(join(DATA, "rigs/default_weights.mhw"), "utf8")).weights;
const KEEP = new Set([
  "root", "spine05", "spine04", "spine03", "spine02", "spine01", "neck01", "neck02", "neck03", "head", "jaw",
  ...["pelvis", "upperleg01", "upperleg02", "lowerleg01", "lowerleg02", "foot", "toe1-1", "clavicle", "shoulder01", "upperarm01", "upperarm02", "lowerarm01", "lowerarm02", "wrist"].flatMap((b) => [`${b}.L`, `${b}.R`]),
]);
const keptAncestor = (b) => {
  let c = b;
  while (c && !KEEP.has(c)) c = sk.bones[c].parent;
  return c ?? "root";
};
// Toes fold into toe1-1 only for the big toe chain; others to the foot.
const mapBone = (b) => (b.startsWith("toe") && !b.startsWith("toe1-1") ? (b.endsWith(".L") ? "foot.L" : "foot.R") : keptAncestor(b));

// Topological order (parents first).
const order = [];
const visit = (b) => {
  if (order.includes(b)) return;
  const p = sk.bones[b].parent;
  if (p && KEEP.has(p)) visit(p);
  else if (p) visit(keptAncestor(p));
  order.push(b);
};
for (const b of KEEP) visit(b);
const boneIndex = new Map(order.map((b, i) => [b, i]));

// Per-vertex weights on the kept bones.
const vw = Array.from({ length: V.length }, () => new Map());
for (const [bone, list] of Object.entries(wts)) {
  const kb = mapBone(bone);
  for (const [vi, w] of list) vw[vi].set(kb, (vw[vi].get(kb) ?? 0) + w);
}

// ---------------------------------------------------------------------------
// Stylised face: Taubin-smooth the head (keeps volume) so realistic creases
// soften into clean planes. Eyelids stay locked so eyes still sit in their sockets.
const faceNeighbours = (() => {
  const nb = Array.from({ length: V.length }, () => new Set());
  for (const f of faces) for (let k = 0; k < f.length; k++) { const a = f[k][0], b = f[(k + 1) % f.length][0]; nb[a].add(b); nb[b].add(a); }
  return nb;
})();
function smoothFace(P) {
  const eyeC = ["eye.L", "eye.R"].map((b) => { const idx = sk.joints[sk.bones[b].head]; const c = [0, 0, 0]; for (const i of idx) for (let k = 0; k < 3; k++) c[k] += P[i][k] / idx.length; return c; });
  const movable = [];
  for (let i = 0; i < P.length; i++) {
    const w = (vw[i].get("head") ?? 0) + (vw[i].get("jaw") ?? 0);
    if (w < 0.7 || !faceNeighbours[i].size) continue;
    const nearEye = eyeC.some((c) => Math.hypot(P[i][0] - c[0], P[i][1] - c[1], P[i][2] - c[2]) < 0.28);
    if (!nearEye) movable.push(i);
  }
  let Q = P.map((p) => p.slice());
  const step = (lam) => {
    const R = Q.map((p) => p.slice());
    for (const i of movable) {
      const ns = faceNeighbours[i];
      const c = [0, 0, 0];
      for (const j of ns) for (let k = 0; k < 3; k++) c[k] += Q[j][k] / ns.size;
      for (let k = 0; k < 3; k++) R[i][k] = Q[i][k] + lam * (c[k] - Q[i][k]);
    }
    Q = R;
  };
  for (let it = 0; it < 10; it++) { step(0.5); step(-0.53); }
  return Q;
}

// ---------------------------------------------------------------------------
// Build one gender.

// Ethnic mix the way MakeHuman's sliders work (weights sum to 1). A single
// template at 100% is an extreme average; real faces sit between them.
const ETHNIC = { african: 0.82, caucasian: 0.09, asian: 0.09 };
// Gentle facial modifiers (MakeHuman targets, weight 0..1) for natural proportions.
// Stylised direction: bigger eyes, softer brow and jaw, rounder head.
const FACE = {
  common: {
    "chin/chin-prognathism-decr": 0.6,
    "mouth/mouth-trans-backward": 0.4,
    "eyebrows/eyebrows-trans-backward": 0.65,
    "forehead/forehead-trans-forward": 0.35,
    "forehead/forehead-scale-vert-incr": 0.35,
    "eyes/l-eye-scale-incr": 0.9,
    "eyes/r-eye-scale-incr": 0.9,
    "head/head-oval": 0.35,
    "head/head-round": 0.3,
    "cheek/l-cheek-volume-incr": 0.3,
    "cheek/r-cheek-volume-incr": 0.3,
  },
  male: { "chin/chin-bones-incr": 0.2 },
  female: {
    "eyes/l-eye-scale-incr": 1.0,
    "eyes/r-eye-scale-incr": 1.0,
    "cheek/l-cheek-bones-incr": 0.35,
    "cheek/r-cheek-bones-incr": 0.35,
    "chin/chin-width-decr": 0.35,
    "head/head-oval": 0.55,
    "mouth/mouth-cupidsbow-incr": 0.4,
    "eyebrows/eyebrows-angle-up": 0.25,
  },
};

function build(gender) {
  let base0 = V;
  for (const [eth, w] of Object.entries(ETHNIC)) base0 = apply(base0, readTarget(`${eth}-${gender}-young`), w);
  for (const [t, w] of Object.entries({ ...FACE.common, ...FACE[gender] })) base0 = apply(base0, readTarget(t), w);
  const base = smoothFace(apply(base0, readTarget(`universal-${gender}-young-averagemuscle-averageweight`), 1));
  const variant = (name) => apply(base0, readTarget(`universal-${gender}-young-${name}`), 1);
  const morphs = {
    muscle: variant("maxmuscle-averageweight"),
    heavy: variant("averagemuscle-maxweight"),
    slim: variant("averagemuscle-minweight"),
  };
  const jointPos = (name, P = base) => {
    const idx = sk.joints[name];
    const s = [0, 0, 0];
    for (const i of idx) for (let k = 0; k < 3; k++) s[k] += P[i][k];
    return s.map((x) => x / idx.length);
  };
  // Feet on the ground, metres.
  let minY = Infinity;
  for (const f of faces) for (const [vi] of f) minY = Math.min(minY, base[vi][1]);
  const toM = (p) => [p[0] * 0.1, (p[1] - minY) * 0.1, p[2] * 0.1];

  const heads = new Map(order.map((b) => [b, toM(jointPos(sk.bones[b].head))]));
  const eyes = ["eye.L", "eye.R"].map((b) => ({ head: toM(jointPos(sk.bones[b].head)), tail: toM(jointPos(sk.bones[b].tail)) }));
  const eyeY = (eyes[0].head[1] + eyes[1].head[1]) / 2;
  const headP = heads.get("head");
  const waistY = heads.get("spine04")[1] - 0.02;

  // Unweld on (vertex, uv) pairs.
  const key = new Map();
  const pos = [], uv = [], src = [], idx = [];
  const vert = (vi, ti) => {
    const k = vi * 100000 + ti;
    let n = key.get(k);
    if (n === undefined) {
      n = src.length;
      key.set(k, n);
      src.push(vi);
      pos.push(...toM(base[vi]));
      uv.push(VT[ti][0], VT[ti][1]);
    }
    return n;
  };
  for (const f of faces) {
    const ids = f.map(([vi, ti]) => vert(vi, ti));
    for (let i = 1; i + 1 < ids.length; i++) idx.push(ids[0], ids[i], ids[i + 1]);
  }

  // Skin weights (top 4) and clothing regions.
  // Regions: 0 skin, 1 shirt, 2 sleeve, 3 trousers/thigh, 4 shoe, 5 scalp, 6 shin, 7 lips, 8 brows
  const n = src.length;
  const skinIndex = new Uint8Array(n * 4), skinWeight = new Uint8Array(n * 4), region = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    const vi = src[i];
    const list = [...vw[vi]].sort((a, b) => b[1] - a[1]).slice(0, 4);
    const total = list.reduce((s, x) => s + x[1], 0) || 1;
    let acc = 0;
    list.forEach(([b, w], k) => {
      skinIndex[i * 4 + k] = boneIndex.get(b);
      const q = k === list.length - 1 ? 255 - acc : Math.round((w / total) * 255);
      skinWeight[i * 4 + k] = q;
      acc += q;
    });
    if (!list.length) { skinIndex[i * 4] = 0; skinWeight[i * 4] = 255; }
    const dom = list[0]?.[0] ?? "root";
    const [x, y, z] = [pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]];
    let r = 0;
    if (/^(head|jaw|neck)/.test(dom)) {
      r = 0; // face and scalp detail comes from the smooth face masks below
    } else if (/^(spine|clavicle|shoulder|breast)/.test(dom) || (/^(root|pelvis)/.test(dom) && y >= waistY)) r = 1;
    else if (dom.startsWith("upperarm01")) r = 1;
    else if (dom.startsWith("upperarm02")) r = 2;
    else if (/^(root|pelvis|upperleg)/.test(dom)) r = 3;
    else if (dom.startsWith("lowerleg")) r = 6;
    else if (/^(foot|toe)/.test(dom)) r = 4;
    region[i] = r;
  }

  // Smooth normals on the welded mesh so UV seams don't show.
  const wn = new Float64Array(V.length * 3);
  for (const f of faces) {
    const ps = f.map(([vi]) => toM(base[vi]));
    for (let i = 1; i + 1 < ps.length; i++) {
      const [a, b, c] = [ps[0], ps[i], ps[i + 1]];
      const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
      const nx = u[1] * v[2] - u[2] * v[1], ny = u[2] * v[0] - u[0] * v[2], nz = u[0] * v[1] - u[1] * v[0];
      for (const vi of [f[0][0], f[i][0], f[i + 1][0]]) { wn[vi * 3] += nx; wn[vi * 3 + 1] += ny; wn[vi * 3 + 2] += nz; }
    }
  }
  const normal = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const vi = src[i];
    const l = Math.hypot(wn[vi * 3], wn[vi * 3 + 1], wn[vi * 3 + 2]) || 1;
    normal.set([wn[vi * 3] / l, wn[vi * 3 + 1] / l, wn[vi * 3 + 2] / l], i * 3);
  }

  // -------------------------------------------------------------------------
  // Smooth face masks (hair, brows, lips, lashes) from anatomical landmarks.
  const eyeZ = (eyes[0].head[2] + eyes[1].head[2]) / 2;
  const eyeX = Math.abs(eyes[0].head[0]);
  const C = [0, eyeY + 0.02, eyeZ - 0.085];
  let headR = 0, headN = 0;
  let nose = [0, 0, -1];
  for (let i = 0; i < n; i++) {
    const vi = src[i];
    const w = vw[vi].get("head") ?? 0;
    if (w < 0.6) continue;
    const p = [pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]];
    if (Math.abs(p[0]) < 0.006 && p[1] < eyeY && p[1] > eyeY - 0.06 && p[2] > nose[2]) nose = p;
    if (p[1] > eyeY + 0.04) { headR += Math.hypot(p[0] - C[0], p[1] - C[1], p[2] - C[2]); headN++; }
  }
  headR /= Math.max(1, headN);
  const mouth = [0, nose[1] - 0.033, nose[2] - 0.012];
  const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  const lerp = (a, b, t) => a + (b - a) * t;
  // Hairline elevation (degrees above the head centre's horizontal) by azimuth from the face.
  const hairline = (az) => {
    const a = Math.abs(az);
    const pts = [[0, 30], [20, 29], [40, 24], [60, 14], [80, 3], [100, -6], [125, -22], [150, -36], [180, -42]];
    for (let k = 1; k < pts.length; k++) if (a <= pts[k][0]) return lerp(pts[k - 1][1], pts[k][1], (a - pts[k - 1][0]) / (pts[k][0] - pts[k - 1][0]));
    return -40;
  };
  const faceMask = new Uint8Array(n * 4);
  for (let i = 0; i < n; i++) {
    const vi = src[i];
    const hw = (vw[vi].get("head") ?? 0) + (vw[vi].get("jaw") ?? 0) + (vw[vi].get("neck03") ?? 0) * 0.5;
    if (hw < 0.3) continue;
    const p = [pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]];
    const d = [p[0] - C[0], p[1] - C[1], p[2] - C[2]];
    const dist = Math.hypot(...d);
    const elev = (Math.asin(d[1] / dist) * 180) / Math.PI;
    const az = (Math.atan2(d[0], d[2]) * 180) / Math.PI;
    // Ears stick out sideways at eye height: excluded. Everything else on the skull can carry hair.
    const ear = smooth(headR * 1.0, headR * 1.07, dist) * smooth(55, 70, Math.abs(az)) * (1 - smooth(115, 130, Math.abs(az))) * (1 - smooth(10, 18, elev));
    const onSkull = (1 - smooth(headR * 1.16, headR * 1.25, dist)) * (1 - ear);
    const hair = smooth(hairline(az) - 3.5, hairline(az) + 3.5, elev) * onSkull;
    // Brows: arched bands above each eye, front only.
    const bx = (Math.abs(p[0]) - (eyeX + 0.004)) / 0.023;
    const archY = eyeY + 0.026 - 0.006 * bx * bx;
    const brow = (1 - smooth(0.85, 1.05, Math.abs(bx))) * (1 - smooth(0.0028, 0.0052, Math.abs(p[1] - archY))) * smooth(eyeZ - 0.03, eyeZ - 0.01, p[2]);
    // Upper lash line.
    const lx = (Math.abs(p[0]) - eyeX) / 0.015;
    const lash = (1 - smooth(0.8, 1.05, Math.abs(lx))) * (1 - smooth(0.0012, 0.003, Math.abs(p[1] - (eyeY + 0.007 - 0.004 * lx * lx)))) * smooth(eyeZ - 0.005, eyeZ + 0.008, p[2]);
    // Lips: an ellipse around the mouth, frontal.
    const le = Math.hypot(p[0] / 0.025, (p[1] - mouth[1]) / 0.0115);
    const lip = (1 - smooth(0.8, 1.08, le)) * smooth(mouth[2] - 0.022, mouth[2] - 0.008, p[2]);
    faceMask.set([hair * 255, brow * 255, lip * 255, lash * 255].map(Math.round), i * 4);
  }

  const morphDelta = (P) => {
    const out = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const a = toM(P[src[i]]), b = [pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]];
      for (let k = 0; k < 3; k++) out[i * 3 + k] = a[k] - b[k];
    }
    return out;
  };
  const b64 = (arr) => Buffer.from(arr.buffer, arr.byteOffset, arr.byteLength).toString("base64");

  // -------------------------------------------------------------------------
  // Garment shells: welded copies of the body surface for a set of regions,
  // Taubin-smoothed (so anatomy disappears under fabric) and pushed out along
  // the normal. They share the body's skeleton and morphs.
  const regionV = new Int8Array(V.length).fill(-1);
  for (let i = 0; i < n; i++) regionV[src[i]] = region[i];
  const chestY = heads.get("upperarm01.L")[1] - 0.1;
  const kneeY = heads.get("lowerleg01.L")[1];
  const ankleY = heads.get("foot.L")[1];
  const shoulderX = Math.abs(heads.get("upperarm01.L")[0]);
  // Fabric doesn't follow anatomy: shirts fall straight from the chest, sleeves
  // open towards the cuff, trousers hang as tubes from hip to ankle.
  const DRAPE = {
    top(S, R) {
      const chest = S.filter((p, i) => R[i] === 1 && Math.abs(p[1] - chestY) < 0.025 && Math.abs(p[0]) < shoulderX * 0.85);
      if (!chest.length) return S;
      const a = Math.max(...chest.map((p) => Math.abs(p[0]))) * 1.04;
      const zmin = Math.min(...chest.map((p) => p[2])), zmax = Math.max(...chest.map((p) => p[2]));
      const zc = (zmin + zmax) / 2, b = (zmax - zmin) / 2 * 1.06;
      return S.map((p, i) => {
        if (R[i] === 1 && p[1] < chestY && Math.abs(p[0]) < a * 1.2) {
          const t = Math.min(1, (chestY - p[1]) / 0.12);
          const s = 1 / Math.sqrt((p[0] / a) ** 2 + ((p[2] - zc) / b) ** 2);
          if (s > 1) { const k = 0.85 * t; return [p[0] * (1 + (s - 1) * k), p[1], zc + (p[2] - zc) * (1 + (s - 1) * k)]; }
        }
        if (R[i] === 2) {
          // Sleeves open up towards the hem: push away from the shoulder→elbow axis.
          const side = Math.sign(p[0]) || 1;
          const sh = heads.get("upperarm01.L"), el = heads.get("lowerarm01.L");
          const A = [sh[0] * side, sh[1], sh[2]], B = [el[0] * side, el[1], el[2]];
          const ax = [B[0] - A[0], B[1] - A[1], B[2] - A[2]], al = Math.hypot(...ax);
          const u = ax.map((x) => x / al);
          const rel = [p[0] - A[0], p[1] - A[1], p[2] - A[2]];
          const along = rel[0] * u[0] + rel[1] * u[1] + rel[2] * u[2];
          if (along <= 0) return p;
          const c = A.map((x, k) => x + u[k] * along);
          const k = 1 + Math.min(0.32, (along / al) * 0.5);
          return p.map((x, j) => c[j] + (x - c[j]) * k);
        }
        return p;
      });
    },
    legs(S, R) {
      // Per leg: centre line from hip to ankle; push each ring out to a smooth tube radius.
      const hipY = heads.get("upperleg01.L")[1];
      return S.map((p) => {
        if (p[1] > hipY - 0.04) return p;
        const side = Math.sign(p[0]) || 1;
        const t = Math.min(1, Math.max(0, (hipY - p[1]) / (hipY - ankleY)));
        const hx = heads.get("upperleg01.L")[0] * side, fx = heads.get("foot.L")[0] * side;
        const cx = hx + (fx - hx) * t;
        const kz = heads.get("upperleg01.L")[2] + (heads.get("foot.L")[2] - heads.get("upperleg01.L")[2]) * t;
        const dx = p[0] - cx, dz = p[2] - kz;
        const r = Math.hypot(dx, dz) || 1;
        // Tube radius tapers from thigh to a straight-cut hem; never tighter than the body.
        const target = 0.085 - 0.03 * t + (p[1] < kneeY ? 0.008 : 0);
        const nr = Math.max(r, target * 0.6 + r * 0.4);
        return [cx + (dx / r) * nr, p[1], kz + (dz / r) * nr];
      });
    },
  };
  function makeShell(set, offset, iterations, tile, drape) {
    // Faces touching the region (not only inside it): garments overlap at hems, so no gaps show.
    const sf = faces.filter((f) => f.some(([vi]) => set.has(regionV[vi])));
    const used = [...new Set(sf.flatMap((f) => f.map(([vi]) => vi)))];
    const local = new Map(used.map((vi, i) => [vi, i]));
    const m = used.length;
    const nb = Array.from({ length: m }, () => new Set());
    const tris = [];
    for (const f of sf) {
      const ids = f.map(([vi]) => local.get(vi));
      for (let k = 0; k < ids.length; k++) { nb[ids[k]].add(ids[(k + 1) % ids.length]); nb[ids[(k + 1) % ids.length]].add(ids[k]); }
      for (let k = 1; k + 1 < ids.length; k++) tris.push(ids[0], ids[k], ids[k + 1]);
    }
    const smooth = (P0) => {
      let P = P0.map((p) => p.slice());
      const step = (P, lam) => P.map((p, i) => {
        const ns = [...nb[i]];
        if (!ns.length) return p;
        const c = [0, 0, 0];
        for (const j of ns) for (let k = 0; k < 3; k++) c[k] += P[j][k] / ns.length;
        return p.map((x, k) => x + lam * (c[k] - x));
      });
      for (let it = 0; it < iterations; it++) P = step(step(P, 0.5), -0.53);
      return P;
    };
    const normalsOf = (P) => {
      const N = Array.from({ length: m }, () => [0, 0, 0]);
      for (let t = 0; t < tris.length; t += 3) {
        const [a, b, c] = [P[tris[t]], P[tris[t + 1]], P[tris[t + 2]]];
        const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
        const cr = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
        for (const id of [tris[t], tris[t + 1], tris[t + 2]]) for (let k = 0; k < 3; k++) N[id][k] += cr[k];
      }
      return N.map((x) => { const l = Math.hypot(...x) || 1; return x.map((y) => y / l); });
    };
    const shape = (Pfull) => {
      const S = smooth(used.map((vi) => toM(Pfull[vi])));
      const N = normalsOf(S);
      const O = S.map((p, i) => p.map((x, k) => x + N[i][k] * offset));
      return drape ? drape(O, used.map((vi) => regionV[vi])) : O;
    };
    const basePos = shape(base);
    const out = { vertexCount: m };
    out.position = b64(new Float32Array(basePos.flat()));
    // Cylindrical fabric mapping (around each leg below the crotch, around the body above).
    const crotchY = heads.get("upperleg01.L")[1] - 0.06;
    const uvs = new Float32Array(m * 2);
    basePos.forEach((p, i) => {
      const cx = p[1] < crotchY ? Math.sign(p[0]) * 0.09 : 0;
      const ang = Math.atan2(p[0] - cx, p[2]);
      const radius = p[1] < crotchY ? 0.07 : 0.15;
      uvs[i * 2] = (ang * radius) / tile;
      uvs[i * 2 + 1] = p[1] / tile;
    });
    out.uv = b64(uvs);
    out.index = b64(new Uint16Array(tris));
    const si = new Uint8Array(m * 4), sw = new Uint8Array(m * 4);
    used.forEach((vi, i) => {
      const list = [...vw[vi]].sort((a, b) => b[1] - a[1]).slice(0, 4);
      const total = list.reduce((s, x) => s + x[1], 0) || 1;
      let acc = 0;
      list.forEach(([b, w], k) => {
        si[i * 4 + k] = boneIndex.get(b);
        const q = k === list.length - 1 ? 255 - acc : Math.round((w / total) * 255);
        sw[i * 4 + k] = q;
        acc += q;
      });
      if (!list.length) sw[i * 4] = 255;
    });
    out.skinIndex = b64(si);
    out.skinWeight = b64(sw);
    out.morphs = Object.fromEntries(Object.entries(morphs).map(([k, P]) => {
      const S = shape(P);
      return [k, b64(new Float32Array(S.flatMap((p, i) => p.map((x, j) => x - basePos[i][j]))))];
    }));
    return out;
  }
  const shells = {
    top: makeShell(new Set([1, 2]), 0.012, 14, 0.12, DRAPE.top),
    shorts: makeShell(new Set([3]), 0.012, 14, 0.12, DRAPE.legs),
    shins: makeShell(new Set([6]), 0.012, 12, 0.12, DRAPE.legs),
    shoes: makeShell(new Set([4]), 0.012, 14, 0.2),
  };
  const hips = { waistY: waistY, kneeY: heads.get("lowerleg01.L")[1], hipHalfWidth: Math.max(...pos.filter((_, i) => i % 3 === 0 && region[Math.floor(i / 3)] === 3)) };
  return {
    license: "Derived from MakeHuman assets (CC0 1.0). Base mesh, targets, skeleton and weights © MakeHuman team, released CC0.",
    gender,
    vertexCount: n,
    bones: order.map((b) => ({ name: b, parent: (() => { let p = sk.bones[b].parent; while (p && !KEEP.has(p)) p = sk.bones[p].parent; return p ? boneIndex.get(p) : -1; })(), head: heads.get(b).map((v) => +v.toFixed(5)) })),
    eyes,
    height: +(Math.max(...pos.filter((_, i) => i % 3 === 1))).toFixed(4),
    position: b64(new Float32Array(pos)),
    uv: b64(new Float32Array(uv)),
    normal: b64(normal),
    faceMask: b64(faceMask),
    index: b64(new Uint16Array(idx)),
    skinIndex: b64(skinIndex),
    skinWeight: b64(skinWeight),
    region: b64(region),
    morphs: Object.fromEntries(Object.entries(morphs).map(([k, P]) => [k, b64(morphDelta(P))])),
    shells,
    hips,
    arm: { shoulder: heads.get("upperarm01.L"), elbow: heads.get("lowerarm01.L"), wrist: heads.get("wrist.L") },
    leg: { hip: heads.get("upperleg01.L"), knee: heads.get("lowerleg01.L"), foot: heads.get("foot.L") },
  };
}

mkdirSync("public/humans", { recursive: true });
for (const g of ["male", "female"]) {
  const out = build(g);
  if (out.vertexCount > 65535) throw new Error("too many vertices for 16-bit indices");
  writeFileSync(`public/humans/${g}.json`, JSON.stringify(out));
  console.log(`${g}: ${out.vertexCount} verts, ${out.bones.length} bones, height ${out.height} m`);
}
