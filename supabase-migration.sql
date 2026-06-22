-- ===== 1. 给 profiles 加 credits_remaining 字段 =====
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS credits_remaining INTEGER DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS total_checks INTEGER DEFAULT 0;

-- ===== 2. 给现有用户设置初始积分（按 plan 区分）=====
UPDATE profiles SET credits_remaining = CASE
  WHEN plan = 'starter'    THEN 50000
  WHEN plan = 'growth'     THEN 200000
  WHEN plan = 'business'   THEN 1000000
  WHEN plan = 'pro'        THEN 10000
  WHEN plan = 'enterprise' THEN 100000
  ELSE 1000
END
WHERE credits_remaining = 0 OR credits_remaining IS NULL;

-- ===== 3. 创建 consume_credit RPC 函数（TABLE 格式，匹配代码中的 [0]?.success 访问）=====
CREATE OR REPLACE FUNCTION consume_credit(p_user_id UUID)
RETURNS TABLE(success boolean, remaining integer)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_credits INTEGER;
BEGIN
  SELECT credits_remaining INTO v_credits
  FROM profiles
  WHERE id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false::boolean, 0::integer;
    RETURN;
  END IF;

  IF v_credits <= 0 THEN
    RETURN QUERY SELECT false::boolean, v_credits::integer;
    RETURN;
  END IF;

  UPDATE profiles
  SET credits_remaining = credits_remaining - 1,
      total_checks = total_checks + 1,
      updated_at = NOW()
  WHERE id = p_user_id;

  RETURN QUERY SELECT true::boolean, (v_credits - 1)::integer;
END;
$$;

-- ===== 4. 给函数授权 =====
GRANT EXECUTE ON FUNCTION consume_credit(UUID) TO anon;
GRANT EXECUTE ON FUNCTION consume_credit(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION consume_credit(UUID) TO service_role;

-- ===== 5. 验证 =====
SELECT id, email, plan, credits_remaining FROM profiles LIMIT 10;
