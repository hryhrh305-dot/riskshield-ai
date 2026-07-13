import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AttributionObserver } from "@/components/e8/AttributionObserver";
import { getE8Flags } from "@/lib/e8/flags";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://www.secwyn.com"),
  title: "Secwyn - Email & IP Risk Intelligence",
  description:
    "Secwyn helps outbound teams audit lead lists, detect risky emails, suspicious IPs, and low-quality contacts before launching campaigns.",
  openGraph: {
    title: "Secwyn - Email & IP Risk Intelligence",
    description:
      "Audit outbound lead lists before sending. Detect risky emails, suspicious IPs, and low-quality contacts with Secwyn.",
    siteName: "Secwyn",
  },
  twitter: {
    card: "summary_large_image",
    title: "Secwyn - Email & IP Risk Intelligence",
    description:
      "Pre-send lead list audits for outbound teams. Detect risky emails, suspicious IPs, and low-quality contacts before campaigns launch.",
  },
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
    shortcut: "/icon.svg",
    apple: [{ url: "/apple-icon.svg", type: "image/svg+xml" }],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const e8Enabled = getE8Flags().observability && getE8Flags().attribution;
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={geistSans.variable + " " + geistMono.variable + " h-full antialiased"}
    >
      <body className="min-h-full flex flex-col overflow-x-hidden">
        {e8Enabled ? <AttributionObserver /> : null}
        {children}
      </body>
    </html>
  );
}
