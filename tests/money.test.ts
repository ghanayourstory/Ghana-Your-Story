import test from "node:test";
import assert from "node:assert/strict";
import { act, bal, grant, key, makeCtx, newPlayer, travel } from "./helpers.ts";
import { auditPlayer } from "../server/ledger.ts";

test("new players start with modest, ledgered balances", () => {
  const { ctx } = makeCtx();
  const id = newPlayer(ctx, "graduate");
  assert.equal(bal(ctx, id, "cash"), 60_000);
  assert.equal(bal(ctx, id, "bank"), 250_000);
  assert.ok(auditPlayer(ctx.db, id).ok);
});

test("deposit at a mobile-money agent charges a fee; at the bank it's free", () => {
  const { ctx } = makeCtx({ devTools: true });
  const id = newPlayer(ctx, "hustler", true); // GH₵1,500 cash
  const r = act(ctx, id, { type: "deposit", amount: 50_000 });
  assert.ok(r.ok, r.error);
  assert.equal(bal(ctx, id, "cash"), 150_000 - 50_000 - 250); // 0.5% fee
  assert.equal(bal(ctx, id, "bank"), 40_000 + 50_000);
  travel(ctx, id, "osu");
  act(ctx, id, { type: "dev_skip", hours: 2 }); // the bank opens at 8
  const cashBefore = bal(ctx, id, "cash");
  const r2 = act(ctx, id, { type: "deposit", amount: 10_000, placeId: "osu_bank" });
  assert.ok(r2.ok, r2.error);
  assert.equal(bal(ctx, id, "cash"), cashBefore - 10_000);
  assert.ok(auditPlayer(ctx.db, id).ok);
});

test("a transfer that would overdraw is rejected and changes nothing", () => {
  const { ctx } = makeCtx();
  const id = newPlayer(ctx);
  const before = { cash: bal(ctx, id, "cash"), bank: bal(ctx, id, "bank") };
  const r = act(ctx, id, { type: "withdraw", amount: 999_999_999 });
  assert.equal(r.ok, false);
  assert.equal(r.code, "insufficient_funds");
  assert.deepEqual({ cash: bal(ctx, id, "cash"), bank: bal(ctx, id, "bank") }, before);
  assert.ok(auditPlayer(ctx.db, id).ok);
});

test("rejects fractional, negative and huge amounts", () => {
  const { ctx } = makeCtx();
  const id = newPlayer(ctx);
  for (const amount of [-100, 0, 12.5, "100", 1e20, NaN]) {
    const r = act(ctx, id, { type: "deposit", amount });
    assert.equal(r.ok, false, `amount ${amount} should be rejected`);
  }
});

test("idempotency: retrying the same request does not move money twice", () => {
  const { ctx } = makeCtx();
  const id = newPlayer(ctx);
  const k = key();
  const a = act(ctx, id, { type: "deposit", amount: 10_000 }, k);
  const b = act(ctx, id, { type: "deposit", amount: 10_000 }, k);
  assert.ok(a.ok && b.ok);
  assert.equal(b.replay, true);
  assert.equal(bal(ctx, id, "bank"), 250_000 + 10_000);
  assert.equal(ctx.db.get<{ n: number }>("SELECT COUNT(*) AS n FROM transactions WHERE player_id = ? AND kind = 'deposit'", id)!.n, 1);
});

test("FX buy and sell use server rates with a spread and stay balanced", () => {
  const { ctx } = makeCtx();
  const id = newPlayer(ctx);
  const bank0 = bal(ctx, id, "bank");
  assert.ok(act(ctx, id, { type: "fx_buy", usd: 5_000 }).ok); // $50
  assert.equal(bal(ctx, id, "usd"), 5_000);
  assert.ok(act(ctx, id, { type: "fx_sell", usd: 5_000 }).ok);
  assert.equal(bal(ctx, id, "usd"), 0);
  assert.ok(bal(ctx, id, "bank") < bank0, "round-trip should cost the spread");
  assert.ok(auditPlayer(ctx.db, id).ok);
});

test("T-bill matures at the right minute and pays principal plus interest once", () => {
  const { ctx } = makeCtx({ devTools: true });
  const id = newPlayer(ctx, "graduate", true);
  const r = act(ctx, id, { type: "tbill_buy", product: "t7", amount: 100_000 });
  assert.ok(r.ok, r.error);
  const bill = ctx.db.get<{ payout: number; matures_min: number }>("SELECT * FROM tbills WHERE player_id = ?", id)!;
  assert.equal(bill.payout, 100_000 + Math.floor((100_000 * 0.18 * 7) / 365));
  assert.equal(bal(ctx, id, "tbill"), 100_000);
  const bankBefore = bal(ctx, id, "bank");
  act(ctx, id, { type: "dev_skip", hours: 24 * 6 });
  assert.equal(bal(ctx, id, "tbill"), 100_000, "not matured after 6 days");
  act(ctx, id, { type: "dev_skip", hours: 24 });
  assert.equal(bal(ctx, id, "tbill"), 0);
  const gained = bal(ctx, id, "bank") - bankBefore;
  assert.ok(gained >= bill.payout, "payout (plus daily savings interest) landed");
  assert.equal(ctx.db.get<{ n: number }>("SELECT COUNT(*) AS n FROM transactions WHERE player_id = ? AND kind = 'tbill_maturity'", id)!.n, 1);
  assert.ok(auditPlayer(ctx.db, id).ok);
});

test("loans: limit enforced, interest accrues, repayment clears", () => {
  const { ctx } = makeCtx({ devTools: true });
  const id = newPlayer(ctx, "graduate", true);
  const tooMuch = act(ctx, id, { type: "loan_take", amount: 100_000_000 });
  assert.equal(tooMuch.ok, false);
  assert.ok(act(ctx, id, { type: "loan_take", amount: 100_000 }).ok);
  assert.equal(bal(ctx, id, "loan"), 100_000);
  act(ctx, id, { type: "dev_skip", hours: 48 });
  assert.ok(bal(ctx, id, "loan") > 100_000, "interest accrued");
  grant(ctx, id, 5_000);
  assert.ok(act(ctx, id, { type: "loan_repay", amount: 10_000_000 }).ok);
  assert.equal(bal(ctx, id, "loan"), 0);
  assert.ok(auditPlayer(ctx.db, id).ok);
});

test("dev grants are refused unless dev tools are on AND it's a test account", () => {
  const off = makeCtx({ devTools: false });
  const a = newPlayer(off.ctx, "graduate", true);
  assert.equal(act(off.ctx, a, { type: "dev_grant", amount: 100 }).code, "forbidden");
  const on = makeCtx({ devTools: true });
  const b = newPlayer(on.ctx, "graduate", false);
  assert.equal(act(on.ctx, b, { type: "dev_grant", amount: 100 }).code, "forbidden");
});
