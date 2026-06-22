import React, { useState } from 'react';
import { Folder, FolderOpen, ChevronDown, ChevronRight, File, ShieldAlert, ListFilter } from 'lucide-react';
import type { PlannedFile, PlannedFolder, Plan } from '../App';

function FileNode({ file }: { file: PlannedFile }) {
  const isRenamed = file.original_name !== file.new_name;
  return (
    <div
      className="flex items-center gap-2 py-0.5 px-2 hover:bg-gray-50 text-xs font-mono border border-transparent transition-colors group"
    >
      <File className="w-3.5 h-3.5 text-gray-400 shrink-0" />
      <div className="flex items-center gap-1.5 truncate">
        <span className="text-gray-500 truncate" title="Original name">{file.original_name}</span>
        {isRenamed && (
          <>
            <span className="text-gray-400 font-bold shrink-0">→</span>
            <span className="text-red-600 font-bold truncate" title="New name">{file.new_name}</span>
          </>
        )}
      </div>
    </div>
  );
}

interface FolderProps {
  folder: PlannedFolder;
  depth: number;
  iconType?: 'default' | 'non-image' | 'filter';
}

function FolderNode({ folder, depth, iconType = 'default' }: FolderProps) {
  const [isOpen, setIsOpen] = useState(true);
  const hasContent = folder.files.length > 0 || folder.children.length > 0;

  let iconColor = 'text-yellow-600';
  if (iconType === 'non-image') {
    iconColor = 'text-gray-600';
  } else if (iconType === 'filter') {
    iconColor = 'text-red-600';
  }

  return (
    <div className="select-none">
      <div
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 py-1 px-2 hover:bg-gray-100 cursor-pointer font-bold border-b border-gray-150"
      >
        <span className="text-gray-400 shrink-0">
          {hasContent ? (
            isOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />
          ) : (
            <span className="w-3.5 h-3.5 block" />
          )}
        </span>
        
        {iconType === 'filter' ? (
          <ListFilter className={`w-4 h-4 ${iconColor} shrink-0`} />
        ) : iconType === 'non-image' ? (
          <ShieldAlert className={`w-4 h-4 ${iconColor} shrink-0`} />
        ) : isOpen ? (
          <FolderOpen className={`w-4 h-4 ${iconColor} shrink-0`} />
        ) : (
          <Folder className={`w-4 h-4 ${iconColor} shrink-0`} />
        )}

        <span className="font-archivo text-xs uppercase tracking-wide truncate">
          {folder.display_name}
        </span>
      </div>

      {isOpen && hasContent && (
        <div 
          className="border-l border-gray-300 ml-4 pl-1.5 mt-0.5 space-y-0.5"
          style={{ paddingLeft: '8px' }}
        >
          {/* Subfolders */}
          {folder.children.map((sub, i) => (
            <FolderNode
              key={i}
              folder={sub}
              depth={depth + 1}
              iconType={iconType}
            />
          ))}

          {/* Files */}
          {folder.files.map((file, i) => (
            <FileNode
              key={i}
              file={file}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface PreviewTreeProps {
  plan: Plan;
}

export default function PreviewTree({ plan }: PreviewTreeProps) {
  const hasFolders = plan.folders.length > 0;
  const hasNonImages = plan.non_image_folder !== null;
  const hasFilterFolders = plan.filter_folders.length > 0;

  return (
    <div className="space-y-4">
      {/* Root destination display */}
      <div className="border border-black p-2 bg-gray-100 text-[10px] font-mono font-bold uppercase tracking-wider select-text flex items-center gap-1.5 truncate">
        <Folder className="w-3.5 h-3.5 text-black shrink-0" />
        Destination Root: {plan.root_path}
      </div>

      <div className="border border-black bg-white shadow-[1px_1px_0_rgba(0,0,0,1)] divide-y divide-black overflow-hidden">
        {/* Distributed Image folders */}
        {hasFolders && (
          <div className="divide-y divide-gray-200">
            {plan.folders.map((f, i) => (
              <FolderNode
                key={i}
                folder={f}
                depth={0}
              />
            ))}
          </div>
        )}

        {/* Filters/Moved Folders */}
        {hasFilterFolders && (
          <div className="divide-y divide-gray-200 border-t border-black bg-red-50/20">
            <div className="bg-red-50 px-3 py-1 text-[9px] font-extrabold uppercase tracking-widest text-red-800 border-b border-black">
              Filtered File Outputs
            </div>
            {plan.filter_folders.map((f, i) => (
              <FolderNode
                key={i}
                folder={f}
                depth={0}
                iconType="filter"
              />
            ))}
          </div>
        )}

        {/* Non-Images Folder */}
        {hasNonImages && plan.non_image_folder && (
          <div className="divide-y divide-gray-200 border-t border-black bg-gray-50">
            <div className="bg-gray-100 px-3 py-1 text-[9px] font-extrabold uppercase tracking-widest text-gray-800 border-b border-black">
              Non-Image Files Folder
            </div>
            <FolderNode
              folder={plan.non_image_folder}
              depth={0}
              iconType="non-image"
            />
          </div>
        )}
      </div>
    </div>
  );
}
