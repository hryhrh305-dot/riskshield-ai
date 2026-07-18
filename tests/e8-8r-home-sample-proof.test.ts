import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { sampleAuditContacts } from "../src/lib/sample-audit-data";
import {
  sampleAuditCampaignDecision,
  sampleAuditReviewDrivers,
  sampleAuditRiskDrivers,
  sampleAuditSummary,
  sampleAuditTotal,
} from "../src/lib/sample-audit-summary";

const home = readFileSync("src/components/home/HomePageClient.tsx", "utf8");
const samplePage = readFileSync("src/app/sample-audit/page.tsx", "utf8");

describe("Phase B.6C homepage sample proof contract", () => {
  it("computes the synthetic sample totals and percentages from one compact summary", () => {
    expect(sampleAuditTotal).toBe(20);
    expect(sampleAuditSummary).toEqual([
      { decision: "SEND", count: 9, percentage: 45 },
      { decision: "REVIEW", count: 6, percentage: 30 },
      { decision: "SUPPRESS", count: 5, percentage: 25 },
    ]);
    expect(sampleAuditSummary.reduce((total, item) => total + item.count, 0)).toBe(sampleAuditTotal);
    expect(sampleAuditSummary.reduce((total, item) => total + item.percentage, 0)).toBe(100);
    expect(sampleAuditCampaignDecision).toBe("REVIEW");
  });

  it("keeps the compact homepage summary reconciled with the full sample fixture", () => {
    const fixtureCounts = new Map(
      (["SEND", "REVIEW", "SUPPRESS"] as const).map((decision) => [
        decision,
        sampleAuditContacts.filter((contact) => contact.decision === decision).length,
      ]),
    );
    for (const item of sampleAuditSummary) expect(item.count).toBe(fixtureCounts.get(item.decision));

    for (const driver of sampleAuditReviewDrivers) {
      expect(sampleAuditContacts.filter((contact) => contact.decision === "REVIEW" && contact.primaryReason === driver.primaryReason)).toHaveLength(driver.count);
    }
    for (const driver of sampleAuditRiskDrivers) {
      expect(sampleAuditContacts.filter((contact) => contact.riskTags.includes(driver.riskTag))).toHaveLength(driver.count);
    }
  });

  it("loads only the compact summary on the homepage while the full route keeps all rows", () => {
    expect(home).toContain('from "@/lib/sample-audit-summary"');
    expect(home).not.toContain('from "@/lib/sample-audit-data"');
    expect(samplePage).toContain('from "@/lib/sample-audit-summary"');
    expect(samplePage).toContain('from "@/lib/sample-audit-data"');
  });

  it("presents the synthetic proof with concrete evidence and public decision language", () => {
    expect(home).toContain("ILLUSTRATIVE SAMPLE");
    expect(home).toContain("SYNTHETIC DATA");
    expect(home).toContain("Northstar Advisory");
    expect(home).toContain("Q3 Executive Outreach");
    expect(home).toContain("synthetic contacts");
    expect(home).toContain("Campaign decision:");
    expect(home).toContain("contacts require action before approval");
    expect(home).toContain("The largest Review drivers include");
    expect(sampleAuditReviewDrivers.map((driver) => driver.label)).toEqual(["Role-based addresses", "Evidence unavailable"]);
    expect(home).toContain("Resolve the");
    expect(home).toContain("Review contacts, export the");
    expect(home).toContain("contact Send queue, then approve the campaign.");
    expect(home).not.toMatch(/\bALLOW\b|\bBLOCK\b/);
    expect(home).not.toMatch(/\b612\b|\b74\b|\b19\b/);
  });

  it("keeps both sample entry links safe, accessible, and pointed at the same route", () => {
    expect(home.match(/href="\/sample-audit"/g) ?? []).toHaveLength(2);
    expect(home).toContain("Explore a Sample Audit");
    expect(home).toContain("Explore the full sample audit");
    expect(home).toContain('<article id="sample-audit"');
    expect(home).toContain('aria-labelledby="hero-sample-title"');
    expect(home).toContain('id="hero-sample-title"');
    expect(home).toContain("focus-visible:");
    expect(home).toContain('aria-hidden="true"');
    expect(home).toContain("Synthetic data");
    expect(home).toContain("No signup");
    expect(home).toContain("No credits used");
    expect(home).toContain("Not a real customer report");
    expect(home).not.toMatch(/href="[^"]*(?:bulk-check|checkout|\.pdf)/i);
    expect(home).not.toContain("disabled");
  });

  it("records only the approved homepage proof-card click properties", () => {
    expect(home).toContain('trackE8Event("homepage_sample_card_cta_clicked", { source: "hero_sample_card", destination: "/sample-audit" })');
    expect(home).not.toMatch(/homepage_sample_card_cta_clicked[\s\S]{0,180}(product|price|email|user|credit)/i);
  });
});
