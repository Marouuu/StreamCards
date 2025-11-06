import express from 'express';
import { verifyToken, generateToken } from '../utils/jwt.js';
import { pool } from '../config/database.js';

const router = express.Router();

// Mock booster packs data (in production, fetch from database)
const BOOSTER_PACKS = [
  {
    id: 1,
    name: 'Booster Commun',
    description: 'Un booster standard avec des cartes communes',
    price: 100,
    cards_count: 5,
    rarity: 'common',
    rarity_distribution: { common: 4, uncommon: 1 }
  },
  {
    id: 2,
    name: 'Booster Rare',
    description: 'Un booster premium avec une chance de cartes rares',
    price: 300,
    cards_count: 5,
    rarity: 'rare',
    rarity_distribution: { common: 2, uncommon: 2, rare: 1 }
  },
  {
    id: 3,
    name: 'Booster Épique',
    description: 'Un booster exceptionnel avec des cartes épiques',
    price: 500,
    cards_count: 5,
    rarity: 'epic',
    rarity_distribution: { uncommon: 2, rare: 2, epic: 1 }
  },
  {
    id: 4,
    name: 'Booster Légendaire',
    description: 'Le booster ultime avec une chance de carte légendaire !',
    price: 1000,
    cards_count: 5,
    rarity: 'legendary',
    rarity_distribution: { rare: 2, epic: 2, legendary: 1 }
  },
  {
    id: 5,
    name: 'Booster Ultra Légendaire',
    description: 'Le booster mythique avec un fond arc-en-ciel ! Une chance unique !',
    price: 2000,
    cards_count: 5,
    rarity: 'ultra-legendary',
    rarity_distribution: { epic: 2, legendary: 2, 'ultra-legendary': 1 }
  },
];

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

// Get all booster packs
router.get('/boosters', authenticate, (req, res) => {
  try {
    res.json({ boosters: BOOSTER_PACKS });
  } catch (error) {
    console.error('Error fetching boosters:', error);
    res.status(500).json({ error: 'Failed to fetch boosters' });
  }
});

// Purchase booster pack
router.post('/boosters/:boosterId/purchase', authenticate, async (req, res) => {
  try {
    const { boosterId } = req.params;
    const booster = BOOSTER_PACKS.find(b => b.id === parseInt(boosterId));

    console.log(`Purchase request for booster ${boosterId}`);

    if (!booster) {
      console.error(`Booster ${boosterId} not found`);
      return res.status(404).json({ error: 'Booster not found' });
    }

    const userCoins = req.user.coins || 0;
    console.log(`User coins: ${userCoins}, Booster price: ${booster.price}`);

    if (userCoins < booster.price) {
      console.error(`Insufficient coins: ${userCoins} < ${booster.price}`);
      return res.status(400).json({ error: 'Insufficient coins' });
    }

    // Generate random cards based on rarity distribution
    const cards = [];
    
    try {
      // Try to get cards from database
      for (const [rarity, count] of Object.entries(booster.rarity_distribution)) {
        for (let i = 0; i < count; i++) {
          try {
            // Get random card template of this rarity from database
            const result = await pool.query(
              `SELECT id FROM card_templates WHERE rarity = $1 ORDER BY RANDOM() LIMIT 1`,
              [rarity]
            );

            if (result.rows.length > 0) {
              cards.push(result.rows[0].id);
            } else {
              // No card of this rarity in DB, use mock ID
              cards.push(`mock-${rarity}-${i + 1}`);
            }
          } catch (dbError) {
            console.warn(`Error fetching card for rarity ${rarity}:`, dbError.message);
            // Use mock card ID if DB query fails
            cards.push(`mock-${rarity}-${i + 1}`);
          }
        }
      }
    } catch (error) {
      console.warn('Database error, using mock cards:', error.message);
      // If database is not available, use mock cards
      for (let i = 0; i < booster.cards_count; i++) {
        cards.push(`mock-card-${i + 1}`);
      }
    }

    // Ensure we have the right number of cards
    if (cards.length < booster.cards_count) {
      const missing = booster.cards_count - cards.length;
      for (let i = 0; i < missing; i++) {
        cards.push(`mock-card-${cards.length + 1}`);
      }
    }

    // Calculate new coins
    const newCoins = userCoins - booster.price;

    // Create new token with updated coins
    const newToken = generateToken(
      {
        id: req.user.twitchId,
        login: req.user.username,
        display_name: req.user.displayName,
        profile_image_url: req.user.profileImageUrl
      },
      req.user.twitchAccessToken,
      newCoins
    );

    // Store transaction and cards in database if user exists in DB
    // For now, we'll just return the cards
    console.log(`Purchase successful: ${cards.length} cards generated, new coins: ${newCoins}`);
    res.json({
      success: true,
      cards: cards,
      newCoins: newCoins,
      newToken: newToken, // Return new token with updated coins
      message: `Vous avez obtenu ${cards.length} carte(s) !`
    });
  } catch (error) {
    console.error('Error purchasing booster:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({ 
      error: 'Failed to purchase booster',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Open booster pack (if we want to separate purchase from opening)
router.post('/boosters/:boosterId/open', authenticate, async (req, res) => {
  // For now, purchase and open are the same
  // This endpoint can be used for opening already purchased boosters
  res.json({ message: 'Open booster - use purchase endpoint' });
});

export default router;

