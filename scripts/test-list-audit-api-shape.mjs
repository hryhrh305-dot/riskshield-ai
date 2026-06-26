import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import ts from "typescript";
import assert from "node:assert/strict";

const cwd = process.cwd();
const sourcePath = path.join(cwd, "src", "lib", "list-audit.ts");
const tempDir = path.join(cwd, ".codex-temp");
const tempFile = path.join(tempDir, "list-audit-api-shape.test.cjs");

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
const audit = require(tempFile);

function attachAuditFields(displayRecord, sourceRecord) {
  const auditDecision = audit.buildContactAuditDecision(sourceRecord);
  return {
    ...displayRecord,
    audit_queue: auditDecision.queue,
    reason_codes: auditDecision.reasonCodes,
    primary_reason: auditDecision.primaryReason,
    recommended_action: auditDecision.recommendedAction,
    business_impact: auditDecision.businessImpact,
    confidence: auditDecision.confidence,
    evidence: auditDecision.evidence,
  };
}

const legacyResults = [
  {
    email: "alice@acme.com",
    risk_score: 8,
    risk_level: "ALLOW",
    decision: "ALLOW",
    reasons: ["MX records present - domain can receive email", "SPF configured"],
    details: { email: { hasMX: true, mxChecked: true, hasSPF: true, spfChecked: true } },
  },
  {
    email: "sales@acme.com",
    risk_score: 41,
    risk_level: "REVIEW",
    decision: "REVIEW",
    reasons: ["Role-based email - not a personal address"],
    details: { email: { isRoleBased: true, hasMX: true, mxChecked: true } },
  },
  {
    email: "temp@tempmail.org",
    risk_score: 92,
    risk_level: "BLOCK",
    decision: "BLOCK",
    reasons: ["Disposable email likely fake/temporary registration"],
    details: { email: { isDisposable: true, hasMX: false, mxChecked: true } },
  },
];

const enriched = legacyResults.map((item) => attachAuditFields(item, item));
const decisions = enriched.map((item) => audit.buildContactAuditDecision(item));
const summary = audit.buildListAuditSummary(decisions);

for (const item of enriched) {
  assert.ok(item.audit_queue, "missing audit_queue");
  assert.ok(Array.isArray(item.reason_codes), "missing reason_codes");
  assert.ok(item.primary_reason.length > 0, "missing primary_reason");
  assert.ok(item.recommended_action.length > 0, "missing recommended_action");
  assert.ok(item.business_impact.length > 0, "missing business_impact");
  assert.ok(typeof item.confidence === "number", "missing confidence");
  assert.ok(Array.isArray(item.evidence), "missing evidence");
  assert.ok(item.decision, "legacy decision missing");
  assert.ok(item.risk_level, "legacy risk_level missing");
}

assert.equal(summary.total, enriched.length);
assert.ok(summary.launchStatus);
assert.ok(summary.listAcceptance);
assert.ok(Array.isArray(summary.topRiskReasons));
assert.ok(summary.clientRiskBrief.length > 0);

const bulkLikeResponse = {
  success: true,
  plan: "starter",
  summary: {
    total: enriched.length,
    clean: 1,
    risky: 1,
    blocked: 1,
  },
  audit_summary: summary,
  results: enriched,
};

const preSendLikeResponse = {
  success: true,
  summary: {
    total: enriched.length,
    allowed: 1,
    blocked: 1,
  },
  audit_summary: summary,
  results: enriched,
};

assert.ok(bulkLikeResponse.summary.total === bulkLikeResponse.results.length);
assert.ok(preSendLikeResponse.audit_summary.campaignReadinessScore >= 0);
assert.ok("audit_summary" in bulkLikeResponse);
assert.ok("audit_summary" in preSendLikeResponse);
assert.ok("results" in bulkLikeResponse);
assert.ok("summary" in preSendLikeResponse);

console.log("=== API Shape Smoke Summary ===");
console.log(JSON.stringify({
  auditQueue: enriched.map((item) => item.audit_queue),
  launchStatus: summary.launchStatus,
  listAcceptance: summary.listAcceptance,
  total: summary.total,
  clientRiskBrief: summary.clientRiskBrief,
}, null, 2));
console.log("\nAll list-audit API shape smoke checks passed.");
