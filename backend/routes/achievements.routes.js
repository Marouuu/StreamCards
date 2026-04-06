import express from 'express';
import { pool } from '../config/database.js';
import { authenticate } from '../middleware/auth.js';
import { checkAchievements } from '../utils/achievements.js';

const router = express.Router();

// GET /api/achievements — all achievements with user progress
router.get('/', authenticate, async (req, res) => {
  try {
    const userId = req.user.twitchId;

    const result = await pool.query(`
      SELECT a.*,
        CASE WHEN ua.id IS NOT NULL THEN true ELSE false END AS unlocked,
        ua.unlocked_at
      FROM achievements a
      LEFT JOIN user_achievements ua ON ua.achievement_id = a.id AND ua.user_id = $1
      ORDER BY a.category, a.threshold
    `, [userId]);

    // Group by category
    const categories = {};
    for (const ach of result.rows) {
      if (!categories[ach.category]) categories[ach.category] = [];
      categories[ach.category].push(ach);
    }

    const unlockedCount = result.rows.filter(a => a.unlocked).length;
    const totalCount = result.rows.length;

    res.json({ achievements: result.rows, categories, unlockedCount, totalCount });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/achievements/check — manually trigger achievement check
router.post('/check', authenticate, async (req, res) => {
  try {
    const unlocked = await checkAchievements(req.user.twitchId);
    res.json({ unlocked });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/achievements/user/:userId — public view of someone's achievements
router.get('/user/:userId', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT a.id, a.key, a.title, a.icon, a.category, ua.unlocked_at
      FROM user_achievements ua
      JOIN achievements a ON ua.achievement_id = a.id
      WHERE ua.user_id = $1
      ORDER BY ua.unlocked_at DESC
    `, [req.params.userId]);

    res.json({ achievements: result.rows });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
