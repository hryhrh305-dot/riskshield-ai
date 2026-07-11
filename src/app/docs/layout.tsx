import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "API Docs - Secwyn",
  description:
    "Read Secwyn API documentation for email and IP risk checks, authentication, request formats, and integration examples.",
  alternates: {
    canonical: "/docs",
  },
  openGraph: {
    url: "https://www.secwyn.com/docs",
    siteName: "Secwyn",
  },
  twitter: {
    title: "API Docs - Secwyn",
  },
};

export default function DocsLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
