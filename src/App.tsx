import { BUILD_VERSION } from "./version.ts";
import { useCallback, useEffect, useRef, useState } from "react";
import { GameProvider, useGame } from "./store.tsx";
import { getToken, pickBackend, setToken, type Backend } from "./net/backend.ts";
import { CharacterCreate } from "./ui/CharacterCreate.tsx";
import { ActionBar, Hud, Joystick, Minimap, Rail, Toasts } from "./ui/hud.tsx";
import { EventModal, HomeSheet, PlaceSheet, TalkSheet, TravelSheet } from "./ui/sheets.tsx";
import { Phone, readMix } from "./ui/phone.tsx";
import { World, type Nearby, type Quality } from "./world/World.ts";
import { loadHumans } from "./world/humans.ts";
import { loadCarModels } from "./world/carmodels.ts";
import type { GameState } from "../server/engine.ts";
import type { PersonLook } from "./world/people.ts";
import type { DistrictId } from "../shared/world.ts";

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
        onCreate={async ({ name, background, look }) => {
          setBusy(true);
          setError(null);
          try {
            const res = await boot.backend.request<{ token?: string; state?: GameState; error?: string }>("POST", "/api/player", { name, background, look, test: boot.backend.mode === "offline" });
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
        <div className="brand"><div className="coin">₵</div><div className="wordmark">Sika<span>City</span></div></div>
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
  | null;

function Game() {
  const { state, act, toast, onFeedback } = useGame();
  const canvas = useRef<HTMLCanvasElement>(null);
  const [world, setWorld] = useState<World | null>(null);
  const [nearby, setNearby] = useState<Nearby | null>(null);
  const [panel, setPanel] = useState<Panel>(null);
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
    }, quality);
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
      case "exit": return world.exitHome();
    }
  }, [nearby, world, state, toast]);

  const open = (what: string) => {
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
      {!panel && <ActionBar nearby={nearby} onUse={use} />}
      {!panel && <Joystick world={world} />}
      <Toasts />
      {panel?.kind === "place" && <PlaceSheet placeId={panel.id} world={world} onClose={() => setPanel(null)} onTalk={(id) => setPanel({ kind: "talk", id })} onTravel={() => setPanel({ kind: "travel", ctx: "stop" })} onPhone={(app) => setPanel({ kind: "phone", app })} />}
      {panel?.kind === "talk" && <TalkSheet npcId={panel.id} world={world} onClose={() => setPanel(null)} />}
      {panel?.kind === "travel" && <TravelSheet context={panel.ctx} initialScope={panel.scope} world={world} onClose={() => setPanel(null)} />}
      {panel?.kind === "phone" && <Phone world={world} initialApp={panel.app} onClose={() => setPanel(null)} onTravel={() => setPanel({ kind: "travel", ctx: "phone" })} quality={quality} setQuality={setQuality} />}
      {panel?.kind === "event" && <EventModal onClose={() => setPanel(null)} />}
      {panel?.kind === "bed" && <HomeSheet world={world} focus={panel.focus} onClose={() => setPanel(null)} />}
      {news && !intro && (
        <div className="modal-wrap" onClick={closeNews}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="pill gold">🆕 Update · {BUILD_VERSION}</div>
            <h2 style={{ margin: "10px 0 4px" }}>Sika City is now all of Ghana 🇬🇭</h2>
            <p className="muted small" style={{ marginTop: 0 }}>16 regions, 20 playable towns, real roads between them.</p>
            <div className="col small">
              <div>🚗 <b>New in v6:</b> real 3D car models (Ghana-style yellow-quartered taxis, saloons, Land Cruisers, sports cars), people in proper loose clothes with natural skin, and the full range of Ghanaian skin tones.</div>
              <div>🚌 <b>Travel</b> by bus, VIP or flight to Kumasi, Tamale, Kintampo, Wa, Bole, Sawla, Cape Coast, Ho and more.</div>
              <div>🧭 <b>Day trips:</b> Kintampo Falls, Bui Dam, Mole, Wli, Paga, Kakum. 🥁 <b>Festivals</b> in their real months.</div>
              <div>🛍️ <b>Shops:</b> Melcom, Accra Mall, phone shops, carpenters. Furnish your room and it shows in 3D.</div>
              <div>🛺 <b>Vehicles:</b> motorbikes, pragya, taxis on work-and-pay, the V8, a supercar. 🎓 <b>Driving school</b> for your licence.</div>
              <div>🌱 <b>Farms</b>, 📸 <b>Vibes</b> social media, new people to meet, and Nima & Jamestown in Accra.</div>
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
            <div className="brand" style={{ marginBottom: 10 }}><div className="coin" style={{ width: 40, height: 40, fontSize: 20 }}>₵</div><div className="wordmark" style={{ fontSize: 28 }}>Sika<span>City</span></div></div>
            <p style={{ marginTop: 0 }}>Akwaaba, <b>{state?.player.name}</b>. You've just stepped off a trotro at Kaneshie with a rented room at Tetteh House and not much else.</p>
            <div className="col small">
              <div>🕹️ <b>Move</b> with WASD / arrow keys (hold Shift to run, <b>Space</b> to jump gutters) or the joystick. Drag to turn the camera, scroll to zoom.</div>
              <div>🟡 Walk into <b>yellow rings</b> to enter places, then press <b>E</b>. Walk up to people to talk.</div>
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
