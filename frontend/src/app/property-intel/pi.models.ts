/**
 * Response shapes of /api/property-intel (backend-node/src/property-intel). Every figure is cited: OpenStreetMap,
 * approved plans, the 2026 land price table, CBRE / Savills briefings and the press.
 */

export type LngLat = [number, number];
export type Lang = 'vi' | 'en';
export type Tone = 'planning' | 'mobility' | 'growth' | 'risk';
export type Horizon = 2026 | 2030 | 2045;
export type AskIntent = 'analyze' | 'compare' | 'price' | 'future' | 'report' | 'project';

export interface Source {
  id: string;
  title: string;
  publisher: string;
  url: string | null;
}

export interface Criterion {
  key: 'connectivity' | 'infrastructure' | 'planning' | 'amenities' | 'population' | 'development';
  code: string;
  label: string;
  tone: Tone;
  weight: number;
  value: number | null;
  detail: string;
}

export interface InfraItem {
  id: string;
  kind: 'metro' | 'bridge' | 'ring';
  name: string;
  note: string | null;
  status: 'operating' | 'construction' | 'plan';
  statusAt: 'operating' | 'expected' | 'construction' | 'plan';
  openYear: number | null;
  schematic: boolean;
  distanceKm: number | null;
  sources: Source[];
}

export interface Overview {
  note: string;
  dataUpdated: string | null;
  horizons: Horizon[];
  stats: { wards: number; infra: number; poles: number; projects: number; horizon: number };
  featured: {
    slug: string;
    name: string;
    score: number;
    rank: number;
    center: LngLat;
    criteria: Criterion[];
    topInfra: InfraItem | null;
    landPrice: LandPrice | null;
  };
  market: { quarter: string; primary: number };
  defaultQuestion: string;
  method: string;
}

/** Official land price of a ward (2026 table, residential street-front VT1, million VND/m²). */
export interface LandPrice {
  zone: number;
  medianVT1: number;
  maxVT1: number;
  streets: number;
  top: { name: string; vt1: number }[];
  zoneOnly: boolean;
  rank: number;
  ranked: number;
  cityMedian: number;
  unit: string;
}

export interface Quarter {
  quarter: string;
  primary: number;
  primaryHanoi?: number;
  secondary?: number;
  secondaryChangeQoQ?: number;
  launched: number;
  launchedDerived?: boolean;
  sold: number;
  absorptionPct?: number;
  source: Source;
}

/** City-wide apartment market as published (CBRE quarters, Savills). */
export interface CityMarket {
  quarters: Quarter[];
  savills: { quarter: string; primary: number; qoqPct: number; yoyPct: number; note: string; source: Source };
  latest: number;
}

export interface WardSummary {
  slug: string;
  name: string;
  shortName: string;
  center: LngLat;
  score: number;
  rank: number;
  total: number;
  partial: boolean;
  population: number | null;
  density: number | null;
  metro: { name: string; line: string; distanceM: number };
}

export interface ProjectSummary {
  slug: string;
  name: string;
  street: string;
  ward: { slug: string; name: string } | null;
  coords: LngLat;
  approx: boolean;
  price: { min: number; max: number | null; label: string; kind: 'offer' | 'expected' | 'listing'; kindLabel: string };
  sourceId: string;
  distanceM?: number;
  inWard?: boolean;
}

export interface WardDetail extends WardSummary {
  areaKm2: number;
  populationDate: string | null;
  criteria: Criterion[];
  facts: {
    stationsInside: string[];
    nearestStation: { name: string; line: string; distanceM: number };
    buildingStation: { name: string; line: string; distanceM: number; openYear: number } | null;
    counts: { education: number; health: number; shopping: number; bus: number; parks: number; parkHa: number };
    constructionHa: number;
    apartments: number;
    offices: number;
  };
  infra: InfraItem[];
  poles: { slug: string; name: string; role: string; inside: boolean; distanceKm: number }[];
  landPrice: LandPrice | null;
  market: CityMarket;
  projects: ProjectSummary[];
  links: {
    opportunity: string;
    livingScore: { slug: string; name: string } | null;
    futureMap: { hub: string; name: string } | null;
    copilot: { slug: string; name: string } | null;
  };
  method: string;
  caveat: string;
  sources: Source[];
}

export interface Poi {
  kind: 'school' | 'hospital' | 'mall' | 'park';
  name: string;
  coords: LngLat;
  distanceM: number;
  ha?: number;
}

export interface ProjectDetail extends ProjectSummary {
  osm: string | null;
  note: string | null;
  /** A 70 m² unit at the published price (billion VND): plain multiplication. */
  unit: { m2: number; min: number; max: number | null };
  vsMarket: { pct: number; market: number; quarter: string };
  landPrice: LandPrice | null;
  station: { name: string; line: string; coords: LngLat; distanceM: number };
  todRadiusM: number;
  proximity: { key: string; label: string; detail: string; distanceM: number; tone?: Tone }[];
  pois: Poi[];
  plannedInfra: InfraItem[];
  nearby: ProjectSummary[];
  market: CityMarket;
  sources: Source[];
}

export interface AskAnswer {
  question: string;
  intent: AskIntent;
  provider: 'template' | 'anthropic';
  model: string | null;
  outOfScope: boolean;
  ward: { slug: string; name: string };
  wards: { slug: string; name: string }[];
  project: { slug: string; name: string } | null;
  outlook: { label: string; tone: 'good' | 'neutral' | 'bad' };
  summary: string;
  rows: { label: string; tone: Tone; text: string }[];
  table?: { columns: string[]; rows: string[][]; highlight: number };
  callout?: { title: string; text: string };
  sources: Source[];
  followUps: AskIntent[];
}

export interface SearchResult {
  type: 'ward' | 'project';
  slug: string;
  name: string;
  detail: string;
}

type FC = import('geojson').FeatureCollection;
export interface MapLayers {
  horizon: Horizon;
  lang: Lang;
  layers: {
    wards: FC;
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

/** Toggleable map layers, in the order of the layer panel. */
export type LayerKey =
  | 'planning'
  | 'development'
  | 'metro'
  | 'tod'
  | 'infrastructure'
  | 'projects'
  | 'social'
  | 'density'
  | 'green';

export type Basemap = 'map' | 'satellite';
export type Lens = 'potential' | 'connectivity' | 'infrastructure' | 'landPrice';
