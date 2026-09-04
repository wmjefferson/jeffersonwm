import type { QualityLevel, TourbillionSettings } from './types';

export const DEFAULT_SETTINGS = {
  speed: 1.5,
  count: 1500,
  size: 3,
  trail: 0.3,
  multicolor: false,
  quality: 'medium' as QualityLevel,
  disableScreensaver: true,
};

export const INITIAL_SETTINGS: TourbillionSettings = {
  mode: 'starfield',
  speed: DEFAULT_SETTINGS.speed,
  count: DEFAULT_SETTINGS.count,
  size: DEFAULT_SETTINGS.size,
  trail: DEFAULT_SETTINGS.trail,
  multicolor: DEFAULT_SETTINGS.multicolor,
  quality: DEFAULT_SETTINGS.quality,
  disableScreensaver: DEFAULT_SETTINGS.disableScreensaver,
  trainSpeed: 1.5,
  trackPlacementInterval: 300,
  straightness: 0.5,
  resetTrigger: 'time',
  resetTimeMin: 30,
  resetTimeMax: 60,
  resetTilesLimit: 200,
};

export const TRAIN_QUALITY_PROFILES = {
  low: {
    minActiveTrains: 2,
    initialTrainCountMin: 2,
    initialTrainCountRange: 2,
    trackSeedSegments: 6,
    steamChance: 0.08,
    steamCap: 80,
    historyStep: 3,
    historyTailBuffer: 8,
  },
  medium: {
    minActiveTrains: 3,
    initialTrainCountMin: 2,
    initialTrainCountRange: 4,
    trackSeedSegments: 8,
    steamChance: 0.15,
    steamCap: 140,
    historyStep: 2,
    historyTailBuffer: 12,
  },
  high: {
    minActiveTrains: 4,
    initialTrainCountMin: 3,
    initialTrainCountRange: 4,
    trackSeedSegments: 10,
    steamChance: 0.22,
    steamCap: 220,
    historyStep: 2,
    historyTailBuffer: 18,
  },
} as const;

export type TrainQualityProfile = (typeof TRAIN_QUALITY_PROFILES)[QualityLevel];
