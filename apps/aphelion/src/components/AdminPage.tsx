import React, { useEffect, useMemo, useRef, useState } from 'react';
import type {
  AdminCatalogPayload,
  CardCatalogItem,
  CardMetadataRecord,
  CardRarity,
  ControlledLibraryItem,
  ReviewStatus,
  SaveCardPayload,
} from '../curationTypes';
import { RARITY_OPTIONS } from '../curationTypes';

const FILTER_OPTIONS = [
  { id: 'all', label: 'All Cards' },
  { id: 'untagged', label: 'Only Untagged' },
  { id: 'reviewed', label: 'Only Reviewed' },
] as const;
const SERIES_SEPARATOR = ' | ';

type FilterMode = (typeof FILTER_OPTIONS)[number]['id'];
type CountPanel = 'rarity' | 'series' | 'attributes' | '';

type AdminActionRecord = {
  id: string;
  timestamp: string;
  action: string;
  detail: string;
};

type EditorState = {
  title: string;
  description: string;
  rarity: CardRarity | '';
  seriesName: string;
  editionSize: string;
  reviewStatus: ReviewStatus;
  attributes: string[];
};

type AuthStatus = {
  user: null | {
    username: string;
    displayName: string | null;
    isAdmin: boolean;
    isOwner: boolean;
  };
};

type FolderTreeNode = {
  name: string;
  path: string;
  count: number;
  children: FolderTreeNode[];
};

type HighlightAdminImageSummary = {
  key: string;
  count: number;
  lastSelectedAt: string;
  blockIndex: number | null;
  image: {
    id: number | null;
    code: string;
    title: string;
    path: string;
    folder: string;
    thumbUrl: string;
  };
};

type HighlightAdminSummary = {
  ok: boolean;
  generatedAt: string;
  totalEvents: number;
  selectedCount: number;
  clearedCount: number;
  allImages: HighlightAdminImageSummary[];
  topImages: HighlightAdminImageSummary[];
  topFolders: Array<{ folder: string; count: number }>;
  daily: Array<{ date: string; selected: number; cleared: number }>;
};

type HighlightImageViewerState = {
  title: string;
  imageUrl: string;
  directUrl: string;
};

const EMPTY_EDITOR: EditorState = {
  title: '',
  description: '',
  rarity: '',
  seriesName: '',
  editionSize: '',
  reviewStatus: 'untagged',
  attributes: [],
};

const ACTION_HISTORY_STORAGE_KEY = 'aphelion_admin_action_history';
const ACTION_HISTORY_LIMIT = 80;

function prefixApiUrl(apiBaseUrl: string, url: string) {
  if (!url) {
    return '';
  }

  if (/^https?:\/\//i.test(url)) {
    return url;
  }

  const base = apiBaseUrl.trim().replace(/\/$/, '');
  return `${base}${url.startsWith('/') ? '' : '/'}${url}`;
}

function withImageSize(url: string, size: number) {
  if (!url) {
    return '';
  }

  try {
    const resolved = new URL(url, window.location.origin);
    resolved.searchParams.set('size', String(size));
    if (/^https?:\/\//i.test(url)) {
      return resolved.toString();
    }
    return `${resolved.pathname}${resolved.search}${resolved.hash}`;
  } catch {
    return url;
  }
}

function titleCase(value: string) {
  return value.replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatRarityLabel(option: CardRarity, index: number) {
  return `${index + 1} - ${titleCase(option)}`;
}

function splitSeriesNames(value: string) {
  return value
    .split('|')
    .map((item) => item.trim())
    .filter(Boolean);
}

function joinSeriesNames(values: string[]) {
  return Array.from(new Set(values.map((item) => item.trim()).filter(Boolean))).join(SERIES_SEPARATOR);
}

function toggleSeriesName(value: string, label: string) {
  const current = splitSeriesNames(value);
  return current.includes(label)
    ? joinSeriesNames(current.filter((item) => item !== label))
    : joinSeriesNames([...current, label]);
}

function cardToEditor(card: CardCatalogItem | null): EditorState {
  if (!card) {
    return EMPTY_EDITOR;
  }

  return {
    title: card.title || '',
    description: card.description || '',
    rarity: card.rarity || '',
    seriesName: card.seriesName || '',
    editionSize: card.editionSize ? String(card.editionSize) : '',
    reviewStatus: card.reviewStatus,
    attributes: [...card.attributes],
  };
}

function buildStats(cards: CardCatalogItem[]) {
  return {
    total: cards.length,
    reviewed: cards.filter((card) => card.reviewStatus === 'reviewed').length,
    untagged: cards.filter((card) => card.reviewStatus !== 'reviewed').length,
    withRarity: cards.filter((card) => Boolean(card.rarity)).length,
    withSeries: cards.filter((card) => Boolean(card.seriesName)).length,
    withAttributes: cards.filter((card) => card.attributes.length > 0).length,
  };
}

function buildFolderTree(cards: CardCatalogItem[]) {
  const root = new Map<string, {
    name: string;
    path: string;
    count: number;
    children: Map<string, {
      name: string;
      path: string;
      count: number;
      children: Map<string, any>;
    }>;
  }>();

  for (const card of cards) {
    const segments = card.folderPath.split('/').map((segment) => segment.trim()).filter(Boolean);
    let currentLevel = root;
    let currentPath = '';

    for (const segment of segments) {
      currentPath = currentPath ? `${currentPath}/${segment}` : segment;
      let node = currentLevel.get(segment);
      if (!node) {
        node = {
          name: segment,
          path: currentPath,
          count: 0,
          children: new Map(),
        };
        currentLevel.set(segment, node);
      }

      node.count += 1;
      currentLevel = node.children;
    }
  }

  function mapLevel(
    level: Map<string, {
      name: string;
      path: string;
      count: number;
      children: Map<string, any>;
    }>
  ): FolderTreeNode[] {
    return Array.from(level.values())
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }))
      .map((node) => ({
        name: node.name,
        path: node.path,
        count: node.count,
        children: mapLevel(node.children),
      }));
  }

  return mapLevel(root);
}

function collectAncestorPaths(folderPath: string) {
  const segments = folderPath.split('/').map((segment) => segment.trim()).filter(Boolean);
  const paths: string[] = [];

  for (let index = 0; index < segments.length; index += 1) {
    paths.push(segments.slice(0, index + 1).join('/'));
  }

  return paths;
}

function loadActionHistory(): AdminActionRecord[] {
  try {
    const raw = window.localStorage.getItem(ACTION_HISTORY_STORAGE_KEY);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .filter((item) => item && typeof item === 'object' && typeof item.id === 'string' && typeof item.timestamp === 'string' && typeof item.action === 'string' && typeof item.detail === 'string')
      .slice(0, ACTION_HISTORY_LIMIT);
  } catch {
    return [];
  }
}

function formatActionTimestamp(timestamp: string) {
  return new Date(timestamp).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

export function AdminPage({
  apiBaseUrl,
  authStatus,
  onSignOut,
}: {
  apiBaseUrl: string;
  authStatus: AuthStatus | null;
  onSignOut: () => void;
}) {
  const [currentHash, setCurrentHash] = useState(window.location.hash);
  const [cards, setCards] = useState<CardCatalogItem[]>([]);
  const [attributes, setAttributes] = useState<ControlledLibraryItem[]>([]);
  const [series, setSeries] = useState<ControlledLibraryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filterMode, setFilterMode] = useState<FilterMode>('untagged');
  const [countPanel, setCountPanel] = useState<CountPanel>('');
  const [search, setSearch] = useState('');
  const [selectedFolder, setSelectedFolder] = useState('');
  const [selectedRarityFilters, setSelectedRarityFilters] = useState<string[]>([]);
  const [selectedSeriesFilters, setSelectedSeriesFilters] = useState<string[]>([]);
  const [selectedAttributeFilters, setSelectedAttributeFilters] = useState<string[]>([]);
  const [selectedPath, setSelectedPath] = useState('');
  const [expandedFolders, setExpandedFolders] = useState<string[]>([]);
  const [folderPanelOpen, setFolderPanelOpen] = useState(false);
  const [copiedDirectUrl, setCopiedDirectUrl] = useState(false);
  const [imagePreviewOpen, setImagePreviewOpen] = useState(false);
  const [editor, setEditor] = useState<EditorState>(EMPTY_EDITOR);
  const [seriesEntry, setSeriesEntry] = useState('');
  const [attributeEntry, setAttributeEntry] = useState('');
  const [saving, setSaving] = useState(false);
  const [pendingSaveField, setPendingSaveField] = useState('');
  const [savedField, setSavedField] = useState('');
  const [actionHistory, setActionHistory] = useState<AdminActionRecord[]>(() => loadActionHistory());
  const [resetStatus, setResetStatus] = useState('');
  const [highlightSummary, setHighlightSummary] = useState<HighlightAdminSummary | null>(null);
  const [highlightLoading, setHighlightLoading] = useState(false);
  const [highlightError, setHighlightError] = useState('');
  const [highlightViewer, setHighlightViewer] = useState<HighlightImageViewerState | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loadedEditorPathRef = useRef('');

  useEffect(() => {
    const handleHashChange = () => setCurrentHash(window.location.hash);
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadCatalog() {
      setLoading(true);
      try {
        const response = await fetch(`${apiBaseUrl}/api/admin/catalog`, {
          credentials: 'include',
        });
        if (!response.ok) {
          throw new Error(`Admin catalog returned ${response.status}`);
        }

        const payload = (await response.json()) as AdminCatalogPayload;
        if (cancelled) {
          return;
        }

        setCards(payload.cards);
        setAttributes(payload.attributes);
        setSeries(payload.series);
        setError('');
        setExpandedFolders((current) => (
          current.length > 0
            ? current
            : Array.from(new Set(payload.cards.map((card) => card.folderPath.split('/')[0]).filter(Boolean)))
        ));
        setSelectedPath((current) => current || payload.cards[0]?.imagePath || '');
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : 'Admin catalog could not be loaded.');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadCatalog();
    return () => {
      cancelled = true;
    };
  }, [apiBaseUrl]);

  const folderTree = useMemo(() => buildFolderTree(cards), [cards]);
  const expandedFolderSet = useMemo(() => new Set(expandedFolders), [expandedFolders]);
  const quickAttributes = useMemo(() => attributes.slice(0, 6).map((item) => item.label), [attributes]);
  const rarityCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const rarity of RARITY_OPTIONS) {
      counts.set(rarity, 0);
    }
    for (const card of cards) {
      if (card.rarity) {
        counts.set(card.rarity, (counts.get(card.rarity) || 0) + 1);
      }
    }

    return Array.from(counts.entries());
  }, [cards]);
  const seriesCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of series) {
      counts.set(item.label, 0);
    }
    for (const card of cards) {
      for (const name of splitSeriesNames(card.seriesName)) {
        counts.set(name, (counts.get(name) || 0) + 1);
      }
    }

    return Array.from(counts.entries()).sort((a, b) => a[0].localeCompare(b[0], undefined, { numeric: true, sensitivity: 'base' }));
  }, [cards, series]);
  const attributeCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of attributes) {
      counts.set(item.label, 0);
    }
    for (const card of cards) {
      for (const attribute of card.attributes) {
        counts.set(attribute, (counts.get(attribute) || 0) + 1);
      }
    }

    return Array.from(counts.entries()).sort((a, b) => a[0].localeCompare(b[0], undefined, { numeric: true, sensitivity: 'base' }));
  }, [attributes, cards]);

  const filteredCards = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return cards.filter((card) => {
      if (selectedFolder && card.folderPath !== selectedFolder && !card.folderPath.startsWith(`${selectedFolder}/`)) {
        return false;
      }
      if (selectedRarityFilters.length > 0 && (!card.rarity || !selectedRarityFilters.includes(card.rarity))) {
        return false;
      }
      if (selectedSeriesFilters.length > 0 && !splitSeriesNames(card.seriesName).some((item) => selectedSeriesFilters.includes(item))) {
        return false;
      }
      if (selectedAttributeFilters.length > 0 && !card.attributes.some((item) => selectedAttributeFilters.includes(item))) {
        return false;
      }

      if (filterMode === 'untagged' && card.reviewStatus === 'reviewed') {
        return false;
      }
      if (filterMode === 'reviewed' && card.reviewStatus !== 'reviewed') {
        return false;
      }

      if (!normalizedSearch) {
        return true;
      }

      const haystack = [
        card.imageCode,
        card.imagePath,
        card.folderPath,
        card.sourceTitle,
        card.title,
        card.seriesName,
        card.description,
        ...card.sourceTags,
        ...card.attributes,
      ]
        .join(' ')
        .toLowerCase();

      return haystack.includes(normalizedSearch);
    });
  }, [cards, filterMode, search, selectedAttributeFilters, selectedFolder, selectedRarityFilters, selectedSeriesFilters]);

  const selectedCard = useMemo(() => {
    return filteredCards.find((card) => card.imagePath === selectedPath)
      || cards.find((card) => card.imagePath === selectedPath)
      || filteredCards[0]
      || null;
  }, [cards, filteredCards, selectedPath]);
  const selectedDirectUrl = selectedCard ? prefixApiUrl(apiBaseUrl, selectedCard.imageUrl) : '';

  const stats = useMemo(() => buildStats(cards), [cards]);
  const filteredStats = useMemo(() => buildStats(filteredCards), [filteredCards]);
  const selectedRarityCount = selectedRarityFilters.length > 0
    ? cards.filter((card) => card.rarity && selectedRarityFilters.includes(card.rarity)).length
    : stats.withRarity;
  const selectedSeriesCount = selectedSeriesFilters.length > 0
    ? cards.filter((card) => splitSeriesNames(card.seriesName).some((item) => selectedSeriesFilters.includes(item))).length
    : stats.withSeries;
  const selectedAttributeCount = selectedAttributeFilters.length > 0
    ? cards.filter((card) => card.attributes.some((item) => selectedAttributeFilters.includes(item))).length
    : stats.withAttributes;
  const selectedRarityHeader = selectedRarityFilters.length > 0
    ? selectedRarityFilters.map((label) => {
        const selectedRarityIndex = RARITY_OPTIONS.indexOf(label as CardRarity);
        return selectedRarityIndex >= 0 ? formatRarityLabel(label as CardRarity, selectedRarityIndex) : label;
      }).join(', ')
    : 'With Rarity';
  const selectedSeriesHeader = selectedSeriesFilters.length > 0 ? selectedSeriesFilters.join(', ') : 'With Series';
  const selectedAttributeHeader = selectedAttributeFilters.length > 0 ? selectedAttributeFilters.map((item) => `#${item}`).join(', ') : 'With Attributes';
  const isOptionsPage = currentHash === '#options';
  const isAdminHighlightsPage = currentHash === '#admin-highlights';

  useEffect(() => {
    if (!isAdminHighlightsPage) {
      return;
    }

    let cancelled = false;

    async function loadHighlightSummary() {
      setHighlightLoading(true);
      try {
        const response = await fetch(`${apiBaseUrl}/api/highlight-events/summary`, {
          credentials: 'include',
        });
        if (!response.ok) {
          throw new Error(`Highlight summary returned ${response.status}`);
        }

        const payload = (await response.json()) as HighlightAdminSummary;
        if (cancelled) {
          return;
        }

        setHighlightSummary(payload);
        setHighlightError('');
      } catch (loadError) {
        if (!cancelled) {
          setHighlightError(loadError instanceof Error ? loadError.message : 'Highlight details could not be loaded.');
        }
      } finally {
        if (!cancelled) {
          setHighlightLoading(false);
        }
      }
    }

    void loadHighlightSummary();
    return () => {
      cancelled = true;
    };
  }, [apiBaseUrl, isAdminHighlightsPage]);

  useEffect(() => {
    if (!highlightViewer) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setHighlightViewer(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [highlightViewer]);

  const highlightedCards = useMemo(() => {
    if (!highlightSummary) {
      return [];
    }

    return highlightSummary.allImages.map((item) => {
      const matchedCard = cards.find((card) => card.imageCode === item.image.code) || null;
      const directUrl = matchedCard
        ? prefixApiUrl(apiBaseUrl, withImageSize(matchedCard.imageUrl, 2048))
        : prefixApiUrl(apiBaseUrl, withImageSize(item.image.thumbUrl, 2048));
      const thumbUrl = matchedCard
        ? prefixApiUrl(apiBaseUrl, withImageSize(matchedCard.thumbUrl || matchedCard.imageUrl, 2048))
        : prefixApiUrl(apiBaseUrl, withImageSize(item.image.thumbUrl, 2048));

      return {
        summary: item,
        card: matchedCard,
        directUrl,
        thumbUrl,
        displayTitle: matchedCard?.title || matchedCard?.sourceTitle || item.image.title || item.image.code,
      };
    });
  }, [apiBaseUrl, cards, highlightSummary]);

  useEffect(() => {
    if (!selectedCard) {
      loadedEditorPathRef.current = '';
      setPendingSaveField('');
      setSavedField('');
      setEditor(EMPTY_EDITOR);
      return;
    }

    if (selectedCard.imagePath !== loadedEditorPathRef.current) {
      loadedEditorPathRef.current = selectedCard.imagePath;
      setPendingSaveField('');
      setSavedField('');
      setEditor(cardToEditor(selectedCard));
    }
    if (selectedCard.imagePath !== selectedPath) {
      setSelectedPath(selectedCard.imagePath);
    }
  }, [selectedCard, selectedPath]);

  useEffect(() => {
    if (!selectedFolder) {
      return;
    }

    setExpandedFolders((current) => Array.from(new Set([...current, ...collectAncestorPaths(selectedFolder)])));
  }, [selectedFolder]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && imagePreviewOpen) {
        setImagePreviewOpen(false);
        return;
      }

      if (!selectedCard || saving) {
        return;
      }

      const target = event.target as HTMLElement | null;
      const isTextArea = target instanceof HTMLTextAreaElement;
      const isInput = target instanceof HTMLInputElement;

      if (!isTextArea && !isInput) {
        const key = event.key.toLowerCase();
        if (['1', '2', '3', '4', '5'].includes(key)) {
          event.preventDefault();
          const rarity = RARITY_OPTIONS[Number(key) - 1];
          updateEditor('Rarity', (current) => ({ ...current, rarity }));
          return;
        }

        if (key === 'f' || key === 'b') {
          event.preventDefault();
          const label = key === 'f' ? quickAttributes[0] : quickAttributes[1];
          if (!label) {
            return;
          }
          updateEditor('Attributes', (current) => ({
            ...current,
            attributes: current.attributes.includes(label)
              ? current.attributes.filter((item) => item !== label)
              : [...current.attributes, label],
          }));
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedCard, saving, editor, quickAttributes, imagePreviewOpen]);

  function updateCardLocally(record: CardMetadataRecord) {
    setCards((current) => current.map((card) => (
      card.imagePath === record.imagePath
        ? {
            ...card,
            id: record.id,
            cardUid: record.cardUid,
            title: record.title,
            description: record.description,
            rarity: record.rarity,
            seriesName: record.seriesName,
            editionSize: record.editionSize,
            reviewStatus: record.reviewStatus,
            attributes: record.attributes,
            updatedAt: record.updatedAt,
          }
        : card
    )));
  }

  function showSaved(fieldLabel: string) {
    setSavedField(fieldLabel);
    if (savedTimerRef.current) {
      clearTimeout(savedTimerRef.current);
    }
    savedTimerRef.current = setTimeout(() => setSavedField(''), 1000);
  }

  function updateEditor(fieldLabel: string, updater: (current: EditorState) => EditorState) {
    setPendingSaveField(fieldLabel);
    setEditor(updater);
  }

  async function handleSave(fieldLabel = '') {
    if (!selectedCard) {
      return;
    }

    setSaving(true);
    try {
      const payload: SaveCardPayload = {
        imagePath: selectedCard.imagePath,
        imageCode: selectedCard.imageCode,
        folderPath: selectedCard.folderPath,
        title: editor.title,
        description: editor.description,
        rarity: editor.rarity || null,
        seriesName: editor.seriesName,
        editionSize: editor.editionSize ? Number(editor.editionSize) : null,
        reviewStatus: editor.reviewStatus,
        attributes: editor.attributes,
      };

      const response = await fetch(`${apiBaseUrl}/api/admin/cards`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`Save returned ${response.status}`);
      }

      const result = await response.json() as {
        ok: boolean;
        card: CardMetadataRecord;
        attributes: ControlledLibraryItem[];
        series: ControlledLibraryItem[];
      };

      updateCardLocally(result.card);
      setAttributes(result.attributes);
      setSeries(result.series);
      setPendingSaveField('');
      if (fieldLabel) {
        showSaved(fieldLabel);
        recordAction(
          'Save',
          `${fieldLabel} saved for ${selectedCard.title || selectedCard.sourceTitle || selectedCard.imageCode}`
        );
      }
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Card metadata could not be saved.');
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    if (!selectedCard || !pendingSaveField || saving) {
      return;
    }

    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
    }

    saveTimerRef.current = setTimeout(() => {
      void handleSave(pendingSaveField);
    }, 450);

    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }
    };
  }, [editor, pendingSaveField, saving, selectedCard?.imagePath]);

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }
      if (savedTimerRef.current) {
        clearTimeout(savedTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(ACTION_HISTORY_STORAGE_KEY, JSON.stringify(actionHistory.slice(0, ACTION_HISTORY_LIMIT)));
    } catch {
      // Ignore storage errors in restricted browser contexts.
    }
  }, [actionHistory]);

  function recordAction(action: string, detail: string) {
    const entry: AdminActionRecord = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
      timestamp: new Date().toISOString(),
      action,
      detail,
    };

    setActionHistory((current) => [entry, ...current].slice(0, ACTION_HISTORY_LIMIT));
  }

  async function postLibrary(endpoint: string, label: string, setter: (items: ControlledLibraryItem[]) => void, stateReset?: () => void) {
    const cleaned = label.trim();
    if (!cleaned) {
      return;
    }

    const response = await fetch(`${apiBaseUrl}${endpoint}`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label: cleaned }),
    });
    const result = await response.json();
    if (!response.ok || !result.ok) {
      throw new Error(result.error || `Library update returned ${response.status}`);
    }

    setter(result.attributes || result.series);
    stateReset?.();
    recordAction('Add', `${cleaned} added to ${endpoint.includes('/series') ? 'Series Library' : 'Attribute Library'}`);
  }

  async function patchLibrary(
    endpoint: string,
    id: number,
    currentLabel: string,
    setter: (items: ControlledLibraryItem[]) => void
  ) {
    const nextLabel = window.prompt('Rename item', currentLabel);
    if (!nextLabel || nextLabel.trim() === currentLabel) {
      return;
    }

    const response = await fetch(`${apiBaseUrl}${endpoint}/${id}`, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label: nextLabel.trim(), previousLabel: currentLabel }),
    });
    const result = await response.json();
    if (!response.ok || !result.ok) {
      throw new Error(result.error || `Library rename returned ${response.status}`);
    }

    setter(result.attributes || result.series);
    setCards((current) => current.map((card) => (
      endpoint.includes('/series')
        ? { ...card, seriesName: joinSeriesNames(splitSeriesNames(card.seriesName).map((item) => (item === currentLabel ? nextLabel.trim() : item))) }
        : {
            ...card,
            attributes: card.attributes.map((item) => (item === currentLabel ? nextLabel.trim() : item)),
          }
    )));
    setEditor((current) => ({
      ...current,
      seriesName: endpoint.includes('/series')
        ? joinSeriesNames(splitSeriesNames(current.seriesName).map((item) => (item === currentLabel ? nextLabel.trim() : item)))
        : current.seriesName,
      attributes: endpoint.includes('/attributes')
        ? current.attributes.map((item) => (item === currentLabel ? nextLabel.trim() : item))
        : current.attributes,
    }));
    recordAction(
      'Rename',
      `${currentLabel} renamed to ${nextLabel.trim()} in ${endpoint.includes('/series') ? 'Series Library' : 'Attribute Library'}`
    );
  }

  async function deleteLibrary(
    endpoint: string,
    id: number,
    label: string,
    setter: (items: ControlledLibraryItem[]) => void
  ) {
    const isAttributeDelete = endpoint.includes('/attributes');
    const assignedCount = isAttributeDelete
      ? cards.filter((card) => card.attributes.includes(label)).length
      : 0;
    const confirmation = isAttributeDelete
      ? `Delete "${label}" from the Attribute Library?\n\nIt is currently assigned to ${assignedCount} image${assignedCount === 1 ? '' : 's'}. Deleting it will remove that attribute from those card records too.`
      : `Delete "${label}" from the library?`;

    if (!window.confirm(confirmation)) {
      return;
    }

    const response = await fetch(`${apiBaseUrl}${endpoint}/${id}`, {
      method: 'DELETE',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label }),
    });
    const result = await response.json();
    if (!response.ok || !result.ok) {
      throw new Error(result.error || `Library delete returned ${response.status}`);
    }

    setter(result.attributes || result.series);
    setCards((current) => current.map((card) => (
      endpoint.includes('/series')
        ? { ...card, seriesName: joinSeriesNames(splitSeriesNames(card.seriesName).filter((item) => item !== label)) }
        : { ...card, attributes: card.attributes.filter((item) => item !== label) }
    )));
    setEditor((current) => ({
      ...current,
      seriesName: endpoint.includes('/series')
        ? joinSeriesNames(splitSeriesNames(current.seriesName).filter((item) => item !== label))
        : current.seriesName,
      attributes: endpoint.includes('/attributes')
        ? current.attributes.filter((item) => item !== label)
        : current.attributes,
    }));
    recordAction(
      'Delete',
      `${label} removed from ${endpoint.includes('/series') ? 'Series Library' : 'Attribute Library'}${isAttributeDelete ? ` (${assignedCount} affected images)` : ''}`
    );
  }

  function toggleAttribute(label: string) {
    updateEditor('Attributes', (current) => ({
      ...current,
      attributes: current.attributes.includes(label)
        ? current.attributes.filter((item) => item !== label)
        : [...current.attributes, label],
    }));
  }

  function toggleFolderExpansion(folderPath: string) {
    setExpandedFolders((current) => (
      current.includes(folderPath)
        ? current.filter((item) => item !== folderPath)
        : [...current, folderPath]
    ));
  }

  function handleFolderSelect(folderPath: string) {
    setSelectedFolder(folderPath);
    setFolderPanelOpen(false);
  }

  async function handleDirectUrlCopy() {
    if (!selectedDirectUrl) {
      return;
    }

    await navigator.clipboard.writeText(selectedDirectUrl);
    setCopiedDirectUrl(true);
    window.setTimeout(() => setCopiedDirectUrl(false), 1200);
  }

  async function handleAddAttributeFromPanel() {
    const label = window.prompt('Add attribute');
    if (!label || !label.trim()) {
      return;
    }

    await postLibrary('/api/admin/attributes', label, setAttributes);
  }

  async function handleAttributeEntryAdd() {
    const label = attributeEntry.trim();
    if (!label) {
      return;
    }

    const exists = attributes.some((attribute) => attribute.label.toLowerCase() === label.toLowerCase());
    if (!exists) {
      await postLibrary('/api/admin/attributes', label, setAttributes);
    }

    updateEditor('Attributes', (current) => ({
      ...current,
      attributes: current.attributes.includes(label) ? current.attributes : [...current.attributes, label],
    }));
    setAttributeEntry('');
    recordAction('Assign', `#${label} added to the current card`);
  }

  async function handleSeriesEntryAdd() {
    const label = seriesEntry.trim();
    if (!label) {
      return;
    }

    const existing = series.find((item) => item.label.toLowerCase() === label.toLowerCase());
    const finalLabel = existing?.label || label;
    if (!existing) {
      await postLibrary('/api/admin/series', label, setSeries);
    }

    updateEditor('Series', (current) => ({
      ...current,
      seriesName: splitSeriesNames(current.seriesName).includes(finalLabel)
        ? current.seriesName
        : joinSeriesNames([...splitSeriesNames(current.seriesName), finalLabel]),
    }));
    setSeriesEntry('');
    recordAction('Assign', `${finalLabel} added to the current card series`);
  }

  async function handleAddSeriesFromPanel() {
    const label = window.prompt('Add series');
    if (!label || !label.trim()) {
      return;
    }

    await postLibrary('/api/admin/series', label, setSeries);
  }

  function renderFolderNode(node: FolderTreeNode, depth = 0): React.ReactNode {
    const hasChildren = node.children.length > 0;
    const isExpanded = expandedFolderSet.has(node.path);
    const isSelected = selectedFolder === node.path;

    return (
      <div key={node.path}>
        <div
          className="flex items-center gap-2 px-3 py-2"
          style={{ paddingLeft: `${12 + depth * 16}px` }}
        >
          <button
            type="button"
            onClick={() => {
              if (hasChildren) {
                toggleFolderExpansion(node.path);
              }
            }}
            className={`w-4 font-sans text-xs ${hasChildren ? 'text-gray-500 hover:text-gray-900' : 'text-gray-300'}`}
            aria-label={hasChildren ? `${isExpanded ? 'Collapse' : 'Expand'} ${node.name}` : undefined}
          >
            {hasChildren ? (isExpanded ? '−' : '+') : '·'}
          </button>
          <button
            type="button"
            onClick={() => handleFolderSelect(node.path)}
            className={`min-w-0 flex-1 text-left font-sans text-sm ${
              isSelected ? 'font-semibold text-blue-700' : 'text-gray-800 hover:text-[#de8bf7]'
            }`}
          >
            <span className="truncate">{node.name}</span>
          </button>
          <span className="font-sans text-[11px] uppercase tracking-[0.12em] text-gray-400">{node.count}</span>
        </div>
        {hasChildren && isExpanded && (
          <div>{node.children.map((child) => renderFolderNode(child, depth + 1))}</div>
        )}
      </div>
    );
  }

  function savedNotice(fieldLabel: string) {
    return (
      <span
        className={`ml-2 font-sans text-[10px] font-semibold normal-case tracking-normal text-gray-500 transition-opacity ${
          savedField === fieldLabel ? 'opacity-100 duration-100' : 'opacity-0 duration-1000'
        }`}
      >
        Saved
      </span>
    );
  }

  function renderLibraryOptions(
    title: string,
    items: ControlledLibraryItem[],
    endpoint: string,
    setter: (items: ControlledLibraryItem[]) => void
  ) {
    return (
      <section className="border border-[#e5e5e5] bg-white">
        <div className="flex items-center justify-between border-b border-[#e5e5e5] px-4 py-3 font-sans text-xs uppercase tracking-[0.16em] text-gray-500">
          <span>{title}</span>
          <button
            type="button"
            onClick={() => {
              const label = window.prompt(`Add ${title.toLowerCase().replace(' library', '')}`);
              if (label) {
                void postLibrary(endpoint, label, setter);
              }
            }}
            className="font-sans text-xs font-semibold normal-case tracking-normal text-gray-700 hover:text-[#de8bf7]"
          >
            Add
          </button>
        </div>
        <div className="grid gap-2 p-4">
          {items.map((item) => (
            <div key={item.id} className="flex items-center gap-3 border border-[#efefef] px-3 py-2">
              <span className="min-w-0 flex-1 truncate font-sans text-sm text-gray-900">{item.label}</span>
              <button
                type="button"
                onClick={() => void patchLibrary(endpoint, item.id, item.label, setter)}
                className="font-sans text-xs font-semibold text-gray-500 hover:text-[#de8bf7]"
              >
                Rename
              </button>
              <button
                type="button"
                onClick={() => void deleteLibrary(endpoint, item.id, item.label, setter)}
                className="font-sans text-xs font-semibold text-red-600"
              >
                Delete
              </button>
            </div>
          ))}
          {items.length === 0 && (
            <div className="font-sans text-sm text-gray-500">No entries yet.</div>
          )}
        </div>
      </section>
    );
  }

  function renderActionHistory() {
    return (
      <section className="border border-[#e5e5e5] bg-white xl:col-span-2">
        <div className="flex items-center justify-between border-b border-[#e5e5e5] px-4 py-3 font-sans text-xs uppercase tracking-[0.16em] text-gray-500">
          <span>Action History</span>
          <span className="text-[10px] normal-case tracking-normal text-gray-400">
            {actionHistory.length} entries
          </span>
        </div>
        <div className="max-h-[320px] overflow-y-auto p-4">
          {actionHistory.length === 0 ? (
            <div className="font-sans text-sm text-gray-500">No actions recorded yet.</div>
          ) : (
            <div className="grid gap-2">
              {actionHistory.map((entry) => (
                <article key={entry.id} className="border border-[#efefef] px-3 py-2">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="font-sans text-xs font-semibold uppercase tracking-[0.16em] text-gray-700">
                        {entry.action}
                      </div>
                      <div className="mt-1 font-sans text-sm text-gray-900">{entry.detail}</div>
                    </div>
                    <div className="shrink-0 font-sans text-[10px] uppercase tracking-[0.12em] text-gray-400">
                      {formatActionTimestamp(entry.timestamp)}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>
    );
  }

  async function handleHighlightReset(mode: 'all' | 'least-popular-50' | 'least-popular-90') {
    setResetStatus('Checking current highlights...');
    try {
      const previewResponse = await fetch(`${apiBaseUrl}/api/admin/highlight-resets/preview?mode=${encodeURIComponent(mode)}`, {
        credentials: 'include',
      });
      const preview = await previewResponse.json();
      if (!previewResponse.ok) {
        throw new Error(preview?.error || 'Reset preview failed.');
      }

      const modeLabel = mode === 'all'
        ? 'all active highlights'
        : mode === 'least-popular-50'
          ? 'the least popular 50% of active highlights'
          : 'the least popular 90% of active highlights';
      const confirmed = window.confirm(
        `Soft reset ${modeLabel}?\n\nThis will remove ${preview.resetCount} of ${preview.totalActive} active highlighted image${preview.totalActive === 1 ? '' : 's'} from the master Highlights view. The raw history stays intact.`
      );
      if (!confirmed) {
        setResetStatus('Reset cancelled.');
        return;
      }

      const response = await fetch(`${apiBaseUrl}/api/admin/highlight-resets`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error || 'Reset failed.');
      }

      setResetStatus(`Reset complete: ${payload.resetCount} active highlight${payload.resetCount === 1 ? '' : 's'} removed from the public summary.`);
      recordAction('Soft reset', `${payload.resetCount} highlights reset with mode ${mode}`);
    } catch (error) {
      setResetStatus(error instanceof Error ? error.message : 'Reset failed.');
    }
  }

  async function handleJsonExport(kind: 'all-images' | 'highlighted-images') {
    setResetStatus(`Preparing ${kind === 'all-images' ? 'all images' : 'highlighted images'} JSON...`);
    try {
      const response = await fetch(`${apiBaseUrl}/api/admin/exports/${kind}`, {
        credentials: 'include',
      });
      const payload = await response.json();
      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.error || 'Export failed.');
      }

      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `aphelion-${kind}-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      setResetStatus(`Export complete: ${payload.total || 0} ${kind === 'all-images' ? 'image' : 'highlight'} record${payload.total === 1 ? '' : 's'} downloaded.`);
      recordAction('Export', `${kind} JSON exported with ${payload.total || 0} records`);
    } catch (error) {
      setResetStatus(error instanceof Error ? error.message : 'Export failed.');
    }
  }

  function renderHighlightMaintenance() {
    return (
      <section className="border border-[#e5e5e5] bg-white xl:col-span-2">
        <div className="flex items-center justify-between border-b border-[#e5e5e5] px-4 py-3 font-sans text-xs uppercase tracking-[0.16em] text-gray-500">
          <span>Highlight Maintenance</span>
          <span className="text-[10px] normal-case tracking-normal text-gray-400">
            Preferred admin only
          </span>
        </div>
        <div className="grid gap-3 p-4 font-sans text-sm text-gray-800">
          <p className="m-0">
            These controls soft reset the master Highlights view without deleting the raw event log. Use them to clear stale public trends while keeping the history available for later reporting and visualizations.
          </p>
          <div className="flex flex-wrap gap-3">
            <button type="button" onClick={() => void handleHighlightReset('all')} className="border border-gray-900 px-3 py-2 font-semibold text-gray-900 hover:text-[#de8bf7]">
              Reset All Highlights
            </button>
            <button type="button" onClick={() => void handleHighlightReset('least-popular-50')} className="border border-gray-900 px-3 py-2 font-semibold text-gray-900 hover:text-[#de8bf7]">
              Reset Least Popular 50%
            </button>
            <button type="button" onClick={() => void handleHighlightReset('least-popular-90')} className="border border-gray-900 px-3 py-2 font-semibold text-gray-900 hover:text-[#de8bf7]">
              Reset Least Popular 90%
            </button>
            <a href={`${apiBaseUrl}/api/highlight-events/summary`} target="_blank" rel="noopener noreferrer" className="border border-gray-900 px-3 py-2 font-semibold text-gray-900 hover:text-[#de8bf7]">
              Open Highlight Summary JSON
            </a>
            <button type="button" onClick={() => void handleJsonExport('all-images')} className="border border-gray-900 px-3 py-2 font-semibold text-gray-900 hover:text-[#de8bf7]">
              Download All Images JSON
            </button>
            <button type="button" onClick={() => void handleJsonExport('highlighted-images')} className="border border-gray-900 px-3 py-2 font-semibold text-gray-900 hover:text-[#de8bf7]">
              Download Highlighted Images JSON
            </button>
          </div>
          {resetStatus && (
            <div className="text-gray-600">{resetStatus}</div>
          )}
        </div>
      </section>
    );
  }

  function renderAdminHighlightsPage() {
    return (
      <>
        <main className="h-[calc(100vh-72px)] overflow-y-auto px-[36px] py-[16px]">
          <div className="mb-4 border-b border-[#e5e5e5] pb-2 font-sans text-sm text-gray-900">
            <span className="font-semibold">Highlights</span> - review the current master highlight list with card identity details and direct image links.
            {highlightSummary && (
              <span className="ml-2 text-gray-500">
                {highlightedCards.length} highlighted image{highlightedCards.length === 1 ? '' : 's'} in the current public summary.
              </span>
            )}
          </div>

          {highlightError && (
            <div className="mb-4 border border-red-200 bg-red-50 px-4 py-3 font-sans text-sm text-red-700">
              {highlightError}
            </div>
          )}

          {highlightLoading && !highlightSummary ? (
            <div className="font-sans text-sm text-gray-500">Loading highlight details...</div>
          ) : highlightSummary && highlightedCards.length === 0 ? (
            <div className="border border-[#e5e5e5] bg-white px-4 py-6 font-sans text-sm text-gray-500">
              No active highlighted images are currently recorded.
            </div>
          ) : (
            <div className="grid gap-4">
              {highlightedCards.map(({ summary, card, directUrl, thumbUrl, displayTitle }) => (
                <article key={summary.key} className="grid gap-4 border border-[#e5e5e5] bg-white p-4 xl:grid-cols-[140px_minmax(0,1fr)] xl:items-start">
                  <div className="grid max-w-[140px] gap-3">
                    <button
                      type="button"
                      onClick={() => setHighlightViewer({ title: displayTitle, imageUrl: directUrl, directUrl })}
                      className="block aspect-square border border-[#e5e5e5] bg-[#fafafa] text-left"
                    >
                      <img
                        src={thumbUrl}
                        alt={displayTitle}
                        className="h-full w-full object-cover"
                        loading="lazy"
                      />
                    </button>
                    <button
                      type="button"
                      onClick={() => setHighlightViewer({ title: displayTitle, imageUrl: directUrl, directUrl })}
                      className="text-left font-sans text-xs font-semibold uppercase tracking-[0.12em] text-gray-900 hover:text-[#de8bf7]"
                    >
                      View image
                    </button>
                  </div>

                  <div className="grid min-w-0 gap-3">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="break-words font-sans text-sm font-semibold text-gray-900">
                          {displayTitle}
                        </div>
                        <div className="mt-1 break-all font-sans text-xs text-gray-500">
                          {summary.image.code}
                        </div>
                      </div>
                      <div className="shrink-0 text-right font-sans text-xs text-gray-500">
                        <div>{summary.count} selected</div>
                        <div>{new Date(summary.lastSelectedAt).toLocaleString()}</div>
                      </div>
                    </div>

                    <div className="grid min-w-0 gap-2 font-sans text-sm text-gray-800 xl:grid-cols-2">
                      <div className="min-w-0">
                        <span className="font-semibold text-gray-900">Card ID:</span>{' '}
                        {card?.cardUid || 'Card ID pending'}
                      </div>
                      <div className="min-w-0">
                        <span className="font-semibold text-gray-900">Rarity:</span>{' '}
                        {card?.rarity ? titleCase(card.rarity) : 'Not set'}
                      </div>
                      <div className="min-w-0 xl:col-span-2">
                        <span className="font-semibold text-gray-900">Title:</span>{' '}
                        <span className="break-words">{card?.title || 'Not set'}</span>
                      </div>
                      <div className="min-w-0 xl:col-span-2">
                        <span className="font-semibold text-gray-900">Description:</span>{' '}
                        <span className="break-words">{card?.description || 'Not set'}</span>
                      </div>
                      <div className="min-w-0 xl:col-span-2">
                        <span className="font-semibold text-gray-900">Set / Series:</span>{' '}
                        <span className="break-words">{card?.seriesName || 'Not set'}</span>
                      </div>
                      <div className="min-w-0 xl:col-span-2">
                        <span className="font-semibold text-gray-900">Attributes:</span>{' '}
                        <span className="break-words">
                          {card && card.attributes.length > 0 ? card.attributes.map((attribute) => `#${attribute}`).join(', ') : 'None'}
                        </span>
                      </div>
                      <div className="min-w-0 xl:col-span-2">
                        <span className="font-semibold text-gray-900">Source Path:</span>
                        <span className="mt-1 block break-all">{card?.imagePath || summary.image.path}</span>
                      </div>
                      <div className="min-w-0 xl:col-span-2">
                        <span className="font-semibold text-gray-900">Direct URL:</span>
                        <a href={directUrl} target="_blank" rel="noreferrer" className="mt-1 block break-all hover:text-[#de8bf7]">
                          {directUrl}
                        </a>
                      </div>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </main>

        {highlightViewer && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-white/70 p-6 backdrop-blur-sm"
            onClick={() => setHighlightViewer(null)}
          >
            <div
              className="max-h-[90vh] max-w-[90vw] overflow-hidden border border-[#e5e5e5] bg-[#fafafa] shadow-xl"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="flex items-center justify-between gap-4 border-b border-[#e5e5e5] px-4 py-3 font-sans text-sm text-gray-900">
                <div className="min-w-0 flex-1 truncate font-semibold">{highlightViewer.title}</div>
                <div className="flex items-center gap-4 text-xs font-semibold uppercase tracking-[0.12em]">
                  <a href={highlightViewer.directUrl} target="_blank" rel="noreferrer" className="hover:text-[#de8bf7]">
                    Open direct
                  </a>
                  <button type="button" onClick={() => setHighlightViewer(null)} className="hover:text-[#de8bf7]">
                    Close
                  </button>
                </div>
              </div>
              <div className="flex max-h-[calc(90vh-49px)] items-center justify-center bg-white">
                <img
                  src={highlightViewer.imageUrl}
                  alt={highlightViewer.title}
                  className="max-h-[calc(90vh-49px)] max-w-[90vw] object-contain"
                />
              </div>
            </div>
          </div>
        )}
      </>
    );
  }

  return (
    <div
      className="min-h-screen overflow-x-hidden bg-[#FAFAFA] text-gray-950"
      style={{ scrollbarGutter: 'stable' }}
    >
      <header className="h-[36px] px-6 bg-[#FAFAFA] flex items-center justify-between shrink-0 relative z-20 border-b border-[#e5e5e5]">
        <div className="flex items-center">
          <a
            href="/aphelion/"
            className="font-sans font-semibold text-sm leading-none tracking-normal text-gray-900 hover:text-[#de8bf7] transition-colors duration-1000 hover:duration-150"
          >
            Aphelion
          </a>
        </div>
        <div className="flex items-center gap-4 font-sans text-sm font-semibold text-gray-900">
          <a
            href="/aphelion/#admin-highlights"
            className={`transition-colors duration-1000 hover:duration-150 hover:text-[#de8bf7] ${isAdminHighlightsPage ? 'text-blue-700' : ''}`}
          >
            Highlights
          </a>
          {isAdminHighlightsPage ? (
            <>
              <a href="/aphelion/#admin" className="hover:text-[#de8bf7] transition-colors duration-1000 hover:duration-150">
                Admin
              </a>
              <a href="/aphelion/#options" className="hover:text-[#de8bf7] transition-colors duration-1000 hover:duration-150">
                Options
              </a>
            </>
          ) : isOptionsPage ? (
            <a href="/aphelion/#admin" className="hover:text-[#de8bf7] transition-colors duration-1000 hover:duration-150">
              Admin
            </a>
          ) : (
            <a href="/aphelion/#options" className="hover:text-[#de8bf7] transition-colors duration-1000 hover:duration-150">
              Options
            </a>
          )}
          <a href="/aphelion/" className="hover:text-[#de8bf7] transition-colors duration-1000 hover:duration-150">
            Public
          </a>
          <button
            type="button"
            onClick={onSignOut}
            className="font-sans text-sm font-semibold text-gray-900 hover:text-[#de8bf7] transition-colors duration-1000 hover:duration-150"
          >
            Sign Out
          </button>
        </div>
      </header>

      {isAdminHighlightsPage ? (
        renderAdminHighlightsPage()
      ) : isOptionsPage ? (
        <main className="h-[calc(100vh-72px)] overflow-y-auto px-[36px] py-[16px]">
          <div className="mb-4 border-b border-[#e5e5e5] pb-2 font-sans text-sm text-gray-900">
            <span className="font-semibold">Admin</span> - edit card libraries, set labels, and the property standards used by curation.
            {authStatus?.user && (
              <span className="ml-2 text-gray-500">Signed in as {authStatus.user.displayName || authStatus.user.username}.</span>
            )}
          </div>
          <div className="grid gap-6 xl:grid-cols-2">
            {renderHighlightMaintenance()}
            {renderLibraryOptions('Attribute Library', attributes, '/api/admin/attributes', setAttributes)}
            {renderLibraryOptions('Series Library', series, '/api/admin/series', setSeries)}
            <section className="border border-[#e5e5e5] bg-white">
              <div className="border-b border-[#e5e5e5] px-4 py-3 font-sans text-xs uppercase tracking-[0.16em] text-gray-500">
                Image Properties
              </div>
              <div className="grid gap-2 p-4 font-sans text-sm text-gray-800">
                <div><span className="font-semibold">Title</span> - display name for the card.</div>
                <div><span className="font-semibold">Description</span> - descriptive notes and curation text.</div>
                <div><span className="font-semibold">Rarity</span> - common, uncommon, rare, epic, legendary.</div>
                <div><span className="font-semibold">Attributes</span> - reusable descriptive tags managed above.</div>
              </div>
            </section>
            <section className="border border-[#e5e5e5] bg-white">
              <div className="border-b border-[#e5e5e5] px-4 py-3 font-sans text-xs uppercase tracking-[0.16em] text-gray-500">
                Set Properties
              </div>
              <div className="grid gap-2 p-4 font-sans text-sm text-gray-800">
                <div><span className="font-semibold">Series</span> - grouping or season label assigned to cards.</div>
                <div><span className="font-semibold">Folder</span> - source folder path from the Keep image library.</div>
                <div><span className="font-semibold">Card ID</span> - generated card identifier for durable reference.</div>
                <div><span className="font-semibold">Direct URL</span> - browser-accessible image route for review and sharing.</div>
              </div>
            </section>
            {renderActionHistory()}
          </div>
        </main>
      ) : (
      <main className="h-[calc(100vh-72px)] overflow-hidden px-[36px] py-[12px]">
        <div className="relative mb-1 grid grid-cols-6 border-b border-[#e5e5e5] pb-1 font-sans text-xs text-gray-900">
          <div className="min-w-0 text-center"><span className="font-semibold">Total</span> - {stats.total}</div>
          <div className="min-w-0 text-center"><span className="font-semibold">Reviewed</span> - {stats.reviewed}</div>
          <div className="min-w-0 text-center"><span className="font-semibold">Untagged</span> - {stats.untagged}</div>
          <div className="min-w-0 text-center">
            <button
              type="button"
              onClick={() => setCountPanel((current) => (current === 'rarity' ? '' : 'rarity'))}
              className={`font-semibold hover:text-[#de8bf7] ${countPanel === 'rarity' ? 'text-blue-700' : ''}`}
            >
              {selectedRarityHeader}
            </button>
            {' - '}
            {selectedRarityCount}
          </div>
          <div className="min-w-0 text-center">
            <button
              type="button"
              onClick={() => setCountPanel((current) => (current === 'series' ? '' : 'series'))}
              className={`font-semibold hover:text-[#de8bf7] ${countPanel === 'series' ? 'text-blue-700' : ''}`}
            >
              {selectedSeriesHeader}
            </button>
            {' - '}
            {selectedSeriesCount}
          </div>
          <div className="min-w-0 text-center">
            <button
              type="button"
              onClick={() => setCountPanel((current) => (current === 'attributes' ? '' : 'attributes'))}
              className={`font-semibold hover:text-[#de8bf7] ${countPanel === 'attributes' ? 'text-blue-700' : ''}`}
            >
              {selectedAttributeHeader}
            </button>
            {' - '}
            {selectedAttributeCount}
          </div>

          {countPanel && (
            <>
              <button
                type="button"
                aria-label="Close filter options"
                className="fixed inset-0 z-30 cursor-default bg-transparent"
                onClick={() => setCountPanel('')}
              />
              <div
                className="absolute top-[calc(100%+6px)] z-40 max-h-[220px] w-[280px] overflow-y-auto border border-[#d8d8d8] bg-white/85 p-3 font-sans text-xs text-gray-800 shadow-sm backdrop-blur-sm"
                style={{
                  right: countPanel === 'attributes' ? '0' : countPanel === 'series' ? '13%' : '28%',
                }}
                onClick={(event) => event.stopPropagation()}
              >
              <div className="mb-2 flex items-center justify-between gap-3 uppercase tracking-[0.16em] text-gray-500">
                <span>{countPanel === 'rarity' ? 'Rarity' : countPanel === 'series' ? 'Series' : 'Attributes'}</span>
                <button
                  type="button"
                  onClick={() => {
                    if (countPanel === 'rarity') {
                      setSelectedRarityFilters([]);
                    } else if (countPanel === 'series') {
                      setSelectedSeriesFilters([]);
                    } else {
                      setSelectedAttributeFilters([]);
                    }
                  }}
                  className="normal-case tracking-normal text-gray-500 hover:text-gray-900"
                >
                  Clear
                </button>
              </div>
              <div className="grid gap-1">
                <button
                  type="button"
                  onClick={() => {
                    if (countPanel === 'rarity') {
                      setSelectedRarityFilters([]);
                    } else if (countPanel === 'series') {
                      setSelectedSeriesFilters([]);
                    } else {
                      setSelectedAttributeFilters([]);
                    }
                  }}
                  className={`flex justify-between gap-4 text-left leading-5 hover:text-[#de8bf7] ${
                    (countPanel === 'rarity' && selectedRarityFilters.length === 0)
                    || (countPanel === 'series' && selectedSeriesFilters.length === 0)
                    || (countPanel === 'attributes' && selectedAttributeFilters.length === 0)
                      ? 'font-semibold text-blue-700'
                      : 'text-gray-800'
                  }`}
                >
                  <span>
                    {countPanel === 'rarity' ? 'With Rarity' : countPanel === 'series' ? 'With Series' : 'With Attributes'}
                  </span>
                  <span className="text-gray-500">
                    {countPanel === 'rarity' ? stats.withRarity : countPanel === 'series' ? stats.withSeries : stats.withAttributes}
                  </span>
                </button>
                {(countPanel === 'rarity' ? rarityCounts : countPanel === 'series' ? seriesCounts : attributeCounts).map(([label, count], index) => {
                  const selected = countPanel === 'rarity'
                    ? selectedRarityFilters.includes(label)
                    : countPanel === 'series'
                      ? selectedSeriesFilters.includes(label)
                      : selectedAttributeFilters.includes(label);
                  const displayLabel = countPanel === 'rarity'
                    ? formatRarityLabel(label as CardRarity, index)
                    : countPanel === 'attributes'
                      ? `#${label}`
                      : label;

                  return (
                    <button
                    key={`${countPanel}-${label}`}
                    type="button"
                    onClick={() => {
                      if (countPanel === 'rarity') {
                          setSelectedRarityFilters((current) => (current.includes(label) ? current.filter((item) => item !== label) : [...current, label]));
                        } else if (countPanel === 'series') {
                          setSelectedSeriesFilters((current) => (current.includes(label) ? current.filter((item) => item !== label) : [...current, label]));
                        } else {
                          setSelectedAttributeFilters((current) => (current.includes(label) ? current.filter((item) => item !== label) : [...current, label]));
                        }
                      }}
                      className={`flex justify-between gap-4 text-left leading-5 hover:text-[#de8bf7] ${
                        selected ? 'font-semibold text-blue-700' : 'text-gray-800'
                      }`}
                    >
                      <span className="flex items-start gap-2">
                        <span className={`mt-[2px] inline-block h-[12px] w-[12px] border ${selected ? 'border-blue-700 bg-blue-700' : 'border-[#b8b8b8] bg-transparent'}`} />
                        <span>{displayLabel}</span>
                      </span>
                      <span className="text-gray-500">{count}</span>
                    </button>
                  );
                })}
              </div>
            </div>
            </>
          )}
        </div>

        <div className="mb-2 flex flex-wrap items-center gap-2">
          {selectedFolder && (
            <button
              type="button"
              onClick={() => setSelectedFolder('')}
              className="font-sans text-xs uppercase tracking-[0.16em] text-gray-500 hover:text-[#de8bf7]"
            >
              {selectedFolder} x
            </button>
          )}
          {selectedRarityFilters.map((label) => (
            <button
              key={`rarity-filter-${label}`}
              type="button"
              onClick={() => setSelectedRarityFilters((current) => current.filter((item) => item !== label))}
              className="font-sans text-xs uppercase tracking-[0.16em] text-gray-500 hover:text-[#de8bf7]"
            >
              {label} x
            </button>
          ))}
          {selectedSeriesFilters.map((label) => (
            <button
              key={`series-filter-${label}`}
              type="button"
              onClick={() => setSelectedSeriesFilters((current) => current.filter((item) => item !== label))}
              className="font-sans text-xs uppercase tracking-[0.16em] text-gray-500 hover:text-[#de8bf7]"
            >
              {label} x
            </button>
          ))}
          {selectedAttributeFilters.map((label) => (
            <button
              key={`attribute-filter-${label}`}
              type="button"
              onClick={() => setSelectedAttributeFilters((current) => current.filter((item) => item !== label))}
              className="font-sans text-xs uppercase tracking-[0.16em] text-gray-500 hover:text-[#de8bf7]"
            >
              #{label} x
            </button>
          ))}
          {FILTER_OPTIONS.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => setFilterMode(option.id)}
              className={`font-sans text-xs font-semibold ${
                filterMode === option.id ? 'text-blue-700' : 'text-gray-700 hover:text-[#de8bf7]'
              }`}
            >
              {option.label}
            </button>
          ))}
          <div className="ml-auto flex items-center gap-3">
            <span className="font-sans text-xs uppercase tracking-[0.16em] text-gray-500">
              {filteredStats.total} visible
            </span>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search code, path, title, tags, attributes"
              className="min-w-[320px] border border-[#d8d8d8] px-2 py-1 font-sans text-xs text-gray-900 outline-none focus:border-gray-900"
            />
          </div>
        </div>

        {error && (
          <div className="mb-4 border border-red-200 bg-red-50 px-4 py-3 font-sans text-sm text-red-700">
            {error}
          </div>
        )}

        {folderPanelOpen && (
          <div className="fixed inset-0 z-50 bg-black/15" onClick={() => setFolderPanelOpen(false)}>
            <div
              className="absolute left-[36px] top-[120px] max-h-[calc(100vh-160px)] w-[360px] overflow-hidden border border-[#d8d8d8] bg-white shadow-sm"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-[#e5e5e5] px-4 py-3 font-sans text-xs uppercase tracking-[0.16em] text-gray-500">
                <span>Browse Folders</span>
                <button
                  type="button"
                  onClick={() => setFolderPanelOpen(false)}
                  className="font-sans text-[10px] font-semibold uppercase tracking-[0.12em] text-gray-500 hover:text-gray-900"
                >
                  Close
                </button>
              </div>
              <div className="max-h-[calc(100vh-212px)] overflow-y-auto py-2">
                <div className="px-3 pb-2">
                  <button
                    type="button"
                    onClick={() => handleFolderSelect('')}
                    className={`w-full text-left font-sans text-sm ${
                      selectedFolder === '' ? 'font-semibold text-blue-700' : 'text-gray-800 hover:text-[#de8bf7]'
                    }`}
                  >
                    All folders
                    <span className="ml-2 font-sans text-[11px] uppercase tracking-[0.12em] text-gray-400">
                      {cards.length}
                    </span>
                  </button>
                </div>
                <div className="grid gap-1">
                  {folderTree.map((node) => renderFolderNode(node))}
                </div>
              </div>
            </div>
          </div>
        )}

        {loading ? (
          <div className="font-sans text-sm text-gray-500">Loading curation catalog...</div>
        ) : (
          <div className="grid h-[calc(100vh-164px)] min-h-0 gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(340px,460px)]">
            <section className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-4 xl:order-2">
              {selectedCard && (
                <div className="border border-[#e5e5e5] bg-white p-3">
                  <button
                    type="button"
                    onClick={() => setImagePreviewOpen(true)}
                    className="mx-auto block aspect-square h-[180px] w-[180px] cursor-zoom-in border border-[#e5e5e5] bg-white"
                    aria-label="Open image preview"
                  >
                    <img
                      src={prefixApiUrl(apiBaseUrl, selectedCard.imageUrl)}
                      alt={selectedCard.title || selectedCard.sourceTitle || selectedCard.imageCode}
                      className="h-full w-full object-contain"
                    />
                  </button>
                  <div className="mt-2 space-y-1">
                    <div className="flex items-center gap-2 border border-[#d8d8d8] px-2 py-1">
                      <span className="shrink-0 font-sans text-xs font-semibold uppercase tracking-[0.12em] text-gray-500">
                        Direct URL:
                      </span>
                      <a
                        href={selectedDirectUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="min-w-0 flex-1 break-all font-sans text-xs font-semibold text-gray-900 hover:text-[#de8bf7]"
                      >
                        {selectedDirectUrl}
                      </a>
                      <button
                        type="button"
                        onClick={() => {
                          void handleDirectUrlCopy();
                        }}
                        className="shrink-0 font-sans text-sm font-semibold text-gray-500 hover:text-gray-900"
                        aria-label="Copy direct URL"
                      >
                        {copiedDirectUrl ? '✓' : '⧉'}
                      </button>
                    </div>
                    <div className="mt-4 font-sans text-xs uppercase tracking-[0.16em] text-gray-500">Source Path</div>
                    <div className="break-all font-sans text-sm text-gray-900">{selectedCard.imagePath}</div>
                    <div className="font-sans text-xs text-gray-500">
                      {selectedCard.cardUid || 'Card ID pending'}
                    </div>
                  </div>
                </div>
              )}
              <div className="flex min-h-0 flex-col border border-[#e5e5e5] bg-white">
                <div className="shrink-0 flex items-center justify-between gap-3 border-b border-[#e5e5e5] px-4 py-3 font-sans text-xs uppercase tracking-[0.16em] text-gray-500">
                  <div>
                    Card Queue
                    <span className="ml-2 text-[10px] text-gray-400">{selectedFolder || 'All folders'}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setFolderPanelOpen(true)}
                    className="whitespace-nowrap text-[10px] font-semibold normal-case tracking-normal text-gray-700 hover:text-[#de8bf7]"
                  >
                    Browse folders
                  </button>
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto">
                  {filteredCards.map((card) => {
                    const isSelected = selectedCard?.imagePath === card.imagePath;
                    return (
                      <button
                        key={card.imagePath}
                        type="button"
                        onClick={() => setSelectedPath(card.imagePath)}
                        className={`grid w-full grid-cols-[88px_minmax(0,1fr)] gap-3 border-b border-[#efefef] px-4 py-3 text-left ${
                          isSelected ? 'bg-slate-50' : 'bg-white hover:bg-[#faf7fd]'
                        }`}
                      >
                        <img
                          src={prefixApiUrl(apiBaseUrl, card.thumbUrl || card.imageUrl)}
                          alt={card.title || card.sourceTitle || card.imageCode}
                          className="aspect-square h-[88px] w-[88px] border border-[#e5e5e5] object-cover"
                          loading="lazy"
                        />
                        <div className="min-w-0">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="truncate font-sans text-sm font-semibold text-gray-900">
                                {card.title || card.sourceTitle || card.imageCode}
                              </div>
                              <div className="mt-1 truncate font-sans text-xs text-gray-500">{card.imageCode}</div>
                            </div>
                            {card.rarity && (
                              <div className="text-right font-sans text-xs font-semibold text-blue-700">{card.rarity}</div>
                            )}
                          </div>
                          <div className="mt-2 truncate font-sans text-xs text-gray-500">{card.folderPath}</div>
                          {(card.attributes.length > 0 || card.seriesName) && (
                            <div className="mt-2 flex flex-wrap gap-2">
                              {splitSeriesNames(card.seriesName).map((seriesName) => (
                                <span key={seriesName} className="border border-[#d8d8d8] px-2 py-1 font-sans text-[11px] text-gray-700">
                                  {seriesName}
                                </span>
                              ))}
                              {card.attributes.slice(0, 4).map((attribute) => (
                                <span
                                  key={attribute}
                                  className="border border-[#d8d8d8] px-2 py-1 font-sans text-[11px] text-gray-700"
                                >
                                  #{attribute}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </section>

            <section className="min-h-0 min-w-0 overflow-y-auto xl:order-1">
              {selectedCard ? (
                <>
                  <div className="grid gap-6">
                    <div className="hidden">
                      <img
                        src={prefixApiUrl(apiBaseUrl, selectedCard.imageUrl)}
                        alt={selectedCard.title || selectedCard.sourceTitle || selectedCard.imageCode}
                        className="aspect-square w-full border border-[#e5e5e5] object-cover"
                      />
                      <div className="mt-4 space-y-2">
                        <div className="flex items-center gap-2 border border-[#d8d8d8] px-3 py-2">
                          <span className="shrink-0 font-sans text-xs font-semibold uppercase tracking-[0.12em] text-gray-500">
                            Direct URL:
                          </span>
                          <a
                            href={selectedDirectUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="min-w-0 flex-1 break-all font-sans text-xs font-semibold text-gray-900 hover:text-[#de8bf7]"
                          >
                            {selectedDirectUrl}
                          </a>
                          <button
                            type="button"
                            onClick={() => {
                              void handleDirectUrlCopy();
                            }}
                            className="shrink-0 font-sans text-sm font-semibold text-gray-500 hover:text-gray-900"
                            aria-label="Copy direct URL"
                          >
                            {copiedDirectUrl ? '✓' : '⧉'}
                          </button>
                        </div>
                        <div className="font-sans text-xs uppercase tracking-[0.16em] text-gray-500">Source Path</div>
                        <div className="break-all font-sans text-sm text-gray-900">{selectedCard.imagePath}</div>
                        <div className="font-sans text-xs text-gray-500">
                          {selectedCard.cardUid || 'Card ID pending'}
                        </div>
                      </div>
                    </div>

                    <div className="min-w-0 border border-[#e5e5e5] bg-white">
                      <div className="border-b border-[#e5e5e5] px-4 py-3 font-sans text-xs uppercase tracking-[0.16em] text-gray-500">
                        Card Identity
                      </div>
                      <div className="grid gap-4 p-4">
                        <label className="grid gap-2">
                          <span className="font-sans text-xs uppercase tracking-[0.16em] text-gray-500">
                            Title{savedNotice('Title')}
                          </span>
                          <input
                            value={editor.title}
                            onChange={(event) => updateEditor('Title', (current) => ({ ...current, title: event.target.value }))}
                            className="w-full min-w-0 border border-[#d8d8d8] px-3 py-2 font-sans text-sm text-gray-900 outline-none focus:border-gray-900"
                          />
                        </label>
                        <label className="grid gap-2">
                          <span className="font-sans text-xs uppercase tracking-[0.16em] text-gray-500">
                            Description{savedNotice('Description')}
                          </span>
                          <textarea
                            value={editor.description}
                            onChange={(event) => updateEditor('Description', (current) => ({ ...current, description: event.target.value }))}
                            rows={5}
                            className="w-full min-w-0 border border-[#d8d8d8] px-3 py-2 font-sans text-sm text-gray-900 outline-none focus:border-gray-900"
                          />
                        </label>
                        <div className="grid gap-3 lg:grid-cols-2">
                          <div className="grid gap-2">
                            <span className="flex items-center justify-between gap-3 font-sans text-xs uppercase tracking-[0.16em] text-gray-500">
                              <span>Set / Series{savedNotice('Series')}</span>
                            </span>
                            <input
                              list="aphelion-series-list"
                              value={seriesEntry}
                              onChange={(event) => setSeriesEntry(event.target.value)}
                              onKeyDown={(event) => {
                                if (event.key !== 'Enter') {
                                  return;
                                }
                                event.preventDefault();
                                void handleSeriesEntryAdd();
                              }}
                              placeholder="Type series and press Enter"
                              className="w-full min-w-0 border border-[#d8d8d8] px-3 py-2 font-sans text-sm text-gray-900 outline-none focus:border-gray-900"
                            />
                            <datalist id="aphelion-series-list">
                              {series.map((item) => (
                                <option key={item.id} value={item.label} />
                              ))}
                            </datalist>
                            <div className="max-h-[64px] min-h-[64px] overflow-y-auto">
                              <div className="flex flex-wrap gap-2">
                              {series.map((item) => (
                                <button
                                  key={item.id}
                                  type="button"
                                  onClick={() => updateEditor('Series', (current) => ({ ...current, seriesName: toggleSeriesName(current.seriesName, item.label) }))}
                                  className={`inline-flex items-center gap-2 border px-2 py-1 font-sans text-xs ${
                                    splitSeriesNames(editor.seriesName).includes(item.label)
                                      ? 'border-blue-700 text-blue-700'
                                      : 'border-[#d8d8d8] text-gray-700 hover:text-[#de8bf7]'
                                  }`}
                                >
                                  <span>{item.label}</span>
                                  <span
                                    role="button"
                                    tabIndex={0}
                                    aria-label={`Delete ${item.label} from Series Library`}
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      void deleteLibrary('/api/admin/series', item.id, item.label, setSeries);
                                    }}
                                    onKeyDown={(event) => {
                                      if (event.key !== 'Enter' && event.key !== ' ') {
                                        return;
                                      }
                                      event.preventDefault();
                                      event.stopPropagation();
                                      void deleteLibrary('/api/admin/series', item.id, item.label, setSeries);
                                    }}
                                    className="text-[11px] text-gray-400 hover:text-red-600"
                                  >
                                    x
                                  </span>
                                </button>
                              ))}
                              </div>
                            </div>
                          </div>
                          <div className="grid gap-2">
                            <span className="flex items-center justify-between gap-3 font-sans text-xs uppercase tracking-[0.16em] text-gray-500">
                              <span>Attributes{savedNotice('Attributes')}</span>
                            </span>
                            <input
                              list="aphelion-attribute-list"
                              value={attributeEntry}
                              onChange={(event) => setAttributeEntry(event.target.value)}
                              onKeyDown={(event) => {
                                if (event.key !== 'Enter') {
                                  return;
                                }
                                event.preventDefault();
                                void handleAttributeEntryAdd();
                              }}
                              placeholder="Type attribute and press Enter"
                              className="w-full min-w-0 border border-[#d8d8d8] px-3 py-2 font-sans text-sm text-gray-900 outline-none focus:border-gray-900"
                            />
                            <datalist id="aphelion-attribute-list">
                              {attributes.map((item) => (
                                <option key={item.id} value={item.label} />
                              ))}
                            </datalist>
                            <div className="max-h-[64px] min-h-[64px] overflow-y-auto">
                              <div className="flex flex-wrap gap-2">
                              {attributes.map((item) => (
                                <button
                                  key={item.id}
                                  type="button"
                                  onClick={() => toggleAttribute(item.label)}
                                  className={`inline-flex items-center gap-2 border px-2 py-1 font-sans text-xs ${
                                    editor.attributes.includes(item.label)
                                      ? 'border-blue-700 text-blue-700'
                                      : 'border-[#d8d8d8] text-gray-700 hover:text-[#de8bf7]'
                                  }`}
                                >
                                  <span>#{item.label}</span>
                                  <span
                                    role="button"
                                    tabIndex={0}
                                    aria-label={`Delete ${item.label} from Attribute Library`}
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      void deleteLibrary('/api/admin/attributes', item.id, item.label, setAttributes);
                                    }}
                                    onKeyDown={(event) => {
                                      if (event.key !== 'Enter' && event.key !== ' ') {
                                        return;
                                      }
                                      event.preventDefault();
                                      event.stopPropagation();
                                      void deleteLibrary('/api/admin/attributes', item.id, item.label, setAttributes);
                                    }}
                                    className="text-[11px] text-gray-400 hover:text-red-600"
                                  >
                                    x
                                  </span>
                                </button>
                              ))}
                              </div>
                            </div>
                          </div>
                        </div>
                        <div className="grid gap-2">
                          <span className="font-sans text-xs uppercase tracking-[0.16em] text-gray-500">
                            Rarity{savedNotice('Rarity')}
                          </span>
                          <div className="flex flex-wrap gap-2">
                            {RARITY_OPTIONS.map((option, index) => (
                              <button
                                key={option}
                                type="button"
                                onClick={() => updateEditor('Rarity', (current) => ({ ...current, rarity: option }))}
                                className={`border px-3 py-2 font-sans text-sm ${
                                  editor.rarity === option
                                    ? 'border-blue-700 text-blue-700'
                                    : 'border-[#d8d8d8] text-gray-700 hover:text-[#de8bf7]'
                                }`}
                              >
                                {formatRarityLabel(option, index)}
                              </button>
                            ))}
                            <button
                              type="button"
                              onClick={() => updateEditor('Rarity', (current) => ({ ...current, rarity: '' }))}
                              className="border border-[#d8d8d8] px-3 py-2 font-sans text-sm text-gray-700 hover:text-[#de8bf7]"
                            >
                              Clear
                            </button>
                          </div>
                        </div>
                        <div className="grid gap-2">
                          <span className="font-sans text-xs uppercase tracking-[0.16em] text-gray-500">Assigned Attributes</span>
                          <div className="flex flex-wrap gap-2">
                            {editor.attributes.length === 0 ? (
                              <span className="font-sans text-sm text-gray-500">No attributes assigned yet.</span>
                            ) : (
                              editor.attributes.map((attribute) => (
                                <button
                                  key={attribute}
                                  type="button"
                                  onClick={() => toggleAttribute(attribute)}
                                  className="inline-flex items-center gap-2 border border-blue-700 px-2 py-1 font-sans text-xs text-blue-700"
                                >
                                  <span>#{attribute}</span>
                                  <span className="text-[10px] text-blue-500">x</span>
                                </button>
                              ))
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <div className="border border-[#e5e5e5] bg-white px-4 py-6 font-sans text-sm text-gray-500">
                  No card matches the current filter.
                </div>
              )}
            </section>
          </div>
        )}
      </main>
      )}
      <footer className="flex h-[36px] items-center justify-end border-t border-[#e5e5e5] bg-[#FAFAFA] px-6 font-sans text-sm text-gray-700">
        <div>
          © 2026 Jefferson Williams. All rights reserved.
        </div>
      </footer>
      {imagePreviewOpen && selectedCard && (
        <button
          type="button"
          onClick={() => setImagePreviewOpen(false)}
          className="fixed inset-0 z-[70] cursor-zoom-out bg-black/60 p-6"
          aria-label="Close image preview"
        >
          <img
            src={prefixApiUrl(apiBaseUrl, selectedCard.imageUrl)}
            alt={selectedCard.title || selectedCard.sourceTitle || selectedCard.imageCode}
            className="mx-auto h-full max-h-full w-full max-w-full object-contain"
          />
        </button>
      )}
    </div>
  );
}
