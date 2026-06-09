import type { Toaster } from '../types';

interface RenderToastersFrameOptions {
  ctx: CanvasRenderingContext2D;
  width: number;
  height: number;
  toasters: Toaster[];
  speed: number;
  size: number;
}

export function renderToastersFrame({
  ctx,
  width,
  height,
  toasters,
  speed,
  size,
}: RenderToastersFrameOptions) {
  ctx.fillStyle = 'black';
  ctx.fillRect(0, 0, width, height);

  toasters.forEach((toaster) => {
    toaster.x -= speed * 2;
    toaster.y += speed;
    toaster.wingPhase += 0.2 * speed;

    if (toaster.x < -100 || toaster.y > height + 100) {
      toaster.x = width + 100;
      toaster.y = Math.random() * height - 200;
    }

    ctx.save();
    ctx.translate(toaster.x, toaster.y);
    const scale = size / 2;

    if (toaster.type === 'toaster') {
      ctx.fillStyle = '#bbb';
      ctx.beginPath();
      ctx.roundRect(0, 0, 30 * scale, 22 * scale, 4 * scale);
      ctx.fill();

      ctx.fillStyle = '#888';
      ctx.fillRect(4 * scale, 4 * scale, 22 * scale, 2 * scale);

      ctx.fillStyle = 'white';
      const wingAngle = Math.sin(toaster.wingPhase) * (Math.PI / 4);

      ctx.save();
      ctx.translate(5 * scale, 5 * scale);
      ctx.rotate(-wingAngle);
      ctx.beginPath();
      ctx.ellipse(0, 0, 12 * scale, 6 * scale, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      ctx.save();
      ctx.translate(25 * scale, 5 * scale);
      ctx.rotate(wingAngle);
      ctx.beginPath();
      ctx.ellipse(0, 0, 12 * scale, 6 * scale, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    } else {
      ctx.fillStyle = '#eeba72';
      ctx.beginPath();
      ctx.roundRect(0, 0, 20 * scale, 20 * scale, 2 * scale);
      ctx.fill();
      ctx.strokeStyle = '#a67b45';
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    ctx.restore();
  });
}
