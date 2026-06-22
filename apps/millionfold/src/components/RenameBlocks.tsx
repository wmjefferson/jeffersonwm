import React, { useRef, useState } from 'react';
import type { RuleBlock } from '../App';

interface Props {
  rules: RuleBlock[];
  setRules: React.Dispatch<React.SetStateAction<RuleBlock[]>>;
}

const RULE_LABELS: Record<RuleBlock['type'], string> = {
  original: 'ORIGINAL',
  text: 'TEXT',
  date: 'DATE',
  sequence: 'SEQUENCE',
};

const RULE_SUBTITLES: Record<RuleBlock['type'], string> = {
  original: 'Using original filename',
  text: '',
  date: 'YYYY-MM-DD',
  sequence: '',
};

function GripIcon() {
  return (
    <svg width="12" height="16" viewBox="0 0 12 16" fill="none" className="shrink-0 text-[#999]">
      {[2,6,10].map(cx =>
        [3, 8, 13].map(cy => (
          <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={1.2} fill="currentColor" />
        ))
      )}
    </svg>
  );
}

function XIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
      <path d="M1 1l8 8M9 1l-8 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export default function RenameBlocks({ rules, setRules }: Props) {
  const dragIndex = useRef<number | null>(null);
  const dragOverIndex = useRef<number | null>(null);
  const [dragging, setDragging] = useState<number | null>(null);

  const addRule = (type: RuleBlock['type']) => {
    const newRule: RuleBlock = {
      id: Math.random().toString(36).slice(2),
      type,
      value: type === 'text' ? '-' : type === 'sequence' ? '1' : type === 'date' ? 'YYYY-MM-DD' : '',
      padding: type === 'sequence' ? 3 : undefined,
    };
    setRules(r => [...r, newRule]);
  };

  const removeRule = (id: string) => setRules(r => r.filter(x => x.id !== id));

  const updateRule = (id: string, updates: Partial<RuleBlock>) =>
    setRules(r => r.map(x => x.id === id ? { ...x, ...updates } : x));

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
    <div className="flex flex-col gap-0">
      {/* Rule blocks */}
      <div className="flex flex-col gap-0 px-4 pb-2">
        {rules.map((rule, idx) => (
          <div
            key={rule.id}
            draggable
            onDragStart={() => onDragStart(idx)}
            onDragOver={e => onDragOver(e, idx)}
            onDrop={onDrop}
            onDragEnd={onDragEnd}
            className={`border-[2px] border-black bg-white mb-[-2px] flex flex-col transition-opacity ${dragging === idx ? 'opacity-40' : 'opacity-100'}`}
          >
            <div className="flex items-start gap-2 p-2.5">
              <div className="cursor-grab active:cursor-grabbing pt-0.5">
                <GripIcon />
              </div>
              <div className="flex-1 flex flex-col gap-1.5">
                <span className="font-archivo text-[11px] font-bold uppercase tracking-widest">
                  {RULE_LABELS[rule.type]}
                </span>
                {rule.type === 'original' && (
                  <span className="font-sans text-[10px] text-[#888] uppercase tracking-wider">
                    Using original filename
                  </span>
                )}
                {rule.type === 'text' && (
                  <input
                    className="border-[2px] border-black px-2 py-0.5 text-sm font-sans focus:outline-none w-full"
                    value={rule.value}
                    onChange={e => updateRule(rule.id, { value: e.target.value })}
                    placeholder="text..."
                  />
                )}
                {rule.type === 'date' && (
                  <div className="flex flex-col gap-1">
                    <span className="font-sans text-[10px] text-[#888] uppercase tracking-wider">Format</span>
                    <select
                      className="border-[2px] border-black px-1 py-0.5 text-xs font-sans focus:outline-none bg-white"
                      value={rule.value}
                      onChange={e => updateRule(rule.id, { value: e.target.value })}
                    >
                      <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                      <option value="YYYYMMDD">YYYYMMDD</option>
                      <option value="MM-DD-YYYY">MM-DD-YYYY</option>
                      <option value="DD-MM-YYYY">DD-MM-YYYY</option>
                    </select>
                  </div>
                )}
                {rule.type === 'sequence' && (
                  <div className="flex gap-3">
                    <div className="flex flex-col gap-0.5">
                      <span className="font-archivo text-[9px] uppercase tracking-widest text-[#888]">Start at</span>
                      <input
                        type="number" min={0}
                        className="border-[2px] border-black px-2 py-0.5 text-sm font-sans focus:outline-none w-16"
                        value={rule.value}
                        onChange={e => updateRule(rule.id, { value: e.target.value })}
                      />
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <span className="font-archivo text-[9px] uppercase tracking-widest text-[#888]">Digits</span>
                      <select
                        className="border-[2px] border-black px-1 py-0.5 text-xs font-sans focus:outline-none bg-white"
                        value={rule.padding ?? 3}
                        onChange={e => updateRule(rule.id, { padding: Number(e.target.value) })}
                      >
                        {[1,2,3,4,5,6].map(n => <option key={n} value={n}>{n}</option>)}
                      </select>
                    </div>
                  </div>
                )}
              </div>
              <button
                onClick={() => removeRule(rule.id)}
                className="text-[#aaa] hover:text-black transition-colors mt-0.5 p-0.5"
                title="Remove"
              >
                <XIcon />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Add rule buttons */}
      <div className="px-4 pb-2">
        <div className="font-archivo text-[9px] uppercase tracking-widest text-[#888] mb-2">Add rule block</div>
        <div className="grid grid-cols-2 gap-[-2px]">
          {(['text', 'date', 'sequence', 'original'] as RuleBlock['type'][]).map(type => (
            <button
              key={type}
              onClick={() => addRule(type)}
              className="border-[2px] border-black bg-white px-2 py-1.5 font-archivo text-[11px] font-bold uppercase tracking-wider hover:bg-black hover:text-white transition-colors mb-[-2px]"
            >
              + {type === 'original' ? 'Original Name' : type}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
