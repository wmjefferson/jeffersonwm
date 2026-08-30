export interface ImageItem {
  id: number; // 0 to 11168+
  code: string; // e.g. "IMG-00001"
  title: string;
  category: 'Nature' | 'Space' | 'Architecture' | 'Cyberpunk' | 'Abstract' | 'Wildlife' | 'Portraits' | 'Textures' | 'Minimalist' | 'Urban';
  colorHex: string;
  hue: number; // 0 - 360
  brightness: number; // 0 - 100
  imageUrl: string;
  thumbUrl: string;
  resolution: string;
  dateAdded: string;
  tags: string[];
  cameraInfo?: string;
  customUploaded?: boolean;
}

export type GridOverlayMode = 'blank' | 'mosaic' | 'spectrum' | 'category' | 'matrix' | 'heatmap' | 'plain';

export interface GridZone {
  name: 'top' | 'bottom' | 'left' | 'right';
  x: number;
  y: number;
  width: number;
  height: number;
  cols: number;
  rows: number;
  cellWidth: number;
  cellHeight: number;
  startIndex: number;
  totalBlocks: number;
}

export interface GridConfig {
  targetCount: number; // Default comes from src/config.ts
  cols: number;
  rows: number;
  totalBlocks: number;
  cellWidth: number;
  cellHeight: number;
  mode: 'auto-aspect' | 'exact-target' | 'fixed-cols' | 'frame-center';
  centerSquare?: {
    x: number;
    y: number;
    size: number;
  };
  zones?: GridZone[];
}

export interface HoverState {
  index: number;
  x: number;
  y: number;
  col: number;
  row: number;
  image: ImageItem;
  pinned: boolean;
}

export interface ViewportMetrics {
  width: number;
  height: number;
  devicePixelRatio: number;
  fps: number;
}
