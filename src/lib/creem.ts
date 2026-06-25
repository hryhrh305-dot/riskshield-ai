import crypto from "crypto";
import { plans, type PlanKey } from "./plans.ts";

type CreemPlanKey = Extract<PlanKey, "starter" | "growth" | "scale">;
export type CreemBillingInterval = "monthly" | "yearly";

export const CREEM_SELF_SERVE_PLANS = ["starter", "growth", "scale"] as const satisfies readonly CreemPlanKey[];
export const CREEM_BILLING_INTERVALS = ["monthly", "yearly"] as const satisfies readonly CreemBillingInterval[];

type ProductEnvMap = Record<CreemPlanKey, string | undefined>;
type ProductEnvMapByInterval = Record<CreemBillingInterval, ProductEnvMap>;

const YEARLY_PRICES: Record<CreemPlanKey, number> = {
  starter: 499,
  growth: 2499,
  scale: 14999,
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
  if (!productId) return null;

  const productMaps = getCreemProductEnvMaps(env);
  for (const billingInterval of CREEM_BILLING_INTERVALS) {
    for (const plan of CREEM_SELF_SERVE_PLANS) {
      if (productMaps[billingInterval][plan] === productId) {
        return { plan, billingInterval };
      }
    }
  }

  return null;
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
  return (env.NEXT_PUBLIC_APP_URL || "https://www.574269.xyz").replace(/\/+$/, "");
}

export function getCreemCheckoutUrls(env: NodeJS.ProcessEnv = process.env) {
  const appUrl = getRiskShieldAppUrl(env);

  return {
    successUrl: `${appUrl}/dashboard/billing/success`,
    cancelUrl: `${appUrl}/pricing`,
    webhookUrl: `${appUrl}/api/payment/webhook`,
  };
}

export function getCreditsForPlan(plan: string): number {
  return plans[plan as PlanKey]?.monthlyLimit ?? 0;
}

export function getCreemPriceForPlan(
  plan: string,
  billingInterval: CreemBillingInterval = "monthly",
): number {
  if (!isCreemSelfServePlan(plan)) return plans[plan as PlanKey]?.price ?? 0;
  return billingInterval === "yearly" ? YEARLY_PRICES[plan] : plans[plan].price;
}

export function verifyCreemWebhookSignature(payload: string, signature: string, secret: string): boolean {
  if (!signature || !secret) return false;

  const digest = crypto.createHmac("sha256", secret).update(payload, "utf8").digest("hex");
  if (digest.length !== signature.length) return false;
  return crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(signature));
}

export function verifyCreemRedirectSignature(rawQuery: string, apiKey: string): boolean {
  if (!rawQuery || !apiKey) return false;

  const params = new URLSearchParams(rawQuery);
  const signature = params.get("signature");
  if (!signature) return false;

  const parts: string[] = [];
  for (const [key, value] of params.entries()) {
    if (key === "signature" || value === "") continue;
    parts.push(`${key}=${value}`);
  }

  parts.push(`salt=${apiKey}`);

  const expected = crypto.createHash("sha256").update(parts.join("|")).digest("hex");
  if (expected.length !== signature.length) return false;
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}
