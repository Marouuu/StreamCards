import express from 'express';
import { pool } from '../config/database.js';
import { authenticate } from '../middleware/auth.js';
import { generateToken } from '../utils/jwt.js';

const router = express.Router();

// ──── Reward configuration ────
const DAILY_CLAIM_BASE = 100;
const STREAK_BONUS_PER_DAY = 25;   // Extra per consecutive day
const MAX_STREAK_BONUS = 250;       // Cap at 10-day streak (100 + 250 = 350 max)
const PREMIUM_DAILY_BONUS = 100;    // Extra coins for premium subscribers

const QUESTS = [
  {
    id: 'open_booster',
    title: 'Ouvrir un booster',
    description: 'Ouvrez au moins 1 booster aujourd\'hui',
    reward: 50,
    target: 1,
    type: 'booster_opening',
  },
  {
    id: 'open_3_boosters',
    title: 'Collectionneur',
    description: 'Ouvrez 3 boosters aujourd\'hui',
    reward: 150,
    target: 3,
    type: 'booster_opening',
  },
  {
    id: 'recycle_card',
    title: 'Recycleur',
    description: 'Recyclez au moins 1 carte aujourd\'hui',
    reward: 30,
    target: 1,
    type: 'recycle',
  },
  {
    id: 'marketplace_sell',
    title: 'Marchand',
    description: 'Mettez une carte en vente sur le marche',
    reward: 50,
    target: 1,
    type: 'marketplace_list',
  },
  {
    id: 'marketplace_buy',
    title: 'Acheteur',
    description: 'Achetez une carte sur le marche',
    reward: 75,
    target: 1,
    type: 'marketplace_buy',
  },
];

// Helper: get today's date boundary in UTC
function getTodayBounds() {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);
  return { start, end };
}

// GET /api/rewards — Get daily claim status + quests progress
router.get('/', authenticate, async (req, res) => {
  try {
    const twitchId = req.user.twitchId;
    const { start, end } = getTodayBounds();

    // Get user reward info + premium status
    const userResult = await pool.query(
      'SELECT last_daily_claim, daily_streak, subscription_type, subscription_status FROM users WHERE twitch_id = $1',
      [twitchId]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const { last_daily_claim, daily_streak, subscription_type, subscription_status } = userResult.rows[0];
    const isPremium = subscription_status === 'active' && subscription_type !== 'free';
    const premiumBonus = isPremium ? PREMIUM_DAILY_BONUS : 0;
    const alreadyClaimed = last_daily_claim && new Date(last_daily_claim) >= start;
    const currentStreak = daily_streak || 0;
    const streakBonus = Math.min(currentStreak * STREAK_BONUS_PER_DAY, MAX_STREAK_BONUS);
    const dailyReward = DAILY_CLAIM_BASE + streakBonus + premiumBonus;

    // Get quest progress for today
    // 1. Boosters opened today
    const boostersResult = await pool.query(
      `SELECT COUNT(*) AS count FROM booster_openings
       WHERE user_id = $1 AND opened_at >= $2 AND opened_at < $3`,
      [twitchId, start, end]
    );
    const boostersToday = parseInt(boostersResult.rows[0].count);

    // 2. Cards recycled today (transactions with description containing 'Recyclage')
    const recycleResult = await pool.query(
      `SELECT COUNT(*) AS count FROM transactions
       WHERE user_id = $1 AND type = 'reward' AND description LIKE '%Recyclage%'
         AND created_at >= $2 AND created_at < $3`,
      [twitchId, start, end]
    );
    const recycledToday = parseInt(recycleResult.rows[0].count);

    // 3. Marketplace listings today
    const listResult = await pool.query(
      `SELECT COUNT(*) AS count FROM marketplace_listings
       WHERE seller_id = $1 AND created_at >= $2 AND created_at < $3`,
      [twitchId, start, end]
    );
    const listedToday = parseInt(listResult.rows[0].count);

    // 4. Marketplace buys today
    const buyResult = await pool.query(
      `SELECT COUNT(*) AS count FROM marketplace_listings
       WHERE buyer_id = $1 AND status = 'sold' AND sold_at >= $2 AND sold_at < $3`,
      [twitchId, start, end]
    );
    const boughtToday = parseInt(buyResult.rows[0].count);

    // 5. Already claimed quest rewards today
    const claimedQuests = await pool.query(
      `SELECT description FROM transactions
       WHERE user_id = $1 AND type = 'reward'
         AND description LIKE 'Quete:%'
         AND created_at >= $2 AND created_at < $3`,
      [twitchId, start, end]
    );
    const claimedQuestIds = new Set(
      claimedQuests.rows.map(r => {
        const match = r.description.match(/Quete: (.+)/);
        return match ? match[1] : null;
      }).filter(Boolean)
    );

    // Build quest status
    const progressMap = {
      booster_opening: boostersToday,
      recycle: recycledToday,
      marketplace_list: listedToday,
      marketplace_buy: boughtToday,
    };

    const quests = QUESTS.map(q => ({
      id: q.id,
      title: q.title,
      description: q.description,
      reward: q.reward,
      target: q.target,
      progress: Math.min(progressMap[q.type] || 0, q.target),
      completed: (progressMap[q.type] || 0) >= q.target,
      claimed: claimedQuestIds.has(q.id),
    }));

    res.json({
      dailyClaim: {
        available: !alreadyClaimed,
        reward: dailyReward,
        streak: currentStreak,
        streakBonus,
        premiumBonus,
        isPremium,
        nextStreakBonus: Math.min((currentStreak + 1) * STREAK_BONUS_PER_DAY, MAX_STREAK_BONUS),
      },
      quests,
    });
  } catch (error) {
    console.error('Rewards error:', error);
    res.status(500).json({ error: 'Failed to load rewards' });
  }
});

// POST /api/rewards/claim-daily — Claim daily coins
router.post('/claim-daily', authenticate, async (req, res) => {
  try {
    const twitchId = req.user.twitchId;
    const { start } = getTodayBounds();

    await pool.query('BEGIN');

    // Lock user row
    const userResult = await pool.query(
      'SELECT coins, last_daily_claim, daily_streak, subscription_type, subscription_status FROM users WHERE twitch_id = $1 FOR UPDATE',
      [twitchId]
    );

    if (userResult.rows.length === 0) {
      await pool.query('ROLLBACK');
      return res.status(404).json({ error: 'User not found' });
    }

    const { coins, last_daily_claim, daily_streak, subscription_type, subscription_status } = userResult.rows[0];
    const isPremium = subscription_status === 'active' && subscription_type !== 'free';
    const premiumBonus = isPremium ? PREMIUM_DAILY_BONUS : 0;

    // Check already claimed today
    if (last_daily_claim && new Date(last_daily_claim) >= start) {
      await pool.query('ROLLBACK');
      return res.status(400).json({ error: 'Deja reclame aujourd\'hui' });
    }

    // Calculate streak
    const yesterday = new Date(start);
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);
    const wasYesterday = last_daily_claim && new Date(last_daily_claim) >= yesterday && new Date(last_daily_claim) < start;
    const newStreak = wasYesterday ? (daily_streak || 0) + 1 : 1;

    const streakBonus = Math.min((newStreak - 1) * STREAK_BONUS_PER_DAY, MAX_STREAK_BONUS);
    const reward = DAILY_CLAIM_BASE + streakBonus + premiumBonus;
    const newCoins = coins + reward;

    await pool.query(
      `UPDATE users SET coins = $1, last_daily_claim = NOW(), daily_streak = $2 WHERE twitch_id = $3`,
      [newCoins, newStreak, twitchId]
    );

    await pool.query(
      `INSERT INTO transactions (user_id, type, amount, balance_after, description)
       VALUES ($1, 'reward', $2, $3, $4)`,
      [twitchId, reward, newCoins, `Recompense quotidienne (serie: ${newStreak}j)${premiumBonus ? ' + bonus premium' : ''}`]
    );

    await pool.query('COMMIT');

    const newToken = generateToken(
      { id: twitchId, login: req.user.username, display_name: req.user.displayName, profile_image_url: req.user.profileImageUrl },
      null,
      newCoins
    );

    res.json({
      success: true,
      reward,
      streak: newStreak,
      streakBonus,
      newCoins,
      newToken,
    });
  } catch (error) {
    try { await pool.query('ROLLBACK'); } catch { /* ignore */ }
    console.error('Error claiming daily:', error);
    res.status(500).json({ error: 'Failed to claim daily reward' });
  }
});

// POST /api/rewards/claim-quest/:questId — Claim a completed quest reward
router.post('/claim-quest/:questId', authenticate, async (req, res) => {
  try {
    const twitchId = req.user.twitchId;
    const { questId } = req.params;
    const { start, end } = getTodayBounds();

    const quest = QUESTS.find(q => q.id === questId);
    if (!quest) {
      return res.status(400).json({ error: 'Quete inconnue' });
    }

    await pool.query('BEGIN');

    // Lock user
    const userResult = await pool.query(
      'SELECT coins FROM users WHERE twitch_id = $1 FOR UPDATE',
      [twitchId]
    );
    if (userResult.rows.length === 0) {
      await pool.query('ROLLBACK');
      return res.status(404).json({ error: 'User not found' });
    }

    // Check not already claimed
    const alreadyClaimed = await pool.query(
      `SELECT id FROM transactions
       WHERE user_id = $1 AND type = 'reward' AND description = $2
         AND created_at >= $3 AND created_at < $4`,
      [twitchId, `Quete: ${questId}`, start, end]
    );
    if (alreadyClaimed.rows.length > 0) {
      await pool.query('ROLLBACK');
      return res.status(400).json({ error: 'Quete deja reclamee' });
    }

    // Check quest is actually completed
    let progress = 0;
    switch (quest.type) {
      case 'booster_opening': {
        const r = await pool.query(
          'SELECT COUNT(*) AS c FROM booster_openings WHERE user_id = $1 AND opened_at >= $2 AND opened_at < $3',
          [twitchId, start, end]
        );
        progress = parseInt(r.rows[0].c);
        break;
      }
      case 'recycle': {
        const r = await pool.query(
          `SELECT COUNT(*) AS c FROM transactions WHERE user_id = $1 AND type = 'reward' AND description LIKE '%Recyclage%' AND created_at >= $2 AND created_at < $3`,
          [twitchId, start, end]
        );
        progress = parseInt(r.rows[0].c);
        break;
      }
      case 'marketplace_list': {
        const r = await pool.query(
          'SELECT COUNT(*) AS c FROM marketplace_listings WHERE seller_id = $1 AND created_at >= $2 AND created_at < $3',
          [twitchId, start, end]
        );
        progress = parseInt(r.rows[0].c);
        break;
      }
      case 'marketplace_buy': {
        const r = await pool.query(
          `SELECT COUNT(*) AS c FROM marketplace_listings WHERE buyer_id = $1 AND status = 'sold' AND sold_at >= $2 AND sold_at < $3`,
          [twitchId, start, end]
        );
        progress = parseInt(r.rows[0].c);
        break;
      }
    }

    if (progress < quest.target) {
      await pool.query('ROLLBACK');
      return res.status(400).json({ error: 'Quete pas encore completee' });
    }

    // Grant reward
    const { coins } = userResult.rows[0];
    const newCoins = coins + quest.reward;

    await pool.query('UPDATE users SET coins = $1 WHERE twitch_id = $2', [newCoins, twitchId]);
    await pool.query(
      `INSERT INTO transactions (user_id, type, amount, balance_after, description)
       VALUES ($1, 'reward', $2, $3, $4)`,
      [twitchId, quest.reward, newCoins, `Quete: ${questId}`]
    );

    await pool.query('COMMIT');

    const newToken = generateToken(
      { id: twitchId, login: req.user.username, display_name: req.user.displayName, profile_image_url: req.user.profileImageUrl },
      null,
      newCoins
    );

    res.json({
      success: true,
      reward: quest.reward,
      questId,
      newCoins,
      newToken,
    });
  } catch (error) {
    try { await pool.query('ROLLBACK'); } catch { /* ignore */ }
    console.error('Error claiming quest:', error);
    res.status(500).json({ error: 'Failed to claim quest reward' });
  }
});

export default router;
