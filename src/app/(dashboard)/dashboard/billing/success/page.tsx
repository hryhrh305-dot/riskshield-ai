"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Clock3, Shield } from "lucide-react";
import { createClient } from "@/lib/supabase";
import { getPlanRank, isPlanAtLeast, type PlanKey } from "@/lib/plans";
import { findCreemProductById, hasActiveSubscriptionAccess } from "@/lib/creem";

type BillingState = "loading" | "active" | "syncing" | "error";

type ProfileRow = {
  plan: string;
  subscription_status: string;
  credits_remaining: number | null;
};

type PaymentRow = {
  status: string;
  plan: string | null;
};

type SubscriptionRow = {
  status: string;
  current_period_end: string | null;
  cancelled_at: string | null;
  provider_product_id: string | null;
};

const BANNER_COPY: Record<
  BillingState,
  { title: string; description: string; tone: "blue" | "emerald" | "amber" | "red" }
> = {
  loading: {
    title: "Checking your subscription status",
    description: "Payment was submitted. We are loading your current plan and credit balance.",
    tone: "blue",
  },
  active: {
    title: "Payment received and subscription activated",
    description: "Your Creem payment has been processed and the webhook has already activated your subscription.",
    tone: "emerald",
  },
  syncing: {
    title: "Payment completed, subscription is syncing",
    description: "Payment succeeded. Your subscription will be activated automatically after the Creem webhook finishes syncing.",
    tone: "amber",
  },
  error: {
    title: "Unable to load billing status",
    description: "Please refresh and try again.",
    tone: "red",
  },
};

function toPlanKey(plan: string | null | undefined): PlanKey | null {
  if (!plan) return null;
  const normalized = plan.toLowerCase();
  if (normalized === "free" || normalized === "starter" || normalized === "growth" || normalized === "scale" || normalized === "business") {
    return normalized;
  }
  return null;
}

export default function BillingSuccessPage() {
  const [state, setState] = useState<BillingState>("loading");
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [payment, setPayment] = useState<PaymentRow | null>(null);
  const [subscription, setSubscription] = useState<SubscriptionRow | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let mounted = true;

    async function loadBillingState() {
      try {
        const supabase = createClient();
        const {
          data: { session },
        } = await supabase.auth.getSession();
        const user = session?.user;

        if (!user) {
          if (mounted) {
            setState("error");
            setMessage("Please sign in again to review your billing status.");
          }
          return;
        }

        const rawQuery = window.location.search.replace(/^\?/, "");
        if (rawQuery && rawQuery.includes("signature=") && rawQuery.includes("checkout_id=")) {
          try {
            await fetch("/api/payment/confirm-redirect", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              credentials: "include",
              body: JSON.stringify({ rawQuery }),
            });
          } catch {}
        }

        const [{ data: profileRow }, { data: paymentRow }, { data: subscriptionRow }] = await Promise.all([
          supabase
            .from("profiles")
            .select("plan, subscription_status, credits_remaining")
            .eq("id", user.id)
            .maybeSingle(),
          supabase
            .from("payments")
            .select("status, plan, created_at")
            .eq("user_id", user.id)
            .eq("provider", "creem")
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle(),
          supabase
            .from("subscriptions")
            .select("status, current_period_end, cancelled_at, provider_product_id, created_at")
            .eq("user_id", user.id)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle(),
        ]);

        if (!mounted) return;

        setProfile(profileRow || null);
        setPayment(paymentRow || null);
        setSubscription(subscriptionRow || null);

        const currentPlan = profileRow?.plan || "free";
        const currentStatus = profileRow?.subscription_status || "inactive";
        const purchasedPlan = toPlanKey(paymentRow?.plan);
        const currentRank = getPlanRank(currentPlan);
        const purchasedRank = purchasedPlan ? getPlanRank(purchasedPlan) : 0;
        const alreadyHasEqualOrHigherAccess = isPlanAtLeast(currentPlan, purchasedPlan || "starter");
        const isActive = hasActiveSubscriptionAccess(currentStatus, subscriptionRow?.current_period_end || null);

        if (isActive && paymentRow?.status === "completed" && alreadyHasEqualOrHigherAccess) {
          setState("active");
          return;
        }

        if (isActive && currentRank > purchasedRank) {
          setState("active");
          return;
        }

        if (paymentRow?.status === "completed" || paymentRow?.status === "pending") {
          if (isActive || alreadyHasEqualOrHigherAccess) {
            setState("active");
            return;
          }
          setState("syncing");
          return;
        }

        if (isActive && currentRank >= 1) {
          setState("active");
          return;
        }

        setState("syncing");
      } catch (error) {
        console.error("Billing success page error:", error);
        if (mounted) {
          setState("error");
          setMessage("We could not load your billing status right now.");
        }
      }
    }

    loadBillingState();
    return () => {
      mounted = false;
    };
  }, []);

  const banner = BANNER_COPY[state];
  const isHigherTierAlreadyActive =
    profile && payment?.plan && getPlanRank(profile.plan) > getPlanRank(payment.plan);
  const billingInterval = findCreemProductById(subscription?.provider_product_id || null)?.billingInterval || null;
  const isCancelingAtPeriodEnd =
    subscription?.status === "active" &&
    !!subscription?.cancelled_at &&
    !!subscription?.current_period_end &&
    new Date(subscription.current_period_end) > new Date();

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-4 sm:px-6">
          <Link href="/dashboard" className="flex items-center gap-3">
            <Shield className="h-6 w-6 text-blue-600" />
            <span className="text-lg font-bold text-gray-900">RiskShield AI</span>
          </Link>
          <Link href="/pricing" className="text-sm text-gray-600 hover:text-gray-900">
            Pricing
          </Link>
        </div>
      </header>

      <main className="mx-auto flex max-w-4xl px-4 py-12 sm:px-6">
        <section className="w-full rounded-3xl border border-gray-200 bg-white p-8 shadow-sm">
          <div
            className={`space-y-4 ${
              banner.tone === "emerald"
                ? "text-emerald-700"
                : banner.tone === "amber"
                  ? "text-amber-700"
                  : banner.tone === "red"
                    ? "text-red-700"
                    : "text-blue-700"
            }`}
          >
            <div className="flex items-center gap-3">
              {state === "active" ? <CheckCircle2 className="h-8 w-8" /> : <Clock3 className="h-8 w-8" />}
              <h1 className="text-2xl font-semibold text-gray-900">{banner.title}</h1>
            </div>

            <p className="text-sm text-gray-600">{banner.description}</p>

            {state === "active" && profile && (
              <div className="space-y-4">
                {isHigherTierAlreadyActive && (
                  <div className="rounded-2xl border border-blue-100 bg-blue-50 p-5 text-sm text-blue-900">
                    当前账号已经拥有更高权限，本次付款已记录，不会降级现有计划。
                  </div>
                )}
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-5">
                    <div className="text-xs font-medium uppercase tracking-wide text-emerald-700">Current plan</div>
                    <div className="mt-2 text-2xl font-bold capitalize text-gray-900">{profile.plan}</div>
                  </div>
                  <div className="rounded-2xl border border-blue-100 bg-blue-50 p-5">
                    <div className="text-xs font-medium uppercase tracking-wide text-blue-700">Credits available</div>
                    <div className="mt-2 text-2xl font-bold text-gray-900">
                      {(profile.credits_remaining ?? 0).toLocaleString()}
                    </div>
                  </div>
                </div>
                <div className="rounded-2xl border border-gray-200 bg-gray-50 p-5 text-sm text-gray-700">
                  {billingInterval && (
                    <p>
                      Billing cycle: <span className="font-medium capitalize">{billingInterval}</span>
                    </p>
                  )}
                  {subscription?.current_period_end && (
                    <p className="mt-1">
                      {isCancelingAtPeriodEnd ? "Access ends on" : "Renews on"}{" "}
                      <span className="font-medium">
                        {new Date(subscription.current_period_end).toLocaleDateString()}
                      </span>
                    </p>
                  )}
                </div>
              </div>
            )}

            {state === "syncing" && (
              <div className="rounded-2xl border border-amber-100 bg-amber-50 p-5 text-sm text-amber-900">
                正在同步，请稍后刷新。
              </div>
            )}

            {state === "error" && (
              <p className="text-sm text-gray-600">{message || "Please refresh and try again."}</p>
            )}
          </div>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/dashboard"
              className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
            >
              Back to Dashboard
            </Link>
            <Link
              href="/pricing"
              className="rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50"
            >
              View Plans
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}
