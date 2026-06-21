"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase";
import { getPlanLimits, type PlanKey } from "@/lib/plans";
import { generateApiKey } from "@/lib/api-auth";
import { signOut } from "@/lib/auth";
import Link from "next/link";
import { LogOut, Shield, Key, Copy, Trash2, Activity, AlertTriangle, Search, Upload, Globe, Mail } from "lucide-react";

interface Profile { id: string; email: string; plan: string; subscription_status: string; credits_remaining: number; total_checks: number; }
interface ApiKeyRow { id: string; key: string; name: string; status: string; created_at: string; last_used_at: string | null; }
interface CheckRecord { id: string; check_type: string; input_value: string; risk_score: number; created_at: string; }

export default function DashboardPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [apiKeys, setApiKeys] = useState<ApiKeyRow[]>([]);
  const [checks, setChecks] = useState<CheckRecord[]>([]);
  const [dailyUsed, setDailyUsed] = useState(0);
  const [monthlyUsed, setMonthlyUsed] = useState(0);
  const [riskyCount, setRiskyCount] = useState(0);
  const [blockedCount, setBlockedCount] = useState(0);
  const [copied, setCopied] = useState("");
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    try {
      const supabase = createClient();
      const { data: { user }, error: authErr } = await supabase.auth.getUser();
      if (authErr || !user) { setAuthChecked(true); return; }

      // Profile - single source of truth for credits
      const { data: p } = await supabase.from("profiles").select("*").eq("id", user.id).single();
      if (p) setProfile(p);

      const todayStr = new Date().toISOString().split("T")[0] + "T00:00:00Z";
      const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();

      // Parallel: usage stats + API keys + recent checks
      const [
        { count: todayC },
        { count: monthC },
        { count: riskyC },
        { count: blockedC },
        { data: keys },
        { data: recentChecks },
      ] = await Promise.all([
        supabase.from("scan_history").select("*", { count: "exact", head: true }).eq("user_id", user.id).gte("created_at", todayStr),
        supabase.from("scan_history").select("*", { count: "exact", head: true }).eq("user_id", user.id).gte("created_at", startOfMonth),
        supabase.from("scan_history").select("*", { count: "exact", head: true }).eq("user_id", user.id).eq("success", true).gte("risk_score", 40).lte("risk_score", 69).gte("created_at", startOfMonth),
        supabase.from("scan_history").select("*", { count: "exact", head: true }).eq("user_id", user.id).gte("risk_score", 70).gte("created_at", startOfMonth),
        supabase.from("api_keys").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
        supabase.from("scan_history").select("id, scan_type, target, risk_score, created_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(20),
      ]);

      setDailyUsed(todayC ?? 0);
      setMonthlyUsed(monthC ?? 0);
      setRiskyCount(riskyC ?? 0);
      setBlockedCount(blockedC ?? 0);
      if (keys) setApiKeys(keys);
      if (recentChecks) {
        setChecks(recentChecks.map((r: any) => ({
          id: r.id,
          check_type: r.scan_type || "check",
          input_value: r.target || "",
          risk_score: r.risk_score ?? 0,
          created_at: r.created_at,
        })));
      }

      setAuthChecked(true);
    } catch (e) {
      console.error("Dashboard loadData error:", e);
      setAuthChecked(true);
    }
  }

  async function createKey() {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const key = generateApiKey();
    await supabase.from("api_keys").insert({ user_id: user.id, key, name: "API Key " + (apiKeys.length + 1) });
    loadData();
  }

  async function revokeKey(id: string) {
    const supabase = createClient();
    await supabase.from("api_keys").update({ status: "revoked" }).eq("id", id);
    loadData();
  }

  if (!authChecked) return <div className="min-h-screen flex items-center justify-center"><p className="text-gray-500">Loading...</p></div>;
  if (!profile) return <div className="min-h-screen flex items-center justify-center"><p className="text-gray-500">Please sign in to access the dashboard.</p></div>;

  const planKey = profile.plan as PlanKey;
  const planInfo = getPlanLimits(planKey);
  const monthlyLimit = planInfo.monthlyLimit || 50000;
  const dailyLimit = planInfo.dailyLimit || 2000;
  const creditsRemaining = profile.credits_remaining ?? 0;
  const monthlyRemaining = Math.max(0, monthlyLimit - monthlyUsed);
  const dailyRemaining = Math.max(0, dailyLimit - dailyUsed);
  const daysLeftEstimate = dailyUsed > 0 ? Math.max(0, Math.floor(dailyRemaining / (dailyUsed / Math.max(1, new Date().getDate())))) : 999;
  const creditsPercent = monthlyLimit > 0 ? Math.round((creditsRemaining / monthlyLimit) * 100) : 100;
  const monthlyPercent = monthlyLimit > 0 ? Math.round((monthlyRemaining / monthlyLimit) * 100) : 100;
  const usageStatus = monthlyPercent <= 20 ? "critical" : monthlyPercent <= 50 ? "warning" : "healthy";

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link href="/dashboard" className="flex items-center gap-2 font-bold text-lg">
              <Shield className="w-6 h-6 text-blue-600" /> RiskShield
            </Link>
            <nav className="hidden md:flex items-center gap-1">
              <Link href="/dashboard" className="px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-md">Dashboard</Link>
              <Link href="/risk-check" className="px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-md">Risk Check</Link>
              <Link href="/bulk-check" className="px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-md flex items-center gap-1">
                <Upload className="w-3.5 h-3.5" /> Bulk Scan
              </Link>
              <Link href="/blacklist" className="px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-md">Blacklist</Link>
              <Link href="/pricing" className="px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-md">Pricing</Link>
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-400 hidden sm:inline">{profile.email}</span>
            <button onClick={() => signOut()} className="p-2 text-gray-400 hover:text-red-600 rounded-lg hover:bg-gray-100" title="Sign Out">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        {/* Alert: low credits */}
        {monthlyPercent <= 20 && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-yellow-600 shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium text-yellow-800">Only {monthlyRemaining.toLocaleString()} credits left — you are approaching your monthly limit</p>
              <p className="text-xs text-yellow-600 mt-0.5">Upgrade to continue unlimited verification of your customers</p>
            </div>
            <Link href="/pricing" className="bg-yellow-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-yellow-700 shrink-0">Upgrade Plan</Link>
          </div>
        )}

        {/* 4-Card Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Checks Remaining This Month */}
          <div className="bg-white rounded-xl border p-5">
            <div className="flex items-center gap-2 text-blue-600 mb-2"><Shield className="w-5 h-5" /><span className="font-semibold text-sm">Checks Remaining This Month</span></div>
            <div className="text-2xl font-bold">{monthlyRemaining.toLocaleString()}<span className="text-sm font-normal text-gray-400"> / {monthlyLimit.toLocaleString()}</span></div>
            <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
              <div className="bg-blue-600 h-2 rounded-full transition-all" style={{ width: Math.min(100, (monthlyUsed / monthlyLimit) * 100) + "%" }} />
            </div>
            <div className="text-xs text-gray-400 mt-1.5">
                {usageStatus === "healthy" ? (
                  <span className="text-green-600 font-medium">Sufficient for current usage</span>
                ) : usageStatus === "warning" ? (
                  <span className="text-yellow-600 font-medium">Only {monthlyRemaining.toLocaleString()} checks left — you are approaching your monthly limit</span>
                ) : (
                  <span className="text-red-600 font-medium">⚠ Only {monthlyRemaining.toLocaleString()} checks left — upgrade to continue protecting customers</span>
                )}
              </div>
          </div>

          {/* Card 2: This Month */}
          <div className="bg-white rounded-xl border p-5">
            <div className="flex items-center gap-2 text-green-600 mb-2"><Activity className="w-5 h-5" /><span className="font-semibold text-sm">This Month</span></div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="text-2xl font-bold text-gray-700">{monthlyUsed.toLocaleString()}</div>
                <div className="text-xs text-gray-400 mt-0.5">customers verified</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-yellow-600">{riskyCount.toLocaleString()}</div>
                <div className="text-xs text-gray-400 mt-0.5">risky flagged</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-red-600">{blockedCount.toLocaleString()}</div>
                <div className="text-xs text-gray-400 mt-0.5">blocked / prevented</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-gray-700">{monthlyUsed + monthlyRemaining > 0 ? Math.round((monthlyRemaining / (monthlyUsed + monthlyRemaining)) * 100) : 100}%</div>
                <div className="text-xs text-gray-400 mt-0.5">quota available</div>
              </div>
            </div>
          </div>

          {/* Card 3: Plan */}
          <div className="bg-white rounded-xl border p-5">
            <div className="flex items-center gap-2 text-purple-600 mb-2"><Activity className="w-5 h-5" /><span className="font-semibold text-sm">Plan</span></div>
            <div className="text-2xl font-bold capitalize">{profile.plan}</div>
            <div className="text-xs text-gray-400 mt-1">{profile.subscription_status}</div>
            {profile.plan === "free" && (
              <Link href="/pricing" className="mt-2 inline-block text-sm text-blue-600 font-medium hover:underline">
                Upgrade to unlock unlimited verification
              </Link>
            )}
          </div>

          {/* Card 4: API Keys */}
          <div className="bg-white rounded-xl border p-5">
            <div className="flex items-center gap-2 text-indigo-600 mb-2"><Key className="w-5 h-5" /><span className="font-semibold text-sm">API Keys</span></div>
            <div className="text-2xl font-bold">{apiKeys.filter(k => k.status === "active").length}</div>
            <div className="text-xs text-gray-400 mt-1">active keys</div>
            {apiKeys.filter(k => k.status === "active").length === 0 && (
              <button onClick={createKey} className="mt-2 text-sm text-blue-600 font-medium hover:underline">Generate your first key</button>
            )}
          </div>
        </div>

        {/* API Keys Management */}
        <div className="bg-white rounded-xl border p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold flex items-center gap-2"><Key className="w-5 h-5" /> API Keys</h2>
            <button onClick={createKey} className="bg-blue-600 text-white px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-blue-700">Generate Key</button>
          </div>
          {apiKeys.length === 0 && <p className="text-sm text-gray-400">No API keys yet. Generate one to start using the API.</p>}
          {apiKeys.map((k) => (
            <div key={k.id} className="flex items-center justify-between bg-gray-50 rounded-lg px-4 py-3 mt-3">
              <div>
                <div className="font-mono text-sm text-gray-800">{k.key ? k.key.slice(0, 12) + "..." + k.key.slice(-6) : "N/A"}{k.status === "revoked" ? <span className="ml-2 text-xs bg-red-100 text-red-600 px-1.5 py-0.5 rounded">Revoked</span> : null}</div>
                <div className="text-xs text-gray-400 mt-0.5">Created {new Date(k.created_at).toLocaleDateString()}{k.last_used_at ? " 路 Last used " + new Date(k.last_used_at).toLocaleDateString() : ""}</div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => { if (k.key) { navigator.clipboard.writeText(k.key); setCopied(k.id); setTimeout(() => setCopied(""), 2000); } }} className="p-1.5 text-gray-400 hover:text-gray-700 rounded"><Copy className="w-4 h-4" />{copied === k.id && <span className="text-xs ml-1 text-green-600">Copied!</span>}</button>
                {k.status === "active" && <button onClick={() => revokeKey(k.id)} className="p-1.5 text-gray-400 hover:text-red-600 rounded"><Trash2 className="w-4 h-4" /></button>}
              </div>
            </div>
          ))}
        </div>{/* Google Sheets Integration */}
        <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl border border-green-200 p-6">
          <div className="flex items-start gap-4 flex-wrap">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-2xl">📊</span>
                <h2 className="font-semibold text-lg">Google Sheets Add-on</h2>
              </div>
              <p className="text-sm text-gray-600 mb-3">Scan emails in bulk directly from Google Sheets. Install our add-on and use your API key to verify thousands of leads without leaving your spreadsheet.</p>
              <ol className="text-sm text-gray-600 space-y-1 list-decimal list-inside mb-4">
                <li>Open Google Sheets → <strong>Extensions</strong> → <strong>Apps Script</strong></li>
                <li>Paste the script from <a href="/docs" className="text-blue-600 underline">our docs</a></li>
                <li>Save and reload the sheet</li>
                <li>Go to <strong>Risk Scanner → Settings</strong> and paste your API key</li>
              </ol>
              <div className="flex items-center gap-3">
                <a href="/docs" className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-700 inline-flex items-center gap-1">
                  View Setup Guide
                </a>
                <span className="text-xs text-gray-400">Script: D:/ai-saas-mvp/google-sheets-addon/Code.gs</span>
              </div>
            </div>
            <div className="bg-white rounded-lg border border-green-100 p-4 text-sm shrink-0">
              <div className="font-semibold text-gray-700 mb-2">Quick Start</div>
              <code className="text-xs bg-gray-100 px-2 py-1 rounded block mb-1">POST /api/v1/email/batch-check</code>
              <code className="text-xs bg-gray-100 px-2 py-1 rounded block">up to 100 emails/batch</code>
            </div>
          </div>
        </div>


        {/* Recent Checks */}
        <div className="bg-white rounded-xl border p-6">
          <h2 className="font-semibold flex items-center gap-2 mb-4"><Activity className="w-5 h-5" /> Recent Checks</h2>
          {checks.length === 0 && <p className="text-sm text-gray-400">No checks yet. Run email or IP risk checks from the Risk Check page or via API.</p>}
          {checks.map((c) => (
            <div key={c.id} className="flex items-center justify-between text-sm py-2 border-b border-gray-100 last:border-0">
              <div className="flex items-center gap-3">
                <span className="text-xs bg-gray-100 px-2 py-0.5 rounded font-mono uppercase">{c.check_type}</span>
                <span className="text-gray-700 truncate max-w-[200px]">{c.input_value}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className={c.risk_score >= 60 ? "text-red-600" : c.risk_score >= 30 ? "text-yellow-600" : "text-green-600"}>Risk: {c.risk_score}</span>
                <span className="text-gray-400 text-xs">{new Date(c.created_at).toLocaleString()}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
