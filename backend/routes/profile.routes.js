import express from 'express';
import { pool } from '../config/database.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

// GET /api/profile/:userId — public profile
router.get('/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    const userResult = await pool.query(
      `SELECT twitch_id, username, display_name, profile_image_url, bio, is_streamer, created_at
       FROM users WHERE twitch_id = $1`,
      [userId]
    );
    if (userResult.rows.length === 0) return res.status(404).json({ error: 'Utilisateur introuvable' });

    const user = userResult.rows[0];

    // Stats
    const statsResult = await pool.query(
      `SELECT COUNT(*) AS total_cards, COUNT(DISTINCT card_template_id) AS unique_cards
       FROM user_cards WHERE user_id = $1`,
      [userId]
    );

    const tradeStats = await pool.query(
      `SELECT COUNT(*) AS trades_completed FROM trades
       WHERE (sender_id = $1 OR receiver_id = $1) AND status = 'accepted'`,
      [userId]
    );

    // Showcase cards
    const showcaseResult = await pool.query(
      `SELECT ps.position, uc.id AS user_card_id,
        ct.name, ct.image_url, ct.rarity, ct.outline_color, ct.background_color,
        ct.text_color, ct.effect, ct.effect_color, ct.effect_intensity, ct.description,
        u.display_name AS creator_display_name, u.profile_image_url AS creator_image
       FROM profile_showcase ps
       JOIN user_cards uc ON ps.user_card_id = uc.id
       JOIN card_templates ct ON uc.card_template_id = ct.id
       JOIN users u ON ct.creator_id = u.twitch_id
       WHERE ps.user_id = $1
       ORDER BY ps.position`,
      [userId]
    );

    res.json({
      user: {
        twitchId: user.twitch_id,
        username: user.username,
        displayName: user.display_name,
        profileImageUrl: user.profile_image_url,
        bio: user.bio,
        isStreamer: user.is_streamer,
        createdAt: user.created_at,
      },
      stats: {
        totalCards: parseInt(statsResult.rows[0].total_cards),
        uniqueCards: parseInt(statsResult.rows[0].unique_cards),
        tradesCompleted: parseInt(tradeStats.rows[0].trades_completed),
      },
      showcase: showcaseResult.rows,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/profile/showcase — update own showcase
router.put('/showcase', authenticate, async (req, res) => {
  try {
    const userId = req.user.twitchId;
    const { cards } = req.body; // [{ userCardId, position }]

    if (!Array.isArray(cards) || cards.length > 5) {
      return res.status(400).json({ error: 'Maximum 5 cartes' });
    }

    for (const c of cards) {
      if (!Number.isInteger(c.position) || c.position < 1 || c.position > 5) {
        return res.status(400).json({ error: 'Position invalide (1-5)' });
      }
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Verify ownership
      for (const c of cards) {
        const own = await client.query(
          `SELECT id FROM user_cards WHERE id = $1 AND user_id = $2`,
          [c.userCardId, userId]
        );
        if (own.rows.length === 0) {
          await client.query('ROLLBACK');
          return res.status(400).json({ error: 'Carte non possedee' });
        }
      }

      // Clear existing
      await client.query(`DELETE FROM profile_showcase WHERE user_id = $1`, [userId]);

      // Insert new
      for (const c of cards) {
        await client.query(
          `INSERT INTO profile_showcase (user_id, user_card_id, position) VALUES ($1, $2, $3)`,
          [userId, c.userCardId, c.position]
        );
      }

      await client.query('COMMIT');
      res.json({ success: true });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/profile/bio — update bio
router.put('/bio', authenticate, async (req, res) => {
  try {
    const { bio } = req.body;
    if (typeof bio !== 'string' || bio.length > 500) {
      return res.status(400).json({ error: 'Bio trop longue (max 500 caracteres)' });
    }

    await pool.query(
      `UPDATE users SET bio = $1 WHERE twitch_id = $2`,
      [bio.trim(), req.user.twitchId]
    );
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
