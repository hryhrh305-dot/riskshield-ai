"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  CheckCircle2,
  ClipboardCheck,
  FileCheck2,
  Layers3,
  LogOut,
  Menu,
  ShieldCheck,
  Sparkles,
  TableProperties,
  Users,
  X,
} from "lucide-react";
import { SecwynMark } from "@/components/brand/SecwynMark";
import { createClient } from "@/lib/supabase";

const outcomes = [
  ["Protect campaign economics", "Identify contacts that deserve review or suppression before they consume sending capacity."],
  ["Defend launch decisions", "Keep decision labels, reasons, and evidence together for a clearer approval trail."],
  ["Reduce avoidable rework", "Route uncertain records into a focused Review queue instead of treating every contact the same."],
  ["Standardize client delivery", "Use the same decision language across the Web app, API, Google Sheets, and exported files."],
  ["Preserve human judgment", "Use evidence boundaries and explicit unknowns rather than presenting incomplete signals as certainty."],
  ["Move with control", "Audit up to 5,000 contacts per Web run while keeping individual decisions inspectable."],
] as const;

const icps = [
  ["Outbound agencies", "Add a second-line review before a client campaign is approved to send."],
  ["Deliverability specialists", "Translate available technical signals into an operational decision queue."],
  ["RevOps teams", "Create a repeatable approval step between list preparation and campaign launch."],
  ["Lead-generation firms", "Separate sendable records from those that need review or suppression."],
  ["High-value account teams", "Apply more discipline when each contact and sender relationship carries greater value."],
] as const;

const workflow = [
  ["01", "Bring the list", "Paste contacts or upload CSV, TXT, or XLSX in the Web app; Growth and Scale also support API and Google Sheets workflows."],
  ["02", "Read available signals", "Secwyn evaluates the contact, domain, and infrastructure signals available to the selected workflow."],
  ["03", "Apply one decision model", "Each result is placed in Send, Review, or Suppress using the current Secwyn scoring boundary."],
  ["04", "Inspect the reasons", "Review reason codes, evidence fields, and any signal that could not be confirmed."],
  ["05", "Resolve the Review queue", "Apply operator or client context before approving uncertain contacts."],
  ["06", "Export the decision record", "Download the completed audit for campaign handoff or client delivery without an additional download charge."],
] as const;

const faqs = [
  ["Is Secwyn another email verifier?", "No. Secwyn is a second-line pre-send risk governance layer. It uses available signals to support Send, Review, and Suppress decisions; it does not replace every verification or deliverability tool."],
  ["Does Secwyn guarantee inbox placement?", "No. We do not guarantee inbox placement, delivery, sender reputation, or campaign revenue. Secwyn improves the evidence available before a launch decision."],
  ["What do Send, Review, and Suppress mean?", "Send is the lowest-risk queue, Review needs additional operator judgment, and Suppress identifies contacts that should not proceed without a compelling reason."],
  ["Do Web, API, and Google Sheets return the same decision?", "They use the same canonical decision model and boundaries. Presentation and available fields can differ by surface, but the decision contract remains aligned."],
  ["What counts as one audit?", "One unique contact evaluation consumes one credit. Cached results are still charged because they provide the same usable decision while returning faster."],
  ["Do downloads use additional credits?", "No. Exporting results that have already been audited does not consume an additional credit."],
  ["How does Secwyn handle unknown signals?", "Unknown or unavailable signals stay explicit. Secwyn does not convert missing evidence into a confident claim."],
  ["Are the 50 free checks monthly?", "No. A new account receives 50 one-time checks for evaluation; they are not a recurring monthly allowance."],
  ["Which plans include API and Google Sheets access?", "Growth and Scale include API and Google Sheets access. Business arrangements can be tailored to agreed requirements."],
  ["When does Secwyn use paid vendor data?", "Paid vendor enrichment is used only when the relevant production feature and commercial configuration are enabled. Secwyn does not imply paid-vendor coverage when it was not used."],
] as const;

const queueCards = [
  ["SEND", "0–25", "Proceed under your normal campaign controls.", "rs-badge-allow"],
  ["REVIEW", "26–65", "Resolve uncertainty with operator or client context.", "rs-badge-review"],
  ["SUPPRESS", "66–100", "Hold the contact unless a documented exception is approved.", "rs-badge-block"],
] as const;

export default function HomePageClient() {
  const [user, setUser] = useState<{ email: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const supabase = createClient();
        const { data: { session } } = await supabase.auth.getSession();
        const sessionUser = session?.user || null;
        setUser(sessionUser ? { email: sessionUser.email || "" } : null);
      } catch {
        setUser(null);
      }
      setLoading(false);
    })();
  }, []);

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    setUser(null);
    setMenuOpen(false);
    window.location.href = "/";
  }

  const ctaHref = user ? "/risk-check" : "/signup";

  return (
    <div className="rs-shell overflow-x-hidden">
      <nav className="border-b border-white/10 bg-black/20 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
          <Link href="/" className="flex shrink-0 items-center gap-3" onClick={() => setMenuOpen(false)}>
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/5">
              <SecwynMark className="h-5 w-5 text-white" />
            </span>
            <div>
              <div className="text-sm font-semibold uppercase tracking-[0.22em] text-slate-300">Secwyn</div>
              <div className="text-xs text-slate-500">Pre-Send Risk Governance</div>
            </div>
          </Link>

          <div className="hidden items-center gap-2 md:flex">
            <Link href="#workflow" className="rounded-full px-3 py-2 text-sm text-slate-300 transition hover:bg-white/5 hover:text-white">How it works</Link>
            <Link href="/docs" className="rounded-full px-3 py-2 text-sm text-slate-300 transition hover:bg-white/5 hover:text-white">Docs</Link>
            <Link href="/pricing" className="rounded-full px-3 py-2 text-sm text-slate-300 transition hover:bg-white/5 hover:text-white">Pricing</Link>
            {!loading && (user ? (
              <>
                <Link href="/dashboard" className="rounded-full px-3 py-2 text-sm text-slate-200 transition hover:bg-white/5 hover:text-white">{user.email || "Dashboard"}</Link>
                <button type="button" onClick={handleSignOut} className="rounded-full p-2 text-slate-400 transition hover:bg-white/5 hover:text-white" aria-label="Sign out"><LogOut className="h-4 w-4" /></button>
              </>
            ) : (
              <>
                <Link href="/login" className="rounded-full px-3 py-2 text-sm text-slate-300 transition hover:bg-white/5 hover:text-white">Sign In</Link>
                <Link href="/signup" className="rs-button-primary inline-flex items-center rounded-full px-4 py-2 text-sm font-semibold">Start with 50 Free Checks</Link>
              </>
            ))}
          </div>

          <button type="button" aria-label="Toggle navigation menu" aria-expanded={menuOpen} onClick={() => setMenuOpen((value) => !value)} className="inline-flex items-center justify-center rounded-full border border-white/10 bg-white/5 p-2 text-slate-200 md:hidden">
            {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>

        {menuOpen && (
          <div className="border-t border-white/10 bg-black/60 px-4 py-3 md:hidden">
            <div className="mx-auto max-w-6xl space-y-2">
              <Link href="#workflow" onClick={() => setMenuOpen(false)} className="block rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-200">How it works</Link>
              <Link href="/docs" onClick={() => setMenuOpen(false)} className="block rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-200">Docs</Link>
              <Link href="/pricing" onClick={() => setMenuOpen(false)} className="block rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-200">Pricing</Link>
              {!loading && (user ? (
                <>
                  <Link href="/dashboard" onClick={() => setMenuOpen(false)} className="block rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-200">{user.email || "Dashboard"}</Link>
                  <button type="button" onClick={handleSignOut} className="flex w-full items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-200">Sign Out</button>
                </>
              ) : (
                <>
                  <Link href="/login" onClick={() => setMenuOpen(false)} className="block rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-200">Sign In</Link>
                  <Link href="/signup" onClick={() => setMenuOpen(false)} className="rs-button-primary flex items-center justify-center rounded-2xl px-4 py-3 text-sm font-semibold">Start with 50 Free Checks</Link>
                </>
              ))}
            </div>
          </div>
        )}
      </nav>

      <main className="relative">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-[760px] rs-grid opacity-25" />

        <section className="relative mx-auto grid max-w-6xl gap-12 px-4 pb-20 pt-16 sm:px-6 lg:grid-cols-[minmax(0,1.08fr)_minmax(360px,0.92fr)] lg:items-center lg:pt-24">
          <div className="rs-fade-up">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-300">
              <Sparkles className="h-3.5 w-3.5" /> Second-line pre-send risk governance
            </div>
            <h1 className="rs-marketing-title rs-title-settle max-w-4xl text-4xl font-semibold leading-[1.02] tracking-[-0.05em] text-white sm:text-5xl lg:text-6xl">
              Approve high-value campaigns before the first send.
            </h1>
            <p className="mt-6 max-w-2xl text-base leading-7 text-slate-300 sm:text-lg">
              Secwyn turns available contact, domain, and infrastructure signals into defensible Send, Review, and Suppress decisions—with traceable reasons and client-ready evidence.
            </p>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-400">
              Built for outbound agencies, deliverability specialists, RevOps teams, and operators protecting high-value accounts.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <Link href={ctaHref} className="rs-button-primary rs-link-arrow inline-flex items-center justify-center gap-2 rounded-full px-6 py-3 text-sm font-semibold">Start with 50 Free Checks <ArrowRight className="h-4 w-4" /></Link>
              <Link href="#sample-audit" className="rs-button-secondary rs-link-arrow inline-flex items-center justify-center gap-2 rounded-full px-6 py-3 text-sm font-semibold">View a Sample Audit <FileCheck2 className="h-4 w-4" /></Link>
            </div>
            <p className="mt-3 text-xs text-slate-500">No credit card required. New accounts receive 50 one-time contact checks as a non-recurring evaluation allowance.</p>
          </div>

          <div id="sample-audit" className="rs-panel-strong rs-card-hover rounded-[30px] p-5 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-white/10 pb-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Illustrative sample — not a real customer report</p>
                <h2 className="mt-2 text-xl font-semibold text-white">Northstar Advisory · Q3 Executive Outreach</h2>
              </div>
              <span className="rs-badge-review rounded-full px-3 py-1 text-xs font-semibold">REVIEW</span>
            </div>
            <div className="mt-5 grid grid-cols-3 gap-3">
              {[['SEND', '612'], ['REVIEW', '74'], ['SUPPRESS', '19']].map(([label, value]) => (
                <div key={label} className="rounded-2xl border border-white/10 bg-black/20 p-3 text-center">
                  <div className="text-xl font-semibold text-white">{value}</div><div className="mt-1 text-[10px] tracking-[0.16em] text-slate-500">{label}</div>
                </div>
              ))}
            </div>
            <div className="mt-4 space-y-3">
              <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Decision evidence</p>
                <p className="mt-2 text-sm leading-6 text-slate-200">Available signals support a focused manual review of shared inboxes and records with incomplete domain evidence.</p>
              </div>
              <div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/10 p-4 text-sm leading-6 text-slate-200">
                Recommended next step: resolve the Review queue with account context, document exceptions, then approve the final launch list.
              </div>
            </div>
          </div>
        </section>

        <section className="border-y border-white/10 bg-black/20">
          <div className="mx-auto max-w-6xl px-4 py-14 text-center sm:px-6">
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-slate-500">The decision gap</p>
            <h2 className="rs-marketing-title mt-3 text-3xl font-semibold tracking-[-0.04em] text-white sm:text-4xl">Valid is not a launch decision.</h2>
            <p className="mx-auto mt-4 max-w-3xl text-base leading-7 text-slate-300">A technically acceptable address can still need context. Secwyn adds a consistent governance step between list preparation and campaign approval.</p>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">Business outcomes</p>
            <h2 className="rs-marketing-title mt-3 text-3xl font-semibold tracking-[-0.04em] text-white">Turn list intelligence into a decision your team can explain.</h2>
          </div>
          <div className="rs-stagger mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {outcomes.map(([title, description], index) => (
              <article key={title} className="rs-card rs-card-hover rounded-[26px] p-6">
                <div className="mb-5 flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-sm font-semibold text-slate-200">{index + 1}</div>
                <h3 className="text-lg font-semibold text-white">{title}</h3>
                <p className="mt-3 text-sm leading-6 text-slate-300">{description}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 pb-20 sm:px-6">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">Who it is for</p>
            <h2 className="rs-marketing-title mt-3 text-3xl font-semibold tracking-[-0.04em] text-white">A second line of judgment for teams with more at stake.</h2>
          </div>
          <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {icps.map(([title, description]) => (
              <article key={title} className="rounded-[26px] border border-white/10 bg-black/20 p-6">
                <Users className="h-5 w-5 text-slate-300" />
                <h3 className="mt-5 text-lg font-semibold text-white">{title}</h3>
                <p className="mt-3 text-sm leading-6 text-slate-300">{description}</p>
              </article>
            ))}
          </div>
        </section>

        <section id="workflow" className="border-y border-white/10 bg-black/20">
          <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
            <div className="max-w-3xl">
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">One controlled workflow</p>
              <h2 className="rs-marketing-title mt-3 text-3xl font-semibold tracking-[-0.04em] text-white">From raw list to defensible approval in six steps.</h2>
            </div>
            <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {workflow.map(([step, title, description]) => (
                <article key={step} className="rs-card rounded-[26px] p-6">
                  <p className="text-xs font-semibold tracking-[0.22em] text-slate-500">{step}</p>
                  <h3 className="mt-4 text-lg font-semibold text-white">{title}</h3>
                  <p className="mt-3 text-sm leading-6 text-slate-300">{description}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">Action queues</p>
            <h2 className="rs-marketing-title mt-3 text-3xl font-semibold tracking-[-0.04em] text-white">Decisions built for an operator, not a vanity score.</h2>
          </div>
          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {queueCards.map(([label, range, description, badge]) => (
              <article key={label} className="rs-panel rounded-[26px] p-6">
                <div className="flex items-center justify-between"><span className={`${badge} rounded-full px-3 py-1 text-xs font-semibold`}>{label}</span><span className="font-mono text-sm text-slate-400">{range}</span></div>
                <p className="mt-6 text-sm leading-6 text-slate-300">{description}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="mx-auto grid max-w-6xl gap-6 px-4 pb-20 sm:px-6 lg:grid-cols-2">
          <article className="rs-panel-strong rounded-[30px] p-7">
            <ClipboardCheck className="h-6 w-6 text-slate-200" />
            <h2 className="mt-5 text-2xl font-semibold tracking-[-0.03em] text-white">Professional service value</h2>
            <p className="mt-4 text-sm leading-7 text-slate-300">Secwyn helps specialists turn their review process into a repeatable client deliverable: a prioritized queue, traceable reasons, and a clean audit record that supports a launch conversation.</p>
            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4"><TableProperties className="h-4 w-4" /><p className="mt-3 text-xs text-slate-300">Web, API, and Sheets workflows</p></div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4"><BarChart3 className="h-4 w-4" /><p className="mt-3 text-xs text-slate-300">Inspectable decision queues</p></div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4"><FileCheck2 className="h-4 w-4" /><p className="mt-3 text-xs text-slate-300">Client-ready exports</p></div>
            </div>
          </article>
          <article className="rs-panel rounded-[30px] p-7">
            <ShieldCheck className="h-6 w-6 text-slate-200" />
            <h2 className="mt-5 text-2xl font-semibold tracking-[-0.03em] text-white">Evidence boundary</h2>
            <p className="mt-4 text-sm leading-7 text-slate-300">Secwyn reports what the available evidence supports. It keeps unknown signals visible, distinguishes cached results, and does not present unqueried paid-vendor data or future features as current facts.</p>
            <ul className="mt-6 space-y-3 text-sm text-slate-300">
              {[
                "No inbox-placement or revenue guarantees",
                "No hidden conversion of missing evidence into certainty",
                "No claim that a paid vendor was queried unless it was actually used",
              ].map((item) => <li key={item} className="flex gap-3"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />{item}</li>)}
            </ul>
          </article>
        </section>

        <section className="mx-auto max-w-5xl px-4 pb-20 sm:px-6">
          <div className="text-center">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">FAQ</p>
            <h2 className="rs-marketing-title mt-3 text-3xl font-semibold tracking-[-0.04em] text-white">What a defensible pre-send audit does—and does not do.</h2>
          </div>
          <div className="mt-10 space-y-3">
            {faqs.map(([question, answer]) => (
              <details key={question} className="rs-card group rounded-[22px] p-5">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold text-white"><span>{question}</span><span className="text-xl font-light text-slate-400 group-open:rotate-45">+</span></summary>
                <p className="mt-4 max-w-4xl text-sm leading-7 text-slate-300">{answer}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 pb-20 sm:px-6">
          <div className="rs-panel-strong rounded-[32px] px-6 py-11 text-center sm:px-10">
            <Layers3 className="mx-auto h-7 w-7 text-slate-300" />
            <h2 className="rs-marketing-title mt-5 text-3xl font-semibold tracking-[-0.04em] text-white">Put a governed decision between list preparation and launch.</h2>
            <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-slate-300">Start with 50 one-time credits, then choose the monthly capacity that fits your audit workflow.</p>
            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <Link href={ctaHref} className="rs-button-primary inline-flex items-center justify-center gap-2 rounded-full px-6 py-3 text-sm font-semibold">Start with 50 Free Checks <ArrowRight className="h-4 w-4" /></Link>
              <Link href="/pricing" className="rs-button-secondary inline-flex items-center justify-center gap-2 rounded-full px-6 py-3 text-sm font-semibold">Compare Plans</Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-white/10 bg-black/30 px-4 py-8 text-sm text-slate-400 sm:px-6">
        <div className="mx-auto flex max-w-6xl flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div><p className="font-semibold text-slate-200">Secwyn</p><p className="mt-1 text-xs">Second-line pre-send risk governance.</p></div>
          <div className="flex flex-wrap items-center gap-4">
            <Link href="/docs" className="transition hover:text-white">Docs</Link>
            <Link href="/pricing" className="transition hover:text-white">Pricing</Link>
            <Link href="/privacy" className="transition hover:text-white">Privacy</Link>
            <Link href="/terms" className="transition hover:text-white">Terms</Link>
            <a href="mailto:support@secwyn.com" className="transition hover:text-white">support@secwyn.com</a>
          </div>
        </div>
        <p className="mx-auto mt-6 max-w-6xl text-xs text-slate-500">© {new Date().getFullYear()} Secwyn. Decisions remain subject to the evidence available at audit time.</p>
      </footer>
    </div>
  );
}
