import type { Metadata } from "next";
import HomePageClient from "@/components/home/HomePageClient";

export const metadata: Metadata = {
  title: "Secwyn - Pre-Send Risk Governance",
  description:
    "Approve high-value outbound campaigns with defensible Send, Review, and Suppress decisions before the first send.",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "Secwyn - Pre-Send Risk Governance",
    description:
      "Turn available contact, domain, and infrastructure signals into pre-send decisions and client-ready evidence.",
    url: "https://www.secwyn.com/",
    siteName: "Secwyn",
  },
  twitter: {
    card: "summary_large_image",
    title: "Secwyn - Pre-Send Risk Governance",
    description:
      "Approve high-value campaigns with defensible decisions before the first send.",
  },
};

export default function HomePage() {
  return <HomePageClient />;
}
