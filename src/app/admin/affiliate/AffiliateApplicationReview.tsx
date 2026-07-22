"use client";

import { useState } from "react";

type Application={id:string;status:string;created_at:string;review_reason?:string|null};

const applicationDateFormatter = new Intl.DateTimeFormat("en-IN", {
  timeZone: "Asia/Kolkata",
  dateStyle: "medium",
  timeStyle: "short",
  hourCycle: "h23",
});

export default function AffiliateApplicationReview({applications}:{applications:Application[]}){
  const [message,setMessage]=useState("");
  async function review(id:string,action:"approve_provisional"|"reject"|"suspend"){
    const reason=window.prompt(`Reason for ${action.replaceAll("_"," ")}:`);
    if(!reason||reason.trim().length<3) return;
    const response=await fetch(`/api/admin/affiliate/applications/${id}`,{method:"PATCH",headers:{"content-type":"application/json"},body:JSON.stringify({action,reason:reason.trim()})});
    const payload=await response.json();
    setMessage(response.ok?"Application review saved. Refresh to see the new state.":payload.error||"Review failed.");
  }
  return <section className="mt-8 overflow-hidden rounded-3xl border border-slate-300 dark:border-slate-700"><div className="border-b border-slate-300 px-6 py-4 dark:border-slate-700"><h2 className="font-semibold">Application review queue</h2><p className="mt-1 text-xs text-slate-500">Every approval, rejection and suspension requires a reason and writes an audit event.</p></div>{message&&<p className="border-b border-slate-200 px-6 py-3 text-sm dark:border-slate-800">{message}</p>}{applications.length===0?<p className="px-6 py-8 text-sm text-slate-500">No synthetic Preview applications are waiting.</p>:applications.map((application)=><div key={application.id} className="flex flex-wrap items-center justify-between gap-4 border-t border-slate-200 px-6 py-4 first:border-t-0 dark:border-slate-800"><div><p className="font-mono text-xs">{application.id}</p><p className="mt-1 text-sm capitalize">{application.status} · {applicationDateFormatter.format(new Date(application.created_at))}</p></div><div className="flex flex-wrap gap-2"><button onClick={()=>review(application.id,"approve_provisional")} className="rounded-full border px-3 py-1.5 text-xs">Approve provisional</button><button onClick={()=>review(application.id,"reject")} className="rounded-full border px-3 py-1.5 text-xs">Reject</button><button onClick={()=>review(application.id,"suspend")} className="rounded-full border px-3 py-1.5 text-xs">Suspend</button></div></div>)}</section>;
}
