-- StreamCards Database Schema
-- ============================================================

-- Users: unified table for viewers and streamers
CREATE TABLE IF NOT EXISTS users (
  id              SERIAL PRIMARY KEY,
  twitch_id       VARCHAR(64) UNIQUE NOT NULL,
  username        VARCHAR(128) NOT NULL,
  display_name    VARCHAR(128),
  email           VARCHAR(256),
  profile_image_url TEXT,
  twitch_access_token TEXT,
  is_streamer     BOOLEAN NOT NULL DEFAULT false,
  coins           INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_twitch_id ON users(twitch_id);

-- ============================================================

-- Booster packs: created by streamers, sold in the shop
-- rarity_weights: probability (%) for each rarity tier when drawing a card
-- Example: {"common":50,"uncommon":30,"rare":15,"epic":4,"legendary":1}
-- The weights are used per-draw: for each of the 5 draws, roll against these.
CREATE TABLE IF NOT EXISTS booster_packs (
  id                  SERIAL PRIMARY KEY,
  creator_id          VARCHAR(64) NOT NULL REFERENCES users(twitch_id) ON DELETE CASCADE,
  name                VARCHAR(128) NOT NULL,
  subtitle            VARCHAR(256),
  description         TEXT,
  image_url           TEXT,
  price               INTEGER NOT NULL DEFAULT 100,
  cards_per_open      INTEGER NOT NULL DEFAULT 5,
  rarity              VARCHAR(32) NOT NULL DEFAULT 'common',
  rarity_weights      JSONB NOT NULL DEFAULT '{"common":50,"uncommon":30,"rare":15,"epic":4,"legendary":1}',
  color_primary       VARCHAR(9) DEFAULT '#8a8a8a',
  color_accent        VARCHAR(9) DEFAULT '#d0d0d0',
  color_text          VARCHAR(9) DEFAULT '#ffffff',
  color_background    VARCHAR(9) DEFAULT '#1a1a2e',
  is_published        BOOLEAN NOT NULL DEFAULT false,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_price_positive CHECK (price > 0),
  CONSTRAINT chk_cards_per_open CHECK (cards_per_open BETWEEN 1 AND 10),
  CONSTRAINT chk_rarity CHECK (rarity IN ('common','uncommon','rare','epic','legendary','ultra-legendary'))
);

CREATE INDEX IF NOT EXISTS idx_booster_packs_creator ON booster_packs(creator_id);
CREATE INDEX IF NOT EXISTS idx_booster_packs_published ON booster_packs(is_published);

-- ============================================================

-- Card templates: individual card designs, each belongs to one booster pack
-- Max 30 cards per booster (enforced in app logic).
-- Visual customization: outline_color, background_color, text_color, effect.
CREATE TABLE IF NOT EXISTS card_templates (
  id               SERIAL PRIMARY KEY,
  booster_pack_id  INTEGER NOT NULL REFERENCES booster_packs(id) ON DELETE CASCADE,
  creator_id       VARCHAR(64) NOT NULL REFERENCES users(twitch_id) ON DELETE CASCADE,
  name             VARCHAR(128) NOT NULL,
  description      TEXT,
  image_url        TEXT,
  rarity           VARCHAR(32) NOT NULL DEFAULT 'common',

  -- Visual customization
  outline_color    VARCHAR(9),              -- hex, null = auto from rarity
  background_color VARCHAR(9) DEFAULT '#1a1a2e',
  text_color       VARCHAR(9) DEFAULT '#ffffff',
  effect           VARCHAR(32) NOT NULL DEFAULT 'none',  -- none, holographic, shining, shadow
  effect_color     VARCHAR(9) DEFAULT '#ffffff',
  effect_intensity INTEGER NOT NULL DEFAULT 50,           -- 0-100

  is_active        BOOLEAN NOT NULL DEFAULT true,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_card_rarity CHECK (rarity IN ('common','uncommon','rare','epic','legendary','ultra-legendary')),
  CONSTRAINT chk_effect CHECK (effect IN ('none','holographic','shining','prismatic','neon-glow','aurora','lava','electric-pulse','shadow','dark-aura','void-portal','leaves','galaxy')),
  CONSTRAINT chk_effect_intensity CHECK (effect_intensity BETWEEN 0 AND 100)
);

CREATE INDEX IF NOT EXISTS idx_card_templates_booster ON card_templates(booster_pack_id);
CREATE INDEX IF NOT EXISTS idx_card_templates_creator ON card_templates(creator_id);
CREATE INDEX IF NOT EXISTS idx_card_templates_rarity ON card_templates(rarity);

-- ============================================================

-- Booster opening history: one row per purchase+open
CREATE TABLE IF NOT EXISTS booster_openings (
  id              SERIAL PRIMARY KEY,
  user_id         VARCHAR(64) NOT NULL REFERENCES users(twitch_id) ON DELETE CASCADE,
  booster_pack_id INTEGER NOT NULL REFERENCES booster_packs(id) ON DELETE SET NULL,
  coins_spent     INTEGER NOT NULL,
  opened_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_booster_openings_user ON booster_openings(user_id);

-- ============================================================

-- User card collection: one row per card instance (duplicates allowed)
CREATE TABLE IF NOT EXISTS user_cards (
  id                SERIAL PRIMARY KEY,
  user_id           VARCHAR(64) NOT NULL REFERENCES users(twitch_id) ON DELETE CASCADE,
  card_template_id  INTEGER NOT NULL REFERENCES card_templates(id) ON DELETE CASCADE,
  booster_opening_id INTEGER REFERENCES booster_openings(id) ON DELETE SET NULL,
  obtained_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_cards_user ON user_cards(user_id);
CREATE INDEX IF NOT EXISTS idx_user_cards_template ON user_cards(card_template_id);

-- ============================================================

-- Coin transactions: full audit trail for every coin movement
CREATE TABLE IF NOT EXISTS transactions (
  id              SERIAL PRIMARY KEY,
  user_id         VARCHAR(64) NOT NULL REFERENCES users(twitch_id) ON DELETE CASCADE,
  type            VARCHAR(32) NOT NULL,
  amount          INTEGER NOT NULL,
  balance_after   INTEGER NOT NULL,
  description     TEXT,
  reference_type  VARCHAR(32),
  reference_id    INTEGER,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_tx_type CHECK (type IN ('purchase','reward','gift','refund','admin','twitch_redemption','trade'))
);

CREATE INDEX IF NOT EXISTS idx_transactions_user ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(type);
CREATE INDEX IF NOT EXISTS idx_transactions_created ON transactions(created_at);

-- ============================================================

-- Friendships
CREATE TABLE IF NOT EXISTS friendships (
  id              SERIAL PRIMARY KEY,
  user_id         VARCHAR(64) NOT NULL REFERENCES users(twitch_id) ON DELETE CASCADE,
  friend_id       VARCHAR(64) NOT NULL REFERENCES users(twitch_id) ON DELETE CASCADE,
  status          VARCHAR(20) NOT NULL DEFAULT 'pending',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_friendship_status CHECK (status IN ('pending', 'accepted', 'blocked')),
  CONSTRAINT uq_friendship UNIQUE (user_id, friend_id),
  CONSTRAINT chk_no_self_friend CHECK (user_id != friend_id)
);

CREATE INDEX IF NOT EXISTS idx_friendships_user ON friendships(user_id);
CREATE INDEX IF NOT EXISTS idx_friendships_friend ON friendships(friend_id);
CREATE INDEX IF NOT EXISTS idx_friendships_status ON friendships(status);

-- ============================================================

-- Messages (private chat between friends)
CREATE TABLE IF NOT EXISTS messages (
  id              SERIAL PRIMARY KEY,
  sender_id       VARCHAR(64) NOT NULL REFERENCES users(twitch_id) ON DELETE CASCADE,
  receiver_id     VARCHAR(64) NOT NULL REFERENCES users(twitch_id) ON DELETE CASCADE,
  content         TEXT NOT NULL,
  is_read         BOOLEAN NOT NULL DEFAULT false,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_receiver ON messages(receiver_id);
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(LEAST(sender_id, receiver_id), GREATEST(sender_id, receiver_id));

-- ============================================================

-- Activity feed (friends activity)
CREATE TABLE IF NOT EXISTS activity_feed (
  id              SERIAL PRIMARY KEY,
  user_id         VARCHAR(64) NOT NULL REFERENCES users(twitch_id) ON DELETE CASCADE,
  type            VARCHAR(50) NOT NULL,
  data            JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_activity_type CHECK (type IN (
    'pack_opened', 'card_obtained', 'trade_completed',
    'marketplace_sale', 'marketplace_purchase',
    'auction_won', 'achievement_unlocked', 'friend_added'
  ))
);

CREATE INDEX IF NOT EXISTS idx_activity_feed_user ON activity_feed(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_feed_created ON activity_feed(created_at DESC);

-- ============================================================

-- Twitch reward configs (one per streamer)
CREATE TABLE IF NOT EXISTS twitch_reward_configs (
  id                  SERIAL PRIMARY KEY,
  streamer_id         VARCHAR(64) NOT NULL REFERENCES users(twitch_id) ON DELETE CASCADE,
  reward_id           VARCHAR(128),
  reward_title        VARCHAR(128) NOT NULL DEFAULT 'StreamCards Coins',
  channel_points_cost INTEGER NOT NULL DEFAULT 1000,
  coins_per_redeem    INTEGER NOT NULL DEFAULT 100,
  is_enabled          BOOLEAN NOT NULL DEFAULT false,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_streamer_reward UNIQUE (streamer_id),
  CONSTRAINT chk_coins_positive CHECK (coins_per_redeem > 0),
  CONSTRAINT chk_cp_cost_positive CHECK (channel_points_cost > 0)
);

-- ============================================================

-- EventSub subscriptions tracking
CREATE TABLE IF NOT EXISTS eventsub_subscriptions (
  id              SERIAL PRIMARY KEY,
  twitch_sub_id   VARCHAR(128) UNIQUE NOT NULL,
  streamer_id     VARCHAR(64) NOT NULL REFERENCES users(twitch_id) ON DELETE CASCADE,
  sub_type        VARCHAR(64) NOT NULL,
  status          VARCHAR(32) NOT NULL DEFAULT 'pending',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_eventsub_streamer ON eventsub_subscriptions(streamer_id);

-- ============================================================

-- Twitch redemption log (idempotency)
CREATE TABLE IF NOT EXISTS twitch_redemption_log (
  id                SERIAL PRIMARY KEY,
  twitch_event_id   VARCHAR(128) UNIQUE NOT NULL,
  streamer_id       VARCHAR(64) NOT NULL,
  viewer_twitch_id  VARCHAR(64) NOT NULL,
  reward_id         VARCHAR(128) NOT NULL,
  coins_granted     INTEGER NOT NULL,
  processed_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_redemption_viewer ON twitch_redemption_log(viewer_twitch_id);
CREATE INDEX IF NOT EXISTS idx_redemption_streamer ON twitch_redemption_log(streamer_id);

-- ============================================================
-- Helper: auto-update updated_at on row change

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_users_updated_at') THEN
    CREATE TRIGGER trg_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_booster_packs_updated_at') THEN
    CREATE TRIGGER trg_booster_packs_updated_at BEFORE UPDATE ON booster_packs FOR EACH ROW EXECUTE FUNCTION update_updated_at();
  END IF;
END $$;
