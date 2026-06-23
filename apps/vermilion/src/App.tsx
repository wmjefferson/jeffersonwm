import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Folder, FolderOpen, RefreshCw, AlertCircle, Play, 
  RotateCcw, ArrowRight, Settings, Plus, Trash2, 
  Save, Trash, FileText, ChevronRight, ChevronDown, 
  X, Check, Info, LayoutGrid, ListFilter, SlidersHorizontal, Image as ImageIcon
} from 'lucide-react';
import LeftPanel from './components/LeftPanel';
import RulesPanel from './components/RulesPanel';
import PreviewTree from './components/PreviewTree';
import ProgressPanel from './components/ProgressPanel';
import BrowseModal from './components/BrowseModal';

export interface RenameRule {
  id: string;
  type: 'original' | 'text' | 'date' | 'sequence';
  value: string;
  padding?: number;
  enabled: boolean;
}

export interface FilterConfig {
  id: string;
  kind: 'extension' | 'size' | 'date';
  action: 'ignore' | 'move';
  folder_name: string;
  extensions: string[];
  size_mode: 'above' | 'below' | 'between';
  size_min: number;
  size_max: number;
  date_field: 'modified' | 'created';
  date_mode: 'before' | 'after' | 'between';
  date_from: string;
  date_to: string;
  enabled: boolean;
}

export interface PlannedFile {
  source_path: string;
  original_name: string;
  new_name: string;
  destination_dir: string;
}

export interface PlannedFolder {
  display_name: string;
  path: string;
  files: PlannedFile[];
  children: PlannedFolder[];
}

export interface Plan {
  root_path: string;
  folders: PlannedFolder[];
  non_image_folder: PlannedFolder | null;
  filter_folders: PlannedFolder[];
  total_images: number;
  total_non_images: number;
  total_filtered: number;
  total_folders: number;
}

export interface Preset {
  name: string;
  config: any;
}

export default function App() {
  // Navigation tabs in left panel
  const [activeTab, setActiveTab] = useState<'config' | 'rename' | 'filters' | 'presets'>('config');

  // Input & Output config
  const [sourceDir, setSourceDir] = useState<string>('');
  const [destDir, setDestDir] = useState<string>('');
  const [recursive, setRecursive] = useState<boolean>(true);
  
  // Scanning state
  const [scanning, setScanning] = useState<boolean>(false);
  const [scanResult, setScanResult] = useState<{
    images_count: number;
    non_images_count: number;
    total_count: number;
    folder: string;
  } | null>(null);

  // Sorting & Distribution config
  const [sortBy, setSortBy] = useState<'char' | 'full' | 'date_modified_day' | 'date_modified_month' | 'date_modified_year' | 'date_created_day' | 'date_created_month' | 'date_created_year'>('char');
  const [charCount, setCharCount] = useState<number>(1);
  const [distMode, setDistMode] = useState<'max_per_folder' | 'num_folders' | 'exact_per_folder' | 'group_by_date' | 'group_by_name'>('max_per_folder');
  const [distCount, setDistCount] = useState<number>(50);
  const [structure, setStructure] = useState<'flat' | 'nested'>('flat');
  const [appendRange, setAppendRange] = useState<boolean>(true);

  // Rename components rules
  const [renameRules, setRenameRules] = useState<RenameRule[]>([
    { id: 'r-1', type: 'original', value: '', enabled: true },
    { id: 'r-2', type: 'text', value: '_', enabled: true },
    { id: 'r-3', type: 'sequence', value: '1', padding: 3, enabled: true }
  ]);
  const [separator, setSeparator] = useState<string>('_');

  // Filters config
  const [filters, setFilters] = useState<FilterConfig[]>([]);

  // Presets state
  const [presets, setPresets] = useState<Record<string, any>>({});
  const [newPresetName, setNewPresetName] = useState<string>('');

  // Browse Directory Modal state
  const [browseTarget, setBrowseTarget] = useState<'source' | 'dest' | null>(null);

  // Plan Preview state
  const [plan, setPlan] = useState<Plan | null>(null);
  const [planning, setPlanning] = useState<boolean>(false);
  const [planError, setPlanError] = useState<string | null>(null);



  // Execution state
  const [execMode, setExecMode] = useState<'copy' | 'move'>('copy');
  const [conflictStrategy, setConflictStrategy] = useState<'skip' | 'overwrite' | 'auto_rename'>('skip');
  const [execProgress, setExecProgress] = useState<{
    current: number;
    total: number;
    filename: string;
    phase: 'idle' | 'running' | 'done' | 'error';
    copied: number;
    moved: number;
    skipped: number;
    errors: any[];
    undo_log_path: string | null;
  }>({
    current: 0, total: 0, filename: '', phase: 'idle', 
    copied: 0, moved: 0, skipped: 0, errors: [], undo_log_path: null
  });

  // Undo state
  const [undoProgress, setUndoProgress] = useState<{
    current: number;
    total: number;
    filename: string;
    phase: 'idle' | 'running' | 'done' | 'error';
    reversed: number;
    deleted: number;
    errors: any[];
  }>({
    current: 0, total: 0, filename: '', phase: 'idle',
    reversed: 0, deleted: 0, errors: []
  });

  const [lastUndoLog, setLastUndoLog] = useState<string | null>(null);
  const esRef = useRef<EventSource | null>(null);

  // Load presets on mount
  useEffect(() => {
    fetchPresets();
  }, []);

  const fetchPresets = async () => {
    try {
      const res = await fetch('/api/presets');
      const data = await res.json();
      if (data.presets) {
        setPresets(data.presets);
      }
    } catch (e) {
      console.error('Failed to fetch presets', e);
    }
  };

  const handleSavePreset = async () => {
    const name = newPresetName.trim();
    if (!name) return;
    const config = {
      sortBy, charCount, distMode, distCount, structure, appendRange,
      renameRules, separator, filters, recursive
    };
    try {
      const res = await fetch('/api/presets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'save', name, config })
      });
      const data = await res.json();
      if (data.ok) {
        setNewPresetName('');
        fetchPresets();
      } else {
        alert('Error saving preset: ' + data.error);
      }
    } catch (e) {
      alert('Error saving preset');
    }
  };

  const handleDeletePreset = async (name: string) => {
    if (!confirm(`Are you sure you want to delete preset "${name}"?`)) return;
    try {
      const res = await fetch('/api/presets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete', name })
      });
      const data = await res.json();
      if (data.ok) {
        fetchPresets();
      }
    } catch (e) {
      alert('Error deleting preset');
    }
  };

  const handleApplyPreset = (name: string) => {
    const p = presets[name];
    if (!p) return;
    if (p.sortBy !== undefined) setSortBy(p.sortBy);
    if (p.charCount !== undefined) setCharCount(p.charCount);
    if (p.distMode !== undefined) setDistMode(p.distMode);
    if (p.distCount !== undefined) setDistCount(p.distCount);
    if (p.structure !== undefined) setStructure(p.structure);
    if (p.appendRange !== undefined) setAppendRange(p.appendRange);
    if (p.renameRules !== undefined) setRenameRules(p.renameRules);
    if (p.separator !== undefined) setSeparator(p.separator);
    if (p.filters !== undefined) setFilters(p.filters);
    if (p.recursive !== undefined) setRecursive(p.recursive);
  };

  // Scan folder
  const handleScan = async () => {
    if (!sourceDir.trim()) return;
    setScanning(true);
    setScanResult(null);
    try {
      const params = new URLSearchParams({
        folder: sourceDir,
        recursive: String(recursive)
      });
      const res = await fetch(`/api/scan?${params}`);
      const data = await res.json();
      if (res.ok) {
        setScanResult(data);
      } else {
        alert(data.error || 'Failed to scan directory');
      }
    } catch (e) {
      alert('Error scanning directory');
    } finally {
      setScanning(false);
    }
  };

  // Generate Plan
  const handlePlan = async () => {
    if (!sourceDir.trim() || !destDir.trim()) return;
    setPlanning(true);
    setPlan(null);
    setPlanError(null);
    
    const config = {
      source_dir: sourceDir,
      dest_dir: destDir,
      sort_by: sortBy,
      char_count: charCount,
      distribution_mode: distMode,
      distribution_count: distCount,
      structure,
      append_range: appendRange,
      recursive,
      rename_rules: renameRules,
      separator,
      filters
    };

    try {
      const res = await fetch('/api/plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config)
      });
      const data = await res.json();
      if (res.ok) {
        setPlan(data);
      } else {
        setPlanError(data.error || 'Failed to generate plan');
      }
    } catch (e: any) {
      setPlanError(e.message || 'Error generating organization plan');
    } finally {
      setPlanning(false);
    }
  };

  // Execute Plan
  const handleExecute = async () => {
    if (!sourceDir.trim() || !destDir.trim() || planning) return;

    const config = {
      source_dir: sourceDir,
      dest_dir: destDir,
      sort_by: sortBy,
      char_count: charCount,
      distribution_mode: distMode,
      distribution_count: distCount,
      structure,
      append_range: appendRange,
      recursive,
      rename_rules: renameRules,
      separator,
      filters
    };

    setExecProgress({
      current: 0, total: 0, filename: '', phase: 'running',
      copied: 0, moved: 0, skipped: 0, errors: [], undo_log_path: null
    });

    try {
      const res = await fetch('/api/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          config,
          mode: execMode,
          conflict: conflictStrategy
        })
      });
      const data = await res.json();
      if (!res.ok || !data.job_id) {
        setExecProgress(p => ({
          ...p,
          phase: 'error',
          filename: data.error || 'Failed to initiate execution'
        }));
        return;
      }

      const jobId = data.job_id;
      if (esRef.current) esRef.current.close();

      const es = new EventSource(`/api/progress/${jobId}`);
      esRef.current = es;

      es.onmessage = (e) => {
        const evt = JSON.parse(e.data);
        if (evt.type === 'progress') {
          setExecProgress(p => ({
            ...p,
            current: evt.current,
            total: evt.total,
            filename: evt.filename
          }));
        } else if (evt.type === 'done') {
          setExecProgress(p => ({
            ...p,
            phase: 'done',
            copied: evt.copied,
            moved: evt.moved,
            skipped: evt.skipped,
            errors: evt.errors || [],
            undo_log_path: evt.undo_log_path
          }));
          if (evt.undo_log_path) {
            setLastUndoLog(evt.undo_log_path);
          }
          es.close();
          handleScan(); // Rescan source directory
        } else if (evt.type === 'error') {
          setExecProgress(p => ({
            ...p,
            phase: 'error',
            filename: evt.error
          }));
          es.close();
        }
      };

      es.onerror = () => {
        setExecProgress(p => ({
          ...p,
          phase: 'error',
          filename: 'Connection interrupted'
        }));
        es.close();
      };
    } catch (e: any) {
      setExecProgress(p => ({
        ...p,
        phase: 'error',
        filename: e.message || 'Execution error'
      }));
    }
  };

  // Undo Last
  const handleUndo = async (logPath: string) => {
    if (undoProgress.phase === 'running') return;

    setUndoProgress({
      current: 0, total: 0, filename: '', phase: 'running',
      reversed: 0, deleted: 0, errors: []
    });

    try {
      const res = await fetch('/api/undo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ undo_log_path: logPath })
      });
      const data = await res.json();
      if (!res.ok || !data.job_id) {
        setUndoProgress(p => ({
          ...p,
          phase: 'error',
          filename: data.error || 'Failed to start undo process'
        }));
        return;
      }

      const jobId = data.job_id;
      if (esRef.current) esRef.current.close();

      const es = new EventSource(`/api/progress/${jobId}`);
      esRef.current = es;

      es.onmessage = (e) => {
        const evt = JSON.parse(e.data);
        if (evt.type === 'progress') {
          setUndoProgress(p => ({
            ...p,
            current: evt.current,
            total: evt.total,
            filename: evt.filename
          }));
        } else if (evt.type === 'done') {
          setUndoProgress(p => ({
            ...p,
            phase: 'done',
            reversed: evt.reversed,
            deleted: evt.deleted,
            errors: evt.errors || []
          }));
          setLastUndoLog(null);
          es.close();
          handleScan(); // Rescan
          handlePlan(); // Re-plan to show restored state
        } else if (evt.type === 'error') {
          setUndoProgress(p => ({
            ...p,
            phase: 'error',
            filename: evt.error
          }));
          es.close();
        }
      };

      es.onerror = () => {
        setUndoProgress(p => ({
          ...p,
          phase: 'error',
          filename: 'Connection interrupted'
        }));
        es.close();
      };
    } catch (e: any) {
      setUndoProgress(p => ({
        ...p,
        phase: 'error',
        filename: e.message || 'Undo process failed'
      }));
    }
  };

  const selectFolder = (path: string) => {
    if (browseTarget === 'source') {
      setSourceDir(path);
    } else if (browseTarget === 'dest') {
      setDestDir(path);
    }
    setBrowseTarget(null);
  };

  return (
    <div className="flex flex-col h-screen bg-[#F0F0F0] overflow-hidden select-none text-black">
      {/* Header Bar */}
      <header className="bg-white border-b-[3px] border-black shrink-0 h-10 px-4 flex items-center justify-between shadow-[0_2px_0_rgba(0,0,0,1)] z-10">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-red-600 border border-black shadow-[1px_1px_0_rgba(0,0,0,1)]"></div>
          <h1 className="font-archivo text-[15px] uppercase tracking-wider font-extrabold">Vermilion</h1>
          <span className="text-[10px] bg-black text-white px-1.5 py-0.5 rounded font-mono font-bold tracking-tight">v1.3.0 Web</span>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handlePlan}
            disabled={!sourceDir || !destDir || planning || execProgress.phase === 'running'}
            className="flex items-center gap-1.5 bg-[#FFF] text-black border-2 border-black font-archivo text-xs font-bold uppercase tracking-wider px-3.5 py-1 shadow-[2px_2px_0_rgba(0,0,0,1)] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[1px_1px_0_rgba(0,0,0,1)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none disabled:opacity-40 disabled:pointer-events-none transition-all"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${planning ? 'animate-spin' : ''}`} />
            Dry-Run Plan
          </button>

          <button
            onClick={handleExecute}
            disabled={!plan || planning || execProgress.phase === 'running'}
            className="flex items-center gap-1.5 bg-black text-white border-2 border-black font-archivo text-xs font-bold uppercase tracking-wider px-3.5 py-1 shadow-[2px_2px_0_rgba(0,0,0,1)] hover:bg-[#222] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[1px_1px_0_rgba(0,0,0,1)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none disabled:opacity-40 disabled:pointer-events-none transition-all"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            Organize & Rename
          </button>
        </div>
      </header>

      {/* Main Workspace split */}
      <div className="flex flex-1 overflow-hidden">
        
        {/* Left Side Panels - Configuration and Rules */}
        <aside className="w-[390px] shrink-0 border-r-[3px] border-black flex flex-col bg-[#EDEDED] overflow-hidden">
          {/* Tab buttons */}
          <nav className="flex border-b-[2px] border-black bg-white shrink-0">
            <button
              onClick={() => setActiveTab('config')}
              className={`flex-1 font-archivo text-[11px] font-black uppercase tracking-wider py-2 border-r border-black flex items-center justify-center gap-1.5 transition-colors ${
                activeTab === 'config' ? 'bg-[#FFEB3B] text-black' : 'hover:bg-gray-100 text-gray-700'
              }`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-current" />
              Options
            </button>
            <button
              onClick={() => setActiveTab('rename')}
              className={`flex-1 font-archivo text-[11px] font-black uppercase tracking-wider py-2 border-r border-black flex items-center justify-center gap-1.5 transition-colors ${
                activeTab === 'rename' ? 'bg-[#FFEB3B] text-black' : 'hover:bg-gray-100 text-gray-700'
              }`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5 rotate-90 text-current" />
              Naming
            </button>
            <button
              onClick={() => setActiveTab('filters')}
              className={`flex-1 font-archivo text-[11px] font-black uppercase tracking-wider py-2 border-r border-black flex items-center justify-center gap-1.5 transition-colors ${
                activeTab === 'filters' ? 'bg-[#FFEB3B] text-black' : 'hover:bg-gray-100 text-gray-700'
              }`}
            >
              <ListFilter className="w-3.5 h-3.5 text-current" />
              Filters
            </button>
            <button
              onClick={() => setActiveTab('presets')}
              className={`flex-1 font-archivo text-[11px] font-black uppercase tracking-wider py-2 flex items-center justify-center gap-1.5 transition-colors ${
                activeTab === 'presets' ? 'bg-[#FFEB3B] text-black' : 'hover:bg-gray-100 text-gray-700'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5 text-current" />
              Presets
            </button>
          </nav>

          {/* Tab content area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {activeTab === 'config' && (
              <LeftPanel
                sortBy={sortBy}
                setSortBy={setSortBy}
                charCount={charCount}
                setCharCount={setCharCount}
                distMode={distMode}
                setDistMode={setDistMode}
                distCount={distCount}
                setDistCount={setDistCount}
                structure={structure}
                setStructure={setStructure}
                appendRange={appendRange}
                setAppendRange={setAppendRange}
              />
            )}

            {activeTab === 'rename' && (
              <RulesPanel
                rules={renameRules}
                setRules={setRenameRules}
                separator={separator}
                setSeparator={setSeparator}
              />
            )}

            {activeTab === 'filters' && (
              <div className="space-y-4">
                <div className="bg-white border-2 border-black p-3.5 shadow-[2px_2px_0_rgba(0,0,0,1)]">
                  <div className="flex items-center justify-between mb-2 pb-1.5 border-b border-gray-200">
                    <h3 className="font-archivo text-xs font-black uppercase tracking-wider flex items-center gap-1.5">
                      <ListFilter className="w-3.5 h-3.5 text-red-600" />
                      Active Filters
                    </h3>
                    <button
                      onClick={() => {
                        const newF: FilterConfig = {
                          id: 'f-' + Date.now(),
                          kind: 'extension',
                          action: 'ignore',
                          folder_name: 'RAW_Files',
                          extensions: ['.nef', '.cr2', '.dng'],
                          size_mode: 'above',
                          size_min: 10,
                          size_max: 100,
                          date_field: 'modified',
                          date_mode: 'before',
                          date_from: new Date().toISOString().split('T')[0],
                          date_to: new Date().toISOString().split('T')[0],
                          enabled: true
                        };
                        setFilters([...filters, newF]);
                      }}
                      className="flex items-center gap-0.5 bg-black text-white text-[10px] font-bold uppercase tracking-wider px-2 py-0.5"
                    >
                      <Plus className="w-3 h-3" /> Add
                    </button>
                  </div>

                  {filters.length === 0 ? (
                    <p className="text-xs text-gray-500 italic py-4 text-center">
                      No active filters. All scanned files will be distributed.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {filters.map((f, idx) => (
                        <div key={f.id} className="border border-black p-2.5 bg-gray-50 relative">
                          <button
                            onClick={() => setFilters(filters.filter(x => x.id !== f.id))}
                            className="absolute top-2 right-2 text-gray-400 hover:text-black"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>

                          <div className="flex items-center gap-2 mb-2">
                            <input
                              type="checkbox"
                              checked={f.enabled}
                              onChange={(e) => {
                                const newFs = [...filters];
                                newFs[idx].enabled = e.target.checked;
                                setFilters(newFs);
                              }}
                              className="w-3.5 h-3.5 border-black accent-black rounded-none"
                            />
                            <select
                              value={f.kind}
                              onChange={(e) => {
                                const newFs = [...filters];
                                newFs[idx].kind = e.target.value as any;
                                setFilters(newFs);
                              }}
                              className="text-xs border border-black px-1 py-0.5 bg-white font-bold"
                            >
                              <option value="extension">Extension</option>
                              <option value="size">File Size</option>
                              <option value="date">Date Block</option>
                            </select>

                            <select
                              value={f.action}
                              onChange={(e) => {
                                const newFs = [...filters];
                                newFs[idx].action = e.target.value as any;
                                setFilters(newFs);
                              }}
                              className="text-xs border border-black px-1 py-0.5 bg-white font-bold"
                            >
                              <option value="ignore">Ignore/Skip</option>
                              <option value="move">Move To Folder</option>
                            </select>
                          </div>

                          {f.action === 'move' && (
                            <div className="mb-2">
                              <label className="text-[10px] font-bold uppercase tracking-wider block mb-1">Target Folder Name</label>
                              <input
                                type="text"
                                value={f.folder_name}
                                onChange={(e) => {
                                  const newFs = [...filters];
                                  newFs[idx].folder_name = e.target.value;
                                  setFilters(newFs);
                                }}
                                className="w-full text-xs border border-black px-2 py-1 bg-white font-mono"
                                placeholder="e.g. RAW_Files"
                              />
                            </div>
                          )}

                          {f.kind === 'extension' && (
                            <div>
                              <label className="text-[10px] font-bold uppercase tracking-wider block mb-1">Extensions (comma separated)</label>
                              <input
                                type="text"
                                value={f.extensions.join(', ')}
                                onChange={(e) => {
                                  const newFs = [...filters];
                                  newFs[idx].extensions = e.target.value.split(',').map(s => s.trim().toLowerCase()).filter(s => s.startsWith('.'));
                                  setFilters(newFs);
                                }}
                                className="w-full text-xs border border-black px-2 py-1 bg-white font-mono"
                                placeholder="e.g. .nef, .cr2, .txt"
                              />
                            </div>
                          )}

                          {f.kind === 'size' && (
                            <div className="space-y-2">
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] font-bold">Mode:</span>
                                <select
                                  value={f.size_mode}
                                  onChange={(e) => {
                                    const newFs = [...filters];
                                    newFs[idx].size_mode = e.target.value as any;
                                    setFilters(newFs);
                                  }}
                                  className="text-xs border border-black px-1 py-0.5 bg-white"
                                >
                                  <option value="above">Above</option>
                                  <option value="below">Below</option>
                                  <option value="between">Between</option>
                                </select>
                              </div>
                              <div className="flex items-center gap-1">
                                {(f.size_mode === 'above' || f.size_mode === 'between') && (
                                  <input
                                    type="number"
                                    value={f.size_min}
                                    onChange={(e) => {
                                      const newFs = [...filters];
                                      newFs[idx].size_min = parseInt(e.target.value) || 0;
                                      setFilters(newFs);
                                    }}
                                    className="w-20 text-xs border border-black px-1.5 py-0.5 bg-white font-mono"
                                    placeholder="Min MB"
                                  />
                                )}
                                {f.size_mode === 'between' && <span className="text-xs font-bold">to</span>}
                                {(f.size_mode === 'below' || f.size_mode === 'between') && (
                                  <input
                                    type="number"
                                    value={f.size_max}
                                    onChange={(e) => {
                                      const newFs = [...filters];
                                      newFs[idx].size_max = parseInt(e.target.value) || 0;
                                      setFilters(newFs);
                                    }}
                                    className="w-20 text-xs border border-black px-1.5 py-0.5 bg-white font-mono"
                                    placeholder="Max MB"
                                  />
                                )}
                                <span className="text-[10px] font-bold">Bytes</span>
                              </div>
                            </div>
                          )}

                          {f.kind === 'date' && (
                            <div className="space-y-2">
                              <div className="flex items-center gap-3">
                                <select
                                  value={f.date_field}
                                  onChange={(e) => {
                                    const newFs = [...filters];
                                    newFs[idx].date_field = e.target.value as any;
                                    setFilters(newFs);
                                  }}
                                  className="text-xs border border-black px-1 py-0.5 bg-white"
                                >
                                  <option value="modified">Modified</option>
                                  <option value="created">Created</option>
                                </select>
                                <select
                                  value={f.date_mode}
                                  onChange={(e) => {
                                    const newFs = [...filters];
                                    newFs[idx].date_mode = e.target.value as any;
                                    setFilters(newFs);
                                  }}
                                  className="text-xs border border-black px-1 py-0.5 bg-white"
                                >
                                  <option value="before">Before</option>
                                  <option value="after">After</option>
                                  <option value="between">Between</option>
                                </select>
                              </div>
                              <div className="flex flex-col gap-1.5">
                                <input
                                  type="date"
                                  value={f.date_from}
                                  onChange={(e) => {
                                    const newFs = [...filters];
                                    newFs[idx].date_from = e.target.value;
                                    setFilters(newFs);
                                  }}
                                  className="text-xs border border-black px-1.5 py-0.5 bg-white font-mono"
                                />
                                {f.date_mode === 'between' && (
                                  <>
                                    <span className="text-[10px] font-bold text-center">and</span>
                                    <input
                                      type="date"
                                      value={f.date_to}
                                      onChange={(e) => {
                                        const newFs = [...filters];
                                        newFs[idx].date_to = e.target.value;
                                        setFilters(newFs);
                                      }}
                                      className="text-xs border border-black px-1.5 py-0.5 bg-white font-mono"
                                    />
                                  </>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'presets' && (
              <div className="space-y-4">
                <div className="bg-white border-2 border-black p-3.5 shadow-[2px_2px_0_rgba(0,0,0,1)]">
                  <h3 className="font-archivo text-xs font-black uppercase tracking-wider mb-2.5 pb-1 border-b border-gray-200">Save Preset</h3>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newPresetName}
                      onChange={(e) => setNewPresetName(e.target.value)}
                      placeholder="e.g. Standard_Renamer"
                      className="flex-1 text-xs border-2 border-black px-2 py-1 bg-white font-mono"
                    />
                    <button
                      onClick={handleSavePreset}
                      disabled={!newPresetName.trim()}
                      className="bg-black text-white font-archivo text-xs font-bold uppercase tracking-wider px-3.5 py-1 border-2 border-black shadow-[1.5px_1.5px_0_rgba(0,0,0,1)] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none disabled:opacity-40 disabled:pointer-events-none transition-all"
                    >
                      Save
                    </button>
                  </div>
                </div>

                <div className="bg-white border-2 border-black p-3.5 shadow-[2px_2px_0_rgba(0,0,0,1)]">
                  <h3 className="font-archivo text-xs font-black uppercase tracking-wider mb-2 pb-1 border-b border-gray-200">Load Preset</h3>
                  {Object.keys(presets).length === 0 ? (
                    <p className="text-xs text-gray-500 italic py-2 text-center">No saved presets found.</p>
                  ) : (
                    <div className="space-y-2">
                      {Object.keys(presets).map(name => (
                        <div key={name} className="flex items-center justify-between border border-black p-2 bg-gray-50 hover:bg-[#FFFDE7] transition-colors">
                          <button
                            onClick={() => handleApplyPreset(name)}
                            className="flex-1 text-left text-xs font-mono font-bold truncate"
                          >
                            {name}
                          </button>
                          <button
                            onClick={() => handleDeletePreset(name)}
                            className="text-gray-400 hover:text-red-600 transition-colors ml-2"
                          >
                            <Trash className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Scanning / Disk info indicator */}
          {scanResult && (
            <div className="bg-white border-t-2 border-black p-3 text-xs shrink-0 space-y-1 font-mono">
              <div className="flex justify-between font-bold text-gray-800 border-b border-gray-200 pb-1 mb-1">
                <span>SCANNED COLLECTION:</span>
                <span className="text-red-600">{scanResult.total_count} files</span>
              </div>
              <div className="flex justify-between text-gray-600 text-[11px]">
                <span>Images:</span>
                <span>{scanResult.images_count}</span>
              </div>
              <div className="flex justify-between text-gray-600 text-[11px]">
                <span>Non-Images:</span>
                <span>{scanResult.non_images_count}</span>
              </div>
            </div>
          )}
        </aside>

        {/* Right Side - Folder Selector, Preview Tree, Image previewer, and Progress logs */}
        <main className="flex-1 flex flex-col overflow-hidden bg-[#F0F0F0]">
          
          {/* Top Folder Selection Area */}
          <section className="bg-white border-b-[3px] border-black p-4 shrink-0 shadow-[0_2px_0_rgba(0,0,0,0.05)] space-y-3">
            <div className="grid grid-cols-2 gap-4">
              {/* Source directory */}
              <div className="space-y-1">
                <label className="text-[10px] font-extrabold uppercase tracking-wider text-gray-600 flex items-center gap-1.5">
                  <FolderOpen className="w-3.5 h-3.5 text-black" />
                  Source Directory
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={sourceDir}
                    onChange={(e) => setSourceDir(e.target.value)}
                    placeholder="E:\Unsorted_Images"
                    className="flex-1 text-xs border-2 border-black px-2.5 py-1.5 bg-[#FCFCFC] font-mono shadow-[inset_1px_1.5px_3px_rgba(0,0,0,0.15)]"
                  />
                  <button
                    onClick={() => setBrowseTarget('source')}
                    className="bg-[#FFF] text-black border-2 border-black font-archivo text-xs font-bold uppercase px-3 py-1 shadow-[2px_2px_0_rgba(0,0,0,1)] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[1px_1px_0_rgba(0,0,0,1)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"
                  >
                    Browse...
                  </button>
                  <button
                    onClick={handleScan}
                    disabled={!sourceDir || scanning}
                    className="bg-black text-white border-2 border-black font-archivo text-xs font-bold px-3 py-1 shadow-[2px_2px_0_rgba(0,0,0,1)] hover:bg-[#222] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[1px_1px_0_rgba(0,0,0,1)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none disabled:opacity-40"
                  >
                    {scanning ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : 'Scan'}
                  </button>
                </div>
              </div>

              {/* Destination directory */}
              <div className="space-y-1">
                <label className="text-[10px] font-extrabold uppercase tracking-wider text-gray-600 flex items-center gap-1.5">
                  <Folder className="w-3.5 h-3.5 text-black" />
                  Destination Directory
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={destDir}
                    onChange={(e) => setDestDir(e.target.value)}
                    placeholder="E:\Organized_Library"
                    className="flex-1 text-xs border-2 border-black px-2.5 py-1.5 bg-[#FCFCFC] font-mono shadow-[inset_1px_1.5px_3px_rgba(0,0,0,0.15)]"
                  />
                  <button
                    onClick={() => setBrowseTarget('dest')}
                    className="bg-[#FFF] text-black border-2 border-black font-archivo text-xs font-bold uppercase px-3 py-1 shadow-[2px_2px_0_rgba(0,0,0,1)] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[1px_1px_0_rgba(0,0,0,1)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"
                  >
                    Browse...
                  </button>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between text-xs pt-1">
              <label className="flex items-center gap-2 cursor-pointer font-bold">
                <input
                  type="checkbox"
                  checked={recursive}
                  onChange={(e) => setRecursive(e.target.checked)}
                  className="w-4 h-4 border-2 border-black rounded-none accent-black"
                />
                Scan Recursively (traverse subdirectories)
              </label>

              <div className="flex items-center gap-4 border border-black bg-[#FAFAFA] px-3 py-1 text-[11px] font-bold">
                <span className="text-[10px] uppercase text-gray-500 tracking-wider">Execute parameters:</span>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name="exec_mode"
                    checked={execMode === 'copy'}
                    onChange={() => setExecMode('copy')}
                    className="accent-black w-3.5 h-3.5"
                  />
                  Copy Files
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name="exec_mode"
                    checked={execMode === 'move'}
                    onChange={() => setExecMode('move')}
                    className="accent-black w-3.5 h-3.5"
                  />
                  Move Files
                </label>

                <div className="h-3.5 w-[1px] bg-gray-400"></div>

                <label className="flex items-center gap-1 cursor-pointer">
                  Conflict:
                  <select
                    value={conflictStrategy}
                    onChange={(e) => setConflictStrategy(e.target.value as any)}
                    className="border border-black bg-white text-[11px] font-bold px-1 py-0.5 ml-1"
                  >
                    <option value="skip">Skip file</option>
                    <option value="overwrite">Overwrite</option>
                    <option value="auto_rename">Auto-rename (parenthesis)</option>
                  </select>
                </label>
              </div>
            </div>
          </section>

          {/* Lower layout split: Tree View / Image Preview / Progress logs */}
          <div className="flex-1 flex overflow-hidden">
            
            {/* Center: The Planned Output Tree */}
            <div className="flex-1 flex flex-col border-r-[3px] border-black bg-[#FAF9F6] overflow-hidden">
              <div className="bg-white border-b-2 border-black px-4 py-2 shrink-0 flex items-center justify-between">
                <span className="font-archivo text-[11px] font-extrabold uppercase tracking-wider flex items-center gap-1">
                  <FileText className="w-3.5 h-3.5 text-black" />
                  Planned Output Preview
                </span>
                
                {plan && (
                  <span className="text-[10px] font-bold bg-[#E8Eaf6] border border-blue-200 px-2 py-0.5 font-mono text-blue-800">
                    {plan.total_folders} folders | {plan.total_images} images | {plan.total_filtered} filtered
                  </span>
                )}
              </div>

              <div className="flex-1 overflow-y-auto p-4">
                {planError && (
                  <div className="bg-red-50 border-2 border-red-500 text-red-800 p-3 text-xs flex gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold block">Planning Error</span>
                      {planError}
                    </div>
                  </div>
                )}

                {planning && (
                  <div className="flex flex-col items-center justify-center h-48 space-y-2">
                    <RefreshCw className="w-6 h-6 animate-spin text-gray-500" />
                    <p className="text-xs text-gray-500 font-bold uppercase tracking-wider font-mono">Generating dry-run layout...</p>
                  </div>
                )}

                {!plan && !planning && !planError && (
                  <div className="flex flex-col items-center justify-center h-full text-center p-6 text-gray-500 space-y-2">
                    <Info className="w-6 h-6 text-gray-400" />
                    <p className="text-xs font-bold uppercase tracking-wider">No Plan Generated</p>
                    <p className="text-xs max-w-xs text-gray-400">
                      Configure your source, destination, rename parameters, and click "Dry-Run Plan" to preview the folder tree before execution.
                    </p>
                  </div>
                )}

                {plan && !planning && (
                  <PreviewTree 
                    plan={plan} 
                  />
                )}
              </div>
            </div>

            {/* Right inside column: Progress logs & Undo Panel */}
            <div className="w-[300px] shrink-0 flex flex-col bg-white overflow-hidden">
              
              {/* Progress and Undo Panel */}
              <div className="flex-1 overflow-y-auto p-4 bg-[#F9F9F9]">
                <ProgressPanel 
                  execProgress={execProgress}
                  undoProgress={undoProgress}
                  lastUndoLog={lastUndoLog || execProgress.undo_log_path}
                  onUndo={handleUndo}
                />
              </div>

            </div>

          </div>

        </main>
      </div>

      {/* Directory Browse Modal */}
      {browseTarget !== null && (
        <BrowseModal 
          onClose={() => setBrowseTarget(null)}
          onSelect={selectFolder}
          title={browseTarget === 'source' ? 'Select Source Directory' : 'Select Destination Directory'}
          initialPath={browseTarget === 'source' ? sourceDir : destDir}
        />
      )}

    </div>
  );
}
