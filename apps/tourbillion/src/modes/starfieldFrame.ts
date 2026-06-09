import type { Star } from '../types';

interface RenderStarfieldFrameOptions {
  ctx: CanvasRenderingContext2D;
  width: number;
  height: number;
  stars: Star[];
  speed: number;
  size: number;
  trail: number;
  multicolor: boolean;
  hue: number;
}

export function renderStarfieldFrame({
  ctx,
  width,
  height,
  stars,
  speed,
  size,
  trail,
  multicolor,
  hue,
}: RenderStarfieldFrameOptions) {
  const clearAlpha = Math.max(0.05, 0.8 - (trail * 0.75));
  ctx.fillStyle = `rgba(0, 0, 0, ${clearAlpha})`;
  ctx.fillRect(0, 0, width, height);

  const centerX = width / 2;
  const centerY = height / 2;

  stars.forEach((star) => {
    star.z -= speed;
    if (star.z <= 0) {
      star.z = width;
      star.x = (Math.random() - 0.5) * width * 2;
      star.y = (Math.random() - 0.5) * height * 2;
      star.px = 0;
      star.py = 0;
    }

    const x = (star.x / star.z) * width + centerX;
    const y = (star.y / star.z) * height + centerY;

    if (star.px !== 0) {
      const opacity = Math.min(1, 1 - star.z / width);
      const color = multicolor
        ? `hsla(${(star.x + star.y + hue) % 360}, 100%, 75%, `
        : star.color;

      ctx.strokeStyle = `${color}${opacity})`;
      ctx.lineWidth = Math.max(0.1, (1 - star.z / width) * size);
      ctx.beginPath();
      ctx.moveTo(star.px, star.py);
      ctx.lineTo(x, y);
      ctx.stroke();
    }

    star.px = x;
    star.py = y;
  });
}
