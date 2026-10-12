// Real car models (CC BY 4.0, see public/vehicles/CREDITS.md). Loaded once,
// normalised to real size with the nose pointing +z, then cloned per car with
// its own paint colour. Kinds without a model fall back to the procedural ones.
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

interface ModelDef {
  file: string;
  /** Real bumper-to-bumper length in metres. */
  length: number;
  /** Extra rotation (radians about +y) so the nose points +z. */
  yaw: number;
  /** Material names that are body paint (recoloured per car). */
  paint: RegExp;
  /** Paint colours to pick from; null keeps the original paint. */
  colors: string[] | null;
  /** Drop the paint texture (liveries, decals) so the colour shows clean. */
  stripMap?: boolean;
  /** Hide meshes using these materials (taxi roof sign on a private car). */
  hide?: RegExp;
  /** Ghana taxi livery: body colour with yellow front and rear quarters. */
  ghanaTaxi?: boolean;
}

const DEFS: Record<string, ModelDef> = {
  ghana_taxi: { file: "crownvic_taxi.glb", length: 5.1, yaw: 0, paint: /^main_frame$/, colors: ["#e6e2d8", "#c9ccd0", "#d8d2c2", "#b7bcc2", "#8a1c1c", "#2d3a4a"], stripMap: true, ghanaTaxi: true },
  saloon_car: { file: "crownvic_taxi.glb", length: 5.1, yaw: 0, paint: /^main_frame$/, colors: ["#b9c4cc", "#7A2E2E", "#1f3a5f", "#e8e8e6", "#2b2b2b", "#3b4a54", "#556B2F", "#9aa3ad"], stripMap: true, hide: /taxi_sign/ },
  police: { file: "crownvic_police.glb", length: 5.39, yaw: 0, paint: /^main_frame$/, colors: null },
  century: { file: "century_1997.glb", length: 5.12, yaw: 0, paint: /Maroon|edge_color303030255/, colors: ["#141414", "#f0efea", "#6e1f24", "#2d3a4a", "#9aa3ad", "#c9c2b0", "#1f3a5f"] },
  landcruiser: { file: "landcruiser_fj40.glb", length: 3.84, yaw: 0, paint: /BODYPAINT/, colors: ["#e9e6dc", "#9b2d1f", "#2f4a2c", "#1f3a5f", "#c9a227", "#b9c4cc", "#151515"] },
  porsche: { file: "porsche_930.glb", length: 4.29, yaw: 0, paint: /^Material\.002$/, colors: ["#c8152c", "#f2f2ee", "#151515", "#e8b100", "#1d4fa0"] },
  corvette: { file: "corvette_c6.glb", length: 4.43, yaw: 0, paint: /Base1$/, colors: ["#c8152c", "#e8b100", "#151515", "#f2f2ee", "#1d4fa0"] },
  countach: { file: "countach.glb", length: 4.14, yaw: 0, paint: /CarPaint/, colors: ["#e8b100", "#c8152c", "#f2f2ee", "#151515", "#2a7a3a"] },
};

/** Which real models play which in-game kind. */
const KIND_MODELS: Record<string, string[]> = {
  taxi: ["ghana_taxi"],
  police: ["police"],
  sedan: ["saloon_car", "century", "saloon_car"],
  compact: ["saloon_car", "century"],
  accordo: ["century"],
  saloon: ["century"],
  phantom: ["century"],
  suv: ["landcruiser"],
  v8: ["landcruiser"],
  pickup: ["landcruiser"],
  supercar: ["countach", "corvette", "porsche"],
};

interface Loaded {
  scene: THREE.Group;
  length: number;
  width: number;
  height: number;
  def: ModelDef;
}
const loaded = new Map<string, Loaded>();
let loading: Promise<boolean> | null = null;

export function loadCarModels(): Promise<boolean> {
  loading ??= (async () => {
    const loader = new GLTFLoader();
    const files = new Map<string, Promise<{ scene: THREE.Group }>>();
    const results = await Promise.allSettled(Object.entries(DEFS).map(async ([id, def]) => {
      if (!files.has(def.file)) files.set(def.file, loader.loadAsync(new URL(`vehicles/${def.file}`, document.baseURI).href));
      const gltf = { scene: (await files.get(def.file)!).scene.clone(true) };
      const root = new THREE.Group();
      const inner = gltf.scene;
      inner.rotation.y = def.yaw;
      root.add(inner);
      root.updateMatrixWorld(true);
      let box = new THREE.Box3().setFromObject(inner);
      const size = box.getSize(new THREE.Vector3());
      // Longest horizontal axis is the length; make sure it runs along z.
      if (size.x > size.z) {
        inner.rotation.y += Math.PI / 2;
        root.updateMatrixWorld(true);
        box = new THREE.Box3().setFromObject(inner);
      }
      const s = def.length / box.getSize(new THREE.Vector3()).z;
      inner.scale.multiplyScalar(s);
      root.updateMatrixWorld(true);
      box = new THREE.Box3().setFromObject(inner);
      const c = box.getCenter(new THREE.Vector3());
      inner.position.sub(new THREE.Vector3(c.x, box.min.y, c.z));
      root.updateMatrixWorld(true);
      box = new THREE.Box3().setFromObject(root);
      const sz = box.getSize(new THREE.Vector3());
      const hidden: THREE.Object3D[] = [];
      inner.traverse((o) => {
        const m = o as THREE.Mesh;
        if (!m.isMesh) return;
        m.castShadow = true;
        m.receiveShadow = true;
        const mats = (Array.isArray(m.material) ? m.material : [m.material]).map((x) => x.clone()) as THREE.MeshStandardMaterial[];
        for (const mat of mats) {
          if (def.hide?.test(mat.name)) hidden.push(m);
          if (/glass|window/i.test(mat.name)) { mat.transparent = true; mat.opacity = Math.min(mat.opacity, 0.55); mat.roughness = 0.05; }
          if (def.paint.test(mat.name)) {
            mat.side = THREE.DoubleSide;
            mat.roughness = Math.min(mat.roughness, 0.32);
            mat.metalness = Math.max(mat.metalness, 0.3);
            if (def.stripMap) { mat.map = null; mat.color.set("#ffffff"); }
            if (def.ghanaTaxi) ghanaTaxiShader(mat, m.geometry);
            mat.needsUpdate = true;
          }
        }
        m.material = Array.isArray(m.material) ? mats : mats[0];
      });
      for (const h of hidden) h.removeFromParent();
      loaded.set(id, { scene: root, length: sz.z, width: sz.x, height: sz.y, def });
    }));
    return results.some((r) => r.status === "fulfilled");
  })();
  return loading;
}

/** Yellow front and rear quarters, like every Ghanaian taxi. */
function ghanaTaxiShader(mat: THREE.MeshStandardMaterial, geo: THREE.BufferGeometry) {
  geo.computeBoundingBox();
  const b = geo.boundingBox!;
  const size = b.getSize(new THREE.Vector3());
  const center = b.getCenter(new THREE.Vector3());
  // The car's length runs along the longest horizontal axis of the body mesh.
  const longest = Math.max(size.x, size.y, size.z);
  const axis = longest === size.x ? new THREE.Vector3(1, 0, 0) : longest === size.y ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(0, 0, 1);
  const half = longest / 2;
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uAxis = { value: axis };
    sh.uniforms.uCenter = { value: center };
    sh.uniforms.uHalf = { value: half };
    sh.vertexShader = sh.vertexShader.replace("#include <common>", "#include <common>\nuniform vec3 uAxis; uniform vec3 uCenter; uniform float uHalf; varying float vAlong;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvAlong = abs(dot(position - uCenter, uAxis)) / uHalf;");
    sh.fragmentShader = sh.fragmentShader.replace("#include <common>", "#include <common>\nvarying float vAlong;")
      .replace("#include <color_fragment>", "#include <color_fragment>\nif (vAlong > 0.58) diffuseColor.rgb = vec3(0.95, 0.72, 0.02);");
  };
  mat.customProgramCacheKey = () => "ghana-taxi";
}

export function hasRealModel(kind: string): boolean {
  return (KIND_MODELS[kind] ?? []).some((id) => loaded.has(id));
}

const paintCache = new Map<string, THREE.Material>();

/** A clone of a real model for this kind, with its own paint. */
export function realCar(kind: string, seed: number): { group: THREE.Group; length: number; width: number; height: number } | null {
  const ids = (KIND_MODELS[kind] ?? []).filter((id) => loaded.has(id));
  if (!ids.length) return null;
  const h = Math.imul(seed ^ 0x9e3779b9, 2654435761) >>> 0;
  const id = ids[h % ids.length];
  const m = loaded.get(id)!;
  const group = m.scene.clone(true);
  const colors = kind === "v8" ? ["#111111", "#151515", "#f2f2ee"] : kind === "phantom" ? ["#141414", "#2a2340"] : m.def.colors;
  if (colors) {
    const color = colors[(h >>> 11) % colors.length];
    group.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      const swap = (mat: THREE.Material) => {
        if (!m.def.paint.test(mat.name)) return mat;
        const key = `${id}:${mat.uuid}:${color}`;
        let p = paintCache.get(key);
        if (!p) {
          p = (mat as THREE.MeshStandardMaterial).clone();
          (p as THREE.MeshStandardMaterial).color.set(color);
          if (m.def.ghanaTaxi) ghanaTaxiShader(p as THREE.MeshStandardMaterial, mesh.geometry);
          paintCache.set(key, p);
        }
        return p;
      };
      mesh.material = Array.isArray(mesh.material) ? mesh.material.map(swap) : swap(mesh.material);
    });
  }
  return { group, length: m.length, width: m.width, height: m.height };
}
