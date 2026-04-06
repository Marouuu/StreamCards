import { pool } from '../config/database.js';

export async function createNotification(userId, type, title, message = null, data = {}) {
  try {
    await pool.query(
      `INSERT INTO notifications (user_id, type, title, message, data)
       VALUES ($1, $2, $3, $4, $5)`,
      [userId, type, title, message, JSON.stringify(data)]
    );
  } catch (error) {
    console.error('Failed to create notification:', error.message);
  }
}

export async function getUnreadCount(userId) {
  const result = await pool.query(
    `SELECT COUNT(*) FROM notifications WHERE user_id = $1 AND is_read = false`,
    [userId]
  );
  return parseInt(result.rows[0].count);
}
