import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Pricing - Secwyn",
  description:
    "Compare Secwyn plans for pre-send list audits, campaign readiness decisions, audit reports, and outbound workflow handoff.",
  alternates: {
    canonical: "/pricing",
  },
  openGraph: {
    url: "https://www.secwyn.com/pricing",
    siteName: "Secwyn",
  },
  twitter: {
    title: "Pricing - Secwyn",
  },
};

export default function PricingLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
