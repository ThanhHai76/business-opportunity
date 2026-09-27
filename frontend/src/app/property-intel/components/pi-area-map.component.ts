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
import { Basemap, LayerKey, Lens, MapLayers } from '../pi.models';
import { BASEMAPS, overlayPalette, PiPalette } from './pi-map-style';

const HANOI_CENTER: [number, number] = [105.87, 21.05];
const EMPTY: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] };
const SOURCES = ['districts', 'metro', 'stations', 'tod', 'infrastructure', 'planning', 'projects', 'social', 'green', 'heat'] as const;

/** Overlay layer ids → the layer-panel toggle that shows them (undefined = always on). */
const LAYER_TOGGLES: Record<string, LayerKey | undefined> = {
  'pi-density': 'density',
  'pi-lens': undefined,
  'pi-district-line': undefined,
  'pi-green': 'green',
  'pi-heat': 'heatmap',
  'pi-planning-fill': 'planning',
  'pi-planning-line': 'planning',
  'pi-development': 'development',
  'pi-tod-fill': 'tod',
  'pi-tod-line': 'tod',
  'pi-infra': 'infrastructure',
  'pi-metro': 'metro',
  'pi-stations': 'metro',
  'pi-social': 'social',
  'pi-projects': 'projects',
  'pi-selected-line': undefined,
};

/**
 * MapLibre map for the Map Intelligence dashboard. Purely presentational: the parent passes the
 * GeoJSON layers, toggles, basemap, lens, theme and selection; clicks come back as outputs.
 */
@Component({
  selector: 'pi-area-map',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  template: `<div #host class="pi-map__host" role="application" aria-label="Map of Hà Nội districts with growth, planning and metro layers"></div>`,
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
      .pi-map-label {
        font: 600 11px var(--pi-font-mono);
        letter-spacing: 0.14em;
        text-transform: uppercase;
        color: rgba(255, 255, 255, 0.62);
        text-shadow: 0 1px 3px rgba(0, 0, 0, 0.8);
        pointer-events: none;
        white-space: nowrap;
      }
      :root[data-theme='light'] .pi-map-label {
        color: rgba(10, 20, 38, 0.66);
        text-shadow: 0 1px 2px rgba(255, 255, 255, 0.9);
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
      }
      .pi-map-callout b {
        font: 700 13px var(--pi-font-display);
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }
      .pi-map-callout span {
        display: flex;
        gap: 12px;
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
  readonly basemap = input<Basemap>('satellite');
  readonly lens = input<Lens>('growth');
  readonly theme = input<'light' | 'dark'>('dark');
  readonly selected = input<string | null>(null);
  /** Pixels on the right covered by the floating AI panel, so fitBounds centres in what is visible. */
  readonly rightInset = input(0);
  /** Formats a tr/m² price for the callout (currency-aware). */
  readonly formatPrice = input<(tr: number) => string>((tr) => `${tr} tr/m²`);

  readonly selectDistrict = output<string>();
  readonly selectProject = output<string>();

  @ViewChild('host', { static: true }) private host!: ElementRef<HTMLDivElement>;
  private readonly zone = inject(NgZone);
  private map?: maplibregl.Map;
  private ready = false;
  private framed = false;
  private labelMarkers: maplibregl.Marker[] = [];
  private callout?: maplibregl.Marker;
  private hoverPopup?: maplibregl.Popup;
  private palette: PiPalette = overlayPalette('dark');

  constructor() {
    effect(() => {
      const data = this.data();
      untracked(() => this.ready && this.applyData(data));
    });
    effect(() => {
      this.theme();
      this.lens();
      untracked(() => this.ready && this.rebuildOverlays());
    });
    effect(() => {
      this.basemap();
      this.theme();
      untracked(() => this.ready && this.applyBasemap());
    });
    effect(() => {
      this.toggles();
      untracked(() => this.ready && this.applyVisibility());
    });
    effect(() => {
      const slug = this.selected();
      this.formatPrice();
      untracked(() => this.ready && this.applySelection(slug, true));
    });
  }

  ngAfterViewInit(): void {
    this.zone.runOutsideAngular(() => {
      const map = new maplibregl.Map({
        container: this.host.nativeElement,
        style: { version: 8, sources: {}, layers: [{ id: 'bg', type: 'background', paint: { 'background-color': '#0e1826' } }] },
        center: HANOI_CENTER,
        zoom: 11.2,
        minZoom: 9,
        maxZoom: 17,
        attributionControl: { compact: true },
        dragRotate: true,
        pitchWithRotate: true,
      });
      this.map = map;
      map.on('load', () => {
        for (const id of SOURCES) map.addSource(id, { type: 'geojson', data: EMPTY });
        this.ready = true;
        this.applyBasemap();
        this.rebuildOverlays();
        this.applyData(this.data());
        this.bindInteractions();
      });
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

  // ------------------------------------------------------------------ data

  private applyData(data: MapLayers | null): void {
    const map = this.map!;
    const l = data?.layers;
    const set = (id: string, fc: GeoJSON.FeatureCollection | undefined) => (map.getSource(id) as maplibregl.GeoJSONSource).setData(fc ?? EMPTY);
    set('districts', l?.districts);
    set('metro', l?.metro);
    set('stations', l?.stations);
    set('tod', l?.tod);
    set('infrastructure', l?.infrastructure);
    set('planning', l?.planning);
    set('projects', l?.projects);
    set('social', l?.social);
    set('green', l?.green);
    // Price heat: district centres (weighted by price) plus every project point.
    const heat: GeoJSON.FeatureCollection = {
      type: 'FeatureCollection',
      features: [...(l?.labels.features ?? []), ...(l?.projects.features ?? [])].map((f) => ({
        type: 'Feature',
        geometry: f.geometry,
        properties: { price: (f.properties as { price: number }).price },
      })),
    };
    set('heat', heat);
    this.buildLabels(l?.labels);
    // Frame the selected district the first time data arrives; later horizon switches keep the view.
    this.applySelection(this.selected(), !!l && !this.framed);
    if (l) this.framed = true;
  }

  private buildLabels(labels: GeoJSON.FeatureCollection | undefined): void {
    this.labelMarkers.forEach((m) => m.remove());
    this.labelMarkers = (labels?.features ?? []).map((f) => {
      const el = document.createElement('div');
      el.className = 'pi-map-label';
      el.textContent = (f.properties as { name: string }).name;
      return new maplibregl.Marker({ element: el, anchor: 'center' }).setLngLat((f.geometry as GeoJSON.Point).coordinates as [number, number]).addTo(this.map!);
    });
  }

  // ------------------------------------------------------------------ style

  private applyBasemap(): void {
    const map = this.map!;
    const spec = BASEMAPS[this.basemap()](this.theme());
    if (map.getLayer('base')) map.removeLayer('base');
    if (map.getSource('base')) map.removeSource('base');
    map.addSource('base', { type: 'raster', tiles: spec.tiles, tileSize: 256, maxzoom: spec.maxzoom, attribution: spec.attribution });
    map.addLayer({ id: 'base', type: 'raster', source: 'base', paint: spec.paint }, map.getLayer('pi-density') ? 'pi-density' : undefined);
    map.setPaintProperty('bg', 'background-color', this.theme() === 'dark' ? '#0e1826' : '#dfe6ee');
  }

  private lensColor(): maplibregl.ExpressionSpecification {
    const p = this.palette;
    switch (this.lens()) {
      case 'price':
        return ['interpolate', ['linear'], ['get', 'price'], 35, p.green, 90, p.yellow, 160, p.amber, 250, p.red];
      case 'risk':
        return ['interpolate', ['linear'], ['get', 'growthScore'], 70, p.red, 80, p.amber, 90, p.green];
      default:
        return ['interpolate', ['linear'], ['get', 'growthScore'], 70, p.dim, 80, p.cyan, 90, p.green];
    }
  }

  /** (Re)creates every overlay layer — cheap, and keeps theme/lens changes simple. */
  private rebuildOverlays(): void {
    const map = this.map!;
    this.palette = overlayPalette(this.theme());
    const p = this.palette;
    for (const id of Object.keys(LAYER_TOGGLES)) if (map.getLayer(id)) map.removeLayer(id);

    map.addLayer({
      id: 'pi-density',
      type: 'fill',
      source: 'districts',
      paint: { 'fill-color': p.violet, 'fill-opacity': ['interpolate', ['linear'], ['get', 'density'], 2000, 0.06, 40000, 0.42] },
    });
    map.addLayer({
      id: 'pi-lens',
      type: 'fill',
      source: 'districts',
      paint: { 'fill-color': this.lensColor(), 'fill-opacity': 0.1 },
    });
    map.addLayer({
      id: 'pi-district-line',
      type: 'line',
      source: 'districts',
      paint: { 'line-color': p.outline, 'line-width': 1, 'line-dasharray': [3, 3] },
    });
    map.addLayer({ id: 'pi-green', type: 'fill', source: 'green', paint: { 'fill-color': p.park, 'fill-opacity': 0.45 } });
    map.addLayer({
      id: 'pi-heat',
      type: 'heatmap',
      source: 'heat',
      paint: {
        'heatmap-weight': ['interpolate', ['linear'], ['get', 'price'], 35, 0.25, 250, 1],
        'heatmap-intensity': 0.9,
        'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 9, 40, 12, 90, 15, 160],
        'heatmap-opacity': 0.5,
        'heatmap-color': [
          'interpolate',
          ['linear'],
          ['heatmap-density'],
          0,
          'rgba(0,0,0,0)',
          0.2,
          hexA(p.green, 0.5),
          0.45,
          hexA(p.yellow, 0.6),
          0.7,
          hexA(p.amber, 0.7),
          1,
          hexA(p.red, 0.8),
        ],
      },
    });
    map.addLayer({
      id: 'pi-planning-fill',
      type: 'fill',
      source: 'planning',
      filter: ['==', ['get', 'kind'], 'zone'],
      paint: { 'fill-color': p.amber, 'fill-opacity': 0.16 },
    });
    map.addLayer({
      id: 'pi-planning-line',
      type: 'line',
      source: 'planning',
      filter: ['==', ['get', 'kind'], 'zone'],
      paint: { 'line-color': p.amber, 'line-width': 1.2, 'line-dasharray': [4, 2] },
    });
    map.addLayer({
      id: 'pi-development',
      type: 'line',
      source: 'planning',
      filter: ['==', ['get', 'kind'], 'development'],
      paint: { 'line-color': p.amber, 'line-width': 2, 'line-opacity': 0.9 },
    });
    map.addLayer({
      id: 'pi-tod-fill',
      type: 'fill',
      source: 'tod',
      paint: { 'fill-color': p.cyan, 'fill-opacity': ['match', ['get', 'status'], 'active', 0.1, 0.05] },
    });
    map.addLayer({
      id: 'pi-tod-line',
      type: 'line',
      source: 'tod',
      paint: { 'line-color': p.cyan, 'line-width': 1.2, 'line-dasharray': [3, 3], 'line-opacity': ['match', ['get', 'status'], 'active', 0.9, 0.5] },
    });
    map.addLayer({
      id: 'pi-infra',
      type: 'line',
      source: 'infrastructure',
      layout: { 'line-cap': 'round' },
      paint: { 'line-color': p.amber, 'line-width': ['match', ['get', 'status'], 'open', 4, 3], 'line-opacity': ['match', ['get', 'status'], 'open', 0.85, 0.6] },
    });
    map.addLayer({
      id: 'pi-metro',
      type: 'line',
      source: 'metro',
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': this.theme() === 'dark' ? ['get', 'color'] : p.cyan,
        'line-width': ['match', ['get', 'status'], 'operating', 4, 3],
        'line-opacity': ['match', ['get', 'status'], 'operating', 1, 0.75],
      },
    });
    map.addLayer({
      id: 'pi-stations',
      type: 'circle',
      source: 'stations',
      paint: {
        'circle-radius': 5,
        'circle-color': ['match', ['get', 'status'], 'operating', p.bg, p.cyan],
        'circle-stroke-color': ['match', ['get', 'status'], 'operating', p.cyan, p.bg],
        'circle-stroke-width': 2.5,
      },
    });
    map.addLayer({
      id: 'pi-social',
      type: 'circle',
      source: 'social',
      minzoom: 11.5,
      paint: {
        'circle-radius': 5,
        'circle-color': 'rgba(0,0,0,0)',
        'circle-stroke-color': ['match', ['get', 'kind'], 'hospital', p.redSoft, p.ink2],
        'circle-stroke-width': 1.5,
      },
    });
    map.addLayer({
      id: 'pi-projects',
      type: 'circle',
      source: 'projects',
      paint: { 'circle-radius': ['interpolate', ['linear'], ['zoom'], 10, 3.5, 14, 6], 'circle-color': p.projectDot, 'circle-stroke-color': p.bg, 'circle-stroke-width': 1.5 },
    });
    map.addLayer({
      id: 'pi-selected-line',
      type: 'line',
      source: 'districts',
      filter: ['==', ['get', 'slug'], ''],
      paint: { 'line-color': p.green, 'line-width': 2.2 },
    });
    // Dashed lines for planned metro / building roads need a separate dasharray (data-driven dasharray is unsupported).
    this.addDashedTwin('pi-metro', 'metro', ['==', ['get', 'status'], 'planned'], [2, 1.5]);
    this.addDashedTwin('pi-infra', 'infrastructure', ['==', ['get', 'status'], 'building'], [2.5, 1.5]);
    this.applyVisibility();
    this.applySelection(this.selected(), false);
  }

  /** Splits a line layer into solid (filter negated) and dashed (filter) variants. */
  private addDashedTwin(id: string, source: string, dashedFilter: maplibregl.FilterSpecification, dash: number[]): void {
    const map = this.map!;
    const layer = map.getStyle().layers.find((l) => l.id === id) as maplibregl.LineLayerSpecification;
    const twinId = `${id}-dashed`;
    if (map.getLayer(twinId)) map.removeLayer(twinId);
    map.setFilter(id, ['!', dashedFilter] as maplibregl.FilterSpecification);
    map.addLayer({ ...layer, id: twinId, source, filter: dashedFilter, paint: { ...layer.paint, 'line-dasharray': dash } }, id);
    LAYER_TOGGLES[twinId] = LAYER_TOGGLES[id];
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
    if (map.getLayer('pi-lens')) {
      map.setPaintProperty('pi-lens', 'fill-opacity', ['case', ['==', ['get', 'slug'], slug ?? ''], 0.26, 0.1]);
    }
    this.callout?.remove();
    const feature = this.data()?.layers.districts.features.find((f) => (f.properties as { slug: string }).slug === slug);
    const label = this.data()?.layers.labels.features.find((f) => (f.properties as { slug: string }).slug === slug);
    if (!feature || !label) return;
    const props = label.properties as { name: string; growthScore: number; price: number; yoy: number };
    const el = document.createElement('div');
    el.className = 'pi-map-callout';
    const b = document.createElement('b');
    b.textContent = props.name;
    const line = document.createElement('span');
    const score = document.createElement('span');
    score.append('Score ');
    const em = document.createElement('em');
    em.textContent = String(props.growthScore);
    score.append(em);
    const price = document.createElement('span');
    price.textContent = `${this.formatPrice()(props.price)}`;
    const yoy = document.createElement('em');
    yoy.textContent = `${props.yoy > 0 ? '+' : ''}${props.yoy}%`;
    line.append(score, price, yoy);
    el.append(b, line);
    const [lng, lat] = (label.geometry as GeoJSON.Point).coordinates;
    this.callout = new maplibregl.Marker({ element: el, anchor: 'top-left', offset: [18, 18] }).setLngLat([lng, lat]).addTo(map);
    if (fly) {
      const ring = (feature.geometry as GeoJSON.Polygon).coordinates[0];
      const bounds = ring.reduce((b, c) => b.extend(c as [number, number]), new maplibregl.LngLatBounds(ring[0] as [number, number], ring[0] as [number, number]));
      map.fitBounds(bounds, { padding: { top: 70, bottom: 60, left: 60, right: 60 + this.rightInset() }, maxZoom: 13.2, duration: this.framed ? 900 : 0 });
    }
  }

  // ------------------------------------------------------------------ interactions

  private bindInteractions(): void {
    const map = this.map!;
    const hoverable = ['pi-projects', 'pi-metro', 'pi-metro-dashed', 'pi-infra', 'pi-infra-dashed', 'pi-planning-fill', 'pi-development', 'pi-tod-fill', 'pi-stations', 'pi-social'];
    this.hoverPopup = new maplibregl.Popup({ closeButton: false, closeOnClick: false, offset: 10, maxWidth: '260px' });

    map.on('mousemove', (e) => {
      const layers = hoverable.filter((id) => map.getLayer(id) && map.getLayoutProperty(id, 'visibility') !== 'none');
      const hit = map.queryRenderedFeatures(e.point, { layers })[0];
      const overDistrict = map.queryRenderedFeatures(e.point, { layers: ['pi-lens'] }).length > 0;
      map.getCanvas().style.cursor = hit?.layer.id === 'pi-projects' || overDistrict ? 'pointer' : '';
      if (!hit) {
        this.hoverPopup!.remove();
        return;
      }
      this.hoverPopup!.setLngLat(e.lngLat).setDOMContent(describe(hit)).addTo(map);
    });
    map.on('mouseout', () => this.hoverPopup?.remove());

    map.on('click', (e) => {
      const project = map.queryRenderedFeatures(e.point, { layers: ['pi-projects'] })[0];
      if (project && map.getLayoutProperty('pi-projects', 'visibility') !== 'none') {
        const slug = (project.properties as { slug: string }).slug;
        this.zone.run(() => this.selectProject.emit(slug));
        return;
      }
      const district = map.queryRenderedFeatures(e.point, { layers: ['pi-lens'] })[0];
      if (district) {
        const slug = (district.properties as { slug: string }).slug;
        this.zone.run(() => this.selectDistrict.emit(slug));
      }
    });
  }
}

function describe(f: maplibregl.MapGeoJSONFeature): HTMLElement {
  const p = f.properties as Record<string, string | number>;
  const el = document.createElement('div');
  const title = document.createElement('strong');
  title.textContent = String(p['name'] ?? '');
  el.append(title);
  const extra = (() => {
    switch (f.layer.id) {
      case 'pi-projects':
        return `${p['price']} tr/m² · ${p['soldPct']}% sold · click for deep dive`;
      case 'pi-metro':
      case 'pi-metro-dashed':
        return p['status'] === 'operating' ? `Operating since ${p['opens']}` : `Planned · opens ${p['opens']}`;
      case 'pi-infra':
      case 'pi-infra-dashed':
        return p['status'] === 'open' ? `Open ${p['opens']}` : `Under construction · ${p['opens']}`;
      case 'pi-planning-fill':
      case 'pi-development':
        return `${p['kind'] === 'zone' ? 'Planning zone' : 'Development'} · from ${p['from']}`;
      case 'pi-stations':
        return `${p['line']} · ${p['status']}`;
      case 'pi-social':
        return p['kind'] === 'hospital' ? 'Hospital' : 'School';
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

function hexA(hex: string, alpha: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}
