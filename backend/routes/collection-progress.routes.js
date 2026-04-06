import express from 'express';
import { pool } from '../config/database.js';
import { authenticate } from '../middleware/auth.js';
import { generateToken } from '../utils/jwt.js';
import { createNotification } from '../utils/notifications.js';

const router = express.Router();

// GET /api/collection-progress — all streamers the user has cards from
router.get('/', authenticate, async (req, res) => {
  try {
    const userId = req.user.twitchId;

    const result = await pool.query(`
      SELECT
        ct.creator_id,
        u.display_name AS creator_name,
        u.profile_image_url AS creator_image,
        COUNT(DISTINCT ct.id) AS total_cards,
        COUNT(DISTINCT CASE WHEN uc.id IS NOT NULL THEN ct.id END) AS owned_cards
      FROM card_templates ct
      JOIN users u ON ct.creator_id = u.twitch_id
      LEFT JOIN user_cards uc ON uc.card_template_id = ct.id AND uc.user_id = $1
      WHERE ct.is_active = true
      GROUP BY ct.creator_id, u.display_name, u.profile_image_url
      HAVING COUNT(DISTINCT CASE WHEN uc.id IS NOT NULL THEN ct.id END) > 0
      ORDER BY (COUNT(DISTINCT CASE WHEN uc.id IS NOT NULL THEN ct.id END)::float / NULLIF(COUNT(DISTINCT ct.id), 0)) DESC
    `, [userId]);

    const progress = result.rows.map(r => ({
      creatorId: r.creator_id,
      creatorName: r.creator_name,
      creatorImage: r.creator_image,
      owned: parseInt(r.owned_cards),
      total: parseInt(r.total_cards),
      percent: Math.round((parseInt(r.owned_cards) / parseInt(r.total_cards)) * 100),
    }));

    res.json({ progress });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/collection-progress/:creatorId — detail for one streamer
router.get('/:creatorId', authenticate, async (req, res) => {
  try {
    const userId = req.user.twitchId;
    const { creatorId } = req.params;

    // All cards from this creator
    const cardsResult = await pool.query(`
      SELECT ct.id, ct.name, ct.image_url, ct.rarity, ct.outline_color, ct.background_color,
        ct.text_color, ct.effect, ct.effect_color, ct.effect_intensity, ct.description,
        CASE WHEN uc.id IS NOT NULL THEN true ELSE false END AS owned,
        COUNT(uc.id) AS copies
      FROM card_templates ct
      LEFT JOIN user_cards uc ON uc.card_template_id = ct.id AND uc.user_id = $1
      WHERE ct.creator_id = $2 AND ct.is_active = true
      GROUP BY ct.id, uc.id
      ORDER BY
        CASE ct.rarity
          WHEN 'common' THEN 1 WHEN 'uncommon' THEN 2 WHEN 'rare' THEN 3
          WHEN 'epic' THEN 4 WHEN 'legendary' THEN 5 WHEN 'ultra-legendary' THEN 6
        END, ct.name
    `, [userId, creatorId]);

    // Rewards for this creator
    const rewardsResult = await pool.query(`
      SELECT cr.id, cr.threshold, cr.reward_coins, cr.reward_title,
        CASE WHEN crc.id IS NOT NULL THEN true ELSE false END AS claimed
      FROM collection_rewards cr
      LEFT JOIN collection_reward_claims crc ON crc.collection_reward_id = cr.id AND crc.user_id = $1
      WHERE cr.creator_id = $2
      ORDER BY cr.threshold
    `, [userId, creatorId]);

    // Creator info
    const creatorResult = await pool.query(
      `SELECT display_name, profile_image_url FROM users WHERE twitch_id = $1`,
      [creatorId]
    );

    const totalUnique = new Set(cardsResult.rows.map(r => r.id)).size;
    const ownedUnique = cardsResult.rows.filter(r => r.owned).length;

    res.json({
      creator: creatorResult.rows[0] || {},
      cards: cardsResult.rows,
      owned: ownedUnique,
      total: totalUnique,
      percent: totalUnique > 0 ? Math.round((ownedUnique / totalUnique) * 100) : 0,
      rewards: rewardsResult.rows,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/collection-progress/:rewardId/claim
router.post('/:rewardId/claim', authenticate, async (req, res) => {
  const client = await pool.connect();
  try {
    const userId = req.user.twitchId;
    const rewardId = parseInt(req.params.rewardId);

    await client.query('BEGIN');

    // Get reward
    const rewardResult = await client.query(
      `SELECT * FROM collection_rewards WHERE id = $1`, [rewardId]
    );
    if (rewardResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Recompense introuvable' });
    }
    const reward = rewardResult.rows[0];

    // Check not already claimed
    const claimed = await client.query(
      `SELECT id FROM collection_reward_claims WHERE user_id = $1 AND collection_reward_id = $2`,
      [userId, rewardId]
    );
    if (claimed.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Deja reclamee' });
    }

    // Check progress
    const progressResult = await client.query(`
      SELECT
        COUNT(DISTINCT ct.id) AS total,
        COUNT(DISTINCT CASE WHEN uc.id IS NOT NULL THEN ct.id END) AS owned
      FROM card_templates ct
      LEFT JOIN user_cards uc ON uc.card_template_id = ct.id AND uc.user_id = $1
      WHERE ct.creator_id = $2 AND ct.is_active = true
    `, [userId, reward.creator_id]);

    const { total, owned } = progressResult.rows[0];
    const percent = total > 0 ? Math.round((parseInt(owned) / parseInt(total)) * 100) : 0;

    if (percent < reward.threshold) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: `Progression insuffisante (${percent}% / ${reward.threshold}%)` });
    }

    // Grant coins
    const userResult = await client.query(
      `UPDATE users SET coins = coins + $1 WHERE twitch_id = $2 RETURNING coins`,
      [reward.reward_coins, userId]
    );

    // Record claim
    await client.query(
      `INSERT INTO collection_reward_claims (user_id, collection_reward_id) VALUES ($1, $2)`,
      [userId, rewardId]
    );

    // Log transaction
    await client.query(
      `INSERT INTO transactions (user_id, type, amount, balance_after, description, reference_type, reference_id)
       VALUES ($1, 'reward', $2, $3, $4, 'collection_reward', $5)`,
      [userId, reward.reward_coins, userResult.rows[0].coins, `Collection reward: ${reward.reward_title}`, rewardId]
    );

    await client.query('COMMIT');

    await createNotification(userId, 'collection_complete', reward.reward_title || 'Recompense de collection',
      `+${reward.reward_coins} coins`, { rewardId, creatorId: reward.creator_id });

    res.json({
      success: true,
      reward: reward.reward_coins,
      newCoins: userResult.rows[0].coins,
      newToken: generateToken({ twitchId: userId, coins: userResult.rows[0].coins }),
    });
  } catch (error) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
});

export default router;
