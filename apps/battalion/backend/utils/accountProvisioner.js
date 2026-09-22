const { db } = require('../db/db');
const { logAuthHistory } = require('./authLogger');

/**
 * Get the Master Startup Template and its starter tasks and habits.
 */
async function getMasterTemplate() {
  const [[templatePlayer]] = await db.execute(
    'SELECT * FROM player WHERE is_master_template = 1 ORDER BY id ASC LIMIT 1'
  );

  if (!templatePlayer) {
    throw new Error('Master Startup Template player record not found');
  }

  const [tasks] = await db.execute(
    'SELECT * FROM tasks WHERE user_id = ? ORDER BY sort_order, category, id',
    [templatePlayer.id]
  );

  const [habits] = await db.execute(
    'SELECT * FROM habits WHERE user_id = ? ORDER BY type, category, id',
    [templatePlayer.id]
  );

  return {
    templatePlayer,
    tasks,
    habits
  };
}

/**
 * Generate a unique slug for a user profile
 */
async function generateUniqueSlug(baseUsername) {
  let slug = String(baseUsername || 'commander')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 50);

  if (!slug) slug = 'commander';

  let candidate = slug;
  let counter = 1;
  while (true) {
    const [[existing]] = await db.execute(
      'SELECT id FROM player WHERE slug = ? LIMIT 1',
      [candidate]
    );
    if (!existing) {
      return candidate;
    }
    candidate = `${slug}-${counter}`;
    counter++;
  }
}

/**
 * Provision a new user account cloned from the Master Startup Template.
 */
async function provisionUserFromMaster({
  authUserId = null,
  username,
  role = 'user',
  slug = null,
  passwordHash = ''
}) {
  // Check if account already exists
  if (authUserId) {
    const [[existing]] = await db.execute(
      'SELECT * FROM player WHERE auth_user_id = ? LIMIT 1',
      [authUserId]
    );
    if (existing) return existing;
  }

  const [[existingByName]] = await db.execute(
    'SELECT * FROM player WHERE username = ? LIMIT 1',
    [username]
  );
  if (existingByName) return existingByName;

  const { templatePlayer, tasks, habits } = await getMasterTemplate();
  const finalSlug = slug ? slug : await generateUniqueSlug(username);

  // Insert cloned player record
  const [insertRes] = await db.execute(`
    INSERT INTO player (
      auth_user_id, username, slug, is_master_template, role, is_public,
      password_hash, title, avatar, stat_energy, stat_stress, stat_money,
      stat_social, stat_health, stat_hygiene, stat_fun, stat_discipline,
      level, hp, max_hp, gold, current_mood, mood_modifier, is_burnout
    ) VALUES (
      ?, ?, ?, 0, ?, 1,
      ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?, ?, 0
    )
  `, [
    authUserId,
    username,
    finalSlug,
    role,
    passwordHash,
    templatePlayer.title || 'Recruit',
    templatePlayer.avatar || 'warrior',
    templatePlayer.stat_energy ?? 50,
    templatePlayer.stat_stress ?? 30,
    templatePlayer.stat_money ?? 100,
    templatePlayer.stat_social ?? 20,
    templatePlayer.stat_health ?? 50,
    templatePlayer.stat_hygiene ?? 50,
    templatePlayer.stat_fun ?? 20,
    templatePlayer.stat_discipline ?? 20,
    templatePlayer.level || 1,
    templatePlayer.hp || 100,
    templatePlayer.max_hp || 100,
    templatePlayer.gold ?? 50,
    templatePlayer.current_mood || 'okay',
    templatePlayer.mood_modifier || '1.00'
  ]);

  const newUserId = insertRes.insertId;

  // Clone starter tasks
  for (const t of tasks) {
    await db.execute(`
      INSERT INTO tasks (
        user_id, name, description, category, difficulty, recurrence,
        xp_reward, gold_reward, hp_penalty, stat_reward, is_active,
        sort_order
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      newUserId,
      t.name,
      t.description,
      t.category,
      t.difficulty,
      t.recurrence,
      t.xp_reward,
      t.gold_reward,
      t.hp_penalty,
      t.stat_reward,
      t.is_active,
      t.sort_order
    ]);
  }

  // Clone starter habits
  for (const h of habits) {
    await db.execute(`
      INSERT INTO habits (
        user_id, name, type, category, icon, xp_reward, gold_reward,
        stat_reward, is_active
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      newUserId,
      h.name,
      h.type,
      h.category,
      h.icon,
      h.xp_reward,
      h.gold_reward,
      h.stat_reward,
      h.is_active
    ]);
  }

  // Add initial activity
  await db.execute(`
    INSERT INTO activity_feed (user_id, type, message, icon)
    VALUES (?, 'system', '⚔️ Welcome to Battalion, Commander! Your quest begins.', '⚔️')
  `, [newUserId]);

  const [[newPlayer]] = await db.execute('SELECT * FROM player WHERE id = ?', [newUserId]);
  return newPlayer;
}

/**
 * Log changes to the Master Startup Template.
 */
async function logTemplateChange({ changed_by, change_summary, details = null, version = null }) {
  let targetVersion = version;
  if (!targetVersion) {
    const [[latest]] = await db.execute(
      'SELECT version FROM template_changelog ORDER BY id DESC LIMIT 1'
    );
    if (latest && latest.version) {
      const parts = latest.version.split('.').map(n => parseInt(n, 10) || 0);
      parts[parts.length - 1] += 1;
      targetVersion = parts.join('.');
    } else {
      targetVersion = '1.0.1';
    }
  }

  const [res] = await db.execute(`
    INSERT INTO template_changelog (version, changed_by, change_summary, details)
    VALUES (?, ?, ?, ?)
  `, [
    targetVersion,
    changed_by || 'wm',
    change_summary,
    details ? JSON.stringify(details) : null
  ]);

  await logAuthHistory(
    'template_update',
    { summary: change_summary, version: targetVersion, changelogId: res.insertId },
    changed_by || 'wm'
  );

  return { id: res.insertId, version: targetVersion };
}

module.exports = {
  getMasterTemplate,
  generateUniqueSlug,
  provisionUserFromMaster,
  logTemplateChange
};
