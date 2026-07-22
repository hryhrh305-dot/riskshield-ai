import { notFound, redirect } from "next/navigation";
import AffiliateContentEditor from "./AffiliateContentEditor";
import { affiliateOperationalFlagEnabled } from "@/modules/affiliate";
import { requireAffiliateOperator } from "@/modules/affiliate/application/server";

export default async function AffiliateContentPage(){
  if(!affiliateOperationalFlagEnabled(process.env,"AFFILIATE_CONTENT_ADMIN")) notFound();
  try{await requireAffiliateOperator(["content_editor","compliance_reviewer","program_manager","publisher","super_admin"]);}catch(error){if(error instanceof Error&&error.message==="AFFILIATE_AUTH_REQUIRED") redirect("/login?next=/admin/affiliate/content");redirect("/dashboard");}
  return <main className="mx-auto min-h-screen max-w-5xl px-6 py-12 text-slate-900 dark:text-slate-100"><p className="text-xs font-semibold uppercase tracking-[.25em]">Affiliate operations</p><h1 className="mt-4 text-4xl font-semibold">Content library</h1><p className="mt-3 text-slate-600 dark:text-slate-300">Create versioned drafts, preview them, approve, schedule, publish or roll back. Published versions are immutable.</p><AffiliateContentEditor /></main>;
}
