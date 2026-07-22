import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { isAdminEmail } from "@/lib/admin";
import { affiliateOperationalFlagEnabled } from "@/modules/affiliate";

export async function PATCH(request:Request,{params}:{params:Promise<{id:string}>}){
  if(!affiliateOperationalFlagEnabled(process.env,"AFFILIATE_ADMIN")) return NextResponse.json({error:"Not found."},{status:404});
  const supabase=await createServerSupabaseClient();const {data}=await supabase.auth.getUser();if(!data.user||!isAdminEmail(data.user.email)) return NextResponse.json({error:"Forbidden."},{status:403});
  const input=await request.json();if(!["approve_provisional","reject","suspend"].includes(input.action)||typeof input.reason!=="string"||input.reason.length<3) return NextResponse.json({error:"Action and reason required."},{status:400});
  const {id}=await params;const admin=getSupabaseAdminClient();const {data:application}=await admin.from("affiliate_applications").select("id,user_id,program_id,status").eq("id",id).single();if(!application) return NextResponse.json({error:"Not found."},{status:404});
  const code=input.action==="approve_provisional"?randomBytes(8).toString("base64url"):null;const {error}=await admin.rpc("affiliate_review_application",{p_application_id:id,p_actor_id:data.user.id,p_action:input.action,p_reason:input.reason,p_affiliate_code:code,p_correlation_id:crypto.randomUUID()});if(error) return NextResponse.json({error:"Application review failed."},{status:500});
  return NextResponse.json({ok:true});
}
