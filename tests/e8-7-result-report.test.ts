import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import * as XLSXLib from "xlsx";
import { AuditReportPreview } from "@/components/audit/AuditReportPreview";
import {
  buildAuditReportModel,
  buildClientReportHtml,
  buildEvidenceCoverage,
  buildRequiredActions,
} from "@/lib/audit/report-format";
import {
  buildResultManifest,
  formatVisibleResultRange,
  getResultManifestInvariantErrors,
  scopeResultManifest,
} from "@/lib/audit/result-manifest";
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
  it("reconciles the full result manifest independently from format detail limits", () => {
    const manifest = buildResultManifest({
      inputRows: 4005,
      syntaxAccepted: 4004,
      rejectedRows: 1,
      duplicateOccurrences: 1885,
      uniqueProcessed: 2119,
      resultCount: 2119,
      creditsConsumed: 2119,
      sendCount: 1288,
      reviewCount: 451,
      suppressCount: 380,
      totalDetailRecords: 2119,
      includedDetailRecords: 2119,
      formatMode: "canonical",
    });

    expect(getResultManifestInvariantErrors(manifest)).toEqual([]);
    expect(scopeResultManifest(manifest, "pdf_summary", 20)).toMatchObject({
      resultCount: 2119,
      totalDetailRecords: 2119,
      includedDetailRecords: 20,
      formatMode: "pdf_summary",
      isFullResultSet: false,
    });
    expect(scopeResultManifest(manifest, "html_full", 2119).isFullResultSet).toBe(true);
  });

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
    expect(html).toContain("Full detailed HTML report");
    expect(html).toContain("1 of 1 unique results included");
    expect(html).toContain("Result #");
    expect(html).toContain("First source row");
    expect(html).toContain("Source row refers to the position in the uploaded file.");
    expect(html).toContain("Available domain evidence does not confirm the mailbox.");
    expect(html).toContain("Engine: secwyn-decision-integrity-v1");
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).not.toMatch(/Campaign Readiness Score|Waste Prevented|Potential Savings|Client: Client|Campaign: Outbound Campaign/i);
    expect(html).toContain("support@secwyn.com");
    expect(html).toContain(".scroll{width:100%;max-width:100%;overflow-x:auto}");
    expect(html).toContain("overflow-wrap:anywhere");
  });

  it("keeps every synthetic result in full HTML and removes internal decision prefixes", () => {
    const total = 37;
    const results = Array.from({ length: total }, (_, index) => result({
      email: `synthetic-${index}@example.test`,
      normalized_email: `synthetic-${index}@example.test`,
      decision: index % 2 === 0 ? "ALLOW" : "BLOCK",
      decision_explanation: index % 2 === 0 ? "ALLOW: No blocking signal detected." : "BLOCK: No usable MX.",
      audit_id: `synthetic-audit-${index}`,
    }));
    const summary = buildListAuditSummary(Array.from({ length: total }, (_, index) => decision({
      email: `synthetic-${index}@example.test`,
      normalizedEmail: `synthetic-${index}@example.test`,
      decision: index % 2 === 0 ? "ALLOW" : "BLOCK",
      queue: index % 2 === 0 ? "send" : "suppress",
    })));
    const html = buildClientReportHtml(buildAuditReportModel({
      summary,
      results,
      reconciliation: {
        inputRows: total,
        syntaxAccepted: total,
        rejectedBeforeScreening: 0,
        duplicatesRemoved: 0,
        uniqueValidAddressesProcessed: total,
        resultsProduced: total,
        creditsConsumed: total,
      },
    }));

    expect(html.match(/<tr data-result-row=/g)).toHaveLength(total);
    expect(html).toContain(`${total} of ${total} unique results included`);
    expect(html).toContain("Decision basis: No blocking signal detected.");
    expect(html).toContain("Decision basis: No usable MX.");
    expect(html).not.toMatch(/\b(?:ALLOW|BLOCK):/u);
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
    expect(globals).toMatch(/\.secwyn-print-report\s*\{[^}]*overflow: visible !important;/);
    expect(globals).toContain("box-decoration-break: clone;");
    expect(globals).toContain("-webkit-box-decoration-break: clone;");
    expect(globals).toMatch(/\.report-contact-table tr[^}]*box-shadow: inset 0 2px 0 #d8dee7 !important;/);
    expect(markup).toMatch(/report-decision-allow[^>]*>SEND</);
    expect(markup).toMatch(/report-decision-review[^>]*>REVIEW</);
    expect(markup).toMatch(/report-decision-block[^>]*>SUPPRESS</);
    expect(markup).toContain("Executive Summary PDF");
    expect(markup).toContain("3 of 3 detailed results included");
    expect(markup).toContain("Download the full HTML, CSV, or XLSX export for all 3 row-level results.");
    expect(markup).toContain('class="min-w-0 flex-1"');
    expect(markup).not.toContain("max-w-2xl");
    expect(globals).toMatch(/\.report-decision-allow[^}]*color: #15763a !important;/);
    expect(globals).toMatch(/\.report-decision-review[^}]*color: #955b08 !important;/);
    expect(globals).toMatch(/\.report-decision-block[^}]*color: #b42336 !important;/);
    expect(globals).toContain("html .secwyn-print-report .report-decision.report-decision-allow");
  });

  it("reports progressive and filtered Web result ranges without treating source rows as totals", () => {
    expect(formatVisibleResultRange(250, 2119)).toBe("Showing 1–250 of 2,119 unique results.");
    expect(formatVisibleResultRange(500, 2119)).toBe("Showing 1–500 of 2,119 unique results.");
    expect(formatVisibleResultRange(250, 451, 2119)).toBe("Showing 1–250 of 451 matching unique results · 2,119 total unique results.");
    expect(formatVisibleResultRange(0, 0, 2119)).toBe("Showing 0–0 of 0 matching unique results · 2,119 total unique results.");
  });

  it("keeps full CSV/XLSX row counts and decision queues reconciled without a billing call", () => {
    const rows = Array.from({ length: 37 }, (_, index) => ({
      email: `synthetic-${index}@example.test`,
      decision: index < 20 ? "SEND" : index < 30 ? "REVIEW" : "SUPPRESS",
    }));
    const csv = buildCsvContent(rows, [
      { key: "email", label: "Email" },
      { key: "decision", label: "Decision" },
    ]);
    const worksheet = XLSXLib.utils.json_to_sheet(rows);
    const workbook = XLSXLib.utils.book_new();
    XLSXLib.utils.book_append_sheet(workbook, worksheet, "Secwyn Results");
    const xlsxRows = XLSXLib.utils.sheet_to_json(workbook.Sheets["Secwyn Results"]);
    const queueTotal = ["SEND", "REVIEW", "SUPPRESS"]
      .reduce((sum, queue) => sum + rows.filter((row) => row.decision === queue).length, 0);

    expect(csv.split("\n")).toHaveLength(rows.length + 1);
    expect(xlsxRows).toHaveLength(rows.length);
    expect(queueTotal).toBe(rows.length);
    const bulkPage = readFileSync("src/app/(dashboard)/bulk-check/page.tsx", "utf8");
    expect(bulkPage).not.toMatch(/(?:downloadXLSX|exportCSV|downloadAuditCsv)[\s\S]{0,800}(?:consumeLegacyCredits|consume_grant_credits)/i);
  });

  it("labels a PDF with more than 20 results as a 20-row executive summary", () => {
    const total = 25;
    const markup = renderToStaticMarkup(createElement(AuditReportPreview, {
      summary: buildListAuditSummary(Array.from({ length: total }, (_, index) => decision({
        email: `synthetic-${index}@example.test`,
        normalizedEmail: `synthetic-${index}@example.test`,
      }))),
      results: Array.from({ length: total }, (_, index) => result({
        email: `synthetic-${index}@example.test`,
        normalized_email: `synthetic-${index}@example.test`,
        audit_id: `synthetic-audit-${index}`,
      })),
      reconciliation: {
        inputRows: total,
        syntaxAccepted: total,
        uniqueValidAddressesProcessed: total,
        rejectedBeforeScreening: 0,
        duplicatesRemoved: 0,
        resultsProduced: total,
        creditsConsumed: total,
      },
      onDownloadHtml: () => undefined,
      onPrint: () => undefined,
    }));

    expect(markup).toContain("Executive Summary PDF · 20 of 25 detailed results included");
    expect(markup).toContain("Executive summary: 20 of 25 detailed results included.");
    expect(markup.match(/data-label="Result #"/g)).toHaveLength(20);
    expect(markup).not.toMatch(/Full Report|Complete Results/iu);
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

    for (const expected of ["Required Actions", "Top Risk Drivers", "Evidence Coverage", "Download Full HTML Report", "Print / Save Summary PDF", "Decision tabs", "Search contacts"]) {
      expect(publicRuntime).toContain(expected);
    }
    expect(singlePage).toContain("Audit metadata");
    expect(singlePage).toContain("Evidence boundary");
    expect(globals).toContain("@media print");
    expect(globals).toContain(".secwyn-print-report");
    expect(globals).toContain(".rs-bulk-results-head");
    expect(globals).toMatch(/@media print and \(orientation: portrait\)[\s\S]*\.report-contact-table/);
    expect(report).toContain('className="report-contact-table');
    expect(report).toContain("Executive summary: {previewContacts.length.toLocaleString()} of {report.contacts.length.toLocaleString()} detailed results included.");
    expect(report).toContain("First source row");
    expect(report).toContain("Result #");
    expect(bulkPage).toContain("visibleResultRange");
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
