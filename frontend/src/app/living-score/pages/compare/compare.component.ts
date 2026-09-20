import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { EMPTY, Subject, catchError, of, switchMap, tap } from 'rxjs';
import { IconComponent } from '../../components/icon/icon.component';
import { RadarAxis, RadarChartComponent, RadarSeries } from '../../components/radar-chart/radar-chart.component';
import { ScoreRingComponent } from '../../components/score-ring/score-ring.component';
import { StateMessageComponent } from '../../components/state-message/state-message.component';
import { COMPARE_COLORS, CRITERION_ICONS } from '../../living-score.constants';
import { AreaSummary, CRITERION_KEYS, CompareResult, CriterionKey } from '../../models/living-score.models';
import { MillionsPipe, NumPipe } from '../../pipes/format.pipes';
import { LivingMetaService } from '../../services/living-meta.service';
import { LivingScoreApiService, describeApiError } from '../../services/living-score-api.service';
import { PreferencesService } from '../../services/preferences.service';

const MAX_AREAS = 3;

@Component({
  selector: 'app-compare',
  standalone: true,
  imports: [
    DecimalPipe,
    RouterLink,
    IconComponent,
    RadarChartComponent,
    ScoreRingComponent,
    StateMessageComponent,
    MillionsPipe,
    NumPipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './compare.component.html',
  styleUrl: './compare.component.css',
})
export class CompareComponent implements OnInit {
  private readonly api = inject(LivingScoreApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly prefs = inject(PreferencesService);
  protected readonly meta = inject(LivingMetaService);

  protected readonly colors = COMPARE_COLORS;
  protected readonly icons = CRITERION_ICONS;
  protected readonly criterionKeys = CRITERION_KEYS;
  protected readonly maxAreas = MAX_AREAS;

  protected readonly allAreas = signal<AreaSummary[]>([]);
  protected readonly selection = signal<string[]>([]);
  protected readonly result = signal<CompareResult | null>(null);
  protected readonly loading = signal(false);
  protected readonly errorMessage = signal('');
  protected readonly listError = signal('');

  protected readonly axes = computed<RadarAxis[]>(() => this.meta.criteria().map((c) => ({ key: c.key, label: c.label })));
  protected readonly series = computed<RadarSeries[]>(() =>
    (this.result()?.areas ?? []).map((area, index) => ({
      name: area.name,
      color: COMPARE_COLORS[index] ?? COMPARE_COLORS[0]!,
      values: this.meta.criteria().map((c) => area.scores[c.key]),
    })),
  );
  protected readonly bestName = computed(() => {
    const r = this.result();
    return r?.areas.find((a) => a.slug === r.bestOverall)?.name ?? '';
  });

  private readonly refresh$ = new Subject<void>();

  constructor() {
    this.refresh$
      .pipe(
        tap(() => {
          this.errorMessage.set('');
        }),
        switchMap(() => {
          const slugs = this.selection();
          if (slugs.length < 2) {
            this.result.set(null);
            this.loading.set(false);
            return of(null);
          }
          this.loading.set(true);
          return this.api.compare(slugs, this.prefs.weights()).pipe(
            catchError((error: unknown) => {
              this.errorMessage.set(describeApiError(error));
              this.loading.set(false);
              return EMPTY;
            }),
          );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((value) => {
        if (value) this.result.set(value);
        this.loading.set(false);
      });
  }

  ngOnInit(): void {
    const fromUrl = (this.route.snapshot.queryParamMap.get('a') ?? '').split(',').filter(Boolean);
    const initial = (fromUrl.length ? fromUrl : this.prefs.compareSelection()).slice(0, MAX_AREAS);
    this.selection.set(initial);
    this.prefs.setCompare(initial);

    this.api.areas({ sort: 'name' }).subscribe({
      next: (list) => {
        this.allAreas.set(list.data);
        const known = new Set(list.data.map((a) => a.slug));
        const valid = this.selection().filter((s) => known.has(s));
        if (valid.length !== this.selection().length) this.setSelection(valid);
        else this.refresh$.next();
      },
      error: (error: unknown) => this.listError.set(describeApiError(error)),
    });
  }

  protected toggle(slug: string): void {
    const current = this.selection();
    if (current.includes(slug)) this.setSelection(current.filter((s) => s !== slug));
    else if (current.length < MAX_AREAS) this.setSelection([...current, slug]);
  }

  protected clear(): void {
    this.setSelection([]);
  }

  protected retry(): void {
    this.refresh$.next();
  }

  protected isBest(criterion: CriterionKey, slug: string): boolean {
    return this.result()?.criteria.find((c) => c.criterion === criterion)?.best.includes(slug) ?? false;
  }

  protected value(criterion: CriterionKey, slug: string): number {
    return this.result()?.criteria.find((c) => c.criterion === criterion)?.values[slug] ?? 0;
  }

  private setSelection(slugs: string[]): void {
    this.selection.set(slugs);
    this.prefs.setCompare(slugs);
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { a: slugs.length ? slugs.join(',') : null },
      replaceUrl: true,
    });
    this.refresh$.next();
  }
}
