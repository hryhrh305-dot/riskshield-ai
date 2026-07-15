import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Google Sheets Guide - Secwyn",
  description:
    "Use Secwyn in Google Sheets to turn contact lists into aligned Send, Review, and Suppress decisions.",
  alternates: {
    canonical: "/docs/google-sheets",
  },
  openGraph: {
    url: "https://www.secwyn.com/docs/google-sheets",
    siteName: "Secwyn",
  },
  twitter: {
    title: "Google Sheets Guide - Secwyn",
  },
};

export default function GoogleSheetsLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
