import { pool } from '../config/database.js';

export async function createActivity(userId, type, data = {}) {
  try {
    await pool.query(
      `INSERT INTO activity_feed (user_id, type, data) VALUES ($1, $2, $3)`,
      [userId, type, JSON.stringify(data)]
    );
  } catch (error) {
    console.error('Failed to create activity:', error.message);
  }
}
