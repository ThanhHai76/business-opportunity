/** Types mirroring the Hanoi Future Map REST API (backend-node/src/future-map, mounted at /api/future-map). */

export type YearKind = 'present' | 'plan' | 'scenario' | 'vision';

export interface ScenarioStats {
  metroLines: number;
  metroKm: number;
  hubs: number;
  airports: number;
  /** Scenario assumptions, not statistics. */
  greenPct: number;
  /** Million people (scenario assumption). */
  population: number;
}

export interface TimelineYear {
  year: number;
  label: string;
  kind: YearKind;
  headline: string;
  stats: ScenarioStats;
}

export interface Timeline {
  years: TimelineYear[];
  center: [number, number];
  scenario: true;
  note: string;
}

export interface HubScores {
  development: number;
  tod: number;
  green: number;
  connectivity: number;
}

export interface HubFacts {
  metroLines: number;
  metroLineNames: string[];
  newUrbanArea: boolean;
  airportConnection: boolean;
  commercialLogistics: boolean;
}

export type HubTag = 'metro' | 'tod' | 'development' | 'green' | 'airport' | 'logistics' | 'innovation' | 'heritage';

export interface HubProps {
  slug: string;
  name: string;
  role: string;
  center: [number, number];
  radiusKm: number;
  tags: HubTag[];
  firstYear: number;
  scores: HubScores;
  facts: HubFacts;
  isNew: boolean;
  blurb: string;
}

export type FC = GeoJSON.FeatureCollection;

export interface ScenarioLayers {
  metroLines: FC;
  metroStations: FC;
  roads: FC;
  green: FC;
  water: FC;
  airports: FC;
  hubs: FC;
  zones: FC;
  tod: FC;
  boundaries: FC;
  axes: FC;
}

export interface Scenario {
  year: number;
  label: string;
  kind: YearKind;
  headline: string;
  stats: ScenarioStats;
  layers: ScenarioLayers;
  scenario: true;
  note: string;
}

export interface HubYearScores {
  year: number;
  scores: HubScores;
  metroLines: number;
}

export interface HubDetail {
  slug: string;
  name: string;
  role: string;
  center: [number, number];
  blurb: string;
  firstYear: number;
  year: number;
  presentInYear: boolean;
  scores?: HubScores;
  facts?: HubFacts;
  tags?: HubTag[];
  byYear: HubYearScores[];
  note: string;
}

export interface CompareColumn {
  year: number;
  label: string;
  kind: YearKind;
  stats: ScenarioStats;
}

export interface CompareResult {
  years: CompareColumn[];
  delta: ScenarioStats;
  from: number;
  to: number;
  note: string;
}

export interface Question {
  id: string;
  text: string;
}

export interface Answer {
  id: string;
  question: string;
  year: number;
  answer: string;
  /** Hub slugs the answer talks about (the UI highlights them). */
  highlights: string[];
  source: 'rules';
  note: string;
}

/** The toggles of the "Map layers" panel. Several map layers can belong to one toggle. */
export type LayerKey = 'metro' | 'tod' | 'zones' | 'roads' | 'green' | 'water' | 'airports' | 'hubs' | 'axes' | 'boundaries';
