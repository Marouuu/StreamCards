import express from 'express';
import { pool } from '../config/database.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

// GET / — Leaderboard with multiple ranking categories
router.get('/', authenticate, async (req, res) => {
  try {
    const { category = 'collection' } = req.query;

    let query;

    switch (category) {
      case 'collection':
        // Rank by total unique cards owned
        query = `
          SELECT
            u.twitch_id,
            u.username,
            u.display_name,
            u.profile_image_url,
            u.is_streamer,
            COUNT(uc.id) AS score,
            'cartes' AS score_label
          FROM users u
          LEFT JOIN user_cards uc ON uc.user_id = u.twitch_id
          GROUP BY u.twitch_id, u.username, u.display_name, u.profile_image_url, u.is_streamer
          HAVING COUNT(uc.id) > 0
          ORDER BY score DESC
          LIMIT 50
        `;
        break;

      case 'rare':
        // Rank by number of legendary + ultra-legendary cards
        query = `
          SELECT
            u.twitch_id,
            u.username,
            u.display_name,
            u.profile_image_url,
            u.is_streamer,
            COUNT(uc.id) AS score,
            'rares' AS score_label
          FROM users u
          JOIN user_cards uc ON uc.user_id = u.twitch_id
          JOIN card_templates ct ON ct.id = uc.card_template_id
          WHERE ct.rarity IN ('legendary', 'ultra-legendary')
          GROUP BY u.twitch_id, u.username, u.display_name, u.profile_image_url, u.is_streamer
          HAVING COUNT(uc.id) > 0
          ORDER BY score DESC
          LIMIT 50
        `;
        break;

      case 'coins':
        // Rank by coins
        query = `
          SELECT
            u.twitch_id,
            u.username,
            u.display_name,
            u.profile_image_url,
            u.is_streamer,
            u.coins AS score,
            'coins' AS score_label
          FROM users u
          WHERE u.coins > 0
          ORDER BY score DESC
          LIMIT 50
        `;
        break;

      case 'trades':
        // Rank by marketplace activity (total buys + sells)
        query = `
          SELECT
            u.twitch_id,
            u.username,
            u.display_name,
            u.profile_image_url,
            u.is_streamer,
            (
              COALESCE(sold.cnt, 0) + COALESCE(bought.cnt, 0)
            ) AS score,
            'trades' AS score_label
          FROM users u
          LEFT JOIN (
            SELECT seller_id, COUNT(*) AS cnt FROM marketplace_listings WHERE status = 'sold' GROUP BY seller_id
          ) sold ON sold.seller_id = u.twitch_id
          LEFT JOIN (
            SELECT buyer_id, COUNT(*) AS cnt FROM marketplace_listings WHERE status = 'sold' GROUP BY buyer_id
          ) bought ON bought.buyer_id = u.twitch_id
          WHERE COALESCE(sold.cnt, 0) + COALESCE(bought.cnt, 0) > 0
          ORDER BY score DESC
          LIMIT 50
        `;
        break;

      default:
        return res.status(400).json({ error: 'Invalid category' });
    }

    const result = await pool.query(query);

    // Find requesting user's rank
    const userRank = result.rows.findIndex(r => r.twitch_id === req.user.twitchId);

    res.json({
      category,
      leaderboard: result.rows.map((row, idx) => ({
        rank: idx + 1,
        twitchId: row.twitch_id,
        username: row.username,
        displayName: row.display_name,
        profileImageUrl: row.profile_image_url,
        isStreamer: row.is_streamer,
        score: parseInt(row.score),
        scoreLabel: row.score_label,
      })),
      myRank: userRank >= 0 ? userRank + 1 : null,
    });
  } catch (error) {
    console.error('Leaderboard error:', error);
    res.status(500).json({ error: 'Failed to load leaderboard' });
  }
});

export default router;
