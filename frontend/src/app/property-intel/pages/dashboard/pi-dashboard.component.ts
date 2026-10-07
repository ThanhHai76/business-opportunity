import { ChangeDetectionStrategy, Component, ViewChild, computed, inject, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { catchError, map, of, startWith, switchMap } from 'rxjs';
import { ThemeService } from '../../../services/theme.service';
import { PiAiPanelComponent } from '../../components/pi-ai-panel.component';
import { PiAreaMapComponent } from '../../components/pi-area-map.component';
import { LAND_STOPS } from '../../components/pi-area-map.component';
import { PiDistancePipe, PiNumPipe, areaPoints, formatInt, formatNum, linePoints } from '../../pi-format';
import { PiText } from '../../pi-i18n';
import { Basemap, Horizon, LayerKey, Lens, MapLayers, WardDetail } from '../../pi.models';
import { PiApiService, PiStateService, describeError } from '../../pi.service';

type Load<T> = { status: 'loading' } | { status: 'error'; message: string } | { status: 'ok'; value: T };

interface LayerRow {
  key: LayerKey;
  swatch: string;
}

const LAYER_GROUPS: { key: keyof PiText['layerGroups']; rows: LayerRow[] }[] = [
  { key: 'planning', rows: [{ key: 'planning', swatch: 'zone' }, { key: 'development', swatch: 'dev' }] },
  { key: 'mobility', rows: [{ key: 'metro', swatch: 'metro' }, { key: 'tod', swatch: 'tod' }, { key: 'infrastructure', swatch: 'infra' }] },
  { key: 'social', rows: [{ key: 'social', swatch: 'social' }, { key: 'density', swatch: 'density' }, { key: 'green', swatch: 'green' }] },
  { key: 'market', rows: [{ key: 'projects', swatch: 'project' }] },
];

const PRESETS: { key: keyof PiText['presetNames']; layers: LayerKey[] }[] = [
  { key: 'investor', layers: ['planning', 'development', 'metro', 'tod', 'infrastructure', 'projects'] },
  { key: 'family', layers: ['metro', 'social', 'green', 'density'] },
  { key: 'infra', layers: ['metro', 'tod', 'infrastructure', 'planning'] },
  { key: 'all', layers: ['planning', 'development', 'metro', 'tod', 'infrastructure', 'projects', 'social', 'density', 'green'] },
];

const LENSES: Lens[] = ['potential', 'connectivity', 'infrastructure', 'landPrice'];

/** 01 · Map Intelligence — ward intelligence, official land price, city market (all sourced) + AI analyst. */
@Component({
  selector: 'pi-dashboard',
  standalone: true,
  imports: [RouterLink, PiAreaMapComponent, PiAiPanelComponent, PiNumPipe, PiDistancePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './pi-dashboard.component.html',
  styleUrl: './pi-dashboard.component.css',
})
export class PiDashboardComponent {
  protected readonly state = inject(PiStateService);
  private readonly api = inject(PiApiService);
  private readonly router = inject(Router);
  protected readonly theme = inject(ThemeService);
  protected readonly t = this.state.t;

  @ViewChild(PiAreaMapComponent) private mapCmp?: PiAreaMapComponent;

  protected readonly groups = LAYER_GROUPS;
  protected readonly presets = PRESETS;
  protected readonly lenses = LENSES;
  protected readonly basemaps: Basemap[] = ['map', 'satellite'];
  protected readonly horizons: Horizon[] = [2026, 2030, 2045];
  protected readonly presetsOpen = signal(false);
  protected readonly layersOpen = signal(false);
  protected readonly is3d = signal(false);
  protected readonly methodOpen = signal(false);

  protected readonly layers = toSignal(
    toObservable(computed(() => ({ horizon: this.state.horizon(), lang: this.state.lang() }))).pipe(
      switchMap(({ horizon, lang }) =>
        this.api.map(horizon, lang).pipe(
          map((value): Load<MapLayers> => ({ status: 'ok', value })),
          catchError((err) => of<Load<MapLayers>>({ status: 'error', message: describeError(err, lang) })),
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

  private readonly retry = signal(0);
  protected readonly detail = toSignal(
    toObservable(computed(() => ({ slug: this.state.ward(), lang: this.state.lang(), retry: this.retry() }))).pipe(
      switchMap(({ slug, lang }) =>
        this.api.ward(slug, lang).pipe(
          map((value): Load<WardDetail> => ({ status: 'ok', value })),
          catchError((err) => of<Load<WardDetail>>({ status: 'error', message: describeError(err, lang) })),
          startWith<Load<WardDetail>>({ status: 'loading' }),
        ),
      ),
    ),
    { initialValue: { status: 'loading' } as Load<WardDetail> },
  );
  protected readonly d = computed(() => {
    const x = this.detail();
    return x.status === 'ok' ? x.value : null;
  });

  /** Median density of the wards with a population figure (for the population chart). */
  private readonly wards = toSignal(this.api.wards().pipe(catchError(() => of(null))), { initialValue: null });
  protected readonly medianDensity = computed(() => {
    const values = (this.wards()?.wards ?? []).map((w) => w.density).filter((v): v is number => v !== null).sort((a, b) => a - b);
    return values.length ? values[Math.floor(values.length / 2)] : null;
  });

  /** Legend ticks of the current lens: 0–100 scores, or land price stops (million VND/m²). */
  protected readonly legendTicks = computed(() => (this.state.lens() === 'landPrice' ? LAND_STOPS.map((v, i) => `${v}${i === LAND_STOPS.length - 1 ? '+' : ''}`) : ['0', '35', '60', '85+']));

  // ---------------------------------------------------------------- charts
  /** CBRE primary average per quarter (city-wide), with the secondary average where it was published. */
  protected readonly priceChart = computed(() => {
    const q = this.d()?.market.quarters;
    if (!q) return null;
    const primary = q.map((x) => x.primary);
    const min = Math.min(...primary, ...q.map((x) => x.secondary ?? Infinity)) * 0.85;
    const max = Math.max(...primary) * 1.08;
    const x = (i: number) => (q.length > 1 ? (i / (q.length - 1)) * 260 : 0);
    const y = (v: number) => Math.round((110 - 6 - ((v - min) / (max - min)) * 98) * 10) / 10;
    return {
      line: linePoints(primary, 260, 110, min, max),
      area: areaPoints(primary, 260, 110, min, max),
      dots: q.map((p, i) => ({ x: x(i), y: y(p.primary), label: p.quarter, value: p.primary })),
      secondary: q.filter((p) => p.secondary).map((p) => ({ x: x(q.indexOf(p)), y: y(p.secondary!), value: p.secondary! })),
    };
  });

  protected readonly supplyMax = computed(() => {
    const q = this.d()?.market.quarters;
    return q ? Math.max(...q.flatMap((x) => [x.launched, x.sold])) : 1;
  });

  /** Infrastructure nearby on a 2026 → 2036 axis (planned lines target 2035). */
  protected readonly timeline = computed(() => {
    const d = this.d();
    if (!d) return [];
    return d.infra
      .filter((i) => i.openYear)
      .slice(0, 6)
      .sort((a, b) => (a.openYear ?? 0) - (b.openYear ?? 0))
      .map((i) => ({ ...i, left: Math.min(100, Math.max(0, (((i.openYear ?? 2026) - 2026) / 10) * 100)) }));
  });

  protected readonly amenities = computed(() => {
    const d = this.d();
    if (!d) return [];
    const c = d.facts.counts;
    const rows = [
      { key: 'education' as const, value: c.education },
      { key: 'health' as const, value: c.health },
      { key: 'shopping' as const, value: c.shopping },
      { key: 'parks' as const, value: c.parks },
      { key: 'bus' as const, value: c.bus },
    ];
    const max = Math.max(1, ...rows.map((r) => r.value));
    return rows.map((r) => ({ ...r, pct: (r.value / max) * 100 }));
  });

  protected readonly ringDash = computed(() => {
    const score = this.d()?.score ?? 0;
    const c = 2 * Math.PI * 44;
    return `${(score / 100) * c} ${c}`;
  });

  protected readonly copied = signal(false);
  protected readonly Math = Math;
  protected readonly vsCity = (median: number, city: number) => Math.round((median / city - 1) * 100);
  protected readonly formatInt = formatInt;
  protected readonly formatNum = formatNum;

  // ---------------------------------------------------------------- actions
  protected toggle(key: LayerKey): void {
    this.state.toggleLayer(key);
  }

  protected applyPreset(layers: LayerKey[]): void {
    this.state.setLayers(layers);
    this.presetsOpen.set(false);
  }

  protected selectWard(slug: string): void {
    this.state.set('ward', slug);
  }

  protected reload(): void {
    this.retry.update((n) => n + 1);
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

  protected share(): void {
    const url = this.state.shareUrl('/property-intelligence/map');
    void navigator.clipboard?.writeText(url).then(
      () => {
        this.copied.set(true);
        setTimeout(() => this.copied.set(false), 2000);
      },
      () => window.prompt(this.t().share, url),
    );
  }

  /** Right inset for fitBounds: the floating AI panel only overlays the map on wide screens. */
  protected rightInset(): number {
    return typeof window !== 'undefined' && window.innerWidth > 1280 ? 400 : 0;
  }
}
