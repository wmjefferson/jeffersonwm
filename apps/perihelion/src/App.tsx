import React, { useEffect, useMemo, useState } from 'react';
import { FolderOpen, X, Check, Download, ArrowLeft, FileImage } from 'lucide-react';
import StagingView, { DownloadOptions } from './components/StagingView';

const renderableExts = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.avif', '.svg', '.bmp'];
const videoExts = ['.mp4', '.mov', '.avi', '.mkv', '.webm'];
type MediaKind = 'image' | 'video' | 'other';

interface MediaEntry {
  path: string;
  name: string;
  kind: MediaKind;
  ext: string;
}

interface FolderEntry {
  path: string;
  name: string;
  thumbnailPath: string | null;
  thumbnailKind: MediaKind | null;
  thumbnailExt: string;
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

type AccountPanel = 'auth' | 'user' | 'admin' | null;

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
const API_PATH = `${APIBASE}/api`;

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
  const segments = window.location.pathname.split('/').filter(Boolean);
  const perihelionIndex = segments.indexOf('perihelion');
  const basePath = perihelionIndex >= 0 ? `/${segments.slice(0, perihelionIndex + 1).join('/')}/` : '/';
  return new URL(`${shareId}`, `${origin}${basePath}`).toString();
};

const toMediaEntry = (value: string): MediaEntry => ({
  path: value,
  name: basename(value),
  kind: getMediaKind(value),
  ext: extensionOf(value),
});

export default function App() {
  const [entries, setEntries] = useState<MediaEntry[]>([]);
  const [folders, setFolders] = useState<FolderEntry[]>([]);
  const [currentPath, setCurrentPath] = useState<string>('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [imageMeta, setImageMeta] = useState<{ type: string; size: number; width: number; height: number } | null>(null);
  const [imageMetaState, setImageMetaState] = useState<'idle' | 'loading' | 'ready' | 'unavailable'>('idle');
  const [accessError, setAccessError] = useState('');

  const [isSharedView, setIsSharedView] = useState(false);
  const [sharedImages, setSharedImages] = useState<string[] | null>(null);
  const [sharedTitle, setSharedTitle] = useState<string>('');
  const [sharedError, setSharedError] = useState('');

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

  const visibleEntries = useMemo(
    () => entries.filter(entry => includeOtherFiles || entry.kind === 'image'),
    [entries, includeOtherFiles]
  );

  const computedTotalPages = Math.max(1, Math.ceil(visibleEntries.length / limit || 1));
  const startIndex = (page - 1) * limit;
  const endIndex = startIndex + limit;
  const pagedEntries = visibleEntries.slice(startIndex, endIndex);
  const stagedImages = Array.from(
    selectedImages.size ? selectedImages : new Set(pagedEntries.map(entry => entry.path))
  ) as string[];

  const sharedNonRenderable = (sharedImages || []).filter(item => !isRenderable(item));
  const sharedRenderable = (sharedImages || []).filter(item => isRenderable(item));
  const totalVisibleItems = visibleEntries.length;
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

  useEffect(() => {
    loadAuthStatus();
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
            if (data.title) setSharedTitle(data.title);
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
    fetchImages(page, limit, currentPath);
  }, [page, limit, currentPath, authStatus?.user?.id, authStatus?.requireAuth]);

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

  const fetchImages = async (p: number, l: number, path: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(p),
        limit: String(l),
        path,
      });
      const res = await fetch(`${API_PATH}/images?${params.toString()}`, {
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch images');
      setAccessError('');

      const nextEntries: MediaEntry[] = Array.isArray(data.files)
        ? data.files
            .filter((file: { type?: string }) => file.type === 'file')
            .map((file: { path: string; name?: string; kind?: MediaKind; ext?: string }) => ({
              path: file.path,
              name: file.name || basename(file.path),
              kind: file.kind || (isRenderable(file.path) ? 'image' : 'other'),
              ext: file.ext || extensionOf(file.path),
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
    } catch (err) {
      console.error('Failed to fetch images', err);
      setEntries([]);
      setFolders([]);
      const message = err instanceof Error ? err.message : 'Failed to fetch images';
      if (/authentication required/i.test(message)) {
        if (authStatus?.provider === 'central') {
          setAccessError('Perihelion is private right now. Sign in through Auth JeffersonWM and make sure your account has Perihelion access.');
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
      return;
    }

    if (!isRenderable(selectedImage)) {
      setImageMeta(null);
      setImageMetaState('unavailable');
      return;
    }

    setImageMeta(null);
    setImageMetaState('loading');
    fetch(`${API_PATH}/image-meta/${encodeURI(selectedImage)}`, {
      credentials: 'include',
    })
      .then(res => res.json())
      .then(data => {
        if (!data.error) {
          setImageMeta(data);
          setImageMetaState('ready');
        } else {
          setImageMetaState('unavailable');
        }
      })
      .catch(err => {
        console.error(err);
        setImageMetaState('unavailable');
      });
  }, [selectedImage]);

  const toggleSelection = (img: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const newSet = new Set(selectedImages);
    if (newSet.has(img)) newSet.delete(img);
    else newSet.add(img);
    setSelectedImages(newSet);
  };

  const handleSelectAll = () => {
    const newSet = new Set(selectedImages);
    pagedEntries.forEach(entry => newSet.add(entry.path));
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
        credentials: 'include',
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
      setAuthMessage(usesCentralAuth ? 'Signed out of Auth JeffersonWM.' : '');
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

  const openCentralAuth = () => {
    window.open(authBaseUrl, '_blank', 'noopener,noreferrer');
  };

  const accountPanelTitle = accountPanel === 'user'
    ? 'Your Account'
    : accountPanel === 'admin'
      ? usesCentralAuth ? 'Dashboard' : 'Account Dashboard'
      : authStatus?.user
        ? 'Account'
        : 'Sign In';

  if (isSharedView) {
    return (
      <div className="min-h-screen bg-[#F0F0F0] p-[20px] flex flex-col items-center gap-10">
        {sharedError ? (
          <div className="text-red-500 font-bold uppercase tracking-widest">{sharedError}</div>
        ) : !sharedImages ? (
          <div className="text-[#888] font-bold uppercase tracking-widest animate-pulse">Loading...</div>
        ) : (
          <>
            {sharedTitle && (
              <h1 className="text-2xl font-serif font-bold text-center w-full max-w-4xl mt-8 mb-4 break-words">
                {sharedTitle}
              </h1>
            )}
            {sharedNonRenderable.length > 0 && (
              <div className="w-full max-w-4xl border-[2px] border-[#666] bg-white px-5 py-4 flex flex-col gap-2">
                {sharedNonRenderable.map(file => (
                  <div key={file} className="font-sans text-[11px] font-bold uppercase tracking-widest text-[#666] break-all">
                    {basename(file)}
                  </div>
                ))}
              </div>
            )}
            {sharedRenderable.map(img => (
              <div key={img} className="flex items-center justify-center w-full">
                <img
                  src={`${IMAGE_PATH}/${encodeURI(img)}`}
                  alt={img}
                  loading="lazy"
                  referrerPolicy="no-referrer"
                  className="max-w-full h-auto object-contain"
                />
              </div>
            ))}
          </>
        )}
      </div>
    );
  }

  if (view === 'staging') {
    return (
      <StagingView
        selectedImages={stagedImages}
        onBack={() => setView('gallery')}
        onDownload={handleDownload}
        isDownloading={isDownloading}
      />
    );
  }

  return (
    <div className="min-h-screen text-black flex flex-col selection:bg-black selection:text-white bg-[#F0F0F0]">
      <header className="h-[36px] bg-white border-b-[3px] border-black sticky top-0 z-40 flex items-center justify-between px-4 shrink-0 gap-4">
        <h1 className="font-archivo text-sm uppercase tracking-wider font-bold">Perihelion</h1>
        <div className="flex items-center gap-3 font-sans text-[10px] font-bold uppercase tracking-widest">
          {authLoading ? (
            <span className="text-[#888]">Checking Account…</span>
          ) : authStatus?.user ? (
            <>
              {authStatus.user.isAdmin && (
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
          <div className="flex flex-col gap-2 mb-6">
            <div className="flex items-center gap-3 font-sans text-[11px] font-bold uppercase tracking-wider">
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

            <div className="flex items-center gap-3 font-sans text-[11px] font-bold uppercase tracking-wider">
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

            <div className="flex items-center gap-3 font-sans text-[11px] font-bold uppercase tracking-wider">
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

            <div className="flex items-center gap-3 font-sans text-[11px] font-bold uppercase tracking-wider mt-2">
              <span className="text-[#888]">Selection</span>
              <button onClick={handleSelectAll} className="text-[#888] hover:text-black">Select Page</button>
              <button onClick={handleDeselectAll} className="text-[#888] hover:text-black">Deselect Page</button>
              {selectedImages.size > 0 && (
                <button onClick={() => setSelectedImages(new Set())} className="text-[#888] hover:text-black">Clear All</button>
              )}
              {visibleEntries.length > 0 && (
                <button
                  onClick={() => {
                    if (selectedImages.size === 0) {
                      const newSet = new Set(selectedImages);
                      pagedEntries.forEach(entry => newSet.add(entry.path));
                      setSelectedImages(newSet);
                    }
                    setView('staging');
                  }}
                  disabled={isDownloading}
                  className="ml-auto bg-black text-white px-3 py-1.5 flex items-center gap-2 hover:bg-[#333] disabled:bg-[#888] transition-colors"
                >
                  <Download size={14} strokeWidth={2.5} />
                  Stage {selectedImages.size || pagedEntries.length} Items
                </button>
              )}
            </div>
          </div>
        )}

        {!showPrivateGate && currentPath && (
          <div className="mb-6">
            <button
              onClick={() => {
                const parts = currentPath.split('/');
                parts.pop();
                setCurrentPath(parts.join('/'));
                setPage(1);
              }}
              className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider hover:text-[#F27D26] transition-colors"
            >
              <ArrowLeft size={14} strokeWidth={2.5} />
              Back to {currentPath.includes('/') ? currentPath.split('/').slice(0, -1).pop() : 'Root'}
            </button>
          </div>
        )}

        {folders.length > 0 && (
          <div className="mb-8">
            <div className="flex items-center justify-between gap-4 mb-4">
              <h2 className="text-[11px] font-bold uppercase tracking-widest text-[#666]">Folders</h2>
              <label className="flex items-center gap-2 cursor-pointer font-sans text-[10px] font-bold uppercase tracking-widest text-[#888] hover:text-black transition-colors">
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
              {folders.map(folder => (
                <button
                  key={folder.path}
                  onClick={() => {
                    setCurrentPath(folder.path);
                    setPage(1);
                  }}
                  className="bg-white border-[2px] border-[#666] flex flex-col overflow-hidden hover:border-black hover:shadow-[0_0_0_2px_rgba(0,0,0,1)] transition-all group text-left"
                >
                  {showFolderThumbnails ? (
                    <div
                      className="w-full border-b-[2px] border-[#666] bg-[#e0e0e0] flex items-center justify-center overflow-hidden"
                      style={{ height: `${Math.max(120, Math.min(220, rowHeight - 30))}px` }}
                    >
                      {folder.thumbnailPath && folder.thumbnailKind === 'image' ? (
                        <img
                          src={`${IMAGE_PATH}/${encodeURI(folder.thumbnailPath)}`}
                          alt={folder.name}
                          loading="lazy"
                          referrerPolicy="no-referrer"
                          className="h-full w-full object-cover"
                        />
                      ) : folder.thumbnailPath ? (
                        <div className={`flex flex-col items-center justify-center gap-2 w-full h-full px-4 ${getFileTypeTone(folder.thumbnailPath).accent}`}>
                          <div className={`w-14 h-14 rounded-full border-[2px] flex items-center justify-center ${getFileTypeTone(folder.thumbnailPath).border} ${getFileTypeTone(folder.thumbnailPath).bg}`}>
                            <FileImage size={24} strokeWidth={1.5} />
                          </div>
                          <div className="flex flex-col items-center gap-1 text-center">
                            <span className="text-[10px] font-bold uppercase tracking-[0.25em]">
                              {getFileTypeCode(folder.thumbnailPath)}
                            </span>
                            <span className="text-[9px] font-bold uppercase tracking-widest opacity-80">
                              First File
                            </span>
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center gap-2 text-[#666]">
                          <FolderOpen size={28} className="text-black" />
                          <span className="text-[9px] font-bold uppercase tracking-widest">Empty Folder</span>
                        </div>
                      )}
                    </div>
                  ) : null}
                  <div className={`p-4 flex items-center gap-3 ${showFolderThumbnails ? '' : 'min-h-[84px]'}`}>
                    {!showFolderThumbnails && <FolderOpen size={20} className="text-black shrink-0" />}
                    <div className="min-w-0 flex-1">
                      <span className="font-sans text-[11px] font-bold uppercase truncate block">{folder.name}</span>
                      {folder.itemCount > 0 && (
                        <span className="font-sans text-[9px] font-bold uppercase tracking-widest text-[#888] block mt-1">
                          {folder.itemCount} {folder.itemCount === 1 ? 'Item' : 'Items'}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        <h2 className="text-[11px] font-bold uppercase tracking-widest text-[#666] mb-4">{includeOtherFiles ? 'Files' : 'Images'}</h2>
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
                  className="bg-black text-white px-4 py-2 text-[10px] font-bold uppercase tracking-widest hover:bg-[#333] transition-colors"
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
                    className="border-[2px] border-[#666] px-4 py-2 text-[10px] font-bold uppercase tracking-widest hover:border-black transition-colors"
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
              <div
                key={entry.path || idx}
                className={`bg-white border-[2px] flex flex-col transition-all ${selectedImages.has(entry.path) ? 'border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] z-10' : 'border-[#666] hover:border-black'}`}
              >
                <div
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
                  {entry.kind === 'image' && isRenderable(entry.path) ? (
                    <img
                      src={`${IMAGE_PATH}/${encodeURI(entry.path)}`}
                      alt={entry.path}
                      loading="lazy"
                      referrerPolicy="no-referrer"
                      className="h-full w-auto object-contain p-2"
                    />
                  ) : (
                    <div className={`flex flex-col items-center justify-center gap-3 w-48 h-full px-5 ${getFileTypeTone(entry.path).accent}`}>
                      <div className={`w-16 h-16 rounded-full border-[2px] flex items-center justify-center ${getFileTypeTone(entry.path).border} ${getFileTypeTone(entry.path).bg}`}>
                        <FileImage size={28} strokeWidth={1.5} />
                      </div>
                      <div className="flex flex-col items-center gap-1 text-center">
                        <span className="text-[10px] font-bold uppercase tracking-[0.25em]">
                          {getFileTypeCode(entry.path)}
                        </span>
                        <span className="text-[9px] font-bold uppercase tracking-widest opacity-80">
                          {getFileTypeTone(entry.path).label}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
                <div className="p-3 bg-white shrink-0" style={{ width: '0', minWidth: '100%' }}>
                  <p
                    className={`font-sans text-[11px] font-bold uppercase truncate w-full block ${selectedImages.has(entry.path) ? 'text-black' : 'text-[#888]'}`}
                    title={entry.path}
                  >
                    {entry.name}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {!showPrivateGate && (
        <footer className="h-[36px] bg-white border-t-[3px] border-black fixed bottom-0 left-0 right-0 z-40 flex items-center justify-between px-4">
          <div className="font-sans text-[11px] font-bold uppercase tracking-wider">
            PAGE {page} OF {computedTotalPages} / {selectedImages.size > 0 ? <span className="text-black bg-[#e0e0e0] px-1.5 py-0.5 mr-1">{selectedImages.size} SELECTED /</span> : null} {pagedEntries.length} SHOWN / {totalVisibleItems} TOTAL
          </div>

          {computedTotalPages > 1 && (
            <div className="flex items-center gap-4 font-sans text-[11px] font-bold uppercase tracking-wider">
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

      {selectedImage && (
        <div
          className="fixed inset-0 z-50 bg-[#F0F0F0]/95 backdrop-blur-sm flex items-center justify-center p-4 sm:p-12 animate-in fade-in duration-200"
          onClick={() => setSelectedImage(null)}
        >
          <div className="absolute top-6 right-6 flex items-center gap-2 z-10">
            <a
              href={`${API_PATH}/download/${encodeURI(selectedImage)}`}
              download
              onClick={e => e.stopPropagation()}
              className="p-2 bg-white border-[2px] border-[#666] hover:bg-black hover:text-white transition-colors flex items-center justify-center"
              title="Download File"
            >
              <Download size={24} strokeWidth={2} />
            </a>
            <button
              className="p-2 bg-white border-[2px] border-[#666] hover:bg-black hover:text-white transition-colors flex items-center justify-center"
              onClick={e => {
                e.stopPropagation();
                setSelectedImage(null);
              }}
              title="Close"
            >
              <X size={24} strokeWidth={2} />
            </button>
          </div>
          <div className="relative w-full h-full flex items-center justify-center flex-col gap-4">
            {isRenderable(selectedImage) ? (
              <img
                src={`${IMAGE_PATH}/${encodeURI(selectedImage)}`}
                alt={selectedImage}
                referrerPolicy="no-referrer"
                className="max-w-full max-h-full object-contain border-[2px] border-[#666] bg-white cursor-pointer"
                onClick={e => {
                  e.stopPropagation();
                  setSelectedImage(null);
                }}
              />
            ) : (
              <div
                className={`w-full max-w-2xl aspect-video border-[2px] bg-white flex flex-col items-center justify-center gap-4 ${selectedFileTone?.border || 'border-[#666]'} ${selectedFileTone?.accent || 'text-[#888]'}`}
                onClick={e => e.stopPropagation()}
              >
                <div className={`w-24 h-24 rounded-full border-[2px] flex items-center justify-center ${selectedFileTone?.border || 'border-[#666]'} ${selectedFileTone?.bg || 'bg-[#F3F3F3]'}`}>
                  <FileImage size={42} strokeWidth={1.5} />
                </div>
                <div className="flex flex-col items-center gap-2 text-center px-6">
                  <span className="text-sm font-bold uppercase tracking-[0.25em]">
                    {getFileTypeCode(selectedImage)}
                  </span>
                  <span className="text-[11px] font-bold uppercase tracking-widest opacity-80">
                    {selectedFileTone?.label || 'FILE'}
                  </span>
                  <span className="text-xs text-[#666]">Preview not available in browser</span>
                </div>
              </div>
            )}
            <div className="bg-white border-[2px] border-[#666] px-4 py-2 font-sans font-bold uppercase text-[11px] text-[#888] flex flex-col items-center text-center">
              <span className="text-black">{labelWithoutExtension(selectedImage)}</span>
              {imageMetaState === 'ready' && imageMeta ? (
                <span className="text-[9px] mt-1 tracking-widest">
                  {imageMeta.type} • {(imageMeta.size / 1024 > 1024 ? `${(imageMeta.size / 1024 / 1024).toFixed(2)} MB` : `${(imageMeta.size / 1024).toFixed(1)} KB`)} • {imageMeta.width} × {imageMeta.height} PX
                </span>
              ) : imageMetaState === 'unavailable' ? (
                <span className="text-[9px] mt-1 tracking-widest">
                  {(extensionOf(selectedImage).replace('.', '').toUpperCase() || 'FILE')} • DOWNLOAD AVAILABLE
                </span>
              ) : (
                <span className="text-[9px] mt-1 tracking-widest animate-pulse">LOADING METADATA...</span>
              )}
              <a
                href={`${IMAGE_PATH}/${encodeURI(selectedImage)}`}
                target="_blank"
                rel="noreferrer"
                className="text-[9px] mt-2 lowercase text-[#F27D26] hover:underline tracking-wider break-all max-w-lg"
                onClick={e => e.stopPropagation()}
              >
                {window.location.origin}/images/{selectedImage}
              </a>
            </div>
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
              {authMessage && <div className="text-[11px] font-bold uppercase tracking-widest text-[#476E66]">{authMessage}</div>}
              {authError && <div className="text-[11px] font-bold uppercase tracking-widest text-[#8A5A44]">{authError}</div>}

              {accountPanel === 'auth' && (
                usesCentralAuth ? (
                  <>
                    <div className="border-[2px] border-[#666] bg-[#F7F7F7] px-4 py-4 flex flex-col gap-3">
                      <div className="text-[10px] font-bold uppercase tracking-widest text-black">Auth JeffersonWM</div>
                      <p className="text-[11px] font-sans text-[#666] leading-relaxed">
                        Perihelion now uses the central account system at <span className="font-bold">{authBaseUrl}</span>.
                        Sign in there, request access there, and make sure your account has Perihelion access before coming back here.
                      </p>
                    </div>
                    <div className="flex items-center gap-3 justify-end">
                      <button
                        onClick={() => setAccountPanel(null)}
                        className="text-[10px] font-bold uppercase tracking-widest text-[#888] hover:text-black"
                      >
                        Close
                      </button>
                      <button
                        onClick={openCentralAuth}
                        className="bg-black text-white px-4 py-2 text-[10px] font-bold uppercase tracking-widest hover:bg-[#333] transition-colors"
                      >
                        Open Auth
                      </button>
                    </div>
                  </>
                ) : (
                <>
                  <div className="flex items-center gap-3 text-[10px] font-bold uppercase tracking-widest">
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
                    <span className="text-[10px] font-bold uppercase tracking-widest text-[#888]">Username</span>
                    <input
                      value={usernameInput}
                      onChange={event => setUsernameInput(event.target.value)}
                      className="border-[2px] border-[#666] px-3 py-2 font-sans text-sm focus:outline-none focus:border-black"
                      autoComplete="username"
                    />
                  </label>

                  <label className="flex flex-col gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-[#888]">Password</span>
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
                        <span className="text-[10px] font-bold uppercase tracking-widest text-[#888]">Confirm Password</span>
                        <input
                          type="password"
                          value={confirmPasswordInput}
                          onChange={event => setConfirmPasswordInput(event.target.value)}
                          className="border-[2px] border-[#666] px-3 py-2 font-sans text-sm focus:outline-none focus:border-black"
                          autoComplete="new-password"
                        />
                      </label>

                      <label className="flex flex-col gap-2">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-[#888]">Who You Are / Why You’re Requesting Access</span>
                        <textarea
                          value={requestNoteInput}
                          onChange={event => setRequestNoteInput(event.target.value)}
                          className="border-[2px] border-[#666] px-3 py-2 font-sans text-sm focus:outline-none focus:border-black min-h-[104px] resize-y"
                        />
                      </label>
                      <p className="text-[11px] font-sans text-[#666] leading-relaxed">
                        If you can, include an email address or a social / web link so I know who the request belongs to and how to follow up.
                      </p>
                    </>
                  )}

                  {!authStatus?.hasUsers && (
                    <p className="text-[11px] font-sans text-[#666] leading-relaxed">
                      The first account you register becomes the initial approved admin.
                    </p>
                  )}
                  {authMode === 'register' && authStatus?.hasUsers && (
                    <p className="text-[11px] font-sans text-[#666] leading-relaxed">
                      New accounts land in the pending queue until an approved admin reviews the request note and approves or blocks access.
                    </p>
                  )}

                  {authStatus?.user && (
                    <div className="border-[2px] border-[#666] bg-[#F7F7F7] px-3 py-3 text-[11px] font-sans leading-relaxed">
                      Signed in as <span className="font-bold">{authStatus.user.username}</span>.
                      {authStatus.user.isAdmin ? ' You can approve or block new accounts.' : ' Your downloads can now be tied to your account history.'}
                    </div>
                  )}

                  <div className="flex items-center gap-3 justify-end">
                    <button
                      onClick={() => setAccountPanel(null)}
                      className="text-[10px] font-bold uppercase tracking-widest text-[#888] hover:text-black"
                    >
                      Close
                    </button>
                    <button
                      onClick={handleAuthSubmit}
                      className="bg-black text-white px-4 py-2 text-[10px] font-bold uppercase tracking-widest hover:bg-[#333] transition-colors"
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
                      <div className="text-[10px] font-bold uppercase tracking-widest text-black">
                        Signed in as {authStatus.user.username}{authStatus.user.isAdmin ? ' • Admin' : ''}
                      </div>
                      <p className="text-[11px] font-sans text-[#666] leading-relaxed">
                        Your settings, history, approvals, and password changes now live in Auth JeffersonWM. Sign out here if you want to switch to a different account. If this archive still stays locked, ask for Perihelion access in the central dashboard.
                      </p>
                    </div>
                    <div className="flex items-center gap-3 justify-end">
                      <button
                        onClick={handleLogout}
                        className="border-[2px] border-[#666] px-4 py-2 text-[10px] font-bold uppercase tracking-widest hover:border-black transition-colors"
                      >
                        Sign Out
                      </button>
                      <button
                        onClick={openCentralAuth}
                        className="bg-black text-white px-4 py-2 text-[10px] font-bold uppercase tracking-widest hover:bg-[#333] transition-colors"
                      >
                        Open Account
                      </button>
                    </div>
                  </>
                ) : (
                <>
                  <div className="border-[2px] border-[#666] bg-[#F7F7F7] px-4 py-4 flex flex-col gap-2">
                    <div className="text-[10px] font-bold uppercase tracking-widest text-black">
                      Signed in as {authStatus.user.username}{authStatus.user.isAdmin ? ' • Admin' : ''}
                    </div>
                    <div className="text-[11px] font-sans text-[#666] leading-relaxed">
                      Sign out completely before moving into another account. Downloads tied to this account will appear below.
                    </div>
                  </div>

                  <div className="border-[2px] border-[#666]">
                    <div className="border-b-[2px] border-[#666] px-4 py-3 bg-[#F7F7F7]">
                      <div className="text-[10px] font-bold uppercase tracking-widest text-black">Change Username</div>
                    </div>
                    <div className="p-4 flex flex-col gap-4">
                      <label className="flex flex-col gap-2">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-[#888]">New Username</span>
                        <input
                          value={newUsernameInput}
                          onChange={event => setNewUsernameInput(event.target.value)}
                          className="border-[2px] border-[#666] px-3 py-2 font-sans text-sm focus:outline-none focus:border-black"
                          autoComplete="username"
                        />
                      </label>

                      <label className="flex flex-col gap-2">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-[#888]">Current Password</span>
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
                          className="bg-black text-white px-4 py-2 text-[10px] font-bold uppercase tracking-widest hover:bg-[#333] transition-colors"
                        >
                          Update Username
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="border-[2px] border-[#666]">
                    <div className="border-b-[2px] border-[#666] px-4 py-3 bg-[#F7F7F7]">
                      <div className="text-[10px] font-bold uppercase tracking-widest text-black">Change Password</div>
                    </div>
                    <div className="p-4 flex flex-col gap-4">
                      <label className="flex flex-col gap-2">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-[#888]">Current Password</span>
                        <input
                          type="password"
                          value={currentPasswordInput}
                          onChange={event => setCurrentPasswordInput(event.target.value)}
                          className="border-[2px] border-[#666] px-3 py-2 font-sans text-sm focus:outline-none focus:border-black"
                          autoComplete="current-password"
                        />
                      </label>

                      <label className="flex flex-col gap-2">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-[#888]">New Password</span>
                        <input
                          type="password"
                          value={newPasswordInput}
                          onChange={event => setNewPasswordInput(event.target.value)}
                          className="border-[2px] border-[#666] px-3 py-2 font-sans text-sm focus:outline-none focus:border-black"
                          autoComplete="new-password"
                        />
                      </label>

                      <label className="flex flex-col gap-2">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-[#888]">Confirm New Password</span>
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
                          className="bg-black text-white px-4 py-2 text-[10px] font-bold uppercase tracking-widest hover:bg-[#333] transition-colors"
                        >
                          Update Password
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="border-[2px] border-[#666]">
                    <div className="border-b-[2px] border-[#666] px-4 py-3 bg-[#F7F7F7]">
                      <div className="text-[10px] font-bold uppercase tracking-widest text-black">Download History</div>
                    </div>
                    {historyLoading ? (
                      <div className="px-4 py-6 text-[11px] font-bold uppercase tracking-widest text-[#888] animate-pulse">Loading History…</div>
                    ) : historyEntries.length === 0 ? (
                      <div className="px-4 py-6 text-center text-[11px] font-bold uppercase tracking-widest text-[#888]">
                        No tracked downloads yet.
                      </div>
                    ) : (
                      <div className="divide-y-[2px] divide-[#666] max-h-[320px] overflow-y-auto">
                        {historyEntries.map(entry => (
                          <div key={entry.id} className="px-4 py-3 flex flex-col gap-1">
                            <div className="flex items-center justify-between gap-4">
                              <span className="text-[10px] font-bold uppercase tracking-widest text-black">{basename(entry.output_name || entry.file_path)}</span>
                              <span className="text-[9px] font-bold uppercase tracking-widest text-[#888]">{new Date(entry.created_at).toLocaleString()}</span>
                            </div>
                            <span className="text-[10px] font-bold uppercase tracking-widest text-[#888]">{entry.action} • {entry.output_name || entry.file_path}</span>
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
                      <div className="text-[10px] font-bold uppercase tracking-widest text-black">Central Dashboard</div>
                      <p className="text-[11px] font-sans text-[#666] leading-relaxed">
                        Account approvals, blocking, deletions, per-site access, and audit history now live in Auth JeffersonWM so one dashboard can eventually serve all the sites.
                      </p>
                    </div>
                    <div className="flex items-center gap-3 justify-end">
                      <button
                        onClick={() => setAccountPanel(null)}
                        className="text-[10px] font-bold uppercase tracking-widest text-[#888] hover:text-black"
                      >
                        Close
                      </button>
                      <button
                        onClick={openCentralAuth}
                        className="bg-black text-white px-4 py-2 text-[10px] font-bold uppercase tracking-widest hover:bg-[#333] transition-colors"
                      >
                        Open Dashboard
                      </button>
                    </div>
                  </>
                ) : (
                <>
                  <p className="text-[11px] font-sans text-[#666] leading-relaxed">
                    This dashboard keeps the whole approval flow in one place: review incoming requests, approve or block them, and remove accounts that should no longer exist.
                  </p>
                  {adminLoading ? (
                    <div className="text-[11px] font-bold uppercase tracking-widest text-[#888] animate-pulse">Loading Accounts…</div>
                  ) : (
                    <div className="flex flex-col gap-4">
                      <div className="border-[2px] border-[#666]">
                        <div className="border-b-[2px] border-[#666] px-4 py-3 bg-[#F7F7F7] flex items-center justify-between gap-4">
                          <div>
                            <div className="text-[10px] font-bold uppercase tracking-widest text-black">Pending Requests</div>
                            <div className="text-[9px] font-bold uppercase tracking-widest text-[#888]">
                              Review who is asking and why before access is granted.
                            </div>
                          </div>
                          <div className="text-[10px] font-bold uppercase tracking-widest text-[#888]">{pendingUsers.length}</div>
                        </div>
                        {pendingUsers.length === 0 ? (
                          <div className="px-4 py-6 text-center text-[11px] font-bold uppercase tracking-widest text-[#888]">
                            No pending requests.
                          </div>
                        ) : (
                          <div className="divide-y-[2px] divide-[#666] max-h-[240px] overflow-y-auto">
                            {pendingUsers.map(user => (
                              <div key={user.id} className="px-4 py-4 flex flex-col gap-3">
                                <div className="flex items-start justify-between gap-4">
                                  <div className="min-w-0">
                                    <div className="text-[10px] font-bold uppercase tracking-widest text-black truncate">
                                      {user.username} {user.isAdmin ? '• Admin' : ''}
                                    </div>
                                    <div className="text-[9px] font-bold uppercase tracking-widest text-[#888]">
                                      Requested {new Date(user.createdAt).toLocaleString()}
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-3 shrink-0">
                                    <button
                                      onClick={() => handleAdminAction(user.id, 'approve')}
                                      className="text-[10px] font-bold uppercase tracking-widest text-[#476E66] hover:text-black"
                                    >
                                      Approve
                                    </button>
                                    <button
                                      onClick={() => handleAdminAction(user.id, 'block')}
                                      className="text-[10px] font-bold uppercase tracking-widest text-[#8A5A44] hover:text-black"
                                    >
                                      Block
                                    </button>
                                    <button
                                      onClick={() => handleDeleteUser(user.id)}
                                      className="text-[10px] font-bold uppercase tracking-widest text-[#888] hover:text-black"
                                    >
                                      Delete
                                    </button>
                                  </div>
                                </div>
                                <div className="border-[2px] border-[#666] bg-[#F7F7F7] px-3 py-3 text-[11px] font-sans leading-relaxed text-[#444]">
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
                            <div className="text-[10px] font-bold uppercase tracking-widest text-black">Approved Accounts</div>
                            <div className="text-[9px] font-bold uppercase tracking-widest text-[#888]">
                              Members with active access right now.
                            </div>
                          </div>
                          <div className="text-[10px] font-bold uppercase tracking-widest text-[#888]">{approvedUsers.length}</div>
                        </div>
                        {approvedUsers.length === 0 ? (
                          <div className="px-4 py-6 text-center text-[11px] font-bold uppercase tracking-widest text-[#888]">
                            No approved accounts yet.
                          </div>
                        ) : (
                          <div className="divide-y-[2px] divide-[#666] max-h-[220px] overflow-y-auto">
                            {approvedUsers.map(user => (
                              <div key={user.id} className="px-4 py-3 flex items-center justify-between gap-4">
                                <div className="min-w-0">
                                  <div className="text-[10px] font-bold uppercase tracking-widest text-black truncate">
                                    {user.username} {user.isAdmin ? '• Admin' : ''}
                                  </div>
                                  <div className="text-[9px] font-bold uppercase tracking-widest text-[#888]">
                                    Approved {user.approvedAt ? new Date(user.approvedAt).toLocaleString() : 'Recently'}
                                  </div>
                                </div>
                                {String(user.id) !== String(authStatus?.user?.id) ? (
                                  <div className="flex items-center gap-3 shrink-0">
                                    <button
                                      onClick={() => handleAdminAction(user.id, 'block')}
                                      className="text-[10px] font-bold uppercase tracking-widest text-[#8A5A44] hover:text-black"
                                    >
                                      Block
                                    </button>
                                    <button
                                      onClick={() => handleDeleteUser(user.id)}
                                      className="text-[10px] font-bold uppercase tracking-widest text-[#888] hover:text-black"
                                    >
                                      Delete
                                    </button>
                                  </div>
                                ) : (
                                  <div className="text-[9px] font-bold uppercase tracking-widest text-[#888] shrink-0">
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
                            <div className="text-[10px] font-bold uppercase tracking-widest text-black">Blocked Accounts</div>
                            <div className="text-[9px] font-bold uppercase tracking-widest text-[#888]">
                              Blocked members can be approved again later or removed entirely.
                            </div>
                          </div>
                          <div className="text-[10px] font-bold uppercase tracking-widest text-[#888]">{blockedUsers.length}</div>
                        </div>
                        {blockedUsers.length === 0 ? (
                          <div className="px-4 py-6 text-center text-[11px] font-bold uppercase tracking-widest text-[#888]">
                            No blocked accounts.
                          </div>
                        ) : (
                          <div className="divide-y-[2px] divide-[#666] max-h-[220px] overflow-y-auto">
                            {blockedUsers.map(user => (
                              <div key={user.id} className="px-4 py-3 flex items-center justify-between gap-4">
                                <div className="min-w-0">
                                  <div className="text-[10px] font-bold uppercase tracking-widest text-black truncate">
                                    {user.username} {user.isAdmin ? '• Admin' : ''}
                                  </div>
                                  <div className="text-[9px] font-bold uppercase tracking-widest text-[#888]">
                                    Blocked {user.blockedAt ? new Date(user.blockedAt).toLocaleString() : 'Recently'}
                                  </div>
                                </div>
                                {String(user.id) !== String(authStatus?.user?.id) ? (
                                  <div className="flex items-center gap-3 shrink-0">
                                    <button
                                      onClick={() => handleAdminAction(user.id, 'approve')}
                                      className="text-[10px] font-bold uppercase tracking-widest text-[#476E66] hover:text-black"
                                    >
                                      Re-Approve
                                    </button>
                                    <button
                                      onClick={() => handleDeleteUser(user.id)}
                                      className="text-[10px] font-bold uppercase tracking-widest text-[#888] hover:text-black"
                                    >
                                      Delete
                                    </button>
                                  </div>
                                ) : (
                                  <div className="text-[9px] font-bold uppercase tracking-widest text-[#888] shrink-0">
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
