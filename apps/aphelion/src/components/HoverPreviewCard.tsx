import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { HoverState } from '../types';
import { getBrowserThumbnailUrl } from '../utils/imageDatabase';

interface HoverPreviewCardProps {
  hover: HoverState | null;
}

export const HoverPreviewCard: React.FC<HoverPreviewCardProps> = ({ hover }) => {
  const [imgError, setImgError] = useState(false);
  const [previewSrc, setPreviewSrc] = useState<string>('');
  const image = hover?.image ?? null;

  const imgWidth = 640;

  useEffect(() => {
    if (!image) {
      setImgError(false);
      setPreviewSrc('');
      return;
    }

    let cancelled = false;
    setImgError(false);
    setPreviewSrc('');

    getBrowserThumbnailUrl(image.imageUrl, imgWidth)
      .then((thumbnailUrl) => {
        if (!cancelled) {
          setPreviewSrc(thumbnailUrl);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setPreviewSrc(image.thumbUrl || image.imageUrl);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [image?.imageUrl, image?.thumbUrl, imgWidth]);

  if (!hover || !image) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.08 }}
        style={{
          position: 'fixed',
          left: '50%',
          top: '50%',
          width: '640px',
          height: '640px',
          transform: 'translate(-50%, -50%)',
          zIndex: 50,
          pointerEvents: 'none',
        }}
        className="overflow-hidden border border-[#e5e5e5]"
      >
        {previewSrc && !imgError ? (
          <img
            src={previewSrc}
            alt=""
            onError={() => setImgError(true)}
            className="w-full h-full object-cover"
            loading="eager"
          />
        ) : null}
      </motion.div>
    </AnimatePresence>
  );
};
