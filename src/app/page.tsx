import Link from "next/link";
import { Shield, Lock, Zap, Code, ArrowRight, CheckCircle } from "lucide-react";

const features = [
  { icon: Shield, title: "AI Risk Scoring", desc: "Proprietary AI model scores every user action for fraud signals." },
  { icon: Lock, title: "Disposable Email Detection", desc: "Block throwaway emails. Stop signup abuse before it starts." },
  { icon: Zap, title: "Real-time API", desc: "Sub-200ms response times. Check users at signup, login, or payment." },
];

const useCases = [
  { icon: CheckCircle, title: "SaaS Signup Protection", desc: "Screen new users before they consume your API quota." },
  { icon: CheckCircle, title: "Payment Fraud Prevention", desc: "Flag risky transactions before processing payments." },
  { icon: CheckCircle, title: "Bot & Spam Defense", desc: "Detect VPN, proxy, and automated signup patterns." },
];

export default function Home() {
  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="px-6 py-4 flex items-center justify-between max-w-6xl mx-auto">
        <div className="flex items-center gap-2"><Shield className="w-7 h-7 text-blue-600" /><span className="font-bold text-xl">Fraud Shield API</span></div>
        <div className="flex items-center gap-4">
          <Link href="/docs" className="text-sm text-gray-600 hover:text-gray-900">Docs</Link>
          <Link href="/pricing" className="text-sm text-gray-600 hover:text-gray-900">Pricing</Link>
          <Link href="/login" className="text-sm text-gray-600 hover:text-gray-900">Sign In</Link>
          <Link href="/signup" className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700">Get API Key Free</Link>
        </div>
      </nav>

      <section className="pt-20 pb-16 px-6 text-center max-w-3xl mx-auto">
        <div className="inline-flex items-center gap-2 bg-blue-100 text-blue-700 text-xs font-semibold px-3 py-1 rounded-full mb-6">
          <Zap className="w-3.5 h-3.5" /> AI-Powered Fraud Detection for SaaS
        </div>
        <h1 className="text-5xl font-extrabold tracking-tight text-gray-900 leading-tight">
          Stop Fraud Before It <span className="text-blue-600">Costs You</span>
        </h1>
        <p className="mt-4 text-lg text-gray-500 max-w-xl mx-auto">
          One API call to check emails, IPs, and user risk scores. Block disposable emails, VPN users, and suspicious signups instantly.
        </p>
        <div className="mt-8 flex items-center justify-center gap-4 flex-wrap">
          <Link href="/signup" className="bg-blue-600 text-white px-6 py-3 rounded-lg text-sm font-semibold hover:bg-blue-700 inline-flex items-center gap-2">
            Start Free <ArrowRight className="w-4 h-4" />
          </Link>
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
        <h2 className="text-2xl font-bold text-center mb-8">Built for SaaS Developers</h2>
        <div className="grid md:grid-cols-3 gap-6">
          {useCases.map((u, i) => (
            <div key={i} className="flex gap-3 items-start">
              <u.icon className="w-5 h-5 text-green-500 mt-0.5 shrink-0" />
              <div>
                <h3 className="font-semibold text-sm">{u.title}</h3>
                <p className="text-xs text-gray-500 mt-1">{u.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="py-16 px-6 text-center">
        <div className="bg-blue-600 rounded-2xl p-10 max-w-2xl mx-auto">
          <h2 className="text-2xl font-bold text-white mb-3">Ready to Protect Your SaaS?</h2>
          <p className="text-blue-100 mb-6">1,000 free API calls per month. No credit card required.</p>
          <Link href="/signup" className="bg-white text-blue-600 px-6 py-3 rounded-lg text-sm font-bold hover:bg-blue-50 inline-flex items-center gap-2">
            Get Started Free <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

      <footer className="border-t py-8 px-6 text-center text-sm text-gray-400">
        <p>&copy; {new Date().getFullYear()} Fraud Shield API. All rights reserved.</p>
      </footer>
    </div>
  );
}
