import test from "node:test";
import assert from "node:assert/strict";
import { act, bal, gameMin, grant, makeCtx, newPlayer } from "./helpers.ts";
import { auditPlayer } from "../server/ledger.ts";
import { REGIONS, TOWNS, routeBetween } from "../shared/ghana.ts";
import { intercityQuote } from "../shared/cities.ts";
import { DISTRICTS, JOBS, PLACES, SERVICES } from "../shared/world.ts";
import { NPCS } from "../shared/people.ts";
import { SITES } from "../shared/regional.ts";
import { COURSES, VEHICLES } from "../shared/life.ts";
import { outageWindow, powerOff } from "../shared/power.ts";
import { marketDays, townEvents } from "../shared/weekly.ts";
import { MINUTES_PER_DAY, toGameDate } from "../shared/calendar.ts";
import { buildState, createPlayer, loadPlayer, type Ctx } from "../server/engine.ts";
import { districtsIn } from "../shared/world.ts";

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

test("driving school: five lessons, then a road test you drive yourself earns licence B", () => {
  const { ctx, id } = rich();
  skipTo(ctx, id, 17); // players start in Kaneshie
  assert.ok(act(ctx, id, { type: "course_enrol", courseId: "driving_b", placeId: "kaneshie_school" }).ok);
  for (let i = 0; i < 5; i++) {
    const r = act(ctx, id, { type: "course_attend", courseId: "driving_b", placeId: "kaneshie_school" });
    assert.ok(r.ok, `session ${i + 1}: ${r.error}`);
    if (i < 4) assert.equal(act(ctx, id, { type: "course_attend", courseId: "driving_b", placeId: "kaneshie_school" }).code, "tomorrow");
    if (i < 4) {
      skip(ctx, id, 22);
      skipTo(ctx, id, 17);
    }
  }
  const lic = () => (JSON.parse(ctx.db.get<{ unlocks: string }>("SELECT unlocks FROM players WHERE id = ?", id)!.unlocks) as string[]).includes("licence_b");
  assert.ok(!lic());
  // A rough first drive: fail, pay the retest fee; only one attempt a day; implausible results are refused.
  assert.equal(act(ctx, id, { type: "road_test", courseId: "driving_b", placeId: "kaneshie_school", faults: 2, seconds: 3 }).code, "bad_result");
  skip(ctx, id, 20);
  skipTo(ctx, id, 17);
  const cash = bal(ctx, id, "bank") + bal(ctx, id, "cash");
  const fail = act(ctx, id, { type: "road_test", courseId: "driving_b", placeId: "kaneshie_school", faults: 6, seconds: 140 });
  assert.ok(fail.ok, fail.error);
  assert.equal((fail.data as { passed: boolean }).passed, false);
  assert.equal(cash - (bal(ctx, id, "bank") + bal(ctx, id, "cash")), 15000);
  assert.equal(act(ctx, id, { type: "road_test", courseId: "driving_b", placeId: "kaneshie_school", faults: 0, seconds: 120 }).code, "tomorrow");
  skip(ctx, id, 22);
  skipTo(ctx, id, 17);
  const pass = act(ctx, id, { type: "road_test", courseId: "driving_b", placeId: "kaneshie_school", faults: 2, seconds: 150 });
  assert.ok(pass.ok, pass.error);
  assert.equal((pass.data as { passed: boolean }).passed, true);
  assert.ok(lic());
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

test("catalogues are consistent: dealers, stores, farms, courses, plots and rentals", async () => {
  const { DEALER_STOCK, ITEMS, STORE_STOCK, PLACE_STOCK, FARMLANDS, CROPS, COURSES, VEHICLES } = await import("../shared/life.ts");
  const { PLOTS, RENTALS, DESIGNS, BUSINESSES } = await import("../shared/economy.ts");
  const { PLACE_BY_ID } = await import("../shared/world.ts");
  for (const [pid, vs] of Object.entries(DEALER_STOCK)) {
    assert.equal(PLACE_BY_ID[pid]?.kind, "dealer", `${pid} is not a dealer`);
    for (const v of vs) assert.ok(VEHICLES[v], `${pid}: ${v}`);
  }
  for (const list of [...Object.values(STORE_STOCK), ...Object.values(PLACE_STOCK)]) for (const i of list) assert.ok(ITEMS[i], i);
  for (const pid of Object.keys(PLACE_STOCK)) assert.ok(PLACE_BY_ID[pid], pid);
  for (const f of Object.values(FARMLANDS)) { assert.ok(DISTRICTS[f.district], f.id); for (const c of f.crops) assert.ok(CROPS[c], c); }
  for (const c of Object.values(COURSES)) for (const pl of c.places) assert.ok(PLACE_BY_ID[pl], `${c.id}: ${pl}`);
  for (const p of Object.values(PLOTS)) { assert.ok(DISTRICTS[p.district], p.id); for (const d of p.allowed) assert.ok(DESIGNS[d], d); }
  for (const r of Object.values(RENTALS)) assert.ok(DISTRICTS[r.district], r.id);
  for (const b of Object.values(BUSINESSES)) assert.ok(DISTRICTS[b.district], b.id);
  // Every playable town has somewhere to sleep.
  for (const d of Object.keys(DISTRICTS)) {
    const city = DISTRICTS[d].city;
    if (city === "accra") continue;
    assert.ok(Object.values(PLACE_BY_ID).some((p) => p.district === d && p.services.includes("lodge")), `no lodge in ${d}`);
  }
});

test("offline single-player tester can be granted GH₵500M through the audited ledger", async () => {
  const { openNodeDb } = await import("../server/sqlite-node.ts");
  const { migrate } = await import("../server/db.ts");
  const { createPlayer, perform } = await import("../server/engine.ts");
  const db = openNodeDb(":memory:");
  migrate(db);
  const ctx = { db, now: () => Date.UTC(2026, 9, 12), config: { devTools: true, everyoneIsTester: true } };
  const id = createPlayer(ctx, { name: "Tester", look: {}, background: "graduate" });
  const r = perform(ctx, id, "grant500mtestkey", { type: "dev_grant", amount: 500_000_000 * 100 });
  assert.ok(r.ok, r.error);
  assert.ok(bal(ctx, id, "bank") >= 500_000_000 * 100);
  assert.ok(auditPlayer(db, id).ok);
  // Without the offline flag, ordinary players can't use dev tools.
  const ctx2 = { ...ctx, config: { devTools: true } };
  const id2 = createPlayer(ctx2, { name: "Other", look: {}, background: "graduate" });
  assert.equal(perform(ctx2, id2, "grantdeniedkey01", { type: "dev_grant", amount: 100 }).code, "forbidden");
});

test("homes: compound rooms share a bathroom and cook on a coal pot; penthouses come finished", async () => {
  const { ctx, id } = rich();
  skipTo(ctx, id, 7);
  assert.equal(act(ctx, id, { type: "home_activity", activity: "shower" }).code, "not_here");
  assert.ok(act(ctx, id, { type: "home_activity", activity: "shared_bath" }).ok);
  assert.ok(act(ctx, id, { type: "home_activity", activity: "cook_coalpot" }).ok);
  assert.ok(act(ctx, id, { type: "home_activity", activity: "neighbours" }).ok);
  // Buy a turnkey penthouse and live there.
  ctx.db.run("UPDATE players SET reputation = 30 WHERE id = ?", id);
  assert.ok(act(ctx, id, { type: "travel", to: "east_legon", mode: "taxi" }).ok);
  const r = act(ctx, id, { type: "plot_buy", plotId: "legon_penthouse_unit" });
  assert.ok(r.ok, r.error);
  const b = ctx.db.get<{ id: number; status: string; design: string }>("SELECT * FROM buildings WHERE player_id = ?", id)!;
  assert.equal(b.status, "complete");
  assert.equal(b.design, "penthouse_unit");
  assert.ok(act(ctx, id, { type: "building_use", buildingId: b.id, use: "live" }).ok);
  assert.ok(act(ctx, id, { type: "home_activity", activity: "shower" }).ok);
  assert.ok(act(ctx, id, { type: "home_activity", activity: "terrace" }).ok);
  assert.ok(act(ctx, id, { type: "home_activity", activity: "watch_tv" }).ok);
  assert.ok(auditPlayer(ctx.db, id).ok);
});

test("needs: bladder, hygiene and fun run down; the toilet, a bath and TV fix them; mood explains why", () => {
  const { ctx, id } = rich();
  skipTo(ctx, id, 7);
  ctx.db.run("UPDATE players SET bladder = 10, hygiene = 10, fun = 10 WHERE id = ?", id);
  const s0 = act(ctx, id, { type: "home_activity", activity: "toilet" });
  assert.ok(s0.ok, s0.error);
  let p = ctx.db.get<{ bladder: number; hygiene: number; fun: number }>("SELECT bladder, hygiene, fun FROM players WHERE id = ?", id)!;
  assert.equal(p.bladder, 100);
  const moodBefore = buildState(ctx, loadPlayer(ctx.db, id)).player.mood;
  assert.ok(moodBefore.moodlets.some((m) => m.id === "smelly"));
  assert.ok(act(ctx, id, { type: "home_activity", activity: "shared_bath" }).ok);
  p = ctx.db.get<{ bladder: number; hygiene: number; fun: number }>("SELECT bladder, hygiene, fun FROM players WHERE id = ?", id)!;
  assert.ok(p.hygiene > 60);
  assert.ok(act(ctx, id, { type: "home_activity", activity: "neighbours" }).ok);
  p = ctx.db.get<{ bladder: number; hygiene: number; fun: number }>("SELECT bladder, hygiene, fun FROM players WHERE id = ?", id)!;
  assert.ok(p.fun > 15);
  // Holding it forever ends badly.
  ctx.db.run("UPDATE players SET bladder = 2, hygiene = 90 WHERE id = ?", id);
  assert.ok(act(ctx, id, { type: "sleep", hours: 2 }).ok);
  p = ctx.db.get<{ bladder: number; hygiene: number; fun: number }>("SELECT bladder, hygiene, fun FROM players WHERE id = ?", id)!;
  assert.ok(p.hygiene < 60);
});

test("today's hustle: three goals that fit your life, rewards once each, one swap, settings pause needs", () => {
  const { ctx, id } = rich();
  skipTo(ctx, id, 9);
  let d = buildState(ctx, loadPlayer(ctx.db, id)).player.daily;
  assert.equal(d.goals.length, 3);
  // No job yet: never asked to work a shift.
  assert.ok(!d.goals.some((g) => g.id === "shift"));
  const cashBefore = bal(ctx, id, "cash");
  // Swap one goal once.
  const target = d.goals.find((g) => !g.done)!;
  assert.ok(act(ctx, id, { type: "daily_swap", goalId: target.id }).ok);
  assert.equal(act(ctx, id, { type: "daily_swap", goalId: d.goals[1].id === target.id ? d.goals[0].id : d.goals[1].id }).code, "swapped");
  // Do a bath: if it's a goal, it pays exactly once.
  ctx.db.run("UPDATE players SET daily = ? WHERE id = ?", JSON.stringify({ day: d.day, goals: [{ id: "clean", progress: 0, done: false }, { id: "talk", progress: 0, done: false }, { id: "fun", progress: 0, done: false }], swapped: false, bonusPaid: false, streak: 0, lastFullDay: -1 }), id);
  assert.ok(act(ctx, id, { type: "home_activity", activity: "shared_bath" }).ok);
  assert.ok(act(ctx, id, { type: "home_activity", activity: "shared_bath" }).ok);
  d = buildState(ctx, loadPlayer(ctx.db, id)).player.daily;
  assert.equal(d.goals.find((g) => g.id === "clean")!.done, true);
  assert.equal(bal(ctx, id, "cash") - cashBefore, 15 * 100 - 0); // shared bath is free; one reward only
  // Fun via the neighbours, then the bonus once all three are done... talk still pending, so no bonus yet.
  assert.ok(act(ctx, id, { type: "home_activity", activity: "neighbours" }).ok);
  d = buildState(ctx, loadPlayer(ctx.db, id)).player.daily;
  assert.equal(d.bonusPaid, false);
  // Pause needs: a long nap doesn't drain them.
  assert.ok(act(ctx, id, { type: "settings", needsPace: 0 }).ok);
  const before = ctx.db.get<{ bladder: number; hygiene: number }>("SELECT bladder, hygiene FROM players WHERE id = ?", id)!;
  assert.ok(act(ctx, id, { type: "sleep", hours: 2 }).ok);
  const after = ctx.db.get<{ bladder: number; hygiene: number }>("SELECT bladder, hygiene FROM players WHERE id = ?", id)!;
  assert.equal(after.bladder, before.bladder);
  assert.equal(after.hygiene, before.hygiene);
  assert.equal(act(ctx, id, { type: "settings", needsPace: 3 }).code, "bad_setting");
  assert.ok(auditPlayer(ctx.db, id).ok);
});

test("market hustle: buy at the market, sell at the station for a margin; fruit goes off; you can only carry so much", () => {
  const { ctx, id } = rich();
  skipTo(ctx, id, 7);
  const station = PLACES.find((p) => p.district === "kaneshie" && p.kind === "transport")!;
  assert.equal(act(ctx, id, { type: "trade_buy", placeId: station.id, goodId: "pure_water", qty: 5 }).code, "not_market");
  const cash0 = bal(ctx, id, "cash");
  assert.ok(act(ctx, id, { type: "trade_buy", placeId: "kaneshie_market", goodId: "pure_water", qty: 10 }).ok);
  assert.equal(act(ctx, id, { type: "trade_buy", placeId: "kaneshie_market", goodId: "clothes", qty: 25 }).code, "too_much");
  assert.ok(act(ctx, id, { type: "trade_buy", placeId: "kaneshie_market", goodId: "oranges", qty: 10 }).ok);
  // Tomatoes only sell in markets.
  assert.ok(act(ctx, id, { type: "trade_buy", placeId: "kaneshie_market", goodId: "tomatoes", qty: 1 }).ok);
  assert.equal(act(ctx, id, { type: "trade_sell", placeId: station.id, goodId: "tomatoes", qty: 1 }).code, "no_buyers");
  const r = act(ctx, id, { type: "trade_sell", placeId: station.id, goodId: "pure_water", qty: 10 });
  assert.ok(r.ok, r.error);
  const w = buildState(ctx, loadPlayer(ctx.db, id)).player;
  assert.ok(!w.stock.some((s) => s.id === "pure_water"));
  // Ten bags of water: bought at ~GH₵7, sold at ~GH₵11.
  assert.ok(bal(ctx, id, "cash") > cash0 - (10 * 9 + 45) * 100 + 10 * 9 * 100);
  assert.equal(act(ctx, id, { type: "trade_sell", placeId: station.id, goodId: "pure_water", qty: 1 }).code, "no_stock");
  // Oranges spoil overnight.
  const before = w.stock.find((s) => s.id === "oranges")!.qty;
  assert.ok(act(ctx, id, { type: "sleep", hours: 8 }).ok);
  assert.ok(act(ctx, id, { type: "sleep", hours: 8 }).ok);
  const after = buildState(ctx, loadPlayer(ctx.db, id)).player.stock.find((s) => s.id === "oranges")?.qty ?? 0;
  assert.ok(after < before);
  assert.ok(auditPlayer(ctx.db, id).ok);
});

test("MoMo wallet: cash in free, cash out costs an agent fee, street payments use cash then MoMo", () => {
  const { ctx, id } = rich();
  skipTo(ctx, id, 9);
  const cash0 = bal(ctx, id, "cash");
  assert.ok(act(ctx, id, { type: "momo_move", from: "cash", to: "momo", amount: cash0 }).ok);
  assert.equal(bal(ctx, id, "cash"), 0);
  assert.equal(bal(ctx, id, "momo"), cash0);
  // A trotro fare with no cash in hand comes out of MoMo, not the bank.
  const bank0 = bal(ctx, id, "bank");
  assert.ok(act(ctx, id, { type: "travel", to: "osu", mode: "trotro" }).ok);
  assert.ok(bal(ctx, id, "momo") < cash0);
  assert.equal(bal(ctx, id, "bank"), bank0);
  // Cash out 100: 1% agent fee.
  const m = bal(ctx, id, "momo");
  assert.ok(act(ctx, id, { type: "momo_move", from: "momo", to: "cash", amount: 10000 }).ok);
  assert.equal(bal(ctx, id, "cash"), 10000);
  assert.equal(bal(ctx, id, "momo"), m - 10100);
  assert.equal(act(ctx, id, { type: "momo_move", from: "cash", to: "bank", amount: 100 }).code, "bad_move");
  assert.ok(auditPlayer(ctx.db, id).ok);
});

test("family: a hometown family with local names; call, send MoMo for a request, visit in person", () => {
  const env = makeCtx({ devTools: true });
  const { ctx } = env;
  const id = createPlayer(ctx, { name: "Fati Mahama", look: {}, background: "graduate", hometown: "tamale", isTest: true });
  grant(ctx, id, 9_000_000);
  skipTo(ctx, id, 9);
  let fam = buildState(ctx, loadPlayer(ctx.db, id)).player.family;
  assert.equal(fam.length, 5);
  assert.ok(fam.every((m) => m.town === "tamale" || m.town === "kumasi"));
  assert.ok(fam.find((m) => m.role === "father")!.name.endsWith("Mahama"));
  const mum = fam.find((m) => m.role === "mother")!;
  assert.ok(act(ctx, id, { type: "family_call", memberId: mum.id }).ok);
  fam = buildState(ctx, loadPlayer(ctx.db, id)).player.family;
  assert.ok(fam.find((m) => m.id === mum.id)!.closeness > mum.closeness);
  // Give the younger sibling a school-fees request and pay it on MoMo.
  const kid = fam.find((m) => m.age < 20)!;
  const day = buildState(ctx, loadPlayer(ctx.db, id)).time.day;
  ctx.db.run("UPDATE family SET request = ? WHERE id = ?", JSON.stringify({ reason: "school fees", amount: 300, dueDay: day + 5 }), kid.id);
  assert.equal(act(ctx, id, { type: "family_send", memberId: kid.id, amount: 30000 }).code, "insufficient_funds");
  assert.ok(act(ctx, id, { type: "momo_move", from: "bank", to: "momo", amount: 50000 }).ok);
  assert.ok(act(ctx, id, { type: "family_send", memberId: kid.id, amount: 30000 }).ok);
  const st = buildState(ctx, loadPlayer(ctx.db, id)).player;
  assert.equal(st.family.find((m) => m.id === kid.id)!.request, null);
  assert.ok(st.mood.moodlets.some((m) => m.id === "helped_family"));
  // Visiting needs you to be in Tamale.
  assert.equal(act(ctx, id, { type: "family_visit", memberId: mum.id }).code, "not_here");
  const r = act(ctx, id, { type: "travel", to: districtsIn("tamale")[0], mode: "bus" });
  assert.ok(r.ok, r.error);
  // Family keep their own week: on a weekday morning the young one is at school.
  while (![1, 2, 3, 4].includes(toGameDate(gameMin(ctx, id)).weekdayIndex)) skip(ctx, id, 12);
  skipTo(ctx, id, 10);
  const young = st.family.find((m) => m.age < 18)!;
  const yv = act(ctx, id, { type: "family_visit", memberId: young.id });
  assert.equal(yv.code, "not_home");
  assert.equal(buildState(ctx, loadPlayer(ctx.db, id)).player.family.find((m) => m.id === young.id)!.where, "school");
  assert.equal(act(ctx, id, { type: "family_chore", chore: "homework" }).code, "nobody_home");
  // Grandma is home: sweep the compound with her. Evening: homework, then visit mum.
  const sw = act(ctx, id, { type: "family_chore", chore: "sweep" });
  assert.ok(sw.ok, sw.error);
  assert.equal(act(ctx, id, { type: "family_chore", chore: "sweep" }).code, "already");
  skipTo(ctx, id, 17);
  const hw = act(ctx, id, { type: "family_chore", chore: "homework" });
  assert.ok(hw.ok, hw.error);
  assert.ok(act(ctx, id, { type: "family_visit", memberId: mum.id }).ok);
  assert.ok(auditPlayer(ctx.db, id).ok);
});

test("police checkpoint: no licence means a fine, a licence means a safe journey, and checks are rate-limited", () => {
  const { ctx, id } = rich();
  skipTo(ctx, id, 9);
  assert.equal(act(ctx, id, { type: "police_check", vehicleType: "sedan_used" }).code, "no_vehicle");
  // Give the player a car directly (dealers are tested elsewhere).
  ctx.db.run("INSERT INTO vehicles (player_id, type, price, bought_min) VALUES (?, 'compact', 9000000, 0)", id);
  const lic = VEHICLES.compact.licence!;
  const cash0 = bal(ctx, id, "cash") + bal(ctx, id, "bank") + bal(ctx, id, "momo");
  const r = act(ctx, id, { type: "police_check", vehicleType: "compact" });
  assert.ok(r.ok, r.error);
  assert.equal((r.data as { fined: boolean }).fined, true);
  assert.equal(cash0 - (bal(ctx, id, "cash") + bal(ctx, id, "bank") + bal(ctx, id, "momo")), 30000);
  // Again straight away: no second stop.
  assert.equal((act(ctx, id, { type: "police_check", vehicleType: "compact" }).data as { stopped: boolean }).stopped, false);
  // With a licence, later: waved on.
  const p = loadPlayer(ctx.db, id);
  ctx.db.run("UPDATE players SET unlocks = ? WHERE id = ?", JSON.stringify([...JSON.parse(p.unlocks), lic]), id);
  assert.ok(act(ctx, id, { type: "sleep", hours: 3 }).ok);
  const r2 = act(ctx, id, { type: "police_check", vehicleType: "compact" });
  assert.equal((r2.data as { fined: boolean }).fined, false);
  assert.ok(auditPlayer(ctx.db, id).ok);
});

test("dumsor: the published schedule switches screens off at home; a generator keeps them on for fuel", () => {
  const { ctx, id } = rich();
  ctx.db.run("INSERT INTO items (player_id, item_id, price, bought_min) VALUES (?, 'tv32', 100, 0)", id);
  // Find the next outage for Kaneshie and wait for it.
  let day = Math.floor(gameMin(ctx, id) / MINUTES_PER_DAY);
  let w = outageWindow("kaneshie", day);
  while (!w || (day === Math.floor(gameMin(ctx, id) / MINUTES_PER_DAY) && toGameDate(gameMin(ctx, id)).hour >= w[1])) { day++; w = outageWindow("kaneshie", day); }
  while (Math.floor(gameMin(ctx, id) / MINUTES_PER_DAY) < day) skip(ctx, id, 12);
  skipTo(ctx, id, w[0] + 1);
  assert.ok(powerOff("kaneshie", gameMin(ctx, id)));
  assert.equal(act(ctx, id, { type: "home_activity", activity: "watch_tv" }).code, "dumsor");
  assert.ok(buildState(ctx, loadPlayer(ctx.db, id)).player.mood.moodlets.some((m) => m.id === "dumsor"));
  assert.ok(act(ctx, id, { type: "home_activity", activity: "music" }).ok); // the radio runs on batteries
  ctx.db.run("INSERT INTO items (player_id, item_id, price, bought_min) VALUES (?, 'generator', 100, 0)", id);
  const before = bal(ctx, id, "cash");
  assert.ok(act(ctx, id, { type: "home_activity", activity: "watch_tv" }).ok);
  assert.ok(bal(ctx, id, "cash") < before);
  assert.ok(auditPlayer(ctx.db, id).ok);
});

test("gig jobs need the licence and your own wheels; trades take anyone", () => {
  const { ctx, id } = rich();
  skipTo(ctx, id, 9);
  assert.ok(act(ctx, id, { type: "travel", to: "airport_city", mode: "taxi" }).ok);
  assert.equal(act(ctx, id, { type: "job_apply", jobId: "ride_driver" }).code, "needs_licence");
  const p = loadPlayer(ctx.db, id);
  ctx.db.run("UPDATE players SET unlocks = ? WHERE id = ?", JSON.stringify([...JSON.parse(p.unlocks), "licence_b"]), id);
  assert.equal(act(ctx, id, { type: "job_apply", jobId: "ride_driver" }).code, "needs_vehicle");
  ctx.db.run("INSERT INTO vehicles (player_id, type, price, bought_min) VALUES (?, 'compact', 9000000, 0)", id);
  assert.ok(act(ctx, id, { type: "job_apply", jobId: "ride_driver" }).ok);
  skipTo(ctx, id, 10);
  assert.equal(act(ctx, id, { type: "work" }).code, "drive_it");
  assert.equal(act(ctx, id, { type: "gig_shift", trips: 3, seconds: 5 }).code, "bad_result");
  const cash0 = bal(ctx, id, "cash");
  const r = act(ctx, id, { type: "gig_shift", trips: 3, seconds: 200 });
  assert.ok(r.ok, r.error);
  assert.ok(bal(ctx, id, "cash") > cash0);
  assert.equal(act(ctx, id, { type: "gig_shift", trips: 3, seconds: 200 }).code, "tomorrow");
  assert.ok(act(ctx, id, { type: "travel", to: "nima", mode: "taxi" }).ok);
  assert.ok(act(ctx, id, { type: "job_apply", jobId: "barber_apprentice" }).ok);
});

test("illness: malaria needs the clinic, flu is fine with the pharmacy; both show as a mood", () => {
  const { ctx, id } = rich();
  skipTo(ctx, id, 9);
  assert.ok(act(ctx, id, { type: "travel", to: "osu", mode: "taxi" }).ok);
  ctx.db.run("UPDATE players SET illness = 'malaria', ill_day = 0 WHERE id = ?", id);
  assert.ok(buildState(ctx, loadPlayer(ctx.db, id)).player.mood.moodlets.some((m) => m.id === "ill"));
  assert.ok(act(ctx, id, { type: "service", placeId: "sankofa_clinic", serviceId: "pharmacy" }).ok);
  assert.equal(loadPlayer(ctx.db, id).illness, "malaria");
  assert.ok(act(ctx, id, { type: "service", placeId: "sankofa_clinic", serviceId: "clinic" }).ok);
  assert.equal(loadPlayer(ctx.db, id).illness, "");
  ctx.db.run("UPDATE players SET illness = 'flu', ill_day = 0 WHERE id = ?", id);
  assert.ok(act(ctx, id, { type: "service", placeId: "sankofa_clinic", serviceId: "pharmacy" }).ok);
  assert.equal(loadPlayer(ctx.db, id).illness, "");
});

test("prepaid electricity: units tick down daily; empty means no TV until you top up", () => {
  const { ctx, id } = rich();
  ctx.db.run("INSERT INTO items (player_id, item_id, price, bought_min) VALUES (?, 'tv32', 100, 0)", id);
  ctx.db.run("UPDATE players SET power_units = 0.5 WHERE id = ?", id);
  assert.ok(act(ctx, id, { type: "sleep", hours: 8 }).ok);
  assert.ok(act(ctx, id, { type: "sleep", hours: 8 }).ok);
  assert.ok(act(ctx, id, { type: "sleep", hours: 8 }).ok);
  assert.equal(loadPlayer(ctx.db, id).power_units, 0);
  // Pick an hour with no dumsor so only the meter matters.
  for (let i = 0; i < 48 && powerOff("kaneshie", gameMin(ctx, id)); i++) skip(ctx, id, 1);
  const r = act(ctx, id, { type: "home_activity", activity: "watch_tv" });
  assert.equal(r.code, "no_units");
  assert.ok(buildState(ctx, loadPlayer(ctx.db, id)).player.mood.moodlets.some((m) => m.id === "no_units"));
  assert.ok(act(ctx, id, { type: "buy_power", amount: 5000 }).ok);
  assert.equal(loadPlayer(ctx.db, id).power_units, 25);
  assert.ok(act(ctx, id, { type: "home_activity", activity: "watch_tv" }).ok);
  assert.ok(auditPlayer(ctx.db, id).ok);
});

test("weekly life: Saturday funerals and weddings, market days, Sunday service", () => {
  const { ctx, id } = rich();
  // Next Saturday.
  while (toGameDate(gameMin(ctx, id)).weekdayIndex !== 6) skip(ctx, id, 12);
  skipTo(ctx, id, 11);
  const day = Math.floor(gameMin(ctx, id) / MINUTES_PER_DAY);
  const evs = townEvents("accra", day);
  assert.ok(evs.length >= 1);
  const ev = evs[0];
  if (district(ctx, id) !== ev.district) assert.ok(act(ctx, id, { type: "travel", to: ev.district, mode: "taxi" }).ok);
  skipTo(ctx, id, 12);
  assert.equal(act(ctx, id, { type: "event_attend", eventId: ev.id, gift: 100 }).code, "small_gift");
  const r = act(ctx, id, { type: "event_attend", eventId: ev.id, gift: ev.gift * 100 });
  assert.ok(r.ok, r.error);
  assert.equal(act(ctx, id, { type: "event_attend", eventId: ev.id, gift: ev.gift * 100 }).code, "already");
  // Sunday service gives fellowship.
  skip(ctx, id, 12);
  skipTo(ctx, id, 8);
  assert.equal(toGameDate(gameMin(ctx, id)).weekdayIndex, 0);
  if (district(ctx, id) !== "kaneshie") assert.ok(act(ctx, id, { type: "travel", to: "kaneshie", mode: "taxi" }).ok);
  const sv = act(ctx, id, { type: "service", placeId: "kaneshie_church", serviceId: "sunday_service" });
  assert.ok(sv.ok, sv.error);
  assert.ok(buildState(ctx, loadPlayer(ctx.db, id)).player.mood.moodlets.some((m) => m.id === "fellowship"));
  // Market days: two a week, never Sunday.
  const md = marketDays("kaneshie_market");
  assert.equal(md.length, 2);
  assert.ok(!md.includes(0));
  assert.ok(auditPlayer(ctx.db, id).ok);
});

test("aviation: buy a hangar, then a plane, then fly yourself between airports", () => {
  const env = makeCtx({ devTools: true });
  const id = newPlayer(env.ctx, "graduate", true);
  const { ctx } = env;
  assert.ok(act(ctx, id, { type: "dev_grant", amount: 500_000_000 * 100 }).ok);
  ctx.db.run("UPDATE players SET reputation = 70 WHERE id = ?", id);
  skipTo(ctx, id, 9);
  assert.ok(act(ctx, id, { type: "travel", to: "airport_city", mode: "taxi" }).ok);
  skipTo(ctx, id, 10);
  assert.equal(act(ctx, id, { type: "vehicle_buy", vehicleId: "bizjet", placeId: "aircraft_dealer" }).code, "no_hangar");
  assert.ok(act(ctx, id, { type: "plot_buy", plotId: "kotoka_hangar" }).ok);
  const r = act(ctx, id, { type: "vehicle_buy", vehicleId: "bizjet", placeId: "aircraft_dealer" });
  assert.ok(r.ok, r.error);
  const before = gameMin(ctx, id);
  const f = act(ctx, id, { type: "travel", to: "tamale", mode: "own_plane" });
  assert.ok(f.ok, f.error);
  assert.equal(district(ctx, id), "tamale");
  assert.ok(gameMin(ctx, id) - before < 120, "a jet gets there in well under two hours");
  assert.equal(act(ctx, id, { type: "travel", to: "kintampo", mode: "own_plane" }).code, "no_route");
  assert.ok(auditPlayer(ctx.db, id).ok);
});

test("every town has the basics: worship, work, lessons, people, Saturday events", () => {
  const cities = [...new Set(Object.values(DISTRICTS).map((d) => d.city))].filter((c) => c !== "accra");
  for (const city of cities) {
    const places = PLACES.filter((p) => DISTRICTS[p.district].city === city);
    const ids = new Set(places.map((p) => p.id));
    const has = (k: string) => places.some((p) => p.kind === k);
    assert.ok(has("church") && has("mosque"), `${city}: church and mosque`);
    const jobs = Object.values(JOBS).filter((j) => ids.has(j.placeId));
    for (const t of ["Market loader", "Trotro mate", "Nursing aide"]) assert.ok(jobs.some((j) => j.title === t), `${city}: ${t}`);
    for (const j of jobs) {
      const pl = PLACES.find((p) => p.id === j.placeId)!;
      if (pl.open[0] !== 0 || pl.open[1] !== 24) assert.ok(j.shiftWindow[0] >= pl.open[0] && j.shiftWindow[1] < pl.open[1], `${j.id} shift fits opening hours`);
    }
    assert.ok(COURSES.driving_b.places.some((x) => ids.has(x)) && COURSES.riding_a.places.some((x) => ids.has(x)), `${city}: licence lessons`);
    assert.ok(NPCS.filter((n) => n.schedule.some((b) => ids.has(b.place))).length >= 2, `${city}: named people`);
    let ev = 0;
    for (let d = 0; d < 14; d++) ev += townEvents(city, d).length;
    assert.ok(ev >= 1, `${city}: Saturday events`);
  }
});

test("a Saturday in Tamale: work as a loader, go to a Saturday event, named people in town", () => {
  const { ctx, id } = rich();
  ctx.db.run("UPDATE players SET reputation = 30 WHERE id = ?", id);
  skipTo(ctx, id, 9);
  assert.ok(act(ctx, id, { type: "travel", to: "tamale", mode: "bus" }).ok);
  while (toGameDate(gameMin(ctx, id)).weekdayIndex !== 6) skip(ctx, id, 12);
  skipTo(ctx, id, 8);
  const loader = Object.values(JOBS).find((j) => j.title === "Market loader" && DISTRICTS[PLACES.find((p) => p.id === j.placeId)!.district].city === "tamale")!;
  const ap = act(ctx, id, { type: "job_apply", jobId: loader.id });
  assert.ok(ap.ok, ap.error);
  const w = act(ctx, id, { type: "work" });
  assert.ok(w.ok, w.error);
  assert.equal(toGameDate(gameMin(ctx, id)).weekdayIndex, 6, "still Saturday after the shift");
  const day = Math.floor(gameMin(ctx, id) / MINUTES_PER_DAY);
  const ev = townEvents("tamale", day)[0];
  assert.ok(ev, "an event in Tamale");
  assert.equal(PLACES.find((p) => p.id === ev.placeId)!.kind === "church", false, "Tamale events are at the mosque, a school or a landmark");
  assert.equal(ev.dress, "north");
  const r = act(ctx, id, { type: "event_attend", eventId: ev.id, gift: ev.gift * 100 });
  assert.ok(r.ok, r.error);
  assert.ok(NPCS.some((n) => n.district === "tamale"));
  assert.ok(auditPlayer(ctx.db, id).ok);
});

test("languages and priorities: chosen at the start, change in settings, and they matter", () => {
  const env = makeCtx({ devTools: true });
  const { ctx } = env;
  const id = createPlayer(ctx, { name: "Kojo Test", look: {}, background: "graduate", hometown: "ho", priorities: ["faith", "nonsense", "family", "fun"], isTest: true });
  let st = buildState(ctx, loadPlayer(ctx.db, id));
  assert.deepEqual(st.player.languages, ["ewe"], "defaults to the hometown's language");
  assert.deepEqual(st.player.priorities, ["faith", "family"], "unknown ones dropped, max two");
  grant(ctx, id, 100_000);
  // Faith matters: Sunday service feels like more.
  while (toGameDate(gameMin(ctx, id)).weekdayIndex !== 0) skip(ctx, id, 12);
  skipTo(ctx, id, 8);
  assert.ok(act(ctx, id, { type: "service", placeId: "kaneshie_church", serviceId: "sunday_service" }).ok);
  st = buildState(ctx, loadPlayer(ctx.db, id));
  assert.equal(st.player.mood.moodlets.find((m) => m.id === "fellowship")?.value, 2);
  // Settings: speak Dagbani, go to Tamale, talk to a townsperson in their language.
  assert.ok(act(ctx, id, { type: "settings", languages: ["dagbani", "klingon"], priorities: ["money"] }).ok);
  st = buildState(ctx, loadPlayer(ctx.db, id));
  assert.deepEqual(st.player.languages, ["dagbani"]);
  assert.deepEqual(st.player.priorities, ["money"]);
  assert.ok(act(ctx, id, { type: "travel", to: "tamale", mode: "bus" }).ok);
  skip(ctx, id, 24);
  skipTo(ctx, id, 10);
  const trader = NPCS.find((n) => n.id === "tf_tamale_trader") ?? NPCS.find((n) => n.district === "tamale" && n.schedule.some((b) => b.from <= 10 && b.to > 10 && b.days !== "sunday"))!;
  const r = act(ctx, id, { type: "talk", npcId: trader.id, topic: "chat" });
  assert.ok(r.ok, r.error);
  assert.match((r.data as { reply: string }).reply, /Dagbani/);
  assert.ok(auditPlayer(ctx.db, id).ok);
});

test("deeper systems: business staff, vehicle service and insurance, story arcs tracked by the server", () => {
  const { ctx, id } = rich();
  skipTo(ctx, id, 10);
  // Business with staff.
  assert.ok(act(ctx, id, { type: "biz_buy", bizType: "phone_kiosk" }).ok);
  let st = buildState(ctx, loadPlayer(ctx.db, id));
  const biz = st.businesses[0];
  const hire = act(ctx, id, { type: "biz_staff", businessId: biz.id, role: "attendant", change: "hire" });
  assert.ok(hire.ok, hire.error);
  assert.ok(hire.feedback.some((f) => f.text.includes("Hire someone")), "story step ticks off");
  assert.equal(act(ctx, id, { type: "biz_staff", businessId: biz.id, role: "attendant", change: "hire" }).code, "full");
  assert.ok(act(ctx, id, { type: "biz_staff", businessId: biz.id, role: "manager", change: "hire" }).ok);
  st = buildState(ctx, loadPlayer(ctx.db, id));
  assert.equal(st.businesses[0].attendants, 1);
  assert.equal(st.businesses[0].manager, true);
  const hustle = st.player.missions.find((m) => m.id === "hustle")!;
  assert.ok(hustle.steps.find((s) => s.id === "own_business")!.done && hustle.steps.find((s) => s.id === "hired")!.done);
  const till0 = st.businesses[0].till;
  assert.ok(act(ctx, id, { type: "biz_staff", businessId: biz.id, role: "attendant", change: "fire" }).ok);
  assert.equal(buildState(ctx, loadPlayer(ctx.db, id)).businesses[0].till, till0 - st.businesses[0].attendantWage * 3 * 100, "three days' pay from the till");
  // Vehicle: worn out, serviced at the station fitters; insurance checked at the barrier.
  assert.ok(act(ctx, id, { type: "vehicle_buy", vehicleId: "taxi", placeId: "tokunbo_lot" }).ok);
  const v = buildState(ctx, loadPlayer(ctx.db, id)).vehicles[0];
  assert.ok(v.insuredUntil > 300, "dealer includes the first year");
  ctx.db.run("UPDATE vehicles SET condition = 30, insured_until = -1 WHERE id = ?", v.id);
  ctx.db.run("UPDATE players SET unlocks = json_insert(unlocks, '$[#]', 'licence_b') WHERE id = ?", id);
  const pc = act(ctx, id, { type: "police_check", vehicleType: "taxi" });
  assert.ok(pc.ok, pc.error);
  assert.equal((pc.data as { fined: boolean }).fined, true);
  const rp = act(ctx, id, { type: "vehicle_repair", vehicleId: v.id });
  assert.ok(rp.ok, rp.error);
  assert.equal(act(ctx, id, { type: "vehicle_repair", vehicleId: v.id }).code, "fine");
  assert.ok(act(ctx, id, { type: "vehicle_insure", vehicleId: v.id }).ok);
  skip(ctx, id, 3);
  assert.equal((act(ctx, id, { type: "police_check", vehicleType: "taxi" }).data as { fined: boolean }).fined, false);
  st = buildState(ctx, loadPlayer(ctx.db, id));
  assert.equal(st.vehicles[0].condition, 100);
  const wheels = st.player.missions.find((m) => m.id === "wheels")!;
  assert.ok(wheels.steps.find((s) => s.id === "serviced")!.done && wheels.steps.find((s) => s.id === "own_vehicle")!.done);
  assert.ok(auditPlayer(ctx.db, id).ok);
});

test("story arc pays out once when every step is done", () => {
  const { ctx, id } = rich();
  skipTo(ctx, id, 7);
  const before = bal(ctx, id, "bank");
  assert.ok(act(ctx, id, { type: "job_apply", jobId: "market_loader" }).ok);
  for (let i = 0; i < 3; i++) {
    const w = act(ctx, id, { type: "work" });
    assert.ok(w.ok, w.error);
    skip(ctx, id, 24 - 6);
  }
  assert.ok(act(ctx, id, { type: "deposit", amount: 5_000 }).ok || act(ctx, id, { type: "momo_move", from: "cash", to: "momo", amount: 5_000 }).ok);
  skipTo(ctx, id, 10);
  const here = NPCS.filter((n) => n.district === "kaneshie").map((n) => n.id);
  let talked = 0;
  for (let h = 0; h < 24 && talked < 3; h++) {
    for (const n of here) if (act(ctx, id, { type: "talk", npcId: n, topic: "chat" }).ok) talked++;
    if (talked < 3) skip(ctx, id, 1);
  }
  const st = buildState(ctx, loadPlayer(ctx.db, id));
  const arc = st.player.missions.find((m) => m.id === "new_in_town")!;
  assert.ok(arc.complete, JSON.stringify(arc.steps));
  assert.ok(bal(ctx, id, "bank") >= before + 300 * 100 - 0, "reward paid to the bank");
  assert.ok(auditPlayer(ctx.db, id).ok);
});
