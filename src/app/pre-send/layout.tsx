import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Pre-send Audit History - Secwyn",
  description:
    "Review past Secwyn pre-send audits, approval decisions, and list risk breakdowns before launch.",
  alternates: {
    canonical: "/pre-send",
  },
  openGraph: {
    url: "https://www.secwyn.com/pre-send",
    siteName: "Secwyn",
  },
  twitter: {
    title: "Pre-send Audit History - Secwyn",
  },
};

export default function PreSendLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
