import { describe, expect, it } from "vitest";
import {
  applyDecisionIntegrity,
  classifyMxEvidence,
  getPlanAuditCta,
  reconcileInputRows,
  sanitizeDecisionText,
} from "@/lib/decision-integrity";
import { buildContactAuditDecision, buildListAuditSummary } from "@/lib/list-audit";
import { readFileSync } from "node:fs";
import { reconcileWebBulkText } from "@/lib/bulk-web-batching";
import { disposableDomainsSet } from "@/lib/disposable-domains";
import { plans } from "@/lib/plans";

describe("E8.5 decision integrity", () => {
  it("rejects an internal-space row without creating a new address", () => {
    const reconciliation = reconcileInputRows(["space inlocal@example.com"]);

    expect(reconciliation.accepted).toEqual([]);
    expect(reconciliation.rejected).toEqual([
      expect.objectContaining({ rowNumber: 1, originalValue: "space inlocal@example.com", status: "REJECT_BEFORE_SCREENING" }),
    ]);
  });

  it("does not treat an ordinary space as an email delimiter", () => {
    const reconciliation = reconcileWebBulkText("first@example.com second@example.com");

    expect(reconciliation).toMatchObject({
      inputRows: 1,
      uniqueValidAddressesProcessed: 0,
      rejectedBeforeScreening: 1,
    });
    expect(reconciliation.rejected[0]).toMatchObject({
      originalValue: "first@example.com second@example.com",
      status: "REJECT_BEFORE_SCREENING",
    });

    expect(reconcileWebBulkText("first@example.com\tsecond@example.com").accepted).toEqual([
      "first@example.com",
      "second@example.com",
    ]);
  });

  it("does not instruct users to separate pasted addresses with ordinary spaces", () => {
    const route = readFileSync("src/app/api/bulk-check/route.ts", "utf8");

    expect(route).not.toContain("separated by spaces");
  });

  it("explains case-insensitive duplicates while preserving original rows", () => {
    const reconciliation = reconcileInputRows(["FIRST.LAST@secwyn.com", "first.last@secwyn.com"]);

    expect(reconciliation.inputRows).toBe(2);
    expect(reconciliation.accepted).toEqual(["first.last@secwyn.com"]);
    expect(reconciliation.duplicatesRemoved).toBe(1);
    expect(reconciliation.rows[1]).toMatchObject({ originalValue: "first.last@secwyn.com", status: "DUPLICATE" });
  });

  it.each(["mailinator.com", "example.com", "example.net", "example.org", "company.invalid", "company.test", "localhost"])(
    "does not allow hard-override domain %s",
    (domain) => {
      const result = applyDecisionIntegrity({
        email: `person@${domain}`,
        score: 0,
        decision: "ALLOW",
        isDisposable: domain === "mailinator.com",
        mxStatus: domain.endsWith(".invalid") ? "absent" : "present",
        mailboxStatus: "unconfirmed",
      });

      expect(result.decision).not.toBe("ALLOW");
      expect(result.recommendedAction).not.toHaveLength(0);
    },
  );

  it("blocks Null MX independently of a zero score", () => {
    const result = applyDecisionIntegrity({
      email: "person@null-mx.example",
      score: 0,
      decision: "ALLOW",
      mxStatus: "null_mx",
      mailboxStatus: "unconfirmed",
    });

    expect(result.decision).toBe("BLOCK");
    expect(result.primaryReason).toContain("does not accept mail");
  });

  it("keeps DNS failures distinct from absent MX", () => {
    expect(classifyMxEvidence({ records: [], errorCode: "ETIMEOUT" })).toBe("timed_out");
    expect(classifyMxEvidence({ records: [], errorCode: "ESERVFAIL" })).toBe("lookup_failed");
    expect(classifyMxEvidence({ records: [], errorCode: "ENODATA" })).toBe("absent");
  });

  it("does not make safe deliverability claims without mailbox evidence", () => {
    const result = applyDecisionIntegrity({
      email: "person@secwyn.com",
      score: 0,
      decision: "ALLOW",
      mxStatus: "present",
      mailboxStatus: "unconfirmed",
    });

    expect(result.decision).toBe("REVIEW");
    expect(result.inboxProbability).toBe("unknown");
    expect(result.estimatedBounceRate).toBe("unknown");
    expect(result.recommendation.toLowerCase()).not.toContain("safe to send");
    expect(result.recommendation.toLowerCase()).not.toContain("proceed confidently");
  });

  it("defaults missing mailbox evidence to REVIEW", () => {
    const result = applyDecisionIntegrity({
      email: "person@secwyn.com",
      score: 0,
      decision: "ALLOW",
    });

    expect(result).toMatchObject({
      decision: "REVIEW",
      primaryReason: "Mailbox unconfirmed",
      inboxProbability: "unknown",
      estimatedBounceRate: "unknown",
    });
  });

  it("keeps a confirmed catch-all result out of the automatic send queue", () => {
    const result = applyDecisionIntegrity({
      email: "person@secwyn.com",
      score: 0,
      decision: "ALLOW",
      mxStatus: "present",
      mailboxStatus: "confirmed",
      catchAllStatus: "yes",
    });

    expect(result).toMatchObject({
      decision: "REVIEW",
      primaryReason: "Catch-all mailbox uncertainty",
      catchAllStatus: "yes",
    });
  });

  it("uses a truthful plan CTA for Business", () => {
    expect(getPlanAuditCta("business")).toEqual({ label: "Run another audit", href: "/bulk-check" });
    expect(plans.free.creditsLabel).toBe("50 one-time checks");
    expect(plans.starter.monthlyLimit).toBe(500);
    expect(plans.growth.monthlyLimit).toBe(2500);
    expect(plans.scale.monthlyLimit).toBe(15000);
    const pricing = readFileSync("src/app/(dashboard)/pricing/page.tsx", "utf8");
    expect(pricing).toContain('"50 one-time contact checks"');
    expect(pricing).toContain('"Custom contact capacity"');
  });

  it("removes replacement-character punctuation from deterministic exports", () => {
    expect(sanitizeDecisionText("LOW ?normal sending will not harm reputation")).toBe("LOW - normal sending will not harm reputation");
  });

  it("keeps the single Contact Check on the canonical decision and unknown-state contract", () => {
    const page = readFileSync("src/app/(dashboard)/risk-check/page.tsx", "utf8");
    const route = readFileSync("src/app/api/web-risk/route.ts", "utf8");

    expect(page).toContain('s >= 66 ? "text-red-300" : s >= 26');
    expect(page).toContain('"Mailbox unconfirmed"');
    expect(page).toContain("Decision Explanation");
    expect(route).toContain("buildContactAuditDecision({ ...cachedResult, email })");
    expect(route).toContain("decision_explanation: cachedAudit.decisionExplanation");
  });

  it("provides a deterministic correction for a common provider typo", () => {
    const result = applyDecisionIntegrity({
      email: "person@gmial.com",
      score: 0,
      decision: "ALLOW",
      mxStatus: "present",
      mailboxStatus: "confirmed",
    });

    expect(result).toMatchObject({ decision: "BLOCK", primaryReason: "Possible domain typo", suggestedEmail: "person@gmail.com" });
    expect(result.recommendedAction).toContain("person@gmail.com");
  });

  it("defensively overrides cached legacy ALLOW rows and reconciles summary totals", () => {
    const decisions = [
      buildContactAuditDecision({
        email: "person@mailinator.com",
        risk_score: 0,
        risk_level: "ALLOW",
        details: { isDisposable: true, hasMX: true, mxChecked: true, mxStatus: "present" },
      }),
      buildContactAuditDecision({
        email: "person@secwyn.com",
        risk_score: 0,
        risk_level: "ALLOW",
        details: { hasMX: true, mxChecked: true, mxStatus: "present" },
      }),
    ];
    const summary = buildListAuditSummary(decisions);

    expect(decisions[0]).toMatchObject({ decision: "BLOCK", queue: "suppress" });
    expect(decisions[1]).toMatchObject({ decision: "REVIEW", queue: "review" });
    expect(summary.sendCount + summary.reviewCount + summary.suppressCount).toBe(summary.total);
    expect(decisions.every((item) => item.recommendedAction.length > 0)).toBe(true);
    expect(summary.topRiskReasons.map((item) => item.reasonCode)).not.toContain("UNKNOWN_RISK");
  });

  it("reconciles the package's exact 100-row benchmark with zero policy gaps", () => {
    const benchmark = readFileSync("tests/fixtures/secwyn-email-benchmark-100.txt", "utf8");
    const reconciliation = reconcileWebBulkText(benchmark);
    const decisions = reconciliation.accepted.map((email) => {
      const domain = email.slice(email.lastIndexOf("@") + 1);
      const absentMx = domain.endsWith(".invalid") || ["gmial.com", "gamil.com", "gmai.com", "outlok.com", "outllook.com", "hotnail.com", "yaho.com", "icloud.co", "protonmail.co", "fastmai.com"].includes(domain);
      const integrity = applyDecisionIntegrity({
        email,
        score: 0,
        decision: "ALLOW",
        isDisposable: disposableDomainsSet.has(domain),
        mxStatus: absentMx ? "absent" : "present",
        mailboxStatus: "unconfirmed",
      });
      return buildContactAuditDecision({
        email,
        risk_score: 0,
        risk_level: integrity.decision,
        details: {
          isDisposable: disposableDomainsSet.has(domain),
          hasMX: !absentMx,
          mxChecked: true,
          mxStatus: absentMx ? "absent" : "present",
        },
      });
    });
    const summary = buildListAuditSummary(decisions);

    expect(reconciliation).toMatchObject({ inputRows: 100, uniqueValidAddressesProcessed: 89, rejectedBeforeScreening: 10, duplicatesRemoved: 1 });
    expect(decisions).toHaveLength(89);
    expect(summary).toMatchObject({ total: 89, sendCount: 0, reviewCount: 60, suppressCount: 29 });
    expect(decisions.filter((item) => item.decision === "ALLOW" && item.reasonCodes.includes("DISPOSABLE_DOMAIN"))).toHaveLength(0);
    expect(decisions.filter((item) => item.queue === "send" && item.reasonCodes.includes("RESERVED_TEST_DOMAIN"))).toHaveLength(0);
    expect(decisions.every((item) => item.recommendedAction.length > 0)).toBe(true);
    expect(summary.sendCount + summary.reviewCount + summary.suppressCount).toBe(summary.total);
  });
});
