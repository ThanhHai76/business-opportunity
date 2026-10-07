/** Types mirroring the Hanoi Future Map REST API (backend-node/src/future-map, mounted at /api/future-map). */

export type Lang = 'vi' | 'en';
export type YearKind = 'present' | 'plan' | 'vision';
/** Map objects: exists today, being built, or in an approved plan. */
export type Status = 'operating' | 'construction' | 'plan';

export interface Source {
  title: string;
  publisher: string;
  /** null for a source without a stable link (e.g. a TV report): shown by name only. */
  url: string | null;
}
export type SourceRef = Source & { id: string };

export interface ScenarioStats {
  /** Million people: a single figure (min = max) or a forecast range. */
  population: { min: number; max: number };
  /** Km of urban rail, quoted from the source (in service today, a target later). */
  railKm: number;
  poles: number;
  linesOperating: number;
  linesConstruction: number;
  linesPlanned: number;
  airports: number;
}

export interface StatNote {
  note: string;
  sources: string[];
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
  sources: Record<string, Source>;
  note: string;
}

export type HubTag = 'metro' | 'green' | 'airport' | 'logistics' | 'innovation' | 'heritage';

export interface HubProps {
  slug: string;
  name: string;
  area: string;
  role: string;
  center: [number, number];
  radiusKm: number;
  tags: HubTag[];
  status: Status;
  firstYear: number;
  isNew: boolean;
  sources: string[];
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
  axes: FC;
}

export interface Scenario {
  year: number;
  lang: Lang;
  label: string;
  kind: YearKind;
  headline: string;
  stats: ScenarioStats;
  statNotes: { population: StatNote; railKm: StatNote };
  layers: ScenarioLayers;
  sources: Record<string, Source>;
  note: string;
}

export interface HubDetail extends HubProps {
  year: number;
  presentInYear: boolean;
  lines: Array<{ name: string; status: Status; schematic: boolean; color: string }>;
  axes: Array<{ name: string; theme: string }>;
  /** Capital Region directions this pole faces. */
  corridors: Array<{ slug: string; theme: CorridorTheme; direction: string; province: string; label: string }>;
  sourceList: SourceRef[];
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
  delta: { railKm: number; poles: number; linesOperating: number; populationMin: number; populationMax: number };
  from: number;
  to: number;
  sourceList: SourceRef[];
  note: string;
}

export interface Question {
  id: string;
  text: string;
}

export interface Answer {
  question: string;
  year: number;
  answer: string;
  /** Pole slugs the answer talks about (the UI highlights them). */
  highlights: string[];
  sources: SourceRef[];
  /** 'rules' for preset questions; 'anthropic' or 'mock' for free-text ones. */
  source?: 'rules';
  provider?: string;
  outOfScope?: boolean;
}

/** The toggles of the "Map layers" panel. Several map layers can belong to one toggle. */
export type LayerKey = 'metro' | 'tod' | 'zones' | 'roads' | 'green' | 'water' | 'airports' | 'hubs' | 'axes';

// ---------------------------------------------------------------- Capital Region (GET /region)
export type CorridorTheme = 'industry' | 'logistics' | 'tourism' | 'health';
export type MapView = 'city' | 'region';

export interface CorridorSummary {
  slug: string;
  theme: CorridorTheme;
  themeLabel: string;
  direction: string;
  province: string;
  formerly: string;
  label: string;
  /** 'vtv24Region' when the role is quoted from the TV report, else the id of the source it comes from. */
  labelSource: string | null;
  destination: [number, number];
  nodes: Array<{ name: string; at: [number, number] }>;
  /** Free-flow driving time from central Hanoi (OSRM). */
  travel: { minutes: number; km: number } | null;
  poles: Array<{ slug: string; name: string }>;
  gateway: { living: string | null; business: string | null };
}

export interface RegionInfra {
  id: string;
  kind: 'expressway' | 'railway' | 'ring' | 'airport' | 'hospital';
  name: string;
  note: string | null;
  status: Status;
  openYear: number | null;
  schematic: boolean;
  sources: string[];
}

export interface RegionData {
  year: number;
  lang: Lang;
  origin: [number, number];
  themes: Record<CorridorTheme, string>;
  corridors: CorridorSummary[];
  layers: { provinces: FC; arrows: FC; arrowheads: FC; destinations: FC; nodes: FC; infraLines: FC; infraPoints: FC };
  sources: Record<string, Source>;
  note: string;
}

export interface CorridorDetail extends CorridorSummary {
  year: number;
  facts: Array<{ text: string; sources: string[] }>;
  infrastructure: RegionInfra[];
  sourceList: SourceRef[];
  note: string;
}
