import { describe, expect, it, vi } from "vitest";
import {
  grantSubscriptionCycle,
  revokeSubscriptionTransactionCredits,
} from "@/lib/subscription-credits";

describe("Creem transaction-linked credit RPC contract", () => {
  it("requires and forwards the provider transaction on subscription grants", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: { granted: 500 }, error: null });
    const base = {
      supabase: { rpc }, userId: "user-1", subscriptionId: "sub-1", plan: "starter",
      anchor: "2026-07-15T00:00:00.000Z", at: "2026-08-15T00:00:00.000Z",
      paidThrough: "2027-07-15T00:00:00.000Z",
    };
    await expect(grantSubscriptionCycle({ ...base, providerTransactionId: "txn-annual-1" }))
      .resolves.toEqual({ granted: 500 });
    expect(rpc).toHaveBeenCalledWith("grant_subscription_cycle_credits", expect.objectContaining({
      p_provider_transaction_id: "txn-annual-1",
      p_subscription_ref: "sub-1",
      p_amount: 500,
    }));
    await expect(grantSubscriptionCycle({ ...base, providerTransactionId: "" }))
      .rejects.toThrow("SUBSCRIPTION_PAYMENT_TRANSACTION_REQUIRED");
  });

  it("forwards exact transaction and refund references to the reversal RPC", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: { replayed: false, revoked: 321 }, error: null });
    await expect(revokeSubscriptionTransactionCredits({
      supabase: { rpc }, userId: "user-1", subscriptionId: "sub-1",
      providerTransactionId: "txn-1", reversalRef: "refund-1", reason: "refund",
      terminalStatus: "cancelled",
    })).resolves.toEqual({ replayed: false, revoked: 321 });
    expect(rpc).toHaveBeenCalledWith("revoke_subscription_transaction_credits", {
      p_user_id: "user-1",
      p_subscription_ref: "sub-1",
      p_provider_transaction_id: "txn-1",
      p_refund_ref: "refund-1",
      p_reason: "refund",
      p_terminal_status: "cancelled",
    });
  });
});
