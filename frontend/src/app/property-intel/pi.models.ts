/** Response shapes of /api/property-intel (backend-node/src/property-intel). All values are SAMPLE DATA. */

export type LngLat = [number, number];
export type Tone = 'planning' | 'mobility' | 'growth' | 'risk';
export type Horizon = 2026 | 2030 | 2045;
export type Currency = 'VND' | 'USD';
export type AskIntent = 'analyze' | 'compare' | 'price' | 'future' | 'report' | 'project';

export interface Criterion {
  key: string;
  code: string;
  label: string;
  tone: Tone;
  value: number;
}

export interface Overview {
  sampleData: true;
  note: string;
  dataUpdated: string;
  vndPerUsd: number;
  horizons: Horizon[];
  stats: { districts: number; projects: number; horizon: number };
  featured: {
    slug: string;
    name: string;
    growthScore: number;
    center: LngLat;
    criteria: Criterion[];
    topUplift: InfraImpact;
  };
  defaultQuestion: string;
}

export interface DistrictSummary {
  slug: string;
  name: string;
  center: LngLat;
  growthScore: number;
  rank: number;
  pricePerM2: number;
  yoy: number;
  risk: number;
  absorption: number;
}

export interface InfraImpact {
  name: string;
  kind: 'metro' | 'road';
  uplift: number;
  planned?: boolean;
}

export interface TimelineItem {
  name: string;
  kind: 'metro' | 'road' | 'urban';
  start: number;
  end: number;
  planned?: boolean;
}

export interface ProjectSummary {
  slug: string;
  name: string;
  tower: string;
  district: string;
  districtName: string;
  coords: LngLat;
  pricePerM2: number;
  soldPct: number;
  handover: string;
  distanceM?: number;
}

export interface DistrictDetail extends DistrictSummary {
  tagline: string;
  areaKm2: number;
  total: number;
  scoreDelta: number;
  aiConfidence: number;
  criteria: Criterion[];
  metrics: {
    pricePerM2: number;
    yoy: number;
    absorption: number;
    absorptionDeltaQoQ: number;
    pipelineUnits: number;
    pipelineProjects: number;
    rentalYield: number;
    cityRentalYield: number;
    cityAbsorption: number;
  };
  priceTrend: { years: number[]; district: number[]; city: number[]; change6y: number };
  infraImpacts: InfraImpact[];
  supplyDemand: { label: string; supply: number; demand: number; forecast?: boolean }[];
  population: { points: { label: string; value: number; forecast?: boolean }[]; now: number; cagr: number };
  timeline: { from: number; to: number; now: number; items: TimelineItem[] };
  projects: ProjectSummary[];
}

export interface Poi {
  kind: 'school' | 'hospital' | 'mall' | 'park';
  name: string;
  coords: LngLat;
}

export interface ProjectDetail extends ProjectSummary {
  ward: string;
  floors: number;
  units: number;
  typical: { beds: number; m2: number };
  estimate: { value: number; plusMinus: number; m2: number };
  vsDistrict: number;
  districtPricePerM2: number;
  history: { points: { label: string; value: number }[]; milestone: { quarter: number; label: string } };
  devScore: number;
  devNote: string;
  riskScore: number;
  riskNote: string;
  station: { name: string; line: string; coords: LngLat; distanceM: number };
  todRadiusM: number;
  proximity: { key: string; label: string; detail: string; distanceM: number; tone?: Tone }[];
  pois: Poi[];
  plannedInfra: { name: string; kind: 'metro' | 'road'; year: number }[];
  nearby: ProjectSummary[];
  aiTake: string;
  baseScenario: Scenario;
}

export interface Scenario {
  key?: 'bear' | 'base' | 'bull';
  label?: string;
  probability: number;
  change: number;
  note: string;
}

export interface AskAnswer {
  question: string;
  intent: AskIntent;
  engine: 'rule-based';
  sampleData: true;
  district: { slug: string; name: string };
  project: { slug: string; name: string } | null;
  outlook: { label: string; tone: 'good' | 'neutral' | 'bad' };
  summary: string;
  rows: { label: string; tone: Tone; text: string }[];
  scenarios?: Scenario[];
  table?: { columns: string[]; rows: string[][]; highlight: number };
  callout?: { title: string; text: string };
  followUps: string[];
}

export interface SearchResult {
  type: 'district' | 'project';
  slug: string;
  name: string;
  detail: string;
}

type FC = GeoJSON.FeatureCollection;
export interface MapLayers {
  horizon: Horizon;
  sampleData: true;
  layers: {
    districts: FC;
    labels: FC;
    metro: FC;
    stations: FC;
    tod: FC;
    infrastructure: FC;
    planning: FC;
    projects: FC;
    social: FC;
    green: FC;
  };
}

/** Toggleable map layers, in the order of the design's layer panel. */
export type LayerKey =
  | 'planning'
  | 'development'
  | 'metro'
  | 'tod'
  | 'infrastructure'
  | 'projects'
  | 'heatmap'
  | 'social'
  | 'density'
  | 'green';

export type Basemap = 'satellite' | 'dark' | 'terrain';
export type Lens = 'growth' | 'price' | 'risk';
