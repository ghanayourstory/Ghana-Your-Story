// The morning card: the day ahead at a glance (weather, your shift, money,
// how you feel) and Today's hustle: three small goals you can swap or ignore.
import { useGame } from "../store.tsx";
import { Sheet, money, WEATHER_ICON } from "./common.tsx";
import { JOBS, PLACE_BY_ID } from "../../shared/world.ts";
import { NEEDS } from "../../shared/mood.ts";
import { GROUP_NAME, fmtHour, outageWindow, powerGroup } from "../../shared/power.ts";
import { DISTRICTS } from "../../shared/world.ts";
import { FESTIVALS } from "../../shared/regional.ts";
import { daysToAkwasidae } from "../../shared/calendar.ts";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
/** Festivals where you are and back home: on now, or coming next month (Akwasidae within a week). */
function festivalsFor(cities: string[], month: number, day: number) {
  const out: { id: string; name: string; people: string; where: string; on: boolean; when: string }[] = [];
  for (const f of FESTIVALS) {
    const ds = f.districts.filter((d) => cities.includes(DISTRICTS[d]?.city));
    if (!ds.length) continue;
    const where = [...new Set(ds.map((d) => DISTRICTS[d].name))].join(", ");
    if (f.cycle42) {
      const n = daysToAkwasidae(day);
      if (n <= 7) out.push({ id: f.id, name: f.name, people: f.people, where, on: n === 0, when: `In ${n} day${n === 1 ? "" : "s"}` });
    } else if (f.months.includes(month)) out.push({ id: f.id, name: f.name, people: f.people, where, on: true, when: "" });
    else if (f.months.includes((month % 12) + 1)) out.push({ id: f.id, name: f.name, people: f.people, where, on: false, when: `Next month (${f.months.map((m) => MONTHS[m - 1]).join("/")})` });
  }
  return out.slice(0, 3);
}

export function TodaySheet({ onClose }: { onClose: () => void }) {
  const { state, act, busy } = useGame();
  if (!state) return null;
  const t = state.time;
  const p = state.player;
  const d = p.daily;
  const greet = t.hour < 12 ? "Good morning" : t.hour < 17 ? "Good afternoon" : "Good evening";
  const job = p.job ? JOBS[p.job.id] : null;
  const place = job ? PLACE_BY_ID[job.placeId] : null;
  const low = NEEDS.filter((n) => ((p.stats as Record<string, number>)[n.key] ?? 100) < 35);
  const doneCount = d.goals.filter((g) => g.done).length;
  const dumsor = outageWindow(p.home.district, d.day);
  return (
    <Sheet title={`${WEATHER_ICON[t.weather]} ${greet}, ${p.name.split(" ")[0]}`} sub={`${t.weekday} ${t.date} ${t.monthName} · ${t.season} · ${t.clock}`} onClose={onClose}>
      <div className="col" style={{ marginTop: 10, gap: 8 }}>
        <div className="today-row">
          <span>💼</span>
          <div className="grow">
            {job && place ? (
              <>
                <b>{p.job!.rankTitle ?? job.title} at {place.name}</b>
                <div className="tiny muted">Shifts start {job.shiftWindow[0]}:00–{job.shiftWindow[1]}:00{job.weekdaysOnly ? ", weekdays only" : ""} · {job.hours}h · about {money(job.pay * 100)} a shift</div>
              </>
            ) : (
              <>
                <b>No job yet</b>
                <div className="tiny muted">Places that are hiring say so on their door. Markets and lorry stations take anyone.</div>
              </>
            )}
          </div>
        </div>
        <div className="today-row">
          <span>{dumsor ? "🕯️" : "💡"}</span>
          <div className="grow">
            <b>{dumsor ? `Dumsor in ${DISTRICTS[p.home.district]?.name ?? "your area"}: lights off ${fmtHour(dumsor[0])}–${fmtHour(dumsor[1])}` : "Power should stay on at home today"}</b>
            <div className="tiny muted">Prepaid meter: {p.power.units} kWh, about {Math.floor(p.power.units / Math.max(0.1, p.power.perDay))} days{p.power.units <= p.power.perDay * 2 ? " (top up soon: Phone → SikaBank → Power)" : ""}. Load-shedding group {GROUP_NAME[powerGroup(p.home.district)]}.{dumsor ? (p.generator ? " Your generator will keep the TV on (fuel extra)." : " No TV or laptop at home then; a generator from Melcom helps.") : ""}</div>
          </div>
        </div>
        <div className="today-row">
          <span>💵</span>
          <div className="grow"><b>{money(state.money.cash)} cash · {money(state.money.bank)} in the bank</b><div className="tiny muted">Bills this month about {money(state.money.monthlyExpenses)}.</div></div>
        </div>
        {(() => {
          const arcs = p.missions.filter((m) => !m.complete);
          const arc = arcs.find((m) => m.steps.some((x) => x.done)) ?? arcs[0];
          const step = arc?.steps.find((x) => !x.done);
          return arc && step ? (
            <div className="today-row">
              <span>📖</span>
              <div className="grow"><b>Story · {arc.title}: {step.label}</b><div className="tiny muted">{step.hint} (Phone → Story)</div></div>
            </div>
          ) : null;
        })()}
        {job && place && DISTRICTS[place.district].city !== DISTRICTS[p.district].city && (
          <div className="today-row">
            <span>💼</span>
            <div className="grow"><b>Your job is in {DISTRICTS[place.district].name}</b><div className="tiny muted">Jobs are local: a week without a shift and they'll give it to someone else. There's work here too.</div></div>
          </div>
        )}
        {p.cleanupToday && p.cleanupDay !== t.day && (
          <div className="today-row">
            <span>🧹</span>
            <div className="grow"><b>Communal clean-up today, 7 to 10</b><div className="tiny muted">First Saturday of the month: brooms and shovels, gutters cleared. Standing and social.</div></div>
            <button className="btn sm" disabled={busy || t.hour < 7 || t.hour >= 10} onClick={() => act({ type: "cleanup" })}>Join in</button>
          </div>
        )}
        {festivalsFor([DISTRICTS[p.district].city, p.hometown], t.month + 1, t.day).map((f) => (
          <div className="today-row" key={f.id}>
            <span>🥁</span>
            <div className="grow"><b>{f.on ? "Festival on now" : "Festival soon"}: {f.name}</b><div className="tiny muted">{f.people} · {f.where} · {f.on ? "Join in at the town's tour desk or square." : f.when}</div></div>
          </div>
        ))}
        {(p.events.length ? p.events : p.nextEvents).slice(0, 2).map((e) => (
          <div className="today-row" key={e.id}>
            <span>{e.kind === "funeral" ? "⚫" : "💍"}</span>
            <div className="grow"><b>{p.events.length ? "Today" : "Saturday"}: {e.title}</b><div className="tiny muted">At {PLACE_BY_ID[e.placeId]?.name}, {DISTRICTS[e.district]?.name} · {e.hours[0]}:00–{e.hours[1]}:00 · everyone's welcome; bring {e.kind === "funeral" ? "a donation" : "a gift"} (GH₵{e.gift}+).</div></div>
          </div>
        ))}
        {p.illness && (
          <div className="today-row">
            <span>🤒</span>
            <div className="grow"><b>{p.illness === "malaria" ? "Possible malaria" : p.illness === "flu" ? "You have the flu" : "Running stomach"}</b><div className="tiny muted">{p.illness === "malaria" ? "Go to a clinic for a test and treatment (Doctor's consultation)." : p.illness === "flu" ? "A pharmacy helps, or rest: it passes in about three days." : "ORS from a pharmacy sorts it; it passes in a couple of days."} You tire faster until then.</div></div>
          </div>
        )}
        {p.family.filter((m) => m.request).map((m) => (
          <div className="today-row" key={m.id}>
            <span>🙏</span>
            <div className="grow"><b>{m.name.split(" ").slice(0, 2).join(" ")} asked for help</b><div className="tiny muted">{m.request!.reason}: GH₵{m.request!.amount} · Phone → Family. Only if you can.</div></div>
          </div>
        ))}
        {p.stock.length > 0 && (
          <div className="today-row">
            <span>🧺</span>
            <div className="grow"><b>Stock to sell: {p.stock.map((x) => `${x.qty} ${x.id.replace("_", " ")}`).join(", ")}</b><div className="tiny muted">Lorry stations and markets buy; fruit and bread go off overnight.</div></div>
          </div>
        )}
        <div className="today-row">
          <span>{p.mood.face}</span>
          <div className="grow"><b>Feeling {p.mood.label.toLowerCase()}</b><div className="tiny muted">{low.length ? low.map((n) => `${n.icon} ${n.label} is low: ${n.tip}`).join(" ") : "Your needs are fine for now."}</div></div>
        </div>
      </div>
      <h3 style={{ marginBottom: 6 }}>🎯 Today's hustle · {doneCount}/3</h3>
      <div className="tiny muted" style={{ marginBottom: 8 }}>Optional. Small rewards, fresh goals every game day. {d.streak > 1 ? `🔥 ${d.streak}-day streak.` : ""}</div>
      {d.goals.map((g) => (
        <div className={`svc goal ${g.done ? "done" : ""}`} key={g.id}>
          <span className="goal-icon">{g.done ? "✅" : g.icon}</span>
          <div className="grow">
            <div className="bold">{g.label}{g.target > 1 ? ` (${g.progress}/${g.target})` : ""}</div>
            <div className="tiny muted">{g.done ? "Done." : g.hint} · {money(g.reward * 100)}</div>
          </div>
          {!g.done && !d.swapped && <button className="btn sm ghost" disabled={busy} onClick={() => act({ type: "daily_swap", goalId: g.id })} title="Swap for a different goal (once a day)">🔁 Swap</button>}
        </div>
      ))}
      <div className="tiny muted" style={{ marginTop: 6 }}>{d.bonusPaid ? `🏆 All three done: +${money(d.bonus * 100)} bonus paid.` : `Do all three for a ${money(d.bonus * 100)} bonus.`}</div>
      <button className="btn primary block" style={{ marginTop: 12 }} onClick={onClose}>Let's go</button>
    </Sheet>
  );
}
