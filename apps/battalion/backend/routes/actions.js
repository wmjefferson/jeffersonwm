const express = require('express');
const router = express.Router();
const { db } = require('../db/db');
const requireAuth = require('../middleware/auth');
const { broadcast } = require('../utils/events');
const { calculateActionImpact } = require('../utils/emotionEngine');
const { logAuthHistory, resolveAuthUser } = require('../utils/authLogger');
const { resolveSessionPlayer } = require('../middleware/auth');

async function resolveTargetUserId(req) {
  if (req.userId) return req.userId;
  const resolved = await resolveSessionPlayer(req);
  if (resolved?.userId) return resolved.userId;
  if (req.query.user) {
    const [[found]] = await db.execute(
      'SELECT id FROM player WHERE slug = ? OR id = ? OR username = ? LIMIT 1',
      [req.query.user, req.query.user, req.query.user]
    );
    if (found) return found.id;
  }
  return 1;
}

// GET /api/actions — list all actions, optionally filtered (taxonomy is global)
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
        try {
          const times = typeof a.time_of_day === 'string' ? JSON.parse(a.time_of_day) : (a.time_of_day || ['any']);
          return times.includes(time) || times.includes('any');
        } catch { return true; }
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

    const [[player]] = await db.execute('SELECT * FROM player WHERE id = ?', [req.userId]);
    if (!player) return res.status(404).json({ error: 'Player not found' });

    const [[latestEmotion]] = await db.execute(
      'SELECT * FROM emotion_log WHERE user_id = ? ORDER BY logged_at DESC LIMIT 1',
      [req.userId]
    );

    const { multiplier, flatBonuses } = await calculateActionImpact(action, latestEmotion || null);

    const clamp = (val, min, max) => Math.max(min, Math.min(max, val));

    const applyMultiplier = (baseDelta, mult) => {
      if (baseDelta > 0) return Math.round(baseDelta * mult);
      if (baseDelta < 0) {
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

    const computedHP = Math.round(
      0.25 * newStats.stat_health +
      0.20 * newStats.stat_energy +
      0.15 * newStats.stat_hygiene +
      0.15 * newStats.stat_fun +
      0.10 * newStats.stat_discipline +
      0.10 * newStats.stat_social +
      0.05 * (100 - newStats.stat_stress)
    );

    let newHP = clamp(computedHP, 0, 100);
    const baseScore = action.energy_delta - action.stress_delta + action.social_delta + action.health_delta + action.hygiene_delta + action.fun_delta + action.discipline_delta;
    if (baseScore > 0) {
      newHP = clamp(Math.max(newHP, player.hp + 2), 0, 100);
    }

    const timeVal = Math.floor(action.time_minutes / 2);

    let rawXP = 0;
    if (baseScore >= 0) {
      rawXP = Math.max(5, (baseScore * 2) + timeVal);
    } else {
      rawXP = 0;
    }

    let xpEarned = applyMultiplier(rawXP, multiplier);
    let goldEarned = Math.round(xpEarned * 0.4);

    await db.execute(
      `UPDATE player SET
        stat_energy = ?, stat_stress = ?, stat_money = ?, stat_social = ?,
        stat_health = ?, stat_hygiene = ?, stat_fun = ?, stat_discipline = ?,
        hp = ?,
        xp = GREATEST(xp + ?, 0), gold = GREATEST(gold + ?, 0), total_tasks_completed = total_tasks_completed + 1,
        updated_at = NOW()
      WHERE id = ?`,
      [
        newStats.stat_energy, newStats.stat_stress, newStats.stat_money, newStats.stat_social,
        newStats.stat_health, newStats.stat_hygiene, newStats.stat_fun, newStats.stat_discipline,
        newHP,
        xpEarned, goldEarned,
        req.userId
      ]
    );

    if (baseScore > 0) {
      const isHealthCategory = ['basic_needs', 'food_cooking', 'health_fitness'].includes(action.category);
      if (isHealthCategory || action.health_delta > 0 || action.energy_delta > 0 || action.hygiene_delta > 0) {
        const healthXpEarned = Math.max(5,
          Math.max(0, final_health_delta * 5) +
          Math.max(0, final_energy_delta * 2) +
          Math.max(0, final_hygiene_delta * 2)
        );
        const gameEngine = require('../utils/gameEngine');
        await gameEngine.addHealthXP(req.userId, healthXpEarned);
      }
    }

    await db.execute('UPDATE actions SET times_performed = times_performed + 1, last_performed = NOW() WHERE action_id = ?', [action.action_id]);

    await db.execute(
      `INSERT INTO action_log (user_id, action_id, action_label, category, energy_delta, stress_delta, money_delta, social_delta, health_delta, hygiene_delta, fun_delta, discipline_delta)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [req.userId, action.action_id, action.label, action.category, final_energy_delta, final_stress_delta, final_money_delta, final_social_delta, final_health_delta, final_hygiene_delta, final_fun_delta, final_discipline_delta]
    );

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
      'INSERT INTO activity_feed (user_id, type, message, icon, xp_earned, gold_earned) VALUES (?, ?, ?, ?, ?, ?)',
      [req.userId, 'action', `${action.label} [${deltaStr.join(' ')}]`, '▸', xpEarned, goldEarned]
    );

    const gameEngine = require('../utils/gameEngine');
    const levelResult = await gameEngine.checkLevelUp(req.userId);

    broadcast({
      type: 'action_performed',
      action: action.label,
      category: action.category,
      xpEarned,
      goldEarned,
      timestamp: new Date().toISOString()
    });

    const [[updatedPlayer]] = await db.execute('SELECT * FROM player WHERE id = ?', [req.userId]);
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

// GET /api/actions/log/export — export a combined/filtered JSON log of emotions and actions
router.get('/log/export', async (req, res) => {
  try {
    const authUser = await resolveAuthUser(req);
    const targetUserId = await resolveTargetUserId(req);
    const { type = 'all', timeframe = 'all', startDate, endDate } = req.query;

    let actionQuery = 'SELECT * FROM action_log WHERE user_id = ?';
    let emotionQuery = 'SELECT * FROM emotion_log WHERE user_id = ?';
    const actionParams = [targetUserId];
    const emotionParams = [targetUserId];

    if (timeframe === 'today') {
      actionQuery += ' AND performed_at >= CURDATE()';
      emotionQuery += ' AND logged_at >= CURDATE()';
    } else if (timeframe === '7d') {
      actionQuery += ' AND performed_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)';
      emotionQuery += ' AND logged_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)';
    } else if (timeframe === '30d') {
      actionQuery += ' AND performed_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)';
      emotionQuery += ' AND logged_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)';
    }

    if (startDate) {
      actionQuery += ' AND performed_at >= ?';
      actionParams.push(startDate);
      emotionQuery += ' AND logged_at >= ?';
      emotionParams.push(startDate);
    }
    if (endDate) {
      actionQuery += ' AND performed_at <= ?';
      actionParams.push(endDate);
      emotionQuery += ' AND logged_at <= ?';
      emotionParams.push(endDate);
    }

    actionQuery += ' ORDER BY performed_at DESC';
    emotionQuery += ' ORDER BY logged_at DESC';

    let actions = [];
    let emotions = [];

    if (type === 'all' || type === 'actions') {
      const [actionRows] = await db.execute(actionQuery, actionParams);
      actions = actionRows;
    }
    if (type === 'all' || type === 'emotions') {
      const [emotionRows] = await db.execute(emotionQuery, emotionParams);
      emotions = emotionRows;
    }

    const timeline = [];

    actions.forEach(a => {
      timeline.push({
        type: 'action',
        id: a.id,
        timestamp: a.performed_at,
        label: a.action_label,
        category: a.category,
        action_id: a.action_id,
        note: a.note || null,
        deltas: {
          energy: a.energy_delta,
          stress: a.stress_delta,
          money: a.money_delta,
          social: a.social_delta,
          health: a.health_delta,
          hygiene: a.hygiene_delta,
          fun: a.fun_delta,
          discipline: a.discipline_delta
        }
      });
    });

    emotions.forEach(e => {
      timeline.push({
        type: 'emotion',
        id: e.id,
        timestamp: e.logged_at,
        label: e.emotion_name,
        category: e.category_id,
        tier: e.tier,
        note: e.note || null,
        xp_earned: e.xp_earned,
        gold_earned: e.gold_earned,
        deltas: {
          energy: e.energy_delta,
          stress: e.stress_delta,
          discipline: e.discipline_delta,
          social: e.social_delta,
          health: e.health_delta,
          fun: e.fun_delta
        }
      });
    });

    timeline.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    const [[playerRow]] = await db.execute('SELECT * FROM player WHERE id = ?', [targetUserId]);
    let playerSnapshot = null;
    if (playerRow) {
      const { password_hash, ...rest } = playerRow;
      playerSnapshot = rest;
    }

    await logAuthHistory(
      'export_json_log',
      {
        type,
        timeframe,
        target_user_id: targetUserId,
        total_actions: actions.length,
        total_emotions: emotions.length,
        total_events: timeline.length,
        client_ip: req.ip || req.headers['x-forwarded-for'] || 'unknown',
      },
      authUser.username,
      authUser.userId
    );

    const exportPayload = {
      app: 'Battalion',
      version: '1.2.35',
      export_version: '1.0',
      exported_at: new Date().toISOString(),
      exported_by: {
        username: authUser.username,
        role: authUser.role,
        is_owner: authUser.isOwner
      },
      player: playerSnapshot,
      filter: {
        type,
        timeframe,
        start_date: startDate || null,
        end_date: endDate || null
      },
      summary: {
        total_action_logs: actions.length,
        total_emotion_logs: emotions.length,
        total_timeline_events: timeline.length,
        timeframe_start: timeline.length > 0 ? timeline[timeline.length - 1].timestamp : null,
        timeframe_end: timeline.length > 0 ? timeline[0].timestamp : null
      },
      logs: {
        actions,
        emotions
      },
      timeline
    };

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="battalion_log_${new Date().toISOString().slice(0, 10)}.json"`);
    res.json(exportPayload);
  } catch (err) {
    console.error('Export log error:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/actions/log — action history for scoped user
router.get('/log', async (req, res) => {
  try {
    const targetUserId = await resolveTargetUserId(req);
    const { limit, startDate, endDate } = req.query;
    let query = 'SELECT * FROM action_log WHERE user_id = ?';
    const params = [targetUserId];

    if (startDate) {
      query += ' AND performed_at >= ?';
      params.push(startDate);
    }
    if (endDate) {
      query += ' AND performed_at <= ?';
      params.push(endDate);
    }

    query += ' ORDER BY performed_at DESC';

    if (limit !== 'all') {
      const parsedLimit = parseInt(limit) || 50;
      query += ' LIMIT ?';
      params.push(parsedLimit);
    }

    const [logs] = await db.execute(query, params);
    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/actions/log — manually create an action log entry
router.post('/log', requireAuth, async (req, res) => {
  try {
    const {
      action_id,
      action_label,
      category,
      performed_at,
      note,
      energy_delta,
      stress_delta,
      money_delta,
      social_delta,
      health_delta,
      hygiene_delta,
      fun_delta,
      discipline_delta,
      apply_stats = false
    } = req.body;

    let finalActionId = action_id;
    let finalLabel = action_label;
    let finalCat = category;
    let finalDeltas = {
      energy_delta: energy_delta || 0,
      stress_delta: stress_delta || 0,
      money_delta: money_delta || 0,
      social_delta: social_delta || 0,
      health_delta: health_delta || 0,
      hygiene_delta: hygiene_delta || 0,
      fun_delta: fun_delta || 0,
      discipline_delta: discipline_delta || 0
    };

    if (action_id) {
      const [[foundAction]] = await db.execute('SELECT * FROM actions WHERE action_id = ?', [action_id]);
      if (foundAction) {
        finalLabel = finalLabel || foundAction.label;
        finalCat = finalCat || foundAction.category;
        if (energy_delta === undefined) finalDeltas.energy_delta = foundAction.energy_delta || 0;
        if (stress_delta === undefined) finalDeltas.stress_delta = foundAction.stress_delta || 0;
        if (money_delta === undefined) finalDeltas.money_delta = foundAction.money_delta || 0;
        if (social_delta === undefined) finalDeltas.social_delta = foundAction.social_delta || 0;
        if (health_delta === undefined) finalDeltas.health_delta = foundAction.health_delta || 0;
        if (hygiene_delta === undefined) finalDeltas.hygiene_delta = foundAction.hygiene_delta || 0;
        if (fun_delta === undefined) finalDeltas.fun_delta = foundAction.fun_delta || 0;
        if (discipline_delta === undefined) finalDeltas.discipline_delta = foundAction.discipline_delta || 0;
      }
    }

    if (!finalLabel) {
      return res.status(400).json({ error: 'Action label or valid action_id is required' });
    }
    if (!finalActionId) {
      finalActionId = finalLabel.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
    }
    if (!finalCat) {
      finalCat = 'personal';
    }

    try {
      await db.execute('ALTER TABLE action_log ADD COLUMN note TEXT DEFAULT NULL');
    } catch (_) {}

    let insertSql = 'INSERT INTO action_log (user_id, action_id, action_label, category, energy_delta, stress_delta, money_delta, social_delta, health_delta, hygiene_delta, fun_delta, discipline_delta, note';
    let valuesSql = 'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?';
    const params = [
      req.userId,
      finalActionId, finalLabel, finalCat,
      finalDeltas.energy_delta, finalDeltas.stress_delta, finalDeltas.money_delta, finalDeltas.social_delta,
      finalDeltas.health_delta, finalDeltas.hygiene_delta, finalDeltas.fun_delta, finalDeltas.discipline_delta,
      note || null
    ];

    if (performed_at) {
      insertSql += ', performed_at)';
      valuesSql += ', ?)';
      params.push(performed_at);
    } else {
      insertSql += ')';
      valuesSql += ')';
    }

    const [result] = await db.execute(`${insertSql} ${valuesSql}`, params);

    let updatedPlayer = null;
    if (apply_stats) {
      const clamp = (val, min, max) => Math.max(min, Math.min(max, val));
      const [[player]] = await db.execute('SELECT * FROM player WHERE id = ?', [req.userId]);
      if (player) {
        const newStats = {
          stat_energy: clamp(player.stat_energy + finalDeltas.energy_delta, 0, 100),
          stat_stress: clamp(player.stat_stress + finalDeltas.stress_delta, 0, 100),
          stat_money: player.stat_money + finalDeltas.money_delta,
          stat_social: clamp(player.stat_social + finalDeltas.social_delta, 0, 100),
          stat_health: clamp(player.stat_health + finalDeltas.health_delta, 0, 100),
          stat_hygiene: clamp(player.stat_hygiene + finalDeltas.hygiene_delta, 0, 100),
          stat_fun: clamp(player.stat_fun + finalDeltas.fun_delta, 0, 100),
          stat_discipline: clamp(player.stat_discipline + finalDeltas.discipline_delta, 0, 100)
        };
        await db.execute(
          `UPDATE player SET
            stat_energy = ?, stat_stress = ?, stat_money = ?, stat_social = ?,
            stat_health = ?, stat_hygiene = ?, stat_fun = ?, stat_discipline = ?,
            updated_at = NOW()
          WHERE id = ?`,
          [
            newStats.stat_energy, newStats.stat_stress, newStats.stat_money, newStats.stat_social,
            newStats.stat_health, newStats.stat_hygiene, newStats.stat_fun, newStats.stat_discipline,
            req.userId
          ]
        );
        const [[up]] = await db.execute('SELECT * FROM player WHERE id = ?', [req.userId]);
        updatedPlayer = up;
      }
    }

    broadcast({
      type: 'action_logged',
      action: finalLabel,
      category: finalCat,
      performed_at: performed_at || new Date().toISOString(),
      timestamp: new Date().toISOString()
    });

    res.json({
      success: true,
      id: result.insertId,
      action_id: finalActionId,
      action_label: finalLabel,
      category: finalCat,
      performed_at: performed_at || new Date().toISOString(),
      player: updatedPlayer
    });
  } catch (err) {
    console.error('Create action log error:', err);
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
    const [[logEntry]] = await db.execute('SELECT * FROM action_log WHERE id = ? AND user_id = ?', [req.params.id, req.userId]);
    if (!logEntry) return res.status(404).json({ error: 'Log entry not found' });

    const clamp = (val, min, max) => Math.max(min, Math.min(max, val));
    const [[player]] = await db.execute('SELECT * FROM player WHERE id = ?', [req.userId]);

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
      WHERE id = ?`,
      [
        newStats.stat_energy, newStats.stat_stress, newStats.stat_money, newStats.stat_social,
        newStats.stat_health, newStats.stat_hygiene, newStats.stat_fun, newStats.stat_discipline,
        xpToRemove, goldToRemove,
        req.userId
      ]
    );

    await db.execute('DELETE FROM action_log WHERE id = ? AND user_id = ?', [req.params.id, req.userId]);

    await db.execute(
      'INSERT INTO activity_feed (user_id, type, message, icon, xp_earned, gold_earned) VALUES (?, ?, ?, ?, ?, ?)',
      [req.userId, 'undo', `⟲ Undone: ${logEntry.action_label}`, '⟲', -xpToRemove, -goldToRemove]
    );

    await db.execute('UPDATE actions SET times_performed = GREATEST(times_performed - 1, 0) WHERE action_id = ?', [logEntry.action_id]);

    broadcast({ type: 'action_undone', action: logEntry.action_label, timestamp: new Date().toISOString() });

    const [[updatedPlayer]] = await db.execute('SELECT * FROM player WHERE id = ?', [req.userId]);
    const { password_hash, ...playerData } = updatedPlayer;

    res.json({ success: true, action_label: logEntry.action_label, player: playerData });
  } catch (err) {
    console.error('Undo action error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/actions — create a new action (admin or owner only)
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
