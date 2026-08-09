import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { readFileSync } from 'node:fs';
import { access, mkdir, readFile, readdir, rename, stat, writeFile } from 'node:fs/promises';
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

function parseArgs(argv) {
  const args = {
    apply: false,
    preview: false,
    blockSize: 1000,
    digits: 5,
    library: '',
    incoming: '',
    history: '',
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = argv[index + 1];

    if (arg === '--apply') {
      args.apply = true;
    } else if (arg === '--preview') {
      args.preview = true;
    } else if (arg === '--library' && next) {
      args.library = next;
      index += 1;
    } else if (arg === '--incoming' && next) {
      args.incoming = next;
      index += 1;
    } else if (arg === '--history' && next) {
      args.history = next;
      index += 1;
    } else if (arg === '--block-size' && next) {
      args.blockSize = Number(next);
      index += 1;
    } else if (arg === '--digits' && next) {
      args.digits = Number(next);
      index += 1;
    } else if (arg === '--help' || arg === '-h') {
      args.help = true;
    }
  }

  return args;
}

function printHelp() {
  console.log(`
Aphelion rename utility

Preview the library rename plan:
  npm run rename:preview

Apply the library rename plan:
  npm run rename:apply

Check an outside folder for duplicates before importing:
  npm run rename:check -- --incoming "E:\\outside-folder"

Options:
  --library <path>      Image library root. Defaults to APHELION_IMAGE_DIR(S), then E:\\images\\keep.
  --incoming <path>     Outside folder to compare against rename history and current library hashes.
  --history <path>      Rename history file. Defaults to <library>\\.aphelion-rename-history.json.
  --block-size <n>      Number range reserved per folder. Default: 1000.
  --digits <n>          Sequence filename width. Default: 5.
  --apply               Actually rename files and write history.
  --preview             Preview only. This is the default.
`);
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
      if (!match) {
        continue;
      }
      values[match[1]] = match[2].trim().replace(/^['"]|['"]$/g, '');
    }
    return values;
  } catch {
    return {};
  }
}

function getEnvDefaults() {
  const productionEnv = parseEnvFile(path.join(appRoot, '.env.production'));
  const developmentEnv = parseEnvFile(path.join(appRoot, '.env.development'));
  return {
    ...developmentEnv,
    ...productionEnv,
    ...process.env,
  };
}

function normalizeFilePath(value) {
  return value.replace(/^['"]|['"]$/g, '').trim().replace(/\\\\/g, '\\');
}

function getLibraryCandidates(args) {
  if (args.library) {
    return [path.resolve(args.library)];
  }

  const env = getEnvDefaults();
  const dirs = String(env.APHELION_IMAGE_DIRS || env.APHELION_IMAGE_DIR || '')
    .split(/[;,]/)
    .map(normalizeFilePath)
    .filter(Boolean);

  return (dirs.length ? dirs : ['E:\\images\\keep']).map((candidate) => path.resolve(candidate));
}

async function getDefaultLibrary(args) {
  const candidates = getLibraryCandidates(args);
  if (args.library) {
    return candidates[0];
  }

  for (const candidate of candidates) {
    if (await pathExists(candidate)) {
      return candidate;
    }
  }

  return candidates[0];
}

async function pathExists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

function toPosixRelative(root, filePath) {
  return path.relative(root, filePath).replace(/\\/g, '/');
}

function normalizeKey(value) {
  return value.replace(/\\/g, '/').toLowerCase();
}

async function walkImages(root) {
  const files = [];

  async function walk(currentDir) {
    const entries = await readdir(currentDir, { withFileTypes: true });
    entries.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));

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

      const stats = await stat(fullPath);
      files.push({
        fullPath,
        relativePath: toPosixRelative(root, fullPath),
        directory: toPosixRelative(root, path.dirname(fullPath)) || '.',
        basename: path.basename(fullPath),
        stem: path.basename(fullPath, path.extname(fullPath)),
        extension,
        size: stats.size,
        mtimeMs: stats.mtimeMs,
      });
    }
  }

  await walk(root);
  files.sort((a, b) => a.relativePath.localeCompare(b.relativePath, undefined, { numeric: true, sensitivity: 'base' }));
  return files;
}

async function hashFile(filePath) {
  return new Promise((resolve, reject) => {
    const hash = createHash('sha256');
    const stream = createReadStream(filePath);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('error', reject);
    stream.on('end', () => resolve(hash.digest('hex')));
  });
}

async function loadHistory(historyPath) {
  if (!(await pathExists(historyPath))) {
    return {
      app: 'aphelion',
      createdAt: new Date().toISOString(),
      updatedAt: null,
      entries: [],
    };
  }

  const parsed = JSON.parse(await readFile(historyPath, 'utf8'));
  return {
    app: 'aphelion',
    createdAt: parsed.createdAt || new Date().toISOString(),
    updatedAt: parsed.updatedAt || null,
    entries: Array.isArray(parsed.entries) ? parsed.entries : [],
  };
}

function isSequenced(stem, digits) {
  return new RegExp(`^\\d{${digits}}$`).test(stem);
}

function sequenceName(value, digits, extension) {
  return `${String(value).padStart(digits, '0')}${extension.toLowerCase()}`;
}

function buildRenamePlan(files, { blockSize, digits }) {
  const directories = Array.from(new Set(files.map((file) => file.directory))).sort((a, b) =>
    a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
  );
  const directoryBlocks = new Map(directories.map((directory, index) => [directory, index]));
  const usedTargets = new Set(files.map((file) => normalizeKey(file.relativePath)));
  const plan = [];
  const warnings = [];

  for (const directory of directories) {
    const folderFiles = files
      .filter((file) => file.directory === directory)
      .sort((a, b) => a.basename.localeCompare(b.basename, undefined, { numeric: true, sensitivity: 'base' }));
    const blockIndex = directoryBlocks.get(directory);
    const start = blockIndex * blockSize + 1;
    const end = start + blockSize - 1;
    let nextNumber = start;

    if (folderFiles.length > blockSize) {
      warnings.push(`${directory} has ${folderFiles.length} images, which exceeds the ${blockSize} number block.`);
    }

    for (const file of folderFiles) {
      if (isSequenced(file.stem, digits)) {
        const currentNumber = Number(file.stem);
        if (currentNumber < start || currentNumber > end) {
          warnings.push(`${file.relativePath} is already sequenced, but outside its folder block ${start}-${end}. Preserving it.`);
        }
        continue;
      }

      while (usedTargets.has(normalizeKey(path.posix.join(directory === '.' ? '' : directory, sequenceName(nextNumber, digits, file.extension))))) {
        nextNumber += 1;
      }

      if (nextNumber > end) {
        warnings.push(`${directory} ran out of available numbers in block ${start}-${end}; assigning ${nextNumber}.`);
      }

      const newBasename = sequenceName(nextNumber, digits, file.extension);
      const newRelativePath = path.posix.join(directory === '.' ? '' : directory, newBasename);
      usedTargets.add(normalizeKey(newRelativePath));
      plan.push({
        ...file,
        newBasename,
        newRelativePath,
        newFullPath: path.join(path.dirname(file.fullPath), newBasename),
        sequenceNumber: nextNumber,
        folderBlock: `${start}-${end}`,
      });
      nextNumber += 1;
    }
  }

  return { plan, warnings, directories };
}

function buildHistoryIndexes(history) {
  const originalNames = new Map();
  const originalPaths = new Map();
  const hashes = new Map();

  for (const entry of history.entries) {
    if (entry.oldBasename) {
      originalNames.set(normalizeKey(entry.oldBasename), entry);
    }
    if (entry.oldRelativePath) {
      originalPaths.set(normalizeKey(entry.oldRelativePath), entry);
    }
    if (entry.sha256) {
      hashes.set(entry.sha256, entry);
    }
  }

  return { originalNames, originalPaths, hashes };
}

async function scanIncoming(incomingRoot, history, libraryFiles) {
  const incomingFiles = await walkImages(incomingRoot);
  const indexes = buildHistoryIndexes(history);
  const currentLibraryNames = new Map(libraryFiles.map((file) => [normalizeKey(file.basename), file]));
  const currentLibraryPaths = new Map(libraryFiles.map((file) => [normalizeKey(file.relativePath), file]));
  const currentLibraryHashes = new Map();

  for (const file of libraryFiles) {
    const sha256 = await hashFile(file.fullPath);
    currentLibraryHashes.set(sha256, file);
  }

  const results = [];
  for (const file of incomingFiles) {
    const sha256 = await hashFile(file.fullPath);
    const oldNameMatch = indexes.originalNames.get(normalizeKey(file.basename));
    const oldPathMatch = indexes.originalPaths.get(normalizeKey(file.relativePath));
    const oldHashMatch = indexes.hashes.get(sha256);
    const currentNameMatch = currentLibraryNames.get(normalizeKey(file.basename));
    const currentPathMatch = currentLibraryPaths.get(normalizeKey(file.relativePath));
    const currentHashMatch = currentLibraryHashes.get(sha256);

    results.push({
      relativePath: file.relativePath,
      basename: file.basename,
      sha256,
      status: oldNameMatch || oldPathMatch || oldHashMatch || currentNameMatch || currentPathMatch || currentHashMatch
        ? 'duplicate-or-previously-imported'
        : 'new',
      matches: {
        oldName: oldNameMatch?.newRelativePath || null,
        oldPath: oldPathMatch?.newRelativePath || null,
        oldHash: oldHashMatch?.newRelativePath || null,
        currentName: currentNameMatch?.relativePath || null,
        currentPath: currentPathMatch?.relativePath || null,
        currentHash: currentHashMatch?.relativePath || null,
      },
    });
  }

  return results;
}

async function applyRenamePlan(plan, libraryRoot, history, historyPath) {
  const tempMoves = [];
  const finalMoves = [];
  const timestamp = new Date().toISOString();

  for (const item of plan) {
    const tempPath = path.join(path.dirname(item.fullPath), `.aphelion-renaming-${Date.now()}-${Math.random().toString(36).slice(2)}-${item.basename}`);
    tempMoves.push({ from: item.fullPath, to: tempPath });
    finalMoves.push({ from: tempPath, to: item.newFullPath, item });
  }

  for (const move of tempMoves) {
    await rename(move.from, move.to);
  }

  const newEntries = [];
  for (const move of finalMoves) {
    await rename(move.from, move.to);
    const sha256 = await hashFile(move.to);
    newEntries.push({
      renamedAt: timestamp,
      oldRelativePath: move.item.relativePath,
      newRelativePath: toPosixRelative(libraryRoot, move.to),
      oldBasename: move.item.basename,
      newBasename: path.basename(move.to),
      sha256,
      size: move.item.size,
      mtimeMs: move.item.mtimeMs,
      sequenceNumber: move.item.sequenceNumber,
      folderBlock: move.item.folderBlock,
    });
  }

  history.updatedAt = timestamp;
  history.entries = [...history.entries, ...newEntries];
  await mkdir(path.dirname(historyPath), { recursive: true });
  await writeFile(historyPath, `${JSON.stringify(history, null, 2)}\n`, 'utf8');

  return newEntries;
}

function summarizeIncoming(results) {
  const duplicateCount = results.filter((item) => item.status !== 'new').length;
  const newCount = results.length - duplicateCount;
  console.log(`Incoming scan: ${results.length} file(s), ${newCount} new, ${duplicateCount} duplicate/previously imported.`);

  for (const item of results.filter((result) => result.status !== 'new').slice(0, 25)) {
    const matches = Object.entries(item.matches)
      .filter(([, value]) => value)
      .map(([key, value]) => `${key}: ${value}`)
      .join('; ');
    console.log(`  DUPLICATE ${item.relativePath} -> ${matches}`);
  }

  if (duplicateCount > 25) {
    console.log(`  ...and ${duplicateCount - 25} more duplicate/previously imported file(s).`);
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    return;
  }

  const libraryRoot = await getDefaultLibrary(args);
  const historyPath = path.resolve(args.history || path.join(libraryRoot, '.aphelion-rename-history.json'));

  if (!(await pathExists(libraryRoot))) {
    throw new Error(`Library folder not found: ${libraryRoot}`);
  }

  const libraryFiles = await walkImages(libraryRoot);
  const history = await loadHistory(historyPath);
  const { plan, warnings, directories } = buildRenamePlan(libraryFiles, args);

  console.log(`Aphelion rename utility`);
  console.log(`Library: ${libraryRoot}`);
  console.log(`History: ${historyPath}`);
  console.log(`Folders: ${directories.length}`);
  console.log(`Images: ${libraryFiles.length}`);
  console.log(`Planned renames: ${plan.length}`);
  console.log(`Mode: ${args.apply ? 'APPLY' : 'PREVIEW'}`);

  if (warnings.length) {
    console.log(`Warnings:`);
    for (const warning of warnings.slice(0, 25)) {
      console.log(`  - ${warning}`);
    }
    if (warnings.length > 25) {
      console.log(`  - ...and ${warnings.length - 25} more warning(s).`);
    }
  }

  for (const item of plan.slice(0, 25)) {
    console.log(`  ${item.relativePath} -> ${item.newRelativePath}`);
  }
  if (plan.length > 25) {
    console.log(`  ...and ${plan.length - 25} more planned rename(s).`);
  }

  if (args.incoming) {
    const incomingRoot = path.resolve(args.incoming);
    if (!(await pathExists(incomingRoot))) {
      throw new Error(`Incoming folder not found: ${incomingRoot}`);
    }
    const incomingResults = await scanIncoming(incomingRoot, history, libraryFiles);
    summarizeIncoming(incomingResults);
  }

  if (!args.apply) {
    console.log(`Preview only. Re-run with --apply to rename and write history.`);
    return;
  }

  const entries = await applyRenamePlan(plan, libraryRoot, history, historyPath);
  console.log(`Applied ${entries.length} rename(s).`);
  console.log(`History updated: ${historyPath}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
