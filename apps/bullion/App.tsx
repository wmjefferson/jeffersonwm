import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { 
  FilePlus, 
  Download, 
  Trash2, 
  ArrowUpDown, 
  RefreshCw,
  Plus,
  FolderOpen,
  LayoutGrid,
  List as ListIcon,
  Archive
} from 'lucide-react';
import { Rule, RuleType, FileData, SortConfig } from './types';
import { generateNewNames, createZip, formatBytes } from './utils/fileHelpers';
import { Button } from './components/Button';
import { RuleItem } from './components/RuleItem';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';

// We need file-saver for client side downloading from blobs effectively
// Since I can't npm install in this environment description, I will implement a simple download helper or use the native anchor tag method if file-saver is strictly external.
// Actually, standard anchor download is fine for modern browsers.

const App: React.FC = () => {
  // State
  const [files, setFiles] = useState<FileData[]>([]);
  const [rules, setRules] = useState<Rule[]>([]);
  const [sortConfig, setSortConfig] = useState<SortConfig>({ field: 'name', direction: 'asc' });
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  
  // Initialize with a default rule
  useEffect(() => {
    if (rules.length === 0) {
      setRules([{ id: uuidv4(), type: RuleType.ORIGINAL }]);
    }
  }, []);

  // Helper to sort files
  const sortFiles = (fileList: FileData[], config: SortConfig) => {
    return [...fileList].sort((a, b) => {
      if (config.field === 'name') {
        // Use localeCompare with numeric: true for natural sorting (e.g., 2 follows 1, 10 follows 9)
        const comparison = a.originalName.localeCompare(b.originalName, undefined, { numeric: true, sensitivity: 'base' });
        return config.direction === 'asc' ? comparison : -comparison;
      }

      let valA: number = 0;
      let valB: number = 0;

      if (config.field === 'date') {
        valA = a.lastModified;
        valB = b.lastModified;
      } else if (config.field === 'size') {
        valA = a.size;
        valB = b.size;
      }

      if (valA < valB) return config.direction === 'asc' ? -1 : 1;
      if (valA > valB) return config.direction === 'asc' ? 1 : -1;
      return 0;
    });
  };

  // Shared file processing logic
  const processFiles = (uploadedFiles: File[]) => {
    const newFiles: FileData[] = uploadedFiles.map(file => {
      const lastDot = file.name.lastIndexOf('.');
      const name = lastDot !== -1 ? file.name.substring(0, lastDot) : file.name;
      const ext = lastDot !== -1 ? file.name.substring(lastDot + 1) : '';

      return {
        id: uuidv4(),
        file,
        originalName: file.name,
        newName: file.name, // Initial placeholder
        extension: ext,
        size: file.size,
        lastModified: file.lastModified
      };
    });

    setFiles(prev => sortFiles([...prev, ...newFiles], sortConfig));
  };

  // Handlers
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files.length > 0) {
      processFiles(Array.from(event.target.files));
    }
    event.target.value = '';
  };

  // Drag and Drop Handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    // Check if we're actually leaving the container and not just entering a child
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFiles(Array.from(e.dataTransfer.files));
    }
  };

  const handleAddRule = (type: RuleType) => {
    const newRule: Rule = {
      id: uuidv4(),
      type,
      value: '',
      startNumber: 1,
      padding: 2,
      dateFormat: 'yyyyMMdd'
    };
    setRules(prev => [...prev, newRule]);
  };

  const handleUpdateRule = (id: string, updates: Partial<Rule>) => {
    setRules(prev => prev.map(r => r.id === id ? { ...r, ...updates } : r));
  };

  const handleRemoveRule = (id: string) => {
    setRules(prev => prev.filter(r => r.id !== id));
  };

  const handleSort = (field: 'name' | 'date' | 'size') => {
    const isSameField = sortConfig.field === field;
    const direction = isSameField && sortConfig.direction === 'asc' ? 'desc' : 'asc';
    const config: SortConfig = { field, direction };
    setSortConfig(config);
    setFiles(prev => sortFiles(prev, config));
  };

  // Derived state: Preview
  const previewFiles = useMemo(() => {
    return generateNewNames(files, rules);
  }, [files, rules]);

  const handleClearFiles = () => setFiles([]);

  const handleDownloadZip = async () => {
    if (previewFiles.length === 0) return;
    setIsProcessing(true);
    try {
      const blob = await createZip(previewFiles);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'renamed_files_otis856.zip';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Zip failed", err);
      alert("Failed to create ZIP file.");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col font-sans text-slate-300">
      {/* Header */}
      <header className="h-16 border-b border-slate-800 flex items-center justify-between px-6 bg-slate-900/50 backdrop-blur-md sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-otis-accent rounded flex items-center justify-center text-slate-900 font-bold font-mono">
            8
          </div>
          <div>
            <h1 className="text-sm font-bold text-white tracking-wide uppercase">Bullion</h1>
            <p className="text-[10px] text-slate-500 font-mono">BATCH RENAME UTILITY</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <a href="#" className="text-xs text-slate-500 hover:text-white transition-colors">Documentation</a>
          <div className="h-4 w-px bg-slate-700"></div>
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <span className="w-2 h-2 rounded-full bg-green-500"></span>
            System Ready
          </div>
        </div>
      </header>

      {/* Main Layout */}
      <main className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        
        {/* LEFT PANEL: CONFIGURATION */}
        <aside className="w-full lg:w-[420px] bg-slate-900 border-r border-slate-800 flex flex-col z-20 shadow-xl">
          <div className="p-5 border-b border-slate-800 flex justify-between items-center">
             <h2 className="text-sm font-semibold text-white uppercase tracking-wider">Naming Rules</h2>
             <span className="text-xs text-slate-500 bg-slate-800 px-2 py-0.5 rounded-full">{rules.length} Active</span>
          </div>

          <div className="flex-1 overflow-y-auto p-5 space-y-3">
            {rules.map((rule, idx) => (
              <RuleItem
                key={rule.id}
                rule={rule}
                index={idx}
                onUpdate={handleUpdateRule}
                onRemove={handleRemoveRule}
              />
            ))}
            
            {rules.length === 0 && (
              <div className="text-center py-10 border-2 border-dashed border-slate-800 rounded-lg">
                <p className="text-slate-500 text-sm">No active rules.</p>
                <p className="text-slate-600 text-xs mt-1">Files will remain unchanged.</p>
              </div>
            )}
          </div>

          <div className="p-5 border-t border-slate-800 bg-slate-900">
            <p className="text-xs font-bold text-slate-500 mb-3 uppercase">Add Rule Block</p>
            <div className="grid grid-cols-2 gap-2">
              <Button size="sm" variant="secondary" onClick={() => handleAddRule(RuleType.TEXT)} icon={<Plus size={14}/>}>Text</Button>
              <Button size="sm" variant="secondary" onClick={() => handleAddRule(RuleType.DATE)} icon={<Plus size={14}/>}>Date</Button>
              <Button size="sm" variant="secondary" onClick={() => handleAddRule(RuleType.SEQUENCE)} icon={<Plus size={14}/>}>Sequence</Button>
              <Button size="sm" variant="secondary" onClick={() => handleAddRule(RuleType.ORIGINAL)} icon={<Plus size={14}/>}>Original Name</Button>
            </div>
          </div>
        </aside>

        {/* RIGHT PANEL: PREVIEW & FILES */}
        <section 
          className="flex-1 flex flex-col bg-slate-950 relative overflow-hidden"
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          {/* Drag Overlay */}
          {isDragging && (
            <div className="absolute inset-0 z-50 bg-slate-900/90 border-4 border-dashed border-otis-accent m-4 rounded-xl flex items-center justify-center backdrop-blur-sm transition-all animate-in fade-in duration-200">
              <div className="text-center pointer-events-none">
                <FolderOpen size={64} className="mx-auto text-otis-accent mb-4 animate-bounce" />
                <h3 className="text-2xl font-bold text-white mb-2">Drop files to add</h3>
                <p className="text-slate-400">Release to add them to the queue</p>
              </div>
            </div>
          )}
          
          {/* Toolbar */}
          <div className="h-14 border-b border-slate-800 flex items-center justify-between px-6 bg-slate-950/80">
            <div className="flex items-center gap-2">
               <label className="cursor-pointer">
                  <input type="file" multiple className="hidden" onChange={handleFileUpload} />
                  <Button variant="secondary" size="sm" icon={<FolderOpen size={16} />}>Add Files</Button>
               </label>
               {files.length > 0 && (
                 <Button variant="ghost" size="sm" onClick={handleClearFiles} icon={<Trash2 size={16} />} className="text-red-400 hover:text-red-300 hover:bg-red-900/20">
                   Clear All
                 </Button>
               )}
            </div>

            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1 bg-slate-900 rounded-lg p-1 border border-slate-800">
                <button 
                  onClick={() => handleSort('name')}
                  className={`px-3 py-1 rounded text-xs font-medium transition-colors ${sortConfig.field === 'name' ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-500 hover:text-slate-300'}`}
                >
                  Name
                </button>
                <button 
                  onClick={() => handleSort('date')}
                  className={`px-3 py-1 rounded text-xs font-medium transition-colors ${sortConfig.field === 'date' ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-500 hover:text-slate-300'}`}
                >
                  Date
                </button>
                 <button 
                   onClick={() => handleSort('name')} 
                   className="px-2 text-slate-500 hover:text-white"
                   title="Toggle Direction"
                 >
                   <ArrowUpDown size={14} className={sortConfig.direction === 'desc' ? 'transform rotate-180' : ''} />
                 </button>
              </div>
            </div>
          </div>

          {/* File Table Header */}
          <div className="grid grid-cols-12 gap-4 px-6 py-3 border-b border-slate-800 text-xs font-bold text-slate-500 uppercase tracking-wider bg-slate-900/30">
             <div className="col-span-4">Original Filename</div>
             <div className="col-span-1"></div>
             <div className="col-span-4 text-otis-accent">New Filename</div>
             <div className="col-span-2 text-right">Size</div>
             <div className="col-span-1 text-right">Ext</div>
          </div>

          {/* File List */}
          <div className="flex-1 overflow-y-auto custom-scrollbar p-0">
            {files.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-600 opacity-50">
                 <Archive size={64} strokeWidth={1} className="mb-4" />
                 <p className="text-lg font-medium">No files loaded</p>
                 <p className="text-sm">Drag and drop files here or click "Add Files"</p>
              </div>
            ) : (
              <ul className="divide-y divide-slate-800/50">
                {previewFiles.map((file) => (
                  <li key={file.id} className="grid grid-cols-12 gap-4 px-6 py-3 hover:bg-slate-900/40 transition-colors items-center group">
                    <div className="col-span-4 text-sm text-slate-400 truncate font-mono" title={file.originalName}>
                      {file.originalName}
                    </div>
                    
                    <div className="col-span-1 flex justify-center text-slate-700">
                      →
                    </div>

                    <div className="col-span-4 text-sm text-white truncate font-mono font-medium" title={file.newName}>
                       {file.newName}
                    </div>

                    <div className="col-span-2 text-right text-xs text-slate-500 font-mono">
                      {formatBytes(file.size)}
                    </div>

                    <div className="col-span-1 text-right text-xs text-slate-600 font-bold uppercase">
                      {file.extension}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Action Bar */}
          <div className="h-20 border-t border-slate-800 bg-slate-900 flex items-center justify-between px-8">
            <div className="flex flex-col">
              <span className="text-xs text-slate-500 uppercase tracking-wider font-bold">Total Files</span>
              <span className="text-2xl font-mono text-white">{files.length}</span>
            </div>
            
            <div className="flex gap-4">
              <Button 
                variant="primary" 
                size="lg" 
                disabled={files.length === 0 || isProcessing} 
                onClick={handleDownloadZip}
                icon={isProcessing ? <RefreshCw size={20} className="animate-spin"/> : <Download size={20} />}
                className="shadow-lg shadow-otis-accent/20"
              >
                {isProcessing ? 'Processing...' : 'Process & Download ZIP'}
              </Button>
            </div>
          </div>

        </section>
      </main>
    </div>
  );
};

export default App;