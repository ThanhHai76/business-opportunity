import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  HostListener,
  ViewChild,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { EMPTY, catchError, switchMap, tap } from 'rxjs';
import { IconComponent } from '../living-score/components/icon/icon.component';
import { ThemeService } from '../services/theme.service';
import { normalizeText } from '../utils/text';
import { FutureMapCanvasComponent } from './future-map-canvas.component';
import {
  Answer,
  CompareResult,
  HubDetail,
  HubProps,
  HubScores,
  LayerKey,
  Question,
  Scenario,
  ScenarioStats,
  Timeline,
  TimelineYear,
  YearKind,
} from './future-map.models';
import { FutureMapService, describeError } from './future-map.service';

interface LayerDef {
  key: LayerKey;
  label: string;
  color: string;
}

const LAYERS: readonly LayerDef[] = [
  { key: 'metro', label: 'Metro / Đường sắt đô thị', color: '#3b9cff' },
  { key: 'tod', label: 'Vùng TOD', color: '#b56cff' },
  { key: 'zones', label: 'Khu vực phát triển', color: '#ff9f1c' },
  { key: 'roads', label: 'Vành đai & cao tốc', color: '#facc15' },
  { key: 'green', label: 'Hành lang xanh & công viên', color: '#34d399' },
  { key: 'water', label: 'Sông Hồng & mặt nước', color: '#38bdf8' },
  { key: 'airports', label: 'Sân bay / Logistics', color: '#22d3ee' },
  { key: 'hubs', label: 'Cực tăng trưởng', color: '#ffb020' },
  { key: 'axes', label: 'Trục phát triển', color: '#93c5fd' },
  { key: 'boundaries', label: 'Ranh giới quy hoạch', color: '#cbd5e1' },
];
const ALL_LAYERS: ReadonlySet<LayerKey> = new Set(LAYERS.map((l) => l.key));

const KIND_LABEL: Record<YearKind, string> = {
  present: 'Hiện tại',
  plan: 'Giai đoạn chuyển tiếp',
  scenario: 'Kịch bản tương lai',
  vision: 'Kịch bản viễn tưởng',
};

const SCORE_TILES: ReadonlyArray<{ key: keyof HubScores; label: string; hint: string }> = [
  { key: 'development', label: 'Điểm phát triển', hint: 'Mức độ đô thị hoá và đầu tư trong kịch bản' },
  { key: 'tod', label: 'Tiềm năng TOD', hint: 'Phát triển quanh ga metro, tăng theo số tuyến metro chạm tới cực' },
  { key: 'green', label: 'Chỉ số xanh', hint: 'Không gian xanh và mặt nước' },
  { key: 'connectivity', label: 'Kết nối', hint: 'Khả năng nối với trung tâm, sân bay và các cực khác' },
];

const TAG_LABEL: Record<string, string> = {
  metro: 'Metro',
  tod: 'TOD',
  development: 'Phát triển',
  green: 'Xanh',
  airport: 'Sân bay',
  logistics: 'Logistics',
  innovation: 'Đổi mới sáng tạo',
  heritage: 'Di sản',
};

/** Concentric rings drawn on each timeline orb: one more ring for every step towards 2100. */
const RING_SETS: ReadonlyArray<readonly number[]> = [[6], [6, 11], [6, 11, 16], [6, 11, 16, 19]];

const PLAY_INTERVAL_MS = 3400;
const COMPARE_DEFAULT = [2030, 2050, 2100];

@Component({
  selector: 'app-future-map',
  standalone: true,
  imports: [FutureMapCanvasComponent, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './future-map.component.html',
  styleUrl: './future-map.component.css',
})
export class FutureMapComponent {
  private readonly api = inject(FutureMapService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly themeService = inject(ThemeService);
  @ViewChild('root', { static: true }) private root!: ElementRef<HTMLElement>;

  protected readonly theme = this.themeService.effective;
  protected readonly layers = LAYERS;
  protected readonly scoreTiles = SCORE_TILES;
  protected readonly rings = RING_SETS;

  protected readonly timeline = signal<Timeline | null>(null);
  protected readonly year = signal(2050);
  protected readonly scenario = signal<Scenario | null>(null);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  private readonly reload = signal(0);

  protected readonly visible = signal<ReadonlySet<LayerKey>>(ALL_LAYERS);
  protected readonly mode3d = signal(false);
  protected readonly viewToken = signal(0);
  protected readonly flyTarget = signal<{ slug: string; token: number } | null>(null);
  private flyCount = 0;

  protected readonly selectedSlug = signal<string | null>(null);
  protected readonly hub = signal<HubDetail | null>(null);
  protected readonly hubLoading = signal(false);
  protected readonly hubExpanded = signal(false);
  protected readonly highlights = signal<string[]>([]);

  protected readonly playing = signal(false);
  private timer?: ReturnType<typeof setInterval>;

  protected readonly layersOpen = signal(false);
  protected readonly sourcesOpen = signal(false);
  protected readonly isFullscreen = signal(false);

  protected readonly compareOpen = signal(false);
  protected readonly compareYears = signal<number[]>(COMPARE_DEFAULT);
  protected readonly compare = signal<CompareResult | null>(null);
  protected readonly compareError = signal<string | null>(null);

  protected readonly askOpen = signal(false);
  protected readonly questions = signal<Question[]>([]);
  protected readonly answer = signal<Answer | null>(null);
  protected readonly asking = signal(false);
  protected readonly askError = signal<string | null>(null);

  protected readonly query = signal('');
  protected readonly searchFocused = signal(false);

  protected readonly current = computed<TimelineYear | undefined>(() => this.timeline()?.years.find((y) => y.year === this.year()));
  protected readonly stats = computed<ScenarioStats | undefined>(() => this.scenario()?.stats ?? this.current()?.stats);
  protected readonly kindLabel = computed(() => KIND_LABEL[this.current()?.kind ?? 'scenario']);
  protected readonly isFutureKind = computed(() => (this.current()?.kind ?? 'present') !== 'present');
  protected readonly yearIndex = computed(() => Math.max(0, this.timeline()?.years.findIndex((y) => y.year === this.year()) ?? 0));
  protected readonly note = computed(() => this.scenario()?.note ?? this.timeline()?.note ?? '');

  private readonly hubList = computed<HubProps[]>(() => (this.scenario()?.layers.hubs.features ?? []).map((f) => f.properties as unknown as HubProps));
  protected readonly suggestions = computed(() => {
    const q = normalizeText(this.query());
    if (!q) return [];
    return this.hubList()
      .filter((h) => normalizeText(`${h.name} ${h.role}`).includes(q))
      .slice(0, 6);
  });

  protected readonly hubTiles = computed(() => {
    const scores = this.hub()?.scores;
    return scores ? SCORE_TILES.map((t) => ({ ...t, value: scores[t.key] })) : [];
  });

  constructor() {
    this.loadTimeline();

    toObservable(computed(() => ({ year: this.year(), reload: this.reload() })))
      .pipe(
        tap(() => this.loading.set(true)),
        switchMap(({ year }) =>
          this.api.scenario(year).pipe(
            catchError((e: unknown) => {
              this.error.set(describeError(e));
              this.loading.set(false);
              return EMPTY;
            }),
          ),
        ),
        takeUntilDestroyed(),
      )
      .subscribe((scenario) => {
        this.error.set(null);
        this.scenario.set(scenario);
        this.loading.set(false);
      });

    // Reload the selected hub whenever the hub or the year changes.
    toObservable(computed(() => ({ slug: this.selectedSlug(), year: this.year() })))
      .pipe(
        tap(({ slug }) => {
          if (!slug) this.hub.set(null);
          else this.hubLoading.set(true);
        }),
        switchMap(({ slug, year }) =>
          slug
            ? this.api.hub(slug, year).pipe(
                catchError(() => {
                  this.hubLoading.set(false);
                  return EMPTY;
                }),
              )
            : EMPTY,
        ),
        takeUntilDestroyed(),
      )
      .subscribe((hub) => {
        this.hub.set(hub);
        this.hubLoading.set(false);
      });

    this.destroyRef.onDestroy(() => this.stopPlaying());
  }

  // ------------------------------------------------------------- timeline
  protected selectYear(year: number): void {
    this.stopPlaying();
    this.year.set(year);
    this.answer.set(null);
    this.highlights.set([]);
  }

  protected togglePlay(): void {
    if (this.playing()) return this.stopPlaying();
    const years = this.timeline()?.years ?? [];
    if (years.length < 2) return;
    this.playing.set(true);
    this.year.set(years[0].year);
    this.timer = setInterval(() => {
      const index = years.findIndex((y) => y.year === this.year());
      if (index >= years.length - 1) return this.stopPlaying();
      this.year.set(years[index + 1].year);
    }, PLAY_INTERVAL_MS);
  }

  private stopPlaying(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
    this.playing.set(false);
  }

  // ------------------------------------------------------------- layers & camera
  protected toggleLayer(key: LayerKey): void {
    const next = new Set(this.visible());
    if (!next.delete(key)) next.add(key);
    this.visible.set(next);
  }

  protected resetLayers(): void {
    this.visible.set(ALL_LAYERS);
  }

  protected allOn(): boolean {
    return this.visible().size === ALL_LAYERS.size;
  }

  protected layerCount(key: LayerKey): number | null {
    const stats = this.stats();
    if (!stats) return null;
    if (key === 'hubs') return stats.hubs;
    if (key === 'metro') return stats.metroLines;
    if (key === 'airports') return stats.airports;
    return null;
  }

  protected toggle3d(): void {
    this.mode3d.update((v) => !v);
  }

  protected overview(): void {
    this.viewToken.update((v) => v + 1);
    this.closeHub();
  }

  protected async toggleFullscreen(): Promise<void> {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await this.root.nativeElement.requestFullscreen();
    } catch {
      // fullscreen not available (e.g. blocked by the browser) — nothing to do
    }
  }

  @HostListener('document:fullscreenchange')
  protected onFullscreenChange(): void {
    this.isFullscreen.set(document.fullscreenElement === this.root.nativeElement);
  }

  @HostListener('document:keydown.escape')
  protected onEscape(): void {
    if (this.compareOpen()) this.compareOpen.set(false);
    else if (this.askOpen()) this.askOpen.set(false);
    else if (this.sourcesOpen()) this.sourcesOpen.set(false);
  }

  // ------------------------------------------------------------- hubs & search
  protected selectHub(slug: string, fly = true): void {
    this.selectedSlug.set(slug);
    this.hubExpanded.set(false);
    this.query.set('');
    this.searchFocused.set(false);
    if (fly) this.flyTarget.set({ slug, token: ++this.flyCount });
  }

  protected closeHub(): void {
    this.selectedSlug.set(null);
    this.hubExpanded.set(false);
  }

  protected onQuery(event: Event): void {
    this.query.set((event.target as HTMLInputElement).value);
  }

  protected pickFirstSuggestion(): void {
    const first = this.suggestions()[0];
    if (first) this.selectHub(first.slug);
  }

  protected hubName(slug: string): string {
    return this.hubList().find((h) => h.slug === slug)?.name ?? slug;
  }

  protected tagLabel(tag: string): string {
    return TAG_LABEL[tag] ?? tag;
  }

  protected tileTone(value: number): string {
    return value >= 80 ? 'high' : value >= 60 ? 'mid' : 'low';
  }

  // ------------------------------------------------------------- compare
  protected openCompare(): void {
    this.compareOpen.set(true);
    this.loadCompare(this.compareYears());
  }

  protected toggleCompareYear(year: number): void {
    const years = this.compareYears();
    if (years.includes(year)) {
      if (years.length <= 2) return;
      this.compareYears.set(years.filter((y) => y !== year));
    } else if (years.length < 3) {
      this.compareYears.set([...years, year].sort((a, b) => a - b));
    }
    this.loadCompare(this.compareYears());
  }

  private loadCompare(years: number[]): void {
    this.compareError.set(null);
    this.api
      .compare(years)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (result) => this.compare.set(result),
        error: (e: unknown) => this.compareError.set(describeError(e)),
      });
  }

  protected delta(value: number, unit = ''): string {
    const sign = value > 0 ? '+' : '';
    return `${sign}${Number.isInteger(value) ? value : value.toFixed(1)}${unit}`;
  }

  // ------------------------------------------------------------- questions
  protected openAsk(): void {
    this.askOpen.set(true);
    if (this.questions().length === 0) {
      this.api.questions$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: (r) => this.questions.set(r.questions),
        error: (e: unknown) => this.askError.set(describeError(e)),
      });
    }
  }

  protected ask(question: Question): void {
    this.asking.set(true);
    this.askError.set(null);
    this.api
      .ask(question.id, this.year())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (answer) => {
          this.answer.set(answer);
          this.asking.set(false);
          this.highlights.set(answer.highlights);
          if (answer.highlights[0]) this.flyTarget.set({ slug: answer.highlights[0], token: ++this.flyCount });
        },
        error: (e: unknown) => {
          this.askError.set(describeError(e));
          this.asking.set(false);
        },
      });
  }

  protected closeAsk(): void {
    this.askOpen.set(false);
    this.highlights.set([]);
  }

  protected retry(): void {
    this.error.set(null);
    if (!this.timeline()) this.loadTimeline();
    this.reload.update((n) => n + 1);
  }

  private loadTimeline(): void {
    this.api.timeline$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (timeline) => this.timeline.set(timeline),
      error: (e: unknown) => this.error.set(describeError(e)),
    });
  }
}
