import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  getAdminV2CanaryDecision,
  parseAdminV2CanaryEmails,
} from "@/lib/admin-v2-canary";
import { readAccessTokenFromSupabaseCookieHeader } from "@/lib/auth-cookie";
import { buildPricingCatalogResponse } from "@/lib/pricing-catalog-response";

function env(overrides: Record<string, string | undefined> = {}): NodeJS.ProcessEnv {
  return {
    NODE_ENV: "test",
    SECWYN_ADMIN_V2_CANARY_ENABLED: "true",
    SECWYN_V2_CANARY_EMAILS: "admin@example.com, second@example.com",
    CREEM_STARTER_PRODUCT_ID: "legacy_starter_monthly",
    CREEM_STARTER_YEARLY_PRODUCT_ID: "legacy_starter_yearly",
    CREEM_GROWTH_PRODUCT_ID: "legacy_growth_monthly",
    CREEM_GROWTH_YEARLY_PRODUCT_ID: "legacy_growth_yearly",
    CREEM_SCALE_PRODUCT_ID: "legacy_scale_monthly",
    CREEM_SCALE_YEARLY_PRODUCT_ID: "legacy_scale_yearly",
    ...overrides,
  };
}

describe("E8.8R Phase B admin-only Premium V2 canary", () => {
  it("reads the standard Supabase auth cookie without requiring a runtime public URL", () => {
    const token = readAccessTokenFromSupabaseCookieHeader(
      `unrelated=value; sb-project-auth-token=${encodeURIComponent(JSON.stringify(["verified-token"]))}`,
    );

    expect(token).toBe("verified-token");
  });

  it("accepts only a comma-separated, valid, normalized server allowlist", () => {
    expect(parseAdminV2CanaryEmails(" Admin@Example.com ,second@example.com ")).toEqual([
      "admin@example.com",
      "second@example.com",
    ]);
    expect(parseAdminV2CanaryEmails("admin@example.com\nsecond@example.com")).toBeNull();
    expect(parseAdminV2CanaryEmails("admin@example.com,not-an-email")).toBeNull();
    expect(parseAdminV2CanaryEmails("")).toBeNull();
  });

  it.each([undefined, "", "TRUE", "True", "1", "false"])(
    "fails closed when the canary flag is not exact lowercase true: %s",
    (flag) => {
      expect(getAdminV2CanaryDecision(
        { verified: true, email: "admin@example.com" },
        env({ SECWYN_ADMIN_V2_CANARY_ENABLED: flag }),
      )).toEqual({ enabled: false, generation: "legacy", checkoutLocked: false });
    },
  );

  it("returns Legacy without a verified server session even when the email appears allowed", () => {
    expect(getAdminV2CanaryDecision(
      { verified: false, email: "admin@example.com" },
      env(),
    )).toEqual({ enabled: false, generation: "legacy", checkoutLocked: false });
  });

  it("returns Legacy for a verified non-allowlisted account", () => {
    expect(getAdminV2CanaryDecision(
      { verified: true, email: "ordinary@example.com" },
      env(),
    )).toEqual({ enabled: false, generation: "legacy", checkoutLocked: false });
  });

  it("returns Premium V2 only for a verified allowlisted account", () => {
    expect(getAdminV2CanaryDecision(
      { verified: true, email: "ADMIN@example.com" },
      env(),
    )).toEqual({ enabled: true, generation: "premium_v2", checkoutLocked: true });
  });

  it("ignores forged URL, cookie and client admin hints because they are not authorization inputs", () => {
    const forgedActor = {
      verified: false,
      email: "admin@example.com",
      admin: true,
      searchParams: { admin: "true" },
      customCookie: "admin=true",
    } as unknown as Parameters<typeof getAdminV2CanaryDecision>[0];

    expect(getAdminV2CanaryDecision(forgedActor, env()).generation).toBe("legacy");
  });

  it("keeps the Legacy catalog and live checkout availability for everyone outside the canary", () => {
    const catalog = buildPricingCatalogResponse(
      { enabled: false, generation: "legacy", checkoutLocked: false },
      env({ SECWYN_PREMIUM_PRICING_V2_ENABLED: "true" }),
    );

    expect(catalog).toMatchObject({
      generation: "legacy",
      purchaseMode: "live",
      plans: {
        starter: { monthlyPrice: 49, annualPrice: 499, monthlyCredits: 500, monthlyCheckout: "checkout", annualCheckout: "checkout" },
        growth: { monthlyPrice: 249, annualPrice: 2499, monthlyCredits: 2500, monthlyCheckout: "checkout", annualCheckout: "checkout" },
        scale: { monthlyPrice: 1499, annualPrice: 14999, monthlyCredits: 15000, monthlyCheckout: "checkout", annualCheckout: "checkout" },
      },
    });
  });

  it("returns the exact Premium V2 contract while every V2 purchase path stays locked", () => {
    const catalog = buildPricingCatalogResponse(
      { enabled: true, generation: "premium_v2", checkoutLocked: true },
      env(),
    );

    expect(catalog).toMatchObject({
      generation: "premium_v2",
      purchaseMode: "canary_locked",
      annualSelfServe: false,
      plans: {
        starter: { monthlyPrice: 199, annualPrice: 2189, monthlyCredits: 500, monthlyCheckout: "unavailable", annualCheckout: "unavailable" },
        growth: { monthlyPrice: 999, annualPrice: 10989, monthlyCredits: 2500, monthlyCheckout: "unavailable", annualCheckout: "unavailable" },
        scale: { monthlyPrice: 3999, annualPrice: 43989, monthlyCredits: 10000, monthlyCheckout: "unavailable", annualCheckout: "contact" },
      },
    });
  });

  it("keeps client-supplied prices and Product IDs outside the catalog and checkout contracts", () => {
    const pricingRoute = readFileSync("src/app/api/pricing-catalog/route.ts", "utf8");
    const checkoutRoute = readFileSync("src/app/api/create-checkout/route.ts", "utf8");

    expect(pricingRoute).not.toMatch(/productEnvKey|productId/);
    expect(checkoutRoute).not.toMatch(/body\.(?:price|amount|productId|product_id)/);
  });

  it("renders an explicit locked V2 CTA and never invokes checkout from that state", () => {
    const pricingPage = readFileSync("src/app/(dashboard)/pricing/page.tsx", "utf8");
    const pricingRoute = readFileSync("src/app/api/pricing-catalog/route.ts", "utf8");
    const checkoutRoute = readFileSync("src/app/api/create-checkout/route.ts", "utf8");

    expect(pricingPage).toContain('purchaseMode: "live" | "canary_locked"');
    expect(pricingPage).toContain("Checkout validation pending");
    expect(pricingPage).toContain("Test checkout not enabled");
    expect(pricingPage).toContain("Billed annually in USD. Credits issued monthly.");
    expect(pricingPage).toContain("isCanaryCheckoutLocked");
    expect(pricingRoute).toContain("resolveVerifiedCanaryActor(request, process.env)");
    expect(checkoutRoute).toContain("V2_CANARY_CHECKOUT_DISABLED");
  });
});
