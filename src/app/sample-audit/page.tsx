import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2, FileCheck2, ShieldCheck } from "lucide-react";
import { SecwynMark } from "@/components/brand/SecwynMark";
import { SampleAuditActions } from "@/components/sample-audit/SampleAuditActions";
import { sampleAuditContacts, type SampleDecision } from "@/lib/sample-audit-data";
import { sampleAuditRiskDrivers, sampleAuditSummary } from "@/lib/sample-audit-summary";

export const metadata: Metadata = {
  title: "Sample Contact Risk Audit | Secwyn",
  description: "Explore a synthetic Secwyn audit with SEND, REVIEW, and SUPPRESS decisions, evidence states, and recommended actions.",
  robots: { index: false, follow: true },
};

const decisionCopy: Record<SampleDecision, { explanation: string; nextStep: string; badge: string }> = {
  SEND: { explanation: "No blocking evidence is present in this synthetic example.", nextStep: "Proceed under normal campaign controls.", badge: "rs-badge-allow" },
  REVIEW: { explanation: "The contact needs operator or account context before approval.", nextStep: "Resolve the reason and document the decision.", badge: "rs-badge-review" },
  SUPPRESS: { explanation: "A hard blocking signal is present in this synthetic example.", nextStep: "Remove or correct the contact before launch.", badge: "rs-badge-block" },
};

export default function SampleAuditPage() {
  return (
    <div className="rs-shell min-h-screen overflow-x-hidden">
      <nav className="border-b border-white/10 bg-black/20 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
          <Link href="/" className="flex items-center gap-3" aria-label="Secwyn home">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/5"><SecwynMark className="h-5 w-5 text-white" /></span>
            <span><span className="block text-sm font-semibold uppercase tracking-[0.22em] text-slate-300">Secwyn</span><span className="block text-xs text-slate-500">Sample contact audit</span></span>
          </Link>
          <div className="flex items-center gap-2">
            <Link href="/pricing" className="rounded-full px-3 py-2 text-sm text-slate-300 transition hover:bg-white/5 hover:text-white">Pricing</Link>
            <Link href="/login" className="rounded-full px-3 py-2 text-sm text-slate-300 transition hover:bg-white/5 hover:text-white">Sign In</Link>
          </div>
        </div>
      </nav>

      <main>
        <section className="relative mx-auto max-w-6xl px-4 pb-16 pt-16 sm:px-6 lg:pt-24">
          <div className="max-w-4xl">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">INTERACTIVE SAMPLE</p>
            <h1 className="rs-marketing-title mt-5 text-4xl font-semibold leading-[1.04] tracking-[-0.045em] text-white sm:text-5xl lg:text-6xl">See what a Secwyn audit delivers before you sign up</h1>
            <p className="mt-6 max-w-3xl text-base leading-7 text-slate-300 sm:text-lg">Explore a synthetic contact list with SEND, REVIEW, and SUPPRESS decisions, evidence states, and recommended actions.</p>
            <div className="mt-6 flex flex-wrap gap-2">
              {["No signup required", "Synthetic data only", "Does not consume credits"].map((tag) => <span key={tag} className="rs-chip rounded-full border px-3 py-1.5 text-xs font-medium">{tag}</span>)}
            </div>
            <div className="mt-8"><SampleAuditActions location="hero" /></div>
            <div className="mt-5 max-w-3xl rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Sample scope notice</p>
              <p className="mt-2 text-xs leading-5 text-slate-300">
                This page is a simplified synthetic demonstration. A real Secwyn audit returns materially more detail, including fuller evidence fields, richer reason context, expanded result packaging, and workflow-ready output for review and export.
              </p>
            </div>
          </div>
        </section>

        <section className="border-y border-white/10 bg-black/20">
          <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Sample Input Reconciliation</p>
            <div className="mt-6 grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
              {[
                ["Input", sampleAuditContacts.length], ["Accepted", sampleAuditContacts.length], ["Rejected", 0], ["Duplicates", 0], ["Unique results", sampleAuditContacts.length], ["Demo credit usage", "None"],
              ].map(([label, value]) => <div key={label} className="rs-card rounded-2xl p-4"><p className="text-xs text-slate-500">{label}</p><p className="mt-2 text-xl font-semibold text-white">{value}</p></div>)}
            </div>
            <p className="mt-4 text-xs leading-5 text-slate-400">A real audit charges one credit for each accepted unique contact. This demonstration does not submit or bill any contact.</p>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <div className="flex items-center gap-3"><FileCheck2 className="h-5 w-5 text-slate-300" /><h2 className="text-2xl font-semibold text-white">Decision Summary</h2></div>
          <div className="mt-7 grid gap-5 md:grid-cols-3">
            {sampleAuditSummary.map(({ decision, count, percentage }) => {
              const copy = decisionCopy[decision];
              return <article key={decision} className="rs-panel rounded-[26px] p-6"><div className="flex items-center justify-between gap-3"><span className={`${copy.badge} rounded-full px-3 py-1 text-xs font-semibold`}>{decision}</span><span className="text-sm text-slate-400">{count} · {percentage}%</span></div><p className="mt-5 text-sm leading-6 text-slate-300">{copy.explanation}</p><p className="mt-3 text-sm font-medium leading-6 text-white">{copy.nextStep}</p></article>;
            })}
          </div>
          <div className="mt-8"><SampleAuditActions location="summary" /></div>
        </section>

        <section className="border-y border-white/10 bg-black/20">
          <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
            <h2 className="text-2xl font-semibold text-white">Top Risk Drivers</h2>
            <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              {sampleAuditRiskDrivers.map((driver) => <div key={driver.label} className="rs-card rounded-2xl p-4"><p className="text-sm font-medium text-white">{driver.label}</p><p className="mt-2 text-xs text-slate-400">{driver.count} synthetic {driver.count === 1 ? "contact" : "contacts"}</p></div>)}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">All 20 synthetic contacts</p>
            <h2 className="mt-3 text-2xl font-semibold text-white">Contact Results</h2>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400">
              This sample keeps the layout intentionally compact. Real audited results in the product are more detailed than this example and include additional evidence, operational context, and export-ready output.
            </p>
          </div>
          <div className="mt-7 grid gap-4 lg:grid-cols-2">
            {sampleAuditContacts.map((contact) => {
              const copy = decisionCopy[contact.decision];
              return (
                <article key={contact.result} className="rs-card rounded-[24px] p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3 border-b border-white/10 pb-4"><div><p className="text-xs uppercase tracking-[0.18em] text-slate-500">Result #{contact.result}</p><p className="mt-2 break-all font-mono text-sm text-white">{contact.email}</p></div><span className={`${copy.badge} rounded-full px-3 py-1 text-xs font-semibold`}>{contact.decision}</span></div>
                  <dl className="mt-4 grid gap-4 sm:grid-cols-2">
                    <div><dt className="text-xs text-slate-500">Score</dt><dd className="mt-1 text-sm font-medium text-white">{contact.score}</dd></div>
                    <div><dt className="text-xs text-slate-500">Primary reason</dt><dd className="mt-1 text-sm leading-6 text-slate-200">{contact.primaryReason}</dd></div>
                    <div><dt className="text-xs text-slate-500">Recommended action</dt><dd className="mt-1 text-sm leading-6 text-slate-200">{contact.recommendedAction}</dd></div>
                    <div><dt className="text-xs text-slate-500">Evidence state</dt><dd className="mt-1 text-sm leading-6 text-slate-200">{contact.evidenceState}</dd></div>
                  </dl>
                </article>
              );
            })}
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 pb-20 sm:px-6">
          <div className="rs-panel-strong rounded-[30px] p-7 sm:p-9">
            <div className="flex items-center gap-3"><ShieldCheck className="h-5 w-5 text-slate-300" /><h2 className="text-2xl font-semibold text-white">Evidence Limitations</h2></div>
            <ul className="mt-6 space-y-4 text-sm leading-6 text-slate-300">
              <li className="flex gap-3"><CheckCircle2 className="mt-1 h-4 w-4 shrink-0" />Domain evidence does not prove that a specific mailbox exists or will accept a message.</li>
              <li className="flex gap-3"><CheckCircle2 className="mt-1 h-4 w-4 shrink-0" />Mailbox evidence does not prove inbox placement, delivery, engagement, or campaign performance.</li>
              <li className="flex gap-3"><CheckCircle2 className="mt-1 h-4 w-4 shrink-0" />Unknown, not-tested, and failed lookups remain limitations and should be reviewed before use.</li>
            </ul>
            <div className="mt-8"><SampleAuditActions location="footer" /></div>
          </div>
        </section>
      </main>
    </div>
  );
}
