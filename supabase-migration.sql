-- ============================================
-- RiskShield SaaS: Cost Control Migration
-- Run in Supabase SQL Editor
-- ============================================

-- 1. USAGE LEDGER (single source of truth for cost tracking)
CREATE TABLE IF NOT EXISTS usage_ledger (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  api_key_id UUID,
  api_key TEXT,
  project_id UUID,
  endpoint TEXT NOT NULL,
  cost_units INTEGER NOT NULL DEFAULT 1,
  request_cost NUMERIC(10,6) DEFAULT 0,
  ip_address TEXT,
  plan TEXT DEFAULT 'free',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_usage_ledger_user_id ON usage_ledger(user_id);
CREATE INDEX IF NOT EXISTS idx_usage_ledger_user_month ON usage_ledger(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_usage_ledger_ip ON usage_ledger(ip_address, created_at);
CREATE INDEX IF NOT EXISTS idx_usage_ledger_created ON usage_ledger(created_at);

-- 2. ABUSE EVENTS
CREATE TABLE IF NOT EXISTS abuse_events (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  api_key_id UUID,
  ip_address TEXT,
  event_type TEXT NOT NULL,       -- burst_detected | multiple_keys_per_ip | proxy_rotation
  metric_value NUMERIC DEFAULT 0,
  action TEXT DEFAULT 'temporary_block',  -- temporary_block | soft_throttle | permanent_block
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_abuse_events_user ON abuse_events(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_abuse_events_ip ON abuse_events(ip_address, created_at);

-- 3. Add subscription_end to profiles if not exists
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS subscription_end TIMESTAMPTZ;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS subscription_status TEXT DEFAULT 'active';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS risk_settings JSONB;

-- 6. PRE-SEND CAMPAIGN TRACKING
CREATE TABLE IF NOT EXISTS pre_send_checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  campaign_name TEXT DEFAULT '',
  total_contacts INTEGER DEFAULT 0,
  allowed_count INTEGER DEFAULT 0,
  review_count INTEGER DEFAULT 0,
  blocked_count INTEGER DEFAULT 0,
  risk_score_avg INTEGER DEFAULT 0,
  status TEXT DEFAULT 'completed' CHECK (status IN ('completed', 'processing', 'failed')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_pre_send_checks_user ON pre_send_checks(user_id, created_at);

CREATE TABLE IF NOT EXISTS pre_send_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  check_id UUID REFERENCES pre_send_checks(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  risk_score INTEGER DEFAULT 0,
  decision TEXT DEFAULT 'ALLOW' CHECK (decision IN ('ALLOW', 'REVIEW', 'BLOCK')),
  reasons JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_pre_send_results_check ON pre_send_results(check_id);

ALTER TABLE pre_send_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE pre_send_results ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own pre_send" ON pre_send_checks FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users read own pre_send_results" ON pre_send_results FOR SELECT USING (EXISTS (SELECT 1 FROM pre_send_checks WHERE pre_send_checks.id = pre_send_results.check_id AND pre_send_checks.user_id = auth.uid()));

-- 4. Enable RLS on new tables
ALTER TABLE usage_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE abuse_events ENABLE ROW LEVEL SECURITY;

-- 5. RLS policies
CREATE POLICY "Users read own usage" ON usage_ledger
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Service role full access usage" ON usage_ledger
  FOR ALL USING (true);

CREATE POLICY "Users read own abuse events" ON abuse_events
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Service role full access abuse" ON abuse_events
  FOR ALL USING (true);
