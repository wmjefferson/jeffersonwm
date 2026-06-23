import React from 'react';
import { X, CheckCircle, FileArchive, Settings2, ShieldAlert } from 'lucide-react';
import type { RuleBlock, PipelineConfig, OutputConfig, JobProgress } from '../App';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  progress: JobProgress;
  output: OutputConfig;
  pipeline: PipelineConfig;
  rules: RuleBlock[];
}

export default function JobCompleteModal({ isOpen, onClose, progress, output, pipeline, rules }: Props) {
  if (!isOpen) return null;

  // Helpers to format config display
  const getRenameSummary = () => {
    if (rules.length === 0) return 'None (Keep Original)';
    return rules.map((r) => {
      if (r.type === 'original') return 'Original';
      if (r.type === 'text') return `"${r.value}"`;
      if (r.type === 'date') return `Date(${r.value})`;
      if (r.type === 'sequence') return `Seq(Start:${r.value}, Pad:${r.padding || 3})`;
      return r.type;
    }).join(' + ');
  };

  const activeTransforms = [];
  if (pipeline.trim) activeTransforms.push('Fast Trim');
  if (pipeline.expand) activeTransforms.push(`Expand (+${pipeline.expand_px}px)`);
  if (pipeline.pad) activeTransforms.push(`Pad (${pipeline.pad_w}x${pipeline.pad_h})`);
  if (pipeline.resize) activeTransforms.push(`Resize (${pipeline.resize_w}x${pipeline.resize_h}${pipeline.maintain_aspect ? ', Aspect' : ''})`);
  if (pipeline.remove_bg) activeTransforms.push(`Remove Background (Tolerance: ${pipeline.tolerance}${pipeline.interior_fill ? ', Interior' : ''})`);

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-[2px]">
      <div className="bg-[#F0F0F0] border-[3px] border-black w-full max-w-xl flex flex-col max-h-[90vh] shadow-[6px_6px_0px_#000]">
        
        {/* Header */}
        <div className="bg-black text-white px-4 py-2.5 flex justify-between items-center font-archivo text-xs font-bold uppercase tracking-widest shrink-0">
          <span className="flex items-center gap-2">
            <CheckCircle size={14} className="text-green-400" />
            Millionfold Process Completed
          </span>
          <button onClick={onClose} className="text-white hover:text-red-400 transition-colors cursor-pointer">
            <X size={18} />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5 bg-white">
          
          {/* Stats Summary Panel */}
          <div className="border-[2px] border-black p-4 bg-[#FAF9F6] shadow-[3px_3px_0px_#000]">
            <h3 className="font-archivo text-xs font-bold uppercase tracking-wider text-black mb-3 border-b-2 border-black pb-1">
              Execution Statistics
            </h3>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="border-2 border-black bg-white p-2">
                <span className="block font-archivo text-[9px] font-bold uppercase tracking-wider text-gray-500">Processed</span>
                <span className="font-archivo text-2xl font-black text-black leading-tight">{progress.total}</span>
              </div>
              <div className="border-2 border-black bg-green-50 p-2">
                <span className="block font-archivo text-[9px] font-bold uppercase tracking-wider text-green-700">Success</span>
                <span className="font-archivo text-2xl font-black text-green-700 leading-tight">{progress.success}</span>
              </div>
              <div className="border-2 border-black bg-red-50 p-2">
                <span className="block font-archivo text-[9px] font-bold uppercase tracking-wider text-red-700">Errors</span>
                <span className="font-archivo text-2xl font-black text-red-700 leading-tight">{progress.errors}</span>
              </div>
            </div>
            {progress.zip_path && (
              <div className="mt-3.5 border-t-[2px] border-dashed border-black pt-3 flex gap-2.5 items-start text-xs font-sans">
                <FileArchive size={16} className="text-blue-600 shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <span className="font-bold text-gray-700 uppercase tracking-wider text-[10px] block font-archivo">ZIP Archive Created:</span>
                  <span className="break-all font-mono text-[11px] bg-gray-100 p-1 border border-gray-300 block mt-1">{progress.zip_path}</span>
                </div>
              </div>
            )}
          </div>

          {/* Configuration Summary Panel */}
          <div className="border-[2px] border-black p-4 bg-[#FAF9F6] shadow-[3px_3px_0px_#000] space-y-3.5">
            <h3 className="font-archivo text-xs font-bold uppercase tracking-wider text-black border-b-2 border-black pb-1 flex items-center gap-1.5">
              <Settings2 size={13} />
              Configuration Selected
            </h3>
            
            <div className="grid grid-cols-2 gap-x-4 gap-y-3.5 text-xs">
              <div>
                <span className="font-archivo text-[9px] font-extrabold uppercase tracking-wider text-gray-500 block">Input Folder</span>
                <span className="font-mono text-[11px] break-all block mt-0.5">{output.input_folder}</span>
              </div>
              <div>
                <span className="font-archivo text-[9px] font-extrabold uppercase tracking-wider text-gray-500 block">Output Folder</span>
                <span className="font-mono text-[11px] break-all block mt-0.5">
                  {output.output_mode === 'overwrite' ? '[Overwrite Originals]' : output.folder}
                </span>
              </div>
              <div>
                <span className="font-archivo text-[9px] font-extrabold uppercase tracking-wider text-gray-500 block">Write Mode</span>
                <span className="font-bold uppercase tracking-wide block mt-0.5 text-black">
                  {output.output_mode === 'copy' ? 'Copy to output folder' : 'Overwrite originals'}
                </span>
              </div>
              <div>
                <span className="font-archivo text-[9px] font-extrabold uppercase tracking-wider text-gray-500 block">Recursive</span>
                <span className="font-bold uppercase tracking-wide block mt-0.5 text-black">
                  {output.recursive ? 'Include subfolders' : 'Input directory only'}
                </span>
              </div>
              {output.output_mode === 'copy' && (
                <div>
                  <span className="font-archivo text-[9px] font-extrabold uppercase tracking-wider text-gray-500 block">Collision Strategy</span>
                  <span className="font-bold uppercase tracking-wide block mt-0.5 text-black">
                    {output.duplicate_mode === 'overwrite' && 'Overwrite existing files'}
                    {output.duplicate_mode === 'parenthesis' && 'Rename with suffix (e.g. image (1).jpg)'}
                    {output.duplicate_mode === 'duplicates_folder' && 'Save duplicates in separate folder'}
                  </span>
                </div>
              )}
              <div>
                <span className="font-archivo text-[9px] font-extrabold uppercase tracking-wider text-gray-500 block">Format & Quality</span>
                <span className="font-bold uppercase tracking-wide block mt-0.5 text-black">
                  {output.output_format.toUpperCase()} 
                  {(output.output_format === 'jpeg' || output.output_format === 'webp') && ` (${output.jpeg_quality}% Quality)`}
                </span>
              </div>
            </div>

            {/* Rename Summary */}
            <div className="border-t border-gray-300 pt-3 text-xs">
              <span className="font-archivo text-[9px] font-extrabold uppercase tracking-wider text-gray-500 block">Rename Rules Pattern</span>
              <span className="font-mono text-[11px] block mt-1 bg-white border border-black p-1.5">{getRenameSummary()}</span>
            </div>

            {/* Transforms Summary */}
            <div className="border-t border-gray-300 pt-3 text-xs">
              <span className="font-archivo text-[9px] font-extrabold uppercase tracking-wider text-gray-500 block">Applied Canvas Transforms</span>
              <div className="flex flex-wrap gap-1.5 mt-1.5">
                {activeTransforms.length > 0 ? (
                  activeTransforms.map((t, idx) => (
                    <span key={idx} className="bg-black text-white text-[9px] font-archivo font-bold uppercase tracking-wider px-2 py-0.5 border border-black">
                      {t}
                    </span>
                  ))
                ) : (
                  <span className="text-gray-400 italic font-archivo text-[10px] uppercase">No transforms applied</span>
                )}
              </div>
            </div>

            {/* Enabled Flags */}
            <div className="border-t border-gray-300 pt-3 text-xs flex flex-wrap gap-x-5 gap-y-1.5">
              {output.separate_uncertain && (
                <span className="flex items-center gap-1 text-[10px] font-bold text-amber-700 uppercase tracking-wider">
                  <ShieldAlert size={12} />
                  Separate Uncertain Backgrounds
                </span>
              )}
              {output.organize_by_date && (
                <span className="flex items-center gap-1 text-[10px] font-bold text-blue-700 uppercase tracking-wider">
                  <CheckCircle size={12} />
                  Organize into Monthly Folders
                </span>
              )}
            </div>

          </div>

        </div>

        {/* Footer sticky bar */}
        <div className="shrink-0 p-4 border-t-[3px] border-black bg-white flex justify-end gap-2 shadow-[0_-4px_10px_rgba(0,0,0,0.05)]">
          <button
            onClick={onClose}
            className="bg-black text-white font-archivo text-xs font-bold uppercase tracking-widest px-6 py-2 hover:bg-[#222] transition-colors border-[2px] border-black cursor-pointer shadow-[2px_2px_0px_#000] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[1px_1px_0px_#000] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"
          >
            Dismiss
          </button>
        </div>

      </div>
    </div>
  );
}
