"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Shield, ChevronDown, ChevronUp, BarChart3, ArrowRight } from "lucide-react";

interface Campaign {
  id: string;
  campaign_name: string;
  total_contacts: number;
  allowed_count: number;
  review_count: number;
  blocked_count: number;
  risk_score_avg: number;
  created_at: string;
  results?: CampaignResult[];
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

  useEffect(() => { loadCampaigns(); }, []);

  async function loadCampaigns() {
    try {
      const res = await fetch("/api/pre-send", { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setCampaigns(data.campaigns || []);
      }
    } catch {} finally { setLoading(false); }
  }

  async function toggleExpand(campaignId: string) {
    if (expandedId === campaignId) { setExpandedId(null); return; }
    setExpandedId(campaignId);
    if (!results[campaignId]) {
      try {
        const res = await fetch(`/api/pre-send?campaign_id=${campaignId}`, { credentials: "include" });
        if (res.ok) {
          const data = await res.json();
          setResults(prev => ({ ...prev, [campaignId]: data.results || [] }));
        }
      } catch {}
    }
  }

  const scoreColor = (s: number) => s >= 60 ? "text-red-600" : s >= 30 ? "text-yellow-600" : "text-green-600";
  const decisionBadge = (d: string) => d === "BLOCK" ? "bg-red-50 text-red-700" : d === "REVIEW" ? "bg-yellow-50 text-yellow-700" : "bg-green-50 text-green-700";

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
          <div className="inline-flex items-center gap-2 bg-blue-50 text-blue-700 px-4 py-1.5 rounded-full text-sm font-medium mb-4">
            <BarChart3 className="w-4 h-4" /> Pre-send Protection
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Campaign History</h1>
          <p className="text-gray-500 max-w-lg mx-auto">Past campaigns screened before sending. Click a campaign to see detailed results.</p>
        </div>

        {loading && <p className="text-center text-gray-400">Loading...</p>}
        {!loading && campaigns.length === 0 && (
          <div className="text-center p-12 bg-white rounded-xl border">
            <BarChart3 className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">No campaigns yet. Use the Pre-send API to screen emails before sending.</p>
            <Link href="/docs" className="text-sm text-blue-600 hover:underline mt-2 inline-block">View API docs</Link>
          </div>
        )}

        <div className="space-y-4">
          {campaigns.map(c => (
            <div key={c.id} className="bg-white rounded-xl border shadow-sm">
              <button onClick={() => toggleExpand(c.id)} className="w-full p-5 flex items-center justify-between hover:bg-gray-50 rounded-xl">
                <div className="text-left">
                  <div className="font-semibold text-gray-800">{c.campaign_name || "Unnamed Campaign"}</div>
                  <div className="text-xs text-gray-400 mt-1">{new Date(c.created_at).toLocaleString()}</div>
                </div>
                <div className="flex items-center gap-6">
                  <div className="text-center">
                    <div className="text-xs text-gray-400">Contacts</div>
                    <div className="font-bold text-gray-700">{c.total_contacts}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-xs text-gray-400">Risk Avg</div>
                    <div className={`font-bold ${scoreColor(c.risk_score_avg)}`}>{c.risk_score_avg}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-xs text-red-400">Blocked</div>
                    <div className="font-bold text-red-600">{c.blocked_count}</div>
                  </div>
                  {expandedId === c.id ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
                </div>
              </button>
              {expandedId === c.id && (
                <div className="border-t px-5 py-3 max-h-[400px] overflow-y-auto">
                  {results[c.id]?.length === 0 && <p className="text-sm text-gray-400 py-4 text-center">No detailed results available.</p>}
                  {results[c.id]?.map(r => (
                    <div key={r.id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0 text-sm">
                      <span className="font-mono text-gray-700 truncate max-w-[280px]">{r.email}</span>
                      <div className="flex items-center gap-4">
                        <span className={`font-bold ${scoreColor(r.risk_score)}`}>{r.risk_score}</span>
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${decisionBadge(r.decision)}`}>{r.decision}</span>
                        <span className="text-xs text-gray-400 truncate max-w-[200px]">{r.reasons?.slice(0, 2).join(", ") || "-"}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
