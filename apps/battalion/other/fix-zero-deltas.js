const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'emotions', 'everyday-life-rpg-systems-emotion-core-merged-v2.json');
const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

const actions = data.emotion_core.actions;

// Category-based default stat profiles (scaled to -100 to +100 range)
// These are fallback heuristics when an action has all-zero deltas
const categoryProfiles = {
    // Positive-leaning categories
    'basic_needs':       { energy: 15, stress: -10, health: 10, hygiene: 5, fun: 0, discipline: 5, social: 0, money: 0 },
    'food_cooking':      { energy: 10, stress: -5, health: 15, hygiene: -5, fun: 10, discipline: 5, social: 0, money: -5 },
    'home_care':         { energy: -10, stress: -5, health: 5, hygiene: 20, fun: -5, discipline: 15, social: 0, money: 0 },
    'personal_care':     { energy: 5, stress: -10, health: 10, hygiene: 20, fun: 0, discipline: 10, social: 0, money: 0 },
    'physical_activity': { energy: -15, stress: -20, health: 25, hygiene: -10, fun: 10, discipline: 15, social: 0, money: 0 },
    'social':            { energy: -5, stress: -10, health: 5, hygiene: 0, fun: 15, discipline: 0, social: 25, money: -5 },
    'self_improvement':  { energy: -10, stress: -5, health: 5, hygiene: 0, fun: 5, discipline: 20, social: 0, money: 0 },
    'recreation':        { energy: -5, stress: -15, health: 5, hygiene: 0, fun: 25, discipline: -5, social: 10, money: -5 },
    'errands':           { energy: -10, stress: 5, health: 0, hygiene: 0, fun: -5, discipline: 15, social: 5, money: -10 },
    'work':              { energy: -15, stress: 10, health: 0, hygiene: 0, fun: -5, discipline: 20, social: 5, money: 15 },
    'finance':           { energy: -5, stress: 5, health: 0, hygiene: 0, fun: -5, discipline: 15, social: 0, money: 10 },
    'creative':          { energy: -10, stress: -15, health: 0, hygiene: 0, fun: 20, discipline: 10, social: 0, money: 0 },
    'learning':          { energy: -10, stress: 5, health: 0, hygiene: 0, fun: 5, discipline: 20, social: 0, money: 0 },
    'spiritual':         { energy: 5, stress: -20, health: 10, hygiene: 0, fun: 5, discipline: 15, social: 0, money: 0 },
    'pet_care':          { energy: -10, stress: -10, health: 5, hygiene: -5, fun: 15, discipline: 10, social: 10, money: -5 },
    'transport':         { energy: -5, stress: 5, health: 0, hygiene: 0, fun: 0, discipline: 5, social: 0, money: -10 },
    // Negative-leaning categories  
    'routine':           { energy: -10, stress: 15, health: -5, hygiene: -5, fun: -5, discipline: -10, social: 0, money: 0 },
    'vitality':          { energy: -15, stress: 10, health: -15, hygiene: -5, fun: -5, discipline: -5, social: 0, money: 0 },
    'intellect':         { energy: -5, stress: 15, health: 0, hygiene: 0, fun: -10, discipline: -10, social: 0, money: 0 },
    'discipline':        { energy: -5, stress: 10, health: 0, hygiene: 0, fun: -10, discipline: -15, social: 0, money: 0 },
    'misc':              { energy: -5, stress: 10, health: -5, hygiene: 0, fun: -5, discipline: -5, social: 0, money: 0 },
};

// Keyword-based adjustments to add variance even within a category
function getKeywordAdjustments(label) {
    const l = label.toLowerCase();
    const adj = { energy: 0, stress: 0, health: 0, hygiene: 0, fun: 0, discipline: 0, social: 0, money: 0 };
    
    // Positive keywords
    if (l.includes('exercise') || l.includes('workout') || l.includes('run') || l.includes('jog'))   { adj.health += 10; adj.energy -= 10; adj.discipline += 5; }
    if (l.includes('cook') || l.includes('meal') || l.includes('food') || l.includes('eat'))         { adj.health += 5; adj.energy += 5; }
    if (l.includes('clean') || l.includes('wash') || l.includes('shower') || l.includes('brush'))    { adj.hygiene += 10; adj.discipline += 5; }
    if (l.includes('friend') || l.includes('family') || l.includes('call') || l.includes('chat'))    { adj.social += 10; adj.stress -= 5; }
    if (l.includes('read') || l.includes('study') || l.includes('learn') || l.includes('book'))      { adj.discipline += 10; adj.fun += 5; }
    if (l.includes('game') || l.includes('play') || l.includes('watch') || l.includes('music'))      { adj.fun += 15; adj.stress -= 10; }
    if (l.includes('meditat') || l.includes('yoga') || l.includes('relax') || l.includes('breath'))  { adj.stress -= 15; adj.health += 5; }
    if (l.includes('sleep') || l.includes('nap') || l.includes('rest'))                              { adj.energy += 15; adj.stress -= 5; }
    if (l.includes('budget') || l.includes('save') || l.includes('invest') || l.includes('pay'))     { adj.money += 10; adj.discipline += 5; }
    
    // Negative keywords  
    if (l.includes('spill') || l.includes('break') || l.includes('drop') || l.includes('crack'))     { adj.stress += 10; adj.money -= 5; }
    if (l.includes('forget') || l.includes('miss') || l.includes('lose') || l.includes('lost'))      { adj.stress += 10; adj.discipline -= 5; }
    if (l.includes('argue') || l.includes('fight') || l.includes('snap') || l.includes('yell'))      { adj.social -= 15; adj.stress += 15; }
    if (l.includes('hurt') || l.includes('pain') || l.includes('sick') || l.includes('ache'))        { adj.health -= 15; adj.energy -= 10; }
    if (l.includes('waste') || l.includes('scroll') || l.includes('doom') || l.includes('procrastin')){ adj.discipline -= 10; adj.fun -= 5; }
    if (l.includes('spend') || l.includes('buy') || l.includes('expensive') || l.includes('fee'))    { adj.money -= 15; adj.stress += 5; }
    if (l.includes('skip') || l.includes('ignore') || l.includes('neglect'))                         { adj.discipline -= 10; adj.health -= 5; }
    if (l.includes('late') || l.includes('rush') || l.includes('behind'))                             { adj.stress += 10; adj.discipline -= 5; }
    if (l.includes('lonely') || l.includes('reject') || l.includes('left out') || l.includes('cancel')){ adj.social -= 10; adj.fun -= 5; }
    if (l.includes('anxious') || l.includes('worry') || l.includes('nervous') || l.includes('fear')) { adj.stress += 15; adj.energy -= 5; }
    if (l.includes('ashamed') || l.includes('embarrass') || l.includes('guilty') || l.includes('shame')){ adj.stress += 10; adj.social -= 5; }
    
    return adj;
}

function addVariance(val) {
    // Add ±20% random variance to keep things from being identical
    const variance = 1 + (Math.random() * 0.4 - 0.2);
    return Math.round(val * variance);
}

let fixed = 0;
let alreadyGood = 0;

for (const action of actions) {
    const deltas = ['energy_delta', 'stress_delta', 'health_delta', 'hygiene_delta', 'fun_delta', 'discipline_delta', 'social_delta', 'money_delta'];
    const nonZeroCount = deltas.filter(d => (action[d] || 0) !== 0).length;
    
    if (nonZeroCount >= 2) {
        alreadyGood++;
        continue; // Already has meaningful stats
    }
    
    // Look up category profile
    const catKey = (action.category || 'misc').toLowerCase().replace(/[^a-z_]/g, '');
    const profile = categoryProfiles[catKey] || categoryProfiles['misc'];
    const kwAdj = getKeywordAdjustments(action.label || '');
    
    // Apply profile + keyword adjustments with variance
    action.energy_delta    = addVariance(profile.energy + kwAdj.energy);
    action.stress_delta    = addVariance(profile.stress + kwAdj.stress);
    action.health_delta    = addVariance(profile.health + kwAdj.health);
    action.hygiene_delta   = addVariance(profile.hygiene + kwAdj.hygiene);
    action.fun_delta       = addVariance(profile.fun + kwAdj.fun);
    action.discipline_delta= addVariance(profile.discipline + kwAdj.discipline);
    action.social_delta    = addVariance(profile.social + kwAdj.social);
    action.money_delta     = addVariance(profile.money + kwAdj.money);
    
    // Clamp everything to -100..100
    for (const d of deltas) {
        action[d] = Math.max(-100, Math.min(100, action[d]));
    }
    
    fixed++;
}

fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
console.log(`✅ Fixed ${fixed} actions with zero/insufficient deltas. ${alreadyGood} already had stats.`);
