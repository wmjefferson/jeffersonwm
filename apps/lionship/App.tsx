
import React, { useState, useMemo, useEffect, useRef } from 'react';

interface LinkItem {
  id: string;
  title: string;
  url: string;
  acronym: string;
  category: string;
  tags?: string;
}

const INITIAL_LINKS: LinkItem[] = [];

type SortKey = 'acronym' | 'title';
type SortOrder = 'asc' | 'desc';
type SearchEngine = 'GOOGLE' | 'BING';
const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');
const apiUrl = (path: string) => `${API_BASE_URL}${path}`;

const App: React.FC = () => {
  const [links, setLinks] = useState<LinkItem[]>(INITIAL_LINKS);
  const [dbStatus, setDbStatus] = useState<'LOADING' | 'CONNECTED' | 'DISCONNECTED'>('LOADING');

  useEffect(() => {
    // Try to load from database first
    fetch(apiUrl('/api/links'))
      .then(res => {
        if (!res.ok) throw new Error('DB not available');
        return res.json();
      })
      .then(async (data) => {
        setDbStatus('CONNECTED');
        if (data.length === 0) {
          const savedStr = localStorage.getItem('linkstream_links');
          if (savedStr) {
            const linksToSync = JSON.parse(savedStr);
            setLinks(linksToSync);

            if (Array.isArray(linksToSync) && linksToSync.length > 0) {
              await fetch(apiUrl('/api/links/batch'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ links: linksToSync })
              });
            }
          } else {
            setLinks([]);
          }
        } else {
          setLinks(data);
        }
      })
      .catch((err) => {
        console.warn('Falling back to local storage:', err);
        setDbStatus('DISCONNECTED');
        const saved = localStorage.getItem('linkstream_links');
        if (saved) {
          try {
            setLinks(JSON.parse(saved));
          } catch (e) {
            setLinks([]);
          }
        } else {
          setLinks([]);
        }
      });
  }, []);

  useEffect(() => {
    // We only rely on localStorage as a permanent backup when disconnected format
    if (dbStatus === 'DISCONNECTED') {
      localStorage.setItem('linkstream_links', JSON.stringify(links));
    }
  }, [links, dbStatus]);

  const [currentView, setCurrentView] = useState<'MAIN' | 'EDIT' | 'ABOUT'>('MAIN');
  const [editingLinkId, setEditingLinkId] = useState<string | null>(null);
  const [editFormData, setEditFormData] = useState({ title: '', url: '', acronym: '', category: '', tags: '' });
  const [newCategoryName, setNewCategoryName] = useState('');
  const [columnCount, setColumnCount] = useState(4);

  useEffect(() => {
    const updateColumns = () => {
      const width = window.innerWidth;
      const availableWidth = width - 72; // subtract padding (2 * 36px)
      const calculatedCols = Math.max(1, Math.floor((availableWidth + 16) / 346)); // 330px target card width + 16px gap
      setColumnCount(calculatedCols);
    };
    
    updateColumns();
    window.addEventListener('resize', updateColumns);
    return () => window.removeEventListener('resize', updateColumns);
  }, []);

  const handleEditClick = (link: LinkItem) => {
    setEditingLinkId(link.id);
    setEditFormData({ title: link.title, url: link.url, acronym: link.acronym, category: link.category, tags: link.tags || '' });
    setNewCategoryName('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSaveEdit = async () => {
    const categoryVal = editFormData.category;
    let finalCategory = categoryVal;
    if (categoryVal === '__NEW__') {
      finalCategory = newCategoryName.trim();
    }
    
    if (!editFormData.title || !editFormData.url || !editFormData.acronym || !finalCategory) return;
    
    let updatedLinks;
    let newOrUpdatedLink;

    const payload = {
      title: editFormData.title,
      url: editFormData.url,
      acronym: editFormData.acronym,
      category: finalCategory,
      tags: editFormData.tags || ''
    };

    if (editingLinkId) {
      newOrUpdatedLink = { id: editingLinkId, ...payload } as LinkItem;
      updatedLinks = links.map(l => l.id === editingLinkId ? newOrUpdatedLink : l);
      
      if (dbStatus === 'CONNECTED') {
        await fetch(apiUrl(`/api/links/${editingLinkId}`), {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newOrUpdatedLink)
        }).catch(err => console.error(err));
      }
    } else {
      const newId = Date.now().toString();
      newOrUpdatedLink = { id: newId, ...payload } as LinkItem;
      updatedLinks = [...links, newOrUpdatedLink];

      if (dbStatus === 'CONNECTED') {
        await fetch(apiUrl('/api/links'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newOrUpdatedLink)
        }).catch(err => console.error(err));
      }
    }
    
    setLinks(updatedLinks);
    setEditingLinkId(null);
    setEditFormData({ title: '', url: '', acronym: '', category: '', tags: '' });
    setNewCategoryName('');
  };

  const handleDeleteLink = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this link?')) {
      if (dbStatus === 'CONNECTED') {
        await fetch(apiUrl(`/api/links/${id}`), {
          method: 'DELETE'
        }).catch(err => console.error(err));
      }

      setLinks(links.filter(l => l.id !== id));
      if (editingLinkId === id) {
        setEditingLinkId(null);
        setEditFormData({ title: '', url: '', acronym: '', category: '', tags: '' });
        setNewCategoryName('');
      }
    }
  };

  const handleCancelEdit = () => {
    setEditingLinkId(null);
    setEditFormData({ title: '', url: '', acronym: '', category: '', tags: '' });
    setNewCategoryName('');
  };

  const [sortKey, setSortKey] = useState<SortKey>('title');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');
  const [editSortKey, setEditSortKey] = useState<SortKey>('title');
  const [editSortOrder, setEditSortOrder] = useState<SortOrder>('asc');
  const [universalQuery, setUniversalQuery] = useState<string>('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [searchHistory, setSearchHistory] = useState<string[]>([]);
  const [searchEngine, setSearchEngine] = useState<SearchEngine>('GOOGLE');
  const [isHistoryVisible, setIsHistoryVisible] = useState(false);
  const [focusedHistoryIndex, setFocusedHistoryIndex] = useState(-1);
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [viewMode, setViewMode] = useState<'CARDS' | 'LIST' | 'TAGS'>('CARDS');

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsHistoryVisible(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const uniqueCategories = useMemo(() => {
    const cats = Array.from(new Set(links.map(l => l.category))).sort();
    return ['ALL', ...cats];
  }, [links]);

  const sortedAndFilteredLinks = useMemo(() => {
    const filtered = selectedCategory === 'ALL' 
      ? links 
      : links.filter(link => link.category === selectedCategory);

    return [...filtered].sort((a, b) => {
      const valA = a[sortKey].toLowerCase();
      const valB = b[sortKey].toLowerCase();
      if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
  }, [links, sortKey, sortOrder, selectedCategory]);

  const linksByCategory = useMemo(() => {
    const grouped: Record<string, LinkItem[]> = {};
    links.forEach(link => {
      const cat = link.category || 'Uncategorized';
      if (!grouped[cat]) {
        grouped[cat] = [];
      }
      grouped[cat].push(link);
    });

    Object.keys(grouped).forEach(cat => {
      grouped[cat].sort((a, b) => {
        const valA = a[sortKey].toLowerCase();
        const valB = b[sortKey].toLowerCase();
        if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
        if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
        return 0;
      });
    });

    return grouped;
  }, [links, sortKey, sortOrder]);

  const displayedCategories = useMemo(() => {
    const cats = Object.keys(linksByCategory).sort();
    if (selectedCategory === 'ALL') return cats;
    return cats.filter(cat => cat.toLowerCase() === selectedCategory.toLowerCase());
  }, [linksByCategory, selectedCategory]);

  const linksByTag = useMemo(() => {
    const grouped: Record<string, LinkItem[]> = {};
    links.forEach(link => {
      if (!link.tags) return;
      const tagsList = link.tags.split(',').map(t => t.trim().toUpperCase()).filter(Boolean);
      tagsList.forEach(tag => {
        if (!grouped[tag]) {
          grouped[tag] = [];
        }
        if (!grouped[tag].some(l => l.id === link.id)) {
          grouped[tag].push(link);
        }
      });
    });

    Object.keys(grouped).forEach(tag => {
      grouped[tag].sort((a, b) => {
        const valA = a[sortKey].toLowerCase();
        const valB = b[sortKey].toLowerCase();
        if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
        if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
        return 0;
      });
    });

    return grouped;
  }, [links, sortKey, sortOrder]);

  const uniqueTags = useMemo(() => {
    return Object.keys(linksByTag).sort();
  }, [linksByTag]);

  const displayedTagsMap = useMemo(() => {
    const tagsToShow: Record<string, LinkItem[]> = {};
    uniqueTags.forEach(tag => {
      const tagLinks = linksByTag[tag] || [];
      const filtered = selectedCategory === 'ALL'
        ? tagLinks
        : tagLinks.filter(l => l.category === selectedCategory);
      if (filtered.length > 0) {
        tagsToShow[tag] = filtered;
      }
    });
    return tagsToShow;
  }, [uniqueTags, linksByTag, selectedCategory]);

  const shownLinksCount = useMemo(() => {
    if (viewMode === 'TAGS') {
      let total = 0;
      Object.keys(displayedTagsMap).forEach(tag => {
        total += displayedTagsMap[tag].length;
      });
      return total;
    }
    if (selectedCategory === 'ALL') return links.length;
    return links.filter(link => link.category === selectedCategory).length;
  }, [links, selectedCategory, viewMode, displayedTagsMap]);

  const categoryColumns = useMemo(() => {
    const cols: string[][] = Array.from({ length: columnCount }, () => []);
    displayedCategories.forEach((cat, index) => {
      cols[index % columnCount].push(cat);
    });
    return cols;
  }, [displayedCategories, columnCount]);

  const tagsColumns = useMemo(() => {
    const cols: string[][] = Array.from({ length: columnCount }, () => []);
    Object.keys(displayedTagsMap).forEach((tag, index) => {
      cols[index % columnCount].push(tag);
    });
    return cols;
  }, [displayedTagsMap, columnCount]);

  const toggleSelectCategory = (catLinks: LinkItem[]) => {
    const next = new Set(selectedIds);
    const allSelected = catLinks.every(link => next.has(link.id));
    
    if (allSelected) {
      catLinks.forEach(link => next.delete(link.id));
      setSelectedIds(next);
    } else {
      catLinks.forEach(link => next.add(link.id));
      setSelectedIds(next);
      
      const count = catLinks.length;
      if (window.confirm(`Open ${count} new tabs for this category?`)) {
        const query = universalQuery.trim();
        catLinks.forEach(link => {
          openLinkWithQuery(link, query);
        });
        catLinks.forEach(link => next.delete(link.id));
        setSelectedIds(next);
      }
    }
  };

  const toggleSelectTag = (tagLinks: LinkItem[]) => {
    const next = new Set(selectedIds);
    const allSelected = tagLinks.every(link => next.has(link.id));
    
    if (allSelected) {
      tagLinks.forEach(link => next.delete(link.id));
      setSelectedIds(next);
    } else {
      tagLinks.forEach(link => next.add(link.id));
      setSelectedIds(next);
      
      const count = tagLinks.length;
      if (window.confirm(`Open ${count} new tabs for this tag?`)) {
        const query = universalQuery.trim();
        tagLinks.forEach(link => {
          openLinkWithQuery(link, query);
        });
        tagLinks.forEach(link => next.delete(link.id));
        setSelectedIds(next);
      }
    }
  };

  const sortedEditLinks = useMemo(() => {
    return [...links].sort((a, b) => {
      const valA = a[editSortKey].toLowerCase();
      const valB = b[editSortKey].toLowerCase();
      if (valA < valB) return editSortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return editSortOrder === 'asc' ? 1 : -1;
      return 0;
    });
  }, [links, editSortKey, editSortOrder]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortOrder('asc');
    }
  };

  const handleEditSort = (key: SortKey) => {
    if (editSortKey === key) {
      setEditSortOrder(editSortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setEditSortKey(key);
      setEditSortOrder('asc');
    }
  };

  const openLinkWithQuery = (link: LinkItem, query: string) => {
    const trimmed = query.trim();
    if (!trimmed) return;
    const finalUrl = link.url.replace(/%s/g, encodeURIComponent(trimmed));
    window.open(finalUrl, '_blank');
  };

  const toggleSelect = (link: LinkItem) => {
    const next = new Set(selectedIds);
    if (next.has(link.id)) {
      next.delete(link.id);
    } else {
      next.add(link.id);
    }
    setSelectedIds(next);
  };

  const deselectAll = () => {
    setSelectedIds(new Set());
  };

  const addToHistory = (query: string) => {
    const trimmed = query.trim();
    if (!trimmed) return;
    setSearchHistory(prev => {
      const filtered = prev.filter(h => h !== trimmed);
      return [trimmed, ...filtered].slice(0, 15);
    });
  };

  const handleSubmit = (overrideQuery?: string) => {
    const query = (overrideQuery || universalQuery).trim();
    if (!query) return;

    if (selectedIds.size > 0) {
      links.forEach(link => {
        if (selectedIds.has(link.id)) {
          openLinkWithQuery(link, query);
        }
      });
    } else {
      const baseUrl = searchEngine === 'GOOGLE' 
        ? 'https://www.google.com/search?q=' 
        : 'https://www.bing.com/search?q=';
      window.open(`${baseUrl}${encodeURIComponent(query)}`, '_blank');
    }

    addToHistory(query);
    setUniversalQuery('');
    deselectAll(); 
    setIsHistoryVisible(false);
  };

  const handleClear = () => {
    setUniversalQuery('');
    deselectAll(); 
  };

  const selectHistoryItem = (item: string) => {
    setUniversalQuery(item);
    setIsHistoryVisible(false);
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      if (focusedHistoryIndex >= 0 && isHistoryVisible) {
        handleSubmit(searchHistory[focusedHistoryIndex]);
      } else {
        handleSubmit();
      }
    } else if (e.key === 'ArrowDown') {
      if (!isHistoryVisible && searchHistory.length > 0) {
        setIsHistoryVisible(true);
        setFocusedHistoryIndex(0);
      } else if (isHistoryVisible && focusedHistoryIndex < searchHistory.length - 1) {
        setFocusedHistoryIndex(prev => prev + 1);
      }
    } else if (e.key === 'ArrowUp') {
      if (isHistoryVisible) {
        if (focusedHistoryIndex > 0) {
          setFocusedHistoryIndex(prev => prev - 1);
        } else {
          setIsHistoryVisible(false);
          setFocusedHistoryIndex(-1);
        }
      }
    } else if (e.key === 'Escape') {
      setIsHistoryVisible(false);
      setFocusedHistoryIndex(-1);
    }
  };

  const handleResourceClick = (e: React.MouseEvent, link: LinkItem) => {
    e.preventDefault();
    const query = universalQuery.trim();

    if (query) {
      openLinkWithQuery(link, query);
      addToHistory(query);
      setUniversalQuery('');
    } else {
      const lastSlashIndex = link.url.lastIndexOf('/');
      const truncatedUrl = lastSlashIndex !== -1 
        ? link.url.substring(0, lastSlashIndex + 1) 
        : link.url;
      window.open(truncatedUrl, '_blank');
    }
  };

  return (
    <div className="min-h-screen pb-[72px] bg-[#F0F0F0]">
      {dbStatus === 'DISCONNECTED' && (
        <div className="bg-yellow-100 text-yellow-800 text-xs px-4 py-2 border-b border-yellow-300 font-heading tracking-widest uppercase text-center font-bold">
          Running in offline mode. The live API could not be reached, so this device is using local storage.
        </div>
      )}
      <header className="top-banner">
        <div className="px-[36px] w-full flex items-center justify-between">
          <button 
            onClick={() => setCurrentView('MAIN')}
            className="text-sm font-bold font-heading uppercase tracking-tighter text-black hover:opacity-80 transition-opacity"
          >
            LIONSHIP
          </button>
          <div className="flex gap-4 items-center">
            <button 
              onClick={() => setCurrentView(currentView === 'ABOUT' ? 'MAIN' : 'ABOUT')}
              className={`text-[10px] font-bold font-heading uppercase tracking-widest hover:underline text-black ${currentView === 'ABOUT' ? 'underline' : ''}`}
            >
              ABOUT
            </button>
            <button 
              onClick={() => setCurrentView(currentView === 'EDIT' ? 'MAIN' : 'EDIT')}
              className={`text-[10px] font-bold font-heading uppercase tracking-widest hover:underline text-black ${currentView === 'EDIT' ? 'underline' : ''}`}
            >
              {currentView === 'EDIT' ? 'DONE EDITING' : 'EDIT LINKS'}
            </button>
          </div>
        </div>
      </header>

      {currentView === 'EDIT' ? (
        <main className="mt-[20px] px-[36px] max-w-4xl pb-20">
          <div className="bg-white p-4 border border-black mb-6 shadow-sm">
            <h2 className="text-[12px] font-bold font-heading uppercase tracking-widest mb-4">
              {editingLinkId ? 'Edit Link' : 'Add New Link'}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-[10px] font-bold font-heading uppercase tracking-widest text-zinc-500 mb-1">Name</label>
                <input type="text" value={editFormData.title} onChange={e => setEditFormData({...editFormData, title: e.target.value})} className="w-full border border-black px-2 py-1 text-[14px] font-heading focus:outline-none focus:border-blue-500" />
              </div>
              <div>
                <label className="block text-[10px] font-bold font-heading uppercase tracking-widest text-zinc-500 mb-1">URL (use %s for query)</label>
                <input type="text" value={editFormData.url} onChange={e => setEditFormData({...editFormData, url: e.target.value})} className="w-full border border-black px-2 py-1 text-[14px] font-heading focus:outline-none focus:border-blue-500" />
              </div>
              <div>
                <label className="block text-[10px] font-bold font-heading uppercase tracking-widest text-zinc-500 mb-1">Acronym</label>
                <input type="text" value={editFormData.acronym} onChange={e => setEditFormData({...editFormData, acronym: e.target.value})} className="w-full border border-black px-2 py-1 text-[14px] font-heading focus:outline-none focus:border-blue-500" />
              </div>
              <div>
                <label className="block text-[10px] font-bold font-heading uppercase tracking-widest text-zinc-500 mb-1">Category</label>
                <select 
                  value={editFormData.category} 
                  onChange={e => {
                    setEditFormData({...editFormData, category: e.target.value});
                    if (e.target.value !== '__NEW__') {
                      setNewCategoryName('');
                    }
                  }} 
                  className="w-full border border-black px-2 py-1.5 text-[14px] font-heading focus:outline-none focus:border-blue-500 bg-white"
                >
                  <option value="">-- Select Category --</option>
                  {uniqueCategories.filter(cat => cat !== 'ALL').map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                  <option value="__NEW__">Create New Category...</option>
                </select>
                {editFormData.category === '__NEW__' && (
                  <input 
                    type="text" 
                    placeholder="New Category Name" 
                    value={newCategoryName} 
                    onChange={e => setNewCategoryName(e.target.value)} 
                    className="w-full border border-black px-2 py-1 text-[14px] font-heading focus:outline-none focus:border-blue-500 mt-2" 
                  />
                )}
              </div>
            </div>
            <div className="mb-4">
              <label className="block text-[10px] font-bold font-heading uppercase tracking-widest text-zinc-500 mb-1">Tags (comma-separated)</label>
              <input 
                type="text" 
                value={editFormData.tags} 
                onChange={e => setEditFormData({...editFormData, tags: e.target.value})} 
                className="w-full border border-black px-2 py-1 text-[14px] font-heading focus:outline-none focus:border-blue-500" 
                placeholder="e.g. WORK, REFERENCE, TOOLS" 
              />
            </div>
            <div className="flex gap-2">
              <button onClick={handleSaveEdit} className="bg-black text-white px-4 py-1 font-heading text-[10px] font-bold uppercase tracking-widest hover:bg-zinc-800 transition-colors">
                {editingLinkId ? 'Save Changes' : 'Add Link'}
              </button>
              {editingLinkId && (
                <button onClick={handleCancelEdit} className="border border-black text-black px-4 py-1 font-heading text-[10px] font-bold uppercase tracking-widest hover:bg-zinc-200 transition-colors">
                  Cancel
                </button>
              )}
            </div>
          </div>

          <div className="border-t border-black pt-4">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-[12px] font-bold font-heading uppercase tracking-widest">Existing Links</h2>
              <div className="flex gap-4">
                <button 
                  onClick={() => handleEditSort('title')}
                  className={`text-[10px] font-bold font-heading uppercase tracking-widest ${editSortKey === 'title' ? 'text-black underline' : 'text-zinc-400 hover:text-black'}`}
                >
                  Sort by Name {editSortKey === 'title' && (editSortOrder === 'asc' ? '↑' : '↓')}
                </button>
                <button 
                  onClick={() => handleEditSort('acronym')}
                  className={`text-[10px] font-bold font-heading uppercase tracking-widest ${editSortKey === 'acronym' ? 'text-black underline' : 'text-zinc-400 hover:text-black'}`}
                >
                  Sort by Acronym {editSortKey === 'acronym' && (editSortOrder === 'asc' ? '↑' : '↓')}
                </button>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              {sortedEditLinks.map(link => (
                <div key={link.id} className="flex items-center justify-between bg-white p-2 border border-zinc-300 hover:border-black transition-colors">
                  <div className="flex flex-col overflow-hidden">
                    <div className="flex flex-wrap items-baseline gap-2">
                      <span className="font-bold text-[14px]">{link.title}</span>
                      <span className="text-[10px] font-heading uppercase tracking-widest text-zinc-500 bg-zinc-100 px-1">{link.acronym}</span>
                      <span className="text-[10px] font-heading uppercase tracking-widest text-zinc-500">{link.category}</span>
                      {link.tags && link.tags.split(',').map(t => t.trim()).filter(Boolean).map((t, idx) => (
                        <span key={idx} className="text-[9px] font-heading uppercase tracking-wider bg-blue-50 text-blue-800 px-1.5 py-0.5 border border-blue-200">
                          {t}
                        </span>
                      ))}
                    </div>
                    <span className="text-[11px] text-zinc-400 truncate mt-0.5">{link.url}</span>
                  </div>
                  <div className="flex gap-2 ml-4 shrink-0">
                    <button onClick={() => handleEditClick(link)} className="text-[10px] font-bold font-heading uppercase tracking-widest text-blue-600 hover:underline">Edit</button>
                    <button onClick={() => handleDeleteLink(link.id)} className="text-[10px] font-bold font-heading uppercase tracking-widest text-red-600 hover:underline">Delete</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </main>
      ) : currentView === 'ABOUT' ? (
        <main className="mt-[20px] px-[36px] max-w-4xl pb-20">
          <div className="bg-white p-6 border border-black shadow-sm">
            <h2 className="text-[12px] font-bold font-heading uppercase tracking-widest mb-6 border-b border-black pb-2 text-black">
              About LionShip
            </h2>
            
            <div className="space-y-4 text-[13px] leading-relaxed text-zinc-700 font-heading">
              <p>
                Welcome to LionShip, a streamlined link index directory and custom search workspace.
              </p>
              
              {/* Space for future copy */}
              <p className="text-zinc-400 italic">
                [Space for custom copy to be written later. You can edit this section inside App.tsx to add your background information, description of your workflows, or list of resources.]
              </p>
              
              <div className="pt-6 border-t border-zinc-200 flex flex-wrap gap-6 text-[10px] font-bold uppercase tracking-wider">
                <a 
                  href="https://github.com" 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="flex items-center gap-1.5 text-black hover:text-blue-600 transition-colors"
                >
                  <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                    <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                  </svg>
                  GitHub
                </a>
                <a 
                  href="https://jeffersonwm.com" 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="flex items-center gap-1.5 text-black hover:text-blue-600 transition-colors"
                >
                  <svg className="w-4 h-4 fill-none stroke-current stroke-2" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                    <polyline points="9 22 9 12 15 12 15 22" />
                  </svg>
                  jeffwm home
                </a>
              </div>
            </div>
          </div>
        </main>
      ) : (
        <>
      <div className={`px-[36px] mt-4 ${viewMode === 'LIST' ? 'max-w-4xl' : 'max-w-full'}`} ref={containerRef}>
        <div className="mb-2 w-full max-w-[600px] relative">
          <div className="flex justify-between items-end mb-0.5 min-h-[16px]">
            <div className="flex items-center gap-4">
              <label className="text-[10px] font-bold font-heading uppercase tracking-[0.1em] text-zinc-500">
                Query Placeholder (%s)
              </label>
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => setSearchEngine('GOOGLE')}
                  className={`text-[10px] font-bold font-heading uppercase tracking-widest transition-colors ${searchEngine === 'GOOGLE' ? 'text-black underline decoration-2' : 'text-zinc-400 hover:text-black'}`}
                >
                  GOOGLE
                </button>
                <button 
                  onClick={() => setSearchEngine('BING')}
                  className={`text-[10px] font-bold font-heading uppercase tracking-widest transition-colors ${searchEngine === 'BING' ? 'text-black underline decoration-2' : 'text-zinc-400 hover:text-black'}`}
                >
                  BING
                </button>
              </div>
            </div>
            {searchHistory.length > 0 && !isHistoryVisible && (
               <span className="text-[9px] font-bold font-heading uppercase tracking-widest text-zinc-300 pointer-events-none">
                 Press ↓ for History
               </span>
            )}
          </div>
          
          <div className="flex flex-wrap gap-x-4 gap-y-1 mb-2">
            {uniqueCategories.map(cat => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`text-[10px] font-bold font-heading uppercase tracking-[0.1em] transition-colors ${selectedCategory === cat ? 'text-black underline decoration-2' : 'text-zinc-500 hover:text-black'}`}
              >
                {cat}
              </button>
            ))}
          </div>

          <div className="flex items-end gap-2 relative">
            <input 
              ref={inputRef}
              type="text"
              autoComplete="off"
              className="flex-1 bg-transparent border-b border-black py-0.5 px-0.5 text-[18px] md:text-[20px] font-heading focus:outline-none placeholder:text-zinc-300 transition-all focus:border-blue-500"
              placeholder="Search term..."
              value={universalQuery}
              onChange={(e) => {
                setUniversalQuery(e.target.value);
                setIsHistoryVisible(false);
              }}
              onKeyDown={handleInputKeyDown}
              onFocus={() => { if (searchHistory.length > 0 && universalQuery === '') setIsHistoryVisible(false); }}
              autoFocus
            />
            <button 
              onClick={handleClear}
              className="border border-black text-black px-4 py-1 font-heading text-[10px] font-bold uppercase tracking-widest hover:bg-zinc-200 transition-colors mb-[1px]"
            >
              Clear
            </button>
            <button 
              onClick={() => handleSubmit()}
              className="bg-black text-white px-4 py-1 font-heading text-[10px] font-bold uppercase tracking-widest hover:bg-zinc-800 transition-colors mb-[1px]"
            >
              Submit
            </button>

            {/* Custom Dropdown for History */}
            {isHistoryVisible && searchHistory.length > 0 && (
              <div className="absolute top-full left-0 right-[150px] bg-white border border-black z-[60] mt-1 shadow-lg max-h-[200px] overflow-y-auto">
                <div className="bg-zinc-100 px-2 py-1 border-b border-zinc-200">
                  <span className="text-[9px] font-bold font-heading text-zinc-500 uppercase tracking-widest">Recent Searches (15)</span>
                </div>
                {searchHistory.map((h, i) => (
                  <div 
                    key={i}
                    onClick={() => selectHistoryItem(h)}
                    onMouseEnter={() => setFocusedHistoryIndex(i)}
                    className={`px-3 py-2 text-[14px] font-heading cursor-pointer transition-colors border-b border-zinc-50 last:border-0 ${focusedHistoryIndex === i ? 'bg-zinc-200 text-black' : 'text-zinc-600 hover:bg-zinc-100'}`}
                  >
                    {h}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex gap-4 mt-3 justify-start items-center">
            <span className="text-[10px] font-bold font-heading uppercase tracking-[0.1em] text-zinc-500">View Layout:</span>
            <button 
              onClick={() => setViewMode('CARDS')}
              className={`text-[10px] font-bold font-heading uppercase tracking-widest transition-colors ${viewMode === 'CARDS' ? 'text-black underline decoration-2' : 'text-zinc-400 hover:text-black'}`}
            >
              CARDS
            </button>
            <button 
              onClick={() => setViewMode('LIST')}
              className={`text-[10px] font-bold font-heading uppercase tracking-widest transition-colors ${viewMode === 'LIST' ? 'text-black underline decoration-2' : 'text-zinc-400 hover:text-black'}`}
            >
              LIST
            </button>
            <button 
              onClick={() => setViewMode('TAGS')}
              className={`text-[10px] font-bold font-heading uppercase tracking-widest transition-colors ${viewMode === 'TAGS' ? 'text-black underline decoration-2' : 'text-zinc-400 hover:text-black'}`}
            >
              TAGS
            </button>
          </div>
        </div>
      </div>

      <main className={`mt-[20px] px-[36px] pb-16 ${viewMode === 'LIST' ? 'max-w-4xl' : 'max-w-full'}`}>
        {viewMode === 'LIST' && (
          <>
            <div className="grid grid-cols-[80px_50px_1fr] gap-x-2 mb-1 border-b border-zinc-300 pb-1 items-center">
              <button 
                onClick={() => handleSort('acronym')}
                className={`text-left text-[11px] font-bold font-heading uppercase tracking-widest transition-colors ${sortKey === 'acronym' ? 'text-black underline decoration-2' : 'text-zinc-400 hover:text-black'}`}
              >
                ACR {sortKey === 'acronym' && (sortOrder === 'asc' ? '↑' : '↓')}
              </button>
              
              <div className="flex flex-col items-center">
                <span className="text-center text-[11px] font-bold font-heading uppercase tracking-widest text-zinc-400 select-none">
                  SEL
                </span>
              </div>

              <button 
                onClick={() => handleSort('title')}
                className={`text-left text-[11px] font-bold font-heading uppercase tracking-widest transition-colors ${sortKey === 'title' ? 'text-black underline decoration-2' : 'text-zinc-400 hover:text-black'}`}
              >
                RESOURCE {sortKey === 'title' && (sortOrder === 'asc' ? '↑' : '↓')}
              </button>
            </div>

            <div className="grid grid-cols-[80px_50px_1fr] gap-x-2 gap-y-0 items-center">
              {sortedAndFilteredLinks.map((link, index) => {
                const isSelected = selectedIds.has(link.id);
                
                return (
                  <React.Fragment key={link.id}>
                    <span className="text-[14px] leading-none text-zinc-400 select-none font-heading uppercase tracking-tighter self-center">
                      {link.acronym.toUpperCase()}
                    </span>

                    <div className="flex justify-center items-center h-full">
                      <input 
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelect(link)}
                        className="w-5 h-5 border-zinc-400 rounded-none cursor-pointer accent-black"
                      />
                    </div>

                    <div className="py-[0px]">
                      <a
                        href={link.url.replace(/%s/g, encodeURIComponent(universalQuery || ''))}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => handleResourceClick(e, link)}
                        className={`text-[12px] md:text-[13px] leading-[1.2] transition-colors inline-block align-middle ${isSelected ? 'text-blue-600 font-bold' : 'text-black hover:text-zinc-500'}`}
                      >
                        {link.title}
                      </a>
                    </div>
                    
                    {(index + 1) % 5 === 0 && index !== sortedAndFilteredLinks.length - 1 && (
                      <div className="col-span-3 h-1.5 flex items-center" aria-hidden="true">
                        <div className="w-full h-[1px] bg-zinc-300 opacity-30" />
                      </div>
                    )}
                  </React.Fragment>
                );
              })}
            </div>
          </>
        )}

        {viewMode === 'CARDS' && (
          <div 
            className="grid gap-4 items-start"
            style={{ gridTemplateColumns: `repeat(${columnCount}, minmax(0, 1fr))` }}
          >
            {categoryColumns.map((colCats, colIdx) => (
              <div key={colIdx} className="flex flex-col gap-4">
                {colCats.map(cat => {
                  const catLinks = linksByCategory[cat] || [];
                  if (catLinks.length === 0) return null;

                  return (
                    <div key={cat} className="bg-white p-4 border-t-[3px] border-t-black shadow-sm">
                      <h3 className="text-xs font-bold font-heading uppercase tracking-widest mb-1.5">
                        {cat.toUpperCase()}
                      </h3>

                      {/* Scoped column headers inside the card */}
                      <div className="grid grid-cols-[70px_40px_1fr] gap-x-2 mb-1 border-b border-zinc-300 pb-0.5 items-center">
                        <button 
                          onClick={() => handleSort('acronym')}
                          className={`text-left text-[10px] font-bold font-heading uppercase tracking-widest transition-colors ${sortKey === 'acronym' ? 'text-black underline decoration-2' : 'text-zinc-400 hover:text-black'}`}
                        >
                          ACR {sortKey === 'acronym' && (sortOrder === 'asc' ? '↑' : '↓')}
                        </button>
                        
                        <button 
                          onClick={() => toggleSelectCategory(catLinks)}
                          className="text-center text-[10px] font-bold font-heading uppercase tracking-widest text-zinc-400 hover:text-black transition-colors select-none"
                        >
                          SEL
                        </button>

                        <button 
                          onClick={() => handleSort('title')}
                          className={`text-left text-[10px] font-bold font-heading uppercase tracking-widest transition-colors ${sortKey === 'title' ? 'text-black underline decoration-2' : 'text-zinc-400 hover:text-black'}`}
                        >
                          RESOURCE {sortKey === 'title' && (sortOrder === 'asc' ? '↑' : '↓')}
                        </button>
                      </div>

                      {/* List of links inside the card */}
                      <div className="grid grid-cols-[70px_40px_1fr] gap-x-2 gap-y-0 items-center">
                        {catLinks.map((link) => {
                          const isSelected = selectedIds.has(link.id);
                          
                          return (
                            <React.Fragment key={link.id}>
                              <span className="text-[14px] leading-none text-zinc-400 select-none font-heading uppercase tracking-tighter self-center truncate" title={link.acronym}>
                                {link.acronym.toUpperCase()}
                              </span>

                              <div className="flex justify-center items-center h-full">
                                <input 
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => toggleSelect(link)}
                                  className="w-5 h-5 border-zinc-400 rounded-none cursor-pointer accent-black"
                                />
                              </div>

                              <div className="py-[0px] min-w-0">
                                <a
                                  href={link.url.replace(/%s/g, encodeURIComponent(universalQuery || ''))}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  onClick={(e) => handleResourceClick(e, link)}
                                  className={`text-[12px] md:text-[13px] leading-[1.2] transition-colors inline-block align-middle truncate w-full ${isSelected ? 'text-blue-600 font-bold' : 'text-black hover:text-zinc-500'}`}
                                  title={link.title}
                                >
                                  {link.title}
                                </a>
                              </div>
                            </React.Fragment>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        )}

        {viewMode === 'TAGS' && (
          <div 
            className="grid gap-4 items-start"
            style={{ gridTemplateColumns: `repeat(${columnCount}, minmax(0, 1fr))` }}
          >
            {tagsColumns.map((colTags, colIdx) => (
              <div key={colIdx} className="flex flex-col gap-4">
                {colTags.map(tag => {
                  const tagLinks = displayedTagsMap[tag] || [];
                  if (tagLinks.length === 0) return null;

                  return (
                    <div key={tag} className="bg-white p-4 border-t-[3px] border-t-black shadow-sm">
                      <h3 className="text-xs font-bold font-heading uppercase tracking-widest mb-1.5 text-blue-700">
                        {tag}
                      </h3>

                      {/* Scoped column headers inside the card */}
                      <div className="grid grid-cols-[70px_40px_1fr] gap-x-2 mb-1 border-b border-zinc-300 pb-0.5 items-center">
                        <button 
                          onClick={() => handleSort('acronym')}
                          className={`text-left text-[10px] font-bold font-heading uppercase tracking-widest transition-colors ${sortKey === 'acronym' ? 'text-black underline decoration-2' : 'text-zinc-400 hover:text-black'}`}
                        >
                          ACR {sortKey === 'acronym' && (sortOrder === 'asc' ? '↑' : '↓')}
                        </button>
                        
                        <button 
                          onClick={() => toggleSelectTag(tagLinks)}
                          className="text-center text-[10px] font-bold font-heading uppercase tracking-widest text-zinc-400 hover:text-black transition-colors select-none"
                        >
                          SEL
                        </button>

                        <button 
                          onClick={() => handleSort('title')}
                          className={`text-left text-[10px] font-bold font-heading uppercase tracking-widest transition-colors ${sortKey === 'title' ? 'text-black underline decoration-2' : 'text-zinc-400 hover:text-black'}`}
                        >
                          RESOURCE {sortKey === 'title' && (sortOrder === 'asc' ? '↑' : '↓')}
                        </button>
                      </div>

                      {/* List of links inside the card */}
                      <div className="grid grid-cols-[70px_40px_1fr] gap-x-2 gap-y-0 items-center">
                        {tagLinks.map((link, idx) => {
                          const isSelected = selectedIds.has(link.id);
                          
                          return (
                            <React.Fragment key={`${link.id}-${idx}`}>
                              <span className="text-[14px] leading-none text-zinc-400 select-none font-heading uppercase tracking-tighter self-center truncate" title={link.acronym}>
                                {link.acronym.toUpperCase()}
                              </span>

                              <div className="flex justify-center items-center h-full">
                                <input 
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => toggleSelect(link)}
                                  className="w-5 h-5 border-zinc-400 rounded-none cursor-pointer accent-black"
                                />
                              </div>

                              <div className="py-[0px] min-w-0">
                                <a
                                  href={link.url.replace(/%s/g, encodeURIComponent(universalQuery || ''))}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  onClick={(e) => handleResourceClick(e, link)}
                                  className={`text-[12px] md:text-[13px] leading-[1.2] transition-colors inline-block align-middle truncate w-full ${isSelected ? 'text-blue-600 font-bold' : 'text-black hover:text-zinc-500'}`}
                                  title={link.title}
                                >
                                  {link.title}
                                </a>
                              </div>
                            </React.Fragment>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        )}
      </main>
      </>
      )}

      <footer className="bottom-banner">
        <div className="px-[36px] w-full flex items-center justify-between">
          <span className="text-[10px] font-bold font-heading uppercase tracking-widest text-black">
            {selectedIds.size} SELECTED / {shownLinksCount} SHOWN
          </span>
          <span className="text-[10px] font-bold font-heading uppercase tracking-widest text-zinc-300">
            {selectedCategory === 'ALL' ? 'FULL INDEX' : `CATEGORY: ${selectedCategory.toUpperCase()}`}
          </span>
        </div>
      </footer>
    </div>
  );
};

export default App;
