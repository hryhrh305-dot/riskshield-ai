import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AuditReportPreview } from "@/components/audit/AuditReportPreview";
import {
  buildAuditReportModel,
  buildClientReportHtml,
  buildEvidenceCoverage,
  buildRequiredActions,
} from "@/lib/audit/report-format";
import { buildCsvContent, sanitizeSpreadsheetCell } from "@/lib/export/csv";
import { buildListAuditSummary, type ContactAuditDecision } from "@/lib/list-audit";

function decision(overrides: Partial<ContactAuditDecision> = {}): ContactAuditDecision {
  return {
    email: "person@secwyn.com",
    normalizedEmail: "person@secwyn.com",
    decision: "REVIEW",
    queue: "review",
    riskScore: 38,
    confidence: 65,
    disposable: false,
    roleBased: false,
    reasonCodes: ["MAILBOX_UNCONFIRMED"],
    primaryReasonCode: "MAILBOX_UNCONFIRMED",
    primaryReason: "Mailbox unconfirmed",
    recommendedAction: "Review this contact before launch.",
    businessImpact: "Manual review required.",
    evidence: [],
    decisionExplanation: "Available domain evidence does not confirm the mailbox.",
    decisionLimitation: "Domain evidence is not mailbox or inbox evidence.",
    suggestedCorrection: null,
    ...overrides,
  };
}

function result(overrides: Record<string, unknown> = {}) {
  return {
    email: "person@secwyn.com",
    normalized_email: "person@secwyn.com",
    decision: "REVIEW",
    risk_score: 38,
    primary_reason_code: "MAILBOX_UNCONFIRMED",
    primary_reason: "Mailbox unconfirmed",
    recommended_action: "Review this contact before launch.",
    decision_explanation: "Available domain evidence does not confirm the mailbox.",
    mx_status: "present",
    mailbox_status: "unconfirmed",
    catch_all_status: "not_tested",
    disposable: false,
    role_based: false,
    engine_version: "secwyn-decision-integrity-v1",
    policy_rules_version: "secwyn-signal-snapshot-v1",
    audit_id: "audit-1",
    audited_at: "2026-07-15T08:00:00.000Z",
    ...overrides,
  };
}

describe("E8.7 report truth contract", () => {
  it("derives required actions and negative risk drivers from real result rows", () => {
    const decisions = [
      decision(),
      decision({ email: "two@secwyn.com", normalizedEmail: "two@secwyn.com" }),
      decision({
        email: "send@secwyn.com",
        normalizedEmail: "send@secwyn.com",
        decision: "ALLOW",
        queue: "send",
        primaryReasonCode: "MX_PRESENT",
        primaryReason: "Mail server present",
        recommendedAction: "Proceed with normal campaign controls.",
      }),
    ];
    const summary = buildListAuditSummary(decisions);
    expect(summary.topRiskReasons).toEqual([
      { reasonCode: "MAILBOX_UNCONFIRMED", count: 2, label: "Mailbox unconfirmed" },
    ]);

    expect(buildRequiredActions([
      result(),
      result({ email: "two@secwyn.com" }),
      result({ email: "send@secwyn.com", decision: "ALLOW", recommended_action: "Proceed with normal campaign controls." }),
    ])).toEqual(expect.arrayContaining([
      expect.objectContaining({ action: "Review this contact before launch.", count: 2, queue: "review" }),
    ]));
  });

  it("keeps unknown, not-tested and failed evidence distinct", () => {
    const coverage = buildEvidenceCoverage([
      result(),
      result({ email: "failed@secwyn.com", mx_status: "lookup_failed", mailbox_status: "unknown", catch_all_status: "lookup_failed" }),
    ]);
    expect(coverage.mx).toMatchObject({ present: 1, lookup_failed: 1 });
    expect(coverage.mailbox).toMatchObject({ unconfirmed: 1, unknown: 1 });
    expect(coverage.catch_all).toMatchObject({ not_tested: 1, lookup_failed: 1 });
  });

  it("builds a client-ready model from actual reconciliation and canonical metadata", () => {
    const rows = [result()];
    const summary = buildListAuditSummary([decision()]);
    const model = buildAuditReportModel({
      summary,
      results: rows,
      reconciliation: {
        inputRows: 3,
        syntaxAccepted: 2,
        rejectedBeforeScreening: 1,
        duplicatesRemoved: 1,
        uniqueValidAddressesProcessed: 1,
        resultsProduced: 1,
        creditsConsumed: 1,
        accepted: ["person@secwyn.com"],
        rows: [],
      },
      generatedAt: new Date("2026-07-15T09:00:00.000Z"),
    });

    expect(model.title).toBe("Campaign Contact Risk Audit");
    expect(model.reconciliation).toMatchObject({ inputRows: 3, rejected: 1, duplicates: 1, uniqueProcessed: 1, creditsConsumed: 1 });
    expect(model.metadata).toMatchObject({
      auditId: "audit-1",
      engineVersion: "secwyn-decision-integrity-v1",
      policyVersion: "secwyn-signal-snapshot-v1",
      auditedAt: "2026-07-15T08:00:00.000Z",
      generatedAt: "2026-07-15T09:00:00.000Z",
    });
    expect(model.distribution.reduce((sum, queue) => sum + queue.count, 0)).toBe(1);
    expect(model.summaryLine).not.toMatch(/savings|waste prevented|guaranteed|certificate/i);
  });

  it("keeps contact previews in first-accepted input order when later duplicates exist", () => {
    const summary = buildListAuditSummary([
      decision({ email: "first@secwyn.com", normalizedEmail: "first@secwyn.com" }),
      decision({ email: "second@secwyn.com", normalizedEmail: "second@secwyn.com" }),
    ]);
    const model = buildAuditReportModel({
      summary,
      results: [
        result({ email: "first@secwyn.com", normalized_email: "first@secwyn.com" }),
        result({ email: "second@secwyn.com", normalized_email: "second@secwyn.com" }),
      ],
      reconciliation: {
        rows: [
          { rowNumber: 1, originalValue: "FIRST@secwyn.com", normalizedValue: "first@secwyn.com", status: "ACCEPTED", accepted: true, rejected: false, duplicate: false, processed: true, charged: true, rejectionReason: null },
          { rowNumber: 2, originalValue: "second@secwyn.com", normalizedValue: "second@secwyn.com", status: "ACCEPTED", accepted: true, rejected: false, duplicate: false, processed: true, charged: true, rejectionReason: null },
          { rowNumber: 2583, originalValue: "first@secwyn.com", normalizedValue: "first@secwyn.com", status: "DUPLICATE", accepted: false, rejected: false, duplicate: true, processed: false, charged: false, rejectionReason: "DUPLICATE_NORMALIZED_EMAIL" },
        ],
      },
    });

    expect(model.contacts.map((contact) => [contact.row_number, contact.original_input])).toEqual([
      [1, "FIRST@secwyn.com"],
      [2, "second@secwyn.com"],
    ]);
  });

  it("generates escaped, printable HTML without invented client or value claims", () => {
    const summary = buildListAuditSummary([decision()]);
    const model = buildAuditReportModel({
      summary,
      results: [result({ email: '<img src=x onerror="alert(1)">@example.com', primary_reason: "<script>alert(1)</script>" })],
      generatedAt: new Date("2026-07-15T09:00:00.000Z"),
    });
    const html = buildClientReportHtml(model);

    expect(html).toContain("Campaign Contact Risk Audit");
    expect(html).toContain("@media print");
    expect(html).toContain("<thead>");
    expect(html).toContain("Technical context");
    expect(html).toContain("Available domain evidence does not confirm the mailbox.");
    expect(html).toContain("Engine: secwyn-decision-integrity-v1");
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).not.toMatch(/Campaign Readiness Score|Waste Prevented|Potential Savings|Client: Client|Campaign: Outbound Campaign/i);
    expect(html).toContain("support@secwyn.com");
    expect(html).toContain(".scroll{width:100%;max-width:100%;overflow-x:auto}");
    expect(html).toContain("overflow-wrap:anywhere");
  });

  it("handles empty and 5,000-row fixtures without NaN or a second billing model", () => {
    const empty = buildAuditReportModel({ summary: buildListAuditSummary([]), results: [] });
    expect(JSON.stringify(empty)).not.toContain("NaN");

    const large = Array.from({ length: 5000 }, (_, index) => result({ email: `person${index}@secwyn.com`, audit_id: `audit-${index}` }));
    const started = performance.now();
    const model = buildAuditReportModel({ summary: buildListAuditSummary(Array.from({ length: 5000 }, () => decision())), results: large });
    const html = buildClientReportHtml(model);
    expect(model.contacts).toHaveLength(5000);
    expect(html).toContain("person4999@secwyn.com");
    expect(performance.now() - started).toBeLessThan(2000);
  });
});

describe("E8.7 artifact and surface safety", () => {
  it("keeps printed page tops clear and renders semantic decision colors", () => {
    const summary = buildListAuditSummary([
      decision({ decision: "ALLOW", queue: "send" }),
      decision({ email: "review@secwyn.com", normalizedEmail: "review@secwyn.com" }),
      decision({ email: "block@secwyn.com", normalizedEmail: "block@secwyn.com", decision: "BLOCK", queue: "suppress" }),
    ]);
    const markup = renderToStaticMarkup(createElement(AuditReportPreview, {
      summary,
      results: [
        result({ decision: "ALLOW" }),
        result({ email: "review@secwyn.com", decision: "REVIEW" }),
        result({ email: "block@secwyn.com", decision: "BLOCK" }),
      ],
      onDownloadHtml: () => undefined,
      onPrint: () => undefined,
    }));
    const globals = readFileSync("src/app/globals.css", "utf8");

    expect(globals).toContain("margin: 22mm 14mm 14mm;");
    expect(globals).toMatch(/\.secwyn-print-report\s*\{[^}]*overflow: visible !important;/s);
    expect(globals).toContain("box-decoration-break: clone;");
    expect(globals).toContain("-webkit-box-decoration-break: clone;");
    expect(globals).toMatch(/\.report-contact-table tr[^}]*box-shadow: inset 0 2px 0 #d8dee7 !important;/s);
    expect(markup).toMatch(/report-decision-allow[^>]*>SEND</);
    expect(markup).toMatch(/report-decision-review[^>]*>REVIEW</);
    expect(markup).toMatch(/report-decision-block[^>]*>SUPPRESS</);
    expect(globals).toMatch(/\.report-decision-allow[^}]*color: #15763a !important;/s);
    expect(globals).toMatch(/\.report-decision-review[^}]*color: #955b08 !important;/s);
    expect(globals).toMatch(/\.report-decision-block[^}]*color: #b42336 !important;/s);
    expect(globals).toContain("html .secwyn-print-report .report-decision.report-decision-allow");
  });

  it("neutralizes spreadsheet formulas while retaining ordinary emails", () => {
    expect(sanitizeSpreadsheetCell("normal@example.com")).toBe("normal@example.com");
    expect(sanitizeSpreadsheetCell("=HYPERLINK(\"https://example.com\")")).toBe("'=HYPERLINK(\"https://example.com\")");
    expect(sanitizeSpreadsheetCell("\t=1+1")).toBe("'\t=1+1");
    const csv = buildCsvContent([{ value: "@SUM(1,1)" }], [{ key: "value", label: "Value" }]);
    expect(csv).toContain("'@SUM(1,1)");
  });

  it("keeps report/download actions free of credit consumers and protects history ownership", () => {
    const bulkPage = readFileSync("src/app/(dashboard)/bulk-check/page.tsx", "utf8");
    const report = readFileSync("src/components/audit/AuditReportPreview.tsx", "utf8");
    const historyRoute = readFileSync("src/app/api/pre-send/route.ts", "utf8");
    expect(`${bulkPage}\n${report}`).not.toMatch(/(?:download|print|report)[\s\S]{0,300}(?:consumeLegacyCredits|consume_grant_credits)/i);
    expect(historyRoute).toContain('.eq("user_id", user.id)');
    expect(historyRoute).toContain("CAMPAIGN_NOT_FOUND");
  });

  it("exposes real report, filters, metadata and print semantics without forbidden claims", () => {
    const bulkPage = readFileSync("src/app/(dashboard)/bulk-check/page.tsx", "utf8");
    const singlePage = readFileSync("src/app/(dashboard)/risk-check/page.tsx", "utf8");
    const report = readFileSync("src/components/audit/AuditReportPreview.tsx", "utf8");
    const globals = readFileSync("src/app/globals.css", "utf8");
    const publicRuntime = `${bulkPage}\n${singlePage}\n${report}`;

    for (const expected of ["Required Actions", "Top Risk Drivers", "Evidence Coverage", "Download HTML", "Print / Save PDF", "Decision tabs", "Search contacts"]) {
      expect(publicRuntime).toContain(expected);
    }
    expect(singlePage).toContain("Audit metadata");
    expect(singlePage).toContain("Evidence boundary");
    expect(globals).toContain("@media print");
    expect(globals).toContain(".secwyn-print-report");
    expect(globals).toContain(".rs-bulk-results-head");
    expect(globals).toMatch(/@media print and \(orientation: portrait\)[\s\S]*\.report-contact-table/);
    expect(report).toContain('className="report-contact-table');
    expect(report).toContain("Showing the first {previewContacts.length.toLocaleString()} accepted unique contacts in uploaded order");
    expect(report).toContain('data-label="Technical context"');
    expect(report).toContain('className="report-contact-detail"');
    expect(report).toContain("{item.count.toLocaleString()} {item.count === 1 ? \"contact\" : \"contacts\"}");
    expect(bulkPage).toContain("function resetAudit()");
    expect(bulkPage).toContain('onClick={resetAudit}');
    expect(bulkPage).toContain('className="rs-client-delivery-files');
    expect(bulkPage).toContain('const PRIMARY_RESULT_COLUMN_KEYS = ["email", "decision", "confidence", "primary_reason", "recommended_action", "mailbox_status", "risk_score"] as const;');
    expect(bulkPage).toContain('className="w-full table-fixed text-sm"');
    expect(bulkPage).toContain("colSpan={primaryResultColumns.length}");
    expect(bulkPage).toContain('className="rs-technical-evidence-grid');
    expect(publicRuntime).not.toMatch(/Compliance Certificate|Safety Certificate|Guaranteed Deliverability|underwrit|insured|human-reviewed|approved by/i);
  });
});
