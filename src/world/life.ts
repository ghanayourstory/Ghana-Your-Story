// The living city: traffic that obeys lights and stops for you, trotros that
// pull in at stops, taxis you can flag down, crowds, vendors and the named
// characters who follow their daily routines.
import * as THREE from "three";
import { buildVehicle, setVehicleLights, spinWheels, type VehicleKind, type VehicleRig } from "./vehicles.ts";
import { animatePerson, buildPerson, randomLook, type Person } from "./people.ts";
import { CROSS_HALF, EXTENT_X, ROAD_HALF, WALK_IN, WALK_OUT, type DistrictScene } from "./district.ts";
import { DISTRICTS, PLACE_BY_ID, isRushHour } from "../../shared/world.ts";
import { CROWD_SHOUTS, NPCS, npcLocation, type Npc } from "../../shared/people.ts";
import { label } from "./textures.ts";
import { mulberry32 } from "../../shared/rng.ts";

interface Car {
  rig: VehicleRig;
  lane: Lane;
  s: number; // position along lane axis
  speed: number;
  max: number;
  stopTimer: number;
  hailed: boolean;
  honk: number;
}

interface Lane {
  axis: "x" | "z";
  dir: 1 | -1;
  offset: number; // fixed coordinate on the other axis
  stopAt: number; // stop line coordinate along axis (in direction of travel, before junction)
  green: "ew" | "ns";
  from: number;
  to: number;
}

interface Walker {
  rig: Person;
  z: number;
  x: number;
  dir: number;
  speed: number;
  pause: number;
  vendor: boolean;
  beach: boolean;
  target: THREE.Vector2 | null;
  bubble: THREE.Sprite | null;
  bubbleT: number;
}

export interface NpcActor {
  npc: Npc;
  rig: Person;
  placeId: string;
  home: THREE.Vector3;
  label: THREE.Sprite;
}

export class CityLife {
  group = new THREE.Group();
  cars: Car[] = [];
  walkers: Walker[] = [];
  npcs = new Map<string, NpcActor>();
  private lanes: Lane[] = [];
  private stops: number[] = [];
  private rnd = mulberry32(42);
  onHonk: ((pos: THREE.Vector3) => void) | null = null;
  hailedTaxi: Car | null = null;

  constructor(private d: DistrictScene) {
    const coastal = DISTRICTS[d.id].style === "coastal";
    const stopLine = CROSS_HALF + 3.6;
    this.lanes = [
      { axis: "x", dir: 1, offset: 2.8, stopAt: -stopLine, green: "ew", from: -EXTENT_X - 30, to: EXTENT_X + 30 },
      { axis: "x", dir: -1, offset: -2.8, stopAt: stopLine, green: "ew", from: EXTENT_X + 30, to: -EXTENT_X - 30 },
      { axis: "z", dir: 1, offset: -2.2, stopAt: -(ROAD_HALF + 3.6), green: "ns", from: -110, to: coastal ? -ROAD_HALF - 1 : 110 },
    ];
    if (!coastal) this.lanes.push({ axis: "z", dir: -1, offset: 2.2, stopAt: ROAD_HALF + 3.6, green: "ns", from: 110, to: -110 });
    for (const [id, door] of d.placeDoors) if (PLACE_BY_ID[id]?.kind === "transport") this.stops.push(door.x);
  }

  populate(hour: number, weekday: number) {
    const dist = DISTRICTS[this.d.id];
    const night = hour < 6 || hour >= 21;
    const rush = isRushHour(hour, weekday);
    const nCars = Math.round((night ? 6 : rush ? 26 : 16) * (0.4 + dist.traffic * 0.8));
    for (let i = 0; i < nCars; i++) {
      const lane = this.lanes[i % this.lanes.length];
      const r = this.rnd();
      const kind: VehicleKind = dist.style === "luxury" ? (r < 0.4 ? "suv" : r < 0.5 ? "v8" : "sedan") : r < 0.32 ? "trotro" : r < 0.6 ? "taxi" : r < 0.8 ? "sedan" : r < 0.92 ? "suv" : "pickup";
      this.addCar(kind, lane, lane.from + (lane.to - lane.from) * (i / nCars + this.rnd() * 0.05));
    }
    // Parked cars along the kerb and trotros at the station.
    for (let i = 0; i < 8; i++) {
      const x = -80 + this.rnd() * 160;
      if (Math.abs(x) < 14) continue;
      const v = buildVehicle(this.rnd() < 0.5 ? "sedan" : "suv", Math.floor(this.rnd() * 1e6));
      v.group.position.set(x, 0, (this.rnd() < 0.5 ? 1 : -1) * (ROAD_HALF - 1.1));
      v.group.rotation.y = this.rnd() < 0.5 ? Math.PI / 2 : -Math.PI / 2;
      this.group.add(v.group);
    }
    if (dist.style === "market") {
      for (let i = 0; i < 6; i++) {
        const v = buildVehicle("trotro", 900 + i);
        v.group.position.set(22 + i * 2.6, 0, -WALK_OUT - 9);
        v.group.rotation.y = Math.PI;
        this.group.add(v.group);
      }
    }
    // Crowds.
    const crowd = dist.crowd * (night ? (dist.nightlife > 0.6 ? 0.55 : 0.15) : rush ? 1.1 : 0.85);
    const nWalk = Math.round(14 + crowd * 46);
    for (let i = 0; i < nWalk; i++) {
      const sw = this.d.sidewalks[i % this.d.sidewalks.length];
      const vendor = i % 9 === 0 && !night;
      const rig = buildPerson(randomLook(Math.floor(this.rnd() * 1e9), { carry: vendor }), { key: i < 18 });
      const w: Walker = {
        rig, z: sw.z + (this.rnd() - 0.5) * 2, x: sw.x0 + this.rnd() * (sw.x1 - sw.x0), dir: this.rnd() < 0.5 ? 1 : -1,
        speed: vendor ? 0.9 : 1.05 + this.rnd() * 0.5, pause: 0, vendor, beach: false, target: null, bubble: null, bubbleT: this.rnd() * 20,
      };
      rig.root.position.set(w.x, 0.16, w.z);
      this.group.add(rig.root);
      this.walkers.push(w);
    }
    // Sellers standing behind stalls.
    for (const s of this.d.stalls) {
      if (this.rnd() < 0.3 || night) continue;
      const rig = buildPerson(randomLook(Math.floor(this.rnd() * 1e9)));
      const z = s.z > 0 ? s.z + 2.2 : s.z - 2.2;
      rig.root.position.set(s.x, 0.16, z);
      rig.root.rotation.y = z > 0 ? Math.PI : 0;
      this.group.add(rig.root);
      this.walkers.push({ rig, z, x: s.x, dir: 0, speed: 0, pause: 1e9, vendor: true, beach: false, target: null, bubble: null, bubbleT: this.rnd() * 30 });
    }
    // Beach-goers.
    if (this.d.shoreZ) {
      const n = Math.round((night ? 4 : weekday === 0 || weekday === 6 ? 30 : 16) * (0.6 + this.rnd() * 0.4));
      for (let i = 0; i < n; i++) {
        const rig = buildPerson(randomLook(Math.floor(this.rnd() * 1e9)));
        const x = -60 + this.rnd() * 120, z = 14 + this.rnd() * (this.d.shoreZ - 16);
        rig.root.position.set(x, 0.04, z);
        this.group.add(rig.root);
        this.walkers.push({ rig, z, x, dir: 0, speed: 0.9 + this.rnd() * 0.4, pause: this.rnd() * 6, vendor: false, beach: true, target: new THREE.Vector2(x, z), bubble: null, bubbleT: this.rnd() * 30 });
      }
    }
  }

  private addCar(kind: VehicleKind, lane: Lane, s: number) {
    const rig = buildVehicle(kind, Math.floor(this.rnd() * 1e6));
    const max = kind === "trotro" ? 9 + this.rnd() * 3 : 10 + this.rnd() * 5;
    const car: Car = { rig, lane, s, speed: max * 0.8, max, stopTimer: 0, hailed: false, honk: 0 };
    this.placeCar(car);
    this.group.add(rig.group);
    this.cars.push(car);
  }

  private placeCar(c: Car) {
    const g = c.rig.group;
    if (c.lane.axis === "x") {
      g.position.set(c.s, 0.02, c.lane.offset);
      g.rotation.y = c.lane.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
    } else {
      g.position.set(c.lane.offset, 0.02, c.s);
      g.rotation.y = c.lane.dir > 0 ? 0 : Math.PI;
    }
  }

  /** Update NPC characters to match their routines at this hour. */
  syncNpcs(weekday: number, hour: number, tiers: Map<string, string>) {
    const present = new Set<string>();
    for (const npc of NPCS) {
      const where = npcLocation(npc, weekday, hour);
      if (!where || PLACE_BY_ID[where].district !== this.d.id) continue;
      present.add(npc.id);
      const door = this.d.placeDoors.get(where);
      if (!door) continue;
      let a = this.npcs.get(npc.id);
      if (!a || a.placeId !== where) {
        if (a) this.group.remove(a.rig.root, a.label);
        const rig = buildPerson({ ...npc.look, hairStyle: npc.look.headwear === "headwrap" ? "wrap" : npc.look.headwear === "cap" ? "cap" : npc.look.feminine ? "braids" : "low", pattern: npc.id === "esi" || npc.id === "nii" ? "wax" : npc.id === "selasi" ? "kente" : "plain" }, { key: true });
        const off = (NPCS.indexOf(npc) % 3 - 1) * 1.6;
        const home = door.clone().add(new THREE.Vector3(off + 1.2, 0.16, door.z > 0 ? -0.6 : 0.6));
        rig.root.position.copy(home);
        const tier = tiers.get(npc.id) ?? "stranger";
        const lbl = new THREE.Sprite(new THREE.SpriteMaterial({ map: label(npc.name.split(" ")[0] === "Auntie" || npc.name.startsWith("Mr.") || npc.name.startsWith("Dr.") || npc.name.startsWith("Uncle") ? npc.name.split(" ").slice(0, 2).join(" ") : npc.name.split(" ")[0], { icon: tier === "close" ? "💛" : tier === "friend" ? "🙂" : "💬", bg: "rgba(242,183,5,0.92)", fg: "#1a1a1a" }), depthTest: true }));
        const img = (lbl.material.map!.image as HTMLCanvasElement);
        lbl.scale.set(0.5 * (img.width / img.height), 0.5, 1);
        lbl.position.copy(home).add(new THREE.Vector3(0, npc.look.height + 0.55, 0));
        this.group.add(rig.root, lbl);
        a = { npc, rig, placeId: where, home, label: lbl };
        this.npcs.set(npc.id, a);
      }
    }
    for (const [id, a] of this.npcs) {
      if (!present.has(id)) {
        this.group.remove(a.rig.root, a.label);
        this.npcs.delete(id);
      }
    }
  }

  update(dt: number, t: number, player: THREE.Vector3, night: boolean, camera: THREE.Camera) {
    const phase = this.d.trafficLight.phase();
    const tl = this.d.trafficLight.mats;
    tl.ewGreen.emissiveIntensity = phase === "ew" ? 3 : 0;
    tl.ewRed.emissiveIntensity = phase === "ew" ? 0 : 3;
    tl.nsGreen.emissiveIntensity = phase === "ns" ? 3 : 0;
    tl.nsRed.emissiveIntensity = phase === "ns" ? 0 : 3;

    // Vehicles: keep distance, obey lights, stop for the player, pull in at stops.
    const byLane = new Map<Lane, Car[]>();
    for (const c of this.cars) {
      let l = byLane.get(c.lane);
      if (!l) byLane.set(c.lane, (l = []));
      l.push(c);
    }
    for (const [lane, list] of byLane) {
      list.sort((a, b) => (b.s - a.s) * lane.dir);
      for (let i = 0; i < list.length; i++) {
        const c = list[i];
        const ahead = i > 0 ? list[i - 1] : list[list.length - 1];
        let target = c.max;
        if (ahead !== c) {
          let gap = (ahead.s - c.s) * lane.dir;
          if (gap < 0) gap += Math.abs(lane.to - lane.from);
          const need = (c.rig.length + ahead.rig.length) / 2 + 2.5;
          if (gap < need + 12) target = Math.min(target, Math.max(0, (gap - need) * 0.9));
        }
        // Red light.
        const toStop = (lane.stopAt - c.s) * lane.dir - c.rig.length / 2;
        if (phase !== lane.green && toStop > -0.5 && toStop < 22) target = Math.min(target, Math.max(0, toStop * 0.6));
        // Player in the lane ahead.
        const pAlong = lane.axis === "x" ? player.x : player.z;
        const pAcross = lane.axis === "x" ? player.z : player.x;
        const pd = (pAlong - c.s) * lane.dir;
        if (Math.abs(pAcross - lane.offset) < 1.8 && pd > 0 && pd < c.rig.length / 2 + 8) {
          target = 0;
          c.honk -= dt;
          if (c.honk <= 0) {
            this.onHonk?.(c.rig.group.position);
            c.honk = 2.5 + Math.random() * 2;
          }
        }
        // Trotros pull in at stops; hailed taxis stop by the player.
        if (c.rig.kind === "trotro" && lane.axis === "x") {
          for (const sx of this.stops) {
            const ds = (sx - c.s) * lane.dir;
            if (ds > 0 && ds < 14 && c.stopTimer <= 0 && c.speed > 2) {
              if (ds < 3) c.stopTimer = 5 + Math.random() * 4;
              else target = Math.min(target, ds * 0.7);
            }
          }
        }
        if (c.hailed) {
          const ds = (pAlong - c.s) * lane.dir;
          target = Math.min(target, Math.max(0, ds * 0.6));
        }
        if (c.stopTimer > 0) {
          c.stopTimer -= dt;
          target = 0;
        }
        const acc = target > c.speed ? 3 : 8;
        c.speed += THREE.MathUtils.clamp(target - c.speed, -acc * dt, acc * dt);
        const move = c.speed * dt * lane.dir;
        c.s += move;
        if ((lane.dir > 0 && c.s > lane.to) || (lane.dir < 0 && c.s < lane.to)) {
          if (c.hailed) c.hailed = false;
          // Coastal side road: southbound cars join the main road eastbound.
          if (lane.axis === "z" && Math.abs(lane.to) < 20) {
            c.lane = this.lanes[0];
            c.s = -lane.offset + 1;
          } else c.s = lane.from;
        }
        spinWheels(c.rig, Math.abs(move));
        this.placeCar(c);
        setVehicleLights(c.rig, night, c.speed < target - 0.5 ? false : target < c.speed - 0.5);
      }
    }

    // Walkers.
    for (const w of this.walkers) {
      let moving = 0;
      if (w.beach && w.target) {
        if (w.pause > 0) w.pause -= dt;
        else {
          const dx = w.target.x - w.x, dz = w.target.y - w.z;
          const dist = Math.hypot(dx, dz);
          if (dist < 0.3) {
            w.pause = 3 + Math.random() * 10;
            w.target.set(THREE.MathUtils.clamp(w.x + (Math.random() - 0.5) * 30, -90, 90), THREE.MathUtils.clamp(w.z + (Math.random() - 0.5) * 16, 13, (this.d.shoreZ ?? 40) + 1));
          } else {
            w.x += (dx / dist) * w.speed * dt;
            w.z += (dz / dist) * w.speed * dt;
            w.rig.root.rotation.y = Math.atan2(dx, dz);
            moving = w.speed;
          }
        }
      } else if (w.dir !== 0) {
        if (w.pause > 0) w.pause -= dt;
        else {
          w.x += w.dir * w.speed * dt;
          // Step aside for the player.
          const dpx = player.x - w.x, dpz = player.z - w.z;
          if (Math.abs(dpx) < 1.2 && Math.abs(dpz) < 0.9) w.z += (dpz > 0 ? -1 : 1) * dt * 1.5;
          const sw = this.d.sidewalks.reduce((best, s) => (Math.abs(s.z - w.z) < Math.abs(best.z - w.z) ? s : best));
          const halfW = (WALK_OUT - WALK_IN) / 2 - 0.35;
          w.z = THREE.MathUtils.clamp(w.z, sw.z - halfW, sw.z + halfW);
          if (w.x > EXTENT_X - 3) w.x = -EXTENT_X + 4;
          if (w.x < -EXTENT_X + 3) w.x = EXTENT_X - 4;
          w.rig.root.rotation.y = w.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
          moving = w.speed;
          if (Math.random() < dt * 0.02) w.pause = 2 + Math.random() * 6;
        }
      }
      w.rig.root.position.x = w.x;
      w.rig.root.position.z = w.z;
      animatePerson(w.rig, dt, moving);
      // Occasional shout near the player.
      w.bubbleT -= dt;
      const near = Math.hypot(player.x - w.x, player.z - w.z) < 14;
      if (w.bubbleT <= 0) {
        w.bubbleT = 14 + Math.random() * 30;
        if (near && !w.bubble) {
          const text = CROWD_SHOUTS[Math.floor(Math.random() * CROWD_SHOUTS.length)];
          const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: label(text, { bg: "rgba(255,255,255,0.92)", fg: "#1a1a1a" }), depthTest: true }));
          const img = sp.material.map!.image as HTMLCanvasElement;
          sp.scale.set(0.42 * (img.width / img.height), 0.42, 1);
          w.bubble = sp;
          this.group.add(sp);
          setTimeout(() => {
            this.group.remove(sp);
            sp.material.dispose();
            w.bubble = null;
          }, 3200);
        }
      }
      if (w.bubble) w.bubble.position.set(w.x, 2.25, w.z);
    }

    // Named characters: idle, face the player when close.
    for (const a of this.npcs.values()) {
      const dx = player.x - a.home.x, dz = player.z - a.home.z;
      const dist = Math.hypot(dx, dz);
      const targetYaw = dist < 6 ? Math.atan2(dx, dz) : a.home.z > 0 ? Math.PI : 0;
      a.rig.root.rotation.y += (((targetYaw - a.rig.root.rotation.y + Math.PI * 3) % (Math.PI * 2)) - Math.PI) * Math.min(1, dt * 4);
      animatePerson(a.rig, dt, 0);
      a.label.visible = dist < 30;
    }
    void t;
    void camera;
  }

  /** Nearest taxi coming towards the player that could be flagged down. */
  taxiNear(player: THREE.Vector3): Car | null {
    if (Math.abs(player.z) < WALK_IN - 0.5 || Math.abs(player.z) > WALK_OUT + 1) return null;
    let best: Car | null = null;
    let bd = 1e9;
    for (const c of this.cars) {
      if (c.rig.kind !== "taxi" || c.lane.axis !== "x") continue;
      if (Math.sign(c.lane.offset) !== Math.sign(player.z)) continue;
      const ahead = (player.x - c.s) * c.lane.dir;
      if (ahead > 4 && ahead < 45 && ahead < bd) {
        bd = ahead;
        best = c;
      }
    }
    return best;
  }

  hail(c: Car) {
    c.hailed = true;
    this.hailedTaxi = c;
  }

  dispose() {
    this.group.traverse((o) => {
      const s = o as THREE.Sprite;
      if (s.isSprite) s.material.dispose();
    });
  }
}
