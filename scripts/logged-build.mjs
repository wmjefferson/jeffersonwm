import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const actionsVersioningPath = '\\\\JEFFERSHIZZLE-D\\Dotcoms E\\other\\actions\\versioning.md';
const appLabels = {
  battalion: 'Battalion',
  bullion: 'Bullion',
  feed: 'Feed',
  jeffersonwm: 'JeffersonWM',
  lionship: 'Lionship',
  millionfold: 'Millionfold',
  perihelion: 'Perihelion',
  tourbillion: 'Tourbillion',
  vermilion: 'Vermilion',
};

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

function getGitSummary() {
  const branchResult = spawnSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], {
    cwd: repoRoot,
    encoding: 'utf8',
  });
  const commitResult = spawnSync('git', ['rev-parse', '--short', 'HEAD'], {
    cwd: repoRoot,
    encoding: 'utf8',
  });
  const branch = branchResult.status === 0 ? branchResult.stdout.trim() : 'unknown';
  const commit = commitResult.status === 0 ? commitResult.stdout.trim() : 'unknown';
  return `${branch} ${commit}`;
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

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const app = String(args.app || '').toLowerCase();
  const appLabel = appLabels[app];

  if (!appLabel) {
    console.error(`Unknown app "${app}". Use one of: ${Object.keys(appLabels).join(', ')}`);
    process.exit(1);
  }

  const packagePath = path.join(repoRoot, 'apps', app, 'package.json');
  if (!existsSync(packagePath)) {
    console.error(`Missing package.json for ${app}: ${packagePath}`);
    process.exit(1);
  }

  const packageJson = JSON.parse(readFileSync(packagePath, 'utf8'));
  const version = packageJson.version || '0.0.0';
  const note = await getNote(args.note);

  console.log(`Building ${appLabel} v${version}...`);
  const buildResult =
    process.platform === 'win32'
      ? spawnSync('cmd.exe', ['/d', '/s', '/c', `npm run build:${app}`], {
          cwd: repoRoot,
          stdio: 'inherit',
        })
      : spawnSync('npm', ['run', `build:${app}`], {
          cwd: repoRoot,
          stdio: 'inherit',
        });

  if (buildResult.status !== 0) {
    console.error(`Build failed for ${appLabel}; no actions log entry was written.`);
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
    `  - git: ${getGitSummary()}\n`,
  ].join('');
  const current = readFileSync(actionsVersioningPath, 'utf8');
  writeFileSync(actionsVersioningPath, appendBuildEntry(current, appLabel, entry), 'utf8');
  console.log(`Logged ${appLabel} v${version} build to ${actionsVersioningPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
