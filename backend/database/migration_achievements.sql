-- Migration: Create achievements tables and seed default achievements
-- ============================================================

CREATE TABLE IF NOT EXISTS achievements (
  id              SERIAL PRIMARY KEY,
  key             VARCHAR(64) UNIQUE NOT NULL,
  title           VARCHAR(128) NOT NULL,
  description     TEXT,
  icon            VARCHAR(16) DEFAULT '🏆',
  category        VARCHAR(32) NOT NULL DEFAULT 'general',
  threshold       INTEGER NOT NULL DEFAULT 1,
  reward_coins    INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_achievements (
  id              SERIAL PRIMARY KEY,
  user_id         VARCHAR(64) NOT NULL REFERENCES users(twitch_id) ON DELETE CASCADE,
  achievement_id  INTEGER NOT NULL REFERENCES achievements(id) ON DELETE CASCADE,
  unlocked_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, achievement_id)
);

CREATE INDEX IF NOT EXISTS idx_user_achievements_user ON user_achievements(user_id);

-- Seed achievements
-- ============================================================

-- Collection
INSERT INTO achievements (key, title, description, icon, category, threshold, reward_coins) VALUES
  ('first_card',   'Premiere carte',       'Obtenez votre premiere carte',              '🃏', 'collection', 1,   100),
  ('collect_10',   'Collectionneur',        'Possedez 10 cartes uniques',                '📚', 'collection', 10,  500),
  ('collect_50',   'Grand collectionneur',  'Possedez 50 cartes uniques',                '🗃️', 'collection', 50,  2000),
  ('collect_100',  'Maitre collectionneur', 'Possedez 100 cartes uniques',               '👑', 'collection', 100, 5000),
  ('collect_250',  'Legendaire',            'Possedez 250 cartes uniques',               '⭐', 'collection', 250, 15000)
ON CONFLICT (key) DO NOTHING;

-- Boosters
INSERT INTO achievements (key, title, description, icon, category, threshold, reward_coins) VALUES
  ('open_1',   'Premiere ouverture',   'Ouvrez votre premier booster',     '📦', 'boosters', 1,   50),
  ('open_10',  'Acheteur regulier',    'Ouvrez 10 boosters',               '🛒', 'boosters', 10,  500),
  ('open_50',  'Accro aux boosters',   'Ouvrez 50 boosters',               '🎰', 'boosters', 50,  2500),
  ('open_100', 'Mega ouvreur',         'Ouvrez 100 boosters',              '💎', 'boosters', 100, 10000)
ON CONFLICT (key) DO NOTHING;

-- Trading
INSERT INTO achievements (key, title, description, icon, category, threshold, reward_coins) VALUES
  ('trade_1',  'Premier echange',      'Completez votre premier echange',  '🤝', 'trading', 1,   200),
  ('trade_10', 'Negociateur',          'Completez 10 echanges',            '💼', 'trading', 10,  1000),
  ('trade_50', 'Marchand expert',      'Completez 50 echanges',            '🏪', 'trading', 50,  5000)
ON CONFLICT (key) DO NOTHING;

-- Marketplace
INSERT INTO achievements (key, title, description, icon, category, threshold, reward_coins) VALUES
  ('sell_1',       'Premiere vente',       'Vendez une carte sur le marche',     '💰', 'marketplace', 1,   200),
  ('sell_10',      'Vendeur confirme',     'Vendez 10 cartes sur le marche',     '🏷️', 'marketplace', 10,  1500),
  ('buy_market_1', 'Premier achat marche', 'Achetez une carte sur le marche',    '🛍️', 'marketplace', 1,   200)
ON CONFLICT (key) DO NOTHING;

-- Streaks
INSERT INTO achievements (key, title, description, icon, category, threshold, reward_coins) VALUES
  ('streak_7',  'Une semaine fidele', 'Connectez-vous 7 jours de suite',   '🔥', 'streaks', 7,   1000),
  ('streak_30', 'Un mois fidele',     'Connectez-vous 30 jours de suite',  '🌟', 'streaks', 30,  5000)
ON CONFLICT (key) DO NOTHING;

-- Rarity
INSERT INTO achievements (key, title, description, icon, category, threshold, reward_coins) VALUES
  ('legendary_1',       'Carte legendaire',       'Obtenez une carte legendaire',        '✨', 'rarity', 1, 500),
  ('ultra_legendary_1', 'Carte ultra-legendaire', 'Obtenez une carte ultra-legendaire',  '🌈', 'rarity', 1, 2000)
ON CONFLICT (key) DO NOTHING;

-- Misc
INSERT INTO achievements (key, title, description, icon, category, threshold, reward_coins) VALUES
  ('complete_collection', 'Collection complete',  'Completez la collection d''un streamer', '🏆', 'special', 1,   10000),
  ('recycle_10',          'Recycleur',            'Recyclez 10 cartes',                     '♻️', 'recycling', 10,  300),
  ('recycle_50',          'Recycleur pro',        'Recyclez 50 cartes',                     '🔄', 'recycling', 50,  1500),
  ('rich_10k',            'Riche',                'Possedez 10 000 coins',                  '💵', 'wealth', 10000,  0),
  ('rich_100k',           'Millionnaire',         'Possedez 100 000 coins',                 '🤑', 'wealth', 100000, 0)
ON CONFLICT (key) DO NOTHING;
