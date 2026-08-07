import { GridConfig, GridZone } from '../types';

/**
 * Calculates optimal grid columns and rows for a given viewport and target cell count.
 * Guarantees totalBlocks >= targetCount.
 */
export function calculateGrid(
  viewportWidth: number,
  viewportHeight: number,
  targetCount: number = 9170,
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

function buildFrameZones(width: number, height: number, centerSize: number, cellSize: number) {
  const { centerSquare, rects } = getFrameZoneRects(width, height, centerSize);
  let startIndex = 0;
  const zones: GridZone[] = [];

  for (const rect of rects) {
    const cols = Math.max(0, Math.floor(rect.width / cellSize));
    const rows = Math.max(0, Math.floor(rect.height / cellSize));
    const totalBlocks = cols * rows;

    if (totalBlocks === 0) {
      continue;
    }

    zones.push({
      ...rect,
      cols,
      rows,
      cellWidth: rect.width / cols,
      cellHeight: rect.height / rows,
      startIndex,
      totalBlocks,
    });
    startIndex += totalBlocks;
  }

  return { centerSquare, zones, totalBlocks: startIndex };
}

/**
 * Calculates a four-zone grid that reserves a centered square for image preview.
 * Blocks are placed only in the top, bottom, left, and right regions.
 */
export function calculateFrameGrid(
  viewportWidth: number,
  viewportHeight: number,
  targetCount: number = 9170,
  centerSize: number = 640
): GridConfig {
  const width = Math.max(100, viewportWidth);
  const height = Math.max(100, viewportHeight);
  const safeCenterSize = Math.max(120, Math.min(centerSize, width, height));

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

  return {
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
