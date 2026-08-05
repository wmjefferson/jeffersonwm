import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dotcomsRoot = path.resolve(repoRoot, '..');
const actionsVersioningPath = '\\\\JEFFERSHIZZLE-D\\Dotcoms E\\other\\actions\\versioning.md';
const publicVersionsPath = path.join(repoRoot, 'apps', 'jeffersonwm', 'public', 'versions.json');
const distVersionsPath = path.join(repoRoot, 'apps', 'jeffersonwm', 'dist', 'versions.json');

const appRegistry = {
  battalion: monorepoApp('Battalion', 'battalion'),
  batt: monorepoApp('Battalion', 'battalion'),
  bullion: monorepoApp('Bullion', 'bullion'),
  feed: monorepoApp('Feed', 'feed'),
  jeffersonwm: monorepoApp('JeffersonWM', 'jeffersonwm'),
  jeffwm: monorepoApp('JeffersonWM', 'jeffersonwm'),
  lionship: monorepoApp('Lionship', 'lionship'),
  millionfold: monorepoApp('Millionfold', 'millionfold'),
  mill: monorepoApp('Millionfold', 'millionfold'),
  perihelion: monorepoApp('Perihelion', 'perihelion'),
  peri: monorepoApp('Perihelion', 'perihelion'),
  tourbillion: monorepoApp('Tourbillion', 'tourbillion'),
  tourb: monorepoApp('Tourbillion', 'tourbillion'),
  vermilion: monorepoApp('Vermilion', 'vermilion'),
  verm: monorepoApp('Vermilion', 'vermilion'),
  auth: standaloneApp('Auth / Multimillion', 'auth-jeffersonwm'),
  'auth-jeffersonwm': standaloneApp('Auth / Multimillion', 'auth-jeffersonwm'),
  clionidae: standaloneApp('Clionidae', 'clionidae'),
  clio: standaloneApp('Clionidae', 'clionidae'),
  dookydetective: standaloneApp('Dooky Detective', 'dookydetective'),
  dooky: standaloneApp('Dooky Detective', 'dookydetective'),
  multimillion: standaloneApp('Auth / Multimillion', 'multimillion'),
  wmjefferson: standaloneApp('WM Jefferson', 'wmjefferson'),
  wmjeff: standaloneApp('WM Jefferson', 'wmjefferson'),
};

function monorepoApp(label, slug, key = slug) {
  const cwd = path.join(repoRoot, 'apps', slug);
  return { key, label, cwd, packagePath: path.join(cwd, 'package.json') };
}

function standaloneApp(label, folderName, key = folderName) {
  const cwd = path.join(dotcomsRoot, folderName);
  return { key, label, cwd, packagePath: path.join(cwd, 'package.json') };
}

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (!value.startsWith('--')) {
      continue;
    }
    const key = value.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith('--')) {
      args[key] = true;
      continue;
    }
    args[key] = next;
    index += 1;
  }
  return args;
}

function getPacificStamp() {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Los_Angeles',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    hourCycle: 'h23',
    timeZoneName: 'short',
  });
  const parts = Object.fromEntries(formatter.formatToParts(new Date()).map((part) => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute} ${parts.timeZoneName}`;
}

function getGitSummary(cwd) {
  const branchResult = spawnSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], {
    cwd,
    encoding: 'utf8',
  });
  const commitResult = spawnSync('git', ['rev-parse', '--short', 'HEAD'], {
    cwd,
    encoding: 'utf8',
  });
  const branch = branchResult.status === 0 ? branchResult.stdout.trim() : 'unknown';
  const commit = commitResult.status === 0 ? commitResult.stdout.trim() : 'unknown';
  return `${branch} ${commit}`;
}

function runBuild(appLabel, cwd) {
  console.log(`Building ${appLabel}...`);
  if (process.platform === 'win32') {
    return spawnSync('cmd.exe', ['/d', '/s', '/c', 'npm run build'], {
      cwd,
      stdio: 'inherit',
    });
  }

  return spawnSync('npm', ['run', 'build'], {
    cwd,
    stdio: 'inherit',
  });
}

async function getNote(providedNote) {
  if (typeof providedNote === 'string' && providedNote.trim()) {
    return providedNote.trim();
  }

  if (!process.stdin.isTTY) {
    return 'manual logged build';
  }

  const rl = readline.createInterface({ input, output });
  const answer = await rl.question('Build note: ');
  rl.close();
  return answer.trim() || 'manual logged build';
}

function ensureBuildLogSection(contents) {
  if (contents.includes('\n## Build Log')) {
    return contents;
  }
  return `${contents.trimEnd()}\n\n## Build Log\n`;
}

function appendBuildEntry(contents, appLabel, entry) {
  let nextContents = ensureBuildLogSection(contents);
  const sectionHeader = `### ${appLabel}`;
  const sectionIndex = nextContents.search(new RegExp(`^###\\s+${appLabel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`, 'm'));

  if (sectionIndex === -1) {
    return `${nextContents.trimEnd()}\n\n${sectionHeader}\n${entry}`;
  }

  const insertionPoint = nextContents.indexOf('\n', sectionIndex);
  return `${nextContents.slice(0, insertionPoint + 1)}${entry}${nextContents.slice(insertionPoint + 1)}`;
}

function readPublicVersions() {
  if (!existsSync(publicVersionsPath)) {
    return { updatedAt: null, apps: {} };
  }

  const parsed = JSON.parse(readFileSync(publicVersionsPath, 'utf8'));
  return {
    ...parsed,
    apps: parsed.apps && typeof parsed.apps === 'object' ? parsed.apps : {},
  };
}

function writePublicVersionsFile(filePath, data) {
  writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

function updatePublicVersions(appConfig, version, timestamp) {
  const nextVersions = readPublicVersions();
  nextVersions.updatedAt = new Date().toISOString();
  nextVersions.apps[appConfig.key] = {
    label: appConfig.label,
    version,
    updatedAt: timestamp,
  };

  writePublicVersionsFile(publicVersionsPath, nextVersions);

  if (existsSync(path.dirname(distVersionsPath))) {
    writePublicVersionsFile(distVersionsPath, nextVersions);
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const app = String(args.app || '').toLowerCase();
  const appConfig = appRegistry[app];

  if (!appConfig) {
    console.error(`Unknown app "${app}". Use one of: ${Object.keys(appRegistry).sort().join(', ')}`);
    process.exit(1);
  }

  if (!existsSync(appConfig.packagePath)) {
    console.error(`Missing package.json for ${app}: ${appConfig.packagePath}`);
    process.exit(1);
  }

  const packageJson = JSON.parse(readFileSync(appConfig.packagePath, 'utf8'));
  const version = packageJson.version || '0.0.0';
  const note = await getNote(args.note);

  console.log(`Preparing ${appConfig.label} v${version} from ${appConfig.cwd}`);
  const buildResult = runBuild(appConfig.label, appConfig.cwd);

  if (buildResult.status !== 0) {
    console.error(`Build failed for ${appConfig.label}; no actions log entry was written.`);
    process.exit(buildResult.status || 1);
  }

  if (!existsSync(actionsVersioningPath)) {
    console.error(`Build succeeded, but versioning.md was not found: ${actionsVersioningPath}`);
    process.exit(1);
  }

  const timestamp = getPacificStamp();
  const entry = [
    `- ${timestamp}\n`,
    `  - version: ${version}\n`,
    `  - type: build\n`,
    `  - notes: ${note}\n`,
    `  - git: ${getGitSummary(appConfig.cwd)}\n`,
  ].join('');
  const current = readFileSync(actionsVersioningPath, 'utf8');
  writeFileSync(actionsVersioningPath, appendBuildEntry(current, appConfig.label, entry), 'utf8');
  updatePublicVersions(appConfig, version, timestamp);
  console.log(`Logged ${appConfig.label} v${version} build to ${actionsVersioningPath}`);
  console.log(`Updated public versions file: ${publicVersionsPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
