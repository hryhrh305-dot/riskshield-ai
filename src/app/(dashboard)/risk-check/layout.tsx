import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Risk Check - Secwyn",
  description:
    "Inspect a single contact or IP using Secwyn's pre-send evidence and canonical decision model.",
  alternates: {
    canonical: "/risk-check",
  },
  openGraph: {
    url: "https://www.secwyn.com/risk-check",
    siteName: "Secwyn",
  },
  twitter: {
    title: "Risk Check - Secwyn",
  },
};

export default function RiskCheckLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
