import { AnimatePresence, motion } from 'motion/react';
import { Maximize, Minimize, Settings } from 'lucide-react';

interface SettingsTriggerProps {
  hidden: boolean;
  isFullscreen: boolean;
  onOpen: () => void;
  onToggleFullscreen: () => void;
}

export function SettingsTrigger({ hidden, isFullscreen, onOpen, onToggleFullscreen }: SettingsTriggerProps) {
  return (
    <AnimatePresence>
      {!hidden && (
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 0.4, scale: 1 }}
          exit={{ opacity: 0, scale: 0.8 }}
          className="absolute top-6 right-6 z-50 flex items-center gap-3"
        >
          <motion.button
            whileHover={{ opacity: 1, scale: 1.1 }}
            onClick={onToggleFullscreen}
            className="p-2 text-white bg-white/5 rounded-full hover:bg-white/10 backdrop-blur-sm transition-colors border border-white/10"
            id="fullscreen-trigger"
          >
            {isFullscreen ? <Minimize size={20} /> : <Maximize size={20} />}
          </motion.button>
          <motion.button
            whileHover={{ opacity: 1, scale: 1.1 }}
            onClick={onOpen}
            className="p-2 text-white bg-white/5 rounded-full hover:bg-white/10 backdrop-blur-sm transition-colors border border-white/10"
            id="settings-trigger"
          >
            <Settings size={20} />
          </motion.button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
