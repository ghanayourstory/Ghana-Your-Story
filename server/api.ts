// Transport-agnostic API. The Node HTTP server and the offline browser demo
// both route requests through handle().
import type { Ctx } from "./engine.ts";
import { buildState, createPlayer, loadPlayer, perform, readState, type Action } from "./engine.ts";
import { GameError } from "./ledger.ts";
import { footballView, placeBet } from "./football.ts";

export interface ApiRequest {
  method: string;
  path: string;
  body: unknown;
  token: string | null;
  idemKey: string | null;
}
export interface ApiResponse {
  status: number;
  json: unknown;
}

export interface ApiDeps {
  ctx: Ctx;
  hashToken: (token: string) => Promise<string>;
  newToken: () => string;
}

async function auth(deps: ApiDeps, token: string | null): Promise<number> {
  if (!token || !/^[a-f0-9]{48,128}$/.test(token)) throw new GameError("unauthorized", "Sign in again");
  const h = await deps.hashToken(token);
  const row = deps.ctx.db.get<{ id: number }>("SELECT id FROM players WHERE token_hash = ?", h);
  if (!row) throw new GameError("unauthorized", "Unknown session. Create a new character or restore your save.");
  return row.id;
}

export async function handle(deps: ApiDeps, req: ApiRequest): Promise<ApiResponse> {
  const { ctx } = deps;
  try {
    const body = (req.body && typeof req.body === "object" ? req.body : {}) as Record<string, unknown>;
    if (req.method === "GET" && req.path === "/api/health") return { status: 200, json: { ok: true } };

    if (req.method === "POST" && req.path === "/api/player") {
      const token = deps.newToken();
      const id = createPlayer(ctx, { name: body.name, look: body.look, background: body.background, hometown: body.hometown, languages: body.languages, priorities: body.priorities, isTest: body.test === true });
      ctx.db.run("UPDATE players SET token_hash = ? WHERE id = ?", await deps.hashToken(token), id);
      return { status: 201, json: { token, state: buildState(ctx, loadPlayer(ctx.db, id)) } };
    }

    const playerId = await auth(deps, req.token);

    if (req.method === "GET" && req.path === "/api/state") {
      return { status: 200, json: readState(ctx, playerId) };
    }
    if (req.method === "POST" && req.path === "/api/action") {
      const action = body.action as Action | undefined;
      if (!action || typeof action.type !== "string") return { status: 400, json: { ok: false, error: "Missing action" } };
      const result = perform(ctx, playerId, req.idemKey ?? "", action);
      const state = buildState(ctx, loadPlayer(ctx.db, playerId));
      return { status: result.ok ? 200 : 422, json: { ...result, state } };
    }
    if (req.method === "GET" && req.path === "/api/football") {
      const p = loadPlayer(ctx.db, playerId);
      return { status: 200, json: footballView(ctx, playerId, JSON.parse(p.unlocks).includes("ebo_tips")) };
    }
    if (req.method === "POST" && req.path === "/api/football/bet") {
      const r = placeBet(ctx, playerId, req.idemKey ?? "", { fixtureId: body.fixtureId, selection: body.selection, stake: body.stake });
      const p = loadPlayer(ctx.db, playerId);
      return { status: 200, json: { ok: true, ...r, football: footballView(ctx, playerId, JSON.parse(p.unlocks).includes("ebo_tips")) } };
    }
    return { status: 404, json: { ok: false, error: "Not found" } };
  } catch (err) {
    if (err instanceof GameError) {
      return { status: err.code === "unauthorized" ? 401 : 422, json: { ok: false, code: err.code, error: err.message } };
    }
    console.error(err);
    return { status: 500, json: { ok: false, error: "Server error" } };
  }
}
