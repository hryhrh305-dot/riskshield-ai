import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import ts from "typescript";
import assert from "node:assert/strict";

const cwd = process.cwd();
const sourcePath = path.join(cwd, "src", "lib", "export", "csv.ts");
const tempDir = path.join(cwd, ".codex-temp");
const tempFile = path.join(tempDir, "csv-export.test.cjs");

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
const { buildCsvContent } = require(tempFile);

const results = [
  {
    email: "send1@acme.com",
    audit_queue: "send",
    confidence: 92,
    primary_reason: "Mail server present",
    recommended_action: "Launch as-is",
    business_impact: "No blocking signal recorded",
    decision: "ALLOW",
    risk_score: 12,
    risk_level: "ALLOW",
    reason_codes: ["MX_PRESENT", "SPF_PRESENT"],
    evidence: [{ signal: "MX_PRESENT", severity: "positive", explanation: "Mail server present" }],
  },
  {
    email: "review1@acme.com",
    audit_queue: "review",
    confidence: 67,
    primary_reason: "Free email provider",
    recommended_action: "Review before launch",
    business_impact: "Potential deliverability risk",
    decision: "REVIEW",
    risk_score: 38,
    risk_level: "REVIEW",
    reason_codes: ["FREE_EMAIL_PROVIDER", "LOW_CONFIDENCE"],
    evidence: [{ signal: "FREE_EMAIL_PROVIDER", severity: "medium", explanation: "Free email provider" }],
  },
  {
    email: "suppress1@tempmail.com",
    audit_queue: "suppress",
    confidence: 88,
    primary_reason: "Disposable or temporary domain",
    recommended_action: "Suppress this contact",
    business_impact: "Blocking signal recorded",
    decision: "BLOCK",
    risk_score: 91,
    risk_level: "BLOCK",
    reason_codes: ["DISPOSABLE_DOMAIN", "INVALID_SYNTAX"],
    evidence: [{ signal: "DISPOSABLE_DOMAIN", severity: "high", explanation: "Disposable or temporary domain" }],
  },
  {
    email: "review2@acme.com",
    audit_queue: "review",
    confidence: 58,
    primary_reason: "Role-based inbox",
    recommended_action: "Review before launch",
    business_impact: "Manual review recommended",
    decision: "REVIEW",
    risk_score: 44,
    risk_level: "REVIEW",
    reason_codes: ["ROLE_BASED_EMAIL"],
    evidence: [{ signal: "ROLE_BASED_EMAIL", severity: "medium", explanation: "Role-based inbox" }],
  },
  {
    email: "send2@acme.com",
    audit_queue: "send",
    confidence: 95,
    primary_reason: "Established domain",
    recommended_action: "Launch as-is",
    business_impact: "No blocking signal recorded",
    decision: "ALLOW",
    risk_score: 9,
    risk_level: "ALLOW",
    reason_codes: ["DOMAIN_ESTABLISHED"],
    evidence: [{ signal: "DOMAIN_ESTABLISHED", severity: "positive", explanation: "Established domain" }],
  },
  {
    email: "suppress2@missingmx.test",
    audit_queue: "suppress",
    confidence: 84,
    primary_reason: "No valid mail server",
    recommended_action: "Suppress this contact",
    business_impact: "Blocking signal recorded",
    decision: "BLOCK",
    risk_score: 88,
    risk_level: "BLOCK",
    reason_codes: ["NO_MX"],
    evidence: [{ signal: "NO_MX", severity: "high", explanation: "No valid mail server" }],
  },
  {
    email: "review3@acme.com",
    audit_queue: "review",
    confidence: 61,
    primary_reason: "Catch-all domain",
    recommended_action: "Review before launch",
    business_impact: "Potential bounce risk",
    decision: "REVIEW",
    risk_score: 49,
    risk_level: "REVIEW",
    reason_codes: ["CATCH_ALL_DOMAIN"],
    evidence: [{ signal: "CATCH_ALL_DOMAIN", severity: "medium", explanation: "Catch-all domain" }],
  },
  {
    email: "send3@acme.com",
    audit_queue: "send",
    confidence: 90,
    primary_reason: "Mail server present",
    recommended_action: "Launch as-is",
    business_impact: "No blocking signal recorded",
    decision: "ALLOW",
    risk_score: 11,
    risk_level: "ALLOW",
    reason_codes: ["MX_PRESENT"],
    evidence: [{ signal: "MX_PRESENT", severity: "positive", explanation: "Mail server present" }],
  },
  {
    email: "suppress3@bad.test",
    audit_queue: "suppress",
    confidence: 82,
    primary_reason: "Invalid email syntax",
    recommended_action: "Suppress this contact",
    business_impact: "Invalid recipient",
    decision: "BLOCK",
    risk_score: 98,
    risk_level: "BLOCK",
    reason_codes: ["INVALID_SYNTAX"],
    evidence: [{ signal: "INVALID_SYNTAX", severity: "high", explanation: "Invalid email syntax" }],
  },
  {
    email: "review4@acme.com",
    audit_queue: "review",
    confidence: 63,
    primary_reason: "Low confidence result",
    recommended_action: "Review before launch",
    business_impact: "Uncertain deliverability",
    decision: "REVIEW",
    risk_score: 36,
    risk_level: "REVIEW",
    reason_codes: ["LOW_CONFIDENCE"],
    evidence: [{ signal: "LOW_CONFIDENCE", severity: "medium", explanation: "Low confidence result" }],
  },
];

const auditSummary = {
  total: results.length,
  sendCount: 3,
  reviewCount: 4,
  suppressCount: 3,
  sendRate: 0.3,
  reviewRate: 0.4,
  suppressRate: 0.3,
  topRiskReasons: [
    { reasonCode: "DISPOSABLE_DOMAIN", count: 2, label: "Disposable or temporary domain" },
    { reasonCode: "FREE_EMAIL_PROVIDER", count: 1, label: "Free email provider" },
  ],
  requiredActions: "Remove 3 Suppress contacts; review 4 Review contacts",
};

const columnsByQueue = {
  send: [
    { key: "email", label: "Email" },
    { key: "audit_queue", label: "Audit Queue" },
    { key: "confidence", label: "Confidence" },
    { key: "primary_reason", label: "Primary Reason" },
    { key: "recommended_action", label: "Recommended Action" },
    { key: "business_impact", label: "Business Impact" },
    { key: "decision", label: "Decision" },
    { key: "risk_score", label: "Risk Score" },
    { key: "risk_level", label: "Risk Level" },
  ],
  review: [
    { key: "email", label: "Email" },
    { key: "audit_queue", label: "Audit Queue" },
    { key: "confidence", label: "Confidence" },
    { key: "reason_codes", label: "Reason Codes" },
    { key: "primary_reason", label: "Primary Reason" },
    { key: "business_impact", label: "Business Impact" },
    { key: "recommended_action", label: "Recommended Action" },
    { key: "evidence_summary", label: "Evidence Summary" },
    { key: "decision", label: "Decision" },
    { key: "risk_score", label: "Risk Score" },
    { key: "risk_level", label: "Risk Level" },
  ],
  suppress: [
    { key: "email", label: "Email" },
    { key: "audit_queue", label: "Audit Queue" },
    { key: "confidence", label: "Confidence" },
    { key: "reason_codes", label: "Reason Codes" },
    { key: "primary_reason", label: "Primary Reason" },
    { key: "business_impact", label: "Business Impact" },
    { key: "recommended_action", label: "Recommended Action" },
    { key: "evidence_summary", label: "Evidence Summary" },
    { key: "decision", label: "Decision" },
    { key: "risk_score", label: "Risk Score" },
    { key: "risk_level", label: "Risk Level" },
  ],
  summary: [
    { key: "total", label: "Total Contacts" },
    { key: "sendCount", label: "Send Count" },
    { key: "reviewCount", label: "Review Count" },
    { key: "suppressCount", label: "Suppress Count" },
    { key: "sendRate", label: "Send Rate" },
    { key: "reviewRate", label: "Review Rate" },
    { key: "suppressRate", label: "Suppress Rate" },
    { key: "topRiskReasons", label: "Top Risk Reasons" },
    { key: "requiredActions", label: "Required Actions" },
  ],
};

function csvRows(queue) {
  return results.filter((item) => item.audit_queue === queue);
}

const sendCsv = buildCsvContent(csvRows("send"), columnsByQueue.send);
const reviewCsv = buildCsvContent(csvRows("review"), columnsByQueue.review);
const suppressCsv = buildCsvContent(csvRows("suppress"), columnsByQueue.suppress);
const summaryCsv = buildCsvContent([auditSummary], columnsByQueue.summary);

assert.match(sendCsv, /^"Email"/);
assert.match(reviewCsv, /^"Email"/);
assert.match(suppressCsv, /^"Email"/);
assert.match(summaryCsv, /^"Total Contacts"/);
assert.ok(sendCsv.includes("send1@acme.com"));
assert.ok(!sendCsv.includes("review1@acme.com"));
assert.ok(!sendCsv.includes("suppress1@tempmail.com"));
assert.ok(reviewCsv.includes("Evidence Summary"));
assert.ok(suppressCsv.includes("Evidence Summary"));
assert.ok(summaryCsv.includes("Required Actions"));
assert.ok(!summaryCsv.includes("Campaign Readiness Score"));
assert.ok(!summaryCsv.includes("Estimated Waste Saved USD"));
assert.ok(!sendCsv.includes("[object Object]"));
assert.ok(!reviewCsv.includes("[object Object]"));
assert.ok(!suppressCsv.includes("[object Object]"));
assert.ok(!summaryCsv.includes("[object Object]"));

console.log("=== CSV Export Smoke Summary ===");
console.log(JSON.stringify({
  sendRows: csvRows("send").length,
  reviewRows: csvRows("review").length,
  suppressRows: csvRows("suppress").length,
  sendPreview: sendCsv.split("\n").slice(0, 2),
  summaryPreview: summaryCsv.split("\n").slice(0, 2),
}, null, 2));
console.log("\nAll list-audit CSV export smoke checks passed.");
