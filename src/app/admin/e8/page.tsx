import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { isAdminEmail } from "@/lib/admin";
import { getE8Flags } from "@/lib/e8/flags";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Params = { from?: string; to?: string; campaign?: string; list_tier?: string; template?: string; step?: string; country?: string; keyword?: string; provider?: string };
type Props = { searchParams?: Promise<Params> };

const METRICS = [
  ["Send", "send"], ["Delivery", "delivery"], ["Hard Bounce", "hard_bounce"], ["Complaint", "complaint"],
  ["Delay", "delivery_delay"], ["Reject", "reject"], ["Suppressed", "suppressed"], ["Landing", "landing_session_started"],
  ["Signups", "signup_completed"], ["Activations", "activation_completed"], ["Checkout", "checkout_started"],
  ["First Payments", "first_payment"], ["Renewals", "renewal"], ["Refunds", "refund"],
  ["Needs review", "subscription_paid_unclassified"],
] as const;

function iso(value: string | undefined) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

export default async function E8Dashboard({ searchParams }: Props) {
  const flags = getE8Flags();
  if (!flags.dashboard) notFound();
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?reason=invalid_session&next=/admin/e8");
  if (!isAdminEmail(user.email)) redirect("/dashboard");

  const params = (await searchParams) || {};
  const from = iso(params.from);
  const to = iso(params.to);
  const admin = getSupabaseAdminClient();
  const counts: Record<string, number> = Object.fromEntries(METRICS.map(([, key]) => [key, 0]));
  let campaigns: Array<{ id: string; name: string; status: string; safety_pause_reason: string | null }> = [];
  let anomalies: Array<{ id: string; event_type: string; occurred_at: string; provider_message_id: string | null }> = [];

  try {
    let campaignQuery = admin.from("outreach_campaigns").select("id,name,status,safety_pause_reason").order("created_at", { ascending: false }).limit(50);
    if (params.campaign) campaignQuery = campaignQuery.eq("id", params.campaign);
    if (params.list_tier) campaignQuery = campaignQuery.eq("list_tier", params.list_tier.slice(0, 100));
    if (params.template) campaignQuery = campaignQuery.eq("template_key", params.template.slice(0, 100));
    if (params.step) campaignQuery = campaignQuery.eq("step_key", params.step.slice(0, 100));
    if (params.country) campaignQuery = campaignQuery.eq("country_code", params.country.slice(0, 8));
    if (params.provider) campaignQuery = campaignQuery.eq("provider", params.provider.slice(0, 50));
    if (params.keyword) campaignQuery = campaignQuery.eq("source_keyword", params.keyword.slice(0, 100));
    const campaignResult = await campaignQuery;
    if (campaignResult.error) throw campaignResult.error;
    campaigns = (campaignResult.data || []) as typeof campaigns;

    const emailTypes = ["send", "delivery", "hard_bounce", "complaint", "delivery_delay", "reject"];
    await Promise.all(emailTypes.map(async (eventType) => {
      let query = admin.from("email_events").select("id", { count: "exact", head: true }).eq("event_type", eventType);
      if (from) query = query.gte("occurred_at", from);
      if (to) query = query.lte("occurred_at", to);
      if (params.campaign) query = query.eq("campaign_id", params.campaign);
      if (params.list_tier) query = query.eq("list_tier", params.list_tier.slice(0, 100));
      if (params.template) query = query.eq("template_key", params.template.slice(0, 100));
      if (params.step) query = query.eq("step_key", params.step.slice(0, 100));
      if (params.country) query = query.eq("country_code", params.country.slice(0, 8));
      if (params.keyword) query = query.eq("source_keyword", params.keyword.slice(0, 100));
      if (params.provider) query = query.eq("provider", params.provider.slice(0, 50));
      const result = await query;
      if (result.error) throw result.error;
      counts[eventType] = result.count || 0;
    }));
    let suppressed = admin.from("suppression_list").select("id", { count: "exact", head: true }).eq("permanent", true);
    if (from) suppressed = suppressed.gte("suppressed_at", from);
    if (to) suppressed = suppressed.lte("suppressed_at", to);
    if (params.campaign) suppressed = suppressed.eq("campaign_id", params.campaign);
    if (params.list_tier) suppressed = suppressed.eq("list_tier", params.list_tier.slice(0, 100));
    if (params.template) suppressed = suppressed.eq("template_key", params.template.slice(0, 100));
    if (params.step) suppressed = suppressed.eq("step_key", params.step.slice(0, 100));
    if (params.country) suppressed = suppressed.eq("country_code", params.country.slice(0, 8));
    if (params.keyword) suppressed = suppressed.eq("source_keyword", params.keyword.slice(0, 100));
    if (params.provider) suppressed = suppressed.eq("provider", params.provider.slice(0, 50));
    const suppressedResult = await suppressed;
    if (suppressedResult.error) throw suppressedResult.error;
    counts.suppressed = suppressedResult.count || 0;

    await Promise.all(["landing_session_started", "signup_completed", "activation_completed", "checkout_started"].map(async (eventName) => {
      let query = admin.from("product_events").select("id", { count: "exact", head: true }).eq("event_name", eventName);
      if (from) query = query.gte("occurred_at", from);
      if (to) query = query.lte("occurred_at", to);
      if (params.campaign) query = query.eq("campaign_id", params.campaign);
      if (params.list_tier) query = query.eq("list_tier", params.list_tier.slice(0, 100));
      if (params.template) query = query.eq("template_key", params.template.slice(0, 100));
      if (params.step) query = query.eq("step_key", params.step.slice(0, 100));
      if (params.country) query = query.eq("country_code", params.country.slice(0, 8));
      if (params.keyword) query = query.eq("source_keyword", params.keyword.slice(0, 100));
      if (params.provider) query = query.eq("provider", params.provider.slice(0, 50));
      const result = await query;
      if (result.error) throw result.error;
      counts[eventName] = result.count || 0;
    }));
    await Promise.all(["first_payment", "renewal", "refund", "subscription_paid_unclassified"].map(async (eventType) => {
      let query = admin.from("subscription_events").select("id", { count: "exact", head: true }).eq("event_type", eventType);
      if (from) query = query.gte("received_at", from);
      if (to) query = query.lte("received_at", to);
      if (params.campaign) query = query.eq("campaign_id", params.campaign);
      if (params.list_tier) query = query.eq("list_tier", params.list_tier.slice(0, 100));
      if (params.template) query = query.eq("template_key", params.template.slice(0, 100));
      if (params.step) query = query.eq("step_key", params.step.slice(0, 100));
      if (params.country) query = query.eq("country_code", params.country.slice(0, 8));
      if (params.keyword) query = query.eq("source_keyword", params.keyword.slice(0, 100));
      if (params.provider) query = query.eq("provider", params.provider.slice(0, 50));
      const result = await query;
      if (result.error) throw result.error;
      counts[eventType] = result.count || 0;
    }));
    let anomalyQuery = admin.from("email_events")
      .select("id,event_type,occurred_at,provider_message_id")
      .in("event_type", ["hard_bounce", "complaint", "reject", "delivery_delay", "unknown"])
      .order("occurred_at", { ascending: false }).limit(20);
    if (from) anomalyQuery = anomalyQuery.gte("occurred_at", from);
    if (to) anomalyQuery = anomalyQuery.lte("occurred_at", to);
    if (params.campaign) anomalyQuery = anomalyQuery.eq("campaign_id", params.campaign);
    if (params.list_tier) anomalyQuery = anomalyQuery.eq("list_tier", params.list_tier.slice(0, 100));
    if (params.template) anomalyQuery = anomalyQuery.eq("template_key", params.template.slice(0, 100));
    if (params.step) anomalyQuery = anomalyQuery.eq("step_key", params.step.slice(0, 100));
    if (params.country) anomalyQuery = anomalyQuery.eq("country_code", params.country.slice(0, 8));
    if (params.keyword) anomalyQuery = anomalyQuery.eq("source_keyword", params.keyword.slice(0, 100));
    if (params.provider) anomalyQuery = anomalyQuery.eq("provider", params.provider.slice(0, 50));
    const anomalyResult = await anomalyQuery;
    if (anomalyResult.error) throw anomalyResult.error;
    anomalies = (anomalyResult.data || []) as typeof anomalies;
  } catch {
    // A not-yet-migrated Preview or empty database renders safe zero/no-data state.
  }

  return (
    <main className="rs-shell min-h-screen px-4 py-8 text-white sm:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div><div className="text-xs uppercase tracking-[0.22em] text-slate-500">Internal · read only</div><h1 className="mt-2 text-3xl font-semibold">E8 Revenue Observability</h1></div>
          <Link href="/dashboard" className="rs-button-secondary rounded-full px-4 py-2 text-sm">Back to Dashboard</Link>
        </header>
        <section className={`rounded-2xl border p-4 ${flags.globalKillSwitch ? "border-amber-500/30 bg-amber-500/10" : "border-emerald-500/30 bg-emerald-500/10"}`}>
          <strong>Outreach global kill switch: {flags.globalKillSwitch ? "ON" : "OFF"}</strong>
          <p className="mt-1 text-sm text-slate-300">This dashboard never sends email and never controls authentication or transactional mail.</p>
        </section>
        <form className="rs-card grid gap-3 rounded-3xl p-4 md:grid-cols-4">
          {(["from","to","campaign","list_tier","template","step","country","keyword","provider"] as const).map((key) => (
            <input key={key} name={key} type={key === "from" || key === "to" ? "date" : "text"} defaultValue={params[key]} placeholder={key.replace("_", " ")} className="rs-input px-3 py-2 text-sm" />
          ))}
          <button className="rs-button-primary rounded-full px-4 py-2 text-sm">Apply filters</button>
        </form>
        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
          {METRICS.map(([label, key]) => <div key={key} className="rs-panel rounded-2xl p-4"><div className="text-xs text-slate-400">{label}</div><div className="mt-2 text-2xl font-semibold">{counts[key].toLocaleString()}</div></div>)}
        </section>
        {counts.subscription_paid_unclassified > 0 ? <p className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-200">Paid subscription events with incomplete provider period fields need reconciliation review; they are not counted as first payments or renewals.</p> : null}
        <section className="grid gap-6 lg:grid-cols-2">
          <div className="rs-card rounded-3xl p-5"><h2 className="font-semibold">Campaign status</h2>{campaigns.length ? <div className="mt-4 space-y-2">{campaigns.map((campaign) => <div key={campaign.id} className="rounded-xl border border-white/10 p-3 text-sm"><span className="font-medium">{campaign.name}</span><span className="ml-2 text-slate-400">{campaign.status}</span>{campaign.safety_pause_reason ? <div className="mt-1 text-amber-300">{campaign.safety_pause_reason}</div> : null}</div>)}</div> : <p className="mt-4 text-sm text-slate-400">No campaign data.</p>}</div>
          <div className="rs-card rounded-3xl p-5"><h2 className="font-semibold">Recent anomalies</h2>{anomalies.length ? <div className="mt-4 space-y-2">{anomalies.map((event) => <div key={event.id} className="flex justify-between rounded-xl border border-white/10 p-3 text-sm"><span>{event.event_type}</span><time className="text-slate-500">{new Date(event.occurred_at).toLocaleString()}</time></div>)}</div> : <p className="mt-4 text-sm text-slate-400">No anomaly data.</p>}</div>
        </section>
      </div>
    </main>
  );
}
