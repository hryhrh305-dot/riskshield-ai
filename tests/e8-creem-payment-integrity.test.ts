import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Creem payment integrity migration contract", () => {
  it("links subscription grants to provider transactions and reverses one exact grant", () => {
    const files = readdirSync("supabase/migrations").filter((name) => name.includes("creem_payment_integrity"));
    expect(files).toHaveLength(1);
    const sql = readFileSync(`supabase/migrations/${files[0]}`, "utf8").toLowerCase();

    expect(sql).toContain("provider_transaction_id");
    expect(sql).toContain("reversal_ref");
    expect(sql).toContain("grant_subscription_cycle_credits");
    expect(sql).toContain("revoke_subscription_transaction_credits");
    expect(sql).toContain("replacedremaining");
    expect(sql).toContain("replacedbytransactionid");
    expect(sql).toContain("remaining_amount = 0");
    expect(sql).toContain("greatest(0");
    expect(sql).toContain("billing_period_start");
    expect(sql).toMatch(/from public,\s*anon,\s*authenticated/);
    expect(sql).toContain("to service_role");
  });

  it("does not confuse checkout order ids with transaction ids", () => {
    const webhook = readFileSync("src/app/api/payment/webhook/route.ts", "utf8");
    expect(webhook).not.toContain("provider_transaction_id: orderId");
    expect(webhook).toContain("provider_transaction_id: params.transactionId");
    const credits = readFileSync("src/lib/subscription-credits.ts", "utf8");
    expect(credits).toContain("p_provider_transaction_id");
    const reconciliation = readFileSync("src/lib/credit-reconciliation.ts", "utf8");
    expect(reconciliation).toContain("provider_transaction_id");
    expect(reconciliation).toContain("providerTransactionId:payment.provider_transaction_id");
    expect(webhook).toContain("revokeSubscriptionTransactionCredits");
  });

  it("keeps partial refunds separate from full access revocation", () => {
    const webhook = readFileSync("src/app/api/payment/webhook/route.ts", "utf8");
    expect(webhook).toContain("classifyCreemRefund(event)");
    expect(webhook).toContain('refund.kind === "partial"');
    expect(webhook).not.toContain("await revokePaidAccessForBillingIssue");
  });
});
