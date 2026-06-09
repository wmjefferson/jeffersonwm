import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence } from 'motion/react';

import { DEFAULT_SETTINGS, TRAIN_QUALITY_PROFILES } from './constants';
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
} from './types';

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const ctxRef = useRef<CanvasRenderingContext2D>(null);
  const [mode, setMode] = useState<Mode>('starfield');
  
  // Settings state
  const [speed, setSpeed] = useState(DEFAULT_SETTINGS.speed);
  const [count, setCount] = useState(DEFAULT_SETTINGS.count);
  const [size, setSize] = useState(DEFAULT_SETTINGS.size);
  const [trail, setTrail] = useState(DEFAULT_SETTINGS.trail);
  const [multicolor, setMulticolor] = useState(DEFAULT_SETTINGS.multicolor);
  const [quality, setQuality] = useState<QualityLevel>(DEFAULT_SETTINGS.quality);
  
  // Custom train state options
  const [trainSpeed, setTrainSpeed] = useState(1.5);
  const [trackPlacementInterval, setTrackPlacementInterval] = useState(300); // ms delay between tiles
  const [straightness, setStraightness] = useState(0.5); // 0 = max turns, 1 = max straight
  const [resetTrigger, setResetTrigger] = useState<ResetTrigger>('time');
  const [resetTimeMin, setResetTimeMin] = useState(30);
  const [resetTimeMax, setResetTimeMax] = useState(60);
  const [resetTilesLimit, setResetTilesLimit] = useState(200);

  // Screen-fading state
  const [isFading, setIsFading] = useState(false);
  
  const [showSettings, setShowSettings] = useState(false);
  const [isMouseIdle, setIsMouseIdle] = useState(false);
  
  const starsRef = useRef<Star[]>([]);
  const matrixRef = useRef<MatrixColumn[]>([]);
  const mystifyRef = useRef<MystifyShape[]>([]);
  const pipesRef = useRef<Pipe[]>([]);
  const toastersRef = useRef<Toaster[]>([]);
  const trainsRef = useRef<TrainSim>({ grid: {}, terrain: {}, trains: [], steam: [], queuedTiles: [], placedTilesCount: 0 });
  const animationRef = useRef<number>(null);
  const idleTimerRef = useRef<number>(null);
  const hueRef = useRef(0);

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

    const handleGlobalMouseMove = () => {
      setIsMouseIdle(false);
      if (idleTimerRef.current) window.clearTimeout(idleTimerRef.current);
      idleTimerRef.current = window.setTimeout(() => {
        if (!showSettings) setIsMouseIdle(true);
      }, 3000);
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('mousemove', handleGlobalMouseMove);
    
    handleResize(); 
    animationRef.current = requestAnimationFrame(update);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('mousemove', handleGlobalMouseMove);
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      if (idleTimerRef.current) window.clearTimeout(idleTimerRef.current);
    };
  }, [mode, speed, size, trail, multicolor, initStars, initMatrix, initMystify, initPipes, initToasters, initTrains, showSettings]);

  const resetToDefaults = () => {
    setSpeed(DEFAULT_SETTINGS.speed);
    setCount(DEFAULT_SETTINGS.count);
    setSize(DEFAULT_SETTINGS.size);
    setTrail(DEFAULT_SETTINGS.trail);
    setMulticolor(DEFAULT_SETTINGS.multicolor);
    setQuality(DEFAULT_SETTINGS.quality);
    setTrainSpeed(1.5);
    setTrackPlacementInterval(300);
    setStraightness(0.5);
    setResetTrigger('time');
    setResetTimeMin(30);
    setResetTimeMax(60);
    setResetTilesLimit(200);
  };

  return (
    <div 
      className={`fixed inset-0 bg-black transition-all duration-700 ${isMouseIdle ? 'cursor-none' : 'cursor-default'}`}
      id="screensaver-container"
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

      <SettingsTrigger hidden={isMouseIdle} onOpen={() => setShowSettings(true)} />

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
          onClose={() => setShowSettings(false)}
          onModeChange={setMode}
          onSpeedChange={setSpeed}
          onSizeChange={setSize}
          onTrailChange={setTrail}
          onMulticolorToggle={() => setMulticolor(!multicolor)}
          onQualityChange={setQuality}
          onTrainSpeedChange={setTrainSpeed}
          onTrackPlacementIntervalChange={setTrackPlacementInterval}
          onStraightnessChange={setStraightness}
          onResetTriggerChange={setResetTrigger}
          onResetTimeMinChange={(value) => {
            setResetTimeMin(value);
            if (value > resetTimeMax) {
              setResetTimeMax(value);
            }
          }}
          onResetTimeMaxChange={setResetTimeMax}
          onResetTilesLimitChange={setResetTilesLimit}
          onTriggerFadeReset={triggerFadeReset}
          onResetDefaults={resetToDefaults}
        />
      </AnimatePresence>

      <StatusOverlay mode={mode} quality={quality} />
    </div>
  );
}
