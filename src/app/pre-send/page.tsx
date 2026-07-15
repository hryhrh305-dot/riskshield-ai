"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Shield, ChevronDown, ChevronUp, BarChart3, ArrowRight, AlertTriangle, CheckCircle2 } from "lucide-react";

interface Campaign {
  id: string;
  campaign_name: string;
  total_contacts: number;
  allowed_count: number;
  review_count: number;
  blocked_count: number;
  risk_score_avg: number;
  created_at: string;
}

interface CampaignResult {
  id: string;
  email: string;
  risk_score: number;
  decision: string;
  reasons: string[];
}

export default function PreSendPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, CampaignResult[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadCampaigns() {
    try {
      const res = await fetch("/api/pre-send", { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setCampaigns(data.campaigns || []);
      } else setError("Audit history could not be loaded.");
    } catch { setError("Audit history could not be loaded."); } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      void loadCampaigns();
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  async function toggleExpand(campaignId: string) {
    if (expandedId === campaignId) {
      setExpandedId(null);
      return;
    }
    setExpandedId(campaignId);
    if (!results[campaignId]) {
      try {
        const res = await fetch(`/api/pre-send?campaign_id=${campaignId}`, { credentials: "include" });
        if (res.ok) {
          const data = await res.json();
          setResults((prev) => ({ ...prev, [campaignId]: data.results || [] }));
        } else setError("The saved contact results could not be loaded.");
      } catch { setError("The saved contact results could not be loaded."); }
    }
  }

  const scoreColor = (score: number) =>
    score >= 66 ? "text-red-300" : score >= 26 ? "text-amber-300" : "text-emerald-300";

  const decisionBadge = (decision: string) =>
    decision === "BLOCK" ? "rs-badge-block" : decision === "REVIEW" ? "rs-badge-review" : "rs-badge-allow";

  return (
    <div className="rs-shell">
      <header className="border-b border-white/10 bg-black/20 backdrop-blur-xl">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4 sm:px-6">
          <Link href="/dashboard" className="rs-link-arrow inline-flex items-center gap-1 text-sm text-slate-400 hover:text-white">
            <ArrowRight className="h-4 w-4 rotate-180" /> Dashboard
          </Link>
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium uppercase tracking-[0.2em] text-slate-300">
            <Shield className="h-3.5 w-3.5" /> Pre-send
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <section className="mb-8 text-center">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-sm font-medium text-slate-200">
            <BarChart3 className="h-4 w-4" /> Audit History
          </div>
          <h1 className="rs-title-settle text-3xl font-semibold text-white sm:text-4xl">Campaign Audit History</h1>
          <p className="mx-auto mt-3 max-w-2xl text-slate-400">
            Revisit the evidence behind prior campaign approvals. Expand any run to inspect its individual contact decisions.
          </p>
        </section>

        {loading && (
          <div className="rs-card rounded-[28px] p-10 text-center text-sm text-slate-400">
            Loading audit history...
          </div>
        )}

        {error && <div role="alert" className="mb-4 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">{error}</div>}

        {!loading && campaigns.length === 0 && (
          <div className="rs-card rounded-[28px] p-12 text-center">
            <BarChart3 className="mx-auto mb-3 h-10 w-10 text-slate-600" />
            <p className="text-sm text-slate-400">No audits yet.</p>
            <Link href="/docs" className="mt-3 inline-flex text-sm font-medium text-white hover:text-slate-300">
              View API docs
            </Link>
          </div>
        )}

        <div className="space-y-4">
          {campaigns.map((campaign) => (
            <section key={campaign.id} className="rs-card rs-card-hover rounded-[28px] overflow-hidden">
              <button
                onClick={() => toggleExpand(campaign.id)}
                aria-expanded={expandedId === campaign.id}
                className="flex w-full flex-col gap-4 p-5 text-left sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <div className="truncate text-base font-semibold text-white">
                    {campaign.campaign_name || "Unnamed campaign"}
                  </div>
                  <div className="mt-1 text-xs text-slate-500">{new Date(campaign.created_at).toLocaleString()}</div>
                </div>

                <div className="flex flex-wrap items-center gap-3 sm:justify-end">
                  <div className="rounded-2xl border border-white/10 bg-black/20 px-3 py-2 text-center">
                    <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Contacts</div>
                    <div className="mt-1 text-sm font-semibold text-white">{campaign.total_contacts}</div>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-black/20 px-3 py-2 text-center">
                    <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Risk Avg</div>
                    <div className={`mt-1 text-sm font-semibold ${scoreColor(campaign.risk_score_avg)}`}>{campaign.risk_score_avg}</div>
                  </div>
                  <div className="rounded-2xl border border-red-500/15 bg-red-500/8 px-3 py-2 text-center">
                    <div className="text-[11px] uppercase tracking-[0.18em] text-red-200/70">Blocked</div>
                    <div className="mt-1 text-sm font-semibold text-red-300">{campaign.blocked_count}</div>
                  </div>
                  {expandedId === campaign.id ? <ChevronUp className="h-5 w-5 text-slate-400" /> : <ChevronDown className="h-5 w-5 text-slate-400" />}
                </div>
              </button>

              {expandedId === campaign.id && (
                <div className="border-t border-white/10 px-5 py-4">
                  {!results[campaign.id] ? (
                    <div className="text-sm text-slate-500">Loading campaign results...</div>
                  ) : results[campaign.id].length === 0 ? (
                    <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-5 text-sm text-slate-400">
                      No saved contact-level results were returned for this campaign.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {results[campaign.id].map((result) => (
                        <div key={result.id} className="flex flex-col gap-3 rounded-[24px] border border-white/10 bg-black/20 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
                          <div className="min-w-0">
                            <div className="truncate font-mono text-sm text-slate-100">{result.email}</div>
                            <div className="mt-2 flex flex-wrap gap-2">
                              {(result.reasons?.length ? result.reasons : ["No reason provided"]).slice(0, 3).map((reason) => (
                                <span key={reason} className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-slate-300">
                                  {reason}
                                </span>
                              ))}
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center gap-3 sm:justify-end">
                            <div className={`text-lg font-semibold ${scoreColor(result.risk_score)}`}>{result.risk_score}</div>
                            <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${decisionBadge(result.decision)}`}>
                              {result.decision === "BLOCK" ? <AlertTriangle className="h-3.5 w-3.5" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                              {result.decision}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </section>
          ))}
        </div>
      </main>
    </div>
  );
}
