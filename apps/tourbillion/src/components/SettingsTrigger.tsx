import { AnimatePresence, motion } from 'motion/react';
import { Settings } from 'lucide-react';

interface SettingsTriggerProps {
  hidden: boolean;
  onOpen: () => void;
}

export function SettingsTrigger({ hidden, onOpen }: SettingsTriggerProps) {
  return (
    <AnimatePresence>
      {!hidden && (
        <motion.button
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 0.4, scale: 1 }}
          exit={{ opacity: 0, scale: 0.8 }}
          whileHover={{ opacity: 1, scale: 1.1 }}
          onClick={onOpen}
          className="absolute top-6 right-6 z-50 p-2 text-white bg-white/5 rounded-full hover:bg-white/10 backdrop-blur-sm transition-colors border border-white/10"
          id="settings-trigger"
        >
          <Settings size={20} />
        </motion.button>
      )}
    </AnimatePresence>
  );
}
