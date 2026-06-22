import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const NEXT_PUBLIC_SUPABASE_URL = (process.env.NEXT_PUBLIC_SUPABASE_URL || "https://njhjiavnidssjvnkcxfo.supabase.co");
const SUPABASE_SERVICE_ROLE_KEY = (process.env.SUPABASE_SERVICE_ROLE_KEY || "sb_secret_oJC5RP3_DX926_NOzX_CkA_Mvq9jrIJ");
let _supabaseAdmin: any = null;
function getSupabaseAdmin() {
  if (!_supabaseAdmin) {
    const { createClient } = require("@supabase/supabase-js");
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://njhjiavnidssjvnkcxfo.supabase.co";
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || "sb_secret_oJC5RP3_DX926_NOzX_CkA_Mvq9jrIJ";
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
  const { data: profile } = await getSupabaseAdmin().from("profiles").select("risk_settings").eq("id", user.id).single();
  return NextResponse.json({ settings: profile?.risk_settings || { allow_max: 29, review_max: 59 } });
}

export async function PUT(request: NextRequest) {
  const user = await getUserFromRequest(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  let body: { allow_max?: number; review_max?: number };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  const settings = { allow_max: body.allow_max ?? 29, review_max: body.review_max ?? 59 };
  await getSupabaseAdmin().from("profiles").update({ risk_settings: settings }).eq("id", user.id);
  return NextResponse.json({ success: true, settings });
}
