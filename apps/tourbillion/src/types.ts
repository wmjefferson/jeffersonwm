export type Mode = 'starfield' | 'matrix' | 'mystify' | 'pipes' | 'toasters' | 'trains';

export type ResetTrigger = 'time' | 'tiles' | 'none';

export type QualityLevel = 'low' | 'medium' | 'high';

export interface Star {
  x: number;
  y: number;
  z: number;
  px: number;
  py: number;
  color: string;
}

export interface MatrixColumn {
  x: number;
  y: number;
  chars: string[];
  speed: number;
}

export interface Point {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

export interface MystifyShape {
  points: Point[];
  history: Point[][];
  color: string;
}

export interface Pipe {
  x: number;
  y: number;
  dir: number;
  color: string;
  len: number;
}

export interface Toaster {
  x: number;
  y: number;
  z: number;
  wingPhase: number;
  type: 'toaster' | 'toast';
}

export interface Train {
  tx: number;
  ty: number;
  fromDir: number;
  toDir: number;
  progress: number;
  history: { x: number; y: number; heading: number }[];
  dead: boolean;
  color: string;
  carsCount: number;
  cx: number;
  cy: number;
  cExitDir: number;
  style: 'steam' | 'diesel';
  carsList: ('engine' | 'tender' | 'logs' | 'tanker' | 'boxcar' | 'passenger')[];
}

export interface TerrainCell {
  type: 'grass' | 'water' | 'dirt' | 'sand' | 'stone' | 'snow' | 'forest' | 'autumn' | 'lava';
  variant: number;
}

export interface SteamParticle {
  x: number;
  y: number;
  r: number;
  alpha: number;
  vx: number;
  vy: number;
}

export interface QueuedTile {
  key: string;
  conns: Record<number, number>;
}

export interface TrainSim {
  grid: Record<string, { conns: Record<number, number> }>;
  terrain: Record<string, TerrainCell>;
  trains: Train[];
  steam: SteamParticle[];
  queuedTiles: QueuedTile[];
  placedTilesCount: number;
}
