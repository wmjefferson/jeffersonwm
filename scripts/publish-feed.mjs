import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const appRoot = path.join(repoRoot, 'apps', 'feed');
const asoPublishScript = path.join(repoRoot, 'scripts', 'publish-aso.mjs');
const backendTarget = process.env.FEED_BACKEND_DIR || '\\\\JEFFERSHIZZLE-D\\Dotcoms E\\feed\\backend';
const feedRootTarget = process.env.FEED_ROOT_DIR || '\\\\JEFFERSHIZZLE-D\\Dotcoms E\\feed';

const backendCopies = [
  '.env.example',
  '.gitignore',
  'dist',
  'git-banner.jpg',
  'index.html',
  'metadata.json',
  'package-lock.json',
  'package.json',
  'public',
  'README.md',
  'server.ts',
  'src',
  'tsconfig.json',
  'vite.config.ts',
];

const backendReplaceBeforeCopy = [
  'dist',
  'public',
  'src',
];

const feedRootCopies = [
  'CHANGELOG_WORKFLOW.md',
  'dummyfeed',
  'release-seeds',
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
  const publishArgs = [asoPublishScript, '--app', 'feed'];
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

function syncFeedSource() {
  if (!existsSync(appRoot)) {
    throw new Error(`Missing Feed source folder: ${appRoot}`);
  }

  mkdirSync(backendTarget, { recursive: true });
  mkdirSync(feedRootTarget, { recursive: true });

  for (const relativePath of backendReplaceBeforeCopy) {
    const targetPath = path.join(backendTarget, relativePath);
    if (existsSync(targetPath)) {
      rmSync(targetPath, { recursive: true, force: true });
    }
  }

  for (const relativePath of backendCopies) {
    copyIfPresent(path.join(appRoot, relativePath), path.join(backendTarget, relativePath));
  }

  for (const relativePath of feedRootCopies) {
    const targetPath = path.join(feedRootTarget, relativePath);
    if (existsSync(targetPath) && relativePath === 'release-seeds') {
      rmSync(targetPath, { recursive: true, force: true });
    }
    copyIfPresent(path.join(appRoot, relativePath), targetPath);
  }
}

function main() {
  const args = parseArgs(process.argv.slice(2));

  console.log('Publishing Feed frontend to ASO...');
  runFrontendPublish({ skipBuild: Boolean(args['skip-build']) });

  console.log(`Syncing Feed backend/source to ${backendTarget}...`);
  syncFeedSource();

  console.log('Feed publish complete.');
}

main();
