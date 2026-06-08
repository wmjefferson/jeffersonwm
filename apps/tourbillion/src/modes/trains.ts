import type { QueuedTile, TerrainCell, Train, TrainSim } from '../types';

export interface TrainInitResult {
  sim: TrainSim;
  nextResetTime: number;
  lastTilePlacementTime: number;
}

export const getCurvePath = (fromDir: number, toDir: number) => {
  if (fromDir === 0 && toDir === 1) return { cx: 1, cy: 0, a1: Math.PI, a2: Math.PI / 2, sweep: -1 };
  if (fromDir === 1 && toDir === 0) return { cx: 1, cy: 0, a1: Math.PI / 2, a2: Math.PI, sweep: 1 };
  if (fromDir === 1 && toDir === 2) return { cx: 1, cy: 1, a1: 1.5 * Math.PI, a2: Math.PI, sweep: -1 };
  if (fromDir === 2 && toDir === 1) return { cx: 1, cy: 1, a1: Math.PI, a2: 1.5 * Math.PI, sweep: 1 };
  if (fromDir === 2 && toDir === 3) return { cx: 0, cy: 1, a1: 0, a2: -Math.PI / 2, sweep: -1 };
  if (fromDir === 3 && toDir === 2) return { cx: 0, cy: 1, a1: -Math.PI / 2, a2: 0, sweep: 1 };
  if (fromDir === 3 && toDir === 0) return { cx: 0, cy: 0, a1: Math.PI / 2, a2: 0, sweep: -1 };
  if (fromDir === 0 && toDir === 3) return { cx: 0, cy: 0, a1: 0, a2: Math.PI / 2, sweep: 1 };
  return null;
};

export const getPosAndHeading = (
  tx: number,
  ty: number,
  fromDir: number,
  toDir: number,
  p: number,
  S: number,
) => {
  const isStraight = Math.abs(fromDir - toDir) === 2;
  if (isStraight) {
    const sx = fromDir === 1 ? 1 : fromDir === 3 ? 0 : 0.5;
    const sy = fromDir === 2 ? 1 : fromDir === 0 ? 0 : 0.5;
    const ex = toDir === 1 ? 1 : toDir === 3 ? 0 : 0.5;
    const ey = toDir === 2 ? 1 : toDir === 0 ? 0 : 0.5;
    const x = (tx + sx + (ex - sx) * p) * S;
    const y = (ty + sy + (ey - sy) * p) * S;
    const heading = Math.atan2(ey - sy, ex - sx);
    return { x, y, heading };
  }

  const c = getCurvePath(fromDir, toDir);
  if (!c) {
    return { x: 0, y: 0, heading: 0 };
  }

  const angle = c.a1 + (c.a2 - c.a1) * p;
  const x = (tx + c.cx) * S + (S / 2) * Math.cos(angle);
  const y = (ty + c.cy) * S + (S / 2) * Math.sin(angle);
  const heading = angle + (Math.PI / 2) * c.sweep;
  return { x, y, heading };
};

const trainColors = ['#e63946', '#457b9d', '#2a9d8f', '#f4a261', '#9b5de5'];

export const createTrainFromTrackStart = (tx: number, ty: number, startExitDir: number): Train => {
  const style: 'steam' | 'diesel' = Math.random() > 0.5 ? 'steam' : 'diesel';
  const carsList: Train['carsList'] = [];

  if (style === 'steam') {
    carsList.push('engine');
    carsList.push('tender');
    const cargoTypes: Train['carsList'] = ['logs', 'tanker', 'boxcar', 'passenger'];
    const carsCount = Math.floor(Math.random() * 3) + 2;
    for (let index = 0; index < carsCount; index++) {
      carsList.push(cargoTypes[Math.floor(Math.random() * cargoTypes.length)]);
    }
  } else {
    carsList.push('engine');
    const cargoTypes: Train['carsList'] = ['boxcar', 'tanker', 'passenger'];
    const carsCount = Math.floor(Math.random() * 4) + 2;
    for (let index = 0; index < carsCount; index++) {
      carsList.push(cargoTypes[Math.floor(Math.random() * cargoTypes.length)]);
    }
  }

  return {
    tx,
    ty,
    fromDir: (startExitDir + 2) % 4,
    toDir: startExitDir,
    progress: 0,
    history: [],
    dead: false,
    color: trainColors[Math.floor(Math.random() * trainColors.length)],
    carsCount: carsList.length,
    cx: tx,
    cy: ty,
    cExitDir: startExitDir,
    style,
    carsList,
  };
};

export const extendTrack = (
  t: Train,
  grid: Record<string, { conns: Record<number, number> }>,
  cols: number,
  rows: number,
  queuedTiles?: QueuedTile[],
  trackStraightness = 0.5,
) => {
  const nextExit = t.cExitDir;

  t.cx += nextExit === 1 ? 1 : nextExit === 3 ? -1 : 0;
  t.cy += nextExit === 2 ? 1 : nextExit === 0 ? -1 : 0;

  if (t.cx < 1) {
    t.cx = 1;
    t.cExitDir = 1;
  }
  if (t.cx >= cols - 2) {
    t.cx = cols - 3;
    t.cExitDir = 3;
  }
  if (t.cy < 1) {
    t.cy = 1;
    t.cExitDir = 2;
  }
  if (t.cy >= rows - 2) {
    t.cy = rows - 3;
    t.cExitDir = 0;
  }

  const entry = (t.cExitDir + 2) % 4;
  const key = `${t.cx},${t.cy}`;

  const queuedItem = queuedTiles?.find((item) => item.key === key);
  const existingConns: Record<number, number> = {
    ...(grid[key]?.conns || {}),
    ...(queuedItem?.conns || {}),
  };

  if (existingConns[entry] !== undefined) {
    t.cExitDir = existingConns[entry];
    return;
  }

  const candidates = [(entry + 1) % 4, (entry + 2) % 4, (entry + 3) % 4];
  const weights = candidates.map((dir) => {
    const dx = dir === 1 ? 1 : dir === 3 ? -1 : 0;
    const dy = dir === 2 ? 1 : dir === 0 ? -1 : 0;
    const nx = t.cx + dx;
    const ny = t.cy + dy;

    if (nx < 1 || nx >= cols - 2 || ny < 1 || ny >= rows - 2) {
      return 0;
    }

    let w = 20 * (1 - trackStraightness);
    if (dir === (entry + 2) % 4) {
      w = 20 + trackStraightness * 80;
    }

    const nextKey = `${nx},${ny}`;
    const nextQueuedItem = queuedTiles?.find((item) => item.key === nextKey);
    const nextConns = {
      ...(grid[nextKey]?.conns || {}),
      ...(nextQueuedItem?.conns || {}),
    };

    if (grid[nextKey] || nextQueuedItem) {
      const nextEntry = (dir + 2) % 4;
      if (nextConns[nextEntry] !== undefined) {
        w = 120;
      } else {
        w = 3;
      }
    }

    if (existingConns[dir] !== undefined) {
      w = 0;
    }

    return w;
  });

  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
  let chosenDir = candidates[1];

  if (totalWeight > 0) {
    let rand = Math.random() * totalWeight;
    for (let i = 0; i < candidates.length; i++) {
      rand -= weights[i];
      if (rand <= 0) {
        chosenDir = candidates[i];
        break;
      }
    }
  } else {
    for (const dir of candidates) {
      const dx = dir === 1 ? 1 : dir === 3 ? -1 : 0;
      const dy = dir === 2 ? 1 : dir === 0 ? -1 : 0;
      const nx = t.cx + dx;
      const ny = t.cy + dy;
      if (nx >= 1 && nx < cols - 2 && ny >= 1 && ny < rows - 2 && existingConns[dir] === undefined) {
        chosenDir = dir;
        break;
      }
    }
  }

  const conns = { [entry]: chosenDir, [chosenDir]: entry };

  if (queuedTiles) {
    queuedTiles.push({ key, conns });
  } else {
    if (!grid[key]) {
      grid[key] = { conns: {} };
    }
    grid[key].conns[entry] = chosenDir;
    grid[key].conns[chosenDir] = entry;
  }

  t.cExitDir = chosenDir;
};

export const placeTileFromQueue = (sim: TrainSim) => {
  if (!sim.queuedTiles || sim.queuedTiles.length === 0) return false;
  const item = sim.queuedTiles.shift();
  if (!item) {
    return false;
  }

  const { key, conns } = item;
  if (!sim.grid[key]) {
    sim.grid[key] = { conns: {} };
  }

  Object.entries(conns).forEach(([k, v]) => {
    sim.grid[key].conns[parseInt(k)] = v;
  });
  sim.placedTilesCount = (sim.placedTilesCount || 0) + 1;
  return true;
};

export const drawCar = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  heading: number,
  color: string,
  type: 'engine' | 'tender' | 'logs' | 'tanker' | 'boxcar' | 'passenger',
  trainStyle: 'steam' | 'diesel',
  S: number,
) => {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(heading);

  ctx.fillStyle = 'rgba(0, 0, 0, 0.22)';
  ctx.fillRect(-S * 0.42, -S * 0.22 + 4, S * 0.84, S * 0.44);

  ctx.fillStyle = '#111111';
  ctx.fillRect(-S * 0.3, -S * 0.24, S * 0.12, S * 0.48);
  ctx.fillRect(S * 0.18, -S * 0.24, S * 0.12, S * 0.48);

  ctx.fillStyle = '#666666';
  ctx.fillRect(-S * 0.48, -S * 0.04, S * 0.96, S * 0.08);

  if (type === 'engine') {
    if (trainStyle === 'steam') {
      ctx.fillStyle = '#262626';
      ctx.fillRect(-S * 0.18, -S * 0.18, S * 0.53, S * 0.36);

      ctx.fillStyle = '#c5a059';
      ctx.fillRect(-S * 0.08, -S * 0.19, S * 0.03, S * 0.38);
      ctx.fillRect(S * 0.1, -S * 0.19, S * 0.03, S * 0.38);

      ctx.fillStyle = color;
      ctx.fillRect(-S * 0.38, -S * 0.2, S * 0.2, S * 0.4);

      ctx.fillStyle = '#1f1f1f';
      ctx.fillRect(-S * 0.4, -S * 0.22, S * 0.24, S * 0.44);

      ctx.fillStyle = '#ffeeaa';
      ctx.fillRect(-S * 0.3, -S * 0.14, S * 0.08, S * 0.06);
      ctx.fillRect(-S * 0.3, S * 0.08, S * 0.08, S * 0.06);

      ctx.fillStyle = '#cc3333';
      ctx.beginPath();
      ctx.moveTo(S * 0.35, -S * 0.18);
      ctx.lineTo(S * 0.44, -S * 0.1);
      ctx.lineTo(S * 0.44, S * 0.1);
      ctx.lineTo(S * 0.35, S * 0.18);
      ctx.fill();

      ctx.fillStyle = '#111';
      ctx.beginPath();
      ctx.arc(S * 0.22, 0, S * 0.06, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#e6b800';
      ctx.beginPath();
      ctx.arc(S * 0.35, 0, S * 0.05, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = 'rgba(255, 245, 150, 0.14)';
      ctx.beginPath();
      ctx.moveTo(S * 0.35, 0);
      ctx.lineTo(S * 1.6, -S * 0.45);
      ctx.lineTo(S * 1.6, S * 0.45);
      ctx.closePath();
      ctx.fill();
    } else {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.roundRect(-S * 0.38, -S * 0.2, S * 0.76, S * 0.4, S * 0.08);
      ctx.fill();

      ctx.fillStyle = '#111111';
      ctx.fillRect(S * 0.06, -S * 0.15, S * 0.18, S * 0.3);
      ctx.fillStyle = '#666';
      for (let j = 0; j < 3; j++) {
        ctx.fillRect(S * (0.08 + j * 0.05), -S * 0.12, S * 0.015, S * 0.24);
      }

      ctx.fillStyle = '#33ccff';
      ctx.fillRect(-S * 0.2, -S * 0.16, S * 0.08, S * 0.32);

      ctx.fillStyle = '#ffffff';
      ctx.fillRect(-S * 0.38, -S * 0.03, S * 0.76, S * 0.06);

      ctx.fillStyle = '#fffae0';
      ctx.beginPath();
      ctx.arc(S * 0.36, -S * 0.08, S * 0.04, 0, Math.PI * 2);
      ctx.arc(S * 0.36, S * 0.08, S * 0.04, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = 'rgba(255, 255, 210, 0.16)';
      ctx.beginPath();
      ctx.moveTo(S * 0.36, 0);
      ctx.lineTo(S * 1.7, -S * 0.5);
      ctx.lineTo(S * 1.7, S * 0.5);
      ctx.closePath();
      ctx.fill();
    }
  } else if (type === 'tender') {
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(-S * 0.38, -S * 0.19, S * 0.76, S * 0.38);
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 2;
    ctx.strokeRect(-S * 0.38, -S * 0.19, S * 0.76, S * 0.38);

    ctx.fillStyle = '#050505';
    for (let j = -3; j <= 3; j++) {
      for (let k = -1; k <= 1; k++) {
        const cx = j * (S * 0.08) + Math.sin(j) * 2;
        const cy = k * (S * 0.08) + Math.cos(k) * 2;
        ctx.beginPath();
        ctx.arc(cx, cy, S * 0.07, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  } else if (type === 'logs') {
    ctx.fillStyle = '#8c5a36';
    ctx.fillRect(-S * 0.38, -S * 0.18, S * 0.76, S * 0.36);
    ctx.strokeStyle = '#54361f';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(-S * 0.38, -S * 0.18, S * 0.76, S * 0.36);

    ctx.fillStyle = '#6e4424';
    ctx.fillRect(-S * 0.34, -S * 0.12, S * 0.68, S * 0.07);
    ctx.fillStyle = '#7a4e2b';
    ctx.fillRect(-S * 0.34, -S * 0.03, S * 0.68, S * 0.07);
    ctx.fillStyle = '#6e4424';
    ctx.fillRect(-S * 0.34, S * 0.06, S * 0.68, S * 0.07);

    ctx.fillStyle = '#cd9e71';
    ctx.beginPath();
    ctx.arc(S * 0.34, -S * 0.085, S * 0.035, 0, Math.PI * 2);
    ctx.arc(S * 0.34, 0, S * 0.035, 0, Math.PI * 2);
    ctx.arc(S * 0.34, S * 0.095, S * 0.035, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#333';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-S * 0.16, -S * 0.16);
    ctx.lineTo(-S * 0.16, S * 0.16);
    ctx.moveTo(S * 0.16, -S * 0.16);
    ctx.lineTo(S * 0.16, S * 0.16);
    ctx.stroke();
  } else if (type === 'tanker') {
    ctx.fillStyle = '#444';
    ctx.fillRect(-S * 0.38, -S * 0.15, S * 0.76, S * 0.3);

    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.roundRect(-S * 0.34, -S * 0.17, S * 0.68, S * 0.34, S * 0.06);
    ctx.fill();

    ctx.fillStyle = '#222';
    ctx.fillRect(-S * 0.05, -S * 0.04, S * 0.1, S * 0.08);

    ctx.fillStyle = '#ffcc00';
    ctx.fillRect(-S * 0.22, -S * 0.17, S * 0.04, S * 0.34);
    ctx.fillRect(S * 0.18, -S * 0.17, S * 0.04, S * 0.34);
    ctx.fillStyle = '#000000';
    ctx.fillRect(-S * 0.22, -S * 0.04, S * 0.04, S * 0.08);
    ctx.fillRect(S * 0.18, -S * 0.04, S * 0.04, S * 0.08);
  } else if (type === 'boxcar') {
    ctx.fillStyle = color;
    ctx.fillRect(-S * 0.38, -S * 0.18, S * 0.76, S * 0.36);

    ctx.strokeStyle = 'rgba(0,0,0,0.25)';
    ctx.lineWidth = 2;
    ctx.strokeRect(-S * 0.38, -S * 0.18, S * 0.76, S * 0.36);

    ctx.strokeStyle = 'rgba(0,0,0,0.12)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let ofs = -S * 0.3; ofs <= S * 0.3; ofs += S * 0.08) {
      ctx.moveTo(ofs, -S * 0.16);
      ctx.lineTo(ofs, S * 0.16);
    }
    ctx.stroke();

    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.fillRect(-S * 0.12, -S * 0.17, S * 0.24, S * 0.34);
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.strokeRect(-S * 0.12, -S * 0.17, S * 0.24, S * 0.34);
    ctx.beginPath();
    ctx.moveTo(0, -S * 0.17);
    ctx.lineTo(0, S * 0.17);
    ctx.stroke();
  } else {
    ctx.fillStyle = color;
    ctx.fillRect(-S * 0.38, -S * 0.18, S * 0.76, S * 0.36);

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(-S * 0.38, -S * 0.12, S * 0.76, S * 0.04);
    ctx.fillStyle = '#222222';
    ctx.fillRect(-S * 0.38, -S * 0.18, S * 0.76, S * 0.05);
    ctx.fillRect(-S * 0.38, S * 0.13, S * 0.76, S * 0.05);

    ctx.fillStyle = '#fffa80';
    for (let ofs = -S * 0.28; ofs <= S * 0.28; ofs += S * 0.14) {
      ctx.fillRect(ofs - 5, -S * 0.08, 10, S * 0.05);
      ctx.fillRect(ofs - 5, S * 0.03, 10, S * 0.05);

      ctx.fillStyle = '#444';
      ctx.fillRect(ofs - 2, -S * 0.07, 4, 3);
      ctx.fillStyle = '#fffa80';
    }
  }

  ctx.restore();
};

export const createTrainSimulation = ({
  size,
  straightness,
  resetTimeMin,
  resetTimeMax,
  nowMs,
  initialTrainCountMin,
  initialTrainCountRange,
  trackSeedSegments,
}: {
  size: number;
  straightness: number;
  resetTimeMin: number;
  resetTimeMax: number;
  nowMs: number;
  initialTrainCountMin: number;
  initialTrainCountRange: number;
  trackSeedSegments: number;
}): TrainInitResult => {
  const { innerWidth: w, innerHeight: h } = window;
  const S = Math.max(80, size * 20);
  const cols = Math.ceil(w / S) + 1;
  const rows = Math.ceil(h / S) + 1;

  let terrain: Record<string, TerrainCell> = {};

  const biomeSpecs: {
    types: TerrainCell['type'][];
    weights: number[];
  }[] = [
    { types: ['snow', 'stone', 'forest', 'water'], weights: [0.55, 0.25, 0.12, 0.08] },
    { types: ['sand', 'lava', 'dirt', 'stone'], weights: [0.45, 0.3, 0.15, 0.1] },
    { types: ['forest', 'autumn', 'grass'], weights: [0.45, 0.35, 0.2] },
    { types: ['water', 'sand', 'stone', 'grass'], weights: [0.45, 0.3, 0.15, 0.1] },
    { types: ['grass', 'autumn', 'dirt', 'water'], weights: [0.5, 0.25, 0.15, 0.1] },
  ];

  const numAnchors = 5 + Math.floor(Math.random() * 4);
  const anchors = Array.from({ length: numAnchors }, () => {
    const spec = biomeSpecs[Math.floor(Math.random() * biomeSpecs.length)];
    return {
      ax: Math.random() * (cols + 4) - 2,
      ay: Math.random() * (rows + 4) - 2,
      strength: 0.6 + Math.random() * 1.4,
      spec,
    };
  });

  for (let c = -2; c < cols + 3; c++) {
    for (let r = -2; r < rows + 3; r++) {
      const key = `${c},${r}`;

      let bestAnchor = anchors[0];
      let minDist = Infinity;

      for (const anchor of anchors) {
        const dist = Math.hypot(c - anchor.ax, r - anchor.ay) / anchor.strength;
        if (dist < minDist) {
          minDist = dist;
          bestAnchor = anchor;
        }
      }

      const spec = bestAnchor.spec;
      const rand = Math.random();
      let type: TerrainCell['type'] = spec.types[0];
      let sum = 0;
      for (let i = 0; i < spec.types.length; i++) {
        sum += spec.weights[i];
        if (rand <= sum) {
          type = spec.types[i];
          break;
        }
      }

      terrain[key] = {
        type,
        variant: Math.floor(Math.random() * 8),
      };
    }
  }

  for (let pass = 0; pass < 3; pass++) {
    const next: Record<string, TerrainCell> = {};
    for (let c = -2; c < cols + 3; c++) {
      for (let r = -2; r < rows + 3; r++) {
        const key = `${c},${r}`;
        const counts: Record<string, number> = {};

        for (let dc = -1; dc <= 1; dc++) {
          for (let dr = -1; dr <= 1; dr++) {
            const neighborKey = `${c + dc},${r + dr}`;
            if (terrain[neighborKey]) {
              const terrainType = terrain[neighborKey].type;
              counts[terrainType] = (counts[terrainType] || 0) + 1;
            }
          }
        }

        let majority = terrain[key] ? terrain[key].type : 'grass';
        let maxCount = 0;
        Object.entries(counts).forEach(([type, count]) => {
          if (count > maxCount) {
            maxCount = count;
            majority = type as TerrainCell['type'];
          }
        });

        next[key] = {
          type: majority,
          variant: terrain[key] ? terrain[key].variant : 0,
        };
      }
    }
    terrain = next;
  }

  const grid: Record<string, { conns: Record<number, number> }> = {};
  const trains: Train[] = [];
  const numTrains = Math.floor(Math.random() * initialTrainCountRange) + initialTrainCountMin;

  for (let i = 0; i < numTrains; i++) {
    const tx = Math.floor(Math.random() * (cols - 6)) + 3;
    const ty = Math.floor(Math.random() * (rows - 6)) + 3;
    const startExitDir = Math.floor(Math.random() * 4);

    const newTrain = createTrainFromTrackStart(tx, ty, startExitDir);

    const startKey = `${tx},${ty}`;
    grid[startKey] = {
      conns: {
        [(startExitDir + 2) % 4]: startExitDir,
        [startExitDir]: (startExitDir + 2) % 4,
      },
    };

    for (let sIdx = 0; sIdx < trackSeedSegments; sIdx++) {
      extendTrack(newTrain, grid, cols, rows, undefined, straightness);
    }

    trains.push(newTrain);
  }

  const sim: TrainSim = {
    grid,
    terrain,
    trains,
    steam: [],
    queuedTiles: [],
    placedTilesCount: 0,
  };

  const randomSec = Math.random() * (resetTimeMax - resetTimeMin) + resetTimeMin;
  return {
    sim,
    nextResetTime: nowMs + randomSec * 1000,
    lastTilePlacementTime: nowMs,
  };
};
