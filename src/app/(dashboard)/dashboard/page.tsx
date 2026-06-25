"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { getPlanLimits, type PlanKey } from "@/lib/plans";
import { generateApiKey } from "@/lib/api-auth";
import { findCreemProductById, hasActiveSubscriptionAccess } from "@/lib/creem";
import { signOut } from "@/lib/auth";
import Link from "next/link";
import {
  LogOut,
  Shield,
  Key,
  Copy,
  Trash2,
  Activity,
  AlertTriangle,
  Upload,
  Mail,
  Settings,
  Download,
  Inbox,
  CreditCard,
} from "lucide-react";

interface Profile {
  id: string;
  email: string;
  plan: string;
  subscription_status: string;
  credits_remaining: number;
  total_checks: number;
}

interface ApiKeyRow {
  id: string;
  key: string;
  name: string;
  status: string;
  created_at: string;
  last_used_at: string | null;
}

interface CheckRecord {
  id: string;
  check_type: string;
  input_value: string;
  risk_score: number;
  created_at: string;
}

interface ScanHistoryRow {
  id: string;
  scan_type: string | null;
  target: string | null;
  risk_score: number | null;
  created_at: string;
}

interface SubscriptionRow {
  id: string;
  plan: string;
  status: string;
  current_period_start?: string | null;
  current_period_end?: string | null;
  cancelled_at?: string | null;
  provider_product_id?: string | null;
  created_at?: string | null;
}

const defaultSettings = {
  block_disposable: true,
  block_high_risk: true,
  review_catch_all: true,
  review_new_domain: true,
};

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
  const [monthlyUsed, setMonthlyUsed] = useState(0);
  const [riskyCount, setRiskyCount] = useState(0);
  const [blockedCount, setBlockedCount] = useState(0);
  const [copied, setCopied] = useState("");
  const [authChecked, setAuthChecked] = useState(false);
  const [settings, setSettings] = useState<{
    block_disposable: boolean;
    block_high_risk: boolean;
    review_catch_all: boolean;
    review_new_domain: boolean;
  } | null>(null);
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
  const [billingPortalLoading, setBillingPortalLoading] = useState(false);
  const [billingPortalError, setBillingPortalError] = useState("");
  const [subscription, setSubscription] = useState<SubscriptionRow | null>(null);

  useEffect(() => {
    loadData();
    loadSettings();
    loadFeedbackQuota();
    loadAdminStatus();
  }, []);

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
    } catch {
    } finally {
      setSettingsLoading(false);
    }
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
        setFeedbackError(data?.error || data?.details || data?.hint || "Failed to send feedback.");
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

  async function openBillingPortal() {
    setBillingPortalLoading(true);
    setBillingPortalError("");

    try {
      const res = await fetch("/api/payment/customer-portal", {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.portalUrl) {
        setBillingPortalError(data?.error || "Failed to open billing portal.");
        return;
      }

      window.location.href = data.portalUrl;
    } finally {
      setBillingPortalLoading(false);
    }
  }

  async function loadData() {
    try {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) {
        setProfile(null);
        setAuthChecked(true);
        return;
      }

      const { data: p } = await supabase.from("profiles").select("*").eq("id", user.id).single();
      if (p) setProfile(p);
      else setProfile(null);

      const todayStr = new Date().toISOString().split("T")[0] + "T00:00:00Z";
      const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();

      const [
        ,
        { count: riskyC },
        { count: blockedC },
        { data: keys },
        { data: recentChecks },
        { data: subscriptionRow },
      ] = await Promise.all([
        supabase.from("scan_history").select("*", { count: "exact", head: true }).eq("user_id", user.id).gte("created_at", todayStr),
        supabase.from("scan_history").select("*", { count: "exact", head: true }).eq("user_id", user.id).eq("success", true).gte("risk_score", 40).lte("risk_score", 69).gte("created_at", startOfMonth),
        supabase.from("scan_history").select("*", { count: "exact", head: true }).eq("user_id", user.id).gte("risk_score", 70).gte("created_at", startOfMonth),
        supabase.from("api_keys").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
        supabase.from("scan_history").select("id, scan_type, target, risk_score, created_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(20),
        supabase.from("subscriptions").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
      ]);

      setMonthlyUsed(p?.total_checks ?? 0);
      setRiskyCount(riskyC ?? 0);
      setBlockedCount(blockedC ?? 0);
      if (keys) setApiKeys(keys.filter((key: ApiKeyRow) => key.status === "active"));
      setSubscription((subscriptionRow as SubscriptionRow | null) || null);

      if (recentChecks) {
        setChecks(
          (recentChecks as ScanHistoryRow[]).map((r) => ({
            id: r.id,
            check_type: r.scan_type || "check",
            input_value: r.target || "",
            risk_score: r.risk_score ?? 0,
            created_at: r.created_at,
          })),
        );
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
    const {
      data: { session },
    } = await supabase.auth.getSession();
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

  if (!authChecked) return <div className="rs-app min-h-screen flex items-center justify-center"><p className="text-slate-400">Loading...</p></div>;
  if (!profile) return <div className="rs-app min-h-screen flex items-center justify-center"><p className="text-slate-400">Redirecting to sign in...</p></div>;

  const planKey = profile.plan as PlanKey;
  const planInfo = getPlanLimits(planKey);
  const monthlyLimit = planInfo.monthlyLimit || 50000;
  const creditsRemaining = profile.credits_remaining ?? 0;
  const apiEnabled = planInfo.apiAccess;
  const feedbackRemaining = Math.max(0, feedbackDailyLimit - feedbackSentToday);
  const displayCreditsRemaining = Math.min(creditsRemaining, monthlyLimit);
  const monthlyRemaining = displayCreditsRemaining;
  const creditsPercent = monthlyLimit > 0 ? Math.min(100, Math.round((displayCreditsRemaining / monthlyLimit) * 100)) : 100;
  const monthlyPercent = creditsPercent;
  const usageStatus = monthlyPercent <= 20 ? "critical" : monthlyPercent <= 50 ? "warning" : "healthy";
  const activeApiKeys = apiKeys.filter((key) => key.status === "active");
  const productMatch = findCreemProductById(subscription?.provider_product_id || null);
  const billingCycleLabel =
    productMatch?.billingInterval === "yearly"
      ? "Yearly"
      : productMatch?.billingInterval === "monthly"
        ? "Monthly"
        : null;
  const subscriptionEndsAt = subscription?.current_period_end || null;
  const isCancelingAtPeriodEnd =
    subscription?.status === "active" &&
    !!subscription?.cancelled_at &&
    !!subscriptionEndsAt &&
    new Date(subscriptionEndsAt) > new Date();
  const billingStatusLabel = isCancelingAtPeriodEnd
    ? "Canceling at period end"
    : subscription?.status
      ? subscription.status.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase())
      : profile.subscription_status.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
  const billingDateLabel = subscriptionEndsAt
    ? isCancelingAtPeriodEnd
      ? `Ends on ${new Date(subscriptionEndsAt).toLocaleDateString()}`
      : hasActiveSubscriptionAccess(subscription?.status, subscriptionEndsAt)
        ? `Renews on ${new Date(subscriptionEndsAt).toLocaleDateString()}`
        : `Ended on ${new Date(subscriptionEndsAt).toLocaleDateString()}`
    : null;

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
                <div className="text-xs text-slate-500">Control center</div>
              </div>
            </Link>

            <nav className="hidden items-center gap-1 md:flex">
              <Link href="/dashboard" className="rounded-full px-3 py-1.5 text-sm font-medium text-slate-200 transition hover:bg-white/5 hover:text-white">Dashboard</Link>
              <Link href="/risk-check" className="rounded-full px-3 py-1.5 text-sm font-medium text-slate-300 transition hover:bg-white/5 hover:text-white">Risk Check</Link>
              <Link href="/bulk-check" className="flex items-center gap-1 rounded-full px-3 py-1.5 text-sm font-medium text-slate-300 transition hover:bg-white/5 hover:text-white">
                <Upload className="h-3.5 w-3.5" /> Bulk Scan
              </Link>
              <Link href="/pre-send" className="rounded-full px-3 py-1.5 text-sm font-medium text-slate-300 transition hover:bg-white/5 hover:text-white">Pre-send</Link>
              <Link href="/blacklist" className="rounded-full px-3 py-1.5 text-sm font-medium text-slate-300 transition hover:bg-white/5 hover:text-white">Blacklist</Link>
              <Link href="/pricing" className="rounded-full px-3 py-1.5 text-sm font-medium text-slate-300 transition hover:bg-white/5 hover:text-white">Pricing</Link>
            </nav>
          </div>

          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-slate-400 sm:inline">{profile.email}</span>
            <button onClick={() => signOut()} className="rounded-xl p-2 text-slate-400 transition hover:bg-white/5 hover:text-red-400" title="Sign Out">
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="border-t border-white/10 md:hidden">
          <div className="mx-auto max-w-6xl overflow-x-auto px-4 py-3">
            <div className="flex min-w-max items-center gap-2">
              {mobileNavItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="whitespace-nowrap rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-sm font-medium text-slate-200 transition hover:bg-white/10 hover:text-white"
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl space-y-6 px-4 py-6">
        {monthlyPercent <= 20 && (
          <div className="flex items-center gap-3 rounded-[24px] border border-amber-500/20 bg-amber-500/10 p-4">
            <AlertTriangle className="h-5 w-5 shrink-0 text-amber-300" />
            <div className="flex-1">
              <p className="text-sm font-medium text-amber-100">Only {monthlyRemaining.toLocaleString()} credits left - you are approaching your monthly limit.</p>
              <p className="mt-0.5 text-xs text-amber-200/80">Upgrade to increase credits, unlock deeper checks, and enable API access.</p>
            </div>
            <Link href="/pricing" className="rs-button-primary shrink-0 rounded-full px-4 py-2 text-sm font-medium">Upgrade Plan</Link>
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rs-panel rounded-[24px] p-5">
            <div className="mb-2 flex items-center gap-2 text-[var(--rs-primary)]">
              <Shield className="h-5 w-5" />
              <span className="text-sm font-semibold text-white">Credits Remaining</span>
            </div>
            <div className="text-3xl font-semibold text-white">
              {displayCreditsRemaining.toLocaleString()}
              <span className="text-sm font-normal text-slate-500"> / {monthlyLimit.toLocaleString()}</span>
            </div>
            <div className="mt-3 h-2 w-full rounded-full bg-white/10">
              <div className="h-2 rounded-full bg-[var(--rs-primary)] transition-all" style={{ width: `${creditsPercent}%` }} />
            </div>
            <div className="mt-1.5 text-xs text-slate-400">
              {usageStatus === "healthy" ? (
                <span className="font-medium text-emerald-300">Sufficient for current usage</span>
              ) : usageStatus === "warning" ? (
                <span className="font-medium text-amber-300">Only {monthlyRemaining.toLocaleString()} checks left - you are approaching your monthly limit.</span>
              ) : (
                <span className="font-medium text-red-300">Only {monthlyRemaining.toLocaleString()} checks left - upgrade to continue protecting customers.</span>
              )}
            </div>
          </div>

          <div className="rs-panel rounded-[24px] p-5">
            <div className="mb-2 flex items-center gap-2 text-emerald-300">
              <Activity className="h-5 w-5" />
              <span className="text-sm font-semibold text-white">This Month</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="text-2xl font-semibold text-white">{monthlyUsed.toLocaleString()}</div>
                <div className="mt-0.5 text-xs text-slate-500">customers verified</div>
              </div>
              <div>
                <div className="text-2xl font-semibold text-amber-300">{riskyCount.toLocaleString()}</div>
                <div className="mt-0.5 text-xs text-slate-500">risky flagged</div>
              </div>
              <div>
                <div className="text-2xl font-semibold text-red-300">{blockedCount.toLocaleString()}</div>
                <div className="mt-0.5 text-xs text-slate-500">blocked / prevented</div>
              </div>
              <div>
                <div className="text-2xl font-semibold text-white">{creditsPercent}%</div>
                <div className="mt-0.5 text-xs text-slate-500">quota available</div>
              </div>
            </div>
          </div>

          <div className="rs-panel rounded-[24px] p-5">
            <div className="mb-2 flex items-center gap-2 text-violet-300">
              <Activity className="h-5 w-5" />
              <span className="text-sm font-semibold text-white">Plan</span>
            </div>
            <div className="text-3xl font-semibold capitalize text-white">{profile.plan}</div>
            <div className="mt-1 text-xs text-slate-500">{profile.subscription_status}</div>
            {billingCycleLabel && (
              <div className="mt-3 space-y-1 text-xs text-slate-400">
                <div>Billing cycle: {billingCycleLabel}</div>
                <div>Status: {billingStatusLabel}</div>
                {billingDateLabel && <div>{billingDateLabel}</div>}
              </div>
            )}
            {profile.plan === "free" && (
              <Link href="/pricing" className="mt-3 inline-block text-sm font-medium text-[var(--rs-primary)] hover:text-white">
                Upgrade to unlock deep checks and API access
              </Link>
            )}
            {profile.plan !== "free" && (
              <div className="mt-3 space-y-2">
                <button
                  type="button"
                  onClick={openBillingPortal}
                  disabled={billingPortalLoading}
                  className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-sm font-medium text-slate-200 transition hover:bg-white/10 hover:text-white disabled:opacity-50"
                >
                  <CreditCard className="h-4 w-4" />
                  {billingPortalLoading ? "Opening..." : "Manage subscription"}
                </button>
                <div className="text-xs text-slate-500">
                  Open Creem Customer Portal to manage billing, payment method, and cancellation.
                </div>
              </div>
            )}
            {billingPortalError && <div className="mt-2 text-xs text-red-300">{billingPortalError}</div>}
          </div>

          <div className="rs-panel rounded-[24px] p-5">
            <div className="mb-2 flex items-center gap-2 text-cyan-300">
              <Key className="h-5 w-5" />
              <span className="text-sm font-semibold text-white">API Keys</span>
            </div>
            <div className="text-3xl font-semibold text-white">{activeApiKeys.length}</div>
            <div className="mt-1 text-xs text-slate-500">active keys</div>
            {activeApiKeys.length === 0 && (
              <button onClick={createKey} className="mt-2 text-sm font-medium text-[var(--rs-primary)] hover:text-white">Generate your first key</button>
            )}
          </div>
        </div>

        <div className="rs-panel rounded-[28px] p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="flex items-center gap-2 font-semibold text-white">
              <Key className="h-5 w-5 text-cyan-300" /> API Keys
            </h2>
            <button
              onClick={createKey}
              disabled={!apiEnabled}
              className="rs-button-primary rounded-full px-4 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50"
            >
              Generate Key
            </button>
          </div>

          {!apiEnabled && (
            <div className="mb-4 rounded-2xl border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
              API access starts on Growth. Upgrade to create and manage API keys.
            </div>
          )}

          {apiKeys.length === 0 && (
            <p className="text-sm text-slate-400">
              {apiEnabled ? "No API keys yet. Generate one to start using the API." : "Upgrade to Growth to generate API keys."}
            </p>
          )}

          {activeApiKeys.map((k) => (
            <div key={k.id} className="mt-3 flex items-center justify-between rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
              <div>
                <div className="font-mono text-sm text-slate-100">{k.key ? k.key.slice(0, 12) + "..." + k.key.slice(-6) : "N/A"}</div>
                <div className="mt-0.5 text-xs text-slate-500">
                  Created {new Date(k.created_at).toLocaleDateString()}
                  {k.last_used_at ? " - Last used " + new Date(k.last_used_at).toLocaleDateString() : ""}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    if (k.key) {
                      navigator.clipboard.writeText(k.key);
                      setCopied(k.id);
                      setTimeout(() => setCopied(""), 2000);
                    }
                  }}
                  className="rounded-xl p-1.5 text-slate-400 transition hover:bg-white/5 hover:text-white"
                >
                  <Copy className="h-4 w-4" />
                  {copied === k.id && <span className="ml-1 text-xs text-emerald-300">Copied!</span>}
                </button>
                <button
                  onClick={() => {
                    const confirmed = window.confirm("Delete this API key? This action cannot be undone.");
                    if (confirmed) void revokeKey(k.id);
                  }}
                  className="rounded-xl p-1.5 text-slate-400 transition hover:bg-white/5 hover:text-red-400"
                  title="Delete API key"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="rs-panel rounded-[28px] p-6">
          <div className="flex flex-wrap items-start gap-4">
            <div className="flex-1">
              <div className="mb-2 flex items-center gap-2">
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-300">
                  Sheets
                </span>
                <h2 className="text-lg font-semibold text-white">Google Sheets Add-on</h2>
              </div>
              <p className="mb-3 text-sm text-slate-300">
                Scan emails in bulk directly from Google Sheets. Download the script, paste it into Apps Script, then connect it with your RiskShield AI API key.
              </p>
              <ol className="mb-4 list-inside list-decimal space-y-1.5 text-sm text-slate-400">
                <li>Click <strong>Download Code.gs</strong> below.</li>
                <li>Open your Google Sheet, then click <strong>Extensions</strong> &gt; <strong>Apps Script</strong>.</li>
                <li>Delete the default sample code in Apps Script.</li>
                <li>Open the downloaded <strong>Code.gs</strong> file, copy all code, and paste it into Apps Script.</li>
                <li>Click <strong>Save</strong>, then reload your Google Sheet.</li>
                <li>Open <strong>Risk Scanner</strong> &gt; <strong>Settings</strong>, paste your API key, and save.</li>
                <li>Select the email cells, then choose <strong>Risk Scanner</strong> &gt; <strong>Scan Selected Emails</strong>.</li>
              </ol>
              <div className="flex flex-wrap items-center gap-3">
                <a href="/api/google-sheets-addon" className="rs-button-primary inline-flex items-center gap-1 rounded-full px-4 py-2 text-sm font-medium">
                  <Download className="h-4 w-4" /> Download Code.gs
                </a>
                <a href="/docs/google-sheets" className="rs-button-secondary inline-flex items-center gap-1 rounded-full px-4 py-2 text-sm font-medium">
                  View Setup Guide
                </a>
              </div>
            </div>

            <div className="shrink-0 rounded-2xl border border-white/10 bg-black/30 p-4 text-sm">
              <div className="mb-2 font-semibold text-white">Quick Start</div>
              <code className="mb-1 block rounded bg-white/5 px-2 py-1 text-xs text-slate-300">POST /api/v1/email/batch-check</code>
              <code className="block rounded bg-white/5 px-2 py-1 text-xs text-slate-300">up to 100 emails/batch</code>
            </div>
          </div>
        </div>

        <div className="rs-panel rounded-[28px] p-6">
          <h2 className="mb-1 flex items-center gap-2 font-semibold text-white">
            <Settings className="h-5 w-5 text-slate-300" /> Protection Settings
          </h2>
          <p className="mb-4 text-xs text-slate-500">Toggle which risks should force BLOCK or REVIEW. Applies to web checks and API.</p>

          <div className="mb-4 space-y-3">
            {(settings || defaultSettings) &&
              [
                { key: "block_disposable", label: "Block disposable emails", desc: "Force BLOCK on temporary/disposable email addresses" },
                { key: "block_high_risk", label: "Block high risk score", desc: "Force BLOCK when risk score is 60 or above" },
                { key: "review_catch_all", label: "Review catch-all domains", desc: "Force REVIEW on domains that accept all mailboxes" },
                { key: "review_new_domain", label: "Review new domains", desc: "Force REVIEW on domains less than 90 days old" },
              ].map(({ key, label, desc }) => (
                <div key={key} className="flex items-center justify-between border-b border-white/10 py-2 last:border-0">
                  <div>
                    <div className="text-sm font-medium text-slate-100">{label}</div>
                    <div className="text-xs text-slate-500">{desc}</div>
                  </div>
                  <button
                    onClick={() => {
                      const s = settings || defaultSettings;
                      const typedKey = key as keyof typeof defaultSettings;
                      setSettings({ ...s, [typedKey]: !s[typedKey] });
                    }}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${(settings || defaultSettings)[key as keyof typeof defaultSettings] ? "bg-[var(--rs-primary)]" : "bg-white/15"}`}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${(settings || defaultSettings)[key as keyof typeof defaultSettings] ? "translate-x-6" : "translate-x-1"}`} />
                  </button>
                </div>
              ))}
          </div>

          <button onClick={saveSettings} disabled={settingsLoading} className="rs-button-primary rounded-full px-4 py-2 text-sm font-medium disabled:opacity-50">
            {settingsLoading ? "Saving..." : "Save Settings"}
          </button>
          {settingsSaved && <span className="ml-3 text-xs text-emerald-300">Saved!</span>}
        </div>

        <div className="rs-panel rounded-[28px] p-6">
          <h2 className="mb-4 flex items-center gap-2 font-semibold text-white">
            <Activity className="h-5 w-5 text-emerald-300" /> Recent Checks
          </h2>
          {checks.length === 0 && <p className="text-sm text-slate-400">No checks yet. Run email or IP risk checks from the Risk Check page or via API.</p>}
          {checks.map((c) => (
            <div key={c.id} className="flex items-center justify-between border-b border-white/10 py-3 text-sm last:border-0">
              <div className="flex items-center gap-3">
                <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 font-mono text-xs uppercase text-slate-300">{c.check_type}</span>
                <span className="max-w-[200px] truncate text-slate-100">{c.input_value}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className={c.risk_score >= 60 ? "text-red-300" : c.risk_score >= 30 ? "text-amber-300" : "text-emerald-300"}>Risk: {c.risk_score}</span>
                <span className="text-xs text-slate-500">{new Date(c.created_at).toLocaleString()}</span>
              </div>
            </div>
          ))}
        </div>

        <div className="rs-panel rounded-[28px] p-6">
          <h2 className="mb-1 flex items-center gap-2 font-semibold text-white">
            <Mail className="h-5 w-5 text-slate-300" /> Send Feedback
          </h2>
          <p className="mb-4 text-xs text-slate-500">
            Send product feedback directly inside RiskShield AI. Daily limit: {feedbackSentToday}/{feedbackDailyLimit}. Support:{" "}
            <a href="mailto:support@574269.xyz" className="text-[var(--rs-primary)] hover:text-white">support@574269.xyz</a>.
          </p>
          <form onSubmit={handleFeedbackSubmit} className="max-w-2xl space-y-4">
            {feedbackError && (
              <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-200">
                {feedbackError}
              </div>
            )}
            {feedbackSaved && (
              <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">
                Feedback sent successfully. Thanks for helping us improve RiskShield AI.
              </div>
            )}
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-200">Subject</label>
              <input
                type="text"
                value={feedbackSubject}
                onChange={(e) => setFeedbackSubject(e.target.value)}
                minLength={4}
                maxLength={120}
                required
                placeholder="Bug report, feature request, UX issue..."
                className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-[var(--rs-primary)]"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-200">Message</label>
              <textarea
                value={feedbackMessage}
                onChange={(e) => setFeedbackMessage(e.target.value)}
                minLength={10}
                maxLength={2000}
                required
                rows={5}
                placeholder="Tell us what happened, what you expected, and how we can improve."
                className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-[var(--rs-primary)]"
              />
              <div className="mt-1 flex items-center justify-between text-xs text-slate-500">
                <span>{feedbackRemaining} submissions left today</span>
                <span>{feedbackMessage.length}/2000</span>
              </div>
            </div>
            <button
              type="submit"
              disabled={feedbackLoading || feedbackRemaining <= 0}
              className="rs-button-primary rounded-full px-4 py-2 text-sm font-medium disabled:opacity-50"
            >
              {feedbackLoading ? "Sending..." : feedbackRemaining <= 0 ? "Daily limit reached" : "Send Feedback"}
            </button>
          </form>
        </div>

        {isAdmin && (
          <div className="rs-panel rounded-[28px] p-6">
            <h2 className="mb-2 flex items-center gap-2 font-semibold text-white">
              <Inbox className="h-5 w-5 text-slate-300" />
              Admin Tools
            </h2>
            <p className="mb-3 text-sm text-slate-400">Review user feedback submitted through the dashboard form.</p>
            <Link href="/admin/feedback" className="rs-button-primary inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium">
              Open Feedback Inbox
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
