import type { Metadata } from "next";
import HomePageClient from "@/components/home/HomePageClient";

export const metadata: Metadata = {
  title: "Secwyn - Email & IP Risk Intelligence",
  description:
    "Secwyn helps outbound teams audit lead lists, detect risky emails, suspicious IPs, and low-quality contacts before launching campaigns.",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "Secwyn - Email & IP Risk Intelligence",
    description:
      "Audit outbound lead lists before sending. Detect risky emails, suspicious IPs, and low-quality contacts with Secwyn.",
    url: "https://www.secwyn.com/",
    siteName: "Secwyn",
  },
  twitter: {
    card: "summary_large_image",
    title: "Secwyn - Email & IP Risk Intelligence",
    description:
      "Pre-send lead list audits for outbound teams. Detect risky emails, suspicious IPs, and low-quality contacts before campaigns launch.",
  },
};

export default function HomePage() {
  return <HomePageClient />;
}
