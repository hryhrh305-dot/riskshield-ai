import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";

import {
  findCreemProductById,
  findPlanByCreemProductId,
  getCreemAnnualOffer,
  getCreemApiBaseUrl,
  getCreemCheckoutUrls,
  getCreemEnvDebugInfo,
  getCreemPriceForPlan,
  getCreemProductIdForPlan,
  hasActiveSubscriptionAccess,
  isCreemSelfServePlan,
  normalizeCreemBillingInterval,
  verifyCreemRedirectSignature,
  verifyCreemWebhookSignature,
} from "../src/lib/creem.ts";
import {
  BILLING_REVOKE_EVENTS,
  BILLING_RISK_EVENTS,
  CREEM_HANDLED_EVENT_TYPES,
  extractPaymentIdentifiers,
  getBillingLookupCandidates,
} from "../src/lib/creem-webhook.ts";
import * as creemWebhook from "../src/lib/creem-webhook.ts";
import { getPlanRank, isPlanAtLeast } from "../src/lib/plans.ts";

const env = {
  NEXT_PUBLIC_APP_URL: "https://www.574269.xyz",
  CREEM_STARTER_PRODUCT_ID: "prod_starter",
  CREEM_GROWTH_PRODUCT_ID: "prod_growth",
  CREEM_SCALE_PRODUCT_ID: "prod_scale",
};

test("self-serve plan guard only allows starter growth scale", () => {
  assert.equal(isCreemSelfServePlan("starter"), true);
  assert.equal(isCreemSelfServePlan("growth"), true);
  assert.equal(isCreemSelfServePlan("scale"), true);
  assert.equal(isCreemSelfServePlan("free"), false);
  assert.equal(isCreemSelfServePlan("business"), false);
});

test("plan to product mapping uses dedicated product ids", () => {
  assert.equal(getCreemProductIdForPlan("starter", env), "prod_starter");
  assert.equal(getCreemProductIdForPlan("growth", env), "prod_growth");
  assert.equal(getCreemProductIdForPlan("scale", env), "prod_scale");
  assert.equal(getCreemProductIdForPlan("business", env), null);
});

test("product id can be resolved back to plan", () => {
  assert.equal(findPlanByCreemProductId("prod_starter", env), "starter");
  assert.equal(findPlanByCreemProductId("prod_growth", env), "growth");
  assert.equal(findPlanByCreemProductId("prod_scale", env), "scale");
  assert.equal(findPlanByCreemProductId("prod_unknown", env), null);
});

test("legacy and alternate product env names still resolve", () => {
  const legacyEnv = {
    CREEM_PRODUCT_ID: "legacy_starter",
    CREEM_PRODUCT_ID_GROWTH: "legacy_growth",
    CREEM_PRODUCT_ID_SCALE: "legacy_scale",
  };

  assert.equal(getCreemProductIdForPlan("starter", legacyEnv), "legacy_starter");
  assert.equal(getCreemProductIdForPlan("growth", legacyEnv), "legacy_growth");
  assert.equal(getCreemProductIdForPlan("scale", legacyEnv), "legacy_scale");
});

test("monthly product env names from Vercel are supported", () => {
  const monthlyEnv = {
    CREEM_PRODUCT_STARTER_MONTHLY: "monthly_starter",
    CREEM_PRODUCT_GROWTH_MONTHLY: "monthly_growth",
    CREEM_PRODUCT_SCALE_MONTHLY: "monthly_scale",
  };

  assert.equal(getCreemProductIdForPlan("starter", monthlyEnv), "monthly_starter");
  assert.equal(getCreemProductIdForPlan("growth", monthlyEnv), "monthly_growth");
  assert.equal(getCreemProductIdForPlan("scale", monthlyEnv), "monthly_scale");
  assert.equal(findPlanByCreemProductId("monthly_scale", monthlyEnv), "scale");
});

test("yearly product env names are supported without changing plan entitlements", () => {
  const yearlyEnv = {
    CREEM_STARTER_YEARLY_PRODUCT_ID: "yearly_starter",
    CREEM_GROWTH_YEARLY_PRODUCT_ID: "yearly_growth",
    CREEM_SCALE_YEARLY_PRODUCT_ID: "yearly_scale",
  };

  assert.equal(getCreemProductIdForPlan("starter", yearlyEnv, "yearly"), "yearly_starter");
  assert.equal(getCreemProductIdForPlan("growth", yearlyEnv, "yearly"), "yearly_growth");
  assert.equal(getCreemProductIdForPlan("scale", yearlyEnv, "yearly"), "yearly_scale");
  assert.deepEqual(findCreemProductById("yearly_growth", yearlyEnv), {
    plan: "growth",
    billingInterval: "yearly",
  });
  assert.equal(findPlanByCreemProductId("yearly_scale", yearlyEnv), "scale");
  assert.equal(getCreemPriceForPlan("starter", "yearly"), 499);
  assert.equal(getCreemPriceForPlan("growth", "yearly"), 2499);
  assert.equal(getCreemPriceForPlan("scale", "yearly"), 14999);
  assert.equal(normalizeCreemBillingInterval("yearly"), "yearly");
  assert.equal(normalizeCreemBillingInterval("invalid"), "monthly");
});

test("annual offer metadata is derived from the configured monthly and yearly prices", () => {
  const starterOffer = getCreemAnnualOffer("starter");
  assert.equal(starterOffer?.yearlyPrice, 499);
  assert.equal(starterOffer?.monthlyEquivalentLabel, "$41.58");
  assert.equal(starterOffer?.savingsAmount, 89);
  assert.equal(starterOffer?.discountPercent, 15);
  assert.equal(starterOffer?.promoLabel, null);

  const growthOffer = getCreemAnnualOffer("growth");
  assert.equal(growthOffer?.yearlyPriceLabel, "$2,499");
  assert.equal(growthOffer?.monthlyEquivalentLabel, "$208.25");
  assert.equal(growthOffer?.discountPercentLabel, "Save 16%");
});

test("creem test keys use test api host", () => {
  assert.equal(getCreemApiBaseUrl("creem_test_123"), "https://test-api.creem.io/v1");
  assert.equal(getCreemApiBaseUrl("creem_live_123"), "https://api.creem.io/v1");
});

test("explicit creem env overrides api key prefix", () => {
  assert.equal(
    getCreemApiBaseUrl("creem_test_123", { CREEM_ENV: "production" }),
    "https://api.creem.io/v1",
  );
  assert.equal(
    getCreemApiBaseUrl("creem_live_123", { CREEM_ENV: "test" }),
    "https://test-api.creem.io/v1",
  );
});

test("checkout urls use the production riskshield paths", () => {
  const urls = getCreemCheckoutUrls(env);

  assert.equal(urls.successUrl, "https://www.574269.xyz/dashboard/billing/success");
  assert.equal(urls.cancelUrl, "https://www.574269.xyz/pricing");
  assert.equal(urls.webhookUrl, "https://www.574269.xyz/api/payment/webhook");
});

test("redirect signature verification follows Creem SHA-256 order and excludes null values", () => {
  const apiKey = "creem_test_abc";
  const rawQueryWithoutSignature = [
    "checkout_id=ch_123",
    "order_id=null",
    "customer_id=cust_789",
    "subscription_id=sub_321",
    "product_id=prod_growth",
    "request_id=req_111",
  ].join("&");
  const signingString = [
    "checkout_id=ch_123",
    "customer_id=cust_789",
    "subscription_id=sub_321",
    "product_id=prod_growth",
    "request_id=req_111",
    `salt=${apiKey}`,
  ].join("|");
  const signature = crypto.createHash("sha256").update(signingString).digest("hex");
  const rawQuery = `${rawQueryWithoutSignature}&signature=${signature}`;

  assert.equal(verifyCreemRedirectSignature(rawQuery, apiKey), true);
  assert.equal(verifyCreemRedirectSignature(`${rawQueryWithoutSignature}&signature=bad`, apiKey), false);
});

test("webhook signature verification matches HMAC-SHA256 payload signing", () => {
  const payload = JSON.stringify({ eventType: "subscription.paid", object: { id: "sub_123" } });
  const secret = "whsec_abc123";
  const signature = crypto.createHmac("sha256", secret).update(payload, "utf8").digest("hex");

  assert.equal(verifyCreemWebhookSignature(payload, signature, secret), true);
  assert.equal(verifyCreemWebhookSignature(payload, "bad-signature", secret), false);
});

test("billing revoke events are explicitly allow-listed", () => {
  assert.deepEqual([...BILLING_REVOKE_EVENTS], ["refund.created", "dispute.created"]);
  assert.deepEqual([...BILLING_RISK_EVENTS], ["refund.created", "dispute.created"]);
  assert.equal(CREEM_HANDLED_EVENT_TYPES.includes("subscription.canceled"), true);
  assert.equal(CREEM_HANDLED_EVENT_TYPES.includes("subscription.expired"), true);
});

test("billing lookup candidates prefer transaction then checkout then subscription then metadata ids", () => {
  const event = {
    eventType: "refund.created",
    object: {
      transaction_id: "txn_123",
      checkout_id: "chk_456",
      subscription: {
        id: "sub_789",
        customer_id: "cust_abc",
        metadata: {
          userId: "user_sub_meta",
        },
      },
      metadata: {
        user_id: "user_obj_meta",
        profileId: "profile_obj_meta",
        email: "owner@example.com",
      },
    },
  };

  assert.deepEqual(getBillingLookupCandidates(event), [
    { kind: "transaction", value: "txn_123" },
    { kind: "checkout", value: "chk_456" },
    { kind: "subscription", value: "sub_789" },
    { kind: "customer", value: "cust_abc" },
    { kind: "user", value: "user_obj_meta" },
    { kind: "profile", value: "profile_obj_meta" },
  ]);
});

test("payment identifier extraction keeps metadata fallbacks available for safe revoke matching", () => {
  const identifiers = extractPaymentIdentifiers({
    type: "dispute.created",
    object: {
      order: { id: "ord_123" },
      payment: { id: "pay_456" },
      metadata: {
        userId: "user_1",
        profile_id: "profile_1",
        user_email: "riskshield@example.com",
      },
    },
  });

  assert.deepEqual(identifiers, {
    transactionId: "pay_456",
    checkoutId: null,
    orderId: "ord_123",
    subscriptionId: null,
    customerId: null,
    refundId: null,
    metadataUserId: "user_1",
    metadataProfileId: "profile_1",
    metadataEmail: "riskshield@example.com",
  });
});

test("official refund payload resolves the nested transaction and refund identifiers", () => {
  const event = {
    id: "evt_refund_1",
    eventType: "refund.created",
    object: {
      id: "ref_1",
      status: "succeeded",
      refund_amount: 5000,
      transaction: { id: "tran_1", amount_paid: 5000, status: "refunded" },
      subscription: { id: "sub_1", status: "canceled" },
    },
  };

  assert.deepEqual(extractPaymentIdentifiers(event), {
    transactionId: "tran_1",
    checkoutId: null,
    orderId: null,
    subscriptionId: "sub_1",
    customerId: null,
    refundId: "ref_1",
    metadataUserId: null,
    metadataProfileId: null,
    metadataEmail: null,
  });
});

test("refund classification only revokes a verified full canceled refund", () => {
  const classify = creemWebhook.classifyCreemRefund;
  assert.equal(typeof classify, "function");

  assert.deepEqual(classify({
    id: "evt_full",
    eventType: "refund.created",
    object: {
      id: "ref_full",
      status: "succeeded",
      refund_amount: 5000,
      transaction: { id: "tran_full", amount_paid: 5000, status: "refunded" },
      subscription: { id: "sub_full", status: "canceled" },
    },
  }), {
    kind: "full",
    refundId: "ref_full",
    transactionId: "tran_full",
    refundAmountMinor: 5000,
    amountPaidMinor: 5000,
  });

  assert.equal(classify({
    eventType: "refund.created",
    object: {
      id: "ref_partial",
      status: "succeeded",
      refund_amount: 1000,
      transaction: { id: "tran_partial", amount_paid: 5000, status: "partially_refunded" },
      subscription: { id: "sub_partial", status: "active" },
    },
  }).kind, "partial");

  assert.equal(classify({
    eventType: "refund.created",
    object: {
      id: "ref_unsafe",
      status: "pending",
      refund_amount: 5000,
      transaction: { id: "tran_unsafe", amount_paid: 5000 },
      subscription: { id: "sub_unsafe", status: "canceled" },
    },
  }).kind, "unverified");
});

test("cancelled subscriptions keep access until the paid period actually ends", () => {
  const futureEnd = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  const pastEnd = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  assert.equal(hasActiveSubscriptionAccess("active", futureEnd), true);
  assert.equal(hasActiveSubscriptionAccess("cancelled", futureEnd), true);
  assert.equal(hasActiveSubscriptionAccess("cancelled", pastEnd), false);
  assert.equal(hasActiveSubscriptionAccess("past_due", futureEnd), false);
});

test("creem env debug info returns booleans only", () => {
  const debug = getCreemEnvDebugInfo({
    CREEM_API_KEY: "creem_test_123",
    CREEM_PRODUCT_STARTER_MONTHLY: "starter-product",
    CREEM_PRODUCT_GROWTH_MONTHLY: "growth-product",
    CREEM_PRODUCT_SCALE_MONTHLY: "scale-product",
    NEXT_PUBLIC_APP_URL: "https://www.574269.xyz",
    VERCEL_ENV: "preview",
    NODE_ENV: "test",
  });

  assert.deepEqual(debug, {
    hasCreemApiKey: true,
    hasWebhookSecret: false,
    hasProductionStarterProduct: false,
    hasProductionGrowthProduct: false,
    hasProductionScaleProduct: false,
    hasProductionStarterYearlyProduct: false,
    hasProductionGrowthYearlyProduct: false,
    hasProductionScaleYearlyProduct: false,
    hasStarterProduct: true,
    hasGrowthProduct: true,
    hasScaleProduct: true,
    hasStarterYearlyProduct: false,
    hasGrowthYearlyProduct: false,
    hasScaleYearlyProduct: false,
    hasLegacyStarterProduct: false,
    hasLegacyGrowthProduct: false,
    hasLegacyScaleProduct: false,
    isExplicitProduction: false,
    usesLiveApiHost: false,
    isProductionConfigComplete: false,
    vercelEnv: "preview",
    nodeEnv: "test",
  });
});

test("creem env debug info reports production readiness", () => {
  const debug = getCreemEnvDebugInfo({
    CREEM_ENV: "production",
    CREEM_API_KEY: "creem_live_123",
    CREEM_WEBHOOK_SECRET: "whsec_live_123",
    CREEM_STARTER_PRODUCT_ID: "prod_starter_live",
    CREEM_GROWTH_PRODUCT_ID: "prod_growth_live",
    CREEM_SCALE_PRODUCT_ID: "prod_scale_live",
    CREEM_STARTER_YEARLY_PRODUCT_ID: "prod_starter_yearly_live",
    CREEM_GROWTH_YEARLY_PRODUCT_ID: "prod_growth_yearly_live",
    CREEM_SCALE_YEARLY_PRODUCT_ID: "prod_scale_yearly_live",
    NEXT_PUBLIC_APP_URL: "https://www.574269.xyz",
    VERCEL_ENV: "production",
    NODE_ENV: "production",
  });

  assert.deepEqual(debug, {
    hasCreemApiKey: true,
    hasWebhookSecret: true,
    hasProductionStarterProduct: true,
    hasProductionGrowthProduct: true,
    hasProductionScaleProduct: true,
    hasProductionStarterYearlyProduct: true,
    hasProductionGrowthYearlyProduct: true,
    hasProductionScaleYearlyProduct: true,
    hasStarterProduct: true,
    hasGrowthProduct: true,
    hasScaleProduct: true,
    hasStarterYearlyProduct: true,
    hasGrowthYearlyProduct: true,
    hasScaleYearlyProduct: true,
    hasLegacyStarterProduct: false,
    hasLegacyGrowthProduct: false,
    hasLegacyScaleProduct: false,
    isExplicitProduction: true,
    usesLiveApiHost: true,
    isProductionConfigComplete: true,
    vercelEnv: "production",
    nodeEnv: "production",
  });
});

test("plan rank treats business as higher than paid self-serve plans", () => {
  assert.equal(getPlanRank("free"), 0);
  assert.equal(getPlanRank("starter"), 1);
  assert.equal(getPlanRank("growth"), 2);
  assert.equal(getPlanRank("scale"), 3);
  assert.equal(getPlanRank("business"), 4);
  assert.equal(isPlanAtLeast("business", "growth"), true);
  assert.equal(isPlanAtLeast("growth", "scale"), false);
});
