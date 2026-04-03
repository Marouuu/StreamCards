import express from 'express';
import { generateToken } from '../utils/jwt.js';
import { pool } from '../config/database.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

// Fallback mock data if DB has no published packs
const FALLBACK_PACKS = [
  { id: 1, name: 'Booster Commun', description: 'Un booster standard avec des cartes communes', price: 100, cards_count: 5, rarity: 'common', rarity_distribution: { common: 4, uncommon: 1 }, image_url: null, color_primary: '#8a8a8a', color_accent: '#d0d0d0', color_text: '#ffffff', subtitle: null },
  { id: 2, name: 'Booster Rare', description: 'Un booster premium avec une chance de cartes rares', price: 300, cards_count: 5, rarity: 'rare', rarity_distribution: { common: 2, uncommon: 2, rare: 1 }, image_url: null, color_primary: '#0a3d6b', color_accent: '#0096ff', color_text: '#ffffff', subtitle: null },
  { id: 3, name: 'Booster Épique', description: 'Un booster exceptionnel avec des cartes épiques', price: 500, cards_count: 5, rarity: 'epic', rarity_distribution: { uncommon: 2, rare: 2, epic: 1 }, image_url: null, color_primary: '#3d0a6b', color_accent: '#9600ff', color_text: '#ffffff', subtitle: null },
  { id: 4, name: 'Booster Légendaire', description: 'Le booster ultime avec une chance de carte légendaire !', price: 1000, cards_count: 5, rarity: 'legendary', rarity_distribution: { rare: 2, epic: 2, legendary: 1 }, image_url: null, color_primary: '#6b4a00', color_accent: '#ffd700', color_text: '#ffffff', subtitle: null },
  { id: 5, name: 'Booster Ultra Légendaire', description: 'Le booster mythique ! Une chance unique !', price: 2000, cards_count: 5, rarity: 'ultra-legendary', rarity_distribution: { epic: 2, legendary: 2, 'ultra-legendary': 1 }, image_url: null, color_primary: '#ff0040', color_accent: '#ff00ff', color_text: '#ffffff', subtitle: null },
];

// Get all available booster packs (published from DB, or fallback)
router.get('/boosters', authenticate, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM booster_packs WHERE is_published = true ORDER BY price ASC'
    );
    const packs = result.rows.length > 0 ? result.rows : FALLBACK_PACKS;
    res.json({ boosters: packs });
  } catch (error) {
    // DB unavailable, use fallback
    console.warn('DB error, using fallback packs:', error.message);
    res.json({ boosters: FALLBACK_PACKS });
  }
});

// Purchase booster pack
router.post('/boosters/:boosterId/purchase', authenticate, async (req, res) => {
  try {
    const { boosterId } = req.params;

    // Try DB first, then fallback
    let booster;
    try {
      const result = await pool.query('SELECT * FROM booster_packs WHERE id = $1', [boosterId]);
      if (result.rows.length > 0) booster = result.rows[0];
    } catch (e) {
      // DB unavailable
    }
    if (!booster) {
      booster = FALLBACK_PACKS.find(b => b.id === parseInt(boosterId));
    }

    if (!booster) {
      return res.status(404).json({ error: 'Booster not found' });
    }

    const userCoins = req.user.coins || 0;
    if (userCoins < booster.price) {
      return res.status(400).json({ error: 'Insufficient coins' });
    }

    // Generate random cards based on rarity distribution
    const distribution = typeof booster.rarity_distribution === 'string'
      ? JSON.parse(booster.rarity_distribution)
      : booster.rarity_distribution;

    const cards = [];
    for (const [rarity, count] of Object.entries(distribution)) {
      for (let i = 0; i < count; i++) {
        try {
          const result = await pool.query(
            'SELECT id FROM card_templates WHERE rarity = $1 ORDER BY RANDOM() LIMIT 1',
            [rarity]
          );
          cards.push(result.rows.length > 0 ? result.rows[0].id : `mock-${rarity}-${i + 1}`);
        } catch {
          cards.push(`mock-${rarity}-${i + 1}`);
        }
      }
    }

    const newCoins = userCoins - booster.price;
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

    res.json({
      success: true,
      cards,
      newCoins,
      newToken,
      message: `Vous avez obtenu ${cards.length} carte(s) !`,
    });
  } catch (error) {
    console.error('Error purchasing booster:', error);
    res.status(500).json({ error: 'Failed to purchase booster' });
  }
});

router.post('/boosters/:boosterId/open', authenticate, async (req, res) => {
  res.json({ message: 'Open booster - use purchase endpoint' });
});

export default router;
