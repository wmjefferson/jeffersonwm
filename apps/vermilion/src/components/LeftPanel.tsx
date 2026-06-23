import React from 'react';

interface Props {
  sortBy: 'char' | 'full' | 'date_modified_day' | 'date_modified_month' | 'date_modified_year' | 'date_created_day' | 'date_created_month' | 'date_created_year';
  setSortBy: (val: 'char' | 'full' | 'date_modified_day' | 'date_modified_month' | 'date_modified_year' | 'date_created_day' | 'date_created_month' | 'date_created_year') => void;
  charCount: number;
  setCharCount: (val: number) => void;
  distMode: 'max_per_folder' | 'num_folders' | 'exact_per_folder' | 'group_by_date' | 'group_by_name';
  setDistMode: (val: 'max_per_folder' | 'num_folders' | 'exact_per_folder' | 'group_by_date' | 'group_by_name') => void;
  distCount: number;
  setDistCount: (val: number) => void;
  structure: 'flat' | 'nested';
  setStructure: (val: 'flat' | 'nested') => void;
  appendRange: boolean;
  setAppendRange: (val: boolean) => void;
}

function SectionHeader({ label }: { label: string }) {
  return (
    <div className="pt-1 pb-2">
      <span className="font-archivo text-[11px] font-black uppercase tracking-widest text-black border-b-2 border-black pb-0.5 block">{label}</span>
    </div>
  );
}

export default function LeftPanel({
  sortBy, setSortBy,
  charCount, setCharCount,
  distMode, setDistMode,
  distCount, setDistCount,
  structure, setStructure,
  appendRange, setAppendRange
}: Props) {
  const isGroupingMode = distMode === 'group_by_date' || distMode === 'group_by_name';

  return (
    <div className="space-y-5">
      
      {/* SORT METHOD (Hidden when grouping mode handles it directly) */}
      {!isGroupingMode && (
        <div className="bg-white border-2 border-black p-3.5 shadow-[2px_2px_0_rgba(0,0,0,1)] space-y-3">
          <SectionHeader label="Sort Methods" />
          
          <div className="space-y-2">
            {[
              { value: 'char', label: 'First N Characters' },
              { value: 'full', label: 'Full Filename' },
              { value: 'date_modified', label: 'Date Modified', isDate: true, defaultVal: 'date_modified_day' },
              { value: 'date_created', label: 'Date Created', isDate: true, defaultVal: 'date_created_day' }
            ].map(opt => {
              const isChecked = opt.isDate ? sortBy.startsWith(opt.value) : sortBy === opt.value;
              return (
                <label key={opt.value} className="flex items-center gap-2.5 cursor-pointer select-none">
                  <input
                    type="radio"
                    name="sort_by"
                    checked={isChecked}
                    onChange={() => setSortBy((opt.defaultVal || opt.value) as any)}
                    className="w-4 h-4 border-2 border-black rounded-full accent-black cursor-pointer"
                  />
                  <span className="font-archivo text-xs font-bold uppercase tracking-wider text-gray-700">{opt.label}</span>
                </label>
              );
            })}
          </div>

          {sortBy === 'char' && (
            <div className="pt-2 border-t border-gray-100 flex items-center justify-between">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-gray-500">Character count:</span>
              <div className="flex gap-1">
                {[1, 2, 3].map(n => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setCharCount(n)}
                    className={`w-7 h-7 text-xs font-bold border border-black flex items-center justify-center transition-colors ${
                      charCount === n ? 'bg-black text-white' : 'bg-gray-100 text-black hover:bg-gray-200'
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
          )}

          {sortBy.startsWith('date_modified') && (
            <div className="pt-2 border-t border-gray-100 flex items-center justify-between">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-gray-500">Group by:</span>
              <div className="flex gap-1">
                {[
                  { value: 'day', label: 'Day' },
                  { value: 'month', label: 'Month' },
                  { value: 'year', label: 'Year' }
                ].map(g => (
                  <button
                    key={g.value}
                    type="button"
                    onClick={() => setSortBy(`date_modified_${g.value}` as any)}
                    className={`px-2.5 py-1 text-[10px] font-bold border border-black flex items-center justify-center transition-colors uppercase tracking-wider ${
                      sortBy === `date_modified_${g.value}` ? 'bg-black text-white' : 'bg-gray-100 text-black hover:bg-gray-200'
                    }`}
                  >
                    {g.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {sortBy.startsWith('date_created') && (
            <div className="pt-2 border-t border-gray-100 flex items-center justify-between">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-gray-500">Group by:</span>
              <div className="flex gap-1">
                {[
                  { value: 'day', label: 'Day' },
                  { value: 'month', label: 'Month' },
                  { value: 'year', label: 'Year' }
                ].map(g => (
                  <button
                    key={g.value}
                    type="button"
                    onClick={() => setSortBy(`date_created_${g.value}` as any)}
                    className={`px-2.5 py-1 text-[10px] font-bold border border-black flex items-center justify-center transition-colors uppercase tracking-wider ${
                      sortBy === `date_created_${g.value}` ? 'bg-black text-white' : 'bg-gray-100 text-black hover:bg-gray-200'
                    }`}
                  >
                    {g.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}


      {/* DISTRIBUTION MODE */}
      <div className="bg-white border-2 border-black p-3.5 shadow-[2px_2px_0_rgba(0,0,0,1)] space-y-3">
        <SectionHeader label="Distribution Rules" />

        <div className="space-y-2">
          {[
            { value: 'max_per_folder', label: 'Max Files Per Folder' },
            { value: 'num_folders', label: 'Target Number of Folders' },
            { value: 'exact_per_folder', label: 'Exact Count Per Folder' },
            { value: 'group_by_date', label: 'Group by Date' },
            { value: 'group_by_name', label: 'Group by Name Prefix' }
          ].map(opt => (
            <label key={opt.value} className="flex items-center gap-2.5 cursor-pointer select-none">
              <input
                type="radio"
                name="dist_mode"
                checked={distMode === opt.value}
                onChange={() => {
                  setDistMode(opt.value as any);
                  if (opt.value === 'group_by_date') {
                    if (!sortBy.startsWith('date_modified') && !sortBy.startsWith('date_created')) {
                      setSortBy('date_modified_month');
                    }
                  } else if (opt.value === 'group_by_name') {
                    setSortBy('char');
                  }
                }}
                className="w-4 h-4 border-2 border-black rounded-full accent-black cursor-pointer"
              />
              <span className="font-archivo text-xs font-bold uppercase tracking-wider text-gray-700">{opt.label}</span>
            </label>
          ))}
        </div>

        {/* Count limits config */}
        {!isGroupingMode && (
          <div className="pt-2 border-t border-gray-100 flex flex-col gap-1.5">
            <label className="text-[10px] font-extrabold uppercase tracking-wider text-gray-500">
              {distMode === 'max_per_folder' && 'Maximum Count limit'}
              {distMode === 'num_folders' && 'Desired Folder count'}
              {distMode === 'exact_per_folder' && 'Exact Files quantity'}
            </label>
            <input
              type="number"
              min={1}
              max={5000}
              value={distCount}
              onChange={(e) => setDistCount(Math.max(1, parseInt(e.target.value) || 1))}
              className="w-full border-2 border-black px-2 py-1 text-xs font-mono font-bold bg-[#FAF9F6]"
            />
          </div>
        )}

        {/* Group by Date config */}
        {distMode === 'group_by_date' && (
          <div className="pt-2 border-t border-gray-100 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-gray-500">Date Type:</span>
              <div className="flex gap-1">
                {[
                  { value: 'date_modified', label: 'Modified' },
                  { value: 'date_created', label: 'Created' }
                ].map(opt => {
                  const isCurrent = sortBy.startsWith(opt.value);
                  const suffix = sortBy.endsWith('_year') ? 'year' : sortBy.endsWith('_month') ? 'month' : 'day';
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setSortBy(`${opt.value}_${suffix}` as any)}
                      className={`px-2 py-1 text-[10px] font-bold border border-black flex items-center justify-center transition-colors uppercase tracking-wider ${
                        isCurrent ? 'bg-black text-white' : 'bg-gray-100 text-black hover:bg-gray-200'
                      }`}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-gray-500">Group by:</span>
              <div className="flex gap-1">
                {[
                  { value: 'day', label: 'Day' },
                  { value: 'month', label: 'Month' },
                  { value: 'year', label: 'Year' }
                ].map(g => {
                  const isCurrent = sortBy.endsWith(`_${g.value}`);
                  const prefix = sortBy.startsWith('date_created') ? 'date_created' : 'date_modified';
                  return (
                    <button
                      key={g.value}
                      type="button"
                      onClick={() => setSortBy(`${prefix}_${g.value}` as any)}
                      className={`px-2.5 py-1 text-[10px] font-bold border border-black flex items-center justify-center transition-colors uppercase tracking-wider ${
                        isCurrent ? 'bg-black text-white' : 'bg-gray-100 text-black hover:bg-gray-200'
                      }`}
                    >
                      {g.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Group by Name Prefix config */}
        {distMode === 'group_by_name' && (
          <div className="pt-2 border-t border-gray-100 flex items-center justify-between">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-gray-500">Character count:</span>
            <div className="flex gap-1">
              {[1, 2, 3].map(n => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setCharCount(n)}
                  className={`w-7 h-7 text-xs font-bold border border-black flex items-center justify-center transition-colors ${
                    charCount === n ? 'bg-black text-white' : 'bg-gray-100 text-black hover:bg-gray-200'
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* STRUCTURE & LABELS */}
      <div className="bg-white border-2 border-black p-3.5 shadow-[2px_2px_0_rgba(0,0,0,1)] space-y-4">
        <SectionHeader label="Structure & Naming" />

        <div className="flex flex-col gap-3">
          <div className="space-y-1">
            <span className="text-[9px] font-extrabold uppercase tracking-wider text-gray-500 block">Directory Structure</span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setStructure('flat')}
                className={`flex-1 text-xs font-bold py-1.5 border-2 border-black shadow-[1.5px_1.5px_0_rgba(0,0,0,1)] transition-all ${
                  structure === 'flat' ? 'bg-[#FFEB3B] text-black font-black' : 'bg-white hover:bg-gray-50'
                }`}
              >
                Flat Folders
              </button>
              <button
                type="button"
                onClick={() => setStructure('nested')}
                className={`flex-1 text-xs font-bold py-1.5 border-2 border-black shadow-[1.5px_1.5px_0_rgba(0,0,0,1)] transition-all ${
                  structure === 'nested' ? 'bg-[#FFEB3B] text-black font-black' : 'bg-white hover:bg-gray-50'
                }`}
              >
                Nested Tree
              </button>
            </div>
          </div>

          <label className="flex items-center gap-2 cursor-pointer select-none border-t border-gray-100 pt-3">
            <input
              type="checkbox"
              checked={appendRange}
              onChange={(e) => setAppendRange(e.target.checked)}
              className="w-4 h-4 border-2 border-black rounded-none accent-black cursor-pointer"
            />
            <div className="flex flex-col">
              <span className="font-archivo text-xs font-bold uppercase tracking-wider text-gray-700">Append Sort Ranges</span>
              <span className="text-[9px] text-gray-500 leading-tight">Add "- Aa - Az" to directory names</span>
            </div>
          </label>
        </div>
      </div>

    </div>
  );
}

