import { BUILD_VERSION } from "../version.ts";
import { MarriagePanel } from "./sheets.tsx";
import { LANGUAGES, MAX_LANGUAGES, MAX_PRIORITIES, PRIORITIES } from "../../shared/identity.ts";
import { gigVehicle, startGigShift } from "./gig.ts";
import { getCaptions, getReduceMotion, getUiScale, setCaptions, setReduceMotion, setUiScale, type UiScale } from "./a11y.ts";
import { FamilyApp } from "./family.tsx";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useGame } from "../store.tsx";
import { AVATAR_COLORS, Bar, ConfirmButton, Delta, EffectsPreview, Sparkline, WEATHER_ICON, clock12, initials, money, usd, useNow } from "./common.tsx";
import { toGameDate, formatDuration } from "../../shared/calendar.ts";
import { BUSINESSES, DESIGNS, PLOTS, QUALITY, QUALITY_ORDER, RENTALS, TBILLS, builtValue, stagePlan, type Quality } from "../../shared/economy.ts";
import { CITIES } from "../../shared/cities.ts";
import { DISTRICTS, JOBS, PLACE_BY_ID, SERVICES, priceFor, rankPay } from "../../shared/world.ts";
import { GOALS } from "../../shared/progress.ts";
import { NPC_BY_ID, NPCS } from "../../shared/people.ts";
import type { World } from "../world/World.ts";
import { FarmApp, GarageApp, GhanaApp, VibesApp } from "./ghana.tsx";
import type { GameState } from "../../server/engine.ts";
import type { Quality as GfxQuality } from "../world/World.ts";

type AppId = "home" | "dream" | "hustle" | "work" | "money" | "people" | "news" | "chop" | "property" | "bet" | "settings" | "ghana" | "vibes" | "farm" | "garage" | "family" | "story";

const APPS: { id: AppId | "map" | "ride"; name: string; icon: string; bg: string }[] = [
  { id: "dream", name: "Dream", icon: "⭐", bg: "linear-gradient(160deg,#ffd34d,#f2a900)" },
  { id: "story", name: "Story", icon: "📖", bg: "linear-gradient(160deg,#ffb38a,#b5562a)" },
  { id: "hustle", name: "Hustle", icon: "🏪", bg: "linear-gradient(160deg,#ff9a3c,#e8590c)" },
  { id: "work", name: "Work", icon: "💼", bg: "linear-gradient(160deg,#7c83ff,#4c56d9)" },
  { id: "money", name: "SikaBank", icon: "🏦", bg: "linear-gradient(160deg,#3ddc84,#1f7a4d)" },
  { id: "people", name: "People", icon: "👥", bg: "linear-gradient(160deg,#ff7a6b,#d6453a)" },
  { id: "family", name: "Family", icon: "👪", bg: "linear-gradient(160deg,#f6a5c0,#c2185b)" },
  { id: "news", name: "News", icon: "📰", bg: "linear-gradient(160deg,#a5adb8,#6b7480)" },
  { id: "map", name: "Map", icon: "🗺️", bg: "linear-gradient(160deg,#5ec8f2,#1d84c4)" },
  { id: "bet", name: "Bet", icon: "⚽", bg: "linear-gradient(160deg,#2fa36a,#0d5a35)" },
  { id: "ride", name: "Ride", icon: "🚕", bg: "linear-gradient(160deg,#ffe066,#f2b705)" },
  { id: "chop", name: "Chop", icon: "🍲", bg: "linear-gradient(160deg,#ff8a5c,#d6453a)" },
  { id: "property", name: "Property", icon: "🏘️", bg: "linear-gradient(160deg,#b58cff,#6f42c1)" },
  { id: "ghana", name: "Ghana", icon: "🇬🇭", bg: "linear-gradient(160deg,#ce1126,#fcd116 55%,#006b3f)" },
  { id: "vibes", name: "Vibes", icon: "📸", bg: "linear-gradient(160deg,#8e2de2,#f2b705)" },
  { id: "farm", name: "Farms", icon: "🌱", bg: "linear-gradient(160deg,#8bc34a,#2e7d32)" },
  { id: "garage", name: "Garage", icon: "🔑", bg: "linear-gradient(160deg,#90a4ae,#37474f)" },
  { id: "settings", name: "Settings", icon: "⚙️", bg: "linear-gradient(160deg,#c7ccd3,#7d858f)" },
];

export function Phone({ world, initialApp, onClose, onTravel, quality, setQuality }: { world: World | null; initialApp?: string; onClose: () => void; onTravel: (ctx: "phone") => void; quality: GfxQuality; setQuality: (q: GfxQuality) => void }) {
  const { state, football, loadFootball } = useGame();
  const [app, setApp] = useState<AppId>((initialApp as AppId) ?? "home");
  useNow(1000);
  useEffect(() => {
    void loadFootball();
  }, [loadFootball]);
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && (app === "home" ? onClose() : setApp("home"));
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [app, onClose]);
  if (!state) return null;
  const minute = world ? Math.floor(world.minuteNow) : state.time.minute;
  const gd = toGameDate(minute);
  const s = state.player.stats;
  const badges: Partial<Record<string, number>> = {
    dream: state.goals.filter((g) => !g.done && GOALS.find((x) => x.id === g.id)!.chapter > 0).length > 0 ? 0 : 0,
    news: state.event ? 1 : 0,
    bet: football?.bets.filter((b) => b.status === "pending").length ?? 0,
    hustle: state.businesses.filter((b) => b.till > 0).length,
    property: state.buildings.filter((b) => b.status === "awaiting_payment").length,
    people: (state.dates as { status: string }[]).filter((d) => d.status === "pending").length,
  };
  return (
    <div className="phone-wrap" onClick={onClose}>
      <div className="phone" onClick={(e) => e.stopPropagation()}>
        <div className="screen" style={app !== "home" ? { background: "linear-gradient(180deg,#191622,#100e16)" } : undefined}>
          <div className="notch" />
          <div className="status-bar">
            <span className="num">{clock12(gd.hour, gd.min).replace(" ", "")}</span>
            <span className="icons">
              <span className="tiny" style={{ opacity: 0.8 }}>SikaTel 4G</span>
              <span className="signal" title={`Mood ${Math.round(s.social)}`}>{[1, 2, 3, 4].map((i) => <i key={i} className={s.social >= i * 22 ? "on" : ""} style={{ height: 3 + i * 2 }} />)}</span>
              <span className="battery" title={`Energy ${Math.round(s.energy)}%`}><i style={{ width: `${s.energy}%`, background: s.energy < 20 ? "#ff6b5a" : "#fff" }} /></span>
            </span>
          </div>
          <div className="phone-body">
            {app === "home" && <HomeScreen gd={gd} onOpen={(id) => (id === "map" || id === "ride" ? onTravel("phone") : setApp(id as AppId))} badges={badges} />}
            {app === "dream" && <DreamApp />}
            {app === "hustle" && <HustleApp />}
            {app === "work" && <WorkApp world={world} onClose={onClose} />}
            {app === "money" && <MoneyApp />}
            {app === "people" && <PeopleApp minute={minute} />}
            {app === "news" && <NewsApp />}
            {app === "chop" && <ChopApp />}
            {app === "property" && <PropertyApp minute={minute} />}
            {app === "bet" && <BetApp />}
            {app === "settings" && <SettingsApp quality={quality} setQuality={setQuality} />}
            {app === "ghana" && <><AppHead id="ghana" sub="Sixteen regions, one country" /><GhanaApp /></>}
            {app === "vibes" && <><AppHead id="vibes" sub="Post, grow, get paid" /><VibesApp /></>}
            {app === "farm" && <><AppHead id="farm" sub="Seasons, rain and harvests" /><FarmApp /></>}
            {app === "story" && <><AppHead id="story" sub="Longer goals, at your own pace" /><StoryApp /></>}
            {app === "family" && <><AppHead id="family" sub="The people at home" /><FamilyApp onTravel={() => onTravel("phone")} /></>}
            {app === "garage" && <><AppHead id="garage" sub="Vehicles, licences and your things" /><GarageApp /></>}
          </div>
          <div className="phone-nav">
            <button onClick={() => (app === "home" ? onClose() : setApp("home"))}><span>‹</span>Back</button>
            <button onClick={() => setApp("home")}><span>◯</span>Home</button>
            <button onClick={onClose}><span>✕</span>Close</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function AppHead({ id, sub }: { id: string; sub?: ReactNode }) {
  const a = APPS.find((x) => x.id === id)!;
  return (
    <div className="app-head">
      <div className="icon" style={{ background: a.bg }}>{a.icon}</div>
      <div><h2>{a.name}</h2>{sub && <div className="tiny muted">{sub}</div>}</div>
    </div>
  );
}

function HomeScreen({ gd, onOpen, badges }: { gd: ReturnType<typeof toGameDate>; onOpen: (id: string) => void; badges: Partial<Record<string, number>> }) {
  const { state } = useGame();
  if (!state) return null;
  const net = state.money.monthlyIncome - state.money.monthlyExpenses;
  const next = GOALS.filter((g) => g.chapter > 0).find((g) => !state.goals.find((x) => x.id === g.id)?.done);
  const nextProg = next && state.goals.find((x) => x.id === next.id)?.progress;
  const hist = state.money.fx.history;
  return (
    <>
      <div className="big-clock num">{clock12(gd.hour, gd.min).replace(/ (AM|PM)/, "")}<span style={{ fontSize: 20, marginLeft: 6, opacity: 0.8 }}>{gd.hour < 12 ? "AM" : "PM"}</span></div>
      <div style={{ marginTop: 6, fontWeight: 600 }}>{gd.weekday}, {gd.date} {gd.monthName} · {gd.season}</div>
      <div className="widgets">
        <div className="widget wide" onClick={() => onOpen("money")} style={{ cursor: "pointer" }}>
          <div className="tiny muted">Cash in hand</div>
          <div className="row" style={{ alignItems: "baseline" }}>
            <b style={{ fontSize: 30 }} className="num">{money(state.money.cash)}</b>
            <span className={`small bold ${net >= 0 ? "good" : "bad"}`}>{net >= 0 ? "+" : "−"}{money(Math.abs(net), true)} a month</span>
          </div>
          <div className="tiny muted">Bank {money(state.money.bank, true)} · Net worth {money(state.money.netWorth, true)}</div>
        </div>
        <div className="widget">
          <div style={{ fontSize: 26 }}>{gd.isNight && state.time.weather === "sunny" ? "🌙" : WEATHER_ICON[state.time.weather]}</div>
          <div className="bold" style={{ textTransform: "capitalize" }}>{state.time.weather}</div>
          <div className="tiny muted">{DISTRICTS[state.player.district].name}</div>
        </div>
        <div className="widget">
          <div className="tiny muted">USD/GHS</div>
          <div className="bold num">{state.money.fx.mid.toFixed(2)}</div>
          <Sparkline values={hist} height={26} color={hist[hist.length - 1] >= hist[0] ? "#ff8a7a" : "#3ddc84"} />
        </div>
        {next && (
          <div className="widget wide" onClick={() => onOpen("dream")} style={{ cursor: "pointer" }}>
            <div className="tiny muted">Next step · Chapter {next.chapter}</div>
            <div className="bold">{next.title}</div>
            <div className="tiny muted" style={{ marginBottom: 6 }}>{next.description}</div>
            {nextProg && <Bar value={(nextProg[0] / nextProg[1]) * 100} color="#f2b705" />}
          </div>
        )}
      </div>
      <div className="apps">
        {APPS.map((a) => (
          <button key={a.id} className="app" onClick={() => onOpen(a.id)}>
            <div className="icon" style={{ background: a.bg }}>{a.icon}</div>
            {a.name}
            {(badges[a.id] ?? 0) > 0 && <span className="badge">{badges[a.id]}</span>}
          </button>
        ))}
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------

function DreamApp() {
  const { state } = useGame();
  if (!state) return null;
  const chapters = [1, 2, 3, 4, 5];
  const names = ["", "Arrival", "Footing", "Building", "Roots", "The Dream"];
  return (
    <>
      <AppHead id="dream" sub="From a room in Kaneshie to a home in the Valley" />
      <div className="card col" style={{ marginBottom: 10, gap: 6 }}>
        <div className="spread"><b>Your life so far</b><span className="pill gold">Life score {state.player.lifeScore.total}</span></div>
        <div className="tiny muted">Not just money: eight parts of a life, each out of 100.</div>
        {state.player.lifeScore.parts.map((x) => (
          <div key={x.key} className="hud-bar"><label><span>{x.icon} {x.label}</span><span className="num">{x.value}</span></label><Bar value={x.value} color="#f2b705" /></div>
        ))}
        {state.player.milestones.length > 0 && <b style={{ marginTop: 6 }}>Milestones</b>}
        {state.player.milestones.slice(0, 12).map((m, i) => <div key={i} className="tiny"><span className="muted">Day {m.day + 1}</span> · {m.text}</div>)}
      </div>
      {chapters.map((c) => {
        const gs = GOALS.filter((g) => g.chapter === c);
        const done = gs.filter((g) => state.goals.find((x) => x.id === g.id)?.done).length;
        return (
          <div className="card" key={c} style={{ marginBottom: 10 }}>
            <div className="spread"><b>Chapter {c} · {names[c]}</b><span className="pill gold">{done}/{gs.length}</span></div>
            {gs.map((g) => {
              const st = state.goals.find((x) => x.id === g.id)!;
              return (
                <div key={g.id} style={{ marginTop: 8, opacity: st.done ? 0.65 : 1 }}>
                  <div className="spread small"><span>{st.done ? "✅" : "⬜"} <b>{g.title}</b></span>{g.reward.cash ? <span className="tiny gold">+{money(g.reward.cash * 100)}</span> : g.reward.reputation ? <span className="tiny gold">+{g.reward.reputation}⭐</span> : null}</div>
                  <div className="tiny muted">{g.description}</div>
                  {!st.done && st.progress && <Bar value={(st.progress[0] / st.progress[1]) * 100} color="#f2b705" />}
                </div>
              );
            })}
          </div>
        );
      })}
      <h3 className="muted small">Achievements</h3>
      <div className="row wrap">
        {GOALS.filter((g) => g.achievement).map((g) => {
          const done = state.goals.find((x) => x.id === g.id)?.done;
          return <span key={g.id} className={`pill ${done ? "gold" : ""}`} title={g.description}>{done ? "🏅" : "🔒"} {g.title}</span>;
        })}
      </div>
    </>
  );
}

function HustleApp() {
  const { state, act, busy } = useGame();
  if (!state) return null;
  const owned = new Set(state.businesses.map((b) => b.type));
  const totalTill = state.businesses.reduce((s, b) => s + Math.max(0, b.till), 0);
  return (
    <>
      <AppHead id="hustle" sub="Businesses earn every morning. Visit them, or sales slip." />
      {state.businesses.length > 0 && (
        <>
          <div className="spread"><b>My businesses</b>{totalTill > 0 && <button className="btn green sm" disabled={busy} onClick={() => act({ type: "biz_collect", businessId: "all" })}>Collect {money(totalTill, true)}</button>}</div>
          {state.businesses.map((b) => {
            const t = BUSINESSES[b.type];
            return (
              <div className="card" key={b.id} style={{ marginTop: 8 }}>
                <div className="spread"><b>{t.name}</b><span className="pill gold">Level {b.level}{b.upgradingUntil ? " → renovating" : ""}</span></div>
                <div className="tiny muted">{DISTRICTS[t.district].name} · value {money(b.value, true)}</div>
                <Sparkline values={b.history.length ? b.history : [0, 0]} color="#3ddc84" />
                <div className="kv"><span>Till</span><b className={b.till >= 0 ? "good" : "bad"}>{money(b.till)}</b></div>
                <div className="kv"><span>Yesterday</span><span className={b.lastDayProfit >= 0 ? "good" : "bad"}>{money(b.lastDayProfit)}</span></div>
                <div className="kv"><span>All-time profit</span><span>{money(b.totalProfit)}</span></div>
                {b.neglected && <div className="notice warn" style={{ marginTop: 6 }}>Staff haven't seen you in a week. Visit {DISTRICTS[t.district].name}, or hire a manager.</div>}
                <div className="kv"><span>Staff</span><span>{b.attendants}/{b.maxAttendants} attendant{b.maxAttendants > 1 ? "s" : ""}{b.manager ? " · a manager" : ""}</span></div>
                <div className="row" style={{ marginTop: 6, flexWrap: "wrap", gap: 6 }}>
                  {b.attendants < b.maxAttendants && <ConfirmButton className="btn sm" disabled={busy} ask="Hire an attendant?" details={{ where: `In person at the ${t.name}, ${DISTRICTS[t.district].name}`, time: "An hour of interviews", cost: `GH₵${b.attendantWage}/day in wages, from the till`, changes: "About 15% more trade every day.", undo: `You can let them go; that costs ${3} days' pay from the till.` }} onConfirm={() => act({ type: "biz_staff", businessId: b.id, role: "attendant", change: "hire" })}>+ Attendant</ConfirmButton>}
                  {!b.manager && <ConfirmButton className="btn sm" disabled={busy} ask="Hire a manager?" details={{ where: `In person at the ${t.name}, ${DISTRICTS[t.district].name}`, time: "An hour of interviews", cost: `GH₵${b.managerWage}/day in wages, from the till`, changes: "Sales don't slip when you stay away, and about 5% more trade.", undo: "You can let them go; that costs 3 days' pay from the till." }} onConfirm={() => act({ type: "biz_staff", businessId: b.id, role: "manager", change: "hire" })}>+ Manager</ConfirmButton>}
                  {b.attendants > 0 && <ConfirmButton className="btn sm ghost" disabled={busy} ask="Let an attendant go?" details={{ cost: `${money(b.attendantWage * 300)} (3 days' pay) from the till`, changes: "Less trade, lower wages.", undo: "You can hire again in person." }} onConfirm={() => act({ type: "biz_staff", businessId: b.id, role: "attendant", change: "fire" })}>− Attendant</ConfirmButton>}
                  {b.manager && <ConfirmButton className="btn sm ghost" disabled={busy} ask="Let the manager go?" details={{ cost: `${money(b.managerWage * 300)} (3 days' pay) from the till`, changes: "You'll need to visit every week again.", undo: "You can hire again in person." }} onConfirm={() => act({ type: "biz_staff", businessId: b.id, role: "manager", change: "fire" })}>− Manager</ConfirmButton>}
                </div>
                <div className="row" style={{ marginTop: 8 }}>
                  <button className="btn sm green" disabled={busy || b.till <= 0} onClick={() => act({ type: "biz_collect", businessId: b.id })}>Collect</button>
                  {b.upgradeCost !== null && <ConfirmButton className="btn sm primary" disabled={busy || !!b.upgradingUntil} ask="Upgrade this business?" details={{ cost: money(b.upgradeCost), time: "Takes a few days; the business keeps trading", changes: "More customers and a bigger daily till, with higher running costs.", undo: "No, but the upgrade adds to what the business sells for." }} onConfirm={() => act({ type: "biz_upgrade", businessId: b.id })}>Upgrade · {money(b.upgradeCost, true)}</ConfirmButton>}
                  <ConfirmButton className="btn sm ghost" disabled={busy} ask="Sell this business?" details={{ cost: `You get about ${money(Math.round(b.value * 0.85))}`, changes: "Its till and staff go with it; no more daily takings.", undo: "No. Buying again costs the full price and starts at level 1." }} onConfirm={() => act({ type: "biz_sell", businessId: b.id })}>Sell</ConfirmButton>
                </div>
              </div>
            );
          })}
        </>
      )}
      <h3 className="muted small" style={{ marginTop: 16 }}>For sale</h3>
      {Object.values(BUSINESSES).filter((t) => !owned.has(t.id)).sort((a, b) => Number(state.player.visited.includes(b.district)) - Number(state.player.visited.includes(a.district))).map((t) => {
        const visited = state.player.visited.includes(t.district);
        const repOk = !t.requiresRep || state.player.reputation >= t.requiresRep;
        const unlockOk = !t.requiresUnlock || state.player.unlocks.includes(t.requiresUnlock);
        return (
          <div className="list-item" key={t.id}>
            <div className="grow">
              <b>{t.name}</b>
              <div className="tiny muted">{DISTRICTS[t.district].name} · ~{money((t.revenue - t.costs) * 100, true)}/day profit · {t.outdoor ? "rain hurts it" : "weatherproof"}</div>
              <div className="tiny muted">{t.blurb}</div>
              {!visited && <div className="tiny bad">Visit {DISTRICTS[t.district].name} first</div>}
              {!repOk && <div className="tiny bad">Needs {t.requiresRep} standing</div>}
              {!unlockOk && <div className="tiny bad">Needs a trade certificate ({t.requiresUnlock?.replace("cert_", "")})</div>}
            </div>
            <ConfirmButton className="btn primary sm" disabled={busy || !visited || !repOk || !unlockOk} ask={`Buy ${t.name}?`} details={{ where: DISTRICTS[t.district].name, cost: money(t.price * 100), changes: "Staff run it every day and the takings build up in its till. It earns more when you show up and collect in person; neglect it and sales slip.", undo: "Sell it any time for about 85% of its value." }} onConfirm={() => act({ type: "biz_buy", bizType: t.id })}>{money(t.price * 100, true)}</ConfirmButton>
          </div>
        );
      })}
    </>
  );
}

function WorkApp({ world, onClose }: { world: World | null; onClose: () => void }) {
  const { state, act, busy } = useGame();
  if (!state) return null;
  const job = state.player.job;
  const sk = state.player.skills;
  return (
    <>
      <AppHead id="work" sub="Shifts pay, promotions raise pay 15% each" />
      {job ? (
        <div className="card">
          <div className="tiny muted">Current job</div>
          <b style={{ fontSize: 18 }}>{job.rankTitle} {JOBS[job.id].title}</b>
          <div className="tiny muted">{PLACE_BY_ID[JOBS[job.id].placeId].name}, {DISTRICTS[PLACE_BY_ID[JOBS[job.id].placeId].district].name}</div>
          <div className="kv"><span>Pay per shift</span><b>{money(job.payPerShift)}</b></div>
          <div className="kv"><span>Shift starts</span><span>{JOBS[job.id].shiftWindow[0]}:00–{JOBS[job.id].shiftWindow[1]}:00{JOBS[job.id].weekdaysOnly ? " (Mon–Fri)" : ""}</span></div>
          <div className="kv"><span>Paid</span><span>{JOBS[job.id].salaried ? "Monthly on the 28th" : "Cash, every shift"}</span></div>
          {state.money.payroll > 0 && <div className="kv"><span>Salary earned this month</span><b className="good">{money(state.money.payroll)}</b></div>}
          {job.nextRankAt && <><div className="tiny muted" style={{ marginTop: 6 }}>Promotion: {job.shifts}/{job.nextRankAt} shifts</div><Bar value={(job.shifts / job.nextRankAt) * 100} color="#7c83ff" /></>}
          {JOBS[job.id]?.needsVehicle && (
            <div className="col" style={{ marginTop: 8, gap: 4 }}>
              <button className="btn primary" disabled={busy || !gigVehicle(state) || state.player.lastGigDay === state.time.day} onClick={() => startGigShift(world, state, act, onClose)}>{state.player.lastGigDay === state.time.day ? "Today's shift done" : `${JOBS[job.id].needsVehicle === "car" ? "🚗" : "🛵"} Start driving (3 trips)`}</button>
              <div className="tiny muted">Shift hours {JOBS[job.id].shiftWindow[0]}:00–{JOBS[job.id].shiftWindow[1]}:00. Drive to the green beacon, stop to pick up, then the yellow one to drop off. Pay per trip, fuel comes off, tips sometimes.</div>
            </div>
          )}
          <div style={{ marginTop: 8 }}><ConfirmButton className="btn ghost sm" disabled={busy} ask="Quit this job?" details={{ changes: "No more shifts or pay from here; your rank and promotion progress are lost.", undo: "You can apply again if they're hiring, but you start from the bottom." }} onConfirm={() => act({ type: "job_quit" })}>Quit</ConfirmButton></div>
        </div>
      ) : <div className="notice warn">No job yet. Walk into a workplace to apply — Kaneshie Market and the trotro station take anyone.</div>}
      <h3 className="muted small" style={{ marginTop: 14 }}>Your skills</h3>
      {(["work", "charisma", "fitness", "business"] as const).map((k) => (
        <div key={k} style={{ marginBottom: 6 }}><div className="spread small"><span style={{ textTransform: "capitalize" }}>{k}</span><span className="num">{Math.floor(sk[k])}</span></div><Bar value={sk[k]} color="#7c83ff" /></div>
      ))}
      <h3 className="muted small" style={{ marginTop: 14 }}>Jobs in the city</h3>
      {Object.values(JOBS).map((j) => {
        const req = state.player.jobRequirements[j.id] ?? {};
        const ok = Object.entries(req).every(([k, v]) => ((k === "reputation" ? state.player.reputation : sk[k as keyof typeof sk]) ?? 0) >= (v as number));
        return (
          <div className="list-item" key={j.id}>
            <div className="grow">
              <b>{j.title}</b> <span className={`pill ${ok ? "green" : ""}`}>{ok ? "You qualify" : "Locked"}</span>
              <div className="tiny muted">{PLACE_BY_ID[j.placeId].name} · {DISTRICTS[PLACE_BY_ID[j.placeId].district].name}</div>
              <div className="tiny muted">{money(rankPay(j.pay, 0) * 100)}/shift · {j.hours}h{Object.keys(req).length ? " · needs " + Object.entries(req).map(([k, v]) => `${k} ${v}`).join(", ") : ""}</div>
            </div>
          </div>
        );
      })}
    </>
  );
}

function MoneyApp() {
  const { state, act, busy } = useGame();
  const [tab, setTab] = useState<"overview" | "transfer" | "power" | "fx" | "tbills" | "loans" | "statement">("overview");
  const [amt, setAmt] = useState("500");
  if (!state) return null;
  const m = state.money;
  const minor = Math.round(Number(amt || 0) * 100);
  const rows: [string, number, string?][] = [
    ["Cash", m.cash], ["MoMo wallet", m.momo], ["Bank savings", m.bank], ["Stock to sell", m.stock], ["Dollars", m.usdInGhs, usd(m.usd)], ["Treasury bills", m.tbill],
    ["Land", m.land], ["Buildings", m.buildings], ["Businesses", m.businesses], ["Vehicles", m.vehicles],
  ];
  if (m.payroll) rows.push(["Salary owed to you", m.payroll]);
  return (
    <>
      <AppHead id="money" sub="Mobile banking · Coastline Bank" />
      <div className="tabs">
        {(["overview", "transfer", "power", "fx", "tbills", "loans", "statement"] as const).map((t) => <button key={t} className={t === tab ? "on" : ""} onClick={() => setTab(t)}>{{ overview: "Overview", transfer: "MoMo", power: "Power", fx: "Dollars", tbills: "T-bills", loans: "Loans", statement: "Statement" }[t]}</button>)}
      </div>
      {tab === "overview" && (
        <>
          <div className="card">
            <div className="tiny muted">Net worth</div>
            <div style={{ fontSize: 30, fontWeight: 800 }} className="num">{money(m.netWorth)}</div>
            {rows.filter((r) => r[1] !== 0 || ["Cash", "Bank savings"].includes(r[0])).map(([k, v, extra]) => <div className="kv" key={k}><span>{k}</span><span className="num">{extra ? `${extra} · ` : ""}{money(v)}</span></div>)}
            {m.loan > 0 && <div className="kv"><span>Loan</span><span className="bad num">−{money(m.loan)}</span></div>}
            {m.arrears > 0 && <div className="kv"><span>Rent arrears</span><span className="bad num">−{money(m.arrears)}</span></div>}
          </div>
          <div className="card" style={{ marginTop: 10 }}>
            <div className="kv"><span>Monthly income (est.)</span><b className="good">{money(m.monthlyIncome)}</b></div>
            <div className="kv"><span>Monthly bills (rent, power, data, loan)</span><b className="bad">−{money(m.monthlyExpenses)}</b></div>
            <div className="kv"><span>Credit score</span><b>{state.player.creditScore}</b></div>
          </div>
        </>
      )}
      {tab === "power" && (
        <div className="card col">
          <b>🔌 Prepaid electricity · {state.player.power.units} kWh left</b>
          <div className="tiny muted">Your home uses about {state.player.power.perDay} kWh a day (lights, fan{state.items.length ? " and your appliances" : ""}), so that's roughly {Math.floor(state.player.power.units / Math.max(0.1, state.player.power.perDay))} days. Units cost {money(state.player.power.price * 100)} per kWh, paid from MoMo first. When they run out the lights go off until you top up. Game money only.</div>
          <div className="row" style={{ flexWrap: "wrap", gap: 6 }}>
            {[20, 50, 100, 200].map((c) => <button key={c} className="btn sm" disabled={busy} onClick={() => act({ type: "buy_power", amount: c * 100 })}>GH₵{c} · {Math.round((c / state.player.power.price) * 10) / 10} kWh</button>)}
          </div>
        </div>
      )}
      {tab === "transfer" && (
        <div className="card col" style={{ marginBottom: 10 }}>
          <b>📱 MoMo wallet · {money(m.momo)}</b>
          <div className="tiny muted">Pay vendors, rides and food from your phone. Cash-in at any agent is free; cash-out costs 1% (min GH₵0.50); moving between MoMo and the bank is free. Game money only.</div>
          <div className="row"><input className="input num" inputMode="decimal" value={amt} onChange={(e) => setAmt(e.target.value.replace(/[^\d.]/g, ""))} /><span className="muted">GH₵</span></div>
          <div className="row">
            <button className="btn green grow" disabled={busy || minor <= 0} onClick={() => act({ type: "momo_move", from: "cash", to: "momo", amount: minor })}>Cash → MoMo</button>
            <button className="btn grow" disabled={busy || minor <= 0} onClick={() => act({ type: "momo_move", from: "momo", to: "cash", amount: minor })}>MoMo → Cash</button>
          </div>
          <div className="row">
            <button className="btn grow" disabled={busy || minor <= 0} onClick={() => act({ type: "momo_move", from: "bank", to: "momo", amount: minor })}>Bank → MoMo</button>
            <button className="btn grow" disabled={busy || minor <= 0} onClick={() => act({ type: "momo_move", from: "momo", to: "bank", amount: minor })}>MoMo → Bank</button>
          </div>
        </div>
      )}
      {tab === "transfer" && (
        <div className="card col">
          <div className="tiny muted">Mobile money agents are everywhere. 0.5% fee (min GH₵0.50). The bank counter is free.</div>
          <div className="row"><input className="input num" inputMode="decimal" value={amt} onChange={(e) => setAmt(e.target.value.replace(/[^\d.]/g, ""))} /><span className="muted">GH₵</span></div>
          <div className="row">
            <button className="btn green grow" disabled={busy || minor <= 0} onClick={() => act({ type: "deposit", amount: minor })}>Cash → Bank</button>
            <button className="btn grow" disabled={busy || minor <= 0} onClick={() => act({ type: "withdraw", amount: minor })}>Bank → Cash</button>
          </div>
          <div className="kv"><span>Cash</span><b>{money(m.cash)}</b></div>
          <div className="kv"><span>Bank (6% p.a., paid daily)</span><b>{money(m.bank)}</b></div>
        </div>
      )}
      {tab === "fx" && (
        <div className="card col">
          <div className="spread"><div><div className="tiny muted">USD/GHS mid</div><b style={{ fontSize: 24 }}>{m.fx.mid.toFixed(3)}</b></div><div className="tiny muted right">Buy {m.fx.buy.toFixed(3)}<br />Sell {m.fx.sell.toFixed(3)}</div></div>
          <Sparkline values={m.fx.history} color="#f2b705" height={50} />
          <div className="tiny muted">14-day trend. Hold dollars when the cedi is strong; sell when it weakens. 2% p.a. interest.</div>
          <div className="kv"><span>Your dollars</span><b>{usd(m.usd)} ≈ {money(m.usdInGhs)}</b></div>
          <div className="row"><input className="input num" inputMode="decimal" value={amt} onChange={(e) => setAmt(e.target.value.replace(/[^\d.]/g, ""))} /><span className="muted">USD</span></div>
          <div className="row">
            <button className="btn green grow" disabled={busy || minor <= 0} onClick={() => act({ type: "fx_buy", usd: minor })}>Buy ≈ {money(Math.ceil(minor * m.fx.buy), true)}</button>
            <button className="btn grow" disabled={busy || minor <= 0} onClick={() => act({ type: "fx_sell", usd: minor })}>Sell ≈ {money(Math.floor(minor * m.fx.sell), true)}</button>
          </div>
        </div>
      )}
      {tab === "tbills" && (
        <>
          <div className="card col">
            <div className="tiny muted">Government treasury bills. Paid from your bank, returned with interest at maturity. No early exit.</div>
            <div className="row"><input className="input num" inputMode="decimal" value={amt} onChange={(e) => setAmt(e.target.value.replace(/[^\d.]/g, ""))} /><span className="muted">GH₵</span></div>
            {Object.values(TBILLS).map((t) => (
              <div className="list-item" key={t.id}>
                <div className="grow"><b>{t.name}</b><div className="tiny muted">{(t.rate * 100).toFixed(1)}% p.a. · min {money(t.min * 100)} · returns {money(minor + Math.floor((minor * t.rate * t.days) / 365))}</div></div>
                <ConfirmButton className="btn primary sm" disabled={busy || minor < t.min * 100} ask={`Buy a ${t.name}?`} details={{ cost: `${money(minor)} from your bank`, time: `${t.days} days`, changes: `You get ${money(minor + Math.floor((minor * t.rate * t.days) / 365))} back at maturity. Game money only.`, undo: "No early exit: the money is locked until it matures." }} onConfirm={() => act({ type: "tbill_buy", product: t.id, amount: minor })}>Buy</ConfirmButton>
              </div>
            ))}
          </div>
          <h3 className="muted small">My bills</h3>
          {(m.tbills as { id: number; product: string; principal: number; payout: number; maturesMin: number; status: string }[]).map((b) => (
            <div className="list-item" key={b.id}><div className="grow"><b>{TBILLS[b.product].name}</b><div className="tiny muted">{money(b.principal)} → {money(b.payout)} · {b.status === "active" ? `matures ${toGameDate(b.maturesMin).label}` : "paid out"}</div></div><span className={`pill ${b.status === "active" ? "gold" : "green"}`}>{b.status}</span></div>
          ))}
        </>
      )}
      {tab === "loans" && (
        <div className="card col">
          <div className="kv"><span>You owe</span><b className={m.loan ? "bad" : ""}>{money(m.loan)}</b></div>
          <div className="kv"><span>Limit</span><b>{money(m.loanLimit)}</b></div>
          <div className="kv"><span>Rate</span><b>{(m.loanRate * 100).toFixed(0)}% p.a. · 1% fee</b></div>
          <div className="kv"><span>Credit score</span><b>{state.player.creditScore}</b></div>
          <div className="tiny muted">10% of the balance is debited from your bank on the 1st. Missed instalments hurt your credit score and standing.</div>
          <div className="row"><input className="input num" inputMode="decimal" value={amt} onChange={(e) => setAmt(e.target.value.replace(/[^\d.]/g, ""))} /><span className="muted">GH₵</span></div>
          <div className="row">
            <ConfirmButton className="btn primary grow" disabled={busy || minor <= 0} ask={`Borrow ${money(minor)}?`} details={{ cost: `Interest about ${(m.loanRate * 100).toFixed(0)}% a year, plus an arrangement fee`, changes: "The money lands in your bank. 10% of what you owe is debited on the 1st of each month; missing it hurts your credit score and standing.", undo: "Repay early at any time with no penalty." }} onConfirm={() => act({ type: "loan_take", amount: minor })}>Borrow</ConfirmButton>
            <button className="btn green grow" disabled={busy || minor <= 0 || m.loan <= 0} onClick={() => act({ type: "loan_repay", amount: minor })}>Repay</button>
          </div>
        </div>
      )}
      {tab === "statement" && (
        <>
          <div className="tiny muted" style={{ marginBottom: 8 }}>Every cedi, recorded. This is the audit ledger the server keeps.</div>
          {m.ledger.map((t) => (
            <div className="list-item" key={t.id}>
              <div className="grow"><div className="small bold">{t.memo}</div><div className="tiny muted">{toGameDate(t.gameMin).label} {toGameDate(t.gameMin).clock}</div></div>
              <div className="col" style={{ alignItems: "flex-end", gap: 2 }}>{t.legs.map((l, i) => <Delta key={i} k={l.account} d={l.amount} />)}</div>
            </div>
          ))}
        </>
      )}
    </>
  );
}

function PeopleApp({ minute }: { minute: number }) {
  const { state, act, busy } = useGame();
  const [open, setOpen] = useState<string | null>(null);
  if (!state) return null;
  const rels = new Map(state.relationships.map((r) => [r.npcId, r]));
  const dates = (state.dates as { id: number; npcId: string; placeId: string; startMin: number; status: string }[]).filter((d) => d.status === "pending");
  return (
    <>
      <AppHead id="people" sub="Everyone remembers how you treated them" />
      {dates.map((d) => (
        <div className="notice ok" key={d.id} style={{ marginBottom: 8 }}>📅 Date with <b>{NPC_BY_ID[d.npcId].name.split(" ")[0]}</b> at {PLACE_BY_ID[d.placeId].name} ({DISTRICTS[PLACE_BY_ID[d.placeId].district].name}) — {toGameDate(d.startMin).label}, {toGameDate(d.startMin).clock}. {d.startMin > minute ? `In ${formatDuration(d.startMin - minute)}.` : "Now!"}</div>
      ))}
      {NPCS.map((n) => {
        const r = rels.get(n.id);
        const met = !!r;
        return (
          <div key={n.id} className="list-item" style={{ flexDirection: "column", alignItems: "stretch", opacity: met ? 1 : 0.6 }} onClick={() => setOpen(open === n.id ? null : n.id)}>
            <div className="row">
              <div className="avatar" style={{ background: AVATAR_COLORS[n.id], width: 42, height: 42, fontSize: 16, borderRadius: 13 }}>{initials(n.name)}</div>
              <div className="grow">
                <div className="bold">{met ? n.name : "???"} {r?.partner && "❤️"}</div>
                <div className="tiny muted">{n.role}</div>
              </div>
              <span className="pill">{met ? r!.tier : "not met"}</span>
            </div>
            {met && <div style={{ marginTop: 6 }}><Bar value={Math.max(0, r!.affinity)} color="#ff7a6b" /></div>}
            {open === n.id && (
              <div style={{ marginTop: 8 }} className="small">
                <div className="muted">{n.personality}</div>
                <div style={{ marginTop: 4 }}><b>Dream:</b> {n.goal}</div>
                <div style={{ marginTop: 4 }}><b>Usually:</b> {n.schedule.map((b) => `${PLACE_BY_ID[b.place].name} ${b.from}:00–${b.to}:00 (${b.days})`).join(" · ")}</div>
                {met && <div style={{ marginTop: 4 }}><b>Favour:</b> {state.player.unlocks.includes(n.favour.unlock) ? `✅ ${n.favour.reward}` : `"${n.favour.ask}" at ${n.favour.threshold} affinity — ${n.favour.reward}`}</div>}
                {r?.partner && <MarriagePanel npcId={n.id} />}
                {met && r!.affinity >= 15 && <button className="btn sm" style={{ marginTop: 6 }} disabled={busy} onClick={(e) => { e.stopPropagation(); act({ type: "talk", npcId: n.id, topic: "call" }); }}>📞 Call (GH₵1.50)</button>}
                {r && r.memories.length > 0 && <div style={{ marginTop: 6 }}><b>Memories</b>{r.memories.slice().reverse().map((m, i) => <div key={i} className="tiny muted">• Day {m.day + 1}: {m.text}</div>)}</div>}
              </div>
            )}
          </div>
        );
      })}
    </>
  );
}

const HEADLINES = [
  "Fuel prices up again at the pumps, trotro drivers threaten fare hike",
  "Black Stars announce squad for qualifiers; Kaneshie barbers divided",
  "ECG promises 'no more dumsor' by month end. Again.",
  "Spintex Road traffic: commuters report record 2-hour crawl",
  "Labadi Beach clean-up draws hundreds of volunteers",
  "Cedi steadies against the dollar, says central bank",
  "New tech hub opens in Spintex, hiring developers",
  "Rain expected across Greater Accra this week — check your gutters",
  "Kelewele prices hold steady despite plantain shortage",
  "East Legon land prices climb 15% in a year, agents say",
  "Afrobeats night at Osu draws record crowd",
  "Market queens warn of tomato shortage from the north",
];

function NewsApp() {
  const { state } = useGame();
  const [tab, setTab] = useState<"city" | "life">("life");
  if (!state) return null;
  const day = state.time.day;
  return (
    <>
      <AppHead id="news" sub="The city and your life" />
      <div className="tabs"><button className={tab === "life" ? "on" : ""} onClick={() => setTab("life")}>Your feed</button><button className={tab === "city" ? "on" : ""} onClick={() => setTab("city")}>Accra today</button></div>
      {tab === "city" && [0, 1, 2, 3].map((i) => <div className="list-item" key={i}><div className="grow"><b className="small">{HEADLINES[(day * 3 + i * 5) % HEADLINES.length]}</b><div className="tiny muted">Day {day + 1} · Ghana Daily Times</div></div></div>)}
      {tab === "life" && state.log.map((l) => (
        <div className="list-item" key={l.id} style={{ alignItems: "flex-start" }}>
          <div className="grow">
            <div className="small">{l.text}</div>
            <div className="tiny muted">{toGameDate(l.gameMin).label} {toGameDate(l.gameMin).clock}</div>
            {l.changes.length > 0 && <div className="effects">{l.changes.map((c, i) => <Delta key={i} k={c.k} d={c.d} />)}</div>}
          </div>
        </div>
      ))}
    </>
  );
}

function ChopApp() {
  const { state, act, busy } = useGame();
  if (!state) return null;
  const menu = ["waakye", "jollof", "banku", "fufu", "kelewele"];
  return (
    <>
      <AppHead id="chop" sub="Hot food by okada rider · 07:00–23:00 · ~40 min" />
      {menu.map((sid) => {
        const s = SERVICES[sid];
        const price = (Math.round(priceFor(s.cost, state.player.district) * 1.3) + 15) * 100;
        return (
          <div className="list-item" key={sid}>
            <div className="grow"><b>{s.name}</b><div className="tiny muted">{money(price)} incl. delivery</div><EffectsPreview effects={{ ...s.effects, social: Math.min(2, s.effects.social ?? 0) }} /></div>
            <button className="btn primary sm" disabled={busy} onClick={() => act({ type: "order_food", serviceId: sid })}>Order</button>
          </div>
        );
      })}
    </>
  );
}

function PropertyApp({ minute }: { minute: number }) {
  const { state, act, busy } = useGame();
  const [tab, setTab] = useState<"mine" | "land" | "rent">("mine");
  const [city, setCity] = useState<string>(() => (state ? DISTRICTS[state.player.district].city : "accra"));
  const [draft, setDraft] = useState<{ plotId: number; design: string; quality: Quality } | null>(null);
  if (!state) return null;
  const myPlots = state.plots;
  const ownedTypes = new Set(myPlots.map((p) => p.type));
  return (
    <>
      <AppHead id="property" sub={`You live in: ${state.player.home.kind === "rental" ? RENTALS[state.player.home.ref]?.name : "your own home"}`} />
      <div className="tabs">
        <button className={tab === "mine" ? "on" : ""} onClick={() => setTab("mine")}>My property</button>
        <button className={tab === "land" ? "on" : ""} onClick={() => setTab("land")}>Land</button>
        <button className={tab === "rent" ? "on" : ""} onClick={() => setTab("rent")}>Rentals</button>
      </div>
      {state.rentArrears > 0 && (
        <div className="notice err" style={{ marginBottom: 8 }}><div className="spread"><span>Rent arrears {money(state.rentArrears)}</span><button className="btn sm danger" disabled={busy} onClick={() => act({ type: "pay_arrears" })}>Pay</button></div></div>
      )}
      {tab === "mine" && (
        <>
          {myPlots.length === 0 && <div className="notice warn">No land yet. Plots start around {money(95_000 * 100, true)} in Kaneshie.</div>}
          {myPlots.map((pl) => {
            const def = PLOTS[pl.type];
            const b = state.buildings.find((x) => x.plotId === pl.id);
            return (
              <div className="card" key={pl.id} style={{ marginBottom: 10 }}>
                <b>{def.name}</b>
                <div className="tiny muted">{DISTRICTS[def.district].name} · {def.size} · paid {money(pl.price, true)}</div>
                {!b && (
                  draft?.plotId === pl.id ? (
                    <BuildPlanner plotPrice={pl.price} allowed={def.allowed} draft={draft} setDraft={setDraft} onBuild={async () => { const r = await act({ type: "build_start", plotId: pl.id, design: draft.design, quality: draft.quality }); if (r.ok) setDraft(null); }} busy={busy} />
                  ) : <button className="btn primary sm" style={{ marginTop: 8 }} onClick={() => setDraft({ plotId: pl.id, design: def.allowed[0], quality: "basic" })}>Plan a building</button>
                )}
                {b && <BuildingCard b={b} plotPrice={pl.price} minute={minute} />}
              </div>
            );
          })}
        </>
      )}
      {(tab === "land" || tab === "rent") && (
        <select className="input" style={{ marginBottom: 8 }} value={city} onChange={(e) => setCity(e.target.value)}>
          {[...new Set(Object.values(DISTRICTS).map((d) => d.city))].map((c) => <option key={c} value={c}>{CITIES[c]?.name ?? c}</option>)}
        </select>
      )}
      {tab === "land" && Object.values(PLOTS).filter((p) => DISTRICTS[p.district].city === city).map((p) => {
        const visited = state.player.visited.includes(p.district);
        const repOk = !p.requiresRep || state.player.reputation >= p.requiresRep;
        const unlockOk = !p.requiresUnlock || state.player.unlocks.includes(p.requiresUnlock);
        const price = p.price * (state.player.unlocks.includes("yaa_discount") ? 0.9 : 1);
        return (
          <div className="list-item" key={p.id}>
            <div className="grow">
              <b>{p.name}</b>
              <div className="tiny muted">{DISTRICTS[p.district].name} · {p.size} · builds: {p.allowed.map((d) => DESIGNS[d].name).join(", ")}</div>
              {!visited && <div className="tiny bad">Walk the land first: visit {DISTRICTS[p.district].name}</div>}
              {!repOk && <div className="tiny bad">Needs {p.requiresRep} standing</div>}
              {!unlockOk && <div className="tiny bad">Family land — an elder must speak for you</div>}
            </div>
            <ConfirmButton className="btn primary sm" disabled={busy || ownedTypes.has(p.id) || !visited || !repOk || !unlockOk} ask={`Buy ${p.name}?`} details={{ where: DISTRICTS[p.district].name, cost: money(price * 100), changes: p.ready ? "It comes finished: move in or let it to tenants straight away." : "The land is yours. Plan a building, then pay for it stage by stage (foundation, walls, roof, finishing) as it goes up.", undo: "Land and buildings can't be sold back in this version; they count towards your net worth and can earn rent." }} onConfirm={() => act({ type: "plot_buy", plotId: p.id })}>{ownedTypes.has(p.id) ? "Yours" : money(price * 100, true)}</ConfirmButton>
          </div>
        );
      })}
      {tab === "rent" && Object.values(RENTALS).filter((r) => DISTRICTS[r.district].city === city).map((r) => {
        const here = state.player.home.kind === "rental" && state.player.home.ref === r.id;
        const visited = state.player.visited.includes(r.district);
        return (
          <div className="list-item" key={r.id}>
            <div className="grow">
              <b>{r.name}</b>
              <div className="tiny muted">{money(r.rent * 100)}/month · {r.deposit ? `${r.deposit} months advance` : "no advance"} · comfort {r.comfort}/5 · utilities ~{money(r.utilities * 100)}</div>
              <div className="tiny muted">{r.blurb}</div>
              {!visited && <div className="tiny bad">Visit {DISTRICTS[r.district].name} first</div>}
            </div>
            {here ? <span className="pill green">Home</span> : <ConfirmButton className="btn sm primary" disabled={busy || !visited} ask={`Move to ${r.name}?`} details={{ where: DISTRICTS[r.district].name, cost: `${money(r.rent * Math.max(1, r.deposit) * 100)} now (${Math.max(1, r.deposit)} month${Math.max(1, r.deposit) > 1 ? "s" : ""} advance), then ${money(r.rent * 100)}/month plus ~${money(r.utilities * 100)} utilities`, changes: "This becomes home: where you sleep, bath and cook, and what you can do there.", undo: "You can move again, but months you've already paid here are lost when you leave." }} onConfirm={() => act({ type: "rent_move", rentalId: r.id })}>Move</ConfirmButton>}
          </div>
        );
      })}
    </>
  );
}

function BuildPlanner({ plotPrice, allowed, draft, setDraft, onBuild, busy }: { plotPrice: number; allowed: string[]; draft: { plotId: number; design: string; quality: Quality }; setDraft: (d: { plotId: number; design: string; quality: Quality }) => void; onBuild: () => void; busy: boolean }) {
  const plan = stagePlan(draft.design, draft.quality);
  const total = plan.reduce((s, x) => s + x.cost, 0);
  const days = plan.reduce((s, x) => s + x.days, 0);
  return (
    <div className="col" style={{ marginTop: 10 }}>
      <div className="seg">{allowed.map((d) => <button key={d} className={draft.design === d ? "on" : ""} onClick={() => setDraft({ ...draft, design: d })}>{DESIGNS[d].name}</button>)}</div>
      <div className="seg">{QUALITY_ORDER.map((q) => <button key={q} className={draft.quality === q ? "on" : ""} onClick={() => setDraft({ ...draft, quality: q })}>{QUALITY[q].label}</button>)}</div>
      {plan.map((s, i) => <div className="kv" key={i}><span>{i + 1}. {s.name} · {s.days} day{s.days > 1 ? "s" : ""}</span><span>{money(s.cost * 100, true)}</span></div>)}
      <div className="kv"><b>Total</b><b>{money(total * 100, true)} · {days} days</b></div>
      <div className="kv"><span>Value when finished</span><span className="good">{money(builtValue(plotPrice / 100, draft.design, draft.quality) * 100, true)}</span></div>
      <div className="tiny muted">You pay stage by stage — just like building in Ghana. Start with the foundation now.</div>
      <button className="btn primary" disabled={busy} onClick={onBuild}>Pay {plan[0].name.toLowerCase()} · {money(plan[0].cost * 100, true)}</button>
    </div>
  );
}

function BuildingCard({ b, plotPrice, minute }: { b: GameState["buildings"][number]; plotPrice: number; minute: number }) {
  const { act, busy } = useGame();
  const d = DESIGNS[b.design];
  const total = b.plan.length;
  const left = b.stageEndsMin ? Math.max(0, b.stageEndsMin - minute) : 0;
  const pct = b.stageEndsMin && b.stageStartedMin ? Math.min(100, ((minute - b.stageStartedMin) / (b.stageEndsMin - b.stageStartedMin)) * 100) : 0;
  return (
    <div style={{ marginTop: 8 }}>
      <div className="spread"><b>{d.name}</b><span className="pill">{QUALITY[b.quality as Quality].label}</span></div>
      <div className="stage-track">{b.plan.map((_, i) => <i key={i} className={i < b.stage || b.status === "complete" || b.status === "upgrading" ? "done" : i === b.stage && b.status === "building" ? "now" : ""} />)}</div>
      {b.status === "building" && <><div className="small">🏗️ {b.plan[b.stage].name} — {formatDuration(left)} left · done {toGameDate(b.stageEndsMin!).label} {toGameDate(b.stageEndsMin!).clock}</div><Bar value={pct} color="#f2b705" /></>}
      {b.status === "awaiting_payment" && (
        <div className="notice warn" style={{ marginTop: 6 }}>
          <div className="spread"><span>Next: {b.plan[b.stage].name} ({b.plan[b.stage].days}d)</span><button className="btn primary sm" disabled={busy} onClick={() => act({ type: "build_pay_stage", buildingId: b.id })}>Pay {money(b.plan[b.stage].cost, true)}</button></div>
        </div>
      )}
      {b.status === "upgrading" && <div className="small">🛠️ Upgrading to {QUALITY[b.upgradeTo as Quality].label} · ready {toGameDate(b.stageEndsMin!).label}</div>}
      {b.status === "complete" && (
        <>
          <div className="kv"><span>Value</span><b className="good">{money(builtValue(plotPrice / 100, b.design, b.quality as Quality) * 100, true)}</b></div>
          <div className="kv"><span>Rent if let</span><span>{money(builtValue(plotPrice / 100, b.design, b.quality as Quality) * d.rentYield * 100, true)}/month</span></div>
          <div className="seg" style={{ marginTop: 6 }}>
            {(d.kind === "home" ? ["live", "rent", "vacant"] : ["rent", "vacant"]).map((u) => <button key={u} className={b.use === u ? "on" : ""} disabled={busy} onClick={() => b.use !== u && act({ type: "building_use", buildingId: b.id, use: u })}>{{ live: "Live here", rent: "Let to tenants", vacant: "Vacant" }[u]}</button>)}
          </div>
          {b.upgrade && <ConfirmButton className="btn sm" disabled={busy} ask={`Upgrade to ${QUALITY[b.upgrade.to].label}?`} details={{ cost: money(b.upgrade.cost), time: `${b.upgrade.days} game days`, changes: "Better finishes: more comfort, higher rent and value.", undo: "No, but it adds to the building's value." }} onConfirm={() => act({ type: "building_upgrade", buildingId: b.id })}>Upgrade to {QUALITY[b.upgrade.to].label} · {money(b.upgrade.cost, true)} · {b.upgrade.days}d</ConfirmButton>}
        </>
      )}
      <div className="tiny muted" style={{ marginTop: 6 }}>Spent so far {money(b.spent, true)} · {b.stage}/{total} stages</div>
    </div>
  );
}

function BetApp() {
  const { football, loadFootball, placeBet, state } = useGame();
  const [pick, setPick] = useState<{ id: string; sel: string } | null>(null);
  const [stake, setStake] = useState("20");
  const [tab, setTab] = useState<"matches" | "mine">("matches");
  const now = useNow(1000);
  useEffect(() => {
    const t = setInterval(() => void loadFootball(), 10_000);
    return () => clearInterval(t);
  }, [loadFootball]);
  const skew = useMemo(() => (football ? football.serverNow - Date.now() : 0), [football]);
  if (!football || !state) return <AppHead id="bet" sub="Loading fixtures…" />;
  const serverNow = now + skew;
  const pending = football.bets.filter((b) => b.status === "pending");
  return (
    <>
      <AppHead id="bet" sub="Coastline Premier League · game cedis only, never real money" />
      {!football.provider.open ? (
        <div className="notice err" style={{ marginBottom: 10 }}>⏸️ Predictions paused: {football.provider.message}. Your {pending.length} pending bet{pending.length === 1 ? " is" : "s are"} safe and will settle when match data is back.</div>
      ) : <div className="notice ok" style={{ marginBottom: 10 }}>🟢 Match data live · markets close at kickoff</div>}
      <div className="tabs"><button className={tab === "matches" ? "on" : ""} onClick={() => setTab("matches")}>Matches</button><button className={tab === "mine" ? "on" : ""} onClick={() => setTab("mine")}>My predictions {pending.length ? `(${pending.length})` : ""}</button></div>
      {tab === "matches" && football.fixtures.map((f) => {
        const ko = Date.parse(f.kickoff);
        const open = f.status === "scheduled" && ko > serverNow && football.provider.open;
        const tip = football.tips[f.id];
        return (
          <div className="card" key={f.id} style={{ marginBottom: 8 }}>
            <div className="spread small">
              <span className="muted">{f.status === "scheduled" ? (ko > serverNow ? `Kicks off in ${Math.max(0, Math.round((ko - serverNow) / 1000))}s` : "Kicking off") : f.status === "live" ? "🔴 LIVE" : f.status === "finished" ? "Full time" : "Cancelled"}</span>
              {tip && <span className="pill gold">Ebo says: {tip}</span>}
            </div>
            <div className="spread" style={{ marginTop: 4 }}><b>{f.home}</b>{f.score ? <b className="num">{f.score.home} – {f.score.away}</b> : <span className="muted">vs</span>}<b style={{ textAlign: "right" }}>{f.away}</b></div>
            {f.status === "scheduled" && (
              <div className="odds">
                {(["home", "draw", "away"] as const).map((s) => (
                  <button key={s} disabled={!open} className={pick?.id === f.id && pick.sel === s ? "on" : ""} onClick={() => setPick({ id: f.id, sel: s })}>{s === "home" ? "1" : s === "draw" ? "X" : "2"}<b>{f.odds[s].toFixed(2)}</b></button>
                ))}
              </div>
            )}
            {pick?.id === f.id && open && (
              <div className="row" style={{ marginTop: 8 }}>
                <input className="input num" inputMode="decimal" value={stake} onChange={(e) => setStake(e.target.value.replace(/[^\d.]/g, ""))} />
                <button className="btn primary" onClick={async () => { const r = await placeBet(f.id, pick.sel, Math.round(Number(stake) * 100)); if (r.ok) setPick(null); }}>Stake · win {money(Math.floor(Math.round(Number(stake) * 100) * f.odds[pick.sel as "home"]), true)}</button>
              </div>
            )}
          </div>
        );
      })}
      {tab === "mine" && football.bets.map((b) => (
        <div className="list-item" key={b.id}>
          <div className="grow">
            <b className="small">{b.fixture ? `${b.fixture.home} v ${b.fixture.away}` : b.fixtureId}</b>
            <div className="tiny muted">{b.selection} @ {b.odds.toFixed(2)} · stake {money(b.stakeMinor)}{b.fixture?.score ? ` · ${b.fixture.score.home}–${b.fixture.score.away}` : ""}</div>
          </div>
          <span className={`pill ${b.status === "won" ? "green" : b.status === "lost" ? "red" : "gold"}`}>{b.status === "won" ? `+${money(b.payoutMinor, true)}` : b.status}</span>
        </div>
      ))}
      <p className="tiny muted" style={{ marginTop: 10 }}>Ebo's rule: never chase your losses. Cash only, max {money(football.limits.max, true)} per prediction.</p>
    </>
  );
}

function SoundSettings() {
  const [mix, setMix] = useState(() => readMix());
  const update = (p: Partial<typeof mix>) => {
    const next = { ...mix, ...p };
    setMix(next);
    try { localStorage.setItem("sika.mix", JSON.stringify(next)); } catch { /* ignore */ }
    window.dispatchEvent(new CustomEvent("sika-mix", { detail: next }));
  };
  return (
    <div className="card col" style={{ marginTop: 10 }}>
      <b>Sound</b>
      <div className="row small"><span className="muted" style={{ width: 70 }}>Volume</span><input type="range" min={0} max={1} step={0.05} value={mix.master} onChange={(e) => update({ master: Number(e.target.value) })} className="grow" /></div>
      <div className="seg">
        <button className={mix.market ? "on" : ""} onClick={() => update({ market: !mix.market })}>Market noise {mix.market ? "on" : "off"}</button>
        <button className={mix.music ? "on" : ""} onClick={() => update({ music: !mix.music })}>Shop music {mix.music ? "on" : "off"}</button>
        <button className={mix.traffic ? "on" : ""} onClick={() => update({ traffic: !mix.traffic })}>Traffic {mix.traffic ? "on" : "off"}</button>
      </div>
    </div>
  );
}

export function readMix() {
  try {
    const m = JSON.parse(localStorage.getItem("sika.mix") ?? "null");
    if (m) return m as { master: number; market: boolean; music: boolean; traffic: boolean };
  } catch { /* ignore */ }
  return { master: 0.8, market: true, music: true, traffic: true };
}

function SettingsApp({ quality, setQuality }: { quality: GfxQuality; setQuality: (q: GfxQuality) => void }) {
  const { state, backend, act, busy, logout } = useGame();
  const [grant, setGrant] = useState("5000");
  if (!state) return null;
  return (
    <>
      <AppHead id="settings" sub={`Build ${BUILD_VERSION}`} />
      <div className="card col">
        <b>Graphics</b>
        <div className="seg">{(["low", "medium", "high"] as const).map((q) => <button key={q} className={quality === q ? "on" : ""} onClick={() => setQuality(q)}>{q}</button>)}</div>
        <div className="tiny muted">Low turns off shadows for older phones.</div>
      </div>
      <SoundSettings />
      <A11ySettings />
      <div className="card col" style={{ marginTop: 10 }}>
        <b>Needs</b>
        <div className="seg">{([[1, "Normal"], [0.5, "Slow"], [0, "Off"]] as const).map(([v, label]) => <button key={v} className={state.player.settings.needsPace === v ? "on" : ""} disabled={busy} onClick={() => act({ type: "settings", needsPace: v })}>{label}</button>)}</div>
        <div className="tiny muted">How fast hunger, energy, bladder, hygiene, fun and social run down. Off keeps them where they are.</div>
      </div>
      <div className="card col" style={{ marginTop: 10 }}>
        <b>Languages you speak</b>
        <div className="seg" style={{ flexWrap: "wrap" }}>{Object.values(LANGUAGES).map((l) => { const mine = state.player.languages; const on = mine.includes(l.id); return <button key={l.id} className={on ? "on" : ""} disabled={busy} onClick={() => act({ type: "settings", languages: on ? mine.filter((x) => x !== l.id) : [...mine, l.id].slice(-MAX_LANGUAGES) })}>{l.name}</button>; })}</div>
        <div className="tiny muted">Plus English. People warm to you faster in their own language.</div>
        <b style={{ marginTop: 10 }}>What matters to you</b>
        <div className="seg" style={{ flexWrap: "wrap" }}>{Object.values(PRIORITIES).map((pr) => { const mine = state.player.priorities; const on = mine.includes(pr.id); return <button key={pr.id} className={on ? "on" : ""} disabled={busy} onClick={() => act({ type: "settings", priorities: on ? mine.filter((x) => x !== pr.id) : [...mine, pr.id].slice(-MAX_PRIORITIES) })}>{pr.icon} {pr.label}</button>; })}</div>
        <div className="tiny muted">{state.player.priorities.map((x) => PRIORITIES[x as keyof typeof PRIORITIES].text).join(" ") || "Pick up to two. Good moments in these areas lift your mood more and your daily goals lean that way."}</div>
      </div>
      <div className="card col" style={{ marginTop: 10 }}>
        <b>Save</b>
        <div className="tiny muted">{backend.mode === "server" ? "Your progress is saved on the game server after every action." : "Offline demo: your progress is saved in this browser. The full game uses an authoritative server."}</div>
        <div className="kv"><span>Character</span><span>{state.player.name}</span></div>
        <div className="kv"><span>Day</span><span>{state.time.day + 1}</span></div>
        {backend.mode === "offline" && <SaveBackup />}
        <ConfirmButton className="btn ghost sm" ask="Forget this character?" onConfirm={logout}>New character</ConfirmButton>
      </div>
      {state.devTools && (
        <div className="card col" style={{ marginTop: 10 }}>
          <b>🧪 Test account tools</b>
          <div className="tiny muted">Visible only on test accounts with dev tools enabled on the server. Every grant is recorded in the ledger.</div>
          <div className="row"><input className="input num" value={grant} onChange={(e) => setGrant(e.target.value.replace(/[^\d]/g, ""))} /><button className="btn sm" disabled={busy} onClick={() => act({ type: "dev_grant", amount: Number(grant) * 100 })}>Grant GH₵</button></div>
          <div className="row">
            <button className="btn sm" disabled={busy} onClick={() => act({ type: "dev_skip", hours: 6 })}>Skip 6h</button>
            <button className="btn sm" disabled={busy} onClick={() => act({ type: "dev_skip", hours: 24 })}>Skip 1 day</button>
            <button className="btn sm" disabled={busy} onClick={() => act({ type: "dev_skip", hours: 24 * 7 })}>Skip 1 week</button>
          </div>
        </div>
      )}
      <p className="tiny muted" style={{ marginTop: 12 }}>Ghana: Your Story · Game day passes in 24 real minutes while you play.</p>
    </>
  );
}


function A11ySettings() {
  const [scale, setScale] = useState<UiScale>(getUiScale());
  const [reduce, setReduce] = useState(getReduceMotion());
  const [caps, setCaps] = useState(getCaptions());
  return (
    <div className="card col" style={{ marginTop: 10 }}>
      <b>Accessibility</b>
      <div className="tiny muted">Interface size</div>
      <div className="seg">{([[1, "Normal"], [1.15, "Large"], [1.3, "Larger"]] as const).map(([v, label]) => <button key={v} className={scale === v ? "on" : ""} onClick={() => { setUiScale(v); setScale(v); }}>{label}</button>)}</div>
      <div className="tiny muted">Motion</div>
      <div className="seg">
        <button className={!reduce ? "on" : ""} onClick={() => { setReduceMotion(false); setReduce(false); }}>Full</button>
        <button className={reduce ? "on" : ""} onClick={() => { setReduceMotion(true); setReduce(true); }}>Reduced</button>
      </div>
      <div className="tiny muted">Reduced motion turns off menu and screen animations.</div>
      <div className="tiny muted">Sound captions</div>
      <div className="seg">
        <button className={!caps ? "on" : ""} onClick={() => { setCaptions(false); setCaps(false); }}>Off</button>
        <button className={caps ? "on" : ""} onClick={() => { setCaptions(true); setCaps(true); }}>On</button>
      </div>
      <div className="tiny muted">Short text for horns, music, markets and rain, with which side they come from.</div>
    </div>
  );
}

/** Phone → Story: longer arcs, checked by the server against what you've actually done. */
function StoryApp() {
  const { state } = useGame();
  if (!state) return null;
  const arcs = state.player.missions;
  const [tab, setTab] = useState<"life" | "regions">("life");
  const shown = arcs.filter((a) => (tab === "regions") === !!a.region);
  const open = shown.filter((a) => !a.complete);
  const done = shown.filter((a) => a.complete);
  return (
    <div className="col" style={{ gap: 10 }}>
      <div className="seg"><button className={tab === "life" ? "on" : ""} onClick={() => setTab("life")}>Your life</button><button className={tab === "regions" ? "on" : ""} onClick={() => setTab("regions")}>Around Ghana</button></div>
      <div className="tiny muted">{tab === "life" ? "Do them in any order, or not at all. Each pays once when every step is done." : "Reasons to travel: the people, the food, the places, and the produce you can carry home."}</div>
      {[...open, ...done].map((a) => {
        const next = a.steps.find((s) => !s.done);
        const n = a.steps.filter((s) => s.done).length;
        return (
          <div className="card col" key={a.id} style={{ gap: 6, opacity: a.complete ? 0.7 : 1 }}>
            <div className="spread"><b>{a.icon} {a.title}{a.region ? <span className="tiny muted"> · {a.region}</span> : null}</b><span className={`pill ${a.complete ? "green" : "gold"}`}>{a.complete ? "Done" : `${n}/${a.steps.length}`}</span></div>
            <div className="tiny muted">{a.blurb} Reward: GH₵{a.reward.toLocaleString()} and +{a.reputation} standing.</div>
            {a.steps.map((s) => (
              <div key={s.id} className="small" style={{ display: "flex", gap: 8 }}>
                <span>{s.done ? "✅" : s === next ? "👉" : "⬜"}</span>
                <div><div className={s.done ? "muted" : ""}>{s.label}</div>{s === next && <div className="tiny muted">{s.hint}</div>}</div>
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}

/** Download a backup of this browser's save, or restore one (offline play only). */
function SaveBackup() {
  const [msg, setMsg] = useState<string | null>(null);
  const download = async () => {
    try {
      const { exportSave } = await import("../net/offline-engine.ts");
      const text = await exportSave();
      const url = URL.createObjectURL(new Blob([text], { type: "application/json" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = `ghana-your-story-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      setMsg("Backup downloaded. Keep it somewhere safe; restore it here or on another device.");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Couldn't make a backup.");
    }
  };
  const restore = async (f: File | undefined) => {
    if (!f) return;
    if (!confirm("Replace the game in this browser with the backup? The current progress here will be lost unless you've backed it up.")) return;
    try {
      const { importSave } = await import("../net/offline-engine.ts");
      await importSave(await f.text());
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Couldn't restore that file.");
    }
  };
  return (
    <div className="col" style={{ gap: 6, marginTop: 6 }}>
      <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>
        <button className="btn sm" onClick={download}>⬇️ Download backup</button>
        <label className="btn sm ghost" style={{ cursor: "pointer" }}>⬆️ Restore backup<input type="file" accept="application/json,.json" style={{ display: "none" }} onChange={(e) => restore(e.target.files?.[0])} /></label>
      </div>
      <div className="tiny muted">{msg ?? "Saves live in this browser until the game server is hosted. A backup file lets you keep your life safe or carry it to another device."}</div>
    </div>
  );
}
