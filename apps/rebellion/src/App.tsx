import React, { useState, useRef, useEffect } from 'react';
import { 
  Edit2, Plus, Copy, Check, FileText, Trash2, 
  ArrowUp, ArrowDown, RotateCcw, GripHorizontal, GripVertical,
  FileSpreadsheet, CornerDownLeft, ArrowRightToLine, Indent
} from 'lucide-react';
import { Paragraph, Spacing, FontSize, FontFamily, InputDirection } from './types';
import DBSheetView from './components/DBSheetView';

export default function App() {
  const [viewMode, setViewMode] = useState<'editor' | 'sheet'>('editor');
  const [titles, setTitles] = useState<string[]>(["Exploring the Digital Void"]);
  const [editingTitleIndex, setEditingTitleIndex] = useState<number | null>(null);
  const [editingTitleText, setEditingTitleText] = useState("");
  
  const [paragraphs, setParagraphs] = useState<Paragraph[]>([]);
  const [committedStandard, setCommittedStandard] = useState<Paragraph[]>([]);
  const [committedSpecial, setCommittedSpecial] = useState<Paragraph[]>([]);
  const [currentInput, setCurrentInput] = useState("");
  
  const [spacing, setSpacing] = useState<Spacing>('short');
  const [fontSize, setFontSize] = useState<FontSize>('small');
  const [fontFamily, setFontFamily] = useState<FontFamily>('serif');
  const [isBold, setIsBold] = useState(false);
  const [isItalic, setIsItalic] = useState(false);
  const [inputDirection, setInputDirection] = useState<InputDirection>('bottom');
  const [enterCreatesLineBreak, setEnterCreatesLineBreak] = useState(false);
  const [tabCreatesIndent, setTabCreatesIndent] = useState(false);

  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editingText, setEditingText] = useState("");
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const [editingCommitted, setEditingCommitted] = useState<{ type: 'standard' | 'special'; index: number } | null>(null);
  const [editingCommittedText, setEditingCommittedText] = useState("");

  // Split ratio between Input/Builder and Committed Blocks (percentage between 25% and 75%)
  const [splitRatio, setSplitRatio] = useState<number>(50);
  const [isDraggingSplit, setIsDraggingSplit] = useState(false);
  const [isLandscape, setIsLandscape] = useState<boolean>(() => {
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
        // Clamped strictly between 25% and 75%
        const clamped = Math.min(75, Math.max(25, rawPercent));
        setSplitRatio(clamped);
      } else {
        if (rect.height <= 0) return;
        const offsetY = clientY - rect.top;
        const rawPercent = (offsetY / rect.height) * 100;
        // Clamped strictly between 25% and 75%
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

  const saveTitleEdit = () => {
    if (editingTitleIndex !== null) {
      const newTitles = [...titles];
      if (editingTitleText.trim() === "") {
        if (newTitles.length > 1) {
          newTitles.splice(editingTitleIndex, 1);
        } else {
          newTitles[editingTitleIndex] = "Untitled";
        }
      } else {
        newTitles[editingTitleIndex] = editingTitleText.trim();
      }
      setTitles(newTitles);
      setEditingTitleIndex(null);
    }
  };

  const handleCopy = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const processFiles = (files: FileList | File[], isSpecial: boolean) => {
    const newParagraphs: Paragraph[] = [];
    
    Array.from(files).forEach(file => {
      const isImage = file.type.startsWith('image/');
      const url = URL.createObjectURL(file);
      
      newParagraphs.push({
        text: isImage ? "" : file.name,
        isSpecial,
        fontSize,
        fontFamily,
        isBold,
        isItalic,
        file: {
          name: file.name,
          type: file.type,
          url,
          isImage
        }
      });
    });

    if (newParagraphs.length > 0) {
      if (inputDirection === 'bottom') {
        setParagraphs(prev => [...prev, ...newParagraphs]);
      } else {
        setParagraphs(prev => [...newParagraphs, ...prev]);
      }
    }
  };

  const handleClearAll = (target: 'builder' | 'standard' | 'special') => {
    if (target === 'builder') setParagraphs([]);
    if (target === 'standard') setCommittedStandard([]);
    if (target === 'special') setCommittedSpecial([]);
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData.items;
    const files: File[] = [];
    
    for (let i = 0; i < items.length; i++) {
      if (items[i].kind === 'file') {
        const file = items[i].getAsFile();
        if (file) files.push(file);
      }
    }

    if (files.length > 0) {
      processFiles(files, e.ctrlKey || e.metaKey);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFiles(e.dataTransfer.files, e.ctrlKey || e.metaKey);
    }
  };

  const handleCopyAll = (target: 'standard' | 'special') => {
    const list = target === 'standard' ? committedStandard : committedSpecial;
    const text = list.map(p => {
      let line = p.text;
      if (p.file) {
        const fileInfo = `[${p.file.isImage ? 'IMAGE' : 'FILE'}: ${p.file.name}]`;
        line = line ? `${fileInfo} ${line}` : fileInfo;
      }
      return line;
    }).join('\n');
    navigator.clipboard.writeText(text);
    setCopiedIndex(-2);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const submitCurrentInput = (isSpecialFlag: boolean) => {
    if (currentInput.trim() !== '') {
      const newP: Paragraph = { 
        text: currentInput.trim(), 
        isSpecial: isSpecialFlag,
        fontSize,
        fontFamily,
        isBold,
        isItalic
      };
      if (inputDirection === 'bottom') {
        setParagraphs(prev => [...prev, newP]);
      } else {
        setParagraphs(prev => [newP, ...prev]);
      }
      setCurrentInput('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Tab') {
      if (tabCreatesIndent) {
        e.preventDefault();
        const target = e.currentTarget;
        const start = target.selectionStart;
        const end = target.selectionEnd;
        const value = currentInput;
        const tabChar = '\t';
        const newValue = value.substring(0, start) + tabChar + value.substring(end);
        setCurrentInput(newValue);
        requestAnimationFrame(() => {
          target.selectionStart = target.selectionEnd = start + tabChar.length;
        });
      }
      return;
    }

    if (enterCreatesLineBreak) {
      // Line break mode: normal Enter creates newline. Ctrl+Enter or Cmd+Enter submits
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        submitCurrentInput(true);
      }
    } else {
      // Submit mode: Enter submits. Shift+Enter creates newline
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        submitCurrentInput(e.ctrlKey || e.metaKey);
      }
    }
  };

  const startEditing = (index: number) => {
    setEditingIndex(index);
    setEditingText(paragraphs[index].text);
  };

  const saveEdit = () => {
    if (editingIndex !== null) {
      const newParagraphs = [...paragraphs];
      if (editingText.trim() === "") {
        newParagraphs.splice(editingIndex, 1);
      } else {
        newParagraphs[editingIndex] = { ...newParagraphs[editingIndex], text: editingText.trim() };
      }
      setParagraphs(newParagraphs);
      setEditingIndex(null);
      setEditingText("");
    }
  };

  const spacingClass = {
    short: 'gap-0',
    medium: 'gap-1.5',
    wide: 'gap-3'
  }[spacing];

  const leadingClass = {
    short: 'leading-[1.15]',
    medium: 'leading-[1.5]',
    wide: 'leading-[2.0]'
  }[spacing];

  const itemPaddingClass = {
    short: 'py-0 px-2',
    medium: 'py-1 px-2',
    wide: 'py-2 px-2'
  }[spacing];

  const getSizeClass = (s: FontSize) => ({
    small: 'text-sm',
    medium: 'text-base',
    large: 'text-lg',
    xlarge: 'text-xl'
  }[s]);

  const getFontClass = (f: FontFamily) => ({
    serif: 'font-serif',
    sans: 'font-sans',
    mono: 'font-mono',
    system: 'font-[system-ui]'
  }[f]);

  const getStyleClasses = (b: boolean, i: boolean) => `${b ? 'font-bold' : ''} ${i ? 'italic' : ''}`;

  const renderParagraph = (p: Paragraph, index: number, listType: 'builder' | 'standard' | 'special') => {
    const pSize = getSizeClass(p.fontSize);
    const pFont = getFontClass(p.fontFamily);
    const pStyle = getStyleClasses(p.isBold, p.isItalic);

    const isEditing = listType === 'builder' 
      ? editingIndex === index 
      : (editingCommitted?.type === listType && editingCommitted?.index === index);

    const activeText = isEditing 
      ? (listType === 'builder' ? editingText : editingCommittedText) 
      : p.text;

    const handleTextChange = (val: string) => {
      if (listType === 'builder') {
        setEditingText(val);
      } else {
        setEditingCommittedText(val);
      }
    };

    const handleSave = () => {
      if (listType === 'builder') {
        saveEdit();
      } else {
        if (editingCommitted) {
          const list = editingCommitted.type === 'standard' ? committedStandard : committedSpecial;
          const setList = editingCommitted.type === 'standard' ? setCommittedStandard : setCommittedSpecial;
          const next = [...list];
          if (editingCommittedText.trim() === "") {
            next.splice(editingCommitted.index, 1);
          } else {
            next[editingCommitted.index] = { ...next[editingCommitted.index], text: editingCommittedText.trim() };
          }
          setList(next);
          setEditingCommitted(null);
          setEditingCommittedText("");
        }
      }
    };

    const handleStartEdit = () => {
      if (listType === 'builder') {
        startEditing(index);
      } else {
        setEditingCommitted({ type: listType, index });
        setEditingCommittedText(p.text);
      }
    };

    return (
      <div key={index} className={`group relative flex items-start ${itemPaddingClass} -mx-2 rounded transition-colors min-w-0 ${p.isSpecial ? 'hover:bg-[#000033]' : 'hover:bg-white/10'}`}>
        {isEditing ? (
          <textarea
            value={activeText}
            onChange={(e) => handleTextChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Tab' && tabCreatesIndent) {
                e.preventDefault();
                const target = e.currentTarget;
                const start = target.selectionStart;
                const end = target.selectionEnd;
                const val = activeText;
                const tabChar = '\t';
                const nextVal = val.substring(0, start) + tabChar + val.substring(end);
                handleTextChange(nextVal);
                requestAnimationFrame(() => {
                  target.selectionStart = target.selectionEnd = start + tabChar.length;
                });
                return;
              }
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSave();
              }
            }}
            onBlur={handleSave}
            autoFocus
            className={`w-full bg-transparent border-b border-white/50 outline-none resize-none focus:border-white transition-colors ${leadingClass} break-words min-w-0 ${pSize} ${pFont} ${pStyle} ${p.isSpecial ? 'text-[#99ccff]' : 'text-white'}`}
            rows={Math.max(1, activeText.split('\n').length)}
          />
        ) : (
          <>
            <p className={`border-l border-white/20 pl-4 flex-grow min-w-0 whitespace-pre-wrap break-words ${leadingClass} ${pSize} ${pFont} ${pStyle} ${p.isSpecial ? 'text-[#99ccff]' : 'text-white'}`}>
              {p.file ? (
                <div className="flex flex-col gap-2 py-1">
                  {p.file.isImage ? (
                    <div className="max-w-xs rounded overflow-hidden border border-white/20 shadow-lg">
                      <img src={p.file.url} alt={p.file.name} className="w-full h-auto block" />
                    </div>
                  ) : (
                    <div className="flex items-center gap-3 bg-white/5 p-3 rounded border border-white/10 max-w-sm hover:bg-white/10 transition-colors">
                      <FileText className="w-6 h-6 text-white/50" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate text-white">{p.file.name}</p>
                        <p className="text-[10px] text-white/30 uppercase tracking-widest leading-none mt-1">{p.file.type.split('/')[1] || 'FILE'}</p>
                      </div>
                    </div>
                  )}
                  {p.text && <span className="mt-1">{p.text}</span>}
                </div>
              ) : (
                p.text
              )}
            </p>
            <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity shrink-0 ml-4 self-start mt-1">
              <button
                onClick={() => handleCopy(p.text || (p.file?.name ?? ""), index)}
                className="p-1 text-white/50 hover:text-white"
                title="Copy text"
              >
                {copiedIndex === index ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
              </button>
              {!p.file && (
                <button
                  onClick={handleStartEdit}
                  className="p-1 text-white/50 hover:text-white ml-1"
                  title="Edit paragraph"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
              )}
              <button
                onClick={() => {
                  if (listType === 'builder') {
                    const next = [...paragraphs];
                    next.splice(index, 1);
                    setParagraphs(next);
                  } else {
                    const list = listType === 'standard' ? committedStandard : committedSpecial;
                    const setList = listType === 'standard' ? setCommittedStandard : setCommittedSpecial;
                    const next = [...list];
                    next.splice(index, 1);
                    setList(next);
                  }
                }}
                className="p-1 text-white/30 hover:text-red-400 ml-1 transition-colors"
                title="Delete"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </>
        )}
      </div>
    );
  };

  const hasCommittedText = committedStandard.length > 0 || committedSpecial.length > 0;

  if (viewMode === 'sheet') {
    return (
      <DBSheetView
        titles={titles}
        committedStandard={committedStandard}
        committedSpecial={committedSpecial}
        onBack={() => setViewMode('editor')}
        spacing={spacing}
      />
    );
  }

  return (
    <div className="h-screen max-h-screen bg-black flex flex-col justify-between font-serif text-gray-300 overflow-hidden">
      {/* Top Banner */}
      <div className="h-[36px] bg-white border-b-[3px] border-red-500 w-full shrink-0 flex items-center px-6">
        <span className="font-sans font-bold text-black tracking-wide text-sm">
          Jefferson Williams Dotcom
        </span>
      </div>
      
      {/* Main Content Area */}
      <div className="flex-1 p-4 md:px-8 py-4 w-full flex flex-col min-h-0 overflow-hidden">
        {/* Editable Titles */}
        <div className="mb-3 flex flex-col gap-2 shrink-0">
          {titles.map((title, index) => (
            <div key={index} className="flex items-center">
              {editingTitleIndex === index ? (
                <input
                  autoFocus
                  type="text"
                  value={editingTitleText}
                  onChange={(e) => setEditingTitleText(e.target.value)}
                  onBlur={saveTitleEdit}
                  onKeyDown={(e) => e.key === 'Enter' && saveTitleEdit()}
                  className="font-sans text-2xl md:text-3xl font-bold text-white bg-transparent outline-none border-b border-white/50 w-full max-w-2xl"
                />
              ) : (
                <div className="group flex items-center">
                  <h1 
                    className="font-sans text-2xl md:text-3xl font-bold text-white cursor-pointer"
                    onClick={() => {
                      setEditingTitleIndex(index);
                      setEditingTitleText(title);
                    }}
                  >
                    {title}
                  </h1>
                  <button
                    onClick={() => {
                      setEditingTitleIndex(index);
                      setEditingTitleText(title);
                    }}
                    className="ml-3 p-1 text-white/50 opacity-0 group-hover:opacity-100 transition-opacity hover:text-white"
                    title="Edit title"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  {titles.length < 3 && (
                    <button
                      onClick={() => {
                        setTitles([...titles, "New Title"]);
                        setEditingTitleIndex(titles.length);
                        setEditingTitleText("New Title");
                      }}
                      className="ml-1 p-1 text-white/50 opacity-0 group-hover:opacity-100 transition-opacity hover:text-white"
                      title="Add another title"
                    >
                      <Plus className="w-5 h-5" />
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Split Area: Builder/Input vs Committed Blocks */}
        <div 
          ref={mainSplitContainerRef}
          className={`flex-1 min-h-0 flex ${isLandscape ? 'flex-row' : 'flex-col'} relative select-none`}
        >
          {/* Left / Top Side: Builder (Input & Formatter) */}
          <div 
            style={isLandscape ? { width: `calc(${splitRatio}% - 12px)` } : { height: `calc(${splitRatio}% - 12px)` }}
            className="flex flex-col min-w-0 min-h-0 overflow-y-auto custom-scrollbar pr-0 md:pr-2"
          >
            {/* Controls */}
            <div className="flex flex-wrap gap-x-4 gap-y-2 mb-4 bg-white/5 p-2 rounded border border-white/10 shrink-0">
              {/* Spacing Toggle */}
              <div className="flex items-center gap-0 bg-black/20 p-0.5 rounded-full">
                {(['short', 'medium', 'wide'] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => setSpacing(s)}
                    className={`px-2 py-0.5 font-sans text-[11px] leading-tight rounded-full transition-colors ${
                      spacing === s ? 'bg-white/20 text-white' : 'bg-transparent text-white/50 hover:bg-white/10'
                    }`}
                  >
                    {s.charAt(0).toUpperCase() + s.slice(1)}
                  </button>
                ))}
              </div>

              {/* Size Toggle */}
              <div className="flex items-center gap-0 bg-black/20 p-0.5 rounded-full">
                {(['small', 'medium', 'large', 'xlarge'] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => setFontSize(s)}
                    className={`px-2 py-0.5 font-sans text-[11px] leading-tight rounded-full transition-colors ${
                      fontSize === s ? 'bg-white/20 text-white' : 'bg-transparent text-white/50 hover:bg-white/10'
                    }`}
                  >
                    {s.charAt(0).toUpperCase() + s.slice(1)}
                  </button>
                ))}
              </div>

              {/* Font Toggle */}
              <div className="flex items-center gap-0 bg-black/20 p-0.5 rounded-full">
                {(['serif', 'sans', 'mono', 'system'] as const).map((f) => (
                  <button
                    key={f}
                    onClick={() => setFontFamily(f)}
                    className={`px-2 py-0.5 font-sans text-[11px] leading-tight rounded-full transition-colors ${
                      fontFamily === f ? 'bg-white/20 text-white' : 'bg-transparent text-white/50 hover:bg-white/10'
                    }`}
                  >
                    {f.charAt(0).toUpperCase() + f.slice(1)}
                  </button>
                ))}
              </div>

              {/* Style Toggle */}
              <div className="flex items-center gap-0 bg-black/20 p-0.5 rounded-full">
                <button
                  onClick={() => setIsBold(!isBold)}
                  className={`px-2 py-0.5 font-sans text-[11px] leading-tight rounded-full transition-colors font-bold ${
                    isBold ? 'bg-white/20 text-white' : 'bg-transparent text-white/50 hover:bg-white/10'
                  }`}
                >
                  Bold
                </button>
                <button
                  onClick={() => setIsItalic(!isItalic)}
                  className={`px-2 py-0.5 font-sans text-[11px] leading-tight rounded-full transition-colors italic ${
                    isItalic ? 'bg-white/20 text-white' : 'bg-transparent text-white/50 hover:bg-white/10'
                  }`}
                >
                  Italic
                </button>
              </div>

              {/* Direction Toggle */}
              <div className="flex items-center gap-0 bg-black/20 p-0.5 rounded-full">
                <button
                  onClick={() => setInputDirection('bottom')}
                  className={`px-2 py-0.5 rounded-full transition-colors ${
                    inputDirection === 'bottom' ? 'bg-white/20 text-white' : 'bg-transparent text-white/50 hover:bg-white/10'
                  }`}
                  title="Add to bottom"
                >
                  <ArrowDown className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setInputDirection('top')}
                  className={`px-2 py-0.5 rounded-full transition-colors ${
                    inputDirection === 'top' ? 'bg-white/20 text-white' : 'bg-transparent text-white/50 hover:bg-white/10'
                  }`}
                  title="Add to top"
                >
                  <ArrowUp className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Enter Key Behavior Toggle */}
              <div className="flex items-center gap-0 bg-black/20 p-0.5 rounded-full" title="Enter key behavior">
                <button
                  onClick={() => setEnterCreatesLineBreak(false)}
                  className={`px-2 py-0.5 font-sans text-[11px] leading-tight rounded-full transition-colors flex items-center gap-1 ${
                    !enterCreatesLineBreak ? 'bg-white/20 text-white font-medium' : 'bg-transparent text-white/50 hover:bg-white/10'
                  }`}
                  title="Pressing Enter submits paragraph, Shift+Enter creates line break"
                >
                  <CornerDownLeft className="w-3 h-3" />
                  <span>Submit</span>
                </button>
                <button
                  onClick={() => setEnterCreatesLineBreak(true)}
                  className={`px-2 py-0.5 font-sans text-[11px] leading-tight rounded-full transition-colors flex items-center gap-1 ${
                    enterCreatesLineBreak ? 'bg-white/20 text-white font-medium' : 'bg-transparent text-white/50 hover:bg-white/10'
                  }`}
                  title="Pressing Enter creates a line break, Ctrl/Cmd+Enter submits"
                >
                  <CornerDownLeft className="w-3 h-3" />
                  <span>Line Break</span>
                </button>
              </div>

              {/* Tab Key Behavior Toggle */}
              <div className="flex items-center gap-0 bg-black/20 p-0.5 rounded-full" title="Tab key behavior">
                <button
                  onClick={() => setTabCreatesIndent(false)}
                  className={`px-2 py-0.5 font-sans text-[11px] leading-tight rounded-full transition-colors flex items-center gap-1 ${
                    !tabCreatesIndent ? 'bg-white/20 text-white font-medium' : 'bg-transparent text-white/50 hover:bg-white/10'
                  }`}
                  title="Tab moves focus to the next element in browser"
                >
                  <ArrowRightToLine className="w-3 h-3" />
                  <span>Tab: Nav</span>
                </button>
                <button
                  onClick={() => setTabCreatesIndent(true)}
                  className={`px-2 py-0.5 font-sans text-[11px] leading-tight rounded-full transition-colors flex items-center gap-1 ${
                    tabCreatesIndent ? 'bg-white/20 text-white font-medium' : 'bg-transparent text-white/50 hover:bg-white/10'
                  }`}
                  title="Tab inserts an indent into the text"
                >
                  <Indent className="w-3 h-3" />
                  <span>Tab: Indent</span>
                </button>
              </div>

              {/* Clear List */}
              <button
                onClick={() => handleClearAll('builder')}
                className="ml-auto px-2 py-0.5 font-sans text-[11px] leading-tight rounded-full bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors flex items-center gap-1.5"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Clear
              </button>
            </div>

            {/* Input Box */}
            <div 
              className={`mb-4 min-w-0 relative transition-all duration-200 rounded shrink-0 ${isDragging ? 'ring-2 ring-white/50 bg-white/5' : ''}`}
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
            >
              <textarea
                value={currentInput}
                onChange={(e) => setCurrentInput(e.target.value)}
                onKeyDown={handleKeyDown}
                onPaste={handlePaste}
                placeholder={
                  enterCreatesLineBreak 
                    ? "Type your paragraph here... Press Enter for line break, Ctrl/Cmd+Enter to submit."
                    : "Type your paragraph here, paste files, or drag and drop... Press Enter to submit."
                }
                className={`w-full bg-white/5 border border-white/20 rounded p-3.5 outline-none text-white resize-none focus:border-white/50 transition-colors ${leadingClass} break-words min-w-0 ${getSizeClass(fontSize)} ${getFontClass(fontFamily)} ${getStyleClasses(isBold, isItalic)}`}
                rows={3}
              />
              {currentInput.trim() && (
                <div className="absolute bottom-2.5 right-2.5 flex items-center gap-1.5 z-10">
                  <button
                    onClick={() => submitCurrentInput(false)}
                    className="px-2.5 py-1 bg-white/15 hover:bg-white/25 text-white rounded text-[10px] font-sans font-bold uppercase tracking-wider transition-colors flex items-center gap-1 border border-white/20 shadow"
                    title={enterCreatesLineBreak ? "Submit paragraph (or press Ctrl/Cmd+Enter)" : "Submit paragraph (or press Enter)"}
                  >
                    <span>Submit</span>
                  </button>
                </div>
              )}
              {isDragging && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none bg-black/40 backdrop-blur-sm rounded">
                  <div className="flex flex-col items-center text-white space-y-2">
                    <Plus className="w-8 h-8" />
                    <p className="font-sans font-bold text-sm tracking-widest uppercase">Drop Files Here</p>
                  </div>
                </div>
              )}
            </div>

            {/* Generated Paragraphs */}
            <div className={`flex flex-col flex-grow ${spacingClass}`}>
              {paragraphs.map((p, index) => renderParagraph(p, index, 'builder'))}
            </div>

            {/* Commit Button */}
            <div className="mt-auto pt-3 shrink-0">
              <button
                onClick={() => {
                  const standard = paragraphs.filter(p => !p.isSpecial);
                  const special = paragraphs.filter(p => p.isSpecial);
                  
                  setCommittedStandard(prev => [...prev, ...standard]);
                  setCommittedSpecial(prev => [...prev, ...special]);
                  setParagraphs([]);
                }}
                className="w-full bg-white/5 border border-white/20 rounded p-3 text-center font-sans font-bold tracking-widest text-white hover:bg-white/10 transition-colors"
              >
                COMMIT
              </button>
            </div>
          </div>

          {/* Draggable Divider Border Line Between Input & Committed Blocks */}
          <div
            onMouseDown={(e) => {
              e.preventDefault();
              setIsDraggingSplit(true);
            }}
            onTouchStart={(e) => {
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
            aria-label="Resize border between input builder and committed blocks"
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

            {/* Center Grip Indicator Pill (no numbers) */}
            <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 px-2 py-1 rounded-full border flex items-center justify-center backdrop-blur-sm transition-all duration-150 z-20 ${
              isDraggingSplit 
                ? 'bg-black border-red-500 text-red-400 shadow-lg scale-110' 
                : 'bg-black/90 border-white/20 text-white/40 group-hover:text-white group-hover:border-white/40 group-focus:border-red-500'
            }`}>
              {isLandscape ? <GripVertical className="w-3.5 h-3.5" /> : <GripHorizontal className="w-3.5 h-3.5" />}
            </div>
          </div>

          {/* Right / Bottom Side: Committed Blocks */}
          <div 
            style={isLandscape ? { width: `calc(${100 - splitRatio}% - 12px)` } : { height: `calc(${100 - splitRatio}% - 12px)` }}
            className="flex flex-col gap-4 min-w-0 min-h-0 pl-0 md:pl-2 overflow-hidden"
          >
            {/* Top Sub-Section: Standard Text */}
            <div className="flex-1 flex flex-col min-h-0 overflow-hidden border-b border-white/10 pb-2">
              <div className="flex items-center justify-between mb-2 shrink-0">
                <div className="flex items-center gap-4">
                  <span className="text-[10px] font-sans text-white/50 uppercase tracking-widest">Standard Text</span>
                  {committedStandard.length > 0 && (
                    <button 
                      onClick={() => handleCopyAll('standard')}
                      className="text-[10px] text-white/30 hover:text-white uppercase tracking-widest flex items-center gap-1 transition-colors"
                    >
                      {copiedIndex === -2 ? <Check className="w-2.5 h-2.5 text-green-400" /> : <Copy className="w-2.5 h-2.5" />}
                      Copy All
                    </button>
                  )}
                </div>
                {committedStandard.length > 0 && (
                  <button onClick={() => handleClearAll('standard')} className="text-[10px] text-red-400/50 hover:text-red-400 uppercase tracking-widest">Clear</button>
                )}
              </div>
              <div className={`flex-grow overflow-y-auto pr-2 custom-scrollbar flex flex-col ${spacingClass}`}>
                {committedStandard.length === 0 ? (
                  <div className="h-full flex items-center justify-center border border-dashed border-white/10 rounded p-6">
                    <p className="text-white/20 text-xs italic tracking-widest uppercase">No standard blocks</p>
                  </div>
                ) : (
                  committedStandard.map((p, i) => renderParagraph(p, i, 'standard'))
                )}
              </div>
            </div>
            
            {/* Bottom Sub-Section: Highlighted Text */}
            <div className="flex-1 flex flex-col min-h-0 overflow-hidden pt-1">
              <div className="flex items-center justify-between mb-2 shrink-0">
                <div className="flex items-center gap-4">
                  <span className="text-[10px] font-sans text-[#99ccff]/50 uppercase tracking-widest">Highlighted Text</span>
                  {committedSpecial.length > 0 && (
                    <button 
                      onClick={() => handleCopyAll('special')}
                      className="text-[10px] text-[#99ccff]/30 hover:text-[#99ccff] uppercase tracking-widest flex items-center gap-1 transition-colors"
                    >
                      {copiedIndex === -2 ? <Check className="w-2.5 h-2.5 text-green-400" /> : <Copy className="w-2.5 h-2.5" />}
                      Copy All
                    </button>
                  )}
                </div>
                {committedSpecial.length > 0 && (
                  <button onClick={() => handleClearAll('special')} className="text-[10px] text-red-400/50 hover:text-red-400 uppercase tracking-widest">Clear</button>
                )}
              </div>
              <div className={`flex-grow overflow-y-auto pr-2 custom-scrollbar flex flex-col ${spacingClass}`}>
                {committedSpecial.length === 0 ? (
                  <div className="h-full flex items-center justify-center border border-dashed border-[#99ccff]/10 rounded p-6">
                    <p className="text-[#99ccff]/20 text-xs italic tracking-widest uppercase">No highlighted blocks</p>
                  </div>
                ) : (
                  committedSpecial.map((p, i) => renderParagraph(p, i, 'special'))
                )}
              </div>
            </div>

            {/* DB Sheet Action Button */}
            <div className="pt-2 shrink-0 border-t border-white/10">
              <button
                onClick={() => {
                  setViewMode('sheet');
                }}
                disabled={!hasCommittedText}
                className={`w-full py-2.5 px-3 rounded font-sans text-xs uppercase tracking-widest flex items-center justify-center gap-2 transition-all ${
                  hasCommittedText 
                    ? 'bg-red-500 hover:bg-red-600 text-white font-bold shadow-md cursor-pointer' 
                    : 'bg-white/5 border border-white/10 text-white/30 cursor-not-allowed'
                }`}
                title={hasCommittedText ? "Open Database Sheet Printout" : "Commit text blocks first to send to sheet"}
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span>Send to DB Sheet</span>
                {hasCommittedText && (
                  <span className="text-[10px] font-mono opacity-80">
                    ({committedStandard.length + committedSpecial.length})
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
      
      {/* Bottom Banner */}
      <div className="h-[36px] bg-white border-t-[3px] border-red-500 w-full shrink-0"></div>
    </div>
  );
}
