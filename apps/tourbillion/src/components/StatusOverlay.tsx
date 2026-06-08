import { Monitor } from 'lucide-react';

import type { Mode, QualityLevel } from '../types';

interface StatusOverlayProps {
  mode: Mode;
  quality: QualityLevel;
}

export function StatusOverlay({ mode, quality }: StatusOverlayProps) {
  return (
    <>
      <div className="absolute bottom-10 left-8 right-8 text-center space-y-4">
        <div className="flex items-center justify-center gap-2 text-zinc-700">
          <Monitor size={12} />
          <span className="text-[10px] font-mono tracking-tighter uppercase">Display Loop Stable · {quality}</span>
        </div>
      </div>

      <div className="absolute inset-x-0 bottom-12 z-10 pointer-events-none flex flex-col items-center justify-center gap-2">
        <p className="text-white/5 text-[9px] font-mono tracking-[0.4em] uppercase">
          Tourbillion {mode.substring(0, 3)}_{Math.floor(Math.random() * 999)}
        </p>
        <div className="w-1 h-1 bg-white/10 rounded-full animate-pulse" />
      </div>
    </>
  );
}
