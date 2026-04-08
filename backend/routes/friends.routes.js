import express from 'express';
import { pool } from '../config/database.js';
import { authenticate } from '../middleware/auth.js';
import { createNotification } from '../utils/notifications.js';
import { createActivity } from '../utils/activity.js';

const router = express.Router();

// Basic HTML sanitization to prevent stored XSS
function sanitizeText(str) {
  return str.replace(/[<>&"']/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;' }[c]));
}

// GET /api/friends — list all friends (accepted) + pending requests
router.get('/', authenticate, async (req, res) => {
  try {
    const userId = req.user.twitchId;

    // Accepted friends (bidirectional)
    const friends = await pool.query(`
      SELECT u.twitch_id, u.username, u.display_name, u.profile_image_url, u.is_streamer,
             f.created_at as friends_since
      FROM friendships f
      JOIN users u ON (
        CASE WHEN f.user_id = $1 THEN u.twitch_id = f.friend_id
             ELSE u.twitch_id = f.user_id END
      )
      WHERE (f.user_id = $1 OR f.friend_id = $1)
        AND f.status = 'accepted'
      ORDER BY u.display_name
    `, [userId]);

    // Pending requests received
    const pendingReceived = await pool.query(`
      SELECT u.twitch_id, u.username, u.display_name, u.profile_image_url, u.is_streamer,
             f.id as request_id, f.created_at
      FROM friendships f
      JOIN users u ON u.twitch_id = f.user_id
      WHERE f.friend_id = $1 AND f.status = 'pending'
      ORDER BY f.created_at DESC
    `, [userId]);

    // Pending requests sent
    const pendingSent = await pool.query(`
      SELECT u.twitch_id, u.username, u.display_name, u.profile_image_url,
             f.id as request_id, f.created_at
      FROM friendships f
      JOIN users u ON u.twitch_id = f.friend_id
      WHERE f.user_id = $1 AND f.status = 'pending'
      ORDER BY f.created_at DESC
    `, [userId]);

    res.json({
      friends: friends.rows,
      pendingReceived: pendingReceived.rows,
      pendingSent: pendingSent.rows,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/friends/request — send friend request
router.post('/request', authenticate, async (req, res) => {
  try {
    const userId = req.user.twitchId;
    const { friendId } = req.body;

    if (!friendId) return res.status(400).json({ error: 'friendId is required' });
    if (friendId === userId) return res.status(400).json({ error: 'Cannot add yourself' });

    // Check user exists
    const userCheck = await pool.query('SELECT twitch_id, display_name FROM users WHERE twitch_id = $1', [friendId]);
    if (userCheck.rows.length === 0) return res.status(404).json({ error: 'User not found' });

    // Check if friendship already exists in either direction
    const existing = await pool.query(`
      SELECT id, status, user_id FROM friendships
      WHERE (user_id = $1 AND friend_id = $2) OR (user_id = $2 AND friend_id = $1)
    `, [userId, friendId]);

    if (existing.rows.length > 0) {
      const f = existing.rows[0];
      if (f.status === 'accepted') return res.status(400).json({ error: 'Already friends' });
      if (f.status === 'pending' && f.user_id === userId) return res.status(400).json({ error: 'Request already sent' });
      if (f.status === 'pending' && f.user_id === friendId) {
        // They sent us a request, auto-accept
        await pool.query(`UPDATE friendships SET status = 'accepted', updated_at = NOW() WHERE id = $1`, [f.id]);
        await createNotification(friendId, 'friend_accepted', 'Ami accepte', `${req.user.displayName} a accepte votre demande d'ami`);
        await createActivity(userId, 'friend_added', { friendId, friendName: userCheck.rows[0].display_name });
        await createActivity(friendId, 'friend_added', { friendId: userId, friendName: req.user.displayName });
        return res.json({ status: 'accepted' });
      }
      if (f.status === 'blocked') return res.status(400).json({ error: 'Cannot send request' });
    }

    await pool.query(`
      INSERT INTO friendships (user_id, friend_id, status)
      VALUES ($1, $2, 'pending')
    `, [userId, friendId]);

    await createNotification(friendId, 'friend_request', 'Demande d\'ami',
      `${req.user.displayName} vous a envoye une demande d'ami`,
      { fromUserId: userId, fromUserName: req.user.displayName }
    );

    res.json({ status: 'pending' });
  } catch (error) {
    if (error.code === '23505') return res.status(400).json({ error: 'Request already exists' });
    res.status(500).json({ error: error.message });
  }
});

// POST /api/friends/accept/:requestId
router.post('/accept/:requestId', authenticate, async (req, res) => {
  try {
    const userId = req.user.twitchId;
    const { requestId } = req.params;

    const result = await pool.query(`
      UPDATE friendships SET status = 'accepted', updated_at = NOW()
      WHERE id = $1 AND friend_id = $2 AND status = 'pending'
      RETURNING user_id
    `, [requestId, userId]);

    if (result.rows.length === 0) return res.status(404).json({ error: 'Request not found' });

    const senderId = result.rows[0].user_id;
    await createNotification(senderId, 'friend_accepted', 'Ami accepte',
      `${req.user.displayName} a accepte votre demande d'ami`
    );

    // Get friend info for activity
    const friendInfo = await pool.query('SELECT display_name FROM users WHERE twitch_id = $1', [senderId]);
    await createActivity(userId, 'friend_added', { friendId: senderId, friendName: friendInfo.rows[0]?.display_name });
    await createActivity(senderId, 'friend_added', { friendId: userId, friendName: req.user.displayName });

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/friends/decline/:requestId
router.post('/decline/:requestId', authenticate, async (req, res) => {
  try {
    const userId = req.user.twitchId;
    await pool.query(`
      DELETE FROM friendships WHERE id = $1 AND friend_id = $2 AND status = 'pending'
    `, [req.params.requestId, userId]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/friends/:friendId — remove friend
router.delete('/:friendId', authenticate, async (req, res) => {
  try {
    const userId = req.user.twitchId;
    const { friendId } = req.params;

    await pool.query(`
      DELETE FROM friendships
      WHERE ((user_id = $1 AND friend_id = $2) OR (user_id = $2 AND friend_id = $1))
        AND status = 'accepted'
    `, [userId, friendId]);

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/friends/activity — activity feed from friends
router.get('/activity', authenticate, async (req, res) => {
  try {
    const userId = req.user.twitchId;
    const { limit = 30, offset = 0 } = req.query;

    const result = await pool.query(`
      SELECT af.*, u.display_name, u.username, u.profile_image_url
      FROM activity_feed af
      JOIN users u ON u.twitch_id = af.user_id
      WHERE af.user_id IN (
        SELECT CASE WHEN f.user_id = $1 THEN f.friend_id ELSE f.user_id END
        FROM friendships f
        WHERE (f.user_id = $1 OR f.friend_id = $1) AND f.status = 'accepted'
      )
      ORDER BY af.created_at DESC
      LIMIT $2 OFFSET $3
    `, [userId, Math.min(parseInt(limit), 50), parseInt(offset)]);

    res.json({ activities: result.rows });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/friends/messages/:friendId — get conversation
router.get('/messages/:friendId', authenticate, async (req, res) => {
  try {
    const userId = req.user.twitchId;
    const { friendId } = req.params;
    const { limit = 50, before } = req.query;

    // Verify they are friends
    const friendCheck = await pool.query(`
      SELECT id FROM friendships
      WHERE ((user_id = $1 AND friend_id = $2) OR (user_id = $2 AND friend_id = $1))
        AND status = 'accepted'
    `, [userId, friendId]);

    if (friendCheck.rows.length === 0) return res.status(403).json({ error: 'Not friends' });

    let query = `
      SELECT m.*, u.display_name as sender_name, u.profile_image_url as sender_image
      FROM messages m
      JOIN users u ON u.twitch_id = m.sender_id
      WHERE ((m.sender_id = $1 AND m.receiver_id = $2) OR (m.sender_id = $2 AND m.receiver_id = $1))
    `;
    const params = [userId, friendId];

    if (before) {
      query += ` AND m.id < $3 ORDER BY m.created_at DESC LIMIT $4`;
      params.push(parseInt(before), Math.min(parseInt(limit), 100));
    } else {
      query += ` ORDER BY m.created_at DESC LIMIT $3`;
      params.push(Math.min(parseInt(limit), 100));
    }

    const result = await pool.query(query, params);

    // Mark messages from friend as read
    await pool.query(`
      UPDATE messages SET is_read = true
      WHERE sender_id = $1 AND receiver_id = $2 AND is_read = false
    `, [friendId, userId]);

    res.json({ messages: result.rows.reverse() });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/friends/messages/:friendId — send message
router.post('/messages/:friendId', authenticate, async (req, res) => {
  try {
    const userId = req.user.twitchId;
    const { friendId } = req.params;
    const { content } = req.body;

    if (!content || typeof content !== 'string' || !content.trim()) return res.status(400).json({ error: 'Message cannot be empty' });
    if (content.length > 1000) return res.status(400).json({ error: 'Message too long (max 1000 chars)' });
    const sanitizedContent = sanitizeText(content.trim());

    // Verify they are friends
    const friendCheck = await pool.query(`
      SELECT id FROM friendships
      WHERE ((user_id = $1 AND friend_id = $2) OR (user_id = $2 AND friend_id = $1))
        AND status = 'accepted'
    `, [userId, friendId]);

    if (friendCheck.rows.length === 0) return res.status(403).json({ error: 'Not friends' });

    const result = await pool.query(`
      INSERT INTO messages (sender_id, receiver_id, content)
      VALUES ($1, $2, $3)
      RETURNING *
    `, [userId, friendId, sanitizedContent]);

    // Notify friend
    await createNotification(friendId, 'message', 'Nouveau message',
      `${req.user.displayName}: ${sanitizedContent.substring(0, 80)}`,
      { fromUserId: userId }
    );

    res.json({ message: { ...result.rows[0], sender_name: req.user.displayName } });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/friends/unread — get unread message counts per friend
router.get('/unread', authenticate, async (req, res) => {
  try {
    const userId = req.user.twitchId;
    const result = await pool.query(`
      SELECT sender_id, COUNT(*) as unread_count
      FROM messages
      WHERE receiver_id = $1 AND is_read = false
      GROUP BY sender_id
    `, [userId]);

    const unread = {};
    for (const row of result.rows) {
      unread[row.sender_id] = parseInt(row.unread_count);
    }
    res.json({ unread });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
