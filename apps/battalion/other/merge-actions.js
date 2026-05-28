const fs = require('fs');
const path = require('path');

const originalFile = path.join(__dirname, '..', 'emotions', 'everyday-life-rpg-systems-emotion-core-merged.json');
const negativeFile = path.join(__dirname, 'negative-actions.json');
const outputFile = path.join(__dirname, '..', 'emotions', 'everyday-life-rpg-systems-emotion-core-merged-v2.json');

const originalData = JSON.parse(fs.readFileSync(originalFile, 'utf-8'));
const negativeActions = JSON.parse(fs.readFileSync(negativeFile, 'utf-8'));

// originalData has structure: { emotion_core: { actions: [...], emotion_system: {...} } }

if (!originalData.emotion_core) {
    console.error("Missing emotion_core in original file!");
    process.exit(1);
}

// Append negative actions to the existing actions list
originalData.emotion_core.actions = originalData.emotion_core.actions.concat(negativeActions);

fs.writeFileSync(outputFile, JSON.stringify(originalData, null, 2), 'utf-8');

console.log(`✅ Successfully merged! Total actions: ${originalData.emotion_core.actions.length}`);
