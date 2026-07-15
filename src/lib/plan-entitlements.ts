import { hasActiveSubscriptionAccess } from "@/lib/creem";
import { isPlanAtLeast, type PlanKey } from "@/lib/plans";

export type EntitlementProfile = {
  plan: PlanKey | string | null | undefined;
  subscriptionStatus?: string | null;
  subscriptionEnd?: string | null;
  hasTopUpCredits?: boolean;
  authenticated?: boolean;
};

export type PlanEntitlements = {
  effectivePlan: PlanKey;
  singleWebCheck: boolean;
  bulkWebAudit: boolean;
  basicReport: boolean;
  basicExport: boolean;
  clientReadyReport: boolean;
  campaignReadiness: boolean;
  listAcceptance: boolean;
  advancedReport: boolean;
  apiAccess: boolean;
  googleSheets: boolean;
  customCapabilities: boolean;
};

function toPlanKey(plan: EntitlementProfile["plan"]): PlanKey {
  const normalized = String(plan || "free").toLowerCase();
  return (["free", "starter", "growth", "scale", "business"] as const).includes(normalized as PlanKey)
    ? normalized as PlanKey
    : "free";
}

export function resolveEffectivePlan(profile: EntitlementProfile): PlanKey {
  const plan = toPlanKey(profile.plan);
  if (plan === "free") return "free";
  return hasActiveSubscriptionAccess(profile.subscriptionStatus, profile.subscriptionEnd) ? plan : "free";
}

export function getPlanEntitlements(profile: EntitlementProfile): PlanEntitlements {
  const effectivePlan = resolveEffectivePlan(profile);
  const authenticated = profile.authenticated !== false;
  const starterPlus = authenticated && isPlanAtLeast(effectivePlan, "starter");
  const growthPlus = authenticated && isPlanAtLeast(effectivePlan, "growth");
  const scalePlus = authenticated && isPlanAtLeast(effectivePlan, "scale");

  return {
    effectivePlan,
    singleWebCheck: authenticated,
    bulkWebAudit: starterPlus,
    basicReport: starterPlus,
    basicExport: starterPlus,
    clientReadyReport: growthPlus,
    campaignReadiness: growthPlus,
    listAcceptance: growthPlus,
    advancedReport: scalePlus,
    apiAccess: growthPlus,
    googleSheets: growthPlus,
    customCapabilities: authenticated && effectivePlan === "business",
  };
}
