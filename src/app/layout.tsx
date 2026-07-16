import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import { AttributionObserver } from "@/components/e8/AttributionObserver";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
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
  title: "Secwyn - Pre-Send Risk Governance",
  description:
    "Approve high-value outbound campaigns with Send, Review, and Suppress decisions, traceable evidence, and client-ready audit output before the first send.",
  openGraph: {
    title: "Secwyn - Pre-Send Risk Governance",
    description:
      "Turn available contact, domain, and infrastructure signals into defensible pre-send decisions and client-ready evidence.",
    siteName: "Secwyn",
  },
  twitter: {
    card: "summary_large_image",
    title: "Secwyn - Pre-Send Risk Governance",
    description:
      "Approve high-value campaigns with defensible Send, Review, and Suppress decisions before the first send.",
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
        <Script id="secwyn-theme-init" strategy="beforeInteractive">{`
          (function () {
            try {
              var stored = localStorage.getItem("secwyn-theme");
              var theme = stored === "light" || stored === "dark"
                ? stored
                : "light";
              document.documentElement.dataset.theme = theme;
              document.documentElement.style.colorScheme = theme;
            } catch (error) {
              document.documentElement.dataset.theme = "light";
              document.documentElement.style.colorScheme = "light";
            }
          })();
        `}</Script>
        {e8Enabled ? <AttributionObserver /> : null}
        {children}
        <ThemeToggle />
      </body>
    </html>
  );
}
