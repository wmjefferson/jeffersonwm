import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const defaultSource = path.resolve(repoRoot, '..', 'copy');
const sourceRoot = process.env.COPY_SOURCE_DIR || defaultSource;
const backendTarget = process.env.COPY_BACKEND_DIR || '\\\\JEFFERSHIZZLE-D\\Dotcoms E\\copy';

const sourceCopies = [
  '.env.example',
  'README.md',
  'package-lock.json',
  'package.json',
  'scripts',
  'server.ts',
  'text',
  'tsconfig.json',
];

const replaceBeforeCopy = [
  'text',
];

function runBuild() {
  console.log('Building Copy...');
  const result = process.platform === 'win32'
    ? spawnSync('cmd.exe', ['/d', '/s', '/c', 'npm run build'], { cwd: sourceRoot, stdio: 'inherit' })
    : spawnSync('npm', ['run', 'build'], { cwd: sourceRoot, stdio: 'inherit' });

  if (result.status !== 0) {
    throw new Error(`Copy build failed with exit code ${result.status ?? 1}`);
  }
}

function runSnapshot() {
  console.log('Creating Copy snapshot...');
  const result = process.platform === 'win32'
    ? spawnSync('cmd.exe', ['/d', '/s', '/c', 'npm run snapshot -- --label publish-copy'], { cwd: sourceRoot, stdio: 'inherit' })
    : spawnSync('npm', ['run', 'snapshot', '--', '--label', 'publish-copy'], { cwd: sourceRoot, stdio: 'inherit' });

  if (result.status !== 0) {
    throw new Error(`Copy snapshot failed with exit code ${result.status ?? 1}`);
  }
}

function copyIfPresent(sourcePath, targetPath) {
  if (!existsSync(sourcePath)) {
    return;
  }

  cpSync(sourcePath, targetPath, { recursive: true, force: true, dereference: true });
}

function syncCopySource() {
  if (!existsSync(sourceRoot)) {
    throw new Error(`Missing Copy source folder: ${sourceRoot}`);
  }

  mkdirSync(backendTarget, { recursive: true });

  for (const relativePath of replaceBeforeCopy) {
    const targetPath = path.join(backendTarget, relativePath);
    if (existsSync(targetPath)) {
      rmSync(targetPath, { recursive: true, force: true });
    }
  }

  for (const relativePath of sourceCopies) {
    copyIfPresent(path.join(sourceRoot, relativePath), path.join(backendTarget, relativePath));
  }
}

function main() {
  runBuild();
  runSnapshot();

  console.log(`Syncing Copy source to ${backendTarget}...`);
  syncCopySource();

  console.log('Copy publish complete.');
}

main();
