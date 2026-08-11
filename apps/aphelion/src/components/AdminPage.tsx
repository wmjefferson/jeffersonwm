import React, { useEffect, useMemo, useState } from 'react';
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

const QUICK_ATTRIBUTES = ['face', 'blue'];

type FilterMode = (typeof FILTER_OPTIONS)[number]['id'];

type EditorState = {
  title: string;
  description: string;
  rarity: CardRarity | '';
  seriesName: string;
  editionSize: string;
  reviewStatus: ReviewStatus;
  attributes: string[];
};

type FolderTreeNode = {
  name: string;
  path: string;
  count: number;
  children: FolderTreeNode[];
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

export function AdminPage({ apiBaseUrl }: { apiBaseUrl: string }) {
  const [cards, setCards] = useState<CardCatalogItem[]>([]);
  const [attributes, setAttributes] = useState<ControlledLibraryItem[]>([]);
  const [series, setSeries] = useState<ControlledLibraryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filterMode, setFilterMode] = useState<FilterMode>('untagged');
  const [search, setSearch] = useState('');
  const [selectedFolder, setSelectedFolder] = useState('');
  const [selectedPath, setSelectedPath] = useState('');
  const [expandedFolders, setExpandedFolders] = useState<string[]>([]);
  const [editor, setEditor] = useState<EditorState>(EMPTY_EDITOR);
  const [saving, setSaving] = useState(false);
  const [newAttribute, setNewAttribute] = useState('');
  const [newSeries, setNewSeries] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function loadCatalog() {
      setLoading(true);
      try {
        const response = await fetch(`${apiBaseUrl}/api/admin/catalog`);
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

  const filteredCards = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return cards.filter((card) => {
      if (selectedFolder && card.folderPath !== selectedFolder && !card.folderPath.startsWith(`${selectedFolder}/`)) {
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
  }, [cards, filterMode, search, selectedFolder]);

  const selectedCard = useMemo(() => {
    return filteredCards.find((card) => card.imagePath === selectedPath)
      || cards.find((card) => card.imagePath === selectedPath)
      || filteredCards[0]
      || null;
  }, [cards, filteredCards, selectedPath]);

  const stats = useMemo(() => buildStats(cards), [cards]);
  const filteredStats = useMemo(() => buildStats(filteredCards), [filteredCards]);
  const currentIndex = useMemo(
    () => filteredCards.findIndex((card) => card.imagePath === selectedCard?.imagePath),
    [filteredCards, selectedCard]
  );

  useEffect(() => {
    if (!selectedCard) {
      setEditor(EMPTY_EDITOR);
      return;
    }

    setEditor(cardToEditor(selectedCard));
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
          setEditor((current) => ({ ...current, rarity }));
          return;
        }

        if (key === 'f' || key === 'b') {
          event.preventDefault();
          const label = key === 'f' ? 'face' : 'blue';
          setEditor((current) => ({
            ...current,
            attributes: current.attributes.includes(label)
              ? current.attributes.filter((item) => item !== label)
              : [...current.attributes, label],
          }));
        }
      }

      if (!isTextArea && event.key === 'Enter') {
        event.preventDefault();
        void handleSave(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedCard, saving, editor]);

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

  async function handleSave(autoAdvance = false) {
    if (!selectedCard) {
      return;
    }

    setSaving(true);
    const nextPath = autoAdvance
      ? filteredCards[currentIndex + 1]?.imagePath || filteredCards[currentIndex - 1]?.imagePath || selectedCard.imagePath
      : selectedCard.imagePath;

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
      if (autoAdvance) {
        setSelectedPath(nextPath);
      }
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Card metadata could not be saved.');
    } finally {
      setSaving(false);
    }
  }

  async function postLibrary(endpoint: string, label: string, setter: (items: ControlledLibraryItem[]) => void, stateReset?: () => void) {
    const cleaned = label.trim();
    if (!cleaned) {
      return;
    }

    const response = await fetch(`${apiBaseUrl}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label: cleaned }),
    });
    const result = await response.json();
    if (!response.ok || !result.ok) {
      throw new Error(result.error || `Library update returned ${response.status}`);
    }

    setter(result.attributes || result.series);
    stateReset?.();
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
        ? card.seriesName === currentLabel ? { ...card, seriesName: nextLabel.trim() } : card
        : {
            ...card,
            attributes: card.attributes.map((item) => (item === currentLabel ? nextLabel.trim() : item)),
          }
    )));
    setEditor((current) => ({
      ...current,
      seriesName: endpoint.includes('/series') && current.seriesName === currentLabel ? nextLabel.trim() : current.seriesName,
      attributes: endpoint.includes('/attributes')
        ? current.attributes.map((item) => (item === currentLabel ? nextLabel.trim() : item))
        : current.attributes,
    }));
  }

  async function deleteLibrary(
    endpoint: string,
    id: number,
    label: string,
    setter: (items: ControlledLibraryItem[]) => void
  ) {
    if (!window.confirm(`Delete "${label}" from the library?`)) {
      return;
    }

    const response = await fetch(`${apiBaseUrl}${endpoint}/${id}`, {
      method: 'DELETE',
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
        ? card.seriesName === label ? { ...card, seriesName: '' } : card
        : { ...card, attributes: card.attributes.filter((item) => item !== label) }
    )));
    setEditor((current) => ({
      ...current,
      seriesName: endpoint.includes('/series') && current.seriesName === label ? '' : current.seriesName,
      attributes: endpoint.includes('/attributes')
        ? current.attributes.filter((item) => item !== label)
        : current.attributes,
    }));
  }

  function toggleAttribute(label: string) {
    setEditor((current) => ({
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
            onClick={() => setSelectedFolder(node.path)}
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

  return (
    <div
      className="min-h-screen overflow-x-hidden bg-[#FAFAFA] text-gray-950"
      style={{ scrollbarGutter: 'stable both-edges' }}
    >
      <header className="h-[36px] px-6 bg-[#FAFAFA] flex items-center justify-between border-b border-[#e5e5e5]">
        <a href="/aphelion/" className="font-sans text-sm font-semibold text-gray-900">
          Aphelion
        </a>
        <div className="flex items-center gap-4 font-sans text-sm font-semibold text-gray-900">
          <a href="/aphelion/" className="hover:text-[#de8bf7]">
            Visitor
          </a>
          <a href="/aphelion/#highlights" className="hover:text-[#de8bf7]">
            Highlights
          </a>
          <a href="/aphelion/#admin" className="hover:text-[#de8bf7]">
            Admin
          </a>
        </div>
      </header>

      <main className="px-[36px] py-[24px]">
        <div className="mb-6 grid gap-4 md:grid-cols-3 xl:grid-cols-6">
          <div className="border border-[#e5e5e5] bg-white p-4">
            <div className="font-sans text-[11px] uppercase tracking-[0.16em] text-gray-500">Total</div>
            <div className="mt-2 font-sans text-2xl font-semibold text-gray-900">{stats.total}</div>
          </div>
          <div className="border border-[#e5e5e5] bg-white p-4">
            <div className="font-sans text-[11px] uppercase tracking-[0.16em] text-gray-500">Reviewed</div>
            <div className="mt-2 font-sans text-2xl font-semibold text-gray-900">{stats.reviewed}</div>
          </div>
          <div className="border border-[#e5e5e5] bg-white p-4">
            <div className="font-sans text-[11px] uppercase tracking-[0.16em] text-gray-500">Untagged</div>
            <div className="mt-2 font-sans text-2xl font-semibold text-gray-900">{stats.untagged}</div>
          </div>
          <div className="border border-[#e5e5e5] bg-white p-4">
            <div className="font-sans text-[11px] uppercase tracking-[0.16em] text-gray-500">With Rarity</div>
            <div className="mt-2 font-sans text-2xl font-semibold text-gray-900">{stats.withRarity}</div>
          </div>
          <div className="border border-[#e5e5e5] bg-white p-4">
            <div className="font-sans text-[11px] uppercase tracking-[0.16em] text-gray-500">With Series</div>
            <div className="mt-2 font-sans text-2xl font-semibold text-gray-900">{stats.withSeries}</div>
          </div>
          <div className="border border-[#e5e5e5] bg-white p-4">
            <div className="font-sans text-[11px] uppercase tracking-[0.16em] text-gray-500">With Attributes</div>
            <div className="mt-2 font-sans text-2xl font-semibold text-gray-900">{stats.withAttributes}</div>
          </div>
        </div>

        <div className="mb-4 flex flex-wrap items-center gap-3 border border-[#e5e5e5] bg-white px-4 py-3">
          {selectedFolder && (
            <button
              type="button"
              onClick={() => setSelectedFolder('')}
              className="font-sans text-xs uppercase tracking-[0.16em] text-gray-500 hover:text-[#de8bf7]"
            >
              {selectedFolder} x
            </button>
          )}
          {FILTER_OPTIONS.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => setFilterMode(option.id)}
              className={`font-sans text-sm font-semibold ${
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
              className="min-w-[320px] border border-[#d8d8d8] px-3 py-2 font-sans text-sm text-gray-900 outline-none focus:border-gray-900"
            />
          </div>
        </div>

        {error && (
          <div className="mb-4 border border-red-200 bg-red-50 px-4 py-3 font-sans text-sm text-red-700">
            {error}
          </div>
        )}

        {loading ? (
          <div className="font-sans text-sm text-gray-500">Loading curation catalog...</div>
        ) : (
          <div className="grid gap-6 xl:grid-cols-[minmax(420px,620px)_minmax(0,1fr)]">
            <section className="grid gap-6 xl:grid-cols-[minmax(180px,220px)_minmax(0,1fr)]">
              <div className="border border-[#e5e5e5] bg-white">
                <div className="border-b border-[#e5e5e5] px-4 py-3 font-sans text-xs uppercase tracking-[0.16em] text-gray-500">
                  Folders
                </div>
                <div className="max-h-[calc(100vh-250px)] overflow-y-auto py-2">
                  <div className="px-3 pb-2">
                    <button
                      type="button"
                      onClick={() => setSelectedFolder('')}
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

              <div className="border border-[#e5e5e5] bg-white">
                <div className="border-b border-[#e5e5e5] px-4 py-3 font-sans text-xs uppercase tracking-[0.16em] text-gray-500">
                  Card Queue
                  <span className="ml-2 text-[10px] text-gray-400">{selectedFolder || 'All folders'}</span>
                </div>
                <div className="max-h-[calc(100vh-250px)] overflow-y-auto">
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
                            <div className="text-right">
                              <div className="font-sans text-[11px] uppercase tracking-[0.16em] text-gray-500">
                                {card.reviewStatus}
                              </div>
                              {card.rarity && (
                                <div className="mt-1 font-sans text-xs font-semibold text-blue-700">{card.rarity}</div>
                              )}
                            </div>
                          </div>
                          <div className="mt-2 truncate font-sans text-xs text-gray-500">{card.folderPath}</div>
                          {(card.attributes.length > 0 || card.seriesName) && (
                            <div className="mt-2 flex flex-wrap gap-2">
                              {card.seriesName && (
                                <span className="border border-[#d8d8d8] px-2 py-1 font-sans text-[11px] text-gray-700">
                                  {card.seriesName}
                                </span>
                              )}
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

            <section className="min-w-0 grid gap-6">
              {selectedCard ? (
                <>
                  <div className="grid gap-6 2xl:grid-cols-[minmax(300px,380px)_minmax(0,1fr)]">
                    <div className="border border-[#e5e5e5] bg-white p-4">
                      <img
                        src={prefixApiUrl(apiBaseUrl, selectedCard.imageUrl)}
                        alt={selectedCard.title || selectedCard.sourceTitle || selectedCard.imageCode}
                        className="aspect-square w-full border border-[#e5e5e5] object-cover"
                      />
                      <div className="mt-4 space-y-2">
                        <div className="font-sans text-xs uppercase tracking-[0.16em] text-gray-500">Source Path</div>
                        <div className="break-all font-sans text-sm text-gray-900">{selectedCard.imagePath}</div>
                        <div className="font-sans text-xs text-gray-500">
                          {selectedCard.sourceTitle} | {selectedCard.imageCode}
                        </div>
                        <div className="font-sans text-xs text-gray-500">
                          {selectedCard.cardUid || 'Card ID pending'}{selectedCard.editionSize ? ` | Edition ${selectedCard.editionSize}` : ''}
                        </div>
                      </div>
                    </div>

                    <div className="min-w-0 border border-[#e5e5e5] bg-white">
                      <div className="border-b border-[#e5e5e5] px-4 py-3 font-sans text-xs uppercase tracking-[0.16em] text-gray-500">
                        Card Identity
                      </div>
                      <div className="grid gap-4 p-4">
                        <label className="grid gap-2">
                          <span className="font-sans text-xs uppercase tracking-[0.16em] text-gray-500">Title</span>
                          <input
                            value={editor.title}
                            onChange={(event) => setEditor((current) => ({ ...current, title: event.target.value }))}
                            className="w-full min-w-0 border border-[#d8d8d8] px-3 py-2 font-sans text-sm text-gray-900 outline-none focus:border-gray-900"
                          />
                        </label>
                        <label className="grid gap-2">
                          <span className="font-sans text-xs uppercase tracking-[0.16em] text-gray-500">Description</span>
                          <textarea
                            value={editor.description}
                            onChange={(event) => setEditor((current) => ({ ...current, description: event.target.value }))}
                            rows={5}
                            className="w-full min-w-0 border border-[#d8d8d8] px-3 py-2 font-sans text-sm text-gray-900 outline-none focus:border-gray-900"
                          />
                        </label>
                        <div className="grid gap-4 lg:grid-cols-2">
                          <label className="grid gap-2">
                            <span className="font-sans text-xs uppercase tracking-[0.16em] text-gray-500">Set / Series</span>
                            <input
                              list="aphelion-series-list"
                              value={editor.seriesName}
                              onChange={(event) => setEditor((current) => ({ ...current, seriesName: event.target.value }))}
                              className="w-full min-w-0 border border-[#d8d8d8] px-3 py-2 font-sans text-sm text-gray-900 outline-none focus:border-gray-900"
                            />
                            <datalist id="aphelion-series-list">
                              {series.map((item) => (
                                <option key={item.id} value={item.label} />
                              ))}
                            </datalist>
                          </label>
                          <label className="grid gap-2">
                            <span className="font-sans text-xs uppercase tracking-[0.16em] text-gray-500">Edition Size</span>
                            <input
                              value={editor.editionSize}
                              onChange={(event) => setEditor((current) => ({ ...current, editionSize: event.target.value.replace(/[^0-9]/g, '') }))}
                              className="w-full min-w-0 border border-[#d8d8d8] px-3 py-2 font-sans text-sm text-gray-900 outline-none focus:border-gray-900"
                            />
                          </label>
                        </div>
                        <div className="grid gap-2">
                          <span className="font-sans text-xs uppercase tracking-[0.16em] text-gray-500">Rarity</span>
                          <div className="flex flex-wrap gap-2">
                            {RARITY_OPTIONS.map((option, index) => (
                              <button
                                key={option}
                                type="button"
                                onClick={() => setEditor((current) => ({ ...current, rarity: option }))}
                                className={`border px-3 py-2 font-sans text-sm ${
                                  editor.rarity === option
                                    ? 'border-blue-700 text-blue-700'
                                    : 'border-[#d8d8d8] text-gray-700 hover:text-[#de8bf7]'
                                }`}
                              >
                                {index + 1}. {option}
                              </button>
                            ))}
                            <button
                              type="button"
                              onClick={() => setEditor((current) => ({ ...current, rarity: '' }))}
                              className="border border-[#d8d8d8] px-3 py-2 font-sans text-sm text-gray-700 hover:text-[#de8bf7]"
                            >
                              Clear
                            </button>
                          </div>
                        </div>
                        <div className="grid gap-2">
                          <span className="font-sans text-xs uppercase tracking-[0.16em] text-gray-500">Review Status</span>
                          <div className="flex flex-wrap gap-3">
                            <button
                              type="button"
                              onClick={() => setEditor((current) => ({ ...current, reviewStatus: 'untagged' }))}
                              className={`border px-3 py-2 font-sans text-sm ${
                                editor.reviewStatus === 'untagged'
                                  ? 'border-blue-700 text-blue-700'
                                  : 'border-[#d8d8d8] text-gray-700 hover:text-[#de8bf7]'
                              }`}
                            >
                              Untagged
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditor((current) => ({ ...current, reviewStatus: 'reviewed' }))}
                              className={`border px-3 py-2 font-sans text-sm ${
                                editor.reviewStatus === 'reviewed'
                                  ? 'border-blue-700 text-blue-700'
                                  : 'border-[#d8d8d8] text-gray-700 hover:text-[#de8bf7]'
                              }`}
                            >
                              Reviewed
                            </button>
                          </div>
                        </div>
                        <div className="grid gap-2">
                          <span className="font-sans text-xs uppercase tracking-[0.16em] text-gray-500">Quick Attributes</span>
                          <div className="flex flex-wrap gap-2">
                            {QUICK_ATTRIBUTES.map((label) => (
                              <button
                                key={label}
                                type="button"
                                onClick={() => toggleAttribute(label)}
                                className={`border px-3 py-2 font-sans text-sm ${
                                  editor.attributes.includes(label)
                                    ? 'border-blue-700 text-blue-700'
                                    : 'border-[#d8d8d8] text-gray-700 hover:text-[#de8bf7]'
                                }`}
                              >
                                #{label}
                              </button>
                            ))}
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
                                  className="border border-blue-700 px-2 py-1 font-sans text-xs text-blue-700"
                                >
                                  #{attribute}
                                </button>
                              ))
                            )}
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-3 pt-2">
                          <button
                            type="button"
                            disabled={saving}
                            onClick={() => void handleSave(false)}
                            className="border border-gray-900 px-4 py-2 font-sans text-sm font-semibold text-gray-900 hover:text-[#de8bf7] disabled:opacity-50"
                          >
                            {saving ? 'Saving...' : 'Save'}
                          </button>
                          <button
                            type="button"
                            disabled={saving}
                            onClick={() => void handleSave(true)}
                            className="border border-gray-900 px-4 py-2 font-sans text-sm font-semibold text-gray-900 hover:text-[#de8bf7] disabled:opacity-50"
                          >
                            Save + Next
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-6 xl:grid-cols-2">
                    <div className="border border-[#e5e5e5] bg-white">
                      <div className="border-b border-[#e5e5e5] px-4 py-3 font-sans text-xs uppercase tracking-[0.16em] text-gray-500">
                        Attribute Library
                      </div>
                      <div className="grid gap-4 p-4">
                        <div className="flex gap-3">
                          <input
                            value={newAttribute}
                            onChange={(event) => setNewAttribute(event.target.value)}
                            placeholder="Add attribute"
                            className="min-w-0 flex-1 border border-[#d8d8d8] px-3 py-2 font-sans text-sm text-gray-900 outline-none focus:border-gray-900"
                          />
                          <button
                            type="button"
                            onClick={() => void postLibrary('/api/admin/attributes', newAttribute, setAttributes, () => setNewAttribute(''))}
                            className="border border-gray-900 px-4 py-2 font-sans text-sm font-semibold text-gray-900 hover:text-[#de8bf7]"
                          >
                            Add
                          </button>
                        </div>
                        <div className="grid gap-2">
                          {attributes.map((item) => (
                            <div key={item.id} className="flex items-center gap-2 border border-[#efefef] px-3 py-2">
                              <button
                                type="button"
                                onClick={() => toggleAttribute(item.label)}
                                className={`flex-1 text-left font-sans text-sm ${
                                  editor.attributes.includes(item.label) ? 'text-blue-700' : 'text-gray-900 hover:text-[#de8bf7]'
                                }`}
                              >
                                #{item.label}
                              </button>
                              <button
                                type="button"
                                onClick={() => void patchLibrary('/api/admin/attributes', item.id, item.label, setAttributes)}
                                className="font-sans text-xs font-semibold text-gray-500 hover:text-[#de8bf7]"
                              >
                                Rename
                              </button>
                              <button
                                type="button"
                                onClick={() => void deleteLibrary('/api/admin/attributes', item.id, item.label, setAttributes)}
                                className="font-sans text-xs font-semibold text-red-600"
                              >
                                Delete
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="border border-[#e5e5e5] bg-white">
                      <div className="border-b border-[#e5e5e5] px-4 py-3 font-sans text-xs uppercase tracking-[0.16em] text-gray-500">
                        Series Library
                      </div>
                      <div className="grid gap-4 p-4">
                        <div className="flex gap-3">
                          <input
                            value={newSeries}
                            onChange={(event) => setNewSeries(event.target.value)}
                            placeholder="Add series"
                            className="min-w-0 flex-1 border border-[#d8d8d8] px-3 py-2 font-sans text-sm text-gray-900 outline-none focus:border-gray-900"
                          />
                          <button
                            type="button"
                            onClick={() => void postLibrary('/api/admin/series', newSeries, setSeries, () => setNewSeries(''))}
                            className="border border-gray-900 px-4 py-2 font-sans text-sm font-semibold text-gray-900 hover:text-[#de8bf7]"
                          >
                            Add
                          </button>
                        </div>
                        <div className="grid gap-2">
                          {series.map((item) => (
                            <div key={item.id} className="flex items-center gap-2 border border-[#efefef] px-3 py-2">
                              <button
                                type="button"
                                onClick={() => setEditor((current) => ({ ...current, seriesName: item.label }))}
                                className={`flex-1 text-left font-sans text-sm ${
                                  editor.seriesName === item.label ? 'text-blue-700' : 'text-gray-900 hover:text-[#de8bf7]'
                                }`}
                              >
                                {item.label}
                              </button>
                              <button
                                type="button"
                                onClick={() => void patchLibrary('/api/admin/series', item.id, item.label, setSeries)}
                                className="font-sans text-xs font-semibold text-gray-500 hover:text-[#de8bf7]"
                              >
                                Rename
                              </button>
                              <button
                                type="button"
                                onClick={() => void deleteLibrary('/api/admin/series', item.id, item.label, setSeries)}
                                className="font-sans text-xs font-semibold text-red-600"
                              >
                                Delete
                              </button>
                            </div>
                          ))}
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
    </div>
  );
}
