import Link from "next/link";
import { Shield, Code, Key, ExternalLink } from "lucide-react";

export default function DocsPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b px-6 py-4 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-3">
          <Shield className="w-6 h-6 text-blue-600" />
          <span className="font-bold text-lg">RiskShield AI</span>
        </Link>
        <div className="flex items-center gap-4 text-sm">
          <Link href="/pricing" className="text-gray-600 hover:text-gray-900">Pricing</Link>
          <Link href="/dashboard" className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700">Dashboard</Link>
        </div>
      </header>

      <div className="max-w-3xl mx-auto p-6 space-y-10">
        <div>
          <h1 className="text-3xl font-bold">API Documentation</h1>
          <p className="text-gray-500 mt-2">Integrate fraud detection in minutes. All endpoints require a Bearer token.</p>
          <p className="text-xs text-amber-600 mt-2">API access is available on Growth and above.</p>
        </div>

        <section>
          <h2 className="text-lg font-semibold flex items-center gap-2 mb-3"><Key className="w-5 h-5" /> Authentication</h2>
          <p className="text-sm text-gray-600 mb-2">Include your API key in every request:</p>
          <pre className="bg-gray-900 text-green-400 p-4 rounded-lg text-sm overflow-x-auto">
{`curl -X POST https://yourdomain.com/api/v1/email/check \\
  -H "Authorization: Bearer fsk_xxxxxxxxxxxxxxxxxxxxxxxxxxxx" \\
  -H "Content-Type: application/json" \\
  -d '{"email":"test@example.com"}'`}
          </pre>
          <p className="text-xs text-gray-400 mt-2">Get your API key from the <Link href="/dashboard" className="text-blue-600 hover:underline">Dashboard</Link>.</p>
        </section>

        <section className="space-y-8">
          <h2 className="text-lg font-semibold flex items-center gap-2"><Code className="w-5 h-5" /> Endpoints</h2>

          <div className="bg-white rounded-xl border p-6">
            <div className="flex items-center gap-3 mb-3">
              <span className="bg-blue-100 text-blue-700 text-xs font-bold px-2 py-0.5 rounded">POST</span>
              <code className="text-sm font-mono">/api/v1/email/check</code>
            </div>
            <p className="text-sm text-gray-500 mb-4">Check if an email is valid, disposable, or risky.</p>
            <div className="text-xs font-semibold text-gray-600 mb-2">Request</div>
            <pre className="bg-gray-900 text-green-400 p-3 rounded text-xs overflow-x-auto">
{`{
  "email": "test@mailinator.com"
}`}</pre>
            <div className="text-xs font-semibold text-gray-600 mt-4 mb-2">Response</div>
            <pre className="bg-gray-900 text-green-400 p-3 rounded text-xs overflow-x-auto">
{`{
  "success": true,
  "email": "test@mailinator.com",
  "valid": true,
  "disposable": true,
  "domain": "mailinator.com",
  "risk_score": 40
}`}</pre>
          </div>

          <div className="bg-white rounded-xl border p-6">
            <div className="flex items-center gap-3 mb-3">
              <span className="bg-blue-100 text-blue-700 text-xs font-bold px-2 py-0.5 rounded">POST</span>
              <code className="text-sm font-mono">/api/v1/ip/check</code>
            </div>
            <p className="text-sm text-gray-500 mb-4">Analyze IP address for VPN/proxy/private network signals.</p>
            <div className="text-xs font-semibold text-gray-600 mb-2">Request</div>
            <pre className="bg-gray-900 text-green-400 p-3 rounded text-xs overflow-x-auto">
{`{
  "ip": "8.8.8.8"
}`}</pre>
            <div className="text-xs font-semibold text-gray-600 mt-4 mb-2">Response</div>
            <pre className="bg-gray-900 text-green-400 p-3 rounded text-xs overflow-x-auto">
{`{
  "success": true,
  "ip": "8.8.8.8",
  "is_private": false,
  "is_localhost": false,
  "risk_score": 0
}`}</pre>
          </div>

          <div className="bg-white rounded-xl border p-6">
            <div className="flex items-center gap-3 mb-3">
              <span className="bg-purple-100 text-purple-700 text-xs font-bold px-2 py-0.5 rounded">POST</span>
              <code className="text-sm font-mono">/api/v1/risk/check</code>
            </div>
            <p className="text-sm text-gray-500 mb-4">
              Combined email + IP risk check with AI-powered recommendation.
            </p>
            <div className="text-xs font-semibold text-gray-600 mb-2">Request</div>
            <pre className="bg-gray-900 text-green-400 p-3 rounded text-xs overflow-x-auto">
{`{
  "email": "spam@mailinator.com",
  "ip": "1.1.1.1"
}`}</pre>
            <div className="text-xs font-semibold text-gray-600 mt-4 mb-2">Response</div>
            <pre className="bg-gray-900 text-green-400 p-3 rounded text-xs overflow-x-auto">
{`{
  "success": true,
  "risk_score": 70,
  "decision": "BLOCK",
  "reasons": ["Disposable email detected"],
  "ai_reason": "The email is from a disposable domain, indicating potential abuse.",
  "email": "spam@mailinator.com",
  "ip": "1.1.1.1"
}`}</pre>
          </div>
        </section>

        <section>
          <h2 className="text-lg font-semibold flex items-center gap-2 mb-3"><Code className="w-5 h-5" /> Pre-send Protection</h2>
          <div className="bg-white rounded-xl border p-6">
            <div className="flex items-center gap-3 mb-3">
              <span className="bg-red-100 text-red-700 text-xs font-bold px-2 py-0.5 rounded">POST</span>
              <code className="text-sm font-mono">/api/v1/pre-send/check</code>
            </div>
            <p className="text-sm text-gray-500 mb-4">Real-time email screening before you send campaigns. Hook this into your Gmail, Outlook, HubSpot, or custom SMTP workflow to block risky recipients before sending.</p>
            <div className="text-xs font-semibold text-gray-600 mb-2">Request (batch up to 1,000)</div>
            <pre className="bg-gray-900 text-green-400 p-3 rounded text-xs overflow-x-auto">
{`{
  "emails": ["lead1@company.com", "spam@temp.com", ...],
  "campaign_id": "spring-outreach-2026"
}`}</pre>
            <div className="text-xs font-semibold text-gray-600 mt-4 mb-2">Response</div>
            <pre className="bg-gray-900 text-green-400 p-3 rounded text-xs overflow-x-auto">
{`{
  "success": true,
  "summary": { "total": 1000, "allowed": 820, "blocked": 180 },
  "campaign_risk": "LOW",
  "results": [{ "email": "...", "decision": "ALLOW", ... }, ...]
}`}</pre>
            <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
              <strong>How to integrate:</strong> Before your email system sends, call this endpoint. If decision = BLOCK, skip that recipient. Use the API key from your Dashboard.
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-lg font-semibold flex items-center gap-2 mb-3"><Code className="w-5 h-5" /> Google Sheets</h2>
          <div className="bg-white rounded-xl border p-6">
            <p className="text-sm text-gray-600 mb-4">
              The Google Sheets installation guide now lives on its own page, so spreadsheet users can go straight to setup without scrolling through API reference content first.
            </p>
            <Link href="/docs/google-sheets" className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700">
              Open Google Sheets Guide <ExternalLink className="w-4 h-4" />
            </Link>
          </div>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-3">Error Codes</h2>
          <div className="bg-white rounded-xl border p-6 space-y-2 text-sm">
            <div><code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs">401</code> <span className="text-gray-600 ml-2">Missing or invalid API key</span></div>
            <div><code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs">429</code> <span className="text-gray-600 ml-2">Monthly limit exceeded</span></div>
            <div><code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs">400</code> <span className="text-gray-600 ml-2">Invalid request body</span></div>
          </div>
        </section>

        <section className="pb-10">
          <div className="bg-blue-50 rounded-xl p-6 text-center">
            <p className="text-sm text-blue-700 font-medium">Ready to integrate?</p>
            <p className="text-xs text-blue-500 mt-1 mb-4">Create a free account now, then upgrade to Growth when you need API access.</p>
            <Link href="/signup" className="bg-blue-600 text-white px-6 py-2 rounded-lg text-sm font-bold hover:bg-blue-700">Create Free Account</Link>
          </div>
        </section>
      </div>

      <footer className="border-t bg-white px-6 py-6 text-sm text-gray-500">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-3">
          <a href="mailto:support@574269.xyz" className="hover:text-gray-900">support@574269.xyz</a>
          <div className="flex items-center gap-4">
            <Link href="/privacy" className="hover:text-gray-900">Privacy Policy</Link>
            <Link href="/terms" className="hover:text-gray-900">Terms of Service</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

