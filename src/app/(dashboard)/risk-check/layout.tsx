import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Risk Check - Secwyn",
  description:
    "Run single email and IP risk checks in Secwyn to inspect contact quality before adding records to outbound campaigns.",
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
