import { BUILD_VERSION } from "./version.ts";
import { useCallback, useEffect, useRef, useState } from "react";
import { GameProvider, useGame } from "./store.tsx";
import { getToken, pickBackend, setToken, type Backend } from "./net/backend.ts";
import { CharacterCreate } from "./ui/CharacterCreate.tsx";
import { ActionBar, Hud, Joystick, Minimap, Rail, Toasts } from "./ui/hud.tsx";
import { EventModal, HomeSheet, PlaceSheet, TalkSheet, TravelSheet } from "./ui/sheets.tsx";
import { Phone, readMix } from "./ui/phone.tsx";
import { TodaySheet } from "./ui/today.tsx";
import { getCaptions } from "./ui/a11y.ts";
import { FamilyApp } from "./ui/family.tsx";
import { Sheet } from "./ui/common.tsx";
import { World, type Nearby, type Quality } from "./world/World.ts";
import { loadHumans } from "./world/humans.ts";
import { loadCarModels } from "./world/carmodels.ts";
import type { GameState } from "../server/engine.ts";
import type { PersonLook } from "./world/people.ts";
import { DISTRICTS, type DistrictId } from "../shared/world.ts";

type Boot = { phase: "loading" } | { phase: "create"; backend: Backend } | { phase: "play"; backend: Backend; state: GameState };

export default function App() {
  const [boot, setBoot] = useState<Boot>({ phase: "loading" });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const start = useCallback(async () => {
    const [backend] = await Promise.all([pickBackend(), loadHumans(), loadCarModels()]);
    if (getToken()) {
      try {
        const res = await backend.request<{ state: GameState }>("GET", "/api/state");
        if (res.status === 200 && res.json.state) return setBoot({ phase: "play", backend, state: res.json.state });
      } catch {
        /* fall through to create */
      }
      setToken(null);
    }
    setBoot({ phase: "create", backend });
  }, []);

  useEffect(() => {
    void start();
  }, [start]);

  if (boot.phase === "loading") return <Splash />;
  if (boot.phase === "create") {
    return (
      <CharacterCreate
        busy={busy}
        error={error}
        onCreate={async ({ name, background, look, hometown }) => {
          setBusy(true);
          setError(null);
          try {
            const res = await boot.backend.request<{ token?: string; state?: GameState; error?: string }>("POST", "/api/player", { name, background, look, hometown, test: boot.backend.mode === "offline" });
            if (res.json.token && res.json.state) {
              setToken(res.json.token);
              try { localStorage.setItem("sika.intro", "1"); } catch { /* ignore */ }
              setBoot({ phase: "play", backend: boot.backend, state: res.json.state });
            } else setError(res.json.error ?? "Could not create your character");
          } catch {
            setError("Couldn't reach the game. Check your connection and try again.");
          } finally {
            setBusy(false);
          }
        }}
      />
    );
  }
  return (
    <GameProvider backend={boot.backend} initial={boot.state} onLogout={() => { setToken(null); setBoot({ phase: "create", backend: boot.backend }); }}>
      <Game />
    </GameProvider>
  );
}

function Splash() {
  return (
    <div className="splash">
      <div className="col" style={{ alignItems: "center", gap: 14 }}>
        <div className="brand"><div className="coin">₵</div><div className="wordmark">Ghana: <span>Your Story</span></div></div>
        <div className="muted">Accra is waking up…</div>
      </div>
    </div>
  );
}

type Panel =
  | { kind: "place"; id: string }
  | { kind: "talk"; id: string }
  | { kind: "travel"; ctx: "stop" | "taxi" | "phone"; scope?: "city" | "ghana" }
  | { kind: "phone"; app?: string }
  | { kind: "event" }
  | { kind: "bed"; focus?: string }
  | { kind: "today" }
  | { kind: "family" }
  | null;

function Game() {
  const { state, act, toast, onFeedback } = useGame();
  const canvas = useRef<HTMLCanvasElement>(null);
  const [world, setWorld] = useState<World | null>(null);
  const [nearby, setNearby] = useState<Nearby | null>(null);
  const [panel, setPanel] = useState<Panel>(null);
  const [ride, setRide] = useState<{ label: string; icon: string } | null>(null);
  const [police, setPolice] = useState<string | null>(null);
  const [captionsList, setCaptionsList] = useState<{ id: number; text: string }[]>([]);
  const [driving, setDriving] = useState<{ name: string; kmh: number } | null>(null);
  const [doing, setDoing] = useState<{ label: string; icon: string; p: number } | null>(null);
  const [road, setRoad] = useState("");
  const [district, setDistrict] = useState<DistrictId>(state!.player.district);
  const [muted, setMuted] = useState(() => { try { return localStorage.getItem("sika.muted") === "1"; } catch { return false; } });
  const [quality, setQualityState] = useState<Quality>(() => { try { return (localStorage.getItem("sika.quality") as Quality) || (matchMedia("(pointer: coarse)").matches ? "medium" : "high"); } catch { return "high"; } });
  const [news, setNews] = useState(() => { try { return localStorage.getItem("sika.seen") !== BUILD_VERSION; } catch { return true; } });
  const closeNews = () => { setNews(false); try { localStorage.setItem("sika.seen", BUILD_VERSION); } catch { /* ignore */ } };
  const [intro, setIntro] = useState(() => { try { return localStorage.getItem("sika.intro") === "1"; } catch { return false; } });
  const lastEvent = useRef<number | null>(null);
  const posRef = useRef({ x: 0, z: 0 });

  useEffect(() => {
    const w = new World(canvas.current!, {
      onNearby: setNearby,
      onDiscover: (placeId) => void act({ type: "discover", placeId }, { silent: true }),
      onTick: (i) => {
        posRef.current = { x: i.x, z: i.z };
        setRoad((r) => (r === i.road ? r : i.road));
        setDistrict((d) => (d === i.district ? d : i.district));
      },
      onTaxiArrived: () => setPanel({ kind: "travel", ctx: "taxi" }),
      onRide: setRide,
      onSpot: (id) => (id === "exit" ? w.exitHome() : setPanel({ kind: "bed", focus: id })),
      onActivity: setDoing,
      onDrive: setDriving,
      onPolice: setPolice,
      onCaption: (text) => {
        if (!getCaptions()) return;
        const id = Math.random();
        setCaptionsList((l) => [...l.slice(-2), { id, text }]);
        setTimeout(() => setCaptionsList((l) => l.filter((c) => c.id !== id)), 3500);
      },
      onDriveEdge: () => {
        toast({ text: "🗺️ End of the road here. Pick where to drive.", changes: [], tone: "info" });
        setPanel({ kind: "travel", ctx: "phone" });
      },
    }, quality);
    (window as unknown as { __world?: World }).__world = w; // handy for automated play-tests
    w.audio.muted = muted;
    w.audio.settings = readMix();
    const onMix = (e: Event) => w.audio.setMix((e as CustomEvent).detail);
    window.addEventListener("sika-mix", onMix);
    setWorld(w);
    return () => {
      window.removeEventListener("sika-mix", onMix);
      w.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (world && state) world.setState(state);
  }, [world, state]);

  // Test funds: GH₵500M for the tester's character, once (offline/test builds only, through the audited grant).
  useEffect(() => {
    if (!state?.devTools) return;
    const key = `sika.grant500m.${state.player.id}`;
    try { if (localStorage.getItem(key)) return; localStorage.setItem(key, "1"); } catch { return; }
    void act({ type: "dev_grant", amount: 500_000_000 * 100 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state?.devTools, state?.player.id]);

  useEffect(() => {
    world?.audio.setMuted(muted);
    try { localStorage.setItem("sika.muted", muted ? "1" : "0"); } catch { /* ignore */ }
  }, [muted, world]);

  const setQuality = (q: Quality) => {
    setQualityState(q);
    world?.setQuality(q);
    try { localStorage.setItem("sika.quality", q); } catch { /* ignore */ }
  };

  // Sound and camera feedback for results.
  useEffect(() => {
    onFeedback.current = (items) => {
      if (!world) return;
      if (items.some((i) => i.tone === "goal")) world.audio.ui("goal");
      else if (items.some((i) => i.changes.some((c) => (c.k === "cash" || c.k === "bank") && c.d > 0))) world.audio.ui("coin");
      else if (items.some((i) => i.tone === "bad")) world.audio.ui("bad");
    };
  }, [world, onFeedback]);

  // Report position so a reload puts you back where you were.
  useEffect(() => {
    const t = setInterval(() => void act({ type: "sync", x: posRef.current.x, z: posRef.current.z }, { silent: true }), 12_000);
    return () => clearInterval(t);
  }, [act]);

  // Each new game day starts with the morning card (once a day, not over other panels).
  const day = state?.player.daily.day;
  useEffect(() => {
    if (day === undefined || !state || news || intro) return;
    const k = `sika.brief.${state.player.id}`;
    let seen = "";
    try { seen = localStorage.getItem(k) ?? ""; } catch { /* private mode */ }
    if (seen === String(day)) return;
    try { localStorage.setItem(k, String(day)); } catch { /* ignore */ }
    setPanel((p) => p ?? { kind: "today" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [day, news, intro]);

  // Pop up new life events once.
  useEffect(() => {
    if (state?.event && state.event.id !== lastEvent.current) {
      lastEvent.current = state.event.id;
      setPanel((p) => p ?? { kind: "event" });
    }
  }, [state?.event]);

  // Freeze walking while a panel is open.
  useEffect(() => {
    if (world) world.frozen = !!panel && panel.kind !== "travel";
  }, [panel, world]);

  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === "INPUT") return;
      if (e.key === "Escape") setPanel(null);
      if (e.key === "p" || e.key === "P") setPanel((p) => (p?.kind === "phone" ? null : { kind: "phone" }));
      if (e.key === "m" || e.key === "M") setPanel({ kind: "travel", ctx: "phone" });
      if (e.key === "h" || e.key === "H") homeKey.current();
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, []);

  const use = useCallback(() => {
    if (!nearby || !world || !state) return;
    world.audio.ui("tap");
    switch (nearby.kind) {
      case "npc": return setPanel({ kind: "talk", id: nearby.id });
      case "place": return setPanel({ kind: "place", id: nearby.id });
      case "stop": return setPanel({ kind: "travel", ctx: "stop" });
      case "home": return world.enterHome(state.player.home.spec, state.items.map((i) => i.itemId));
      case "homespot": return setPanel({ kind: "bed", focus: nearby.id });
      case "plot": return setPanel({ kind: "phone", app: "property" });
      case "taxi":
        if (world.hailTaxi()) toast({ text: "✋ You wave down a taxi. It's pulling over…", changes: [], tone: "info" });
        return;
      case "bed": return setPanel({ kind: "bed" });
      case "car": return void world.enterCar(nearby.id);
      case "family": return setPanel({ kind: "family" });
      case "car_exit": return world.exitCar();
      case "exit": return world.exitHome();
    }
  }, [nearby, world, state, toast]);

  // Go home from anywhere: straight in if it's this district, otherwise ride
  // there across town (or pick a bus/flight if it's in another city), then go in.
  const goHome = useCallback(async () => {
    if (!world || !state) return;
    const h = state.player.home;
    const items = state.items.map((i) => i.itemId);
    if (world.inside) return toast({ text: "🏠 You're already home.", changes: [], tone: "info" });
    if (world.goHome(h.spec, items)) return;
    const here = DISTRICTS[state.player.district], there = DISTRICTS[h.district as DistrictId];
    if (!there) return;
    if (here.city !== there.city) {
      toast({ text: `🏠 Home is in ${there.name}, ${there.city}. Pick a bus or flight to get back.`, changes: [], tone: "info" });
      return setPanel({ kind: "travel", ctx: "phone", scope: "ghana" });
    }
    const hour = state.time.hour;
    const modes = hour >= 5 && hour < 23 ? ["trotro", "taxi", "walk"] : ["taxi", "walk"];
    // Ask for the first way home that works, then ride it.
    let chosen = "";
    const ok = await world.rideTo(modes[0], `Going home to ${there.name}`, async () => {
      for (const [i, mode] of modes.entries()) {
        const r = await act({ type: "travel", to: h.district, mode }, { silent: i < modes.length - 1 });
        if (r.ok) { chosen = mode; return r; }
      }
      return { ok: false };
    });
    if (ok && chosen) world.goHome(h.spec, items);
  }, [world, state, act, toast]);

  const homeKey = useRef(goHome);
  homeKey.current = goHome;

  const open = (what: string) => {
    if (what === "home") return void goHome();
    if (what === "today") return setPanel({ kind: "today" });
    if (what === "map") return setPanel({ kind: "travel", ctx: "phone" });
    if (what === "event") return setPanel({ kind: "event" });
    if (what === "phone") return setPanel({ kind: "phone" });
    return setPanel({ kind: "phone", app: what });
  };

  const pendingDates = (state?.dates as { status: string }[] | undefined)?.filter((d) => d.status === "pending").length ?? 0;

  return (
    <>
      <canvas ref={canvas} className="world" tabIndex={0} />
      <Hud world={world} onOpen={open} />
      <Minimap world={world} road={road} district={district} />
      <Rail onOpen={open} badges={{ phone: (state?.event ? 1 : 0) + (state?.businesses.filter((b) => b.till > 0).length ? 1 : 0), people: pendingDates }} world={world} muted={muted} setMuted={setMuted} />
      {!panel && !ride && !doing && <ActionBar nearby={nearby} onUse={use} />}
      {!panel && !ride && <Joystick world={world} />}
      {doing && (
        <div className="ride-banner doing">
          <span className="ride-icon">{doing.icon}</span>
          <div className="grow">
            <b>{doing.label}</b>
            <div className="bar"><i style={{ width: `${Math.round(doing.p * 100)}%` }} /></div>
          </div>
          <button className="btn small" onClick={() => world?.stopActivity()}>Stop</button>
        </div>
      )}
      {captionsList.length > 0 && <div className="captions" aria-live="polite">{captionsList.map((c) => <div key={c.id}>{c.text}</div>)}</div>}
      {police && (
        <div className="modal-wrap">
          <div className="modal">
            <div className="pill">👮 Police checkpoint</div>
            <h2 style={{ margin: "10px 0 4px" }}>"Good day. Licence, please."</h2>
            <p className="muted small" style={{ marginTop: 0 }}>An officer waves you to the side of the road. If your licence is in order you'll be on your way; driving without one means a fine (game money) and a little lost standing.</p>
            <button className="btn primary block" onClick={async () => { await act({ type: "police_check", vehicleType: police }); setPolice(null); world?.releasePolice(); }}>Hand over your papers</button>
          </div>
        </div>
      )}
      {driving && !ride && (
        <div className="speedo">
          <b className="num">{driving.kmh}</b><small>km/h</small>
          <div className="tiny muted">{driving.name} · W/S drive, A/D steer, Shift to speed up</div>
        </div>
      )}
      {ride && (
        <div className="ride-banner">
          <span className="ride-icon">{ride.icon}</span>
          <div className="grow"><b>{ride.label}</b><div className="tiny muted">Sit back and watch the road.</div></div>
          <button className="btn small" onClick={() => world?.skipRide()}>Skip ⏩</button>
        </div>
      )}
      <Toasts />
      {panel?.kind === "place" && <PlaceSheet placeId={panel.id} world={world} onClose={() => setPanel(null)} onTalk={(id) => setPanel({ kind: "talk", id })} onTravel={() => setPanel({ kind: "travel", ctx: "stop" })} onPhone={(app) => setPanel({ kind: "phone", app })} />}
      {panel?.kind === "talk" && <TalkSheet npcId={panel.id} world={world} onClose={() => setPanel(null)} />}
      {panel?.kind === "travel" && <TravelSheet context={panel.ctx} initialScope={panel.scope} world={world} onClose={() => setPanel(null)} />}
      {panel?.kind === "phone" && <Phone world={world} initialApp={panel.app} onClose={() => setPanel(null)} onTravel={() => setPanel({ kind: "travel", ctx: "phone" })} quality={quality} setQuality={setQuality} />}
      {panel?.kind === "event" && <EventModal onClose={() => setPanel(null)} />}
      {panel?.kind === "today" && <TodaySheet onClose={() => setPanel(null)} />}
      {panel?.kind === "family" && <Sheet title="🏡 Home" sub="Your family is happy to see you. Sit with them, catch up, or help with something." onClose={() => setPanel(null)}><div style={{ marginTop: 10 }}><FamilyApp onTravel={() => setPanel({ kind: "travel", ctx: "phone", scope: "ghana" })} /></div></Sheet>}
      {panel?.kind === "bed" && <HomeSheet world={world} focus={panel.focus} onClose={() => setPanel(null)} />}
      {news && !intro && (
        <div className="modal-wrap" onClick={closeNews}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="pill gold">🆕 Update · {BUILD_VERSION}</div>
            <h2 style={{ margin: "10px 0 4px" }}>Live it, don't just click it 🏠🚗</h2>
            <p className="muted small" style={{ marginTop: 0 }}>Your home is now a place you live in, and rides actually drive you there.</p>
            <div className="col small">
              <div>🏠 <b>Dollhouse view at home:</b> walls drop so you can see in. Tap anywhere to walk, tap the bed, TV, shower, coal pot or kitchen to use it, and watch your character lie down, sit, cook or bath.</div>
              <div>🚕 <b>Real rides:</b> the taxi, ride or trotro pulls up, you get in and ride down the road to where you're going (Skip if you're in a hurry).</div>
              <div>😊 <b>Six needs and mood:</b> hunger, energy, bladder, hygiene, fun and social. Tap the face to see why you feel the way you do. A good mood helps at work.</div>
              <div>✅ <b>Know before you commit:</b> buying land, vehicles, businesses, furniture, renting, loans, T-bills, jobs and sales now show the time, the cost, what changes and whether you can undo it before you confirm.</div>
              <div>🏡 <b>Go home to see them:</b> in your hometown your family waits outside the family house: walk up to greet them. 👮 <b>On the road:</b> traffic gives your car room, you stop for people, and police checkpoints check your licence. 💬 Sound captions in Settings.</div>
              <div>👪 <b>Family:</b> pick a hometown when you create a character. Your parents, grandmother and siblings live there with their own lives: call them, send MoMo when they ask for help (only if you can), or travel home to visit. Phone → Family.</div>
              <div>🧺 <b>Market hustle:</b> buy sachet water, oranges, bread, tomatoes or second-hand clothes at a market, carry them and sell at lorry stations and markets. Rush hours pay more, buyers run out, fruit goes off.</div>
              <div>📱 <b>MoMo wallet:</b> separate from cash and bank. Cash-in is free, cash-out costs a small agent fee. Plus bigger text and reduced motion in Settings.</div>
              <div>☀️ <b>Your day:</b> each game day opens with a morning card: weather, your shift, money, how you feel, and <b>Today's hustle</b>, three small goals that fit your life (swap one, skip any). Tap 🎯 Today any time. Needs can be slowed or paused in Phone → Settings.</div>
              <div>🚗 <b>Drive your own car:</b> walk up to it and press Drive. W/S or the stick to drive, A/D to steer, Shift to speed up. Park anywhere. Drive to the end of the road to pick where to go next.</div>
              <div>🏡 <b>Homes feel lived in:</b> tube lights, wall clocks, radios, fufu mortars, basins, chickens in the compound; pendant lamps, art and a piano in bigger homes. Softer shadows on High quality.</div>
              <div>🚻 Pay toilets at lorry stations, markets and malls. The green 🏠 button takes you home from anywhere.</div>
            </div>
            <div className="row" style={{ marginTop: 14, flexWrap: "wrap", gap: 8 }}>
              <button className="btn primary" style={{ flex: "1 1 45%" }} onClick={() => { closeNews(); setPanel({ kind: "travel", ctx: "phone", scope: "ghana" }); }}>🗺️ Ghana map</button>
              <button className="btn" style={{ flex: "1 1 45%" }} onClick={() => { closeNews(); setPanel({ kind: "phone", app: "ghana" }); }}>🇬🇭 Regions</button>
              <button className="btn" style={{ flex: "1 1 45%" }} onClick={() => { closeNews(); setPanel({ kind: "phone", app: "vibes" }); }}>📸 Vibes</button>
              <button className="btn ghost" style={{ flex: "1 1 45%" }} onClick={closeNews}>Later</button>
            </div>
          </div>
        </div>
      )}
      {intro && (
        <div className="modal-wrap" onClick={() => { setIntro(false); try { localStorage.removeItem("sika.intro"); } catch { /* ignore */ } }}>
          <div className="modal">
            <div className="brand" style={{ marginBottom: 10 }}><div className="coin" style={{ width: 40, height: 40, fontSize: 20 }}>₵</div><div className="wordmark" style={{ fontSize: 26 }}>Ghana: <span>Your Story</span></div></div>
            <p style={{ marginTop: 0 }}>Akwaaba, <b>{state?.player.name}</b>. You've just stepped off a trotro at Kaneshie with a rented room at Tetteh House and not much else.</p>
            <div className="col small">
              <div>🕹️ <b>Move</b> with WASD / arrow keys (hold Shift to run, <b>Space</b> to jump gutters) or the joystick. Drag to turn the camera, scroll to zoom.</div>
              <div>🟡 Walk into <b>yellow rings</b> to enter places, then press <b>E</b>. Walk up to people to talk.</div>
              <div>🏠 The green <b>Home</b> button (or <b>H</b>) takes you home from anywhere: sleep, bath, cook, watch TV.</div>
              <div>💼 First money: <b>Kaneshie Market</b> or the <b>trotro station</b> hire anyone. Eat, sleep, repeat — then build.</div>
              <div>📱 Your <b>phone</b> (P) has your bank, jobs, businesses, property, people, farms, Vibes and football.</div>
              <div>🇬🇭 Lorry stations and the phone's <b>Map</b> take you <b>Across Ghana</b>: Kumasi, Tamale, Kintampo, Wa, Cape Coast…</div>
              <div>⏱️ A game day lasts 24 real minutes. The server keeps your money and your progress.</div>
            </div>
            <button className="btn primary block" style={{ marginTop: 14 }}>Let's go</button>
          </div>
        </div>
      )}
    </>
  );
}

export type { PersonLook };
