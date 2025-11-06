import express from 'express';
import { verifyToken } from '../utils/jwt.js';
import { getFollowedChannels, getUsersInfo, getStreamsInfo } from '../services/twitchApi.js';

const router = express.Router();

// Middleware to verify authentication
const authenticate = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.substring(7);
    const decoded = verifyToken(token);

    if (!decoded) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Authentication failed' });
  }
};

// Get followed channels from Twitch API
router.get('/followed', authenticate, async (req, res) => {
  try {
    const { twitchAccessToken, twitchId } = req.user;
    const clientId = process.env.TWITCH_CLIENT_ID;

    if (!twitchAccessToken || !twitchId) {
      return res.status(400).json({ error: 'Twitch access token not available' });
    }

    // Get followed channels
    const followedChannels = await getFollowedChannels(twitchAccessToken, clientId, twitchId);
    
    if (followedChannels.length === 0) {
      return res.json({ channels: [] });
    }

    // Get channel IDs
    const channelIds = followedChannels.map(ch => ch.id);

    // Get detailed user info (profile images)
    const usersInfo = await getUsersInfo(twitchAccessToken, clientId, channelIds);
    
    // Get streams info (viewer counts)
    const streamsInfo = await getStreamsInfo(twitchAccessToken, clientId, channelIds);
    
    // Create maps for quick lookup
    const usersMap = new Map(usersInfo.map(user => [user.id, user]));
    const streamsMap = new Map(streamsInfo.map(stream => [stream.user_id, stream]));

    // Combine data
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
        followed_at: channel.followed_at, // Date when user started following
      };
    });

    // Sort by followed_at (most recently followed first) - this indicates channels user watches most
    enrichedChannels.sort((a, b) => {
      const dateA = new Date(a.followed_at || 0);
      const dateB = new Date(b.followed_at || 0);
      return dateB - dateA; // Most recent first
    });

    res.json({ channels: enrichedChannels });
  } catch (error) {
    console.error('Error fetching followed channels:', error);
    res.status(500).json({ error: 'Failed to fetch followed channels' });
  }
});

export default router;

