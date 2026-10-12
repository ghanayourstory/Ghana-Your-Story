// The morning card: the day ahead at a glance (weather, your shift, money,
// how you feel) and Today's hustle: three small goals you can swap or ignore.
import { useGame } from "../store.tsx";
import { Sheet, money, WEATHER_ICON } from "./common.tsx";
import { JOBS, PLACE_BY_ID } from "../../shared/world.ts";
import { NEEDS } from "../../shared/mood.ts";

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
          <span>💵</span>
          <div className="grow"><b>{money(state.money.cash)} cash · {money(state.money.bank)} in the bank</b><div className="tiny muted">Bills this month about {money(state.money.monthlyExpenses)}.</div></div>
        </div>
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
