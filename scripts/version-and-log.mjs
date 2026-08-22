import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dotcomsRoot = path.resolve(repoRoot, '..');

const appRegistry = {
  aphelion: monorepoApp('Aphelion', 'aphelion', 'aphelion'),
  battalion: monorepoApp('Battalion', 'battalion', 'battalion'),
  batt: monorepoApp('Battalion', 'battalion', 'batt'),
  bullion: monorepoApp('Bullion', 'bullion', 'bullion'),
  feed: monorepoApp('Feed', 'feed', 'feed'),
  jeffersonwm: monorepoApp('JeffersonWM', 'jeffersonwm', 'jeffersonwm'),
  jeffwm: monorepoApp('JeffersonWM', 'jeffersonwm', 'jeffwm'),
  lionship: monorepoApp('Lionship', 'lionship', 'lionship'),
  millionfold: monorepoApp('Millionfold', 'millionfold', 'millionfold'),
  mill: monorepoApp('Millionfold', 'millionfold', 'mill'),
  perihelion: monorepoApp('Perihelion', 'perihelion', 'perihelion'),
  peri: monorepoApp('Perihelion', 'perihelion', 'peri'),
  tourbillion: monorepoApp('Tourbillion', 'tourbillion', 'tourbillion'),
  tourb: monorepoApp('Tourbillion', 'tourbillion', 'tourb'),
  vermilion: monorepoApp('Vermilion', 'vermilion', 'vermilion'),
  verm: monorepoApp('Vermilion', 'vermilion', 'verm'),
  auth: standaloneApp('Auth / Multimillion', 'auth-jeffersonwm', 'auth'),
  copy: standaloneApp('Copy', 'copy', 'copy'),
  dookydetective: standaloneApp('Dooky Detective', 'dookydetective', 'dookydetective'),
  dooky: standaloneApp('Dooky Detective', 'dookydetective', 'dooky'),
  jeffershizzle: standaloneApp('Jeffershizzle', 'jeffershizzle', 'jeffershizzle'),
  shizzle: standaloneApp('Jeffershizzle', 'jeffershizzle', 'shizzle'),
  multimillion: standaloneApp('Auth / Multimillion', 'multimillion', 'multimillion'),
  wmjefferson: standaloneApp('WM Jefferson', 'wmjefferson', 'wmjefferson'),
  wmjeff: standaloneApp('WM Jefferson', 'wmjefferson', 'wmjeff'),
};

function monorepoApp(label, slug, logKey = slug) {
  const cwd = path.join(repoRoot, 'apps', slug);
  return { label, cwd, packagePath: path.join(cwd, 'package.json'), logKey };
}

function standaloneApp(label, folderName, logKey = folderName) {
  const cwd = path.join(dotcomsRoot, folderName);
  return { label, cwd, packagePath: path.join(cwd, 'package.json'), logKey };
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

function runCommand(command, args, cwd) {
  if (process.platform === 'win32') {
    return spawnSync('cmd.exe', ['/d', '/s', '/c', `${command} ${args.map(quoteForCmd).join(' ')}`], {
      cwd,
      stdio: 'inherit',
    });
  }

  return spawnSync(command, args, {
    cwd,
    stdio: 'inherit',
  });
}

function quoteForCmd(value) {
  if (!/[ \t"]/u.test(value)) {
    return value;
  }

  return `"${value.replaceAll('"', '\\"')}"`;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const appName = String(args.app || '').toLowerCase();
  const bumpType = String(args.type || '').toLowerCase();
  const appConfig = appRegistry[appName];

  if (!appConfig) {
    console.error(`Unknown app "${appName}".`);
    process.exit(1);
  }

  if (!['patch', 'minor', 'major'].includes(bumpType)) {
    console.error(`Unsupported version type "${bumpType}". Use patch, minor, or major.`);
    process.exit(1);
  }

  if (!existsSync(appConfig.packagePath)) {
    console.error(`Missing package.json for ${appConfig.label}: ${appConfig.packagePath}`);
    process.exit(1);
  }

  console.log(`Bumping ${appConfig.label} with npm version ${bumpType}...`);
  const versionResult = runCommand('npm', ['version', bumpType, '--no-git-tag-version'], appConfig.cwd);

  if (versionResult.status !== 0) {
    process.exit(versionResult.status || 1);
  }

  const loggedBuildArgs = ['scripts/logged-build.mjs', '--app', appConfig.logKey];
  if (typeof args.note === 'string' && args.note.trim()) {
    loggedBuildArgs.push('--note', args.note.trim());
  }

  console.log(`Running logged build for ${appConfig.label}...`);
  const logResult = runCommand('node', loggedBuildArgs, repoRoot);

  if (logResult.status !== 0) {
    process.exit(logResult.status || 1);
  }
}

main();
