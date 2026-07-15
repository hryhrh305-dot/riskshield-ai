export type BillingCatalogGeneration = "legacy" | "premium_v2";
export type BillingPlan = "starter" | "growth" | "scale";
export type BillingInterval = "monthly" | "yearly";

export type BillingCatalogEntry = {
  generation: BillingCatalogGeneration;
  plan: BillingPlan;
  interval: BillingInterval;
  priceUsd: number;
  monthlyCredits: number;
  referralRewardCredits: number;
  apiAccess: boolean;
  googleSheets: boolean;
  publicSelfServe: boolean;
  productEnvKey: string;
};

const CATALOG: Record<BillingCatalogGeneration, Record<BillingPlan, Record<BillingInterval, BillingCatalogEntry>>> = {
  legacy: {
    starter: {
      monthly: entry("legacy", "starter", "monthly", 49, 500, 50, false, "CREEM_STARTER_PRODUCT_ID"),
      yearly: entry("legacy", "starter", "yearly", 499, 500, 50, false, "CREEM_STARTER_YEARLY_PRODUCT_ID"),
    },
    growth: {
      monthly: entry("legacy", "growth", "monthly", 249, 2500, 250, true, "CREEM_GROWTH_PRODUCT_ID"),
      yearly: entry("legacy", "growth", "yearly", 2499, 2500, 250, true, "CREEM_GROWTH_YEARLY_PRODUCT_ID"),
    },
    scale: {
      monthly: entry("legacy", "scale", "monthly", 1499, 15000, 1500, true, "CREEM_SCALE_PRODUCT_ID"),
      yearly: entry("legacy", "scale", "yearly", 14999, 15000, 1500, true, "CREEM_SCALE_YEARLY_PRODUCT_ID"),
    },
  },
  premium_v2: {
    starter: {
      monthly: entry("premium_v2", "starter", "monthly", 199, 500, 50, false, "CREEM_STARTER_MONTHLY_V2_PRODUCT_ID"),
      yearly: entry("premium_v2", "starter", "yearly", 2189, 500, 50, false, "CREEM_STARTER_ANNUAL_V2_PRODUCT_ID"),
    },
    growth: {
      monthly: entry("premium_v2", "growth", "monthly", 999, 2500, 250, true, "CREEM_GROWTH_MONTHLY_V2_PRODUCT_ID"),
      yearly: entry("premium_v2", "growth", "yearly", 10989, 2500, 250, true, "CREEM_GROWTH_ANNUAL_V2_PRODUCT_ID"),
    },
    scale: {
      monthly: entry("premium_v2", "scale", "monthly", 3999, 10000, 1000, true, "CREEM_SCALE_MONTHLY_V2_PRODUCT_ID"),
      yearly: { ...entry("premium_v2", "scale", "yearly", 43989, 10000, 1000, true, "CREEM_SCALE_ANNUAL_V2_PRODUCT_ID"), publicSelfServe: false },
    },
  },
};

function entry(
  generation: BillingCatalogGeneration,
  plan: BillingPlan,
  interval: BillingInterval,
  priceUsd: number,
  monthlyCredits: number,
  referralRewardCredits: number,
  workflowAccess: boolean,
  productEnvKey: string,
): BillingCatalogEntry {
  return {
    generation,
    plan,
    interval,
    priceUsd,
    monthlyCredits,
    referralRewardCredits,
    apiAccess: workflowAccess,
    googleSheets: workflowAccess,
    publicSelfServe: true,
    productEnvKey,
  };
}

function isTrue(value: string | undefined): boolean {
  return value === "true";
}

export function getSecwynPricingFlags(env: NodeJS.ProcessEnv = process.env) {
  return {
    premiumV2: isTrue(env.SECWYN_PREMIUM_PRICING_V2_ENABLED),
    annualSelfServe: isTrue(env.SECWYN_V2_ANNUAL_SELF_SERVE_ENABLED),
  };
}

export function getPublicCatalogGeneration(env: NodeJS.ProcessEnv = process.env): BillingCatalogGeneration {
  return getSecwynPricingFlags(env).premiumV2 ? "premium_v2" : "legacy";
}

function assertPlan(plan: string): asserts plan is BillingPlan {
  if (plan !== "starter" && plan !== "growth" && plan !== "scale") throw new Error("UNKNOWN_BILLING_PLAN");
}

export function getBillingCatalogEntry(
  generation: BillingCatalogGeneration,
  plan: string,
  interval: BillingInterval,
): BillingCatalogEntry {
  assertPlan(plan);
  return CATALOG[generation][plan][interval];
}

function legacyProductId(entry: BillingCatalogEntry, env: NodeJS.ProcessEnv): string | null {
  const direct = env[entry.productEnvKey];
  if (direct) return direct;
  const creemMode = (env.CREEM_ENV || "").toLowerCase();
  if (creemMode === "production" || creemMode === "live") return null;
  if (entry.interval === "yearly") return null;
  if (entry.plan === "starter") return env.CREEM_PRODUCT_STARTER_MONTHLY || env.CREEM_PRODUCT_ID_STARTER || env.CREEM_PRODUCT_ID || null;
  if (entry.plan === "growth") return env.CREEM_PRODUCT_GROWTH_MONTHLY || env.CREEM_PRODUCT_ID_GROWTH || null;
  return env.CREEM_PRODUCT_SCALE_MONTHLY || env.CREEM_PRODUCT_ID_SCALE || null;
}

export function getBillingCatalogProductId(entry: BillingCatalogEntry, env: NodeJS.ProcessEnv = process.env): string | null {
  return entry.generation === "legacy" ? legacyProductId(entry, env) : env[entry.productEnvKey] || null;
}

export function getAllBillingCatalogEntries(): BillingCatalogEntry[] {
  return (Object.values(CATALOG) as Array<Record<BillingPlan, Record<BillingInterval, BillingCatalogEntry>>>).flatMap((generation) =>
    (Object.values(generation) as Array<Record<BillingInterval, BillingCatalogEntry>>).flatMap((plan) => Object.values(plan)),
  );
}

export function validateBillingCatalogProductIds(env: NodeJS.ProcessEnv = process.env): void {
  const seen = new Map<string, BillingCatalogEntry>();
  for (const entry of getAllBillingCatalogEntries()) {
    const productId = getBillingCatalogProductId(entry, env);
    if (!productId) continue;
    if (seen.has(productId)) throw new Error("DUPLICATE_CREEM_PRODUCT_MAPPING");
    seen.set(productId, entry);
  }
}

export function findBillingCatalogEntryByProductId(
  productId: string | null | undefined,
  env: NodeJS.ProcessEnv = process.env,
): BillingCatalogEntry | null {
  if (!productId) return null;
  validateBillingCatalogProductIds(env);
  return getAllBillingCatalogEntries().find((entry) => getBillingCatalogProductId(entry, env) === productId) || null;
}

export type CheckoutAvailability =
  | { kind: "checkout"; generation: BillingCatalogGeneration; entry: BillingCatalogEntry; productId: string }
  | { kind: "contact"; generation: BillingCatalogGeneration; entry: BillingCatalogEntry; reason: string }
  | { kind: "unavailable"; generation: BillingCatalogGeneration; entry: BillingCatalogEntry; reason: string };

export function getCheckoutAvailability(
  plan: string,
  interval: BillingInterval,
  env: NodeJS.ProcessEnv = process.env,
): CheckoutAvailability {
  validateBillingCatalogProductIds(env);
  const generation = getPublicCatalogGeneration(env);
  const entry = getBillingCatalogEntry(generation, plan, interval);
  if (generation === "premium_v2" && interval === "yearly") {
    if (plan === "scale") return { kind: "contact", generation, entry, reason: "SCALE_ANNUAL_CONTACT_ONLY" };
    if (!getSecwynPricingFlags(env).annualSelfServe) return { kind: "contact", generation, entry, reason: "ANNUAL_SELF_SERVE_DISABLED" };
  }
  const productId = getBillingCatalogProductId(entry, env);
  if (!productId) return { kind: "unavailable", generation, entry, reason: "PRODUCT_MAPPING_MISSING" };
  return { kind: "checkout", generation, entry, productId };
}
