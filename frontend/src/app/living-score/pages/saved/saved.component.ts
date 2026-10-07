import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IconComponent } from '../../components/icon/icon.component';
import { ScoreRingComponent } from '../../components/score-ring/score-ring.component';
import { StateMessageComponent } from '../../components/state-message/state-message.component';
import { AreaSummary } from '../../models/living-score.models';
import { FactsPipe } from '../../pipes/format.pipes';
import { LangService } from '../../services/lang.service';
import { LivingMetaService } from '../../services/living-meta.service';
import { LivingScoreApiService, describeApiError } from '../../services/living-score-api.service';
import { PreferencesService } from '../../services/preferences.service';

@Component({
  selector: 'app-saved',
  standalone: true,
  imports: [RouterLink, IconComponent, ScoreRingComponent, StateMessageComponent, FactsPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="ls-page ls-page--narrow">
      <header>
        <h1 class="ls-title">{{ t().saved.title }}</h1>
        <p class="ls-subtitle">{{ t().saved.subtitle }}</p>
      </header>

      @if (error()) {
        <div class="ls-card"><ls-state kind="error" [title]="t().common.loadFailed" [message]="error()" [actionLabel]="t().common.retry" (action)="load()" /></div>
      } @else if (loading()) {
        <div class="ls-skeleton" style="height: 120px"></div>
      } @else if (!items().length) {
        <div class="ls-card">
          <ls-state kind="empty" icon="bookmark" [title]="t().saved.emptyTitle" [message]="t().saved.emptyMsg" />
          <p class="cta"><a class="ls-btn ls-btn-primary" routerLink="/living-score/explore">{{ t().landing.ctaMap }}</a></p>
        </div>
      } @else {
        <ul class="list">
          @for (area of items(); track area.slug) {
            <li class="ls-card row">
              <ls-score-ring [score]="area.livingScore" [size]="56" [showMax]="false" />
              <div class="row__text">
                <a [routerLink]="['/living-score/area', area.slug]"><strong>{{ area.name }}</strong></a>
                <small>{{ meta.bandLabel(area.band) }} · {{ area.facts | facts: lang() }}</small>
              </div>
              <a class="ls-btn ls-btn-soft ls-btn-sm" [routerLink]="['/living-score/area', area.slug]">{{ t().common.details }}</a>
              <button type="button" class="ls-icon-btn" [attr.aria-label]="t().common.unsave(area.name)" (click)="prefs.toggleSaved(area.slug)">
                <ls-icon name="trash" [size]="16" />
              </button>
            </li>
          }
        </ul>
      }
    </div>
  `,
  styles: [
    `
      .ls-page {
        display: grid;
        gap: 18px;
      }
      .list {
        list-style: none;
        margin: 0;
        padding: 0;
        display: grid;
        gap: 10px;
      }
      .row {
        display: flex;
        align-items: center;
        gap: 14px;
        padding: 14px 16px;
      }
      .row__text {
        flex: 1;
        min-width: 0;
        display: grid;
      }
      .row__text small {
        color: var(--ls-ink-faint);
        font-size: 12.5px;
      }
      .cta {
        text-align: center;
        padding-bottom: 18px;
      }
    `,
  ],
})
export class SavedComponent implements OnInit {
  private readonly api = inject(LivingScoreApiService);
  protected readonly prefs = inject(PreferencesService);
  protected readonly meta = inject(LivingMetaService);

  private readonly all = signal<AreaSummary[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal('');
  private readonly langService = inject(LangService);
  protected readonly t = this.langService.t;
  protected readonly lang = this.langService.lang;
  /** Saved areas in the order they were saved; stays reactive when one is removed. */
  protected readonly items = computed(() => {
    const byslug = new Map(this.all().map((a) => [a.slug, a]));
    return this.prefs.saved().map((slug) => byslug.get(slug)).filter((a): a is AreaSummary => a !== undefined);
  });

  ngOnInit(): void {
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.error.set('');
    this.api.areas({ weights: this.prefs.weights() }).subscribe({
      next: (list) => {
        this.all.set(list.data);
        this.loading.set(false);
      },
      error: (e: unknown) => {
        this.error.set(describeApiError(e, this.lang()));
        this.loading.set(false);
      },
    });
  }
}
