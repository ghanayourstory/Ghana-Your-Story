// Realistic people: skinned human bodies baked from MakeHuman CC0 assets
// (African young adult male/female), with procedural skin and clothing
// shading, eyes, hair and a bone-driven walk cycle.
import * as THREE from "three";
import { mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { fabric } from "./textures.ts";
import { GAIT, type GaitClip } from "./gait-data.ts";
import type { PersonLook } from "./people.ts";
import { OUTFITS, defaultOutfit, type ShoeId } from "../../shared/clothing.ts";

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
  faceMorphs?: Record<string, { idx: string; d: string }>;
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

/** Face shape axes baked by scripts/build-humans.mjs, in order. */
export const FACE_KEYS = ["nose_wide", "nose_big", "jaw", "chin", "cheeks", "cheekbones", "eyes", "lips", "mouth_wide", "head_long", "head_round", "forehead", "age"] as const;

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
  const n = g.attributes.position.count;
  const faceAttrs = FACE_KEYS.map((k) => {
    const out = new Float32Array(n * 3);
    const fm = a.faceMorphs?.[k];
    if (fm) {
      const idx = new Uint16Array(bytes(fm.idx).buffer), d = f32(fm.d);
      for (let i = 0; i < idx.length; i++) out.set(d.subarray(i * 3, i * 3 + 3), idx[i] * 3);
    }
    return new THREE.BufferAttribute(out, 3);
  });
  g.morphAttributes.position = [...(["muscle", "heavy", "slim"] as const).map((k) => new THREE.BufferAttribute(f32(a.morphs[k]), 3)), ...faceAttrs];
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

function personMaterial(look: PersonLook, skirt: boolean, hide: { top: boolean; thighs: boolean; shins: boolean; feet: boolean; sleeveX: number; crotch?: [number, number, number]; crotchColor?: string; toga?: [number, number, number]; socks?: string; kneeY?: number; thighCutY?: number; longSleeve?: { tex: THREE.Texture; elbowX: number; wristX: number } }, neck: [number, number, number] = [99, 99, 0]) {
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
    uHideThighs: { value: hide.thighs ? 1 : 0 },
    uHideShins: { value: hide.shins ? 1 : 0 },
    uSleeveX: { value: hide.sleeveX },
    uLongSleeve: { value: hide.longSleeve ? 1 : 0 },
    uSleeveTex: { value: hide.longSleeve?.tex ?? fabricTex("plain", "#ffffff") },
    uElbowX: { value: hide.longSleeve?.elbowX ?? 99 },
    uWristX: { value: hide.longSleeve?.wristX ?? 99 },
    uHideFeet: { value: hide.feet ? 1 : 0 },
    uNeckY: { value: neck[1] },
    uCrotch: { value: new THREE.Vector3(...(hide.crotch ?? [-9, -9, 0])) },
    uToga: { value: new THREE.Vector3(...(hide.toga ?? [99, 99, 1])) },
    uCrotchCol: { value: new THREE.Color(hide.crotchColor ?? look.pants).multiplyScalar(0.8) },
    uThighCut: { value: hide.thighCutY ?? -9 },
    uSocks: { value: new THREE.Vector4(...new THREE.Color(hide.socks ?? "#ffffff").toArray(), hide.socks ? hide.kneeY ?? 0.5 : -1) },
    uNeckZ: { value: neck[2] },
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
uniform float uShortHair; uniform float uSkirt; uniform float uHideTop; uniform float uHideThighs; uniform float uHideShins; uniform float uHideFeet; uniform float uNeckY; uniform float uNeckZ; uniform float uSleeveX;
uniform vec3 uCrotch; uniform vec3 uCrotchCol; uniform float uThighCut; uniform vec3 uToga; uniform vec4 uSocks;
uniform float uLongSleeve; uniform sampler2D uSleeveTex; uniform float uElbowX; uniform float uWristX;
float hHash(vec3 p) { return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }
float vHash(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float vNoise(vec3 x) {
  vec3 i = floor(x); vec3 f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(vHash(i), vHash(i + vec3(1,0,0)), f.x), mix(vHash(i + vec3(0,1,0)), vHash(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(vHash(i + vec3(0,0,1)), vHash(i + vec3(1,0,1)), f.x), mix(vHash(i + vec3(0,1,1)), vHash(i + vec3(1,1,1)), f.x), f.y), f.z);
}
vec3 bumpNormal(vec3 n, float h, float scale) {
  vec3 sx = dFdx(-vViewPosition), sy = dFdy(-vViewPosition);
  float dx = dFdx(h), dy = dFdy(h);
  vec3 r1 = cross(sy, n), r2 = cross(n, sx);
  float det = dot(sx, r1);
  vec3 grad = sign(det) * (dx * r1 + dy * r2) * scale;
  return normalize(abs(det) * n - grad);
}
float skinH;`,
      )
      .replace(
        "#include <color_fragment>",
        `#include <color_fragment>
float rg = floor(vRegion + 0.5);
// Skin under garments is hidden so it never pokes through the cloth.
float neckLine = uNeckY - 0.085 + 3.0 * vObjPos.x * vObjPos.x - max(0.0, uNeckZ - vObjPos.z) * 0.3;
float togaLine = mix(uToga.x, uToga.y, smoothstep(-uToga.z, uToga.z * 0.7, vObjPos.x));
if ((uHideTop > 0.5 && (rg == 1.0 || rg == 2.0) && vObjPos.y < min(neckLine - 0.012, togaLine - 0.012) && abs(vObjPos.x) < uSleeveX - 0.01) || (uHideThighs > 0.5 && rg == 3.0 && vObjPos.y > uThighCut) || (uHideShins > 0.5 && rg == 6.0) || (uHideFeet > 0.5 && rg == 4.0)) discard;
// Between the legs under trousers or a skirt: in shadow, never bare body (and never see-through).
bool crotchShade = vObjPos.y < uCrotch.x && vObjPos.y > uCrotch.y && abs(vObjPos.x) < uCrotch.z;
vec3 c = uSkin;
// Real skin: blotchy tone at a few centimetres, finer mottling, pores.
float n1 = vNoise(vObjPos * 30.0), n2 = vNoise(vObjPos * 110.0);
c *= 0.94 + 0.08 * n1 + 0.03 * n2;
c = mix(c, c * vec3(1.05, 0.96, 0.93), smoothstep(0.6, 0.95, n1) * 0.35);
skinH = n2;
float rough = 0.52 + 0.08 * n2;
vec2 cuv = vUv2 * 9.0;
if (rg == 1.0 || rg == 2.0 || rg == 3.0 || rg == 6.0) { /* skin tone with variation, set above */ }
else if (rg == 4.0) { c = uShoe; rough = 0.35; skinH = 0.0; }
// Football socks pulled up to just below the knee, with a band at the top.
if (uSocks.w > 0.0 && vObjPos.y < uSocks.w + 0.02 && vObjPos.y > 0.06 && abs(vObjPos.x) < 0.35) {
  c = uSocks.rgb * (0.92 + 0.08 * n1);
  if (vObjPos.y > uSocks.w - 0.03) c = mix(c, vec3(0.95), 0.85);
  rough = 0.85; skinH = 0.0;
}
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
  // T-zone (forehead, nose) is a little shinier.
  rough -= 0.1 * smoothstep(0.02, 0.0, abs(vObjPos.x)) ;
  skinH *= 1.0 - vFace.x * uShortHair;
}
// Long sleeves: the forearm is covered in the top's fabric down to the wrist.
if (uLongSleeve > 0.5 && rg == 0.0 && abs(vObjPos.x) > uElbowX - 0.05 && abs(vObjPos.x) < uWristX - 0.012 && vObjPos.y < uNeckY - 0.1) {
  c = texture2D(uSleeveTex, vObjPos.zy * 8.0).rgb * (0.86 + 0.14 * n1);
  rough = 0.9;
  skinH = 0.0;
}
if (crotchShade) { c = uCrotchCol; skinH = 0.0; rough = 0.9; }
diffuseColor.rgb = c;`,
      )
      .replace("#include <roughnessmap_fragment>", "#include <roughnessmap_fragment>\nroughnessFactor = rough;")
      .replace("#include <normal_fragment_maps>", "#include <normal_fragment_maps>\nnormal = bumpNormal(normal, skinH, 0.00012);");
  };
  m.customProgramCacheKey = () => "sika-human-8";
  return m;
}

/** Cloth with a triplanar-projected pattern: no UV seams, pattern scale in real centimetres. */
/** Garment details drawn on the top: 0 none, 1 suit jacket (lapels, shirt, tie, buttons), 2 collared shirt, 3 jersey trim. */
interface TopStyle {
  sleeveX: number; style: number; inner: string; tie: string; toga?: [number, number, number];
  /** Cut the whole garment straight across below this height (shorts at the knee). */
  cutY?: number;
  /** Football kit: trim colour and the number on the back. */
  kit?: { accent: string; number: number };
}
const numberTexCache = new Map<number, THREE.CanvasTexture>();
function numberTex(n: number) {
  let t = numberTexCache.get(n);
  if (!t) {
    const cv = document.createElement("canvas");
    cv.width = cv.height = 128;
    const g = cv.getContext("2d")!;
    g.fillStyle = "#000"; g.fillRect(0, 0, 128, 128);
    g.fillStyle = "#fff";
    g.font = "900 104px 'Arial Black', Arial, sans-serif";
    g.textAlign = "center"; g.textBaseline = "middle";
    g.fillText(String(n), 64, 70, 120);
    t = new THREE.CanvasTexture(cv);
    numberTexCache.set(n, t);
  }
  return t;
}
function fabricMaterial(tex: THREE.Texture, neckY = 99, neckZ = 0, hemY = -99, top: TopStyle = { sleeveX: 99, style: 0, inner: "#ffffff", tie: "#000000" }) {
  const kit = top.kit;
  const m = new THREE.MeshStandardMaterial({ roughness: top.style === 1 ? 0.7 : kit || top.style === 4 ? 0.55 : 0.88, side: THREE.DoubleSide });
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uFabric = { value: tex };
    shader.uniforms.uNeckY = { value: neckY };
    shader.uniforms.uNeckZ = { value: neckZ };
    shader.uniforms.uHemY = { value: hemY };
    shader.uniforms.uSleeveX = { value: top.sleeveX };
    shader.uniforms.uStyle = { value: top.style };
    shader.uniforms.uInner = { value: new THREE.Color(top.inner) };
    shader.uniforms.uTie = { value: new THREE.Color(top.tie) };
    shader.uniforms.uToga = { value: new THREE.Vector3(...(top.toga ?? [99, 99, 1])) };
    shader.uniforms.uCutY = { value: top.cutY ?? -99 };
    shader.uniforms.uAccent = { value: new THREE.Color(kit?.accent ?? "#ffffff") };
    shader.uniforms.uNumTex = { value: numberTex(kit?.number ?? 0) };
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vRest;\nvarying vec3 vRestN;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvRest = position;\nvRestN = normal;");
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vRest;\nvarying vec3 vRestN;\nuniform sampler2D uFabric;\nuniform float uNeckY;\nuniform float uNeckZ;\nuniform float uHemY;\nuniform float uSleeveX;\nuniform float uStyle;\nuniform vec3 uInner;\nuniform vec3 uTie;\nuniform vec3 uToga;\nuniform float uCutY;\nuniform vec3 uAccent;\nuniform sampler2D uNumTex;\nfloat foldH;\n" + `
float vHash(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float vNoise(vec3 x) {
  vec3 i = floor(x); vec3 f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(vHash(i), vHash(i + vec3(1,0,0)), f.x), mix(vHash(i + vec3(0,1,0)), vHash(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(vHash(i + vec3(0,0,1)), vHash(i + vec3(1,0,1)), f.x), mix(vHash(i + vec3(0,1,1)), vHash(i + vec3(1,1,1)), f.x), f.y), f.z);
}
vec3 bumpNormal(vec3 n, float h, float scale) {
  vec3 sx = dFdx(-vViewPosition), sy = dFdy(-vViewPosition);
  float dx = dFdx(h), dy = dFdy(h);
  vec3 r1 = cross(sy, n), r2 = cross(n, sx);
  float det = dot(sx, r1);
  vec3 grad = sign(det) * (dx * r1 + dy * r2) * scale;
  return normalize(abs(det) * n - grad);
}`)
      .replace(
        "#include <color_fragment>",
        `#include <color_fragment>
// A clean round neckline instead of the mesh's jagged edge.
if (vRest.y > uNeckY - 0.085 + 3.0 * vRest.x * vRest.x - max(0.0, uNeckZ - vRest.z) * 0.3) discard;
// Kente worn the traditional way: over the left shoulder, the right shoulder and chest bare.
if (vRest.y > mix(uToga.x, uToga.y, smoothstep(-uToga.z, uToga.z * 0.7, vRest.x))) discard;
// A straight hem instead of the mesh edge.
if (vRest.y < uHemY && abs(vRest.x) < 0.3) discard;
if (vRest.y < uCutY) discard;
// Sleeve length: cut the arm off where the sleeve ends.
if (abs(vRest.x) > uSleeveX) discard;
vec3 w = pow(abs(normalize(vRestN)), vec3(4.0));
w /= (w.x + w.y + w.z);
float sc = 8.0;
vec3 fab = texture2D(uFabric, vRest.zy * sc).rgb * w.x + texture2D(uFabric, vRest.xz * sc).rgb * w.y + texture2D(uFabric, vRest.xy * sc).rgb * w.z;
// Folds: soft vertical drape plus creases, and the weave of the cloth.
float drape = vNoise(vec3(vRest.x * 22.0, vRest.y * 5.0, vRest.z * 22.0));
float crease = vNoise(vec3(vRest.x * 60.0, vRest.y * 14.0, vRest.z * 60.0));
float weave = vNoise(vRest * 1400.0);
foldH = drape * 0.75 + crease * 0.25 + weave * 0.04;
fab *= 0.93 + 0.1 * drape;
float yN = uNeckY - 0.085 - vRest.y;
bool front = vRestN.z > 0.3 && abs(vRest.x) < 0.2;
if (uStyle > 0.5 && uStyle < 1.5 && front) {
  // Suit jacket: a V of white shirt and a tie between the lapels, then buttons.
  float vHalf = clamp(yN, 0.0, 0.3) * 0.34;
  if (yN > -0.01 && yN < 0.3 && abs(vRest.x) < vHalf) {
    fab = uInner * (0.92 + 0.08 * drape);
    float tieW = 0.013 + max(0.0, yN - 0.05) * 0.06;
    if (yN > 0.03 && abs(vRest.x) < tieW) fab = uTie * (0.85 + 0.15 * crease);
    if (yN < 0.035 && abs(vRest.x) < 0.02) fab = uTie * 0.8;
  }
  if (yN > 0.0 && yN < 0.31 && abs(abs(vRest.x) - vHalf) < 0.007) fab *= 0.55;
  if (yN > 0.33 && yN < 0.5 && abs(vRest.x) < 0.011 && fract(yN * 12.0) < 0.28) fab = vec3(0.06);
}
if (uStyle > 2.5 && uStyle < 3.5) {
  // Football jersey: contrast collar, cuffs and side panels, a crest on the chest and the number on the back.
  float neckLine = uNeckY - 0.085 + 3.0 * vRest.x * vRest.x - max(0.0, uNeckZ - vRest.z) * 0.3;
  if (neckLine - vRest.y < 0.02) fab = uAccent;
  if (abs(vRest.x) > uSleeveX - 0.024) fab = uAccent;
  if (abs(vRestN.x) > 0.72 && abs(vRest.x) < uSleeveX - 0.06 && vRest.y < uNeckY - 0.12) fab = mix(fab, uAccent, 0.9);
  vec2 crest = vec2(vRest.x - 0.075, vRest.y - (uNeckY - 0.2));
  // Club crest: a small shield with a two-tone inner field.
  float shieldW = 0.024 * (crest.y > -0.006 ? 1.0 : clamp((crest.y + 0.032) / 0.026, 0.0, 1.0));
  if (vRestN.z > 0.3 && crest.y < 0.022 && crest.y > -0.032 && abs(crest.x) < shieldW) {
    fab = uAccent;
    if (crest.y < 0.016 && crest.y > -0.024 && abs(crest.x) < shieldW - 0.005) fab = crest.x > 0.0 ? mix(fab, vec3(0.75, 0.12, 0.1), 0.85) : mix(fab, vec3(0.95, 0.72, 0.05), 0.85);
  }
  if (vRestN.z < -0.25 && abs(vRest.x) < 0.11) {
    vec2 nuv = vec2(0.5 - vRest.x / 0.22, (vRest.y - (uNeckY - 0.46)) / 0.26);
    if (nuv.y > 0.0 && nuv.y < 1.0 && texture2D(uNumTex, nuv).r > 0.5) fab = uAccent;
  }
  fab *= 1.02;
}
if (uStyle > 3.5 && uStyle < 4.5) {
  // Football shorts: a stripe down each side and a band at the hem.
  if (abs(vRestN.x) > 0.78) fab = uAccent;
  if (vRest.y < uCutY + 0.025) fab = uAccent;
  if (vRest.y > 1.0) fab = uAccent;
}
if (uStyle > 1.5 && uStyle < 2.5 && front && yN > 0.02) {
  // Collared shirt: a button placket down the front.
  if (abs(vRest.x) < 0.012) fab *= 0.88;
  if (abs(vRest.x) < 0.006 && fract(yN * 11.0) < 0.14) fab = mix(fab, vec3(0.95), 0.85);
}
// The inside of a garment is in shadow.
if (!gl_FrontFacing) { fab *= 0.16; foldH = 0.0; }
diffuseColor.rgb = fab;`,
      )
      .replace("#include <normal_fragment_maps>", "#include <normal_fragment_maps>\nnormal = bumpNormal(normal, foldH, 0.0035);");
  };
  m.customProgramCacheKey = () => "sika-fabric-7";
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
  /** Seconds alive (idle breathing and glances). */
  clock?: number;
  gender: "male" | "female";
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
  const outfit = OUTFITS[look.outfit ?? defaultOutfit(look)] ?? OUTFITS.shirt;
  const shoeKind: ShoeId = look.shoes ?? (outfit.shoes === "heels" && !look.feminine ? "formal" : outfit.shoes);
  const neckHead = a.bones.find((b) => b.name === "neck01")?.head;
  const arm = a.arm;
  const sleeveX = outfit.sleeves === "long" ? 99 : outfit.sleeves === "elbow" ? arm.elbow[0] + 0.02 : outfit.sleeves === "short" ? arm.shoulder[0] + (arm.elbow[0] - arm.shoulder[0]) * 0.42 : arm.shoulder[0] + 0.015;
  const lower = outfit.lower;
  // Open shoes (sandals, heels) show the foot; only closed ones hide it.
  const closedShoes = shoeKind !== "sandals" && shoeKind !== "barefoot" && shoeKind !== "heels";
  const pattern = outfit.pattern ?? (outfit.id === "suit" ? "plain" : look.pattern ?? "plain");
  // Suits: jacket and trousers share the dark colour; the shirt is white and the tie takes the top colour.
  const jacketColor = outfit.id === "suit" ? look.pants : look.shirt;
  // Kente: the cloth line runs from under the right arm up over the left shoulder.
  const toga: [number, number, number] | undefined = outfit.id === "kente" && neckHead ? [neckHead[1] - 0.25, neckHead[1] + 0.06, arm.shoulder[0]] : undefined;
  const mesh = new THREE.SkinnedMesh(t.geometry, personMaterial(look, lower !== "trousers" && lower !== "shorts", {
    top: true,
    thighs: true,
    shins: lower === "trousers" || lower === "long_skirt" || lower === "cloth",
    feet: closedShoes,
    sleeveX,
    crotch: [a.hips.waistY - 0.06, a.hips.kneeY, a.hips.hipHalfWidth * 0.45],
    toga,
    socks: outfit.id === "jersey" ? look.shirt : undefined,
    crotchColor: outfit.id === "jersey" ? (new THREE.Color(look.shirt).getHSL({ h: 0, s: 0, l: 0 }).l > 0.62 ? "#1b1d22" : "#f6f6f2") : lower === "trousers" || lower === "shorts" ? (outfit.id === "tee" && look.pants === "#2B2B2B" ? "#2f4a6e" : look.pants) : look.shirt,
    kneeY: a.hips.kneeY - 0.03,
    thighCutY: lower === "shorts" ? a.hips.kneeY + 0.06 : undefined,
    longSleeve: outfit.sleeves === "long" ? { tex: fabricTex(pattern, jacketColor), elbowX: arm.elbow[0], wristX: arm.wrist[0] } : undefined,
  }, neckHead));
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
  const h = a.hips;
  // Cloth around the hips and legs (skirts, smock flare, jacket tails, kente): a lathe skinned to the
  // legs, so each side swings with the leg under it and the cloth between them follows both.
  const boneIx = (n: string) => a.bones.findIndex((b) => b.name === n);
  const [ROOT, SPINE, THL, THR, SHL, SHR] = ["root", "spine05", "upperleg01.L", "upperleg01.R", "lowerleg01.L", "lowerleg01.R"].map(boneIx);
  const legX = a.bones[THL].head[0];
  const lathe = (tex: THREE.Texture, prof: [number, number][], repeat: [number, number], rough = 0.9) => {
    const t2 = tex.clone();
    t2.repeat.set(...repeat);
    t2.needsUpdate = true;
    // Finer rings down the length (every ~4 cm) so the cloth bends smoothly at the knee.
    const fine: THREE.Vector2[] = [];
    for (let k = 0; k < prof.length - 1; k++) {
      const [r0, y0] = prof[k], [r1, y1] = prof[k + 1];
      const steps = Math.max(1, Math.ceil(Math.abs(y1 - y0) / 0.04));
      for (let j = 0; j < steps; j++) fine.push(new THREE.Vector2(r0 + ((r1 - r0) * j) / steps, y0 + ((y1 - y0) * j) / steps));
    }
    fine.push(new THREE.Vector2(...prof[prof.length - 1]));
    const geo2 = new THREE.LatheGeometry(fine, 40);
    geo2.scale(1, 1, 0.82);
    const pos = geo2.attributes.position as THREE.BufferAttribute;
    const n = pos.count;
    const si = new Uint16Array(n * 4), sw = new Float32Array(n * 4);
    const waist = h.waistY, knee = h.kneeY;
    for (let i = 0; i < n; i++) {
      const x = pos.getX(i), y = pos.getY(i);
      // Which leg: by side, blended across the middle so the front and back follow both.
      const wl = THREE.MathUtils.clamp(0.5 + (x * Math.sign(legX)) / (Math.abs(legX) * 2.4), 0, 1), wr = 1 - wl;
      if (y >= knee) {
        // Hips to knee: from the body at the waist to the thighs further down.
        const t = Math.pow(THREE.MathUtils.clamp((waist + 0.02 - y) / (waist + 0.02 - knee), 0, 1), 0.8);
        const body0 = 1 - t;
        si.set([y > waist + 0.05 ? SPINE : ROOT, THL, THR, ROOT], i * 4);
        sw.set([body0, t * wl, t * wr, 0], i * 4);
      } else {
        // Below the knee: hand over from thigh to shin.
        const u = THREE.MathUtils.smoothstep(knee - y, 0, 0.18);
        si.set([THL, THR, SHL, SHR], i * 4);
        sw.set([(1 - u) * wl, (1 - u) * wr, u * wl, u * wr], i * 4);
      }
    }
    geo2.setAttribute("skinIndex", new THREE.Uint16BufferAttribute(si, 4));
    geo2.setAttribute("skinWeight", new THREE.Float32BufferAttribute(sw, 4));
    const m2 = new THREE.SkinnedMesh(geo2, new THREE.MeshStandardMaterial({ map: t2, roughness: rough, side: THREE.DoubleSide }));
    m2.bind(skeleton, mesh.bindMatrix);
    m2.castShadow = true;
    m2.frustumCulled = false;
    body.add(m2);
  };
  const hipR = h.hipHalfWidth;
  const topStyle: TopStyle = { sleeveX, style: outfit.jacket ? 1 : outfit.collar ? 2 : outfit.id === "jersey" ? 3 : 0, inner: "#f4f2ec", tie: look.shirt, toga };
  // Football kit colours: the shirt colour with a contrasting trim; shorts in the trim colour.
  const light = new THREE.Color(look.shirt).getHSL({ h: 0, s: 0, l: 0 }).l > 0.62;
  const kitAccent = light ? "#1b1d22" : "#f6f6f2";
  if (outfit.id === "jersey") topStyle.kit = { accent: kitAccent, number: 2 + (Math.abs(Math.round(look.height * 1000 + look.build * 77)) % 22) };
  const topMat = fabricMaterial(fabricTex(pattern, jacketColor), neckHead?.[1], neckHead?.[2], h.waistY - (outfit.jacket ? 0.16 : outfit.id === "jersey" ? 0.04 : 0.07), topStyle);
  dress(t.shells.top, topMat);
  if (outfit.jacket) lathe(fabricTex("plain", jacketColor), [[hipR * 0.92, h.waistY + 0.02], [hipR * 1.04, h.waistY - 0.1], [hipR * 1.08, h.waistY - 0.2]], [6, 2], 0.7);
  if (lower === "trousers" || lower === "shorts") {
    const jersey = outfit.id === "jersey";
    const pm = jersey
      ? fabricMaterial(fabricTex("plain", kitAccent), 99, 0, -99, { sleeveX: 99, style: 4, inner: "#fff", tie: "#000", cutY: h.kneeY + 0.05, kit: { accent: look.shirt, number: 0 } })
      : fabricMaterial(fabricTex(outfit.id === "tee" ? "denim" : "plain", outfit.id === "tee" && look.pants === "#2B2B2B" ? "#2f4a6e" : look.pants), 99, 0, -99, { sleeveX: 99, style: 0, inner: "#fff", tie: "#000", cutY: lower === "shorts" ? h.kneeY + 0.05 : undefined });
    dress(t.shells.shorts, pm);
    if (lower === "trousers") dress(t.shells.shins, pm);
  } else if (lower === "knee_skirt") {
    lathe(fabricTex(pattern, look.shirt), [[hipR * 0.86 * 0.9, h.waistY + 0.03], [hipR * 0.96, h.waistY - 0.12], [hipR * 1.1, h.kneeY - 0.06]], [7, 3]);
  } else if (lower === "long_skirt") {
    // Kaba and slit: a little peplum at the waist, then a fitted skirt to the ankles.
    lathe(fabricTex(pattern, look.shirt), [[hipR * 0.9, h.waistY + 0.04], [hipR * 1.12, h.waistY - 0.08]], [7, 1]);
    lathe(fabricTex(pattern, look.pants === "#2B2B2B" ? look.shirt : look.pants), [[hipR * 0.82, h.waistY + 0.02], [hipR * 1.02, h.waistY - 0.16], [hipR * 0.92, h.kneeY], [hipR * 0.8, 0.1]], [7, 5]);
  } else if (lower === "cloth") {
    // Kente: one great cloth wrapped from the chest to the ankles.
    const chest = (neckHead?.[1] ?? 1.5) - 0.24;
    lathe(fabricTex("kente", look.shirt), [[hipR * 0.95, chest], [hipR * 1.12, h.waistY], [hipR * 1.12, h.kneeY], [hipR * 1.0, 0.08]], [8, 6]);
  }
  if (outfit.id === "smock") lathe(fabricTex("stripe", look.shirt), [[hipR * 0.9, h.waistY + 0.06], [hipR * 1.15, h.waistY - 0.1], [hipR * 1.35, h.kneeY + 0.2]], [9, 3]);
  // Shoes, modelled on each foot.
  for (const side of ["L", "R"] as const) {
    const fb = a.bones.find((b) => b.name === `foot.${side}`)!.head, tb = a.bones.find((b) => b.name === `toe1-1.${side}`)!.head;
    const shoe = buildShoe(shoeKind, look, new THREE.Vector3(...fb), new THREE.Vector3(...tb));
    if (shoe) bones[a.bones.findIndex((b) => b.name === `foot.${side}`)].add(shoe);
  }
  // Body type from the build slider.
  const build = look.build;
  const influences = [
    Math.max(0, (build - 1) * 2.2) * (look.feminine ? 0.5 : 1),
    Math.max(0, (build - 1.05) * 3),
    Math.max(0, (1 - build) * 4),
  ];
  const face = FACE_KEYS.map((_, i) => THREE.MathUtils.clamp(look.face?.[i] ?? 0, -1, 1) * (FACE_KEYS[i] === "age" ? 1 : 0.85));
  mesh.morphTargetInfluences = [...influences, ...face];
  for (const m of garments) m.morphTargetInfluences = [...influences];
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
  return { root, mesh, body, bones: byName, rest, armDrop, forearmFix, legAdduct, gender: look.feminine ? "female" : "male", phase: Math.random() * 10, speed: 0, talk: 0, carry: look.carry === "tray", real: true };
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

const curlyMats = new Map<string, THREE.Material>();
let curlTex: THREE.CanvasTexture | null = null;
/** Hair with a tight-curl bump texture, so an afro reads as hair, not a helmet. */
function curlyMat(c: string) {
  let m = curlyMats.get(c);
  if (!m) {
    if (!curlTex) {
      const cv = document.createElement("canvas");
      cv.width = cv.height = 128;
      const g = cv.getContext("2d")!;
      g.fillStyle = "#808080"; g.fillRect(0, 0, 128, 128);
      let s = 7;
      const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
      for (let i = 0; i < 900; i++) {
        const x = rnd() * 128, y = rnd() * 128, rr = 1.5 + rnd() * 2.5;
        g.strokeStyle = rnd() < 0.5 ? "#e0e0e0" : "#202020";
        g.lineWidth = 1.2;
        g.beginPath(); g.arc(x, y, rr, rnd() * 6, rnd() * 6 + 4); g.stroke();
      }
      curlTex = new THREE.CanvasTexture(cv);
      curlTex.wrapS = curlTex.wrapT = THREE.RepeatWrapping;
      curlTex.repeat.set(5, 5);
    }
    m = new THREE.MeshStandardMaterial({ color: c, roughness: 1, bumpMap: curlTex, bumpScale: 3 });
    curlyMats.set(c, m);
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
      // A round, soft afro that sits back from the hairline: lumpy outline, flat underside,
      // the front lifted clear of the forehead, and a curly bump texture.
      const g = mergeVertices(new THREE.IcosahedronGeometry(1, 5).deleteAttribute("normal").deleteAttribute("uv"));
      const p = g.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < p.count; i++) {
        const v = new THREE.Vector3().fromBufferAttribute(p, i);
        v.multiplyScalar(1 + (Math.sin(v.x * 17) * Math.sin(v.y * 13 + 1) * Math.sin(v.z * 19)) * 0.04);
        v.y = Math.max(v.y, -0.62);
        if (v.z > 0.05) v.y = Math.max(v.y, -0.62 + (v.z - 0.05) * 0.55);
        p.setXYZ(i, v.x, v.y, v.z);
      }
      g.computeVertexNormals();
      add(g, curlyMat(look.hair), center.clone().add(new THREE.Vector3(0, r * 0.4, -r * 0.18)), [r * 1.3, r * 1.2, r * 1.3]);
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
      // Baseball cap: a crown that covers the top of the head, a button, and a curved brim.
      add(new THREE.SphereGeometry(1, 28, 14, 0, Math.PI * 2, 0, Math.PI / 2), capM, center.clone().add(new THREE.Vector3(0, r * 0.12, -r * 0.06)), [r * 1.1, r * 1.24, r * 1.16], [-0.12, 0, 0]);
      add(sphere, capM, center.clone().add(new THREE.Vector3(0, r * 1.34, -r * 0.2)), [r * 0.09, r * 0.05, r * 0.09]);
      add(new THREE.CylinderGeometry(1, 1, 1, 24, 1, false, -Math.PI / 2, Math.PI), capM, center.clone().add(new THREE.Vector3(0, r * 0.22, r * 0.9)), [r * 0.9, r * 0.05, r * 0.8], [0.22, 0, 0]);
      break;
    }
    default:
      break; // low cut: painted on the scalp by the skin shader
  }
}

// ---------------------------------------------------------------------------
// Gait: real motion capture. The walk and run cycles come from the CMU Graphics
// Lab Motion Capture Database, retargeted onto these skeletons by
// scripts/bake-gait.mjs. Playback speed follows how fast you're going, so the
// feet stay planted; walk blends into run with speed, and both ease into a
// living idle (breathing, weight shift, looking about) when you stop.

const qWalk = new THREE.Quaternion(), qRun = new THREE.Quaternion(), qTmp = new THREE.Quaternion();
function sampleClip(c: GaitClip, bone: string, t: number, out: THREE.Quaternion) {
  const arr = c.bones[bone];
  const n = arr.length / 4;
  const f = (((t % 1) + 1) % 1) * n;
  const i0 = Math.floor(f) % n, i1 = (i0 + 1) % n;
  out.fromArray(arr, i0 * 4);
  qTmp.fromArray(arr, i1 * 4);
  return out.slerp(qTmp, f - Math.floor(f));
}
function sampleRoot(c: GaitClip, t: number): [number, number] {
  const n = c.root.length / 2;
  const f = (((t % 1) + 1) % 1) * n;
  const i0 = Math.floor(f) % n, i1 = (i0 + 1) % n, u = f - Math.floor(f);
  return [c.root[i0 * 2] * (1 - u) + c.root[i1 * 2] * u, c.root[i0 * 2 + 1] * (1 - u) + c.root[i1 * 2 + 1] * u];
}

/** Bone-driven walk/run/idle. speed in m/s. */
export function animateHuman(r: HumanRig, dt: number, speed: number) {
  r.speed += (speed - r.speed) * Math.min(1, dt * 8);
  r.clock = (r.clock ?? 0) + dt;
  const v = r.speed;
  const B = r.bones;
  const set = (name: string, x: number, y = 0, z = 0) => B[name]?.rotation.set(x, y, z);
  const drop = r.armDrop;
  const gait = GAIT[r.gender];
  const moving = v > 0.12;
  if (moving) r.walkBlend = Math.min(1, (r.walkBlend ?? 0) + dt * 5);
  else r.walkBlend = Math.max(0, (r.walkBlend ?? 0) - dt * 4);
  const wb = r.walkBlend * THREE.MathUtils.smoothstep(v, 0.05, 0.6);
  // Walk → run between a brisk walk and a jog.
  const run = THREE.MathUtils.smoothstep(v, 2.4, 3.8);
  // Cycles per second: the clip's own cadence, sped up for longer, faster strides (cadence rises
  // more slowly than speed, as in real people; the stride covers the rest).
  const ws = gait.walk.stride / gait.walk.duration, rs = gait.run.stride / gait.run.duration;
  const vv = Math.max(v, 0.4);
  const rate = THREE.MathUtils.lerp(Math.pow(vv / ws, 0.7) / gait.walk.duration, Math.pow(vv / rs, 0.55) / gait.run.duration, run);
  if (moving) r.phase = (r.phase + dt * rate) % 1000;
  const t = r.phase % 1;

  // Idle pose first: feet under the hips, arms relaxed at the sides.
  for (const sd of ["L", "R"] as const) {
    const ad = sd === "L" ? -r.legAdduct : r.legAdduct;
    set(`upperleg01.${sd}`, 0, 0, ad);
    set(`lowerleg01.${sd}`, 0);
    set(`foot.${sd}`, 0, 0, -ad);
    set(`clavicle.${sd}`, 0);
  }
  set("upperarm01.L", 0, 0, -drop);
  set("upperarm01.R", 0, 0, drop);
  set("lowerarm01.L", r.forearmFix - 0.1);
  set("lowerarm01.R", r.forearmFix - 0.1);
  for (const n of ["root", "spine05", "spine03", "spine01", "neck01", "neck02", "neck03", "head"]) set(n, 0);
  r.body.position.set(0, 0, 0);
  const idle = 1 - wb;
  if (idle > 0.01) {
    const time = r.clock;
    const br = Math.sin(time * 1.6);
    const shift = Math.sin(time * 0.25 + r.phase);
    B["spine03"].rotation.x += 0.012 + br * 0.008;
    B["root"].rotation.z += shift * 0.025;
    B["upperleg01.L"].rotation.z += shift * 0.02;
    B["upperleg01.R"].rotation.z += shift * 0.02;
    B["lowerleg01.L"].rotation.x += Math.max(0, shift) * 0.08;
    B["lowerleg01.R"].rotation.x += Math.max(0, -shift) * 0.08;
    B["neck02"].rotation.y += Math.sin(time * 0.31) * Math.sin(time * 0.13) * 0.35;
    B["upperarm01.L"].rotation.x += br * 0.02;
    r.body.position.x += shift * 0.012;
  }
  // Then the motion-captured walk and run, blended in as you get going.
  if (wb > 0.001) {
    for (const name in gait.walk.bones) {
      const bone = B[name];
      // The head stays level (people look where they're going), so the neck isn't taken from the capture.
      if (!bone || name === "neck01" || name === "neck03" || name === "head") continue;
      sampleClip(gait.walk, name, t, qWalk);
      if (run > 0) qWalk.slerp(sampleClip(gait.run, name, t, qRun), run);
      bone.quaternion.slerp(qWalk, wb);
    }
    const [wx, wy] = sampleRoot(gait.walk, t), [rx, ry] = sampleRoot(gait.run, t);
    r.body.position.x = THREE.MathUtils.lerp(r.body.position.x, THREE.MathUtils.lerp(wx, rx, run), wb);
    r.body.position.y = THREE.MathUtils.lerp(0, THREE.MathUtils.lerp(wy, ry, run), wb);
  }
  if (!r.carry && r.talk > 0 && idle > 0.5) {
    const tk = Math.sin(r.clock * 3) * 0.3;
    set("upperarm01.R", -0.5 - tk, 0, drop - 0.2);
    set("lowerarm01.R", r.forearmFix - 1.2 + tk * 0.4);
  }
  if (r.carry) {
    // One hand up at the rim of the head tray, out to the side, steadying it.
    // The hand on the rim of the basin, out to the side of the head (two-bone IK).
    set("clavicle.R", 0, 0, 0.12);
    reachTo(r, "R", new THREE.Vector3(-0.3, 0.23, 0.02));
  }
  if (r.talk > 0) r.talk -= dt;
}

const _v = { s: new THREE.Vector3(), e: new THREE.Vector3(), w: new THREE.Vector3(), t: new THREE.Vector3(), a: new THREE.Vector3(), b: new THREE.Vector3() };
const _q = { d: new THREE.Quaternion(), p: new THREE.Quaternion(), c: new THREE.Quaternion() };
/** Rotate a bone by a world-space rotation, keeping the change in its local quaternion. */
function rotateWorld(bone: THREE.Bone, delta: THREE.Quaternion) {
  bone.getWorldQuaternion(_q.c);
  (bone.parent as THREE.Object3D).getWorldQuaternion(_q.p);
  bone.quaternion.copy(_q.p.invert().multiply(delta).multiply(_q.c));
  bone.updateMatrixWorld(true);
}
/** Two-bone IK: put a hand at a point given in the head bone's frame (x across, y up, z forward). */
function reachTo(r: HumanRig, side: "L" | "R", local: THREE.Vector3) {
  const B = r.bones;
  const up = B[`upperarm01.${side}`], lo = B[`lowerarm01.${side}`], wr = B[`wrist.${side}`], head = B.head;
  if (!up || !lo || !wr || !head) return;
  r.root.updateMatrixWorld(true);
  const { s, e, w, t, a, b } = _v;
  head.localToWorld(t.copy(local));
  up.getWorldPosition(s); lo.getWorldPosition(e); wr.getWorldPosition(w);
  const la = s.distanceTo(e), lb = e.distanceTo(w);
  const lc = THREE.MathUtils.clamp(s.distanceTo(t), Math.abs(la - lb) + 1e-3, la + lb - 1e-3);
  // Elbow: bend to the angle that makes the shoulder-to-hand distance right.
  a.copy(s).sub(e).normalize(); b.copy(w).sub(e).normalize();
  const cur = Math.acos(THREE.MathUtils.clamp(a.dot(b), -1, 1));
  const want = Math.acos(THREE.MathUtils.clamp((la * la + lb * lb - lc * lc) / (2 * la * lb), -1, 1));
  const axis = new THREE.Vector3().crossVectors(a, b);
  if (axis.lengthSq() < 1e-8) axis.set(1, 0, 0); else axis.normalize();
  rotateWorld(lo, _q.d.setFromAxisAngle(axis, want - cur));
  // Shoulder: swing the whole arm so the hand lands on the target.
  wr.getWorldPosition(w);
  a.copy(w).sub(s).normalize(); b.copy(t).sub(s).normalize();
  rotateWorld(up, _q.d.setFromUnitVectors(a, b));
}

/** Attach something to the top of a person's head (vendors' trays). */
export function headTop(r: HumanRig) {
  return r.bones.head;
}

// ---------------------------------------------------------------------------
// Shoes: real shapes on the feet, not tinted skin.

const shoeGeo = {
  box: new THREE.BoxGeometry(1, 1, 1),
  sphere: new THREE.SphereGeometry(1, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2),
  cyl: new THREE.CylinderGeometry(1, 1, 1, 16),
  torus: new THREE.TorusGeometry(1, 0.14, 6, 20, Math.PI),
};
const shoeMats = new Map<string, THREE.Material>();
const shoeMat = (c: string, rough: number) => {
  const k = `${c}:${rough}`;
  let m = shoeMats.get(k);
  if (!m) { m = new THREE.MeshStandardMaterial({ color: c, roughness: rough, metalness: rough < 0.3 ? 0.1 : 0 }); shoeMats.set(k, m); }
  return m;
};

/** A shoe in the foot bone's frame (bones have no rest rotation, so it's world axes offset from the ankle). */
function buildShoe(kind: ShoeId, look: PersonLook, ankle: THREE.Vector3, toe: THREE.Vector3): THREE.Group | null {
  if (kind === "barefoot") return null;
  const g = new THREE.Group();
  const dir = new THREE.Vector2(toe.x - ankle.x, toe.z - ankle.z).normalize();
  const fem = look.feminine;
  const L = fem ? 0.245 : 0.275, W = fem ? 0.088 : 0.102;
  const heelZ = -0.065, mid = heelZ + L / 2;
  const add = (geo: THREE.BufferGeometry, mat: THREE.Material, pos: [number, number, number], scale: [number, number, number], rot: [number, number, number] = [0, 0, 0]) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(...pos);
    m.scale.set(...scale);
    m.rotation.set(...rot);
    m.castShadow = true;
    g.add(m);
  };
  const seed = look.shirt.charCodeAt(1) + look.pants.charCodeAt(2);
  if (kind === "sneakers") {
    const upper = ["#f2f2ef", "#1b1b1d", "#c2402a", "#2e4a6b", "#e9a50b"][seed % 5];
    add(shoeGeo.box, shoeMat("#f4f2ec", 0.6), [0, 0.016, mid], [W, 0.032, L]);
    add(shoeGeo.sphere, shoeMat(upper, 0.55), [0, 0.03, mid + 0.005], [W * 0.5, 0.062, L * 0.5]);
    add(shoeGeo.box, shoeMat(upper === "#f2f2ef" ? "#c2402a" : "#f4f2ec", 0.5), [0, 0.05, mid], [W * 1.02, 0.012, L * 0.4]);
  } else if (kind === "formal") {
    const upper = ["#140d08", "#3a2214", "#140d08"][seed % 3];
    add(shoeGeo.box, shoeMat("#0e0906", 0.5), [0, 0.011, mid], [W * 0.95, 0.022, L]);
    add(shoeGeo.box, shoeMat("#0e0906", 0.5), [0, 0.02, heelZ + 0.035], [W * 0.85, 0.04, 0.06]);
    add(shoeGeo.sphere, shoeMat(upper, 0.22), [0, 0.022, mid + 0.01], [W * 0.47, 0.056, L * 0.5]);
  } else if (kind === "sandals") {
    // Charlie wote: a rubber sole and a thong strap; the foot stays bare.
    const col = ["#1b1b1d", "#2e4a6b", "#c2402a", "#6b3a22"][seed % 4];
    add(shoeGeo.box, shoeMat(col, 0.8), [0, 0.008, mid], [W * 1.02, 0.016, L * 1.02]);
    add(shoeGeo.torus, shoeMat(col, 0.7), [0, 0.03, mid + 0.04], [W * 0.46, 0.035, 0.05], [0, 0, 0]);
  } else if (kind === "heels") {
    const col = ["#1c1c1e", "#b08d57", "#c2402a", "#6b3a22"][seed % 4];
    add(shoeGeo.box, shoeMat(col, 0.35), [0, 0.035, heelZ + 0.02], [0.022, 0.07, 0.024]);
    add(shoeGeo.box, shoeMat(col, 0.35), [0, 0.008, mid + 0.04], [W * 0.92, 0.016, L * 0.62]);
    add(shoeGeo.sphere, shoeMat(col, 0.3), [0, 0.012, mid + 0.03], [W * 0.46, 0.04, L * 0.38]);
  } else if (kind === "boots") {
    const col = ["#3a2214", "#1b1b1d", "#6b4a2a"][seed % 3];
    add(shoeGeo.box, shoeMat("#120c08", 0.7), [0, 0.016, mid], [W * 1.02, 0.032, L]);
    add(shoeGeo.sphere, shoeMat(col, 0.6), [0, 0.03, mid + 0.01], [W * 0.52, 0.066, L * 0.5]);
    add(shoeGeo.cyl, shoeMat(col, 0.6), [0, 0.13, 0], [W * 0.55, 0.2, W * 0.6]);
  }
  // Into the foot bone's frame: rotate to the foot's direction, drop to the ground.
  g.rotation.y = Math.atan2(dir.x, dir.y);
  g.position.set(0, -ankle.y, 0);
  return g;
}
