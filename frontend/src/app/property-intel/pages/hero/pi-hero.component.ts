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
import { toSignal } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import * as maplibregl from 'maplibre-gl';
import { catchError, of } from 'rxjs';
import { ThemeService } from '../../../services/theme.service';
import { BASEMAPS, overlayPalette } from '../../components/pi-map-style';
import { formatInt } from '../../pi-format';
import { MapLayers } from '../../pi.models';
import { PiApiService, PiStateService } from '../../pi.service';

/** 03 · Hero / entry — the product pitch with a live map behind it. */
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
  private readonly state = inject(PiStateService);
  private readonly router = inject(Router);
  private readonly zone = inject(NgZone);
  protected readonly theme = inject(ThemeService);

  @ViewChild('mapHost', { static: true }) private mapHost!: ElementRef<HTMLDivElement>;
  private map?: maplibregl.Map;
  private mapReady = false;

  protected readonly overview = toSignal(this.api.overview().pipe(catchError(() => of(null))), { initialValue: null });
  private readonly layers = toSignal(this.api.map(2030).pipe(catchError(() => of(null))), { initialValue: null });
  protected readonly offline = computed(() => this.overview() === null && this.layers() === null);

  protected readonly question = signal('');
  protected readonly placeholder = computed(() => this.overview()?.defaultQuestion ?? 'Is Gia Lâm a good area to buy for the next 5 years?');
  protected readonly formatInt = formatInt;

  constructor() {
    effect(() => {
      const layers = this.layers();
      this.theme.effective();
      untracked(() => this.mapReady && this.draw(layers));
    });
  }

  ngAfterViewInit(): void {
    this.zone.runOutsideAngular(() => {
      const map = new maplibregl.Map({
        container: this.mapHost.nativeElement,
        style: { version: 8, sources: {}, layers: [{ id: 'bg', type: 'background', paint: { 'background-color': '#0a101c' } }] },
        center: [105.9, 21.05],
        zoom: 11.3,
        pitch: 48,
        bearing: -16,
        interactive: false,
        attributionControl: { compact: true },
      });
      this.map = map;
      map.on('load', () => {
        this.mapReady = true;
        this.draw(this.layers());
      });
    });
  }

  ngOnDestroy(): void {
    this.map?.remove();
  }

  private draw(data: MapLayers | null): void {
    const map = this.map!;
    const theme = this.theme.effective();
    const p = overlayPalette(theme);
    const spec = BASEMAPS[theme === 'dark' ? 'satellite' : 'dark'](theme);
    for (const id of ['h-district', 'h-district-line', 'h-tod', 'h-tod-line', 'h-metro', 'base']) if (map.getLayer(id)) map.removeLayer(id);
    for (const id of ['h-districts', 'h-tod', 'h-metro', 'base']) if (map.getSource(id)) map.removeSource(id);
    map.setPaintProperty('bg', 'background-color', theme === 'dark' ? '#0a101c' : '#eef2f7');
    map.addSource('base', { type: 'raster', tiles: spec.tiles, tileSize: 256, maxzoom: spec.maxzoom, attribution: spec.attribution });
    map.addLayer({ id: 'base', type: 'raster', source: 'base', paint: theme === 'dark' ? { 'raster-brightness-max': 0.5, 'raster-saturation': -0.4 } : spec.paint });
    if (!data) return;

    const featured = this.overview()?.featured.slug ?? 'gia-lam';
    map.addSource('h-districts', { type: 'geojson', data: data.layers.districts });
    map.addSource('h-tod', { type: 'geojson', data: data.layers.tod });
    map.addSource('h-metro', { type: 'geojson', data: data.layers.metro });
    map.addLayer({ id: 'h-district', type: 'fill', source: 'h-districts', filter: ['==', ['get', 'slug'], featured], paint: { 'fill-color': p.green, 'fill-opacity': 0.1 } });
    map.addLayer({ id: 'h-district-line', type: 'line', source: 'h-districts', filter: ['==', ['get', 'slug'], featured], paint: { 'line-color': p.green, 'line-width': 2 } });
    map.addLayer({ id: 'h-tod', type: 'fill', source: 'h-tod', paint: { 'fill-color': p.cyan, 'fill-opacity': 0.07 } });
    map.addLayer({ id: 'h-tod-line', type: 'line', source: 'h-tod', paint: { 'line-color': p.cyan, 'line-width': 1.4, 'line-dasharray': [3, 3] } });
    map.addLayer({ id: 'h-metro', type: 'line', source: 'h-metro', layout: { 'line-cap': 'round' }, paint: { 'line-color': p.cyan, 'line-width': 4, 'line-dasharray': [3, 1.8], 'line-opacity': 0.85 } });

    const cell = data.layers.districts.features.find((f) => (f.properties as { slug: string }).slug === featured);
    if (cell) {
      const ring = (cell.geometry as GeoJSON.Polygon).coordinates[0] as [number, number][];
      const bounds = ring.reduce((b, c) => b.extend(c), new maplibregl.LngLatBounds(ring[0], ring[0]));
      const w = this.mapHost.nativeElement.clientWidth;
      const wide = w > 1100;
      map.fitBounds(bounds, {
        padding: { top: 120, bottom: 120, left: wide ? Math.round(w * 0.5) : 40, right: wide ? 160 : 40 },
        pitch: 48,
        bearing: -16,
        duration: 0,
        maxZoom: 12.4,
      });
    }
  }

  protected ask(): void {
    const q = this.question().trim() || this.placeholder();
    this.state.ask(q);
    void this.router.navigate(['/property-intelligence/map']);
  }
}
