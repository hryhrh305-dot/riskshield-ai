import { publicDecisionLabel, type InputReconciliation } from "@/lib/decision-integrity";
import type { AuditQueue, ListAuditSummary } from "@/lib/list-audit";

export type AuditReportResult = Record<string, unknown> & {
  email?: string | null;
  normalized_email?: string | null;
  decision?: string | null;
  risk_level?: string | null;
  risk_score?: number | null;
  primary_reason_code?: string | null;
  primary_reason?: string | null;
  recommended_action?: string | null;
  decision_explanation?: string | null;
  mx_status?: string | null;
  mailbox_status?: string | null;
  catch_all_status?: string | null;
  disposable?: boolean | null;
  role_based?: boolean | null;
  engine_version?: string | null;
  policy_rules_version?: string | null;
  audit_id?: string | null;
  audited_at?: string | null;
  original_input?: string | null;
  row_number?: number | null;
};

type EvidenceCounts = Record<string, number>;

export type AuditReportModel = {
  title: string;
  summaryLine: string;
  distribution: Array<{
    queue: AuditQueue;
    label: string;
    count: number;
    percentage: number;
    meaning: string;
    nextStep: string;
  }>;
  reconciliation: {
    inputRows: number;
    syntaxAccepted: number;
    rejected: number;
    duplicates: number;
    uniqueProcessed: number;
    resultsProduced: number;
    creditsConsumed: number;
  };
  requiredActions: Array<{ action: string; count: number; queue: AuditQueue }>;
  topRiskDrivers: Array<{
    reasonCode: string;
    reason: string;
    count: number;
    percentage: number;
    decisionImpact: string;
    recommendedAction: string;
  }>;
  evidenceCoverage: {
    mx: EvidenceCounts;
    mailbox: EvidenceCounts;
    catch_all: EvidenceCounts;
    statement: string;
  };
  contacts: AuditReportResult[];
  metadata: {
    auditId: string;
    engineVersion: string;
    policyVersion: string;
    auditedAt: string;
    generatedAt: string;
    source: string;
  };
  limitations: string[];
};

function readText(value: unknown, fallback = "Not available"): string {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function readDecision(result: AuditReportResult): string {
  return publicDecisionLabel(result.decision ?? result.risk_level);
}

function resultQueue(result: AuditReportResult): AuditQueue {
  const decision = readDecision(result);
  return decision === "SEND" ? "send" : decision === "SUPPRESS" ? "suppress" : "review";
}

function percent(count: number, total: number): number {
  return total > 0 ? Math.round((count / total) * 1000) / 10 : 0;
}

function countStates(results: AuditReportResult[], key: "mx_status" | "mailbox_status" | "catch_all_status"): EvidenceCounts {
  const counts: EvidenceCounts = {};
  for (const result of results) {
    const state = readText(result[key], "unknown").toLowerCase().replace(/\s+/gu, "_");
    counts[state] = (counts[state] || 0) + 1;
  }
  return counts;
}

export function buildEvidenceCoverage(results: AuditReportResult[]) {
  return {
    mx: countStates(results, "mx_status"),
    mailbox: countStates(results, "mailbox_status"),
    catch_all: countStates(results, "catch_all_status"),
    statement: "Decisions reflect the evidence available at the time of audit. Unknown, untested, and failed lookups remain visible rather than being presented as certainty.",
  };
}

export function buildRequiredActions(results: AuditReportResult[]) {
  const actions = new Map<string, { action: string; count: number; queue: AuditQueue }>();
  for (const result of results) {
    const action = readText(result.recommended_action, "");
    if (!action) continue;
    const queue = resultQueue(result);
    const key = `${queue}:${action}`;
    const existing = actions.get(key);
    if (existing) existing.count += 1;
    else actions.set(key, { action, count: 1, queue });
  }
  return [...actions.values()].sort((a, b) => b.count - a.count || a.action.localeCompare(b.action));
}

function buildTopRiskDrivers(results: AuditReportResult[]) {
  const total = results.length;
  const drivers = new Map<string, { reasonCode: string; reason: string; count: number; sample: AuditReportResult }>();
  for (const result of results) {
    if (resultQueue(result) === "send") continue;
    const reasonCode = readText(result.primary_reason_code, "");
    if (!reasonCode || reasonCode === "UNKNOWN_RISK") continue;
    const existing = drivers.get(reasonCode);
    if (existing) existing.count += 1;
    else drivers.set(reasonCode, { reasonCode, reason: readText(result.primary_reason, reasonCode.replace(/_/gu, " ").toLowerCase()), count: 1, sample: result });
  }
  return [...drivers.values()].sort((a, b) => b.count - a.count || a.reason.localeCompare(b.reason)).map((item) => {
    const impact = resultQueue(item.sample);
    return {
      reasonCode: item.reasonCode,
      reason: item.reason,
      count: item.count,
      percentage: percent(item.count, total),
      decisionImpact: impact === "suppress" ? "Suppress" : "Review",
      recommendedAction: readText(item.sample.recommended_action, impact === "suppress" ? "Keep affected contacts out of the current campaign." : "Review affected contacts before campaign use."),
    };
  });
}

type ReconciliationInput = Partial<Omit<InputReconciliation, "rejected">> & { rejected?: number | InputReconciliation["rejected"] };

export function buildAuditReportModel({
  summary,
  results,
  reconciliation,
  generatedAt = new Date(),
}: {
  summary: ListAuditSummary;
  results: AuditReportResult[];
  reconciliation?: ReconciliationInput | null;
  generatedAt?: Date;
}): AuditReportModel {
  const total = results.length;
  const first = results[0] || {};
  const sourceRows = Array.isArray(reconciliation?.rows) ? reconciliation.rows : [];
  const inputRowsByEmail = new Map<string, (typeof sourceRows)[number]>();
  for (const row of sourceRows) {
    if (row.normalizedValue && !inputRowsByEmail.has(row.normalizedValue)) inputRowsByEmail.set(row.normalizedValue, row);
  }
  const contacts = results.map((result, index) => {
    const row = inputRowsByEmail.get(readText(result.normalized_email ?? result.email, ""));
    return { ...result, original_input: row?.originalValue ?? result.email ?? result.normalized_email ?? null, row_number: row?.rowNumber ?? index + 1 };
  });
  const auditIds = [...new Set(results.map((item) => readText(item.audit_id, "")).filter(Boolean))];
  const engineVersions = [...new Set(results.map((item) => readText(item.engine_version, "")).filter(Boolean))];
  const policyVersions = [...new Set(results.map((item) => readText(item.policy_rules_version, "")).filter(Boolean))];
  const auditTimes = [...new Set(results.map((item) => readText(item.audited_at, "")).filter(Boolean))].sort();
  const sendCount = results.filter((item) => resultQueue(item) === "send").length;
  const reviewCount = results.filter((item) => resultQueue(item) === "review").length;
  const suppressCount = results.filter((item) => resultQueue(item) === "suppress").length;
  const limitations = [
    "Domain evidence is not proof that a specific mailbox exists or will accept a message.",
    "Mailbox evidence is not proof of inbox placement, delivery, engagement, or campaign performance.",
    "Unknown, not-tested, and failed lookups remain limitations and should be reviewed before use.",
  ];
  if (summary.total !== total) limitations.unshift(`The list summary reports ${summary.total} contacts while ${total} contact result rows are available. Treat this report as partial until the source run is reconciled.`);
  const rejected = typeof reconciliation?.rejectedBeforeScreening === "number"
    ? reconciliation.rejectedBeforeScreening
    : typeof reconciliation?.rejected === "number"
      ? reconciliation.rejected
      : Array.isArray(reconciliation?.rejected)
        ? reconciliation.rejected.length
        : 0;

  return {
    title: "Campaign Contact Risk Audit",
    summaryLine: total === 0
      ? "No contact results are available for this report."
      : `${total.toLocaleString("en-US")} unique ${total === 1 ? "contact was" : "contacts were"} audited: ${sendCount.toLocaleString("en-US")} Send, ${reviewCount.toLocaleString("en-US")} Review, and ${suppressCount.toLocaleString("en-US")} Suppress.`,
    distribution: [
      { queue: "send", label: "Send", count: sendCount, percentage: percent(sendCount, total), meaning: "Current evidence supports controlled campaign use; this is not a delivery or inbox guarantee.", nextStep: "Proceed with normal campaign controls." },
      { queue: "review", label: "Review", count: reviewCount, percentage: percent(reviewCount, total), meaning: "Evidence is incomplete, uncertain, or requires human judgment.", nextStep: "Resolve the listed reason before campaign use." },
      { queue: "suppress", label: "Suppress", count: suppressCount, percentage: percent(suppressCount, total), meaning: "A blocking condition applies to the current campaign.", nextStep: "Keep the contact out of this campaign until corrected and re-audited." },
    ],
    reconciliation: {
      inputRows: Number(reconciliation?.inputRows ?? total),
      syntaxAccepted: Number(reconciliation?.syntaxAccepted ?? total),
      rejected,
      duplicates: Number(reconciliation?.duplicatesRemoved ?? 0),
      uniqueProcessed: Number(reconciliation?.uniqueValidAddressesProcessed ?? total),
      resultsProduced: Number(reconciliation?.resultsProduced ?? total),
      creditsConsumed: Number(reconciliation?.creditsConsumed ?? 0),
    },
    requiredActions: buildRequiredActions(results),
    topRiskDrivers: buildTopRiskDrivers(results),
    evidenceCoverage: buildEvidenceCoverage(results),
    contacts,
    metadata: {
      auditId: auditIds.length > 1 ? `${auditIds.length} contact audit IDs; see contact results` : readText(first.audit_id),
      engineVersion: engineVersions.length > 1 ? `Mixed (${engineVersions.length} versions)` : readText(first.engine_version),
      policyVersion: policyVersions.length > 1 ? `Mixed (${policyVersions.length} versions)` : readText(first.policy_rules_version),
      auditedAt: auditTimes.length > 1 ? `${auditTimes[0]} to ${auditTimes[auditTimes.length - 1]}` : readText(first.audited_at),
      generatedAt: generatedAt.toISOString(),
      source: "Secwyn Web List Audit",
    },
    limitations,
  };
}

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/gu, "&amp;")
    .replace(/</gu, "&lt;")
    .replace(/>/gu, "&gt;")
    .replace(/"/gu, "&quot;")
    .replace(/'/gu, "&#39;");
}

function tableRows(items: Array<Array<unknown>>): string {
  return items.map((cells) => `<tr>${cells.map((cell) => `<td>${escapeHtml(cell)}</td>`).join("")}</tr>`).join("");
}

function booleanEvidence(value: unknown): string {
  return value === true ? "Yes" : value === false ? "No" : "Unknown";
}

function technicalContext(item: AuditReportResult): string {
  return [
    `Explanation: ${readText(item.decision_explanation)}`,
    `Disposable: ${booleanEvidence(item.disposable)}`,
    `Role-based: ${booleanEvidence(item.role_based)}`,
    `Engine: ${readText(item.engine_version)}`,
    `Policy: ${readText(item.policy_rules_version)}`,
    `Audited: ${readText(item.audited_at)}`,
  ].join(" | ");
}

export function buildClientReportHtml(model: AuditReportModel): string {
  const queueCards = model.distribution.map((item) => `<article class="card keep"><h3>${escapeHtml(item.label)}</h3><strong>${item.count.toLocaleString("en-US")} (${item.percentage}%)</strong><p>${escapeHtml(item.meaning)}</p><p><b>Next:</b> ${escapeHtml(item.nextStep)}</p></article>`).join("");
  const actions = model.requiredActions.length
    ? model.requiredActions.map((item) => `<li><b>${item.count.toLocaleString("en-US")} ${escapeHtml(item.queue)}</b> - ${escapeHtml(item.action)}</li>`).join("")
    : "<li>No additional action is required by the available result rows.</li>";
  const drivers = model.topRiskDrivers.length
    ? tableRows(model.topRiskDrivers.map((item) => [item.reason, item.count, `${item.percentage}%`, item.decisionImpact, item.recommendedAction]))
    : '<tr><td colspan="5">No negative primary reason was recorded.</td></tr>';
  const contacts = model.contacts.length
    ? tableRows(model.contacts.map((item) => [item.row_number, item.original_input, item.normalized_email ?? item.email, readDecision(item), item.risk_score ?? "", item.primary_reason, item.recommended_action, item.mx_status, item.mailbox_status, item.catch_all_status, technicalContext(item), item.audit_id]))
    : '<tr><td colspan="12">No contact results are available.</td></tr>';
  const stateList = (counts: EvidenceCounts) => Object.entries(counts).map(([state, count]) => `${state.replace(/_/gu, " ")}: ${count}`).join("; ") || "No results";

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(model.title)} - Secwyn</title>
<style>
@page{margin:14mm}*{box-sizing:border-box}body{margin:0;background:#f5f1e8;color:#101a2b;font:14px/1.55 Arial,sans-serif}.report{max-width:1120px;margin:0 auto;padding:32px}.brand{background:#081424;color:#fff;padding:24px;border-radius:18px}.brand small{color:#a8bacb}.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}.card,.section{background:#fff;border:1px solid #d8dee7;border-radius:16px;padding:16px;margin-top:16px}.section h2{margin-top:0}.scroll{width:100%;max-width:100%;overflow-x:auto}table{width:100%;border-collapse:collapse;font-size:12px}th,td{border:1px solid #d8dee7;padding:7px;text-align:left;vertical-align:top;overflow-wrap:anywhere;word-break:break-word}th{background:#eef3f7}thead{display:table-header-group}.muted{color:#5a687a}.meta{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.keep{break-inside:avoid}.page-break{break-before:page}footer{margin-top:24px;border-top:1px solid #d8dee7;padding-top:12px;color:#5a687a}@media(max-width:720px){.report{padding:16px}.grid,.meta{grid-template-columns:1fr}}@media print{body{background:#fff}.report{max-width:none;padding:0}.brand{border-radius:0}.section,.card{box-shadow:none}.no-print{display:none!important}a{color:inherit;text-decoration:none}}
</style></head><body><main class="report">
<header class="brand keep"><small>SECWYN · PRE-SEND RISK GOVERNANCE</small><h1>${escapeHtml(model.title)}</h1><p>${escapeHtml(model.summaryLine)}</p></header>
<section class="section keep"><h2>Executive Audit Summary</h2><div class="grid">${queueCards}</div></section>
<section class="section keep"><h2>Input Reconciliation</h2><div class="meta"><div>Input rows: <b>${model.reconciliation.inputRows}</b></div><div>Syntax accepted: <b>${model.reconciliation.syntaxAccepted}</b></div><div>Rejected: <b>${model.reconciliation.rejected}</b></div><div>Duplicates: <b>${model.reconciliation.duplicates}</b></div><div>Unique processed: <b>${model.reconciliation.uniqueProcessed}</b></div><div>Results: <b>${model.reconciliation.resultsProduced}</b></div><div>Credits consumed by audit: <b>${model.reconciliation.creditsConsumed}</b></div></div></section>
<section class="section keep"><h2>Required Actions</h2><ol>${actions}</ol></section>
<section class="section"><h2>Top Risk Drivers</h2><div class="scroll"><table><thead><tr><th>Reason</th><th>Count</th><th>Affected</th><th>Decision impact</th><th>Recommended action</th></tr></thead><tbody>${drivers}</tbody></table></div></section>
<section class="section keep"><h2>Evidence Coverage</h2><p>MX: ${escapeHtml(stateList(model.evidenceCoverage.mx))}</p><p>Mailbox: ${escapeHtml(stateList(model.evidenceCoverage.mailbox))}</p><p>Catch-all: ${escapeHtml(stateList(model.evidenceCoverage.catch_all))}</p><p class="muted">${escapeHtml(model.evidenceCoverage.statement)}</p></section>
<section class="section page-break"><h2>Contact-level Results</h2><div class="scroll"><table><thead><tr><th>Row</th><th>Original input</th><th>Normalized email</th><th>Decision</th><th>Score</th><th>Primary reason</th><th>Recommended action</th><th>MX</th><th>Mailbox</th><th>Catch-all</th><th>Technical context</th><th>Audit ID</th></tr></thead><tbody>${contacts}</tbody></table></div></section>
<section class="section keep"><h2>Methodology and Evidence Limitations</h2><p>Secwyn applies the recorded engine and policy versions to available contact, domain, DNS and mailbox evidence. Send, Review and Suppress are operational decisions, not outcome guarantees.</p><ul>${model.limitations.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul></section>
<section class="section keep"><h2>Audit Metadata</h2><div class="meta"><div>Audit ID: <b>${escapeHtml(model.metadata.auditId)}</b></div><div>Audited at: <b>${escapeHtml(model.metadata.auditedAt)}</b></div><div>Engine version: <b>${escapeHtml(model.metadata.engineVersion)}</b></div><div>Policy version: <b>${escapeHtml(model.metadata.policyVersion)}</b></div><div>Report generated: <b>${escapeHtml(model.metadata.generatedAt)}</b></div><div>Result source: <b>${escapeHtml(model.metadata.source)}</b></div></div></section>
<footer><b>Secwyn</b> · support@secwyn.com<br>Generated from the recorded audit results. Viewing, downloading, or printing this report does not consume contact credits.</footer>
</main></body></html>`;
}

export type AuditReportFormat = {
  sendLabel: string;
  reviewLabel: string;
  suppressLabel: string;
  generatedAtLabel: string;
  summaryLine: string;
};

export function formatAuditReport(summary: ListAuditSummary, generatedAt = new Date()): AuditReportFormat {
  return {
    sendLabel: `${summary.sendCount.toLocaleString("en-US")} (${percent(summary.sendCount, summary.total)}%)`,
    reviewLabel: `${summary.reviewCount.toLocaleString("en-US")} (${percent(summary.reviewCount, summary.total)}%)`,
    suppressLabel: `${summary.suppressCount.toLocaleString("en-US")} (${percent(summary.suppressCount, summary.total)}%)`,
    generatedAtLabel: generatedAt.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" }),
    summaryLine: summary.total === 0 ? "No contact results are available." : `${summary.total.toLocaleString("en-US")} unique contacts were audited.`,
  };
}
