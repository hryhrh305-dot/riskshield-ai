import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { getBillingCatalogEntry } from "@/lib/billing-catalog";
import { publicDecisionLabel } from "@/lib/decision-integrity";
import { getPlanEntitlements } from "@/lib/plan-entitlements";

const home = readFileSync("src/components/home/HomePageClient.tsx", "utf8");
const pricing = readFileSync("src/app/(dashboard)/pricing/page.tsx", "utf8");
const docs = readFileSync("src/app/docs/page.tsx", "utf8");

describe("E8.8R Phase B.5 public copy truth", () => {
  it("keeps plan names visible while scrolling the detailed comparison", () => {
    expect(pricing).toContain('className="rs-pricing-comparison-head sticky top-0 z-30"');
    expect(pricing).toContain('className="overflow-x-auto min-[1100px]:overflow-visible"');
  });

  it("describes the free allowance as one-time checks without implying a list audit", () => {
    expect(home).toContain("Start with 50 Free Checks");
    expect(home).toContain("50 one-time checks");
    expect(home).not.toMatch(/Audit 50 Contacts Free|50 free audits|50 monthly audits|free report|30 samples/i);
    expect(home).not.toMatch(/Signup and form-abuse teams|future direction/i);
  });

  it("uses customer-facing decision labels while preserving internal decision inputs", () => {
    expect(publicDecisionLabel("ALLOW")).toBe("SEND");
    expect(publicDecisionLabel("REVIEW")).toBe("REVIEW");
    expect(publicDecisionLabel("BLOCK")).toBe("SUPPRESS");
    expect(docs).toContain('"audit_queue": "suppress"');
    expect(docs).not.toContain('"ai_reason"');
  });

  it("removes unsupported roadmap claims from the current entitlement table", () => {
    expect(pricing).not.toMatch(/Coming soon|Campaign reporting dashboard|Team workspace and member roles|Priority processing queue|White-label reporting/);
    expect(pricing).not.toContain("Less than the cost of one wasted campaign launch.");
    expect(pricing).toContain("This table lists capabilities that are available now");
    expect(pricing).toContain('label: "Daily contact processing limit"');
    expect(pricing).not.toContain('label: "Audit runs per day"');
  });
});

describe("E8.8R Phase B.5 pricing entitlement truth", () => {
  it("keeps Legacy and Premium V2 pricing generations distinct", () => {
    expect(getBillingCatalogEntry("legacy", "scale", "monthly")).toMatchObject({
      priceUsd: 1499,
      monthlyCredits: 15000,
      referralRewardCredits: 1500,
    });
    expect(getBillingCatalogEntry("premium_v2", "scale", "monthly")).toMatchObject({
      priceUsd: 3999,
      monthlyCredits: 10000,
      referralRewardCredits: 1000,
    });
    expect(pricing).toContain("publicCatalog.plans[key].monthlyCredits");
    expect(pricing).toContain("catalogPlan.monthlyCredits");
  });

  it("does not call Starter detection Deep", () => {
    expect(pricing).toContain('starter: included("Standard")');
    expect(pricing).not.toContain('starter: included("Deep")');
    expect(pricing).toContain('growth: included("Extended")');
  });

  it("gates API and Google Sheets at Growth and above", () => {
    const active = { subscriptionStatus: "active", subscriptionEnd: "2099-01-01T00:00:00.000Z" };
    expect(getPlanEntitlements({ plan: "free" })).toMatchObject({ apiAccess: false, googleSheets: false });
    expect(getPlanEntitlements({ plan: "starter", ...active })).toMatchObject({ apiAccess: false, googleSheets: false });
    expect(getPlanEntitlements({ plan: "growth", ...active })).toMatchObject({ apiAccess: true, googleSheets: true });
    expect(getPlanEntitlements({ plan: "scale", ...active })).toMatchObject({ apiAccess: true, googleSheets: true });
  });

  it("keeps Scale annual contact-only and the canary checkout locked copy", () => {
    expect(getBillingCatalogEntry("premium_v2", "scale", "yearly")).toMatchObject({
      priceUsd: 43989,
      monthlyCredits: 10000,
      publicSelfServe: false,
    });
    expect(pricing).toContain("Checkout validation pending");
    expect(pricing).toContain("Administrator test checkout is currently disabled");
    expect(pricing).toContain("Billed annually in USD. Credits issued monthly.");
  });
});
