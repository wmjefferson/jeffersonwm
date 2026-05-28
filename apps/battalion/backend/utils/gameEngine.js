const { db } = require('../db/db');

const gameEngine = {
  /**
   * Calculate XP earned with mood and streak bonuses
   */
  calculateXP(baseXP, moodModifier, streakBonus) {
    return Math.floor(baseXP * moodModifier * (1 + streakBonus * 0.1));
  },

  /**
   * Check if the player has leveled up and apply changes
   */
  async checkLevelUp() {
    const [[player]] = await db.execute('SELECT * FROM player WHERE id = 1');
    let leveledUp = false;
    let { level, xp, xp_to_next } = player;

    while (xp >= xp_to_next) {
      xp -= xp_to_next;
      level++;
      xp_to_next = Math.floor(500 * Math.pow(level, 1.8));
      leveledUp = true;
    }

    // Assign title based on level
    let title;
    if (level >= 30) title = 'Legend';
    else if (level >= 25) title = 'Hero';
    else if (level >= 20) title = 'Commander';
    else if (level >= 15) title = 'Captain';
    else if (level >= 10) title = 'Veteran';
    else if (level >= 5) title = 'Soldier';
    else title = 'Recruit';

    await db.execute(
      `UPDATE player SET level = ?, xp = ?, xp_to_next = ?, title = ?, updated_at = NOW() WHERE id = 1`,
      [level, xp, xp_to_next, title]
    );

    return { leveled_up: leveledUp, new_level: level, new_title: title };
  },

  /**
   * Get the mood modifier for XP calculations
   */
  getMoodModifier(mood) {
    const modifiers = {
      terrible: 0.6,
      miserable: 0.7,
      bad: 0.8,
      unpleasant: 0.9,
      okay: 1.0,
      fine: 1.05,
      good: 1.1,
      great: 1.2,
      excellent: 1.3,
      fantastic: 1.4
    };
    return modifiers[mood] || 1.0;
  },

  /**
   * Get difficulty multipliers for rewards and penalties
   */
  getDifficultyMultiplier(difficulty) {
    const multipliers = {
      easy: { xp: 1, gold: 1, stat: 1, hp_penalty: 2 },
      medium: { xp: 2.5, gold: 2, stat: 2, hp_penalty: 5 },
      hard: { xp: 5, gold: 5, stat: 3, hp_penalty: 10 },
      epic: { xp: 10, gold: 10, stat: 5, hp_penalty: 20 }
    };
    return multipliers[difficulty] || multipliers.medium;
  },

  /**
   * Add an entry to the activity feed
   */
  async addActivity(type, message, icon, xpEarned = 0, goldEarned = 0) {
    await db.execute(
      `INSERT INTO activity_feed (type, message, icon, xp_earned, gold_earned) VALUES (?, ?, ?, ?, ?)`,
      [type, message, icon, xpEarned, goldEarned]
    );
  },

  /**
   * Check and unlock achievements based on current player state
   */
  async checkAchievements() {
    const [[player]] = await db.execute('SELECT * FROM player WHERE id = 1');
    const newlyUnlocked = [];

    const achievementChecks = [
      { key: 'first_task', condition: player.total_tasks_completed >= 1, name: 'First Step', description: 'Completed your first task!', icon: '👣' },
      { key: 'ten_tasks', condition: player.total_tasks_completed >= 10, name: 'Getting Going', description: 'Completed 10 tasks!', icon: '🔟' },
      { key: 'fifty_tasks', condition: player.total_tasks_completed >= 50, name: 'Dedicated', description: 'Completed 50 tasks!', icon: '⭐' },
      { key: 'hundred_tasks', condition: player.total_tasks_completed >= 100, name: 'Centurion', description: 'Completed 100 tasks!', icon: '💯' },
      { key: 'level_5', condition: player.level >= 5, name: 'Rising Star', description: 'Reached level 5!', icon: '⬆️' },
      { key: 'level_10', condition: player.level >= 10, name: 'Veteran', description: 'Reached level 10!', icon: '🎖️' },
      { key: 'level_25', condition: player.level >= 25, name: 'Elite', description: 'Reached level 25!', icon: '👑' },
      { key: 'rich', condition: player.gold >= 1000, name: 'Wealthy', description: 'Accumulated 1000 gold!', icon: '💰' },
      { key: 'healthy', condition: player.stat_health >= 50, name: 'Peak Performance', description: 'Health reached 50!', icon: '💪' }
    ];

    for (const check of achievementChecks) {
      if (check.condition) {
        const [[existing]] = await db.execute('SELECT id FROM achievements WHERE `key` = ?', [check.key]);
        if (!existing) {
          await db.execute(
            'INSERT IGNORE INTO achievements (`key`, name, description, icon) VALUES (?, ?, ?, ?)',
            [check.key, check.name, check.description, check.icon]
          );
          newlyUnlocked.push({ key: check.key, name: check.name, description: check.description, icon: check.icon });
          await this.addActivity('achievement', `🏆 Achievement unlocked: ${check.name}`, '🏆', 0, 0);
        }
      }
    }

    return newlyUnlocked;
  },

  /**
   * Add Health XP and check for health level ups
   */
  async addHealthXP(amount) {
    if (amount <= 0) return { leveled_up: false };

    const [[player]] = await db.execute('SELECT * FROM player WHERE id = 1');
    let { health_level, health_xp, health_xp_to_next, max_hp, hp } = player;

    // Default values if NULL
    health_level = health_level || 1;
    health_xp = health_xp || 0;
    health_xp_to_next = health_xp_to_next || 100;
    max_hp = max_hp || 100;
    hp = hp || 100;

    health_xp += amount;
    let leveledUp = false;

    while (health_xp >= health_xp_to_next) {
      health_xp -= health_xp_to_next;
      health_level++;
      health_xp_to_next = Math.floor(100 * Math.pow(health_level, 1.5));
      max_hp += 10; // increase max hp by 10
      hp = max_hp;  // fully heal player
      leveledUp = true;
    }

    await db.execute(
      `UPDATE player SET health_level = ?, health_xp = ?, health_xp_to_next = ?, max_hp = ?, hp = ?, updated_at = NOW() WHERE id = 1`,
      [health_level, health_xp, health_xp_to_next, max_hp, hp]
    );

    if (leveledUp) {
      await this.addActivity('levelup_health', `🍏 Health leveled up to Level ${health_level}! Max HP increased to ${max_hp}!`, '🍏', 0, 0);
    }

    return { leveled_up: leveledUp, new_level: health_level, new_max_hp: max_hp };
  },

  /**
   * Reset daily tasks completion status
   */
  async resetDailyTasks() {
    await db.execute("UPDATE tasks SET is_completed_today = 0 WHERE recurrence = 'daily'");
  }
};

module.exports = gameEngine;
