// Static geometry batching: everything that never moves is merged per
// material so a whole district renders in a few dozen draw calls.
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

export class Batcher {
  private buckets = new Map<THREE.Material, THREE.BufferGeometry[]>();
  private tmp = new THREE.Object3D();

  add(geometry: THREE.BufferGeometry, material: THREE.Material, pos: [number, number, number], rot: [number, number, number] = [0, 0, 0], scale: [number, number, number] = [1, 1, 1]) {
    this.tmp.position.set(...pos);
    this.tmp.rotation.set(...rot);
    this.tmp.scale.set(...scale);
    this.tmp.updateMatrix();
    this.addMatrix(geometry, material, this.tmp.matrix);
  }

  addMatrix(geometry: THREE.BufferGeometry, material: THREE.Material, m: THREE.Matrix4) {
    let g = geometry.index ? geometry.toNonIndexed() : geometry.clone();
    g.applyMatrix4(m);
    for (const name of Object.keys(g.attributes)) if (!["position", "normal", "uv"].includes(name)) g.deleteAttribute(name);
    if (!g.attributes.uv) {
      g.setAttribute("uv", new THREE.Float32BufferAttribute(new Float32Array((g.attributes.position.count) * 2), 2));
    }
    g.clearGroups();
    let list = this.buckets.get(material);
    if (!list) {
      list = [];
      this.buckets.set(material, list);
    }
    list.push(g);
    g = null as never;
  }

  build(opts: { castShadow?: boolean; receiveShadow?: boolean } = {}): THREE.Group {
    const group = new THREE.Group();
    for (const [mat, list] of this.buckets) {
      const merged = mergeGeometries(list, false);
      if (!merged) continue;
      merged.computeBoundingSphere();
      const mesh = new THREE.Mesh(merged, mat);
      mesh.castShadow = opts.castShadow ?? true;
      mesh.receiveShadow = opts.receiveShadow ?? true;
      mesh.matrixAutoUpdate = false;
      group.add(mesh);
      for (const g of list) g.dispose();
    }
    this.buckets.clear();
    return group;
  }
}

export const G = {
  box: new THREE.BoxGeometry(1, 1, 1),
  cyl: new THREE.CylinderGeometry(1, 1, 1, 16),
  cyl8: new THREE.CylinderGeometry(1, 1, 1, 8),
  cone: new THREE.ConeGeometry(1, 1, 16),
  sphere: new THREE.SphereGeometry(1, 14, 10),
  ico: new THREE.IcosahedronGeometry(1, 1),
  plane: new THREE.PlaneGeometry(1, 1),
};

/** A box whose UVs are in metres / tile, so a 3 m facade tile repeats per storey. */
export function facadeBox(w: number, h: number, d: number, tile = 6): THREE.BufferGeometry {
  const g = new THREE.BoxGeometry(w, h, d);
  const uv = g.attributes.uv as THREE.BufferAttribute;
  for (let i = 0; i < uv.count; i++) {
    const face = Math.floor(i / 4);
    let su = 1, sv = 1;
    if (face < 2) { su = d / tile; sv = h / tile; }
    else if (face < 4) { su = w / tile; sv = d / tile; }
    else { su = w / tile; sv = h / tile; }
    uv.setXY(i, uv.getX(i) * su, uv.getY(i) * sv);
  }
  return g;
}

export function tiledPlane(w: number, h: number, tile: number) {
  const g = new THREE.PlaneGeometry(w, h);
  const uv = g.attributes.uv as THREE.BufferAttribute;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, (uv.getX(i) * w) / tile, (uv.getY(i) * h) / tile);
  return g;
}
