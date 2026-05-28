// ─── MySQL Schema Init ──────────────────────────────────────────────
const { db, emoDb } = require('./db');

async function initDatabase() {
  console.log('🔌 Initializing MySQL databases...');

  // ─── Game Data Tables (jeffers4_battact) ──────────────────────────
  await db.execute(`
    CREATE TABLE IF NOT EXISTS player (
      id INT PRIMARY KEY DEFAULT 1,
      username VARCHAR(50) NOT NULL DEFAULT 'Commander',
      password_hash VARCHAR(255) NOT NULL,
      level INT DEFAULT 1,
      xp INT DEFAULT 0,
      xp_to_next INT DEFAULT 100,
      health_level INT DEFAULT 1,
      health_xp INT DEFAULT 0,
      health_xp_to_next INT DEFAULT 100,
      hp INT DEFAULT 100,
      max_hp INT DEFAULT 100,
      gold INT DEFAULT 50,
      stat_energy INT DEFAULT 50,
      stat_stress INT DEFAULT 30,
      stat_money INT DEFAULT 100,
      stat_social INT DEFAULT 20,
      stat_health INT DEFAULT 50,
      stat_hygiene INT DEFAULT 50,
      stat_fun INT DEFAULT 20,
      stat_discipline INT DEFAULT 20,
      title VARCHAR(100) DEFAULT 'Recruit',
      avatar VARCHAR(50) DEFAULT 'warrior',
      total_tasks_completed INT DEFAULT 0,
      total_tasks_failed INT DEFAULT 0,
      total_habits_logged INT DEFAULT 0,
      current_mood VARCHAR(20) DEFAULT 'okay',
      mood_modifier DECIMAL(4,2) DEFAULT 1.00,
      is_burnout TINYINT(1) DEFAULT 0,
      notifications_enabled TINYINT(1) DEFAULT 0,
      notification_interval VARCHAR(20) DEFAULT '2h',
      notification_time VARCHAR(50) DEFAULT '09:00',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  // Migration for existing tables:
  try { await db.execute('ALTER TABLE player ADD COLUMN health_level INT DEFAULT 1'); } catch (e) {}
  try { await db.execute('ALTER TABLE player ADD COLUMN health_xp INT DEFAULT 0'); } catch (e) {}
  try { await db.execute('ALTER TABLE player ADD COLUMN health_xp_to_next INT DEFAULT 100'); } catch (e) {}
  try { await db.execute('ALTER TABLE mood_log MODIFY COLUMN mood VARCHAR(50) NOT NULL'); } catch (e) {}
  try { await db.execute("UPDATE player SET current_mood = 'okay' WHERE current_mood = 'neutral'"); } catch (e) {}
  try { await db.execute('ALTER TABLE player ADD COLUMN notifications_enabled TINYINT(1) DEFAULT 0'); } catch (e) {}
  try { await db.execute("ALTER TABLE player ADD COLUMN notification_interval VARCHAR(20) DEFAULT '2h'"); } catch (e) {}
  try { await db.execute("ALTER TABLE player ADD COLUMN notification_time VARCHAR(50) DEFAULT '09:00'"); } catch (e) {}

  await db.execute(`
    CREATE TABLE IF NOT EXISTS tasks (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      description TEXT DEFAULT NULL,
      category ENUM('discipline','vitality','social','intellect','creativity','finance') NOT NULL,
      difficulty ENUM('easy','medium','hard','epic') NOT NULL DEFAULT 'medium',
      recurrence ENUM('one-time','daily','weekly','monthly') DEFAULT 'daily',
      xp_reward INT DEFAULT 25,
      gold_reward INT DEFAULT 10,
      hp_penalty INT DEFAULT 5,
      stat_reward INT DEFAULT 2,
      is_active TINYINT(1) DEFAULT 1,
      is_completed_today TINYINT(1) DEFAULT 0,
      last_completed DATETIME DEFAULT NULL,
      times_completed INT DEFAULT 0,
      times_failed INT DEFAULT 0,
      sort_order INT DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS task_log (
      id INT AUTO_INCREMENT PRIMARY KEY,
      task_id INT,
      task_name VARCHAR(255) NOT NULL,
      status ENUM('completed','failed','skipped') NOT NULL,
      xp_earned INT DEFAULT 0,
      gold_earned INT DEFAULT 0,
      hp_change INT DEFAULT 0,
      stat_category VARCHAR(50) DEFAULT NULL,
      stat_change INT DEFAULT 0,
      completed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS habits (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      type ENUM('positive','negative') NOT NULL,
      category ENUM('discipline','vitality','social','intellect','creativity','finance') NOT NULL,
      icon VARCHAR(10) DEFAULT '⭐',
      xp_reward INT DEFAULT 15,
      gold_reward INT DEFAULT 5,
      stat_reward INT DEFAULT 1,
      current_streak INT DEFAULT 0,
      best_streak INT DEFAULT 0,
      times_logged INT DEFAULT 0,
      last_logged DATETIME DEFAULT NULL,
      is_active TINYINT(1) DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS habit_log (
      id INT AUTO_INCREMENT PRIMARY KEY,
      habit_id INT,
      habit_name VARCHAR(255) NOT NULL,
      habit_type VARCHAR(20) NOT NULL,
      xp_earned INT DEFAULT 0,
      gold_earned INT DEFAULT 0,
      stat_category VARCHAR(50) DEFAULT NULL,
      stat_change INT DEFAULT 0,
      logged_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (habit_id) REFERENCES habits(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS mood_log (
      id INT AUTO_INCREMENT PRIMARY KEY,
      mood VARCHAR(50) NOT NULL,
      note TEXT DEFAULT NULL,
      modifier DECIMAL(4,2) DEFAULT 1.00,
      logged_at DATETIME DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS achievements (
      id INT AUTO_INCREMENT PRIMARY KEY,
      \`key\` VARCHAR(100) UNIQUE NOT NULL,
      name VARCHAR(255) NOT NULL,
      description TEXT NOT NULL,
      icon VARCHAR(10) DEFAULT '🏆',
      unlocked_at DATETIME DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS minigame_scores (
      id INT AUTO_INCREMENT PRIMARY KEY,
      game ENUM('memory','typing','trivia') NOT NULL,
      score INT DEFAULT 0,
      xp_earned INT DEFAULT 0,
      gold_earned INT DEFAULT 0,
      played_at DATETIME DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS activity_feed (
      id INT AUTO_INCREMENT PRIMARY KEY,
      type VARCHAR(50) NOT NULL,
      message TEXT NOT NULL,
      icon VARCHAR(10) DEFAULT '📋',
      xp_earned INT DEFAULT 0,
      gold_earned INT DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS actions (
      id INT AUTO_INCREMENT PRIMARY KEY,
      action_id VARCHAR(100) UNIQUE NOT NULL,
      label VARCHAR(255) NOT NULL,
      category VARCHAR(100) NOT NULL,
      related_motives JSON DEFAULT NULL,
      needs JSON DEFAULT NULL,
      location VARCHAR(50) DEFAULT 'any',
      time_of_day JSON DEFAULT NULL,
      time_minutes INT DEFAULT 5,
      energy_delta INT DEFAULT 0,
      stress_delta INT DEFAULT 0,
      money_delta INT DEFAULT 0,
      social_delta INT DEFAULT 0,
      health_delta INT DEFAULT 0,
      hygiene_delta INT DEFAULT 0,
      fun_delta INT DEFAULT 0,
      discipline_delta INT DEFAULT 0,
      repeatable TINYINT(1) DEFAULT 1,
      prerequisites JSON DEFAULT NULL,
      is_active TINYINT(1) DEFAULT 1,
      times_performed INT DEFAULT 0,
      last_performed DATETIME DEFAULT NULL,
      emotion_sensitivity ENUM('low','medium','high') DEFAULT 'medium',
      emotion_multiplier_band VARCHAR(20) DEFAULT '0.85-1.20',
      emotion_tags JSON DEFAULT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS action_log (
      id INT AUTO_INCREMENT PRIMARY KEY,
      action_id VARCHAR(100) NOT NULL,
      action_label VARCHAR(255) NOT NULL,
      category VARCHAR(100) NOT NULL,
      energy_delta INT DEFAULT 0,
      stress_delta INT DEFAULT 0,
      money_delta INT DEFAULT 0,
      social_delta INT DEFAULT 0,
      health_delta INT DEFAULT 0,
      hygiene_delta INT DEFAULT 0,
      fun_delta INT DEFAULT 0,
      discipline_delta INT DEFAULT 0,
      performed_at DATETIME DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS motives (
      id INT AUTO_INCREMENT PRIMARY KEY,
      motive_id VARCHAR(100) UNIQUE NOT NULL,
      label VARCHAR(255) NOT NULL,
      description TEXT DEFAULT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS categories (
      id INT AUTO_INCREMENT PRIMARY KEY,
      category_id VARCHAR(100) UNIQUE NOT NULL,
      label VARCHAR(255) NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS emotion_log (
      id INT AUTO_INCREMENT PRIMARY KEY,
      emotion_name VARCHAR(100) NOT NULL,
      category_id VARCHAR(100) NOT NULL,
      tier INT DEFAULT 3,
      note TEXT DEFAULT NULL,
      energy_delta INT DEFAULT 0,
      stress_delta INT DEFAULT 0,
      discipline_delta INT DEFAULT 0,
      social_delta INT DEFAULT 0,
      health_delta INT DEFAULT 0,
      fun_delta INT DEFAULT 0,
      xp_earned INT DEFAULT 0,
      gold_earned INT DEFAULT 0,
      logged_at DATETIME DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  console.log('✅ Game data tables ready (jeffers4_battact)');

  // ─── Emotions Tables (jeffers4_battemo) ───────────────────────────
  await emoDb.execute(`
    CREATE TABLE IF NOT EXISTS emotion_categories (
      id INT AUTO_INCREMENT PRIMARY KEY,
      category_id VARCHAR(100) UNIQUE NOT NULL,
      label VARCHAR(255) NOT NULL,
      discipline_flat INT DEFAULT 0,
      energy_flat INT DEFAULT 0,
      stress_flat INT DEFAULT 0,
      fun_flat INT DEFAULT 0,
      hygiene_flat INT DEFAULT 0,
      social_flat INT DEFAULT 0,
      health_flat INT DEFAULT 0,
      money_flat INT DEFAULT 0,
      discipline_delta_mult DECIMAL(4,2) DEFAULT 1.00,
      energy_delta_mult DECIMAL(4,2) DEFAULT 1.00,
      stress_delta_mult DECIMAL(4,2) DEFAULT 1.00,
      fun_delta_mult DECIMAL(4,2) DEFAULT 1.00,
      hygiene_delta_mult DECIMAL(4,2) DEFAULT 1.00,
      social_delta_mult DECIMAL(4,2) DEFAULT 1.00,
      health_delta_mult DECIMAL(4,2) DEFAULT 1.00,
      money_delta_mult DECIMAL(4,2) DEFAULT 1.00,
      time_minutes_mult DECIMAL(4,2) DEFAULT 1.00,
      tags JSON DEFAULT NULL,
      favored_tags JSON DEFAULT NULL,
      avoided_tags JSON DEFAULT NULL,
      supported_motives JSON DEFAULT NULL,
      opposed_motives JSON DEFAULT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  await emoDb.execute(`
    CREATE TABLE IF NOT EXISTS emotions (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      category_id VARCHAR(100) NOT NULL,
      tier INT DEFAULT 3,
      intensity_note VARCHAR(50) DEFAULT 'moderate',
      brief_description TEXT DEFAULT NULL,
      extended_description TEXT DEFAULT NULL,
      related_emotions JSON DEFAULT NULL,
      discipline_flat INT DEFAULT NULL,
      energy_flat INT DEFAULT NULL,
      stress_flat INT DEFAULT NULL,
      fun_flat INT DEFAULT NULL,
      hygiene_flat INT DEFAULT NULL,
      social_flat INT DEFAULT NULL,
      health_flat INT DEFAULT NULL,
      money_flat INT DEFAULT NULL,
      discipline_delta_mult DECIMAL(4,2) DEFAULT NULL,
      energy_delta_mult DECIMAL(4,2) DEFAULT NULL,
      stress_delta_mult DECIMAL(4,2) DEFAULT NULL,
      fun_delta_mult DECIMAL(4,2) DEFAULT NULL,
      hygiene_delta_mult DECIMAL(4,2) DEFAULT NULL,
      social_delta_mult DECIMAL(4,2) DEFAULT NULL,
      health_delta_mult DECIMAL(4,2) DEFAULT NULL,
      money_delta_mult DECIMAL(4,2) DEFAULT NULL,
      time_minutes_mult DECIMAL(4,2) DEFAULT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY unique_name_cat (name, category_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  await emoDb.execute(`
    CREATE TABLE IF NOT EXISTS emotion_overrides (
      id INT AUTO_INCREMENT PRIMARY KEY,
      override_name VARCHAR(100) UNIQUE NOT NULL,
      applies_to_tags JSON NOT NULL,
      applies_to_emotions JSON NOT NULL,
      rule JSON NOT NULL,
      examples JSON DEFAULT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  console.log('✅ Emotions tables ready (jeffers4_battemo)');
}

module.exports = { initDatabase };
