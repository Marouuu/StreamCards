import express from 'express';
import { pool } from '../config/database.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

// Ensure booster_packs table exists
async function ensureTable() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS booster_packs (
        id SERIAL PRIMARY KEY,
        creator_id VARCHAR(64) NOT NULL,
        creator_name VARCHAR(128),
        name VARCHAR(128) NOT NULL,
        subtitle VARCHAR(256),
        description TEXT,
        image_url TEXT,
        price INTEGER NOT NULL DEFAULT 100,
        cards_count INTEGER NOT NULL DEFAULT 5,
        rarity VARCHAR(32) NOT NULL DEFAULT 'common',
        rarity_distribution JSONB NOT NULL DEFAULT '{"common":5}',
        color_primary VARCHAR(9) DEFAULT '#8a8a8a',
        color_accent VARCHAR(9) DEFAULT '#d0d0d0',
        color_text VARCHAR(9) DEFAULT '#ffffff',
        color_background VARCHAR(9) DEFAULT '#1a1a2e',
        is_published BOOLEAN NOT NULL DEFAULT false,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_booster_packs_creator ON booster_packs(creator_id);
      CREATE INDEX IF NOT EXISTS idx_booster_packs_published ON booster_packs(is_published);
    `);
  } catch (err) {
    console.error('Error ensuring booster_packs table:', err.message);
  }
}
ensureTable();

const VALID_RARITIES = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'ultra-legendary'];
const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/;

function validatePack(data) {
  const errors = [];
  if (!data.name || data.name.trim().length === 0) errors.push('Name is required');
  if (data.name && data.name.length > 128) errors.push('Name too long');
  if (data.price != null && (data.price < 1 || !Number.isInteger(data.price))) errors.push('Price must be a positive integer');
  if (data.cards_count != null && (data.cards_count < 1 || data.cards_count > 20)) errors.push('Cards count must be 1-20');
  if (data.rarity && !VALID_RARITIES.includes(data.rarity)) errors.push('Invalid rarity');
  for (const field of ['color_primary', 'color_accent', 'color_text', 'color_background']) {
    if (data[field] && !HEX_COLOR_RE.test(data[field])) errors.push(`${field} must be a valid hex color`);
  }
  return errors;
}

// GET /api/packs — list my packs
router.get('/', authenticate, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM booster_packs WHERE creator_id = $1 ORDER BY created_at DESC',
      [req.user.twitchId]
    );
    res.json({ packs: result.rows });
  } catch (error) {
    console.error('Error fetching packs:', error);
    res.status(500).json({ error: 'Failed to fetch packs' });
  }
});

// GET /api/packs/:id — get single pack (must be owner)
router.get('/:id', authenticate, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM booster_packs WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Pack not found' });
    if (result.rows[0].creator_id !== req.user.twitchId) return res.status(403).json({ error: 'Not authorized' });
    res.json({ pack: result.rows[0] });
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

    const result = await pool.query(
      `INSERT INTO booster_packs
        (creator_id, creator_name, name, subtitle, description, image_url, price, cards_count, rarity, rarity_distribution, color_primary, color_accent, color_text, color_background, is_published)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
       RETURNING *`,
      [
        req.user.twitchId,
        req.user.displayName || req.user.username,
        data.name.trim(),
        data.subtitle || null,
        data.description || null,
        data.image_url || null,
        data.price || 100,
        data.cards_count || 5,
        data.rarity || 'common',
        JSON.stringify(data.rarity_distribution || { common: 5 }),
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

// PUT /api/packs/:id — update pack (must be owner)
router.put('/:id', authenticate, async (req, res) => {
  try {
    const existing = await pool.query('SELECT * FROM booster_packs WHERE id = $1', [req.params.id]);
    if (existing.rows.length === 0) return res.status(404).json({ error: 'Pack not found' });
    if (existing.rows[0].creator_id !== req.user.twitchId) return res.status(403).json({ error: 'Not authorized' });

    const data = req.body;
    const errors = validatePack({ ...existing.rows[0], ...data });
    if (errors.length > 0) return res.status(400).json({ error: errors.join(', ') });

    const result = await pool.query(
      `UPDATE booster_packs SET
        name = $1, subtitle = $2, description = $3, image_url = $4,
        price = $5, cards_count = $6, rarity = $7, rarity_distribution = $8,
        color_primary = $9, color_accent = $10, color_text = $11, color_background = $12,
        is_published = $13, updated_at = NOW()
       WHERE id = $14
       RETURNING *`,
      [
        (data.name || existing.rows[0].name).trim(),
        data.subtitle !== undefined ? data.subtitle : existing.rows[0].subtitle,
        data.description !== undefined ? data.description : existing.rows[0].description,
        data.image_url !== undefined ? data.image_url : existing.rows[0].image_url,
        data.price || existing.rows[0].price,
        data.cards_count || existing.rows[0].cards_count,
        data.rarity || existing.rows[0].rarity,
        JSON.stringify(data.rarity_distribution || existing.rows[0].rarity_distribution),
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

// DELETE /api/packs/:id — delete pack (must be owner)
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

export default router;
