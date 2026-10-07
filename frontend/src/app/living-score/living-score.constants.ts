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
  [105.69, 20.93],
  [105.96, 21.21],
];
