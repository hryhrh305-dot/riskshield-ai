"use client";

import { useState } from "react";
import Link from "next/link";
import { Upload, FileText, Download, CheckCircle, AlertTriangle, XCircle, ArrowRight, BarChart3, Shield } from "lucide-react";


function escXml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function crc32(data) {
  var table = [];
  for (var n = 0; n < 256; n++) {
    var c = n;
    for (var k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    table[n] = c;
  }
  var crc = 0xFFFFFFFF;
  for (var i = 0; i < data.length; i++) crc = table[(crc ^ data[i]) & 0xFF] ^ (crc >>> 8);
  return (crc ^ 0xFFFFFFFF) >>> 0;
}
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
  const [results, setResults] = useState<BulkResult[] | null>(null);
  const [summary, setSummary] = useState<Record<string, number> | null>(null);
  const [error, setError] = useState("");
  const [xlsxDownloading, setXlsxDownloading] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  async function handleFile(file: File) {
    setLoading(true); setError(""); setResults(null); setSummary(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/bulk-check", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Upload failed"); return; }
      setResults(data.results);
      setSummary(data.summary);
    } catch { setError("Network error"); }
    finally { setLoading(false); }
  }

  async function handlePaste() {
    if (!text.trim()) { setError("Paste emails (one per line) or upload a CSV."); return; }
    setLoading(true); setError(""); setResults(null); setSummary(null);
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
    } catch { setError("Network error"); }
    finally { setLoading(false); }
  }

  async function downloadXLSX() {
    if (!results || results.length === 0) return;
    setXlsxDownloading(true);
    try {
      var cols = ["email","risk_score","risk_level","disposable","hasMX","reasons","recommendation"];
      var sheetRows = [];
      sheetRows.push("<row>" + cols.map(function(c) { return "<c t=\"inlineStr\"><is><t>" + escXml(c) + "</t></is></c>"; }).join("") + "</row>");
      for (var i = 0; i < results.length; i++) {
        var r = results[i];
        var vals = [
          r.email || "", String(r.risk_score ?? ""), r.risk_level || "",
          r.disposable ? "Yes" : "No", r.hasMX ? "Yes" : "No",
          (r.reasons || []).join("; "), r.recommendation || ""
        ];
        sheetRows.push("<row>" + vals.map(function(v) { return "<c t=\"inlineStr\"><is><t>" + escXml(String(v)) + "</t></is></c>"; }).join("") + "</row>");
      }
      var sheetXml = "<?xml version=\"1.0\" encoding=\"UTF-8\"?><worksheet xmlns=\"http://schemas.openxmlformats.org/spreadsheetml/2006/main\"><sheetData>" + sheetRows.join("") + "</sheetData></worksheet>";
      var contentTypesXml = "<?xml version=\"1.0\" encoding=\"UTF-8\"?><Types xmlns=\"http://schemas.openxmlformats.org/package/2006/content-types\"><Default Extension=\"xml\" ContentType=\"application/xml\"/><Override PartName=\"/xl/worksheets/sheet1.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml\"/><Override PartName=\"/xl/sharedStrings.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml\"/><Override PartName=\"/xl/styles.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml\"/></Types>";
      var relsXml = "<?xml version=\"1.0\" encoding=\"UTF-8\"?><Relationships xmlns=\"http://schemas.openxmlformats.org/package/2006/relationships\"><Relationship Id=\"rId1\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument\" Target=\"xl/workbook.xml\"/></Relationships>";
      var wbRelsXml = "<?xml version=\"1.0\" encoding=\"UTF-8\"?><Relationships xmlns=\"http://schemas.openxmlformats.org/package/2006/relationships\"><Relationship Id=\"rId1\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet\" Target=\"worksheets/sheet1.xml\"/><Relationship Id=\"rId2\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings\" Target=\"sharedStrings.xml\"/><Relationship Id=\"rId3\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles\" Target=\"styles.xml\"/></Relationships>";
      var workbookXml = "<?xml version=\"1.0\" encoding=\"UTF-8\"?><workbook xmlns=\"http://schemas.openxmlformats.org/spreadsheetml/2006/main\"><sheets><sheet name=\"RiskShield Results\" sheetId=\"1\" r:id=\"rId1\"/></sheets></workbook>";
      var sharedStringsXml = "<?xml version=\"1.0\" encoding=\"UTF-8\"?><sst xmlns=\"http://schemas.openxmlformats.org/spreadsheetml/2006/main\" count=\"0\" uniqueCount=\"0\"></sst>";
      var stylesXml = "<?xml version=\"1.0\" encoding=\"UTF-8\"?><styleSheet xmlns=\"http://schemas.openxmlformats.org/spreadsheetml/2006/main\"></styleSheet>";

      var files = [
        { name: "[Content_Types].xml", data: new TextEncoder().encode(contentTypesXml) },
        { name: "_rels/.rels", data: new TextEncoder().encode(relsXml) },
        { name: "xl/workbook.xml", data: new TextEncoder().encode(workbookXml) },
        { name: "xl/_rels/workbook.xml.rels", data: new TextEncoder().encode(wbRelsXml) },
        { name: "xl/worksheets/sheet1.xml", data: new TextEncoder().encode(sheetXml) },
        { name: "xl/sharedStrings.xml", data: new TextEncoder().encode(sharedStringsXml) },
        { name: "xl/styles.xml", data: new TextEncoder().encode(stylesXml) }
      ];

      var zipParts = []; var offset = 0;
      for (var fi = 0; fi < files.length; fi++) {
        var f = files[fi]; var d = f.data;
        var crc = crc32(d);
        var nameBytes = new TextEncoder().encode(f.name);
        var lh = new Uint8Array(30 + nameBytes.length + d.length);
        var lhView = new DataView(lh.buffer);
        lh.set([0x50, 0x4B, 0x03, 0x04], 0);
        lhView.setUint16(4, 20, true); lhView.setUint16(6, 0x0800, true);
        lhView.setUint16(8, 0, true); lhView.setUint32(10, 0, true);
        lhView.setUint32(14, crc, true);
        lhView.setUint32(18, d.length, true); lhView.setUint32(22, d.length, true);
        lhView.setUint16(26, nameBytes.length, true); lhView.setUint16(28, 0, true);
        lh.set(nameBytes, 30); lh.set(d, 30 + nameBytes.length);
        zipParts.push({ header: lh, name: f.name, data: d, crc: crc, offset: offset });
        offset += lh.length;
      }

      var cdSize = 0; var cdParts = [];
      for (var zi = 0; zi < zipParts.length; zi++) {
        var zp = zipParts[zi]; var nb = new TextEncoder().encode(zp.name);
        var cd = new Uint8Array(46 + nb.length); var cdv = new DataView(cd.buffer);
        cd.set([0x50, 0x4B, 0x01, 0x02], 0);
        cdv.setUint16(4, 20, true); cdv.setUint16(6, 20, true);
        cdv.setUint16(8, 0x0800, true); cdv.setUint16(10, 0, true);
        cdv.setUint32(12, 0, true); cdv.setUint32(16, zp.crc, true);
        cdv.setUint32(20, zp.data.length, true); cdv.setUint32(24, zp.data.length, true);
        cdv.setUint16(28, nb.length, true); cdv.setUint16(30, 0, true);
        cdv.setUint16(32, 0, true); cdv.setUint32(42, zp.offset, true);
        cd.set(nb, 46); cdParts.push(cd); cdSize += cd.length;
      }

      var eocd = new Uint8Array(22); var eocdv = new DataView(eocd.buffer);
      eocd.set([0x50, 0x4B, 0x05, 0x06], 0);
      eocdv.setUint16(8, zipParts.length, true); eocdv.setUint16(10, zipParts.length, true);
      eocdv.setUint32(12, cdSize, true); eocdv.setUint32(16, offset, true);

      var total = offset + cdSize + 22; var result = new Uint8Array(total); var wp = 0;
      for (var ai = 0; ai < zipParts.length; ai++) { result.set(zipParts[ai].header, wp); wp += zipParts[ai].header.length; }
      for (var bi = 0; bi < cdParts.length; bi++) { result.set(cdParts[bi], wp); wp += cdParts[bi].length; }
      result.set(eocd, wp);

      var blob = new Blob([result], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      var url = URL.createObjectURL(blob);
      var a = document.createElement("a"); a.href = url; a.download = "riskshield-results.xlsx";
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      setTimeout(function() { URL.revokeObjectURL(url); }, 1000);
    } catch (e) {
      console.error("XLSX generation failed:", e);
      alert("XLSX generation failed. Please use CSV download instead.");
    }
    finally { setXlsxDownloading(false); }
  }

  function exportCSV(filter: "all" | "clean" | "risky") {
    if (!results) return;
    const filtered = filter === "all" ? results : filter === "clean"
      ? results.filter(r => r.decision === "ALLOW")
      : results.filter(r => r.decision !== "ALLOW");
    const header = "email,risk_score,decision,disposable,hasMX,mxChecked,reasons";
    const rows = filtered.map(r => `${r.email},${r.risk_score},${r.decision},${r.disposable},${r.hasMX},${r.mxChecked},"${r.reasons.join("; ")}"`);
    const csv = header + "\n" + rows.join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `${filter}_list.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  const scoreColor = (s: number) => s >= 70 ? "text-red-600" : s >= 40 ? "text-yellow-600" : "text-green-600";
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
            <p className="text-sm text-gray-500 mb-2">Drop a CSV file here, or</p>
            <label className="bg-white border px-4 py-2 rounded-lg text-sm font-medium cursor-pointer hover:bg-gray-50">
              Browse Files
              <input type="file" accept=".csv,.txt" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
            </label>
            <p className="text-xs text-gray-400 mt-2">CSV or TXT, one email per line. Max 5,000.</p>
          </div>

          <div className="mt-4">
            <p className="text-xs text-gray-400 mb-2 uppercase tracking-wider">Or paste emails (one per line)</p>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={"john@example.com\njane@company.com\nsales@domain.com\n..."}
              rows={6}
              className="w-full border rounded-lg p-4 text-sm font-mono resize-y focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={handlePaste}
              disabled={loading || !text.trim()}
              className="mt-3 w-full bg-blue-600 text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? "Checking..." : "Check All Emails"}
            </button>
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
