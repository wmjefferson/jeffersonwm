import { existsSync, readFileSync } from 'node:fs';

const defaultActionsVersioningPath = '\\\\JEFFERSHIZZLE-D\\Dotcoms E\\other\\actions\\versioning.md';
const actionsVersioningPath = process.env.JEFFWM_VERSION_LOG || defaultActionsVersioningPath;

const appAliases = new Map([
  ['aphelion', 'aphelion'],
  ['auth', 'auth / multimillion'],
  ['batt', 'battalion'],
  ['battalion', 'battalion'],
  ['bullion', 'bullion'],
  ['copy', 'copy'],
  ['dooky', 'dooky detective'],
  ['dookydetective', 'dooky detective'],
  ['feed', 'feed'],
  ['jeffersonwm', 'jeffersonwm'],
  ['jeffwm', 'jeffersonwm'],
  ['lionship', 'lionship'],
  ['mill', 'millionfold'],
  ['millionfold', 'millionfold'],
  ['multimillion', 'multimillion'],
  ['peri', 'perihelion'],
  ['perihelion', 'perihelion'],
  ['stall', 'stallioneer'],
  ['stallioneer', 'stallioneer'],
  ['tourb', 'tourbillion'],
  ['tourbillion', 'tourbillion'],
  ['verm', 'vermilion'],
  ['vermilion', 'vermilion'],
  ['wmjeff', 'wm jefferson'],
  ['wmjefferson', 'wm jefferson'],
]);

function parseArgs(argv) {
  const args = {
    limit: 15,
    app: null,
    type: null,
    json: false,
    versionsOnly: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === '--json') {
      args.json = true;
      continue;
    }
    if (value === '--versions-only') {
      args.versionsOnly = true;
      continue;
    }
    if (value === '--limit' || value === '-n') {
      args.limit = Number(argv[index + 1] || args.limit);
      index += 1;
      continue;
    }
    if (value === '--app' || value === '-a') {
      args.app = argv[index + 1] || null;
      index += 1;
      continue;
    }
    if (value === '--type' || value === '-t') {
      args.type = argv[index + 1] || null;
      index += 1;
      continue;
    }
  }

  if (!Number.isFinite(args.limit) || args.limit <= 0) {
    args.limit = 15;
  }

  return args;
}

function normalizeAppName(value) {
  const normalized = String(value || '').trim().toLowerCase();
  return appAliases.get(normalized) || normalized;
}

function parseTimestamp(value) {
  const trimmed = String(value || '').trim();
  const match = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2})\s+([A-Z]{2,4})$/);
  if (!match) {
    return 0;
  }

  const [, year, month, day, hour, minute] = match;
  return Date.UTC(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute));
}

function readField(lines, fieldName) {
  const matcher = new RegExp(`^\\s*-\\s+${fieldName}:\\s*(.*)$`, 'i');
  const line = lines.find((candidate) => matcher.test(candidate));
  return line ? line.match(matcher)?.[1]?.trim() || '' : '';
}

function parseEntries(markdown) {
  const lines = markdown.split(/\r?\n/);
  const entries = [];
  let currentApp = null;
  let current = null;

  function flushCurrent() {
    if (!current || !currentApp) {
      current = null;
      return;
    }

    const fieldLines = current.lines;
    const fallbackDate = readField(fieldLines, 'build date/time');
    const timestamp = current.timestamp || fallbackDate;
    const note = readField(fieldLines, 'notes') || readField(fieldLines, 'note');

    entries.push({
      app: currentApp,
      timestamp,
      sortTime: parseTimestamp(timestamp),
      version: readField(fieldLines, 'version'),
      type: readField(fieldLines, 'type'),
      notes: note,
      git: readField(fieldLines, 'git'),
    });
    current = null;
  }

  for (const line of lines) {
    const appMatch = line.match(/^###\s+(.+?)\s*$/);
    if (appMatch) {
      flushCurrent();
      currentApp = appMatch[1].trim();
      continue;
    }

    const timestampEntryMatch = line.match(/^-\s+(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}\s+[A-Z]{2,4})\s*$/);
    const oldVersionEntryMatch = line.match(/^-\s+version:\s*(.+?)\s*$/i);

    if (timestampEntryMatch || oldVersionEntryMatch) {
      flushCurrent();
      current = {
        timestamp: timestampEntryMatch ? timestampEntryMatch[1] : '',
        lines: oldVersionEntryMatch ? [`  - version: ${oldVersionEntryMatch[1]}`] : [],
      };
      continue;
    }

    if (current) {
      current.lines.push(line);
    }
  }

  flushCurrent();
  return entries.filter((entry) => entry.app && (entry.timestamp || entry.version || entry.notes));
}

function truncate(value, maxLength) {
  const text = String(value || '-').replace(/\s+/g, ' ').trim() || '-';
  if (text.length <= maxLength) {
    return text;
  }
  return `${text.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}

function pad(value, width) {
  return String(value).padEnd(width, ' ');
}

function formatRows(entries) {
  const terminalWidth = process.stdout.columns || 120;
  const widths = {
    app: 18,
    version: 9,
    type: 9,
    when: 22,
  };
  const fixedWidth = widths.app + widths.version + widths.type + widths.when + 10;
  const noteWidth = Math.max(30, terminalWidth - fixedWidth);

  const header = `${pad('App', widths.app)}  ${pad('Version', widths.version)}  ${pad('Type', widths.type)}  ${pad('When', widths.when)}  Note`;
  const rule = `${'-'.repeat(widths.app)}  ${'-'.repeat(widths.version)}  ${'-'.repeat(widths.type)}  ${'-'.repeat(widths.when)}  ${'-'.repeat(noteWidth)}`;
  const body = entries.map((entry) => {
    const version = entry.version ? `v${entry.version}` : '-';
    return [
      pad(truncate(entry.app, widths.app), widths.app),
      pad(truncate(version, widths.version), widths.version),
      pad(truncate(entry.type || '-', widths.type), widths.type),
      pad(truncate(entry.timestamp || '-', widths.when), widths.when),
      truncate(entry.notes || '-', noteWidth),
    ].join('  ');
  });

  return [header, rule, ...body].join('\n');
}

function main() {
  const args = parseArgs(process.argv.slice(2));

  if (!existsSync(actionsVersioningPath)) {
    console.error(`Version log not found: ${actionsVersioningPath}`);
    process.exit(1);
  }

  const markdown = readFileSync(actionsVersioningPath, 'utf8');
  let entries = parseEntries(markdown);

  if (args.app) {
    const requestedApp = normalizeAppName(args.app);
    entries = entries.filter((entry) => normalizeAppName(entry.app) === requestedApp);
  }

  if (args.type) {
    const requestedType = String(args.type).trim().toLowerCase();
    entries = entries.filter((entry) => String(entry.type || '').trim().toLowerCase() === requestedType);
  }

  if (args.versionsOnly) {
    entries = entries.filter((entry) => entry.version);
  }

  entries = entries
    .sort((left, right) => right.sortTime - left.sortTime)
    .slice(0, args.limit);

  if (args.json) {
    console.log(JSON.stringify(entries, null, 2));
    return;
  }

  if (entries.length === 0) {
    console.log('No version log entries matched.');
    return;
  }

  console.log(formatRows(entries));
}

main();
