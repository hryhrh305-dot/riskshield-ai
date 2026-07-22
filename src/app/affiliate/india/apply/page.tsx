import { notFound, redirect } from "next/navigation";
import { affiliateFlagEnabled } from "@/modules/affiliate";
import { createServerSupabaseClient } from "@/lib/supabase-server";

export default async function AffiliateApplyPage() {
  if (!affiliateFlagEnabled(process.env, "AFFILIATE_APPLICATIONS")) notFound();
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/login?next=/affiliate/india/apply");
  const questions=[
    ["quiz_relationship","How is the affiliate relationship structured?",[["independent","Independent and commission-only"],["employee","Employment with guaranteed pay"]]],
    ["quiz_disclosure","When should an affiliate disclosure be used?",[["always","Whenever an affiliate link or recommendation is shared"],["never","It is optional"]]],
    ["quiz_outreach","Which outreach is permitted?",[["consent","Relevant, consent-aware outreach without cold email, automated DMs or bulk messaging"],["bulk","Unsolicited bulk outreach"]]],
    ["quiz_claims","What may you promise?",[["evidence","Only accurate, approved claims without guaranteed outcomes"],["guarantee","Guaranteed revenue or delivery"]]],
    ["quiz_stop","What happens after a stop-contact request?",[["stop","Stop contact across channels"],["switch","Switch channels and continue"]]],
  ] as const;
  return <main className="mx-auto min-h-screen max-w-2xl px-6 py-16 text-slate-900 dark:text-slate-100"><h1 className="text-4xl font-semibold">Apply to the India Affiliate Program</h1><p className="mt-4 text-slate-600 dark:text-slate-300">Applications are reviewed. No joining fee or purchase is required.</p><form action="/api/affiliate/applications" method="post" className="mt-8 space-y-5"><label className="block">Professional background<textarea name="background" required maxLength={2000} className="mt-2 min-h-32 w-full rounded-2xl border border-slate-400 bg-transparent p-4" /></label><label className="block">How will you promote Secwyn?<textarea name="promotion_plan" required maxLength={2000} className="mt-2 min-h-32 w-full rounded-2xl border border-slate-400 bg-transparent p-4" /></label><fieldset className="space-y-4 rounded-3xl border border-slate-300 p-5 dark:border-slate-700"><legend className="px-2 font-semibold">Policy check · 5 questions</legend>{questions.map(([name,label,options])=><label key={name} className="block text-sm">{label}<select name={name} required defaultValue="" className="mt-2 w-full rounded-xl border border-slate-400 bg-transparent p-3"><option value="" disabled>Select an answer</option>{options.map(([value,text])=><option key={value} value={value}>{text}</option>)}</select></label>)}</fieldset><label className="flex gap-3"><input type="checkbox" name="independent_disclosure" required /> I understand this is commission-only, not employment, and income is not guaranteed.</label><label className="flex gap-3"><input type="checkbox" name="anti_spam" required /> I accept the current policy, affiliate disclosure, anti-spam and global stop-contact rules.</label><button className="rounded-full bg-slate-950 px-6 py-3 font-semibold text-white dark:bg-white dark:text-slate-950">Submit application</button></form></main>;
}
