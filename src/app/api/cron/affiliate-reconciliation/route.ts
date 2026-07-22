import { NextResponse } from "next/server";
import { affiliateFlagEnabled } from "@/modules/affiliate";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

const sum=(rows:readonly {amount_minor:string|number}[])=>rows.reduce((total,row)=>total+BigInt(row.amount_minor),0n);

export async function POST(request:Request){
  if(!affiliateFlagEnabled(process.env,"AFFILIATE_COMMISSION_SHADOW")) return NextResponse.json({error:"Not found."},{status:404});
  const secret=process.env.AFFILIATE_OUTBOX_CRON_SECRET;if(!secret||request.headers.get("authorization")!==`Bearer ${secret}`) return NextResponse.json({error:"Unauthorized."},{status:401});
  const admin=getSupabaseAdminClient();const today=new Date().toISOString().slice(0,10);
  const [sales,decisions,ledger,reversals,batches,incidents]=await Promise.all([
    admin.from("affiliate_sales").select("id",{count:"exact",head:true}).eq("program_id","secwyn-india").neq("status","pending"),
    admin.from("affiliate_commission_decisions").select("id,amount_minor").eq("program_id","secwyn-india"),
    admin.from("affiliate_ledger_entries").select("amount_minor").eq("program_id","secwyn-india").in("entry_type",["commission","clawback","reversal"]),
    admin.from("affiliate_ledger_entries").select("amount_minor").eq("program_id","secwyn-india").in("entry_type",["clawback","reversal"]),
    admin.from("affiliate_payout_batches").select("amount_minor").eq("program_id","secwyn-india").in("status",["approved","paid","reconciled"]),
    admin.from("affiliate_integrity_incidents").select("id",{count:"exact",head:true}).eq("program_id","secwyn-india").in("severity",["high","critical"]).in("status",["open","contained"]),
  ]);
  const queryError=sales.error||decisions.error||ledger.error||reversals.error||batches.error||incidents.error;if(queryError) return NextResponse.json({error:"Reconciliation unavailable."},{status:503});
  const decisionAmount=sum(decisions.data||[]);const reversalAmount=sum(reversals.data||[]);const expectedNet=decisionAmount+reversalAmount;const ledgerAmount=sum(ledger.data||[]);const payoutAmount=sum(batches.data||[]);const matched=(sales.count||0)===(decisions.data||[]).length&&expectedNet===ledgerAmount&&(incidents.count||0)===0;
  const evidence={sales:sales.count||0,decisions:(decisions.data||[]).length,decisionAmountMinor:decisionAmount.toString(),reversalAmountMinor:reversalAmount.toString(),expectedNetMinor:expectedNet.toString(),ledgerAmountMinor:ledgerAmount.toString(),payoutAmountMinor:payoutAmount.toString(),openHighSeverityIncidents:incidents.count||0};
  const {error}=await admin.from("affiliate_reconciliations").upsert({program_id:"secwyn-india",reconciliation_date:today,source_count:sales.count||0,decision_count:(decisions.data||[]).length,ledger_amount_minor:ledgerAmount.toString(),payout_amount_minor:payoutAmount.toString(),status:matched?"matched":"blocked",evidence},{onConflict:"program_id,reconciliation_date"});
  if(error) return NextResponse.json({error:"Reconciliation write failed."},{status:503});
  return NextResponse.json({status:matched?"matched":"blocked",evidence});
}
