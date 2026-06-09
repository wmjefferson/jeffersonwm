import type {
  MatrixColumn,
  MystifyShape,
  Pipe,
  Point,
  Star,
  Toaster,
} from '../types';

export function getRandomColor() {
  const hues = [0, 60, 180, 240, 300];
  const hue = hues[Math.floor(Math.random() * hues.length)];
  return `hsla(${hue}, 100%, 75%, `;
}

export function getMatrixChar() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789$+-*/=%\"'#&_(),.;:?!\\|{}<>[]^~";
  return chars.charAt(Math.floor(Math.random() * chars.length));
}

export function createStars({
  width,
  height,
  count,
  multicolor,
}: {
  width: number;
  height: number;
  count: number;
  multicolor: boolean;
}): Star[] {
  const stars: Star[] = [];
  for (let i = 0; i < count; i++) {
    stars.push({
      x: (Math.random() - 0.5) * width * 2,
      y: (Math.random() - 0.5) * height * 2,
      z: Math.random() * width,
      px: 0,
      py: 0,
      color: multicolor ? getRandomColor() : 'rgba(255, 255, 255, ',
    });
  }
  return stars;
}

export function createMatrixColumns({
  width,
  size,
  speed,
}: {
  width: number;
  size: number;
  speed: number;
}): MatrixColumn[] {
  const fontSize = size * 5;
  const columns = Math.floor(width / fontSize) + 1;
  const matrix: MatrixColumn[] = [];
  for (let i = 0; i < columns; i++) {
    matrix.push({
      x: i * fontSize,
      y: Math.random() * -1000,
      chars: Array.from({ length: 15 }, () => getMatrixChar()),
      speed: (Math.random() * 2 + 1) * speed,
    });
  }
  return matrix;
}

export function createMystifyShapes({
  width,
  height,
  count,
  speed,
  multicolor,
}: {
  width: number;
  height: number;
  count: number;
  speed: number;
  multicolor: boolean;
}): MystifyShape[] {
  const shapes: MystifyShape[] = [];
  const numShapes = Math.floor(count / 250) + 1;

  for (let i = 0; i < numShapes; i++) {
    const points: Point[] = Array.from({ length: 4 }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      vx: (Math.random() - 0.5) * 10 * speed,
      vy: (Math.random() - 0.5) * 10 * speed,
    }));
    shapes.push({
      points,
      history: [],
      color: multicolor ? getRandomColor().replace(', ', ', 0.5)') : 'rgba(255, 255, 255, 0.3)',
    });
  }

  return shapes;
}

export function createPipes({
  width,
  height,
  count,
  multicolor,
}: {
  width: number;
  height: number;
  count: number;
  multicolor: boolean;
}): Pipe[] {
  const numPipes = Math.floor(count / 500) + 1;
  const grid = 20;
  const pipes: Pipe[] = [];

  for (let i = 0; i < numPipes; i++) {
    pipes.push({
      x: Math.floor(Math.random() * (width / grid)) * grid,
      y: Math.floor(Math.random() * (height / grid)) * grid,
      dir: Math.floor(Math.random() * 4),
      color: multicolor ? getRandomColor().replace(', ', ', 0.8)') : 'rgba(200, 200, 200, 0.8)',
      len: 0,
    });
  }

  return pipes;
}

export function createToasters({
  width,
  height,
  count,
}: {
  width: number;
  height: number;
  count: number;
}): Toaster[] {
  const numItems = Math.floor(count / 100) + 1;
  const items: Toaster[] = [];

  for (let i = 0; i < numItems; i++) {
    items.push({
      x: Math.random() * width,
      y: Math.random() * height,
      z: Math.random() * 1000,
      wingPhase: Math.random() * Math.PI * 2,
      type: Math.random() > 0.3 ? 'toaster' : 'toast',
    });
  }

  return items;
}
