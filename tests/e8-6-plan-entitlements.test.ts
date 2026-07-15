import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  getPlanEntitlements,
  resolveEffectivePlan,
  type EntitlementProfile,
} from "@/lib/plan-entitlements";

function profile(plan: EntitlementProfile["plan"], status = "active", subscriptionEnd: string | null = null): EntitlementProfile {
  return { plan, subscriptionStatus: status, subscriptionEnd };
}

describe("E8.6 plan entitlement matrix", () => {
  it("denies every protected capability to anonymous users", () => {
    expect(getPlanEntitlements({ ...profile("growth"), authenticated: false })).toMatchObject({
      singleWebCheck: false,
      bulkWebAudit: false,
      basicReport: false,
      basicExport: false,
      apiAccess: false,
      googleSheets: false,
    });
  });

  it.each([
    ["free", false, false, false],
    ["starter", true, false, false],
    ["growth", true, true, true],
    ["scale", true, true, true],
    ["business", true, true, true],
  ] as const)("enforces the %s plan matrix", (plan, bulk, api, sheets) => {
    expect(getPlanEntitlements(profile(plan))).toMatchObject({
      singleWebCheck: true,
      bulkWebAudit: bulk,
      apiAccess: api,
      googleSheets: sheets,
      basicReport: bulk,
      basicExport: bulk,
      clientReadyReport: api,
      campaignReadiness: api,
      listAcceptance: api,
    });
  });

  it("does not let top-up balances unlock plan features", () => {
    expect(getPlanEntitlements({ ...profile("free"), hasTopUpCredits: true })).toMatchObject({ apiAccess: false, googleSheets: false, bulkWebAudit: false });
    expect(getPlanEntitlements({ ...profile("starter"), hasTopUpCredits: true })).toMatchObject({ apiAccess: false, googleSheets: false, bulkWebAudit: true });
  });

  it("removes paid entitlements for inactive, expired, past_due and paused subscriptions", () => {
    for (const status of ["inactive", "expired", "past_due", "paused"]) {
      expect(resolveEffectivePlan(profile("scale", status))).toBe("free");
    }
  });

  it("keeps cancelled access only through the paid period end", () => {
    expect(resolveEffectivePlan(profile("growth", "cancelled", "2999-01-01T00:00:00.000Z"))).toBe("growth");
    expect(resolveEffectivePlan(profile("growth", "cancelled", "2000-01-01T00:00:00.000Z"))).toBe("free");
  });

  it("requires API and Sheets authorization before the credit consumer is reached", () => {
    for (const routePath of [
      "src/app/api/v1/email/batch-check/route.ts",
      "src/app/api/v1/email/check/route.ts",
      "src/app/api/v1/risk/check/route.ts",
    ]) {
      const route = readFileSync(routePath, "utf8");
      expect(route.indexOf("getPlanEntitlements")).toBeGreaterThanOrEqual(0);
      expect(route.indexOf("getPlanEntitlements")).toBeLessThan(route.indexOf("const legacyCreditResult = await consumeLegacyCredits"));
    }
    const batch = readFileSync("src/app/api/v1/email/batch-check/route.ts", "utf8");
    expect(batch.indexOf("if (!entitlements.apiAccess)")).toBeLessThan(batch.indexOf("const legacyCreditResult = await consumeLegacyCredits"));
  });

  it("downgrades every inactive paid API subscription before legacy plan access is evaluated", () => {
    const costControl = readFileSync("src/lib/cost-control.ts", "utf8");
    expect(costControl).toContain("!hasActiveSubscriptionAccess(profile.subscription_status, profile.subscription_end)");
    expect(costControl.indexOf("!hasActiveSubscriptionAccess(profile.subscription_status, profile.subscription_end)")).toBeLessThan(costControl.indexOf("const planKey = profile.plan || \"free\""));
  });

  it("enforces Starter+ bulk access before credit consumption", () => {
    const route = readFileSync("src/app/api/bulk-check/route.ts", "utf8");
    expect(route).toContain("getPlanEntitlements");
    expect(route.indexOf("if (!entitlements.bulkWebAudit)")).toBeLessThan(route.indexOf("const legacyCreditResult = await consumeLegacyCredits"));
  });

  it("keeps API-key creation aligned with the same client-side contract", () => {
    const dashboard = readFileSync("src/app/(dashboard)/dashboard/page.tsx", "utf8");
    expect(dashboard).toContain("getPlanEntitlements");
    expect(dashboard).toContain("entitlements.apiAccess");
  });

  it("keeps client-ready report packaging on Growth and above", () => {
    const bulk = readFileSync("src/app/(dashboard)/bulk-check/page.tsx", "utf8");
    expect(bulk).toContain('const hasClientReadyReport = ["growth", "scale", "business"]');
    expect(bulk).toContain("auditSummary && hasClientReadyReport");
    expect(bulk).toContain("Basic List Audit Summary");
  });
});
