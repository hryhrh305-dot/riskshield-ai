import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const NEXT_PUBLIC_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://njhjiavnidssjvnkcxfo.supabase.co";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

const supabase = SUPABASE_SERVICE_ROLE_KEY
  ? createClient(NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    })
  : null;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const email = String(body?.email || "").trim().toLowerCase();

    if (!email) {
      return NextResponse.json({ error: "Email is required." }, { status: 400 });
    }

    if (!supabase) {
      return NextResponse.json({ error: "Server auth is not configured." }, { status: 500 });
    }

    let page = 1;
    while (true) {
      const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      const users = data?.users || [];
      const matched = users.find((user) => (user.email || "").toLowerCase() === email);
      if (matched) {
        return NextResponse.json({
          exists: true,
          confirmed: !!matched.email_confirmed_at,
        });
      }

      if (users.length < 200) break;
      page += 1;
    }

    return NextResponse.json({ exists: false, confirmed: false });
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
}
