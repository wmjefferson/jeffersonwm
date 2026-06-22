import React, { useState, useEffect } from 'react';
import { Folder, ChevronUp, X, Loader2, HardDrive } from 'lucide-react';

const API_BASE = (import.meta as any).env?.VITE_API_BASE || 'http://localhost:8090';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (path: string) => void;
  initialPath: string;
  title: string;
}

interface BrowseResult {
  current: string;
  parent: string;
  dirs: string[];
}

export default function FolderBrowserModal({ isOpen, onClose, onSelect, initialPath, title }: Props) {
  const [currentPath, setCurrentPath] = useState(initialPath);
  const [parentPath, setParentPath] = useState('');
  const [subdirs, setSubdirs] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inputPath, setInputPath] = useState(initialPath);

  const loadPath = async (path: string) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ path });
      const res = await fetch(`${API_BASE}/api/browse?${params}`, { credentials: 'include' });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to list directory');
      }
      const data: BrowseResult = await res.json();
      setCurrentPath(data.current);
      setParentPath(data.parent);
      setSubdirs(data.dirs);
      setInputPath(data.current);
    } catch (err: any) {
      setError(err.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadPath(initialPath);
    }
  }, [isOpen, initialPath]);

  if (!isOpen) return null;

  const handleNavigate = (dir: string) => {
    if (!currentPath) {
      // Navigating into logical drive
      loadPath(dir);
    } else {
      const separator = currentPath.includes('/') ? '/' : '\\';
      const next = currentPath.endsWith(separator) ? currentPath + dir : currentPath + separator + dir;
      loadPath(next);
    }
  };

  const handleGoUp = () => {
    loadPath(parentPath);
  };

  const handleManualGo = () => {
    loadPath(inputPath);
  };

  const handleCreateFolder = async () => {
    const name = window.prompt('Enter new folder name:');
    if (!name || !name.trim()) return;
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`${API_BASE}/api/browse/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: currentPath, name: name.trim() }),
        credentials: 'include',
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to create folder');
      }
      await loadPath(currentPath);
    } catch (err: any) {
      setError(err.message || 'Failed to create folder');
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-[#F0F0F0] border-[3px] border-black w-full max-w-md flex flex-col max-h-[80vh] shadow-[4px_4px_0px_#000]">
        {/* Header */}
        <div className="bg-black text-white px-4 py-2 flex justify-between items-center font-archivo text-xs font-bold uppercase tracking-wider shrink-0">
          <span>{title}</span>
          <button onClick={onClose} className="text-white hover:text-red-400 transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Path Bar */}
        <div className="p-3 border-b-[2px] border-black bg-white flex gap-2 shrink-0">
          <input
            className="flex-1 border-[2px] border-black px-2 py-0.5 text-xs font-sans focus:outline-none"
            value={inputPath}
            onChange={e => setInputPath(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleManualGo()}
            placeholder="Path (e.g. E:\drawings)"
          />
          <button
            onClick={handleManualGo}
            className="bg-black text-white font-archivo text-[10px] font-bold uppercase px-3 py-0.5 hover:bg-[#222] transition-colors"
          >
            Go
          </button>
        </div>

        {/* Content list */}
        <div className="flex-1 overflow-y-auto p-4 bg-white flex flex-col gap-1 min-h-[250px]">
          {loading ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-2 py-12 text-[#666]">
              <Loader2 className="animate-spin" size={24} />
              <span className="font-archivo text-xs font-bold uppercase tracking-wider">Loading...</span>
            </div>
          ) : error ? (
            <div className="flex-1 flex flex-col items-center justify-center p-4 border-[2px] border-dashed border-red-400 text-red-600 text-center gap-2 py-12 font-sans text-xs">
              <span className="font-bold uppercase tracking-wider">Error</span>
              <span>{error}</span>
              <button
                onClick={() => loadPath(currentPath)}
                className="mt-2 bg-red-600 text-white font-archivo text-[10px] font-bold uppercase px-4 py-1 hover:bg-red-700 transition-colors"
              >
                Retry
              </button>
            </div>
          ) : (
            <>
              {parentPath !== undefined && (currentPath !== '' || parentPath !== '') && (
                <button
                  onClick={handleGoUp}
                  className="flex items-center gap-2 w-full text-left px-2 py-1.5 hover:bg-[#F0F0F0] text-xs font-archivo font-bold uppercase tracking-wide border border-transparent hover:border-black transition-all"
                >
                  <ChevronUp size={14} className="text-black" />
                  <span>.. (Up)</span>
                </button>
              )}
              {subdirs.length === 0 && (
                <div className="flex-1 flex items-center justify-center py-12 text-center font-archivo text-xs font-bold uppercase tracking-widest text-[#888]">
                  No subdirectories found
                </div>
              )}
              {subdirs.map(dir => {
                const isDrive = !currentPath && (dir.endsWith(':\\') || dir.startsWith('\\\\'));
                return (
                  <button
                    key={dir}
                    onClick={() => handleNavigate(dir)}
                    className="flex items-center gap-2 w-full text-left px-2 py-1.5 hover:bg-[#F0F0F0] text-xs font-sans transition-all border border-transparent hover:border-black"
                  >
                    {isDrive ? (
                      <HardDrive size={14} className="text-black shrink-0" />
                    ) : (
                      <Folder size={14} className="text-black fill-black/10 shrink-0" />
                    )}
                    <span className="truncate">{dir}</span>
                  </button>
                );
              })}
            </>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-3 bg-[#F0F0F0] border-t-[3px] border-black flex justify-between items-center shrink-0">
          <span className="text-[10px] font-archivo font-bold uppercase text-[#666] truncate max-w-[200px]" title={currentPath}>
            {currentPath || 'Select a drive/folder'}
          </span>
          <div className="flex gap-2">
            {currentPath && (
              <button
                onClick={handleCreateFolder}
                disabled={loading}
                className="border-[2px] border-black px-3 py-1 font-archivo text-xs font-bold uppercase hover:bg-white transition-colors"
              >
                + New Folder
              </button>
            )}
            <button
              onClick={onClose}
              className="border-[2px] border-black px-3 py-1 font-archivo text-xs font-bold uppercase hover:bg-white transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => currentPath && onSelect(currentPath)}
              disabled={!currentPath || loading}
              className="bg-black text-white border-[2px] border-black px-3 py-1 font-archivo text-xs font-bold uppercase hover:bg-[#222] disabled:opacity-40 disabled:hover:bg-black transition-colors"
            >
              Select Folder
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
