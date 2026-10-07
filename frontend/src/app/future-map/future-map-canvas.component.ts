import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  NgZone,
  OnDestroy,
  ViewChild,
  ViewEncapsulation,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import * as maplibregl from 'maplibre-gl';
import { CorridorSummary, CorridorTheme, FC, HubProps, LayerKey, MapView, RegionData, Scenario } from './future-map.models';

/**
 * OpenFreeMap vector base maps (OpenStreetMap data, no API key; attribution comes with the tiles).
 * tile.openstreetmap.org refused connections from our test network, so the raster OSM base was replaced.
 */
const BASE_STYLE_URL: Record<'light' | 'dark', string> = {
  light: 'https://tiles.openfreemap.org/styles/positron',
  dark: 'https://tiles.openfreemap.org/styles/dark',
};
/** The whole capital region, used as the "overview" camera. */
const OVERVIEW_BOUNDS: maplibregl.LngLatBoundsLike = [
  [105.4, 20.66],
  [106.08, 21.36],
];
/** The Capital Region: Hanoi and the six neighbouring provinces it links to. */
const REGION_BOUNDS: maplibregl.LngLatBoundsLike = [
  [105.0, 20.0],
  [107.1, 21.85],
];
const EMPTY: FC = { type: 'FeatureCollection', features: [] };

/** Colours of the corridor themes (arrows, labels, legend). */
export const THEME_COLORS: Record<'light' | 'dark', Record<CorridorTheme, string>> = {
  dark: { industry: '#60a5fa', logistics: '#a78bfa', tourism: '#34d399', health: '#2dd4bf' },
  light: { industry: '#2563eb', logistics: '#7c3aed', tourism: '#16a34a', health: '#0d9488' },
};
const REGION_SOURCES: Record<string, keyof RegionData['layers']> = {
  'fm-reg-provinces': 'provinces',
  'fm-reg-arrows': 'arrows',
  'fm-reg-heads': 'arrowheads',
  'fm-reg-infra': 'infraLines',
  'fm-reg-nodes': 'nodes',
};
const REGION_LAYERS = ['reg-prov-fill', 'reg-prov-line', 'reg-prov-selected', 'reg-hanoi-glow', 'reg-hanoi-line', 'reg-infra-exp', 'reg-infra-ring', 'reg-infra-rail', 'reg-infra-rail-plan', 'reg-arrow-glow', 'reg-arrow', 'reg-arrow-selected', 'reg-heads', 'reg-nodes'];
/** Province layers drawn under the base map's water (see composeStyle). */
const PROVINCE_LAYERS = new Set(['reg-prov-fill', 'reg-prov-line', 'reg-prov-selected']);
const ICON_CROSS =
  '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>';

interface Palette {
  background: string;
  green: string;
  greenFill: number;
  water: string;
  boundary: string;
  zone: string;
  tod: string;
  axes: string;
  ring: string;
  expressway: string;
  selected: string;
  station: string;
  glow: number;
}

const PALETTE: Record<'light' | 'dark', Palette> = {
  dark: {
    background: '#070d1a',
    green: '#34d399',
    greenFill: 0.2,
    water: '#38bdf8',
    boundary: '#cbd5e1',
    zone: '#ff9f1c',
    tod: '#b56cff',
    axes: '#93c5fd',
    ring: '#facc15',
    expressway: '#fb7185',
    selected: '#ffffff',
    station: '#ffffff',
    glow: 0.42,
  },
  light: {
    background: '#e7edf3',
    green: '#16a34a',
    greenFill: 0.22,
    water: '#0284c7',
    boundary: '#475569',
    zone: '#ea7a00',
    tod: '#7c3aed',
    axes: '#2563eb',
    ring: '#b45309',
    expressway: '#e11d48',
    selected: '#0f172a',
    station: '#0f172a',
    glow: 0.16,
  },
};

const SOURCES: Record<string, keyof Scenario['layers']> = {
  'fm-green': 'green',
  'fm-water': 'water',
  'fm-zones': 'zones',
  'fm-tod': 'tod',
  'fm-axes': 'axes',
  'fm-roads': 'roads',
  'fm-metro': 'metroLines',
  'fm-stations': 'metroStations',
};

/** Map layers owned by each toggle of the "Map layers" panel. Bottom-most first. */
const GROUPS: Partial<Record<LayerKey, string[]>> = {
  green: ['green-fill', 'green-line'],
  water: ['water-lake', 'water-river-glow', 'water-river'],
  zones: ['zones-fill', 'zones-line', 'zones-3d', 'zones-selected'],
  tod: ['tod-fill', 'tod-line', 'tod-3d'],
  axes: ['axes-line'],
  roads: ['roads-ring', 'roads-ring-construction', 'roads-glow', 'roads-line'],
  metro: ['metro-glow', 'metro-line', 'metro-line-construction', 'metro-line-plan', 'metro-stations'],
};
const FLAT_ONLY = new Set(['zones-fill', 'tod-fill']);
const EXTRUSION_ONLY = new Set(['zones-3d', 'tod-3d']);

const zoomWidth = (low: number, high: number): maplibregl.ExpressionSpecification => ['interpolate', ['linear'], ['zoom'], 7, low, 12, high];

/** Colour of Hanoi, the core of the region (its outline and a faint fill). */
const CORE_COLOR = { dark: '#fbbf24', light: '#d97706' };

function themeColor(theme: 'light' | 'dark'): maplibregl.ExpressionSpecification {
  const c = THEME_COLORS[theme];
  return ['match', ['get', 'theme'], 'industry', c.industry, 'logistics', c.logistics, 'tourism', c.tourism, 'health', c.health, CORE_COLOR[theme]];
}

/** Capital Region layers: regional infrastructure under the corridor arrows. Hidden until the region view is on. */
function regionLayerSpecs(p: Palette, theme: 'light' | 'dark'): maplibregl.LayerSpecification[] {
  const round = { 'line-cap': 'round', 'line-join': 'round', visibility: 'none' } as const;
  const hidden = { visibility: 'none' } as const;
  const kind = (k: string): maplibregl.ExpressionSpecification => ['==', ['get', 'kind'], k];
  const rail = theme === 'dark' ? '#f0abfc' : '#a21caf';
  const isCore: maplibregl.ExpressionSpecification = ['==', ['get', 'theme'], 'core'];
  return [
    // Provinces: tinted by the theme of their direction, outlined; Hanoi outlined in the core colour on top.
    {
      id: 'reg-prov-fill',
      type: 'fill',
      source: 'fm-reg-provinces',
      layout: hidden,
      paint: { 'fill-color': themeColor(theme), 'fill-opacity': ['case', isCore, theme === 'dark' ? 0.1 : 0.08, theme === 'dark' ? 0.2 : 0.16] },
    },
    {
      id: 'reg-prov-line',
      type: 'line',
      source: 'fm-reg-provinces',
      filter: ['!', isCore],
      layout: hidden,
      paint: { 'line-color': themeColor(theme), 'line-width': zoomWidth(1.2, 2.4), 'line-opacity': 0.75 },
    },
    {
      id: 'reg-prov-selected',
      type: 'line',
      source: 'fm-reg-provinces',
      filter: ['in', ['get', 'corridor'], ['literal', []]],
      layout: hidden,
      paint: { 'line-color': themeColor(theme), 'line-width': zoomWidth(2.6, 4.5), 'line-opacity': 1 },
    },
    { id: 'reg-hanoi-glow', type: 'line', source: 'fm-reg-provinces', filter: isCore, layout: hidden, paint: { 'line-color': CORE_COLOR[theme], 'line-width': zoomWidth(8, 16), 'line-blur': 6, 'line-opacity': p.glow } },
    { id: 'reg-hanoi-line', type: 'line', source: 'fm-reg-provinces', filter: isCore, layout: hidden, paint: { 'line-color': CORE_COLOR[theme], 'line-width': zoomWidth(1.8, 3.2), 'line-opacity': 0.95 } },
    { id: 'reg-infra-exp', type: 'line', source: 'fm-reg-infra', filter: kind('expressway'), layout: round, paint: { 'line-color': p.expressway, 'line-width': zoomWidth(1.4, 3.4), 'line-opacity': 0.85 } },
    { id: 'reg-infra-ring', type: 'line', source: 'fm-reg-infra', filter: kind('ring'), layout: hidden, paint: { 'line-color': p.ring, 'line-width': zoomWidth(1.2, 2.8), 'line-opacity': 0.8, 'line-dasharray': [2, 1.6] } },
    { id: 'reg-infra-rail', type: 'line', source: 'fm-reg-infra', filter: ['all', kind('railway'), ['!=', ['get', 'status'], 'plan']], layout: hidden, paint: { 'line-color': rail, 'line-width': zoomWidth(1.4, 3), 'line-opacity': 0.9, 'line-dasharray': [3, 1] } },
    { id: 'reg-infra-rail-plan', type: 'line', source: 'fm-reg-infra', filter: ['all', kind('railway'), ['==', ['get', 'status'], 'plan']], layout: hidden, paint: { 'line-color': rail, 'line-width': zoomWidth(1.2, 2.6), 'line-opacity': 0.7, 'line-dasharray': [1, 1.6] } },
    { id: 'reg-arrow-glow', type: 'line', source: 'fm-reg-arrows', layout: round, paint: { 'line-color': themeColor(theme), 'line-width': zoomWidth(10, 26), 'line-blur': 8, 'line-opacity': p.glow } },
    { id: 'reg-arrow', type: 'line', source: 'fm-reg-arrows', layout: round, paint: { 'line-color': themeColor(theme), 'line-width': zoomWidth(4, 10), 'line-opacity': 0.9 } },
    { id: 'reg-arrow-selected', type: 'line', source: 'fm-reg-arrows', filter: ['in', ['get', 'slug'], ['literal', []]], layout: round, paint: { 'line-color': p.selected, 'line-width': zoomWidth(1.5, 3), 'line-opacity': 1 } },
    { id: 'reg-heads', type: 'fill', source: 'fm-reg-heads', layout: hidden, paint: { 'fill-color': themeColor(theme), 'fill-opacity': 0.95 } },
    { id: 'reg-nodes', type: 'circle', source: 'fm-reg-nodes', layout: hidden, paint: { 'circle-color': themeColor(theme), 'circle-radius': ['interpolate', ['linear'], ['zoom'], 7, 2.5, 11, 5], 'circle-stroke-color': p.station, 'circle-stroke-width': 1.2 } },
  ];
}

function layerSpecs(p: Palette): maplibregl.LayerSpecification[] {
  const round = { 'line-cap': 'round', 'line-join': 'round' } as const;
  const kind = (k: string): maplibregl.ExpressionSpecification => ['==', ['get', 'kind'], k];
  const status = (s: string): maplibregl.ExpressionSpecification => ['==', ['get', 'status'], s];
  return [
    { id: 'green-fill', type: 'fill', source: 'fm-green', paint: { 'fill-color': p.green, 'fill-opacity': p.greenFill } },
    { id: 'green-line', type: 'line', source: 'fm-green', paint: { 'line-color': p.green, 'line-opacity': 0.55, 'line-width': 1, 'line-dasharray': [2, 2] } },
    { id: 'water-lake', type: 'fill', source: 'fm-water', filter: kind('lake'), paint: { 'fill-color': p.water, 'fill-opacity': 0.5 } },
    { id: 'water-river-glow', type: 'line', source: 'fm-water', filter: kind('river'), layout: round, paint: { 'line-color': p.water, 'line-width': zoomWidth(6, 20), 'line-blur': 6, 'line-opacity': p.glow } },
    { id: 'water-river', type: 'line', source: 'fm-water', filter: kind('river'), layout: round, paint: { 'line-color': p.water, 'line-width': zoomWidth(1.4, 6), 'line-opacity': 0.9 } },
    { id: 'zones-fill', type: 'fill', source: 'fm-zones', paint: { 'fill-color': p.zone, 'fill-opacity': ['match', ['get', 'status'], 'plan', 0.13, 0.22] } },
    { id: 'zones-line', type: 'line', source: 'fm-zones', paint: { 'line-color': p.zone, 'line-width': 1.4, 'line-opacity': 0.9, 'line-dasharray': [3, 2] } },
    {
      id: 'zones-3d',
      type: 'fill-extrusion',
      source: 'fm-zones',
      paint: { 'fill-extrusion-color': p.zone, 'fill-extrusion-height': ['get', 'height'], 'fill-extrusion-base': 0, 'fill-extrusion-opacity': 0.6 },
    },
    { id: 'zones-selected', type: 'line', source: 'fm-zones', filter: ['in', ['get', 'slug'], ['literal', []]], paint: { 'line-color': p.selected, 'line-width': 3, 'line-opacity': 1 } },
    { id: 'tod-fill', type: 'fill', source: 'fm-tod', paint: { 'fill-color': p.tod, 'fill-opacity': 0.34 } },
    { id: 'tod-line', type: 'line', source: 'fm-tod', paint: { 'line-color': p.tod, 'line-width': 1.4, 'line-opacity': 0.95 } },
    {
      id: 'tod-3d',
      type: 'fill-extrusion',
      source: 'fm-tod',
      paint: { 'fill-extrusion-color': p.tod, 'fill-extrusion-height': ['get', 'height'], 'fill-extrusion-base': 0, 'fill-extrusion-opacity': 0.75 },
    },
    { id: 'axes-line', type: 'line', source: 'fm-axes', layout: round, paint: { 'line-color': p.axes, 'line-width': 1.6, 'line-dasharray': [1.5, 2.5], 'line-opacity': 0.85 } },
    // Status is drawn with separate layers: line-dasharray cannot be data-driven.
    { id: 'roads-ring', type: 'line', source: 'fm-roads', filter: ['all', kind('ring'), status('operating')], paint: { 'line-color': p.ring, 'line-width': zoomWidth(0.8, 2.2), 'line-opacity': 0.8 } },
    { id: 'roads-ring-construction', type: 'line', source: 'fm-roads', filter: ['all', kind('ring'), ['!', status('operating')]], paint: { 'line-color': p.ring, 'line-width': zoomWidth(1, 2.6), 'line-opacity': 0.85, 'line-dasharray': [2, 1.5] } },
    { id: 'roads-glow', type: 'line', source: 'fm-roads', filter: kind('expressway'), layout: round, paint: { 'line-color': p.expressway, 'line-width': zoomWidth(4, 12), 'line-blur': 4, 'line-opacity': p.glow } },
    { id: 'roads-line', type: 'line', source: 'fm-roads', filter: kind('expressway'), layout: round, paint: { 'line-color': p.expressway, 'line-width': zoomWidth(1.2, 3.2), 'line-opacity': 0.95 } },
    { id: 'metro-glow', type: 'line', source: 'fm-metro', filter: status('operating'), layout: round, paint: { 'line-color': ['get', 'color'], 'line-width': zoomWidth(6, 18), 'line-blur': 5, 'line-opacity': p.glow } },
    { id: 'metro-line', type: 'line', source: 'fm-metro', filter: status('operating'), layout: round, paint: { 'line-color': ['get', 'color'], 'line-width': zoomWidth(1.8, 4.6), 'line-opacity': 1 } },
    { id: 'metro-line-construction', type: 'line', source: 'fm-metro', filter: status('construction'), paint: { 'line-color': ['get', 'color'], 'line-width': zoomWidth(1.8, 4.6), 'line-opacity': 0.95, 'line-dasharray': [2, 1] } },
    { id: 'metro-line-plan', type: 'line', source: 'fm-metro', filter: status('plan'), paint: { 'line-color': ['get', 'color'], 'line-width': zoomWidth(1.4, 3.6), 'line-opacity': 0.75, 'line-dasharray': [1, 1.6] } },
    {
      id: 'metro-stations',
      type: 'circle',
      source: 'fm-stations',
      paint: {
        'circle-color': p.station,
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 7, 1.6, 12, 4.4],
        'circle-stroke-color': ['get', 'color'],
        'circle-stroke-width': 1.6,
        'circle-opacity': ['match', ['get', 'status'], 'plan', 0.5, 1],
      },
    },
  ];
}

/** Only a background: used when the base style can't be downloaded, so the scenario layers still show. */
const FALLBACK_BASE: maplibregl.StyleSpecification = {
  version: 8,
  sources: {},
  layers: [{ id: 'background', type: 'background', paint: {} }],
};

const baseStyles = new Map<'light' | 'dark', Promise<maplibregl.StyleSpecification>>();

/** Downloads (once per theme) the OpenFreeMap style; resolves to the fallback if that fails. */
function loadBaseStyle(theme: 'light' | 'dark'): Promise<maplibregl.StyleSpecification> {
  let style = baseStyles.get(theme);
  if (!style) {
    // A hung download must not keep the map from appearing: give up after 8 s and use the plain background.
    style = fetch(BASE_STYLE_URL[theme], { signal: AbortSignal.timeout(8000) })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json() as Promise<maplibregl.StyleSpecification>;
      })
      .catch(() => {
        baseStyles.delete(theme); // try again next time
        return FALLBACK_BASE;
      });
    baseStyles.set(theme, style);
  }
  return style;
}

/** The base map with the scenario and region sources (holding `data`, if given) and layers drawn on top. */
function composeStyle(
  base: maplibregl.StyleSpecification,
  theme: 'light' | 'dark',
  data?: Scenario['layers'],
  region?: RegionData['layers'],
): maplibregl.StyleSpecification {
  const p = PALETTE[theme];
  const sources: Record<string, maplibregl.SourceSpecification> = { ...base.sources };
  for (const [id, key] of Object.entries(SOURCES)) sources[id] = { type: 'geojson', data: data?.[key] ?? EMPTY };
  for (const [id, key] of Object.entries(REGION_SOURCES)) sources[id] = { type: 'geojson', data: region?.[key] ?? EMPTY };
  const baseLayers = base.layers.map((layer) =>
    // Our own background colour keeps the Future Map's navy / pale blue look under the base map.
    layer.type === 'background' ? { ...layer, paint: { ...layer.paint, 'background-color': p.background } } : layer,
  );
  // Province areas go under the base map's water: OSM provincial boundaries include the territorial sea, which
  // the water fill then covers, so the coastal provinces read as land only.
  const regionLayers = regionLayerSpecs(p, theme);
  const underWater = regionLayers.filter((l) => PROVINCE_LAYERS.has(l.id));
  const onTop = regionLayers.filter((l) => !PROVINCE_LAYERS.has(l.id));
  const water = baseLayers.findIndex((l) => l.id === 'water');
  const layers =
    water >= 0
      ? [...baseLayers.slice(0, water), ...underWater, ...baseLayers.slice(water), ...layerSpecs(p), ...onTop]
      : [...baseLayers, ...underWater, ...layerSpecs(p), ...onTop];
  return { ...base, sources, layers };
}

const ICON_PLANE =
  '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15.5v-2l-8-5V4a1.5 1.5 0 0 0-3 0v4.5l-8 5v2l8-2.5V18l-2 1.5V21l3.5-1 3.5 1v-1.5L13 18v-5l8 2.5z"/></svg>';
const ICON_BOX =
  '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M3 8l9-5 9 5v8l-9 5-9-5V8z M3 8l9 5 9-5 M12 13v8"/></svg>';

function hubTone(tags: readonly string[]): string {
  if (tags.includes('heritage') && tags.length <= 3) return 'white';
  if (tags.includes('innovation')) return 'violet';
  if (tags.includes('airport')) return 'sky';
  if (tags.includes('green') && !tags.includes('tod')) return 'green';
  return 'gold';
}

/**
 * MapLibre wrapper for the Hanoi Future Map: colours, glow, 2D/3D and markers only. All data (scenario layers,
 * hubs, scores) comes from the parent, so this component knows nothing about the API.
 */
@Component({
  selector: 'fm-map',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  template: `<div #host class="fm-map__host" role="application" aria-label="Bản đồ Hà Nội tương lai"></div>`,
  styles: [
    `
      fm-map {
        display: block;
        position: absolute;
        inset: 0;
      }
      .fm-map__host {
        position: absolute;
        inset: 0;
      }
      .fm-map__host .maplibregl-ctrl-attrib {
        background: var(--fm-glass, rgba(255, 255, 255, 0.8));
        color: var(--fm-ink-dim, #555);
        font-size: 10px;
      }
      .fm-map__host .maplibregl-ctrl-attrib a {
        color: inherit;
      }

      .fm-hub {
        position: relative;
        width: 16px;
        height: 16px;
        padding: 0;
        border: 0;
        background: none;
        cursor: pointer;
        font: inherit;
        --tone: #ffb020;
      }
      .fm-hub--sky {
        --tone: #38bdf8;
      }
      .fm-hub--violet {
        --tone: #b56cff;
      }
      .fm-hub--green {
        --tone: #34d399;
      }
      .fm-hub--white {
        --tone: #e2e8f0;
      }
      .fm-hub__dot {
        position: absolute;
        inset: 2px;
        border-radius: 50%;
        background: var(--tone);
        border: 2px solid var(--fm-ring, #0b1220);
        box-shadow: 0 0 0 2px var(--tone), 0 0 14px 2px var(--tone);
        transition: transform 0.15s ease;
      }
      .fm-hub:hover .fm-hub__dot,
      .fm-hub.is-selected .fm-hub__dot {
        transform: scale(1.35);
      }
      .fm-hub.is-new::after {
        content: '';
        position: absolute;
        inset: -6px;
        border-radius: 50%;
        border: 2px solid var(--tone);
        animation: fm-pulse 1.8s ease-out infinite;
        pointer-events: none;
      }
      .fm-hub.is-dim {
        opacity: 0.4;
      }
      .fm-hub__label {
        position: absolute;
        left: 22px;
        top: 50%;
        transform: translateY(-50%);
        padding: 2px 9px;
        border-radius: 999px;
        border: 1px solid var(--fm-line, rgba(255, 255, 255, 0.2));
        background: var(--fm-glass, rgba(11, 18, 32, 0.8));
        color: var(--fm-ink, #fff);
        font: 700 11.5px/1.5 'Manrope', -apple-system, 'Segoe UI', sans-serif;
        white-space: nowrap;
        pointer-events: none;
        backdrop-filter: blur(6px);
      }
      .fm-hub.is-selected .fm-hub__label {
        border-color: var(--tone);
      }
      .fm-map__host.fm-labels-off .fm-hub:not(.is-selected) .fm-hub__label {
        display: none;
      }
      @keyframes fm-pulse {
        from {
          transform: scale(0.7);
          opacity: 0.9;
        }
        to {
          transform: scale(1.7);
          opacity: 0;
        }
      }
      @media (prefers-reduced-motion: reduce) {
        .fm-hub.is-new::after {
          animation: none;
          opacity: 0.6;
        }
      }

      .fm-poi {
        display: grid;
        place-items: center;
        width: 26px;
        height: 26px;
        border-radius: 50%;
        background: var(--fm-glass, rgba(11, 18, 32, 0.85));
        border: 1.5px solid var(--poi, #38bdf8);
        color: var(--poi, #38bdf8);
        box-shadow: 0 0 12px color-mix(in srgb, var(--poi, #38bdf8) 55%, transparent);
      }
      .fm-poi--logistics {
        --poi: #fb923c;
        width: 22px;
        height: 22px;
      }
      .fm-poi--scenario {
        border-style: dashed;
      }
      .fm-poi--hospital {
        --poi: #f472b6;
      }
      .fm-poi--construction {
        border-style: dashed;
      }

      .fm-dest {
        display: grid;
        gap: 2px;
        max-width: 220px;
        padding: 5px 9px 6px;
        border-radius: 12px;
        border: 1px solid var(--fm-line, rgba(255, 255, 255, 0.2));
        border-left: 4px solid var(--c, #60a5fa);
        background: var(--fm-glass, rgba(11, 18, 32, 0.86));
        color: var(--fm-ink, #fff);
        font: 600 11px/1.35 'Manrope', -apple-system, 'Segoe UI', sans-serif;
        text-align: left;
        cursor: pointer;
        backdrop-filter: blur(6px);
        box-shadow: 0 6px 18px rgba(0, 0, 0, 0.22);
      }
      .fm-dest strong {
        font-size: 12.5px;
        font-weight: 800;
        letter-spacing: 0.02em;
        text-transform: uppercase;
      }
      /* The role shows on the selected label (and on hover), so six labels fit on the regional map. */
      .fm-dest span {
        display: none;
        color: var(--c, #60a5fa);
        font-weight: 700;
      }
      .fm-dest:hover span,
      .fm-dest.is-selected span {
        display: block;
      }
      .fm-dest:hover,
      .fm-dest.is-selected {
        z-index: 2;
      }
      .fm-dest small {
        color: var(--fm-ink-dim, #94a3b8);
        font-weight: 600;
      }
      .fm-dest.is-selected {
        outline: 2px solid var(--c, #60a5fa);
        outline-offset: 1px;
      }
      .fm-map__host.fm-labels-compact .fm-dest small {
        display: none;
      }
    `,
  ],
})
export class FutureMapCanvasComponent implements AfterViewInit, OnDestroy {
  private readonly zone = inject(NgZone);
  @ViewChild('host', { static: true }) private host!: ElementRef<HTMLDivElement>;

  readonly scenario = input<Scenario | null>(null);
  readonly visible = input.required<ReadonlySet<LayerKey>>();
  readonly theme = input<'light' | 'dark'>('dark');
  readonly mode3d = input(false);
  readonly selectedSlug = input<string | null>(null);
  /** Extra hubs to outline (the ones an answer talks about). */
  readonly highlights = input<readonly string[]>([]);
  /** Changing the token flies to the overview camera. */
  readonly viewToken = input(0);
  /** Fly to a hub; the token lets the same hub be requested twice. */
  readonly flyTarget = input<{ slug: string; token: number } | null>(null);
  readonly hubSelect = output<string>();
  /** 'region' switches to the Capital Region: corridor arrows, regional infrastructure and province labels. */
  readonly view = input<MapView>('city');
  readonly region = input<RegionData | null>(null);
  readonly corridorSlug = input<string | null>(null);
  /** Corridor themes to show (empty = all). */
  readonly themeFilter = input<readonly CorridorTheme[]>([]);
  readonly corridorSelect = output<string>();

  private map?: maplibregl.Map;
  private resizeObserver?: ResizeObserver;
  private readonly ready = signal(false);
  private hubMarkers = new Map<string, { marker: maplibregl.Marker; el: HTMLElement }>();
  private poiMarkers: maplibregl.Marker[] = [];
  private regionMarkers = new Map<string, { marker: maplibregl.Marker; el: HTMLElement; theme: CorridorTheme }>();
  private regionPois: maplibregl.Marker[] = [];
  private lastView: MapView = 'city';
  private lastViewToken = 0;
  /** Theme of the style currently on the map. */
  private styleTheme?: 'light' | 'dark';
  private destroyed = false;

  constructor() {
    effect(() => {
      const scenario = this.scenario();
      if (!this.ready() || !scenario) return;
      untracked(() => this.applyScenario(scenario));
    });
    effect(() => {
      const visible = this.visible();
      const is3d = this.mode3d();
      if (!this.ready()) return;
      untracked(() => this.applyVisibility(visible, is3d));
    });
    effect(() => {
      const theme = this.theme();
      if (!this.ready()) return;
      untracked(() => this.applyTheme(theme));
    });
    effect(() => {
      const is3d = this.mode3d();
      if (!this.ready()) return;
      untracked(() => this.map?.easeTo({ pitch: is3d ? 58 : 0, bearing: is3d ? -18 : 0, duration: 900 }));
    });
    effect(() => {
      const selected = this.selectedSlug();
      const highlights = this.highlights();
      if (!this.ready()) return;
      untracked(() => this.applySelection(selected, highlights));
    });
    effect(() => {
      const target = this.flyTarget();
      if (!this.ready() || !target) return;
      untracked(() => this.flyToHub(target.slug));
    });
    effect(() => {
      const token = this.viewToken();
      if (!this.ready() || token === this.lastViewToken) return;
      this.lastViewToken = token;
      untracked(() => this.fitOverview());
    });
    effect(() => {
      const region = this.region();
      if (!this.ready()) return;
      untracked(() => this.applyRegion(region));
    });
    effect(() => {
      const view = this.view();
      const themes = this.themeFilter();
      const corridor = this.corridorSlug();
      if (!this.ready()) return;
      untracked(() => {
        this.applyRegionVisibility(view, themes, corridor);
        if (view !== this.lastView) {
          this.lastView = view;
          if (corridor && view === 'region') this.flyToCorridor(corridor);
          else this.fitOverview();
        }
      });
    });
    effect(() => {
      const corridor = this.corridorSlug();
      if (!this.ready() || !corridor || this.view() !== 'region') return;
      untracked(() => this.flyToCorridor(corridor));
    });
  }

  ngAfterViewInit(): void {
    const theme = this.theme();
    void loadBaseStyle(theme).then((base) => {
      if (!this.destroyed) this.createMap(composeStyle(base, theme), theme);
    });
  }

  private createMap(style: maplibregl.StyleSpecification, theme: 'light' | 'dark'): void {
    this.styleTheme = theme;
    this.zone.runOutsideAngular(() => {
      const map = new maplibregl.Map({
        container: this.host.nativeElement,
        style,
        bounds: OVERVIEW_BOUNDS,
        fitBoundsOptions: { padding: this.padding() },
        minZoom: 7,
        maxZoom: 15,
        maxPitch: 70,
        attributionControl: { compact: true },
      });
      this.map = map;
      // 'style.load', not 'load': 'load' waits for every base-map tile, so one hung tile request would keep the
      // scenario (and every timeline change) off the map. Our sources and layers only need the style.
      map.once('style.load', () => {
        for (const layer of ['reg-arrow', 'reg-heads', 'reg-prov-fill']) {
          map.on('click', layer, (event) => {
            // Arrows carry the direction as `slug`, provinces as `corridor` (Hanoi has none).
            const props = event.features?.[0]?.properties;
            const slug = layer === 'reg-prov-fill' ? props?.['corridor'] : props?.['slug'];
            if (typeof slug === 'string' && slug) this.zone.run(() => this.corridorSelect.emit(slug));
          });
          map.on('mouseenter', layer, () => (map.getCanvas().style.cursor = 'pointer'));
          map.on('mouseleave', layer, () => (map.getCanvas().style.cursor = ''));
        }
        for (const layer of ['zones-fill', 'zones-3d']) {
          map.on('click', layer, (event) => {
            const slug = event.features?.[0]?.properties?.['slug'];
            if (typeof slug === 'string') this.zone.run(() => this.hubSelect.emit(slug));
          });
          map.on('mouseenter', layer, () => (map.getCanvas().style.cursor = 'pointer'));
          map.on('mouseleave', layer, () => (map.getCanvas().style.cursor = ''));
        }
        this.zone.run(() => this.ready.set(true));
      });
      map.on('zoom', () => {
        this.host.nativeElement.classList.toggle('fm-labels-off', map.getZoom() < 8.4);
        this.host.nativeElement.classList.toggle('fm-labels-compact', map.getZoom() < 7.9);
      });
      this.resizeObserver = new ResizeObserver(() => map.resize());
      this.resizeObserver.observe(this.host.nativeElement);
    });
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    this.resizeObserver?.disconnect();
    this.hubMarkers.forEach(({ marker }) => marker.remove());
    this.poiMarkers.forEach((marker) => marker.remove());
    this.regionMarkers.forEach(({ marker }) => marker.remove());
    this.regionPois.forEach((marker) => marker.remove());
    this.map?.remove();
  }

  zoomBy(delta: number): void {
    this.map?.easeTo({ zoom: (this.map.getZoom() ?? 9) + delta, duration: 300 });
  }

  /** Room reserved for the floating panels: wide screens keep the map between the two side columns. */
  private padding(): maplibregl.PaddingOptions {
    const width = this.host.nativeElement.clientWidth;
    if (width >= 1180) return { left: 340, right: 340, top: 40, bottom: 150 };
    if (width >= 700) return { left: 30, right: 30, top: 150, bottom: 170 };
    return { left: 10, right: 10, top: 130, bottom: 190 };
  }

  private fitOverview(): void {
    this.map?.fitBounds(this.view() === 'region' ? REGION_BOUNDS : OVERVIEW_BOUNDS, { padding: this.padding(), pitch: this.mode3d() ? 58 : 0, bearing: this.mode3d() ? -18 : 0, duration: 1100 });
  }

  private flyToHub(slug: string): void {
    const entry = this.hubMarkers.get(slug);
    if (!entry || !this.map) return;
    const center = entry.marker.getLngLat();
    const card = this.host.nativeElement.clientWidth >= 1180 ? 330 : 0;
    // Keep the hub clear of the floating hub card that opens beside the right-hand column.
    const padding = { ...this.padding(), right: this.padding().right + card };
    this.map.flyTo({ center, zoom: Math.max(this.map.getZoom(), 10.2), padding, duration: 1300, essential: true });
  }

  private applyScenario(scenario: Scenario): void {
    const map = this.map;
    if (!map) return;
    for (const [sourceId, key] of Object.entries(SOURCES)) {
      (map.getSource(sourceId) as maplibregl.GeoJSONSource | undefined)?.setData(scenario.layers[key]);
    }
    this.rebuildMarkers(scenario);
    this.applyVisibility(this.visible(), this.mode3d());
    this.applySelection(this.selectedSlug(), this.highlights());
  }

  private rebuildMarkers(scenario: Scenario): void {
    this.hubMarkers.forEach(({ marker }) => marker.remove());
    this.hubMarkers.clear();
    this.poiMarkers.forEach((marker) => marker.remove());
    this.poiMarkers = [];
    const map = this.map;
    if (!map) return;

    for (const feature of scenario.layers.hubs.features) {
      const hub = feature.properties as unknown as HubProps;
      const el = document.createElement('button');
      el.type = 'button';
      el.className = `fm-hub fm-hub--${hubTone(hub.tags)}${hub.isNew ? ' is-new' : ''}`;
      el.setAttribute('aria-label', `${hub.name} — ${hub.role}`);
      const dot = document.createElement('span');
      dot.className = 'fm-hub__dot';
      const label = document.createElement('span');
      label.className = 'fm-hub__label';
      label.textContent = hub.name;
      el.append(dot, label);
      el.addEventListener('click', (event) => {
        event.stopPropagation();
        this.zone.run(() => this.hubSelect.emit(hub.slug));
      });
      const marker = new maplibregl.Marker({ element: el, anchor: 'center' }).setLngLat(hub.center).addTo(map);
      this.hubMarkers.set(hub.slug, { marker, el });
    }

    for (const feature of scenario.layers.airports.features) {
      const props = feature.properties as { name: string; kind: 'airport' | 'logistics'; status: string };
      const el = document.createElement('span');
      el.className = `fm-poi fm-poi--${props.kind}${props.status === 'plan' ? ' fm-poi--scenario' : ''}`;
      el.title = props.name;
      el.innerHTML = props.kind === 'airport' ? ICON_PLANE : ICON_BOX;
      const [lng, lat] = (feature.geometry as GeoJSON.Point).coordinates;
      this.poiMarkers.push(new maplibregl.Marker({ element: el, anchor: 'center' }).setLngLat([lng, lat]).addTo(map));
    }
  }

  // ------------------------------------------------------------- Capital Region
  private applyRegion(region: RegionData | null): void {
    const map = this.map;
    if (!map) return;
    for (const [sourceId, key] of Object.entries(REGION_SOURCES)) {
      (map.getSource(sourceId) as maplibregl.GeoJSONSource | undefined)?.setData(region?.layers[key] ?? EMPTY);
    }
    this.regionMarkers.forEach(({ marker }) => marker.remove());
    this.regionMarkers.clear();
    this.regionPois.forEach((marker) => marker.remove());
    this.regionPois = [];
    if (region) {
      const colors = THEME_COLORS[this.theme()];
      for (const c of region.corridors) {
        const el = document.createElement('button');
        el.type = 'button';
        el.className = 'fm-dest';
        el.style.setProperty('--c', colors[c.theme]);
        const name = document.createElement('strong');
        name.textContent = c.province;
        const label = document.createElement('span');
        label.textContent = c.label;
        const meta = document.createElement('small');
        meta.textContent = `${c.direction}${c.travel ? ` · ~${c.travel.minutes}′` : ''}`;
        el.append(name, label, meta);
        el.setAttribute('aria-label', `${c.province}: ${c.label}`);
        el.addEventListener('click', (event) => {
          event.stopPropagation();
          this.zone.run(() => this.corridorSelect.emit(c.slug));
        });
        const marker = new maplibregl.Marker({ element: el, anchor: markerAnchor(c) }).setLngLat(c.destination).addTo(map);
        this.regionMarkers.set(c.slug, { marker, el, theme: c.theme });
      }
      for (const feature of region.layers.infraPoints.features) {
        const props = feature.properties as { name: string; kind: string; status: string; note: string | null };
        const el = document.createElement('span');
        el.className = `fm-poi fm-poi--${props.kind}${props.status !== 'operating' ? ' fm-poi--construction' : ''}`;
        el.title = props.note ? `${props.name} — ${props.note}` : props.name;
        el.innerHTML = props.kind === 'airport' ? ICON_PLANE : ICON_CROSS;
        const [lng, lat] = (feature.geometry as GeoJSON.Point).coordinates;
        this.regionPois.push(new maplibregl.Marker({ element: el, anchor: 'center' }).setLngLat([lng, lat]).addTo(map));
      }
    }
    this.applyRegionVisibility(this.view(), this.themeFilter(), this.corridorSlug());
  }

  private applyRegionVisibility(view: MapView, themes: readonly CorridorTheme[], corridor: string | null): void {
    const map = this.map;
    if (!map) return;
    const on = view === 'region';
    for (const id of REGION_LAYERS) if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', on ? 'visible' : 'none');
    const themeFilter: maplibregl.FilterSpecification = themes.length ? ['in', ['get', 'theme'], ['literal', [...themes]]] : ['has', 'theme'];
    for (const id of ['reg-arrow-glow', 'reg-arrow', 'reg-heads', 'reg-nodes']) if (map.getLayer(id)) map.setFilter(id, themeFilter);
    // Provinces outside the chosen themes stay on the map as context, only Hanoi and the chosen ones are tinted.
    const provinceFilter: maplibregl.FilterSpecification = themes.length ? ['in', ['get', 'theme'], ['literal', [...themes, 'core']]] : ['has', 'theme'];
    if (map.getLayer('reg-prov-fill')) map.setFilter('reg-prov-fill', provinceFilter);
    if (map.getLayer('reg-prov-selected')) map.setFilter('reg-prov-selected', ['in', ['get', 'corridor'], ['literal', corridor ? [corridor] : []]]);
    if (map.getLayer('reg-arrow-selected')) map.setFilter('reg-arrow-selected', ['in', ['get', 'slug'], ['literal', corridor ? [corridor] : []]]);
    this.regionMarkers.forEach(({ el, theme }, slug) => {
      el.style.display = on && (!themes.length || themes.includes(theme)) ? '' : 'none';
      el.classList.toggle('is-selected', slug === corridor);
    });
    this.regionPois.forEach((marker) => (marker.getElement().style.display = on ? '' : 'none'));
  }

  private flyToCorridor(slug: string): void {
    const c = this.region()?.corridors.find((x) => x.slug === slug);
    const map = this.map;
    if (!c || !map) return;
    const origin = this.region()!.origin;
    const bounds = new maplibregl.LngLatBounds(origin, origin);
    bounds.extend(c.destination);
    c.nodes.forEach((n) => bounds.extend(n.at));
    const wide = this.host.nativeElement.clientWidth >= 1180;
    // Keep clear of the direction card, and leave room for the province label beside the town.
    const labelRoom = c.destination[0] >= origin[0] ? 190 : 0;
    const base = this.padding();
    const padding = { ...base, right: base.right + (wide ? 330 : 0) + labelRoom, left: base.left + (labelRoom ? 0 : 190) };
    map.fitBounds(bounds, { padding, maxZoom: 9.6, duration: 1200, pitch: this.mode3d() ? 58 : 0 });
  }

  private applyVisibility(visible: ReadonlySet<LayerKey>, is3d: boolean): void {
    const map = this.map;
    if (!map) return;
    for (const [key, ids] of Object.entries(GROUPS) as Array<[LayerKey, string[]]>) {
      for (const id of ids) {
        if (!map.getLayer(id)) continue;
        const shown = visible.has(key) && (is3d ? !FLAT_ONLY.has(id) : !EXTRUSION_ONLY.has(id));
        map.setLayoutProperty(id, 'visibility', shown ? 'visible' : 'none');
      }
    }
    this.hubMarkers.forEach(({ el }) => (el.style.display = visible.has('hubs') ? '' : 'none'));
    this.poiMarkers.forEach((marker) => (marker.getElement().style.display = visible.has('airports') ? '' : 'none'));
  }

  /** Swaps in the other base map, carrying the current scenario data, toggles and selection across. */
  private applyTheme(theme: 'light' | 'dark'): void {
    if (theme === this.styleTheme) return;
    this.styleTheme = theme;
    void loadBaseStyle(theme).then((base) => {
      const map = this.map;
      if (!map || this.styleTheme !== theme) return;
      map.once('style.load', () => {
        this.applyVisibility(this.visible(), this.mode3d());
        this.applySelection(this.selectedSlug(), this.highlights());
        // Label colours follow the theme: rebuild the region markers.
        this.applyRegion(this.region());
      });
      map.setStyle(composeStyle(base, theme, this.scenario()?.layers, this.region()?.layers), { diff: false });
    });
  }

  private applySelection(selected: string | null, highlights: readonly string[]): void {
    const map = this.map;
    if (!map) return;
    const slugs = [...new Set([...(selected ? [selected] : []), ...highlights])];
    if (map.getLayer('zones-selected')) map.setFilter('zones-selected', ['in', ['get', 'slug'], ['literal', slugs]]);
    this.hubMarkers.forEach(({ el }, slug) => {
      el.classList.toggle('is-selected', slug === selected);
      el.classList.toggle('is-dim', highlights.length > 0 && !slugs.includes(slug));
    });
  }
}

/**
 * Put the province label beside the town, on the side away from Hanoi, so it never covers the arrow — and never
 * above it, where the search box and the title card sit.
 */
function markerAnchor(c: CorridorSummary): maplibregl.PositionAnchor {
  return c.destination[0] - 105.8542 >= -0.02 ? 'left' : 'right';
}
