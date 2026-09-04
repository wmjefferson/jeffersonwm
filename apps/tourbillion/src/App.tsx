import { useCallback, useEffect, useRef, useState, type MouseEvent } from 'react';
import { AnimatePresence } from 'motion/react';

import { INITIAL_SETTINGS, TRAIN_QUALITY_PROFILES } from './constants';
import { SettingsPanel } from './components/SettingsPanel';
import { SettingsTrigger } from './components/SettingsTrigger';
import { StatusOverlay } from './components/StatusOverlay';
import {
  createTrainSimulation,
  placeTileFromQueue,
} from './modes/trains';
import {
  createMatrixColumns,
  createMystifyShapes,
  createPipes,
  createStars,
  createToasters,
} from './modes/initializers';
import { renderMatrixFrame } from './modes/matrixFrame';
import { renderMystifyFrame } from './modes/mystifyFrame';
import { renderPipesFrame } from './modes/pipesFrame';
import { renderStarfieldFrame } from './modes/starfieldFrame';
import { renderToastersFrame } from './modes/toastersFrame';
import { renderTrainsFrame } from './modes/trainsFrame';
import type {
  MatrixColumn,
  Mode,
  MystifyShape,
  Pipe,
  QualityLevel,
  ResetTrigger,
  Star,
  TrainSim,
  Toaster,
  TourbillionSettings,
} from './types';

const SETTINGS_STORAGE_KEY = 'tourbillion:settings';

function loadStoredSettings(): TourbillionSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return { ...INITIAL_SETTINGS, ...parsed };
    }
  } catch {
    // Ignore error
  }
  return INITIAL_SETTINGS;
}

function saveStoredSettings(settings: TourbillionSettings) {
  try {
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Ignore error
  }
}

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const ctxRef = useRef<CanvasRenderingContext2D>(null);
  const broadcastRef = useRef<BroadcastChannel | null>(null);

  // Settings state with multi-window synchronization
  const [settings, setSettings] = useState<TourbillionSettings>(() => loadStoredSettings());
  const {
    mode,
    speed,
    count,
    size,
    trail,
    multicolor,
    quality,
    disableScreensaver,
    trainSpeed,
    trackPlacementInterval,
    straightness,
    resetTrigger,
    resetTimeMin,
    resetTimeMax,
    resetTilesLimit,
  } = settings;

  const updateSetting = useCallback(<K extends keyof TourbillionSettings>(key: K, value: TourbillionSettings[K]) => {
    setSettings((prev) => {
      const next = { ...prev, [key]: value };
      saveStoredSettings(next);
      try {
        broadcastRef.current?.postMessage({ type: 'UPDATE_SETTINGS', settings: next });
      } catch {
        // Ignore
      }
      return next;
    });
  }, []);

  const updateSettings = useCallback((partial: Partial<TourbillionSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...partial };
      saveStoredSettings(next);
      try {
        broadcastRef.current?.postMessage({ type: 'UPDATE_SETTINGS', settings: next });
      } catch {
        // Ignore
      }
      return next;
    });
  }, []);

  useEffect(() => {
    if (typeof BroadcastChannel !== 'undefined') {
      const channel = new BroadcastChannel('tourbillion_sync_channel');
      broadcastRef.current = channel;

      channel.onmessage = (event) => {
        if (event.data?.type === 'UPDATE_SETTINGS' && event.data?.settings) {
          setSettings(event.data.settings);
        }
      };
    }

    const handleStorage = (e: StorageEvent) => {
      if (e.key === SETTINGS_STORAGE_KEY && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          setSettings((prev) => ({ ...prev, ...parsed }));
        } catch {
          // Ignore
        }
      }
    };

    window.addEventListener('storage', handleStorage);

    return () => {
      window.removeEventListener('storage', handleStorage);
      if (broadcastRef.current) {
        broadcastRef.current.close();
        broadcastRef.current = null;
      }
    };
  }, []);

  // Screen-fading state
  const [isFading, setIsFading] = useState(false);
  
  const [showSettings, setShowSettings] = useState(false);
  const [isMouseIdle, setIsMouseIdle] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(() => Boolean(document.fullscreenElement));
  
  const starsRef = useRef<Star[]>([]);
  const matrixRef = useRef<MatrixColumn[]>([]);
  const mystifyRef = useRef<MystifyShape[]>([]);
  const pipesRef = useRef<Pipe[]>([]);
  const toastersRef = useRef<Toaster[]>([]);
  const trainsRef = useRef<TrainSim>({ grid: {}, terrain: {}, trains: [], steam: [], queuedTiles: [], placedTilesCount: 0 });
  const animationRef = useRef<number>(null);
  const idleTimerRef = useRef<number>(null);
  const hueRef = useRef(0);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);

  // Sync state to refs for use in the animation loop
  const trainSpeedRef = useRef(trainSpeed);
  const trackPlacementIntervalRef = useRef(trackPlacementInterval);
  const straightnessRef = useRef(straightness);
  const resetTriggerRef = useRef(resetTrigger);
  const resetTimeMinRef = useRef(resetTimeMin);
  const resetTimeMaxRef = useRef(resetTimeMax);
  const resetTilesLimitRef = useRef(resetTilesLimit);
  const qualityRef = useRef(quality);
  const isFadingRef = useRef(false);
  const nextResetTimeRef = useRef<number>(0);
  const lastTilePlacementTimeRef = useRef<number>(0);

  useEffect(() => { trainSpeedRef.current = trainSpeed; }, [trainSpeed]);
  useEffect(() => { trackPlacementIntervalRef.current = trackPlacementInterval; }, [trackPlacementInterval]);
  useEffect(() => { straightnessRef.current = straightness; }, [straightness]);
  useEffect(() => { resetTriggerRef.current = resetTrigger; }, [resetTrigger]);
  useEffect(() => { resetTimeMinRef.current = resetTimeMin; }, [resetTimeMin]);
  useEffect(() => { resetTimeMaxRef.current = resetTimeMax; }, [resetTimeMax]);
  useEffect(() => { resetTilesLimitRef.current = resetTilesLimit; }, [resetTilesLimit]);
  useEffect(() => { qualityRef.current = quality; }, [quality]);
  const showSettingsRef = useRef(showSettings);
  useEffect(() => {
    showSettingsRef.current = showSettings;
  }, [showSettings]);

  useEffect(() => {
    const handleActivity = () => {
      setIsMouseIdle(false);
      if (idleTimerRef.current) {
        window.clearTimeout(idleTimerRef.current);
      }
      idleTimerRef.current = window.setTimeout(() => {
        if (!showSettingsRef.current) {
          setIsMouseIdle(true);
        }
      }, 5000);
    };

    const handleMouseLeave = (e: globalThis.MouseEvent) => {
      if (e.relatedTarget !== null) {
        return;
      }
      if (idleTimerRef.current) {
        window.clearTimeout(idleTimerRef.current);
        idleTimerRef.current = null;
      }
      if (!showSettingsRef.current) {
        setIsMouseIdle(true);
      }
    };

    const handleBlur = () => {
      if (idleTimerRef.current) {
        window.clearTimeout(idleTimerRef.current);
        idleTimerRef.current = null;
      }
      if (!showSettingsRef.current) {
        setIsMouseIdle(true);
      }
    };

    handleActivity();

    window.addEventListener('mousemove', handleActivity);
    window.addEventListener('mouseenter', handleActivity);
    window.addEventListener('focus', handleActivity);
    document.addEventListener('mouseleave', handleMouseLeave);
    window.addEventListener('mouseout', handleMouseLeave);
    window.addEventListener('blur', handleBlur);

    return () => {
      window.removeEventListener('mousemove', handleActivity);
      window.removeEventListener('mouseenter', handleActivity);
      window.removeEventListener('focus', handleActivity);
      document.removeEventListener('mouseleave', handleMouseLeave);
      window.removeEventListener('mouseout', handleMouseLeave);
      window.removeEventListener('blur', handleBlur);
      if (idleTimerRef.current) {
        window.clearTimeout(idleTimerRef.current);
      }
    };
  }, [showSettings]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const releaseWakeLock = useCallback(async () => {
    if (wakeLockRef.current) {
      try {
        await wakeLockRef.current.release();
      } catch {
        // Ignore wake lock release error
      }
      wakeLockRef.current = null;
    }
  }, []);

  const requestWakeLock = useCallback(async () => {
    if ('wakeLock' in navigator && isFullscreen && disableScreensaver && document.visibilityState === 'visible') {
      try {
        if (!wakeLockRef.current || wakeLockRef.current.released) {
          wakeLockRef.current = await navigator.wakeLock.request('screen');
          wakeLockRef.current.addEventListener('release', () => {
            wakeLockRef.current = null;
          });
        }
      } catch {
        // Wake lock request failed or rejected
      }
    } else {
      await releaseWakeLock();
    }
  }, [isFullscreen, disableScreensaver, releaseWakeLock]);

  useEffect(() => {
    if (isFullscreen && disableScreensaver) {
      requestWakeLock().catch(() => undefined);
    } else {
      releaseWakeLock().catch(() => undefined);
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        if (isFullscreen && disableScreensaver) {
          requestWakeLock().catch(() => undefined);
        }
      } else {
        releaseWakeLock().catch(() => undefined);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      releaseWakeLock().catch(() => undefined);
    };
  }, [isFullscreen, disableScreensaver, requestWakeLock, releaseWakeLock]);

  const initStars = useCallback(() => {
    const { innerWidth: width, innerHeight: height } = window;
    starsRef.current = createStars({ width, height, count, multicolor });
  }, [count, multicolor]);

  const initMatrix = useCallback(() => {
    matrixRef.current = createMatrixColumns({
      width: window.innerWidth,
      size,
      speed,
    });
  }, [size, speed]);

  const initMystify = useCallback(() => {
    mystifyRef.current = createMystifyShapes({
      width: window.innerWidth,
      height: window.innerHeight,
      count,
      speed,
      multicolor,
    });
  }, [count, speed, multicolor]);

  const initPipes = useCallback(() => {
    ctxRef.current?.clearRect(0, 0, window.innerWidth, window.innerHeight);
    pipesRef.current = createPipes({
      width: window.innerWidth,
      height: window.innerHeight,
      count,
      multicolor,
    });
  }, [count, multicolor]);

  const initToasters = useCallback(() => {
    toastersRef.current = createToasters({
      width: window.innerWidth,
      height: window.innerHeight,
      count,
    });
  }, [count]);

  const initTrains = useCallback(() => {
    ctxRef.current?.clearRect(0, 0, window.innerWidth, window.innerHeight);
    const init = createTrainSimulation({
      size,
      straightness: straightnessRef.current,
      resetTimeMin: resetTimeMinRef.current,
      resetTimeMax: resetTimeMaxRef.current,
      nowMs: performance.now(),
      initialTrainCountMin: TRAIN_QUALITY_PROFILES[qualityRef.current].initialTrainCountMin,
      initialTrainCountRange: TRAIN_QUALITY_PROFILES[qualityRef.current].initialTrainCountRange,
      trackSeedSegments: TRAIN_QUALITY_PROFILES[qualityRef.current].trackSeedSegments,
    });

    trainsRef.current = init.sim;
    nextResetTimeRef.current = init.nextResetTime;
    lastTilePlacementTimeRef.current = init.lastTilePlacementTime;
  }, [size]);

  const triggerFadeReset = useCallback(() => {
    if (isFadingRef.current) return;
    isFadingRef.current = true;
    setIsFading(true);

    setTimeout(() => {
      if (mode === 'trains') {
        initTrains();
      } else if (mode === 'pipes') {
        initPipes();
      } else if (mode === 'starfield') {
        initStars();
      } else if (mode === 'matrix') {
        initMatrix();
      } else if (mode === 'mystify') {
        initMystify();
      } else if (mode === 'toasters') {
        initToasters();
      }

      setTimeout(() => {
        setIsFading(false);
        isFadingRef.current = false;
      }, 500);
    }, 1500);
  }, [mode, initTrains, initPipes, initStars, initMatrix, initMystify, initToasters]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    (ctxRef as any).current = ctx;
    ctx.clearRect(0, 0, canvas.width, canvas.height); // Initial clear

    const handleResize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      if (mode === 'starfield') initStars();
      if (mode === 'matrix') initMatrix();
      if (mode === 'mystify') initMystify();
      if (mode === 'pipes') initPipes();
      if (mode === 'toasters') initToasters();
      if (mode === 'trains') initTrains();
    };

    const update = () => {
      const { innerWidth: w, innerHeight: h } = window;
      hueRef.current = (hueRef.current + speed * 1.5) % 360; // Faster shift
      
      const nowMs = performance.now();
      const trainQuality = TRAIN_QUALITY_PROFILES[qualityRef.current];
      
      // Auto screen fade reset triggers (only for 'trains' mode)
      const trigger = resetTriggerRef.current;
      if (!isFadingRef.current && mode === 'trains') {
          if (trigger === 'time' && nowMs >= nextResetTimeRef.current) {
              triggerFadeReset();
          } else if (trigger === 'tiles') {
              const count = trainsRef.current.placedTilesCount || 0;
              if (count >= resetTilesLimitRef.current) {
                  triggerFadeReset();
              }
          }
      }

      // Process queued tile placements (only for 'trains' mode)
      if (mode === 'trains') {
          const elapsedPlacement = nowMs - lastTilePlacementTimeRef.current;
          const currentInterval = trackPlacementIntervalRef.current;
          
          if (currentInterval === 0) {
              if (trainsRef.current.queuedTiles) {
                  while (trainsRef.current.queuedTiles.length > 0) {
                      placeTileFromQueue(trainsRef.current);
                  }
              }
          } else if (elapsedPlacement >= currentInterval) {
              const tilesToPlace = Math.min(
                  trainsRef.current.queuedTiles?.length || 0,
                  Math.floor(elapsedPlacement / currentInterval)
              );
              for (let i = 0; i < tilesToPlace; i++) {
                  placeTileFromQueue(trainsRef.current);
              }
              lastTilePlacementTimeRef.current = nowMs - (elapsedPlacement % currentInterval);
          }
      }
      
      if (mode === 'starfield') {
        renderStarfieldFrame({
          ctx,
          width: w,
          height: h,
          stars: starsRef.current,
          speed,
          size,
          trail,
          multicolor,
          hue: hueRef.current,
        });
      } else if (mode === 'matrix') {
        renderMatrixFrame({
          ctx,
          width: w,
          height: h,
          columns: matrixRef.current,
          speed,
          size,
          trail,
          multicolor,
          hue: hueRef.current,
        });
      } else if (mode === 'mystify') {
        renderMystifyFrame({
          ctx,
          width: w,
          height: h,
          shapes: mystifyRef.current,
          size,
          trail,
          multicolor,
          hue: hueRef.current,
        });
      } else if (mode === 'pipes') {
        renderPipesFrame({
          ctx,
          width: w,
          height: h,
          pipes: pipesRef.current,
          speed,
          size,
          trail,
        });
      } else if (mode === 'toasters') {
        renderToastersFrame({
          ctx,
          width: w,
          height: h,
          toasters: toastersRef.current,
          speed,
          size,
        });
      } else if (mode === 'trains') {
        renderTrainsFrame({
          ctx,
          width: w,
          height: h,
          size,
          sim: trainsRef.current,
          trainQuality,
          trainSpeed: trainSpeedRef.current,
          straightness: straightnessRef.current,
        });
      }

      animationRef.current = requestAnimationFrame(update);
    };

    window.addEventListener('resize', handleResize);
    
    handleResize(); 
    animationRef.current = requestAnimationFrame(update);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [mode, speed, size, trail, multicolor, initStars, initMatrix, initMystify, initPipes, initToasters, initTrains]);

  const resetToDefaults = () => {
    setSettings(INITIAL_SETTINGS);
    saveStoredSettings(INITIAL_SETTINGS);
    try {
      broadcastRef.current?.postMessage({ type: 'UPDATE_SETTINGS', settings: INITIAL_SETTINGS });
    } catch {
      // Ignore
    }
  };

  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        await document.documentElement.requestFullscreen();
      }
    } catch {
      // Ignore errors if fullscreen request or exit is rejected
    }
  };

  const handleDoubleClick = (e: MouseEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('#settings-panel, #settings-trigger, #fullscreen-trigger')) {
      return;
    }
    toggleFullscreen().catch(() => undefined);
  };

  return (
    <div 
      className={`fixed inset-0 bg-black transition-all duration-700 ${isMouseIdle ? 'cursor-none' : 'cursor-default'}`}
      id="screensaver-container"
      onDoubleClick={handleDoubleClick}
    >
      <div 
        className={`fixed inset-0 bg-black pointer-events-none transition-opacity duration-1000 z-[40] ${
          isFading ? 'opacity-100' : 'opacity-0'
        }`}
        id="fade-transition-overlay"
      />

      <canvas
        ref={canvasRef}
        className="w-full h-full block"
        id="main-canvas"
      />

      <SettingsTrigger
        hidden={isMouseIdle}
        isFullscreen={isFullscreen}
        onOpen={() => setShowSettings(true)}
        onToggleFullscreen={() => {
          toggleFullscreen().catch(() => undefined);
        }}
      />

      <AnimatePresence>
        <SettingsPanel
          show={showSettings}
          mode={mode}
          speed={speed}
          size={size}
          trail={trail}
          multicolor={multicolor}
          quality={quality}
          trainSpeed={trainSpeed}
          trackPlacementInterval={trackPlacementInterval}
          straightness={straightness}
          resetTrigger={resetTrigger}
          resetTimeMin={resetTimeMin}
          resetTimeMax={resetTimeMax}
          resetTilesLimit={resetTilesLimit}
          disableScreensaver={disableScreensaver}
          onClose={() => setShowSettings(false)}
          onModeChange={(m) => updateSetting('mode', m)}
          onSpeedChange={(s) => updateSetting('speed', s)}
          onSizeChange={(sz) => updateSetting('size', sz)}
          onTrailChange={(t) => updateSetting('trail', t)}
          onMulticolorToggle={() => updateSetting('multicolor', !multicolor)}
          onQualityChange={(q) => updateSetting('quality', q)}
          onTrainSpeedChange={(ts) => updateSetting('trainSpeed', ts)}
          onTrackPlacementIntervalChange={(tpi) => updateSetting('trackPlacementInterval', tpi)}
          onStraightnessChange={(st) => updateSetting('straightness', st)}
          onResetTriggerChange={(rt) => updateSetting('resetTrigger', rt)}
          onResetTimeMinChange={(value) => {
            if (value > resetTimeMax) {
              updateSettings({ resetTimeMin: value, resetTimeMax: value });
            } else {
              updateSetting('resetTimeMin', value);
            }
          }}
          onResetTimeMaxChange={(value) => updateSetting('resetTimeMax', value)}
          onResetTilesLimitChange={(value) => updateSetting('resetTilesLimit', value)}
          onDisableScreensaverToggle={() => updateSetting('disableScreensaver', !disableScreensaver)}
          onTriggerFadeReset={triggerFadeReset}
          onResetDefaults={resetToDefaults}
        />
      </AnimatePresence>

      <StatusOverlay mode={mode} quality={quality} />
    </div>
  );
}
