import { useEffect, useRef, useState } from "react";
import { useGame } from "../store.tsx";
import { Bar, Delta, WEATHER_ICON, clock12, money, statColor } from "./common.tsx";
import type { World, Nearby } from "../world/World.ts";
import { toGameDate } from "../../shared/calendar.ts";
import { DISTRICTS, type DistrictId } from "../../shared/world.ts";
import { NPC_BY_ID } from "../../shared/people.ts";
import { NEEDS } from "../../shared/mood.ts";
import { fmtHour, outageWindow, powerOff } from "../../shared/power.ts";

export function Hud({ world, onOpen }: { world: World | null; onOpen: (what: string) => void }) {
  const { state, football } = useGame();
  const [, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((x) => x + 1), 1000);
    return () => clearInterval(t);
  }, []);
  const [moodOpen, setMoodOpen] = useState(false);
  if (!state) return null;
  const mood = state.player.mood;
  const minute = world ? Math.floor(world.minuteNow) : state.time.minute;
  const gd = toGameDate(minute);
  const s = state.player.stats;
  const net = state.money.monthlyIncome - state.money.monthlyExpenses;
  const nextDate = state.dates.find((d) => (d as { status: string }).status === "pending") as { npcId: string; startMin: number } | undefined;
  const liveMatches = football?.fixtures.filter((f) => f.status === "live").length ?? 0;
  return (
    <div className="hud-top">
      <div className="hud-card">
        <div className="hud-line1">
          <span className="weather-dot" title={state.time.weather}>{gd.isNight && state.time.weather === "sunny" ? "🌙" : WEATHER_ICON[state.time.weather]}</span>
          <span className="hud-clock num">{clock12(gd.hour, gd.min)}</span>
          <span className="hud-date">{gd.weekday.slice(0, 3)} {gd.date} {gd.monthName.slice(0, 3)} · {gd.season}</span>
          <div className="hud-cash num" onClick={() => onOpen("money")} style={{ cursor: "pointer" }}>
            <b>{money(state.money.cash)}</b>
            <span>Net worth {money(state.money.netWorth, true)}</span>
          </div>
        </div>
        <div className="hud-needs">
          <button className="mood-face" onClick={() => setMoodOpen((o) => !o)} title={`${mood.label} — tap for why`}>
            <span>{mood.face}</span>
            <small>{mood.label}</small>
          </button>
          <div className="hud-bars six">
            {NEEDS.map((n) => {
              const v = (s as Record<string, number>)[n.key] ?? 0;
              return (
                <div className="hud-bar" key={n.key} title={`${n.label} ${Math.round(v)} — ${n.tip}`}>
                  <label><span>{n.icon} <i>{n.label}</i></span><span className="num">{Math.round(v)}</span></label>
                  <Bar value={v} color={statColor(v)} />
                </div>
              );
            })}
          </div>
        </div>
        {moodOpen && (
          <div className="mood-pop" onClick={() => setMoodOpen(false)}>
            <b>{mood.face} {mood.label}</b>
            {mood.moodlets.length === 0 && <div className="tiny muted">Nothing special today.</div>}
            {mood.moodlets.map((m) => (
              <div className="moodlet" key={m.id}>
                <span className="ml-icon">{m.icon}</span>
                <div className="grow"><div className="small bold">{m.label}</div><div className="tiny muted">{m.why}</div></div>
                <span className={`ml-val ${m.value > 0 ? "up" : "down"}`}>{m.value > 0 ? "+" : ""}{m.value}</span>
              </div>
            ))}
            <div className="tiny muted" style={{ marginTop: 6 }}>Low needs: {NEEDS.filter((n) => ((s as Record<string, number>)[n.key] ?? 100) < 35).map((n) => `${n.icon} ${n.tip}`).join(" ") || "none — you're doing well."}</div>
          </div>
        )}
      </div>
      <div className="hud-chips">
        <button className={`chip ${net >= 0 ? "green" : ""}`} onClick={() => onOpen("money")}>{net >= 0 ? "+" : "−"}{money(Math.abs(net), true)} a month ›</button>
        {powerOff(state.player.district, minute) && <span className="chip alert" title="Scheduled power cut (dumsor)">🕯️ Lights off till {fmtHour(outageWindow(state.player.district, Math.floor(minute / 1440))![1])}</span>}
        <button className={`chip ${state.player.daily.goals.every((g) => g.done) ? "green" : ""}`} onClick={() => onOpen("today")}>🎯 Today {state.player.daily.goals.filter((g) => g.done).length}/3</button>
        <span className="chip">⭐ {Math.round(state.player.reputation)} standing</span>
        {state.event && <button className="chip alert" onClick={() => onOpen("event")}>📱 {state.event.title}</button>}
        {nextDate && <button className="chip" onClick={() => onOpen("people")}>📅 Date with {NPC_BY_ID[nextDate.npcId].name.split(" ")[0]} · {toGameDate(nextDate.startMin).clock}</button>}
        {state.rentArrears > 0 && <button className="chip alert" onClick={() => onOpen("property")}>🏚️ Rent arrears</button>}
        <button className="chip" onClick={() => onOpen("bet")}>⚽ Football{liveMatches ? ` · ${liveMatches} live` : ""}</button>
      </div>
    </div>
  );
}

export function Minimap({ world, road, district, onOpen }: { world: World | null; road: string; district: DistrictId; onOpen?: () => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    let raf = 0;
    const draw = () => {
      raf = requestAnimationFrame(draw);
      const c = ref.current;
      const m = world?.minimap();
      if (!c || !m) return;
      const ctx = c.getContext("2d")!;
      const S = 232;
      if (c.width !== S) c.width = c.height = S;
      const scale = 1.25; // px per metre
      ctx.save();
      ctx.clearRect(0, 0, S, S);
      ctx.beginPath();
      ctx.arc(S / 2, S / 2, S / 2, 0, Math.PI * 2);
      ctx.clip();
      ctx.fillStyle = district === "trasacco" || district === "east_legon" ? "#5d7448" : "#7a5a44";
      ctx.fillRect(0, 0, S, S);
      ctx.translate(S / 2, S / 2);
      ctx.rotate(m.camYaw - Math.PI);
      ctx.scale(scale, scale);
      ctx.translate(-m.x, -m.z);
      if (m.coastal) {
        ctx.fillStyle = "#dcc79c";
        ctx.fillRect(-120, 10, 240, m.coastal - 10);
        ctx.fillStyle = "#2a8fb0";
        ctx.fillRect(-120, m.coastal, 240, 120);
      }
      ctx.fillStyle = "#cfc6b4";
      ctx.fillRect(-120, -10, 240, 20);
      ctx.fillRect(-8, -120, 16, m.coastal ? 120 : 240);
      ctx.fillRect(-8, m.coastal ? -120 : -120, 16, m.coastal ? 120 : 240);
      ctx.fillStyle = "#3c3d40";
      ctx.fillRect(-120, -6, 240, 12);
      ctx.fillRect(-5, -120, 10, m.coastal ? 126 : 240);
      ctx.strokeStyle = "#e8b923";
      ctx.lineWidth = 0.6;
      ctx.beginPath();
      ctx.moveTo(-120, 0);
      ctx.lineTo(120, 0);
      ctx.stroke();
      const dot = (x: number, z: number, color: string, r = 3.2) => {
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(x, z, r / scale * 1.6, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "#fff";
        ctx.lineWidth = 0.8;
        ctx.stroke();
      };
      for (const p of m.places) dot(p.x, p.z, p.kind === "transport" ? "#f2b705" : p.kind === "bank" ? "#0e7c86" : p.kind === "food" ? "#e35d3a" : p.kind === "nightlife" ? "#a24ae0" : "#ffffff");
      for (const n of m.npcs) dot(n.x, n.z, "#f2b705", 2.6);
      if (m.home) dot(m.home.x, m.home.z, "#3ddc84", 4);
      if (m.target) dot(m.target.x, m.target.z, "#F2B705", 6);
      if (m.walking) { ctx.strokeStyle = "#3ddc84"; ctx.lineWidth = 1.2; ctx.setLineDash([3, 2]); ctx.beginPath(); ctx.moveTo(m.x, m.z); ctx.lineTo(m.walking.x, m.walking.z); ctx.stroke(); ctx.setLineDash([]); dot(m.walking.x, m.walking.z, "#3ddc84", 5); }
      dot(m.plot.x, m.plot.z, "#c8452c", 2.4);
      ctx.restore();
      // Player arrow (screen-space, the map rotates around it).
      ctx.save();
      ctx.translate(S / 2, S / 2);
      ctx.rotate(-(m.yaw - m.camYaw) + Math.PI);
      ctx.fillStyle = "#ff3b30";
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, -11);
      ctx.lineTo(8, 9);
      ctx.lineTo(0, 4);
      ctx.lineTo(-8, 9);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
      // North marker from the district's real road bearing: scene north = (cos B, -sin B) in (x, z).
      const B = (m.bearing * Math.PI) / 180;
      const nx = Math.cos(B), nz = -Math.sin(B);
      const rot = m.camYaw - Math.PI;
      const sx = nx * Math.cos(rot) - nz * Math.sin(rot), sz = nx * Math.sin(rot) + nz * Math.cos(rot);
      ctx.fillStyle = "#fff";
      ctx.font = "800 20px system-ui";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("N", S / 2 + sx * (S / 2 - 16), S / 2 + sz * (S / 2 - 16));
    };
    draw();
    return () => cancelAnimationFrame(raf);
  }, [world, district]);
  return (
    <div className="minimap">
      <canvas ref={ref} onClick={onOpen} title="Open the map (M)" style={{ cursor: "pointer" }} />
      <div className="where">
        <small>{DISTRICTS[district].name}</small>
        <b>{road}</b>
      </div>
    </div>
  );
}

export function Rail({ onOpen, badges, world, muted, setMuted }: { onOpen: (w: string) => void; badges: { phone: number; people: number }; world: World | null; muted: boolean; setMuted: (m: boolean) => void }) {
  return (
    <div className="rail">
      <button onClick={() => onOpen("home")} title="Go home (H)" className="home-btn">🏠</button>
      <button onClick={() => onOpen("phone")} title="Phone (P)">📱{badges.phone > 0 && <span className="badge">{badges.phone}</span>}</button>
      <button onClick={() => onOpen("map")} title="Map (M)">🗺️</button>
      <button onClick={() => onOpen("people")} title="People">💬{badges.people > 0 && <span className="badge">{badges.people}</span>}</button>
      <button onClick={() => world?.zoom(-1)} title="Zoom in">＋</button>
      <button onClick={() => world?.zoom(1)} title="Zoom out">－</button>
      <button onClick={() => setMuted(!muted)} title="Sound">{muted ? "🔇" : "🔊"}</button>
    </div>
  );
}

const NEARBY_TEXT: Record<Nearby["kind"], (n: Nearby) => string> = {
  npc: (n) => `Talk to ${n.label.replace(/“.*”\s*/, "").split(" ").slice(0, n.label.startsWith("Auntie") || n.label.startsWith("Mr") || n.label.startsWith("Dr") || n.label.startsWith("Uncle") ? 2 : 1).join(" ")}`,
  place: (n) => `Enter ${n.label}`,
  home: () => "Go inside",
  stop: () => "Catch a ride",
  plot: () => "Look at the plot",
  taxi: () => "✋ Stop this taxi",
  bed: () => "Sleep",
  exit: () => "Go outside",
  homespot: (n) => n.label,
  car: (n) => `🚗 Drive your ${n.label}`,
  car_exit: () => "Get out & park",
  family: () => "🏡 Greet your family",
};

export function ActionBar({ nearby, onUse }: { nearby: Nearby | null; onUse: () => void }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === "INPUT") return;
      if ((e.key === "e" || e.key === "E" || e.key === "Enter") && nearby) onUse();
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [nearby, onUse]);
  if (!nearby) return null;
  return (
    <div className="action-bar">
      <button className="action-btn" onClick={onUse} key={`${nearby.kind}:${nearby.id}`}>
        {NEARBY_TEXT[nearby.kind](nearby)} <kbd>E</kbd>
      </button>
    </div>
  );
}

export function Joystick({ world }: { world: World | null }) {
  const ref = useRef<HTMLDivElement>(null);
  const knob = useRef<HTMLElement>(null);
  const [run, setRun] = useState(false);
  const [touch] = useState(() => matchMedia("(pointer: coarse)").matches);
  useEffect(() => {
    if (world) world.run = run;
  }, [run, world]);
  if (!touch) return null;
  const move = (e: React.PointerEvent) => {
    const r = ref.current!.getBoundingClientRect();
    const dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
    const max = r.width / 2 - 20;
    const len = Math.min(max, Math.hypot(dx, dy));
    const a = Math.atan2(dy, dx);
    const x = Math.cos(a) * len, y = Math.sin(a) * len;
    if (knob.current) knob.current.style.transform = `translate(${x}px, ${y}px)`;
    if (world) world.joy = { x: x / max, y: -y / max };
  };
  const end = () => {
    if (knob.current) knob.current.style.transform = "";
    if (world) world.joy = { x: 0, y: 0 };
  };
  return (
    <>
      <div className="joystick" ref={ref} onPointerDown={(e) => { (e.target as HTMLElement).setPointerCapture(e.pointerId); world?.audio.start(); move(e); }} onPointerMove={(e) => e.buttons && move(e)} onPointerUp={end} onPointerCancel={end}>
        <i ref={knob} />
      </div>
      <button className={`run-btn ${run ? "on" : ""}`} onClick={() => setRun(!run)} aria-label="Run">🏃🏾</button>
      <button className="run-btn jump-btn" onClick={() => world?.jump()} aria-label="Jump">⤒</button>
    </>
  );
}

export function Toasts() {
  const { toasts, dismiss } = useGame();
  return (
    <div className="toasts">
      {toasts.map((t) => (
        <div key={t.id} className={`toast ${t.tone ?? ""}`} onClick={() => dismiss(t.id)}>
          <div>{t.text}</div>
          {t.changes.length > 0 && (
            <div className="chips">
              {t.changes.map((c, i) => <Delta key={i} k={c.k} d={c.d} />)}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
