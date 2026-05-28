const express = require('express');
const { db } = require('../db/db');
const requireAuth = require('../middleware/auth');
const gameEngine = require('../utils/gameEngine');
const { broadcast } = require('../utils/events');

const router = express.Router();

// All routes require authentication
router.use(requireAuth);

// POST /api/mood - Log a mood
router.post('/', async (req, res) => {
  try {
    const { mood, note } = req.body;

    const validMoods = ['terrible', 'miserable', 'bad', 'unpleasant', 'okay', 'fine', 'good', 'great', 'excellent', 'fantastic'];
    if (!mood || !validMoods.includes(mood)) {
      return res.status(400).json({ error: `Mood must be one of: ${validMoods.join(', ')}` });
    }

    const modifier = gameEngine.getMoodModifier(mood);

    // Update player mood
    await db.execute(
      `UPDATE player SET current_mood = ?, mood_modifier = ?, updated_at = NOW() WHERE id = 1`,
      [mood, modifier]
    );

    // Insert mood log
    await db.execute(
      `INSERT INTO mood_log (mood, note, modifier) VALUES (?, ?, ?)`,
      [mood, note || '', modifier]
    );

    // Mood emoji map
    const moodEmojis = {
      terrible: '😫',
      miserable: '😢',
      bad: '🙁',
      unpleasant: '😒',
      okay: '😐',
      fine: '🙂',
      good: '😊',
      great: '😁',
      excellent: '🤩',
      fantastic: '🥳'
    };

    const emoji = moodEmojis[mood];
    let activityMessage = `${emoji} Mood: ${mood.charAt(0).toUpperCase() + mood.slice(1)}`;
    if (note) {
      activityMessage += ` - ${note}`;
    }

    await gameEngine.addActivity('mood', activityMessage, emoji, 0, 0);

    res.json({ success: true, modifier, mood });

    broadcast({ type: 'mood_changed', mood, modifier, timestamp: new Date().toISOString() });
  } catch (err) {
    console.error('Log mood error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/mood/history - Get mood history
router.get('/history', async (req, res) => {
  try {
    const [moods] = await db.execute('SELECT * FROM mood_log ORDER BY logged_at DESC LIMIT 50');
    res.json(moods);
  } catch (err) {
    console.error('Get mood history error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
