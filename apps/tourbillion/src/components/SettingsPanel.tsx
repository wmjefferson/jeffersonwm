import { motion } from 'motion/react';
import { Activity, Bird, Code, Pipette, RotateCcw, Stars, TrainFront, X } from 'lucide-react';

import type { Mode, QualityLevel, ResetTrigger } from '../types';

interface SettingsPanelProps {
  mode: Mode;
  show: boolean;
  speed: number;
  size: number;
  trail: number;
  multicolor: boolean;
  quality: QualityLevel;
  trainSpeed: number;
  trackPlacementInterval: number;
  straightness: number;
  resetTrigger: ResetTrigger;
  resetTimeMin: number;
  resetTimeMax: number;
  resetTilesLimit: number;
  onClose: () => void;
  onModeChange: (mode: Mode) => void;
  onSpeedChange: (value: number) => void;
  onSizeChange: (value: number) => void;
  onTrailChange: (value: number) => void;
  onMulticolorToggle: () => void;
  onQualityChange: (value: QualityLevel) => void;
  onTrainSpeedChange: (value: number) => void;
  onTrackPlacementIntervalChange: (value: number) => void;
  onStraightnessChange: (value: number) => void;
  onResetTriggerChange: (value: ResetTrigger) => void;
  onResetTimeMinChange: (value: number) => void;
  onResetTimeMaxChange: (value: number) => void;
  onResetTilesLimitChange: (value: number) => void;
  onTriggerFadeReset: () => void;
  onResetDefaults: () => void;
}

const modeOptions = [
  { id: 'starfield', icon: Stars, label: 'Stars' },
  { id: 'matrix', icon: Code, label: 'Code' },
  { id: 'mystify', icon: Activity, label: 'Vector' },
  { id: 'pipes', icon: Pipette, label: 'Pipes' },
  { id: 'toasters', icon: Bird, label: 'Wings' },
  { id: 'trains', icon: TrainFront, label: 'Trains' },
] as const satisfies ReadonlyArray<{ id: Mode; icon: typeof Stars; label: string }>;

export function SettingsPanel({
  mode,
  show,
  speed,
  size,
  trail,
  multicolor,
  quality,
  trainSpeed,
  trackPlacementInterval,
  straightness,
  resetTrigger,
  resetTimeMin,
  resetTimeMax,
  resetTilesLimit,
  onClose,
  onModeChange,
  onSpeedChange,
  onSizeChange,
  onTrailChange,
  onMulticolorToggle,
  onQualityChange,
  onTrainSpeedChange,
  onTrackPlacementIntervalChange,
  onStraightnessChange,
  onResetTriggerChange,
  onResetTimeMinChange,
  onResetTimeMaxChange,
  onResetTilesLimitChange,
  onTriggerFadeReset,
  onResetDefaults,
}: SettingsPanelProps) {
  if (!show) {
    return null;
  }

  return (
    <motion.div
      initial={{ x: 400, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 400, opacity: 0 }}
      className="absolute top-0 right-0 h-full w-80 bg-zinc-950/90 backdrop-blur-2xl border-l border-white/10 z-[60] p-8 overflow-y-auto"
      id="settings-panel"
    >
      <div className="flex items-center justify-between mb-10">
        <div>
          <h2 className="text-xl font-medium text-white tracking-tight">Tourbillion</h2>
          <p className="text-[10px] text-zinc-500 font-mono mt-1">MODE CONTROL</p>
        </div>
        <button onClick={onClose} className="p-2 text-zinc-400 hover:text-white hover:bg-white/5 rounded-lg transition-all">
          <X size={20} />
        </button>
      </div>

      <div className="space-y-10">
        <div className="space-y-4">
          <span className="text-xs font-mono text-zinc-500 uppercase tracking-widest">Active Mode</span>
          <div className="grid grid-cols-3 gap-2">
            {modeOptions.map((item) => (
              <button
                key={item.id}
                onClick={() => onModeChange(item.id)}
                className={`flex flex-col items-center justify-center p-3 rounded-xl border transition-all ${
                  mode === item.id
                    ? 'bg-white/10 border-white/20 text-white'
                    : 'bg-white/5 border-transparent text-zinc-500 hover:bg-white/10'
                }`}
              >
                <item.icon size={18} />
                <span className="text-[10px] mt-2 font-mono">{item.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-8">
          <div className="space-y-3">
            <div className="flex justify-between text-xs font-mono text-zinc-500 uppercase tracking-widest">
              <span>Quality</span>
              <span className="text-zinc-300">{quality}</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {(['low', 'medium', 'high'] as const).map((qualityOption) => (
                <button
                  key={qualityOption}
                  onClick={() => onQualityChange(qualityOption)}
                  className={`py-2 px-2 rounded-lg border font-mono text-[10px] uppercase transition-all ${
                    quality === qualityOption
                      ? 'bg-white/10 border-white/20 text-white'
                      : 'bg-white/5 border-transparent text-zinc-500 hover:bg-white/10'
                  }`}
                >
                  {qualityOption}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex justify-between text-xs font-mono text-zinc-500 uppercase tracking-widest">
              <span>Performance</span>
              <span className="text-zinc-300">{speed.toFixed(1)}x</span>
            </div>
            <input
              type="range"
              min="0.1"
              max="10"
              step="0.1"
              value={speed}
              onChange={(e) => onSpeedChange(parseFloat(e.target.value))}
              className="w-full h-0.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-white"
            />
          </div>

          <div className="space-y-4">
            <div className="flex justify-between text-xs font-mono text-zinc-500 uppercase tracking-widest">
              <span>Resolution</span>
              <span className="text-zinc-300">{size.toFixed(1)}px</span>
            </div>
            <input
              type="range"
              min="0.5"
              max="10"
              step="0.1"
              value={size}
              onChange={(e) => onSizeChange(parseFloat(e.target.value))}
              className="w-full h-0.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-white"
            />
          </div>

          <div className="space-y-4">
            <div className="flex justify-between text-xs font-mono text-zinc-500 uppercase tracking-widest">
              <span>Ghosting</span>
              <span className="text-zinc-300">{Math.round(trail * 100)}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={trail}
              onChange={(e) => onTrailChange(parseFloat(e.target.value))}
              className="w-full h-0.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-white"
            />
          </div>
        </div>

        {mode === 'trains' && (
          <div className="space-y-6 pt-6 border-t border-white/10" id="trains-config-group">
            <span className="text-xs font-mono text-zinc-500 uppercase tracking-widest block mb-2">Train Settings</span>

            <div className="space-y-3">
              <div className="flex justify-between text-xs font-mono text-zinc-500">
                <span>Train Speed</span>
                <span className="text-zinc-300">{trainSpeed.toFixed(1)}x</span>
              </div>
              <input
                type="range"
                min="0.2"
                max="5.0"
                step="0.1"
                value={trainSpeed}
                onChange={(e) => onTrainSpeedChange(parseFloat(e.target.value))}
                className="w-full h-0.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-white"
              />
            </div>

            <div className="space-y-3">
              <div className="flex justify-between text-xs font-mono text-zinc-500">
                <span>Track Placement Delay</span>
                <span className="text-zinc-300">
                  {trackPlacementInterval === 0 ? 'Instant' : `${trackPlacementInterval}ms`}
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="1000"
                step="50"
                value={trackPlacementInterval}
                onChange={(e) => onTrackPlacementIntervalChange(parseInt(e.target.value))}
                className="w-full h-0.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-white"
              />
            </div>

            <div className="space-y-3">
              <div className="flex justify-between text-xs font-mono text-zinc-500">
                <span>Track Turn Density</span>
                <span className="text-zinc-300">
                  {straightness === 0
                    ? 'Max Curves'
                    : straightness === 1
                      ? 'Max Straights'
                      : `${Math.round(straightness * 100)}% Straight`}
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={straightness}
                onChange={(e) => onStraightnessChange(parseFloat(e.target.value))}
                className="w-full h-0.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-white"
              />
            </div>

            <div className="space-y-3">
              <div className="flex justify-between text-xs font-mono text-zinc-500 mb-2">
                <span>Screen Reset Trigger</span>
              </div>
              <div className="grid grid-cols-3 gap-1">
                {(['time', 'tiles', 'none'] as const).map((triggerType) => (
                  <button
                    key={triggerType}
                    onClick={() => onResetTriggerChange(triggerType)}
                    className={`py-1.5 px-2 rounded font-mono text-[9px] uppercase border transition-all ${
                      resetTrigger === triggerType
                        ? 'bg-white/10 border-white/20 text-white'
                        : 'bg-white/5 border-transparent text-zinc-550 hover:bg-white/10'
                    }`}
                  >
                    {triggerType}
                  </button>
                ))}
              </div>
            </div>

            {resetTrigger === 'time' && (
              <div className="space-y-4 pt-2">
                <div className="space-y-3">
                  <div className="flex justify-between text-[11px] font-mono text-zinc-500">
                    <span>Transition Timer Delay</span>
                    <span className="text-zinc-300">{resetTimeMin}s - {resetTimeMax}s</span>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] text-zinc-600 font-mono w-6">MIN:</span>
                      <input
                        type="range"
                        min="5"
                        max="120"
                        step="5"
                        value={resetTimeMin}
                        onChange={(e) => onResetTimeMinChange(parseInt(e.target.value))}
                        className="flex-1 h-0.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-white"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] text-zinc-600 font-mono w-6">MAX:</span>
                      <input
                        type="range"
                        min={resetTimeMin}
                        max="240"
                        step="5"
                        value={resetTimeMax}
                        onChange={(e) => onResetTimeMaxChange(parseInt(e.target.value))}
                        className="flex-1 h-0.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-white"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {resetTrigger === 'tiles' && (
              <div className="space-y-3 pt-2">
                <div className="flex justify-between text-[11px] font-mono text-zinc-500">
                  <span>Max Tile Connections</span>
                  <span className="text-zinc-300">{resetTilesLimit} tiles</span>
                </div>
                <input
                  type="range"
                  min="20"
                  max="800"
                  step="10"
                  value={resetTilesLimit}
                  onChange={(e) => onResetTilesLimitChange(parseInt(e.target.value))}
                  className="w-full h-0.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-white"
                />
              </div>
            )}

            <div className="pt-2">
              <button
                onClick={onTriggerFadeReset}
                className="w-full py-2 bg-white/5 border border-white/10 hover:bg-white/10 text-white rounded-lg font-mono text-[9px] tracking-widest uppercase transition-colors"
                id="trigger-fade-test-btn"
              >
                Cycle Screen Manually
              </button>
            </div>
          </div>
        )}

        <div className="space-y-3 pt-4">
          <div className="flex items-center justify-between text-xs font-mono text-zinc-500 uppercase tracking-widest">
            <span>Spectral Shift</span>
            <button
              onClick={onMulticolorToggle}
              className={`w-10 h-5 rounded-full transition-all relative ${multicolor ? 'bg-indigo-500' : 'bg-zinc-800'}`}
            >
              <div
                className={`absolute top-1 w-3 h-3 rounded-full transition-all ${multicolor ? 'left-6 bg-white' : 'left-1 bg-zinc-500'}`}
              />
            </button>
          </div>
        </div>

        <div className="pt-8 border-t border-white/5">
          <button
            onClick={onResetDefaults}
            className="w-full flex items-center justify-center gap-2 py-3 text-xs font-mono text-zinc-500 hover:text-white transition-colors"
          >
            <RotateCcw size={14} />
            HARD RESET
          </button>
        </div>
      </div>
    </motion.div>
  );
}
