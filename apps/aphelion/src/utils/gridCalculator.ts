import { GridConfig, GridZone } from '../types';
import { DEFAULT_TARGET_COUNT } from '../config';

/**
 * Calculates optimal grid columns and rows for a given viewport and target cell count.
 * Guarantees totalBlocks >= targetCount.
 */
export function calculateGrid(
  viewportWidth: number,
  viewportHeight: number,
  targetCount: number = DEFAULT_TARGET_COUNT,
  mode: 'auto-aspect' | 'exact-target' | 'fixed-cols' = 'auto-aspect',
  userCols?: number
): GridConfig {
  const width = Math.max(100, viewportWidth);
  const height = Math.max(100, viewportHeight);

  let cols: number;
  let rows: number;

  if (mode === 'fixed-cols' && userCols && userCols > 0) {
    cols = userCols;
    rows = Math.ceil(targetCount / cols);
  } else if (mode === 'exact-target') {
    // Try to find columns and rows where cols * rows is closest to targetCount
    const aspectRatio = width / height;
    cols = Math.round(Math.sqrt(targetCount * aspectRatio));
    cols = Math.max(1, cols);
    rows = Math.ceil(targetCount / cols);
  } else {
    // auto-aspect (default) - maintain square-ish cells proportional to viewport ratio
    const aspectRatio = width / height;
    cols = Math.round(Math.sqrt(targetCount * aspectRatio));
    cols = Math.max(1, cols);
    rows = Math.ceil(targetCount / cols);
  }

  const totalBlocks = cols * rows;
  const cellWidth = width / cols;
  const cellHeight = height / rows;

  return {
    targetCount,
    cols,
    rows,
    totalBlocks,
    cellWidth,
    cellHeight,
    mode,
  };
}

function getFrameZoneRects(width: number, height: number, centerSize: number) {
  const size = Math.min(centerSize, width, height);
  const centerX = (width - size) / 2;
  const centerY = (height - size) / 2;

  return {
    centerSquare: { x: centerX, y: centerY, size },
    rects: [
      { name: 'top' as const, x: 0, y: 0, width, height: centerY },
      { name: 'bottom' as const, x: 0, y: centerY + size, width, height: height - centerY - size },
      { name: 'left' as const, x: 0, y: centerY, width: centerX, height: size },
      { name: 'right' as const, x: centerX + size, y: centerY, width: width - centerX - size, height: size },
    ],
  };
}

function countFrameBlocks(width: number, height: number, centerSize: number, cellSize: number) {
  const { rects } = getFrameZoneRects(width, height, centerSize);
  return rects.reduce((total, rect) => {
    const cols = Math.max(0, Math.floor(rect.width / cellSize));
    const rows = Math.max(0, Math.floor(rect.height / cellSize));
    return total + cols * rows;
  }, 0);
}

/** Minimum gap (px) between block edges and container/center-square borders */
const ZONE_PADDING = 4;

function buildFrameZones(width: number, height: number, centerSize: number, cellSize: number) {
  const { centerSquare, rects } = getFrameZoneRects(width, height, centerSize);
  let startIndex = 0;
  const zones: GridZone[] = [];

  for (const rect of rects) {
    // Shrink each rect inward by ZONE_PADDING on every side so blocks never
    // touch the container edges or the center-square border.
    const px = rect.x + ZONE_PADDING;
    const py = rect.y + ZONE_PADDING;
    const pw = rect.width - ZONE_PADDING * 2;
    const ph = rect.height - ZONE_PADDING * 2;

    const cols = Math.max(0, Math.floor(pw / cellSize));
    const rows = Math.max(0, Math.floor(ph / cellSize));
    const totalBlocks = cols * rows;

    if (totalBlocks === 0) {
      continue;
    }

    zones.push({
      name: rect.name,
      x: px,
      y: py,
      width: pw,
      height: ph,
      cols,
      rows,
      cellWidth: pw / cols,
      cellHeight: ph / rows,
      startIndex,
      totalBlocks,
    });
    startIndex += totalBlocks;
  }

  return { centerSquare, zones, totalBlocks: startIndex };
}

const LAYOUT_CACHE_KEY = 'aphelion_grid_layout_v2';

/**
 * In-memory layout cache keyed by "width|height".
 * Once a layout is computed for a viewport size, positions are locked until the
 * window resizes or the cache is explicitly cleared.
 */
const layoutMemoryCache = new Map<string, GridConfig>();

/**
 * Persist the layout cache to localStorage so positions survive page reloads.
 * Only stores the config for the current viewport dimensions.
 */
function saveLayoutToStorage(key: string, config: GridConfig): void {
  try {
    const stored = JSON.parse(localStorage.getItem(LAYOUT_CACHE_KEY) || '{}');
    stored[key] = config;
    localStorage.setItem(LAYOUT_CACHE_KEY, JSON.stringify(stored));
  } catch {
    // localStorage unavailable — silent fail, memory cache still works
  }
}

/**
 * Load a previously saved layout from localStorage.
 */
function loadLayoutFromStorage(key: string): GridConfig | null {
  try {
    const stored = JSON.parse(localStorage.getItem(LAYOUT_CACHE_KEY) || '{}');
    return stored[key] ?? null;
  } catch {
    return null;
  }
}

/**
 * Evict old viewport entries from both caches so only the current viewport is retained.
 * Call this when the viewport changes.
 */
export function evictLayoutCache(currentWidth: number, currentHeight: number): void {
  const currentPrefix = `${Math.round(currentWidth)}|${Math.round(currentHeight)}|`;
  for (const key of layoutMemoryCache.keys()) {
    if (!key.startsWith(currentPrefix)) {
      layoutMemoryCache.delete(key);
    }
  }
  try {
    const stored = JSON.parse(localStorage.getItem(LAYOUT_CACHE_KEY) || '{}');
    const evicted: Record<string, GridConfig> = {};
    for (const [key, value] of Object.entries(stored)) {
      if (key.startsWith(currentPrefix)) {
        evicted[key] = value as GridConfig;
      }
    }
    localStorage.setItem(LAYOUT_CACHE_KEY, JSON.stringify(evicted));
  } catch {
    // silent fail
  }
}

/**
 * Calculates a four-zone grid that reserves a centered square for image preview.
 * Blocks are placed only in the top, bottom, left, and right regions.
 *
 * Layout positions are cached per viewport size and loaded target count so the grid
 * tracks the real library size while staying stable between ordinary re-renders.
 */
export function calculateFrameGrid(
  viewportWidth: number,
  viewportHeight: number,
  targetCount: number = DEFAULT_TARGET_COUNT,
  centerSize?: number
): GridConfig {
  const width = Math.max(100, viewportWidth);
  const height = Math.max(100, viewportHeight);
  const layoutKey = `${Math.round(width)}|${Math.round(height)}|${targetCount}`;

  // Return the cached layout if we already have one for these dimensions and item count.
  const memoryCached = layoutMemoryCache.get(layoutKey);
  if (memoryCached) {
    return memoryCached;
  }

  const storedLayout = loadLayoutFromStorage(layoutKey);
  if (storedLayout) {
    layoutMemoryCache.set(layoutKey, storedLayout);
    return storedLayout;
  }

  const minDimension = Math.min(width, height);

  // Proportional sizing: on regular 1440x900 desktop, center square is 640px for an 828px viewport height (~77.3%).
  const proportionalSize = Math.min(640, Math.round(minDimension * (640 / 828)));
  const targetCenterSize = typeof centerSize === 'number' && centerSize > 0
    ? Math.min(centerSize, proportionalSize)
    : proportionalSize;

  // Leave room for frame borders and surrounding blocks on all sides
  const maxSafeSize = Math.max(60, minDimension - 24);
  const safeCenterSize = Math.max(60, Math.min(targetCenterSize, maxSafeSize));

  let low = 1;
  let high = Math.max(width, height);

  for (let i = 0; i < 36; i += 1) {
    const midpoint = (low + high) / 2;
    const count = countFrameBlocks(width, height, safeCenterSize, midpoint);

    if (count >= targetCount) {
      low = midpoint;
    } else {
      high = midpoint;
    }
  }

  const { centerSquare, zones, totalBlocks } = buildFrameZones(width, height, safeCenterSize, low);
  const largestZone = zones.reduce<GridZone | null>(
    (largest, zone) => (!largest || zone.totalBlocks > largest.totalBlocks ? zone : largest),
    null
  );

  const config: GridConfig = {
    targetCount,
    cols: largestZone?.cols || 1,
    rows: largestZone?.rows || 1,
    totalBlocks,
    cellWidth: largestZone?.cellWidth || width,
    cellHeight: largestZone?.cellHeight || height,
    mode: 'frame-center',
    centerSquare,
    zones,
  };

  // Lock these positions in memory and localStorage
  layoutMemoryCache.set(layoutKey, config);
  saveLayoutToStorage(layoutKey, config);

  return config;
}

/**
 * Converts mouse coordinates (x, y) relative to canvas into grid column, row, and block index.
 */
export function getIndexFromCoords(
  x: number,
  y: number,
  config: GridConfig
): { col: number; row: number; index: number } | null {
  if (config.zones?.length) {
    for (const zone of config.zones) {
      const inZone =
        x >= zone.x &&
        x < zone.x + zone.width &&
        y >= zone.y &&
        y < zone.y + zone.height;

      if (!inZone) {
        continue;
      }

      const col = Math.floor((x - zone.x) / zone.cellWidth);
      const row = Math.floor((y - zone.y) / zone.cellHeight);

      if (col < 0 || col >= zone.cols || row < 0 || row >= zone.rows) {
        return null;
      }

      const index = zone.startIndex + row * zone.cols + col;
      return index < config.totalBlocks ? { col, row, index } : null;
    }

    return null;
  }

  if (x < 0 || y < 0 || config.cols <= 0 || config.rows <= 0) return null;

  const col = Math.floor(x / config.cellWidth);
  const row = Math.floor(y / config.cellHeight);

  if (col < 0 || col >= config.cols || row < 0 || row >= config.rows) {
    return null;
  }

  const index = row * config.cols + col;
  return { col, row, index };
}

/**
 * Converts block index into top-left canvas pixel bounding box (x, y, w, h).
 */
export function getCoordsFromIndex(
  index: number,
  config: GridConfig
): { x: number; y: number; width: number; height: number; col: number; row: number } | null {
  if (index < 0 || index >= config.totalBlocks) return null;

  if (config.zones?.length) {
    const zone = config.zones.find((candidate) => index >= candidate.startIndex && index < candidate.startIndex + candidate.totalBlocks);
    if (!zone) {
      return null;
    }

    const localIndex = index - zone.startIndex;
    const col = localIndex % zone.cols;
    const row = Math.floor(localIndex / zone.cols);

    return {
      x: zone.x + col * zone.cellWidth,
      y: zone.y + row * zone.cellHeight,
      width: zone.cellWidth,
      height: zone.cellHeight,
      col,
      row,
    };
  }

  const col = index % config.cols;
  const row = Math.floor(index / config.cols);

  const x = col * config.cellWidth;
  const y = row * config.cellHeight;

  return {
    x,
    y,
    width: config.cellWidth,
    height: config.cellHeight,
    col,
    row,
  };
}
