// Court: your disputes and cases, lawyers and legal aid, hearings with
// transcripts, and low-cost civic activities. Game mechanics only, not
// legal advice. Cases are private: only you and the (fictional) other side.

import { useState } from "react";
import { useGame } from "../store.tsx";
import { money } from "./common.tsx";
import { APPEAL_DAYS, APPEAL_FEE, CASE_TYPES, CIVIC, COURT_CLOSES, HEARING_HOUR, JUSTICE_DISCLAIMER, JUSTICE_REVIEWED, LAWYERS, LAWYER_BY_ID, LEGAL_AID_INCOME_LIMIT, courtFor } from "../../shared/justice.ts";
import { DISTRICTS } from "../../shared/world.ts";
import { MINUTES_PER_DAY, toGameDate } from "../../shared/calendar.ts";

type GS = NonNullable<ReturnType<typeof useGame>["state"]>;
type Dispute = GS["court"]["disputes"][number];
type Case = GS["court"]["cases"][number];

const at = (min: number) => { const g = toGameDate(min); return `${g.label}, ${g.clock} (Ghana time, GMT)`; };
const STAGE: Record<string, string> = { listed: "Hearing listed", appeal_listed: "Appeal listed", decided: "Decided", withdrawn: "Withdrawn", struck_out: "Struck out" };

export function CourtApp() {
  const { state } = useGame();
  const [tab, setTab] = useState<"cases" | "lawyers" | "hearings" | "civic">("cases");
  if (!state) return null;
  return (
    <div>
      <div className="notice tiny">{JUSTICE_DISCLAIMER} Court names, judges and lawyers are fictional. Cases are private to you. (Rules reviewed {JUSTICE_REVIEWED}; local legal review still needed.)</div>
      <div className="tabs" role="tablist" style={{ marginTop: 6 }}>
        {(["cases", "lawyers", "hearings", "civic"] as const).map((t) => <button key={t} role="tab" aria-selected={tab === t} className={tab === t ? "on" : ""} onClick={() => setTab(t)}>{t === "cases" ? "My cases" : t === "lawyers" ? "Lawyers" : t === "hearings" ? "Hearings" : "Civic"}</button>)}
      </div>
      {tab === "cases" && <Cases />}
      {tab === "lawyers" && <Lawyers />}
      {tab === "hearings" && <Hearings />}
      {tab === "civic" && <Civic />}
    </div>
  );
}

function Cases() {
  const { state } = useGame();
  const [filing, setFiling] = useState<Dispute | null>(null);
  const [open, setOpen] = useState<number | null>(null);
  if (!state) return null;
  const { disputes, cases } = state.court;
  if (filing) return <FileCase d={filing} onBack={() => setFiling(null)} />;
  if (!disputes.length) return <div className="muted" style={{ marginTop: 8 }}>No disputes. They come from things that happen: a landlord keeping your rent advance, an employer holding back pay, someone claiming your land, or unpaid rent.</div>;
  return (
    <div style={{ marginTop: 6 }}>
      {disputes.map((d) => {
        const t = CASE_TYPES[d.kind];
        const c = cases.find((x) => x.disputeId === d.id);
        return (
          <div className="trip" key={d.id}>
            <div className="row spread"><b>{t.name}</b><span className="pill">{c ? STAGE[c.stage] ?? c.stage : d.status === "open" ? "Not filed" : d.status}</span></div>
            <div className="tiny muted">{d.role === "claimant" ? `You v ${d.counterparty}` : `${d.counterparty} v You`} · {money(d.amount)} · {courtFor(d.city).name}</div>
            <div className="tiny">{t.about}</div>
            <ul className="tiny" style={{ margin: "4px 0 0 16px", padding: 0 }}>
              {d.evidence.map((e, i) => <li key={i}>{e.label} <span className={e.source === "game_record" ? "good" : "muted"}>({e.source === "game_record" ? "game record, verified" : "your statement, not verified"})</span></li>)}
            </ul>
            {d.status === "open" && d.role === "claimant" && <button className="btn sm primary" style={{ marginTop: 6 }} onClick={() => setFiling(d)}>Take it to court…</button>}
            {c && c.stage === "listed" && d.role === "defendant" && <button className="btn sm primary" style={{ marginTop: 6 }} onClick={() => setFiling(d)}>Answer the claim…</button>}
            {c && <CaseCard c={c} d={d} expanded={open === c.id} onToggle={() => setOpen(open === c.id ? null : c.id)} />}
          </div>
        );
      })}
    </div>
  );
}

/** Before filing: costs, venue, hearing date, outcomes, appeal path. Nothing happens until you confirm. */
function FileCase({ d, onBack }: { d: Dispute; onBack: () => void }) {
  const { state, act, busy } = useGame();
  const [lawyer, setLawyer] = useState("self");
  const [statement, setStatement] = useState("");
  if (!state) return null;
  const t = CASE_TYPES[d.kind];
  const lw = LAWYER_BY_ID[lawyer];
  const answering = d.role === "defendant";
  const fees = answering ? 0 : t.filingFee + t.serviceFee;
  const total = (fees + lw.fee) * 100;
  const court = courtFor(d.city);
  const firstHearing = (state.time.day + t.daysToHearing) * MINUTES_PER_DAY + HEARING_HOUR * 60;
  const existing = state.court.cases.find((c) => c.disputeId === d.id);
  const spendable = state.money.cash + state.money.bank + state.money.momo;
  const aidOk = state.court.legalAidEligible;
  return (
    <div>
      <button className="btn sm ghost" onClick={onBack}>← My cases</button>
      <h3>{answering ? "Answer" : "File"}: {t.name}</h3>
      <dl className="facts">
        <dt>Parties</dt><dd>{answering ? `${d.counterparty} (claimant, fictional NPC) v You (defendant)` : `You (claimant) v ${d.counterparty} (defendant, fictional NPC)`}</dd>
        <dt>Venue</dt><dd>{court.name}, {DISTRICTS[court.district].name}. Judge: {court.judge}</dd>
        <dt>Hearing</dt><dd>{at(existing?.hearingMin ?? firstHearing)}. Attend in person; the court sits {HEARING_HOUR}:00–{COURT_CLOSES}:00. If you're absent the court decides without you.</dd>
        <dt>Amount</dt><dd>{money(d.amount)}</dd>
        <dt>Possible outcomes</dt><dd>{t.outcomes.join(" · ")}</dd>
        <dt>Appeal</dt><dd>Within {APPEAL_DAYS} days to the higher court (game), fee {money(APPEAL_FEE * 100)}. One adjournment allowed if asked a day ahead.</dd>
      </dl>
      <h3>Who represents you?</h3>
      {LAWYERS.filter((l) => l.focus.includes(d.kind)).map((l) => {
        const disabled = !!l.legalAid && !aidOk;
        return (
          <label className="svc" key={l.id} style={{ opacity: disabled ? 0.55 : 1 }}>
            <input type="radio" name="lawyer" value={l.id} checked={lawyer === l.id} disabled={disabled} onChange={() => setLawyer(l.id)} />
            <div className="grow">
              <div className="bold">{l.name} <span className="tiny muted">· {l.role}</span></div>
              <div className="tiny muted">{l.years ? `${l.years} years (fictional)` : ""} {l.availability} · {l.record}</div>
              {disabled && <div className="tiny bad">Legal aid is for incomes under {money(LEGAL_AID_INCOME_LIMIT * 100)} a month.</div>}
            </div>
            <b>{l.fee ? money(l.fee * 100) : "Free"}</b>
          </label>
        );
      })}
      <label className="tiny muted" htmlFor="stmt">Your statement (optional; shown to the court as your account, not verified)</label>
      <textarea id="stmt" className="input" rows={3} maxLength={400} value={statement} onChange={(e) => setStatement(e.target.value)} placeholder={answering ? "Explain your side…" : "What happened, in your own words…"} />
      <div className="receipt">
        {!answering && <div className="row spread"><span>Filing fee (game)</span><span>{money(t.filingFee * 100)}</span></div>}
        {!answering && <div className="row spread"><span>Service on the other side (game)</span><span>{money(t.serviceFee * 100)}</span></div>}
        <div className="row spread"><span>{lw.name}</span><span>{lw.fee ? money(lw.fee * 100) : "Free"}</span></div>
        <div className="row spread bold"><span>You pay now</span><span>{money(total)}</span></div>
        <div className="tiny muted">If you win, the other side is ordered to pay {answering ? "nothing more" : "the amount plus your filing fees"}, into your bank. If you lose, you bear your own costs{d.kind === "arrears" ? " and pay the arrears plus GH₵120 costs" : ""}. Money only moves on the court's decision.</div>
      </div>
      {spendable < total && <div className="tiny bad">Not enough money.</div>}
      <button className="btn primary block" disabled={busy || spendable < total} onClick={async () => { const r = await act({ type: "court", op: "file", disputeId: d.id, lawyer, statement, expect: total }); if (r.ok) onBack(); }}>{answering ? "Enter defence" : "File the claim"}{total ? ` and pay ${money(total)}` : ""}</button>
    </div>
  );
}

function CaseCard({ c, d, expanded, onToggle }: { c: Case; d: Dispute; expanded: boolean; onToggle: () => void }) {
  const { state, act, busy } = useGame();
  const [confirm, setConfirm] = useState<"appeal" | "withdraw" | null>(null);
  if (!state) return null;
  const now = state.time.minute;
  const court = courtFor(d.city);
  const listed = c.stage === "listed" || c.stage === "appeal_listed";
  const today = listed && toGameDate(c.hearingMin).day === state.time.day;
  const past = listed && now > c.hearingMin + (COURT_CLOSES - HEARING_HOUR) * 60;
  const atCourt = state.player.district === court.district;
  const canAttend = listed && atCourt && now >= c.hearingMin - 180 && !past;
  const canAdjourn = listed && !c.adjourned && toGameDate(c.hearingMin).day - state.time.day >= 1;
  const canAppeal = c.stage === "decided" && !c.appeal && c.decidedMin !== null && now <= c.decidedMin + APPEAL_DAYS * MINUTES_PER_DAY && d.status === "decided";
  return (
    <div style={{ marginTop: 6 }}>
      <div className="tiny">{listed ? <>Hearing: <b>{at(c.hearingMin)}</b> · {past ? "awaiting decision in your absence" : today ? "today" : "upcoming"}</> : c.outcome}</div>
      <div className="tiny muted">Lawyer: {LAWYER_BY_ID[c.lawyer]?.name ?? c.lawyer} · fees paid {money(c.fees)}{c.adjourned ? " · adjourned once" : ""}{c.appeal ? " · on appeal" : ""}</div>
      <div className="row" style={{ gap: 6, flexWrap: "wrap", marginTop: 4 }}>
        {listed && <button className="btn sm primary" disabled={busy || !canAttend} title={atCourt ? "" : `Go to ${court.name} in ${DISTRICTS[court.district].name}`} onClick={() => void act({ type: "court", op: "attend", caseId: c.id })}>{atCourt ? (now < c.hearingMin ? "Wait and attend" : "Attend the hearing") : `Attend (be at ${DISTRICTS[court.district].name})`}</button>}
        {listed && <button className="btn sm" disabled={busy || !canAdjourn} onClick={() => void act({ type: "court", op: "adjourn", caseId: c.id })}>Ask to adjourn</button>}
        {listed && d.role === "claimant" && <button className="btn sm ghost" disabled={busy} onClick={() => setConfirm("withdraw")}>Withdraw…</button>}
        {canAppeal && <button className="btn sm" disabled={busy} onClick={() => setConfirm("appeal")}>Appeal…</button>}
        <button className="btn sm ghost" onClick={onToggle} aria-expanded={expanded}>{expanded ? "Hide record" : "Transcript & history"}</button>
      </div>
      {confirm === "appeal" && (
        <div className="place-bar warn" role="alertdialog"><div className="grow tiny">Appeal to the higher court (game)? Fee {money(APPEAL_FEE * 100)} now; a new hearing about 5 days from today. The decision can go either way.</div>
          <button className="btn sm primary" disabled={busy} onClick={async () => { const r = await act({ type: "court", op: "appeal", caseId: c.id, expect: APPEAL_FEE * 100 }); if (r.ok) setConfirm(null); }}>Appeal · {money(APPEAL_FEE * 100)}</button>
          <button className="btn sm ghost" onClick={() => setConfirm(null)}>Not now</button></div>
      )}
      {confirm === "withdraw" && (
        <div className="place-bar warn" role="alertdialog"><div className="grow tiny">Withdraw your claim? The matter closes and fees already paid aren't refunded.</div>
          <button className="btn sm primary" disabled={busy} onClick={async () => { const r = await act({ type: "court", op: "withdraw", caseId: c.id }); if (r.ok) setConfirm(null); }}>Withdraw</button>
          <button className="btn sm ghost" onClick={() => setConfirm(null)}>Keep going</button></div>
      )}
      {expanded && (
        <div className="transcript">
          {c.transcript.length > 0 && <h4>Transcript</h4>}
          {c.transcript.map((l, i) => <p key={i} className={`tiny ${l.side}`}><b>{l.who}:</b> {l.text}</p>)}
          <h4>History (auditable)</h4>
          {c.history.map((h, i) => <p key={i} className="tiny muted">{toGameDate(h.at).label} {toGameDate(h.at).clock} — {h.what}</p>)}
        </div>
      )}
    </div>
  );
}

function Lawyers() {
  const { state } = useGame();
  if (!state) return null;
  return (
    <div style={{ marginTop: 6 }}>
      <div className="tiny muted">Fictional practitioners, listed by name, not by wins. Fees cover a case at first hearing; appeals cost extra. {state.court.legalAidEligible ? "You qualify for legal aid." : `Legal aid is for incomes under ${money(LEGAL_AID_INCOME_LIMIT * 100)} a month.`}</div>
      {LAWYERS.map((l) => (
        <div className="svc" key={l.id}>
          <div className="grow">
            <div className="bold">{l.name}</div>
            <div className="tiny muted">{l.role}{l.years ? ` · ${l.years} years (fictional)` : ""} · {l.availability}</div>
            <div className="tiny">Takes: {l.focus.map((k) => CASE_TYPES[k].name.toLowerCase()).join(", ")} · {l.record}</div>
          </div>
          <b>{l.fee ? money(l.fee * 100) : "Free"}</b>
        </div>
      ))}
    </div>
  );
}

function Hearings() {
  const { state } = useGame();
  if (!state) return null;
  const now = state.time.minute;
  const list = [...state.court.cases].sort((a, b) => a.hearingMin - b.hearingMin);
  const up = list.filter((c) => (c.stage === "listed" || c.stage === "appeal_listed") && c.hearingMin + (COURT_CLOSES - HEARING_HOUR) * 60 >= now);
  const done = list.filter((c) => !up.includes(c));
  return (
    <div style={{ marginTop: 6 }}>
      <h3>Upcoming</h3>
      {!up.length && <div className="muted">No hearings listed.</div>}
      {up.map((c) => {
        const d = state.court.disputes.find((x) => x.id === c.disputeId)!;
        return <div className="svc" key={c.id}><div className="grow"><div className="bold">{CASE_TYPES[d.kind].name}</div><div className="tiny muted">{at(c.hearingMin)} · {courtFor(d.city).name}</div></div></div>;
      })}
      <h3>Past</h3>
      {!done.length && <div className="muted">None yet.</div>}
      {done.map((c) => {
        const d = state.court.disputes.find((x) => x.id === c.disputeId)!;
        return <div className="svc" key={c.id}><div className="grow"><div className="bold">{CASE_TYPES[d.kind].name} · {STAGE[c.stage] ?? c.stage}</div><div className="tiny muted">{c.outcome || "—"}</div></div></div>;
      })}
    </div>
  );
}

function Civic() {
  const { state, act, busy } = useGame();
  if (!state) return null;
  const court = courtFor(DISTRICTS[state.player.district].city);
  const here = state.player.district === court.district;
  const open = state.time.hour >= HEARING_HOUR && state.time.hour < COURT_CLOSES;
  return (
    <div style={{ marginTop: 6 }}>
      <div className="tiny muted">Opt-in, free. At {court.name} ({DISTRICTS[court.district].name}), {HEARING_HOUR}:00–{COURT_CLOSES}:00. The cases you watch are fictional.</div>
      {(["observe", "volunteer"] as const).map((k) => (
        <div className="svc" key={k}>
          <div className="grow"><div className="bold">{CIVIC[k].label}</div><div className="tiny muted">{CIVIC[k].blurb} · {CIVIC[k].minutes / 60}h</div></div>
          <button className="btn sm primary" disabled={busy || !here || !open} title={!here ? `Go to ${DISTRICTS[court.district].name}` : !open ? "The court isn't sitting now" : ""} onClick={() => void act({ type: "court", op: k })}>{k === "observe" ? "Sit in" : "Volunteer"}</button>
        </div>
      ))}
    </div>
  );
}
