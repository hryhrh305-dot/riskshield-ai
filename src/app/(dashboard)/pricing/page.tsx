"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Check, Clock3, Minus } from "lucide-react";
import { SecwynMark } from "@/components/brand/SecwynMark";
import { plans, type PlanKey } from "@/lib/plans";
import { getCreemAnnualOffer, getCreemSubscriptionCopy } from "@/lib/creem";
import type { BillingCatalogGeneration } from "@/lib/billing-catalog";
import { createClient } from "@/lib/supabase";

type Availability = "included" | "limited" | "unavailable" | "soon" | "custom";
type BillingInterval = "monthly" | "yearly";
type CheckoutKind = "checkout" | "contact" | "unavailable";
type PublicPricingCatalog = {
  generation: BillingCatalogGeneration;
  purchaseMode: "live" | "canary_locked";
  annualSelfServe: boolean;
  plans: Record<"starter" | "growth" | "scale", {
    monthlyPrice: number;
    annualPrice: number;
    monthlyCredits: number;
    monthlyCheckout: CheckoutKind;
    annualCheckout: CheckoutKind;
  }>;
};

const LEGACY_PUBLIC_CATALOG: PublicPricingCatalog = {
  generation: "legacy",
  purchaseMode: "live",
  annualSelfServe: true,
  plans: {
    starter: { monthlyPrice: 49, annualPrice: 499, monthlyCredits: 500, monthlyCheckout: "unavailable", annualCheckout: "unavailable" },
    growth: { monthlyPrice: 249, annualPrice: 2499, monthlyCredits: 2500, monthlyCheckout: "unavailable", annualCheckout: "unavailable" },
    scale: { monthlyPrice: 1499, annualPrice: 14999, monthlyCredits: 15000, monthlyCheckout: "unavailable", annualCheckout: "unavailable" },
  },
};

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
const unavailable = (): FeatureValue => ({ text: "-", availability: "unavailable" });
const soon = (): FeatureValue => ({ text: "Coming soon", availability: "soon" });
const custom = (text = "Custom"): FeatureValue => ({ text, availability: "custom" });

const planHighlights: Record<PlanKey, string[]> = {
  free: [
    "50 one-time contact checks",
    "Single-contact checks",
    "Base signal score and final decision",
    "Recent audit history",
  ],
  starter: [
    "500 contacts audited / month",
    "Send / Review / Suppress decisions",
    "List audit reports",
    "Basic CSV exports",
  ],
  growth: [
    "2,500 contacts audited / month",
    "Multi-workflow audit reports",
    "Campaign Audit Summary",
    "List Acceptance Decision",
  ],
  scale: [
    "15,000 contacts audited / month",
    "Audit export packs",
    "Higher-volume audit capacity",
    "Everything in Growth",
  ],
  business: [
    "Custom contact capacity",
    "Custom API capacity",
    "Enterprise onboarding",
    "Contact-led requirements review",
  ],
};

const planPositioning: Record<PlanKey, string> = {
  free: "For evaluating Secwyn with a small one-time decision sample.",
  starter: "For one focused campaign or an independent advisory workflow.",
  growth: "For specialists and firms managing multiple audit workflows.",
  scale: "For organizations operating risk review at greater volume.",
  business: "For custom capacity, API requirements, and guided onboarding.",
};

const selfServePaidPlans: PlanKey[] = ["starter", "growth", "scale"];

const comparisonSections: ComparisonSection[] = [
  {
    title: "Audit workflow",
    rows: [
      {
        label: "Included checks",
        values: {
          free: included("50 one-time"),
          starter: included("500/month"),
          growth: included("2,500/month"),
          scale: included("15,000/month"),
          business: custom("Custom"),
        },
      },
      {
        label: "Audit runs per day",
        values: {
          free: included("5/day"),
          starter: included("300/day"),
          growth: included("1,500/day"),
          scale: included("8,000/day"),
          business: custom(),
        },
      },
      {
        label: "Single-contact checks",
        values: {
          free: included(),
          starter: included(),
          growth: included(),
          scale: included(),
          business: included(),
        },
      },
      {
        label: "List audit workflow",
        values: {
          free: unavailable(),
          starter: included(),
          growth: included(),
          scale: included(),
          business: included(),
        },
      },
      {
        label: "Maximum Web contacts per run",
        values: {
          free: included("1"),
          starter: included("500"),
          growth: included("5,000"),
          scale: included("5,000"),
          business: custom("5,000"),
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
        label: "Recent audit history",
        values: {
          free: included(),
          starter: included(),
          growth: included(),
          scale: included(),
          business: included(),
        },
      },
      {
        label: "Extended audit history retention",
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
    title: "Decision signals",
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
    title: "Sender and IP intelligence",
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
        label: "Pre-send workflow",
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
      <span className="inline-flex items-center gap-1.5 text-slate-600">
        <Minus className="h-4 w-4" />
        <span className="sr-only">Not included</span>
      </span>
    );
  }

  if (value.availability === "soon") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/20 bg-amber-400/10 px-2 py-1 text-xs font-medium text-amber-200">
        <Clock3 className="h-3.5 w-3.5" />
        {value.text}
      </span>
    );
  }

  if (value.availability === "custom") {
    return (
      <span className="inline-flex rounded-full border border-white/10 bg-white/5 px-2 py-1 text-xs font-medium text-slate-200">
        {value.text}
      </span>
    );
  }

  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${
      value.availability === "limited" ? "text-slate-300" : "text-emerald-300"
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
  const [copiedContactEmail, setCopiedContactEmail] = useState(false);
  const [publicCatalog, setPublicCatalog] = useState<PublicPricingCatalog | null>(null);

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

  useEffect(() => {
    let mounted = true;
    fetch("/api/pricing-catalog", { cache: "no-store" })
      .then((response) => response.ok ? response.json() : Promise.reject(new Error("PRICING_CATALOG_UNAVAILABLE")))
      .then((data: PublicPricingCatalog) => { if (mounted) setPublicCatalog(data); })
      .catch(() => { if (mounted) setPublicCatalog(LEGACY_PUBLIC_CATALOG); });
    return () => { mounted = false; };
  }, []);

  async function handleCheckout(plan: PlanKey) {
    if (!selfServePaidPlans.includes(plan)) return;
    if (publicCatalog?.purchaseMode === "canary_locked") {
      setCheckoutError("Premium V2 checkout validation is pending. Test checkout not enabled.");
      return;
    }

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

  async function handleCopyContactEmail() {
    try {
      await navigator.clipboard.writeText("support@secwyn.com");
      setCopiedContactEmail(true);
      window.setTimeout(() => setCopiedContactEmail(false), 1800);
    } catch {
      setCheckoutError("Unable to copy support email right now.");
    }
  }

  return (
    <div className="rs-app relative min-h-screen overflow-x-hidden">
      <header className="border-b border-white/10 bg-black/20 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6">
          <Link href="/" className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/5">
              <SecwynMark className="h-5 w-5 text-white" />
            </span>
            <div>
              <div className="text-sm font-semibold uppercase tracking-[0.22em] text-slate-400">Secwyn</div>
              <div className="text-xs text-slate-500">Pre-Send Risk Governance</div>
            </div>
          </Link>
          <Link href="/dashboard" className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-200 transition hover:bg-white/10 hover:text-white">Dashboard</Link>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
        <section className="mx-auto mb-10 max-w-4xl text-center">
          <p className="mb-3 text-sm font-semibold uppercase tracking-[0.22em] text-slate-400">Governance capacity for every operating model</p>
          <h1 className="rs-marketing-title text-4xl font-semibold tracking-[-0.05em] text-white sm:text-5xl">
            Choose the decision capacity your campaign approval workflow needs.
          </h1>
          <p className="mt-4 text-base leading-7 text-slate-300">
            Start with 50 one-time contact audits, then add repeatable list reviews, client-ready evidence, and API or Google Sheets access as your operating model grows.
          </p>
          <p className="mt-4 text-sm text-slate-500">Less than the cost of one wasted campaign launch.</p>
        </section>

        <section className="mb-8 flex justify-center">
          <div className="inline-flex rounded-full border border-white/10 bg-white/5 p-1 shadow-[0_18px_50px_rgba(2,6,23,0.28)]">
            <button
              type="button"
              onClick={() => setBillingInterval("monthly")}
              className={`rounded-full px-5 py-2 text-sm font-semibold transition ${
                billingInterval === "monthly"
                  ? "bg-white text-slate-950"
                  : "text-slate-300 hover:bg-white/10 hover:text-white"
              }`}
            >
              Monthly
            </button>
            <button
              type="button"
              onClick={() => setBillingInterval("yearly")}
              className={`rounded-full px-5 py-2 text-sm font-semibold transition ${
                billingInterval === "yearly"
                  ? "bg-white text-slate-950"
                  : "text-slate-300 hover:bg-white/10 hover:text-white"
              }`}
            >
              Yearly
              <span className={`ml-2 rounded-full px-2 py-0.5 text-xs ${
                billingInterval === "yearly" ? "bg-slate-950/10 text-slate-900" : "bg-emerald-400/10 text-emerald-200"
              }`}>
                Annual billing
              </span>
            </button>
          </div>
        </section>

        <section className="mb-12 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
          {planEntries.map(([key, plan]) => {
            const isPopular = key === "growth";
            const isPaidSelfServe = selfServePaidPlans.includes(key);
            const catalogPlan = publicCatalog && (key === "starter" || key === "growth" || key === "scale") ? publicCatalog.plans[key] : null;
            const annualOffer = getCreemAnnualOffer(key, publicCatalog?.generation ?? "legacy");
            const showYearly = billingInterval === "yearly" && annualOffer !== null;
            const checkoutLoadingKey = isPaidSelfServe ? `${key}:${billingInterval}` : null;
            const checkoutKind = catalogPlan
              ? billingInterval === "yearly" ? catalogPlan.annualCheckout : catalogPlan.monthlyCheckout
              : null;
            const isCanaryCheckoutLocked = publicCatalog?.purchaseMode === "canary_locked"
              && isPaidSelfServe
              && checkoutKind !== "contact";
            const subscriptionCopy = getCreemSubscriptionCopy(billingInterval);
            const displayedPrice = catalogPlan
              ? showYearly && annualOffer ? annualOffer.monthlyEquivalentLabel : `$${catalogPlan.monthlyPrice.toLocaleString("en-US")}`
              : isPaidSelfServe ? "—" : plan.priceLabel;
            const displayedPeriod = "/month";
            const yearlyPriceLabel = showYearly && annualOffer ? annualOffer.yearlyPriceLabel : null;
            const annualDiscountPercentLabel = showYearly && annualOffer ? annualOffer.discountPercentLabel : null;
            const annualSavingsAmountLabel = showYearly && annualOffer ? annualOffer.savingsAmountLabel : null;
            const annualPromoLabel = showYearly && annualOffer ? annualOffer.promoLabel : null;

            return (
              <article
                key={key}
                className={`relative flex min-h-[430px] flex-col rounded-[28px] border p-6 shadow-[0_20px_60px_rgba(2,6,23,0.28)] ${
                  isPopular
                    ? "rs-pricing-growth border-white/15 bg-white/[0.08] text-white ring-1 ring-white/10"
                    : "border-white/10 bg-black/20 text-white"
                }`}
              >
                {plan.badge && (
                  <div className="rs-pricing-popular-badge absolute right-4 top-4 rounded-full border border-white/10 bg-white px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-950">
                    {plan.badge}
                  </div>
                )}

                <div>
                  <h2 className="text-lg font-semibold tracking-[-0.02em]">{plan.name}</h2>
                  <p className={`mt-1 min-h-10 text-sm ${isPopular ? "text-slate-200" : "text-slate-400"}`}>
                    {planPositioning[key]}
                  </p>
                </div>

                <div className="mt-5">
                  <span className="text-4xl font-semibold tracking-[-0.05em]">{displayedPrice}</span>
                  {!plan.contactOnly && key !== "free" && <span className={isPopular ? "text-slate-200" : "text-slate-500"}>{displayedPeriod}</span>}
                  <p className={`mt-2 text-sm font-medium ${isPopular ? "text-slate-100" : "text-slate-300"}`}>
                    {catalogPlan ? `${catalogPlan.monthlyCredits.toLocaleString("en-US")} contacts audited / month` : isPaidSelfServe ? "Loading plan details..." : plan.creditsLabel}
                  </p>
                  {showYearly && annualDiscountPercentLabel && annualSavingsAmountLabel && (
                    <div className={`mt-3 flex flex-wrap gap-2 text-xs font-semibold ${
                      isPopular ? "text-white" : "text-emerald-200"
                    }`}>
                      <span className={`rounded-full px-2.5 py-1 ${
                        isPopular ? "bg-white/15" : "bg-emerald-400/10"
                      }`}>
                        {annualDiscountPercentLabel}
                      </span>
                      <span className={`rounded-full px-2.5 py-1 ${
                        isPopular ? "bg-white/15" : "bg-white/8 text-slate-100"
                      }`}>
                        {annualSavingsAmountLabel}
                      </span>
                      {annualPromoLabel && (
                        <span className={`rounded-full px-2.5 py-1 ${
                          isPopular ? "bg-white/15" : "bg-white/8 text-slate-100"
                        }`}>
                          {annualPromoLabel}
                        </span>
                      )}
                    </div>
                  )}
                  {isPaidSelfServe && (
                    <div className={`mt-3 space-y-1 text-xs ${isPopular ? "text-slate-200" : "text-slate-500"}`}>
                      <p>{subscriptionCopy.subscriptionLabel}</p>
                      <p>{subscriptionCopy.renewalLabel}</p>
                      <p>Cancel anytime</p>
                      {showYearly && yearlyPriceLabel ? (
                        <p>{yearlyPriceLabel}/year billed yearly</p>
                      ) : (
                        <p>{subscriptionCopy.cadenceLabel}</p>
                      )}
                    </div>
                  )}
                </div>

                <p className={`mt-4 text-sm leading-6 ${isPopular ? "text-slate-100" : "text-slate-400"}`}>
                  {plan.description}
                </p>

                <ul className="mt-5 flex-1 space-y-2.5">
                  {(catalogPlan
                    ? [`${catalogPlan.monthlyCredits.toLocaleString("en-US")} contacts audited / month`, ...planHighlights[key].slice(1)]
                    : isPaidSelfServe ? ["Loading plan details..."] : planHighlights[key]
                  ).map((item) => (
                    <li key={item} className={`flex items-start gap-2 text-sm ${isPopular ? "text-slate-100" : "text-slate-300"}`}>
                      <Check className={`mt-0.5 h-4 w-4 shrink-0 ${isPopular ? "text-white" : "text-emerald-300"}`} />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>

                <button
                  type="button"
                  onClick={key === "business" || (catalogPlan && (billingInterval === "yearly" ? catalogPlan.annualCheckout : catalogPlan.monthlyCheckout) === "contact")
                    ? handleCopyContactEmail
                    : () => handleCheckout(key)}
                  disabled={
                    key === "free" ||
                    isCanaryCheckoutLocked ||
                    (isPaidSelfServe && !catalogPlan) ||
                    (key !== "business" && checkoutLoading !== null) ||
                    Boolean(catalogPlan && (billingInterval === "yearly" ? catalogPlan.annualCheckout : catalogPlan.monthlyCheckout) === "unavailable") ||
                    (key !== "business" && key === currentPlan)
                  }
                  className={`mt-6 w-full rounded-full px-4 py-3 text-sm font-semibold transition ${
                    key === "free" || isCanaryCheckoutLocked || (key !== "business" && key === currentPlan) || (key !== "business" && checkoutLoading !== null)
                      ? isPopular
                        ? "cursor-not-allowed bg-white/85 text-slate-950"
                        : "cursor-not-allowed bg-white/10 text-slate-500"
                      : "border border-[#f0b18f]/80 bg-[#f7ba97] text-[#1f140d] shadow-[0_2px_0_rgba(255,255,255,0.14)_inset,0_10px_24px_rgba(247,186,151,0.14)] hover:bg-[#fac6a8] hover:text-[#140d09]"
                  }`}
                >
                  {key === "free"
                    ? currentPlan === "free"
                      ? "Current plan"
                      : "Free plan"
                    : key === "business"
                      ? "Contact sales"
                      : catalogPlan && (billingInterval === "yearly" ? catalogPlan.annualCheckout : catalogPlan.monthlyCheckout) === "contact"
                        ? "Contact sales"
                      : isCanaryCheckoutLocked
                        ? "Checkout validation pending"
                      : catalogPlan && (billingInterval === "yearly" ? catalogPlan.annualCheckout : catalogPlan.monthlyCheckout) === "unavailable"
                        ? "Coming soon"
                      : isPaidSelfServe && !catalogPlan
                        ? "Loading..."
                      : key === currentPlan
                        ? "Current plan"
                        : checkoutLoading === checkoutLoadingKey
                          ? "Redirecting..."
                          : key === "starter"
                            ? "Start Starter"
                            : key === "growth"
                              ? "Start Growth"
                              : "Start Scale"}
                </button>

                {isCanaryCheckoutLocked && (
                  <p className={`mt-3 text-xs ${isPopular ? "text-slate-200" : "text-slate-500"}`}>
                    Test checkout not enabled. No payment will be started during this acceptance stage.
                  </p>
                )}

                {key === "business" && (
                  <p className="mt-3 text-xs text-slate-500">
                    {copiedContactEmail ? "support@secwyn.com copied to clipboard." : "Click to copy support@secwyn.com and contact us for custom terms."}
                  </p>
                )}

                {isPaidSelfServe && (
                  <p className={`mt-3 text-xs ${isPopular ? "text-slate-200" : "text-slate-500"}`}>
                    {billingInterval === "yearly"
                      ? publicCatalog?.purchaseMode === "canary_locked"
                        ? "Billed annually in USD. Credits issued monthly. Auto-renews yearly until canceled."
                        : "Annual subscription billed in USD. Credits are issued monthly. Auto-renews yearly until canceled."
                      : "Monthly subscription. Auto-renews until canceled in the Creem Customer Portal."}
                  </p>
                )}
              </article>
            );
          })}
        </section>

        {checkoutError && (
          <section className="mb-8 rounded-[24px] border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {checkoutError}
          </section>
        )}

        <section className="overflow-hidden rounded-[28px] border border-white/10 bg-black/20 shadow-[0_18px_50px_rgba(2,6,23,0.24)]">
          <div className="border-b border-white/10 bg-white/[0.03] px-5 py-5 sm:px-6">
            <h2 className="text-xl font-semibold text-white">Detailed audit plan comparison</h2>
            <p className="mt-1 text-sm text-slate-400">
              Features marked &quot;Coming soon&quot; are roadmap items and are not presented as currently available.
            </p>
            <div className="mt-3 flex flex-wrap gap-3 text-xs">
              <span className="inline-flex items-center gap-1.5 text-emerald-300"><Check className="h-3.5 w-3.5" /> Included</span>
              <span className="inline-flex items-center gap-1.5 text-slate-300"><Check className="h-3.5 w-3.5" /> Limited or plan-specific</span>
              <span className="inline-flex items-center gap-1.5 text-amber-200"><Clock3 className="h-3.5 w-3.5" /> Coming soon</span>
              <span className="inline-flex items-center gap-1.5 text-slate-200">Custom enterprise terms</span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-[1040px] w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-white/10 bg-black/20">
                  <th className="min-w-64 bg-[var(--rs-bg-elevated)] px-5 py-4 text-left font-semibold text-white sm:sticky sm:left-0 sm:z-10">
                    Capability
                  </th>
                  {planEntries.map(([key, plan]) => (
                    <th
                      key={key}
                      className={`min-w-36 px-4 py-4 text-left font-semibold ${
                        key === "growth" ? "bg-white/[0.07] text-white" : "text-slate-200"
                      }`}
                    >
                      {plan.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {comparisonSections.map((section) => (
                  <FragmentRows key={section.title} section={section} planEntries={planEntries} publicCatalog={publicCatalog} />
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="mt-6 rounded-[24px] border border-white/10 bg-white/[0.05] px-5 py-4 text-sm text-slate-300">
          Credits are usage units for Secwyn audits. Cached results return faster but still consume one credit because they provide the same usable decision. Downloading an already completed audit does not consume another credit. Starter, Growth, and Scale are recurring subscriptions, activated automatically after the Creem webhook is processed.
        </section>

        <section id="payment-faq" className="mt-10 scroll-mt-24" aria-labelledby="payment-faq-heading">
          <div className="mb-5 max-w-3xl">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-400">Billing FAQ</p>
            <h2 id="payment-faq-heading" className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-white sm:text-3xl">
              Paying for Secwyn outside the United States
            </h2>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <details className="rs-card group rounded-[24px] p-5 sm:p-6">
              <summary className="flex cursor-pointer list-none items-start justify-between gap-4 text-base font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/70">
                <span>What currency are Secwyn plans billed in?</span>
                <span aria-hidden="true" className="text-xl leading-none text-slate-400 transition-transform group-open:rotate-45">+</span>
              </summary>
              <div className="mt-4 space-y-3 text-sm leading-6 text-slate-300">
                <p>
                  All Secwyn plans are listed and charged in U.S. dollars (USD). Customers outside the United States, including customers in Europe, can generally pay using supported international cards and any locally available payment methods shown by Creem at checkout.
                </p>
                <p>
                  Payment-method availability can vary by location, billing address, device, product type, and price. If your card or bank account uses another currency, your payment provider may convert the USD charge and may apply its own exchange rate or conversion fee. Secwyn does not set or collect those conversion fees.
                </p>
              </div>
            </details>

            <details className="rs-card group rounded-[24px] p-5 sm:p-6">
              <summary className="flex cursor-pointer list-none items-start justify-between gap-4 text-base font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/70">
                <span>Can customers in Europe pay for Secwyn?</span>
                <span aria-hidden="true" className="text-xl leading-none text-slate-400 transition-transform group-open:rotate-45">+</span>
              </summary>
              <div className="mt-4 space-y-3 text-sm leading-6 text-slate-300">
                <p>
                  Yes. Secwyn uses USD pricing, but eligible customers in Europe can pay through the payment methods available to them in the Creem checkout. You do not need a U.S. bank card or a separate USD account.
                </p>
                <p>
                  Your bank or payment provider may convert the charge into your account currency. The final exchange rate and any conversion fee are determined by that provider. Available payment methods and applicable taxes are confirmed during checkout. Creem handles applicable taxes as the Merchant of Record.
                </p>
              </div>
            </details>

            <details className="rs-card group rounded-[24px] p-5 sm:p-6">
              <summary className="flex cursor-pointer list-none items-start justify-between gap-4 text-base font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/70">
                <span>How does annual billing work?</span>
                <span aria-hidden="true" className="text-xl leading-none text-slate-400 transition-transform group-open:rotate-45">+</span>
              </summary>
              <div className="mt-4 space-y-3 text-sm leading-6 text-slate-300">
                <p>
                  Annual subscriptions are billed once per year in USD. The annual price is 12 months for the price of 11, and the included contact credits are issued monthly from your subscription start date rather than all at once.
                </p>
                <p>
                  Starter and Growth annual checkout may be opened in stages. Scale annual and Business terms are contact-led. An annual subscription auto-renews yearly unless you cancel before renewal.
                </p>
              </div>
            </details>

            <details className="rs-card group rounded-[24px] p-5 sm:p-6">
              <summary className="flex cursor-pointer list-none items-start justify-between gap-4 text-base font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/70">
                <span>What happens when I cancel an annual subscription?</span>
                <span aria-hidden="true" className="text-xl leading-none text-slate-400 transition-transform group-open:rotate-45">+</span>
              </summary>
              <div className="mt-4 space-y-3 text-sm leading-6 text-slate-300">
                <p>
                  A cancellation scheduled for the end of the paid annual term stops renewal while access and monthly credit issuance continue through that term. Refunds, disputes, chargebacks, or immediate termination can stop future credit issuance under the applicable terms.
                </p>
                <p>
                  Ordinary promotional coupons do not stack with Premium V2 annual pricing. Any provider conversion fee is controlled by your bank or payment provider, not Secwyn.
                </p>
              </div>
            </details>
          </div>
        </section>
      </main>

      <footer className="border-t border-white/10 bg-black/30 px-4 py-6 text-sm text-slate-500 sm:px-6">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p>&copy; {new Date().getFullYear()} Secwyn</p>
          <div className="flex flex-wrap items-center gap-4">
            <Link href="/privacy" className="hover:text-white">Privacy Policy</Link>
            <Link href="/terms" className="hover:text-white">Terms of Service</Link>
            <a href="mailto:support@secwyn.com" className="hover:text-white">support@secwyn.com</a>
          </div>
        </div>
      </footer>
    </div>
  );
}

function FragmentRows({
  section,
  planEntries,
  publicCatalog,
}: {
  section: ComparisonSection;
  planEntries: [PlanKey, typeof plans[PlanKey]][];
  publicCatalog: PublicPricingCatalog | null;
}) {
  return (
    <>
      <tr>
        <th
          colSpan={planEntries.length + 1}
          className="border-b border-t border-white/10 bg-white/[0.04] px-5 py-3 text-left text-xs font-bold uppercase tracking-[0.18em] text-slate-400"
        >
          {section.title}
        </th>
      </tr>
      {section.rows.map((row) => (
        <tr key={row.label} className="border-b border-white/8 last:border-0 hover:bg-white/[0.03]">
          <th className="bg-[var(--rs-bg-elevated)] px-5 py-3.5 text-left text-sm font-medium text-slate-200 sm:sticky sm:left-0 sm:z-10">
            {row.label}
          </th>
          {planEntries.map(([key]) => (
            <td key={key} className={`px-4 py-3.5 align-middle ${key === "growth" ? "bg-white/[0.03]" : ""}`}>
              <AvailabilityCell value={
                row.label === "Included checks" && (key === "starter" || key === "growth" || key === "scale")
                  ? publicCatalog
                    ? included(`${publicCatalog.plans[key].monthlyCredits.toLocaleString("en-US")}/month`)
                    : limited("Loading")
                  : row.values[key]
              } />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}
