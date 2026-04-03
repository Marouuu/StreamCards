import express from 'express';
import { getTwitchAuthUrl, exchangeCodeForToken, getTwitchUserInfo } from '../services/twitchAuth.js';
import { generateToken, verifyToken } from '../utils/jwt.js';
import { pool } from '../config/database.js';
import crypto from 'crypto';

const router = express.Router();

// Upsert user in database on login — returns the DB user row
async function upsertUser(twitchUser) {
  try {
    const result = await pool.query(
      `INSERT INTO users (twitch_id, username, display_name, email, profile_image_url)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (twitch_id) DO UPDATE SET
         username = EXCLUDED.username,
         display_name = EXCLUDED.display_name,
         profile_image_url = EXCLUDED.profile_image_url,
         updated_at = NOW()
       RETURNING *`,
      [
        twitchUser.id,
        twitchUser.login,
        twitchUser.display_name,
        twitchUser.email || null,
        twitchUser.profile_image_url,
      ]
    );
    return result.rows[0];
  } catch (error) {
    console.warn('DB upsert failed, continuing with JWT-only:', error.message);
    return null;
  }
}

// Initiate Twitch OAuth flow
router.get('/twitch', (req, res) => {
  const clientId = process.env.TWITCH_CLIENT_ID;
  const redirectUri = process.env.TWITCH_REDIRECT_URI;

  if (!clientId || !redirectUri) {
    return res.status(500).json({
      error: 'Twitch OAuth not configured. Please set TWITCH_CLIENT_ID and TWITCH_REDIRECT_URI in .env'
    });
  }

  const state = crypto.randomBytes(32).toString('hex');
  const authUrl = getTwitchAuthUrl(clientId, redirectUri, state);
  res.redirect(authUrl);
});

// Handle Twitch OAuth callback
router.get('/twitch/callback', async (req, res) => {
  const { code, state, error } = req.query;
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';

  if (error) {
    console.error('OAuth error from Twitch:', error);
    return res.redirect(`${frontendUrl}?error=${encodeURIComponent(error)}`);
  }

  if (!code) {
    return res.redirect(`${frontendUrl}?error=no_code`);
  }

  try {
    const clientId = process.env.TWITCH_CLIENT_ID;
    const clientSecret = process.env.TWITCH_CLIENT_SECRET;
    const redirectUri = process.env.TWITCH_REDIRECT_URI;

    if (!clientId || !clientSecret || !redirectUri) {
      throw new Error('Twitch OAuth not properly configured');
    }

    const tokenData = await exchangeCodeForToken(clientId, clientSecret, code, redirectUri);
    const twitchUser = await getTwitchUserInfo(tokenData.accessToken, clientId);

    // Persist user to database (upsert)
    const dbUser = await upsertUser(twitchUser);

    // Use DB coins if available, otherwise 0
    const coins = dbUser ? dbUser.coins : 0;

    const jwtToken = generateToken(twitchUser, tokenData.accessToken, coins);
    res.redirect(`${frontendUrl}?token=${jwtToken}&success=true`);
  } catch (error) {
    console.error('OAuth callback error:', error);
    res.redirect(`${frontendUrl}?error=${encodeURIComponent(error.message)}`);
  }
});

// Get current user — reads coins from DB as source of truth
router.get('/me', async (req, res) => {
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

    // Try to get fresh coins from DB
    let coins = decoded.coins || 0;
    let isStreamer = false;
    try {
      const result = await pool.query(
        'SELECT coins, is_streamer FROM users WHERE twitch_id = $1',
        [decoded.twitchId]
      );
      if (result.rows.length > 0) {
        coins = result.rows[0].coins;
        isStreamer = result.rows[0].is_streamer;
      }
    } catch {
      // DB unavailable, fall back to JWT coins
    }

    res.json({
      id: decoded.twitchId,
      twitchId: decoded.twitchId,
      username: decoded.username,
      displayName: decoded.displayName,
      profileImageUrl: decoded.profileImageUrl,
      coins,
      isStreamer,
    });
  } catch (error) {
    console.error('Error in /me endpoint:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
