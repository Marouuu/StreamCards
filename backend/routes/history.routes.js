import express from 'express';
import { pool } from '../config/database.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

// GET /api/history — all booster openings for current user
router.get('/', authenticate, async (req, res) => {
  try {
    const userId = req.user.twitchId;
    const { page = 1 } = req.query;
    const limit = 20;
    const offset = (Math.max(1, parseInt(page)) - 1) * limit;

    const result = await pool.query(`
      SELECT bo.id, bo.coins_spent, bo.opened_at,
        bp.name AS booster_name, bp.color_primary, bp.color_accent, bp.rarity AS booster_rarity,
        u.display_name AS creator_name, u.profile_image_url AS creator_image,
        (SELECT COUNT(*) FROM user_cards uc WHERE uc.booster_opening_id = bo.id) AS card_count
      FROM booster_openings bo
      JOIN booster_packs bp ON bo.booster_pack_id = bp.id
      JOIN users u ON bp.creator_id = u.twitch_id
      WHERE bo.user_id = $1
      ORDER BY bo.opened_at DESC
      LIMIT $2 OFFSET $3
    `, [userId, limit, offset]);

    const countResult = await pool.query(
      'SELECT COUNT(*) FROM booster_openings WHERE user_id = $1', [userId]
    );

    res.json({
      openings: result.rows,
      total: parseInt(countResult.rows[0].count),
      page: parseInt(page),
      totalPages: Math.ceil(parseInt(countResult.rows[0].count) / limit),
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/history/:openingId — cards from a specific opening
router.get('/:openingId', authenticate, async (req, res) => {
  try {
    const userId = req.user.twitchId;
    const { openingId } = req.params;

    // Verify ownership
    const opening = await pool.query(
      `SELECT bo.*, bp.name AS booster_name, bp.color_primary, bp.color_accent
       FROM booster_openings bo
       JOIN booster_packs bp ON bo.booster_pack_id = bp.id
       WHERE bo.id = $1 AND bo.user_id = $2`,
      [openingId, userId]
    );

    if (opening.rows.length === 0) {
      return res.status(404).json({ error: 'Ouverture introuvable' });
    }

    const cards = await pool.query(`
      SELECT uc.id AS user_card_id, uc.obtained_at,
        ct.id AS card_id, ct.name, ct.image_url, ct.rarity,
        ct.outline_color, ct.background_color, ct.text_color,
        ct.effect, ct.effect_color, ct.effect_intensity, ct.description,
        u.display_name AS creator_name
      FROM user_cards uc
      JOIN card_templates ct ON uc.card_template_id = ct.id
      JOIN users u ON ct.creator_id = u.twitch_id
      WHERE uc.booster_opening_id = $1
      ORDER BY CASE ct.rarity
        WHEN 'common' THEN 1 WHEN 'uncommon' THEN 2 WHEN 'rare' THEN 3
        WHEN 'epic' THEN 4 WHEN 'legendary' THEN 5 WHEN 'ultra-legendary' THEN 6
      END
    `, [openingId]);

    res.json({
      opening: opening.rows[0],
      cards: cards.rows,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
