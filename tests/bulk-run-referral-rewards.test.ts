import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { getReferralRewardCredits } from "@/lib/referral-rewards";

const rewardHelperPath = "src/lib/referral-rewards.ts";
const rewardHelper = existsSync(rewardHelperPath) ? readFileSync(rewardHelperPath, "utf8") : "";
const webhook = readFileSync("src/app/api/payment/webhook/route.ts", "utf8");
const confirmRedirect = readFileSync("src/app/api/payment/confirm-redirect/route.ts", "utf8");
const referralSummary = readFileSync("src/app/api/referrals/me/route.ts", "utf8");
const migrationPath = "supabase/migrations/202607130004_referral_reward_delivery.sql";
const migration = existsSync(migrationPath) ? readFileSync(migrationPath, "utf8") : "";

describe("referral reward delivery contract", () => {
  it("calculates ten percent from the canonical included credits", () => {
    expect(getReferralRewardCredits("starter")).toBe(50);
    expect(getReferralRewardCredits("growth")).toBe(250);
    expect(getReferralRewardCredits("scale")).toBe(1500);
    expect(getReferralRewardCredits("business")).toBeNull();
  });

  it("snapshots only the first successful payment path", () => {
    expect(webhook).toContain("markReferralFirstPayment");
    expect(confirmRedirect).toContain("markReferralFirstPayment");
    expect(rewardHelper).toContain('.is("first_paid_at", null)');
    expect(rewardHelper).toContain('"pending_review"');
    expect(rewardHelper).toContain('"manual_review"');
  });

  it("releases due rewards through a service-only atomic function", () => {
    expect(referralSummary).toContain("issueDueReferralRewards");
    expect(migration).toContain("create or replace function public.issue_due_referral_reward");
    expect(migration).toContain("credits_remaining = credits_remaining + v_reward");
    expect(migration).toContain("revoke all on function public.issue_due_referral_reward");
    expect(migration).toContain("grant execute on function public.issue_due_referral_reward");
    expect(migration).toContain("reward_status = 'disqualified'");
  });
});
