import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { disposableDomainsSet } from "@/lib/disposable-domains";
import {
  adaptCanonicalDecisionResult,
  CANONICAL_DECISION_FIELDS,
} from "@/lib/decision-contract";
import { applyDecisionIntegrity } from "@/lib/decision-integrity";
import { reconcileInputRows } from "@/lib/decision-integrity";
import { buildContactAuditDecision, buildListAuditSummary } from "@/lib/list-audit";
import { isRoleBasedEmail } from "@/lib/risk-engine";

const SNAPSHOT_AT = "2026-07-15T00:00:00.000Z";

function deterministicSource(overrides: Record<string, unknown> = {}) {
  return {
    email: "person@secwyn.com",
    risk_score: 0,
    risk_level: "ALLOW",
    details: {
      isDisposable: false,
      isRoleBased: false,
      hasMX: true,
      mxChecked: true,
      mxStatus: "present",
      smtpChecked: false,
      catchAllStatus: "not_tested",
      inboxProbability: "unknown",
      estimatedBounceRate: "unknown",
      senderReputationRisk: "unknown",
    },
    ...overrides,
  };
}

describe("E8.6 cross-surface decision parity", () => {
  it("treats tempmail.com as disposable without making generic blacklist hits disposable", () => {
    expect(disposableDomainsSet.has("tempmail.com")).toBe(true);
    expect(disposableDomainsSet.has("secwyn.com")).toBe(false);
  });

  it("keeps a high-confidence provider typo as the primary reason even when disposable is also true", () => {
    const result = applyDecisionIntegrity({
      email: "person@gmial.com",
      score: 90,
      decision: "BLOCK",
      isDisposable: true,
      mxStatus: "absent",
      mailboxStatus: "unconfirmed",
    });

    expect(result).toMatchObject({
      decision: "BLOCK",
      primaryReasonCode: "POSSIBLE_TYPO",
      primaryReason: "Possible domain typo",
      suggestedEmail: "person@gmail.com",
    });
  });

  it("never downgrades a threshold BLOCK merely because mailbox evidence is incomplete", () => {
    expect(applyDecisionIntegrity({
      email: "person@secwyn.com",
      score: 66,
      decision: "BLOCK",
      mxStatus: "present",
      mailboxStatus: "unconfirmed",
    })).toMatchObject({ decision: "BLOCK", primaryReasonCode: "BASE_SCORE_BLOCK" });
  });

  it.each([
    "support+benchmark@secwyn.com",
    "security@secwyn.com",
    "privacy@secwyn.com",
    "operations@secwyn.com",
    "press@secwyn.com",
  ])("classifies canonical role mailbox %s", (email) => {
    expect(isRoleBasedEmail(email)).toBe(true);
  });

  it("does not classify a normal personal mailbox as role-based", () => {
    expect(isRoleBasedEmail("alice.smith@secwyn.com")).toBe(false);
  });

  it("returns one additive canonical contract for every result surface", () => {
    const fixtures = [
      deterministicSource(),
      deterministicSource({ email: "person@tempmail.com", details: { isDisposable: false, hasMX: true, mxChecked: true, mxStatus: "present" } }),
      deterministicSource({ email: "person@example.com", details: { isDisposable: false, hasMX: true, mxChecked: true, mxStatus: "present" } }),
      deterministicSource({ email: "person@company.invalid", details: { isDisposable: false, hasMX: false, mxChecked: true, mxStatus: "absent" } }),
      deterministicSource({ email: "person@gmial.com", details: { isDisposable: true, hasMX: false, mxChecked: true, mxStatus: "absent" } }),
      deterministicSource({ email: "person@no-mx.example", details: { isDisposable: false, hasMX: false, mxChecked: true, mxStatus: "absent" } }),
      deterministicSource({ email: "person@null-mx.example", details: { isDisposable: false, hasMX: false, mxChecked: true, mxStatus: "null_mx" } }),
      deterministicSource({ email: "person@dns-failure.example", details: { isDisposable: false, hasMX: false, mxChecked: false, mxStatus: "lookup_failed" } }),
      deterministicSource({ email: "support@secwyn.com", details: { isDisposable: false, isRoleBased: true, hasMX: true, mxChecked: true, mxStatus: "present" } }),
      deterministicSource({ email: "support+benchmark@secwyn.com", details: { isDisposable: false, isRoleBased: false, hasMX: true, mxChecked: true, mxStatus: "present" } }),
      deterministicSource({ details: { isDisposable: false, hasMX: true, mxChecked: true, mxStatus: "present", catchAllStatus: "unknown" } }),
      deterministicSource({ risk_level: "ALLOW", details: { isDisposable: true, hasMX: true, mxChecked: true, mxStatus: "present" }, cached: true }),
      deterministicSource({ details: { isDisposable: false, hasMX: true, mxChecked: true, mxStatus: "present", smtpChecked: true, smtpValid: true } }),
    ];
    const surfaces = ["single", "bulk", "api", "google_sheets", "report_export"] as const;
    for (const source of fixtures) {
      const contracts = surfaces.map((surface) => adaptCanonicalDecisionResult(source, { surface, auditedAt: SNAPSHOT_AT }));
      for (const field of CANONICAL_DECISION_FIELDS) {
        expect(contracts.map((item) => item[field])).toEqual(Array(contracts.length).fill(contracts[0][field]));
      }
    }
    const contracts = surfaces.map((surface) => adaptCanonicalDecisionResult(fixtures[0], { surface, auditedAt: SNAPSHOT_AT }));
    expect(contracts[0]).toMatchObject({
      normalized_email: "person@secwyn.com",
      base_signal_score: 0,
      risk_score: 0,
      final_decision: "ALLOW",
      final_decision_code: "ALLOW",
      primary_reason_code: "BASE_SCORE_ALLOW",
      disposable: false,
      role_based: false,
      catch_all_status: "not_tested",
      mx_status: "present",
      policy_rules_version: "secwyn-signal-snapshot-v1",
      audit_id: `audit:person@secwyn.com:${SNAPSHOT_AT}`,
      audited_at: SNAPSHOT_AT,
    });
  });

  it("derives MX status from legacy boolean evidence when cached rows lack mxStatus", () => {
    expect(adaptCanonicalDecisionResult(deterministicSource({
      details: { isDisposable: false, hasMX: false, mxChecked: true },
    }), { surface: "single", auditedAt: SNAPSHOT_AT }).mx_status).toBe("absent");
  });

  it("reconciles invalid syntax and normalized duplicates before every result adapter", () => {
    const reconciliation = reconcileInputRows(["invalid address", "FIRST@secwyn.com", "first@secwyn.com"]);
    expect(reconciliation).toMatchObject({
      inputRows: 3,
      uniqueValidAddressesProcessed: 1,
      rejectedBeforeScreening: 1,
      duplicatesRemoved: 1,
    });
  });

  it("wires all active decision surfaces to the canonical adapter and keeps Sheets mapping read-only", () => {
    for (const route of [
      "src/app/api/web-risk/route.ts",
      "src/app/api/bulk-check/route.ts",
      "src/app/api/v1/email/check/route.ts",
      "src/app/api/v1/email/batch-check/route.ts",
      "src/app/api/v1/risk/check/route.ts",
      "src/lib/bulk-web-batching.ts",
    ]) {
      expect(readFileSync(route, "utf8")).toContain("attachCanonicalDecisionResult");
    }
    const sheets = readFileSync("google-sheets-addon/Code.gs", "utf8");
    expect(sheets).toContain('var decision = String(r.decision || r.risk_level || "").toUpperCase()');
    expect(sheets).not.toContain("function calculateDecision");
  });

  it("keeps primary decision drivers fully reconcilable with canonical result totals", () => {
    const decisions = [
      buildContactAuditDecision(deterministicSource()),
      buildContactAuditDecision(deterministicSource({ email: "person@tempmail.com", details: { isDisposable: true, hasMX: true, mxChecked: true, mxStatus: "present" } })),
      buildContactAuditDecision(deterministicSource({ email: "person@gmial.com", details: { isDisposable: true, hasMX: false, mxChecked: true, mxStatus: "absent" } })),
    ];
    const summary = buildListAuditSummary(decisions);

    expect(summary.topDecisionDrivers.reduce((total, item) => total + item.count, 0)).toBe(summary.reviewCount + summary.suppressCount);
    expect(summary.topDecisionDrivers.map((item) => item.reasonCode)).not.toContain("UNKNOWN_RISK");
  });

  it("uses clear Base Signal Score, Final Decision and tri-state labels across UI and Sheets", () => {
    const single = readFileSync("src/app/(dashboard)/risk-check/page.tsx", "utf8");
    const bulk = readFileSync("src/app/(dashboard)/bulk-check/page.tsx", "utf8");
    const sheets = readFileSync("google-sheets-addon/Code.gs", "utf8");

    expect(single).toContain("Base Signal Score");
    expect(single).toContain("Final Decision");
    expect(bulk).toContain("Base Signal Score");
    expect(bulk).toContain("Final Decision");
    expect(bulk).toContain("Top Decision Drivers");
    expect(sheets).toContain('{ key: "risk_score", label: "Base Signal Score" }');
    expect(sheets).toContain('{ key: "decision", label: "Final Decision" }');
    expect(sheets).toContain('if (result.disposable == null) return "Unknown"');
  });

  it("does not expose stale public capacity or free-preview promises", () => {
    const home = readFileSync("src/components/home/HomePageClient.tsx", "utf8");
    const docs = readFileSync("src/app/docs/page.tsx", "utf8");
    const dashboard = readFileSync("src/app/(dashboard)/dashboard/page.tsx", "utf8");

    expect(home).not.toMatch(/Free contact preview|Free previews/i);
    expect(home).toContain("50 one-time contact checks");
    expect(docs).not.toContain("batch up to 1,000");
    expect(dashboard).not.toContain("risk score is 60 or above");
  });
});
