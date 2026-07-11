import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Google Sheets Guide - Secwyn",
  description:
    "Set up the Secwyn Google Sheets workflow to scan contact lists with your API key and export list-audit results.",
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
