// Realistic people: skinned human bodies baked from MakeHuman CC0 assets
// (African young adult male/female), with procedural skin and clothing
// shading, eyes, hair and a bone-driven walk cycle.
import * as THREE from "three";
import { fabric } from "./textures.ts";
import type { PersonLook } from "./people.ts";

interface HumanAsset {
  gender: "male" | "female";
  vertexCount: number;
  bones: { name: string; parent: number; head: [number, number, number] }[];
  eyes: { head: [number, number, number]; tail: [number, number, number] }[];
  height: number;
  position: string;
  normal: string;
  uv: string;
  index: string;
  skinIndex: string;
  skinWeight: string;
  region: string;
  morphs: Record<"muscle" | "heavy" | "slim", string>;
  shells: Record<"top" | "shorts" | "shins" | "shoes", ShellAsset>;
  hips: { waistY: number; kneeY: number; hipHalfWidth: number };
  arm: { shoulder: number[]; elbow: number[]; wrist: number[] };
}

interface ShellAsset {
  vertexCount: number;
  position: string;
  uv: string;
  index: string;
  skinIndex: string;
  skinWeight: string;
  morphs: Record<"muscle" | "heavy" | "slim", string>;
}

interface Template {
  asset: HumanAsset;
  geometry: THREE.BufferGeometry;
  shells: Record<"top" | "shorts" | "shins" | "shoes", THREE.BufferGeometry>;
  headCenter: THREE.Vector3;
  headRadius: number;
}

const templates: Partial<Record<"male" | "female", Template>> = {};
let loading: Promise<boolean> | null = null;

const bytes = (b64: string) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
const f32 = (b64: string) => new Float32Array(bytes(b64).buffer);

function makeTemplate(a: HumanAsset): Template {
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(f32(a.position), 3));
  g.setAttribute("normal", new THREE.BufferAttribute(f32(a.normal), 3));
  g.setAttribute("uv", new THREE.BufferAttribute(f32(a.uv), 2));
  g.setIndex(new THREE.BufferAttribute(new Uint16Array(bytes(a.index).buffer), 1));
  g.setAttribute("skinIndex", new THREE.Uint8BufferAttribute(bytes(a.skinIndex), 4));
  g.setAttribute("skinWeight", new THREE.Uint8BufferAttribute(bytes(a.skinWeight), 4, true));
  g.setAttribute("region", new THREE.Float32BufferAttribute(Float32Array.from(bytes(a.region)), 1));
  g.morphAttributes.position = (["muscle", "heavy", "slim"] as const).map((k) => new THREE.BufferAttribute(f32(a.morphs[k]), 3));
  g.morphTargetsRelative = true;
  g.computeBoundingSphere();
  const shell = (sa: ShellAsset) => {
    const sg = new THREE.BufferGeometry();
    sg.setAttribute("position", new THREE.BufferAttribute(f32(sa.position), 3));
    sg.setAttribute("uv", new THREE.BufferAttribute(f32(sa.uv), 2));
    sg.setIndex(new THREE.BufferAttribute(new Uint16Array(bytes(sa.index).buffer), 1));
    sg.setAttribute("skinIndex", new THREE.Uint8BufferAttribute(bytes(sa.skinIndex), 4));
    sg.setAttribute("skinWeight", new THREE.Uint8BufferAttribute(bytes(sa.skinWeight), 4, true));
    sg.morphAttributes.position = (["muscle", "heavy", "slim"] as const).map((k) => new THREE.BufferAttribute(f32(sa.morphs[k]), 3));
    sg.morphTargetsRelative = true;
    sg.computeVertexNormals();
    return sg;
  };
  const shells = { top: shell(a.shells.top), shorts: shell(a.shells.shorts), shins: shell(a.shells.shins), shoes: shell(a.shells.shoes) };
  const e = a.eyes[0].head;
  return { asset: a, geometry: g, shells, headCenter: new THREE.Vector3(0, e[1] + 0.01, e[2] - 0.075), headRadius: 0.1 };
}

/** Fetch the baked bodies once. Resolves false if they aren't available (falls back to stylised people). */
export function loadHumans(): Promise<boolean> {
  loading ??= (async () => {
    try {
      const [m, f] = await Promise.all(["male", "female"].map(async (g) => {
        const res = await fetch(new URL(`humans/${g}.json`, document.baseURI));
        if (!res.ok) throw new Error(String(res.status));
        return (await res.json()) as HumanAsset;
      }));
      templates.male = makeTemplate(m);
      templates.female = makeTemplate(f);
      return true;
    } catch {
      return false;
    }
  })();
  return loading;
}

export const humansReady = () => !!templates.male && !!templates.female;

// ---------------------------------------------------------------------------
// Material: one shader colours skin, clothes, shoes, hair, lips and brows by region.

const fabricCache = new Map<string, THREE.Texture>();
function fabricTex(pattern: string, color: string) {
  const k = `${pattern}:${color}`;
  let t = fabricCache.get(k);
  if (!t) {
    t = fabric(pattern as "plain", color);
    fabricCache.set(k, t);
  }
  return t;
}

function personMaterial(look: PersonLook, skirt: boolean, hide: { top: boolean; legs: boolean; feet: boolean }) {
  const m = new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 0.6, metalness: 0 });
  const skin = new THREE.Color(look.skin);
  const pattern = look.pattern ?? "plain";
  const uniforms = {
    uSkin: { value: skin },
    uShirtTex: { value: fabricTex(pattern, look.shirt) },
    uPantsTex: { value: fabricTex(skirt ? pattern : "plain", look.pants) },
    uShoe: { value: new THREE.Color(look.feminine ? "#3a2318" : "#1b1b1d") },
    uHair: { value: new THREE.Color(look.hair) },
    uLips: { value: skin.clone().multiplyScalar(0.62).lerp(new THREE.Color("#5a2a2a"), 0.25) },
    uShortHair: { value: look.hairStyle === "wrap" || look.hairStyle === "cap" ? 0 : 1 },
    uSkirt: { value: skirt ? 1 : 0 },
    uHideTop: { value: hide.top ? 1 : 0 },
    uHideLegs: { value: hide.legs ? 1 : 0 },
    uHideFeet: { value: hide.feet ? 1 : 0 },
  };
  m.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nattribute float region;\nflat varying float vRegion;\nvarying vec2 vUv2;\nvarying vec3 vObjPos;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvRegion = region;\nvUv2 = uv;\nvObjPos = position;");
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
flat varying float vRegion;
varying vec2 vUv2;
varying vec3 vObjPos;
uniform vec3 uSkin; uniform sampler2D uShirtTex; uniform sampler2D uPantsTex; uniform vec3 uShoe; uniform vec3 uHair; uniform vec3 uLips;
uniform float uShortHair; uniform float uSkirt; uniform float uHideTop; uniform float uHideLegs; uniform float uHideFeet;
float hHash(vec3 p) { return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }`,
      )
      .replace(
        "#include <color_fragment>",
        `#include <color_fragment>
float rg = floor(vRegion + 0.5);
// Skin under garments is hidden so it never pokes through the cloth.
if ((uHideTop > 0.5 && (rg == 1.0 || rg == 2.0)) || (uHideLegs > 0.5 && (rg == 3.0 || rg == 6.0)) || (uHideFeet > 0.5 && rg == 4.0)) discard;
vec3 c = uSkin;
float rough = 0.52;
// Subtle pore-level variation keeps skin from looking like plastic.
c *= 0.94 + 0.08 * hHash(floor(vObjPos * 900.0));
vec2 cuv = vUv2 * 9.0;
if (rg == 1.0 || rg == 2.0) { c = uSkin; }
else if (rg == 3.0 || rg == 6.0) { c = uSkin * (0.94 + 0.08 * hHash(floor(vObjPos * 900.0))); }
else if (rg == 4.0) { c = uShoe; rough = 0.35; }
else if (rg == 5.0) { if (uShortHair > 0.5) { c = uHair * (0.75 + 0.5 * hHash(floor(vObjPos * 2400.0))); rough = 0.95; } }
else if (rg == 7.0) { c = uLips; rough = 0.38; }
else if (rg == 8.0) { c = mix(uSkin, uHair, 0.75); rough = 0.95; }
diffuseColor.rgb = c;`,
      )
      .replace("#include <roughnessmap_fragment>", "#include <roughnessmap_fragment>\nroughnessFactor = rough;");
  };
  m.customProgramCacheKey = () => "sika-human";
  return m;
}

/** Cloth with a triplanar-projected pattern: no UV seams, pattern scale in real centimetres. */
function fabricMaterial(tex: THREE.Texture) {
  const m = new THREE.MeshStandardMaterial({ roughness: 0.92, side: THREE.DoubleSide });
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uFabric = { value: tex };
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vRest;\nvarying vec3 vRestN;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvRest = position;\nvRestN = normal;");
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vRest;\nvarying vec3 vRestN;\nuniform sampler2D uFabric;")
      .replace(
        "#include <color_fragment>",
        `#include <color_fragment>
vec3 w = pow(abs(normalize(vRestN)), vec3(4.0));
w /= (w.x + w.y + w.z);
float sc = 8.0;
vec3 fab = texture2D(uFabric, vRest.zy * sc).rgb * w.x + texture2D(uFabric, vRest.xz * sc).rgb * w.y + texture2D(uFabric, vRest.xy * sc).rgb * w.z;
diffuseColor.rgb = fab;`,
      );
  };
  m.customProgramCacheKey = () => "sika-fabric";
  return m;
}

// ---------------------------------------------------------------------------
// A person

export interface HumanRig {
  root: THREE.Group;
  mesh: THREE.SkinnedMesh;
  bones: Record<string, THREE.Bone>;
  rest: Record<string, THREE.Euler>;
  armDrop: number;
  forearmFix: number;
  body: THREE.Group;
  phase: number;
  speed: number;
  talk: number;
  carry: boolean;
  real: true;
}

const eyeWhite = new THREE.MeshStandardMaterial({ color: "#efe9df", roughness: 0.15 });
const iris = new THREE.MeshStandardMaterial({ color: "#2a160c", roughness: 0.1 });
const eyeGeo = new THREE.SphereGeometry(0.0118, 16, 12);
const irisGeo = new THREE.CircleGeometry(0.0062, 16);

export function buildHuman(look: PersonLook): HumanRig | null {
  const t = templates[look.feminine ? "female" : "male"];
  if (!t) return null;
  const a = t.asset;
  const bones: THREE.Bone[] = a.bones.map((b) => {
    const bone = new THREE.Bone();
    bone.name = b.name;
    return bone;
  });
  a.bones.forEach((b, i) => {
    const h = new THREE.Vector3(...b.head);
    if (b.parent >= 0) {
      const ph = new THREE.Vector3(...a.bones[b.parent].head);
      bones[i].position.copy(h.sub(ph));
      bones[b.parent].add(bones[i]);
    } else bones[i].position.copy(h);
  });
  const skirt = look.feminine && (look.pattern ?? "plain") !== "plain";
  const mesh = new THREE.SkinnedMesh(t.geometry, personMaterial(look, skirt, { top: true, legs: !skirt, feet: true }));
  mesh.add(bones[0]);
  const skeleton = new THREE.Skeleton(bones);
  mesh.bind(skeleton);
  mesh.castShadow = true;
  mesh.frustumCulled = false;
  const body = new THREE.Group();
  body.add(mesh);
  // Garments: separate skinned layers sharing the skeleton.
  const garments: THREE.SkinnedMesh[] = [];
  const dress = (geo: THREE.BufferGeometry, mat: THREE.Material) => {
    const g = new THREE.SkinnedMesh(geo, mat);
    g.bind(skeleton, mesh.bindMatrix);
    g.castShadow = true;
    g.frustumCulled = false;
    body.add(g);
    garments.push(g);
  };
  const cloth = (pattern: string, color: string) => fabricMaterial(fabricTex(pattern, color));
  dress(t.shells.top, cloth(look.pattern ?? "plain", look.shirt));
  if (!skirt) {
    const pm = cloth("plain", look.pants);
    dress(t.shells.shorts, pm);
    dress(t.shells.shins, pm);
  } else {
    // A flared wrapper skirt from waist to just below the knee.
    const h = a.hips;
    const r0 = h.hipHalfWidth * 0.86, r1 = h.hipHalfWidth * 1.08;
    const prof = [new THREE.Vector2(r0 * 0.9, h.waistY + 0.03), new THREE.Vector2(r0 * 1.12, h.waistY - 0.12), new THREE.Vector2(r1, h.kneeY - 0.06)];
    const skirtTex = fabricTex(look.pattern ?? "wax", look.pants).clone();
    skirtTex.repeat.set(7, 3);
    skirtTex.needsUpdate = true;
    const sk = new THREE.Mesh(new THREE.LatheGeometry(prof, 28), new THREE.MeshStandardMaterial({ map: skirtTex, roughness: 0.9, side: THREE.DoubleSide }));
    sk.scale.set(1, 1, 0.82);
    sk.castShadow = true;
    body.add(sk);
  }
  const shoeColors = look.feminine ? ["#6b3a22", "#1c1c1e", "#b08d57", "#c8452c"] : ["#f2f2ef", "#1b1b1d", "#5b3a29", "#2e4a6b"];
  const shoeColor = shoeColors[(look.shirt.charCodeAt(1) + look.pants.charCodeAt(2)) % shoeColors.length];
  dress(t.shells.shoes, new THREE.MeshStandardMaterial({ color: shoeColor, roughness: 0.45 }));
  // Body type from the build slider.
  const build = look.build;
  const influences = [
    Math.max(0, (build - 1) * 2.2) * (look.feminine ? 0.5 : 1),
    Math.max(0, (build - 1.05) * 3),
    Math.max(0, (1 - build) * 4),
  ];
  for (const m of [mesh, ...garments]) m.morphTargetInfluences = [...influences];
  const root = new THREE.Group();
  root.add(body);
  body.scale.setScalar(look.height / a.height);
  const byName: Record<string, THREE.Bone> = Object.fromEntries(bones.map((b) => [b.name, b]));
  const head = byName.head;
  const headWorld = new THREE.Vector3(...a.bones.find((b) => b.name === "head")!.head);
  const local = (v: THREE.Vector3) => v.clone().sub(headWorld);

  // Eyes with brown irises, looking forward.
  for (const e of a.eyes) {
    const c = new THREE.Vector3(...e.head);
    const ball = new THREE.Mesh(eyeGeo, eyeWhite);
    ball.position.copy(local(c));
    head.add(ball);
    const ir = new THREE.Mesh(irisGeo, iris);
    ir.position.copy(local(c)).add(new THREE.Vector3(0, 0, 0.0116));
    head.add(ir);
  }
  addHair(look, head, local(t.headCenter), t.headRadius);
  const rest = Object.fromEntries(bones.map((b) => [b.name, b.rotation.clone()]));
  // Arms hang from the A-pose: rotate the upper arms down towards the body.
  const ua = a.bones.find((b) => b.name === "upperarm01.L")!.head, la = a.bones.find((b) => b.name === "lowerarm01.L")!.head;
  const armDrop = Math.atan2(la[0] - ua[0], ua[1] - la[1]) - 0.12;
  // The A-pose forearms point forward; this brings them down to hang naturally.
  const forearmFix = Math.atan2(a.arm.wrist[2] - a.arm.elbow[2], a.arm.elbow[1] - a.arm.wrist[1]) - 0.18;
  return { root, mesh, body, bones: byName, rest, armDrop, forearmFix, phase: Math.random() * 10, speed: 0, talk: 0, carry: look.carry === "tray", real: true };
}

const hairMats = new Map<string, THREE.Material>();
function hairMat(c: string) {
  let m = hairMats.get(c);
  if (!m) {
    m = new THREE.MeshStandardMaterial({ color: c, roughness: 0.95 });
    hairMats.set(c, m);
  }
  return m;
}

function addHair(look: PersonLook, head: THREE.Bone, center: THREE.Vector3, r: number) {
  const m = hairMat(look.hair);
  const add = (geo: THREE.BufferGeometry, mat: THREE.Material, pos: THREE.Vector3, scale: [number, number, number], rot: [number, number, number] = [0, 0, 0]) => {
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.copy(pos);
    mesh.scale.set(...scale);
    mesh.rotation.set(...rot);
    mesh.castShadow = true;
    head.add(mesh);
    return mesh;
  };
  const sphere = new THREE.SphereGeometry(1, 24, 16);
  const style = look.headwear === "headwrap" ? "wrap" : look.headwear === "cap" ? "cap" : look.hairStyle ?? "low";
  switch (style) {
    case "afro": {
      const g = new THREE.IcosahedronGeometry(1, 4);
      const p = g.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < p.count; i++) {
        const v = new THREE.Vector3().fromBufferAttribute(p, i);
        v.multiplyScalar(1 + (Math.sin(v.x * 23) * Math.sin(v.y * 19) * Math.sin(v.z * 29)) * 0.035);
        p.setXYZ(i, v.x, v.y, v.z);
      }
      g.computeVertexNormals();
      add(g, m, center.clone().add(new THREE.Vector3(0, r * 0.38, -r * 0.18)), [r * 1.32, r * 1.18, r * 1.3]);
      break;
    }
    case "bun":
      add(sphere, m, center.clone().add(new THREE.Vector3(0, r * 0.95, -r * 0.55)), [r * 0.5, r * 0.45, r * 0.5]);
      break;
    case "braids":
    case "locs": {
      const strand = new THREE.CylinderGeometry(1, 0.8, 1, 6);
      const n = style === "braids" ? 18 : 22;
      for (let i = 0; i < n; i++) {
        const ang = Math.PI * 0.62 + (i / (n - 1)) * Math.PI * 0.76 + (i % 2) * 0.04;
        const len = style === "braids" ? r * 3.2 : r * 2.1;
        const base = center.clone().add(new THREE.Vector3(Math.sin(ang) * r * 0.97, r * 0.35, -Math.cos(ang) * r * 0.97 * -1));
        const s = add(strand, m, base.clone().add(new THREE.Vector3(Math.sin(ang) * r * 0.08, -len / 2, Math.cos(ang) * -r * 0.05)), [r * (style === "braids" ? 0.075 : 0.11), len, r * (style === "braids" ? 0.075 : 0.11)]);
        s.rotation.z = Math.sin(ang) * 0.12;
        s.rotation.x = -0.1;
      }
      break;
    }
    case "wrap": {
      const cloth = new THREE.MeshStandardMaterial({ map: fabricTex("wax", look.shirt), roughness: 0.9 });
      add(sphere, cloth, center.clone().add(new THREE.Vector3(0, r * 0.42, -r * 0.08)), [r * 1.12, r * 0.95, r * 1.18]);
      add(new THREE.TorusGeometry(1, 0.35, 10, 24), cloth, center.clone().add(new THREE.Vector3(0, r * 1.25, -r * 0.1)), [r * 0.7, r * 0.7, r * 0.85], [Math.PI / 2.3, 0, 0]);
      break;
    }
    case "cap": {
      const capM = new THREE.MeshStandardMaterial({ color: look.pants, roughness: 0.75 });
      add(new THREE.SphereGeometry(1, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), capM, center.clone().add(new THREE.Vector3(0, r * 0.28, -r * 0.05)), [r * 1.06, r * 0.95, r * 1.1]);
      add(new THREE.CylinderGeometry(1, 1, 1, 24, 1, false, -Math.PI / 2, Math.PI), capM, center.clone().add(new THREE.Vector3(0, r * 0.3, r * 0.75)), [r * 0.95, r * 0.04, r * 0.7], [0, Math.PI, 0]);
      break;
    }
    default:
      break; // low cut: painted on the scalp by the skin shader
  }
}

/** Bone-driven walk/idle. speed in m/s. */
export function animateHuman(r: HumanRig, dt: number, speed: number) {
  r.speed += (speed - r.speed) * Math.min(1, dt * 8);
  const v = r.speed;
  const walking = v > 0.15;
  r.phase += dt * (walking ? 2.3 + v * 1.55 : 1.1);
  const ph = r.phase;
  const B = r.bones;
  const amp = Math.min(0.62, 0.22 + v * 0.16);
  const s = Math.sin(ph);
  const set = (name: string, x: number, y = 0, z = 0) => {
    const b = B[name];
    if (b) b.rotation.set(x, y, z);
  };
  const drop = r.armDrop;
  if (walking) {
    set("upperleg01.L", -s * amp, 0, 0);
    set("upperleg01.R", s * amp, 0, 0);
    set("lowerleg01.L", Math.max(0, Math.cos(ph)) * amp * 1.4);
    set("lowerleg01.R", Math.max(0, -Math.cos(ph)) * amp * 1.4);
    set("foot.L", -Math.max(0, Math.cos(ph)) * amp * 0.5 + s * 0.15);
    set("foot.R", -Math.max(0, -Math.cos(ph)) * amp * 0.5 - s * 0.15);
    set("spine03", 0.04 + v * 0.015, s * 0.08, 0);
    set("pelvis.L", 0, -s * 0.05, 0);
    if (!r.carry) {
      set("upperarm01.L", s * amp * 0.75, 0, -drop);
      set("upperarm01.R", -s * amp * 0.75, 0, drop);
      set("lowerarm01.L", r.forearmFix - 0.25 - Math.max(0, -s) * 0.45);
      set("lowerarm01.R", r.forearmFix - 0.25 - Math.max(0, s) * 0.45);
    }
    r.body.position.y = Math.abs(Math.cos(ph)) * 0.03 - 0.012;
  } else {
    const br = Math.sin(ph * 1.2);
    for (const n of ["upperleg01.L", "upperleg01.R", "lowerleg01.L", "lowerleg01.R", "foot.L", "foot.R"]) B[n]?.rotation.set(B[n].rotation.x * 0.85, 0, 0);
    set("spine03", 0.015 + br * 0.01, Math.sin(ph * 0.3) * 0.05, 0);
    set("neck02", br * 0.01, Math.sin(ph * 0.4) * 0.22, 0);
    if (!r.carry) {
      const t = r.talk > 0 ? Math.sin(ph * 3) * 0.3 : 0;
      set("upperarm01.L", br * 0.03, 0, -drop);
      set("upperarm01.R", -br * 0.03 - (r.talk > 0 ? 0.5 + t : 0), 0, drop - (r.talk > 0 ? 0.2 : 0));
      set("lowerarm01.L", r.forearmFix - 0.08);
      set("lowerarm01.R", r.talk > 0 ? r.forearmFix - 1.2 + t * 0.4 : r.forearmFix - 0.08);
    }
    r.body.position.y *= 0.85;
  }
  if (r.carry) {
    // Hands up steadying the head tray.
    set("upperarm01.R", 0, 0, drop - 2.5);
    set("lowerarm01.R", r.forearmFix - 0.4, 0, 0);
    set("upperarm01.L", s * amp * 0.6, 0, -drop);
  }
  if (r.talk > 0) r.talk -= dt;
}

/** Attach something to the top of a person's head (vendors' trays). */
export function headTop(r: HumanRig) {
  return r.bones.head;
}
