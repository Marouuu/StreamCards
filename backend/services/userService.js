import { pool } from '../config/database.js';

/**
 * Find or create a user from Twitch data
 */
export async function findOrCreateUser(twitchUser) {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');

    // Check if user exists
    const existingUser = await client.query(
      'SELECT * FROM users WHERE twitch_id = $1',
      [twitchUser.id]
    );

    if (existingUser.rows.length > 0) {
      // Update existing user
      const updatedUser = await client.query(
        `UPDATE users 
         SET username = $1, display_name = $2, profile_image_url = $3, updated_at = CURRENT_TIMESTAMP
         WHERE twitch_id = $4
         RETURNING *`,
        [twitchUser.login, twitchUser.display_name, twitchUser.profile_image_url, twitchUser.id]
      );
      await client.query('COMMIT');
      return updatedUser.rows[0];
    } else {
      // Create new user
      const newUser = await client.query(
        `INSERT INTO users (twitch_id, username, display_name, profile_image_url, coins)
         VALUES ($1, $2, $3, $4, 0)
         RETURNING *`,
        [twitchUser.id, twitchUser.login, twitchUser.display_name, twitchUser.profile_image_url]
      );
      await client.query('COMMIT');
      return newUser.rows[0];
    }
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error in findOrCreateUser:', error);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Get user by ID
 */
export async function getUserById(userId) {
  try {
    const result = await pool.query('SELECT * FROM users WHERE id = $1', [userId]);
    return result.rows[0] || null;
  } catch (error) {
    console.error('Error getting user by ID:', error);
    throw error;
  }
}

