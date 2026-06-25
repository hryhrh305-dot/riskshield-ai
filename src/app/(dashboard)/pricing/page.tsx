"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Check, Clock3, Minus, Shield } from "lucide-react";
import { plans, type PlanKey } from "@/lib/plans";
import { getCreemAnnualOffer, getCreemSubscriptionCopy } from "@/lib/creem";
import { createClient } from "@/lib/supabase";

type Availability = "included" | "limited" | "unavailable" | "soon" | "custom";
type BillingInterval = "monthly" | "yearly";

type FeatureValue = {
  text: string;
  availability: Availability;
};

type ComparisonSection = {
  title: string;
  rows: Array<{
    label: string;
    values: Record<PlanKey, FeatureValue>;
  }>;
};

const included = (text = "Included"): FeatureValue => ({ text, availability: "included" });
const limited = (text: string): FeatureValue => ({ text, availability: "limited" });
const unavailable = (): FeatureValue => ({ text: "—", availability: "unavailable" });
const soon = (): FeatureValue => ({ text: "Coming soon", availability: "soon" });
const custom = (text = "Custom"): FeatureValue => ({ text, availability: "custom" });

const planHighlights: Record<PlanKey, string[]> = {
  free: [
    "50 monthly credits",
    "Individual risk checks",
    "Risk score and decision",
    "Recent check history",
  ],
  starter: [
    "1,000 monthly credits",
    "Deep email verification",
    "Bulk list screening",
    "CSV and XLSX exports",
  ],
  growth: [
    "5,000 monthly credits",
    "Email and IP intelligence",
    "API and Google Sheets",
    "Pre-send protection",
  ],
  scale: [
    "30,000 monthly credits",
    "Higher API throughput",
    "Production-volume workflows",
    "Everything in Growth",
  ],
  business: [
    "100,000+ monthly credits",
    "Custom API capacity",
    "Enterprise onboarding",
    "Negotiated support and terms",
  ],
};

const selfServePaidPlans: PlanKey[] = ["starter", "growth", "scale"];

const comparisonSections: ComparisonSection[] = [
  {
    title: "Usage and workflow",
    rows: [
      {
        label: "Monthly credits",
        values: {
          free: included("50"),
          starter: included("1,000"),
          growth: included("5,000"),
          scale: included("30,000"),
          business: custom("100,000+"),
        },
      },
      {
        label: "Daily usage allowance",
        values: {
          free: included("5/day"),
          starter: included("300/day"),
          growth: included("1,500/day"),
          scale: included("8,000/day"),
          business: custom(),
        },
      },
      {
        label: "Individual checks",
        values: {
          free: included(),
          starter: included(),
          growth: included(),
          scale: included(),
          business: included(),
        },
      },
      {
        label: "Bulk list screening",
        values: {
          free: unavailable(),
          starter: included(),
          growth: included(),
          scale: included(),
          business: included(),
        },
      },
      {
        label: "Maximum planned batch size",
        values: {
          free: included("1"),
          starter: included("1,000"),
          growth: included("5,000"),
          scale: included("30,000"),
          business: custom(),
        },
      },
      {
        label: "CSV / TXT / XLSX upload",
        values: {
          free: unavailable(),
          starter: included(),
          growth: included(),
          scale: included(),
          business: included(),
        },
      },
      {
        label: "CSV / XLSX result export",
        values: {
          free: unavailable(),
          starter: included(),
          growth: included(),
          scale: included(),
          business: included(),
        },
      },
      {
        label: "Recent check history",
        values: {
          free: included(),
          starter: included(),
          growth: included(),
          scale: included(),
          business: included(),
        },
      },
      {
        label: "Extended history retention",
        values: {
          free: unavailable(),
          starter: unavailable(),
          growth: soon(),
          scale: soon(),
          business: custom(),
        },
      },
    ],
  },
  {
    title: "Email risk intelligence",
    rows: [
      {
        label: "Email syntax and format",
        values: {
          free: included(),
          starter: included(),
          growth: included(),
          scale: included(),
          business: included(),
        },
      },
      {
        label: "Disposable email detection",
        values: {
          free: included(),
          starter: included(),
          growth: included(),
          scale: included(),
          business: included(),
        },
      },
      {
        label: "Role-based and suspicious address patterns",
        values: {
          free: included(),
          starter: included(),
          growth: included(),
          scale: included(),
          business: included(),
        },
      },
      {
        label: "Suspicious domains and TLDs",
        values: {
          free: included(),
          starter: included(),
          growth: included(),
          scale: included(),
          business: included(),
        },
      },
      {
        label: "MX mail-server verification",
        values: {
          free: limited("Basic"),
          starter: included("Deep"),
          growth: included("Deep"),
          scale: included("Deep"),
          business: included("Deep"),
        },
      },
      {
        label: "SMTP mailbox response",
        values: {
          free: unavailable(),
          starter: included(),
          growth: included(),
          scale: included(),
          business: included(),
        },
      },
      {
        label: "Mailbox full / temporary rejection",
        values: {
          free: unavailable(),
          starter: included(),
          growth: included(),
          scale: included(),
          business: included(),
        },
      },
      {
        label: "Catch-all domain detection",
        values: {
          free: unavailable(),
          starter: included(),
          growth: included(),
          scale: included(),
          business: included(),
        },
      },
      {
        label: "SPF / DMARC / DKIM checks",
        values: {
          free: unavailable(),
          starter: limited("Scored internally"),
          growth: included(),
          scale: included(),
          business: included(),
        },
      },
      {
        label: "Domain age and new-domain risk",
        values: {
          free: unavailable(),
          starter: unavailable(),
          growth: included(),
          scale: included(),
          business: included(),
        },
      },
      {
        label: "Blacklist matching",
        values: {
          free: limited("Risk signal"),
          starter: included(),
          growth: included(),
          scale: included(),
          business: included(),
        },
      },
      {
        label: "Detailed risk factors",
        values: {
          free: limited("Basic signals only"),
          starter: unavailable(),
          growth: included(),
          scale: included(),
          business: included(),
        },
      },
      {
        label: "Recommended actions and remediation",
        values: {
          free: unavailable(),
          starter: limited("Recommendation only"),
          growth: included(),
          scale: included(),
          business: included(),
        },
      },
      {
        label: "Company health score",
        values: {
          free: unavailable(),
          starter: unavailable(),
          growth: included(),
          scale: included(),
          business: included(),
        },
      },
    ],
  },
  {
    title: "IP and combined risk",
    rows: [
      {
        label: "IP geolocation and network context",
        values: {
          free: unavailable(),
          starter: unavailable(),
          growth: included(),
          scale: included(),
          business: included(),
        },
      },
      {
        label: "Proxy / VPN detection",
        values: {
          free: unavailable(),
          starter: unavailable(),
          growth: included(),
          scale: included(),
          business: included(),
        },
      },
      {
        label: "Hosting / datacenter IP detection",
        values: {
          free: unavailable(),
          starter: unavailable(),
          growth: included(),
          scale: included(),
          business: included(),
        },
      },
      {
        label: "High-risk geography signals",
        values: {
          free: unavailable(),
          starter: unavailable(),
          growth: included(),
          scale: included(),
          business: included(),
        },
      },
      {
        label: "Email + IP combined scoring",
        values: {
          free: unavailable(),
          starter: unavailable(),
          growth: included(),
          scale: included(),
          business: included(),
        },
      },
    ],
  },
  {
    title: "Automation and integrations",
    rows: [
      {
        label: "API access",
        values: {
          free: unavailable(),
          starter: unavailable(),
          growth: included("Standard"),
          scale: included("Higher limits"),
          business: custom(),
        },
      },
      {
        label: "Google Sheets integration",
        values: {
          free: unavailable(),
          starter: unavailable(),
          growth: included(),
          scale: included(),
          business: custom(),
        },
      },
      {
        label: "Pre-send API protection",
        values: {
          free: unavailable(),
          starter: unavailable(),
          growth: included(),
          scale: included(),
          business: custom(),
        },
      },
      {
        label: "Campaign reporting dashboard",
        values: {
          free: unavailable(),
          starter: unavailable(),
          growth: soon(),
          scale: soon(),
          business: custom(),
        },
      },
      {
        label: "Risk settings",
        values: {
          free: unavailable(),
          starter: unavailable(),
          growth: included(),
          scale: included(),
          business: custom(),
        },
      },
      {
        label: "Blacklist management",
        values: {
          free: unavailable(),
          starter: unavailable(),
          growth: included(),
          scale: included(),
          business: custom(),
        },
      },
      {
        label: "Webhook delivery",
        values: {
          free: unavailable(),
          starter: unavailable(),
          growth: unavailable(),
          scale: soon(),
          business: custom(),
        },
      },
      {
        label: "Multiple API keys and key permissions",
        values: {
          free: unavailable(),
          starter: unavailable(),
          growth: unavailable(),
          scale: soon(),
          business: custom(),
        },
      },
      {
        label: "Custom risk rules and allowlists",
        values: {
          free: unavailable(),
          starter: unavailable(),
          growth: unavailable(),
          scale: soon(),
          business: custom(),
        },
      },
    ],
  },
  {
    title: "Operations and service",
    rows: [
      {
        label: "API throughput",
        values: {
          free: unavailable(),
          starter: unavailable(),
          growth: included("Standard"),
          scale: included("Higher"),
          business: custom(),
        },
      },
      {
        label: "Team workspace and member roles",
        values: {
          free: unavailable(),
          starter: unavailable(),
          growth: soon(),
          scale: soon(),
          business: custom(),
        },
      },
      {
        label: "Priority processing queue",
        values: {
          free: unavailable(),
          starter: unavailable(),
          growth: unavailable(),
          scale: soon(),
          business: custom(),
        },
      },
      {
        label: "Implementation assistance",
        values: {
          free: unavailable(),
          starter: unavailable(),
          growth: unavailable(),
          scale: soon(),
          business: custom("Dedicated"),
        },
      },
      {
        label: "SLA and enterprise procurement",
        values: {
          free: unavailable(),
          starter: unavailable(),
          growth: unavailable(),
          scale: unavailable(),
          business: custom(),
        },
      },
      {
        label: "White-label reporting",
        values: {
          free: unavailable(),
          starter: unavailable(),
          growth: unavailable(),
          scale: unavailable(),
          business: custom("Optional"),
        },
      },
    ],
  },
];

function AvailabilityCell({ value }: { value: FeatureValue }) {
  if (value.availability === "unavailable") {
    return (
      <span className="inline-flex items-center gap-1.5 text-gray-300">
        <Minus className="h-4 w-4" />
        <span className="sr-only">Not included</span>
      </span>
    );
  }

  if (value.availability === "soon") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2 py-1 text-xs font-medium text-amber-700">
        <Clock3 className="h-3.5 w-3.5" />
        {value.text}
      </span>
    );
  }

  if (value.availability === "custom") {
    return (
      <span className="inline-flex rounded-full bg-purple-50 px-2 py-1 text-xs font-medium text-purple-700">
        {value.text}
      </span>
    );
  }

  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${
      value.availability === "limited" ? "text-slate-600" : "text-emerald-700"
    }`}>
      <Check className="h-3.5 w-3.5 shrink-0" />
      {value.text}
    </span>
  );
}

export default function PricingPage() {
  const planEntries = Object.entries(plans) as [PlanKey, typeof plans[PlanKey]][];
  const [currentPlan, setCurrentPlan] = useState<PlanKey>("free");
  const [billingInterval, setBillingInterval] = useState<BillingInterval>("monthly");
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);
  const [checkoutError, setCheckoutError] = useState("");

  useEffect(() => {
    let mounted = true;

    async function loadCurrentPlan() {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const user = session?.user;

      if (!user || !mounted) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("plan")
        .eq("id", user.id)
        .maybeSingle();

      if (profile?.plan && mounted) {
        setCurrentPlan(profile.plan as PlanKey);
      }
    }

    loadCurrentPlan();
    return () => {
      mounted = false;
    };
  }, []);

  async function handleCheckout(plan: PlanKey) {
    if (!selfServePaidPlans.includes(plan)) return;

    const loadingKey = `${plan}:${billingInterval}`;
    setCheckoutLoading(loadingKey);
    setCheckoutError("");

    try {
      const response = await fetch("/api/create-checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({ plan, billingInterval }),
      });

      const data = await response.json();
      if (!response.ok || !data?.checkoutUrl) {
        throw new Error(data?.error || "Failed to start checkout.");
      }

      window.location.assign(data.checkoutUrl);
      return;
    } catch (error) {
      setCheckoutError(error instanceof Error ? error.message : "Failed to start checkout.");
      setCheckoutLoading(null);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6">
          <Link href="/" className="flex items-center gap-3">
            <Shield className="h-6 w-6 text-blue-600" />
            <span className="text-lg font-bold">RiskShield AI</span>
          </Link>
          <Link href="/dashboard" className="text-sm text-gray-600 hover:text-gray-900">Dashboard</Link>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
        <section className="mx-auto mb-10 max-w-3xl text-center">
          <p className="mb-3 text-sm font-semibold uppercase tracking-wide text-blue-600">Simple plans, clear capabilities</p>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
            Choose the level of risk intelligence your workflow needs
          </h1>
          <p className="mt-4 text-gray-600">
            Start with individual email checks, add deep list verification, then move to API-driven email and IP protection as your workflow grows.
          </p>
        </section>

        <section className="mb-8 flex justify-center">
          <div className="inline-flex rounded-xl border border-gray-200 bg-white p-1 shadow-sm">
            <button
              type="button"
              onClick={() => setBillingInterval("monthly")}
              className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
                billingInterval === "monthly"
                  ? "bg-blue-600 text-white"
                  : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
              }`}
            >
              Monthly
            </button>
            <button
              type="button"
              onClick={() => setBillingInterval("yearly")}
              className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
                billingInterval === "yearly"
                  ? "bg-blue-600 text-white"
                  : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
              }`}
            >
              Yearly
              <span className={`ml-2 rounded-full px-2 py-0.5 text-xs ${
                billingInterval === "yearly" ? "bg-white/20 text-white" : "bg-emerald-50 text-emerald-700"
              }`}>
                2 months free
              </span>
            </button>
          </div>
        </section>

        <section className="mb-12 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
          {planEntries.map(([key, plan]) => {
            const isPopular = key === "growth";
            const isPaidSelfServe = selfServePaidPlans.includes(key);
            const annualOffer = getCreemAnnualOffer(key);
            const showYearly = billingInterval === "yearly" && !!annualOffer;
            const checkoutLoadingKey = isPaidSelfServe ? `${key}:${billingInterval}` : null;
            const subscriptionCopy = getCreemSubscriptionCopy(billingInterval);
            const displayedPrice = showYearly ? annualOffer.monthlyEquivalentLabel : plan.priceLabel;
            const displayedPeriod = "/month";

            return (
              <article
                key={key}
                className={`relative flex min-h-[390px] flex-col rounded-2xl border p-6 shadow-sm ${
                  isPopular
                    ? "border-blue-600 bg-blue-600 text-white shadow-blue-100"
                    : "border-gray-200 bg-white text-gray-900"
                }`}
              >
                {plan.badge && (
                  <div className="absolute right-3 top-3 rounded-full bg-white px-2 py-0.5 text-xs font-bold text-blue-600">
                    {plan.badge}
                  </div>
                )}

                <div>
                  <h2 className="text-lg font-semibold">{plan.name}</h2>
                  <p className={`mt-1 min-h-10 text-sm ${isPopular ? "text-blue-100" : "text-gray-500"}`}>
                    {plan.tagline}
                  </p>
                </div>

                <div className="mt-5">
                  <span className="text-3xl font-bold">{displayedPrice}</span>
                  {!plan.contactOnly && key !== "free" && <span className={isPopular ? "text-blue-100" : "text-gray-400"}>{displayedPeriod}</span>}
                  <p className={`mt-2 text-sm font-medium ${isPopular ? "text-blue-50" : "text-gray-700"}`}>
                    {plan.creditsLabel}
                  </p>
                  {showYearly && (
                    <div className={`mt-3 flex flex-wrap gap-2 text-xs font-semibold ${
                      isPopular ? "text-white" : "text-emerald-700"
                    }`}>
                      <span className={`rounded-full px-2.5 py-1 ${
                        isPopular ? "bg-white/20" : "bg-emerald-50"
                      }`}>
                        {annualOffer.discountPercentLabel}
                      </span>
                      <span className={`rounded-full px-2.5 py-1 ${
                        isPopular ? "bg-white/20" : "bg-blue-50 text-blue-700"
                      }`}>
                        {annualOffer.savingsAmountLabel}
                      </span>
                      {annualOffer.promoLabel && (
                        <span className={`rounded-full px-2.5 py-1 ${
                          isPopular ? "bg-white/20" : "bg-purple-50 text-purple-700"
                        }`}>
                          {annualOffer.promoLabel}
                        </span>
                      )}
                    </div>
                  )}
                  {isPaidSelfServe && (
                    <div className={`mt-3 space-y-1 text-xs ${isPopular ? "text-blue-100" : "text-gray-500"}`}>
                      <p>{subscriptionCopy.subscriptionLabel}</p>
                      <p>{subscriptionCopy.renewalLabel}</p>
                      <p>Cancel anytime</p>
                      {showYearly ? (
                        <p>{annualOffer.yearlyPriceLabel}/year billed yearly</p>
                      ) : (
                        <p>{subscriptionCopy.cadenceLabel}</p>
                      )}
                    </div>
                  )}
                </div>

                <p className={`mt-4 text-sm leading-6 ${isPopular ? "text-blue-100" : "text-gray-500"}`}>
                  {plan.description}
                </p>

                <ul className="mt-5 flex-1 space-y-2.5">
                  {planHighlights[key].map((item) => (
                    <li key={item} className={`flex items-start gap-2 text-sm ${isPopular ? "text-blue-50" : "text-gray-600"}`}>
                      <Check className={`mt-0.5 h-4 w-4 shrink-0 ${isPopular ? "text-blue-200" : "text-emerald-500"}`} />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>

                <button
                  type="button"
                  onClick={() => handleCheckout(key)}
                  disabled={
                    key === "free" ||
                    key === "business" ||
                    key === currentPlan ||
                    checkoutLoading !== null
                  }
                  className={`mt-6 w-full rounded-lg px-4 py-2.5 text-sm font-semibold transition ${
                    key === "free" || key === "business" || key === currentPlan || checkoutLoading !== null
                      ? isPopular
                        ? "cursor-not-allowed bg-white/90 text-blue-600"
                        : "cursor-not-allowed bg-gray-100 text-gray-500"
                      : isPopular
                        ? "bg-white text-blue-600 hover:bg-blue-50"
                        : "bg-blue-600 text-white hover:bg-blue-700"
                  }`}
                >
                  {key === "free"
                    ? currentPlan === "free"
                      ? "Current plan"
                      : "Free plan"
                    : key === "business"
                      ? "Contact sales"
                      : key === currentPlan
                        ? "Current plan"
                        : checkoutLoading === checkoutLoadingKey
                          ? "Redirecting..."
                          : key === "starter"
                            ? "Start Starter"
                            : key === "growth"
                              ? "Start Growth"
                              : "Run at Scale"}
                </button>

                {isPaidSelfServe && (
                  <p className={`mt-3 text-xs ${isPopular ? "text-blue-100" : "text-gray-500"}`}>
                    Checkout starts a {billingInterval} subscription managed in the Creem Customer Portal.
                  </p>
                )}
              </article>
            );
          })}
        </section>

        {checkoutError && (
          <section className="mb-8 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {checkoutError}
          </section>
        )}

        <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b bg-slate-50 px-5 py-5 sm:px-6">
            <h2 className="text-xl font-semibold text-gray-900">Detailed plan comparison</h2>
            <p className="mt-1 text-sm text-gray-600">
              Features marked “Coming soon” are roadmap items and are not presented as currently available.
            </p>
            <div className="mt-3 flex flex-wrap gap-3 text-xs">
              <span className="inline-flex items-center gap-1.5 text-emerald-700"><Check className="h-3.5 w-3.5" /> Included</span>
              <span className="inline-flex items-center gap-1.5 text-slate-600"><Check className="h-3.5 w-3.5" /> Limited or plan-specific</span>
              <span className="inline-flex items-center gap-1.5 text-amber-700"><Clock3 className="h-3.5 w-3.5" /> Coming soon</span>
              <span className="inline-flex items-center gap-1.5 text-purple-700">Custom enterprise terms</span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-[1040px] w-full border-collapse text-sm">
              <thead>
                <tr className="border-b bg-white">
                  <th className="sticky left-0 z-10 min-w-64 bg-white px-5 py-4 text-left font-semibold text-gray-900">
                    Capability
                  </th>
                  {planEntries.map(([key, plan]) => (
                    <th
                      key={key}
                      className={`min-w-36 px-4 py-4 text-left font-semibold ${
                        key === "growth" ? "bg-blue-50 text-blue-800" : "text-gray-900"
                      }`}
                    >
                      {plan.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {comparisonSections.map((section) => (
                  <FragmentRows key={section.title} section={section} planEntries={planEntries} />
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="mt-6 rounded-xl border border-blue-100 bg-blue-50 px-5 py-4 text-sm text-blue-900">
          Credits are usage units for RiskShield AI checks. Cached duplicate results may be returned without repeating the underlying check. Starter, Growth, and Scale are recurring subscriptions, activated automatically after the Creem webhook is processed.
        </section>
      </main>

      <footer className="border-t bg-white px-4 py-6 text-sm text-gray-500 sm:px-6">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p>&copy; {new Date().getFullYear()} RiskShield AI</p>
          <div className="flex flex-wrap items-center gap-4">
            <Link href="/privacy" className="hover:text-gray-900">Privacy Policy</Link>
            <Link href="/terms" className="hover:text-gray-900">Terms of Service</Link>
            <a href="mailto:support@574269.xyz" className="hover:text-gray-900">support@574269.xyz</a>
          </div>
        </div>
      </footer>
    </div>
  );
}

function FragmentRows({
  section,
  planEntries,
}: {
  section: ComparisonSection;
  planEntries: [PlanKey, typeof plans[PlanKey]][];
}) {
  return (
    <>
      <tr>
        <th
          colSpan={planEntries.length + 1}
          className="border-b border-t bg-slate-100 px-5 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-600"
        >
          {section.title}
        </th>
      </tr>
      {section.rows.map((row) => (
        <tr key={row.label} className="border-b border-gray-100 last:border-0 hover:bg-gray-50/60">
          <th className="sticky left-0 z-10 bg-white px-5 py-3.5 text-left text-sm font-medium text-gray-700">
            {row.label}
          </th>
          {planEntries.map(([key]) => (
            <td key={key} className={`px-4 py-3.5 align-middle ${key === "growth" ? "bg-blue-50/50" : ""}`}>
              <AvailabilityCell value={row.values[key]} />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}
