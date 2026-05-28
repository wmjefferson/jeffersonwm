const express = require('express');
const { db } = require('../db/db');
const requireAuth = require('../middleware/auth');
const gameEngine = require('../utils/gameEngine');
const { broadcast } = require('../utils/events');

const router = express.Router();

// All routes require authentication
router.use(requireAuth);

// GET /api/habits - Get all habits
router.get('/', async (req, res) => {
  try {
    const [habits] = await db.execute('SELECT * FROM habits ORDER BY type, name');
    res.json(habits);
  } catch (err) {
    console.error('Get habits error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/habits - Create a new habit
router.post('/', async (req, res) => {
  try {
    const { name, type, category, icon } = req.body;

    if (!name || !type || !category) {
      return res.status(400).json({ error: 'Name, type, and category are required' });
    }

    const [result] = await db.execute(
      `INSERT INTO habits (name, type, category, icon) VALUES (?, ?, ?, ?)`,
      [name, type, category, icon || '⭐']
    );

    const [[habit]] = await db.execute('SELECT * FROM habits WHERE id = ?', [result.insertId]);
    res.status(201).json(habit);
  } catch (err) {
    console.error('Create habit error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/habits/:id - Update a habit
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const [[existing]] = await db.execute('SELECT * FROM habits WHERE id = ?', [id]);
    if (!existing) {
      return res.status(404).json({ error: 'Habit not found' });
    }

    const { name, type, category, icon, is_active } = req.body;
    const updates = [];
    const values = [];

    if (name !== undefined) { updates.push('name = ?'); values.push(name); }
    if (type !== undefined) { updates.push('type = ?'); values.push(type); }
    if (category !== undefined) { updates.push('category = ?'); values.push(category); }
    if (icon !== undefined) { updates.push('icon = ?'); values.push(icon); }
    if (is_active !== undefined) { updates.push('is_active = ?'); values.push(is_active); }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    values.push(id);
    await db.execute(`UPDATE habits SET ${updates.join(', ')} WHERE id = ?`, values);

    const [[habit]] = await db.execute('SELECT * FROM habits WHERE id = ?', [id]);
    res.json(habit);
  } catch (err) {
    console.error('Update habit error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/habits/:id - Delete a habit
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const [[existing]] = await db.execute('SELECT * FROM habits WHERE id = ?', [id]);
    if (!existing) {
      return res.status(404).json({ error: 'Habit not found' });
    }

    await db.execute('DELETE FROM habits WHERE id = ?', [id]);
    res.json({ success: true });
  } catch (err) {
    console.error('Delete habit error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/habits/:id/log - Log a habit occurrence
router.post('/:id/log', async (req, res) => {
  try {
    const { id } = req.params;

    const [[habit]] = await db.execute('SELECT * FROM habits WHERE id = ?', [id]);
    if (!habit) {
      return res.status(404).json({ error: 'Habit not found' });
    }

    const [[player]] = await db.execute('SELECT * FROM player WHERE id = 1');

    let xpEarned = 0;
    let goldEarned = 0;
    let statChange = 0;
    let hpChange = 0;
    let newStreak = habit.current_streak;

    if (habit.type === 'positive') {
      // Calculate rewards
      xpEarned = gameEngine.calculateXP(habit.xp_reward, player.mood_modifier, habit.current_streak);
      goldEarned = habit.gold_reward;
      statChange = habit.stat_reward;

      // Increment streak
      newStreak = habit.current_streak + 1;
      const bestStreak = Math.max(newStreak, habit.best_streak);

      // Update player
      const categoryToStat = { discipline:'stat_discipline', vitality:'stat_health', social:'stat_social', intellect:'stat_discipline', creativity:'stat_fun', finance:'stat_money' };
      const statColumn = categoryToStat[habit.category] || 'stat_discipline';
      const newHp = Math.min(player.hp + 3, player.max_hp);
      hpChange = newHp - player.hp;

      await db.execute(
        `UPDATE player SET
          xp = xp + ?,
          gold = GREATEST(gold + ?, 0),
          ${statColumn} = ${statColumn} + ?,
          hp = ?,
          total_habits_logged = total_habits_logged + 1,
          updated_at = NOW()
        WHERE id = 1`,
        [xpEarned, goldEarned, statChange, newHp]
      );

      // Reward Health XP for positive vitality habits
      if (habit.category === 'vitality') {
        await gameEngine.addHealthXP(xpEarned);
      }

      // Update habit
      await db.execute(
        `UPDATE habits SET
          current_streak = ?,
          best_streak = ?,
          times_logged = times_logged + 1,
          last_logged = NOW()
        WHERE id = ?`,
        [newStreak, bestStreak, id]
      );

      // Add activity
      await gameEngine.addActivity('habit_positive', `🔥 ${habit.name} (streak: ${newStreak})`, '🔥', xpEarned, goldEarned);

    } else if (habit.type === 'negative') {
      // Negative habit logged — penalty (toned down to -3 HP)
      const newHp = Math.max(player.hp - 3, 0);
      hpChange = newHp - player.hp;

      const categoryToStat2 = { discipline:'stat_discipline', vitality:'stat_health', social:'stat_social', intellect:'stat_discipline', creativity:'stat_fun', finance:'stat_money' };
      const statColumn = categoryToStat2[habit.category] || 'stat_discipline';
      // Decrease stat by 1, minimum 0
      const currentStat = player[statColumn];
      statChange = currentStat > 0 ? -1 : 0;

      await db.execute(
        `UPDATE player SET
          ${statColumn} = GREATEST(${statColumn} - 1, 0),
          hp = ?,
          total_habits_logged = total_habits_logged + 1,
          updated_at = NOW()
        WHERE id = 1`,
        [newHp]
      );

      // Reset streak
      newStreak = 0;
      await db.execute(
        `UPDATE habits SET
          current_streak = 0,
          times_logged = times_logged + 1,
          last_logged = NOW()
        WHERE id = ?`,
        [id]
      );

      // Add activity
      await gameEngine.addActivity('habit_negative', `💀 ${habit.name} (streak broken)`, '💀', 0, 0);
    }

    // Insert habit log
    await db.execute(
      `INSERT INTO habit_log (habit_id, habit_name, habit_type, xp_earned, gold_earned, stat_category, stat_change)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, habit.name, habit.type, xpEarned, goldEarned, habit.category, statChange]
    );

    // Check level up (for positive habits)
    let levelResult = { leveled_up: false, new_level: player.level, new_title: player.title };
    if (habit.type === 'positive') {
      levelResult = await gameEngine.checkLevelUp();
    }

    // Check achievements
    const achievementsUnlocked = await gameEngine.checkAchievements();

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
        streak: newStreak,
        leveled_up: levelResult.leveled_up,
        new_level: levelResult.new_level,
        new_title: levelResult.new_title,
        achievements_unlocked: achievementsUnlocked
      },
      player: playerData
    });

    broadcast({ type: 'habit_logged', habitName: habit.name, habitType: habit.type, streak: habit.current_streak + (habit.type === 'positive' ? 1 : 0), timestamp: new Date().toISOString() });
  } catch (err) {
    console.error('Log habit error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
