import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { getCreditsForPlan } from "@/lib/creem";
import { plans } from "@/lib/plans";

const home = readFileSync("src/components/home/HomePageClient.tsx", "utf8");
const sheets = readFileSync("google-sheets-addon/Code.gs", "utf8");

describe("home account label and Sheets balance contract", () => {
  it("shows the signed-in email on dashboard links without changing their destination", () => {
    expect(home.match(/\{user\.email \|\| "Dashboard"\}/g)?.length).toBeGreaterThanOrEqual(2);
    expect(home.match(/href="\/dashboard"/g)?.length).toBeGreaterThanOrEqual(2);
  });

  it("keeps the final balance from concurrent Sheets batches", () => {
    expect(sheets).toContain("totals.remaining === null");
    expect(sheets).toContain("Math.min(totals.remaining, result.credits.remaining)");
    expect(sheets).not.toContain('remaining: "N/A"');
  });

  it("uses the pricing-page credit amounts for self-serve plans", () => {
    expect(getCreditsForPlan("free")).toBe(50);
    expect(getCreditsForPlan("starter")).toBe(500);
    expect(getCreditsForPlan("growth")).toBe(2500);
    expect(getCreditsForPlan("scale")).toBe(15000);
    expect(plans.growth.creditsLabel).toContain("2,500");
    expect(plans.scale.creditsLabel).toContain("15,000");
  });
});
