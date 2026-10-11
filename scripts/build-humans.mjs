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
  for (const line of readFileSync(join(DATA, "targets/macrodetails", name + ".target"), "utf8").split("\n")) {
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
// Build one gender.

function build(gender) {
  const base0 = apply(V, readTarget(`african-${gender}-young`), 1);
  const base = apply(base0, readTarget(`universal-${gender}-young-averagemuscle-averageweight`), 1);
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
  const mouth = toM(jointPos(sk.bones["oris01"].head));
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
      const dm = Math.hypot(x - mouth[0], (y - mouth[1]) * 1.6, z - mouth[2]);
      if (dom !== "neck01" && dom !== "neck02" && dom !== "neck03") {
        if (y > eyeY + 0.032 || (y > eyeY - 0.02 && z < headP[2] - 0.03) || (y > eyeY - 0.055 && z < headP[2] - 0.06 && Math.abs(x) > 0.045)) r = 5;
        else if (y > eyeY + 0.012 && y < eyeY + 0.03 && z > headP[2] + 0.06 && Math.abs(Math.abs(x) - Math.abs(eyes[0].head[0])) < 0.028) r = 8;
        else if (dm < 0.024 && z > mouth[2] - 0.01) r = 7;
      }
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
  function makeShell(set, offset, iterations, tile) {
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
      return S.map((p, i) => p.map((x, k) => x + N[i][k] * offset));
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
    top: makeShell(new Set([1, 2]), 0.009, 10, 0.12),
    shorts: makeShell(new Set([3]), 0.008, 8, 0.12),
    shins: makeShell(new Set([6]), 0.007, 6, 0.12),
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
    index: b64(new Uint16Array(idx)),
    skinIndex: b64(skinIndex),
    skinWeight: b64(skinWeight),
    region: b64(region),
    morphs: Object.fromEntries(Object.entries(morphs).map(([k, P]) => [k, b64(morphDelta(P))])),
    shells,
    hips,
    arm: { shoulder: heads.get("upperarm01.L"), elbow: heads.get("lowerarm01.L"), wrist: heads.get("wrist.L") },
  };
}

mkdirSync("public/humans", { recursive: true });
for (const g of ["male", "female"]) {
  const out = build(g);
  if (out.vertexCount > 65535) throw new Error("too many vertices for 16-bit indices");
  writeFileSync(`public/humans/${g}.json`, JSON.stringify(out));
  console.log(`${g}: ${out.vertexCount} verts, ${out.bones.length} bones, height ${out.height} m`);
}
