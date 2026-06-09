import type { MystifyShape } from '../types';

interface RenderMystifyFrameOptions {
  ctx: CanvasRenderingContext2D;
  width: number;
  height: number;
  shapes: MystifyShape[];
  size: number;
  trail: number;
  multicolor: boolean;
  hue: number;
}

export function renderMystifyFrame({
  ctx,
  width,
  height,
  shapes,
  size,
  trail,
  multicolor,
  hue,
}: RenderMystifyFrameOptions) {
  ctx.fillStyle = `rgba(0, 0, 0, ${0.05 + (1 - trail) * 0.1})`;
  ctx.fillRect(0, 0, width, height);

  shapes.forEach((shape) => {
    shape.points.forEach((point) => {
      point.x += point.vx;
      point.y += point.vy;
      if (point.x < 0 || point.x > width) point.vx *= -1;
      if (point.y < 0 || point.y > height) point.vy *= -1;
    });

    shape.history.push(shape.points.map((point) => ({ ...point })));
    if (shape.history.length > 20) shape.history.shift();

    ctx.lineWidth = size / 2;
    shape.history.forEach((points, index) => {
      const color = multicolor ? `hsla(${hue}, 100%, 75%, ` : shape.color;
      ctx.strokeStyle = color
        .replace('0.5)', `${(index / shape.history.length) * 0.5})`)
        .replace('0.3)', `${(index / shape.history.length) * 0.5})`);
      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);
      for (let i = 1; i < points.length; i++) {
        ctx.lineTo(points[i].x, points[i].y);
      }
      ctx.lineTo(points[0].x, points[0].y);
      ctx.stroke();
    });
  });
}
