// Ghana-wide UI: the country map, intercity travel, shops, dealers, schools,
// farms, home goods and the Vibes social app.
import { useMemo, useState } from "react";
import { useGame } from "../store.tsx";
import type { World } from "../world/World.ts";
import { ConfirmButton, EffectsPreview, money } from "./common.tsx";
import regionsData from "../../shared/data/ghana-regions.json";
import { REGIONS, TOWNS, TOWN_BY_ID, roadSegments, type RegionId } from "../../shared/ghana.ts";
import { AIRPORTS, CITIES, INTERCITY_MODES, intercityQuote, type IntercityMode } from "../../shared/cities.ts";
import { DISTRICTS, PLACE_BY_ID, districtsIn, isOpenAt, priceFor, type Place } from "../../shared/world.ts";
import { COURSES, CROPS, DEALER_STOCK, FARMLANDS, ITEMS, POST_TYPES, VEHICLES, furnishingScore, influencerDaily, stockFor } from "../../shared/life.ts";
import { FESTIVALS, SITES, SITE_BY_ID } from "../../shared/regional.ts";
import { formatDuration, toGameDate } from "../../shared/calendar.ts";

const RG = regionsData as { attribution: string; regions: { name: string; rings: [number, number][][] }[]; country: [number, number][][] };

// ---------------------------------------------------------------------------
// Country map

const LON0 = -3.4, LAT0 = 11.3, K = 40;
const px = (lon: number, lat: number) => [(lon - LON0) * K, (LAT0 - lat) * K] as const;
const REGION_TINT: Record<string, string> = {
  "Greater Accra": "#f1d9a6", Central: "#d8e6b9", Western: "#c3dfb0", "Western North": "#b7d6a3", Eastern: "#cfe3b5", Ashanti: "#c6dca6",
  Ahafo: "#bcd8a0", Bono: "#d6e2ad", "Bono East": "#e1e3ad", Oti: "#d9e7bd", Volta: "#cbe2bf", Northern: "#ecdcaa", Savannah: "#efd9a0",
  "North East": "#f0dfaf", "Upper East": "#f3d9a2", "Upper West": "#efd39b",
};

export function CountryMap({ here, onPick, height = 330 }: { here: string; onPick?: (city: string) => void; height?: number }) {
  const { state } = useGame();
  const visited = new Set((state?.player.visited ?? []).map((d) => DISTRICTS[d]?.city));
  const roads = useMemo(() => roadSegments(), []);
  const playable = new Set(Object.values(DISTRICTS).map((d) => d.city));
  const ring = (r: [number, number][]) => "M" + r.map(([lon, lat]) => px(lon, lat).join(" ")).join("L") + "Z";
  const [w, h] = px(1.4, 4.5);
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="mapsvg" style={{ marginTop: 10, height, background: "#8fcbe0" }}>
      {RG.regions.map((r) => <path key={r.name} d={r.rings.map(ring).join(" ")} fill={REGION_TINT[r.name] ?? "#dfe6c0"} stroke="#fff" strokeWidth={0.5} />)}
      {RG.country.map((r, i) => <path key={i} d={ring(r)} fill="none" stroke="#5a4d38" strokeWidth={0.9} />)}
      {roads.map((s, i) => {
        const [x1, y1] = px(s.a.lon, s.a.lat), [x2, y2] = px(s.b.lon, s.b.lat);
        const major = /^N\d/.test(s.road);
        return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke={major ? "#c8452c" : "#8a6d4b"} strokeWidth={major ? 1.4 : 0.8} strokeLinecap="round" />;
      })}
      {SITES.map((s) => { const [x, y] = px(s.at.lon, s.at.lat); return <circle key={s.id} cx={x} cy={y} r={1.1} fill="#0e7c86" opacity={0.8}><title>{s.name}</title></circle>; })}
      {TOWNS.map((t) => {
        const [x, y] = px(t.at.lon, t.at.lat);
        const isHere = t.id === DISTRICTS[here]?.city;
        const canGo = playable.has(t.id);
        return (
          <g key={t.id} onClick={() => canGo && onPick?.(t.id)} style={{ cursor: canGo && onPick ? "pointer" : "default" }}>
            <circle cx={x} cy={y} r={isHere ? 3.4 : canGo ? 2.4 : 1.2} fill={isHere ? "#c8452c" : canGo ? (visited.has(t.id) ? "#1f7a4d" : "#f2b705") : "#6b6250"} stroke="#fff" strokeWidth={canGo ? 0.7 : 0.3} />
            {(canGo || t.size !== "town") && <text x={x + 3.2} y={y + 1.6} fontSize={canGo ? 5.2 : 4} fontWeight={canGo ? 800 : 500} fill="#1d1a14" stroke="#fff" strokeWidth={0.9} paintOrder="stroke">{t.name}</text>}
          </g>
        );
      })}
      <text x={6} y={h - 6} fontSize={4.5} fill="#0e5266">Gulf of Guinea</text>
      <text x={w - 4} y={10} fontSize={6} fontWeight={800} textAnchor="end">N ↑</text>
      <text x={4} y={h - 1.5} fontSize={2.4} fill="#2f3d44">{RG.attribution}</text>
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Intercity travel

export function IntercityPanel({ onDone, world }: { onDone: () => void; world?: World | null }) {
  const { state, act, busy } = useGame();
  const [mode, setMode] = useState<IntercityMode>("vip");
  const [pick, setPick] = useState<string | null>(null);
  if (!state) return null;
  const here = state.player.district;
  const fromCity = DISTRICTS[here].city;
  const hour = state.time.hour;
  const hasCar = (state.vehicles as { type: string; status: string }[]).some((v) => v.status === "personal" && VEHICLES[v.type]?.longDistance);
  const hasPlane = (state.vehicles as { type: string; status: string }[]).some((v) => v.status === "personal" && VEHICLES[v.type]?.category === "aircraft");
  const modes: IntercityMode[] = ["bus", "vip", "flight", ...(hasCar ? (["car"] as IntercityMode[]) : []), ...(hasPlane ? (["own_plane"] as IntercityMode[]) : [])];
  const cities = [...new Set(Object.values(DISTRICTS).map((d) => d.city))].filter((c) => c !== fromCity);
  const rows = cities.map((c) => ({ c, q: intercityQuote(fromCity, c, mode) })).sort((a, b) => (a.q?.km ?? 9e9) - (b.q?.km ?? 9e9));
  const go = (city: string) => {
    const to = districtsIn(city)[0];
    if (!world) return void act({ type: "travel", to, mode }).then((r) => r.ok && onDone());
    onDone();
    void world.rideTo(mode, `${{ bus: "Bus", vip: "VIP coach", flight: "Flight", car: "Driving", own_plane: "Flying your plane" }[mode]} to ${CITIES[city]?.name ?? city}`, () => act({ type: "travel", to, mode }));
  };
  const m = INTERCITY_MODES[mode];
  const running = isOpenAt(m.hours, hour);
  return (
    <>
      <div className="seg" style={{ marginTop: 10 }}>
        {modes.map((x) => <button key={x} className={x === mode ? "on" : ""} onClick={() => setMode(x)}>{{ bus: "🚌 Bus", vip: "🚍 VIP", flight: "✈️ Fly", car: "🚗 Drive", own_plane: "🛩️ Your plane" }[x]}</button>)}
      </div>
      <div className="tiny muted" style={{ marginTop: 6 }}>{m.note} {running ? "" : `Departures ${m.hours[0]}:00–${m.hours[1]}:00.`}{mode === "flight" ? ` Airports: ${AIRPORTS.map((a) => TOWN_BY_ID[a].name).join(", ")}.` : ""}</div>
      <CountryMap here={here} onPick={(c) => setPick(c)} />
      {pick && (() => {
        const q = intercityQuote(fromCity, pick, mode);
        const city = CITIES[pick];
        return (
          <div className="card" style={{ marginTop: 8 }}>
            <div className="spread"><b>{city.name}</b><span className="pill">{city.region} Region</span></div>
            <div className="tiny muted">{city.tagline}</div>
            {q ? (
              <>
                <div className="small" style={{ marginTop: 6 }}>{q.km} km · {formatDuration(q.minutes)} · {money(q.fare * 100)}</div>
                {mode !== "flight" && <div className="tiny muted">Via {q.route.towns.map((t) => TOWN_BY_ID[t].name).join(" → ")}</div>}
                <button className="btn primary block" style={{ marginTop: 8 }} disabled={busy || !running} onClick={() => go(pick)}>{running ? `Go to ${city.name}` : "No departures now"}</button>
              </>
            ) : <div className="tiny bad" style={{ marginTop: 6 }}>No {m.name.toLowerCase()} on this route.</div>}
          </div>
        );
      })()}
      <h3>All destinations</h3>
      {rows.map(({ c, q }) => (
        <div className="svc" key={c}>
          <div className="ic">{state.player.visited.some((d) => DISTRICTS[d]?.city === c) ? "✅" : "📍"}</div>
          <div className="grow">
            <div className="bold">{CITIES[c].name} <span className="tiny muted">· {CITIES[c].region}</span></div>
            <div className="tiny muted">{q ? `${q.km} km · ${formatDuration(q.minutes)} · ${money(q.fare * 100)}` : `No ${m.name.toLowerCase()}`}</div>
          </div>
          <button className="btn primary sm" disabled={busy || !q || !running} onClick={() => go(c)}>Go</button>
        </div>
      ))}
    </>
  );
}

// ---------------------------------------------------------------------------
// Place panels: shops, dealers, schools, tour desks

export function StorePanel({ place, open }: { place: Place; open: boolean }) {
  const { state, act, busy } = useGame();
  const [cat, setCat] = useState<string>("all");
  if (!state) return null;
  const stock = stockFor(place.id, place.kind).map((id) => ITEMS[id]);
  const owned = new Map<string, number>();
  for (const i of state.items) owned.set(i.itemId, (owned.get(i.itemId) ?? 0) + 1);
  const cats = ["all", ...new Set(stock.map((i) => catOf(i.slot)))];
  return (
    <>
      <h3>For sale</h3>
      {cats.length > 2 && <div className="tabs">{cats.map((c) => <button key={c} className={c === cat ? "on" : ""} onClick={() => setCat(c)}>{c}</button>)}</div>}
      {stock.filter((i) => cat === "all" || catOf(i.slot) === cat).map((it) => {
        const price = priceFor(it.price, place.district);
        const n = owned.get(it.id) ?? 0;
        const full = (it.comfort && n >= 1 && it.slot !== "decor") || n >= 3;
        return (
          <div className="svc" key={it.id}>
            <div className="ic">{SLOT_ICON[it.slot] ?? "🛍️"}</div>
            <div className="grow">
              <div className="bold">{it.name}</div>
              <div className="tiny muted">{money(price * 100)}{it.comfort ? ` · +${it.comfort} comfort` : ""}{it.camera ? ` · camera ${"★".repeat(it.camera)}` : ""}{n ? ` · you own ${n}` : ""}</div>
              <div className="tiny muted">{it.blurb}</div>
              {it.effects && <EffectsPreview effects={it.effects} />}
            </div>
            <ConfirmButton className="btn primary sm" disabled={busy || !open || !!full} ask={`Buy ${it.name}?`} details={{ where: place.name, cost: money(price * 100), changes: `It goes in your home${it.comfort ? ` (+${it.comfort} comfort)` : ""} and shows up in 3D.`, undo: `Sell it second-hand any time for about ${money(Math.round(price * 40))} (40%).` }} onConfirm={() => act({ type: "shop_buy", placeId: place.id, itemId: it.id })}>{full ? "Owned" : "Buy"}</ConfirmButton>
          </div>
        );
      })}
    </>
  );
}

const catOf = (slot: string) => (["phone", "computer"].includes(slot) ? "phones" : ["clothing", "jewellery", "craft"].includes(slot) ? "fashion & crafts" : ["cooling", "fridge", "screen", "sound", "power", "water", "laundry", "kitchen"].includes(slot) ? "appliances" : "furniture");
export const SLOT_ICON: Record<string, string> = { bed: "🛏️", mattress: "🛏️", seating: "🛋️", table: "🪑", storage: "🚪", cooling: "🌀", kitchen: "🍳", fridge: "🧊", screen: "📺", sound: "🔊", power: "🔋", water: "💧", decor: "🖼️", laundry: "🧺", phone: "📱", computer: "💻", clothing: "👕", craft: "🧵", jewellery: "📿" };

export function DealerPanel({ place, open }: { place: Place; open: boolean }) {
  const { state, act, busy } = useGame();
  if (!state) return null;
  const stock = (DEALER_STOCK[place.id] ?? []).map((id) => VEHICLES[id]);
  return (
    <>
      <h3>On the lot</h3>
      {stock.map((v) => {
        const owned = (state.vehicles as { type: string }[]).filter((x) => x.type === v.id).length;
        const max = v.workPay ? 5 : 1;
        const repOk = !v.requiresRep || state.player.reputation >= v.requiresRep;
        const lic = v.licence && !state.player.unlocks.includes(v.licence);
        return (
          <div className="svc" key={v.id}>
            <div className="ic" style={{ background: v.color }}>{v.category === "aircraft" ? (v.model === "helicopter" ? "🚁" : "🛩️") : v.category === "bicycle" ? "🚲" : v.category === "motorbike" ? "🏍️" : v.category === "tricycle" ? "🛺" : v.category === "luxury" ? "🏎️" : "🚗"}</div>
            <div className="grow">
              <div className="bold">{v.name}</div>
              <div className="tiny muted">{money(v.price * 100, true)} · +{v.reputation} standing{v.workPay ? ` · work-and-pay ~${money(v.workPay * 100)}/day` : ""}{v.requiresRep ? ` · needs ${v.requiresRep}` : ""}</div>
              <div className="tiny muted">{v.blurb}</div>
              {lic && <div className="tiny bad">Needs {v.licence === "licence_a" ? "a riding (A)" : "a driving (B)"} licence to drive</div>}
            </div>
            <ConfirmButton className="btn primary sm" disabled={busy || !open || owned >= max || !repOk} ask={`Buy the ${v.name}?`} details={{ where: place.name, cost: money(v.price * 100), changes: `It's yours: drive it yourself, travel by car${v.workPay ? ", or put it on work-and-pay for daily income" : ""}. Fuel is paid per trip.${lic ? " You'll need a licence before you can drive it." : ""}`, undo: "Sell it back any time; it loses value with age and wear (about 85% of its current value)." }} onConfirm={() => act({ type: "vehicle_buy", vehicleId: v.id, placeId: place.id })}>{owned >= max ? "Owned" : "Buy"}</ConfirmButton>
          </div>
        );
      })}
    </>
  );
}

export function CoursesPanel({ place, open, onRoadTest }: { place: Place; open: boolean; onRoadTest?: (courseId: string) => void }) {
  const { state, act, busy } = useGame();
  if (!state) return null;
  const courses = Object.values(COURSES).filter((c) => c.places.includes(place.id));
  if (!courses.length) return null;
  return (
    <>
      <h3>Courses & certificates</h3>
      {courses.map((c) => {
        const mine = state.courses.find((x) => x.id === c.id);
        const inHours = isOpenAt(c.hours, state.time.hour);
        const doneToday = mine?.lastSessionDay === state.time.day;
        return (
          <div className="svc" key={c.id}>
            <div className="ic">🎓</div>
            <div className="grow">
              <div className="bold">{c.name}</div>
              <div className="tiny muted">{money(c.fee * 100)} · {c.sessions} sessions × {formatDuration(c.minutes)} · classes {c.hours[0]}:00–{c.hours[1]}:00</div>
              <div className="tiny muted">{c.blurb}</div>
              {mine && <div className="tiny good">{mine.status === "done" ? "✓ Certificate earned" : `Progress ${mine.sessions}/${c.sessions}${doneToday ? " · next session tomorrow" : ""}`}</div>}
            </div>
            {!mine ? (
              <ConfirmButton className="btn sm primary" disabled={busy || !open} ask={`Enrol in ${c.name}?`} details={{ where: place.name, cost: money(c.fee * 100), time: `${c.sessions} sessions, one a day`, changes: "Attend sessions here to earn the certificate and the skills and jobs it unlocks.", undo: "Fees aren't refunded. You can stop attending at any time." }} onConfirm={() => act({ type: "course_enrol", courseId: c.id, placeId: place.id })}>Enrol</ConfirmButton>
            ) : mine.status === "enrolled" ? (
              <button className="btn sm primary" disabled={busy || !open || !inHours || doneToday} onClick={() => act({ type: "course_attend", courseId: c.id, placeId: place.id })}>Attend</button>
            ) : mine.status === "test" ? (
              <ConfirmButton className="btn sm primary" disabled={busy || !open || mine.testDay === state.time.day} ask="Take the road test now?" details={{ where: `${place.name}, then out on the road`, time: "A few minutes of driving; 30 game minutes", cost: "Free the first time; a retest costs GH₵150", changes: "Drive through the yellow checkpoints in the right-hand lane, keep under 50 km/h, stop at red, and stop inside the box at the end. 3 faults or fewer and the licence is yours.", undo: "If you fail, try again from tomorrow." }} onConfirm={() => onRoadTest?.(c.id)}>{mine.testDay === state.time.day ? "Retest tomorrow" : "Road test"}</ConfirmButton>
            ) : <span className="pill green">Done</span>}
          </div>
        );
      })}
    </>
  );
}

/** Explains seasonal services (festivals, day trips) under a place's service list. */
export function serviceNote(serviceId: string, month: number, day: number): { available: boolean; note: string } | null {
  if (serviceId.startsWith("fest_")) {
    const f = FESTIVALS.find((x) => `fest_${x.id}` === serviceId)!;
    if (f.cycle42) {
      const d = ((6 - day) % 42 + 42) % 42;
      return { available: d === 0, note: d === 0 ? "Today is Akwasidae!" : `Next Akwasidae in ${d} days` };
    }
    const on = f.months.includes(month);
    return { available: on, note: on ? `On now · ${f.people}` : `${f.people} · ${f.months.map((m) => ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][m - 1]).join("/")}` };
  }
  if (serviceId.startsWith("trip_")) {
    const s = SITE_BY_ID[serviceId.slice(5)];
    return { available: true, note: `${REGIONS[s.region].name} Region · ${s.blurb}` };
  }
  return null;
}

// ---------------------------------------------------------------------------
// Home goods & furnishing (home sheet)

export function HomeGoods() {
  const { state, act, busy } = useGame();
  if (!state) return null;
  const f = state.furnishing;
  const furniture = state.items.filter((i) => ITEMS[i.itemId]?.comfort);
  const kitchen = state.items.some((i) => i.itemId === "gas_cooker" || i.itemId === "standing_cooker");
  return (
    <>
      <h3>Your things</h3>
      <div className="tiny muted">Furnishing {f.points} pts → +{f.bonus} comfort (every 6 points, max +3). Building comfort {f.base}.</div>
      <div className="row" style={{ flexWrap: "wrap", gap: 6, marginTop: 6 }}>
        {furniture.length === 0 && <span className="tiny muted">Empty room. Melcom, the mall and carpenters' rows sell furniture.</span>}
        {furniture.map((i) => <span key={i.id} className="pill" title={ITEMS[i.itemId].blurb}>{SLOT_ICON[ITEMS[i.itemId].slot]} {ITEMS[i.itemId].name}</span>)}
      </div>
      {kitchen && <button className="btn block" style={{ marginTop: 10 }} disabled={busy} onClick={() => act({ type: "cook" })}>🍳 Cook at home · ~{money(priceFor(14, state.player.district) * 100)} ingredients</button>}
    </>
  );
}

// ---------------------------------------------------------------------------
// Phone apps: Vibes (social), Farms, Garage & goods

export function VibesApp() {
  const { state, act, busy } = useGame();
  if (!state) return null;
  const s = state.social;
  const phone = state.items.map((i) => ITEMS[i.itemId]).filter((i) => i?.slot === "phone").sort((a, b) => (b.camera ?? 0) - (a.camera ?? 0))[0];
  return (
    <>
      <div className="card" style={{ background: "linear-gradient(135deg,#8e2de2,#f2b705)", color: "#fff" }}>
        <div className="spread"><b style={{ fontSize: 18 }}>@{state.player.name.toLowerCase().replace(/[^a-z0-9]+/g, "")}</b><span>{phone ? `📱 ${phone.name}` : "No smartphone"}</span></div>
        <div className="row" style={{ gap: 18, marginTop: 8 }}>
          <div><div style={{ fontSize: 22, fontWeight: 800 }}>{s.followers.toLocaleString()}</div><div className="tiny">followers</div></div>
          <div><div style={{ fontSize: 22, fontWeight: 800 }}>{s.posts}</div><div className="tiny">posts</div></div>
          <div><div style={{ fontSize: 22, fontWeight: 800 }}>{s.dailyDeal ? money(s.dailyDeal * 100) : "—"}</div><div className="tiny">brand deals/day</div></div>
        </div>
        <div className="tiny" style={{ marginTop: 6 }}>{s.followers < 5000 ? `Brand deals start at 5,000 followers (≈${money(influencerDaily(5000) * 100)}/day).` : "Brands pay daily into your bank."} {3 - s.postsToday} posts left today.</div>
      </div>
      {s.camera < 1 && <div className="notice warn" style={{ marginTop: 8 }}>You need a smartphone to post. Try a phone shop: Kopa K5 from GH₵1,400. Better cameras grow followers faster.</div>}
      <h3>New post</h3>
      {POST_TYPES.map((t) => (
        <div className="svc" key={t.id}>
          <div className="ic">{{ food: "🍛", skit: "🎭", outfit: "👗", trip: "🏞️", fest: "🥁", car: "🚘", home: "🏡", business: "📣" }[t.id]}</div>
          <div className="grow"><div className="bold">{t.name}</div><div className="tiny muted">{t.blurb}</div></div>
          <button className="btn primary sm" disabled={busy || s.camera < 1 || s.postsToday >= 3} onClick={() => act({ type: "social_post", kind: t.id })}>Post</button>
        </div>
      ))}
      {s.feed.length > 0 && <h3>Recent</h3>}
      {[...s.feed].reverse().slice(0, 8).map((f, i) => <div key={i} className="tiny muted">Day {f.day + 1} · {POST_TYPES.find((t) => t.id === f.kind)?.name} · +{f.gain.toLocaleString()}</div>)}
    </>
  );
}

export function FarmApp() {
  const { state, act, busy } = useGame();
  const [crop, setCrop] = useState<Record<number, string>>({});
  if (!state) return null;
  const month = state.time.month + 1;
  const owned = new Set(state.farms.map((f) => f.type));
  const here = state.player.district;
  return (
    <>
      {state.farms.length === 0 && <div className="notice warn">No farmland yet. Land is cheapest up north: Sawla from {money(18_000 * 100, true)}.</div>}
      {state.farms.map((f) => {
        const land = FARMLANDS[f.type];
        const atFarm = here === land.district;
        const seasonal = land.crops.filter((c) => { const m = CROPS[c].months; return m === "any" || m.includes(month); });
        const ready = f.status === "growing" && f.readyMin !== null && state.time.minute >= f.readyMin;
        const pick = crop[f.id] ?? seasonal[0];
        return (
          <div className="card" key={f.id} style={{ marginBottom: 10 }}>
            <b>{land.name}</b>
            <div className="tiny muted">{DISTRICTS[land.district].name} · {land.acres} acres · {f.harvests} harvests · earned {money(f.totalIncome, true)}</div>
            {f.status === "growing" && f.crop && (
              <div className="small" style={{ marginTop: 6 }}>🌱 {CROPS[f.crop].name} · {ready ? <b className="good">Ready to harvest!</b> : `ready ${toGameDate(f.readyMin!).label}`}{f.estimate ? ` · est. ${money(f.estimate, true)}` : ""}</div>
            )}
            {!atFarm && <div className="tiny bad" style={{ marginTop: 4 }}>Travel to {DISTRICTS[land.district].name} to work this farm.</div>}
            {f.status === "fallow" && (
              seasonal.length ? (
                <div className="row" style={{ marginTop: 8 }}>
                  <select className="input" value={pick} onChange={(e) => setCrop({ ...crop, [f.id]: e.target.value })}>
                    {seasonal.map((c) => <option key={c} value={c}>{CROPS[c].name} · {money(CROPS[c].costPerAcre * land.acres * 100, true)} · {CROPS[c].days}d</option>)}
                  </select>
                  <button className="btn primary sm" disabled={busy || !atFarm} onClick={() => act({ type: "farm_plant", farmRowId: f.id, crop: pick })}>Plant</button>
                </div>
              ) : <div className="tiny muted" style={{ marginTop: 6 }}>Nothing to plant this month. {land.crops.map((c) => `${CROPS[c].name}: ${CROPS[c].months === "any" ? "any time" : (CROPS[c].months as number[]).join(",")}`).join(" · ")}</div>
            )}
            {ready && <button className="btn primary block" style={{ marginTop: 8 }} disabled={busy || !atFarm} onClick={() => act({ type: "farm_harvest", farmRowId: f.id })}>Harvest & sell</button>}
          </div>
        );
      })}
      <h3>Farmland for sale</h3>
      {Object.values(FARMLANDS).map((l) => (
        <div className="list-item" key={l.id}>
          <div className="grow">
            <b>{l.name}</b>
            <div className="tiny muted">{DISTRICTS[l.district].name} · {l.acres} acres · {l.crops.map((c) => CROPS[c].name).join(", ")}</div>
            <div className="tiny muted">{l.blurb}</div>
            {here !== l.district && <div className="tiny bad">Buy in person at {DISTRICTS[l.district].name}</div>}
          </div>
          <ConfirmButton className="btn primary sm" disabled={busy || owned.has(l.id) || here !== l.district} ask={`Buy ${l.name}?`} details={{ where: DISTRICTS[l.district].name, cost: money(l.price * 100), changes: "You can plant and harvest here in season; harvests sell at the market.", undo: "Farmland can't be sold back in this version. It counts towards your net worth." }} onConfirm={() => act({ type: "farm_buy", farmId: l.id })}>{owned.has(l.id) ? "Yours" : money(l.price * 100, true)}</ConfirmButton>
        </div>
      ))}
    </>
  );
}

export function GarageApp() {
  const { state, act, busy } = useGame();
  if (!state) return null;
  const vs = state.vehicles as { id: number; type: string; status: string; condition: number; value: number; insuredUntil: number; repairCost: number; insureCost: number }[];
  return (
    <>
      <div className="tiny muted">Licences: {["licence_a", "licence_b"].filter((l) => state.player.unlocks.includes(l)).map((l) => (l === "licence_a" ? "A (motorbike/tricycle)" : "B (car)")).join(", ") || "none yet — driving schools at Kaneshie, KNUST, UDS and more"}</div>
      {vs.length === 0 && <div className="notice warn" style={{ marginTop: 8 }}>No vehicles. Tokunbo lot at Abossey Okai for cars, Tamale and Kintampo for motorbikes and pragyas, Prestige Autos in Trasacco for the dream cars.</div>}
      {vs.map((v) => {
        const def = VEHICLES[v.type];
        return (
          <div className="card" key={v.id} style={{ marginTop: 8 }}>
            <div className="spread"><b>{def.name}</b><span className="pill" style={{ background: def.color, color: "#fff" }}>{def.category}</span></div>
            <div className="tiny muted">Worth ~{money(v.value, true)} · condition <b className={v.condition < 40 ? "bad" : ""}>{v.condition}%</b>{v.status === "workpay" ? " · on work-and-pay" : ""}{def.category !== "bicycle" && def.category !== "aircraft" ? <> · {v.insuredUntil >= state.time.day ? `insured ${v.insuredUntil - state.time.day} more days` : <b className="bad">insurance expired</b>}</> : null}</div>
            <div className="row" style={{ marginTop: 8 }}>
              {def.workPay && <button className="btn sm" disabled={busy} onClick={() => act({ type: "vehicle_workpay", vehicleRowId: v.id, on: v.status !== "workpay" })}>{v.status === "workpay" ? "Take it back" : `Work-and-pay (~${money(def.workPay * 100)}/day)`}</button>}
              {def.category !== "aircraft" && v.repairCost > 0 && <ConfirmButton className="btn sm" disabled={busy} ask="Service this vehicle?" details={{ where: "The fitters by any lorry station", time: `About ${Math.round((60 + (100 - v.condition) * 2) / 60 * 10) / 10} hours`, cost: money(v.repairCost), changes: "Condition back to 100%: no breakdowns, better resale, steadier work-and-pay.", undo: "No." }} onConfirm={() => act({ type: "vehicle_repair", vehicleId: v.id })}>🔧 Service · {money(v.repairCost, true)}</ConfirmButton>}
              {def.category !== "aircraft" && def.category !== "bicycle" && <ConfirmButton className="btn sm" disabled={busy} ask="Insure for a year?" details={{ time: "Done on your phone", cost: money(v.insureCost), changes: "Third-party insurance and a roadworthy sticker for another year. Police check them at barriers.", undo: "No refund." }} onConfirm={() => act({ type: "vehicle_insure", vehicleId: v.id })}>🛡️ Insure · {money(v.insureCost, true)}</ConfirmButton>}
              <ConfirmButton className="btn sm danger" disabled={busy} ask="Sell this vehicle?" details={{ cost: `You get about ${money(Math.round(v.value * 0.85))}`, changes: "The money goes to your bank and the vehicle is gone (and any work-and-pay driver with it).", undo: "No. You'd have to buy one again at full price." }} onConfirm={() => act({ type: "vehicle_sell", vehicleRowId: v.id })}>Sell</ConfirmButton>
            </div>
          </div>
        );
      })}
      <h3>Your goods</h3>
      {state.items.length === 0 && <div className="tiny muted">Nothing yet.</div>}
      {state.items.map((i) => (
        <div className="list-item" key={i.id}>
          <div className="grow"><b>{SLOT_ICON[ITEMS[i.itemId]?.slot] ?? ""} {ITEMS[i.itemId]?.name}</b><div className="tiny muted">Paid {money(i.price)}</div></div>
          <ConfirmButton className="btn sm" disabled={busy} ask={`Sell ${ITEMS[i.itemId]?.name ?? "this"}?`} details={{ cost: `You get ${money(Math.round(i.price * 0.4))} (40%)`, changes: "It leaves your home; comfort may drop.", undo: "Only by buying a new one at full price." }} onConfirm={() => act({ type: "item_sell", itemRowId: i.id })}>Sell</ConfirmButton>
        </div>
      ))}
    </>
  );
}

export function GhanaApp() {
  const { state } = useGame();
  const [region, setRegion] = useState<RegionId | null>(null);
  if (!state) return null;
  const disc = state.player.discovered;
  const visitedCities = new Set(state.player.visited.map((d) => DISTRICTS[d]?.city));
  return (
    <>
      <CountryMap here={state.player.district} height={300} />
      <div className="tiny muted" style={{ marginTop: 6 }}>
        Regions {new Set([...visitedCities].map((c) => TOWN_BY_ID[c!]?.region)).size}/16 · Day trips {disc.filter((d) => d.startsWith("site:")).length}/{SITES.length} · Festivals {disc.filter((d) => d.startsWith("fest:")).length}/{FESTIVALS.length} · Dishes {disc.filter((d) => d.startsWith("dish:")).length}
      </div>
      <h3>Regions</h3>
      {Object.values(REGIONS).map((r) => (
        <div key={r.id} className="card" style={{ marginBottom: 6, cursor: "pointer" }} onClick={() => setRegion(region === r.id ? null : r.id)}>
          <div className="spread"><b>{r.name}</b><span className="tiny muted">capital {TOWN_BY_ID[r.capital].name}</span></div>
          <div className="tiny muted">{r.character}</div>
          {region === r.id && (
            <div style={{ marginTop: 6 }}>
              <div className="tiny"><b>Towns:</b> {TOWNS.filter((t) => t.region === r.id).map((t) => t.name).join(", ")}</div>
              <div className="tiny" style={{ marginTop: 4 }}><b>See:</b> {SITES.filter((s) => s.region === r.id).map((s) => `${disc.includes(`site:${s.id}`) ? "✅" : "•"} ${s.name}`).join("  ") || "—"}</div>
              <div className="tiny" style={{ marginTop: 4 }}><b>Festivals:</b> {FESTIVALS.filter((f) => f.districts.some((d) => TOWN_BY_ID[DISTRICTS[d]?.city]?.region === r.id)).map((f) => f.name).join(", ") || "—"}</div>
              <div className="tiny" style={{ marginTop: 4 }}><b>Play in:</b> {Object.values(DISTRICTS).filter((d) => TOWN_BY_ID[d.city]?.region === r.id).map((d) => d.name).join(", ")}</div>
            </div>
          )}
        </div>
      ))}
    </>
  );
}

export const placeIsStore = (p: Place) => stockFor(p.id, p.kind).length > 0;
export { PLACE_BY_ID };
