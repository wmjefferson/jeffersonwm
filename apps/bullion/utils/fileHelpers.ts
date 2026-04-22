import { Rule, RuleType, FileData } from '../types';
import { format } from 'date-fns';
import JSZip from 'jszip';

// Helper to pad numbers
const padNumber = (num: number, width: number): string => {
  const n = num.toString();
  return n.length >= width ? n : new Array(width - n.length + 1).join('0') + n;
};

// Main renaming engine
export const generateNewNames = (files: FileData[], rules: Rule[]): FileData[] => {
  return files.map((file, index) => {
    let nameParts: string[] = [];

    // If no rules, keep original
    if (rules.length === 0) {
      return { ...file, newName: file.originalName };
    }

    rules.forEach(rule => {
      switch (rule.type) {
        case RuleType.TEXT:
          if (rule.value) nameParts.push(rule.value);
          break;

        case RuleType.SEQUENCE:
          const start = rule.startNumber || 1;
          const currentNum = start + index;
          const padding = rule.padding || 1;
          nameParts.push(padNumber(currentNum, padding));
          break;

        case RuleType.ORIGINAL:
          let baseName = file.originalName.substring(0, file.originalName.lastIndexOf('.')) || file.originalName;
          nameParts.push(baseName);
          break;
        
        case RuleType.REPLACE:
           // Note: Replace usually acts on the "Original Name" part if it exists, 
           // but to simplify the bridge-like flow where you construct a string:
           // We will treat REPLACE as a modifier of the *current accumulated string* or allow it to be a standalone block?
           // Adobe Bridge "String Substitution" usually runs on the original filename.
           // However, in a block-based builder, "Original Name" is a block.
           // We will simplify: If the user adds a REPLACE block, it's ignored in this builder unless we implement a complex pipeline.
           // BETTER APPROACH for this UI: "Original Name" block has a "Replace" option inside it?
           // OR: We interpret "Original Name" block as the only place where we get the original name.
           // Let's stick to the blocks requested. 
           // If we add a REPLACE rule, let's assume it replaces text in the *Original Name* component. 
           // Actually, simpler implementation for now: The REPLACE rule applies to the *entire string generated so far*? No that's confusing.
           // Let's treat REPLACE as "Original Name with Replacement". 
           // So we won't have a standalone REPLACE rule type in the generator loop if we want to be strict.
           // But let's support "Text Substitution" on the original name if a user selects an option.
           // For this implementation, let's stick to: Text, Sequence, Original, Date.
           // If we need replace, we'll do it inside the 'Original' logic.
           break;

        case RuleType.DATE:
          try {
            const dateVal = new Date(file.lastModified);
            // Default to yyyyMMdd if no format provided
            const fmt = rule.dateFormat || 'yyyyMMdd'; 
            nameParts.push(format(dateVal, fmt));
          } catch (e) {
            // Fallback
            nameParts.push(Date.now().toString());
          }
          break;
      }
    });

    // Special Handling for REPLACE: 
    // If we wanted to implement search/replace, we would probably need to run it on the final string or just the original name part.
    // Given the constraints of a simple list builder, let's assume rules build the string.

    const baseName = nameParts.join('');
    // Always preserve extension logic for safety, unless we wanted to change it.
    // We append the extension at the end.
    const newName = `${baseName}.${file.extension}`;

    return { ...file, newName };
  });
};

export const createZip = async (files: FileData[]): Promise<Blob> => {
  const zip = new JSZip();
  
  // Track used names to avoid duplicates in ZIP
  const usedNames = new Set<string>();

  files.forEach(f => {
    let finalName = f.newName;
    
    // Simple duplicate prevention
    let counter = 1;
    while (usedNames.has(finalName)) {
      const dotIndex = finalName.lastIndexOf('.');
      const base = dotIndex !== -1 ? finalName.substring(0, dotIndex) : finalName;
      const ext = dotIndex !== -1 ? finalName.substring(dotIndex) : '';
      finalName = `${base}_${counter}${ext}`;
      counter++;
    }
    usedNames.add(finalName);

    zip.file(finalName, f.file);
  });

  return await zip.generateAsync({ type: 'blob' });
};

export const formatBytes = (bytes: number, decimals = 2) => {
  if (!+bytes) return '0 Bytes';

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];

  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
};