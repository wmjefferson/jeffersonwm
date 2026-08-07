import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const appRoot = path.join(repoRoot, 'apps', 'aphelion');
const asoPublishScript = path.join(repoRoot, 'scripts', 'publish-aso.mjs');
const backendTarget = process.env.APHELION_BACKEND_DIR || '\\\\JEFFERSHIZZLE-D\\Dotcoms E\\aphelion';

const backendCopies = [
  '.env.development',
  '.env.example',
  '.env.production',
  'assets',
  'dist',
  'index.html',
  'metadata.json',
  'package-lock.json',
  'package.json',
  'README.md',
  'server.ts',
  'src',
  'start-tunnel-dev.ps1',
  'start-tunnel-live.ps1',
  'tsconfig.json',
  'vite.config.ts',
];

const backendPrunes = [
  'start-api-dev.ps1',
  'start-api-live.ps1',
];

function runFrontendPublish() {
  const result = spawnSync('node', [asoPublishScript, '--app', 'aphelion'], {
    cwd: repoRoot,
    stdio: 'inherit',
  });

  if (result.status !== 0) {
    throw new Error(`Frontend publish failed with exit code ${result.status ?? 1}`);
  }
}

function syncBackendSource() {
  if (!existsSync(appRoot)) {
    throw new Error(`Missing Aphelion source folder: ${appRoot}`);
  }

  mkdirSync(backendTarget, { recursive: true });

  for (const relativePath of backendCopies) {
    const sourcePath = path.join(appRoot, relativePath);
    if (!existsSync(sourcePath)) {
      continue;
    }

    const targetPath = path.join(backendTarget, relativePath);
    cpSync(sourcePath, targetPath, { recursive: true, force: true, dereference: true });
  }

  for (const relativePath of backendPrunes) {
    const targetPath = path.join(backendTarget, relativePath);
    if (existsSync(targetPath)) {
      rmSync(targetPath, { recursive: true, force: true });
    }
  }
}

function main() {
  console.log('Publishing Aphelion frontend to ASO...');
  runFrontendPublish();

  console.log(`Syncing Aphelion backend source to ${backendTarget}...`);
  syncBackendSource();

  console.log('Aphelion publish complete.');
}

main();
