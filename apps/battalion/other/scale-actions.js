const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'emotions', 'everyday-life-rpg-systems-emotion-core-merged-v2.json');
const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

if (!data.emotion_core || !data.emotion_core.actions) {
    console.error("Invalid file structure");
    process.exit(1);
}

let actionsModified = 0;

for (const action of data.emotion_core.actions) {
    if (typeof action.energy_delta === 'number') action.energy_delta *= 10;
    if (typeof action.stress_delta === 'number') action.stress_delta *= 10;
    if (typeof action.money_delta === 'number') action.money_delta *= 10;
    if (typeof action.social_delta === 'number') action.social_delta *= 10;
    if (typeof action.health_delta === 'number') action.health_delta *= 10;
    if (typeof action.hygiene_delta === 'number') action.hygiene_delta *= 10;
    if (typeof action.fun_delta === 'number') action.fun_delta *= 10;
    if (typeof action.discipline_delta === 'number') action.discipline_delta *= 10;
    actionsModified++;
}

// Overwrite the file
fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');

console.log(`✅ Scaled stat impacts for ${actionsModified} actions by 10x!`);
