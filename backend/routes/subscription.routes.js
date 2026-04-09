import express from 'express';
import Stripe from 'stripe';
import { pool } from '../config/database.js';
import { authenticate } from '../middleware/auth.js';
import { getPremiumStatus } from '../middleware/premium.js';
import { getStreamsInfo } from '../services/twitchApi.js';

const router = express.Router();

// Initialize Stripe (lazy — only when keys are set)
function getStripe() {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error('Stripe is not configured. Set STRIPE_SECRET_KEY in .env');
  }
  return new Stripe(process.env.STRIPE_SECRET_KEY);
}

// ============================================================
// Streamer tier pricing
// ============================================================
const STREAMER_TIERS = [
  { tier: 'small',      maxViewers: 50,   label: 'Petit streamer (< 50 viewers)',       priceCents: 300  },
  { tier: 'medium',     maxViewers: 200,  label: 'Streamer moyen (50-200 viewers)',      priceCents: 700  },
  { tier: 'large',      maxViewers: 500,  label: 'Grand streamer (200-500 viewers)',     priceCents: 1200 },
  { tier: 'enterprise', maxViewers: Infinity, label: 'Top streamer (500+ viewers)',      priceCents: 2000 },
];

function getStreamerTierByViewers(avgViewers) {
  for (const t of STREAMER_TIERS) {
    if (avgViewers < t.maxViewers) return t;
  }
  return STREAMER_TIERS[STREAMER_TIERS.length - 1];
}

function getStripePriceId(tier) {
  const map = {
    small: process.env.STRIPE_STREAMER_PRICE_ID_SMALL,
    medium: process.env.STRIPE_STREAMER_PRICE_ID_MEDIUM,
    large: process.env.STRIPE_STREAMER_PRICE_ID_LARGE,
    enterprise: process.env.STRIPE_STREAMER_PRICE_ID_ENTERPRISE,
  };
  return map[tier] || null;
}

// ============================================================
// GET /api/subscription/status
// ============================================================
router.get('/status', authenticate, async (req, res) => {
  try {
    const status = await getPremiumStatus(req.user.twitchId);
    res.json(status);
  } catch (error) {
    console.error('Error getting subscription status:', error);
    res.status(500).json({ error: 'Failed to get subscription status' });
  }
});

// ============================================================
// GET /api/subscription/streamer-tier
// Calculates the streamer's tier based on Twitch average viewers
// ============================================================
router.get('/streamer-tier', authenticate, async (req, res) => {
  try {
    // Get the user's Twitch access token from DB
    const userResult = await pool.query(
      'SELECT twitch_access_token, is_streamer FROM users WHERE twitch_id = $1',
      [req.user.twitchId]
    );
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    if (!userResult.rows[0].is_streamer) {
      return res.status(403).json({ error: 'Only streamers can view tier pricing' });
    }

    const accessToken = userResult.rows[0].twitch_access_token;
    const clientId = process.env.TWITCH_CLIENT_ID;

    // Get current stream info to check viewer count
    let avgViewers = 0;
    try {
      const streams = await getStreamsInfo(accessToken, clientId, [req.user.twitchId]);
      if (streams.length > 0) {
        avgViewers = streams[0].viewer_count || 0;
      }
    } catch {
      // If we can't get stream data, default to smallest tier
    }

    const tierInfo = getStreamerTierByViewers(avgViewers);
    res.json({
      currentViewers: avgViewers,
      tier: tierInfo.tier,
      label: tierInfo.label,
      priceCents: tierInfo.priceCents,
      priceFormatted: `${(tierInfo.priceCents / 100).toFixed(2)} EUR`,
      allTiers: STREAMER_TIERS.map(t => ({
        tier: t.tier,
        label: t.label,
        priceCents: t.priceCents,
        priceFormatted: `${(t.priceCents / 100).toFixed(2)} EUR`,
      })),
    });
  } catch (error) {
    console.error('Error calculating streamer tier:', error);
    res.status(500).json({ error: 'Failed to calculate streamer tier' });
  }
});

// ============================================================
// POST /api/subscription/create-checkout
// Body: { type: 'viewer_premium' | 'streamer_premium' }
// ============================================================
router.post('/create-checkout', authenticate, async (req, res) => {
  try {
    const stripe = getStripe();
    const { type } = req.body;

    if (!type || !['viewer_premium', 'streamer_premium'].includes(type)) {
      return res.status(400).json({ error: 'Invalid subscription type' });
    }

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';

    // Get or create Stripe customer
    const userResult = await pool.query(
      'SELECT stripe_customer_id, email, twitch_access_token, is_streamer FROM users WHERE twitch_id = $1',
      [req.user.twitchId]
    );
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = userResult.rows[0];

    // Streamer premium requires streamer status
    if (type === 'streamer_premium' && !user.is_streamer) {
      return res.status(403).json({ error: 'Only approved streamers can subscribe to Streamer Premium' });
    }

    let customerId = user.stripe_customer_id;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email || undefined,
        metadata: {
          twitch_id: req.user.twitchId,
          username: req.user.username,
        },
      });
      customerId = customer.id;
      await pool.query(
        'UPDATE users SET stripe_customer_id = $1 WHERE twitch_id = $2',
        [customerId, req.user.twitchId]
      );
    }

    // Determine the price ID
    let priceId;
    let streamerTier = null;

    if (type === 'viewer_premium') {
      priceId = process.env.STRIPE_VIEWER_PRICE_ID;
      if (!priceId) {
        return res.status(500).json({ error: 'Viewer premium price not configured' });
      }
    } else {
      // Calculate streamer tier
      const clientId = process.env.TWITCH_CLIENT_ID;
      let avgViewers = 0;
      try {
        const streams = await getStreamsInfo(user.twitch_access_token, clientId, [req.user.twitchId]);
        if (streams.length > 0) {
          avgViewers = streams[0].viewer_count || 0;
        }
      } catch {
        // Default to smallest tier
      }

      const tierInfo = getStreamerTierByViewers(avgViewers);
      streamerTier = tierInfo.tier;
      priceId = getStripePriceId(tierInfo.tier);
      if (!priceId) {
        return res.status(500).json({ error: `Streamer premium price not configured for tier: ${tierInfo.tier}` });
      }
    }

    // Create Stripe Checkout Session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${frontendUrl}?subscription=success`,
      cancel_url: `${frontendUrl}?subscription=cancelled`,
      metadata: {
        twitch_id: req.user.twitchId,
        subscription_type: type,
        streamer_tier: streamerTier || '',
      },
    });

    res.json({ checkoutUrl: session.url });
  } catch (error) {
    console.error('Error creating checkout session:', error);
    res.status(500).json({ error: 'Failed to create checkout session' });
  }
});

// ============================================================
// POST /api/subscription/portal
// Creates a Stripe Customer Portal session for managing subscription
// ============================================================
router.post('/portal', authenticate, async (req, res) => {
  try {
    const stripe = getStripe();

    const userResult = await pool.query(
      'SELECT stripe_customer_id FROM users WHERE twitch_id = $1',
      [req.user.twitchId]
    );
    if (userResult.rows.length === 0 || !userResult.rows[0].stripe_customer_id) {
      return res.status(400).json({ error: 'No active subscription found' });
    }

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const session = await stripe.billingPortal.sessions.create({
      customer: userResult.rows[0].stripe_customer_id,
      return_url: frontendUrl,
    });

    res.json({ portalUrl: session.url });
  } catch (error) {
    console.error('Error creating portal session:', error);
    res.status(500).json({ error: 'Failed to create portal session' });
  }
});

// ============================================================
// POST /api/subscription/webhook
// Stripe webhook handler — called with raw body (configured in server.js)
// ============================================================
router.post('/webhook', async (req, res) => {
  const stripe = getStripe();
  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    console.error('STRIPE_WEBHOOK_SECRET not configured');
    return res.status(500).send('Webhook secret not configured');
  }

  let event;
  try {
    event = stripe.webhooks.constructEvent(req.rawBody, sig, webhookSecret);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(event.data.object);
        break;
      case 'invoice.paid':
        await handleInvoicePaid(event.data.object);
        break;
      case 'invoice.payment_failed':
        await handlePaymentFailed(event.data.object);
        break;
      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object);
        break;
      default:
        // Unhandled event type — ignore
        break;
    }
  } catch (error) {
    console.error(`Error handling webhook event ${event.type}:`, error);
  }

  res.json({ received: true });
});

// ============================================================
// Webhook handlers
// ============================================================

async function handleCheckoutCompleted(session) {
  const twitchId = session.metadata?.twitch_id;
  const subscriptionType = session.metadata?.subscription_type;
  const streamerTier = session.metadata?.streamer_tier || null;
  const stripeSubscriptionId = session.subscription;

  if (!twitchId || !subscriptionType || !stripeSubscriptionId) {
    console.error('Missing metadata in checkout session:', session.id);
    return;
  }

  const stripe = getStripe();

  // Get subscription details for period
  const sub = await stripe.subscriptions.retrieve(stripeSubscriptionId);

  // Update user
  await pool.query(
    `UPDATE users SET
       subscription_type = $1,
       subscription_status = 'active',
       subscription_expires_at = to_timestamp($2)
     WHERE twitch_id = $3`,
    [subscriptionType, sub.current_period_end, twitchId]
  );

  // Insert subscription record
  await pool.query(
    `INSERT INTO subscriptions (user_id, stripe_subscription_id, type, streamer_tier, price_cents, status, current_period_start, current_period_end)
     VALUES ($1, $2, $3, $4, $5, 'active', to_timestamp($6), to_timestamp($7))
     ON CONFLICT (stripe_subscription_id) DO UPDATE SET
       status = 'active',
       current_period_start = to_timestamp($6),
       current_period_end = to_timestamp($7),
       updated_at = NOW()`,
    [
      twitchId,
      stripeSubscriptionId,
      subscriptionType,
      streamerTier || null,
      sub.items.data[0]?.price?.unit_amount || 0,
      sub.current_period_start,
      sub.current_period_end,
    ]
  );

  console.log(`Subscription activated for ${twitchId}: ${subscriptionType}`);
}

async function handleInvoicePaid(invoice) {
  const stripeSubscriptionId = invoice.subscription;
  if (!stripeSubscriptionId) return;

  const stripe = getStripe();
  const sub = await stripe.subscriptions.retrieve(stripeSubscriptionId);

  // Update subscription period
  await pool.query(
    `UPDATE subscriptions SET
       status = 'active',
       current_period_start = to_timestamp($1),
       current_period_end = to_timestamp($2)
     WHERE stripe_subscription_id = $3`,
    [sub.current_period_start, sub.current_period_end, stripeSubscriptionId]
  );

  // Update user status
  await pool.query(
    `UPDATE users SET
       subscription_status = 'active',
       subscription_expires_at = to_timestamp($1)
     WHERE stripe_customer_id = $2`,
    [sub.current_period_end, invoice.customer]
  );
}

async function handlePaymentFailed(invoice) {
  const customerId = invoice.customer;
  if (!customerId) return;

  await pool.query(
    "UPDATE users SET subscription_status = 'past_due' WHERE stripe_customer_id = $1",
    [customerId]
  );

  if (invoice.subscription) {
    await pool.query(
      "UPDATE subscriptions SET status = 'past_due' WHERE stripe_subscription_id = $1",
      [invoice.subscription]
    );
  }
}

async function handleSubscriptionDeleted(subscription) {
  const stripeSubscriptionId = subscription.id;

  // Mark subscription as expired
  await pool.query(
    `UPDATE subscriptions SET
       status = 'expired',
       cancelled_at = NOW()
     WHERE stripe_subscription_id = $1`,
    [stripeSubscriptionId]
  );

  // Revert user to free
  await pool.query(
    `UPDATE users SET
       subscription_type = 'free',
       subscription_status = 'expired',
       subscription_expires_at = NULL
     WHERE stripe_customer_id = $1`,
    [subscription.customer]
  );
}

export default router;
