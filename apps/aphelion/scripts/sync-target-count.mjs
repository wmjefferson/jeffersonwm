import { readFileSync } from 'node:fs';
import { access, readdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const IMAGE_EXTENSIONS = new Set([
  '.jpg',
  '.jpeg',
  '.png',
  '.gif',
  '.webp',
  '.bmp',
  '.avif',
  '.tif',
  '.tiff',
]);

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const configPath = path.join(appRoot, 'src', 'config.ts');

function parseArgs(argv) {
  const args = {
    library: '',
    preview: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = argv[index + 1];

    if (arg === '--library' && next) {
      args.library = next;
      index += 1;
    } else if (arg === '--preview') {
      args.preview = true;
    }
  }

  return args;
}

function parseEnvFile(filePath) {
  try {
    const text = readFileSync(filePath, 'utf8');
    const values = {};
    for (const line of text.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) {
        continue;
      }

      const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
      if (match) {
        values[match[1]] = match[2].trim().replace(/^['"]|['"]$/g, '');
      }
    }
    return values;
  } catch {
    return {};
  }
}

function getEnvDefaults() {
  return {
    ...parseEnvFile(path.join(appRoot, '.env.production')),
    ...parseEnvFile(path.join(appRoot, '.env.development')),
    ...process.env,
  };
}

function normalizeFilePath(value) {
  return value.replace(/^['"]|['"]$/g, '').trim();
}

async function pathExists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function getLibraryRoot(args) {
  if (args.library) {
    return path.resolve(args.library);
  }

  const env = getEnvDefaults();
  const candidates = String(env.APHELION_IMAGE_DIRS || env.APHELION_IMAGE_DIR || '')
    .split(/[;,]/)
    .map(normalizeFilePath)
    .filter(Boolean)
    .map((candidate) => path.resolve(candidate));

  for (const candidate of candidates) {
    if (await pathExists(candidate)) {
      return candidate;
    }
  }

  return candidates[0] || 'E:\\images\\keep';
}

async function countImages(root) {
  let total = 0;

  async function walk(currentDir) {
    const entries = await readdir(currentDir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);

      if (entry.isDirectory()) {
        await walk(fullPath);
        continue;
      }

      if (!entry.isFile()) {
        continue;
      }

      const extension = path.extname(entry.name).toLowerCase();
      if (!IMAGE_EXTENSIONS.has(extension)) {
        continue;
      }

      const details = await stat(fullPath);
      if (details.isFile()) {
        total += 1;
      }
    }
  }

  await walk(root);
  return total;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const libraryRoot = await getLibraryRoot(args);

  if (!(await pathExists(libraryRoot))) {
    throw new Error(`Library folder not found: ${libraryRoot}`);
  }

  const count = await countImages(libraryRoot);
  const nextText = `export const DEFAULT_TARGET_COUNT = ${count};`;
  const currentText = readFileSync(configPath, 'utf8');

  if (args.preview) {
    console.log(`Library: ${libraryRoot}`);
    console.log(`Image count: ${count}`);
    return;
  }

  const updatedText = currentText.replace(
    /export const DEFAULT_TARGET_COUNT = \d+;/,
    nextText
  );

  if (updatedText === currentText) {
    console.log(`Aphelion default target count already matches ${count}.`);
    return;
  }

  await writeFile(configPath, updatedText, 'utf8');
  console.log(`Aphelion default target count updated to ${count}.`);
  console.log(`Updated: ${configPath}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
