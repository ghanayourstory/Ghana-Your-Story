// The Gulf of Guinea: a custom shader with rolling swell, Fresnel sky
// reflection, sun glitter and white foam where waves break on the sand.
import * as THREE from "three";

const vert = /* glsl */ `
uniform float uTime;
uniform float uShore;
varying vec3 vWorld;
varying vec3 vNormal;
varying float vFoam;

vec3 wave(vec2 p, vec2 dir, float amp, float len, float speed, inout vec3 n) {
  float k = 6.28318 / len;
  float f = k * dot(dir, p) - uTime * speed;
  n.xz -= dir * amp * k * cos(f);
  return vec3(0.0, amp * sin(f), 0.0);
}

void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vec3 n = vec3(0.0, 1.0, 0.0);
  float distShore = max(0.0, w.z - uShore);
  float damp = smoothstep(0.0, 18.0, distShore);
  vec3 off = vec3(0.0);
  off += wave(w.xz, normalize(vec2(0.15, -1.0)), 0.45 * damp + 0.05, 22.0, 1.3, n);
  off += wave(w.xz, normalize(vec2(-0.4, -1.0)), 0.22 * damp + 0.03, 11.0, 1.9, n);
  off += wave(w.xz, normalize(vec2(0.7, -0.6)), 0.08, 4.5, 2.7, n);
  w.xyz += off;
  vWorld = w.xyz;
  vNormal = normalize(n);
  // Breaking-wave foam band that rolls up the beach.
  float surge = sin(w.x * 0.07 + uTime * 0.9) * 1.2 + sin(uTime * 0.55) * 1.6;
  vFoam = 1.0 - smoothstep(0.0, 5.0 + surge, distShore);
  gl_Position = projectionMatrix * viewMatrix * w;
}
`;

const frag = /* glsl */ `
uniform vec3 uSunDir;
uniform vec3 uSunColor;
uniform vec3 uSky;
uniform vec3 uDeep;
uniform vec3 uShallow;
uniform float uTime;
uniform float uNight;
varying vec3 vWorld;
varying vec3 vNormal;
varying float vFoam;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
}

void main() {
  vec3 V = normalize(cameraPosition - vWorld);
  vec2 ripple = vec2(noise(vWorld.xz * 0.6 + uTime * 0.4), noise(vWorld.xz * 0.6 - uTime * 0.35)) - 0.5;
  vec3 N = normalize(vNormal + vec3(ripple.x, 0.0, ripple.y) * 0.35);
  float fres = pow(1.0 - max(dot(N, V), 0.0), 4.0);
  float depthMix = smoothstep(0.0, 1.0, vFoam * 1.2);
  vec3 water = mix(uDeep, uShallow, depthMix * 0.8 + 0.1);
  vec3 col = mix(water, uSky, clamp(fres * 0.85 + 0.08, 0.0, 1.0));
  vec3 H = normalize(uSunDir + V);
  float spec = pow(max(dot(N, H), 0.0), 220.0) * 6.0 + pow(max(dot(N, H), 0.0), 30.0) * 0.25;
  col += uSunColor * spec * (1.0 - uNight * 0.9);
  float foamNoise = noise(vWorld.xz * 1.8 + vec2(uTime * 0.6, uTime * 0.2));
  float foam = smoothstep(0.35, 0.9, vFoam * (0.7 + foamNoise * 0.6));
  col = mix(col, vec3(0.95, 0.97, 0.96) * (1.0 - uNight * 0.75), foam);
  float alpha = mix(0.92, 0.6, vFoam * (1.0 - foam));
  gl_FragColor = vec4(col, alpha);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

export function createOcean(shoreZ: number) {
  const geo = new THREE.PlaneGeometry(260, 140, 160, 90);
  geo.rotateX(-Math.PI / 2);
  const uniforms = {
    uTime: { value: 0 },
    uShore: { value: shoreZ },
    uSunDir: { value: new THREE.Vector3(0, 1, 0) },
    uSunColor: { value: new THREE.Color("#fff3d6") },
    uSky: { value: new THREE.Color("#9cc7e6") },
    uDeep: { value: new THREE.Color("#0b4a5c") },
    uShallow: { value: new THREE.Color("#2aa7a0") },
    uNight: { value: 0 },
  };
  const mat = new THREE.ShaderMaterial({ vertexShader: vert, fragmentShader: frag, uniforms, transparent: true });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(0, -0.15, shoreZ + 66);
  mesh.renderOrder = 1;
  return {
    mesh,
    update(t: number, sunDir: THREE.Vector3, sky: THREE.Color, night: number) {
      uniforms.uTime.value = t;
      uniforms.uSunDir.value.copy(sunDir);
      uniforms.uSky.value.copy(sky);
      uniforms.uNight.value = night;
      uniforms.uDeep.value.setRGB(0.04 * (1 - night) + 0.01, 0.29 * (1 - night) + 0.03, 0.36 * (1 - night) + 0.06);
      uniforms.uShallow.value.setRGB(0.16 * (1 - night) + 0.02, 0.65 * (1 - night) + 0.06, 0.63 * (1 - night) + 0.08);
    },
    dispose() {
      geo.dispose();
      mat.dispose();
    },
  };
}
