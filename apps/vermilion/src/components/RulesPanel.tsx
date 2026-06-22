import React, { useRef, useState } from 'react';
import { GripVertical, X, Plus, MoveUp, MoveDown } from 'lucide-react';
import type { RenameRule } from '../App';

interface Props {
  rules: RenameRule[];
  setRules: React.Dispatch<React.SetStateAction<RenameRule[]>>;
  separator: string;
  setSeparator: (val: string) => void;
}

const RULE_LABELS: Record<RenameRule['type'], string> = {
  original: 'Original Filename',
  text: 'Custom Text',
  date: 'Date Stamp',
  sequence: 'Auto Sequence',
};

export default function RulesPanel({ rules, setRules, separator, setSeparator }: Props) {
  const dragIndex = useRef<number | null>(null);
  const dragOverIndex = useRef<number | null>(null);
  const [dragging, setDragging] = useState<number | null>(null);

  const addRule = (type: RenameRule['type']) => {
    const newRule: RenameRule = {
      id: 'r-' + Math.random().toString(36).slice(2),
      type,
      value: type === 'text' ? '-' : type === 'sequence' ? '1' : type === 'date' ? 'YYYYMMDD' : '',
      padding: type === 'sequence' ? 3 : undefined,
      enabled: true
    };
    setRules(r => [...r, newRule]);
  };

  const removeRule = (id: string) => setRules(r => r.filter(x => x.id !== id));

  const updateRule = (id: string, updates: Partial<RenameRule>) =>
    setRules(r => r.map(x => x.id === id ? { ...x, ...updates } : x));

  // Handle manual move up/down
  const moveRule = (idx: number, dir: 'up' | 'down') => {
    const newIdx = dir === 'up' ? idx - 1 : idx + 1;
    if (newIdx < 0 || newIdx >= rules.length) return;
    const next = [...rules];
    const [moved] = next.splice(idx, 1);
    next.splice(newIdx, 0, moved);
    setRules(next);
  };

  // Drag and drop mechanics
  const onDragStart = (idx: number) => {
    dragIndex.current = idx;
    setDragging(idx);
  };

  const onDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    dragOverIndex.current = idx;
  };

  const onDrop = () => {
    if (dragIndex.current === null || dragOverIndex.current === null) return;
    if (dragIndex.current === dragOverIndex.current) { setDragging(null); return; }
    const next = [...rules];
    const [moved] = next.splice(dragIndex.current, 1);
    next.splice(dragOverIndex.current, 0, moved);
    setRules(next);
    dragIndex.current = null;
    dragOverIndex.current = null;
    setDragging(null);
  };

  const onDragEnd = () => setDragging(null);

  return (
    <div className="space-y-4">
      {/* SEPARATOR CONFIG CARD */}
      <div className="bg-white border-2 border-black p-3.5 shadow-[2px_2px_0_rgba(0,0,0,1)] space-y-2">
        <div className="flex items-center justify-between border-b-2 border-black pb-1.5 mb-2.5">
          <span className="font-archivo text-[11px] font-black uppercase tracking-widest text-black">Name Separator</span>
        </div>
        <div className="flex gap-2">
          {[
            { value: '_', label: 'Underscore (_)' },
            { value: '-', label: 'Hyphen (-)' },
            { value: ' ', label: 'Space ( )' },
            { value: '', label: 'None' }
          ].map(opt => (
            <button
              key={opt.value}
              onClick={() => setSeparator(opt.value)}
              className={`flex-1 text-[11px] font-bold py-1 border border-black transition-colors ${
                separator === opt.value ? 'bg-black text-white' : 'bg-gray-50 hover:bg-gray-150'
              }`}
            >
              {opt.value === '' ? 'None' : opt.value === ' ' ? 'Space' : opt.value}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 pt-1.5">
          <span className="text-[9px] font-extrabold uppercase text-gray-500">Custom separator:</span>
          <input
            type="text"
            value={separator}
            onChange={(e) => setSeparator(e.target.value)}
            className="flex-1 text-xs border border-black px-1.5 py-0.5 bg-[#FAF9F6] font-mono text-center font-bold"
            maxLength={6}
          />
        </div>
      </div>

      {/* RENAME BLOCKS DYNAMIC LIST */}
      <div className="bg-white border-2 border-black p-3.5 shadow-[2px_2px_0_rgba(0,0,0,1)] space-y-3">
        <div className="flex items-center justify-between border-b-2 border-black pb-1.5 mb-1">
          <span className="font-archivo text-[11px] font-black uppercase tracking-widest text-black">Rename Template Components</span>
        </div>

        {rules.length === 0 ? (
          <p className="text-xs text-gray-500 italic py-4 text-center border border-dashed border-gray-300">
            No naming rules defined. Original filenames will be preserved.
          </p>
        ) : (
          <div className="space-y-2">
            {rules.map((rule, idx) => (
              <div
                key={rule.id}
                draggable
                onDragStart={() => onDragStart(idx)}
                onDragOver={e => onDragOver(e, idx)}
                onDrop={onDrop}
                onDragEnd={onDragEnd}
                className={`border border-black bg-gray-50 flex items-stretch transition-all ${
                  dragging === idx ? 'opacity-30 border-dashed border-gray-400' : 'opacity-100 shadow-[1px_1px_0_rgba(0,0,0,1)]'
                }`}
              >
                {/* Drag Handle */}
                <div 
                  className="w-7 bg-gray-200 border-r border-black flex flex-col items-center justify-center cursor-grab active:cursor-grabbing hover:bg-gray-300 shrink-0 select-none"
                  title="Drag to reorder"
                >
                  <GripVertical className="w-3.5 h-3.5 text-gray-600" />
                </div>

                {/* Block Content */}
                <div className="flex-1 p-2.5 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={rule.enabled}
                        onChange={(e) => updateRule(rule.id, { enabled: e.target.checked })}
                        className="w-3.5 h-3.5 border border-black rounded-none accent-black"
                        title="Enable component"
                      />
                      <span className="font-archivo text-[10px] font-black uppercase tracking-wider text-black">
                        {RULE_LABELS[rule.type]}
                      </span>
                    </div>

                    {/* Manual reorder arrows */}
                    <div className="flex gap-1 shrink-0">
                      <button
                        onClick={() => moveRule(idx, 'up')}
                        disabled={idx === 0}
                        className="text-gray-400 hover:text-black disabled:opacity-20"
                        title="Move Up"
                      >
                        <MoveUp className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => moveRule(idx, 'down')}
                        disabled={idx === rules.length - 1}
                        className="text-gray-400 hover:text-black disabled:opacity-20"
                        title="Move Down"
                      >
                        <MoveDown className="w-3 h-3" />
                      </button>
                    </div>
                  </div>

                  {/* Settings based on type */}
                  {rule.type === 'original' && (
                    <div className="text-[10px] text-gray-500 italic">
                      Inserts original name (without extension)
                    </div>
                  )}

                  {rule.type === 'text' && (
                    <input
                      type="text"
                      value={rule.value}
                      onChange={(e) => updateRule(rule.id, { value: e.target.value })}
                      placeholder="Custom label text..."
                      className="w-full text-xs border border-black px-2 py-0.5 bg-white font-mono"
                    />
                  )}

                  {rule.type === 'date' && (
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] font-extrabold uppercase text-gray-500 shrink-0">Format:</span>
                      <select
                        value={rule.value}
                        onChange={(e) => updateRule(rule.id, { value: e.target.value })}
                        className="flex-1 text-xs border border-black px-1.5 py-0.5 bg-white font-mono"
                      >
                        <option value="YYYYMMDD">YYYYMMDD (e.g. 20260622)</option>
                        <option value="YYYY-MM-DD">YYYY-MM-DD (e.g. 2026-06-22)</option>
                        <option value="YYMMDD">YYMMDD (e.g. 260622)</option>
                        <option value="YYYY-MM">YYYY-MM (e.g. 2026-06)</option>
                      </select>
                    </div>
                  )}

                  {rule.type === 'sequence' && (
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[9px] font-extrabold uppercase text-gray-500">Start:</span>
                        <input
                          type="number"
                          min={0}
                          value={rule.value}
                          onChange={(e) => updateRule(rule.id, { value: e.target.value })}
                          className="w-12 text-xs border border-black px-1 py-0.5 bg-white font-mono text-center"
                        />
                      </div>
                      <div className="flex items-center gap-1.5 flex-1">
                        <span className="text-[9px] font-extrabold uppercase text-gray-500">Padding:</span>
                        <select
                          value={rule.padding ?? 3}
                          onChange={(e) => updateRule(rule.id, { padding: parseInt(e.target.value) || 0 })}
                          className="flex-1 text-xs border border-black px-1 py-0.5 bg-white font-mono"
                        >
                          <option value={0}>None (1, 2, 10)</option>
                          <option value={2}>01, 02 (2 digits)</option>
                          <option value={3}>001, 002 (3 digits)</option>
                          <option value={4}>0001, 0002 (4 digits)</option>
                        </select>
                      </div>
                    </div>
                  )}
                </div>

                {/* Close Button */}
                <button
                  onClick={() => removeRule(rule.id)}
                  className="w-7 border-l border-black flex items-center justify-center hover:bg-red-50 hover:text-red-600 transition-colors shrink-0"
                  title="Remove component"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* ADD COMPONENT BUTTONS */}
        <div className="pt-2.5 border-t border-gray-200 space-y-1.5">
          <span className="text-[9px] font-extrabold uppercase tracking-widest text-gray-500 block">Add Component block</span>
          <div className="grid grid-cols-2 gap-1.5">
            <button
              onClick={() => addRule('original')}
              className="flex items-center justify-center gap-1 border border-black bg-white text-xs font-bold py-1.5 hover:bg-black hover:text-white transition-colors"
            >
              <Plus className="w-3 h-3" /> Original Name
            </button>
            <button
              onClick={() => addRule('text')}
              className="flex items-center justify-center gap-1 border border-black bg-white text-xs font-bold py-1.5 hover:bg-black hover:text-white transition-colors"
            >
              <Plus className="w-3 h-3" /> Custom Text
            </button>
            <button
              onClick={() => addRule('sequence')}
              className="flex items-center justify-center gap-1 border border-black bg-white text-xs font-bold py-1.5 hover:bg-black hover:text-white transition-colors"
            >
              <Plus className="w-3 h-3" /> Sequence #
            </button>
            <button
              onClick={() => addRule('date')}
              className="flex items-center justify-center gap-1 border border-black bg-white text-xs font-bold py-1.5 hover:bg-black hover:text-white transition-colors"
            >
              <Plus className="w-3 h-3" /> Date Stamp
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
