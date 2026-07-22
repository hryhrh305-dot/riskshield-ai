import Link from "next/link";
import { notFound } from "next/navigation";
import { affiliateFlagEnabled, resolveRuleVersion } from "@/modules/affiliate";
import { loadPublishedAffiliateContent } from "@/modules/affiliate/application/server";

export const metadata = { title: "India Affiliate Program | Secwyn", description: "Secwyn's independent, commission-only India affiliate program." };

export default async function IndiaAffiliatePage() {
  if (!affiliateFlagEnabled(process.env, "AFFILIATE_PUBLIC_PAGE")) notFound();
  const published = await loadPublishedAffiliateContent(["faq"]);
  const faq = published.map((item) => item.body as { q?:string;a?:string }).filter((item) => item.q && item.a);
  const rule=resolveRuleVersion("secwyn-india",new Date().toISOString());
  const plans=(["starter","growth","scale"] as const).map((plan)=>{const monthly=rule.rules.find((item)=>item.plan===plan&&item.interval==="monthly");const annual=rule.rules.find((item)=>item.plan===plan&&item.interval==="annual");if(!monthly||!annual) throw new Error("AFFILIATE_PUBLIC_RULE_UNAVAILABLE");return [plan[0].toUpperCase()+plan.slice(1),`$${(Number(monthly.directMinor)/100).toLocaleString("en-US")} monthly`,`$${(Number(annual.directMinor)/100).toLocaleString("en-US")} annual`] as const;});
  return <main className="mx-auto min-h-screen max-w-6xl px-6 py-16 text-slate-900 dark:text-slate-100">
    <p className="text-xs font-semibold uppercase tracking-[0.25em] text-cyan-700 dark:text-cyan-300">Secwyn · India</p>
    <h1 className="mt-4 max-w-4xl text-5xl font-semibold tracking-tight">Secwyn India Affiliate Program</h1>
    <p className="mt-6 max-w-3xl text-lg text-slate-600 dark:text-slate-300">An independent, commission-only opportunity for people who can introduce Secwyn to relevant B2B teams.</p>
    <div className="mt-10 grid gap-4 md:grid-cols-3">{plans.map(([plan, monthly, annual]) => <section key={plan} className="rounded-3xl border border-slate-300 bg-white/80 p-6 dark:border-slate-700 dark:bg-slate-900"><h2 className="text-xl font-semibold">{plan}</h2><p className="mt-5 text-2xl font-semibold">{monthly}</p><p className="mt-2 text-slate-600 dark:text-slate-300">{annual}</p><p className="mt-5 text-xs text-slate-500">Per qualified first customer sale. Review rules apply.</p></section>)}</div>
    <section className="mt-10 rounded-3xl border border-amber-300/70 bg-amber-50 p-7 dark:border-amber-700 dark:bg-amber-950/30"><h2 className="text-xl font-semibold">Important disclosures</h2><ul className="mt-4 grid gap-3 md:grid-cols-2">{["No base salary or guaranteed income.","No joining fee and no product purchase required.","Commission is earned only from qualified first customer sales.","Cold email, automated direct messages and bulk messaging are prohibited."].map((item) => <li key={item}>— {item}</li>)}</ul></section>
    <div className="mt-10 flex flex-wrap gap-4"><Link href="/affiliate/india/apply" className="rounded-full bg-slate-950 px-6 py-3 font-semibold text-white dark:bg-white dark:text-slate-950">Apply to the program</Link><Link href="/affiliate/india/rules" className="rounded-full border border-slate-400 px-6 py-3 font-semibold">Read the rules</Link><Link href="/affiliate/india/anti-scam" className="rounded-full border border-slate-400 px-6 py-3 font-semibold">Anti-scam notice</Link></div>
    <section className="mt-16"><h2 className="text-3xl font-semibold">Frequently asked questions</h2><div className="mt-6 grid gap-4 md:grid-cols-2">{faq.map((item) => <article key={item.q} className="rounded-2xl border border-slate-300 p-5 dark:border-slate-700"><h3 className="font-semibold">{item.q}</h3><p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{item.a}</p></article>)}</div></section>
  </main>;
}
