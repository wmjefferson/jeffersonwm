import express from 'express';
import { access, mkdir, readdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import dotenv from 'dotenv';
import sharp from 'sharp';
import type { ImageItem } from './src/types';

const envFile = process.env.APHELION_ENV_FILE || (process.env.NODE_ENV === 'production' ? '.env.production' : '.env.development');
dotenv.config({ path: path.join(process.cwd(), envFile) });

const CATEGORY_POOL: ImageItem['category'][] = [
  'Nature',
  'Space',
  'Architecture',
  'Cyberpunk',
  'Abstract',
  'Wildlife',
  'Portraits',
  'Textures',
  'Minimalist',
  'Urban',
];

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

const SERVED_IMAGE_SIZE = 1024;

function seededShuffleRandom(seed: number) {
  let value = seed >>> 0;

  return () => {
    value += 0x6D2B79F5;
    let mixed = value;
    mixed = Math.imul(mixed ^ (mixed >>> 15), mixed | 1);
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  };
}

function getIsoWeekInfo(date = new Date()) {
  const utcDate = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = utcDate.getUTCDay() || 7;
  utcDate.setUTCDate(utcDate.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(utcDate.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((utcDate.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  const year = utcDate.getUTCFullYear();

  return {
    year,
    week,
    seed: year * 100 + week,
    label: `${year}-${String(week).padStart(2, '0')}`,
  };
}

function shuffleBySeed<T>(items: T[], seed: number): T[] {
  const random = seededShuffleRandom(seed);
  const shuffled = items.slice();

  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  return shuffled;
}

async function startServer() {
  const app = express();
  const PORT = Number(process.env.APHELION_PORT || process.env.PORT || '8120');
  const imageRootCandidates = Array.from(
    new Set(
      String(process.env.APHELION_IMAGE_DIRS || process.env.APHELION_IMAGE_DIR || path.join(process.cwd(), 'images', 'keep'))
        .split(/[;,]/)
        .map((value) => value.trim().replace(/^"+|"+$/g, ''))
        .filter(Boolean)
    )
  );
  let resolvedImageRoot: string | null = null;
  const corsOrigin = process.env.APHELION_CORS_ORIGIN || '*';

  app.use(express.json({ limit: '10mb' }));
  app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', corsOrigin);
    res.setHeader('Access-Control-Allow-Methods', 'GET,HEAD,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') {
      res.sendStatus(204);
      return;
    }
    next();
  });

  let cachedCatalog: ImageItem[] | null = null;
  let cachedCatalogAt = 0;
  const weeklogDir = process.env.APHELION_WEEKLOG_DIR || 'E:\\aphelion\\weeklog';

  async function getImageRoot() {
    if (resolvedImageRoot) {
      return resolvedImageRoot;
    }

    for (const candidate of imageRootCandidates) {
      try {
        await access(candidate);
        resolvedImageRoot = candidate;
        return candidate;
      } catch {
        // Try the next configured root.
      }
    }

    resolvedImageRoot = imageRootCandidates[0] || path.join(process.cwd(), 'images', 'keep');
    return resolvedImageRoot;
  }

  function hashString(input: string) {
    let hash = 0;
    for (let index = 0; index < input.length; index += 1) {
      hash = (hash << 5) - hash + input.charCodeAt(index);
      hash |= 0;
    }
    return Math.abs(hash);
  }

  function hslToHex(h: number, s: number, l: number): string {
    l /= 100;
    const a = (s * Math.min(l, 1 - l)) / 100;
    const f = (n: number) => {
      const k = (n + h / 30) % 12;
      const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
      return Math.round(255 * color)
        .toString(16)
        .padStart(2, '0');
    };
    return `#${f(0)}${f(8)}${f(4)}`;
  }

  function titleCase(value: string) {
    return value
      .toLowerCase()
      .replace(/\b\w/g, (char) => char.toUpperCase())
      .trim();
  }

  function sanitizeRelativePath(relativePath: string) {
    return relativePath.replace(/\\/g, '/').replace(/^\/+/, '');
  }

  async function resolveSafePath(relativePath: string) {
    const normalized = sanitizeRelativePath(relativePath);
    const root = await getImageRoot();
    const fullPath = path.resolve(root, normalized);
    const rootPath = path.resolve(root);
    const check = path.relative(rootPath, fullPath);
    if (check.startsWith('..') || path.isAbsolute(check)) {
      throw new Error(`Unsafe image path requested: ${relativePath}`);
    }
    return fullPath;
  }

  function buildImageItem(relativePath: string, mtimeMs: number, index: number): ImageItem {
    const safeRelativePath = sanitizeRelativePath(relativePath);
    const parsed = path.posix.parse(safeRelativePath);
    const fileStem = parsed.name || `image-${index + 1}`;
    const folderPath = path.posix.dirname(safeRelativePath);
    const folderLabel = folderPath === '.' ? 'keep' : folderPath.split('/').join(' / ');
    const hash = hashString(safeRelativePath);
    const category = CATEGORY_POOL[hash % CATEGORY_POOL.length];
    const hue = hash % 360;
    const brightness = 35 + (hash % 45);
    const colorHex = hslToHex(hue, 72, 46);
    const code = fileStem
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 32) || `KEEP-${String(index + 1).padStart(5, '0')}`;
    const displayName = titleCase(fileStem.replace(/[_-]+/g, ' '));
    const keywords = fileStem
      .replace(/[_-]+/g, ' ')
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 6)
      .map((part) => part.toLowerCase());
    const folderTags = folderPath === '.' ? ['keep'] : folderPath.split('/').filter(Boolean).map((part) => part.toLowerCase());
    const tags = Array.from(new Set([category.toLowerCase(), ...folderTags, ...keywords])).slice(0, 8);
    const imageUrl = `/api/image?path=${encodeURIComponent(safeRelativePath)}`;

    return {
      id: index,
      code,
      title: displayName,
      category,
      colorHex,
      hue,
      brightness,
      imageUrl,
      thumbUrl: imageUrl,
      resolution: 'Server image',
      dateAdded: new Date(mtimeMs).toISOString().split('T')[0],
      tags,
      cameraInfo: folderLabel,
    };
  }

  async function buildCatalog() {
    const items: ImageItem[] = [];
    const imageRoot = await getImageRoot();

    async function walk(currentDir: string, relativeDir = '') {
      const entries = await readdir(currentDir, { withFileTypes: true });
      entries.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));

      for (const entry of entries) {
        const nextRelative = relativeDir ? path.posix.join(relativeDir, entry.name) : entry.name;
        const nextFull = path.join(currentDir, entry.name);

        if (entry.isDirectory()) {
          await walk(nextFull, nextRelative);
          continue;
        }

        const extension = path.extname(entry.name).toLowerCase();
        if (!IMAGE_EXTENSIONS.has(extension)) {
          continue;
        }

        const stats = await stat(nextFull);
        items.push(buildImageItem(nextRelative, stats.mtimeMs, items.length));
      }
    }

    await walk(imageRoot);
    return items;
  }

  async function ensureWeeklyPositionLog(items: ImageItem[]) {
    const weekInfo = getIsoWeekInfo();
    const logPath = path.join(weeklogDir, `${weekInfo.label}.json`);

    try {
      await access(logPath);
      return;
    } catch {
      // Missing log is expected the first time Aphelion runs during a new week.
    }

    const shuffledItems = shuffleBySeed(items.slice().sort((a, b) => a.id - b.id), weekInfo.seed);
    const payload = {
      title: weekInfo.label,
      app: 'aphelion',
      generatedAt: new Date().toISOString(),
      isoYear: weekInfo.year,
      isoWeek: weekInfo.week,
      seed: weekInfo.seed,
      totalImages: shuffledItems.length,
      positions: shuffledItems.map((image, index) => ({
        position: index + 1,
        blockIndex: index,
        originalId: image.id,
        code: image.code,
        title: image.title,
        imageUrl: image.imageUrl,
        folder: image.cameraInfo || '',
        tags: image.tags,
      })),
    };

    await mkdir(weeklogDir, { recursive: true });
    await writeFile(logPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
    console.log(`Weekly Aphelion position log written: ${logPath}`);
  }

  async function getCatalog(forceRefresh = false) {
    if (!forceRefresh && cachedCatalog) {
      await ensureWeeklyPositionLog(cachedCatalog);
      return cachedCatalog;
    }

    cachedCatalog = await buildCatalog();
    cachedCatalogAt = Date.now();
    await ensureWeeklyPositionLog(cachedCatalog);
    return cachedCatalog;
  }

  async function getHealthSnapshot() {
    const imageRoot = await getImageRoot();
    return {
      ok: true,
      app: 'aphelion',
      publicBaseUrl: process.env.VITE_APHELION_API_BASE_URL || `http://127.0.0.1:${PORT}`,
      imageRoot,
      imageRootCandidates,
      catalogSize: cachedCatalog?.length || 0
    };
  }

  app.get('/health', async (_req, res) => {
    try {
      res.json(await getHealthSnapshot());
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown health error';
      res.status(500).json({ ok: false, app: 'aphelion', error: message });
    }
  });

  app.get('/api/health', async (_req, res) => {
    try {
      res.json(await getHealthSnapshot());
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown health error';
      res.status(500).json({ ok: false, app: 'aphelion', error: message });
    }
  });

  app.get('/api/images', async (req, res) => {
    try {
      const forceRefresh = String(req.query.refresh || '').toLowerCase() === 'true' || req.query.refresh === '1';
      const items = await getCatalog(forceRefresh);
      res.json(items);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown catalog error';
      res.status(500).json({ error: message });
    }
  });

  app.get('/api/image', async (req, res) => {
    try {
      const requestedPath = String(req.query.path || '').trim();
      if (!requestedPath) {
        res.status(400).json({ error: 'Missing path query parameter.' });
        return;
      }

      const filePath = await resolveSafePath(requestedPath);
      await access(filePath);

      const imageBuffer = await sharp(filePath, { animated: false })
        .rotate()
        .resize(SERVED_IMAGE_SIZE, SERVED_IMAGE_SIZE, {
          fit: 'cover',
          position: 'center',
          withoutEnlargement: false,
        })
        .jpeg({ quality: 88, mozjpeg: true })
        .toBuffer();

      res.setHeader('Content-Type', 'image/jpeg');
      res.setHeader('Cache-Control', 'public, max-age=86400');
      res.send(imageBuffer);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown image error';
      res.status(404).json({ error: message });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Aphelion server running on http://0.0.0.0:${PORT}`);
    console.log(`Image root candidates: ${imageRootCandidates.join(' | ')}`);
    console.log(`Catalog refresh time: ${cachedCatalogAt || 'not loaded yet'}`);
  });
}

startServer();
