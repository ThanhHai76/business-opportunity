import type {
  AmenityType,
  CriterionKey,
  HouseholdType,
  InfrastructureStatus,
  InterestKey,
} from './models/living-score.models';

export const CRITERION_ICONS: Record<CriterionKey, string> = {
  transportation: 'train',
  education: 'graduation',
  healthcare: 'health',
  greenSpace: 'tree',
  amenities: 'bag',
};

/** Icons for the criteria that have no data yet (shown greyed out as "chưa có dữ liệu"). */
export const MISSING_CRITERION_ICONS: Record<'safety' | 'environment' | 'cost', string> = {
  safety: 'shield',
  environment: 'leaf',
  cost: 'wallet',
};

/** Icons and colours; labels are in i18n/ls-i18n.ts. */
export const AMENITY_META: Record<AmenityType, { icon: string; color: string }> = {
  school: { icon: 'graduation', color: '#6366f1' },
  hospital: { icon: 'health', color: '#e5484d' },
  park: { icon: 'tree', color: '#1a8f5c' },
  shopping: { icon: 'bag', color: '#d9820b' },
};

export const AMENITY_TYPES: AmenityType[] = ['school', 'hospital', 'park', 'shopping'];

export const STATUS_META: Record<InfrastructureStatus, { color: string }> = {
  operating: { color: '#0f5ff2' },
  under_construction: { color: '#f59e0b' },
  planned: { color: '#8b95a7' },
};

export const HOUSEHOLD_OPTIONS: Array<{ value: HouseholdType }> = [
  { value: 'single' },
  { value: 'couple' },
  { value: 'family_with_kids' },
];

export const INTEREST_OPTIONS: Array<{ value: InterestKey }> = [
  { value: 'cafes' },
  { value: 'metro_access' },
  { value: 'international_schools' },
  { value: 'green_space' },
];

/** Colours used to tell up to three compared areas apart. */
export const COMPARE_COLORS = ['#0f5ff2', '#d9820b', '#1a8f5c'];

/** Approximate map view that frames all of the areas. */
export const HANOI_BOUNDS: [[number, number], [number, number]] = [
  [105.63, 20.86],
  [106.01, 21.26],
];

/**
 * Until 10/2026 the areas were thirteen cells around the former district centres; saved lists and old links use
 * those slugs. Each points to the 2025 ward that contains the old centre (as backend-node LEGACY_SLUGS).
 */
export const LEGACY_AREA_SLUGS: Record<string, string> = {
  'cau-giay': 'phuong-cau-giay',
  'tay-ho': 'phuong-tay-ho',
  'ba-dinh': 'phuong-ngoc-ha',
  'hoan-kiem': 'phuong-hoan-kiem',
  'dong-da': 'phuong-dong-da',
  'hai-ba-trung': 'phuong-bach-mai',
  'thanh-xuan': 'phuong-khuong-dinh',
  'hoang-mai': 'phuong-hoang-mai',
  'bac-tu-liem': 'phuong-dong-ngac',
  'nam-tu-liem': 'phuong-tu-liem',
  'long-bien': 'phuong-long-bien',
  'ha-dong': 'phuong-kien-hung',
  'dong-anh': 'xa-dong-anh',
};

/** Old slugs replaced by their ward, duplicates dropped, order kept. */
export function migrateAreaSlugs(slugs: readonly string[]): string[] {
  return [...new Set(slugs.map((s) => LEGACY_AREA_SLUGS[s] ?? s))];
}
