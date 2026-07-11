import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service - Secwyn",
  description:
    "Review Secwyn terms covering subscriptions, usage limits, refunds, cancellations, acceptable use, and support.",
  alternates: {
    canonical: "/terms",
  },
  openGraph: {
    url: "https://www.secwyn.com/terms",
    siteName: "Secwyn",
  },
  twitter: {
    title: "Terms of Service - Secwyn",
  },
};

export default function TermsLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
