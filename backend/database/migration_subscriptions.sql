-- Migration: Add subscription/premium support
-- ============================================================

-- Add subscription columns to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS stripe_customer_id VARCHAR(128) UNIQUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_type VARCHAR(32) NOT NULL DEFAULT 'free';
ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_status VARCHAR(32) NOT NULL DEFAULT 'none';
ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_expires_at TIMESTAMPTZ;

-- Constraints on subscription columns
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_subscription_type') THEN
    ALTER TABLE users ADD CONSTRAINT chk_subscription_type
      CHECK (subscription_type IN ('free', 'viewer_premium', 'streamer_premium'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_subscription_status') THEN
    ALTER TABLE users ADD CONSTRAINT chk_subscription_status
      CHECK (subscription_status IN ('none', 'active', 'past_due', 'cancelled', 'expired'));
  END IF;
END $$;

-- ============================================================

-- Subscriptions history table
CREATE TABLE IF NOT EXISTS subscriptions (
  id                      SERIAL PRIMARY KEY,
  user_id                 VARCHAR(64) NOT NULL REFERENCES users(twitch_id) ON DELETE CASCADE,
  stripe_subscription_id  VARCHAR(128) UNIQUE,
  type                    VARCHAR(32) NOT NULL,
  streamer_tier           VARCHAR(32),
  price_cents             INTEGER NOT NULL,
  status                  VARCHAR(32) NOT NULL DEFAULT 'active',
  current_period_start    TIMESTAMPTZ,
  current_period_end      TIMESTAMPTZ,
  cancelled_at            TIMESTAMPTZ,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_sub_type CHECK (type IN ('viewer_premium', 'streamer_premium')),
  CONSTRAINT chk_sub_streamer_tier CHECK (streamer_tier IS NULL OR streamer_tier IN ('small', 'medium', 'large', 'enterprise')),
  CONSTRAINT chk_sub_status CHECK (status IN ('active', 'past_due', 'cancelled', 'expired')),
  CONSTRAINT chk_sub_price CHECK (price_cents > 0)
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_user ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe ON subscriptions(stripe_subscription_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);

-- Auto-update updated_at trigger for subscriptions
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_subscriptions_updated_at') THEN
    CREATE TRIGGER trg_subscriptions_updated_at BEFORE UPDATE ON subscriptions
      FOR EACH ROW EXECUTE FUNCTION update_updated_at();
  END IF;
END $$;
