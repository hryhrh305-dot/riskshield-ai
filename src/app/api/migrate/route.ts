import { NextResponse } from "next/server";
import { Pool } from "pg";

export async function GET() {
  const sqls = [
    'ALTER TABLE profiles ADD COLUMN IF NOT EXISTS subscription_end TIMESTAMPTZ',
    "ALTER TABLE profiles ADD COLUMN IF NOT EXISTS subscription_status TEXT DEFAULT 'active'",
    'ALTER TABLE profiles ADD COLUMN IF NOT EXISTS risk_settings JSONB',
    `CREATE TABLE IF NOT EXISTS pre_send_checks (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
      campaign_name TEXT DEFAULT '',
      total_contacts INTEGER DEFAULT 0,
      allowed_count INTEGER DEFAULT 0,
      review_count INTEGER DEFAULT 0,
      blocked_count INTEGER DEFAULT 0,
      risk_score_avg INTEGER DEFAULT 0,
      status TEXT DEFAULT 'completed' CHECK (status IN ('completed','processing','failed')),
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`,
    'CREATE INDEX IF NOT EXISTS idx_pre_send_checks_user ON pre_send_checks(user_id, created_at)',
    `CREATE TABLE IF NOT EXISTS pre_send_results (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      check_id UUID REFERENCES pre_send_checks(id) ON DELETE CASCADE,
      email TEXT NOT NULL,
      risk_score INTEGER DEFAULT 0,
      decision TEXT DEFAULT 'ALLOW' CHECK (decision IN ('ALLOW','REVIEW','BLOCK')),
      reasons JSONB DEFAULT '[]',
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`,
    'CREATE INDEX IF NOT EXISTS idx_pre_send_results_check ON pre_send_results(check_id)',
    'ALTER TABLE pre_send_checks ENABLE ROW LEVEL SECURITY',
    'ALTER TABLE pre_send_results ENABLE ROW LEVEL SECURITY',
    `DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='pre_send_checks' AND policyname='Users read own pre_send') THEN
        CREATE POLICY "Users read own pre_send" ON pre_send_checks FOR SELECT USING (auth.uid() = user_id);
      END IF;
    END $$`,
    `DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='pre_send_results' AND policyname='Users read own pre_send_results') THEN
        CREATE POLICY "Users read own pre_send_results" ON pre_send_results FOR SELECT USING (
          EXISTS (SELECT 1 FROM pre_send_checks WHERE pre_send_checks.id = pre_send_results.check_id AND pre_send_checks.user_id = auth.uid())
        );
      END IF;
    END $$`,
    `DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='pre_send_checks' AND policyname='Users insert own pre_send') THEN
        CREATE POLICY "Users insert own pre_send" ON pre_send_checks FOR INSERT WITH CHECK (auth.uid() = user_id);
      END IF;
    END $$`,
    `DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='pre_send_results' AND policyname='Users insert own pre_send_results') THEN
        CREATE POLICY "Users insert own pre_send_results" ON pre_send_results FOR INSERT WITH CHECK (true);
      END IF;
    END $$`,
  ];

  const results: string[] = [];

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 15000,
  });

  for (const sql of sqls) {
    try {
      await pool.query(sql);
      results.push("OK: " + sql.substring(0, 60));
    } catch (e: any) {
      results.push("FAIL: " + (e.message || String(e)).substring(0, 80));
    }
  }

  await pool.end();
  return NextResponse.json({ results });
}
