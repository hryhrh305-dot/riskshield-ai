"use client";

import { BadgeInfo, Download, FileText, Printer, ShieldCheck, TriangleAlert } from "lucide-react";
import { useMemo } from "react";
import type { InputReconciliation } from "@/lib/decision-integrity";
import type { ListAuditSummary } from "@/lib/list-audit";
import { buildAuditReportModel, type AuditReportResult } from "@/lib/audit/report-format";

type AuditReportPreviewProps = {
  summary: ListAuditSummary;
  results: AuditReportResult[];
  reconciliation?: Partial<InputReconciliation> | null;
  onDownloadHtml: () => void;
  onPrint: () => void;
};

const queueTone = {
  send: "border-emerald-500/15 bg-emerald-500/[0.08] text-emerald-100",
  review: "border-amber-500/15 bg-amber-500/[0.08] text-amber-100",
  suppress: "border-red-500/15 bg-red-500/[0.08] text-red-100",
};

function stateLine(counts: Record<string, number>) {
  const entries = Object.entries(counts);
  return entries.length
    ? entries.map(([state, count]) => `${state.replace(/_/g, " ")}: ${count}`).join(" · ")
    : "No results";
}

function reportDecisionTone(value: unknown): "allow" | "review" | "block" {
  const decision = String(value || "REVIEW").toUpperCase();
  return decision === "ALLOW" ? "allow" : decision === "BLOCK" ? "block" : "review";
}

export function AuditReportPreview({
  summary,
  results,
  reconciliation,
  onDownloadHtml,
  onPrint,
}: AuditReportPreviewProps) {
  const report = useMemo(() => buildAuditReportModel({ summary, results, reconciliation }), [summary, results, reconciliation]);
  const previewContacts = report.contacts.slice(0, 20);

  return (
    <section className="secwyn-print-report rs-card rs-card-hover mb-6 overflow-hidden rounded-[28px] border border-white/10 bg-gradient-to-br from-white/[0.045] to-black/[0.2]" aria-labelledby="audit-report-title">
      <header className="border-b border-white/8 px-5 py-5 sm:px-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.035] px-3 py-1 text-[11px] uppercase tracking-[0.22em] text-slate-400">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-300" /> Secwyn client-ready report
            </div>
            <h2 id="audit-report-title" className="mt-3 text-xl font-semibold text-white sm:text-2xl">Campaign Contact Risk Audit</h2>
            <p className="mt-2 text-sm leading-6 text-slate-300">{report.summaryLine}</p>
            <p className="mt-2 text-xs leading-5 text-slate-500">Decision support based on available evidence; not a delivery, inbox, revenue, or compliance guarantee.</p>
          </div>
          <div className="report-actions no-print flex flex-col gap-2 sm:flex-row">
            <button type="button" onClick={onDownloadHtml} className="rounded-full border border-white/12 bg-white/6 px-4 py-2 text-sm font-medium text-slate-100 hover:bg-white/10">
              <span className="inline-flex items-center gap-2"><Download className="h-4 w-4" /> Download HTML</span>
            </button>
            <button type="button" onClick={onPrint} className="rounded-full border border-white/12 bg-white/6 px-4 py-2 text-sm font-medium text-slate-100 hover:bg-white/10">
              <span className="inline-flex items-center gap-2"><Printer className="h-4 w-4" /> Print / Save PDF</span>
            </button>
          </div>
        </div>
      </header>

      <div className="space-y-5 px-5 py-5 sm:px-6">
        <section className="report-section" aria-labelledby="decision-distribution-title">
          <h3 id="decision-distribution-title" className="text-sm font-semibold text-white">Executive Audit Summary</h3>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
            {report.distribution.map((item) => (
              <article key={item.queue} className={`report-keep rounded-2xl border p-4 ${queueTone[item.queue]}`}>
                <div className="text-[11px] uppercase tracking-[0.2em] opacity-70">{item.label}</div>
                <div className="mt-2 text-2xl font-semibold">{item.count.toLocaleString()} <span className="text-sm font-normal opacity-70">({item.percentage}%)</span></div>
                <p className="mt-2 text-xs leading-5 opacity-80">{item.meaning}</p>
                <p className="mt-2 text-xs leading-5"><span className="font-semibold">Next:</span> {item.nextStep}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="report-section report-keep rounded-2xl border border-white/10 bg-black/20 p-4" aria-labelledby="reconciliation-title">
          <h3 id="reconciliation-title" className="text-sm font-semibold text-white">Input Reconciliation</h3>
          <div className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4 lg:grid-cols-7">
            {[
              ["Input rows", report.reconciliation.inputRows],
              ["Syntax accepted", report.reconciliation.syntaxAccepted],
              ["Rejected", report.reconciliation.rejected],
              ["Duplicates", report.reconciliation.duplicates],
              ["Unique processed", report.reconciliation.uniqueProcessed],
              ["Results", report.reconciliation.resultsProduced],
              ["Credits consumed", report.reconciliation.creditsConsumed],
            ].map(([label, value]) => <div key={String(label)}><div className="text-[11px] text-slate-500">{label}</div><div className="mt-1 font-semibold text-slate-100">{Number(value).toLocaleString()}</div></div>)}
          </div>
        </section>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <section className="report-section report-keep rounded-2xl border border-white/10 bg-black/20 p-4" aria-labelledby="required-actions-title">
            <h3 id="required-actions-title" className="flex items-center gap-2 text-sm font-semibold text-white"><FileText className="h-4 w-4 text-slate-400" /> Required Actions</h3>
            {report.requiredActions.length ? (
              <ol className="mt-3 space-y-2">
                {report.requiredActions.slice(0, 8).map((item) => (
                  <li key={`${item.queue}:${item.action}`} className="rounded-xl border border-white/8 bg-white/[0.03] px-3 py-2 text-sm leading-6 text-slate-300">
                    <span className="font-semibold text-white">{item.count.toLocaleString()} {item.count === 1 ? "contact" : "contacts"}</span> · {item.action}
                  </li>
                ))}
              </ol>
            ) : <p className="mt-3 text-sm text-slate-500">No additional action is required by the available result rows.</p>}
          </section>

          <section className="report-section report-keep rounded-2xl border border-white/10 bg-black/20 p-4" aria-labelledby="top-risk-title">
            <h3 id="top-risk-title" className="flex items-center gap-2 text-sm font-semibold text-white"><TriangleAlert className="h-4 w-4 text-amber-300" /> Top Risk Drivers</h3>
            {report.topRiskDrivers.length ? (
              <div className="mt-3 space-y-2">
                {report.topRiskDrivers.slice(0, 8).map((item) => (
                  <div key={item.reasonCode} className="rounded-xl border border-white/8 bg-white/[0.03] p-3">
                    <div className="flex items-start justify-between gap-3"><span className="text-sm font-medium text-white">{item.reason}</span><span className="text-xs text-slate-400">{item.count} · {item.percentage}%</span></div>
                    <div className="mt-1 text-xs text-slate-500">Impact: {item.decisionImpact} · {item.recommendedAction}</div>
                  </div>
                ))}
              </div>
            ) : <p className="mt-3 text-sm text-slate-500">No negative primary reason was recorded.</p>}
          </section>
        </div>

        <section className="report-section report-keep rounded-2xl border border-white/10 bg-black/20 p-4" aria-labelledby="coverage-title">
          <h3 id="coverage-title" className="flex items-center gap-2 text-sm font-semibold text-white"><BadgeInfo className="h-4 w-4 text-slate-400" /> Evidence Coverage</h3>
          <div className="mt-3 grid grid-cols-1 gap-3 text-sm sm:grid-cols-3">
            <div><span className="text-slate-500">MX:</span> <span className="text-slate-200">{stateLine(report.evidenceCoverage.mx)}</span></div>
            <div><span className="text-slate-500">Mailbox:</span> <span className="text-slate-200">{stateLine(report.evidenceCoverage.mailbox)}</span></div>
            <div><span className="text-slate-500">Catch-all:</span> <span className="text-slate-200">{stateLine(report.evidenceCoverage.catch_all)}</span></div>
          </div>
          <p className="mt-3 text-xs leading-5 text-slate-500">{report.evidenceCoverage.statement}</p>
        </section>

        <section className="report-section report-contact-results" aria-labelledby="contact-evidence-title">
          <div className="flex items-end justify-between gap-3">
            <div><h3 id="contact-evidence-title" className="text-sm font-semibold text-white">Contact-level Results</h3><p className="mt-1 text-xs text-slate-500">Showing the first {previewContacts.length.toLocaleString()} accepted unique contacts in uploaded order ({report.contacts.length.toLocaleString()} total). The HTML and CSV/XLSX exports retain the full result set.</p></div>
          </div>
          <div className="report-contact-scroll mt-3 overflow-x-auto rounded-2xl border border-white/10">
            <table className="report-contact-table w-full min-w-[900px] text-left text-xs">
              <thead className="bg-black/40 text-slate-400"><tr><th className="p-3">Row</th><th className="p-3">Original input</th><th className="p-3">Normalized email</th><th className="p-3">Decision</th><th className="p-3">Score</th><th className="p-3">Primary reason</th><th className="p-3">Recommended action</th><th className="p-3">Evidence state</th><th className="p-3">Technical context</th></tr></thead>
              <tbody>
                {previewContacts.map((item, index) => {
                  const decision = String(item.decision || item.risk_level || "REVIEW").toUpperCase();
                  return <tr key={`${String(item.audit_id || item.email)}:${index}`} className="border-t border-white/8">
                    <td data-label="Row" className="p-3 text-slate-500">{String(item.row_number ?? index + 1)}</td>
                    <td data-label="Original input" className="break-all p-3 font-mono text-slate-200">{String(item.original_input || item.email || "Not available")}</td>
                    <td data-label="Normalized email" className="break-all p-3 font-mono text-slate-300">{String(item.normalized_email || item.email || "Not available")}</td>
                    <td data-label="Decision" className={`report-decision report-decision-${reportDecisionTone(decision)} p-3 font-semibold text-slate-200`}>{decision}</td>
                    <td data-label="Score" className="p-3 text-slate-200">{String(item.risk_score ?? "")}</td>
                    <td data-label="Primary reason" className="p-3 text-slate-300">{String(item.primary_reason || "Not available")}</td>
                    <td data-label="Recommended action" className="p-3 text-slate-300">{String(item.recommended_action || "Not available")}</td>
                    <td data-label="Evidence state" className="p-3 text-slate-400">MX {String(item.mx_status || "unknown")} · Mailbox {String(item.mailbox_status || "unknown")} · Catch-all {String(item.catch_all_status || "unknown")}</td>
                    <td data-label="Technical context" className="p-3 text-slate-400">
                      <div className="report-contact-detail">
                        <div>{String(item.decision_explanation || "No additional explanation recorded")}</div>
                        <div className="mt-1">Disposable {item.disposable === true ? "Yes" : item.disposable === false ? "No" : "Unknown"} · Role-based {item.role_based === true ? "Yes" : item.role_based === false ? "No" : "Unknown"}</div>
                        <div className="mt-1">Engine {String(item.engine_version || "Not available")} · Policy {String(item.policy_rules_version || "Not available")} · Audited {String(item.audited_at || "Not available")}</div>
                      </div>
                    </td>
                  </tr>;
                })}
              </tbody>
            </table>
          </div>
        </section>

        <section className="report-section report-keep grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-white/10 bg-black/20 p-4"><h3 className="text-sm font-semibold text-white">Evidence Limitations</h3><ul className="mt-3 space-y-2 text-xs leading-5 text-slate-400">{report.limitations.map((item) => <li key={item}>- {item}</li>)}</ul></div>
          <div className="rounded-2xl border border-white/10 bg-black/20 p-4"><h3 className="text-sm font-semibold text-white">Audit metadata</h3><dl className="mt-3 space-y-1 text-xs text-slate-400"><div><dt className="inline text-slate-500">Audit ID: </dt><dd className="inline break-all">{report.metadata.auditId}</dd></div><div><dt className="inline text-slate-500">Audited at: </dt><dd className="inline">{report.metadata.auditedAt}</dd></div><div><dt className="inline text-slate-500">Engine: </dt><dd className="inline">{report.metadata.engineVersion}</dd></div><div><dt className="inline text-slate-500">Policy: </dt><dd className="inline">{report.metadata.policyVersion}</dd></div><div><dt className="inline text-slate-500">Report generated: </dt><dd className="inline">{report.metadata.generatedAt}</dd></div></dl></div>
        </section>

        <footer className="report-keep border-t border-white/10 pt-4 text-xs leading-5 text-slate-500"><div className="font-semibold text-slate-300">Secwyn</div><div>support@secwyn.com</div><div>Viewing, downloading, or printing this report does not consume contact credits.</div></footer>
      </div>
    </section>
  );
}
