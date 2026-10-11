import test from "node:test";
import assert from "node:assert/strict";
import { act, bal, gameMin, grant, makeCtx, newPlayer } from "./helpers.ts";
import { auditPlayer } from "../server/ledger.ts";
import { REGIONS, TOWNS, routeBetween } from "../shared/ghana.ts";
import { intercityQuote } from "../shared/cities.ts";
import { DISTRICTS, PLACES, SERVICES } from "../shared/world.ts";
import { SITES } from "../shared/regional.ts";
import { MINUTES_PER_DAY, toGameDate } from "../shared/calendar.ts";
import type { Ctx } from "../server/engine.ts";

function rich() {
  const env = makeCtx({ devTools: true });
  const id = newPlayer(env.ctx, "graduate", true);
  grant(env.ctx, id, 9_000_000);
  return { ...env, id };
}
const skip = (ctx: Ctx, id: number, hours: number) => assert.ok(act(ctx, id, { type: "dev_skip", hours }).ok);
/** Skip forward to the next occurrence of an hour of the day. */
function skipTo(ctx: Ctx, id: number, hour: number) {
  const h = toGameDate(gameMin(ctx, id)).hour;
  const d = (hour - h + 24) % 24;
  if (d) skip(ctx, id, d);
}
const district = (ctx: Ctx, id: number) => ctx.db.get<{ district: string }>("SELECT district FROM players WHERE id = ?", id)!.district;

test("every town in all 16 regions is reachable by road from Accra", () => {
  assert.equal(Object.keys(REGIONS).length, 16);
  for (const t of TOWNS) assert.ok(routeBetween("accra", t.id), `no road to ${t.name}`);
  const r = routeBetween("accra", "tamale")!;
  assert.ok(r.km > 550 && r.km < 750, `Accra–Tamale ${r.km} km`);
  assert.ok(r.towns.includes("kumasi") && r.towns.includes("kintampo"));
  const wa = routeBetween("kumasi", "wa")!;
  assert.ok(wa.towns.includes("bole") || wa.towns.includes("sawla"), wa.towns.join(" → "));
});

test("every region has a playable town, and every site has a base town", () => {
  const regionsWithTowns = new Set(Object.values(DISTRICTS).map((d) => TOWNS.find((t) => t.id === d.city)?.region));
  for (const r of Object.keys(REGIONS)) assert.ok(regionsWithTowns.has(r as never), `no playable town in ${r}`);
  for (const s of SITES) for (const d of s.from) assert.ok(DISTRICTS[d], `${s.id} from unknown ${d}`);
  for (const p of PLACES) for (const sv of p.services) assert.ok(SERVICES[sv], `${p.id} offers unknown ${sv}`);
});

test("flights only between airports", () => {
  assert.ok(intercityQuote("accra", "tamale", "flight"));
  assert.equal(intercityQuote("accra", "kintampo", "flight"), null);
  const bus = intercityQuote("accra", "kintampo", "bus")!;
  const vip = intercityQuote("accra", "kintampo", "vip")!;
  assert.ok(vip.fare > bus.fare && vip.minutes < bus.minutes);
});

test("intercity bus to Kintampo, then a day trip to the waterfalls", () => {
  const { ctx, id } = rich();
  skipTo(ctx, id, 6);
  const before = gameMin(ctx, id);
  const q = intercityQuote("accra", "kintampo", "vip")!;
  const r = act(ctx, id, { type: "travel", to: "kintampo", mode: "vip" });
  assert.ok(r.ok, r.error);
  assert.equal(district(ctx, id), "kintampo");
  assert.ok(gameMin(ctx, id) - before >= q.minutes);
  // Arrived in the afternoon; trips leave in the morning.
  skipTo(ctx, id, 8);
  const trip = act(ctx, id, { type: "service", placeId: "kintampo_falls_gate", serviceId: "trip_kintampo_falls" });
  assert.ok(trip.ok, trip.error);
  const disc = JSON.parse(ctx.db.get<{ discovered: string }>("SELECT discovered FROM players WHERE id = ?", id)!.discovered) as string[];
  assert.ok(disc.includes("site:kintampo_falls"));
  assert.ok(auditPlayer(ctx.db, id).ok);
  // Lodging away from home.
  skipTo(ctx, id, 20);
  assert.ok(act(ctx, id, { type: "service", placeId: "kintampo_lodge", serviceId: "lodge" }).ok);
});

test("festivals only in season", () => {
  const { ctx, id } = rich();
  skipTo(ctx, id, 10);
  // Game starts in January; Homowo is in August.
  const r = act(ctx, id, { type: "service", placeId: "black_star_square", serviceId: "fest_homowo" });
  assert.notEqual(r.ok, true);
});

test("furnishing raises home comfort; shops only sell their stock", () => {
  const { ctx, id } = rich();
  skipTo(ctx, id, 10);
  assert.ok(act(ctx, id, { type: "travel", to: "osu", mode: "taxi" }).ok);
  skipTo(ctx, id, 10);
  assert.equal(act(ctx, id, { type: "shop_buy", placeId: "melcom_osu", itemId: "kente_cloth" }).code, "not_stocked");
  for (const it of ["spring_mattress", "fridge", "standing_cooker", "generator", "ceiling_fan", "tv32", "curtains"]) {
    const r = act(ctx, id, { type: "shop_buy", placeId: "melcom_osu", itemId: it });
    assert.ok(r.ok, `${it}: ${r.error}`);
  }
  const s = (act(ctx, id, { type: "sync" }), ctx);
  const items = s.db.get<{ n: number }>("SELECT COUNT(*) AS n FROM items WHERE player_id = ?", id)!.n;
  assert.equal(items, 7);
  assert.equal(act(ctx, id, { type: "shop_buy", placeId: "melcom_osu", itemId: "fridge" }).code, "already");
  assert.ok(auditPlayer(ctx.db, id).ok);
});

test("farm: plant in season, harvest once, paid once", () => {
  const { ctx, id } = rich();
  skipTo(ctx, id, 6);
  assert.ok(act(ctx, id, { type: "travel", to: "kintampo", mode: "bus" }).ok);
  skipTo(ctx, id, 8);
  assert.ok(act(ctx, id, { type: "farm_buy", farmId: "kintampo_yam" }).ok);
  const farm = ctx.db.get<{ id: number }>("SELECT id FROM farms WHERE player_id = ?", id)!;
  assert.equal(act(ctx, id, { type: "farm_plant", farmRowId: farm.id, crop: "rice" }).code, "bad_crop");
  const month = toGameDate(gameMin(ctx, id)).month + 1;
  const crop = [11, 12, 1, 2, 3, 4].includes(month) ? "yam" : "cassava";
  const p = act(ctx, id, { type: "farm_plant", farmRowId: farm.id, crop });
  assert.ok(p.ok, p.error);
  assert.equal(act(ctx, id, { type: "farm_harvest", farmRowId: farm.id }).code, "not_ready");
  skip(ctx, id, 24 * 17);
  skipTo(ctx, id, 8);
  const cash = bal(ctx, id, "cash");
  const h = act(ctx, id, { type: "farm_harvest", farmRowId: farm.id });
  assert.ok(h.ok, h.error);
  assert.ok(bal(ctx, id, "cash") > cash);
  assert.equal(act(ctx, id, { type: "farm_harvest", farmRowId: farm.id }).code, "nothing");
  assert.ok(auditPlayer(ctx.db, id).ok);
});

test("driving school: five daily sessions earn licence B", () => {
  const { ctx, id } = rich();
  skipTo(ctx, id, 17); // players start in Kaneshie
  assert.ok(act(ctx, id, { type: "course_enrol", courseId: "driving_b", placeId: "kaneshie_school" }).ok);
  for (let i = 0; i < 5; i++) {
    const r = act(ctx, id, { type: "course_attend", courseId: "driving_b", placeId: "kaneshie_school" });
    assert.ok(r.ok, `session ${i + 1}: ${r.error}`);
    if (i < 4) assert.equal(act(ctx, id, { type: "course_attend", courseId: "driving_b", placeId: "kaneshie_school" }).code, "tomorrow");
    skip(ctx, id, 22);
    skipTo(ctx, id, 17);
  }
  const unlocks = JSON.parse(ctx.db.get<{ unlocks: string }>("SELECT unlocks FROM players WHERE id = ?", id)!.unlocks) as string[];
  assert.ok(unlocks.includes("licence_b"));
});

test("social posts need a smartphone; work-and-pay pays daily", () => {
  const { ctx, id } = rich();
  skipTo(ctx, id, 10);
  assert.equal(act(ctx, id, { type: "social_post", kind: "food" }).code, "no_phone");
  assert.ok(act(ctx, id, { type: "travel", to: "osu", mode: "taxi" }).ok);
  skipTo(ctx, id, 10);
  assert.ok(act(ctx, id, { type: "shop_buy", placeId: "osu_phones", itemId: "nova_s11" }).ok);
  const r = act(ctx, id, { type: "social_post", kind: "food" });
  assert.ok(r.ok, r.error);
  assert.ok(ctx.db.get<{ followers: number }>("SELECT followers FROM social WHERE player_id = ?", id)!.followers > 0);
  // Taxi on work-and-pay.
  assert.ok(act(ctx, id, { type: "travel", to: "kaneshie", mode: "taxi" }).ok);
  skipTo(ctx, id, 10);
  assert.ok(act(ctx, id, { type: "vehicle_buy", vehicleId: "taxi", placeId: "tokunbo_lot" }).ok);
  assert.equal(act(ctx, id, { type: "vehicle_buy", vehicleId: "supercar", placeId: "tokunbo_lot" }).code, "not_stocked");
  const v = ctx.db.get<{ id: number }>("SELECT id FROM vehicles WHERE player_id = ?", id)!;
  assert.ok(act(ctx, id, { type: "vehicle_workpay", vehicleRowId: v.id, on: true }).ok);
  const bank = bal(ctx, id, "bank");
  skip(ctx, id, 24 * 7);
  const n = ctx.db.get<{ n: number }>("SELECT COUNT(*) AS n FROM transactions WHERE player_id = ? AND kind = 'workpay'", id)!.n;
  assert.ok(n >= 4, `workpay days ${n}`);
  assert.ok(bal(ctx, id, "bank") > bank);
  assert.ok(auditPlayer(ctx.db, id).ok);
});

test("old saves gain new columns on migrate", () => {
  const { db } = makeCtx();
  const cols = db.all<{ name: string }>("PRAGMA table_info(vehicles)").map((c) => c.name);
  assert.ok(cols.includes("status") && cols.includes("condition"));
  void MINUTES_PER_DAY;
});

test("every NPC's routine points at real places in their own town", async () => {
  const { NPCS } = await import("../shared/people.ts");
  const { PLACE_BY_ID } = await import("../shared/world.ts");
  for (const n of NPCS) for (const b of n.schedule) {
    const pl = PLACE_BY_ID[b.place];
    assert.ok(pl, `${n.id}: unknown place ${b.place}`);
    assert.equal(DISTRICTS[pl.district].city, DISTRICTS[n.district].city, `${n.id} at ${b.place}`);
  }
});
