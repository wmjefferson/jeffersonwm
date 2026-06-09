import { getMatrixChar } from './initializers';
import type { MatrixColumn } from '../types';

interface RenderMatrixFrameOptions {
  ctx: CanvasRenderingContext2D;
  width: number;
  height: number;
  columns: MatrixColumn[];
  speed: number;
  size: number;
  trail: number;
  multicolor: boolean;
  hue: number;
}

export function renderMatrixFrame({
  ctx,
  width,
  height,
  columns,
  speed,
  size,
  trail,
  multicolor,
  hue,
}: RenderMatrixFrameOptions) {
  ctx.fillStyle = `rgba(0, 0, 0, ${0.1 + trail * 0.2})`;
  ctx.fillRect(0, 0, width, height);

  const fontSize = size * 5;
  ctx.font = `${fontSize}px monospace`;

  columns.forEach((column) => {
    column.y += column.speed;
    if (column.y > height + (column.chars.length * fontSize)) {
      column.y = -fontSize;
      column.speed = (Math.random() * 2 + 1) * speed;
    }

    column.chars.forEach((char, index) => {
      const opacity = 1 - (index / column.chars.length);
      const colorHue = multicolor ? (column.x / width * 360 + hue) % 360 : 120;
      ctx.fillStyle = `hsla(${colorHue}, 100%, 50%, ${opacity})`;
      ctx.fillText(char, column.x, column.y - (index * fontSize));
      if (Math.random() > 0.98) {
        column.chars[index] = getMatrixChar();
      }
    });
  });
}
