import { createHash } from 'node:crypto';
import { createReadStream, readFileSync } from 'node:fs';
import { access, mkdir, readFile, readdir, rename, stat, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
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
    preview: false,
    rename: false,
    yes: false,
    digits: 5,
    blockSize: 1000,
    library: '',
    history: '',
    newFolder: '00 - NEW',
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = argv[index + 1];

    if (arg === '--preview') {
      args.preview = true;
    } else if (arg === '--rename') {
      args.rename = true;
    } else if (arg === '--yes' || arg === '-y') {
      args.yes = true;
    } else if (arg === '--digits' && next) {
      args.digits = Number(next);
      index += 1;
    } else if (arg === '--block-size' && next) {
      args.blockSize = Number(next);
      index += 1;
    } else if (arg === '--library' && next) {
      args.library = next;
      index += 1;
    } else if (arg === '--history' && next) {
      args.history = next;
      index += 1;
    } else if (arg === '--new-folder' && next) {
      args.newFolder = next;
      index += 1;
    } else if (arg === '--help' || arg === '-h') {
      args.help = true;
    }
  }

  return args;
}

function printHelp() {
  console.log(`
Aphelion NEW-folder sweep

Preview counts, NEW files, duplicate matches, and rename plan:
  npm run rename:sweep -- --preview

Delete duplicate files from 00 - NEW after confirmation:
  npm run rename:sweep

Rename/move remaining 00 - NEW files into numbered folders:
  npm run rename:sweep -- --rename --digits 5

Options:
  --preview             Show totals, NEW files, duplicate matches, and planned sequence names.
  --rename              Move NEW files into library folders and continue the sequence.
  --digits <n>          Sequence filename width. Default: 5.
  --block-size <n>      Sequence block size per folder. Default: 1000.
  --new-folder <name>   Intake folder name inside the library. Default: "00 - NEW".
  --library <path>      Library root. Defaults to APHELION_IMAGE_DIR(S), then E:\\images\\keep.
  --history <path>      Manifest path. Defaults to <library>\\.aphelion-rename-history.json.
  --yes                 Skip delete confirmation. Use carefully.
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
        stem: path.basename(fullPath, extension),
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

function buildHistoryIndexes(history) {
  const oldNames = new Map();
  const oldPaths = new Map();
  const hashes = new Map();

  for (const entry of history.entries) {
    if (entry.oldBasename) {
      oldNames.set(normalizeKey(entry.oldBasename), entry);
    }
    if (entry.oldRelativePath) {
      oldPaths.set(normalizeKey(entry.oldRelativePath), entry);
    }
    if (entry.sha256) {
      hashes.set(entry.sha256, entry);
    }
  }

  return { oldNames, oldPaths, hashes };
}

function getSequenceNumber(stem, digits) {
  const pattern = new RegExp(`^\\d{${digits},}$`);
  return pattern.test(stem) ? Number(stem) : 0;
}

function getFolderBlockFromName(directory) {
  const match = directory.match(/^(\d+)/);
  return match ? Number(match[1]) : 0;
}

function getBlockForSequence(sequenceNumber, blockSize) {
  return Math.max(1, Math.ceil(sequenceNumber / blockSize));
}

function getBlockStart(blockNumber, blockSize) {
  return (blockNumber - 1) * blockSize + 1;
}

function getBlockEnd(blockNumber, blockSize) {
  return blockNumber * blockSize;
}

function formatSequence(sequenceNumber, digits, extension) {
  return `${String(sequenceNumber).padStart(digits, '0')}${extension.toLowerCase()}`;
}

function formatBlockFolder(blockNumber, blockSize, digits) {
  const start = getBlockStart(blockNumber, blockSize);
  const end = getBlockEnd(blockNumber, blockSize);
  return `${String(blockNumber).padStart(2, '0')} - ${String(start).padStart(digits, '0')}-${String(end).padStart(digits, '0')}`;
}

async function findDuplicateMatches(newFiles, libraryFiles, history) {
  if (!newFiles.length) {
    return [];
  }

  const historyIndexes = buildHistoryIndexes(history);
  const libraryNameIndex = new Map();
  const libraryPathIndex = new Map();
  const libraryHashIndex = new Map();
  const newSizeSet = new Set(newFiles.map((file) => file.size));
  const newHashes = new Map();

  for (const file of newFiles) {
    newHashes.set(file.relativePath, await hashFile(file.fullPath));
  }

  for (const file of libraryFiles) {
    libraryNameIndex.set(normalizeKey(file.basename), file);
    libraryPathIndex.set(normalizeKey(file.relativePath), file);
    if (newSizeSet.has(file.size)) {
      const sha256 = await hashFile(file.fullPath);
      libraryHashIndex.set(sha256, file);
    }
  }

  const matches = [];
  for (const file of newFiles) {
    const sha256 = newHashes.get(file.relativePath);
    const oldName = historyIndexes.oldNames.get(normalizeKey(file.basename));
    const oldPath = historyIndexes.oldPaths.get(normalizeKey(file.relativePath));
    const oldHash = historyIndexes.hashes.get(sha256);
    const currentName = libraryNameIndex.get(normalizeKey(file.basename));
    const currentPath = libraryPathIndex.get(normalizeKey(file.relativePath));
    const currentHash = libraryHashIndex.get(sha256);

    const reasons = [
      oldName ? `old name already became ${oldName.newRelativePath}` : '',
      oldPath ? `old path already became ${oldPath.newRelativePath}` : '',
      oldHash ? `hash already became ${oldHash.newRelativePath}` : '',
      currentName ? `current name exists at ${currentName.relativePath}` : '',
      currentPath ? `current path exists at ${currentPath.relativePath}` : '',
      currentHash ? `same hash exists at ${currentHash.relativePath}` : '',
    ].filter(Boolean);

    if (reasons.length) {
      matches.push({ file, sha256, reasons });
    }
  }

  return matches;
}

function buildRenamePlan(newFiles, libraryFiles, args) {
  const nonNewDirectories = Array.from(new Set(libraryFiles.map((file) => file.directory)))
    .filter((directory) => directory !== '.')
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
  const folderByBlock = new Map();
  const sequenceByBlock = new Map();
  let highestSequence = 0;

  for (const directory of nonNewDirectories) {
    const namedBlock = getFolderBlockFromName(directory);
    if (namedBlock && !folderByBlock.has(namedBlock)) {
      folderByBlock.set(namedBlock, directory);
    }
  }

  for (const file of libraryFiles) {
    const sequenceNumber = getSequenceNumber(file.stem, args.digits);
    if (!sequenceNumber) {
      continue;
    }
    highestSequence = Math.max(highestSequence, sequenceNumber);
    const blockNumber = getBlockForSequence(sequenceNumber, args.blockSize);
    sequenceByBlock.set(blockNumber, file.directory);
    if (!folderByBlock.has(blockNumber)) {
      folderByBlock.set(blockNumber, file.directory);
    }
  }

  let nextSequence = highestSequence > 0 ? highestSequence + 1 : libraryFiles.length + 1;
  const plan = [];

  for (const file of newFiles.slice().sort((a, b) => a.basename.localeCompare(b.basename, undefined, { numeric: true, sensitivity: 'base' }))) {
    const blockNumber = getBlockForSequence(nextSequence, args.blockSize);
    const targetDirectory = sequenceByBlock.get(blockNumber) || folderByBlock.get(blockNumber) || formatBlockFolder(blockNumber, args.blockSize, args.digits);
    const newBasename = formatSequence(nextSequence, args.digits, file.extension);
    const newRelativePath = path.posix.join(targetDirectory, newBasename);

    plan.push({
      file,
      sequenceNumber: nextSequence,
      blockNumber,
      blockRange: `${String(getBlockStart(blockNumber, args.blockSize)).padStart(args.digits, '0')}-${String(getBlockEnd(blockNumber, args.blockSize)).padStart(args.digits, '0')}`,
      targetDirectory,
      targetDirectoryExists: nonNewDirectories.includes(targetDirectory),
      newBasename,
      newRelativePath,
    });

    nextSequence += 1;
  }

  return { plan, highestSequence };
}

async function confirmDelete(count, args) {
  if (args.yes) {
    return true;
  }

  const rl = readline.createInterface({ input, output });
  try {
    const answer = await rl.question(`Delete ${count} duplicate file(s) from ${args.newFolder}? Type DELETE to continue: `);
    return answer.trim() === 'DELETE';
  } finally {
    rl.close();
  }
}

async function deleteDuplicateMatches(matches, args) {
  if (!matches.length) {
    console.log('No duplicates found in NEW. Nothing to delete.');
    return;
  }

  const confirmed = await confirmDelete(matches.length, args);
  if (!confirmed) {
    console.log('Deletion cancelled. No files were removed.');
    return;
  }

  for (const match of matches) {
    await unlink(match.file.fullPath);
    console.log(`Deleted ${match.file.relativePath}`);
  }
}

async function applyRenamePlan(plan, libraryRoot, history, historyPath, args) {
  const timestamp = new Date().toISOString();
  const entries = [];

  for (const item of plan) {
    const targetDirectoryPath = path.join(libraryRoot, item.targetDirectory);
    await mkdir(targetDirectoryPath, { recursive: true });
    const targetPath = path.join(targetDirectoryPath, item.newBasename);
    await rename(item.file.fullPath, targetPath);
    const sha256 = await hashFile(targetPath);

    entries.push({
      renamedAt: timestamp,
      source: 'rename:sweep',
      intakeFolder: args.newFolder,
      oldRelativePath: item.file.relativePath,
      newRelativePath: toPosixRelative(libraryRoot, targetPath),
      oldBasename: item.file.basename,
      newBasename: item.newBasename,
      sha256,
      size: item.file.size,
      mtimeMs: item.file.mtimeMs,
      sequenceNumber: item.sequenceNumber,
      folderBlock: item.blockRange,
    });

    console.log(`Renamed ${item.file.relativePath} -> ${toPosixRelative(libraryRoot, targetPath)}`);
  }

  history.updatedAt = timestamp;
  history.entries = [...history.entries, ...entries];
  await writeFile(historyPath, `${JSON.stringify(history, null, 2)}\n`, 'utf8');
  console.log(`Manifest updated: ${historyPath}`);
}

function printSummary({ libraryRoot, newFolderPath, currentFiles, newFiles, matches, plan, highestSequence, historyPath }) {
  const currentByFolder = new Map();
  for (const file of currentFiles) {
    currentByFolder.set(file.directory, (currentByFolder.get(file.directory) || 0) + 1);
  }

  console.log('Aphelion NEW-folder sweep');
  console.log(`Library: ${libraryRoot}`);
  console.log(`NEW folder: ${newFolderPath}`);
  console.log(`Manifest: ${historyPath}`);
  console.log(`Current library files excluding NEW: ${currentFiles.length}`);
  for (const [folder, count] of Array.from(currentByFolder.entries()).sort((a, b) => a[0].localeCompare(b[0], undefined, { numeric: true, sensitivity: 'base' }))) {
    console.log(`  ${folder}: ${count}`);
  }
  console.log(`Files in NEW: ${newFiles.length}`);
  for (const file of newFiles) {
    console.log(`  NEW ${file.basename}`);
  }
  console.log(`Duplicate/previously imported matches in NEW: ${matches.length}`);
  for (const match of matches) {
    console.log(`  DUPLICATE ${match.file.basename}`);
    for (const reason of match.reasons) {
      console.log(`    - ${reason}`);
    }
  }
  console.log(`Highest existing sequence: ${highestSequence || 'none found'}`);
  console.log(`Planned NEW renames: ${plan.length}`);
  for (const item of plan) {
    const folderNote = item.targetDirectoryExists ? '' : ' (new folder will be created)';
    console.log(`  ${item.file.basename} -> ${item.newRelativePath}${folderNote}`);
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    return;
  }

  if (!Number.isFinite(args.digits) || args.digits < 1) {
    throw new Error('--digits must be a positive number.');
  }
  if (!Number.isFinite(args.blockSize) || args.blockSize < 1) {
    throw new Error('--block-size must be a positive number.');
  }

  const libraryRoot = await getLibraryRoot(args);
  const newFolderPath = path.join(libraryRoot, args.newFolder);
  const historyPath = path.resolve(args.history || path.join(libraryRoot, '.aphelion-rename-history.json'));

  if (!(await pathExists(libraryRoot))) {
    throw new Error(`Library folder not found: ${libraryRoot}`);
  }
  if (!(await pathExists(newFolderPath))) {
    throw new Error(`NEW folder not found: ${newFolderPath}`);
  }

  const allFiles = await walkImages(libraryRoot);
  const newPrefix = `${args.newFolder.replace(/\\/g, '/')}/`.toLowerCase();
  const newFiles = allFiles.filter((file) => normalizeKey(file.relativePath).startsWith(newPrefix));
  const currentFiles = allFiles.filter((file) => !normalizeKey(file.relativePath).startsWith(newPrefix));
  const history = await loadHistory(historyPath);
  const matches = await findDuplicateMatches(newFiles, currentFiles, history);
  const duplicatePaths = new Set(matches.map((match) => normalizeKey(match.file.relativePath)));
  const renameCandidates = newFiles.filter((file) => !duplicatePaths.has(normalizeKey(file.relativePath)));
  const { plan, highestSequence } = buildRenamePlan(renameCandidates, currentFiles, args);

  printSummary({
    libraryRoot,
    newFolderPath,
    currentFiles,
    newFiles,
    matches,
    plan,
    highestSequence,
    historyPath,
  });

  if (args.preview) {
    console.log('Preview only. No files were deleted, renamed, or moved.');
    return;
  }

  if (args.rename) {
    await applyRenamePlan(plan, libraryRoot, history, historyPath, args);
    return;
  }

  await deleteDuplicateMatches(matches, args);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
