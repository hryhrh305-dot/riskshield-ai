import { isReservedOrTestDomain, suggestEmailDomainCorrection } from "@/lib/decision-integrity";
import { buildContactAuditDecision, type ContactAuditDecision } from "@/lib/list-audit";

export const DECISION_ENGINE_VERSION = "secwyn-decision-integrity-v1";
export const SIGNAL_SNAPSHOT_VERSION = "secwyn-signal-snapshot-v1";

export const CANONICAL_DECISION_FIELDS = [
  "normalized_email",
  "base_signal_score",
  "risk_score",
  "final_decision",
  "final_decision_code",
  "decision_confidence",
  "primary_reason_code",
  "primary_reason",
  "supporting_evidence",
  "decision_limitation",
  "recommended_action",
  "decision_explanation",
  "disposable",
  "role_based",
  "catch_all_status",
  "mailbox_status",
  "mx_status",
  "evidence_state",
  "inbox_probability",
  "estimated_bounce_rate",
  "sender_reputation_risk",
  "reserved_domain",
  "provider_typo",
  "suggested_correction",
  "engine_version",
  "signal_snapshot_version",
  "policy_rules_version",
  "audit_id",
  "audited_at",
] as const;

export type CanonicalDecisionField = typeof CANONICAL_DECISION_FIELDS[number];
export type DecisionSurface = "single" | "bulk" | "api" | "google_sheets" | "report_export";

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? value as Record<string, unknown> : {};
}

function readEmailDetails(source: Record<string, unknown>): Record<string, unknown> {
  const details = asRecord(source.details);
  return Object.prototype.hasOwnProperty.call(details, "email") ? asRecord(details.email) : details;
}

function readString(value: unknown, fallback = "unknown"): string {
  return typeof value === "string" && value.trim() ? value : fallback;
}

export function buildCanonicalDecisionContract(
  source: Record<string, unknown>,
  options: { auditedAt?: string; auditDecision?: ContactAuditDecision } = {},
) {
  const auditDecision = options.auditDecision || buildContactAuditDecision(source);
  const details = readEmailDetails(source);
  const normalizedEmail = auditDecision.normalizedEmail;
  const domain = normalizedEmail.includes("@") ? normalizedEmail.slice(normalizedEmail.lastIndexOf("@") + 1) : "";
  const rawMxStatus = details.mxStatus ?? source.mx_status;
  const mxStatus = readString(
    rawMxStatus,
    details.mxChecked === true || source.mxChecked === true
      ? details.hasMX === true || source.hasMX === true
        ? "present"
        : details.hasMX === false || source.hasMX === false
          ? "absent"
          : "not_tested"
      : "not_tested",
  );
  const catchAllStatus = readString(details.catchAllStatus ?? source.catch_all_status,
    details.isCatchAll === true || source.catch_all === true ? "yes" : details.isCatchAll === false || source.catch_all === false ? "no" : "not_tested");
  const mailboxStatus = readString(details.mailboxStatus ?? source.mailbox_status,
    details.smtpChecked === true ? details.smtpValid === true ? "confirmed" : "rejected" : "unconfirmed");
  const suggestedCorrection = auditDecision.suggestedCorrection || suggestEmailDomainCorrection(normalizedEmail);
  const auditedAt = readString(source.audited_at, options.auditedAt || new Date().toISOString());
  const policyRulesVersion = readString(source.policy_rules_version, SIGNAL_SNAPSHOT_VERSION);
  const auditId = readString(
    source.audit_id ?? source.auditId ?? source.run_id ?? source.request_id,
    `audit:${normalizedEmail}:${auditedAt}`,
  );

  return {
    normalized_email: normalizedEmail,
    base_signal_score: auditDecision.riskScore ?? 0,
    risk_score: auditDecision.riskScore ?? 0,
    final_decision: auditDecision.decision,
    final_decision_code: auditDecision.decision,
    decision_confidence: auditDecision.confidence,
    primary_reason_code: auditDecision.primaryReasonCode,
    primary_reason: auditDecision.primaryReason,
    supporting_evidence: auditDecision.evidence,
    decision_limitation: auditDecision.decisionLimitation,
    recommended_action: auditDecision.recommendedAction,
    decision_explanation: auditDecision.decisionExplanation,
    disposable: auditDecision.disposable,
    role_based: auditDecision.roleBased,
    catch_all_status: catchAllStatus,
    mailbox_status: mailboxStatus,
    mx_status: mxStatus,
    evidence_state: { mx: mxStatus, mailbox: mailboxStatus, catch_all: catchAllStatus },
    inbox_probability: readString(details.inboxProbability ?? source.inbox_probability),
    estimated_bounce_rate: readString(details.estimatedBounceRate ?? source.estimated_bounce_rate),
    sender_reputation_risk: readString(details.senderReputationRisk ?? source.sender_reputation_risk),
    reserved_domain: domain ? isReservedOrTestDomain(domain) : false,
    provider_typo: !!suggestedCorrection,
    suggested_correction: suggestedCorrection,
    engine_version: readString(source.engine_version, DECISION_ENGINE_VERSION),
    signal_snapshot_version: readString(source.signal_snapshot_version, SIGNAL_SNAPSHOT_VERSION),
    policy_rules_version: policyRulesVersion,
    audit_id: auditId,
    audited_at: auditedAt,
  };
}

export function adaptCanonicalDecisionResult(
  source: Record<string, unknown>,
  options: { surface: DecisionSurface; auditedAt?: string },
) {
  void options.surface;
  return buildCanonicalDecisionContract(source, { auditedAt: options.auditedAt });
}

export function attachCanonicalDecisionResult(
  displayRecord: Record<string, unknown>,
  sourceRecord: Record<string, unknown>,
  auditedAt?: string,
) {
  const auditDecision = buildContactAuditDecision(sourceRecord);
  const contract = buildCanonicalDecisionContract(sourceRecord, { auditDecision, auditedAt });
  return {
    record: {
      ...displayRecord,
      ...contract,
      decision: contract.final_decision,
      risk_level: contract.final_decision,
      audit_queue: auditDecision.queue,
      reason_codes: auditDecision.reasonCodes,
      business_impact: auditDecision.businessImpact,
      confidence: contract.decision_confidence,
      evidence: contract.supporting_evidence,
    },
    auditDecision,
  };
}
