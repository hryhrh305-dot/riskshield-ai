import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { buildSync } from "esbuild";
import assert from "node:assert/strict";

const cwd = process.cwd();
const sourcePath = path.join(cwd, "src", "lib", "audit", "report-format.ts");
const tempDir = path.join(cwd, ".codex-temp");
const tempFile = path.join(tempDir, "audit-report-format.test.cjs");

fs.mkdirSync(tempDir, { recursive: true });

buildSync({
  entryPoints: [sourcePath],
  outfile: tempFile,
  bundle: true,
  platform: "node",
  format: "cjs",
  target: "node20",
  absWorkingDir: cwd,
  logLevel: "silent",
});

const require = createRequire(import.meta.url);
const { buildAuditReportModel, buildClientReportHtml } = require(tempFile);

const summary = {
  total: 10,
  sendCount: 4,
  reviewCount: 3,
  suppressCount: 3,
  sendRate: 0.4,
  reviewRate: 0.3,
  suppressRate: 0.3,
  campaignReadinessScore: 61,
  launchStatus: "launch_with_caution",
  listAcceptance: "accept_after_cleanup",
  topRiskReasons: [
    { reasonCode: "DISPOSABLE_DOMAIN", count: 2, label: "Disposable or temporary domain" },
    { reasonCode: "ROLE_BASED_EMAIL", count: 1, label: "Role-based inbox" },
  ],
  estimatedWastePrevented: {
    riskySendsPrevented: 3,
    estimatedSendingCreditsSaved: 3,
    estimatedSdrTimeSavedHours: 0.08,
    estimatedWasteSavedUsd: 2.55,
  },
  recommendedWorkflow: [
    "Launch only to the Send segment first.",
    "Review uncertain contacts before adding them to outreach.",
    "Suppress high-risk contacts before sending.",
    "Re-run the list after enrichment.",
  ],
  clientRiskBrief: "This list is not recommended for full-volume sending as-is.",
};

const results = [
  { email: "review@example.com", decision: "REVIEW", risk_score: 40, primary_reason_code: "MAILBOX_UNCONFIRMED", primary_reason: "Mailbox unconfirmed", recommended_action: "Review this contact before launch.", mx_status: "present", mailbox_status: "unconfirmed", catch_all_status: "not_tested", audit_id: "audit-1", audited_at: "2026-06-27T10:00:00Z", engine_version: "engine-v1", policy_rules_version: "policy-v1" },
];
const report = buildAuditReportModel({ summary, results, generatedAt: new Date("2026-06-27T10:30:00Z") });
const html = buildClientReportHtml(report);

assert.equal(report.title, "Campaign Contact Risk Audit");
assert.equal(report.distribution.reduce((sum, item) => sum + item.count, 0), 1);
assert.equal(report.metadata.auditId, "audit-1");
assert.match(report.summaryLine, /unique (contact was|contacts were) audited/);
assert.ok(html.includes("Input Reconciliation"));
assert.ok(html.includes("Evidence Coverage"));
assert.ok(html.includes("@media print"));
assert.ok(!html.includes("Waste Prevented"));
assert.ok(!html.includes("Campaign Readiness Score"));

console.log("=== Audit Report Preview Shape ===");
console.log(JSON.stringify(report, null, 2));
console.log("\nAll audit report preview smoke checks passed.");
