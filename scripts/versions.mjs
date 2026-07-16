import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = process.env.JEFFWM_ROOT || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const appsRoot = path.join(repoRoot, 'apps');

if (!existsSync(appsRoot)) {
  console.error(`Could not find apps folder: ${appsRoot}`);
  process.exit(1);
}

const rows = readdirSync(appsRoot, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => {
    const packagePath = path.join(appsRoot, entry.name, 'package.json');
    if (!existsSync(packagePath)) {
      return {
        app: entry.name,
        version: '-',
        name: '(no package.json)',
      };
    }

    const packageJson = JSON.parse(readFileSync(packagePath, 'utf8'));
    return {
      app: entry.name,
      version: packageJson.version || '-',
      name: packageJson.name || entry.name,
    };
  })
  .sort((left, right) => left.app.localeCompare(right.app));

const appWidth = Math.max('App'.length, ...rows.map((row) => row.app.length));
const versionWidth = Math.max('Version'.length, ...rows.map((row) => row.version.length + 1));

console.log(`${'App'.padEnd(appWidth)}  ${'Version'.padEnd(versionWidth)}  Package`);
console.log(`${'-'.repeat(appWidth)}  ${'-'.repeat(versionWidth)}  ${'-'.repeat(7)}`);

for (const row of rows) {
  const version = row.version === '-' ? '-' : `v${row.version}`;
  console.log(`${row.app.padEnd(appWidth)}  ${version.padEnd(versionWidth)}  ${row.name}`);
}
