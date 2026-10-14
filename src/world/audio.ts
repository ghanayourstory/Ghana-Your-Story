// The sound of a Ghanaian street, synthesised (no samples): market chatter and
// hawkers calling, shops blasting highlife, gospel or Afrobeats from their own
// speakers, trotro horns and traffic, waves and rain. Every source is placed
// in 3D, so you hear the chop bar on your left fade as you walk past.

export type Genre = "highlife" | "gospel" | "afrobeats";
export interface SoundSpot {
  id: string;
  kind: "market" | "music";
  x: number;
  z: number;
  genre?: Genre;
  loud?: number;
  /** When it's playing (24h, may wrap past midnight). */
  hours?: [number, number];
}

const activeAt = (h: [number, number] | undefined, hour: number) => !h || (h[0] < h[1] ? hour >= h[0] && hour < h[1] : hour >= h[0] || hour < h[1]);

export interface MixSettings {
  master: number;
  market: boolean;
  music: boolean;
  traffic: boolean;
}

export type FootstepSurface = "pavement" | "earth" | "sand" | "wood";

interface Voice {
  spot: SoundSpot;
  out: GainNode;
  panner: PannerNode;
  step: number;
  next: number;
  chord: number;
  stop: () => void;
}

export class CityAudio {
  ctx: AudioContext | null = null;
  private master!: GainNode;
  private busMarket!: GainNode;
  private busMusic!: GainNode;
  private busTraffic!: GainNode;
  private busNature!: GainNode;
  private traffic!: GainNode;
  private waves!: GainNode;
  private rain!: GainNode;
  private noise!: AudioBuffer;
  private spots: SoundSpot[] = [];
  private voices = new Map<string, Voice>();
  private stepPhase = 0;
  private disposed = false;
  muted = false;
  settings: MixSettings = { master: 0.8, market: true, music: true, traffic: true };

  start() {
    if (this.ctx || this.disposed) return;
    const ctx = new AudioContext();
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.connect(ctx.destination);
    const bus = () => {
      const g = ctx.createGain();
      g.connect(this.master);
      return g;
    };
    this.busMarket = bus();
    this.busMusic = bus();
    this.busTraffic = bus();
    this.busNature = bus();
    this.applySettings();
    // Brown noise for rumble/chatter, white for rain and shakers.
    const len = ctx.sampleRate * 2;
    this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const brown = ctx.createBuffer(1, len, ctx.sampleRate);
    const bd = brown.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02;
      bd[i] = last * 3.5;
    }
    const loop = (buf: AudioBuffer, dest: AudioNode, type: BiquadFilterType, freq: number) => {
      const g = ctx.createGain();
      g.gain.value = 0;
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.loop = true;
      const f = ctx.createBiquadFilter();
      f.type = type;
      f.frequency.value = freq;
      src.connect(f).connect(g).connect(dest);
      src.start();
      return g;
    };
    this.traffic = loop(brown, this.busTraffic, "lowpass", 320);
    this.waves = loop(brown, this.busNature, "bandpass", 500);
    this.rain = loop(this.noise, this.busNature, "highpass", 1800);
  }

  applySettings() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const s = this.settings;
    this.master.gain.setTargetAtTime(this.muted ? 0 : s.master, t, 0.1);
    this.busMarket.gain.setTargetAtTime(s.market ? 0.9 : 0, t, 0.2);
    this.busMusic.gain.setTargetAtTime(s.music ? 0.8 : 0, t, 0.2);
    this.busTraffic.gain.setTargetAtTime(s.traffic ? 1 : 0, t, 0.2);
  }

  setMuted(m: boolean) {
    this.muted = m;
    this.applySettings();
  }

  setMix(p: Partial<MixSettings>) {
    this.settings = { ...this.settings, ...p };
    this.applySettings();
  }

  setSpots(spots: SoundSpot[]) {
    this.spots = spots;
    for (const v of this.voices.values()) v.stop();
    this.voices.clear();
  }

  /** Stop all voices and close the audio device when the world is torn down. */
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.voices.forEach((voice) => voice.stop());
    this.voices.clear();
    this.spots = [];
    this.onVoice = null;
    const ctx = this.ctx;
    this.ctx = null;
    if (ctx && ctx.state !== "closed") void ctx.close().catch(() => undefined);
  }

  /** Called every frame with where the player is and how loud the ambient beds should be. */
  update(dt: number, listener: { x: number; z: number; yaw: number }, beds: { traffic: number; waves: number; rain: number; crowd: number; hour: number }, time: number, footsteps?: { speed: number; surface: FootstepSurface }) {
    const ctx = this.ctx;
    if (!ctx) return;
    const t = ctx.currentTime;
    const L = ctx.listener;
    if (L.positionX) {
      L.positionX.setTargetAtTime(listener.x, t, 0.05);
      L.positionY.setTargetAtTime(1.6, t, 0.05);
      L.positionZ.setTargetAtTime(listener.z, t, 0.05);
      L.forwardX.setTargetAtTime(Math.sin(listener.yaw), t, 0.05);
      L.forwardZ.setTargetAtTime(Math.cos(listener.yaw), t, 0.05);
      L.forwardY.value = 0;
      L.upX.value = 0;
      L.upY.value = 1;
      L.upZ.value = 0;
    }
    this.traffic.gain.setTargetAtTime(beds.traffic * 0.45, t, 0.5);
    this.waves.gain.setTargetAtTime(beds.waves * (0.35 + 0.3 * Math.sin(time * 0.6)), t, 0.3);
    this.rain.gain.setTargetAtTime(beds.rain * 0.16, t, 0.5);
    this.updateFootsteps(dt, footsteps?.speed ?? 0, footsteps?.surface ?? "pavement");

    // Keep the nearest few sound sources alive; fade out the rest.
    const near = this.spots
      .filter((s) => activeAt(s.hours, beds.hour))
      .map((s) => ({ s, d: Math.hypot(s.x - listener.x, s.z - listener.z) }))
      .filter((o) => o.d < (o.s.kind === "market" ? 70 : 45))
      .sort((a, b) => a.d - b.d)
      .slice(0, 5);
    const keep = new Set(near.map((o) => o.s.id));
    for (const [id, v] of this.voices) {
      if (!keep.has(id)) {
        v.stop();
        this.voices.delete(id);
      }
    }
    for (const { s } of near) if (!this.voices.has(s.id)) this.voices.set(s.id, this.makeVoice(s, beds));
    for (const v of this.voices.values()) {
      if (v.spot.kind === "music") this.scheduleMusic(v);
      else this.scheduleMarket(v, beds.crowd);
    }
    void dt;
  }

  private updateFootsteps(dt: number, speed: number, surface: FootstepSurface) {
    const ctx = this.ctx;
    if (!ctx || this.muted || this.settings.master <= 0 || speed < 0.38) {
      this.stepPhase = 0;
      return;
    }
    // A natural walking cadence of about two footfalls a second, rising to
    // three while running. Playback follows the same eased speed as the rig.
    this.stepPhase += dt * (1.38 + Math.min(speed, 5) * 0.37);
    while (this.stepPhase >= 1) {
      this.stepPhase -= 1;
      this.playFootstep(surface, speed);
    }
  }

  private playFootstep(surface: FootstepSurface, speed: number) {
    const ctx = this.ctx;
    if (!ctx || !this.noise) return;
    const now = ctx.currentTime;
    const filterHz: Record<FootstepSurface, number> = { pavement: 1250, earth: 780, sand: 430, wood: 1650 };
    const source = ctx.createBufferSource();
    source.buffer = this.noise;
    source.playbackRate.value = 0.75 + Math.random() * 0.25;
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = filterHz[surface];
    const envelope = ctx.createGain();
    const gain = Math.min(0.075, 0.027 + speed * 0.009);
    envelope.gain.setValueAtTime(0.0001, now);
    envelope.gain.exponentialRampToValueAtTime(gain, now + 0.006);
    envelope.gain.exponentialRampToValueAtTime(0.0001, now + 0.075);
    source.connect(filter).connect(envelope).connect(this.master);
    source.start(now);
    source.stop(now + 0.09);
  }

  /** Told when a nearby sound source starts (for captions). */
  onVoice: ((spot: SoundSpot) => void) | null = null;

  private makeVoice(spot: SoundSpot, beds: { crowd: number }): Voice {
    const ctx = this.ctx!;
    this.onVoice?.(spot);
    const panner = ctx.createPanner();
    panner.panningModel = "HRTF";
    panner.distanceModel = "inverse";
    panner.refDistance = spot.kind === "market" ? 6 : 3;
    panner.rolloffFactor = 1.2;
    panner.positionX.value = spot.x;
    panner.positionY.value = 2;
    panner.positionZ.value = spot.z;
    const out = ctx.createGain();
    out.gain.value = 0;
    out.gain.setTargetAtTime(spot.loud ?? 1, ctx.currentTime, 0.6);
    out.connect(panner).connect(spot.kind === "market" ? this.busMarket : this.busMusic);
    const stops: (() => void)[] = [];
    if (spot.kind === "market") {
      // A bed of overlapping voices: band-passed noise with syllable-rate amplitude flutter.
      for (let i = 0; i < 6; i++) {
        const src = ctx.createBufferSource();
        src.buffer = this.noise;
        src.loop = true;
        src.loopStart = Math.random();
        const bp = ctx.createBiquadFilter();
        bp.type = "bandpass";
        bp.frequency.value = 350 + Math.random() * 900;
        bp.Q.value = 2.5;
        const g = ctx.createGain();
        g.gain.value = 0.05 * (0.5 + beds.crowd);
        const lfo = ctx.createOscillator();
        lfo.frequency.value = 3 + Math.random() * 4;
        const lfoGain = ctx.createGain();
        lfoGain.gain.value = 0.045;
        lfo.connect(lfoGain).connect(g.gain);
        src.connect(bp).connect(g).connect(out);
        src.start();
        lfo.start();
        stops.push(() => { src.stop(); lfo.stop(); });
      }
    }
    return {
      spot, out, panner, step: 0, next: ctx.currentTime + Math.random() * 0.3, chord: 0,
      stop: () => {
        out.gain.setTargetAtTime(0, ctx.currentTime, 0.3);
        setTimeout(() => stops.forEach((s) => s()), 1500);
      },
    };
  }

  // ---------------------------------------------------------------------------
  // Synth voices

  private tone(dest: AudioNode, when: number, freq: number, dur: number, type: OscillatorType, vol: number, glide?: number) {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, when);
    if (glide) o.frequency.exponentialRampToValueAtTime(glide, when + dur);
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(vol, when + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    o.connect(g).connect(dest);
    o.start(when);
    o.stop(when + dur + 0.05);
  }

  private hit(dest: AudioNode, when: number, dur: number, freq: number, vol: number, type: BiquadFilterType = "highpass") {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, when);
    g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    src.connect(f).connect(g).connect(dest);
    src.start(when, Math.random());
    src.stop(when + dur + 0.02);
  }

  /** A hawker's call: a sung two- or three-syllable phrase with vowel formants ("Pure wa-ter!"). */
  private call(dest: AudioNode, when: number) {
    const ctx = this.ctx!;
    const f0 = 170 + Math.random() * 120;
    const syll = 2 + Math.floor(Math.random() * 2);
    for (let i = 0; i < syll; i++) {
      const at = when + i * 0.22;
      const o = ctx.createOscillator();
      o.type = "sawtooth";
      const up = i === syll - 1 ? 1.25 : 1 + (Math.random() - 0.5) * 0.2;
      o.frequency.setValueAtTime(f0, at);
      o.frequency.linearRampToValueAtTime(f0 * up, at + 0.18);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, at);
      g.gain.linearRampToValueAtTime(0.09, at + 0.03);
      g.gain.linearRampToValueAtTime(0.0001, at + (i === syll - 1 ? 0.4 : 0.2));
      const f1 = ctx.createBiquadFilter(), f2 = ctx.createBiquadFilter();
      f1.type = f2.type = "bandpass";
      f1.frequency.value = 650 + Math.random() * 250;
      f2.frequency.value = 1100 + Math.random() * 500;
      f1.Q.value = f2.Q.value = 6;
      o.connect(f1).connect(g);
      o.connect(f2).connect(g);
      g.connect(dest);
      o.start(at);
      o.stop(at + 0.45);
    }
  }

  private scheduleMarket(v: Voice, crowd: number) {
    const ctx = this.ctx!;
    while (v.next < ctx.currentTime + 0.4) {
      if (Math.random() < 0.35 + crowd * 0.4) this.call(v.out, v.next);
      if (Math.random() < 0.15) this.tone(v.out, v.next + 0.1, 1500 + Math.random() * 400, 0.05, "square", 0.02); // a bicycle bell / coins
      v.next += 1.6 + Math.random() * 3.5;
    }
  }

  private scheduleMusic(v: Voice) {
    const ctx = this.ctx!;
    const g = v.spot.genre ?? "highlife";
    const bpm = g === "gospel" ? 126 : g === "afrobeats" ? 104 : 120;
    const stepDur = g === "highlife" ? 60 / bpm / 3 : 60 / bpm / 4; // 12/8 vs 16ths
    while (v.next < ctx.currentTime + 0.3) {
      const t = v.next;
      const i = v.step;
      const o = v.out;
      if (g === "highlife") {
        const k = i % 12;
        if ([0, 2, 4, 5, 7, 9, 11].includes(k)) this.tone(o, t, k === 0 ? 1320 : 990, 0.08, "triangle", 0.12); // the bell pattern
        if (k % 3 === 0) this.tone(o, t, 62, 0.25, "sine", 0.5, 45);
        const bass = [110, 0, 0, 98, 0, 0, 82.4, 0, 0, 98, 0, 0][k];
        if (bass) this.tone(o, t, bass, 0.3, "sawtooth", 0.07);
        const gtr = [659, 0, 784, 0, 659, 0, 587, 0, 523, 0, 587, 0][k];
        if (gtr) this.tone(o, t, gtr * (Math.floor(i / 48) % 2 ? 0.89 : 1), 0.2, "triangle", 0.05);
        if (k % 2) this.hit(o, t, 0.04, 7000, 0.04);
      } else if (g === "gospel") {
        const k = i % 16;
        if (k === 0 || k === 8) this.tone(o, t, 58, 0.3, "sine", 0.5, 42);
        if (k === 4 || k === 12) { this.hit(o, t, 0.12, 1200, 0.25, "bandpass"); this.hit(o, t + 0.01, 0.1, 2400, 0.18, "bandpass"); } // hand claps
        if (k % 2 === 0) this.hit(o, t, 0.05, 8000, 0.05); // tambourine
        if (k === 0) {
          const roots = [261.6, 349.2, 392, 349.2];
          const r = roots[v.chord++ % 4];
          for (const m of [1, 1.26, 1.5]) this.tone(o, t, r * m, 60 / bpm * 4, "triangle", 0.035); // organ chord
          this.tone(o, t, r / 2, 60 / bpm * 2, "sine", 0.1);
        }
      } else {
        const k = i % 16;
        if ([0, 3, 6, 10].includes(k)) this.tone(o, t, 55, 0.22, "sine", 0.55, 40);
        if (k === 4 || k === 12) this.hit(o, t, 0.08, 2500, 0.16, "bandpass"); // rim
        this.hit(o, t, 0.035, 9000, k % 4 === 2 ? 0.07 : 0.035); // shaker
        if ([2, 7, 14].includes(k)) this.tone(o, t, [98, 110, 87.3][(i >> 4) % 3], 0.35, "sine", 0.22, 70); // log drum
        if (k === 8 && Math.random() < 0.6) for (const f of [523, 659, 784]) this.tone(o, t, f, 0.12, "square", 0.012);
      }
      v.step++;
      v.next += stepDur;
    }
  }

  horn(distance: number) {
    if (!this.ctx || this.muted || !this.settings.traffic) return;
    const v = Math.max(0, 0.22 - distance / 160);
    if (v <= 0) return;
    const t = this.ctx.currentTime;
    this.tone(this.busTraffic, t, 410, 0.28, "square", v);
    this.tone(this.busTraffic, t, 520, 0.28, "square", v * 0.7);
  }

  ui(kind: "tap" | "coin" | "goal" | "bad") {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    if (kind === "tap") this.tone(this.master, t, 880, 0.05, "sine", 0.1);
    if (kind === "coin") {
      this.tone(this.master, t, 1318, 0.08, "triangle", 0.18);
      this.tone(this.master, t + 0.07, 1760, 0.14, "triangle", 0.15);
    }
    if (kind === "goal") [523, 659, 784, 1046].forEach((f, i) => this.tone(this.master, t + i * 0.09, f, 0.25, "triangle", 0.18));
    if (kind === "bad") this.tone(this.master, t, 180, 0.25, "sawtooth", 0.12);
  }
}
