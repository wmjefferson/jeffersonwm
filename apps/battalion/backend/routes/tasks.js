const express = require('express');
const { db } = require('../db/db');
const requireAuth = require('../middleware/auth');
const gameEngine = require('../utils/gameEngine');
const { broadcast } = require('../utils/events');

const router = express.Router();

// All routes require authentication
router.use(requireAuth);

// GET /api/tasks - Get all tasks
router.get('/', async (req, res) => {
  try {
    const [tasks] = await db.execute('SELECT * FROM tasks ORDER BY sort_order, category');
    res.json(tasks);
  } catch (err) {
    console.error('Get tasks error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/tasks - Create a new task
router.post('/', async (req, res) => {
  try {
    const { name, description, category, difficulty, recurrence, xp_reward, gold_reward, hp_penalty, stat_reward } = req.body;

    if (!name || !category) {
      return res.status(400).json({ error: 'Name and category are required' });
    }

    const [result] = await db.execute(
      `INSERT INTO tasks (name, description, category, difficulty, recurrence, xp_reward, gold_reward, hp_penalty, stat_reward)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [name, description || '', category, difficulty || 'medium', recurrence || 'daily', xp_reward || 25, gold_reward || 10, hp_penalty || 5, stat_reward || 2]
    );

    const [[task]] = await db.execute('SELECT * FROM tasks WHERE id = ?', [result.insertId]);
    res.status(201).json(task);
  } catch (err) {
    console.error('Create task error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/tasks/:id - Update a task
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const [[existing]] = await db.execute('SELECT * FROM tasks WHERE id = ?', [id]);
    if (!existing) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const { name, description, category, difficulty, recurrence, xp_reward, gold_reward, hp_penalty, stat_reward, is_active, sort_order } = req.body;
    const updates = [];
    const values = [];

    if (name !== undefined) { updates.push('name = ?'); values.push(name); }
    if (description !== undefined) { updates.push('description = ?'); values.push(description); }
    if (category !== undefined) { updates.push('category = ?'); values.push(category); }
    if (difficulty !== undefined) { updates.push('difficulty = ?'); values.push(difficulty); }
    if (recurrence !== undefined) { updates.push('recurrence = ?'); values.push(recurrence); }
    if (xp_reward !== undefined) { updates.push('xp_reward = ?'); values.push(xp_reward); }
    if (gold_reward !== undefined) { updates.push('gold_reward = ?'); values.push(gold_reward); }
    if (hp_penalty !== undefined) { updates.push('hp_penalty = ?'); values.push(hp_penalty); }
    if (stat_reward !== undefined) { updates.push('stat_reward = ?'); values.push(stat_reward); }
    if (is_active !== undefined) { updates.push('is_active = ?'); values.push(is_active); }
    if (sort_order !== undefined) { updates.push('sort_order = ?'); values.push(sort_order); }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    values.push(id);
    await db.execute(`UPDATE tasks SET ${updates.join(', ')} WHERE id = ?`, values);

    const [[task]] = await db.execute('SELECT * FROM tasks WHERE id = ?', [id]);
    res.json(task);
  } catch (err) {
    console.error('Update task error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/tasks/:id - Delete a task
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const [[existing]] = await db.execute('SELECT * FROM tasks WHERE id = ?', [id]);
    if (!existing) {
      return res.status(404).json({ error: 'Task not found' });
    }

    await db.execute('DELETE FROM tasks WHERE id = ?', [id]);
    res.json({ success: true });
  } catch (err) {
    console.error('Delete task error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/tasks/:id/complete - Complete, fail, or skip a task
router.post('/:id/complete', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!status || !['completed', 'failed', 'skipped'].includes(status)) {
      return res.status(400).json({ error: 'Status must be completed, failed, or skipped' });
    }

    const [[task]] = await db.execute('SELECT * FROM tasks WHERE id = ?', [id]);
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const [[player]] = await db.execute('SELECT * FROM player WHERE id = 1');

    let xpEarned = 0;
    let goldEarned = 0;
    let hpChange = 0;
    let statChange = 0;
    let levelResult = { leveled_up: false, new_level: player.level, new_title: player.title };
    let achievementsUnlocked = [];

    if (status === 'completed') {
      // Calculate rewards
      xpEarned = gameEngine.calculateXP(task.xp_reward, player.mood_modifier, 0);
      goldEarned = task.gold_reward;
      statChange = task.stat_reward;

      // Map old task categories to new stat columns
      const categoryToStat = {
        discipline: 'stat_discipline',
        vitality: 'stat_health',
        social: 'stat_social',
        intellect: 'stat_discipline',
        creativity: 'stat_fun',
        finance: 'stat_money'
      };
      const statColumn = categoryToStat[task.category] || 'stat_discipline';
      const newHp = Math.min(player.hp + 5, player.max_hp);
      hpChange = newHp - player.hp;

      await db.execute(
        `UPDATE player SET
          xp = xp + ?,
          gold = GREATEST(gold + ?, 0),
          ${statColumn} = ${statColumn} + ?,
          hp = ?,
          total_tasks_completed = total_tasks_completed + 1,
          updated_at = NOW()
        WHERE id = 1`,
        [xpEarned, goldEarned, statChange, newHp]
      );

      // Reward Health XP for completing vitality tasks
      if (task.category === 'vitality') {
        await gameEngine.addHealthXP(xpEarned);
      }

      // Update task
      await db.execute(
        `UPDATE tasks SET
          is_completed_today = 1,
          times_completed = times_completed + 1,
          last_completed = NOW()
        WHERE id = ?`,
        [id]
      );

      // Log task completion
      await db.execute(
        `INSERT INTO task_log (task_id, task_name, status, xp_earned, gold_earned, hp_change, stat_category, stat_change)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, task.name, 'completed', xpEarned, goldEarned, hpChange, task.category, statChange]
      );

      // Add activity
      await gameEngine.addActivity('task_complete', `✅ Completed: ${task.name}`, '✅', xpEarned, goldEarned);

      // Check level up
      levelResult = await gameEngine.checkLevelUp();

      // Check achievements
      achievementsUnlocked = await gameEngine.checkAchievements();

    } else if (status === 'failed') {
      // Apply HP penalty (toned down by 50%)
      const penalty = Math.round(task.hp_penalty * 0.5);
      const newHp = Math.max(player.hp - penalty, 0);
      hpChange = newHp - player.hp;

      const isBurnout = newHp <= 0 ? 1 : 0;

      await db.execute(
        `UPDATE player SET
          hp = ?,
          total_tasks_failed = total_tasks_failed + 1,
          is_burnout = ?,
          updated_at = NOW()
        WHERE id = 1`,
        [newHp, isBurnout]
      );

      // Update task
      await db.execute(
        `UPDATE tasks SET
          is_completed_today = 1,
          times_failed = times_failed + 1
        WHERE id = ?`,
        [id]
      );

      // Log task failure
      await db.execute(
        `INSERT INTO task_log (task_id, task_name, status, hp_change) VALUES (?, ?, ?, ?)`,
        [id, task.name, 'failed', hpChange]
      );

      // Add activity
      await gameEngine.addActivity('task_failed', `❌ Failed: ${task.name}`, '❌', 0, 0);

      // Check burnout
      if (isBurnout) {
        await gameEngine.addActivity('burnout', '🔥 BURNOUT! HP has reached 0. Take care of yourself!', '🔥', 0, 0);
      }

    } else if (status === 'skipped') {
      // Apply half HP penalty (toned down by 50%)
      const penalty = Math.round((task.hp_penalty / 2) * 0.5);
      const newHp = Math.max(player.hp - penalty, 0);
      hpChange = newHp - player.hp;

      await db.execute(
        'UPDATE player SET hp = ?, updated_at = NOW() WHERE id = 1',
        [newHp]
      );

      // Update task
      await db.execute(
        'UPDATE tasks SET is_completed_today = 1 WHERE id = ?',
        [id]
      );

      // Log task skip
      await db.execute(
        `INSERT INTO task_log (task_id, task_name, status, hp_change) VALUES (?, ?, ?, ?)`,
        [id, task.name, 'skipped', hpChange]
      );

      // Add activity
      await gameEngine.addActivity('task_skipped', `⏭️ Skipped: ${task.name}`, '⏭️', 0, 0);
    }

    // Get updated player
    const [[updatedPlayer]] = await db.execute('SELECT * FROM player WHERE id = 1');
    const { password_hash, ...playerData } = updatedPlayer;

    res.json({
      success: true,
      rewards: {
        xp: xpEarned,
        gold: goldEarned,
        hp_change: hpChange,
        stat_change: statChange,
        leveled_up: levelResult.leveled_up,
        new_level: levelResult.new_level,
        new_title: levelResult.new_title,
        achievements_unlocked: achievementsUnlocked
      },
      player: playerData
    });

    broadcast({ type: 'task_action', action: status, taskName: task.name, xp: xpEarned, gold: goldEarned, timestamp: new Date().toISOString() });
  } catch (err) {
    console.error('Complete task error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/tasks/reset-daily - Reset daily tasks
router.post('/reset-daily', async (req, res) => {
  try {
    await db.execute("UPDATE tasks SET is_completed_today = 0 WHERE recurrence = 'daily'");
    await gameEngine.addActivity('system', '🔄 Daily tasks reset!', '🔄', 0, 0);
    broadcast({ type: 'reset_daily', timestamp: new Date().toISOString() });
    res.json({ success: true });
  } catch (err) {
    console.error('Reset daily tasks error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/tasks/clear?mode=3days|all - Clear historical data
router.post('/clear', requireAuth, async (req, res) => {
  try {
    const { mode, revert_stats } = req.query;
    const shouldRevert = revert_stats === 'true';

    let intervalStr = null;
    let labelStr = null;
    if (mode === '1hour') {
      intervalStr = '1 HOUR';
      labelStr = 'last 1 hour';
    } else if (mode === '6hours') {
      intervalStr = '6 HOUR';
      labelStr = 'last 6 hours';
    } else if (mode === '3days') {
      intervalStr = '3 DAY';
      labelStr = 'last 3 days';
    }

    if (intervalStr) {
      // If reverting stats, sum deltas from action_log for the period and reverse them
      if (shouldRevert) {
        const [[sums]] = await db.execute(`SELECT
          COALESCE(SUM(energy_delta), 0) as e, COALESCE(SUM(stress_delta), 0) as s,
          COALESCE(SUM(money_delta), 0) as m, COALESCE(SUM(social_delta), 0) as so,
          COALESCE(SUM(health_delta), 0) as h, COALESCE(SUM(hygiene_delta), 0) as hy,
          COALESCE(SUM(fun_delta), 0) as f, COALESCE(SUM(discipline_delta), 0) as d,
          COUNT(*) as cnt
          FROM action_log WHERE performed_at >= DATE_SUB(NOW(), INTERVAL ${intervalStr})`);

        if (sums.cnt > 0) {
          await db.execute(
            `UPDATE player SET
              stat_energy = GREATEST(stat_energy - ?, 0), stat_stress = GREATEST(stat_stress - ?, 0),
              stat_money = stat_money - ?, stat_social = GREATEST(stat_social - ?, 0),
              stat_health = GREATEST(stat_health - ?, 0), stat_hygiene = GREATEST(stat_hygiene - ?, 0),
              stat_fun = GREATEST(stat_fun - ?, 0), stat_discipline = GREATEST(stat_discipline - ?, 0),
              xp = GREATEST(xp - (? * 10), 0), gold = GREATEST(gold - (? * 4), 0),
              total_tasks_completed = GREATEST(total_tasks_completed - ?, 0),
              updated_at = NOW() WHERE id = 1`,
            [sums.e, sums.s, sums.m, sums.so, sums.h, sums.hy, sums.f, sums.d, sums.cnt, sums.cnt, sums.cnt]
          );
        }
      }

      await db.execute(`DELETE FROM activity_feed WHERE created_at >= DATE_SUB(NOW(), INTERVAL ${intervalStr})`);
      await db.execute(`DELETE FROM action_log WHERE performed_at >= DATE_SUB(NOW(), INTERVAL ${intervalStr})`);
      await db.execute(`DELETE FROM task_log WHERE completed_at >= DATE_SUB(NOW(), INTERVAL ${intervalStr})`);
      await db.execute(`DELETE FROM habit_log WHERE logged_at >= DATE_SUB(NOW(), INTERVAL ${intervalStr})`);
      await db.execute(`DELETE FROM mood_log WHERE logged_at >= DATE_SUB(NOW(), INTERVAL ${intervalStr})`);

      // Reset completed today tasks in this range
      try {
        const [completedTasks] = await db.execute(`SELECT DISTINCT task_id FROM task_log WHERE completed_at >= DATE_SUB(NOW(), INTERVAL ${intervalStr}) AND status = 'completed'`);
        for (const t of completedTasks) {
          if (t.task_id) {
            await db.execute('UPDATE tasks SET is_completed_today = 0 WHERE id = ?', [t.task_id]);
          }
        }
      } catch (e) {
        console.error('Resetting completed tasks status error:', e);
      }

      const msg = shouldRevert ? `🗑️ Cleared ${labelStr} + reverted stats` : `🗑️ Cleared ${labelStr} of history`;
      await gameEngine.addActivity('system', msg, '🗑️', 0, 0);

    } else if (mode === 'all') {
      await db.execute("DELETE FROM activity_feed");
      await db.execute("DELETE FROM action_log");
      await db.execute("DELETE FROM task_log");
      await db.execute("DELETE FROM habit_log");
      await db.execute("DELETE FROM mood_log");
      await db.execute("UPDATE tasks SET is_completed_today = 0, times_completed = 0, times_failed = 0");
      await db.execute("UPDATE habits SET current_streak = 0, times_logged = 0");
      await db.execute("UPDATE actions SET times_performed = 0, last_performed = NULL");

      if (shouldRevert) {
        // Reset player to starting values
        await db.execute(`UPDATE player SET
          xp = 0, gold = 0, level = 1, xp_to_next = 100, title = 'Recruit',
          hp = 100, max_hp = 100,
          health_level = 1, health_xp = 0, health_xp_to_next = 100,
          stat_energy = 50, stat_stress = 50, stat_money = 50, stat_social = 50,
          stat_health = 50, stat_hygiene = 50, stat_fun = 50, stat_discipline = 50,
          total_tasks_completed = 0, total_tasks_failed = 0, total_habits_logged = 0,
          updated_at = NOW() WHERE id = 1`);
        await gameEngine.addActivity('system', '🗑️ Full reset — stats restored to defaults', '🗑️', 0, 0);
      } else {
        await gameEngine.addActivity('system', '🗑️ All history cleared', '🗑️', 0, 0);
      }

    } else {
      return res.status(400).json({ error: 'Invalid mode. Use 1hour, 6hours, 3days or all.' });
    }

    broadcast({ type: 'data_cleared', mode, timestamp: new Date().toISOString() });
    res.json({ success: true, mode, stats_reverted: shouldRevert });
  } catch (err) {
    console.error('Clear data error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
