import { BUILD_VERSION } from "./version.ts";
import { useCallback, useEffect, useRef, useState } from "react";
import { GameProvider, useGame } from "./store.tsx";
import { getToken, pickBackend, setToken, type Backend } from "./net/backend.ts";
import { CharacterCreate } from "./ui/CharacterCreate.tsx";
import { MapSheet } from "./ui/map.tsx";
import { ArrangePanel } from "./ui/furnish.tsx";
import { ActionBar, Hud, Joystick, Minimap, Rail, Toasts } from "./ui/hud.tsx";
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
        onCreate={async ({ name, background, look, hometown, languages, priorities }) => {
          setBusy(true);
          setError(null);
          try {
            const res = await boot.backend.request<{ token?: string; state?: GameState; error?: string }>("POST", "/api/player", { name, background, look, hometown, languages, priorities, test: boot.backend.mode === "offline" });
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

  const pendingDates = (state?.dates as { status: string }[] | undefined)?.filter((d) => d.status === "pending").length ?? 0;

  return (
    <>
      <canvas ref={canvas} className="world" tabIndex={0} />
      <Hud world={world} onOpen={open} />
      <Minimap world={world} road={road} district={district} onOpen={() => setPanel({ kind: "map" })} />
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
      {news && !intro && (
        <div className="modal-wrap" onClick={closeNews}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="pill gold">🆕 Update · {BUILD_VERSION}</div>
            <h2 style={{ margin: "10px 0 4px" }}>Live it, don't just click it 🏠🚗</h2>
            <p className="muted small" style={{ marginTop: 0 }}>Your home is now a place you live in, and rides actually drive you there.</p>
            <div className="col small">
              <div>🚘 <b>Better-looking cars and streets:</b> rounded modern bodies with proper grilles, headlamps, fog lamps, taillights and Ghana number plates front and back; a real Hiace-style trotro; black-and-white kerbs; window sills, ledges and AC units on the buildings; green-and-gold place labels.</div>
              <div>🌳 <b>Shrines:</b> traditional shrines (La Kpa, Sakumo, Ho-Bankoe) are now walled yards with a great tree wrapped in white cloth, a small whitewashed shrine house, clay pots and white flags, seen from outside with a "please ask before entering" sign. The Okomfo Anokye Sword Site in Kumasi shows the hilt in its stone setting under a canopy, behind a rail.</div>
              <div>⛪ <b>Churches and palaces:</b> every church is now a real church (gabled nave, bell tower with a cross, tall arched windows, steps up to the doors). Bonwire's chief's palace has ochre-and-white walls with relief panels, an audience pavilion and the chief's great umbrella. Elmina has St George's Castle on its street.</div>
              <div>🗺️ <b>Landmarks around Ghana:</b> the red-and-white Jamestown Lighthouse and James Fort, Takoradi's round Market Circle, Koforidua's Jackson Park with its bandstand, the Sunyani cenotaph, and the Nima astro pitch. In seaside towns, buildings no longer sit on top of the lorry station.</div>
              <div>🏙️ <b>Kumasi looks like Kumasi:</b> the modern Kejetia Market with its terracotta bands and sunshade fins, Manhyia Palace behind its railings and gold-topped gate, more shade trees (the Garden City), and a real lorry park at Kejetia with sheds, a station master's booth and trotros waiting to fill. Big lorry stations in other towns get yards too where there's room.</div>
              <div>🧑🏾 <b>People:</b> fuller afros with curly texture that sit behind the hairline, caps that fit with a proper brim, no more gaps or white flaps in clothes (the inside of a garment is in shadow), and a crowd whose skin tones fit an Accra street.</div>
              <div>🧭 <b>Directions when you drive:</b> tap "Where to?" (or the map) and pick a place. Turn-by-turn directions, <b>Auto</b> to let the car drive itself in the right-hand lane (it waits behind traffic and people), <b>Skip</b> to arrive. Big <b>GAS</b> and <b>BRAKE</b> pedals for touch screens.</div>
              <div>🏠 <b>Dollhouse view at home:</b> walls drop so you can see in. Tap anywhere to walk, tap the bed, TV, shower, coal pot or kitchen to use it, and watch your character lie down, sit, cook or bath.</div>
              <div>🚕 <b>Real rides:</b> the taxi, ride or trotro pulls up, you get in and ride down the road to where you're going (Skip if you're in a hurry).</div>
              <div>😊 <b>Six needs and mood:</b> hunger, energy, bladder, hygiene, fun and social. Tap the face to see why you feel the way you do. A good mood helps at work.</div>
              <div>👔 <b>What you wear:</b> real outfits now, each with its own cut: T-shirt & jeans, shirt & trousers, suit & tie (lapels, white shirt, tie), kaba & slit, dress, smock (batakari), kente cloth, jersey & shorts. Shoes are modelled on the feet: sneakers, leather shoes, sandals (charlie wote), heels, boots, or barefoot. Pick at the start, change at home (Home → Get dressed). People in town dress for their work and the day: suits and kente at weddings, black and red at funerals, smocks in the north.</div>
              <div>🏘️ <b>Villages:</b> Bonwire (kente looms, near Kumasi), Nyankpala (farms, near Tamale), Elmina (canoes and the castle, near Cape Coast), Paga (crocodiles and the border, near Bolga) and Wli (the falls, near Ho). Take a trotro out from the town; each has its own work (weaving apprentice, farmhand, fishing crew, guides) and cheap rooms.</div>
              <div>🟤 <b>Oware:</b> play at chop bars, markets and lorry stations, against a regular or a named character who's there. The game checks every move and plays your opponent fairly; they get better as you win.</div>
              <div>🎉 <b>Parties and clean-up:</b> host a party at home for people you know (Family → Your household). The first Saturday of each month is communal clean-up, 7 to 10 (Today card).</div>
              <div>📊 <b>Your life so far:</b> a life score that isn't just money (wealth, work, friends, family, standing, wellbeing, learning, Ghana seen) and your milestones, in Phone → Dream. ⬇️ <b>Backups:</b> Settings → Save can download your whole save and restore it, here or on another device.</div>
              <div>🛣️ <b>Trade roads:</b> regional produce is bought where it's made and worth more the further you carry it: yam from Kintampo and Techiman, shea butter from the north, smoked fish from Cape Coast and Takoradi, kente from Kumasi and Ho, baskets from Bolga, beads from Koforidua. Near double in Accra; buses charge luggage per unit, and fish goes off on the road.</div>
              <div>🧭 <b>Around Ghana stories:</b> six regional arcs in Phone → Story (Kumasi, Tamale, Cape Coast, Volta, Kintampo, the Upper regions): the people, the food, the places, and the produce. 📞 Call friends in other towns from People. 💼 Jobs are local now: a week without a shift and the job goes to someone else (with a warning).</div>
              <div>👶 <b>Children (optional):</b> married couples can try for a baby; anyone with a home with room can adopt through Social Welfare. Name a baby at the outdooring from the eighth day (day names suggested where that's the custom). Children grow a year each game month, go to public (free) or private school from 4, and grow closer when you play or help with homework. Costs come monthly; a spouse pays half. Phone → Family.</div>
              <div>🏠 <b>Your household at home:</b> your spouse sits by the TV (or on the compound bench) and the children play nearby when they're not at school; in the evenings they wait by your door.</div>
              <div>🦘 <b>Gutters:</b> walk into an open drain and you hop across it, the way everyone does. Space (or the ⤒ button on phones) jumps any time, and a jump while walking now carries you all the way over. People crossing the road hop them too.</div>
              <div>💍 <b>Marriage:</b> once you're a couple and very close, propose in person. Your family then goes to knock at your partner's family house in their hometown (Kumasi, Ho, Tamale, Cape Coast…), and a few days later the families meet for the customary marriage, or the nikah. A church wedding or walima feast is optional. Your spouse moves in, pays half the rent and bills, and waits at home in the evenings. People → your partner.</div>
              <div>📖 <b>Story:</b> eight longer arcs in Phone → Story (New in the city, Home ties, Wheels, From hustle to business, Roots, Across Ghana, Part of the community, Someone special). Steps tick off as you actually do them, in any order; each arc pays once. Your next step shows on the Today card.</div>
              <div>🧑‍🔧 <b>Staff:</b> hire attendants (more trade) and a manager (no slipping when you're away) at your businesses. Wages come out of the till daily; letting someone go costs three days' pay.</div>
              <div>🔧 <b>Vehicles need looking after:</b> driving wears them down, worn-out ones break down on the road. Service at the fitters by any lorry station; renew insurance yearly, because police check stickers at barriers. The dealer covers your first year.</div>
              <div>🗣️ <b>Languages and what matters to you:</b> pick the languages you speak (Twi, Fante, Ga, Ewe, Dagbani, Hausa, Gonja, Dagaare, Gurene, Nzema) and up to two priorities (family, faith, getting ahead, friends, health, enjoying life). People warm to you faster in their own language; good moments in what you care about lift your mood more, and one daily goal leans that way. Change them any time in Phone → Settings.</div>
              <div>👪 <b>Family keep their own week:</b> the young one is at school on weekday mornings, parents work until 4, everyone goes to church or the mosque. At the family house you can fetch water, sweep the compound, help cook (pound fufu, stir TZ, turn akple or banku) or help with homework.</div>
              <div>🥁 <b>Festivals on your Today card:</b> what's on where you are and back home, and what's coming next month. 🏘️ <b>Neighbours:</b> people who live on your street head to the station in the morning and come home in the evening; the elder stays in.</div>
              <div>🇬🇭 <b>Not just Accra:</b> every town now has a church and a mosque, everyday jobs (market loader, trotro mate, chop bar cook, nursing aide, night security, evening tutor), driving and riding lessons, and three named townspeople (a trader, a driver, a nurse) you can befriend. Their favours do real things: cheaper stock, half-price clinic visits, standing at the station. Bigger cities have ride-app and delivery work.</div>
              <div>🥁 <b>Funerals and weddings follow the region:</b> the gyil plays at Upper West funeral rites, smocks and drums in the Upper East, funeral prayers and mosque weddings where most people are Muslim, black and red with brass bands in the south.</div>
              <div>⚫💍 <b>Saturdays:</b> funerals and weddings in town. Canopies go up, guests come in black and red or kente. Go along with a donation or gift (Today card, or the venue). Social, fun, food, and a little standing if you give well.</div>
              <div>⛪ <b>Weekly rhythm:</b> Sunday service at every church (Friday Jumu'ah at the mosque), with a Fellowship mood. Each market has two market days: stock 8% cheaper, twice the buyers.</div>
              <div>⚡ <b>Prepaid light:</b> electricity is now prepaid units (SikaBank → Power). Units drop each day with what you plug in; when they run out the house goes dark until you top up. Water stays on the monthly bill.</div>
              <div>🚶 <b>People commute:</b> named people now walk to work from the trotro stop in the morning, cross to their next place, and walk off home in the evening.</div>
              <div>🚗 <b>Drive for the app:</b> ride-app and delivery shifts are real now. Tap "Start driving", follow the green beacon to pick up, the yellow one to drop off. Pay per trip, fuel comes off, tips sometimes.</div>
              <div>🤒 <b>Feeling ill:</b> malaria in the rains (sleep under a net), flu in the Harmattan, a running stomach if hygiene slips. The clinic treats malaria; the pharmacy handles the rest.</div>
              <div>🚦 <b>Dumsor at the junction:</b> when the power goes, the traffic lights die and a warden in a reflective vest waves traffic through.</div>
              <div>🕯️ <b>Dumsor:</b> some weeks each area loses power for a morning or evening on a published timetable (see the morning card). Street lights and windows go dark, home lights drop to candlelight, and the TV won't come on unless you have a generator (fuel extra).</div>
              <div>📋 <b>Real road test:</b> after your driving or riding lessons, drive the examiner yourself: through the checkpoints in your lane, under 50 km/h, stop at red, park in the box. 3 faults or fewer passes.</div>
              <div>💼 <b>New jobs:</b> chop bar cook, barbering and tailoring apprentices, clinic night security, nursing aide, evening class tutor, fitting-shop mechanic, and gig work as a food delivery rider (licence A + motorbike) or ride-app driver (licence B + car).</div>
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
