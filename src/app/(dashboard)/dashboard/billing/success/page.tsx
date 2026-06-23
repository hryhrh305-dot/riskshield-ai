"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Clock3, Shield } from "lucide-react";
import { createClient } from "@/lib/supabase";

type BillingState = "loading" | "active" | "syncing" | "error";

type ProfileRow = {
  plan: string;
  subscription_status: string;
  credits_remaining: number | null;
};

export default function BillingSuccessPage() {
  const [state, setState] = useState<BillingState>("loading");
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let mounted = true;

    async function loadBillingState() {
      try {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          if (mounted) {
            setState("error");
            setMessage("Please sign in again to review your billing status.");
          }
          return;
        }

        const [{ data: profileRow }, { data: paymentRow }] = await Promise.all([
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
        ]);

        if (!mounted) return;

        setProfile(profileRow || null);

        const isActivePaidPlan =
          !!profileRow &&
          ["starter", "growth", "scale"].includes(profileRow.plan) &&
          profileRow.subscription_status === "active";

        if (isActivePaidPlan) {
          setState("active");
          return;
        }

        if (paymentRow?.status === "completed" || paymentRow?.status === "pending") {
          setState("syncing");
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

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-4 sm:px-6">
          <Link href="/dashboard" className="flex items-center gap-3">
            <Shield className="h-6 w-6 text-blue-600" />
            <span className="text-lg font-bold text-gray-900">RiskShield</span>
          </Link>
          <Link href="/pricing" className="text-sm text-gray-600 hover:text-gray-900">
            Pricing
          </Link>
        </div>
      </header>

      <main className="mx-auto flex max-w-4xl px-4 py-12 sm:px-6">
        <section className="w-full rounded-3xl border border-gray-200 bg-white p-8 shadow-sm">
          {state === "loading" && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 text-blue-700">
                <Clock3 className="h-8 w-8" />
                <h1 className="text-2xl font-semibold text-gray-900">Checking your subscription status</h1>
              </div>
              <p className="text-sm text-gray-600">
                Payment was submitted. We are loading your current plan and credit balance.
              </p>
            </div>
          )}

          {state === "active" && profile && (
            <div className="space-y-5">
              <div className="flex items-center gap-3 text-emerald-700">
                <CheckCircle2 className="h-8 w-8" />
                <h1 className="text-2xl font-semibold text-gray-900">Payment received and subscription activated</h1>
              </div>
              <p className="text-sm text-gray-600">
                Your Creem payment has been processed and the webhook has already activated your subscription.
              </p>
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
            </div>
          )}

          {state === "syncing" && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 text-amber-700">
                <Clock3 className="h-8 w-8" />
                <h1 className="text-2xl font-semibold text-gray-900">Payment completed, subscription is syncing</h1>
              </div>
              <p className="text-sm text-gray-600">
                Payment succeeded. Your subscription will be activated automatically after the Creem webhook finishes syncing.
              </p>
              <div className="rounded-2xl border border-amber-100 bg-amber-50 p-5 text-sm text-amber-900">
                正在同步，请稍后刷新。
              </div>
            </div>
          )}

          {state === "error" && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 text-red-700">
                <Clock3 className="h-8 w-8" />
                <h1 className="text-2xl font-semibold text-gray-900">Unable to load billing status</h1>
              </div>
              <p className="text-sm text-gray-600">{message || "Please refresh and try again."}</p>
            </div>
          )}

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
