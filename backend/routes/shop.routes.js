import express from 'express';

const router = express.Router();

// Get all booster packs
router.get('/boosters', (req, res) => {
  // TODO: Implement
  res.json({ message: 'Get booster packs - to be implemented' });
});

// Purchase booster pack
router.post('/boosters/:boosterId/purchase', (req, res) => {
  // TODO: Implement
  res.json({ message: 'Purchase booster - to be implemented' });
});

// Open booster pack
router.post('/boosters/:boosterId/open', (req, res) => {
  // TODO: Implement
  res.json({ message: 'Open booster - to be implemented' });
});

export default router;

