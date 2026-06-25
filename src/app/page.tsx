"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  Code,
  Globe,
  LogOut,
  Menu,
  Shield,
  Sparkles,
  X,
  Zap,
} from "lucide-react";
import { createClient } from "@/lib/supabase";

const features = [
  {
    icon: Shield,
    title: "Deep email trust signals",
    desc: "Score inbox quality with disposable detection, mailbox response, DNS posture, and suspicious address patterns.",
  },
  {
    icon: Globe,
    title: "Risky domains and IPs",
    desc: "Combine domain age, company context, geolocation, hosting signals, and proxy detection before a bad lead enters your funnel.",
  },
  {
    icon: Zap,
    title: "Bulk screening that stays usable",
    desc: "Upload CSV, TXT, or XLSX lists, review decisions fast, and export clean routing-ready results without leaving your workflow.",
  },
];

const differentiators = [
  {
    title: "More than bounce checking",
    desc: "RiskShield AI reads email quality as part of a wider customer trust decision, not just as a binary deliverable or invalid test.",
  },
  {
    title: "Built for operators and developers",
    desc: "Use the dashboard for fast reviews, then move the same checks into forms, onboarding, or campaign workflows through API access.",
  },
  {
    title: "Designed for cost discipline",
    desc: "The product prioritizes practical signals, cache-friendly flows, and paid depth only where higher-confidence decisions need it.",
  },
];

const trustPoints = [
  "Disposable email detection",
  "Invalid inbox and MX validation",
  "Suspicious domain and DNS checks",
  "Email plus IP risk review",
];

const livePreview = {
  email: "procurement@fastbuyer-example.co",
  score: 74,
  decision: "REVIEW",
  reason: "New domain, weak DNS posture, and shared-inbox pattern detected.",
  summary:
    "The address is technically reachable, but the supporting domain signals suggest extra review before sales outreach or access approval.",
  action: "Route to manual review before activation",
};

export default function Home() {
  const [user, setUser] = useState<{ email: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const supabase = createClient();
        const {
          data: { session },
        } = await supabase.auth.getSession();
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
  const ctaLabel = user ? "Open Risk Check" : "Start Free Scan";

  return (
    <div className="rs-app min-h-screen overflow-x-hidden">
      <nav className="border-b border-white/10 bg-black/20 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
          <Link href="/" className="flex shrink-0 items-center gap-3" onClick={() => setMenuOpen(false)}>
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/5">
              <Shield className="h-5 w-5 text-white" />
            </span>
            <div>
              <div className="text-sm font-semibold uppercase tracking-[0.22em] text-slate-400">RiskShield AI</div>
              <div className="text-xs text-slate-500">Email and IP Risk Intelligence</div>
            </div>
          </Link>

          <div className="hidden items-center gap-3 md:flex">
            <Link href="/docs" className="rounded-full px-3 py-2 text-sm text-slate-300 transition hover:bg-white/5 hover:text-white">
              Docs
            </Link>
            <Link href="/pricing" className="rounded-full px-3 py-2 text-sm text-slate-300 transition hover:bg-white/5 hover:text-white">
              Pricing
            </Link>
            {!loading &&
              (user ? (
                <>
                  <Link href="/dashboard" className="rounded-full px-3 py-2 text-sm text-slate-200 transition hover:bg-white/5 hover:text-white">
                    Dashboard
                  </Link>
                  <button onClick={handleSignOut} className="rounded-full p-2 text-slate-400 transition hover:bg-white/5 hover:text-white" title="Sign Out">
                    <LogOut className="h-4 w-4" />
                  </button>
                </>
              ) : (
                <>
                  <Link href="/login" className="rounded-full px-3 py-2 text-sm text-slate-300 transition hover:bg-white/5 hover:text-white">
                    Sign In
                  </Link>
                  <Link href="/signup" className="rs-button-primary inline-flex items-center rounded-full px-4 py-2 text-sm font-semibold">
                    Start Free
                  </Link>
                </>
              ))}
          </div>

          <button
            type="button"
            aria-label="Toggle navigation menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((v) => !v)}
            className="inline-flex items-center justify-center rounded-full border border-white/10 bg-white/5 p-2 text-slate-200 md:hidden"
          >
            {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>

        {menuOpen && (
          <div className="border-t border-white/10 bg-black/60 px-4 py-3 md:hidden">
            <div className="mx-auto max-w-6xl space-y-2">
              <Link href="/docs" onClick={() => setMenuOpen(false)} className="block rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-200">
                Docs
              </Link>
              <Link href="/pricing" onClick={() => setMenuOpen(false)} className="block rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-200">
                Pricing
              </Link>
              {!loading &&
                (user ? (
                  <>
                    <Link href="/dashboard" onClick={() => setMenuOpen(false)} className="block rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-200">
                      Dashboard
                    </Link>
                    <button
                      onClick={handleSignOut}
                      className="flex w-full items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-slate-200"
                    >
                      Sign Out
                    </button>
                  </>
                ) : (
                  <>
                    <Link href="/login" onClick={() => setMenuOpen(false)} className="block rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-200">
                      Sign In
                    </Link>
                    <Link href="/signup" onClick={() => setMenuOpen(false)} className="rs-button-primary flex items-center justify-center rounded-2xl px-4 py-3 text-sm font-semibold">
                      Start Free
                    </Link>
                  </>
                ))}
            </div>
          </div>
        )}
      </nav>

      <main className="relative">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-[720px] rs-grid opacity-20" />

        <section className="relative mx-auto grid max-w-6xl gap-10 px-4 pb-16 pt-14 sm:px-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(340px,460px)] lg:items-center lg:gap-14 lg:pb-24 lg:pt-24">
          <div>
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/15 px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-slate-300">
              <Sparkles className="h-3.5 w-3.5 text-white" />
              AI Email Risk Intelligence Platform
            </div>

            <h1 className="max-w-4xl text-4xl font-semibold leading-[1.02] tracking-[-0.05em] text-white sm:text-5xl lg:text-6xl">
              Stop risky emails before they cost you money.
            </h1>

            <p className="mt-6 max-w-2xl text-base leading-7 text-slate-300 sm:text-lg">
              RiskShield AI detects disposable emails, fake signups, invalid inboxes, risky domains, and deliverability issues before they damage your funnel.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
              <Link href={ctaHref} className="rs-button-primary inline-flex items-center justify-center gap-2 rounded-full px-6 py-3 text-sm font-semibold">
                {ctaLabel}
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link href="/risk-check" className="rs-button-secondary inline-flex items-center justify-center gap-2 rounded-full px-6 py-3 text-sm font-semibold">
                View Live Demo
                <Code className="h-4 w-4" />
              </Link>
            </div>

            <p className="mt-3 text-sm text-slate-400">No credit card required. Free checks included.</p>

            <div className="mt-10 grid gap-3 sm:grid-cols-2">
              {trustPoints.map((point) => (
                <div key={point} className="flex items-center gap-3 rounded-2xl border border-white/10 px-4 py-3 text-sm text-slate-200">
                  <CheckCircle2 className="h-4 w-4 text-white" />
                  <span>{point}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="rs-panel-strong rounded-[28px] p-5 sm:p-6">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Live Scan Preview</p>
                <h2 className="mt-2 text-xl font-semibold text-white">Decision desk</h2>
              </div>
              <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-300">
                {livePreview.decision}
              </span>
            </div>

            <div className="mt-5 space-y-5">
              <div className="rounded-[24px] border border-white/10 bg-black/30 p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Email</p>
                    <p className="mt-2 break-all text-sm text-slate-200">{livePreview.email}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Risk Score</p>
                    <p className="rs-metric-value mt-2 text-5xl font-semibold text-white">{livePreview.score}</p>
                  </div>
                </div>

                <div className="mt-5 h-2 rounded-full bg-white/10">
                  <div className="h-2 rounded-full bg-amber-400" style={{ width: "74%" }} />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-4">
                  <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Reason</p>
                  <p className="mt-3 text-sm leading-6 text-slate-200">{livePreview.reason}</p>
                </div>
                <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-4">
                  <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Recommended Action</p>
                  <p className="mt-3 text-sm leading-6 text-slate-200">{livePreview.action}</p>
                </div>
              </div>

              <div className="rounded-[24px] border border-blue-500/20 bg-blue-500/10 p-4">
                <p className="text-xs uppercase tracking-[0.22em] text-blue-200">AI Risk Summary</p>
                <p className="mt-3 text-sm leading-6 text-slate-100">{livePreview.summary}</p>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
          <div className="grid gap-6 md:grid-cols-3">
            {features.map((feature) => (
              <article key={feature.title} className="rs-panel rounded-[28px] p-6">
                <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/5">
                  <feature.icon className="h-5 w-5 text-white" />
                </div>
                <h3 className="text-lg font-semibold text-white">{feature.title}</h3>
                <p className="mt-3 text-sm leading-6 text-slate-300">{feature.desc}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <div className="mb-8 max-w-2xl">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">Why teams switch</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-white">A control layer for customer quality, not just another validator.</h2>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            {differentiators.map((item) => (
              <article key={item.title} className="rounded-[28px] border border-white/10 bg-black/20 p-6">
                <p className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-500">{item.title}</p>
                <p className="mt-4 text-sm leading-6 text-slate-300">{item.desc}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 pb-20 sm:px-6">
          <div className="rs-panel-strong rounded-[32px] px-6 py-10 text-center sm:px-10">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">Start with real checks</p>
            <h2 className="mt-4 text-3xl font-semibold tracking-[-0.04em] text-white">Run your first scan before the next risky signup lands.</h2>
            <p className="mx-auto mt-4 max-w-2xl text-sm leading-6 text-slate-300 sm:text-base">
              Free checks for quick evaluation, deeper plans for bulk cleanup, API workflows, and operational protection when your funnel grows.
            </p>

            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <Link href={ctaHref} className="rs-button-primary inline-flex items-center justify-center gap-2 rounded-full px-6 py-3 text-sm font-semibold">
                {ctaLabel}
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link href="/pricing" className="rs-button-secondary inline-flex items-center justify-center gap-2 rounded-full px-6 py-3 text-sm font-semibold">
                Compare Plans
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-white/10 bg-black/30 px-4 py-8 text-sm text-slate-400 sm:px-6">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <p>&copy; {new Date().getFullYear()} RiskShield AI. Email and IP Risk Intelligence.</p>
          <div className="flex flex-wrap items-center gap-4">
            <Link href="/privacy" className="transition hover:text-white">Privacy Policy</Link>
            <Link href="/terms" className="transition hover:text-white">Terms of Service</Link>
            <a href="mailto:support@574269.xyz" className="transition hover:text-white">support@574269.xyz</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
