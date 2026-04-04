import express from 'express';
import { pool } from '../config/database.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

// Middleware: require admin
async function requireAdmin(req, res, next) {
  try {
    const result = await pool.query(
      'SELECT is_admin FROM users WHERE twitch_id = $1',
      [req.user.twitchId]
    );
    if (result.rows.length === 0 || !result.rows[0].is_admin) {
      return res.status(403).json({ error: 'Admin access required' });
    }
    next();
  } catch (error) {
    console.error('Admin check error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// Get all pending streamer requests
router.get('/streamer-requests', authenticate, requireAdmin, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT twitch_id, username, display_name, profile_image_url,
              streamer_status, streamer_requested_at, created_at
       FROM users
       WHERE streamer_status = 'pending'
       ORDER BY streamer_requested_at ASC`
    );
    res.json({ requests: result.rows });
  } catch (error) {
    console.error('Error fetching streamer requests:', error);
    res.status(500).json({ error: 'Failed to fetch requests' });
  }
});

// Get all users (for admin overview)
router.get('/users', authenticate, requireAdmin, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT twitch_id, username, display_name, profile_image_url,
              is_streamer, streamer_status, is_admin, coins,
              streamer_requested_at, streamer_reviewed_at, streamer_review_note,
              created_at
       FROM users
       ORDER BY created_at DESC`
    );
    res.json({ users: result.rows });
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Approve a streamer request
router.post('/approve-streamer/:twitchId', authenticate, requireAdmin, async (req, res) => {
  try {
    const { twitchId } = req.params;
    const { note } = req.body;

    const result = await pool.query(
      `UPDATE users
       SET streamer_status = 'approved',
           is_streamer = true,
           streamer_reviewed_at = NOW(),
           streamer_review_note = $2
       WHERE twitch_id = $1 AND streamer_status = 'pending'
       RETURNING twitch_id, username, display_name, streamer_status`,
      [twitchId, note || null]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'No pending request found for this user' });
    }

    res.json({ success: true, user: result.rows[0] });
  } catch (error) {
    console.error('Error approving streamer:', error);
    res.status(500).json({ error: 'Failed to approve streamer' });
  }
});

// Reject a streamer request
router.post('/reject-streamer/:twitchId', authenticate, requireAdmin, async (req, res) => {
  try {
    const { twitchId } = req.params;
    const { note } = req.body;

    const result = await pool.query(
      `UPDATE users
       SET streamer_status = 'rejected',
           is_streamer = false,
           streamer_reviewed_at = NOW(),
           streamer_review_note = $2
       WHERE twitch_id = $1 AND streamer_status = 'pending'
       RETURNING twitch_id, username, display_name, streamer_status`,
      [twitchId, note || 'Request rejected']
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'No pending request found for this user' });
    }

    res.json({ success: true, user: result.rows[0] });
  } catch (error) {
    console.error('Error rejecting streamer:', error);
    res.status(500).json({ error: 'Failed to reject streamer' });
  }
});

// Revoke streamer status
router.post('/revoke-streamer/:twitchId', authenticate, requireAdmin, async (req, res) => {
  try {
    const { twitchId } = req.params;

    const result = await pool.query(
      `UPDATE users
       SET streamer_status = 'none',
           is_streamer = false,
           streamer_reviewed_at = NOW(),
           streamer_review_note = 'Streamer status revoked by admin'
       WHERE twitch_id = $1
       RETURNING twitch_id, username, display_name, streamer_status`,
      [twitchId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ success: true, user: result.rows[0] });
  } catch (error) {
    console.error('Error revoking streamer:', error);
    res.status(500).json({ error: 'Failed to revoke streamer' });
  }
});

// ============================================================
// BOOSTER PACK APPROVAL
// ============================================================

// Get pending booster packs
router.get('/pending-packs', authenticate, requireAdmin, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT bp.*,
        u.username AS creator_name,
        u.display_name AS creator_display_name,
        u.profile_image_url AS creator_image,
        (SELECT COUNT(*) FROM card_templates ct WHERE ct.booster_pack_id = bp.id) AS total_cards
       FROM booster_packs bp
       JOIN users u ON bp.creator_id = u.twitch_id
       WHERE bp.approval_status = 'pending'
       ORDER BY bp.created_at ASC`
    );
    res.json({ packs: result.rows });
  } catch (error) {
    console.error('Error fetching pending packs:', error);
    res.status(500).json({ error: 'Failed to fetch pending packs' });
  }
});

// Approve a booster pack
router.post('/approve-pack/:packId', authenticate, requireAdmin, async (req, res) => {
  try {
    const { packId } = req.params;
    const { note } = req.body;

    const result = await pool.query(
      `UPDATE booster_packs
       SET approval_status = 'approved',
           approval_note = $2,
           approval_reviewed_at = NOW()
       WHERE id = $1 AND approval_status = 'pending'
       RETURNING id, name, approval_status`,
      [packId, note || null]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'No pending pack found' });
    }

    res.json({ success: true, pack: result.rows[0] });
  } catch (error) {
    console.error('Error approving pack:', error);
    res.status(500).json({ error: 'Failed to approve pack' });
  }
});

// Reject a booster pack
router.post('/reject-pack/:packId', authenticate, requireAdmin, async (req, res) => {
  try {
    const { packId } = req.params;
    const { note } = req.body;

    const result = await pool.query(
      `UPDATE booster_packs
       SET approval_status = 'rejected',
           approval_note = $2,
           approval_reviewed_at = NOW()
       WHERE id = $1 AND approval_status = 'pending'
       RETURNING id, name, approval_status`,
      [packId, note || 'Pack rejected']
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'No pending pack found' });
    }

    res.json({ success: true, pack: result.rows[0] });
  } catch (error) {
    console.error('Error rejecting pack:', error);
    res.status(500).json({ error: 'Failed to reject pack' });
  }
});

// ============================================================
// CARD TEMPLATE APPROVAL
// ============================================================

// Get pending card templates
router.get('/pending-cards', authenticate, requireAdmin, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT ct.*,
        u.username AS creator_name,
        u.display_name AS creator_display_name,
        u.profile_image_url AS creator_image,
        bp.name AS booster_pack_name
       FROM card_templates ct
       JOIN users u ON ct.creator_id = u.twitch_id
       JOIN booster_packs bp ON ct.booster_pack_id = bp.id
       WHERE ct.approval_status = 'pending'
       ORDER BY ct.created_at ASC`
    );
    res.json({ cards: result.rows });
  } catch (error) {
    console.error('Error fetching pending cards:', error);
    res.status(500).json({ error: 'Failed to fetch pending cards' });
  }
});

// Approve a card template
router.post('/approve-card/:cardId', authenticate, requireAdmin, async (req, res) => {
  try {
    const { cardId } = req.params;
    const { note } = req.body;

    const result = await pool.query(
      `UPDATE card_templates
       SET approval_status = 'approved',
           approval_note = $2,
           approval_reviewed_at = NOW()
       WHERE id = $1 AND approval_status = 'pending'
       RETURNING id, name, approval_status`,
      [cardId, note || null]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'No pending card found' });
    }

    res.json({ success: true, card: result.rows[0] });
  } catch (error) {
    console.error('Error approving card:', error);
    res.status(500).json({ error: 'Failed to approve card' });
  }
});

// Reject a card template
router.post('/reject-card/:cardId', authenticate, requireAdmin, async (req, res) => {
  try {
    const { cardId } = req.params;
    const { note } = req.body;

    const result = await pool.query(
      `UPDATE card_templates
       SET approval_status = 'rejected',
           approval_note = $2,
           approval_reviewed_at = NOW()
       WHERE id = $1 AND approval_status = 'pending'
       RETURNING id, name, approval_status`,
      [cardId, note || 'Card rejected']
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'No pending card found' });
    }

    res.json({ success: true, card: result.rows[0] });
  } catch (error) {
    console.error('Error rejecting card:', error);
    res.status(500).json({ error: 'Failed to reject card' });
  }
});

// Get admin stats
router.get('/stats', authenticate, requireAdmin, async (req, res) => {
  try {
    const stats = await pool.query(`
      SELECT
        COUNT(*) AS total_users,
        COUNT(*) FILTER (WHERE is_streamer = true) AS total_streamers,
        COUNT(*) FILTER (WHERE streamer_status = 'pending') AS pending_requests,
        COUNT(*) FILTER (WHERE streamer_status = 'rejected') AS rejected_requests
      FROM users
    `);

    const packStats = await pool.query(`
      SELECT COUNT(*) AS total_packs,
             COUNT(*) FILTER (WHERE is_published = true AND approval_status = 'approved') AS published_packs,
             COUNT(*) FILTER (WHERE approval_status = 'pending') AS pending_packs
      FROM booster_packs
    `);

    const cardTemplateStats = await pool.query(`
      SELECT COUNT(*) AS total_templates,
             COUNT(*) FILTER (WHERE approval_status = 'pending') AS pending_cards,
             COUNT(*) FILTER (WHERE approval_status = 'approved') AS approved_cards
      FROM card_templates
    `);

    const cardStats = await pool.query(`
      SELECT COUNT(*) AS total_cards FROM user_cards
    `);

    res.json({
      users: stats.rows[0],
      packs: packStats.rows[0],
      cardTemplates: cardTemplateStats.rows[0],
      cards: cardStats.rows[0],
    });
  } catch (error) {
    console.error('Error fetching admin stats:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

export default router;
