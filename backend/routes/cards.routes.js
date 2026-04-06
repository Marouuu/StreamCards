import express from 'express';
import { pool } from '../config/database.js';
import { authenticate } from '../middleware/auth.js';
import { generateToken } from '../utils/jwt.js';

const router = express.Router();

// Public: get random cards for the floating background
router.get('/random', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 20, 50);
    const result = await pool.query(
      `SELECT ct.id, ct.name, ct.description, ct.image_url, ct.rarity,
              ct.outline_color, ct.background_color, ct.text_color,
              ct.effect, ct.effect_color, ct.effect_intensity,
              u.username AS creator_name, u.display_name AS creator_display_name
       FROM card_templates ct
       JOIN users u ON ct.creator_id = u.twitch_id
       JOIN booster_packs bp ON ct.booster_pack_id = bp.id
       WHERE ct.is_active = true AND bp.is_published = true
       ORDER BY RANDOM()
       LIMIT $1`,
      [limit]
    );
    res.json({ cards: result.rows });
  } catch (error) {
    console.error('Error fetching random cards:', error);
    res.status(500).json({ error: 'Failed to fetch random cards' });
  }
});

// Get all cards for a streamer (by twitch_id)
router.get('/streamer/:streamerId', async (req, res) => {
  try {
    const { streamerId } = req.params;
    const result = await pool.query(
      `SELECT ct.*, u.username AS creator_name, u.display_name AS creator_display_name
       FROM card_templates ct
       JOIN users u ON ct.creator_id = u.twitch_id
       WHERE ct.creator_id = $1 AND ct.is_active = true
       ORDER BY ct.created_at DESC`,
      [streamerId]
    );
    res.json({ cards: result.rows });
  } catch (error) {
    console.error('Error fetching streamer cards:', error);
    res.status(500).json({ error: 'Failed to fetch streamer cards' });
  }
});

// Get user's collection
router.get('/collection/:userId', authenticate, async (req, res) => {
  try {
    const userId = req.params.userId === 'me' ? req.user.twitchId : req.params.userId;

    // Allow viewing other users' collections for trading
    const isOwn = req.user.twitchId === userId;

    const result = await pool.query(
      `SELECT
        uc.id,
        uc.obtained_at,
        ct.id AS card_template_id,
        ct.name,
        ct.description,
        ct.image_url,
        ct.rarity,
        ct.outline_color,
        ct.background_color,
        ct.text_color,
        ct.effect,
        ct.effect_color,
        ct.effect_intensity,
        bp.id AS booster_pack_id,
        bp.name AS booster_pack_name,
        bp.rarity AS booster_rarity,
        u.twitch_id AS creator_id,
        u.username AS creator_name,
        u.display_name AS creator_display_name,
        u.profile_image_url AS creator_image
       FROM user_cards uc
       JOIN card_templates ct ON uc.card_template_id = ct.id
       JOIN users u ON ct.creator_id = u.twitch_id
       LEFT JOIN booster_openings bo ON uc.booster_opening_id = bo.id
       LEFT JOIN booster_packs bp ON bo.booster_pack_id = bp.id
       WHERE uc.user_id = $1
       ORDER BY uc.obtained_at DESC`,
      [userId]
    );

    // Compute duplicate counts
    const templateCounts = {};
    for (const card of result.rows) {
      templateCounts[card.card_template_id] = (templateCounts[card.card_template_id] || 0) + 1;
    }
    const cards = result.rows.map(card => ({
      ...card,
      duplicate_count: templateCounts[card.card_template_id],
    }));

    const totalCards = cards.length;
    const uniqueCards = Object.keys(templateCounts).length;

    res.json({ cards, stats: { totalCards, uniqueCards, duplicates: totalCards - uniqueCards } });
  } catch (error) {
    console.error('Error fetching user collection:', error);
    res.status(500).json({ error: 'Failed to fetch collection' });
  }
});

// Recycle (sell) a duplicate card for 10 coins
const RECYCLE_VALUE = 10;

router.post('/recycle/:cardId', authenticate, async (req, res) => {
  try {
    const { cardId } = req.params;
    const twitchId = req.user.twitchId;

    // 1. Verify this card instance belongs to the user
    const cardResult = await pool.query(
      'SELECT id, card_template_id FROM user_cards WHERE id = $1 AND user_id = $2',
      [cardId, twitchId]
    );
    if (cardResult.rows.length === 0) {
      return res.status(404).json({ error: 'Carte introuvable' });
    }

    const templateId = cardResult.rows[0].card_template_id;

    // 2. Check the user owns more than 1 copy (only duplicates can be sold)
    const countResult = await pool.query(
      'SELECT COUNT(*) AS count FROM user_cards WHERE user_id = $1 AND card_template_id = $2',
      [twitchId, templateId]
    );
    if (parseInt(countResult.rows[0].count) <= 1) {
      return res.status(400).json({ error: 'Vous ne pouvez recycler que les doublons' });
    }

    // 3. Transaction: delete card, add coins, log transaction
    await pool.query('BEGIN');

    await pool.query('DELETE FROM user_cards WHERE id = $1', [cardId]);

    await pool.query('UPDATE users SET coins = coins + $1 WHERE twitch_id = $2', [RECYCLE_VALUE, twitchId]);

    const userResult = await pool.query('SELECT coins FROM users WHERE twitch_id = $1', [twitchId]);
    const newCoins = userResult.rows[0].coins;

    await pool.query(
      `INSERT INTO transactions (user_id, type, amount, balance_after, description, reference_type, reference_id)
       VALUES ($1, 'reward', $2, $3, 'Recyclage de carte', 'user_card', $4)`,
      [twitchId, RECYCLE_VALUE, newCoins, parseInt(cardId)]
    );

    await pool.query('COMMIT');

    // New JWT with updated coins
    const newToken = generateToken(
      {
        id: req.user.twitchId,
        login: req.user.username,
        display_name: req.user.displayName,
        profile_image_url: req.user.profileImageUrl,
      },
      req.user.twitchAccessToken,
      newCoins
    );

    res.json({
      success: true,
      recycledCardId: parseInt(cardId),
      coinsEarned: RECYCLE_VALUE,
      newCoins,
      newToken,
    });
  } catch (error) {
    try { await pool.query('ROLLBACK'); } catch { /* ignore */ }
    console.error('Error recycling card:', error);
    res.status(500).json({ error: 'Erreur lors du recyclage' });
  }
});

// Recycle ALL duplicates at once (keep 1 of each, sell the rest)
router.post('/recycle-all', authenticate, async (req, res) => {
  try {
    const twitchId = req.user.twitchId;

    // Find all duplicate card instances (keep the oldest one per template)
    const duplicates = await pool.query(
      `SELECT uc.id
       FROM user_cards uc
       WHERE uc.user_id = $1
         AND uc.id NOT IN (
           SELECT MIN(id) FROM user_cards WHERE user_id = $1 GROUP BY card_template_id
         )`,
      [twitchId]
    );

    if (duplicates.rows.length === 0) {
      return res.status(400).json({ error: 'Aucun doublon à recycler' });
    }

    const count = duplicates.rows.length;
    const totalCoins = count * RECYCLE_VALUE;
    const ids = duplicates.rows.map(r => r.id);

    await pool.query('BEGIN');

    await pool.query('DELETE FROM user_cards WHERE id = ANY($1)', [ids]);
    await pool.query('UPDATE users SET coins = coins + $1 WHERE twitch_id = $2', [totalCoins, twitchId]);

    const userResult = await pool.query('SELECT coins FROM users WHERE twitch_id = $1', [twitchId]);
    const newCoins = userResult.rows[0].coins;

    await pool.query(
      `INSERT INTO transactions (user_id, type, amount, balance_after, description)
       VALUES ($1, 'reward', $2, $3, $4)`,
      [twitchId, totalCoins, newCoins, `Recyclage de ${count} doublon(s)`]
    );

    await pool.query('COMMIT');

    const newToken = generateToken(
      {
        id: req.user.twitchId,
        login: req.user.username,
        display_name: req.user.displayName,
        profile_image_url: req.user.profileImageUrl,
      },
      req.user.twitchAccessToken,
      newCoins
    );

    res.json({
      success: true,
      recycledCount: count,
      coinsEarned: totalCoins,
      newCoins,
      newToken,
    });
  } catch (error) {
    try { await pool.query('ROLLBACK'); } catch { /* ignore */ }
    console.error('Error recycling all duplicates:', error);
    res.status(500).json({ error: 'Erreur lors du recyclage' });
  }
});

// Create card template (streamer only)
router.post('/template', authenticate, async (req, res) => {
  try {
    // Verify user is a streamer
    const userResult = await pool.query(
      'SELECT is_streamer FROM users WHERE twitch_id = $1',
      [req.user.twitchId]
    );
    if (userResult.rows.length === 0 || !userResult.rows[0].is_streamer) {
      return res.status(403).json({ error: 'Only streamers can create card templates' });
    }

    const { name, description, imageUrl, rarity, animationUrl } = req.body;

    const result = await pool.query(
      `INSERT INTO card_templates (creator_id, name, description, image_url, rarity, animation_url)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [req.user.twitchId, name, description, imageUrl, rarity || 'common', animationUrl]
    );

    res.status(201).json({ card: result.rows[0] });
  } catch (error) {
    console.error('Error creating card template:', error);
    res.status(500).json({ error: 'Failed to create card template' });
  }
});

export default router;
