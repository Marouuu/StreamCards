import axios from 'axios';
import crypto from 'crypto';

const TWITCH_EVENTSUB_URL = 'https://api.twitch.tv/helix/eventsub/subscriptions';
const TWITCH_TOKEN_URL = 'https://id.twitch.tv/oauth2/token';
const TWITCH_REWARDS_URL = 'https://api.twitch.tv/helix/channel_points/custom_rewards';

// Cache app access token in memory
let appTokenCache = { token: null, expiresAt: 0 };

/**
 * Get an app-level access token (client credentials grant)
 */
export async function getAppAccessToken() {
  if (appTokenCache.token && Date.now() < appTokenCache.expiresAt) {
    return appTokenCache.token;
  }

  const res = await axios.post(TWITCH_TOKEN_URL, null, {
    params: {
      client_id: process.env.TWITCH_CLIENT_ID,
      client_secret: process.env.TWITCH_CLIENT_SECRET,
      grant_type: 'client_credentials',
    },
  });

  appTokenCache = {
    token: res.data.access_token,
    expiresAt: Date.now() + (res.data.expires_in - 60) * 1000, // refresh 1 min early
  };

  return appTokenCache.token;
}

/**
 * Create an EventSub subscription for channel point redemptions
 */
export async function createEventSubSubscription(broadcasterUserId, callbackUrl, secret) {
  const appToken = await getAppAccessToken();

  const res = await axios.post(TWITCH_EVENTSUB_URL, {
    type: 'channel.channel_points_custom_reward_redemption.add',
    version: '1',
    condition: { broadcaster_user_id: broadcasterUserId },
    transport: {
      method: 'webhook',
      callback: callbackUrl,
      secret: secret,
    },
  }, {
    headers: {
      'Authorization': `Bearer ${appToken}`,
      'Client-Id': process.env.TWITCH_CLIENT_ID,
      'Content-Type': 'application/json',
    },
  });

  return res.data.data[0]; // { id, type, status, ... }
}

/**
 * Delete an EventSub subscription
 */
export async function deleteEventSubSubscription(twitchSubId) {
  const appToken = await getAppAccessToken();

  await axios.delete(TWITCH_EVENTSUB_URL, {
    params: { id: twitchSubId },
    headers: {
      'Authorization': `Bearer ${appToken}`,
      'Client-Id': process.env.TWITCH_CLIENT_ID,
    },
  });
}

/**
 * Verify Twitch webhook signature (HMAC-SHA256)
 */
export function verifyWebhookSignature(secret, messageId, timestamp, rawBody) {
  // Reject timestamps older than 10 minutes (replay protection)
  const now = Math.floor(Date.now() / 1000);
  const ts = Math.floor(new Date(timestamp).getTime() / 1000);
  if (Math.abs(now - ts) > 600) {
    return false;
  }

  const message = messageId + timestamp + rawBody;
  const expectedSig = 'sha256=' + crypto.createHmac('sha256', secret).update(message).digest('hex');

  try {
    return crypto.timingSafeEqual(
      Buffer.from(expectedSig),
      Buffer.from(rawBody.length === 0 ? '' : (messageId ? expectedSig : '')) // fallback
    );
  } catch {
    return false;
  }
}

/**
 * Verify webhook — cleaner version that takes the full signature header
 */
export function verifySignature(secret, messageId, timestamp, body, signature) {
  const now = Math.floor(Date.now() / 1000);
  const ts = Math.floor(new Date(timestamp).getTime() / 1000);
  if (Math.abs(now - ts) > 600) return false;

  const message = messageId + timestamp + body;
  const expected = 'sha256=' + crypto.createHmac('sha256', secret).update(message).digest('hex');

  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  } catch {
    return false;
  }
}

/**
 * Create a custom Channel Points reward on a streamer's channel
 */
export async function createCustomReward(accessToken, broadcasterId, title, cost) {
  const res = await axios.post(TWITCH_REWARDS_URL, {
    title,
    cost,
    is_enabled: true,
    is_user_input_required: false,
    should_redemptions_skip_request_queue: true,
  }, {
    params: { broadcaster_id: broadcasterId },
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Client-Id': process.env.TWITCH_CLIENT_ID,
      'Content-Type': 'application/json',
    },
  });

  return res.data.data[0]; // { id, title, cost, ... }
}

/**
 * Delete a custom Channel Points reward
 */
export async function deleteCustomReward(accessToken, broadcasterId, rewardId) {
  await axios.delete(TWITCH_REWARDS_URL, {
    params: { broadcaster_id: broadcasterId, id: rewardId },
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Client-Id': process.env.TWITCH_CLIENT_ID,
    },
  });
}

/**
 * Refresh an expired OAuth access token
 */
export async function refreshAccessToken(refreshToken) {
  const res = await axios.post(TWITCH_TOKEN_URL, null, {
    params: {
      client_id: process.env.TWITCH_CLIENT_ID,
      client_secret: process.env.TWITCH_CLIENT_SECRET,
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    },
  });

  return {
    accessToken: res.data.access_token,
    refreshToken: res.data.refresh_token,
    scope: res.data.scope,
  };
}
