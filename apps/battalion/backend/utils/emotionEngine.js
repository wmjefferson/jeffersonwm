const { db, emoDb } = require('../db/db');

// Calculate baseline multiplier based on last 5 emotion logs
async function getRollingBaseline() {
    const [logs] = await db.execute('SELECT tier, category_id FROM emotion_log ORDER BY logged_at DESC LIMIT 5');
    if (logs.length === 0) return 1.00;

    let totalMod = 0;
    for (const log of logs) {
        // Simplified heuristic for positive vs negative states:
        // You would expand this based on your exact tuning table.
        const cat = log.category_id;
        const tier = log.tier || 3;
        
        // Example: negative categories reduce baseline, positive increase it.
        if (['angry_annoyed', 'fear', 'despair_sad', 'powerless', 'stressed_tense'].includes(cat)) {
            totalMod -= (tier * 0.02);
        } else if (['aliveness_joy', 'courageous_powerful', 'hopeful', 'grateful', 'connected_loving'].includes(cat)) {
            totalMod += (tier * 0.02);
        }
    }
    
    return Math.max(0.80, Math.min(1.20, 1.00 + (totalMod / logs.length)));
}

async function calculateActionImpact(action, currentEmotion) {
    // 1. Get Baseline
    let multiplier = await getRollingBaseline();

    // 2. Check Overrides
    const [overrides] = await emoDb.execute('SELECT * FROM emotion_overrides');
    let activeOverride = null;
    
    const actionTags = action.emotion_tags ? (typeof action.emotion_tags === 'string' ? JSON.parse(action.emotion_tags) : action.emotion_tags) : [];

    if (currentEmotion && currentEmotion.name) {
        for (const ov of overrides) {
            const appliesToTags = typeof ov.applies_to_tags === 'string' ? JSON.parse(ov.applies_to_tags) : ov.applies_to_tags;
            const appliesToEmotions = typeof ov.applies_to_emotions === 'string' ? JSON.parse(ov.applies_to_emotions) : ov.applies_to_emotions;
            
            const hasTag = actionTags.some(t => appliesToTags.includes(t));
            const hasEmo = appliesToEmotions.includes(currentEmotion.name) || appliesToEmotions.includes(currentEmotion.category_id);
            
            if (hasTag && hasEmo) {
                activeOverride = typeof ov.rule === 'string' ? JSON.parse(ov.rule) : ov.rule;
                break;
            }
        }
    }

    // 3. Apply Tag Affinities if no override, or inside override bounds
    if (currentEmotion && currentEmotion.category_id) {
        const [[catData]] = await emoDb.execute('SELECT favored_tags, avoided_tags FROM emotion_categories WHERE category_id = ?', [currentEmotion.category_id]);
        if (catData) {
            const favored = typeof catData.favored_tags === 'string' ? JSON.parse(catData.favored_tags) : (catData.favored_tags || []);
            const avoided = typeof catData.avoided_tags === 'string' ? JSON.parse(catData.avoided_tags) : (catData.avoided_tags || []);
            
            const matchesFavored = actionTags.some(t => favored.includes(t));
            const matchesAvoided = actionTags.some(t => avoided.includes(t));
            
            const tierPressure = (currentEmotion.tier || 3) * 0.03;
            
            if (matchesFavored) {
                multiplier += tierPressure;
            } else if (matchesAvoided) {
                multiplier -= tierPressure;
            }
        }
    }

    // 4. Clamp to Sensitivity Band
    let minBand = 0.85, maxBand = 1.20;
    if (action.emotion_multiplier_band) {
        const parts = action.emotion_multiplier_band.split('-');
        if (parts.length === 2) {
            minBand = parseFloat(parts[0]);
            maxBand = parseFloat(parts[1]);
        }
    }
    
    // Override clamps take precedence
    if (activeOverride) {
        if (activeOverride.multiplier_floor) minBand = activeOverride.multiplier_floor;
        if (activeOverride.multiplier_ceiling) maxBand = activeOverride.multiplier_ceiling;
    }
    
    multiplier = Math.max(minBand, Math.min(maxBand, multiplier));

    // 5. Final flat bonuses/penalties
    const flatBonuses = {
        energy: 0, stress: 0, money: 0, social: 0, health: 0, hygiene: 0, fun: 0, discipline: 0
    };
    
    if (activeOverride) {
        if (activeOverride.stress_bonus_on_failure) flatBonuses.stress += activeOverride.stress_bonus_on_failure;
        if (activeOverride.social_penalty) flatBonuses.social += activeOverride.social_penalty;
        if (activeOverride.stress_reduction_bonus) flatBonuses.stress -= activeOverride.stress_reduction_bonus;
        if (activeOverride.social_bonus) flatBonuses.social += activeOverride.social_bonus;
        if (activeOverride.health_bonus) flatBonuses.health += activeOverride.health_bonus;
        if (activeOverride.fun_bonus) flatBonuses.fun += activeOverride.fun_bonus;
    }

    return { multiplier, flatBonuses };
}

module.exports = {
    getRollingBaseline,
    calculateActionImpact
};
