-- Optional: extend recurring-billing audit fields for Creem monthly/yearly subscriptions.
-- Safe to run after the existing multi-plan migration.

ALTER TABLE subscriptions
  ADD COLUMN IF NOT EXISTS billing_cycle TEXT
    CHECK (billing_cycle IN ('monthly', 'yearly')),
  ADD COLUMN IF NOT EXISTS cancel_at_period_end BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS last_webhook_event_id TEXT,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS provider_customer_id TEXT,
  ADD COLUMN IF NOT EXISTS last_webhook_event_id TEXT,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_subscriptions_provider_subscription_id
  ON subscriptions(provider_subscription_id);

CREATE INDEX IF NOT EXISTS idx_payments_provider_checkout_id
  ON payments(provider_checkout_id);

CREATE INDEX IF NOT EXISTS idx_payments_provider_subscription_id
  ON payments(provider_subscription_id);
