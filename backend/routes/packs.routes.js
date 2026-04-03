import express from 'express';
import { pool } from '../config/database.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

const VALID_RARITIES = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'ultra-legendary'];
const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/;

function validatePack(data) {
  const errors = [];
  if (!data.name || data.name.trim().length === 0) errors.push('Name is required');
  if (data.name && data.name.length > 128) errors.push('Name too long');
  if (data.price != null && (data.price < 1 || !Number.isInteger(data.price))) errors.push('Price must be a positive integer');
  if (data.cards_per_open != null && (data.cards_per_open < 1 || data.cards_per_open > 10)) errors.push('Cards per open must be 1-10');
  if (data.rarity && !VALID_RARITIES.includes(data.rarity)) errors.push('Invalid rarity');
  for (const field of ['color_primary', 'color_accent', 'color_text', 'color_background']) {
    if (data[field] && !HEX_COLOR_RE.test(data[field])) errors.push(`${field} must be a valid hex color`);
  }
  // Validate rarity_weights: values must be positive numbers
  if (data.rarity_weights) {
    const weights = typeof data.rarity_weights === 'string' ? JSON.parse(data.rarity_weights) : data.rarity_weights;
    for (const [r, w] of Object.entries(weights)) {
      if (!VALID_RARITIES.includes(r)) errors.push(`Invalid rarity in weights: ${r}`);
      if (typeof w !== 'number' || w < 0) errors.push(`Weight for ${r} must be a positive number`);
    }
  }
  return errors;
}

// GET /api/packs — list my packs (with card count)
router.get('/', authenticate, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT bp.*,
        (SELECT COUNT(*) FROM card_templates ct WHERE ct.booster_pack_id = bp.id) AS total_cards
       FROM booster_packs bp
       WHERE bp.creator_id = $1
       ORDER BY bp.created_at DESC`,
      [req.user.twitchId]
    );
    res.json({ packs: result.rows });
  } catch (error) {
    console.error('Error fetching packs:', error);
    res.status(500).json({ error: 'Failed to fetch packs' });
  }
});

// GET /api/packs/:id — get single pack with its cards
router.get('/:id', authenticate, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM booster_packs WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Pack not found' });
    if (result.rows[0].creator_id !== req.user.twitchId) return res.status(403).json({ error: 'Not authorized' });

    const cards = await pool.query(
      'SELECT * FROM card_templates WHERE booster_pack_id = $1 ORDER BY rarity, name',
      [req.params.id]
    );

    res.json({ pack: result.rows[0], cards: cards.rows });
  } catch (error) {
    console.error('Error fetching pack:', error);
    res.status(500).json({ error: 'Failed to fetch pack' });
  }
});

// POST /api/packs — create pack
router.post('/', authenticate, async (req, res) => {
  try {
    const data = req.body;
    const errors = validatePack(data);
    if (errors.length > 0) return res.status(400).json({ error: errors.join(', ') });

    const defaultWeights = { common: 50, uncommon: 30, rare: 15, epic: 4, legendary: 1 };

    const result = await pool.query(
      `INSERT INTO booster_packs
        (creator_id, name, subtitle, description, image_url, price, cards_per_open, rarity, rarity_weights,
         color_primary, color_accent, color_text, color_background, is_published)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
       RETURNING *`,
      [
        req.user.twitchId,
        data.name.trim(),
        data.subtitle || null,
        data.description || null,
        data.image_url || null,
        data.price || 100,
        data.cards_per_open || 5,
        data.rarity || 'common',
        JSON.stringify(data.rarity_weights || defaultWeights),
        data.color_primary || '#8a8a8a',
        data.color_accent || '#d0d0d0',
        data.color_text || '#ffffff',
        data.color_background || '#1a1a2e',
        data.is_published || false,
      ]
    );

    res.status(201).json({ pack: result.rows[0] });
  } catch (error) {
    console.error('Error creating pack:', error);
    res.status(500).json({ error: 'Failed to create pack' });
  }
});

// PUT /api/packs/:id — update pack
router.put('/:id', authenticate, async (req, res) => {
  try {
    const existing = await pool.query('SELECT * FROM booster_packs WHERE id = $1', [req.params.id]);
    if (existing.rows.length === 0) return res.status(404).json({ error: 'Pack not found' });
    if (existing.rows[0].creator_id !== req.user.twitchId) return res.status(403).json({ error: 'Not authorized' });

    const data = req.body;
    const merged = { ...existing.rows[0], ...data };
    const errors = validatePack(merged);
    if (errors.length > 0) return res.status(400).json({ error: errors.join(', ') });

    const result = await pool.query(
      `UPDATE booster_packs SET
        name = $1, subtitle = $2, description = $3, image_url = $4,
        price = $5, cards_per_open = $6, rarity = $7, rarity_weights = $8,
        color_primary = $9, color_accent = $10, color_text = $11, color_background = $12,
        is_published = $13
       WHERE id = $14
       RETURNING *`,
      [
        (data.name || existing.rows[0].name).trim(),
        data.subtitle !== undefined ? data.subtitle : existing.rows[0].subtitle,
        data.description !== undefined ? data.description : existing.rows[0].description,
        data.image_url !== undefined ? data.image_url : existing.rows[0].image_url,
        data.price || existing.rows[0].price,
        data.cards_per_open || existing.rows[0].cards_per_open,
        data.rarity || existing.rows[0].rarity,
        JSON.stringify(data.rarity_weights || existing.rows[0].rarity_weights),
        data.color_primary || existing.rows[0].color_primary,
        data.color_accent || existing.rows[0].color_accent,
        data.color_text || existing.rows[0].color_text,
        data.color_background || existing.rows[0].color_background,
        data.is_published !== undefined ? data.is_published : existing.rows[0].is_published,
        req.params.id,
      ]
    );

    res.json({ pack: result.rows[0] });
  } catch (error) {
    console.error('Error updating pack:', error);
    res.status(500).json({ error: 'Failed to update pack' });
  }
});

// DELETE /api/packs/:id
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const existing = await pool.query('SELECT * FROM booster_packs WHERE id = $1', [req.params.id]);
    if (existing.rows.length === 0) return res.status(404).json({ error: 'Pack not found' });
    if (existing.rows[0].creator_id !== req.user.twitchId) return res.status(403).json({ error: 'Not authorized' });

    await pool.query('DELETE FROM booster_packs WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting pack:', error);
    res.status(500).json({ error: 'Failed to delete pack' });
  }
});

// ============================================================
// CARD MANAGEMENT (within a booster pack)
// ============================================================

const VALID_EFFECTS = ['none', 'holographic', 'shining', 'shadow'];

function validateCard(data) {
  const errors = [];
  if (!data.name || data.name.trim().length === 0) errors.push('Card name is required');
  if (data.name && data.name.length > 128) errors.push('Card name too long');
  if (data.rarity && !VALID_RARITIES.includes(data.rarity)) errors.push('Invalid rarity');
  if (data.effect && !VALID_EFFECTS.includes(data.effect)) errors.push('Invalid effect');
  if (data.effect_intensity != null && (data.effect_intensity < 0 || data.effect_intensity > 100)) errors.push('Effect intensity must be 0-100');
  for (const field of ['outline_color', 'background_color', 'text_color', 'effect_color']) {
    if (data[field] && !HEX_COLOR_RE.test(data[field])) errors.push(`${field} must be a valid hex color`);
  }
  return errors;
}

// GET /api/packs/:packId/cards — list all cards in a booster
router.get('/:packId/cards', authenticate, async (req, res) => {
  try {
    // Verify pack ownership
    const pack = await pool.query('SELECT creator_id FROM booster_packs WHERE id = $1', [req.params.packId]);
    if (pack.rows.length === 0) return res.status(404).json({ error: 'Pack not found' });
    if (pack.rows[0].creator_id !== req.user.twitchId) return res.status(403).json({ error: 'Not authorized' });

    const result = await pool.query(
      'SELECT * FROM card_templates WHERE booster_pack_id = $1 ORDER BY rarity, name',
      [req.params.packId]
    );
    res.json({ cards: result.rows });
  } catch (error) {
    console.error('Error fetching cards:', error);
    res.status(500).json({ error: 'Failed to fetch cards' });
  }
});

// POST /api/packs/:packId/cards — add a card to a booster (max 30)
router.post('/:packId/cards', authenticate, async (req, res) => {
  try {
    const pack = await pool.query('SELECT * FROM booster_packs WHERE id = $1', [req.params.packId]);
    if (pack.rows.length === 0) return res.status(404).json({ error: 'Pack not found' });
    if (pack.rows[0].creator_id !== req.user.twitchId) return res.status(403).json({ error: 'Not authorized' });

    // Check card limit
    const countResult = await pool.query(
      'SELECT COUNT(*) FROM card_templates WHERE booster_pack_id = $1',
      [req.params.packId]
    );
    if (parseInt(countResult.rows[0].count) >= 30) {
      return res.status(400).json({ error: 'Maximum 30 cards per booster pack' });
    }

    const data = req.body;
    const errors = validateCard(data);
    if (errors.length > 0) return res.status(400).json({ error: errors.join(', ') });

    const result = await pool.query(
      `INSERT INTO card_templates
        (booster_pack_id, creator_id, name, description, image_url, rarity,
         outline_color, background_color, text_color, effect, effect_color, effect_intensity)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING *`,
      [
        req.params.packId,
        req.user.twitchId,
        data.name.trim(),
        data.description || null,
        data.image_url || null,
        data.rarity || 'common',
        data.outline_color || null,
        data.background_color || '#1a1a2e',
        data.text_color || '#ffffff',
        data.effect || 'none',
        data.effect_color || '#ffffff',
        data.effect_intensity ?? 50,
      ]
    );

    res.status(201).json({ card: result.rows[0] });
  } catch (error) {
    console.error('Error creating card:', error);
    res.status(500).json({ error: 'Failed to create card' });
  }
});

// PUT /api/packs/:packId/cards/:cardId — update a card
router.put('/:packId/cards/:cardId', authenticate, async (req, res) => {
  try {
    const existing = await pool.query(
      'SELECT ct.*, bp.creator_id AS pack_creator FROM card_templates ct JOIN booster_packs bp ON ct.booster_pack_id = bp.id WHERE ct.id = $1 AND ct.booster_pack_id = $2',
      [req.params.cardId, req.params.packId]
    );
    if (existing.rows.length === 0) return res.status(404).json({ error: 'Card not found' });
    if (existing.rows[0].pack_creator !== req.user.twitchId) return res.status(403).json({ error: 'Not authorized' });

    const data = req.body;
    const merged = { ...existing.rows[0], ...data };
    const errors = validateCard(merged);
    if (errors.length > 0) return res.status(400).json({ error: errors.join(', ') });

    const result = await pool.query(
      `UPDATE card_templates SET
        name = $1, description = $2, image_url = $3, rarity = $4,
        outline_color = $5, background_color = $6, text_color = $7,
        effect = $8, effect_color = $9, effect_intensity = $10, is_active = $11
       WHERE id = $12
       RETURNING *`,
      [
        (data.name || existing.rows[0].name).trim(),
        data.description !== undefined ? data.description : existing.rows[0].description,
        data.image_url !== undefined ? data.image_url : existing.rows[0].image_url,
        data.rarity || existing.rows[0].rarity,
        data.outline_color !== undefined ? data.outline_color : existing.rows[0].outline_color,
        data.background_color || existing.rows[0].background_color,
        data.text_color || existing.rows[0].text_color,
        data.effect || existing.rows[0].effect,
        data.effect_color || existing.rows[0].effect_color,
        data.effect_intensity ?? existing.rows[0].effect_intensity,
        data.is_active !== undefined ? data.is_active : existing.rows[0].is_active,
        req.params.cardId,
      ]
    );

    res.json({ card: result.rows[0] });
  } catch (error) {
    console.error('Error updating card:', error);
    res.status(500).json({ error: 'Failed to update card' });
  }
});

// DELETE /api/packs/:packId/cards/:cardId
router.delete('/:packId/cards/:cardId', authenticate, async (req, res) => {
  try {
    const existing = await pool.query(
      'SELECT ct.*, bp.creator_id AS pack_creator FROM card_templates ct JOIN booster_packs bp ON ct.booster_pack_id = bp.id WHERE ct.id = $1 AND ct.booster_pack_id = $2',
      [req.params.cardId, req.params.packId]
    );
    if (existing.rows.length === 0) return res.status(404).json({ error: 'Card not found' });
    if (existing.rows[0].pack_creator !== req.user.twitchId) return res.status(403).json({ error: 'Not authorized' });

    await pool.query('DELETE FROM card_templates WHERE id = $1', [req.params.cardId]);
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting card:', error);
    res.status(500).json({ error: 'Failed to delete card' });
  }
});

export default router;
