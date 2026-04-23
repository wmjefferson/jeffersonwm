
import React, { useState, useMemo, useEffect, useRef } from 'react';

interface LinkItem {
  id: string;
  title: string;
  url: string;
  acronym: string;
  category: string;
}

const INITIAL_LINKS: LinkItem[] = [
  { id: '1', title: 'AlternativeTo', url: 'https://alternativeto.net/browse/search?q=%s', acronym: 'al', category: 'Internet Things' },
  { id: '2', title: 'Amazon', url: 'https://www.amazon.com/s?k=%s', acronym: 'az', category: 'Shopping' },
  { id: '3', title: 'Internet Archive', url: 'https://archive.org/search.php?query=%s&sin=', acronym: 'ia', category: 'Media' },
  { id: '4', title: 'Art Institute of Chicago', url: 'https://www.artic.edu/search?q=%s', acronym: 'aic', category: 'Museums' },
  { id: '5', title: 'Artvee', url: 'https://artvee.com/main/?s=%s&tc=ma', acronym: 'av', category: 'Art' },
  { id: '6', title: 'Asian Art Museum', url: 'https://searchcollection.asianart.org/search/%s', acronym: 'aam', category: 'Museums' },
  { id: '7', title: 'Dick Blick', url: 'https://www.dickblick.com/search/?q=%s', acronym: 'blick', category: 'Shopping' },
  { id: '8', title: 'British Museum', url: 'https://www.britishmuseum.org/collection/search?keyword=%s', acronym: 'brit', category: 'Museums' },
  { id: '9', title: 'Carnegie Museum of Art', url: 'https://collection.carnegieart.org/?searchbox="%s"', acronym: 'car', category: 'Museums' },
  { id: '10', title: 'Classic Cat', url: 'https://www.google.com/cse?cx=partner-pub-1638871118279906%3A555nq9-ye5y&ie=ISO-8859-1&q=%s&sa=Search&siteurl=www.classiccat.net%2F&ref=classiccat.net%2F&ss=29834j617024068j19', acronym: 'cc', category: 'Media' },
  { id: '11', title: 'Cleveland Museum of Art', url: 'https://www.clevelandart.org/art/collection/search?search=%s', acronym: 'cleve', category: 'Museums' },
  { id: '12', title: 'Cleveland Museum of Art (Open Access)', url: 'https://www.clevelandart.org/art/collection/search?search=%s&cc0=1', acronym: 'cleveoa', category: 'Museums' },
  { id: '13', title: 'Craigslist SF', url: 'https://sfbay.craigslist.org/search/sfc/sss?query=%s#search=2~gallery~0', acronym: 'CL', category: 'OTHER' },
  { id: '14', title: 'Dictionary.com', url: 'https://www.dictionary.com/browse/%s', acronym: 'di', category: 'Words' },
  { id: '15', title: 'eBay', url: 'https://www.ebay.com/sch/i.html?_from=R40&_trksid=m570.l1313&_nkw=%s&_sacat=0', acronym: 'e', category: 'Shopping' },
  { id: '16', title: 'Etsy', url: 'https://www.etsy.com/search.php?search_query=%s&search_type=all', acronym: 'etsy', category: 'Shopping' },
  { id: '17', title: 'Fine Arts Museums of San Francisco', url: 'https://www.famsf.org/art-finder?q=%s', acronym: 'famsf', category: 'Museums' },
  { id: '18', title: 'Google Arts & Culture', url: 'https://artsandculture.google.com/u/0/search?q=%s', acronym: 'gac', category: 'Art' },
  { id: '19', title: 'Chrome Web Store', url: 'https://chromewebstore.google.com/search/%s?itemTypes=EXTENSION', acronym: 'cx', category: 'Internet Things' },
  { id: '20', title: 'Google Define', url: 'https://www.google.com/search?q=define+%s', acronym: 'gd', category: 'Words' },
  { id: '21', title: 'Google Maps', url: 'https://www.google.com/maps?q=%s', acronym: 'gm', category: 'Internet Things' },
  { id: '22', title: 'Google Translate', url: 'https://translate.google.com/?sl=auto&tl=en&text=%s%0A&op=translate', acronym: 'tr', category: 'Words' },
  { id: '23', title: 'GSMArena', url: 'https://www.gsmarena.com/res.php3?sSearch=%s', acronym: 'gsm', category: 'OTHER' },
  { id: '24', title: 'IKEA', url: 'https://www.ikea.com/us/en/search/?q=%s', acronym: 'ikea', category: 'Shopping' },
  { id: '25', title: 'Iterative Anagram Solver', url: 'https://boulter.com/anagram/?letters=%s', acronym: 'ana', category: 'Words' },
  { id: '26', title: 'Library of Congress', url: 'https://www.loc.gov/pictures/search?q=%s&sp=1&sb=&st=list&co=&sg=false&fi=all&op=AND&va=all&c=', acronym: 'loc', category: 'Art' },
  { id: '27', title: 'LACMA', url: 'https://collections.lacma.org/search/site/%s?', acronym: 'lacma', category: 'Museums' },
  { id: '28', title: 'Louvre', url: 'https://collections.louvre.fr/en/recherche?q=%s', acronym: 'lou', category: 'Museums' },
  { id: '29', title: 'Merriam-Webster Dictionary', url: 'https://www.merriam-webster.com/dictionary/%s', acronym: 'mdi', category: 'Words' },
  { id: '30', title: 'Merriam-Webster Thesaurus', url: 'https://www.merriam-webster.com/thesaurus/%s', acronym: 'mth', category: 'Words' },
  { id: '31', title: 'Vatican Museums', url: 'https://www.museivaticani.va/content/museivaticani/en/utility/search.html?q=%s&path=', acronym: 'vat', category: 'Museums' },
  { id: '32', title: 'MoMA', url: 'https://www.moma.org/collection/?utf8=%E2%9C%93&q=%s&classifications=any&date_begin=Pre-1850&date_end=2022&with_images=1', acronym: 'moma', category: 'Museums' },
  { id: '33', title: 'National Archives (Maryland)', url: 'https://search.archives.gov/search?query=%s&submit=&utf8=&affiliate=national-archives', acronym: 'na', category: 'Museums' },
  { id: '34', title: 'National Gallery of Art (Washington, DC)', url: 'https://www.nga.gov/global-site-search-page.html?searchterm=%s', acronym: 'nga', category: 'Museums' },
  { id: '35', title: 'National Portrait Gallery (London)', url: 'https://www.npg.org.uk/collections/search/portrait-list.php?search=sp&sText=%s', acronym: 'npg', category: 'Museums' },
  { id: '36', title: 'NYPL Digital Collections', url: 'https://digitalcollections.nypl.org/search/index?utf8=%E2%9C%93&keywords=%s', acronym: 'nypl', category: 'Art' },
  { id: '37', title: 'O*NET', url: 'https://www.onetonline.org/find/result?s=%s', acronym: 'onet', category: 'OTHER' },
  { id: '38', title: 'Opera Addons', url: 'https://addons.opera.com/en/search/?query=%s', acronym: 'ox', category: 'Internet Things' },
  { id: '39', title: 'MLA (Purdue OWL)', url: 'https://owl.purdue.edu/search.html?search=%s#gsc.tab=0&gsc.q=colon&gsc.page=1', acronym: 'mla', category: 'Words' },
  { id: '40', title: 'PicClick', url: 'https://picclick.com/?q=%s', acronym: 'picc', category: 'Shopping' },
  { id: '41', title: 'Related Words', url: 'https://relatedwords.io/%s', acronym: 'rw', category: 'Words' },
  { id: '42', title: 'RhymeZone', url: 'https://www.rhymezone.com/r/rhyme.cgi?Word=%s&typeofrhyme=perfect&org1=syl&org2=l&org3=y', acronym: 'rh', category: 'Words' },
  { id: '43', title: 'SFMOMA', url: 'https://www.sfmoma.org/?s=%s', acronym: 'sfmoma', category: 'Museums' },
  { id: '44', title: 'Zucker (Flickr)', url: 'https://www.flickr.com/search/?user_id=82032880%40N00&view_all=1&text=%s', acronym: 'zucker', category: 'Art' },
  { id: '45', title: 'Smarthistory', url: 'https://smarthistory.org/?s=%s', acronym: 'sh', category: 'Art' },
  { id: '46', title: 'Smithsonian Institute', url: 'https://www.si.edu/search/images?edan_q=%s', acronym: 'sm', category: 'Museums' },
  { id: '47', title: 'Target', url: 'https://www.target.com/s?searchTerm=%s&prehydrateSearch=true', acronym: 't', category: 'Shopping' },
  { id: '48', title: 'Tate', url: 'https://www.tate.org.uk/search?q=%s', acronym: 'tate', category: 'Museums' },
  { id: '49', title: 'Temu', url: 'https://www.temu.com/search_result.html?search_key=%s', acronym: 'temu', category: 'Shopping' },
  { id: '50', title: 'Met Museum', url: 'https://www.metmuseum.org/art/collection/search?q=%s', acronym: 'met', category: 'Museums' },
  { id: '51', title: 'Thesaurus.com', url: 'https://www.thesaurus.com/browse/%s', acronym: 'th', category: 'Words' },
  { id: '52', title: 'ThriftBooks', url: 'https://www.thriftbooks.com/browse/?b.search=%s#b.s=mostPopular-desc&b.p=1&b.pp=50&b.oos&b.tile', acronym: 'tb', category: 'Shopping' },
  { id: '53', title: 'Uffizi', url: 'https://www.uffizi.it/opere/cerca?query=%s', acronym: 'uff', category: 'Museums' },
  { id: '54', title: 'Visuwords', url: 'https://visuwords.com/%s', acronym: 'vi', category: 'Words' },
  { id: '55', title: 'VS Code Marketplace', url: 'https://marketplace.visualstudio.com/search?term=%s&target=VSCode&category=All%20categories&sortBy=Relevance', acronym: 'vsc', category: 'OTHER' },
  { id: '56', title: 'Walmart', url: 'https://www.walmart.com/search?q=%s', acronym: 'wal', category: 'Shopping' },
  { id: '57', title: 'Walters Art Museum', url: 'https://art.thewalters.org/search/?q=%s', acronym: 'WALT', category: 'Museums' },
  { id: '58', title: 'Wayfair', url: 'https://www.wayfair.com/keyword.php?keyword=%s', acronym: 'way', category: 'Shopping' },
  { id: '59', title: 'Whitney Museum', url: 'https://whitney.org/collection/works?q%5Bsearch_cont%5D=%s&q%5Bs%5D=&q%5Bmedium_cont%5D=&q%5Bcredit_line_cont%5D=&q%5Bsort_date_gteq%5D=&q%5Bsort_date_lteq%5D=', acronym: 'whit', category: 'Museums' },
  { id: '60', title: 'Wordsmith Anagram', url: 'https://new.wordsmith.org/anagram/anagram.cgi?anagram=%s&t=500&a=n', acronym: 'ws', category: 'Words' },
  { id: '61', title: 'Yale Digital Collections', url: 'https://collections.library.yale.edu/catalog?f%5Bvisibility_ssi%5D%5B%5D=Public&q=%s&search_field=all_fields', acronym: 'yale', category: 'Art' },
  { id: '62', title: 'YouTube', url: 'https://www.youtube.com/results?search_query=%s', acronym: 'yt', category: 'Media' },
  { id: '63', title: 'YouTube Music', url: 'https://music.youtube.com/search?q=%s', acronym: 'ytm', category: 'Media' },
  { id: '64', title: 'Zazzle', url: 'https://www.zazzle.com/pd/find?qs=%s&hs=true', acronym: 'zazzle', category: 'Shopping' },
  { id: '65', title: 'Merriam-Webster Words that START With', url: 'https://www.merriam-webster.com/wordfinder/classic/begins/all/-1/%s/1', acronym: 'start', category: 'Words' },
  { id: '66', title: 'Merriam-Webster Words that END with', url: 'https://www.merriam-webster.com/wordfinder/classic/ends/all/-1/%s/1', acronym: 'end', category: 'Words' },
  { id: '67', title: 'Project Gutenberg', url: 'https://www.gutenberg.org/ebooks/search/?query=%s', acronym: 'gut', category: 'Media' },
  { id: '68', title: 'Meisterdrucke', url: 'https://www.meisterdrucke.us/suche/%s.html', acronym: 'md', category: 'Art' },
  { id: '69', title: 'SYMBL.cc', url: 'https://symbl.cc/en/search/?q=%s', acronym: 'sym', category: 'Words' },
  { id: '70', title: 'GitHub', url: 'https://github.com/search?q=%s&ref=opensearch', acronym: 'git', category: 'Internet Things' },
  { id: '71', title: 'Chewy', url: 'https://www.chewy.com/s?query=%s', acronym: 'c', category: 'Shopping' },
  { id: '72', title: 'New York Times', url: 'https://www.nytimes.com/search?query=%s', acronym: 'nyt', category: 'News' },
  { id: '73', title: 'San Francisco Chronicle', url: 'https://www.sfchronicle.com/search/?action=search&query=%s', acronym: 'sfc', category: 'News' },
  { id: '74', title: 'Mission Local', url: 'https://missionlocal.org/?s=%s', acronym: 'mc', category: 'News' },
  { id: '75', title: 'San Francisco Examiner', url: 'https://www.sfexaminer.com/search/?l=25&s=start_time&sd=desc&f=html&t=article%2Cvideo%2Cyoutube%2Ccollection&app=editorial&nsa=eedition&q=%s', acronym: 'sfe', category: 'News' },
  { id: '76', title: 'Associated Press', url: 'https://apnews.com/search?q=%s#nt=navsearch', acronym: 'ap', category: 'News' },
  { id: '77', title: 'Reuters', url: 'https://www.reuters.com/site-search/?query=%s', acronym: 'reu', category: 'News' },
  { id: '78', title: 'The Guardian', url: 'https://www.google.co.uk/search?q=%s&as_sitesearch=www.theguardian.com', acronym: 'gu', category: 'News' },
  { id: '79', title: 'CNN', url: 'https://www.cnn.com/search?q=%s', acronym: 'cnn', category: 'News' },
  { id: '80', title: 'Allrecipies', url: 'https://www.allrecipes.com/search?q=%s', acronym: 'all', category: 'OTHER' },
  { id: '81', title: 'NerdWallet', url: 'https://www.nerdwallet.com/search/results?page=1&q=%s', acronym: 'nerd', category: 'OTHER' },
  { id: '82', title: 'KHInsider', url: 'https://downloads.khinsider.com/search?search=%s', acronym: 'kh', category: 'OTHER' },
  { id: '83', title: 'Art Encyclopedia (Visual Arts Cork) ARTISTS', url: 'http://www.visual-arts-cork.com/site/artist-biographies-alphabetical.htm#:~:text=%s', acronym: 'vac', category: 'Art' },
  { id: '84', title: 'Museo del Prado', url: 'https://www.museodelprado.es/en/explore?searchMeta=%s', acronym: 'prado', category: 'Museums' },
  { id: '85', title: 'Artchive', url: 'https://www.artchive.com/?s=%s', acronym: 'ac', category: 'Art' },
  { id: '86', title: 'National Gallery UK Picture Library', url: 'https://www.nationalgalleryimages.co.uk/search/?searchQuery=%s', acronym: 'nguk', category: 'Museums' },
  { id: '87', title: 'New South Wales, Art Gallery of', url: 'https://www.artgallery.nsw.gov.au/search/?q=%s', acronym: 'nsw', category: 'Museums' },
  { id: '88', title: 'YouTube, Periscope Film', url: 'https://www.youtube.com/@PeriscopeFilm/search?query=%s', acronym: 'ytp', category: 'Media' },
  { id: '89', title: 'Web Gallery of Art', url: 'https://www.wga.hu/cgi-bin/search.cgi?author=&title=&comment=%s&time=any&school=any&form=any&type=any&location=&format=5', acronym: 'wga', category: 'Art' },
  { id: '90', title: 'Rijksmuseum', url: 'https://www.rijksmuseum.nl/en/content-search?q=%s', acronym: 'rijk', category: 'Museums' },
  { id: '91', title: 'Philadelphia Museum of Art', url: 'https://www.philamuseum.org/collection?query=%s', acronym: 'pma', category: 'Museums' }
];

type SortKey = 'acronym' | 'title';
type SortOrder = 'asc' | 'desc';
type SearchEngine = 'GOOGLE' | 'BING';

const App: React.FC = () => {
  const [links, setLinks] = useState<LinkItem[]>(INITIAL_LINKS);
  const [dbStatus, setDbStatus] = useState<'LOADING' | 'CONNECTED' | 'DISCONNECTED'>('LOADING');

  useEffect(() => {
    // Try to load from database first
    fetch('/api/links')
      .then(res => {
        if (!res.ok) throw new Error('DB not available');
        return res.json();
      })
      .then(async (data) => {
        setDbStatus('CONNECTED');
        if (data.length === 0) {
          // If DB is empty, let's sync localStorage OR initial links into the DB
          const savedStr = localStorage.getItem('linkstream_links');
          const linksToSync = savedStr ? JSON.parse(savedStr) : INITIAL_LINKS;
          setLinks(linksToSync);
          
          await fetch('/api/links/batch', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ links: linksToSync })
          });
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
            setLinks(INITIAL_LINKS);
          }
        } else {
          setLinks(INITIAL_LINKS);
        }
      });
  }, []);

  useEffect(() => {
    // We only rely on localStorage as a permanent backup when disconnected format
    if (dbStatus === 'DISCONNECTED') {
      localStorage.setItem('linkstream_links', JSON.stringify(links));
    }
  }, [links, dbStatus]);

  const [isEditMode, setIsEditMode] = useState(false);
  const [editingLinkId, setEditingLinkId] = useState<string | null>(null);
  const [editFormData, setEditFormData] = useState({ title: '', url: '', acronym: '', category: '' });

  const handleEditClick = (link: LinkItem) => {
    setEditingLinkId(link.id);
    setEditFormData({ title: link.title, url: link.url, acronym: link.acronym, category: link.category });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSaveEdit = async () => {
    if (!editFormData.title || !editFormData.url || !editFormData.acronym || !editFormData.category) return;
    
    let updatedLinks;
    let newOrUpdatedLink;

    if (editingLinkId) {
      newOrUpdatedLink = { id: editingLinkId, ...editFormData } as LinkItem;
      updatedLinks = links.map(l => l.id === editingLinkId ? newOrUpdatedLink : l);
      
      if (dbStatus === 'CONNECTED') {
        await fetch(`/api/links/${editingLinkId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newOrUpdatedLink)
        }).catch(err => console.error(err));
      }
    } else {
      const newId = Date.now().toString();
      newOrUpdatedLink = { id: newId, ...editFormData } as LinkItem;
      updatedLinks = [...links, newOrUpdatedLink];

      if (dbStatus === 'CONNECTED') {
        await fetch(`/api/links`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newOrUpdatedLink)
        }).catch(err => console.error(err));
      }
    }
    
    setLinks(updatedLinks);
    setEditingLinkId(null);
    setEditFormData({ title: '', url: '', acronym: '', category: '' });
  };

  const handleDeleteLink = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this link?')) {
      if (dbStatus === 'CONNECTED') {
        await fetch(`/api/links/${id}`, {
          method: 'DELETE'
        }).catch(err => console.error(err));
      }

      setLinks(links.filter(l => l.id !== id));
      if (editingLinkId === id) {
        setEditingLinkId(null);
        setEditFormData({ title: '', url: '', acronym: '', category: '' });
      }
    }
  };

  const handleCancelEdit = () => {
    setEditingLinkId(null);
    setEditFormData({ title: '', url: '', acronym: '', category: '' });
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
          Running in offline mode. Add MYSQL_ variables in settings to save permanently.
        </div>
      )}
      <header className="top-banner">
        <div className="px-[36px] w-full flex items-center justify-between">
          <h1 className="text-sm font-bold font-heading uppercase tracking-tighter text-black">
            LINKS INDEX
          </h1>
          <button 
            onClick={() => setIsEditMode(!isEditMode)}
            className="text-[10px] font-bold font-heading uppercase tracking-widest hover:underline text-black"
          >
            {isEditMode ? 'DONE EDITING' : 'EDIT LINKS'}
          </button>
        </div>
      </header>

      {isEditMode ? (
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
                <input type="text" value={editFormData.category} onChange={e => setEditFormData({...editFormData, category: e.target.value})} className="w-full border border-black px-2 py-1 text-[14px] font-heading focus:outline-none focus:border-blue-500" />
              </div>
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
                    <div className="flex items-baseline gap-2">
                      <span className="font-bold text-[14px]">{link.title}</span>
                      <span className="text-[10px] font-heading uppercase tracking-widest text-zinc-500 bg-zinc-100 px-1">{link.acronym}</span>
                      <span className="text-[10px] font-heading uppercase tracking-widest text-zinc-500">{link.category}</span>
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
      ) : (
        <>
      <div className="px-[36px] mt-4 max-w-4xl" ref={containerRef}>
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
        </div>
      </div>

      <main className="mt-[20px] px-[36px] max-w-4xl">
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
      </main>
      </>
      )}

      <footer className="bottom-banner">
        <div className="px-[36px] w-full flex items-center justify-between">
          <span className="text-[10px] font-bold font-heading uppercase tracking-widest text-black">
            {selectedIds.size} SELECTED / {sortedAndFilteredLinks.length} SHOWN
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
