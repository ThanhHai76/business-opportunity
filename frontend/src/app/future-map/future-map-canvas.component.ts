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
import { FC, HubProps, LayerKey, Scenario } from './future-map.models';

const OSM_TILES = ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'];
const ATTRIBUTION = '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
/** The whole capital region, used as the "overview" camera. */
const OVERVIEW_BOUNDS: maplibregl.LngLatBoundsLike = [
  [105.4, 20.66],
  [106.08, 21.36],
];
const EMPTY: FC = { type: 'FeatureCollection', features: [] };

interface Palette {
  background: string;
  base: Record<string, number>;
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
    base: { 'raster-saturation': -0.7, 'raster-contrast': 0.3, 'raster-brightness-min': 0, 'raster-brightness-max': 0.36, 'raster-hue-rotate': 205 },
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
    base: { 'raster-saturation': -0.55, 'raster-contrast': -0.05, 'raster-brightness-min': 0.05, 'raster-brightness-max': 1, 'raster-hue-rotate': 0 },
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
  'fm-boundaries': 'boundaries',
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
  boundaries: ['boundaries-line'],
  zones: ['zones-fill', 'zones-line', 'zones-3d', 'zones-selected'],
  tod: ['tod-fill', 'tod-line', 'tod-3d'],
  axes: ['axes-line'],
  roads: ['roads-ring', 'roads-glow', 'roads-line'],
  metro: ['metro-glow', 'metro-line', 'metro-stations'],
};
const FLAT_ONLY = new Set(['zones-fill', 'tod-fill']);
const EXTRUSION_ONLY = new Set(['zones-3d', 'tod-3d']);

const zoomWidth = (low: number, high: number): maplibregl.ExpressionSpecification => ['interpolate', ['linear'], ['zoom'], 7, low, 12, high];

function layerSpecs(p: Palette): maplibregl.LayerSpecification[] {
  const round = { 'line-cap': 'round', 'line-join': 'round' } as const;
  const kind = (k: string): maplibregl.FilterSpecification => ['==', ['get', 'kind'], k];
  return [
    { id: 'green-fill', type: 'fill', source: 'fm-green', paint: { 'fill-color': p.green, 'fill-opacity': p.greenFill } },
    { id: 'green-line', type: 'line', source: 'fm-green', paint: { 'line-color': p.green, 'line-opacity': 0.55, 'line-width': 1, 'line-dasharray': [2, 2] } },
    { id: 'water-lake', type: 'fill', source: 'fm-water', filter: kind('lake'), paint: { 'fill-color': p.water, 'fill-opacity': 0.5 } },
    { id: 'water-river-glow', type: 'line', source: 'fm-water', filter: kind('river'), layout: round, paint: { 'line-color': p.water, 'line-width': zoomWidth(6, 20), 'line-blur': 6, 'line-opacity': p.glow } },
    { id: 'water-river', type: 'line', source: 'fm-water', filter: kind('river'), layout: round, paint: { 'line-color': p.water, 'line-width': zoomWidth(1.4, 6), 'line-opacity': 0.9 } },
    { id: 'boundaries-line', type: 'line', source: 'fm-boundaries', paint: { 'line-color': p.boundary, 'line-width': 1, 'line-opacity': 0.5, 'line-dasharray': [3, 3] } },
    { id: 'zones-fill', type: 'fill', source: 'fm-zones', paint: { 'fill-color': p.zone, 'fill-opacity': 0.2 } },
    { id: 'zones-line', type: 'line', source: 'fm-zones', paint: { 'line-color': p.zone, 'line-width': 1.4, 'line-opacity': 0.9 } },
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
    { id: 'roads-ring', type: 'line', source: 'fm-roads', filter: kind('ring'), paint: { 'line-color': p.ring, 'line-width': zoomWidth(0.8, 2.2), 'line-opacity': 0.8 } },
    { id: 'roads-glow', type: 'line', source: 'fm-roads', filter: kind('expressway'), layout: round, paint: { 'line-color': p.expressway, 'line-width': zoomWidth(4, 12), 'line-blur': 4, 'line-opacity': p.glow } },
    { id: 'roads-line', type: 'line', source: 'fm-roads', filter: kind('expressway'), layout: round, paint: { 'line-color': p.expressway, 'line-width': zoomWidth(1.2, 3.2), 'line-opacity': 0.95 } },
    { id: 'metro-glow', type: 'line', source: 'fm-metro', layout: round, paint: { 'line-color': ['get', 'color'], 'line-width': zoomWidth(6, 18), 'line-blur': 5, 'line-opacity': p.glow } },
    { id: 'metro-line', type: 'line', source: 'fm-metro', layout: round, paint: { 'line-color': ['get', 'color'], 'line-width': zoomWidth(1.8, 4.6), 'line-opacity': 1 } },
    {
      id: 'metro-stations',
      type: 'circle',
      source: 'fm-stations',
      paint: {
        'circle-color': p.station,
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 7, 1.6, 12, 4.4],
        'circle-stroke-color': ['get', 'color'],
        'circle-stroke-width': 1.6,
      },
    },
  ];
}

function buildStyle(theme: 'light' | 'dark'): maplibregl.StyleSpecification {
  const p = PALETTE[theme];
  const sources: Record<string, maplibregl.SourceSpecification> = {
    osm: { type: 'raster', tiles: OSM_TILES, tileSize: 256, maxzoom: 19, attribution: ATTRIBUTION },
  };
  for (const id of Object.keys(SOURCES)) sources[id] = { type: 'geojson', data: EMPTY };
  return {
    version: 8,
    sources,
    layers: [
      // Visible while tiles load, or if the tile server is unreachable, so the map never looks broken.
      { id: 'background', type: 'background', paint: { 'background-color': p.background } },
      { id: 'base', type: 'raster', source: 'osm', paint: { ...p.base } },
      ...layerSpecs(p),
    ],
  };
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

  private map?: maplibregl.Map;
  private resizeObserver?: ResizeObserver;
  private readonly ready = signal(false);
  private hubMarkers = new Map<string, { marker: maplibregl.Marker; el: HTMLElement }>();
  private poiMarkers: maplibregl.Marker[] = [];
  private lastViewToken = 0;

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
  }

  ngAfterViewInit(): void {
    this.zone.runOutsideAngular(() => {
      const map = new maplibregl.Map({
        container: this.host.nativeElement,
        style: buildStyle(this.theme()),
        bounds: OVERVIEW_BOUNDS,
        fitBoundsOptions: { padding: this.padding() },
        minZoom: 7,
        maxZoom: 15,
        maxPitch: 70,
        attributionControl: { compact: true },
      });
      this.map = map;
      map.on('load', () => {
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
      map.on('zoom', () => this.host.nativeElement.classList.toggle('fm-labels-off', map.getZoom() < 8.4));
      this.resizeObserver = new ResizeObserver(() => map.resize());
      this.resizeObserver.observe(this.host.nativeElement);
    });
  }

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
    this.hubMarkers.forEach(({ marker }) => marker.remove());
    this.poiMarkers.forEach((marker) => marker.remove());
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
    this.map?.fitBounds(OVERVIEW_BOUNDS, { padding: this.padding(), pitch: this.mode3d() ? 58 : 0, bearing: this.mode3d() ? -18 : 0, duration: 1100 });
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
      el.className = `fm-poi fm-poi--${props.kind}${props.status === 'scenario' ? ' fm-poi--scenario' : ''}`;
      el.title = props.name;
      el.innerHTML = props.kind === 'airport' ? ICON_PLANE : ICON_BOX;
      const [lng, lat] = (feature.geometry as GeoJSON.Point).coordinates;
      this.poiMarkers.push(new maplibregl.Marker({ element: el, anchor: 'center' }).setLngLat([lng, lat]).addTo(map));
    }
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

  private applyTheme(theme: 'light' | 'dark'): void {
    const map = this.map;
    if (!map) return;
    const p = PALETTE[theme];
    map.setPaintProperty('background', 'background-color', p.background);
    for (const [prop, value] of Object.entries(p.base)) map.setPaintProperty('base', prop, value);
    for (const spec of layerSpecs(p)) {
      if (!map.getLayer(spec.id) || !('paint' in spec) || !spec.paint) continue;
      for (const [prop, value] of Object.entries(spec.paint)) map.setPaintProperty(spec.id, prop, value);
    }
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
