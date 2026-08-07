import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { GridConfig, GridOverlayMode, HoverState, ImageItem } from './types';
import { calculateFrameGrid } from './utils/gridCalculator';
import {
  clearCustomImages,
  clearServerImages,
  getImageByIndex,
  loadServerImages,
  setCustomImage,
  setServerImages,
} from './utils/imageDatabase';
import { GridCanvas } from './components/GridCanvas';
import { HoverPreviewCard } from './components/HoverPreviewCard';
import { ControlToolbar } from './components/ControlToolbar';
import { ImageDetailModal } from './components/ImageDetailModal';
import { UploadModal } from './components/UploadModal';
import { StatsDrawer } from './components/StatsDrawer';

const TOP_BANNER_HEIGHT = 48;
const BOTTOM_BANNER_HEIGHT = 42;
const TOTAL_BANNER_HEIGHT = TOP_BANNER_HEIGHT + BOTTOM_BANNER_HEIGHT;
const SIDE_GUTTER = BOTTOM_BANNER_HEIGHT;
const TOTAL_SIDE_GUTTER = SIDE_GUTTER * 2;
const PREVIEW_SQUARE_SIZE = 640;

export default function App() {
  const apiBaseUrl = import.meta.env.VITE_APHELION_API_BASE_URL || '';
  const [viewport, setViewport] = useState({
    width: Math.max(100, window.innerWidth - TOTAL_SIDE_GUTTER),
    height: Math.max(100, window.innerHeight - TOTAL_BANNER_HEIGHT),
  });

  const [targetCount, setTargetCount] = useState<number>(9170);
  const [overlayMode, setOverlayMode] = useState<GridOverlayMode>('blank');
  const [hoverState, setHoverState] = useState<HoverState | null>(null);
  const [searchFilter, setSearchFilter] = useState<string>('');
  const [page, setPage] = useState<'grid' | 'selected'>('grid');
  const [selectedImage, setSelectedImage] = useState<ImageItem | null>(null);
  const [showUploadModal, setShowUploadModal] = useState<boolean>(false);
  const [showStatsDrawer, setShowStatsDrawer] = useState<boolean>(false);
  const [highlightedBlocks, setHighlightedBlocks] = useState<Set<number>>(() => {
    try {
      const saved = localStorage.getItem('aphelion_highlighted_blocks');
      const parsed = saved ? JSON.parse(saved) : [];
      return new Set(Array.isArray(parsed) ? parsed.filter((value) => Number.isInteger(value)) : []);
    } catch {
      return new Set();
    }
  });

  // Resize Listener for dynamic grid recalculation
  useEffect(() => {
    const handleResize = () => {
      setViewport({
        width: Math.max(100, window.innerWidth - TOTAL_SIDE_GUTTER),
        height: Math.max(100, window.innerHeight - TOTAL_BANNER_HEIGHT),
      });
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Load the live image catalog from the server-backed Keep directory.
  useEffect(() => {
    let cancelled = false;

    async function syncServerImages() {
      try {
        const items = await loadServerImages(apiBaseUrl);
        if (cancelled || items.length === 0) {
          return;
        }

        clearServerImages();
        setServerImages(items);
        setTargetCount(items.length);
      } catch (error) {
        console.warn('Aphelion image catalog could not be loaded. Falling back to generated placeholders.', error);
      }
    }

    void syncServerImages();

    return () => {
      cancelled = true;
    };
  }, [apiBaseUrl]);

  // Compute Grid Config to guarantee totalBlocks >= targetCount (9,170)
  const config: GridConfig = useMemo(() => {
    return calculateFrameGrid(viewport.width, viewport.height, targetCount, PREVIEW_SQUARE_SIZE);
  }, [viewport.width, viewport.height, targetCount]);

  // Search Filter matching engine across the current image catalog
  const searchResults = useMemo(() => {
    const query = searchFilter.trim().toLowerCase();
    if (!query) return [];

    const matches: number[] = [];

    // Check if user searched for direct number e.g. "4821" or "#4821" or "block 4821"
    const parsedNum = parseInt(query.replace(/[^0-9]/g, ''), 10);
    if (!isNaN(parsedNum) && parsedNum >= 1 && parsedNum <= config.totalBlocks) {
      matches.push(parsedNum - 1); // 0-indexed
    }

    // Limit scanning to avoid freezing on massive queries
    const maxScan = Math.min(config.totalBlocks, 15000);
    for (let i = 0; i < maxScan; i++) {
      if (matches.length >= 500) break; // Limit highlight set
      if (matches.includes(i)) continue;

      const img = getImageByIndex(i);
      if (
        img.title.toLowerCase().includes(query) ||
        img.category.toLowerCase().includes(query) ||
        img.code.toLowerCase().includes(query) ||
        img.tags.some((t) => t.toLowerCase().includes(query))
      ) {
        matches.push(i);
      }
    }

    return matches;
  }, [searchFilter, config.totalBlocks]);

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      if (e.code === 'Space') {
        e.preventDefault();
        setHoverState((prev) => (prev ? { ...prev, pinned: !prev.pinned } : null));
      } else if (e.code === 'Escape') {
        setSelectedImage(null);
        setShowUploadModal(false);
        setShowStatsDrawer(false);
        setHoverState(null);
      } else if (e.key.toLowerCase() === 'r') {
        // Random block jump
        const randomIndex = Math.floor(Math.random() * config.totalBlocks);
        const img = getImageByIndex(randomIndex);
        setHoverState({
          index: randomIndex,
          x: window.innerWidth / 2,
          y: window.innerHeight / 2,
          col: randomIndex % config.cols,
          row: Math.floor(randomIndex / config.cols),
          image: img,
          pinned: true,
        });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [config.totalBlocks, config.cols]);

  const handleRandomSelect = useCallback(() => {
    const randomIndex = Math.floor(Math.random() * config.totalBlocks);
    const img = getImageByIndex(randomIndex);
    setHoverState({
      index: randomIndex,
      x: window.innerWidth / 2,
      y: window.innerHeight / 2,
      col: randomIndex % config.cols,
      row: Math.floor(randomIndex / config.cols),
      image: img,
      pinned: true,
    });
  }, [config.totalBlocks, config.cols]);

  const handleCustomUpload = useCallback((customImages: ImageItem[]) => {
    clearCustomImages();
    customImages.forEach((img, idx) => {
      setCustomImage(idx, img);
    });
  }, []);

  useEffect(() => {
    localStorage.setItem('aphelion_highlighted_blocks', JSON.stringify([...highlightedBlocks]));
  }, [highlightedBlocks]);

  const handleBlockClick = useCallback((image: ImageItem, blockIndex: number) => {
    setHighlightedBlocks((current) => {
      const next = new Set(current);
      if (next.has(blockIndex)) {
        next.delete(blockIndex);
      } else {
        next.add(blockIndex);
      }
      return next;
    });
    setSelectedImage(image);
  }, []);

  const selectedImages = useMemo(() => {
    return [...highlightedBlocks]
      .sort((left, right) => left - right)
      .map((blockIndex) => ({ blockIndex, image: getImageByIndex(blockIndex) }));
  }, [highlightedBlocks]);

  const handleClearHighlights = () => {
    setHighlightedBlocks(new Set());
    setHoverState(null);
    setPage('grid');
  };

  if (page === 'selected') {
    return (
      <div className="min-h-screen bg-[#FAFAFA] text-slate-800">
        <header className="h-[48px] px-6 bg-[#FAFAFA] flex items-center justify-start shrink-0 relative z-20">
          <button
            type="button"
            onClick={() => setPage('grid')}
            className="font-sans text-sm font-semibold leading-none text-gray-900 hover:text-[#de8bf7] transition-colors duration-1000 hover:duration-150"
          >
            Back
          </button>
        </header>

        <main className="min-h-[calc(100vh-48px)] border-t border-[#e5e5e5] bg-[#FAFAFA] px-[42px] py-[42px]">
          <div className="grid grid-cols-2 gap-[42px] min-[1180px]:grid-cols-4 min-[1700px]:grid-cols-5">
            {selectedImages.map(({ blockIndex, image }) => (
              <figure key={blockIndex} className="m-0">
                <img
                  src={image.thumbUrl || image.imageUrl}
                  alt={image.title}
                  className="block aspect-square w-full border border-[#e5e5e5] object-cover"
                  loading="lazy"
                />
              </figure>
            ))}
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#FAFAFA] text-slate-800">
      <header className="h-[48px] px-6 bg-[#FAFAFA] flex items-center justify-start shrink-0 relative z-20">
        <a
          href="/aphelion/"
          className="font-sans font-semibold text-sm leading-none tracking-normal text-gray-900 hover:text-[#de8bf7] transition-colors duration-1000 hover:duration-150"
        >
          Aphelion
        </a>
        {highlightedBlocks.size > 0 && (
          <div className="absolute left-6 top-[28px] flex items-center gap-3 font-sans text-[11px] leading-none text-gray-500">
            <button
              type="button"
              onClick={() => setPage('selected')}
              className="font-semibold text-gray-900 hover:text-[#de8bf7] transition-colors duration-1000 hover:duration-150"
            >
              Selected
            </button>
            <button
              type="button"
              onClick={handleClearHighlights}
              className="font-semibold text-gray-900 hover:text-[#de8bf7] transition-colors duration-1000 hover:duration-150"
            >
              Clear
            </button>
          </div>
        )}
      </header>

      <main className="relative h-[calc(100vh-90px)] overflow-hidden bg-[#FAFAFA] px-[42px] z-10">
        <div className="pointer-events-none absolute left-[42px] top-0 bottom-0 z-[55] border-l border-[#e5e5e5]" />
        <div className="pointer-events-none absolute right-[42px] top-0 bottom-0 z-[55] border-r border-[#e5e5e5]" />
        <div className="pointer-events-none absolute left-0 right-0 top-0 z-[55] border-t border-[#e5e5e5]" />
        <div className="pointer-events-none absolute left-0 right-0 bottom-0 z-[55] border-b border-[#e5e5e5]" />
        <div className="pointer-events-none fixed left-1/2 top-1/2 z-[60] h-[640px] w-[640px] -translate-x-1/2 -translate-y-1/2 border border-[#e5e5e5]" />

        {/* Aphelion Grid Canvas */}
        <GridCanvas
          config={config}
          overlayMode={overlayMode}
          hoverState={hoverState}
          searchFilter={searchFilter}
          searchResults={searchResults}
          highlightedBlocks={highlightedBlocks}
          onHover={setHoverState}
          onClickBlock={handleBlockClick}
        />
      </main>

      <footer className="h-[42px] px-6 bg-[#FAFAFA] flex items-center justify-start shrink-0 relative z-20">
        <p className="m-0 leading-none text-gray-500 text-sm font-sans">
          Aphelion &copy; {new Date().getFullYear()}{' '}
          <a
            href="https://jeffersonwm.com"
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-gray-900 hover:text-[#de8bf7] transition-colors duration-1000 hover:duration-150"
          >
            Jefferson Williams
          </a>
          . All rights reserved.{' '}
          <a
            href="https://github.com/wmjefferson/jeffersonwm"
            target="_blank"
            rel="noopener noreferrer"
            className="text-gray-900 hover:text-[#de8bf7] transition-colors duration-1000 hover:duration-150"
          >
            GitHub
          </a>
          .
        </p>
      </footer>

      {/* Pure Hover Image Popup */}
      <HoverPreviewCard hover={hoverState} />
    </div>
  );
}
