const express = require('express');
const { db } = require('../db/db');
const requireAuth = require('../middleware/auth');
const gameEngine = require('../utils/gameEngine');
const { broadcast } = require('../utils/events');

const router = express.Router();

// All routes require authentication
router.use(requireAuth);

// POST /api/minigames/score - Submit a minigame score
router.post('/score', async (req, res) => {
  try {
    const { game, score } = req.body;

    if (!game || !['memory', 'typing', 'trivia'].includes(game)) {
      return res.status(400).json({ error: 'Game must be memory, typing, or trivia' });
    }

    if (score === undefined || typeof score !== 'number') {
      return res.status(400).json({ error: 'Score is required and must be a number' });
    }

    const [[player]] = await db.execute('SELECT * FROM player WHERE id = 1');

    // Calculate rewards
    let xpEarned = Math.floor(score * 0.5);
    const goldEarned = Math.floor(score * 0.3);

    // Apply mood modifier to XP
    xpEarned = Math.floor(xpEarned * player.mood_modifier);

    // Update player
    await db.execute(
      `UPDATE player SET xp = xp + ?, gold = GREATEST(gold + ?, 0), updated_at = NOW() WHERE id = 1`,
      [xpEarned, goldEarned]
    );

    // Insert minigame score
    await db.execute(
      `INSERT INTO minigame_scores (game, score, xp_earned, gold_earned) VALUES (?, ?, ?, ?)`,
      [game, score, xpEarned, goldEarned]
    );

    // Add activity
    await gameEngine.addActivity('minigame', `🎮 ${game} game: scored ${score}!`, '🎮', xpEarned, goldEarned);

    // Check level up
    const levelResult = await gameEngine.checkLevelUp();

    // Get updated player
    const [[updatedPlayer]] = await db.execute('SELECT * FROM player WHERE id = 1');
    const { password_hash, ...playerData } = updatedPlayer;

    res.json({
      success: true,
      rewards: {
        xp: xpEarned,
        gold: goldEarned,
        leveled_up: levelResult.leveled_up,
        new_level: levelResult.new_level,
        new_title: levelResult.new_title
      },
      player: playerData
    });

    broadcast({ type: 'minigame_score', game, score, xpEarned: xpEarned, goldEarned: goldEarned, timestamp: new Date().toISOString() });
  } catch (err) {
    console.error('Submit score error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/minigames/scores - Get top scores
router.get('/scores', async (req, res) => {
  try {
    const [memory] = await db.execute("SELECT * FROM minigame_scores WHERE game = 'memory' ORDER BY score DESC LIMIT 10");
    const [typing] = await db.execute("SELECT * FROM minigame_scores WHERE game = 'typing' ORDER BY score DESC LIMIT 10");
    const [trivia] = await db.execute("SELECT * FROM minigame_scores WHERE game = 'trivia' ORDER BY score DESC LIMIT 10");

    res.json({ memory, typing, trivia });
  } catch (err) {
    console.error('Get scores error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
