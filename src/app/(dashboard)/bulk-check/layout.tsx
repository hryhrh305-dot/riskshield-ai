import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Bulk List Audit - Secwyn",
  description:
    "Audit up to 5,000 contacts per Web run and produce Send, Review, and Suppress decisions with export-ready evidence.",
  alternates: {
    canonical: "/bulk-check",
  },
  openGraph: {
    url: "https://www.secwyn.com/bulk-check",
    siteName: "Secwyn",
  },
  twitter: {
    title: "Bulk List Audit - Secwyn",
  },
};

export default function BulkCheckLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
