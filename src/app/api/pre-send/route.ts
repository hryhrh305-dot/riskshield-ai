import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const NEXT_PUBLIC_SUPABASE_URL = (process.env.NEXT_PUBLIC_SUPABASE_URL || "https://njhjiavnidssjvnkcxfo.supabase.co");
const SUPABASE_SERVICE_ROLE_KEY = (process.env.SUPABASE_SECRET_KEY || "");
let _supabaseAdmin: any = null;
function getSupabaseAdmin() {
  if (!_supabaseAdmin) {
    const { createClient } = require("@supabase/supabase-js");
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://njhjiavnidssjvnkcxfo.supabase.co";
    const key = process.env.SUPABASE_SECRET_KEY || "";
    _supabaseAdmin = createClient(url, key);
  }
  return _supabaseAdmin;
}

async function getUserFromRequest(request: NextRequest) {
  try {
    const { createServerClient } = await import("@supabase/ssr");
    const supabase = createServerClient(
      NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "sb_publishable_6pS7tKkxxBqYTLcAUu_GPg_0BysHHx8",
      { cookies: { getAll() { return request.cookies.getAll().map(c => ({ name: c.name, value: c.value })); }, setAll() {} } }
    );
    const { data: { user } } = await supabase.auth.getUser();
    return user;
  } catch { return null; }
}

export async function GET(request: NextRequest) {
  const user = await getUserFromRequest(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const campaignId = request.nextUrl.searchParams.get("campaign_id");
  if (campaignId) {
    const { data: results } = await getSupabaseAdmin()
      .from("pre_send_results")
      .select("id, email, risk_score, decision, reasons")
      .eq("check_id", campaignId)
      .order("created_at", { ascending: true })
      .limit(500);
    return NextResponse.json({ results: (results || []).map((r: any) => ({ ...r, reasons: r.reasons || [] })) });
  }

  const { data: campaigns } = await getSupabaseAdmin()
    .from("pre_send_checks")
    .select("id, campaign_name, total_contacts, allowed_count, review_count, blocked_count, risk_score_avg, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(50);
  return NextResponse.json({ campaigns: campaigns || [] });
}
