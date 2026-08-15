import { ImageItem } from '../types';

const CATEGORIES: ImageItem['category'][] = [
  'Nature',
  'Space',
  'Architecture',
  'Cyberpunk',
  'Abstract',
  'Wildlife',
  'Portraits',
  'Textures',
  'Minimalist',
  'Urban'
];

const ADJECTIVES = [
  'Ethereal', 'Luminous', 'Vibrant', 'Cosmic', 'Serene', 'Mystic', 'Golden', 'Neon',
  'Sublime', 'Prismatic', 'Shadowed', 'Velvet', 'Silent', 'Infinite', 'Radiant', 'Emerald',
  'Obsidian', 'Sapphire', 'Solitary', 'Astral', 'Harmonic', 'Transient', 'Celestial', 'Kinetic'
];

const NOUNS = [
  'Horizon', 'Nebula', 'Monolith', 'Sanctuary', 'Cascade', 'Eclipse', 'Reflection', 'Passage',
  'Symphony', 'Vertex', 'Mirage', 'Glacier', 'Pinnacle', 'Spectrum', 'Aura', 'Chamber',
  'Echo', 'Spires', 'Tide', 'Labyrinth', 'Vortex', 'Haven', 'Pulse', 'Continuum'
];

const CAMERAS = [
  'Sony α7R V • 24mm f/1.4',
  'Canon EOS R5 • 85mm f/1.2',
  'Nikon Z9 • 50mm f/1.8',
  'Fujifilm GFX 100 II • 32-64mm',
  'Leica M11 • 35mm Summilux',
  'Hasselblad X2D 100C • 90mm'
];

// Simple fast PRNG for index-based deterministic generation
function seededRandom(seed: number): number {
  const x = Math.sin(seed + 1) * 10000;
  return x - Math.floor(x);
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

function getIsoWeekSeed(date = new Date()): number {
  const utcDate = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = utcDate.getUTCDay() || 7;
  utcDate.setUTCDate(utcDate.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(utcDate.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((utcDate.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return utcDate.getUTCFullYear() * 100 + week;
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

// Custom user uploaded images storage map
const customImageStore: Map<number, ImageItem> = new Map();
let serverImageStore: ImageItem[] = [];
const browserThumbCache = new Map<string, string>();
const browserThumbPending = new Map<string, Promise<string>>();
const BROWSER_THUMB_LIMIT = 96;
export const BACKGROUND_PLACEHOLDER_URL = `${import.meta.env.BASE_URL}background.png`;

/**
 * Generates or retrieves an ImageItem deterministically by its index (0 to 11,168+).
 */
export function getImageByIndex(index: number): ImageItem {
  if (customImageStore.has(index)) {
    return customImageStore.get(index)!;
  }

  if (serverImageStore[index]) {
    return serverImageStore[index];
  }

  const r1 = seededRandom(index * 1.1 + 7);
  const r2 = seededRandom(index * 2.3 + 13);
  const r3 = seededRandom(index * 3.7 + 19);
  const r4 = seededRandom(index * 4.9 + 29);

  const categoryIndex = Math.floor(r1 * CATEGORIES.length);
  const category = CATEGORIES[categoryIndex];

  const adj = ADJECTIVES[Math.floor(r2 * ADJECTIVES.length)];
  const noun = NOUNS[Math.floor(r3 * NOUNS.length)];
  const title = `${adj} ${noun} #${index + 1}`;

  // Generate hue smoothly mapped across indices so spectrum mode looks continuous
  const hue = Math.floor((index * 137.508) % 360); // Golden ratio angle spread for smooth distribution
  const saturation = 55 + Math.floor(r2 * 40); // 55% - 95%
  const brightness = 35 + Math.floor(r3 * 45); // 35% - 80%

  const colorHex = hslToHex(hue, saturation, brightness);
  const camera = CAMERAS[Math.floor(r4 * CAMERAS.length)];

  const code = `IMG-${String(index + 1).padStart(5, '0')}`;
  const imageUrl = BACKGROUND_PLACEHOLDER_URL;
  const thumbUrl = BACKGROUND_PLACEHOLDER_URL;

  const tags = [
    category.toLowerCase(),
    adj.toLowerCase(),
    noun.toLowerCase(),
    `hue-${Math.floor(hue / 30) * 30}`,
    `id-${index + 1}`
  ];

  const date = new Date(1700000000000 + (index * 864000)).toISOString().split('T')[0];

  return {
    id: index,
    code,
    title,
    category,
    colorHex,
    hue,
    brightness,
    imageUrl,
    thumbUrl,
    resolution: `${1920 + Math.floor(r1 * 1920)} x ${1080 + Math.floor(r2 * 1080)}`,
    dateAdded: date,
    tags,
    cameraInfo: camera,
  };
}

/**
 * Register custom user uploaded images into the collection
 */
export function setCustomImage(index: number, customItem: ImageItem) {
  customImageStore.set(index, customItem);
}

export function clearCustomImages() {
  customImageStore.clear();
}

export function setServerImages(images: ImageItem[]) {
  const canonicalOrder = images.slice().sort((a, b) => a.id - b.id);
  serverImageStore = shuffleBySeed(canonicalOrder, getIsoWeekSeed());
}

export function clearServerImages() {
  serverImageStore = [];
}

export async function loadServerImages(apiBaseUrl: string): Promise<ImageItem[]> {
  const base = apiBaseUrl.trim().replace(/\/$/, '');
  if (!base) {
    return [];
  }

  const response = await fetch(`${base}/api/images`);
  if (!response.ok) {
    throw new Error(`Aphelion image API returned ${response.status}`);
  }

  const items = (await response.json()) as ImageItem[];
  if (!Array.isArray(items)) {
    throw new Error('Aphelion image API returned an invalid payload.');
  }

  return items.map((item) => ({
    ...item,
    imageUrl: `${base}${item.imageUrl.startsWith('/') ? '' : '/'}${item.imageUrl}`,
    thumbUrl: `${base}${item.thumbUrl.startsWith('/') ? '' : '/'}${item.thumbUrl}`,
  }));
}

/**
 * HSL to HEX helper
 */
export function hslToHex(h: number, s: number, l: number): string {
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

/**
 * Helper to generate a procedural canvas thumbnail fallback Data URL if network image is slow/offline
 */
export function generateProceduralThumbnail(imageItem: ImageItem): string {
  const canvas = document.createElement('canvas');
  canvas.width = 300;
  canvas.height = 200;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  // Background Gradient
  const grad = ctx.createLinearGradient(0, 0, 300, 200);
  grad.addColorStop(0, imageItem.colorHex);
  grad.addColorStop(1, hslToHex((imageItem.hue + 120) % 360, 70, 20));
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 300, 200);

  // Geometric procedural shapes
  ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
  const seed = imageItem.id;
  for (let i = 0; i < 5; i++) {
    const cx = (seededRandom(seed + i) * 300);
    const cy = (seededRandom(seed + i * 2) * 200);
    const radius = 20 + seededRandom(seed + i * 3) * 60;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fill();
  }

  // Text label
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 16px sans-serif';
  ctx.fillText(imageItem.code, 15, 30);
  ctx.font = '14px sans-serif';
  ctx.fillText(imageItem.title, 15, 55);

  return canvas.toDataURL('image/jpeg', 0.8);
}

function touchBrowserThumb(key: string, objectUrl: string) {
  if (browserThumbCache.has(key)) {
    browserThumbCache.delete(key);
  }
  browserThumbCache.set(key, objectUrl);

  while (browserThumbCache.size > BROWSER_THUMB_LIMIT) {
    const oldestKey = browserThumbCache.keys().next().value as string | undefined;
    if (!oldestKey) {
      break;
    }
    const oldestUrl = browserThumbCache.get(oldestKey);
    browserThumbCache.delete(oldestKey);
    if (oldestUrl) {
      URL.revokeObjectURL(oldestUrl);
    }
  }
}

function fitSquareCropDimensions(width: number, height: number, size: number) {
  const sourceSide = Math.min(width, height);
  const sx = Math.max(0, Math.floor((width - sourceSide) / 2));
  const sy = Math.max(0, Math.floor((height - sourceSide) / 2));
  return {
    sx,
    sy,
    sWidth: sourceSide,
    sHeight: sourceSide,
    dWidth: size,
    dHeight: size,
  };
}

async function loadDrawableFromBlob(blob: Blob): Promise<ImageBitmap | HTMLImageElement> {
  if ('createImageBitmap' in window) {
    return createImageBitmap(blob);
  }

  return new Promise((resolve, reject) => {
    const tempUrl = URL.createObjectURL(blob);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(tempUrl);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(tempUrl);
      reject(new Error('Browser thumbnail image could not be decoded.'));
    };
    image.src = tempUrl;
  });
}

function drawableSize(drawable: ImageBitmap | HTMLImageElement) {
  if ('width' in drawable && 'height' in drawable) {
    return { width: drawable.width, height: drawable.height };
  }
  return { width: 0, height: 0 };
}

async function canvasBlob(canvas: HTMLCanvasElement, type = 'image/jpeg', quality = 0.82): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('Browser thumbnail canvas export failed.'));
        return;
      }
      resolve(blob);
    }, type, quality);
  });
}

export async function getBrowserThumbnailUrl(sourceUrl: string, size = 768): Promise<string> {
  const normalizedSize = Math.max(64, Math.round(size));
  const cacheKey = `${sourceUrl}|${normalizedSize}`;
  const cached = browserThumbCache.get(cacheKey);
  if (cached) {
    touchBrowserThumb(cacheKey, cached);
    return cached;
  }

  const pending = browserThumbPending.get(cacheKey);
  if (pending) {
    return pending;
  }

  const task = (async () => {
    const response = await fetch(sourceUrl, { cache: 'force-cache' });
    if (!response.ok) {
      throw new Error(`Browser thumbnail fetch failed with ${response.status}.`);
    }

    const blob = await response.blob();
    const drawable = await loadDrawableFromBlob(blob);
    const { width, height } = drawableSize(drawable);
    if (!width || !height) {
      throw new Error('Browser thumbnail source has invalid dimensions.');
    }

    const canvas = document.createElement('canvas');
    canvas.width = normalizedSize;
    canvas.height = normalizedSize;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Browser thumbnail canvas context is unavailable.');
    }

    const crop = fitSquareCropDimensions(width, height, normalizedSize);
    ctx.drawImage(
      drawable,
      crop.sx,
      crop.sy,
      crop.sWidth,
      crop.sHeight,
      0,
      0,
      crop.dWidth,
      crop.dHeight
    );

    if ('close' in drawable && typeof drawable.close === 'function') {
      drawable.close();
    }

    const thumbBlob = await canvasBlob(canvas);
    const objectUrl = URL.createObjectURL(thumbBlob);
    touchBrowserThumb(cacheKey, objectUrl);
    return objectUrl;
  })();

  browserThumbPending.set(cacheKey, task);

  try {
    return await task;
  } finally {
    browserThumbPending.delete(cacheKey);
  }
}
