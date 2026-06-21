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
