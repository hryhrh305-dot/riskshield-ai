"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase";
import { Shield, Mail, Globe, AlertTriangle, CheckCircle, XCircle, ArrowRight, Zap, History, ChevronDown } from "lucide-react";
import Link from "next/link";
import { getResultVisibility } from "@/lib/plans";

interface RiskResult {
  impact?: string[];
  solution?: { category: string; problem: string; fix: string }[];
  input: string;
  type: string;
  risk_score: number;
  decision: string;
  reasons: string[];
  details: {
    email?: Record<string, unknown> | null;
    ip?: Record<string, unknown> | null;
  };
  ai_explanation?: string | null;
  credits: {
    remaining: number;
    success: boolean;
  };
  domain_age?: { checked: boolean; ageDays: number | null; ageYears: number | null; isNew: boolean; registrar: string | null } | null;
  dns_health?: { score: number; mx: boolean; spf: boolean; dmarc: boolean; details: string[] } | null;
  company_health?: {
    healthScore: number; grade: string; stars: string; label: string; recommendation: string;
    positiveSignals: string[]; riskSignals: string[];
    breakdown: Record<string, { score: number; weight: number; details: string }>;
  } | null;
}

interface HistoryItem {
  id: number;
  check_type: string;
  input_value: string;
  risk_score: number;
  created_at: string;
}

export default function RiskCheckPage() {
  const [email, setEmail] = useState("");
  const [ip, setIP] = useState("");
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [result, setResult] = useState<RiskResult | null>(null);
  const [error, setError] = useState("");
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [showDetails, setShowDetails] = useState(false);
  const [user, setUser] = useState<{ email?: string } | null>(null);

  const supabase = createClient();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setUser(data.session?.user ?? null));
    fetchHistory();
  }, []);

  async function fetchHistory() {
    const res = await fetch("/api/web-risk", { method: "GET", credentials: "include" }).catch(() => null);
    if (!res || !res.ok) return;
    const data = await res.json();
    if (data.history) setHistory(data.history);
  }

  const EMAIL_REGEX = /^(?!.*\.\.)(?!\.)[^\s@]+(?<!\.)@(?!\.)[^\s@]+\.[^\s@]{2,}$/i;

  function isValidEmail(val: string): boolean {
    const s = val.trim().toLowerCase();
    if (!s) return false;
    if (s.startsWith("#")) return false;
    if (s.includes(" ")) return false;
    return EMAIL_REGEX.test(s);
  }

  async function handleCheck(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() && !ip.trim()) {
      setError("Please enter an email or IP address.");
      return;
    }
    if (email.trim() && !isValidEmail(email.trim())) {
      setError("Invalid email format. Please enter a valid email like user@example.com.");
      return;
    }
    if (!user) {
      setError("Please log in to use the risk checker.");
      return;
    }

    setLoading(true);
    setError("");
    setResult(null);
    setStatusMessage("Running risk checks...");

    try {
      const res = await fetch("/api/web-risk", { credentials: "include", 
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() || undefined, ip: ip.trim() || undefined }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.upgradeNeeded) {
          setError(data.message + " View plans to upgrade.");
        } else {
          setError(data.message || data.error || "Check failed.");
        }
        return;
      }

      setResult(data);
      setStatusMessage("Scan complete.");
      fetchHistory();
    } catch {
      setError("Network error. Please try again.");
      setStatusMessage("Scan failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  const decisionColor = (d: string) =>
    d === "BLOCK" ? "rs-badge-block" : d === "REVIEW" ? "rs-badge-review" : "rs-badge-allow";

  const decisionIcon = (d: string) =>
    d === "BLOCK" ? <XCircle className="w-5 h-5 text-red-300" /> : d === "REVIEW" ? <AlertTriangle className="w-5 h-5 text-amber-300" /> : <CheckCircle className="w-5 h-5 text-emerald-300" />;

  const scoreColor = (s: number) =>
    s >= 60 ? "text-red-300" : s >= 30 ? "text-amber-300" : "text-emerald-300";

  const emailDetails = result?.details?.email as Record<string, any> | null | undefined;
  const ipDetails = result?.details?.ip as Record<string, any> | null | undefined;
  const visibility = result ? getResultVisibility((result as any).plan || (result as any).subscription_plan || "free") : null;
  const basicEmailChecks = emailDetails ? [
    {
      label: "Email format",
      value: "Valid",
      tone: "text-emerald-300",
      helper: "The submitted address passed format validation.",
    },
    {
      label: "Disposable email",
      value: emailDetails.isDisposable ? "Detected" : "Not detected",
      tone: emailDetails.isDisposable ? "text-red-300" : "text-emerald-300",
      helper: emailDetails.isDisposable
        ? "This address comes from a temporary email provider."
        : "No temporary email provider signal was found.",
    },
    {
      label: "Role-based address",
      value: emailDetails.isRoleBased ? "Detected" : "Not detected",
      tone: emailDetails.isRoleBased ? "text-amber-300" : "text-emerald-300",
      helper: emailDetails.isRoleBased
        ? "This looks like a shared inbox such as info@, sales@, or support@."
        : "No shared-inbox pattern was detected.",
    },
    {
      label: "Mail server (MX)",
      value: !emailDetails.mxChecked ? "Not checked" : emailDetails.hasMX ? "Present" : "Missing",
      tone: !emailDetails.mxChecked ? "text-slate-500" : emailDetails.hasMX ? "text-emerald-300" : "text-red-300",
      helper: !emailDetails.mxChecked
        ? "Mail-server verification was not available for this check."
        : emailDetails.hasMX
          ? "The domain has a mail server configured."
          : "No mail server was found for this domain.",
    },
  ] : [];
  const hasLeadQualityModule = !!(result && (result.domain_age || result.company_health || ipDetails));
  const hasAdvancedEmailDeliverability = !!(
    emailDetails && (
      emailDetails.inboxProbability !== undefined ||
      emailDetails.estimatedBounceRate !== undefined ||
      emailDetails.senderReputationRisk !== undefined ||
      emailDetails.domain !== undefined ||
      emailDetails.hasSPF !== undefined ||
      emailDetails.hasDMARC !== undefined ||
      emailDetails.hasDKIM !== undefined
    )
  );

  return (
    <div className="rs-shell">
      <div className="border-b border-white/10 bg-black/20 backdrop-blur-xl">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4 sm:px-6">
          <Link href="/dashboard" className="rs-link-arrow inline-flex items-center gap-1 text-sm text-slate-400 hover:text-white">
            <ArrowRight className="h-4 w-4 rotate-180" /> Dashboard
          </Link>
          <span className="truncate text-sm text-slate-500">
            {user ? user.email : "Log in required"}
          </span>
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <div className="mb-8 text-center">
          <div className="rs-fade-up mb-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-sm font-medium text-slate-200">
            <Shield className="h-4 w-4" /> RiskShield AI Web Tool
          </div>
          <h1 className="rs-title-settle text-3xl font-semibold text-white sm:text-4xl">Contact Check</h1>
          <p className="rs-fade-up rs-fade-up-delay-1 mx-auto mt-3 max-w-2xl text-slate-400">
            Check any email or IP address for quick sendability signals, disposable status, proxy detection, and more using the same engine as the API.
          </p>
        </div>

        <form onSubmit={handleCheck} className="rs-card rs-card-hover mb-6 rounded-[28px] p-6">
          <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 flex items-center gap-2 text-sm font-medium text-slate-300">
                <Mail className="h-4 w-4 text-slate-500" /> Email Address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setIP(""); }}
                placeholder="user@example.com"
                className="rs-input px-4 py-3 text-sm disabled:opacity-50"
                disabled={!!ip.trim()}
              />
            </div>
            <div>
              <label className="mb-1.5 flex items-center gap-2 text-sm font-medium text-slate-300">
                <Globe className="h-4 w-4 text-slate-500" /> IP Address
              </label>
              <input
                type="text"
                value={ip}
                onChange={(e) => { setIP(e.target.value); setEmail(""); }}
                placeholder="8.8.8.8"
                className="rs-input px-4 py-3 text-sm disabled:opacity-50"
                disabled={!!email.trim()}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="rs-button-primary rs-link-arrow flex min-h-11 w-full items-center justify-center gap-2 rounded-full px-6 py-3 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "Scanning..." : "Check Risk"}
          </button>
          {statusMessage && (
            <p className="mt-2 text-center text-xs text-slate-500">{statusMessage}</p>
          )}

          {error && (
            <div className="mt-4 flex items-center gap-2 rounded-2xl border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-200">
              <AlertTriangle className="h-4 w-4 flex-shrink-0" />
              {error}
              {error.includes("upgrade") && (
                <Link href="/pricing" className="ml-1 font-medium underline">Upgrade</Link>
              )}
            </div>
          )}
        </form>

        {result && (
          <div className="rs-card rs-fade-up mb-6 rounded-[28px] p-6">
            <div className="mb-4 flex items-center justify-between gap-4">
              <h2 className="flex items-center gap-2 text-lg font-semibold text-white">
                <Shield className="h-5 w-5 text-white" /> Result
              </h2>
              <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold ${decisionColor(result.decision)}`}>
                {decisionIcon(result.decision)}
                {result.decision}
              </span>
            </div>

            <div className="mb-4 rounded-[24px] border border-white/10 bg-black/30 p-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <span className="text-xs uppercase tracking-[0.22em] text-slate-500">{result.type} check</span>
                  <div className="mt-1 break-all font-mono text-slate-100">{result.input}</div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-slate-500">Risk Score</div>
                  <div className={`text-3xl font-bold ${scoreColor(result.risk_score)}`}>{result.risk_score}</div>
                </div>
              </div>
              <div className="mt-3 h-2 rounded-full bg-white/10">
                <div
                  className={`rs-progress-load h-2 rounded-full transition-all duration-700 ${result.risk_score >= 60 ? "bg-red-400" : result.risk_score >= 30 ? "bg-amber-400" : "bg-emerald-400"}`}
                  style={{ width: result.risk_score + "%" }}
                />
              </div>
            </div>

            {hasLeadQualityModule && (
              <div className="mb-4 rounded-[24px] border border-white/10 bg-white/[0.035] p-4">
                <div className="mb-3 text-xs font-medium uppercase tracking-wider text-slate-500">Lead Quality</div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <div className="text-xs text-slate-500">Email Trust</div>
                    <div className="text-sm font-semibold text-slate-100">
                      {emailDetails ? (
                        emailDetails.isDisposable ? "Disposable" :
                        emailDetails.isRoleBased ? "Role-based" :
                        !emailDetails.hasMX && emailDetails.mxChecked ? "No Mail Server" :
                        emailDetails.hasMX ? "Valid Mailbox" : "Unknown"
                      ) : "N/A"}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500">Domain Age</div>
                    <div className="text-sm font-semibold text-slate-100">
                      {result.domain_age?.ageDays != null ? (
                        result.domain_age.ageDays < 90 ? "< 3 months (New)" :
                        result.domain_age.ageDays < 365 ? "< 1 year" :
                        result.domain_age.ageDays < 1825 ? `${result.domain_age.ageYears} years` :
                        `${result.domain_age.ageYears} years (Established)`
                      ) : "Unknown"}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500">Company</div>
                    <div className="text-sm font-semibold text-slate-100">
                      {result.company_health ? `${result.company_health.grade} — ${result.company_health.label}` : "Not assessed"}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500">IP Risk</div>
                    <div className="text-sm font-semibold text-slate-100">
                      {ipDetails ? (
                        ipDetails.isProxy ? "Proxy/VPN" :
                        ipDetails.isHosting ? "Datacenter" :
                        "Low Risk"
                      ) : "N/A"}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {basicEmailChecks.length > 0 && result.type === "email" && (
              <div className="mb-4 rounded-[24px] border border-white/10 bg-white/[0.035] p-4">
                <h3 className="mb-3 text-sm font-medium text-slate-200">Basic Checks</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {basicEmailChecks.map((item) => (
                    <div key={item.label}>
                      <div className="mb-0.5 text-xs text-slate-500">{item.label}</div>
                      <div className={`font-semibold text-sm ${item.tone}`}>{item.value}</div>
                      <div className="mt-0.5 text-xs text-slate-500">{item.helper}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {result.company_health && (
              <div className="mb-4 rounded-[24px] border border-white/10 bg-white/[0.035] p-5">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-white">Customer Health Score</h3>
                  <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-xs font-medium text-slate-200">{result.company_health.grade}</span>
                </div>
                <div className="mb-3 flex items-center gap-4">
                  <div className="text-4xl font-bold text-white">{result.company_health.healthScore}</div>
                  <div className="text-2xl text-amber-300">{result.company_health.stars}</div>
                </div>
                <div className="mb-2 text-sm font-semibold text-slate-100">{result.company_health.label}</div>
                <p className="mb-3 text-sm text-slate-300">{result.company_health.recommendation}</p>

                {result.company_health.positiveSignals.length > 0 && (
                  <div className="mb-2">
                    <div className="mb-1 text-xs font-medium text-emerald-300">Positive Signals:</div>
                    <ul className="space-y-0.5">
                      {result.company_health.positiveSignals.map((s, i) => (
                        <li key={i} className="flex items-start gap-1.5 text-xs text-emerald-200">
                          <CheckCircle className="mt-0.5 h-3 w-3 flex-shrink-0" /> {s}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {result.company_health.riskSignals.length > 0 && (
                  <div>
                    <div className="mb-1 text-xs font-medium text-red-300">Risk Signals:</div>
                    <ul className="space-y-0.5">
                      {result.company_health.riskSignals.map((s, i) => (
                        <li key={i} className="flex items-start gap-1.5 text-xs text-red-200">
                          <AlertTriangle className="mt-0.5 h-3 w-3 flex-shrink-0" /> {s}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {hasAdvancedEmailDeliverability && (
              <div className="mb-4 rounded-[24px] border border-white/10 bg-white/[0.035] p-4">
                <h3 className="mb-3 text-sm font-medium text-slate-200">Email Deliverability</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <div className="mb-0.5 text-xs text-slate-500">Inbox Probability</div>
                    <div className={`font-semibold text-sm ${
                      emailDetails?.inboxProbability === "high" ? "text-emerald-300" :
                      emailDetails?.inboxProbability === "medium" ? "text-amber-300" :
                      emailDetails?.inboxProbability === "low" ? "text-orange-300" : "text-red-300"
                    }`}>
                      {emailDetails?.inboxProbability === "high" ? "High" :
                       emailDetails?.inboxProbability === "medium" ? "Medium" :
                       emailDetails?.inboxProbability === "low" ? "Low" : "None / Will Bounce"}
                    </div>
                  </div>
                  <div>
                    <div className="mb-0.5 text-xs text-slate-500">Est. Bounce Rate</div>
                    <div className="text-sm font-semibold text-slate-100">
                      {emailDetails?.estimatedBounceRate || "--"}
                    </div>
                  </div>
                  <div>
                    <div className="mb-0.5 text-xs text-slate-500">Sender Reputation Risk</div>
                    <div className={`font-semibold text-xs ${
                      (emailDetails?.senderReputationRisk || "").includes("CRITICAL") ? "text-red-300" :
                      (emailDetails?.senderReputationRisk || "").includes("HIGH") ? "text-red-400" :
                      (emailDetails?.senderReputationRisk || "").includes("MEDIUM") ? "text-amber-300" : "text-emerald-300"
                    }`}>
                      {emailDetails?.senderReputationRisk || "LOW"}
                    </div>
                  </div>
                  <div>
                    <div className="mb-0.5 text-xs text-slate-500">MX Records</div>
                    <div className={`font-semibold text-sm ${
                      !emailDetails?.mxChecked ? "text-slate-500" :
                      emailDetails?.domainExists === false ? "text-red-300" :
                      emailDetails?.hasMX ? "text-emerald-300" : "text-red-300"
                    }`}>
                      {!emailDetails?.mxChecked ? "Not checked" :
                       emailDetails?.domainExists === false ? "Domain does not exist" :
                       emailDetails?.hasMX ? "Present" : "Missing -- guaranteed bounce"}
                    </div>
                    <div className="mt-0.5 text-xs text-slate-500">
                      {!emailDetails?.mxChecked ? "DNS query failed." :
                       emailDetails?.domainExists === false ? "This domain does not exist. 100% guaranteed bounce." :
                       emailDetails?.hasMX ? "The domain can receive email." :
                       "No mail server configured. Sending will always bounce."}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {result.details?.ip && result.type === "ip" && (
              <div className="mb-4 rounded-[24px] border border-white/10 bg-white/[0.035] p-4">
                <h3 className="mb-3 text-sm font-medium text-slate-200">IP Geolocation</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <div className="mb-0.5 text-xs text-slate-500">Country</div>
                    <div className="text-sm font-semibold text-slate-100">
                      {((result.details.ip as any)?.country as string) || "Unknown"}
                      {((result.details.ip as any)?.countryCode as string) ? " (" + (result.details.ip as any)?.countryCode + ")" : ""}
                    </div>
                  </div>
                  <div>
                    <div className="mb-0.5 text-xs text-slate-500">Region / City</div>
                    <div className="text-sm font-semibold text-slate-100">
                      {[(result.details.ip as any)?.region, (result.details.ip as any)?.city].filter(Boolean).join(", ") || "Unknown"}
                    </div>
                  </div>
                  <div>
                    <div className="mb-0.5 text-xs text-slate-500">ISP</div>
                    <div className="text-sm font-semibold text-slate-100">
                      {((result.details.ip as any)?.isp as string) || ((result.details.ip as any)?.org as string) || "Unknown"}
                    </div>
                  </div>
                  <div>
                    <div className="mb-0.5 text-xs text-slate-500">ASN</div>
                    <div className="text-sm font-semibold text-slate-100">
                      {((result.details.ip as any)?.asn as string) || "Unknown"}
                    </div>
                  </div>
                  <div>
                    <div className="mb-0.5 text-xs text-slate-500">Proxy / VPN</div>
                    <div className={`font-semibold text-sm ${(result.details.ip as any)?.isProxy ? "text-red-300" : "text-emerald-300"}`}>
                      {(result.details.ip as any)?.isProxy ? "Detected" : "Not detected"}
                    </div>
                  </div>
                  <div>
                    <div className="mb-0.5 text-xs text-slate-500">Hosting / Datacenter</div>
                    <div className={`font-semibold text-sm ${(result.details.ip as any)?.isHosting ? "text-red-300" : "text-emerald-300"}`}>
                      {(result.details.ip as any)?.isHosting ? "Yes - likely automated" : "No"}
                    </div>
                  </div>
                  {(result.details.ip as any)?.highRiskCountry && (
                    <div className="col-span-2">
                      <div className="text-xs font-medium text-red-300">
                        High-risk region. Low conversion rates in international trade.
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {visibility?.includeReasons && (
              <div className="mb-4">
                <h3 className="mb-2 text-sm font-medium text-slate-200">Reasons</h3>
                {result.reasons.length === 0 ? (
                  <p className="text-sm text-slate-500">No risk signals detected.</p>
                ) : (
                  <ul className="space-y-1">
                    {result.reasons.map((r, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-slate-300">
                        <span className="mt-0.5 text-red-300">-</span> {r}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {result.solution && result.solution.length > 0 && (
              <div className="mb-4 rounded-2xl border border-emerald-500/15 bg-emerald-500/8 p-4">
                <div className="mb-3 flex items-center gap-2 text-xs font-medium text-emerald-300">
                  <CheckCircle className="h-3 w-3" /> Recommended Actions
                </div>
                <div className="space-y-3">
                  {result.solution.map((sol, i) => (
                    <div key={i} className="rounded-2xl border border-white/10 bg-black/20 p-3">
                      <div className="mb-1 text-sm font-semibold text-emerald-200">{sol.category}</div>
                      <div className="mb-1.5 text-sm font-medium text-red-200">Problem: {sol.problem}</div>
                      <div className="whitespace-pre-line text-sm leading-relaxed text-slate-300">{sol.fix}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {result.impact && result.impact.length > 0 && (
              <div className="mb-4 rounded-2xl border border-amber-500/15 bg-amber-500/8 p-4">
                <div className="mb-2 flex items-center gap-2 text-xs font-medium text-amber-300">
                  <AlertTriangle className="h-3 w-3" /> Business Impact
                </div>
                <ul className="space-y-1">
                  {result.impact.map((imp, i) => (
                    <li key={i} className="text-sm text-amber-100">{imp}</li>
                  ))}
                </ul>
              </div>
            )}

            {result.ai_explanation && (
              <div className="mb-4 rounded-2xl border border-white/10 bg-white/[0.035] p-3">
                <div className="mb-1 flex items-center gap-2 text-xs font-medium text-slate-300">
                  <Zap className="h-3 w-3" /> AI Analysis
                </div>
                <p className="text-sm text-slate-200">{result.ai_explanation}</p>
              </div>
            )}

            <button
              onClick={() => setShowDetails(!showDetails)}
              className="flex items-center gap-1 text-sm text-slate-500 hover:text-white"
            >
              <ChevronDown className="h-4 w-4 transition-transform duration-200" style={{ transform: showDetails ? 'rotate(180deg)' : 'rotate(0deg)' }} />
              Technical Details
            </button>
            {showDetails && (
              <div className="rs-code mt-3 max-h-48 rounded-2xl p-3 text-xs text-slate-300">
                <pre>{JSON.stringify(result.details, null, 2)}</pre>
              </div>
            )}

            <div className="mt-4 flex items-center justify-between border-t border-white/10 pt-4">
              <span className="text-xs text-slate-500">
                {result.credits?.remaining ?? "?"} credits remaining
              </span>
              <Link
                href="/pricing"
                className="rs-link-arrow flex items-center gap-1 text-sm font-medium text-white"
              >
                Get API access <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        )}

        <div className="rs-card rounded-[28px] p-6">
          <h2 className="mb-4 flex items-center gap-2 font-semibold text-white">
            <History className="h-5 w-5 text-slate-400" /> Recent Contact Checks
          </h2>
          {history.length === 0 ? (
            <p className="text-sm text-slate-500">Run your first contact check above.</p>
          ) : (
            <div className="space-y-2">
              {history.slice(0, 10).map((h) => (
                <div key={h.id} className="flex items-center justify-between border-b border-white/8 py-2 text-sm last:border-0">
                  <div className="flex items-center gap-3">
                    <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 font-mono text-xs uppercase text-slate-300">{h.check_type}</span>
                    <span className="max-w-[220px] truncate text-slate-300">{h.input_value}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={h.risk_score >= 60 ? "text-red-300" : h.risk_score >= 30 ? "text-amber-300" : "text-emerald-300"}>
                      {h.risk_score}
                    </span>
                    <span className="text-xs text-slate-500">{new Date(h.created_at).toLocaleString()}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
