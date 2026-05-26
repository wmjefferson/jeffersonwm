import React, { useEffect, useMemo, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import {
  AlertCircle,
  Archive,
  ArrowUpDown,
  Download,
  FilePlus,
  FolderOpen,
  Hash,
  ListFilter,
  RefreshCw,
  Trash2,
} from 'lucide-react';
import { Rule, RuleType, FileData, SortConfig } from './types';
import { createZip, formatBytes, generateNewNames } from './utils/fileHelpers';
import { Button } from './components/Button';
import { RuleItem } from './components/RuleItem';

const DEFAULT_RULE: Rule = { id: uuidv4(), type: RuleType.ORIGINAL };

const sortFiles = (fileList: FileData[], config: SortConfig) => {
  return [...fileList].sort((a, b) => {
    if (config.field === 'name') {
      const comparison = a.originalName.localeCompare(b.originalName, undefined, {
        numeric: true,
        sensitivity: 'base',
      });
      return config.direction === 'asc' ? comparison : -comparison;
    }

    const left = config.field === 'date' ? a.lastModified : a.size;
    const right = config.field === 'date' ? b.lastModified : b.size;

    if (left < right) {
      return config.direction === 'asc' ? -1 : 1;
    }
    if (left > right) {
      return config.direction === 'asc' ? 1 : -1;
    }
    return 0;
  });
};

function describeRule(rule: Rule) {
  switch (rule.type) {
    case RuleType.TEXT:
      return rule.value?.trim() ? `"${rule.value.trim()}"` : 'Custom text';
    case RuleType.SEQUENCE:
      return `Start ${rule.startNumber || 1}, ${rule.padding || 1} digit${(rule.padding || 1) > 1 ? 's' : ''}`;
    case RuleType.DATE:
      return rule.dateFormat || 'yyyyMMdd';
    case RuleType.ORIGINAL:
      return 'Keep original filename';
    default:
      return rule.type;
  }
}

const App: React.FC = () => {
  const [files, setFiles] = useState<FileData[]>([]);
  const [rules, setRules] = useState<Rule[]>([]);
  const [sortConfig, setSortConfig] = useState<SortConfig>({ field: 'name', direction: 'asc' });
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    if (rules.length === 0) {
      setRules([DEFAULT_RULE]);
    }
  }, [rules.length]);

  const processFiles = (uploadedFiles: File[]) => {
    const nextFiles = uploadedFiles.map((file) => {
      const lastDot = file.name.lastIndexOf('.');
      const extension = lastDot !== -1 ? file.name.substring(lastDot + 1) : '';

      return {
        id: uuidv4(),
        file,
        originalName: file.name,
        newName: file.name,
        extension,
        size: file.size,
        lastModified: file.lastModified,
      };
    });

    setFiles((current) => sortFiles([...current, ...nextFiles], sortConfig));
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files?.length) {
      processFiles(Array.from(event.target.files));
    }
    event.target.value = '';
  };

  const handleDragOver = (event: React.DragEvent) => {
    event.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (event: React.DragEvent) => {
    event.preventDefault();
    if (event.currentTarget.contains(event.relatedTarget as Node)) {
      return;
    }
    setIsDragging(false);
  };

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault();
    setIsDragging(false);

    if (event.dataTransfer.files?.length) {
      processFiles(Array.from(event.dataTransfer.files));
    }
  };

  const handleAddRule = (type: RuleType) => {
    const newRule: Rule = {
      id: uuidv4(),
      type,
      value: '',
      startNumber: 1,
      padding: 2,
      dateFormat: 'yyyyMMdd',
    };
    setRules((current) => [...current, newRule]);
  };

  const handleUpdateRule = (id: string, updates: Partial<Rule>) => {
    setRules((current) => current.map((rule) => (rule.id === id ? { ...rule, ...updates } : rule)));
  };

  const handleRemoveRule = (id: string) => {
    setRules((current) => current.filter((rule) => rule.id !== id));
  };

  const handleSort = (field: 'name' | 'date' | 'size') => {
    const direction =
      sortConfig.field === field && sortConfig.direction === 'asc' ? 'desc' : 'asc';
    const nextConfig: SortConfig = { field, direction };
    setSortConfig(nextConfig);
    setFiles((current) => sortFiles(current, nextConfig));
  };

  const previewFiles = useMemo(() => generateNewNames(files, rules), [files, rules]);

  const duplicateCount = useMemo(() => {
    const seen = new Map<string, number>();
    for (const file of previewFiles) {
      seen.set(file.newName, (seen.get(file.newName) || 0) + 1);
    }
    return Array.from(seen.values()).filter((count) => count > 1).length;
  }, [previewFiles]);

  const totalSize = useMemo(() => previewFiles.reduce((sum, file) => sum + file.size, 0), [previewFiles]);

  const newestDate = useMemo(() => {
    if (previewFiles.length === 0) {
      return null;
    }
    return new Date(Math.max(...previewFiles.map((file) => file.lastModified)));
  }, [previewFiles]);

  const patternSummary = useMemo(
    () => rules.map((rule) => describeRule(rule)).filter(Boolean).join(' -> '),
    [rules],
  );

  const handleClearFiles = () => setFiles([]);

  const handleDownloadZip = async () => {
    if (previewFiles.length === 0) {
      return;
    }

    setIsProcessing(true);
    try {
      const blob = await createZip(previewFiles);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = 'bullion-export.zip';
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error(error);
      alert('Bullion could not package the archive.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-[linear-gradient(to_bottom,rgba(41,37,36,0.04),rgba(41,37,36,0.01)),#f7f4ee] text-stone-900">
      <div className="mx-auto flex min-h-screen max-w-[1440px] flex-col px-5 py-6 lg:px-8">
        <header className="mb-6 flex flex-col gap-6 border-b border-stone-200 pb-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <a
              href="https://jeffersonwm.com"
              className="mb-3 inline-block text-[11px] uppercase tracking-[0.22em] text-stone-500 no-underline transition-colors hover:text-stone-900"
            >
              JeffersonWM
            </a>
            <div className="flex items-start gap-4">
              <div className="flex h-11 w-11 items-center justify-center rounded-full border border-stone-300 bg-white font-mono text-xs tracking-[0.24em] text-stone-700">
                AU
              </div>
              <div>
                <h1 className="font-serif text-[clamp(2.4rem,5vw,4.4rem)] font-normal leading-none text-stone-950">
                  Bullion
                </h1>
                <p className="mt-3 max-w-2xl text-[15px] leading-7 text-stone-600">
                  A batch rename studio for building filename patterns, previewing the outcome, and exporting
                  the whole set as a clean archive.
                </p>
              </div>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-[1.5rem] border border-stone-200 bg-white px-4 py-4 shadow-[0_18px_40px_rgba(28,25,23,0.05)]">
              <p className="text-[10px] uppercase tracking-[0.2em] text-stone-400">Queued</p>
              <p className="mt-2 font-serif text-3xl">{previewFiles.length}</p>
              <p className="mt-1 text-xs text-stone-500">Files ready for preview</p>
            </div>
            <div className="rounded-[1.5rem] border border-stone-200 bg-white px-4 py-4 shadow-[0_18px_40px_rgba(28,25,23,0.05)]">
              <p className="text-[10px] uppercase tracking-[0.2em] text-stone-400">Pattern</p>
              <p className="mt-2 font-serif text-3xl">{rules.length}</p>
              <p className="mt-1 text-xs text-stone-500">Active naming blocks</p>
            </div>
            <div className="rounded-[1.5rem] border border-stone-200 bg-white px-4 py-4 shadow-[0_18px_40px_rgba(28,25,23,0.05)]">
              <p className="text-[10px] uppercase tracking-[0.2em] text-stone-400">Archive</p>
              <p className="mt-2 font-serif text-3xl">{formatBytes(totalSize, 1)}</p>
              <p className="mt-1 text-xs text-stone-500">Projected ZIP payload</p>
            </div>
          </div>
        </header>

        <main className="grid flex-1 gap-6 lg:grid-cols-[380px_minmax(0,1fr)]">
          <aside className="flex min-h-0 flex-col gap-5">
            <section className="rounded-[1.8rem] border border-stone-200 bg-white p-5 shadow-[0_18px_40px_rgba(28,25,23,0.05)]">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.22em] text-stone-400">Rename Pattern</p>
                  <h2 className="mt-1 font-serif text-2xl text-stone-950">Naming Blocks</h2>
                </div>
                <div className="rounded-full border border-stone-200 bg-stone-50 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-stone-500">
                  {rules.length} active
                </div>
              </div>

              <div className="space-y-3">
                {rules.map((rule, index) => (
                  <RuleItem
                    key={rule.id}
                    rule={rule}
                    index={index}
                    onUpdate={handleUpdateRule}
                    onRemove={handleRemoveRule}
                  />
                ))}
              </div>
            </section>

            <section className="rounded-[1.8rem] border border-stone-200 bg-white p-5 shadow-[0_18px_40px_rgba(28,25,23,0.05)]">
              <p className="text-[10px] uppercase tracking-[0.22em] text-stone-400">Add Block</p>
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                <Button size="sm" variant="secondary" icon={<FilePlus size={14} />} onClick={() => handleAddRule(RuleType.TEXT)}>
                  Text
                </Button>
                <Button size="sm" variant="secondary" icon={<Hash size={14} />} onClick={() => handleAddRule(RuleType.SEQUENCE)}>
                  Sequence
                </Button>
                <Button size="sm" variant="secondary" icon={<Archive size={14} />} onClick={() => handleAddRule(RuleType.ORIGINAL)}>
                  Original
                </Button>
                <Button size="sm" variant="secondary" icon={<RefreshCw size={14} />} onClick={() => handleAddRule(RuleType.DATE)}>
                  Date
                </Button>
              </div>
            </section>

            <section className="rounded-[1.8rem] border border-stone-200 bg-[linear-gradient(180deg,rgba(250,250,249,0.95),rgba(245,245,244,0.95))] p-5 shadow-[0_18px_40px_rgba(28,25,23,0.04)]">
              <p className="text-[10px] uppercase tracking-[0.22em] text-stone-400">Pattern Readout</p>
              <p className="mt-3 font-mono text-xs leading-6 text-stone-600">
                {patternSummary || 'Original filename'}
              </p>
              <div className="mt-4 space-y-2 text-sm text-stone-600">
                <p>
                  Bullion keeps the existing extension and only rebuilds the base filename.
                </p>
                <p>
                  Use <strong>Original</strong> when you want the current filename preserved inside the pattern.
                </p>
              </div>
            </section>
          </aside>

          <section
            className="relative flex min-h-0 flex-col gap-5"
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            {isDragging && (
              <div className="absolute inset-0 z-20 flex items-center justify-center rounded-[2rem] border-2 border-dashed border-stone-700 bg-[rgba(28,25,23,0.78)] backdrop-blur-sm">
                <div className="text-center text-stone-50">
                  <FolderOpen size={58} className="mx-auto mb-4" />
                  <h3 className="font-serif text-3xl">Drop files into Bullion</h3>
                  <p className="mt-2 text-sm uppercase tracking-[0.18em] text-stone-300">
                    They will be added to the current queue
                  </p>
                </div>
              </div>
            )}

            <section className="rounded-[1.9rem] border border-stone-200 bg-white p-5 shadow-[0_18px_40px_rgba(28,25,23,0.05)]">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.22em] text-stone-400">Working Queue</p>
                  <h2 className="mt-1 font-serif text-2xl text-stone-950">Preview & Export</h2>
                  <p className="mt-2 max-w-2xl text-sm leading-7 text-stone-600">
                    Add files, adjust the naming blocks, then export the renamed set as one archive when the preview feels right.
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <label className="cursor-pointer">
                    <input type="file" multiple className="hidden" onChange={handleFileUpload} />
                    <span>
                      <Button size="md" variant="secondary" icon={<FolderOpen size={14} />}>
                        Add Files
                      </Button>
                    </span>
                  </label>

                  <Button
                    size="md"
                    variant="ghost"
                    icon={<Trash2 size={14} />}
                    onClick={handleClearFiles}
                    disabled={files.length === 0}
                  >
                    Clear
                  </Button>

                  <Button
                    size="md"
                    variant="primary"
                    icon={<Download size={14} />}
                    onClick={handleDownloadZip}
                    disabled={previewFiles.length === 0 || isProcessing}
                  >
                    {isProcessing ? 'Packaging' : 'Export ZIP'}
                  </Button>
                </div>
              </div>

              <div className="mt-5 grid gap-3 md:grid-cols-3">
                <div className="rounded-[1.3rem] border border-stone-200 bg-stone-50 px-4 py-4">
                  <p className="text-[10px] uppercase tracking-[0.18em] text-stone-400">Newest File</p>
                  <p className="mt-2 text-sm text-stone-700">
                    {newestDate ? newestDate.toLocaleString() : 'No files loaded'}
                  </p>
                </div>
                <div className="rounded-[1.3rem] border border-stone-200 bg-stone-50 px-4 py-4">
                  <p className="text-[10px] uppercase tracking-[0.18em] text-stone-400">Sort</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Button size="sm" variant="ghost" icon={<ArrowUpDown size={12} />} onClick={() => handleSort('name')}>
                      Name
                    </Button>
                    <Button size="sm" variant="ghost" icon={<ArrowUpDown size={12} />} onClick={() => handleSort('date')}>
                      Date
                    </Button>
                    <Button size="sm" variant="ghost" icon={<ArrowUpDown size={12} />} onClick={() => handleSort('size')}>
                      Size
                    </Button>
                  </div>
                </div>
                <div className="rounded-[1.3rem] border border-stone-200 bg-stone-50 px-4 py-4">
                  <p className="text-[10px] uppercase tracking-[0.18em] text-stone-400">Collisions</p>
                  <p className="mt-2 text-sm text-stone-700">
                    {duplicateCount > 0
                      ? `${duplicateCount} duplicate name group${duplicateCount > 1 ? 's' : ''} detected`
                      : 'No duplicate names in preview'}
                  </p>
                </div>
              </div>
            </section>

            {duplicateCount > 0 && (
              <div className="flex items-start gap-3 rounded-[1.5rem] border border-amber-200 bg-amber-50 px-4 py-4 text-amber-900 shadow-[0_12px_30px_rgba(180,83,9,0.06)]">
                <AlertCircle size={18} className="mt-0.5 shrink-0" />
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em]">Duplicate preview names</p>
                  <p className="mt-1 text-sm leading-6">
                    Bullion will auto-number collisions inside the ZIP export. If you want cleaner names, adjust the pattern before downloading.
                  </p>
                </div>
              </div>
            )}

            <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[1.9rem] border border-stone-200 bg-white shadow-[0_18px_40px_rgba(28,25,23,0.05)]">
              <div className="flex items-center justify-between border-b border-stone-200 px-5 py-4">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.22em] text-stone-400">Preview Table</p>
                  <h2 className="mt-1 font-serif text-2xl text-stone-950">Resulting Names</h2>
                </div>
                <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-stone-400">
                  <ListFilter size={13} />
                  {previewFiles.length} items
                </div>
              </div>

              {previewFiles.length === 0 ? (
                <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
                  <FolderOpen size={44} className="mb-4 text-stone-300" />
                  <h3 className="font-serif text-2xl text-stone-900">Start with a file batch</h3>
                  <p className="mt-3 max-w-xl text-sm leading-7 text-stone-600">
                    Drop files here or use <strong>Add Files</strong>. Bullion will show the original names beside the generated pattern before anything gets exported.
                  </p>
                </div>
              ) : (
                <div className="min-h-0 flex-1 overflow-auto">
                  <div className="min-w-[820px]">
                    <div className="grid grid-cols-[72px_minmax(0,2fr)_minmax(0,2fr)_120px_180px] gap-4 border-b border-stone-200 px-5 py-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-stone-400">
                      <div>#</div>
                      <div>Original</div>
                      <div>Preview</div>
                      <div>Size</div>
                      <div>Modified</div>
                    </div>

                    {previewFiles.map((file, index) => (
                      <div
                        key={file.id}
                        className="grid grid-cols-[72px_minmax(0,2fr)_minmax(0,2fr)_120px_180px] gap-4 border-b border-stone-100 px-5 py-4 text-sm text-stone-700 transition-colors hover:bg-stone-50"
                      >
                        <div className="font-mono text-xs text-stone-400">{String(index + 1).padStart(2, '0')}</div>
                        <div className="min-w-0">
                          <p className="truncate">{file.originalName}</p>
                        </div>
                        <div className="min-w-0">
                          <p className="truncate font-medium text-stone-950">{file.newName}</p>
                        </div>
                        <div className="text-stone-500">{formatBytes(file.size, 1)}</div>
                        <div className="text-stone-500">{new Date(file.lastModified).toLocaleString()}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </section>
          </section>
        </main>
      </div>
    </div>
  );
};

export default App;
