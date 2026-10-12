// Start a gig shift (ride-app or delivery): close menus, drive it in the world,
// then report the trips to the server, which decides the pay.
import type { World } from "../world/World.ts";
import type { GameState } from "../../server/engine.ts";
import { JOBS } from "../../shared/world.ts";
import { VEHICLES } from "../../shared/life.ts";

type Act = (a: { type: string } & Record<string, unknown>) => Promise<{ ok: boolean; error?: string }>;

export function gigVehicle(state: GameState): string | null {
  const job = state.player.job ? JOBS[state.player.job.id] : null;
  if (!job?.needsVehicle) return null;
  const cats = job.needsVehicle === "car" ? ["car", "luxury"] : ["motorbike"];
  return (state.vehicles as { type: string; status: string }[]).find((v) => v.status === "personal" && cats.includes(VEHICLES[v.type]?.category))?.type ?? null;
}

export function startGigShift(world: World | null, state: GameState, act: Act, close: () => void) {
  const job = state.player.job ? JOBS[state.player.job.id] : null;
  const type = gigVehicle(state);
  if (!world || !job?.needsVehicle || !type) return;
  close();
  void world.startGig(job.needsVehicle === "car" ? "ride" : "delivery", type).then((r) => {
    if (r.trips > 0) void act({ type: "gig_shift", trips: r.trips, seconds: Math.max(r.seconds, r.trips * 15) });
  });
}
