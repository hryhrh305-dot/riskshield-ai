import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { getCreditsForPlan } from "@/lib/creem";

describe("subscription cycle grants", () => {
  it("uses the canonical monthly plan amounts", () => {
    expect([getCreditsForPlan("free"),getCreditsForPlan("starter"),getCreditsForPlan("growth"),getCreditsForPlan("scale")])
      .toEqual([50,500,2500,15000]);
  });
  it("removes direct balance overwrites from payment routes", () => {
    const webhook=readFileSync("src/app/api/payment/webhook/route.ts","utf8");
    const confirm=readFileSync("src/app/api/payment/confirm-redirect/route.ts","utf8");
    expect(webhook).not.toContain("credits_remaining: shouldUpgrade");
    expect(webhook).not.toContain("credits_remaining: freeCredits");
    expect(webhook).toContain("grantSubscriptionCycle");
    expect(webhook).toContain("cancelAtPeriodEnd: true");
    expect(webhook).toContain("BILLING_REVERSAL_SUBSCRIPTION_REQUIRED");
    expect(webhook).not.toContain("payload: event");
    expect(confirm).not.toContain("credits_remaining:");
    expect(confirm).not.toContain("markReferralFirstPayment");
  });
  it("persists immutable anchors and ledger-aware revocation", () => {
    const sql=readFileSync("supabase/migrations/202607130006_subscription_billing_cycles.sql","utf8").toLowerCase();
    expect(sql).toContain("credit_anchor_at");
    expect(sql).toContain("billing_interval");
    expect(sql).toContain("create or replace function public.revoke_subscription_credits");
    expect(sql).toContain("source_type='subscription'");
    expect(sql).toContain("public.sync_credit_mirror");
    expect(sql).toContain("stale_subscription_paid_event");
    expect(sql).toContain("billing_terminal_at");
    expect(sql).toContain("current_subscription_ref");
    expect(sql).toContain("current_subscription_ref=p_subscription_ref");
  });
});
