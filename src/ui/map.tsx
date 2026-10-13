// The map: your street drawn to scale with every place on it. Tap a place to
// see what it is and walk there; the other tabs take you across Accra or Ghana.

import { useEffect, useMemo, useState } from "react";
import { DISTRICTS, PLACE_BY_ID, type DistrictId } from "../../shared/world.ts";
import { CITIES } from "../../shared/cities.ts";
import { CROSS_HALF, EXTENT_X, EXTENT_Z, ROAD_HALF, WALK_IN, WALK_OUT } from "../world/district.ts";
import type { World } from "../world/World.ts";
import { Sheet } from "./common.tsx";
import { useGame } from "../store.tsx";

const KIND_ICON: Record<string, string> = {
  food: "🍲", work: "💼", bank: "🏦", gym: "🏋️", clinic: "🏥", nightlife: "🎶", beach: "🏖️", market: "🧺", realtor: "🏘️", home: "🏠", church: "⛪",
  transport: "🚐", landmark: "📍", shop: "🛒", school: "🎓", dealer: "🚗", mosque: "🕌", lodge: "🛏️", tour: "🧭", furniture: "🪑", phone: "📱", mall: "🛍️", shrine: "🪘", airport: "✈️", hangar: "🛩️",
};
const KIND_COLOR: Record<string, string> = { food: "#e35d3a", bank: "#0e7c86", transport: "#c99400", nightlife: "#8e3fc4", market: "#b5651d", work: "#2e5d9f", church: "#6b4e9b", mosque: "#1f7a4d", clinic: "#c8452c" };

type Mini = NonNullable<ReturnType<World["minimap"]>>;
function useMini(world: World | null) {
  const [m, setM] = useState<Mini | null>(() => world?.minimap() ?? null);
  useEffect(() => {
    const id = setInterval(() => setM(world?.minimap() ?? null), 400);
    return () => clearInterval(id);
  }, [world]);
  return m;
}

export function MapSheet({ world, onClose, onTravel }: { world: World | null; onClose: () => void; onTravel: (scope: "city" | "ghana") => void }) {
  const { state } = useGame();
  const m = useMini(world);
  const [sel, setSel] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>("all");
  const district = (state?.player.district ?? "kaneshie") as DistrictId;
  const d = DISTRICTS[district];
  const inside = world?.inside ?? false;
  const places = useMemo(() => (m?.places ?? []).map((p) => ({ ...p, dist: Math.hypot(p.x - m!.x, p.z - m!.z) })).sort((a, b) => a.dist - b.dist), [m]);
  const kinds = [...new Set(places.map((p) => p.kind))];
  const shown = places.filter((p) => filter === "all" || p.kind === filter);
  const walk = (id: string) => {
    if (!world) return;
    if (world.inside) world.exitHome();
    if (world.walkToPlace(id)) onClose();
  };
  if (!m) return <Sheet title="🗺️ Map" onClose={onClose}><div className="muted">Loading the map…</div></Sheet>;
  const z0 = -EXTENT_Z + 20, z1 = m.coastal ? m.coastal + 14 : EXTENT_Z - 20;
  const x0 = -EXTENT_X, x1 = EXTENT_X;
  const selP = places.find((p) => p.id === sel);
  const walkZ = (WALK_IN + WALK_OUT) / 2;
  return (
    <Sheet title={`🗺️ ${d.name}`} sub={`${d.roads.main} & ${d.roads.cross} · ${CITIES[d.city]?.name ?? d.city}. Tap a place to walk there.`} onClose={onClose} wide>
      <div className="tabs" style={{ marginTop: 10 }}>
        <button className="on">📍 This area</button>
        <button onClick={() => onTravel("city")}>🏙️ Around {CITIES[d.city]?.name ?? "town"}</button>
        <button onClick={() => onTravel("ghana")}>🇬🇭 Across Ghana</button>
      </div>
      <svg className="mapsvg localmap" viewBox={`${x0} ${z0} ${x1 - x0} ${z1 - z0}`} style={{ marginTop: 10 }}>
        <rect x={x0} y={z0} width={x1 - x0} height={z1 - z0} fill={d.style === "luxury" || d.style === "suburban" ? "#cfdcb4" : "#eadcc0"} />
        {m.coastal && <>
          <rect x={x0} y={ROAD_HALF + 3} width={x1 - x0} height={m.coastal - ROAD_HALF - 3} fill="#f1deb0" />
          <rect x={x0} y={m.coastal} width={x1 - x0} height={z1 - m.coastal} fill="#7cc2d6" />
          <text x={0} y={m.coastal + 9} fontSize="5" textAnchor="middle" fill="#0e5266" fontWeight={700}>Gulf of Guinea</text>
        </>}
        {/* Blocks either side of the roads */}
        {[-1, 1].map((sx) => [-1, 1].filter((sz) => !(m.coastal && sz === 1)).map((sz) => (
          <rect key={`${sx}${sz}`} x={sx < 0 ? x0 + 4 : CROSS_HALF + 4} y={sz < 0 ? z0 + 2 : WALK_OUT + 1} width={x1 - CROSS_HALF - 8} height={sz < 0 ? -WALK_OUT - 1 - z0 - 2 : z1 - WALK_OUT - 3} fill="#d8c8a8" opacity={0.55} rx={2} />
        )))}
        {/* Pavements and roads */}
        <rect x={x0} y={-WALK_OUT} width={x1 - x0} height={WALK_OUT * 2} fill="#cfc6b4" />
        <rect x={-CROSS_HALF - 3} y={z0} width={(CROSS_HALF + 3) * 2} height={(m.coastal ? 0 : z1) - z0} fill="#cfc6b4" />
        <rect x={x0} y={-ROAD_HALF} width={x1 - x0} height={ROAD_HALF * 2} fill="#4a4b4f" />
        <rect x={-CROSS_HALF} y={z0} width={CROSS_HALF * 2} height={(m.coastal ? ROAD_HALF : z1) - z0} fill="#4a4b4f" />
        <line x1={x0} y1={0} x2={x1} y2={0} stroke="#e8b923" strokeWidth={0.5} />
        <text x={x0 + 28} y={1.3} fontSize="3.4" fill="#fff" fontWeight={800}>{d.roads.main}</text>
        <text x={1.2} y={z0 + 20} fontSize="3.4" fill="#fff" fontWeight={800} transform={`rotate(90 1.2 ${z0 + 20})`}>{d.roads.cross}</text>
        {/* Walking route */}
        {m.walking && <line x1={m.x} y1={m.z} x2={m.walking.x} y2={m.walking.z} stroke="#1f7a4d" strokeWidth={1} strokeDasharray="2 1.5" />}
        {/* Places */}
        {shown.map((p, i) => {
          const above = p.z < 0;
          const ly = p.z + (above ? -4.5 - (i % 2) * 3.5 : 6 + (i % 2) * 3.5);
          const on = p.id === sel;
          return (
            <g key={p.id} onClick={() => setSel(p.id)} style={{ cursor: "pointer" }}>
              <circle cx={p.x} cy={p.z} r={on ? 4 : 3} fill={on ? "#1d1a14" : KIND_COLOR[p.kind] ?? "#5a4d38"} stroke="#fff" strokeWidth={0.7} />
              <text x={p.x} y={p.z + 1.2} fontSize="3.2" textAnchor="middle">{KIND_ICON[p.kind] ?? "📍"}</text>
              <text x={p.x} y={ly} fontSize={on ? 3.4 : 2.7} textAnchor="middle" fontWeight={on ? 800 : 600} fill="#1d1a14" stroke="#fffaf0" strokeWidth={0.8} paintOrder="stroke">{p.name.length > 22 && !on ? p.name.slice(0, 20) + "…" : p.name}</text>
            </g>
          );
        })}
        {m.home && <g onClick={() => setSel("home")} style={{ cursor: "pointer" }}><circle cx={m.home.x} cy={m.home.z} r={4} fill="#1f7a4d" stroke="#fff" strokeWidth={0.8} /><text x={m.home.x} y={m.home.z + 1.3} fontSize="3.6" textAnchor="middle">🏠</text><text x={m.home.x} y={m.home.z + 8} fontSize="3" textAnchor="middle" fontWeight={800} fill="#1f7a4d" stroke="#fffaf0" strokeWidth={0.8} paintOrder="stroke">Home</text></g>}
        {/* You */}
        {!inside && <g transform={`translate(${m.x} ${m.z}) rotate(${(-m.yaw * 180) / Math.PI + 180})`}>
          <circle r={6} fill="#ff3b30" opacity={0.18} />
          <path d="M0 -4 L3 3.2 L0 1.6 L-3 3.2 Z" fill="#ff3b30" stroke="#fff" strokeWidth={0.7} />
        </g>}
        <text x={x1 - 4} y={z0 + 6} fontSize="4" textAnchor="end" fontWeight={800} fill="#1d1a14">Pavement ≈ {Math.round(walkZ)} m from the road centre</text>
      </svg>
      {selP && (
        <div className="svc" style={{ marginTop: 8 }}>
          <span className="goal-icon">{KIND_ICON[selP.kind] ?? "📍"}</span>
          <div className="grow">
            <div className="bold">{selP.name}</div>
            <div className="tiny muted">{PLACE_BY_ID[selP.id]?.blurb ?? ""} · {Math.round(selP.dist)} m · about {Math.max(1, Math.round(selP.dist / 80))} min on foot</div>
          </div>
          <button className="btn primary sm" onClick={() => walk(selP.id)}>🚶 Walk here</button>
        </div>
      )}
      {sel === "home" && m.home && (
        <div className="svc" style={{ marginTop: 8 }}>
          <span className="goal-icon">🏠</span>
          <div className="grow"><div className="bold">Home</div><div className="tiny muted">{Math.round(Math.hypot(m.home.x - m.x, m.home.z - m.z))} m</div></div>
          <button className="btn primary sm" onClick={() => walk("home")}>🚶 Walk home</button>
        </div>
      )}
      <div className="chipset" style={{ marginTop: 10 }}>
        <button className={`chip ${filter === "all" ? "on" : ""}`} onClick={() => setFilter("all")}>All</button>
        {kinds.map((k) => <button key={k} className={`chip ${filter === k ? "on" : ""}`} onClick={() => setFilter(k)}>{KIND_ICON[k] ?? "📍"} {k}</button>)}
      </div>
      <h3>Nearby</h3>
      {shown.slice(0, 40).map((p) => (
        <div className="svc" key={p.id} onClick={() => setSel(p.id)} style={{ cursor: "pointer" }}>
          <span className="goal-icon">{KIND_ICON[p.kind] ?? "📍"}</span>
          <div className="grow">
            <div className="bold">{p.name}</div>
            <div className="tiny muted">{Math.round(p.dist)} m{!p.known ? " · not visited yet" : ""}</div>
          </div>
          <button className="btn sm" onClick={(e) => { e.stopPropagation(); walk(p.id); }}>Walk</button>
        </div>
      ))}
    </Sheet>
  );
}
