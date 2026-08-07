import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const defaultSource = path.resolve(repoRoot, '..', 'auth-jeffersonwm');
const sourceRoot = process.env.AUTH_SOURCE_DIR || defaultSource;
const backendTarget = process.env.AUTH_BACKEND_DIR || '\\\\JEFFERSHIZZLE-D\\Dotcoms E\\auth-jeffersonwm\\backend';

const sourceCopies = [
  '.env.development',
  '.env.example',
  '.env.production',
  '.gitignore',
  'AUTH_JEFFERSONWM_PLAN.md',
  'AUTH_JEFFERSONWM_WORKFLOW.md',
  'MULTIMILLION_WORKFLOW.md',
  'README.md',
  'auth-jeffersonwm.code-workspace',
  'dist',
  'git-banner.jpeg',
  'index.html',
  'package-lock.json',
  'package.json',
  'public',
  'server.ts',
  'src',
  'tsconfig.json',
  'vite-env.d.ts',
  'vite.config.ts',
];

const replaceBeforeCopy = [
  'dist',
  'public',
  'src',
];

const preserveOnTarget = [
  '.env',
  'data',
  'node_modules',
];

function runBuild() {
  console.log('Building Auth JeffersonWM...');
  const result = process.platform === 'win32'
    ? spawnSync('cmd.exe', ['/d', '/s', '/c', 'npm run build'], { cwd: sourceRoot, stdio: 'inherit' })
    : spawnSync('npm', ['run', 'build'], { cwd: sourceRoot, stdio: 'inherit' });

  if (result.status !== 0) {
    throw new Error(`Auth build failed with exit code ${result.status ?? 1}`);
  }
}

function copyIfPresent(sourcePath, targetPath) {
  if (!existsSync(sourcePath)) {
    return;
  }

  cpSync(sourcePath, targetPath, { recursive: true, force: true, dereference: true });
}

function syncAuthSource() {
  if (!existsSync(sourceRoot)) {
    throw new Error(`Missing Auth source folder: ${sourceRoot}`);
  }

  mkdirSync(backendTarget, { recursive: true });

  for (const relativePath of replaceBeforeCopy) {
    const targetPath = path.join(backendTarget, relativePath);
    if (existsSync(targetPath)) {
      rmSync(targetPath, { recursive: true, force: true });
    }
  }

  for (const relativePath of sourceCopies) {
    if (preserveOnTarget.includes(relativePath)) {
      continue;
    }

    copyIfPresent(path.join(sourceRoot, relativePath), path.join(backendTarget, relativePath));
  }
}

function main() {
  runBuild();

  console.log(`Syncing Auth JeffersonWM source to ${backendTarget}...`);
  syncAuthSource();

  console.log('Auth JeffersonWM publish complete.');
}

main();
