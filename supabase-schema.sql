-- Fraud Shield API - Database Schema

-- Profiles (extends Supabase auth.users)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  plan TEXT DEFAULT 'free' CHECK (plan IN ('free', 'starter', 'growth', 'business')),
  subscription_status TEXT DEFAULT 'inactive' CHECK (subscription_status IN ('inactive', 'active', 'cancelled', 'expired')),
  subscription_start TIMESTAMPTZ,
  subscription_end TIMESTAMPTZ,
  creem_customer_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- API Keys
CREATE TABLE IF NOT EXISTS api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  key TEXT UNIQUE NOT NULL,
  name TEXT DEFAULT 'Default',
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'revoked')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_used_at TIMESTAMPTZ
);

-- API Usage (daily tracking)
CREATE TABLE IF NOT EXISTS api_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  api_key_id UUID REFERENCES api_keys(id) ON DELETE SET NULL,
  endpoint TEXT NOT NULL,
  request_count INTEGER DEFAULT 0,
  date DATE DEFAULT CURRENT_DATE,
  UNIQUE(user_id, api_key_id, endpoint, date)
);

-- Check results (audit log)
CREATE TABLE IF NOT EXISTS checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  check_type TEXT NOT NULL CHECK (check_type IN ('email', 'ip', 'risk')),
  input_value TEXT NOT NULL,
  risk_score INTEGER DEFAULT 0,
  result_json JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Subscriptions
CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  payment_provider TEXT NOT NULL,
  provider_subscription_id TEXT,
  plan TEXT DEFAULT 'free',
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'cancelled', 'expired', 'past_due')),
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Payments
CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  provider TEXT NOT NULL,
  provider_checkout_id TEXT,
  provider_transaction_id TEXT,
  amount DECIMAL(10,2),
  currency TEXT DEFAULT 'USD',
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed', 'refunded')),
  plan TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS Policies
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

-- Users read/write own profile
CREATE POLICY "Users read own profile" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);

-- Users manage own API keys
CREATE POLICY "Users read own keys" ON api_keys FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own keys" ON api_keys FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own keys" ON api_keys FOR UPDATE USING (auth.uid() = user_id);

-- Users read own usage and checks
CREATE POLICY "Users read own usage" ON api_usage FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users read own checks" ON checks FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users read own subscriptions" ON subscriptions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users read own payments" ON payments FOR SELECT USING (auth.uid() = user_id);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS 
BEGIN
  INSERT INTO profiles (id, email, name, plan)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)), 'free');
  RETURN NEW;
END;
 LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Increment usage helper
CREATE OR REPLACE FUNCTION increment_api_usage(
  p_user_id UUID,
  p_api_key_id UUID,
  p_endpoint TEXT,
  p_date DATE
)
RETURNS void AS 
BEGIN
  INSERT INTO api_usage (user_id, api_key_id, endpoint, request_count, date)
  VALUES (p_user_id, p_api_key_id, p_endpoint, 1, p_date)
  ON CONFLICT (user_id, api_key_id, endpoint, date)
  DO UPDATE SET request_count = api_usage.request_count + 1;
END;
 LANGUAGE plpgsql SECURITY DEFINER;
