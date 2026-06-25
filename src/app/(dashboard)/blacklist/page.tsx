"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowRight, Shield, Plus, Trash2, Globe, Mail, Upload } from "lucide-react";

interface BlacklistEntry {
  id: number;
  type: string;
  value: string;
  reason: string;
  risk_score: number;
  hit_count: number;
  created_at: string;
}

export default function BlacklistPage() {
  const [entries, setEntries] = useState<BlacklistEntry[]>([]);
  const [type, setType] = useState("email");
  const [value, setValue] = useState("");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => { fetchBlacklist(); }, []);

  async function fetchBlacklist() {
    try {
      const res = await fetch("/api/blacklist", { credentials: "include" });
      const data = await res.json();
      if (data.blacklist) setEntries(data.blacklist);
    } catch {}
  }

  async function addEntry() {
    if (!value.trim()) { setError("Value is required"); return; }
    setLoading(true); setError(""); setSuccess("");
    try {
      const res = await fetch("/api/blacklist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ type, value: value.trim(), reason: reason.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error); return; }
      setSuccess("Added to blacklist!");
      setValue(""); setReason("");
      fetchBlacklist();
    } catch { setError("Network error"); }
    finally { setLoading(false); }
  }

  async function removeEntry(id: number) {
    try {
      const res = await fetch("/api/blacklist?id=" + id, { method: "DELETE", credentials: "include" });
      if (res.ok) fetchBlacklist();
    } catch {}
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <header className="bg-white border-b sticky top-0 z-20 mb-6">
          <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
            <div className="flex items-center gap-6">
              <Link href="/dashboard" className="flex items-center gap-2 font-bold text-lg">
                <Shield className="w-6 h-6 text-blue-600" /> RiskShield AI
              </Link>
              <nav className="hidden md:flex items-center gap-1">
                <Link href="/dashboard" className="px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-md">Dashboard</Link>
                <Link href="/risk-check" className="px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-md">Risk Check</Link>
                <Link href="/bulk-check" className="px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-md flex items-center gap-1">
                  <Upload className="w-3.5 h-3.5" /> Bulk Scan
                </Link>
                <Link href="/blacklist" className="px-3 py-1.5 text-sm font-medium bg-blue-50 text-blue-700 rounded-md">Blacklist</Link>
                <Link href="/pricing" className="px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-md">Pricing</Link>
              </nav>
            </div>
            <Link href="/dashboard" className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1">
              <ArrowRight className="w-4 h-4 rotate-180" /> Dashboard
            </Link>
          </div>
        </header>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-8">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 bg-purple-50 text-purple-700 px-4 py-1.5 rounded-full text-sm font-medium mb-4">
            <Shield className="w-4 h-4" /> Custom Blacklist
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Blacklist Manager</h1>
          <p className="text-gray-500">Add emails, domains, or IPs to your custom blacklist. They will be auto-blocked in all checks.</p>
        </div>

        {/* Add Form */}
        <div className="bg-white rounded-xl border p-6 mb-6 shadow-sm">
          <h2 className="font-semibold mb-4">Add New Entry</h2>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="email">Email</option>
              <option value="domain">Domain</option>
              <option value="ip">IP Address</option>
            </select>
            <input
              type="text"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={type === "email" ? "spam@domain.com" : type === "domain" ? "baddomain.com" : "1.2.3.4"}
              className="sm:col-span-2 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={addEntry}
              disabled={loading}
              className="bg-purple-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-purple-700 disabled:opacity-50 flex items-center justify-center gap-1"
            >
              <Plus className="w-4 h-4" /> Add
            </button>
          </div>
          <input
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Reason (optional)"
            className="mt-3 w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {error && <div className="mt-3 p-2 bg-red-50 text-red-600 text-sm rounded-lg">{error}</div>}
          {success && <div className="mt-3 p-2 bg-green-50 text-green-600 text-sm rounded-lg">{success}</div>}
        </div>

        {/* Blacklist Table */}
        <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Type</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Value</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Reason</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 w-16">Score</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 w-16">Hits</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 w-24">Added</th>
                  <th className="w-12"></th>
                </tr>
              </thead>
              <tbody>
                {entries.length === 0 && (
                  <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">No entries yet. Add your first blacklist item above.</td></tr>
                )}
                {entries.map((e) => (
                  <tr key={e.id} className="border-t border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-2.5">
                      <span className="flex items-center gap-1">
                        {e.type === "email" ? <Mail className="w-3 h-3" /> : <Globe className="w-3 h-3" />}
                        <span className="text-xs bg-gray-100 px-1.5 py-0.5 rounded font-mono uppercase">{e.type}</span>
                      </span>
                    </td>
                    <td className="px-4 py-2.5 font-mono text-gray-700">{e.value}</td>
                    <td className="px-4 py-2.5 text-gray-500 text-xs max-w-[200px] truncate">{e.reason || "-"}</td>
                    <td className="px-4 py-2.5 font-bold text-red-600">{e.risk_score}</td>
                    <td className="px-4 py-2.5 text-gray-500">{e.hit_count}</td>
                    <td className="px-4 py-2.5 text-gray-400 text-xs">{new Date(e.created_at).toLocaleDateString()}</td>
                    <td className="px-4 py-2.5">
                      <button onClick={() => removeEntry(e.id)} className="p-1 text-gray-300 hover:text-red-600 rounded">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
