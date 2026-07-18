import { describe, expect, it } from "vitest";
import { parseTestCanaryWebhookPayload } from "@/lib/test-canary-webhook-payload";

const metadata = {
  billing_environment: "test_canary",
  catalog_generation: "premium_v2",
  user_id: "11111111-1111-4111-8111-111111111111",
  plan: "growth",
  billing_interval: "monthly",
  correlation_id: "synthetic-correlation",
};

describe("Creem Test Canary documented webhook payload normalization", () => {
  it("uses checkout.completed object.id as the checkout identifier", () => {
    const parsed = parseTestCanaryWebhookPayload({
      id: "synthetic-event-checkout",
      eventType: "checkout.completed",
      object: {
        id: "synthetic-checkout",
        mode: "test",
        order: {
          product: "synthetic-test-product",
          amount: 99900,
          currency: "USD",
        },
        metadata,
      },
    });

    expect(parsed.checkoutId).toBe("synthetic-checkout");
    expect(parsed.productId).toBe("synthetic-test-product");
    expect(parsed.amount).toBe(999);
    expect(parsed.metadata).toEqual(metadata);
  });

  it("uses subscription.paid documented subscription, transaction and Product price fields", () => {
    const parsed = parseTestCanaryWebhookPayload({
      id: "synthetic-event-paid",
      eventType: "subscription.paid",
      object: {
        id: "synthetic-subscription",
        last_transaction_id: "synthetic-transaction",
        current_period_start_date: "2026-07-18T00:00:00Z",
        current_period_end_date: "2026-08-18T00:00:00Z",
        product: {
          id: "synthetic-test-product",
          price: 99900,
          currency: "USD",
        },
        customer: { id: "synthetic-customer" },
        metadata,
      },
    });

    expect(parsed.subscriptionId).toBe("synthetic-subscription");
    expect(parsed.transactionId).toBe("synthetic-transaction");
    expect(parsed.customerId).toBe("synthetic-customer");
    expect(parsed.amount).toBe(999);
    expect(parsed.periodStart).toBe("2026-07-18T00:00:00Z");
    expect(parsed.periodEnd).toBe("2026-08-18T00:00:00Z");
  });
});
