// Driving HUD: a compact speedometer, big GAS and BRAKE pedals for touch,
// and turn-by-turn directions (with Auto and Skip) when you pick a place on the map.

import type { NavStatus, World } from "../world/World.ts";

const ARROW: Record<NavStatus["turn"], string> = { straight: "⬆", left: "⬅", right: "➡", uturn: "↩", arrive: "📍" };

function metres(m: number) {
  return m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.max(0, Math.round(m / 5) * 5)} m`;
}

export function DriveHud({ world, driving, nav, onWhere }: { world: World | null; driving: { name: string; kmh: number }; nav: NavStatus | null; onWhere: () => void }) {
  const pedal = (kind: "gas" | "brake") => ({
    onPointerDown: (e: React.PointerEvent) => { (e.target as HTMLElement).setPointerCapture?.(e.pointerId); world?.setPedal(kind, true); },
    onPointerUp: () => world?.setPedal(kind, false),
    onPointerCancel: () => world?.setPedal(kind, false),
    onPointerLeave: () => world?.setPedal(kind, false),
    onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
  });
  return (
    <>
      {nav ? (
        <div className={`navbar ${nav.arrived ? "done" : ""}`} role="status" aria-live="polite">
          <span className="navarrow" aria-hidden>{ARROW[nav.turn]}</span>
          <div className="grow">
            <b>{nav.text}</b>
            <div className="tiny">{nav.arrived ? "Park up and get out when you're ready." : `${nav.turn === "left" || nav.turn === "right" ? `in ${metres(nav.dist)} · ` : ""}${metres(nav.total)} to ${nav.name}`}</div>
          </div>
          {!nav.arrived && <button className={`navbtn ${nav.auto ? "on" : ""}`} aria-pressed={nav.auto} onClick={() => world?.setNavAuto(!nav.auto)}>{nav.auto ? "Auto ✓" : "Auto"}</button>}
          {!nav.arrived && <button className="navbtn" onClick={() => world?.navSkip()}>Skip ⏩</button>}
          <button className="navbtn x" aria-label="Stop directions" onClick={() => world?.navCancel()}>✕</button>
        </div>
      ) : (
        <button className="navbar ask" onClick={onWhere}>🧭 <b>Where to?</b> <span className="tiny">Pick a place for directions</span></button>
      )}
      <div className="speedo2" aria-label={`${driving.kmh} kilometres an hour`}>
        <b className="num">{driving.kmh}</b><small>km/h</small>
        <div className="tiny">{driving.name}</div>
      </div>
      <div className="pedals">
        <button className="pedal brake" aria-label="Brake (hold)" {...pedal("brake")}>BRAKE</button>
        <button className="pedal gas" aria-label="Gas (hold)" {...pedal("gas")}>GAS</button>
      </div>
    </>
  );
}
