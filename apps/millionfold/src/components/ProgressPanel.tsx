import React from 'react';
import type { JobProgress } from '../App';

interface Props {
  progress: JobProgress;
  errorLog: { path: string; error: string }[];
  showErrors: boolean;
  setShowErrors: (v: boolean) => void;
  onCancel?: () => void;
}

function formatEta(current: number, total: number, startTime: number): string {
  if (current === 0 || total === 0) return '—';
  const elapsed = (Date.now() - startTime) / 1000;
  const rate = current / elapsed;
  const remaining = (total - current) / rate;
  if (!isFinite(remaining) || remaining < 0) return '—';
  const m = Math.floor(remaining / 60);
  const s = Math.floor(remaining % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

export default function ProgressPanel({ progress, errorLog, showErrors, setShowErrors, onCancel }: Props) {
  const startTimeRef = React.useRef<number>(Date.now());
  const [, forceUpdate] = React.useState(0);

  React.useEffect(() => {
    if (progress.phase === 'running') {
      startTimeRef.current = Date.now();
    }
  }, [progress.phase === 'running' && progress.current === 0]);

  React.useEffect(() => {
    if (progress.phase !== 'running') return;
    const t = setInterval(() => forceUpdate(n => n + 1), 1000);
    return () => clearInterval(t);
  }, [progress.phase]);

  if (progress.phase === 'idle') return null;

  const pct = progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0;
  const eta = formatEta(progress.current, progress.total, startTimeRef.current);

  const statusColor =
    progress.phase === 'error' ? 'bg-red-100 border-red-400' :
    progress.phase === 'done' ? 'bg-[#f0f0f0] border-black' :
    'bg-white border-black';

  return (
    <div className={`shrink-0 border-b-[3px] border-black ${statusColor} px-4 py-3`}>
      <div className="flex items-center justify-between mb-2">
        <span className="font-archivo text-[11px] font-bold uppercase tracking-widest">
          {progress.phase === 'running' ? '▶ Processing'
            : progress.phase === 'zipping' ? '⟳ Zipping...'
            : progress.phase === 'done' ? '✓ Done'
            : progress.phase === 'error' ? '✕ Error'
            : ''}
        </span>
        <div className="flex items-center gap-3">
          {progress.phase === 'running' && onCancel && (
            <button
              onClick={onCancel}
              className="font-archivo text-[9px] font-bold uppercase tracking-widest border-[2px] border-red-600 text-red-600 hover:bg-red-600 hover:text-white px-2 py-0.5 transition-colors cursor-pointer"
            >
              Cancel Job
            </button>
          )}
          <span className="font-archivo text-[11px] uppercase tracking-wider">
            <span className="text-green-700 font-bold">✓ {progress.success}</span>
            {progress.errors > 0 && (
              <span className="text-red-600 font-bold ml-2">✕ {progress.errors}</span>
            )}
          </span>
          {progress.errors > 0 && (
            <button
              onClick={() => setShowErrors(!showErrors)}
              className="font-archivo text-[9px] font-bold uppercase tracking-widest border-[2px] border-black px-2 py-0.5 hover:bg-black hover:text-white transition-colors"
            >
              {showErrors ? 'Hide Errors' : 'View Errors'}
            </button>
          )}
        </div>
      </div>

      {progress.phase === 'running' && progress.currentFile && (
        <div className="font-sans text-[10px] text-[#666] truncate mb-1">
          Processing: <span className="font-bold text-black">{progress.currentFile.split(/[\\/]/).pop()}</span>
        </div>
      )}

      {/* Progress bar */}
      <div className="w-full h-2 bg-[#e0e0e0] border border-[#ccc] overflow-hidden mb-1.5">
        <div
          className="h-full bg-black transition-all duration-200"
          style={{ width: `${pct}%` }}
        />
      </div>

      <div className="flex items-center justify-between">
        <span className="font-sans text-[11px] text-[#555]">
          {progress.current.toLocaleString()} / {progress.total.toLocaleString()}
        </span>
        {progress.phase === 'running' && (
          <span className="font-sans text-[11px] text-[#555]">ETA {eta}</span>
        )}
        {progress.phase === 'error' && (
          <span className="font-sans text-[11px] text-red-600">{progress.error_msg}</span>
        )}
      </div>

      {/* Error log */}
      {showErrors && errorLog.length > 0 && (
        <div className="mt-3 border-t-[2px] border-black pt-2 max-h-40 overflow-y-auto">
          {errorLog.map((e, i) => (
            <div key={i} className="mb-1.5">
              <div className="font-archivo text-[9px] uppercase tracking-wider text-red-600 break-all">
                {e.path.split(/[\\/]/).pop()}
              </div>
              <div className="font-sans text-[10px] text-[#666] break-all">{e.error}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
