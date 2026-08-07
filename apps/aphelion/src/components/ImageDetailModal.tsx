import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ImageItem } from '../types';
import { X, Download, Copy, Check, Camera, Calendar, Tag, ExternalLink, Layers, Grid } from 'lucide-react';
import { generateProceduralThumbnail } from '../utils/imageDatabase';

interface ImageDetailModalProps {
  image: ImageItem | null;
  totalBlocks: number;
  onClose: () => void;
}

export const ImageDetailModal: React.FC<ImageDetailModalProps> = ({
  image,
  totalBlocks,
  onClose,
}) => {
  const [copied, setCopied] = useState(false);
  const [imgError, setImgError] = useState(false);

  if (!image) return null;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(image.imageUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const a = document.createElement('a');
    a.href = image.imageUrl;
    a.download = `${image.code}_${image.title.replace(/\s+/g, '_')}.jpg`;
    a.target = '_blank';
    a.click();
  };

  const fallbackDataUrl = generateProceduralThumbnail(image);

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          className="relative w-full max-w-4xl bg-slate-900 border border-slate-700/80 rounded-3xl shadow-2xl overflow-hidden text-slate-100 flex flex-col md:flex-row max-h-[90vh]"
        >
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 z-10 p-2 rounded-full bg-slate-950/70 hover:bg-slate-950 border border-slate-700/60 text-slate-300 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Left Column: Image Display */}
          <div className="w-full md:w-3/5 bg-slate-950 flex items-center justify-center relative min-h-[300px] md:min-h-[500px]">
            <img
              src={imgError ? fallbackDataUrl : image.imageUrl}
              alt={image.title}
              onError={() => setImgError(true)}
              className="max-w-full max-h-[70vh] object-contain p-4"
            />

            <div className="absolute bottom-4 left-4 flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-900/80 backdrop-blur-md border border-slate-700/60 text-xs font-mono">
              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: image.colorHex }} />
              <span className="text-sky-300 font-bold">{image.code}</span>
              <span className="text-slate-500">•</span>
              <span className="text-slate-400">Block #{image.id + 1} of {totalBlocks.toLocaleString()}</span>
            </div>
          </div>

          {/* Right Column: Metadata & Details */}
          <div className="w-full md:w-2/5 p-6 flex flex-col justify-between overflow-y-auto space-y-6">
            <div className="space-y-4">
              <div>
                <span className="inline-block px-3 py-1 rounded-full text-xs font-semibold tracking-wider uppercase bg-sky-500/10 text-sky-400 border border-sky-500/20 mb-2">
                  {image.category}
                </span>
                <h2 className="text-2xl font-bold text-slate-100 tracking-tight">
                  {image.title}
                </h2>
              </div>

              {/* Grid Metadata Cards */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-1">
                  <div className="flex items-center gap-1.5 text-slate-400">
                    <Grid className="w-3.5 h-3.5 text-sky-400" />
                    <span>Block Index</span>
                  </div>
                  <p className="font-mono text-sm font-semibold text-slate-200">
                    #{image.id + 1}
                  </p>
                </div>

                <div className="p-3 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-1">
                  <div className="flex items-center gap-1.5 text-slate-400">
                    <Layers className="w-3.5 h-3.5 text-amber-400" />
                    <span>Resolution</span>
                  </div>
                  <p className="font-mono text-sm font-semibold text-slate-200">
                    {image.resolution}
                  </p>
                </div>

                <div className="p-3 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-1">
                  <div className="flex items-center gap-1.5 text-slate-400">
                    <Calendar className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Catalog Date</span>
                  </div>
                  <p className="font-mono text-sm font-semibold text-slate-200">
                    {image.dateAdded}
                  </p>
                </div>

                <div className="p-3 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-1">
                  <div className="flex items-center gap-1.5 text-slate-400">
                    <Camera className="w-3.5 h-3.5 text-purple-400" />
                    <span>Dominant Hue</span>
                  </div>
                  <p className="font-mono text-sm font-semibold text-slate-200">
                    {image.hue}° ({image.colorHex})
                  </p>
                </div>
              </div>

              {/* Camera Spec */}
              {image.cameraInfo && (
                <div className="p-3 rounded-2xl bg-slate-950/60 border border-slate-800 flex items-center gap-2.5 text-xs text-slate-300">
                  <Camera className="w-4 h-4 text-slate-400 shrink-0" />
                  <span>{image.cameraInfo}</span>
                </div>
              )}

              {/* Tags */}
              <div className="space-y-1.5">
                <span className="text-xs font-medium text-slate-400">Tags & Keywords</span>
                <div className="flex flex-wrap gap-1.5">
                  {image.tags.map((tag) => (
                    <span
                      key={tag}
                      className="px-2.5 py-1 rounded-lg bg-slate-800 text-xs text-slate-300 border border-slate-700/60"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Bottom Actions */}
            <div className="space-y-2 pt-4 border-t border-slate-800">
              <div className="flex gap-2">
                <button
                  onClick={handleDownload}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-2xl bg-sky-600 hover:bg-sky-500 text-white font-medium text-xs transition-colors shadow-lg shadow-sky-600/20"
                >
                  <Download className="w-4 h-4" />
                  <span>Download Image</span>
                </button>

                <button
                  onClick={handleCopyLink}
                  className="p-2.5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors"
                  title="Copy Image URL"
                >
                  {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
