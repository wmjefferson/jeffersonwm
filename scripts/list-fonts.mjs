import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = process.env.JEFFWM_ROOT || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const appRoot = path.join(repoRoot, 'apps', 'jeffersonwm');

function parseEnvFile(filePath) {
  if (!existsSync(filePath)) return {};
  const content = readFileSync(filePath, 'utf8');
  const env = {};
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx !== -1) {
      const key = trimmed.slice(0, eqIdx).trim();
      let val = trimmed.slice(eqIdx + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      env[key] = val;
    }
  }
  return env;
}

const env = {
  ...parseEnvFile(path.join(appRoot, '.env')),
  ...parseEnvFile(path.join(appRoot, '.env.development')),
  ...parseEnvFile(path.join(appRoot, '.env.production')),
  ...process.env,
};

// Parse arguments
const args = process.argv.slice(2);
let selectedRound = null;
let sortBy = 'alpha';

for (let i = 0; i < args.length; i++) {
  const arg = args[i].toLowerCase();

  if (['--prob', '--probability', '-p'].includes(arg)) {
    sortBy = 'prob';
  } else if (['--alpha', '--name', '-a'].includes(arg)) {
    sortBy = 'alpha';
  } else if (['--round-sort', '--by-round'].includes(arg)) {
    sortBy = 'round';
  } else if (arg.startsWith('--round=') || arg.startsWith('-r=')) {
    const val = parseInt(arg.split('=')[1], 10);
    if (!isNaN(val)) selectedRound = val;
  } else if (['--round', '-r', '--r'].includes(arg) && i + 1 < args.length) {
    const val = parseInt(args[i + 1], 10);
    if (!isNaN(val)) {
      selectedRound = val;
      i++;
    }
  } else if (/^r[1-8]$/i.test(arg) || /^--r[1-8]$/i.test(arg)) {
    selectedRound = parseInt(arg.replace(/^-+r/i, ''), 10);
  } else if (/^[1-8]$/.test(arg)) {
    selectedRound = parseInt(arg, 10);
  }
}

async function fetchFontsFromDb() {
  const host = env.JEFFERSONWM_WIDGET_DB_HOST || env.MYSQL_HOST;
  const user = env.JEFFERSONWM_WIDGET_DB_USER || env.MYSQL_USER;
  const password = env.JEFFERSONWM_WIDGET_DB_PASSWORD || env.MYSQL_PASSWORD;
  const database = env.JEFFERSONWM_WIDGET_DB_NAME || env.MYSQL_DATABASE;
  const port = Number(env.JEFFERSONWM_WIDGET_DB_PORT || env.MYSQL_PORT || 3306);

  if (!host || !user || !password || !database) {
    return null;
  }

  try {
    const mysqlPath = path.join(appRoot, 'node_modules', 'mysql2', 'promise.js');
    const mysqlModule = existsSync(mysqlPath)
      ? await import('file:///' + mysqlPath.replace(/\\/g, '/'))
      : await import('mysql2/promise');
    const mysql = mysqlModule.default || mysqlModule;
    const connection = await mysql.createConnection({ host, user, password, database, port, connectTimeout: 3000 });

    let query = 'SELECT id, name, round, weight, probability FROM widget_fonts';
    const params = [];
    if (selectedRound !== null) {
      query += ' WHERE round = ?';
      params.push(selectedRound);
    }
    query += ' ORDER BY name ASC';

    const [rows] = await connection.query(query, params);
    await connection.end();
    return rows;
  } catch (_err) {
    return null;
  }
}

async function fetchFontsFromApi() {
  const apiUrls = [
    'https://jeffersonwm.com/api/widget/fonts',
    'http://localhost:8110/api/widget/fonts',
  ];

  for (const url of apiUrls) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(3000) });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          if (selectedRound !== null) {
            return data.filter(f => f.round === selectedRound);
          }
          return data;
        }
      }
    } catch (_err) {
      // try next
    }
  }
  return null;
}

const fallbackFonts = [
  { id: 1, name: 'IBM Plex Sans Condensed', round: 1, weight: 2, probability: 3 },
  { id: 2, name: 'Newsreader', round: 1, weight: 2, probability: 2 },
  { id: 3, name: 'Gelasio', round: 1, weight: 2, probability: 1 },
];

async function main() {
  let source = 'MySQL Database';
  let fonts = await fetchFontsFromDb();

  if (!fonts || fonts.length === 0) {
    source = 'Widget API (https://jeffersonwm.com)';
    fonts = await fetchFontsFromApi();
  }

  if (!fonts || fonts.length === 0) {
    source = 'Local Fallback Defaults';
    fonts = selectedRound !== null ? fallbackFonts.filter(f => f.round === selectedRound) : fallbackFonts;
  }

  if (sortBy === 'prob') {
    fonts.sort((a, b) => (Number(b.probability) || 0) - (Number(a.probability) || 0) || a.name.localeCompare(b.name));
  } else if (sortBy === 'round') {
    fonts.sort((a, b) => (Number(a.round) || 1) - (Number(b.round) || 1) || a.name.localeCompare(b.name));
  } else {
    fonts.sort((a, b) => a.name.localeCompare(b.name));
  }

  const roundTitle = selectedRound !== null ? ` (Round ${selectedRound})` : ' (All Rounds)';
  console.log(`\n========================================================`);
  console.log(` JeffersonWM Widget Fonts${roundTitle} - ${fonts.length} total`);
  console.log(` Source: ${source}`);
  console.log(` Sorted by: ${sortBy === 'prob' ? 'Probability (High to Low)' : sortBy === 'round' ? 'Round number (1-8)' : 'Alphabetical (A to Z)'}`);
  console.log(`========================================================\n`);

  const weightLabels = {
    1: '1 (Light)',
    2: '2 (Regular / 400)',
    3: '3 (Medium / 500)',
    4: '4 (Bold / 700)',
    5: '5 (Black / 900)',
  };

  const formatted = fonts.map((f, i) => ({
    '#': i + 1,
    'Font Name': f.name,
    'Round': f.round != null ? `Round ${f.round}` : 'N/A',
    'Weight': weightLabels[f.weight] || f.weight || '2',
    'Probability': f.probability ?? 1,
  }));

  console.table(formatted);
  console.log(`\nUsage examples:`);
  console.log(`  npm run fonts                    # All fonts (alphabetical)`);
  console.log(`  npm run fonts:prob               # All fonts (by probability)`);
  console.log(`  npm run fonts:r7                 # Round 7 fonts`);
  console.log(`  npm run fonts:r8                 # Round 8 fonts`);
  console.log(`  npm run fonts -- 7               # Filter round 7 via argument`);
  console.log(`  npm run fonts:prob -- 7          # Round 7 sorted by probability\n`);
}

main().catch(err => {
  console.error('Failed to list widget fonts:', err);
  process.exit(1);
});
