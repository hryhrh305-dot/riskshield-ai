import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Pricing - Secwyn",
  description:
    "Compare Secwyn plans by monthly decision capacity, workflow access, and client-ready pre-send audit output.",
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
