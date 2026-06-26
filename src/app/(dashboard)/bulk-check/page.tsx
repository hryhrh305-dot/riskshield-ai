"use client";

import { useState } from "react";
import * as XLSXLib from "xlsx";
import Link from "next/link";
import { Upload, FileText, Download, CheckCircle, AlertTriangle, XCircle, ArrowRight, BarChart3 } from "lucide-react";

interface BulkResult {
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

export default function BulkCheckPage() {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [results, setResults] = useState<BulkResult[] | null>(null);
  const [summary, setSummary] = useState<Record<string, number> | null>(null);
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
    setStatusMessage("Uploading file and scanning emails...");
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/bulk-check", { method: "POST", body: formData });
      const data: BulkApiError & { results?: BulkResult[]; summary?: Record<string, number>; export_columns?: ExportColumn[] } = await res.json();
      if (!res.ok) {
        setUpgradeNeeded(!!data.upgradeNeeded);
        setError(data.message || data.error || "Upload failed");
        setStatusMessage(data.upgradeNeeded ? "Upgrade required for bulk scanning." : "");
        return;
      }
      setResults(data.results || null);
      setSummary(data.summary || null);
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
    setStatusMessage("Scanning pasted emails and building the report...");
    try {
      const res = await fetch("/api/bulk-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const data: BulkApiError & { results?: BulkResult[]; summary?: Record<string, number>; export_columns?: ExportColumn[] } = await res.json();
      if (!res.ok) {
        setUpgradeNeeded(!!data.upgradeNeeded);
        setError(data.message || data.error || "Check failed");
        setStatusMessage(data.upgradeNeeded ? "Upgrade required for bulk scanning." : "");
        return;
      }
      setResults(data.results || null);
      setSummary(data.summary || null);
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
      XLSXLib.utils.book_append_sheet(wb, ws, "RiskShield AI Results");
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
            <Upload className="h-4 w-4" /> Bulk Scanner
          </div>
          <h1 className="rs-title-settle text-3xl font-semibold text-white sm:text-4xl">Bulk Email Check</h1>
          <p className="rs-fade-up rs-fade-up-delay-1 mx-auto mt-3 max-w-2xl text-slate-400">
            Upload a CSV or paste a list of emails to check them all at once. Export clean and risky lists.
          </p>
          <Link href="/pricing" className="rs-link-arrow mt-3 inline-flex items-center gap-1 text-sm text-slate-300 hover:text-white">
            Need API access for automation? <span className="underline">View Plans</span>
          </Link>
        </div>

        <div className="mb-6 rounded-2xl border border-blue-500/20 bg-blue-500/10 px-4 py-3 text-sm text-blue-200">
          Bulk list screening is available on <span className="font-semibold">Starter and above</span>. Free plan users can still use the single Risk Check page.
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
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="flex items-center gap-2 text-lg font-semibold text-white"><BarChart3 className="h-5 w-5 text-slate-300" /> Campaign Risk Report</h2>
              <div className="flex flex-wrap gap-2">
                <button onClick={downloadXLSX} disabled={xlsxDownloading} className="rounded-full border border-white/12 bg-white/6 px-3 py-1.5 text-xs font-medium text-slate-100 transition hover:border-white/20 hover:bg-white/10 disabled:opacity-50">{xlsxDownloading ? "Generating..." : <span className="inline-flex items-center gap-1"><Download className="h-3 w-3" /> XLSX</span>}</button>
                <button onClick={() => exportCSV("all")} className="rounded-full border border-white/12 bg-white/6 px-3 py-1.5 text-xs font-medium text-slate-100 transition hover:border-white/20 hover:bg-white/10"><span className="inline-flex items-center gap-1"><Download className="h-3 w-3" /> All CSV</span></button>
                <button onClick={() => exportCSV("clean")} className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-200 transition hover:bg-emerald-500/15"><span className="inline-flex items-center gap-1"><Download className="h-3 w-3" /> Clean</span></button>
                <button onClick={() => exportCSV("risky")} className="rounded-full border border-red-500/20 bg-red-500/10 px-3 py-1.5 text-xs font-medium text-red-200 transition hover:bg-red-500/15"><span className="inline-flex items-center gap-1"><Download className="h-3 w-3" /> Risky</span></button>
              </div>
            </div>

            <div className="rs-stagger mb-4 grid grid-cols-2 gap-4 md:grid-cols-4">
              <div className="rounded-[24px] border border-white/10 bg-white/[0.035] p-4 text-center">
                <div className="text-2xl font-bold text-white">{summary.total}</div>
                <div className="mt-1 text-xs text-slate-500">Total Contacts</div>
              </div>
              <div className="rounded-[24px] border border-emerald-500/15 bg-emerald-500/8 p-4 text-center">
                <div className="text-2xl font-bold text-emerald-300">{summary.clean}</div>
                <div className="mt-1 text-xs text-emerald-200">Clean ({summary.clean_pct}%)</div>
              </div>
              <div className="rounded-[24px] border border-amber-500/15 bg-amber-500/8 p-4 text-center">
                <div className="text-2xl font-bold text-amber-300">{summary.risky}</div>
                <div className="mt-1 text-xs text-amber-200">Review ({summary.risky_pct}%)</div>
              </div>
              <div className="rounded-[24px] border border-red-500/15 bg-red-500/8 p-4 text-center">
                <div className="text-2xl font-bold text-red-300">{summary.blocked}</div>
                <div className="mt-1 text-xs text-red-200">Blocked ({summary.blocked_pct}%)</div>
              </div>
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

        {results && (
          <div className="rs-card overflow-hidden rounded-[28px]">
            <div className="max-h-[600px] overflow-x-auto overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-black/70 backdrop-blur-xl">
                  <tr>
                    {exportColumns.map((column) => (
                      <th key={column.key} className="min-w-[120px] px-4 py-3 text-left font-medium text-slate-500">
                        {column.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {results.map((result, index) => (
                    <tr key={index} className="border-t border-white/8 transition hover:bg-white/[0.03]">
                      {exportColumns.map((column) => (
                        <td key={column.key} className="px-4 py-2.5 text-xs align-top">
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
      </div>
    </div>
  );
}
