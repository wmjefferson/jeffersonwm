const express = require('express');
const bcrypt = require('bcryptjs');
const { db } = require('../db/db');
const { requireAuth, requireOwner, resolveSessionPlayer } = require('../middleware/auth');
const { logAuthHistory } = require('../utils/authLogger');

const router = express.Router();

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    // Lookup user by username or slug
    const [[player]] = await db.execute(
      'SELECT * FROM player WHERE username = ? OR slug = ? LIMIT 1',
      [username, username]
    );

    if (!player) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Prevent direct password login to the master template
    if (player.is_master_template) {
      return res.status(403).json({ error: 'Direct login to master template is disabled. Use Preferred Admin switcher.' });
    }

    if (!player.password_hash) {
      return res.status(401).json({ error: 'Password authentication not configured for this account. Please use Central Auth.' });
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

      req.session.playerId = player.id;
      delete req.session.actingUserId;

      // Save session explicitly before sending response
      req.session.save((saveErr) => {
        if (saveErr) {
          console.error('Session save error:', saveErr);
          return res.status(500).json({ error: 'Internal server error' });
        }

        logAuthHistory('user_login', { userId: player.id, username: player.username }, player.username, player.id);

        res.json({
          success: true,
          player: {
            id: player.id,
            username: player.username,
            slug: player.slug,
            level: player.level,
            title: player.title,
            role: player.role,
            isOwner: player.role === 'owner'
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
    const resolved = await resolveSessionPlayer(req);
    if (resolved && resolved.player) {
      const { player, actingPlayer, isOwner } = resolved;
      res.json({
        authenticated: true,
        player: {
          id: player.id,
          username: player.username,
          slug: player.slug,
          level: player.level,
          title: player.title,
          role: player.role,
          isOwner: player.role === 'owner',
          is_public: Boolean(player.is_public)
        },
        actingPlayer: {
          id: actingPlayer.id,
          username: actingPlayer.username,
          slug: actingPlayer.slug,
          level: actingPlayer.level,
          title: actingPlayer.title,
          role: actingPlayer.role,
          is_master_template: Boolean(actingPlayer.is_master_template),
          is_public: Boolean(actingPlayer.is_public)
        },
        isActing: actingPlayer.id !== player.id,
        isOwner,
        authSource: resolved.authUser ? 'central_auth' : 'local_session',
        authUser: resolved.authUser || null,
        authBaseUrl: 'https://auth.jeffersonwm.com'
      });
    } else {
      res.json({
        authenticated: false,
        authBaseUrl: 'https://auth.jeffersonwm.com'
      });
    }
  } catch (err) {
    console.error('Auth check error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/auth/users - List accounts for Preferred Admin switcher
router.get('/users', requireAuth, requireOwner, async (req, res) => {
  try {
    const [users] = await db.execute(`
      SELECT id, username, slug, role, is_master_template, is_public, level, title, created_at
      FROM player
      ORDER BY is_master_template DESC, (role = 'owner') DESC, id ASC
    `);
    res.json(users);
  } catch (err) {
    console.error('Get users error:', err);
    res.status(500).json({ error: 'Failed to retrieve user accounts' });
  }
});

// POST /api/auth/switch-user - Preferred Admin switches active inspection context
router.post('/switch-user', requireAuth, requireOwner, async (req, res) => {
  try {
    const { userId } = req.body;

    if (userId === null || userId === undefined || Number(userId) === req.player.id) {
      // Revert to owner self
      if (req.session) {
        delete req.session.actingUserId;
        try {
          await new Promise((resolve) => {
            if (typeof req.session.save === 'function') {
              req.session.save(() => resolve());
            } else {
              resolve();
            }
          });
        } catch (_) {}
      }

      const { password_hash, ...safeSelf } = req.player;
      return res.json({
        success: true,
        isActing: false,
        actingUser: safeSelf
      });
    }

    const [[targetPlayer]] = await db.execute(
      'SELECT * FROM player WHERE id = ? LIMIT 1',
      [Number(userId)]
    );

    if (!targetPlayer) {
      return res.status(404).json({ error: 'Target user account not found' });
    }

    if (req.session) {
      req.session.actingUserId = targetPlayer.id;
      try {
        await new Promise((resolve) => {
          if (typeof req.session.save === 'function') {
            req.session.save(() => resolve());
          } else {
            resolve();
          }
        });
      } catch (_) {}
    }

    const { password_hash, ...safeTarget } = targetPlayer;
    res.json({
      success: true,
      isActing: true,
      actingUser: safeTarget
    });
  } catch (err) {
    console.error('Switch user error:', err);
    res.status(500).json({ error: 'Failed to switch user account' });
  }
});

module.exports = router;
