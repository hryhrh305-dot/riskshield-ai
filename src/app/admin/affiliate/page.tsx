import { notFound, redirect } from "next/navigation";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { affiliateOperationalFlagEnabled } from "@/modules/affiliate";
import { requireAffiliateOperator } from "@/modules/affiliate/application/server";

export default async function AffiliateAdminPage() {
  if(!affiliateOperationalFlagEnabled(process.env,"AFFILIATE_ADMIN")) notFound();
  try{await requireAffiliateOperator(["affiliate_admin","super_admin"]);}catch(error){if(error instanceof Error&&error.message==="AFFILIATE_AUTH_REQUIRED") redirect("/login?next=/admin/affiliate");redirect("/dashboard");}
  const admin = getSupabaseAdminClient();
  const [applications, memberships, outbox, deadLetters, reconciliations] = await Promise.all([
    admin.from("affiliate_applications").select("id", { count: "exact", head: true }),
    admin.from("affiliate_memberships").select("id", { count: "exact", head: true }),
    admin.from("affiliate_outbox_events").select("id", { count: "exact", head: true }).eq("status", "pending"),
    admin.from("affiliate_dead_letters").select("id", { count: "exact", head: true }).is("resolved_at", null),
    admin.from("affiliate_reconciliations").select("status,reconciliation_date").order("reconciliation_date", { ascending: false }).limit(1),
  ]);
  const cards = [["Applications", applications.count || 0], ["Memberships", memberships.count || 0], ["Pending outbox", outbox.count || 0], ["Dead letters", deadLetters.count || 0]];
  return <main className="mx-auto min-h-screen max-w-6xl px-6 py-12 text-slate-900 dark:text-slate-100"><p className="text-xs font-semibold uppercase tracking-[.25em]">Internal operations</p><h1 className="mt-4 text-4xl font-semibold">Affiliate control center</h1><div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{cards.map(([label,value])=><section key={label} className="rounded-3xl border border-slate-300 p-5 dark:border-slate-700"><p className="text-sm text-slate-500">{label}</p><p className="mt-2 text-3xl font-semibold">{value}</p></section>)}</div><section className="mt-8 rounded-3xl border border-red-300 bg-red-50 p-6 dark:border-red-800 dark:bg-red-950/20"><h2 className="font-semibold">Production safety state</h2><p className="mt-2 text-sm">All Affiliate flags default closed. Payout remains blocked unless the latest reconciliation is matched, the 72-hour freeze is complete, identity checks pass and no kill switch is active.</p><p className="mt-3 text-sm">Latest reconciliation: {reconciliations.data?.[0]?.status || "No evidence yet"}</p></section></main>;
}
