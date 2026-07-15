import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  findBillingCatalogEntryByProductId,
  getBillingCatalogEntry,
  getCheckoutAvailability,
  getPublicCatalogGeneration,
  getSecwynPricingFlags,
  validateBillingCatalogProductIds,
} from "@/lib/billing-catalog";
import { getAnnualServiceMonth } from "@/lib/credit-cycle";
import { getReferralRewardCredits } from "@/lib/referral-rewards";

const env = (values: Record<string, string | undefined>) => values as unknown as NodeJS.ProcessEnv;

const v2Env = env({
  SECWYN_PREMIUM_PRICING_V2_ENABLED: "true",
  SECWYN_V2_ANNUAL_SELF_SERVE_ENABLED: "true",
  CREEM_STARTER_MONTHLY_V2_PRODUCT_ID: "v2_starter_monthly",
  CREEM_GROWTH_MONTHLY_V2_PRODUCT_ID: "v2_growth_monthly",
  CREEM_SCALE_MONTHLY_V2_PRODUCT_ID: "v2_scale_monthly",
  CREEM_STARTER_ANNUAL_V2_PRODUCT_ID: "v2_starter_annual",
  CREEM_GROWTH_ANNUAL_V2_PRODUCT_ID: "v2_growth_annual",
  CREEM_SCALE_ANNUAL_V2_PRODUCT_ID: "v2_scale_annual",
});

describe("E8.8 dual billing catalog", () => {
  it("keeps Legacy prices, capacities and rewards immutable", () => {
    expect(getBillingCatalogEntry("legacy", "starter", "monthly")).toMatchObject({ priceUsd: 49, monthlyCredits: 500, referralRewardCredits: 50 });
    expect(getBillingCatalogEntry("legacy", "starter", "yearly")).toMatchObject({ priceUsd: 499, monthlyCredits: 500 });
    expect(getBillingCatalogEntry("legacy", "growth", "yearly")).toMatchObject({ priceUsd: 2499, monthlyCredits: 2500, referralRewardCredits: 250 });
    expect(getBillingCatalogEntry("legacy", "scale", "monthly")).toMatchObject({ priceUsd: 1499, monthlyCredits: 15000, referralRewardCredits: 1500 });
    expect(getBillingCatalogEntry("legacy", "scale", "yearly")).toMatchObject({ priceUsd: 14999, monthlyCredits: 15000 });
  });

  it("defines Premium V2 monthly and annual as exactly one month free", () => {
    const expected = {
      starter: { monthly: 199, annual: 2189, credits: 500, reward: 50 },
      growth: { monthly: 999, annual: 10989, credits: 2500, reward: 250 },
      scale: { monthly: 3999, annual: 43989, credits: 10000, reward: 1000 },
    } as const;
    for (const [plan, values] of Object.entries(expected)) {
      const monthly = getBillingCatalogEntry("premium_v2", plan, "monthly");
      const annual = getBillingCatalogEntry("premium_v2", plan, "yearly");
      expect(monthly).toMatchObject({ priceUsd: values.monthly, monthlyCredits: values.credits, referralRewardCredits: values.reward });
      expect(annual).toMatchObject({ priceUsd: values.annual, monthlyCredits: values.credits, referralRewardCredits: values.reward });
      expect(annual.priceUsd).toBe(monthly.priceUsd * 11);
    }
  });

  it("uses strict server flags and never accepts truthy lookalikes", () => {
    expect(getSecwynPricingFlags(env({}))).toEqual({ premiumV2: false, annualSelfServe: false });
    expect(getSecwynPricingFlags(env({ SECWYN_PREMIUM_PRICING_V2_ENABLED: "TRUE" })).premiumV2).toBe(false);
    expect(getPublicCatalogGeneration(env({ SECWYN_PREMIUM_PRICING_V2_ENABLED: "true" }))).toBe("premium_v2");
  });

  it("fails closed for annual checkout and always blocks V2 Scale annual", () => {
    expect(getCheckoutAvailability("starter", "yearly", env({ ...v2Env, SECWYN_V2_ANNUAL_SELF_SERVE_ENABLED: "false" }))).toMatchObject({ kind: "contact" });
    expect(getCheckoutAvailability("starter", "yearly", env({ ...v2Env, CREEM_STARTER_ANNUAL_V2_PRODUCT_ID: "" }))).toMatchObject({ kind: "unavailable" });
    expect(getCheckoutAvailability("starter", "yearly", v2Env)).toMatchObject({ kind: "checkout", productId: "v2_starter_annual", generation: "premium_v2" });
    expect(getCheckoutAvailability("scale", "yearly", v2Env)).toMatchObject({ kind: "contact" });
  });

  it("recognizes both generations while rejecting duplicate or unknown product IDs", () => {
    const mappedEnv = env({ ...v2Env, CREEM_STARTER_PRODUCT_ID: "legacy_starter" });
    expect(findBillingCatalogEntryByProductId("legacy_starter", mappedEnv)).toMatchObject({ generation: "legacy", plan: "starter", interval: "monthly" });
    expect(findBillingCatalogEntryByProductId("v2_growth_annual", mappedEnv)).toMatchObject({ generation: "premium_v2", plan: "growth", interval: "yearly" });
    expect(findBillingCatalogEntryByProductId("unknown", mappedEnv)).toBeNull();
    expect(() => validateBillingCatalogProductIds(env({ ...mappedEnv, CREEM_GROWTH_ANNUAL_V2_PRODUCT_ID: "legacy_starter" }))).toThrow("DUPLICATE_CREEM_PRODUCT_MAPPING");
    expect(() => getCheckoutAvailability("growth", "yearly", env({ ...mappedEnv, CREEM_GROWTH_ANNUAL_V2_PRODUCT_ID: "legacy_starter" }))).toThrow("DUPLICATE_CREEM_PRODUCT_MAPPING");
  });
});

describe("E8.8 annual service months and referral snapshots", () => {
  it("issues service months from the anchor with a hard 12-month term boundary", () => {
    expect(getAnnualServiceMonth("2026-01-31T10:00:00.000Z", new Date("2026-02-28T10:00:00.000Z"), "2027-01-31T10:00:00.000Z")).toMatchObject({ monthIndex: 1, termKey: "2026-01-31T10:00:00.000Z" });
    expect(getAnnualServiceMonth("2026-01-31T10:00:00.000Z", new Date("2027-01-30T10:00:00.000Z"), "2027-01-31T10:00:00.000Z").monthIndex).toBe(11);
    expect(() => getAnnualServiceMonth("2026-01-31T10:00:00.000Z", new Date("2027-01-31T10:00:00.000Z"), "2027-01-31T10:00:00.000Z")).toThrow("ANNUAL_TERM_ENDED");
  });

  it("snapshots referral rewards by catalog generation for monthly and annual", () => {
    expect(getReferralRewardCredits("scale", "legacy", "yearly")).toBe(1500);
    expect(getReferralRewardCredits("scale", "premium_v2", "monthly")).toBe(1000);
    expect(getReferralRewardCredits("growth", "premium_v2", "yearly")).toBe(250);
  });
});

describe("E8.8 public contract scans", () => {
  it("contains no obsolete readiness score or two-month annual promotion", () => {
    const sources = [
      readFileSync("src/app/(dashboard)/pricing/page.tsx", "utf8"),
      readFileSync("src/app/page.tsx", "utf8"),
      readFileSync("src/app/layout.tsx", "utf8"),
    ].join("\n");
    expect(sources).not.toMatch(/Campaign Readiness Score/i);
    expect(sources).not.toMatch(/2 months free|save 2 months/i);
  });

  it("keeps checkout inputs server-derived and blocks client product fields", () => {
    const checkout = readFileSync("src/app/api/create-checkout/route.ts", "utf8");
    expect(checkout).toContain("getCheckoutAvailability");
    expect(checkout).not.toMatch(/body\.(?:product|productId|price|generation|catalog)/);
  });
});
