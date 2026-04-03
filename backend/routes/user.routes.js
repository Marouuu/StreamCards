import express from 'express';
import { generateToken } from '../utils/jwt.js';
import { pool } from '../config/database.js';
import { authenticate } from '../middleware/auth.js';
import { getFollowedChannels, getUsersInfo, getStreamsInfo } from '../services/twitchApi.js';

const router = express.Router();

// Get followed channels from Twitch API
router.get('/followed', authenticate, async (req, res) => {
  try {
    const { twitchAccessToken, twitchId } = req.user;
    const clientId = process.env.TWITCH_CLIENT_ID;

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

// Add coins (development route) — persists to DB
router.post('/add-coins', authenticate, async (req, res) => {
  try {
    const { amount = 1000000 } = req.body;
    const twitchId = req.user.twitchId;

    // Update coins in database
    let newCoins;
    try {
      const result = await pool.query(
        `UPDATE users SET coins = coins + $1 WHERE twitch_id = $2 RETURNING coins`,
        [amount, twitchId]
      );
      if (result.rows.length > 0) {
        newCoins = result.rows[0].coins;
        // Log the transaction
        await pool.query(
          `INSERT INTO transactions (user_id, type, amount, balance_after, description)
           VALUES ($1, 'admin', $2, $3, 'Dev: add coins')`,
          [twitchId, amount, newCoins]
        );
      } else {
        // User not in DB yet, fall back to JWT
        newCoins = (req.user.coins || 0) + amount;
      }
    } catch {
      // DB unavailable, fall back to JWT
      newCoins = (req.user.coins || 0) + amount;
    }

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

    res.json({ success: true, newCoins, addedCoins: amount, newToken });
  } catch (error) {
    console.error('Error adding coins:', error);
    res.status(500).json({ error: 'Failed to add coins' });
  }
});

// Toggle streamer mode
router.post('/toggle-streamer', authenticate, async (req, res) => {
  try {
    const result = await pool.query(
      `UPDATE users SET is_streamer = NOT is_streamer WHERE twitch_id = $1 RETURNING is_streamer`,
      [req.user.twitchId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json({ isStreamer: result.rows[0].is_streamer });
  } catch (error) {
    console.error('Error toggling streamer:', error);
    res.status(500).json({ error: 'Failed to toggle streamer mode' });
  }
});

export default router;
