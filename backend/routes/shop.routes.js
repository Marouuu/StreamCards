import express from 'express';
import { generateToken } from '../utils/jwt.js';
import { pool } from '../config/database.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

// Fallback mock packs if DB has no published packs
const FALLBACK_PACKS = [
  { id: 1, name: 'Booster Commun', description: 'Un booster standard avec des cartes communes', price: 100, cards_per_open: 5, rarity: 'common', rarity_weights: { common: 50, uncommon: 30, rare: 15, epic: 4, legendary: 1 }, image_url: null, color_primary: '#8a8a8a', color_accent: '#d0d0d0', color_text: '#ffffff', subtitle: null },
  { id: 2, name: 'Booster Rare', description: 'Un booster premium avec une chance de cartes rares', price: 300, cards_per_open: 5, rarity: 'rare', rarity_weights: { common: 30, uncommon: 35, rare: 25, epic: 8, legendary: 2 }, image_url: null, color_primary: '#0a3d6b', color_accent: '#0096ff', color_text: '#ffffff', subtitle: null },
  { id: 3, name: 'Booster Épique', description: 'Un booster exceptionnel avec des cartes épiques', price: 500, cards_per_open: 5, rarity: 'epic', rarity_weights: { common: 15, uncommon: 25, rare: 30, epic: 22, legendary: 8 }, image_url: null, color_primary: '#3d0a6b', color_accent: '#9600ff', color_text: '#ffffff', subtitle: null },
  { id: 4, name: 'Booster Légendaire', description: 'Le booster ultime !', price: 1000, cards_per_open: 5, rarity: 'legendary', rarity_weights: { common: 5, uncommon: 15, rare: 30, epic: 30, legendary: 20 }, image_url: null, color_primary: '#6b4a00', color_accent: '#ffd700', color_text: '#ffffff', subtitle: null },
  { id: 5, name: 'Booster Ultra Légendaire', description: 'Le booster mythique !', price: 2000, cards_per_open: 5, rarity: 'ultra-legendary', rarity_weights: { uncommon: 10, rare: 20, epic: 30, legendary: 30, 'ultra-legendary': 10 }, image_url: null, color_primary: '#ff0040', color_accent: '#ff00ff', color_text: '#ffffff', subtitle: null },
];

/**
 * Draw cards from a booster using weighted rarity probabilities.
 *
 * For each draw:
 *  1. Roll a random number against rarity_weights to pick a rarity tier
 *  2. Pick a random active card of that rarity from the booster's pool
 *  3. If no card of that rarity exists, fall back to nearest available rarity
 *
 * Returns array of { cardId, rarity, isMock } objects.
 */
async function drawCards(boosterId, rarityWeights, count) {
  const weights = typeof rarityWeights === 'string' ? JSON.parse(rarityWeights) : rarityWeights;

  // Build cumulative probability table
  const entries = Object.entries(weights).filter(([, w]) => w > 0);
  const totalWeight = entries.reduce((sum, [, w]) => sum + w, 0);

  // Preload all cards for this booster grouped by rarity
  let cardsByRarity = {};
  try {
    const result = await pool.query(
      `SELECT id, rarity FROM card_templates WHERE booster_pack_id = $1 AND is_active = true AND approval_status = 'approved'`,
      [boosterId]
    );
    for (const row of result.rows) {
      if (!cardsByRarity[row.rarity]) cardsByRarity[row.rarity] = [];
      cardsByRarity[row.rarity].push(row.id);
    }
  } catch {
    // DB unavailable
  }

  // Available rarities that actually have cards in the pool
  const availableRarities = Object.keys(cardsByRarity);

  // Rarity fallback order (closest match)
  const rarityOrder = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'ultra-legendary'];

  function findFallbackRarity(target) {
    const targetIdx = rarityOrder.indexOf(target);
    // Search outward from target
    for (let dist = 1; dist < rarityOrder.length; dist++) {
      if (targetIdx - dist >= 0 && availableRarities.includes(rarityOrder[targetIdx - dist])) {
        return rarityOrder[targetIdx - dist];
      }
      if (targetIdx + dist < rarityOrder.length && availableRarities.includes(rarityOrder[targetIdx + dist])) {
        return rarityOrder[targetIdx + dist];
      }
    }
    return null;
  }

  const drawn = [];

  for (let i = 0; i < count; i++) {
    // Step 1: Roll rarity
    const roll = Math.random() * totalWeight;
    let cumulative = 0;
    let rolledRarity = entries[entries.length - 1][0]; // default to last

    for (const [rarity, weight] of entries) {
      cumulative += weight;
      if (roll < cumulative) {
        rolledRarity = rarity;
        break;
      }
    }

    // Step 2: Pick a card of that rarity, or fallback
    let selectedRarity = rolledRarity;
    if (!cardsByRarity[selectedRarity] || cardsByRarity[selectedRarity].length === 0) {
      const fallback = findFallbackRarity(selectedRarity);
      if (fallback) {
        selectedRarity = fallback;
      } else {
        // No cards in pool at all — return mock
        drawn.push({ cardId: `mock-${rolledRarity}-${i + 1}`, rarity: rolledRarity, isMock: true });
        continue;
      }
    }

    const pool2 = cardsByRarity[selectedRarity];
    const cardId = pool2[Math.floor(Math.random() * pool2.length)];
    drawn.push({ cardId, rarity: selectedRarity, isMock: false });
  }

  return drawn;
}

// Get all available booster packs (published)
router.get('/boosters', authenticate, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT bp.*,
        u.username AS creator_name,
        u.display_name AS creator_display_name,
        u.profile_image_url AS creator_image,
        (SELECT COUNT(*) FROM card_templates ct WHERE ct.booster_pack_id = bp.id AND ct.is_active = true) AS total_cards
       FROM booster_packs bp
       JOIN users u ON bp.creator_id = u.twitch_id
       WHERE bp.is_published = true AND bp.approval_status = 'approved'
       ORDER BY bp.price ASC`
    );
    const packs = result.rows.length > 0 ? result.rows : FALLBACK_PACKS;
    res.json({ boosters: packs });
  } catch {
    res.json({ boosters: FALLBACK_PACKS });
  }
});

// Purchase and open booster pack
router.post('/boosters/:boosterId/purchase', authenticate, async (req, res) => {
  try {
    const { boosterId } = req.params;
    const twitchId = req.user.twitchId;

    // Find booster
    let booster;
    try {
      const result = await pool.query('SELECT * FROM booster_packs WHERE id = $1', [boosterId]);
      if (result.rows.length > 0) booster = result.rows[0];
    } catch { /* DB unavailable */ }
    if (!booster) {
      booster = FALLBACK_PACKS.find(b => b.id === parseInt(boosterId));
    }
    if (!booster) {
      return res.status(404).json({ error: 'Booster not found' });
    }

    // Get coins from DB
    let userCoins;
    try {
      const userResult = await pool.query('SELECT coins FROM users WHERE twitch_id = $1', [twitchId]);
      userCoins = userResult.rows.length > 0 ? userResult.rows[0].coins : (req.user.coins || 0);
    } catch {
      userCoins = req.user.coins || 0;
    }

    if (userCoins < booster.price) {
      return res.status(400).json({ error: 'Insufficient coins' });
    }

    // Draw cards using weighted probability
    const cardsPerOpen = booster.cards_per_open || 5;
    const drawnCards = await drawCards(booster.id, booster.rarity_weights, cardsPerOpen);

    const newCoins = userCoins - booster.price;

    // Persist everything in a transaction
    let openingId = null;
    try {
      await pool.query('BEGIN');

      await pool.query('UPDATE users SET coins = $1 WHERE twitch_id = $2', [newCoins, twitchId]);

      const openResult = await pool.query(
        'INSERT INTO booster_openings (user_id, booster_pack_id, coins_spent) VALUES ($1, $2, $3) RETURNING id',
        [twitchId, booster.id, booster.price]
      );
      openingId = openResult.rows[0].id;

      // Save drawn cards to collection
      for (const card of drawnCards) {
        if (!card.isMock) {
          await pool.query(
            'INSERT INTO user_cards (user_id, card_template_id, booster_opening_id) VALUES ($1, $2, $3)',
            [twitchId, card.cardId, openingId]
          );
        }
      }

      await pool.query(
        `INSERT INTO transactions (user_id, type, amount, balance_after, description, reference_type, reference_id)
         VALUES ($1, 'purchase', $2, $3, $4, 'booster_opening', $5)`,
        [twitchId, -booster.price, newCoins, `Achat: ${booster.name}`, openingId]
      );

      await pool.query('COMMIT');
    } catch (dbErr) {
      try { await pool.query('ROLLBACK'); } catch { /* ignore */ }
      console.warn('DB transaction failed:', dbErr.message);
    }

    // New JWT
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

    // Enrich drawn cards with full info if possible
    let enrichedCards = drawnCards.map(c => ({ id: c.cardId, rarity: c.rarity, isMock: c.isMock, isNew: true }));
    try {
      const realIds = drawnCards.filter(c => !c.isMock).map(c => c.cardId);
      if (realIds.length > 0) {
        // Get card details
        const cardDetails = await pool.query(
          `SELECT ct.*, u.username AS creator_name, u.display_name AS creator_display_name
           FROM card_templates ct
           JOIN users u ON ct.creator_id = u.twitch_id
           WHERE ct.id = ANY($1)`,
          [realIds]
        );
        const detailMap = new Map(cardDetails.rows.map(r => [r.id, r]));

        // Check which cards the user already had before this opening
        let existingTemplateIds = new Set();
        if (openingId) {
          const existing = await pool.query(
            'SELECT DISTINCT card_template_id FROM user_cards WHERE user_id = $1 AND booster_opening_id != $2',
            [twitchId, openingId]
          );
          existingTemplateIds = new Set(existing.rows.map(r => r.card_template_id));
        }

        enrichedCards = drawnCards.map(c => {
          if (!c.isMock && detailMap.has(c.cardId)) {
            return { ...detailMap.get(c.cardId), isMock: false, isNew: !existingTemplateIds.has(c.cardId) };
          }
          return { id: c.cardId, rarity: c.rarity, isMock: c.isMock, isNew: true };
        });
      }
    } catch { /* ignore */ }

    res.json({
      success: true,
      cards: enrichedCards,
      newCoins,
      newToken,
      message: `Vous avez obtenu ${drawnCards.length} carte(s) !`,
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
