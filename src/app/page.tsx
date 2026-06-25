"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Shield, Zap, Code, ArrowRight, Filter, LogOut, Menu, X } from "lucide-react";
import { createClient } from "@/lib/supabase";

const features = [
  { icon: Shield, title: "Customer Health Scoring", desc: "Proprietary 0-100 score combining domain age, DNS health, email trust, IP reputation, and company signals." },
  { icon: Filter, title: "Risk Detection Engine", desc: "Detect disposable emails, invalid mailboxes, proxy/VPN usage, blacklisted domains, and fraud patterns in real time." },
  { icon: Zap, title: "Batch Lead Screening", desc: "Upload CSV/XLSX with thousands of leads. Get risk-scored, health-graded results in seconds. Export ready-to-use lists." },
];

const differentiators = [
  { title: "vs. Email Validators", desc: "They check if an email bounces. We score the entire customer: domain age, company signals, DNS health, IP risk." },
  { title: "vs. Data Brokers", desc: "They sell static databases. We provide real-time risk intelligence you can query at signup, checkout, or campaign launch." },
  { title: "vs. Manual Vetting", desc: "Your team spends hours Googling companies. Our API returns a complete health score in under 2 seconds." },
];

export default function Home() {
  const [user, setUser] = useState<{ email: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    (async () => {
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

  return (
    <div className="min-h-screen bg-gray-50 overflow-x-hidden">
      <nav className="relative border-b border-gray-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
          <Link href="/" className="flex shrink-0 items-center gap-2" onClick={() => setMenuOpen(false)}>
            <Shield className="h-7 w-7 text-blue-600" />
            <span className="text-lg font-bold tracking-tight sm:text-xl">RiskShield AI</span>
          </Link>

          <div className="hidden items-center gap-4 md:flex">
            <Link href="/docs" className="text-sm text-gray-600 hover:text-gray-900">Docs</Link>
            <Link href="/pricing" className="text-sm text-gray-600 hover:text-gray-900">Pricing</Link>
            {!loading && (
              user ? (
                <>
                  <Link href="/dashboard" className="text-sm font-medium text-gray-600 hover:text-gray-900">{user.email}</Link>
                  <button onClick={handleSignOut} className="text-sm text-gray-400 hover:text-red-600" title="Sign Out">
                    <LogOut className="h-4 w-4" />
                  </button>
                </>
              ) : (
                <>
                  <Link href="/login" className="text-sm text-gray-600 hover:text-gray-900">Sign In</Link>
                  <Link href="/signup" className="inline-flex items-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
                    Start Free
                  </Link>
                </>
              )
            )}
          </div>

          <button
            type="button"
            aria-label="Toggle navigation menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((v) => !v)}
            className="inline-flex items-center justify-center rounded-lg border border-gray-200 p-2 text-gray-700 hover:bg-gray-100 md:hidden"
          >
            {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>

        {menuOpen && (
          <div className="border-t border-gray-200 bg-white px-4 py-3 shadow-sm md:hidden">
            <div className="mx-auto max-w-6xl space-y-2">
              <Link href="/docs" onClick={() => setMenuOpen(false)} className="block rounded-lg px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100">
                Docs
              </Link>
              <Link href="/pricing" onClick={() => setMenuOpen(false)} className="block rounded-lg px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100">
                Pricing
              </Link>
              {!loading && (
                user ? (
                  <>
                    <Link href="/dashboard" onClick={() => setMenuOpen(false)} className="block rounded-lg px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100">
                      Dashboard
                    </Link>
                    <button
                      onClick={handleSignOut}
                      className="flex w-full items-center justify-center rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
                    >
                      Sign Out
                    </button>
                  </>
                ) : (
                  <>
                    <Link href="/login" onClick={() => setMenuOpen(false)} className="block rounded-lg px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100">
                      Sign In
                    </Link>
                    <Link href="/signup" onClick={() => setMenuOpen(false)} className="flex items-center justify-center rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700">
                      Start Free
                    </Link>
                  </>
                )
              )}
            </div>
          </div>
        )}
      </nav>

      <section className="mx-auto max-w-3xl px-4 pb-12 pt-12 text-center sm:px-6 sm:pb-16 sm:pt-20">
        <div className="flex flex-col items-center gap-4 sm:gap-5">
          <div className="inline-flex items-center gap-2 rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700">
            <Zap className="h-3.5 w-3.5" /> AI-Powered Customer Risk Intelligence
          </div>
          <h1 className="text-3xl font-extrabold leading-tight tracking-tight text-gray-900 sm:text-4xl lg:text-5xl">
            Know Your Customer Before You <span className="text-blue-600">Engage</span>
          </h1>
          <p className="max-w-xl text-base text-gray-500 sm:text-lg">
            Instantly assess customer legitimacy, domain health, and fraud risk. From email verification to company intelligence - make confident business decisions at scale.
          </p>
          <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center sm:justify-center">
            {user ? (
              <Link href="/dashboard" className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-6 py-3 text-sm font-semibold text-white hover:bg-blue-700 sm:w-auto">
                Go to Dashboard <ArrowRight className="h-4 w-4" />
              </Link>
            ) : (
              <Link href="/signup" className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-6 py-3 text-sm font-semibold text-white hover:bg-blue-700 sm:w-auto">
                Start Free <ArrowRight className="h-4 w-4" />
              </Link>
            )}
            <Link href="/docs" className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-6 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-100 sm:w-auto">
              <Code className="h-4 w-4" /> API Docs
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-5xl grid-cols-1 gap-6 px-4 py-12 sm:px-6 sm:py-16 md:grid-cols-3">
        {features.map((f, i) => (
          <div key={i} className="rounded-xl border bg-white p-6">
            <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100">
              <f.icon className="h-5 w-5 text-blue-600" />
            </div>
            <h3 className="font-semibold">{f.title}</h3>
            <p className="mt-2 text-sm text-gray-500">{f.desc}</p>
          </div>
        ))}
      </section>

      <section className="mx-auto max-w-5xl px-4 py-12 sm:px-6 sm:py-16">
        <h2 className="mb-2 text-center text-2xl font-bold">Why RiskShield AI</h2>
        <p className="mb-8 text-center text-sm text-gray-500">Not another email validator. A decision layer for your data pipeline.</p>
        <div className="grid gap-6 md:grid-cols-3">
          {differentiators.map((d, i) => (
            <div key={i} className="rounded-xl border bg-white p-5">
              <h3 className="text-sm font-semibold text-blue-600">{d.title}</h3>
              <p className="mt-2 text-sm text-gray-500">{d.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="px-4 py-12 text-center sm:px-6 sm:py-16">
        <div className="mx-auto max-w-2xl rounded-2xl bg-blue-600 px-6 py-10 sm:p-10">
          <h2 className="mb-3 text-2xl font-bold text-white">Ready to Stop Wasting Time on Bad Leads?</h2>
          <p className="mb-6 text-blue-100">50 free credits per month. No credit card. Upgrade only when you need deeper checks or API access.</p>
          {user ? (
            <Link href="/risk-check" className="inline-flex items-center gap-2 rounded-lg bg-white px-6 py-3 text-sm font-bold text-blue-600 hover:bg-blue-50">
              Start Checking Now <ArrowRight className="h-4 w-4" />
            </Link>
          ) : (
            <Link href="/signup" className="inline-flex items-center gap-2 rounded-lg bg-white px-6 py-3 text-sm font-bold text-blue-600 hover:bg-blue-50">
              Get Started Free <ArrowRight className="h-4 w-4" />
            </Link>
          )}
        </div>
      </section>

      <footer className="border-t bg-white px-4 py-8 text-sm text-gray-500 sm:px-6">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 text-center sm:flex-row sm:items-center sm:justify-between sm:text-left">
          <p>&copy; {new Date().getFullYear()} RiskShield AI. AI-Powered Customer Risk Intelligence.</p>
          <div className="flex flex-wrap items-center justify-center gap-4">
            <Link href="/privacy" className="hover:text-gray-900">Privacy Policy</Link>
            <Link href="/terms" className="hover:text-gray-900">Terms of Service</Link>
            <a href="mailto:support@574269.xyz" className="hover:text-gray-900">support@574269.xyz</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
