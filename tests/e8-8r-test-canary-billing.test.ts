import { existsSync, readFileSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  buildTestCanaryCheckoutMetadata,
  findTestCanaryProductById,
  getTestCanaryCheckoutDecision,
  getTestCanaryProductMap,
  type TestCanaryActor,
} from "@/lib/test-canary-billing";
import { verifyCreemRedirectSignature } from "@/lib/creem";

const canaryActor: TestCanaryActor = {
  verified: true,
  userId: "11111111-1111-4111-8111-111111111111",
  email: "canary@example.com",
};

const nonCanaryActor: TestCanaryActor = {
  verified: true,
  userId: "22222222-2222-4222-8222-222222222222",
  email: "ordinary@example.com",
};

function completeEnv(): NodeJS.ProcessEnv {
  return {
    NODE_ENV: "test",
    SECWYN_ADMIN_V2_CANARY_ENABLED: "true",
    SECWYN_V2_CANARY_EMAILS: "canary@example.com",
    SECWYN_ADMIN_TEST_CHECKOUT_ENABLED: "true",
    CREEM_CANARY_TEST_API_KEY: "test-api-key",
    CREEM_CANARY_TEST_WEBHOOK_SECRET: "test-webhook-secret",
    CREEM_CANARY_TEST_STARTER_MONTHLY_V2_PRODUCT_ID: "test_starter_monthly",
    CREEM_CANARY_TEST_GROWTH_MONTHLY_V2_PRODUCT_ID: "test_growth_monthly",
    CREEM_CANARY_TEST_SCALE_MONTHLY_V2_PRODUCT_ID: "test_scale_monthly",
    CREEM_CANARY_TEST_STARTER_ANNUAL_V2_PRODUCT_ID: "test_starter_annual",
    CREEM_CANARY_TEST_GROWTH_ANNUAL_V2_PRODUCT_ID: "test_growth_annual",
    CREEM_CANARY_TEST_SCALE_ANNUAL_V2_PRODUCT_ID: "test_scale_annual",
  };
}

describe("E8.8R Phase C1 Test Canary billing contract", () => {
  it("fails closed unless both server flags, a verified allowlisted actor and every Test mapping are present", () => {
    const disabled = completeEnv();
    disabled.SECWYN_ADMIN_TEST_CHECKOUT_ENABLED = "false";
    expect(getTestCanaryCheckoutDecision(canaryActor, "growth", "monthly", disabled)).toMatchObject({
      kind: "denied",
      reason: "TEST_CHECKOUT_DISABLED",
    });

    const wrongCase = completeEnv();
    wrongCase.SECWYN_ADMIN_TEST_CHECKOUT_ENABLED = "TRUE";
    expect(getTestCanaryCheckoutDecision(canaryActor, "growth", "monthly", wrongCase)).toMatchObject({
      kind: "denied",
      reason: "TEST_CHECKOUT_DISABLED",
    });

    expect(getTestCanaryCheckoutDecision(nonCanaryActor, "growth", "monthly", completeEnv())).toMatchObject({
      kind: "denied",
      reason: "CANARY_ACTOR_REQUIRED",
    });

    const incomplete = completeEnv();
    delete incomplete.CREEM_CANARY_TEST_GROWTH_ANNUAL_V2_PRODUCT_ID;
    expect(getTestCanaryCheckoutDecision(canaryActor, "growth", "monthly", incomplete)).toMatchObject({
      kind: "denied",
      reason: "TEST_PRODUCT_MAPPING_INCOMPLETE",
    });
  });

  it("derives the Test Product and V2 amount only from the server catalog", () => {
    const decision = getTestCanaryCheckoutDecision(canaryActor, "growth", "yearly", completeEnv());
    expect(decision).toMatchObject({
      kind: "checkout",
      billingEnvironment: "test_canary",
      generation: "premium_v2",
      productId: "test_growth_annual",
      entry: { plan: "growth", interval: "yearly", priceUsd: 10989, monthlyCredits: 2500 },
    });
  });

  it("keeps Scale Annual contact-only even when its Test Product exists", () => {
    expect(getTestCanaryCheckoutDecision(canaryActor, "scale", "yearly", completeEnv())).toMatchObject({
      kind: "contact",
      reason: "SCALE_ANNUAL_CONTACT_ONLY",
    });
  });

  it("rejects duplicate or unknown Test Product identities", () => {
    const duplicate = completeEnv();
    duplicate.CREEM_CANARY_TEST_SCALE_MONTHLY_V2_PRODUCT_ID = "test_growth_monthly";
    expect(() => getTestCanaryProductMap(duplicate)).toThrow("DUPLICATE_TEST_CANARY_PRODUCT_MAPPING");

    const liveCollision = completeEnv();
    liveCollision.CREEM_GROWTH_PRODUCT_ID = liveCollision.CREEM_CANARY_TEST_GROWTH_MONTHLY_V2_PRODUCT_ID;
    expect(() => getTestCanaryProductMap(liveCollision)).toThrow("TEST_CANARY_LIVE_PRODUCT_COLLISION");

    expect(findTestCanaryProductById("unknown", completeEnv())).toBeNull();
    expect(findTestCanaryProductById("test_growth_monthly", completeEnv())).toMatchObject({
      plan: "growth",
      interval: "monthly",
      billingEnvironment: "test_canary",
    });
  });

  it("builds only server-owned Test Canary checkout metadata", () => {
    expect(buildTestCanaryCheckoutMetadata({
      actor: canaryActor,
      plan: "starter",
      interval: "monthly",
      correlationId: "canary-correlation-1",
    })).toEqual({
      billing_environment: "test_canary",
      catalog_generation: "premium_v2",
      user_id: canaryActor.userId,
      plan: "starter",
      billing_interval: "monthly",
      correlation_id: "canary-correlation-1",
    });
  });

  it("keeps the confirmed ordered SHA-256 Test redirect contract and rejects tampering", () => {
    const apiKey = "test-api-key";
    const unsigned = "request_id=req_1&subscription_id=sub_1&order_id=null&product_id=test_growth_monthly&checkout_id=ch_1";
    const signingString = "request_id=req_1|subscription_id=sub_1|product_id=test_growth_monthly|checkout_id=ch_1|salt=test-api-key";
    const signature = createHash("sha256").update(signingString).digest("hex");
    expect(verifyCreemRedirectSignature(`${unsigned}&signature=${signature}`, apiKey)).toBe(true);
    expect(verifyCreemRedirectSignature(`${unsigned.replace("ch_1", "ch_2")}&signature=${signature}`, apiKey)).toBe(false);
    expect(verifyCreemRedirectSignature(unsigned, apiKey)).toBe(false);
  });

  it("defines additive service-only Test Canary storage with environment-scoped idempotency", () => {
    const migrationName = readdirSync("supabase/migrations").find((name) =>
      name.endsWith("_e8_8r_test_canary_billing_isolation.sql"),
    );
    const migrationPath = migrationName ? `supabase/migrations/${migrationName}` : "";
    expect(existsSync(migrationPath)).toBe(true);
    const migration = readFileSync(migrationPath, "utf8");
    for (const table of [
      "test_canary_webhook_events",
      "test_canary_payments",
      "test_canary_subscriptions",
      "test_canary_credit_grants",
      "test_canary_referral_snapshots",
    ]) {
      expect(migration).toContain(`public.${table}`);
    }
    expect(migration).toContain("billing_environment text not null default 'test_canary'");
    expect(migration).toContain("check (billing_environment = 'test_canary')");
    expect(migration).toContain("process_test_canary_webhook_event");
    expect(migration).toContain("pg_advisory_xact_lock");
    expect(migration).toContain("revoke all");
    expect(migration).toContain("grant execute");
    expect(migration).not.toMatch(/alter table public\.(payments|subscriptions|credit_grants|referral_attributions)/);
  });

  it("keeps Test routes isolated from every Live table and secret", () => {
    const checkout = readFileSync("src/app/api/create-checkout/route.ts", "utf8");
    const webhook = readFileSync("src/app/api/payment/webhook/creem-test-canary/route.ts", "utf8");
    const redirect = readFileSync("src/app/api/payment/confirm-redirect/route.ts", "utf8");
    const portal = readFileSync("src/app/api/payment/customer-portal/test-canary/route.ts", "utf8");
    const liveWebhook = readFileSync("src/app/api/payment/webhook/route.ts", "utf8");
    const livePortal = readFileSync("src/app/api/payment/customer-portal/route.ts", "utf8");

    expect(checkout).toContain("getTestCanaryCheckoutDecision");
    expect(checkout.indexOf("const user = await getUserFromRequest(req)")).toBeLessThan(
      checkout.indexOf("if (!creemApiKey)"),
    );
    expect(checkout).not.toMatch(/body\.(?:price|amount|productId|product_id|billingEnvironment|billing_environment)/);
    expect(webhook).toContain("CREEM_CANARY_TEST_WEBHOOK_SECRET");
    expect(webhook).not.toContain("CREEM_WEBHOOK_SECRET");
    expect(webhook).not.toMatch(/\.from\(["'](?:payments|subscriptions|credit_grants|referral_attributions|profiles)["']\)/);
    expect(redirect).toContain("CREEM_CANARY_TEST_API_KEY");
    expect(portal).toContain("CREEM_CANARY_TEST_API_KEY");
    expect(portal).not.toContain("CREEM_API_KEY");
    expect(portal).toContain('.from("test_canary_subscriptions")');
    expect(portal).toContain('.eq("billing_environment", "test_canary")');
    expect(liveWebhook).not.toContain("test_canary");
    expect(liveWebhook).not.toContain("CREEM_CANARY_TEST_");
    expect(livePortal).not.toContain("test_canary");
    expect(livePortal).not.toContain("CREEM_CANARY_TEST_");
    expect(redirect).not.toMatch(/billingEnvironment:\s*"test_canary"[\s\S]*?(?:credit|referral|grant)/i);
  });

  it("keeps every Test evidence write out of Live balances, entitlements and referral maturity", () => {
    const migrationName = readdirSync("supabase/migrations").find((name) =>
      name.endsWith("_e8_8r_test_canary_billing_isolation.sql"),
    );
    const migration = readFileSync(`supabase/migrations/${migrationName}`, "utf8");
    expect(migration).not.toMatch(/(?:insert into|update|delete from)\s+public\.(?:payments|subscriptions|credit_grants|referral_attributions|profiles)\b/i);
    expect(migration).toContain("status text not null default 'evidence_only'");
    expect(migration).toContain("status text not null default 'planned_only'");
    expect(migration).toContain("reward_credits in (50,250,1000)");
    expect(migration).toContain("on conflict (billing_environment,provider_subscription_id,service_month_start) do nothing");
    expect(migration).toContain("on conflict (billing_environment,payment_id) do nothing");
  });

  it("keeps the browser success page from reading Live billing rows after a Test Canary redirect", () => {
    const successPage = readFileSync("src/app/(dashboard)/dashboard/billing/success/page.tsx", "utf8");
    expect(successPage).toContain('billingEnvironment === "test_canary"');
    expect(successPage).toContain("Test checkout received");
    expect(successPage).toMatch(/billingEnvironment === "test_canary"[\s\S]*?return;/);
  });

  it("documents only fail-closed Test Canary variable names and defaults", () => {
    const envExample = readFileSync(".env.example", "utf8");
    expect(envExample).toContain("SECWYN_ADMIN_TEST_CHECKOUT_ENABLED=false");
    expect(envExample).toContain("CREEM_CANARY_TEST_API_KEY=");
    expect(envExample).toContain("CREEM_CANARY_TEST_WEBHOOK_SECRET=");
    expect(envExample).toContain("CREEM_CANARY_TEST_STARTER_MONTHLY_V2_PRODUCT_ID=");
    expect(envExample).toContain("CREEM_CANARY_TEST_SCALE_ANNUAL_V2_PRODUCT_ID=");
  });
});
