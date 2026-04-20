import React from 'react';
import { Rule, RuleType } from '../types';
import { X, GripVertical } from 'lucide-react';

interface RuleItemProps {
  rule: Rule;
  index: number;
  onUpdate: (id: string, updates: Partial<Rule>) => void;
  onRemove: (id: string) => void;
}

export const RuleItem: React.FC<RuleItemProps> = ({ rule, onUpdate, onRemove }) => {
  
  const renderInputs = () => {
    switch (rule.type) {
      case RuleType.TEXT:
        return (
          <input
            type="text"
            value={rule.value || ''}
            onChange={(e) => onUpdate(rule.id, { value: e.target.value })}
            placeholder="Enter text..."
            className="flex-1 bg-slate-800 border border-slate-700 text-white text-sm rounded px-2 py-1 focus:ring-1 focus:ring-otis-accent focus:border-otis-accent outline-none"
          />
        );
      
      case RuleType.SEQUENCE:
        return (
          <div className="flex gap-2 items-center">
            <div className="flex flex-col">
              <label className="text-[10px] text-slate-500 uppercase font-bold">Start</label>
              <input
                type="number"
                value={rule.startNumber}
                onChange={(e) => onUpdate(rule.id, { startNumber: parseInt(e.target.value) || 1 })}
                className="w-20 bg-slate-800 border border-slate-700 text-white text-sm rounded px-2 py-1 outline-none"
              />
            </div>
            <div className="flex flex-col">
              <label className="text-[10px] text-slate-500 uppercase font-bold">Digits</label>
              <select
                value={rule.padding}
                onChange={(e) => onUpdate(rule.id, { padding: parseInt(e.target.value) || 1 })}
                className="w-24 bg-slate-800 border border-slate-700 text-white text-sm rounded px-2 py-1 outline-none"
              >
                <option value={1}>1</option>
                <option value={2}>2 (01)</option>
                <option value={3}>3 (001)</option>
                <option value={4}>4 (0001)</option>
                <option value={5}>5 (00001)</option>
                <option value={6}>6 (000001)</option>
              </select>
            </div>
          </div>
        );

      case RuleType.DATE:
        return (
          <div className="flex flex-col w-full">
            <select
              value={rule.dateFormat}
              onChange={(e) => onUpdate(rule.id, { dateFormat: e.target.value })}
              className="w-full bg-slate-800 border border-slate-700 text-white text-sm rounded px-2 py-1 outline-none"
            >
              <option value="yyyyMMdd">YYYYMMDD</option>
              <option value="yyMMdd">YYMMDD</option>
              <option value="yyyy-MM-dd">YYYY-MM-DD</option>
              <option value="ddMMyy">DDMMYY</option>
              <option value="dd-MM-yy">DD-MM-YY</option>
              <option value="MMddyy">MMDDYY</option>
              <option value="HHmmss">HHMMSS (Time)</option>
            </select>
          </div>
        );

      case RuleType.ORIGINAL:
        return (
          <div className="text-slate-500 text-sm italic px-2">
            Using original filename
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="flex items-center gap-3 bg-slate-900/50 p-3 rounded-lg border border-slate-800 group hover:border-slate-700 transition-all">
      <div className="cursor-grab active:cursor-grabbing text-slate-600 hover:text-slate-400">
        <GripVertical size={16} />
      </div>
      
      <div className="w-32 flex-shrink-0">
        <span className="text-xs font-mono font-semibold text-otis-accent uppercase tracking-wider block mb-1">
          {rule.type}
        </span>
      </div>

      <div className="flex-1 flex items-center">
        {renderInputs()}
      </div>

      <button
        onClick={() => onRemove(rule.id)}
        className="text-slate-600 hover:text-red-500 p-1 rounded-md transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
        title="Remove Rule"
      >
        <X size={16} />
      </button>
    </div>
  );
};