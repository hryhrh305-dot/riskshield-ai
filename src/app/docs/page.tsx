import Link from "next/link";
import { Code, Key, ExternalLink, ArrowRight } from "lucide-react";
import { SecwynMark } from "@/components/brand/SecwynMark";

export default function DocsPage() {
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
          <div className="flex items-center gap-3 text-sm">
            <Link href="/pricing" className="text-slate-400 transition hover:text-white">Pricing</Link>
            <Link href="/dashboard" className="rounded-full border border-white/12 bg-white/8 px-4 py-2 font-medium text-slate-100 transition hover:border-white/20 hover:bg-white/12">Dashboard</Link>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <div className="mb-10">
          <div className="rs-fade-up mb-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-sm font-medium text-slate-200">
            <Code className="h-4 w-4" /> Decision API
          </div>
          <h1 className="rs-marketing-title rs-title-settle text-3xl font-semibold text-white sm:text-4xl">Pre-Send Decision API</h1>
          <p className="rs-fade-up rs-fade-up-delay-1 mt-3 max-w-2xl text-slate-400">
            Add Secwyn pre-send decisions to your workflow. All endpoints require a Bearer token.
          </p>
          <p className="mt-3 text-xs uppercase tracking-[0.22em] text-amber-300">API access is available on Growth and above</p>
        </div>

        <div className="space-y-8">
          <section className="rs-card rounded-[28px] p-6">
            <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold text-white"><Key className="h-5 w-5 text-slate-300" /> Authentication</h2>
            <p className="mb-3 text-sm text-slate-400">Include your API key in every request:</p>
            <pre className="rs-code overflow-x-auto rounded-2xl p-4 text-sm text-slate-300">{`curl -X POST https://www.secwyn.com/api/v1/email/check \\
  -H "Authorization: Bearer fsk_xxxxxxxxxxxxxxxxxxxxxxxxxxxx" \\
  -H "Content-Type: application/json" \\
  -d '{"email":"test@example.com"}'`}</pre>
            <p className="mt-3 text-xs text-slate-500">Get your API key from the <Link href="/dashboard" className="text-white hover:text-slate-200">Dashboard</Link>.</p>
          </section>

          <section className="space-y-6">
            <h2 className="flex items-center gap-2 text-lg font-semibold text-white"><Code className="h-5 w-5 text-slate-300" /> Endpoints</h2>

            <div className="rs-card rs-card-hover rounded-[28px] p-6">
              <div className="mb-3 flex items-center gap-3">
                <span className="rs-method rs-method-post">POST</span>
                <code className="rs-code rounded-full px-3 py-1 text-sm">/api/v1/email/check</code>
              </div>
              <p className="mb-4 text-sm text-slate-400">Assess email syntax, domain signals, and available mailbox evidence.</p>
              <div className="mb-2 text-xs font-medium uppercase tracking-[0.22em] text-slate-500">Request</div>
              <pre className="rs-code overflow-x-auto rounded-2xl p-3 text-xs text-slate-300">{`{
  "email": "test@mailinator.com"
}`}</pre>
              <div className="mb-2 mt-4 text-xs font-medium uppercase tracking-[0.22em] text-slate-500">Response</div>
              <pre className="rs-code overflow-x-auto rounded-2xl p-3 text-xs text-slate-300">{`{
  "success": true,
  "email": "test@mailinator.com",
  "valid": true,
  "risk_score": 70,
  "audit_queue": "suppress",
  "primary_reason": "Disposable mailbox",
  "recommended_action": "Suppress"
}`}</pre>
            </div>

            <div className="rs-card rs-card-hover rounded-[28px] p-6">
              <div className="mb-3 flex items-center gap-3">
                <span className="rs-method rs-method-post">POST</span>
                <code className="rs-code rounded-full px-3 py-1 text-sm">/api/v1/ip/check</code>
              </div>
              <p className="mb-4 text-sm text-slate-400">Analyze IP address for VPN, proxy, or private network signals.</p>
              <div className="mb-2 text-xs font-medium uppercase tracking-[0.22em] text-slate-500">Request</div>
              <pre className="rs-code overflow-x-auto rounded-2xl p-3 text-xs text-slate-300">{`{
  "ip": "8.8.8.8"
}`}</pre>
              <div className="mb-2 mt-4 text-xs font-medium uppercase tracking-[0.22em] text-slate-500">Response</div>
              <pre className="rs-code overflow-x-auto rounded-2xl p-3 text-xs text-slate-300">{`{
  "success": true,
  "ip": "8.8.8.8",
  "is_private": false,
  "is_localhost": false,
  "risk_score": 0
}`}</pre>
            </div>

            <div className="rs-card rs-card-hover rounded-[28px] p-6">
              <div className="mb-3 flex items-center gap-3">
                <span className="rs-method rs-method-post">POST</span>
                <code className="rs-code rounded-full px-3 py-1 text-sm">/api/v1/risk/check</code>
              </div>
              <p className="mb-4 text-sm text-slate-400">Evaluate available email and IP signals with a recommended action.</p>
              <div className="mb-2 text-xs font-medium uppercase tracking-[0.22em] text-slate-500">Request</div>
              <pre className="rs-code overflow-x-auto rounded-2xl p-3 text-xs text-slate-300">{`{
  "email": "spam@mailinator.com",
  "ip": "1.1.1.1"
}`}</pre>
              <div className="mb-2 mt-4 text-xs font-medium uppercase tracking-[0.22em] text-slate-500">Response</div>
              <pre className="rs-code overflow-x-auto rounded-2xl p-3 text-xs text-slate-300">{`{
  "success": true,
  "risk_score": 70,
  "audit_queue": "suppress",
  "primary_reason": "Disposable mailbox",
  "recommended_action": "Suppress",
  "email": "spam@mailinator.com",
  "ip": "1.1.1.1"
}`}</pre>
            </div>
          </section>

          <section className="rs-card rounded-[28px] p-6">
            <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold text-white"><Code className="h-5 w-5 text-slate-300" /> Pre-send List Audit</h2>
            <div className="mb-3 flex items-center gap-3">
              <span className="rs-method rs-method-post">POST</span>
              <code className="rs-code rounded-full px-3 py-1 text-sm">/api/v1/pre-send/check</code>
            </div>
            <p className="mb-4 text-sm text-slate-400">Run a pre-send list check before contacts enter your sender workflow.</p>
            <div className="mb-2 text-xs font-medium uppercase tracking-[0.22em] text-slate-500">Request (legacy pre-send endpoint)</div>
            <pre className="rs-code overflow-x-auto rounded-2xl p-3 text-xs text-slate-300">{`{
  "emails": ["lead1@company.com", "spam@temp.com", "..."],
  "campaign_id": "spring-outreach-2026"
}`}</pre>
            <div className="mb-2 mt-4 text-xs font-medium uppercase tracking-[0.22em] text-slate-500">Response</div>
            <pre className="rs-code overflow-x-auto rounded-2xl p-3 text-xs text-slate-300">{`{
  "success": true,
  "summary": { "total": 1000, "allowed": 820, "blocked": 180 },
  "campaign_risk": "LOW",
  "results": [{ "email": "...", "audit_queue": "send" }]
}`}</pre>
            <div className="mt-4 rounded-2xl border border-amber-500/20 bg-amber-500/10 p-3 text-sm text-amber-200">
              <strong>Integration tip:</strong> call this endpoint before sending. Keep Suppress contacts out of the send queue and resolve Review contacts with operator context.
            </div>
          </section>

          <section className="rs-card rounded-[28px] p-6">
            <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold text-white"><Code className="h-5 w-5 text-slate-300" /> Google Sheets</h2>
            <p className="mb-4 text-sm text-slate-400">
              The spreadsheet install guide now lives on its own page so non-developers can jump straight into setup.
            </p>
            <Link href="/docs/google-sheets" className="rs-link-arrow inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/8 px-4 py-2 text-sm font-medium text-slate-100 transition hover:border-white/20 hover:bg-white/12">
              Open Google Sheets Guide <ExternalLink className="h-4 w-4" />
            </Link>
          </section>

          <section className="rs-card rounded-[28px] p-6">
            <h2 className="mb-3 text-lg font-semibold text-white">Error Codes</h2>
            <div className="space-y-3 text-sm">
              <div><code className="rs-code rounded-full px-2 py-1 text-xs">401</code> <span className="ml-2 text-slate-400">Missing or invalid API key</span></div>
              <div><code className="rs-code rounded-full px-2 py-1 text-xs">429</code> <span className="ml-2 text-slate-400">Monthly limit exceeded</span></div>
              <div><code className="rs-code rounded-full px-2 py-1 text-xs">400</code> <span className="ml-2 text-slate-400">Invalid request body</span></div>
            </div>
          </section>

          <section className="rounded-[28px] border border-white/10 bg-white/[0.035] p-6 text-center">
            <p className="text-sm font-medium text-slate-200">Ready to integrate?</p>
            <p className="mb-4 mt-1 text-xs text-slate-500">Create a free account now, then upgrade to Growth when you need API access.</p>
            <Link href="/signup" className="rs-button-primary rs-link-arrow inline-flex items-center gap-2 rounded-full px-5 py-3 text-sm font-medium">
              Create Free Account <ArrowRight className="h-4 w-4" />
            </Link>
          </section>
        </div>
      </div>

      <footer className="border-t border-white/10 px-4 py-6 text-sm text-slate-500 sm:px-6">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3">
          <a href="mailto:support@secwyn.com" className="transition hover:text-white">support@secwyn.com</a>
          <div className="flex items-center gap-4">
            <Link href="/privacy" className="transition hover:text-white">Privacy Policy</Link>
            <Link href="/terms" className="transition hover:text-white">Terms of Service</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
