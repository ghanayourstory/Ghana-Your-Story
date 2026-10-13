import { SKIN_TONES } from "../world/people.ts";
import { CITIES } from "../../shared/cities.ts";
import { LANGUAGES, MAX_LANGUAGES, MAX_PRIORITIES, PRIORITIES, homeLanguage, type Priority } from "../../shared/identity.ts";
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { buildPerson, animatePerson, type PersonLook, type HairStyle, type Pattern } from "../world/people.ts";
import { shadowBlob } from "../world/vehicles.ts";

const SKINS = SKIN_TONES;
const FACE_SLIDERS: [number, string][] = [[0, "Nose width"], [1, "Nose size"], [7, "Lips"], [2, "Jaw"], [6, "Eyes"], [5, "Cheekbones"], [9, "Head shape"]];
const OUTFITS = ["#1F7A4D", "#C8452C", "#F2B705", "#2E86AB", "#3A2E6E", "#F7F3E8", "#1A1A1A", "#E35D3A", "#0E7C86", "#B03A62"];
const PANTS = ["#2B2B2B", "#1F3A5F", "#E9DCC6", "#4A4036", "#7A2E2E", "#3A4A5A"];
const HAIRS: { id: HairStyle; label: string }[] = [
  { id: "low", label: "Low cut" }, { id: "afro", label: "Afro" }, { id: "braids", label: "Braids" }, { id: "locs", label: "Locs" }, { id: "bun", label: "Bun" }, { id: "wrap", label: "Headwrap" }, { id: "cap", label: "Cap" },
];
const PATTERNS: { id: Pattern; label: string }[] = [{ id: "plain", label: "Plain" }, { id: "kente", label: "Kente" }, { id: "wax", label: "Wax print" }, { id: "stripe", label: "Stripes" }];
const BACKGROUNDS = [
  { id: "graduate", title: "Fresh graduate", text: "GH₵600 cash, GH₵2,500 saved. Strong work skills — offices will notice you sooner.", icon: "🎓" },
  { id: "hustler", title: "Street hustler", text: "GH₵1,500 cash in your pocket. Charming, fit and well known in Kaneshie.", icon: "🔥" },
  { id: "returnee", title: "Returnee", text: "Back from abroad with $450 and some savings. People call you 'burger' at first.", icon: "✈️" },
];

// Hometowns you can travel back to and walk around, grouped by region.
const HOMETOWN_OPTIONS = Object.values(CITIES).filter((c) => c.playable).sort((a, b) => a.region.localeCompare(b.region) || a.name.localeCompare(b.name));

export function CharacterCreate({ onCreate, error, busy }: { onCreate: (d: { name: string; background: string; look: PersonLook; hometown: string; languages: string[]; priorities: Priority[] }) => void; error: string | null; busy: boolean }) {
  const [name, setName] = useState("");
  const [hometown, setHometown] = useState("kumasi");
  const [langs, setLangs] = useState<string[]>([homeLanguage("kumasi")]);
  const [langsTouched, setLangsTouched] = useState(false);
  const [prios, setPrios] = useState<Priority[]>([]);
  const toggle = <T,>(xs: T[], x: T, max: number) => (xs.includes(x) ? xs.filter((y) => y !== x) : xs.length >= max ? [...xs.slice(1), x] : [...xs, x]);
  const [bg, setBg] = useState("graduate");
  const [look, setLook] = useState<PersonLook>({ skin: SKINS[3], shirt: OUTFITS[0], pants: PANTS[0], hair: "#111111", feminine: false, height: 1.75, build: 1, hairStyle: "low", pattern: "kente" });
  const canvas = useRef<HTMLCanvasElement>(null);
  const lookRef = useRef(look);
  lookRef.current = look;
  const [view, setView] = useState<"body" | "face">(() => (location.hash === "#portrait" ? "face" : "body"));
  const viewRef = useRef(view);
  viewRef.current = view;

  useEffect(() => {
    const c = canvas.current!;
    const renderer = new THREE.WebGLRenderer({ canvas: c, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(2, devicePixelRatio));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.shadowMap.enabled = true;
    const scene = new THREE.Scene();
    const cam = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
    cam.position.set(0, 1.3, 5.2);
    cam.lookAt(0, 0.95, 0);
    scene.add(new THREE.HemisphereLight("#fff2e0", "#7a5a48", 2.0));
    const key = new THREE.DirectionalLight("#fff1d6", 2.4);
    key.position.set(1.5, 3, 4);
    key.castShadow = true;
    scene.add(key);
    const rim = new THREE.DirectionalLight("#ffb36b", 1.1);
    rim.position.set(-3, 2, -2);
    scene.add(rim);
    const floor = new THREE.Mesh(new THREE.CircleGeometry(1.2, 40), shadowBlob());
    floor.rotation.x = -Math.PI / 2;
    scene.add(floor);
    let rig = buildPerson(lookRef.current);
    let lastKey = JSON.stringify(lookRef.current);
    scene.add(rig.root);
    const clock = new THREE.Clock();
    let raf = 0;
    const loop = () => {
      raf = requestAnimationFrame(loop);
      const k = JSON.stringify(lookRef.current);
      if (k !== lastKey) {
        lastKey = k;
        const yaw = rig.root.rotation.y;
        scene.remove(rig.root);
        rig = buildPerson(lookRef.current);
        rig.root.rotation.y = yaw;
        scene.add(rig.root);
      }
      const dt = clock.getDelta();
      const face = viewRef.current === "face";
      const ht = lookRef.current.height;
      cam.position.lerp(new THREE.Vector3(0, face ? ht * 0.935 : 1.3, face ? 0.9 : 5.2), Math.min(1, dt * 6));
      cam.lookAt(0, face ? ht * 0.925 : 0.95, 0);
      if (face) rig.root.rotation.y = Math.sin(clock.elapsedTime * 0.6) * 0.6;
      else rig.root.rotation.y += dt * 0.5;
      animatePerson(rig, dt, 0);
      const w = c.clientWidth, h = c.clientHeight;
      if (c.width !== Math.floor(w * renderer.getPixelRatio())) {
        renderer.setSize(w, h, false);
        cam.aspect = w / h;
        cam.updateProjectionMatrix();
      }
      renderer.render(scene, cam);
    };
    loop();
    return () => {
      cancelAnimationFrame(raf);
      renderer.dispose();
    };
  }, []);

  const set = (patch: Partial<PersonLook>) => setLook((l) => ({ ...l, ...patch }));
  const valid = /^[\p{L}\p{M}' .-]{2,24}$/u.test(name.trim());
  const [step, setStep] = useState<0 | 1 | 2>(0);
  const town = HOMETOWN_OPTIONS.find((c) => c.id === hometown);
  const STEPS = [{ k: "One", t: "Who you are" }, { k: "Two", t: "Your look" }, { k: "Three", t: "Your start" }];
  return (
    <div className="create">
      <div className="create-inner">
        <div className="preview">
          <canvas ref={canvas} />
          <div className="brand brand-tag">
            <div className="coin">₵</div>
            <div className="wordmark" style={{ fontSize: 26 }}>Ghana<span>:</span><span style={{ display: "block", fontSize: 19, color: "#fff9ef", letterSpacing: "-0.01em" }}>Your Story</span></div>
          </div>
          <div className="seg" style={{ position: "absolute", right: 18, top: 18, background: "rgba(255,249,239,0.9)" }}>
            <button className={view === "body" ? "on" : ""} onClick={() => setView("body")}>Full body</button>
            <button className={view === "face" ? "on" : ""} onClick={() => setView("face")}>Face</button>
          </div>
          <div className="name-card">
            <div className="who">{name.trim() || "Your name"}</div>
            <div className="where">From {town?.name ?? "Kumasi"} · arriving at Kaneshie Station, Accra · Monday, 7:00 AM</div>
          </div>
        </div>
        <div className="form-panel">
          <div className="form-head">
            <h1>Start a life in Ghana</h1>
            <p>A rented room, a phone and a dream. Work, make friends, build a home, and go back to see the family.</p>
          </div>
          <div className="steps">
            {STEPS.map((x, i) => (
              <button key={x.k} className={`${step === i ? "on" : ""} ${i < step ? "done" : ""}`} onClick={() => (i === 0 || valid) && setStep(i as 0 | 1 | 2)}>
                <small>{i < step ? "✓ Done" : `Step ${x.k}`}</small>{x.t}
              </button>
            ))}
          </div>
          <div className="form-body">
            {step === 0 && (
              <>
                <label className="field">
                  <b>Your name</b>
                  <input className="input" maxLength={24} value={name} placeholder="e.g. Kofi Mensah or Ama Owusu" onChange={(e) => setName(e.target.value)} autoFocus />
                  <span className="hint">Your surname becomes your family's name back home.</span>
                </label>
                <label className="field">
                  <b>Hometown</b>
                  <select className="input" value={hometown} onChange={(e) => { setHometown(e.target.value); if (!langsTouched) setLangs([homeLanguage(e.target.value)]); }}>
                    {HOMETOWN_OPTIONS.map((c) => <option key={c.id} value={c.id}>{c.name} · {c.region}</option>)}
                  </select>
                  <span className="hint">Your parents, a grandmother and siblings live here. Call them, send MoMo, or travel home to visit.</span>
                </label>
                <div className="field">
                  <b>Languages you speak <span className="hint">besides English, up to {MAX_LANGUAGES}</span></b>
                  <div className="chipset">{Object.values(LANGUAGES).map((l) => <button key={l.id} className={langs.includes(l.id) ? "on" : ""} onClick={() => { setLangsTouched(true); setLangs((x) => toggle(x, l.id, MAX_LANGUAGES)); }}>{l.name}</button>)}</div>
                  <span className="hint">People warm to you faster in their own language. Nobody is unfriendly if you don't speak it.</span>
                </div>
                <div className="field">
                  <b>What matters to you <span className="hint">optional, up to {MAX_PRIORITIES}</span></b>
                  <div className="chipset">{Object.values(PRIORITIES).map((p) => <button key={p.id} className={prios.includes(p.id) ? "on" : ""} onClick={() => setPrios((x) => toggle(x, p.id, MAX_PRIORITIES))}>{p.icon} {p.label}</button>)}</div>
                  <span className="hint">{prios.length ? prios.map((p) => PRIORITIES[p].text).join(" ") : "Good moments in what you care about lift your mood more, and your daily goals lean that way. Change it later in Settings."}</span>
                </div>
              </>
            )}
            {step === 1 && (
              <>
                <div className="field">
                  <b>Body</b>
                  <div className="seg"><button className={!look.feminine ? "on" : ""} onClick={() => set({ feminine: false, hairStyle: look.hairStyle === "braids" ? "low" : look.hairStyle })}>Masculine</button><button className={look.feminine ? "on" : ""} onClick={() => set({ feminine: true, hairStyle: look.hairStyle === "low" ? "braids" : look.hairStyle })}>Feminine</button></div>
                  <div className="swatches">{SKINS.map((c) => <button key={c} className={`swatch ${look.skin === c ? "on" : ""}`} style={{ background: c }} onClick={() => set({ skin: c })} aria-label="Skin tone" />)}</div>
                  <div className="slider-row"><span className="muted">Height</span><input type="range" min={1.48} max={2.0} step={0.01} value={look.height} onChange={(e) => set({ height: Number(e.target.value) })} /><span className="num">{look.height.toFixed(2)} m</span></div>
                  <div className="slider-row"><span className="muted">Build</span><input type="range" min={0.8} max={1.4} step={0.01} value={look.build} onChange={(e) => set({ build: Number(e.target.value) })} /><span /></div>
                </div>
                <div className="field">
                  <div className="spread"><b>Face</b><button className="btn sm" onClick={() => { setView("face"); set({ face: Array.from({ length: 13 }, (_, i) => (i === 12 ? 0 : Math.max(-1, Math.min(1, (Math.random() + Math.random() + Math.random() - 1.5) * 0.9)))) }); }}>🎲 New face</button></div>
                  {FACE_SLIDERS.map(([i, label]) => (
                    <div className="slider-row" key={i}><span className="muted">{label}</span><input type="range" min={-1} max={1} step={0.05} value={look.face?.[i] ?? 0} onFocus={() => setView("face")} onChange={(e) => { const f = [...(look.face ?? Array(13).fill(0))]; f[i] = Number(e.target.value); set({ face: f }); }} /><span /></div>
                  ))}
                </div>
                <div className="field">
                  <b>Hair</b>
                  <div className="chipset">{HAIRS.map((h) => <button key={h.id} className={look.hairStyle === h.id ? "on" : ""} onClick={() => set({ hairStyle: h.id })}>{h.label}</button>)}</div>
                </div>
                <div className="field">
                  <b>Outfit</b>
                  <div className="chipset">{PATTERNS.map((p) => <button key={p.id} className={look.pattern === p.id ? "on" : ""} onClick={() => set({ pattern: p.id })}>{p.label}</button>)}</div>
                  <span className="hint">Top</span>
                  <div className="swatches">{OUTFITS.map((c) => <button key={c} className={`swatch ${look.shirt === c ? "on" : ""}`} style={{ background: c }} onClick={() => set({ shirt: c })} aria-label="Top colour" />)}</div>
                  <span className="hint">Trousers or skirt</span>
                  <div className="swatches">{PANTS.map((c) => <button key={c} className={`swatch ${look.pants === c ? "on" : ""}`} style={{ background: c }} onClick={() => set({ pants: c })} aria-label="Trousers colour" />)}</div>
                </div>
              </>
            )}
            {step === 2 && (
              <div className="field">
                <b>How you arrive</b>
                {BACKGROUNDS.map((b) => (
                  <button key={b.id} className={`choice ${bg === b.id ? "on" : ""}`} onClick={() => setBg(b.id)}>
                    <div className="bold">{b.icon} {b.title}</div>
                    <div className="small muted" style={{ marginTop: 3 }}>{b.text}</div>
                  </button>
                ))}
                <span className="hint">Whatever you pick, every path is open: jobs, trade, school, land, family, all sixteen regions.</span>
              </div>
            )}
            {error && <div className="notice err">{error}</div>}
          </div>
          <div className="form-foot">
            {step > 0 && <button className="btn" onClick={() => setStep((step - 1) as 0 | 1 | 2)}>← Back</button>}
            <div className="grow tiny muted">{!valid && step === 0 ? "Type a name (2–24 letters) to continue." : step === 2 ? "You can change languages and priorities later in Settings." : ""}</div>
            {step < 2
              ? <button className="btn primary" style={{ padding: "13px 22px", fontSize: 16 }} disabled={!valid} onClick={() => setStep((step + 1) as 0 | 1 | 2)}>Next →</button>
              : <button className="btn primary" style={{ padding: "13px 22px", fontSize: 16 }} disabled={!valid || busy} onClick={() => onCreate({ name: name.trim(), background: bg, look, hometown, languages: langs, priorities: prios })}>{busy ? "Arriving…" : "Arrive in Accra →"}</button>}
          </div>
        </div>
      </div>
    </div>
  );
}
