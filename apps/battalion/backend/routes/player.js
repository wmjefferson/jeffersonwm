const express = require('express');
const { db } = require('../db/db');
const { requireAuth } = require('../middleware/auth');
const { generateUniqueSlug } = require('../utils/accountProvisioner');

const router = express.Router();

// All routes require authentication
router.use(requireAuth);

// GET /api/player - Get full player object for active user context
router.get('/', async (req, res) => {
  try {
    const [[player]] = await db.execute('SELECT * FROM player WHERE id = ?', [req.userId]);
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
    const {
      username,
      avatar,
      notifications_enabled,
      notification_interval,
      notification_time,
      is_public,
      slug
    } = req.body;

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
    if (is_public !== undefined) {
      updates.push('is_public = ?');
      values.push(is_public ? 1 : 0);
    }
    if (slug !== undefined) {
      const cleanSlug = await generateUniqueSlug(slug);
      updates.push('slug = ?');
      values.push(cleanSlug);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    updates.push('updated_at = NOW()');
    values.push(req.userId);
    const sql = `UPDATE player SET ${updates.join(', ')} WHERE id = ?`;
    await db.execute(sql, values);

    const [[player]] = await db.execute('SELECT * FROM player WHERE id = ?', [req.userId]);
    const { password_hash, ...playerData } = player;
    res.json(playerData);
  } catch (err) {
    console.error('Update player error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
