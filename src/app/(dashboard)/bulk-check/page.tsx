"use client";

import { useState } from "react";
import * as XLSXLib from "xlsx";
import Link from "next/link";
import { Upload, FileText, Download, CheckCircle, AlertTriangle, XCircle, ArrowRight, BarChart3 } from "lucide-react";
import { buildCsvContent, downloadCsvFile, type CsvColumn } from "@/lib/export/csv";
import type { AuditEvidence, ListAuditSummary } from "@/lib/list-audit";
import { AuditReportPreview } from "@/components/audit/AuditReportPreview";

interface BulkResult {
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
  email: string;
  risk_score: number;
  health_score?: number | null;
  decision?: string;
  risk_level?: string;
  disposable?: boolean;
  role_based?: boolean;
  catch_all?: boolean;
  hasMX?: boolean;
  mxChecked?: boolean;
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
}

type AuditQueue = "send" | "review" | "suppress";

function MetricCard({
  label,
  value,
  helper,
  tone,
}: {
  label: string;
  value: string | number;
  helper: string;
  tone: "neutral" | "allow" | "review" | "block";
}) {
  const toneClasses =
    tone === "allow"
      ? "border-emerald-500/15 bg-emerald-500/8 text-emerald-300"
      : tone === "review"
        ? "border-amber-500/15 bg-amber-500/8 text-amber-300"
        : tone === "block"
          ? "border-red-500/15 bg-red-500/8 text-red-300"
          : "border-white/10 bg-white/[0.035] text-white";

  return (
    <div className={`rounded-[24px] border p-4 ${toneClasses}`}>
      <div className="text-[11px] uppercase tracking-[0.22em] text-slate-500">{label}</div>
      <div className="mt-3 text-2xl font-semibold">{value}</div>
      <div className="mt-1 text-xs text-slate-500">{helper}</div>
    </div>
  );
}

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
  const [exportColumns, setExportColumns] = useState<ExportColumn[]>([
    { key: "email", label: "Email" },
    { key: "risk_score", label: "Risk Score" },
    { key: "risk_level", label: "Risk Level" },
  ]);

  function readExportValue(result: BulkResult, key: string) {
    if (key === "risk_level") return result.risk_level || result.decision || "";
    if (key === "reasons") return (result.reasons || []).join("; ");
    if (key === "impact") return (result.impact || []).join(" | ");
    if (key === "risk_factors") return (result.risk_factors || []).join(" | ");
    if (key === "audit_queue") return result.audit_queue || result.decision || result.risk_level || "";
    if (key === "reason_codes") return (result.reason_codes || []).join("; ");
    if (key === "primary_reason") return result.primary_reason || "";
    if (key === "recommended_action") return result.recommended_action || "";
    if (key === "business_impact") return result.business_impact || "";
    if (key === "confidence") return result.confidence ?? "";
    if (key === "evidence_summary") {
      if (result.evidence?.length) {
        return result.evidence.map((item) => `${item.signal}: ${item.explanation}`).join("; ");
      }
      return (result.reason_codes || result.reasons || []).join("; ");
    }
    if (key === "mx_status") {
      if (!result.mxChecked) return "Not checked";
      return result.hasMX ? "Present" : "Missing";
    }
    if (key === "domain_age_days") return result.domain_age?.ageDays ?? "";
    if (key === "dns_health_score") return result.dns_health?.score ?? "";
    if (key === "estimated_waste_cost") return result.estimated_waste_cost ?? "";

    const value = result[key as keyof BulkResult];
    if (Array.isArray(value)) return value.join("; ");
    if (typeof value === "boolean") return value ? "Yes" : "No";
    return value == null ? "" : String(value);
  }

  const scoreColor = (score: number) => score >= 60 ? "text-red-300" : score >= 30 ? "text-amber-300" : "text-emerald-300";
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
      return <span className="break-all font-mono text-slate-200">{String(value)}</span>;
    }

    if (column.key === "risk_score") {
      return <span className={`font-bold ${scoreColor(Number(result.risk_score || 0))}`}>{String(value)}</span>;
    }

    if (column.key === "risk_level") {
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
      const truthy = normalized === "yes" || normalized === "true";
      return truthy
        ? <XCircle className="h-4 w-4 text-red-300" />
        : <CheckCircle className="h-4 w-4 text-emerald-300" />;
    }

    if (column.key === "mx_status") {
      if (value === "Not checked") return <span className="text-slate-500">-</span>;
      return value === "Present"
        ? <CheckCircle className="h-4 w-4 text-emerald-300" />
        : <XCircle className="h-4 w-4 text-red-300" />;
    }

    const textColor =
      column.key === "impact" ? "text-amber-200" :
      column.key === "reasons" ? "text-slate-500" :
      "text-slate-300";

    return <span className={`${textColor} whitespace-pre-wrap break-words`}>{String(value || "-")}</span>;
  }

  async function handleFile(file: File) {
    setLoading(true);
    setError("");
    setUpgradeNeeded(false);
    setResults(null);
    setSummary(null);
    setAuditSummary(null);
    setStatusMessage("Uploading file and scanning emails...");
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/bulk-check", { method: "POST", body: formData });
      const data: BulkApiResponse = await res.json();
      if (!res.ok) {
        setUpgradeNeeded(!!data.upgradeNeeded);
        setError(data.message || data.error || "Upload failed");
        setStatusMessage(data.upgradeNeeded ? "Upgrade required for bulk scanning." : "");
        return;
      }
      setResults(data.results || null);
      setSummary(data.summary || null);
      setAuditSummary(data.audit_summary || null);
      setExportColumns(data.export_columns || exportColumns);
      setStatusMessage("Scan complete.");
    } catch {
      setError("Network error");
      setStatusMessage("Scan failed. Please try again.");
    } finally {
      setLoading(false);
    }
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
      const res = await fetch("/api/bulk-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const data: BulkApiResponse = await res.json();
      if (!res.ok) {
        setUpgradeNeeded(!!data.upgradeNeeded);
        setError(data.message || data.error || "Check failed");
        setStatusMessage(data.upgradeNeeded ? "Upgrade required for bulk scanning." : "");
        return;
      }
      setResults(data.results || null);
      setSummary(data.summary || null);
      setAuditSummary(data.audit_summary || null);
      setExportColumns(data.export_columns || exportColumns);
      setStatusMessage("Scan complete.");
    } catch {
      setError("Network error");
      setStatusMessage("Scan failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function downloadXLSX() {
    if (!results || results.length === 0) return;
    setXlsxDownloading(true);
    try {
      const data = [exportColumns.map((column) => column.label)];
      for (const result of results) {
        data.push(exportColumns.map((column) => readExportValue(result, column.key)));
      }
      const ws = XLSXLib.utils.aoa_to_sheet(data);
      const wb = XLSXLib.utils.book_new();
      XLSXLib.utils.book_append_sheet(wb, ws, "Secwyn Results");
      XLSXLib.writeFile(wb, "riskshield-results.xlsx");
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
        { key: "risk_score", label: "Risk Score", format: (row) => row.risk_score ?? "" },
        { key: "risk_level", label: "Risk Level", format: (row) => row.risk_level || row.decision || "" },
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
        { key: "risk_score", label: "Risk Score", format: (row) => row.risk_score ?? "" },
        { key: "risk_level", label: "Risk Level", format: (row) => row.risk_level || row.decision || "" },
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
        { key: "risk_score", label: "Risk Score", format: (row) => row.risk_score ?? "" },
        { key: "risk_level", label: "Risk Level", format: (row) => row.risk_level || row.decision || "" },
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
      { key: "topRiskReasons", label: "Top Risk Reasons", format: (row) => row.topRiskReasons.map((item) => `${item.reasonCode} (${item.count})`).join("; ") },
      { key: "riskySendsPrevented", label: "Risky Sends Prevented", format: (row) => row.estimatedWastePrevented.riskySendsPrevented },
      { key: "estimatedSendingCreditsSaved", label: "Estimated Sending Credits Saved", format: (row) => row.estimatedWastePrevented.estimatedSendingCreditsSaved },
      { key: "estimatedSdrTimeSavedHours", label: "Estimated SDR Time Saved Hours", format: (row) => row.estimatedWastePrevented.estimatedSdrTimeSavedHours },
      { key: "estimatedWasteSavedUsd", label: "Estimated Waste Saved USD", format: (row) => row.estimatedWastePrevented.estimatedWasteSavedUsd },
      { key: "clientRiskBrief", label: "Client Risk Brief" },
    ]);

    downloadCsvFile("risk_summary.csv", csv);
  }

  const sendCount = results?.filter((result) => normalizeAuditQueue(result) === "send").length ?? 0;
  const reviewCount = results?.filter((result) => normalizeAuditQueue(result) === "review").length ?? 0;
  const suppressCount = results?.filter((result) => normalizeAuditQueue(result) === "suppress").length ?? 0;

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
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => { e.preventDefault(); setDragOver(false); const file = e.dataTransfer.files[0]; if (file) handleFile(file); }}
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

        {summary && (
          <div className="rs-card rs-fade-up mb-6 rounded-[28px] p-6">
            <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <h2 className="flex items-center gap-2 text-lg font-semibold text-white"><BarChart3 className="h-5 w-5 text-slate-300" /> Client-ready Audit Report</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Review list quality, export send/review/suppress queues, and surface risky contacts before outreach.
                </p>
              </div>
              <div className="w-full max-w-xl rounded-[24px] border border-white/10 bg-black/20 p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-medium text-slate-100">Export & follow-up</div>
                    <div className="mt-1 text-xs text-slate-500">Export clean risk reports or unlock broader list audit workflows.</div>
                  </div>
                  <Link href="/pricing" className="rs-link-arrow hidden items-center gap-1 text-sm font-medium text-white md:inline-flex">
                    Upgrade for list audits and reports <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                  <button onClick={downloadXLSX} disabled={xlsxDownloading} className="rounded-full border border-white/12 bg-white/6 px-3 py-2 text-xs font-medium text-slate-100 transition hover:border-white/20 hover:bg-white/10 disabled:opacity-50">{xlsxDownloading ? "Generating..." : <span className="inline-flex items-center gap-1"><Download className="h-3 w-3" /> Export XLSX</span>}</button>
                  <button onClick={() => exportCSV("all")} className="rounded-full border border-white/12 bg-white/6 px-3 py-2 text-xs font-medium text-slate-100 transition hover:border-white/20 hover:bg-white/10"><span className="inline-flex items-center gap-1"><Download className="h-3 w-3" /> Full CSV export</span></button>
                  <button onClick={() => exportCSV("clean")} className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-xs font-medium text-emerald-200 transition hover:bg-emerald-500/15"><span className="inline-flex items-center gap-1"><Download className="h-3 w-3" /> Export clean report</span></button>
                  <button onClick={() => exportCSV("risky")} className="rounded-full border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs font-medium text-red-200 transition hover:bg-red-500/15"><span className="inline-flex items-center gap-1"><Download className="h-3 w-3" /> Risk review list</span></button>
                </div>
                <div className="mt-3 rounded-2xl border border-white/8 bg-white/[0.02] p-3">
                  <div className="mb-2 text-xs uppercase tracking-[0.22em] text-slate-500">Standard CSV pack</div>
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
                </div>
                <Link href="/pricing" className="rs-link-arrow mt-3 inline-flex items-center gap-1 text-sm font-medium text-white md:hidden">
                  Upgrade for bulk screening and reports <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>

            <div className="rs-stagger mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <MetricCard label="Total Contacts" value={summary.total} helper="Contacts included in this screening pass" tone="neutral" />
              <MetricCard label="Allow" value={summary.clean} helper={`${summary.clean_pct}% ready for outreach`} tone="allow" />
              <MetricCard label="Review" value={summary.risky} helper={`${summary.risky_pct}% need manual review`} tone="review" />
              <MetricCard label="Block" value={summary.blocked} helper={`${summary.blocked_pct}% should be removed`} tone="block" />
            </div>

            {summary.estimated_waste_pct > 0 && (
              <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4">
                <p className="text-sm text-amber-200">
                  <strong>Estimated wasted sends: {summary.estimated_waste_pct}%</strong> -- Removing risky contacts could save delivery reputation and reduce bounce rate.
                </p>
              </div>
            )}
          </div>
        )}

        {auditSummary && (
          <AuditReportPreview
            summary={auditSummary}
            totalContacts={auditSummary.total}
            clientName="Client"
            campaignName="Outbound Campaign"
          />
        )}

        {results && (
          <div className="rs-card overflow-hidden rounded-[28px]">
            <div className="border-b border-white/8 px-4 py-4 sm:px-6">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h3 className="text-base font-semibold text-white">Detailed results</h3>
                  <p className="mt-1 text-sm text-slate-500">
                    Risk score, decision state, and supporting signals for each contact in the uploaded list.
                  </p>
                </div>
                <div className="rounded-full border border-white/10 bg-white/[0.035] px-3 py-1.5 text-xs text-slate-400">
                  Scroll horizontally on mobile to review every column
                </div>
              </div>
            </div>
            <div className="max-h-[600px] overflow-x-auto overflow-y-auto overscroll-contain">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-black/70 backdrop-blur-xl">
                  <tr>
                    {exportColumns.map((column) => (
                      <th key={column.key} className="min-w-[120px] whitespace-nowrap border-b border-white/8 px-4 py-3 text-left text-[11px] font-medium uppercase tracking-[0.22em] text-slate-500">
                        {column.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {results.map((result, index) => (
                    <tr key={index} className="border-t border-white/8 transition hover:bg-white/[0.03]">
                      {exportColumns.map((column) => (
                        <td key={column.key} className="px-4 py-3 text-xs align-top leading-5">
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
