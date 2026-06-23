-- Add missing paid-plan states required by the Creem multi-plan rollout.
-- Run this in Supabase SQL Editor before testing Scale checkout or past_due handling.

ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_plan_check;
ALTER TABLE profiles
  ADD CONSTRAINT profiles_plan_check
  CHECK (plan IN ('free', 'starter', 'growth', 'scale', 'business'));

ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_subscription_status_check;
ALTER TABLE profiles
  ADD CONSTRAINT profiles_subscription_status_check
  CHECK (subscription_status IN ('inactive', 'active', 'cancelled', 'expired', 'past_due'));
