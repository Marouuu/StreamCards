import express from 'express';
import { pool } from '../config/database.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

// GET /api/analytics — streamer analytics dashboard
router.get('/', authenticate, async (req, res) => {
  try {
    const streamerId = req.user.twitchId;

    // Verify user is a streamer
    const userCheck = await pool.query(
      `SELECT is_streamer FROM users WHERE twitch_id = $1`, [streamerId]
    );
    if (!userCheck.rows[0]?.is_streamer) {
      return res.status(403).json({ error: 'Streamer uniquement' });
    }

    // Total cards created
    const totalCards = await pool.query(
      `SELECT COUNT(*) AS c FROM card_templates WHERE creator_id = $1 AND is_active = true`,
      [streamerId]
    );

    // Total booster packs
    const totalPacks = await pool.query(
      `SELECT COUNT(*) AS c FROM booster_packs WHERE creator_id = $1`,
      [streamerId]
    );

    // Total cards collected by users (how many user_cards exist for this streamer's templates)
    const totalCollected = await pool.query(
      `SELECT COUNT(*) AS c FROM user_cards uc
       JOIN card_templates ct ON uc.card_template_id = ct.id
       WHERE ct.creator_id = $1`,
      [streamerId]
    );

    // Unique collectors (distinct users who have at least one of this streamer's cards)
    const uniqueCollectors = await pool.query(
      `SELECT COUNT(DISTINCT uc.user_id) AS c FROM user_cards uc
       JOIN card_templates ct ON uc.card_template_id = ct.id
       WHERE ct.creator_id = $1`,
      [streamerId]
    );

    // Boosters opened (containing this streamer's cards)
    const boostersOpened = await pool.query(
      `SELECT COUNT(DISTINCT bo.id) AS c FROM booster_openings bo
       JOIN booster_packs bp ON bo.booster_pack_id = bp.id
       WHERE bp.creator_id = $1`,
      [streamerId]
    );

    // Total coins spent on this streamer's boosters
    const coinsSpent = await pool.query(
      `SELECT COALESCE(SUM(bo.coins_spent), 0) AS total FROM booster_openings bo
       JOIN booster_packs bp ON bo.booster_pack_id = bp.id
       WHERE bp.creator_id = $1`,
      [streamerId]
    );

    // Marketplace volume (total coins from sales of this streamer's cards)
    const marketVolume = await pool.query(
      `SELECT COALESCE(SUM(ml.price), 0) AS total FROM marketplace_listings ml
       JOIN card_templates ct ON ml.card_template_id = ct.id
       WHERE ct.creator_id = $1 AND ml.status = 'sold'`,
      [streamerId]
    );

    // Most popular cards (top 10 by copies collected)
    const popularCards = await pool.query(
      `SELECT ct.id, ct.name, ct.rarity, ct.image_url, ct.outline_color, ct.background_color,
        ct.text_color, ct.effect, ct.effect_color, ct.effect_intensity,
        COUNT(uc.id) AS copies,
        COUNT(DISTINCT uc.user_id) AS unique_owners
       FROM card_templates ct
       LEFT JOIN user_cards uc ON uc.card_template_id = ct.id
       WHERE ct.creator_id = $1 AND ct.is_active = true
       GROUP BY ct.id
       ORDER BY copies DESC
       LIMIT 10`,
      [streamerId]
    );

    // Rarity distribution of collected cards
    const rarityDist = await pool.query(
      `SELECT ct.rarity, COUNT(uc.id) AS count
       FROM user_cards uc
       JOIN card_templates ct ON uc.card_template_id = ct.id
       WHERE ct.creator_id = $1
       GROUP BY ct.rarity
       ORDER BY CASE ct.rarity
         WHEN 'common' THEN 1 WHEN 'uncommon' THEN 2 WHEN 'rare' THEN 3
         WHEN 'epic' THEN 4 WHEN 'legendary' THEN 5 WHEN 'ultra-legendary' THEN 6
       END`,
      [streamerId]
    );

    // Recent activity (last 10 booster openings)
    const recentActivity = await pool.query(
      `SELECT bo.opened_at, bo.coins_spent, bp.name AS pack_name,
        u.display_name AS user_name, u.profile_image_url AS user_image
       FROM booster_openings bo
       JOIN booster_packs bp ON bo.booster_pack_id = bp.id
       JOIN users u ON bo.user_id = u.twitch_id
       WHERE bp.creator_id = $1
       ORDER BY bo.opened_at DESC
       LIMIT 10`,
      [streamerId]
    );

    // Collection completion rates
    const completionRates = await pool.query(
      `SELECT
        COUNT(DISTINCT CASE WHEN sub.percent = 100 THEN sub.user_id END) AS complete,
        COUNT(DISTINCT CASE WHEN sub.percent >= 50 AND sub.percent < 100 THEN sub.user_id END) AS half,
        COUNT(DISTINCT CASE WHEN sub.percent > 0 AND sub.percent < 50 THEN sub.user_id END) AS started
       FROM (
         SELECT uc.user_id,
           ROUND(COUNT(DISTINCT uc.card_template_id)::numeric / NULLIF(
             (SELECT COUNT(*) FROM card_templates WHERE creator_id = $1 AND is_active = true), 0
           ) * 100) AS percent
         FROM user_cards uc
         JOIN card_templates ct ON uc.card_template_id = ct.id
         WHERE ct.creator_id = $1
         GROUP BY uc.user_id
       ) sub`,
      [streamerId]
    );

    res.json({
      overview: {
        totalCards: parseInt(totalCards.rows[0].c),
        totalPacks: parseInt(totalPacks.rows[0].c),
        totalCollected: parseInt(totalCollected.rows[0].c),
        uniqueCollectors: parseInt(uniqueCollectors.rows[0].c),
        boostersOpened: parseInt(boostersOpened.rows[0].c),
        coinsSpent: parseInt(coinsSpent.rows[0].total),
        marketVolume: parseInt(marketVolume.rows[0].total),
      },
      popularCards: popularCards.rows,
      rarityDistribution: rarityDist.rows,
      recentActivity: recentActivity.rows,
      completionRates: completionRates.rows[0] || { complete: 0, half: 0, started: 0 },
    });
  } catch (error) {
    console.error('Analytics error:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
