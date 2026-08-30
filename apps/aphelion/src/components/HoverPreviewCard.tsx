import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { HoverState } from '../types';
import { BACKGROUND_PLACEHOLDER_URL, getBrowserThumbnailUrl } from '../utils/imageDatabase';

interface HoverPreviewCardProps {
  hover: HoverState | null;
  size?: number;
}

export const HoverPreviewCard: React.FC<HoverPreviewCardProps> = ({ hover, size = 640 }) => {
  const [imgError, setImgError] = useState(false);
  const [previewSrc, setPreviewSrc] = useState<string>(BACKGROUND_PLACEHOLDER_URL);
  const [settledImage, setSettledImage] = useState<HoverState['image'] | null>(null);
  const image = settledImage;
  const currentImageIdRef = useRef<number | null>(null);

  const imgWidth = size;

  // Instant update on click/pinned; 200ms debounce on regular hover
  useEffect(() => {
    if (!hover?.image) {
      return;
    }

    if (hover.pinned) {
      setSettledImage(hover.image);
      return;
    }

    const timeout = window.setTimeout(() => {
      setSettledImage(hover.image);
    }, 200);

    return () => window.clearTimeout(timeout);
  }, [hover?.image, hover?.pinned]);

  // Load new image — preserve current src until new one is ready to prevent flash
  useEffect(() => {
    if (!image) {
      return;
    }

    currentImageIdRef.current = image.id;
    let cancelled = false;
    setImgError(false);

    // Use thumb/original URL as an immediate fallback for each newly hovered image.
    const fastSrc = image.thumbUrl || image.imageUrl;
    setPreviewSrc(fastSrc);

    getBrowserThumbnailUrl(image.imageUrl, imgWidth)
      .then((thumbnailUrl) => {
        if (!cancelled && currentImageIdRef.current === image.id) {
          setPreviewSrc(thumbnailUrl);
        }
      })
      .catch(() => {
        if (!cancelled && currentImageIdRef.current === image.id) {
          setPreviewSrc(fastSrc);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [image?.id, image?.imageUrl, image?.thumbUrl, imgWidth]);

  if (!image && !previewSrc) return null;

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
          width: `${size}px`,
          height: `${size}px`,
          transform: 'translate(-50%, -50%)',
          zIndex: 50,
          pointerEvents: 'none',
        }}
        className="relative overflow-hidden border border-[#e5e5e5]"
      >
        {previewSrc && !imgError ? (
          <img
            src={previewSrc}
            alt=""
            onError={() => setImgError(true)}
            className="w-full h-full object-cover"
            loading="eager"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-[#FAFAFA]">
            <span className="font-sans text-sm font-semibold leading-none tracking-normal text-gray-500">
              Loading
            </span>
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
};
