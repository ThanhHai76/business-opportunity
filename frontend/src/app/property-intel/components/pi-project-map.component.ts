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
import { Basemap, LngLat, ProjectDetail } from '../pi.models';
import { BASEMAPS, overlayPalette } from './pi-map-style';

const EMPTY: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] };
const KM_PER_DEG_LAT = 110.574;

/** Circle polygon of `radiusM` around a point (equirectangular; fine at city scale). */
function circle([lng, lat]: LngLat, radiusM: number, segments = 64): GeoJSON.Polygon {
  const kmPerDegLng = 111.32 * Math.cos((lat * Math.PI) / 180);
  const ring: [number, number][] = Array.from({ length: segments }, (_, k) => {
    const a = (2 * Math.PI * k) / segments;
    return [lng + ((radiusM / 1000) * Math.cos(a)) / kmPerDegLng, lat + ((radiusM / 1000) * Math.sin(a)) / KM_PER_DEG_LAT];
  });
  ring.push(ring[0]);
  return { type: 'Polygon', coordinates: [ring] };
}

const POI_STYLE: Record<string, { cls: string }> = {
  school: { cls: 'is-school' },
  hospital: { cls: 'is-hospital' },
  mall: { cls: 'is-mall' },
  park: { cls: 'is-park' },
};

/**
 * Close-up map for the project deep dive: TOD ring around the nearest station, walk/drive
 * catchments around the project, landmarks and nearby projects (clickable).
 */
@Component({
  selector: 'pi-project-map',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  template: `<div #host class="pi-pmap__host" role="application" [attr.aria-label]="'Map around ' + (project()?.name ?? 'the project')"></div>`,
  styles: [
    `
      pi-project-map {
        position: absolute;
        inset: 0;
        display: block;
      }
      .pi-pmap__host {
        position: absolute;
        inset: 0;
        background: var(--pi-map);
      }
      .pi-pm-tag {
        font: 500 10px var(--pi-font-mono);
        white-space: nowrap;
        text-shadow: 0 1px 3px rgba(0, 0, 0, 0.85);
        pointer-events: none;
        display: flex;
        align-items: center;
        gap: 6px;
      }
      :root[data-theme='light'] .pi-pm-tag {
        text-shadow: 0 1px 2px rgba(255, 255, 255, 0.95);
      }
      .pi-pm-tag::before {
        content: '';
        width: 10px;
        height: 10px;
        border-radius: 50%;
        border: 1.6px solid currentColor;
        flex: none;
      }
      .pi-pm-tag.is-school {
        color: var(--pi-ink-2);
      }
      .pi-pm-tag.is-hospital {
        color: var(--pi-red);
      }
      .pi-pm-tag.is-mall {
        color: var(--pi-yellow);
      }
      .pi-pm-tag.is-mall::before {
        border-radius: 3px;
      }
      .pi-pm-tag.is-park {
        color: var(--pi-green);
      }
      .pi-pm-tag.is-park::before {
        border-radius: 3px;
        background: color-mix(in srgb, var(--pi-park) 60%, transparent);
        border-color: transparent;
      }
      .pi-pm-station {
        padding: 3px 7px;
        border-radius: 4px;
        background: var(--pi-cyan);
        color: #0a101c;
        font: 700 10px var(--pi-font-mono);
        white-space: nowrap;
        pointer-events: none;
      }
      .pi-pm-dist {
        font: 600 11px var(--pi-font-mono);
        color: var(--pi-ink-strong);
        text-shadow: 0 1px 3px rgba(0, 0, 0, 0.9);
        pointer-events: none;
      }
      .pi-pm-card {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 8px 12px 8px 8px;
        border-radius: 9px;
        background: var(--pi-glass);
        backdrop-filter: blur(10px);
        border: 1px solid var(--pi-amber);
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.45);
        color: var(--pi-ink);
      }
      .pi-pm-card i {
        width: 34px;
        height: 34px;
        border-radius: 6px;
        background: repeating-linear-gradient(135deg, #1e2a40 0 3px, #172236 3px 7px);
      }
      .pi-pm-card b {
        display: block;
        font: 700 13px var(--pi-font-display);
      }
      .pi-pm-card small {
        font: 500 10px var(--pi-font-mono);
        color: var(--pi-amber);
      }
      .pi-pm-near {
        font: 500 10px var(--pi-font-mono);
        color: var(--pi-amber);
        white-space: nowrap;
        cursor: pointer;
        text-shadow: 0 1px 3px rgba(0, 0, 0, 0.85);
        padding: 2px 0;
        border: 0;
        background: none;
      }
      .pi-pm-near:hover {
        text-decoration: underline;
      }
    `,
  ],
})
export class PiProjectMapComponent implements AfterViewInit, OnDestroy {
  readonly project = input<ProjectDetail | null>(null);
  readonly basemap = input<Basemap>('satellite');
  readonly theme = input<'light' | 'dark'>('dark');
  readonly show = input.required<{ tod: boolean; walk: boolean; drive: boolean }>();
  /** Formats a tr/m² price for the project card. */
  readonly formatPrice = input<(tr: number) => string>((tr) => `${tr} tr/m²`);
  readonly openProject = output<string>();

  @ViewChild('host', { static: true }) private host!: ElementRef<HTMLDivElement>;
  private readonly zone = inject(NgZone);
  private map?: maplibregl.Map;
  private ready = false;
  /** First framing jumps; later project switches animate. */
  private framed = false;
  private markers: maplibregl.Marker[] = [];

  constructor() {
    effect(() => {
      const p = this.project();
      this.formatPrice();
      untracked(() => this.ready && this.render(p));
    });
    effect(() => {
      this.basemap();
      this.theme();
      untracked(() => {
        if (!this.ready) return;
        this.applyBasemap();
        this.render(this.project(), false);
      });
    });
    effect(() => {
      this.show();
      untracked(() => this.ready && this.applyVisibility());
    });
  }

  ngAfterViewInit(): void {
    this.zone.runOutsideAngular(() => {
      const p = this.project();
      const map = new maplibregl.Map({
        container: this.host.nativeElement,
        style: { version: 8, sources: {}, layers: [{ id: 'bg', type: 'background', paint: { 'background-color': '#0e1826' } }] },
        center: p?.coords ?? [105.938, 21.073],
        zoom: 15,
        minZoom: 11,
        maxZoom: 18,
        attributionControl: { compact: true },
      });
      this.map = map;
      map.on('load', () => {
        for (const id of ['drive', 'walk', 'tod', 'link', 'station']) map.addSource(id, { type: 'geojson', data: EMPTY });
        this.ready = true;
        this.applyBasemap();
        this.render(this.project());
      });
    });
  }

  ngOnDestroy(): void {
    this.map?.remove();
  }

  private applyBasemap(): void {
    const map = this.map!;
    const spec = BASEMAPS[this.basemap()](this.theme());
    if (map.getLayer('base')) map.removeLayer('base');
    if (map.getSource('base')) map.removeSource('base');
    map.addSource('base', { type: 'raster', tiles: spec.tiles, tileSize: 256, maxzoom: spec.maxzoom, attribution: spec.attribution });
    map.addLayer({ id: 'base', type: 'raster', source: 'base', paint: spec.paint }, map.getLayer('pm-drive-fill') ? 'pm-drive-fill' : undefined);
    map.setPaintProperty('bg', 'background-color', this.theme() === 'dark' ? '#0e1826' : '#dfe6ee');
  }

  private render(p: ProjectDetail | null, fly = true): void {
    const map = this.map!;
    const pal = overlayPalette(this.theme());
    for (const id of ['pm-drive-fill', 'pm-drive-line', 'pm-walk-fill', 'pm-walk-line', 'pm-tod-fill', 'pm-tod-line', 'pm-link', 'pm-station']) {
      if (map.getLayer(id)) map.removeLayer(id);
    }
    this.markers.forEach((m) => m.remove());
    this.markers = [];
    const set = (id: string, geom: GeoJSON.Geometry | null) =>
      (map.getSource(id) as maplibregl.GeoJSONSource).setData(geom ? { type: 'Feature', geometry: geom, properties: {} } : EMPTY);
    if (!p) {
      for (const id of ['drive', 'walk', 'tod', 'link', 'station']) set(id, null);
      return;
    }

    set('drive', circle(p.coords, 7000));
    set('walk', circle(p.coords, 800));
    set('tod', circle(p.station.coords, p.todRadiusM));
    set('link', { type: 'LineString', coordinates: [p.station.coords, p.coords] });
    set('station', { type: 'Point', coordinates: p.station.coords });

    map.addLayer({ id: 'pm-drive-fill', type: 'fill', source: 'drive', paint: { 'fill-color': pal.violet, 'fill-opacity': 0.05 } });
    map.addLayer({ id: 'pm-drive-line', type: 'line', source: 'drive', paint: { 'line-color': pal.violet, 'line-width': 1.2, 'line-dasharray': [4, 3] } });
    map.addLayer({ id: 'pm-walk-fill', type: 'fill', source: 'walk', paint: { 'fill-color': pal.green, 'fill-opacity': 0.12 } });
    map.addLayer({ id: 'pm-walk-line', type: 'line', source: 'walk', paint: { 'line-color': pal.green, 'line-width': 1.2, 'line-opacity': 0.7 } });
    map.addLayer({ id: 'pm-tod-fill', type: 'fill', source: 'tod', paint: { 'fill-color': pal.cyan, 'fill-opacity': 0.07 } });
    map.addLayer({ id: 'pm-tod-line', type: 'line', source: 'tod', paint: { 'line-color': pal.cyan, 'line-width': 1.3, 'line-dasharray': [3, 3] } });
    map.addLayer({ id: 'pm-link', type: 'line', source: 'link', paint: { 'line-color': pal.projectDot, 'line-width': 1.3, 'line-dasharray': [2, 2] } });
    map.addLayer({
      id: 'pm-station',
      type: 'circle',
      source: 'station',
      paint: { 'circle-radius': 8, 'circle-color': pal.cyan, 'circle-stroke-color': pal.bg, 'circle-stroke-width': 3 },
    });

    const add = (el: HTMLElement, at: LngLat, anchor: maplibregl.PositionAnchor = 'center', offset: [number, number] = [0, 0]) =>
      this.markers.push(new maplibregl.Marker({ element: el, anchor, offset }).setLngLat(at).addTo(map));

    const station = document.createElement('div');
    station.className = 'pi-pm-station';
    station.textContent = `${p.station.name.toUpperCase()} · ${p.station.line}`;
    add(station, p.station.coords, 'top-left', [12, 10]);

    const dist = document.createElement('div');
    dist.className = 'pi-pm-dist';
    dist.textContent = `${p.station.distanceM} m`;
    add(dist, [(p.station.coords[0] + p.coords[0]) / 2, (p.station.coords[1] + p.coords[1]) / 2], 'bottom', [0, -4]);

    for (const poi of p.pois) {
      const el = document.createElement('div');
      el.className = `pi-pm-tag ${POI_STYLE[poi.kind]?.cls ?? ''}`;
      el.textContent = poi.name;
      add(el, poi.coords, 'left', [-5, 0]);
    }

    for (const n of p.nearby) {
      const el = document.createElement('button');
      el.type = 'button';
      el.className = 'pi-pm-near';
      el.textContent = `■ ${n.name} · ${n.handover.replace(/^Q\d /, '')}`;
      el.title = `Open ${n.name}`;
      el.addEventListener('click', () => this.zone.run(() => this.openProject.emit(n.slug)));
      add(el, n.coords, 'left', [-5, 0]);
    }

    const card = document.createElement('div');
    card.className = 'pi-pm-card';
    const thumb = document.createElement('i');
    const text = document.createElement('div');
    const name = document.createElement('b');
    name.textContent = p.name;
    const price = document.createElement('small');
    price.textContent = `${this.formatPrice()(p.pricePerM2)} · selected`;
    text.append(name, price);
    card.append(thumb, text);
    add(card, p.coords, 'bottom-left', [6, -6]);

    this.applyVisibility();
    if (fly) {
      const b = new maplibregl.LngLatBounds(p.coords, p.coords).extend(p.station.coords);
      for (const poi of p.pois) b.extend(poi.coords);
      map.fitBounds(b, { padding: { top: 80, bottom: 60, left: 60, right: 140 }, maxZoom: 15.2, duration: this.framed ? 800 : 0 });
      this.framed = true;
    }
  }

  private applyVisibility(): void {
    const map = this.map!;
    const s = this.show();
    const vis = (on: boolean) => (on ? 'visible' : 'none');
    for (const id of ['pm-tod-fill', 'pm-tod-line']) if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', vis(s.tod));
    for (const id of ['pm-walk-fill', 'pm-walk-line']) if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', vis(s.walk));
    for (const id of ['pm-drive-fill', 'pm-drive-line']) if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', vis(s.drive));
  }
}
