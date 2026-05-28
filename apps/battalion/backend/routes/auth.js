const express = require('express');
const bcrypt = require('bcryptjs');
const { db } = require('../db/db');

const router = express.Router();

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    const [[player]] = await db.execute('SELECT * FROM player WHERE id = 1');
    if (!player) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const match = bcrypt.compareSync(password, player.password_hash);
    if (!match) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Regenerate session to clear any stale IDs and prevent fixation
    req.session.regenerate((err) => {
      if (err) {
        console.error('Session regeneration error:', err);
        return res.status(500).json({ error: 'Internal server error' });
      }

      req.session.playerId = 1;

      // Save session explicitly before sending response to avoid SPA redirect races
      req.session.save((saveErr) => {
        if (saveErr) {
          console.error('Session save error:', saveErr);
          return res.status(500).json({ error: 'Internal server error' });
        }

        res.json({
          success: true,
          player: {
            id: player.id,
            username: player.username,
            level: player.level,
            title: player.title
          }
        });
      });
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/auth/logout
router.post('/logout', (req, res) => {
  try {
    const isProd = process.env.NODE_ENV === 'production';
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ error: 'Failed to logout' });
      }
      // Clear cookie explicitly with matching config
      res.clearCookie('connect.sid', {
        path: '/',
        sameSite: isProd ? 'none' : 'lax',
        secure: isProd,
        httpOnly: true
      });
      res.json({ success: true });
    });
  } catch (err) {
    console.error('Logout error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/auth/check
router.get('/check', async (req, res) => {
  try {
    if (req.session.playerId) {
      const [[player]] = await db.execute('SELECT * FROM player WHERE id = 1');
      res.json({
        authenticated: true,
        player: {
          id: player.id,
          username: player.username,
          level: player.level,
          title: player.title
        }
      });
    } else {
      res.json({ authenticated: false });
    }
  } catch (err) {
    console.error('Auth check error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
