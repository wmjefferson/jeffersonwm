import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ImageItem } from '../types';
import { X, Upload, Link, Check, Image as ImageIcon, AlertCircle } from 'lucide-react';

interface UploadModalProps {
  onClose: () => void;
  onUploadCustomImages: (images: ImageItem[]) => void;
}

export const UploadModal: React.FC<UploadModalProps> = ({
  onClose,
  onUploadCustomImages,
}) => {
  const [activeTab, setActiveTab] = useState<'files' | 'urls'>('files');
  const [urlList, setUrlList] = useState('');
  const [uploadedCount, setUploadedCount] = useState(0);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const items: ImageItem[] = [];
    let count = 0;

    (Array.from(files) as File[]).forEach((file: File, idx: number) => {
      if (!file.type.startsWith('image/')) return;

      const reader = new FileReader();
      reader.onload = (event) => {
        const dataUrl = event.target?.result as string;
        items.push({
          id: idx,
          code: `CUSTOM-${String(idx + 1).padStart(5, '0')}`,
          title: file.name.replace(/\.[^/.]+$/, ''),
          category: 'Abstract',
          colorHex: '#38bdf8',
          hue: (idx * 45) % 360,
          brightness: 60,
          imageUrl: dataUrl,
          thumbUrl: dataUrl,
          resolution: 'Custom Upload',
          dateAdded: new Date().toISOString().split('T')[0],
          tags: ['custom', 'uploaded'],
          customUploaded: true,
        });

        count++;
        setUploadedCount(count);

        if (count === files.length) {
          onUploadCustomImages(items);
          onClose();
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const handleUrlSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const urls = urlList
      .split('\n')
      .map((u) => u.trim())
      .filter((u) => u.startsWith('http://') || u.startsWith('https://'));

    if (urls.length === 0) return;

    const items: ImageItem[] = urls.map((url, idx) => ({
      id: idx,
      code: `URL-${String(idx + 1).padStart(5, '0')}`,
      title: `Custom Collection Image #${idx + 1}`,
      category: 'Nature',
      colorHex: '#10b981',
      hue: (idx * 30) % 360,
      brightness: 55,
      imageUrl: url,
      thumbUrl: url,
      resolution: 'External URL',
      dateAdded: new Date().toISOString().split('T')[0],
      tags: ['external', 'url-list'],
      customUploaded: true,
    }));

    onUploadCustomImages(items);
    onClose();
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md select-none">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          className="relative w-full max-w-lg bg-slate-900 border border-slate-700/80 rounded-3xl shadow-2xl overflow-hidden text-slate-100 p-6 space-y-5"
        >
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <Upload className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-base text-slate-100">Import Image Collection</h3>
                <p className="text-xs text-slate-400">Map your own custom image dataset onto the grid</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-200 rounded-lg hover:bg-slate-800"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Tabs */}
          <div className="flex p-1 bg-slate-950 border border-slate-800 rounded-2xl text-xs font-medium">
            <button
              onClick={() => setActiveTab('files')}
              className={`flex-1 py-2 rounded-xl flex items-center justify-center gap-2 transition-colors ${
                activeTab === 'files'
                  ? 'bg-sky-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <ImageIcon className="w-4 h-4" />
              <span>Local Files / Folder</span>
            </button>
            <button
              onClick={() => setActiveTab('urls')}
              className={`flex-1 py-2 rounded-xl flex items-center justify-center gap-2 transition-colors ${
                activeTab === 'urls'
                  ? 'bg-sky-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Link className="w-4 h-4" />
              <span>Paste Image URLs</span>
            </button>
          </div>

          {activeTab === 'files' ? (
            <div className="border-2 border-dashed border-slate-700 hover:border-sky-500/80 rounded-2xl p-8 text-center bg-slate-950/50 transition-colors relative cursor-pointer group">
              <input
                type="file"
                multiple
                accept="image/*"
                onChange={handleFileUpload}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              <div className="flex flex-col items-center gap-3">
                <div className="p-3 rounded-full bg-slate-800 group-hover:bg-sky-500/20 group-hover:text-sky-400 text-slate-400 transition-colors">
                  <Upload className="w-6 h-6" />
                </div>
                <div>
                  <p className="font-semibold text-sm text-slate-200">
                    Click or Drag & Drop image files here
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    Select multiple image files to overwrite grid block previews
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <form onSubmit={handleUrlSubmit} className="space-y-3">
              <label className="block text-xs font-medium text-slate-300">
                Paste Image URLs (one per line)
              </label>
              <textarea
                rows={5}
                value={urlList}
                onChange={(e) => setUrlList(e.target.value)}
                placeholder="https://example.com/image1.jpg&#10;https://example.com/image2.jpg"
                className="w-full p-3 bg-slate-950 border border-slate-800 rounded-2xl text-xs text-slate-100 font-mono focus:outline-none focus:border-sky-500"
              />
              <button
                type="submit"
                className="w-full py-2.5 bg-sky-600 hover:bg-sky-500 text-white font-medium rounded-2xl text-xs transition-colors shadow-lg shadow-sky-600/20"
              >
                Import URL Collection
              </button>
            </form>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
