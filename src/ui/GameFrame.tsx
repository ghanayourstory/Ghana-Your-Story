import { useEffect, useState } from "react";
import { DAILY_GOALS } from "../../shared/daily.ts";
import { NEEDS } from "../../shared/mood.ts";
import { DISTRICTS, type DistrictId } from "../../shared/world.ts";
import { money, statColor, WEATHER_ICON } from "./common.tsx";
import { useGame } from "../store.tsx";
import type { World } from "../world/World.ts";
import { toGameDate } from "../../shared/calendar.ts";
import { Minimap } from "./hud.tsx";
import { NPC_BY_ID } from "../../shared/people.ts";
import { fmtHour, outageWindow, powerOff } from "../../shared/power.ts";

type OpenGamePage = (page: string) => void;

const GOAL_DESTINATION: Record<string, string> = {
  shift: "work", job_hunt: "work", class: "work",
  eat_local: "chop", cook: "home", clean: "home",
  talk: "people", family: "family", worship: "map",
  trotro: "map", drive: "garage", explore: "map",
  save: "money", fun: "map", exercise: "map",
  business: "hustle", trade: "hustle", farm: "farm", post: "vibes",
};

/** The rebuilt play HUD: keeps the living scene open and puts the next move in reach. */
export function GameFrame({
  world, district, road, onOpen, muted, setMuted,
}: {
  world: World | null;
  district: DistrictId;
  road: string;
  onOpen: OpenGamePage;
  muted: boolean;
  setMuted: (muted: boolean) => void;
}) {
  const { state } = useGame();
  const [showTasks, setShowTasks] = useState(false);
  const [, setSecond] = useState(0);
  useEffect(() => {
    const timer = window.setInterval(() => setSecond((s) => s + 1), 1000);
    return () => window.clearInterval(timer);
  }, []);
  if (!state) return null;

  const minute = world ? Math.floor(world.minuteNow) : state.time.minute;
  const day = toGameDate(minute);
  const place = DISTRICTS[district];
  const tasks = state.player.daily.goals.map((goal) => ({
    ...goal,
    definition: DAILY_GOALS[goal.id],
  })).filter((goal) => goal.definition);
  const monthlyNet = state.money.monthlyIncome - state.money.monthlyExpenses;
  const pendingDate = state.dates.find((date) => (date as { status?: string }).status === "pending") as { npcId?: string; startMin?: number } | undefined;
  const pendingDateName = pendingDate?.npcId ? NPC_BY_ID[pendingDate.npcId]?.name.split(" ")[0] : null;
  const outage = powerOff(state.player.district, minute) ? outageWindow(state.player.district, Math.floor(minute / 1440)) : null;
  const needsDestination: Record<string, string> = {
    hunger: "chop", energy: "home", bladder: "home", hygiene: "home", fun: "map", social: "people",
  };
  const lowest = [...NEEDS].sort((a, b) =>
    ((state.player.stats as Record<string, number>)[a.key] ?? 100) - ((state.player.stats as Record<string, number>)[b.key] ?? 100),
  )[0];
  const lowValue = lowest ? (state.player.stats as Record<string, number>)[lowest.key] ?? 100 : 100;
  const suggestion = lowValue < 28
    ? `${lowest.icon} ${lowest.label} is running low. Take care of yourself before the next shift.`
    : state.player.job
      ? "Keep the day moving: work, look after home, or catch up with someone nearby."
      : "Start with a local job, meet your neighbours, and make this part of Ghana yours.";

  const pages: { icon: string; title: string; key: string; badge?: number }[] = [
    { icon: "◷", title: "Today", key: "today" },
    { icon: "⌖", title: "Explore Ghana", key: "map" },
    { icon: "▤", title: "Work", key: "work" },
    { icon: "⌂", title: "Home", key: "home" },
    { icon: "♙", title: "People", key: "people", badge: state.dates.filter((d) => (d as { status?: string }).status === "pending").length },
    { icon: "▦", title: "Phone & apps", key: "phone" },
  ];

  return (
    <div className="game-frame">
      <header className="game-topbar">
        <button className="game-brand" onClick={() => onOpen("today")} aria-label="Open today's plan">
          <span className="game-brand-mark">G</span>
          <span><b>GHANA</b><small>YOUR STORY</small></span>
        </button>
        <div className="game-place">
          <span className="game-place-pin">●</span>
          <span><b>{place.name}</b><small>{road || place.city} · {place.city}</small></span>
        </div>
        <div className="game-time"><b>{day.clock}</b><small>{day.weekday}, {day.date} {day.monthName}</small></div>
        <button className="game-wallet" onClick={() => onOpen("money")} title="Open SikaBank" aria-label={`Cash ${money(state.money.cash)}, bank ${money(state.money.bank)}. Open SikaBank`}>
          <span><small>CASH</small><b>{money(state.money.cash, true)}</b></span>
          <i />
          <span><small>BANK</small><b>{money(state.money.bank, true)}</b></span>
        </button>
        <button className="game-icon-button game-audio" onClick={() => setMuted(!muted)} aria-label={muted ? "Turn sound on" : "Mute sound"} title={muted ? "Sound off" : "Sound on"}>{muted ? "◖" : "◖))"}</button>
        <div className="game-vitals" aria-label="Your mood and needs">
          <span className="game-mood" title={state.player.mood.moodlets.map((m) => `${m.label}: ${m.why}`).join(" · ") || "You are doing well."}>
            <b>{state.player.mood.face}</b><small>{state.player.mood.label}</small>
          </span>
          {NEEDS.map((need) => {
            const value = Math.max(0, Math.min(100, (state.player.stats as Record<string, number>)[need.key] ?? 100));
            return (
              <button key={need.key} className={`game-need${value < 25 ? " is-low" : ""}`} onClick={() => onOpen(needsDestination[need.key] ?? "today")} title={`${need.label}: ${Math.round(value)}%. ${need.tip}`} aria-label={`${need.label}, ${Math.round(value)} percent. Open ${needsDestination[need.key] === "home" ? "home" : needsDestination[need.key] === "chop" ? "food" : needsDestination[need.key] === "people" ? "people" : "nearby activities"}`}>
                <span>{need.icon}</span><i><i style={{ width: `${value}%`, background: statColor(value) }} /></i><b>{Math.round(value)}</b>
              </button>
            );
          })}
        </div>
      </header>

      <nav className="game-nav" aria-label="Game sections">
        <div className="game-nav-label">YOUR LIFE</div>
        {pages.map((page) => (
          <button key={page.key} className="game-nav-button" onClick={() => onOpen(page.key)} title={page.title} aria-label={page.title}>
            <span className="game-nav-icon">{page.icon}</span><span>{page.title}</span>
            {!!page.badge && <i className="game-nav-badge">{page.badge}</i>}
          </button>
        ))}
        <div className="game-nav-spacer" />
        <button className="game-nav-button subdued" onClick={() => onOpen("settings")} title="Settings" aria-label="Settings"><span className="game-nav-icon">⚙</span><span>Settings</span></button>
      </nav>

      <Minimap world={world} road={road} district={district} onOpen={() => onOpen("map")} />

      <section className={`day-board${showTasks ? " is-open" : ""}`} aria-label="Today's plan">
        <div className="day-board-head">
          <div><span className="eyebrow">DAY {Math.floor(minute / 1440) + 1} · {day.season}</span><h1>Make today count.</h1></div>
          <span className="day-weather" title={state.time.weather}>{WEATHER_ICON[state.time.weather]}</span>
          <button className="day-board-toggle" onClick={() => setShowTasks((open) => !open)} aria-expanded={showTasks} aria-label={showTasks ? "Close today's plan" : "Open today's plan"}>{showTasks ? "⌄" : "＋"}</button>
        </div>
        <p className="day-nudge">{suggestion}</p>
        <div className="day-life-stats">
          <button onClick={() => onOpen("money")} title="Open your monthly statement" className={monthlyNet < 0 ? "is-negative" : ""}>
            <span>{monthlyNet < 0 ? "−" : "+"}</span>{money(Math.abs(monthlyNet), true)}<small>/ month</small>
          </button>
          <button onClick={() => onOpen("money")} title="Open your net-worth breakdown">💰 {money(state.money.netWorth, true)}<small> net worth</small></button>
          <span title="Local standing">⭐ {Math.round(state.player.reputation)} standing</span>
        </div>
        {(state.event || pendingDateName || state.rentArrears > 0 || outage) && (
          <div className="game-alerts" aria-label="Time-sensitive updates">
            {state.event && <button className="is-alert" onClick={() => onOpen("event")}>📱 {state.event.title}</button>}
            {pendingDateName && pendingDate?.startMin !== undefined && <button onClick={() => onOpen("people")}>📅 Date with {pendingDateName} · {toGameDate(pendingDate.startMin).clock}</button>}
            {state.rentArrears > 0 && <button className="is-alert" onClick={() => onOpen("property")}>🏚️ Rent arrears · {money(state.rentArrears)}</button>}
            {outage && <button className="is-alert" onClick={() => onOpen("today")}>🕯️ Power out until {fmtHour(outage[1])}</button>}
          </div>
        )}
        <div className="day-task-list">
          {tasks.map(({ id, done, progress, definition }) => (
            <button
              key={id}
              className={`day-task${done ? " is-done" : ""}`}
              onClick={() => onOpen(done ? "today" : GOAL_DESTINATION[id] ?? "today")}
              aria-label={done ? `${definition.label}, completed. Open daybook` : `Start goal: ${definition.label}`}
              title={done ? "Open your daybook" : "Go to this activity"}
            >
              <span className="day-task-check">{done ? "✓" : definition.icon}</span>
              <span className="day-task-copy"><b>{definition.label}</b><small>{done ? "Done for today" : definition.hint}</small></span>
              <span className="day-task-progress">{done ? "DONE" : progress > 0 ? `${progress}/${definition.target}` : "›"}</span>
            </button>
          ))}
        </div>
        <button className="day-journal" onClick={() => onOpen("today")}>Open your daybook <span>→</span></button>
      </section>

      <div className="world-help"><span className="world-help-dot" /> WASD / arrows to walk <i /> E to interact <i /> drag to look</div>
    </div>
  );
}
