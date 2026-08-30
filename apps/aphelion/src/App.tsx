import React, { Suspense, lazy, useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { GridConfig, GridOverlayMode, HoverState, ImageItem } from './types';
import { calculateFrameGrid, evictLayoutCache } from './utils/gridCalculator';
import { DEFAULT_TARGET_COUNT } from './config';
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
const HighlightsPage = lazy(async () => {
  const module = await import('./components/HighlightsPage');
  return { default: module.HighlightsPage };
});

const AdminPage = lazy(async () => {
  const module = await import('./components/AdminPage');
  return { default: module.AdminPage };
});

const TOP_BANNER_HEIGHT = 36;
const BOTTOM_BANNER_HEIGHT = 36;
const TOTAL_BANNER_HEIGHT = TOP_BANNER_HEIGHT + BOTTOM_BANNER_HEIGHT;
const SIDE_GUTTER = BOTTOM_BANNER_HEIGHT;
const TOTAL_SIDE_GUTTER = SIDE_GUTTER * 2;

function extractDownloadFileName(image: ImageItem) {
  try {
    const url = new URL(image.imageUrl, window.location.origin);
    const rawPath = url.searchParams.get('path') || '';
    const pieces = rawPath.split('/').filter(Boolean);
    if (pieces.length > 0) {
      return pieces.join('__');
    }
  } catch {
    // Fall back to the image code when the image URL is not parseable.
  }

  return `${image.code || 'aphelion-image'}.png`;
}

function extractImagePathFromUrl(imageUrl: string) {
  try {
    const url = new URL(imageUrl, window.location.origin);
    return url.searchParams.get('path') || '';
  } catch {
    return '';
  }
}

type AuthStatus = {
  ok: boolean;
  requireAuth: boolean;
  provider: 'central';
  authBaseUrl: string;
  user: null | {
    id: string;
    username: string;
    displayName: string | null;
    isAdmin: boolean;
    isOwner: boolean;
    memberships: string[];
  };
};

export default function App() {
  const apiBaseUrl = import.meta.env.VITE_APHELION_API_BASE_URL || '';
  const [currentHash, setCurrentHash] = useState(window.location.hash);
  const isHighlightsPage = currentHash === '#highlights';
  const isAdminPage = currentHash === '#admin' || currentHash === '#options' || currentHash === '#admin-highlights';
  const [viewport, setViewport] = useState({
    width: Math.max(100, window.innerWidth - TOTAL_SIDE_GUTTER),
    height: Math.max(100, window.innerHeight - TOTAL_BANNER_HEIGHT),
  });

  const [targetCount, setTargetCount] = useState<number>(DEFAULT_TARGET_COUNT);
  const [overlayMode, setOverlayMode] = useState<GridOverlayMode>('blank');
  const [hoverState, setHoverState] = useState<HoverState | null>(null);
  const [searchFilter, setSearchFilter] = useState<string>('');
  const [page, setPage] = useState<'grid' | 'selected'>('grid');
  const [selectedImage, setSelectedImage] = useState<ImageItem | null>(null);
  const [showUploadModal, setShowUploadModal] = useState<boolean>(false);
  const [showStatsDrawer, setShowStatsDrawer] = useState<boolean>(false);
  const [authStatus, setAuthStatus] = useState<AuthStatus | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [checkedSelectedBlocks, setCheckedSelectedBlocks] = useState<Set<number>>(new Set());
  const [downloadingZip, setDownloadingZip] = useState(false);
  const [highlightedBlocks, setHighlightedBlocks] = useState<Set<number>>(() => {
    try {
      const saved = localStorage.getItem('aphelion_highlighted_blocks');
      const parsed = saved ? JSON.parse(saved) : [];
      return new Set(Array.isArray(parsed) ? parsed.filter((value) => Number.isInteger(value)) : []);
    } catch {
      return new Set();
    }
  });
  const authPopupPollRef = useRef<number | null>(null);

  const loadAuthStatus = useCallback(async () => {
    setAuthLoading(true);
    try {
      const response = await fetch(`${apiBaseUrl}/api/auth/status`, {
        credentials: 'include',
      });
      const data = (await response.json()) as AuthStatus;
      if (!response.ok) {
        throw new Error('Auth status could not be loaded.');
      }
      setAuthStatus(data);
    } catch {
      setAuthStatus({
        ok: false,
        requireAuth: false,
        provider: 'central',
        authBaseUrl: 'https://auth.jeffersonwm.com',
        user: null,
      });
    } finally {
      setAuthLoading(false);
    }
  }, [apiBaseUrl]);

  useEffect(() => {
    void loadAuthStatus();
  }, [loadAuthStatus]);

  const authBaseUrl = authStatus?.authBaseUrl || 'https://auth.jeffersonwm.com';
  const currentUser = authStatus?.user || null;
  const canUseAccountTools = Boolean(currentUser) || authStatus?.requireAuth === false;
  const canAccessAdmin = authStatus?.requireAuth === false || Boolean(currentUser?.isOwner);

  const stopAuthPopupPoll = useCallback(() => {
    if (authPopupPollRef.current !== null) {
      window.clearInterval(authPopupPollRef.current);
      authPopupPollRef.current = null;
    }
  }, []);

  const startAuthPopupPoll = useCallback((popup: Window | null) => {
    stopAuthPopupPoll();
    authPopupPollRef.current = window.setInterval(() => {
      if (!popup || popup.closed) {
        stopAuthPopupPoll();
        void loadAuthStatus();
      }
    }, 700);
  }, [loadAuthStatus, stopAuthPopupPoll]);

  const openCentralAuth = useCallback(() => {
    const url = new URL(authBaseUrl);
    url.searchParams.set('returnTo', window.location.href);
    url.searchParams.set('popup', '1');

    const width = 440;
    const height = 620;
    const left = Math.max(0, Math.round(window.screenX + ((window.outerWidth - width) / 2)));
    const top = Math.max(0, Math.round(window.screenY + ((window.outerHeight - height) / 2)));
    const popup = window.open(
      url.toString(),
      'aphelion-auth-popup',
      `width=${width},height=${height},left=${left},top=${top}`,
    );

    if (!popup) {
      window.location.assign(url.toString());
      return;
    }

    popup.focus();
    startAuthPopupPoll(popup);
  }, [authBaseUrl, startAuthPopupPoll]);

  const handleSignOut = useCallback(async () => {
    try {
      await fetch(`${authBaseUrl}/api/auth/logout`, {
        method: 'POST',
        credentials: 'include',
      });
    } finally {
      window.location.assign('/aphelion/');
    }
  }, [authBaseUrl]);

  useEffect(() => {
    const handleHashChange = () => setCurrentHash(window.location.hash);
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  useEffect(() => {
    return () => stopAuthPopupPoll();
  }, [stopAuthPopupPoll]);

  useEffect(() => {
    if (page === 'selected' && !canUseAccountTools && !authLoading) {
      setPage('grid');
    }
  }, [authLoading, canUseAccountTools, page]);

  useEffect(() => {
    const basePath = import.meta.env.BASE_URL || '/aphelion/';
    const normalizedBasePath = basePath.endsWith('/') ? basePath : `${basePath}/`;
    const currentPath = window.location.pathname.endsWith('/')
      ? window.location.pathname
      : `${window.location.pathname}/`;
    const isHomeRoute = currentPath === normalizedBasePath && currentHash === '';
    const isHighlightsRoute = currentPath === normalizedBasePath && currentHash === '#highlights';
    const isAdminRoute = currentPath === normalizedBasePath && (
      currentHash === '#admin'
      || currentHash === '#options'
      || currentHash === '#admin-highlights'
    );

    if (!isHomeRoute && !isHighlightsRoute && !isAdminRoute) {
      window.history.replaceState(null, '', normalizedBasePath);
      setCurrentHash('');
    }
  }, [currentHash]);

  // Resize Listener for dynamic grid recalculation
  useEffect(() => {
    const handleResize = () => {
      const nextWidth = Math.max(100, window.innerWidth - TOTAL_SIDE_GUTTER);
      const nextHeight = Math.max(100, window.innerHeight - TOTAL_BANNER_HEIGHT);
      // Evict cached layout for old dimensions so new window size computes fresh positions
      evictLayoutCache(nextWidth, nextHeight);
      setViewport({ width: nextWidth, height: nextHeight });
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
        console.warn('Aphelion image catalog could not be loaded. Falling back to the background placeholder image.', error);
      }
    }

    void syncServerImages();

    return () => {
      cancelled = true;
    };
  }, [apiBaseUrl]);

  // Compute Grid Config using the current loaded catalog size so placeholder-only blocks
  // do not fill the remainder when the library has fewer items than the historical default.
  const config: GridConfig = useMemo(() => {
    return calculateFrameGrid(viewport.width, viewport.height, targetCount);
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

  const logHighlightEvent = useCallback((payload: {
    action: 'selected' | 'cleared' | 'cleared-all';
    blockIndex?: number;
    clearedCount?: number;
    image?: ImageItem;
  }) => {
    const url = `${apiBaseUrl}/api/highlight-events`;
    void fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: payload.action,
        blockIndex: payload.blockIndex,
        clearedCount: payload.clearedCount,
        image: payload.image
          ? {
              id: payload.image.id,
              code: payload.image.code,
              title: payload.image.title,
              imageUrl: payload.image.imageUrl,
              cameraInfo: payload.image.cameraInfo,
            }
          : null,
      }),
      keepalive: true,
    }).catch((error) => {
      console.warn('Aphelion highlight event could not be logged.', error);
    });
  }, [apiBaseUrl]);

  useEffect(() => {
    localStorage.setItem('aphelion_highlighted_blocks', JSON.stringify([...highlightedBlocks]));
  }, [highlightedBlocks]);

  const handleBlockClick = useCallback((image: ImageItem, blockIndex: number) => {
    setHighlightedBlocks((current) => {
      const next = new Set(current);
      const action = next.has(blockIndex) ? 'cleared' : 'selected';
      if (next.has(blockIndex)) {
        next.delete(blockIndex);
      } else {
        next.add(blockIndex);
      }
      logHighlightEvent({ action, blockIndex, image });
      return next;
    });
    setSelectedImage(image);
  }, [logHighlightEvent]);

  const selectedImages = useMemo(() => {
    if (page !== 'selected') {
      return [];
    }
    return [...highlightedBlocks]
      .sort((left, right) => left - right)
      .map((blockIndex) => ({ blockIndex, image: getImageByIndex(blockIndex) }));
  }, [highlightedBlocks, page]);

  useEffect(() => {
    if (page !== 'selected') {
      return;
    }
    setCheckedSelectedBlocks(new Set(selectedImages.map(({ blockIndex }) => blockIndex)));
  }, [page, selectedImages]);

  const handleClearHighlights = () => {
    logHighlightEvent({ action: 'cleared-all', clearedCount: highlightedBlocks.size });
    setHighlightedBlocks(new Set());
    setCheckedSelectedBlocks(new Set());
    setHoverState(null);
    setPage('grid');
  };

  const toggleSelectedDownloadBlock = useCallback((blockIndex: number) => {
    setCheckedSelectedBlocks((current) => {
      const next = new Set(current);
      if (next.has(blockIndex)) {
        next.delete(blockIndex);
      } else {
        next.add(blockIndex);
      }
      return next;
    });
  }, []);

  const handleSelectAllSelectedBlocks = useCallback(() => {
    setCheckedSelectedBlocks(new Set(selectedImages.map(({ blockIndex }) => blockIndex)));
  }, [selectedImages]);

  const handleDeselectAllSelectedBlocks = useCallback(() => {
    setCheckedSelectedBlocks(new Set());
  }, []);

  const handleDownloadSelectedZip = useCallback(async () => {
    const itemsToDownload = selectedImages.filter(({ blockIndex }) => checkedSelectedBlocks.has(blockIndex));
    if (itemsToDownload.length === 0 || downloadingZip) {
      return;
    }

    setDownloadingZip(true);
    try {
      const { default: JSZip } = await import('jszip');
      const zip = new JSZip();
      await Promise.all(
        itemsToDownload.map(async ({ image }) => {
          const response = await fetch(image.imageUrl, { credentials: 'include' });
          if (!response.ok) {
            throw new Error(`Image download returned ${response.status}`);
          }

          const blob = await response.blob();
          zip.file(extractDownloadFileName(image), blob);
        })
      );

      const loggedItems = itemsToDownload.map(({ image }) => ({
        id: String(image.id),
        code: image.code,
        title: image.title,
        path: extractImagePathFromUrl(image.imageUrl),
        fileName: extractDownloadFileName(image),
      }));

      try {
        await fetch(`${apiBaseUrl}/api/downloads/selected-log`, {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            items: loggedItems,
          }),
        });
      } catch (error) {
        console.warn('Aphelion selected download could not be logged.', error);
      }

      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(zipBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `aphelion-selected-${new Date().toISOString().slice(0, 10)}.zip`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      window.alert(error instanceof Error ? error.message : 'Selected images could not be downloaded.');
    } finally {
      setDownloadingZip(false);
    }
  }, [apiBaseUrl, checkedSelectedBlocks, downloadingZip, selectedImages]);

  if (isHighlightsPage) {
    return (
      <Suspense fallback={<div className="min-h-screen bg-[#FAFAFA]" />}>
        <HighlightsPage
          apiBaseUrl={apiBaseUrl}
          authStatus={authStatus}
          authLoading={authLoading}
          onSignIn={openCentralAuth}
          onSignOut={handleSignOut}
        />
      </Suspense>
    );
  }

  if (isAdminPage) {
    if (authLoading) {
      return <div className="min-h-screen bg-[#FAFAFA]" />;
    }
    if (!canAccessAdmin) {
      window.history.replaceState(null, '', '/aphelion/');
      return null;
    }
    return (
      <Suspense fallback={<div className="min-h-screen bg-[#FAFAFA]" />}>
        <AdminPage apiBaseUrl={apiBaseUrl} authStatus={authStatus} onSignOut={handleSignOut} />
      </Suspense>
    );
  }

  if (page === 'selected') {
    return (
      <div className="flex min-h-screen flex-col bg-[#FAFAFA] text-slate-800">
        <header className="h-[36px] px-6 bg-[#FAFAFA] flex items-center justify-start shrink-0 relative z-20">
          <button
            type="button"
            onClick={() => setPage('grid')}
            className="font-sans text-sm font-semibold leading-none text-gray-900 hover:text-[#de8bf7] transition-colors duration-1000 hover:duration-150"
          >
            Back
          </button>
        </header>

        <main className="h-[calc(100vh-72px)] overflow-y-auto border-t border-[#e5e5e5] bg-[#FAFAFA] px-[36px] py-[36px]">
          <div className="grid grid-cols-2 gap-[36px] min-[1180px]:grid-cols-4 min-[1700px]:grid-cols-5">
            {selectedImages.map(({ blockIndex, image }) => (
              <figure key={blockIndex} className="relative m-0">
                <label className="absolute right-3 top-3 z-10 flex h-6 w-6 cursor-pointer items-center justify-center border border-[#e5e5e5] bg-[#FAFAFA]/95">
                  <input
                    type="checkbox"
                    checked={checkedSelectedBlocks.has(blockIndex)}
                    onChange={() => toggleSelectedDownloadBlock(blockIndex)}
                    className="h-3.5 w-3.5 accent-[#111827]"
                  />
                </label>
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
        <footer className="flex h-[36px] items-center justify-between border-t border-[#e5e5e5] bg-[#FAFAFA] px-6 font-sans text-sm text-gray-700">
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={handleSelectAllSelectedBlocks}
              disabled={selectedImages.length === 0 || checkedSelectedBlocks.size === selectedImages.length}
              className="font-semibold text-gray-900 hover:text-[#de8bf7] disabled:text-gray-400 transition-colors duration-1000 hover:duration-150"
            >
              Select all
            </button>
            <button
              type="button"
              onClick={handleDeselectAllSelectedBlocks}
              disabled={checkedSelectedBlocks.size === 0}
              className="font-semibold text-gray-900 hover:text-[#de8bf7] disabled:text-gray-400 transition-colors duration-1000 hover:duration-150"
            >
              Deselect all
            </button>
            <button
              type="button"
              onClick={handleDownloadSelectedZip}
              disabled={downloadingZip || checkedSelectedBlocks.size === 0}
              className="font-semibold text-gray-900 hover:text-[#de8bf7] disabled:text-gray-400 transition-colors duration-1000 hover:duration-150"
            >
              {downloadingZip ? 'Downloading...' : `Download (${checkedSelectedBlocks.size})`}
            </button>
          </div>
          <div>
            © 2026 Jefferson Williams. All rights reserved.
          </div>
        </footer>
      </div>
    );
  }

  const centerSquareSize = config.centerSquare?.size || 640;

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#FAFAFA] text-slate-800">
      <header className="h-[36px] px-4 sm:px-6 bg-[#FAFAFA] flex items-center justify-between shrink-0 relative z-20">
        <div className="flex items-center">
          <a
            href="/aphelion/"
            className="font-sans font-semibold text-sm leading-none tracking-normal text-gray-900 hover:text-[#de8bf7] transition-colors duration-1000 hover:duration-150"
          >
            Aphelion
          </a>
          <div className="ml-3 sm:ml-5 flex items-center gap-3 font-sans text-[11px] leading-none text-gray-500">
          {canUseAccountTools && highlightedBlocks.size > 0 ? (
            <>
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
            </>
          ) : (
            <span className="font-semibold text-gray-900">Click</span>
          )}
          </div>
        </div>
        <div className="flex items-center gap-4 font-sans text-sm font-semibold text-gray-900">
          <a href="/aphelion/#highlights" className="hover:text-[#de8bf7] transition-colors duration-1000 hover:duration-150">
            Highlights
          </a>
          {canAccessAdmin && (
            <a href="/aphelion/#admin" className="hover:text-[#de8bf7] transition-colors duration-1000 hover:duration-150">
              Admin
            </a>
          )}
          {currentUser ? (
            <button
              type="button"
              onClick={handleSignOut}
              className="font-sans text-sm font-semibold text-gray-900 hover:text-[#de8bf7] transition-colors duration-1000 hover:duration-150"
            >
              Sign Out
            </button>
          ) : (
            <button
              type="button"
              onClick={openCentralAuth}
              className="font-sans text-sm font-semibold text-gray-900 hover:text-[#de8bf7] transition-colors duration-1000 hover:duration-150"
            >
              Sign In
            </button>
          )}
        </div>
      </header>

      <main className="relative h-[calc(100vh-72px)] overflow-hidden bg-[#FAFAFA] px-[36px] z-10">
        <div className="pointer-events-none absolute left-[36px] top-0 bottom-0 z-[55] border-l border-[#e5e5e5]" />
        <div className="pointer-events-none absolute right-[36px] top-0 bottom-0 z-[55] border-r border-[#e5e5e5]" />
        <div className="pointer-events-none absolute left-0 right-0 top-0 z-[55] border-t border-[#e5e5e5]" />
        <div className="pointer-events-none absolute left-0 right-0 bottom-0 z-[55] border-b border-[#e5e5e5]" />
        <div
          className="pointer-events-none fixed left-1/2 top-1/2 z-[60] -translate-x-1/2 -translate-y-1/2 border border-[#e5e5e5]"
          style={{
            width: `${centerSquareSize}px`,
            height: `${centerSquareSize}px`,
          }}
        />

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

      <footer className="h-[36px] px-4 sm:px-6 bg-[#FAFAFA] flex items-center justify-end shrink-0 relative z-20">
        <p className="m-0 leading-none text-gray-500 text-xs sm:text-sm font-sans truncate">
          &copy; {new Date().getFullYear()}{' '}
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
      <HoverPreviewCard hover={hoverState} size={centerSquareSize} />
    </div>
  );
}
