import express from 'express';

const router = express.Router();

// Get all cards for a streamer
router.get('/streamer/:streamerId', (req, res) => {
  // TODO: Implement
  res.json({ message: 'Get streamer cards - to be implemented' });
});

// Get user's collection
router.get('/collection/:userId', (req, res) => {
  // TODO: Implement
  res.json({ message: 'Get user collection - to be implemented' });
});

// Create card template (streamer only)
router.post('/template', (req, res) => {
  // TODO: Implement
  res.json({ message: 'Create card template - to be implemented' });
});

export default router;

