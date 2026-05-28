const express = require('express');
const router = express.Router();
const { db } = require('../db/db');
const requireAuth = require('../middleware/auth');
const { broadcast } = require('../utils/events');
const { calculateActionImpact } = require('../utils/emotionEngine');

// GET /api/actions — list all actions, optionally filtered
router.get('/', async (req, res) => {
  try {
    const { category, time } = req.query;
    let query = 'SELECT * FROM actions WHERE is_active = 1';
    const params = [];
    if (category) { query += ' AND category = ?'; params.push(category); }
    const [actions] = await db.execute(query + ' ORDER BY category, label', params);
    let filtered = actions;
    if (time) {
      filtered = actions.filter(a => {
        try { const times = typeof a.time_of_day === 'string' ? JSON.parse(a.time_of_day) : (a.time_of_day || ['any']); return times.includes(time) || times.includes('any'); }
        catch { return true; }
      });
    }
    res.json(filtered);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/actions/:actionId/perform — perform an action (auth required)
router.post('/:actionId/perform', requireAuth, async (req, res) => {
  try {
    const [[action]] = await db.execute('SELECT * FROM actions WHERE action_id = ?', [req.params.actionId]);
    if (!action) return res.status(404).json({ error: 'Action not found' });

    const [[player]] = await db.execute('SELECT * FROM player WHERE id = 1');
    const [[latestEmotion]] = await db.execute('SELECT * FROM emotion_log ORDER BY logged_at DESC LIMIT 1');

    const { multiplier, flatBonuses } = await calculateActionImpact(action, latestEmotion || null);

    const clamp = (val, min, max) => Math.max(min, Math.min(max, val));
    
    // Apply Multiplier properly: 
    // Positive mult (>1.0) increases positive gains, decreases negative penalties
    // Negative mult (<1.0) decreases positive gains, increases negative penalties
    const applyMultiplier = (baseDelta, mult) => {
        if (baseDelta > 0) return Math.round(baseDelta * mult);
        if (baseDelta < 0) {
            // Tone down negative impacts: scale linearly using (2.0 - mult) instead of dividing
            // and cap the multiplier factor to avoid extreme spikes in bad moods.
            const factor = Math.max(0.5, Math.min(1.3, 2.0 - mult));
            return Math.round(baseDelta * factor);
        }
        return 0;
    };

    let final_energy_delta = applyMultiplier(action.energy_delta, multiplier) + flatBonuses.energy;
    let final_stress_delta = applyMultiplier(action.stress_delta, multiplier) + flatBonuses.stress; 
    let final_money_delta = applyMultiplier(action.money_delta, multiplier) + flatBonuses.money;
    let final_social_delta = applyMultiplier(action.social_delta, multiplier) + flatBonuses.social;
    let final_health_delta = applyMultiplier(action.health_delta, multiplier) + flatBonuses.health;
    let final_hygiene_delta = applyMultiplier(action.hygiene_delta, multiplier) + flatBonuses.hygiene;
    let final_fun_delta = applyMultiplier(action.fun_delta, multiplier) + flatBonuses.fun;
    let final_discipline_delta = applyMultiplier(action.discipline_delta, multiplier) + flatBonuses.discipline;

    // Remove the `isSevereNegative` clamp because we explicitly want negative actions/emotions to drain points
    // if (action.health_delta >= 0) final_health_delta = Math.max(0, final_health_delta); etc... is now removed.

    const newStats = {
      stat_energy: clamp(player.stat_energy + final_energy_delta, 0, 100),
      stat_stress: clamp(player.stat_stress + final_stress_delta, 0, 100),
      stat_money: player.stat_money + final_money_delta,
      stat_social: clamp(player.stat_social + final_social_delta, 0, 100),
      stat_health: clamp(player.stat_health + final_health_delta, 0, 100),
      stat_hygiene: clamp(player.stat_hygiene + final_hygiene_delta, 0, 100),
      stat_fun: clamp(player.stat_fun + final_fun_delta, 0, 100),
      stat_discipline: clamp(player.stat_discipline + final_discipline_delta, 0, 100)
    };

    // HP: Weighted composite of all category stats (life-sim style)
    const computedHP = Math.round(
      0.25 * newStats.stat_health +
      0.20 * newStats.stat_energy +
      0.15 * newStats.stat_hygiene +
      0.15 * newStats.stat_fun +
      0.10 * newStats.stat_discipline +
      0.10 * newStats.stat_social +
      0.05 * (100 - newStats.stat_stress)
    );
    // Give a small HP direct recovery on positive actions, otherwise use computed HP
    let newHP = clamp(computedHP, 0, 100);
    const baseScore = action.energy_delta - action.stress_delta + action.social_delta + action.health_delta + action.hygiene_delta + action.fun_delta + action.discipline_delta;
    if (baseScore > 0) {
        newHP = clamp(Math.max(newHP, player.hp + 2), 0, 100);
    }

    const timeVal = Math.floor(action.time_minutes / 2);
    
    let rawXP = 0;
    if (baseScore >= 0) {
        rawXP = Math.max(5, (baseScore * 2) + timeVal); // Net Positive Action
    } else {
        // Net Negative Action does not drain XP (stays at zero instead of going backwards)
        rawXP = 0;
    }
    
    // Apply emotion multiplier to XP
    let xpEarned = applyMultiplier(rawXP, multiplier);
    
    // Gold follows XP proportionally (never negative since xpEarned is >= 0)
    let goldEarned = Math.round(xpEarned * 0.4);

    // Update player stats — XP and Gold clamped at 0, HP derived (keeping max_hp intact)
    await db.execute(
      `UPDATE player SET
        stat_energy = ?, stat_stress = ?, stat_money = ?, stat_social = ?,
        stat_health = ?, stat_hygiene = ?, stat_fun = ?, stat_discipline = ?,
        hp = ?,
        xp = GREATEST(xp + ?, 0), gold = GREATEST(gold + ?, 0), total_tasks_completed = total_tasks_completed + 1,
        updated_at = NOW()
      WHERE id = 1`,
      [
        newStats.stat_energy, newStats.stat_stress, newStats.stat_money, newStats.stat_social,
        newStats.stat_health, newStats.stat_hygiene, newStats.stat_fun, newStats.stat_discipline,
        newHP,
        xpEarned, goldEarned
      ]
    );

    // Reward Health XP for healthy actions
    if (baseScore > 0) {
      const isHealthCategory = ['basic_needs', 'food_cooking', 'health_fitness'].includes(action.category);
      if (isHealthCategory || action.health_delta > 0 || action.energy_delta > 0 || action.hygiene_delta > 0) {
        const healthXpEarned = Math.max(5,
          Math.max(0, final_health_delta * 5) +
          Math.max(0, final_energy_delta * 2) +
          Math.max(0, final_hygiene_delta * 2)
        );
        const gameEngine = require('../utils/gameEngine');
        await gameEngine.addHealthXP(healthXpEarned);
      }
    }

    // Update action record
    await db.execute('UPDATE actions SET times_performed = times_performed + 1, last_performed = NOW() WHERE action_id = ?', [action.action_id]);

    // Log the action
    await db.execute(
      `INSERT INTO action_log (action_id, action_label, category, energy_delta, stress_delta, money_delta, social_delta, health_delta, hygiene_delta, fun_delta, discipline_delta)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [action.action_id, action.label, action.category, final_energy_delta, final_stress_delta, final_money_delta, final_social_delta, final_health_delta, final_hygiene_delta, final_fun_delta, final_discipline_delta]
    );

    // Build delta string for activity feed
    const deltaStr = [];
    if (final_energy_delta) deltaStr.push(`⚡${final_energy_delta > 0 ? '+' : ''}${final_energy_delta}`);
    if (final_stress_delta) deltaStr.push(`stress ${final_stress_delta > 0 ? '+' : ''}${final_stress_delta}`);
    if (final_health_delta) deltaStr.push(`hp ${final_health_delta > 0 ? '+' : ''}${final_health_delta}`);
    if (final_hygiene_delta) deltaStr.push(`hyg ${final_hygiene_delta > 0 ? '+' : ''}${final_hygiene_delta}`);
    if (final_discipline_delta) deltaStr.push(`disc ${final_discipline_delta > 0 ? '+' : ''}${final_discipline_delta}`);
    if (final_fun_delta) deltaStr.push(`fun ${final_fun_delta > 0 ? '+' : ''}${final_fun_delta}`);
    if (final_social_delta) deltaStr.push(`soc ${final_social_delta > 0 ? '+' : ''}${final_social_delta}`);
    if (final_money_delta) deltaStr.push(`$ ${final_money_delta > 0 ? '+' : ''}${final_money_delta}`);

    await db.execute(
      'INSERT INTO activity_feed (type, message, icon, xp_earned, gold_earned) VALUES (?, ?, ?, ?, ?)',
      ['action', `${action.label} [${deltaStr.join(' ')}]`, '▸', xpEarned, goldEarned]
    );

    // Check level up
    const gameEngine = require('../utils/gameEngine');
    const levelResult = await gameEngine.checkLevelUp();

    // Broadcast SSE event
    broadcast({
      type: 'action_performed',
      action: action.label,
      category: action.category,
      xpEarned,
      goldEarned,
      timestamp: new Date().toISOString()
    });

    const [[updatedPlayer]] = await db.execute('SELECT * FROM player WHERE id = 1');
    res.json({
      success: true,
      action: action.label,
      xpEarned,
      goldEarned,
      leveledUp: levelResult.leveled_up,
      newLevel: levelResult.new_level,
      player: updatedPlayer
    });
  } catch (err) {
    console.error('Action perform error:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/actions/log — recent action history
router.get('/log', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const [logs] = await db.execute('SELECT * FROM action_log ORDER BY performed_at DESC LIMIT ?', [limit]);
    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/actions/categories — list distinct categories
router.get('/categories', async (req, res) => {
  try {
    const [cats] = await db.execute('SELECT DISTINCT category FROM actions WHERE is_active = 1 ORDER BY category');
    res.json(cats.map(c => c.category));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/actions/log/:id/undo — undo a single action log entry
router.post('/log/:id/undo', requireAuth, async (req, res) => {
  try {
    const [[logEntry]] = await db.execute('SELECT * FROM action_log WHERE id = ?', [req.params.id]);
    if (!logEntry) return res.status(404).json({ error: 'Log entry not found' });

    const clamp = (val, min, max) => Math.max(min, Math.min(max, val));
    const [[player]] = await db.execute('SELECT * FROM player WHERE id = 1');

    // Reverse the deltas
    const newStats = {
      stat_energy: clamp(player.stat_energy - logEntry.energy_delta, 0, 100),
      stat_stress: clamp(player.stat_stress - logEntry.stress_delta, 0, 100),
      stat_money: player.stat_money - logEntry.money_delta,
      stat_social: clamp(player.stat_social - logEntry.social_delta, 0, 100),
      stat_health: clamp(player.stat_health - logEntry.health_delta, 0, 100),
      stat_hygiene: clamp(player.stat_hygiene - logEntry.hygiene_delta, 0, 100),
      stat_fun: clamp(player.stat_fun - logEntry.fun_delta, 0, 100),
      stat_discipline: clamp(player.stat_discipline - logEntry.discipline_delta, 0, 100)
    };

    // Estimate XP/gold that was earned (same formula as perform)
    const posDeltas = [logEntry.energy_delta, -logEntry.stress_delta, logEntry.money_delta, logEntry.social_delta, logEntry.health_delta, logEntry.hygiene_delta, logEntry.fun_delta, logEntry.discipline_delta].filter(d => d > 0).length;
    const xpToRemove = Math.max(5, posDeltas * 5 + Math.floor((logEntry.time_minutes || 5) / 2));
    const goldToRemove = Math.floor(xpToRemove * 0.4);

    await db.execute(
      `UPDATE player SET
        stat_energy = ?, stat_stress = ?, stat_money = ?, stat_social = ?,
        stat_health = ?, stat_hygiene = ?, stat_fun = ?, stat_discipline = ?,
        xp = GREATEST(xp - ?, 0), gold = GREATEST(gold - ?, 0),
        total_tasks_completed = GREATEST(total_tasks_completed - 1, 0),
        updated_at = NOW()
      WHERE id = 1`,
      [
        newStats.stat_energy, newStats.stat_stress, newStats.stat_money, newStats.stat_social,
        newStats.stat_health, newStats.stat_hygiene, newStats.stat_fun, newStats.stat_discipline,
        xpToRemove, goldToRemove
      ]
    );

    // Delete the log entry
    await db.execute('DELETE FROM action_log WHERE id = ?', [req.params.id]);

    // Add undo activity
    await db.execute(
      'INSERT INTO activity_feed (type, message, icon, xp_earned, gold_earned) VALUES (?, ?, ?, ?, ?)',
      ['undo', `⟲ Undone: ${logEntry.action_label}`, '⟲', -xpToRemove, -goldToRemove]
    );

    // Decrement action perform count
    await db.execute('UPDATE actions SET times_performed = GREATEST(times_performed - 1, 0) WHERE action_id = ?', [logEntry.action_id]);

    broadcast({ type: 'action_undone', action: logEntry.action_label, timestamp: new Date().toISOString() });

    const [[updatedPlayer]] = await db.execute('SELECT * FROM player WHERE id = 1');
    const { password_hash, ...playerData } = updatedPlayer;

    res.json({ success: true, action_label: logEntry.action_label, player: playerData });
  } catch (err) {
    console.error('Undo action error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/actions — create a new action
router.post('/', requireAuth, async (req, res) => {
  try {
    const { label, category, energy_delta, stress_delta, money_delta, social_delta, health_delta, hygiene_delta, fun_delta, discipline_delta, time_minutes, location, time_of_day, repeatable, related_motives, needs, prerequisites } = req.body;
    if (!label || !category) return res.status(400).json({ error: 'Label and category are required' });
    const action_id = label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
    const [[existing]] = await db.execute('SELECT action_id FROM actions WHERE action_id = ?', [action_id]);
    if (existing) return res.status(409).json({ error: 'Action with this ID already exists' });
    await db.execute(
      `INSERT INTO actions (action_id, label, category, energy_delta, stress_delta, money_delta, social_delta, health_delta, hygiene_delta, fun_delta, discipline_delta, time_minutes, location, time_of_day, repeatable, related_motives, needs, prerequisites)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        action_id, label, category, energy_delta||0, stress_delta||0, money_delta||0, social_delta||0, health_delta||0, hygiene_delta||0, fun_delta||0, discipline_delta||0,
        time_minutes||5, location||'any', JSON.stringify(time_of_day||['any']), repeatable?1:0, JSON.stringify(related_motives||[]), JSON.stringify(needs||[]), JSON.stringify(prerequisites||[])
      ]
    );
    const [[created]] = await db.execute('SELECT * FROM actions WHERE action_id = ?', [action_id]);
    res.json(created);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT /api/actions/:actionId — update an action
router.put('/:actionId', requireAuth, async (req, res) => {
  try {
    const [[existing]] = await db.execute('SELECT * FROM actions WHERE action_id = ?', [req.params.actionId]);
    if (!existing) return res.status(404).json({ error: 'Action not found' });
    const d = req.body;
    await db.execute(
      `UPDATE actions SET label=?, category=?, energy_delta=?, stress_delta=?, money_delta=?, social_delta=?, health_delta=?, hygiene_delta=?, fun_delta=?, discipline_delta=?, time_minutes=?, location=?, time_of_day=?, repeatable=? WHERE action_id=?`,
      [
        d.label??existing.label, d.category??existing.category,
        d.energy_delta??existing.energy_delta, d.stress_delta??existing.stress_delta, d.money_delta??existing.money_delta, d.social_delta??existing.social_delta,
        d.health_delta??existing.health_delta, d.hygiene_delta??existing.hygiene_delta, d.fun_delta??existing.fun_delta, d.discipline_delta??existing.discipline_delta,
        d.time_minutes??existing.time_minutes, d.location??existing.location,
        d.time_of_day ? JSON.stringify(d.time_of_day) : (typeof existing.time_of_day === 'string' ? existing.time_of_day : JSON.stringify(existing.time_of_day)),
        d.repeatable!==undefined ? (d.repeatable?1:0) : existing.repeatable,
        req.params.actionId
      ]
    );
    const [[updated]] = await db.execute('SELECT * FROM actions WHERE action_id = ?', [req.params.actionId]);
    res.json(updated);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE /api/actions/:actionId — delete an action
router.delete('/:actionId', requireAuth, async (req, res) => {
  try {
    const [[existing]] = await db.execute('SELECT action_id FROM actions WHERE action_id = ?', [req.params.actionId]);
    if (!existing) return res.status(404).json({ error: 'Action not found' });
    await db.execute('DELETE FROM actions WHERE action_id = ?', [req.params.actionId]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
