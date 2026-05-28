// ─── Import Emotion Tags into Actions + Seed Emotions ───────────────
const path = require('path');
const fs = require('fs');
const { db, emoDb } = require('./db/db');

async function importAll() {
  console.log('🔄 Starting data import...\n');

  const mergedJsonPath = path.resolve(__dirname, '..', 'emotions', 'everyday-life-rpg-systems-emotion-core-merged-v2.json');
  const mergedData = JSON.parse(fs.readFileSync(mergedJsonPath, 'utf8'));

  const actions = mergedData.emotion_core.actions || [];
  const affinities = mergedData.emotion_core.emotion_system.emotion_category_affinities || {};

  let updatedCount = 0;
  let insertedCount = 0;

  // 1. Actions
  for (const action of actions) {
    const { id, label, category, emotion_tags, emotion_sensitivity, emotion_multiplier_band,
      energy_delta, stress_delta, money_delta, social_delta, health_delta, hygiene_delta, 
      fun_delta, discipline_delta, time_minutes, location, time_of_day, repeatable, 
      related_motives, needs, prerequisites } = action;
      
    const actionId = id || action.action_id;

    const [[existing]] = await db.execute('SELECT action_id FROM actions WHERE action_id = ?', [actionId]);
    if (existing) {
      // Update all stats because the previous script accidentally inserted 0s
      await db.execute(
        `UPDATE actions SET 
          emotion_tags = ?, emotion_sensitivity = ?, emotion_multiplier_band = ?,
          energy_delta = ?, stress_delta = ?, money_delta = ?, social_delta = ?, 
          health_delta = ?, hygiene_delta = ?, fun_delta = ?, discipline_delta = ?, 
          time_minutes = ?
         WHERE action_id = ?`,
        [
          JSON.stringify(emotion_tags || []), emotion_sensitivity || 'medium', emotion_multiplier_band || '0.85-1.20',
          energy_delta || 0, stress_delta || 0, money_delta || 0, social_delta || 0, 
          health_delta || 0, hygiene_delta || 0, fun_delta || 0, discipline_delta || 0, 
          time_minutes || 5, actionId
        ]
      );
      updatedCount++;
    } else {
      // Insert new actions with all their generated stat deltas
      await db.execute(
        `INSERT IGNORE INTO actions (
          action_id, label, category, emotion_tags, emotion_sensitivity, emotion_multiplier_band,
          energy_delta, stress_delta, money_delta, social_delta, health_delta, hygiene_delta, 
          fun_delta, discipline_delta, time_minutes, location, time_of_day, repeatable, 
          related_motives, needs, prerequisites
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          actionId, label, category, JSON.stringify(emotion_tags || []), emotion_sensitivity || 'medium', emotion_multiplier_band || '0.85-1.20',
          energy_delta || 0, stress_delta || 0, money_delta || 0, social_delta || 0, health_delta || 0, hygiene_delta || 0,
          fun_delta || 0, discipline_delta || 0, time_minutes || 5, location || 'any', JSON.stringify(time_of_day || ['any']),
          repeatable === undefined ? 1 : (repeatable ? 1 : 0), JSON.stringify(related_motives || []), JSON.stringify(needs || []), JSON.stringify(prerequisites || [])
        ]
      );
      insertedCount++;
    }
  }
  console.log(`✅ Actions: ${updatedCount} updated, ${insertedCount} inserted`);

  // 2. Emotion Categories
  // Merge the new favored/avoided tags from JSON into the existing database entries if needed
  let catCount = 0;
  for (const [catName, data] of Object.entries(affinities)) {
      const catId = catName.toLowerCase().replace(/\s*\/\s*/g, '_').replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
      
      const [[existing]] = await emoDb.execute('SELECT category_id FROM emotion_categories WHERE category_id = ?', [catId]);
      if (existing) {
          await emoDb.execute(
              `UPDATE emotion_categories SET favored_tags = ?, avoided_tags = ? WHERE category_id = ?`,
              [JSON.stringify(data.favored_tags || []), JSON.stringify(data.avoided_tags || []), catId]
          );
      } else {
          await emoDb.execute(
              `INSERT IGNORE INTO emotion_categories (category_id, label, favored_tags, avoided_tags) VALUES (?, ?, ?, ?)`,
              [catId, catName, JSON.stringify(data.favored_tags || []), JSON.stringify(data.avoided_tags || [])]
          );
      }
      catCount++;
  }
  console.log(`✅ Emotion categories: ${catCount} seeded/updated`);

  // 3. Individual Emotions (assuming they are already seeded or exist in emotions_part_X)
  // We'll skip re-seeding the parts here if they haven't changed, but keep the previous logic if the user needs it.
  
  // 4. Overrides
  const overrides = [
    {
      override_name: 'high_intensity_risky_actions',
      applies_to_tags: ['risky', 'conflict', 'escape'],
      applies_to_emotions: ['Fear', 'Angry / Annoyed', 'Stressed / Tense', 'Powerless'],
      rule: { if_emotion_tier_gte: 4, multiplier_floor: 0.72, multiplier_ceiling: 1.32, stress_bonus_on_failure: 2, social_penalty: -1, time_multiplier: 1.08 }
    },
    {
      override_name: 'social_restoration_actions',
      applies_to_tags: ['social', 'restorative', 'care', 'comfort'],
      applies_to_emotions: ['Connected / Loving', 'Tender', 'Grateful', 'Accepting / Open', 'Hopeful'],
      rule: { if_emotion_tier_gte: 3, multiplier_floor: 0.88, multiplier_ceiling: 1.24, social_bonus: 2, stress_reduction_bonus: 1, health_bonus: 1, fun_bonus: 1 }
    }
  ];

  for (const o of overrides) {
    await emoDb.execute(
      `INSERT IGNORE INTO emotion_overrides (override_name, applies_to_tags, applies_to_emotions, rule)
       VALUES (?, ?, ?, ?)`,
      [o.override_name, JSON.stringify(o.applies_to_tags), JSON.stringify(o.applies_to_emotions), JSON.stringify(o.rule)]
    );
  }
  console.log(`✅ Override rules: ${overrides.length} seeded`);

  console.log(`\n✅ Import complete!`);
}

importAll().then(() => process.exit(0)).catch(err => { console.error('❌ Import failed:', err); process.exit(1); });
