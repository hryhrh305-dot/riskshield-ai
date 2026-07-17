import { createHmac } from "node:crypto";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  signatureValid: true,
  canaryEnabled: true,
  productKnown: true,
  rpc: vi.fn(),
  from: vi.fn(),
}));

vi.mock("next/server", () => ({
  NextResponse: {
    json: (body: unknown, init?: ResponseInit) => new Response(JSON.stringify(body), {
      ...init,
      headers: { "content-type": "application/json", ...(init?.headers || {}) },
    }),
  },
}));

vi.mock("@/lib/creem", () => ({
  verifyCreemWebhookSignature: () => state.signatureValid,
}));

vi.mock("@/lib/creem-webhook", () => ({
  extractEventType: (event: { eventType?: string }) => event.eventType || "unknown",
  extractPaymentIdentifiers: () => ({
    checkoutId: "checkout_test",
    transactionId: "transaction_test",
    subscriptionId: "subscription_test",
    customerId: "customer_test",
  }),
}));

vi.mock("@/lib/admin-v2-canary", () => ({
  getAdminV2CanaryDecision: () => ({ enabled: state.canaryEnabled }),
}));

vi.mock("@/lib/test-canary-billing", () => ({
  findTestCanaryProductById: () => state.productKnown ? ({
    productId: "product_test",
    plan: "growth",
    interval: "monthly",
    entry: { monthlyCredits: 2500 },
  }) : null,
}));

vi.mock("@/lib/supabase/admin", () => ({
  getSupabaseAdminClient: () => ({
    auth: { admin: { getUserById: async () => ({ data: { user: { email: "canary@example.com" } }, error: null }) } },
    rpc: state.rpc,
    from: state.from,
  }),
}));

type WebhookPost = (request: Request) => Promise<Response>;
let post: WebhookPost;

function testEvent() {
  return {
    id: "event_test",
    eventType: "subscription.paid",
    object: {
      product: { id: "product_test", currency: "USD" },
      amount_paid: 99900,
      current_period_start_date: "2026-07-17T00:00:00Z",
      current_period_end_date: "2026-08-17T00:00:00Z",
      metadata: {
        billing_environment: "test_canary",
        catalog_generation: "premium_v2",
        user_id: "11111111-1111-4111-8111-111111111111",
        plan: "growth",
        billing_interval: "monthly",
        correlation_id: "correlation_test",
      },
    },
  };
}

function requestFor(event: Record<string, unknown>) {
  const payload = JSON.stringify(event);
  const signature = createHmac("sha256", "test-webhook-secret").update(payload).digest("hex");
  return new Request("https://www.secwyn.com/api/payment/webhook/creem-test-canary", {
    method: "POST",
    headers: { "creem-signature": signature },
    body: payload,
  });
}

beforeAll(async () => {
  process.env.CREEM_CANARY_TEST_WEBHOOK_SECRET = "test-webhook-secret";
  vi.resetModules();
  ({ POST: post } = await import("../src/app/api/payment/webhook/creem-test-canary/route") as unknown as { POST: WebhookPost });
});

beforeEach(() => {
  state.signatureValid = true;
  state.canaryEnabled = true;
  state.productKnown = true;
  state.rpc.mockReset().mockResolvedValue({ data: { replayed: false, granted: 1 }, error: null });
  state.from.mockReset();
});

describe("E8.8R Test Canary webhook route", () => {
  it("fails closed on invalid HMAC before any database call", async () => {
    state.signatureValid = false;
    const response = await post(requestFor(testEvent()));
    expect(response.status).toBe(401);
    expect(state.rpc).not.toHaveBeenCalled();
    expect(state.from).not.toHaveBeenCalled();
  });

  it("rejects a Product that is not in the dedicated Test mapping", async () => {
    state.productKnown = false;
    const response = await post(requestFor(testEvent()));
    expect(response.status).toBe(400);
    expect(state.rpc).not.toHaveBeenCalled();
  });

  it("rejects a user outside the server-verified Canary allowlist", async () => {
    state.canaryEnabled = false;
    const response = await post(requestFor(testEvent()));
    expect(response.status).toBe(403);
    expect(state.rpc).not.toHaveBeenCalled();
  });

  it("sends a valid event only to the isolated idempotent RPC", async () => {
    const response = await post(requestFor(testEvent()));
    expect(response.status).toBe(200);
    expect(state.rpc).toHaveBeenCalledTimes(1);
    expect(state.rpc).toHaveBeenCalledWith("process_test_canary_webhook_event", expect.objectContaining({
      p_event_id: "event_test",
      p_user_id: "11111111-1111-4111-8111-111111111111",
      p_product_id: "product_test",
      p_plan: "growth",
      p_billing_interval: "monthly",
      p_monthly_credits: 2500,
    }));
    expect(state.from).not.toHaveBeenCalled();
  });
});
