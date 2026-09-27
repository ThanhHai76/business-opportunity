import { ChangeDetectionStrategy, Component, ViewChild, computed, inject, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { catchError, map, of, startWith, switchMap } from 'rxjs';
import { ThemeService } from '../../../services/theme.service';
import { PiAiPanelComponent } from '../../components/pi-ai-panel.component';
import { PiAreaMapComponent } from '../../components/pi-area-map.component';
import { PiPerM2Pipe, areaPoints, formatInt, formatPerM2, linePoints, perM2Unit } from '../../pi-format';
import { Basemap, DistrictDetail, Horizon, LayerKey, Lens, MapLayers } from '../../pi.models';
import { PiApiService, PiStateService, describeError } from '../../pi.service';

type Load<T> = { status: 'loading' } | { status: 'error'; message: string } | { status: 'ok'; value: T };

interface LayerRow {
  key: LayerKey;
  label: string;
  swatch: string;
}

const LAYER_GROUPS: { title: string; rows: LayerRow[] }[] = [
  {
    title: 'Planning',
    rows: [
      { key: 'planning', label: 'Planning zones', swatch: 'zone' },
      { key: 'development', label: 'Development projects', swatch: 'dev' },
    ],
  },
  {
    title: 'Mobility',
    rows: [
      { key: 'metro', label: 'Metro / railway', swatch: 'metro' },
      { key: 'tod', label: 'TOD areas', swatch: 'tod' },
      { key: 'infrastructure', label: 'Major infrastructure', swatch: 'infra' },
    ],
  },
  {
    title: 'Market',
    rows: [
      { key: 'projects', label: 'Property projects', swatch: 'project' },
      { key: 'heatmap', label: 'Price heatmap', swatch: 'heat' },
    ],
  },
  {
    title: 'Social',
    rows: [
      { key: 'social', label: 'Schools & hospitals', swatch: 'social' },
      { key: 'density', label: 'Population density', swatch: 'density' },
      { key: 'green', label: 'Green spaces', swatch: 'green' },
    ],
  },
];

const PRESETS: { label: string; layers: LayerKey[] }[] = [
  { label: 'Investor', layers: ['planning', 'development', 'metro', 'tod', 'infrastructure', 'projects', 'heatmap'] },
  { label: 'Family', layers: ['metro', 'projects', 'social', 'green', 'density'] },
  { label: 'Infrastructure', layers: ['metro', 'tod', 'infrastructure', 'planning'] },
  { label: 'Everything', layers: ['planning', 'development', 'metro', 'tod', 'infrastructure', 'projects', 'heatmap', 'social', 'density', 'green'] },
];

const LENSES: { value: Lens; label: string }[] = [
  { value: 'growth', label: 'Growth lens' },
  { value: 'price', label: 'Price lens' },
  { value: 'risk', label: 'Risk lens' },
];

/** 01 · Main dashboard — area intelligence + AI analyst. */
@Component({
  selector: 'pi-dashboard',
  standalone: true,
  imports: [RouterLink, PiAreaMapComponent, PiAiPanelComponent, PiPerM2Pipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './pi-dashboard.component.html',
  styleUrl: './pi-dashboard.component.css',
})
export class PiDashboardComponent {
  protected readonly state = inject(PiStateService);
  private readonly api = inject(PiApiService);
  private readonly router = inject(Router);
  protected readonly theme = inject(ThemeService);

  @ViewChild(PiAreaMapComponent) private mapCmp?: PiAreaMapComponent;

  protected readonly groups = LAYER_GROUPS;
  protected readonly presets = PRESETS;
  protected readonly lenses = LENSES;
  protected readonly basemaps: { value: Basemap; label: string }[] = [
    { value: 'satellite', label: 'Satellite' },
    { value: 'dark', label: 'Dark' },
    { value: 'terrain', label: 'Terrain' },
  ];
  protected readonly horizons: Horizon[] = [2026, 2030, 2045];
  protected readonly presetsOpen = signal(false);
  protected readonly layersOpen = signal(false);
  protected readonly is3d = signal(false);

  protected readonly layers = toSignal(
    toObservable(this.state.horizon).pipe(
      switchMap((h) =>
        this.api.map(h).pipe(
          map((value): Load<MapLayers> => ({ status: 'ok', value })),
          catchError((err) => of<Load<MapLayers>>({ status: 'error', message: describeError(err) })),
          startWith<Load<MapLayers>>({ status: 'loading' }),
        ),
      ),
    ),
    { initialValue: { status: 'loading' } as Load<MapLayers> },
  );
  protected readonly layerData = computed(() => {
    const l = this.layers();
    return l.status === 'ok' ? l.value : null;
  });
  protected readonly layerError = computed(() => {
    const l = this.layers();
    return l.status === 'error' ? l.message : null;
  });

  protected readonly detail = toSignal(
    toObservable(this.state.district).pipe(
      switchMap((slug) =>
        this.api.district(slug).pipe(
          map((value): Load<DistrictDetail> => ({ status: 'ok', value })),
          catchError((err) => of<Load<DistrictDetail>>({ status: 'error', message: describeError(err) })),
          startWith<Load<DistrictDetail>>({ status: 'loading' }),
        ),
      ),
    ),
    { initialValue: { status: 'loading' } as Load<DistrictDetail> },
  );
  protected readonly d = computed(() => {
    const x = this.detail();
    return x.status === 'ok' ? x.value : null;
  });

  protected readonly unit = computed(() => perM2Unit(this.state.currency()));
  protected readonly priceFormatter = computed(() => {
    const currency = this.state.currency();
    const rate = this.state.vndPerUsd();
    return (tr: number) => `${formatPerM2(tr, currency, rate)}/m²`;
  });
  protected readonly legendTicks = computed(() => {
    const currency = this.state.currency();
    const rate = this.state.vndPerUsd();
    return [35, 90, 160, 250].map((v, i) => (currency === 'VND' ? `${v}${i === 3 ? '+' : ''}` : `${formatPerM2(v, currency, rate)}${i === 3 ? '+' : ''}`));
  });

  // ---------------------------------------------------------------- charts
  protected readonly priceChart = computed(() => {
    const d = this.d();
    if (!d) return null;
    const all = [...d.priceTrend.district, ...d.priceTrend.city];
    const min = Math.min(...all) * 0.92;
    const max = Math.max(...all) * 1.04;
    return {
      line: linePoints(d.priceTrend.district, 260, 110, min, max),
      area: areaPoints(d.priceTrend.district, 260, 110, min, max),
      city: linePoints(d.priceTrend.city, 260, 110, min, max),
    };
  });

  protected readonly supplyMax = computed(() => {
    const d = this.d();
    return d ? Math.max(...d.supplyDemand.flatMap((s) => [s.supply, s.demand])) : 1;
  });

  protected readonly popChart = computed(() => {
    const d = this.d();
    if (!d) return null;
    const [p2020, p2026, p2030] = d.population.points.map((p) => p.value);
    const min = p2020 * 0.9;
    const max = p2030 * 1.03;
    const y = (v: number) => Math.round((90 - 6 - ((v - min) / (max - min)) * 78) * 10) / 10;
    const pts = { a: `0,${y(p2020)}`, b: `120,${y(p2026)}`, c: `200,${y(p2030)}` };
    return { solid: `${pts.a} ${pts.b}`, dashed: `${pts.b} ${pts.c}`, area: `${pts.a} ${pts.b} ${pts.c} 200,90 0,90`, nowY: y(p2026) };
  });

  protected readonly timelineCols = computed(() => {
    const d = this.d();
    if (!d) return [];
    return Array.from({ length: d.timeline.to - d.timeline.from + 1 }, (_, i) => String(d.timeline.from + i).slice(2));
  });

  protected readonly nowPct = computed(() => {
    const d = this.d();
    if (!d) return 0;
    const span = d.timeline.to - d.timeline.from + 1;
    return ((d.timeline.now - d.timeline.from + 0.5) / span) * 100;
  });

  protected readonly ringDash = computed(() => {
    const score = this.d()?.growthScore ?? 0;
    const c = 2 * Math.PI * 44;
    return `${(score / 100) * c} ${c}`;
  });

  protected readonly formatInt = formatInt;

  // ---------------------------------------------------------------- actions
  protected toggle(key: LayerKey): void {
    this.state.toggleLayer(key);
  }

  protected applyPreset(layers: LayerKey[]): void {
    const current = this.state.layers();
    for (const key of Object.keys(current) as LayerKey[]) {
      if (current[key] !== layers.includes(key)) this.state.toggleLayer(key);
    }
    this.presetsOpen.set(false);
  }

  protected selectDistrict(slug: string): void {
    this.state.set('district', slug);
  }

  protected openProject(slug: string): void {
    void this.router.navigate(['/property-intelligence/projects', slug]);
  }

  protected zoom(dir: 1 | -1): void {
    if (dir === 1) this.mapCmp?.zoomIn();
    else this.mapCmp?.zoomOut();
  }

  protected toggle3d(): void {
    this.is3d.set(this.mapCmp?.toggle3d() ?? false);
  }

  protected setLens(value: string): void {
    this.state.set('lens', value as Lens);
  }

  /** Right inset for fitBounds: the floating AI panel only overlays the map on wide screens. */
  protected rightInset(): number {
    return typeof window !== 'undefined' && window.innerWidth > 1280 ? 400 : 0;
  }
}
