/** Types mirroring the Hanoi Living Score REST API (backend-node/src/living-score, mounted at /api/living-score). */

export const CRITERION_KEYS = [
  'transportation',
  'education',
  'healthcare',
  'greenSpace',
  'amenities',
  'safety',
  'environment',
  'cost',
] as const;
export type CriterionKey = (typeof CRITERION_KEYS)[number];
export type CriterionMap = Record<CriterionKey, number>;
export type PartialWeights = Partial<CriterionMap>;

export type BandKey = 'excellent' | 'good' | 'fair' | 'low';
export type ScoreVisual = 'livingScore' | CriterionKey;

export interface CriterionDefinition {
  key: CriterionKey;
  label: string;
  labelEn: string;
  description: string;
  defaultWeight: number;
}

export interface ScoreBand {
  key: BandKey;
  min: number;
  label: string;
}

export interface CriteriaResponse {
  criteria: CriterionDefinition[];
  bands: ScoreBand[];
}

export interface LngLat {
  lng: number;
  lat: number;
}

export interface AreaSummary {
  slug: string;
  name: string;
  nameEn: string;
  livingScore: number;
  band: BandKey;
  scores: CriterionMap;
  avgRentVnd: number;
  population: number;
  centroid: LngLat;
  dataSource: string;
}

export interface AreaList {
  data: AreaSummary[];
  meta: { total: number; isPersonalized: boolean; sampleData: true };
}

export interface ScoreContribution {
  criterion: CriterionKey;
  score: number;
  weightPct: number;
  points: number;
}

export type AmenityType = 'school' | 'hospital' | 'park' | 'shopping';

export interface AmenityHighlight {
  name: string;
  rating: number;
  lng: number;
  lat: number;
}

export interface AmenityGroup {
  type: AmenityType;
  count: number;
  top: AmenityHighlight[];
}

export interface AreaDetail extends AreaSummary {
  description: string;
  areaKm2: number;
  populationDensity: number;
  avgPricePerM2Vnd: number;
  defaultLivingScore: number;
  isPersonalized: boolean;
  weights: CriterionMap;
  breakdown: ScoreContribution[];
  pros: string[];
  cons: string[];
  amenities: AmenityGroup[];
}

export interface GeoFeature<G, P> {
  type: 'Feature';
  id?: number;
  geometry: G;
  properties: P;
}

export interface GeoCollection<G, P> {
  type: 'FeatureCollection';
  features: Array<GeoFeature<G, P>>;
}

export interface AreaFeatureProperties {
  slug: string;
  name: string;
  value: number;
  band: BandKey;
  visual: ScoreVisual;
  livingScore: number;
  avgRentVnd: number;
  lng: number;
  lat: number;
}

export type AreaGeoJson = GeoCollection<{ type: 'Polygon'; coordinates: number[][][] }, AreaFeatureProperties> & {
  meta: { isPersonalized: boolean; visual: ScoreVisual; sampleData: true; boundaryNote: string };
};

export interface AmenityFeatureProperties {
  name: string;
  type: AmenityType;
  rating: number;
  areaSlug: string;
}

export type AmenityGeoJson = GeoCollection<{ type: 'Point'; coordinates: [number, number] }, AmenityFeatureProperties> & {
  meta: { total: number; sampleData: true };
};

export type InfrastructureStatus = 'operating' | 'under_construction' | 'planned';

export interface InfrastructureFeatureProperties {
  name: string;
  kind: 'metro_line' | 'metro_station';
  status: InfrastructureStatus;
}

export type InfrastructureGeoJson = GeoCollection<
  { type: 'LineString'; coordinates: number[][] } | { type: 'Point'; coordinates: [number, number] },
  InfrastructureFeatureProperties
> & { meta: { sampleData: true; note: string } };

export interface CriterionComparison {
  criterion: CriterionKey;
  values: Record<string, number>;
  best: string[];
}

export interface CompareResult {
  areas: AreaSummary[];
  criteria: CriterionComparison[];
  bestOverall: string;
  meta: { isPersonalized: boolean; sampleData: true };
}

export interface PlaceHit {
  name: string;
  type: AmenityType;
  areaSlug: string;
  lng: number;
  lat: number;
}

export interface SearchResult {
  query: string;
  areas: AreaSummary[];
  places: PlaceHit[];
}

export type HouseholdType = 'single' | 'couple' | 'family_with_kids';
export type InterestKey =
  | 'cafes'
  | 'metro_access'
  | 'international_schools'
  | 'high_safety'
  | 'green_space'
  | 'quiet_environment';

export interface RecommendationRequest {
  budgetVnd: number;
  workplaceAreaSlug?: string;
  household: HouseholdType;
  interests: InterestKey[];
  priorities: PartialWeights;
  useAi: boolean;
}

export interface RecommendationItem {
  rank: number;
  area: AreaSummary;
  matchScore: number;
  personalizedScore: number;
  budget: { rentVnd: number; budgetVnd: number; withinBudget: boolean; deltaPct: number };
  commute: { workplaceName: string; km: number } | null;
  breakdown: ScoreContribution[];
  summary: string;
  reasons: string[];
  pros: string[];
  cons: string[];
}

export interface RecommendationResponse {
  mode: 'ai' | 'rules';
  model?: string;
  notice?: string;
  sampleData: true;
  weights: CriterionMap;
  results: RecommendationItem[];
}

export interface ApiError {
  statusCode: number;
  error: string;
  message: string | string[];
}
