import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { HoverState } from '../types';
import { BACKGROUND_PLACEHOLDER_URL, getBrowserThumbnailUrl } from '../utils/imageDatabase';

interface HoverPreviewCardProps {
  hover: HoverState | null;
}

export const HoverPreviewCard: React.FC<HoverPreviewCardProps> = ({ hover }) => {
  const [imgError, setImgError] = useState(false);
  const [placeholderError, setPlaceholderError] = useState(false);
  const [previewSrc, setPreviewSrc] = useState<string>('');
  const [settledImage, setSettledImage] = useState<HoverState['image'] | null>(null);
  const image = settledImage;

  const imgWidth = 640;

  useEffect(() => {
    if (!hover?.image) {
      return;
    }

    const timeout = window.setTimeout(() => {
      setSettledImage(hover.image);
    }, 250);

    return () => window.clearTimeout(timeout);
  }, [hover?.image]);

  useEffect(() => {
    if (!image) {
      setImgError(false);
      setPlaceholderError(false);
      setPreviewSrc('');
      return;
    }

    let cancelled = false;
    setImgError(false);
    setPlaceholderError(false);
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

  if (!image) return null;

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
          <>
            {!placeholderError ? (
              <img
                src={BACKGROUND_PLACEHOLDER_URL}
                alt=""
                onError={() => setPlaceholderError(true)}
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
          </>
        )}
      </motion.div>
    </AnimatePresence>
  );
};
