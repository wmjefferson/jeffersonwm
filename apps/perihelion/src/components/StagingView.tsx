import React, { useState, useEffect, useMemo } from 'react';
import { ArrowLeft, Download, GripVertical, X, Settings2, Image as ImageIcon, FileImage, Check, Share } from 'lucide-react';

const APIBASE = 'https://api.jeffersonwm.com';
const IMAGE_PATH = `${APIBASE}/images`;
const SHARE_API = `${APIBASE}/api/share`;
const renderableExts = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.avif', '.svg', '.bmp'];
const isRenderable = (filename: string) => {
  const ext = filename.substring(filename.lastIndexOf('.')).toLowerCase();
  return renderableExts.includes(ext);
};

interface StagingViewProps {
  selectedImages: string[];
  onBack: () => void;
  onDownload: (options: DownloadOptions) => void;
  isDownloading: boolean;
}

export interface DownloadOptions {
  files: { original: string; newName: string }[];
  enableDimensions: boolean;
  enableFilesize: boolean;
  dimensions?: { width: number; height: number; maintainAspect: boolean };
  targetFileSizeKB?: number;
}

type RuleType = 'text' | 'date' | 'sequence' | 'original';

interface Rule {
  id: string;
  type: RuleType;
  value: string;
  padding?: number;
}

export default function StagingView({ selectedImages, onBack, onDownload, isDownloading }: StagingViewProps) {
  const [rules, setRules] = useState<Rule[]>([{ id: '1', type: 'original', value: '' }]);
  const [enableRenaming, setEnableRenaming] = useState<boolean>(false);
  const [selectedForDownload, setSelectedForDownload] = useState<Set<string>>(new Set(selectedImages));
  
  const [enableDimensions, setEnableDimensions] = useState<boolean>(false);
  const [enableFilesize, setEnableFilesize] = useState<boolean>(false);
  const [resizeWidth, setResizeWidth] = useState<number>(800);
  const [resizeHeight, setResizeHeight] = useState<number>(800);
  const [maintainAspect, setMaintainAspect] = useState<boolean>(true);
  const [targetFileSize, setTargetFileSize] = useState<number>(500); // KB
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [showTitlePopup, setShowTitlePopup] = useState<boolean>(false);
  const [pageTitle, setPageTitle] = useState<string>('');

  const addRule = (type: RuleType) => {
    const newRule: Rule = {
      id: Math.random().toString(36).substr(2, 9),
      type,
      value: type === 'text' ? '-' : type === 'sequence' ? '1' : type === 'date' ? 'YYYY-MM-DD' : '',
      padding: type === 'sequence' ? 3 : undefined
    };
    setRules([...rules, newRule]);
  };

  const removeRule = (id: string) => {
    setRules(rules.filter(r => r.id !== id));
  };

  const updateRule = (id: string, updates: Partial<Rule>) => {
    setRules(rules.map(r => r.id === id ? { ...r, ...updates } : r));
  };

  const toggleSelection = (img: string) => {
    const newSet = new Set(selectedForDownload);
    if (newSet.has(img)) {
      newSet.delete(img);
    } else {
      newSet.add(img);
    }
    setSelectedForDownload(newSet);
  };

  const computedNames = useMemo(() => {
    const names: Record<string, string> = {};
    const dateStr = new Date().toISOString().split('T')[0]; // Simple date for now
    
    selectedImages.forEach((img, index) => {
      let newName = '';
      rules.forEach(rule => {
        if (rule.type === 'text') newName += rule.value;
        if (rule.type === 'date') newName += dateStr;
        if (rule.type === 'sequence') {
          const start = parseInt(rule.value) || 1;
          const padLength = rule.padding || 1;
          newName += String(start + index).padStart(padLength, '0');
        }
        if (rule.type === 'original') {
          const nameWithoutExt = img.split('.').slice(0, -1).join('.');
          newName += nameWithoutExt;
        }
      });

      if (!newName) newName = 'unnamed';
      
      const ext = img.split('.').pop();
      names[img] = `${newName}.${ext}`;
    });
    return names;
  }, [rules, selectedImages]);

  const handleDownloadClick = () => {
    const filesToDownload = selectedImages.filter(img => selectedForDownload.has(img));
    if (filesToDownload.length === 0) return;

    const files = filesToDownload.map(img => ({
      original: img,
      newName: enableRenaming ? computedNames[img] : (img.split('/').pop() || img)
    }));

    onDownload({
      files,
      enableDimensions,
      enableFilesize,
      dimensions: enableDimensions ? { width: resizeWidth, height: resizeHeight, maintainAspect } : undefined,
      targetFileSizeKB: enableFilesize ? targetFileSize : undefined
    });
  };

  const handleGeneratePage = async () => {
    const filesToShare = selectedImages.filter(img => selectedForDownload.has(img));
    if (filesToShare.length === 0) return;

    setIsGenerating(true);
    try {
      const res = await fetch(SHARE_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ images: filesToShare, title: pageTitle.trim() }),
      });
      const data = await res.json();
      if (data.id) {
        setShowTitlePopup(false);
        setPageTitle('');
        const shareUrl = `${window.location.origin}${window.location.pathname}?share=${data.id}`;
        window.open(shareUrl, '_blank');
      }
    } catch (err) {
      console.error('Failed to generate page', err);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-[#F0F0F0] text-black">
      {/* Header */}
      <header className="h-[36px] bg-white border-b-[3px] border-black shrink-0 flex items-center px-4 justify-between sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="hover:bg-[#f0f0f0] p-0.5 transition-colors border-[2px] border-transparent hover:border-black flex items-center justify-center">
            <ArrowLeft size={16} strokeWidth={2.5} />
          </button>
          <h1 className="font-archivo text-sm uppercase tracking-wider font-bold">Staging & Export</h1>
        </div>
        <div className="flex items-center gap-3 relative">
          <button 
            onClick={() => setSelectedForDownload(new Set())}
            disabled={selectedForDownload.size === 0}
            className="bg-white text-black border-[2px] border-black px-3 py-0.5 flex items-center gap-2 hover:bg-[#f0f0f0] disabled:opacity-50 transition-colors font-bold uppercase text-[11px] tracking-wider"
          >
            <X size={12} strokeWidth={2.5} />
            Clear Selection
          </button>
          <div className="relative">
            <button 
              onClick={() => setShowTitlePopup(!showTitlePopup)}
              disabled={isGenerating || selectedForDownload.size === 0}
              className="bg-white text-black border-[2px] border-black px-3 py-0.5 flex items-center gap-2 hover:bg-[#f0f0f0] disabled:opacity-50 transition-colors font-bold uppercase text-[11px] tracking-wider"
            >
              <Share size={12} strokeWidth={2.5} />
              {isGenerating ? 'Generating...' : 'Generate Page'}
            </button>
            {showTitlePopup && (
              <div className="absolute top-full right-0 mt-2 w-72 bg-white border-[3px] border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] p-4 z-50 flex flex-col gap-3">
                <label className="font-sans text-[11px] font-bold uppercase tracking-wider text-black">
                  Page Title (Optional)
                </label>
                <textarea
                  value={pageTitle}
                  onChange={(e) => setPageTitle(e.target.value)}
                  maxLength={1000}
                  placeholder="Enter a title for the generated page..."
                  className="w-full border-[2px] border-black p-2 text-sm font-sans resize-none h-24 focus:outline-none focus:ring-0"
                />
                <div className="text-right text-[10px] text-[#666] font-bold">
                  {pageTitle.length} / 1000
                </div>
                <div className="flex items-center justify-end gap-2 mt-1">
                  <button 
                    onClick={() => setShowTitlePopup(false)}
                    className="text-[11px] font-bold uppercase tracking-wider text-[#666] hover:text-black px-2 py-1"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={handleGeneratePage}
                    disabled={isGenerating}
                    className="bg-black text-white px-3 py-1 font-bold uppercase text-[11px] tracking-wider hover:bg-[#333] transition-colors"
                  >
                    Create
                  </button>
                </div>
              </div>
            )}
          </div>
          <button 
            onClick={handleDownloadClick}
            disabled={isDownloading || selectedForDownload.size === 0}
            className="bg-black text-white px-3 py-0.5 flex items-center gap-2 hover:bg-[#333] disabled:bg-[#888] transition-colors font-bold uppercase text-[11px] tracking-wider"
          >
            <Download size={12} strokeWidth={2.5} />
            {isDownloading ? 'Processing...' : `Export ${selectedForDownload.size} Images`}
          </button>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Panel: Options */}
        <div className="w-[400px] bg-white text-black overflow-y-auto border-r-[3px] border-black flex flex-col shrink-0">
          
          {/* Naming Rules Section */}
          <div className="p-6 border-b-[3px] border-black">
            <div className="flex items-center justify-between mb-4">
              <label className="flex items-center gap-2 cursor-pointer group w-fit">
                <input 
                  type="checkbox" 
                  checked={enableRenaming} 
                  onChange={e => setEnableRenaming(e.target.checked)}
                  className="w-4 h-4 accent-black border-[2px] border-[#666]"
                />
                <span className="font-sans font-bold uppercase tracking-widest text-sm text-black group-hover:text-[#666] transition-colors">Rename Files</span>
              </label>
              {enableRenaming && (
                <span className="bg-[#F0F0F0] text-black border-[2px] border-black text-[10px] font-bold px-2 py-1 uppercase tracking-wider">
                  {rules.length} Active
                </span>
              )}
            </div>

            {enableRenaming && (
              <>
                <div className="flex flex-col gap-3 mb-6">
                  {rules.map((rule, idx) => (
                    <div key={rule.id} className="bg-[#F0F0F0] border-[2px] border-[#666] p-3 flex items-start gap-3 group hover:border-black transition-colors">
                      <GripVertical size={16} className="text-[#888] mt-1 cursor-grab group-hover:text-black" />
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-black font-bold text-[11px] uppercase tracking-wider">{rule.type}</span>
                          <button onClick={() => removeRule(rule.id)} className="text-[#888] hover:text-black opacity-0 group-hover:opacity-100 transition-opacity">
                            <X size={14} strokeWidth={2.5} />
                          </button>
                        </div>
                        {rule.type === 'original' && <p className="text-[#666] text-[10px] uppercase font-bold tracking-wider">Using original filename</p>}
                        {rule.type === 'text' && (
                          <input 
                            type="text" 
                            value={rule.value} 
                            onChange={e => updateRule(rule.id, { value: e.target.value })}
                            className="w-full bg-white border-[2px] border-[#666] text-black text-xs px-2 py-1.5 mt-1 focus:outline-none focus:border-black font-medium"
                            placeholder="Enter text..."
                          />
                        )}
                        {rule.type === 'sequence' && (
                          <div className="flex items-center gap-3 mt-1">
                            <div className="flex flex-col">
                              <span className="text-[#666] text-[9px] font-bold uppercase tracking-wider mb-0.5">Start at</span>
                              <input 
                                type="number" 
                                value={rule.value} 
                                onChange={e => updateRule(rule.id, { value: e.target.value })}
                                className="w-16 bg-white border-[2px] border-[#666] text-black text-xs px-2 py-1.5 focus:outline-none focus:border-black font-medium"
                              />
                            </div>
                            <div className="flex flex-col">
                              <span className="text-[#666] text-[9px] font-bold uppercase tracking-wider mb-0.5">Digits</span>
                              <select
                                value={rule.padding || 3}
                                onChange={e => updateRule(rule.id, { padding: parseInt(e.target.value) })}
                                className="w-16 bg-white border-[2px] border-[#666] text-black text-xs px-2 py-1.5 focus:outline-none focus:border-black font-medium"
                              >
                                <option value={1}>1</option>
                                <option value={2}>2</option>
                                <option value={3}>3</option>
                                <option value={4}>4</option>
                                <option value={5}>5</option>
                              </select>
                            </div>
                          </div>
                        )}
                        {rule.type === 'date' && (
                          <p className="text-[#666] text-[10px] uppercase font-bold tracking-wider">YYYY-MM-DD</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mb-3">
                  <span className="text-[#666] text-[10px] font-bold uppercase tracking-wider">Add Rule Block</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={() => addRule('text')} className="bg-white border-[2px] border-[#666] hover:border-black hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] text-black font-bold uppercase tracking-wider text-[10px] py-2 flex items-center justify-center gap-1 transition-all">
                    <span>+</span> Text
                  </button>
                  <button onClick={() => addRule('date')} className="bg-white border-[2px] border-[#666] hover:border-black hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] text-black font-bold uppercase tracking-wider text-[10px] py-2 flex items-center justify-center gap-1 transition-all">
                    <span>+</span> Date
                  </button>
                  <button onClick={() => addRule('sequence')} className="bg-white border-[2px] border-[#666] hover:border-black hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] text-black font-bold uppercase tracking-wider text-[10px] py-2 flex items-center justify-center gap-1 transition-all">
                    <span>+</span> Sequence
                  </button>
                  <button onClick={() => addRule('original')} className="bg-white border-[2px] border-[#666] hover:border-black hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] text-black font-bold uppercase tracking-wider text-[10px] py-2 flex items-center justify-center gap-1 transition-all">
                    <span>+</span> Original Name
                  </button>
                </div>
              </>
            )}
          </div>

          {/* Resize Options Section */}
          <div className="p-6">
            <h2 className="font-sans font-bold uppercase tracking-widest text-sm text-black mb-4">Processing Options</h2>
            
            <div className="flex flex-col gap-5">
              {/* Dimensions Toggle */}
              <div className="flex flex-col gap-3">
                <label className="flex items-center gap-2 cursor-pointer group w-fit">
                  <input 
                    type="checkbox" 
                    checked={enableDimensions} 
                    onChange={e => setEnableDimensions(e.target.checked)}
                    className="w-4 h-4 accent-black border-[2px] border-[#666]"
                  />
                  <span className="text-[11px] font-bold uppercase tracking-wider text-[#666] group-hover:text-black transition-colors">Resize Dimensions</span>
                </label>
                
                {enableDimensions && (
                  <div className="ml-6 flex flex-col gap-3 bg-[#F0F0F0] p-4 border-[2px] border-[#666]">
                    <div className="flex items-center gap-3">
                      <div className="flex flex-col">
                        <span className="text-[#666] text-[9px] font-bold uppercase tracking-wider mb-0.5">Width</span>
                        <input 
                          type="number" 
                          value={resizeWidth} 
                          onChange={e => setResizeWidth(Number(e.target.value))}
                          className="w-20 bg-white border-[2px] border-[#666] text-black text-xs px-2 py-1.5 focus:outline-none focus:border-black font-medium"
                        />
                      </div>
                      <span className="text-[#888] mt-4 font-bold">×</span>
                      <div className="flex flex-col">
                        <span className="text-[#666] text-[9px] font-bold uppercase tracking-wider mb-0.5">Height</span>
                        <input 
                          type="number" 
                          value={resizeHeight} 
                          onChange={e => setResizeHeight(Number(e.target.value))}
                          className="w-20 bg-white border-[2px] border-[#666] text-black text-xs px-2 py-1.5 focus:outline-none focus:border-black font-medium"
                        />
                      </div>
                    </div>
                    <label className="flex items-center gap-2 mt-1 cursor-pointer w-fit group">
                      <input 
                        type="checkbox" 
                        checked={maintainAspect} 
                        onChange={e => setMaintainAspect(e.target.checked)}
                        className="w-3.5 h-3.5 accent-black"
                      />
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[#666] group-hover:text-black">Maintain aspect ratio</span>
                    </label>
                  </div>
                )}
              </div>

              {/* Filesize Toggle */}
              <div className="flex flex-col gap-3">
                <label className="flex items-center gap-2 cursor-pointer group w-fit">
                  <input 
                    type="checkbox" 
                    checked={enableFilesize} 
                    onChange={e => setEnableFilesize(e.target.checked)}
                    className="w-4 h-4 accent-black border-[2px] border-[#666]"
                  />
                  <span className="text-[11px] font-bold uppercase tracking-wider text-[#666] group-hover:text-black transition-colors">Compress File Size</span>
                </label>

                {enableFilesize && (
                  <div className="ml-6 flex items-center gap-3 bg-[#F0F0F0] p-4 border-[2px] border-[#666]">
                    <span className="text-[#666] text-[10px] font-bold uppercase tracking-wider">Target Size:</span>
                    <input 
                      type="number" 
                      value={targetFileSize} 
                      onChange={e => setTargetFileSize(Number(e.target.value))}
                      className="w-20 bg-white border-[2px] border-[#666] text-black text-xs px-2 py-1.5 focus:outline-none focus:border-black font-medium"
                    />
                    <span className="text-[#666] text-[10px] font-bold uppercase tracking-wider">KB</span>
                  </div>
                )}
              </div>
            </div>
          </div>

        </div>

        {/* Right Panel: Thumbnails */}
        <div className="flex-1 overflow-y-auto p-6 bg-[#F0F0F0]">
          <div className="flex flex-wrap gap-4 sm:gap-6">
            
            {selectedImages.map(img => (
              <div 
                key={img} 
                className={`bg-white border-[2px] flex flex-col cursor-pointer transition-all ${selectedForDownload.has(img) ? 'border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]' : 'border-[#666] opacity-60 hover:opacity-100'}`}
                onClick={() => toggleSelection(img)}
              >
                <div className="h-[200px] border-b-[2px] border-[#666] bg-[#e0e0e0] relative flex items-center justify-center overflow-hidden">
                  <div className="absolute top-2 left-2 z-10">
                    <div className={`w-5 h-5 border-[2px] flex items-center justify-center ${selectedForDownload.has(img) ? 'bg-black border-black' : 'bg-white border-[#666]'}`}>
                      {selectedForDownload.has(img) && <Check size={14} className="text-white" strokeWidth={3} />}
                    </div>
                  </div>

                  {isRenderable(img) ? (
                    <img 
                      src={`${IMAGE_PATH}/${encodeURI(img)}`} 
                      alt={img} 
                      loading="lazy" 
                      referrerPolicy="no-referrer" 
                      className="h-full w-auto object-contain" 
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center text-[#888] gap-2 w-48 h-full">
                      <FileImage size={24} strokeWidth={1.5} />
                      <span className="text-[9px] font-bold uppercase tracking-[widest]">{img.split('.').pop()}</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="h-[36px] bg-white border-t-[3px] border-black shrink-0 flex items-center px-4 justify-between sticky bottom-0 z-40">
        <div className="font-sans text-[11px] font-bold uppercase tracking-wider text-[#666]">
          {selectedForDownload.size} of {selectedImages.length} Images Selected
        </div>
        <div className="flex items-center gap-4">
        </div>
      </footer>
    </div>
  );
}
