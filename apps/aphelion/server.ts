import express from 'express';
import { access, appendFile, mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { constants as fsConstants } from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';
import sharp from 'sharp';
import type { ImageItem } from './src/types';
import { createCurationDb } from './curationDb';
import type {
  AdminCatalogPayload,
  CardCatalogItem,
  CardMetadataRecord,
  CatalogStats,
  SaveCardPayload,
} from './src/curationTypes';

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

function normalizeConfiguredPath(value: string) {
  const trimmed = value.trim().replace(/^"+|"+$/g, '');
  if (!trimmed) {
    return '';
  }

  if (process.platform === 'win32') {
    if (/^[A-Za-z]:[\\/]/.test(trimmed)) {
      const drive = trimmed.slice(0, 2);
      const segments = trimmed.slice(2).split(/[\\/]+/).filter(Boolean);
      return segments.length ? `${drive}\\${segments.join('\\')}` : `${drive}\\`;
    }

    if (/^[\\/]{2,}/.test(trimmed)) {
      const segments = trimmed.split(/[\\/]+/).filter(Boolean);
      return segments.length ? `\\\\${segments.join('\\')}` : '\\\\';
    }

    return trimmed.replace(/[\\/]+/g, '\\');
  }

  return trimmed;
}

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
  const curationDb = createCurationDb();
  const PORT = Number(process.env.APHELION_PORT || process.env.PORT || '8120');
  const imageRootCandidates = Array.from(
    new Set(
      String(process.env.APHELION_IMAGE_DIRS || process.env.APHELION_IMAGE_DIR || path.join(process.cwd(), 'images', 'keep'))
        .split(/[;,]/)
        .map(normalizeConfiguredPath)
        .filter(Boolean)
    )
  );
  let resolvedImageRoot: string | null = null;
  const corsOrigin = process.env.APHELION_CORS_ORIGIN || '*';

  app.use(express.json({ limit: '10mb' }));
  app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', corsOrigin);
    res.setHeader('Access-Control-Allow-Methods', 'GET,HEAD,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') {
      res.sendStatus(204);
      return;
    }
    next();
  });

  let cachedCatalog: ImageItem[] | null = null;
  let cachedCatalogAt = 0;
  const weeklogDir = process.env.APHELION_WEEKLOG_DIR || path.join(process.cwd(), 'data', 'weeklog');
  const highlightLogDir = process.env.APHELION_HIGHLIGHT_LOG_DIR || path.join(process.cwd(), 'data', 'logs');

  async function mergeCatalogWithMetadata(items: ImageItem[]): Promise<AdminCatalogPayload> {
    const metadataByPath = new Map<string, CardMetadataRecord>();
    for (const record of await curationDb.listCardMetadata()) {
      metadataByPath.set(record.imagePath, record);
    }

    const cards: CardCatalogItem[] = items.map((item) => {
      const imagePath = decodeURIComponent(item.imageUrl.split('path=').slice(1).join('path=') || '');
      const metadata = metadataByPath.get(imagePath);

      return {
        id: metadata?.id ?? item.id,
        cardUid: metadata?.cardUid || null,
        imagePath,
        imageCode: item.code,
        folderPath: item.cameraInfo || '',
        sourceTitle: item.title,
        sourceTags: item.tags,
        imageUrl: item.imageUrl,
        thumbUrl: item.thumbUrl,
        title: metadata?.title || '',
        description: metadata?.description || '',
        rarity: metadata?.rarity || null,
        seriesName: metadata?.seriesName || '',
        editionSize: metadata?.editionSize ?? null,
        reviewStatus: metadata?.reviewStatus || 'untagged',
        attributes: metadata?.attributes || [],
        updatedAt: metadata?.updatedAt || null,
      };
    });

    const stats: CatalogStats = {
      total: cards.length,
      reviewed: cards.filter((item) => item.reviewStatus === 'reviewed').length,
      untagged: cards.filter((item) => item.reviewStatus !== 'reviewed').length,
      withRarity: cards.filter((item) => Boolean(item.rarity)).length,
      withSeries: cards.filter((item) => Boolean(item.seriesName)).length,
      withAttributes: cards.filter((item) => item.attributes.length > 0).length,
      rarityCounts: cards.reduce<Record<string, number>>((accumulator, item) => {
        if (item.rarity) {
          accumulator[item.rarity] = (accumulator[item.rarity] || 0) + 1;
        }
        return accumulator;
      }, {}),
    };

    return {
      ok: true,
      cards,
      attributes: await curationDb.listAttributes(),
      series: await curationDb.listSeries(),
      stats,
    };
  }

  async function getImageRoot() {
    if (resolvedImageRoot) {
      return resolvedImageRoot;
    }

    for (const candidate of imageRootCandidates) {
      try {
        await access(candidate, fsConstants.R_OK);
        const details = await stat(candidate);
        if (!details.isDirectory()) {
          continue;
        }
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
    const dbStatus = await curationDb.getStatus();
    return {
      ok: true,
      app: 'aphelion',
      publicBaseUrl: process.env.VITE_APHELION_API_BASE_URL || `http://127.0.0.1:${PORT}`,
      imageRoot,
      imageRootCandidates,
      catalogSize: cachedCatalog?.length || 0,
      curationDb: dbStatus,
    };
  }

  function getMonthLogName(date = new Date()) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  }

  function extractImagePath(imageUrl: string) {
    try {
      const url = new URL(imageUrl, 'http://aphelion.local');
      return url.searchParams.get('path') || '';
    } catch {
      return '';
    }
  }

  function cleanLogText(value: unknown, maxLength = 500) {
    return String(value || '').replace(/[\r\n]+/g, ' ').slice(0, maxLength);
  }

  async function readHighlightEvents(limit = 5000) {
    try {
      await access(highlightLogDir);
    } catch {
      return [];
    }

    const entries = await readdir(highlightLogDir, { withFileTypes: true });
    const logFiles = entries
      .filter((entry) => entry.isFile() && /^highlight-events-\d{4}-\d{2}\.jsonl$/.test(entry.name))
      .map((entry) => entry.name)
      .sort()
      .reverse();
    const events: any[] = [];

    for (const fileName of logFiles) {
      const text = await readFile(path.join(highlightLogDir, fileName), 'utf8');
      const lines = text.split(/\r?\n/).filter(Boolean).reverse();

      for (const line of lines) {
        try {
          events.push(JSON.parse(line));
        } catch {
          // Ignore malformed log lines rather than breaking the public summary.
        }

        if (events.length >= limit) {
          return events;
        }
      }
    }

    return events;
  }

  function summarizeHighlightEvents(events: any[]) {
    const selectedEvents = events.filter((event) => event.action === 'selected' && event.image);
    const imageMap = new Map<string, any>();
    const folderMap = new Map<string, { folder: string; count: number }>();
    const dailyMap = new Map<string, { date: string; selected: number; cleared: number }>();

    for (const event of events) {
      const date = String(event.timestamp || '').slice(0, 10) || 'unknown';
      const day = dailyMap.get(date) || { date, selected: 0, cleared: 0 };
      if (event.action === 'selected') {
        day.selected += 1;
      } else if (event.action === 'cleared' || event.action === 'cleared-all') {
        day.cleared += 1;
      }
      dailyMap.set(date, day);

      if (event.action !== 'selected' || !event.image) {
        continue;
      }

      const imagePath = cleanLogText(event.image.path, 1000);
      const key = imagePath || cleanLogText(event.image.code, 100);
      const imageSummary = imageMap.get(key) || {
        key,
        count: 0,
        lastSelectedAt: event.timestamp,
        blockIndex: event.blockIndex,
        image: {
          id: event.image.id ?? null,
          code: cleanLogText(event.image.code, 80),
          title: cleanLogText(event.image.title, 200),
          path: imagePath,
          folder: cleanLogText(event.image.folder, 200),
          thumbUrl: imagePath ? `/api/image?path=${encodeURIComponent(imagePath)}` : '',
        },
      };

      imageSummary.count += 1;
      if (String(event.timestamp || '') > String(imageSummary.lastSelectedAt || '')) {
        imageSummary.lastSelectedAt = event.timestamp;
        imageSummary.blockIndex = event.blockIndex;
      }
      imageMap.set(key, imageSummary);

      const folder = cleanLogText(event.image.folder, 200) || 'Unknown folder';
      const folderSummary = folderMap.get(folder) || { folder, count: 0 };
      folderSummary.count += 1;
      folderMap.set(folder, folderSummary);
    }

    const topImages = Array.from(imageMap.values())
      .sort((a, b) => b.count - a.count || String(b.lastSelectedAt).localeCompare(String(a.lastSelectedAt)))
      .slice(0, 60);
    const topFolders = Array.from(folderMap.values())
      .sort((a, b) => b.count - a.count || a.folder.localeCompare(b.folder))
      .slice(0, 20);
    const daily = Array.from(dailyMap.values())
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 30);

    return {
      ok: true,
      generatedAt: new Date().toISOString(),
      totalEvents: events.length,
      selectedCount: selectedEvents.length,
      clearedCount: events.filter((event) => event.action === 'cleared' || event.action === 'cleared-all').length,
      topImages,
      topFolders,
      daily,
      recentEvents: events.slice(0, 200),
    };
  }

  app.post('/api/highlight-events', async (req, res) => {
    try {
      const body = req.body || {};
      const timestamp = new Date();
      const action = cleanLogText(body.action, 40);
      const allowedActions = new Set(['selected', 'cleared', 'cleared-all']);

      if (!allowedActions.has(action)) {
        res.status(400).json({ ok: false, error: 'Unsupported highlight action.' });
        return;
      }

      const image = body.image && typeof body.image === 'object' ? body.image : {};
      const event = {
        timestamp: timestamp.toISOString(),
        app: 'aphelion',
        action,
        blockIndex: Number.isFinite(Number(body.blockIndex)) ? Number(body.blockIndex) : null,
        clearedCount: Number.isFinite(Number(body.clearedCount)) ? Number(body.clearedCount) : null,
        image: action === 'cleared-all'
          ? null
          : {
              id: Number.isFinite(Number(image.id)) ? Number(image.id) : null,
              code: cleanLogText(image.code, 80),
              title: cleanLogText(image.title, 200),
              path: extractImagePath(cleanLogText(image.imageUrl, 1000)),
              folder: cleanLogText(image.cameraInfo, 200),
            },
        isoWeek: getIsoWeekInfo(timestamp).label,
      };

      await mkdir(highlightLogDir, { recursive: true });
      await appendFile(
        path.join(highlightLogDir, `highlight-events-${getMonthLogName(timestamp)}.jsonl`),
        `${JSON.stringify(event)}\n`,
        'utf8'
      );

      res.json({ ok: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown highlight logging error';
      res.status(500).json({ ok: false, error: message });
    }
  });

  app.get('/api/highlight-events/summary', async (req, res) => {
    try {
      const limit = Math.min(20000, Math.max(100, Number(req.query.limit || 5000)));
      const events = await readHighlightEvents(limit);
      res.json(summarizeHighlightEvents(events));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown highlight summary error';
      res.status(500).json({ ok: false, error: message });
    }
  });

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

  app.get('/api/admin/catalog', async (req, res) => {
    try {
      const forceRefresh = String(req.query.refresh || '').toLowerCase() === 'true' || req.query.refresh === '1';
      const items = await getCatalog(forceRefresh);
      res.json(await mergeCatalogWithMetadata(items));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown admin catalog error';
      const statusCode = /not configured/i.test(message) ? 503 : 500;
      res.status(statusCode).json({ ok: false, error: message });
    }
  });

  app.post('/api/admin/cards', async (req, res) => {
    try {
      const payload = req.body as SaveCardPayload;
      if (!payload?.imagePath || !payload?.imageCode) {
        res.status(400).json({ ok: false, error: 'imagePath and imageCode are required.' });
        return;
      }

      const card = await curationDb.saveCard({
        imagePath: String(payload.imagePath),
        imageCode: String(payload.imageCode),
        folderPath: String(payload.folderPath || ''),
        title: payload.title,
        description: payload.description,
        rarity: payload.rarity || null,
        seriesName: payload.seriesName,
        editionSize: payload.editionSize ?? null,
        reviewStatus: payload.reviewStatus || 'untagged',
        attributes: Array.isArray(payload.attributes) ? payload.attributes.map(String) : [],
      });

      res.json({
        ok: true,
        card,
        attributes: await curationDb.listAttributes(),
        series: await curationDb.listSeries(),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown card save error';
      const statusCode = /not configured/i.test(message) ? 503 : 500;
      res.status(statusCode).json({ ok: false, error: message });
    }
  });

  app.post('/api/admin/attributes', async (_req, res) => {
    try {
      const body = _req.body as { label?: string };
      const attributes = await curationDb.createAttribute(String(body?.label || ''));
      res.json({ ok: true, attributes });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown attribute create error';
      const statusCode = /not configured/i.test(message) ? 503 : 400;
      res.status(statusCode).json({ ok: false, error: message });
    }
  });

  app.patch('/api/admin/attributes/:id', async (req, res) => {
    try {
      const attributes = await curationDb.renameAttribute(Number(req.params.id), String(req.body?.label || ''));
      res.json({ ok: true, attributes });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown attribute rename error';
      const statusCode = /not configured/i.test(message) ? 503 : 400;
      res.status(statusCode).json({ ok: false, error: message });
    }
  });

  app.delete('/api/admin/attributes/:id', async (req, res) => {
    try {
      const attributes = await curationDb.deleteAttribute(Number(req.params.id));
      res.json({ ok: true, attributes });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown attribute delete error';
      const statusCode = /not configured/i.test(message) ? 503 : 400;
      res.status(statusCode).json({ ok: false, error: message });
    }
  });

  app.post('/api/admin/series', async (req, res) => {
    try {
      const series = await curationDb.createSeries(String(req.body?.label || ''));
      res.json({ ok: true, series });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown series create error';
      const statusCode = /not configured/i.test(message) ? 503 : 400;
      res.status(statusCode).json({ ok: false, error: message });
    }
  });

  app.patch('/api/admin/series/:id', async (req, res) => {
    try {
      const series = await curationDb.renameSeries(
        Number(req.params.id),
        String(req.body?.label || ''),
        String(req.body?.previousLabel || '')
      );
      res.json({ ok: true, series });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown series rename error';
      const statusCode = /not configured/i.test(message) ? 503 : 400;
      res.status(statusCode).json({ ok: false, error: message });
    }
  });

  app.delete('/api/admin/series/:id', async (req, res) => {
    try {
      const series = await curationDb.deleteSeries(Number(req.params.id), String(req.body?.label || ''));
      res.json({ ok: true, series });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown series delete error';
      const statusCode = /not configured/i.test(message) ? 503 : 400;
      res.status(statusCode).json({ ok: false, error: message });
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
    console.log(`Aphelion server running on:`);
    console.log(`  Local:   http://127.0.0.1:${PORT}`);
    console.log(`  Local:   http://localhost:${PORT}`);
    console.log(`  Network: http://0.0.0.0:${PORT} (bind address)`);
    console.log(`Image root candidates: ${imageRootCandidates.join(' | ')}`);
    console.log(`Catalog refresh time: ${cachedCatalogAt || 'not loaded yet'}`);
  });
}

startServer();
