import { pool } from '../config/database.js';
import { createNotification } from './notifications.js';

/**
 * Check and unlock achievements for a user.
 * Call this after relevant actions (booster open, trade, sell, etc.)
 */
export async function checkAchievements(userId) {
  try {
    // Get all achievements not yet unlocked by this user
    const result = await pool.query(`
      SELECT a.* FROM achievements a
      WHERE a.id NOT IN (
        SELECT achievement_id FROM user_achievements WHERE user_id = $1
      )
    `, [userId]);

    const pending = result.rows;
    if (pending.length === 0) return [];

    // Gather user stats
    const stats = await getUserStats(userId);
    const unlocked = [];

    for (const ach of pending) {
      let progress = 0;

      switch (ach.key) {
        case 'first_card': progress = stats.uniqueCards; break;
        case 'collect_10': progress = stats.uniqueCards; break;
        case 'collect_50': progress = stats.uniqueCards; break;
        case 'collect_100': progress = stats.uniqueCards; break;
        case 'collect_250': progress = stats.uniqueCards; break;
        case 'open_1': progress = stats.boostersOpened; break;
        case 'open_10': progress = stats.boostersOpened; break;
        case 'open_50': progress = stats.boostersOpened; break;
        case 'open_100': progress = stats.boostersOpened; break;
        case 'trade_1': progress = stats.tradesCompleted; break;
        case 'trade_10': progress = stats.tradesCompleted; break;
        case 'trade_50': progress = stats.tradesCompleted; break;
        case 'sell_1': progress = stats.cardsSold; break;
        case 'sell_10': progress = stats.cardsSold; break;
        case 'buy_market_1': progress = stats.cardsBought; break;
        case 'streak_7': progress = stats.dailyStreak; break;
        case 'streak_30': progress = stats.dailyStreak; break;
        case 'legendary_1': progress = stats.legendaryCards; break;
        case 'ultra_legendary_1': progress = stats.ultraLegendaryCards; break;
        case 'complete_collection': progress = stats.completedCollections; break;
        case 'recycle_10': progress = stats.cardsRecycled; break;
        case 'recycle_50': progress = stats.cardsRecycled; break;
        case 'rich_10k': progress = stats.coins; break;
        case 'rich_100k': progress = stats.coins; break;
        default: continue;
      }

      if (progress >= ach.threshold) {
        // Unlock achievement
        await pool.query(
          `INSERT INTO user_achievements (user_id, achievement_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
          [userId, ach.id]
        );

        // Grant reward coins if any
        if (ach.reward_coins > 0) {
          await pool.query(
            `UPDATE users SET coins = coins + $1 WHERE twitch_id = $2`,
            [ach.reward_coins, userId]
          );
          await pool.query(
            `INSERT INTO transactions (user_id, type, amount, balance_after, description, reference_type, reference_id)
             VALUES ($1, 'reward', $2, (SELECT coins FROM users WHERE twitch_id = $1), $3, 'achievement', $4)`,
            [userId, ach.reward_coins, `Succes: ${ach.title}`, ach.id]
          );
        }

        await createNotification(userId, 'reward_available',
          `${ach.icon} Succes debloque !`,
          `${ach.title}${ach.reward_coins > 0 ? ` (+${ach.reward_coins} coins)` : ''}`,
          { achievementId: ach.id }
        );

        unlocked.push(ach);
      }
    }

    return unlocked;
  } catch (error) {
    console.error('Achievement check failed:', error.message);
    return [];
  }
}

async function getUserStats(userId) {
  const queries = await Promise.all([
    pool.query(`SELECT COUNT(DISTINCT card_template_id) AS c FROM user_cards WHERE user_id = $1`, [userId]),
    pool.query(`SELECT COUNT(*) AS c FROM booster_openings WHERE user_id = $1`, [userId]),
    pool.query(`SELECT COUNT(*) AS c FROM trades WHERE (sender_id = $1 OR receiver_id = $1) AND status = 'accepted'`, [userId]),
    pool.query(`SELECT COUNT(*) AS c FROM marketplace_listings WHERE seller_id = $1 AND status = 'sold'`, [userId]),
    pool.query(`SELECT COUNT(*) AS c FROM marketplace_listings WHERE buyer_id = $1 AND status = 'sold'`, [userId]),
    pool.query(`SELECT daily_streak, coins FROM users WHERE twitch_id = $1`, [userId]),
    pool.query(`
      SELECT COUNT(DISTINCT ct.id) AS c FROM user_cards uc
      JOIN card_templates ct ON uc.card_template_id = ct.id
      WHERE uc.user_id = $1 AND ct.rarity = 'legendary'
    `, [userId]),
    pool.query(`
      SELECT COUNT(DISTINCT ct.id) AS c FROM user_cards uc
      JOIN card_templates ct ON uc.card_template_id = ct.id
      WHERE uc.user_id = $1 AND ct.rarity = 'ultra-legendary'
    `, [userId]),
    pool.query(`SELECT COUNT(*) AS c FROM transactions WHERE user_id = $1 AND type = 'recycle'`, [userId]),
    // Completed collections: streamers where user owns 100% of active cards
    pool.query(`
      SELECT COUNT(*) AS c FROM (
        SELECT ct.creator_id,
          COUNT(DISTINCT ct.id) AS total,
          COUNT(DISTINCT CASE WHEN uc.id IS NOT NULL THEN ct.id END) AS owned
        FROM card_templates ct
        LEFT JOIN user_cards uc ON uc.card_template_id = ct.id AND uc.user_id = $1
        WHERE ct.is_active = true
        GROUP BY ct.creator_id
        HAVING COUNT(DISTINCT ct.id) > 0
          AND COUNT(DISTINCT CASE WHEN uc.id IS NOT NULL THEN ct.id END) = COUNT(DISTINCT ct.id)
      ) sub
    `, [userId]),
  ]);

  const userRow = queries[5].rows[0] || {};

  return {
    uniqueCards: parseInt(queries[0].rows[0].c),
    boostersOpened: parseInt(queries[1].rows[0].c),
    tradesCompleted: parseInt(queries[2].rows[0].c),
    cardsSold: parseInt(queries[3].rows[0].c),
    cardsBought: parseInt(queries[4].rows[0].c),
    dailyStreak: userRow.daily_streak || 0,
    coins: userRow.coins || 0,
    legendaryCards: parseInt(queries[6].rows[0].c),
    ultraLegendaryCards: parseInt(queries[7].rows[0].c),
    cardsRecycled: parseInt(queries[8].rows[0].c),
    completedCollections: parseInt(queries[9].rows[0].c),
  };
}
