const fs = require('fs');
const path = require('path');

const inputFile = path.join(__dirname, 'negative-actions-list.txt');
const outputFile = path.join(__dirname, 'negative-actions.json');

const lines = fs.readFileSync(inputFile, 'utf-8').split('\n').filter(l => l.trim().length > 0);

const negativeActions = [];

function getRandomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Simple heuristic matching
for (const line of lines) {
    // Strip "1. " from start
    let label = line.replace(/^\d+\.\s*/, '').trim();
    if (!label) continue;
    
    // Remove ending period if exists
    label = label.replace(/\.$/, '');
    
    const id = label.toLowerCase().replace(/[^a-z0-9]+/g, '_');
    
    let category = 'misc';
    let energy = 0, stress = 0, money = 0, social = 0, health = 0, hygiene = 0, fun = 0, discipline = 0;
    const tags = [];
    let sensitivity = 'low';
    let band = '0.90-1.10';

    const l = label.toLowerCase();
    
    // Heuristics
    if (l.includes('wake up') || l.includes('snooze') || l.includes('alarm') || l.includes('bed')) {
        category = 'routine';
        energy = getRandomInt(-2, 0);
        stress = getRandomInt(1, 3);
        discipline = getRandomInt(-2, -1);
        tags.push('routine');
    } else if (l.includes('forget') || l.includes('lose') || l.includes('misplace') || l.includes('late') || l.includes('miss')) {
        category = 'routine';
        stress = getRandomInt(2, 4);
        discipline = getRandomInt(-2, -1);
        tags.push('routine', 'conflict');
        sensitivity = 'medium';
    } else if (l.includes('clothes') || l.includes('shower') || l.includes('deodorant') || l.includes('teeth') || l.includes('unclean') || l.includes('breath') || l.includes('hair') || l.includes('shaving') || l.includes('soap')) {
        category = 'vitality';
        hygiene = getRandomInt(-3, -1);
        social = getRandomInt(-1, 0);
        stress = getRandomInt(1, 2);
        tags.push('routine');
    } else if (l.includes('eat') || l.includes('meal') || l.includes('breakfast') || l.includes('dinner') || l.includes('cook') || l.includes('food') || l.includes('coffee') || l.includes('drink') || l.includes('bloated') || l.includes('hungry')) {
        category = 'vitality';
        health = getRandomInt(-2, 0);
        energy = getRandomInt(-2, 0);
        stress = getRandomInt(1, 2);
        tags.push('routine');
    } else if (l.includes('sick') || l.includes('ache') || l.includes('pain') || l.includes('muscle') || l.includes('dizzy') || l.includes('nauseous') || l.includes('cut') || l.includes('burn') || l.includes('hurt')) {
        category = 'vitality';
        health = getRandomInt(-3, -1);
        energy = getRandomInt(-3, -1);
        stress = getRandomInt(1, 3);
        tags.push('care');
        sensitivity = 'medium';
    } else if (l.includes('phone') || l.includes('internet') || l.includes('device') || l.includes('app') || l.includes('file') || l.includes('message') || l.includes('text') || l.includes('read') || l.includes('call') || l.includes('email') || l.includes('notification')) {
        category = 'intellect';
        stress = getRandomInt(2, 4);
        fun = getRandomInt(-2, 0);
        tags.push('routine');
    } else if (l.includes('traffic') || l.includes('bus') || l.includes('train') || l.includes('route') || l.includes('gas') || l.includes('park') || l.includes('ticket')) {
        category = 'routine';
        stress = getRandomInt(3, 5);
        energy = getRandomInt(-1, 0);
        tags.push('routine', 'risky');
        sensitivity = 'high';
        band = '0.85-1.25';
    } else if (l.includes('money') || l.includes('buy') || l.includes('spend') || l.includes('budget') || l.includes('groceries') || l.includes('receipt') || l.includes('fee') || l.includes('bill') || l.includes('overdraft') || l.includes('balance') || l.includes('expense') || l.includes('expensive')) {
        category = 'finance';
        money = getRandomInt(-10, -2);
        stress = getRandomInt(2, 4);
        tags.push('routine', 'conflict');
        sensitivity = 'high';
        band = '0.85-1.25';
    } else if (l.includes('break') || l.includes('damage') || l.includes('spill') || l.includes('mess') || l.includes('trash') || l.includes('laundry') || l.includes('clutter') || l.includes('dishes') || l.includes('clean') || l.includes('chore') || l.includes('leak') || l.includes('broken')) {
        category = 'routine';
        hygiene = getRandomInt(-2, 0);
        stress = getRandomInt(1, 3);
        discipline = getRandomInt(-1, 0);
        tags.push('routine');
    } else if (l.includes('work') || l.includes('study') || l.includes('focus') || l.includes('mistake') || l.includes('error') || l.includes('deadline') || l.includes('meeting') || l.includes('tired') || l.includes('unmotivated') || l.includes('burnout')) {
        category = 'intellect';
        stress = getRandomInt(2, 4);
        discipline = getRandomInt(-2, -1);
        tags.push('achievement');
        sensitivity = 'medium';
    } else if (l.includes('friend') || l.includes('talk') || l.includes('name') || l.includes('cue') || l.includes('interrupt') || l.includes('ignore') || l.includes('plan') || l.includes('cancel') || l.includes('argue') || l.includes('grudge') || l.includes('apologize') || l.includes('lonely') || l.includes('reject') || l.includes('judge') || l.includes('criticize') || l.includes('snap')) {
        category = 'social';
        social = getRandomInt(-3, -1);
        stress = getRandomInt(2, 5);
        fun = getRandomInt(-2, 0);
        tags.push('social', 'conflict');
        sensitivity = 'high';
        band = '0.80-1.30';
    } else if (l.includes('feel') || l.includes('worry') || l.includes('compare') || l.includes('jealous') || l.includes('insecure') || l.includes('anxious') || l.includes('guilty') || l.includes('shame')) {
        category = 'vitality'; // or mental health
        stress = getRandomInt(2, 5);
        energy = getRandomInt(-2, -1);
        tags.push('identity', 'comfort');
        sensitivity = 'high';
        band = '0.80-1.30';
    } else if (l.includes('doomscroll') || l.includes('social media') || l.includes('waste') || l.includes('goal') || l.includes('streak') || l.includes('habit') || l.includes('procrastinate')) {
        category = 'discipline';
        discipline = getRandomInt(-3, -1);
        fun = getRandomInt(-1, 0);
        stress = getRandomInt(1, 2);
        tags.push('escape', 'routine');
        sensitivity = 'medium';
    } else {
        // Fallback
        category = 'routine';
        stress = getRandomInt(1, 2);
        energy = getRandomInt(-1, 0);
        tags.push('routine');
    }

    // Assign at least 1 negative delta
    if (energy === 0 && stress === 0 && money === 0 && social === 0 && health === 0 && hygiene === 0 && fun === 0 && discipline === 0) {
        stress = 2;
    }
    
    // Ensure "net negative" score
    const net = energy - stress + money + social + health + hygiene + fun + discipline;
    if (net >= 0) {
        stress += (net + 2); // force negative
    }

    negativeActions.push({
        action_id: id,
        label: label,
        category: category,
        emotion_tags: [...new Set(tags)],
        emotion_sensitivity: sensitivity,
        emotion_multiplier_band: band,
        energy_delta: energy,
        stress_delta: stress,
        money_delta: money,
        social_delta: social,
        health_delta: health,
        hygiene_delta: hygiene,
        fun_delta: fun,
        discipline_delta: discipline,
        time_minutes: getRandomInt(2, 15),
        location: 'any',
        time_of_day: ['any'],
        repeatable: 1,
        related_motives: [],
        needs: [],
        prerequisites: []
    });
}

fs.writeFileSync(outputFile, JSON.stringify(negativeActions, null, 2), 'utf-8');
console.log(`✅ Generated ${negativeActions.length} negative actions to ${outputFile}`);
