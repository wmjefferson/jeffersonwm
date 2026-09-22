import React, { useState, useEffect, useMemo } from 'react';
import { Download, GripVertical, X, Settings2, Image as ImageIcon, FileImage, Check, Share } from 'lucide-react';

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

const videoExts = ['.mp4', '.mov', '.avi', '.mkv', '.webm', '.m4v'];

const getMediaKind = (filename: string): 'image' | 'video' | 'other' => {
  const ext = extensionOf(filename);
  if (renderableExts.includes(ext)) return 'image';
  if (videoExts.includes(ext)) return 'video';
  return 'other';
};

const formatFileSize = (bytes: number) => {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
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
    accent: 'text-[#202522] dark:text-[#fafafa]',
    border: 'border-[#d4d4d8] dark:border-[#333a35]',
    bg: 'bg-[#fafafa] dark:bg-[#202522]',
    label: `${getFileTypeCode(filename)} FILE`,
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
  onBack?: () => void;
  onDownload: (options: DownloadOptions) => void;
  isDownloading: boolean;
  onOpenLightbox: (img: string) => void;
  isLargeMap?: Record<string, boolean>;
  isLocalMode?: boolean;
  getPreviewUrl?: (path: string, height: number, width?: number, cacheBust?: number) => string;
  getOriginalUrl?: (path: string, cacheBust?: number) => string;
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
  onDownload,
  isDownloading,
  onOpenLightbox,
  isLargeMap,
  isLocalMode = false,
  getPreviewUrl,
  getOriginalUrl,
}: StagingViewProps) {
  const [rules, setRules] = useState<Rule[]>([{ id: '1', type: 'original', value: '' }]);
  const [enableRenaming, setEnableRenaming] = useState<boolean>(false);
  const [selectedForDownload, setSelectedForDownload] = useState<Set<string>>(
    new Set(selectedImages.filter(img => !selectedMetadata?.[img]?.isMissing))
  );
  
  const [enableDimensions, setEnableDimensions] = useState<boolean>(true);
  const [enableFilesize, setEnableFilesize] = useState<boolean>(true);
  const [resizeWidth, setResizeWidth] = useState<number>(800);
  const [resizeHeight, setResizeHeight] = useState<number>(800);
  const [maintainAspect, setMaintainAspect] = useState<boolean>(true);
  const [targetFileSize, setTargetFileSize] = useState<number>(500); // KB
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [showTitlePopup, setShowTitlePopup] = useState<boolean>(false);
  const [pageTitle, setPageTitle] = useState<string>('');
  const [pageDescription, setPageDescription] = useState<string>('');
  const [previewRetryTokens, setPreviewRetryTokens] = useState<Record<string, number>>({});
  const [generateError, setGenerateError] = useState<string>('');

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
    const dateStr = new Date().toISOString().split('T')[0];
    
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
  const stagingSummary = useMemo(() => {
    let imageCount = 0;
    let videoCount = 0;
    let otherCount = 0;
    let selectedBytes = 0;
    let itemsWithSize = 0;

    selectedImages.forEach((img) => {
      const meta = selectedMetadata?.[img];
      const kind = meta?.kind ?? getMediaKind(img);
      if (kind === 'image') imageCount += 1;
      else if (kind === 'video') videoCount += 1;
      else otherCount += 1;

      if (selectedForDownload.has(img) && typeof meta?.size === 'number' && Number.isFinite(meta.size) && meta.size > 0) {
        selectedBytes += meta.size;
        itemsWithSize += 1;
      }
    });

    return {
      imageCount,
      videoCount,
      otherCount,
      selectedBytes,
      itemsWithSize,
    };
  }, [selectedForDownload, selectedImages, selectedMetadata]);
  const secondaryButtonClass = 'peri-button--secondary px-3 py-1.5 min-h-[32px] flex items-center gap-2 disabled:opacity-50 transition-colors text-xs uppercase tracking-wider font-bold';
  const primaryButtonClass = 'peri-button px-3 py-1.5 min-h-[32px] flex items-center gap-2 disabled:opacity-50 transition-colors text-xs uppercase tracking-wider font-bold';

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

    setGenerateError('');
    setIsGenerating(true);
    try {
      const defaultTitle = `Collection ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
      const cleanTitle = pageTitle.trim() || (pageDescription.trim() ? pageDescription.trim().slice(0, 32) : defaultTitle);

      const res = await fetch(SHARE_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          images: filesToShare,
          title: cleanTitle,
          description: pageDescription.trim()
        }),
      });
      const data = await res.json();
      if (data.id) {
        setShowTitlePopup(false);
        setPageTitle('');
        setPageDescription('');
        setGenerateError('');
        const shareUrl = buildSharePageUrl(data.id);
        window.location.assign(shareUrl);
      } else {
        setGenerateError(data.error || 'Failed to create share page');
      }
    } catch (err) {
      console.error('Failed to generate page', err);
      setGenerateError('Network error while generating share page');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="peri-options-page flex flex-col gap-6 font-sans">
      {/* Page Header */}
      <div className="peri-options-header flex flex-col sm:flex-row sm:items-center justify-between border-b border-[#d4d4d8] dark:border-[#333a35] pb-4 gap-4">
        <div>
          <h1 className="peri-options-title font-title text-2xl font-bold uppercase tracking-tight text-[#202522] dark:text-[#fafafa]">
            Staging
          </h1>
          <p className="peri-options-subtitle mt-1 text-xs font-sans text-[#6a716b] dark:text-[#9da69e]">
            Process, rename, and export staged items
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3 relative">
          <button 
            onClick={() => setSelectedForDownload(new Set())}
            disabled={selectedForDownload.size === 0}
            className={secondaryButtonClass}
          >
            <X size={12} strokeWidth={2.5} />
            Clear Selection
          </button>
          {!isLocalMode && (
            <div className="relative">
              <button 
                onClick={() => setShowTitlePopup(!showTitlePopup)}
                disabled={isGenerating || selectedForDownload.size === 0}
                className={secondaryButtonClass}
              >
                <Share size={12} strokeWidth={2.5} />
                {isGenerating ? 'Generating...' : 'Generate Page'}
              </button>
              {showTitlePopup && (
                <div className="peri-card absolute top-full left-0 sm:left-auto sm:right-0 mt-2 w-[min(18rem,calc(100vw-4rem))] shadow-[0_18px_40px_rgba(15,23,42,0.14)] p-4 z-50 flex flex-col gap-3">
                  <label className="font-sans text-xs font-bold uppercase tracking-wider text-[#202522] dark:text-[#fafafa]">
                    Page Title (Optional)
                  </label>
                  <input
                    type="text"
                    value={pageTitle}
                    onChange={(e) => {
                      setPageTitle(e.target.value);
                      if (generateError) setGenerateError('');
                    }}
                    maxLength={32}
                    placeholder="Enter a title (optional)..."
                    className="peri-input w-full p-2 text-xs font-sans font-bold uppercase"
                  />
                  <div className="text-right text-[10px] text-[#666] dark:text-[#9da69e] font-bold">
                    {pageTitle.length} / 32
                  </div>

                  <label className="font-sans text-xs font-bold uppercase tracking-wider text-[#202522] dark:text-[#fafafa]">
                    Description / Note (Optional)
                  </label>
                  <textarea
                    value={pageDescription}
                    onChange={(e) => {
                      setPageDescription(e.target.value);
                      if (generateError) setGenerateError('');
                    }}
                    maxLength={1000}
                    placeholder="Enter a note or description..."
                    className="peri-input w-full p-2 text-xs font-sans resize-none h-24"
                  />
                  <div className="text-right text-[10px] text-[#666] dark:text-[#9da69e] font-bold">
                    {pageDescription.length} / 1000
                  </div>

                  {generateError && (
                    <div className="text-red-600 dark:text-red-400 text-xs font-bold">
                      {generateError}
                    </div>
                  )}

                  <div className="flex items-center justify-end gap-2 mt-1">
                    <button 
                      onClick={() => {
                        setShowTitlePopup(false);
                        setPageTitle('');
                        setPageDescription('');
                        setGenerateError('');
                      }}
                      className="text-xs font-bold uppercase tracking-wider text-[#666] dark:text-[#9da69e] hover:text-black dark:hover:text-white px-2 py-1"
                    >
                      Cancel
                    </button>
                    <button 
                      onClick={handleGeneratePage}
                      disabled={isGenerating || selectedForDownload.size === 0}
                      className="peri-button px-3 py-1 text-xs uppercase tracking-wider disabled:opacity-50"
                    >
                      {isGenerating ? 'Creating...' : 'Create'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
          <button 
            onClick={handleDownloadClick}
            disabled={isDownloading || selectedForDownload.size === 0}
            className={primaryButtonClass}
          >
            <Download size={12} strokeWidth={2.5} />
            {isDownloading ? 'Processing...' : `Export ${selectedForDownload.size} ${selectedItemLabel}`}
          </button>
        </div>
      </div>

      {/* Main Content Layout: Left Options & Summary, Right Staged Thumbnails */}
      <div className="flex flex-col lg:flex-row gap-6 items-start">
        {/* Left Panel: Options */}
        <div className="w-full lg:w-[380px] bg-white dark:bg-[#191d1a] text-[#202522] dark:text-[#fafafa] border border-[#e5e5e5] dark:border-[#333a35] flex flex-col shrink-0">
          
          {/* Naming Rules Section */}
          <div className="px-6 pt-6 pb-6 border-b border-[#e5e5e5] dark:border-[#333a35]">
            <div className="flex flex-col gap-5 mb-6">
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 cursor-pointer group w-fit">
                  <input 
                    type="checkbox" 
                    checked={enableRenaming} 
                    onChange={e => setEnableRenaming(e.target.checked)}
                    className="w-4 h-4 accent-black dark:accent-white border border-[#9faab4] dark:border-[#4a544c]"
                  />
                  <span className="font-sans font-bold uppercase tracking-widest text-sm text-[#202522] dark:text-[#fafafa] group-hover:text-[#666] dark:group-hover:text-[#9da69e] transition-colors">Rename Files</span>
                </label>
                {enableRenaming && (
                  <span className="peri-chip text-[#202522] dark:text-[#fafafa] text-[11px] font-bold px-2 py-1 uppercase tracking-wider">
                    {rules.length} Active
                  </span>
                )}
              </div>

              {enableRenaming && (
                <>
                  <div className="flex flex-col gap-3 mb-6">
                    {rules.map(rule => (
                      <div key={rule.id} className="peri-card bg-[#fafafa] dark:bg-[#202522] p-3 flex items-start gap-3 group">
                        <GripVertical size={16} className="text-[#888] dark:text-[#9da69e] mt-1 cursor-grab group-hover:text-black dark:group-hover:text-white" />
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[#202522] dark:text-[#fafafa] font-bold text-xs uppercase tracking-wider">{rule.type}</span>
                            <button onClick={() => removeRule(rule.id)} className="text-[#888] dark:text-[#9da69e] hover:text-black dark:hover:text-white opacity-0 group-hover:opacity-100 transition-opacity">
                              <X size={14} strokeWidth={2.5} />
                            </button>
                          </div>
                          {rule.type === 'original' && <p className="text-[#666] dark:text-[#9da69e] text-[11px] uppercase font-bold tracking-wider">Using original filename</p>}
                          {rule.type === 'text' && (
                            <input 
                              type="text" 
                              value={rule.value} 
                              onChange={e => updateRule(rule.id, { value: e.target.value })}
                              className="peri-input w-full bg-white dark:bg-[#191d1a] text-[#202522] dark:text-[#fafafa] text-xs px-2 py-1.5 mt-1 font-medium"
                              placeholder="Enter text..."
                            />
                          )}
                          {rule.type === 'sequence' && (
                            <div className="flex items-center gap-3 mt-1">
                              <div className="flex flex-col">
                                <span className="text-[#666] dark:text-[#9da69e] text-[10px] font-bold uppercase tracking-wider mb-0.5">Start at</span>
                                <input 
                                  type="number" 
                                  value={rule.value} 
                                  onChange={e => updateRule(rule.id, { value: e.target.value })}
                                  className="peri-input w-16 bg-white dark:bg-[#191d1a] text-[#202522] dark:text-[#fafafa] text-xs px-2 py-1.5 font-medium"
                                />
                              </div>
                              <div className="flex flex-col">
                                <span className="text-[#666] dark:text-[#9da69e] text-[10px] font-bold uppercase tracking-wider mb-0.5">Digits</span>
                                <select
                                  value={rule.padding || 3}
                                  onChange={e => updateRule(rule.id, { padding: parseInt(e.target.value) })}
                                  className="peri-select w-16 bg-white dark:bg-[#191d1a] text-[#202522] dark:text-[#fafafa] text-xs px-2 py-1.5 font-medium"
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
                            <p className="text-[#666] dark:text-[#9da69e] text-[11px] uppercase font-bold tracking-wider">YYYY-MM-DD</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="mb-3">
                    <span className="text-[#666] dark:text-[#9da69e] text-[11px] font-bold uppercase tracking-wider">Add Rule Block</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button onClick={() => addRule('text')} className="peri-button--secondary text-[#202522] dark:text-[#fafafa] font-bold uppercase tracking-wider text-[11px] py-2 flex items-center justify-center gap-1">
                      <span>+</span> Text
                    </button>
                    <button onClick={() => addRule('date')} className="peri-button--secondary text-[#202522] dark:text-[#fafafa] font-bold uppercase tracking-wider text-[11px] py-2 flex items-center justify-center gap-1">
                      <span>+</span> Date
                    </button>
                    <button onClick={() => addRule('sequence')} className="peri-button--secondary text-[#202522] dark:text-[#fafafa] font-bold uppercase tracking-wider text-[11px] py-2 flex items-center justify-center gap-1">
                      <span>+</span> Sequence
                    </button>
                    <button onClick={() => addRule('original')} className="peri-button--secondary text-[#202522] dark:text-[#fafafa] font-bold uppercase tracking-wider text-[11px] py-2 flex items-center justify-center gap-1">
                      <span>+</span> Original Name
                    </button>
                  </div>
                </>
              )}
            </div>

            {enableRenaming && (
              <div>
                <div className="text-[#666] dark:text-[#9da69e] text-[11px] font-bold uppercase tracking-wider mb-2">Example Output</div>
                <div className="peri-card bg-[#fafafa] dark:bg-[#202522] p-2.5 text-xs font-mono break-all text-[#202522] dark:text-[#fafafa]">
                  {selectedImages[0] ? computedNames[selectedImages[0]] : 'No files selected'}
                </div>
              </div>
            )}
          </div>

          {/* Dimension & Compression Options */}
          <div className="px-6 py-6 flex flex-col gap-6">
            <div className="flex flex-col gap-3">
              <label className="flex items-center gap-2 cursor-pointer group w-fit">
                <input 
                  type="checkbox" 
                  checked={enableDimensions} 
                  onChange={e => setEnableDimensions(e.target.checked)}
                  className="w-4 h-4 accent-black dark:accent-white border border-[#9faab4] dark:border-[#4a544c]"
                />
                <span className="text-xs font-bold uppercase tracking-wider text-[#666] dark:text-[#9da69e] group-hover:text-black dark:group-hover:text-white transition-colors">Resize Dimensions</span>
              </label>
              {enableDimensions && (
                <div className="peri-card ml-6 flex flex-col gap-3 bg-[#fafafa] dark:bg-[#202522] p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex flex-col">
                      <span className="text-[#666] dark:text-[#9da69e] text-[10px] font-bold uppercase tracking-wider mb-0.5">Width</span>
                      <input 
                        type="number" 
                        value={resizeWidth} 
                        onChange={e => setResizeWidth(Number(e.target.value))}
                        className="peri-input w-20 bg-white dark:bg-[#191d1a] text-[#202522] dark:text-[#fafafa] text-xs px-2 py-1.5 font-medium"
                      />
                    </div>
                    <span className="text-[#888] dark:text-[#9da69e] mt-4 font-bold">x</span>
                    <div className="flex flex-col">
                      <span className="text-[#666] dark:text-[#9da69e] text-[10px] font-bold uppercase tracking-wider mb-0.5">Height</span>
                      <input 
                        type="number" 
                        value={resizeHeight} 
                        onChange={e => setResizeHeight(Number(e.target.value))}
                        className="peri-input w-20 bg-white dark:bg-[#191d1a] text-[#202522] dark:text-[#fafafa] text-xs px-2 py-1.5 font-medium"
                      />
                    </div>
                  </div>
                  <label className="flex items-center gap-2 mt-1 cursor-pointer w-fit group">
                    <input 
                      type="checkbox" 
                      checked={maintainAspect} 
                      onChange={e => setMaintainAspect(e.target.checked)}
                      className="w-3.5 h-3.5 accent-black dark:accent-white"
                    />
                    <span className="text-[11px] font-bold uppercase tracking-wider text-[#666] dark:text-[#9da69e] group-hover:text-black dark:group-hover:text-white">Maintain aspect ratio</span>
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
                  className="w-4 h-4 accent-black dark:accent-white border border-[#9faab4] dark:border-[#4a544c]"
                />
                <span className="text-xs font-bold uppercase tracking-wider text-[#666] dark:text-[#9da69e] group-hover:text-black dark:group-hover:text-white transition-colors">Compress File Size</span>
              </label>
              {enableFilesize && (
                <div className="peri-card ml-6 flex items-center gap-3 bg-[#fafafa] dark:bg-[#202522] p-4">
                  <span className="text-[#666] dark:text-[#9da69e] text-[11px] font-bold uppercase tracking-wider">Target Size:</span>
                  <input 
                    type="number" 
                    value={targetFileSize} 
                    onChange={e => setTargetFileSize(Number(e.target.value))}
                    className="peri-input w-20 bg-white dark:bg-[#191d1a] text-[#202522] dark:text-[#fafafa] text-xs px-2 py-1.5 font-medium"
                  />
                  <span className="text-[#666] dark:text-[#9da69e] text-[11px] font-bold uppercase tracking-wider">KB</span>
                </div>
              )}
            </div>
          </div>

          {/* Staging Summary */}
          <div className="border-t border-[#e5e5e5] dark:border-[#333a35] bg-[#fafafa] dark:bg-[#191d1a] px-6 py-5">
            <div className="peri-card flex flex-col gap-3 bg-white dark:bg-[#202522] p-4">
              <div className="text-[11px] font-bold uppercase tracking-[0.22em] text-[#666] dark:text-[#9da69e]">
                Staging Summary
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-[11px] uppercase tracking-wider text-[#666] dark:text-[#9da69e]">
                <div>Source</div>
                <div className="text-right font-bold text-black dark:text-[#fafafa]">{isLocalMode ? 'Local folder' : 'Server library'}</div>
                <div>Total</div>
                <div className="text-right font-bold text-black dark:text-[#fafafa]">{selectedImages.length}</div>
                <div>Selected</div>
                <div className="text-right font-bold text-black dark:text-[#fafafa]">{selectedForDownload.size}</div>
                <div>Images</div>
                <div className="text-right font-bold text-black dark:text-[#fafafa]">{stagingSummary.imageCount}</div>
                <div>Videos</div>
                <div className="text-right font-bold text-black dark:text-[#fafafa]">{stagingSummary.videoCount}</div>
                <div>Other files</div>
                <div className="text-right font-bold text-black dark:text-[#fafafa]">{stagingSummary.otherCount}</div>
                <div>Selected size</div>
                <div className="text-right font-bold text-black dark:text-[#fafafa]">
                  {selectedForDownload.size === 0
                    ? '0 B'
                    : stagingSummary.itemsWithSize > 0
                      ? formatFileSize(stagingSummary.selectedBytes)
                      : 'Not available'}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Panel: Thumbnails */}
        <div className="flex-1 w-full bg-[#fafafa] dark:bg-[#171a18]">
          {selectedImages.length === 0 ? (
            <div className="peri-card p-12 text-center text-xs font-bold uppercase tracking-widest text-[#666] dark:text-[#9da69e]">
              No items in staging.
            </div>
          ) : (
            <div className="flex flex-wrap gap-4 sm:gap-6">
              {selectedImages.map(img => (
                (() => {
                  const meta = selectedMetadata?.[img];
                  const isMissing = Boolean(meta?.isMissing);
                  const retryToken = previewRetryTokens[img] || 0;
                  return (
                <div 
                  key={img} 
                  className={`peri-card flex flex-col transition-all bg-white dark:bg-[#191d1a] ${selectedForDownload.has(img) ? 'is-selected shadow-[0_12px_28px_rgba(15,23,42,0.12)]' : 'opacity-70 hover:opacity-100'}`}
                >
                  <div 
                    data-image-container
                    className="h-[200px] border-b border-[#d4d4d8] dark:border-[#333a35] bg-[#eef2f6] dark:bg-[#202522] relative flex items-center justify-center overflow-hidden cursor-pointer"
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
                      <div className={`w-5 h-5 border flex items-center justify-center transition-colors ${isMissing ? 'bg-[#F3E8E2] dark:bg-[#3d2b24] border-[#B89D91] dark:border-[#6e4e42]' : selectedForDownload.has(img) ? 'bg-[#202522] dark:bg-[#fafafa] border-[#202522] dark:border-[#fafafa]' : 'bg-white dark:bg-[#191d1a] border-[#9faab4] dark:border-[#4a544c] hover:border-[#202522] dark:hover:border-[#fafafa]'}`}>
                        {selectedForDownload.has(img) && <Check size={14} className="text-white dark:text-black" strokeWidth={3} />}
                      </div>
                    </button>

                    {isMissing ? (
                      <div className="flex h-full w-full flex-col items-center justify-center gap-3 bg-[#F8F3F1] dark:bg-[#2a221f] px-5 text-center text-[#8A5A44] dark:text-[#e09f80]">
                        <div className="border-[2px] border-[#B89D91] dark:border-[#6e4e42] bg-white dark:bg-[#191d1a] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.25em]">
                          Missing
                        </div>
                        <div className="max-w-[180px] text-[11px] font-bold uppercase leading-relaxed text-[#7A5A49] dark:text-[#d19375]">
                          This shared file is no longer available in the live library.
                        </div>
                      </div>
                    ) : (meta?.kind || getMediaKind(img)) === 'video' ? (
                      <>
                        <video
                          src={getOriginalUrl ? getOriginalUrl(img, retryToken) : `${APIBASE}/images/${encodeAssetPath(img)}?r=${retryToken}`}
                          className="h-full w-auto object-contain"
                          muted
                          loop
                          playsInline
                          preload="metadata"
                          onMouseEnter={e => {
                            e.currentTarget.play().catch(() => {});
                          }}
                          onMouseLeave={e => {
                            e.currentTarget.pause();
                            e.currentTarget.currentTime = 0;
                          }}
                        />
                        <div className="absolute top-2 right-2 z-20 peri-chip bg-[#fff7d6] dark:bg-[#3d3214] text-black dark:text-[#fef08a] px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider">
                          VID
                        </div>
                      </>
                    ) : isRenderable(img) ? (
                      <>
                        <img 
                          src={getPreviewUrl ? getPreviewUrl(img, 240, 480, retryToken) : buildThumbUrl(img, 240, 480, retryToken)} 
                          alt={img} 
                          loading="lazy" 
                          referrerPolicy="no-referrer" 
                          className="h-full w-auto object-contain"
                          onLoad={handleImageLoad}
                          onError={(event) => handleThumbImageError(event, getOriginalUrl ? getOriginalUrl(img, retryToken) : `${APIBASE}/images/${encodeAssetPath(img)}?r=${retryToken}`)}
                        />
                        <div
                          data-image-fallback
                          className="hidden h-full w-full flex-col items-center justify-center gap-3 bg-[#F8F3F1] dark:bg-[#2a221f] px-5 text-center text-[#8A5A44] dark:text-[#e09f80]"
                        >
                          <div className="border-[2px] border-[#B89D91] dark:border-[#6e4e42] bg-white dark:bg-[#191d1a] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.25em]">
                            Preview
                          </div>
                          <div className="max-w-[180px] text-[11px] font-bold uppercase leading-relaxed text-[#7A5A49] dark:text-[#d19375]">
                            This image preview is unavailable right now.
                          </div>
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              resetImageFallback(event.currentTarget.closest('[data-image-container]'));
                              setPreviewRetryTokens(prev => ({ ...prev, [img]: (prev[img] || 0) + 1 }));
                            }}
                            className="peri-button--secondary px-3 py-1 text-[10px] uppercase tracking-widest"
                          >
                            Retry
                          </button>
                        </div>
                        {isLargeMap?.[img] && (
                          <div className="absolute top-2 right-2 z-20 peri-chip bg-[#fff7d6] dark:bg-[#3d3214] text-black dark:text-[#fef08a] px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider">
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
                    <div className="border-t-[0px] px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-[#8A5A44] dark:text-[#e09f80]">
                      {meta?.name || img.split('/').pop() || img}
                    </div>
                  )}
                </div>
                  );
                })()
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
