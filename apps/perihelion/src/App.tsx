import React, { useEffect, useMemo, useState } from 'react';
import { FolderOpen, X, Check, Download, ArrowLeft, FileImage, Tag, List, Plus, Search, Minus, Copy } from 'lucide-react';
import StagingView, { DownloadOptions } from './components/StagingView';

const renderableExts = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.avif', '.svg', '.bmp'];
const videoExts = ['.mp4', '.mov', '.avi', '.mkv', '.webm'];
type MediaKind = 'image' | 'video' | 'other';

interface MediaEntry {
  path: string;
  name: string;
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
  thumbnailPath: string | null;
  thumbnailKind: MediaKind | null;
  thumbnailExt: string;
  imageThumbnailPath?: string | null;
  imageThumbnailKind?: MediaKind | null;
  imageThumbnailExt?: string;
  itemCount: number;
}

interface AuthUser {
  id: number | string;
  username: string;
  isAdmin: boolean;
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

const getShareIdFromLocation = () => {
  const params = new URLSearchParams(window.location.search);
  const queryShareId = params.get('share');
  if (queryShareId) {
    return queryShareId;
  }

  const segments = window.location.pathname.split('/').filter(Boolean);
  const perihelionIndex = segments.indexOf('perihelion');
  if (perihelionIndex >= 0) {
    return segments[perihelionIndex + 1] || '';
  }

  return '';
};

const buildSharePageUrl = (shareId: string) => {
  const origin = window.location.origin;
  if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
    const segments = window.location.pathname.split('/').filter(Boolean);
    const perihelionIndex = segments.indexOf('perihelion');
    const basePath = perihelionIndex >= 0 ? `/${segments.slice(0, perihelionIndex + 1).join('/')}/` : '/';
    return `${origin}${basePath}?share=${shareId}`;
  }
  return `${origin}/${shareId}`;
};

const getPerihelionRootUrl = () => {
  const origin = window.location.origin;
  const segments = window.location.pathname.split('/').filter(Boolean);
  const perihelionIndex = segments.indexOf('perihelion');
  const basePath = perihelionIndex >= 0 ? `/${segments.slice(0, perihelionIndex + 1).join('/')}/` : '/';
  return `${origin}${basePath}`;
};

const toMediaEntry = (value: string): MediaEntry => ({
  path: value,
  name: basename(value),
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

export default function App() {
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [entries, setEntries] = useState<MediaEntry[]>([]);
  const [folders, setFolders] = useState<FolderEntry[]>([]);
  const [currentPath, setCurrentPath] = useState<string>('');
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
  const tagsRef = React.useRef<HTMLDivElement>(null);
  const listsRef = React.useRef<HTMLDivElement>(null);
  const [editTags, setEditTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [showEditBox, setShowEditBox] = useState(false);
  const [page, setPage] = useState(1);
  const [serverTotalPages, setServerTotalPages] = useState(1);
  const [serverTotalItems, setServerTotalItems] = useState(0);
  const [loading, setLoading] = useState(true);
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

  const [rowHeight, setRowHeight] = useState(250);
  const [limit, setLimit] = useState(25);
  const [includeOtherFiles, setIncludeOtherFiles] = useState(false);
  const [showFolderThumbnails, setShowFolderThumbnails] = useState(true);

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

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 300);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  useEffect(() => {
    if (searchQuery.trim() !== '') {
      setSelectedTag('');
      setSelectedList('');
      setPage(1);
    }
  }, [searchQuery]);

  useEffect(() => {
    if (selectedImages.size === 0) {
      setShowSelectedOnly(false);
    }
  }, [selectedImages.size]);

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

  const displayFolders = showSelectedOnly ? [] : folders;

  const computedTotalPages = showSelectedOnly
    ? Math.max(1, Math.ceil(visibleEntries.length / limit || 1))
    : Math.max(1, serverTotalPages);
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
    setCurrentPath(path);
    setSearchQuery('');
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
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const shareId = getShareIdFromLocation();

    if (shareId) {
      setIsSharedView(true);
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

    const heightParam = params.get('height');
    const colsParam = params.get('columns');
    const limitParam = params.get('limit');
    const pageParam = params.get('page');
    const includeOtherParam = params.get('includeOther');
    const folderThumbsParam = params.get('folderThumbs');

    if (heightParam) setRowHeight(parseInt(heightParam, 10));
    else if (colsParam) {
      const c = parseInt(colsParam, 10);
      if (c <= 2) setRowHeight(400);
      else if (c === 3) setRowHeight(300);
      else setRowHeight(250);
    }
    if (limitParam) setLimit(parseInt(limitParam, 10));
    if (pageParam) setPage(parseInt(pageParam, 10));
    if (includeOtherParam === '1' || includeOtherParam === 'true') {
      setIncludeOtherFiles(true);
    }
    if (folderThumbsParam === '0' || folderThumbsParam === 'false') {
      setShowFolderThumbnails(false);
    }
    fetchTags();
    fetchShares();
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
    fetchImages(page, limit, currentPath, selectedTag, selectedList, debouncedSearch);
  }, [page, limit, currentPath, selectedTag, selectedList, debouncedSearch, authStatus?.user?.id, authStatus?.requireAuth]);

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
            .map((file: { path: string; name?: string; kind?: MediaKind; ext?: string; title?: string; description?: string; tags?: string[]; is_large?: boolean; size?: number }) => ({
              path: file.path,
              name: file.name || basename(file.path),
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
        ? data.folders.map((folder: {
            path?: string;
            name?: string;
            thumbnailPath?: string | null;
            thumbnailKind?: MediaKind | null;
            thumbnailExt?: string;
            itemCount?: number;
          }) => ({
            path: folder.path || folder.name || '',
            name: folder.name || basename(folder.path || ''),
            thumbnailPath: folder.thumbnailPath ?? null,
            thumbnailKind: folder.thumbnailKind ?? (folder.thumbnailPath ? getMediaKind(folder.thumbnailPath) : null),
            thumbnailExt: folder.thumbnailExt || (folder.thumbnailPath ? extensionOf(folder.thumbnailPath) : ''),
            imageThumbnailPath: folder.imageThumbnailPath ?? null,
            imageThumbnailKind: folder.imageThumbnailKind ?? (folder.imageThumbnailPath ? getMediaKind(folder.imageThumbnailPath) : null),
            imageThumbnailExt: folder.imageThumbnailExt || (folder.imageThumbnailPath ? extensionOf(folder.imageThumbnailPath) : ''),
            itemCount: folder.itemCount ?? 0,
          })).filter((folder: FolderEntry) => Boolean(folder.path))
        : (data.directories || []).map((dir: string) => ({
            path: dir,
            name: basename(dir),
            thumbnailPath: null,
            thumbnailKind: null,
            thumbnailExt: '',
            itemCount: 0,
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
      if (e.key === 'Escape') setSelectedImage(null);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    if (!selectedImage) {
      setImageMeta(null);
      setImageMetaState('idle');
      setImageDetail(null);
      setImageDetailState('idle');
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
  }, [selectedImage]);

  useEffect(() => {
    if (imageDetailState === 'ready' && imageDetail) {
      setEditTitle(imageDetail.title || '');
      setEditDescription(imageDetail.description || '');
      setEditTags(imageDetail.tags || []);
    }
  }, [imageDetailState, imageDetail]);

  const getTagState = (tagName: string) => {
    const selectedList = Array.from(selectedImages);
    const visibleSelected = selectedList.filter(path => entries.some(e => e.path === path));
    
    if (visibleSelected.length === 0) return { checked: false, indeterminate: false };
    
    const count = visibleSelected.filter(path => {
      const entry = entries.find(e => e.path === path);
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
    
    setEntries(prev => prev.map(entry => {
      if (selectedImages.has(entry.path)) {
        const tags = entry.tags || [];
        if (action === 'add' && !tags.includes(tag)) {
          return { ...entry, tags: [...tags, tag] };
        } else if (action === 'remove') {
          return { ...entry, tags: tags.filter(t => t !== tag) };
        }
      }
      return entry;
    }));
    
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

  const handleCreateListBulk = async (title: string) => {
    const cleanTitle = title.trim();
    if (!cleanTitle) return;
    
    const selectedList = Array.from(selectedImages);
    
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
    const newTag = window.prompt(`Rename tag #${oldTag} to:`, oldTag);
    if (!newTag) return;
    const cleanNew = newTag.trim().toLowerCase();
    if (!cleanNew || cleanNew === oldTag) return;
    
    try {
      const res = await fetch(`${API_PATH}/tags/rename`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ oldTag, newTag: cleanNew }),
        credentials: 'include'
      });
      if (!res.ok) throw new Error('Failed to rename tag');
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
            <div className="flex items-center gap-2 border-[2px] border-black bg-white px-3 py-1.5 font-mono text-[10px] sm:text-xs shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] max-w-full overflow-x-auto mt-4">
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
                  <h1 className="text-2xl font-serif font-bold break-words">
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
    <div className="min-h-screen text-black flex flex-col selection:bg-black selection:text-white bg-[#F0F0F0]">
      {view === 'staging' ? (
        <StagingView
          selectedImages={stagedImages}
          selectedMetadata={selectedMetadata}
          onBack={() => setView('gallery')}
          onDownload={handleDownload}
          isDownloading={isDownloading}
          onOpenLightbox={(img) => setSelectedImage(img)}
          isLargeMap={isLargeMap}
        />
      ) : (
        <>
          <header className="h-[36px] bg-white border-b-[3px] border-black sticky top-0 z-40 flex items-center justify-between px-4 shrink-0 gap-4">
        <h1 className="font-archivo text-[15px] uppercase tracking-wider font-bold">
          <a href={getPerihelionRootUrl()} className="hover:opacity-70 transition-opacity">
            Perihelion
          </a>
        </h1>
        <div className="flex items-center gap-3 font-sans text-[11px] font-bold uppercase tracking-widest">
          {authLoading ? (
            <span className="text-[#888]">Checking Account…</span>
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
      </header>

      <main className="flex-1 px-4 pt-4 pb-[52px] sm:px-6 sm:pt-6 sm:pb-[60px] max-w-[1800px] mx-auto w-full">
        {!showPrivateGate && (
          <div className="flex flex-col gap-1 mb-6">
            <div className="flex items-center gap-3 font-sans text-xs font-bold uppercase tracking-wider">
              <span className="text-[#888]">Image Height</span>
              {[150, 200, 250, 300, 400].map(num => (
                <button
                  key={num}
                  onClick={() => setRowHeight(num)}
                  className={rowHeight === num ? 'text-black underline decoration-[1.5px] underline-offset-[3px]' : 'text-[#888] hover:text-black'}
                >
                  {num}px
                </button>
              ))}
            </div>

            <div className="flex items-center gap-3 font-sans text-xs font-bold uppercase tracking-wider">
              <span className="text-[#888]">Items per page</span>
              {Array.from(new Set([...[10, 25, 40, 50], limit])).sort((a, b) => a - b).map(num => (
                <button
                  key={num}
                  onClick={() => {
                    setLimit(num);
                    setPage(1);
                  }}
                  className={limit === num ? 'text-black underline decoration-[1.5px] underline-offset-[3px]' : 'text-[#888] hover:text-black'}
                >
                  {num}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-3 font-sans text-xs font-bold uppercase tracking-wider">
              <label className="flex items-center gap-2 cursor-pointer text-[#888] hover:text-black transition-colors">
                <input
                  type="checkbox"
                  checked={includeOtherFiles}
                  onChange={event => {
                    setIncludeOtherFiles(event.target.checked);
                    setPage(1);
                  }}
                  className="w-4 h-4 accent-black border-[2px] border-[#666]"
                />
                Include Other Files
              </label>
            </div>

            <div className="flex items-center gap-4 flex-wrap">
              <div className="flex items-center gap-3 font-sans text-xs font-bold uppercase tracking-wider">
                <span className="text-[#888]">Filter by Tag</span>
                <select
                  value={selectedTag}
                  onChange={e => {
                    setSelectedTag(e.target.value);
                    setSelectedList('');
                    setSearchQuery('');
                    setPage(1);
                  }}
                  className="bg-white border-[2px] border-black px-2 py-0.5 font-bold uppercase text-[11px] focus:outline-none cursor-pointer"
                >
                  <option value="">All Items</option>
                  {allTags.map(tag => (
                    <option key={tag} value={tag}>
                      #{tag}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-3 font-sans text-xs font-bold uppercase tracking-wider">
                <span className="text-[#888]">Filter by List</span>
                <select
                  value={selectedList}
                  onChange={e => {
                    setSelectedList(e.target.value);
                    setSelectedTag('');
                    setSearchQuery('');
                    setPage(1);
                  }}
                  className="bg-white border-[2px] border-black px-2 py-0.5 font-bold uppercase text-[11px] focus:outline-none cursor-pointer"
                >
                  <option value="">All Items</option>
                  {allShares.map(share => (
                    <option key={share.id} value={share.id}>
                      {share.title || share.id}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-3 font-sans text-xs font-bold uppercase tracking-wider">
                <span className="text-[#888]">Search</span>
                <div className="flex items-center gap-1.5">
                  <input
                    type="text"
                    placeholder="SEARCH GALLERY..."
                    value={searchQuery}
                    onChange={e => {
                      setSearchQuery(e.target.value);
                    }}
                    className="bg-white border-[2px] border-black px-2 py-0.5 font-bold uppercase text-[11px] focus:outline-none w-36 sm:w-48 font-mono placeholder:text-gray-300"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="bg-black text-white border-[2px] border-black px-2 py-0.5 font-bold uppercase text-[11px] hover:bg-[#333] transition-colors"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-3 font-sans text-xs font-bold uppercase tracking-wider">
                <span className="text-[#888]">View Share Code</span>
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
                    className="bg-white border-[2px] border-black px-2 py-0.5 font-bold uppercase text-[11px] focus:outline-none w-16 text-center font-mono placeholder:text-gray-300"
                  />
                  <button
                    onClick={handleOpenShareCode}
                    disabled={shareCodeInput.length !== 4 || isValidatingCode}
                    className="bg-black text-white border-[2px] border-black px-2 py-0.5 font-bold uppercase text-[11px] hover:bg-[#333] transition-colors disabled:opacity-50 min-w-[32px] text-center"
                  >
                    {isValidatingCode ? '...' : 'Go'}
                  </button>
                  <button
                    onClick={handleLoadShareCode}
                    disabled={shareCodeInput.length !== 4 || isValidatingCode}
                    className="bg-white text-black border-[2px] border-black px-2 py-0.5 font-bold uppercase text-[11px] hover:bg-[#F3F3F3] transition-colors disabled:opacity-50 min-w-[52px] text-center"
                  >
                    Load
                  </button>
                </div>
                {shareCodeError && (
                  <span className="text-red-600 font-bold text-[10px] uppercase ml-1 animate-pulse">
                    {shareCodeError}
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-3 font-sans text-xs font-bold uppercase tracking-wider mt-0.5 flex-wrap sm:flex-nowrap">
              <span className="text-[#888]">Selection</span>
              <button onClick={handleSelectAll} className="text-[#888] hover:text-black">Select Page</button>
              <button onClick={handleDeselectAll} className="text-[#888] hover:text-black">Deselect Page</button>
              {selectedImages.size > 0 && (
                <button onClick={() => setSelectedImages(new Set())} className="text-[#888] hover:text-black">Clear All</button>
              )}
              
              <span className="text-[#DDD]">|</span>
              <button
                onClick={() => {
                  setShowSelectedOnly(!showSelectedOnly);
                  setPage(1);
                }}
                disabled={selectedImages.size === 0}
                className={`flex items-center gap-1 border-[2px] border-black px-1.5 py-0.5 text-[10px] font-bold uppercase transition-colors ${showSelectedOnly ? 'bg-black text-white' : 'bg-white text-black hover:bg-[#F3F3F3]'} disabled:opacity-50 disabled:cursor-not-allowed`}
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
                      className={`flex items-center gap-1.5 border-[2px] border-black px-2.5 py-1 text-[11px] font-bold uppercase transition-colors ${showTagsPopover ? 'bg-black text-white' : 'bg-white text-black hover:bg-[#F3F3F3]'}`}
                    >
                      <Tag size={12} />
                      Tags
                    </button>
                    {showTagsPopover && (
                      <div className="absolute left-0 mt-1.5 z-50 w-64 bg-white border-[2px] border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] text-black normal-case font-sans">
                        <div className="p-2 border-b-[2px] border-black flex items-center gap-1.5 bg-[#F9F9F9]">
                          <Search size={12} className="text-[#888]" />
                          <input
                            type="text"
                            value={tagSearch}
                            onChange={e => setTagSearch(e.target.value)}
                            placeholder="Filter tags..."
                            className="w-full bg-transparent text-[11px] font-mono focus:outline-none placeholder-gray-400 font-bold uppercase"
                            onClick={e => e.stopPropagation()}
                          />
                          {tagSearch && (
                            <button onClick={() => setTagSearch('')} className="hover:text-red-500 font-bold text-xs">
                              <X size={12} />
                            </button>
                          )}
                        </div>
                        <div className="max-h-48 overflow-y-auto divide-y divide-[#DDD] font-mono text-[10px] lowercase">
                          {allTags
                            .filter(t => t.includes(tagSearch.trim().toLowerCase()))
                            .map(tagName => {
                              const { checked, indeterminate } = getTagState(tagName);
                              return (
                                <button
                                  key={tagName}
                                  onClick={() => handleToggleTagBulk(tagName)}
                                  className="w-full text-left px-2.5 py-2 hover:bg-black hover:text-white transition-colors flex items-center justify-between group"
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
                          {tagSearch.trim() && !allTags.includes(tagSearch.trim().toLowerCase()) && (
                            <button
                              onClick={() => {
                                handleToggleTagBulk(tagSearch);
                                setTagSearch('');
                              }}
                              className="w-full text-left px-2.5 py-2 hover:bg-black hover:text-white transition-colors flex items-center gap-1.5 text-black bg-[#FFFBEB] font-bold"
                            >
                              <Plus size={10} strokeWidth={3} />
                              <span>Create tag "{tagSearch.trim().toLowerCase()}"</span>
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
                      className={`flex items-center gap-1.5 border-[2px] border-black px-2.5 py-1 text-[11px] font-bold uppercase transition-colors ${showListsPopover ? 'bg-black text-white' : 'bg-white text-black hover:bg-[#F3F3F3]'}`}
                    >
                      <List size={12} />
                      Lists
                    </button>
                    {showListsPopover && (
                      <div className="absolute left-0 mt-1.5 z-50 w-64 bg-white border-[2px] border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] text-black normal-case font-sans">
                        <div className="p-2 border-b-[2px] border-black flex items-center gap-1.5 bg-[#F9F9F9]">
                          <Search size={12} className="text-[#888]" />
                          <input
                            type="text"
                            value={listSearch}
                            onChange={e => setListSearch(e.target.value)}
                            placeholder="Filter lists..."
                            className="w-full bg-transparent text-[11px] font-mono focus:outline-none placeholder-gray-400 font-bold uppercase"
                            onClick={e => e.stopPropagation()}
                          />
                          {listSearch && (
                            <button onClick={() => setListSearch('')} className="hover:text-red-500 font-bold text-xs">
                              <X size={12} />
                            </button>
                          )}
                        </div>
                        <div className="max-h-48 overflow-y-auto divide-y divide-[#DDD] font-mono text-[10px] uppercase">
                          {allShares
                            .filter(s => s.title.toLowerCase().includes(listSearch.trim().toLowerCase()))
                            .map(share => {
                              const { checked, indeterminate } = getListState(share.id);
                              return (
                                <button
                                  key={share.id}
                                  onClick={() => handleToggleListBulk(share.id)}
                                  className="w-full text-left px-2.5 py-2 hover:bg-black hover:text-white transition-colors flex items-center justify-between group"
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
                          {listSearch.trim() && !allShares.some(s => s.title.toLowerCase() === listSearch.trim().toLowerCase()) && (
                            <button
                              onClick={() => handleCreateListBulk(listSearch)}
                              className="w-full text-left px-2.5 py-2 hover:bg-black hover:text-white transition-colors flex items-center gap-1.5 text-black bg-[#FFFBEB] font-bold"
                            >
                              <Plus size={10} strokeWidth={3} />
                              <span>Create list "{listSearch.trim()}"</span>
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
            <div className="font-mono text-xs font-bold uppercase tracking-wider text-[#666] flex flex-wrap items-center gap-y-1">
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
              {debouncedSearch && <span className="text-[#8A5A44] ml-2">(Searching: "{debouncedSearch}")</span>}
            </div>
            {shareCodeNotice && (
              <div className="text-[10px] font-bold uppercase tracking-widest text-[#666]">
                {shareCodeNotice}
              </div>
            )}
            {showSelectedOnly && selectedImages.size > 0 && (
              <div className="text-[10px] font-bold uppercase tracking-widest text-[#8A5A44]">
                Working selection: {selectedImages.size} item{selectedImages.size === 1 ? '' : 's'}
              </div>
            )}
          </div>
        )}

        {displayFolders.length > 0 && (
          <div className="mb-8">
            <div className="flex items-center justify-between gap-4 mb-4">
              <h2 className="text-xs font-bold uppercase tracking-widest text-[#666]">Folders</h2>
              <label className="flex items-center gap-2 cursor-pointer font-sans text-[11px] font-bold uppercase tracking-widest text-[#888] hover:text-black transition-colors">
                <input
                  type="checkbox"
                  checked={showFolderThumbnails}
                  onChange={event => setShowFolderThumbnails(event.target.checked)}
                  className="w-4 h-4 accent-black border-[2px] border-[#666]"
                />
                Show Folder Thumbnails
              </label>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {displayFolders.map(folder => {
                const previewPath = includeOtherFiles
                  ? (folder.thumbnailPath || folder.imageThumbnailPath || null)
                  : (folder.imageThumbnailPath || folder.thumbnailPath || null);
                const previewKind = includeOtherFiles
                  ? (folder.thumbnailKind || folder.imageThumbnailKind || null)
                  : (folder.imageThumbnailKind || folder.thumbnailKind || null);
                const folderRetryKey = `folder:${folder.path}:${previewPath ?? 'empty'}`;
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
                  className="bg-white border-[2px] border-[#666] flex flex-col overflow-hidden hover:border-black hover:shadow-[0_0_0_2px_rgba(0,0,0,1)] transition-all group text-left cursor-pointer touch-manipulation"
                >
                  {showFolderThumbnails ? (
                    <div
                      data-image-container
                      className="w-full border-b-[2px] border-[#666] bg-[#e0e0e0] flex items-center justify-center overflow-hidden"
                      style={{ height: `${Math.max(120, Math.min(220, rowHeight - 30))}px` }}
                    >
                      {previewPath && previewKind === 'image' ? (
                        <>
                          <img
                            src={buildThumbUrl(previewPath, folderThumbnailHeight, folderThumbnailHeight * 2, folderRetryToken)}
                            alt={folder.name}
                            loading="lazy"
                            referrerPolicy="no-referrer"
                            className="h-full w-full object-cover"
                            onLoad={handleImageLoad}
                            onError={(event) => handleThumbImageError(event, buildImageUrl(previewPath, folderRetryToken))}
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
                                setPreviewRetryTokens(prev => ({ ...prev, [folderRetryKey]: (prev[folderRetryKey] || 0) + 1 }));
                              }}
                              className="border-[2px] border-black bg-white px-3 py-1 text-[10px] font-bold uppercase tracking-widest hover:bg-black hover:text-white transition-colors"
                            >
                              Retry
                            </button>
                          </div>
                        </>
                      ) : previewPath ? (
                        <div className={`flex flex-col items-center justify-center gap-2 w-full h-full px-4 ${getFileTypeTone(previewPath).accent}`}>
                          <div className={`w-14 h-14 rounded-full border-[2px] flex items-center justify-center ${getFileTypeTone(previewPath).border} ${getFileTypeTone(previewPath).bg}`}>
                            <FileImage size={24} strokeWidth={1.5} />
                          </div>
                          <div className="flex flex-col items-center gap-1 text-center">
                            <span className="text-[11px] font-bold uppercase tracking-[0.25em]">
                              {getFileTypeCode(previewPath)}
                            </span>
                            <span className="text-[10px] font-bold uppercase tracking-widest opacity-80">
                              {includeOtherFiles ? 'First File' : 'First Image'}
                            </span>
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center gap-2 text-[#666]">
                          <FolderOpen size={28} className="text-black" />
                          <span className="text-[10px] font-bold uppercase tracking-widest">Empty Folder</span>
                        </div>
                      )}
                    </div>
                  ) : null}
                  <div className={`p-4 flex items-center gap-3 ${showFolderThumbnails ? '' : 'min-h-[84px]'}`}>
                    {!showFolderThumbnails && <FolderOpen size={20} className="text-black shrink-0" />}
                    <div className="min-w-0 flex-1">
                      <span className="font-sans text-xs font-bold uppercase truncate block">{folder.name}</span>
                      {folder.itemCount > 0 && (
                        <span className="font-sans text-[10px] font-bold uppercase tracking-widest text-[#888] block mt-1">
                          {folder.itemCount} {folder.itemCount === 1 ? 'Item' : 'Items'}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )})}
            </div>
          </div>
        )}

        <h2 className="text-xs font-bold uppercase tracking-widest text-[#666] mb-4">{includeOtherFiles ? 'Files' : 'Images'}</h2>
        {loading ? (
          <div className="flex items-center justify-center h-[40vh]">
            <div className="font-sans font-bold text-xl uppercase tracking-widest animate-pulse">Loading...</div>
          </div>
        ) : accessError ? (
          <div className="flex flex-col items-center justify-center h-[40vh] text-center max-w-md mx-auto gap-5">
            <div className="bg-white border-[2px] border-[#666] px-6 py-5 flex flex-col gap-3">
              <h2 className="font-archivo text-2xl uppercase">Private Archive</h2>
              <p className="font-sans text-sm leading-relaxed text-[#666]">{accessError}</p>
              <div className="flex items-center justify-center gap-3">
                <button
                  onClick={() => {
                    setAccountPanel('auth');
                    setAuthMode('login');
                    setAuthError('');
                    setAuthMessage('');
                  }}
                  className="bg-black text-white px-4 py-2 text-[11px] font-bold uppercase tracking-widest hover:bg-[#333] transition-colors"
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
                    className="border-[2px] border-[#666] px-4 py-2 text-[11px] font-bold uppercase tracking-widest hover:border-black transition-colors"
                  >
                    Create Admin
                  </button>
                )}
              </div>
            </div>
          </div>
        ) : visibleEntries.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-[40vh] text-center max-w-md mx-auto">
            <div className="bg-white p-4 border-[2px] border-[#666] mb-6">
              <FolderOpen size={40} className="text-black" strokeWidth={1.5} />
            </div>
            <h2 className="font-archivo text-2xl uppercase mb-3">{includeOtherFiles ? 'No files found' : 'No images found'}</h2>
            <p className="font-serif text-lg leading-relaxed">
              Drop {includeOtherFiles ? 'files' : 'image files'} into the <code className="bg-white border border-[#666] px-1.5 py-0.5 text-sm font-sans">images</code> folder on the backend.
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
                className={`bg-white border-[2px] flex flex-col transition-all ${selectedImages.has(entry.path) ? 'border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] z-10' : 'border-[#666] hover:border-black'}`}
              >
                <div
                  data-image-container
                  className={`border-b-[2px] ${selectedImages.has(entry.path) ? 'border-black' : 'border-[#666]'} bg-[#e0e0e0] relative flex items-center justify-center overflow-hidden cursor-pointer`}
                  style={{ height: `${rowHeight}px` }}
                  onClick={() => setSelectedImage(entry.path)}
                >
                  <button
                    onClick={e => toggleSelection(entry.path, e)}
                    className={`absolute top-2 left-2 z-20 w-6 h-6 border-[2px] flex items-center justify-center transition-colors ${selectedImages.has(entry.path) ? 'bg-black border-black' : 'bg-white border-[#666] hover:border-black'}`}
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
                        src={buildThumbUrl(entry.path, rowHeight, rowHeight * 2, retryToken)}
                        alt={entry.path}
                        loading="lazy"
                        referrerPolicy="no-referrer"
                        className="h-full w-auto object-contain p-2"
                        onLoad={handleImageLoad}
                        onError={(event) => handleThumbImageError(event, buildImageUrl(entry.path, retryToken))}
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
                    className={`font-sans text-xs font-bold uppercase truncate w-full block ${selectedImages.has(entry.path) ? 'text-black' : 'text-[#888]'}`}
                    title={entry.path}
                  >
                    {entry.name}
                  </p>
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
      </main>

      {!showPrivateGate && (
        <footer className="h-[36px] bg-white border-t-[3px] border-black fixed bottom-0 left-0 right-0 z-40 flex items-center justify-between px-4">
          <div className="font-sans text-xs font-bold uppercase tracking-wider">
            PAGE {page} OF {computedTotalPages} / {selectedImages.size > 0 ? <span className="text-black bg-[#e0e0e0] px-1.5 py-0.5 mr-1">{selectedImages.size} SELECTED /</span> : null} {pagedEntries.length} SHOWN / {totalVisibleItems} TOTAL
          </div>

          {computedTotalPages > 1 && (
            <div className="flex items-center gap-4 font-sans text-xs font-bold uppercase tracking-wider">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="hover:underline disabled:text-[#888] disabled:hover:no-underline"
              >
                Prev
              </button>
              <button
                onClick={() => setPage(p => Math.min(computedTotalPages, p + 1))}
                disabled={page === computedTotalPages}
                className="hover:underline disabled:text-[#888] disabled:hover:no-underline"
              >
                Next
              </button>
            </div>
          )}
        </footer>
      )}
        </>
      )}

      {selectedImage && (
        <div
          className="fixed inset-0 z-50 bg-[#F0F0F0]/95 backdrop-blur-sm overflow-y-auto p-4 md:p-8 animate-in fade-in duration-200"
          onClick={() => setSelectedImage(null)}
        >
          {/* Top fixed bar for close and download options to ensure they always stay visible and touch-accessible */}
          <div className="fixed top-4 right-4 flex items-center gap-2 z-50">
            <a
              href={`${API_PATH}/download/${encodeURI(selectedImage)}`}
              download
              onClick={e => e.stopPropagation()}
              className="p-2 bg-white border-[2px] border-black hover:bg-black hover:text-white transition-colors flex items-center justify-center shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
              title="Download File"
            >
              <Download size={20} strokeWidth={2.5} />
            </a>
            <button
              className="p-2 bg-white border-[2px] border-black hover:bg-black hover:text-white transition-colors flex items-center justify-center shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
              onClick={e => {
                e.stopPropagation();
                setSelectedImage(null);
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
                    ? buildImageUrl(selectedImage || '')
                    : buildMediaUrl(selectedImage || '');

                  return (
                    <div className="flex flex-col items-center gap-3 max-w-full">
                      <img
                        src={imageUrl}
                        alt={selectedImage || ''}
                        referrerPolicy="no-referrer"
                        className="max-w-full max-h-[60vh] object-contain border-[2px] border-black bg-white shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] cursor-pointer"
                        onClick={() => setSelectedImage(null)}
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
              <div className="w-full max-w-2xl bg-white border-[2px] border-black px-3 py-1.5 font-mono text-[10px] sm:text-xs shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] flex items-center justify-between gap-2">
                <div className="truncate flex-1">
                  <span className="text-[#888] uppercase font-bold tracking-wider mr-1">Direct URL:</span>
                  <a 
                    href={buildImageUrl(selectedImage)} 
                    className="text-black hover:underline font-bold" 
                    target="_blank" 
                    rel="noopener noreferrer"
                  >
                    {buildImageUrl(selectedImage)}
                  </a>
                </div>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(buildImageUrl(selectedImage));
                    setCopiedImageLink(true);
                    setTimeout(() => setCopiedImageLink(false), 2000);
                  }}
                  className="shrink-0 hover:bg-gray-100 p-1 border border-transparent hover:border-black active:bg-gray-200 transition-all flex items-center justify-center"
                  title="Copy direct URL to clipboard"
                >
                  {copiedImageLink ? (
                    <Check size={14} className="text-green-600 font-bold" strokeWidth={3} />
                  ) : (
                    <Copy size={13} className="text-black" strokeWidth={2.5} />
                  )}
                </button>
              </div>
            )}

            {/* Info panel below the image */}
            <div className="w-full max-w-2xl bg-white border-[2px] border-black p-4 flex flex-col gap-3 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] text-left font-sans">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <h3 className="font-archivo text-sm font-bold uppercase tracking-wide truncate" title={labelWithoutExtension(selectedImage)}>
                    {editTitle || labelWithoutExtension(selectedImage)}
                  </h3>
                  <span className="text-[10px] font-mono text-[#888] break-all block mt-0.5">
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
                      className="bg-[#F3F3F3] border border-[#666] text-black px-1.5 py-0.5 text-[10px] font-mono lowercase"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              )}

              <hr className="border-t border-[#DDD]" />

              {/* Image Properties */}
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] font-mono uppercase text-[#666]">
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
                      <span className="text-black font-bold">{imageDetail.exif.width} × {imageDetail.exif.height} px</span>
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
                            className="inline-flex items-center gap-1 bg-white border border-black text-black px-1.5 py-0.5 text-[10px] font-mono lowercase"
                          >
                            #{tag}
                            <button
                              onClick={() => setEditTags(editTags.filter(t => t !== tag))}
                              className="hover:text-red-600 font-bold ml-0.5 text-xs text-[#888] transition-colors"
                              title="Remove tag"
                            >
                              ×
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
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            const tag = tagInput.trim().toLowerCase();
                            if (tag && !editTags.includes(tag)) {
                              setEditTags([...editTags, tag]);
                              setTagInput('');
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
                      {tagInput.trim() && allTags.filter(t => t.includes(tagInput.trim().toLowerCase()) && !editTags.includes(t)).length > 0 && (
                        <div className="absolute bottom-full left-0 right-0 z-30 bg-white border-2 border-black max-h-[100px] overflow-y-auto shadow-[3px_-3px_0px_0px_rgba(0,0,0,1)] mb-1 divide-y divide-gray-200">
                          {allTags
                            .filter(t => t.includes(tagInput.trim().toLowerCase()) && !editTags.includes(t))
                            .slice(0, 5)
                            .map(suggestion => (
                              <button
                                key={suggestion}
                                onClick={() => {
                                  setEditTags([...editTags, suggestion]);
                                  setTagInput('');
                                }}
                                className="w-full text-left px-2 py-1 text-[10px] font-mono lowercase hover:bg-[#F3F3F3] text-black block"
                              >
                                #{suggestion}
                              </button>
                            ))
                          }
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
              <h2 className="font-archivo text-sm uppercase tracking-widest">{accountPanelTitle}</h2>
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
                          <div key={tag} className="flex items-center justify-between py-2 text-[11px] font-mono lowercase">
                            <span className="font-bold text-black">#{tag} <span className="text-[9px] text-[#888] uppercase">({tagCounts[tag] || 0} items)</span></span>
                            <div className="flex items-center gap-3 uppercase font-sans text-[10px] font-bold">
                              <button
                                onClick={() => handleRenameTag(tag)}
                                className="text-gray-500 hover:text-black transition-colors"
                              >
                                Rename
                              </button>
                              <button
                                onClick={() => handleDeleteTag(tag)}
                                className="text-gray-500 hover:text-red-600 transition-colors"
                              >
                                Delete
                              </button>
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
                          <div key={share.id} className="flex items-center justify-between py-2 text-[11px] font-mono uppercase">
                            <div className="flex flex-col min-w-0 pr-2">
                              <span className="font-bold text-black truncate">{share.title || share.id}</span>
                              <span className="text-[9px] text-[#888] mt-0.5">{share.itemCount} items • {share.id}</span>
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
                        Sign in there, request access there, and make sure your account has Perihelion access. After sign-in, you’ll come right back here.
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
                        <span className="text-[11px] font-bold uppercase tracking-widest text-[#888]">Who You Are / Why You’re Requesting Access</span>
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
                        Signed in as {authStatus.user.username}{authStatus.user.isAdmin ? ' • Admin' : ''}
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
                      Signed in as {authStatus.user.username}{authStatus.user.isAdmin ? ' • Admin' : ''}
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
                      <div className="px-4 py-6 text-xs font-bold uppercase tracking-widest text-[#888] animate-pulse">Loading History…</div>
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
                            <span className="text-[11px] font-bold uppercase tracking-widest text-[#888]">{entry.action} • {entry.output_name || entry.file_path}</span>
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
                    <div className="text-xs font-bold uppercase tracking-widest text-[#888] animate-pulse">Loading Accounts…</div>
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
                                      {user.username} {user.isAdmin ? '• Admin' : ''}
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
                                    {user.username} {user.isAdmin ? '• Admin' : ''}
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
                                    {user.username} {user.isAdmin ? '• Admin' : ''}
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
