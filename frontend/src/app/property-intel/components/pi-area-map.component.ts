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
  untracked,
} from '@angular/core';
import * as maplibregl from 'maplibre-gl';
import { PI_TEXT, PiText } from '../pi-i18n';
import { Basemap, LayerKey, Lens, MapLayers } from '../pi.models';
import { LABEL_FONT, PiPalette, baseStyle, firstSymbolLayer, overlayPalette } from './pi-map-style';

const HANOI_CENTER: [number, number] = [105.85, 21.03];
const EMPTY: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] };
const SOURCES = ['wards', 'labels', 'metro', 'stations', 'tod', 'infrastructure', 'planning', 'projects', 'social', 'green'] as const;
type SourceId = (typeof SOURCES)[number];

/** Overlay layer ids → the layer-panel toggle that shows them (undefined = always on). */
const LAYER_TOGGLES: Record<string, LayerKey | undefined> = {
  'pi-density': 'density',
  'pi-lens': undefined,
  'pi-ward-line': undefined,
  'pi-planning-fill': 'planning',
  'pi-planning-line': 'planning',
  'pi-development': 'development',
  'pi-development-line': 'development',
  'pi-green': 'green',
  'pi-tod-fill': 'tod',
  'pi-tod-line': 'tod',
  'pi-infra': 'infrastructure',
  'pi-infra-dashed': 'infrastructure',
  'pi-metro': 'metro',
  'pi-metro-dashed': 'metro',
  'pi-stations': 'metro',
  'pi-social': 'social',
  'pi-projects': 'projects',
  'pi-selected-line': undefined,
  'pi-ward-labels': undefined,
};
/** Layers that go under the base map's labels; the rest are drawn on top. */
const UNDER_LABELS = new Set(['pi-density', 'pi-lens', 'pi-ward-line', 'pi-planning-fill', 'pi-planning-line', 'pi-development', 'pi-development-line', 'pi-green', 'pi-tod-fill', 'pi-tod-line']);

const LENS_FIELD: Record<Lens, string> = { potential: 'score', connectivity: 'connectivity', infrastructure: 'infrastructure', landPrice: 'landPrice' };
/** Land price stops (million VND/m², ward median VT1): 10 → 300 on a roughly logarithmic scale. */
export const LAND_STOPS = [10, 30, 60, 120, 250] as const;

/**
 * MapLibre map for the Map Intelligence dashboard. Purely presentational: the parent passes the GeoJSON layers,
 * toggles, basemap, lens, theme, language and selection; clicks come back as outputs.
 */
@Component({
  selector: 'pi-area-map',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  template: `<div #host class="pi-map__host" role="application" [attr.aria-label]="text().mapAria"></div>`,
  styles: [
    `
      pi-area-map {
        position: absolute;
        inset: 0;
        display: block;
      }
      .pi-map__host {
        position: absolute;
        inset: 0;
        background: var(--pi-map);
      }
      .pi-map-callout {
        display: flex;
        flex-direction: column;
        gap: 6px;
        padding: 10px 12px;
        border-radius: 8px;
        background: var(--pi-glass);
        backdrop-filter: blur(10px);
        border: 1px solid color-mix(in srgb, var(--pi-green) 55%, transparent);
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
        color: var(--pi-ink);
        cursor: default;
        pointer-events: none;
      }
      .pi-map-callout b {
        font: 700 13px var(--pi-font-display);
        letter-spacing: 0.04em;
      }
      .pi-map-callout span {
        display: flex;
        gap: 10px;
        font: 500 11px var(--pi-font-mono);
        color: var(--pi-dim);
        white-space: nowrap;
      }
      .pi-map-callout em {
        font-style: normal;
        color: var(--pi-green);
      }
    `,
  ],
})
export class PiAreaMapComponent implements AfterViewInit, OnDestroy {
  readonly data = input<MapLayers | null>(null);
  readonly toggles = input.required<Record<LayerKey, boolean>>();
  readonly basemap = input<Basemap>('map');
  readonly lens = input<Lens>('potential');
  readonly theme = input<'light' | 'dark'>('dark');
  readonly selected = input<string | null>(null);
  readonly text = input<PiText>(PI_TEXT.vi);
  readonly lang = input<'vi' | 'en'>('vi');
  /** Pixels on the right covered by the floating AI panel, so fitBounds centres in what is visible. */
  readonly rightInset = input(0);

  readonly selectWard = output<string>();
  readonly selectProject = output<string>();

  @ViewChild('host', { static: true }) private host!: ElementRef<HTMLDivElement>;
  private readonly zone = inject(NgZone);
  private map?: maplibregl.Map;
  private ready = false;
  private framed = false;
  /** Increments on every basemap load, so a slow style that arrives late is ignored. */
  private styleToken = 0;
  private beforeLabels?: string;
  private callout?: maplibregl.Marker;
  private hoverPopup?: maplibregl.Popup;
  private palette: PiPalette = overlayPalette('dark');

  constructor() {
    effect(() => {
      const data = this.data();
      untracked(() => this.ready && this.applyData(data));
    });
    effect(() => {
      this.lens();
      untracked(() => this.ready && this.applyLens());
    });
    effect(() => {
      this.basemap();
      this.theme();
      untracked(() => this.map && this.loadBase());
    });
    effect(() => {
      this.toggles();
      untracked(() => this.ready && this.applyVisibility());
    });
    effect(() => {
      const slug = this.selected();
      this.text();
      untracked(() => this.ready && this.applySelection(slug, true));
    });
  }

  ngAfterViewInit(): void {
    this.zone.runOutsideAngular(() => {
      this.map = new maplibregl.Map({
        container: this.host.nativeElement,
        style: { version: 8, sources: {}, layers: [{ id: 'background', type: 'background', paint: { 'background-color': this.theme() === 'dark' ? '#0e1826' : '#e7edf3' } }] },
        center: HANOI_CENTER,
        zoom: 11,
        minZoom: 8.5,
        maxZoom: 17,
        attributionControl: { compact: true },
      });
      this.bindInteractions();
      this.loadBase();
    });
  }

  ngOnDestroy(): void {
    this.map?.remove();
  }

  zoomIn(): void {
    this.map?.zoomIn();
  }

  zoomOut(): void {
    this.map?.zoomOut();
  }

  /** Tilts the map for a pseudo-3D view; returns whether 3D is now on. */
  toggle3d(): boolean {
    if (!this.map) return false;
    const on = this.map.getPitch() < 10;
    this.map.easeTo({ pitch: on ? 55 : 0, bearing: on ? -18 : 0, duration: 700 });
    return on;
  }

  // ------------------------------------------------------------------ basemap

  /** Loads the basemap style, then (re)creates every overlay on top of it. */
  private loadBase(): void {
    const map = this.map!;
    const token = ++this.styleToken;
    void baseStyle(this.basemap(), this.theme()).then((style) => {
      if (token !== this.styleToken) return;
      this.ready = false;
      this.beforeLabels = firstSymbolLayer(style);
      map.setStyle(style, { diff: false });
      // `style.load`, not `load`: one hung base tile must not keep the data layers from appearing.
      map.once('style.load', () => {
        if (token !== this.styleToken) return;
        for (const id of SOURCES) map.addSource(id, { type: 'geojson', data: EMPTY, ...(id === 'wards' ? { promoteId: 'slug' } : {}) });
        this.ready = true;
        this.addOverlays();
        this.applyData(this.data());
      });
    });
  }

  // ------------------------------------------------------------------ data

  private applyData(data: MapLayers | null): void {
    const map = this.map!;
    const l = data?.layers;
    for (const id of SOURCES) (map.getSource(id) as maplibregl.GeoJSONSource | undefined)?.setData((l?.[id as SourceId] as GeoJSON.FeatureCollection | undefined) ?? EMPTY);
    // Frame the selected ward the first time data arrives; later horizon switches keep the view.
    this.applySelection(this.selected(), !!l && !this.framed);
    if (l) this.framed = true;
  }

  private lensColor(): maplibregl.ExpressionSpecification {
    const p = this.palette;
    if (this.lens() === 'landPrice') {
      const [a, b, c, d, e] = LAND_STOPS;
      // Wards without a land price (−1) stay uncoloured.
      return ['case', ['<', ['get', 'landPrice'], 0], 'rgba(0,0,0,0)', ['interpolate', ['linear'], ['get', 'landPrice'], a, p.green, b, p.yellow, c, p.amber, d, p.red, e, p.violet]];
    }
    return ['interpolate', ['linear'], ['get', LENS_FIELD[this.lens()]], 0, p.dim, 35, p.yellow, 60, p.cyan, 85, p.green];
  }

  private applyLens(): void {
    if (this.map?.getLayer('pi-lens')) this.map.setPaintProperty('pi-lens', 'fill-color', this.lensColor());
  }

  /** Creates every overlay layer on the current basemap. */
  private addOverlays(): void {
    const map = this.map!;
    this.palette = overlayPalette(this.theme());
    const p = this.palette;
    const add = (layer: maplibregl.LayerSpecification) => map.addLayer(layer, UNDER_LABELS.has(layer.id) ? this.beforeLabels : undefined);

    add({
      id: 'pi-density',
      type: 'fill',
      source: 'wards',
      filter: ['>=', ['get', 'density'], 0],
      paint: { 'fill-color': p.violet, 'fill-opacity': ['interpolate', ['linear'], ['get', 'density'], 0, 0.04, 10000, 0.22, 40000, 0.5] },
    });
    add({ id: 'pi-lens', type: 'fill', source: 'wards', paint: { 'fill-color': this.lensColor(), 'fill-opacity': 0.24 } });
    add({ id: 'pi-ward-line', type: 'line', source: 'wards', paint: { 'line-color': p.outline, 'line-width': ['interpolate', ['linear'], ['zoom'], 9, 0.5, 13, 1.3] } });
    add({
      id: 'pi-planning-fill',
      type: 'fill',
      source: 'planning',
      filter: ['==', ['get', 'kind'], 'zone'],
      paint: { 'fill-color': p.amber, 'fill-opacity': ['match', ['get', 'status'], 'active', 0.1, 0.05] },
    });
    add({
      id: 'pi-planning-line',
      type: 'line',
      source: 'planning',
      filter: ['==', ['get', 'kind'], 'zone'],
      paint: { 'line-color': p.amber, 'line-width': 1.4, 'line-dasharray': [4, 2], 'line-opacity': ['match', ['get', 'status'], 'active', 0.9, 0.5] },
    });
    add({ id: 'pi-development', type: 'fill', source: 'planning', filter: ['==', ['get', 'kind'], 'development'], paint: { 'fill-color': p.amber, 'fill-opacity': 0.28 } });
    add({ id: 'pi-development-line', type: 'line', source: 'planning', filter: ['==', ['get', 'kind'], 'development'], paint: { 'line-color': p.amber, 'line-width': 1, 'line-opacity': 0.8 } });
    add({
      id: 'pi-green',
      type: 'circle',
      source: 'green',
      paint: {
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 10, ['interpolate', ['linear'], ['get', 'ha'], 0, 2, 50, 8], 15, ['interpolate', ['linear'], ['get', 'ha'], 0, 6, 50, 40]],
        'circle-color': p.park,
        'circle-opacity': 0.45,
      },
    });
    add({ id: 'pi-tod-fill', type: 'fill', source: 'tod', paint: { 'fill-color': p.cyan, 'fill-opacity': ['match', ['get', 'status'], 'active', 0.1, 0.04] } });
    add({
      id: 'pi-tod-line',
      type: 'line',
      source: 'tod',
      paint: { 'line-color': p.cyan, 'line-width': 1.1, 'line-dasharray': [3, 3], 'line-opacity': ['match', ['get', 'status'], 'active', 0.85, 0.45] },
    });

    const solid = ['==', ['get', 'status'], 'operating'] as maplibregl.FilterSpecification;
    add({
      id: 'pi-infra',
      type: 'line',
      source: 'infrastructure',
      filter: ['==', ['get', 'status'], 'open'],
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': p.amber, 'line-width': 3.5, 'line-opacity': 0.9 },
    });
    add({
      id: 'pi-infra-dashed',
      type: 'line',
      source: 'infrastructure',
      filter: ['!=', ['get', 'status'], 'open'],
      layout: { 'line-join': 'round' },
      paint: { 'line-color': p.amber, 'line-width': 3, 'line-opacity': 0.75, 'line-dasharray': [2.5, 1.5] },
    });
    const metroColor: maplibregl.ExpressionSpecification = ['coalesce', ['get', 'color'], p.cyan];
    add({ id: 'pi-metro', type: 'line', source: 'metro', filter: solid, layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': metroColor, 'line-width': 4 } });
    add({
      id: 'pi-metro-dashed',
      type: 'line',
      source: 'metro',
      filter: ['!', solid] as maplibregl.FilterSpecification,
      layout: { 'line-join': 'round' },
      paint: { 'line-color': metroColor, 'line-width': 3, 'line-opacity': ['match', ['get', 'status'], 'building', 0.9, 0.55], 'line-dasharray': [2, 1.5] },
    });
    add({
      id: 'pi-stations',
      type: 'circle',
      source: 'stations',
      paint: {
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 10, 3.5, 14, 6],
        'circle-color': ['match', ['get', 'status'], 'operating', p.bg, p.cyan],
        'circle-stroke-color': ['match', ['get', 'status'], 'operating', p.cyan, p.bg],
        'circle-stroke-width': 2.2,
      },
    });
    add({
      id: 'pi-social',
      type: 'circle',
      source: 'social',
      minzoom: 11.5,
      paint: {
        'circle-radius': 4.5,
        'circle-color': 'rgba(0,0,0,0)',
        'circle-stroke-color': ['match', ['get', 'kind'], 'hospital', p.redSoft, p.ink2],
        'circle-stroke-width': 1.4,
      },
    });
    add({
      id: 'pi-projects',
      type: 'circle',
      source: 'projects',
      paint: { 'circle-radius': ['interpolate', ['linear'], ['zoom'], 10, 4, 14, 7], 'circle-color': p.projectDot, 'circle-stroke-color': p.amber, 'circle-stroke-width': 2 },
    });
    add({ id: 'pi-selected-line', type: 'line', source: 'wards', filter: ['==', ['get', 'slug'], ''], paint: { 'line-color': p.green, 'line-width': 2.6 } });
    add({
      id: 'pi-ward-labels',
      type: 'symbol',
      source: 'labels',
      layout: {
        'text-field': ['get', 'label'],
        'text-font': LABEL_FONT,
        'text-size': ['interpolate', ['linear'], ['zoom'], 9, 8.5, 10.5, 9.5, 12, 12, 14, 14],
        'text-max-width': 5,
        'text-line-height': 1.1,
        'text-padding': 0,
        'symbol-sort-key': ['-', 0, ['coalesce', ['get', 'population'], 0]],
      },
      paint: { 'text-color': p.ink, 'text-halo-color': p.halo, 'text-halo-width': 1.6 },
    });
    this.applyVisibility();
  }

  private applyVisibility(): void {
    const map = this.map!;
    const toggles = this.toggles();
    for (const [id, key] of Object.entries(LAYER_TOGGLES)) {
      if (!map.getLayer(id)) continue;
      map.setLayoutProperty(id, 'visibility', key === undefined || toggles[key] ? 'visible' : 'none');
    }
  }

  private applySelection(slug: string | null, fly: boolean): void {
    const map = this.map!;
    if (map.getLayer('pi-selected-line')) map.setFilter('pi-selected-line', ['==', ['get', 'slug'], slug ?? '']);
    if (map.getLayer('pi-lens')) map.setPaintProperty('pi-lens', 'fill-opacity', ['case', ['==', ['get', 'slug'], slug ?? ''], 0.42, 0.24]);
    this.callout?.remove();
    const ward = this.data()?.layers.wards.features.find((f) => (f.properties as { slug: string }).slug === slug);
    const label = this.data()?.layers.labels.features.find((f) => (f.properties as { slug: string }).slug === slug);
    if (!ward || !label) return;
    const props = label.properties as { name: string; score: number; rank: number };
    const land = (ward.properties as { landPrice: number }).landPrice;
    const el = document.createElement('div');
    el.className = 'pi-map-callout';
    const b = document.createElement('b');
    b.textContent = props.name;
    const line = document.createElement('span');
    const em = document.createElement('em');
    em.textContent = this.text().popup.ward(props.score, props.rank);
    line.append(em);
    if (land >= 0) {
      const lp = document.createElement('span');
      lp.textContent = this.text().popup.land(land.toLocaleString(this.lang() === 'en' ? 'en-US' : 'vi-VN'));
      line.append(lp);
    }
    el.append(b, line);
    const at = (label.geometry as GeoJSON.Point).coordinates as [number, number];
    this.callout = new maplibregl.Marker({ element: el, anchor: 'top-left', offset: [16, 14] }).setLngLat(at).addTo(map);
    if (fly) {
      const bounds = new maplibregl.LngLatBounds(at, at);
      const polys = ward.geometry.type === 'Polygon' ? [ward.geometry.coordinates] : (ward.geometry as GeoJSON.MultiPolygon).coordinates;
      for (const poly of polys) for (const c of poly[0]) bounds.extend(c as [number, number]);
      map.fitBounds(bounds, { padding: { top: 70, bottom: 60, left: 60, right: 60 + this.rightInset() }, maxZoom: 13.6, duration: this.framed ? 900 : 0 });
    }
  }

  // ------------------------------------------------------------------ interactions

  private bindInteractions(): void {
    const map = this.map!;
    const hoverable = ['pi-projects', 'pi-stations', 'pi-metro', 'pi-metro-dashed', 'pi-infra', 'pi-infra-dashed', 'pi-social', 'pi-green', 'pi-development', 'pi-planning-fill'];
    this.hoverPopup = new maplibregl.Popup({ closeButton: false, closeOnClick: false, offset: 10, maxWidth: '280px' });
    const visible = (id: string) => map.getLayer(id) && map.getLayoutProperty(id, 'visibility') !== 'none';

    map.on('mousemove', (e) => {
      if (!this.ready) return;
      const hit = map.queryRenderedFeatures(e.point, { layers: hoverable.filter(visible) })[0];
      const overWard = visible('pi-lens') && map.queryRenderedFeatures(e.point, { layers: ['pi-lens'] }).length > 0;
      map.getCanvas().style.cursor = hit?.layer.id === 'pi-projects' || overWard ? 'pointer' : '';
      if (!hit) {
        this.hoverPopup!.remove();
        return;
      }
      this.hoverPopup!.setLngLat(e.lngLat).setDOMContent(describe(hit, this.text())).addTo(map);
    });
    map.on('mouseout', () => this.hoverPopup?.remove());

    map.on('click', (e) => {
      if (!this.ready) return;
      const project = visible('pi-projects') ? map.queryRenderedFeatures(e.point, { layers: ['pi-projects'] })[0] : undefined;
      if (project) {
        const slug = (project.properties as { slug: string }).slug;
        this.zone.run(() => this.selectProject.emit(slug));
        return;
      }
      const ward = map.queryRenderedFeatures(e.point, { layers: ['pi-lens'] })[0];
      if (ward) {
        const slug = (ward.properties as { slug: string }).slug;
        this.zone.run(() => this.selectWard.emit(slug));
      }
    });
  }
}

function describe(f: maplibregl.MapGeoJSONFeature, t: PiText): HTMLElement {
  const p = f.properties as Record<string, string | number | boolean | null>;
  const el = document.createElement('div');
  const title = document.createElement('strong');
  title.textContent = String(p['name'] ?? '');
  el.append(title);
  const opens = typeof p['opens'] === 'number' ? (p['opens'] as number) : null;
  const schematic = p['schematic'] === true ? t.popup.schematic : '';
  const extra = (() => {
    switch (f.layer.id) {
      case 'pi-projects':
        return t.popup.project(String(p['price']), String(p['kind']));
      case 'pi-metro':
        return opens && opens > 2026 ? t.popup.metroExpected(opens) + schematic : t.popup.metroOperating;
      case 'pi-metro-dashed':
        return (p['status'] === 'building' ? t.popup.metroBuilding(opens) : t.popup.metroPlanned(opens)) + schematic;
      case 'pi-infra':
        return t.popup.infraOpen(opens);
      case 'pi-infra-dashed':
        return t.popup.infraBuilding(opens);
      case 'pi-planning-fill':
        return `${t.popup.pole(Number(p['from']))} · ${p['role'] ?? ''}`;
      case 'pi-development':
        return t.popup.site(Number(p['areaHa']));
      case 'pi-stations':
        return t.popup.station(String(p['line']), p['status'] !== 'operating');
      case 'pi-social':
        return p['kind'] === 'hospital' ? t.popup.hospital : t.popup.school;
      case 'pi-green':
        return t.popup.park(Number(p['ha']));
      default:
        return '';
    }
  })();
  if (extra) {
    const small = document.createElement('div');
    small.style.cssText = 'margin-top:2px;font:500 10.5px var(--pi-font-mono);color:var(--pi-dim)';
    small.textContent = extra;
    el.append(small);
  }
  return el;
}
