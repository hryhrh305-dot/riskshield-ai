import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://njhjiavnidssjvnkcxfo.supabase.co";
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "sb_secret_oJC5RP3_DX926_NOzX_CkA_Mvq9jrIJ";

export async function POST(request: NextRequest) {
  const steps: string[] = [];
  try {
    steps.push("1");
    const supabase = createClient(URL, KEY, { auth: { persistSession: false } });
    steps.push("2");

    const { createServerClient } = await import("@supabase/ssr");
    const authClient = createServerClient(URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "", {
      cookies: {
        getAll() { return request.cookies.getAll().map(c => ({ name: c.name, value: c.value })); },
        setAll() {},
      },
    });
    steps.push("3");

    const { data: { user }, error: ue } = await authClient.auth.getUser();
    steps.push("4_" + (ue?.message || "ok"));

    if (!user) {
      return NextResponse.json({ steps, error: "no_user" }, { status: 401 });
    }

    const { data: profile, error: pe } = await supabase
      .from("profiles")
      .select("plan, credits_remaining, total_checks")
      .eq("id", user.id)
      .single();
    steps.push("5_" + (pe?.message || "ok"));

    const { data: cr, error: cre } = await supabase.rpc("consume_credit", { p_user_id: user.id });
    steps.push("6_" + (cre?.message || "ok"));

    return NextResponse.json({ success: true, steps });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    steps.push("ERR_" + msg);
    return NextResponse.json({ steps, error: msg }, { status: 500 });
  }
}
