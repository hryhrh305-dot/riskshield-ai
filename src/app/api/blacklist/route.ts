import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const NEXT_PUBLIC_SUPABASE_URL = (process.env.NEXT_PUBLIC_SUPABASE_URL || "https://njhjiavnidssjvnkcxfo.supabase.co");
const SUPABASE_SERVICE_ROLE_KEY = (process.env.SUPABASE_SERVICE_ROLE_KEY || "sb_secret_oJC5RP3_DX926_NOzX_CkA_Mvq9jrIJ");
const supabaseAdmin = createClient(NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function getUserFromRequest(request: NextRequest) {
  try {
    const { createServerClient } = await import("@supabase/ssr");
    const supabase = createServerClient(
      NEXT_PUBLIC_SUPABASE_URL,
      (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "sb_publishable_6pS7tKkxxBqYTLcAUu_GPg_0BysHHx8"),
      { cookies: { getAll() { return request.cookies.getAll().map(c => ({ name: c.name, value: c.value })); }, setAll() {} } }
    );
    const { data: { user } } = await supabase.auth.getUser();
    return user;
  } catch { return null; }
}

export async function GET(request: NextRequest) {
  const user = await getUserFromRequest(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data } = await supabaseAdmin
    .from("blacklist")
    .select("*")
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(50);

  return NextResponse.json({ blacklist: data || [] });
}

export async function POST(request: NextRequest) {
  const user = await getUserFromRequest(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { type?: string; value?: string; reason?: string };
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { type, value, reason } = body;
  if (!type || !value || !["ip", "email", "domain"].includes(type)) {
    return NextResponse.json({ error: "type (ip/email/domain) and value are required" }, { status: 400 });
  }

  const existing = await supabaseAdmin
    .from("blacklist")
    .select("id")
    .eq("type", type)
    .eq("value", value.toLowerCase().trim())
    .eq("status", "active")
    .single();

  if (existing.data) {
    return NextResponse.json({ error: "Already in blacklist" }, { status: 409 });
  }

  await supabaseAdmin.from("blacklist").insert({
    type,
    value: value.toLowerCase().trim(),
    reason: reason || "Manual add by user",
    risk_score: 90,
    hit_count: 0,
    status: "active",
    created_by: user.id,
  });

  return NextResponse.json({ success: true });
}

export async function DELETE(request: NextRequest) {
  const user = await getUserFromRequest(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  await supabaseAdmin.from("blacklist").update({ status: "removed" }).eq("id", id);

  return NextResponse.json({ success: true });
}
