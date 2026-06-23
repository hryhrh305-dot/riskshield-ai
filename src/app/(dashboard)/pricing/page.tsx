"use client";

import { useState } from "react";
import { plans, PlanKey } from "@/lib/plans";
import { Check, Shield } from "lucide-react";
import Link from "next/link";

const planHighlights: Record<PlanKey, string[]> = {
  free: [
    "Basic email risk only",
    "Single checks only",
    "Advanced signals hidden",
    "No API or automation",
  ],
  starter: [
    "Deep email checks",
    "CSV/XLSX export",
    "Bulk list cleaning",
    "No API access",
  ],
  growth: [
    "Email + IP risk",
    "API access",
    "Google Sheets integration",
    "Pre-send workflows",
  ],
  scale: [
    "Production API",
    "Webhook + custom rules",
    "Priority processing",
    "10 team members",
  ],
  business: [
    "100,000+ monthly credits",
    "Custom API limits",
    "SLA and enterprise support",
    "White-label options",
  ],
};

const comparisonRows: Array<{
  label: string;
  values: Record<PlanKey, string>;
}> = [
  {
    label: "Monthly credits",
    values: {
      free: "50",
      starter: "1,000",
      growth: "5,000",
      scale: "30,000",
      business: "100,000+",
    },
  },
  {
    label: "Daily limit",
    values: {
      free: "5/day",
      starter: "300/day",
      growth: "1,500/day",
      scale: "8,000/day",
      business: "Custom",
    },
  },
  {
    label: "Basic email risk",
    values: {
      free: "Included",
      starter: "Included",
      growth: "Included",
      scale: "Included",
      business: "Included",
    },
  },
  {
    label: "Deep email checks",
    values: {
      free: "Hidden",
      starter: "Included",
      growth: "Included",
      scale: "Included",
      business: "Included",
    },
  },
  {
    label: "IP risk + combined scoring",
    values: {
      free: "No",
      starter: "No",
      growth: "Included",
      scale: "Included",
      business: "Included",
    },
  },
  {
    label: "API access",
    values: {
      free: "No",
      starter: "No",
      growth: "Included",
      scale: "Included",
      business: "Custom",
    },
  },
  {
    label: "Google Sheets",
    values: {
      free: "No",
      starter: "No",
      growth: "Included",
      scale: "Included",
      business: "Custom",
    },
  },
  {
    label: "Pre-send workflows",
    values: {
      free: "No",
      starter: "No",
      growth: "Included",
      scale: "Included",
      business: "Custom",
    },
  },
  {
    label: "Team members",
    values: {
      free: "1",
      starter: "1",
      growth: "3",
      scale: "10",
      business: "Custom",
    },
  },
];

export default function PricingPage() {
  const [error, setError] = useState("");

  async function handleUpgrade(plan: string) {
    void plan;
    setError("New tier display is live, but checkout mapping is intentionally held for the next payment step.");
  }

  const planEntries = Object.entries(plans) as [PlanKey, typeof plans[PlanKey]][];

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b px-6 py-4 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-3">
          <Shield className="w-6 h-6 text-blue-600" />
          <span className="font-bold text-lg">RiskShield</span>
        </Link>
        <Link href="/dashboard" className="text-sm text-gray-600 hover:text-gray-900">Dashboard</Link>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-8 sm:px-6">
        <div className="text-center max-w-3xl mx-auto mb-10">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Choose the plan that fits your workflow</h1>
          <p className="text-gray-500">
            Free and Starter focus on zero-paid-cost email checks. Growth and above unlock API, IP risk, Google Sheets, and automation.
          </p>
          <p className="text-xs text-gray-400 mt-2">
            Annual billing 15% off is planned, but not enabled yet. New checkout mapping is the next payment step.
          </p>
        </div>

        {error && (
          <div className="mb-6 p-3 bg-red-50 text-red-600 rounded-lg text-sm text-center">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4 mb-10">
          {planEntries.map(([key, plan]) => {
            const isPopular = key === "growth";
            const disabled = true;

            return (
              <div
                key={key}
                className={`relative rounded-2xl border p-6 ${
                  isPopular ? "bg-blue-600 border-blue-600 text-white" : "bg-white border-gray-200"
                }`}
              >
                {plan.badge && (
                  <div className="absolute top-3 right-3 bg-white text-blue-600 text-xs font-bold px-2 py-0.5 rounded-full">
                    {plan.badge}
                  </div>
                )}

                <div className="mb-3">
                  <h2 className="font-semibold text-lg">{plan.name}</h2>
                  <p className={`text-sm mt-1 ${isPopular ? "text-blue-100" : "text-gray-500"}`}>
                    {plan.tagline}
                  </p>
                </div>

                <div className="mb-2">
                  <span className="text-3xl font-bold">{plan.priceLabel}</span>
                  {!plan.contactOnly && <span className={isPopular ? "text-blue-100" : "text-gray-400"}>/mo</span>}
                </div>

                <div className={`text-sm font-medium ${isPopular ? "text-blue-50" : "text-gray-700"}`}>
                  {plan.creditsLabel}
                </div>
                <div className={`text-xs mt-1 ${isPopular ? "text-blue-100" : "text-gray-400"}`}>
                  {plan.billedPerCreditLabel}
                </div>
                <div className={`text-xs mt-1 ${isPopular ? "text-blue-100" : "text-gray-400"}`}>
                  {plan.actualCostLabel}
                </div>

                <ul className="mt-6 space-y-2 mb-6">
                  {planHighlights[key].map((item) => (
                    <li
                      key={item}
                      className={`flex items-start gap-2 text-xs ${isPopular ? "text-blue-50" : "text-gray-600"}`}
                    >
                      <Check className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${isPopular ? "text-blue-200" : "text-green-500"}`} />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>

                <button
                  onClick={() => handleUpgrade(key)}
                  disabled={disabled}
                  className={`w-full py-2 rounded-lg text-sm font-bold transition ${
                    key === "free"
                      ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                      : key === "business"
                      ? "bg-gray-100 text-gray-500 cursor-not-allowed"
                      : isPopular
                      ? "bg-white text-blue-600 hover:bg-blue-50 disabled:opacity-50"
                      : "bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
                  }`}
                >
                  {key === "free"
                    ? "Current"
                    : key === "business"
                    ? "Contact Sales"
                    : "Checkout Next Step"}
                </button>
              </div>
            );
          })}
        </div>

        <div className="bg-white rounded-2xl border overflow-hidden">
          <div className="px-6 py-4 border-b bg-gray-50">
            <h2 className="font-semibold text-gray-900">Plan comparison</h2>
            <p className="text-sm text-gray-500 mt-1">
              Free lets users see risk. Starter explains the risk. Growth and above unlock automation.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-white">
                <tr className="border-b">
                  <th className="text-left px-6 py-4 font-semibold text-gray-900">Feature</th>
                  {planEntries.map(([key, plan]) => (
                    <th key={key} className="text-left px-4 py-4 font-semibold text-gray-900 whitespace-nowrap">
                      {plan.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {comparisonRows.map((row) => (
                  <tr key={row.label} className="border-b last:border-0">
                    <td className="px-6 py-4 text-gray-700 font-medium">{row.label}</td>
                    {planEntries.map(([key]) => (
                      <td key={key} className="px-4 py-4 text-gray-600 whitespace-nowrap">
                        {row.values[key]}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
