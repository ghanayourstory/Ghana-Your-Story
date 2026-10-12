// Phone → Family: the people at home. Call them, send MoMo, or travel home to visit.
import { useState } from "react";
import { useGame } from "../store.tsx";
import { Bar, money } from "./common.tsx";
import { CITIES } from "../../shared/cities.ts";
import { DISTRICTS } from "../../shared/world.ts";
import { ROLE_LABEL, WHEREABOUTS_LABEL, choresFor } from "../../shared/family.ts";
import { ConfirmButton } from "./common.tsx";
import { NPC_BY_ID } from "../../shared/people.ts";
import { ADOPTION_DAYS, ADOPTION_FEE, GROWN_AGE, NAMING_COST, SCHOOL_AGE, namingName } from "../../shared/children.ts";

export function FamilyApp({ onTravel }: { onTravel: () => void }) {
  const { state, act, busy } = useGame();
  const [amt, setAmt] = useState<Record<number, string>>({});
  if (!state) return null;
  const p = state.player;
  const day = state.time.day;
  const here = DISTRICTS[p.district].city;
  return (
    <div className="col" style={{ gap: 10 }}>
      <div className="tiny muted">Home is {CITIES[p.hometown]?.name ?? p.hometown}. MoMo balance {money(state.money.momo)} (top up in SikaBank → MoMo). Calls cost GH₵1.50 of airtime.</div>
      <Household />
      {here === p.hometown && (
        <div className="card col" style={{ gap: 6 }}>
          <b>🧹 Help out at the family house</b>
          <div className="tiny muted">Whoever is home gets closer to you. One of each a day.</div>
          <div className="row" style={{ flexWrap: "wrap", gap: 6 }}>
            {choresFor(p.hometown).map((c) => (
              <ConfirmButton key={c.id} className="btn sm" disabled={busy} ask={`${c.name}?`} details={{ where: "The family house", time: `${c.minutes} minutes`, cost: "Free (a little energy)", changes: `${c.blurb} Closeness with ${c.with === "young" ? "the young one" : "everyone at home"}, social and fun${c.id === "cook" ? ", and you eat" : ""}.`, undo: "Done is done. Nobody minds if you don't." }} onConfirm={() => act({ type: "family_chore", chore: c.id })}>{c.name}</ConfirmButton>
            ))}
          </div>
        </div>
      )}
      {p.family.map((m) => {
        const ago = day - m.lastContactDay;
        const value = amt[m.id] ?? (m.request ? String(m.request.amount) : "50");
        const minor = Math.round(Number(value || 0) * 100);
        const inTown = here === m.town;
        return (
          <div className="card col" key={m.id} style={{ gap: 6 }}>
            <div className="spread">
              <div><b>{m.name}</b><div className="tiny muted">{ROLE_LABEL[m.role]} · {m.age} · {CITIES[m.town]?.name ?? m.town} · <b>{WHEREABOUTS_LABEL[m.where]}</b></div></div>
              <div className="tiny muted" style={{ textAlign: "right" }}>{ago <= 0 ? "Talked today" : ago === 1 ? "Yesterday" : `${ago} days ago`}</div>
            </div>
            <div className="hud-bar"><label><span>Closeness</span><span className="num">{m.closeness}</span></label><Bar value={m.closeness} color={m.closeness > 60 ? "#3ddc84" : m.closeness > 35 ? "#f2b705" : "#ff7a6b"} /></div>
            {m.request && <div className="notice">🙏 Asking for help with {m.request.reason}: <b>GH₵{m.request.amount}</b> · {Math.max(0, m.request.dueDay - day)} days left. Optional: nothing bad happens if you can't.</div>}
            <div className="row" style={{ flexWrap: "wrap", gap: 6 }}>
              <button className="btn sm" disabled={busy} onClick={() => act({ type: "family_call", memberId: m.id })}>📞 Call</button>
              <input className="input num" style={{ width: 80 }} inputMode="decimal" value={value} onChange={(e) => setAmt({ ...amt, [m.id]: e.target.value.replace(/[^\d.]/g, "") })} />
              <button className="btn sm green" disabled={busy || minor <= 0 || minor > state.money.momo} onClick={() => act({ type: "family_send", memberId: m.id, amount: minor })}>Send on MoMo</button>
              {inTown ? <button className="btn sm primary" disabled={busy || m.where !== "home"} title={m.where !== "home" ? `${m.name.split(" ")[0]} is ${WHEREABOUTS_LABEL[m.where]}` : undefined} onClick={() => act({ type: "family_visit", memberId: m.id })}>🏡 Visit (2h)</button> : <button className="btn sm ghost" onClick={onTravel}>Travel to {CITIES[m.town]?.name ?? m.town}</button>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** Your own household: spouse, a baby on the way, children. */
function Household() {
  const { state, act, busy } = useGame();
  const [names, setNames] = useState<Record<number, string>>({});
  if (!state) return null;
  const p = state.player;
  const spouseRel = state.relationships.find((r) => r.stage === "married");
  const spouse = spouseRel ? NPC_BY_ID[spouseRel.npcId] : null;
  const plan = p.familyPlan;
  const day = state.time.day;
  return (
    <div className="card col" style={{ gap: 8 }}>
      <b>🏠 Your household</b>
      {spouse ? <div className="small">💍 Married to <b>{spouse.name}</b>, who pays half the rent, bills and children's costs.</div> : <div className="tiny muted">Just you for now. Marriage starts from People → your partner.</div>}
      {plan?.mode === "trying" && <div className="small">❤️ Trying for a baby. <button className="btn sm ghost" disabled={busy} onClick={() => act({ type: "household", step: "stop" })}>Wait for now</button></div>}
      {plan?.mode === "expecting" && <div className="notice ok">🤰 A baby is on the way: due in about {Math.max(0, plan.due - day)} days.</div>}
      {plan?.mode === "adopting" && <div className="notice ok">📝 Adoption in progress: your child comes home in about {Math.max(0, plan.due - day)} days.</div>}
      {!plan && (
        <div className="row" style={{ flexWrap: "wrap", gap: 6 }}>
          {spouse && <ConfirmButton className="btn sm" disabled={busy} ask="Try for a baby?" details={{ time: "It can take a few days or a few weeks", cost: "Nothing now; a child costs about GH₵300 a month, more with private school (your spouse pays half)", changes: "A baby arrives about three weeks after you find out. Children grow up a year every game month.", undo: "You can decide to wait any time before." }} onConfirm={() => act({ type: "household", step: "try" })}>👶 Try for a baby</ConfirmButton>}
          <ConfirmButton className="btn sm" disabled={busy} ask="Apply to adopt?" details={{ where: "The Social Welfare office near your home", time: `2 hours of forms; a child comes home in about ${ADOPTION_DAYS} days`, cost: `GH₵${ADOPTION_FEE.toLocaleString()} in assessment and court fees, then monthly costs`, changes: "A child aged 2 to 5 joins your household. You need a home with room (not a shared compound room).", undo: "No: this is a child's home." }} onConfirm={() => act({ type: "household", step: "adopt" })}>🧒 Adopt</ConfirmButton>
        </div>
      )}
      {p.children.map((c) => {
        const nm = names[c.id] ?? c.suggestions[0] ?? "";
        return (
          <div key={c.id} className="col" style={{ gap: 4, borderTop: "1px solid var(--line, #333)", paddingTop: 6 }}>
            <div className="spread"><b>{c.feminine ? "👧🏾" : "👦🏾"} {c.name || (c.age === 0 ? "Baby" : "Your child")}</b><span className="tiny muted">{c.age === 0 ? "baby" : `${c.age} yrs`}{c.adopted ? " · adopted" : ""} · GH₵{c.monthly}/mo</span></div>
            <div className="tiny muted">Closeness {c.closeness}{c.age >= SCHOOL_AGE ? ` · ${c.school} school · learning ${c.learning}` : ""}{c.age >= GROWN_AGE ? " · grown up" : ""}</div>
            {!c.name && (
              <div className="row" style={{ flexWrap: "wrap", gap: 6 }}>
                <input className="input" style={{ width: 130 }} value={nm} maxLength={20} onChange={(e) => setNames({ ...names, [c.id]: e.target.value })} />
                {c.suggestions.map((sname) => <button key={sname} className="btn sm ghost" onClick={() => setNames({ ...names, [c.id]: sname })}>{sname}</button>)}
                <ConfirmButton className="btn sm primary" disabled={busy || (c.namingFrom !== null && day < c.namingFrom)} ask={c.adopted ? `Name your child ${nm}?` : `${namingName(p.hometown)} for ${nm}?`} details={{ where: "At home or in your hometown", time: c.adopted ? "A moment" : "3 hours at dawn", cost: c.adopted ? "Nothing" : `GH₵${NAMING_COST} for drinks and food`, changes: c.adopted ? "Their name." : "The elders bring the baby out, touch water and drink to the tongue, and say the name. Family closeness up.", undo: "A name is for life." }} onConfirm={() => act({ type: "household", step: "name", childId: c.id, name: nm })}>{c.namingFrom !== null && day < c.namingFrom ? `Naming from day 8 (${c.namingFrom - day}d)` : "Name"}</ConfirmButton>
              </div>
            )}
            {c.age < GROWN_AGE && (
              <div className="row" style={{ flexWrap: "wrap", gap: 6 }}>
                <button className="btn sm" disabled={busy || c.playedToday} onClick={() => act({ type: "household", step: "play", childId: c.id })}>{c.playedToday ? "Spent time today ✓" : c.age >= SCHOOL_AGE ? "📚 Homework & play (1h)" : "🧸 Play (1h)"}</button>
                {c.age >= SCHOOL_AGE - 1 && <button className="btn sm ghost" disabled={busy} onClick={() => act({ type: "household", step: "school", childId: c.id, school: c.school === "public" ? "private" : "public" })}>Switch to {c.school === "public" ? "private" : "public"} school</button>}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
