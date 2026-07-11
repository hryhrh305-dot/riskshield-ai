import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy - Secwyn",
  description:
    "Read the Secwyn Privacy Policy for information on account data, list-audit inputs, billing records, and support contact details.",
  alternates: {
    canonical: "/privacy",
  },
  openGraph: {
    url: "https://www.secwyn.com/privacy",
    siteName: "Secwyn",
  },
  twitter: {
    title: "Privacy Policy - Secwyn",
  },
};

export default function PrivacyLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
