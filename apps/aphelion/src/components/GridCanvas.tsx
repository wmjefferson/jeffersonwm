import React, { useEffect, useRef, useState, useCallback } from 'react';
import { GridConfig, GridOverlayMode, HoverState, ImageItem } from '../types';
import { getIndexFromCoords, getCoordsFromIndex } from '../utils/gridCalculator';
import { getImageByIndex, hslToHex } from '../utils/imageDatabase';

interface GridCanvasProps {
  config: GridConfig;
  overlayMode: GridOverlayMode;
  hoverState: HoverState | null;
  searchFilter: string;
  searchResults: number[];
  highlightedBlocks: Set<number>;
  onHover: (hover: HoverState | null) => void;
  onClickBlock: (image: ImageItem, blockIndex: number) => void;
}

const CATEGORY_COLORS: Record<string, string> = {
  Nature: '#10b981', // Emerald
  Space: '#6366f1', // Indigo
  Architecture: '#f59e0b', // Amber
  Cyberpunk: '#ec4899', // Pink
  Abstract: '#8b5cf6', // Violet
  Wildlife: '#84cc16', // Lime
  Portraits: '#f43f5e', // Rose
  Textures: '#06b6d4', // Cyan
  Minimalist: '#64748b', // Slate
  Urban: '#3b82f6', // Blue
};

export const GridCanvas: React.FC<GridCanvasProps> = ({
  config,
  overlayMode,
  hoverState,
  searchFilter,
  searchResults,
  highlightedBlocks,
  onHover,
  onClickBlock,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const hoverDelayRef = useRef<ReturnType<typeof window.setTimeout> | null>(null);
  const [settledHoverState, setSettledHoverState] = useState<HoverState | null>(null);
  const [dimensions, setDimensions] = useState<{ width: number; height: number }>({ width: 800, height: 600 });
  const [fps, setFps] = useState<number>(60);

  const fpsFrameCount = useRef(0);
  const fpsLastTime = useRef(performance.now());

  // Observe container size
  useEffect(() => {
    if (!containerRef.current) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          setDimensions({ width, height });
        }
      }
    });

    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (hoverDelayRef.current) {
      window.clearTimeout(hoverDelayRef.current);
      hoverDelayRef.current = null;
    }

    if (hoverState?.pinned) {
      setSettledHoverState(hoverState);
      return;
    }

    hoverDelayRef.current = window.setTimeout(() => {
      setSettledHoverState(hoverState);
      hoverDelayRef.current = null;
    }, 250);

    return () => {
      if (hoverDelayRef.current) {
        window.clearTimeout(hoverDelayRef.current);
        hoverDelayRef.current = null;
      }
    };
  }, [hoverState]);

  // Render loop
  const drawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const width = dimensions.width;
    const height = dimensions.height;

    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    ctx.scale(dpr, dpr);

    const { cols, rows, cellWidth, cellHeight, totalBlocks } = config;
    const zones = config.zones;

    const isBlankMode = overlayMode === 'blank';

    // Fill canvas background
    ctx.fillStyle = '#FAFAFA';
    ctx.fillRect(0, 0, width, height);

    const isSearchActive = searchResults.length > 0 && searchFilter.trim().length > 0;
    const searchSet = isSearchActive ? new Set(searchResults) : null;

    // Time factor for search pulse
    const now = performance.now();
    const pulseFactor = (Math.sin(now / 200) + 1) / 2; // 0..1

    const drawBlock = (index: number, x: number, y: number, blockWidth: number, blockHeight: number) => {
      const image = getImageByIndex(index);

      let cellColor = '#1e293b';

      if (overlayMode === 'spectrum') {
        const progress = index / Math.max(1, config.targetCount);
        cellColor = hslToHex(progress * 360, 75, 50);
      } else if (overlayMode === 'category') {
        cellColor = CATEGORY_COLORS[image.category] || image.colorHex;
      } else if (overlayMode === 'mosaic') {
        const nx = x / width;
        const ny = y / height;
        const distFromCenter = Math.sqrt((nx - 0.5) ** 2 + (ny - 0.5) ** 2);
        const hue = (nx * 200 + ny * 160 + distFromCenter * 100) % 360;
        const bright = 30 + Math.sin(nx * Math.PI * 4) * 20 + Math.cos(ny * Math.PI * 4) * 20;
        cellColor = hslToHex(hue, 80, bright);
      } else if (overlayMode === 'matrix') {
        const isGlow = (index * 13) % 17 === 0;
        cellColor = isGlow ? '#06b6d4' : '#0f172a';
      } else if (overlayMode === 'heatmap') {
        cellColor = hslToHex(240 - image.brightness * 2.4, 85, 45);
      } else if (overlayMode === 'plain') {
        cellColor = image.colorHex;
      }

      if (searchSet && !searchSet.has(index)) {
        ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
      } else {
        ctx.fillStyle = cellColor;
      }

      ctx.fillRect(x, y, blockWidth, blockHeight);

      if (searchSet && searchSet.has(index)) {
        ctx.fillStyle = `rgba(236, 72, 153, ${0.4 + pulseFactor * 0.5})`;
        ctx.fillRect(x, y, blockWidth, blockHeight);
        ctx.strokeStyle = '#f43f5e';
        ctx.lineWidth = 1;
        ctx.strokeRect(x, y, blockWidth, blockHeight);
      }
    };

    const drawZoneLines = (zone: NonNullable<typeof zones>[number]) => {
      if (zone.cellWidth <= 3 || zone.cellHeight <= 3) {
        return;
      }

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
      ctx.lineWidth = 0.5;
      ctx.beginPath();

      for (let c = 0; c <= zone.cols; c += 1) {
        const lineX = Math.floor(zone.x + c * zone.cellWidth);
        ctx.moveTo(lineX, zone.y);
        ctx.lineTo(lineX, zone.y + zone.height);
      }

      for (let r = 0; r <= zone.rows; r += 1) {
        const lineY = Math.floor(zone.y + r * zone.cellHeight);
        ctx.moveTo(zone.x, lineY);
        ctx.lineTo(zone.x + zone.width, lineY);
      }

      ctx.stroke();
    };

    // Render cells (only if not in blank mode, or if search is highlighting specific cells)
    if (!isBlankMode) {
      if (zones?.length) {
        for (const zone of zones) {
          for (let r = 0; r < zone.rows; r += 1) {
            for (let c = 0; c < zone.cols; c += 1) {
              const index = zone.startIndex + r * zone.cols + c;
              if (index >= totalBlocks) break;
              drawBlock(index, zone.x + c * zone.cellWidth, zone.y + r * zone.cellHeight, zone.cellWidth, zone.cellHeight);
            }
          }
          drawZoneLines(zone);
        }
      } else {
        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < cols; c++) {
            const index = r * cols + c;
            if (index >= totalBlocks) break;
            drawBlock(index, c * cellWidth, r * cellHeight, cellWidth, cellHeight);
          }
        }
      }

      // Grid lines if cell size is large enough (> 3px)
      if (!zones?.length && cellWidth > 3 && cellHeight > 3) {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
        ctx.lineWidth = 0.5;

        ctx.beginPath();
        for (let c = 0; c <= cols; c++) {
          const x = Math.floor(c * cellWidth);
          ctx.moveTo(x, 0);
          ctx.lineTo(x, height);
        }
        for (let r = 0; r <= rows; r++) {
          const y = Math.floor(r * cellHeight);
          ctx.moveTo(0, y);
          ctx.lineTo(width, y);
        }
        ctx.stroke();
      }
    } else if (searchSet) {
      // In blank mode, if search is active, highlight search hits subtly
      for (const index of Array.from(searchSet) as number[]) {
        const coords = getCoordsFromIndex(index, config);
        if (coords) {
          ctx.fillStyle = `rgba(15, 23, 42, ${0.08 + pulseFactor * 0.12})`;
          ctx.fillRect(coords.x, coords.y, coords.width, coords.height);
        }
      }
    }

    for (const index of highlightedBlocks) {
      const coords = getCoordsFromIndex(index, config);
      if (!coords) {
        continue;
      }

      ctx.fillStyle = 'rgba(147, 197, 253, 0.62)';
      ctx.fillRect(coords.x, coords.y, coords.width, coords.height);
      ctx.strokeStyle = 'rgba(37, 99, 235, 0.72)';
      ctx.lineWidth = Math.max(1, Math.min(coords.width / 4, 2));
      ctx.strokeRect(coords.x, coords.y, coords.width, coords.height);
    }

    const hoverOverlay = settledHoverState || (hoverState?.pinned ? hoverState : null);
    if (hoverOverlay) {
      const coords = getCoordsFromIndex(hoverOverlay.index, config);
      if (coords) {
        ctx.fillStyle = 'rgba(245, 158, 11, 0.18)';
        ctx.fillRect(coords.x, coords.y, coords.width, coords.height);
        ctx.strokeStyle = 'rgba(217, 119, 6, 0.95)';
        ctx.lineWidth = Math.max(1, Math.min(coords.width / 5, 2));
        ctx.strokeRect(coords.x + 0.5, coords.y + 0.5, coords.width - 1, coords.height - 1);
      }
    }

    if (hoverState && !hoverState.pinned) {
      const coords = getCoordsFromIndex(hoverState.index, config);
      if (coords) {
        ctx.strokeStyle = 'rgba(254, 240, 138, 0.95)';
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 3]);
        ctx.strokeRect(coords.x + 1, coords.y + 1, coords.width - 2, coords.height - 2);
        ctx.setLineDash([]);
      }
    }

    // Calculate FPS
    fpsFrameCount.current += 1;
    const nowTime = performance.now();
    if (nowTime - fpsLastTime.current >= 1000) {
      setFps(Math.round((fpsFrameCount.current * 1000) / (nowTime - fpsLastTime.current)));
      fpsFrameCount.current = 0;
      fpsLastTime.current = nowTime;
    }
  }, [dimensions, config, overlayMode, searchResults, searchFilter, highlightedBlocks, hoverState, settledHoverState]);

  useEffect(() => {
    let animationFrameId: number;
    const render = () => {
      drawCanvas();
      animationFrameId = requestAnimationFrame(render);
    };
    render();
    return () => cancelAnimationFrame(animationFrameId);
  }, [drawCanvas]);

  // Mouse event handling
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (hoverState?.pinned) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const cellInfo = getIndexFromCoords(x, y, config);

    if (cellInfo && cellInfo.index >= 0 && cellInfo.index < config.totalBlocks) {
      const image = getImageByIndex(cellInfo.index);
      onHover({
        index: cellInfo.index,
        x: e.clientX,
        y: e.clientY,
        col: cellInfo.col,
        row: cellInfo.row,
        image,
        pinned: false,
      });
    } else {
      onHover(null);
    }
  };

  const handleMouseLeave = () => {
    if (!hoverState?.pinned) {
      onHover(null);
    }
  };

  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const cellInfo = getIndexFromCoords(x, y, config);
    if (cellInfo && cellInfo.index >= 0 && cellInfo.index < config.totalBlocks) {
      const image = getImageByIndex(cellInfo.index);
      onClickBlock(image, cellInfo.index);
    }
  };

  const isBlankMode = overlayMode === 'blank';

  return (
    <div ref={containerRef} className="relative w-full h-full overflow-hidden select-none bg-[#FAFAFA]">
      <canvas
        ref={canvasRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        onClick={handleClick}
        className="block cursor-crosshair touch-none"
      />

      {/* FPS & FPS counter floating subtle badge (hidden in blank mode) */}
      {!isBlankMode && (
        <div className="absolute bottom-2 left-3 pointer-events-none flex items-center gap-2 bg-slate-900/80 backdrop-blur-md px-2.5 py-1 rounded-md border border-slate-800 text-[11px] text-slate-400 font-mono">
          <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span>{fps} FPS</span>
          <span className="text-slate-600">•</span>
          <span>
            {config.cols}×{config.rows} = <strong className="text-sky-300">{config.totalBlocks.toLocaleString()} blocks</strong>
          </span>
        </div>
      )}
    </div>
  );
};
