import { describe, expect, it } from "vitest";
import { getBillingCatalogEntry } from "@/lib/billing-catalog";
import { adaptCanonicalDecisionResult } from "@/lib/decision-contract";
import { applyDecisionIntegrity } from "@/lib/decision-integrity";
import { analyzeDecisionRows, parseSanitizedDecisionCsv } from "@/lib/decision-utility-analysis";

const KNOWN_VALID_PROVIDERS = [
  "gmail.com",
  "outlook.com",
  "yahoo.com",
  "icloud.com",
  "proton.me",
  "workspace.example.co",
  "m365.example.co",
  "enterprise.example.co",
];

describe("E8.8R pricing generation contract", () => {
  it("keeps Legacy and Premium V2 Scale independently grandfathered", () => {
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
  });
});

describe("E8.8R decision utility gate", () => {
  it.each(KNOWN_VALID_PROVIDERS)(
    "does not force %s into REVIEW solely because mailbox confirmation is unavailable",
    (domain) => {
      const result = applyDecisionIntegrity({
        email: `known-valid@${domain}`,
        score: 0,
        decision: "ALLOW",
        mxStatus: "present",
        mailboxStatus: "unconfirmed",
        catchAllStatus: "not_tested",
      });

      expect(result).toMatchObject({
        decision: "ALLOW",
        queue: "send",
        primaryReasonCode: "BASE_SCORE_ALLOW",
        confidence: "low",
        inboxProbability: "unknown",
        estimatedBounceRate: "unknown",
      });
      expect(result.limitation).toContain("does not confirm");
    },
  );

  it("keeps the same low-score unconfirmed result across every canonical surface", () => {
    const source = {
      email: "known-valid@gmail.com",
      risk_score: 0,
      risk_level: "ALLOW",
      details: {
        isDisposable: false,
        hasMX: true,
        mxChecked: true,
        mxStatus: "present",
        smtpChecked: false,
        catchAllStatus: "not_tested",
      },
    };
    const surfaces = ["single", "bulk", "api", "google_sheets", "report_export"] as const;

    for (const surface of surfaces) {
      expect(adaptCanonicalDecisionResult(source, {
        surface,
        auditedAt: "2026-07-17T00:00:00.000Z",
      })).toMatchObject({
        final_decision: "ALLOW",
        primary_reason_code: "BASE_SCORE_ALLOW",
        mx_status: "present",
        mailbox_status: "unconfirmed",
      });
    }
  });

  it.each([
    { name: "MX timeout", mxStatus: "timed_out" as const, catchAllStatus: "not_tested" as const },
    { name: "MX lookup failure", mxStatus: "lookup_failed" as const, catchAllStatus: "not_tested" as const },
    { name: "catch-all", mxStatus: "present" as const, catchAllStatus: "yes" as const },
  ])("keeps truly ambiguous evidence in REVIEW: $name", ({ mxStatus, catchAllStatus }) => {
    expect(applyDecisionIntegrity({
      email: "ambiguous@company.example.co",
      score: 0,
      decision: "ALLOW",
      mxStatus,
      mailboxStatus: "unconfirmed",
      catchAllStatus,
    }).decision).toBe("REVIEW");
  });

  it.each([
    { name: "disposable", isDisposable: true, mxStatus: "present" as const, mailboxStatus: "unconfirmed" as const },
    { name: "no MX", isDisposable: false, mxStatus: "absent" as const, mailboxStatus: "unconfirmed" as const },
    { name: "Null MX", isDisposable: false, mxStatus: "null_mx" as const, mailboxStatus: "unconfirmed" as const },
    { name: "mailbox rejected", isDisposable: false, mxStatus: "present" as const, mailboxStatus: "rejected" as const },
  ])("keeps known-invalid evidence blocked: $name", (fixture) => {
    expect(applyDecisionIntegrity({
      email: fixture.isDisposable ? "invalid@mailinator.com" : "invalid@company.example.co",
      score: 0,
      decision: "ALLOW",
      ...fixture,
    }).decision).toBe("BLOCK");
  });

  it.each([
    [25, "ALLOW"],
    [26, "REVIEW"],
    [65, "REVIEW"],
    [66, "BLOCK"],
  ] as const)("preserves the locked score boundary %i => %s", (score, decision) => {
    expect(applyDecisionIntegrity({
      email: "boundary@gmail.com",
      score,
      mxStatus: "present",
      mailboxStatus: "unconfirmed",
      catchAllStatus: "not_tested",
    }).decision).toBe(decision);
  });
});

describe("E8.8R sanitized review distribution", () => {
  it("reports decision, REVIEW reason and provider distributions without email addresses", () => {
    const rows = parseSanitizedDecisionCsv([
      "provider_group,decision,primary_reason_code,risk_score,mx_status,mailbox_status,catch_all_status,disposable,reserved_domain",
      "gmail,ALLOW,BASE_SCORE_ALLOW,0,present,unconfirmed,not_tested,false,false",
      "microsoft_365,REVIEW,CATCH_ALL_DOMAIN,10,present,unconfirmed,yes,false,false",
      "enterprise_mx,REVIEW,MX_LOOKUP_FAILED,0,timed_out,unconfirmed,not_tested,false,false",
      "disposable,BLOCK,DISPOSABLE_DOMAIN,0,present,unconfirmed,not_tested,true,false",
    ].join("\n"));

    expect(analyzeDecisionRows(rows)).toMatchObject({
      total: 4,
      decisions: { ALLOW: 1, REVIEW: 2, BLOCK: 1 },
      reviewReasons: { CATCH_ALL_DOMAIN: 1, MX_LOOKUP_FAILED: 1 },
      providers: { gmail: 1, microsoft_365: 1, enterprise_mx: 1, disposable: 1 },
    });
  });

  it("rejects raw email columns so the tool cannot accidentally ingest PII", () => {
    expect(() => parseSanitizedDecisionCsv("email,decision\nuser@example.com,ALLOW")).toThrow("PII_COLUMN_NOT_ALLOWED");
  });
});
