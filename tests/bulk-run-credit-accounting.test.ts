import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { consumeContactCredits } from "@/lib/credit-accounting";
import { sortCreditGrantsForConsumption, type CreditGrant } from "@/lib/credits-ledger";

describe("atomic credit accounting adapter", () => {
  it.each([0, 1, 3])("reconciles an exact %i-credit request", async (amount) => {
    const rpc = vi.fn().mockResolvedValue({ data: { deducted: amount, remaining: 50 - amount }, error: null });
    const result = await consumeContactCredits({
      supabase: { rpc } as never,
      userId: "user-credit-matrix",
      amount,
      reason: "web_bulk_audit",
      requestId: `matrix-${amount}`,
      requestFingerprint: { emails: Array.from({ length: amount }, (_, index) => `person${index}@example.com`) },
    });
    expect(result).toMatchObject({ ok: true, deducted: amount });
    expect(rpc).toHaveBeenCalledTimes(amount === 0 ? 0 : 1);
  });

  it("fails closed without deduction when credits are insufficient", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: { message: "INSUFFICIENT_CREDITS" } });
    await expect(consumeContactCredits({
      supabase: { rpc } as never,
      userId: "user-insufficient",
      amount: 3,
      reason: "api_audit",
      requestId: "insufficient-3",
      requestFingerprint: { emails: ["a@example.com", "b@example.com", "c@example.com"] },
    })).resolves.toMatchObject({ ok: false, deducted: 0, error: "INSUFFICIENT_CREDITS" });
  });
  it("deducts multiple credits with one idempotent RPC", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: { deducted: 5, remaining: 45 }, error: null });
    const result = await consumeContactCredits({
      supabase: { rpc } as never,
      userId: "user-1",
      amount: 5,
      reason: "sheets_audit",
      requestId: "request-1",
      requestFingerprint: { emails: ["a@example.com"] },
    });
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith("consume_grant_credits", expect.objectContaining({
      p_user_id: "user-1",
      p_amount: 5,
      p_idempotency_key: "request-1",
    }));
    expect(result).toEqual(expect.objectContaining({ ok: true, deducted: 5, creditsRemaining: 45 }));
  });

  it("spends expiring referral credits before subscription credits", () => {
    const base = { userId: "user-1", creditType: "contact_audit", grantedAmount: 10,
      remainingAmount: 10, status: "active", startsAt: "2026-01-01T00:00:00.000Z" } as const;
    const grants: CreditGrant[] = [
      { ...base, id: "subscription", sourceType: "subscription", expiresAt: "2026-08-01T00:00:00.000Z" },
      { ...base, id: "referral-late", sourceType: "referral_bonus", expiresAt: "2026-09-01T00:00:00.000Z" },
      { ...base, id: "referral-early", sourceType: "referral_bonus", expiresAt: "2026-07-20T00:00:00.000Z" },
    ];
    expect(sortCreditGrantsForConsumption(grants, new Date("2026-07-13T00:00:00.000Z")).map((grant) => grant.id))
      .toEqual(["referral-early", "referral-late", "subscription"]);
  });

  it("binds an idempotency key to the audited payload and fails closed on malformed RPC data", async () => {
    const rpc = vi.fn()
      .mockResolvedValueOnce({ data: { deducted: 1, remaining: 49 }, error: null })
      .mockResolvedValueOnce({ data: { deducted: 1, remaining: 48 }, error: null })
      .mockResolvedValueOnce({ data: null, error: null });
    const base = { supabase: { rpc } as never, userId: "user-1", amount: 1,
      reason: "api_audit" as const, requestId: "same-key" };
    await consumeContactCredits({ ...base, requestFingerprint: { email: "a@example.com" } });
    await consumeContactCredits({ ...base, requestFingerprint: { email: "b@example.com" } });
    const firstFingerprint = rpc.mock.calls[0][1].p_fingerprint;
    const secondFingerprint = rpc.mock.calls[1][1].p_fingerprint;
    expect(firstFingerprint).not.toBe(secondFingerprint);
    await expect(consumeContactCredits({ ...base, requestId: "malformed", requestFingerprint: { email: "c@example.com" } }))
      .resolves.toEqual(expect.objectContaining({ ok: false, error: "CONSUME_CREDIT_RPC_FAILED" }));
  });

  it("removes the partial-deduction loop and requires request ids at every route", () => {
    const legacy = readFileSync("src/lib/legacy-credits.ts", "utf8");
    const accounting = readFileSync("src/lib/credit-accounting.ts", "utf8");
    expect(accounting).toContain('rpc("consume_grant_credits"');
    expect(legacy).not.toContain("for (let i = 0; i < safeRequiredCredits; i += 1)");
    for (const path of [
      "src/app/api/web-risk/route.ts",
      "src/app/api/bulk-check/route.ts",
      "src/app/api/v1/email/batch-check/route.ts",
      "src/app/api/v1/email/check/route.ts",
      "src/app/api/v1/ip/check/route.ts",
      "src/app/api/v1/risk/check/route.ts",
      "src/app/api/v1/pre-send/check/route.ts",
    ]) expect(readFileSync(path, "utf8")).toContain("requestId:");
    const sheets = readFileSync("google-sheets-addon/Code.gs", "utf8");
    expect(sheets).toContain('"Idempotency-Key": scanRequestId + ":" + absoluteBatchIndex');
    expect(sheets).toContain("PropertiesService.getDocumentProperties()");
    expect(sheets).toContain("completePendingScan_(pendingScan)");
  });
});
