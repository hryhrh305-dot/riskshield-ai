import { getBillingCatalogEntry, type BillingCatalogGeneration, type BillingInterval } from "@/lib/billing-catalog";

type ReferralRewardPlan = "starter" | "growth" | "scale";

type ServiceSupabaseClient = {
  from: (table: string) => any;
  rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: { message?: string } | null }>;
};

const AUTOMATIC_REFERRAL_PLANS = new Set<ReferralRewardPlan>(["starter", "growth", "scale"]);

export function getReferralRewardCredits(
  plan: string,
  generation: BillingCatalogGeneration = "legacy",
  interval: BillingInterval = "monthly",
): number | null {
  if (!AUTOMATIC_REFERRAL_PLANS.has(plan as ReferralRewardPlan)) return null;
  return getBillingCatalogEntry(generation, plan, interval).referralRewardCredits;
}

export async function markReferralFirstPayment(params: {
  supabase: ServiceSupabaseClient;
  referredUserId: string;
  plan: string;
  paymentId: string;
  paidAt?: string;
  generation?: BillingCatalogGeneration;
  billingInterval?: BillingInterval;
}) {
  const paidAt = new Date(params.paidAt || Date.now());
  const rewardCredits = getReferralRewardCredits(params.plan, params.generation, params.billingInterval);
  const eligibilityReviewAt = new Date(paidAt.getTime() + 30 * 24 * 60 * 60 * 1000);
  const isAutomaticPlan = rewardCredits !== null && rewardCredits > 0;

  const { error } = await params.supabase
    .from("referral_attributions")
    .update({
      status: "first_paid",
      reward_status: isAutomaticPlan ? "pending_review" : "manual_review",
      first_paid_at: paidAt.toISOString(),
      eligibility_review_at: eligibilityReviewAt.toISOString(),
      reward_plan: params.plan,
      reward_credits: rewardCredits,
      reward_payment_id: params.paymentId,
      reward_notes: isAutomaticPlan ? "First paid subscription recorded." : "Custom plan requires manual reward review.",
      updated_at: new Date().toISOString(),
    })
    .eq("referred_user_id", params.referredUserId)
    .is("first_paid_at", null);

  if (error) throw new Error(error.message || "Failed to record referral payment.");
}

export async function issueDueReferralRewards(params: {
  supabase: ServiceSupabaseClient;
  referrerUserId: string;
}) {
  const { data: dueRewards, error } = await params.supabase
    .from("referral_attributions")
    .select("id")
    .eq("referrer_user_id", params.referrerUserId)
    .eq("reward_status", "pending_review")
    .lte("eligibility_review_at", new Date().toISOString());

  if (error) throw new Error(error.message || "Failed to load due referral rewards.");

  let issuedCredits = 0;
  for (const reward of dueRewards || []) {
    const { data, error: issueError } = await params.supabase.rpc("issue_due_referral_reward", {
      p_attribution_id: reward.id,
      p_referrer_user_id: params.referrerUserId,
    });
    if (issueError) throw new Error(issueError.message || "Failed to issue referral reward.");
    issuedCredits += Number(data || 0);
  }
  return issuedCredits;
}
