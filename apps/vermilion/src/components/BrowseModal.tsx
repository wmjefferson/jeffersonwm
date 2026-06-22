import React, { useState, useEffect } from 'react';
import { 
  X, Folder, FolderPlus, ArrowUp, ChevronRight, 
  HardDrive, AlertCircle, RefreshCw 
} from 'lucide-react';

interface Props {
  onClose: () => void;
  onSelect: (path: string) => void;
  title: string;
  initialPath?: string;
}

interface DirectoryItem {
  name: string;
  path: string;
}

export default function BrowseModal({ onClose, onSelect, title, initialPath = '' }: Props) {
  const [currentPath, setCurrentPath] = useState<string>(initialPath);
  const [typedPath, setTypedPath] = useState<string>(initialPath);
  const [drives, setDrives] = useState<string[]>([]);
  const [directories, setDirectories] = useState<DirectoryItem[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // New folder creation state
  const [newFolderName, setNewFolderName] = useState<string>('');
  const [creatingFolder, setCreatingFolder] = useState<boolean>(false);

  useEffect(() => {
    loadDirectory(currentPath);
  }, [currentPath]);

  const loadDirectory = async (path: string) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (path) {
        params.append('path', path);
      }
      const res = await fetch(`/api/browse?${params}`);
      const data = await res.json();
      if (res.ok) {
        if (data.drives) {
          setDrives(data.drives);
          setDirectories([]);
          setCurrentPath('');
          setTypedPath('');
        } else {
          setDirectories(data.directories || []);
          setCurrentPath(data.current_path || '');
          setTypedPath(data.current_path || '');
          setDrives([]);
        }
      } else {
        setError(data.error || 'Failed to load folder');
      }
    } catch (e) {
      setError('Error loading directory');
    } finally {
      setLoading(false);
    }
  };

  const handleNavigate = (path: string) => {
    setCurrentPath(path);
  };

  const handleNavigateUp = () => {
    if (!currentPath) return;
    
    // Check if there is a parent path (using standard path separators)
    // Windows paths can have \ or /
    const parts = currentPath.split(/[\\/]/).filter(Boolean);
    
    if (parts.length <= 1) {
      // Go back to drives listing
      setCurrentPath('');
    } else {
      // Reconstruct parent path
      const isUNC = currentPath.startsWith('\\\\');
      let parent = '';
      
      if (isUNC) {
        // Handle UNC path: \\server\share\sub
        if (parts.length <= 2) {
          setCurrentPath('');
          return;
        }
        parent = '\\\\' + parts.slice(0, parts.length - 1).join('\\');
      } else {
        parent = parts.slice(0, parts.length - 1).join('\\');
        // Add drive letter colon
        if (parent.length === 1 && parent.match(/[A-Z]/i)) {
          parent += ':\\';
        } else {
          parent += '\\';
        }
      }
      setCurrentPath(parent);
    }
  };

  const handleCreateFolder = async () => {
    const folderName = newFolderName.trim();
    if (!folderName || !currentPath) return;

    setCreatingFolder(true);
    try {
      // Combine path safely
      const separator = currentPath.endsWith('\\') || currentPath.endsWith('/') ? '' : '\\';
      const targetPath = `${currentPath}${separator}${folderName}`;

      const res = await fetch('/api/browse/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: targetPath })
      });
      
      const data = await res.json();
      if (res.ok && data.ok) {
        setNewFolderName('');
        loadDirectory(currentPath); // reload active directory
      } else {
        alert(data.error || 'Failed to create folder');
      }
    } catch (e) {
      alert('Error creating folder');
    } finally {
      setCreatingFolder(false);
    }
  };

  const handleGoTypedPath = () => {
    const target = typedPath.trim();
    setCurrentPath(target);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleGoTypedPath();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/55 backdrop-blur-[1px] flex items-center justify-center z-50 p-4">
      {/* Modal Dialog */}
      <div className="w-full max-w-[550px] bg-white border-4 border-black shadow-[4px_4px_0_rgba(0,0,0,1)] flex flex-col max-h-[85vh] overflow-hidden">
        
        {/* Header */}
        <header className="bg-black text-white px-4 py-2 flex items-center justify-between shrink-0">
          <span className="font-archivo text-xs font-black uppercase tracking-wider">{title}</span>
          <button onClick={onClose} className="text-gray-300 hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        </header>

        {/* Path navigation input bar */}
        <div className="border-b border-black p-3 bg-gray-150 shrink-0 space-y-2">
          <div className="flex gap-2">
            <input
              type="text"
              value={typedPath}
              onChange={(e) => setTypedPath(e.target.value)}
              onKeyDown={handleKeyPress}
              placeholder="e.g. C:\Users\Bill\Pictures or \\server\share"
              className="flex-1 text-xs border-2 border-black px-2 py-1 bg-white font-mono"
            />
            <button
              onClick={handleGoTypedPath}
              className="bg-black text-white text-[11px] font-bold uppercase px-3 py-1 border border-black"
            >
              Go
            </button>
          </div>

          {/* Breadcrumb controls */}
          <div className="flex items-center gap-1.5 text-xs">
            <button
              onClick={handleNavigateUp}
              disabled={!currentPath}
              className="flex items-center gap-1 border border-black bg-white px-2 py-0.5 text-[10px] font-bold uppercase disabled:opacity-30 disabled:pointer-events-none hover:bg-gray-100 shrink-0"
              title="Navigate Up"
            >
              <ArrowUp className="w-3 h-3" /> Up
            </button>
            <div className="text-[10px] text-gray-500 font-mono truncate select-all py-0.5 px-1 bg-white border border-gray-300 flex-1">
              {currentPath || '[Computer Drives]'}
            </div>
          </div>
        </div>

        {/* Directory Items List */}
        <div className="flex-1 overflow-y-auto p-3 bg-gray-50 min-h-[220px]">
          {loading && (
            <div className="flex flex-col items-center justify-center h-48 text-gray-400 gap-1.5">
              <RefreshCw className="w-5 h-5 animate-spin" />
              <span className="text-[10px] uppercase font-bold tracking-wider font-mono">Loading folder contents...</span>
            </div>
          )}

          {!loading && error && (
            <div className="bg-red-50 border border-red-300 text-red-800 p-3 text-xs flex gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold block">Error Loading Path</span>
                {error}
                <button
                  onClick={() => setCurrentPath('')}
                  className="mt-2 block text-[10px] font-bold uppercase underline text-red-900"
                >
                  Return to Computer Drives
                </button>
              </div>
            </div>
          )}

          {!loading && !error && (
            <div className="space-y-1.5">
              {/* Drives listing */}
              {drives.length > 0 && (
                <div className="grid grid-cols-2 gap-2">
                  {drives.map((drv, i) => (
                    <button
                      key={i}
                      onClick={() => handleNavigate(drv)}
                      className="flex items-center gap-2.5 p-2.5 border border-black bg-white text-left font-mono text-xs font-bold hover:bg-[#FFEB3B] hover:text-black transition-colors shadow-[1px_1px_0_rgba(0,0,0,1)]"
                    >
                      <HardDrive className="w-4 h-4 text-gray-500 shrink-0" />
                      <span>{drv}</span>
                    </button>
                  ))}
                </div>
              )}

              {/* Directories listing */}
              {directories.length > 0 && (
                <div className="space-y-1">
                  {directories.map((dir, i) => (
                    <button
                      key={i}
                      onClick={() => handleNavigate(dir.path)}
                      className="w-full flex items-center gap-2 p-1.5 border border-transparent hover:border-black hover:bg-[#FFFDE7] text-left transition-colors font-mono text-xs text-gray-700"
                    >
                      <Folder className="w-4 h-4 text-yellow-600 shrink-0" />
                      <span className="truncate">{dir.name}</span>
                    </button>
                  ))}
                </div>
              )}

              {drives.length === 0 && directories.length === 0 && (
                <div className="text-center py-8 text-gray-400 text-xs italic">
                  Folder is empty
                </div>
              )}
            </div>
          )}
        </div>

        {/* Create Folder Input Bar */}
        {currentPath && !loading && !error && (
          <div className="border-t border-black p-3 bg-gray-150 flex gap-2 shrink-0">
            <input
              type="text"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              placeholder="New Folder Name..."
              className="flex-1 text-xs border border-black px-2.5 py-1 bg-white font-mono"
            />
            <button
              onClick={handleCreateFolder}
              disabled={!newFolderName.trim() || creatingFolder}
              className="bg-black text-white text-[11px] font-bold uppercase px-3 py-1 flex items-center gap-1 disabled:opacity-40"
            >
              <FolderPlus className="w-3.5 h-3.5" />
              Create
            </button>
          </div>
        )}

        {/* Footer actions */}
        <footer className="border-t-2 border-black p-3 bg-white flex justify-end gap-2 shrink-0">
          <button
            onClick={onClose}
            className="border border-black bg-white text-black text-xs font-bold uppercase px-4 py-1.5 shadow-[1.5px_1.5px_0_rgba(0,0,0,1)] hover:bg-gray-50 active:translate-x-[1px] active:translate-y-[1px] active:shadow-none"
          >
            Cancel
          </button>
          <button
            onClick={() => onSelect(currentPath)}
            disabled={!currentPath}
            className="bg-black text-white text-xs font-bold uppercase px-4 py-1.5 border border-black shadow-[1.5px_1.5px_0_rgba(0,0,0,1)] hover:bg-[#222] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none disabled:opacity-40 disabled:pointer-events-none"
          >
            Select Folder
          </button>
        </footer>

      </div>
    </div>
  );
}
