const express = require('express');
const { db } = require('../db/db');
const { requireAuth, requireAdmin, requireOwner } = require('../middleware/auth');
const { getMasterTemplate, logTemplateChange } = require('../utils/accountProvisioner');

const router = express.Router();

// All template routes require authentication and at least admin
router.use(requireAuth);
router.use(requireAdmin);

// GET /api/template - Get current master startup template & recent changelog
router.get('/', async (req, res) => {
  try {
    const templateData = await getMasterTemplate();
    const [changelog] = await db.execute(
      'SELECT * FROM template_changelog ORDER BY created_at DESC LIMIT 50'
    );

    const { password_hash, ...safePlayer } = templateData.templatePlayer;

    res.json({
      template: {
        player: safePlayer,
        tasks: templateData.tasks,
        habits: templateData.habits
      },
      changelog
    });
  } catch (err) {
    console.error('Get template error:', err);
    res.status(500).json({ error: 'Failed to retrieve master template' });
  }
});

// GET /api/template/changelog - Get full changelog
router.get('/changelog', async (req, res) => {
  try {
    const [changelog] = await db.execute(
      'SELECT * FROM template_changelog ORDER BY created_at DESC'
    );
    res.json(changelog);
  } catch (err) {
    console.error('Get template changelog error:', err);
    res.status(500).json({ error: 'Failed to retrieve template changelog' });
  }
});

// GET /api/template/export - Export full template JSON and changelog
router.get('/export', async (req, res) => {
  try {
    const templateData = await getMasterTemplate();
    const [changelog] = await db.execute(
      'SELECT * FROM template_changelog ORDER BY created_at DESC'
    );

    const { password_hash, ...safePlayer } = templateData.templatePlayer;
    const latestVersion = changelog[0]?.version || '1.0.0';

    const payload = {
      exported_at: new Date().toISOString(),
      exported_by: req.player.username || 'wm',
      version: latestVersion,
      template: {
        player: safePlayer,
        tasks: templateData.tasks,
        habits: templateData.habits
      },
      changelog
    };

    const filename = `battalion_template_${latestVersion}_${new Date().toISOString().slice(0, 10)}.json`;
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.json(payload);
  } catch (err) {
    console.error('Export template error:', err);
    res.status(500).json({ error: 'Failed to export master template' });
  }
});

// PUT /api/template - Update template defaults (Preferred Admin only)
router.put('/', requireOwner, async (req, res) => {
  try {
    const { stats, tasks, habits, change_summary, version } = req.body;
    const summary = change_summary || 'Updated Master Startup Template';

    const { templatePlayer } = await getMasterTemplate();
    const templateId = templatePlayer.id;

    const diffDetails = {};

    // 1. Update stats if provided
    if (stats && typeof stats === 'object') {
      const allowedStats = [
        'stat_energy', 'stat_stress', 'stat_money', 'stat_social',
        'stat_health', 'stat_hygiene', 'stat_fun', 'stat_discipline',
        'level', 'hp', 'max_hp', 'gold', 'title', 'avatar'
      ];
      const updates = [];
      const values = [];
      diffDetails.stats_changed = {};

      for (const key of allowedStats) {
        if (stats[key] !== undefined) {
          updates.push(`${key} = ?`);
          values.push(stats[key]);
          diffDetails.stats_changed[key] = {
            before: templatePlayer[key],
            after: stats[key]
          };
        }
      }

      if (updates.length > 0) {
        updates.push('updated_at = NOW()');
        values.push(templateId);
        await db.execute(
          `UPDATE player SET ${updates.join(', ')} WHERE id = ?`,
          values
        );
      }
    }

    // 2. Update starter tasks if provided
    if (Array.isArray(tasks)) {
      diffDetails.tasks_count_before = (await db.execute('SELECT count(*) as cnt FROM tasks WHERE user_id = ?', [templateId]))[0][0].cnt;
      diffDetails.tasks_count_after = tasks.length;

      // Delete existing template tasks
      await db.execute('DELETE FROM tasks WHERE user_id = ?', [templateId]);

      // Insert new template tasks
      for (let i = 0; i < tasks.length; i++) {
        const t = tasks[i];
        await db.execute(`
          INSERT INTO tasks (
            user_id, name, description, category, difficulty, recurrence,
            xp_reward, gold_reward, hp_penalty, stat_reward, is_active,
            sort_order
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          templateId,
          t.name,
          t.description || '',
          t.category || 'discipline',
          t.difficulty || 'medium',
          t.recurrence || 'daily',
          t.xp_reward ?? 25,
          t.gold_reward ?? 10,
          t.hp_penalty ?? 5,
          t.stat_reward ?? 2,
          t.is_active !== undefined ? (t.is_active ? 1 : 0) : 1,
          t.sort_order ?? i + 1
        ]);
      }
    }

    // 3. Update starter habits if provided
    if (Array.isArray(habits)) {
      diffDetails.habits_count_before = (await db.execute('SELECT count(*) as cnt FROM habits WHERE user_id = ?', [templateId]))[0][0].cnt;
      diffDetails.habits_count_after = habits.length;

      // Delete existing template habits
      await db.execute('DELETE FROM habits WHERE user_id = ?', [templateId]);

      // Insert new template habits
      for (const h of habits) {
        await db.execute(`
          INSERT INTO habits (
            user_id, name, type, category, icon, xp_reward, gold_reward,
            stat_reward, is_active
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          templateId,
          h.name,
          h.type || 'positive',
          h.category || 'discipline',
          h.icon || '⭐',
          h.xp_reward ?? 15,
          h.gold_reward ?? 5,
          h.stat_reward ?? 1,
          h.is_active !== undefined ? (h.is_active ? 1 : 0) : 1
        ]);
      }
    }

    // 4. Log change in changelog
    const logResult = await logTemplateChange({
      changed_by: req.player.username || 'wm',
      change_summary: summary,
      details: diffDetails,
      version: version || null
    });

    const updatedTemplate = await getMasterTemplate();
    const { password_hash, ...safePlayer } = updatedTemplate.templatePlayer;

    res.json({
      success: true,
      message: 'Master Startup Template updated successfully',
      version: logResult.version,
      changelog_id: logResult.id,
      template: {
        player: safePlayer,
        tasks: updatedTemplate.tasks,
        habits: updatedTemplate.habits
      }
    });
  } catch (err) {
    console.error('Update template error:', err);
    res.status(500).json({ error: 'Failed to update master template' });
  }
});

module.exports = router;
