import React from 'react';
import type { PipelineConfig } from '../App';

interface Props {
  pipeline: PipelineConfig;
  setPipeline: React.Dispatch<React.SetStateAction<PipelineConfig>>;
}

function Checkbox({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="flex items-center gap-2 cursor-pointer select-none">
      <div
        onClick={() => onChange(!checked)}
        className={`w-4 h-4 border-[2px] border-black flex items-center justify-center cursor-pointer transition-colors shrink-0 ${checked ? 'bg-black' : 'bg-white'}`}
      >
        {checked && (
          <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
            <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </div>
      <span className="font-archivo text-[11px] font-bold uppercase tracking-wider">{label}</span>
    </label>
  );
}

function NumberInput({ label, value, onChange, min = 0, max = 9999 }: {
  label: string; value: number; onChange: (v: number) => void; min?: number; max?: number;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="font-archivo text-[9px] uppercase tracking-widest text-[#888]">{label}</span>
      <input
        type="number" min={min} max={max}
        className="border-[2px] border-black px-2 py-0.5 text-sm font-sans focus:outline-none w-20"
        value={value}
        onChange={e => onChange(Number(e.target.value))}
      />
    </div>
  );
}

function ColorInput({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="font-archivo text-[9px] uppercase tracking-widest text-[#888]">{label}</span>
      <div className="flex gap-1.5 items-center">
        <input
          type="color"
          value={value.startsWith('#') ? value : `#${value}`}
          onChange={e => onChange(e.target.value)}
          className="w-7 h-7 border-[2px] border-black cursor-pointer bg-transparent shrink-0"
        />
        <input
          type="text"
          className="border-[2px] border-black px-2 py-0.5 text-xs font-sans focus:outline-none w-24 uppercase"
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder="#FFFFFF"
        />
      </div>
    </div>
  );
}

export default function Pipeline({ pipeline, setPipeline }: Props) {
  const set = <K extends keyof PipelineConfig>(key: K, value: PipelineConfig[K]) =>
    setPipeline(p => ({ ...p, [key]: value }));

  return (
    <div className="flex flex-col gap-3 px-4 pb-3">
      {/* Tolerance */}
      <div className="flex flex-col gap-1">
        <label className="font-archivo text-[9px] font-bold uppercase tracking-widest text-[#666]">
          Background tolerance: {pipeline.tolerance}
        </label>
        <input
          type="range" min={0} max={128} step={1}
          value={pipeline.tolerance}
          onChange={e => set('tolerance', Number(e.target.value))}
          className="w-full accent-black"
        />
      </div>

      {/* Canvas Color */}
      <div className="flex flex-col gap-1">
        <ColorInput
          label="Padding / Canvas Color"
          value={pipeline.pad_color || '#ffffff'}
          onChange={v => set('pad_color', v)}
        />
      </div>

      <div className="border-t border-[#ddd]" />

      {/* TRIM */}
      <div className="flex flex-col gap-1.5">
        <Checkbox checked={pipeline.trim} onChange={v => set('trim', v)} label="Trim white border" />
      </div>

      {/* EXPAND */}
      <div className="flex flex-col gap-1.5">
        <Checkbox checked={pipeline.expand} onChange={v => set('expand', v)} label="Expand canvas" />
        {pipeline.expand && (
          <div className="pl-6">
            <NumberInput label="Add pixels (all sides)" value={pipeline.expand_px} onChange={v => set('expand_px', v)} min={1} />
          </div>
        )}
      </div>

      {/* PAD */}
      <div className="flex flex-col gap-1.5">
        <Checkbox checked={pipeline.pad} onChange={v => set('pad', v)} label="Pad to minimum size" />
        {pipeline.pad && (
          <div className="pl-6 flex gap-3">
            <NumberInput label="Min width" value={pipeline.pad_w} onChange={v => set('pad_w', v)} min={1} />
            <NumberInput label="Min height" value={pipeline.pad_h} onChange={v => set('pad_h', v)} min={1} />
          </div>
        )}
      </div>

      {/* RESIZE */}
      <div className="flex flex-col gap-1.5">
        <Checkbox checked={pipeline.resize} onChange={v => set('resize', v)} label="Resize to exact size" />
        {pipeline.resize && (
          <div className="pl-6 flex flex-col gap-2">
            <div className="flex gap-3">
              <NumberInput label="Width" value={pipeline.resize_w} onChange={v => set('resize_w', v)} min={1} />
              <NumberInput label="Height" value={pipeline.resize_h} onChange={v => set('resize_h', v)} min={1} />
            </div>
            <Checkbox
              checked={pipeline.maintain_aspect}
              onChange={v => set('maintain_aspect', v)}
              label="Maintain aspect ratio"
            />
          </div>
        )}
      </div>

      <div className="border-t border-[#ddd]" />

      {/* TRANSPARENCY */}
      <div className="flex flex-col gap-1.5">
        <span className="font-archivo text-[9px] font-bold uppercase tracking-widest text-[#666]">Transparency</span>
        <Checkbox
          checked={pipeline.remove_bg}
          onChange={v => set('remove_bg', v)}
          label="Remove white bg → alpha"
        />
        {pipeline.remove_bg && (
          <div className="pl-6">
            <Checkbox
              checked={pipeline.interior_fill}
              onChange={v => set('interior_fill', v)}
              label="Also: interior shapes"
            />
            <p className="font-sans text-[10px] text-[#888] mt-1 pl-6 leading-tight">
              Flood-fills from edges — keeps white inside closed shapes (e.g. letters) opaque.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
