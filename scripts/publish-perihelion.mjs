import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const appRoot = path.join(repoRoot, 'apps', 'perihelion');
const backendSource = path.join(appRoot, 'backend');
const asoPublishScript = path.join(repoRoot, 'scripts', 'publish-aso.mjs');
const backendTarget = process.env.PERIHELION_BACKEND_DIR || '\\\\JEFFERSHIZZLE-D\\Dotcoms E\\perihelion\\backend';
const scriptsTarget = process.env.PERIHELION_SCRIPTS_DIR || '\\\\JEFFERSHIZZLE-D\\Dotcoms E\\scripts';

const backendCopies = [
  'README.md',
  'SYNC_TO_HOME_SERVER.md',
  'git-banner.jpeg',
  'perihelion_images_api.py',
  'requirements.txt',
];

const backendPrunes = [
  '__pycache__',
];

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

function runFrontendPublish({ skipBuild = false } = {}) {
  const publishArgs = [asoPublishScript, '--app', 'perihelion'];
  if (skipBuild) {
    publishArgs.push('--skip-build');
  }

  const result = spawnSync('node', publishArgs, {
    cwd: repoRoot,
    stdio: 'inherit',
  });

  if (result.status !== 0) {
    throw new Error(`Frontend publish failed with exit code ${result.status ?? 1}`);
  }
}

function copyIfPresent(sourcePath, targetPath) {
  if (!existsSync(sourcePath)) {
    return;
  }

  cpSync(sourcePath, targetPath, { recursive: true, force: true, dereference: true });
}

function syncBackendSource() {
  if (!existsSync(backendSource)) {
    throw new Error(`Missing Perihelion backend source folder: ${backendSource}`);
  }

  mkdirSync(backendTarget, { recursive: true });

  for (const relativePath of backendCopies) {
    copyIfPresent(path.join(backendSource, relativePath), path.join(backendTarget, relativePath));
  }

  for (const relativePath of backendPrunes) {
    const targetPath = path.join(backendTarget, relativePath);
    if (existsSync(targetPath)) {
      rmSync(targetPath, { recursive: true, force: true });
    }
  }

  const apiScript = path.join(backendSource, 'perihelion_images_api.py');
  if (existsSync(apiScript)) {
    mkdirSync(scriptsTarget, { recursive: true });
    copyIfPresent(apiScript, path.join(scriptsTarget, 'perihelion_images_api.py'));
  }
}

function main() {
  const args = parseArgs(process.argv.slice(2));

  console.log('Publishing Perihelion frontend to ASO...');
  runFrontendPublish({ skipBuild: Boolean(args['skip-build']) });

  console.log(`Syncing Perihelion backend source to ${backendTarget}...`);
  syncBackendSource();

  console.log('Perihelion publish complete.');
}

main();
