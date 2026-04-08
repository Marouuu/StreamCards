import express from 'express';
import { pool } from '../config/database.js';
import { authenticate } from '../middleware/auth.js';
import { generateToken } from '../utils/jwt.js';
import { createNotification } from '../utils/notifications.js';
import { checkAchievements } from '../utils/achievements.js';

const router = express.Router();

const MIN_DURATION_H = 1;
const MAX_DURATION_H = 72;
const MIN_BID_INCREMENT = 10;

// Helper: finalize expired auctions
async function finalizeExpired() {
  const expired = await pool.query(
    `SELECT * FROM auctions WHERE status = 'active' AND ends_at <= NOW() FOR UPDATE`
  );
  for (const auction of expired.rows) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Re-check under lock
      const check = await client.query(
        `SELECT * FROM auctions WHERE id = $1 AND status = 'active' FOR UPDATE`, [auction.id]
      );
      if (check.rows.length === 0) { await client.query('ROLLBACK'); continue; }
      const a = check.rows[0];

      if (a.highest_bidder) {
        // Transfer card to winner
        await client.query('UPDATE user_cards SET user_id = $1 WHERE id = $2', [a.highest_bidder, a.user_card_id]);

        // Pay seller
        await client.query('UPDATE users SET coins = coins + $1 WHERE twitch_id = $2', [a.current_price, a.seller_id]);

        // Log transactions
        const sellerCoins = (await client.query('SELECT coins FROM users WHERE twitch_id = $1', [a.seller_id])).rows[0].coins;
        await client.query(
          `INSERT INTO transactions (user_id, type, amount, balance_after, description, reference_type, reference_id)
           VALUES ($1, 'reward', $2, $3, $4, 'auction', $5)`,
          [a.seller_id, a.current_price, sellerCoins, `Vente enchere #${a.id}`, a.id]
        );

        await client.query(
          `UPDATE auctions SET status = 'sold', sold_at = NOW() WHERE id = $1`, [a.id]
        );

        // Notify
        await createNotification(a.highest_bidder, 'trade_accepted', 'Enchere remportee !',
          `Vous avez remporte l'enchere #${a.id} pour ${a.current_price} coins`, { auctionId: a.id });
        await createNotification(a.seller_id, 'card_sold', 'Enchere terminee',
          `Votre enchere #${a.id} s'est vendue pour ${a.current_price} coins`, { auctionId: a.id });
      } else {
        // No bids — expired
        await client.query(`UPDATE auctions SET status = 'expired' WHERE id = $1`, [a.id]);
        await createNotification(a.seller_id, 'system', 'Enchere expiree',
          `Votre enchere #${a.id} n'a recu aucune offre`, { auctionId: a.id });
      }

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      console.error('Finalize auction error:', err.message);
    } finally {
      client.release();
    }
  }
}

// GET /api/auctions — browse active auctions
router.get('/', authenticate, async (req, res) => {
  try {
    // Finalize any expired first
    await finalizeExpired();

    const { sort, rarity, search, page = 1 } = req.query;
    const limit = 30;
    const offset = (Math.max(1, parseInt(page)) - 1) * limit;

    let where = `a.status = 'active'`;
    const params = [];
    let idx = 1;

    if (rarity && rarity !== 'all') {
      params.push(rarity);
      where += ` AND ct.rarity = $${idx++}`;
    }
    if (search) {
      params.push(`%${search}%`);
      where += ` AND ct.name ILIKE $${idx++}`;
    }

    let orderBy = 'a.ends_at ASC';
    if (sort === 'price_asc') orderBy = 'a.current_price ASC';
    else if (sort === 'price_desc') orderBy = 'a.current_price DESC';
    else if (sort === 'newest') orderBy = 'a.created_at DESC';
    else if (sort === 'ending' || sort === 'ending_soon') orderBy = 'a.ends_at ASC';
    else if (sort === 'bids' || sort === 'most_bids') orderBy = 'a.bid_count DESC';

    params.push(limit);
    const lp = `$${idx++}`;
    params.push(offset);
    const op = `$${idx++}`;

    const result = await pool.query(`
      SELECT a.*, ct.name, ct.image_url, ct.rarity, ct.outline_color, ct.background_color,
        ct.text_color, ct.effect, ct.effect_color, ct.effect_intensity, ct.description AS card_description,
        seller.display_name AS seller_name, seller.profile_image_url AS seller_image,
        bidder.display_name AS bidder_name,
        creator.display_name AS creator_name
      FROM auctions a
      JOIN card_templates ct ON a.card_template_id = ct.id
      JOIN users seller ON a.seller_id = seller.twitch_id
      LEFT JOIN users bidder ON a.highest_bidder = bidder.twitch_id
      JOIN users creator ON ct.creator_id = creator.twitch_id
      WHERE ${where}
      ORDER BY ${orderBy}
      LIMIT ${lp} OFFSET ${op}
    `, params);

    const countResult = await pool.query(
      `SELECT COUNT(*) FROM auctions a JOIN card_templates ct ON a.card_template_id = ct.id WHERE ${where}`,
      params.slice(0, params.length - 2)
    );

    res.json({
      auctions: result.rows,
      total: parseInt(countResult.rows[0].count),
      page: parseInt(page),
      totalPages: Math.ceil(parseInt(countResult.rows[0].count) / limit),
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/auctions/my — user's own auctions (selling + bidding)
router.get('/my', authenticate, async (req, res) => {
  try {
    await finalizeExpired();
    const userId = req.user.twitchId;

    const selling = await pool.query(`
      SELECT a.*, ct.name, ct.image_url, ct.rarity, ct.outline_color, ct.background_color,
        ct.text_color, ct.effect, ct.effect_color, ct.effect_intensity,
        bidder.display_name AS bidder_name
      FROM auctions a
      JOIN card_templates ct ON a.card_template_id = ct.id
      LEFT JOIN users bidder ON a.highest_bidder = bidder.twitch_id
      WHERE a.seller_id = $1
      ORDER BY a.created_at DESC LIMIT 50
    `, [userId]);

    const bidding = await pool.query(`
      SELECT DISTINCT ON (a.id) a.*, ct.name, ct.image_url, ct.rarity, ct.outline_color,
        ct.background_color, ct.text_color, ct.effect, ct.effect_color, ct.effect_intensity,
        seller.display_name AS seller_name,
        ab.amount AS my_bid
      FROM auction_bids ab
      JOIN auctions a ON ab.auction_id = a.id
      JOIN card_templates ct ON a.card_template_id = ct.id
      JOIN users seller ON a.seller_id = seller.twitch_id
      WHERE ab.bidder_id = $1
      ORDER BY a.id, ab.amount DESC
    `, [userId]);

    res.json({ selling: selling.rows, bidding: bidding.rows });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/auctions/:id — single auction with bid history
router.get('/:id', authenticate, async (req, res) => {
  try {
    const auction = await pool.query(`
      SELECT a.*, ct.name, ct.image_url, ct.rarity, ct.outline_color, ct.background_color,
        ct.text_color, ct.effect, ct.effect_color, ct.effect_intensity, ct.description AS card_description,
        seller.display_name AS seller_name, seller.profile_image_url AS seller_image,
        bidder.display_name AS bidder_name,
        creator.display_name AS creator_name
      FROM auctions a
      JOIN card_templates ct ON a.card_template_id = ct.id
      JOIN users seller ON a.seller_id = seller.twitch_id
      LEFT JOIN users bidder ON a.highest_bidder = bidder.twitch_id
      JOIN users creator ON ct.creator_id = creator.twitch_id
      WHERE a.id = $1
    `, [req.params.id]);

    if (auction.rows.length === 0) return res.status(404).json({ error: 'Enchere introuvable' });

    const bids = await pool.query(`
      SELECT ab.amount, ab.created_at, u.display_name AS bidder_name, u.profile_image_url AS bidder_image
      FROM auction_bids ab
      JOIN users u ON ab.bidder_id = u.twitch_id
      WHERE ab.auction_id = $1
      ORDER BY ab.amount DESC LIMIT 20
    `, [req.params.id]);

    res.json({ auction: auction.rows[0], bids: bids.rows });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/auctions — create auction
router.post('/', authenticate, async (req, res) => {
  try {
    const sellerId = req.user.twitchId;
    const { userCardId, startingPrice, buyoutPrice, durationHours } = req.body;

    if (!userCardId || !Number.isInteger(startingPrice) || startingPrice < 1) {
      return res.status(400).json({ error: 'userCardId et startingPrice requis' });
    }
    if (buyoutPrice !== undefined && buyoutPrice !== null && (!Number.isInteger(buyoutPrice) || buyoutPrice <= startingPrice)) {
      return res.status(400).json({ error: 'buyoutPrice doit etre superieur a startingPrice' });
    }

    const hours = Math.min(Math.max(parseInt(durationHours) || 24, MIN_DURATION_H), MAX_DURATION_H);

    // Verify ownership
    const card = await pool.query('SELECT id, card_template_id FROM user_cards WHERE id = $1 AND user_id = $2', [userCardId, sellerId]);
    if (card.rows.length === 0) return res.status(404).json({ error: 'Carte introuvable' });

    // Check not already listed
    const listed = await pool.query(
      `SELECT id FROM marketplace_listings WHERE user_card_id = $1 AND status = 'active'`, [userCardId]
    );
    if (listed.rows.length > 0) return res.status(400).json({ error: 'Carte deja en vente sur le marche' });

    const auctioned = await pool.query(
      `SELECT id FROM auctions WHERE user_card_id = $1 AND status = 'active'`, [userCardId]
    );
    if (auctioned.rows.length > 0) return res.status(400).json({ error: 'Carte deja en enchere' });

    const endsAt = new Date(Date.now() + hours * 3600 * 1000);

    const result = await pool.query(`
      INSERT INTO auctions (seller_id, user_card_id, card_template_id, starting_price, current_price, buyout_price, ends_at)
      VALUES ($1, $2, $3, $4, $4, $5, $6) RETURNING *
    `, [sellerId, userCardId, card.rows[0].card_template_id, startingPrice, buyoutPrice || null, endsAt]);

    res.status(201).json({ auction: result.rows[0] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/auctions/:id/bid — place a bid
router.post('/:id/bid', authenticate, async (req, res) => {
  const client = await pool.connect();
  try {
    const bidderId = req.user.twitchId;
    const { amount } = req.body;

    if (!Number.isInteger(amount) || amount < 1) {
      return res.status(400).json({ error: 'Montant invalide' });
    }

    await client.query('BEGIN');

    // Lock auction
    const aResult = await client.query(
      `SELECT * FROM auctions WHERE id = $1 AND status = 'active' FOR UPDATE`, [req.params.id]
    );
    if (aResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Enchere introuvable ou terminee' });
    }
    const auction = aResult.rows[0];

    if (auction.seller_id === bidderId) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Vous ne pouvez pas encherir sur votre propre enchere' });
    }

    if (new Date(auction.ends_at) <= new Date()) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Enchere expiree' });
    }

    const minBid = auction.bid_count === 0 ? auction.starting_price : auction.current_price + MIN_BID_INCREMENT;
    if (amount < minBid) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: `Enchere minimum: ${minBid} coins` });
    }

    // Check bidder has enough coins
    const bidderResult = await client.query('SELECT coins FROM users WHERE twitch_id = $1 FOR UPDATE', [bidderId]);
    if (bidderResult.rows[0].coins < amount) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Pas assez de coins' });
    }

    // Refund previous highest bidder
    if (auction.highest_bidder && auction.highest_bidder !== bidderId) {
      await client.query('UPDATE users SET coins = coins + $1 WHERE twitch_id = $2',
        [auction.current_price, auction.highest_bidder]);

      await createNotification(auction.highest_bidder, 'system', 'Surenchere !',
        `Quelqu'un a surencheri sur l'enchere #${auction.id} (${amount} coins)`, { auctionId: auction.id });
    } else if (auction.highest_bidder === bidderId) {
      // Refund the bidder's previous bid before taking new one
      await client.query('UPDATE users SET coins = coins + $1 WHERE twitch_id = $2',
        [auction.current_price, bidderId]);
    }

    // Deduct coins from new bidder
    await client.query('UPDATE users SET coins = coins - $1 WHERE twitch_id = $2', [amount, bidderId]);

    // Record bid
    await client.query(
      `INSERT INTO auction_bids (auction_id, bidder_id, amount) VALUES ($1, $2, $3)`,
      [auction.id, bidderId, amount]
    );

    // Update auction
    await client.query(
      `UPDATE auctions SET current_price = $1, highest_bidder = $2, bid_count = bid_count + 1 WHERE id = $3`,
      [amount, bidderId, auction.id]
    );

    await client.query('COMMIT');

    // Check buyout
    if (auction.buyout_price && amount >= auction.buyout_price) {
      // Trigger immediate finalization
      await finalizeBuyout(auction.id);
    }

    // Notify seller
    await createNotification(auction.seller_id, 'system', 'Nouvelle enchere !',
      `${req.user.displayName || 'Un joueur'} a encheri ${amount} coins sur votre enchere #${auction.id}`,
      { auctionId: auction.id });

    // Get updated coins
    const newCoins = (await pool.query('SELECT coins FROM users WHERE twitch_id = $1', [bidderId])).rows[0].coins;
    const newToken = generateToken(
      { id: bidderId, login: req.user.username, display_name: req.user.displayName, profile_image_url: req.user.profileImageUrl },
      null, newCoins
    );

    res.json({ success: true, newCoins, newToken });
  } catch (error) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
});

async function finalizeBuyout(auctionId) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const a = (await client.query(`SELECT * FROM auctions WHERE id = $1 AND status = 'active' FOR UPDATE`, [auctionId])).rows[0];
    if (!a || !a.highest_bidder) { await client.query('ROLLBACK'); return; }

    await client.query('UPDATE user_cards SET user_id = $1 WHERE id = $2', [a.highest_bidder, a.user_card_id]);
    await client.query('UPDATE users SET coins = coins + $1 WHERE twitch_id = $2', [a.current_price, a.seller_id]);

    const sellerCoins = (await client.query('SELECT coins FROM users WHERE twitch_id = $1', [a.seller_id])).rows[0].coins;
    await client.query(
      `INSERT INTO transactions (user_id, type, amount, balance_after, description, reference_type, reference_id)
       VALUES ($1, 'reward', $2, $3, $4, 'auction', $5)`,
      [a.seller_id, a.current_price, sellerCoins, `Vente enchere (buyout) #${a.id}`, a.id]
    );

    await client.query(`UPDATE auctions SET status = 'sold', sold_at = NOW() WHERE id = $1`, [a.id]);
    await client.query('COMMIT');

    await createNotification(a.highest_bidder, 'trade_accepted', 'Achat immediat !',
      `Vous avez achete la carte via buyout pour ${a.current_price} coins`, { auctionId: a.id });
    await createNotification(a.seller_id, 'card_sold', 'Buyout !',
      `Votre carte a ete achetee immediatement pour ${a.current_price} coins`, { auctionId: a.id });

    checkAchievements(a.highest_bidder).catch(() => {});
    checkAchievements(a.seller_id).catch(() => {});
  } catch (err) {
    await client.query('ROLLBACK');
  } finally {
    client.release();
  }
}

// POST /api/auctions/:id/cancel
router.post('/:id/cancel', authenticate, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const a = (await client.query(
      `SELECT * FROM auctions WHERE id = $1 AND seller_id = $2 AND status = 'active' FOR UPDATE`,
      [req.params.id, req.user.twitchId]
    )).rows[0];

    if (!a) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Enchere introuvable' }); }

    // Refund highest bidder if any
    if (a.highest_bidder) {
      await client.query('UPDATE users SET coins = coins + $1 WHERE twitch_id = $2', [a.current_price, a.highest_bidder]);
      await createNotification(a.highest_bidder, 'system', 'Enchere annulee',
        `L'enchere #${a.id} a ete annulee. Vos ${a.current_price} coins ont ete rembourses.`, { auctionId: a.id });
    }

    await client.query(`UPDATE auctions SET status = 'cancelled' WHERE id = $1`, [a.id]);
    await client.query('COMMIT');

    res.json({ success: true });
  } catch (error) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
});

export default router;
