// Arrange your home: browse a catalogue, see a piece as a ghost in the
// actual room, move and turn it, and only pay when you press "Place and
// buy". Placed pieces can be moved, put in storage or sold for a stated
// amount. Paint and floors can be tried on for free before buying.

import { useEffect, useMemo, useRef, useState } from "react";
import { useGame } from "../store.tsx";
import { money } from "./common.tsx";
import type { World } from "../world/World.ts";
import { CATEGORY_LABEL, FINISHES, PIECES, PIECE_INFO, deliveryFee, placeableRooms, type Category, type FloorFinish, type WallFinish } from "../../shared/furnish.ts";
import { toGameDate } from "../../shared/calendar.ts";

type Tab = "catalogue" | "inventory" | "finishes";
type Moving = { kind: "new"; piece: string } | { kind: "item"; id: number; piece: string; from: { room: string; x: number; z: number; rot: number } | null } | { kind: "standard"; piece: string; room: string };
type Undo = { id: number; room: string; x: number; z: number; rot: number };

export function ArrangePanel({ world, onClose }: { world: World | null; onClose: () => void }) {
  const { state, act, busy } = useGame();
  const [tab, setTab] = useState<Tab>("catalogue");
  const [room, setRoom] = useState<string>("");
  const [cat, setCat] = useState<Category | "all">("all");
  const [moving, setMoving] = useState<Moving | null>(null);
  const [ghost, setGhost] = useState<ReturnType<World["ghostInfo"]>>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [save, setSave] = useState<{ s: "idle" | "saving" | "saved" | "error"; at?: string; msg?: string; retry?: () => void }>({ s: "idle" });
  const [confirmSell, setConfirmSell] = useState<{ id: number; name: string; paid: number; resale: number } | null>(null);
  const [trial, setTrial] = useState<{ kind: "wall"; id: WallFinish } | { kind: "floor"; id: FloorFinish; room: string } | null>(null);
  const undo = useRef<{ back: Undo[]; fwd: Undo[] }>({ back: [], fwd: [] });
  const [, force] = useState(0);

  const home = state?.player.home;
  const rooms = useMemo(() => (home ? placeableRooms(home.spec.tier) : []), [home]);
  const roomInfo = rooms.find((r) => r.id === room) ?? rooms[0];
  useEffect(() => { if (!room && rooms[0]) setRoom(rooms[0].id); }, [rooms, room]);

  // Edit mode on while the panel is open.
  useEffect(() => {
    world?.setEditMode(true);
    return () => world?.setEditMode(false);
  }, [world]);
  // Follow the ghost and taps in the 3D view.
  useEffect(() => {
    const t = setInterval(() => {
      setGhost(world?.ghostInfo() ?? null);
      setSelected(world?.selectedItem ?? null);
    }, 150);
    return () => clearInterval(t);
  }, [world]);

  if (!state || !home) return null;
  const spendable = state.money.cash + state.money.bank + state.money.momo;
  const clock = () => toGameDate(state.time.minute).clock;
  const owner = home.kind === "owned";

  /** Send one change to the game; show saving / saved / error with retry. */
  const run = async (action: { type: string } & Record<string, unknown>) => {
    setSave({ s: "saving" });
    const r = await act(action);
    if (r.ok) setSave({ s: "saved", at: clock() });
    else setSave({ s: "error", msg: r.error === "network" ? "Couldn't reach the game. Nothing was charged." : r.error, retry: () => void run(action) });
    return r;
  };

  const beginNew = (piece: string) => {
    if (!world || !roomInfo) return;
    world.selectedItem = null;
    world.setPreview(null);
    if (world.startGhost(piece, roomInfo.id)) setMoving({ kind: "new", piece });
  };
  const beginMoveItem = (id: number) => {
    const it = home.placed.find((p) => p.id === id);
    const inv = home.inventory.find((i) => i.id === id);
    if (!world || !inv) return;
    const targetRoom = it?.room ?? roomInfo?.id;
    if (!targetRoom) return;
    if (it) world.setPreview({ hideItem: id });
    world.startGhost(inv.piece, targetRoom, it ? { x: it.x, z: it.z, rot: it.rot } : undefined);
    setRoom(targetRoom);
    setMoving({ kind: "item", id, piece: inv.piece, from: it ? { room: it.room, x: it.x, z: it.z, rot: it.rot } : null });
  };
  const beginMoveStandard = (piece: string, fromRoom: string) => {
    if (!world) return;
    const target = rooms.find((r) => r.id === fromRoom) ? fromRoom : roomInfo?.id;
    if (!target) return;
    world.setPreview({ hideStandard: { room: fromRoom, piece } });
    world.startGhost(piece, target);
    setRoom(target);
    setMoving({ kind: "standard", piece, room: fromRoom });
  };
  const cancel = () => {
    world?.endGhost();
    world?.setPreview(null);
    setMoving(null);
  };
  const place = async (again = false) => {
    const g = world?.ghostInfo();
    if (!g || !g.valid || !moving) return;
    let r;
    if (moving.kind === "new") r = await run({ type: "furnish_item", op: "place", piece: g.piece, room: g.room, x: g.x, z: g.z, rot: g.rot });
    else if (moving.kind === "standard") r = await run({ type: "furnish_item", op: "move", fromStandard: { room: moving.room, piece: moving.piece }, room: g.room, x: g.x, z: g.z, rot: g.rot });
    else if (moving.from) {
      r = await run({ type: "furnish_item", op: "move", itemId: moving.id, room: g.room, x: g.x, z: g.z, rot: g.rot });
      if (r.ok) { undo.current.back.push({ id: moving.id, ...moving.from }); undo.current.fwd = []; }
    } else r = await run({ type: "furnish_item", op: "place", itemId: moving.id, room: g.room, x: g.x, z: g.z, rot: g.rot });
    if (!r?.ok) return;
    if (again && moving.kind === "new") { world?.startGhost(moving.piece, g.room, { x: g.x + 0.5, z: g.z + 0.5, rot: g.rot }); return; }
    cancel();
  };
  const undoMove = async (dir: "back" | "fwd") => {
    const stack = undo.current[dir], other = undo.current[dir === "back" ? "fwd" : "back"];
    const step = stack.pop();
    if (!step) return;
    const now = home.placed.find((p) => p.id === step.id);
    const r = await run({ type: "furnish_item", op: "move", itemId: step.id, room: step.room, x: step.x, z: step.z, rot: step.rot });
    if (r.ok && now) other.push({ id: now.id, room: now.room, x: now.x, z: now.z, rot: now.rot });
    else if (!r.ok) stack.push(step);
    force((n) => n + 1);
  };

  // Keyboard: Enter places, Escape cancels.
  const keyRef = useRef({ place, cancel });
  keyRef.current = { place, cancel };
  useEffect(() => {
    if (!world) return;
    world.setEditKeyHandler((k) => (k === "place" ? void keyRef.current.place() : keyRef.current.cancel()));
    return () => world.setEditKeyHandler(null);
  }, [world]);

  const info = moving ? PIECE_INFO[moving.piece] : null;
  const price = moving?.kind === "new" ? PIECES[moving.piece].price : 0;
  const delivery = moving?.kind === "new" ? deliveryFee(price) : 0;
  const total = (price + delivery) * 100;
  const sel = selected ? home.inventory.find((i) => i.id === selected) : null;
  const roomName = (id: string | null) => rooms.find((r) => r.id === id)?.name ?? (id ?? "");
  const curWall = home.finishes.wall ?? "cream";
  const curFloor = (rid: string) => home.finishes.floors?.[rid] ?? "oak";

  if (!rooms.length) {
    return (
      <div className="furnish" role="dialog" aria-label="Arrange your home">
        <div className="spread"><b>🛋️ Arrange your home</b><button className="btn sm ghost" onClick={onClose}>Close</button></div>
        <p className="muted">Placing furniture by hand works in storey houses (villas and mansions) and rented flats for now. This home keeps its standard layout; shop items still appear in their usual spots.</p>
      </div>
    );
  }

  return (
    <div className="furnish" role="dialog" aria-label="Arrange your home">
      <div className="spread" style={{ alignItems: "center", gap: 8 }}>
        <div className="grow">
          <b>🛋️ {home.spec.label}{owner ? "" : " (rented)"}</b>
          <div className="tiny muted">You have {money(spendable)} · <span aria-live="polite">{save.s === "saving" ? "Saving…" : save.s === "saved" ? `Saved ✓ ${save.at}` : save.s === "error" ? <span className="bad">{save.msg} {save.retry && <button className="linkish" onClick={save.retry}>Retry</button>}</span> : "All changes save to your game"}</span></div>
        </div>
        <button className="btn sm ghost" aria-label="Turn the view left" onClick={() => world?.turnCamera(-1)}>↺</button>
        <button className="btn sm ghost" aria-label="Turn the view right" onClick={() => world?.turnCamera(1)}>↻</button>
        <button className="btn sm" onClick={() => { cancel(); onClose(); }}>Done</button>
      </div>
      {!owner && <div className="notice" style={{ marginTop: 6 }}>Rented: the landlord's furniture stays put. Pieces you buy are yours: move them, store them, sell them, or take them along when you move.</div>}

      {/* Placing or moving: the receipt and the controls. */}
      {moving && ghost && info && (
        <div className="place-bar" role="group" aria-label="Placing">
          <div className="grow">
            <div className="bold">{PIECES[moving.piece].name} → {roomName(ghost.room)}</div>
            <div className="tiny muted">{info.size[0]}×{info.size[1]} m · {info.use}{info.power ? ` · power: ${info.power}` : ""}</div>
            {moving.kind === "new" ? (
              <div className="tiny">Price {money(price * 100)} + delivery & setup {money(delivery * 100)} = <b>{money(total)}</b> · after: {money(spendable - total)}{spendable < total ? <span className="bad"> · not enough money</span> : ""}</div>
            ) : <div className="tiny">Moving costs nothing.</div>}
            <div className={`tiny ${ghost.valid ? "good" : "bad"}`} aria-live="polite">{ghost.valid ? "✓ Fits here" : ghost.reason}</div>
            <div className="tiny muted">Drag it, or use the arrow keys · R or ⟳ to turn · Enter to place · Esc to cancel</div>
          </div>
          <div className="pad" aria-label="Move the piece">
            <button className="btn sm" aria-label="Move back" onClick={() => world?.nudgeGhost(0, -0.25)}>↑</button>
            <div className="row" style={{ gap: 4 }}>
              <button className="btn sm" aria-label="Move left" onClick={() => world?.nudgeGhost(-0.25, 0)}>←</button>
              <button className="btn sm" aria-label="Turn" onClick={() => world?.rotateGhost()}>⟳</button>
              <button className="btn sm" aria-label="Move right" onClick={() => world?.nudgeGhost(0.25, 0)}>→</button>
            </div>
            <button className="btn sm" aria-label="Move forward" onClick={() => world?.nudgeGhost(0, 0.25)}>↓</button>
          </div>
          <div className="col" style={{ gap: 4 }}>
            <button className="btn primary sm" disabled={busy || !ghost.valid || (moving.kind === "new" && spendable < total)} onClick={() => void place()}>{moving.kind === "new" ? `Place and buy · ${money(total, true)}` : moving.kind === "item" && !moving.from ? "Place (free)" : "Put it here"}</button>
            {moving.kind === "new" && <button className="btn sm" disabled={busy || !ghost.valid || spendable < total} onClick={() => void place(true)}>Place + 1 more</button>}
            <button className="btn sm ghost" onClick={cancel}>Cancel (no charge)</button>
          </div>
        </div>
      )}

      {/* A piece you tapped in the room. */}
      {!moving && sel && (
        <div className="place-bar" role="group" aria-label="Selected piece">
          <div className="grow">
            <div className="bold">{sel.name}</div>
            <div className="tiny muted">In the {roomName(sel.room)} · paid {money(sel.paid)} · a dealer would pay {money(sel.resale)} (40%)</div>
          </div>
          <button className="btn sm" onClick={() => beginMoveItem(sel.id)}>Move / turn</button>
          <button className="btn sm" disabled={busy} onClick={() => { void run({ type: "furnish_item", op: "store", itemId: sel.id }); if (world) world.selectedItem = null; }}>Store</button>
          <button className="btn sm ghost" disabled={busy} onClick={() => setConfirmSell({ id: sel.id, name: sel.name, paid: sel.paid, resale: sel.resale })}>Sell…</button>
        </div>
      )}
      {confirmSell && (
        <div className="place-bar warn" role="alertdialog" aria-label="Confirm sale">
          <div className="grow">
            <div className="bold">Sell the {confirmSell.name.toLowerCase()}?</div>
            <div className="tiny">You paid {money(confirmSell.paid)}. The dealer pays <b>{money(confirmSell.resale)}</b> (40% of what you paid), into your cash. It leaves the room for good.</div>
          </div>
          <button className="btn sm primary" disabled={busy} onClick={async () => { const r = await run({ type: "furnish_item", op: "sell", itemId: confirmSell.id, expect: confirmSell.resale }); if (r.ok) { setConfirmSell(null); if (world) world.selectedItem = null; } }}>Sell for {money(confirmSell.resale)}</button>
          <button className="btn sm ghost" onClick={() => setConfirmSell(null)}>Keep it</button>
        </div>
      )}

      {!moving && (
        <>
          <div className="row" style={{ gap: 6, marginTop: 8, flexWrap: "wrap", alignItems: "center" }}>
            <label className="tiny muted" htmlFor="furnish-room">Room</label>
            <select id="furnish-room" className="input" style={{ width: "auto" }} value={roomInfo?.id} onChange={(e) => setRoom(e.target.value)}>
              {rooms.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
            <button className="btn sm ghost" disabled={busy || !undo.current.back.length} onClick={() => void undoMove("back")}>↶ Undo move</button>
            <button className="btn sm ghost" disabled={busy || !undo.current.fwd.length} onClick={() => void undoMove("fwd")}>↷ Redo</button>
          </div>
          <div className="tabs" role="tablist" style={{ marginTop: 8 }}>
            {(["catalogue", "inventory", "finishes"] as Tab[]).map((t) => <button key={t} role="tab" aria-selected={tab === t} className={tab === t ? "on" : ""} onClick={() => { setTab(t); setTrial(null); world?.setPreview(null); }}>{t === "catalogue" ? "Catalogue" : t === "inventory" ? `Your furniture (${home.inventory.length})` : "Paint & floors"}</button>)}
          </div>

          {tab === "catalogue" && (
            <>
              <div className="chipset" style={{ marginTop: 6 }}>
                <button className={`chip ${cat === "all" ? "on" : ""}`} onClick={() => setCat("all")}>All</button>
                {(Object.keys(CATEGORY_LABEL) as Category[]).filter((c) => c !== "cooling").map((c) => <button key={c} className={`chip ${cat === c ? "on" : ""}`} onClick={() => setCat(c)}>{CATEGORY_LABEL[c]}</button>)}
              </div>
              <div className="cards">
                {Object.values(PIECES).filter((p) => !PIECE_INFO[p.id]?.wall && (cat === "all" || PIECE_INFO[p.id]?.category === cat)).map((p) => {
                  const inf = PIECE_INFO[p.id];
                  const fits = roomInfo?.kind === "any" || p.rooms.includes(roomInfo?.kind as never);
                  const owned = home.inventory.filter((i) => i.piece === p.id).length;
                  const cost = (p.price + deliveryFee(p.price)) * 100;
                  return (
                    <button key={p.id} className="card-item" disabled={!fits} aria-label={`${p.name}, ${money(cost)} with delivery${fits ? "" : ", doesn't go in this room"}`} onClick={() => beginNew(p.id)}>
                      <b>{p.name}</b>
                      <span className="tiny muted">{inf.size[0]}×{inf.size[1]} m · {inf.use}</span>
                      <span className="tiny">{money(p.price * 100)} <span className="muted">+ {money(deliveryFee(p.price) * 100)} delivery</span></span>
                      {owned > 0 && <span className="tiny good">You own {owned}</span>}
                      {!fits && <span className="tiny bad">Not for this room</span>}
                    </button>
                  );
                })}
              </div>
              <div className="tiny muted" style={{ marginTop: 6 }}>Choosing a piece costs nothing: you see it in the room first and pay only when you press Place and buy. ACs, curtains and art hang on the wall: get them from Home → Furnish (room list).</div>
            </>
          )}

          {tab === "inventory" && (
            <div style={{ marginTop: 6 }}>
              {!home.inventory.length && <div className="muted">Nothing yet. Pick something from the catalogue.</div>}
              {home.inventory.map((i, k) => (
                <div className="svc" key={`${i.id}-${k}`}>
                  <div className="grow">
                    <div className="bold">{i.name}</div>
                    <div className="tiny muted">{i.where === "storage" ? "📦 In storage" : i.where === "other_home" ? "At your other home" : `In the ${roomName(i.room)}${i.standard ? " (standard spot)" : ""}`} · paid {money(i.paid)} · resale {money(i.resale)} · condition {Math.round(i.condition * 100)}%</div>
                  </div>
                  {i.where === "storage" && <button className="btn sm primary" disabled={busy || !PIECE_INFO[i.piece] || PIECE_INFO[i.piece].wall} onClick={() => beginMoveItem(i.id)}>Place</button>}
                  {i.where === "here" && !i.standard && <button className="btn sm" onClick={() => beginMoveItem(i.id)}>Move</button>}
                  {i.where === "here" && i.standard && !PIECE_INFO[i.piece]?.wall && <button className="btn sm" onClick={() => beginMoveStandard(i.piece, i.room ?? "")}>Move</button>}
                  {i.where === "here" && !i.standard && <button className="btn sm ghost" disabled={busy} onClick={() => void run({ type: "furnish_item", op: "store", itemId: i.id })}>Store</button>}
                  {i.where === "here" && i.standard && <button className="btn sm ghost" disabled={busy} onClick={() => void run({ type: "furnish_item", op: "store", fromStandard: { room: i.room, piece: i.piece } })}>Store</button>}
                  {!i.standard && <button className="btn sm ghost" disabled={busy} onClick={() => setConfirmSell({ id: i.id, name: i.name, paid: i.paid, resale: i.resale })}>Sell…</button>}
                </div>
              ))}
            </div>
          )}

          {tab === "finishes" && (
            <div style={{ marginTop: 6 }}>
              {!owner && <div className="notice">Paint and floors belong to the landlord. Buy a house to change them.</div>}
              <h3>Wall paint (whole house)</h3>
              <div className="chipset">
                {(Object.keys(FINISHES.wall) as WallFinish[]).map((id) => (
                  <button key={id} disabled={!owner} className={`chip ${(trial?.kind === "wall" ? trial.id : curWall) === id ? "on" : ""}`} onClick={() => { setTrial({ kind: "wall", id }); world?.setPreview({ finishes: { wall: id } }); }}>
                    <span className="swatch" style={{ background: FINISHES.wall[id].color }} /> {FINISHES.wall[id].name}{curWall === id ? " · on now" : ""}
                  </button>
                ))}
              </div>
              <h3>Floor: {roomName(roomInfo?.id ?? "")}</h3>
              <div className="chipset">
                {(Object.keys(FINISHES.floor) as FloorFinish[]).map((id) => (
                  <button key={id} disabled={!owner || !roomInfo} className={`chip ${(trial?.kind === "floor" ? trial.id : curFloor(roomInfo?.id ?? "")) === id ? "on" : ""}`} onClick={() => { if (!roomInfo) return; setTrial({ kind: "floor", id, room: roomInfo.id }); world?.setPreview({ finishes: { floors: { [roomInfo.id]: id } } }); }}>
                    {FINISHES.floor[id].name}{curFloor(roomInfo?.id ?? "") === id ? " · on now" : ""}
                  </button>
                ))}
              </div>
              {trial && (() => {
                const f = trial.kind === "wall" ? FINISHES.wall[trial.id] : FINISHES.floor[trial.id];
                const isCur = trial.kind === "wall" ? curWall === trial.id : curFloor(trial.room) === trial.id;
                return (
                  <div className="place-bar" role="group" aria-label="Trying a finish">
                    <div className="grow">
                      <div className="bold">Trying {f.name.toLowerCase()}{trial.kind === "floor" ? ` in the ${roomName(trial.room).toLowerCase()}` : " throughout"}</div>
                      <div className="tiny">Nothing is paid yet. {isCur ? "That's what you have now." : f.price ? `${money(f.price * 100)} · ${trial.kind === "wall" ? "painters take about 4 hours" : "laying takes about 2 hours"}.` : "Free (the original finish)."}</div>
                    </div>
                    <button className="btn sm primary" disabled={busy || isCur || spendable < f.price * 100} onClick={async () => { const r = await run(trial.kind === "wall" ? { type: "furnish_item", op: "finish", kind: "wall", finish: trial.id } : { type: "furnish_item", op: "finish", kind: "floor", room: trial.room, finish: trial.id }); if (r.ok) { setTrial(null); world?.setPreview(null); } }}>{f.price ? `Buy · ${money(f.price * 100, true)}` : "Switch back"}</button>
                    <button className="btn sm ghost" onClick={() => { setTrial(null); world?.setPreview(null); }}>Cancel</button>
                  </div>
                );
              })()}
            </div>
          )}
          <div className="tiny muted" style={{ marginTop: 6 }}>Tap a piece you placed to move, turn, store or sell it.</div>
        </>
      )}
    </div>
  );
}
