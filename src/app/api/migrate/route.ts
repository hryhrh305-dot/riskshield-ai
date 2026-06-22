import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || ""
);

export async function GET() {
  const results: string[] = [];

  const sqls = [
    "ALTER TABLE profiles ADD COLUMN IF NOT EXISTS risk_settings JSONB",
    "CREATE TABLE IF NOT EXISTS pre_send_checks (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE, campaign_name TEXT DEFAULT '', total_contacts INTEGER DEFAULT 0, allowed_count INTEGER DEFAULT 0, review_count INTEGER DEFAULT 0, blocked_count INTEGER DEFAULT 0, risk_score_avg INTEGER DEFAULT 0, status TEXT DEFAULT 'completed', created_at TIMESTAMPTZ DEFAULT NOW())",
    "CREATE INDEX IF NOT EXISTS idx_pre_send_checks_user ON pre_send_checks(user_id, created_at)",
    "CREATE TABLE IF NOT EXISTS pre_send_results (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), check_id UUID REFERENCES pre_send_checks(id) ON DELETE CASCADE, email TEXT NOT NULL, risk_score INTEGER DEFAULT 0, decision TEXT DEFAULT 'ALLOW', reasons JSONB DEFAULT '[]', created_at TIMESTAMPTZ DEFAULT NOW())",
    "CREATE INDEX IF NOT EXISTS idx_pre_send_results_check ON pre_send_results(check_id)",
    "ALTER TABLE pre_send_checks ENABLE ROW LEVEL SECURITY",
    "ALTER TABLE pre_send_results ENABLE ROW LEVEL SECURITY",
    'DROP POLICY IF EXISTS "Users read own pre_send" ON pre_send_checks',
    'CREATE POLICY "Users read own pre_send" ON pre_send_checks FOR SELECT USING (auth.uid() = user_id)',
    'DROP POLICY IF EXISTS "Users read own pre_send_results" ON pre_send_results',
    'CREATE POLICY "Users read own pre_send_results" ON pre_send_results FOR SELECT USING (EXISTS (SELECT 1 FROM pre_send_checks WHERE pre_send_checks.id = pre_send_results.check_id AND pre_send_checks.user_id = auth.uid()))',
  ];

  for (const sql of sqls) {
    try {
      const { error } = await supabase.rpc("exec_sql", { sql });
      if (error) results.push("FAIL: " + error.message);
      else results.push("OK: " + sql.substring(0, 50));
    } catch (e: any) {
      results.push("ERR: " + (e.message || String(e)).substring(0, 60));
    }
  }

  // Fallback: try raw REST SQL execution if rpc fails
  if (results.every(r => r.startsWith("FAIL") || r.startsWith("ERR"))) {
    for (const sql of sqls.slice(0, 2)) {
      try {
        const res = await fetch("https://njhjiavnidssjvnkcxfo.supabase.co/rest/v1/", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "apikey": process.env.SUPABASE_SERVICE_ROLE_KEY || "",
            "Authorization": "Bearer " + (process.env.SUPABASE_SERVICE_ROLE_KEY || ""),
            "Prefer": "params=single-object"
          },
          body: JSON.stringify({ query: sql })
        });
        results.push("REST " + res.status + ": " + (await res.text()).substring(0, 80));
      } catch (e: any) {
        results.push("REST FAIL: " + (e.message || "").substring(0, 60));
      }
    }
  }

  return NextResponse.json({ results, env: !!process.env.NEXT_PUBLIC_SUPABASE_URL });
}
