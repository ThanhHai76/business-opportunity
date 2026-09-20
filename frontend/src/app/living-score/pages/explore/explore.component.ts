import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { EMPTY, Subject, catchError, debounceTime, distinctUntilChanged, forkJoin, map, of, switchMap, tap } from 'rxjs';
import { AreaMapComponent } from '../../components/area-map/area-map.component';
import { IconComponent } from '../../components/icon/icon.component';
import { ScoreRingComponent } from '../../components/score-ring/score-ring.component';
import { StateMessageComponent } from '../../components/state-message/state-message.component';
import { WeightsPanelComponent } from '../../components/weights-panel/weights-panel.component';
import { AMENITY_META, AMENITY_TYPES, CRITERION_ICONS, STATUS_META } from '../../living-score.constants';
import {
  AmenityGeoJson,
  AmenityType,
  AreaGeoJson,
  AreaSummary,
  CRITERION_KEYS,
  CriterionKey,
  InfrastructureGeoJson,
  ScoreVisual,
  SearchResult,
} from '../../models/living-score.models';
import { MillionsPipe } from '../../pipes/format.pipes';
import { LivingScoreApiService, describeApiError } from '../../services/living-score-api.service';
import { LivingMetaService } from '../../services/living-meta.service';
import { PreferencesService } from '../../services/preferences.service';

type SortKey = 'score' | 'name' | 'rent';
type LoadState = 'loading' | 'ready' | 'error';

@Component({
  selector: 'app-explore',
  standalone: true,
  imports: [
    DecimalPipe,
    RouterLink,
    AreaMapComponent,
    IconComponent,
    ScoreRingComponent,
    StateMessageComponent,
    WeightsPanelComponent,
    MillionsPipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './explore.component.html',
  styleUrl: './explore.component.css',
})
export class ExploreComponent implements OnInit {
  private readonly api = inject(LivingScoreApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly prefs = inject(PreferencesService);
  protected readonly meta = inject(LivingMetaService);

  protected readonly amenityTypes = AMENITY_TYPES;
  protected readonly amenityMeta = AMENITY_META;
  protected readonly statusMeta = Object.entries(STATUS_META).map(([key, value]) => ({ key, ...value }));
  protected readonly criterionKeys = CRITERION_KEYS;
  protected readonly criterionIcons = CRITERION_ICONS;
  protected readonly theme = this.prefs.effectiveTheme;

  protected readonly loadState = signal<LoadState>('loading');
  protected readonly errorMessage = signal('');
  protected readonly geo = signal<AreaGeoJson | null>(null);
  protected readonly list = signal<AreaSummary[]>([]);
  protected readonly infra = signal<InfrastructureGeoJson | null>(null);
  protected readonly amenities = signal<AmenityGeoJson | null>(null);

  protected readonly visual = signal<ScoreVisual>('livingScore');
  protected readonly sort = signal<SortKey>('score');
  protected readonly enabledAmenities = signal<AmenityType[]>([]);
  protected readonly showInfra = signal(false);
  protected readonly selectedSlug = signal<string | null>(null);
  protected readonly filtersOpen = signal(false);
  protected readonly sheetOpen = signal(true);
  protected readonly query = signal('');
  protected readonly suggestions = signal<SearchResult | null>(null);

  /** Leaves room for the floating panels so the pins are not hidden behind them. */
  protected readonly mapPadding =
    typeof window !== 'undefined' && window.innerWidth <= 820
      ? { top: 130, right: 24, bottom: 320, left: 24 }
      : { top: 40, right: 410, bottom: 60, left: 390 };

  protected readonly sortedList = computed(() => {
    const items = [...this.list()];
    switch (this.sort()) {
      case 'name':
        return items.sort((a, b) => a.name.localeCompare(b.name, 'vi'));
      case 'rent':
        return items.sort((a, b) => a.avgRentVnd - b.avgRentVnd);
      default:
        return items;
    }
  });

  protected readonly selected = computed(() => this.list().find((a) => a.slug === this.selectedSlug()) ?? null);
  protected readonly selectedStrengths = computed(() => {
    const area = this.selected();
    if (!area) return [];
    return [...CRITERION_KEYS]
      .sort((a, b) => area.scores[b] - area.scores[a])
      .slice(0, 3)
      .map((key) => ({ key, label: this.meta.label(key), value: area.scores[key] }));
  });
  protected readonly visualLabel = computed(() => {
    const v = this.visual();
    return v === 'livingScore' ? 'Living Score' : this.meta.label(v);
  });
  protected readonly isPersonalized = computed(() => this.prefs.weights() !== null);

  private readonly reload$ = new Subject<void>();
  private readonly search$ = new Subject<string>();
  private readonly amenities$ = new Subject<AmenityType[]>();

  constructor() {
    this.reload$
      .pipe(
        debounceTime(150),
        tap(() => (this.geo() ? undefined : this.loadState.set('loading'))),
        switchMap(() => {
          const criterion = this.visual() === 'livingScore' ? null : (this.visual() as CriterionKey);
          const weights = this.prefs.weights();
          return forkJoin({
            geo: this.api.areasGeoJson({ criterion, weights }),
            list: this.api.areas({ weights }),
          }).pipe(
            catchError((error: unknown) => {
              this.errorMessage.set(describeApiError(error));
              this.loadState.set('error');
              return EMPTY;
            }),
          );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(({ geo, list }) => {
        this.geo.set(geo);
        this.list.set(list.data);
        this.loadState.set('ready');
      });

    this.search$
      .pipe(
        debounceTime(220),
        distinctUntilChanged(),
        switchMap((q) => (q.trim().length < 1 ? of(null) : this.api.search(q.trim()).pipe(catchError(() => of(null))))),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((result) => this.suggestions.set(result));

    this.amenities$
      .pipe(
        switchMap((types) =>
          types.length ? this.api.amenities(types).pipe(catchError(() => of(null))) : of(null),
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((data) => this.amenities.set(data));
  }

  ngOnInit(): void {
    this.reload();
    const slug = this.route.snapshot.queryParamMap.get('area');
    if (slug) this.selectedSlug.set(slug);
  }

  protected reload(): void {
    this.reload$.next();
  }

  protected setVisual(visual: ScoreVisual): void {
    this.visual.set(visual);
    this.reload();
  }

  protected toggleAmenity(type: AmenityType): void {
    const next = this.enabledAmenities().includes(type)
      ? this.enabledAmenities().filter((t) => t !== type)
      : [...this.enabledAmenities(), type];
    this.enabledAmenities.set(next);
    this.amenities$.next(next);
  }

  protected toggleInfra(): void {
    const next = !this.showInfra();
    this.showInfra.set(next);
    if (next && !this.infra()) {
      this.api
        .infrastructure()
        .pipe(
          catchError(() => of(null)),
          map((data) => data),
          takeUntilDestroyed(this.destroyRef),
        )
        .subscribe((data) => this.infra.set(data));
    }
  }

  protected select(slug: string): void {
    this.selectedSlug.set(slug);
    this.suggestions.set(null);
    this.sheetOpen.set(true);
    void this.router.navigate([], { relativeTo: this.route, queryParams: { area: slug }, replaceUrl: true });
  }

  protected clearSelection(): void {
    this.selectedSlug.set(null);
    void this.router.navigate([], { relativeTo: this.route, queryParams: {}, replaceUrl: true });
  }

  protected onQuery(value: string): void {
    this.query.set(value);
    this.search$.next(value);
  }

  protected clearQuery(): void {
    this.query.set('');
    this.suggestions.set(null);
    this.search$.next('');
  }

  protected submitSearch(): void {
    const first = this.suggestions()?.areas[0];
    if (first) this.select(first.slug);
  }

  protected selectPlace(areaSlug: string): void {
    this.select(areaSlug);
    this.clearQuery();
  }

  protected toggleCompare(slug: string): void {
    this.prefs.toggleCompare(slug);
  }

  protected inCompare(slug: string): boolean {
    return this.prefs.compareSelection().includes(slug);
  }
}
