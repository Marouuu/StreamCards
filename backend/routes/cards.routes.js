import express from 'express';
import { pool } from '../config/database.js';
import { verifyToken } from '../utils/jwt.js';

const router = express.Router();

// Get all cards for a streamer
router.get('/streamer/:streamerId', async (req, res) => {
  try {
    const { streamerId } = req.params;
    const result = await pool.query(
      `SELECT ct.*, s.username as streamer_name, s.display_name as streamer_display_name
       FROM card_templates ct
       JOIN streamers s ON ct.streamer_id = s.id
       WHERE ct.streamer_id = $1
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
router.get('/collection/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    // Verify authentication
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const decoded = verifyToken(token);
      // Compare with Twitch ID from JWT
      if (decoded && decoded.twitchId !== userId && decoded.id !== userId) {
        return res.status(403).json({ error: 'Access denied' });
      }
    }

    const result = await pool.query(
      `SELECT 
        uc.id,
        uc.obtained_at,
        ct.id as card_template_id,
        ct.name,
        ct.description,
        ct.image_url as imageUrl,
        ct.rarity,
        ct.animation_url,
        s.id as streamer_id,
        s.username as streamer_name,
        s.display_name as streamer_display_name,
        s.profile_image_url as streamer_image
       FROM user_cards uc
       JOIN card_templates ct ON uc.card_template_id = ct.id
       JOIN streamers s ON ct.streamer_id = s.id
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
router.post('/template', async (req, res) => {
  try {
    // TODO: Verify user is a streamer
    const { streamerId, name, description, imageUrl, rarity, animationUrl } = req.body;

    const result = await pool.query(
      `INSERT INTO card_templates (streamer_id, name, description, image_url, rarity, animation_url)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [streamerId, name, description, imageUrl, rarity, animationUrl]
    );

    res.status(201).json({ card: result.rows[0] });
  } catch (error) {
    console.error('Error creating card template:', error);
    res.status(500).json({ error: 'Failed to create card template' });
  }
});

export default router;

