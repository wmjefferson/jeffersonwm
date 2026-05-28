const express = require('express');
const { db } = require('../db/db');
const requireAuth = require('../middleware/auth');

const router = express.Router();

// All routes require authentication
router.use(requireAuth);

// GET /api/player - Get full player object
router.get('/', async (req, res) => {
  try {
    const [[player]] = await db.execute('SELECT * FROM player WHERE id = 1');
    if (!player) {
      return res.status(404).json({ error: 'Player not found' });
    }

    // Omit password_hash
    const { password_hash, ...playerData } = player;
    res.json(playerData);
  } catch (err) {
    console.error('Get player error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/player - Update player fields
router.put('/', async (req, res) => {
  try {
    const { username, avatar, notifications_enabled, notification_interval, notification_time } = req.body;
    const updates = [];
    const values = [];

    if (username !== undefined) {
      updates.push('username = ?');
      values.push(username);
    }
    if (avatar !== undefined) {
      updates.push('avatar = ?');
      values.push(avatar);
    }
    if (notifications_enabled !== undefined) {
      updates.push('notifications_enabled = ?');
      values.push(notifications_enabled ? 1 : 0);
    }
    if (notification_interval !== undefined) {
      updates.push('notification_interval = ?');
      values.push(notification_interval);
    }
    if (notification_time !== undefined) {
      updates.push('notification_time = ?');
      values.push(notification_time);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    updates.push('updated_at = NOW()');
    const sql = `UPDATE player SET ${updates.join(', ')} WHERE id = 1`;
    await db.execute(sql, values);

    const [[player]] = await db.execute('SELECT * FROM player WHERE id = 1');
    const { password_hash, ...playerData } = player;
    res.json(playerData);
  } catch (err) {
    console.error('Update player error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
