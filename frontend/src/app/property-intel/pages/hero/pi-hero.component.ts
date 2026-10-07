import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  NgZone,
  OnDestroy,
  ViewChild,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import * as maplibregl from 'maplibre-gl';
import { catchError, of, switchMap } from 'rxjs';
import { ThemeService } from '../../../services/theme.service';
import { baseStyle, firstSymbolLayer, overlayPalette } from '../../components/pi-map-style';
import { formatDistance, formatInt, formatNum } from '../../pi-format';
import { MapLayers } from '../../pi.models';
import { PiApiService, PiStateService } from '../../pi.service';

/** 03 · Hero / entry — the product pitch with a live map of the featured ward behind it. */
@Component({
  selector: 'pi-hero',
  standalone: true,
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './pi-hero.component.html',
  styleUrl: './pi-hero.component.css',
})
export class PiHeroComponent implements AfterViewInit, OnDestroy {
  private readonly api = inject(PiApiService);
  protected readonly state = inject(PiStateService);
  private readonly router = inject(Router);
  private readonly zone = inject(NgZone);
  protected readonly theme = inject(ThemeService);
  protected readonly t = this.state.t;

  @ViewChild('mapHost', { static: true }) private mapHost!: ElementRef<HTMLDivElement>;
  private map?: maplibregl.Map;
  private styleToken = 0;

  protected readonly overview = toSignal(toObservable(this.state.lang).pipe(switchMap((lang) => this.api.overview(lang).pipe(catchError(() => of(null))))), { initialValue: null });
  private readonly layers = toSignal(toObservable(this.state.lang).pipe(switchMap((lang) => this.api.map(2026, lang).pipe(catchError(() => of(null))))), { initialValue: null });
  protected readonly offline = computed(() => this.overview() === null && this.layers() === null);

  protected readonly question = signal('');
  protected readonly placeholder = computed(() => this.overview()?.defaultQuestion ?? '');
  protected readonly formatInt = formatInt;
  protected readonly formatDistance = formatDistance;
  protected readonly formatNum = formatNum;

  constructor() {
    effect(() => {
      this.layers();
      this.overview();
      this.theme.effective();
      untracked(() => this.map && this.draw());
    });
  }

  ngAfterViewInit(): void {
    this.zone.runOutsideAngular(() => {
      this.map = new maplibregl.Map({
        container: this.mapHost.nativeElement,
        style: { version: 8, sources: {}, layers: [{ id: 'background', type: 'background', paint: { 'background-color': '#0a101c' } }] },
        center: [105.9, 21.05],
        zoom: 11.3,
        pitch: 48,
        bearing: -16,
        interactive: false,
        attributionControl: { compact: true },
      });
      this.draw();
    });
  }

  ngOnDestroy(): void {
    this.map?.remove();
  }

  /** Basemap, then the featured ward, the metro and its TOD rings, and the bridges / Ring Road 4 being built. */
  private draw(): void {
    const map = this.map!;
    const theme = this.theme.effective();
    const data: MapLayers | null = this.layers();
    const token = ++this.styleToken;
    void baseStyle('map', theme).then((style) => {
      if (token !== this.styleToken) return;
      const before = firstSymbolLayer(style);
      map.setStyle(style, { diff: false });
      map.once('style.load', () => {
        if (token !== this.styleToken || !data) return;
        const p = overlayPalette(theme);
        const featured = this.overview()?.featured.slug ?? '';
        map.addSource('h-wards', { type: 'geojson', data: data.layers.wards });
        map.addSource('h-tod', { type: 'geojson', data: data.layers.tod });
        map.addSource('h-metro', { type: 'geojson', data: data.layers.metro });
        map.addSource('h-infra', { type: 'geojson', data: data.layers.infrastructure });
        const isFeatured: maplibregl.FilterSpecification = ['==', ['get', 'slug'], featured];
        map.addLayer({ id: 'h-ward', type: 'fill', source: 'h-wards', filter: isFeatured, paint: { 'fill-color': p.green, 'fill-opacity': 0.16 } }, before);
        map.addLayer({ id: 'h-ward-line', type: 'line', source: 'h-wards', filter: isFeatured, paint: { 'line-color': p.green, 'line-width': 2.4 } }, before);
        map.addLayer({ id: 'h-tod', type: 'fill', source: 'h-tod', paint: { 'fill-color': p.cyan, 'fill-opacity': 0.08 } }, before);
        map.addLayer({ id: 'h-infra', type: 'line', source: 'h-infra', paint: { 'line-color': p.amber, 'line-width': 3.5, 'line-dasharray': [2.5, 1.5] } });
        map.addLayer({ id: 'h-metro', type: 'line', source: 'h-metro', layout: { 'line-cap': 'round' }, paint: { 'line-color': ['coalesce', ['get', 'color'], p.cyan], 'line-width': 4, 'line-opacity': 0.9 } });

        const ward = data.layers.wards.features.find((f) => (f.properties as { slug: string }).slug === featured);
        if (!ward) return;
        const polys = ward.geometry.type === 'Polygon' ? [ward.geometry.coordinates] : (ward.geometry as GeoJSON.MultiPolygon).coordinates;
        const first = polys[0][0][0] as [number, number];
        const bounds = new maplibregl.LngLatBounds(first, first);
        for (const poly of polys) for (const c of poly[0]) bounds.extend(c as [number, number]);
        const w = this.mapHost.nativeElement.clientWidth;
        const wide = w > 1100;
        map.fitBounds(bounds, {
          padding: { top: 140, bottom: 140, left: wide ? Math.round(w * 0.5) : 40, right: wide ? 200 : 40 },
          pitch: 48,
          bearing: -16,
          duration: 0,
          maxZoom: 13,
        });
      });
    });
  }

  protected ask(): void {
    const q = this.question().trim() || this.placeholder();
    if (!q) return;
    const featured = this.overview()?.featured.slug;
    if (featured && !this.question().trim()) this.state.set('ward', featured);
    this.state.ask(q);
    void this.router.navigate(['/property-intelligence/map']);
  }

  protected openFeatured(): void {
    const featured = this.overview()?.featured.slug;
    if (featured) this.state.set('ward', featured);
    void this.router.navigate(['/property-intelligence/map']);
  }
}
