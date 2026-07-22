import type { AffiliateProgramId, RuleVersion } from "../domain/types";

const SECWYN_LAUNCH_RULE: RuleVersion = Object.freeze({
  id: "secwyn-india-launch-v1",
  programId: "secwyn-india",
  version: 1,
  effectiveFrom: "2026-07-22T00:00:00.000Z",
  status: "published",
  phase: "launch",
  rules: Object.freeze([
    { plan: "starter", interval: "monthly", directMinor: 2500n, reserveDays: 30, annualReleaseDays: [] },
    { plan: "starter", interval: "annual", directMinor: 12000n, reserveDays: 60, annualReleaseDays: [30, 90] },
    { plan: "growth", interval: "monthly", directMinor: 10000n, reserveDays: 30, annualReleaseDays: [] },
    { plan: "growth", interval: "annual", directMinor: 60000n, reserveDays: 60, annualReleaseDays: [30, 120, 210, 300] },
    { plan: "scale", interval: "monthly", directMinor: 30000n, reserveDays: 30, annualReleaseDays: [] },
    { plan: "scale", interval: "annual", directMinor: 150000n, reserveDays: 60, annualReleaseDays: [30, 60, 90, 120, 150, 180] },
  ] as const),
});

const SECWYN_EVERGREEN_RULE: RuleVersion = Object.freeze({
  id: "secwyn-india-evergreen-v1", programId: "secwyn-india", version: 2,
  effectiveFrom: "9999-01-01T00:00:00.000Z", status: "approved", phase: "evergreen",
  rules: Object.freeze([
    { plan: "starter", interval: "monthly", directMinor: 1500n, reserveDays: 30, annualReleaseDays: [] },
    { plan: "starter", interval: "annual", directMinor: 10000n, reserveDays: 60, annualReleaseDays: [30, 90] },
    { plan: "growth", interval: "monthly", directMinor: 7500n, reserveDays: 30, annualReleaseDays: [] },
    { plan: "growth", interval: "annual", directMinor: 50000n, reserveDays: 60, annualReleaseDays: [30, 120, 210, 300] },
    { plan: "scale", interval: "monthly", directMinor: 25000n, reserveDays: 30, annualReleaseDays: [] },
    { plan: "scale", interval: "annual", directMinor: 120000n, reserveDays: 60, annualReleaseDays: [30, 60, 90, 120, 150, 180] },
  ] as const),
});

export type AffiliateProgramAdapter = Readonly<{
  id: AffiliateProgramId;
  enabled: boolean;
  ruleVersions: readonly RuleVersion[];
}>;

const PROGRAMS: Record<AffiliateProgramId, AffiliateProgramAdapter> = {
  "secwyn-india": { id: "secwyn-india", enabled: true, ruleVersions: [SECWYN_LAUNCH_RULE, SECWYN_EVERGREEN_RULE] },
  "flowwyn-placeholder": { id: "flowwyn-placeholder", enabled: false, ruleVersions: [] },
};

export function getAffiliateProgram(programId: AffiliateProgramId): AffiliateProgramAdapter {
  const program = PROGRAMS[programId];
  if (!program?.enabled) throw new Error("AFFILIATE_PROGRAM_DISABLED");
  return program;
}

export function resolveRuleVersion(programId: AffiliateProgramId, occurredAt: string): RuleVersion {
  const at = Date.parse(occurredAt);
  const matches = getAffiliateProgram(programId).ruleVersions.filter((item) => {
    const starts = Date.parse(item.effectiveFrom);
    const ends = item.effectiveUntil ? Date.parse(item.effectiveUntil) : Number.POSITIVE_INFINITY;
    return item.status === "published" && starts <= at && at < ends;
  });
  if (matches.length !== 1) throw new Error("AFFILIATE_RULE_RESOLUTION_FAILED");
  return matches[0];
}

export function resolveProgramRuleVersion(programId: AffiliateProgramId, occurredAt: string, launchStartAt?: string): RuleVersion {
  if (!launchStartAt || !Number.isFinite(Date.parse(launchStartAt))) throw new Error("AFFILIATE_LAUNCH_START_REQUIRED");
  const launchStart = new Date(launchStartAt); const launchEnd = new Date(launchStartAt); launchEnd.setUTCMonth(launchEnd.getUTCMonth() + 12);
  const occurred = Date.parse(occurredAt); if (occurred < launchStart.getTime()) throw new Error("AFFILIATE_PROGRAM_NOT_STARTED");
  const phase = occurred < launchEnd.getTime() ? "launch" : "evergreen";
  const rule = getAffiliateProgram(programId).ruleVersions.find((item) => item.phase === phase);
  if (!rule) throw new Error("AFFILIATE_RULE_RESOLUTION_FAILED"); return rule;
}
