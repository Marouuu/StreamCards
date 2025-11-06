import express from 'express';

const router = express.Router();

// Twitch OAuth routes (to be implemented)
router.get('/twitch', (req, res) => {
  // TODO: Implement Twitch OAuth flow
  res.json({ message: 'Twitch OAuth endpoint - to be implemented' });
});

router.get('/twitch/callback', (req, res) => {
  // TODO: Handle Twitch OAuth callback
  res.json({ message: 'Twitch OAuth callback - to be implemented' });
});

export default router;

