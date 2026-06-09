import type { TrainSim } from '../types';
import type { TrainQualityProfile } from '../constants';
import {
  createTrainFromTrackStart,
  drawCar,
  extendTrack,
  getCurvePath,
  getPosAndHeading,
} from './trains';

function getBaseColor(type: string, isAlt: boolean): string {
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
}

interface RenderTrainsFrameOptions {
  ctx: CanvasRenderingContext2D;
  width: number;
  height: number;
  size: number;
  sim: TrainSim;
  trainQuality: TrainQualityProfile;
  trainSpeed: number;
  straightness: number;
}

export function renderTrainsFrame({
  ctx,
  width,
  height,
  size,
  sim,
  trainQuality,
  trainSpeed,
  straightness,
}: RenderTrainsFrameOptions) {
  const S = Math.max(80, size * 20);
  const cols = Math.ceil(width / S) + 1;
  const rows = Math.ceil(height / S) + 1;

  for (let c = -1; c < cols + 1; c++) {
    for (let r = -1; r < rows + 1; r++) {
      const key = `${c},${r}`;
      const cell = sim.terrain[key];
      if (cell) {
        const bg = getBaseColor(cell.type, c % 2 === r % 2);
        ctx.fillStyle = bg;
        ctx.fillRect(c * S, r * S, S, S);
      }
    }
  }

  ctx.save();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
  ctx.lineWidth = 1;
  for (let c = -1; c < cols + 1; c++) {
    for (let r = -1; r < rows + 1; r++) {
      ctx.fillStyle = (c % 3 === r % 2) ? 'rgba(0, 0, 0, 0.015)' : 'rgba(255, 255, 255, 0.015)';
      ctx.fillRect(c * S + S * 0.15, r * S + S * 0.15, 2, 2);
      ctx.fillRect(c * S + S * 0.75, r * S + S * 0.45, 1.5, 1.5);
      ctx.fillRect(c * S + S * 0.42, r * S + S * 0.80, 2, 2);
    }
  }
  ctx.restore();

  for (let c = -1; c < cols + 1; c++) {
    for (let r = -1; r < rows + 1; r++) {
      const key = `${c},${r}`;
      const cell = sim.terrain[key];
      if (!cell) {
        continue;
      }

      ctx.save();
      if (cell.type === 'grass') {
        ctx.strokeStyle = '#3d6132';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(c * S + S * 0.25, r * S + S * 0.4); ctx.lineTo(c * S + S * 0.23, r * S + S * 0.28);
        ctx.moveTo(c * S + S * 0.25, r * S + S * 0.4); ctx.lineTo(c * S + S * 0.3, r * S + S * 0.32);
        ctx.moveTo(c * S + S * 0.7, r * S + S * 0.65); ctx.lineTo(c * S + S * 0.67, r * S + S * 0.52);
        ctx.moveTo(c * S + S * 0.7, r * S + S * 0.65); ctx.lineTo(c * S + S * 0.74, r * S + S * 0.54);
        ctx.stroke();

        if (cell.variant === 1) {
          ctx.fillStyle = '#fbfbfb';
          ctx.fillRect(c * S + S * 0.5 - 2, r * S + S * 0.5, 4, 8);
          ctx.fillStyle = '#ff3b30';
          ctx.beginPath();
          ctx.arc(c * S + S * 0.5, r * S + S * 0.52, 7, Math.PI, 0, false);
          ctx.fill();
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(c * S + S * 0.5 - 3, r * S + S * 0.49, 1.5, 1.5);
          ctx.fillRect(c * S + S * 0.5 + 2, r * S + S * 0.5, 1.5, 1.5);
        } else if (cell.variant === 2) {
          ctx.fillStyle = '#f1c40f';
          ctx.beginPath();
          ctx.arc(c * S + S * 0.3, r * S + S * 0.6, S * 0.05, 0, Math.PI * 2);
          ctx.arc(c * S + S * 0.4, r * S + S * 0.7, S * 0.05, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#f39c12';
          ctx.beginPath();
          ctx.arc(c * S + S * 0.35, r * S + S * 0.65, S * 0.03, 0, Math.PI * 2);
          ctx.fill();
        } else if (cell.variant === 3) {
          ctx.fillStyle = '#2d5225';
          ctx.beginPath();
          ctx.arc(c * S + S * 0.65, r * S + S * 0.7, S * 0.09, 0, Math.PI * 2);
          ctx.arc(c * S + S * 0.75, r * S + S * 0.74, S * 0.07, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#39632d';
          ctx.beginPath();
          ctx.arc(c * S + S * 0.68, r * S + S * 0.67, S * 0.06, 0, Math.PI * 2);
          ctx.fill();
        } else if (cell.variant === 4) {
          ctx.fillStyle = '#9b59b6';
          ctx.beginPath();
          ctx.arc(c * S + S * 0.42, r * S + S * 0.45, 3.5, 0, Math.PI*2);
          ctx.arc(c * S + S * 0.38, r * S + S * 0.52, 3, 0, Math.PI*2);
          ctx.arc(c * S + S * 0.46, r * S + S * 0.55, 4, 0, Math.PI*2);
          ctx.fill();
          ctx.strokeStyle = '#27ae60';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(c * S + S * 0.42, r * S + S * 0.45); ctx.lineTo(c * S + S * 0.44, r * S + S * 0.68);
          ctx.moveTo(c * S + S * 0.38, r * S + S * 0.52); ctx.lineTo(c * S + S * 0.42, r * S + S * 0.68);
          ctx.moveTo(c * S + S * 0.46, r * S + S * 0.55); ctx.lineTo(c * S + S * 0.46, r * S + S * 0.68);
          ctx.stroke();
        } else if (cell.variant === 5) {
          ctx.fillStyle = '#7e5835';
          ctx.beginPath();
          ctx.roundRect(c * S + S * 0.40, r * S + S * 0.52, S * 0.18, S * 0.08, 2);
          ctx.roundRect(c * S + S * 0.46, r * S + S * 0.44, S * 0.18, S * 0.08, 2);
          ctx.roundRect(c * S + S * 0.38, r * S + S * 0.44, S * 0.18, S * 0.08, 2);
          ctx.fill();
          ctx.fillStyle = '#d7ccc8';
          ctx.beginPath();
          ctx.arc(c * S + S * 0.40, r * S + S * 0.56, 3, 0, Math.PI*2);
          ctx.arc(c * S + S * 0.46, r * S + S * 0.48, 3, 0, Math.PI*2);
          ctx.arc(c * S + S * 0.38, r * S + S * 0.48, 3, 0, Math.PI*2);
          ctx.fill();
        }
      } else if (cell.type === 'forest') {
        if (cell.variant < 4) {
          ctx.fillStyle = '#1e3019';
          ctx.beginPath();
          ctx.moveTo(c * S + S * 0.5, r * S + S * 0.15);
          ctx.lineTo(c * S + S * 0.23, r * S + S * 0.8);
          ctx.lineTo(c * S + S * 0.77, r * S + S * 0.8);
          ctx.closePath();
          ctx.fill();
          ctx.fillStyle = '#27401f';
          ctx.beginPath();
          ctx.moveTo(c * S + S * 0.5, r * S + S * 0.2);
          ctx.lineTo(c * S + S * 0.28, r * S + S * 0.78);
          ctx.lineTo(c * S + S * 0.72, r * S + S * 0.78);
          ctx.closePath();
          ctx.fill();
          ctx.fillStyle = '#5d4533';
          ctx.fillRect(c * S + S * 0.46, r * S + S * 0.78, S * 0.08, S * 0.13);
          if (cell.variant === 1) {
            ctx.fillStyle = '#1d2a17';
            ctx.beginPath();
            ctx.moveTo(c * S + S * 0.28, r * S + S * 0.42);
            ctx.lineTo(c * S + S * 0.18, r * S + S * 0.7);
            ctx.lineTo(c * S + S * 0.38, r * S + S * 0.7);
            ctx.closePath();
            ctx.fill();
          } else if (cell.variant === 2) {
            ctx.fillStyle = '#c9b458';
            ctx.beginPath();
            ctx.arc(c * S + S * 0.63, r * S + S * 0.62, 3, 0, Math.PI * 2);
            ctx.arc(c * S + S * 0.67, r * S + S * 0.68, 2.5, 0, Math.PI * 2);
            ctx.fill();
          } else if (cell.variant === 3) {
            ctx.strokeStyle = '#473223';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(c * S + S * 0.74, r * S + S * 0.6); ctx.lineTo(c * S + S * 0.84, r * S + S * 0.42);
            ctx.stroke();
          }
        } else if (cell.variant === 4) {
          ctx.fillStyle = '#607d3b';
          ctx.beginPath();
          ctx.arc(c * S + S * 0.5, r * S + S * 0.6, 14, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#4d6530';
          ctx.beginPath();
          ctx.arc(c * S + S * 0.5, r * S + S * 0.55, 10, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#5d4533';
          ctx.fillRect(c * S + S * 0.47, r * S + S * 0.7, S * 0.06, S * 0.10);
        } else if (cell.variant === 5) {
          ctx.fillStyle = '#7b4c1a';
          ctx.beginPath();
          ctx.arc(c * S + S * 0.56, r * S + S * 0.60, 8, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#6b3816';
          ctx.beginPath();
          ctx.arc(c * S + S * 0.43, r * S + S * 0.56, 6, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#5d4533';
          ctx.fillRect(c * S + S * 0.48, r * S + S * 0.67, S * 0.05, S * 0.09);
        }
      } else if (cell.type === 'autumn') {
        ctx.fillStyle = '#5f3a1f';
        ctx.fillRect(c * S + S * 0.46, r * S + S * 0.68, S * 0.08, S * 0.14);
        ctx.fillStyle = '#d36b16';
        ctx.beginPath();
        ctx.arc(c * S + S * 0.50, r * S + S * 0.45, S * 0.16, 0, Math.PI*2);
        ctx.fill();
        ctx.fillStyle = '#c74d18';
        ctx.beginPath();
        ctx.arc(c * S + S * 0.42, r * S + S * 0.50, S * 0.11, 0, Math.PI*2);
        ctx.arc(c * S + S * 0.58, r * S + S * 0.50, S * 0.11, 0, Math.PI*2);
        ctx.fill();
        if (cell.variant === 1) {
          ctx.fillStyle = '#f2b134';
          ctx.beginPath();
          ctx.arc(c * S + S * 0.60, r * S + S * 0.38, 4, 0, Math.PI*2);
          ctx.fill();
        } else if (cell.variant === 2) {
          ctx.fillStyle = '#8c2f11';
          ctx.beginPath();
          ctx.arc(c * S + S * 0.35, r * S + S * 0.60, 5, 0, Math.PI*2);
          ctx.fill();
        } else if (cell.variant === 3) {
          ctx.fillStyle = '#3d2b1f';
          ctx.fillRect(c * S + S * 0.38, r * S + S * 0.76, S * 0.24, S * 0.03);
        } else if (cell.variant === 4) {
          ctx.fillStyle = '#f4d03f';
          ctx.beginPath();
          ctx.arc(c * S + S * 0.44, r * S + S * 0.36, 3.5, 0, Math.PI*2);
          ctx.arc(c * S + S * 0.56, r * S + S * 0.34, 2.5, 0, Math.PI*2);
          ctx.fill();
        } else if (cell.variant === 5) {
          ctx.strokeStyle = '#6c2f12';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(c * S + S * 0.3, r * S + S * 0.56); ctx.lineTo(c * S + S * 0.26, r * S + S * 0.44);
          ctx.moveTo(c * S + S * 0.68, r * S + S * 0.58); ctx.lineTo(c * S + S * 0.73, r * S + S * 0.46);
          ctx.stroke();
        }
      } else if (cell.type === 'snow') {
        ctx.fillStyle = '#d8ecf7';
        ctx.beginPath();
        ctx.ellipse(c * S + S * 0.45, r * S + S * 0.60, 8, 5, 0, 0, Math.PI * 2);
        ctx.ellipse(c * S + S * 0.62, r * S + S * 0.62, 10, 6, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.45)';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(c * S + S * 0.18, r * S + S * 0.25); ctx.lineTo(c * S + S * 0.24, r * S + S * 0.19);
        ctx.moveTo(c * S + S * 0.22, r * S + S * 0.25); ctx.lineTo(c * S + S * 0.16, r * S + S * 0.19);
        ctx.moveTo(c * S + S * 0.70, r * S + S * 0.25); ctx.lineTo(c * S + S * 0.76, r * S + S * 0.19);
        ctx.moveTo(c * S + S * 0.74, r * S + S * 0.25); ctx.lineTo(c * S + S * 0.68, r * S + S * 0.19);
        ctx.stroke();
        if (cell.variant === 1) {
          ctx.strokeStyle = '#8a4b2a';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(c * S + S * 0.55, r * S + S * 0.40); ctx.lineTo(c * S + S * 0.55, r * S + S * 0.26);
          ctx.stroke();
          ctx.fillStyle = '#2d4d25';
          ctx.beginPath();
          ctx.moveTo(c * S + S * 0.55, r * S + S * 0.18);
          ctx.lineTo(c * S + S * 0.49, r * S + S * 0.28);
          ctx.lineTo(c * S + S * 0.61, r * S + S * 0.28);
          ctx.closePath();
          ctx.fill();
        } else if (cell.variant === 2) {
          ctx.fillStyle = '#a7c7d9';
          ctx.beginPath();
          ctx.arc(c * S + S * 0.30, r * S + S * 0.52, 6, 0, Math.PI*2);
          ctx.arc(c * S + S * 0.36, r * S + S * 0.59, 5, 0, Math.PI*2);
          ctx.fill();
        } else if (cell.variant === 3) {
          ctx.strokeStyle = '#d5eef7';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(c * S + S * 0.68, r * S + S * 0.38, 5, 0, Math.PI*2);
          ctx.moveTo(c * S + S * 0.68, r * S + S * 0.32); ctx.lineTo(c * S + S * 0.68, r * S + S * 0.44);
          ctx.moveTo(c * S + S * 0.62, r * S + S * 0.38); ctx.lineTo(c * S + S * 0.74, r * S + S * 0.38);
          ctx.stroke();
        } else if (cell.variant === 4) {
          ctx.fillStyle = '#efe6d1';
          ctx.beginPath();
          ctx.arc(c * S + S * 0.48, r * S + S * 0.58, 7, 0, Math.PI*2);
          ctx.fill();
          ctx.fillStyle = '#d9c9a3';
          ctx.beginPath();
          ctx.arc(c * S + S * 0.48, r * S + S * 0.58, 3, 0, Math.PI*2);
          ctx.fill();
        } else if (cell.variant === 5) {
          ctx.fillStyle = '#f8fafc';
          ctx.beginPath();
          ctx.arc(c * S + S * 0.52, r * S + S * 0.48, 9, 0, Math.PI*2);
          ctx.arc(c * S + S * 0.62, r * S + S * 0.56, 7, 0, Math.PI*2);
          ctx.fill();
        }
      } else if (cell.type === 'lava') {
        ctx.fillStyle = '#f39c12';
        ctx.beginPath();
        ctx.arc(c * S + S * 0.34, r * S + S * 0.56, 7, 0, Math.PI * 2);
        ctx.arc(c * S + S * 0.54, r * S + S * 0.40, 11, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#e74c3c';
        ctx.beginPath();
        ctx.arc(c * S + S * 0.34, r * S + S * 0.56, 4, 0, Math.PI * 2);
        ctx.arc(c * S + S * 0.54, r * S + S * 0.40, 7, 0, Math.PI * 2);
        ctx.fill();
        if (cell.variant === 1) {
          ctx.strokeStyle = '#ffff99';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(c * S + S * 0.46, r * S + S * 0.35); ctx.lineTo(c * S + S * 0.53, r * S + S * 0.24);
          ctx.stroke();
        } else if (cell.variant === 2) {
          ctx.strokeStyle = '#ffdd55';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(c * S + S * 0.70, r * S + S * 0.66, 3, 0, Math.PI * 2);
          ctx.stroke();
        } else if (cell.variant === 3) {
          ctx.fillStyle = '#ff7f11';
          ctx.beginPath();
          ctx.arc(c * S + S * 0.50, r * S + S * 0.76, 5, 0, Math.PI*2);
          ctx.fill();
        } else if (cell.variant === 4) {
          ctx.strokeStyle = '#ffff66';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(c * S + S * 0.28, r * S + S * 0.56); ctx.lineTo(c * S + S * 0.18, r * S + S * 0.50);
          ctx.moveTo(c * S + S * 0.40, r * S + S * 0.62); ctx.lineTo(c * S + S * 0.50, r * S + S * 0.70);
          ctx.stroke();
        } else if (cell.variant === 5) {
          ctx.fillStyle = '#6b1d1d';
          ctx.beginPath();
          ctx.arc(c * S + S * 0.65, r * S + S * 0.32, 6, 0, Math.PI*2);
          ctx.fill();
        }
      } else if (cell.type === 'water') {
        ctx.strokeStyle = 'rgba(255,255,255,0.18)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(c * S + S * 0.12, r * S + S * 0.40); ctx.quadraticCurveTo(c * S + S * 0.32, r * S + S * 0.32, c * S + S * 0.55, r * S + S * 0.38);
        ctx.moveTo(c * S + S * 0.22, r * S + S * 0.63); ctx.quadraticCurveTo(c * S + S * 0.44, r * S + S * 0.55, c * S + S * 0.75, r * S + S * 0.65);
        ctx.stroke();
        if (cell.variant === 1) {
          ctx.fillStyle = 'rgba(255,255,255,0.5)';
          ctx.beginPath();
          ctx.arc(c * S + S * 0.38, r * S + S * 0.72, 4, 0, Math.PI*2);
          ctx.fill();
        } else if (cell.variant === 2) {
          ctx.fillStyle = '#8ecae6';
          ctx.beginPath();
          ctx.ellipse(c * S + S * 0.62, r * S + S * 0.52, 7, 3, 0, 0, Math.PI*2);
          ctx.fill();
        } else if (cell.variant === 3) {
          ctx.fillStyle = '#fef08a';
          ctx.beginPath();
          ctx.arc(c * S + S * 0.50, r * S + S * 0.36, 3.5, 0, Math.PI*2);
          ctx.fill();
        } else if (cell.variant === 4) {
          ctx.strokeStyle = 'rgba(255,255,255,0.22)';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(c * S + S * 0.30, r * S + S * 0.48); ctx.quadraticCurveTo(c * S + S * 0.42, r * S + S * 0.42, c * S + S * 0.58, r * S + S * 0.48);
          ctx.quadraticCurveTo(c * S + S * 0.66, r * S + S * 0.52, c * S + S * 0.74, r * S + S * 0.50);
          ctx.stroke();
        } else if (cell.variant === 5) {
          ctx.strokeStyle = 'rgba(255,255,255,0.2)';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(c * S + S * 0.28, r * S + S * 0.44); ctx.lineTo(c * S + S * 0.40, r * S + S * 0.36);
          ctx.moveTo(c * S + S * 0.62, r * S + S * 0.50); ctx.lineTo(c * S + S * 0.76, r * S + S * 0.44);
          ctx.stroke();
        }
      } else if (cell.type === 'dirt') {
        ctx.fillStyle = 'rgba(0,0,0,0.08)';
        ctx.beginPath();
        ctx.arc(c * S + S * 0.32, r * S + S * 0.40, 4, 0, Math.PI*2);
        ctx.arc(c * S + S * 0.66, r * S + S * 0.62, 6, 0, Math.PI*2);
        ctx.fill();
        if (cell.variant === 1) {
          ctx.strokeStyle = '#a67c52';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(c * S + S * 0.36, r * S + S * 0.64); ctx.lineTo(c * S + S * 0.28, r * S + S * 0.52);
          ctx.stroke();
        } else if (cell.variant === 2) {
          ctx.fillStyle = '#c7a17a';
          ctx.beginPath();
          ctx.arc(c * S + S * 0.58, r * S + S * 0.34, 5, 0, Math.PI*2);
          ctx.fill();
        } else if (cell.variant === 3) {
          ctx.fillStyle = '#8b6b4f';
          ctx.fillRect(c * S + S * 0.45, r * S + S * 0.56, 10, 4);
        } else if (cell.variant === 4) {
          ctx.strokeStyle = '#6f533a';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(c * S + S * 0.24, r * S + S * 0.70); ctx.lineTo(c * S + S * 0.18, r * S + S * 0.78);
          ctx.moveTo(c * S + S * 0.72, r * S + S * 0.24); ctx.lineTo(c * S + S * 0.80, r * S + S * 0.16);
          ctx.stroke();
        } else if (cell.variant === 5) {
          ctx.fillStyle = '#b08968';
          ctx.beginPath();
          ctx.arc(c * S + S * 0.50, r * S + S * 0.48, 6, 0, Math.PI*2);
          ctx.fill();
        }
      } else if (cell.type === 'sand') {
        ctx.strokeStyle = 'rgba(0,0,0,0.08)';
        ctx.lineWidth = 1.3;
        ctx.beginPath();
        ctx.moveTo(c * S + S * 0.20, r * S + S * 0.52); ctx.quadraticCurveTo(c * S + S * 0.38, r * S + S * 0.46, c * S + S * 0.56, r * S + S * 0.52);
        ctx.moveTo(c * S + S * 0.48, r * S + S * 0.70); ctx.quadraticCurveTo(c * S + S * 0.62, r * S + S * 0.64, c * S + S * 0.78, r * S + S * 0.70);
        ctx.stroke();
        if (cell.variant === 1) {
          ctx.fillStyle = '#c59d5f';
          ctx.beginPath();
          ctx.arc(c * S + S * 0.36, r * S + S * 0.58, 5, 0, Math.PI*2);
          ctx.fill();
        } else if (cell.variant === 2) {
          ctx.strokeStyle = '#7e5835';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(c * S + S * 0.62, r * S + S * 0.62); ctx.lineTo(c * S + S * 0.72, r * S + S * 0.54);
          ctx.stroke();
        } else if (cell.variant === 3) {
          ctx.fillStyle = '#a67c52';
          ctx.beginPath();
          ctx.arc(c * S + S * 0.48, r * S + S * 0.34, 4, 0, Math.PI*2);
          ctx.fill();
        } else if (cell.variant === 4) {
          ctx.strokeStyle = '#d6b97a';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(c * S + S * 0.30, r * S + S * 0.40); ctx.lineTo(c * S + S * 0.24, r * S + S * 0.28);
          ctx.stroke();
        } else if (cell.variant === 5) {
          ctx.fillStyle = '#efe1b7';
          ctx.beginPath();
          ctx.arc(c * S + S * 0.60, r * S + S * 0.46, 6, 0, Math.PI*2);
          ctx.fill();
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

  while (sim.trains.length < trainQuality.minActiveTrains) {
    const tx = Math.floor(Math.random() * (cols - 6)) + 3;
    const ty = Math.floor(Math.random() * (rows - 6)) + 3;
    const startExitDir = Math.floor(Math.random() * 4);

    const newTrain = createTrainFromTrackStart(tx, ty, startExitDir);

    const startKey = `${tx},${ty}`;
    sim.grid[startKey] = {
      conns: {
        [(startExitDir + 2) % 4]: startExitDir,
        [startExitDir]: (startExitDir + 2) % 4,
      },
    };

    for (let sIdx = 0; sIdx < trainQuality.trackSeedSegments; sIdx++) {
      extendTrack(newTrain, sim.grid, cols, rows, undefined, straightness);
    }

    sim.trains.push(newTrain);
  }

  if (sim.steam.length < trainQuality.steamCap && Math.random() < trainSpeed * trainQuality.steamChance) {
    sim.trains.forEach((t) => {
      if (t.style === 'steam' && !t.dead && t.history.length > 0) {
        const headPos = t.history[0];
        const stackX = headPos.x + Math.cos(headPos.heading) * S * 0.22;
        const stackY = headPos.y + Math.sin(headPos.heading) * S * 0.22;
        if (sim.steam.length >= trainQuality.steamCap) return;
        sim.steam.push({
          x: stackX,
          y: stackY,
          r: S * 0.04,
          alpha: 0.6,
          vx: -Math.cos(headPos.heading) * trainSpeed * 0.3 + (Math.random() - 0.5) * 0.3,
          vy: -Math.sin(headPos.heading) * trainSpeed * 0.3 + (Math.random() - 0.5) * 0.3,
        });
      }
    });
  }

  sim.steam.forEach((p) => {
    p.x += p.vx;
    p.y += p.vy;
    p.r += trainSpeed * 0.07;
    p.alpha -= trainSpeed * 0.012;
  });
  sim.steam = sim.steam.filter((p) => p.alpha > 0);

  ctx.save();
  sim.steam.forEach((p) => {
    ctx.fillStyle = `rgba(242, 242, 242, ${p.alpha * 0.8})`;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.restore();

  sim.trains.forEach((t) => {
    if (t.dead) return;
    const len = Math.abs(t.fromDir - t.toDir) === 2 ? S : Math.PI * S / 4;
    const speedPx = trainSpeed * 1.5;

    if (t.progress + (speedPx / len) >= 1) {
      const nextTx = t.tx + (t.toDir === 1 ? 1 : t.toDir === 3 ? -1 : 0);
      const nextTy = t.ty + (t.toDir === 2 ? 1 : t.toDir === 0 ? -1 : 0);
      const nextKey = `${nextTx},${nextTy}`;
      const nextTile = sim.grid[nextKey];

      if (nextTile) {
        t.progress += speedPx / len;
      } else {
        t.progress = 0.99;
      }
    } else {
      t.progress += speedPx / len;
    }

    while (t.progress >= 1 && !t.dead) {
      t.progress -= 1;
      const exitDir = t.toDir;
      t.tx += exitDir === 1 ? 1 : exitDir === 3 ? -1 : 0;
      t.ty += exitDir === 2 ? 1 : exitDir === 0 ? -1 : 0;
      t.fromDir = (exitDir + 2) % 4;

      extendTrack(t, sim.grid, cols, rows, sim.queuedTiles, straightness);

      const tile = sim.grid[`${t.tx},${t.ty}`];
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
      if (!last) {
        t.history.unshift(hPos);
      } else {
        const d = Math.hypot(hPos.x - last.x, hPos.y - last.y);
        let distRemaining = d;
        let currX = last.x;
        let currY = last.y;
        let currH = last.heading;
        while (distRemaining >= historyStep) {
          const ratio = Math.min(1, historyStep / distRemaining);
          currX += (hPos.x - currX) * ratio;
          currY += (hPos.y - currY) * ratio;

          let angleDiff = hPos.heading - currH;
          while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
          while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
          currH += angleDiff * ratio;

          t.history.unshift({ x: currX, y: currY, heading: currH });
          distRemaining -= historyStep;
        }
        t.history.unshift(hPos);
      }
      const carSpacingIdx = Math.max(1, Math.floor((S * 0.72) / historyStep));
      const maxLen = t.carsCount * carSpacingIdx + trainQuality.historyTailBuffer;
      if (t.history.length > maxLen) t.history.length = maxLen;
    }
  });

  sim.trains = sim.trains.filter((t) => !t.dead || t.history.length > 0);
  sim.trains.forEach((t) => {
    if (t.dead) {
      t.history.splice(0, Math.ceil((trainSpeed * 1.5) / trainQuality.historyStep));
    }
  });

  ctx.lineCap = 'butt';
  const drawn = new Set<string>();
  Object.entries(sim.grid).forEach(([key, val]) => {
    const tile = val as { conns: Record<number, number> };
    const [txStr, tyStr] = key.split(',');
    const tx = parseInt(txStr);
    const ty = parseInt(tyStr);

    const cell = sim.terrain[key];
    if (cell && (cell.type === 'water' || cell.type === 'lava')) {
      ctx.save();
      ctx.fillStyle = cell.type === 'lava' ? '#3d251d' : '#5a3d28';
      ctx.fillRect(tx * S + S * 0.08, ty * S + S * 0.08, S * 0.84, S * 0.84);
      ctx.strokeStyle = cell.type === 'lava' ? '#291814' : '#3e2616';
      ctx.lineWidth = S * 0.04;
      ctx.strokeRect(tx * S + S * 0.08, ty * S + S * 0.08, S * 0.84, S * 0.84);
      ctx.strokeStyle = cell.type === 'lava' ? 'rgba(0,0,0,0.3)' : 'rgba(255,255,255,0.08)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(tx * S + S * 0.25, ty * S + S * 0.1); ctx.lineTo(tx * S + S * 0.25, ty * S + S * 0.9);
      ctx.moveTo(tx * S + S * 0.5, ty * S + S * 0.1); ctx.lineTo(tx * S + S * 0.5, ty * S + S * 0.9);
      ctx.moveTo(tx * S + S * 0.75, ty * S + S * 0.1); ctx.lineTo(tx * S + S * 0.75, ty * S + S * 0.9);
      ctx.stroke();
      ctx.fillStyle = cell.type === 'lava' ? '#221512' : '#331e11';
      ctx.fillRect(tx * S + S * 0.04, ty * S + S * 0.04, S * 0.12, S * 0.12);
      ctx.fillRect(tx * S + S * 0.84, ty * S + S * 0.04, S * 0.12, S * 0.12);
      ctx.fillRect(tx * S + S * 0.04, ty * S + S * 0.84, S * 0.12, S * 0.12);
      ctx.fillRect(tx * S + S * 0.84, ty * S + S * 0.84, S * 0.12, S * 0.12);
      ctx.restore();
    }

    Object.entries(tile.conns).forEach(([a, b]) => {
      const min = Math.min(+a, +b);
      const max = Math.max(+a, +b);
      const sig = `${tx},${ty}-${min}-${max}`;
      if (drawn.has(sig)) {
        return;
      }

      drawn.add(sig);
      const isStraight = Math.abs(min - max) === 2;

      ctx.beginPath();
      if (isStraight) {
        let x1 = tx * S, y1 = ty * S, x2 = tx * S, y2 = ty * S;
        if (min === 0 || max === 0) { x1 += S / 2; x2 += S / 2; y2 += S; }
        else { y1 += S / 2; y2 += S / 2; x2 += S; }
        ctx.moveTo(x1, y1); ctx.lineTo(x2, y2);
      } else {
        const c = getCurvePath(min, max);
        if (c) ctx.arc((tx + c.cx) * S, (ty + c.cy) * S, S / 2, c.a1, c.a2, c.sweep < 0);
      }
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.45)';
      ctx.lineWidth = S * 0.35;
      ctx.setLineDash([]);
      ctx.stroke();

      ctx.beginPath();
      if (isStraight) {
        let x1 = tx * S, y1 = ty * S, x2 = tx * S, y2 = ty * S;
        if (min === 0 || max === 0) { x1 += S / 2; x2 += S / 2; y2 += S; }
        else { y1 += S / 2; y2 += S / 2; x2 += S; }
        ctx.moveTo(x1, y1); ctx.lineTo(x2, y2);
      } else {
        const c = getCurvePath(min, max);
        if (c) ctx.arc((tx + c.cx) * S, (ty + c.cy) * S, S / 2, c.a1, c.a2, c.sweep < 0);
      }
      ctx.strokeStyle = '#5c3a21';
      ctx.lineWidth = S * 0.28;
      ctx.setLineDash([S * 0.05, S * 0.12]);
      ctx.stroke();

      ctx.beginPath();
      ctx.setLineDash([]);
      ctx.strokeStyle = '#cccccc';
      ctx.lineWidth = S * 0.035;
      const spacing = S * 0.095;
      if (isStraight) {
        if (min === 0 || max === 0) {
          ctx.moveTo(tx * S + S / 2 - spacing, ty * S); ctx.lineTo(tx * S + S / 2 - spacing, ty * S + S);
          ctx.moveTo(tx * S + S / 2 + spacing, ty * S); ctx.lineTo(tx * S + S / 2 + spacing, ty * S + S);
        } else {
          ctx.moveTo(tx * S, ty * S + S / 2 - spacing); ctx.lineTo(tx * S + S, ty * S + S / 2 - spacing);
          ctx.moveTo(tx * S, ty * S + S / 2 + spacing); ctx.lineTo(tx * S + S, ty * S + S / 2 + spacing);
        }
      } else {
        const c = getCurvePath(min, max);
        if (c) {
          ctx.arc((tx + c.cx) * S, (ty + c.cy) * S, Math.abs(S / 2 - spacing), c.a1, c.a2, c.sweep < 0);
          ctx.stroke();
          ctx.beginPath();
          ctx.arc((tx + c.cx) * S, (ty + c.cy) * S, S / 2 + spacing, c.a1, c.a2, c.sweep < 0);
        }
      }
      ctx.stroke();
    });
  });

  const carSpacingIdx = Math.max(1, Math.floor((S * 0.72) / trainQuality.historyStep));

  ctx.save();
  ctx.strokeStyle = '#2d2d2d';
  ctx.lineWidth = S * 0.045;
  ctx.lineCap = 'round';
  sim.trains.forEach((t) => {
    if (t.dead && t.history.length === 0) return;
    for (let i = 1; i < t.carsCount; i++) {
      const idxPrev = (i - 1) * carSpacingIdx;
      const idxNext = i * carSpacingIdx;
      if (idxNext < t.history.length) {
        const posPrev = t.history[idxPrev];
        const posNext = t.history[idxNext];

        const x1 = posPrev.x - Math.cos(posPrev.heading) * S * 0.38;
        const y1 = posPrev.y - Math.sin(posPrev.heading) * S * 0.38;
        const x2 = posNext.x + Math.cos(posNext.heading) * S * 0.38;
        const y2 = posNext.y + Math.sin(posNext.heading) * S * 0.38;

        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();

        ctx.fillStyle = '#1a1a1a';
        ctx.beginPath();
        ctx.arc(x1 + (x2 - x1) * 0.35, y1 + (y2 - y1) * 0.35, S * 0.022, 0, Math.PI * 2);
        ctx.arc(x1 + (x2 - x1) * 0.65, y1 + (y2 - y1) * 0.65, S * 0.022, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  });
  ctx.restore();

  sim.trains.forEach((t) => {
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
