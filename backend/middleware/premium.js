import { pool } from '../config/database.js';

/**
 * Get the premium status for a user from the database.
 * Returns { subscriptionType, subscriptionStatus, subscriptionExpiresAt, isPremium, isStreamerPremium }
 */
export async function getPremiumStatus(twitchId) {
  try {
    const result = await pool.query(
      'SELECT subscription_type, subscription_status, subscription_expires_at FROM users WHERE twitch_id = $1',
      [twitchId]
    );
    if (result.rows.length === 0) {
      return { subscriptionType: 'free', subscriptionStatus: 'none', subscriptionExpiresAt: null, isPremium: false, isStreamerPremium: false };
    }
    const row = result.rows[0];
    const isActive = row.subscription_status === 'active';
    return {
      subscriptionType: row.subscription_type || 'free',
      subscriptionStatus: row.subscription_status || 'none',
      subscriptionExpiresAt: row.subscription_expires_at,
      isPremium: isActive && (row.subscription_type === 'viewer_premium' || row.subscription_type === 'streamer_premium'),
      isStreamerPremium: isActive && row.subscription_type === 'streamer_premium',
    };
  } catch {
    return { subscriptionType: 'free', subscriptionStatus: 'none', subscriptionExpiresAt: null, isPremium: false, isStreamerPremium: false };
  }
}

/**
 * Middleware: require an active viewer or streamer premium subscription.
 * Must be used AFTER authenticate middleware (needs req.user).
 */
export function requireViewerPremium(req, res, next) {
  getPremiumStatus(req.user.twitchId).then(status => {
    if (!status.isPremium) {
      return res.status(403).json({ error: 'Premium subscription required', upgradeRequired: true });
    }
    req.premium = status;
    next();
  }).catch(() => {
    res.status(500).json({ error: 'Failed to check premium status' });
  });
}

/**
 * Middleware: require an active streamer premium subscription.
 * Must be used AFTER authenticate middleware (needs req.user).
 */
export function requireStreamerPremium(req, res, next) {
  getPremiumStatus(req.user.twitchId).then(status => {
    if (!status.isStreamerPremium) {
      return res.status(403).json({ error: 'Streamer Premium subscription required', upgradeRequired: true });
    }
    req.premium = status;
    next();
  }).catch(() => {
    res.status(500).json({ error: 'Failed to check premium status' });
  });
}
