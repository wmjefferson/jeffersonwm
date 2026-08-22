import React, { useEffect, useMemo, useState, useRef } from 'react';
import { FolderOpen, X, Check, Download, ArrowLeft, FileImage, Tag, List, Plus, Search, Minus, Copy, BookImage, PencilLine } from 'lucide-react';
import StagingView, { DownloadOptions } from './components/StagingView';

const renderableExts = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.avif', '.svg', '.bmp'];
const videoExts = ['.mp4', '.mov', '.avi', '.mkv', '.webm'];
type MediaKind = 'image' | 'video' | 'other';

interface MediaEntry {
  path: string;
  name: string;
  folderPath?: string;
  kind: MediaKind;
  ext: string;
  title?: string;
  description?: string;
  tags?: string[];
  is_large?: boolean;
  size?: number;
  isMissing?: boolean;
}

interface FolderEntry {
  path: string;
  name: string;
  title?: string;
  description?: string;
  thumbnailPath: string | null;
  thumbnailKind: MediaKind | null;
  thumbnailExt: string;
  imageThumbnailPath?: string | null;
  imageThumbnailKind?: MediaKind | null;
  imageThumbnailExt?: string;
  secondaryThumbnailPath?: string | null;
  secondaryThumbnailKind?: MediaKind | null;
  secondaryThumbnailExt?: string;
  cover1Path?: string | null;
  cover2Path?: string | null;
  itemCount: number;
  fileCount: number;
  folderCount: number;
  hasCoverOverride?: boolean;
  visibleToUsers: boolean;
  visibleToAdmins: boolean;
}

interface FolderApiEntry {
  path?: string;
  name?: string;
  title?: string;
  description?: string;
  thumbnailPath?: string | null;
  thumbnailKind?: MediaKind | null;
  thumbnailExt?: string;
  imageThumbnailPath?: string | null;
  imageThumbnailKind?: MediaKind | null;
  imageThumbnailExt?: string;
  secondaryThumbnailPath?: string | null;
  secondaryThumbnailKind?: MediaKind | null;
  secondaryThumbnailExt?: string;
  cover1Path?: string | null;
  cover2Path?: string | null;
  itemCount?: number;
  fileCount?: number;
  folderCount?: number;
  hasCoverOverride?: boolean;
  visibleToUsers?: boolean;
  visibleToAdmins?: boolean;
}

interface AuthUser {
  id: number | string;
  username: string;
  isAdmin: boolean;
  isOwner?: boolean;
  isApproved: boolean;
  isBlocked: boolean;
  requestNote: string | null;
  createdAt: string;
  approvedAt: string | null;
  blockedAt: string | null;
}

interface AuthStatus {
  ok: boolean;
  user: AuthUser | null;
  requireAuth: boolean;
  hasUsers: boolean;
  provider?: 'local' | 'central';
  authBaseUrl?: string | null;
  requiredAppMembership?: string | null;
}

type FolderAccountAccessMode = 'allow' | 'deny';
type FolderAccountAccess = Record<string, FolderAccountAccessMode>;

interface FolderParentAccess {
  visibleToUsers: boolean;
  visibleToAdmins: boolean;
  accounts: FolderAccountAccess;
}

interface DownloadHistoryEntry {
  id: number | string;
  user_id: number | string | null;
  username_snapshot: string | null;
  action: string;
  file_path: string;
  output_name: string | null;
  source_ip: string | null;
  user_agent: string | null;
  created_at: string;
}

type AccountPanel = 'auth' | 'user' | 'admin' | 'manage' | null;

const isRenderable = (filename: string) => {
  const ext = filename.substring(filename.lastIndexOf('.')).toLowerCase();
  return renderableExts.includes(ext);
};

const getMediaKind = (filename: string): MediaKind => {
  const ext = filename.substring(filename.lastIndexOf('.')).toLowerCase();
  if (renderableExts.includes(ext)) return 'image';
  if (videoExts.includes(ext)) return 'video';
  return 'other';
};

const basename = (filename: string) => filename.split('/').pop() || filename;

const dirname = (filename: string) => {
  const parts = filename.split('/').filter(Boolean);
  if (parts.length <= 1) return 'root';
  return parts.slice(0, -1).join('/');
};

const extensionOf = (filename: string) => {
  const name = basename(filename);
  const dotIndex = name.lastIndexOf('.');
  return dotIndex >= 0 ? name.slice(dotIndex).toLowerCase() : '';
};

const labelWithoutExtension = (filename: string) => {
  const name = basename(filename);
  const dotIndex = name.lastIndexOf('.');
  return dotIndex > 0 ? name.slice(0, dotIndex) : name;
};

const sortSharesNewestFirst = <T extends { created_at?: string }>(shares: T[]) =>
  [...shares].sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));

const getFileTypeCode = (filename: string) => {
  const ext = extensionOf(filename).replace('.', '').toUpperCase();
  return ext || 'FILE';
};

const getFileTypeTone = (filename: string) => {
  const ext = extensionOf(filename);

  if (['.pdf', '.doc', '.docx', '.rtf', '.txt', '.md'].includes(ext)) {
    return {
      accent: 'text-[#8A5A44]',
      border: 'border-[#B89D91]',
      bg: 'bg-[#F7F0EC]',
      label: 'DOCUMENT FILE',
    };
  }

  if (['.zip', '.rar', '.7z', '.tar', '.gz'].includes(ext)) {
    return {
      accent: 'text-[#586B8A]',
      border: 'border-[#9CAAC0]',
      bg: 'bg-[#EEF2F7]',
      label: 'ARCHIVE FILE',
    };
  }

  if (['.mp3', '.wav', '.flac', '.aac', '.m4a'].includes(ext)) {
    return {
      accent: 'text-[#6D5A8A]',
      border: 'border-[#AEA1C1]',
      bg: 'bg-[#F2EFF7]',
      label: 'AUDIO FILE',
    };
  }

  if (['.mp4', '.mov', '.avi', '.mkv', '.webm'].includes(ext)) {
    return {
      accent: 'text-[#476E66]',
      border: 'border-[#94B3AC]',
      bg: 'bg-[#ECF5F3]',
      label: 'VIDEO FILE',
    };
  }

  return {
    accent: 'text-[#666]',
    border: 'border-[#B9B9B9]',
    bg: 'bg-[#F3F3F3]',
    label: 'FILE',
  };
};

const mapFolderApiEntry = (folder: FolderApiEntry): FolderEntry => ({
  path: folder.path || folder.name || '',
  name: folder.name || basename(folder.path || ''),
  title: folder.title || '',
  description: folder.description || '',
  thumbnailPath: folder.thumbnailPath ?? null,
  thumbnailKind: folder.thumbnailKind ?? (folder.thumbnailPath ? getMediaKind(folder.thumbnailPath) : null),
  thumbnailExt: folder.thumbnailExt || (folder.thumbnailPath ? extensionOf(folder.thumbnailPath) : ''),
  imageThumbnailPath: folder.imageThumbnailPath ?? null,
  imageThumbnailKind: folder.imageThumbnailKind ?? (folder.imageThumbnailPath ? getMediaKind(folder.imageThumbnailPath) : null),
  imageThumbnailExt: folder.imageThumbnailExt || (folder.imageThumbnailPath ? extensionOf(folder.imageThumbnailPath) : ''),
  secondaryThumbnailPath: folder.secondaryThumbnailPath ?? null,
  secondaryThumbnailKind: folder.secondaryThumbnailKind ?? (folder.secondaryThumbnailPath ? getMediaKind(folder.secondaryThumbnailPath) : null),
  secondaryThumbnailExt: folder.secondaryThumbnailExt || (folder.secondaryThumbnailPath ? extensionOf(folder.secondaryThumbnailPath) : ''),
  cover1Path: folder.cover1Path ?? null,
  cover2Path: folder.cover2Path ?? null,
  itemCount: folder.itemCount ?? 0,
  fileCount: folder.fileCount ?? folder.itemCount ?? 0,
  folderCount: folder.folderCount ?? 0,
  hasCoverOverride: folder.hasCoverOverride ?? false,
  visibleToUsers: folder.visibleToUsers ?? true,
  visibleToAdmins: folder.visibleToAdmins ?? true,
});

const APIBASE = 'https://api.jeffersonwm.com';
const IMAGE_PATH = `${APIBASE}/images`;
const MEDIA_PATH = `${APIBASE}/media`;
const THUMB_PATH = `${APIBASE}/thumbs`;
const API_PATH = `${APIBASE}/api`;

const encodeAssetPath = (assetPath: string) =>
  assetPath
    .split('/')
    .map(segment => encodeURIComponent(segment))
    .join('/');

const buildImageUrl = (assetPath: string, cacheBust?: number) =>
  `${IMAGE_PATH}/${encodeAssetPath(assetPath)}${cacheBust ? `?r=${cacheBust}` : ''}`;

const buildMediaUrl = (assetPath: string, cacheBust?: number) =>
  `${MEDIA_PATH}/${encodeAssetPath(assetPath)}${cacheBust ? `?r=${cacheBust}` : ''}`;

const buildThumbUrl = (assetPath: string, height: number, width = height * 2, cacheBust?: number) => {
  const params = new URLSearchParams({
    w: String(Math.max(64, Math.round(width))),
    h: String(Math.max(64, Math.round(height))),
  });
  if (cacheBust) {
    params.append('r', String(cacheBust));
  }
  return `${THUMB_PATH}/${encodeAssetPath(assetPath)}?${params.toString()}`;
};

const resetImageFallback = (container: Element | null) => {
  const img = container?.querySelector<HTMLImageElement>('img');
  const fallback = container?.querySelector<HTMLElement>('[data-image-fallback]');
  img?.classList.remove('hidden');
  if (img) {
    img.dataset.errorMode = 'thumb';
  }
  fallback?.classList.add('hidden');
  fallback?.classList.remove('flex');
};

const handleImageLoad = (event: React.SyntheticEvent<HTMLImageElement>) => {
  const img = event.currentTarget;
  img.classList.remove('hidden');
  const fallback = img.parentElement?.querySelector<HTMLElement>('[data-image-fallback]');
  fallback?.classList.add('hidden');
  fallback?.classList.remove('flex');
};

const showImageFallback = (img: HTMLImageElement) => {
  img.classList.add('hidden');
  const fallback = img.parentElement?.querySelector<HTMLElement>('[data-image-fallback]');
  fallback?.classList.remove('hidden');
  fallback?.classList.add('flex');
};

const handleThumbImageError = (
  event: React.SyntheticEvent<HTMLImageElement>,
  retryUrl: string,
) => {
  const img = event.currentTarget;
  const attempt = img.dataset.errorMode || 'thumb';

  if (attempt === 'thumb') {
    img.dataset.errorMode = 'original';
    img.src = retryUrl;
    return;
  }

  img.dataset.errorMode = 'failed';
  showImageFallback(img);
};

const formatBytes = (bytes: number, decimals = 2) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
};

const isLikelyShareCode = (value: string) => /^[a-z0-9]{4}$/i.test(value) && value.toLowerCase() !== 'home';

const getShareIdFromLocation = () => {
  const params = new URLSearchParams(window.location.search);
  const queryShareId = params.get('share');
  if (queryShareId) {
    return queryShareId;
  }

  const segments = window.location.pathname.split('/').filter(Boolean);
  const perihelionIndex = segments.indexOf('perihelion');
  if (perihelionIndex >= 0) {
    const candidate = segments[perihelionIndex + 1] || '';
    return isLikelyShareCode(candidate) ? candidate : '';
  }

  return '';
};

const getPerihelionRootUrl = () => {
  const origin = window.location.origin;
  const segments = window.location.pathname.split('/').filter(Boolean);
  const perihelionIndex = segments.indexOf('perihelion');
  const basePath = perihelionIndex >= 0 ? `/${segments.slice(0, perihelionIndex + 1).join('/')}/` : '/';
  return `${origin}${basePath}`;
};

const getPerihelionBasePath = () => {
  const rootUrl = new URL(getPerihelionRootUrl());
  return rootUrl.pathname;
};

const getPerihelionAppUrl = () => `${getPerihelionRootUrl()}home`;

const getPerihelionAppPath = () => {
  const appUrl = new URL(getPerihelionAppUrl());
  return appUrl.pathname;
};

const buildSharePageUrl = (shareId: string) => {
  const appUrl = new URL(getPerihelionAppUrl());
  appUrl.searchParams.set('share', shareId);
  return appUrl.toString();
};

type GalleryMode = 'gallery' | 'selected' | 'staging';

interface GalleryLocationState {
  path: string;
  page: number;
  rowHeight: number;
  limit: number;
  includeOtherFiles: boolean;
  showFolderThumbnails: boolean;
  selectedTag: string;
  selectedList: string;
  searchQuery: string;
  selectedImage: string | null;
  mode: GalleryMode;
  selectionId: string | null;
}

interface SelectionDraft {
  id: string;
  createdAt: string;
  items: MediaEntry[];
}

const SELECTION_STORAGE_PREFIX = 'peri_selection_';

const parsePositiveInt = (value: string | null, fallback: number) => {
  if (!value) return fallback;
  const parsed = parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const createSelectionDraftId = () => Math.random().toString(36).slice(2, 6);

const getSelectionDraftKey = (id: string) => `${SELECTION_STORAGE_PREFIX}${id}`;

const loadSelectionDraft = (id: string): SelectionDraft | null => {
  try {
    const raw = window.sessionStorage.getItem(getSelectionDraftKey(id));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SelectionDraft;
    if (!parsed || !Array.isArray(parsed.items)) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
};

const saveSelectionDraft = (draft: SelectionDraft) => {
  try {
    window.sessionStorage.setItem(getSelectionDraftKey(draft.id), JSON.stringify(draft));
  } catch {
    // Keep the app working even if session storage is unavailable.
  }
};

const deleteSelectionDraft = (id: string) => {
  try {
    window.sessionStorage.removeItem(getSelectionDraftKey(id));
  } catch {
    // Ignore storage cleanup failures.
  }
};

const parseGalleryLocationState = (): GalleryLocationState => {
  const params = new URLSearchParams(window.location.search);
  const path = params.get('path') || '';
  const searchQuery = params.get('search') || '';
  const selectedTag = searchQuery ? '' : (params.get('tag') || '');
  const selectedList = searchQuery || selectedTag ? '' : (params.get('list') || '');
  const modeParam = params.get('mode');
  const mode: GalleryMode = modeParam === 'selected' || modeParam === 'staging' ? modeParam : 'gallery';
  const selectionId = params.get('selection');

  let rowHeight = 250;
  const heightParam = params.get('height');
  const colsParam = params.get('columns');

  if (heightParam) {
    rowHeight = parsePositiveInt(heightParam, 250);
  } else if (colsParam) {
    const columns = parsePositiveInt(colsParam, 4);
    if (columns <= 2) rowHeight = 400;
    else if (columns === 3) rowHeight = 300;
    else rowHeight = 250;
  }

  return {
    path,
    page: parsePositiveInt(params.get('page'), 1),
    rowHeight,
    limit: parsePositiveInt(params.get('limit'), 25),
    includeOtherFiles: params.get('includeOther') === '1' || params.get('includeOther') === 'true',
    showFolderThumbnails: !(params.get('folderThumbs') === '0' || params.get('folderThumbs') === 'false'),
    selectedTag,
    selectedList,
    searchQuery,
    selectedImage: params.get('item') || null,
    mode,
    selectionId,
  };
};

const buildGalleryStateUrl = (state: GalleryLocationState) => {
  const params = new URLSearchParams();

  if (state.path) params.set('path', state.path);
  if (state.page > 1) params.set('page', String(state.page));
  if (state.rowHeight !== 250) params.set('height', String(state.rowHeight));
  if (state.limit !== 25) params.set('limit', String(state.limit));
  if (state.includeOtherFiles) params.set('includeOther', '1');
  if (!state.showFolderThumbnails) params.set('folderThumbs', '0');
  if (state.selectedTag) params.set('tag', state.selectedTag);
  if (state.selectedList) params.set('list', state.selectedList);
  if (state.searchQuery.trim()) params.set('search', state.searchQuery.trim());
  if (state.selectedImage) params.set('item', state.selectedImage);
  if (state.selectionId) params.set('selection', state.selectionId);
  if (state.mode !== 'gallery') params.set('mode', state.mode);

  const query = params.toString();
  return `${getPerihelionAppPath()}${query ? `?${query}` : ''}`;
};

const LAST_FOLDER_PATH_STORAGE_KEY = 'peri_last_folder_path';
const MAX_MODE_ROW_HEIGHT = 84;
const MAX_MODE_LIMIT = 100;
const ROW_HEIGHT_OPTIONS = [100, 150, 200, 250, 300, 400];
const LIMIT_OPTIONS = [10, 25, 40, 50, 100];

const loadLastFolderPath = () => {
  try {
    return window.sessionStorage.getItem(LAST_FOLDER_PATH_STORAGE_KEY) || '';
  } catch {
    return '';
  }
};

const saveLastFolderPath = (path: string) => {
  try {
    window.sessionStorage.setItem(LAST_FOLDER_PATH_STORAGE_KEY, path);
  } catch {
    // Ignore storage failures so browsing still works.
  }
};

const toMediaEntry = (value: string): MediaEntry => ({
  path: value,
  name: basename(value),
  folderPath: dirname(value),
  kind: getMediaKind(value),
  ext: extensionOf(value),
});

interface ImageDetailExif {
  type: string;
  format: string;
  size: number;
  width: number | null;
  height: number | null;
  mode: string | null;
  frames: number | null;
  orientation: number | null;
  cameraMake: string | null;
  cameraModel: string | null;
  capturedAt: string | null;
}

interface ImageDetail {
  title: string;
  description: string;
  ai_description: string;
  tags: string[];
  exif: ImageDetailExif;
}

type PeriSourceMode = 'server' | 'local';

type LocalObjectUrlMap = Record<string, string>;

type LocalDirectoryPickerHandle = {
  kind: 'directory' | 'file';
  name: string;
  values?: () => AsyncIterable<LocalDirectoryPickerHandle>;
  getFile?: () => Promise<File>;
};

type DirectoryInputElement = HTMLInputElement & {
  webkitdirectory?: boolean;
  directory?: boolean;
};

const normalizeRelativePath = (value: string) =>
  value
    .replace(/\\/g, '/')
    .replace(/^\/+/, '')
    .replace(/\/+$/, '');

const getImmediateChildFolderPath = (entryPath: string, parentPath: string) => {
  const normalizedEntryPath = normalizeRelativePath(entryPath);
  const normalizedParentPath = normalizeRelativePath(parentPath);
  const relative = normalizedParentPath
    ? normalizedEntryPath.startsWith(`${normalizedParentPath}/`)
      ? normalizedEntryPath.slice(normalizedParentPath.length + 1)
      : ''
    : normalizedEntryPath;

  if (!relative || !relative.includes('/')) {
    return null;
  }

  const firstSegment = relative.split('/')[0];
  return normalizedParentPath ? `${normalizedParentPath}/${firstSegment}` : firstSegment;
};

const buildLocalFolderEntries = (allEntries: MediaEntry[], parentPath: string): FolderEntry[] => {
  const normalizedParentPath = normalizeRelativePath(parentPath);
  const folderMap = new Map<string, FolderEntry>();
  const folderDescendantSets = new Map<string, Set<string>>();

  allEntries.forEach(entry => {
    const childFolderPath = getImmediateChildFolderPath(entry.path, normalizedParentPath);
    if (!childFolderPath) {
      return;
    }

    const childName = basename(childFolderPath);
    if (!folderMap.has(childFolderPath)) {
      folderMap.set(childFolderPath, {
        path: childFolderPath,
        name: childName,
        title: '',
        description: '',
        thumbnailPath: null,
        thumbnailKind: null,
        thumbnailExt: '',
        imageThumbnailPath: null,
        imageThumbnailKind: null,
        imageThumbnailExt: '',
        secondaryThumbnailPath: null,
        secondaryThumbnailKind: null,
        secondaryThumbnailExt: '',
        cover1Path: null,
        cover2Path: null,
        itemCount: 0,
        fileCount: 0,
        folderCount: 0,
        hasCoverOverride: false,
        visibleToUsers: true,
        visibleToAdmins: true,
      });
      folderDescendantSets.set(childFolderPath, new Set<string>());
    }

    const folder = folderMap.get(childFolderPath)!;
    folder.itemCount += 1;
    folder.fileCount += 1;

    const descendantRelative = entry.path.slice(childFolderPath.length + 1);
    if (descendantRelative.includes('/')) {
      folderDescendantSets.get(childFolderPath)?.add(descendantRelative.split('/')[0]);
    }

    if (!folder.thumbnailPath && entry.kind === 'image' && isRenderable(entry.path)) {
      folder.thumbnailPath = entry.path;
      folder.thumbnailKind = entry.kind;
      folder.thumbnailExt = entry.ext;
      folder.imageThumbnailPath = entry.path;
      folder.imageThumbnailKind = entry.kind;
      folder.imageThumbnailExt = entry.ext;
      folder.cover1Path = entry.path;
      return;
    }

    if (!folder.secondaryThumbnailPath && entry.kind === 'image' && isRenderable(entry.path) && entry.path !== folder.thumbnailPath) {
      folder.secondaryThumbnailPath = entry.path;
      folder.secondaryThumbnailKind = entry.kind;
      folder.secondaryThumbnailExt = entry.ext;
      folder.cover2Path = entry.path;
      return;
    }

    if (!folder.thumbnailPath) {
      folder.thumbnailPath = entry.path;
      folder.thumbnailKind = entry.kind;
      folder.thumbnailExt = entry.ext;
      folder.cover1Path = entry.path;
      return;
    }

    if (!folder.secondaryThumbnailPath && entry.path !== folder.thumbnailPath) {
      folder.secondaryThumbnailPath = entry.path;
      folder.secondaryThumbnailKind = entry.kind;
      folder.secondaryThumbnailExt = entry.ext;
      folder.cover2Path = entry.path;
    }
  });

  return Array.from(folderMap.values())
    .map(folder => ({
      ...folder,
      folderCount: folderDescendantSets.get(folder.path)?.size || 0,
    }))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
};

export default function App() {
  const localFolderInputRef = useRef<DirectoryInputElement | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [entries, setEntries] = useState<MediaEntry[]>([]);
  const [folders, setFolders] = useState<FolderEntry[]>([]);
  const [siblingFolders, setSiblingFolders] = useState<FolderEntry[]>([]);
  const [currentPath, setCurrentPath] = useState<string>('');
  const [folderCoverPaths, setFolderCoverPaths] = useState<{ cover1Path: string | null; cover2Path: string | null }>({
    cover1Path: null,
    cover2Path: null,
  });
  const [folderTitleInput, setFolderTitleInput] = useState('');
  const [folderDescriptionInput, setFolderDescriptionInput] = useState('');
  const [folderQuickEditPath, setFolderQuickEditPath] = useState('');
  const [folderQuickEditTitle, setFolderQuickEditTitle] = useState('');
  const [folderQuickEditDescription, setFolderQuickEditDescription] = useState('');
  const [folderQuickVisibleToUsers, setFolderQuickVisibleToUsers] = useState(true);
  const [folderQuickVisibleToAdmins, setFolderQuickVisibleToAdmins] = useState(true);
  const [folderQuickApprovedUsers, setFolderQuickApprovedUsers] = useState<AuthUser[]>([]);
  const [folderQuickAccountAccess, setFolderQuickAccountAccess] = useState<FolderAccountAccess>({});
  const [folderQuickParentAccess, setFolderQuickParentAccess] = useState<FolderParentAccess>({
    visibleToUsers: true,
    visibleToAdmins: true,
    accounts: {},
  });
  const [folderQuickEditStatus, setFolderQuickEditStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [setCoverStatus, setSetCoverStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [allTags, setAllTags] = useState<string[]>([]);
  const [selectedTag, setSelectedTag] = useState<string>('');
  const [selectedList, setSelectedList] = useState<string>('');
  const [shareCodeInput, setShareCodeInput] = useState('');
  const [shareCodeError, setShareCodeError] = useState('');
  const [shareCodeNotice, setShareCodeNotice] = useState('');
  const [isValidatingCode, setIsValidatingCode] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copiedImageLink, setCopiedImageLink] = useState(false);
  const [showSelectedOnly, setShowSelectedOnly] = useState(false);
  const [selectedMetadata, setSelectedMetadata] = useState<Record<string, MediaEntry>>({});
  const [imageDetail, setImageDetail] = useState<ImageDetail | null>(null);
  const [imageDetailState, setImageDetailState] = useState<'idle' | 'loading' | 'ready' | 'unavailable'>('idle');
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [allShares, setAllShares] = useState<{ id: string; title: string; images: string[]; itemCount: number; created_at: string }[]>([]);
  const [showTagsPopover, setShowTagsPopover] = useState(false);
  const [showListsPopover, setShowListsPopover] = useState(false);
  const [tagCounts, setTagCounts] = useState<Record<string, number>>({});
  const [manageTab, setManageTab] = useState<'tags' | 'lists'>('tags');
  const [tagSearch, setTagSearch] = useState('');
  const [listSearch, setListSearch] = useState('');
  const [activeTagIndex, setActiveTagIndex] = useState(0);
  const [activeListIndex, setActiveListIndex] = useState(0);
  const [activeTagInputIndex, setActiveTagInputIndex] = useState(0);
  const [renamingTag, setRenamingTag] = useState<string | null>(null);
  const [renamingTagValue, setRenamingTagValue] = useState('');
  const tagsRef = React.useRef<HTMLDivElement>(null);
  const listsRef = React.useRef<HTMLDivElement>(null);
  const rowHeightRef = React.useRef<HTMLDivElement>(null);
  const limitRef = React.useRef<HTMLDivElement>(null);
  const [editTags, setEditTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [showEditBox, setShowEditBox] = useState(false);
  const [page, setPage] = useState(1);
  const [serverTotalPages, setServerTotalPages] = useState(1);
  const [serverTotalItems, setServerTotalItems] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingOverlayVisible, setLoadingOverlayVisible] = useState(true);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [imageMeta, setImageMeta] = useState<{ type: string; size: number; width: number; height: number } | null>(null);
  const [imageMetaState, setImageMetaState] = useState<'idle' | 'loading' | 'ready' | 'unavailable'>('idle');
  const [accessError, setAccessError] = useState('');

  const [isSharedView, setIsSharedView] = useState(false);
  const [sharedImages, setSharedImages] = useState<string[] | null>(null);
  const [sharedFiles, setSharedFiles] = useState<{ path: string; is_large?: boolean; size?: number }[] | null>(null);
  const [forceFullImage, setForceFullImage] = useState<Record<string, boolean>>({});
  const [sharedTitle, setSharedTitle] = useState<string>('');
  const [sharedDescription, setSharedDescription] = useState<string>('');
  const [sharedError, setSharedError] = useState('');
  const [previewRetryTokens, setPreviewRetryTokens] = useState<Record<string, number>>({});
  const [sourceMode, setSourceMode] = useState<PeriSourceMode>('server');
  const [localLibraryEntries, setLocalLibraryEntries] = useState<MediaEntry[]>([]);
  const [localObjectUrls, setLocalObjectUrls] = useState<LocalObjectUrlMap>({});
  const [localFolderLabel, setLocalFolderLabel] = useState('');

  const [rowHeight, setRowHeight] = useState(250);
  const [limit, setLimit] = useState(25);
  const isMaxMode = rowHeight === MAX_MODE_ROW_HEIGHT && limit === MAX_MODE_LIMIT;
  const [includeOtherFiles, setIncludeOtherFiles] = useState(false);
  const [showFolderThumbnails, setShowFolderThumbnails] = useState(true);
  const [locationReady, setLocationReady] = useState(false);
  const [selectionDraftId, setSelectionDraftId] = useState<string | null>(null);
  const [locationNotice, setLocationNotice] = useState('');

  const [selectedImages, setSelectedImages] = useState<Set<string>>(new Set());
  const [isDownloading, setIsDownloading] = useState(false);
  const [view, setView] = useState<'gallery' | 'staging'>('gallery');
  const [authStatus, setAuthStatus] = useState<AuthStatus | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [adminLoading, setAdminLoading] = useState(false);
  const [historyEntries, setHistoryEntries] = useState<DownloadHistoryEntry[]>([]);
  const [adminUsers, setAdminUsers] = useState<AuthUser[]>([]);
  const [accountPanel, setAccountPanel] = useState<AccountPanel>(null);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [authMessage, setAuthMessage] = useState('');
  const [authError, setAuthError] = useState('');
  const [usernameInput, setUsernameInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [confirmPasswordInput, setConfirmPasswordInput] = useState('');
  const [requestNoteInput, setRequestNoteInput] = useState('');
  const [currentUsernamePasswordInput, setCurrentUsernamePasswordInput] = useState('');
  const [newUsernameInput, setNewUsernameInput] = useState('');
  const [currentPasswordInput, setCurrentPasswordInput] = useState('');
  const [newPasswordInput, setNewPasswordInput] = useState('');
  const [confirmNewPasswordInput, setConfirmNewPasswordInput] = useState('');
  const [showRowHeightMenu, setShowRowHeightMenu] = useState(false);
  const [showLimitMenu, setShowLimitMenu] = useState(false);
  const historyModeRef = React.useRef<'replace' | 'push'>('replace');
  const locationHydratedRef = React.useRef(false);
  const lastFolderPathRef = React.useRef<string>(loadLastFolderPath());
  const prewarmedPageKeysRef = React.useRef<Set<string>>(new Set());
  const prewarmImagesRef = React.useRef<HTMLImageElement[]>([]);
  const isGlobalSearch = debouncedSearch.trim().length >= 4;
  const canEditServerFolders = sourceMode === 'server' && Boolean(authStatus?.user?.isAdmin);

  const replaceLocalObjectUrls = (nextMap: LocalObjectUrlMap) => {
    Object.values(localObjectUrls).forEach(url => URL.revokeObjectURL(url));
    setLocalObjectUrls(nextMap);
  };

  const resetToServerLibrary = () => {
    replaceLocalObjectUrls({});
    setSourceMode('server');
    setLocalLibraryEntries([]);
    setLocalFolderLabel('');
    setAccessError('');
    setCurrentPath('');
    setSelectedImage(null);
    setSearchQuery('');
    setDebouncedSearch('');
    setSelectedTag('');
    setSelectedList('');
    setSelectionDraftId(null);
    setSelectedImages(new Set());
    setSelectedMetadata({});
    setPage(1);
    setView('gallery');
    setShowSelectedOnly(false);
    setFolderCoverPaths({ cover1Path: null, cover2Path: null });
    void fetchTags();
    void fetchShares();
  };

  const syncLocalLibrary = (nextEntries: MediaEntry[], nextObjectUrls: LocalObjectUrlMap, rootLabel: string) => {
    replaceLocalObjectUrls(nextObjectUrls);
    setSourceMode('local');
    setLocalLibraryEntries(nextEntries.sort((a, b) => a.path.localeCompare(b.path, undefined, { sensitivity: 'base' })));
    setLocalFolderLabel(rootLabel);
    setAccessError('');
    setCurrentPath('');
    setSelectedImage(null);
    setSearchQuery('');
    setDebouncedSearch('');
    setSelectedTag('');
    setSelectedList('');
    setSelectionDraftId(null);
    setSelectedImages(new Set());
    setSelectedMetadata({});
    setPage(1);
    setView('gallery');
    setShowSelectedOnly(false);
    setFolderCoverPaths({ cover1Path: null, cover2Path: null });
    setAllTags([]);
    setAllShares([]);
  };

  const loadLocalFolderFromFiles = async (files: File[], rootLabel: string) => {
    if (!files.length) {
      return;
    }

    setLoading(true);
    try {
      const nextObjectUrls: LocalObjectUrlMap = {};
      const nextEntries: MediaEntry[] = files.map(file => {
        const relativePath = normalizeRelativePath(((file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name));
        const normalizedPath = relativePath || file.name;
        nextObjectUrls[normalizedPath] = URL.createObjectURL(file);
        return {
          path: normalizedPath,
          name: basename(normalizedPath),
          folderPath: dirname(normalizedPath),
          kind: getMediaKind(normalizedPath),
          ext: extensionOf(normalizedPath),
          title: '',
          description: '',
          tags: [],
          is_large: false,
          size: file.size || 0,
        };
      });

      syncLocalLibrary(nextEntries, nextObjectUrls, rootLabel);
    } finally {
      setLoading(false);
    }
  };

  const loadLocalFolderFromPicker = async (directoryHandle: LocalDirectoryPickerHandle) => {
    if (!directoryHandle.values) {
      return;
    }

    setLoading(true);
    try {
      const nextEntries: MediaEntry[] = [];
      const nextObjectUrls: LocalObjectUrlMap = {};

      const walkDirectory = async (handle: LocalDirectoryPickerHandle, prefix = ''): Promise<void> => {
        if (!handle.values) {
          return;
        }

        for await (const child of handle.values()) {
          if (child.kind === 'directory') {
            await walkDirectory(child, prefix ? `${prefix}/${child.name}` : child.name);
            continue;
          }

          if (child.kind === 'file' && child.getFile) {
            const file = await child.getFile();
            const relativePath = normalizeRelativePath(prefix ? `${prefix}/${child.name}` : child.name);
            nextObjectUrls[relativePath] = URL.createObjectURL(file);
            nextEntries.push({
              path: relativePath,
              name: basename(relativePath),
              folderPath: dirname(relativePath),
              kind: getMediaKind(relativePath),
              ext: extensionOf(relativePath),
              title: '',
              description: '',
              tags: [],
              is_large: false,
              size: file.size || 0,
            });
          }
        }
      };

      await walkDirectory(directoryHandle);
      syncLocalLibrary(nextEntries, nextObjectUrls, directoryHandle.name || 'Local Folder');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenLocalFolder = async () => {
    try {
      const picker = (window as Window & {
        showDirectoryPicker?: () => Promise<LocalDirectoryPickerHandle>;
      }).showDirectoryPicker;

      if (picker) {
        const directoryHandle = await picker();
        await loadLocalFolderFromPicker(directoryHandle);
        return;
      }

      localFolderInputRef.current?.click();
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        return;
      }
      console.error('Failed to open local folder', error);
    }
  };

  const handleLocalFolderInputChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    const firstRelativePath = (files[0] as File & { webkitRelativePath?: string } | undefined)?.webkitRelativePath || '';
    const rootLabel = firstRelativePath ? firstRelativePath.split('/')[0] : 'Local Folder';
    await loadLocalFolderFromFiles(files, rootLabel);
    event.target.value = '';
  };

  const getResolvedImageUrl = (assetPath: string, cacheBust?: number) => {
    if (sourceMode === 'local') {
      return localObjectUrls[assetPath] || '';
    }
    return buildImageUrl(assetPath, cacheBust);
  };

  const getResolvedMediaUrl = (assetPath: string, cacheBust?: number) => {
    if (sourceMode === 'local') {
      return localObjectUrls[assetPath] || '';
    }
    return buildMediaUrl(assetPath, cacheBust);
  };

  const getResolvedThumbUrl = (assetPath: string, height: number, width = height * 2, cacheBust?: number) => {
    if (sourceMode === 'local') {
      return localObjectUrls[assetPath] || '';
    }
    return buildThumbUrl(assetPath, height, width, cacheBust);
  };

  const queueHistoryUpdate = (mode: 'replace' | 'push' = 'push') => {
    historyModeRef.current = mode;
  };

  const submitSearch = () => {
    const nextSearch = searchQuery.trim();
    if (nextSearch.length < 4) {
      return;
    }
    queueHistoryUpdate('push');
    lastFolderPathRef.current = currentPath;
    saveLastFolderPath(currentPath);
    setSelectedTag('');
    setSelectedList('');
    setCurrentPath('');
    setPage(1);
    setDebouncedSearch(nextSearch);
  };

  useEffect(() => {
    if (selectedImages.size === 0) {
      setShowSelectedOnly(false);
    }
  }, [selectedImages.size]);

  useEffect(() => {
    if (isSharedView || !locationReady) {
      return;
    }

    if (selectionDraftId) {
      if (selectedImages.size === 0) {
        deleteSelectionDraft(selectionDraftId);
        setSelectionDraftId(null);
        if (showSelectedOnly || view === 'staging') {
          leaveSelectionModes('replace');
        }
        return;
      }

      persistSelectionDraft(selectionDraftId, selectedImages);
    }
  }, [isSharedView, locationReady, selectionDraftId, selectedImages, selectedMetadata, entries, showSelectedOnly, view]);

  const computedStagedEntries = useMemo(() => {
    return Array.from(selectedImages).map(path => {
      return selectedMetadata[path] || {
        path,
        name: basename(path),
        kind: getMediaKind(path),
        ext: extensionOf(path),
        title: '',
        description: '',
        tags: [],
        is_large: false,
        size: 0,
      };
    });
  }, [selectedImages, selectedMetadata]);

  const visibleEntries = useMemo(() => {
    const list = showSelectedOnly ? computedStagedEntries : entries;
    return list.filter(entry => includeOtherFiles || entry.kind === 'image');
  }, [showSelectedOnly, computedStagedEntries, entries, includeOtherFiles]);

  const displayFolders = showSelectedOnly || Boolean(selectedTag) || isGlobalSearch ? [] : folders;
  const siblingFolderIndex = useMemo(
    () => siblingFolders.findIndex(folder => folder.path === currentPath),
    [siblingFolders, currentPath],
  );
  const previousSiblingFolder = siblingFolderIndex > 0 ? siblingFolders[siblingFolderIndex - 1] : null;
  const nextSiblingFolder = siblingFolderIndex >= 0 && siblingFolderIndex < siblingFolders.length - 1
    ? siblingFolders[siblingFolderIndex + 1]
    : null;

  const computedTotalPages = showSelectedOnly
    ? Math.max(1, Math.ceil(visibleEntries.length / limit || 1))
    : Math.max(1, serverTotalPages);
  const showInitialLoading = loading && visibleEntries.length === 0 && folders.length === 0 && !accessError;
  const startIndex = showSelectedOnly ? (page - 1) * limit : 0;
  const endIndex = showSelectedOnly ? startIndex + limit : visibleEntries.length;
  const pagedEntries = showSelectedOnly ? visibleEntries.slice(startIndex, endIndex) : visibleEntries;
  const stagedImages = Array.from(selectedImages) as string[];

  const isLargeMap = useMemo(() => {
    const map: Record<string, boolean> = {};
    entries.forEach(e => {
      if (e.is_large) map[e.path] = true;
    });
    return map;
  }, [entries]);

  const sharedNonRenderable = (sharedImages || []).filter(item => !isRenderable(item));
  const sharedRenderable = (sharedImages || []).filter(item => isRenderable(item));
  const folderThumbnailHeight = Math.max(120, Math.min(220, rowHeight - 30));
  const filteredTagOptions = useMemo(
    () => allTags.filter(t => t.includes(tagSearch.trim().toLowerCase())),
    [allTags, tagSearch],
  );
  const filteredListOptions = useMemo(
    () => allShares.filter(s => s.title.toLowerCase().includes(listSearch.trim().toLowerCase())),
    [allShares, listSearch],
  );
  const filteredEditTagOptions = useMemo(
    () => allTags.filter(t => t.includes(tagInput.trim().toLowerCase()) && !editTags.includes(t)),
    [allTags, tagInput, editTags],
  );
  const createTagCandidate = tagSearch.trim().toLowerCase();
  const createListCandidate = listSearch.trim().toLowerCase();
  const createEditTagCandidate = tagInput.trim().toLowerCase();
  const canCreateTagCandidate = Boolean(createTagCandidate) && !allTags.includes(createTagCandidate);
  const canCreateListCandidate = Boolean(createListCandidate) && !allShares.some(s => s.title.toLowerCase() === createListCandidate);
  const canCreateEditTagCandidate = Boolean(createEditTagCandidate) && !editTags.includes(createEditTagCandidate);

  const sharedRenderableFiles = useMemo(() => {
    if (sharedFiles) {
      return sharedFiles.filter(f => isRenderable(f.path));
    }
    return (sharedImages || []).filter(item => isRenderable(item)).map(path => ({ path, is_large: false, size: 0 }));
  }, [sharedFiles, sharedImages]);

  const sharedNonRenderableFiles = useMemo(() => {
    if (sharedFiles) {
      return sharedFiles.filter(f => !isRenderable(f.path));
    }
    return (sharedImages || []).filter(item => !isRenderable(item)).map(path => ({ path, is_large: false, size: 0 }));
  }, [sharedFiles, sharedImages]);

  const navigateToPath = (path: string) => {
    queueHistoryUpdate('push');
    lastFolderPathRef.current = path;
    saveLastFolderPath(path);
    setCurrentPath(path);
    setSearchQuery('');
    setDebouncedSearch('');
    setPage(1);
  };

  const returnToLastFolderLocation = () => {
    const targetPath = lastFolderPathRef.current || '';
    queueHistoryUpdate('push');
    setSearchQuery('');
    setDebouncedSearch('');
    setSelectedTag('');
    setSelectedList('');
    setPage(1);
    setCurrentPath(targetPath);
  };

  const openLightbox = (path: string) => {
    queueHistoryUpdate('push');
    setSelectedImage(path);
  };

  const closeLightbox = () => {
    if (!selectedImage) return;
    queueHistoryUpdate('push');
    setSelectedImage(null);
  };

  const saveFolderCoverSlot = async (slot: 1 | 2, imagePath: string | null) => {
    if (sourceMode !== 'server' || !currentPath) return;
    setSetCoverStatus('saving');
    try {
      const res = await fetch(`${API_PATH}/folder-cover`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folderPath: currentPath, imagePath, slot }),
      });
      if (!res.ok) {
        setSetCoverStatus('idle');
        return;
      }

      const data = await fetch(`${API_PATH}/folder-cover?path=${encodeURIComponent(currentPath)}`, {
        credentials: 'include',
      })
        .then(r => (r.ok ? r.json() : null))
        .catch(() => null);

      setFolderCoverPaths({
        cover1Path: data?.cover1ImagePath ?? null,
        cover2Path: data?.cover2ImagePath ?? null,
      });
      setSetCoverStatus('saved');
      await fetchImages(page, limit, currentPath, selectedTag, selectedList, debouncedSearch);
      setTimeout(() => setSetCoverStatus('idle'), 2000);
    } catch {
      setSetCoverStatus('idle');
    }
  };

  const saveFolderDetailsFor = async (
    folderPath: string,
    title: string,
    description: string,
    visibleToUsers?: boolean,
    visibleToAdmins?: boolean,
    accountAccess?: FolderAccountAccess,
  ) => {
    if (sourceMode !== 'server' || !folderPath) return false;
    try {
      const res = await fetch(`${API_PATH}/folder-cover`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          folderPath,
          title,
          description,
          visibleToUsers,
          visibleToAdmins,
          accountAccess,
        }),
      });
      if (!res.ok) {
        return false;
      }
      const data = await res.json().catch(() => null);
      const nextTitle = data?.title ?? '';
      const nextDescription = data?.description ?? '';
      const nextVisibleToUsers = data?.visibleToUsers ?? true;
      const nextVisibleToAdmins = data?.visibleToAdmins ?? true;
      setFolderQuickApprovedUsers(data?.approvedUsers || []);
      setFolderQuickAccountAccess(data?.accountAccess || {});
      setFolderQuickParentAccess({
        visibleToUsers: data?.parentAccess?.visibleToUsers ?? true,
        visibleToAdmins: data?.parentAccess?.visibleToAdmins ?? true,
        accounts: data?.parentAccess?.accounts || {},
      });
      if (folderPath === currentPath) {
        setFolderTitleInput(nextTitle);
        setFolderDescriptionInput(nextDescription);
      }
      setFolders(prev => prev.map(folder =>
        folder.path === folderPath
          ? {
              ...folder,
              title: nextTitle,
              description: nextDescription,
              visibleToUsers: nextVisibleToUsers,
              visibleToAdmins: nextVisibleToAdmins,
            }
          : folder
      ));
      return true;
    } catch {
      return false;
    }
  };

  const saveQuickFolderDetails = async () => {
    if (!folderQuickEditPath) return;
    setFolderQuickEditStatus('saving');
    const saved = await saveFolderDetailsFor(
      folderQuickEditPath,
      folderQuickEditTitle,
      folderQuickEditDescription,
      folderQuickVisibleToUsers,
      folderQuickVisibleToAdmins,
      folderQuickAccountAccess,
    );
    setFolderQuickEditStatus(saved ? 'saved' : 'idle');
    if (saved) {
      setTimeout(() => {
        setFolderQuickEditStatus('idle');
        setFolderQuickEditPath('');
      }, 1200);
    }
  };

  const buildSelectionDraftItems = (paths: Iterable<string>) => {
    return Array.from(paths).map(path => {
      const existing = selectedMetadata[path] || entries.find(entry => entry.path === path);
      return existing || {
        path,
        name: basename(path),
        kind: getMediaKind(path),
        ext: extensionOf(path),
        title: '',
        description: '',
        tags: [],
        is_large: false,
        size: 0,
      };
    });
  };

  const persistSelectionDraft = (draftId: string, paths: Iterable<string>) => {
    const items = buildSelectionDraftItems(paths);
    saveSelectionDraft({
      id: draftId,
      createdAt: new Date().toISOString(),
      items,
    });
  };

  const ensureSelectionDraft = () => {
    if (selectedImages.size === 0) {
      return null;
    }
    const draftId = selectionDraftId || createSelectionDraftId();
    persistSelectionDraft(draftId, selectedImages);
    if (!selectionDraftId) {
      setSelectionDraftId(draftId);
    }
    return draftId;
  };

  const enterSelectedMode = () => {
    const draftId = ensureSelectionDraft();
    if (!draftId) return;
    queueHistoryUpdate('push');
    setView('gallery');
    setShowSelectedOnly(true);
  };

  const enterStagingMode = () => {
    const draftId = ensureSelectionDraft();
    if (!draftId) return;
    queueHistoryUpdate('push');
    setShowSelectedOnly(true);
    setView('staging');
  };

  const leaveSelectionModes = (historyMode: 'replace' | 'push' = 'replace') => {
    queueHistoryUpdate(historyMode);
    setView('gallery');
    setShowSelectedOnly(false);
  };

  const clearWorkingSet = (historyMode: 'replace' | 'push' = 'push') => {
    if (selectionDraftId) {
      deleteSelectionDraft(selectionDraftId);
    }
    queueHistoryUpdate(historyMode);
    setSelectionDraftId(null);
    setSelectedImages(new Set());
    setSelectedMetadata({});
    setLocationNotice('');
    setView('gallery');
    setShowSelectedOnly(false);
    setPage(1);
  };

  const totalVisibleItems = showSelectedOnly ? visibleEntries.length : serverTotalItems;
  const selectedFileTone = selectedImage ? getFileTypeTone(selectedImage) : null;

  const resetAuthForm = () => {
    setUsernameInput('');
    setPasswordInput('');
    setConfirmPasswordInput('');
    setRequestNoteInput('');
  };

  const resetPasswordForm = () => {
    setCurrentPasswordInput('');
    setNewPasswordInput('');
    setConfirmNewPasswordInput('');
  };

  const resetUsernameForm = () => {
    setCurrentUsernamePasswordInput('');
    setNewUsernameInput(authStatus?.user?.username || '');
  };

  const loadAuthStatus = async () => {
    setAuthLoading(true);
    try {
      const response = await fetch(`${API_PATH}/auth/status`, {
        credentials: 'include',
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to load account status');
      }
      setAuthStatus(data);
    } catch (error) {
      console.error(error);
      setAuthStatus({
        ok: false,
        user: null,
        requireAuth: false,
        hasUsers: false,
      });
    } finally {
      setAuthLoading(false);
    }
  };

  const loadHistory = async () => {
    setHistoryLoading(true);
    setAuthError('');
    try {
      const response = await fetch(`${API_PATH}/history/downloads`, {
        credentials: 'include',
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to load download history');
      }
      setHistoryEntries(data.history || []);
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : 'Failed to load download history');
    } finally {
      setHistoryLoading(false);
    }
  };

  const loadAdminUsers = async () => {
    setAdminLoading(true);
    setAuthError('');
    try {
      const response = await fetch(`${API_PATH}/admin/users`, {
        credentials: 'include',
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to load users');
      }
      setAdminUsers(data.users || []);
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : 'Failed to load users');
    } finally {
      setAdminLoading(false);
    }
  };

  const fetchTags = async () => {
    try {
      const res = await fetch(`${API_PATH}/tags`, {
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        setAllTags(data.tags || []);
        setTagCounts(data.tagCounts || {});
      }
    } catch (err) {
      console.error('Failed to fetch tags', err);
    }
  };

  const fetchShares = async () => {
    try {
      const res = await fetch(`${API_PATH}/shares`, {
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        setAllShares(sortSharesNewestFirst(data.shares || []));
      }
    } catch (err) {
      console.error('Failed to fetch shares', err);
    }
  };

  const handleSaveDetails = async () => {
    if (!selectedImage) return;
    setSaveStatus('saving');
    try {
      const res = await fetch(`${API_PATH}/image-details/${encodeURIComponent(selectedImage)}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: editTitle,
          description: editDescription,
          tags: editTags,
        }),
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to save');
      setSaveStatus('saved');
      setImageDetail(prev => prev ? { ...prev, title: editTitle, description: editDescription, tags: editTags } : null);
      fetchTags();
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch (err) {
      console.error('Failed to save image details', err);
      setSaveStatus('error');
      setTimeout(() => setSaveStatus('idle'), 3000);
    }
  };

  useEffect(() => {
    loadAuthStatus();
    const handleClickOutside = (event: MouseEvent) => {
      if (tagsRef.current && !tagsRef.current.contains(event.target as Node)) {
        setShowTagsPopover(false);
      }
      if (listsRef.current && !listsRef.current.contains(event.target as Node)) {
        setShowListsPopover(false);
      }
      if (rowHeightRef.current && !rowHeightRef.current.contains(event.target as Node)) {
        setShowRowHeightMenu(false);
      }
      if (limitRef.current && !limitRef.current.contains(event.target as Node)) {
        setShowLimitMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const shareId = getShareIdFromLocation();

    if (shareId) {
      setIsSharedView(true);
      setLocationReady(true);
      const controller = new AbortController();

      fetch(`${API_PATH}/share/${encodeURIComponent(shareId)}`, {
        signal: controller.signal,
        credentials: 'include',
      })
        .then(res => {
          if (!res.ok) throw new Error('Network response was not ok');
          return res.json();
        })
        .then(data => {
          if (data.error) {
            setSharedError(data.error);
          } else {
            setSharedImages(data.images);
            if (data.files) setSharedFiles(data.files);
            if (data.title) setSharedTitle(data.title);
            if (data.description) setSharedDescription(data.description);
          }
        })
        .catch(err => {
          if (err.name !== 'AbortError') setSharedError('Failed to load shared page');
        });

      return () => controller.abort();
    }

    const applyLocationState = () => {
      const nextState = parseGalleryLocationState();
      let nextSelected = new Set<string>();
      let nextMeta: Record<string, MediaEntry> = {};
      let nextNotice = '';

      if (nextState.selectionId) {
        const draft = loadSelectionDraft(nextState.selectionId);
        if (draft && draft.items.length > 0) {
          nextSelected = new Set(draft.items.map(item => item.path));
          nextMeta = draft.items.reduce<Record<string, MediaEntry>>((acc, item) => {
            acc[item.path] = item;
            return acc;
          }, {});
          setSelectionDraftId(nextState.selectionId);
        } else {
          nextNotice = '';
          setSelectionDraftId(null);
        }
      } else {
        setSelectionDraftId(null);
      }

      setCurrentPath(nextState.path);
      setPage(nextState.page);
      setRowHeight(nextState.rowHeight);
      setLimit(nextState.limit);
      setIncludeOtherFiles(nextState.includeOtherFiles);
      setShowFolderThumbnails(nextState.showFolderThumbnails);
      setSelectedTag(nextState.selectedTag);
      setSelectedList(nextState.selectedList);
      setSearchQuery(nextState.searchQuery);
      setDebouncedSearch(nextState.searchQuery);
      setSelectedImage(nextState.selectedImage);
      setSelectedImages(nextSelected);
      setSelectedMetadata(nextMeta);
      setLocationNotice(nextNotice);
      const hasSelection = nextSelected.size > 0;
      setShowSelectedOnly(hasSelection && (nextState.mode === 'selected' || nextState.mode === 'staging'));
      setView(hasSelection && nextState.mode === 'staging' ? 'staging' : 'gallery');
    };

    applyLocationState();
    fetchTags();
    fetchShares();
    setLocationReady(true);
    locationHydratedRef.current = true;

    const handlePopState = () => {
      applyLocationState();
    };

    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, []);

  useEffect(() => {
    if (isSharedView) {
      if (sharedTitle) {
        const truncatedTitle = sharedTitle.length > 48 ? `${sharedTitle.substring(0, 48)}...` : sharedTitle;
        document.title = `Perihelion - ${truncatedTitle}`;
      } else {
        document.title = 'Perihelion - Shared Gallery';
      }
    } else {
      document.title = 'Perihelion';
    }
  }, [isSharedView, sharedTitle]);

  useEffect(() => {
    const input = localFolderInputRef.current;
    if (!input) {
      return;
    }
    input.webkitdirectory = true;
    input.directory = true;
  }, []);

  useEffect(() => {
    return () => {
      Object.values(localObjectUrls).forEach(url => URL.revokeObjectURL(url));
    };
  }, [localObjectUrls]);

  useEffect(() => {
    if (!locationReady || isSharedView) {
      return;
    }

    if (sourceMode === 'local') {
      setLoading(true);
      const nextSearch = debouncedSearch.trim().toLowerCase();
      const selectedLocalShare = selectedList ? allShares.find(share => share.id === selectedList) : null;
      const includePredicate = (entry: MediaEntry) => includeOtherFiles || entry.kind === 'image';
      const filteredEntries = localLibraryEntries.filter(entry => {
        if (!includePredicate(entry)) {
          return false;
        }

        if (selectedTag && !(entry.tags || []).includes(selectedTag)) {
          return false;
        }

        if (selectedLocalShare && !selectedLocalShare.images.includes(entry.path)) {
          return false;
        }

        if (isGlobalSearch && nextSearch) {
          const searchable = [entry.path, entry.name, entry.folderPath || ''].join(' ').toLowerCase();
          return searchable.includes(nextSearch);
        }

        return currentPath ? entry.folderPath === currentPath : entry.folderPath === 'root';
      });

      const nextTotalItems = filteredEntries.length;
      const nextTotalPages = Math.max(1, Math.ceil(nextTotalItems / Math.max(1, limit)));
      const safePage = Math.min(page, nextTotalPages);
      const startIndex = (safePage - 1) * limit;
      const nextPageEntries = filteredEntries.slice(startIndex, startIndex + limit);
      const nextFolders = isGlobalSearch ? [] : buildLocalFolderEntries(localLibraryEntries, currentPath);

      setEntries(nextPageEntries);
      setFolders(nextFolders);
      setServerTotalPages(nextTotalPages);
      setServerTotalItems(nextTotalItems);
      setAccessError('');
      setLoading(false);
      return;
    }

    const searchPath = isGlobalSearch ? '' : currentPath;
    const searchText = isGlobalSearch ? debouncedSearch : '';
    fetchImages(page, limit, searchPath, selectedTag, selectedList, searchText);
  }, [
    locationReady,
    isSharedView,
    sourceMode,
    page,
    limit,
    currentPath,
    selectedTag,
    selectedList,
    allShares,
    debouncedSearch,
    isGlobalSearch,
    includeOtherFiles,
    localLibraryEntries,
    authStatus?.user?.id,
    authStatus?.requireAuth,
  ]);

  useEffect(() => {
    let timer: number | undefined;
    if (loading) {
      setLoadingOverlayVisible(true);
    } else {
      timer = window.setTimeout(() => setLoadingOverlayVisible(false), 50);
    }
    return () => {
      if (timer) window.clearTimeout(timer);
    };
  }, [loading]);

  useEffect(() => {
    if (!locationReady || isSharedView || showSelectedOnly || !isMaxMode || loading || page >= serverTotalPages) {
      return;
    }

    const nextPage = page + 1;
    const searchPath = isGlobalSearch ? '' : currentPath;
    const searchText = isGlobalSearch ? debouncedSearch.trim() : '';
    const prewarmKey = JSON.stringify({
      page: nextPage,
      limit: MAX_MODE_LIMIT,
      path: searchPath,
      tag: selectedTag,
      list: selectedList,
      search: searchText,
      includeOtherFiles,
    });

    if (prewarmedPageKeysRef.current.has(prewarmKey)) {
      return;
    }

    prewarmedPageKeysRef.current.add(prewarmKey);
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      const params = new URLSearchParams({
        page: String(nextPage),
        limit: String(MAX_MODE_LIMIT),
        path: searchPath,
      });
      if (selectedTag) params.append('tag', selectedTag);
      if (selectedList) params.append('list', selectedList);
      if (searchText) params.append('search', searchText);

      fetch(`${API_PATH}/images?${params.toString()}`, {
        credentials: 'include',
        signal: controller.signal,
      })
        .then(res => (res.ok ? res.json() : null))
        .then(data => {
          const preloadPaths = Array.isArray(data?.files)
            ? data.files
                .filter((file: { type?: string; path?: string; kind?: MediaKind }) => (
                  file.type === 'file' &&
                  typeof file.path === 'string' &&
                  (includeOtherFiles || (file.kind || getMediaKind(file.path)) === 'image') &&
                  isRenderable(file.path)
                ))
                .map((file: { path: string }) => file.path)
            : Array.isArray(data?.images)
              ? data.images.filter((value: unknown): value is string => typeof value === 'string' && isRenderable(value))
              : [];

          const nextPreloads = preloadPaths.slice(0, MAX_MODE_LIMIT).map(path => {
            const img = new Image();
            img.decoding = 'async';
            img.loading = 'eager';
            img.src = buildThumbUrl(path, MAX_MODE_ROW_HEIGHT, MAX_MODE_ROW_HEIGHT * 2);
            return img;
          });

          prewarmImagesRef.current = nextPreloads;
        })
        .catch(err => {
          if (err.name !== 'AbortError') {
            prewarmedPageKeysRef.current.delete(prewarmKey);
          }
        });
    }, 350);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [
    locationReady,
    isSharedView,
    showSelectedOnly,
    isMaxMode,
    loading,
    page,
    serverTotalPages,
    isGlobalSearch,
    currentPath,
    debouncedSearch,
    selectedTag,
    selectedList,
    includeOtherFiles,
  ]);

  // Load the manual cover and metadata for the current folder whenever the path changes
  useEffect(() => {
    if (sourceMode !== 'server' || !currentPath || !canEditServerFolders) {
      setFolderCoverPaths({ cover1Path: null, cover2Path: null });
      setFolderTitleInput('');
      setFolderDescriptionInput('');
      setFolderQuickVisibleToUsers(true);
      setFolderQuickVisibleToAdmins(true);
      return;
    }

    fetch(`${API_PATH}/folder-cover?path=${encodeURIComponent(currentPath)}`, { credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        setFolderTitleInput(data?.title ?? '');
        setFolderDescriptionInput(data?.description ?? '');
        setFolderQuickVisibleToUsers(data?.visibleToUsers ?? true);
        setFolderQuickVisibleToAdmins(data?.visibleToAdmins ?? true);
        setFolderCoverPaths({
          cover1Path: data?.cover1ImagePath ?? data?.coverImagePath ?? null,
          cover2Path: data?.cover2ImagePath ?? null,
        });
      })
      .catch(() => {
        setFolderTitleInput('');
        setFolderDescriptionInput('');
        setFolderQuickVisibleToUsers(true);
        setFolderQuickVisibleToAdmins(true);
        setFolderCoverPaths({ cover1Path: null, cover2Path: null });
      });
  }, [sourceMode, currentPath, canEditServerFolders]);

  useEffect(() => {
    if (sourceMode !== 'server' || !folderQuickEditPath || !canEditServerFolders) {
      setFolderQuickApprovedUsers([]);
      setFolderQuickAccountAccess({});
      setFolderQuickParentAccess({ visibleToUsers: true, visibleToAdmins: true, accounts: {} });
      return;
    }

    fetch(`${API_PATH}/folder-cover?path=${encodeURIComponent(folderQuickEditPath)}`, { credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (!data) return;
        setFolderQuickEditTitle(data.title ?? '');
        setFolderQuickEditDescription(data.description ?? '');
        setFolderQuickVisibleToUsers(data.visibleToUsers ?? true);
        setFolderQuickVisibleToAdmins(data.visibleToAdmins ?? true);
        setFolderQuickApprovedUsers(data.approvedUsers || []);
        setFolderQuickAccountAccess(data.accountAccess || {});
        setFolderQuickParentAccess({
          visibleToUsers: data.parentAccess?.visibleToUsers ?? true,
          visibleToAdmins: data.parentAccess?.visibleToAdmins ?? true,
          accounts: data.parentAccess?.accounts || {},
        });
      })
      .catch(() => {
        setFolderQuickApprovedUsers([]);
        setFolderQuickAccountAccess({});
        setFolderQuickParentAccess({ visibleToUsers: true, visibleToAdmins: true, accounts: {} });
      });
  }, [sourceMode, folderQuickEditPath, canEditServerFolders]);

  useEffect(() => {
    if (!currentPath) {
      setSiblingFolders([]);
      return;
    }

    if (sourceMode === 'local') {
      const parentPath = dirname(currentPath);
      const lookupPath = parentPath === 'root' ? '' : parentPath;
      setSiblingFolders(buildLocalFolderEntries(localLibraryEntries, lookupPath));
      return;
    }

    const parentPath = dirname(currentPath);
    const lookupPath = parentPath === 'root' ? '' : parentPath;

    const controller = new AbortController();

    fetch(`${API_PATH}/images?${new URLSearchParams({
      page: '1',
      limit: '1',
      path: lookupPath,
    }).toString()}`, {
      credentials: 'include',
      signal: controller.signal,
    })
      .then(res => (res.ok ? res.json() : null))
      .then(data => {
        const nextFolders = Array.isArray(data?.folders)
          ? data.folders.map((folder: FolderApiEntry) => mapFolderApiEntry(folder)).filter((folder: FolderEntry) => Boolean(folder.path))
          : [];
        setSiblingFolders(nextFolders);
      })
      .catch(() => {
        setSiblingFolders([]);
      });

    return () => controller.abort();
  }, [sourceMode, currentPath, localLibraryEntries]);

  useEffect(() => {
    if (!locationReady || isSharedView || sourceMode === 'local' || !locationHydratedRef.current) {
      historyModeRef.current = 'replace';
      return;
    }

    const mode: GalleryMode =
      view === 'staging'
        ? 'staging'
        : showSelectedOnly && selectionDraftId
          ? 'selected'
          : 'gallery';

    const nextUrl = buildGalleryStateUrl({
      path: currentPath,
      page,
      rowHeight,
      limit,
      includeOtherFiles,
      showFolderThumbnails,
      selectedTag,
      selectedList,
      searchQuery: debouncedSearch,
      selectedImage,
      mode,
      selectionId: mode === 'gallery' ? null : selectionDraftId,
    });
    const currentUrl = `${window.location.pathname}${window.location.search}`;

    if (locationReady && !isSharedView && locationHydratedRef.current && nextUrl !== currentUrl) {
      if (historyModeRef.current === 'push') {
        window.history.pushState(null, '', nextUrl);
      } else {
        window.history.replaceState(null, '', nextUrl);
      }
    }

    historyModeRef.current = 'replace';
  }, [
    locationReady,
    isSharedView,
    view,
    showSelectedOnly,
    selectionDraftId,
    currentPath,
    page,
    rowHeight,
    limit,
    includeOtherFiles,
    showFolderThumbnails,
    selectedTag,
    selectedList,
    debouncedSearch,
    selectedImage,
    sourceMode,
  ]);

  useEffect(() => {
    if (!locationReady || isSharedView || sourceMode === 'local' || !currentPath || isGlobalSearch) {
      return;
    }

    lastFolderPathRef.current = currentPath;
    saveLastFolderPath(currentPath);
  }, [locationReady, isSharedView, sourceMode, currentPath, isGlobalSearch]);

  useEffect(() => {
    if (page > computedTotalPages) {
      setPage(computedTotalPages);
    }
  }, [page, computedTotalPages]);

  useEffect(() => {
    const centralMode = authStatus?.provider === 'central';
    if (!centralMode && accountPanel === 'user' && authStatus?.user) {
      loadHistory();
      setNewUsernameInput(authStatus.user.username);
    }
    if (!centralMode && accountPanel === 'admin' && authStatus?.user?.isAdmin) {
      loadAdminUsers();
    }
  }, [accountPanel, authStatus?.provider, authStatus?.user?.id, authStatus?.user?.isAdmin]);

  const fetchImages = async (p: number, l: number, path: string, tag: string = '', list: string = '', search: string = '') => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(p),
        limit: String(l),
        path,
      });
      if (tag) {
        params.append('tag', tag);
      }
      if (list) {
        params.append('list', list);
      }
      if (search) {
        params.append('search', search);
      }
      const res = await fetch(`${API_PATH}/images?${params.toString()}`, {
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch images');
      setAccessError('');

      const nextEntries: MediaEntry[] = Array.isArray(data.files)
        ? data.files
            .filter((file: { type?: string }) => file.type === 'file')
            .map((file: { path: string; name?: string; folderPath?: string; kind?: MediaKind; ext?: string; title?: string; description?: string; tags?: string[]; is_large?: boolean; size?: number }) => ({
              path: file.path,
              name: file.name || basename(file.path),
              folderPath: file.folderPath || dirname(file.path),
              kind: file.kind || (isRenderable(file.path) ? 'image' : 'other'),
              ext: file.ext || extensionOf(file.path),
              title: file.title || '',
              description: file.description || '',
              tags: file.tags || [],
              is_large: file.is_large || false,
              size: file.size || 0,
            }))
        : (data.images || []).map((value: string) => toMediaEntry(value));

      const nextFolders: FolderEntry[] = Array.isArray(data.folders)
        ? data.folders.map((folder: FolderApiEntry) => mapFolderApiEntry(folder)).filter((folder: FolderEntry) => Boolean(folder.path))
        : (data.directories || []).map((dir: string) => ({
            path: dir,
            name: basename(dir),
            title: '',
            description: '',
            thumbnailPath: null,
            thumbnailKind: null,
            thumbnailExt: '',
            secondaryThumbnailPath: null,
            secondaryThumbnailKind: null,
            secondaryThumbnailExt: '',
            cover1Path: null,
            cover2Path: null,
            itemCount: 0,
            fileCount: 0,
            folderCount: 0,
          }));

      setEntries(nextEntries);
      setFolders(nextFolders);
      setServerTotalPages(Math.max(1, Number(data.totalPages) || 1));
      setServerTotalItems(Number(data.total) || nextEntries.length);
    } catch (err) {
      console.error('Failed to fetch images', err);
      setEntries([]);
      setFolders([]);
      setServerTotalPages(1);
      setServerTotalItems(0);
      const message = err instanceof Error ? err.message : 'Failed to fetch images';
      if (/authentication required/i.test(message)) {
        if (authStatus?.provider === 'central') {
          setAccessError('Perihelion is private right now. Sign in through Multimillion and make sure your account has Perihelion access.');
        } else {
          setAccessError('Perihelion is private right now. Sign in with an approved account to browse files.');
        }
      } else {
        setAccessError('');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeLightbox();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedImage]);

  useEffect(() => {
    if (!selectedImage) {
      setImageMeta(null);
      setImageMetaState('idle');
      setImageDetail(null);
      setImageDetailState('idle');
      setShowEditBox(false);
      return;
    }

    if (sourceMode === 'local') {
      const localEntry = localLibraryEntries.find(entry => entry.path === selectedImage) || entries.find(entry => entry.path === selectedImage);
      setImageDetail({
        title: '',
        description: '',
        ai_description: '',
        tags: [],
        exif: {
          type: localEntry?.kind || 'image',
          format: extensionOf(selectedImage).replace('.', '').toUpperCase() || 'FILE',
          size: localEntry?.size || 0,
          width: null,
          height: null,
          mode: null,
          frames: null,
          orientation: null,
          cameraMake: null,
          cameraModel: null,
          capturedAt: null,
        },
      });
      setImageDetailState('ready');
      setImageMeta({
        type: localEntry?.kind || 'image',
        size: localEntry?.size || 0,
        width: 0,
        height: 0,
      });
      setImageMetaState('ready');
      setShowEditBox(false);
      return;
    }

    setImageMeta(null);
    setImageMetaState('loading');
    setImageDetail(null);
    setImageDetailState('loading');

    fetch(`${API_PATH}/image-details/${encodeURIComponent(selectedImage)}`, {
      credentials: 'include',
    })
      .then(res => res.json())
      .then(data => {
        if (data.ok) {
          setImageDetail(data);
          setImageDetailState('ready');
          if (data.exif) {
            setImageMeta({
              type: data.exif.type,
              size: data.exif.size,
              width: data.exif.width || 0,
              height: data.exif.height || 0
            });
            setImageMetaState('ready');
          } else {
            setImageMetaState('unavailable');
          }
        } else {
          setImageDetailState('unavailable');
          setImageMetaState('unavailable');
        }
      })
      .catch(err => {
        console.error(err);
        setImageDetailState('unavailable');
        setImageMetaState('unavailable');
      });
  }, [selectedImage, sourceMode, localLibraryEntries, entries]);

  useEffect(() => {
    if (imageDetailState === 'ready' && imageDetail) {
      setEditTitle(imageDetail.title || '');
      setEditDescription(imageDetail.description || '');
      setEditTags(imageDetail.tags || []);
    }
  }, [imageDetailState, imageDetail]);

  useEffect(() => {
    if (showTagsPopover) {
      setActiveTagIndex(0);
    }
  }, [showTagsPopover, tagSearch]);

  useEffect(() => {
    if (showListsPopover) {
      setActiveListIndex(0);
    }
  }, [showListsPopover, listSearch]);

  useEffect(() => {
    setActiveTagInputIndex(0);
  }, [tagInput, editTags]);

  const getTagState = (tagName: string) => {
    const selectedList = Array.from(selectedImages);
    const sourceEntries = sourceMode === 'local' ? localLibraryEntries : entries;
    const visibleSelected = selectedList.filter(path => sourceEntries.some(e => e.path === path) || selectedMetadata[path]);
    
    if (visibleSelected.length === 0) return { checked: false, indeterminate: false };
    
    const count = visibleSelected.filter(path => {
      const entry = sourceEntries.find(e => e.path === path) || selectedMetadata[path];
      return entry?.tags?.includes(tagName) || false;
    }).length;
    
    return {
      checked: count === visibleSelected.length,
      indeterminate: count > 0 && count < visibleSelected.length
    };
  };

  const handleToggleTagBulk = async (tagName: string) => {
    const tag = tagName.trim().toLowerCase();
    if (!tag) return;
    
    const { checked } = getTagState(tag);
    const action = checked ? 'remove' : 'add';
    const updateEntryTags = (entry: MediaEntry) => {
      if (!selectedImages.has(entry.path)) {
        return entry;
      }

      const tags = entry.tags || [];
      if (action === 'add' && !tags.includes(tag)) {
        return { ...entry, tags: [...tags, tag] };
      }
      if (action === 'remove') {
        return { ...entry, tags: tags.filter(t => t !== tag) };
      }
      return entry;
    };
    
    setEntries(prev => prev.map(updateEntryTags));
    setSelectedMetadata(prev => Object.fromEntries(
      Object.entries(prev).map(([path, entry]) => [path, updateEntryTags(entry)])
    ));

    if (sourceMode === 'local') {
      const nextLibraryEntries = localLibraryEntries.map(updateEntryTags);
      const nextTagSet = new Set<string>();
      nextLibraryEntries.forEach(entry => (entry.tags || []).forEach(entryTag => nextTagSet.add(entryTag)));
      setLocalLibraryEntries(nextLibraryEntries);
      setAllTags(Array.from(nextTagSet).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' })));
      return;
    }
    
    try {
      const res = await fetch(`${API_PATH}/bulk-tags`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          images: Array.from(selectedImages),
          tag,
          action
        }),
        credentials: 'include'
      });
      if (!res.ok) throw new Error('Bulk tag update failed');
      fetchTags();
    } catch (err) {
      console.error(err);
      fetchImages(page, limit, currentPath, selectedTag);
    }
  };

  const getListState = (shareId: string) => {
    const share = allShares.find(s => s.id === shareId);
    if (!share) return { checked: false, indeterminate: false };
    
    const selectedList = Array.from(selectedImages);
    const count = selectedList.filter(path => share.images.includes(path)).length;
    
    return {
      checked: count === selectedList.length,
      indeterminate: count > 0 && count < selectedList.length
    };
  };

  const handleToggleListBulk = async (shareId: string) => {
    const share = allShares.find(s => s.id === shareId);
    if (!share) return;
    
    const { checked } = getListState(shareId);
    let nextImages = [...share.images];
    
    const selectedList = Array.from(selectedImages);
    if (checked) {
      nextImages = nextImages.filter(path => !selectedImages.has(path));
    } else {
      selectedList.forEach(path => {
        if (!nextImages.includes(path)) {
          nextImages.push(path);
        }
      });
    }
    
    setAllShares(prev => prev.map(s => {
      if (s.id === shareId) {
        return { ...s, images: nextImages, itemCount: nextImages.length };
      }
      return s;
    }));

    if (sourceMode === 'local') {
      return;
    }
    
    try {
      const res = await fetch(`${API_PATH}/share/${shareId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ images: nextImages }),
        credentials: 'include'
      });
      if (!res.ok) throw new Error('Failed to update share list');
    } catch (err) {
      console.error(err);
      fetchShares();
    }
  };

  const handleCommitTagPopoverChoice = async (tagName: string) => {
    await handleToggleTagBulk(tagName);
    setShowTagsPopover(false);
    setTagSearch('');
    setActiveTagIndex(0);
  };

  const handleCommitListPopoverChoice = async (shareId: string) => {
    await handleToggleListBulk(shareId);
    setShowListsPopover(false);
    setListSearch('');
    setActiveListIndex(0);
  };

  const handleCommitEditTagChoice = (tagName: string) => {
    const cleanTag = tagName.trim().toLowerCase();
    if (!cleanTag || editTags.includes(cleanTag)) return;
    setEditTags([...editTags, cleanTag]);
    setTagInput('');
    setActiveTagInputIndex(0);
  };

  const handleCreateListBulk = async (title: string) => {
    const cleanTitle = title.trim();
    if (!cleanTitle) return;
    
    const selectedList = Array.from(selectedImages);

    if (sourceMode === 'local') {
      const localShare = {
        id: `local-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
        title: cleanTitle,
        images: selectedList,
        itemCount: selectedList.length,
        created_at: new Date().toISOString(),
      };
      setAllShares(prev => sortSharesNewestFirst([localShare, ...prev]));
      setListSearch('');
      setShowListsPopover(false);
      return;
    }
    
    try {
      const res = await fetch(`${API_PATH}/share`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: cleanTitle,
          images: selectedList
        }),
        credentials: 'include'
      });
      if (!res.ok) throw new Error('Failed to create new share list');
      const data = await res.json();
      if (data.share) {
        setAllShares(prev => sortSharesNewestFirst([data.share, ...prev.filter(share => share.id !== data.share.id)]));
      } else {
        fetchShares();
      }
      setListSearch('');
      setShowListsPopover(false);
    } catch (err) {
      console.error(err);
    }
  };

  const handleRenameTag = async (oldTag: string) => {
    const cleanNew = renamingTagValue.trim().toLowerCase();
    if (!cleanNew || cleanNew === oldTag) {
      setRenamingTag(null);
      setRenamingTagValue('');
      return;
    }
    
    try {
      const res = await fetch(`${API_PATH}/tags/rename`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ oldTag, newTag: cleanNew }),
        credentials: 'include'
      });
      if (!res.ok) throw new Error('Failed to rename tag');
      setRenamingTag(null);
      setRenamingTagValue('');
      fetchTags();
      fetchImages(page, limit, currentPath, selectedTag === oldTag ? cleanNew : selectedTag, selectedList);
      if (selectedTag === oldTag) setSelectedTag(cleanNew);
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteTag = async (tag: string) => {
    if (!window.confirm(`Are you sure you want to delete tag #${tag} globally?`)) return;
    
    try {
      const res = await fetch(`${API_PATH}/tags/delete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tag }),
        credentials: 'include'
      });
      if (!res.ok) throw new Error('Failed to delete tag');
      fetchTags();
      fetchImages(page, limit, currentPath, selectedTag === tag ? '' : selectedTag, selectedList);
      if (selectedTag === tag) setSelectedTag('');
    } catch (err) {
      console.error(err);
    }
  };

  const handleRenameList = async (shareId: string, currentTitle: string) => {
    const newTitle = window.prompt(`Rename list to:`, currentTitle);
    if (newTitle === null) return;
    const cleanTitle = newTitle.trim();
    
    try {
      const res = await fetch(`${API_PATH}/share/${shareId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: cleanTitle }),
        credentials: 'include'
      });
      if (!res.ok) throw new Error('Failed to rename list');
      fetchShares();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteList = async (shareId: string, title: string) => {
    if (!window.confirm(`Are you sure you want to delete the list "${title || shareId}"?`)) return;
    
    try {
      const res = await fetch(`${API_PATH}/share/${shareId}/delete`, {
        method: 'POST',
        credentials: 'include'
      });
      if (!res.ok) throw new Error('Failed to delete list');
      fetchShares();
      if (selectedList === shareId) {
        setSelectedList('');
        fetchImages(page, limit, currentPath, selectedTag, '');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleOpenShareCode = async () => {
    const code = shareCodeInput.trim().toLowerCase();
    if (code.length === 4) {
      setIsValidatingCode(true);
      setShareCodeError('');
      setShareCodeNotice('');
      try {
        const res = await fetch(`${API_PATH}/share/${encodeURIComponent(code)}`, {
          credentials: 'include',
        });
        if (!res.ok) {
          throw new Error('Not found');
        }
        const data = await res.json();
        if (data.error) {
          throw new Error(data.error);
        }
        
        const shareUrl = buildSharePageUrl(code);
        window.open(shareUrl, '_blank');
        setShareCodeInput('');
      } catch (err) {
        setShareCodeError('Invalid Code');
      } finally {
        setIsValidatingCode(false);
      }
    }
  };

  const handleLoadShareCode = async () => {
    const code = shareCodeInput.trim().toLowerCase();
    if (code.length !== 4) return;
    setIsValidatingCode(true);
    setShareCodeError('');
    setShareCodeNotice('');
    try {
      const res = await fetch(`${API_PATH}/share/${encodeURIComponent(code)}`, {
        credentials: 'include',
      });
      if (!res.ok) {
        throw new Error('Not found');
      }
      const data = await res.json();
      if (data.error) {
        throw new Error(data.error);
      }

      const shareFiles = Array.isArray(data.files) ? data.files : [];
      const fileMap = new Map<string, { size?: number; is_large?: boolean; missing?: boolean; name?: string }>(
        shareFiles.map((file: { path: string; size?: number; is_large?: boolean; missing?: boolean; name?: string }) => [file.path, file]),
      );

      const nextSelected = new Set<string>();
      const nextMeta: Record<string, MediaEntry> = {};
      const missingImages: string[] = Array.isArray(data.missingImages) ? data.missingImages : [];

      (Array.isArray(data.images) ? data.images : []).forEach((path: string) => {
        if (!path) return;
        nextSelected.add(path);
        const existing = entries.find(entry => entry.path === path) || selectedMetadata[path];
        const shareFile = fileMap.get(path);
        nextMeta[path] = existing
          ? {
              ...existing,
              size: shareFile?.size ?? existing.size ?? 0,
              is_large: shareFile?.is_large ?? existing.is_large ?? false,
              isMissing: Boolean(shareFile?.missing),
            }
          : {
              path,
              name: shareFile?.name || basename(path),
              kind: getMediaKind(path),
              ext: extensionOf(path),
              title: '',
              description: '',
              tags: [],
              is_large: Boolean(shareFile?.is_large),
              size: shareFile?.size || 0,
              isMissing: Boolean(shareFile?.missing),
            };
      });

      setSelectedMetadata(prev => ({ ...prev, ...nextMeta }));
      const draftId = createSelectionDraftId();
      saveSelectionDraft({
        id: draftId,
        createdAt: new Date().toISOString(),
        items: Object.values(nextMeta),
      });
      setSelectionDraftId(draftId);
      queueHistoryUpdate('push');
      setSelectedImages(nextSelected);
      setShowSelectedOnly(true);
      setSelectedTag('');
      setSelectedList('');
      setSearchQuery('');
      setPage(1);
      setView('gallery');
      setShareCodeNotice(
        missingImages.length > 0
          ? `Share ${code} loaded into your working selection. ${missingImages.length} missing file${missingImages.length === 1 ? '' : 's'} kept as placeholders.`
          : `Share ${code} loaded into your working selection.`,
      );
      setShareCodeInput('');
    } catch (err) {
      setShareCodeError('Invalid Code');
    } finally {
      setIsValidatingCode(false);
    }
  };

  const toggleSelection = (img: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const newSet = new Set(selectedImages);
    if (newSet.has(img)) {
      newSet.delete(img);
    } else {
      newSet.add(img);
      const entry = entries.find(e => e.path === img);
      if (entry) {
        setSelectedMetadata(prev => ({ ...prev, [img]: entry }));
      }
    }
    setSelectedImages(newSet);
  };

  const handleSelectAll = () => {
    const newSet = new Set(selectedImages);
    const newMeta = { ...selectedMetadata };
    pagedEntries.forEach(entry => {
      newSet.add(entry.path);
      newMeta[entry.path] = entry;
    });
    setSelectedMetadata(newMeta);
    setSelectedImages(newSet);
  };

  const handleDeselectAll = () => {
    const newSet = new Set(selectedImages);
    pagedEntries.forEach(entry => newSet.delete(entry.path));
    setSelectedImages(newSet);
  };

  const handleDownload = async (options: DownloadOptions) => {
    if (options.files.length === 0) return;
    setIsDownloading(true);
    try {
      if (sourceMode === 'local') {
        for (const file of options.files) {
          const url = localObjectUrls[file.original];
          if (!url) {
            continue;
          }
          const a = document.createElement('a');
          a.href = url;
          a.download = file.newName || basename(file.original);
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          await new Promise(resolve => window.setTimeout(resolve, 60));
        }
        setView('gallery');
        return;
      }

      const res = await fetch(`${API_PATH}/download`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(options),
      });
      if (!res.ok) throw new Error(`Download failed: ${res.status}`);
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'selected-files.zip';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      setView('gallery');
    } catch (err) {
      console.error(err);
    } finally {
      setIsDownloading(false);
    }
  };

  const handleAuthSubmit = async () => {
    setAuthError('');
    setAuthMessage('');

    if (authMode === 'register' && passwordInput !== confirmPasswordInput) {
      setAuthError('Passwords do not match.');
      return;
    }
    if (authMode === 'register' && requestNoteInput.trim().length < 12) {
      setAuthError('Please include a short note about who you are or why you are requesting access.');
      return;
    }

    try {
      const response = await fetch(`${API_PATH}/auth/${authMode}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          username: usernameInput,
          password: passwordInput,
          requestNote: requestNoteInput,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || `Failed to ${authMode}`);
      }

      if (authMode === 'register') {
        setAuthMessage(data.needsApproval
          ? 'Account created. It now needs approval before sign-in.'
          : 'Account created. You can sign in now.');
        setAuthMode('login');
      } else {
        setAuthMessage('Signed in.');
        setAccountPanel(null);
      }

      resetAuthForm();
      await loadAuthStatus();
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : `Failed to ${authMode}`);
    }
  };

  const handlePasswordChange = async () => {
    setAuthError('');
    setAuthMessage('');

    if (newPasswordInput !== confirmNewPasswordInput) {
      setAuthError('New passwords do not match.');
      return;
    }

    try {
      const response = await fetch(`${API_PATH}/auth/change-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          currentPassword: currentPasswordInput,
          newPassword: newPasswordInput,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to change password');
      }
      setAuthMessage('Password updated.');
      resetPasswordForm();
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : 'Failed to change password');
    }
  };

  const handleUsernameChange = async () => {
    setAuthError('');
    setAuthMessage('');

    try {
      const response = await fetch(`${API_PATH}/auth/change-username`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          currentPassword: currentUsernamePasswordInput,
          newUsername: newUsernameInput,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to change username');
      }
      setAuthMessage('Username updated.');
      setCurrentUsernamePasswordInput('');
      await loadAuthStatus();
      if (accountPanel === 'admin') {
        await loadAdminUsers();
      }
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : 'Failed to change username');
    }
  };

  const handleLogout = async () => {
    setAuthError('');
    setAuthMessage('');
    try {
      const response = await fetch(usesCentralAuth ? `${authBaseUrl}/api/auth/logout` : `${API_PATH}/auth/logout`, {
        method: 'POST',
        headers: usesCentralAuth ? { 'Content-Type': 'application/json' } : undefined,
        credentials: 'include',
        body: usesCentralAuth ? JSON.stringify({ siteContext: window.location.href }) : undefined,
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to sign out');
      }
      setAccountPanel(null);
      setHistoryEntries([]);
      setAdminUsers([]);
      resetAuthForm();
      resetPasswordForm();
      resetUsernameForm();
      setAuthMessage(usesCentralAuth ? 'Signed out of Multimillion.' : '');
      await loadAuthStatus();
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : 'Failed to sign out');
    }
  };

  const handleAdminAction = async (userId: string | number, action: 'approve' | 'block') => {
    setAuthError('');
    try {
      const response = await fetch(`${API_PATH}/admin/users/${userId}/${action}`, {
        method: 'POST',
        credentials: 'include',
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || `Failed to ${action} account`);
      }
      await loadAdminUsers();
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : `Failed to ${action} account`);
    }
  };

  const handleDeleteUser = async (userId: string | number) => {
    setAuthError('');
    try {
      const response = await fetch(`${API_PATH}/admin/users/${userId}/delete`, {
        method: 'POST',
        credentials: 'include',
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to delete account');
      }
      await loadAdminUsers();
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : 'Failed to delete account');
    }
  };

  const pendingUsers = adminUsers.filter(user => !user.isApproved && !user.isBlocked);
  const approvedUsers = adminUsers.filter(user => user.isApproved && !user.isBlocked);
  const blockedUsers = adminUsers.filter(user => user.isBlocked);
  const showPrivateGate = !loading && Boolean(accessError);
  const usesCentralAuth = authStatus?.provider === 'central';
  const authBaseUrl = authStatus?.authBaseUrl || 'https://auth.jeffersonwm.com';

  const openCentralAuth = (mode: 'login' | 'register' = 'login') => {
    const url = new URL(authBaseUrl);
    url.searchParams.set('returnTo', window.location.href);
    if (mode === 'register') {
      url.searchParams.set('mode', 'register');
    }
    window.location.assign(url.toString());
  };

  const accountPanelTitle = accountPanel === 'user'
    ? 'Your Account'
    : accountPanel === 'admin'
      ? usesCentralAuth ? 'Dashboard' : 'Account Dashboard'
      : accountPanel === 'manage'
        ? 'Manage Tags & Lists'
        : authStatus?.user
          ? 'Account'
          : 'Sign In';

  if (isSharedView) {
    const shareIdForUrl = getShareIdFromLocation();
    const shareUrl = buildSharePageUrl(shareIdForUrl);

    return (
      <div className="min-h-screen bg-[#F0F0F0] p-[20px] flex flex-col items-center gap-10">
        {sharedError ? (
          <div className="text-red-500 font-bold uppercase tracking-widest">{sharedError}</div>
        ) : !sharedImages ? (
          <div className="text-[#888] font-bold uppercase tracking-widest animate-pulse">Loading...</div>
        ) : (
          <>
            {/* Copy-to-clipboard Short URL widget */}
            <div className="flex items-center gap-2 border-[2px] border-black bg-white px-3 py-1.5 font-sans text-[10px] sm:text-xs shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] max-w-full overflow-x-auto mt-4">
              <span className="text-[#888] uppercase font-bold tracking-wider mr-1">Share Link:</span>
              <a href={shareUrl} className="text-black hover:underline font-bold" target="_blank" rel="noopener noreferrer">
                {shareUrl}
              </a>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(shareUrl);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                }}
                className="ml-2 hover:bg-gray-100 p-1 border border-transparent hover:border-black active:bg-gray-200 transition-all flex items-center justify-center"
                title="Copy to clipboard"
              >
                {copied ? (
                  <Check size={14} className="text-green-600 font-bold" strokeWidth={3} />
                ) : (
                  <Copy size={13} className="text-black" strokeWidth={2.5} />
                )}
              </button>
              {copied && <span className="text-green-600 text-[10px] font-bold uppercase ml-1 animate-pulse">Copied!</span>}
            </div>
            {(sharedTitle || sharedDescription) && (
              <div className="flex flex-col items-center text-center w-full max-w-4xl mt-8 mb-4">
                {sharedTitle && (
                  <h1 className="text-2xl font-sans font-bold break-words">
                    {sharedTitle}
                  </h1>
                )}
                {sharedDescription && (
                  <p className="text-sm font-sans text-[#666] max-w-2xl mt-2 whitespace-pre-wrap leading-relaxed">
                    {sharedDescription}
                  </p>
                )}
              </div>
            )}
            {sharedNonRenderable.length > 0 && (
              <div className="w-full max-w-4xl border-[2px] border-[#666] bg-white px-5 py-4 flex flex-col gap-2">
                {sharedNonRenderable.map(file => (
                  <div key={file} className="font-sans text-xs font-bold uppercase tracking-widest text-[#666] break-all">
                    {basename(file)}
                  </div>
                ))}
              </div>
            )}
            {sharedRenderableFiles.map(file => {
              const isLarge = file.is_large;
              const size = file.size || 0;
              const isForced = forceFullImage[file.path];
              const srcUrl = (isLarge && !isForced)
                ? buildMediaUrl(file.path)
                : buildImageUrl(file.path);

              return (
                <div key={file.path} className="flex flex-col items-center justify-center w-full gap-2 relative">
                  <div className="relative max-w-full">
                    <img
                      src={srcUrl}
                      alt={file.path}
                      loading="lazy"
                      referrerPolicy="no-referrer"
                      className="max-w-full h-auto object-contain border-[2px] border-black bg-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
                    />
                    {isLarge && !isForced && (
                      <div className="absolute top-2 right-2 bg-yellow-400 text-black border-[2px] border-black px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                        Lrg
                      </div>
                    )}
                  </div>
                  {isLarge && !isForced && (
                    <button
                      onClick={() => {
                        setForceFullImage(prev => ({ ...prev, [file.path]: true }));
                      }}
                      className="bg-yellow-400 text-black border-[2px] border-black px-3 py-1 font-bold uppercase text-[9px] shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all flex items-center gap-1 mt-1"
                    >
                      Load Full Image ({formatBytes(size)})
                    </button>
                  )}
                  {isLarge && isForced && (
                    <span className="text-[9px] text-gray-500 font-bold uppercase tracking-wider">
                      Viewing original image ({formatBytes(size)})
                    </span>
                  )}
                </div>
              );
            })}
          </>
        )}
      </div>
    );
  }



  return (
    <div className={`min-h-screen text-black flex flex-col selection:bg-black selection:text-white bg-[#fafafa] ${view === 'staging' ? '' : 'peri-shell'}`}>
      {view === 'staging' ? (
        <StagingView
          selectedImages={stagedImages}
          selectedMetadata={selectedMetadata}
          onBack={() => leaveSelectionModes('push')}
          onDownload={handleDownload}
          isDownloading={isDownloading}
          onOpenLightbox={openLightbox}
          isLargeMap={isLargeMap}
          isLocalMode={sourceMode === 'local'}
          getPreviewUrl={getResolvedThumbUrl}
          getOriginalUrl={getResolvedImageUrl}
        />
      ) : (
        <>
          <header className="page-banner page-banner--top">
        <div className="page-banner__inner shell-frame">
        <h1 className="font-sans text-[15px] font-bold">
          <a href={getPerihelionAppUrl()} className="page-banner__brand">
            Perihelion
          </a>
        </h1>
        <div className="flex items-center gap-3 font-sans text-[11px] font-bold">
          {authLoading ? (
            <span className="text-[#888]">Checking AccountÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â¦</span>
          ) : authStatus?.user ? (
            <>
              {authStatus.user.isAdmin && (
                <>
                  <button
                    onClick={() => {
                      setAccountPanel('manage');
                      setManageTab('tags');
                    }}
                    className="text-[#888] hover:text-black transition-colors"
                  >
                    Manage
                  </button>
                  <span className="text-[#DDD]">|</span>
                  <button
                    onClick={() => {
                      if (usesCentralAuth) {
                        openCentralAuth();
                      } else {
                        setAccountPanel('admin');
                        setAuthError('');
                        setAuthMessage('');
                      }
                    }}
                    className="text-[#888] hover:text-black transition-colors"
                  >
                    Dashboard
                  </button>
                </>
              )}
              <button
                onClick={() => {
                  setAccountPanel('user');
                  setAuthError('');
                  setAuthMessage('');
                }}
                className="text-black underline decoration-[1.5px] underline-offset-[3px]"
              >
                {authStatus.user.username}
              </button>
              <button onClick={handleLogout} className="text-[#888] hover:text-black transition-colors">
                Sign Out
              </button>
            </>
          ) : (
            <button
              onClick={() => {
                setAccountPanel('auth');
                setAuthError('');
                setAuthMessage('');
              }}
              className="text-[#888] hover:text-black transition-colors"
            >
              {authStatus?.hasUsers ? 'Sign In' : 'Create Admin'}
            </button>
          )}
        </div>
        </div>
      </header>

      <div className="shell-gutters" aria-hidden="true">
        <div className="shell-gutter shell-gutter--left" />
        <div className="shell-gutter shell-gutter--right" />
      </div>

      <input
        ref={localFolderInputRef}
        type="file"
        multiple
        onChange={handleLocalFolderInputChange}
        className="hidden"
      />

      <main className="peri-shell__body text-[15px]">
        {!showPrivateGate && (
          <div className="peri-toolbar-divider mb-6 flex flex-col gap-1 pb-2">
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
            <div className="peri-toolbar-group">
              <span className={`peri-control-label ${isMaxMode ? 'text-[#c8c8c8]' : 'text-[#6a716b]'}`}>Image Height</span>
              {ROW_HEIGHT_OPTIONS.map(num => (
                <button
                  key={num}
                  onClick={() => {
                    setRowHeight(num);
                    if (isMaxMode) setLimit(25);
                  }}
                  className={
                    isMaxMode
                      ? 'text-[#c8c8c8] hover:text-[#888]'
                      : rowHeight === num
                        ? 'text-[#1d4ed8] font-black underline decoration-[1.5px] underline-offset-[3px]'
                        : 'text-[#888] hover:text-black'
                  }
                >
                  {num}px
                </button>
              ))}
            </div>

            <div className="peri-toolbar-group">
              <span className={`peri-control-label ${isMaxMode ? 'text-[#c8c8c8]' : 'text-[#6a716b]'}`}>Items per page</span>
              {Array.from(new Set([...LIMIT_OPTIONS, ...(isMaxMode ? [MAX_MODE_LIMIT] : []), limit])).sort((a, b) => a - b).map(num => (
                <button
                  key={num}
                  onClick={() => {
                    if (isMaxMode && num !== MAX_MODE_LIMIT) setRowHeight(250);
                    setLimit(num);
                    setPage(1);
                  }}
                  className={
                    isMaxMode
                      ? num === MAX_MODE_LIMIT
                        ? 'text-[#1d4ed8] font-black underline decoration-[1.5px] underline-offset-[3px]'
                        : 'text-[#C8C8C8] hover:text-[#888]'
                      : limit === num
                        ? 'text-[#1d4ed8] font-black underline decoration-[1.5px] underline-offset-[3px]'
                        : 'text-[#888] hover:text-black'
                  }
                >
                  {num}
                </button>
              ))}
              <button
                type="button"
                onClick={() => {
                  if (isMaxMode) {
                    setRowHeight(250);
                    setLimit(25);
                  } else {
                    setRowHeight(MAX_MODE_ROW_HEIGHT);
                    setLimit(MAX_MODE_LIMIT);
                  }
                  setPage(1);
                }}
                className={`peri-control-label ml-3 ${isMaxMode ? 'text-[#1d4ed8] font-black underline decoration-[1.5px] underline-offset-[3px]' : 'text-[#6a716b] hover:text-black'}`}
              >
                Max Mode
              </button>
              <button
                type="button"
                onClick={() => {
                  setIncludeOtherFiles(prev => !prev);
                  setPage(1);
                }}
                className={`peri-control-label ml-5 ${includeOtherFiles ? 'text-[#1d4ed8] font-black underline decoration-[1.5px] underline-offset-[3px]' : 'text-[#6a716b] hover:text-black'}`}
              >
                Include Others
              </button>
            </div>

            {sourceMode === 'server' && (
              <div className="peri-toolbar-group">
                <span className="peri-control-label">Share Code</span>
                <div className="flex items-center gap-1.5">
                  <input
                    type="text"
                    maxLength={4}
                    placeholder="CODE"
                    value={shareCodeInput}
                    onChange={e => {
                      setShareCodeInput(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, ''));
                      if (shareCodeError) setShareCodeError('');
                      if (shareCodeNotice) setShareCodeNotice('');
                    }}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && shareCodeInput.length === 4 && !isValidatingCode) {
                        handleOpenShareCode();
                      }
                    }}
                  className="peri-input px-2 py-0.5 text-[11px] uppercase w-16 text-center font-sans placeholder:text-gray-300"
                />
                <button
                  onClick={handleOpenShareCode}
                  disabled={shareCodeInput.length !== 4 || isValidatingCode}
                  className="peri-button px-2 py-0.5 text-[11px] uppercase disabled:opacity-50 min-w-[32px] text-center"
                >
                  {isValidatingCode ? '...' : 'Go'}
                </button>
                <button
                  onClick={handleLoadShareCode}
                  disabled={shareCodeInput.length !== 4 || isValidatingCode}
                  className="peri-button--secondary px-2 py-0.5 text-[11px] uppercase disabled:opacity-50 min-w-[52px] text-center"
                >
                  Load
                </button>
                </div>
                {shareCodeError && (
                  <span className="text-red-600 font-bold text-[11px] uppercase ml-1 animate-pulse">
                    {shareCodeError}
                  </span>
                )}
              </div>
            )}
          </div>

              <div className="peri-inline-actions gap-4">
              <div className="peri-toolbar-group">
                <span className="peri-control-label">Library</span>
                <button
                  type="button"
                  onClick={resetToServerLibrary}
                  className={`peri-toggle px-2 py-0.5 text-[10px] uppercase ${sourceMode === 'server' ? 'is-active' : ''}`}
                >
                  Server Library
                </button>
                <button
                  type="button"
                  onClick={() => void handleOpenLocalFolder()}
                  className={`peri-toggle px-2 py-0.5 text-[10px] uppercase max-w-[220px] truncate ${sourceMode === 'local' ? 'is-active' : ''}`}
                  title={sourceMode === 'local' ? 'Change local folder' : 'Open local folder'}
                >
                  {sourceMode === 'local' ? (localFolderLabel || 'Local Folder') : 'Open Local Folder'}
                </button>
              </div>

                <div className="peri-toolbar-group">
                  <span className="peri-control-label">Global Tag</span>
                  <select
                    value={selectedTag}
                    onChange={e => {
                      setSelectedTag(e.target.value);
                      setSelectedList('');
                      setSearchQuery('');
                      setDebouncedSearch('');
                      setPage(1);
                    }}
                      className="peri-select px-2 py-0.5 text-[11px] cursor-pointer"
                  >
                    <option value="">All Items</option>
                    {allTags.map(tag => (
                      <option key={tag} value={tag}>
                        #{tag}
                      </option>
                    ))}
                  </select>
                  {selectedTag && (
                    <span className="text-[10px] text-[#8A5A44]">
                      showing matches across all folders
                    </span>
                  )}
                </div>

                <div className="peri-toolbar-group">
                  <span className="peri-control-label">Filter by List</span>
                  <select
                    value={selectedList}
                    onChange={e => {
                      setSelectedList(e.target.value);
                      setSelectedTag('');
                      setSearchQuery('');
                      setDebouncedSearch('');
                      setPage(1);
                    }}
                      className="peri-select px-2 py-0.5 text-[11px] cursor-pointer"
                  >
                    <option value="">All Items</option>
                    {allShares.map(share => (
                      <option key={share.id} value={share.id}>
                        {share.title || share.id}
                      </option>
                    ))}
                  </select>
                </div>

              <div className="peri-toolbar-group">
                <span className="peri-control-label">Search</span>
                <div className="flex items-center gap-1.5">
                  <input
                    type="text"
                    placeholder="SEARCH GALLERY..."
                    value={searchQuery}
                    onChange={e => {
                      setSearchQuery(e.target.value);
                    }}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        submitSearch();
                      }
                    }}
                    className="peri-input px-2 py-0.5 text-[11px] w-36 sm:w-48 font-sans placeholder:text-gray-300"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => {
                        if (isGlobalSearch) {
                          returnToLastFolderLocation();
                          return;
                        }
                        setSearchQuery('');
                        setDebouncedSearch('');
                      }}
                      className="peri-button px-2 py-0.5 text-[11px] uppercase"
                    >
                      {isGlobalSearch ? 'Back' : 'Clear'}
                    </button>
                  )}
                  <button
                    onClick={submitSearch}
                    disabled={searchQuery.trim().length < 4}
                    className="peri-button--secondary px-2 py-0.5 text-[11px] uppercase disabled:opacity-50"
                  >
                    Search
                  </button>
                </div>
              </div>

            </div>

            <div className="peri-toolbar-group min-h-[26px] flex-wrap sm:flex-nowrap">
              <span className="peri-control-label">Selection</span>
              <button onClick={handleSelectAll} className="font-sans text-[0.82rem] font-semibold text-[#6a716b] hover:text-black">Select Page</button>
              <button onClick={handleDeselectAll} className="font-sans text-[0.82rem] font-semibold text-[#6a716b] hover:text-black">Deselect Page</button>
              {selectedImages.size > 0 && (
                <button onClick={() => setSelectedImages(new Set())} className="font-sans text-[0.82rem] font-semibold text-[#6a716b] hover:text-black">Clear All</button>
              )}
              
              <span className="text-[#DDD]">|</span>
              <button
                onClick={() => {
                  setShowSelectedOnly(!showSelectedOnly);
                  setPage(1);
                }}
                disabled={selectedImages.size === 0}
                className={`peri-toggle flex items-center gap-1 px-1.5 py-0.5 text-[10px] uppercase ${showSelectedOnly ? 'is-active' : ''} disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {showSelectedOnly ? 'Showing Selected Only' : 'Show Selected Only'}
              </button>
              
              {selectedImages.size > 0 && (
                <div className="flex items-center gap-2 relative">
                  {/* Tags Dropdown Button */}
                  <div className="relative" ref={tagsRef}>
                    <button
                      onClick={() => {
                        setShowTagsPopover(!showTagsPopover);
                        setShowListsPopover(false);
                      }}
                      className={`peri-toggle flex items-center gap-1.5 px-2.5 py-1 text-[11px] uppercase ${showTagsPopover ? 'is-active' : ''}`}
                    >
                      <Tag size={12} />
                      Tags
                    </button>
                    {showTagsPopover && (
                      <div className="peri-popover absolute left-0 mt-1.5 z-50 w-64 text-black normal-case font-sans">
                        <div className="peri-popover__header p-2 flex items-center gap-1.5">
                          <Search size={12} className="text-[#888]" />
                          <input
                            type="text"
                            value={tagSearch}
                            onChange={e => setTagSearch(e.target.value)}
                            placeholder="Filter tags..."
                            onKeyDown={e => {
                              if (!showTagsPopover) return;
                              const count = filteredTagOptions.length + (canCreateTagCandidate ? 1 : 0);
                              if (!count) return;

                              if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                                e.preventDefault();
                                setActiveTagIndex(prev => {
                                  const direction = e.key === 'ArrowDown' ? 1 : -1;
                                  const next = (prev + direction + count) % count;
                                  return next;
                                });
                              }

                              if (e.key === 'Enter') {
                                e.preventDefault();
                                if (filteredTagOptions.length > 0 && activeTagIndex < filteredTagOptions.length) {
                                  void handleCommitTagPopoverChoice(filteredTagOptions[activeTagIndex]);
                                  return;
                                }
                                if (canCreateTagCandidate) {
                                  void handleCommitTagPopoverChoice(createTagCandidate);
                                }
                              }

                              if (e.key === 'Escape') {
                                setShowTagsPopover(false);
                              }
                            }}
                            className="w-full bg-transparent text-[11px] font-sans focus:outline-none placeholder-gray-400 font-bold uppercase"
                            onClick={e => e.stopPropagation()}
                          />
                          {tagSearch && (
                            <button onClick={() => setTagSearch('')} className="hover:text-red-500 font-bold text-[13px]">
                              <X size={13} />
                            </button>
                          )}
                        </div>
                        <div className="max-h-48 overflow-y-auto divide-y divide-[#DDD] font-sans text-[10px] lowercase">
                          {filteredTagOptions.map((tagName, index) => {
                              const { checked, indeterminate } = getTagState(tagName);
                              return (
                                <button
                                  key={tagName}
                                  onClick={() => void handleCommitTagPopoverChoice(tagName)}
                                  className={`w-full text-left px-2.5 py-2 transition-colors flex items-center justify-between group ${activeTagIndex === index ? 'bg-black text-white' : 'hover:bg-black hover:text-white'}`}
                                >
                                  <span className="truncate">#{tagName}</span>
                                  <span className="shrink-0 flex items-center justify-center w-4 h-4 border border-[#DDD] group-hover:border-white">
                                    {checked ? (
                                      <Check size={10} strokeWidth={3} />
                                    ) : indeterminate ? (
                                      <Minus size={10} strokeWidth={3} />
                                    ) : null}
                                  </span>
                                </button>
                              );
                            })}
                          
                          {/* Option to create new tag if query doesn't match */}
                          {canCreateTagCandidate && (
                            <button
                              onClick={() => void handleCommitTagPopoverChoice(createTagCandidate)}
                              className={`w-full text-left px-2.5 py-2 transition-colors flex items-center gap-1.5 text-black bg-[#FFFBEB] font-bold ${activeTagIndex === filteredTagOptions.length ? 'bg-black text-white' : 'hover:bg-black hover:text-white'}`}
                            >
                              <Plus size={10} strokeWidth={3} />
                              <span>Create tag "{createTagCandidate}"</span>
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Lists Dropdown Button */}
                  <div className="relative" ref={listsRef}>
                    <button
                      onClick={() => {
                        setShowListsPopover(!showListsPopover);
                        setShowTagsPopover(false);
                      }}
                      className={`peri-toggle flex items-center gap-1.5 px-2.5 py-1 text-[11px] uppercase ${showListsPopover ? 'is-active' : ''}`}
                    >
                      <List size={12} />
                      Lists
                    </button>
                    {showListsPopover && (
                      <div className="peri-popover absolute left-0 mt-1.5 z-50 w-64 text-black normal-case font-sans">
                        <div className="peri-popover__header p-2 flex items-center gap-1.5">
                          <Search size={12} className="text-[#888]" />
                          <input
                            type="text"
                            value={listSearch}
                            onChange={e => setListSearch(e.target.value)}
                            placeholder="Filter lists..."
                            onKeyDown={e => {
                              if (!showListsPopover) return;
                              const count = filteredListOptions.length + (canCreateListCandidate ? 1 : 0);
                              if (!count) return;

                              if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                                e.preventDefault();
                                setActiveListIndex(prev => {
                                  const direction = e.key === 'ArrowDown' ? 1 : -1;
                                  const next = (prev + direction + count) % count;
                                  return next;
                                });
                              }

                              if (e.key === 'Enter') {
                                e.preventDefault();
                                if (filteredListOptions.length > 0 && activeListIndex < filteredListOptions.length) {
                                  void handleCommitListPopoverChoice(filteredListOptions[activeListIndex].id);
                                  return;
                                }
                                if (canCreateListCandidate) {
                                  void handleCreateListBulk(createListCandidate);
                                  setShowListsPopover(false);
                                  setListSearch('');
                                  setActiveListIndex(0);
                                }
                              }

                              if (e.key === 'Escape') {
                                setShowListsPopover(false);
                              }
                            }}
                            className="w-full bg-transparent text-[11px] font-sans focus:outline-none placeholder-gray-400 font-bold uppercase"
                            onClick={e => e.stopPropagation()}
                          />
                          {listSearch && (
                            <button onClick={() => setListSearch('')} className="hover:text-red-500 font-bold text-[13px]">
                              <X size={13} />
                            </button>
                          )}
                        </div>
                        <div className="max-h-48 overflow-y-auto divide-y divide-[#DDD] font-sans text-[10px] uppercase">
                          {filteredListOptions.map((share, index) => {
                              const { checked, indeterminate } = getListState(share.id);
                              return (
                                <button
                                  key={share.id}
                                  onClick={() => void handleCommitListPopoverChoice(share.id)}
                                  className={`w-full text-left px-2.5 py-2 transition-colors flex items-center justify-between group ${activeListIndex === index ? 'bg-black text-white' : 'hover:bg-black hover:text-white'}`}
                                >
                                  <span className="truncate flex-1 mr-2">{share.title}</span>
                                  <span className="text-[9px] text-gray-400 group-hover:text-gray-300 mr-2 shrink-0">({share.itemCount} items)</span>
                                  <span className="shrink-0 flex items-center justify-center w-4 h-4 border border-[#DDD] group-hover:border-white">
                                    {checked ? (
                                      <Check size={10} strokeWidth={3} />
                                    ) : indeterminate ? (
                                      <Minus size={10} strokeWidth={3} />
                                    ) : null}
                                  </span>
                                </button>
                              );
                            })}
                          
                          {/* Option to create new list if query doesn't match */}
                          {canCreateListCandidate && (
                            <button
                              onClick={() => handleCreateListBulk(createListCandidate)}
                              className={`w-full text-left px-2.5 py-2 transition-colors flex items-center gap-1.5 text-black bg-[#FFFBEB] font-bold ${activeListIndex === filteredListOptions.length ? 'bg-black text-white' : 'hover:bg-black hover:text-white'}`}
                            >
                              <Plus size={10} strokeWidth={3} />
                              <span>Create list "{createListCandidate}"</span>
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {visibleEntries.length > 0 && (
                <button
                  onClick={() => {
                    setView('staging');
                  }}
                  disabled={isDownloading || selectedImages.size === 0}
                  className="ml-auto bg-black text-white px-3 py-1.5 flex items-center gap-2 hover:bg-[#333] disabled:bg-[#888] transition-colors border-[2px] border-black"
                >
                  <Download size={14} strokeWidth={2.5} />
                  Stage {selectedImages.size} Items
                </button>
              )}
            </div>
          </div>
        )}

        {!showPrivateGate && (
          <div className="mb-6 flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              {currentPath && (
                <button
                  onClick={() => {
                    const parts = currentPath.split('/');
                    parts.pop();
                    navigateToPath(parts.join('/'));
                  }}
                  className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider hover:text-[#F27D26] transition-colors w-fit"
                >
                  <ArrowLeft size={14} strokeWidth={2.5} />
                  Back to {currentPath.includes('/') ? currentPath.split('/').slice(0, -1).pop() : 'Root'}
                </button>
              )}
              {showSelectedOnly && (
                <>
                  <span className="text-[#DDD]">|</span>
                  <span className="border-[2px] border-black bg-white px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-black">
                    Selected Only
                  </span>
                  <button
                  onClick={() => {
                    queueHistoryUpdate('replace');
                    setShowSelectedOnly(false);
                    setPage(1);
                  }}
                    className="text-xs font-bold uppercase tracking-wider text-[#888] hover:text-black transition-colors"
                  >
                    Back to Full Gallery
                  </button>
                </>
              )}
            </div>
            <div className="font-sans text-xs font-bold uppercase tracking-wider text-[#666] flex flex-wrap items-center gap-y-1">
              {selectedTag ? (
                <>
                  <span>Global Tag:&nbsp;</span>
                  <span className="text-black">#{selectedTag}</span>
                  <span className="ml-2 text-[#8A5A44]">across all folders</span>
                  <button
                    onClick={() => {
                      setSelectedTag('');
                      setPage(1);
                    }}
                    className="ml-2 text-[#888] transition-colors hover:text-black"
                  >
                    Clear Tag
                  </button>
                </>
              ) : (
                <>
                  <span>Location:&nbsp;</span>
                  <span className="text-black">
                    <button
                      onClick={() => navigateToPath('')}
                      className="hover:text-[#F27D26] transition-colors"
                    >
                      root
                    </button>
                    {currentPath &&
                      currentPath.split('/').map((part, index, parts) => {
                        const path = parts.slice(0, index + 1).join('/');
                        return (
                          <React.Fragment key={path}>
                            <span className="text-[#666]"> / </span>
                            <button
                              onClick={() => navigateToPath(path)}
                              className="hover:text-[#F27D26] transition-colors"
                            >
                              {part}
                            </button>
                          </React.Fragment>
                        );
                      })}
                  </span>
                </>
              )}
              {debouncedSearch && (
                <span className="text-[#8A5A44] ml-2">
                  {isGlobalSearch ? `(Global search: "${debouncedSearch}")` : `(Searching: "${debouncedSearch}")`}
                </span>
              )}
            </div>
            {(shareCodeNotice || locationNotice) && (
              <div className={`text-[10px] font-bold uppercase tracking-widest ${locationNotice ? 'text-[#8A5A44]' : 'text-[#666]'}`}>
                {shareCodeNotice || locationNotice}
              </div>
            )}
            {isGlobalSearch && (
              <div className="mt-2 flex flex-wrap items-center justify-between gap-3 border-[2px] border-[#666] bg-white px-3 py-2 text-[10px] font-bold uppercase tracking-widest">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="text-[#888]">Search Results</span>
                  <span className="text-black">"{debouncedSearch}"</span>
                  <span className="text-[#8A5A44]">{serverTotalItems} items</span>
                </div>
                <button
                  type="button"
                  onClick={returnToLastFolderLocation}
                  className="text-[#888] hover:text-black transition-colors underline"
                >
                  Back to folder
                </button>
              </div>
            )}
            {(folderTitleInput.trim() || folderDescriptionInput.trim() || canEditServerFolders) && (
              <div className="mt-2 flex flex-wrap items-start gap-x-3 gap-y-1 text-[11px] font-sans">
                <div className="min-w-0 max-w-full flex flex-col gap-0.5">
                  {folderTitleInput.trim() && (
                    <div className="font-bold text-black tracking-wide">
                      {folderTitleInput.trim()}
                    </div>
                  )}
                  {folderDescriptionInput.trim() && (
                    <div className="max-w-4xl text-[#555] leading-relaxed">
                      {folderDescriptionInput.trim()}
                    </div>
                  )}
                </div>
                {currentPath && canEditServerFolders && (
                  <button
                    type="button"
                    onClick={() => {
                      setFolderQuickEditPath(currentPath);
                      setFolderQuickEditTitle(folderTitleInput);
                      setFolderQuickEditDescription(folderDescriptionInput);
                      setFolderQuickVisibleToUsers(folderQuickVisibleToUsers);
                      setFolderQuickVisibleToAdmins(folderQuickVisibleToAdmins);
                      setFolderQuickEditStatus('idle');
                    }}
                    className="text-[10px] font-bold uppercase tracking-widest text-[#888] hover:text-black transition-colors underline"
                  >
                    Edit
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {displayFolders.length > 0 && (
          <div className="mb-8">
            <div className="flex items-center justify-between gap-4 mb-4">
              <h2 className="peri-section-title">Folders</h2>
              <label className="flex items-center gap-2 cursor-pointer font-sans text-[0.82rem] font-semibold text-[#6a716b] hover:text-black transition-colors">
                <input
                  type="checkbox"
                  checked={showFolderThumbnails}
                  onChange={event => setShowFolderThumbnails(event.target.checked)}
                  className="w-4 h-4 accent-black border-[2px] border-[#666]"
                />
                Show Folder Thumbnails
              </label>
            </div>

            <div className="flex flex-wrap gap-4 items-start">
              {displayFolders.map(folder => {
                const leftPreviewPath = folder.thumbnailPath || folder.cover1Path || null;
                const rightPreviewPath = folder.secondaryThumbnailPath || folder.cover2Path || null;
                const leftPreviewKind = folder.thumbnailKind || (leftPreviewPath ? getMediaKind(leftPreviewPath) : null);
                const rightPreviewKind = folder.secondaryThumbnailKind || (rightPreviewPath ? getMediaKind(rightPreviewPath) : null);
                const folderRetryKey = `folder:${folder.path}:${leftPreviewPath ?? 'empty'}:${rightPreviewPath ?? 'empty'}`;
                const folderRetryToken = previewRetryTokens[folderRetryKey] || 0;

                return (
                <div
                  key={folder.path}
                  role="button"
                  tabIndex={0}
                  onClick={() => {
                    navigateToPath(folder.path);
                  }}
                  onKeyDown={e => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      navigateToPath(folder.path);
                    }
                  }}
                  className="peri-card relative flex flex-col overflow-hidden group text-left cursor-pointer touch-manipulation flex-1 min-w-[240px] max-w-[420px]"
                  style={{ flexBasis: 'clamp(240px, 24vw, 380px)' }}
                >
                  {canEditServerFolders && (
                    <button
                      type="button"
                      onClick={event => {
                        event.stopPropagation();
                        setFolderQuickEditPath(folder.path);
                        setFolderQuickEditTitle(folder.title || '');
                        setFolderQuickEditDescription(folder.description || '');
                        setFolderQuickVisibleToUsers(folder.visibleToUsers);
                        setFolderQuickVisibleToAdmins(folder.visibleToAdmins);
                        setFolderQuickEditStatus('idle');
                      }}
                       className="absolute right-2 top-2 z-10 rounded-full border border-[#d4d4d8] bg-white/95 px-2 py-1 text-[9px] font-bold uppercase tracking-widest text-black opacity-0 transition-opacity group-hover:opacity-100 hover:border-[#9faab4] hover:bg-[#f8fafc]"
                    >
                      <span className="flex items-center gap-1">
                        <PencilLine size={10} strokeWidth={2.2} />
                        Edit
                      </span>
                    </button>
                  )}
                  {showFolderThumbnails ? (
                    <div
                      data-image-container
                      className="peri-card__divider w-full bg-[#eef2f6] overflow-hidden"
                      style={{ height: `${Math.max(120, Math.min(220, rowHeight - 30))}px` }}
                    >
                      <div className="grid h-full grid-cols-2">
                        {[
                          { path: leftPreviewPath, kind: leftPreviewKind, slot: 'left' as const },
                          { path: rightPreviewPath, kind: rightPreviewKind, slot: 'right' as const },
                        ].map(({ path: previewPath, kind: previewKind, slot }, index) => {
                          const slotKey = `${folderRetryKey}:${slot}`;
                          const slotRetryToken = previewRetryTokens[slotKey] || 0;
                          const isLast = index === 0;

                          return (
                            <div
                              key={slot}
                              className={`${isLast ? 'border-r' : ''} border-[#d4d4d8] h-full overflow-hidden`}
                            >
                              {previewPath && previewKind === 'image' ? (
                                <>
                                  <img
                                    src={getResolvedThumbUrl(previewPath, folderThumbnailHeight, folderThumbnailHeight * 2, slotRetryToken)}
                                    alt={`${folder.name} ${slot}`}
                                    loading="lazy"
                                    referrerPolicy="no-referrer"
                                    className="h-full w-full object-cover"
                                    onLoad={handleImageLoad}
                                    onError={(event) => handleThumbImageError(event, getResolvedImageUrl(previewPath, slotRetryToken))}
                                  />
                                  <div
                                    data-image-fallback
                                    className="hidden h-full w-full flex-col items-center justify-center gap-2 bg-[#F3F3F3] px-4 text-center text-[#666]"
                                  >
                                    <FolderOpen size={28} className="text-black" />
                                    <span className="text-[10px] font-bold uppercase tracking-widest">Preview Unavailable</span>
                                    <button
                                      type="button"
                                      onClick={(event) => {
                                        event.stopPropagation();
                                        resetImageFallback(event.currentTarget.closest('[data-image-container]'));
                                        setPreviewRetryTokens(prev => ({ ...prev, [slotKey]: (prev[slotKey] || 0) + 1 }));
                                      }}
                                      className="peri-button--secondary px-3 py-1 text-[10px] uppercase tracking-widest"
                                    >
                                      Retry
                                    </button>
                                  </div>
                                </>
                              ) : previewPath ? (
                                <div className={`flex flex-col items-center justify-center gap-2 w-full h-full px-3 ${getFileTypeTone(previewPath).accent}`}>
                                  <div className={`w-12 h-12 rounded-full border-[2px] flex items-center justify-center ${getFileTypeTone(previewPath).border} ${getFileTypeTone(previewPath).bg}`}>
                                    <FileImage size={20} strokeWidth={1.5} />
                                  </div>
                                  <div className="flex flex-col items-center gap-1 text-center">
                                    <span className="text-[10px] font-bold uppercase tracking-[0.25em]">
                                      {getFileTypeCode(previewPath)}
                                    </span>
                                    <span className="text-[9px] font-bold uppercase tracking-widest opacity-80">
                                      {includeOtherFiles ? 'File' : 'Image'}
                                    </span>
                                  </div>
                                </div>
                              ) : (
                                <div className="flex h-full flex-col items-center justify-center gap-2 text-[#666] bg-[#F3F3F3]">
                                  <FolderOpen size={24} className="text-black" />
                                  <span className="text-[9px] font-bold uppercase tracking-widest">Empty</span>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : null}
                  <div className={`p-4 flex items-center gap-3 ${showFolderThumbnails ? '' : 'min-h-[84px]'}`}>
                    {!showFolderThumbnails && <FolderOpen size={20} className="text-black shrink-0" />}
                    <div className="min-w-0 flex-1">
                      <span className="peri-card-name truncate block">{folder.name}</span>
                      {folder.title ? (
                        <span className="peri-card-title mt-0.5 block truncate">
                          {folder.title}
                        </span>
                      ) : null}
                      {folder.description ? (
                        <p className="peri-card-description mt-1 truncate" title={folder.description}>
                          {folder.description}
                        </p>
                      ) : null}
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        <span className="peri-chip px-1.5 py-0.5 font-sans text-[9px] font-bold uppercase tracking-widest text-[#666]">
                          {folder.folderCount} {folder.folderCount === 1 ? 'Folder' : 'Folders'}
                        </span>
                        <span className="peri-chip px-1.5 py-0.5 font-sans text-[9px] font-bold uppercase tracking-widest text-[#666]">
                          {folder.fileCount} {folder.fileCount === 1 ? 'File' : 'Files'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )})}
            </div>
          </div>
        )}

        <h2 className="peri-section-title mb-4">{includeOtherFiles ? 'Files' : 'Images'}</h2>
        {accessError ? (
          <div className="flex flex-col items-center justify-center h-[40vh] text-center max-w-md mx-auto gap-5">
            <div className="peri-card px-6 py-5 flex flex-col gap-3">
              <h2 className="font-sans text-2xl font-bold uppercase">Private Archive</h2>
              <p className="font-sans text-sm leading-relaxed text-[#666]">{accessError}</p>
              <div className="flex items-center justify-center gap-3">
                <button
                  onClick={() => {
                    setAccountPanel('auth');
                    setAuthMode('login');
                    setAuthError('');
                    setAuthMessage('');
                  }}
                  className="peri-button px-4 py-2 text-[11px] uppercase tracking-widest"
                >
                  {usesCentralAuth ? 'Open Auth' : 'Sign In'}
                </button>
                {!usesCentralAuth && !authStatus?.hasUsers && (
                  <button
                    onClick={() => {
                      setAccountPanel('auth');
                      setAuthMode('register');
                      setAuthError('');
                      setAuthMessage('');
                    }}
                    className="peri-button--secondary px-4 py-2 text-[11px] uppercase tracking-widest"
                  >
                    Create Admin
                  </button>
                )}
              </div>
            </div>
          </div>
        ) : showInitialLoading ? (
          <div className="flex items-center justify-center h-[40vh]">
            <div className="font-sans font-bold text-xl uppercase tracking-widest animate-pulse">Loading...</div>
          </div>
        ) : visibleEntries.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-[40vh] text-center max-w-md mx-auto">
            <div className="peri-card p-4 mb-6">
              <FolderOpen size={40} className="text-black" strokeWidth={1.5} />
            </div>
            <h2 className="font-sans text-2xl font-bold uppercase mb-3">{includeOtherFiles ? 'No files found' : 'No images found'}</h2>
            <p className="font-sans text-lg leading-relaxed">
              {sourceMode === 'local'
                ? 'Choose a local folder to browse files from your own computer in this session.'
                : <>Drop {includeOtherFiles ? 'files' : 'image files'} into the <code className="bg-white border border-[#666] px-1.5 py-0.5 text-sm font-sans">images</code> folder on the backend.</>}
            </p>
          </div>
        ) : (
          <div className="flex flex-wrap gap-4 sm:gap-6">
            {pagedEntries.map((entry, idx) => (
              (() => {
                const retryKey = `entry:${entry.path}`;
                const retryToken = previewRetryTokens[retryKey] || 0;
                return (
              <div
                key={entry.path || idx}
                className={`peri-card flex flex-col transition-all group ${selectedImages.has(entry.path) ? 'is-selected z-10' : ''}`}
              >
                <div
                  data-image-container
                  className={`peri-card__divider bg-[#eef2f6] relative flex items-center justify-center overflow-hidden cursor-pointer`}
                  style={{ height: `${rowHeight}px` }}
                  onClick={() => openLightbox(entry.path)}
                >
                  <button
                    onClick={e => toggleSelection(entry.path, e)}
                    className={`absolute top-2 left-2 z-20 w-6 h-6 border flex items-center justify-center transition-colors ${selectedImages.has(entry.path) ? 'bg-[#202522] border-[#202522]' : 'bg-white border-[#9faab4] hover:border-[#202522]'}`}
                  >
                    {selectedImages.has(entry.path) && <Check size={16} className="text-white" strokeWidth={3} />}
                  </button>
                  {entry.isMissing ? (
                    <div className="flex h-full w-full flex-col items-center justify-center gap-3 bg-[#F8F3F1] px-5 text-center text-[#8A5A44]">
                      <div className="border-[2px] border-[#B89D91] bg-white px-3 py-1 text-[10px] font-bold uppercase tracking-[0.25em]">
                        Missing
                      </div>
                      <div className="max-w-[180px] text-[11px] font-bold uppercase leading-relaxed text-[#7A5A49]">
                        This file was part of the share but is no longer available on the server.
                      </div>
                    </div>
                  ) : entry.kind === 'image' && isRenderable(entry.path) ? (
                    <>
                      <img
                        src={getResolvedThumbUrl(entry.path, rowHeight, rowHeight * 2, retryToken)}
                        alt={entry.path}
                        loading="lazy"
                        referrerPolicy="no-referrer"
                        className="h-full w-auto object-contain p-2"
                        onLoad={handleImageLoad}
                        onError={(event) => handleThumbImageError(event, getResolvedImageUrl(entry.path, retryToken))}
                      />
                      <div
                        data-image-fallback
                        className="hidden h-full w-full flex-col items-center justify-center gap-3 bg-[#F8F3F1] px-5 text-center text-[#8A5A44]"
                      >
                        <div className="border-[2px] border-[#B89D91] bg-white px-3 py-1 text-[10px] font-bold uppercase tracking-[0.25em]">
                          Preview
                        </div>
                        <div className="max-w-[180px] text-[11px] font-bold uppercase leading-relaxed text-[#7A5A49]">
                          This image preview is unavailable right now.
                        </div>
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            resetImageFallback(event.currentTarget.closest('[data-image-container]'));
                            setPreviewRetryTokens(prev => ({ ...prev, [retryKey]: (prev[retryKey] || 0) + 1 }));
                          }}
                          className="border-[2px] border-[#8A5A44] bg-white px-3 py-1 text-[10px] font-bold uppercase tracking-widest hover:bg-[#8A5A44] hover:text-white transition-colors"
                        >
                          Retry
                        </button>
                      </div>
                      {entry.is_large && (
                        <div className="absolute top-2 right-2 z-20 bg-yellow-400 text-black border-[2px] border-black px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                          Lrg
                        </div>
                      )}
                      {(folderCoverPaths.cover1Path === entry.path || folderCoverPaths.cover2Path === entry.path) && (
                        <div
                          className="absolute bottom-2 right-2 z-20 bg-black text-white border-[2px] border-black px-1.5 py-0.5 flex items-center gap-1 text-[9px] font-black uppercase tracking-wider shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] pointer-events-none"
                          title="This image is the folder cover"
                        >
                          <BookImage size={10} strokeWidth={2.5} />
                          Cover
                        </div>
                      )}
                    </>
                  ) : (
                    <div className={`flex flex-col items-center justify-center gap-3 w-48 h-full px-5 ${getFileTypeTone(entry.path).accent}`}>
                      <div className={`w-16 h-16 rounded-full border-[2px] flex items-center justify-center ${getFileTypeTone(entry.path).border} ${getFileTypeTone(entry.path).bg}`}>
                        <FileImage size={28} strokeWidth={1.5} />
                      </div>
                      <div className="flex flex-col items-center gap-1 text-center">
                        <span className="text-[11px] font-bold uppercase tracking-[0.25em]">
                          {getFileTypeCode(entry.path)}
                        </span>
                        <span className="text-[10px] font-bold uppercase tracking-widest opacity-80">
                          {getFileTypeTone(entry.path).label}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
                <div className="p-3 bg-white shrink-0" style={{ width: '0', minWidth: '100%' }}>
                  <p
                    className={`peri-card-name truncate w-full block ${selectedImages.has(entry.path) ? 'text-black' : 'text-[#6a716b]'}`}
                    title={entry.path}
                  >
                    {entry.name}
                  </p>
                  {isGlobalSearch && entry.folderPath ? (
                    <button
                      type="button"
                      onClick={event => {
                        event.stopPropagation();
                        navigateToPath(entry.folderPath === 'root' ? '' : entry.folderPath);
                      }}
                       className="peri-path-link mt-1 block max-w-full truncate text-left transition-colors hover:text-black hover:underline"
                      title={`Open folder: ${entry.folderPath}`}
                    >
                      {entry.folderPath}
                    </button>
                  ) : selectedTag && (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedTag('');
                        navigateToPath(dirname(entry.path) === 'root' ? '' : dirname(entry.path));
                      }}
                       className="peri-path-link mt-1 block max-w-full truncate text-left transition-colors hover:text-black hover:underline"
                      title={`Open folder: ${dirname(entry.path)}`}
                    >
                      {dirname(entry.path)}
                    </button>
                  )}
                  {entry.isMissing && (
                    <p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-[#8A5A44]">
                      Missing from library
                    </p>
                  )}
                </div>
              </div>
              )})()
            ))}
          </div>
        )}

        {loadingOverlayVisible && !accessError && (
          <div
            className={`fixed inset-0 z-[24] pointer-events-none flex items-center justify-center transition-opacity ${loading ? 'duration-100' : 'duration-50'} bg-[#AFAFAF]/40 ${loading ? 'opacity-100' : 'opacity-0'}`}
          >
            <div className="rounded-full border-[2px] border-[#6B6B6B] bg-[#E5E5E5]/80 px-4 py-2 text-[11px] font-bold uppercase tracking-[0.35em] text-black backdrop-blur-sm">
              LOADING
            </div>
          </div>
        )}
      </main>

      {folderQuickEditPath && (
        <div
          className="fixed inset-0 z-[68] bg-[#F0F0F0]/94 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setFolderQuickEditPath('')}
        >
          <div
            className="peri-card w-full max-w-[640px]"
            onClick={event => event.stopPropagation()}
          >
            <div className="peri-card__divider flex items-center justify-between px-4 py-3 bg-[#fafafa]">
              <div className="min-w-0">
                <h2 className="font-sans text-sm font-bold uppercase tracking-wide">Edit Folder</h2>
                <p className="mt-0.5 text-[10px] font-sans text-[#888] truncate">{folderQuickEditPath}</p>
              </div>
              <button
                onClick={() => setFolderQuickEditPath('')}
                className="text-[#888] hover:text-black transition-colors"
              >
                <X size={18} strokeWidth={2.25} />
              </button>
            </div>

            <div className="p-4 flex flex-col gap-4">
              <label className="flex flex-col gap-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#888]">Title</span>
                <input
                  type="text"
                  value={folderQuickEditTitle}
                  onChange={e => setFolderQuickEditTitle(e.target.value)}
                  placeholder="Folder title"
                  className="peri-input bg-[#fafafa] px-3 py-2 text-sm"
                />
              </label>

              <label className="flex flex-col gap-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#888]">Description</span>
                <textarea
                  value={folderQuickEditDescription}
                  onChange={e => setFolderQuickEditDescription(e.target.value)}
                  placeholder="Folder description"
                  rows={4}
                  className="peri-input bg-[#fafafa] px-3 py-2 text-sm resize-y"
                />
              </label>

              <div className="peri-card__divider border-[1px] border-[#d4d4d8] bg-[#fafafa] px-3 py-3">
                <div className="mb-2 text-[10px] font-bold uppercase tracking-wider text-[#888]">Access</div>
                <div className="grid gap-2 font-sans text-[12px] font-bold uppercase tracking-wider text-black sm:grid-cols-3">
                  {folderQuickParentAccess.visibleToUsers ? (
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={folderQuickVisibleToUsers}
                        onChange={event => setFolderQuickVisibleToUsers(event.target.checked)}
                        className="h-4 w-4 accent-black"
                      />
                      User
                    </label>
                  ) : (
                    <div className="flex items-center gap-2 text-[#888]">
                      <Minus size={14} strokeWidth={2.25} />
                      User inherited off
                    </div>
                  )}
                  {folderQuickParentAccess.visibleToAdmins ? (
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={folderQuickVisibleToAdmins}
                        onChange={event => setFolderQuickVisibleToAdmins(event.target.checked)}
                        className="h-4 w-4 accent-black"
                      />
                      Reg Admin
                    </label>
                  ) : (
                    <div className="flex items-center gap-2 text-[#888]">
                      <Minus size={14} strokeWidth={2.25} />
                      Reg Admin inherited off
                    </div>
                  )}
                  <div className="flex items-center gap-2 text-[#666]">
                    <Check size={14} strokeWidth={2.25} />
                    Pref Admin
                  </div>
                </div>
                <div className="mt-3 border-t border-[#d4d4d8] pt-3">
                  <div className="mb-2 text-[10px] font-bold uppercase tracking-wider text-[#888]">Approved Accounts</div>
                  {folderQuickApprovedUsers.length === 0 ? (
                    <p className="font-sans text-[12px] text-[#777]">No approved accounts are available.</p>
                  ) : (
                    <div className="grid gap-2 font-sans text-[12px] sm:grid-cols-2">
                      {folderQuickApprovedUsers.map(user => {
                        const userId = String(user.id);
                        const parentAllowsAccount = folderQuickParentAccess.accounts[userId] ?? true;
                        const locked = Boolean(user.isOwner) || !parentAllowsAccount;
                        const levelAllowsAccount = user.isAdmin ? folderQuickVisibleToAdmins : folderQuickVisibleToUsers;
                        const currentMode = folderQuickAccountAccess[userId];
                        const inheritedLabel = levelAllowsAccount ? 'Inherit: allowed' : 'Inherit: denied';
                        const effectiveLabel = user.isOwner
                          ? 'Always allowed'
                          : !parentAllowsAccount
                            ? 'Inherited deny from parent'
                            : currentMode === 'allow'
                              ? 'Explicit allow'
                              : currentMode === 'deny'
                                ? 'Explicit deny'
                                : inheritedLabel;
                        const role = user.isOwner ? 'Pref Admin' : user.isAdmin ? 'Reg Admin' : 'User';
                        const setAccountMode = (mode: FolderAccountAccessMode | 'inherit') => {
                          setFolderQuickAccountAccess(prev => {
                            const next = { ...prev };
                            if (mode === 'inherit') {
                              delete next[userId];
                            } else {
                              next[userId] = mode;
                            }
                            return next;
                          });
                        };

                        return (
                          <div
                            key={userId}
                            className={`flex flex-col gap-2 border border-[#d4d4d8] bg-white px-2.5 py-2 ${locked ? 'text-[#999]' : 'text-black'}`}
                          >
                            <div className="min-w-0">
                              <span className="block truncate font-bold">{user.username}</span>
                              <span className="block text-[10px] uppercase tracking-wider text-[#888]">
                                {role} / {effectiveLabel}
                              </span>
                            </div>
                            <div className="grid grid-cols-3 gap-1 text-[9px] font-bold uppercase tracking-widest">
                              {(['inherit', 'allow', 'deny'] as const).map(mode => {
                                const active = mode === 'inherit' ? currentMode == null : currentMode === mode;
                                return (
                                  <button
                                    key={mode}
                                    type="button"
                                    disabled={locked}
                                    onClick={() => setAccountMode(mode)}
                                    className={`border px-2 py-1 transition-colors ${
                                      active
                                        ? mode === 'deny'
                                          ? 'border-[#8A1F1F] bg-[#F6E2E2] text-[#8A1F1F]'
                                          : 'border-black bg-black text-white'
                                        : 'border-[#d4d4d8] bg-[#fafafa] text-[#777] hover:border-black hover:text-black'
                                    } disabled:border-[#d4d4d8] disabled:bg-[#f2f2f2] disabled:text-[#aaa] disabled:cursor-not-allowed`}
                                  >
                                    {mode}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={saveQuickFolderDetails}
                  disabled={folderQuickEditStatus === 'saving'}
                  className="peri-button px-3 py-2 text-[10px] uppercase tracking-widest disabled:bg-[#888] disabled:border-[#888] disabled:cursor-not-allowed"
                >
                  {folderQuickEditStatus === 'saving' ? 'Saving...' : folderQuickEditStatus === 'saved' ? 'Saved' : 'Save Folder'}
                </button>
                <button
                  onClick={() => setFolderQuickEditPath('')}
                  className="text-[10px] font-bold uppercase tracking-widest text-[#888] hover:text-black transition-colors underline"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {!showPrivateGate && (
        <footer className="page-banner page-banner--bottom">
          <div className="page-banner__inner shell-frame">
          <div className="font-sans text-[13px] font-bold uppercase tracking-wider text-[#202522]">
            PAGE {page} OF {computedTotalPages} / {selectedImages.size > 0 ? <span className="text-black bg-[#e0e0e0] px-1.5 py-0.5 mr-1">{selectedImages.size} SELECTED /</span> : null} {pagedEntries.length} SHOWN / {totalVisibleItems} TOTAL
          </div>
          <div className="flex items-center gap-1 font-sans text-[13px] font-bold uppercase tracking-wider whitespace-nowrap text-[#202522]">
            {previousSiblingFolder && (
              <button
                type="button"
                onClick={() => navigateToPath(previousSiblingFolder.path)}
                className="max-w-[18rem] truncate text-left text-[#666] hover:text-black hover:underline transition-colors"
                title={previousSiblingFolder.title || previousSiblingFolder.name}
              >
                {previousSiblingFolder.title || previousSiblingFolder.name}
              </button>
            )}

            {previousSiblingFolder && (computedTotalPages > 1 || nextSiblingFolder) && (
              <span className="select-none px-0.5 text-[#888]">|</span>
            )}

            {computedTotalPages > 1 && (
              <div className="flex items-center gap-3">
                <button
                  onClick={() => {
                    queueHistoryUpdate('push');
                    setPage(1);
                  }}
                  disabled={page === 1}
                  className="hover:underline disabled:text-[#888] disabled:hover:no-underline"
                >
                  First
                </button>
                <button
                  onClick={() => {
                    queueHistoryUpdate('push');
                    setPage(p => Math.max(1, p - 1));
                  }}
                  disabled={page === 1}
                  className="hover:underline disabled:text-[#888] disabled:hover:no-underline"
                >
                  Prev
                </button>
                <button
                  onClick={() => {
                    queueHistoryUpdate('push');
                    setPage(p => Math.min(computedTotalPages, p + 1));
                  }}
                  disabled={page === computedTotalPages}
                  className="hover:underline disabled:text-[#888] disabled:hover:no-underline"
                >
                  Next
                </button>
                <button
                  onClick={() => {
                    queueHistoryUpdate('push');
                    setPage(computedTotalPages);
                  }}
                  disabled={page === computedTotalPages}
                  className="hover:underline disabled:text-[#888] disabled:hover:no-underline"
                >
                  Last
                </button>
              </div>
            )}

            {computedTotalPages > 1 && nextSiblingFolder && (
              <span className="select-none px-0.5 text-[#888]">|</span>
            )}

            {computedTotalPages <= 1 && previousSiblingFolder && nextSiblingFolder && (
              <span className="select-none px-0.5 text-[#888]">|</span>
            )}

            {nextSiblingFolder && (
              <button
                type="button"
                onClick={() => navigateToPath(nextSiblingFolder.path)}
                className="max-w-[18rem] truncate text-right text-[#666] hover:text-black hover:underline transition-colors"
                title={nextSiblingFolder.title || nextSiblingFolder.name}
              >
                {nextSiblingFolder.title || nextSiblingFolder.name}
              </button>
            )}
          </div>
          </div>
        </footer>
      )}
        </>
      )}

      {selectedImage && (
        <div
          className="fixed inset-0 z-50 bg-[#F0F0F0]/95 backdrop-blur-sm overflow-y-auto p-4 md:p-8 animate-in fade-in duration-200"
          onClick={closeLightbox}
        >
          {/* Top fixed bar for close and download options to ensure they always stay visible and touch-accessible */}
          <div className="fixed top-4 right-4 flex items-center gap-2 z-50">
            <a
              href={sourceMode === 'local' ? (localObjectUrls[selectedImage] || '#') : `${API_PATH}/download/${encodeURI(selectedImage)}`}
              download={basename(selectedImage)}
              onClick={e => e.stopPropagation()}
              className="p-2 bg-white border-[2px] border-black hover:bg-black hover:text-white transition-colors flex items-center justify-center shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
              title={sourceMode === 'local' ? 'Download Local File' : 'Download File'}
            >
              <Download size={20} strokeWidth={2.5} />
            </a>
            <button
              className="p-2 bg-white border-[2px] border-black hover:bg-black hover:text-white transition-colors flex items-center justify-center shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
              onClick={e => {
                e.stopPropagation();
                closeLightbox();
              }}
              title="Close"
            >
              <X size={20} strokeWidth={2.5} />
            </button>
          </div>

          <div 
            className="w-full max-w-4xl mx-auto flex flex-col items-center gap-4 py-8"
            onClick={e => e.stopPropagation()}
          >
            {/* Centered Preview */}
            <div className="w-full flex items-center justify-center min-h-0">
              {isRenderable(selectedImage) ? (
                (() => {
                  const selectedEntry = entries.find(e => e.path === selectedImage);
                  const selectedSharedFile = sharedFiles?.find(f => f.path === selectedImage);
                  const isSelectedImageLarge = selectedEntry?.is_large || selectedSharedFile?.is_large || false;
                  const selectedImageSize = selectedEntry?.size || selectedSharedFile?.size || 0;
                  const showFullImage = !isSelectedImageLarge || forceFullImage[selectedImage || ''];

                  const imageUrl = showFullImage
                    ? getResolvedImageUrl(selectedImage || '')
                    : getResolvedMediaUrl(selectedImage || '');

                  return (
                    <div className="flex flex-col items-center gap-3 max-w-full">
                      <img
                        src={imageUrl}
                        alt={selectedImage || ''}
                        referrerPolicy="no-referrer"
                        className="max-w-full max-h-[60vh] object-contain border-[2px] border-black bg-white shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] cursor-pointer"
                        onClick={closeLightbox}
                      />
                      {isSelectedImageLarge && !showFullImage && (
                        <div className="flex flex-col items-center gap-1.5 mt-1">
                          <button
                            onClick={() => {
                              setForceFullImage(prev => ({ ...prev, [selectedImage || '']: true }));
                            }}
                            className="bg-yellow-400 text-black border-[2px] border-black px-4 py-1.5 font-bold uppercase text-[11px] shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-x-[4px] active:translate-y-[4px] active:shadow-none transition-all flex items-center gap-1.5"
                          >
                            <Download size={14} strokeWidth={2.5} />
                            Load Full Image ({formatBytes(selectedImageSize)})
                          </button>
                          <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">
                            Currently viewing compressed thumbnail
                          </span>
                        </div>
                      )}
                      {isSelectedImageLarge && showFullImage && (
                        <span className="text-[10px] text-green-600 font-bold uppercase tracking-wider">
                          Viewing original image ({formatBytes(selectedImageSize)})
                        </span>
                      )}
                    </div>
                  );
                })()
              ) : (
                <div
                  className={`w-full max-w-2xl aspect-video border-[2px] border-black bg-white flex flex-col items-center justify-center gap-4 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] ${selectedFileTone?.accent || 'text-[#888]'}`}
                >
                  <div className={`w-20 h-20 rounded-full border-[2px] border-black flex items-center justify-center ${selectedFileTone?.bg || 'bg-[#F3F3F3]'}`}>
                    <FileImage size={36} strokeWidth={1.5} />
                  </div>
                  <div className="flex flex-col items-center gap-2 text-center px-6">
                    <span className="text-xs font-bold uppercase tracking-[0.25em] text-black">
                      {getFileTypeCode(selectedImage)}
                    </span>
                    <span className="text-[11px] font-bold uppercase tracking-widest opacity-80">
                      {selectedFileTone?.label || 'FILE'}
                    </span>
                    <span className="text-xs text-[#666]">Preview not available in browser</span>
                  </div>
                </div>
              )}
            </div>

            {/* Copy Link Widget */}
            {selectedImage && (
              <div className="w-full max-w-2xl bg-white border-[2px] border-black px-3 py-1.5 font-sans text-[10px] sm:text-xs shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] flex items-center justify-between gap-2">
                <div className="truncate flex-1">
                  <span className="text-[#888] uppercase font-bold tracking-wider mr-1">{sourceMode === 'local' ? 'Local File:' : 'Direct URL:'}</span>
                  <a 
                    href={getResolvedImageUrl(selectedImage)} 
                    className="text-black hover:underline font-bold" 
                    target="_blank" 
                    rel="noopener noreferrer"
                  >
                    {sourceMode === 'local' ? selectedImage : getResolvedImageUrl(selectedImage)}
                  </a>
                </div>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(sourceMode === 'local' ? selectedImage : getResolvedImageUrl(selectedImage));
                    setCopiedImageLink(true);
                    setTimeout(() => setCopiedImageLink(false), 2000);
                  }}
                  className="shrink-0 hover:bg-gray-100 p-1 border border-transparent hover:border-black active:bg-gray-200 transition-all flex items-center justify-center"
                  title={sourceMode === 'local' ? 'Copy local file path' : 'Copy direct URL to clipboard'}
                >
                  {copiedImageLink ? (
                    <Check size={14} className="text-green-600 font-bold" strokeWidth={3} />
                  ) : (
                    <Copy size={13} className="text-black" strokeWidth={2.5} />
                  )}
                </button>
              </div>
            )}

            {selectedImage && isRenderable(selectedImage) && currentPath && canEditServerFolders && (
              <div className="w-full max-w-2xl border-[2px] border-black bg-[#F9F9F9] p-3 flex flex-col gap-3 font-sans text-xs shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex flex-col gap-0.5 min-w-0">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#888]">Folder Covers</span>
                    <span className="text-[10px] text-[#aaa] uppercase tracking-wider truncate">
                      {selectedImage ? `Using ${basename(selectedImage)}` : 'No image selected'}
                    </span>
                  </div>
                  <div className="text-[9px] font-bold uppercase tracking-widest text-[#666]">
                    {setCoverStatus === 'saving' ? 'Saving...' : setCoverStatus === 'saved' ? 'Saved' : 'Ready'}
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  {[
                    { slot: 1 as const, label: 'Cover 1', current: folderCoverPaths.cover1Path },
                    { slot: 2 as const, label: 'Cover 2', current: folderCoverPaths.cover2Path },
                  ].map(({ slot, label, current }) => {
                    const isCurrent = current === selectedImage;
                    return (
                      <div key={slot} className="border-[1px] border-[#DDD] bg-white p-3 flex flex-col gap-2">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-[#888]">{label}</span>
                          <span className="text-[9px] uppercase tracking-widest text-[#aaa] truncate">
                            {current ? basename(current) : 'Not set'}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => saveFolderCoverSlot(slot, selectedImage)}
                            disabled={setCoverStatus === 'saving' || isCurrent}
                            className="bg-black text-white px-2.5 py-1 text-[9px] font-bold uppercase tracking-widest hover:bg-[#333] transition-colors border-[2px] border-black disabled:bg-[#888] disabled:cursor-not-allowed flex items-center gap-1 whitespace-nowrap"
                          >
                            <BookImage size={9} strokeWidth={2.5} />
                            Set as {label}
                          </button>
                          <button
                            onClick={() => saveFolderCoverSlot(slot, null)}
                            disabled={setCoverStatus === 'saving' || !current}
                            className="text-[9px] font-bold uppercase tracking-widest text-[#888] hover:text-black transition-colors underline disabled:text-[#bbb] disabled:hover:text-[#bbb]"
                          >
                            Clear
                          </button>
                        </div>
                        <div className="text-[9px] font-bold uppercase tracking-widest text-[#666]">
                          {isCurrent ? 'This image is assigned here' : current ? 'Different image assigned' : 'No image assigned'}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Info panel below the image */}
            <div className="w-full max-w-2xl bg-white border-[2px] border-black p-4 flex flex-col gap-3 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] text-left font-sans">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <h3 className="font-sans text-sm font-bold uppercase tracking-wide truncate" title={labelWithoutExtension(selectedImage)}>
                    {editTitle || labelWithoutExtension(selectedImage)}
                  </h3>
                  <span className="text-[10px] font-sans text-[#888] break-all block mt-0.5">
                    {selectedImage}
                  </span>
                </div>
                <button
                  onClick={() => setShowEditBox(!showEditBox)}
                  className="bg-black text-white px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest hover:bg-[#333] transition-colors border-[2px] border-black shrink-0"
                >
                  {showEditBox ? 'Close Edit' : 'Edit Details'}
                </button>
              </div>

              {/* Description if present */}
              {imageDetail?.description && !showEditBox && (
                <p className="text-xs text-[#444] font-sans leading-relaxed border-l-2 border-black pl-2 py-0.5">
                  {imageDetail.description}
                </p>
              )}

              {/* Tags displayed below the description */}
              {editTags.length > 0 && !showEditBox && (
                <div className="flex flex-wrap gap-1">
                  {editTags.map(tag => (
                    <span
                      key={tag}
                      className="bg-[#F3F3F3] border border-[#666] text-black px-1.5 py-0.5 text-[10px] font-sans lowercase"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              )}

              <hr className="border-t border-[#DDD]" />

              {/* Image Properties */}
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] font-sans uppercase text-[#666]">
                <div className="flex items-center gap-1">
                  <span className="text-[#888]">Size:</span>
                  <span className="text-black font-bold">
                    {imageDetailState === 'ready' && imageDetail
                      ? (imageDetail.exif.size / 1024 > 1024
                        ? `${(imageDetail.exif.size / 1024 / 1024).toFixed(2)} MB`
                        : `${(imageDetail.exif.size / 1024).toFixed(1)} KB`)
                      : '...'}
                  </span>
                </div>
                
                {imageDetailState === 'ready' && imageDetail?.exif?.width && (
                  <>
                    <div className="flex items-center gap-1">
                      <span className="text-[#888]">Format:</span>
                      <span className="text-black font-bold">{imageDetail.exif.format}</span>
                    </div>
                    
                    <div className="flex items-center gap-1">
                      <span className="text-[#888]">Resolution:</span>
                      <span className="text-black font-bold">{imageDetail.exif.width} ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â {imageDetail.exif.height} px</span>
                    </div>
                  </>
                )}
                
                {imageDetailState === 'ready' && imageDetail?.exif?.cameraModel && (
                  <div className="flex items-center gap-1">
                    <span className="text-[#888]">Camera:</span>
                    <span className="text-black font-bold truncate max-w-[120px]" title={imageDetail.exif.cameraModel}>{imageDetail.exif.cameraModel}</span>
                  </div>
                )}

                {imageDetailState === 'ready' && imageDetail?.exif?.capturedAt && (
                  <div className="flex items-center gap-1">
                    <span className="text-[#888]">Captured:</span>
                    <span className="text-black font-bold truncate" title={imageDetail.exif.capturedAt}>{imageDetail.exif.capturedAt}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Edit metadata box below info panel */}
            {showEditBox && (
              <div className="w-full max-w-2xl border-[2px] border-black bg-[#F9F9F9] p-4 flex flex-col gap-3 font-sans text-xs shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                <div className="flex flex-col gap-2.5">
                  <label className="flex flex-col gap-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#888]">title</span>
                    <input
                      type="text"
                      value={editTitle}
                      onChange={e => setEditTitle(e.target.value)}
                      className="border-[2px] border-black bg-white px-2 py-1 font-sans text-xs focus:outline-none font-bold"
                    />
                  </label>

                  <label className="flex flex-col gap-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#888]">description</span>
                    <textarea
                      value={editDescription}
                      onChange={e => setEditDescription(e.target.value)}
                      className="border-[2px] border-black bg-white px-2 py-1 font-sans text-xs focus:outline-none min-h-[60px] resize-y"
                      placeholder="add description..."
                    />
                  </label>

                  {/* Tag editor inside edit box */}
                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#888]">tags</span>
                    <div className="flex flex-wrap gap-1 mb-1.5">
                      {editTags.length === 0 ? (
                        <span className="text-[10px] italic text-[#888]">No tags.</span>
                      ) : (
                        editTags.map(tag => (
                          <span
                            key={tag}
                            className="inline-flex items-center gap-1 bg-white border border-black text-black px-1.5 py-0.5 text-[10px] font-sans lowercase"
                          >
                            #{tag}
                            <button
                              onClick={() => setEditTags(editTags.filter(t => t !== tag))}
                              className="hover:text-red-600 font-bold ml-0.5 text-xs text-[#888] transition-colors"
                              title="Remove tag"
                            >
                              ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â
                            </button>
                          </span>
                        ))
                      )}
                    </div>

                    <div className="relative flex gap-1.5">
                      <input
                        type="text"
                        placeholder="add tag..."
                        value={tagInput}
                        onChange={e => setTagInput(e.target.value)}
                        onKeyDown={e => {
                          const suggestionCount = filteredEditTagOptions.length + (canCreateEditTagCandidate ? 1 : 0);
                          if (suggestionCount && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
                            e.preventDefault();
                            setActiveTagInputIndex(prev => {
                              const direction = e.key === 'ArrowDown' ? 1 : -1;
                              return (prev + direction + suggestionCount) % suggestionCount;
                            });
                            return;
                          }

                          if (e.key === 'Enter') {
                            e.preventDefault();
                            if (filteredEditTagOptions.length > 0 && activeTagInputIndex < filteredEditTagOptions.length) {
                              handleCommitEditTagChoice(filteredEditTagOptions[activeTagInputIndex]);
                              return;
                            }
                            if (canCreateEditTagCandidate) {
                              handleCommitEditTagChoice(createEditTagCandidate);
                            }
                          }
                        }}
                        className="flex-1 border-[2px] border-black bg-white px-2 py-1 font-sans text-xs focus:outline-none font-bold uppercase"
                      />
                      <button
                        onClick={() => {
                          const tag = tagInput.trim().toLowerCase();
                          if (tag && !editTags.includes(tag)) {
                            setEditTags([...editTags, tag]);
                            setTagInput('');
                          }
                        }}
                        className="bg-black text-white px-3 py-1 text-[10px] font-bold uppercase tracking-wider hover:bg-[#333] transition-colors border-[2px] border-black"
                      >
                        Add
                      </button>

                      {/* Autocomplete suggestions dropdown */}
                      {tagInput.trim() && (filteredEditTagOptions.length > 0 || canCreateEditTagCandidate) && (
                        <div className="absolute bottom-full left-0 right-0 z-30 bg-white border-2 border-black max-h-[100px] overflow-y-auto shadow-[3px_-3px_0px_0px_rgba(0,0,0,1)] mb-1 divide-y divide-gray-200">
                          {filteredEditTagOptions.slice(0, 5).map((suggestion, index) => (
                                <button
                                  key={suggestion}
                                  onClick={() => handleCommitEditTagChoice(suggestion)}
                                  className={`w-full text-left px-2 py-1 text-[10px] font-sans lowercase block transition-colors ${activeTagInputIndex === index ? 'bg-black text-white' : 'hover:bg-[#F3F3F3] text-black'}`}
                                >
                                #{suggestion}
                              </button>
                            ))}
                          {canCreateEditTagCandidate && (
                            <button
                              onClick={() => handleCommitEditTagChoice(createEditTagCandidate)}
                              className={`w-full text-left px-2 py-1 text-[10px] font-sans lowercase block transition-colors ${activeTagInputIndex === filteredEditTagOptions.length ? 'bg-black text-white' : 'hover:bg-[#F3F3F3] text-black'}`}
                            >
                              Create "{createEditTagCandidate}"
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <button
                  onClick={handleSaveDetails}
                  disabled={saveStatus === 'saving'}
                  className="bg-black text-white w-full py-2 text-[10px] font-bold uppercase tracking-widest hover:bg-[#333] transition-colors border-[2px] border-black disabled:bg-[#888] mt-1"
                >
                  {saveStatus === 'saving' ? 'SAVING...' : saveStatus === 'saved' ? 'SAVED!' : saveStatus === 'error' ? 'ERROR!' : 'SAVE DETAILS'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {accountPanel && (
        <div
          className="fixed inset-0 z-[70] bg-[#F0F0F0]/94 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setAccountPanel(null)}
        >
          <div
            className="w-full max-w-[560px] border-[2px] border-[#666] bg-white shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]"
            onClick={event => event.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b-[2px] border-[#666] px-4 py-3">
              <h2 className="font-sans text-sm font-bold uppercase tracking-wide">{accountPanelTitle}</h2>
              <button
                onClick={() => setAccountPanel(null)}
                className="text-[#888] hover:text-black transition-colors"
              >
                <X size={18} strokeWidth={2.25} />
              </button>
            </div>

            <div className="p-4 flex flex-col gap-4">
              {authMessage && <div className="text-xs font-bold uppercase tracking-widest text-[#476E66]">{authMessage}</div>}
              {authError && <div className="text-xs font-bold uppercase tracking-widest text-[#8A5A44]">{authError}</div>}

              {accountPanel === 'manage' && (
                <div className="flex flex-col gap-4 font-sans">
                  {/* Tab toggles */}
                  <div className="flex items-center gap-3 border-b-[2px] border-black pb-2 text-[11px] font-bold uppercase tracking-wider">
                    <button
                      onClick={() => setManageTab('tags')}
                      className={manageTab === 'tags' ? 'text-black underline decoration-[1.5px] underline-offset-[3px]' : 'text-[#888] hover:text-black'}
                    >
                      Tags ({allTags.length})
                    </button>
                    <button
                      onClick={() => setManageTab('lists')}
                      className={manageTab === 'lists' ? 'text-black underline decoration-[1.5px] underline-offset-[3px]' : 'text-[#888] hover:text-black'}
                    >
                      Lists ({allShares.length})
                    </button>
                  </div>

                  {manageTab === 'tags' ? (
                    <div className="divide-y-[1px] divide-gray-200 max-h-[350px] overflow-y-auto pr-1">
                      {allTags.length === 0 ? (
                        <div className="py-6 text-center text-[11px] font-bold uppercase tracking-widest text-[#888]">No tags found.</div>
                      ) : (
                        allTags.map(tag => (
                          <div key={tag} className="flex items-center justify-between gap-3 py-2 text-[11px] font-sans lowercase">
                            {renamingTag === tag ? (
                              <div className="flex min-w-0 flex-1 items-center gap-2">
                                <span className="font-bold text-black">#</span>
                                <input
                                  type="text"
                                  value={renamingTagValue}
                                  onChange={event => setRenamingTagValue(event.target.value.toLowerCase())}
                                  onKeyDown={event => {
                                    if (event.key === 'Enter') {
                                      event.preventDefault();
                                      handleRenameTag(tag);
                                    }
                                    if (event.key === 'Escape') {
                                      setRenamingTag(null);
                                      setRenamingTagValue('');
                                    }
                                  }}
                                  className="min-w-0 flex-1 border-[2px] border-black bg-white px-2 py-1 text-[11px] font-bold lowercase focus:outline-none"
                                  autoFocus
                                />
                              </div>
                            ) : (
                              <span className="min-w-0 flex-1 truncate font-bold text-black">
                                #{tag} <span className="text-[9px] uppercase text-[#888]">({tagCounts[tag] || 0} items)</span>
                              </span>
                            )}
                            <div className="flex shrink-0 items-center gap-3 font-sans text-[10px] font-bold uppercase">
                              {renamingTag === tag ? (
                                <>
                                  <button
                                    onClick={() => handleRenameTag(tag)}
                                    className="text-gray-500 transition-colors hover:text-black"
                                  >
                                    Save
                                  </button>
                                  <button
                                    onClick={() => {
                                      setRenamingTag(null);
                                      setRenamingTagValue('');
                                    }}
                                    className="text-gray-500 transition-colors hover:text-black"
                                  >
                                    Cancel
                                  </button>
                                </>
                              ) : (
                                <>
                                  <button
                                    onClick={() => {
                                      setRenamingTag(tag);
                                      setRenamingTagValue(tag);
                                    }}
                                    className="text-gray-500 transition-colors hover:text-black"
                                  >
                                    Rename
                                  </button>
                                  <button
                                    onClick={() => handleDeleteTag(tag)}
                                    className="text-gray-500 transition-colors hover:text-red-600"
                                  >
                                    Delete
                                  </button>
                                </>
                              )}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  ) : (
                    <div className="divide-y-[1px] divide-gray-200 max-h-[350px] overflow-y-auto pr-1">
                      {allShares.length === 0 ? (
                        <div className="py-6 text-center text-[11px] font-bold uppercase tracking-widest text-[#888]">No lists found.</div>
                      ) : (
                        allShares.map(share => (
                          <div key={share.id} className="flex items-center justify-between py-2 text-[11px] font-sans uppercase">
                            <div className="flex flex-col min-w-0 pr-2">
                              <span className="font-bold text-black truncate">{share.title || share.id}</span>
                              <span className="text-[9px] text-[#888] mt-0.5">{share.itemCount} items ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â¢ {share.id}</span>
                            </div>
                            <div className="flex items-center gap-3 uppercase font-sans text-[10px] font-bold shrink-0">
                              <button
                                onClick={() => window.open(buildSharePageUrl(share.id), '_blank')}
                                className="text-gray-500 hover:text-black transition-colors"
                              >
                                Open
                              </button>
                              <button
                                onClick={() => handleRenameList(share.id, share.title)}
                                className="text-gray-500 hover:text-black transition-colors"
                              >
                                Rename
                              </button>
                              <button
                                onClick={() => handleDeleteList(share.id, share.title)}
                                className="text-gray-500 hover:text-red-600 transition-colors"
                              >
                                Delete
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )}

                  <div className="flex justify-end border-t-[2px] border-black pt-3 mt-1">
                    <button
                      onClick={() => setAccountPanel(null)}
                      className="bg-black text-white px-4 py-1.5 text-[11px] font-bold uppercase tracking-widest hover:bg-[#333] transition-colors border-[2px] border-black"
                    >
                      Close
                    </button>
                  </div>
                </div>
              )}

              {accountPanel === 'auth' && (
                usesCentralAuth ? (
                  <>
                    <div className="border-[2px] border-[#666] bg-[#F7F7F7] px-4 py-4 flex flex-col gap-3">
                      <div className="text-[11px] font-bold uppercase tracking-widest text-black">Multimillion</div>
                      <p className="text-xs font-sans text-[#666] leading-relaxed">
                        Perihelion now uses the central account system at <span className="font-bold">{authBaseUrl}</span>.
                        Sign in there, request access there, and make sure your account has Perihelion access. After sign-in, youÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ll come right back here.
                      </p>
                    </div>
                    <div className="flex items-center gap-3 justify-end">
                      <button
                        onClick={() => setAccountPanel(null)}
                        className="text-[11px] font-bold uppercase tracking-widest text-[#888] hover:text-black"
                      >
                        Close
                      </button>
                      <button
                        onClick={() => openCentralAuth()}
                        className="bg-black text-white px-4 py-2 text-[11px] font-bold uppercase tracking-widest hover:bg-[#333] transition-colors"
                      >
                        Open Auth
                      </button>
                    </div>
                  </>
                ) : (
                <>
                  <div className="flex items-center gap-3 text-[11px] font-bold uppercase tracking-widest">
                    <button
                      onClick={() => {
                        setAuthMode('login');
                        setAuthError('');
                        setAuthMessage('');
                      }}
                      className={authMode === 'login' ? 'text-black underline decoration-[1.5px] underline-offset-[3px]' : 'text-[#888] hover:text-black'}
                    >
                      Sign In
                    </button>
                    <button
                      onClick={() => {
                        setAuthMode('register');
                        setAuthError('');
                        setAuthMessage('');
                      }}
                      className={authMode === 'register' ? 'text-black underline decoration-[1.5px] underline-offset-[3px]' : 'text-[#888] hover:text-black'}
                    >
                      Register
                    </button>
                  </div>

                  <label className="flex flex-col gap-2">
                    <span className="text-[11px] font-bold uppercase tracking-widest text-[#888]">Username</span>
                    <input
                      value={usernameInput}
                      onChange={event => setUsernameInput(event.target.value)}
                      className="border-[2px] border-[#666] px-3 py-2 font-sans text-sm focus:outline-none focus:border-black"
                      autoComplete="username"
                    />
                  </label>

                  <label className="flex flex-col gap-2">
                    <span className="text-[11px] font-bold uppercase tracking-widest text-[#888]">Password</span>
                    <input
                      type="password"
                      value={passwordInput}
                      onChange={event => setPasswordInput(event.target.value)}
                      className="border-[2px] border-[#666] px-3 py-2 font-sans text-sm focus:outline-none focus:border-black"
                      autoComplete={authMode === 'login' ? 'current-password' : 'new-password'}
                    />
                  </label>

                  {authMode === 'register' && (
                    <>
                      <label className="flex flex-col gap-2">
                        <span className="text-[11px] font-bold uppercase tracking-widest text-[#888]">Confirm Password</span>
                        <input
                          type="password"
                          value={confirmPasswordInput}
                          onChange={event => setConfirmPasswordInput(event.target.value)}
                          className="border-[2px] border-[#666] px-3 py-2 font-sans text-sm focus:outline-none focus:border-black"
                          autoComplete="new-password"
                        />
                      </label>

                      <label className="flex flex-col gap-2">
                        <span className="text-[11px] font-bold uppercase tracking-widest text-[#888]">Who You Are / Why YouÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢re Requesting Access</span>
                        <textarea
                          value={requestNoteInput}
                          onChange={event => setRequestNoteInput(event.target.value)}
                          className="border-[2px] border-[#666] px-3 py-2 font-sans text-sm focus:outline-none focus:border-black min-h-[104px] resize-y"
                        />
                      </label>
                      <p className="text-xs font-sans text-[#666] leading-relaxed">
                        If you can, include an email address or a social / web link so I know who the request belongs to and how to follow up.
                      </p>
                    </>
                  )}

                  {!authStatus?.hasUsers && (
                    <p className="text-xs font-sans text-[#666] leading-relaxed">
                      The first account you register becomes the initial approved admin.
                    </p>
                  )}
                  {authMode === 'register' && authStatus?.hasUsers && (
                    <p className="text-xs font-sans text-[#666] leading-relaxed">
                      New accounts land in the pending queue until an approved admin reviews the request note and approves or blocks access.
                    </p>
                  )}

                  {authStatus?.user && (
                    <div className="border-[2px] border-[#666] bg-[#F7F7F7] px-3 py-3 text-xs font-sans leading-relaxed">
                      Signed in as <span className="font-bold">{authStatus.user.username}</span>.
                      {authStatus.user.isAdmin ? ' You can approve or block new accounts.' : ' Your downloads can now be tied to your account history.'}
                    </div>
                  )}

                  <div className="flex items-center gap-3 justify-end">
                    <button
                      onClick={() => setAccountPanel(null)}
                      className="text-[11px] font-bold uppercase tracking-widest text-[#888] hover:text-black"
                    >
                      Close
                    </button>
                    <button
                      onClick={handleAuthSubmit}
                      className="bg-black text-white px-4 py-2 text-[11px] font-bold uppercase tracking-widest hover:bg-[#333] transition-colors"
                    >
                      {authMode === 'login' ? 'Sign In' : 'Create Account'}
                    </button>
                  </div>
                </>
                )
              )}

              {accountPanel === 'user' && authStatus?.user && (
                usesCentralAuth ? (
                  <>
                    <div className="border-[2px] border-[#666] bg-[#F7F7F7] px-4 py-4 flex flex-col gap-3">
                      <div className="text-[11px] font-bold uppercase tracking-widest text-black">
                        Signed in as {authStatus.user.username}{authStatus.user.isAdmin ? ' ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â¢ Admin' : ''}
                      </div>
                      <p className="text-xs font-sans text-[#666] leading-relaxed">
                        Your settings, history, approvals, and password changes now live in Multimillion. Sign out here if you want to switch to a different account. If this archive still stays locked, ask for Perihelion access in the central dashboard.
                      </p>
                    </div>
                    <div className="flex items-center gap-3 justify-end">
                      <button
                        onClick={handleLogout}
                        className="border-[2px] border-[#666] px-4 py-2 text-[11px] font-bold uppercase tracking-widest hover:border-black transition-colors"
                      >
                        Sign Out
                      </button>
                      <button
                        onClick={() => openCentralAuth()}
                        className="bg-black text-white px-4 py-2 text-[11px] font-bold uppercase tracking-widest hover:bg-[#333] transition-colors"
                      >
                        Open Account
                      </button>
                    </div>
                  </>
                ) : (
                <>
                  <div className="border-[2px] border-[#666] bg-[#F7F7F7] px-4 py-4 flex flex-col gap-2">
                    <div className="text-[11px] font-bold uppercase tracking-widest text-black">
                      Signed in as {authStatus.user.username}{authStatus.user.isAdmin ? ' ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â¢ Admin' : ''}
                    </div>
                    <div className="text-xs font-sans text-[#666] leading-relaxed">
                      Sign out completely before moving into another account. Downloads tied to this account will appear below.
                    </div>
                  </div>

                  <div className="border-[2px] border-[#666]">
                    <div className="border-b-[2px] border-[#666] px-4 py-3 bg-[#F7F7F7]">
                      <div className="text-[11px] font-bold uppercase tracking-widest text-black">Change Username</div>
                    </div>
                    <div className="p-4 flex flex-col gap-4">
                      <label className="flex flex-col gap-2">
                        <span className="text-[11px] font-bold uppercase tracking-widest text-[#888]">New Username</span>
                        <input
                          value={newUsernameInput}
                          onChange={event => setNewUsernameInput(event.target.value)}
                          className="border-[2px] border-[#666] px-3 py-2 font-sans text-sm focus:outline-none focus:border-black"
                          autoComplete="username"
                        />
                      </label>

                      <label className="flex flex-col gap-2">
                        <span className="text-[11px] font-bold uppercase tracking-widest text-[#888]">Current Password</span>
                        <input
                          type="password"
                          value={currentUsernamePasswordInput}
                          onChange={event => setCurrentUsernamePasswordInput(event.target.value)}
                          className="border-[2px] border-[#666] px-3 py-2 font-sans text-sm focus:outline-none focus:border-black"
                          autoComplete="current-password"
                        />
                      </label>

                      <div className="flex justify-end">
                        <button
                          onClick={handleUsernameChange}
                          className="bg-black text-white px-4 py-2 text-[11px] font-bold uppercase tracking-widest hover:bg-[#333] transition-colors"
                        >
                          Update Username
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="border-[2px] border-[#666]">
                    <div className="border-b-[2px] border-[#666] px-4 py-3 bg-[#F7F7F7]">
                      <div className="text-[11px] font-bold uppercase tracking-widest text-black">Change Password</div>
                    </div>
                    <div className="p-4 flex flex-col gap-4">
                      <label className="flex flex-col gap-2">
                        <span className="text-[11px] font-bold uppercase tracking-widest text-[#888]">Current Password</span>
                        <input
                          type="password"
                          value={currentPasswordInput}
                          onChange={event => setCurrentPasswordInput(event.target.value)}
                          className="border-[2px] border-[#666] px-3 py-2 font-sans text-sm focus:outline-none focus:border-black"
                          autoComplete="current-password"
                        />
                      </label>

                      <label className="flex flex-col gap-2">
                        <span className="text-[11px] font-bold uppercase tracking-widest text-[#888]">New Password</span>
                        <input
                          type="password"
                          value={newPasswordInput}
                          onChange={event => setNewPasswordInput(event.target.value)}
                          className="border-[2px] border-[#666] px-3 py-2 font-sans text-sm focus:outline-none focus:border-black"
                          autoComplete="new-password"
                        />
                      </label>

                      <label className="flex flex-col gap-2">
                        <span className="text-[11px] font-bold uppercase tracking-widest text-[#888]">Confirm New Password</span>
                        <input
                          type="password"
                          value={confirmNewPasswordInput}
                          onChange={event => setConfirmNewPasswordInput(event.target.value)}
                          className="border-[2px] border-[#666] px-3 py-2 font-sans text-sm focus:outline-none focus:border-black"
                          autoComplete="new-password"
                        />
                      </label>

                      <div className="flex justify-end">
                        <button
                          onClick={handlePasswordChange}
                          className="bg-black text-white px-4 py-2 text-[11px] font-bold uppercase tracking-widest hover:bg-[#333] transition-colors"
                        >
                          Update Password
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="border-[2px] border-[#666]">
                    <div className="border-b-[2px] border-[#666] px-4 py-3 bg-[#F7F7F7]">
                      <div className="text-[11px] font-bold uppercase tracking-widest text-black">Download History</div>
                    </div>
                    {historyLoading ? (
                      <div className="px-4 py-6 text-xs font-bold uppercase tracking-widest text-[#888] animate-pulse">Loading HistoryÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â¦</div>
                    ) : historyEntries.length === 0 ? (
                      <div className="px-4 py-6 text-center text-xs font-bold uppercase tracking-widest text-[#888]">
                        No tracked downloads yet.
                      </div>
                    ) : (
                      <div className="divide-y-[2px] divide-[#666] max-h-[320px] overflow-y-auto">
                        {historyEntries.map(entry => (
                          <div key={entry.id} className="px-4 py-3 flex flex-col gap-1">
                            <div className="flex items-center justify-between gap-4">
                              <span className="text-[11px] font-bold uppercase tracking-widest text-black">{basename(entry.output_name || entry.file_path)}</span>
                              <span className="text-[10px] font-bold uppercase tracking-widest text-[#888]">{new Date(entry.created_at).toLocaleString()}</span>
                            </div>
                            <span className="text-[11px] font-bold uppercase tracking-widest text-[#888]">{entry.action} ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â¢ {entry.output_name || entry.file_path}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
                )
              )}

              {accountPanel === 'admin' && (
                usesCentralAuth ? (
                  <>
                    <div className="border-[2px] border-[#666] bg-[#F7F7F7] px-4 py-4 flex flex-col gap-3">
                      <div className="text-[11px] font-bold uppercase tracking-widest text-black">Central Dashboard</div>
                      <p className="text-xs font-sans text-[#666] leading-relaxed">
                        Account approvals, blocking, deletions, per-site access, and audit history now live in Multimillion so one dashboard can eventually serve all the sites.
                      </p>
                    </div>
                    <div className="flex items-center gap-3 justify-end">
                      <button
                        onClick={() => setAccountPanel(null)}
                        className="text-[11px] font-bold uppercase tracking-widest text-[#888] hover:text-black"
                      >
                        Close
                      </button>
                      <button
                        onClick={() => openCentralAuth()}
                        className="bg-black text-white px-4 py-2 text-[11px] font-bold uppercase tracking-widest hover:bg-[#333] transition-colors"
                      >
                        Open Dashboard
                      </button>
                    </div>
                  </>
                ) : (
                <>
                  <p className="text-xs font-sans text-[#666] leading-relaxed">
                    This dashboard keeps the whole approval flow in one place: review incoming requests, approve or block them, and remove accounts that should no longer exist.
                  </p>
                  {adminLoading ? (
                    <div className="text-xs font-bold uppercase tracking-widest text-[#888] animate-pulse">Loading AccountsÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â¦</div>
                  ) : (
                    <div className="flex flex-col gap-4">
                      <div className="border-[2px] border-[#666]">
                        <div className="border-b-[2px] border-[#666] px-4 py-3 bg-[#F7F7F7] flex items-center justify-between gap-4">
                          <div>
                            <div className="text-[11px] font-bold uppercase tracking-widest text-black">Pending Requests</div>
                            <div className="text-[10px] font-bold uppercase tracking-widest text-[#888]">
                              Review who is asking and why before access is granted.
                            </div>
                          </div>
                          <div className="text-[11px] font-bold uppercase tracking-widest text-[#888]">{pendingUsers.length}</div>
                        </div>
                        {pendingUsers.length === 0 ? (
                          <div className="px-4 py-6 text-center text-xs font-bold uppercase tracking-widest text-[#888]">
                            No pending requests.
                          </div>
                        ) : (
                          <div className="divide-y-[2px] divide-[#666] max-h-[240px] overflow-y-auto">
                            {pendingUsers.map(user => (
                              <div key={user.id} className="px-4 py-4 flex flex-col gap-3">
                                <div className="flex items-start justify-between gap-4">
                                  <div className="min-w-0">
                                    <div className="text-[11px] font-bold uppercase tracking-widest text-black truncate">
                                      {user.username} {user.isAdmin ? 'ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â¢ Admin' : ''}
                                    </div>
                                    <div className="text-[10px] font-bold uppercase tracking-widest text-[#888]">
                                      Requested {new Date(user.createdAt).toLocaleString()}
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-3 shrink-0">
                                    <button
                                      onClick={() => handleAdminAction(user.id, 'approve')}
                                      className="text-[11px] font-bold uppercase tracking-widest text-[#476E66] hover:text-black"
                                    >
                                      Approve
                                    </button>
                                    <button
                                      onClick={() => handleAdminAction(user.id, 'block')}
                                      className="text-[11px] font-bold uppercase tracking-widest text-[#8A5A44] hover:text-black"
                                    >
                                      Block
                                    </button>
                                    <button
                                      onClick={() => handleDeleteUser(user.id)}
                                      className="text-[11px] font-bold uppercase tracking-widest text-[#888] hover:text-black"
                                    >
                                      Delete
                                    </button>
                                  </div>
                                </div>
                                <div className="border-[2px] border-[#666] bg-[#F7F7F7] px-3 py-3 text-xs font-sans leading-relaxed text-[#444]">
                                  {user.requestNote || 'No request note left.'}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="border-[2px] border-[#666]">
                        <div className="border-b-[2px] border-[#666] px-4 py-3 bg-[#F7F7F7] flex items-center justify-between gap-4">
                          <div>
                            <div className="text-[11px] font-bold uppercase tracking-widest text-black">Approved Accounts</div>
                            <div className="text-[10px] font-bold uppercase tracking-widest text-[#888]">
                              Members with active access right now.
                            </div>
                          </div>
                          <div className="text-[11px] font-bold uppercase tracking-widest text-[#888]">{approvedUsers.length}</div>
                        </div>
                        {approvedUsers.length === 0 ? (
                          <div className="px-4 py-6 text-center text-xs font-bold uppercase tracking-widest text-[#888]">
                            No approved accounts yet.
                          </div>
                        ) : (
                          <div className="divide-y-[2px] divide-[#666] max-h-[220px] overflow-y-auto">
                            {approvedUsers.map(user => (
                              <div key={user.id} className="px-4 py-3 flex items-center justify-between gap-4">
                                <div className="min-w-0">
                                  <div className="text-[11px] font-bold uppercase tracking-widest text-black truncate">
                                    {user.username} {user.isAdmin ? 'ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â¢ Admin' : ''}
                                  </div>
                                  <div className="text-[10px] font-bold uppercase tracking-widest text-[#888]">
                                    Approved {user.approvedAt ? new Date(user.approvedAt).toLocaleString() : 'Recently'}
                                  </div>
                                </div>
                                {String(user.id) !== String(authStatus?.user?.id) ? (
                                  <div className="flex items-center gap-3 shrink-0">
                                    <button
                                      onClick={() => handleAdminAction(user.id, 'block')}
                                      className="text-[11px] font-bold uppercase tracking-widest text-[#8A5A44] hover:text-black"
                                    >
                                      Block
                                    </button>
                                    <button
                                      onClick={() => handleDeleteUser(user.id)}
                                      className="text-[11px] font-bold uppercase tracking-widest text-[#888] hover:text-black"
                                    >
                                      Delete
                                    </button>
                                  </div>
                                ) : (
                                  <div className="text-[10px] font-bold uppercase tracking-widest text-[#888] shrink-0">
                                    Current Account
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="border-[2px] border-[#666]">
                        <div className="border-b-[2px] border-[#666] px-4 py-3 bg-[#F7F7F7] flex items-center justify-between gap-4">
                          <div>
                            <div className="text-[11px] font-bold uppercase tracking-widest text-black">Blocked Accounts</div>
                            <div className="text-[10px] font-bold uppercase tracking-widest text-[#888]">
                              Blocked members can be approved again later or removed entirely.
                            </div>
                          </div>
                          <div className="text-[11px] font-bold uppercase tracking-widest text-[#888]">{blockedUsers.length}</div>
                        </div>
                        {blockedUsers.length === 0 ? (
                          <div className="px-4 py-6 text-center text-xs font-bold uppercase tracking-widest text-[#888]">
                            No blocked accounts.
                          </div>
                        ) : (
                          <div className="divide-y-[2px] divide-[#666] max-h-[220px] overflow-y-auto">
                            {blockedUsers.map(user => (
                              <div key={user.id} className="px-4 py-3 flex items-center justify-between gap-4">
                                <div className="min-w-0">
                                  <div className="text-[11px] font-bold uppercase tracking-widest text-black truncate">
                                    {user.username} {user.isAdmin ? 'ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â¢ Admin' : ''}
                                  </div>
                                  <div className="text-[10px] font-bold uppercase tracking-widest text-[#888]">
                                    Blocked {user.blockedAt ? new Date(user.blockedAt).toLocaleString() : 'Recently'}
                                  </div>
                                </div>
                                {String(user.id) !== String(authStatus?.user?.id) ? (
                                  <div className="flex items-center gap-3 shrink-0">
                                    <button
                                      onClick={() => handleAdminAction(user.id, 'approve')}
                                      className="text-[11px] font-bold uppercase tracking-widest text-[#476E66] hover:text-black"
                                    >
                                      Re-Approve
                                    </button>
                                    <button
                                      onClick={() => handleDeleteUser(user.id)}
                                      className="text-[11px] font-bold uppercase tracking-widest text-[#888] hover:text-black"
                                    >
                                      Delete
                                    </button>
                                  </div>
                                ) : (
                                  <div className="text-[10px] font-bold uppercase tracking-widest text-[#888] shrink-0">
                                    Current Account
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </>
                )
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

