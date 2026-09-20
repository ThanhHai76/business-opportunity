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
import { HANOI_BOUNDS, AMENITY_META, STATUS_META } from '../../living-score.constants';
import { AmenityGeoJson, AreaGeoJson, InfrastructureGeoJson } from '../../models/living-score.models';
import { BAND_COLORS } from '../../services/living-meta.service';

const BAND_KEYS = ['excellent', 'good', 'fair', 'low'] as const;
const SRC_AREAS = 'areas';
const SRC_INFRA = 'infra';
const SRC_AMENITIES = 'amenities';
const EMPTY: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] };

const OSM_TILES = ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'];
const ATTRIBUTION = '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

/** Softens the OpenStreetMap raster so the score colours stand out; darker for the dark theme. */
const BASE_PAINT: Record<'light' | 'dark', Record<string, number>> = {
  light: { 'raster-saturation': -0.3, 'raster-contrast': -0.05, 'raster-brightness-min': 0, 'raster-brightness-max': 1 },
  dark: { 'raster-saturation': -0.8, 'raster-contrast': 0.15, 'raster-brightness-min': 0, 'raster-brightness-max': 0.36 },
};

const BACKGROUND = { light: '#e9edf0', dark: '#16130f' };

function buildStyle(): maplibregl.StyleSpecification {
  return {
    version: 8,
    sources: {
      osm: { type: 'raster', tiles: OSM_TILES, tileSize: 256, maxzoom: 19, attribution: ATTRIBUTION },
    },
    layers: [
      // Shown while tiles load (or if the tile server is unreachable) so the map never looks broken.
      { id: 'background', type: 'background', paint: { 'background-color': BACKGROUND.light } },
      { id: 'base', type: 'raster', source: 'osm', paint: { ...BASE_PAINT.light } },
    ],
  };
}

/**
 * MapLibre wrapper: area polygons coloured by score band, score pins, metro/infrastructure and
 * amenity layers. It is purely presentational — all data (and every score) comes from the parent.
 */
@Component({
  selector: 'ls-area-map',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  template: `<div #host class="ls-map__host" role="application" aria-label="Bản đồ Hà Nội với điểm Living Score"></div>`,
  styles: [
    `
      ls-area-map {
        display: block;
        position: absolute;
        inset: 0;
      }
      .ls-map__host {
        position: absolute;
        inset: 0;
      }
      .ls-root .ls-pin {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 3px;
        font: inherit;
        cursor: pointer;
      }
      .ls-root .ls-pin__score {
        min-width: 40px;
        height: 40px;
        padding: 0 6px;
        display: grid;
        place-items: center;
        border-radius: 999px;
        border: 3px solid #fff;
        color: #fff;
        font-size: 14px;
        font-weight: 800;
        font-variant-numeric: tabular-nums;
        background: var(--ls-band-fair, #f0a020);
        box-shadow: 0 4px 12px rgba(16, 24, 40, 0.3);
        transition: transform 0.15s ease, box-shadow 0.15s ease;
      }
      .ls-root .ls-pin--excellent .ls-pin__score {
        background: var(--ls-band-excellent, #1a8f5c);
      }
      .ls-root .ls-pin--good .ls-pin__score {
        background: var(--ls-band-good, #46b37e);
      }
      .ls-root .ls-pin--fair .ls-pin__score {
        background: var(--ls-band-fair, #f0a020);
      }
      .ls-root .ls-pin--low .ls-pin__score {
        background: var(--ls-band-low, #e5484d);
      }
      .ls-root .ls-pin__name {
        padding: 1px 7px;
        border-radius: 999px;
        background: var(--ls-glass);
        color: var(--ls-ink);
        font-size: 11px;
        font-weight: 700;
        white-space: nowrap;
        box-shadow: 0 1px 4px rgba(16, 24, 40, 0.18);
      }
      .ls-root .ls-pin:hover .ls-pin__score,
      .ls-root .ls-pin.is-selected .ls-pin__score {
        transform: scale(1.15);
        box-shadow: 0 0 0 4px rgba(15, 95, 242, 0.28), 0 6px 16px rgba(16, 24, 40, 0.35);
      }
      @media (max-width: 820px) {
        .ls-root .ls-pin__score {
          min-width: 30px;
          height: 30px;
          font-size: 12px;
          border-width: 2px;
        }
        .ls-root .ls-pin__name {
          display: none;
        }
        .ls-root .ls-pin.is-selected .ls-pin__name {
          display: block;
        }
      }
      .ls-root .maplibregl-popup-content {
        padding: 10px 12px;
        border-radius: 12px;
        background: var(--ls-surface);
        color: var(--ls-ink);
        font-family: inherit;
        font-size: 13px;
        box-shadow: var(--ls-shadow);
      }
      .ls-root .maplibregl-popup-tip {
        display: none;
      }
      .ls-root .ls-popup__type {
        font-size: 11px;
        font-weight: 700;
        color: var(--ls-ink-faint);
      }
      .ls-root .maplibregl-ctrl-attrib {
        font-size: 10px;
      }
      .ls-root .maplibregl-ctrl-group {
        border-radius: 12px;
        overflow: hidden;
        background: var(--ls-surface);
        box-shadow: var(--ls-shadow);
      }
      .ls-root .maplibregl-ctrl-group button {
        width: 34px;
        height: 34px;
      }
      .ls-root[data-theme='dark'] .maplibregl-ctrl-icon {
        filter: invert(1);
      }
    `,
  ],
})
export class AreaMapComponent implements AfterViewInit, OnDestroy {
  private readonly zone = inject(NgZone);
  @ViewChild('host', { static: true }) private host!: ElementRef<HTMLDivElement>;

  readonly areas = input<AreaGeoJson | null>(null);
  readonly infrastructure = input<InfrastructureGeoJson | null>(null);
  readonly amenities = input<AmenityGeoJson | null>(null);
  readonly showInfrastructure = input(false);
  readonly selectedSlug = input<string | null>(null);
  readonly theme = input<'light' | 'dark'>('light');
  readonly padding = input<maplibregl.PaddingOptions>({ top: 40, right: 40, bottom: 40, left: 40 });

  readonly areaSelect = output<string>();

  private map?: maplibregl.Map;
  private readonly ready = signal(false);
  private readonly pins = new Map<string, { marker: maplibregl.Marker; element: HTMLElement }>();
  private hoveredId: number | string | null = null;
  private fitted = false;

  constructor() {
    effect(() => this.syncAreas(this.areas(), this.ready()));
    effect(() => this.syncSelection(this.selectedSlug(), this.ready()));
    effect(() => this.syncTheme(this.theme(), this.ready()));
    effect(() => this.syncInfrastructure(this.infrastructure(), this.showInfrastructure(), this.ready()));
    effect(() => this.syncAmenities(this.amenities(), this.ready()));
  }

  ngAfterViewInit(): void {
    this.zone.runOutsideAngular(() => {
      const map = new maplibregl.Map({
        container: this.host.nativeElement,
        style: buildStyle(),
        bounds: HANOI_BOUNDS,
        fitBoundsOptions: { padding: this.padding() },
        attributionControl: false,
        cooperativeGestures: false,
        maxBounds: [
          [105.2, 20.6],
          [106.4, 21.5],
        ],
      });
      this.map = map;
      map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-left');
      map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'bottom-right');
      map.on('load', () => {
        this.addSourcesAndLayers(map);
        this.zone.run(() => this.ready.set(true));
      });
    });
  }

  ngOnDestroy(): void {
    this.pins.forEach(({ marker }) => marker.remove());
    this.pins.clear();
    this.map?.remove();
  }

  private addSourcesAndLayers(map: maplibregl.Map): void {
    map.addSource(SRC_AREAS, { type: 'geojson', data: EMPTY });
    map.addSource(SRC_INFRA, { type: 'geojson', data: EMPTY });
    map.addSource(SRC_AMENITIES, { type: 'geojson', data: EMPTY });

    const bandColor: maplibregl.ExpressionSpecification = [
      'match',
      ['get', 'band'],
      'excellent',
      BAND_COLORS.excellent,
      'good',
      BAND_COLORS.good,
      'fair',
      BAND_COLORS.fair,
      BAND_COLORS.low,
    ];

    map.addLayer({
      id: 'areas-fill',
      type: 'fill',
      source: SRC_AREAS,
      paint: {
        'fill-color': bandColor,
        'fill-opacity': ['case', ['boolean', ['feature-state', 'hover'], false], 0.6, 0.44],
      },
    });
    map.addLayer({
      id: 'areas-line',
      type: 'line',
      source: SRC_AREAS,
      paint: { 'line-color': '#ffffff', 'line-width': 1.6, 'line-opacity': 0.9 },
    });
    map.addLayer({
      id: 'areas-selected',
      type: 'line',
      source: SRC_AREAS,
      filter: ['==', ['get', 'slug'], ''],
      paint: { 'line-color': '#0f5ff2', 'line-width': 3.5 },
    });

    const statusColor: maplibregl.ExpressionSpecification = [
      'match',
      ['get', 'status'],
      'operating',
      STATUS_META.operating.color,
      'under_construction',
      STATUS_META.under_construction.color,
      STATUS_META.planned.color,
    ];
    const lineFilter = (status: string): maplibregl.FilterSpecification => [
      'all',
      ['==', ['geometry-type'], 'LineString'],
      ['==', ['get', 'status'], status],
    ];
    map.addLayer({
      id: 'infra-operating',
      type: 'line',
      source: SRC_INFRA,
      filter: lineFilter('operating'),
      layout: { visibility: 'none', 'line-cap': 'round' },
      paint: { 'line-color': statusColor, 'line-width': 3.5 },
    });
    map.addLayer({
      id: 'infra-construction',
      type: 'line',
      source: SRC_INFRA,
      filter: lineFilter('under_construction'),
      layout: { visibility: 'none' },
      paint: { 'line-color': statusColor, 'line-width': 3.5, 'line-dasharray': [2, 1.4] },
    });
    map.addLayer({
      id: 'infra-planned',
      type: 'line',
      source: SRC_INFRA,
      filter: lineFilter('planned'),
      layout: { visibility: 'none' },
      paint: { 'line-color': statusColor, 'line-width': 3, 'line-dasharray': [0.7, 1.6] },
    });
    map.addLayer({
      id: 'infra-stations',
      type: 'circle',
      source: SRC_INFRA,
      filter: ['==', ['geometry-type'], 'Point'],
      layout: { visibility: 'none' },
      paint: { 'circle-radius': 4.5, 'circle-color': statusColor, 'circle-stroke-color': '#ffffff', 'circle-stroke-width': 1.6 },
    });

    map.addLayer({
      id: 'amenities',
      type: 'circle',
      source: SRC_AMENITIES,
      paint: {
        'circle-radius': 5.5,
        'circle-color': [
          'match',
          ['get', 'type'],
          'school',
          AMENITY_META.school.color,
          'hospital',
          AMENITY_META.hospital.color,
          'park',
          AMENITY_META.park.color,
          AMENITY_META.shopping.color,
        ],
        'circle-stroke-color': '#ffffff',
        'circle-stroke-width': 1.8,
      },
    });

    this.bindInteractions(map);
  }

  private bindInteractions(map: maplibregl.Map): void {
    map.on('mousemove', 'areas-fill', (event) => {
      const feature = event.features?.[0];
      map.getCanvas().style.cursor = feature ? 'pointer' : '';
      const id = feature?.id ?? null;
      if (id === this.hoveredId) return;
      if (this.hoveredId !== null) map.setFeatureState({ source: SRC_AREAS, id: this.hoveredId }, { hover: false });
      if (id !== null) map.setFeatureState({ source: SRC_AREAS, id }, { hover: true });
      this.hoveredId = id;
    });
    map.on('mouseleave', 'areas-fill', () => {
      map.getCanvas().style.cursor = '';
      if (this.hoveredId !== null) map.setFeatureState({ source: SRC_AREAS, id: this.hoveredId }, { hover: false });
      this.hoveredId = null;
    });
    map.on('click', 'areas-fill', (event) => {
      const slug = event.features?.[0]?.properties?.['slug'];
      if (typeof slug === 'string') this.zone.run(() => this.areaSelect.emit(slug));
    });

    map.on('click', 'amenities', (event) => {
      const feature = event.features?.[0];
      if (!feature || feature.geometry.type !== 'Point') return;
      const props = feature.properties as { name: string; type: keyof typeof AMENITY_META; rating: number };
      const body = document.createElement('div');
      const type = document.createElement('div');
      type.className = 'ls-popup__type';
      type.textContent = AMENITY_META[props.type]?.label ?? '';
      const name = document.createElement('strong');
      name.textContent = props.name;
      const rating = document.createElement('div');
      rating.textContent = `★ ${props.rating} · dữ liệu mẫu`;
      body.append(type, name, rating);
      new maplibregl.Popup({ closeButton: false, offset: 10 })
        .setLngLat(feature.geometry.coordinates as [number, number])
        .setDOMContent(body)
        .addTo(map);
    });
    map.on('mouseenter', 'amenities', () => (map.getCanvas().style.cursor = 'pointer'));
    map.on('mouseleave', 'amenities', () => (map.getCanvas().style.cursor = ''));
  }

  private source(id: string): maplibregl.GeoJSONSource | undefined {
    return this.map?.getSource(id) as maplibregl.GeoJSONSource | undefined;
  }

  private syncAreas(data: AreaGeoJson | null, ready: boolean): void {
    if (!ready || !this.map) return;
    this.source(SRC_AREAS)?.setData((data ?? EMPTY) as unknown as GeoJSON.FeatureCollection);
    this.rebuildPins(data);
    if (data && !this.fitted) {
      this.fitted = true;
      this.map.fitBounds(HANOI_BOUNDS, { padding: untracked(() => this.padding()), duration: 0 });
    }
  }

  private rebuildPins(data: AreaGeoJson | null): void {
    const map = this.map;
    if (!map) return;
    const seen = new Set<string>();
    for (const feature of data?.features ?? []) {
      const p = feature.properties;
      seen.add(p.slug);
      let pin = this.pins.get(p.slug);
      if (!pin) {
        const element = document.createElement('button');
        element.type = 'button';
        element.className = 'ls-pin';
        const score = document.createElement('span');
        score.className = 'ls-pin__score';
        const label = document.createElement('span');
        label.className = 'ls-pin__name';
        element.append(score, label);
        element.addEventListener('click', (event) => {
          event.stopPropagation();
          this.zone.run(() => this.areaSelect.emit(p.slug));
        });
        const marker = new maplibregl.Marker({ element, anchor: 'center' }).setLngLat([p.lng, p.lat]).addTo(map);
        pin = { marker, element };
        this.pins.set(p.slug, pin);
      }
      pin.marker.setLngLat([p.lng, p.lat]);
      // classList (not className): MapLibre put its own `maplibregl-marker` class on this element.
      for (const band of BAND_KEYS) pin.element.classList.toggle(`ls-pin--${band}`, band === p.band);
      pin.element.classList.toggle('is-selected', p.slug === untracked(() => this.selectedSlug()));
      pin.element.setAttribute('aria-label', `${p.name}, điểm ${Math.round(p.value)}`);
      pin.element.querySelector('.ls-pin__score')!.textContent = String(Math.round(p.value));
      pin.element.querySelector('.ls-pin__name')!.textContent = p.name;
    }
    for (const [slug, pin] of this.pins) {
      if (!seen.has(slug)) {
        pin.marker.remove();
        this.pins.delete(slug);
      }
    }
  }

  private syncSelection(slug: string | null, ready: boolean): void {
    if (!ready || !this.map) return;
    this.map.setFilter('areas-selected', ['==', ['get', 'slug'], slug ?? '']);
    for (const [key, pin] of this.pins) pin.element.classList.toggle('is-selected', key === slug);
    const feature = untracked(() => this.areas())?.features.find((f) => f.properties.slug === slug);
    if (feature) {
      const padding = untracked(() => this.padding());
      this.map.easeTo({ center: [feature.properties.lng, feature.properties.lat], padding, duration: 500 });
    }
  }

  private syncTheme(theme: 'light' | 'dark', ready: boolean): void {
    if (!ready || !this.map) return;
    for (const [property, value] of Object.entries(BASE_PAINT[theme])) {
      this.map.setPaintProperty('base', property, value);
    }
    this.map.setPaintProperty('background', 'background-color', BACKGROUND[theme]);
  }

  private syncInfrastructure(data: InfrastructureGeoJson | null, visible: boolean, ready: boolean): void {
    if (!ready || !this.map) return;
    this.source(SRC_INFRA)?.setData((data ?? EMPTY) as unknown as GeoJSON.FeatureCollection);
    for (const id of ['infra-operating', 'infra-construction', 'infra-planned', 'infra-stations']) {
      this.map.setLayoutProperty(id, 'visibility', visible ? 'visible' : 'none');
    }
  }

  private syncAmenities(data: AmenityGeoJson | null, ready: boolean): void {
    if (!ready || !this.map) return;
    this.source(SRC_AMENITIES)?.setData((data ?? EMPTY) as unknown as GeoJSON.FeatureCollection);
  }
}
