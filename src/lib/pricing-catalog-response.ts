import {
  getBillingCatalogEntry,
  getCheckoutAvailability,
  type BillingPlan,
} from "@/lib/billing-catalog";
import type { AdminV2CanaryDecision } from "@/lib/admin-v2-canary";

type CheckoutKind = "checkout" | "contact" | "unavailable";

export type PublicPricingCatalogResponse = {
  generation: AdminV2CanaryDecision["generation"];
  purchaseMode: "live" | "canary_locked";
  annualSelfServe: boolean;
  plans: Record<BillingPlan, {
    monthlyPrice: number;
    annualPrice: number;
    monthlyCredits: number;
    monthlyCheckout: CheckoutKind;
    annualCheckout: CheckoutKind;
  }>;
};

export function buildPricingCatalogResponse(
  decision: AdminV2CanaryDecision,
  env: NodeJS.ProcessEnv = process.env,
): PublicPricingCatalogResponse {
  const generation = decision.generation;
  const legacyEnv = {
    ...env,
    SECWYN_PREMIUM_PRICING_V2_ENABLED: "false",
  };

  const plans = Object.fromEntries((['starter', 'growth', 'scale'] as BillingPlan[]).map((plan) => {
    const monthly = getBillingCatalogEntry(generation, plan, "monthly");
    const annual = getBillingCatalogEntry(generation, plan, "yearly");

    let monthlyCheckout: CheckoutKind;
    let annualCheckout: CheckoutKind;
    if (decision.checkoutLocked) {
      monthlyCheckout = "unavailable";
      annualCheckout = plan === "scale" ? "contact" : "unavailable";
    } else {
      monthlyCheckout = getCheckoutAvailability(plan, "monthly", legacyEnv).kind;
      annualCheckout = getCheckoutAvailability(plan, "yearly", legacyEnv).kind;
    }

    return [plan, {
      monthlyPrice: monthly.priceUsd,
      annualPrice: annual.priceUsd,
      monthlyCredits: monthly.monthlyCredits,
      monthlyCheckout,
      annualCheckout,
    }];
  })) as PublicPricingCatalogResponse["plans"];

  return {
    generation,
    purchaseMode: decision.checkoutLocked ? "canary_locked" : "live",
    annualSelfServe: false,
    plans,
  };
}
