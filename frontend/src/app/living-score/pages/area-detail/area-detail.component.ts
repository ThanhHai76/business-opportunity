import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { EMPTY, catchError, map, switchMap, tap } from 'rxjs';
import { CriterionBarComponent } from '../../components/criterion-bar/criterion-bar.component';
import { IconComponent } from '../../components/icon/icon.component';
import { ScoreRingComponent } from '../../components/score-ring/score-ring.component';
import { StateMessageComponent } from '../../components/state-message/state-message.component';
import { AMENITY_META } from '../../living-score.constants';
import { AreaDetail } from '../../models/living-score.models';
import { MillionsPipe, NumPipe, VndPipe } from '../../pipes/format.pipes';
import { LivingMetaService } from '../../services/living-meta.service';
import { LivingScoreApiService, describeApiError } from '../../services/living-score-api.service';
import { PreferencesService } from '../../services/preferences.service';

@Component({
  selector: 'app-area-detail',
  standalone: true,
  imports: [
    DecimalPipe,
    RouterLink,
    CriterionBarComponent,
    IconComponent,
    ScoreRingComponent,
    StateMessageComponent,
    MillionsPipe,
    NumPipe,
    VndPipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './area-detail.component.html',
  styleUrl: './area-detail.component.css',
})
export class AreaDetailComponent {
  private readonly api = inject(LivingScoreApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly prefs = inject(PreferencesService);
  protected readonly meta = inject(LivingMetaService);
  protected readonly amenityMeta = AMENITY_META;

  protected readonly area = signal<AreaDetail | null>(null);
  protected readonly state = signal<'loading' | 'ready' | 'error' | 'notfound'>('loading');
  protected readonly errorMessage = signal('');

  protected readonly inCompare = computed(() => {
    const slug = this.area()?.slug;
    return slug ? this.prefs.compareSelection().includes(slug) : false;
  });
  protected readonly compareFull = computed(() => this.prefs.compareSelection().length >= 3 && !this.inCompare());

  private slug = '';

  constructor() {
    this.route.paramMap
      .pipe(
        map((params) => params.get('slug') ?? ''),
        tap((slug) => {
          this.slug = slug;
          this.state.set('loading');
        }),
        switchMap((slug) =>
          this.api.areaDetail(slug, this.prefs.weights()).pipe(
            catchError((error: unknown) => {
              const status = (error as { status?: number }).status;
              this.errorMessage.set(describeApiError(error));
              this.state.set(status === 404 ? 'notfound' : 'error');
              return EMPTY;
            }),
          ),
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((detail) => {
        this.area.set(detail);
        this.state.set('ready');
      });
  }

  protected retry(): void {
    this.state.set('loading');
    this.api.areaDetail(this.slug, this.prefs.weights()).subscribe({
      next: (detail) => {
        this.area.set(detail);
        this.state.set('ready');
      },
      error: (error: unknown) => {
        this.errorMessage.set(describeApiError(error));
        this.state.set('error');
      },
    });
  }

  protected toggleCompare(): void {
    const slug = this.area()?.slug;
    if (slug) this.prefs.toggleCompare(slug);
  }
}
