const { db } = require('./db');
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');

// Load the RPG actions data
const jsonPath = path.resolve(__dirname, '../..', 'other', 'everyday-life-rpg-systems.json');
let rpgData = { motives: [], actions: [], categories: [] };
try {
  rpgData = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
  console.log(`📄 Loaded RPG data: ${rpgData.motives.length} motives, ${rpgData.actions.length} actions, ${(rpgData.categories || []).length} categories`);
} catch (err) {
  console.warn('⚠️  Could not load rpg-test-actions.json:', err.message);
}

async function seed() {
  const [[{ cnt }]] = await db.execute('SELECT count(*) as cnt FROM player');

  if (cnt === 0) {
    // Insert player
    const passwordHash = bcrypt.hashSync('battalion2026', 10);
    await db.execute(
      `INSERT INTO player (id, username, password_hash, stat_energy, stat_stress, stat_money, stat_social, stat_health, stat_hygiene, stat_fun, stat_discipline)
       VALUES (1, 'wm', ?, 50, 30, 100, 20, 50, 50, 20, 20)`,
      [passwordHash]
    );

    // Insert sample tasks
    const tasks = [
      ['Make the bed', 'Start the day with order', 'discipline', 'easy', 'daily', 15, 5, 2, 1, 1],
      ['Clean kitchen', 'Keep the kitchen spotless', 'discipline', 'medium', 'daily', 25, 10, 5, 2, 2],
      ['Organize workspace', 'Declutter and organize your desk', 'discipline', 'medium', 'daily', 25, 10, 5, 2, 3],
      ['Exercise 30 min', 'Get moving for at least 30 minutes', 'vitality', 'hard', 'daily', 40, 15, 10, 3, 4],
      ['Drink 8 glasses water', 'Stay hydrated throughout the day', 'vitality', 'easy', 'daily', 15, 5, 2, 1, 5],
      ['Go for a walk', 'Take a walk outside for fresh air', 'vitality', 'easy', 'daily', 15, 5, 2, 1, 6],
      ['Call a friend', 'Reach out to someone you care about', 'social', 'medium', 'daily', 25, 10, 5, 2, 7],
      ['Family time', 'Spend quality time with family', 'social', 'medium', 'daily', 25, 10, 5, 2, 8],
      ['Help someone', 'Do something kind for another person', 'social', 'medium', 'daily', 30, 12, 5, 2, 9],
      ['Read 30 minutes', 'Read a book or educational material', 'intellect', 'medium', 'daily', 25, 10, 5, 2, 10],
      ['Learn something new', 'Study a new topic or skill', 'intellect', 'hard', 'daily', 40, 15, 10, 3, 11],
      ['Solve a puzzle', 'Exercise your brain with puzzles', 'intellect', 'easy', 'daily', 15, 5, 2, 1, 12],
      ['Work on a project', 'Dedicate time to a creative project', 'creativity', 'hard', 'daily', 40, 15, 10, 3, 13],
      ['Write/journal', 'Write in your journal or create content', 'creativity', 'medium', 'daily', 25, 10, 5, 2, 14],
      ['Practice a skill', 'Practice drawing, music, or another skill', 'creativity', 'medium', 'daily', 25, 10, 5, 2, 15],
      ['Review budget', 'Check your finances and spending', 'finance', 'medium', 'weekly', 30, 15, 5, 2, 16],
      ['Work on side hustle', 'Invest time in earning extra income', 'finance', 'hard', 'daily', 40, 20, 10, 3, 17],
      ['Save money', 'Avoid unnecessary spending today', 'finance', 'easy', 'daily', 15, 10, 2, 1, 18],
    ];

    for (const t of tasks) {
      await db.execute(
        `INSERT INTO tasks (name, description, category, difficulty, recurrence, xp_reward, gold_reward, hp_penalty, stat_reward, sort_order)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, t
      );
    }

    // Insert sample habits
    const habits = [
      ['Morning routine', 'positive', 'discipline', '🌅', 20, 8, 2],
      ['Meditation', 'positive', 'vitality', '🧘', 15, 5, 1],
      ['Healthy eating', 'positive', 'vitality', '🥗', 15, 5, 1],
      ['Early to bed', 'positive', 'discipline', '🌙', 20, 8, 2],
      ['Junk food', 'negative', 'vitality', '🍔', 0, 0, 1],
      ['Doomscrolling', 'negative', 'intellect', '📱', 0, 0, 1],
      ['Staying up late', 'negative', 'discipline', '🦉', 0, 0, 1],
      ['Skipping meals', 'negative', 'vitality', '🚫', 0, 0, 1],
    ];

    for (const h of habits) {
      await db.execute(
        `INSERT INTO habits (name, type, category, icon, xp_reward, gold_reward, stat_reward)
         VALUES (?, ?, ?, ?, ?, ?, ?)`, h
      );
    }

    // Insert initial activity feed entry
    await db.execute(
      `INSERT INTO activity_feed (type, message, icon) VALUES ('system', '🎮 Battalion initialized. Your quest begins!', '🎮')`
    );

    console.log('✅ Database seeded successfully with player, tasks, habits, and activity feed.');
  }

  // Seed motives (idempotent)
  const [[{ cnt: motiveCount }]] = await db.execute('SELECT count(*) as cnt FROM motives');
  if (motiveCount === 0 && rpgData.motives.length > 0) {
    for (const m of rpgData.motives) {
      await db.execute(
        `INSERT IGNORE INTO motives (motive_id, label, description) VALUES (?, ?, ?)`,
        [m.id, m.label, m.description || '']
      );
    }
    console.log(`✅ Seeded ${rpgData.motives.length} motives.`);
  } else if (motiveCount > 0) {
    console.log(`ℹ️  Motives already seeded (${motiveCount} found).`);
  }

  // Seed actions (idempotent)
  const [[{ cnt: actionCount }]] = await db.execute('SELECT count(*) as cnt FROM actions');
  if (actionCount === 0 && rpgData.actions.length > 0) {
    for (const a of rpgData.actions) {
      await db.execute(
        `INSERT IGNORE INTO actions (action_id, label, category, related_motives, needs, location, time_of_day, time_minutes, energy_delta, stress_delta, money_delta, social_delta, health_delta, hygiene_delta, fun_delta, discipline_delta, repeatable, prerequisites)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          a.id,
          a.label,
          a.category,
          JSON.stringify(a.related_motives || []),
          JSON.stringify(a.needs || []),
          a.location || 'any',
          JSON.stringify(a.time_of_day || ['any']),
          a.time_minutes || 5,
          a.energy_delta || 0,
          a.stress_delta || 0,
          a.money_delta || 0,
          a.social_delta || 0,
          a.health_delta || 0,
          a.hygiene_delta || 0,
          a.fun_delta || 0,
          a.discipline_delta || 0,
          a.repeatable ? 1 : 0,
          JSON.stringify(a.prerequisites || [])
        ]
      );
    }
    console.log(`✅ Seeded ${rpgData.actions.length} actions.`);
  } else if (actionCount > 0) {
    console.log(`ℹ️  Actions already seeded (${actionCount} found).`);
  }

  // Seed categories (idempotent)
  const [[{ cnt: catCount }]] = await db.execute('SELECT count(*) as cnt FROM categories');
  if (catCount === 0 && rpgData.categories && rpgData.categories.length > 0) {
    for (const c of rpgData.categories) {
      await db.execute(
        `INSERT IGNORE INTO categories (category_id, label) VALUES (?, ?)`,
        [c.id, c.label]
      );
    }
    console.log(`✅ Seeded ${rpgData.categories.length} categories.`);
  } else if (catCount > 0) {
    console.log(`ℹ️  Categories already seeded (${catCount} found).`);
  }
}

module.exports = seed;
