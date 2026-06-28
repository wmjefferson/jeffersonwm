import React, { useState, useEffect, useMemo } from 'react';
import { ArrowLeft, Download, GripVertical, X, Settings2, Image as ImageIcon, FileImage, Check, Share } from 'lucide-react';

const APIBASE = 'https://api.jeffersonwm.com';
const THUMB_PATH = `${APIBASE}/thumbs`;
const SHARE_API = `${APIBASE}/api/share`;

const encodeAssetPath = (assetPath: string) =>
  assetPath
    .split('/')
    .map(segment => encodeURIComponent(segment))
    .join('/');

const buildThumbUrl = (assetPath: string, height: number, width = height * 2, cacheBust?: number) => {
  const params = new URLSearchParams({
    w: String(Math.max(64, Math.round(width))),
    h: String(Math.max(64, Math.round(height))),
  });
  if (cacheBust) {
    params.append('r', String(cacheBust));
  }
  return `${THUMB_PATH}/${encodeAssetPath(assetPath)}?${params.toString()}`;
};

const resetImageFallback = (container: Element | null) => {
  const img = container?.querySelector<HTMLImageElement>('img');
  const fallback = container?.querySelector<HTMLElement>('[data-image-fallback]');
  img?.classList.remove('hidden');
  if (img) {
    img.dataset.errorMode = 'thumb';
  }
  fallback?.classList.add('hidden');
  fallback?.classList.remove('flex');
};

const handleImageLoad = (event: React.SyntheticEvent<HTMLImageElement>) => {
  const img = event.currentTarget;
  img.classList.remove('hidden');
  const fallback = img.parentElement?.querySelector<HTMLElement>('[data-image-fallback]');
  fallback?.classList.add('hidden');
  fallback?.classList.remove('flex');
};

const showImageFallback = (img: HTMLImageElement) => {
  img.classList.add('hidden');
  const fallback = img.parentElement?.querySelector<HTMLElement>('[data-image-fallback]');
  fallback?.classList.remove('hidden');
  fallback?.classList.add('flex');
};

const handleThumbImageError = (
  event: React.SyntheticEvent<HTMLImageElement>,
  retryUrl: string,
) => {
  const img = event.currentTarget;
  const attempt = img.dataset.errorMode || 'thumb';

  if (attempt === 'thumb') {
    img.dataset.errorMode = 'original';
    img.src = retryUrl;
    return;
  }

  img.dataset.errorMode = 'failed';
  showImageFallback(img);
};

const getPerihelionRootUrl = () => {
  const origin = window.location.origin;
  const segments = window.location.pathname.split('/').filter(Boolean);
  const perihelionIndex = segments.indexOf('perihelion');
  const basePath = perihelionIndex >= 0 ? `/${segments.slice(0, perihelionIndex + 1).join('/')}/` : '/';
  return `${origin}${basePath}`;
};

const getPerihelionAppUrl = () => `${getPerihelionRootUrl()}home`;
const buildSharePageUrl = (shareId: string) => {
  const appUrl = new URL(getPerihelionAppUrl());
  appUrl.searchParams.set('share', shareId);
  return appUrl.toString();
};
const renderableExts = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.avif', '.svg', '.bmp'];
const isRenderable = (filename: string) => {
  const ext = filename.substring(filename.lastIndexOf('.')).toLowerCase();
  return renderableExts.includes(ext);
};

const extensionOf = (filename: string) => {
  const name = filename.split('/').pop() || filename;
  const dotIndex = name.lastIndexOf('.');
  return dotIndex >= 0 ? name.slice(dotIndex).toLowerCase() : '';
};

const getFileTypeCode = (filename: string) => {
  const ext = extensionOf(filename).replace('.', '').toUpperCase();
  return ext || 'FILE';
};

const getFileTypeTone = (filename: string) => {
  const ext = extensionOf(filename);

  if (['.pdf', '.doc', '.docx', '.rtf', '.txt', '.md'].includes(ext)) {
    return {
      accent: 'text-[#8A5A44]',
      border: 'border-[#B89D91]',
      bg: 'bg-[#F7F0EC]',
      label: 'DOCUMENT FILE',
    };
  }

  if (['.zip', '.rar', '.7z', '.tar', '.gz'].includes(ext)) {
    return {
      accent: 'text-[#586B8A]',
      border: 'border-[#9CAAC0]',
      bg: 'bg-[#EEF2F7]',
      label: 'ARCHIVE FILE',
    };
  }

  if (['.mp3', '.wav', '.flac', '.aac', '.m4a'].includes(ext)) {
    return {
      accent: 'text-[#6D5A8A]',
      border: 'border-[#AEA1C1]',
      bg: 'bg-[#F2EFF7]',
      label: 'AUDIO FILE',
    };
  }

  if (['.mp4', '.mov', '.avi', '.mkv', '.webm'].includes(ext)) {
    return {
      accent: 'text-[#476E66]',
      border: 'border-[#94B3AC]',
      bg: 'bg-[#ECF5F3]',
      label: 'VIDEO FILE',
    };
  }

  return {
    accent: 'text-[#666]',
    border: 'border-[#B9B9B9]',
    bg: 'bg-[#F3F3F3]',
    label: 'FILE',
  };
};

interface StagingViewProps {
  selectedImages: string[];
  selectedMetadata?: Record<string, {
    path: string;
    name: string;
    kind: 'image' | 'video' | 'other';
    ext: string;
    is_large?: boolean;
    size?: number;
    isMissing?: boolean;
  }>;
  onBack: () => void;
  onDownload: (options: DownloadOptions) => void;
  isDownloading: boolean;
  onOpenLightbox: (img: string) => void;
  isLargeMap?: Record<string, boolean>;
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

export default function StagingView({
  selectedImages,
  selectedMetadata,
  onBack,
  onDownload,
  isDownloading,
  onOpenLightbox,
  isLargeMap,
}: StagingViewProps) {
  const [rules, setRules] = useState<Rule[]>([{ id: '1', type: 'original', value: '' }]);
  const [enableRenaming, setEnableRenaming] = useState<boolean>(false);
  const [selectedForDownload, setSelectedForDownload] = useState<Set<string>>(
    new Set(selectedImages.filter(img => !selectedMetadata?.[img]?.isMissing))
  );
  
  const [enableDimensions, setEnableDimensions] = useState<boolean>(false);
  const [enableFilesize, setEnableFilesize] = useState<boolean>(false);
  const [resizeWidth, setResizeWidth] = useState<number>(800);
  const [resizeHeight, setResizeHeight] = useState<number>(800);
  const [maintainAspect, setMaintainAspect] = useState<boolean>(true);
  const [targetFileSize, setTargetFileSize] = useState<number>(500); // KB
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [showTitlePopup, setShowTitlePopup] = useState<boolean>(false);
  const [pageTitle, setPageTitle] = useState<string>('');
  const [pageDescription, setPageDescription] = useState<string>('');
  const [previewRetryTokens, setPreviewRetryTokens] = useState<Record<string, number>>({});

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

  const selectedItemLabel = selectedForDownload.size === 1 ? 'Item' : 'Items';
  const totalItemLabel = selectedImages.length === 1 ? 'Item' : 'Items';
  const missingItemCount = selectedImages.filter(img => selectedMetadata?.[img]?.isMissing).length;

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
        body: JSON.stringify({
          images: filesToShare,
          title: pageTitle.trim(),
          description: pageDescription.trim()
        }),
      });
      const data = await res.json();
      if (data.id) {
        setShowTitlePopup(false);
        setPageTitle('');
        setPageDescription('');
        const shareUrl = buildSharePageUrl(data.id);
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
      <header className="bg-white border-b-[3px] border-black shrink-0 sticky top-0 z-40 pt-[max(8px,env(safe-area-inset-top))] pb-2 px-3 sm:h-[36px] sm:py-0 sm:px-4">
        <div className="flex flex-col gap-3 sm:h-full sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3 pt-1 sm:pt-0">
            <button onClick={onBack} className="hover:bg-[#f0f0f0] p-1 sm:p-0.5 transition-colors border-[2px] border-transparent hover:border-black flex items-center justify-center">
              <ArrowLeft size={16} strokeWidth={2.5} />
            </button>
            <h1 className="font-archivo text-[15px] uppercase tracking-wider font-bold">Staging & Export</h1>
          </div>
          <div className="flex flex-wrap items-start gap-2 sm:items-center sm:gap-3 relative pl-7 sm:pl-0">
          <button 
            onClick={() => setSelectedForDownload(new Set())}
            disabled={selectedForDownload.size === 0}
            className="bg-white text-black border-[2px] border-black px-3 py-1 sm:py-0.5 min-h-[40px] sm:min-h-0 flex items-center gap-2 hover:bg-[#f0f0f0] disabled:opacity-50 transition-colors font-bold uppercase text-xs tracking-wider"
          >
            <X size={12} strokeWidth={2.5} />
            Clear Selection
          </button>
          <div className="relative">
            <button 
              onClick={() => setShowTitlePopup(!showTitlePopup)}
              disabled={isGenerating || selectedForDownload.size === 0}
              className="bg-white text-black border-[2px] border-black px-3 py-1 sm:py-0.5 min-h-[40px] sm:min-h-0 flex items-center gap-2 hover:bg-[#f0f0f0] disabled:opacity-50 transition-colors font-bold uppercase text-xs tracking-wider"
            >
              <Share size={12} strokeWidth={2.5} />
              {isGenerating ? 'Generating...' : 'Generate Page'}
            </button>
            {showTitlePopup && (
              <div className="absolute top-full left-0 sm:left-auto sm:right-0 mt-2 w-[min(18rem,calc(100vw-4rem))] bg-white border-[3px] border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] p-4 z-50 flex flex-col gap-3">
                <label className="font-sans text-xs font-bold uppercase tracking-wider text-black">
                  Page Title (Mandatory)
                </label>
                <input
                  type="text"
                  value={pageTitle}
                  onChange={(e) => setPageTitle(e.target.value)}
                  maxLength={32}
                  placeholder="Enter a title (max 32 chars)..."
                  className="w-full border-[2px] border-black p-2 text-xs font-sans focus:outline-none focus:ring-0 font-bold uppercase"
                />
                <div className="text-right text-[10px] text-[#666] font-bold">
                  {pageTitle.length} / 32
                </div>

                <label className="font-sans text-xs font-bold uppercase tracking-wider text-black">
                  Description (Optional)
                </label>
                <textarea
                  value={pageDescription}
                  onChange={(e) => setPageDescription(e.target.value)}
                  maxLength={1000}
                  placeholder="Enter description (max 1000 chars)..."
                  className="w-full border-[2px] border-black p-2 text-xs font-sans resize-none h-24 focus:outline-none focus:ring-0"
                />
                <div className="text-right text-[10px] text-[#666] font-bold">
                  {pageDescription.length} / 1000
                </div>

                <div className="flex items-center justify-end gap-2 mt-1">
                  <button 
                    onClick={() => {
                      setShowTitlePopup(false);
                      setPageTitle('');
                      setPageDescription('');
                    }}
                    className="text-xs font-bold uppercase tracking-wider text-[#666] hover:text-black px-2 py-1"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={handleGeneratePage}
                    disabled={isGenerating || !pageTitle.trim()}
                    className="bg-black text-white px-3 py-1 font-bold uppercase text-xs tracking-wider hover:bg-[#333] transition-colors disabled:opacity-50"
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
            className="bg-black text-white px-3 py-1 sm:py-0.5 min-h-[40px] sm:min-h-0 flex items-center gap-2 hover:bg-[#333] disabled:bg-[#888] transition-colors font-bold uppercase text-xs tracking-wider"
          >
            <Download size={12} strokeWidth={2.5} />
            {isDownloading ? 'Processing...' : `Export ${selectedForDownload.size} ${selectedItemLabel}`}
          </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Panel: Options */}
        <div className="w-[400px] bg-white text-black overflow-y-auto border-r-[3px] border-black flex flex-col shrink-0">
          
          {/* Naming Rules Section */}
          <div className="px-6 pt-8 pb-6 sm:pt-6 border-b-[3px] border-black">
            <div className="flex flex-col gap-5 mb-6">
              <div className="flex items-center justify-between">
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
                  <span className="bg-[#F0F0F0] text-black border-[2px] border-black text-[11px] font-bold px-2 py-1 uppercase tracking-wider">
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
                            <span className="text-black font-bold text-xs uppercase tracking-wider">{rule.type}</span>
                            <button onClick={() => removeRule(rule.id)} className="text-[#888] hover:text-black opacity-0 group-hover:opacity-100 transition-opacity">
                              <X size={14} strokeWidth={2.5} />
                            </button>
                          </div>
                          {rule.type === 'original' && <p className="text-[#666] text-[11px] uppercase font-bold tracking-wider">Using original filename</p>}
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
                                <span className="text-[#666] text-[10px] font-bold uppercase tracking-wider mb-0.5">Start at</span>
                                <input 
                                  type="number" 
                                  value={rule.value} 
                                  onChange={e => updateRule(rule.id, { value: e.target.value })}
                                  className="w-16 bg-white border-[2px] border-[#666] text-black text-xs px-2 py-1.5 focus:outline-none focus:border-black font-medium"
                                />
                              </div>
                              <div className="flex flex-col">
                                <span className="text-[#666] text-[10px] font-bold uppercase tracking-wider mb-0.5">Digits</span>
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
                            <p className="text-[#666] text-[11px] uppercase font-bold tracking-wider">YYYY-MM-DD</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="mb-3">
                    <span className="text-[#666] text-[11px] font-bold uppercase tracking-wider">Add Rule Block</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button onClick={() => addRule('text')} className="bg-white border-[2px] border-[#666] hover:border-black hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] text-black font-bold uppercase tracking-wider text-[11px] py-2 flex items-center justify-center gap-1 transition-all">
                      <span>+</span> Text
                    </button>
                    <button onClick={() => addRule('date')} className="bg-white border-[2px] border-[#666] hover:border-black hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] text-black font-bold uppercase tracking-wider text-[11px] py-2 flex items-center justify-center gap-1 transition-all">
                      <span>+</span> Date
                    </button>
                    <button onClick={() => addRule('sequence')} className="bg-white border-[2px] border-[#666] hover:border-black hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] text-black font-bold uppercase tracking-wider text-[11px] py-2 flex items-center justify-center gap-1 transition-all">
                      <span>+</span> Sequence
                    </button>
                    <button onClick={() => addRule('original')} className="bg-white border-[2px] border-[#666] hover:border-black hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] text-black font-bold uppercase tracking-wider text-[11px] py-2 flex items-center justify-center gap-1 transition-all">
                      <span>+</span> Original Name
                    </button>
                  </div>
                </>
              )}

              <div className="flex flex-col gap-3">
                <label className="flex items-center gap-2 cursor-pointer group w-fit">
                  <input 
                    type="checkbox" 
                    checked={enableDimensions} 
                    onChange={e => setEnableDimensions(e.target.checked)}
                    className="w-4 h-4 accent-black border-[2px] border-[#666]"
                  />
                  <span className="text-xs font-bold uppercase tracking-wider text-[#666] group-hover:text-black transition-colors">Resize Dimensions</span>
                </label>
                {enableDimensions && (
                  <div className="ml-6 flex flex-col gap-3 bg-white p-4 border-[2px] border-[#666]">
                    <div className="flex items-center gap-3">
                      <div className="flex flex-col">
                        <span className="text-[#666] text-[10px] font-bold uppercase tracking-wider mb-0.5">Width</span>
                        <input 
                          type="number" 
                          value={resizeWidth} 
                          onChange={e => setResizeWidth(Number(e.target.value))}
                          className="w-20 bg-white border-[2px] border-[#666] text-black text-xs px-2 py-1.5 focus:outline-none focus:border-black font-medium"
                        />
                      </div>
                      <span className="text-[#888] mt-4 font-bold">x</span>
                      <div className="flex flex-col">
                        <span className="text-[#666] text-[10px] font-bold uppercase tracking-wider mb-0.5">Height</span>
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
                      <span className="text-[11px] font-bold uppercase tracking-wider text-[#666] group-hover:text-black">Maintain aspect ratio</span>
                    </label>
                  </div>
                )}
              </div>
              <div className="flex flex-col gap-3">
                <label className="flex items-center gap-2 cursor-pointer group w-fit">
                  <input 
                    type="checkbox" 
                    checked={enableFilesize} 
                    onChange={e => setEnableFilesize(e.target.checked)}
                    className="w-4 h-4 accent-black border-[2px] border-[#666]"
                  />
                  <span className="text-xs font-bold uppercase tracking-wider text-[#666] group-hover:text-black transition-colors">Compress File Size</span>
                </label>
                {enableFilesize && (
                  <div className="ml-6 flex items-center gap-3 bg-white p-4 border-[2px] border-[#666]">
                    <span className="text-[#666] text-[11px] font-bold uppercase tracking-wider">Target Size:</span>
                    <input 
                      type="number" 
                      value={targetFileSize} 
                      onChange={e => setTargetFileSize(Number(e.target.value))}
                      className="w-20 bg-white border-[2px] border-[#666] text-black text-xs px-2 py-1.5 focus:outline-none focus:border-black font-medium"
                    />
                    <span className="text-[#666] text-[11px] font-bold uppercase tracking-wider">KB</span>
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
              (() => {
                const meta = selectedMetadata?.[img];
                const isMissing = Boolean(meta?.isMissing);
                const retryToken = previewRetryTokens[img] || 0;
                return (
              <div 
                key={img} 
                className={`bg-white border-[2px] flex flex-col transition-all ${selectedForDownload.has(img) ? 'border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]' : 'border-[#666] opacity-60 hover:opacity-100'}`}
              >
                <div 
                  data-image-container
                  className="h-[200px] border-b-[2px] border-[#666] bg-[#e0e0e0] relative flex items-center justify-center overflow-hidden cursor-pointer"
                  onClick={() => {
                    if (!isMissing) onOpenLightbox(img);
                  }}
                >
                  <button 
                    disabled={isMissing}
                    className="absolute top-2 left-2 z-20 focus:outline-none"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (isMissing) return;
                      toggleSelection(img);
                    }}
                  >
                    <div className={`w-5 h-5 border-[2px] flex items-center justify-center transition-colors ${isMissing ? 'bg-[#F3E8E2] border-[#B89D91]' : selectedForDownload.has(img) ? 'bg-black border-black' : 'bg-white border-[#666] hover:border-black'}`}>
                      {selectedForDownload.has(img) && <Check size={14} className="text-white" strokeWidth={3} />}
                    </div>
                  </button>

                  {isMissing ? (
                    <div className="flex h-full w-full flex-col items-center justify-center gap-3 bg-[#F8F3F1] px-5 text-center text-[#8A5A44]">
                      <div className="border-[2px] border-[#B89D91] bg-white px-3 py-1 text-[10px] font-bold uppercase tracking-[0.25em]">
                        Missing
                      </div>
                      <div className="max-w-[180px] text-[11px] font-bold uppercase leading-relaxed text-[#7A5A49]">
                        This shared file is no longer available in the live library.
                      </div>
                    </div>
                  ) : isRenderable(img) ? (
                    <>
                      <img 
                        src={buildThumbUrl(img, 240, 480, retryToken)} 
                        alt={img} 
                        loading="lazy" 
                        referrerPolicy="no-referrer" 
                        className="h-full w-auto object-contain"
                        onLoad={handleImageLoad}
                        onError={(event) => handleThumbImageError(event, `${APIBASE}/images/${encodeAssetPath(img)}?r=${retryToken}`)}
                      />
                      <div
                        data-image-fallback
                        className="hidden h-full w-full flex-col items-center justify-center gap-3 bg-[#F8F3F1] px-5 text-center text-[#8A5A44]"
                      >
                        <div className="border-[2px] border-[#B89D91] bg-white px-3 py-1 text-[10px] font-bold uppercase tracking-[0.25em]">
                          Preview
                        </div>
                        <div className="max-w-[180px] text-[11px] font-bold uppercase leading-relaxed text-[#7A5A49]">
                          This image preview is unavailable right now.
                        </div>
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            resetImageFallback(event.currentTarget.closest('[data-image-container]'));
                            setPreviewRetryTokens(prev => ({ ...prev, [img]: (prev[img] || 0) + 1 }));
                          }}
                          className="border-[2px] border-[#8A5A44] bg-white px-3 py-1 text-[10px] font-bold uppercase tracking-widest hover:bg-[#8A5A44] hover:text-white transition-colors"
                        >
                          Retry
                        </button>
                      </div>
                      {isLargeMap?.[img] && (
                        <div className="absolute top-2 right-2 z-20 bg-yellow-400 text-black border-[2px] border-black px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                          Lrg
                        </div>
                      )}
                    </>
                  ) : (
                    <div className={`flex flex-col items-center justify-center gap-3 w-48 h-full px-5 ${getFileTypeTone(img).accent}`}>
                      <div className={`w-14 h-14 rounded-full border-[2px] flex items-center justify-center ${getFileTypeTone(img).border} ${getFileTypeTone(img).bg}`}>
                        <FileImage size={24} strokeWidth={1.5} />
                      </div>
                      <div className="flex flex-col items-center gap-1 text-center">
                        <span className="text-[11px] font-bold uppercase tracking-[0.25em]">{getFileTypeCode(img)}</span>
                        <span className="text-[10px] font-bold uppercase tracking-widest opacity-80">{getFileTypeTone(img).label}</span>
                      </div>
                    </div>
                  )}
                </div>
                {isMissing && (
                  <div className="border-t-[0px] px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-[#8A5A44]">
                    {meta?.name || img.split('/').pop() || img}
                  </div>
                )}
              </div>
                );
              })()
            ))}
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="h-[36px] bg-white border-t-[3px] border-black shrink-0 flex items-center px-4 justify-between sticky bottom-0 z-40">
        <div className="font-sans text-xs font-bold uppercase tracking-wider text-[#666]">
          {selectedForDownload.size} of {selectedImages.length} {totalItemLabel} Selected
          {missingItemCount > 0 && (
            <span className="ml-2 text-[#8A5A44]">{missingItemCount} Missing</span>
          )}
        </div>
        <div className="flex items-center gap-4">
        </div>
      </footer>
    </div>
  );
}

