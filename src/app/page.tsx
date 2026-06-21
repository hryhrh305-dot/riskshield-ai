"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Shield, Lock, Zap, Code, ArrowRight, CheckCircle, BarChart3, Filter, LogOut } from "lucide-react";
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

  useEffect(() => {
    (async () => {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        setUser(user ? { email: user.email || "" } : null);
      } catch { setUser(null); }
      setLoading(false);
    })();
  }, []);

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    setUser(null);
    window.location.href = "/";
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="px-6 py-4 flex items-center justify-between max-w-6xl mx-auto">
        <Link href="/" className="flex items-center gap-2">
          <Shield className="w-7 h-7 text-blue-600" />
          <span className="font-bold text-xl">RiskShield</span>
        </Link>
        <div className="flex items-center gap-4">
          <Link href="/docs" className="text-sm text-gray-600 hover:text-gray-900">Docs</Link>
          <Link href="/pricing" className="text-sm text-gray-600 hover:text-gray-900">Pricing</Link>
          {!loading && (
            user ? (
              <>
                <Link href="/dashboard" className="text-sm text-gray-600 hover:text-gray-900 font-medium">{user.email}</Link>
                <button onClick={handleSignOut} className="text-sm text-gray-400 hover:text-red-600" title="Sign Out">
                  <LogOut className="w-4 h-4" />
                </button>
              </>
            ) : (
              <>
                <Link href="/login" className="text-sm text-gray-600 hover:text-gray-900">Sign In</Link>
                <Link href="/signup" className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700">Get API Key Free</Link>
              </>
            )
          )}
        </div>
      </nav>

      <section className="pt-20 pb-16 px-6 text-center max-w-3xl mx-auto">
        <div className="inline-flex items-center gap-2 bg-blue-100 text-blue-700 text-xs font-semibold px-3 py-1 rounded-full mb-6">
          <Zap className="w-3.5 h-3.5" /> AI-Powered Customer Risk Intelligence
        </div>
        <h1 className="text-5xl font-extrabold tracking-tight text-gray-900 leading-tight">
          Know Your Customer Before You <span className="text-blue-600">Engage</span>
        </h1>
        <p className="mt-4 text-lg text-gray-500 max-w-xl mx-auto">
          Instantly assess customer legitimacy, domain health, and fraud risk. From email verification to company intelligence — make confident business decisions at scale.
        </p>
        <div className="mt-8 flex items-center justify-center gap-4 flex-wrap">
          {user ? (
            <Link href="/dashboard" className="bg-blue-600 text-white px-6 py-3 rounded-lg text-sm font-semibold hover:bg-blue-700 inline-flex items-center gap-2">
              Go to Dashboard <ArrowRight className="w-4 h-4" />
            </Link>
          ) : (
            <Link href="/signup" className="bg-blue-600 text-white px-6 py-3 rounded-lg text-sm font-semibold hover:bg-blue-700 inline-flex items-center gap-2">
              Start Free <ArrowRight className="w-4 h-4" />
            </Link>
          )}
          <Link href="/docs" className="bg-white border border-gray-300 text-gray-700 px-6 py-3 rounded-lg text-sm font-semibold hover:bg-gray-100 inline-flex items-center gap-2">
            <Code className="w-4 h-4" /> API Docs
          </Link>
        </div>
      </section>

      <section className="py-16 px-6 max-w-5xl mx-auto grid md:grid-cols-3 gap-6">
        {features.map((f, i) => (
          <div key={i} className="bg-white rounded-xl border p-6">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center mb-4"><f.icon className="w-5 h-5 text-blue-600" /></div>
            <h3 className="font-semibold">{f.title}</h3>
            <p className="text-sm text-gray-500 mt-2">{f.desc}</p>
          </div>
        ))}
      </section>

      <section className="py-16 px-6 max-w-5xl mx-auto">
        <h2 className="text-2xl font-bold text-center mb-2">Why RiskShield</h2>
        <p className="text-center text-gray-500 mb-8 text-sm">Not another email validator. A decision layer for your data pipeline.</p>
        <div className="grid md:grid-cols-3 gap-6">
          {differentiators.map((d, i) => (
            <div key={i} className="bg-white rounded-xl border p-5">
              <h3 className="font-semibold text-sm text-blue-600">{d.title}</h3>
              <p className="text-sm text-gray-500 mt-2">{d.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="py-16 px-6 text-center">
        <div className="bg-blue-600 rounded-2xl p-10 max-w-2xl mx-auto">
          <h2 className="text-2xl font-bold text-white mb-3">Ready to Stop Wasting Time on Bad Leads?</h2>
          <p className="text-blue-100 mb-6">1,000 free risk checks per month. No credit card. Instant customer intelligence.</p>
          {user ? (
            <Link href="/risk-check" className="bg-white text-blue-600 px-6 py-3 rounded-lg text-sm font-bold hover:bg-blue-50 inline-flex items-center gap-2">
              Start Checking Now <ArrowRight className="w-4 h-4" />
            </Link>
          ) : (
            <Link href="/signup" className="bg-white text-blue-600 px-6 py-3 rounded-lg text-sm font-bold hover:bg-blue-50 inline-flex items-center gap-2">
              Get Started Free <ArrowRight className="w-4 h-4" />
            </Link>
          )}
        </div>
      </section>

      <footer className="border-t py-8 px-6 text-center text-sm text-gray-400">
        <p>&copy; {new Date().getFullYear()} RiskShield. AI-Powered Customer Risk Intelligence.</p>
      </footer>
    </div>
  );
}
