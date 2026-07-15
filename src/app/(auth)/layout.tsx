import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Account Access - Secwyn",
  description: "Access your Secwyn pre-send risk governance workspace.",
  robots: { index: false, follow: false },
};

export default function AuthLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
