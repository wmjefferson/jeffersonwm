import React, { useState } from 'react';
import { GridConfig, GridOverlayMode } from '../types';
import {
  Search,
  Shuffle,
  Info,
  Upload,
  Palette,
  Grid,
  Maximize2,
  SlidersHorizontal,
  X,
  Layers,
  Check
} from 'lucide-react';

interface ControlToolbarProps {
  config: GridConfig;
  overlayMode: GridOverlayMode;
  searchFilter: string;
  totalImages: number;
  onSetOverlayMode: (mode: GridOverlayMode) => void;
  onSearchChange: (filter: string) => void;
  onRandomSelect: () => void;
  onChangeTargetCount: (count: number) => void;
  onToggleStats: () => void;
  onOpenUpload: () => void;
}

export const ControlToolbar: React.FC<ControlToolbarProps> = ({
  config,
  overlayMode,
  searchFilter,
  totalImages,
  onSetOverlayMode,
  onSearchChange,
  onRandomSelect,
  onChangeTargetCount,
  onToggleStats,
  onOpenUpload,
}) => {
  const [showSettings, setShowSettings] = useState(false);
  const [collapsed, setCollapsed] = useState(true); // Default collapsed for pure white look
  const [customCount, setCustomCount] = useState<string>('9170');

  const handleCustomCountSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const num = parseInt(customCount, 10);
    if (!isNaN(num) && num >= 100 && num <= 100000) {
      onChangeTargetCount(num);
    }
  };

  if (collapsed) {
    return (
      <div className="absolute top-3 right-3 z-40 pointer-events-auto">
        <button
          onClick={() => setCollapsed(false)}
          title="Show Tools & Configuration"
          className="px-3 py-1.5 rounded-full bg-slate-900/80 hover:bg-slate-900 text-slate-300 hover:text-white border border-slate-700/60 backdrop-blur-md shadow-lg text-xs font-mono flex items-center gap-2 transition-all opacity-40 hover:opacity-100"
        >
          <Grid className="w-3.5 h-3.5 text-sky-400" />
          <span>9,170 Blocks Toolbar</span>
        </button>
      </div>
    );
  }

  return (
    <div className="absolute top-4 left-4 right-4 z-40 flex flex-wrap items-center justify-between gap-3 pointer-events-none">
      {/* Left: Brand Badge & Search */}
      <div className="flex items-center gap-3 pointer-events-auto">
        <div className="flex items-center gap-2.5 px-3.5 py-2 bg-slate-900/90 backdrop-blur-xl border border-slate-700/80 rounded-2xl shadow-xl">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-sky-500 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-sky-500/20">
            <Grid className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h1 className="font-bold text-sm text-slate-100 tracking-tight">9,170 Block Grid</h1>
              <span className="px-1.5 py-0.2 rounded bg-sky-500/20 text-sky-300 text-[10px] font-mono border border-sky-500/30">
                LIVE
              </span>
            </div>
            <p className="text-[11px] text-slate-400 font-mono">
              {config.totalBlocks.toLocaleString()} active block previews
            </p>
          </div>
        </div>

        {/* Search Input */}
        <div className="relative w-56 md:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={searchFilter}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search block #, ID, category..."
            className="w-full pl-9 pr-8 py-2 bg-slate-900/90 backdrop-blur-xl border border-slate-700/80 rounded-2xl text-xs text-slate-100 placeholder-slate-400 focus:outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 shadow-xl transition-all"
          />
          {searchFilter && (
            <button
              onClick={() => onSearchChange('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-md text-slate-400 hover:text-slate-200"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Right: Mode Selector & Tools */}
      <div className="flex items-center gap-2 pointer-events-auto">
        {/* Overlay Mode Selector Pills */}
        <div className="hidden lg:flex items-center p-1 bg-slate-900/90 backdrop-blur-xl border border-slate-700/80 rounded-2xl shadow-xl text-xs">
          {[
            { id: 'blank', label: 'Pure White' },
            { id: 'mosaic', label: 'Mosaic Art' },
            { id: 'spectrum', label: 'Spectrum' },
            { id: 'category', label: 'Categories' },
            { id: 'matrix', label: 'Matrix' },
            { id: 'plain', label: 'Raw Colors' },
          ].map((mode) => (
            <button
              key={mode.id}
              onClick={() => onSetOverlayMode(mode.id as GridOverlayMode)}
              className={`px-3 py-1.5 rounded-xl font-medium transition-all ${
                overlayMode === mode.id
                  ? 'bg-sky-600 text-white shadow-md shadow-sky-600/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              {mode.label}
            </button>
          ))}
        </div>

        {/* Quick Actions */}
        <button
          onClick={onRandomSelect}
          title="Jump to Random Image Block"
          className="flex items-center gap-1.5 px-3 py-2 bg-slate-900/90 backdrop-blur-xl border border-slate-700/80 hover:border-slate-600 rounded-2xl text-xs font-medium text-slate-200 hover:bg-slate-800/80 shadow-xl transition-all"
        >
          <Shuffle className="w-3.5 h-3.5 text-sky-400" />
          <span className="hidden sm:inline">Random</span>
        </button>

        <button
          onClick={onOpenUpload}
          title="Upload Custom Image Collection"
          className="flex items-center gap-1.5 px-3 py-2 bg-slate-900/90 backdrop-blur-xl border border-slate-700/80 hover:border-slate-600 rounded-2xl text-xs font-medium text-slate-200 hover:bg-slate-800/80 shadow-xl transition-all"
        >
          <Upload className="w-3.5 h-3.5 text-emerald-400" />
          <span className="hidden sm:inline">Upload</span>
        </button>

        <button
          onClick={() => setShowSettings(!showSettings)}
          title="Grid Configuration & Target Blocks"
          className={`p-2 rounded-2xl border shadow-xl transition-all ${
            showSettings
              ? 'bg-sky-600 text-white border-sky-500'
              : 'bg-slate-900/90 backdrop-blur-xl text-slate-300 border-slate-700/80 hover:bg-slate-800'
          }`}
        >
          <SlidersHorizontal className="w-4 h-4" />
        </button>

        <button
          onClick={onToggleStats}
          title="Toggle Grid Metrics Drawer"
          className="p-2 rounded-2xl bg-slate-900/90 backdrop-blur-xl text-slate-300 border border-slate-700/80 hover:bg-slate-800 shadow-xl transition-all"
        >
          <Info className="w-4 h-4" />
        </button>

        <button
          onClick={() => setCollapsed(true)}
          title="Hide toolbar for clean view"
          className="p-2 rounded-2xl bg-slate-900/90 backdrop-blur-xl text-slate-400 border border-slate-700/80 hover:text-slate-200 shadow-xl transition-all"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Dropdown Settings Panel */}
      {showSettings && (
        <div className="absolute top-16 right-0 w-80 p-4 bg-slate-900/95 backdrop-blur-2xl border border-slate-700/90 rounded-2xl shadow-2xl pointer-events-auto text-slate-100 z-50">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <h3 className="font-semibold text-xs uppercase tracking-wider text-slate-400">
              Grid Configuration
            </h3>
            <button
              onClick={() => setShowSettings(false)}
              className="p-1 text-slate-400 hover:text-slate-200 rounded-md"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="mt-3 space-y-3 text-xs">
            {/* Target Count Quick Buttons */}
            <div>
              <label className="block text-slate-300 mb-1.5 font-medium">Target Block Count</label>
              <div className="grid grid-cols-3 gap-1.5">
                {[9170, 25000, 50000].map((count) => (
                  <button
                    key={count}
                    onClick={() => {
                      onChangeTargetCount(count);
                      setCustomCount(String(count));
                    }}
                    className={`py-1.5 px-2 rounded-xl text-xs font-mono font-medium border transition-colors ${
                      config.targetCount === count
                        ? 'bg-sky-600 text-white border-sky-500'
                        : 'bg-slate-800/80 text-slate-300 border-slate-700 hover:bg-slate-700'
                    }`}
                  >
                    {count.toLocaleString()}
                  </button>
                ))}
              </div>
            </div>

            {/* Custom Target Form */}
            <form onSubmit={handleCustomCountSubmit} className="flex gap-2">
              <input
                type="number"
                min="100"
                max="100000"
                value={customCount}
                onChange={(e) => setCustomCount(e.target.value)}
                placeholder="Custom block count..."
                className="flex-1 px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 font-mono focus:outline-none focus:border-sky-500"
              />
              <button
                type="submit"
                className="px-3 py-1.5 bg-sky-600 hover:bg-sky-500 text-white font-medium rounded-xl text-xs transition-colors"
              >
                Apply
              </button>
            </form>

            {/* Overlay Mode Mobile Selector */}
            <div className="lg:hidden">
              <label className="block text-slate-300 mb-1.5 font-medium">Overlay Color Mode</label>
              <select
                value={overlayMode}
                onChange={(e) => onSetOverlayMode(e.target.value as GridOverlayMode)}
                className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-sky-500"
              >
                <option value="mosaic">Mosaic Masterpiece</option>
                <option value="spectrum">Spectrum Gradient</option>
                <option value="category">Category Map</option>
                <option value="matrix">Cyber Matrix</option>
                <option value="plain">Raw Images</option>
              </select>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
