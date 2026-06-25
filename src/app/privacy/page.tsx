import Link from "next/link";
import { Mail, Shield } from "lucide-react";

const supportEmail = "support@574269.xyz";

const sections = [
  {
    title: "Information we collect",
    body: [
      "Account information, such as your email address, authentication status, plan, usage limits, and subscription status.",
      "Risk-check inputs you submit, including email addresses, domain information, IP addresses, uploaded lists, and related scan metadata.",
      "Usage information, such as API requests, dashboard activity, credit usage, generated reports, export history, and error logs.",
      "Payment and subscription information processed by our payment provider Creem. We do not store full card numbers on our servers.",
      "Technical information, such as browser type, device information, IP address, cookies, and security logs needed to operate the service.",
    ],
  },
  {
    title: "How we use information",
    body: [
      "To provide email, domain, IP, and customer-risk intelligence features.",
      "To operate accounts, subscriptions, billing, credits, API access, dashboard reporting, exports, and integrations.",
      "To prevent abuse, investigate security issues, enforce usage limits, and protect the platform from spam, fraud, and misuse.",
      "To improve product reliability, accuracy, performance, and customer support.",
      "To comply with legal, tax, accounting, security, and payment-processing obligations.",
    ],
  },
  {
    title: "How we share information",
    body: [
      "With infrastructure and service providers that help us operate RiskShield AI, including hosting, authentication, database, payment, email, analytics, and security providers.",
      "With payment processors and merchant-of-record providers when needed to process purchases, subscriptions, refunds, taxes, disputes, and compliance reviews.",
      "With authorities, regulators, or third parties when required by law, to protect rights and safety, or to investigate abuse.",
      "We do not sell personal information or customer-uploaded lists.",
    ],
  },
  {
    title: "Data retention and security",
    body: [
      "We keep account, billing, usage, and scan data only as long as reasonably needed to provide the service, meet legal obligations, resolve disputes, and protect the platform.",
      "We use reasonable technical and organizational safeguards, including access controls, secure infrastructure, and limited administrative access.",
      "No internet service can be guaranteed to be perfectly secure, and users are responsible for protecting their passwords, API keys, and devices.",
    ],
  },
  {
    title: "Your choices",
    body: [
      "You may request access, correction, export, or deletion of personal information, subject to identity verification and legal retention requirements.",
      "You can cancel paid subscriptions through the billing flow made available by Creem or by contacting support.",
      "You can stop using API keys by revoking them from your dashboard.",
    ],
  },
];

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-4 sm:px-6">
          <Link href="/" className="flex items-center gap-3">
            <Shield className="h-6 w-6 text-blue-600" />
            <span className="text-lg font-bold text-gray-900">RiskShield AI</span>
          </Link>
          <Link href="/terms" className="text-sm font-medium text-gray-600 hover:text-gray-900">
            Terms
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
        <section className="mb-8">
          <p className="text-sm font-semibold uppercase tracking-wide text-blue-600">Legal</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-gray-900">Privacy Policy</h1>
          <p className="mt-3 text-sm text-gray-500">Last updated: June 25, 2026</p>
          <p className="mt-5 text-gray-600">
            RiskShield AI provides email, IP, domain, and customer-risk intelligence tools for businesses. This Privacy Policy explains what information we collect, how we use it, and how users can contact us.
          </p>
        </section>

        <div className="space-y-6">
          {sections.map((section) => (
            <section key={section.title} className="rounded-lg border bg-white p-6">
              <h2 className="text-lg font-semibold text-gray-900">{section.title}</h2>
              <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-6 text-gray-600">
                {section.body.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </section>
          ))}

          <section className="rounded-lg border bg-white p-6">
            <h2 className="text-lg font-semibold text-gray-900">International use</h2>
            <p className="mt-3 text-sm leading-6 text-gray-600">
              RiskShield AI may process information in countries where our infrastructure, service providers, or payment partners operate. By using the service, you understand that information may be transferred and processed outside your country of residence.
            </p>
          </section>

          <section className="rounded-lg border bg-white p-6">
            <h2 className="text-lg font-semibold text-gray-900">Contact</h2>
            <p className="mt-3 text-sm leading-6 text-gray-600">
              For privacy or support requests, contact us at{" "}
              <a href={`mailto:${supportEmail}`} className="font-medium text-blue-600 hover:underline">
                {supportEmail}
              </a>
              .
            </p>
          </section>
        </div>
      </main>

      <footer className="border-t bg-white px-4 py-6 text-sm text-gray-500">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-3 sm:px-6">
          <div className="flex items-center gap-2">
            <Mail className="h-4 w-4" />
            <a href={`mailto:${supportEmail}`} className="hover:text-gray-900">{supportEmail}</a>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/terms" className="hover:text-gray-900">Terms of Service</Link>
            <Link href="/pricing" className="hover:text-gray-900">Pricing</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
