"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase";
import { plans, PlanKey } from "@/lib/plans";
import { Check, Shield } from "lucide-react";
import Link from "next/link";

const features = {
  free: ["1,000 requests/month", "Email risk check", "IP risk check", "Basic API access"],
  starter: ["50,000 requests/month", "Email + IP + Risk check", "AI risk explanation", "Email support"],
  growth: ["200,000 requests/month", "Everything in Starter", "Priority API access", "Slack support", "Team access (up to 3)"],
  business: ["1,000,000 requests/month", "Everything in Growth", "Dedicated support", "Custom SLA", "Team access (unlimited)"],
};

export default function PricingPage() {
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function handleUpgrade(plan: string) {
    setLoading(plan);
    setError("");
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setError("Please login first"); return; }
      const res = await fetch("/api/create-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      if (!res.ok) {
        const d = await res.json();
        setError(d.error || "Failed to create checkout");
        return;
      }
      const { checkoutUrl } = await res.json();
      window.location.href = checkoutUrl;
    } catch {
      setError("Network error, please retry");
    } finally {
      setLoading(null);
    }
  }

  const planEntries = Object.entries(plans) as [PlanKey, typeof plans[PlanKey]][];

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b px-6 py-4 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-3">
          <Shield className="w-6 h-6 text-blue-600" />
          <span className="font-bold text-lg">Fraud Shield API</span>
        </Link>
        <Link href="/dashboard" className="text-sm text-gray-600 hover:text-gray-900">Dashboard</Link>
      </header>

      <div className="max-w-6xl mx-auto p-6">
        <h1 className="text-3xl font-bold text-center mb-2">Choose Your Plan</h1>
        <p className="text-gray-500 text-center mb-10">Pay as you grow. Cancel anytime.</p>
        {error && <div className="mb-6 p-3 bg-red-50 text-red-600 rounded-lg text-sm text-center">{error}</div>}
        <div className="grid md:grid-cols-4 gap-4">
          {planEntries.map(([key, plan]) => {
            const isPopular = key === "growth";
            const featList = features[key];
            return (
              <div key={key} className={`relative rounded-xl border p-6 ${isPopular ? "bg-blue-600 border-blue-600 text-white" : "bg-white border-gray-200"}`}>
                {isPopular && <div className="absolute top-3 right-3 bg-white text-blue-600 text-xs font-bold px-2 py-0.5 rounded-full">POPULAR</div>}
                <h3 className="font-semibold capitalize text-lg">{key}</h3>
                <div className="mt-2">
                  <span className="text-3xl font-bold">${plan.price}</span>
                  <span className={isPopular ? "text-blue-100" : "text-gray-400"}>/mo</span>
                </div>
                <p className={`text-xs mt-1 ${isPopular ? "text-blue-100" : "text-gray-400"}`}>{plan.monthlyLimit.toLocaleString()} requests</p>
                <ul className="mt-6 space-y-2 mb-6">
                  {featList.map((f) => (
                    <li key={f} className={`flex items-center gap-2 text-xs ${isPopular ? "text-blue-50" : "text-gray-500"}`}>
                      <Check className={`w-3.5 h-3.5 ${isPopular ? "text-blue-200" : "text-green-500"}`} />{f}
                    </li>
                  ))}
                </ul>
                <button
                  onClick={() => handleUpgrade(key)}
                  disabled={loading === key || key === "free"}
                  className={`w-full py-2 rounded-lg text-sm font-bold transition ${key === "free" ? "bg-gray-100 text-gray-400 cursor-not-allowed" : isPopular ? "bg-white text-blue-600 hover:bg-blue-50 disabled:opacity-50" : "bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"}`}
                >
                  {key === "free" ? "Current" : loading === key ? "Redirecting..." : "Upgrade to " + key}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
