import React from 'react';
import { GripVertical, X } from 'lucide-react';
import { Rule, RuleType } from '../types';

interface RuleItemProps {
  rule: Rule;
  index: number;
  onUpdate: (id: string, updates: Partial<Rule>) => void;
  onRemove: (id: string) => void;
}

function getRuleLabel(type: RuleType) {
  switch (type) {
    case RuleType.TEXT:
      return 'Text';
    case RuleType.SEQUENCE:
      return 'Sequence';
    case RuleType.ORIGINAL:
      return 'Original';
    case RuleType.DATE:
      return 'Date';
    case RuleType.REPLACE:
      return 'Replace';
    default:
      return type;
  }
}

export const RuleItem: React.FC<RuleItemProps> = ({ rule, index, onUpdate, onRemove }) => {
  const inputClass =
    'w-full rounded-2xl border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 outline-none transition-colors focus:border-stone-500';
  const microLabelClass = 'mb-1 block text-[10px] font-semibold uppercase tracking-[0.18em] text-stone-500';

  const renderInputs = () => {
    switch (rule.type) {
      case RuleType.TEXT:
        return (
          <input
            type="text"
            value={rule.value || ''}
            onChange={(e) => onUpdate(rule.id, { value: e.target.value })}
            placeholder="Prefix, suffix, marker"
            className={inputClass}
          />
        );

      case RuleType.SEQUENCE:
        return (
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className={microLabelClass}>Start</label>
              <input
                type="number"
                value={rule.startNumber}
                onChange={(e) => onUpdate(rule.id, { startNumber: parseInt(e.target.value, 10) || 1 })}
                className={inputClass}
              />
            </div>
            <div>
              <label className={microLabelClass}>Digits</label>
              <select
                value={rule.padding}
                onChange={(e) => onUpdate(rule.id, { padding: parseInt(e.target.value, 10) || 1 })}
                className={inputClass}
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
          <div>
            <label className={microLabelClass}>Format</label>
            <select
              value={rule.dateFormat}
              onChange={(e) => onUpdate(rule.id, { dateFormat: e.target.value })}
              className={inputClass}
            >
              <option value="yyyyMMdd">YYYYMMDD</option>
              <option value="yyMMdd">YYMMDD</option>
              <option value="yyyy-MM-dd">YYYY-MM-DD</option>
              <option value="ddMMyy">DDMMYY</option>
              <option value="dd-MM-yy">DD-MM-YY</option>
              <option value="MMddyy">MMDDYY</option>
              <option value="HHmmss">HHMMSS</option>
            </select>
          </div>
        );

      case RuleType.ORIGINAL:
        return (
          <div className="rounded-2xl border border-dashed border-stone-300 bg-stone-50 px-3 py-3 text-sm text-stone-500">
            Keep the original filename in the pattern at this position.
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="rounded-[1.4rem] border border-stone-200 bg-white p-4 shadow-[0_10px_30px_rgba(28,25,23,0.05)]">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="rounded-full border border-stone-200 bg-stone-50 p-2 text-stone-400">
            <GripVertical size={14} />
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-stone-400">
              Block {index + 1}
            </p>
            <h3 className="font-serif text-lg text-stone-900">{getRuleLabel(rule.type)}</h3>
          </div>
        </div>

        <button
          type="button"
          onClick={() => onRemove(rule.id)}
          className="rounded-full border border-stone-200 bg-white p-2 text-stone-400 transition-colors hover:border-red-200 hover:text-red-600"
          title="Remove block"
        >
          <X size={14} />
        </button>
      </div>

      {renderInputs()}
    </div>
  );
};
