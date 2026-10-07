import { ChangeDetectionStrategy, Component, ElementRef, OnInit, ViewChild, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { IconComponent } from '../../components/icon/icon.component';
import { ScoreRingComponent } from '../../components/score-ring/score-ring.component';
import { StateMessageComponent } from '../../components/state-message/state-message.component';
import { CRITERION_ICONS, HOUSEHOLD_OPTIONS, INTEREST_OPTIONS } from '../../living-score.constants';
import {
  AreaSummary,
  CRITERION_KEYS,
  CriterionKey,
  HouseholdType,
  InterestKey,
  RecommendationRequest,
  RecommendationResponse,
} from '../../models/living-score.models';
import { LivingMetaService } from '../../services/living-meta.service';
import { formatNum } from '../../pipes/format.pipes';
import { LangService } from '../../services/lang.service';
import { LivingScoreApiService, describeApiError } from '../../services/living-score-api.service';
import { PreferencesService } from '../../services/preferences.service';

const NEUTRAL_PRIORITY = 3;

@Component({
  selector: 'app-ai-recommend',
  standalone: true,
  imports: [RouterLink, IconComponent, ScoreRingComponent, StateMessageComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './ai-recommend.component.html',
  styleUrl: './ai-recommend.component.css',
})
export class AiRecommendComponent implements OnInit {
  private readonly api = inject(LivingScoreApiService);
  private readonly route = inject(ActivatedRoute);
  protected readonly prefs = inject(PreferencesService);
  protected readonly meta = inject(LivingMetaService);
  @ViewChild('results') private results?: ElementRef<HTMLElement>;

  private readonly langService = inject(LangService);
  protected readonly t = this.langService.t;
  protected readonly households = HOUSEHOLD_OPTIONS;
  protected readonly interestOptions = INTEREST_OPTIONS;
  protected readonly icons = CRITERION_ICONS;
  protected readonly criterionKeys = CRITERION_KEYS;

  protected readonly workplace = signal('');
  protected readonly household = signal<HouseholdType>('single');
  protected readonly interests = signal<InterestKey[]>([]);
  protected readonly useAi = signal(true);
  protected readonly priorities = signal<Record<CriterionKey, number>>(
    Object.fromEntries(CRITERION_KEYS.map((k) => [k, NEUTRAL_PRIORITY])) as Record<CriterionKey, number>,
  );

  protected readonly areas = signal<AreaSummary[]>([]);
  protected readonly status = signal<'idle' | 'loading' | 'done' | 'error'>('idle');
  protected readonly errorMessage = signal('');
  protected readonly response = signal<RecommendationResponse | null>(null);
  protected readonly allZero = computed(() => CRITERION_KEYS.every((k) => this.priorities()[k] === 0));

  ngOnInit(): void {
    // ?workplace=<area> (e.g. from a Future Map direction): pre-select where the user works.
    const workplace = this.route.snapshot.queryParamMap.get('workplace');
    this.api.areas({ sort: 'name' }).subscribe({
      next: (list) => {
        this.areas.set(list.data);
        if (workplace && list.data.some((a) => a.slug === workplace)) this.workplace.set(workplace);
      },
      error: () => this.areas.set([]),
    });
  }

  protected toggleInterest(value: InterestKey): void {
    this.interests.update((list) => (list.includes(value) ? list.filter((i) => i !== value) : [...list, value]));
  }

  protected setPriority(key: CriterionKey, event: Event): void {
    const value = Number((event.target as HTMLInputElement).value);
    this.priorities.update((p) => ({ ...p, [key]: value }));
  }

  protected resetPriorities(): void {
    this.priorities.set(Object.fromEntries(CRITERION_KEYS.map((k) => [k, NEUTRAL_PRIORITY])) as Record<CriterionKey, number>);
  }

  protected submit(): void {
    if (this.allZero() || this.status() === 'loading') return;
    const request: RecommendationRequest = {
      workplaceAreaSlug: this.workplace() || undefined,
      household: this.household(),
      interests: this.interests(),
      priorities: this.priorities(),
      useAi: this.useAi(),
    };
    this.status.set('loading');
    this.errorMessage.set('');
    this.api.recommend(request).subscribe({
      next: (result) => {
        this.response.set(result);
        this.status.set('done');
        setTimeout(() => this.results?.nativeElement.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
      },
      error: (error: unknown) => {
        this.errorMessage.set(describeApiError(error, this.langService.lang()));
        this.status.set('error');
      },
    });
  }

  protected priorityLabel(value: number): string {
    return this.t().ai.priority[value] ?? '';
  }

  protected num(value: number, digits: number): string {
    return formatNum(value, this.langService.lang(), digits);
  }

  protected toggleCompare(slug: string): void {
    this.prefs.toggleCompare(slug);
  }

  protected inCompare(slug: string): boolean {
    return this.prefs.compareSelection().includes(slug);
  }
}
