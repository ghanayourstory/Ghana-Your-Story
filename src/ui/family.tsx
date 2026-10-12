// Phone → Family: the people at home. Call them, send MoMo, or travel home to visit.
import { useState } from "react";
import { useGame } from "../store.tsx";
import { Bar, money } from "./common.tsx";
import { CITIES } from "../../shared/cities.ts";
import { DISTRICTS } from "../../shared/world.ts";
import { ROLE_LABEL, WHEREABOUTS_LABEL, choresFor } from "../../shared/family.ts";
import { ConfirmButton } from "./common.tsx";

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
