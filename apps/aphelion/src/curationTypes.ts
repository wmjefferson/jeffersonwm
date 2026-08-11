export const RARITY_OPTIONS = ['common', 'uncommon', 'rare', 'epic', 'legendary'] as const;

export type CardRarity = (typeof RARITY_OPTIONS)[number];
export type ReviewStatus = 'untagged' | 'reviewed';

export interface ControlledLibraryItem {
  id: number;
  slug: string;
  label: string;
}

export interface CardMetadataRecord {
  id: number;
  cardUid: string | null;
  imagePath: string;
  imageCode: string;
  folderPath: string;
  title: string;
  description: string;
  rarity: CardRarity | null;
  seriesName: string;
  editionSize: number | null;
  reviewStatus: ReviewStatus;
  attributes: string[];
  updatedAt: string | null;
}

export interface CardCatalogItem extends CardMetadataRecord {
  id: number;
  sourceTitle: string;
  sourceTags: string[];
  imageUrl: string;
  thumbUrl: string;
}

export interface CatalogStats {
  total: number;
  reviewed: number;
  untagged: number;
  withRarity: number;
  withSeries: number;
  withAttributes: number;
  rarityCounts: Record<string, number>;
}

export interface AdminCatalogPayload {
  ok: true;
  cards: CardCatalogItem[];
  attributes: ControlledLibraryItem[];
  series: ControlledLibraryItem[];
  stats: CatalogStats;
}

export interface SaveCardPayload {
  imagePath: string;
  imageCode: string;
  folderPath: string;
  title?: string;
  description?: string;
  rarity?: CardRarity | null;
  seriesName?: string;
  editionSize?: number | null;
  reviewStatus?: ReviewStatus;
  attributes?: string[];
}
