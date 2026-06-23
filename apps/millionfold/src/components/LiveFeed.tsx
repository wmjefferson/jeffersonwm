import React, { useEffect, useRef } from 'react';
import type { LiveImage } from '../App';

const API_BASE = (import.meta as any).env?.VITE_API_BASE || 'http://localhost:8090';

interface Props {
  images: LiveImage[];
  mode: 'grid' | 'single' | 'both';
}

function SinglePreview({ img }: { img: LiveImage }) {
  const fileName = (img.dest ? img.dest.split(/[\\/]/).pop() : '') || (img.src ? img.src.split(/[\\/]/).pop() : '') || '';
  const fileUrl = `${API_BASE}/api/file?path=${encodeURIComponent(img.status === 'ok' ? (img.dest || '') : (img.src || ''))}`;

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-4 min-h-0">
      <div className="bg-white border-[3px] border-black p-3 shadow-[4px_4px_0px_#000] flex flex-col gap-2 max-w-[90%] max-h-[95%] items-center justify-center">
        {img.status === 'error' ? (
          <div className="w-72 h-72 bg-red-50 border-[2px] border-red-400 flex flex-col items-center justify-center text-center p-4">
            <svg className="w-12 h-12 text-red-500 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <span className="font-archivo text-xs font-bold uppercase tracking-wider text-red-600">Error Processing Image</span>
            <span className="font-sans text-[10px] text-red-500 mt-1 break-all truncate max-w-full">{fileName}</span>
          </div>
        ) : (
          <div className="relative border-[2px] border-black bg-[#fafafa] flex items-center justify-center overflow-hidden w-72 h-72 md:w-80 md:h-80 lg:w-96 lg:h-96 max-w-full max-h-[50vh] aspect-square">
            <img
              src={fileUrl}
              alt={fileName}
              className="w-full h-full object-contain"
            />
            {!img.is_solid && (
              <div className="absolute top-1 right-1 bg-amber-400 border border-black text-black px-1.5 py-0.5 text-[8px] font-archivo font-bold uppercase tracking-wider">
                Uncertain Bg
              </div>
            )}
          </div>
        )}
        <div className="w-full flex items-center justify-between text-[10px] font-archivo font-bold uppercase tracking-wider mt-1 px-1 gap-4">
          <span className="truncate flex-1 min-w-0" title={fileName}>{fileName}</span>
          <span className={`shrink-0 font-bold ${img.status === 'error' ? 'text-red-600' : !img.is_solid ? 'text-amber-500' : 'text-green-600'}`}>
            {img.status === 'error' ? '✕ Failed' : !img.is_solid ? '⚠ Uncertain' : '✓ Processed'}
          </span>
        </div>
      </div>
    </div>
  );
}

function GridHistory({ images, endRef }: { images: LiveImage[]; endRef: React.RefObject<HTMLDivElement | null> }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {images.map((img, i) => (
        <div
          key={i}
          title={img.src ? img.src.split(/[\\/]/).pop() : ''}
          className={`relative w-[72px] h-[72px] shrink-0 border-[2px] overflow-hidden transition-all duration-200 ${
            img.status === 'error'
              ? 'border-red-500'
              : !img.is_solid
              ? 'border-amber-400'
              : 'border-black'
          }`}
        >
          {img.thumb_b64 ? (
            <img
              src={`data:image/jpeg;base64,${img.thumb_b64}`}
              alt=""
              className="w-full h-full object-contain bg-white"
              style={{ imageRendering: 'pixelated' }}
            />
          ) : (
            <div className="w-full h-full bg-[#f0f0f0] flex items-center justify-center">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path d="M3 3h14v14H3V3z" stroke="#ccc" strokeWidth="1.5" />
                <path d="M7 13l3-4 2 2.5 1.5-2L17 13H3z" fill="#ccc" />
              </svg>
            </div>
          )}
          {/* Status dot */}
          <div className={`absolute top-0.5 right-0.5 w-2 h-2 rounded-full ${
            img.status === 'error' ? 'bg-red-500' : !img.is_solid ? 'bg-amber-400' : 'bg-black'
          }`} />
        </div>
      ))}
      <div ref={endRef} />
    </div>
  );
}

export default function LiveFeed({ images, mode }: Props) {
  const endRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to latest
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [images.length]);

  if (images.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-[#bbb]">
        <div className="text-center">
          <div className="font-archivo text-[11px] uppercase tracking-widest">Live feed</div>
          <div className="font-sans text-xs mt-1">Images will appear here as they are processed</div>
        </div>
      </div>
    );
  }

  const latestImage = images[images.length - 1];

  if (mode === 'single') {
    return (
      <div className="flex-1 flex flex-col overflow-hidden bg-[#EAEAEA]">
        <SinglePreview img={latestImage} />
      </div>
    );
  }

  if (mode === 'grid') {
    return (
      <div className="flex-1 overflow-y-auto p-3 bg-white">
        <GridHistory images={images} endRef={endRef} />
      </div>
    );
  }

  // mode === 'both'
  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Top half: Single preview */}
      <div className="flex-1 min-h-0 flex flex-col overflow-hidden bg-[#EAEAEA] border-b-[2px] border-black">
        <SinglePreview img={latestImage} />
      </div>
      {/* Bottom half: Grid history */}
      <div className="h-44 shrink-0 overflow-y-auto p-3 bg-white">
        <GridHistory images={images} endRef={endRef} />
      </div>
    </div>
  );
}
