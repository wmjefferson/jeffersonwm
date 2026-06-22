import React, { useState } from 'react';
import { 
  Play, RotateCcw, AlertTriangle, CheckCircle, 
  Loader2, ChevronRight, ChevronDown, RefreshCw, XCircle
} from 'lucide-react';

interface Props {
  execProgress: {
    current: number;
    total: number;
    filename: string;
    phase: 'idle' | 'running' | 'done' | 'error';
    copied: number;
    moved: number;
    skipped: number;
    errors: any[];
    undo_log_path: string | null;
  };
  undoProgress: {
    current: number;
    total: number;
    filename: string;
    phase: 'idle' | 'running' | 'done' | 'error';
    reversed: number;
    deleted: number;
    errors: any[];
  };
  lastUndoLog: string | null;
  onUndo: (logPath: string) => void;
}

export default function ProgressPanel({ execProgress, undoProgress, lastUndoLog, onUndo }: Props) {
  const [showErrorDetails, setShowErrorDetails] = useState(false);

  const execPercentage = execProgress.total > 0 
    ? Math.round((execProgress.current / execProgress.total) * 100) 
    : 0;

  const undoPercentage = undoProgress.total > 0
    ? Math.round((undoProgress.current / undoProgress.total) * 100)
    : 0;

  const isExecRunning = execProgress.phase === 'running';
  const isUndoRunning = undoProgress.phase === 'running';

  return (
    <div className="space-y-4">
      
      {/* ─── EXECUTION MONITOR ─── */}
      <div className="bg-white border-2 border-black p-3.5 shadow-[2px_2px_0_rgba(0,0,0,1)]">
        <h3 className="font-archivo text-xs font-black uppercase tracking-wider mb-2.5 pb-1 border-b-2 border-black flex items-center justify-between">
          <span>Execution Monitor</span>
          {isExecRunning && <Loader2 className="w-3.5 h-3.5 animate-spin text-black" />}
        </h3>

        {execProgress.phase === 'idle' && !isUndoRunning && (
          <p className="text-xs text-gray-500 italic py-2 text-center">
            System idle. Press "Organize & Rename" to start.
          </p>
        )}

        {isExecRunning && (
          <div className="space-y-2">
            <div className="flex justify-between text-xs font-mono font-bold">
              <span>Progress: {execPercentage}%</span>
              <span>{execProgress.current} / {execProgress.total}</span>
            </div>
            
            {/* Progress bar */}
            <div className="w-full h-4 bg-gray-200 border border-black relative overflow-hidden">
              <div 
                className="h-full bg-[#FFEB3B] border-r border-black transition-all duration-150"
                style={{ width: `${execPercentage}%` }}
              />
            </div>

            <div className="text-[10px] font-mono text-gray-600 truncate pt-1 border-t border-gray-100">
              Active: {execProgress.filename}
            </div>
          </div>
        )}

        {execProgress.phase === 'done' && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-green-700 bg-green-50 border border-green-300 p-2 font-bold text-xs">
              <CheckCircle className="w-4 h-4 shrink-0" />
              <span>Execution completed successfully!</span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-[10px] font-mono bg-gray-50 p-2 border border-gray-200">
              <div>Copied: <span className="font-bold">{execProgress.copied}</span></div>
              <div>Moved: <span className="font-bold">{execProgress.moved}</span></div>
              <div>Skipped: <span className="font-bold">{execProgress.skipped}</span></div>
              <div>Errors: <span className="font-bold text-red-600">{execProgress.errors.length}</span></div>
            </div>

            {execProgress.errors.length > 0 && (
              <div className="border border-red-300 mt-2">
                <button
                  onClick={() => setShowErrorDetails(!showErrorDetails)}
                  className="w-full flex items-center justify-between bg-red-50 text-red-800 text-[10px] font-bold px-2 py-1.5 border-b border-red-300"
                >
                  <span className="flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    Review {execProgress.errors.length} Errors
                  </span>
                  {showErrorDetails ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                </button>
                {showErrorDetails && (
                  <div className="p-2 max-h-32 overflow-y-auto text-[9px] font-mono space-y-1 bg-white select-text">
                    {execProgress.errors.map((err, i) => (
                      <div key={i} className="text-red-600 border-b border-gray-100 pb-1">
                        <span className="font-bold block break-all">{err[0]}</span>
                        <span>{err[1]}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {execProgress.phase === 'error' && (
          <div className="bg-red-50 border border-red-300 p-2 text-red-700 space-y-1">
            <div className="flex items-center gap-1.5 text-xs font-bold">
              <XCircle className="w-4 h-4" />
              <span>Execution Failed</span>
            </div>
            <p className="text-[10px] font-mono break-all leading-tight">{execProgress.filename}</p>
          </div>
        )}
      </div>

      {/* ─── UNDO OPERATIONS ─── */}
      {lastUndoLog && !isExecRunning && !isUndoRunning && (
        <div className="bg-[#FFF8E1] border-2 border-black p-3.5 shadow-[2px_2px_0_rgba(0,0,0,1)] space-y-3">
          <div className="flex items-center gap-1.5 text-amber-900">
            <RotateCcw className="w-4 h-4" />
            <span className="font-archivo text-xs font-black uppercase tracking-wider">Undo Last Action</span>
          </div>
          <p className="text-[10px] text-amber-800 leading-tight">
            An execution operation was completed. You can reverse all copies or moves cleanly.
          </p>
          
          <button
            onClick={() => onUndo(lastUndoLog)}
            className="w-full flex items-center justify-center gap-1.5 bg-amber-600 text-white border-2 border-black font-archivo text-xs font-bold uppercase tracking-wider py-1.5 shadow-[2px_2px_0_rgba(0,0,0,1)] hover:bg-amber-700 active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reverse Operation
          </button>
        </div>
      )}

      {/* ─── UNDO MONITOR ─── */}
      {isUndoRunning && (
        <div className="bg-white border-2 border-black p-3.5 shadow-[2px_2px_0_rgba(0,0,0,1)] space-y-3">
          <h3 className="font-archivo text-xs font-black uppercase tracking-wider border-b-2 border-black pb-1.5 flex items-center justify-between">
            <span>Undoing Changes</span>
            <Loader2 className="w-3.5 h-3.5 animate-spin text-black" />
          </h3>
          <div className="space-y-2">
            <div className="flex justify-between text-xs font-mono font-bold">
              <span>Progress: {undoPercentage}%</span>
              <span>{undoProgress.current} / {undoProgress.total}</span>
            </div>
            
            <div className="w-full h-4 bg-gray-200 border border-black relative overflow-hidden">
              <div 
                className="h-full bg-amber-500 border-r border-black transition-all duration-150"
                style={{ width: `${undoPercentage}%` }}
              />
            </div>

            <div className="text-[10px] font-mono text-gray-600 truncate pt-1">
              Reversing: {undoProgress.filename}
            </div>
          </div>
        </div>
      )}

      {undoProgress.phase === 'done' && (
        <div className="bg-green-50 border border-green-300 p-3 text-green-800 space-y-1.5">
          <div className="flex items-center gap-1.5 text-xs font-bold">
            <CheckCircle className="w-4 h-4" />
            <span>Undo Process Finished</span>
          </div>
          <div className="text-[10px] font-mono leading-relaxed">
            <div>Reversed moves: <span className="font-bold">{undoProgress.reversed}</span></div>
            <div>Cleaned copies: <span className="font-bold">{undoProgress.deleted}</span></div>
            <div>Errors: <span className="font-bold text-red-600">{undoProgress.errors.length}</span></div>
          </div>
        </div>
      )}
    </div>
  );
}
