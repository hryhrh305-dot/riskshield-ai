"use client";

import { useState } from "react";
import * as XLSXLib from "xlsx";
import Link from "next/link";
import { Upload, FileText, Download, CheckCircle, AlertTriangle, XCircle, ArrowRight, BarChart3, Shield } from "lucide-react";

interface BulkResult {
  impact?: string[];
  email: string;
  risk_score: number;
  health_score: number | null;
  decision: string;
  reasons: string[];
  disposable: boolean;
  hasMX: boolean;
  mxChecked: boolean;
}

export default function BulkCheckPage() {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [results, setResults] = useState<BulkResult[] | null>(null);
  const [summary, setSummary] = useState<Record<string, number> | null>(null);
  const [error, setError] = useState("");
  const [xlsxDownloading, setXlsxDownloading] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  async function handleFile(file: File) {
    setLoading(true); setError(""); setResults(null); setSummary(null);
    setStatusMessage("Uploading file and scanning emails...");
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/bulk-check", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Upload failed"); return; }
      setResults(data.results);
      setSummary(data.summary);
      setStatusMessage("Scan complete.");
    } catch { setError("Network error"); setStatusMessage("Scan failed. Please try again."); }
    finally { setLoading(false); }
  }

  async function handlePaste() {
    if (!text.trim()) { setError("Paste emails one per line or separated by spaces, or upload a CSV, TXT, or XLSX file."); return; }
    setLoading(true); setError(""); setResults(null); setSummary(null);
    setStatusMessage("Scanning pasted emails and building the report...");
    try {
      const res = await fetch("/api/bulk-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Check failed"); return; }
      setResults(data.results);
      setSummary(data.summary);
      setStatusMessage("Scan complete.");
    } catch { setError("Network error"); setStatusMessage("Scan failed. Please try again."); }
    finally { setLoading(false); }
  }

  async function downloadXLSX() {
    if (!results || results.length === 0) return;
    setXlsxDownloading(true);
    try {
      var data = [["email","risk_score","risk_level","disposable","hasMX","reasons","recommendation"]];
      for (var i = 0; i < results.length; i++) {
        var r = results[i];
        data.push([
          r.email || "", r.risk_score ?? "", r.risk_level || "",
          r.disposable ? "Yes" : "No", r.hasMX ? "Yes" : "No",
          (r.reasons || []).join("; "), r.recommendation || ""
        ]);
      }
      var ws = XLSXLib.utils.aoa_to_sheet(data);
      var wb = XLSXLib.utils.book_new();
      XLSXLib.utils.book_append_sheet(wb, ws, "RiskShield Results");
      XLSXLib.writeFile(wb, "riskshield-results.xlsx");
    } catch (e) {
      console.error("XLSX failed:", e);
    }
    finally { setXlsxDownloading(false); }
  }

  function exportCSV(filter: "all" | "clean" | "risky") {
    if (!results) return;
    const filtered = filter === "all" ? results : filter === "clean"
      ? results.filter(r => r.risk_level === "ALLOW")
      : results.filter(r => (r.risk_level === "REVIEW" || r.risk_level === "BLOCK"));
    const header = "email,risk_score,decision,disposable,hasMX,mxChecked,reasons";
    const rows = filtered.map(r => `${r.email},${r.risk_score},${r.risk_level},${r.disposable},${r.hasMX},${r.mxChecked},"${r.reasons.join("; ")}"`);
    const csv = header + "\n" + rows.join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `${filter}_list.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  const scoreColor = (s: number) => s >= 60 ? "text-red-600" : s >= 30 ? "text-yellow-600" : "text-green-600";
  const decisionBadge = (d: string) => d === "BLOCK" ? "bg-red-50 text-red-600" : d === "REVIEW" ? "bg-yellow-50 text-yellow-600" : "bg-green-50 text-green-600";

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/dashboard" className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1">
            <ArrowRight className="w-4 h-4 rotate-180" /> Dashboard
          </Link>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-8">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 bg-green-50 text-green-700 px-4 py-1.5 rounded-full text-sm font-medium mb-4">
            <Upload className="w-4 h-4" /> Bulk Scanner
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Bulk Email Check</h1>
          <p className="text-gray-500 max-w-lg mx-auto">
            Upload a CSV or paste a list of emails to check them all at once. Export clean and risky lists.
          </p>
          <Link href="/pricing" className="text-sm text-blue-600 hover:text-blue-700 mt-2 inline-block">
            Need API access for automation? <span className="underline">View Plans</span>
          </Link>
        </div>

        {/* Input */}
        <div className="bg-white rounded-xl border p-6 mb-6 shadow-sm">
          <div
            className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors ${dragOver ? "border-blue-400 bg-blue-50" : "border-gray-200"}`}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
          >
            <FileText className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-sm text-gray-500 mb-2">Drop a CSV, TXT, or XLSX file here, or</p>
            <label className="bg-white border px-4 py-2 rounded-lg text-sm font-medium cursor-pointer hover:bg-gray-50">
              Browse Files
              <input type="file" accept=".csv,.txt,.xlsx,.xls" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
            </label>
            <p className="text-xs text-gray-400 mt-2">CSV, TXT, or XLSX. Paste text one email per line. Max 5,000.</p>
          </div>

          <div className="mt-4">
            <p className="text-xs text-gray-400 mb-2 uppercase tracking-wider">Or paste emails one per line, or separated by spaces</p>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={"john@example.com jane@company.com sales@domain.com\nor\njohn@example.com\njane@company.com\nsales@domain.com"}
              rows={6}
              className="w-full border rounded-lg p-4 text-sm font-mono resize-y focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={handlePaste}
              disabled={loading || !text.trim()}
              className="mt-3 w-full bg-blue-600 text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? "Scanning..." : "Check All Emails"}
            </button>
            {statusMessage && (
              <p className="mt-2 text-xs text-gray-500 text-center">{statusMessage}</p>
            )}
          </div>

          {error && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" /> {error}
            </div>
          )}
        </div>

        {/* Summary + Export */}
        {summary && (
          <div className="bg-white rounded-xl border p-6 mb-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-lg flex items-center gap-2"><BarChart3 className="w-5 h-5 text-blue-600" /> Campaign Risk Report</h2>
              <div className="flex gap-2">
                <button onClick={downloadXLSX} disabled={xlsxDownloading} className="flex items-center gap-1 text-xs bg-blue-100 hover:bg-blue-200 text-blue-700 px-3 py-1.5 rounded-lg disabled:opacity-50">{xlsxDownloading ? "Generating..." : <><Download className="w-3 h-3" /> XLSX</>}</button>
                <button onClick={() => exportCSV("all")} className="flex items-center gap-1 text-xs bg-gray-100 hover:bg-gray-200 px-3 py-1.5 rounded-lg"><Download className="w-3 h-3" /> All CSV</button>
                <button onClick={() => exportCSV("clean")} className="flex items-center gap-1 text-xs bg-green-50 hover:bg-green-100 text-green-700 px-3 py-1.5 rounded-lg"><Download className="w-3 h-3" /> Clean</button>
                <button onClick={() => exportCSV("risky")} className="flex items-center gap-1 text-xs bg-red-50 hover:bg-red-100 text-red-600 px-3 py-1.5 rounded-lg"><Download className="w-3 h-3" /> Risky</button>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
              <div className="bg-gray-50 rounded-xl p-4 text-center">
                <div className="text-2xl font-bold text-gray-800">{summary.total}</div>
                <div className="text-xs text-gray-400 mt-1">Total Contacts</div>
              </div>
              <div className="bg-green-50 rounded-xl p-4 text-center">
                <div className="text-2xl font-bold text-green-700">{summary.clean}</div>
                <div className="text-xs text-green-600 mt-1">Clean ({summary.clean_pct}%)</div>
              </div>
              <div className="bg-yellow-50 rounded-xl p-4 text-center">
                <div className="text-2xl font-bold text-yellow-700">{summary.risky}</div>
                <div className="text-xs text-yellow-600 mt-1">Review ({summary.risky_pct}%)</div>
              </div>
              <div className="bg-red-50 rounded-xl p-4 text-center">
                <div className="text-2xl font-bold text-red-700">{summary.blocked}</div>
                <div className="text-xs text-red-600 mt-1">Blocked ({summary.blocked_pct}%)</div>
              </div>
            </div>

            {summary.estimated_waste_pct > 0 && (
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                <p className="text-sm text-amber-800">
                  <strong>Estimated wasted sends: {summary.estimated_waste_pct}%</strong> -- Removing risky contacts could save delivery reputation and reduce bounce rate.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Results Table */}
        {results && (
          <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
            <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium text-gray-500">Email</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-500 w-16">Risk</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-500 w-16">Health</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-500 w-24">Decision</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-500">Reasons</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-500 w-24">Disposable</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-500 w-16">MX</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Impact</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((r, i) => (
                    <tr key={i} className="border-t border-gray-100 hover:bg-gray-50">
                      <td className="px-4 py-2.5 font-mono text-gray-700">{r.email}</td>
                      <td className={`px-4 py-2.5 font-bold ${scoreColor(r.risk_score)}`}>{r.risk_score}</td>
                      <td className="px-4 py-2.5 font-bold text-blue-700">{r.health_score ?? "-"}</td>
                      <td className="px-4 py-2.5">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${decisionBadge(r.decision)}`}>{r.decision}</span>
                      </td>
                      <td className="px-4 py-2.5 text-gray-500 text-xs">{r.reasons.join(", ") || "-"}</td>
                      <td className="px-4 py-2.5">{r.disposable ? <XCircle className="w-4 h-4 text-red-500" /> : <CheckCircle className="w-4 h-4 text-green-500" />}</td>
                      <td className="px-4 py-2.5">{r.mxChecked ? (r.hasMX ? <CheckCircle className="w-4 h-4 text-green-500" /> : <XCircle className="w-4 h-4 text-red-500" />) : <span className="text-gray-300">-</span>}</td>
                      <td className="px-4 py-2.5 text-xs text-amber-700 max-w-[260px]">{r.impact?.slice(0, 2).join(" | ") || "-"}</td>
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
