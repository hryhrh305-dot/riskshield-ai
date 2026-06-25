"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { getPlanLimits, type PlanKey } from "@/lib/plans";
import { generateApiKey } from "@/lib/api-auth";
import { signOut } from "@/lib/auth";
import Link from "next/link";
import { LogOut, Shield, Key, Copy, Trash2, Activity, AlertTriangle, Search, Upload, Globe, Mail, Settings, Download, Inbox } from "lucide-react";

interface Profile { id: string; email: string; plan: string; subscription_status: string; credits_remaining: number; total_checks: number; }
interface ApiKeyRow { id: string; key: string; name: string; status: string; created_at: string; last_used_at: string | null; }
interface CheckRecord { id: string; check_type: string; input_value: string; risk_score: number; created_at: string; }
const defaultSettings = { block_disposable: true, block_high_risk: true, review_catch_all: true, review_new_domain: true };
const mobileNavItems = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/risk-check", label: "Risk Check" },
  { href: "/bulk-check", label: "Bulk Scan" },
  { href: "/pre-send", label: "Pre-send" },
  { href: "/blacklist", label: "Blacklist" },
  { href: "/pricing", label: "Pricing" },
];

export default function DashboardPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [apiKeys, setApiKeys] = useState<ApiKeyRow[]>([]);
  const [checks, setChecks] = useState<CheckRecord[]>([]);
  const [dailyUsed, setDailyUsed] = useState(0);
  const [monthlyUsed, setMonthlyUsed] = useState(0);
  const [riskyCount, setRiskyCount] = useState(0);
  const [blockedCount, setBlockedCount] = useState(0);
  const [copied, setCopied] = useState("");
  const [authChecked, setAuthChecked] = useState(false);

  // Settings state
  const [settings, setSettings] = useState<{ block_disposable: boolean; block_high_risk: boolean; review_catch_all: boolean; review_new_domain: boolean } | null>(null);
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [settingsSaved, setSettingsSaved] = useState(false);
  const [feedbackSubject, setFeedbackSubject] = useState("");
  const [feedbackMessage, setFeedbackMessage] = useState("");
  const [feedbackLoading, setFeedbackLoading] = useState(false);
  const [feedbackError, setFeedbackError] = useState("");
  const [feedbackSaved, setFeedbackSaved] = useState(false);
  const [feedbackSentToday, setFeedbackSentToday] = useState(0);
  const [feedbackDailyLimit, setFeedbackDailyLimit] = useState(3);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => { loadData(); loadSettings(); loadFeedbackQuota(); loadAdminStatus(); }, []);
  useEffect(() => {
    if (authChecked && !profile) {
      router.replace("/login?reason=invalid_session&next=/dashboard");
    }
  }, [authChecked, profile, router]);

  async function loadSettings() {
    try {
      const res = await fetch("/api/settings", { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setSettings(data.settings);
      }
    } catch {}
  }

  async function saveSettings() {
    setSettingsLoading(true);
    setSettingsSaved(false);
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(settings),
      });
      if (res.ok) {
        const data = await res.json();
        setSettings(data.settings);
        setSettingsSaved(true);
        setTimeout(() => setSettingsSaved(false), 3000);
      }
    } catch {} finally { setSettingsLoading(false); }
  }

  async function loadFeedbackQuota() {
    try {
      const res = await fetch("/api/feedback", { credentials: "include" });
      if (!res.ok) return;
      const data = await res.json();
      setFeedbackSentToday(data.sentToday ?? 0);
      setFeedbackDailyLimit(data.dailyLimit ?? 3);
    } catch {}
  }

  async function loadAdminStatus() {
    try {
      const res = await fetch("/api/admin/me", { credentials: "include" });
      if (!res.ok) return;
      const data = await res.json();
      setIsAdmin(!!data?.isAdmin);
    } catch {}
  }

  async function handleFeedbackSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFeedbackLoading(true);
    setFeedbackError("");
    setFeedbackSaved(false);

    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          subject: feedbackSubject,
          message: feedbackMessage,
        }),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setFeedbackError(data?.error || "Failed to send feedback.");
        if (typeof data?.sentToday === "number") setFeedbackSentToday(data.sentToday);
        if (typeof data?.dailyLimit === "number") setFeedbackDailyLimit(data.dailyLimit);
        return;
      }

      setFeedbackSubject("");
      setFeedbackMessage("");
      setFeedbackSaved(true);
      setFeedbackSentToday(data?.sentToday ?? feedbackSentToday + 1);
      setFeedbackDailyLimit(data?.dailyLimit ?? feedbackDailyLimit);
      setTimeout(() => setFeedbackSaved(false), 3000);
    } finally {
      setFeedbackLoading(false);
    }
  }

  async function loadData() {
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) { setProfile(null); setAuthChecked(true); return; }

      // Profile - single source of truth for credits
      const { data: p } = await supabase.from("profiles").select("*").eq("id", user.id).single();
      if (p) setProfile(p);
      else setProfile(null);

      const todayStr = new Date().toISOString().split("T")[0] + "T00:00:00Z";
      const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();

      // Parallel: usage stats + API keys + recent checks
      const [
        { count: todayC },
        { count: riskyC },
        { count: blockedC },
        { data: keys },
        { data: recentChecks },
      ] = await Promise.all([
        supabase.from("scan_history").select("*", { count: "exact", head: true }).eq("user_id", user.id).gte("created_at", todayStr),
        supabase.from("scan_history").select("*", { count: "exact", head: true }).eq("user_id", user.id).eq("success", true).gte("risk_score", 40).lte("risk_score", 69).gte("created_at", startOfMonth),
        supabase.from("scan_history").select("*", { count: "exact", head: true }).eq("user_id", user.id).gte("risk_score", 70).gte("created_at", startOfMonth),
        supabase.from("api_keys").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
        supabase.from("scan_history").select("id, scan_type, target, risk_score, created_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(20),
      ]);

      setDailyUsed(todayC ?? 0);
      setMonthlyUsed(p?.total_checks ?? 0);
      setRiskyCount(riskyC ?? 0);
      setBlockedCount(blockedC ?? 0);
      if (keys) setApiKeys(keys.filter((key: ApiKeyRow) => key.status === "active"));
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
      setProfile(null);
      setAuthChecked(true);
    }
  }

  async function createKey() {
    const currentPlan = profile?.plan || "free";
    if (!getPlanLimits(currentPlan).apiAccess) return;
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    const user = session?.user;
    if (!user) return;
    const key = generateApiKey();
    await supabase.from("api_keys").insert({ user_id: user.id, key, name: "API Key " + (apiKeys.length + 1) });
    loadData();
  }

  async function revokeKey(id: string) {
    const supabase = createClient();
    await supabase.from("api_keys").update({ status: "revoked" }).eq("id", id);
    setApiKeys((prev) => prev.filter((key) => key.id !== id));
    loadData();
  }

  if (!authChecked) return <div className="min-h-screen flex items-center justify-center"><p className="text-gray-500">Loading...</p></div>;
  if (!profile) return <div className="min-h-screen flex items-center justify-center"><p className="text-gray-500">Redirecting to sign in...</p></div>;

  const planKey = profile.plan as PlanKey;
  const planInfo = getPlanLimits(planKey);
  const monthlyLimit = planInfo.monthlyLimit || 50000;
  const dailyLimit = planInfo.dailyLimit || 2000;
  const creditsRemaining = profile.credits_remaining ?? 0;
  const apiEnabled = planInfo.apiAccess;
  const feedbackRemaining = Math.max(0, feedbackDailyLimit - feedbackSentToday);
  const dailyRemaining = Math.max(0, dailyLimit - dailyUsed);
  const daysLeftEstimate = dailyUsed > 0 ? Math.max(0, Math.floor(dailyRemaining / (dailyUsed / Math.max(1, new Date().getDate())))) : 999;
  const displayCreditsRemaining = Math.min(creditsRemaining, monthlyLimit);
  const monthlyRemaining = displayCreditsRemaining;
  const creditsPercent = monthlyLimit > 0 ? Math.min(100, Math.round((displayCreditsRemaining / monthlyLimit) * 100)) : 100;
  const monthlyPercent = creditsPercent;
  const usageStatus = monthlyPercent <= 20 ? "critical" : monthlyPercent <= 50 ? "warning" : "healthy";
  const activeApiKeys = apiKeys.filter((key) => key.status === "active");

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
              <Link href="/pre-send" className="px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-md">Pre-send</Link>
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
        <div className="border-t border-gray-100 md:hidden">
          <div className="max-w-6xl mx-auto px-4 py-3 overflow-x-auto">
            <div className="flex items-center gap-2 min-w-max">
              {mobileNavItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="whitespace-nowrap rounded-full border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  {item.label}
                </Link>
              ))}
            </div>
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
              <p className="text-xs text-yellow-600 mt-0.5">Upgrade to increase credits, unlock deeper checks, and enable API access</p>
            </div>
            <Link href="/pricing" className="bg-yellow-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-yellow-700 shrink-0">Upgrade Plan</Link>
          </div>
        )}

        {/* 4-Card Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Credits Remaining */}
          <div className="bg-white rounded-xl border p-5">
            <div className="flex items-center gap-2 text-blue-600 mb-2"><Shield className="w-5 h-5" /><span className="font-semibold text-sm">Credits Remaining</span></div>
            <div className="text-2xl font-bold">{displayCreditsRemaining.toLocaleString()}<span className="text-sm font-normal text-gray-400"> / {monthlyLimit.toLocaleString()}</span></div>
            <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
              <div className="bg-blue-600 h-2 rounded-full transition-all" style={{ width: `${creditsPercent}%` }} />
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
                <div className="text-2xl font-bold text-gray-700">{creditsPercent}%</div>
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
                Upgrade to unlock deep checks and API access
              </Link>
            )}
          </div>

          {/* Card 4: API Keys */}
          <div className="bg-white rounded-xl border p-5">
            <div className="flex items-center gap-2 text-indigo-600 mb-2"><Key className="w-5 h-5" /><span className="font-semibold text-sm">API Keys</span></div>
            <div className="text-2xl font-bold">{activeApiKeys.length}</div>
            <div className="text-xs text-gray-400 mt-1">active keys</div>
            {activeApiKeys.length === 0 && (
              <button onClick={createKey} className="mt-2 text-sm text-blue-600 font-medium hover:underline">Generate your first key</button>
            )}
          </div>
        </div>

        {/* API Keys Management */}
        <div className="bg-white rounded-xl border p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold flex items-center gap-2"><Key className="w-5 h-5" /> API Keys</h2>
            <button
              onClick={createKey}
              disabled={!apiEnabled}
              className="bg-blue-600 text-white px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Generate Key
            </button>
          </div>
          {!apiEnabled && (
            <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              API access starts on Growth. Upgrade to create and manage API keys.
            </div>
          )}
          {apiKeys.length === 0 && (
            <p className="text-sm text-gray-400">
              {apiEnabled ? "No API keys yet. Generate one to start using the API." : "Upgrade to Growth to generate API keys."}
            </p>
          )}
          {activeApiKeys.map((k) => (
            <div key={k.id} className="flex items-center justify-between bg-gray-50 rounded-lg px-4 py-3 mt-3">
              <div>
                <div className="font-mono text-sm text-gray-800">{k.key ? k.key.slice(0, 12) + "..." + k.key.slice(-6) : "N/A"}</div>
                <div className="text-xs text-gray-400 mt-0.5">Created {new Date(k.created_at).toLocaleDateString()}{k.last_used_at ? " 路 Last used " + new Date(k.last_used_at).toLocaleDateString() : ""}</div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => { if (k.key) { navigator.clipboard.writeText(k.key); setCopied(k.id); setTimeout(() => setCopied(""), 2000); } }} className="p-1.5 text-gray-400 hover:text-gray-700 rounded"><Copy className="w-4 h-4" />{copied === k.id && <span className="text-xs ml-1 text-green-600">Copied!</span>}</button>
                <button
                  onClick={() => {
                    const confirmed = window.confirm("Delete this API key? This action cannot be undone.");
                    if (confirmed) void revokeKey(k.id);
                  }}
                  className="p-1.5 text-gray-400 hover:text-red-600 rounded"
                  title="Delete API key"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
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
              <p className="text-sm text-gray-600 mb-3">Scan emails in bulk directly from Google Sheets. Download the script, paste it into Apps Script, then connect it with your RiskShield API key.</p>
              <ol className="text-sm text-gray-600 space-y-1.5 list-decimal list-inside mb-4">
                <li>Click <strong>Download Code.gs</strong> below.</li>
                <li>Open your Google Sheet, then click <strong>Extensions</strong> &gt; <strong>Apps Script</strong>.</li>
                <li>Delete the default sample code in Apps Script.</li>
                <li>Open the downloaded <strong>Code.gs</strong> file, copy all code, and paste it into Apps Script.</li>
                <li>Click <strong>Save</strong>, then reload your Google Sheet.</li>
                <li>Open <strong>Risk Scanner</strong> &gt; <strong>Settings</strong>, paste your API key, and save.</li>
                <li>Select the email cells, then choose <strong>Risk Scanner</strong> &gt; <strong>Scan Selected Emails</strong>.</li>
              </ol>
              <div className="flex flex-wrap items-center gap-3">
                <a href="/api/google-sheets-addon" className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-700 inline-flex items-center gap-1">
                  <Download className="w-4 h-4" /> Download Code.gs
                </a>
                <a href="/docs/google-sheets" className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-700 inline-flex items-center gap-1">
                  View Setup Guide
                </a>
              </div>
            </div>
            <div className="bg-white rounded-lg border border-green-100 p-4 text-sm shrink-0">
              <div className="font-semibold text-gray-700 mb-2">Quick Start</div>
              <code className="text-xs bg-gray-100 px-2 py-1 rounded block mb-1">POST /api/v1/email/batch-check</code>
              <code className="text-xs bg-gray-100 px-2 py-1 rounded block">up to 100 emails/batch</code>
            </div>
          </div>
        </div>


        {/* Protection Settings */}
        <div className="bg-white rounded-xl border p-6">
          <h2 className="font-semibold flex items-center gap-2 mb-1"><Settings className="w-5 h-5" /> Protection Settings</h2>
          <p className="text-xs text-gray-400 mb-4">Toggle which risks should force BLOCK or REVIEW. Applies to web checks and API.</p>
          <div className="space-y-3 mb-4">
            {(settings || { block_disposable: true, block_high_risk: true, review_catch_all: true, review_new_domain: true }) && [
              { key: "block_disposable", label: "Block disposable emails", desc: "Force BLOCK on temporary/disposable email addresses" },
              { key: "block_high_risk", label: "Block high risk score", desc: "Force BLOCK when risk score is 60 or above" },
              { key: "review_catch_all", label: "Review catch-all domains", desc: "Force REVIEW on domains that accept all mailboxes" },
              { key: "review_new_domain", label: "Review new domains", desc: "Force REVIEW on domains less than 90 days old" },
            ].map(({ key, label, desc }) => (
              <div key={key} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                <div>
                  <div className="text-sm font-medium text-gray-700">{label}</div>
                  <div className="text-xs text-gray-400">{desc}</div>
                </div>
                <button
                  onClick={() => { const s = settings || { block_disposable: true, block_high_risk: true, review_catch_all: true, review_new_domain: true }; setSettings({ ...s, [key]: !(s as any)[key] }); }}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${(settings || defaultSettings)[key] ? 'bg-blue-600' : 'bg-gray-300'}`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${(settings || defaultSettings)[key] ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
              </div>
            ))}
          </div>
          <button onClick={saveSettings} disabled={settingsLoading} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
            {settingsLoading ? "Saving..." : "Save Settings"}
          </button>
          {settingsSaved && <span className="ml-3 text-xs text-green-600">Saved!</span>}
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

        <div className="bg-white rounded-xl border p-6">
          <h2 className="font-semibold flex items-center gap-2 mb-1"><Mail className="w-5 h-5" /> Send Feedback</h2>
          <p className="text-xs text-gray-400 mb-4">
            Send product feedback directly inside RiskShield. Daily limit: {feedbackSentToday}/{feedbackDailyLimit}.
          </p>
          <form onSubmit={handleFeedbackSubmit} className="space-y-4 max-w-2xl">
            {feedbackError && (
              <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                {feedbackError}
              </div>
            )}
            {feedbackSaved && (
              <div className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">
                Feedback sent successfully. Thanks for helping us improve RiskShield.
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Subject</label>
              <input
                type="text"
                value={feedbackSubject}
                onChange={(e) => setFeedbackSubject(e.target.value)}
                minLength={4}
                maxLength={120}
                required
                placeholder="Bug report, feature request, UX issue..."
                className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Message</label>
              <textarea
                value={feedbackMessage}
                onChange={(e) => setFeedbackMessage(e.target.value)}
                minLength={10}
                maxLength={2000}
                required
                rows={5}
                placeholder="Tell us what happened, what you expected, and how we can improve."
                className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <div className="mt-1 flex items-center justify-between text-xs text-gray-400">
                <span>{feedbackRemaining} submissions left today</span>
                <span>{feedbackMessage.length}/2000</span>
              </div>
            </div>
            <button
              type="submit"
              disabled={feedbackLoading || feedbackRemaining <= 0}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              {feedbackLoading ? "Sending..." : feedbackRemaining <= 0 ? "Daily limit reached" : "Send Feedback"}
            </button>
          </form>
        </div>

        {isAdmin && (
          <div className="bg-white rounded-xl border p-6">
            <h2 className="font-semibold flex items-center gap-2 mb-2">
              <Inbox className="w-5 h-5" />
              Admin Tools
            </h2>
            <p className="text-sm text-gray-500 mb-3">Review user feedback submitted through the dashboard form.</p>
            <Link href="/admin/feedback" className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
              Open Feedback Inbox
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
