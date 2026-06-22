import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const NEXT_PUBLIC_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://njhjiavnidssjvnkcxfo.supabase.co";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

const supabase = createClient(NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function execSQL(sql: string): Promise<string> {
  // Try RPC first
  try {
    const { error } = await supabase.rpc("exec_sql", { sql });
    if (!error) return "OK";
  } catch { /* RPC not available, fall through */ }

  // Fallback: Use Supabase Management API via fetch
  try {
    const res = await fetch(NEXT_PUBLIC_SUPABASE_URL + "/rest/v1/", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": SUPABASE_SERVICE_ROLE_KEY,
        "Authorization": "Bearer " + SUPABASE_SERVICE_ROLE_KEY,
        "Accept": "application/json",
      },
      body: JSON.stringify({ query: sql }),
    });
    if (res.ok) return "OK (REST)";
    const text = await res.text();
    return "REST " + res.status + ": " + text.substring(0, 80);
  } catch (e: any) {
    return "FAIL: " + (e.message || String(e)).substring(0, 80);
  }
}

// Individual SQL statements that don't need CREATE FUNCTION
const SQL_LIST: string[] = [
  // Profiles columns
  "ALTER TABLE profiles ADD COLUMN IF NOT EXISTS subscription_end TIMESTAMPTZ",
  "ALTER TABLE profiles ADD COLUMN IF NOT EXISTS subscription_status TEXT DEFAULT 'active'",
  "ALTER TABLE profiles ADD COLUMN IF NOT EXISTS risk_settings JSONB",
  "ALTER TABLE profiles ADD COLUMN IF NOT EXISTS credits_remaining INTEGER DEFAULT 1000",
  "ALTER TABLE profiles ADD COLUMN IF NOT EXISTS total_checks INTEGER DEFAULT 0",

  // pre_send_checks table
  "CREATE TABLE IF NOT EXISTS pre_send_checks (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE, campaign_name TEXT DEFAULT '', total_contacts INTEGER DEFAULT 0, allowed_count INTEGER DEFAULT 0, review_count INTEGER DEFAULT 0, blocked_count INTEGER DEFAULT 0, risk_score_avg INTEGER DEFAULT 0, status TEXT DEFAULT 'completed' CHECK (status IN ('completed','processing','failed')), created_at TIMESTAMPTZ DEFAULT NOW())",
  "CREATE INDEX IF NOT EXISTS idx_pre_send_checks_user ON pre_send_checks(user_id, created_at)",

  // pre_send_results table
  "CREATE TABLE IF NOT EXISTS pre_send_results (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), check_id UUID REFERENCES pre_send_checks(id) ON DELETE CASCADE, email TEXT NOT NULL, risk_score INTEGER DEFAULT 0, decision TEXT DEFAULT 'ALLOW' CHECK (decision IN ('ALLOW','REVIEW','BLOCK')), reasons JSONB DEFAULT '[]', created_at TIMESTAMPTZ DEFAULT NOW())",
  "CREATE INDEX IF NOT EXISTS idx_pre_send_results_check ON pre_send_results(check_id)",

  // RLS
  "ALTER TABLE pre_send_checks ENABLE ROW LEVEL SECURITY",
  "ALTER TABLE pre_send_results ENABLE ROW LEVEL SECURITY",

  // RLS policies
  "CREATE POLICY IF NOT EXISTS 'Users read own pre_send' ON pre_send_checks FOR SELECT USING (auth.uid() = user_id)",
  "CREATE POLICY IF NOT EXISTS 'Users read own pre_send_results' ON pre_send_results FOR SELECT USING (EXISTS (SELECT 1 FROM pre_send_checks WHERE pre_send_checks.id = pre_send_results.check_id AND pre_send_checks.user_id = auth.uid()))",
  "CREATE POLICY IF NOT EXISTS 'Users insert own pre_send' ON pre_send_checks FOR INSERT WITH CHECK (auth.uid() = user_id)",
  "CREATE POLICY IF NOT EXISTS 'Users insert own pre_send_results' ON pre_send_results FOR INSERT WITH CHECK (true)",
];

// Complex SQL that needs multiline
const COMPLEX_SQL: string[] = [
  // consume_credit function
  `CREATE OR REPLACE FUNCTION consume_credit(p_user_id UUID)
RETURNS TABLE(success boolean, remaining integer)
LANGUAGE plpgsql SECURITY DEFINER
AS $FUNC$
DECLARE
  cur_credits INTEGER;
BEGIN
  SELECT credits_remaining INTO cur_credits FROM profiles WHERE id = p_user_id;
  IF cur_credits IS NULL THEN RETURN QUERY SELECT false::boolean, 0::integer; RETURN; END IF;
  IF cur_credits <= 0 THEN RETURN QUERY SELECT false::boolean, cur_credits::integer; RETURN; END IF;
  UPDATE profiles SET credits_remaining = credits_remaining - 1 WHERE id = p_user_id;
  SELECT credits_remaining INTO cur_credits FROM profiles WHERE id = p_user_id;
  RETURN QUERY SELECT true::boolean, cur_credits::integer;
END;
$FUNC$`,
];

export async function GET() {
  const results: string[] = [];

  // Run simple SQL via Supabase REST
  for (const sql of SQL_LIST) {
    const r = await execSQL(sql);
    results.push(r + ": " + sql.substring(0, 60));
  }

  // Run complex SQL (just best-effort)
  for (const sql of COMPLEX_SQL) {
    const r = await execSQL(sql);
    results.push(r + ": " + sql.substring(0, 60));
  }

  return NextResponse.json({ results });
}
