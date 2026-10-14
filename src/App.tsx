import { useCallback, useEffect, useRef, useState } from "react";
import { GameProvider, useGame } from "./store.tsx";
import { getToken, getTokenBackend, httpBackend, offlineBackend, pickBackend, setToken, type Backend } from "./net/backend.ts";
import { CharacterCreate } from "./ui/CharacterCreate.tsx";
import { MapSheet } from "./ui/map.tsx";
import { ArrangePanel } from "./ui/furnish.tsx";
import { ActionBar, Joystick, Toasts } from "./ui/hud.tsx";
import { GameFrame } from "./ui/GameFrame.tsx";
import { EventModal, HomeSheet, PlaceSheet, TalkSheet, TravelSheet } from "./ui/sheets.tsx";
import { Phone, readMix } from "./ui/phone.tsx";
import { TodaySheet } from "./ui/today.tsx";
import { getCaptions } from "./ui/a11y.ts";
import { FamilyApp } from "./ui/family.tsx";
import { Sheet } from "./ui/common.tsx";
import { World, type ExamStatus, type GigStatus, type NavStatus, type Nearby, type Quality } from "./world/World.ts";
import { DriveHud } from "./ui/drivehud.tsx";
import { loadHumans } from "./world/humans.ts";
import { loadCarModels } from "./world/carmodels.ts";
import type { GameState } from "../server/engine.ts";
import type { PersonLook } from "./world/people.ts";
import { DISTRICTS, type DistrictId } from "../shared/world.ts";

type Boot = { phase: "loading" } | { phase: "create"; backend: Backend } | { phase: "play"; backend: Backend; state: GameState } | { phase: "recover"; message: string };

export default function App() {
  const [boot, setBoot] = useState<Boot>({ phase: "loading" });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const start = useCallback(async () => {
    const [backend] = await Promise.all([pickBackend(), loadHumans(), loadCarModels()]);
    const token = getToken();
    if (token) {
      const knownBackend = getTokenBackend();
      const candidates = knownBackend
        ? [backend]
        : [backend, backend.mode === "server" ? offlineBackend() : httpBackend()];
      for (const candidate of candidates) {
        try {
          const res = await candidate.request<{ state: GameState }>("GET", "/api/state");
          if (res.status === 200 && res.json.state) {
            if (!knownBackend) setToken(token, candidate.mode);
            return setBoot({ phase: "play", backend: candidate, state: res.json.state });
          }
          // Older saves predate the backend marker. Check the other store once
          // before deciding that their token can't be used.
          if (res.status === 401 && !knownBackend && candidate !== candidates.at(-1)) continue;
          setBoot({
            phase: "recover",
            message: res.status === 401
              ? "Neither save store recognized this sign-in. It is still on this device; check that you're opening the matching game copy or restore the matching save before starting a new character."
              : "The save service could not load your character. Your sign-in is still on this device; try again when the service is available.",
          });
          return;
        } catch {
          if (!knownBackend && candidate !== candidates.at(-1)) continue;
          return setBoot({
            phase: "recover",
            message: "Couldn't reach the service that owns this save. Your sign-in is still on this device. Check your connection and try again; no new character has been created.",
          });
        }
      }
      return setBoot({ phase: "recover", message: "Couldn't find this saved story. Your sign-in remains on this device; restore the backup that belongs to this game copy." });
    }
    setBoot({ phase: "create", backend });
  }, []);

  useEffect(() => {
    void start();
  }, [start]);

  if (boot.phase === "loading") return <Splash />;
  if (boot.phase === "recover") {
    return (
      <div className="splash">
        <section className="save-recovery" role="alert">
          <div className="brand"><div className="coin">₵</div><div className="wordmark">Ghana: <span>Your Story</span></div></div>
          <div className="kente-strip" />
          <div>
            <h1>We couldn't load your saved story</h1>
            <p>{boot.message}</p>
            <p className="save-recovery-note">No new character has been created, and the saved sign-in remains on this device.</p>
          </div>
          <button className="btn primary block" onClick={() => void start()}>Try again</button>
        </section>
      </div>
    );
  }
  if (boot.phase === "create") {
    return (
      <CharacterCreate
        busy={busy}
        error={error}
        onCreate={async ({ name, background, look, hometown, languages, priorities }) => {
          setBusy(true);
          setError(null);
          try {
            const res = await boot.backend.request<{ token?: string; state?: GameState; error?: string }>("POST", "/api/player", { name, background, look, hometown, languages, priorities, test: boot.backend.mode === "offline" });
            if (res.json.token && res.json.state) {
              setToken(res.json.token, boot.backend.mode);
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
  | { kind: "map" }
  | { kind: "arrange" }
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
  const [exam, setExam] = useState<ExamStatus | null>(null);
  const [gig, setGig] = useState<GigStatus | null>(null);
  const [captionsList, setCaptionsList] = useState<{ id: number; text: string }[]>([]);
  const [driving, setDriving] = useState<{ name: string; kmh: number } | null>(null);
  const [nav, setNav] = useState<NavStatus | null>(null);
  useEffect(() => {
    document.body.classList.toggle("is-driving", !!driving);
  }, [driving]);
  const [doing, setDoing] = useState<{ label: string; icon: string; p: number } | null>(null);
  const [road, setRoad] = useState("");
  const [district, setDistrict] = useState<DistrictId>(state!.player.district);
  const [muted, setMuted] = useState(() => { try { return localStorage.getItem("sika.muted") === "1"; } catch { return false; } });
  const [quality, setQualityState] = useState<Quality>(() => { try { return (localStorage.getItem("sika.quality") as Quality) || (matchMedia("(pointer: coarse)").matches ? "medium" : "high"); } catch { return "high"; } });
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
      onNav: setNav,
      onPolice: setPolice,
      onExam: setExam,
      onGig: setGig,
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
    if (day === undefined || !state || intro) return;
    const k = `sika.brief.${state.player.id}`;
    let seen = "";
    try { seen = localStorage.getItem(k) ?? ""; } catch { /* private mode */ }
    if (seen === String(day)) return;
    try { localStorage.setItem(k, String(day)); } catch { /* ignore */ }
    setPanel((p) => p ?? { kind: "today" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [day, intro]);

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
      if (e.key === "m" || e.key === "M") setPanel({ kind: "map" });
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
    if (world.inside) return setPanel({ kind: "bed" }); // already home: open the home menu
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
    if (what === "map") return setPanel({ kind: "map" });
    if (what === "event") return setPanel({ kind: "event" });
    if (what === "phone") return setPanel({ kind: "phone" });
    return setPanel({ kind: "phone", app: what });
  };

  return (
    <>
      <canvas ref={canvas} className="world" tabIndex={0} />
      <GameFrame world={world} district={district} road={road} onOpen={open} muted={muted} setMuted={setMuted} />
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
      {gig && (
        <div className="ride-banner exam">
          <span className="ride-icon">{gig.kind === "ride" ? "🚗" : "🛵"}</span>
          <div className="grow">
            <b>Trip {gig.trip}/{gig.of} · {gig.phase === "pickup" ? (gig.kind === "ride" ? `Pick up ${gig.who}` : `Collect ${gig.who}'s order`) : (gig.kind === "ride" ? `Drop ${gig.who} off` : `Deliver to ${gig.who}`)}</b>
            <div className="tiny muted">{gig.dist} m · follow the {gig.phase === "pickup" ? "green" : "yellow"} beacon (yellow dot on the map) and stop beside it</div>
          </div>
          <button className="btn small ghost" onClick={() => world?.abandonGig()}>End shift</button>
        </div>
      )}
      {exam && (
        <div className="ride-banner exam">
          <span className="ride-icon">📋</span>
          <div className="grow">
            <b>Road test · {exam.faults} fault{exam.faults === 1 ? "" : "s"} (pass ≤ 3)</b>
            <div className="tiny muted">{exam.next}{exam.last ? ` · last: ${exam.last}` : ""}</div>
          </div>
          <button className="btn small ghost" onClick={() => world?.abandonRoadTest()}>Abandon</button>
        </div>
      )}
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
      {driving && !ride && !panel && <DriveHud world={world} driving={driving} nav={nav} onWhere={() => setPanel({ kind: "map" })} />}
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
      {panel?.kind === "arrange" && <ArrangePanel world={world} onClose={() => setPanel(null)} />}
      {panel?.kind === "map" && <MapSheet world={world} onClose={() => setPanel(null)} onTravel={(scope) => setPanel({ kind: "travel", ctx: "phone", scope })} />}
      {panel?.kind === "travel" && <TravelSheet context={panel.ctx} initialScope={panel.scope} world={world} onClose={() => setPanel(null)} />}
      {panel?.kind === "phone" && <Phone world={world} initialApp={panel.app} onClose={() => setPanel(null)} onTravel={() => setPanel({ kind: "travel", ctx: "phone" })} quality={quality} setQuality={setQuality} />}
      {panel?.kind === "event" && <EventModal onClose={() => setPanel(null)} />}
      {panel?.kind === "today" && <TodaySheet onClose={() => setPanel(null)} />}
      {panel?.kind === "family" && <Sheet title="🏡 Home" sub="Your family is happy to see you. Sit with them, catch up, or help with something." onClose={() => setPanel(null)}><div style={{ marginTop: 10 }}><FamilyApp onTravel={() => setPanel({ kind: "travel", ctx: "phone", scope: "ghana" })} /></div></Sheet>}
      {panel?.kind === "bed" && <HomeSheet world={world} focus={panel.focus} onClose={() => setPanel(null)} onArrange={() => setPanel({ kind: "arrange" })} />}
      {intro && (
        <div className="modal-wrap" onClick={() => { setIntro(false); try { localStorage.removeItem("sika.intro"); } catch { /* ignore */ } }}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="brand" style={{ marginBottom: 10 }}><div className="coin" style={{ width: 40, height: 40, fontSize: 20 }}>₵</div><div className="wordmark" style={{ fontSize: 26 }}>Ghana: <span>Your Story</span></div></div>
            <p style={{ marginTop: 0 }}>Akwaaba, <b>{state?.player.name}</b>. Your story begins in Kaneshie. Find your feet, meet the people around you, and decide what you want to build.</p>
            <div className="col small">
              <div>🕹️ <b>Move:</b> WASD or arrow keys. Hold Shift to run. Drag to look around; scroll to zoom.</div>
              <div>🟡 <b>Explore:</b> approach a marked place or person, then press E to interact.</div>
              <div>📖 <b>Choose your day:</b> use Today for goals and the navigation buttons for work, home, people, money, and travel.</div>
              <div>🇬🇭 <b>Make Ghana yours:</b> begin here, then travel between regions as your life grows.</div>
            </div>
            <button className="btn primary block" style={{ marginTop: 14 }} onClick={() => { setIntro(false); try { localStorage.removeItem("sika.intro"); } catch { /* ignore */ } }}>Let's go</button>
          </div>
        </div>
      )}
    </>
  );
}

export type { PersonLook };
