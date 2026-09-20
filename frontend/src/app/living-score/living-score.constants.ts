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
  safety: 'shield',
  environment: 'leaf',
  cost: 'wallet',
};

export const AMENITY_META: Record<AmenityType, { label: string; plural: string; icon: string; color: string }> = {
  school: { label: 'Trường học', plural: 'Trường học', icon: 'graduation', color: '#6366f1' },
  hospital: { label: 'Cơ sở y tế', plural: 'Bệnh viện / y tế', icon: 'health', color: '#e5484d' },
  park: { label: 'Công viên', plural: 'Công viên', icon: 'tree', color: '#1a8f5c' },
  shopping: { label: 'Mua sắm', plural: 'Mua sắm', icon: 'bag', color: '#d9820b' },
};

export const AMENITY_TYPES: AmenityType[] = ['school', 'hospital', 'park', 'shopping'];

export const STATUS_META: Record<InfrastructureStatus, { label: string; color: string }> = {
  operating: { label: 'Đang vận hành', color: '#0f5ff2' },
  under_construction: { label: 'Đang xây dựng', color: '#f59e0b' },
  planned: { label: 'Dự kiến', color: '#8b95a7' },
};

export const HOUSEHOLD_OPTIONS: Array<{ value: HouseholdType; label: string }> = [
  { value: 'single', label: 'Độc thân' },
  { value: 'couple', label: 'Cặp đôi' },
  { value: 'family_with_kids', label: 'Gia đình có con nhỏ' },
];

export const INTEREST_OPTIONS: Array<{ value: InterestKey; label: string }> = [
  { value: 'cafes', label: 'Nhiều quán cà phê' },
  { value: 'metro_access', label: 'Dễ tiếp cận metro' },
  { value: 'international_schools', label: 'Gần trường quốc tế' },
  { value: 'high_safety', label: 'Khu vực an ninh cao' },
  { value: 'green_space', label: 'Nhiều cây xanh' },
  { value: 'quiet_environment', label: 'Yên tĩnh, trong lành' },
];

/** Colours used to tell up to three compared areas apart. */
export const COMPARE_COLORS = ['#0f5ff2', '#d9820b', '#1a8f5c'];

/** Approximate map view that frames all of the sample areas. */
export const HANOI_BOUNDS: [[number, number], [number, number]] = [
  [105.69, 20.93],
  [105.96, 21.21],
];
