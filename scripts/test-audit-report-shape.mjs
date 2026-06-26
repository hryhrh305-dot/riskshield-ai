import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import ts from "typescript";
import assert from "node:assert/strict";

const cwd = process.cwd();
const sourcePath = path.join(cwd, "src", "lib", "audit", "report-format.ts");
const tempDir = path.join(cwd, ".codex-temp");
const tempFile = path.join(tempDir, "audit-report-format.test.cjs");

fs.mkdirSync(tempDir, { recursive: true });

const source = fs.readFileSync(sourcePath, "utf8");
const transpiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
    esModuleInterop: true,
  },
}).outputText;

fs.writeFileSync(tempFile, transpiled, "utf8");

const require = createRequire(import.meta.url);
const { formatAuditReport } = require(tempFile);

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

const report = formatAuditReport(summary, new Date("2026-06-27T10:30:00Z"));

assert.equal(report.launchStatusLabel, "Launch with Caution");
assert.equal(report.listAcceptanceLabel, "Accept After Cleanup");
assert.equal(report.sendLabel, "4 (40%)");
assert.equal(report.reviewLabel, "3 (30%)");
assert.equal(report.suppressLabel, "3 (30%)");
assert.equal(report.readinessLabel, "61/100");
assert.ok(report.generatedAtLabel.length > 0);
assert.ok(report.summaryLine.includes("launch with caution"));
assert.ok(report.topRiskReasonText.includes("Disposable or temporary domain"));
assert.ok(report.wasteSnapshot.includes("risky sends prevented"));
assert.ok(report.wasteSnapshot.includes("$2.55"));

console.log("=== Audit Report Preview Shape ===");
console.log(JSON.stringify(report, null, 2));
console.log("\nAll audit report preview smoke checks passed.");
