import express from 'express';
import { generateToken } from '../utils/jwt.js';
import { pool } from '../config/database.js';
import { authenticate } from '../middleware/auth.js';
import { getFollowedChannels, getUsersInfo, getStreamsInfo } from '../services/twitchApi.js';

const router = express.Router();

// Get followed channels from Twitch API
router.get('/followed', authenticate, async (req, res) => {
  try {
    const { twitchId } = req.user;
    const clientId = process.env.TWITCH_CLIENT_ID;

    // Read Twitch access token from DB (no longer stored in JWT)
    const tokenResult = await pool.query('SELECT twitch_access_token FROM users WHERE twitch_id = $1', [twitchId]);
    const twitchAccessToken = tokenResult.rows[0]?.twitch_access_token;

    if (!twitchAccessToken || !twitchId) {
      return res.status(400).json({ error: 'Twitch access token not available' });
    }

    const followedChannels = await getFollowedChannels(twitchAccessToken, clientId, twitchId);

    if (followedChannels.length === 0) {
      return res.json({ channels: [] });
    }

    const channelIds = followedChannels.map(ch => ch.id);
    const usersInfo = await getUsersInfo(twitchAccessToken, clientId, channelIds);
    const streamsInfo = await getStreamsInfo(twitchAccessToken, clientId, channelIds);

    const usersMap = new Map(usersInfo.map(user => [user.id, user]));
    const streamsMap = new Map(streamsInfo.map(stream => [stream.user_id, stream]));

    const enrichedChannels = followedChannels.map(channel => {
      const userInfo = usersMap.get(channel.id);
      const streamInfo = streamsMap.get(channel.id);
      return {
        id: channel.id,
        display_name: channel.display_name,
        profile_image_url: userInfo?.profile_image_url || null,
        viewer_count: streamInfo?.viewer_count || 0,
        is_live: !!streamInfo,
        game_name: streamInfo?.game_name || null,
        followed_at: channel.followed_at,
      };
    });

    enrichedChannels.sort((a, b) => new Date(b.followed_at || 0) - new Date(a.followed_at || 0));
    res.json({ channels: enrichedChannels });
  } catch (error) {
    console.error('Error fetching followed channels:', error);
    res.status(500).json({ error: 'Failed to fetch followed channels' });
  }
});

// Add coins (admin only)
router.post('/add-coins', authenticate, async (req, res) => {
  try {
    const twitchId = req.user.twitchId;

    // Admin check
    const adminCheck = await pool.query('SELECT is_admin FROM users WHERE twitch_id = $1', [twitchId]);
    if (adminCheck.rows.length === 0 || !adminCheck.rows[0].is_admin) {
      return res.status(403).json({ error: 'Admin only' });
    }

    const { amount } = req.body;
    if (!Number.isInteger(amount) || amount <= 0 || amount > 10000000) {
      return res.status(400).json({ error: 'Amount must be an integer between 1 and 10,000,000' });
    }

    const result = await pool.query(
      `UPDATE users SET coins = coins + $1 WHERE twitch_id = $2 RETURNING coins`,
      [amount, twitchId]
    );
    const newCoins = result.rows[0].coins;

    await pool.query(
      `INSERT INTO transactions (user_id, type, amount, balance_after, description)
       VALUES ($1, 'admin', $2, $3, 'Admin: add coins')`,
      [twitchId, amount, newCoins]
    );

    const newToken = generateToken(
      {
        id: req.user.twitchId,
        login: req.user.username,
        display_name: req.user.displayName,
        profile_image_url: req.user.profileImageUrl,
      },
      null,
      newCoins
    );

    res.json({ success: true, newCoins, addedCoins: amount, newToken });
  } catch (error) {
    console.error('Error adding coins:', error);
    res.status(500).json({ error: 'Failed to add coins' });
  }
});

// Request streamer status (requires admin approval)
router.post('/request-streamer', authenticate, async (req, res) => {
  try {
    const twitchId = req.user.twitchId;

    // Check current status
    const current = await pool.query(
      'SELECT streamer_status FROM users WHERE twitch_id = $1',
      [twitchId]
    );

    if (current.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const status = current.rows[0].streamer_status;

    if (status === 'approved') {
      return res.status(400).json({ error: 'You are already an approved streamer' });
    }
    if (status === 'pending') {
      return res.status(400).json({ error: 'Your request is already pending' });
    }

    const result = await pool.query(
      `UPDATE users
       SET streamer_status = 'pending',
           streamer_requested_at = NOW()
       WHERE twitch_id = $1
       RETURNING streamer_status`,
      [twitchId]
    );

    res.json({ success: true, streamerStatus: result.rows[0].streamer_status });
  } catch (error) {
    console.error('Error requesting streamer:', error);
    res.status(500).json({ error: 'Failed to submit streamer request' });
  }
});

// Get own streamer status
router.get('/streamer-status', authenticate, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT streamer_status, streamer_reviewed_at, streamer_review_note FROM users WHERE twitch_id = $1',
      [req.user.twitchId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching streamer status:', error);
    res.status(500).json({ error: 'Failed to fetch status' });
  }
});

// GET /api/user/search?q=... — search users for trade partner picker
router.get('/search', authenticate, async (req, res) => {
  try {
    const { q } = req.query;
    if (!q || q.length < 2) {
      return res.json({ users: [] });
    }

    const result = await pool.query(
      `SELECT twitch_id, username, display_name, profile_image_url
       FROM users
       WHERE (username ILIKE $1 OR display_name ILIKE $1)
         AND twitch_id != $2
       ORDER BY display_name
       LIMIT 20`,
      [`%${q}%`, req.user.twitchId]
    );

    res.json({ users: result.rows });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
