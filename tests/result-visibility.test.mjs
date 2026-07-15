import test from "node:test";
import assert from "node:assert/strict";

import {
  getBatchExportColumnsForPlan,
  getResultVisibility,
  sanitizeBatchResultForPlan,
  sanitizeSingleRiskPayloadForPlan,
} from "../src/lib/plans.ts";

const rawSingleResult = {
  input: "alex@example.com",
  type: "email",
  risk_score: 78,
  decision: "REVIEW",
  reasons: ["Disposable email", "Missing DMARC"],
  impact: ["Bounce risk is elevated"],
  solution: [{ category: "Mailbox", problem: "Temporary risk", fix: "Verify manually" }],
  domain_age: { ageDays: 45, ageYears: 0, isNew: true, checked: true, registrar: "Test" },
  dns_health: { score: 66, mx: true, spf: true, dmarc: false, details: ["MX: OK"] },
  company_health: { healthScore: 58, grade: "C", stars: "***", label: "Watch", recommendation: "Review", positiveSignals: [], riskSignals: [], breakdown: {} },
  details: {
    email: {
      domain: "example.com",
      localPart: "alex",
      isDisposable: false,
      isRoleBased: false,
      isCatchAll: true,
      hasMX: true,
      mxChecked: true,
      hasSPF: true,
      spfChecked: true,
      hasDMARC: false,
      dmarcChecked: true,
      dmarcPolicy: "none",
      hasDKIM: true,
      dkimChecked: true,
      dkimSelector: "selector1",
      inboxProbability: "medium",
      estimatedBounceRate: "3-5%",
      senderReputationRisk: "MEDIUM",
      mxRecords: ["mx1.example.com"],
    },
    ip: {
      country: "United States",
      countryCode: "US",
      region: "CA",
      city: "San Jose",
      isp: "Example ISP",
      asn: "AS123",
      isProxy: false,
      isHosting: false,
      highRiskCountry: false,
      timezone: "America/Los_Angeles",
    },
  },
  ai_explanation: "High-risk pattern detected.",
  risk_factors: ["dns", "mailbox"],
  recommendation: "Verify before sending",
  estimated_waste_cost: 0.04,
  credits: { remaining: 49, success: true },
  cached: false,
};

const rawBatchResult = {
  email: "alex@example.com",
  risk_score: 78,
  risk_level: "REVIEW",
  reasons: ["Disposable email", "Missing DMARC"],
  details: rawSingleResult.details.email,
  recommendation: "Verify before sending",
  impact: ["Bounce risk is elevated"],
  solution: [{ category: "Mailbox", problem: "Temporary risk", fix: "Verify manually" }],
  risk_factors: ["dns", "mailbox"],
  estimated_waste_cost: 0.04,
  domain_age: rawSingleResult.domain_age,
  dns_health: rawSingleResult.dns_health,
  company_health: rawSingleResult.company_health,
  ai_explanation: "High-risk pattern detected.",
  cached: false,
};

test("result visibility increases by plan tier", () => {
  assert.equal(getResultVisibility("free").includeCompanyHealth, false);
  assert.equal(getResultVisibility("starter").includeBasicEmailDetails, true);
  assert.equal(getResultVisibility("growth").includeCompanyHealth, true);
  assert.equal(getResultVisibility("scale").includeAiExplanation, true);
});

test("free single-result payload hides advanced details", () => {
  const sanitized = sanitizeSingleRiskPayloadForPlan(rawSingleResult, "free");

  assert.deepEqual(sanitized.reasons, []);
  assert.equal(sanitized.domain_age, null);
  assert.equal(sanitized.company_health, null);
  assert.equal(sanitized.ai_explanation, null);
  assert.deepEqual(sanitized.details.email, {
    isDisposable: false,
    isRoleBased: false,
    hasMX: true,
    mxChecked: true,
  });
});

test("scale single-result payload keeps advanced details", () => {
  const sanitized = sanitizeSingleRiskPayloadForPlan(rawSingleResult, "scale");

  assert.equal(sanitized.ai_explanation, "High-risk pattern detected.");
  assert.equal(sanitized.domain_age.ageDays, 45);
  assert.equal(sanitized.details.email.dkimSelector, "selector1");
  assert.equal(sanitized.details.ip.timezone, "America/Los_Angeles");
});

test("batch result export fields expand with plan tier", () => {
  const freeColumns = getBatchExportColumnsForPlan("free").map((item) => item.key);
  const scaleColumns = getBatchExportColumnsForPlan("scale").map((item) => item.key);

  assert.deepEqual(freeColumns, [
    "email", "decision", "confidence", "primary_reason_code", "primary_reason", "recommended_action",
    "decision_explanation", "mx_status", "mailbox_status", "catch_all_status", "engine_version",
    "policy_rules_version", "audit_id", "audited_at", "risk_score", "risk_level",
  ]);
  assert.equal(scaleColumns.includes("risk_factors"), true);
  assert.equal(scaleColumns.includes("dmarc_policy"), true);
  assert.equal(scaleColumns.includes("ai_explanation"), true);
});

test("growth batch result keeps practical signals but not scale-only extras", () => {
  const sanitized = sanitizeBatchResultForPlan(rawBatchResult, "growth");

  assert.equal(sanitized.health_score, 58);
  assert.equal(sanitized.inbox_probability, "medium");
  assert.equal("ai_explanation" in sanitized, false);
  assert.equal("dmarc_policy" in sanitized, false);
});
