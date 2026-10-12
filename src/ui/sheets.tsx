import { useMemo, useState } from "react";
import { isMarketDay, marketDayNames } from "../../shared/weekly.ts";
import { LANGUAGES, languagesOfCity } from "../../shared/identity.ts";
import { startGigShift } from "./gig.ts";
import { GOODS, canBuyHere, canSellHere, sellPrice } from "../../shared/trade.ts";
import { useGame } from "../store.tsx";
import { AVATAR_COLORS, ConfirmButton, Bar, EffectsPreview, Sheet, initials, money } from "./common.tsx";
import { CITIES } from "../../shared/cities.ts";
import { projectKm } from "../../shared/geo.ts";
import { DISTRICTS, districtsIn, JOBS, PLACE_BY_ID, SERVICES, TRAVEL_MODES, isOpenAt, priceFor, rankPay, travelQuote, type DistrictId, type TravelMode } from "../../shared/world.ts";
import { NPC_BY_ID, NPCS, npcLocation, tierFor } from "../../shared/people.ts";
import { HOME_ACTIVITIES } from "../../shared/homes.ts";
import { CoursesPanel, DealerPanel, HomeGoods, IntercityPanel, StorePanel, placeIsStore, serviceNote } from "./ghana.tsx";
import { toGameDate } from "../../shared/calendar.ts";
import type { World } from "../world/World.ts";

const SVC_ICON: Record<string, string> = { waakye: "🍛", kelewele: "🍌", jollof: "🍗", fufu: "🥣", banku: "🐟", sobolo: "🥤", coffee: "☕", fine_dining: "🍽️", gym: "🏋🏾", jog: "🏃🏾", swim: "🏊🏾", drum_circle: "🥁", club: "🪩", beach_bar: "🍹", clinic: "🩺", pharmacy: "💊", haircut: "💈", church: "⛪", nap: "😴", sleep: "🛏️", course: "📚", coworking: "💻", golf: "⛳", view: "👀" };

function useMinute(world: World | null) {
  const { state } = useGame();
  return world ? Math.floor(world.minuteNow) : state!.time.minute;
}

export function PlaceSheet({ placeId, world, onClose, onTalk, onTravel, onPhone }: { placeId: string; world: World | null; onClose: () => void; onTalk: (id: string) => void; onTravel: () => void; onPhone: (app: string) => void }) {
  const { state, act, busy } = useGame();
  const [amount, setAmount] = useState("200");
  const p = PLACE_BY_ID[placeId];
  const minute = useMinute(world);
  const gd = toGameDate(minute);
  if (!state || !p) return null;
  const open = isOpenAt(p.open, gd.hour);
  const jobs = Object.values(JOBS).filter((j) => j.placeId === p.id);
  const people = NPCS.filter((n) => npcLocation(n, gd.weekdayIndex, gd.hour) === p.id);
  const dates = (state.dates as { id: number; npcId: string; placeId: string; startMin: number; status: string }[]).filter((d) => d.placeId === p.id && d.status === "pending");
  const hours = p.open[0] === 0 && p.open[1] === 24 ? "Open 24 hours" : `${p.open[0]}:00 – ${p.open[1] % 24}:00`;
  return (
    <Sheet title={p.name} sub={<>{DISTRICTS[p.district].name} · {hours} · <span className={open ? "good" : "bad"}>{open ? "Open now" : "Closed"}</span></>} onClose={onClose}>
      <p className="muted" style={{ margin: "8px 0 0" }}>{p.blurb}</p>

      {dates.map((d) => {
        const n = NPC_BY_ID[d.npcId];
        const ready = minute >= d.startMin - 30 && minute <= d.startMin + 180;
        return (
          <div key={d.id} className="notice ok" style={{ marginTop: 12 }}>
            <div className="spread">
              <span>❤️ Date with {n.name.split(" ")[0]} · {toGameDate(d.startMin).label} {toGameDate(d.startMin).clock}</span>
              <button className="btn primary sm" disabled={!ready || busy} onClick={() => act({ type: "date_attend", dateId: d.id })}>{ready ? "Meet" : "Not yet"}</button>
            </div>
          </div>
        );
      })}

      {p.kind === "market" && <div className={`notice ${isMarketDay(p.id, state.time.day) ? "ok" : ""}`} style={{ marginTop: 10 }}>🧺 {isMarketDay(p.id, state.time.day) ? "It's market day: stock is 8% cheaper and there are twice the buyers." : `Market days here: ${marketDayNames(p.id)}.`}</div>}
      {state.player.events.filter((e) => e.placeId === p.id).map((e) => <EventCard key={e.id} ev={e} hour={gd.hour} />)}
      <TradePanel placeId={p.id} hour={gd.hour + gd.min / 60} open={open} />

      {p.services.length > 0 && <h3>What you can do</h3>}
      {p.services.map((sid) => {
        const s = SERVICES[sid];
        let cost = priceFor(s.cost, p.district);
        if (sid === "clinic" && state.player.unlocks.includes("adjei_care")) cost = Math.round(cost / 2);
        else if ((sid === "clinic" || sid === "pharmacy") && state.player.unlocks.includes(`nurse_${p.district}`)) cost = Math.round(cost / 2);
        const season = serviceNote(sid, gd.month + 1, gd.day);
        const dayOk = !s.days || s.days.includes(gd.weekdayIndex);
        const avail = open && (!s.hours || isOpenAt(s.hours, gd.hour)) && (season?.available ?? true) && dayOk;
        const rep = !s.requiresRep || state.player.reputation >= s.requiresRep;
        const seen = s.site && state.player.discovered.includes(`site:${s.site}`);
        return (
          <div className="svc" key={sid}>
            <div className="ic">{SVC_ICON[sid] ?? (sid.startsWith("trip_") ? "🧭" : sid.startsWith("fest_") ? "🥁" : "🍽️")}</div>
            <div className="grow">
              <div className="bold">{seen ? "✅ " : ""}{s.name}</div>
              {(season || s.note) && <div className="tiny muted">{season?.note ?? s.note}</div>}
              <div className="tiny muted">{cost ? money(cost * 100) : "Free"} · {s.minutes >= 60 ? `${s.minutes / 60}h` : `${s.minutes}m`}{s.hours ? ` · ${s.hours[0]}:00–${s.hours[1] % 24}:00` : ""}{!rep ? ` · needs ${s.requiresRep} standing` : ""}</div>
              <EffectsPreview effects={s.effects} />
            </div>
            <button className="btn primary sm" disabled={!avail || !rep || busy} onClick={() => act({ type: "service", placeId: p.id, serviceId: sid })}>{s.verb.split(" ")[0]}</button>
          </div>
        );
      })}

      {p.kind === "bank" && (
        <>
          <h3>Counter</h3>
          <div className="card col">
            <div className="row"><input className="input num" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ""))} /><span className="muted">GH₵</span></div>
            <div className="row">
              <button className="btn green grow" disabled={!open || busy} onClick={() => act({ type: "deposit", amount: Math.round(Number(amount) * 100), placeId: p.id })}>Deposit</button>
              <button className="btn grow" disabled={!open || busy} onClick={() => act({ type: "withdraw", amount: Math.round(Number(amount) * 100), placeId: p.id })}>Withdraw</button>
            </div>
            <div className="tiny muted">No fees at the counter. Cash {money(state.money.cash)} · Bank {money(state.money.bank)}</div>
            <button className="btn sm" onClick={() => onPhone("money")}>T-bills, dollars & loans →</button>
          </div>
        </>
      )}
      {p.kind === "realtor" && (
        <>
          <h3>Land & homes</h3>
          <button className="btn primary block" onClick={() => onPhone("property")}>Browse plots, rentals & construction</button>
          <button className="btn block" style={{ marginTop: 8 }} onClick={() => onPhone("farm")}>🌱 Farmland</button>
        </>
      )}
      {p.kind === "dealer" && <DealerPanel place={p} open={open} />}
      {placeIsStore(p) && <StorePanel place={p} open={open} />}
      <CoursesPanel place={p} open={open} onRoadTest={(courseId) => {
        if (!world) return;
        onClose();
        void world.startRoadTest(courseId === "riding_a" ? "bike" : "car").then((r) => {
          if (r.aborted) return void act({ type: "road_test", courseId, placeId: p.id, faults: 50, seconds: Math.max(20, r.seconds) });
          void act({ type: "road_test", courseId, placeId: p.id, faults: r.faults, seconds: Math.max(20, r.seconds) });
        });
      }} />
      {p.kind === "transport" && (
        <>
          <h3>Rides</h3>
          <button className="btn primary block" onClick={onTravel}>🚐 Choose a destination</button>
          <div className="tiny muted" style={{ marginTop: 6 }}>Long-distance buses to every region leave from lorry stations.</div>
        </>
      )}

      {jobs.length > 0 && <h3>Work here</h3>}
      {jobs.map((j) => {
        const mine = state.player.job?.id === j.id;
        const req = state.player.jobRequirements[j.id] ?? {};
        const missing = Object.entries(req).filter(([k, v]) => ((k === "reputation" ? state.player.reputation : state.player.skills[k as keyof typeof state.player.skills]) ?? 0) < (v as number));
        const inWindow = isOpenAt(j.shiftWindow, gd.hour) && !(j.weekdaysOnly && gd.isWeekend);
        return (
          <div className="svc" key={j.id}>
            <div className="ic">💼</div>
            <div className="grow">
              <div className="bold">{mine ? `${state.player.job!.rankTitle} ${j.title}`.trim() : j.title}</div>
              <div className="tiny muted">{money(rankPay(j.pay, mine ? state.player.job!.rank : 0) * 100)}/shift · {j.hours}h · start {j.shiftWindow[0]}:00–{j.shiftWindow[1]}:00{j.weekdaysOnly ? " · weekdays" : ""}{j.salaried ? " · monthly salary" : " · paid in cash"}</div>
              <div className="tiny" style={{ marginTop: 3 }}>
                {j.needsUnlock && <span className={state.player.unlocks.includes(j.needsUnlock) ? "good" : "bad"} style={{ marginRight: 8 }}>{state.player.unlocks.includes(j.needsUnlock) ? "✓" : "✗"} {j.needsUnlock === "licence_b" ? "driving licence" : j.needsUnlock === "licence_a" ? "riding licence" : j.needsUnlock}</span>}
                {j.needsVehicle && <span className="muted" style={{ marginRight: 8 }}>🚗 own {j.needsVehicle}</span>}
                {Object.keys(req).length === 0 ? (j.needsUnlock ? null : <span className="good">No requirements</span>) : Object.entries(req).map(([k, v]) => {
                  const have = (k === "reputation" ? state.player.reputation : state.player.skills[k as keyof typeof state.player.skills]) ?? 0;
                  return <span key={k} className={have >= (v as number) ? "good" : "bad"} style={{ marginRight: 8 }}>{have >= (v as number) ? "✓" : "✗"} {k} {Math.floor(have)}/{v as number}</span>;
                })}
              </div>
              {mine && state.player.job!.nextRankAt && <div className="tiny muted">Promotion at {state.player.job!.nextRankAt} shifts ({state.player.job!.shifts} done)</div>}
            </div>
            {mine ? (
              j.needsVehicle
                ? <button className="btn primary sm" disabled={!inWindow || busy || state.player.lastGigDay === state.time.day} onClick={() => startGigShift(world, state, act, onClose)}>{state.player.lastGigDay === state.time.day ? "Done today" : inWindow ? "Start driving" : "Off shift"}</button>
                : <button className="btn primary sm" disabled={!inWindow || !open || busy} onClick={() => act({ type: "work" })}>{inWindow ? "Work shift" : "Off shift"}</button>
            ) : (
              <ConfirmButton className="btn sm" disabled={missing.length > 0 || busy} ask={`Take the job: ${j.title}?`} details={{ where: p.name, time: `${j.hours}h shifts starting ${j.shiftWindow[0]}:00–${j.shiftWindow[1]}:00${j.weekdaysOnly ? ", weekdays" : ""}`, cost: `Pays about ${money(j.pay * 100)} a shift${j.salaried ? ", paid monthly on the 28th" : ""}`, changes: `You work here: show up in shift hours. It uses about ${j.energyCost} energy a shift and builds your skills.${state.player.job ? " It replaces your current job." : ""}`, undo: "Quit any time from Phone → Work." }} onConfirm={() => act({ type: "job_apply", jobId: j.id })}>Apply</ConfirmButton>
            )}
          </div>
        );
      })}

      {people.length > 0 && <h3>Here now</h3>}
      {people.map((n) => (
        <div className="svc" key={n.id}>
          <div className="avatar" style={{ background: AVATAR_COLORS[n.id], width: 38, height: 38, fontSize: 15, borderRadius: 11 }}>{initials(n.name)}</div>
          <div className="grow"><div className="bold">{n.name}</div><div className="tiny muted">{n.role}</div></div>
          <button className="btn sm" onClick={() => onTalk(n.id)}>Talk</button>
        </div>
      ))}
    </Sheet>
  );
}

interface Line { who: "npc" | "me"; text: string }

export function TalkSheet({ npcId, world, onClose }: { npcId: string; world: World | null; onClose: () => void }) {
  const { state, act, busy } = useGame();
  const npc = NPC_BY_ID[npcId];
  const rel = state?.relationships.find((r) => r.npcId === npcId);
  const [lines, setLines] = useState<Line[]>(() => [{ who: "npc", text: rel ? npc.lines.greet[tierFor(rel.affinity)][0] : npc.lines.greet.stranger[0] }]);
  if (!state || !npc) return null;
  const aff = rel?.affinity ?? 0;
  const unlocked = state.player.unlocks.includes(npc.favour.unlock);
  const say = async (topic: string, text: string) => {
    setLines((l) => [...l, { who: "me", text }]);
    world?.npcTalkAnim(npcId);
    const r = await act({ type: "talk", npcId, topic });
    if (r.ok) {
      const d = r.data as { greet: string; reply: string; memory: string };
      setLines((l) => [...l, { who: "npc", text: [l.length <= 2 ? "" : "", d.reply, d.memory].filter(Boolean).join(" ") }]);
    } else setLines((l) => [...l, { who: "npc", text: "…" }]);
  };
  return (
    <Sheet wide title={<div className="row"><div className="avatar" style={{ background: AVATAR_COLORS[npcId] }}>{initials(npc.name)}</div><div><div>{npc.name}</div><div className="small muted" style={{ fontWeight: 500 }}>{npc.role}{(() => { const ls = languagesOfCity(DISTRICTS[npc.district]?.city ?? "accra"); const sh = ls.find((l) => state.player.languages.includes(l)); return ` · speaks ${ls.map((l) => LANGUAGES[l].name).join(", ")} & English${sh ? ` · you share ${LANGUAGES[sh].name} 🗣️` : ""}`; })()}</div></div></div>} onClose={onClose}>
      <div className="card" style={{ marginTop: 12 }}>
        <div className="spread small"><span>{rel ? (rel.partner ? "❤️ Partner" : tierFor(aff)[0].toUpperCase() + tierFor(aff).slice(1)) : "Stranger"}</span><span className="num muted">{Math.round(aff)}/100</span></div>
        <Bar value={Math.max(0, aff)} color="#f2b705" />
        {npc.romanceable && rel && rel.romance > 0 && <div className="tiny" style={{ marginTop: 6 }}>Romance {"♥".repeat(Math.ceil(rel.romance / 20))}{"♡".repeat(5 - Math.ceil(rel.romance / 20))}</div>}
        <div className="tiny muted" style={{ marginTop: 6 }}>{npc.personality}</div>
      </div>
      <div className="col" style={{ marginTop: 12, maxHeight: 260, overflowY: "auto" }}>
        {lines.map((l, i) => <div key={i} className={`bubble ${l.who === "me" ? "me" : ""}`}>{l.text}</div>)}
      </div>
      <div className="topics">
        <button className="btn" disabled={busy} onClick={() => say("chat", "How's it going?")}>💬 Chat</button>
        <button className="btn" disabled={busy} onClick={() => say("advice", "Any advice for me?")}>🧠 Ask advice</button>
        <button className="btn" disabled={busy} onClick={() => say("compliment", "You're looking good today!")}>✨ Compliment</button>
        <button className="btn" disabled={busy} onClick={() => say("gift", `I brought you ${npc.gift.item}.`)}>🎁 Gift · {money(npc.gift.cost * 100)}</button>
        {npc.romanceable && !rel?.partner && <button className="btn" disabled={busy} onClick={() => say("ask_out", "Would you go out with me?")}>❤️ Ask out</button>}
        {!unlocked && <button className="btn" disabled={busy} title={npc.favour.reward} onClick={() => say("favour", npc.favour.ask + "?")}>🤝 {npc.favour.ask} {aff < npc.favour.threshold ? `(${npc.favour.threshold}+)` : ""}</button>}
      </div>
      {rel && rel.memories.length > 0 && (
        <>
          <h3>{npc.name.split(" ")[0]} remembers</h3>
          {rel.memories.slice(-3).reverse().map((m, i) => <div key={i} className="tiny muted">• Day {m.day + 1}: {m.text}</div>)}
        </>
      )}
      <p className="tiny muted" style={{ marginTop: 10 }}>Goal: {npc.goal}</p>
    </Sheet>
  );
}

export function TravelSheet({ context, world, onClose, initialScope }: { context: "stop" | "taxi" | "phone"; world: World | null; onClose: () => void; initialScope?: "city" | "ghana" }) {
  const { state, act, busy } = useGame();
  const minute = useMinute(world);
  const gd = toGameDate(minute);
  const hasCar = (state?.vehicles as { status: string }[] | undefined)?.some((v) => v.status === "personal") ?? false;
  const modes = useMemo<TravelMode[]>(() => {
    const m: TravelMode[] = context === "stop" ? ["trotro", "taxi", "walk"] : context === "taxi" ? ["taxi"] : ["ride", "walk"];
    if (hasCar && context !== "taxi") m.unshift("car");
    return m;
  }, [context, hasCar]);
  const [mode, setMode] = useState<TravelMode>(modes[0]);
  const [scope, setScope] = useState<"city" | "ghana">(initialScope ?? "city");
  if (!state) return null;
  const here = state.player.district;
  const rainy = state.time.weather === "rain" || state.time.weather === "storm";
  const go = (to: DistrictId) => {
    const label = `${TRAVEL_MODES[mode].name} to ${DISTRICTS[to].name}`;
    if (!world) return void act({ type: "travel", to, mode });
    onClose();
    void world.rideTo(mode, label, () => act({ type: "travel", to, mode }));
  };
  return (
    <Sheet title={context === "taxi" ? "🚕 Where to, boss?" : context === "stop" ? "🚐 Catch a ride" : "🗺️ Go somewhere"} sub={context === "phone" ? "Ride app works anywhere. Trotros and taxis: find a stop or flag one on the road." : `${DISTRICTS[here].name} · ${gd.clock}${rainy ? " · rain slows traffic" : ""}`} onClose={onClose}>
      {context !== "taxi" && (
        <div className="tabs" style={{ marginTop: 12 }}>
          <button className={scope === "city" ? "on" : ""} onClick={() => setScope("city")}>Around {CITIES[DISTRICTS[here].city].name}</button>
          <button className={scope === "ghana" ? "on" : ""} onClick={() => setScope("ghana")}>🇬🇭 Across Ghana</button>
        </div>
      )}
      {scope === "ghana" ? <IntercityPanel onDone={onClose} world={world} /> : <>
      <div className="seg" style={{ marginTop: 12 }}>
        {modes.map((m) => <button key={m} className={m === mode ? "on" : ""} onClick={() => setMode(m)}>{TRAVEL_MODES[m].name}</button>)}
      </div>
      <div className="tiny muted" style={{ marginTop: 6 }}>{TRAVEL_MODES[mode].note}{mode === "trotro" && state.player.unlocks.includes("kobby_ride") ? " · Kobby's bus: free for you" : ""}</div>
      <CityMap here={here} onPick={(id) => id !== here && go(id)} />
      <h3>Destinations</h3>
      {districtsIn(DISTRICTS[here].city).filter((d) => d !== here).map((to) => {
        const q = travelQuote(here, to, mode, gd.hour, gd.weekdayIndex, rainy);
        const fare = mode === "trotro" && state.player.unlocks.includes("kobby_ride") ? 0 : q.fare;
        const d = DISTRICTS[to];
        const walkFar = mode === "walk" && q.km > 7;
        return (
          <div className="svc" key={to}>
            <div className="ic">{d.style === "coastal" ? "🏖️" : d.style === "market" ? "🧺" : d.style === "corporate" ? "🏢" : d.style === "luxury" ? "⛳" : d.style === "suburban" ? "🌳" : "🎶"}</div>
            <div className="grow">
              <div className="bold">{d.name} <span className="tiny muted">· {d.tagline}</span></div>
              <div className="tiny muted">{q.km} km · {q.minutes} min · {fare ? money(fare * 100) : "Free"} · cost of living ×{d.costOfLiving}</div>
            </div>
            <button className="btn primary sm" disabled={busy || walkFar} onClick={() => go(to)}>{walkFar ? "Too far" : "Go"}</button>
          </div>
        );
      })}
      {districtsIn(DISTRICTS[here].city).length === 1 && <div className="notice warn" style={{ marginTop: 8 }}>This town is one street. Use “Across Ghana” to travel on.</div>}
      </>}
    </Sheet>
  );
}

/** Accra drawn from real coordinates: coastline, landmarks and the playable districts. */
export function CityMap({ here, onPick }: { here: DistrictId; onPick: (id: DistrictId) => void }) {
  const city = CITIES[DISTRICTS[here].city];
  const ids = districtsIn(city.id);
  const origin = city.center;
  const pts = ids.map((id) => ({ id, ...projectKm(DISTRICTS[id].geo, origin) }));
  const lm = city.landmarks.map((l) => ({ ...l, ...projectKm(l.at, origin) }));
  const xs = [...pts, ...lm].map((p) => p.x), ys = [...pts, ...lm].map((p) => p.y);
  const pad = 2;
  const minX = Math.min(...xs) - pad, maxX = Math.max(...xs) + pad, minY = Math.min(...ys) - pad, maxY = Math.max(...ys) + pad;
  const coast = (city.coastline ?? []).map((c) => projectKm(c, origin));
  const sea = coast.length ? `M ${minX - 5} ${-(minY - 5)} L ${coast.map((c) => `${c.x} ${-c.y}`).join(" L ")} L ${maxX + 5} ${-(minY - 5)} Z` : "";
  return (
    <svg viewBox={`${minX} ${-maxY} ${maxX - minX} ${maxY - minY}`} className="mapsvg" style={{ marginTop: 12, height: 230 }}>
      <rect x={minX} y={-maxY} width={maxX - minX} height={maxY - minY} fill="#e9dcc0" />
      {sea && <path d={sea} fill="#7cc2d6" />}
      {lm.map((l) => (
        <g key={l.name} opacity={0.75}>
          <text x={l.x} y={-l.y} fontSize="0.55" textAnchor="middle" dominantBaseline="middle">{l.icon}</text>
          <text x={l.x} y={-l.y + 0.7} fontSize="0.32" textAnchor="middle" fill="#5a4d38">{l.name}</text>
        </g>
      ))}
      {pts.map((p) => (
        <g key={p.id} onClick={() => onPick(p.id)} style={{ cursor: "pointer" }}>
          <circle cx={p.x} cy={-p.y} r={p.id === here ? 0.62 : 0.5} fill={p.id === here ? "#c8452c" : "#1f7a4d"} stroke="#fff" strokeWidth="0.12" />
          <text x={p.x} y={-p.y - 0.8} fontSize="0.55" fontWeight="800" textAnchor="middle" fill="#1d1a14">{DISTRICTS[p.id].name}</text>
        </g>
      ))}
      <text x={minX + 0.4} y={-minY - 0.5} fontSize="0.45" fill="#0e5266">Gulf of Guinea</text>
      <text x={maxX - 0.4} y={-maxY + 0.8} fontSize="0.6" fontWeight="800" textAnchor="end" fill="#1d1a14">N ↑</text>
    </svg>
  );
}

export function EventModal({ onClose }: { onClose: () => void }) {
  const { state, act, busy } = useGame();
  const ev = state?.event;
  if (!ev) return null;
  return (
    <div className="modal-wrap" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="pill gold">📱 Life happens</div>
        <h2 style={{ margin: "10px 0 6px" }}>{ev.title}</h2>
        <p className="muted" style={{ marginTop: 0 }}>{ev.text}</p>
        <div className="col">
          {ev.choices.map((c) => (
            <button key={c.id} className="btn block" disabled={busy} onClick={async () => { const r = await act({ type: "event_choose", eventId: ev.id, choiceId: c.id }); if (r.ok) onClose(); }} style={{ justifyContent: "space-between" }}>
              <span>{c.label}</span>
              <EffectsPreview effects={c.effects} />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Where in the home each thing is done, and how it looks in the progress bar. */
const ACT_SPOT: Record<string, "bath" | "tv" | "kitchen" | "coalpot" | "neighbours" | "terrace" | "pool" | "bed" | null> = {
  shower: "bath", toilet: "bath", shared_bath: "bath", bucket_bath: "bath", laundry: "bath", toilet_public: null, pool_swim: "pool", terrace: "terrace",
  watch_tv: "tv", watch_football: "tv", neighbours: "neighbours", cook_coalpot: "coalpot", cook_kitchen: "kitchen", devotion: null, music: "tv", work_from_home: "tv",
};
const ACT_ICON: Record<string, string> = {
  shower: "🚿", toilet: "🚽", shared_bath: "🪣", bucket_bath: "🪣", laundry: "🧺", toilet_public: "🚻", pool_swim: "🏊", terrace: "🍹", watch_tv: "📺", watch_football: "⚽",
  neighbours: "🗣️", cook_coalpot: "🔥", cook_kitchen: "🍳", devotion: "🙏", music: "🎶", work_from_home: "💻",
};
const ACT_DOING: Record<string, string> = {
  shower: "Showering", toilet: "Using the toilet", shared_bath: "Bathing in the compound bathroom", bucket_bath: "Bucket bath", laundry: "Washing clothes", toilet_public: "At the public toilet", pool_swim: "Swimming",
  terrace: "Relaxing outside", watch_tv: "Watching TV", watch_football: "Watching the match", neighbours: "Chatting with the neighbours", cook_coalpot: "Cooking on the coal pot",
  cook_kitchen: "Cooking", devotion: "Praying", music: "Playing music", work_from_home: "Working from home",
};

const FOCUS: Record<string, string[]> = {
  bed: ["devotion"],
  bath: ["toilet", "shower", "shared_bath", "bucket_bath", "toilet_public", "laundry"],
  tv: ["watch_tv", "watch_football"],
  kitchen: ["cook_kitchen", "cook_coalpot"],
  coalpot: ["cook_coalpot", "cook_kitchen"],
  neighbours: ["neighbours", "music"],
  terrace: ["terrace", "music"],
  pool: ["pool_swim"],
};
const BATH_LABEL: Record<string, string> = { none: "No bathroom — bucket baths, public toilet", shared: "Shared compound bathroom", private: "Private bathroom", ensuite: "Ensuite bathrooms" };
const KITCHEN_LABEL: Record<string, string> = { coalpot: "No kitchen — coal pot outside", shared: "Shared kitchen", kitchenette: "Kitchenette", fitted: "Fitted kitchen", chef: "Chef's kitchen with island" };
const WATER_LABEL: Record<string, string> = { public_tap: "Water from the public tap", compound_tap: "Compound standpipe", polytank: "Polytank & pump", running: "Running water" };

export function HomeSheet({ onClose, world, focus }: { onClose: () => void; world: World | null; focus?: string }) {
  const { state, act, busy } = useGame();
  if (!state) return null;
  const comfort = state.player.home.comfort;
  const spec = state.player.home.spec;
  const items = state.items.map((i) => i.itemId);
  const list = HOME_ACTIVITIES.filter((a) => (focus && FOCUS[focus] ? FOCUS[focus].includes(a.id) : true));
  const showSleep = !focus || focus === "bed";
  // Close the sheet and let your character walk over and do it.
  const doIt = (activity: string, label: string, icon: string, minutes: number, run: () => Promise<{ ok: boolean }>, spot: (typeof ACT_SPOT)[string], pose?: "hidden" | "stand") => {
    onClose();
    if (world) void world.doActivity(spot, activity, label, icon, minutes, run, pose);
    else void run();
  };
  return (
    <Sheet title={`🏠 ${spec.label}`} sub={`${spec.blurb} Comfort ${comfort}.`} onClose={onClose}>
      <div className="row" style={{ flexWrap: "wrap", gap: 6, marginTop: 10 }}>
        <span className="pill">🚿 {BATH_LABEL[spec.bathroom]}</span>
        <span className="pill">🍳 {KITCHEN_LABEL[spec.kitchen]}</span>
        <span className="pill">💧 {WATER_LABEL[spec.water]}</span>
        {spec.bedrooms > 0 && <span className="pill">🛏️ {spec.bedrooms} bedroom{spec.bedrooms > 1 ? "s" : ""}</span>}
      </div>
      {showSleep && (
        <div className="col" style={{ marginTop: 12 }}>
          <button className="btn primary block" disabled={busy} onClick={() => doIt("sleep", "Sleeping", "😴", 480, () => act({ type: "sleep", hours: 8 }), "bed")}>Sleep 8 hours · ⚡ +{52 + comfort * 6}</button>
          <button className="btn block" disabled={busy} onClick={() => doIt("nap", "Napping", "😴", 120, () => act({ type: "sleep", hours: 2 }), "bed")}>Nap 2 hours · ⚡ +{14 + comfort * 2}</button>
        </div>
      )}
      <h3>{focus && focus !== "bed" ? "Here" : "At home"}</h3>
      {list.map((a) => {
        const ok = a.when(spec, items);
        if (!ok && focus) return null;
        return (
          <div className="svc" key={a.id} style={{ opacity: ok ? 1 : 0.5 }}>
            <div className="grow">
              <div className="bold">{a.label}</div>
              <div className="tiny muted">{ok ? a.note(spec) : "Not in this home"} · {a.minutes >= 60 ? `${Math.round(a.minutes / 6) / 10}h` : `${a.minutes}m`}{a.cost ? ` · ${money(a.cost * 100)}` : ""}</div>
              <EffectsPreview effects={a.effects} />
            </div>
            <button className="btn primary sm" disabled={busy || !ok} onClick={() => doIt(a.id, ACT_DOING[a.id] ?? a.label, ACT_ICON[a.id] ?? "🏠", a.minutes, () => act({ type: "home_activity", activity: a.id }), a.id === "cook_kitchen" && spec.kitchen === "coalpot" ? "coalpot" : a.id === "cook_coalpot" && spec.kitchen !== "coalpot" ? "kitchen" : ACT_SPOT[a.id] ?? null, a.id === "toilet" ? "hidden" : a.id === "laundry" ? "stand" : undefined)}>{a.verb}</button>
          </div>
        );
      })}
      {!focus && <HomeGoods />}
      <button className="btn ghost block" style={{ marginTop: 12 }} onClick={() => { world?.exitHome(); onClose(); }}>Go outside</button>
    </Sheet>
  );
}

/** Buy stock at markets; sell it where buyers are. Shows cost, time and margin before you commit. */
function TradePanel({ placeId, hour, open }: { placeId: string; hour: number; open: boolean }) {
  const { state, act, busy } = useGame();
  const [qty, setQty] = useState(5);
  const p = PLACE_BY_ID[placeId];
  if (!state || !p) return null;
  const st = state.player;
  const carrying = st.stock.reduce((n, x) => n + x.qty, 0);
  const buyHere = canBuyHere(p);
  const sellable = st.stock.filter((x) => GOODS[x.id] && canSellHere(p, GOODS[x.id]));
  if (!buyHere && !sellable.length) return null;
  return (
    <>
      <h3>🧺 {buyHere ? "Buy stock to sell" : "Sell your stock"}</h3>
      <div className="tiny muted" style={{ marginBottom: 6 }}>Carrying {carrying}/{st.carryCap}. {buyHere ? "Sell at lorry stations and markets; busy hours (6–9, 12–2, 4:30–7:30) pay more." : ""}</div>
      {buyHere && (
        <>
          <div className="seg" style={{ marginBottom: 6 }}>{[1, 5, 10, 20].map((n) => <button key={n} className={qty === n ? "on" : ""} onClick={() => setQty(n)}>×{n}</button>)}</div>
          {Object.values(GOODS).map((g) => {
            const price = Math.round(priceFor(g.buy, p.district) * 100 * (isMarketDay(p.id, state.time.day) ? 0.92 : 1) * (state.player.unlocks.includes(`trader_${p.id}`) ? 0.95 : 1)) / 100;
            return (
              <div className="svc" key={g.id}>
                <span className="goal-icon">{g.icon}</span>
                <div className="grow">
                  <div className="bold">{g.name} <span className="tiny muted">per {g.unit}</span></div>
                  <div className="tiny muted">Buy {money(price * 100)} · sells for about {money(g.sell * 100)} at {g.sellAt.includes("transport") ? "stations & markets" : "markets"}{g.spoil ? ` · goes off (${Math.round(g.spoil * 100)}% a night)` : " · keeps"}</div>
                </div>
                <button className="btn primary sm" disabled={busy || !open || carrying + qty > st.carryCap} onClick={() => act({ type: "trade_buy", placeId: p.id, goodId: g.id, qty })}>Buy {qty} · {money(price * qty * 100)}</button>
              </div>
            );
          })}
        </>
      )}
      {sellable.map((x) => {
        const g = GOODS[x.id];
        const sold = st.tradeSold[`${p.id}:${g.id}`] ?? 0;
        const now = sellPrice(g, p.district, hour, sold, p.kind === "market" && isMarketDay(p.id, state.time.day));
        const n = Math.min(x.qty, qty);
        return (
          <div className="svc" key={x.id}>
            <span className="goal-icon">{g.icon}</span>
            <div className="grow">
              <div className="bold">Sell {g.name.toLowerCase()} · you have {x.qty}</div>
              <div className="tiny muted">About {money(now * 100)} each here now (you paid {money(x.avgCost)}) · {Math.round(n * g.minutesPerUnit)} min for {n}{sold > g.demand ? " · buyers getting scarce" : ""}</div>
            </div>
            <button className="btn sm" disabled={busy || (p.kind === "market" && !open)} onClick={() => act({ type: "trade_sell", placeId: p.id, goodId: g.id, qty: n })}>Sell {n}</button>
            {x.qty > n && <button className="btn sm ghost" disabled={busy || (p.kind === "market" && !open)} onClick={() => act({ type: "trade_sell", placeId: p.id, goodId: g.id, qty: x.qty })}>All</button>}
          </div>
        );
      })}
    </>
  );
}

/** A funeral or wedding happening here today. */
function EventCard({ ev, hour }: { ev: { id: string; kind: "funeral" | "wedding"; title: string; host: string; hours: [number, number]; gift: number; blurb: string; attended: boolean }; hour: number }) {
  const { act, busy } = useGame();
  const [gift, setGift] = useState(String(ev.gift));
  const on = hour >= ev.hours[0] && hour < ev.hours[1];
  return (
    <div className="card col" style={{ marginTop: 10, gap: 6 }}>
      <b>{ev.kind === "funeral" ? "⚫🔴" : "💍"} {ev.title}</b>
      <div className="tiny muted">Hosted by {ev.host} · {ev.hours[0]}:00–{ev.hours[1]}:00 · {ev.blurb}</div>
      {ev.attended ? <span className="pill green">You went</span> : (
        <div className="row" style={{ gap: 6 }}>
          <input className="input num" style={{ width: 90 }} inputMode="decimal" value={gift} onChange={(e) => setGift(e.target.value.replace(/[^\d.]/g, ""))} />
          <ConfirmButton className="btn primary sm" disabled={busy || !on} ask={ev.kind === "funeral" ? "Go to the funeral?" : "Go to the wedding?"} details={{ time: "About 3 hours", cost: `GH₵${gift || 0} ${ev.kind === "funeral" ? "donation" : "gift"} (people give at least GH₵${ev.gift})`, changes: ev.kind === "funeral" ? "You greet the family, eat, and meet half the neighbourhood: social, fun, food and a little standing." : "Dancing, jollof and photos: a lot of social and fun, a full belly and a little standing.", undo: "The gift is given. You can only go once." }} onConfirm={() => act({ type: "event_attend", eventId: ev.id, gift: Math.round(Number(gift || 0) * 100) })}>{on ? "Go" : `From ${ev.hours[0]}:00`}</ConfirmButton>
        </div>
      )}
    </div>
  );
}
