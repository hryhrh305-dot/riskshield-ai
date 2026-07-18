"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, CheckCircle2, Clock3 } from "lucide-react";
import { SecwynMark } from "@/components/brand/SecwynMark";
import { createClient } from "@/lib/supabase";
import { getPlanRank, isPlanAtLeast, type PlanKey } from "@/lib/plans";
import { findCreemProductById, hasActiveSubscriptionAccess } from "@/lib/creem";

type BillingState =
  | "loading"
  | "active"
  | "syncing"
  | "test_redirect_unverified"
  | "test_webhook_pending"
  | "test_provisioning_pending"
  | "test_confirmed"
  | "test_failed"
  | "error";

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
  test_redirect_unverified: {
    title: "Test checkout could not be verified",
    description: "The return link could not be verified. No Test or Live billing entitlement was activated from this page.",
    tone: "red",
  },
  test_webhook_pending: {
    title: "Test payment received — webhook confirmation pending",
    description: "The signed Test return was verified. Secwyn is waiting for the authoritative Test webhook before recording the isolated subscription evidence.",
    tone: "amber",
  },
  test_provisioning_pending: {
    title: "Test webhook received — isolated records are still syncing",
    description: "The Test payment was recorded, but the isolated subscription and evidence-only credit grant are not both confirmed yet.",
    tone: "amber",
  },
  test_confirmed: {
    title: "Test billing flow confirmed",
    description: "The Test payment, isolated subscription, and evidence-only credit grant are confirmed without changing Live access or credits.",
    tone: "blue",
  },
  test_failed: {
    title: "Test billing flow needs review",
    description: "The Test payment did not reach a confirmed isolated state. No Live entitlement was activated from this page.",
    tone: "red",
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
            const redirectResponse = await fetch("/api/payment/confirm-redirect", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              credentials: "include",
              body: JSON.stringify({ rawQuery }),
            });
            const redirectResult = await redirectResponse.json().catch(() => null);
            if (redirectResult?.billingEnvironment === "test_canary") {
              const testState: BillingState = redirectResult.testStatus === "confirmed"
                ? "test_confirmed"
                : redirectResult.testStatus === "provisioning_pending"
                  ? "test_provisioning_pending"
                  : redirectResult.testStatus === "webhook_pending"
                    ? "test_webhook_pending"
                    : redirectResult.testStatus === "failed"
                      ? "test_failed"
                      : "test_redirect_unverified";
              if (mounted) setState(testState);
              return;
            }
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
    <div className="rs-shell">
      <header className="border-b border-white/10 bg-black/20 backdrop-blur-xl">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4 sm:px-6">
          <Link href="/" className="flex items-center gap-3">
            <div className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/5">
              <SecwynMark className="h-5 w-5 text-white" />
            </div>
            <span className="text-lg font-semibold text-white">Secwyn</span>
          </Link>
          <Link href="/pricing" className="text-sm text-slate-400 transition hover:text-white">
            Pricing
          </Link>
        </div>
      </header>

      <main className="mx-auto flex max-w-5xl px-4 py-10 sm:px-6">
        <section className="rs-card rs-fade-up w-full rounded-[32px] p-6 sm:p-8">
          <div
            className={`space-y-4 ${
              banner.tone === "emerald"
                ? "text-emerald-300"
                : banner.tone === "amber"
                  ? "text-amber-300"
                  : banner.tone === "red"
                    ? "text-red-300"
                    : "text-slate-200"
            }`}
          >
            <div className="flex items-center gap-3">
              {state === "active" ? <CheckCircle2 className="h-8 w-8" /> : <Clock3 className="h-8 w-8" />}
              <h1 className="rs-title-settle text-2xl font-semibold text-white sm:text-3xl">{banner.title}</h1>
            </div>

            <p className="max-w-2xl text-sm text-slate-400">{banner.description}</p>

            {state === "active" && profile && (
              <div className="space-y-4">
                {isHigherTierAlreadyActive && (
                  <div className="rounded-[24px] border border-white/10 bg-white/[0.035] p-5 text-sm text-slate-300">
                    Your account already has a higher access tier. This payment was recorded without downgrading the existing plan.
                  </div>
                )}
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="rounded-[24px] border border-emerald-500/15 bg-emerald-500/8 p-5">
                    <div className="text-xs font-medium uppercase tracking-[0.22em] text-emerald-300">Current plan</div>
                    <div className="mt-2 text-2xl font-semibold capitalize text-white">{profile.plan}</div>
                  </div>
                  <div className="rounded-[24px] border border-white/10 bg-white/[0.035] p-5">
                    <div className="text-xs font-medium uppercase tracking-[0.22em] text-slate-400">Credits available</div>
                    <div className="mt-2 text-2xl font-semibold text-white">
                      {(profile.credits_remaining ?? 0).toLocaleString()}
                    </div>
                  </div>
                </div>
                <div className="rounded-[24px] border border-white/10 bg-black/25 p-5 text-sm text-slate-300">
                  {billingInterval && (
                    <p>
                      Billing cycle: <span className="font-medium capitalize text-white">{billingInterval}</span>
                    </p>
                  )}
                  {subscription?.current_period_end && (
                    <p className="mt-1">
                      {isCancelingAtPeriodEnd ? "Access ends on" : "Renews on"}{" "}
                      <span className="font-medium text-white">
                        {new Date(subscription.current_period_end).toLocaleDateString()}
                      </span>
                    </p>
                  )}
                </div>
              </div>
            )}

            {state === "syncing" && (
              <div className="rounded-[24px] border border-amber-500/20 bg-amber-500/10 p-5 text-sm text-amber-200">
                We are still syncing your subscription. Please refresh in a moment.
              </div>
            )}

            {state.startsWith("test_") && (
              <div className="rounded-[24px] border border-sky-500/20 bg-sky-500/10 p-5 text-sm text-sky-200">
                No live plan, credit balance, referral reward, or production billing record was changed.
              </div>
            )}

            {state === "error" && (
              <div className="rounded-[24px] border border-red-500/20 bg-red-500/10 p-5 text-sm text-red-200">
                {message || "Please refresh and try again."}
              </div>
            )}
          </div>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/dashboard"
              className="rs-button-primary rs-link-arrow inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-medium"
            >
              Back to Dashboard <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/pricing"
              className="rs-button-secondary inline-flex min-h-11 items-center justify-center rounded-full px-5 py-3 text-sm font-medium"
            >
              View Plans
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}
