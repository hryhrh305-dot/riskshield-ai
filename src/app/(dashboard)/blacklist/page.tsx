"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowRight, Shield, Plus, Trash2, Globe, Mail, Upload, Ban } from "lucide-react";

interface BlacklistEntry {
  id: number;
  type: string;
  value: string;
  reason: string;
  risk_score: number;
  hit_count: number;
  created_at: string;
}

const mobileNavItems = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/risk-check", label: "Risk Check" },
  { href: "/bulk-check", label: "Bulk Scan" },
  { href: "/blacklist", label: "Blacklist" },
  { href: "/pricing", label: "Pricing" },
];

export default function BlacklistPage() {
  const [entries, setEntries] = useState<BlacklistEntry[]>([]);
  const [type, setType] = useState("email");
  const [value, setValue] = useState("");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    fetchBlacklist();
  }, []);

  async function fetchBlacklist() {
    try {
      const res = await fetch("/api/blacklist", { credentials: "include" });
      const data = await res.json();
      if (data.blacklist) setEntries(data.blacklist);
    } catch {}
  }

  async function addEntry() {
    if (!value.trim()) {
      setError("Value is required");
      return;
    }
    setLoading(true);
    setError("");
    setSuccess("");
    try {
      const res = await fetch("/api/blacklist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ type, value: value.trim(), reason: reason.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error);
        return;
      }
      setSuccess("Added to blacklist.");
      setValue("");
      setReason("");
      fetchBlacklist();
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  async function removeEntry(id: number) {
    try {
      const res = await fetch("/api/blacklist?id=" + id, { method: "DELETE", credentials: "include" });
      if (res.ok) fetchBlacklist();
    } catch {}
  }

  const scoreColor = (score: number) =>
    score >= 70 ? "text-red-300" : score >= 40 ? "text-amber-300" : "text-emerald-300";

  return (
    <div className="rs-app min-h-screen">
      <header className="sticky top-0 z-20 border-b border-white/10 bg-black/30 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <div className="flex items-center gap-6">
            <Link href="/dashboard" className="flex items-center gap-3 text-lg font-bold text-white">
              <span className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/5">
                <Shield className="h-5 w-5 text-white" />
              </span>
              <div>
                <div className="text-sm font-semibold uppercase tracking-[0.22em] text-slate-300">RiskShield AI</div>
                <div className="text-xs text-slate-500">Blacklist control</div>
              </div>
            </Link>

            <nav className="hidden items-center gap-1 md:flex">
              <Link href="/dashboard" className="rounded-full px-3 py-1.5 text-sm font-medium text-slate-300 transition hover:bg-white/5 hover:text-white">Dashboard</Link>
              <Link href="/risk-check" className="rounded-full px-3 py-1.5 text-sm font-medium text-slate-300 transition hover:bg-white/5 hover:text-white">Risk Check</Link>
              <Link href="/bulk-check" className="flex items-center gap-1 rounded-full px-3 py-1.5 text-sm font-medium text-slate-300 transition hover:bg-white/5 hover:text-white">
                <Upload className="h-3.5 w-3.5" /> Bulk Scan
              </Link>
              <Link href="/blacklist" className="rounded-full border border-white/10 bg-white/8 px-3 py-1.5 text-sm font-medium text-white">
                Blacklist
              </Link>
              <Link href="/pricing" className="rounded-full px-3 py-1.5 text-sm font-medium text-slate-300 transition hover:bg-white/5 hover:text-white">Pricing</Link>
            </nav>
          </div>

          <Link href="/dashboard" className="rs-link-arrow inline-flex items-center gap-1 text-sm text-slate-400 hover:text-white">
            <ArrowRight className="h-4 w-4 rotate-180" /> Dashboard
          </Link>
        </div>

        <div className="border-t border-white/10 md:hidden">
          <div className="mx-auto max-w-6xl overflow-x-auto px-4 py-3">
            <div className="flex min-w-max items-center gap-2">
              {mobileNavItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`whitespace-nowrap rounded-full border px-3 py-1.5 text-sm font-medium transition ${
                    item.href === "/blacklist"
                      ? "border-white/10 bg-white/10 text-white"
                      : "border-white/10 bg-white/5 text-slate-200 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8">
        <section className="mb-8 text-center">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-sm font-medium text-slate-200">
            <Ban className="h-4 w-4" /> Custom Blacklist
          </div>
          <h1 className="rs-title-settle text-3xl font-semibold text-white sm:text-4xl">Blacklist Manager</h1>
          <p className="mx-auto mt-3 max-w-2xl text-slate-400">
            Add emails, domains, or IPs to your custom blacklist. Matching inputs will be auto-blocked across supported checks.
          </p>
        </section>

        <section className="rs-card rs-card-hover mb-6 rounded-[28px] p-6">
          <h2 className="mb-4 text-lg font-semibold text-white">Add New Entry</h2>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="rs-select px-3 py-3 text-sm"
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
              className="rs-input px-3 py-3 text-sm sm:col-span-2"
            />
            <button
              onClick={addEntry}
              disabled={loading}
              className="rs-button-primary inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-4 py-2 text-sm font-medium disabled:opacity-50"
            >
              <Plus className="h-4 w-4" /> Add
            </button>
          </div>

          <input
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Reason (optional)"
            className="rs-input mt-3 px-3 py-3 text-sm"
          />

          {error && <div className="mt-3 rounded-2xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-200">{error}</div>}
          {success && <div className="mt-3 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">{success}</div>}
        </section>

        <section className="rs-card rounded-[28px] overflow-hidden">
          <div className="border-b border-white/10 px-5 py-4">
            <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-300">Blacklist Entries</h2>
          </div>

          {entries.length === 0 ? (
            <div className="px-5 py-14 text-center">
              <Ban className="mx-auto mb-3 h-10 w-10 text-slate-600" />
              <p className="text-sm text-slate-400">No entries yet. Add your first blacklist item above.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="border-b border-white/10 bg-black/20">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium text-slate-500">Type</th>
                    <th className="px-4 py-3 text-left font-medium text-slate-500">Value</th>
                    <th className="px-4 py-3 text-left font-medium text-slate-500">Reason</th>
                    <th className="px-4 py-3 text-left font-medium text-slate-500">Score</th>
                    <th className="px-4 py-3 text-left font-medium text-slate-500">Hits</th>
                    <th className="px-4 py-3 text-left font-medium text-slate-500">Added</th>
                    <th className="px-4 py-3 text-right font-medium text-slate-500">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((entry) => (
                    <tr key={entry.id} className="border-b border-white/10 last:border-0 hover:bg-white/[0.025]">
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs uppercase tracking-[0.18em] text-slate-300">
                          {entry.type === "email" ? <Mail className="h-3 w-3" /> : <Globe className="h-3 w-3" />}
                          {entry.type}
                        </span>
                      </td>
                      <td className="max-w-[240px] px-4 py-3 font-mono text-slate-100">
                        <div className="truncate">{entry.value}</div>
                      </td>
                      <td className="max-w-[240px] px-4 py-3 text-slate-400">
                        <div className="truncate">{entry.reason || "-"}</div>
                      </td>
                      <td className={`px-4 py-3 font-semibold ${scoreColor(entry.risk_score)}`}>{entry.risk_score}</td>
                      <td className="px-4 py-3 text-slate-300">{entry.hit_count}</td>
                      <td className="px-4 py-3 text-slate-500">{new Date(entry.created_at).toLocaleDateString()}</td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => removeEntry(entry.id)}
                          className="rounded-xl p-2 text-slate-400 transition hover:bg-white/5 hover:text-red-400"
                          title="Delete entry"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
