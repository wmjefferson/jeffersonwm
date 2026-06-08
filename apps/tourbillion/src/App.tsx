import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence } from 'motion/react';

import { DEFAULT_SETTINGS, TRAIN_QUALITY_PROFILES } from './constants';
import { SettingsPanel } from './components/SettingsPanel';
import { SettingsTrigger } from './components/SettingsTrigger';
import { StatusOverlay } from './components/StatusOverlay';
import {
  createTrainFromTrackStart,
  createTrainSimulation,
  drawCar,
  extendTrack,
  getCurvePath,
  getPosAndHeading,
  placeTileFromQueue,
} from './modes/trains';
import type {
  MatrixColumn,
  Mode,
  MystifyShape,
  Pipe,
  Point,
  QualityLevel,
  ResetTrigger,
  Star,
  TerrainCell,
  Toaster,
  Train,
  TrainSim,
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

  const getRandomColor = () => {
    const hues = [0, 60, 180, 240, 300];
    const hue = hues[Math.floor(Math.random() * hues.length)];
    return `hsla(${hue}, 100%, 75%, `;
  };

  const getMatrixChar = () => {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789$+-*/=%\"'#&_(),.;:?!\\|{}<>[]^~";
    return chars.charAt(Math.floor(Math.random() * chars.length));
  };

  const initStars = useCallback(() => {
    const { innerWidth: w, innerHeight: h } = window;
    const stars: Star[] = [];
    for (let i = 0; i < count; i++) {
      stars.push({
        x: (Math.random() - 0.5) * w * 2,
        y: (Math.random() - 0.5) * h * 2,
        z: Math.random() * w,
        px: 0,
        py: 0,
        color: multicolor ? getRandomColor() : 'rgba(255, 255, 255, '
      });
    }
    starsRef.current = stars;
  }, [count, multicolor]);

  const initMatrix = useCallback(() => {
    const { innerWidth: w } = window;
    const fontSize = size * 5;
    const columns = Math.floor(w / fontSize) + 1;
    const matrix: MatrixColumn[] = [];
    for (let i = 0; i < columns; i++) {
      matrix.push({
        x: i * fontSize,
        y: Math.random() * -1000,
        chars: Array.from({ length: 15 }, () => getMatrixChar()),
        speed: (Math.random() * 2 + 1) * speed,
      });
    }
    matrixRef.current = matrix;
  }, [size, speed]);

  const initMystify = useCallback(() => {
    const { innerWidth: w, innerHeight: h } = window;
    const shapes: MystifyShape[] = [];
    const numShapes = Math.floor(count / 250) + 1;
    
    for (let i = 0; i < numShapes; i++) {
      const points: Point[] = Array.from({ length: 4 }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 10 * speed,
        vy: (Math.random() - 0.5) * 10 * speed,
      }));
      shapes.push({
        points,
        history: [],
        color: multicolor ? getRandomColor().replace(', ', ', 0.5)') : 'rgba(255, 255, 255, 0.3)'
      });
    }
    mystifyRef.current = shapes;
  }, [count, speed, multicolor]);

  const initPipes = useCallback(() => {
    ctxRef.current?.clearRect(0, 0, window.innerWidth, window.innerHeight);
    const { innerWidth: w, innerHeight: h } = window;
    const numPipes = Math.floor(count / 500) + 1;
    const grid = 20;
    const pipes: Pipe[] = [];
    for (let i = 0; i < numPipes; i++) {
      pipes.push({
        x: Math.floor(Math.random() * (w / grid)) * grid,
        y: Math.floor(Math.random() * (h / grid)) * grid,
        dir: Math.floor(Math.random() * 4),
        color: multicolor ? getRandomColor().replace(', ', ', 0.8)') : 'rgba(200, 200, 200, 0.8)',
        len: 0
      });
    }
    pipesRef.current = pipes;
  }, [count, multicolor]);

  const initToasters = useCallback(() => {
    const { innerWidth: w } = window;
    const numItems = Math.floor(count / 100) + 1;
    const items: Toaster[] = [];
    for (let i = 0; i < numItems; i++) {
      items.push({
        x: Math.random() * w,
        y: Math.random() * window.innerHeight,
        z: Math.random() * 1000,
        wingPhase: Math.random() * Math.PI * 2,
        type: Math.random() > 0.3 ? 'toaster' : 'toast'
      });
    }
    toastersRef.current = items;
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
        const clearAlpha = Math.max(0.05, 0.8 - (trail * 0.75));
        ctx.fillStyle = `rgba(0, 0, 0, ${clearAlpha})`;
        ctx.fillRect(0, 0, w, h);
        const centerX = w / 2;
        const centerY = h / 2;
        starsRef.current.forEach((star) => {
          star.z -= speed;
          if (star.z <= 0) {
            star.z = w;
            star.x = (Math.random() - 0.5) * w * 2;
            star.y = (Math.random() - 0.5) * h * 2;
            star.px = 0;
            star.py = 0;
          }
          const x = (star.x / star.z) * w + centerX;
          const y = (star.y / star.z) * h + centerY;
          if (star.px !== 0) {
            const opacity = Math.min(1, 1 - star.z / w);
            const color = multicolor ? `hsla(${(star.x + star.y + hueRef.current) % 360}, 100%, 75%, ` : star.color;
            ctx.strokeStyle = `${color}${opacity})`;
            ctx.lineWidth = Math.max(0.1, (1 - star.z / w) * size);
            ctx.beginPath();
            ctx.moveTo(star.px, star.py);
            ctx.lineTo(x, y);
            ctx.stroke();
          }
          star.px = x;
          star.py = y;
        });
      } else if (mode === 'matrix') {
        ctx.fillStyle = `rgba(0, 0, 0, ${0.1 + trail * 0.2})`;
        ctx.fillRect(0, 0, w, h);
        const fontSize = size * 5;
        ctx.font = `${fontSize}px monospace`;
        matrixRef.current.forEach(col => {
          col.y += col.speed;
          if (col.y > h + (col.chars.length * fontSize)) {
            col.y = -fontSize;
            col.speed = (Math.random() * 2 + 1) * speed;
          }
          col.chars.forEach((char, i) => {
            const opacity = 1 - (i / col.chars.length);
            const colorHue = multicolor ? (col.x / w * 360 + hueRef.current) % 360 : 120;
            ctx.fillStyle = `hsla(${colorHue}, 100%, 50%, ${opacity})`;
            ctx.fillText(char, col.x, col.y - (i * fontSize));
            if (Math.random() > 0.98) col.chars[i] = getMatrixChar();
          });
        });
      } else if (mode === 'mystify') {
        ctx.fillStyle = `rgba(0, 0, 0, ${0.05 + (1 - trail) * 0.1})`;
        ctx.fillRect(0, 0, w, h);
        
        mystifyRef.current.forEach(shape => {
          shape.points.forEach(p => {
            p.x += p.vx;
            p.y += p.vy;
            if (p.x < 0 || p.x > w) p.vx *= -1;
            if (p.y < 0 || p.y > h) p.vy *= -1;
          });
          
          shape.history.push(shape.points.map(p => ({ ...p })));
          if (shape.history.length > 20) shape.history.shift();
          
          ctx.lineWidth = size / 2;
          shape.history.forEach((pts, idx) => {
            const color = multicolor ? `hsla(${hueRef.current}, 100%, 75%, ` : shape.color;
            ctx.strokeStyle = color.replace('0.5)', `${(idx / shape.history.length) * 0.5})`).replace('0.3)', `${(idx / shape.history.length) * 0.5})`);
            ctx.beginPath();
            ctx.moveTo(pts[0].x, pts[0].y);
            for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
            ctx.lineTo(pts[0].x, pts[0].y);
            ctx.stroke();
          });
        });
      } else if (mode === 'pipes') {
        // Pipes don't clear fully unless trail is low
        if (trail < 0.1) {
          ctx.fillStyle = 'rgba(0, 0, 0, 0.01)';
          ctx.fillRect(0, 0, w, h);
        }
        
        const grid = 20;
        pipesRef.current.forEach(pipe => {
          ctx.beginPath();
          ctx.lineWidth = size;
          ctx.lineCap = 'round';
          ctx.strokeStyle = pipe.color;
          ctx.moveTo(pipe.x, pipe.y);
          
          const step = speed * 2;
          if (pipe.dir === 0) pipe.y -= step;
          else if (pipe.dir === 1) pipe.x += step;
          else if (pipe.dir === 2) pipe.y += step;
          else if (pipe.dir === 3) pipe.x -= step;
          
          ctx.lineTo(pipe.x, pipe.y);
          ctx.stroke();
          
          pipe.len += step;
          if (pipe.len > Math.random() * 500 + 100 || pipe.x < 0 || pipe.x > w || pipe.y < 0 || pipe.y > h) {
            pipe.dir = Math.floor(Math.random() * 4);
            pipe.len = 0;
            if (pipe.x < 0) pipe.x = 0;
            if (pipe.x > w) pipe.x = w;
            if (pipe.y < 0) pipe.y = 0;
            if (pipe.y > h) pipe.y = h;
          }
        });
      } else if (mode === 'toasters') {
        ctx.fillStyle = 'black';
        ctx.fillRect(0, 0, w, h);
        
        toastersRef.current.forEach(t => {
          t.x -= speed * 2;
          t.y += speed;
          t.wingPhase += 0.2 * speed;
          
          if (t.x < -100 || t.y > h + 100) {
            t.x = w + 100;
            t.y = Math.random() * h - 200;
          }
          
          ctx.save();
          ctx.translate(t.x, t.y);
          const s = size / 2;
          if (t.type === 'toaster') {
            // Body (Retro Toaster)
            ctx.fillStyle = '#bbb';
            ctx.beginPath();
            ctx.roundRect(0, 0, 30*s, 22*s, 4*s);
            ctx.fill();
            ctx.fillStyle = '#888';
            ctx.fillRect(4*s, 4*s, 22*s, 2*s); // Slot
            
            // Wings
            ctx.fillStyle = 'white';
            const wingAngle = Math.sin(t.wingPhase) * (Math.PI / 4);
            
            // Left Wing
            ctx.save();
            ctx.translate(5*s, 5*s);
            ctx.rotate(-wingAngle);
            ctx.beginPath();
            ctx.ellipse(0, 0, 12*s, 6*s, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
            
            // Right Wing
            ctx.save();
            ctx.translate(25*s, 5*s);
            ctx.rotate(wingAngle);
            ctx.beginPath();
            ctx.ellipse(0, 0, 12*s, 6*s, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
          } else {
            // Toast
            ctx.fillStyle = '#eeba72';
            ctx.beginPath();
            ctx.roundRect(0, 0, 20*s, 20*s, 2*s);
            ctx.fill();
            ctx.strokeStyle = '#a67b45';
            ctx.lineWidth = 1;
            ctx.stroke();
          }
          ctx.restore();
        });
      } else if (mode === 'trains') {
        const S = Math.max(80, size * 20);
        const cols = Math.ceil(w / S) + 1;
        const rows = Math.ceil(h / S) + 1;
        
        // 1. Draw organic procedural terrain background - PASS 1 (Base Ground)
        const getBaseColor = (type: string, isAlt: boolean): string => {
          switch (type) {
            case 'grass': return isAlt ? '#5c914e' : '#4f8041';
            case 'forest': return isAlt ? '#2d4d25' : '#23401b';
            case 'autumn': return isAlt ? '#a25d25' : '#8f4f1d';
            case 'snow': return isAlt ? '#eff5f7' : '#e0ebf0';
            case 'lava': return isAlt ? '#282726' : '#1d1c1c';
            case 'water': return isAlt ? '#28589c' : '#224e8c';
            case 'dirt': return isAlt ? '#78593d' : '#6b4f35';
            case 'sand': return isAlt ? '#d9c69c' : '#ccba90';
            case 'stone': return isAlt ? '#686a6c' : '#5d5e60';
            default: return '#5c914e';
          }
        };

        // Draw flat ground first so everything renders seamlessly
        for (let c = -1; c < cols + 1; c++) {
          for (let r = -1; r < rows + 1; r++) {
            const key = `${c},${r}`;
            const cell = trainsRef.current.terrain[key];
            if (cell) {
              const bg = getBaseColor(cell.type, c % 2 === r % 2);
              ctx.fillStyle = bg;
              ctx.fillRect(c * S, r * S, S, S);
            }
          }
        }

        // Draw sub-tile terrain texture detail overlay across the entire grid
        ctx.save();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
        ctx.lineWidth = 1;
        for (let c = -1; c < cols + 1; c++) {
          for (let r = -1; r < rows + 1; r++) {
            // Draw extremely classy and subtle soil speckles/grain
            ctx.fillStyle = (c % 3 === r % 2) ? 'rgba(0, 0, 0, 0.015)' : 'rgba(255, 255, 255, 0.015)';
            ctx.fillRect(c * S + S * 0.15, r * S + S * 0.15, 2, 2);
            ctx.fillRect(c * S + S * 0.75, r * S + S * 0.45, 1.5, 1.5);
            ctx.fillRect(c * S + S * 0.42, r * S + S * 0.80, 2, 2);
          }
        }
        ctx.restore();

        // 1.5 Draw organic procedural terrain PASS 2 (Layered Features and Models)
        for (let c = -1; c < cols + 1; c++) {
          for (let r = -1; r < rows + 1; r++) {
            const key = `${c},${r}`;
            const cell = trainsRef.current.terrain[key];
            if (cell) {
              ctx.save();
              if (cell.type === 'grass') {
                // Grass details (blades)
                ctx.strokeStyle = '#3d6132';
                ctx.lineWidth = 1.5;
                ctx.beginPath();
                ctx.moveTo(c * S + S * 0.25, r * S + S * 0.4); ctx.lineTo(c * S + S * 0.23, r * S + S * 0.28);
                ctx.moveTo(c * S + S * 0.25, r * S + S * 0.4); ctx.lineTo(c * S + S * 0.3, r * S + S * 0.32);
                ctx.moveTo(c * S + S * 0.7, r * S + S * 0.65); ctx.lineTo(c * S + S * 0.67, r * S + S * 0.52);
                ctx.moveTo(c * S + S * 0.7, r * S + S * 0.65); ctx.lineTo(c * S + S * 0.74, r * S + S * 0.54);
                ctx.stroke();
                
                if (cell.variant === 1) { // Red mushroom (fly agaric)
                  ctx.fillStyle = '#fbfbfb';
                  ctx.fillRect(c * S + S * 0.5 - 2, r * S + S * 0.5, 4, 8); // stem
                  ctx.fillStyle = '#ff3b30';
                  ctx.beginPath();
                  ctx.arc(c * S + S * 0.5, r * S + S * 0.52, 7, Math.PI, 0, false); // dome cap
                  ctx.fill();
                  // tiny white cap dots
                  ctx.fillStyle = '#ffffff';
                  ctx.fillRect(c * S + S * 0.5 - 3, r * S + S * 0.49, 1.5, 1.5);
                  ctx.fillRect(c * S + S * 0.5 + 2, r * S + S * 0.5, 1.5, 1.5);
                } else if (cell.variant === 2) { // Bright yellow dandelion patch
                  ctx.fillStyle = '#f1c40f';
                  ctx.beginPath();
                  ctx.arc(c * S + S * 0.3, r * S + S * 0.6, S * 0.05, 0, Math.PI * 2);
                  ctx.arc(c * S + S * 0.4, r * S + S * 0.7, S * 0.05, 0, Math.PI * 2);
                  ctx.fill();
                  ctx.fillStyle = '#f39c12';
                  ctx.beginPath();
                  ctx.arc(c * S + S * 0.35, r * S + S * 0.65, S * 0.03, 0, Math.PI * 2);
                  ctx.fill();
                } else if (cell.variant === 3) { // Double wild shrub
                  ctx.fillStyle = '#2d5225';
                  ctx.beginPath();
                  ctx.arc(c * S + S * 0.65, r * S + S * 0.7, S * 0.09, 0, Math.PI * 2);
                  ctx.arc(c * S + S * 0.75, r * S + S * 0.74, S * 0.07, 0, Math.PI * 2);
                  ctx.fill();
                  ctx.fillStyle = '#39632d';
                  ctx.beginPath();
                  ctx.arc(c * S + S * 0.68, r * S + S * 0.67, S * 0.06, 0, Math.PI * 2);
                  ctx.fill();
                } else if (cell.variant === 4) { // Lavender flower cluster
                  ctx.fillStyle = '#9b59b6'; // Purple lavender tips
                  ctx.beginPath();
                  ctx.arc(c * S + S * 0.42, r * S + S * 0.45, 3.5, 0, Math.PI*2);
                  ctx.arc(c * S + S * 0.38, r * S + S * 0.52, 3, 0, Math.PI*2);
                  ctx.arc(c * S + S * 0.46, r * S + S * 0.55, 4, 0, Math.PI*2);
                  ctx.fill();
                  // Stems
                  ctx.strokeStyle = '#27ae60';
                  ctx.lineWidth = 1;
                  ctx.beginPath();
                  ctx.moveTo(c * S + S * 0.42, r * S + S * 0.45); ctx.lineTo(c * S + S * 0.44, r * S + S * 0.68);
                  ctx.moveTo(c * S + S * 0.38, r * S + S * 0.52); ctx.lineTo(c * S + S * 0.42, r * S + S * 0.68);
                  ctx.moveTo(c * S + S * 0.46, r * S + S * 0.55); ctx.lineTo(c * S + S * 0.46, r * S + S * 0.68);
                  ctx.stroke();
                } else if (cell.variant === 5) { // Wooden logs stack
                  ctx.fillStyle = '#7e5835'; // log bodies
                  ctx.beginPath();
                  ctx.roundRect(c * S + S * 0.40, r * S + S * 0.52, S * 0.18, S * 0.08, 2);
                  ctx.roundRect(c * S + S * 0.46, r * S + S * 0.44, S * 0.18, S * 0.08, 2);
                  ctx.roundRect(c * S + S * 0.38, r * S + S * 0.44, S * 0.18, S * 0.08, 2);
                  ctx.fill();
                  // Log rings ends
                  ctx.fillStyle = '#d7ccc8';
                  ctx.beginPath();
                  ctx.arc(c * S + S * 0.40, r * S + S * 0.56, 3, 0, Math.PI*2);
                  ctx.arc(c * S + S * 0.46, r * S + S * 0.48, 3, 0, Math.PI*2);
                  ctx.arc(c * S + S * 0.38, r * S + S * 0.48, 3, 0, Math.PI*2);
                  ctx.fill();
                }
              } else if (cell.type === 'forest') {
                if (cell.variant < 4) {
                  // Spire Pine Trees
                  ctx.fillStyle = '#1e3019'; // border shadow
                  ctx.beginPath();
                  ctx.moveTo(c * S + S * 0.5, r * S + S * 0.15);
                  ctx.lineTo(c * S + S * 0.23, r * S + S * 0.8);
                  ctx.lineTo(c * S + S * 0.77, r * S + S * 0.8);
                  ctx.closePath();
                  ctx.fill();
                  
                  ctx.fillStyle = '#32542a'; // inner green
                  ctx.beginPath();
                  ctx.moveTo(c * S + S * 0.5, r * S + S * 0.22);
                  ctx.lineTo(c * S + S * 0.28, r * S + S * 0.75);
                  ctx.lineTo(c * S + S * 0.72, r * S + S * 0.75);
                  ctx.closePath();
                  ctx.fill();
                  
                  // Secondary high spire
                  ctx.fillStyle = '#3e6635';
                  ctx.beginPath();
                  ctx.moveTo(c * S + S * 0.4, r * S + S * 0.3);
                  ctx.lineTo(c * S + S * 0.2, r * S + S * 0.76);
                  ctx.lineTo(c * S + S * 0.6, r * S + S * 0.76);
                  ctx.closePath();
                  ctx.fill();
                  
                  // Small brown tree trunk
                  ctx.fillStyle = '#4c321d';
                  ctx.fillRect(c * S + S * 0.46, r * S + S * 0.75, 8, S * 0.15);
                } else if (cell.variant === 4 || cell.variant === 5) {
                  // Deciduous dense leafy oak mounds (circles)
                  ctx.fillStyle = '#1a3315';
                  ctx.beginPath();
                  ctx.arc(c * S + S * 0.4, r * S + S * 0.5, S * 0.18, 0, Math.PI * 2);
                  ctx.arc(c * S + S * 0.6, r * S + S * 0.55, S * 0.16, 0, Math.PI * 2);
                  ctx.arc(c * S + S * 0.5, r * S + S * 0.38, S * 0.17, 0, Math.PI * 2);
                  ctx.fill();
                  
                  ctx.fillStyle = '#2f5927';
                  ctx.beginPath();
                  ctx.arc(c * S + S * 0.42, r * S + S * 0.48, S * 0.14, 0, Math.PI * 2);
                  ctx.arc(c * S + S * 0.58, r * S + S * 0.52, S * 0.12, 0, Math.PI * 2);
                  ctx.arc(c * S + S * 0.49, r * S + S * 0.37, S * 0.13, 0, Math.PI * 2);
                  ctx.fill();
                } else if (cell.variant === 6) { // Mossy forest rocks
                  ctx.fillStyle = '#555555'; // Dark granite rock
                  ctx.beginPath();
                  ctx.arc(c * S + S * 0.45, r * S + S * 0.55, S * 0.16, 0, Math.PI*2);
                  ctx.arc(c * S + S * 0.62, r * S + S * 0.62, S * 0.11, 0, Math.PI*2);
                  ctx.fill();
                  // Mossy light green velvet caps
                  ctx.fillStyle = '#27ae60';
                  ctx.beginPath();
                  ctx.arc(c * S + S * 0.44, r * S + S * 0.49, S * 0.11, Math.PI, 0);
                  ctx.arc(c * S + S * 0.61, r * S + S * 0.58, S * 0.08, Math.PI, 0);
                  ctx.fill();
                } else { // Ancient tree stump with sprouts
                  ctx.fillStyle = '#5d4037'; // stump brown
                  ctx.beginPath();
                  ctx.ellipse(c * S + S * 0.5, r * S + S * 0.55, S * 0.14, S * 0.08, 0, 0, Math.PI*2);
                  ctx.fill();
                  // Growth rings
                  ctx.fillStyle = '#8d6e63';
                  ctx.beginPath();
                  ctx.ellipse(c * S + S * 0.5, r * S + S * 0.55, S * 0.10, S * 0.05, 0, 0, Math.PI*2);
                  ctx.fill();
                  // Little green vine sprout
                  ctx.strokeStyle = '#2ecc71';
                  ctx.lineWidth = 2;
                  ctx.beginPath();
                  ctx.moveTo(c * S + S * 0.56, r * S + S * 0.55);
                  ctx.quadraticCurveTo(c * S + S * 0.68, r * S + S * 0.44, c * S + S * 0.72, r * S + S * 0.38);
                  ctx.stroke();
                }
              } else if (cell.type === 'autumn') {
                const treeColor = (cell.variant % 3 === 0) ? '#cc3333' : (cell.variant % 3 === 1) ? '#ff9f43' : '#e2b314';
                const leafShadow = (cell.variant % 3 === 0) ? '#911a1a' : (cell.variant % 3 === 1) ? '#be6c12' : '#ab820b';
                
                // Outer foliage base
                ctx.fillStyle = leafShadow;
                ctx.beginPath();
                ctx.arc(c * S + S * 0.4, r * S + S * 0.45, S * 0.18, 0, Math.PI * 2);
                ctx.arc(c * S + S * 0.6, r * S + S * 0.52, S * 0.16, 0, Math.PI * 2);
                ctx.arc(c * S + S * 0.5, r * S + S * 0.35, S * 0.17, 0, Math.PI * 2);
                ctx.fill();
                
                // Bright high canopy layers
                ctx.fillStyle = treeColor;
                ctx.beginPath();
                ctx.arc(c * S + S * 0.42, r * S + S * 0.43, S * 0.14, 0, Math.PI * 2);
                ctx.arc(c * S + S * 0.58, r * S + S * 0.50, S * 0.12, 0, Math.PI * 2);
                ctx.arc(c * S + S * 0.49, r * S + S * 0.34, S * 0.13, 0, Math.PI * 2);
                ctx.fill();
                
                // Fallen autumn orange leave flakes
                ctx.fillStyle = '#d35400';
                ctx.fillRect(c * S + S * 0.15, r * S + S * 0.75, 4, 3);
                ctx.fillStyle = '#f39c12';
                ctx.fillRect(c * S + S * 0.8, r * S + S * 0.2, 3, 3);

                if (cell.variant === 4) { // Forest pathway with stepping stones
                  ctx.fillStyle = '#a1a5a8'; // flat stone color
                  ctx.beginPath();
                  ctx.ellipse(c * S + S * 0.3, r * S + S * 0.68, S*0.07, S*0.04, Math.PI/6, 0, Math.PI*2);
                  ctx.ellipse(c * S + S * 0.46, r * S + S * 0.75, S*0.08, S*0.05, -Math.PI/12, 0, Math.PI*2);
                  ctx.ellipse(c * S + S * 0.64, r * S + S * 0.72, S*0.06, S*0.04, Math.PI/4, 0, Math.PI*2);
                  ctx.fill();
                } else if (cell.variant === 5) { // Festive pumpkins
                  ctx.fillStyle = '#e67e22'; // bright pumpkin orange
                  ctx.beginPath();
                  ctx.arc(c * S + S * 0.28, r * S + S * 0.72, 5.5, 0, Math.PI*2);
                  ctx.arc(c * S + S * 0.35, r * S + S * 0.76, 4.5, 0, Math.PI*2);
                  ctx.fill();
                  // tiny brown stems
                  ctx.fillStyle = '#8e44ad'; // dark contrast stem
                  ctx.fillRect(c * S + S * 0.27, r * S + S * 0.64, 2, 3);
                  ctx.fillRect(c * S + S * 0.34, r * S + S * 0.70, 1.5, 2.5);
                }
              } else if (cell.type === 'snow') {
                if (cell.variant < 3) {
                  // Snow-covered rocks / mountain peaks
                  ctx.fillStyle = '#656d78'; // rock faces
                  ctx.beginPath();
                  ctx.moveTo(c * S + S * 0.5, r * S + S * 0.18);
                  ctx.lineTo(c * S + S * 0.15, r * S + S * 0.82);
                  ctx.lineTo(c * S + S * 0.85, r * S + S * 0.82);
                  ctx.closePath();
                  ctx.fill();
                  
                  // Snow caps
                  ctx.fillStyle = '#ffffff';
                  ctx.beginPath();
                  ctx.moveTo(c * S + S * 0.5, r * S + S * 0.18);
                  ctx.lineTo(c * S + S * 0.38, r * S + S * 0.42);
                  ctx.lineTo(c * S + S * 0.62, r * S + S * 0.42);
                  ctx.closePath();
                  ctx.fill();
                  
                  // Shade side
                  ctx.fillStyle = 'rgba(0,0,0,0.1)';
                  ctx.beginPath();
                  ctx.moveTo(c * S + S * 0.5, r * S + S * 0.18);
                  ctx.lineTo(c * S + S * 0.5, r * S + S * 0.82);
                  ctx.lineTo(c * S + S * 0.85, r * S + S * 0.82);
                  ctx.closePath();
                  ctx.fill();
                } else if (cell.variant === 3 || cell.variant === 4) {
                  // Snowy pine trees
                  ctx.fillStyle = '#2b5c5e'; // frosty turquoise
                  ctx.beginPath();
                  ctx.moveTo(c * S + S * 0.5, r * S + S * 0.25);
                  ctx.lineTo(c * S + S * 0.25, r * S + S * 0.78);
                  ctx.lineTo(c * S + S * 0.75, r * S + S * 0.78);
                  ctx.closePath();
                  ctx.fill();
                  
                  // White snow tips
                  ctx.fillStyle = '#ffffff';
                  ctx.beginPath();
                  ctx.moveTo(c * S + S * 0.5, r * S + S * 0.25);
                  ctx.lineTo(c * S + S * 0.4, r * S + S * 0.43);
                  ctx.lineTo(c * S + S * 0.6, r * S + S * 0.43);
                  ctx.closePath();
                  ctx.fill();
                  
                  ctx.beginPath();
                  ctx.moveTo(c * S + S * 0.45, r * S + S * 0.48);
                  ctx.lineTo(c * S + S * 0.32, r * S + S * 0.68);
                  ctx.lineTo(c * S + S * 0.68, r * S + S * 0.68);
                  ctx.closePath();
                  ctx.fill();
                } else if (cell.variant === 5) { // Eskimo Igloo snow huts
                  ctx.fillStyle = '#ffffff'; // Snowy dome
                  ctx.lineWidth = 1;
                  ctx.strokeStyle = '#cddbe0';
                  ctx.beginPath();
                  ctx.arc(c * S + S * 0.5, r * S + S * 0.54, S * 0.20, Math.PI, 0);
                  ctx.closePath();
                  ctx.fill();
                  ctx.stroke();
                  // Igloo entrance tunnel
                  ctx.beginPath();
                  ctx.roundRect(c * S + S * 0.44, r * S + S * 0.54, S * 0.12, S * 0.12, 1);
                  ctx.fill();
                  ctx.stroke();
                  // Draw frozen block lines on igloo dome
                  ctx.beginPath();
                  ctx.arc(c * S + S * 0.5, r * S + S * 0.54, S * 0.12, Math.PI, 0);
                  ctx.stroke();
                  ctx.beginPath();
                  ctx.moveTo(c * S + S * 0.5, r * S + S * 0.34); ctx.lineTo(c * S + S * 0.5, r * S + S * 0.54);
                  ctx.stroke();
                } else { // Hex sparkling snowflakes
                  ctx.fillStyle = '#ffffff';
                  const px = c * S + S * 0.5;
                  const py = r * S + S * 0.5;
                  ctx.font = 'bold 12px monospace';
                  ctx.textAlign = 'center';
                  ctx.textBaseline = 'middle';
                  ctx.fillText('☼', px, py); // cute ice crystal star shape
                }
              } else if (cell.type === 'lava') {
                const heatGlow = 45 + Math.sin(hueRef.current / 12) * 15;
                ctx.strokeStyle = `hsla(${12 + Math.sin(hueRef.current / 15) * 5}, 100%, ${heatGlow}%, 1)`;
                ctx.lineWidth = S * 0.08;
                ctx.beginPath();
                if (cell.variant < 3) {
                  ctx.moveTo(c * S, r * S + S * 0.5);
                  ctx.lineTo(c * S + S * 0.4, r * S + S * 0.35);
                  ctx.lineTo(c * S + S * 0.7, r * S + S * 0.65);
                  ctx.lineTo(c * S + S, r * S + S * 0.5);
                  ctx.stroke();
                } else if (cell.variant === 3 || cell.variant === 4) {
                  ctx.moveTo(c * S + S * 0.5, r * S);
                  ctx.lineTo(c * S + S * 0.35, r * S + S * 0.35);
                  ctx.lineTo(c * S + S * 0.65, r * S + S * 0.65);
                  ctx.lineTo(c * S + S * 0.5, r * S + S);
                  ctx.stroke();
                } else {
                  ctx.stroke();
                  ctx.fillStyle = `hsla(18, 100%, ${heatGlow - 5}%, 1)`;
                  ctx.beginPath();
                  ctx.arc(c * S + S * 0.5, r * S + S * 0.5, S * 0.20, 0, Math.PI * 2);
                  ctx.fill();
                  ctx.strokeStyle = '#fee401';
                  ctx.lineWidth = 1.5;
                  ctx.beginPath();
                  ctx.arc(c * S + S * 0.5, r * S + S * 0.5, S * 0.12, 0, Math.PI * 2);
                  ctx.stroke();
                }
                
                if (cell.variant === 1 && Math.random() < 0.20) {
                  ctx.fillStyle = '#ff8c00';
                  ctx.fillRect(c * S + S * 0.3, r * S + S * 0.2, 2.5, 2.5);
                } else if (cell.variant === 5) { // Basalt smoking soot vents
                  ctx.fillStyle = '#141414'; // Volcano vent cone
                  ctx.beginPath();
                  ctx.ellipse(c * S + S * 0.5, r * S + S * 0.5, S * 0.16, S * 0.09, 0, 0, Math.PI*2);
                  ctx.fill();
                  
                  ctx.fillStyle = '#f39c12'; // Lava within cone
                  ctx.beginPath();
                  ctx.ellipse(c * S + S * 0.5, r * S + S * 0.5, S * 0.10, S * 0.05, 0, 0, Math.PI*2);
                  ctx.fill();
                  
                  // Gentle transparent smoke puffs that curl
                  ctx.fillStyle = 'rgba(100, 100, 100, 0.25)';
                  ctx.beginPath();
                  const offset = (hueRef.current / 4) % 12;
                  ctx.arc(c * S + S * 0.5 - offset*0.5, r * S + S * 0.44 - offset, 6 + offset*0.3, 0, Math.PI*2);
                  ctx.arc(c * S + S * 0.52 + offset*0.4, r * S + S * 0.36 - offset*1.4, 4 + offset*0.2, 0, Math.PI*2);
                  ctx.fill();
                } else if (cell.variant === 6) { // Yellow sulfur crystal crystals
                  ctx.fillStyle = '#f1c40f'; // Sulfur crystals gem
                  ctx.strokeStyle = '#d35400';
                  ctx.lineWidth = 0.5;
                  ctx.beginPath();
                  ctx.moveTo(c * S + S * 0.34, r * S + S * 0.62);
                  ctx.lineTo(c * S + S * 0.31, r * S + S * 0.48);
                  ctx.lineTo(c * S + S * 0.41, r * S + S * 0.51);
                  ctx.closePath();
                  ctx.fill();
                  ctx.stroke();
                  
                  ctx.beginPath();
                  ctx.moveTo(c * S + S * 0.45, r * S + S * 0.58);
                  ctx.lineTo(c * S + S * 0.52, r * S + S * 0.42);
                  ctx.lineTo(c * S + S * 0.58, r * S + S * 0.55);
                  ctx.closePath();
                  ctx.fill();
                  ctx.stroke();
                }
              } else if (cell.type === 'water') {
                // Wave shimmer lines
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
                ctx.lineWidth = 1.5;
                ctx.beginPath();
                const drift = (hueRef.current / 3) % (S * 0.6);
                ctx.moveTo(c * S + S * 0.1 + drift, r * S + S * 0.3);
                ctx.lineTo(c * S + S * 0.35 + drift, r * S + S * 0.3);
                
                ctx.moveTo(c * S + S * 0.5 - drift, r * S + S * 0.7);
                ctx.lineTo(c * S + S * 0.75 - drift, r * S + S * 0.7);
                ctx.stroke();
                
                if (cell.variant === 1) {
                  ctx.strokeStyle = 'rgba(255, 255, 254, 0.16)';
                  ctx.beginPath();
                  ctx.arc(c * S + S * 0.45, r * S + S * 0.45, S * 0.14, Math.PI * 0.8, Math.PI * 1.3);
                  ctx.stroke();
                } else if (cell.variant === 2) { // Water lilypads with mini blossom
                  ctx.fillStyle = '#27ae60'; // lily pad shape
                  ctx.beginPath();
                  ctx.arc(c * S + S * 0.35, r * S + S * 0.42, S * 0.08, 0, Math.PI*1.7);
                  ctx.lineTo(c * S + S * 0.35, r * S + S * 0.42);
                  ctx.closePath();
                  ctx.fill();
                  
                  ctx.beginPath();
                  ctx.arc(c * S + S * 0.55, r * S + S * 0.48, S * 0.06, Math.PI*0.3, Math.PI*2);
                  ctx.lineTo(c * S + S * 0.55, r * S + S * 0.48);
                  ctx.closePath();
                  ctx.fill();
                  
                  // Pink Lotus blossom
                  ctx.fillStyle = '#e08283';
                  ctx.beginPath();
                  ctx.arc(c * S + S * 0.37, r * S + S * 0.40, S*0.03, 0, Math.PI*2);
                  ctx.fill();
                  ctx.fillStyle = '#ffffff';
                  ctx.beginPath();
                  ctx.arc(c * S + S * 0.37, r * S + S * 0.40, S*0.012, 0, Math.PI*2);
                  ctx.fill();
                } else if (cell.variant === 3) { // Fishing deck/quay wooden pier
                  ctx.fillStyle = '#8e5828'; // Support poles
                  ctx.fillRect(c * S + S * 0.18, r * S, 4, S * 0.54);
                  ctx.fillRect(c * S + S * 0.58, r * S, 4, S * 0.54);
                  
                  // Deck planks
                  ctx.fillStyle = '#b8814c';
                  ctx.fillRect(c * S + S * 0.12, r * S, S * 0.52, S * 0.48);
                  ctx.strokeStyle = '#543b22';
                  ctx.lineWidth = 1;
                  ctx.strokeRect(c * S + S * 0.12, r * S, S * 0.52, S * 0.48);
                  // Plank joints
                  ctx.beginPath();
                  ctx.moveTo(c * S + S * 0.12, r * S + S * 0.16); ctx.lineTo(c * S + S * 0.64, r * S + S * 0.16);
                  ctx.moveTo(c * S + S * 0.12, r * S + S * 0.32); ctx.lineTo(c * S + S * 0.64, r * S + S * 0.32);
                  ctx.stroke();
                }
              } else if (cell.type === 'dirt') {
                ctx.fillStyle = '#543d29';
                ctx.fillRect(c * S + S * 0.2, r * S + S * 0.3, S * 0.22, S * 0.14);
                ctx.fillRect(c * S + S * 0.55, r * S + S * 0.6, S * 0.25, S * 0.16);
                
                if (cell.variant < 3) {
                  ctx.fillStyle = '#4f3925';
                  ctx.fillRect(c * S + S * 0.3, r * S + S * 0.4, 4, 3);
                  ctx.fillRect(c * S + S * 0.7, r * S + S * 0.55, 3, 3);
                } else if (cell.variant === 3 || cell.variant === 4) {
                  ctx.fillStyle = '#545759';
                  ctx.beginPath();
                  ctx.roundRect(c * S + S * 0.33, r * S + S * 0.33, S * 0.34, S * 0.34, 4);
                  ctx.fill();
                  
                  ctx.fillStyle = '#fbe302';
                  ctx.fillRect(c * S + S * 0.4, r * S + S * 0.42, 5, 3.5);
                  ctx.fillRect(c * S + S * 0.52, r * S + S * 0.48, 4.5, 4.5);
                  
                  ctx.strokeStyle = '#2d2d2d';
                  ctx.strokeRect(c * S + S * 0.33, r * S + S * 0.33, S * 0.34, S * 0.34);
                } else if (cell.variant === 5) { // Blue rain puddles
                  ctx.fillStyle = '#2980b9'; // muddy blue water puddle
                  ctx.strokeStyle = '#543d29';
                  ctx.lineWidth = 1;
                  ctx.beginPath();
                  ctx.ellipse(c * S + S * 0.46, r * S + S * 0.50, S * 0.24, S * 0.14, Math.PI / 12, 0, Math.PI * 2);
                  ctx.fill();
                  ctx.stroke();
                  // ripples
                  ctx.strokeStyle = 'rgba(255,255,255,0.3)';
                  ctx.beginPath();
                  ctx.ellipse(c * S + S * 0.43, r * S + S * 0.49, S * 0.12, S * 0.07, Math.PI / 12, 0, Math.PI * 2);
                  ctx.stroke();
                } else { // Hand-cratered wooden cargo box pallet
                  ctx.fillStyle = '#a0522d'; // wood box frame
                  ctx.fillRect(c * S + S * 0.3, r * S + S * 0.4, S * 0.26, S * 0.26);
                  ctx.strokeStyle = '#4e2402';
                  ctx.lineWidth = 1.5;
                  ctx.strokeRect(c * S + S * 0.3, r * S + S * 0.4, S * 0.26, S * 0.26);
                  // Draw crate cross straps
                  ctx.beginPath();
                  ctx.moveTo(c * S + S * 0.3, r * S + S * 0.4); ctx.lineTo(c * S + S * 0.56, r * S + S * 0.66);
                  ctx.moveTo(c * S + S * 0.3, r * S + S * 0.66); ctx.lineTo(c * S + S * 0.56, r * S + S * 0.4);
                  ctx.stroke();
                }
              } else if (cell.type === 'sand') {
                ctx.strokeStyle = 'rgba(150,110,65,0.18)';
                ctx.lineWidth = 1.5;
                ctx.beginPath();
                ctx.arc(c * S + S * 0.5, r * S + S * 0.5, S * 0.32, Math.PI * 0.8, Math.PI * 1.2);
                ctx.stroke();
                
                if (cell.variant === 2 || cell.variant === 3) {
                  // Saguaro cactus
                  ctx.fillStyle = '#215c26';
                  ctx.fillRect(c * S + S * 0.47, r * S + S * 0.28, S * 0.08, S * 0.48);
                  ctx.fillRect(c * S + S * 0.34, r * S + S * 0.44, S * 0.15, S * 0.06);
                  ctx.fillRect(c * S + S * 0.34, r * S + S * 0.32, S * 0.06, S * 0.12);
                  ctx.fillRect(c * S + S * 0.52, r * S + S * 0.48, S * 0.15, S * 0.06);
                  ctx.fillRect(c * S + S * 0.61, r * S + S * 0.36, S * 0.06, S * 0.12);
                } else if (cell.variant === 4) { // Bleached skull skeleton artifacts
                  ctx.fillStyle = '#f5f5f0';
                  ctx.strokeStyle = '#9c8e70';
                  ctx.lineWidth = 0.5;
                  ctx.beginPath();
                  ctx.roundRect(c * S + S * 0.4, r * S + S * 0.45, S * 0.20, S * 0.14, 4);
                  ctx.fill();
                  ctx.stroke();
                  // horns
                  ctx.strokeStyle = '#ddd';
                  ctx.lineWidth = 2.5;
                  ctx.beginPath();
                  ctx.moveTo(c * S + S * 0.40, r * S + S * 0.47);
                  ctx.quadraticCurveTo(c * S + S * 0.24, r * S + S * 0.36, c * S + S * 0.28, r * S + S * 0.52);
                  ctx.moveTo(c * S + S * 0.60, r * S + S * 0.47);
                  ctx.quadraticCurveTo(c * S + S * 0.76, r * S + S * 0.36, c * S + S * 0.72, r * S + S * 0.52);
                  ctx.stroke();
                } else if (cell.variant === 5) { // Oasis pool setup
                  ctx.fillStyle = '#00cccc';
                  ctx.beginPath();
                  ctx.arc(c * S + S * 0.5, r * S + S * 0.56, S * 0.22, 0, Math.PI*2);
                  ctx.fill();
                  ctx.strokeStyle = '#27ae60';
                  ctx.lineWidth = 2;
                  ctx.beginPath();
                  ctx.moveTo(c * S + S * 0.28, r * S + S*0.56); ctx.lineTo(c * S + S * 0.24, r * S + S * 0.46);
                  ctx.moveTo(c * S + S * 0.72, r * S + S*0.56); ctx.lineTo(c * S + S * 0.76, r * S + S * 0.48);
                  ctx.stroke();
                }
              } else if (cell.type === 'stone') {
                ctx.strokeStyle = 'rgba(0,0,0,0.12)';
                ctx.lineWidth = 1;
                ctx.strokeRect(c * S, r * S, S, S);
                ctx.beginPath();
                ctx.moveTo(c * S + S * 0.5, r * S); ctx.lineTo(c * S + S * 0.5, r * S + S);
                ctx.moveTo(c * S, r * S + S * 0.5); ctx.lineTo(c * S + S, r * S + S * 0.5);
                ctx.stroke();
                
                if (cell.variant === 2) {
                  ctx.fillStyle = 'rgba(67,110,50,0.35)';
                  ctx.fillRect(c * S + S * 0.1, r * S + S * 0.1, S * 0.35, S * 0.3);
                  ctx.fillRect(c * S + S * 0.6, r * S + S * 0.55, S * 0.3, S * 0.35);
                } else if (cell.variant === 3) {
                  ctx.fillStyle = '#414243';
                  ctx.fillRect(c * S + S * 0.36, r * S + S * 0.3, S * 0.28, S * 0.5);
                  ctx.fillStyle = '#838689';
                  ctx.fillRect(c * S + S * 0.38, r * S + S * 0.32, S * 0.24, S * 0.46);
                  ctx.fillStyle = '#313233';
                  ctx.fillRect(c * S + S * 0.34, r * S + S * 0.34, S * 0.32, S * 0.07);
                  ctx.fillRect(c * S + S * 0.34, r * S + S * 0.68, S * 0.32, S * 0.07);
                } else if (cell.variant === 4) {
                  ctx.shadowColor = '#00e5ff';
                  ctx.shadowBlur = 4;
                  ctx.strokeStyle = '#00e5ff';
                  ctx.lineWidth = 1.5;
                  ctx.beginPath();
                  ctx.moveTo(c * S + S * 0.3, r * S + S * 0.4);
                  ctx.lineTo(c * S + S * 0.4, r * S + S * 0.3);
                  ctx.lineTo(c * S + S * 0.4, r * S + S * 0.5);
                  ctx.moveTo(c * S + S * 0.3, r * S + S * 0.48);
                  ctx.lineTo(c * S + S * 0.5, r * S + S * 0.48);
                  ctx.stroke();
                  ctx.beginPath();
                  ctx.arc(c * S + S * 0.68, r * S + S * 0.60, 4, 0, Math.PI*2);
                  ctx.stroke();
                  ctx.shadowBlur = 0;
                } else if (cell.variant === 5) {
                  ctx.strokeStyle = '#7f8c8d';
                  ctx.lineWidth = 2;
                  ctx.beginPath();
                  ctx.ellipse(c * S + S * 0.45, r * S + S * 0.45, 6, 3, Math.PI / 4, 0, Math.PI * 2);
                  ctx.ellipse(c * S + S * 0.52, r * S + S * 0.49, 6, 3, -Math.PI / 5, 0, Math.PI * 2);
                  ctx.stroke();
                }
              }
              ctx.restore();
            }
          }
        }
        
        // 2. Replenish / Keep exactly 2 to 5 trains running (Default minimum of 3)
        while (trainsRef.current.trains.length < trainQuality.minActiveTrains) {
            const tx = Math.floor(Math.random() * (cols - 6)) + 3;
            const ty = Math.floor(Math.random() * (rows - 6)) + 3;
            const startExitDir = Math.floor(Math.random() * 4);
            
            const newTrain: Train = createTrainFromTrackStart(tx, ty, startExitDir);
            
            const startKey = `${tx},${ty}`;
            trainsRef.current.grid[startKey] = {
                conns: {
                    [(startExitDir + 2) % 4]: startExitDir,
                    [startExitDir]: (startExitDir + 2) % 4
                }
            };
            
            for (let sIdx = 0; sIdx < trainQuality.trackSeedSegments; sIdx++) {
                extendTrack(newTrain, trainsRef.current.grid, cols, rows, undefined, straightnessRef.current);
            }
            
            trainsRef.current.trains.push(newTrain);
        }
        
        // 3. Spuff steam engine particles (soft smoke shapes)
        if (
            trainsRef.current.steam.length < trainQuality.steamCap &&
            Math.random() < trainSpeedRef.current * trainQuality.steamChance
        ) {
            trainsRef.current.trains.forEach(t => {
                if (t.style === 'steam' && !t.dead && t.history.length > 0) {
                    const headPos = t.history[0];
                    const stackX = headPos.x + Math.cos(headPos.heading) * S * 0.22;
                    const stackY = headPos.y + Math.sin(headPos.heading) * S * 0.22;
                    if (trainsRef.current.steam.length >= trainQuality.steamCap) return;
                    trainsRef.current.steam.push({
                        x: stackX,
                        y: stackY,
                        r: S * 0.04,
                        alpha: 0.6,
                        vx: -Math.cos(headPos.heading) * trainSpeedRef.current * 0.3 + (Math.random() - 0.5) * 0.3,
                        vy: -Math.sin(headPos.heading) * trainSpeedRef.current * 0.3 + (Math.random() - 0.5) * 0.3
                    });
                }
            });
        }
        
        // Update particles
        trainsRef.current.steam.forEach(p => {
            p.x += p.vx;
            p.y += p.vy;
            p.r += trainSpeedRef.current * 0.07;
            p.alpha -= trainSpeedRef.current * 0.012;
        });
        trainsRef.current.steam = trainsRef.current.steam.filter(p => p.alpha > 0);
        
        // Draw puff particles
        ctx.save();
        trainsRef.current.steam.forEach(p => {
            ctx.fillStyle = `rgba(242, 242, 242, ${p.alpha * 0.8})`;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
            ctx.fill();
        });
        ctx.restore();
        
        // 4. Update core movement of each train
        trainsRef.current.trains.forEach(t => {
            if (t.dead) return;
            const len = Math.abs(t.fromDir - t.toDir) === 2 ? S : Math.PI * S / 4;
            const speed_px = trainSpeedRef.current * 1.5;
            
            // Check if train is approaching segment exit and needs the next tile
            if (t.progress + (speed_px / len) >= 1) {
                // Check if next tile exists in grid
                const nextTx = t.tx + (t.toDir === 1 ? 1 : t.toDir === 3 ? -1 : 0);
                const nextTy = t.ty + (t.toDir === 2 ? 1 : t.toDir === 0 ? -1 : 0);
                const nextKey = `${nextTx},${nextTy}`;
                const nextTile = trainsRef.current.grid[nextKey];
                
                if (nextTile) {
                    t.progress += speed_px / len;
                } else {
                    // Next tile is not ready yet! Pause right before the junction to look gorgeous
                    t.progress = 0.99;
                }
            } else {
                t.progress += speed_px / len;
            }
            
            while (t.progress >= 1 && !t.dead) {
                t.progress -= 1;
                const exitDir = t.toDir;
                t.tx += exitDir === 1 ? 1 : exitDir === 3 ? -1 : 0;
                t.ty += exitDir === 2 ? 1 : exitDir === 0 ? -1 : 0;
                t.fromDir = (exitDir + 2) % 4;
                
                // Spawn a new track dynamically ahead of the train! (queued placement path and weights)
                extendTrack(t, trainsRef.current.grid, cols, rows, trainsRef.current.queuedTiles, straightnessRef.current);
                
                const tile = trainsRef.current.grid[`${t.tx},${t.ty}`];
                if (tile && tile.conns[t.fromDir] !== undefined) {
                    t.toDir = tile.conns[t.fromDir];
                } else {
                    t.dead = true;
                }
            }
            
            if (!t.dead) {
                const historyStep = trainQuality.historyStep;
                const hPos = getPosAndHeading(t.tx, t.ty, t.fromDir, t.toDir, t.progress, S);
                const last = t.history[0];
                if (!last) t.history.unshift(hPos);
                else {
                    const d = Math.hypot(hPos.x - last.x, hPos.y - last.y);
                    let distRemaining = d;
                    let currX = last.x, currY = last.y, currH = last.heading;
                    while (distRemaining >= historyStep) {
                        const ratio = Math.min(1, historyStep / distRemaining);
                        currX += (hPos.x - currX) * ratio;
                        currY += (hPos.y - currY) * ratio;
                        
                        let angleDiff = hPos.heading - currH;
                        while (angleDiff > Math.PI) angleDiff -= Math.PI*2;
                        while (angleDiff < -Math.PI) angleDiff += Math.PI*2;
                        currH += angleDiff * ratio;
                        
                        t.history.unshift({x: currX, y: currY, heading: currH});
                        distRemaining -= historyStep;
                    }
                    t.history.unshift(hPos);
                }
                const carSpacingIdx = Math.max(1, Math.floor((S * 0.72) / historyStep));
                const maxLen = t.carsCount * carSpacingIdx + trainQuality.historyTailBuffer;
                if (t.history.length > maxLen) t.history.length = maxLen;
            }
        });
        
        trainsRef.current.trains = trainsRef.current.trains.filter(t => !t.dead || t.history.length > 0);
        trainsRef.current.trains.forEach(t => {
            if (t.dead) {
                t.history.splice(0, Math.ceil((trainSpeedRef.current * 1.5) / trainQuality.historyStep));
            }
        });
 
        // 5. Draw highly detailed track structures
        ctx.lineCap = 'butt';
        const drawn = new Set();
        Object.entries(trainsRef.current.grid).forEach(([key, val]) => {
            const tile = val as { conns: Record<number, number> };
            const [txStr, tyStr] = key.split(',');
            const tx = parseInt(txStr), ty = parseInt(tyStr);
            
            // Build a detailed wooden trestle bridge deck/piers underneath if track spans over water or lava!
            const cell = trainsRef.current.terrain[key];
            if (cell && (cell.type === 'water' || cell.type === 'lava')) {
                ctx.save();
                // Set wooden deck colors (weathered timber for water, basalt masonry framing for lava)
                ctx.fillStyle = cell.type === 'lava' ? '#3d251d' : '#5a3d28';
                ctx.fillRect(tx * S + S * 0.08, ty * S + S * 0.08, S * 0.84, S * 0.84);
                
                // Outer wooden heavy framing rails
                ctx.strokeStyle = cell.type === 'lava' ? '#291814' : '#3e2616';
                ctx.lineWidth = S * 0.04;
                ctx.strokeRect(tx * S + S * 0.08, ty * S + S * 0.08, S * 0.84, S * 0.84);
                
                // Cross wood plank separations
                ctx.strokeStyle = cell.type === 'lava' ? 'rgba(0,0,0,0.3)' : 'rgba(255,255,255,0.08)';
                ctx.lineWidth = 1.5;
                ctx.beginPath();
                ctx.moveTo(tx * S + S * 0.25, ty * S + S * 0.1); ctx.lineTo(tx * S + S * 0.25, ty * S + S * 0.9);
                ctx.moveTo(tx * S + S * 0.5, ty * S + S * 0.1); ctx.lineTo(tx * S + S * 0.5, ty * S + S * 0.9);
                ctx.moveTo(tx * S + S * 0.75, ty * S + S * 0.1); ctx.lineTo(tx * S + S * 0.75, ty * S + S * 0.9);
                ctx.stroke();
                
                // 4 cornerstone wooden posts/masonry piers supporting the platform
                ctx.fillStyle = cell.type === 'lava' ? '#221512' : '#331e11';
                ctx.fillRect(tx * S + S * 0.04, ty * S + S * 0.04, S * 0.12, S * 0.12);
                ctx.fillRect(tx * S + S * 0.84, ty * S + S * 0.04, S * 0.12, S * 0.12);
                ctx.fillRect(tx * S + S * 0.04, ty * S + S * 0.84, S * 0.12, S * 0.12);
                ctx.fillRect(tx * S + S * 0.84, ty * S + S * 0.84, S * 0.12, S * 0.12);
                ctx.restore();
            }
            
            Object.entries(tile.conns).forEach(([a, b]) => {
                const min = Math.min(+a, +b), max = Math.max(+a, +b);
                const sig = `${tx},${ty}-${min}-${max}`;
                if (!drawn.has(sig)) {
                    drawn.add(sig);
                    
                    const isStraight = Math.abs(min - max) === 2;
                    
                    // Dark thick gravel/ballast pass
                    ctx.beginPath();
                    if (isStraight) {
                        let x1 = tx * S, y1 = ty * S, x2 = tx * S, y2 = ty * S;
                        if (min === 0 || max === 0) { x1 += S/2; x2 += S/2; y2 += S; } 
                        else { y1 += S/2; y2 += S/2; x2 += S; }
                        ctx.moveTo(x1, y1); ctx.lineTo(x2, y2);
                    } else {
                        const c = getCurvePath(min, max);
                        if (c) ctx.arc((tx + c.cx) * S, (ty + c.cy) * S, S/2, c.a1, c.a2, c.sweep < 0);
                    }
                    ctx.strokeStyle = 'rgba(0, 0, 0, 0.45)';
                    ctx.lineWidth = S * 0.35;
                    ctx.setLineDash([]);
                    ctx.stroke();
                    
                    // Detailed timber sleepers pass (regular dashed thick brown line)
                    ctx.beginPath();
                    if (isStraight) {
                        let x1 = tx * S, y1 = ty * S, x2 = tx * S, y2 = ty * S;
                        if (min === 0 || max === 0) { x1 += S/2; x2 += S/2; y2 += S; } 
                        else { y1 += S/2; y2 += S/2; x2 += S; }
                        ctx.moveTo(x1, y1); ctx.lineTo(x2, y2);
                    } else {
                        const c = getCurvePath(min, max);
                        if (c) ctx.arc((tx + c.cx) * S, (ty + c.cy) * S, S/2, c.a1, c.a2, c.sweep < 0);
                    }
                    ctx.strokeStyle = '#5c3a21';
                    ctx.lineWidth = S * 0.28;
                    ctx.setLineDash([S * 0.05, S * 0.12]);
                    ctx.stroke();
                    
                    // Shiny, double chromium-steel rails representation
                    ctx.beginPath();
                    ctx.setLineDash([]);
                    ctx.strokeStyle = '#cccccc';
                    ctx.lineWidth = S * 0.035;
                    const spacing = S * 0.095;
                    if (isStraight) {
                        if (min === 0 || max === 0) {
                            ctx.moveTo(tx*S + S/2 - spacing, ty*S); ctx.lineTo(tx*S + S/2 - spacing, ty*S + S);
                            ctx.moveTo(tx*S + S/2 + spacing, ty*S); ctx.lineTo(tx*S + S/2 + spacing, ty*S + S);
                        } else {
                            ctx.moveTo(tx*S, ty*S + S/2 - spacing); ctx.lineTo(tx*S + S, ty*S + S/2 - spacing);
                            ctx.moveTo(tx*S, ty*S + S/2 + spacing); ctx.lineTo(tx*S + S, ty*S + S/2 + spacing);
                        }
                    } else {
                        const c = getCurvePath(min, max);
                        if (c) {
                            ctx.arc((tx + c.cx) * S, (ty + c.cy) * S, Math.abs(S/2 - spacing), c.a1, c.a2, c.sweep < 0);
                            ctx.stroke(); ctx.beginPath();
                            ctx.arc((tx + c.cx) * S, (ty + c.cy) * S, S/2 + spacing, c.a1, c.a2, c.sweep < 0);
                        }
                    }
                    ctx.stroke();
                }
            });
        });
        
        // 6. Draw all customized cars with specific types and features
        const carSpacingIdx = Math.max(1, Math.floor((S * 0.72) / trainQuality.historyStep));
        
        // Draw heavy metallic couplings/bars between adjacent cars of each train first (drawn underneath)
        ctx.save();
        ctx.strokeStyle = '#2d2d2d';
        ctx.lineWidth = S * 0.045;
        ctx.lineCap = 'round';
        trainsRef.current.trains.forEach(t => {
            if (t.dead && t.history.length === 0) return;
            for (let i = 1; i < t.carsCount; i++) {
                const idxPrev = (i - 1) * carSpacingIdx;
                const idxNext = i * carSpacingIdx;
                if (idxNext < t.history.length) {
                    const posPrev = t.history[idxPrev];
                    const posNext = t.history[idxNext];
                    
                    // Rear of previous car
                    const x1 = posPrev.x - Math.cos(posPrev.heading) * S * 0.38;
                    const y1 = posPrev.y - Math.sin(posPrev.heading) * S * 0.38;
                    // Front of next car
                    const x2 = posNext.x + Math.cos(posNext.heading) * S * 0.38;
                    const y2 = posNext.y + Math.sin(posNext.heading) * S * 0.38;
                    
                    // Draw a gorgeous coupling linkage bar
                    ctx.beginPath();
                    ctx.moveTo(x1, y1);
                    ctx.lineTo(x2, y2);
                    ctx.stroke();
                    
                    // Draw dual chain link/pins
                    ctx.fillStyle = '#1a1a1a';
                    ctx.beginPath();
                    ctx.arc(x1 + (x2 - x1) * 0.35, y1 + (y2 - y1) * 0.35, S * 0.022, 0, Math.PI * 2);
                    ctx.arc(x1 + (x2 - x1) * 0.65, y1 + (y2 - y1) * 0.65, S * 0.022, 0, Math.PI * 2);
                    ctx.fill();
                }
            }
        });
        ctx.restore();

        // Render the actual cars on top of the couplings
        trainsRef.current.trains.forEach(t => {
            for (let i = 0; i < t.carsCount; i++) {
                const idx = i * carSpacingIdx;
                if (idx < t.history.length) {
                    const pos = t.history[idx];
                    const carType = t.carsList[i] || 'passenger';
                    drawCar(ctx, pos.x, pos.y, pos.heading, i === 0 ? '#111' : t.color, carType, t.style, S);
                }
            }
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
