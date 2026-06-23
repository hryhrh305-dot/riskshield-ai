import crypto from "crypto";
import { plans, type PlanKey } from "./plans.ts";

type CreemPlanKey = Extract<PlanKey, "starter" | "growth" | "scale">;

export const CREEM_SELF_SERVE_PLANS = ["starter", "growth", "scale"] as const satisfies readonly CreemPlanKey[];

type ProductEnvMap = Record<CreemPlanKey, string | undefined>;

export function isCreemSelfServePlan(plan: string): plan is CreemPlanKey {
  return CREEM_SELF_SERVE_PLANS.includes(plan as CreemPlanKey);
}

export function getCreemProductEnvMap(env: NodeJS.ProcessEnv = process.env): ProductEnvMap {
  return {
    starter:
      env.CREEM_STARTER_PRODUCT_ID ||
      env.CREEM_PRODUCT_ID_STARTER ||
      env.CREEM_PRODUCT_ID,
    growth:
      env.CREEM_GROWTH_PRODUCT_ID ||
      env.CREEM_PRODUCT_ID_GROWTH,
    scale:
      env.CREEM_SCALE_PRODUCT_ID ||
      env.CREEM_PRODUCT_ID_SCALE,
  };
}

export function getCreemProductIdForPlan(
  plan: string,
  env: NodeJS.ProcessEnv = process.env,
): string | null {
  if (!isCreemSelfServePlan(plan)) return null;
  return getCreemProductEnvMap(env)[plan] || null;
}

export function findPlanByCreemProductId(
  productId: string | null | undefined,
  env: NodeJS.ProcessEnv = process.env,
): CreemPlanKey | null {
  if (!productId) return null;

  const productMap = getCreemProductEnvMap(env);
  for (const plan of CREEM_SELF_SERVE_PLANS) {
    if (productMap[plan] === productId) return plan;
  }

  return null;
}

export function getCreemApiBaseUrl(apiKey: string | null | undefined): string {
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
