import { AfterViewInit, ChangeDetectionStrategy, Component, ElementRef, NgZone, OnDestroy, ViewChild, ViewEncapsulation, effect, inject, input, output, signal, untracked } from '@angular/core';
import * as maplibregl from 'maplibre-gl';
import { Marker, NO_DATA, RAMP } from './career.jobmap';

/** OpenFreeMap vector base maps (OpenStreetMap data, no key), the same as the other maps of the site. */
const BASE_STYLE_URL: Record<'light' | 'dark', string> = {
  light: 'https://tiles.openfreemap.org/styles/positron',
  dark: 'https://tiles.openfreemap.org/styles/dark',
};
/** The wards only, and the wards with the planned poles (Hòa Lạc, Sơn Tây… lie further out). */
const WARD_BOUNDS: maplibregl.LngLatBoundsLike = [[105.66, 20.86], [106.01, 21.24]];
const POLE_BOUNDS: maplibregl.LngLatBoundsLike = [[105.4, 20.68], [106.03, 21.27]];
const EMPTY: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] };
const OUTLINE = { light: '#ffffff', dark: '#0b1220' };
const SELECTED = { light: '#0f172a', dark: '#ffffff' };
const HOME = '#2563eb';
const NOW = '#2563eb';
const PLAN = '#f59e0b';
const LABEL = { light: { text: '#0f172a', halo: 'rgba(255,255,255,0.92)' }, dark: { text: '#f1f5f9', halo: 'rgba(8,13,24,0.9)' } };
/** What the colours show: a sector's places per ward (class `cls`), or how a ward is served by metro (`mc`). */
export type MapMode = 'sector' | 'metro';
/** Metro colours: on a line shared with home, served by another line, not served (grey). */
export const METRO_COLORS = { same: '#16a34a', any: '#38bdf8' };

function fillColor(mode: MapMode): maplibregl.ExpressionSpecification {
  if (mode === 'metro') return ['match', ['get', 'mc'], 'same', METRO_COLORS.same, 'any', METRO_COLORS.any, NO_DATA] as unknown as maplibregl.ExpressionSpecification;
  return ['case', ['has', 'cls'], ['step', ['get', 'cls'], RAMP[0], 1, RAMP[1], 2, RAMP[2], 3, RAMP[3], 4, RAMP[4]], NO_DATA] as unknown as maplibregl.ExpressionSpecification;
}

function fillOpacity(mode: MapMode): maplibregl.ExpressionSpecification {
  const hover: maplibregl.ExpressionSpecification = ['boolean', ['feature-state', 'hover'], false];
  if (mode === 'metro') return ['case', hover, 0.88, ['==', ['get', 'mc'], 'none'], 0.3, 0.78] as unknown as maplibregl.ExpressionSpecification;
  // Wards outside the zone you can reach from home fade out (`out`).
  return ['case', hover, 0.88, ['==', ['get', 'out'], true], 0.12, ['has', 'cls'], 0.72, 0.3] as unknown as maplibregl.ExpressionSpecification;
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

/** One point per ward for the names (the polygon source would label every tile piece). */
function labelPoints(wards: GeoJSON.FeatureCollection | null): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: (wards?.features ?? []).map((f) => {
      const p = f.properties as { name?: string; lng?: number; lat?: number; population?: number | null };
      return {
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [p.lng ?? 0, p.lat ?? 0] },
        properties: { label: String(p.name ?? '').replace(/^(Phường|Xã)\s+/, ''), population: p.population ?? 0 },
      };
    }),
  };
}

function markerPoints(markers: readonly Marker[]): GeoJSON.FeatureCollection {
  return { type: 'FeatureCollection', features: markers.map((m) => ({ type: 'Feature', geometry: { type: 'Point', coordinates: m.lngLat }, properties: { id: m.id, name: m.name, short: m.name.replace(/^(?:Cực[^:]*|[^:]*\bpole):\s*/, ''), kind: m.kind } })) };
}

function layers(theme: 'light' | 'dark', glyphs: boolean, mode: MapMode): { fill: maplibregl.LayerSpecification[]; top: maplibregl.LayerSpecification[] } {
  const none: maplibregl.FilterSpecification = ['in', ['get', 'slug'], ['literal', []]];
  const fill: maplibregl.LayerSpecification[] = [
    { id: 'jm-fill', type: 'fill', source: 'jm-wards', paint: { 'fill-color': fillColor(mode), 'fill-opacity': fillOpacity(mode) } },
    { id: 'jm-line', type: 'line', source: 'jm-wards', paint: { 'line-color': OUTLINE[theme], 'line-width': ['interpolate', ['linear'], ['zoom'], 9, 0.6, 13, 1.6] } },
    { id: 'jm-home', type: 'line', source: 'jm-wards', filter: none, paint: { 'line-color': HOME, 'line-width': 3.2, 'line-dasharray': [2, 1.2] } },
    { id: 'jm-selected', type: 'line', source: 'jm-wards', filter: none, paint: { 'line-color': SELECTED[theme], 'line-width': 3.2 } },
  ];
  const top: maplibregl.LayerSpecification[] = [
    {
      id: 'jm-markers',
      type: 'circle',
      source: 'jm-markers',
      paint: {
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 8, 5, 12, 8],
        'circle-color': ['match', ['get', 'kind'], 'plan', PLAN, NOW],
        'circle-stroke-color': '#ffffff',
        'circle-stroke-width': 2,
      },
    },
  ];
  if (glyphs) {
    top.push(
      {
        id: 'jm-ward-names',
        type: 'symbol',
        source: 'jm-labels',
        minzoom: 10.6,
        layout: { 'text-field': ['get', 'label'], 'text-font': ['Noto Sans Regular'], 'text-size': ['interpolate', ['linear'], ['zoom'], 10.6, 9, 13, 12], 'text-max-width': 5, 'symbol-sort-key': ['-', 0, ['coalesce', ['get', 'population'], 0]] },
        paint: { 'text-color': LABEL[theme].text, 'text-halo-color': LABEL[theme].halo, 'text-halo-width': 1.6 },
      },
      {
        id: 'jm-marker-names',
        type: 'symbol',
        source: 'jm-markers',
        layout: { 'text-field': ['get', 'short'], 'text-font': ['Noto Sans Regular'], 'text-size': 11.5, 'text-max-width': 9, 'text-offset': [0, 1.1], 'text-anchor': 'top', 'text-optional': true },
        paint: { 'text-color': LABEL[theme].text, 'text-halo-color': LABEL[theme].halo, 'text-halo-width': 1.8 },
      },
    );
  }
  return { fill, top };
}

function compose(base: maplibregl.StyleSpecification, theme: 'light' | 'dark', wards: GeoJSON.FeatureCollection | null, markers: readonly Marker[], showMarkers: boolean, mode: MapMode): maplibregl.StyleSpecification {
  const { fill, top } = layers(theme, Boolean(base.glyphs), mode);
  const visibility = showMarkers ? 'visible' : 'none';
  const topLayers = top.map((l) => (l.id.startsWith('jm-marker') ? ({ ...l, layout: { ...(l.layout ?? {}), visibility } } as maplibregl.LayerSpecification) : l));
  // The colours go under the base map's labels, so street and place names stay readable.
  const firstLabel = base.layers.findIndex((l) => l.type === 'symbol');
  return {
    ...base,
    sources: {
      ...base.sources,
      'jm-wards': { type: 'geojson', data: wards ?? EMPTY, promoteId: 'slug' },
      'jm-labels': { type: 'geojson', data: labelPoints(wards) },
      'jm-markers': { type: 'geojson', data: markerPoints(markers) },
    },
    layers: firstLabel >= 0 ? [...base.layers.slice(0, firstLabel), ...fill, ...base.layers.slice(firstLabel), ...topLayers] : [...base.layers, ...fill, ...topLayers],
  };
}

/**
 * Map of the job map: wards coloured by how many places of a sector the map has there (classes are decided by the
 * parent and arrive as `cls` on each ward), the planned poles and reference places as points, the chosen ward and the
 * ward the visitor lives in outlined. Purely presentational.
 */
@Component({
  selector: 'app-job-map',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  template: `<div #host class="jm__host" role="application" [attr.aria-label]="ariaLabel()"></div>`,
  styles: [
    `
      app-job-map {
        display: block;
        position: relative;
        width: 100%;
        height: 100%;
      }
      .jm__host {
        position: absolute;
        inset: 0;
      }
    `,
  ],
})
export class JobMapComponent implements AfterViewInit, OnDestroy {
  private readonly zone = inject(NgZone);
  @ViewChild('host', { static: true }) private host!: ElementRef<HTMLDivElement>;

  /** Ward polygons, each with its class in `cls` (absent: no data), `out` (outside the zone) and `mc` (metro). */
  readonly wards = input<GeoJSON.FeatureCollection | null>(null);
  readonly mode = input<MapMode>('sector');
  readonly markers = input<readonly Marker[]>([]);
  readonly showMarkers = input(true);
  readonly selected = input<string | null>(null);
  readonly home = input<string | null>(null);
  readonly theme = input<'light' | 'dark'>('light');
  readonly ariaLabel = input('');
  readonly wardSelect = output<string>();

  private map?: maplibregl.Map;
  private readonly ready = signal(false);
  private styleTheme?: 'light' | 'dark';
  private hovered: string | null = null;
  private destroyed = false;
  private resizer?: ResizeObserver;

  constructor() {
    effect(() => {
      const wards = this.wards();
      if (this.ready()) untracked(() => this.applyWards(wards));
    });
    effect(() => {
      const mode = this.mode();
      if (this.ready()) untracked(() => this.applyMode(mode));
    });
    effect(() => {
      const show = this.showMarkers();
      if (this.ready()) untracked(() => this.applyMarkers(show));
    });
    effect(() => {
      const selected = this.selected();
      const home = this.home();
      if (this.ready()) untracked(() => this.applyOutlines(selected, home));
    });
    effect(() => {
      const theme = this.theme();
      if (this.ready()) untracked(() => this.applyTheme(theme));
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
          style: compose(base, theme, this.wards(), this.markers(), this.showMarkers(), this.mode()),
          bounds: this.showMarkers() ? POLE_BOUNDS : WARD_BOUNDS,
          fitBoundsOptions: { padding: 24 },
          minZoom: 8,
          maxZoom: 15,
          attributionControl: { compact: true },
        });
        this.map = map;
        // The map sits in a tab: when it is shown again (or the window changes) its size changes.
        this.resizer = new ResizeObserver(() => map.resize());
        this.resizer.observe(this.host.nativeElement);
        map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
        map.on('click', 'jm-fill', (e) => {
          const slug = e.features?.[0]?.properties?.['slug'];
          if (typeof slug === 'string') this.zone.run(() => this.wardSelect.emit(slug));
        });
        map.on('mousemove', 'jm-fill', (e) => {
          const slug = (e.features?.[0]?.properties?.['slug'] as string | undefined) ?? null;
          map.getCanvas().style.cursor = slug ? 'pointer' : '';
          if (slug === this.hovered) return;
          if (this.hovered) map.setFeatureState({ source: 'jm-wards', id: this.hovered }, { hover: false });
          if (slug) map.setFeatureState({ source: 'jm-wards', id: slug }, { hover: true });
          this.hovered = slug;
        });
        map.on('mouseleave', 'jm-fill', () => {
          map.getCanvas().style.cursor = '';
          if (this.hovered) map.setFeatureState({ source: 'jm-wards', id: this.hovered }, { hover: false });
          this.hovered = null;
        });
        map.on('click', 'jm-markers', (e) => {
          const f = e.features?.[0];
          if (!f || f.geometry.type !== 'Point') return;
          const el = document.createElement('div');
          el.textContent = String(f.properties?.['name'] ?? '');
          el.style.cssText = "font: 600 12.5px/1.4 'Manrope', sans-serif; color: #0f172a;";
          new maplibregl.Popup({ closeButton: false, offset: 10 }).setLngLat(f.geometry.coordinates as [number, number]).setDOMContent(el).addTo(map);
        });
        // Ready as soon as the style is (not 'load', which waits for every base-map tile).
        map.once('style.load', () => this.zone.run(() => this.ready.set(true)));
      });
    });
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    this.resizer?.disconnect();
    this.map?.remove();
  }

  private applyWards(wards: GeoJSON.FeatureCollection | null): void {
    (this.map?.getSource('jm-wards') as maplibregl.GeoJSONSource | undefined)?.setData(wards ?? EMPTY);
    (this.map?.getSource('jm-labels') as maplibregl.GeoJSONSource | undefined)?.setData(labelPoints(wards));
    this.applyOutlines(this.selected(), this.home());
  }

  private applyMode(mode: MapMode): void {
    const map = this.map;
    if (!map?.getLayer('jm-fill')) return;
    map.setPaintProperty('jm-fill', 'fill-color', fillColor(mode));
    map.setPaintProperty('jm-fill', 'fill-opacity', fillOpacity(mode));
  }

  private applyMarkers(show: boolean): void {
    const map = this.map;
    if (!map) return;
    for (const id of ['jm-markers', 'jm-marker-names']) if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', show ? 'visible' : 'none');
    map.fitBounds(show ? POLE_BOUNDS : WARD_BOUNDS, { padding: 24, duration: 700 });
  }

  private applyOutlines(selected: string | null, home: string | null): void {
    const map = this.map;
    if (!map) return;
    if (map.getLayer('jm-selected')) map.setFilter('jm-selected', ['in', ['get', 'slug'], ['literal', selected ? [selected] : []]]);
    if (map.getLayer('jm-home')) map.setFilter('jm-home', ['in', ['get', 'slug'], ['literal', home ? [home] : []]]);
  }

  private applyTheme(theme: 'light' | 'dark'): void {
    if (theme === this.styleTheme) return;
    this.styleTheme = theme;
    void loadBase(theme).then((base) => {
      const map = this.map;
      if (!map || this.styleTheme !== theme) return;
      map.once('style.load', () => this.applyOutlines(this.selected(), this.home()));
      map.setStyle(compose(base, theme, this.wards(), this.markers(), this.showMarkers(), this.mode()), { diff: false });
    });
  }
}
