"use client";

import { useState, type DragEvent } from "react";
import * as XLSXLib from "xlsx";
import Link from "next/link";
import { Upload, FileText, Download, CheckCircle, AlertTriangle, XCircle, ArrowRight, BarChart3 } from "lucide-react";
import { buildCsvContent, downloadCsvFile, type CsvColumn } from "@/lib/export/csv";
import type { AuditEvidence, ListAuditSummary } from "@/lib/list-audit";
import { AuditReportPreview } from "@/components/audit/AuditReportPreview";
import { chunkWebBulkEmails, getDroppedWebBulkFile, mergeWebBulkResponses, readWebBulkFileInput, reconcileWebBulkText, runWebBulkBatches, type WebBulkFile } from "@/lib/bulk-web-batching";
import { trackE8Event } from "@/components/e8/AttributionObserver";
import { getPlanAuditCta, statusLabel, type InputReconciliation } from "@/lib/decision-integrity";

interface BulkResult extends Record<string, unknown> {
  audit_queue?: string;
  reason_codes?: string[];
  primary_reason?: string;
  recommended_action?: string;
  business_impact?: string;
  confidence?: number;
  evidence?: AuditEvidence[];
  impact?: string[];
  reasons?: string[];
  recommendation?: string;
  risk_factors?: string[];
  ai_explanation?: string | null;
  decision_explanation?: string | null;
  email: string;
  risk_score: number;
  health_score?: number | null;
  decision?: string;
  risk_level?: string;
  disposable?: boolean | null;
  role_based?: boolean | null;
  catch_all?: boolean | null;
  hasMX?: boolean;
  mxChecked?: boolean;
  mx_status?: string | null;
  mailbox_status?: string | null;
  catch_all_status?: string | null;
  domain_age?: { ageDays?: number | null } | null;
  dns_health?: { score?: number | null } | null;
  estimated_bounce_rate?: string | null;
  inbox_probability?: string | null;
  sender_reputation_risk?: string | null;
  estimated_waste_cost?: number | null;
  dmarc_policy?: string | null;
  dkim_selector?: string | null;
  mx_records?: string | null;
}

interface ExportColumn {
  key: string;
  label: string;
}

interface BulkApiError {
  error?: string;
  message?: string;
  upgradeNeeded?: boolean;
  plan?: string;
}

interface BulkApiResponse extends BulkApiError {
  results?: BulkResult[];
  summary?: Record<string, number>;
  export_columns?: ExportColumn[];
  audit_summary?: ListAuditSummary;
  plan?: string;
  credits?: { deducted?: number; remaining?: number };
}

type AuditQueue = "send" | "review" | "suppress";

export default function BulkCheckPage() {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [results, setResults] = useState<BulkResult[] | null>(null);
  const [summary, setSummary] = useState<Record<string, number> | null>(null);
  const [auditSummary, setAuditSummary] = useState<ListAuditSummary | null>(null);
  const [error, setError] = useState("");
  const [upgradeNeeded, setUpgradeNeeded] = useState(false);
  const [xlsxDownloading, setXlsxDownloading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [inputReconciliation, setInputReconciliation] = useState<InputReconciliation | null>(null);
  const [resultPlan, setResultPlan] = useState("");
  const [exportColumns, setExportColumns] = useState<ExportColumn[]>([
    { key: "email", label: "Email" },
    { key: "decision", label: "Final Decision" },
    { key: "risk_score", label: "Base Signal Score" },
  ]);
  const auditCta = getPlanAuditCta(resultPlan);
  const hasClientReadyReport = ["growth", "scale", "business"].includes(resultPlan.toLowerCase());

  function readExportValue(result: BulkResult, key: string) {
    if (key === "risk_level") return result.risk_level || result.decision || "";
    if (key === "disposable") return statusLabel(result.disposable, "Unknown");
    if (key === "role_based") return statusLabel(result.role_based, "Unknown");
    if (key === "reasons") return (result.reasons || []).join("; ");
    if (key === "impact") return (result.impact || []).join(" | ");
    if (key === "risk_factors") return (result.risk_factors || []).join(" | ");
    if (key === "audit_queue") return result.audit_queue || result.decision || result.risk_level || "";
    if (key === "reason_codes") return (result.reason_codes || []).join("; ");
    if (key === "primary_reason") return result.primary_reason || "";
    if (key === "recommended_action") return result.recommended_action || "";
    if (key === "business_impact") return result.business_impact || "";
    if (key === "decision_explanation") return result.decision_explanation || "";
    if (key === "confidence") return result.confidence ?? "";
    if (key === "evidence_summary") {
      if (result.evidence?.length) {
        return result.evidence.map((item) => `${item.signal}: ${item.explanation}`).join("; ");
      }
      return (result.reason_codes || result.reasons || []).join("; ");
    }
    if (key === "mx_status") {
      if (result.mx_status) return statusLabel(result.mx_status, String(result.mx_status));
      if (!result.mxChecked) return "Not checked";
      return result.hasMX ? "Present" : "Missing";
    }
    if (key === "catch_all") return statusLabel(result.catch_all_status || result.catch_all, "Unknown");
    if (key === "domain_age_days") return result.domain_age?.ageDays ?? "";
    if (key === "dns_health_score") return result.dns_health?.score ?? "";
    if (key === "estimated_waste_cost") return result.estimated_waste_cost ?? "";

    const value = result[key as keyof BulkResult];
    if (Array.isArray(value)) return value.join("; ");
    if (typeof value === "boolean") return value ? "Yes" : "No";
    return value == null ? "" : String(value);
  }

  const scoreColor = (score: number) => score >= 66 ? "text-red-300" : score >= 26 ? "text-amber-300" : "text-emerald-300";
  const decisionBadge = (decision: string) => decision === "BLOCK" ? "rs-badge-block" : decision === "REVIEW" ? "rs-badge-review" : "rs-badge-allow";

  function normalizeAuditQueue(result: BulkResult): AuditQueue {
    const raw = String(result.audit_queue || result.risk_level || result.decision || "").toLowerCase();
    if (raw === "send" || raw === "allow") return "send";
    if (raw === "review" || raw === "caution" || raw === "launch_with_caution") return "review";
    return "suppress";
  }

  function renderCell(result: BulkResult, column: ExportColumn) {
    const value = readExportValue(result, column.key);
    const decision = result.risk_level || result.decision || "";

    if (column.key === "email") {
      const priority = new Set(["email", "decision", "confidence", "primary_reason", "recommended_action"]);
      const technicalColumns = visibleExportColumns.filter((item) => !priority.has(item.key));
      return (
        <div>
          <span className="break-all font-mono text-slate-200">{String(value)}</span>
          {technicalColumns.length > 0 && (
            <details className="mt-2">
              <summary className="cursor-pointer text-[11px] text-slate-400">Technical evidence</summary>
              <dl className="mt-2 space-y-1 text-[11px] text-slate-400">
                {technicalColumns.map((item) => <div key={item.key}><dt className="inline text-slate-500">{item.label}: </dt><dd className="inline">{String(readExportValue(result, item.key) || "Not available")}</dd></div>)}
              </dl>
            </details>
          )}
        </div>
      );
    }

    if (column.key === "risk_score") {
      return <span className={`font-bold ${scoreColor(Number(result.risk_score || 0))}`}>{String(value)}</span>;
    }

    if (column.key === "risk_level" || column.key === "decision") {
      return <span className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${decisionBadge(decision)}`}>{String(value)}</span>;
    }

    if (column.key === "reasons" || column.key === "risk_factors" || column.key === "impact") {
      const parts = Array.isArray(result[column.key as keyof BulkResult])
        ? (result[column.key as keyof BulkResult] as string[])
        : String(value || "")
            .split(/;|\|/)
            .map((item) => item.trim())
            .filter(Boolean);

      if (!parts.length) {
        return <span className="text-slate-500">-</span>;
      }

      return (
        <div className="flex max-w-[320px] flex-wrap gap-1.5">
          {parts.slice(0, 4).map((part, index) => (
            <span
              key={`${column.key}-${index}`}
              className={`rounded-full border px-2 py-1 text-[11px] leading-4 ${
                column.key === "impact"
                  ? "border-amber-500/15 bg-amber-500/8 text-amber-200"
                  : "border-white/10 bg-white/[0.045] text-slate-300"
              }`}
            >
              {part}
            </span>
          ))}
          {parts.length > 4 && (
            <span className="rounded-full border border-white/10 bg-white/[0.03] px-2 py-1 text-[11px] text-slate-500">
              +{parts.length - 4} more
            </span>
          )}
        </div>
      );
    }

    if (column.key === "disposable" || column.key === "role_based" || column.key === "catch_all") {
      const normalized = String(value).toLowerCase();
      if (!["yes", "no", "true", "false"].includes(normalized)) return <span className="text-slate-500">{String(value || "Unknown")}</span>;
      const truthy = normalized === "yes" || normalized === "true";
      return truthy
        ? <span className="inline-flex items-center gap-1.5 text-red-300"><XCircle className="h-4 w-4" /> Yes</span>
        : <span className="inline-flex items-center gap-1.5 text-emerald-300"><CheckCircle className="h-4 w-4" /> No</span>;
    }

    if (column.key === "mx_status") {
      if (["Not checked", "Lookup failed", "Timed out", "Unknown"].includes(String(value))) return <span className="text-slate-500">{String(value)}</span>;
      return value === "Present"
        ? <span className="inline-flex items-center gap-1.5 text-emerald-300"><CheckCircle className="h-4 w-4" /> Present</span>
        : <span className="inline-flex items-center gap-1.5 text-red-300"><XCircle className="h-4 w-4" /> {String(value)}</span>;
    }

    const textColor =
      column.key === "impact" ? "text-amber-200" :
      column.key === "reasons" ? "text-slate-500" :
      "text-slate-300";

    return <span className={`${textColor} whitespace-pre-wrap break-words`}>{String(value || "-")}</span>;
  }

  async function scanInBatches(reconciliation: InputReconciliation) {
    const e8RunId = crypto.randomUUID();
    const chunks = chunkWebBulkEmails(reconciliation.accepted);
    const responses = await runWebBulkBatches(chunks, async (chunk) => {
      const res = await fetch("/api/bulk-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emails: chunk }),
      });
      const data: BulkApiResponse = await res.json();
      if (!res.ok) {
        const failure = new Error(data.message || data.error || "Check failed") as Error & { upgradeNeeded?: boolean };
        failure.upgradeNeeded = !!data.upgradeNeeded;
        throw failure;
      }
      return data;
    }, (completed, total) => {
      setStatusMessage(`Scanning batch ${completed} of ${total}...`);
    });
    const merged = mergeWebBulkResponses(responses);
    setResults(merged.results as BulkResult[]);
    setSummary(merged.summary);
    setAuditSummary(merged.audit_summary);
    setResultPlan(merged.plan || "");
    setInputReconciliation({ ...reconciliation, resultsProduced: merged.results.length, creditsConsumed: merged.creditsDeducted });
    setExportColumns(merged.export_columns.length ? merged.export_columns : exportColumns);
    setStatusMessage(`Scan complete. ${merged.results.length.toLocaleString()} unique emails checked.`);
    try {
      trackE8Event("bulk_check_completed", { count: merged.results.length }, `bulk:${e8RunId}`);
      trackE8Event("activation_completed", { channel: "bulk" }, `activation:bulk:${e8RunId}`);
    } catch {
      // E8 must never alter a successful bulk result or its downloads.
    }
  }

  async function handleFile(file: WebBulkFile) {
    setLoading(true);
    setError("");
    setUpgradeNeeded(false);
    setResults(null);
    setSummary(null);
    setAuditSummary(null);
    setStatusMessage("Reading file...");
    try {
      await scanInBatches(await readWebBulkFileInput(file));
    } catch (caught) {
      const failure = caught as Error & { upgradeNeeded?: boolean };
      setUpgradeNeeded(!!failure.upgradeNeeded);
      setError(failure.message || "Network error");
      setStatusMessage("Scan failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  function handleDragOver(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = "copy";
    setDragOver(true);
  }

  function handleDragLeave(event: DragEvent<HTMLDivElement>) {
    if (event.relatedTarget instanceof Node && event.currentTarget.contains(event.relatedTarget)) return;
    setDragOver(false);
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    event.stopPropagation();
    setDragOver(false);
    const file = getDroppedWebBulkFile(event.dataTransfer);
    if (!file) {
      setError("No readable file was dropped. Please try again or use Browse Files.");
      return;
    }
    void handleFile(file);
  }

  async function handlePaste() {
    if (!text.trim()) {
      setError("Paste emails one per line or separated by spaces, or upload a CSV, TXT, or XLSX file.");
      return;
    }
    setLoading(true);
    setError("");
    setUpgradeNeeded(false);
    setResults(null);
    setSummary(null);
    setAuditSummary(null);
    setStatusMessage("Scanning pasted emails and building the report...");
    try {
      await scanInBatches(reconcileWebBulkText(text));
    } catch (caught) {
      const failure = caught as Error & { upgradeNeeded?: boolean };
      setUpgradeNeeded(!!failure.upgradeNeeded);
      setError(failure.message || "Network error");
      setStatusMessage("Scan failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function downloadXLSX() {
    if (!results || results.length === 0) return;
    setXlsxDownloading(true);
    try {
      const data: Array<Array<string | number>> = [exportColumns.map((column) => column.label)];
      for (const result of results) {
        data.push(exportColumns.map((column) => readExportValue(result, column.key)));
      }
      const ws = XLSXLib.utils.aoa_to_sheet(data);
      const wb = XLSXLib.utils.book_new();
      XLSXLib.utils.book_append_sheet(wb, ws, "Secwyn Results");
      XLSXLib.writeFile(wb, "secwyn-results.xlsx");
    } catch (e) {
      console.error("XLSX failed:", e);
    } finally {
      setXlsxDownloading(false);
    }
  }

  function exportCSV(filter: "all" | "clean" | "risky") {
    if (!results) return;
    const filtered = filter === "all"
      ? results
      : filter === "clean"
        ? results.filter((result) => (result.risk_level || result.decision) === "ALLOW")
        : results.filter((result) => {
            const level = result.risk_level || result.decision;
            return level === "REVIEW" || level === "BLOCK";
          });

    const header = exportColumns.map((column) => `"${column.label.replace(/"/g, "\"\"")}"`).join(",");
    const rows = filtered.map((result) => exportColumns.map((column) => {
      const value = String(readExportValue(result, column.key)).replace(/"/g, "\"\"");
      return `"${value}"`;
    }).join(","));
    const csv = header + "\n" + rows.join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${filter}_list.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function getAuditResults(queue: AuditQueue) {
    if (!results) return [];
    return results.filter((result) => normalizeAuditQueue(result) === queue);
  }

  function downloadAuditCsv(queue: AuditQueue) {
    if (!results) return;

    const columnsByQueue: Record<AuditQueue, Array<CsvColumn<BulkResult>>> = {
      send: [
        { key: "email", label: "Email" },
        { key: "audit_queue", label: "Audit Queue", format: (row) => row.audit_queue || normalizeAuditQueue(row) },
        { key: "confidence", label: "Confidence", format: (row) => row.confidence ?? "" },
        { key: "primary_reason", label: "Primary Reason", format: (row) => row.primary_reason || readExportValue(row, "primary_reason") },
        { key: "recommended_action", label: "Recommended Action", format: (row) => row.recommended_action || readExportValue(row, "recommended_action") },
        { key: "business_impact", label: "Business Impact", format: (row) => row.business_impact || readExportValue(row, "business_impact") },
        { key: "decision", label: "Decision", format: (row) => row.decision || row.risk_level || "" },
        { key: "risk_score", label: "Base Signal Score", format: (row) => row.risk_score ?? "" },
        { key: "risk_level", label: "Final Decision", format: (row) => row.risk_level || row.decision || "" },
      ],
      review: [
        { key: "email", label: "Email" },
        { key: "audit_queue", label: "Audit Queue", format: (row) => row.audit_queue || normalizeAuditQueue(row) },
        { key: "confidence", label: "Confidence", format: (row) => row.confidence ?? "" },
        { key: "reason_codes", label: "Reason Codes", format: (row) => (row.reason_codes || []).join("; ") },
        { key: "primary_reason", label: "Primary Reason", format: (row) => row.primary_reason || readExportValue(row, "primary_reason") },
        { key: "business_impact", label: "Business Impact", format: (row) => row.business_impact || readExportValue(row, "business_impact") },
        { key: "recommended_action", label: "Recommended Action", format: (row) => row.recommended_action || readExportValue(row, "recommended_action") },
        { key: "evidence_summary", label: "Evidence Summary", format: (row) => readExportValue(row, "evidence_summary") },
        { key: "decision", label: "Decision", format: (row) => row.decision || row.risk_level || "" },
        { key: "risk_score", label: "Base Signal Score", format: (row) => row.risk_score ?? "" },
        { key: "risk_level", label: "Final Decision", format: (row) => row.risk_level || row.decision || "" },
      ],
      suppress: [
        { key: "email", label: "Email" },
        { key: "audit_queue", label: "Audit Queue", format: (row) => row.audit_queue || normalizeAuditQueue(row) },
        { key: "confidence", label: "Confidence", format: (row) => row.confidence ?? "" },
        { key: "reason_codes", label: "Reason Codes", format: (row) => (row.reason_codes || []).join("; ") },
        { key: "primary_reason", label: "Primary Reason", format: (row) => row.primary_reason || readExportValue(row, "primary_reason") },
        { key: "business_impact", label: "Business Impact", format: (row) => row.business_impact || readExportValue(row, "business_impact") },
        { key: "recommended_action", label: "Recommended Action", format: (row) => row.recommended_action || readExportValue(row, "recommended_action") },
        { key: "evidence_summary", label: "Evidence Summary", format: (row) => readExportValue(row, "evidence_summary") },
        { key: "decision", label: "Decision", format: (row) => row.decision || row.risk_level || "" },
        { key: "risk_score", label: "Base Signal Score", format: (row) => row.risk_score ?? "" },
        { key: "risk_level", label: "Final Decision", format: (row) => row.risk_level || row.decision || "" },
      ],
    };

    const csv = buildCsvContent(getAuditResults(queue), columnsByQueue[queue]);
    const filename = queue === "send" ? "send_queue.csv" : queue === "review" ? "review_queue.csv" : "suppression_list.csv";
    downloadCsvFile(filename, csv);
  }

  function downloadRiskSummaryCsv() {
    if (!auditSummary) return;

    const csv = buildCsvContent([auditSummary], [
      { key: "total", label: "Total Contacts" },
      { key: "sendCount", label: "Send Count" },
      { key: "reviewCount", label: "Review Count" },
      { key: "suppressCount", label: "Suppress Count" },
      { key: "sendRate", label: "Send Rate", format: (row) => row.sendRate },
      { key: "reviewRate", label: "Review Rate", format: (row) => row.reviewRate },
      { key: "suppressRate", label: "Suppress Rate", format: (row) => row.suppressRate },
      { key: "campaignReadinessScore", label: "Campaign Readiness Score" },
      { key: "launchStatus", label: "Launch Status" },
      { key: "listAcceptance", label: "List Acceptance" },
      { key: "topDecisionDrivers", label: "Top Decision Drivers", format: (row) => row.topDecisionDrivers.map((item) => `${item.reasonCode} (${item.count})`).join("; ") },
      { key: "campaignSendsAvoided", label: "Campaign Sends Avoided", format: (row) => row.estimatedWastePrevented.campaignSendsAvoided },
      { key: "estimatedReviewMinutes", label: "Estimated Review Minutes", format: (row) => row.estimatedWastePrevented.estimatedReviewMinutes },
      { key: "sdrHourlyCostUsd", label: "Assumed SDR Hourly Cost USD", format: (row) => row.estimatedWastePrevented.sdrHourlyCostUsd },
      { key: "estimatedOperationalWasteAvoidedUsd", label: "Estimated Operational Waste Avoided USD", format: (row) => row.estimatedWastePrevented.estimatedOperationalWasteAvoidedUsd },
      { key: "formula", label: "Estimate Formula", format: (row) => row.estimatedWastePrevented.formula },
      { key: "clientRiskBrief", label: "Client Risk Brief" },
    ]);

    downloadCsvFile("risk_summary.csv", csv);
  }

  const sendCount = results?.filter((result) => normalizeAuditQueue(result) === "send").length ?? 0;
  const reviewCount = results?.filter((result) => normalizeAuditQueue(result) === "review").length ?? 0;
  const suppressCount = results?.filter((result) => normalizeAuditQueue(result) === "suppress").length ?? 0;
  const visibleExportColumns = exportColumns.filter((column) => {
    if (column.key === "risk_level" && exportColumns.some((item) => item.key === "decision")) return false;
    if (["recommendation", "solution_summary", "ai_explanation", "dkim_selector", "domain_age_days"].includes(column.key)) {
      return !!results?.some((result) => readExportValue(result, column.key) !== "");
    }
    return true;
  });

  return (
    <div className="rs-shell">
      <div className="border-b border-white/10 bg-black/20 backdrop-blur-xl">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4 sm:px-6">
          <Link href="/dashboard" className="rs-link-arrow flex items-center gap-1 text-sm text-slate-400 hover:text-white">
            <ArrowRight className="h-4 w-4 rotate-180" /> Dashboard
          </Link>
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <div className="mb-8 text-center">
          <div className="rs-fade-up mb-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-sm font-medium text-slate-200">
            <Upload className="h-4 w-4" /> List Audit
          </div>
          <h1 className="rs-title-settle text-3xl font-semibold text-white sm:text-4xl">Pre-send List Audit</h1>
          <p className="rs-fade-up rs-fade-up-delay-1 mx-auto mt-3 max-w-2xl text-slate-400">
            Upload or paste a lead list to generate Send / Review / Suppress queues, a Campaign Readiness Score, CSV exports, and a client-ready audit report.
          </p>
          <Link href="/pricing" className="rs-link-arrow mt-3 inline-flex items-center gap-1 text-sm text-slate-300 hover:text-white">
            Need API access for workflow automation? <span className="underline">View Plans</span>
          </Link>
        </div>

        <div className="mb-6 rounded-2xl border border-blue-500/20 bg-blue-500/10 px-4 py-3 text-sm text-blue-200">
          List audits are available on <span className="font-semibold">Starter and above</span>. Free plan users can still use the single Contact Check page.
        </div>

        <div className="rs-card rs-card-hover mb-6 rounded-[28px] p-6">
          <div
            className={`rounded-[24px] border-2 border-dashed p-8 text-center transition-colors ${dragOver ? "border-white/30 bg-white/10" : "border-white/12 bg-white/[0.025]"}`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <FileText className="mx-auto mb-3 h-10 w-10 text-slate-500" />
            <p className="mb-2 text-sm text-slate-400">Drop a CSV, TXT, or XLSX file here, or</p>
            <label className="inline-flex cursor-pointer items-center justify-center rounded-full border border-white/12 bg-white/6 px-4 py-2 text-sm font-medium text-slate-100 transition hover:border-white/20 hover:bg-white/10">
              Browse Files
              <input type="file" accept=".csv,.txt,.xlsx,.xls" className="hidden" onChange={(e) => { const file = e.target.files?.[0]; if (file) handleFile(file); }} />
            </label>
            <p className="mt-2 text-xs text-slate-500">CSV, TXT, or XLSX. Paste text one email per line. Max 5,000.</p>
          </div>

          <div className="mt-4">
            <p className="mb-2 text-xs uppercase tracking-[0.22em] text-slate-500">Or paste emails one per line, or separated by spaces</p>
            <pre className="rs-code mb-2 rounded-2xl px-4 py-3 text-left text-xs text-slate-400 whitespace-pre-wrap break-words">{`john@example.com jane@company.com sales@domain.com
or
john@example.com
jane@company.com
sales@domain.com`}</pre>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Paste emails here"
              rows={6}
              className="rs-textarea min-h-[180px] p-4 text-sm font-mono"
            />
            <button
              onClick={handlePaste}
              disabled={loading || !text.trim()}
              className="rs-button-primary rs-link-arrow mt-3 flex min-h-11 w-full items-center justify-center gap-2 rounded-full px-6 py-3 text-sm font-medium disabled:opacity-50"
            >
              {loading ? "Scanning..." : "Check All Emails"}
            </button>
            {statusMessage && (
              <p className="mt-2 text-center text-xs text-slate-500">{statusMessage}</p>
            )}
          </div>

          {loading && (
            <div className="mt-4 rounded-[24px] border border-white/10 bg-white/[0.03] p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-medium text-slate-200">Preparing bulk risk report</div>
                  <div className="mt-1 text-xs text-slate-500">We are checking each contact and assembling the result table.</div>
                </div>
                <div className="h-2 w-24 overflow-hidden rounded-full bg-white/10">
                  <div className="h-2 w-2/3 animate-pulse rounded-full bg-white/30" />
                </div>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                {[0, 1, 2].map((item) => (
                  <div key={item} className="rounded-2xl border border-white/8 bg-black/20 p-4">
                    <div className="h-3 w-20 animate-pulse rounded bg-white/10" />
                    <div className="mt-3 h-7 w-16 animate-pulse rounded bg-white/10" />
                    <div className="mt-2 h-3 w-24 animate-pulse rounded bg-white/10" />
                  </div>
                ))}
              </div>
            </div>
          )}

          {error && (
            <div className="mt-4 flex items-center gap-2 rounded-2xl border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-200">
              <AlertTriangle className="h-4 w-4 flex-shrink-0" /> {error}
              {upgradeNeeded && (
                <Link href="/pricing" className="ml-1 font-medium text-white underline">
                  Upgrade
                </Link>
              )}
            </div>
          )}
        </div>

        {inputReconciliation && (
          <div className="rs-card mb-6 rounded-[28px] p-5">
            <h2 className="text-sm font-semibold text-white">Input reconciliation</h2>
            <div className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3 lg:grid-cols-6">
              {[
                ["Input rows", inputReconciliation.inputRows],
                ["Unique processed", inputReconciliation.uniqueValidAddressesProcessed],
                ["Rejected", inputReconciliation.rejectedBeforeScreening],
                ["Duplicates", inputReconciliation.duplicatesRemoved],
                ["Results", inputReconciliation.resultsProduced],
                ["Credits", inputReconciliation.creditsConsumed],
              ].map(([label, value]) => <div key={String(label)} className="rounded-2xl border border-white/8 bg-white/[0.03] p-3"><div className="text-[11px] text-slate-500">{label}</div><div className="mt-1 font-semibold text-slate-100">{Number(value).toLocaleString()}</div></div>)}
            </div>
          </div>
        )}

        {summary && (
          <div className="rs-card rs-fade-up mb-6 rounded-[28px] p-6">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.035] px-3 py-1 text-[11px] uppercase tracking-[0.22em] text-slate-300">
                  <BarChart3 className="h-3.5 w-3.5 text-slate-300" />
                  Audit workspace
                </div>
                <h2 className="mt-3 text-lg font-semibold text-white">Review-ready bulk report</h2>
                <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-400">
                  Use the report below as the single source of truth for launch status, readiness, queue breakdown, and client-facing recommendations.
                </p>
              </div>
              <div className="w-full max-w-2xl rounded-[24px] border border-white/10 bg-black/20 p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-medium text-slate-100">Export pack</div>
                    <div className="mt-1 text-xs text-slate-500">Download the report files without repeating the summary metrics on screen.</div>
                  </div>
                  <Link href={auditCta.href} className="rs-link-arrow hidden items-center gap-1 text-sm font-medium text-white md:inline-flex">
                    {auditCta.label} <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                  <button onClick={downloadXLSX} disabled={xlsxDownloading} className="rounded-full border border-white/12 bg-white/6 px-3 py-2 text-xs font-medium text-slate-100 transition hover:border-white/20 hover:bg-white/10 disabled:opacity-50">{xlsxDownloading ? "Generating..." : <span className="inline-flex items-center gap-1"><Download className="h-3 w-3" /> Export XLSX</span>}</button>
                  <button onClick={() => exportCSV("all")} className="rounded-full border border-white/12 bg-white/6 px-3 py-2 text-xs font-medium text-slate-100 transition hover:border-white/20 hover:bg-white/10"><span className="inline-flex items-center gap-1"><Download className="h-3 w-3" /> Full CSV export</span></button>
                  <button onClick={() => exportCSV("clean")} className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-xs font-medium text-emerald-200 transition hover:bg-emerald-500/15"><span className="inline-flex items-center gap-1"><Download className="h-3 w-3" /> Export clean report</span></button>
                  <button onClick={() => exportCSV("risky")} className="rounded-full border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs font-medium text-red-200 transition hover:bg-red-500/15"><span className="inline-flex items-center gap-1"><Download className="h-3 w-3" /> Risk review list</span></button>
                </div>
                {hasClientReadyReport && <div className="mt-3 rounded-2xl border border-white/8 bg-white/[0.02] p-3">
                  <div className="mb-2 text-xs uppercase tracking-[0.22em] text-slate-500">Client delivery files</div>
                  <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                    <button onClick={() => downloadAuditCsv("send")} disabled={!results} className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-xs font-medium text-emerald-200 transition hover:bg-emerald-500/15 disabled:cursor-not-allowed disabled:opacity-50">
                      <span className="inline-flex items-center gap-1"><Download className="h-3 w-3" /> Download Send Queue ({sendCount})</span>
                    </button>
                    <button onClick={() => downloadAuditCsv("review")} disabled={!results} className="rounded-full border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs font-medium text-amber-200 transition hover:bg-amber-500/15 disabled:cursor-not-allowed disabled:opacity-50">
                      <span className="inline-flex items-center gap-1"><Download className="h-3 w-3" /> Download Review Queue ({reviewCount})</span>
                    </button>
                    <button onClick={() => downloadAuditCsv("suppress")} disabled={!results} className="rounded-full border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs font-medium text-red-200 transition hover:bg-red-500/15 disabled:cursor-not-allowed disabled:opacity-50">
                      <span className="inline-flex items-center gap-1"><Download className="h-3 w-3" /> Download Suppression List ({suppressCount})</span>
                    </button>
                    <button onClick={downloadRiskSummaryCsv} disabled={!auditSummary} className="rounded-full border border-white/12 bg-white/6 px-3 py-2 text-xs font-medium text-slate-100 transition hover:border-white/20 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50">
                      <span className="inline-flex items-center gap-1"><Download className="h-3 w-3" /> Download Risk Summary</span>
                    </button>
                  </div>
                  <p className="mt-2 text-[11px] text-slate-500">
                    Standard files keep send, review, suppression, and audit summary exports separate for agency delivery.
                  </p>
                </div>}
                <Link href={auditCta.href} className="rs-link-arrow mt-3 inline-flex items-center gap-1 text-sm font-medium text-white md:hidden">
                  {auditCta.label} <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
          </div>
        )}

        {auditSummary && hasClientReadyReport && (
          <AuditReportPreview
            summary={auditSummary}
            totalContacts={auditSummary.total}
            clientName="Client"
            campaignName="Outbound Campaign"
            plan={resultPlan}
          />
        )}

        {auditSummary && !hasClientReadyReport && (
          <section className="rs-card mb-6 rounded-[28px] p-6">
            <div className="text-xs font-medium uppercase tracking-[0.22em] text-slate-500">Basic List Audit Summary</div>
            <p className="mt-2 text-sm text-slate-400">Starter includes the core queue breakdown and basic CSV/XLSX exports. Client-ready Campaign Readiness and List Acceptance reports start on Growth.</p>
            <div className="mt-4 grid grid-cols-3 gap-3">
              <div className="rounded-2xl border border-emerald-500/15 bg-emerald-500/[0.08] p-3 text-emerald-100"><div className="text-[11px] uppercase tracking-[0.18em]">Send</div><div className="mt-1 text-xl font-semibold">{auditSummary.sendCount}</div></div>
              <div className="rounded-2xl border border-amber-500/15 bg-amber-500/[0.08] p-3 text-amber-100"><div className="text-[11px] uppercase tracking-[0.18em]">Review</div><div className="mt-1 text-xl font-semibold">{auditSummary.reviewCount}</div></div>
              <div className="rounded-2xl border border-red-500/15 bg-red-500/[0.08] p-3 text-red-100"><div className="text-[11px] uppercase tracking-[0.18em]">Suppress</div><div className="mt-1 text-xl font-semibold">{auditSummary.suppressCount}</div></div>
            </div>
          </section>
        )}

        {results && (
          <div className="rs-card overflow-hidden rounded-[28px]">
            <div className="border-b border-white/8 px-4 py-4 sm:px-6">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h3 className="text-base font-semibold text-white">Detailed results</h3>
                  <p className="mt-1 text-sm text-slate-500">
                    Base signal score, final decision, and supporting evidence for each contact in the uploaded list.
                  </p>
                </div>
                <div className="rounded-full border border-white/10 bg-white/[0.035] px-3 py-1.5 text-xs text-slate-400">
                  Open Technical evidence on mobile for additional signals
                </div>
              </div>
            </div>
            <div className="max-h-[600px] overflow-x-auto overflow-y-auto overscroll-contain">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-black/70 backdrop-blur-xl">
                  <tr>
                    {visibleExportColumns.map((column) => (
                      <th key={column.key} className={`${["email", "decision", "confidence", "primary_reason", "recommended_action"].includes(column.key) ? "" : "hidden"} min-w-[120px] whitespace-nowrap border-b border-white/8 px-4 py-3 text-left text-[11px] font-medium uppercase tracking-[0.22em] text-slate-500`}>
                        {column.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {results.map((result, index) => (
                    <tr key={index} className="border-t border-white/8 transition hover:bg-white/[0.03]">
                      {visibleExportColumns.map((column) => (
                        <td key={column.key} className={`${["email", "decision", "confidence", "primary_reason", "recommended_action"].includes(column.key) ? "" : "hidden"} px-4 py-3 text-xs align-top leading-5`}>
                          {renderCell(result, column)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {!loading && !results && !summary && !error && (
          <div className="rs-card rounded-[28px] p-6">
            <div className="rounded-[24px] border border-white/10 bg-white/[0.03] px-6 py-10 text-center">
              <BarChart3 className="mx-auto h-10 w-10 text-slate-500" />
              <h3 className="mt-4 text-lg font-semibold text-white">Your bulk risk report will appear here</h3>
              <p className="mx-auto mt-2 max-w-2xl text-sm text-slate-500">
                Upload a CSV/XLSX file or paste a list of emails to generate a risk dashboard, review risky contacts, and export clean reports.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
