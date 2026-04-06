import express from 'express';
import cors from 'cors';
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

// Get current directory for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env file from backend directory
dotenv.config({ path: join(__dirname, '.env') });

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// Routes
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'StreamCards API is running' });
});

// Test database connection
app.get('/api/test-db', async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW()');
    res.json({ status: 'ok', message: 'Database connected', time: result.rows[0].now });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

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

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});

