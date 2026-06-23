import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";

import {
  findPlanByCreemProductId,
  getCreemApiBaseUrl,
  getCreemEnvDebugInfo,
  getCreemCheckoutUrls,
  getCreemProductIdForPlan,
  isCreemSelfServePlan,
  verifyCreemRedirectSignature,
  verifyCreemWebhookSignature,
} from "../src/lib/creem.ts";

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

test("creem test keys use test api host", () => {
  assert.equal(getCreemApiBaseUrl("creem_test_123"), "https://test-api.creem.io/v1");
  assert.equal(getCreemApiBaseUrl("creem_live_123"), "https://api.creem.io/v1");
});

test("checkout urls use the production riskshield paths", () => {
  const urls = getCreemCheckoutUrls(env);

  assert.equal(urls.successUrl, "https://www.574269.xyz/dashboard/billing/success");
  assert.equal(urls.cancelUrl, "https://www.574269.xyz/pricing");
  assert.equal(urls.webhookUrl, "https://www.574269.xyz/api/payment/webhook");
});

test("redirect signature verification follows creem canonical order", () => {
  const apiKey = "creem_test_abc";
  const rawQueryWithoutSignature = [
    "checkout_id=ch_123",
    "order_id=ord_456",
    "customer_id=cust_789",
    "subscription_id=sub_321",
    "product_id=prod_growth",
    "request_id=req_111",
  ].join("&");
  const signingString = [
    "checkout_id=ch_123",
    "order_id=ord_456",
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

test("creem env debug info returns booleans only", () => {
  const debug = getCreemEnvDebugInfo({
    CREEM_API_KEY: "secret",
    CREEM_PRODUCT_STARTER_MONTHLY: "starter-product",
    CREEM_PRODUCT_GROWTH_MONTHLY: "growth-product",
    CREEM_PRODUCT_SCALE_MONTHLY: "scale-product",
    NEXT_PUBLIC_APP_URL: "https://www.574269.xyz",
    VERCEL_ENV: "production",
    NODE_ENV: "production",
  });

  assert.deepEqual(debug, {
    hasCreemApiKey: true,
    hasStarterProduct: true,
    hasGrowthProduct: true,
    hasScaleProduct: true,
    hasLegacyStarterProduct: false,
    hasLegacyGrowthProduct: false,
    hasLegacyScaleProduct: false,
    vercelEnv: "production",
    nodeEnv: "production",
  });
});
