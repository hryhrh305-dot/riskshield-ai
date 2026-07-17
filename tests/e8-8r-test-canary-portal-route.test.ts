import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  user: { id: "11111111-1111-4111-8111-111111111111", email: "canary@example.com" } as { id: string; email: string } | null,
  canaryEnabled: true,
  customerId: "customer_test" as string | null,
}));

vi.mock("next/server", () => ({
  NextResponse: {
    json: (body: unknown, init?: ResponseInit) => new Response(JSON.stringify(body), {
      ...init,
      headers: { "content-type": "application/json", ...(init?.headers || {}) },
    }),
  },
}));

vi.mock("@/lib/admin-v2-canary", () => ({
  getAdminV2CanaryDecision: () => ({ enabled: state.canaryEnabled }),
}));

vi.mock("@/lib/supabase-server", () => ({
  createServerSupabaseClient: async () => ({
    auth: { getUser: async () => ({ data: { user: state.user }, error: state.user ? null : new Error("signed out") }) },
  }),
}));

vi.mock("@/lib/supabase/admin", () => ({
  getSupabaseAdminClient: () => ({
    from: (table: string) => {
      if (table !== "test_canary_subscriptions") throw new Error("unexpected table");
      const chain: Record<string, unknown> = {};
      for (const method of ["select", "eq", "order", "limit"]) chain[method] = () => chain;
      chain.maybeSingle = async () => ({
        data: state.customerId ? { provider_customer_id: state.customerId } : null,
        error: null,
      });
      return chain;
    },
  }),
}));

vi.mock("@/lib/test-canary-billing", () => ({
  TEST_CANARY_API_BASE_URL: "https://test-api.creem.io/v1",
}));

type PortalPost = () => Promise<Response>;
let post: PortalPost;
const fetchMock = vi.fn();

beforeAll(async () => {
  process.env.CREEM_CANARY_TEST_API_KEY = "test-api-key";
  vi.stubGlobal("fetch", fetchMock);
  vi.resetModules();
  ({ POST: post } = await import("../src/app/api/payment/customer-portal/test-canary/route"));
});
beforeEach(() => {
  state.user = { id: "11111111-1111-4111-8111-111111111111", email: "canary@example.com" };
  state.canaryEnabled = true;
  state.customerId = "customer_test";
  fetchMock.mockReset().mockResolvedValue(new Response(JSON.stringify({ customer_portal_link: "https://test.creem.io/portal" }), {
    status: 200,
    headers: { "content-type": "application/json" },
  }));
});

describe("E8.8R Test Canary Portal route", () => {
  it("requires a server-authenticated user", async () => {
    state.user = null;
    const response = await post();
    expect(response.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("requires the server-side Canary allowlist", async () => {
    state.canaryEnabled = false;
    const response = await post();
    expect(response.status).toBe(403);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("fails closed when no stored Test subscription establishes the environment", async () => {
    state.customerId = null;
    const response = await post();
    expect(response.status).toBe(404);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("uses only the fixed Test API host and Test key for a stored Test customer", async () => {
    const response = await post();
    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledWith("https://test-api.creem.io/v1/customers/billing", expect.objectContaining({
      method: "POST",
      headers: expect.objectContaining({ "x-api-key": "test-api-key" }),
      body: JSON.stringify({ customer_id: "customer_test" }),
    }));
  });
});
