import { REGIONAL_AVATAR_COLORS } from "../../shared/people-regional.ts";
import { TOWNSFOLK_COLORS } from "../../shared/townsfolk.ts";
import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { formatMoney } from "../../shared/money.ts";
import { NPC_BY_ID } from "../../shared/people.ts";
import type { Effects } from "../../shared/world.ts";

export const money = (m: number, compact = false) => formatMoney(m, "GHS", { compact });
export const usd = (m: number) => formatMoney(m, "USD");

const KEY_LABEL: Record<string, [string, string]> = {
  energy: ["⚡", "Energy"],
  hunger: ["🍲", "Food"],
  health: ["❤️", "Body"],
  social: ["💬", "Social"],
  work: ["💼", "Work"],
  fitness: ["💪", "Fitness"],
  charisma: ["✨", "Charisma"],
  business: ["📈", "Business"],
  reputation: ["⭐", "Standing"],
  cash: ["💵", "Cash"],
  bank: ["🏦", "Bank"],
  momo: ["📱", "MoMo"],
  usd: ["💲", "Dollars"],
  tbill: ["📜", "T-bills"],
  loan: ["🧾", "Loan"],
  payroll: ["🗓️", "Salary due"],
  bills: ["🧾", "Bills"],
  credit: ["📉", "Credit"],
};

export function changeLabel(k: string): [string, string] {
  if (k.startsWith("rel:")) {
    const n = NPC_BY_ID[k.slice(4)];
    return ["💛", n ? n.name.replace(/“.*”\s*/, "").split(" ").slice(0, n.name.startsWith("Auntie") || n.name.startsWith("Mr") || n.name.startsWith("Dr") || n.name.startsWith("Uncle") ? 2 : 1).join(" ") : "Friend"];
  }
  if (k.startsWith("biz")) return ["🏪", "Business"];
  return KEY_LABEL[k] ?? ["•", k];
}

const MONEY_KEYS = new Set(["cash", "bank", "tbill", "loan", "payroll", "bills", "business"]);

export function Delta({ k, d }: { k: string; d: number }) {
  const [icon, name] = changeLabel(k);
  const isMoney = MONEY_KEYS.has(k) || k.startsWith("biz");
  const value = k === "usd" ? usd(Math.abs(d)) : isMoney ? money(Math.abs(d)) : Math.abs(Math.round(d * 10) / 10);
  const good = k === "loan" ? d < 0 : d > 0;
  return (
    <span className={`delta ${good ? "up" : "down"}`}>
      {icon} {name} {d > 0 ? "+" : "−"}
      {value}
    </span>
  );
}

export function EffectsPreview({ effects }: { effects: Effects }) {
  return (
    <div className="effects">
      {Object.entries(effects).map(([k, v]) => (v ? <Delta key={k} k={k} d={v} /> : null))}
    </div>
  );
}

export function Sparkline({ values, color = "#F2B705", height = 40 }: { values: number[]; color?: string; height?: number }) {
  if (values.length < 2) return <svg className="spark" style={{ height }} />;
  const min = Math.min(...values), max = Math.max(...values);
  const span = max - min || 1;
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * 100},${height - 4 - ((v - min) / span) * (height - 8)}`).join(" ");
  return (
    <svg className="spark" viewBox={`0 0 100 ${height}`} preserveAspectRatio="none" style={{ height }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth={2} vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
    </svg>
  );
}

export function Bar({ value, color }: { value: number; color: string }) {
  return (
    <div className="bar">
      <i style={{ width: `${Math.max(0, Math.min(100, value))}%`, background: color }} />
    </div>
  );
}

export function statColor(v: number) {
  return v > 60 ? "#3ddc84" : v > 30 ? "#f2b705" : "#ff6b5a";
}

export function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}

export function Sheet({ title, sub, onClose, children, wide }: { title: ReactNode; sub?: ReactNode; onClose: () => void; children: ReactNode; wide?: boolean }) {
  return (
    <div className="sheet-wrap" onClick={onClose}>
      <div className={`sheet ${wide ? "talk" : ""}`} onClick={(e) => e.stopPropagation()}>
        <div className="spread" style={{ alignItems: "flex-start" }}>
          <div className="grow">
            <h2>{title}</h2>
            {sub && <div className="muted small" style={{ marginTop: 4 }}>{sub}</div>}
          </div>
          <button className="close" onClick={onClose} aria-label="Close">✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

export const WEATHER_ICON: Record<string, string> = { sunny: "☀️", cloudy: "⛅", hazy: "🌫️", rain: "🌧️", storm: "⛈️" };

export function clock12(hour: number, min: number) {
  const h = hour % 12 || 12;
  return `${h}:${String(min).padStart(2, "0")} ${hour < 12 ? "AM" : "PM"}`;
}

export const AVATAR_COLORS: Record<string, string> = {
  esi: "#E0A526", kobby: "#2E86AB", akosua: "#1F3A5F", selasi: "#E35D3A", nii: "#3E5641",
  tetteh: "#7A6A5A", yaa: "#B03A62", adjei: "#3A4A5A", efua: "#1F7A4D", ebo: "#C8452C",
  ...REGIONAL_AVATAR_COLORS,
  ...TOWNSFOLK_COLORS,
};

export function initials(name: string) {
  return name.replace(/“.*”\s*/, "").replace(/^(Auntie|Mr\.|Dr\.|Uncle)\s+/, "").split(" ").map((p) => p[0]).slice(0, 2).join("");
}

/** Two-tap confirmation built into the button (browser confirm() dialogs aren't available everywhere). */
/** What a decision costs and changes, shown before you commit (the five questions). */
export interface Consequences {
  /** Where it happens, if not obvious. */
  where?: string;
  time?: string;
  cost?: string;
  changes: string;
  /** Can it be undone, and how? */
  undo: string;
}

/**
 * A button for decisions that matter. With `details`, a confirmation card says
 * what happens, how long it takes, what it costs, what changes and whether it
 * can be undone; without, it asks for a second tap.
 */
export function ConfirmButton({ className, disabled, onConfirm, children, ask, details }: { className?: string; disabled?: boolean; onConfirm: () => void; children: ReactNode; ask: string; details?: Consequences }) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed || details) return;
    const t = setTimeout(() => setArmed(false), 4000);
    return () => clearTimeout(t);
  }, [armed, details]);
  if (details) {
    return (
      <>
        <button className={className ?? "btn sm"} disabled={disabled} onClick={() => setArmed(true)}>{children}</button>
        {armed && createPortal(
          <div className="modal-wrap confirm-wrap" onClick={() => setArmed(false)}>
            <div className="modal confirm" onClick={(e) => e.stopPropagation()}>
              <h3 style={{ marginTop: 0 }}>{ask}</h3>
              <div className="col" style={{ gap: 6 }}>
                {details.where && <div className="kv"><span>📍 Where</span><span>{details.where}</span></div>}
                {details.time && <div className="kv"><span>⏱️ Time</span><span>{details.time}</span></div>}
                {details.cost && <div className="kv"><span>💵 Cost</span><span className="num">{details.cost}</span></div>}
                <div className="confirm-line"><b>What changes</b><div className="small muted">{details.changes}</div></div>
                <div className="confirm-line"><b>Can I undo it?</b><div className="small muted">{details.undo}</div></div>
              </div>
              <div className="row" style={{ marginTop: 12, gap: 8 }}>
                <button className="btn ghost grow" onClick={() => setArmed(false)}>Not now</button>
                <button className="btn primary grow" onClick={() => { setArmed(false); onConfirm(); }}>Confirm</button>
              </div>
            </div>
          </div>,
          document.body,
        )}
      </>
    );
  }
  return (
    <button className={`${className ?? "btn sm"} ${armed ? "danger" : ""}`} disabled={disabled} title={ask} onClick={() => (armed ? (setArmed(false), onConfirm()) : setArmed(true))}>
      {armed ? `${ask} Tap again` : children}
    </button>
  );
}
