import express from 'express';
import { pool } from '../config/database.js';
import { authenticate } from '../middleware/auth.js';
import { generateToken } from '../utils/jwt.js';
import { createNotification } from '../utils/notifications.js';
import { checkAchievements } from '../utils/achievements.js';

const router = express.Router();

// GET /api/marketplace — browse active listings
router.get('/', authenticate, async (req, res) => {
  try {
    const { rarity, streamer, sort, search, page = 1 } = req.query;
    const limit = 40;
    const offset = (Math.max(1, parseInt(page)) - 1) * limit;

    let where = `ml.status = 'active'`;
    const params = [];
    let paramIdx = 1;

    if (rarity && rarity !== 'all') {
      params.push(rarity);
      where += ` AND ct.rarity = $${paramIdx++}`;
    }
    if (streamer && streamer !== 'all') {
      params.push(streamer);
      where += ` AND ct.creator_id = $${paramIdx++}`;
    }
    if (search) {
      params.push(`%${search}%`);
      where += ` AND ct.name ILIKE $${paramIdx++}`;
    }

    let orderBy = 'ml.created_at DESC';
    if (sort === 'price_asc') orderBy = 'ml.price ASC';
    else if (sort === 'price_desc') orderBy = 'ml.price DESC';
    else if (sort === 'rarity') {
      orderBy = `CASE ct.rarity
        WHEN 'ultra-legendary' THEN 6
        WHEN 'legendary' THEN 5
        WHEN 'epic' THEN 4
        WHEN 'rare' THEN 3
        WHEN 'uncommon' THEN 2
        ELSE 1 END DESC, ml.created_at DESC`;
    }

    params.push(limit);
    const limitParam = `$${paramIdx++}`;
    params.push(offset);
    const offsetParam = `$${paramIdx++}`;

    const result = await pool.query(
      `SELECT ml.id, ml.price, ml.created_at, ml.seller_id,
        ct.id AS card_template_id, ct.name, ct.description, ct.image_url, ct.rarity,
        ct.outline_color, ct.background_color, ct.text_color,
        ct.effect, ct.effect_color, ct.effect_intensity,
        seller.username AS seller_name, seller.display_name AS seller_display_name,
        seller.profile_image_url AS seller_image,
        creator.username AS creator_name, creator.display_name AS creator_display_name,
        creator.profile_image_url AS creator_image,
        bp.name AS booster_pack_name
       FROM marketplace_listings ml
       JOIN user_cards uc ON ml.user_card_id = uc.id
       JOIN card_templates ct ON ml.card_template_id = ct.id
       JOIN users seller ON ml.seller_id = seller.twitch_id
       JOIN users creator ON ct.creator_id = creator.twitch_id
       LEFT JOIN booster_packs bp ON ct.booster_pack_id = bp.id
       WHERE ${where}
       ORDER BY ${orderBy}
       LIMIT ${limitParam} OFFSET ${offsetParam}`,
      params
    );

    // Total count for pagination
    const countResult = await pool.query(
      `SELECT COUNT(*) FROM marketplace_listings ml
       JOIN card_templates ct ON ml.card_template_id = ct.id
       WHERE ${where}`,
      params.slice(0, params.length - 2)
    );

    res.json({
      listings: result.rows,
      total: parseInt(countResult.rows[0].count),
      page: parseInt(page),
      totalPages: Math.ceil(parseInt(countResult.rows[0].count) / limit),
    });
  } catch (error) {
    console.error('Error fetching marketplace:', error);
    res.status(500).json({ error: 'Failed to fetch marketplace' });
  }
});

// GET /api/marketplace/my-listings — user's own listings
router.get('/my-listings', authenticate, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT ml.*, ct.name, ct.image_url, ct.rarity,
        ct.outline_color, ct.background_color, ct.text_color,
        ct.effect, ct.effect_color, ct.effect_intensity,
        creator.display_name AS creator_display_name,
        creator.profile_image_url AS creator_image,
        buyer.display_name AS buyer_display_name
       FROM marketplace_listings ml
       JOIN card_templates ct ON ml.card_template_id = ct.id
       JOIN users creator ON ct.creator_id = creator.twitch_id
       LEFT JOIN users buyer ON ml.buyer_id = buyer.twitch_id
       WHERE ml.seller_id = $1
       ORDER BY ml.created_at DESC`,
      [req.user.twitchId]
    );
    res.json({ listings: result.rows });
  } catch (error) {
    console.error('Error fetching my listings:', error);
    res.status(500).json({ error: 'Failed to fetch listings' });
  }
});

// POST /api/marketplace/list — put a card up for sale
router.post('/list', authenticate, async (req, res) => {
  try {
    const { userCardId, price } = req.body;
    const sellerId = req.user.twitchId;

    if (!userCardId || !Number.isInteger(price) || price < 1 || price > 999999999) {
      return res.status(400).json({ error: 'userCardId et price sont requis (price: entier entre 1 et 999,999,999)' });
    }

    // Verify the card belongs to the seller
    const cardResult = await pool.query(
      'SELECT id, card_template_id FROM user_cards WHERE id = $1 AND user_id = $2',
      [userCardId, sellerId]
    );
    if (cardResult.rows.length === 0) {
      return res.status(404).json({ error: 'Carte introuvable dans votre collection' });
    }

    // Check card is not already listed
    const existingListing = await pool.query(
      `SELECT id FROM marketplace_listings WHERE user_card_id = $1 AND status = 'active'`,
      [userCardId]
    );
    if (existingListing.rows.length > 0) {
      return res.status(400).json({ error: 'Cette carte est deja en vente' });
    }

    const templateId = cardResult.rows[0].card_template_id;

    const result = await pool.query(
      `INSERT INTO marketplace_listings (seller_id, user_card_id, card_template_id, price)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [sellerId, userCardId, templateId, price]
    );

    res.status(201).json({ listing: result.rows[0] });
  } catch (error) {
    console.error('Error creating listing:', error);
    res.status(500).json({ error: 'Failed to create listing' });
  }
});

// POST /api/marketplace/buy/:listingId — buy a listed card
router.post('/buy/:listingId', authenticate, async (req, res) => {
  try {
    const { listingId } = req.params;
    const buyerId = req.user.twitchId;

    // All checks inside transaction with row locks to prevent race conditions
    await pool.query('BEGIN');

    // Lock listing row
    const listingResult = await pool.query(
      `SELECT * FROM marketplace_listings WHERE id = $1 AND status = 'active' FOR UPDATE`,
      [listingId]
    );
    if (listingResult.rows.length === 0) {
      await pool.query('ROLLBACK');
      return res.status(404).json({ error: 'Annonce introuvable ou deja vendue' });
    }

    const listing = listingResult.rows[0];

    if (listing.seller_id === buyerId) {
      await pool.query('ROLLBACK');
      return res.status(400).json({ error: 'Vous ne pouvez pas acheter votre propre carte' });
    }

    // Lock buyer row to prevent double-spend
    const buyerResult = await pool.query('SELECT coins FROM users WHERE twitch_id = $1 FOR UPDATE', [buyerId]);
    if (buyerResult.rows.length === 0) {
      await pool.query('ROLLBACK');
      return res.status(404).json({ error: 'Utilisateur introuvable' });
    }
    const buyerCoins = buyerResult.rows[0].coins;

    if (buyerCoins < listing.price) {
      await pool.query('ROLLBACK');
      return res.status(400).json({ error: 'Pas assez de coins' });
    }

    // Deduct coins from buyer
    await pool.query('UPDATE users SET coins = coins - $1 WHERE twitch_id = $2', [listing.price, buyerId]);
    // Add coins to seller
    await pool.query('UPDATE users SET coins = coins + $1 WHERE twitch_id = $2', [listing.price, listing.seller_id]);

    // Transfer card ownership
    await pool.query('UPDATE user_cards SET user_id = $1 WHERE id = $2', [buyerId, listing.user_card_id]);

    // Update listing
    await pool.query(
      `UPDATE marketplace_listings SET status = 'sold', buyer_id = $1, sold_at = NOW() WHERE id = $2`,
      [buyerId, listingId]
    );

    // Get updated balances
    const newBuyerCoins = (await pool.query('SELECT coins FROM users WHERE twitch_id = $1', [buyerId])).rows[0].coins;
    const newSellerCoins = (await pool.query('SELECT coins FROM users WHERE twitch_id = $1', [listing.seller_id])).rows[0].coins;

    // Log transactions
    await pool.query(
      `INSERT INTO transactions (user_id, type, amount, balance_after, description, reference_type, reference_id)
       VALUES ($1, 'purchase', $2, $3, $4, 'marketplace_listing', $5)`,
      [buyerId, -listing.price, newBuyerCoins, `Achat marketplace: carte #${listing.card_template_id}`, listing.id]
    );
    await pool.query(
      `INSERT INTO transactions (user_id, type, amount, balance_after, description, reference_type, reference_id)
       VALUES ($1, 'reward', $2, $3, $4, 'marketplace_listing', $5)`,
      [listing.seller_id, listing.price, newSellerCoins, `Vente marketplace: carte #${listing.card_template_id}`, listing.id]
    );

    await pool.query('COMMIT');

    // Notify seller
    const cardName = (await pool.query('SELECT name FROM card_templates WHERE id = $1', [listing.card_template_id])).rows[0]?.name || 'Carte';
    await createNotification(listing.seller_id, 'card_sold', 'Carte vendue !',
      `Votre ${cardName} a ete achetee pour ${listing.price} coins`, { listingId: listing.id });

    // Log activity for friends feed
    try {
      const { createActivity } = await import('../utils/activity.js');
      await createActivity(listing.seller_id, 'marketplace_sale', { cardName, price: listing.price });
      await createActivity(buyerId, 'marketplace_purchase', { cardName, price: listing.price });
    } catch {}

    // New JWT for buyer
    const newToken = generateToken(
      {
        id: req.user.twitchId,
        login: req.user.username,
        display_name: req.user.displayName,
        profile_image_url: req.user.profileImageUrl,
      },
      null,
      newBuyerCoins
    );

    res.json({
      success: true,
      newCoins: newBuyerCoins,
      newToken,
    });

    // Check achievements for both
    checkAchievements(buyerId).catch(() => {});
    checkAchievements(listing.seller_id).catch(() => {});
  } catch (error) {
    try { await pool.query('ROLLBACK'); } catch { /* ignore */ }
    console.error('Error buying card:', error);
    res.status(500).json({ error: 'Failed to buy card' });
  }
});

// POST /api/marketplace/cancel/:listingId — cancel own listing
router.post('/cancel/:listingId', authenticate, async (req, res) => {
  try {
    const { listingId } = req.params;

    const result = await pool.query(
      `UPDATE marketplace_listings SET status = 'cancelled'
       WHERE id = $1 AND seller_id = $2 AND status = 'active'
       RETURNING *`,
      [listingId, req.user.twitchId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Annonce introuvable' });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error cancelling listing:', error);
    res.status(500).json({ error: 'Failed to cancel listing' });
  }
});

export default router;
