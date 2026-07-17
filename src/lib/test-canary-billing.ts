import {
  getBillingCatalogEntry,
  findBillingCatalogEntryByProductId,
  type BillingCatalogEntry,
  type BillingInterval,
  type BillingPlan,
} from "@/lib/billing-catalog";
import { getAdminV2CanaryDecision } from "@/lib/admin-v2-canary";

export const TEST_CANARY_BILLING_ENVIRONMENT = "test_canary" as const;
export const TEST_CANARY_CATALOG_GENERATION = "premium_v2" as const;
export const TEST_CANARY_API_BASE_URL = "https://test-api.creem.io/v1";

export type TestCanaryActor = {
  verified: boolean;
  userId: string | null;
  email: string | null;
};

export type TestCanaryProduct = {
  billingEnvironment: typeof TEST_CANARY_BILLING_ENVIRONMENT;
  generation: typeof TEST_CANARY_CATALOG_GENERATION;
  plan: BillingPlan;
  interval: BillingInterval;
  productId: string;
  entry: BillingCatalogEntry;
};

export type TestCanaryCheckoutDecision =
  | ({ kind: "checkout" } & TestCanaryProduct)
  | { kind: "contact"; reason: "SCALE_ANNUAL_CONTACT_ONLY" }
  | {
      kind: "denied";
      reason:
        | "TEST_CHECKOUT_DISABLED"
        | "CANARY_ACTOR_REQUIRED"
        | "UNKNOWN_BILLING_PLAN"
        | "TEST_PRODUCT_MAPPING_INCOMPLETE";
    };

const PRODUCT_ENV_KEYS: Record<BillingPlan, Record<BillingInterval, string>> = {
  starter: {
    monthly: "CREEM_CANARY_TEST_STARTER_MONTHLY_V2_PRODUCT_ID",
    yearly: "CREEM_CANARY_TEST_STARTER_ANNUAL_V2_PRODUCT_ID",
  },
  growth: {
    monthly: "CREEM_CANARY_TEST_GROWTH_MONTHLY_V2_PRODUCT_ID",
    yearly: "CREEM_CANARY_TEST_GROWTH_ANNUAL_V2_PRODUCT_ID",
  },
  scale: {
    monthly: "CREEM_CANARY_TEST_SCALE_MONTHLY_V2_PRODUCT_ID",
    yearly: "CREEM_CANARY_TEST_SCALE_ANNUAL_V2_PRODUCT_ID",
  },
};

function isBillingPlan(plan: string): plan is BillingPlan {
  return plan === "starter" || plan === "growth" || plan === "scale";
}

function productEntries(env: NodeJS.ProcessEnv): Array<TestCanaryProduct | null> {
  return (Object.keys(PRODUCT_ENV_KEYS) as BillingPlan[]).flatMap((plan) =>
    (["monthly", "yearly"] as BillingInterval[]).map((interval) => {
      const productId = env[PRODUCT_ENV_KEYS[plan][interval]]?.trim();
      if (!productId) return null;
      return {
        billingEnvironment: TEST_CANARY_BILLING_ENVIRONMENT,
        generation: TEST_CANARY_CATALOG_GENERATION,
        plan,
        interval,
        productId,
        entry: getBillingCatalogEntry(TEST_CANARY_CATALOG_GENERATION, plan, interval),
      };
    }),
  );
}

export function getTestCanaryProductMap(env: NodeJS.ProcessEnv = process.env): TestCanaryProduct[] | null {
  const entries = productEntries(env);
  if (entries.some((entry) => entry === null)) return null;

  const complete = entries as TestCanaryProduct[];
  const ids = complete.map((entry) => entry.productId);
  if (new Set(ids).size !== ids.length) throw new Error("DUPLICATE_TEST_CANARY_PRODUCT_MAPPING");
  if (ids.some((productId) => findBillingCatalogEntryByProductId(productId, env))) {
    throw new Error("TEST_CANARY_LIVE_PRODUCT_COLLISION");
  }
  return complete;
}

export function findTestCanaryProductById(
  productId: string | null | undefined,
  env: NodeJS.ProcessEnv = process.env,
): TestCanaryProduct | null {
  if (!productId) return null;
  return getTestCanaryProductMap(env)?.find((entry) => entry.productId === productId) || null;
}

export function isTestCanaryCheckoutConfigured(env: NodeJS.ProcessEnv = process.env): boolean {
  if (env.SECWYN_ADMIN_TEST_CHECKOUT_ENABLED !== "true") return false;
  try {
    return Boolean(
      getTestCanaryProductMap(env) &&
      env.CREEM_CANARY_TEST_API_KEY?.trim() &&
      env.CREEM_CANARY_TEST_WEBHOOK_SECRET?.trim(),
    );
  } catch {
    return false;
  }
}

export function getTestCanaryCheckoutDecision(
  actor: TestCanaryActor,
  plan: string,
  interval: BillingInterval,
  env: NodeJS.ProcessEnv = process.env,
): TestCanaryCheckoutDecision {
  if (env.SECWYN_ADMIN_TEST_CHECKOUT_ENABLED !== "true") {
    return { kind: "denied", reason: "TEST_CHECKOUT_DISABLED" };
  }

  const canary = getAdminV2CanaryDecision({ verified: actor.verified, email: actor.email }, env);
  if (!canary.enabled || !actor.userId) {
    return { kind: "denied", reason: "CANARY_ACTOR_REQUIRED" };
  }
  if (!isBillingPlan(plan)) return { kind: "denied", reason: "UNKNOWN_BILLING_PLAN" };
  if (plan === "scale" && interval === "yearly") {
    return { kind: "contact", reason: "SCALE_ANNUAL_CONTACT_ONLY" };
  }

  const productMap = getTestCanaryProductMap(env);
  if (!productMap || !isTestCanaryCheckoutConfigured(env)) {
    return { kind: "denied", reason: "TEST_PRODUCT_MAPPING_INCOMPLETE" };
  }

  const product = productMap.find((entry) => entry.plan === plan && entry.interval === interval);
  return product
    ? { kind: "checkout", ...product }
    : { kind: "denied", reason: "TEST_PRODUCT_MAPPING_INCOMPLETE" };
}

export function buildTestCanaryCheckoutMetadata(params: {
  actor: TestCanaryActor;
  plan: BillingPlan;
  interval: BillingInterval;
  correlationId: string;
}) {
  if (!params.actor.verified || !params.actor.userId) throw new Error("VERIFIED_CANARY_ACTOR_REQUIRED");
  if (!params.correlationId.trim()) throw new Error("CANARY_CORRELATION_ID_REQUIRED");
  return {
    billing_environment: TEST_CANARY_BILLING_ENVIRONMENT,
    catalog_generation: TEST_CANARY_CATALOG_GENERATION,
    user_id: params.actor.userId,
    plan: params.plan,
    billing_interval: params.interval,
    correlation_id: params.correlationId,
  };
}
