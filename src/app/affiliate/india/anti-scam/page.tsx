import { notFound } from "next/navigation";
import { affiliateFlagEnabled } from "@/modules/affiliate";

export default function AffiliateAntiScamPage() {
  if (!affiliateFlagEnabled(process.env, "AFFILIATE_PUBLIC_PAGE")) notFound();
  const never = ["charge a joining fee", "require a product purchase", "ask for your password or payout PIN", "collect payout details in Telegram", "guarantee monthly earnings", "request payment by UPI, crypto or gift card"];
  return <main className="mx-auto min-h-screen max-w-3xl px-6 py-16 text-slate-900 dark:text-slate-100"><p className="text-xs font-semibold uppercase tracking-[.25em] text-red-700 dark:text-red-300">Official safety notice</p><h1 className="mt-4 text-4xl font-semibold">Secwyn will never</h1><ul className="mt-8 space-y-3">{never.map((item)=><li key={item} className="rounded-2xl border border-red-200 bg-red-50 p-4 dark:border-red-900 dark:bg-red-950/20">— {item}.</li>)}</ul><p className="mt-8">Use only <a className="underline" href="https://www.secwyn.com">www.secwyn.com</a> and support@secwyn.com.</p></main>;
}
