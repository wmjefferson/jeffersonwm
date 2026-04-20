import React, { useState, useEffect } from 'react';
import { FolderOpen, X, Check, Download, ArrowLeft, FileImage } from 'lucide-react';
import StagingView, { DownloadOptions } from './components/StagingView';

const renderableExts = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.avif', '.svg', '.bmp'];
const isRenderable = (filename: string) => {
  const ext = filename.substring(filename.lastIndexOf('.')).toLowerCase();
  return renderableExts.includes(ext);
};
const basename = (filename: string) => filename.split('/').pop() || filename;
const labelWithoutExtension = (filename: string) => {
  const name = basename(filename);
  const dotIndex = name.lastIndexOf('.');
  return dotIndex > 0 ? name.slice(0, dotIndex) : name;
};

const APIBASE = 'https://api.jeffersonwm.com';
const IMAGE_PATH = `${APIBASE}/images`;
const API_PATH = `${APIBASE}/api`;

export default function App() {
  const [images, setImages] = useState<string[]>([]);
  const [directories, setDirectories] = useState<string[]>([]);
  const [currentPath, setCurrentPath] = useState<string>("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalImages, setTotalImages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [imageMeta, setImageMeta] = useState<{type: string, size: number, width: number, height: number} | null>(null);

  const [isSharedView, setIsSharedView] = useState(false);
  const [sharedImages, setSharedImages] = useState<string[] | null>(null);
  const [sharedTitle, setSharedTitle] = useState<string>('');
  const [sharedError, setSharedError] = useState('');

  // New state for row height and limit
  const [rowHeight, setRowHeight] = useState(250);
  const [limit, setLimit] = useState(25);

const computedTotalPages = Math.max(1, Math.ceil(images.length / limit || 1));
const startIndex = (page - 1) * limit;
const endIndex = startIndex + limit;
const pagedImages = images.slice(startIndex, endIndex);
  
  const [selectedImages, setSelectedImages] = useState<Set<string>>(new Set());
  const [isDownloading, setIsDownloading] = useState(false);
  const [view, setView] = useState<'gallery' | 'staging'>('gallery');

const stagedImages = Array.from(selectedImages.size ? selectedImages : new Set(pagedImages)) as string[];

  // Initialize state from URL on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const shareId = params.get('share');
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
          if (data.error) setSharedError(data.error);
          else {
            setSharedImages(data.images);
            if (data.title) setSharedTitle(data.title);
          }
        })
        .catch((err) => {
          if (err.name !== 'AbortError') setSharedError('Failed to load shared page');
        });
      return () => {
        controller.abort();
      };
    }

    const heightParam = params.get('height');
    const colsParam = params.get('columns'); // fallback for old URLs
    const limitParam = params.get('limit');
    const pageParam = params.get('page');

    if (heightParam) setRowHeight(parseInt(heightParam, 10));
    else if (colsParam) {
      const c = parseInt(colsParam, 10);
      if (c <= 2) setRowHeight(400);
      else if (c === 3) setRowHeight(300);
      else setRowHeight(250);
    }
    if (limitParam) setLimit(parseInt(limitParam, 10));
    if (pageParam) setPage(parseInt(pageParam, 10));
  }, []);



  // Update document title
  useEffect(() => {
    if (isSharedView) {
      if (sharedTitle) {
        const truncatedTitle = sharedTitle.length > 48 ? sharedTitle.substring(0, 48) + '...' : sharedTitle;
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
  }, [page, limit, currentPath]);

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
      setImages(data.images || []);
      setDirectories(data.directories || []);
      setTotalPages(data.totalPages || Math.max(1, Math.ceil((data.images || []).length / l || 1)));
      setTotalImages(data.total || (data.images || []).length);
    } catch (err) {
      console.error("Failed to fetch images", err);
      setImages([]);
      setDirectories([]);
      setTotalPages(1);
      setTotalImages(0);
    } finally {
      setLoading(false);
    }
  };

  // Close modal on escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSelectedImage(null);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Fetch metadata when an image is selected
  useEffect(() => {
    if (selectedImage) {
      setImageMeta(null);
      fetch(`${API_PATH}/image-meta/${encodeURI(selectedImage)}`, {
        credentials: 'include',
      })
        .then(res => res.json())
        .then(data => {
          if (!data.error) setImageMeta(data);
        })
        .catch(console.error);
    }
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
    pagedImages.forEach(img => newSet.add(img));
    setSelectedImages(newSet);
  };

  const handleDeselectAll = () => {
    const newSet = new Set(selectedImages);
    pagedImages.forEach(img => newSet.delete(img));
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
      a.download = 'selected-images.zip';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      setView('gallery'); // Return to gallery after download
    } catch (err) {
      console.error(err);
    } finally {
      setIsDownloading(false);
    }
  };

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
            {sharedImages.map(img => (
              <div key={img} className="flex items-center justify-center w-full">
                {isRenderable(img) ? (
                  <img
                  //NEW
                    src={`${IMAGE_PATH}/${encodeURI(img)}`}
                    alt={img}
                    loading="lazy"
                    referrerPolicy="no-referrer"
                    className="max-w-full h-auto object-contain"
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center text-[#888] gap-2 w-64 h-64 bg-[#e0e0e0]">
                    <FileImage size={24} strokeWidth={1.5} />
                    <span className="text-[9px] font-bold uppercase tracking-widest">{img.split('.').pop()}</span>
                  </div>
                )}
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
      {/* Top Banner */}
      <header className="h-[36px] bg-white border-b-[3px] border-black sticky top-0 z-40 flex items-center px-4 shrink-0">
        <h1 className="font-archivo text-sm uppercase tracking-wider font-bold">Perihelion</h1>
      </header>

      {/* Main Content */}
      <main className="flex-1 px-4 pt-4 pb-[52px] sm:px-6 sm:pt-6 sm:pb-[60px] max-w-[1800px] mx-auto w-full">
        
        {/* Options Area */}
        <div className="flex flex-col gap-2 mb-6">
          {/* Options Row 1: Row Height */}
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

          {/* Options Row 2: Limit */}
          <div className="flex items-center gap-3 font-sans text-[11px] font-bold uppercase tracking-wider">
            <span className="text-[#888]">Images per page</span>
            {Array.from(new Set([...[10, 25, 40, 50], limit])).sort((a, b) => a - b).map(num => (
              <button
                key={num}
                onClick={() => { setLimit(num); setPage(1); }}
                className={limit === num ? 'text-black underline decoration-[1.5px] underline-offset-[3px]' : 'text-[#888] hover:text-black'}
              >
                {num}
              </button>
            ))}
          </div>

          {/* Options Row 3: Selection */}
          <div className="flex items-center gap-3 font-sans text-[11px] font-bold uppercase tracking-wider mt-2">
            <span className="text-[#888]">Selection</span>
            <button onClick={handleSelectAll} className="text-[#888] hover:text-black">Select Page</button>
            <button onClick={handleDeselectAll} className="text-[#888] hover:text-black">Deselect Page</button>
            {selectedImages.size > 0 && (
              <button onClick={() => setSelectedImages(new Set())} className="text-[#888] hover:text-black">Clear All</button>
            )}
            {selectedImages.size > 0 && (
              <button
                onClick={() => {
                  // If nothing is selected, stage the current page
                  if (selectedImages.size === 0) {
                    const newSet = new Set(selectedImages);
                    pagedImages.forEach(img => newSet.add(img));
                    setSelectedImages(newSet);
                  }
                  setView('staging');
                }}
                disabled={isDownloading && selectedImages.size === 0}
                className="ml-auto bg-black text-white px-3 py-1.5 flex items-center gap-2 hover:bg-[#333] disabled:bg-[#888] transition-colors"
              >
                <Download size={14} strokeWidth={2.5} />
              Stage {selectedImages.size || pagedImages.length} Images
            </button>
            )}
          </div>
        </div>

        {currentPath && (
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

        {directories.length > 0 && (
          <div className="mb-8">
            <h2 className="text-[11px] font-bold uppercase tracking-widest text-[#666] mb-4">Folders</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {directories.map(dir => (
                <button
                  key={dir}
                  onClick={() => { setCurrentPath(dir); setPage(1); }}
                  className="bg-white border-[2px] border-[#666] p-4 flex items-center gap-3 hover:border-black hover:shadow-[0_0_0_2px_rgba(0,0,0,1)] transition-all group text-left"
                >
                  <FolderOpen size={20} className="text-black shrink-0" />
                  <span className="font-sans text-[11px] font-bold uppercase truncate">{basename(dir)}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        <h2 className="text-[11px] font-bold uppercase tracking-widest text-[#666] mb-4">Images</h2>
        {loading ? (
          <div className="flex items-center justify-center h-[40vh]">
            <div className="font-sans font-bold text-xl uppercase tracking-widest animate-pulse">Loading...</div>
          </div>
        ) : images.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-[40vh] text-center max-w-md mx-auto">
            <div className="bg-white p-4 border-[2px] border-[#666] mb-6">
              <FolderOpen size={40} className="text-black" strokeWidth={1.5} />
            </div>
            <h2 className="font-archivo text-2xl uppercase mb-3">No images found</h2>
            <p className="font-serif text-lg leading-relaxed">
              Drop image files into the <code className="bg-white border border-[#666] px-1.5 py-0.5 text-sm font-sans">images</code> folder on the backend.
            </p>
          </div>
        ) : (
          <div className="flex flex-wrap gap-4 sm:gap-6">
            {pagedImages.map((img, idx) => (
              <div
                key={idx}
                className={`bg-white border-[2px] flex flex-col transition-all ${selectedImages.has(img) ? 'border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] z-10' : 'border-[#666] hover:border-black'}`}
              >
                <div 
                  className={`border-b-[2px] ${selectedImages.has(img) ? 'border-black' : 'border-[#666]'} bg-[#e0e0e0] relative flex items-center justify-center overflow-hidden cursor-pointer`}
                  style={{ height: `${rowHeight}px` }}
                  onClick={() => setSelectedImage(img)}
                >
                  <button
                    onClick={(e) => toggleSelection(img, e)}
                    className={`absolute top-2 left-2 z-20 w-6 h-6 border-[2px] flex items-center justify-center transition-colors ${selectedImages.has(img) ? 'bg-black border-black' : 'bg-white border-[#666] hover:border-black'}`}
                  >
                    {selectedImages.has(img) && <Check size={16} className="text-white" strokeWidth={3} />}
                  </button>
                  {isRenderable(img) ? (
                    <img
                      src={`${IMAGE_PATH}/${encodeURI(img)}`}
                      alt={img}
                      loading="lazy"
                      referrerPolicy="no-referrer"
                      className="h-full w-auto object-contain p-2"
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center text-[#888] gap-2 w-48 h-full">
                      <FileImage size={32} strokeWidth={1.5} />
                      <span className="text-[10px] font-bold uppercase tracking-widest">{img.split('.').pop()} FILE</span>
                    </div>
                  )}
                </div>
                <div className="p-3 bg-white shrink-0" style={{ width: '0', minWidth: '100%' }}>
                  <p className={`font-sans text-[11px] font-bold uppercase truncate w-full block ${selectedImages.has(img) ? 'text-black' : 'text-[#888]'}`} title={img}>{basename(img)}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Bottom Banner */}
      <footer className="h-[36px] bg-white border-t-[3px] border-black fixed bottom-0 left-0 right-0 z-40 flex items-center justify-between px-4">
        <div className="font-sans text-[11px] font-bold uppercase tracking-wider">
          PAGE {page} OF {computedTotalPages} / {selectedImages.size > 0 ? <span className="text-black bg-[#e0e0e0] px-1.5 py-0.5 mr-1">{selectedImages.size} SELECTED /</span> : null} {pagedImages.length} SHOWN / {totalImages} TOTAL
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

      {/* Fullscreen Image Modal */}
      {selectedImage && (
        <div 
          className="fixed inset-0 z-50 bg-[#F0F0F0]/95 backdrop-blur-sm flex items-center justify-center p-4 sm:p-12 animate-in fade-in duration-200"
          onClick={() => setSelectedImage(null)}
        >
          <div className="absolute top-6 right-6 flex items-center gap-2 z-10">
            <a 
              href={`${API_PATH}/download/${encodeURI(selectedImage)}`}
              download
              onClick={(e) => e.stopPropagation()}
              className="p-2 bg-white border-[2px] border-[#666] hover:bg-black hover:text-white transition-colors flex items-center justify-center"
              title="Download Image"
            >
              <Download size={24} strokeWidth={2} />
            </a>
            <button 
              className="p-2 bg-white border-[2px] border-[#666] hover:bg-black hover:text-white transition-colors flex items-center justify-center"
              onClick={(e) => {
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
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedImage(null);
                }}
              />
            ) : (
              <div 
                className="w-full max-w-2xl aspect-video border-[2px] border-[#666] bg-white flex flex-col items-center justify-center text-[#888] gap-4"
                onClick={(e) => e.stopPropagation()}
              >
                <FileImage size={64} strokeWidth={1.5} />
                <span className="text-sm font-bold uppercase tracking-widest">{selectedImage.split('.').pop()} FILE FORMAT</span>
                <span className="text-xs">Preview not available in browser</span>
              </div>
            )}
            <div className="bg-white border-[2px] border-[#666] px-4 py-2 font-sans font-bold uppercase text-[11px] text-[#888] flex flex-col items-center text-center">
              <span className="text-black">{labelWithoutExtension(selectedImage)}</span>
              {imageMeta ? (
                <span className="text-[9px] mt-1 tracking-widest">
                  {imageMeta.type} • {(imageMeta.size / 1024 > 1024 ? (imageMeta.size / 1024 / 1024).toFixed(2) + ' MB' : (imageMeta.size / 1024).toFixed(1) + ' KB')} • {imageMeta.width} × {imageMeta.height} PX
                </span>
              ) : (
                <span className="text-[9px] mt-1 tracking-widest animate-pulse">LOADING METADATA...</span>
              )}
              <a 
                href={`${IMAGE_PATH}/${encodeURI(selectedImage)}`} 
                target="_blank" 
                rel="noreferrer" 
                className="text-[9px] mt-2 lowercase text-[#F27D26] hover:underline tracking-wider break-all max-w-lg"
                onClick={(e) => e.stopPropagation()}
              >
                {window.location.origin}/images/{selectedImage}
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
