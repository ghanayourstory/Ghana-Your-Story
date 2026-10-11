// Client-side game store. Holds the latest authoritative state from the
// backend and turns player intents into idempotent requests.
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { newIdemKey, setToken, type Backend } from "./net/backend.ts";
import type { GameState, FeedbackItem } from "../server/engine.ts";
import type { BetView, Fixture } from "../shared/football.ts";

export interface Toast extends FeedbackItem {
  id: number;
}

export interface FootballView {
  serverNow: number;
  provider: { status: string; message: string; open: boolean; lastOk: number };
  fixtures: Fixture[];
  bets: BetView[];
  cash: number;
  limits: { min: number; max: number };
  tips: Record<string, string>;
}

interface Ctx {
  backend: Backend;
  state: GameState | null;
  toasts: Toast[];
  busy: boolean;
  act: (action: { type: string } & Record<string, unknown>, opts?: { silent?: boolean }) => Promise<{ ok: boolean; data?: unknown; error?: string }>;
  refresh: () => Promise<void>;
  football: FootballView | null;
  loadFootball: () => Promise<void>;
  placeBet: (fixtureId: string, selection: string, stake: number) => Promise<{ ok: boolean; error?: string }>;
  toast: (t: FeedbackItem) => void;
  dismiss: (id: number) => void;
  setState: (s: GameState) => void;
  onFeedback: React.MutableRefObject<((f: FeedbackItem[]) => void) | null>;
  logout: () => void;
}

const GameCtx = createContext<Ctx | null>(null);
export const useGame = () => useContext(GameCtx)!;

let toastSeq = 1;

export function GameProvider({ backend, initial, children, onLogout }: { backend: Backend; initial: GameState; children: ReactNode; onLogout: () => void }) {
  const [state, setState] = useState<GameState | null>(initial);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [busy, setBusy] = useState(false);
  const [football, setFootball] = useState<FootballView | null>(null);
  const onFeedback = useRef<((f: FeedbackItem[]) => void) | null>(null);
  const inflight = useRef(0);

  const toast = useCallback((t: FeedbackItem) => {
    const id = toastSeq++;
    setToasts((ts) => [...ts.slice(-4), { ...t, id }]);
    setTimeout(() => setToasts((ts) => ts.filter((x) => x.id !== id)), t.tone === "goal" ? 7000 : 5200);
  }, []);
  const dismiss = useCallback((id: number) => setToasts((ts) => ts.filter((x) => x.id !== id)), []);

  const act: Ctx["act"] = useCallback(async (action, opts = {}) => {
    const key = newIdemKey();
    if (!opts.silent) {
      inflight.current++;
      setBusy(true);
    }
    try {
      const res = await backend.request<{ ok: boolean; error?: string; feedback: FeedbackItem[]; state: GameState; data?: unknown }>("POST", "/api/action", { action }, key);
      const j = res.json;
      if (j.state) setState(j.state);
      if (j.feedback?.length) {
        for (const f of j.feedback) toast(f);
        onFeedback.current?.(j.feedback);
      }
      if (!j.ok && !opts.silent) toast({ text: j.error ?? "That didn't work", changes: [], tone: "bad" });
      if (res.status === 401) onLogout();
      return { ok: j.ok, data: j.data, error: j.error };
    } catch {
      if (!opts.silent) toast({ text: "Connection problem. Your last action was not lost — try again.", changes: [], tone: "bad" });
      return { ok: false, error: "network" };
    } finally {
      if (!opts.silent) {
        inflight.current--;
        if (inflight.current <= 0) setBusy(false);
      }
    }
  }, [backend, toast, onLogout]);

  const refresh = useCallback(async () => {
    const res = await backend.request<{ state: GameState; feedback: FeedbackItem[] }>("GET", "/api/state");
    if (res.status === 401) return onLogout();
    if (res.json.state) setState(res.json.state);
    for (const f of res.json.feedback ?? []) toast(f);
    if (res.json.feedback?.length) onFeedback.current?.(res.json.feedback);
  }, [backend, toast, onLogout]);

  const loadFootball = useCallback(async () => {
    const res = await backend.request<FootballView>("GET", "/api/football");
    if (res.status === 200) setFootball(res.json);
  }, [backend]);

  const placeBet = useCallback(async (fixtureId: string, selection: string, stake: number) => {
    const res = await backend.request<{ ok: boolean; error?: string; message?: string; football?: FootballView }>("POST", "/api/football/bet", { fixtureId, selection, stake }, newIdemKey());
    if (res.json.football) setFootball(res.json.football);
    if (res.json.ok) {
      toast({ text: `⚽ ${res.json.message}`, changes: [{ k: "cash", d: -stake }], tone: "info" });
      void refresh();
    } else toast({ text: res.json.error ?? "Bet rejected", changes: [], tone: "bad" });
    return { ok: res.json.ok, error: res.json.error };
  }, [backend, toast, refresh]);

  // Keep the clock honest: re-read the authoritative state every 20 s.
  useEffect(() => {
    const t = setInterval(() => void refresh(), 20_000);
    return () => clearInterval(t);
  }, [refresh]);

  const logout = useCallback(() => {
    setToken(null);
    onLogout();
  }, [onLogout]);

  return (
    <GameCtx.Provider value={{ backend, state, toasts, busy, act, refresh, football, loadFootball, placeBet, toast, dismiss, setState, onFeedback, logout }}>
      {children}
    </GameCtx.Provider>
  );
}
