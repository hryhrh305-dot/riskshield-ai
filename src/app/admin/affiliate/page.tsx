import { notFound, redirect } from "next/navigation";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { affiliateOperationalFlagEnabled } from "@/modules/affiliate";
import { requireAffiliateOperator } from "@/modules/affiliate/application/server";
import AffiliateApplicationReview from "./AffiliateApplicationReview";

export default async function AffiliateAdminPage() {
  if(!affiliateOperationalFlagEnabled(process.env,"AFFILIATE_ADMIN")) notFound();
  try{await requireAffiliateOperator(["affiliate_admin","super_admin"]);}catch(error){if(error instanceof Error&&error.message==="AFFILIATE_AUTH_REQUIRED") redirect("/login?next=/admin/affiliate");redirect("/dashboard");}
  const admin = getSupabaseAdminClient();
  const [applications, memberships, outbox, deadLetters, reconciliations,reviewQueue,rules,telegram] = await Promise.all([
    admin.from("affiliate_applications").select("id", { count: "exact", head: true }),
    admin.from("affiliate_memberships").select("id", { count: "exact", head: true }),
    admin.from("affiliate_outbox_events").select("id", { count: "exact", head: true }).eq("status", "pending"),
    admin.from("affiliate_dead_letters").select("id", { count: "exact", head: true }).is("resolved_at", null),
    admin.from("affiliate_reconciliations").select("status,reconciliation_date,evidence").order("reconciliation_date", { ascending: false }).limit(1),
    admin.from("affiliate_applications").select("id,status,created_at,review_reason").in("status",["submitted","provisional"]).order("created_at",{ascending:true}).limit(20),
    admin.from("affiliate_rule_versions").select("version,status,effective_from,effective_until,checksum").eq("program_id","secwyn-india").order("version"),
    admin.from("affiliate_telegram_publications").select("id,status,publication_type,scheduled_at,attempt_count,last_error").order("scheduled_at",{ascending:false}).limit(10),
  ]);
  const cards = [["Applications", applications.count || 0], ["Memberships", memberships.count || 0], ["Pending outbox", outbox.count || 0], ["Dead letters", deadLetters.count || 0]];
  return <main className="mx-auto min-h-screen max-w-6xl px-6 py-12 text-slate-900 dark:text-slate-100"><p className="text-xs font-semibold uppercase tracking-[.25em]">Internal operations</p><h1 className="mt-4 text-4xl font-semibold">Affiliate control center</h1><div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{cards.map(([label,value])=><section key={label} className="rounded-3xl border border-slate-300 p-5 dark:border-slate-700"><p className="text-sm text-slate-500">{label}</p><p className="mt-2 text-3xl font-semibold">{value}</p></section>)}</div>
    <div aria-label="Application review queue"><AffiliateApplicationReview applications={reviewQueue.data||[]}/></div>
    <div className="mt-8 grid gap-5 lg:grid-cols-2"><section className="rounded-3xl border border-slate-300 p-6 dark:border-slate-700"><h2 className="font-semibold">Rule versions</h2><ul className="mt-4 space-y-3 text-sm">{(rules.data||[]).map((rule)=><li key={rule.version} className="rounded-2xl bg-slate-100 px-4 py-3 dark:bg-slate-900">Version {rule.version} · {rule.status}<br/><span className="text-xs text-slate-500">{new Date(rule.effective_from).toISOString()} → {rule.effective_until?new Date(rule.effective_until).toISOString():"ongoing"}</span></li>)}</ul></section><section className="rounded-3xl border border-slate-300 p-6 dark:border-slate-700"><h2 className="font-semibold">Telegram queue</h2><p className="mt-2 text-xs text-slate-500">Preview/private delivery only. Real channel publication remains closed.</p><ul className="mt-4 space-y-3 text-sm">{(telegram.data||[]).length?(telegram.data||[]).map((item)=><li key={item.id} className="rounded-2xl bg-slate-100 px-4 py-3 dark:bg-slate-900">{item.publication_type} · {item.status} · attempt {item.attempt_count}</li>):<li className="text-slate-500">No queued Telegram publication.</li>}</ul></section></div>
    <section className="mt-8 rounded-3xl border border-red-300 bg-red-50 p-6 dark:border-red-800 dark:bg-red-950/20"><h2 className="font-semibold">Kill Switch & payout gate</h2><p className="mt-2 text-sm">The Affiliate kill switch disables every runtime capability. Real commission and payout stay closed. Finance cannot change rule versions; Content Admin cannot approve payout.</p><p className="mt-3 text-sm">Latest reconciliation: {reconciliations.data?.[0]?.status || "No evidence yet"}</p></section>
  </main>;
}
