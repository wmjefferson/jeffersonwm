import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = process.env.JEFFWM_ROOT || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dotcomsRoot = path.resolve(repoRoot, '..');
const publicVersionsPath = path.join(repoRoot, 'apps', 'jeffersonwm', 'public', 'versions.json');

const apps = [
  monorepoApp('JeffersonWM Home', 'jeffersonwm'),
  monorepoApp('Feed', 'feed'),
  monorepoApp('Perihelion', 'perihelion'),
  monorepoApp('Battalion', 'battalion'),
  monorepoApp('Lionship', 'lionship'),
  monorepoApp('Millionfold', 'millionfold'),
  monorepoApp('Vermilion', 'vermilion'),
  monorepoApp('Tourbillion', 'tourbillion'),
  monorepoApp('Bullion', 'bullion'),
  standaloneApp('Auth / Multimillion', 'auth-jeffersonwm', 'auth'),
  standaloneApp('Clionidae', 'clionidae'),
  standaloneApp('Dooky Detective', 'dookydetective'),
  standaloneApp('WM Jefferson', 'wmjefferson'),
  standaloneApp('Multimillion', 'multimillion'),
  registryApp('Stallioneer', 'stallioneer'),
  registryApp('Jeffershizzle', 'jeffershizzle'),
];

function monorepoApp(label, slug, key = slug) {
  return {
    key,
    label,
    source: 'package',
    packagePath: path.join(repoRoot, 'apps', slug, 'package.json'),
  };
}

function standaloneApp(label, folderName, key = folderName) {
  return {
    key,
    label,
    source: 'package',
    packagePath: path.join(dotcomsRoot, folderName, 'package.json'),
  };
}

function registryApp(label, key) {
  return {
    key,
    label,
    source: 'versions.json',
    packagePath: null,
  };
}

function readPublicVersions() {
  if (!existsSync(publicVersionsPath)) {
    return {};
  }

  const parsed = JSON.parse(readFileSync(publicVersionsPath, 'utf8'));
  return parsed.apps && typeof parsed.apps === 'object' ? parsed.apps : parsed;
}

function readPackage(app) {
  if (!app.packagePath || !existsSync(app.packagePath)) {
    return null;
  }

  return JSON.parse(readFileSync(app.packagePath, 'utf8'));
}

const publicVersions = readPublicVersions();
const rows = apps.map((app) => {
  const packageJson = readPackage(app);
  const registryEntry = publicVersions[app.key];

  return {
    app: app.key,
    name: app.label,
    version: packageJson?.version || registryEntry?.version || '-',
    packageName: packageJson?.name || '-',
    source: packageJson ? app.source : 'versions.json',
  };
});

const appWidth = Math.max('App'.length, ...rows.map((row) => row.app.length));
const nameWidth = Math.max('Name'.length, ...rows.map((row) => row.name.length));
const versionWidth = Math.max('Version'.length, ...rows.map((row) => row.version.length + 1));
const packageWidth = Math.max('Package'.length, ...rows.map((row) => row.packageName.length));

console.log(`${'App'.padEnd(appWidth)}  ${'Name'.padEnd(nameWidth)}  ${'Version'.padEnd(versionWidth)}  ${'Package'.padEnd(packageWidth)}  Source`);
console.log(`${'-'.repeat(appWidth)}  ${'-'.repeat(nameWidth)}  ${'-'.repeat(versionWidth)}  ${'-'.repeat(packageWidth)}  ${'-'.repeat(6)}`);

for (const row of rows) {
  const version = row.version === '-' ? '-' : `v${row.version}`;
  console.log(`${row.app.padEnd(appWidth)}  ${row.name.padEnd(nameWidth)}  ${version.padEnd(versionWidth)}  ${row.packageName.padEnd(packageWidth)}  ${row.source}`);
}
