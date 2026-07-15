import Link from "next/link";
import { Mail } from "lucide-react";
import { SecwynMark } from "@/components/brand/SecwynMark";

const supportEmail = "support@secwyn.com";

const sections = [
  {
    title: "Using Secwyn",
    body: [
      "You may use Secwyn only for lawful business purposes and only in compliance with these Terms, applicable laws, and any plan limits shown on our website.",
      "You are responsible for the accuracy, legality, and authorization of the email addresses, IP addresses, domains, files, and other data you submit.",
      "You must keep your account credentials and API keys secure. Activity under your account or API keys is your responsibility unless caused by our proven breach.",
    ],
  },
  {
    title: "Subscriptions, credits, and billing",
    body: [
      "Paid plans are billed through Creem or another payment provider we authorize. Prices, credits, and plan features are shown on the Pricing page and may change for future billing periods.",
      "Annual subscriptions are billed once per annual term in U.S. dollars. Included contact credits are issued in monthly service periods from the subscription anchor and are not granted twelve months upfront.",
      "Unless a checkout expressly states otherwise, annual subscriptions renew annually. A cancellation scheduled for period end stops renewal while access continues through the paid term; immediate cancellation, refund, dispute, or chargeback may stop future credit issuance.",
      "Premium annual pricing is already discounted as stated on the Pricing page and does not combine with ordinary promotional coupons unless Secwyn expressly confirms otherwise in writing.",
      "Credits are usage units for checks and related workflows. Unless we state otherwise in writing, credits are not cash, are not transferable, and do not roll over after the applicable billing period.",
      "Subscription access normally continues until canceled, expired, refunded, disputed, or terminated. We may suspend access for unpaid invoices, failed payments, chargebacks, abuse, or policy violations.",
      "Refunds are not guaranteed except where required by law or expressly approved by us or our payment provider. We may refuse refunds for abuse, excessive usage, policy violations, or completed digital service delivery.",
    ],
  },
  {
    title: "Risk results and limitations",
    body: [
      "Secwyn provides risk signals, scoring, enrichment, and recommendations. Results are informational and do not guarantee deliverability, identity, fraud status, compliance status, or business outcome.",
      "You remain responsible for final business decisions, customer screening, compliance obligations, outreach practices, and the use of exported reports.",
      "We may improve, adjust, remove, or limit features, models, signals, scoring logic, data sources, integrations, and exports to protect reliability, cost control, compliance, and product quality.",
    ],
  },
  {
    title: "Acceptable use",
    body: [
      "You may not use Secwyn for illegal activity, harassment, surveillance, spam, credential attacks, scraping abuse, evasion of platform policies, or high-risk uses that could harm people, systems, or payment networks.",
      "You may not resell, white-label, benchmark, reverse engineer, overload, probe, bypass limits, or attempt to extract proprietary logic without written permission.",
      "You may not submit data that you are not legally allowed to process or that violates privacy, anti-spam, export-control, sanctions, or consumer-protection laws.",
      "We may throttle, block, suspend, or terminate accounts and API keys when we believe usage creates security, legal, payment, reputational, or operational risk.",
    ],
  },
  {
    title: "Customer data and privacy",
    body: [
      "Our Privacy Policy explains how we collect, process, store, and share information.",
      "You grant us the rights needed to process submitted data for providing, securing, maintaining, improving, and supporting the service.",
      "We do not claim ownership of customer-uploaded lists. You remain responsible for having a lawful basis to submit and process them.",
    ],
  },
  {
    title: "Service availability",
    body: [
      "We aim to keep Secwyn reliable, but we do not guarantee uninterrupted, error-free, or permanently available service.",
      "We may perform maintenance, impose rate limits, suspend risky traffic, or restrict access where needed for security, compliance, billing, platform integrity, or operational reasons.",
      "Integrations with third-party services, payment providers, APIs, DNS systems, email systems, and data sources may fail or change outside our control.",
    ],
  },
  {
    title: "Disclaimers and liability limits",
    body: [
      "To the maximum extent allowed by law, Secwyn is provided as is and as available, without warranties of merchantability, fitness for a particular purpose, non-infringement, accuracy, or uninterrupted operation.",
      "To the maximum extent allowed by law, we are not liable for lost profits, lost revenue, lost data, business interruption, reputational harm, indirect damages, consequential damages, or decisions made using risk results.",
      "Our total liability for any claim is limited to the amount you paid to Secwyn for the service giving rise to the claim during the three months before the event, or USD 100 if you used a free plan.",
    ],
  },
  {
    title: "Termination",
    body: [
      "You may stop using the service at any time. Subscription cancellation takes effect according to the applicable billing flow and payment provider rules.",
      "We may suspend or terminate access if you breach these Terms, create risk for the platform, fail to pay, initiate abusive disputes, or use the service in a way we reasonably believe is harmful or unlawful.",
      "After termination, we may retain records as needed for billing, tax, audit, security, compliance, dispute resolution, and legitimate business purposes.",
    ],
  },
];

export default function TermsPage() {
  return (
    <div className="rs-legal min-h-screen bg-gray-50">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-4 sm:px-6">
          <Link href="/" className="flex items-center gap-3">
            <SecwynMark className="h-6 w-6 text-gray-950" />
            <span className="text-lg font-bold text-gray-900">Secwyn</span>
          </Link>
          <Link href="/privacy" className="text-sm font-medium text-gray-600 hover:text-gray-900">
            Privacy
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
        <section className="mb-8">
          <p className="text-sm font-semibold uppercase tracking-wide text-blue-600">Legal</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-gray-900">Terms of Service</h1>
          <p className="mt-3 text-sm text-gray-500">Last updated: June 25, 2026</p>
          <p className="mt-5 text-gray-600">
            These Terms govern access to and use of Secwyn, including the website, dashboard, API, reports, exports, subscriptions, and integrations.
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
            <h2 className="text-lg font-semibold text-gray-900">Changes to these Terms</h2>
            <p className="mt-3 text-sm leading-6 text-gray-600">
              We may update these Terms from time to time. Updated terms apply when posted unless a different effective date is stated. Continued use of Secwyn after an update means you accept the updated Terms.
            </p>
          </section>

          <section className="rounded-lg border bg-white p-6">
            <h2 className="text-lg font-semibold text-gray-900">Contact</h2>
            <p className="mt-3 text-sm leading-6 text-gray-600">
              For support, billing, cancellation, or legal questions, contact us at{" "}
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
            <Link href="/privacy" className="hover:text-gray-900">Privacy Policy</Link>
            <Link href="/pricing" className="hover:text-gray-900">Pricing</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
