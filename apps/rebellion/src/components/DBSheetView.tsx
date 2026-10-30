import React, { useState, useRef, useEffect, useMemo } from 'react';
import { 
  ArrowLeft, Printer, Copy, Check, Table, FileText, 
  CheckCircle2, List, AlignLeft, 
  ListOrdered, GripHorizontal, GripVertical, RefreshCw,
  AlignJustify, ArrowDownAZ, ArrowDown01, Filter, BarChart3,
  X, ChevronUp
} from 'lucide-react';
import { Paragraph, Spacing } from '../types';

interface DBSheetViewProps {
  titles: string[];
  committedStandard: Paragraph[];
  committedSpecial: Paragraph[];
  onBack: () => void;
  spacing: Spacing;
}

type StreamFilter = 'both' | 'standard' | 'highlighted';
type OrderSort = 'first_created' | 'alpha';
type DisplayMode = 'table' | 'document';
type TextFormatMode = 'paragraph' | 'list' | 'bullet' | 'numbered';

export default function DBSheetView({
  titles,
  committedStandard,
  committedSpecial,
  onBack,
}: DBSheetViewProps) {
  // Sort and stream filter state
  const [streamFilter, setStreamFilter] = useState<StreamFilter>('both');
  const [orderSort, setOrderSort] = useState<OrderSort>('first_created');

  const [displayMode, setDisplayMode] = useState<DisplayMode>('table');
  const [textFormatMode, setTextFormatMode] = useState<TextFormatMode>('paragraph');
  const [copiedSheet, setCopiedSheet] = useState(false);
  const [copiedFormatted, setCopiedFormatted] = useState(false);
  const [copiedRowIndex, setCopiedRowIndex] = useState<number | null>(null);

  // Stats Popup State
  const [showStatsModal, setShowStatsModal] = useState(false);

  // Split view dragging state (identical to main screen)
  const [splitRatio, setSplitRatio] = useState<number>(50); // percentage for left/top half
  const [isDraggingSplit, setIsDraggingSplit] = useState(false);
  const [isLandscape, setIsLandscape] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth >= 768;
    }
    return true;
  });
  const mainSplitContainerRef = useRef<HTMLDivElement>(null);
  const isLandscapeRef = useRef(isLandscape);

  useEffect(() => {
    isLandscapeRef.current = isLandscape;
  }, [isLandscape]);

  useEffect(() => {
    const checkOrientation = () => {
      const landscape = window.innerWidth >= 768;
      setIsLandscape(landscape);
      isLandscapeRef.current = landscape;
    };

    window.addEventListener('resize', checkOrientation);
    window.addEventListener('orientationchange', checkOrientation);

    return () => {
      window.removeEventListener('resize', checkOrientation);
      window.removeEventListener('orientationchange', checkOrientation);
    };
  }, []);

  useEffect(() => {
    const handlePointerMove = (clientX: number, clientY: number) => {
      if (!mainSplitContainerRef.current) return;
      const rect = mainSplitContainerRef.current.getBoundingClientRect();
      const currentIsLandscape = isLandscapeRef.current;
      
      if (currentIsLandscape) {
        if (rect.width <= 0) return;
        const offsetX = clientX - rect.left;
        const rawPercent = (offsetX / rect.width) * 100;
        const clamped = Math.min(75, Math.max(25, rawPercent));
        setSplitRatio(clamped);
      } else {
        if (rect.height <= 0) return;
        const offsetY = clientY - rect.top;
        const rawPercent = (offsetY / rect.height) * 100;
        const clamped = Math.min(75, Math.max(25, rawPercent));
        setSplitRatio(clamped);
      }
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!isDraggingSplit) return;
      e.preventDefault();
      handlePointerMove(e.clientX, e.clientY);
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!isDraggingSplit || !e.touches[0]) return;
      if (e.cancelable) e.preventDefault();
      handlePointerMove(e.touches[0].clientX, e.touches[0].clientY);
    };

    const handlePointerUp = () => {
      if (isDraggingSplit) {
        setIsDraggingSplit(false);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      }
    };

    if (isDraggingSplit) {
      document.body.style.cursor = isLandscape ? 'col-resize' : 'row-resize';
      document.body.style.userSelect = 'none';
      window.addEventListener('mousemove', handleMouseMove, { passive: false });
      window.addEventListener('mouseup', handlePointerUp);
      window.addEventListener('touchmove', handleTouchMove, { passive: false });
      window.addEventListener('touchend', handlePointerUp);
      window.addEventListener('touchcancel', handlePointerUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handlePointerUp);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handlePointerUp);
      window.removeEventListener('touchcancel', handlePointerUp);
    };
  }, [isDraggingSplit, isLandscape]);

  // Combine items with their stream type and creation order index
  const standardWithMeta = useMemo(() => committedStandard.map((item, idx) => ({
    ...item,
    type: 'standard' as const,
    originalOrder: idx,
  })), [committedStandard]);

  const specialWithMeta = useMemo(() => committedSpecial.map((item, idx) => ({
    ...item,
    type: 'highlighted' as const,
    originalOrder: committedStandard.length + idx,
  })), [committedSpecial, committedStandard.length]);

  const displayedRecords = useMemo(() => {
    let items: Array<Paragraph & { type: 'standard' | 'highlighted'; originalOrder: number }> = [];
    if (streamFilter === 'both') {
      items = [...standardWithMeta, ...specialWithMeta];
    } else if (streamFilter === 'standard') {
      items = [...standardWithMeta];
    } else {
      items = [...specialWithMeta];
    }

    if (orderSort === 'alpha') {
      items.sort((a, b) => a.text.localeCompare(b.text, undefined, { sensitivity: 'base', numeric: true }));
    } else {
      items.sort((a, b) => a.originalOrder - b.originalOrder);
    }

    return items;
  }, [streamFilter, orderSort, standardWithMeta, specialWithMeta]);

  // Formatted Text Generation:
  // 1. paragraph: combined into a single normal paragraph with spaces between but no line breaks
  // 2. list: plain list with no bullets but with line breaks
  // 3. bullet: bulleted list with line breaks
  // 4. numbered: numbered list with line breaks
  const formattedText = useMemo(() => {
    if (displayedRecords.length === 0) return '';

    const cleanTexts = displayedRecords
      .map(r => r.text.trim())
      .filter(t => t.length > 0);

    if (textFormatMode === 'paragraph') {
      // Single continuous paragraph with spaces, no line breaks
      return cleanTexts.join(' ');
    } else if (textFormatMode === 'list') {
      // Plain list with line breaks, no bullets
      return cleanTexts.join('\n');
    } else if (textFormatMode === 'bullet') {
      // Bulleted list with line breaks
      return cleanTexts.map(t => `• ${t}`).join('\n');
    } else if (textFormatMode === 'numbered') {
      // Numbered list with line breaks
      return cleanTexts.map((t, i) => `${i + 1}. ${t}`).join('\n');
    }
    return cleanTexts.join(' ');
  }, [displayedRecords, textFormatMode]);

  const [customText, setCustomText] = useState<string | null>(null);

  const activeFormattedText = customText !== null ? customText : formattedText;

  const handleFormatChange = (mode: TextFormatMode) => {
    setTextFormatMode(mode);
    setCustomText(null);
  };

  const handleStreamFilterChange = (filter: StreamFilter) => {
    setStreamFilter(filter);
    setCustomText(null);
  };

  const handleOrderSortChange = (sort: OrderSort) => {
    setOrderSort(sort);
    setCustomText(null);
  };

  const currentDate = new Date().toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  const handlePrint = () => {
    window.print();
  };

  const handleCopySheet = () => {
    const textToCopy = displayedRecords
      .map(r => `[${r.type.toUpperCase()}]\n${r.text}`)
      .join('\n\n---\n\n');
    
    navigator.clipboard.writeText(textToCopy);
    setCopiedSheet(true);
    setTimeout(() => setCopiedSheet(false), 2000);
  };

  const handleCopyFormatted = () => {
    navigator.clipboard.writeText(activeFormattedText);
    setCopiedFormatted(true);
    setTimeout(() => setCopiedFormatted(false), 2000);
  };

  const handleCopySingle = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedRowIndex(index);
    setTimeout(() => setCopiedRowIndex(null), 1500);
  };

  // Detailed Metrics Computation for Stats Popup
  const metrics = useMemo(() => {
    const text = activeFormattedText;
    const trimmed = text.trim();
    
    // Words
    const words = trimmed ? trimmed.split(/\s+/).length : 0;
    
    // Characters
    const charsTotal = text.length;
    const charsNoSpaces = text.replace(/\s/g, '').length;
    
    // Line breaks
    const lineBreaks = text ? (text.match(/\n/g) || []).length : 0;
    
    // Paragraphs (double newlines or distinct chunks)
    const paragraphsCount = trimmed 
      ? trimmed.split(/\n\s*\n/).filter(p => p.trim().length > 0).length 
      : 0;

    // Lines / Items count
    const totalLines = trimmed ? trimmed.split(/\n/).length : 0;

    // Bullets (lines starting with • or bullet character)
    const bulletsCount = text ? (text.match(/^\s*•/gm) || []).length : 0;

    // Numbered items
    const numberedCount = text ? (text.match(/^\s*\d+\./gm) || []).length : 0;

    // Entries in sheet
    const rawEntries = displayedRecords.length;

    return {
      words,
      charsTotal,
      charsNoSpaces,
      lineBreaks,
      paragraphsCount,
      totalLines,
      bulletsCount,
      numberedCount,
      rawEntries,
    };
  }, [activeFormattedText, displayedRecords.length]);

  return (
    <div className="h-screen max-h-screen bg-black flex flex-col justify-between font-serif text-gray-300 overflow-hidden relative">
      {/* Top Banner (Identical to Main Screen) */}
      <div className="h-[36px] bg-white border-b-[3px] border-red-500 w-full shrink-0 flex items-center justify-between px-6 no-print">
        <div className="flex items-center gap-3">
          <button 
            onClick={onBack}
            className="flex items-center gap-1.5 text-black hover:text-red-600 font-sans font-bold text-xs uppercase tracking-wider transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to Editor
          </button>
          <span className="text-black/30 font-sans">|</span>
          <span className="font-sans font-bold text-black tracking-wide text-sm">
            Database Sheet & Formatter
          </span>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handlePrint}
            className="flex items-center gap-1 text-black/70 hover:text-red-600 font-sans font-bold text-xs uppercase tracking-wider transition-colors"
          >
            <Printer className="w-3.5 h-3.5" />
            Print / PDF
          </button>
          <span className="font-sans text-[11px] text-black/50 hidden sm:inline">
            {currentDate}
          </span>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 p-4 md:px-8 py-4 w-full flex flex-col min-h-0 overflow-hidden">
        {/* Header Titles & Options Bar */}
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3 shrink-0 no-print">
          {/* Document Titles */}
          <div className="flex items-center gap-3">
            <h1 className="font-sans text-2xl md:text-3xl font-bold text-white tracking-tight">
              {titles[0] || "Committed Sheet"}
            </h1>
            {titles.length > 1 && (
              <span className="text-white/40 font-sans text-sm">
                + {titles.length - 1} subtitle{titles.length > 2 ? 's' : ''}
              </span>
            )}
          </div>

          {/* Sort & Filter Controls Bar */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Stream Selector: Both / Standard / Highlighted */}
            <div className="flex items-center gap-0 bg-black/40 p-0.5 rounded-full border border-white/15" title="Stream filter">
              <button
                onClick={() => handleStreamFilterChange('both')}
                className={`px-2.5 py-0.5 font-sans text-[11px] leading-tight rounded-full transition-colors ${
                  streamFilter === 'both' ? 'bg-red-500 text-white font-bold shadow-sm' : 'text-white/60 hover:text-white hover:bg-white/10'
                }`}
                title="Include both Standard and Highlighted entries"
              >
                Both ({standardWithMeta.length + specialWithMeta.length})
              </button>
              <button
                onClick={() => handleStreamFilterChange('standard')}
                className={`px-2.5 py-0.5 font-sans text-[11px] leading-tight rounded-full transition-colors ${
                  streamFilter === 'standard' ? 'bg-white text-black font-bold shadow-sm' : 'text-white/60 hover:text-white hover:bg-white/10'
                }`}
                title="Include Standard entries only"
              >
                Standard ({standardWithMeta.length})
              </button>
              <button
                onClick={() => handleStreamFilterChange('highlighted')}
                className={`px-2.5 py-0.5 font-sans text-[11px] leading-tight rounded-full transition-colors ${
                  streamFilter === 'highlighted' ? 'bg-[#99ccff] text-black font-bold shadow-sm' : 'text-white/60 hover:text-white hover:bg-white/10'
                }`}
                title="Include Highlighted entries only"
              >
                Highlighted ({specialWithMeta.length})
              </button>
            </div>

            {/* Sort Order: First Created / Alpha */}
            <div className="flex items-center gap-0 bg-black/40 p-0.5 rounded-full border border-white/15" title="Sort order">
              <button
                onClick={() => handleOrderSortChange('first_created')}
                className={`px-2.5 py-0.5 font-sans text-[11px] leading-tight rounded-full transition-colors flex items-center gap-1 ${
                  orderSort === 'first_created' ? 'bg-white/20 text-white font-medium' : 'text-white/60 hover:text-white hover:bg-white/10'
                }`}
                title="Order by creation sequence"
              >
                <ArrowDown01 className="w-3 h-3 text-red-400" />
                <span>First Created</span>
              </button>
              <button
                onClick={() => handleOrderSortChange('alpha')}
                className={`px-2.5 py-0.5 font-sans text-[11px] leading-tight rounded-full transition-colors flex items-center gap-1 ${
                  orderSort === 'alpha' ? 'bg-white/20 text-white font-medium' : 'text-white/60 hover:text-white hover:bg-white/10'
                }`}
                title="Sort alphabetically A-Z"
              >
                <ArrowDownAZ className="w-3 h-3 text-red-400" />
                <span>Alpha (A-Z)</span>
              </button>
            </div>
          </div>
        </div>

        {/* Split Area: Left DB Sheet vs Right Formatted Text Box */}
        <div 
          ref={mainSplitContainerRef}
          className={`flex-1 min-h-0 flex ${isLandscape ? 'flex-row' : 'flex-col'} relative select-none`}
        >
          {/* Left / Top Side: DB Sheet Entries View */}
          <div 
            style={isLandscape ? { width: `calc(${splitRatio}% - 12px)` } : { height: `calc(${splitRatio}% - 12px)` }}
            className="flex flex-col min-w-0 min-h-0 pr-0 md:pr-2 overflow-hidden bg-white/5 border border-white/10 rounded-lg p-3.5 md:p-4"
          >
            {/* Left Header Controls */}
            <div className="flex items-center justify-between mb-3 shrink-0 pb-2.5 border-b border-white/10">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-sans text-white/70 uppercase tracking-widest font-bold">
                  Committed Sheet Entries
                </span>
                <span className="text-[10px] font-mono bg-black/40 px-2 py-0.5 rounded text-white/50 border border-white/10">
                  {displayedRecords.length}
                </span>
              </div>

              {/* Left View Switcher & Copy */}
              <div className="flex items-center gap-1.5 no-print">
                <div className="flex items-center bg-black/30 p-0.5 rounded border border-white/10">
                  <button
                    onClick={() => setDisplayMode('table')}
                    className={`p-1 rounded transition-all ${
                      displayMode === 'table' ? 'bg-white/20 text-white' : 'text-white/40 hover:text-white'
                    }`}
                    title="Table Ledger Mode"
                  >
                    <Table className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setDisplayMode('document')}
                    className={`p-1 rounded transition-all ${
                      displayMode === 'document' ? 'bg-white/20 text-white' : 'text-white/40 hover:text-white'
                    }`}
                    title="Document Stream Mode"
                  >
                    <FileText className="w-3.5 h-3.5" />
                  </button>
                </div>

                <button
                  onClick={handleCopySheet}
                  className="px-2.5 py-1 bg-white/5 hover:bg-white/10 border border-white/20 rounded text-[11px] font-sans uppercase tracking-wider text-white flex items-center gap-1 transition-colors"
                  title="Copy all sheet entries"
                >
                  {copiedSheet ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedSheet ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
            </div>

            {/* Left Scrollable Content */}
            <div className="flex-1 overflow-y-auto custom-scrollbar pr-1 min-h-0">
              {displayedRecords.length === 0 ? (
                <div className="h-full py-12 flex flex-col items-center justify-center border border-dashed border-white/10 rounded-lg text-center">
                  <p className="text-white/40 text-xs font-sans uppercase tracking-wider mb-1">No committed blocks for this selection</p>
                  <p className="text-white/20 text-[11px]">Commit blocks in the editor to populate the sheet.</p>
                </div>
              ) : displayMode === 'table' ? (
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-white/15 text-[10px] font-sans uppercase tracking-widest text-white/50 bg-black/20 sticky top-0 backdrop-blur-md">
                      <th className="py-2 px-2.5 w-24">Stream</th>
                      <th className="py-2 px-3">Committed Text</th>
                      <th className="py-2 px-2 text-right no-print w-10"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/10 font-sans">
                    {displayedRecords.map((record, index) => {
                      const isHigh = record.type === 'highlighted';
                      return (
                        <tr 
                          key={index} 
                          className={`transition-colors hover:bg-white/5 ${
                            isHigh ? 'bg-[#99ccff]/5' : ''
                          }`}
                        >
                          <td className="py-2.5 px-2.5 align-top">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider ${
                              isHigh 
                                ? 'bg-[#99ccff]/20 text-[#99ccff] border border-[#99ccff]/30' 
                                : 'bg-white/10 text-white/80 border border-white/20'
                            }`}>
                              {record.type}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 align-top">
                            <div className={`text-white/90 whitespace-pre-wrap ${
                              record.isBold ? 'font-bold' : ''
                            } ${record.isItalic ? 'italic' : ''} ${
                              record.fontFamily === 'serif' ? 'font-serif' :
                              record.fontFamily === 'mono' ? 'font-mono' :
                              record.fontFamily === 'sans' ? 'font-sans' : ''
                            } ${isHigh ? 'text-[#99ccff]' : 'text-gray-200'}`}>
                              {record.text}
                            </div>
                            {record.file && (
                              <div className="mt-1.5 text-[11px] text-white/50 flex items-center gap-1 bg-black/40 px-1.5 py-0.5 rounded w-fit border border-white/10">
                                <FileText className="w-2.5 h-2.5 text-red-400" />
                                <span className="font-mono text-[10px]">{record.file.name}</span>
                              </div>
                            )}
                          </td>
                          <td className="py-2.5 px-2 text-right align-top no-print">
                            <button
                              onClick={() => handleCopySingle(record.text, index)}
                              className="p-1 rounded hover:bg-white/10 text-white/40 hover:text-white transition-colors"
                              title="Copy entry text"
                            >
                              {copiedRowIndex === index ? (
                                <CheckCircle2 className="w-3.5 h-3.5 text-green-400" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              ) : (
                <div className="space-y-3">
                  {displayedRecords.map((record, index) => {
                    const isHigh = record.type === 'highlighted';
                    return (
                      <div 
                        key={index} 
                        className={`p-3 rounded border transition-colors ${
                          isHigh 
                            ? 'bg-[#99ccff]/5 border-[#99ccff]/30 text-[#99ccff]' 
                            : 'bg-black/30 border-white/10 text-gray-200'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1 text-[9px] font-mono uppercase tracking-wider opacity-60">
                          <span>{record.type}</span>
                        </div>
                        <p className={`whitespace-pre-wrap text-sm leading-relaxed ${
                          record.isBold ? 'font-bold' : ''
                        } ${record.isItalic ? 'italic' : ''} ${
                          record.fontFamily === 'serif' ? 'font-serif' :
                          record.fontFamily === 'mono' ? 'font-mono' :
                          record.fontFamily === 'sans' ? 'font-sans' : ''
                        }`}>
                          {record.text}
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Left Footer Summary */}
            <div className="mt-2.5 pt-2 border-t border-white/10 flex items-center justify-between text-[10px] font-sans text-white/40 shrink-0">
              <span className="uppercase font-medium text-white/60">{streamFilter} • {orderSort === 'alpha' ? 'A-Z' : 'First Created'}</span>
              <span className="font-mono">Std: {standardWithMeta.length} | High: {specialWithMeta.length}</span>
            </div>
          </div>

          {/* Draggable Divider Border Line Between Halves */}
          <div
            onMouseDown={(e) => {
              e.preventDefault();
              setIsDraggingSplit(true);
            }}
            onTouchStart={() => {
              setIsDraggingSplit(true);
            }}
            onDoubleClick={() => setSplitRatio(50)}
            onKeyDown={(e) => {
              if (isLandscape) {
                if (e.key === 'ArrowLeft') {
                  e.preventDefault();
                  setSplitRatio(prev => Math.max(25, prev - 5));
                } else if (e.key === 'ArrowRight') {
                  e.preventDefault();
                  setSplitRatio(prev => Math.min(75, prev + 5));
                }
              } else {
                if (e.key === 'ArrowUp') {
                  e.preventDefault();
                  setSplitRatio(prev => Math.max(25, prev - 5));
                } else if (e.key === 'ArrowDown') {
                  e.preventDefault();
                  setSplitRatio(prev => Math.min(75, prev + 5));
                }
              }
            }}
            tabIndex={0}
            role="separator"
            aria-valuenow={Math.round(splitRatio)}
            aria-valuemin={25}
            aria-valuemax={75}
            aria-label="Resize border between sheet entries and formatted text box"
            className={`group relative flex items-center justify-center select-none shrink-0 outline-none touch-none transition-all ${
              isLandscape 
                ? 'w-6 my-0 mx-1 cursor-col-resize h-full self-stretch' 
                : 'h-6 mx-0 my-1 cursor-row-resize w-full self-stretch'
            } ${isDraggingSplit ? 'text-red-400' : 'text-white/30 hover:text-white/80'}`}
            title={`Drag to resize (${isLandscape ? 'left/right' : 'higher/lower'}, 25% - 75%), double click to center`}
          >
            {/* Divider Line */}
            <div className={`transition-all duration-150 ${
              isLandscape 
                ? 'h-full w-[1px]' 
                : 'w-full h-[1px]'
            } ${
              isDraggingSplit ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]' : 'bg-white/15 group-hover:bg-white/40'
            }`} />

            {/* Center Grip Indicator Pill */}
            <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 px-2 py-1 rounded-full border flex items-center justify-center backdrop-blur-sm transition-all duration-150 z-20 ${
              isDraggingSplit 
                ? 'bg-black border-red-500 text-red-400 shadow-lg scale-110' 
                : 'bg-black/90 border-white/20 text-white/40 group-hover:text-white group-hover:border-white/40 group-focus:border-red-500'
            }`}>
              {isLandscape ? <GripVertical className="w-3.5 h-3.5" /> : <GripHorizontal className="w-3.5 h-3.5" />}
            </div>
          </div>

          {/* Right / Bottom Side: Formatted Text Box */}
          <div 
            style={isLandscape ? { width: `calc(${100 - splitRatio}% - 12px)` } : { height: `calc(${100 - splitRatio}% - 12px)` }}
            className="flex flex-col min-w-0 min-h-0 pl-0 md:pl-2 overflow-hidden bg-white/5 border border-white/10 rounded-lg p-3.5 md:p-4"
          >
            {/* Right Header Controls: Format Selector */}
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3 shrink-0 pb-2.5 border-b border-white/10">
              <span className="text-[11px] font-sans text-white/70 uppercase tracking-widest font-bold">
                Formatted Text
              </span>

              {/* Format Options: Paragraph (single combined, spaces only) | List (line breaks, no bullets) | Bulleted | Numbered */}
              <div className="flex items-center gap-1 bg-black/30 p-0.5 rounded border border-white/10">
                <button
                  onClick={() => handleFormatChange('paragraph')}
                  className={`px-2 py-0.5 rounded text-[11px] font-sans font-medium uppercase tracking-wider flex items-center gap-1 transition-all ${
                    textFormatMode === 'paragraph'
                      ? 'bg-red-500 text-white font-bold shadow-sm'
                      : 'text-white/50 hover:text-white hover:bg-white/5'
                  }`}
                  title="Single combined paragraph with spaces, no line breaks"
                >
                  <AlignJustify className="w-3 h-3" />
                  <span>Paragraph</span>
                </button>
                <button
                  onClick={() => handleFormatChange('list')}
                  className={`px-2 py-0.5 rounded text-[11px] font-sans font-medium uppercase tracking-wider flex items-center gap-1 transition-all ${
                    textFormatMode === 'list'
                      ? 'bg-red-500 text-white font-bold shadow-sm'
                      : 'text-white/50 hover:text-white hover:bg-white/5'
                  }`}
                  title="List with line breaks, no bullets"
                >
                  <AlignLeft className="w-3 h-3" />
                  <span>List</span>
                </button>
                <button
                  onClick={() => handleFormatChange('bullet')}
                  className={`px-2 py-0.5 rounded text-[11px] font-sans font-medium uppercase tracking-wider flex items-center gap-1 transition-all ${
                    textFormatMode === 'bullet'
                      ? 'bg-red-500 text-white font-bold shadow-sm'
                      : 'text-white/50 hover:text-white hover:bg-white/5'
                  }`}
                  title="Bulleted list with line breaks"
                >
                  <List className="w-3 h-3" />
                  <span>Bulleted</span>
                </button>
                <button
                  onClick={() => handleFormatChange('numbered')}
                  className={`px-2 py-0.5 rounded text-[11px] font-sans font-medium uppercase tracking-wider flex items-center gap-1 transition-all ${
                    textFormatMode === 'numbered'
                      ? 'bg-red-500 text-white font-bold shadow-sm'
                      : 'text-white/50 hover:text-white hover:bg-white/5'
                  }`}
                  title="Numbered list with line breaks"
                >
                  <ListOrdered className="w-3 h-3" />
                  <span>Numbered</span>
                </button>

                {/* Reset custom edits */}
                {customText !== null && (
                  <button
                    onClick={() => setCustomText(null)}
                    className="p-1 ml-0.5 rounded bg-white/5 hover:bg-white/15 text-white/50 hover:text-white transition-colors"
                    title="Reset to generated format"
                  >
                    <RefreshCw className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>

            {/* Right Textarea Formatted Output */}
            <div className="flex-1 flex flex-col min-h-0 relative">
              <textarea
                value={activeFormattedText}
                onChange={(e) => setCustomText(e.target.value)}
                placeholder="Commit text blocks in editor to generate formatted output here."
                className="w-full flex-1 min-h-0 bg-black/40 border border-white/10 rounded-md p-3.5 font-sans text-sm text-gray-100 leading-relaxed outline-none resize-none focus:border-red-500/50 transition-colors custom-scrollbar"
                spellCheck={false}
              />
            </div>

            {/* Right Footer Stats & Popup Toggle */}
            <div className="mt-2.5 pt-2 border-t border-white/10 flex items-center justify-between text-[10px] font-sans text-white/40 shrink-0">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowStatsModal(prev => !prev)}
                  className={`px-2.5 py-0.5 rounded border flex items-center gap-1.5 font-sans text-[10px] uppercase tracking-wider font-bold transition-all cursor-pointer ${
                    showStatsModal 
                      ? 'bg-red-500 border-red-400 text-white shadow-md' 
                      : 'bg-white/10 hover:bg-white/20 border-white/20 text-white/90 hover:text-white'
                  }`}
                  title="Toggle detailed count statistics popup"
                >
                  <BarChart3 className="w-3 h-3 text-red-300" />
                  <span>Count</span>
                  <ChevronUp className={`w-3 h-3 transition-transform ${showStatsModal ? 'rotate-180' : ''}`} />
                </button>
                <span>•</span>
                <span>{metrics.words} words</span>
                <span>•</span>
                <span>{metrics.charsTotal} chars</span>
              </div>

              <div className="flex items-center gap-2">
                {customText !== null && <span className="text-amber-400/70 italic mr-1">Edited</span>}
                <button
                  onClick={handleCopyFormatted}
                  disabled={!activeFormattedText.trim()}
                  className={`px-2.5 py-0.5 rounded border flex items-center gap-1.5 font-sans text-[10px] uppercase tracking-wider font-bold transition-all ${
                    activeFormattedText.trim()
                      ? copiedFormatted 
                        ? 'bg-green-600 border-green-500 text-white cursor-pointer shadow-sm'
                        : 'bg-red-500 hover:bg-red-600 border-red-400 text-white cursor-pointer shadow-sm'
                      : 'bg-white/5 border-white/10 text-white/30 cursor-not-allowed'
                  }`}
                  title="Copy formatted text"
                >
                  {copiedFormatted ? <Check className="w-3 h-3 text-white" /> : <Copy className="w-3 h-3 text-white" />}
                  <span>{copiedFormatted ? 'Copied' : 'Copy Text'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Floating Detailed Count Statistics Popup Modal */}
      {showStatsModal && (
        <>
          <div 
            className="fixed inset-0 z-40 bg-black/20"
            onClick={() => setShowStatsModal(false)}
          />
          <div className="absolute bottom-12 right-6 md:right-10 z-50 bg-neutral-900 border border-white/20 rounded-lg shadow-2xl p-4 w-72 md:w-80 backdrop-blur-xl text-white animate-in fade-in slide-in-from-bottom-2 duration-150">
            <div className="flex items-center justify-between pb-2 mb-3 border-b border-white/15">
              <div className="flex items-center gap-1.5">
                <BarChart3 className="w-4 h-4 text-red-400" />
                <span className="font-sans font-bold text-xs uppercase tracking-wider text-white">
                  Detailed Count Statistics
                </span>
              </div>
              <button
                onClick={() => setShowStatsModal(false)}
                className="p-1 rounded text-white/40 hover:text-white hover:bg-white/10 transition-colors"
                title="Close popup"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs font-sans">
              {/* Words */}
              <div className="bg-black/50 p-2.5 rounded border border-white/10">
                <div className="text-[10px] uppercase tracking-wider text-white/50">Words</div>
                <div className="text-base font-bold font-mono text-white mt-0.5">{metrics.words}</div>
              </div>

              {/* Characters Total */}
              <div className="bg-black/50 p-2.5 rounded border border-white/10">
                <div className="text-[10px] uppercase tracking-wider text-white/50">Characters (all)</div>
                <div className="text-base font-bold font-mono text-white mt-0.5">{metrics.charsTotal}</div>
              </div>

              {/* Characters without Spaces */}
              <div className="bg-black/50 p-2.5 rounded border border-white/10">
                <div className="text-[10px] uppercase tracking-wider text-white/50">Chars (no spaces)</div>
                <div className="text-base font-bold font-mono text-white mt-0.5">{metrics.charsNoSpaces}</div>
              </div>

              {/* Paragraphs */}
              <div className="bg-black/50 p-2.5 rounded border border-white/10">
                <div className="text-[10px] uppercase tracking-wider text-white/50">Paragraphs</div>
                <div className="text-base font-bold font-mono text-white mt-0.5">{metrics.paragraphsCount}</div>
              </div>

              {/* Line Breaks */}
              <div className="bg-black/50 p-2.5 rounded border border-white/10">
                <div className="text-[10px] uppercase tracking-wider text-white/50">Line Breaks (\n)</div>
                <div className="text-base font-bold font-mono text-white mt-0.5">{metrics.lineBreaks}</div>
              </div>

              {/* Bullets or Numbered items */}
              <div className="bg-black/50 p-2.5 rounded border border-white/10">
                <div className="text-[10px] uppercase tracking-wider text-white/50">
                  {textFormatMode === 'bullet' ? 'Bullets (•)' : textFormatMode === 'numbered' ? 'Numbered (1...)' : 'List Lines'}
                </div>
                <div className="text-base font-bold font-mono text-white mt-0.5">
                  {textFormatMode === 'bullet' ? metrics.bulletsCount : textFormatMode === 'numbered' ? metrics.numberedCount : metrics.totalLines}
                </div>
              </div>
            </div>

            <div className="mt-3 pt-2 border-t border-white/10 flex items-center justify-between text-[10px] font-sans text-white/40">
              <span>Raw Sheet Entries: <strong className="text-white font-mono">{metrics.rawEntries}</strong></span>
              <span className="uppercase">{textFormatMode} Mode</span>
            </div>
          </div>
        </>
      )}

      {/* Bottom Red-Accent Banner (Identical to Main Screen) */}
      <div className="h-[36px] bg-white border-t-[3px] border-red-500 w-full shrink-0 no-print"></div>
    </div>
  );
}
