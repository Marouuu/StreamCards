import express from 'express';
import { pool } from '../config/database.js';
import { authenticate } from '../middleware/auth.js';
import { createNotification } from '../utils/notifications.js';
import {
  verifySignature,
  createEventSubSubscription,
  deleteEventSubSubscription,
  createCustomReward,
  deleteCustomReward,
  refreshAccessToken,
} from '../services/twitchEventSub.js';
import { getTwitchAuthUrl } from '../services/twitchAuth.js';
import crypto from 'crypto';

const router = express.Router();
const isDev = process.env.NODE_ENV !== 'production';

// ─── Webhook (no JWT auth — Twitch calls this directly) ───────────────

router.post('/callback', async (req, res) => {
  const secret = process.env.TWITCH_EVENTSUB_SECRET;
  if (!secret) {
    console.error('TWITCH_EVENTSUB_SECRET not configured');
    return res.status(500).send('Server misconfigured');
  }

  const messageId = req.headers['twitch-eventsub-message-id'];
  const timestamp = req.headers['twitch-eventsub-message-timestamp'];
  const signature = req.headers['twitch-eventsub-message-signature'];
  const messageType = req.headers['twitch-eventsub-message-type'];

  if (!messageId || !timestamp || !signature || !messageType) {
    return res.status(400).send('Missing Twitch headers');
  }

  // Verify HMAC signature
  const rawBody = req.rawBody ? req.rawBody.toString('utf8') : JSON.stringify(req.body);
  if (!verifySignature(secret, messageId, timestamp, rawBody, signature)) {
    console.warn('EventSub webhook signature verification failed');
    return res.status(403).send('Invalid signature');
  }

  // Handle message types
  if (messageType === 'webhook_callback_verification') {
    // Respond with the challenge to confirm subscription
    return res.status(200).type('text/plain').send(req.body.challenge);
  }

  if (messageType === 'revocation') {
    const sub = req.body.subscription;
    console.log(`EventSub subscription revoked: ${sub?.id} (${sub?.type})`);
    try {
      await pool.query(
        `UPDATE eventsub_subscriptions SET status = 'revoked', updated_at = NOW() WHERE twitch_sub_id = $1`,
        [sub?.id]
      );
      // Disable the reward config for this streamer
      if (sub?.condition?.broadcaster_user_id) {
        await pool.query(
          `UPDATE twitch_reward_configs SET is_enabled = false, updated_at = NOW() WHERE streamer_id = $1`,
          [sub.condition.broadcaster_user_id]
        );
      }
    } catch (err) {
      console.error('Error handling revocation:', err.message);
    }
    return res.status(204).send();
  }

  if (messageType === 'notification') {
    const event = req.body.event;
    if (!event) return res.status(204).send();

    const twitchEventId = messageId; // Use message ID for idempotency
    const streamerId = event.broadcaster_user_id;
    const viewerTwitchId = event.user_id;
    const rewardId = event.reward?.id;

    try {
      // Idempotency check
      const existing = await pool.query(
        'SELECT id FROM twitch_redemption_log WHERE twitch_event_id = $1',
        [twitchEventId]
      );
      if (existing.rows.length > 0) {
        return res.status(204).send(); // Already processed
      }

      // Look up reward config
      const configResult = await pool.query(
        'SELECT coins_per_redeem FROM twitch_reward_configs WHERE streamer_id = $1 AND is_enabled = true',
        [streamerId]
      );
      if (configResult.rows.length === 0) {
        console.log(`No active reward config for streamer ${streamerId}`);
        return res.status(204).send();
      }

      const coinsToGrant = configResult.rows[0].coins_per_redeem;

      // Check if viewer has a StreamCards account
      const viewer = await pool.query('SELECT twitch_id, coins FROM users WHERE twitch_id = $1', [viewerTwitchId]);
      if (viewer.rows.length === 0) {
        console.log(`Viewer ${viewerTwitchId} (${event.user_name}) not registered, skipping`);
        return res.status(204).send();
      }

      // Credit coins in a transaction
      await pool.query('BEGIN');

      await pool.query('UPDATE users SET coins = coins + $1 WHERE twitch_id = $2', [coinsToGrant, viewerTwitchId]);

      const newBalance = (await pool.query('SELECT coins FROM users WHERE twitch_id = $1', [viewerTwitchId])).rows[0].coins;

      await pool.query(
        `INSERT INTO transactions (user_id, type, amount, balance_after, description, reference_type, reference_id)
         VALUES ($1, 'twitch_redemption', $2, $3, $4, 'twitch_redemption', NULL)`,
        [viewerTwitchId, coinsToGrant, newBalance,
         `Channel Points: ${event.reward?.title || 'Reward'} (${event.broadcaster_user_name})`]
      );

      // Log for idempotency
      await pool.query(
        `INSERT INTO twitch_redemption_log (twitch_event_id, streamer_id, viewer_twitch_id, reward_id, coins_granted)
         VALUES ($1, $2, $3, $4, $5)`,
        [twitchEventId, streamerId, viewerTwitchId, rewardId || '', coinsToGrant]
      );

      await pool.query('COMMIT');

      // Notify the viewer
      await createNotification(viewerTwitchId, 'reward', 'Coins recus !',
        `Vous avez recu ${coinsToGrant} coins en echangeant des Channel Points chez ${event.broadcaster_user_name}`,
        { streamerId, coinsGranted: coinsToGrant }
      );

      console.log(`Granted ${coinsToGrant} coins to ${event.user_name} from ${event.broadcaster_user_name}`);
    } catch (err) {
      try { await pool.query('ROLLBACK'); } catch {}
      // If it's a unique constraint violation, it's a duplicate — that's fine
      if (err.code === '23505') {
        return res.status(204).send();
      }
      console.error('Error processing redemption:', err.message);
    }

    return res.status(204).send();
  }

  res.status(204).send();
});

// ─── Streamer config endpoints (JWT auth) ─────────────────────────────

// Middleware: require streamer
async function requireStreamer(req, res, next) {
  const result = await pool.query('SELECT is_streamer FROM users WHERE twitch_id = $1', [req.user.twitchId]);
  if (result.rows.length === 0 || !result.rows[0].is_streamer) {
    return res.status(403).json({ error: 'Streamer access required' });
  }
  next();
}

// GET /api/twitch/eventsub/config
router.get('/config', authenticate, requireStreamer, async (req, res) => {
  try {
    const config = await pool.query(
      'SELECT * FROM twitch_reward_configs WHERE streamer_id = $1',
      [req.user.twitchId]
    );

    const user = await pool.query(
      'SELECT twitch_scopes FROM users WHERE twitch_id = $1',
      [req.user.twitchId]
    );

    const scopes = user.rows[0]?.twitch_scopes || '';
    const hasRequiredScope = scopes.includes('channel:manage:redemptions');

    res.json({
      config: config.rows[0] || null,
      hasRequiredScope,
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch config' });
  }
});

// POST /api/twitch/eventsub/config
router.post('/config', authenticate, requireStreamer, async (req, res) => {
  try {
    const streamerId = req.user.twitchId;
    const { rewardTitle, channelPointsCost, coinsPerRedeem, enable } = req.body;

    // Validate inputs
    const coins = parseInt(coinsPerRedeem) || 100;
    const cpCost = parseInt(channelPointsCost) || 1000;
    const title = (rewardTitle || 'StreamCards Coins').substring(0, 45); // Twitch max 45 chars

    if (coins < 1 || coins > 100000) return res.status(400).json({ error: 'Coins must be 1-100000' });
    if (cpCost < 1 || cpCost > 1000000) return res.status(400).json({ error: 'Channel Points cost must be 1-1000000' });

    if (enable) {
      let rewardId;
      let eventSubId;
      let eventSubType;
      let useMockMode = false;

      // Check scope
      const user = await pool.query(
        'SELECT twitch_scopes, twitch_access_token, twitch_refresh_token FROM users WHERE twitch_id = $1',
        [streamerId]
      );
      const scopes = user.rows[0]?.twitch_scopes || '';

      if (!scopes.includes('channel:manage:redemptions')) {
        const state = crypto.randomBytes(16).toString('hex') + ':scope_upgrade';
        const authUrl = getTwitchAuthUrl(
          process.env.TWITCH_CLIENT_ID,
          process.env.TWITCH_REDIRECT_URI,
          state,
          'user:read:email user:read:follows channel:manage:redemptions channel:read:redemptions'
        );
        return res.json({ needsReauth: true, authUrl });
      }

      let accessToken = user.rows[0]?.twitch_access_token;
      const refreshToken = user.rows[0]?.twitch_refresh_token;

      // Try to create the custom reward on Twitch
      let twitchReward;
      try {
        twitchReward = await createCustomReward(accessToken, streamerId, title, cpCost);
      } catch (err) {
        if (err.response?.status === 401 && refreshToken) {
          try {
            const refreshed = await refreshAccessToken(refreshToken);
            await pool.query(
              'UPDATE users SET twitch_access_token = $1, twitch_refresh_token = $2 WHERE twitch_id = $3',
              [refreshed.accessToken, refreshed.refreshToken, streamerId]
            );
            accessToken = refreshed.accessToken;
            twitchReward = await createCustomReward(accessToken, streamerId, title, cpCost);
          } catch (refreshErr) {
            return res.json({ needsReauth: true, authUrl: getTwitchAuthUrl(
              process.env.TWITCH_CLIENT_ID, process.env.TWITCH_REDIRECT_URI,
              crypto.randomBytes(16).toString('hex') + ':scope_upgrade',
              'user:read:email user:read:follows channel:manage:redemptions channel:read:redemptions'
            )});
          }
        } else if (err.response?.status === 403) {
          // Not affiliate/partner — fall back to mock mode
          console.log(`[MOCK] Streamer ${streamerId} is not affiliate/partner, using mock mode`);
          useMockMode = true;
        } else {
          const apiError = err.response?.data;
          const status = err.response?.status;
          const errorMsg = apiError?.message || err.message;
          console.error('Failed to create Twitch reward:', { status, message: errorMsg, data: apiError });

          let userMessage = 'Failed to create Twitch Channel Points reward';
          if (status === 400) {
            if (errorMsg.includes('CREATE_CUSTOM_REWARD_DUPLICATE_REWARD')) {
              userMessage = 'Une recompense avec ce nom existe deja sur votre chaine. Changez le titre.';
            } else if (errorMsg.includes('CREATE_CUSTOM_REWARD_MAX_PER_BROADCASTER_LIMIT')) {
              userMessage = 'Vous avez atteint la limite de recompenses personnalisees (50 max)';
            } else {
              userMessage = `Configuration invalide: ${errorMsg}`;
            }
          }
          return res.status(400).json({ error: userMessage });
        }
      }

      if (useMockMode) {
        // Non-affiliate: save config with mock IDs, test button available
        rewardId = `mock_reward_${crypto.randomBytes(8).toString('hex')}`;
        eventSubId = `mock_sub_${crypto.randomBytes(8).toString('hex')}`;
        eventSubType = 'channel.channel_points_custom_reward_redemption.add';
      } else {
        // Real affiliate/partner: create EventSub webhook
        const callbackUrl = process.env.TWITCH_WEBHOOK_CALLBACK_URL;
        if (!callbackUrl) {
          return res.status(500).json({ error: 'TWITCH_WEBHOOK_CALLBACK_URL not configured' });
        }

        let eventSubData;
        try {
          eventSubData = await createEventSubSubscription(streamerId, callbackUrl, process.env.TWITCH_EVENTSUB_SECRET);
        } catch (err) {
          console.error('Failed to create EventSub subscription:', err.response?.data || err.message);
          try { await deleteCustomReward(accessToken, streamerId, twitchReward.id); } catch {}
          return res.status(500).json({ error: 'Failed to create webhook subscription' });
        }

        rewardId = twitchReward.id;
        eventSubId = eventSubData.id;
        eventSubType = eventSubData.type;
      }

      // Save to DB
      await pool.query(`
        INSERT INTO twitch_reward_configs (streamer_id, reward_id, reward_title, channel_points_cost, coins_per_redeem, is_enabled)
        VALUES ($1, $2, $3, $4, $5, true)
        ON CONFLICT (streamer_id) DO UPDATE SET
          reward_id = $2, reward_title = $3, channel_points_cost = $4, coins_per_redeem = $5,
          is_enabled = true, updated_at = NOW()
      `, [streamerId, rewardId, title, cpCost, coins]);

      await pool.query(`
        INSERT INTO eventsub_subscriptions (twitch_sub_id, streamer_id, sub_type, status)
        VALUES ($1, $2, $3, 'enabled')
        ON CONFLICT (twitch_sub_id) DO UPDATE SET status = 'enabled', updated_at = NOW()
      `, [eventSubId, streamerId, eventSubType]);

      const config = (await pool.query('SELECT * FROM twitch_reward_configs WHERE streamer_id = $1', [streamerId])).rows[0];
      return res.json({ success: true, config });

    } else {
      // Just update settings (not enabling/disabling)
      await pool.query(`
        INSERT INTO twitch_reward_configs (streamer_id, reward_title, channel_points_cost, coins_per_redeem)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (streamer_id) DO UPDATE SET
          reward_title = $2, channel_points_cost = $3, coins_per_redeem = $4, updated_at = NOW()
      `, [streamerId, title, cpCost, coins]);

      const config = (await pool.query('SELECT * FROM twitch_reward_configs WHERE streamer_id = $1', [streamerId])).rows[0];
      return res.json({ success: true, config });
    }
  } catch (error) {
    console.error('Config update error:', error.message);
    res.status(500).json({ error: 'Failed to update config' });
  }
});

// DELETE /api/twitch/eventsub/config — full cleanup
router.delete('/config', authenticate, requireStreamer, async (req, res) => {
  try {
    const streamerId = req.user.twitchId;

    // Get current config
    const config = await pool.query('SELECT * FROM twitch_reward_configs WHERE streamer_id = $1', [streamerId]);
    if (config.rows.length === 0) return res.json({ success: true });

    const rewardConfig = config.rows[0];

    const isMockReward = rewardConfig.reward_id?.startsWith('mock_') || rewardConfig.reward_id?.startsWith('dev_');

    if (!isMockReward) {
      // Real Twitch reward — clean up via API
      const subs = await pool.query('SELECT twitch_sub_id FROM eventsub_subscriptions WHERE streamer_id = $1', [streamerId]);
      for (const sub of subs.rows) {
        if (!sub.twitch_sub_id.startsWith('mock_') && !sub.twitch_sub_id.startsWith('dev_')) {
          try { await deleteEventSubSubscription(sub.twitch_sub_id); } catch {}
        }
      }

      if (rewardConfig.reward_id) {
        const user = await pool.query('SELECT twitch_access_token, twitch_refresh_token FROM users WHERE twitch_id = $1', [streamerId]);
        let accessToken = user.rows[0]?.twitch_access_token;
        try {
          await deleteCustomReward(accessToken, streamerId, rewardConfig.reward_id);
        } catch (err) {
          if (err.response?.status === 401 && user.rows[0]?.twitch_refresh_token) {
            try {
              const refreshed = await refreshAccessToken(user.rows[0].twitch_refresh_token);
              await pool.query('UPDATE users SET twitch_access_token = $1, twitch_refresh_token = $2 WHERE twitch_id = $3',
                [refreshed.accessToken, refreshed.refreshToken, streamerId]);
              await deleteCustomReward(refreshed.accessToken, streamerId, rewardConfig.reward_id);
            } catch {}
          }
        }
      }
    } else {
      console.log('[MOCK] Skipping Twitch API cleanup for mock reward');
    }

    // Clean DB
    await pool.query('DELETE FROM eventsub_subscriptions WHERE streamer_id = $1', [streamerId]);
    await pool.query('DELETE FROM twitch_reward_configs WHERE streamer_id = $1', [streamerId]);

    res.json({ success: true });
  } catch (error) {
    console.error('Config delete error:', error.message);
    res.status(500).json({ error: 'Failed to delete config' });
  }
});

// GET /api/twitch/eventsub/redemptions — recent redemption log
router.get('/redemptions', authenticate, requireStreamer, async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 20, 50);
    const result = await pool.query(`
      SELECT rl.*, u.display_name as viewer_name, u.profile_image_url as viewer_image
      FROM twitch_redemption_log rl
      LEFT JOIN users u ON u.twitch_id = rl.viewer_twitch_id
      WHERE rl.streamer_id = $1
      ORDER BY rl.processed_at DESC
      LIMIT $2
    `, [req.user.twitchId, limit]);

    res.json({ redemptions: result.rows });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch redemptions' });
  }
});

// ─── Admin-only: simulate a redemption ─────────────────────────────────
{
  router.post('/test-redeem', authenticate, requireStreamer, async (req, res) => {
    try {
      // Admin-only
      const adminCheck = await pool.query('SELECT is_admin FROM users WHERE twitch_id = $1', [req.user.twitchId]);
      if (!adminCheck.rows[0]?.is_admin) {
        return res.status(403).json({ error: 'Admin access required' });
      }

      const streamerId = req.user.twitchId;
      const { viewerTwitchId } = req.body;

      // Check config exists and is enabled
      const configResult = await pool.query(
        'SELECT * FROM twitch_reward_configs WHERE streamer_id = $1 AND is_enabled = true',
        [streamerId]
      );
      if (configResult.rows.length === 0) {
        return res.status(400).json({ error: 'Integration not enabled' });
      }

      const rewardConfig = configResult.rows[0];
      const targetViewer = viewerTwitchId || streamerId; // Default: redeem for yourself

      // Check viewer exists
      const viewer = await pool.query('SELECT twitch_id, display_name, coins FROM users WHERE twitch_id = $1', [targetViewer]);
      if (viewer.rows.length === 0) {
        return res.status(404).json({ error: `User ${targetViewer} not found` });
      }

      const coinsToGrant = rewardConfig.coins_per_redeem;
      const fakeEventId = `test_${crypto.randomBytes(12).toString('hex')}`;

      // Credit coins
      await pool.query('BEGIN');

      await pool.query('UPDATE users SET coins = coins + $1 WHERE twitch_id = $2', [coinsToGrant, targetViewer]);
      const newBalance = (await pool.query('SELECT coins FROM users WHERE twitch_id = $1', [targetViewer])).rows[0].coins;

      await pool.query(
        `INSERT INTO transactions (user_id, type, amount, balance_after, description, reference_type, reference_id)
         VALUES ($1, 'twitch_redemption', $2, $3, $4, 'twitch_redemption', NULL)`,
        [targetViewer, coinsToGrant, newBalance, `[TEST] Channel Points: ${rewardConfig.reward_title}`]
      );

      await pool.query(
        `INSERT INTO twitch_redemption_log (twitch_event_id, streamer_id, viewer_twitch_id, reward_id, coins_granted)
         VALUES ($1, $2, $3, $4, $5)`,
        [fakeEventId, streamerId, targetViewer, rewardConfig.reward_id, coinsToGrant]
      );

      await pool.query('COMMIT');

      await createNotification(targetViewer, 'reward', 'Coins recus !',
        `[TEST] Vous avez recu ${coinsToGrant} coins via Channel Points`,
        { streamerId, coinsGranted: coinsToGrant }
      );

      console.log(`[DEV] Test redemption: +${coinsToGrant} coins to ${viewer.rows[0].display_name || targetViewer}`);

      res.json({
        success: true,
        viewer: viewer.rows[0].display_name || targetViewer,
        coinsGranted: coinsToGrant,
        newBalance,
      });
    } catch (err) {
      try { await pool.query('ROLLBACK'); } catch {}
      console.error('Test redeem error:', err.message);
      res.status(500).json({ error: 'Test redeem failed' });
    }
  });
}

export default router;
