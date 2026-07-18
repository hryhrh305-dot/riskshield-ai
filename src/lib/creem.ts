import crypto from "crypto";
import { plans, type PlanKey } from "./plans.ts";
import {
  findBillingCatalogEntryByProductId,
  getBillingCatalogEntry,
  getPublicCatalogGeneration,
  type BillingCatalogGeneration,
} from "./billing-catalog.ts";

type CreemPlanKey = Extract<PlanKey, "starter" | "growth" | "scale">;
export type CreemBillingInterval = "monthly" | "yearly";
export type InternalSubscriptionStatus =
  | "inactive"
  | "active"
  | "cancelled"
  | "expired"
  | "past_due"
  | "paused";

export const CREEM_SELF_SERVE_PLANS = ["starter", "growth", "scale"] as const satisfies readonly CreemPlanKey[];
export const CREEM_BILLING_INTERVALS = ["monthly", "yearly"] as const satisfies readonly CreemBillingInterval[];

type ProductEnvMap = Record<CreemPlanKey, string | undefined>;
type ProductEnvMapByInterval = Record<CreemBillingInterval, ProductEnvMap>;

type AnnualPlanOffer = {
  yearlyPrice: number;
  yearlyPriceLabel: string;
  monthlyEquivalent: number;
  monthlyEquivalentLabel: string;
  savingsAmount: number;
  savingsAmountLabel: string;
  discountPercent: number;
  discountPercentLabel: string;
  promoLabel: string | null;
};

function isExplicitProduction(env: NodeJS.ProcessEnv): boolean {
  const mode = (env.CREEM_ENV || "").toLowerCase();
  return mode === "production" || mode === "live";
}

export function isCreemSelfServePlan(plan: string): plan is CreemPlanKey {
  return CREEM_SELF_SERVE_PLANS.includes(plan as CreemPlanKey);
}

export function normalizeCreemBillingInterval(interval: string | null | undefined): CreemBillingInterval {
  return interval === "yearly" ? "yearly" : "monthly";
}

export function getCreemProductEnvMap(
  env: NodeJS.ProcessEnv = process.env,
  billingInterval: CreemBillingInterval = "monthly",
): ProductEnvMap {
  const strictProduction = isExplicitProduction(env);

  if (strictProduction && billingInterval === "monthly") {
    return {
      starter: env.CREEM_STARTER_PRODUCT_ID,
      growth: env.CREEM_GROWTH_PRODUCT_ID,
      scale: env.CREEM_SCALE_PRODUCT_ID,
    };
  }

  if (strictProduction && billingInterval === "yearly") {
    return {
      starter: env.CREEM_STARTER_YEARLY_PRODUCT_ID,
      growth: env.CREEM_GROWTH_YEARLY_PRODUCT_ID,
      scale: env.CREEM_SCALE_YEARLY_PRODUCT_ID,
    };
  }

  if (billingInterval === "yearly") {
    return {
      starter: env.CREEM_STARTER_YEARLY_PRODUCT_ID,
      growth: env.CREEM_GROWTH_YEARLY_PRODUCT_ID,
      scale: env.CREEM_SCALE_YEARLY_PRODUCT_ID,
    };
  }

  return {
    starter:
      env.CREEM_STARTER_PRODUCT_ID ||
      env.CREEM_PRODUCT_STARTER_MONTHLY ||
      env.CREEM_PRODUCT_ID_STARTER ||
      env.CREEM_PRODUCT_ID,
    growth:
      env.CREEM_GROWTH_PRODUCT_ID ||
      env.CREEM_PRODUCT_GROWTH_MONTHLY ||
      env.CREEM_PRODUCT_ID_GROWTH,
    scale:
      env.CREEM_SCALE_PRODUCT_ID ||
      env.CREEM_PRODUCT_SCALE_MONTHLY ||
      env.CREEM_PRODUCT_ID_SCALE,
  };
}

export function getCreemProductEnvMaps(env: NodeJS.ProcessEnv = process.env): ProductEnvMapByInterval {
  return {
    monthly: getCreemProductEnvMap(env, "monthly"),
    yearly: getCreemProductEnvMap(env, "yearly"),
  };
}

export function getCreemEnvDebugInfo(env: NodeJS.ProcessEnv = process.env) {
  const explicitProduction = isExplicitProduction(env);
  const hasProductionStarterProduct = Boolean(env.CREEM_STARTER_PRODUCT_ID);
  const hasProductionGrowthProduct = Boolean(env.CREEM_GROWTH_PRODUCT_ID);
  const hasProductionScaleProduct = Boolean(env.CREEM_SCALE_PRODUCT_ID);
  const hasProductionStarterYearlyProduct = Boolean(env.CREEM_STARTER_YEARLY_PRODUCT_ID);
  const hasProductionGrowthYearlyProduct = Boolean(env.CREEM_GROWTH_YEARLY_PRODUCT_ID);
  const hasProductionScaleYearlyProduct = Boolean(env.CREEM_SCALE_YEARLY_PRODUCT_ID);
  const hasStarterProduct = explicitProduction
    ? Boolean(env.CREEM_STARTER_PRODUCT_ID)
    : Boolean(
        env.CREEM_STARTER_PRODUCT_ID ||
          env.CREEM_PRODUCT_STARTER_MONTHLY ||
          env.CREEM_PRODUCT_ID_STARTER ||
          env.CREEM_PRODUCT_ID,
      );
  const hasGrowthProduct = explicitProduction
    ? Boolean(env.CREEM_GROWTH_PRODUCT_ID)
    : Boolean(
        env.CREEM_GROWTH_PRODUCT_ID ||
          env.CREEM_PRODUCT_GROWTH_MONTHLY ||
          env.CREEM_PRODUCT_ID_GROWTH,
      );
  const hasScaleProduct = explicitProduction
    ? Boolean(env.CREEM_SCALE_PRODUCT_ID)
    : Boolean(
        env.CREEM_SCALE_PRODUCT_ID ||
          env.CREEM_PRODUCT_SCALE_MONTHLY ||
          env.CREEM_PRODUCT_ID_SCALE,
      );
  const usesLiveApiHost = getCreemApiBaseUrl(env.CREEM_API_KEY, env) === "https://api.creem.io/v1";

  return {
    hasCreemApiKey: Boolean(env.CREEM_API_KEY),
    hasWebhookSecret: Boolean(env.CREEM_WEBHOOK_SECRET),
    hasProductionStarterProduct,
    hasProductionGrowthProduct,
    hasProductionScaleProduct,
    hasProductionStarterYearlyProduct,
    hasProductionGrowthYearlyProduct,
    hasProductionScaleYearlyProduct,
    hasStarterProduct,
    hasGrowthProduct,
    hasScaleProduct,
    hasStarterYearlyProduct: Boolean(env.CREEM_STARTER_YEARLY_PRODUCT_ID),
    hasGrowthYearlyProduct: Boolean(env.CREEM_GROWTH_YEARLY_PRODUCT_ID),
    hasScaleYearlyProduct: Boolean(env.CREEM_SCALE_YEARLY_PRODUCT_ID),
    hasLegacyStarterProduct: Boolean(env.CREEM_PRODUCT_ID),
    hasLegacyGrowthProduct: Boolean(env.CREEM_PRODUCT_ID_GROWTH),
    hasLegacyScaleProduct: Boolean(env.CREEM_PRODUCT_ID_SCALE),
    isExplicitProduction: explicitProduction,
    usesLiveApiHost,
    isProductionConfigComplete:
      explicitProduction &&
      Boolean(
        env.CREEM_API_KEY &&
          env.CREEM_WEBHOOK_SECRET &&
          hasProductionStarterProduct &&
          hasProductionGrowthProduct &&
          hasProductionScaleProduct &&
          hasProductionStarterYearlyProduct &&
          hasProductionGrowthYearlyProduct &&
          hasProductionScaleYearlyProduct,
      ),
    vercelEnv: env.VERCEL_ENV || null,
    nodeEnv: env.NODE_ENV || null,
  };
}

export function getCreemProductIdForPlan(
  plan: string,
  env: NodeJS.ProcessEnv = process.env,
  billingInterval: CreemBillingInterval = "monthly",
): string | null {
  if (!isCreemSelfServePlan(plan)) return null;
  return getCreemProductEnvMap(env, billingInterval)[plan] || null;
}

export function findCreemProductById(
  productId: string | null | undefined,
  env: NodeJS.ProcessEnv = process.env,
): { plan: CreemPlanKey; billingInterval: CreemBillingInterval } | null {
  const match = findBillingCatalogEntryByProductId(productId, env);
  return match ? { plan: match.plan, billingInterval: match.interval } : null;
}

export function findPlanByCreemProductId(
  productId: string | null | undefined,
  env: NodeJS.ProcessEnv = process.env,
): CreemPlanKey | null {
  return findCreemProductById(productId, env)?.plan || null;
}

export function getCreemApiBaseUrl(apiKey: string | null | undefined, env: NodeJS.ProcessEnv = process.env): string {
  const explicitMode = (env.CREEM_ENV || "").toLowerCase();

  if (explicitMode === "production" || explicitMode === "live") {
    return "https://api.creem.io/v1";
  }

  if (explicitMode === "test" || explicitMode === "sandbox") {
    return "https://test-api.creem.io/v1";
  }

  return apiKey?.startsWith("creem_test_")
    ? "https://test-api.creem.io/v1"
    : "https://api.creem.io/v1";
}

export function getRiskShieldAppUrl(env: NodeJS.ProcessEnv = process.env): string {
  return (env.NEXT_PUBLIC_APP_URL || "https://www.secwyn.com").replace(/\/+$/, "");
}

export function getCreemCheckoutUrls(env: NodeJS.ProcessEnv = process.env) {
  const appUrl = getRiskShieldAppUrl(env);

  return {
    successUrl: `${appUrl}/dashboard/billing/success`,
    cancelUrl: `${appUrl}/pricing`,
    webhookUrl: `${appUrl}/api/payment/webhook`,
  };
}

export function getCreditsForPlan(
  plan: string,
  generation: BillingCatalogGeneration = "legacy",
): number {
  if (!isCreemSelfServePlan(plan)) return plans[plan as PlanKey]?.monthlyLimit ?? 0;
  return getBillingCatalogEntry(generation, plan, "monthly").monthlyCredits;
}

export function getCreemPriceForPlan(
  plan: string,
  billingInterval: CreemBillingInterval = "monthly",
  generation: BillingCatalogGeneration = "legacy",
): number {
  if (!isCreemSelfServePlan(plan)) return plans[plan as PlanKey]?.price ?? 0;
  return getBillingCatalogEntry(generation, plan, billingInterval).priceUsd;
}

function formatUsd(
  value: number,
  options: { minimumFractionDigits?: number; maximumFractionDigits?: number } = {},
): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: options.minimumFractionDigits ?? 0,
    maximumFractionDigits: options.maximumFractionDigits ?? 0,
  }).format(value);
}

export function getCreemAnnualOffer(
  plan: string,
  generation: BillingCatalogGeneration = getPublicCatalogGeneration(),
): AnnualPlanOffer | null {
  if (!isCreemSelfServePlan(plan)) return null;

  const monthlyPrice = getCreemPriceForPlan(plan, "monthly", generation);
  const yearlyPrice = getCreemPriceForPlan(plan, "yearly", generation);
  const monthlyTotal = monthlyPrice * 12;
  const savingsAmount = Math.max(0, monthlyTotal - yearlyPrice);
  const discountPercent = monthlyTotal > 0 ? Math.round((savingsAmount / monthlyTotal) * 100) : 0;
  const monthlyEquivalent = yearlyPrice / 12;

  return {
    yearlyPrice,
    yearlyPriceLabel: formatUsd(yearlyPrice),
    monthlyEquivalent,
    monthlyEquivalentLabel: formatUsd(monthlyEquivalent, {
      minimumFractionDigits: monthlyEquivalent % 1 === 0 ? 0 : 2,
      maximumFractionDigits: 2,
    }),
    savingsAmount,
    savingsAmountLabel: `Save ${formatUsd(savingsAmount)}/year`,
    discountPercent,
    discountPercentLabel: `Save ${discountPercent}%`,
    promoLabel: yearlyPrice === monthlyPrice * 11 ? "12 months for the price of 11" : null,
  };
}

export function getCreemSubscriptionCopy(billingInterval: CreemBillingInterval) {
  if (billingInterval === "yearly") {
    return {
      subscriptionLabel: "Annual subscription",
      renewalLabel: "Auto-renews yearly until canceled",
      cadenceLabel: "Billed yearly",
    };
  }

  return {
    subscriptionLabel: "Monthly subscription",
    renewalLabel: "Auto-renews monthly until canceled",
    cadenceLabel: "Billed monthly",
  };
}

export function hasActiveSubscriptionAccess(
  status: InternalSubscriptionStatus | string | null | undefined,
  subscriptionEnd: string | null | undefined,
): boolean {
  if (status === "active") return true;
  if (status === "cancelled" && subscriptionEnd) {
    return new Date(subscriptionEnd) > new Date();
  }
  return false;
}

export function verifyCreemWebhookSignature(payload: string, signature: string, secret: string): boolean {
  if (!signature || !secret) return false;

  const digest = crypto.createHmac("sha256", secret).update(payload, "utf8").digest("hex");
  if (digest.length !== signature.length) return false;
  return crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(signature));
}

export function identifyCreemRedirectSignatureVariant(
  rawQuery: string,
  apiKey: string,
): "sha256_ordered" | "legacy_hmac_sorted" | "unknown" {
  if (!rawQuery || !apiKey) return "unknown";

  const params = new URLSearchParams(rawQuery);
  const signature = params.get("signature");
  if (!signature) return "unknown";

  const signedEntries = Array.from(params.entries())
    .filter(([key, value]) => key !== "signature" && value !== "" && value !== "null")
  const signingString = signedEntries.map(([key, value]) => `${key}=${value}`)
    .concat(`salt=${apiKey}`).join("|");
  const expected = crypto.createHash("sha256").update(signingString).digest("hex");
  if (expected.length === signature.length && crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature))) {
    return "sha256_ordered";
  }

  const legacySigningString = signedEntries
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`)
    .join("&");
  const legacyExpected = crypto.createHmac("sha256", apiKey).update(legacySigningString).digest("hex");
  if (legacyExpected.length === signature.length && crypto.timingSafeEqual(Buffer.from(legacyExpected), Buffer.from(signature))) {
    return "legacy_hmac_sorted";
  }

  return "unknown";
}

export function verifyCreemRedirectSignature(rawQuery: string, apiKey: string): boolean {
  return identifyCreemRedirectSignatureVariant(rawQuery, apiKey) === "sha256_ordered";
}
