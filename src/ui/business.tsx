// A business's books at a glance: sales vs costs, profit or loss, what
// happened each day, marketing, and moving money from the till to the bank.
// All game simulation; the game records every day and every transfer.

import { useState } from "react";
import { useGame } from "../store.tsx";
import { ConfirmButton, money } from "./common.tsx";
import { toGameDate } from "../../shared/calendar.ts";
import { BUSINESSES } from "../../shared/economy.ts";
import { FARE_LEVELS, FLEET_ROUTES } from "../../shared/fleet.ts";
import { VEHICLES } from "../../shared/life.ts";
import { DISTRICTS } from "../../shared/world.ts";

type GS = NonNullable<ReturnType<typeof useGame>["state"]>;
type Biz = GS["businesses"][number];

const MARKETING = {
  flyers: { name: "Flyers and a banner", price: 150, days: 3, boost: [4, 10] },
  social: { name: "Social media push", price: 400, days: 4, boost: [5, 15] },
  radio: { name: "Local radio ads", price: 900, days: 5, boost: [8, 18] },
} as const;

export function BizBooks({ b }: { b: Biz }) {
  const { state, act, busy } = useGame();
  const [open, setOpen] = useState(false);
  if (!state) return null;
  const t = BUSINESSES[b.type];
  const days = b.books.slice(-7);
  const sum = (k: "revenue" | "goods" | "wages" | "rent" | "utilities" | "upkeep" | "profit") => days.reduce((s, d) => s + d[k], 0);
  const rev = sum("revenue"), cost = rev - sum("profit");
  const gross = rev - sum("goods");
  const running = b.promoUntil >= state.time.day;
  return (
    <div style={{ marginTop: 8 }}>
      <div className="receipt">
        <div className="tiny muted">Last {days.length || 0} day{days.length === 1 ? "" : "s"} (books close each midnight; takings go into the till)</div>
        <div className="row spread"><span>Sales (revenue)</span><b>{money(rev)}</b></div>
        <div className="row spread"><span>Stock & materials</span><span>−{money(sum("goods"))}</span></div>
        <div className="row spread"><span>Gross margin</span><span>{money(gross)}{rev ? ` (${Math.round((gross / rev) * 100)}%)` : ""}</span></div>
        <div className="row spread"><span>Wages</span><span>−{money(sum("wages"))}</span></div>
        <div className="row spread"><span>Rent</span><span>−{money(sum("rent"))}</span></div>
        <div className="row spread"><span>Utilities (incl. generator fuel)</span><span>−{money(sum("utilities"))}</span></div>
        <div className="row spread"><span>Upkeep</span><span>−{money(sum("upkeep"))}</span></div>
        {days.some((d) => d.events.some((e) => e.amount)) && <div className="row spread"><span>Other (inspections)</span><span>{money(days.reduce((s, d) => s + d.events.reduce((x, e) => x + e.amount, 0), 0))}</span></div>}
        <div className={`row spread bold ${sum("profit") >= 0 ? "good" : "bad"}`}><span>{sum("profit") >= 0 ? "Profit" : "Loss"}</span><span>{money(sum("profit"))}</span></div>
        <div className="tiny muted">Revenue is what customers paid; profit is what's left after all costs ({money(cost)}). Cost split is the game's estimate for this kind of business.</div>
      </div>
      <button className="btn sm ghost" aria-expanded={open} onClick={() => setOpen(!open)}>{open ? "Hide daily history" : "Daily history"}</button>
      {open && (
        <div className="history">
          {!days.length && <div className="muted tiny">No full days yet.</div>}
          {[...days].reverse().map((d) => (
            <div key={d.day} className="tiny" style={{ padding: "4px 0", borderBottom: "1px solid rgba(0,0,0,0.06)" }}>
              <b>{toGameDate(d.day * 1440 + 720).label}</b> · sales {money(d.revenue)} · costs {money(d.revenue - d.profit)} · <span className={d.profit >= 0 ? "good" : "bad"}>{money(d.profit)}</span>
              {d.events.length > 0 && <div className="muted">{d.events.map((e) => e.label + (e.amount ? ` (${money(e.amount)})` : "")).join(" · ")}</div>}
            </div>
          ))}
        </div>
      )}
      <div className="tiny muted" style={{ marginTop: 6 }}>Marketing: {running ? `${b.promoKind} running until ${toGameDate(b.promoUntil * 1440 + 720).label}.` : "none running."}</div>
      <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>
        {(Object.keys(MARKETING) as (keyof typeof MARKETING)[]).map((k) => {
          const m = MARKETING[k];
          return <ConfirmButton key={k} className="btn sm" disabled={busy || running} ask={`${m.name} for your ${t.name}?`} details={{ cost: money(m.price * 100), time: `${m.days} days from today`, changes: `Usually ${m.boost[0]}–${m.boost[1]}% more sales while it runs. Not guaranteed: weather, power and luck still matter.`, undo: "No refund once it starts." }} onConfirm={() => act({ type: "biz_market", businessId: b.id, kind: k, expect: m.price * 100 })}>{m.name} · {money(m.price * 100, true)}</ConfirmButton>;
        })}
      </div>
      <div className="row" style={{ gap: 6, marginTop: 6 }}>
        <ConfirmButton className="btn sm green" disabled={busy || b.till <= 0} ask="Move the till to your bank?" details={{ where: `${t.name}, ${DISTRICTS[t.district].name}`, cost: `${money(Math.max(0, b.till))} from the business till`, changes: "It lands in your bank account (recorded in your statement). The business keeps trading.", undo: "It's your money: spend or move it back as you like." }} onConfirm={() => act({ type: "biz_collect", businessId: b.id })}>Cash out {money(Math.max(0, b.till), true)} to bank</ConfirmButton>
      </div>
    </div>
  );
}

/** Work-and-pay vehicles as a small fleet: route, fare and what each driver brought in. */
export function FleetPanel() {
  const { state, act, busy } = useGame();
  if (!state) return null;
  const fleet = state.vehicles.filter((v) => VEHICLES[v.type]?.workPay);
  if (!fleet.length) return null;
  return (
    <div style={{ marginTop: 10 }}>
      <h3>🚐 Your fleet</h3>
      <div className="tiny muted">Vehicles on work-and-pay have a driver who pays you daily (not Sundays). Routes and fares change how full the seats are: game simulation, not real demand.</div>
      {fleet.map((v) => {
        const def = VEHICLES[v.type];
        const routes = FLEET_ROUTES.filter((r) => r.vehicles.includes(v.type));
        const route = routes.find((r) => r.id === v.route);
        const occ = Math.max(0.2, Math.min(1, (route?.demand ?? 0.75) * (1 - v.fareLevel * 0.18)));
        return (
          <div className="trip" key={v.id}>
            <div className="row spread"><b>{def.name}</b><span className="pill">{v.status === "workpay" ? "With a driver" : "Parked (yours)"}</span></div>
            <div className="tiny">Condition {v.condition}% · yesterday paid {money(v.lastPay)} · base driver payment {money((def.workPay ?? 0) * 100)}/day</div>
            <label className="tiny muted" htmlFor={`route${v.id}`}>Route</label>
            <select id={`route${v.id}`} className="input" disabled={busy} value={v.route ?? ""} onChange={(e) => void act({ type: "fleet_set", vehicleId: v.id, route: e.target.value })}>
              <option value="" disabled>Choose a route</option>
              {routes.map((r) => <option key={r.id} value={r.id}>{r.name} · demand {Math.round(r.demand * 100)}%</option>)}
            </select>
            <div className="row" style={{ gap: 6, marginTop: 4, flexWrap: "wrap" }}>
              {[-1, 0, 1].map((fl) => <button key={fl} className={`btn sm ${v.fareLevel === fl ? "primary" : ""}`} disabled={busy} title={FARE_LEVELS[fl].note} onClick={() => void act({ type: "fleet_set", vehicleId: v.id, fareLevel: fl })}>{FARE_LEVELS[fl].label}</button>)}
            </div>
            <div className="tiny muted">Now: about {Math.round(occ * 100)}% of seats filled; {FARE_LEVELS[v.fareLevel].note.toLowerCase()}. Repairs and insurance in the Garage list above.</div>
          </div>
        );
      })}
    </div>
  );
}
