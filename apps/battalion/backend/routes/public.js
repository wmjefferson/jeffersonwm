const express = require('express');
const { db } = require('../db/db');
const { resolveSessionPlayer } = require('../middleware/auth');

const router = express.Router();

// GET /api/public/dashboard - Public dashboard for any user profile
router.get('/dashboard', async (req, res) => {
  try {
    const userParam = req.query.user || req.query.u;
    const resolvedSession = await resolveSessionPlayer(req);

    let targetPlayer = null;

    if (userParam) {
      const [[found]] = await db.execute(
        'SELECT * FROM player WHERE slug = ? OR username = ? OR id = ? LIMIT 1',
        [userParam, userParam, isNaN(userParam) ? -1 : Number(userParam)]
      );
      targetPlayer = found || null;
    } else if (resolvedSession && resolvedSession.actingPlayer) {
      targetPlayer = resolvedSession.actingPlayer;
    } else {
      // Default to owner profile (id = 1)
      const [[ownerPlayer]] = await db.execute('SELECT * FROM player WHERE id = 1 LIMIT 1');
      targetPlayer = ownerPlayer || null;
    }

    if (!targetPlayer) {
      return res.status(404).json({ error: 'User profile not found' });
    }

    const isSelf = resolvedSession && resolvedSession.player && resolvedSession.player.id === targetPlayer.id;
    const isOwnerView = resolvedSession && resolvedSession.isOwner;

    // Check visibility
    if (!targetPlayer.is_public && !isSelf && !isOwnerView) {
      return res.status(403).json({ error: 'This profile is set to private.' });
    }

    // Player data (omit password_hash)
    const { password_hash, ...playerData } = targetPlayer;

    const targetUserId = targetPlayer.id;

    // Recent activity (last 30 for this user)
    const [recentActivity] = await db.execute(
      'SELECT * FROM activity_feed WHERE user_id = ? ORDER BY created_at DESC LIMIT 30',
      [targetUserId]
    );

    // All active tasks for this user
    const [tasks] = await db.execute(
      'SELECT * FROM tasks WHERE user_id = ? AND is_active = 1 ORDER BY sort_order, category',
      [targetUserId]
    );

    // All active habits for this user
    const [habits] = await db.execute(
      'SELECT * FROM habits WHERE user_id = ? AND is_active = 1 ORDER BY type, name',
      [targetUserId]
    );

    // Last 14 days of mood logs for this user
    const [moods] = await db.execute(
      'SELECT * FROM mood_log WHERE user_id = ? AND logged_at >= DATE_SUB(NOW(), INTERVAL 14 DAY) ORDER BY logged_at DESC',
      [targetUserId]
    );

    // All unlocked achievements for this user
    const [achievements] = await db.execute(
      'SELECT * FROM achievements WHERE user_id = ? ORDER BY unlocked_at DESC',
      [targetUserId]
    );

    // Top scores per minigame for this user
    const [memory] = await db.execute(
      "SELECT * FROM minigame_scores WHERE user_id = ? AND game = 'memory' ORDER BY score DESC LIMIT 5",
      [targetUserId]
    );
    const [typing] = await db.execute(
      "SELECT * FROM minigame_scores WHERE user_id = ? AND game = 'typing' ORDER BY score DESC LIMIT 5",
      [targetUserId]
    );
    const [trivia] = await db.execute(
      "SELECT * FROM minigame_scores WHERE user_id = ? AND game = 'trivia' ORDER BY score DESC LIMIT 5",
      [targetUserId]
    );
    const scores = { memory, typing, trivia };

    // Actions system data (actions taxonomy is global, log is user-scoped)
    const [actions] = await db.execute('SELECT * FROM actions WHERE is_active = 1 ORDER BY category, label');
    const [actionLog] = await db.execute(
      'SELECT * FROM action_log WHERE user_id = ? ORDER BY performed_at DESC LIMIT 30',
      [targetUserId]
    );
    const [motives] = await db.execute('SELECT * FROM motives ORDER BY label');
    const [categories] = await db.execute('SELECT * FROM categories ORDER BY label');

    // Stats
    const [[{ cnt: totalTasks }]] = await db.execute(
      'SELECT count(*) as cnt FROM tasks WHERE user_id = ?',
      [targetUserId]
    );
    const totalCompleted = playerData.total_tasks_completed || 0;
    const totalFailed = playerData.total_tasks_failed || 0;
    const completionRate = totalCompleted + totalFailed > 0
      ? Math.round((totalCompleted / (totalCompleted + totalFailed)) * 100)
      : 0;
    const [[{ max_streak }]] = await db.execute(
      'SELECT MAX(best_streak) as max_streak FROM habits WHERE user_id = ?',
      [targetUserId]
    );
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
      },
      meta: {
        isSelf: Boolean(isSelf),
        isOwnerView: Boolean(isOwnerView),
        is_master_template: Boolean(targetPlayer.is_master_template)
      }
    });
  } catch (err) {
    console.error('Dashboard error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
