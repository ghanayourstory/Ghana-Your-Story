// Aviation: book scheduled flights (compared with the road), manage your
// trips (check in, boarding pass, changes, refunds), charter an aircraft, and
// run your own. All prices are game prices in GH₵; timetables are game
// simulation. Every action is checked and charged by the game itself.

import { useMemo, useState } from "react";
import { useGame } from "../store.tsx";
import { money } from "./common.tsx";
import { AIRCRAFT_SPECS, AIRPORTS_GH, AIRPORT_BY_ID, FLIGHT_RULES, ROUTES, cancelRefund, canUse, charterQuoteOf, flightLeg, weeklyCost } from "../../shared/aviation.ts";
import { CITIES, intercityQuote } from "../../shared/cities.ts";
import { DISTRICTS, districtsIn, travelQuote } from "../../shared/world.ts";
import { VEHICLES } from "../../shared/life.ts";
import { toGameDate } from "../../shared/calendar.ts";

type GS = NonNullable<ReturnType<typeof useGame>["state"]>;
type Dep = GS["aviation"]["departures"][number];
type Booking = GS["aviation"]["bookings"][number];

const when = (min: number) => { const g = toGameDate(min); return `${g.label} · ${g.clock}`; };
const dur = (m: number) => (m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`);
const cityOf = (airportId: string) => CITIES[AIRPORT_BY_ID[airportId].city]?.name ?? AIRPORT_BY_ID[airportId].city;
const STATUS_LABEL: Record<string, string> = { booked: "Booked", checked_in: "Checked in", flown: "Flown", missed: "Missed", refunded: "Refunded", cancelled: "Cancelled" };

export function AviationApp() {
  const { state } = useGame();
  const [tab, setTab] = useState<"flights" | "trips" | "charter" | "mine" | "airports">("flights");
  if (!state) return null;
  const mine = state.aviation.aircraft.length > 0;
  const active = state.aviation.bookings.filter((b) => b.status === "booked" || b.status === "checked_in").length;
  return (
    <div>
      <div className="tabs" role="tablist">
        <button role="tab" aria-selected={tab === "flights"} className={tab === "flights" ? "on" : ""} onClick={() => setTab("flights")}>Flights</button>
        <button role="tab" aria-selected={tab === "trips"} className={tab === "trips" ? "on" : ""} onClick={() => setTab("trips")}>My trips{active ? ` (${active})` : ""}</button>
        <button role="tab" aria-selected={tab === "charter"} className={tab === "charter" ? "on" : ""} onClick={() => setTab("charter")}>Charter</button>
        {mine && <button role="tab" aria-selected={tab === "mine"} className={tab === "mine" ? "on" : ""} onClick={() => setTab("mine")}>My aircraft</button>}
        <button role="tab" aria-selected={tab === "airports"} className={tab === "airports" ? "on" : ""} onClick={() => setTab("airports")}>Airports</button>
      </div>
      {tab === "flights" && <FlightsPanel />}
      {tab === "trips" && <TripsPanel />}
      {tab === "charter" && <CharterPanel />}
      {tab === "mine" && mine && <MyAircraftPanel />}
      {tab === "airports" && <AirportsPanel />}
    </div>
  );
}

/** Scheduled flights from where you are, compared with going by road. */
export function FlightsPanel({ toCity: initialTo }: { toCity?: string }) {
  const { state } = useGame();
  const [to, setTo] = useState<string | null>(initialTo ?? null);
  const [pick, setPick] = useState<Dep | null>(null);
  if (!state) return null;
  const here = DISTRICTS[state.player.district].city;
  const deps = state.aviation.departures;
  const dests = [...new Set(deps.map((d) => AIRPORT_BY_ID[d.dest].city))];
  // Routes from here that exist but can't be booked, with why.
  const blocked = ROUTES.filter((r) => r.status !== "operating" && (AIRPORT_BY_ID[r.from].city === here || AIRPORT_BY_ID[r.to].city === here));
  if (pick) return <BookFlight dep={pick} onBack={() => setPick(null)} />;
  const list = deps.filter((d) => !to || AIRPORT_BY_ID[d.dest].city === to).slice(0, 24);
  return (
    <div>
      {!dests.length && (
        <div className="notice">No scheduled flights leave {CITIES[here]?.name ?? "here"} in the game. Scheduled routes run between Accra and Kumasi, Tamale and Takoradi. You can still charter an aircraft, or go by road.</div>
      )}
      {dests.length > 0 && (
        <div className="chipset" style={{ marginTop: 6 }}>
          <button className={`chip ${!to ? "on" : ""}`} onClick={() => setTo(null)}>All</button>
          {dests.map((c) => <button key={c} className={`chip ${to === c ? "on" : ""}`} onClick={() => setTo(c)}>{CITIES[c]?.name ?? c}</button>)}
        </div>
      )}
      {to && <Compare from={here} to={to} deps={deps.filter((d) => AIRPORT_BY_ID[d.dest].city === to)} />}
      {list.map((d) => {
        const g = toGameDate(d.depMin);
        return (
          <div className="svc" key={`${d.routeId}-${d.day}-${d.slot}`}>
            <div className="grow">
              <div className="bold">{g.clock} → {cityOf(d.dest)} <span className="tiny muted">· {g.label}</span></div>
              <div className="tiny muted">{d.carrier} · {dur(d.minutes)} · {d.km} km · {money(d.fare * 100)}</div>
              <div className={`tiny ${d.cancelled ? "bad" : d.delay ? "warn" : "good"}`}>{d.cancelled ? `Cancelled: ${d.reason}` : d.delay ? `Delayed ${d.delay} min: ${d.reason}` : "On time"}</div>
            </div>
            <button className="btn sm primary" disabled={d.cancelled} onClick={() => setPick(d)} aria-label={`Book the ${g.clock} flight to ${cityOf(d.dest)}`}>{d.cancelled ? "Cancelled" : "Choose"}</button>
          </div>
        );
      })}
      {blocked.length > 0 && (
        <>
          <h3>Not bookable</h3>
          {blocked.map((r) => {
            const other = AIRPORT_BY_ID[r.from].city === here ? r.to : r.from;
            return (
              <div className="svc" key={r.id}>
                <div className="grow">
                  <div className="bold">{cityOf(other)}</div>
                  <div className="tiny muted">{r.status === "suspended" ? "Service suspended" : "We couldn't confirm this route is flying"} · source: {r.source.ref}, checked {r.source.reviewed}. Go by road or charter.</div>
                </div>
              </div>
            );
          })}
        </>
      )}
      <div className="tiny muted" style={{ marginTop: 8 }}>Departure times, fares, carriers and delays are game simulation, not real airline schedules or prices. Which routes fly is based on public sources (see Airports).</div>
    </div>
  );
}

/** Flight versus bus and coach for one trip. */
function Compare({ from, to, deps }: { from: string; to: string; deps: Dep[] }) {
  const { state } = useGame();
  if (!state) return null;
  const next = deps.find((d) => !d.cancelled);
  const rows: { name: string; minutes: number; fare: number; note: string }[] = [];
  for (const m of ["bus", "vip"] as const) {
    const q = intercityQuote(from, to, m);
    if (q) rows.push({ name: m === "bus" ? "🚌 Intercity bus" : "🚍 VIP coach", minutes: q.minutes, fare: q.fare, note: "Leaves when full, from the lorry station" });
  }
  if (next) {
    const wait = Math.max(0, next.depMin - state.time.minute);
    rows.push({ name: "✈️ Next flight", minutes: next.minutes + 60 + FLIGHT_RULES.baggageMinutes, fare: next.fare, note: `Leaves in ${dur(wait)}; time includes an hour at the airport before departure` });
  }
  return (
    <div className="compare" style={{ marginTop: 8 }}>
      <div className="tiny muted">Ways to get to {CITIES[to]?.name ?? to} (journey time once you set off; game time)</div>
      {rows.map((r) => (
        <div className="row spread tiny" key={r.name} style={{ padding: "4px 0", borderBottom: "1px solid rgba(0,0,0,0.06)" }}>
          <span className="bold">{r.name}</span><span>{dur(r.minutes)}</span><span>{money(r.fare * 100)}</span>
          <span className="muted" style={{ flexBasis: "100%" }}>{r.note}</span>
        </div>
      ))}
    </div>
  );
}

/** Everything about a flight before you pay. */
function BookFlight({ dep, onBack }: { dep: Dep; onBack: () => void }) {
  const { state, act, busy } = useGame();
  const [bags, setBags] = useState(false);
  const [ins, setIns] = useState(false);
  const [transfer, setTransfer] = useState(true);
  const [done, setDone] = useState<string | null>(null);
  if (!state) return null;
  const origin = AIRPORT_BY_ID[dep.origin], dest = AIRPORT_BY_ID[dep.dest];
  const route = ROUTES.find((r) => r.id === dep.routeId.replace(/:r$/, ""))!;
  const g = toGameDate(state.time.minute);
  const tr = origin.district ? (state.player.district === origin.district ? { fare: 0, minutes: 0 } : travelQuote(state.player.district, origin.district, "ride", g.hour, g.weekdayIndex, false)) : { fare: 60, minutes: 35 };
  const needTransfer = !origin.district; // towns where the terminal is off-map
  const useTransfer = (transfer || needTransfer) && tr.fare > 0;
  const fare = dep.fare * 100, bag = bags ? FLIGHT_RULES.checkedBag * 100 : 0, insurance = ins ? Math.round(dep.fare * FLIGHT_RULES.insuranceRate) * 100 : 0, trm = useTransfer ? tr.fare * 100 : 0;
  const total = fare + bag + insurance + trm;
  const spendable = state.money.cash + state.money.bank + state.money.momo;
  const journey = (useTransfer ? tr.minutes : 0) + 60 + dep.minutes + (bags ? FLIGHT_RULES.baggageMinutes : 5);
  if (done) return (
    <div>
      <div className="notice good">🎫 Booked: {done}. Check in from 24 hours before (My trips). Your boarding pass appears after check-in.</div>
      <button className="btn block" onClick={onBack}>Back to flights</button>
    </div>
  );
  return (
    <div>
      <button className="btn sm ghost" onClick={onBack}>← Flights</button>
      <h3>{cityOf(dep.origin)} → {cityOf(dep.dest)}</h3>
      <dl className="facts">
        <dt>From</dt><dd>{origin.name}{origin.iata ? ` (${origin.iata})` : ""}</dd>
        <dt>To</dt><dd>{dest.name}{dest.iata ? ` (${dest.iata})` : ""}</dd>
        <dt>Departs</dt><dd>{when(dep.depMin)} (game time, Ghana time GMT){dep.delay ? <span className="warn"> · now {dep.delay} min late: {dep.reason}</span> : ""}</dd>
        <dt>Flight</dt><dd>{dur(dep.minutes)} in the air and taxiing · {dep.km} km · {dep.carrier}</dd>
        <dt>Route status</dt><dd>Operating · source: {route.source.ref} (checked {route.source.reviewed})</dd>
        <dt>Baggage</dt><dd>One 7 kg cabin bag included. Checked bag {money(FLIGHT_RULES.checkedBag * 100)} (collected at the belt, ~{FLIGHT_RULES.baggageMinutes} min).</dd>
        <dt>Accessibility</dt><dd>{origin.accessibility.join("; ")}</dd>
        <dt>Rules</dt><dd>Check in online 24 h to 1 h before; the gate closes {FLIGHT_RULES.gateCloseMin} min before take-off. Cancel 24 h+ ahead: {FLIGHT_RULES.refundEarly * 100}% back; later: {FLIGHT_RULES.refundLate * 100}%. Miss it: {FLIGHT_RULES.refundMissed * 100}% (airport charges). Airline cancels: full refund or a free change.</dd>
      </dl>
      <label className="row" style={{ gap: 8, marginTop: 6 }}><input type="checkbox" checked={bags} onChange={(e) => setBags(e.target.checked)} /> Checked bag · {money(FLIGHT_RULES.checkedBag * 100)}</label>
      <label className="row" style={{ gap: 8 }}><input type="checkbox" checked={ins} onChange={(e) => setIns(e.target.checked)} /> Travel insurance · {money(Math.round(dep.fare * FLIGHT_RULES.insuranceRate) * 100)} (full refund if you cancel or miss it)</label>
      {tr.fare > 0 && <label className="row" style={{ gap: 8 }}><input type="checkbox" checked={useTransfer} disabled={needTransfer} onChange={(e) => setTransfer(e.target.checked)} /> Transfer to the airport · {money(tr.fare * 100)}, ~{dur(tr.minutes)}{needTransfer ? " (needed: the terminal is outside town)" : ""}</label>}
      {!tr.fare && <div className="tiny good">You're at the airport.</div>}
      <div className="receipt">
        <div className="row spread"><span>Fare</span><span>{money(fare)}</span></div>
        {bag > 0 && <div className="row spread"><span>Checked bag</span><span>{money(bag)}</span></div>}
        {insurance > 0 && <div className="row spread"><span>Insurance</span><span>{money(insurance)}</span></div>}
        {trm > 0 && <div className="row spread"><span>Airport transfer</span><span>{money(trm)}</span></div>}
        <div className="row spread bold"><span>Total</span><span>{money(total)}</span></div>
        <div className="tiny muted">Door to door about {dur(journey)} once you leave (transfer, an hour at the airport, the flight{bags ? ", the bag belt" : ""}). Waiting time passes in the game; nothing happens in real time.</div>
      </div>
      {spendable < total && <div className="tiny bad">Not enough money across cash, MoMo and bank.</div>}
      <button className="btn primary block" disabled={busy || spendable < total} onClick={async () => {
        const r = await act({ type: "flight", op: "book", routeId: dep.routeId, day: dep.day, slot: dep.slot, bags, insurance: ins, transfer: useTransfer, expect: total });
        if (r.ok) setDone((r.data as { ref: string }).ref);
      }}>Confirm and pay {money(total)}</button>
    </div>
  );
}

function TripsPanel() {
  const { state, act, busy } = useGame();
  const [changing, setChanging] = useState<Booking | null>(null);
  const [cancelling, setCancelling] = useState<Booking | null>(null);
  if (!state) return null;
  const now = state.time.minute;
  const city = DISTRICTS[state.player.district].city;
  const list = state.aviation.bookings;
  if (!list.length) return <div className="muted" style={{ marginTop: 8 }}>No trips yet. Book one under Flights.</div>;
  if (changing) {
    const later = state.aviation.departures.filter((d) => d.routeId === changing.routeId && d.depMin > changing.depMin && !d.cancelled).slice(0, 8);
    const fee = changing.cancelled ? 0 : Math.round(changing.fare * FLIGHT_RULES.changeFeeRate);
    return (
      <div>
        <button className="btn sm ghost" onClick={() => setChanging(null)}>← My trips</button>
        <h3>Change {changing.ref}</h3>
        <div className="tiny">{fee ? `Change fee ${money(fee)}.` : "Free (the airline cancelled your flight)."} You'll need to check in again.</div>
        {!later.length && <div className="muted">No later flights in the next week.</div>}
        {later.map((d) => (
          <div className="svc" key={`${d.day}-${d.slot}`}>
            <div className="grow"><div className="bold">{when(d.depMin)}</div><div className="tiny muted">{d.delay ? `Delayed ${d.delay} min` : "On time"}</div></div>
            <button className="btn sm primary" disabled={busy} onClick={async () => { const r = await act({ type: "flight", op: "change", bookingId: changing.id, day: d.day, slot: d.slot }); if (r.ok) setChanging(null); }}>Move to this{fee ? ` · ${money(fee)}` : ""}</button>
          </div>
        ))}
      </div>
    );
  }
  return (
    <div style={{ marginTop: 6 }}>
      {list.map((b) => {
        const dep = b.depMin + b.delay;
        const open = b.status === "booked" || b.status === "checked_in";
        const canCheck = b.status === "booked" && !b.cancelled && now >= b.depMin - FLIGHT_RULES.checkinOpenMin && now <= dep - FLIGHT_RULES.checkinCloseMin;
        const origin = AIRPORT_BY_ID[b.origin];
        const atCity = city === origin.city;
        const canBoard = b.status === "checked_in" && !b.cancelled && atCity && now <= dep - FLIGHT_RULES.gateCloseMin;
        const refund = cancelRefund(b, now);
        const phase = !open ? STATUS_LABEL[b.status] : b.cancelled ? "Cancelled by the airline" : now > dep - FLIGHT_RULES.gateCloseMin ? "Gate closed" : now >= dep - FLIGHT_RULES.boardingOpenMin ? "Boarding" : b.delay ? `Delayed ${b.delay} min` : "On time";
        return (
          <div className="trip" key={b.id}>
            <div className="row spread"><b>{b.ref} · {cityOf(b.origin)} → {cityOf(b.dest)}</b><span className={`pill ${b.cancelled || b.status === "missed" ? "bad" : ""}`}>{phase}</span></div>
            <div className="tiny muted">{when(b.depMin)}{b.delay ? ` → now ${toGameDate(dep).clock}` : ""} · paid {money(b.fare + b.bagFee + b.insurance + b.transfer)}{b.insurance ? " · insured" : ""}{b.bags ? " · 1 checked bag" : ""}{b.transfer ? " · transfer booked" : ""}</div>
            {b.cancelled && open && <div className="tiny bad">Cancelled: {b.reason}. Take a full refund, or change to another flight for free.</div>}
            {b.status === "checked_in" && !b.cancelled && (
              <div className="boarding-pass" aria-label="Boarding pass">
                <div><span className="tiny muted">Passenger</span><b>{state.player.name}</b></div>
                <div><span className="tiny muted">Flight</span><b>{b.ref}</b></div>
                <div><span className="tiny muted">Gate (game)</span><b>{2 + (b.slot % 5)}</b></div>
                <div><span className="tiny muted">Boarding</span><b>{toGameDate(dep - FLIGHT_RULES.boardingOpenMin).clock}</b></div>
                <div><span className="tiny muted">Gate closes</span><b>{toGameDate(dep - FLIGHT_RULES.gateCloseMin).clock}</b></div>
              </div>
            )}
            {b.note && <div className="tiny">{b.note}{b.refund ? ` · refunded ${money(b.refund)}` : ""}</div>}
            {open && (
              <div className="row" style={{ gap: 6, flexWrap: "wrap", marginTop: 6 }}>
                {b.status === "booked" && !b.cancelled && <button className="btn sm primary" disabled={busy || !canCheck} title={canCheck ? "" : "Check-in is open from 24 h to 1 h before departure"} onClick={() => void act({ type: "flight", op: "checkin", bookingId: b.id })}>Check in{!canCheck && now < b.depMin - FLIGHT_RULES.checkinOpenMin ? ` (opens ${toGameDate(b.depMin - FLIGHT_RULES.checkinOpenMin).clock} ${toGameDate(b.depMin - FLIGHT_RULES.checkinOpenMin).label})` : ""}</button>}
                {b.status === "checked_in" && <button className="btn sm primary" disabled={busy || !canBoard} title={atCity ? "" : `Be in ${cityOf(b.origin)} to board`} onClick={() => void act({ type: "flight", op: "board", bookingId: b.id })}>{now < dep - FLIGHT_RULES.boardingOpenMin ? `Go to the gate (wait until ${toGameDate(dep - FLIGHT_RULES.boardingOpenMin).clock})` : "Board now"}</button>}
                <button className="btn sm" disabled={busy} onClick={() => setChanging(b)}>Change flight</button>
                <button className="btn sm ghost" disabled={busy} onClick={() => setCancelling(b)}>{b.cancelled ? "Full refund" : "Cancel…"}</button>
              </div>
            )}
            {cancelling?.id === b.id && (
              <div className="place-bar warn" role="alertdialog">
                <div className="grow tiny">Cancel {b.ref}? You get back <b>{money(refund)}</b> to your bank{b.cancelled ? " (airline cancellation: everything)" : b.insurance ? " (insured: the full fare)" : b.depMin - now >= FLIGHT_RULES.earlyHours * 60 ? " (90% of fare and bag, transfer in full)" : " (50% of fare and bag, transfer in full)"}.</div>
                <button className="btn sm primary" disabled={busy} onClick={async () => { const r = await act({ type: "flight", op: "cancel", bookingId: b.id, expect: refund }); if (r.ok) setCancelling(null); }}>Refund {money(refund)}</button>
                <button className="btn sm ghost" onClick={() => setCancelling(null)}>Keep it</button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function CharterPanel() {
  const { state, act, busy } = useGame();
  const [type, setType] = useState("prop_plane");
  const [to, setTo] = useState("");
  if (!state) return null;
  const spec = AIRCRAFT_SPECS[type];
  const city = DISTRICTS[state.player.district].city;
  const from = AIRPORTS_GH.filter((x) => x.city === city && canUse(spec, x)).sort((a, b) => (a.district === state.player.district ? -1 : b.district === state.player.district ? 1 : 0))[0];
  const dests = AIRPORTS_GH.filter((x) => x.id !== from?.id && canUse(spec, x));
  const q = from && to ? charterQuoteOf(spec, from.id, to, state.time.minute) : null;
  const spendable = state.money.cash + state.money.bank + state.money.momo;
  return (
    <div style={{ marginTop: 6 }}>
      <div className="tiny muted">The whole aircraft, just for you, leaving soon. Game prices; operators are based at Kotoka, so they fly to you first if you're elsewhere.</div>
      <div className="cards" style={{ display: "grid", gridTemplateColumns: "1fr", gap: 6, marginTop: 6 }}>
        {Object.values(AIRCRAFT_SPECS).map((s) => (
          <button key={s.type} className={`card-item ${type === s.type ? "on" : ""}`} aria-pressed={type === s.type} onClick={() => { setType(s.type); setTo(""); }}>
            <b>{VEHICLES[s.type]?.name ?? s.type}</b>
            <span className="tiny muted">{s.seats} seats · {s.cargoKg} kg cargo · range {s.rangeKm.toLocaleString()} km · {Math.round(s.speedKmh)} km/h</span>
            <span className="tiny">{money(s.charterPerKm * 100)}/km, minimum {money(s.charterMin * 100)} + landing fees {money(s.landingFee * 100)} each end</span>
            <span className="tiny muted">{s.noise}{s.daylightOnly ? " Daylight only." : ""}</span>
          </button>
        ))}
      </div>
      {!from && <div className="notice">No airport or helipad here that this aircraft can use. Get to one first (Accra, Kumasi, Tamale, Takoradi, Wa, Ho or Sunyani).</div>}
      {from && (
        <>
          <label className="tiny muted" htmlFor="charter-to">From {from.name} to</label>
          <select id="charter-to" className="input" value={to} onChange={(e) => setTo(e.target.value)}>
            <option value="">Choose a destination</option>
            {dests.map((d) => <option key={d.id} value={d.id}>{d.name} · {CITIES[d.city]?.name ?? d.city}</option>)}
          </select>
        </>
      )}
      {q && !q.ok && <div className="tiny bad" role="alert">{q.error}</div>}
      {q && q.ok && (
        <div className="receipt">
          <div className="row spread"><span>Flying ({q.q.km} km)</span><span>{money(q.q.flying * 100)}</span></div>
          {q.q.positioning > 0 && <div className="row spread"><span>Positioning from Kotoka</span><span>{money(q.q.positioning * 100)}</span></div>}
          <div className="row spread"><span>Landing fees</span><span>{money(q.q.landing * 100)}</span></div>
          <div className="row spread bold"><span>Total</span><span>{money(q.q.total * 100)}</span></div>
          <div className="tiny muted">Wait about {dur(q.q.wait)} for the crew and aircraft, then {dur(q.q.minutes)} in the air (game time). One price, no recurring costs.</div>
          <button className="btn primary block" disabled={busy || spendable < q.q.total * 100} onClick={() => void act({ type: "charter", aircraft: type, to, expect: q.q.total * 100 })}>Charter for {money(q.q.total * 100)}</button>
        </div>
      )}
    </div>
  );
}

function MyAircraftPanel() {
  const { state, act, busy } = useGame();
  const [dest, setDest] = useState<Record<number, string>>({});
  const [selling, setSelling] = useState<number | null>(null);
  if (!state) return null;
  const now = state.time.minute;
  return (
    <div style={{ marginTop: 6 }}>
      {state.aviation.aircraft.map((a) => {
        const spec = AIRCRAFT_SPECS[a.type];
        const at = AIRPORT_BY_ID[a.location];
        const busyPlane = a.readyMin > now;
        const here = DISTRICTS[state.player.district].city === at.city && (at.type !== "helipad" || state.player.district === at.district);
        const to = dest[a.id] ?? "";
        const leg = to ? flightLeg(at.id, to, spec.speedKmh) : null;
        const tripCost = leg ? Math.round(spec.fuelPerKm * leg.km) + spec.landingFee : 0;
        return (
          <div className="trip" key={a.id}>
            <div className="row spread"><b>{a.name}</b><span className="pill">{busyPlane ? `On its way · ready ${toGameDate(a.readyMin).clock}` : `At ${at.name}`}</span></div>
            <div className="tiny muted">{spec.seats} seats · range {spec.rangeKm.toLocaleString()} km · {spec.crew}</div>
            <div className="tiny">Every week: crew {money(spec.weekly.crew * 100)}, hangar/parking {money(spec.weekly.hangar * 100)}, insurance {money(spec.weekly.insurance * 100)}, maintenance {money(spec.weekly.maintenance * 100)} = <b>{money(weeklyCost(spec) * 100)}</b> (charged daily from your bank).</div>
            <div className="tiny">Each trip: fuel {money(spec.fuelPerKm * 100)}/km + landing {money(spec.landingFee * 100)}. A broker would pay about {money(a.value)} today.</div>
            <select className="input" aria-label={`Destination for your ${a.name}`} value={to} onChange={(e) => setDest({ ...dest, [a.id]: e.target.value })}>
              <option value="">Choose a destination</option>
              {AIRPORTS_GH.filter((x) => x.id !== at.id && canUse(spec, x)).map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
            </select>
            {leg && <div className="tiny">{leg.km} km, {dur(leg.minutes)} · fuel and landing {money(tripCost * 100)}{leg.km > spec.rangeKm ? <span className="bad"> · out of range</span> : ""}</div>}
            <div className="row" style={{ gap: 6, flexWrap: "wrap", marginTop: 4 }}>
              <button className="btn sm primary" disabled={busy || !to || busyPlane || !here} title={here ? "" : `It's at ${at.name}: go there or send the crew to bring it`} onClick={() => void act({ type: "aircraft", op: "fly", vehicleId: a.id, to })}>Fly there yourself{tripCost ? ` · ${money(tripCost * 100)}` : ""}</button>
              <button className="btn sm" disabled={busy || !to || busyPlane} onClick={() => void act({ type: "aircraft", op: "reposition", vehicleId: a.id, to })}>Send the crew to fly it there (empty)</button>
              <button className="btn sm ghost" disabled={busy} onClick={() => setSelling(a.id)}>Sell…</button>
            </div>
            {!here && <div className="tiny muted">It stays where it last landed. To fly it from somewhere else, send the crew first (costs fuel and landing; it arrives after the flight time).</div>}
            {selling === a.id && (
              <div className="place-bar warn" role="alertdialog">
                <div className="grow tiny">Sell your {a.name} for about <b>{money(a.value)}</b>? Weekly costs stop.</div>
                <button className="btn sm primary" disabled={busy} onClick={async () => { const r = await act({ type: "vehicle_sell", vehicleId: a.id }); if (r.ok) setSelling(null); }}>Sell</button>
                <button className="btn sm ghost" onClick={() => setSelling(null)}>Keep it</button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function AirportsPanel() {
  return (
    <div style={{ marginTop: 6 }}>
      {AIRPORTS_GH.map((a) => (
        <div className="trip" key={a.id}>
          <div className="row spread"><b>{a.name}{a.iata ? ` (${a.iata})` : ""}</b><span className={`pill ${a.status === "operating" ? "" : "warn"}`}>{a.status === "operating" ? "Operating" : a.status === "limited" ? "No scheduled flights" : "Closed"}</span></div>
          <div className="tiny muted">{CITIES[a.city]?.name ?? a.city}, {a.region} · {a.type}{a.fictional ? " · fictional (game only)" : ""}</div>
          <div className="tiny">{a.statusNote}</div>
          <div className="tiny muted">Services: {a.services.join(", ")} · Facilities: {a.facilities.join(", ")}</div>
          <div className="tiny muted">Source: {a.source.ref} · checked {a.source.reviewed} · {a.source.confidence}</div>
        </div>
      ))}
    </div>
  );
}

/** At the airport itself: today's departures board and your trips. */
export function AirportDesk() {
  const { state } = useGame();
  const deps = useMemo(() => state?.aviation.departures.filter((d) => d.day === state.time.day).slice(0, 10) ?? [], [state]);
  if (!state) return null;
  return (
    <div>
      <h3>🛫 Departures today</h3>
      {!deps.length && <div className="muted">No more departures today.</div>}
      <div className="board" role="table" aria-label="Departures">
        {deps.map((d) => (
          <div className="row spread tiny" role="row" key={`${d.routeId}-${d.slot}`} style={{ padding: "3px 0" }}>
            <span role="cell" className="bold">{toGameDate(d.depMin).clock}</span>
            <span role="cell">{cityOf(d.dest)}</span>
            <span role="cell" className="muted">{d.carrier}</span>
            <span role="cell" className={d.cancelled ? "bad" : d.delay ? "warn" : "good"}>{d.cancelled ? "Cancelled" : d.delay ? `Delayed ${d.delay}m` : "On time"}</span>
          </div>
        ))}
      </div>
      <div className="tiny muted">Timetable is game simulation. Book, check in and board in Phone → Aviation, or below.</div>
      <TripsPanel />
    </div>
  );
}

void districtsIn;
