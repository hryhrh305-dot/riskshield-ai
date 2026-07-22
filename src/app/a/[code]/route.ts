import { NextRequest,NextResponse } from "next/server";
import { affiliateFlagEnabled } from "@/modules/affiliate";
import { signAffiliateClick } from "@/modules/affiliate/application/attribution";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

export async function GET(request:NextRequest,{params}:{params:Promise<{code:string}>}){
  if(!affiliateFlagEnabled(process.env,"AFFILIATE_ATTRIBUTION")) return NextResponse.redirect(new URL("/",request.url));
  try{
    const {code}=await params; const admin=getSupabaseAdminClient();
    const {data}=await admin.from("affiliate_memberships").select("affiliate_code,status").eq("program_id","secwyn-india").eq("affiliate_code",code).in("status",["provisional","approved"]).maybeSingle();
    if(!data) return NextResponse.redirect(new URL("/",request.url));
    const token=signAffiliateClick({code:data.affiliate_code,clickedAt:new Date().toISOString(),source:request.nextUrl.searchParams.get("utm_source")||undefined,channelCode:request.nextUrl.searchParams.get("channel_code")||undefined});
    const response=NextResponse.redirect(new URL("/signup?source=affiliate",request.url));
    response.cookies.set("secwyn_affiliate_click",token,{httpOnly:true,secure:true,sameSite:"lax",path:"/",maxAge:30*86400}); return response;
  }catch{return NextResponse.redirect(new URL("/",request.url));}
}
