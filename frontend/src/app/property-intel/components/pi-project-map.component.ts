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
import { formatDistance } from '../pi-format';
import { Basemap, LngLat, ProjectDetail } from '../pi.models';
import { baseStyle, firstSymbolLayer, overlayPalette } from './pi-map-style';

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

/** Beyond this, the nearest station is not framed with the project (the map would zoom out to the whole city). */
const FRAME_STATION_M = 3000;

/**
 * Close-up map for the project deep dive: TOD ring around the nearest station, walk/drive catchments around the
 * project, real landmarks from OpenStreetMap and nearby projects (published prices), clickable.
 */
@Component({
  selector: 'pi-project-map',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  template: `<div #host class="pi-pmap__host" role="application" [attr.aria-label]="project()?.name ?? ''"></div>`,
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
  readonly basemap = input<Basemap>('map');
  readonly theme = input<'light' | 'dark'>('dark');
  readonly show = input.required<{ tod: boolean; walk: boolean; drive: boolean }>();
  readonly text = input<PiText>(PI_TEXT.vi);
  readonly openProject = output<string>();

  @ViewChild('host', { static: true }) private host!: ElementRef<HTMLDivElement>;
  private readonly zone = inject(NgZone);
  private map?: maplibregl.Map;
  private ready = false;
  private styleToken = 0;
  private beforeLabels?: string;
  /** First framing jumps; later project switches animate. */
  private framed = false;
  private markers: maplibregl.Marker[] = [];

  constructor() {
    effect(() => {
      const p = this.project();
      this.text();
      untracked(() => this.ready && this.render(p));
    });
    effect(() => {
      this.basemap();
      this.theme();
      untracked(() => this.map && this.loadBase(false));
    });
    effect(() => {
      this.show();
      untracked(() => this.ready && this.applyVisibility());
    });
  }

  ngAfterViewInit(): void {
    this.zone.runOutsideAngular(() => {
      const p = this.project();
      this.map = new maplibregl.Map({
        container: this.host.nativeElement,
        style: { version: 8, sources: {}, layers: [{ id: 'background', type: 'background', paint: { 'background-color': this.theme() === 'dark' ? '#0e1826' : '#e7edf3' } }] },
        center: p?.coords ?? [105.938, 21.073],
        zoom: 15,
        minZoom: 10,
        maxZoom: 18,
        attributionControl: { compact: true },
      });
      this.loadBase(true);
    });
  }

  /** Loads the basemap, then redraws the project on top (`style.load`: a hung tile must not hide the overlays). */
  private loadBase(fly: boolean): void {
    const map = this.map!;
    const token = ++this.styleToken;
    void baseStyle(this.basemap(), this.theme()).then((style) => {
      if (token !== this.styleToken) return;
      this.ready = false;
      this.beforeLabels = firstSymbolLayer(style);
      map.setStyle(style, { diff: false });
      map.once('style.load', () => {
        if (token !== this.styleToken) return;
        for (const id of ['drive', 'walk', 'tod', 'link', 'station']) map.addSource(id, { type: 'geojson', data: EMPTY });
        this.ready = true;
        this.render(this.project(), fly);
      });
    });
  }

  ngOnDestroy(): void {
    this.map?.remove();
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

    const under = this.beforeLabels;
    map.addLayer({ id: 'pm-drive-fill', type: 'fill', source: 'drive', paint: { 'fill-color': pal.violet, 'fill-opacity': 0.05 } }, under);
    map.addLayer({ id: 'pm-drive-line', type: 'line', source: 'drive', paint: { 'line-color': pal.violet, 'line-width': 1.2, 'line-dasharray': [4, 3] } }, under);
    map.addLayer({ id: 'pm-walk-fill', type: 'fill', source: 'walk', paint: { 'fill-color': pal.green, 'fill-opacity': 0.12 } }, under);
    map.addLayer({ id: 'pm-walk-line', type: 'line', source: 'walk', paint: { 'line-color': pal.green, 'line-width': 1.2, 'line-opacity': 0.7 } }, under);
    map.addLayer({ id: 'pm-tod-fill', type: 'fill', source: 'tod', paint: { 'fill-color': pal.cyan, 'fill-opacity': 0.07 } }, under);
    map.addLayer({ id: 'pm-tod-line', type: 'line', source: 'tod', paint: { 'line-color': pal.cyan, 'line-width': 1.3, 'line-dasharray': [3, 3] } }, under);
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
    station.textContent = this.text().project.stationLabel(p.station.name, p.station.line);
    add(station, p.station.coords, 'top-left', [12, 10]);

    const dist = document.createElement('div');
    dist.className = 'pi-pm-dist';
    dist.textContent = formatDistance(p.station.distanceM);
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
      el.textContent = `■ ${n.name} · ${n.price.label}`;
      el.title = this.text().project.openNear(n.name);
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
    price.textContent = `${p.price.label} ${this.text().perM2} · ${this.text().project.selected}`;
    text.append(name, price);
    card.append(thumb, text);
    add(card, p.coords, 'bottom-left', [6, -6]);

    this.applyVisibility();
    if (fly) {
      const b = new maplibregl.LngLatBounds(p.coords, p.coords);
      if (p.station.distanceM <= FRAME_STATION_M) b.extend(p.station.coords);
      for (const poi of p.pois) if (poi.distanceM <= FRAME_STATION_M) b.extend(poi.coords);
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
