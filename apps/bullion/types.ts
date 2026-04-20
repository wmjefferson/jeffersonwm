export enum RuleType {
  TEXT = 'TEXT',
  SEQUENCE = 'SEQUENCE',
  ORIGINAL = 'ORIGINAL',
  DATE = 'DATE',
  REPLACE = 'REPLACE'
}

export interface Rule {
  id: string;
  type: RuleType;
  // Common
  value?: string;
  // Sequence specific
  startNumber?: number;
  padding?: number; // e.g. 3 for "001"
  // Original / Replace specific
  replaceTarget?: string;
  replaceWith?: string;
  caseSensitive?: boolean;
  // Date specific
  dateFormat?: string; // e.g., 'yyyy-MM-dd'
}

export interface FileData {
  id: string;
  file: File;
  originalName: string;
  newName: string;
  extension: string;
  size: number;
  lastModified: number;
}

export type SortField = 'name' | 'date' | 'size';
export type SortDirection = 'asc' | 'desc';

export interface SortConfig {
  field: SortField;
  direction: SortDirection;
}