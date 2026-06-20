"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase";
import { getPlanLimits, plans, PlanKey } from "@/lib/plans";
import { generateApiKey } from "@/lib/api-auth";
import { signOut } from "@/lib/auth";
import Link from "next/link";
import { LogOut, Shield, Key, Copy, Trash2, BarChart3, Activity, CheckCircle, XCircle, AlertTriangle } from "lucide-react";

interface Profile { id: string; email: string; plan: string; subscription_status: string; }
interface ApiKey { id: string; key: string; name: string; status: string; created_at: string; last_used_at: string | null; }
interface CheckRecord { id: string; check_type: string; input_value: string; risk_score: number; created_at: string; }

export default function DashboardPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [checks, setChecks] = useState<CheckRecord[]>([]);
  const [monthlyUsed, setMonthlyUsed] = useState(0);
  const [copied, setCopied] = useState("");

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: p } = await supabase.from("profiles").select("*").eq("id", user.id).single();
    if (p) setProfile(p);
    const { data: keys } = await supabase.from("api_keys").select("*").eq("user_id", user.id).order("created_at", { ascending: false });
    if (keys) setApiKeys(keys);
    const { data: cks } = await supabase.from("checks").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(20);
    if (cks) setChecks(cks);
    const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split("T")[0];
    const { data: usg } = await supabase.from("api_usage").select("request_count").eq("user_id", user.id).gte("date", startOfMonth);
    setMonthlyUsed(usg?.reduce((s, r) => s + r.request_count, 0) ?? 0);
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

  if (!profile) return <div className="p-8 text-gray-500">Loading...</div>;

  const planKey = profile.plan as PlanKey;
  const planInfo = getPlanLimits(planKey);
  const usagePercent = Math.min((monthlyUsed / planInfo.monthlyLimit) * 100, 100);

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b px-6 py-4 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-3">
          <Shield className="w-6 h-6 text-blue-600" />
          <span className="font-bold text-lg">Fraud Shield API</span>
        </Link>
        <div className="flex items-center gap-4 text-sm text-gray-600">
          <span>{profile.email}</span>
          <button onClick={signOut} className="flex items-center gap-1 hover:text-gray-900">
            <LogOut className="w-4 h-4" /> Sign Out
          </button>
        </div>
      </header>

      <div className="max-w-5xl mx-auto p-6 grid gap-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white rounded-xl border p-5">
            <div className="flex items-center gap-2 text-blue-600 mb-2"><BarChart3 className="w-5 h-5" /><span className="font-semibold text-sm">Monthly Usage</span></div>
            <div className="text-2xl font-bold">{monthlyUsed.toLocaleString()} <span className="text-sm font-normal text-gray-400">/ {planInfo.monthlyLimit.toLocaleString()}</span></div>
            <div className="mt-2 bg-gray-100 rounded-full h-2"><div className="bg-blue-500 h-2 rounded-full" style={{ width: usagePercent + "%" }} /></div>
          </div>
          <div className="bg-white rounded-xl border p-5">
            <div className="flex items-center gap-2 text-green-600 mb-2"><Activity className="w-5 h-5" /><span className="font-semibold text-sm">Plan</span></div>
            <div className="text-2xl font-bold capitalize">{profile.plan}</div>
            <div className="text-xs text-gray-400 mt-1">{profile.subscription_status}</div>
          </div>
          <div className="bg-white rounded-xl border p-5">
            <div className="flex items-center gap-2 text-purple-600 mb-2"><CheckCircle className="w-5 h-5" /><span className="font-semibold text-sm">API Keys</span></div>
            <div className="text-2xl font-bold">{apiKeys.filter(k => k.status === "active").length}</div>
            <div className="text-xs text-gray-400 mt-1">active keys</div>
          </div>
        </div>

        <div className="bg-white rounded-xl border p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold flex items-center gap-2"><Key className="w-5 h-5" /> API Keys</h2>
            <button onClick={createKey} className="bg-blue-600 text-white px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-blue-700">Generate Key</button>
          </div>
          {apiKeys.length === 0 && <p className="text-sm text-gray-400">No API keys yet.</p>}
          <div className="space-y-3">
            {apiKeys.map((k) => (
              <div key={k.id} className="flex items-center justify-between bg-gray-50 rounded-lg px-4 py-3">
                <div>
                  <div className="font-mono text-sm text-gray-800">
                    {k.key.slice(0, 12)}...{k.key.slice(-6)}
                    {k.status === "revoked" && <span className="ml-2 text-xs bg-red-100 text-red-600 px-1.5 py-0.5 rounded">Revoked</span>}
                  </div>
                  <div className="text-xs text-gray-400 mt-0.5">Created {new Date(k.created_at).toLocaleDateString()}{k.last_used_at ? " - Last used " + new Date(k.last_used_at).toLocaleDateString() : ""}</div>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => { navigator.clipboard.writeText(k.key); setCopied(k.id); setTimeout(() => setCopied(""), 2000); }} className="p-1.5 text-gray-400 hover:text-gray-700 rounded">
                    <Copy className="w-4 h-4" />{copied === k.id && <span className="text-xs ml-1 text-green-600">Copied</span>}
                  </button>
                  {k.status === "active" && (
                    <button onClick={() => revokeKey(k.id)} className="p-1.5 text-gray-400 hover:text-red-600 rounded"><Trash2 className="w-4 h-4" /></button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-xl border p-6">
          <h2 className="font-semibold flex items-center gap-2 mb-4"><Activity className="w-5 h-5" /> Recent Checks</h2>
          {checks.length === 0 && <p className="text-sm text-gray-400">No checks yet.</p>}
          <div className="space-y-2">
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
    </div>
  );
}
