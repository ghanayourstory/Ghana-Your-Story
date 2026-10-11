// Sky, sun, moon, fog, clouds, rain and lightning — driven by the game clock
// and the server's weather. Accra sits ~5.6°N, so the sun climbs almost
// straight overhead and sets fast around 18:15.
import * as THREE from "three";
import { Sky } from "three/examples/jsm/objects/Sky.js";
import { clouds } from "./textures.ts";
import type { Weather } from "../../shared/calendar.ts";

export class Atmosphere {
  sky = new Sky();
  sun = new THREE.DirectionalLight("#fff4e0", 3);
  moon = new THREE.DirectionalLight("#9fb4ff", 0);
  hemi = new THREE.HemisphereLight("#cfe6ff", "#8a6a4a", 0.6);
  sunDir = new THREE.Vector3();
  skyColor = new THREE.Color();
  night = 0; // 0 day … 1 full night
  private pmrem: THREE.PMREMGenerator;
  private envScene = new THREE.Scene();
  private envSky = new Sky();
  private envRT: THREE.WebGLRenderTarget | null = null;
  private lastEnvKey = "";
  private cloudMesh: THREE.Mesh;
  private stars: THREE.Points;
  private rain: THREE.LineSegments;
  private rainPos: Float32Array;
  private flash = 0;
  private weather: Weather = "sunny";
  private wetness = 0;
  fogColor = new THREE.Color("#c9d8e6");

  constructor(private scene: THREE.Scene, private renderer: THREE.WebGLRenderer, shadowSize: number) {
    this.sky.scale.setScalar(4500);
    scene.add(this.sky);
    this.envSky.scale.setScalar(4500);
    this.envScene.add(this.envSky);
    this.pmrem = new THREE.PMREMGenerator(renderer);

    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(shadowSize, shadowSize);
    const cam = this.sun.shadow.camera;
    cam.left = -48; cam.right = 48; cam.top = 48; cam.bottom = -48;
    cam.near = 1; cam.far = 260;
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.03;
    this.sun.shadow.radius = 3;
    scene.add(this.sun, this.sun.target, this.moon, this.moon.target, this.hemi);

    scene.fog = new THREE.Fog(this.fogColor, 60, 340);

    const cm = new THREE.MeshBasicMaterial({ map: clouds(), transparent: true, depthWrite: false, fog: false, opacity: 0.6 });
    cm.map!.repeat.set(2, 2);
    this.cloudMesh = new THREE.Mesh(new THREE.PlaneGeometry(1600, 1600), cm);
    this.cloudMesh.rotation.x = Math.PI / 2;
    this.cloudMesh.position.y = 140;
    scene.add(this.cloudMesh);

    const sp: number[] = [];
    for (let i = 0; i < 1600; i++) {
      const v = new THREE.Vector3().randomDirection();
      if (v.y < 0.05) v.y = -v.y + 0.05;
      v.multiplyScalar(1400);
      sp.push(v.x, v.y, v.z);
    }
    this.stars = new THREE.Points(new THREE.BufferGeometry().setAttribute("position", new THREE.Float32BufferAttribute(sp, 3)), new THREE.PointsMaterial({ color: "#ffffff", size: 2.2, sizeAttenuation: false, transparent: true, opacity: 0, fog: false, depthWrite: false }));
    scene.add(this.stars);

    const N = 2400;
    this.rainPos = new Float32Array(N * 6);
    for (let i = 0; i < N; i++) this.resetDrop(i, new THREE.Vector3(), true);
    const rg = new THREE.BufferGeometry().setAttribute("position", new THREE.BufferAttribute(this.rainPos, 3));
    this.rain = new THREE.LineSegments(rg, new THREE.LineBasicMaterial({ color: "#aebfcc", transparent: true, opacity: 0.45, depthWrite: false }));
    this.rain.frustumCulled = false;
    this.rain.visible = false;
    scene.add(this.rain);
  }

  private resetDrop(i: number, c: THREE.Vector3, randomY = false) {
    const x = c.x + (Math.random() - 0.5) * 70, z = c.z + (Math.random() - 0.5) * 70;
    const y = randomY ? Math.random() * 30 : 24 + Math.random() * 8;
    this.rainPos.set([x, y, z, x + 0.06, y - 0.9, z + 0.02], i * 6);
  }

  setWeather(w: Weather) {
    this.weather = w;
  }

  /** hour: fractional game hour. focus: where the player is (shadows follow). */
  update(hour: number, dt: number, focus: THREE.Vector3, cameraPos: THREE.Vector3) {
    const w = this.weather;
    const rainy = w === "rain" || w === "storm";
    // Sun path.
    const dayT = (hour - 6.0) / 12.25; // 0 at sunrise, 1 at sunset
    const elev = Math.sin(dayT * Math.PI) * THREE.MathUtils.degToRad(78);
    const az = THREE.MathUtils.lerp(Math.PI * 0.5, -Math.PI * 0.5, dayT); // east → west
    const e = dayT >= 0 && dayT <= 1 ? elev : -THREE.MathUtils.degToRad(12) * Math.sin(Math.min(1, Math.abs(dayT - (dayT < 0 ? 0 : 1)) * 4) * Math.PI / 2);
    this.sunDir.set(Math.sin(az) * Math.cos(e), Math.sin(e), 0.25 * Math.cos(e));
    this.sunDir.normalize();
    const sunUp = THREE.MathUtils.clamp(this.sunDir.y * 5 + 0.15, 0, 1);
    this.night = 1 - sunUp;

    const u = this.sky.material.uniforms;
    const turb = w === "hazy" ? 16 : rainy ? 14 : w === "cloudy" ? 8 : 3.2;
    const ray = w === "hazy" ? 0.9 : rainy ? 0.6 : 2.0;
    for (const s of [this.sky, this.envSky]) {
      const su = s.material.uniforms;
      su.turbidity.value = turb;
      su.rayleigh.value = ray;
      su.mieCoefficient.value = w === "hazy" ? 0.03 : 0.006;
      su.mieDirectionalG.value = 0.82;
      su.sunPosition.value.copy(this.sunDir).multiplyScalar(1000);
    }
    void u;

    // Lights.
    const golden = THREE.MathUtils.clamp(1 - this.sunDir.y * 3, 0, 1);
    const overcast = rainy ? 0.35 : w === "cloudy" ? 0.65 : w === "hazy" ? 0.75 : 1;
    this.sun.color.setRGB(1, 0.93 - golden * 0.25, 0.82 - golden * 0.42);
    this.sun.intensity = sunUp * 3.4 * overcast;
    this.sun.position.copy(focus).addScaledVector(this.sunDir, 120);
    this.sun.target.position.copy(focus);
    this.sun.castShadow = sunUp > 0.05;
    this.moon.intensity = this.night * 0.45;
    this.moon.position.copy(focus).add(new THREE.Vector3(-40, 90, -30));
    this.moon.target.position.copy(focus);
    this.hemi.intensity = 0.25 + sunUp * 0.5 * (rainy ? 1.2 : 1) + this.flash * 4;
    this.hemi.color.setRGB(0.75 + 0.1 * sunUp, 0.82 + 0.08 * sunUp, 1);
    this.hemi.groundColor.setRGB(0.4 * sunUp + 0.05, 0.3 * sunUp + 0.05, 0.22 * sunUp + 0.08);

    // Fog and horizon colour.
    const fogDay = w === "hazy" ? new THREE.Color("#d9cdb2") : rainy ? new THREE.Color("#8f9aa3") : w === "cloudy" ? new THREE.Color("#b9c6cf") : new THREE.Color("#bcd6ea");
    const fogDusk = new THREE.Color("#e7a36b");
    const fogNight = new THREE.Color("#0d1424");
    this.fogColor.copy(fogDay).lerp(fogDusk, golden * sunUp * 0.6).lerp(fogNight, this.night);
    const fog = this.scene.fog as THREE.Fog;
    fog.color.copy(this.fogColor);
    fog.near = w === "hazy" ? 45 : rainy ? 25 : 80;
    fog.far = w === "hazy" ? 300 : rainy ? 190 : 420;
    this.skyColor.copy(fogDay).lerp(fogNight, this.night);

    this.renderer.toneMappingExposure = 0.62 + sunUp * 0.12 + this.night * 0.25;

    // Clouds.
    const cmat = this.cloudMesh.material as THREE.MeshBasicMaterial;
    cmat.opacity = (rainy ? 0.95 : w === "cloudy" ? 0.85 : w === "hazy" ? 0.25 : 0.35) * (1 - this.night * 0.7);
    cmat.color.setRGB(rainy ? 0.55 : 1, rainy ? 0.58 : 1, rainy ? 0.62 : 1).multiplyScalar(0.25 + sunUp * 0.75);
    cmat.map!.offset.x += dt * 0.002;
    this.cloudMesh.position.x = focus.x;
    this.cloudMesh.position.z = focus.z;
    (this.stars.material as THREE.PointsMaterial).opacity = this.night * (rainy || w === "cloudy" ? 0.15 : 0.9);
    this.stars.position.copy(cameraPos);

    // Rain.
    this.rain.visible = rainy;
    this.wetness = THREE.MathUtils.clamp(this.wetness + (rainy ? dt * 0.05 : -dt * 0.01), 0, 1);
    if (rainy) {
      const speed = w === "storm" ? 38 : 26;
      const n = this.rainPos.length / 6;
      for (let i = 0; i < n; i++) {
        const o = i * 6;
        this.rainPos[o + 1] -= speed * dt;
        this.rainPos[o + 4] -= speed * dt;
        this.rainPos[o + 3] = this.rainPos[o] + (w === "storm" ? 0.4 : 0.06);
        if (this.rainPos[o + 4] < 0) this.resetDrop(i, focus);
      }
      (this.rain.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
      if (w === "storm" && Math.random() < dt * 0.08) this.flash = 1;
    }
    this.flash = Math.max(0, this.flash - dt * 3.5);

    // Environment reflections, refreshed when the sky changes noticeably.
    const key = `${Math.round(hour * 4)}:${w}`;
    if (key !== this.lastEnvKey) {
      this.lastEnvKey = key;
      const rt = this.pmrem.fromScene(this.envScene, 0, 0.1, 5000);
      this.scene.environment = rt.texture;
      this.scene.environmentIntensity = 0.35 + sunUp * 0.65;
      this.envRT?.dispose();
      this.envRT = rt;
    }
  }

  get isWet() {
    return this.wetness;
  }
  get lightning() {
    return this.flash;
  }
}
