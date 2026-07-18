import {
  getBillingCatalogEntry,
  getCheckoutAvailability,
  type BillingPlan,
} from "@/lib/billing-catalog";
import type { AdminV2CanaryDecision } from "@/lib/admin-v2-canary";
import { isTestCanaryCheckoutConfigured } from "@/lib/test-canary-billing";

type CheckoutKind = "checkout" | "contact" | "unavailable";

export type PublicPricingCatalogResponse = {
  generation: AdminV2CanaryDecision["generation"];
  purchaseMode: "live" | "canary_locked" | "test_canary";
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
  const testCanaryCheckout = decision.enabled && isTestCanaryCheckoutConfigured(env);
  const legacyEnv = {
    ...env,
    SECWYN_PREMIUM_PRICING_V2_ENABLED: "false",
  };
  const checkoutEnv = generation === "premium_v2" ? env : legacyEnv;

  const plans = Object.fromEntries((['starter', 'growth', 'scale'] as BillingPlan[]).map((plan) => {
    const monthly = getBillingCatalogEntry(generation, plan, "monthly");
    const annual = getBillingCatalogEntry(generation, plan, "yearly");

    let monthlyCheckout: CheckoutKind;
    let annualCheckout: CheckoutKind;
    if (decision.checkoutLocked) {
      monthlyCheckout = testCanaryCheckout ? "checkout" : "unavailable";
      annualCheckout = plan === "scale" ? "contact" : testCanaryCheckout ? "checkout" : "unavailable";
    } else {
      monthlyCheckout = getCheckoutAvailability(plan, "monthly", checkoutEnv).kind;
      annualCheckout = getCheckoutAvailability(plan, "yearly", checkoutEnv).kind;
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
    purchaseMode: testCanaryCheckout ? "test_canary" : decision.checkoutLocked ? "canary_locked" : "live",
    annualSelfServe:
      generation === "premium_v2"
      && !decision.checkoutLocked
      && env.SECWYN_V2_ANNUAL_SELF_SERVE_ENABLED === "true",
    plans,
  };
}
