// Work: your job, a shift's decision and its result, finding work across
// Ghana, applications and interviews, and training that leads somewhere.
// Employers and pay are game content (fictional); the game checks and pays.

import { useMemo, useState } from "react";
import { useGame } from "../store.tsx";
import { Bar, ConfirmButton, money } from "./common.tsx";
import { INTERVIEW, SECTOR_LABEL, SHIFTS_PER_RANK_HINT, TYPE_LABEL, needsInterview, profileOf, rankOnSwitch, type Scenario, type Sector } from "../../shared/careers.ts";
import { DISTRICTS, JOBS, PLACE_BY_ID, isOpenAt, rankPay, travelQuote } from "../../shared/world.ts";
import { CITIES } from "../../shared/cities.ts";
import { COURSES } from "../../shared/life.ts";
import { toGameDate } from "../../shared/calendar.ts";
import { gigVehicle, startGigShift } from "./gig.ts";
import type { World } from "../world/World.ts";

const cityOfJob = (id: string) => DISTRICTS[PLACE_BY_ID[JOBS[id].placeId].district].city;
const SHIFTS_PER_RANK = 10;

/** Today's situation at work: choose how you handle it, then work the shift. */
export function ShiftCard({ onDone }: { onDone?: () => void }) {
  const { state, act, busy } = useGame();
  const [pick, setPick] = useState<string | null>(null);
  if (!state || !state.player.job) return null;
  const job = JOBS[state.player.job.id];
  const task = state.career.task as Scenario | null;
  const place = PLACE_BY_ID[job.placeId];
  const here = state.player.district === place.district;
  const inWindow = isOpenAt(job.shiftWindow, state.time.hour) && !(job.weekdaysOnly && toGameDate(state.time.minute).isWeekend);
  const onLeave = state.career.leaveUntil !== null && state.career.leaveUntil > state.time.day;
  if (job.needsVehicle) return null;
  return (
    <div className="card" style={{ marginTop: 8 }}>
      <b>Today's shift · {job.hours}h</b>
      {!here && <div className="tiny bad">Go to {place.name} ({DISTRICTS[place.district].name}) to work.</div>}
      {here && !inWindow && <div className="tiny muted">Shifts start {job.shiftWindow[0]}:00–{job.shiftWindow[1]}:00{job.weekdaysOnly ? ", weekdays" : ""}. Arriving more than 90 min after the start counts as late.</div>}
      {onLeave && <div className="tiny">On leave until day {state.career.leaveUntil}.</div>}
      {task && (
        <fieldset className="choice" disabled={busy || !here || !inWindow || onLeave}>
          <legend className="tiny">{task.prompt}</legend>
          {task.choices.map((c) => (
            <label key={c.id} className="row" style={{ gap: 8, alignItems: "flex-start" }}>
              <input type="radio" name="task" checked={pick === c.id} onChange={() => setPick(c.id)} /> <span className="small">{c.label}</span>
            </label>
          ))}
        </fieldset>
      )}
      <button className="btn primary block" disabled={busy || !here || !inWindow || onLeave || !pick} onClick={async () => { const r = await act({ type: "work", taskId: task?.id, choice: pick }); if (r.ok) { setPick(null); onDone?.(); } }}>Work the shift</button>
      <div className="tiny muted">Pay depends on how you turn up (rest, food, mood), when, and how you handle today's situation. You'll see why.</div>
    </div>
  );
}

export function WorkApp({ world, onClose }: { world: World | null; onClose: () => void }) {
  const { state } = useGame();
  const [tab, setTab] = useState<"mine" | "find" | "apps" | "training">("mine");
  if (!state) return null;
  const pending = state.career.applications.filter((a) => a.status === "interview" || a.status === "offered").length;
  return (
    <div>
      <div className="tabs" role="tablist">
        <button role="tab" aria-selected={tab === "mine"} className={tab === "mine" ? "on" : ""} onClick={() => setTab("mine")}>My work</button>
        <button role="tab" aria-selected={tab === "find"} className={tab === "find" ? "on" : ""} onClick={() => setTab("find")}>Find work</button>
        <button role="tab" aria-selected={tab === "apps"} className={tab === "apps" ? "on" : ""} onClick={() => setTab("apps")}>Applications{pending ? ` (${pending})` : ""}</button>
        <button role="tab" aria-selected={tab === "training"} className={tab === "training" ? "on" : ""} onClick={() => setTab("training")}>Training</button>
      </div>
      {tab === "mine" && <MyWork world={world} onClose={onClose} />}
      {tab === "find" && <FindWork />}
      {tab === "apps" && <Applications />}
      {tab === "training" && <Training />}
    </div>
  );
}

function MyWork({ world, onClose }: { world: World | null; onClose: () => void }) {
  const { state, act, busy } = useGame();
  const [leaveDays, setLeaveDays] = useState(2);
  if (!state) return null;
  const j = state.player.job;
  if (!j) return <div className="notice" style={{ marginTop: 8 }}>No job yet. Look under Find work: market loading, trotro mates and chop bars take people on the spot; offices and hospitals interview.</div>;
  const job = JOBS[j.id];
  const prof = profileOf(job);
  const place = PLACE_BY_ID[job.placeId];
  return (
    <div style={{ marginTop: 6 }}>
      <div className="card">
        <div className="tiny muted">{SECTOR_LABEL[prof.sector]} · {TYPE_LABEL[prof.type]}</div>
        <b style={{ fontSize: 18 }}>{prof.ladder[j.rank]} · {job.title}</b>
        <div className="tiny muted">{place.name}, {DISTRICTS[place.district].name}, {CITIES[DISTRICTS[place.district].city]?.name}</div>
        <div className="kv"><span>Pay</span><b>{money(j.payPerShift)} per {job.hours}h shift{job.salaried ? " · accrues, paid monthly on the 28th" : " · cash after each shift"}</b></div>
        <div className="kv"><span>Shifts</span><span>Start {job.shiftWindow[0]}:00–{job.shiftWindow[1]}:00{job.weekdaysOnly ? " · Mon–Fri" : " · any day"}</span></div>
        {prof.workCost > 0 && <div className="kv"><span>Work costs</span><span>{money(prof.workCost * 100)} a shift (transport, upkeep)</span></div>}
        {state.money.payroll > 0 && <div className="kv"><span>Salary earned this month</span><b className="good">{money(state.money.payroll)}</b></div>}
        <h4 style={{ margin: "8px 0 2px" }}>Career path</h4>
        <ol className="ladder">{prof.ladder.map((t, i) => <li key={i} className={i === j.rank ? "on" : i < j.rank ? "done" : ""}>{t} · {money(rankPay(job.pay, i) * 100)}/shift</li>)}</ol>
        {j.nextRankAt && <><div className="tiny muted">{SHIFTS_PER_RANK_HINT} {j.shifts}/{j.nextRankAt} shifts.</div><Bar value={(j.shifts / j.nextRankAt) * 100} color="#7c83ff" /></>}
      </div>
      {job.needsVehicle ? (
        <div className="col" style={{ marginTop: 8, gap: 4 }}>
          <button className="btn primary" disabled={busy || !gigVehicle(state) || state.player.lastGigDay === state.time.day} onClick={() => startGigShift(world, state, act, onClose)}>{state.player.lastGigDay === state.time.day ? "Today's shift done" : `${job.needsVehicle === "car" ? "🚗" : "🛵"} Start driving (3 trips)`}</button>
          <div className="tiny muted">Drive to the green beacon, stop to pick up, then the yellow one to drop off. Pay per trip; fuel comes off.</div>
        </div>
      ) : <ShiftCard />}
      <h3>Recent shifts</h3>
      {!state.career.shifts.length && <div className="muted">None yet.</div>}
      {state.career.shifts.slice(0, 5).map((s, i) => (
        <div className="trip" key={i}>
          <div className="row spread"><b>{toGameDate(s.min).label} · {money(s.pay)}</b><span className={`pill ${s.performance < 0.85 ? "bad" : ""}`}>{Math.round(s.performance * 100)}%</span></div>
          {s.task && <div className="tiny muted">{s.task}</div>}
          <div className="tiny">{s.factors.map((f) => `${f.label} (${f.d >= 0 ? "+" : ""}${Math.round(f.d * 100)}%)`).join(" · ")}</div>
        </div>
      ))}
      <h3>Time off</h3>
      <div className="row" style={{ gap: 6, alignItems: "center" }}>
        <select className="input" style={{ width: "auto" }} value={leaveDays} onChange={(e) => setLeaveDays(Number(e.target.value))} aria-label="Days of leave">{[1, 2, 3, 5, 7].map((d) => <option key={d} value={d}>{d} day{d > 1 ? "s" : ""}</option>)}</select>
        <ConfirmButton className="btn sm" disabled={busy} ask={`Take ${leaveDays} day${leaveDays > 1 ? "s" : ""} off?`} details={{ changes: "No shifts and no shift pay while you're off; your job is held and the absence clock pauses.", undo: "Leave ends on its own." }} onConfirm={() => act({ type: "job_leave", days: leaveDays })}>Request leave</ConfirmButton>
      </div>
      <div style={{ marginTop: 10 }}><ConfirmButton className="btn ghost sm" disabled={busy} ask="Quit this job?" details={{ changes: "No more shifts or pay from here. Salary already earned is still paid on the 28th.", undo: `A new job in the same sector (${SECTOR_LABEL[prof.sector]}) keeps some seniority; another sector starts at entry level.` }} onConfirm={() => act({ type: "job_quit" })}>Quit</ConfirmButton></div>
    </div>
  );
}

function FindWork() {
  const { state, act, busy } = useGame();
  const [city, setCity] = useState<string>("");
  const [sector, setSector] = useState<Sector | "all">("all");
  const [type, setType] = useState<string>("all");
  const here = state ? DISTRICTS[state.player.district].city : "";
  const c = city || here;
  const list = useMemo(() => Object.values(JOBS).filter((j) => cityOfJob(j.id) === c && (sector === "all" || profileOf(j).sector === sector) && (type === "all" || profileOf(j).type === type)), [c, sector, type]);
  if (!state) return null;
  const sk = state.player.skills;
  const curJob = state.player.job ? JOBS[state.player.job.id] : null;
  const homeD = state.player.home.district;
  const g = toGameDate(state.time.minute);
  const cities = [...new Set(Object.values(JOBS).map((j) => cityOfJob(j.id)))];
  return (
    <div style={{ marginTop: 6 }}>
      <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>
        <select className="input" style={{ width: "auto" }} aria-label="Town" value={c} onChange={(e) => setCity(e.target.value)}>{cities.map((x) => <option key={x} value={x}>{CITIES[x]?.name ?? x}</option>)}</select>
        <select className="input" style={{ width: "auto" }} aria-label="Sector" value={sector} onChange={(e) => setSector(e.target.value as Sector | "all")}><option value="all">All sectors</option>{(Object.keys(SECTOR_LABEL) as Sector[]).map((s) => <option key={s} value={s}>{SECTOR_LABEL[s]}</option>)}</select>
        <select className="input" aria-label="Type" value={type} style={{ maxWidth: "100%" }} onChange={(e) => setType(e.target.value)}><option value="all">Any type</option>{Object.entries(TYPE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
      </div>
      {!list.length && <div className="muted" style={{ marginTop: 8 }}>No openings like that in {CITIES[c]?.name ?? c}.</div>}
      {list.map((j) => {
        const prof = profileOf(j);
        const place = PLACE_BY_ID[j.placeId];
        const req = state.player.jobRequirements[j.id] ?? {};
        const missing = Object.entries(req).filter(([k, v]) => ((k === "reputation" ? state.player.reputation : sk[k as keyof typeof sk]) ?? 0) < (v as number));
        const startRank = rankOnSwitch(curJob, state.player.job?.rank ?? 0, j);
        const commute = DISTRICTS[homeD]?.city === c ? travelQuote(homeD, place.district, "trotro", g.hour, g.weekdayIndex, false) : null;
        const atPlace = state.player.district === place.district;
        const mine = state.player.job?.id === j.id;
        const interview = needsInterview(j);
        return (
          <div className="trip" key={j.id}>
            <div className="row spread"><b>{j.title}</b><span className="pill">{TYPE_LABEL[prof.type].split(" (")[0]}</span></div>
            <div className="tiny muted">{place.name} · {DISTRICTS[place.district].name} · {SECTOR_LABEL[prof.sector]}</div>
            <div className="tiny">{money(rankPay(j.pay, startRank) * 100)} per {j.hours}h shift ({j.salaried ? "salaried: accrues, paid monthly" : "paid after each shift"}) · starts {j.shiftWindow[0]}:00–{j.shiftWindow[1]}:00{j.weekdaysOnly ? ", Mon–Fri" : ", any day"}{prof.workCost ? ` · work costs ${money(prof.workCost * 100)}/shift` : ""}</div>
            <div className="tiny">You'd start as <b>{prof.ladder[startRank]}</b>{startRank ? " (your sector experience counts)" : ""} → {prof.ladder.slice(startRank + 1, startRank + 3).join(" → ")}…</div>
            <div className="tiny">{commute ? `Commute from home: ~${commute.minutes} min by trotro, ${money(commute.fare * 100)}` : "Your home is in another town: you'd move or travel."}</div>
            <div className="tiny">{Object.keys(req).length === 0 && !j.needsUnlock ? <span className="good">No requirements</span> : <>{Object.entries(req).map(([k, v]) => { const have = Math.floor((k === "reputation" ? state.player.reputation : sk[k as keyof typeof sk]) ?? 0); return <span key={k} className={have >= (v as number) ? "good" : "bad"} style={{ marginRight: 8 }}>{have >= (v as number) ? "✓" : "✗"} {k} {have}/{v as number}</span>; })}{j.needsUnlock && <span className={state.player.unlocks.includes(j.needsUnlock) ? "good" : "bad"}>{state.player.unlocks.includes(j.needsUnlock) ? "✓" : "✗"} {j.needsUnlock.replace("licence_b", "driving licence").replace("licence_a", "riding licence").replace("cert_", "certificate: ")}</span>}</>}</div>
            {prof.courses.length > 0 && <div className="tiny muted">Training that helps: {prof.courses.map((cid) => COURSES[cid]?.name ?? cid).join(", ")}</div>}
            <div className="tiny muted">{interview ? "Apply in person, then an interview the next weekday at 10:00." : "Start the same day if you qualify."}</div>
            {mine ? <span className="pill green">Your job</span> : (
              <ConfirmButton className="btn sm primary" disabled={busy || !atPlace || missing.length > 0} ask={interview ? `Apply to ${place.name}?` : `Start as ${j.title}?`} details={{ where: `${place.name}, ${DISTRICTS[place.district].name}`, time: interview ? "20 min now; interview next weekday 10:00 (attend in person)" : `${j.hours}h shifts from ${j.shiftWindow[0]}:00`, cost: `${money(rankPay(j.pay, startRank) * 100)} a shift`, changes: interview ? "Nothing changes until you accept an offer." : `${curJob ? `Replaces ${curJob.title}. ` : ""}You start as ${prof.ladder[startRank]}.`, undo: interview ? "Withdraw any time before accepting." : "Quit any time." }} onConfirm={() => act({ type: "job_apply", jobId: j.id })}>{atPlace ? (interview ? "Apply" : "Start today") : `Apply in person at ${DISTRICTS[place.district].name}`}</ConfirmButton>
            )}
          </div>
        );
      })}
    </div>
  );
}

function Applications() {
  const { state, act, busy } = useGame();
  const [answer, setAnswer] = useState<Record<number, string>>({});
  if (!state) return null;
  const apps = state.career.applications;
  if (!apps.length) return <div className="muted" style={{ marginTop: 8 }}>No applications yet.</div>;
  const LABEL: Record<string, string> = { interview: "Interview booked", offered: "Offer", accepted: "Accepted", rejected: "Not successful", withdrawn: "Withdrawn", expired: "Expired" };
  return (
    <div style={{ marginTop: 6 }}>
      {apps.map((a) => {
        const j = JOBS[a.jobId];
        const place = PLACE_BY_ID[j.placeId];
        const at = state.player.district === place.district;
        const now = state.time.minute;
        const canInterview = a.status === "interview" && at && a.interviewMin !== null && now >= a.interviewMin - 120 && now <= a.interviewMin + 120;
        return (
          <div className="trip" key={a.id}>
            <div className="row spread"><b>{j.title} · {place.name}</b><span className={`pill ${a.status === "rejected" || a.status === "expired" ? "bad" : ""}`}>{LABEL[a.status] ?? a.status}</span></div>
            {a.status === "interview" && a.interviewMin !== null && <div className="tiny">Interview {toGameDate(a.interviewMin).label}, 10:00 (game time) at {place.name}, {DISTRICTS[place.district].name}. {at ? "" : "Be there in person."}</div>}
            {a.status === "offered" && a.expiresMin !== null && <div className="tiny good">Offer open until {toGameDate(a.expiresMin).label} {toGameDate(a.expiresMin).clock}. Starting rank: {profileOf(j).ladder[rankOnSwitch(state.player.job ? JOBS[state.player.job.id] : null, state.player.job?.rank ?? 0, j)]}.</div>}
            {a.reason && <div className="tiny muted">{a.reason}</div>}
            {a.status === "interview" && (
              <fieldset className="choice" disabled={busy || !canInterview}>
                <legend className="tiny">{INTERVIEW.prompt}</legend>
                {INTERVIEW.choices.map((c) => <label key={c.id} className="row" style={{ gap: 8 }}><input type="radio" name={`iv${a.id}`} checked={answer[a.id] === c.id} onChange={() => setAnswer({ ...answer, [a.id]: c.id })} /> <span className="small">{c.label}</span></label>)}
                <button className="btn sm primary" disabled={!answer[a.id]} onClick={() => void act({ type: "job_application", op: "interview", applicationId: a.id, choice: answer[a.id] })}>{now < (a.interviewMin ?? 0) ? "Wait and go in" : "Go in"}</button>
              </fieldset>
            )}
            <div className="row" style={{ gap: 6, marginTop: 4 }}>
              {a.status === "offered" && <ConfirmButton className="btn sm primary" disabled={busy} ask={`Accept ${j.title}?`} details={{ changes: state.player.job ? `Replaces ${JOBS[state.player.job.id].title}.` : "You start working here.", undo: "Quit any time from My work." }} onConfirm={() => act({ type: "job_application", op: "accept", applicationId: a.id })}>Accept</ConfirmButton>}
              {a.status === "offered" && <button className="btn sm ghost" disabled={busy} onClick={() => void act({ type: "job_application", op: "decline", applicationId: a.id })}>Decline</button>}
              {a.status === "interview" && <button className="btn sm ghost" disabled={busy} onClick={() => void act({ type: "job_application", op: "withdraw", applicationId: a.id })}>Withdraw</button>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Training() {
  const { state } = useGame();
  if (!state) return null;
  const mine = new Map(state.courses.map((c) => [c.id, c]));
  return (
    <div style={{ marginTop: 6 }}>
      <div className="tiny muted">Courses are run at the schools, colleges and workshops shown. Institutions and certificates in the game are fictional versions, not official qualifications. Enrol in person at the place.</div>
      {Object.values(COURSES).map((c) => {
        const leads = Object.values(JOBS).filter((j) => profileOf(j).courses.includes(c.id) || j.needsUnlock === c.unlock).map((j) => j.title);
        const uniq = [...new Set(leads)].slice(0, 5);
        const st = mine.get(c.id);
        return (
          <div className="trip" key={c.id}>
            <div className="row spread"><b>{c.name}</b><span className="pill">{st ? (st.status === "done" ? "Completed" : `${st.sessions}/${c.sessions} sessions`) : money(c.fee * 100)}</span></div>
            <div className="tiny">{c.sessions} sessions × {Math.round(c.minutes / 60 * 10) / 10}h, {c.hours[0]}:00–{c.hours[1]}:00 · fee {money(c.fee * 100)}</div>
            <div className="tiny muted">Where: {c.places.map((pid) => PLACE_BY_ID[pid]?.name).filter(Boolean).slice(0, 4).join(", ")}</div>
            <div className="tiny">You gain: {Object.entries(c.onComplete).map(([k, v]) => `${k} +${v}`).join(", ") || "a certificate"}{c.unlock ? " and a certificate the game checks" : ""}</div>
            {uniq.length > 0 && <div className="tiny good">Leads to or helps: {uniq.join(", ")}</div>}
          </div>
        );
      })}
    </div>
  );
}
