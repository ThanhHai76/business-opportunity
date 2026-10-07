/** Types mirroring the Business Opportunity Map API (backend-node/src/opportunity, mounted at /api/opportunity). */

export type Lang = 'vi' | 'en';
export type Horizon = 'now' | '2030';
export type Signal = 'population' | 'offices' | 'apartments' | 'schools' | 'metro';

export interface SourceRef {
  id: string;
  title: string;
  publisher: string;
  url: string;
}

export interface BusinessType {
  key: string;
  icon: string;
  name: string;
  description: string;
  weights: Partial<Record<Signal, number>>;
  /** Places of this type OpenStreetMap shows across the map. */
  mappedTotal: number;
  /** Too few mapped places to judge competition. */
  sparse: boolean;
}

export interface TypesResponse {
  types: BusinessType[];
  signals: Record<Signal | 'growth', string>;
  sparseBelow: number;
}

export interface WardProps {
  slug: string;
  name: string;
  population: number | null;
  scored: boolean;
  score: number | null;
  rank: number | null;
  topType: string | null;
  topIcon?: string;
  topName?: string;
  confidence: 'ok' | 'low' | null;
  count?: number;
  lng: number;
  lat: number;
}

export interface WardsResponse extends GeoJSON.FeatureCollection {
  meta: { type: BusinessType | null; horizon: Horizon; scoredWards: number; method: string; caveat: string; osmDate: string; sources: SourceRef[] };
}

export interface Driver {
  signal: Signal;
  label: string;
  weight: number;
  /** 0-100, relative between wards. */
  value: number;
  /** weight × value: this signal's share of demand. */
  points: number;
}

export interface Opportunity {
  type: string;
  icon: string;
  name: string;
  opportunity: number;
  demand: number;
  competition: number;
  count: number;
  per10k: number;
  confidence: 'ok' | 'low';
  sparseType: boolean;
  growth: number | null;
  drivers: Driver[];
}

export interface WardFacts {
  population: number | null;
  populationDate: string | null;
  areaKm2: number;
  counts: Record<string, number>;
  metroStations: string[];
  metroBuildingKm: number | null;
  constructionHa: number;
}

export interface WardDetail {
  slug: string;
  name: string;
  osm: string;
  centroid: [number, number];
  horizon: Horizon;
  scored: boolean;
  facts: WardFacts;
  coverage: { ratio: number; low: boolean; perTenThousand: number } | null;
  growth: number | null;
  opportunities: Opportunity[];
  copilot: { slug: string; name: string } | null;
  method: string;
  caveat: string;
  sources: SourceRef[];
}

export interface CompareWard {
  slug: string;
  name: string;
  scored: boolean;
  facts: WardFacts;
  coverage: WardDetail['coverage'];
  focus: Opportunity | null;
  top3: Array<{ type: string; icon: string; name: string; opportunity: number }>;
}

export interface CompareResponse {
  horizon: Horizon;
  type: BusinessType | null;
  wards: CompareWard[];
  sources: SourceRef[];
}

export interface AskAnswer {
  question: string;
  horizon: Horizon;
  answer: string;
  wards: Array<{ slug: string; name: string }>;
  types: string[];
  sources: SourceRef[];
  outOfScope: boolean;
  provider: string;
  model: string | null;
}
