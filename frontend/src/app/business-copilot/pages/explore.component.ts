import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
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
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import * as maplibregl from 'maplibre-gl';
import { EMPTY, catchError, switchMap } from 'rxjs';
import { IconComponent } from '../../living-score/components/icon/icon.component';
import { ThemeService } from '../../services/theme.service';
import { LocationSummary, MapLayers } from '../bc.models';
import { BcApiService, BcStateService, describeError } from '../bc.service';
import { BC_CHARTS } from '../shared/bc-charts';
import { LevelPipe, MoneyPipe } from '../shared/bc-format';
import { BcFiltersComponent } from './market.component';

type LayerKey = 'areas' | 'demand' | 'population' | 'competitors' | 'metro' | 'schools' | 'offices' | 'shopping' | 'roads' | 'developmentZones';

const LAYERS: Array<{ key: LayerKey; label: string; color: string }> = [
  { key: 'areas', label: 'Business Score theo khu vực', color: '#2563eb' },
  { key: 'demand', label: 'Heatmap nhu cầu', color: '#f97316' },
  { key: 'population', label: 'Mật độ dân số', color: '#a855f7' },
  { key: 'competitors', label: 'Đối thủ', color: '#ef4444' },
  { key: 'metro', label: 'Ga & tuyến metro', color: '#0ea5e9' },
  { key: 'schools', label: 'Trường học', color: '#16a34a' },
  { key: 'offices', label: 'Văn phòng', color: '#64748b' },
  { key: 'shopping', label: 'Khu mua sắm', color: '#eab308' },
  { key: 'roads', label: 'Đường chính', color: '#f43f5e' },
  { key: 'developmentZones', label: 'Vùng phát triển', color: '#14b8a6' },
];

const MAP_LAYERS: Record<LayerKey, string[]> = {
  areas: ['areas-fill', 'areas-line'],
  demand: ['heat-demand'],
  population: ['heat-pop'],
  competitors: ['competitors'],
  metro: ['metro-lines', 'metro-planned', 'metro-stations'],
  schools: ['schools'],
  offices: ['offices'],
  shopping: ['shopping'],
  roads: ['roads'],
  developmentZones: ['dev-fill', 'dev-line'],
};

const EMPTY_FC: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] };
const SOURCES = ['areas', 'heat', 'competitors', 'metroLines', 'metroStations', 'schools', 'offices', 'shopping', 'roads', 'developmentZones'] as const;

@Component({
  selector: 'bc-explore',
  standalone: true,
  imports: [IconComponent, RouterLink, BcFiltersComponent, MoneyPipe, LevelPipe, ...BC_CHARTS],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="pg-head">
      <div>
        <p class="bc-eyebrow bc-eyebrow--accent">Explore Locations · Map Explorer</p>
        <h1>Bản đồ tình báo vị trí</h1>
        <p>Bấm một khu vực để xem Business Score. Vị trí điểm là minh hoạ (demo).</p>
      </div>
      <bc-filters />
    </header>
    <div class="ex">
      <aside class="bc-card ex-layers">
        <div class="bc-card__head"><h2>Lớp dữ liệu</h2></div>
        @for (l of layers; track l.key) {
          <label class="ex-toggle">
            <input type="checkbox" [checked]="visible().has(l.key)" (change)="toggle(l.key)" />
            <span class="ex-sw" [style.background]="l.color"></span>{{ l.label }}
          </label>
        }
        @if (error(); as e) { <p class="ex-err" role="alert">{{ e }}</p> }
      </aside>

      <div class="ex-map bc-card">
        <div #host class="ex-host" role="application" aria-label="Bản đồ Hà Nội"></div>
        @if (loading()) { <div class="ex-loading"><span class="bc-spinner"></span> Đang tải lớp bản đồ…</div> }
      </div>

      <aside class="bc-card ex-side">
        @if (selected(); as s) {
          <div class="ex-sel">
            <bc-ring [score]="s.businessScore" [size]="72" />
            <div><p class="bc-eyebrow">#{{ s.rank }} · Business Score</p><h2>{{ s.name }}</h2><p class="ex-cluster">{{ s.cluster }}</p></div>
          </div>
          <div class="ex-bars">
            <span>Nhu cầu</span><bc-bar [value]="s.scores.demand" /><b>{{ s.scores.demand }}</b>
            <span>Cạnh tranh</span><bc-bar [value]="s.scores.competition" /><b>{{ s.scores.competition }}</b>
            <span>Giá thuê</span><bc-bar [value]="s.scores.rent" /><b>{{ s.scores.rent }}</b>
            <span>Lưu lượng</span><bc-bar [value]="s.scores.traffic" /><b>{{ s.scores.traffic }}</b>
            <span>Tiếp cận</span><bc-bar [value]="s.scores.accessibility" /><b>{{ s.scores.accessibility }}</b>
            <span>Tăng trưởng</span><bc-bar [value]="s.scores.growth" /><b>{{ s.scores.growth }}</b>
          </div>
          <dl class="ex-facts">
            <dt>Thuê ước tính</dt><dd>{{ s.estRentMillions | money }}/tháng</dd>
            <dt>Doanh thu</dt><dd>{{ s.revenuePotentialMillions | money }}/tháng</dd>
            <dt>Cạnh tranh</dt><dd [class]="'bc-level--' + s.competitionLabel">{{ s.competitionLabel | level }}</dd>
            <dt>Hoà vốn</dt><dd>{{ s.breakEvenMonth ? 'Tháng ' + s.breakEvenMonth : '> 18 tháng' }}</dd>
          </dl>
          <a class="bc-btn bc-btn--primary" [routerLink]="['/business-copilot/location', s.slug]">Xem phân tích đầy đủ →</a>
        } @else {
          <div class="bc-state"><ls-icon name="pin" [size]="24" /><p>Chọn một khu vực trên bản đồ hoặc trong danh sách.</p></div>
        }
        <ol class="ex-list">
          @for (r of ranking(); track r.slug) {
            <li><button type="button" [class.is-on]="r.slug === state.selected()" (click)="pick(r.slug, true)"><span>{{ r.rank }}. {{ r.name }}</span><b>{{ r.businessScore }}</b></button></li>
          }
        </ol>
      </aside>
    </div>
  `,
  styles: [
    `
      :host{display:block}
      .ex{display:grid;grid-template-columns:230px minmax(0,1fr) 300px;gap:14px;margin-top:12px;height:calc(100dvh - var(--site-nav-h,0px) - var(--bc-topbar-h) - 160px);min-height:560px}
      .ex-layers,.ex-side{overflow-y:auto}
      .ex-toggle{display:flex;align-items:center;gap:8px;padding:6px 2px;font-size:13px;cursor:pointer}
      .ex-sw{width:10px;height:10px;border-radius:3px;flex:none}
      .ex-err{margin-top:10px;color:var(--bc-bad);font-size:12px}
      .ex-map{position:relative;padding:0;overflow:hidden}
      .ex-host{position:absolute;inset:0}
      .ex-loading{position:absolute;left:50%;top:14px;transform:translateX(-50%);display:flex;gap:8px;align-items:center;padding:8px 14px;border-radius:999px;background:var(--bc-surface);box-shadow:var(--bc-shadow);font-size:13px}
      .ex-sel{display:flex;gap:12px;align-items:center;margin-bottom:12px}
      .ex-sel h2{font-size:19px;font-weight:800}
      .ex-cluster{font-size:12px;color:var(--bc-faint)}
      .ex-bars{display:grid;grid-template-columns:78px 1fr 26px;gap:7px 10px;align-items:center;font-size:12.5px;margin-bottom:12px}
      .ex-bars b{text-align:right}
      .ex-facts{display:grid;grid-template-columns:auto 1fr;gap:5px 10px;margin:0 0 12px;font-size:12.5px}
      .ex-facts dt{color:var(--bc-faint)}
      .ex-facts dd{margin:0;text-align:right;font-weight:700}
      .ex-list{list-style:none;margin:14px 0 0;padding:12px 0 0;border-top:1px solid var(--bc-line);display:grid;gap:3px}
      .ex-list button{width:100%;display:flex;justify-content:space-between;padding:6px 8px;border:0;border-radius:8px;background:none;font-size:13px}
      .ex-list button:hover,.ex-list button.is-on{background:var(--bc-accent-bg)}
      @media (max-width:1200px){.ex{grid-template-columns:minmax(0,1fr) 290px;height:auto}.ex-layers{grid-column:1/-1;display:flex;flex-wrap:wrap;gap:4px 14px}.ex-layers .bc-card__head{width:100%}.ex-map{height:560px}}
      @media (max-width:760px){.ex{grid-template-columns:1fr}.ex-map{height:420px}}
    `,
  ],
})
export class BcExploreComponent implements AfterViewInit, OnDestroy {
  private readonly api = inject(BcApiService);
  protected readonly state = inject(BcStateService);
  private readonly zone = inject(NgZone);
  private readonly theme = inject(ThemeService);
  private readonly destroyRef = inject(DestroyRef);
  @ViewChild('host', { static: true }) private host!: ElementRef<HTMLDivElement>;

  protected readonly layers = LAYERS;
  protected readonly visible = signal<ReadonlySet<LayerKey>>(new Set<LayerKey>(['areas', 'demand', 'competitors', 'metro']));
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly ranking = signal<LocationSummary[]>([]);
  protected readonly selected = computed(() => this.ranking().find((r) => r.slug === this.state.selected()) ?? null);

  private map?: maplibregl.Map;
  private readonly ready = signal(false);
  private readonly data = signal<MapLayers | null>(null);

  constructor() {
    toObservable(computed(() => ({ c: this.state.category(), b: this.state.budgetVnd() })))
      .pipe(
        switchMap(({ c, b }) => {
          this.loading.set(true);
          this.api.recommendations(c, b).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({ next: (r) => this.ranking.set(r.recommendations) });
          return this.api.mapLayers(c, b).pipe(
            catchError((e: unknown) => {
              this.error.set(describeError(e));
              this.loading.set(false);
              return EMPTY;
            }),
          );
        }),
        takeUntilDestroyed(),
      )
      .subscribe((d) => {
        this.error.set(null);
        this.data.set(d);
        this.loading.set(false);
      });

    effect(() => {
      const d = this.data();
      if (!this.ready() || !d) return;
      untracked(() => {
        for (const id of SOURCES) (this.map?.getSource(id) as maplibregl.GeoJSONSource | undefined)?.setData(d.layers[id]);
      });
    });
    effect(() => {
      const v = this.visible();
      if (!this.ready()) return;
      untracked(() => {
        for (const [key, ids] of Object.entries(MAP_LAYERS) as Array<[LayerKey, string[]]>) {
          for (const id of ids) if (this.map?.getLayer(id)) this.map.setLayoutProperty(id, 'visibility', v.has(key) ? 'visible' : 'none');
        }
      });
    });
    effect(() => {
      const slug = this.state.selected();
      if (!this.ready()) return;
      untracked(() => this.map?.setFilter('areas-selected', ['==', ['get', 'slug'], slug ?? '']));
    });
    effect(() => {
      const dark = this.theme.effective() === 'dark';
      if (!this.ready()) return;
      untracked(() => {
        this.map?.setPaintProperty('base', 'raster-brightness-max', dark ? 0.4 : 1);
        this.map?.setPaintProperty('base', 'raster-saturation', dark ? -0.8 : -0.5);
      });
    });
  }

  ngAfterViewInit(): void {
    this.zone.runOutsideAngular(() => {
      const src = (): maplibregl.GeoJSONSourceSpecification => ({ type: 'geojson', data: EMPTY_FC });
      const circle = (id: string, source: string, color: string, radius = 4): maplibregl.LayerSpecification => ({
        id,
        type: 'circle',
        source,
        paint: { 'circle-color': color, 'circle-radius': ['interpolate', ['linear'], ['zoom'], 10, radius * 0.6, 14, radius * 1.4], 'circle-stroke-color': '#fff', 'circle-stroke-width': 1 },
      });
      const map = new maplibregl.Map({
        container: this.host.nativeElement,
        style: {
          version: 8,
          sources: {
            osm: { type: 'raster', tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'], tileSize: 256, maxzoom: 19, attribution: '© OpenStreetMap contributors' },
            ...Object.fromEntries(SOURCES.map((s) => [s, src()])),
          },
          layers: [
            { id: 'bg', type: 'background', paint: { 'background-color': '#e8edf3' } },
            { id: 'base', type: 'raster', source: 'osm', paint: { 'raster-saturation': -0.5, 'raster-brightness-max': 1 } },
            { id: 'dev-fill', type: 'fill', source: 'developmentZones', paint: { 'fill-color': '#14b8a6', 'fill-opacity': 0.08 } },
            { id: 'dev-line', type: 'line', source: 'developmentZones', paint: { 'line-color': '#14b8a6', 'line-width': 1.5, 'line-dasharray': [3, 2] } },
            {
              id: 'areas-fill',
              type: 'fill',
              source: 'areas',
              paint: {
                'fill-color': ['interpolate', ['linear'], ['get', 'businessScore'], 60, '#fca5a5', 72, '#fcd34d', 82, '#93c5fd', 90, '#2563eb'],
                'fill-opacity': 0.32,
              },
            },
            { id: 'areas-line', type: 'line', source: 'areas', paint: { 'line-color': '#1d4ed8', 'line-width': 1.2, 'line-opacity': 0.7 } },
            { id: 'areas-selected', type: 'line', source: 'areas', filter: ['==', ['get', 'slug'], ''], paint: { 'line-color': '#0f172a', 'line-width': 3.5 } },
            {
              id: 'heat-demand',
              type: 'heatmap',
              source: 'heat',
              paint: {
                'heatmap-weight': ['get', 'demand'],
                'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 9, 14, 14, 40],
                'heatmap-intensity': 0.9,
                'heatmap-opacity': 0.55,
                'heatmap-color': ['interpolate', ['linear'], ['heatmap-density'], 0, 'rgba(0,0,0,0)', 0.3, '#fde68a', 0.6, '#fb923c', 1, '#dc2626'],
              },
            },
            {
              id: 'heat-pop',
              type: 'heatmap',
              source: 'heat',
              layout: { visibility: 'none' },
              paint: {
                'heatmap-weight': ['get', 'population'],
                'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 9, 14, 14, 40],
                'heatmap-opacity': 0.5,
                'heatmap-color': ['interpolate', ['linear'], ['heatmap-density'], 0, 'rgba(0,0,0,0)', 0.4, '#d8b4fe', 1, '#7e22ce'],
              },
            },
            { id: 'roads', type: 'line', source: 'roads', layout: { 'line-cap': 'round', visibility: 'none' }, paint: { 'line-color': '#f43f5e', 'line-width': 2, 'line-opacity': 0.7 } },
            { id: 'metro-lines', type: 'line', source: 'metroLines', filter: ['==', ['get', 'status'], 'operating'], layout: { 'line-cap': 'round' }, paint: { 'line-color': '#0ea5e9', 'line-width': 3.5 } },
            { id: 'metro-planned', type: 'line', source: 'metroLines', filter: ['!=', ['get', 'status'], 'operating'], paint: { 'line-color': '#0ea5e9', 'line-width': 2.5, 'line-dasharray': [2, 1.5], 'line-opacity': 0.8 } },
            circle('metro-stations', 'metroStations', '#0369a1', 4),
            circle('schools', 'schools', '#16a34a', 3.5),
            circle('offices', 'offices', '#64748b', 3.5),
            circle('shopping', 'shopping', '#eab308', 4.5),
            circle('competitors', 'competitors', '#ef4444', 3.5),
          ],
        },
        bounds: [
          [105.72, 20.93],
          [106.0, 21.1],
        ],
        fitBoundsOptions: { padding: 30 },
        attributionControl: { compact: true },
      });
      this.map = map;
      map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
      map.on('load', () => {
        for (const id of ['schools', 'offices', 'shopping', 'dev-fill', 'dev-line']) map.setLayoutProperty(id, 'visibility', 'none');
        map.on('click', 'areas-fill', (e) => {
          const slug = e.features?.[0]?.properties?.['slug'];
          if (typeof slug === 'string') this.zone.run(() => this.pick(slug, false));
        });
        map.on('mouseenter', 'areas-fill', () => (map.getCanvas().style.cursor = 'pointer'));
        map.on('mouseleave', 'areas-fill', () => (map.getCanvas().style.cursor = ''));
        this.zone.run(() => this.ready.set(true));
      });
    });
  }

  ngOnDestroy(): void {
    this.map?.remove();
  }

  protected toggle(key: LayerKey): void {
    const next = new Set(this.visible());
    if (!next.delete(key)) next.add(key);
    this.visible.set(next);
  }

  protected pick(slug: string, fly: boolean): void {
    this.state.set({ selected: slug });
    const r = this.ranking().find((x) => x.slug === slug);
    if (fly && r) this.map?.flyTo({ center: r.center, zoom: 12.6, duration: 900 });
  }
}
