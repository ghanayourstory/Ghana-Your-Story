// The 3D runtime: renderer, camera, player controller, district streaming,
// city life, atmosphere, interactions, interiors and sound.
import * as THREE from "three";
import { Atmosphere } from "./atmosphere.ts";
import { buildDistrict, ROAD_HALF, WALK_IN, WALK_OUT, CROSS_HALF, EXTENT_X, type DistrictScene, type Interactable } from "./district.ts";
import { CityLife } from "./life.ts";
import { animatePerson, buildPerson, setHumanMode, type Person, type PersonLook } from "./people.ts";
import { buildSite } from "./construction.ts";
import { buildHomeInterior, type Interior, type InteriorSpot, type SpotUse } from "./interiors.ts";
import { activityFx, applyPose, clearPose, findPath, fxFor, type Fx } from "./homelife.ts";
import type { HomeSpec } from "../../shared/homes.ts";
import { buildAircraft, buildVehicle, spinWheels, vehicleKindForModel, type AircraftKind, type VehicleKind, type VehicleRig } from "./vehicles.ts";
import { VEHICLES } from "../../shared/life.ts";
import { CityAudio } from "./audio.ts";
import { setMaxAnisotropy } from "./textures.ts";
import { PLACE_BY_ID, DISTRICTS, type DistrictId } from "../../shared/world.ts";
import { PLOTS } from "../../shared/economy.ts";
import { toGameDate, type Weather } from "../../shared/calendar.ts";
import type { GameState } from "../../server/engine.ts";

export type Quality = "low" | "medium" | "high";

export interface Nearby {
  kind: "npc" | "place" | "home" | "stop" | "plot" | "taxi" | "bed" | "exit" | "homespot";
  id: string;
  label: string;
}

export interface WorldCallbacks {
  onNearby: (n: Nearby | null) => void;
  onDiscover: (placeId: string) => void;
  onTick: (info: { road: string; district: DistrictId; x: number; z: number; yaw: number }) => void;
  onTaxiArrived: () => void;
  /** A ride started (show its banner) or ended (null). */
  onRide?: (r: { label: string; icon: string } | null) => void;
  /** You tapped something at home and walked up to it. */
  onSpot?: (id: InteriorSpot["id"]) => void;
  /** Doing something at home: progress 0..1, or null when done. */
  onActivity?: (a: { label: string; icon: string; p: number } | null) => void;
}

interface Doing {
  use: SpotUse;
  stand: THREE.Vector3;
  label: string;
  icon: string;
  t: number;
  dur: number;
  fx: Fx | null;
  lastReport: number;
  resolve: (ok: boolean) => void;
}

/** You, in a vehicle, actually travelling: pick-up, the drive out, the drive in, drop-off. */
interface Ride {
  icon: string;
  label: string;
  rig: VehicleRig | null;
  dir: number;
  phase: "pickup" | "board" | "out" | "fadeout" | "in" | "alight";
  x: number;
  lane: number;
  speed: number;
  max: number;
  stopX: number;
  t: number;
  pending: GameState | null;
  result: boolean | null;
  skip: boolean;
  resolve: (ok: boolean) => void;
}

const RIDE_ICON: Record<string, string> = { taxi: "🚕", ride: "🚗", trotro: "🚐", car: "🚙", bus: "🚌", vip: "🚍", walk: "🚶", flight: "✈️", own_plane: "🛩️" };

export class World {
  renderer: THREE.WebGLRenderer;
  scene = new THREE.Scene();
  interiorScene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(50, 1, 0.1, 2000);
  atmo: Atmosphere;
  audio = new CityAudio();
  district: DistrictScene | null = null;
  life: CityLife | null = null;
  player: Person | null = null;
  private lookKey = "";
  pos = new THREE.Vector3();
  vel = new THREE.Vector3();
  yaw = 0;
  camYaw = Math.PI;
  camPitch = 0.55;
  camDist = 13;
  private camTarget = new THREE.Vector3();
  private keys = new Set<string>();
  joy = { x: 0, y: 0 };
  run = false;
  private clock = new THREE.Clock();
  private gameMinute = 0;
  private minuteAt = performance.now();
  private weather: Weather = "sunny";
  private rings: THREE.Mesh[] = [];
  private jumpY = 0;
  private jumpYPrev = 0;
  private vy = 0;
  private boom = 13;
  private siteBox: { minX: number; maxX: number; minZ: number; maxZ: number } | null = null;
  /** A fixed pool of street-light point lights that follows the player (cheap on phones). */
  private lampPool: THREE.PointLight[] = [];
  private ringMat: THREE.MeshBasicMaterial;
  private site: THREE.Group | null = null;
  private siteKey = "";
  private parked: THREE.Group | null = null;
  private parkedKey = "";
  private discovered = new Set<string>();
  private reported = new Set<string>();
  private nearby: Nearby | null = null;
  private interior: Interior | null = null;
  private homeTierBuilt: HomeSpec["tier"] | "" = "";
  inside = false;
  private raf = 0;
  private tickAcc = 0;
  private state: GameState | null = null;
  private quality: Quality;
  private tiers = new Map<string, string>();
  private lastNpcHour = -1;
  paused = false;
  frozen = false; // while a dialogue is open
  talkingTo: string | null = null;
  private ride: Ride | null = null;
  private path: THREE.Vector3[] = [];
  private arriveCb: (() => void) | null = null;
  private doing: Doing | null = null;
  private raycaster = new THREE.Raycaster();
  private outsideCam: { yaw: number; pitch: number; dist: number } | null = null;
  private rideApplying = false;
  private leaving: { rig: VehicleRig; dir: number; speed: number }[] = [];
  private fadeEl: HTMLDivElement;
  private camPos = new THREE.Vector3();

  constructor(private canvas: HTMLCanvasElement, private cb: WorldCallbacks, quality: Quality) {
    this.quality = quality;
    setHumanMode(quality === "low" ? "key" : "all");
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: quality !== "low", powerPreference: "high-performance" });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, quality === "high" ? 2 : quality === "medium" ? 1.5 : 1));
    this.renderer.shadowMap.enabled = quality !== "low";
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    setMaxAnisotropy(this.renderer.capabilities.getMaxAnisotropy());
    this.atmo = new Atmosphere(this.scene, this.renderer, quality === "high" ? 2048 : 1024);
    this.ringMat = new THREE.MeshBasicMaterial({ color: "#F2B705", transparent: true, opacity: 0.8, depthWrite: false });
    this.interiorScene.background = new THREE.Color("#20262f");
    this.interiorScene.add(new THREE.HemisphereLight("#fff4e4", "#5a4632", 1.9));
    const idir = new THREE.DirectionalLight("#fff1d6", 2.2);
    idir.position.set(6, 14, 9);
    idir.castShadow = true;
    idir.shadow.mapSize.set(2048, 2048);
    idir.shadow.bias = -0.0004;
    Object.assign(idir.shadow.camera, { left: -16, right: 16, top: 16, bottom: -16, near: 1, far: 50 });
    this.interiorScene.add(idir);
    for (let i = 0; i < 6; i++) {
      const l = new THREE.PointLight("#ffc27a", 0, 22, 1.4);
      this.lampPool.push(l);
      this.scene.add(l);
    }
    this.fadeEl = document.createElement("div");
    Object.assign(this.fadeEl.style, { position: "fixed", inset: "0", background: "#07060a", opacity: "0", pointerEvents: "none", zIndex: "4" });
    document.body.appendChild(this.fadeEl);
    this.bindInput();
    this.resize();
    window.addEventListener("resize", this.resize);
    this.loop();
  }

  setQuality(q: Quality) {
    this.quality = q;
    setHumanMode(q === "low" ? "key" : "all");
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, q === "high" ? 2 : q === "medium" ? 1.5 : 1));
    this.renderer.shadowMap.enabled = q !== "low";
    this.resize();
  }

  private resize = () => {
    const w = this.canvas.clientWidth || window.innerWidth;
    const h = this.canvas.clientHeight || window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.fov = w < h ? 62 : 50;
    this.camera.updateProjectionMatrix();
  };

  // ---------------------------------------------------------------------------
  // State from the server

  setClock(minute: number) {
    this.gameMinute = minute;
    this.minuteAt = performance.now();
  }

  /** Smoothly interpolated game minute (1 game minute per real second). */
  get minuteNow() {
    return this.gameMinute + Math.min(150, (performance.now() - this.minuteAt) / 1000);
  }

  setState(s: GameState) {
    // Mid-ride the new place waits until the car has driven out of this one.
    if (this.ride && !this.rideApplying && (this.ride.phase === "pickup" || this.ride.phase === "board" || this.ride.phase === "out" || this.ride.phase === "fadeout")) {
      this.ride.pending = s;
      this.state = { ...s, player: { ...s.player, district: this.state?.player.district ?? s.player.district } };
      return;
    }
    this.state = s;
    this.setClock(s.time.minute);
    this.weather = s.time.weather;
    this.atmo.setWeather(s.time.weather);
    for (const r of s.relationships) this.tiers.set(r.npcId, r.tier);
    this.discovered = new Set(s.player.discovered);
    const look = s.player.look as PersonLook;
    const lk = JSON.stringify(look);
    if (lk !== this.lookKey) {
      this.lookKey = lk;
      const old = this.player;
      this.player = buildPerson(look, { key: true });
      if (old) old.root.parent?.remove(old.root);
      (this.inside ? this.interiorScene : this.scene).add(this.player.root);
    }
    const homeTier = s.player.home.district === s.player.district ? s.player.home.spec.tier : "";
    if (!this.district || this.district.id !== s.player.district || (homeTier !== this.homeTierBuilt && !this.inside)) {
      const keep = this.district?.id === s.player.district ? this.pos.clone() : null;
      this.loadDistrict(s.player.district, s);
      if (keep) this.pos.copy(keep);
    }
    this.updateSite(s);
    this.updateParked(s);
    if (this.district) this.district.homeLabel.visible = s.player.home.district === this.district.id;
    if (this.life) this.lastNpcHour = -1; // re-sync NPC labels with new tiers
  }

  private loadDistrict(id: DistrictId, s: GameState) {
    if (this.inside) this.exitHome();
    if (this.district) {
      this.scene.remove(this.district.group);
      this.district.dispose();
    }
    if (this.life) {
      this.scene.remove(this.life.group);
      this.life.dispose();
    }
    for (const r of this.rings) this.scene.remove(r);
    this.rings = [];
    for (const l of this.leaving) l.rig.group.removeFromParent();
    this.leaving = [];
    this.site = null;
    this.siteKey = "";
    this.parked = null;
    this.parkedKey = "";
    this.homeTierBuilt = s.player.home.district === id ? s.player.home.spec.tier : "";
    const d = buildDistrict(id, this.homeTierBuilt || undefined);
    this.district = d;
    this.scene.add(d.group);
    const gd = toGameDate(Math.floor(this.minuteNow));
    this.life = new CityLife(d);
    this.life.onHonk = (p) => this.audio.horn(p.distanceTo(this.pos));
    this.life.populate(gd.hour, gd.weekdayIndex);
    this.scene.add(this.life.group);
    this.audio.setSpots(d.soundSpots);
    this.lastNpcHour = -1;
    for (const it of d.interactables) {
      const ring = new THREE.Mesh(new THREE.RingGeometry(it.radius * 0.55, it.radius * 0.68, 40), this.ringMat);
      ring.rotation.x = -Math.PI / 2;
      ring.position.copy(it.pos).setY(0.2);
      this.scene.add(ring);
      this.rings.push(ring);
    }
    // Place the player: server position if it's sensible, else at the stop.
    const sp = s.player.pos;
    const candidate = new THREE.Vector3(sp.x, 0, sp.z);
    if (this.collides(candidate, 0.4) || Math.abs(sp.z) < ROAD_HALF) candidate.copy(d.spawn);
    this.pos.copy(candidate);
    this.camTarget.copy(this.pos);
    if (this.player) this.player.root.position.copy(this.pos);
  }

  private updateSite(s: GameState) {
    const d = this.district;
    if (!d) return;
    const plotType = Object.values(PLOTS).find((p) => p.district === d.id);
    const owned = plotType ? s.plots.find((p) => p.type === plotType.id) : undefined;
    const building = owned ? s.buildings.find((b) => b.plotId === owned.id) : undefined;
    const stagesDone = building ? (building.status === "complete" || building.status === "upgrading" ? building.plan.length + (building.design === "villa" ? 1 : 0) : building.stage) : 0;
    const key = JSON.stringify([owned?.id, building?.design, building?.quality, stagesDone, building?.status]);
    if (key === this.siteKey) return;
    this.siteKey = key;
    if (this.site) this.scene.remove(this.site);
    const side = Math.sign(d.plotSpot.z);
    this.site = buildSite({ owned: !!owned, owner: s.player.name, design: building?.design, quality: building?.quality, stagesDone: building?.status === "complete" || building?.status === "upgrading" ? Math.max(4, stagesDone) : stagesDone, totalStages: building?.plan.length ?? 4, building: building?.status === "building" }, side);
    this.site.position.copy(d.plotSpot);
    this.scene.add(this.site);
    // Once construction starts the site is solid.
    this.siteBox = building ? { minX: d.plotSpot.x - 7.5, maxX: d.plotSpot.x + 7.5, minZ: d.plotSpot.z - 6.5, maxZ: d.plotSpot.z + 6.5 } : null;
  }

  private updateParked(s: GameState) {
    const d = this.district;
    if (!d) return;
    const key = s.player.home.district === d.id || d.id === "airport_city" ? `${d.id}:${s.vehicles.map((v) => (v as { type: string }).type).join(",")}` : "";
    if (key === this.parkedKey) return;
    this.parkedKey = key;
    if (this.parked) this.scene.remove(this.parked);
    this.parked = new THREE.Group();
    let x = d.homeDoor.x + 3.4;
    // Your aircraft wait on the apron at Airport City.
    if (d.id === "airport_city") {
      s.vehicles.map((v) => (v as { type: string }).type).filter((t) => VEHICLES[t]?.category === "aircraft").forEach((t, i) => {
        const a = buildAircraft(VEHICLES[t].model as AircraftKind, "#f4f4f2", "#b08d57");
        a.position.set(-62 + (i % 2) * 9 - 4.5, 0, -74 + Math.floor(i / 2) * -6);
        a.rotation.y = 0;
        this.parked!.add(a);
      });
    }
    key.split(",").filter((t) => t && VEHICLES[t]?.category !== "aircraft").forEach((type, i) => {
      const def = VEHICLES[type];
      const v = buildVehicle(vehicleKindForModel(def?.model ?? "sedan"), 77 + i);
      x += v.width / 2 + 0.5;
      v.group.position.set(x, 0.16, d.homeDoor.z + Math.sign(d.homeDoor.z) * 0.2);
      x += v.width / 2 + 0.5;
      v.group.rotation.y = Math.sign(d.homeDoor.z) > 0 ? 0 : Math.PI;
      this.parked!.add(v.group);
    });
    this.scene.add(this.parked);
  }

  // ---------------------------------------------------------------------------
  // Interiors

  enterHome(spec: HomeSpec, items: string[] = []) {
    if (this.inside || !this.player) return;
    this.path = [];
    this.arriveCb = null;
    this.interior = buildHomeInterior(spec, items);
    this.interiorScene.add(this.interior.group);
    this.scene.remove(this.player.root);
    this.interiorScene.add(this.player.root);
    this.pos.copy(this.interior.door).add(new THREE.Vector3(0, 0, -1.6));
    this.camTarget.copy(this.pos);
    this.inside = true;
    // A high, dollhouse view looking into the home from the front.
    this.outsideCam = { yaw: this.camYaw, pitch: this.camPitch, dist: this.camDist };
    this.camYaw = 0.35;
    this.camPitch = 0.95;
    this.camDist = THREE.MathUtils.clamp(Math.max(...this.interior.size) * 0.85, 9, 22);
    this.boom = this.camDist;
  }

  /** Walk up to your front door (when your home is in this district) and go in. */
  goHome(spec: HomeSpec, items: string[] = []): boolean {
    if (this.inside) return true;
    if (!this.player || !this.district || this.state?.player.home.district !== this.district.id) return false;
    this.pos.copy(this.district.homeDoor).add(new THREE.Vector3(0, 0, -Math.sign(this.district.homeDoor.z) * 1));
    this.camTarget.copy(this.pos);
    this.enterHome(spec, items);
    return true;
  }

  exitHome() {
    if (!this.inside || !this.interior || !this.player || !this.district) return;
    if (this.doing) { const d = this.doing; this.doing = null; clearPose(this.player); if (d.fx) { this.interiorScene.remove(d.fx.group); d.fx.dispose(); } this.cb.onActivity?.(null); d.resolve(true); }
    this.path = [];
    this.arriveCb = null;
    this.interiorScene.remove(this.interior.group);
    this.interiorScene.remove(this.player.root);
    this.scene.add(this.player.root);
    this.pos.copy(this.district.homeDoor).add(new THREE.Vector3(0, 0, -Math.sign(this.district.homeDoor.z) * 1));
    this.camTarget.copy(this.pos);
    this.inside = false;
    this.interior = null;
    if (this.outsideCam) { this.camYaw = this.outsideCam.yaw; this.camPitch = this.outsideCam.pitch; this.camDist = this.outsideCam.dist; this.outsideCam = null; }
  }

  // ---------------------------------------------------------------------------
  // Home life: tap to walk, tap things to use them, walls cut away.

  private tap(cx: number, cy: number) {
    if (!this.inside || !this.interior || this.ride || this.doing || this.frozen) return;
    const rect = this.canvas.getBoundingClientRect();
    const ndc = new THREE.Vector2(((cx - rect.left) / rect.width) * 2 - 1, -((cy - rect.top) / rect.height) * 2 + 1);
    this.raycaster.setFromCamera(ndc, this.camera);
    const hits = this.raycaster.intersectObject(this.interior.group, true).filter((h) => h.object.visible && (h.object as THREE.Mesh).isMesh);
    if (!hits.length) return;
    const p = hits[0].point;
    // Did you tap a thing you can use?
    let best: InteriorSpot | null = null, bd = 1.5;
    for (const sp of this.interior.spots) {
      const ax = sp.use?.x ?? sp.pos.x, az = sp.use?.z ?? sp.pos.z;
      const d = Math.min(Math.hypot(p.x - ax, p.z - az), Math.hypot(p.x - sp.pos.x, p.z - sp.pos.z));
      if (d < bd) { bd = d; best = sp; }
    }
    if (best) {
      const sp = best;
      this.walkTo(sp.pos, () => this.cb.onSpot?.(sp.id));
    } else {
      const b = this.interior.bounds;
      this.walkTo(new THREE.Vector3(THREE.MathUtils.clamp(p.x, b.minX + 0.3, b.maxX - 0.3), 0, THREE.MathUtils.clamp(p.z, b.minZ + 0.3, b.maxZ - 0.3)), null);
    }
  }

  walkTo(target: THREE.Vector3, then: (() => void) | null) {
    if (!this.interior) return;
    this.path = findPath(this.interior, this.pos, target);
    this.arriveCb = then;
  }

  /**
   * Walk to the thing, ask the server to do it, then act it out (lying in bed,
   * sitting watching TV, squatting at the coal pot...) with a progress bar.
   */
  doActivity(spotId: InteriorSpot["id"] | null, activity: string, label: string, icon: string, minutes: number, run: () => Promise<{ ok: boolean }>): Promise<boolean> {
    return new Promise((resolve) => {
      if (!this.inside || !this.interior || this.doing) { run().then((r) => resolve(r.ok)); return; }
      const spot = spotId ? this.interior.spots.find((s) => s.id === spotId) : undefined;
      const start = async () => {
        const r = await run();
        if (!r.ok) return resolve(false);
        const use: SpotUse = spot?.use ?? { x: this.pos.x, y: 0, z: this.pos.z, look: [this.pos.x + Math.sin(this.yaw), this.pos.z + Math.cos(this.yaw)], pose: "stand" };
        const kind = fxFor(activity, use.pose);
        let fx: Fx | null = null;
        if (kind) {
          const at = kind === "steam" && use.pose !== "hidden" ? new THREE.Vector3(use.look[0], 0.9, use.look[1])
            : kind === "smoke" ? new THREE.Vector3(use.look[0], 0.45, use.look[1])
            : kind === "sleep" ? new THREE.Vector3(use.look[0] * 0.15 + use.x * 0.85, use.y + 0.3, use.look[1] * 0.15 + use.z * 0.85)
            : new THREE.Vector3(use.x, use.pose === "hidden" ? 2.2 : use.y, use.z);
          fx = activityFx(kind, at, use.look);
          this.interiorScene.add(fx.group);
        }
        const dur = THREE.MathUtils.clamp(minutes / 16, 3, 10);
        this.doing = { use, stand: (spot?.pos ?? this.pos).clone(), label, icon, t: 0, dur, fx, lastReport: -1, resolve };
        this.cb.onActivity?.({ label, icon, p: 0 });
      };
      if (spot) this.walkTo(spot.pos, () => void start());
      else void start();
    });
  }

  /** Stop what you're doing (tap the bar). */
  stopActivity() {
    if (this.doing) this.doing.t = this.doing.dur;
  }

  private updateDoing(dt: number, t: number) {
    const d = this.doing!;
    d.t += dt;
    applyPose(this.player!, d.use, t);
    d.fx?.update(dt, t);
    const p = Math.min(1, d.t / d.dur);
    if (p - d.lastReport > 0.02 || p === 1) {
      d.lastReport = p;
      this.cb.onActivity?.({ label: d.label, icon: d.icon, p });
    }
    if (p >= 1) {
      this.doing = null;
      clearPose(this.player!);
      if (d.fx) { this.interiorScene.remove(d.fx.group); d.fx.dispose(); }
      this.pos.copy(d.stand);
      this.vel.set(0, 0, 0);
      this.cb.onActivity?.(null);
      d.resolve(true);
    }
  }

  /** Walls between the camera and you drop to a stub, like a dollhouse. */
  private cutWalls(dt: number) {
    // "Walls down": only the walls along the far edges of the home stay up.
    const cam = this.camera.position, b = this.interior!.bounds;
    const farZ = cam.z > (b.minZ + b.maxZ) / 2 ? b.minZ : b.maxZ;
    const farX = cam.x > (b.minX + b.maxX) / 2 ? b.minX : b.maxX;
    for (const w of this.interior!.walls) {
      const far = w.axis === "x" ? farZ : farX;
      const cut = Math.abs(w.c - far) > 0.6;
      const m = w.mesh;
      if (w.base > 0.5) { m.visible = !cut; continue; } // lintels over doors
      const target = cut ? Math.min(0.35, w.h) : w.h;
      m.scale.y += (target - m.scale.y) * Math.min(1, dt * 8);
      m.position.y = w.base + m.scale.y / 2;
    }
  }

  // ---------------------------------------------------------------------------
  // Rides: you get in, the car drives off down the road, the next place loads
  // and the car drives in and drops you. Travel by foot or air fades instead.

  get riding() {
    return !!this.ride;
  }

  rideTo(mode: string, label: string, travel: () => Promise<{ ok: boolean }>): Promise<boolean> {
    if (this.ride) return Promise.resolve(false);
    if (this.inside) this.exitHome();
    const road = ["taxi", "ride", "trotro", "car", "bus", "vip"].includes(mode) && !!this.district && !!this.life;
    return new Promise<boolean>((resolve) => {
      const dir = Math.sign(this.pos.z) || 1;
      let rig: VehicleRig | null = null;
      let phase: Ride["phase"] = "fadeout";
      let x = this.pos.x;
      if (road) {
        const waiting = mode === "taxi" ? this.life!.waitingTaxi(this.pos) : null;
        if (waiting) {
          rig = this.life!.takeCar(waiting);
          x = rig.group.position.x;
          phase = "board";
        } else {
          rig = buildVehicle(this.rideKind(mode), 9001 + Math.floor(Math.random() * 1000));
          x = THREE.MathUtils.clamp(this.pos.x - dir * 55, -EXTENT_X - 20, EXTENT_X + 20);
          phase = "pickup";
        }
        this.scene.add(rig.group);
      }
      const lane = dir * 2.8;
      this.ride = { icon: RIDE_ICON[mode] ?? "🚗", label, rig, dir, phase, x, lane, speed: phase === "pickup" ? 11 : 0, max: mode === "trotro" || mode === "bus" ? 13 : 16, stopX: this.pos.x + dir * 1.2, t: 0, pending: null, result: null, skip: false, resolve };
      if (rig) this.placeRideCar();
      this.cb.onRide?.({ label, icon: this.ride.icon });
      travel().then((r) => { if (this.ride) this.ride.result = r.ok; }, () => { if (this.ride) this.ride.result = false; });
    });
  }

  /** Jump to the next part of the ride. */
  skipRide() {
    if (this.ride) this.ride.skip = true;
  }

  private rideKind(mode: string): VehicleKind {
    if (mode === "taxi") return "taxi";
    if (mode === "trotro" || mode === "bus" || mode === "vip") return "trotro";
    if (mode === "car") {
      const v = (this.state?.vehicles as { type: string; status: string }[] | undefined)?.find((x) => x.status === "personal" && VEHICLES[x.type] && VEHICLES[x.type].category !== "aircraft");
      if (v) return vehicleKindForModel(VEHICLES[v.type].model);
    }
    return "sedan";
  }

  private placeRideCar() {
    const r = this.ride!;
    if (!r.rig) return;
    r.rig.group.position.set(r.x, 0.02, r.lane);
    r.rig.group.rotation.y = r.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
  }

  private setFade(v: number) {
    this.fadeEl.style.opacity = String(THREE.MathUtils.clamp(v, 0, 1));
  }

  private updateRide(dt: number) {
    const r = this.ride!;
    r.t += dt;
    const edge = EXTENT_X + 22;
    const approach = (target: number) => {
      const rem = (target - r.x) * r.dir;
      const want = rem <= 0 ? 0 : Math.min(r.max, Math.sqrt(2 * 4 * rem));
      r.speed += THREE.MathUtils.clamp(want - r.speed, -8 * dt, 4 * dt);
      r.x += r.speed * r.dir * dt;
      if ((target - r.x) * r.dir <= 0.05) { r.x = target; r.speed = 0; }
    };
    switch (r.phase) {
      case "pickup":
        approach(r.stopX);
        if (r.speed === 0 || r.skip) { r.x = r.stopX; r.speed = 0; r.phase = "board"; r.t = 0; r.skip = false; }
        break;
      case "board": {
        // Step off the kerb to the car door, then get in.
        if (this.player && this.player.root.visible) {
          const door = new THREE.Vector3(r.x, 0, r.lane + r.dir * 1.3);
          this.pos.lerp(door, Math.min(1, dt * 3));
          this.yaw = Math.atan2(door.x - this.pos.x, door.z - this.pos.z);
          if (r.t > 0.9) this.player.root.visible = false;
        }
        if (r.result === false) return this.endRide(false);
        if (r.result === true && r.t > 1.1) { r.phase = "out"; r.t = 0; r.skip = false; }
        break;
      }
      case "out":
        r.speed = Math.min(r.max, r.speed + 3.5 * dt);
        r.x += r.speed * r.dir * dt;
        if (r.x * r.dir > edge - 12 || r.skip || r.t > 14) this.setFade((r.t > 14 || r.skip ? 1 : (r.x * r.dir - (edge - 12)) / 10));
        if (r.x * r.dir > edge - 2 || r.skip || r.t > 15) { r.phase = "fadeout"; r.t = 0; r.skip = false; }
        break;
      case "fadeout":
        this.setFade(Math.max(Number(this.fadeEl.style.opacity) || 0, r.t / 0.35));
        if (r.result === false && !r.rig) return this.endRide(false);
        if (r.t < 0.35 || r.result === null) break;
        if (r.result === false) return this.endRide(false);
        this.arrive();
        break;
      case "in":
        this.setFade(1 - r.t / 0.6);
        approach(r.stopX);
        if (r.speed === 0 || r.skip) { r.x = r.stopX; r.speed = 0; r.phase = "alight"; r.t = 0; r.skip = false; this.setFade(0); }
        break;
      case "alight": {
        if (this.player && !this.player.root.visible) {
          this.player.root.visible = true;
          this.pos.set(r.x, 0, r.dir * (WALK_IN + 0.6));
          this.vel.set(0, 0, 0);
          this.yaw = r.dir > 0 ? 0 : Math.PI;
        }
        if (r.t > 0.6) {
          if (r.rig) this.leaving.push({ rig: r.rig, dir: r.dir, speed: 0 });
          return this.endRide(true);
        }
        break;
      }
    }
    if (r.rig) {
      const before = r.rig.group.position.x;
      this.placeRideCar();
      spinWheels(r.rig, Math.abs(r.x - before));
    }
    // The camera rides along: behind and above the car (or watching you board).
    if (r.rig && (r.phase === "out" || r.phase === "in" || (r.phase === "pickup" && r.t > 0.6))) {
      const car = r.rig.group.position;
      if (r.phase !== "pickup") this.pos.set(car.x, 0, car.z);
      const want = new THREE.Vector3(car.x - r.dir * 8.5, 3.4, car.z + r.dir * 2.4);
      this.camPos.lerp(want, Math.min(1, dt * 4));
      this.camera.position.copy(this.camPos);
      this.camera.lookAt(car.x + r.dir * 4, 1.2, car.z);
      this.camTarget.copy(this.pos);
    } else this.camPos.copy(this.camera.position);
  }

  /** Swap to the destination and bring the car in from the far end of the road. */
  private arrive() {
    const r = this.ride!;
    if (r.pending) {
      this.rideApplying = true;
      this.setState(r.pending);
      this.rideApplying = false;
      r.pending = null;
    }
    if (!r.rig) {
      if (this.player) this.player.root.visible = true;
      this.setFade(0);
      return this.endRide(true);
    }
    // Drop-off where the server put you (a stop, or your street).
    r.dir = Math.sign(this.pos.z) || 1;
    r.lane = r.dir * 2.8;
    r.stopX = THREE.MathUtils.clamp(this.pos.x, -EXTENT_X + 10, EXTENT_X - 10);
    r.x = r.stopX - r.dir * 60;
    r.speed = r.max * 0.8;
    if (r.rig.group.parent !== this.scene) this.scene.add(r.rig.group);
    this.placeRideCar();
    this.camPos.set(r.x - r.dir * 8.5, 3.4, r.lane + r.dir * 2.4);
    r.phase = "in";
    r.t = 0;
    r.skip = false;
  }

  private endRide(ok: boolean) {
    const r = this.ride;
    if (!r) return;
    this.ride = null;
    if (this.player) this.player.root.visible = true;
    this.setFade(0);
    if (!ok && r.rig) this.leaving.push({ rig: r.rig, dir: r.dir, speed: r.speed });
    this.cb.onRide?.(null);
    r.resolve(ok);
  }

  private updateLeaving(dt: number) {
    for (const l of this.leaving) {
      l.speed = Math.min(14, l.speed + 3 * dt);
      l.rig.group.position.x += l.speed * l.dir * dt;
      spinWheels(l.rig, l.speed * dt);
    }
    this.leaving = this.leaving.filter((l) => {
      if (Math.abs(l.rig.group.position.x) < EXTENT_X + 30) return true;
      l.rig.group.removeFromParent();
      return false;
    });
  }

  hailTaxi() {
    const t = this.life?.taxiNear(this.pos);
    if (t && this.life) this.life.hail(t);
    return !!t;
  }

  zoom(delta: number) {
    this.camDist = THREE.MathUtils.clamp(this.camDist * (delta > 0 ? 1.15 : 1 / 1.15), 4, 34);
  }

  /** Walk-to helper for map markers. */
  teleportNear(placeId: string) {
    const door = this.district?.placeDoors.get(placeId);
    if (door) this.pos.copy(door).add(new THREE.Vector3(1, 0, 0));
  }

  minimap() {
    const d = this.district;
    if (!d) return null;
    return {
      x: this.pos.x,
      z: this.pos.z,
      yaw: this.yaw,
      camYaw: this.camYaw,
      places: [...d.placeDoors].map(([id, p]) => ({ id, x: p.x, z: p.z, kind: PLACE_BY_ID[id].kind, known: this.discovered.has(id) || PLACE_BY_ID[id].kind === "transport" })),
      npcs: [...(this.life?.npcs.values() ?? [])].map((a) => ({ id: a.npc.id, x: a.home.x, z: a.home.z })),
      home: this.state?.player.home.district === d.id ? { x: d.homeDoor.x, z: d.homeDoor.z } : null,
      plot: { x: d.plotSpot.x, z: d.plotSpot.z },
      coastal: d.shoreZ,
      bearing: DISTRICTS[d.id].bearing,
    };
  }

  // ---------------------------------------------------------------------------
  // Input

  private bindInput() {
    const down = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === "INPUT" || (e.target as HTMLElement)?.tagName === "TEXTAREA") return;
      this.keys.add(e.key.toLowerCase());
      if (e.key === " ") {
        e.preventDefault();
        this.jump();
      }
      this.audio.start();
    };
    const up = (e: KeyboardEvent) => this.keys.delete(e.key.toLowerCase());
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", () => this.keys.clear());
    let dragging = false;
    let lx = 0, ly = 0;
    const pointers = new Map<number, { x: number; y: number }>();
    let pinch = 0;
    let downAt = { x: 0, y: 0, t: 0 };
    this.canvas.addEventListener("pointerdown", (e) => {
      downAt = { x: e.clientX, y: e.clientY, t: performance.now() };
      this.audio.start();
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      dragging = true;
      lx = e.clientX;
      ly = e.clientY;
      this.canvas.setPointerCapture(e.pointerId);
    });
    this.canvas.addEventListener("pointermove", (e) => {
      if (!pointers.has(e.pointerId)) return;
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        const dist = Math.hypot(a.x - b.x, a.y - b.y);
        if (pinch) this.camDist = THREE.MathUtils.clamp(this.camDist * (pinch / dist), 4, 34);
        pinch = dist;
        return;
      }
      if (!dragging) return;
      this.camYaw -= (e.clientX - lx) * 0.006;
      this.camPitch = THREE.MathUtils.clamp(this.camPitch + (e.clientY - ly) * 0.004, 0.18, 1.35);
      lx = e.clientX;
      ly = e.clientY;
    });
    const end = (e: PointerEvent) => {
      if (e.type === "pointerup" && pointers.size === 1 && Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y) < 8 && performance.now() - downAt.t < 450) this.tap(e.clientX, e.clientY);
      pointers.delete(e.pointerId);
      if (pointers.size < 2) pinch = 0;
      if (pointers.size === 0) dragging = false;
    };
    this.canvas.addEventListener("pointerup", end);
    this.canvas.addEventListener("pointercancel", end);
    this.canvas.addEventListener("wheel", (e) => {
      e.preventDefault();
      this.zoom(e.deltaY);
    }, { passive: false });
  }

  // ---------------------------------------------------------------------------
  // Physics

  private collides(p: THREE.Vector3, r: number) {
    if (this.inside) return false;
    for (const c of this.district?.colliders ?? []) {
      if (c.kind === "gutter") continue;
      if (p.x + r > c.minX && p.x - r < c.maxX && p.z + r > c.minZ && p.z - r < c.maxZ) return true;
    }
    return false;
  }

  /** Is something taller than the camera point in the way (for the camera boom)? */
  private occludes(p: THREE.Vector3) {
    for (const c of this.district?.colliders ?? []) {
      if (c.h > p.y && p.x > c.minX && p.x < c.maxX && p.z > c.minZ && p.z < c.maxZ) return true;
    }
    return false;
  }

  jump() {
    if (this.inside || this.jumpY > 0.02 || this.frozen) return;
    this.vy = 3.4; // about 0.6 m clearance: enough to clear a gutter
  }

  private pushOutBox(p: THREE.Vector3, r: number, minX: number, maxX: number, minZ: number, maxZ: number) {
    if (p.x + r <= minX || p.x - r >= maxX || p.z + r <= minZ || p.z - r >= maxZ) return;
    const pushL = p.x + r - minX, pushR = maxX - (p.x - r), pushD = p.z + r - minZ, pushU = maxZ - (p.z - r);
    const m = Math.min(pushL, pushR, pushD, pushU);
    if (m === pushL) p.x -= pushL;
    else if (m === pushR) p.x += pushR;
    else if (m === pushD) p.z -= pushD;
    else p.z += pushU;
  }

  private resolve(p: THREE.Vector3, r: number) {
    if (this.inside && this.interior) {
      const b = this.interior.bounds;
      p.x = THREE.MathUtils.clamp(p.x, b.minX + 0.35, b.maxX - 0.35);
      p.z = THREE.MathUtils.clamp(p.z, b.minZ + 0.35, b.maxZ - 0.2);
      for (const c of this.interior.colliders) this.pushOutBox(p, r, c.minX, c.maxX, c.minZ, c.maxZ);
      return;
    }
    const airborne = this.jumpY > 0.18;
    for (const c of this.district?.colliders ?? []) {
      if (c.kind === "gutter" && airborne) continue; // jumping clears the drain
      this.pushOutBox(p, r, c.minX, c.maxX, c.minZ, c.maxZ);
    }
    // Vehicles (moving and parked): oriented boxes.
    for (const v of this.life?.solidVehicles() ?? []) {
      const g = v.group;
      const yaw = g.rotation.y;
      const cos = Math.cos(yaw), sin = Math.sin(yaw);
      // Into the car's frame (car length runs along its local z).
      const dx = p.x - g.position.x, dz = p.z - g.position.z;
      const lx = dx * cos - dz * sin, lz = dx * sin + dz * cos;
      const hw = v.width / 2 + r, hl = v.length / 2 + r;
      if (Math.abs(lx) >= hw || Math.abs(lz) >= hl) continue;
      let nx = lx, nz = lz;
      if (hw - Math.abs(lx) < hl - Math.abs(lz)) nx = Math.sign(lx || 1) * hw;
      else nz = Math.sign(lz || 1) * hl;
      p.x = g.position.x + nx * cos + nz * sin;
      p.z = g.position.z - nx * sin + nz * cos;
    }
    // People: nobody walks through anybody.
    for (const o of this.life?.peoplePositions() ?? []) {
      const dx = p.x - o.x, dz = p.z - o.z;
      const d = Math.hypot(dx, dz), min = r + 0.28;
      if (d > 0.0001 && d < min) {
        p.x = o.x + (dx / d) * min;
        p.z = o.z + (dz / d) * min;
      }
    }
    // The building site, once walls are up.
    if (this.siteBox) this.pushOutBox(p, r, this.siteBox.minX, this.siteBox.maxX, this.siteBox.minZ, this.siteBox.maxZ);
  }

  private groundY(p: THREE.Vector3) {
    if (this.inside) return 0;
    const az = Math.abs(p.z), ax = Math.abs(p.x);
    if (az >= WALK_IN && az <= WALK_OUT + 0.1) return 0.16;
    if (ax >= CROSS_HALF && ax <= CROSS_HALF + 3.1 && az > WALK_OUT) return 0.16;
    if (az > ROAD_HALF && az < WALK_IN) return 0.06;
    return 0.03;
  }

  // ---------------------------------------------------------------------------
  // Main loop

  private loop = () => {
    this.raf = requestAnimationFrame(this.loop);
    const dt = Math.min(0.05, this.clock.getDelta());
    if (this.paused) return;
    const t = this.clock.elapsedTime;
    const minute = this.minuteNow;
    const gd = toGameDate(Math.floor(minute));
    const hour = gd.hour + gd.min / 60 + (minute % 1) / 60;

    // Player movement relative to the camera.
    let ix = 0, iz = 0;
    if (!this.frozen && !this.ride) {
      if (this.keys.has("w") || this.keys.has("arrowup")) iz += 1;
      if (this.keys.has("s") || this.keys.has("arrowdown")) iz -= 1;
      if (this.keys.has("a") || this.keys.has("arrowleft")) ix -= 1;
      if (this.keys.has("d") || this.keys.has("arrowright")) ix += 1;
      ix += this.joy.x;
      iz += this.joy.y;
    }
    // Tap-to-walk: follow the path unless you take over with the keys or stick.
    let autoDir: THREE.Vector3 | null = null;
    if (this.path.length && (ix || iz)) { this.path = []; this.arriveCb = null; }
    if (this.doing) { ix = 0; iz = 0; }
    else if (this.path.length) {
      const next = this.path[0];
      const to = new THREE.Vector3(next.x - this.pos.x, 0, next.z - this.pos.z);
      if (to.length() < 0.14) {
        this.path.shift();
        if (!this.path.length) {
          const cb = this.arriveCb;
          this.arriveCb = null;
          this.vel.set(0, 0, 0);
          cb?.();
        }
      } else autoDir = to.normalize();
    }
    const mag = autoDir ? 1 : Math.min(1, Math.hypot(ix, iz));
    const running = this.run || this.keys.has("shift") || mag > 0.95 && (this.joy.x !== 0 || this.joy.y !== 0) && Math.hypot(this.joy.x, this.joy.y) > 0.98;
    const energy = this.state?.player.stats.energy ?? 50;
    // Real people walk about 1.35 m/s and jog about 3.4 m/s.
    const maxSpeed = (running ? 3.4 : 1.35) * (energy < 10 ? 0.6 : 1);
    if (mag > 0.05) {
      const fwd = new THREE.Vector3(-Math.sin(this.camYaw), 0, -Math.cos(this.camYaw));
      const right = new THREE.Vector3(-fwd.z, 0, fwd.x);
      const dir = autoDir ?? fwd.multiplyScalar(iz).add(right.multiplyScalar(ix)).normalize();
      this.vel.lerp(dir.multiplyScalar(maxSpeed * mag), Math.min(1, dt * (running ? 4 : 6)));
      const targetYaw = Math.atan2(this.vel.x, this.vel.z);
      let dy = targetYaw - this.yaw;
      dy = ((dy + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
      this.yaw += dy * Math.min(1, dt * 12);
    } else {
      this.vel.multiplyScalar(Math.max(0, 1 - dt * 12));
    }
    this.pos.addScaledVector(this.vel, dt);
    this.resolve(this.pos, 0.32);
    // Jumping.
    this.vy -= 9.8 * dt;
    this.jumpY = Math.max(0, this.jumpY + this.vy * dt);
    if (this.jumpY === 0) this.vy = 0;
    const gy = this.groundY(this.pos);
    if (this.player) {
      this.player.root.position.set(this.pos.x, THREE.MathUtils.lerp(this.player.root.position.y - this.jumpYPrev, gy, Math.min(1, dt * 14)) + this.jumpY, this.pos.z);
      this.jumpYPrev = this.jumpY;
      this.player.root.rotation.y = this.yaw;
      animatePerson(this.player, dt, this.jumpY > 0 || this.doing ? 0 : this.vel.length());
      if (this.doing) this.updateDoing(dt, t);
      // Tuck the legs while airborne.
      if (this.jumpY > 0.02 && "real" in this.player) {
        const b = this.player.bones;
        for (const sd of ["L", "R"]) {
          b[`upperleg01.${sd}`].rotation.x = -0.6;
          b[`lowerleg01.${sd}`].rotation.x = 1.0;
        }
      }
    }

    // Camera.
    if (this.inside && this.interior) {
      const b = this.interior.bounds;
      const focus = this.pos.clone().lerp(new THREE.Vector3((b.minX + b.maxX) / 2, 0, (b.minZ + b.maxZ) / 2), 0.4);
      this.camTarget.lerp(focus, Math.min(1, dt * 3));
    } else this.camTarget.lerp(this.pos, Math.min(1, dt * 6));
    const cd = this.camDist;
    const cp = this.inside ? Math.max(this.camPitch, 0.7) : this.camPitch;
    const off = new THREE.Vector3(Math.sin(this.camYaw) * Math.cos(cp), Math.sin(cp), Math.cos(this.camYaw) * Math.cos(cp)).multiplyScalar(cd);
    const head = this.camTarget.clone().add(new THREE.Vector3(0, 1.2, 0));
    // Pull the camera in only for things genuinely taller than it, and ease the
    // distance so it never snaps or jitters.
    let want = 1;
    if (!this.inside) {
      const steps = 20;
      for (let i = 2; i <= steps; i++) {
        const p = head.clone().addScaledVector(off, i / steps);
        if (this.occludes(p)) {
          want = Math.max(0.35, (i - 1) / steps);
          break;
        }
      }
    }
    const target = off.length() * want;
    this.boom += (target - this.boom) * Math.min(1, dt * (target < this.boom ? 6 : 2));
    off.setLength(this.boom);
    this.camera.position.copy(head).add(off);
    this.camera.lookAt(this.camTarget.x, this.camTarget.y + 1.3, this.camTarget.z);
    if (this.ride) this.updateRide(dt);
    if (this.inside && this.interior) this.cutWalls(dt);
    else this.camPos.copy(this.camera.position);
    this.updateLeaving(dt);

    if (!this.inside && this.district && this.life) {
      this.atmo.update(hour, dt, this.pos, this.camera.position);
      const night = this.atmo.night;
      for (const n of this.district.night) n.mat.emissiveIntensity = THREE.MathUtils.lerp(n.off, n.on, THREE.MathUtils.smoothstep(night, 0.35, 0.8));
      if (this.tickAcc === 0 || this.lampPool[0].intensity === 0) {
        const spots = [...this.district.lampSpots].sort((a, b) => a.distanceToSquared(this.pos) - b.distanceToSquared(this.pos));
        this.lampPool.forEach((l, i) => spots[i] && l.position.copy(spots[i]));
      }
      for (const l of this.lampPool) l.intensity = night > 0.5 ? 160 : 0;
      this.district.ocean?.update(t, this.atmo.sunDir, this.atmo.skyColor, night);
      if (gd.hour !== this.lastNpcHour) {
        this.lastNpcHour = gd.hour;
        this.life.syncNpcs(gd.weekdayIndex, gd.hour, this.tiers);
      }
      this.life.update(dt, t, this.pos, night > 0.55, this.camera);
      if (this.life.hailedTaxi) {
        const c = this.life.hailedTaxi;
        if (c.speed < 0.3 && c.rig.group.position.distanceTo(this.pos) < 9) {
          this.life.hailedTaxi = null;
          c.hailed = false;
          c.stopTimer = 8;
          this.cb.onTaxiArrived();
        }
      }
      const pulse = 0.55 + Math.sin(t * 3) * 0.25;
      this.ringMat.opacity = pulse;
      // Audio: the listener is the camera-facing player; beds follow the place and the hour.
      const dist = DISTRICTS[this.district.id];
      const busy = hour >= 6 && hour < 20 ? 1 : hour >= 20 && hour < 23 ? 0.5 : 0.15;
      this.audio.update(dt, { x: this.pos.x, z: this.pos.z, yaw: this.camYaw + Math.PI }, {
        traffic: dist.traffic * (night > 0.6 ? 0.4 : 1) * (1 - THREE.MathUtils.clamp((Math.abs(this.pos.z) - 12) / 40, 0, 0.8)),
        waves: this.district.shoreZ ? THREE.MathUtils.clamp(1 - (this.district.shoreZ - this.pos.z) / 50, 0.15, 1) : 0,
        rain: this.weather === "rain" ? 0.7 : this.weather === "storm" ? 1 : 0,
        crowd: dist.crowd * busy,
        hour,
      }, t);
    }

    // Nearby interactions.
    this.updateNearby();

    // Report position and discoveries now and then.
    this.tickAcc += dt;
    if (this.tickAcc > 0.5 && this.district) {
      this.tickAcc = 0;
      this.cb.onTick({ road: this.inside ? "Home" : this.district.roadName(this.pos.x, this.pos.z), district: this.district.id, x: this.pos.x, z: this.pos.z, yaw: this.yaw });
      if (!this.inside) {
        for (const [id, door] of this.district.placeDoors) {
          if (!this.discovered.has(id) && !this.reported.has(id) && door.distanceTo(this.pos) < 14) {
            this.reported.add(id);
            this.cb.onDiscover(id);
          }
        }
      }
    }
    this.renderer.render(this.inside ? this.interiorScene : this.scene, this.camera);
  };

  private updateNearby() {
    let best: Nearby | null = null;
    if (this.ride) {
      // Nothing to press while you're in a car.
    } else if (this.inside && this.interior) {
      let bd = 1.7;
      for (const sp of this.interior.spots) {
        const dd = Math.hypot(sp.pos.x - this.pos.x, sp.pos.z - this.pos.z);
        if (dd < bd) { bd = dd; best = { kind: sp.id === "bed" ? "bed" : sp.id === "exit" ? "exit" : "homespot", id: sp.id, label: sp.label }; }
      }
    } else if (this.district && this.life) {
      let bd = 1e9;
      for (const a of this.life.npcs.values()) {
        const dd = a.rig.root.position.distanceTo(this.pos);
        if (dd < 2.6 && dd < bd) {
          bd = dd;
          best = { kind: "npc", id: a.npc.id, label: a.npc.name };
        }
      }
      if (!best) {
        for (const it of this.district.interactables as Interactable[]) {
          const dd = Math.hypot(it.pos.x - this.pos.x, it.pos.z - this.pos.z);
          // Your own door wins over the building it's in (your room in Tetteh House).
          const score = it.kind === "home" ? dd - 1.5 : dd;
          if (dd < it.radius && score < bd) {
            if (it.kind === "home" && this.state?.player.home.district !== this.district.id) continue;
            bd = score;
            best = { kind: it.kind, id: it.placeId ?? it.id, label: it.label };
          }
        }
      }
      if (!best && this.life.taxiNear(this.pos)) best = { kind: "taxi", id: "taxi", label: "Stop this taxi" };
    }
    const key = best ? `${best.kind}:${best.id}` : "";
    const prev = this.nearby ? `${this.nearby.kind}:${this.nearby.id}` : "";
    if (key !== prev) {
      this.nearby = best;
      this.cb.onNearby(best);
    }
  }

  npcTalkAnim(id: string) {
    const a = this.life?.npcs.get(id);
    if (a) a.rig.talk = 3;
  }

  dispose() {
    cancelAnimationFrame(this.raf);
    window.removeEventListener("resize", this.resize);
    this.district?.dispose();
    this.renderer.dispose();
  }
}
