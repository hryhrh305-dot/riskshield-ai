import { NextResponse } from "next/server";
import {
  getBillingCatalogEntry,
  getCheckoutAvailability,
  getPublicCatalogGeneration,
  getSecwynPricingFlags,
  type BillingPlan,
} from "@/lib/billing-catalog";

export const dynamic = "force-dynamic";

export async function GET() {
  const generation = getPublicCatalogGeneration(process.env);
  const flags = getSecwynPricingFlags(process.env);
  const plans = Object.fromEntries((["starter", "growth", "scale"] as BillingPlan[]).map((plan) => {
    const monthly = getBillingCatalogEntry(generation, plan, "monthly");
    const annual = getBillingCatalogEntry(generation, plan, "yearly");
    const monthlyAvailability = getCheckoutAvailability(plan, "monthly", process.env);
    const annualAvailability = getCheckoutAvailability(plan, "yearly", process.env);
    return [plan, {
      monthlyPrice: monthly.priceUsd,
      annualPrice: annual.priceUsd,
      monthlyCredits: monthly.monthlyCredits,
      monthlyCheckout: monthlyAvailability.kind,
      annualCheckout: annualAvailability.kind,
    }];
  }));

  return NextResponse.json({
    generation,
    annualSelfServe: generation === "premium_v2" && flags.annualSelfServe,
    plans,
  }, { headers: { "Cache-Control": "private, no-store" } });
}
