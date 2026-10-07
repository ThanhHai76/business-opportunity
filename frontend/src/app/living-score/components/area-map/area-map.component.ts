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
import { LangService } from '../../services/lang.service';
import { BAND_COLORS } from '../../services/living-meta.service';

const BAND_KEYS = ['excellent', 'good', 'fair', 'low'] as const;
const SRC_AREAS = 'areas';
const SRC_INFRA = 'infra';
const SRC_AMENITIES = 'amenities';
const SRC_MEASURE = 'measure';
/** Radius the scores are measured in (see the API's data.walkKm). */
const MEASURE_KM = 1.5;

/** A 64-point circle of `km` around a centre, as a GeoJSON polygon (equirectangular — fine at city scale). */
function circle(lng: number, lat: number, km: number): GeoJSON.Feature<GeoJSON.Polygon> {
  const dLat = km / 110.574;
  const dLng = km / (111.32 * Math.cos((lat * Math.PI) / 180));
  const ring = Array.from({ length: 65 }, (_, i) => {
    const a = (i / 64) * 2 * Math.PI;
    return [lng + dLng * Math.cos(a), lat + dLat * Math.sin(a)];
  });
  return { type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [ring] } };
}
const EMPTY: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] };

/**
 * OpenFreeMap vector base maps (free, no key; data © OpenStreetMap contributors). The raster
 * tile.openstreetmap.org is not meant for app traffic and is refused on some networks.
 */
const STYLE_URL: Record<'light' | 'dark', string> = {
  light: 'https://tiles.openfreemap.org/styles/positron',
  dark: 'https://tiles.openfreemap.org/styles/dark',
};

/**
 * MapLibre wrapper: area polygons coloured by score band, score pins, metro/infrastructure and
 * amenity layers. It is purely presentational — all data (and every score) comes from the parent.
 */
@Component({
  selector: 'ls-area-map',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  template: `<div #host class="ls-map__host" role="application" [attr.aria-label]="t().map.aria"></div>`,
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
        background: var(--ls-band-fair, #f2b134);
        box-shadow: 0 4px 12px rgba(16, 24, 40, 0.3);
        transition: transform 0.15s ease, box-shadow 0.15s ease;
      }
      .ls-root .ls-pin--excellent .ls-pin__score {
        background: var(--ls-band-excellent, #16a06f);
      }
      .ls-root .ls-pin--good .ls-pin__score {
        background: var(--ls-band-good, #5bbf8a);
      }
      .ls-root .ls-pin--fair .ls-pin__score {
        background: var(--ls-band-fair, #f2b134);
      }
      .ls-root .ls-pin--low .ls-pin__score {
        background: var(--ls-band-low, #f08a4b);
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

  protected readonly t = inject(LangService).t;
  readonly areaSelect = output<string>();

  private map?: maplibregl.Map;
  private readonly ready = signal(false);
  private readonly pins = new Map<string, { marker: maplibregl.Marker; element: HTMLElement }>();
  private hoveredId: number | string | null = null;
  private fitted = false;
  private styleTheme: 'light' | 'dark' = 'light';

  constructor() {
    effect(() => this.syncAreas(this.areas(), this.ready()));
    effect(() => this.syncSelection(this.selectedSlug(), this.ready()));
    effect(() => this.syncTheme(this.theme(), this.ready()));
    effect(() => this.syncInfrastructure(this.infrastructure(), this.showInfrastructure(), this.ready()));
    effect(() => this.syncAmenities(this.amenities(), this.ready()));
  }

  ngAfterViewInit(): void {
    this.styleTheme = untracked(() => this.theme());
    this.zone.runOutsideAngular(() => {
      const map = new maplibregl.Map({
        container: this.host.nativeElement,
        style: STYLE_URL[this.styleTheme],
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
      this.bindInteractions(map);
      // Fires for the first style and again after every theme swap (setStyle drops custom layers).
      map.on('style.load', () => {
        this.addSourcesAndLayers(map);
        if (untracked(() => this.ready())) this.resync();
      });
      // Ready as soon as the style is: 'load' would also wait for every base-map tile, and one hung tile would
      // keep the scores off the map.
      map.once('style.load', () => this.zone.run(() => this.ready.set(true)));
    });
  }

  ngOnDestroy(): void {
    this.pins.forEach(({ marker }) => marker.remove());
    this.pins.clear();
    this.map?.remove();
  }

  private addSourcesAndLayers(map: maplibregl.Map): void {
    // Score polygons go under the base map's labels so street and place names stay readable.
    const beforeLabels = map.getStyle().layers.find((layer) => layer.type === 'symbol')?.id;
    map.addSource(SRC_AREAS, { type: 'geojson', data: EMPTY });
    map.addSource(SRC_INFRA, { type: 'geojson', data: EMPTY });
    map.addSource(SRC_AMENITIES, { type: 'geojson', data: EMPTY });
    map.addSource(SRC_MEASURE, { type: 'geojson', data: EMPTY });

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
    }, beforeLabels);
    map.addLayer({
      id: 'areas-line',
      type: 'line',
      source: SRC_AREAS,
      paint: { 'line-color': '#ffffff', 'line-width': 1.6, 'line-opacity': 0.9 },
    }, beforeLabels);
    map.addLayer({
      id: 'areas-selected',
      type: 'line',
      source: SRC_AREAS,
      filter: ['==', ['get', 'slug'], ''],
      paint: { 'line-color': '#0f5ff2', 'line-width': 3.5 },
    }, beforeLabels);
    // The walking circle the selected area's scores were counted in.
    map.addLayer({
      id: 'measure-fill',
      type: 'fill',
      source: SRC_MEASURE,
      paint: { 'fill-color': '#0f5ff2', 'fill-opacity': 0.08 },
    }, beforeLabels);
    map.addLayer({
      id: 'measure-line',
      type: 'line',
      source: SRC_MEASURE,
      paint: { 'line-color': '#0f5ff2', 'line-width': 2, 'line-dasharray': [2, 1.5] },
    }, beforeLabels);

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
      // OSM lines are MultiLineStrings (one piece per mapped way); planned lines are LineStrings.
      ['in', ['geometry-type'], ['literal', ['LineString', 'MultiLineString']]],
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
  }

  /** Puts the current data back on freshly re-created layers (after a theme swap). */
  private resync(): void {
    this.source(SRC_AREAS)?.setData((untracked(() => this.areas()) ?? EMPTY) as unknown as GeoJSON.FeatureCollection);
    this.map?.setFilter('areas-selected', ['==', ['get', 'slug'], untracked(() => this.selectedSlug()) ?? '']);
    this.drawMeasureCircle(untracked(() => this.selectedSlug()));
    this.syncInfrastructure(untracked(() => this.infrastructure()), untracked(() => this.showInfrastructure()), true);
    this.syncAmenities(untracked(() => this.amenities()), true);
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
      const props = feature.properties as { name: string; type: keyof typeof AMENITY_META };
      const body = document.createElement('div');
      const type = document.createElement('div');
      type.className = 'ls-popup__type';
      type.textContent = this.t().amenity[props.type]?.label ?? '';
      const name = document.createElement('strong');
      name.textContent = props.name;
      const source = document.createElement('div');
      source.className = 'ls-popup__type';
      source.textContent = this.t().common.osmSource;
      body.append(type, name, source);
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
    this.drawMeasureCircle(untracked(() => this.selectedSlug()));
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
      pin.element.setAttribute('aria-label', this.t().map.pin(p.name, Math.round(p.value)));
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
    this.drawMeasureCircle(slug);
    const feature = untracked(() => this.areas())?.features.find((f) => f.properties.slug === slug);
    if (feature) {
      const padding = untracked(() => this.padding());
      this.map.easeTo({ center: [feature.properties.lng, feature.properties.lat], padding, duration: 500 });
    }
  }

  private drawMeasureCircle(slug: string | null): void {
    const feature = untracked(() => this.areas())?.features.find((f) => f.properties.slug === slug);
    const data = feature ? circle(feature.properties.lng, feature.properties.lat, MEASURE_KM) : EMPTY;
    this.source(SRC_MEASURE)?.setData(data);
  }

  private syncTheme(theme: 'light' | 'dark', ready: boolean): void {
    if (!ready || !this.map || theme === this.styleTheme) return;
    this.styleTheme = theme;
    // diff: false → a full reload that fires 'style.load', where our layers and data are added back.
    this.map.setStyle(STYLE_URL[theme], { diff: false });
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
