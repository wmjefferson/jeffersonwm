import React, { useState } from 'react';
import type { RuleBlock, PipelineConfig, OutputConfig, JobProgress } from '../App';
import RenameBlocks from './RenameBlocks';
import Pipeline from './Pipeline';
import FolderBrowserModal from './FolderBrowserModal';

interface Props {
  rules: RuleBlock[];
  setRules: React.Dispatch<React.SetStateAction<RuleBlock[]>>;
  pipeline: PipelineConfig;
  setPipeline: React.Dispatch<React.SetStateAction<PipelineConfig>>;
  output: OutputConfig;
  setOutput: React.Dispatch<React.SetStateAction<OutputConfig>>;
  scanCount: number | null;
  onScan: (folder: string, recursive: boolean) => void;
  isRunning: boolean;
  startJob: () => void;
  progress: JobProgress;
}

function SectionHeader({ label }: { label: string }) {
  return (
    <div className="px-4 pt-4 pb-1">
      <span className="font-archivo text-[11px] font-bold uppercase tracking-widest text-black">{label}</span>
    </div>
  );
}

function Divider() {
  return <div className="border-t-[2px] border-black mx-0 mt-3" />;
}

function TextInput({
  label, value, onChange, placeholder, onBrowse
}: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; onBrowse?: () => void }) {
  return (
    <div className="flex flex-col gap-1 px-4">
      <label className="font-archivo text-[9px] font-bold uppercase tracking-widest text-[#666]">{label}</label>
      <div className="flex gap-1.5">
        <input
          className="flex-1 border-[2px] border-black bg-white px-2 py-1 text-sm font-sans focus:outline-none focus:border-black min-w-0"
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
        />
        {onBrowse && (
          <button
            type="button"
            onClick={onBrowse}
            className="bg-black text-white font-archivo text-[10px] font-bold uppercase px-3 py-1 hover:bg-[#222] transition-colors border-[2px] border-black cursor-pointer shrink-0"
          >
            Browse
          </button>
        )}
      </div>
    </div>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 px-4 cursor-pointer select-none">
      <div
        onClick={() => onChange(!checked)}
        className={`w-4 h-4 border-[2px] border-black flex items-center justify-center cursor-pointer transition-colors ${checked ? 'bg-black' : 'bg-white'}`}
      >
        {checked && <svg width="10" height="8" viewBox="0 0 10 8" fill="none"><path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
      </div>
      <span className="font-archivo text-[11px] font-bold uppercase tracking-wider">{label}</span>
    </label>
  );
}

function RadioGroup<T extends string>({
  label, options, value, onChange,
}: { label: string; options: { value: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="px-4 flex flex-col gap-1">
      <span className="font-archivo text-[9px] font-bold uppercase tracking-widest text-[#666]">{label}</span>
      <div className="flex flex-col gap-1">
        {options.map(opt => (
          <label key={opt.value} className="flex items-center gap-2 cursor-pointer select-none">
            <div
              onClick={() => onChange(opt.value)}
              className={`w-4 h-4 rounded-full border-[2px] border-black flex items-center justify-center cursor-pointer ${value === opt.value ? 'bg-black' : 'bg-white'}`}
            >
              {value === opt.value && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
            </div>
            <span className="font-archivo text-[11px] uppercase tracking-wider">{opt.label}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

export default function LeftPanel({
  rules, setRules, pipeline, setPipeline, output, setOutput, scanCount, onScan, isRunning, startJob, progress
}: Props) {
  const [inputBrowserOpen, setInputBrowserOpen] = useState(false);
  const [outputBrowserOpen, setOutputBrowserOpen] = useState(false);

  const handleInputFolderChange = (v: string) => {
    setOutput(o => ({ ...o, input_folder: v }));
    onScan(v, output.recursive);
  };

  const handleRecursiveChange = (v: boolean) => {
    setOutput(o => ({ ...o, recursive: v }));
    if (output.input_folder) onScan(output.input_folder, v);
  };

  return (
    <div className="flex flex-col h-full bg-[#F0F0F0] overflow-hidden">
      {/* Scrollable Settings Panel */}
      <div className="flex-1 overflow-y-auto pb-8 flex flex-col gap-0">
        {/* INPUT */}
        <SectionHeader label="Input" />
        <div className="flex flex-col gap-3 pb-3">
          <TextInput
            label="Input Folder Path"
            value={output.input_folder}
            onChange={handleInputFolderChange}
            placeholder="e.g. E:\drawings"
            onBrowse={() => setInputBrowserOpen(true)}
          />
          <div className="flex flex-col gap-1.5">
            <Toggle
              label="Include subfolders"
              checked={output.recursive}
              onChange={handleRecursiveChange}
            />
          </div>
          {scanCount !== null && (
            <div className="px-4">
              <span className="font-archivo text-[11px] uppercase tracking-wider text-[#555]">
                Found: <strong>{scanCount.toLocaleString()}</strong> image{scanCount !== 1 ? 's' : ''}
              </span>
            </div>
          )}
        </div>

        <Divider />

        {/* RENAME */}
        <SectionHeader label="Rename Files" />
        <RenameBlocks rules={rules} setRules={setRules} />

        <Divider />

        {/* TRIM & TRANSFORM */}
        <SectionHeader label="Trim & Transform" />
        <Pipeline pipeline={pipeline} setPipeline={setPipeline} />

        <Divider />

        {/* OUTPUT */}
        <SectionHeader label="Output" />
        <div className="flex flex-col gap-3 pb-3">
          <TextInput
            label="Output Folder Path"
            value={output.folder}
            onChange={v => setOutput(o => ({ ...o, folder: v }))}
            placeholder="e.g. E:\drawings-processed"
            onBrowse={() => setOutputBrowserOpen(true)}
          />
          <RadioGroup
            label="Write mode"
            options={[
              { value: 'copy', label: 'Copy to output folder' },
              { value: 'overwrite', label: 'Overwrite originals' },
            ]}
            value={output.output_mode}
            onChange={v => setOutput(o => ({ ...o, output_mode: v }))}
          />
          {output.output_mode === 'copy' && (
            <RadioGroup
              label="Duplicate Name Resolution"
              options={[
                { value: 'overwrite', label: 'Overwrite existing files' },
                { value: 'parenthesis', label: 'Rename with suffix (e.g. image (1).jpg)' },
                { value: 'duplicates_folder', label: 'Save duplicates in separate folder' },
              ]}
              value={output.duplicate_mode || 'overwrite'}
              onChange={v => setOutput(o => ({ ...o, duplicate_mode: v as any }))}
            />
          )}
          <RadioGroup
            label="Output Format"
            options={[
              { value: 'same', label: 'Same as input' },
              { value: 'png', label: 'PNG' },
              { value: 'jpeg', label: 'JPEG' },
              { value: 'webp', label: 'WebP' },
            ]}
            value={output.output_format}
            onChange={v => setOutput(o => ({ ...o, output_format: v }))}
          />
          {(output.output_format === 'jpeg' || output.output_format === 'webp') && (
            <div className="px-4 flex flex-col gap-1">
              <label className="font-archivo text-[9px] font-bold uppercase tracking-widest text-[#666]">
                Quality: {output.jpeg_quality}
              </label>
              <input
                type="range" min={10} max={100} step={1}
                value={output.jpeg_quality}
                onChange={e => setOutput(o => ({ ...o, jpeg_quality: Number(e.target.value) }))}
                className="w-full accent-black"
              />
            </div>
          )}
          <div className="flex flex-col gap-2">
            <Toggle label="Export as .zip" checked={output.export_zip} onChange={v => setOutput(o => ({ ...o, export_zip: v }))} />
            <Toggle label="Separate uncertain backgrounds" checked={output.separate_uncertain} onChange={v => setOutput(o => ({ ...o, separate_uncertain: v }))} />
            <div className="flex flex-col gap-0.5">
              <Toggle label="Organize into monthly folders" checked={output.organize_by_date} onChange={v => setOutput(o => ({ ...o, organize_by_date: v }))} />
              <span className="font-archivo text-[8px] text-[#666] uppercase tracking-wider pl-10 block leading-tight">Folders will be named like "YYYY MM"</span>
            </div>
            <Toggle label="Show live feed" checked={output.show_live_feed} onChange={v => setOutput(o => ({ ...o, show_live_feed: v }))} />
            {output.show_live_feed && (
              <div className="pl-6 flex flex-col gap-1.5 mt-0.5">
                <span className="font-archivo text-[9px] font-bold uppercase tracking-widest text-[#666]">Feed Display Mode</span>
                <div className="flex gap-1.5">
                  {(['both', 'single', 'grid'] as const).map(m => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setOutput(o => ({ ...o, live_feed_mode: m }))}
                      className={`flex-1 font-archivo text-[9px] font-bold uppercase py-1 border-[2px] transition-colors cursor-pointer text-center ${
                        output.live_feed_mode === m || (!output.live_feed_mode && m === 'both')
                          ? 'bg-black text-white border-black'
                          : 'bg-white text-black border-black hover:bg-[#eee]'
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
                
                <div className="flex flex-col gap-1 mt-1.5">
                  <span className="font-archivo text-[9px] font-bold uppercase tracking-widest text-[#666]">Feed History Limit</span>
                  <select
                    value={output.live_feed_limit ?? 50}
                    onChange={e => setOutput(o => ({ ...o, live_feed_limit: Number(e.target.value) }))}
                    className="border-[2px] border-black bg-white px-2 py-1 text-xs font-archivo uppercase focus:outline-none focus:border-black cursor-pointer font-bold"
                  >
                    <option value={1}>Latest Only (Unload History)</option>
                    <option value={10}>Last 10 Items</option>
                    <option value={20}>Last 20 Items</option>
                    <option value={50}>Last 50 Items</option>
                    <option value={100}>Last 100 Items</option>
                    <option value={500}>Last 500 Items</option>
                  </select>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Sticky Bottom Actions */}
      <div className="shrink-0 p-4 border-t-[3px] border-black bg-white flex flex-col gap-2 shadow-[0_-4px_10px_rgba(0,0,0,0.05)]">
        <button
          onClick={startJob}
          disabled={isRunning || !output.input_folder}
          className="w-full bg-black text-white font-archivo text-xs font-bold uppercase tracking-wider py-2.5 hover:bg-[#222] disabled:opacity-40 disabled:hover:bg-black transition-colors border-[2px] border-black cursor-pointer"
        >
          {progress.phase === 'running'
            ? 'Processing...'
            : progress.phase === 'zipping'
            ? 'Zipping...'
            : '▶ Start Processing'}
        </button>
      </div>

      {/* Modals */}
      <FolderBrowserModal
        isOpen={inputBrowserOpen}
        onClose={() => setInputBrowserOpen(false)}
        onSelect={(path) => {
          handleInputFolderChange(path);
          setInputBrowserOpen(false);
        }}
        initialPath={output.input_folder || ''}
        title="Select Input Folder"
      />
      <FolderBrowserModal
        isOpen={outputBrowserOpen}
        onClose={() => setOutputBrowserOpen(false)}
        onSelect={(path) => {
          setOutput(o => ({ ...o, folder: path }));
          setOutputBrowserOpen(false);
        }}
        initialPath={output.folder || ''}
        title="Select Output Folder"
      />
    </div>
  );
}
