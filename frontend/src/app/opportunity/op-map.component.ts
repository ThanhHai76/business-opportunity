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
import { WardProps, WardsResponse } from './op.models';

/** OpenFreeMap vector base maps (OpenStreetMap data, no key). */
const BASE_STYLE_URL: Record<'light' | 'dark', string> = {
  light: 'https://tiles.openfreemap.org/styles/positron',
  dark: 'https://tiles.openfreemap.org/styles/dark',
};
const HANOI_BOUNDS: maplibregl.LngLatBoundsLike = [
  [105.66, 20.86],
  [106.01, 21.24],
];
const EMPTY: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] };

/** Opportunity score colours (low → high); the same stops feed the legend. */
export const SCORE_STOPS: Array<[number, string]> = [
  [0, '#fde68a'],
  [30, '#fbbf24'],
  [45, '#a3e635'],
  [60, '#22c55e'],
  [75, '#0f9f6e'],
];
const UNSCORED = { light: '#cbd5e1', dark: '#475569' };
const OUTLINE = { light: '#ffffff', dark: '#0b1220' };
const SELECTED = { light: '#0f172a', dark: '#ffffff' };
const COMPARE = '#7c3aed';
const LABEL = { light: { text: '#0f172a', halo: 'rgba(255,255,255,0.92)' }, dark: { text: '#f1f5f9', halo: 'rgba(8,13,24,0.9)' } };

/**
 * Ward names at the ward centre, readable from the whole-city view: short names ("Láng", not "Phường Láng"),
 * bigger wards placed first when labels collide, and nudged below the rank badge when the ward has one.
 */
function labelLayer(theme: 'light' | 'dark'): maplibregl.LayerSpecification {
  return {
    id: 'op-labels',
    type: 'symbol',
    source: 'op-labels',
    layout: {
      'text-field': ['get', 'label'],
      'text-font': ['Noto Sans Regular'],
      'text-size': ['interpolate', ['linear'], ['zoom'], 9, 8.5, 10.5, 9.5, 12, 12, 14, 14],
      'text-max-width': 5,
      'text-line-height': 1.1,
      'text-padding': 0,
      'text-offset': ['case', ['has', 'rank'], ['literal', [0, 1.35]], ['literal', [0, 0]]],
      'text-anchor': ['case', ['has', 'rank'], 'top', 'center'],
      'symbol-sort-key': ['-', 0, ['coalesce', ['get', 'population'], 0]],
    },
    paint: { 'text-color': LABEL[theme].text, 'text-halo-color': LABEL[theme].halo, 'text-halo-width': 1.6 },
  };
}

/** One point per ward for the labels (the polygon source would label every tile piece). */
function labelPoints(wards: GeoJSON.FeatureCollection | undefined | null): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: (wards?.features ?? []).map((f) => {
      const p = f.properties as unknown as WardProps;
      return {
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [p.lng, p.lat] },
        properties: { label: p.name.replace(/^(Phường|Xã)\s+/, ''), population: p.population ?? 0, ...(p.rank !== null && p.rank <= 10 ? { rank: p.rank } : {}) },
      };
    }),
  };
}

function scoreColor(): maplibregl.ExpressionSpecification {
  return ['step', ['coalesce', ['get', 'score'], 0], ...SCORE_STOPS.flatMap(([v, c], i) => (i === 0 ? [c] : [v, c]))] as unknown as maplibregl.ExpressionSpecification;
}

function layers(theme: 'light' | 'dark'): maplibregl.LayerSpecification[] {
  const scored: maplibregl.ExpressionSpecification = ['==', ['get', 'scored'], true];
  return [
    {
      id: 'op-wards-fill',
      type: 'fill',
      source: 'op-wards',
      paint: {
        'fill-color': ['case', scored, scoreColor(), UNSCORED[theme]],
        'fill-opacity': ['case', ['boolean', ['feature-state', 'hover'], false], 0.78, ['case', scored, 0.58, 0.28]],
      },
    },
    { id: 'op-wards-line', type: 'line', source: 'op-wards', paint: { 'line-color': OUTLINE[theme], 'line-width': ['interpolate', ['linear'], ['zoom'], 9, 0.6, 13, 1.6] } },
    { id: 'op-wards-compare', type: 'line', source: 'op-wards', filter: ['in', ['get', 'slug'], ['literal', []]], paint: { 'line-color': COMPARE, 'line-width': 2.6, 'line-dasharray': [2, 1.2] } },
    { id: 'op-wards-selected', type: 'line', source: 'op-wards', filter: ['in', ['get', 'slug'], ['literal', []]], paint: { 'line-color': SELECTED[theme], 'line-width': 3.2 } },
    {
      id: 'op-places',
      type: 'circle',
      source: 'op-places',
      paint: {
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 10, 3, 15, 6],
        'circle-color': '#e11d48',
        'circle-stroke-color': '#ffffff',
        'circle-stroke-width': 1.4,
      },
    },
  ];
}

const FALLBACK: maplibregl.StyleSpecification = { version: 8, sources: {}, layers: [{ id: 'background', type: 'background', paint: { 'background-color': '#e7edf3' } }] };
const baseStyles = new Map<'light' | 'dark', Promise<maplibregl.StyleSpecification>>();
function loadBase(theme: 'light' | 'dark'): Promise<maplibregl.StyleSpecification> {
  let style = baseStyles.get(theme);
  if (!style) {
    // A hung download must not keep the map from appearing: give up after 8 s and use a plain background.
    style = fetch(BASE_STYLE_URL[theme], { signal: AbortSignal.timeout(8000) })
      .then((res) => (res.ok ? (res.json() as Promise<maplibregl.StyleSpecification>) : Promise.reject(new Error(`HTTP ${res.status}`))))
      .catch(() => {
        baseStyles.delete(theme);
        return FALLBACK;
      });
    baseStyles.set(theme, style);
  }
  return style;
}

function compose(base: maplibregl.StyleSpecification, theme: 'light' | 'dark', wards?: GeoJSON.FeatureCollection, places?: GeoJSON.FeatureCollection): maplibregl.StyleSpecification {
  const ours = layers(theme);
  // Ward colours go under the base map's labels, so street and place names stay readable.
  const firstLabel = base.layers.findIndex((l) => l.type === 'symbol');
  const fill = ours.filter((l) => l.id !== 'op-places');
  const top = ours.filter((l) => l.id === 'op-places');
  const baseLayers = base.layers;
  // Ward names go on top of the base map's labels, so they win where labels collide (needs the base map's fonts).
  const names = base.glyphs ? [labelLayer(theme)] : [];
  return {
    ...base,
    sources: {
      ...base.sources,
      'op-wards': { type: 'geojson', data: wards ?? EMPTY, promoteId: 'slug' },
      'op-places': { type: 'geojson', data: places ?? EMPTY },
      'op-labels': { type: 'geojson', data: labelPoints(wards) },
    },
    layers: firstLabel >= 0 ? [...baseLayers.slice(0, firstLabel), ...fill, ...baseLayers.slice(firstLabel), ...top, ...names] : [...baseLayers, ...fill, ...top, ...names],
  };
}

/**
 * MapLibre map of the Business Opportunity Map: wards coloured by opportunity score, rank badges for the best
 * wards of the selected type, the selected/compared wards outlined, and competitor places. Purely presentational.
 */
@Component({
  selector: 'op-map',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  template: `<div #host class="op-map__host" role="application" [attr.aria-label]="ariaLabel()"></div>`,
  styles: [
    `
      op-map {
        display: block;
        position: absolute;
        inset: 0;
      }
      .op-map__host {
        position: absolute;
        inset: 0;
      }
      .op-rank {
        display: grid;
        place-items: center;
        min-width: 26px;
        height: 26px;
        padding: 0 6px;
        border-radius: 999px;
        border: 2px solid #fff;
        background: #0f172a;
        color: #fff;
        font: 800 12px/1 'Manrope', -apple-system, 'Segoe UI', sans-serif;
        box-shadow: 0 3px 10px rgba(0, 0, 0, 0.3);
        cursor: pointer;
      }
      .op-rank.is-top {
        background: #0f9f6e;
      }
      .op-map__host .maplibregl-popup-content {
        padding: 8px 11px;
        border-radius: 10px;
        font: 600 12.5px/1.4 'Manrope', -apple-system, 'Segoe UI', sans-serif;
        color: #0f172a;
      }
    `,
  ],
})
export class OpMapComponent implements AfterViewInit, OnDestroy {
  private readonly zone = inject(NgZone);
  @ViewChild('host', { static: true }) private host!: ElementRef<HTMLDivElement>;

  readonly wards = input<WardsResponse | null>(null);
  readonly places = input<GeoJSON.FeatureCollection | null>(null);
  readonly selected = input<string | null>(null);
  readonly compare = input<readonly string[]>([]);
  readonly theme = input<'light' | 'dark'>('light');
  /** Change the token to fly to the selected ward. */
  readonly flyToken = input(0);
  readonly ariaLabel = input('');
  readonly wardSelect = output<string>();

  private map?: maplibregl.Map;
  private readonly ready = signal(false);
  private styleTheme?: 'light' | 'dark';
  private ranks: maplibregl.Marker[] = [];
  private hovered: string | null = null;
  private lastFly = 0;
  private destroyed = false;

  constructor() {
    effect(() => {
      const wards = this.wards();
      if (this.ready()) untracked(() => this.applyWards(wards));
    });
    effect(() => {
      const places = this.places();
      if (this.ready()) untracked(() => (this.map?.getSource('op-places') as maplibregl.GeoJSONSource | undefined)?.setData(places ?? EMPTY));
    });
    effect(() => {
      const selected = this.selected();
      const compare = this.compare();
      if (this.ready()) untracked(() => this.applySelection(selected, compare));
    });
    effect(() => {
      const theme = this.theme();
      if (this.ready()) untracked(() => this.applyTheme(theme));
    });
    effect(() => {
      const token = this.flyToken();
      if (!this.ready() || token === this.lastFly) return;
      this.lastFly = token;
      untracked(() => this.flyToSelected());
    });
  }

  ngAfterViewInit(): void {
    const theme = this.theme();
    void loadBase(theme).then((base) => {
      if (this.destroyed) return;
      this.styleTheme = theme;
      this.zone.runOutsideAngular(() => {
        const map = new maplibregl.Map({
          container: this.host.nativeElement,
          style: compose(base, theme),
          bounds: HANOI_BOUNDS,
          fitBoundsOptions: { padding: this.padding() },
          minZoom: 8.5,
          maxZoom: 16,
          attributionControl: { compact: true },
        });
        this.map = map;
        map.on('click', 'op-wards-fill', (e) => {
          const slug = e.features?.[0]?.properties?.['slug'];
          if (typeof slug === 'string') this.zone.run(() => this.wardSelect.emit(slug));
        });
        map.on('mousemove', 'op-wards-fill', (e) => {
          const slug = (e.features?.[0]?.properties?.['slug'] as string | undefined) ?? null;
          map.getCanvas().style.cursor = slug ? 'pointer' : '';
          if (slug === this.hovered) return;
          if (this.hovered) map.setFeatureState({ source: 'op-wards', id: this.hovered }, { hover: false });
          if (slug) map.setFeatureState({ source: 'op-wards', id: slug }, { hover: true });
          this.hovered = slug;
        });
        map.on('mouseleave', 'op-wards-fill', () => {
          map.getCanvas().style.cursor = '';
          if (this.hovered) map.setFeatureState({ source: 'op-wards', id: this.hovered }, { hover: false });
          this.hovered = null;
        });
        map.on('click', 'op-places', (e) => {
          const f = e.features?.[0];
          if (!f || f.geometry.type !== 'Point') return;
          const name = (f.properties?.['name'] as string | null) || '—';
          const el = document.createElement('div');
          el.textContent = name;
          new maplibregl.Popup({ closeButton: false, offset: 8 }).setLngLat(f.geometry.coordinates as [number, number]).setDOMContent(el).addTo(map);
        });
        // Ready as soon as the style is (not 'load', which waits for every base-map tile).
        map.once('style.load', () => this.zone.run(() => this.ready.set(true)));
      });
    });
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    this.ranks.forEach((m) => m.remove());
    this.map?.remove();
  }

  zoomBy(delta: number): void {
    this.map?.easeTo({ zoom: this.map.getZoom() + delta, duration: 250 });
  }

  overview(): void {
    this.map?.fitBounds(HANOI_BOUNDS, { padding: this.padding(), duration: 800 });
  }

  private padding(): maplibregl.PaddingOptions {
    const w = this.host.nativeElement.clientWidth;
    if (w >= 1100) return { left: 380, right: 400, top: 30, bottom: 40 };
    if (w >= 700) return { left: 20, right: 20, top: 120, bottom: 220 };
    return { left: 8, right: 8, top: 110, bottom: 260 };
  }

  private applyWards(wards: WardsResponse | null): void {
    const map = this.map;
    if (!map) return;
    (map.getSource('op-wards') as maplibregl.GeoJSONSource | undefined)?.setData(wards ?? EMPTY);
    (map.getSource('op-labels') as maplibregl.GeoJSONSource | undefined)?.setData(labelPoints(wards));
    this.ranks.forEach((m) => m.remove());
    this.ranks = [];
    // Rank badges for the ten best wards of the selected type.
    if (wards?.meta.type) {
      const best = wards.features
        .map((f) => f.properties as unknown as WardProps)
        .filter((p) => p.rank !== null && p.rank <= 10)
        .sort((a, b) => (a.rank ?? 0) - (b.rank ?? 0));
      for (const p of best) {
        const el = document.createElement('button');
        el.type = 'button';
        el.className = `op-rank${p.rank === 1 ? ' is-top' : ''}`;
        el.textContent = String(p.rank);
        el.title = `${p.name}: ${p.score}`;
        el.addEventListener('click', (event) => {
          event.stopPropagation();
          this.zone.run(() => this.wardSelect.emit(p.slug));
        });
        this.ranks.push(new maplibregl.Marker({ element: el }).setLngLat([p.lng, p.lat]).addTo(map));
      }
    }
    this.applySelection(this.selected(), this.compare());
  }

  private applySelection(selected: string | null, compare: readonly string[]): void {
    const map = this.map;
    if (!map) return;
    if (map.getLayer('op-wards-selected')) map.setFilter('op-wards-selected', ['in', ['get', 'slug'], ['literal', selected ? [selected] : []]]);
    if (map.getLayer('op-wards-compare')) map.setFilter('op-wards-compare', ['in', ['get', 'slug'], ['literal', [...compare]]]);
  }

  private flyToSelected(): void {
    const slug = this.selected();
    const f = this.wards()?.features.find((x) => (x.properties as unknown as WardProps).slug === slug);
    if (!f || !this.map) return;
    const p = f.properties as unknown as WardProps;
    this.map.flyTo({ center: [p.lng, p.lat], zoom: Math.max(this.map.getZoom(), 12.3), padding: this.padding(), duration: 900 });
  }

  private applyTheme(theme: 'light' | 'dark'): void {
    if (theme === this.styleTheme) return;
    this.styleTheme = theme;
    void loadBase(theme).then((base) => {
      const map = this.map;
      if (!map || this.styleTheme !== theme) return;
      map.once('style.load', () => this.applySelection(this.selected(), this.compare()));
      map.setStyle(compose(base, theme, this.wards() ?? undefined, this.places() ?? undefined), { diff: false });
    });
  }
}
