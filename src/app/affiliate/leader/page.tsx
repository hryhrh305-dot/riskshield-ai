import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { affiliateFlagEnabled } from "@/modules/affiliate";
import {
  loadAffiliateLeaderSummary,
  loadAffiliateMembership,
  requireAffiliateUser,
} from "@/modules/affiliate/application/server";

export const metadata: Metadata = {
  title: "Affiliate Team | Secwyn",
  robots: { index: false, follow: false },
};

function formatUsd(minor: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(Number(BigInt(minor)) / 100);
}

export default async function AffiliateLeaderPage() {
  if (!affiliateFlagEnabled(process.env, "AFFILIATE_TEAM_REWARDS")) notFound();

  let user;
  try {
    user = await requireAffiliateUser();
  } catch {
    redirect("/login?next=/affiliate/leader");
  }

  const membership = await loadAffiliateMembership(user.id);
  if (!membership || membership.status !== "approved") notFound();
  const team = await loadAffiliateLeaderSummary(membership.id);
  if (!team) notFound();

  return (
    <main className="mx-auto min-h-screen max-w-6xl px-6 py-12 text-slate-900 dark:text-slate-100">
      <p className="text-xs font-semibold uppercase tracking-[.25em]">Leader workspace</p>
      <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl font-semibold">{team.name}</h1>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
            Direct-team aggregates only. Customer, KYC, payout and downstream referral data are never shown here.
          </p>
        </div>
        <Link className="rounded-full border border-slate-300 px-4 py-2 text-sm dark:border-slate-700" href="/affiliate/portal">
          Affiliate portal
        </Link>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        <section className="rounded-3xl border border-slate-300 p-6 dark:border-slate-700">
          <p className="text-sm text-slate-500">Team status</p>
          <p className="mt-2 text-2xl font-semibold capitalize">{team.status}</p>
        </section>
        <section className="rounded-3xl border border-slate-300 p-6 dark:border-slate-700">
          <p className="text-sm text-slate-500">Direct active members</p>
          <p className="mt-2 text-2xl font-semibold">{team.directActiveMembers}</p>
        </section>
        <section className="rounded-3xl border border-slate-300 p-6 dark:border-slate-700">
          <p className="text-sm text-slate-500">Reward state</p>
          <p className="mt-2 text-lg font-semibold">Reconciliation-gated</p>
        </section>
      </div>

      <section className="mt-8 overflow-hidden rounded-3xl border border-slate-300 dark:border-slate-700">
        <div className="border-b border-slate-300 px-6 py-4 dark:border-slate-700">
          <h2 className="font-semibold">Recent team performance</h2>
        </div>
        {team.months.length === 0 ? (
          <p className="px-6 py-8 text-sm text-slate-600 dark:text-slate-300">No reconciled team month is available yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="bg-slate-100 dark:bg-slate-900">
                <tr><th className="px-6 py-3">Month</th><th className="px-6 py-3">Qualified direct sales</th><th className="px-6 py-3">Personal independent orders</th></tr>
              </thead>
              <tbody>
                {team.months.map((month) => (
                  <tr key={month.performanceMonth} className="border-t border-slate-200 dark:border-slate-800">
                    <td className="px-6 py-4">{month.performanceMonth}</td>
                    <td className="px-6 py-4">{formatUsd(month.qualifiedSalesMinor)}</td>
                    <td className="px-6 py-4">{month.leaderPersonalIndependentOrders}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
