import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Pre-Send Decision API - Secwyn",
  description:
    "Integrate Secwyn's canonical Send, Review, and Suppress decisions into a governed pre-send workflow.",
  alternates: {
    canonical: "/docs",
  },
  openGraph: {
    url: "https://www.secwyn.com/docs",
    siteName: "Secwyn",
  },
  twitter: {
    title: "Pre-Send Decision API - Secwyn",
  },
};

export default function DocsLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
