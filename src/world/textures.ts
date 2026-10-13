// Procedural textures painted on canvases at startup — all original art.
import * as THREE from "three";
import { mulberry32 } from "../../shared/rng.ts";

const cache = new Map<string, THREE.Texture>();
let maxAniso = 4;
export function setMaxAnisotropy(n: number) {
  maxAniso = Math.min(8, n);
}

function canvas(w: number, h: number) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return [c, c.getContext("2d")!] as const;
}

function toTexture(c: HTMLCanvasElement, opts: { srgb?: boolean; repeat?: boolean } = {}) {
  const t = new THREE.CanvasTexture(c);
  if (opts.srgb !== false) t.colorSpace = THREE.SRGBColorSpace;
  if (opts.repeat !== false) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = maxAniso;
  t.needsUpdate = true;
  return t;
}

function memo(key: string, make: () => THREE.Texture) {
  let t = cache.get(key);
  if (!t) {
    t = make();
    cache.set(key, t);
  }
  return t;
}

/** Multi-octave grain painted over an existing canvas. */
function grain(ctx: CanvasRenderingContext2D, w: number, h: number, strength: number, seed: number) {
  const rnd = mulberry32(seed);
  for (const scale of [1, 3, 24]) {
    const [nc, nctx] = canvas(Math.ceil(w / scale), Math.ceil(h / scale));
    const img = nctx.createImageData(nc.width, nc.height);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = Math.floor(rnd() * 255);
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
      img.data[i + 3] = 255;
    }
    nctx.putImageData(img, 0, 0);
    ctx.globalAlpha = strength * (scale === 1 ? 0.9 : scale === 3 ? 0.45 : 0.22);
    ctx.globalCompositeOperation = "overlay";
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(nc, 0, 0, w, h);
  }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = "source-over";
}

function stains(ctx: CanvasRenderingContext2D, w: number, h: number, n: number, color: string, maxR: number, seed: number) {
  const rnd = mulberry32(seed);
  for (let i = 0; i < n; i++) {
    const x = rnd() * w, y = rnd() * h, r = maxR * (0.3 + rnd() * 0.7);
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, color);
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(x, y, r, r * (0.5 + rnd() * 0.5), rnd() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** Road surface. `dusty`: the pale, sun-bleached, sand-blown tarmac of the northern savanna. */
export function asphalt(dusty = false) {
  return memo(dusty ? "asphalt:dusty" : "asphalt", () => {
    const [c, ctx] = canvas(1024, 1024);
    ctx.fillStyle = dusty ? "#77706a" : "#4b4c4e";
    ctx.fillRect(0, 0, 1024, 1024);
    grain(ctx, 1024, 1024, 0.22, 11);
    const rnd = mulberry32(15);
    // Aggregate: light and dark stone flecks.
    for (let i = 0; i < 9000; i++) {
      const v = rnd() < 0.5 ? 30 + rnd() * 30 : 110 + rnd() * 60;
      ctx.fillStyle = `rgba(${v},${v},${v + 4},${0.25 + rnd() * 0.35})`;
      ctx.fillRect(rnd() * 1024, rnd() * 1024, 1 + rnd() * 1.6, 1 + rnd() * 1.6);
    }
    stains(ctx, 1024, 1024, 10, "rgba(25,25,27,0.22)", 90, 12); // oil and patches
    stains(ctx, 1024, 1024, 8, "rgba(140,125,100,0.12)", 120, 13); // laterite dust
    if (dusty) {
      stains(ctx, 1024, 1024, 26, "rgba(196,150,100,0.3)", 160, 14); // harmattan dust drifts
      stains(ctx, 1024, 1024, 12, "rgba(60,56,52,0.25)", 50, 16); // potholes patched with tar
      // Sand blown in from the shoulders along both edges.
      for (const [y0, y1] of [[0, 90], [1024, 934]]) {
        const g = ctx.createLinearGradient(0, y0, 0, y1);
        g.addColorStop(0, "rgba(190,140,90,0.75)");
        g.addColorStop(1, "rgba(190,140,90,0)");
        ctx.fillStyle = g;
        ctx.fillRect(0, Math.min(y0, y1), 1024, 90);
      }
    }
    // Tyre-polished wheel tracks.
    for (const y of [300, 720]) {
      const g = ctx.createLinearGradient(0, y - 70, 0, y + 70);
      g.addColorStop(0, "rgba(20,20,22,0)");
      g.addColorStop(0.5, "rgba(20,20,22,0.16)");
      g.addColorStop(1, "rgba(20,20,22,0)");
      ctx.fillStyle = g;
      ctx.fillRect(0, y - 70, 1024, 140);
    }
    ctx.strokeStyle = "rgba(20,20,20,0.45)";
    ctx.lineWidth = 1.2;
    for (let i = 0; i < 6; i++) {
      ctx.beginPath();
      let x = rnd() * 1024, y = rnd() * 1024;
      ctx.moveTo(x, y);
      for (let k = 0; k < 10; k++) {
        x += (rnd() - 0.5) * 40;
        y += (rnd() - 0.5) * 40;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    return toTexture(c);
  });
}

/**
 * Bare earth. "red": the default laterite of Accra's verges. "forest": the deep
 * red earth of the middle belt, with green weeds. "ochre": the dry, dusty
 * savanna ground of the north. "path": packed footpath dirt.
 */
export function laterite(tone: "red" | "forest" | "ochre" | "path" = "red") {
  return memo(tone === "red" ? "laterite" : `laterite:${tone}`, () => {
    const [c, ctx] = canvas(512, 512);
    ctx.fillStyle = { red: "#9b6e52", forest: "#9a5634", ochre: "#b98a5c", path: "#a8784f" }[tone];
    ctx.fillRect(0, 0, 512, 512);
    grain(ctx, 512, 512, tone === "path" ? 0.16 : 0.25, 21);
    stains(ctx, 512, 512, 14, "rgba(110,70,45,0.22)", 60, 22);
    stains(ctx, 512, 512, 12, tone === "ochre" ? "rgba(214,180,130,0.32)" : "rgba(190,160,120,0.2)", 70, 23);
    if (tone === "forest") stains(ctx, 512, 512, 14, "rgba(70,105,45,0.35)", 60, 26); // weeds and grass
    else if (tone === "ochre") stains(ctx, 512, 512, 10, "rgba(170,150,80,0.3)", 40, 27); // dry grass
    else stains(ctx, 512, 512, 6, "rgba(90,100,60,0.18)", 50, 25); // patches of weeds
    const rnd = mulberry32(24);
    for (let i = 0; i < 400; i++) {
      ctx.fillStyle = `rgba(${60 + rnd() * 80},${40 + rnd() * 40},${30 + rnd() * 30},0.6)`;
      ctx.fillRect(rnd() * 512, rnd() * 512, 2 + rnd() * 3, 2 + rnd() * 3);
    }
    return toTexture(c);
  });
}

export function pavers() {
  return memo("pavers", () => {
    const [c, ctx] = canvas(512, 512);
    ctx.fillStyle = "#8f8a82";
    ctx.fillRect(0, 0, 512, 512);
    const rnd = mulberry32(31);
    const s = 64;
    for (let y = 0; y < 512; y += s / 2) {
      for (let x = (y / (s / 2)) % 2 ? -s / 2 : 0; x < 512; x += s) {
        const v = 125 + rnd() * 35;
        ctx.fillStyle = `rgb(${v + 8},${v + 2},${v - 6})`;
        ctx.fillRect(x + 2, y + 2, s - 4, s / 2 - 4);
      }
    }
    grain(ctx, 512, 512, 0.1, 32);
    stains(ctx, 512, 512, 10, "rgba(60,50,40,0.16)", 50, 33);
    return toTexture(c);
  });
}

export function concrete(tint = "#b5aea3", seed = 41) {
  return memo(`concrete:${tint}:${seed}`, () => {
    const [c, ctx] = canvas(256, 256);
    ctx.fillStyle = tint;
    ctx.fillRect(0, 0, 256, 256);
    grain(ctx, 256, 256, 0.16, seed);
    stains(ctx, 256, 256, 6, "rgba(50,45,40,0.14)", 40, seed + 1);
    return toTexture(c);
  });
}

export function sand() {
  return memo("sand", () => {
    const [c, ctx] = canvas(512, 512);
    ctx.fillStyle = "#b99c6e";
    ctx.fillRect(0, 0, 512, 512);
    grain(ctx, 512, 512, 0.22, 51);
    const rnd = mulberry32(52);
    ctx.strokeStyle = "rgba(160,135,95,0.25)";
    for (let i = 0; i < 60; i++) {
      ctx.beginPath();
      const y = rnd() * 512;
      ctx.moveTo(0, y);
      for (let x = 0; x <= 512; x += 32) ctx.lineTo(x, y + Math.sin(x / 40 + i) * 4);
      ctx.stroke();
    }
    return toTexture(c);
  });
}

export function grass(lush = false) {
  return memo(`grass:${lush}`, () => {
    const [c, ctx] = canvas(512, 512);
    ctx.fillStyle = lush ? "#4f8a37" : "#7c8c4a";
    ctx.fillRect(0, 0, 512, 512);
    grain(ctx, 512, 512, 0.4, 61);
    const rnd = mulberry32(62);
    for (let i = 0; i < 3500; i++) {
      const g = lush ? 110 + rnd() * 60 : 110 + rnd() * 50;
      ctx.strokeStyle = `rgba(${lush ? 40 + rnd() * 40 : 90 + rnd() * 50},${g},${30 + rnd() * 30},0.55)`;
      const x = rnd() * 512, y = rnd() * 512;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + (rnd() - 0.5) * 4, y - 3 - rnd() * 6);
      ctx.stroke();
    }
    if (!lush) stains(ctx, 512, 512, 12, "rgba(150,100,60,0.35)", 50, 63);
    return toTexture(c);
  });
}

/**
 * A facade tile: 3 m wide × 3 m storey. Louvre windows with burglar bars,
 * dirt streaks under the sills. Returns colour map (white-ish, tinted by
 * material colour) and an emissive map of lit windows for night.
 */
export function facade(kind: "louvre" | "glass" | "modern" | "small") {
  const key = `facade:${kind}`;
  if (cache.has(key)) return { map: cache.get(key)!, emissive: cache.get(key + ":e")! };
  const S = 256;
  const [c, ctx] = canvas(S * 2, S * 2); // 2×2 tiles for variety
  const [e, ectx] = canvas(S * 2, S * 2);
  ectx.fillStyle = "#000";
  ectx.fillRect(0, 0, S * 2, S * 2);
  const rnd = mulberry32(kind === "glass" ? 71 : kind === "modern" ? 72 : kind === "small" ? 75 : 73);
  if (kind === "small") {
    // Smooth mud / cement render with small, deep-set windows behind painted
    // steel shutters: the northern savanna house. Some bays have no window.
    ctx.fillStyle = "#f2ece2";
    ctx.fillRect(0, 0, S * 2, S * 2);
    grain(ctx, S * 2, S * 2, 0.2, 76);
    stains(ctx, S * 2, S * 2, 10, "rgba(120,80,50,0.16)", 70, 77);
    for (let ty = 0; ty < 2; ty++)
      for (let tx = 0; tx < 2; tx++) {
        const x0 = tx * S, y0 = ty * S;
        // Rain-washed streaks and red dust splashed up the base.
        const bg = ctx.createLinearGradient(0, y0 + S - 50, 0, y0 + S);
        bg.addColorStop(0, "rgba(140,80,45,0)");
        bg.addColorStop(1, "rgba(140,80,45,0.45)");
        ctx.fillStyle = bg;
        ctx.fillRect(x0, y0 + S - 50, S, 50);
        if (tx === 1 && ty === 0) continue; // blank wall
        const ww = 58, wh = 62;
        const wx = x0 + (S - ww) / 2 + (rnd() - 0.5) * 40, wy = y0 + 84;
        ctx.fillStyle = "rgba(90,70,50,0.35)";
        ctx.fillRect(wx - 7, wy - 7, ww + 14, wh + 14);
        ctx.fillStyle = "#2a241f";
        ctx.fillRect(wx, wy, ww, wh);
        if (rnd() < 0.4) {
          ectx.fillStyle = `rgba(255,${180 + rnd() * 40},${100 + rnd() * 50},1)`;
          ectx.fillRect(wx + 4, wy + 4, ww - 8, wh - 8);
        }
        // Painted steel shutters, one half swung open.
        ctx.fillStyle = ["#2f6f62", "#3b5d8c", "#6b3a2a", "#2f6f62"][Math.floor(rnd() * 4)];
        ctx.fillRect(wx, wy, ww / 2 - 1, wh);
        ctx.fillStyle = "rgba(0,0,0,0.25)";
        for (let y = wy + 6; y < wy + wh; y += 10) ctx.fillRect(wx + 2, y, ww / 2 - 5, 2);
        // Sill.
        ctx.fillStyle = "rgba(220,205,180,0.9)";
        ctx.fillRect(wx - 9, wy + wh + 2, ww + 18, 6);
      }
  } else if (kind === "glass") {
    ctx.fillStyle = "#9fb3c2";
    ctx.fillRect(0, 0, S * 2, S * 2);
    for (let ty = 0; ty < 2; ty++)
      for (let tx = 0; tx < 2; tx++) {
        const x0 = tx * S, y0 = ty * S;
        const g = ctx.createLinearGradient(x0, y0, x0 + S, y0 + S);
        g.addColorStop(0, "#52687a");
        g.addColorStop(0.5, "#7d98ab");
        g.addColorStop(1, "#3b4c5a");
        ctx.fillStyle = g;
        ctx.fillRect(x0 + 6, y0 + 30, S - 12, S - 40);
        ctx.fillStyle = "#c9d1d6";
        ctx.fillRect(x0, y0, S, 24);
        ctx.fillRect(x0 + S / 2 - 3, y0 + 24, 6, S - 24);
        if (rnd() < 0.5) {
          ectx.fillStyle = `rgba(255,${220 + rnd() * 30},${160 + rnd() * 60},1)`;
          ectx.fillRect(x0 + 6, y0 + 30, S - 12, S - 40);
        }
      }
  } else {
    ctx.fillStyle = "#f4f1ea";
    ctx.fillRect(0, 0, S * 2, S * 2);
    grain(ctx, S * 2, S * 2, 0.18, 74);
    for (let ty = 0; ty < 2; ty++)
      for (let tx = 0; tx < 2; tx++) {
        const x0 = tx * S, y0 = ty * S;
        const ww = kind === "modern" ? 150 : 104, wh = kind === "modern" ? 130 : 112;
        const wx = x0 + (S - ww) / 2, wy = y0 + 62;
        // Dirt streaks below the sill.
        const sg = ctx.createLinearGradient(0, wy + wh, 0, wy + wh + 80);
        sg.addColorStop(0, "rgba(70,60,50,0.28)");
        sg.addColorStop(1, "rgba(70,60,50,0)");
        ctx.fillStyle = sg;
        ctx.fillRect(wx + 6, wy + wh, ww - 12, 80);
        // Frame and glass.
        ctx.fillStyle = kind === "modern" ? "#3b3f44" : "#d9d4c8";
        ctx.fillRect(wx - 6, wy - 6, ww + 12, wh + 12);
        ctx.fillStyle = "#2f3b44";
        ctx.fillRect(wx, wy, ww, wh);
        const lit = rnd() < 0.45;
        if (lit) {
          ectx.fillStyle = `rgba(255,${200 + rnd() * 40},${130 + rnd() * 60},1)`;
          ectx.fillRect(wx, wy, ww, wh);
        }
        if (kind === "louvre") {
          // Louvre blades.
          for (let y = wy + 4; y < wy + wh; y += 11) {
            const g = ctx.createLinearGradient(0, y, 0, y + 9);
            g.addColorStop(0, "rgba(180,200,210,0.85)");
            g.addColorStop(1, "rgba(60,80,90,0.85)");
            ctx.fillStyle = g;
            ctx.fillRect(wx + 2, y, ww - 4, 8);
          }
          // Burglar-proof bars.
          ctx.strokeStyle = "#2b2b2b";
          ctx.lineWidth = 3;
          for (let x = wx + 13; x < wx + ww; x += 20) {
            ctx.beginPath();
            ctx.moveTo(x, wy);
            ctx.lineTo(x, wy + wh);
            ctx.stroke();
          }
          ctx.strokeRect(wx + 1, wy + wh / 2, ww - 2, 0);
          // Sill.
          ctx.fillStyle = "#cfc8b9";
          ctx.fillRect(wx - 10, wy + wh + 6, ww + 20, 8);
        } else {
          const g = ctx.createLinearGradient(wx, wy, wx + ww, wy + wh);
          g.addColorStop(0, "rgba(140,170,190,0.9)");
          g.addColorStop(1, "rgba(50,70,85,0.9)");
          ctx.fillStyle = g;
          ctx.fillRect(wx + 3, wy + 3, ww - 6, wh - 6);
          ctx.fillStyle = "#3b3f44";
          ctx.fillRect(wx + ww / 2 - 2, wy, 4, wh);
        }
        // Floor band.
        ctx.fillStyle = "rgba(0,0,0,0.06)";
        ctx.fillRect(x0, y0 + S - 10, S, 10);
      }
  }
  const map = toTexture(c);
  const emissive = toTexture(e);
  cache.set(key, map);
  cache.set(key + ":e", emissive);
  return { map, emissive };
}

/** Plaster for walls without windows (compound walls, sides). Grime at the base. */
export function plaster() {
  return memo("plaster", () => {
    const [c, ctx] = canvas(256, 256);
    ctx.fillStyle = "#f2efe7";
    ctx.fillRect(0, 0, 256, 256);
    grain(ctx, 256, 256, 0.22, 81);
    stains(ctx, 256, 256, 6, "rgba(90,80,65,0.14)", 50, 82);
    const g = ctx.createLinearGradient(0, 200, 0, 256);
    g.addColorStop(0, "rgba(120,80,50,0)");
    g.addColorStop(1, "rgba(120,80,50,0.4)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 200, 256, 56);
    return toTexture(c);
  });
}

export function corrugated(rusty: boolean) {
  return memo(`corrugated:${rusty}`, () => {
    const [c, ctx] = canvas(256, 256);
    for (let x = 0; x < 256; x += 16) {
      const g = ctx.createLinearGradient(x, 0, x + 16, 0);
      g.addColorStop(0, "#9aa0a4");
      g.addColorStop(0.5, "#e4e6e8");
      g.addColorStop(1, "#8a9094");
      ctx.fillStyle = g;
      ctx.fillRect(x, 0, 16, 256);
    }
    if (rusty) {
      stains(ctx, 256, 256, 22, "rgba(140,60,20,0.55)", 45, 91);
      stains(ctx, 256, 256, 10, "rgba(90,40,15,0.5)", 30, 92);
    }
    grain(ctx, 256, 256, 0.15, 93);
    return toTexture(c);
  });
}

export function shutter() {
  return memo("shutter", () => {
    const [c, ctx] = canvas(256, 256);
    for (let y = 0; y < 256; y += 10) {
      const g = ctx.createLinearGradient(0, y, 0, y + 10);
      g.addColorStop(0, "#c3c6c9");
      g.addColorStop(1, "#7d8286");
      ctx.fillStyle = g;
      ctx.fillRect(0, y, 256, 10);
    }
    stains(ctx, 256, 256, 8, "rgba(100,60,30,0.35)", 30, 101);
    return toTexture(c);
  });
}

export function water() {
  return memo("waternormal", () => {
    const [c, ctx] = canvas(256, 256);
    const img = ctx.createImageData(256, 256);
    for (let y = 0; y < 256; y++)
      for (let x = 0; x < 256; x++) {
        const a = Math.sin((x / 256) * Math.PI * 8 + Math.sin((y / 256) * Math.PI * 4) * 1.5);
        const b = Math.cos((y / 256) * Math.PI * 10 + Math.sin((x / 256) * Math.PI * 6));
        const i = (y * 256 + x) * 4;
        img.data[i] = 128 + a * 40;
        img.data[i + 1] = 128 + b * 40;
        img.data[i + 2] = 255;
        img.data[i + 3] = 255;
      }
    ctx.putImageData(img, 0, 0);
    return toTexture(c, { srgb: false });
  });
}

/** Smooth hand-trowelled mud or cement render (tinted by material colour). */
export function render() {
  return memo("render", () => {
    const [c, ctx] = canvas(256, 256);
    ctx.fillStyle = "#f3eee6";
    ctx.fillRect(0, 0, 256, 256);
    grain(ctx, 256, 256, 0.18, 121);
    const rnd = mulberry32(122);
    // Trowel swirls.
    ctx.strokeStyle = "rgba(120,90,60,0.08)";
    ctx.lineWidth = 6;
    for (let i = 0; i < 40; i++) {
      ctx.beginPath();
      ctx.arc(rnd() * 256, rnd() * 256, 10 + rnd() * 26, rnd() * 6, rnd() * 6 + 1.5);
      ctx.stroke();
    }
    stains(ctx, 256, 256, 8, "rgba(110,70,40,0.16)", 50, 123);
    // Vertical rain streaks.
    for (let i = 0; i < 14; i++) {
      const x = rnd() * 256, w = 2 + rnd() * 5;
      const g = ctx.createLinearGradient(0, 0, 0, 256);
      g.addColorStop(0, "rgba(90,60,40,0.14)");
      g.addColorStop(1, "rgba(90,60,40,0)");
      ctx.fillStyle = g;
      ctx.fillRect(x, 0, w, 120 + rnd() * 130);
    }
    return toTexture(c);
  });
}

/** Grass thatch for conical hut roofs: straw strokes running down the cone. */
export function thatch() {
  return memo("thatch", () => {
    const [c, ctx] = canvas(256, 256);
    ctx.fillStyle = "#a88a55";
    ctx.fillRect(0, 0, 256, 256);
    const rnd = mulberry32(131);
    for (let i = 0; i < 2600; i++) {
      const v = rnd();
      ctx.strokeStyle = `rgba(${150 + v * 80},${120 + v * 70},${60 + v * 40},${0.5 + rnd() * 0.4})`;
      ctx.lineWidth = 1 + rnd() * 1.5;
      const x = rnd() * 256, y = rnd() * 256;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + (rnd() - 0.5) * 6, y + 18 + rnd() * 30);
      ctx.stroke();
    }
    // Tied courses.
    ctx.fillStyle = "rgba(70,50,30,0.35)";
    for (let y = 30; y < 256; y += 64) ctx.fillRect(0, y, 256, 5);
    return toTexture(c);
  });
}

/** Woven grass / raffia mat in two colours. */
export function mat(a = "#d8b878", b = "#8a5a32") {
  return memo(`mat:${a}:${b}`, () => {
    const [c, ctx] = canvas(128, 128);
    ctx.fillStyle = a;
    ctx.fillRect(0, 0, 128, 128);
    for (let y = 0; y < 128; y += 8)
      for (let x = 0; x < 128; x += 8) {
        ctx.fillStyle = ((x + y) / 8) % 2 ? a : b;
        if (((x / 8) + (y / 8)) % 4 < 2) ctx.fillRect(x, y + 1, 8, 6);
        else ctx.fillRect(x + 1, y, 6, 8);
      }
    ctx.fillStyle = b;
    for (let y = 0; y < 128; y += 32) ctx.fillRect(0, y, 128, 3);
    grain(ctx, 128, 128, 0.2, 141);
    return toTexture(c);
  });
}

/** Bare sandcrete blocks with mortar joints: the eternal unfinished building. */
export function blocks() {
  return memo("blocks", () => {
    const [c, ctx] = canvas(256, 256);
    ctx.fillStyle = "#8d8a84";
    ctx.fillRect(0, 0, 256, 256);
    const rnd = mulberry32(151);
    const bw = 64, bh = 32; // 45 cm x 22.5 cm at 6 m per 2 tiles... close enough
    for (let y = 0; y < 256; y += bh)
      for (let x = (y / bh) % 2 ? -bw / 2 : 0; x < 256; x += bw) {
        const v = 150 + rnd() * 30;
        ctx.fillStyle = `rgb(${v},${v - 3},${v - 8})`;
        ctx.fillRect(x + 2, y + 2, bw - 4, bh - 4);
      }
    grain(ctx, 256, 256, 0.25, 152);
    stains(ctx, 256, 256, 6, "rgba(60,50,40,0.22)", 50, 153);
    return toTexture(c);
  });
}

// ---------------------------------------------------------------------------
// Painted signs

export function signboard(text: string, bg: string, fg: string, opts: { sub?: string; w?: number; h?: number; border?: string } = {}) {
  const key = `sign:${text}:${bg}:${fg}:${opts.sub ?? ""}`;
  return memo(key, () => {
    const W = opts.w ?? 1024, H = opts.h ?? 192;
    const [c, ctx] = canvas(W, H);
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);
    grain(ctx, W, H, 0.12, text.length * 7);
    ctx.strokeStyle = opts.border ?? fg;
    ctx.lineWidth = 10;
    ctx.strokeRect(10, 10, W - 20, H - 20);
    let size = H * (opts.sub ? 0.4 : 0.52);
    ctx.font = `900 ${size}px "Arial Black", Impact, system-ui, sans-serif`;
    while (ctx.measureText(text).width > W - 60 && size > 14) {
      size -= 2;
      ctx.font = `900 ${size}px "Arial Black", Impact, system-ui, sans-serif`;
    }
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "rgba(0,0,0,0.25)";
    ctx.fillText(text, W / 2 + 4, (opts.sub ? H * 0.4 : H / 2) + 4);
    ctx.fillStyle = fg;
    ctx.fillText(text, W / 2, opts.sub ? H * 0.4 : H / 2);
    if (opts.sub) {
      ctx.font = `700 ${H * 0.2}px system-ui, sans-serif`;
      ctx.fillText(opts.sub, W / 2, H * 0.78);
    }
    stains(ctx, W, H, 5, "rgba(80,60,40,0.18)", H * 0.5, text.length);
    return toTexture(c, { repeat: false });
  });
}

/** Floating name label (sprite). */
export function label(text: string, opts: { bg?: string; fg?: string; icon?: string } = {}) {
  const key = `label:${text}:${opts.bg}:${opts.fg}:${opts.icon}`;
  return memo(key, () => {
    const [m, mctx] = canvas(8, 8);
    mctx.font = "700 44px Figtree, system-ui, sans-serif";
    const full = opts.icon ? `${opts.icon} ${text}` : text;
    const w = Math.ceil(mctx.measureText(full).width) + 48;
    m.remove();
    const [c, ctx] = canvas(w, 72);
    ctx.fillStyle = opts.bg ?? "rgba(20,18,30,0.78)";
    const r = 30;
    ctx.beginPath();
    ctx.roundRect(2, 2, w - 4, 68, r);
    ctx.fill();
    ctx.font = "700 44px Figtree, system-ui, sans-serif";
    ctx.fillStyle = opts.fg ?? "#fff";
    ctx.textBaseline = "middle";
    ctx.fillText(full, 24, 38);
    return toTexture(c, { repeat: false });
  });
}

// ---------------------------------------------------------------------------
// Fabrics

export function fabric(pattern: "plain" | "kente" | "wax" | "stripe" | "denim", base: string) {
  return memo(`fabric:${pattern}:${base}`, () => {
    const [c, ctx] = canvas(128, 128);
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, 128, 128);
    if (pattern === "kente") {
      const cols = ["#F2B705", "#1F7A4D", "#C8452C", "#111111", base];
      for (let y = 0; y < 128; y += 16)
        for (let x = 0; x < 128; x += 16) {
          const k = ((x + y) / 16) % 5;
          ctx.fillStyle = cols[k];
          if ((x / 16 + y / 16) % 2) ctx.fillRect(x, y, 16, 16);
          else for (let i = 0; i < 16; i += 4) ctx.fillRect(x, y + i, 16, 2);
        }
    } else if (pattern === "wax") {
      const rnd = mulberry32(base.length * 13 + base.charCodeAt(1));
      const accent = ["#F2B705", "#1F7A4D", "#E35D3A", "#2E86AB", "#F7F3E8"][Math.floor(rnd() * 5)];
      for (let i = 0; i < 9; i++) {
        const x = (i % 3) * 44 + 20, y = Math.floor(i / 3) * 44 + 20;
        ctx.fillStyle = accent;
        ctx.beginPath();
        ctx.arc(x, y, 15, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = base;
        ctx.beginPath();
        ctx.arc(x, y, 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#111";
        ctx.beginPath();
        ctx.arc(x, y, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (pattern === "stripe") {
      // Smock cloth: narrow hand-woven strips sewn side by side, each with fine stripes.
      for (let x = 0; x < 128; x += 16) {
        ctx.fillStyle = (x / 16) % 2 ? "rgba(255,255,255,0.5)" : "rgba(0,0,0,0.25)";
        for (let i = 2; i < 16; i += 5) ctx.fillRect(x + i, 0, 2, 128);
        ctx.fillStyle = "rgba(0,0,0,0.35)";
        ctx.fillRect(x, 0, 1, 128);
      }
    } else if (pattern === "denim") {
      // Denim twill: fine diagonal lines.
      ctx.strokeStyle = "rgba(255,255,255,0.12)";
      ctx.lineWidth = 1.2;
      for (let i = -128; i < 128; i += 4) { ctx.beginPath(); ctx.moveTo(i, 128); ctx.lineTo(i + 128, 0); ctx.stroke(); }
    }
    grain(ctx, 128, 128, 0.12, 5);
    return toTexture(c);
  });
}

// ---------------------------------------------------------------------------
// Vehicles

export function trotroLivery(slogan: string, dest: string, body: string, stripe: string) {
  return memo(`trotro:${slogan}:${dest}:${body}`, () => {
    const [c, ctx] = canvas(1024, 256);
    ctx.fillStyle = body;
    ctx.fillRect(0, 0, 1024, 256);
    ctx.fillStyle = stripe;
    ctx.fillRect(0, 150, 1024, 26);
    ctx.fillStyle = "#111";
    ctx.fillRect(0, 182, 1024, 6);
    ctx.font = "900 46px Impact, 'Arial Black', sans-serif";
    ctx.textAlign = "center";
    ctx.fillStyle = "#1a1a1a";
    ctx.fillText(slogan, 512, 228);
    ctx.font = "700 30px system-ui";
    ctx.fillStyle = stripe;
    ctx.fillText(dest, 512, 136);
    stains(ctx, 1024, 256, 10, "rgba(120,90,60,0.25)", 60, slogan.length);
    grain(ctx, 1024, 256, 0.1, 3);
    return toTexture(c, { repeat: false });
  });
}

export function plate(text: string) {
  return memo(`plate:${text}`, () => {
    const [c, ctx] = canvas(256, 64);
    ctx.fillStyle = "#f5f5f0";
    ctx.fillRect(0, 0, 256, 64);
    ctx.fillStyle = "#d4a017";
    ctx.fillRect(0, 0, 24, 64);
    ctx.font = "700 38px monospace";
    ctx.fillStyle = "#111";
    ctx.textBaseline = "middle";
    ctx.fillText(text, 34, 34);
    return toTexture(c, { repeat: false });
  });
}

export function clouds() {
  return memo("clouds", () => {
    const [c, ctx] = canvas(1024, 1024);
    ctx.clearRect(0, 0, 1024, 1024);
    const rnd = mulberry32(111);
    for (let i = 0; i < 70; i++) {
      const x = rnd() * 1024, y = rnd() * 1024;
      for (let k = 0; k < 9; k++) {
        const r = 30 + rnd() * 70;
        const g = ctx.createRadialGradient(x + (rnd() - 0.5) * 120, y + (rnd() - 0.5) * 50, 0, x, y, r);
        g.addColorStop(0, "rgba(255,255,255,0.5)");
        g.addColorStop(1, "rgba(255,255,255,0)");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(x + (rnd() - 0.5) * 120, y + (rnd() - 0.5) * 50, r, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    const t = toTexture(c);
    return t;
  });
}
