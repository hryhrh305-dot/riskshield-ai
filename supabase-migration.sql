-- ===== 1. 给 profiles 加 credits_remaining 字段 =====
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS credits_remaining INTEGER DEFAULT 0;

-- ===== 2. 给现有用户设置初始积分（按 plan 区分）=====
UPDATE profiles SET credits_remaining = CASE
  WHEN plan = 'pro'        THEN 10000
  WHEN plan = 'enterprise' THEN 100000
  ELSE 100  -- free 用户给 100 测试积分
END
WHERE credits_remaining = 0 OR credits_remaining IS NULL;

-- ===== 3. 创建 consume_credit RPC 函数 =====
CREATE OR REPLACE FUNCTION consume_credit(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_credits INTEGER;
  v_plan TEXT;
BEGIN
  SELECT credits_remaining, plan
  INTO v_credits, v_plan
  FROM profiles
  WHERE id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'user_not_found');
  END IF;

  IF v_credits <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'insufficient_credits', 'credits', v_credits);
  END IF;

  UPDATE profiles
  SET credits_remaining = credits_remaining - 1,
      updated_at = NOW()
  WHERE id = p_user_id;

  RETURN jsonb_build_object('success', true, 'credits_remaining', v_credits - 1);
END;
$$;

-- ===== 4. 给函数授权（重要，否则 anon/service_role 无法调用）=====
GRANT EXECUTE ON FUNCTION consume_credit(UUID) TO anon;
GRANT EXECUTE ON FUNCTION consume_credit(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION consume_credit(UUID) TO service_role;

-- ===== 5. 验证：查看你自己账号的积分 =====
SELECT id, email, plan, credits_remaining FROM profiles LIMIT 10;
