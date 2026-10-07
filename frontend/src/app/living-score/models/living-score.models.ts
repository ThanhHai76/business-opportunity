/** Types mirroring the Hanoi Living Score REST API (backend-node/src/living-score, mounted at /api/living-score). */

export const CRITERION_KEYS = [
  'transportation',
  'education',
  'healthcare',
  'greenSpace',
  'amenities',
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
  descriptionEn: string;
  defaultWeight: number;
}

export interface ScoreBand {
  key: BandKey;
  min: number;
  label: string;
  labelEn: string;
}

/** A criterion people ask about that has no open per-area data yet: shown as "no data", never scored. */
export interface MissingCriterion {
  key: 'safety' | 'environment' | 'cost';
  label: string;
  labelEn: string;
  reason: string;
  reasonEn?: string;
}

/** Where the Living Score numbers come from (an OpenStreetMap snapshot). */
export interface DataInfo {
  source: string;
  license: string;
  licenseUrl: string;
  osmDate: string | null;
  walkKm: number;
  areaCount: number;
  method: string;
  caveat: string;
  areaNote: string;
}

export interface CriteriaResponse {
  criteria: CriterionDefinition[];
  missing: MissingCriterion[];
  bands: ScoreBand[];
  data: DataInfo;
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
  facts: AreaFacts;
  centroid: LngLat;
  dataSource: string;
}

/** Raw OpenStreetMap counts within the walking radius of the area's centre. */
export interface AreaFacts {
  metroStations: string[];
  internationalSchools: number;
  cafes: number;
  parkPct: number;
  waterPct: number;
  lakes: string[];
  busStops: number;
  /** New (2025) wards the 1.5 km circle falls in, with their share of it. */
  wards: Array<{ name: string; pct: number }>;
}

/** What one score was computed from, in words. */
export interface AreaMetric {
  criterion: CriterionKey;
  text: string;
}

export interface AreaList {
  data: AreaSummary[];
  meta: { total: number; isPersonalized: boolean; data: DataInfo };
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
  metrics: AreaMetric[];
  missingCriteria: MissingCriterion[];
  dataInfo: DataInfo;
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
  lng: number;
  lat: number;
}

export type AreaGeoJson = GeoCollection<{ type: 'Polygon'; coordinates: number[][][] }, AreaFeatureProperties> & {
  meta: { isPersonalized: boolean; visual: ScoreVisual; data: DataInfo; boundaryNote: string };
};

export interface AmenityFeatureProperties {
  name: string;
  type: AmenityType;
  areaSlug: string;
}

export type AmenityGeoJson = GeoCollection<{ type: 'Point'; coordinates: [number, number] }, AmenityFeatureProperties> & {
  meta: { total: number; source: string };
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
> & { meta: { note: string; noteEn: string; source: string } };

export interface CriterionComparison {
  criterion: CriterionKey;
  values: Record<string, number>;
  best: string[];
}

export interface CompareResult {
  areas: AreaSummary[];
  criteria: CriterionComparison[];
  bestOverall: string;
  meta: { isPersonalized: boolean; data: DataInfo };
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
export type InterestKey = 'cafes' | 'metro_access' | 'international_schools' | 'green_space';

export interface RecommendationRequest {
  lang?: 'vi' | 'en';
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
  metrics: AreaMetric[];
  /** `road`: OSRM free-flow driving time; `straight`: straight-line distance only. */
  commute: { workplaceName: string; km: number; minutes: number | null; mode: 'road' | 'straight' } | null;
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
  weights: CriterionMap;
  method: string;
  areaNote: string;
  /** Attached by the server, never written by the model. */
  sources: Array<{ title: string; publisher: string; license: string; url: string }>;
  results: RecommendationItem[];
}

export interface ApiError {
  statusCode: number;
  error: string;
  message: string | string[];
}
