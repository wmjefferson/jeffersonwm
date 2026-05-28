const express = require('express');
const { db } = require('../db/db');
const { emoDb } = require('../db/db');
const requireAuth = require('../middleware/auth');
const { broadcast } = require('../utils/events');

const router = express.Router();

// GET /api/emotions/categories — list all emotion categories with modifiers
router.get('/categories', async (req, res) => {
  try {
    const [categories] = await emoDb.execute('SELECT * FROM emotion_categories ORDER BY label');
    // Parse JSON fields
    const parsed = categories.map(c => ({
      ...c,
      favored_tags: typeof c.favored_tags === 'string' ? JSON.parse(c.favored_tags) : c.favored_tags,
      avoided_tags: typeof c.avoided_tags === 'string' ? JSON.parse(c.avoided_tags) : c.avoided_tags,
      supported_motives: typeof c.supported_motives === 'string' ? JSON.parse(c.supported_motives) : c.supported_motives,
      opposed_motives: typeof c.opposed_motives === 'string' ? JSON.parse(c.opposed_motives) : c.opposed_motives,
    }));
    res.json(parsed);
  } catch (err) {
    console.error('Get emotion categories error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/emotions — list all individual emotions, optionally filtered by category
router.get('/', async (req, res) => {
  try {
    const { category } = req.query;
    let sql = 'SELECT * FROM emotions ORDER BY category_id, name';
    let params = [];
    if (category) {
      sql = 'SELECT * FROM emotions WHERE category_id = ? ORDER BY name';
      params = [category];
    }
    const [emotions] = await emoDb.execute(sql, params);
    // Parse JSON fields
    const parsed = emotions.map(e => ({
      ...e,
      related_emotions: typeof e.related_emotions === 'string' ? JSON.parse(e.related_emotions) : e.related_emotions,
    }));
    res.json(parsed);
  } catch (err) {
    console.error('Get emotions error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/emotions/current — get player's current active emotion
router.get('/current', requireAuth, async (req, res) => {
  try {
    const [[current]] = await db.execute(
      'SELECT * FROM emotion_log ORDER BY logged_at DESC LIMIT 1'
    );
    if (!current) {
      return res.json({ emotion: null, category: null });
    }
    // Fetch the category data
    const [[cat]] = await emoDb.execute(
      'SELECT * FROM emotion_categories WHERE category_id = ?',
      [current.category_id]
    );
    res.json({
      emotion: current.emotion_name,
      category_id: current.category_id,
      category_label: cat?.label || current.category_id,
      tier: current.tier,
      logged_at: current.logged_at,
      note: current.note
    });
  } catch (err) {
    console.error('Get current emotion error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/emotions/log — log an emotion (sets current feeling)
router.post('/log', requireAuth, async (req, res) => {
  try {
    const { emotion_name, category_id, tier, note } = req.body;

    if (!emotion_name || !category_id) {
      return res.status(400).json({ error: 'emotion_name and category_id are required' });
    }

    const emotionTier = tier || 3;

    // Fetch the category data to get flat modifiers
    const [[cat]] = await emoDb.execute(
      'SELECT * FROM emotion_categories WHERE category_id = ?',
      [category_id]
    );

    if (!cat) {
      return res.status(400).json({ error: 'Invalid category_id' });
    }

    const clamp = (val, min, max) => Math.max(min, Math.min(max, val));
    
    // Get player to apply stats
    const [[player]] = await db.execute('SELECT * FROM player WHERE id = 1');

    // Calculate new stats
    const energyDelta = cat.energy_flat || 0;
    const stressDelta = cat.stress_flat || 0;
    const disciplineDelta = cat.discipline_flat || 0;
    const socialDelta = cat.social_flat || 0;
    const healthDelta = cat.health_flat || 0;
    const funDelta = cat.fun_flat || 0;

    const newStats = {
      stat_energy: clamp(player.stat_energy + energyDelta, 0, 100),
      stat_stress: clamp(player.stat_stress + stressDelta, 0, 100),
      stat_social: clamp(player.stat_social + socialDelta, 0, 100),
      stat_health: clamp(player.stat_health + healthDelta, 0, 100),
      stat_fun: clamp(player.stat_fun + funDelta, 0, 100),
      stat_discipline: clamp(player.stat_discipline + disciplineDelta, 0, 100)
    };

    // Calculate XP based on positive deltas
    const posDeltas = [energyDelta, -stressDelta, socialDelta, healthDelta, funDelta, disciplineDelta].filter(d => d > 0).length;
    // Base XP just for feeling an emotion and logging it
    const xpEarned = Math.max(5, posDeltas * 5); 
    const goldEarned = Math.floor(xpEarned * 0.4);

    // Map emotion to a mood modifier based on category valence
    const positiveCategories = ['accepting_open', 'connected_loving', 'curious', 'tender', 'aliveness_joy', 'courageous_powerful', 'grateful', 'hopeful'];
    const negativeCategories = ['angry_annoyed', 'guilt', 'despair_sad', 'fragile', 'disconnected_numb', 'embarrassed_shame', 'powerless', 'fear', 'stressed_tense', 'unsettled_doubt'];

    let moodValue, moodModifier;
    if (positiveCategories.includes(category_id)) {
      if (emotionTier >= 4) { moodValue = 'great'; moodModifier = 1.2; }
      else if (emotionTier >= 3) { moodValue = 'good'; moodModifier = 1.1; }
      else { moodValue = 'okay'; moodModifier = 1.0; }
    } else if (negativeCategories.includes(category_id)) {
      if (emotionTier >= 4) { moodValue = 'bad'; moodModifier = 0.8; }
      else if (emotionTier >= 3) { moodValue = 'unpleasant'; moodModifier = 0.9; }
      else { moodValue = 'okay'; moodModifier = 1.0; }
    } else {
      moodValue = 'okay'; moodModifier = 1.0;
    }

    // Update player's stats and current_mood
    await db.execute(
      `UPDATE player SET 
        current_mood = ?, mood_modifier = ?, 
        stat_energy = ?, stat_stress = ?, stat_social = ?, stat_health = ?, stat_fun = ?, stat_discipline = ?,
        xp = xp + ?, gold = gold + ?,
        updated_at = NOW() 
      WHERE id = 1`,
      [
        moodValue, moodModifier,
        newStats.stat_energy, newStats.stat_stress, newStats.stat_social, newStats.stat_health, newStats.stat_fun, newStats.stat_discipline,
        xpEarned, goldEarned
      ]
    );

    // Insert into emotion_log
    await db.execute(
      `INSERT INTO emotion_log (emotion_name, category_id, tier, note, energy_delta, stress_delta, discipline_delta, social_delta, health_delta, fun_delta, xp_earned, gold_earned)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [emotion_name, category_id, emotionTier, note || '', energyDelta, stressDelta, disciplineDelta, socialDelta, healthDelta, funDelta, xpEarned, goldEarned]
    );

    // Build delta string for activity feed
    const deltaStr = [];
    if (energyDelta) deltaStr.push(`⚡${energyDelta > 0 ? '+' : ''}${energyDelta}`);
    if (stressDelta) deltaStr.push(`stress ${stressDelta > 0 ? '+' : ''}${stressDelta}`);
    if (healthDelta) deltaStr.push(`hp ${healthDelta > 0 ? '+' : ''}${healthDelta}`);
    if (disciplineDelta) deltaStr.push(`disc ${disciplineDelta > 0 ? '+' : ''}${disciplineDelta}`);
    if (funDelta) deltaStr.push(`fun ${funDelta > 0 ? '+' : ''}${funDelta}`);
    if (socialDelta) deltaStr.push(`soc ${socialDelta > 0 ? '+' : ''}${socialDelta}`);

    // Add to activity feed
    const catLabel = cat.label;
    const emoji = positiveCategories.includes(category_id) ? '💚' : negativeCategories.includes(category_id) ? '💔' : '💭';
    const msgStats = deltaStr.length > 0 ? ` [${deltaStr.join(' ')}]` : '';
    await db.execute(
      `INSERT INTO activity_feed (type, message, icon, xp_earned, gold_earned) VALUES (?, ?, ?, ?, ?)`,
      ['emotion', `${emoji} Feeling: ${emotion_name} (${catLabel})${msgStats}`, emoji, xpEarned, goldEarned]
    );

    // Check level up
    const gameEngine = require('../utils/gameEngine');
    const levelResult = await gameEngine.checkLevelUp();
    const [[updatedPlayer]] = await db.execute('SELECT * FROM player WHERE id = 1');

    // Broadcast
    broadcast({
      type: 'emotion_logged',
      emotion: emotion_name,
      category: catLabel,
      tier: emotionTier,
      mood: moodValue,
      xpEarned,
      goldEarned,
      leveledUp: levelResult.leveled_up,
      newLevel: levelResult.new_level,
      player: updatedPlayer,
      timestamp: new Date().toISOString()
    });

    res.json({
      success: true,
      emotion: emotion_name,
      category_id,
      category_label: catLabel,
      tier: emotionTier,
      mood: moodValue,
      mood_modifier: moodModifier,
      xpEarned,
      goldEarned,
      leveledUp: levelResult.leveled_up,
      newLevel: levelResult.new_level,
      player: updatedPlayer,
      deltas: {
        energy: energyDelta, stress: stressDelta, social: socialDelta, health: healthDelta, fun: funDelta, discipline: disciplineDelta
      }
    });
  } catch (err) {
    console.error('Log emotion error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/emotions/history — recent emotion history
router.get('/history', requireAuth, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const [logs] = await db.execute(
      'SELECT * FROM emotion_log ORDER BY logged_at DESC LIMIT ?',
      [limit]
    );
    res.json(logs);
  } catch (err) {
    console.error('Get emotion history error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Helper to synchronize player mood after deleting logs
async function syncPlayerMood() {
  const [[latestLog]] = await db.execute(
    'SELECT * FROM emotion_log ORDER BY logged_at DESC LIMIT 1'
  );

  let moodValue = 'okay';
  let moodModifier = 1.00;

  if (latestLog) {
    const positiveCategories = ['accepting_open', 'connected_loving', 'curious', 'tender', 'aliveness_joy', 'courageous_powerful', 'grateful', 'hopeful'];
    const negativeCategories = ['angry_annoyed', 'guilt', 'despair_sad', 'fragile', 'disconnected_numb', 'embarrassed_shame', 'powerless', 'fear', 'stressed_tense', 'unsettled_doubt'];
    const category_id = latestLog.category_id;
    const emotionTier = latestLog.tier || 3;

    if (positiveCategories.includes(category_id)) {
      if (emotionTier >= 4) { moodValue = 'great'; moodModifier = 1.2; }
      else if (emotionTier >= 3) { moodValue = 'good'; moodModifier = 1.1; }
    } else if (negativeCategories.includes(category_id)) {
      if (emotionTier >= 4) { moodValue = 'bad'; moodModifier = 0.8; }
      else if (emotionTier >= 3) { moodValue = 'unpleasant'; moodModifier = 0.9; }
    }
  }

  await db.execute(
    `UPDATE player SET current_mood = ?, mood_modifier = ?, updated_at = NOW() WHERE id = 1`,
    [moodValue, moodModifier]
  );

  broadcast({
    type: 'mood_changed',
    mood: moodValue,
    modifier: moodModifier,
    timestamp: new Date().toISOString()
  });
}

// DELETE /api/emotions/log/:id — delete a specific emotion log entry
router.delete('/log/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check if the log exists
    const [[log]] = await db.execute('SELECT * FROM emotion_log WHERE id = ?', [id]);
    if (!log) {
      return res.status(404).json({ error: 'Emotion log not found' });
    }

    // Delete the log
    await db.execute('DELETE FROM emotion_log WHERE id = ?', [id]);

    // Re-sync player mood
    await syncPlayerMood();

    // Broadcast update so client refreshes state if needed
    const [[updatedPlayer]] = await db.execute('SELECT * FROM player WHERE id = 1');
    broadcast({
      type: 'emotion_deleted',
      id,
      player: updatedPlayer,
      timestamp: new Date().toISOString()
    });

    res.json({ success: true });
  } catch (err) {
    console.error('Delete emotion log error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/emotions/log — delete emotion logs in blocks of days
router.delete('/log', requireAuth, async (req, res) => {
  try {
    const days = parseInt(req.query.days);
    if (!days || ![1, 2, 3].includes(days)) {
      return res.status(400).json({ error: 'Invalid days parameter. Must be 1, 2, or 3.' });
    }

    // Delete logs from the last X days
    await db.execute(
      'DELETE FROM emotion_log WHERE logged_at >= NOW() - INTERVAL ? DAY',
      [days]
    );

    // Re-sync player mood
    await syncPlayerMood();

    // Broadcast update
    const [[updatedPlayer]] = await db.execute('SELECT * FROM player WHERE id = 1');
    broadcast({
      type: 'emotions_cleared',
      days,
      player: updatedPlayer,
      timestamp: new Date().toISOString()
    });

    res.json({ success: true });
  } catch (err) {
    console.error('Clear emotion logs error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/emotions — create a new emotion (admin only/requires auth)
router.post('/', requireAuth, async (req, res) => {
  try {
    const {
      name, category_id, tier, intensity_note, brief_description, extended_description, related_emotions,
      discipline_flat, energy_flat, stress_flat, fun_flat, hygiene_flat, social_flat, health_flat, money_flat,
      discipline_delta_mult, energy_delta_mult, stress_delta_mult, fun_delta_mult, hygiene_delta_mult, social_delta_mult, health_delta_mult, money_delta_mult,
      time_minutes_mult
    } = req.body;

    if (!name || !category_id) {
      return res.status(400).json({ error: 'Name and category_id are required' });
    }

    const relEmos = Array.isArray(related_emotions) ? JSON.stringify(related_emotions) : (typeof related_emotions === 'string' ? related_emotions : '[]');

    const [result] = await emoDb.execute(
      `INSERT INTO emotions (
        name, category_id, tier, intensity_note, brief_description, extended_description, related_emotions,
        discipline_flat, energy_flat, stress_flat, fun_flat, hygiene_flat, social_flat, health_flat, money_flat,
        discipline_delta_mult, energy_delta_mult, stress_delta_mult, fun_delta_mult, hygiene_delta_mult, social_delta_mult, health_delta_mult, money_delta_mult,
        time_minutes_mult
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        name, category_id, tier ?? 3, intensity_note || 'moderate', brief_description || null, extended_description || null, relEmos,
        discipline_flat ?? null, energy_flat ?? null, stress_flat ?? null, fun_flat ?? null, hygiene_flat ?? null, social_flat ?? null, health_flat ?? null, money_flat ?? null,
        discipline_delta_mult ?? null, energy_delta_mult ?? null, stress_delta_mult ?? null, fun_delta_mult ?? null, hygiene_delta_mult ?? null, social_delta_mult ?? null, health_delta_mult ?? null, money_delta_mult ?? null,
        time_minutes_mult ?? null
      ]
    );

    res.json({ success: true, id: result.insertId });
  } catch (err) {
    console.error('Create emotion error:', err);
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ error: 'An emotion with this name and category already exists.' });
    }
    res.status(500).json({ error: 'Internal server error: ' + err.message });
  }
});

// PUT /api/emotions/:id — update an existing emotion (admin only/requires auth)
router.put('/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name, category_id, tier, intensity_note, brief_description, extended_description, related_emotions,
      discipline_flat, energy_flat, stress_flat, fun_flat, hygiene_flat, social_flat, health_flat, money_flat,
      discipline_delta_mult, energy_delta_mult, stress_delta_mult, fun_delta_mult, hygiene_delta_mult, social_delta_mult, health_delta_mult, money_delta_mult,
      time_minutes_mult
    } = req.body;

    if (!name || !category_id) {
      return res.status(400).json({ error: 'Name and category_id are required' });
    }

    const relEmos = Array.isArray(related_emotions) ? JSON.stringify(related_emotions) : (typeof related_emotions === 'string' ? related_emotions : '[]');

    const [result] = await emoDb.execute(
      `UPDATE emotions SET
        name = ?, category_id = ?, tier = ?, intensity_note = ?, brief_description = ?, extended_description = ?, related_emotions = ?,
        discipline_flat = ?, energy_flat = ?, stress_flat = ?, fun_flat = ?, hygiene_flat = ?, social_flat = ?, health_flat = ?, money_flat = ?,
        discipline_delta_mult = ?, energy_delta_mult = ?, stress_delta_mult = ?, fun_delta_mult = ?, hygiene_delta_mult = ?, social_delta_mult = ?, health_delta_mult = ?, money_delta_mult = ?,
        time_minutes_mult = ?
      WHERE id = ?`,
      [
        name, category_id, tier ?? 3, intensity_note || 'moderate', brief_description || null, extended_description || null, relEmos,
        discipline_flat ?? null, energy_flat ?? null, stress_flat ?? null, fun_flat ?? null, hygiene_flat ?? null, social_flat ?? null, health_flat ?? null, money_flat ?? null,
        discipline_delta_mult ?? null, energy_delta_mult ?? null, stress_delta_mult ?? null, fun_delta_mult ?? null, hygiene_delta_mult ?? null, social_delta_mult ?? null, health_delta_mult ?? null, money_delta_mult ?? null,
        time_minutes_mult ?? null,
        id
      ]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Emotion not found' });
    }

    res.json({ success: true });
  } catch (err) {
    console.error('Update emotion error:', err);
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ error: 'An emotion with this name and category already exists.' });
    }
    res.status(500).json({ error: 'Internal server error: ' + err.message });
  }
});

// DELETE /api/emotions/:id — delete an emotion (admin only/requires auth)
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const [result] = await emoDb.execute('DELETE FROM emotions WHERE id = ?', [id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Emotion not found' });
    }
    res.json({ success: true });
  } catch (err) {
    console.error('Delete emotion error:', err);
    res.status(500).json({ error: 'Internal server error: ' + err.message });
  }
});

module.exports = router;
