import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Bulk List Audit - Secwyn",
  description:
    "Upload or paste contact lists into Secwyn and turn them into Send, Review, and Suppress decisions with export-ready audit output.",
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
