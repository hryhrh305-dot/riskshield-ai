"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase";
import { Shield, Search, Mail, Globe, AlertTriangle, CheckCircle, XCircle, ArrowRight, Zap, History, ChevronDown, ChevronUp, Upload, LogOut } from "lucide-react";
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
    d === "BLOCK" ? "text-red-600 bg-red-50" : d === "REVIEW" ? "text-yellow-600 bg-yellow-50" : "text-green-600 bg-green-50";

  const decisionIcon = (d: string) =>
    d === "BLOCK" ? <XCircle className="w-5 h-5 text-red-600" /> : d === "REVIEW" ? <AlertTriangle className="w-5 h-5 text-yellow-600" /> : <CheckCircle className="w-5 h-5 text-green-600" />;

  const scoreColor = (s: number) =>
    s >= 60 ? "text-red-600" : s >= 30 ? "text-yellow-600" : "text-green-600";

  const emailDetails = result?.details?.email as Record<string, any> | null | undefined;
  const ipDetails = result?.details?.ip as Record<string, any> | null | undefined;
  const visibility = result ? getResultVisibility((result as any).plan || (result as any).subscription_plan || "free") : null;
  const basicEmailChecks = emailDetails ? [
    {
      label: "Email format",
      value: "Valid",
      tone: "text-green-600",
      helper: "The submitted address passed format validation.",
    },
    {
      label: "Disposable email",
      value: emailDetails.isDisposable ? "Detected" : "Not detected",
      tone: emailDetails.isDisposable ? "text-red-600" : "text-green-600",
      helper: emailDetails.isDisposable
        ? "This address comes from a temporary email provider."
        : "No temporary email provider signal was found.",
    },
    {
      label: "Role-based address",
      value: emailDetails.isRoleBased ? "Detected" : "Not detected",
      tone: emailDetails.isRoleBased ? "text-yellow-600" : "text-green-600",
      helper: emailDetails.isRoleBased
        ? "This looks like a shared inbox such as info@, sales@, or support@."
        : "No shared-inbox pattern was detected.",
    },
    {
      label: "Mail server (MX)",
      value: !emailDetails.mxChecked ? "Not checked" : emailDetails.hasMX ? "Present" : "Missing",
      tone: !emailDetails.mxChecked ? "text-gray-500" : emailDetails.hasMX ? "text-green-600" : "text-red-600",
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
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/dashboard" className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1">
            <ArrowRight className="w-4 h-4 rotate-180" /> Dashboard
          </Link>
          <span className="text-sm text-gray-400">
            {user ? user.email : "Log in required"}
          </span>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-8">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 bg-blue-50 text-blue-700 px-4 py-1.5 rounded-full text-sm font-medium mb-4">
            <Shield className="w-4 h-4" /> RiskShield Web Tool
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Risk Check</h1>
          <p className="text-gray-500 max-w-lg mx-auto">
            Check any email or IP address for fraud risk, disposable status, proxy detection, and more -- using the same engine as our API.
          </p>
        </div>

        <form onSubmit={handleCheck} className="bg-white rounded-xl border p-6 mb-6 shadow-sm">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-1.5">
                <Mail className="w-4 h-4 text-gray-400" /> Email Address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setIP(""); }}
                placeholder="user@example.com"
                className="w-full px-4 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
                disabled={!!ip.trim()}
              />
            </div>
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-1.5">
                <Globe className="w-4 h-4 text-gray-400" /> IP Address
              </label>
              <input
                type="text"
                value={ip}
                onChange={(e) => { setIP(e.target.value); setEmail(""); }}
                placeholder="8.8.8.8"
                className="w-full px-4 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
                disabled={!!email.trim()}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading ? "Scanning..." : "Check Risk"}
          </button>
          {statusMessage && (
            <p className="mt-2 text-xs text-gray-500 text-center">{statusMessage}</p>
          )}

          {error && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              {error}
              {error.includes("upgrade") && (
                <Link href="/pricing" className="ml-1 underline font-medium">Upgrade</Link>
              )}
            </div>
          )}
        </form>

        {result && (
          <div className="bg-white rounded-xl border p-6 shadow-sm mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-lg flex items-center gap-2">
                <Shield className="w-5 h-5 text-blue-600" /> Result
              </h2>
              <span className={`px-3 py-1 rounded-full text-sm font-semibold ${decisionColor(result.decision)} flex items-center gap-1.5`}>
                {decisionIcon(result.decision)}
                {result.decision}
              </span>
            </div>

            <div className="bg-gray-50 rounded-xl p-4 mb-4">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs text-gray-400 uppercase tracking-wider">{result.type} check</span>
                  <div className="font-mono text-gray-800 mt-1">{result.input}</div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-gray-400">Risk Score</div>
                  <div className={`text-3xl font-bold ${scoreColor(result.risk_score)}`}>{result.risk_score}</div>
                </div>
              </div>
              <div className="mt-3 bg-gray-200 rounded-full h-2">
                <div
                  className={`h-2 rounded-full transition-all duration-700 ${result.risk_score >= 60 ? "bg-red-500" : result.risk_score >= 30 ? "bg-yellow-500" : "bg-green-500"}`}
                  style={{ width: result.risk_score + "%" }}
                />
              </div>
            </div>

            {hasLeadQualityModule && (
              <div className="bg-gradient-to-r from-slate-50 to-gray-50 rounded-xl p-4 mb-4 border border-slate-200">
                <div className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3">Lead Quality</div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <div className="text-xs text-gray-400">Email Trust</div>
                    <div className="font-semibold text-sm text-gray-800">
                      {emailDetails ? (
                        emailDetails.isDisposable ? "Disposable" :
                        emailDetails.isRoleBased ? "Role-based" :
                        !emailDetails.hasMX && emailDetails.mxChecked ? "No Mail Server" :
                        emailDetails.hasMX ? "Valid Mailbox" : "Unknown"
                      ) : "N/A"}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-400">Domain Age</div>
                    <div className="font-semibold text-sm text-gray-800">
                      {result.domain_age?.ageDays != null ? (
                        result.domain_age.ageDays < 90 ? "< 3 months (New)" :
                        result.domain_age.ageDays < 365 ? "< 1 year" :
                        result.domain_age.ageDays < 1825 ? `${result.domain_age.ageYears} years` :
                        `${result.domain_age.ageYears} years (Established)`
                      ) : "Unknown"}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-400">Company</div>
                    <div className="font-semibold text-sm text-gray-800">
                      {result.company_health ? `${result.company_health.grade} — ${result.company_health.label}` : "Not assessed"}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-400">IP Risk</div>
                    <div className="font-semibold text-sm text-gray-800">
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
              <div className="mb-4 p-4 bg-gray-50 rounded-xl border border-gray-100">
                <h3 className="text-sm font-medium text-gray-700 mb-3">Basic Checks</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {basicEmailChecks.map((item) => (
                    <div key={item.label}>
                      <div className="text-xs text-gray-400 mb-0.5">{item.label}</div>
                      <div className={`font-semibold text-sm ${item.tone}`}>{item.value}</div>
                      <div className="text-xs text-gray-400 mt-0.5">{item.helper}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {result.company_health && (
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-5 mb-4 border border-blue-200">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-blue-800">Customer Health Score</h3>
                  <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">{result.company_health.grade}</span>
                </div>
                <div className="flex items-center gap-4 mb-3">
                  <div className="text-4xl font-bold text-blue-700">{result.company_health.healthScore}</div>
                  <div className="text-2xl text-yellow-500">{result.company_health.stars}</div>
                </div>
                <div className="text-sm font-semibold text-blue-800 mb-2">{result.company_health.label}</div>
                <p className="text-sm text-blue-700 mb-3">{result.company_health.recommendation}</p>

                {result.company_health.positiveSignals.length > 0 && (
                  <div className="mb-2">
                    <div className="text-xs font-medium text-green-700 mb-1">Positive Signals:</div>
                    <ul className="space-y-0.5">
                      {result.company_health.positiveSignals.map((s, i) => (
                        <li key={i} className="text-xs text-green-600 flex items-start gap-1.5">
                          <CheckCircle className="w-3 h-3 mt-0.5 flex-shrink-0" /> {s}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {result.company_health.riskSignals.length > 0 && (
                  <div>
                    <div className="text-xs font-medium text-red-700 mb-1">Risk Signals:</div>
                    <ul className="space-y-0.5">
                      {result.company_health.riskSignals.map((s, i) => (
                        <li key={i} className="text-xs text-red-600 flex items-start gap-1.5">
                          <AlertTriangle className="w-3 h-3 mt-0.5 flex-shrink-0" /> {s}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {hasAdvancedEmailDeliverability && (
              <div className="mb-4 p-4 bg-gray-50 rounded-xl border border-gray-100">
                <h3 className="text-sm font-medium text-gray-700 mb-3">Email Deliverability</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <div className="text-xs text-gray-400 mb-0.5">Inbox Probability</div>
                    <div className={`font-semibold text-sm ${
                      emailDetails?.inboxProbability === "high" ? "text-green-600" :
                      emailDetails?.inboxProbability === "medium" ? "text-yellow-600" :
                      emailDetails?.inboxProbability === "low" ? "text-orange-600" : "text-red-600"
                    }`}>
                      {emailDetails?.inboxProbability === "high" ? "High" :
                       emailDetails?.inboxProbability === "medium" ? "Medium" :
                       emailDetails?.inboxProbability === "low" ? "Low" : "None / Will Bounce"}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-400 mb-0.5">Est. Bounce Rate</div>
                    <div className="font-semibold text-sm text-gray-800">
                      {emailDetails?.estimatedBounceRate || "--"}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-400 mb-0.5">Sender Reputation Risk</div>
                    <div className={`font-semibold text-xs ${
                      (emailDetails?.senderReputationRisk || "").includes("CRITICAL") ? "text-red-600" :
                      (emailDetails?.senderReputationRisk || "").includes("HIGH") ? "text-red-500" :
                      (emailDetails?.senderReputationRisk || "").includes("MEDIUM") ? "text-yellow-600" : "text-green-600"
                    }`}>
                      {emailDetails?.senderReputationRisk || "LOW"}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-400 mb-0.5">MX Records</div>
                    <div className={`font-semibold text-sm ${
                      !emailDetails?.mxChecked ? "text-gray-400" :
                      emailDetails?.domainExists === false ? "text-red-600" :
                      emailDetails?.hasMX ? "text-green-600" : "text-red-600"
                    }`}>
                      {!emailDetails?.mxChecked ? "Not checked" :
                       emailDetails?.domainExists === false ? "Domain does not exist" :
                       emailDetails?.hasMX ? "Present" : "Missing -- guaranteed bounce"}
                    </div>
                    <div className="text-xs text-gray-400 mt-0.5">
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
              <div className="mb-4 p-4 bg-gray-50 rounded-xl border border-gray-100">
                <h3 className="text-sm font-medium text-gray-700 mb-3">IP Geolocation</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <div className="text-xs text-gray-400 mb-0.5">Country</div>
                    <div className="font-semibold text-sm text-gray-800">
                      {((result.details.ip as any)?.country as string) || "Unknown"}
                      {((result.details.ip as any)?.countryCode as string) ? " (" + (result.details.ip as any)?.countryCode + ")" : ""}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-400 mb-0.5">Region / City</div>
                    <div className="font-semibold text-sm text-gray-800">
                      {[(result.details.ip as any)?.region, (result.details.ip as any)?.city].filter(Boolean).join(", ") || "Unknown"}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-400 mb-0.5">ISP</div>
                    <div className="font-semibold text-sm text-gray-800">
                      {((result.details.ip as any)?.isp as string) || ((result.details.ip as any)?.org as string) || "Unknown"}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-400 mb-0.5">ASN</div>
                    <div className="font-semibold text-sm text-gray-800">
                      {((result.details.ip as any)?.asn as string) || "Unknown"}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-400 mb-0.5">Proxy / VPN</div>
                    <div className={`font-semibold text-sm ${(result.details.ip as any)?.isProxy ? "text-red-600" : "text-green-600"}`}>
                      {(result.details.ip as any)?.isProxy ? "Detected" : "Not detected"}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-400 mb-0.5">Hosting / Datacenter</div>
                    <div className={`font-semibold text-sm ${(result.details.ip as any)?.isHosting ? "text-red-600" : "text-green-600"}`}>
                      {(result.details.ip as any)?.isHosting ? "Yes - likely automated" : "No"}
                    </div>
                  </div>
                  {(result.details.ip as any)?.highRiskCountry && (
                    <div className="col-span-2">
                      <div className="text-xs text-red-500 font-medium">
                        High-risk region. Low conversion rates in international trade.
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {visibility?.includeReasons && (
              <div className="mb-4">
                <h3 className="text-sm font-medium text-gray-700 mb-2">Reasons</h3>
                {result.reasons.length === 0 ? (
                  <p className="text-sm text-gray-400">No risk signals detected.</p>
                ) : (
                  <ul className="space-y-1">
                    {result.reasons.map((r, i) => (
                      <li key={i} className="text-sm text-gray-600 flex items-start gap-2">
                        <span className="text-red-400 mt-0.5">-</span> {r}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {result.solution && result.solution.length > 0 && (
              <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-center gap-2 text-green-700 text-xs font-medium mb-3">
                  <CheckCircle className="w-3 h-3" /> Recommended Actions
                </div>
                <div className="space-y-3">
                  {result.solution.map((sol, i) => (
                    <div key={i} className="bg-white rounded-lg p-3 border border-green-100">
                      <div className="text-sm font-semibold text-green-800 mb-1">{sol.category}</div>
                      <div className="text-sm text-red-600 mb-1.5 font-medium">Problem: {sol.problem}</div>
                      <div className="text-sm text-gray-700 whitespace-pre-line leading-relaxed">{sol.fix}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {result.impact && result.impact.length > 0 && (
              <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                <div className="flex items-center gap-2 text-amber-700 text-xs font-medium mb-2">
                  <AlertTriangle className="w-3 h-3" /> Business Impact
                </div>
                <ul className="space-y-1">
                  {result.impact.map((imp, i) => (
                    <li key={i} className="text-sm text-amber-800">{imp}</li>
                  ))}
                </ul>
              </div>
            )}

            {result.ai_explanation && (
              <div className="mb-4 p-3 bg-purple-50 border border-purple-200 rounded-lg">
                <div className="flex items-center gap-2 text-purple-700 text-xs font-medium mb-1">
                  <Zap className="w-3 h-3" /> AI Analysis
                </div>
                <p className="text-sm text-purple-800">{result.ai_explanation}</p>
              </div>
            )}

            <button
              onClick={() => setShowDetails(!showDetails)}
              className="flex items-center gap-1 text-sm text-gray-400 hover:text-gray-600"
            >
              <ChevronDown className="w-4 h-4 transition-transform duration-200" style={{ transform: showDetails ? 'rotate(180deg)' : 'rotate(0deg)' }} />
              Technical Details
            </button>
            {showDetails && (
              <div className="mt-3 p-3 bg-gray-50 rounded-lg text-xs font-mono text-gray-600 max-h-48 overflow-auto">
                <pre>{JSON.stringify(result.details, null, 2)}</pre>
              </div>
            )}

            <div className="mt-4 pt-4 border-t flex items-center justify-between">
              <span className="text-xs text-gray-400">
                {result.credits?.remaining ?? "?"} credits remaining
              </span>
              <Link
                href="/pricing"
                className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
              >
                Get API access <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        )}

        <div className="bg-white rounded-xl border p-6 shadow-sm">
          <h2 className="font-semibold flex items-center gap-2 mb-4">
            <History className="w-5 h-5 text-gray-400" /> Recent Checks
          </h2>
          {history.length === 0 ? (
            <p className="text-sm text-gray-400">Run your first check above.</p>
          ) : (
            <div className="space-y-2">
              {history.slice(0, 10).map((h) => (
                <div key={h.id} className="flex items-center justify-between text-sm py-2 border-b border-gray-50 last:border-0">
                  <div className="flex items-center gap-3">
                    <span className="text-xs bg-gray-100 px-2 py-0.5 rounded font-mono uppercase">{h.check_type}</span>
                    <span className="text-gray-700 truncate max-w-[220px]">{h.input_value}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={h.risk_score >= 60 ? "text-red-600" : h.risk_score >= 30 ? "text-yellow-600" : "text-green-600"}>
                      {h.risk_score}
                    </span>
                    <span className="text-gray-400 text-xs">{new Date(h.created_at).toLocaleString()}</span>
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
