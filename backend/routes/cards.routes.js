import express from 'express';
import { pool } from '../config/database.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

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
    const { userId } = req.params;

    // Users can only view their own collection
    if (req.user.twitchId !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const result = await pool.query(
      `SELECT
        uc.id,
        uc.obtained_at,
        ct.id AS card_template_id,
        ct.name,
        ct.description,
        ct.image_url,
        ct.rarity,
        ct.animation_url,
        u.twitch_id AS creator_id,
        u.username AS creator_name,
        u.display_name AS creator_display_name,
        u.profile_image_url AS creator_image
       FROM user_cards uc
       JOIN card_templates ct ON uc.card_template_id = ct.id
       JOIN users u ON ct.creator_id = u.twitch_id
       WHERE uc.user_id = $1
       ORDER BY uc.obtained_at DESC`,
      [userId]
    );

    res.json({ cards: result.rows });
  } catch (error) {
    console.error('Error fetching user collection:', error);
    res.status(500).json({ error: 'Failed to fetch collection' });
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
