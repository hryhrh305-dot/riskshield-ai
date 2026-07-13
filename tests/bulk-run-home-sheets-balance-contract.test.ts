import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

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
});
