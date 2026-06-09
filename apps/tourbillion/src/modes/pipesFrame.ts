import type { Pipe } from '../types';

interface RenderPipesFrameOptions {
  ctx: CanvasRenderingContext2D;
  width: number;
  height: number;
  pipes: Pipe[];
  speed: number;
  size: number;
  trail: number;
}

export function renderPipesFrame({
  ctx,
  width,
  height,
  pipes,
  speed,
  size,
  trail,
}: RenderPipesFrameOptions) {
  if (trail < 0.1) {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.01)';
    ctx.fillRect(0, 0, width, height);
  }

  pipes.forEach((pipe) => {
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
    if (
      pipe.len > Math.random() * 500 + 100 ||
      pipe.x < 0 ||
      pipe.x > width ||
      pipe.y < 0 ||
      pipe.y > height
    ) {
      pipe.dir = Math.floor(Math.random() * 4);
      pipe.len = 0;
      if (pipe.x < 0) pipe.x = 0;
      if (pipe.x > width) pipe.x = width;
      if (pipe.y < 0) pipe.y = 0;
      if (pipe.y > height) pipe.y = height;
    }
  });
}
