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
  faceMask: string;
  morphs: Record<"muscle" | "heavy" | "slim", string>;
  shells: Record<"top" | "shorts" | "shins" | "shoes", ShellAsset>;
  hips: { waistY: number; kneeY: number; hipHalfWidth: number };
  arm: { shoulder: number[]; elbow: number[]; wrist: number[] };
  leg: { hip: number[]; knee: number[]; foot: number[] };
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
  g.setAttribute("faceMask", new THREE.Uint8BufferAttribute(bytes(a.faceMask), 4, true));
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
  // Physical material with a soft sheen reads more like skin than plain plastic.
  const m = new THREE.MeshPhysicalMaterial({ color: "#ffffff", roughness: 0.78, metalness: 0, sheen: 0.15, sheenRoughness: 0.9, sheenColor: new THREE.Color(look.skin).lerp(new THREE.Color("#ffb08a"), 0.5) });
  // Stylised: a touch lighter and warmer than the swatch so faces read in shade.
  const skin = new THREE.Color(look.skin).lerp(new THREE.Color("#a8653f"), 0.18);
  const pattern = look.pattern ?? "plain";
  const uniforms = {
    uSkin: { value: skin },
    uShirtTex: { value: fabricTex(pattern, look.shirt) },
    uPantsTex: { value: fabricTex(skirt ? pattern : "plain", look.pants) },
    uShoe: { value: new THREE.Color(look.feminine ? "#3a2318" : "#1b1b1d") },
    uHair: { value: new THREE.Color(look.hair) },
    uLips: { value: skin.clone().multiplyScalar(0.78).lerp(new THREE.Color("#7a3a3a"), 0.22) },
    uFem: { value: look.feminine ? 1 : 0 },
    uRows: { value: look.hairStyle === "braids" ? 1 : 0 },
    uShortHair: { value: look.hairStyle === "wrap" || look.hairStyle === "cap" ? 0 : 1 },
    uShortHairV: { value: look.hairStyle === "wrap" || look.hairStyle === "cap" ? 0 : 1 },
    uSkirt: { value: skirt ? 1 : 0 },
    uHideTop: { value: hide.top ? 1 : 0 },
    uHideLegs: { value: hide.legs ? 1 : 0 },
    uHideFeet: { value: hide.feet ? 1 : 0 },
  };
  m.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nattribute float region;\nattribute vec4 faceMask;\nflat varying float vRegion;\nvarying vec4 vFace;\nvarying vec2 vUv2;\nvarying vec3 vObjPos;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvRegion = region;\nvFace = faceMask;\nvUv2 = uv;\nvObjPos = position;\n// Hair has volume: lift the scalp where hair grows.\ntransformed += objectNormal * faceMask.x * 0.0045 * uShortHairV;")
      .replace("#include <common>\nattribute float region;", "#include <common>\nuniform float uShortHairV;\nattribute float region;");
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
flat varying float vRegion;
varying vec4 vFace;
varying vec2 vUv2;
varying vec3 vObjPos;
uniform float uFem; uniform float uRows;
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
if (rg == 0.0) {
  // Face detail: soft hairline, brows, lips and lashes.
  float grain = 0.8 + 0.4 * hHash(floor(vObjPos * 2600.0));
  // Cornrows: neat parallel braids running front to back.
  if (uRows > 0.5) grain *= 0.55 + 0.75 * smoothstep(0.15, 0.85, abs(sin(vObjPos.x * 260.0)));
  c = mix(c, uHair * grain * 0.55, smoothstep(0.0, 0.6, vFace.x) * uShortHair);
  rough = mix(rough, 0.95, vFace.x * uShortHair);
  c = mix(c, uHair, vFace.y * mix(0.7, 0.55, uFem));
  c = mix(c, uLips, vFace.z * 0.85);
  rough = mix(rough, 0.36, vFace.z);
  c = mix(c, vec3(0.03), vFace.w * mix(0.55, 0.85, uFem));
}
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
  /** The model's rest pose has the feet apart; this brings them under the hips. */
  legAdduct: number;
  body: THREE.Group;
  walkBlend?: number;
  phase: number;
  speed: number;
  talk: number;
  carry: boolean;
  real: true;
}

const eyeWhite = new THREE.MeshStandardMaterial({ color: "#f3eee6", roughness: 0.25 });
const iris = new THREE.MeshStandardMaterial({ color: "#5a3018", roughness: 0.3 });
const pupil = new THREE.MeshStandardMaterial({ color: "#0b0705", roughness: 0.2 });
const glint = new THREE.MeshBasicMaterial({ color: "#ffffff" });
const pupilGeo = new THREE.CircleGeometry(0.0036, 16);
const glintGeo = new THREE.CircleGeometry(0.0014, 8);
const eyeGeo = new THREE.SphereGeometry(0.0118, 16, 12);
const irisGeo = new THREE.CircleGeometry(0.0074, 24);

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
    // Stylised eye: warm brown iris, dark pupil and a catchlight.
    const front = local(c).add(new THREE.Vector3(0, 0, 0.0116));
    const ir = new THREE.Mesh(irisGeo, iris);
    ir.position.copy(front);
    head.add(ir);
    const pu = new THREE.Mesh(pupilGeo, pupil);
    pu.position.copy(front).add(new THREE.Vector3(0, 0, 0.0002));
    head.add(pu);
    const gl = new THREE.Mesh(glintGeo, glint);
    gl.position.copy(front).add(new THREE.Vector3(0.0024, 0.0026, 0.0004));
    head.add(gl);
  }
  addHair(look, head, local(t.headCenter), t.headRadius);
  head.scale.setScalar(1.13); // stylised proportion: a slightly larger head reads better from the game camera
  const rest = Object.fromEntries(bones.map((b) => [b.name, b.rotation.clone()]));
  // Arms hang from the A-pose: rotate the upper arms down towards the body.
  const ua = a.bones.find((b) => b.name === "upperarm01.L")!.head, la = a.bones.find((b) => b.name === "lowerarm01.L")!.head;
  const armDrop = Math.atan2(la[0] - ua[0], ua[1] - la[1]) - 0.12;
  // The A-pose forearms point forward; this brings them down to hang naturally.
  const forearmFix = Math.atan2(a.arm.wrist[2] - a.arm.elbow[2], a.arm.elbow[1] - a.arm.wrist[1]) - 0.18;
  const legAdduct = Math.atan2(a.leg.foot[0] - a.leg.hip[0], a.leg.hip[1] - a.leg.foot[1]) - 0.035;
  return { root, mesh, body, bones: byName, rest, armDrop, forearmFix, legAdduct, phase: Math.random() * 10, speed: 0, talk: 0, carry: look.carry === "tray", real: true };
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
      const n = style === "braids" ? 34 : 26;
      const thick = style === "braids" ? 0.0065 : 0.0085;
      for (let i = 0; i < n; i++) {
        // Spread round the back half of the head, from ear to ear.
        const ang = Math.PI * 0.42 + (i / (n - 1)) * Math.PI * 1.16;
        const len = (style === "braids" ? 0.3 : 0.2) * (0.9 + Math.random() * 0.2);
        const start = center.clone().add(new THREE.Vector3(Math.sin(ang) * r * 0.92, r * (0.05 + Math.random() * 0.25), Math.cos(ang) * r * 0.92));
        const strand = new THREE.Group();
        strand.position.copy(start);
        strand.rotation.set(Math.cos(ang) * 0.18, 0, -Math.sin(ang) * 0.18);
        // Smooth tapered strands (stylised): one capsule each, slightly curved by a second segment.
        const upper = new THREE.Mesh(new THREE.CapsuleGeometry(thick, len * 0.5, 4, 8), m);
        upper.position.y = -len * 0.27;
        upper.castShadow = true;
        strand.add(upper);
        const lower = new THREE.Mesh(new THREE.CapsuleGeometry(thick * 0.8, len * 0.45, 4, 8), m);
        lower.position.set(0, -len * 0.74, Math.cos(ang) * -0.006);
        lower.castShadow = true;
        strand.add(lower);
        head.add(strand);
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

// ---------------------------------------------------------------------------
// Gait. Joint angles follow normative human gait curves (degrees over one
// stride, 0 = right heel strike), sampled periodically with Catmull-Rom.

type Curve = [number, number][];
const WALK = {
  hip: [[0, 28], [0.1, 24], [0.3, 6], [0.5, -10], [0.6, -6], [0.75, 18], [0.88, 30]] as Curve,
  knee: [[0, 4], [0.14, 18], [0.38, 5], [0.55, 18], [0.7, 60], [0.82, 38], [0.95, 4]] as Curve,
  ankle: [[0, 0], [0.07, -6], [0.4, 10], [0.6, -18], [0.68, -8], [0.8, 2], [0.95, 0]] as Curve,
};
const RUN = {
  hip: [[0, 38], [0.15, 22], [0.35, -12], [0.45, -18], [0.6, 10], [0.8, 48], [0.92, 44]] as Curve,
  knee: [[0, 18], [0.12, 40], [0.3, 22], [0.45, 30], [0.65, 105], [0.82, 80], [0.95, 25]] as Curve,
  ankle: [[0, 4], [0.12, 14], [0.32, -20], [0.42, -24], [0.6, -4], [0.85, 4], [0.95, 4]] as Curve,
};

function sample(c: Curve, t: number): number {
  t = ((t % 1) + 1) % 1;
  const n = c.length;
  let i = n - 1;
  for (let k = 0; k < n; k++) if (c[k][0] > t) { i = k - 1; break; }
  if (i < 0) i = n - 1;
  const p1 = c[i], p2 = c[(i + 1) % n];
  const p0 = c[(i - 1 + n) % n], p3 = c[(i + 2) % n];
  const t1 = p1[0], t2 = p2[0] <= t1 ? p2[0] + 1 : p2[0];
  const tt = t < t1 ? t + 1 : t;
  const u = (tt - t1) / (t2 - t1);
  const u2 = u * u, u3 = u2 * u;
  return 0.5 * (2 * p1[1] + (-p0[1] + p2[1]) * u + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * u2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * u3);
}

const D = Math.PI / 180;

/** Bone-driven walk/run/idle. speed in m/s. */
export function animateHuman(r: HumanRig, dt: number, speed: number) {
  r.speed += (speed - r.speed) * Math.min(1, dt * 6);
  const v = r.speed;
  const B = r.bones;
  const set = (name: string, x: number, y = 0, z = 0) => B[name]?.rotation.set(x, y, z);
  const drop = r.armDrop;
  const moving = v > 0.12;
  // Stride frequency rises with speed (cadence ~105 steps/min at 1.3 m/s).
  const run = THREE.MathUtils.smoothstep(v, 3.2, 4.6);
  const freq = moving ? THREE.MathUtils.lerp(0.5 + 0.3 * v, 1.25 + 0.1 * v, run) : 0;
  const amt = THREE.MathUtils.smoothstep(v, 0.12, 1.1); // blend in from standing
  r.phase = (r.phase + dt * (freq || 0.35)) % 1000;
  const t = r.phase % 1;
  if (moving) r.walkBlend = Math.min(1, (r.walkBlend ?? 0) + dt * 4);
  else r.walkBlend = Math.max(0, (r.walkBlend ?? 0) - dt * 3);
  const wb = r.walkBlend * amt;
  const stride = THREE.MathUtils.clamp(v / Math.max(0.5, freq) / 1.4, 0.4, 1.5); // scale angles to stride length
  const g = (curve: "hip" | "knee" | "ankle", tt: number) => THREE.MathUtils.lerp(sample(WALK[curve], tt), sample(RUN[curve], tt), run);
  const legs = (side: "L" | "R", off: number) => {
    const tt = t + off;
    const hip = g("hip", tt) * (curve01(stride));
    const knee = g("knee", tt);
    const ankle = g("ankle", tt);
    const ad = side === "L" ? -r.legAdduct : r.legAdduct;
    set(`upperleg01.${side}`, -hip * D * wb, 0, ad);
    set(`lowerleg01.${side}`, knee * D * wb, 0, 0);
    set(`foot.${side}`, -ankle * D * wb, 0, -ad);
  };
  legs("R", 0);
  legs("L", 0.5);
  // Pelvis: rotates towards the forward leg and drops on the swing side.
  const ph = t * Math.PI * 2;
  const pelvisYaw = Math.cos(ph) * 5 * D * wb * (1 + run * 0.6);
  const pelvisRoll = Math.sin(ph * 2) * 3.5 * D * wb * (1 - run * 0.5);
  set("root", 0, pelvisYaw, pelvisRoll);
  // Trunk counter-rotates and leans into the motion; head stays level.
  const lean = (3 + run * 9) * D * wb;
  set("spine05", 0, -pelvisYaw * 0.6, -pelvisRoll * 0.8);
  set("spine03", lean * 0.6, -pelvisYaw * 0.9, 0);
  set("spine01", lean * 0.4, -pelvisYaw * 0.4, 0);
  // Arms swing opposite the legs; elbows bend more when running.
  const swing = (14 + 22 * run) * D * wb * curve01(stride);
  const elbowBase = (18 + 62 * run) * D;
  const armL = Math.cos(ph) * swing; // left arm forward with right leg
  if (!r.carry) {
    set("upperarm01.L", -armL, 0, -drop);
    set("upperarm01.R", armL, 0, drop);
    set("lowerarm01.L", r.forearmFix - (elbowBase + Math.max(0, armL) * 0.8) * wb - 0.08 * (1 - wb));
    set("lowerarm01.R", r.forearmFix - (elbowBase + Math.max(0, -armL) * 0.8) * wb - 0.08 * (1 - wb));
  }
  // Centre of mass: two rises per stride (highest mid-stance), sideways over the stance foot.
  const bob = Math.cos((t - 0.3) * Math.PI * 4) * (0.018 + 0.03 * run) * wb - 0.01 * wb;
  const sway = Math.sin(ph) * 0.018 * wb * (1 - run * 0.7);
  r.body.position.set(sway, bob, 0);
  set("neck02", -lean * 0.7, pelvisYaw * 0.8, 0);

  // Idle: breathing, weight shift and an occasional look around.
  const idle = 1 - wb;
  if (idle > 0.01) {
    const time = r.phase / 0.35;
    const br = Math.sin(time * 1.6);
    const shift = Math.sin(time * 0.25);
    B["spine03"].rotation.x += (0.012 + br * 0.008) * idle;
    B["root"].rotation.z += shift * 0.025 * idle;
    B["upperleg01.L"].rotation.z += shift * 0.02 * idle;
    B["upperleg01.R"].rotation.z += shift * 0.02 * idle;
    B["lowerleg01.L"].rotation.x += Math.max(0, shift) * 0.08 * idle;
    B["lowerleg01.R"].rotation.x += Math.max(0, -shift) * 0.08 * idle;
    B["neck02"].rotation.y += Math.sin(time * 0.31) * Math.sin(time * 0.13) * 0.35 * idle;
    r.body.position.x += shift * 0.012 * idle;
    if (!r.carry) {
      const tk = r.talk > 0 ? Math.sin(time * 3) * 0.3 : 0;
      B["upperarm01.L"].rotation.x += br * 0.02 * idle;
      if (r.talk > 0) {
        set("upperarm01.R", -0.5 - tk, 0, drop - 0.2);
        set("lowerarm01.R", r.forearmFix - 1.2 + tk * 0.4);
      }
    }
  }
  if (r.carry) {
    // One hand steadies the head tray.
    set("upperarm01.R", 0, 0, drop - 2.5);
    set("lowerarm01.R", r.forearmFix - 0.4, 0, 0);
  }
  if (r.talk > 0) r.talk -= dt;
}

/** Hip swing amplitude scales gently with stride length. */
function curve01(stride: number) {
  return 0.55 + 0.45 * stride;
}

/** Attach something to the top of a person's head (vendors' trays). */
export function headTop(r: HumanRig) {
  return r.bones.head;
}
