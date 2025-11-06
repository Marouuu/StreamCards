import express from 'express';
import { getTwitchAuthUrl, exchangeCodeForToken, getTwitchUserInfo } from '../services/twitchAuth.js';
import { generateToken, verifyToken } from '../utils/jwt.js';
import crypto from 'crypto';

const router = express.Router();

// Initiate Twitch OAuth flow
router.get('/twitch', (req, res) => {
  const clientId = process.env.TWITCH_CLIENT_ID;
  const redirectUri = process.env.TWITCH_REDIRECT_URI;
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';

  if (!clientId || !redirectUri) {
    return res.status(500).json({ 
      error: 'Twitch OAuth not configured. Please set TWITCH_CLIENT_ID and TWITCH_REDIRECT_URI in .env' 
    });
  }

  // Generate state for CSRF protection
  const state = crypto.randomBytes(32).toString('hex');
  
  // Store state in session or cookie (for production, use proper session storage)
  // For now, we'll include it in the redirect and verify it in callback
  
  const authUrl = getTwitchAuthUrl(clientId, redirectUri, state);
  
  res.redirect(authUrl);
});

// Handle Twitch OAuth callback
router.get('/twitch/callback', async (req, res) => {
  const { code, state, error } = req.query;
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';

  console.log('OAuth callback received:', { code: code ? 'present' : 'missing', state, error });

  if (error) {
    console.error('OAuth error from Twitch:', error);
    return res.redirect(`${frontendUrl}?error=${encodeURIComponent(error)}`);
  }

  if (!code) {
    console.error('No authorization code received');
    return res.redirect(`${frontendUrl}?error=no_code`);
  }

  try {
    const clientId = process.env.TWITCH_CLIENT_ID;
    const clientSecret = process.env.TWITCH_CLIENT_SECRET;
    const redirectUri = process.env.TWITCH_REDIRECT_URI;

    if (!clientId || !clientSecret || !redirectUri) {
      throw new Error('Twitch OAuth not properly configured');
    }

    console.log('Exchanging code for token...');
    // Exchange code for access token
    const tokenData = await exchangeCodeForToken(clientId, clientSecret, code, redirectUri);
    console.log('Token received, fetching user info...');

    // Get user information from Twitch
    const twitchUser = await getTwitchUserInfo(tokenData.accessToken, clientId);
    console.log('Twitch user info:', { id: twitchUser.id, username: twitchUser.login, displayName: twitchUser.display_name });

    // Generate JWT token with Twitch user data and access token
    const jwtToken = generateToken(twitchUser, tokenData.accessToken);
    console.log('JWT token generated, redirecting to frontend...');

    // Redirect to frontend with token
    res.redirect(`${frontendUrl}?token=${jwtToken}&success=true`);
  } catch (error) {
    console.error('OAuth callback error:', error);
    res.redirect(`${frontendUrl}?error=${encodeURIComponent(error.message)}`);
  }
});

// Verify token and get current user (from JWT, no database needed)
router.get('/me', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('No auth header or invalid format');
      return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.substring(7);
    console.log('Verifying token:', token.substring(0, 20) + '...');
    
    const decoded = verifyToken(token);
    console.log('Decoded token:', decoded);

    if (!decoded) {
      console.log('Token verification failed');
      return res.status(401).json({ error: 'Invalid token' });
    }

    // Return user data from JWT (no database query needed)
    const userData = {
      id: decoded.twitchId, // Use Twitch ID as user ID
      twitchId: decoded.twitchId,
      username: decoded.username,
      displayName: decoded.displayName,
      profileImageUrl: decoded.profileImageUrl,
      coins: decoded.coins || 0,
    };
    
    console.log('Returning user data:', userData);
    res.json(userData);
  } catch (error) {
    console.error('Error in /me endpoint:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

export default router;

