// Procedural soundscape (no samples): traffic rumble, horns, waves, rain,
// and a highlife bell pattern drifting out of bars and beach shacks.

export class CityAudio {
  ctx: AudioContext | null = null;
  private master!: GainNode;
  private traffic!: GainNode;
  private waves!: GainNode;
  private rain!: GainNode;
  private music!: GainNode;
  private musicTimer = 0;
  private step = 0;
  muted = false;
  volume = 0.7;

  start() {
    if (this.ctx) return;
    const ctx = new AudioContext();
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = this.muted ? 0 : this.volume;
    this.master.connect(ctx.destination);
    const noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const data = noise.getChannelData(0);
    let last = 0;
    for (let i = 0; i < data.length; i++) {
      const white = Math.random() * 2 - 1;
      last = (last + 0.02 * white) / 1.02; // brown noise
      data[i] = last * 3.5;
    }
    const loop = (gain: GainNode, filterType: BiquadFilterType, freq: number) => {
      const src = ctx.createBufferSource();
      src.buffer = noise;
      src.loop = true;
      const f = ctx.createBiquadFilter();
      f.type = filterType;
      f.frequency.value = freq;
      src.connect(f).connect(gain).connect(this.master);
      src.start();
    };
    this.traffic = ctx.createGain();
    this.traffic.gain.value = 0;
    loop(this.traffic, "lowpass", 320);
    this.waves = ctx.createGain();
    this.waves.gain.value = 0;
    loop(this.waves, "bandpass", 500);
    this.rain = ctx.createGain();
    this.rain.gain.value = 0;
    const white = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const wd = white.getChannelData(0);
    for (let i = 0; i < wd.length; i++) wd[i] = Math.random() * 2 - 1;
    const rs = ctx.createBufferSource();
    rs.buffer = white;
    rs.loop = true;
    const rf = ctx.createBiquadFilter();
    rf.type = "highpass";
    rf.frequency.value = 1800;
    rs.connect(rf).connect(this.rain).connect(this.master);
    rs.start();
    this.music = ctx.createGain();
    this.music.gain.value = 0;
    this.music.connect(this.master);
  }

  setMuted(m: boolean) {
    this.muted = m;
    if (this.ctx) this.master.gain.setTargetAtTime(m ? 0 : this.volume, this.ctx.currentTime, 0.1);
  }

  /** Called every frame with the mix levels for where the player is. */
  update(dt: number, levels: { traffic: number; waves: number; rain: number; music: number }, time: number) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.traffic.gain.setTargetAtTime(levels.traffic * 0.5, t, 0.5);
    this.waves.gain.setTargetAtTime(levels.waves * (0.35 + 0.3 * Math.sin(time * 0.6)), t, 0.3);
    this.rain.gain.setTargetAtTime(levels.rain * 0.18, t, 0.5);
    this.music.gain.setTargetAtTime(levels.music * 0.35, t, 0.4);
    if (levels.music > 0.02) {
      this.musicTimer -= dt;
      while (this.musicTimer <= 0) {
        this.musicTimer += 0.16; // 12/8 feel at ~125 bpm
        this.beat(this.step++ % 12);
      }
    }
  }

  private tone(freq: number, dur: number, type: OscillatorType, vol: number, dest: AudioNode, when = 0) {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.value = freq;
    const t = ctx.currentTime + when;
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(dest);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  private beat(i: number) {
    // The standard West African bell pattern (x.x.xx.x.x.x) over a kick and bass.
    const bell = [1, 0, 1, 0, 1, 1, 0, 1, 0, 1, 0, 1];
    if (bell[i]) this.tone(i === 0 ? 1320 : 990, 0.09, "triangle", 0.25, this.music);
    if (i % 3 === 0) this.tone(58, 0.22, "sine", 0.9, this.music);
    const bass = [110, 0, 0, 98, 0, 0, 82.4, 0, 0, 98, 0, 0];
    if (bass[i]) this.tone(bass[i], 0.32, "sawtooth", 0.12, this.music);
    if (i % 2 === 1) this.tone(4000 + Math.random() * 2000, 0.03, "square", 0.03, this.music);
    const guitar = [659, 0, 784, 0, 659, 0, 587, 0, 523, 0, 587, 0];
    if (guitar[i] && Math.random() < 0.7) this.tone(guitar[i], 0.18, "triangle", 0.07, this.music);
  }

  horn(distance: number) {
    if (!this.ctx || this.muted) return;
    const v = Math.max(0, 0.25 - distance / 160);
    if (v <= 0) return;
    this.tone(410, 0.28, "square", v, this.master);
    this.tone(520, 0.28, "square", v * 0.7, this.master);
  }

  ui(kind: "tap" | "coin" | "goal" | "bad") {
    if (!this.ctx || this.muted) return;
    if (kind === "tap") this.tone(880, 0.05, "sine", 0.1, this.master);
    if (kind === "coin") {
      this.tone(1318, 0.08, "triangle", 0.18, this.master);
      this.tone(1760, 0.14, "triangle", 0.15, this.master, 0.07);
    }
    if (kind === "goal") [523, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.25, "triangle", 0.18, this.master, i * 0.09));
    if (kind === "bad") this.tone(180, 0.25, "sawtooth", 0.12, this.master);
  }
}
