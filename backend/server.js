import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { pool } from './config/database.js';
import authRoutes from './routes/auth.routes.js';
import cardsRoutes from './routes/cards.routes.js';
import shopRoutes from './routes/shop.routes.js';
import userRoutes from './routes/user.routes.js';
import packsRoutes from './routes/packs.routes.js';
import adminRoutes from './routes/admin.routes.js';
import marketplaceRoutes from './routes/marketplace.routes.js';
import leaderboardRoutes from './routes/leaderboard.routes.js';
import rewardsRoutes from './routes/rewards.routes.js';
import tradeRoutes from './routes/trade.routes.js';
import notificationsRoutes from './routes/notifications.routes.js';
import profileRoutes from './routes/profile.routes.js';
import collectionProgressRoutes from './routes/collection-progress.routes.js';
import historyRoutes from './routes/history.routes.js';
import achievementsRoutes from './routes/achievements.routes.js';
import analyticsRoutes from './routes/analytics.routes.js';
import auctionsRoutes from './routes/auctions.routes.js';
import friendsRoutes from './routes/friends.routes.js';
import twitchEventSubRoutes from './routes/twitch-eventsub.routes.js';

// Get current directory for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env file from backend directory
dotenv.config({ path: join(__dirname, '.env') });

const app = express();
const PORT = process.env.PORT || 5000;
const isProduction = process.env.NODE_ENV === 'production';

// Trust proxy for Render (needed for rate limiting behind reverse proxy)
if (isProduction) {
  app.set('trust proxy', 1);
}

// Security middleware
app.use(helmet({
  contentSecurityPolicy: false, // Let frontend handle CSP
  crossOriginEmbedderPolicy: false,
}));

const allowedOrigins = [
  process.env.FRONTEND_URL || 'http://localhost:5173',
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, Twitch webhooks, etc.)
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
}));

// Global rate limit: 100 requests per minute per IP
const globalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later' },
});
app.use('/api/', globalLimiter);

// Strict rate limit for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: 'Too many auth attempts, please try again later' },
});
app.use('/api/auth', authLimiter);

// Strict rate limit for messaging
const messageLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  message: { error: 'Too many messages, slow down' },
});
app.use('/api/friends/messages', messageLimiter);

// Capture raw body for Twitch webhook signature verification
app.use(express.json({
  limit: '1mb',
  verify: (req, res, buf) => {
    if (req.originalUrl === '/api/twitch/eventsub/callback') {
      req.rawBody = buf;
    }
  },
}));
app.use(express.urlencoded({ extended: true }));

// Routes
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'StreamCards API is running' });
});

// Test database connection (dev only)
if (!isProduction) {
  app.get('/api/test-db', async (req, res) => {
    try {
      const result = await pool.query('SELECT NOW()');
      res.json({ status: 'ok', message: 'Database connected', time: result.rows[0].now });
    } catch (error) {
      res.status(500).json({ status: 'error', message: error.message });
    }
  });
}

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/cards', cardsRoutes);
app.use('/api/shop', shopRoutes);
app.use('/api/user', userRoutes);
app.use('/api/packs', packsRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/marketplace', marketplaceRoutes);
app.use('/api/leaderboard', leaderboardRoutes);
app.use('/api/rewards', rewardsRoutes);
app.use('/api/trades', tradeRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/collection-progress', collectionProgressRoutes);
app.use('/api/history', historyRoutes);
app.use('/api/achievements', achievementsRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/auctions', auctionsRoutes);
app.use('/api/friends', friendsRoutes);
app.use('/api/twitch/eventsub', twitchEventSubRoutes);

// Global error handler — prevents leaking internal errors to clients
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on http://0.0.0.0:${PORT}`);
});

