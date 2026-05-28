const express = require('express');
const { db } = require('../db/db');

const router = express.Router();

// GET /api/public/dashboard - Comprehensive dashboard (no auth required)
router.get('/dashboard', async (req, res) => {
  try {
    // Player data (omit password_hash)
    const [[player]] = await db.execute('SELECT * FROM player WHERE id = 1');
    let playerData = null;
    if (player) {
      const { password_hash, ...data } = player;
      playerData = data;
    }

    // Recent activity (last 30)
    const [recentActivity] = await db.execute('SELECT * FROM activity_feed ORDER BY created_at DESC LIMIT 30');

    // All active tasks
    const [tasks] = await db.execute('SELECT * FROM tasks WHERE is_active = 1 ORDER BY sort_order, category');

    // All active habits
    const [habits] = await db.execute('SELECT * FROM habits WHERE is_active = 1 ORDER BY type, name');

    // Last 14 days of mood logs
    const [moods] = await db.execute("SELECT * FROM mood_log WHERE logged_at >= DATE_SUB(NOW(), INTERVAL 14 DAY) ORDER BY logged_at DESC");

    // All unlocked achievements
    const [achievements] = await db.execute('SELECT * FROM achievements ORDER BY unlocked_at DESC');

    // Top scores per minigame
    const [memory] = await db.execute("SELECT * FROM minigame_scores WHERE game = 'memory' ORDER BY score DESC LIMIT 5");
    const [typing] = await db.execute("SELECT * FROM minigame_scores WHERE game = 'typing' ORDER BY score DESC LIMIT 5");
    const [trivia] = await db.execute("SELECT * FROM minigame_scores WHERE game = 'trivia' ORDER BY score DESC LIMIT 5");
    const scores = { memory, typing, trivia };

    // Actions system data
    const [actions] = await db.execute('SELECT * FROM actions WHERE is_active = 1 ORDER BY category, label');
    const [actionLog] = await db.execute('SELECT * FROM action_log ORDER BY performed_at DESC LIMIT 30');
    const [motives] = await db.execute('SELECT * FROM motives ORDER BY label');
    const [categories] = await db.execute('SELECT * FROM categories ORDER BY label');

    // Stats
    const [[{ cnt: totalTasks }]] = await db.execute('SELECT count(*) as cnt FROM tasks');
    const totalCompleted = playerData ? playerData.total_tasks_completed : 0;
    const totalFailed = playerData ? playerData.total_tasks_failed : 0;
    const completionRate = totalCompleted + totalFailed > 0
      ? Math.round((totalCompleted / (totalCompleted + totalFailed)) * 100)
      : 0;
    const [[{ max_streak }]] = await db.execute('SELECT MAX(best_streak) as max_streak FROM habits');
    const longestStreak = max_streak || 0;

    res.json({
      player: playerData,
      recentActivity,
      tasks,
      habits,
      moods,
      achievements,
      scores,
      actions,
      actionLog,
      motives,
      categories,
      stats: {
        totalTasks,
        totalCompleted,
        totalFailed,
        completionRate,
        longestStreak
      }
    });
  } catch (err) {
    console.error('Dashboard error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
