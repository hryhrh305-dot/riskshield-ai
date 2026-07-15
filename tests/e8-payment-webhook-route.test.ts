import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createHmac } from "node:crypto";

const state = vi.hoisted(() => ({
  observability: false,
  coreFailure: false,
  scheduled: [] as Array<() => Promise<void>>,
  recordSubscriptionEvent: vi.fn(),
  grantSubscriptionCycle: vi.fn(),
  revokeSubscriptionTransactionCredits: vi.fn(),
  markReferralFirstPayment: vi.fn(),
}));

vi.mock("next/server", () => ({
  after: (callback: () => Promise<void>) => { state.scheduled.push(callback); },
  NextResponse: {
    json: (body: unknown, init?: ResponseInit) => new Response(JSON.stringify(body), {
      ...init,
      headers: { "content-type": "application/json", ...(init?.headers || {}) },
    }),
  },
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    from: () => {
      const result = () => state.coreFailure
        ? { data: null, error: new Error("core database failure") }
        : { data: null, error: null };
      const chain: Record<string, unknown> = {};
      for (const method of ["select", "eq", "neq", "is", "in", "gte", "lte", "order", "limit"]) {
        chain[method] = () => chain;
      }
      for (const method of ["insert", "update", "upsert", "delete"]) {
        chain[method] = () => chain;
      }
      chain.maybeSingle = async () => result();
      chain.single = async () => result();
      chain.then = (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) => Promise.resolve(result()).then(resolve, reject);
      return chain;
    },
  }),
}));

vi.mock("@/lib/creem", () => ({
  findCreemProductById: () => null,
  findPlanByCreemProductId: () => null,
  getCreemApiBaseUrl: () => "https://api.creem.test/v1",
  verifyCreemWebhookSignature: (payload: string, signature: string, secret: string) => {
    const expected = createHmac("sha256", secret).update(payload, "utf8").digest("hex");
    return signature === expected;
  },
}));

vi.mock("@/lib/creem-webhook", () => ({
  BILLING_REVOKE_EVENTS: ["refund.created", "dispute.created"],
  CREEM_HANDLED_EVENT_TYPES: ["subscription.paid", "subscription.canceled", "refund.created"],
  extractCustomerId: (event: { object?: { customer_id?: string } }) => event.object?.customer_id || null,
  extractEventType: (event: { eventType?: string; event_type?: string }) => event.eventType || event.event_type || "unknown",
  classifyCreemRefund: (event: { object?: Record<string, unknown> }) => {
    const object = event.object || {};
    return { kind: object.refund_kind || "unverified", refundId: object.id || null,
      transactionId: object.transaction_id || null };
  },
  extractPaymentIdentifiers: (event: { object?: Record<string, unknown> }) => ({
    transactionId: event.object?.transaction_id || null,
    subscriptionId: event.object?.subscription_id || null,
  }),
  getBillingLookupCandidates: () => [],
}));

vi.mock("@/lib/referral-rewards", () => ({ markReferralFirstPayment: state.markReferralFirstPayment }));
vi.mock("@/lib/subscription-credits", () => ({
  grantSubscriptionCycle: state.grantSubscriptionCycle,
  revokeSubscriptionTransactionCredits: state.revokeSubscriptionTransactionCredits,
}));
vi.mock("@/lib/e8/flags", () => ({ getE8Flags: () => ({ observability: state.observability }) }));
vi.mock("@/lib/e8/repository", () => ({ recordSubscriptionEvent: state.recordSubscriptionEvent }));

type WebhookPost = (request: Request) => Promise<Response>;
let post: WebhookPost;
const secret = "webhook-test-secret";

function requestFor(event: Record<string, unknown>, signature?: string) {
  const payload = JSON.stringify(event);
  const validSignature = createHmac("sha256", secret).update(payload, "utf8").digest("hex");
  return new Request("https://www.secwyn.com/api/payment/webhook", {
    method: "POST",
    headers: { "creem-signature": signature ?? validSignature },
    body: payload,
  });
}

beforeAll(async () => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
  process.env.SUPABASE_SECRET_KEY = "test-service-role-key";
  process.env.CREEM_WEBHOOK_SECRET = secret;
  vi.resetModules();
  ({ POST: post } = await import("../src/app/api/payment/webhook/route"));
});

beforeEach(() => {
  state.observability = false;
  state.coreFailure = false;
  state.scheduled.length = 0;
  state.recordSubscriptionEvent.mockReset();
  state.grantSubscriptionCycle.mockReset();
  state.revokeSubscriptionTransactionCredits.mockReset();
  state.markReferralFirstPayment.mockReset();
});

describe("E8 payment webhook route contract", () => {
  it("keeps the flag-off success contract unchanged", async () => {
    const response = await post(requestFor({ eventType: "unknown", object: {} }));
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ received: true });
    expect(state.scheduled).toHaveLength(0);
    expect(state.recordSubscriptionEvent).not.toHaveBeenCalled();
  });

  it("preserves the invalid-signature 401 contract", async () => {
    const response = await post(requestFor({ eventType: "unknown", object: {} }, "invalid"));
    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "Invalid signature" });
    expect(state.scheduled).toHaveLength(0);
  });

  it("returns the core 200 even when the enabled E8 sidecar fails", async () => {
    state.observability = true;
    state.recordSubscriptionEvent.mockRejectedValueOnce(new Error("E8 unavailable"));
    const response = await post(requestFor({ eventType: "unknown", object: {} }));
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ received: true });
    expect(state.scheduled).toHaveLength(1);
    await expect(state.scheduled[0]()).resolves.toBeUndefined();
    expect(state.recordSubscriptionEvent).toHaveBeenCalledTimes(1);
    expect(state.grantSubscriptionCycle).not.toHaveBeenCalled();
    expect(state.revokeSubscriptionTransactionCredits).not.toHaveBeenCalled();
    expect(state.markReferralFirstPayment).not.toHaveBeenCalled();
  });

  it("preserves the core 500 contract and never schedules E8 after a core failure", async () => {
    state.observability = true;
    state.coreFailure = true;
    const response = await post(requestFor({ eventType: "subscription.active", object: { id: "sub-failure" } }));
    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({ error: "Webhook failed" });
    expect(state.scheduled).toHaveLength(0);
    expect(state.recordSubscriptionEvent).not.toHaveBeenCalled();
  });

  it("keeps representative out-of-order, duplicate, refund and cancel core branches callable", async () => {
    const fixtures = [
      { eventType: "subscription.paid", id: "renewal-first", object: { id: "sub-1", current_period_start_date: "2026-02-01T00:00:00Z" } },
      { eventType: "subscription.paid", id: "first-later", object: { id: "sub-1", current_period_start_date: "2026-01-01T00:00:00Z" } },
      { eventType: "subscription.paid", id: "renewal-first", object: { id: "sub-1", current_period_start_date: "2026-02-01T00:00:00Z" } },
      { eventType: "refund.created", id: "refund-partial", object: { refund_kind: "partial" } },
      { eventType: "subscription.canceled", id: "cancel-unmatched", object: { id: "sub-2" } },
    ];
    for (const fixture of fixtures) {
      const response = await post(requestFor(fixture));
      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toEqual({ received: true });
    }
    expect(state.grantSubscriptionCycle).not.toHaveBeenCalled();
    expect(state.revokeSubscriptionTransactionCredits).not.toHaveBeenCalled();
    expect(state.markReferralFirstPayment).not.toHaveBeenCalled();
  });
});
