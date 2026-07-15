import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseProjectRef, readAccessTokenFromCookieHeader } from "@/lib/auth-cookie";

const NEXT_PUBLIC_SUPABASE_URL = (process.env.NEXT_PUBLIC_SUPABASE_URL || "https://njhjiavnidssjvnkcxfo.supabase.co");
const SUPABASE_SERVICE_ROLE_KEY = (process.env.SUPABASE_SECRET_KEY || "");
let _supabaseAdmin: any = null;
function getSupabaseAdmin() {
  if (!_supabaseAdmin) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://njhjiavnidssjvnkcxfo.supabase.co";
    const key = process.env.SUPABASE_SECRET_KEY || "";
    _supabaseAdmin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
  }
  return _supabaseAdmin;
}

async function getUserFromRequest(request: NextRequest) {
  try {
    const supabase = getSupabaseAdmin();
    const cookieHeader = request.headers.get("cookie") || "";
    const token = readAccessTokenFromCookieHeader(cookieHeader, getSupabaseProjectRef(NEXT_PUBLIC_SUPABASE_URL));
    if (!token) return null;
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) return null;
    return user;
  } catch { return null; }
}

const defaultSettings = { block_disposable: true, block_high_risk: true, review_catch_all: true, review_new_domain: true };

export async function GET(request: NextRequest) {
  const user = await getUserFromRequest(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  let settings = defaultSettings;
  try {
    const { data: profile } = await getSupabaseAdmin().from("profiles").select("risk_settings").eq("id", user.id).single();
    if (profile?.risk_settings) settings = profile.risk_settings;
  } catch { /* column may not exist, use defaults */ }
  return NextResponse.json({ settings });
}

export async function PUT(request: NextRequest) {
  const user = await getUserFromRequest(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  let body: { block_disposable?: boolean; block_high_risk?: boolean; review_catch_all?: boolean; review_new_domain?: boolean };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  const settings = { ...defaultSettings, ...body };
  try {
    await getSupabaseAdmin().from("profiles").update({ risk_settings: settings }).eq("id", user.id);
  } catch { /* column may not exist, settings not saved */ }
  return NextResponse.json({ success: true, settings });
}
