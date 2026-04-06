import express from 'express';
import { pool } from '../config/database.js';
import { authenticate } from '../middleware/auth.js';
import { createNotification } from '../utils/notifications.js';
import { checkAchievements } from '../utils/achievements.js';

const router = express.Router();

// GET /api/trades — list user's trades (sent + received)
router.get('/', authenticate, async (req, res) => {
  try {
    const userId = req.user.twitchId;
    const { status } = req.query;

    let where = `(t.sender_id = $1 OR t.receiver_id = $1)`;
    const params = [userId];

    if (status && ['pending', 'accepted', 'declined', 'cancelled'].includes(status)) {
      params.push(status);
      where += ` AND t.status = $${params.length}`;
    }

    const result = await pool.query(`
      SELECT t.*,
        sender.display_name AS sender_name, sender.profile_image_url AS sender_image,
        receiver.display_name AS receiver_name, receiver.profile_image_url AS receiver_image
      FROM trades t
      JOIN users sender ON t.sender_id = sender.twitch_id
      JOIN users receiver ON t.receiver_id = receiver.twitch_id
      WHERE ${where}
      ORDER BY t.created_at DESC
      LIMIT 50
    `, params);

    // Get trade items for each trade
    const tradeIds = result.rows.map(t => t.id);
    let itemsMap = {};

    if (tradeIds.length > 0) {
      const itemsResult = await pool.query(`
        SELECT ti.trade_id, ti.user_id, ti.user_card_id,
          ct.name, ct.image_url, ct.rarity, ct.outline_color, ct.background_color,
          ct.text_color, ct.effect, ct.effect_color, ct.effect_intensity
        FROM trade_items ti
        JOIN user_cards uc ON ti.user_card_id = uc.id
        JOIN card_templates ct ON uc.card_template_id = ct.id
        WHERE ti.trade_id = ANY($1)
      `, [tradeIds]);

      for (const item of itemsResult.rows) {
        if (!itemsMap[item.trade_id]) itemsMap[item.trade_id] = [];
        itemsMap[item.trade_id].push(item);
      }
    }

    const trades = result.rows.map(t => ({
      ...t,
      items: itemsMap[t.id] || [],
    }));

    res.json({ trades });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/trades — create a trade offer
router.post('/', authenticate, async (req, res) => {
  const client = await pool.connect();
  try {
    const senderId = req.user.twitchId;
    const { receiverId, senderCardIds, receiverCardIds, message } = req.body;

    if (!receiverId || receiverId === senderId) {
      return res.status(400).json({ error: 'Destinataire invalide' });
    }
    if (!Array.isArray(senderCardIds) || senderCardIds.length === 0) {
      return res.status(400).json({ error: 'Vous devez proposer au moins une carte' });
    }
    if (!Array.isArray(receiverCardIds) || receiverCardIds.length === 0) {
      return res.status(400).json({ error: 'Vous devez demander au moins une carte' });
    }
    if (senderCardIds.length > 10 || receiverCardIds.length > 10) {
      return res.status(400).json({ error: 'Maximum 10 cartes par cote' });
    }

    await client.query('BEGIN');

    // Check receiver exists
    const receiverCheck = await client.query('SELECT twitch_id FROM users WHERE twitch_id = $1', [receiverId]);
    if (receiverCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Utilisateur introuvable' });
    }

    // Verify sender owns cards and they aren't listed on marketplace or in a pending trade
    for (const cardId of senderCardIds) {
      const own = await client.query('SELECT id FROM user_cards WHERE id = $1 AND user_id = $2', [cardId, senderId]);
      if (own.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: `Carte ${cardId} non possedee` });
      }
      const listed = await client.query(
        `SELECT id FROM marketplace_listings WHERE user_card_id = $1 AND status = 'active'`, [cardId]
      );
      if (listed.rows.length > 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: `Carte ${cardId} en vente sur le marche` });
      }
    }

    // Verify receiver owns their cards
    for (const cardId of receiverCardIds) {
      const own = await client.query('SELECT id FROM user_cards WHERE id = $1 AND user_id = $2', [cardId, receiverId]);
      if (own.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: `Carte ${cardId} non possedee par le destinataire` });
      }
    }

    // Create trade
    const tradeResult = await client.query(
      `INSERT INTO trades (sender_id, receiver_id, message) VALUES ($1, $2, $3) RETURNING *`,
      [senderId, receiverId, message || null]
    );
    const trade = tradeResult.rows[0];

    // Insert trade items
    for (const cardId of senderCardIds) {
      await client.query(
        `INSERT INTO trade_items (trade_id, user_id, user_card_id) VALUES ($1, $2, $3)`,
        [trade.id, senderId, cardId]
      );
    }
    for (const cardId of receiverCardIds) {
      await client.query(
        `INSERT INTO trade_items (trade_id, user_id, user_card_id) VALUES ($1, $2, $3)`,
        [trade.id, receiverId, cardId]
      );
    }

    await client.query('COMMIT');

    // Notify receiver
    await createNotification(receiverId, 'trade_received', 'Nouvelle offre d\'echange',
      `${req.user.displayName || 'Un joueur'} vous propose un echange`, { tradeId: trade.id });

    res.status(201).json({ trade });
  } catch (error) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
});

// POST /api/trades/:tradeId/accept
router.post('/:tradeId/accept', authenticate, async (req, res) => {
  const client = await pool.connect();
  try {
    const userId = req.user.twitchId;
    const tradeId = parseInt(req.params.tradeId);

    await client.query('BEGIN');

    // Lock trade
    const tradeResult = await client.query(
      `SELECT * FROM trades WHERE id = $1 AND status = 'pending' FOR UPDATE`, [tradeId]
    );
    if (tradeResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Echange introuvable ou deja traite' });
    }
    const trade = tradeResult.rows[0];

    if (trade.receiver_id !== userId) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'Seul le destinataire peut accepter' });
    }

    // Get items
    const itemsResult = await client.query(
      `SELECT * FROM trade_items WHERE trade_id = $1`, [tradeId]
    );

    const senderItems = itemsResult.rows.filter(i => i.user_id === trade.sender_id);
    const receiverItems = itemsResult.rows.filter(i => i.user_id === trade.receiver_id);

    // Verify all cards still owned
    for (const item of senderItems) {
      const own = await client.query(
        'SELECT id FROM user_cards WHERE id = $1 AND user_id = $2 FOR UPDATE',
        [item.user_card_id, trade.sender_id]
      );
      if (own.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Une carte du proposeur n\'est plus disponible' });
      }
    }
    for (const item of receiverItems) {
      const own = await client.query(
        'SELECT id FROM user_cards WHERE id = $1 AND user_id = $2 FOR UPDATE',
        [item.user_card_id, trade.receiver_id]
      );
      if (own.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Une de vos cartes n\'est plus disponible' });
      }
    }

    // Transfer cards: sender's cards -> receiver
    for (const item of senderItems) {
      await client.query('UPDATE user_cards SET user_id = $1 WHERE id = $2', [trade.receiver_id, item.user_card_id]);
    }
    // Transfer cards: receiver's cards -> sender
    for (const item of receiverItems) {
      await client.query('UPDATE user_cards SET user_id = $1 WHERE id = $2', [trade.sender_id, item.user_card_id]);
    }

    // Cancel any marketplace listings for traded cards
    const allCardIds = itemsResult.rows.map(i => i.user_card_id);
    await client.query(
      `UPDATE marketplace_listings SET status = 'cancelled' WHERE user_card_id = ANY($1) AND status = 'active'`,
      [allCardIds]
    );

    // Update trade status
    await client.query(
      `UPDATE trades SET status = 'accepted', responded_at = NOW() WHERE id = $1`, [tradeId]
    );

    // Log transactions
    await client.query(
      `INSERT INTO transactions (user_id, type, amount, balance_after, description, reference_type, reference_id)
       VALUES ($1, 'trade', 0, (SELECT coins FROM users WHERE twitch_id = $1), $2, 'trade', $3)`,
      [trade.sender_id, `Echange #${tradeId} accepte`, tradeId]
    );
    await client.query(
      `INSERT INTO transactions (user_id, type, amount, balance_after, description, reference_type, reference_id)
       VALUES ($1, 'trade', 0, (SELECT coins FROM users WHERE twitch_id = $1), $2, 'trade', $3)`,
      [trade.receiver_id, `Echange #${tradeId} accepte`, tradeId]
    );

    await client.query('COMMIT');

    // Notify sender
    await createNotification(trade.sender_id, 'trade_accepted', 'Echange accepte',
      `${req.user.displayName || 'Le destinataire'} a accepte votre echange`, { tradeId });

    // Check achievements for both users
    checkAchievements(trade.sender_id).catch(() => {});
    checkAchievements(trade.receiver_id).catch(() => {});

    res.json({ success: true });
  } catch (error) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
});

// POST /api/trades/:tradeId/decline
router.post('/:tradeId/decline', authenticate, async (req, res) => {
  try {
    const userId = req.user.twitchId;
    const tradeId = parseInt(req.params.tradeId);

    const result = await pool.query(
      `UPDATE trades SET status = 'declined', responded_at = NOW()
       WHERE id = $1 AND receiver_id = $2 AND status = 'pending'
       RETURNING sender_id`,
      [tradeId, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Echange introuvable' });
    }

    await createNotification(result.rows[0].sender_id, 'trade_declined', 'Echange refuse',
      `${req.user.displayName || 'Le destinataire'} a refuse votre echange`, { tradeId });

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/trades/:tradeId/cancel — sender cancels own trade
router.post('/:tradeId/cancel', authenticate, async (req, res) => {
  try {
    const userId = req.user.twitchId;
    const tradeId = parseInt(req.params.tradeId);

    const result = await pool.query(
      `UPDATE trades SET status = 'cancelled', responded_at = NOW()
       WHERE id = $1 AND sender_id = $2 AND status = 'pending'
       RETURNING *`,
      [tradeId, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Echange introuvable' });
    }

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
