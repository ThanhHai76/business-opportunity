import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  HostListener,
  ViewChild,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { EMPTY, catchError, of, switchMap, tap } from 'rxjs';
import { RouterLink } from '@angular/router';
import { IconComponent } from '../living-score/components/icon/icon.component';
import { ThemeService } from '../services/theme.service';
import { normalizeText } from '../utils/text';
import { FM_LANG_KEY, FM_TEXT } from './fm-i18n';
import { FutureMapCanvasComponent, THEME_COLORS } from './future-map-canvas.component';
import {
  Answer,
  CompareResult,
  CorridorDetail,
  CorridorSummary,
  CorridorTheme,
  HubDetail,
  HubProps,
  Lang,
  LayerKey,
  MapView,
  Question,
  RegionData,
  Scenario,
  ScenarioStats,
  SourceRef,
  Status,
  Timeline,
  TimelineYear,
} from './future-map.models';
import { FutureMapService, describeError } from './future-map.service';

interface LayerDef {
  key: LayerKey;
  color: string;
}

const LAYERS: readonly LayerDef[] = [
  { key: 'metro', color: '#3b9cff' },
  { key: 'tod', color: '#b56cff' },
  { key: 'zones', color: '#ff9f1c' },
  { key: 'roads', color: '#facc15' },
  { key: 'green', color: '#34d399' },
  { key: 'water', color: '#38bdf8' },
  { key: 'airports', color: '#22d3ee' },
  { key: 'hubs', color: '#ffb020' },
  { key: 'axes', color: '#93c5fd' },
];
const ALL_LAYERS: ReadonlySet<LayerKey> = new Set(LAYERS.map((l) => l.key));
const STATUSES: readonly Status[] = ['operating', 'construction', 'plan'];

/** Concentric rings drawn on each timeline orb: one more ring for every step towards 2065. */
const RING_SETS: ReadonlyArray<readonly number[]> = [[6], [6, 11], [6, 11, 16], [6, 11, 16, 19]];

const PLAY_INTERVAL_MS = 3400;
const DEFAULT_YEAR = 2035;
const COMPARE_DEFAULT = [2026, 2035, 2065];
const CORRIDOR_THEMES: readonly CorridorTheme[] = ['industry', 'logistics', 'tourism', 'health'];
const SLUG = /^[a-z0-9-]{1,40}$/;

/** A search result: a development pole (city view) or a Capital Region direction. */
type Suggestion = { type: 'hub'; slug: string; name: string; sub: string } | { type: 'corridor'; slug: string; name: string; sub: string };

/** Language: ?lang= in the URL (not remembered), else the stored choice, else Vietnamese. */
function initialLang(params: URLSearchParams): Lang {
  const fromUrl = params.get('lang');
  if (fromUrl === 'vi' || fromUrl === 'en') return fromUrl;
  try {
    return localStorage.getItem(FM_LANG_KEY) === 'en' ? 'en' : 'vi';
  } catch {
    return 'vi';
  }
}

@Component({
  selector: 'app-future-map',
  standalone: true,
  imports: [FutureMapCanvasComponent, IconComponent, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './future-map.component.html',
  styleUrls: ['./future-map.component.css', './future-map-region.css'],
})
export class FutureMapComponent {
  private readonly api = inject(FutureMapService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly themeService = inject(ThemeService);
  @ViewChild('root', { static: true }) private root!: ElementRef<HTMLElement>;

  protected readonly theme = this.themeService.effective;
  protected readonly layers = LAYERS;
  protected readonly statuses = STATUSES;
  protected readonly rings = RING_SETS;
  protected readonly corridorThemes = CORRIDOR_THEMES;
  protected readonly themeColors = computed(() => THEME_COLORS[this.theme()]);

  private readonly params = new URLSearchParams(typeof location === 'undefined' ? '' : location.search);
  protected readonly lang = signal<Lang>(initialLang(this.params));
  protected readonly t = computed(() => FM_TEXT[this.lang()]);

  protected readonly timeline = signal<Timeline | null>(null);
  protected readonly year = signal(DEFAULT_YEAR);
  protected readonly scenario = signal<Scenario | null>(null);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  private readonly reload = signal(0);

  protected readonly visible = signal<ReadonlySet<LayerKey>>(ALL_LAYERS);
  protected readonly mode3d = signal(false);
  protected readonly viewToken = signal(0);
  protected readonly flyTarget = signal<{ slug: string; token: number } | null>(null);
  private flyCount = 0;

  // Capital Region view
  protected readonly view = signal<MapView>(this.params.get('view') === 'region' ? 'region' : 'city');
  protected readonly region = signal<RegionData | null>(null);
  protected readonly corridorSlug = signal<string | null>(null);
  protected readonly corridor = signal<CorridorDetail | null>(null);
  protected readonly themeFilter = signal<CorridorTheme[]>([]);

  protected readonly selectedSlug = signal<string | null>(null);
  protected readonly hub = signal<HubDetail | null>(null);
  protected readonly highlights = signal<string[]>([]);

  protected readonly playing = signal(false);
  private timer?: ReturnType<typeof setInterval>;

  protected readonly layersOpen = signal(false);
  protected readonly sourcesOpen = signal(false);
  protected readonly isFullscreen = signal(false);
  protected readonly shareCopied = signal(false);

  protected readonly compareOpen = signal(false);
  protected readonly compareYears = signal<number[]>(COMPARE_DEFAULT);
  protected readonly compare = signal<CompareResult | null>(null);
  protected readonly compareError = signal<string | null>(null);

  protected readonly askOpen = signal(false);
  protected readonly questions = signal<Question[]>([]);
  protected readonly answer = signal<Answer | null>(null);
  protected readonly askedId = signal<string | null>(null);
  protected readonly asking = signal(false);
  protected readonly askError = signal<string | null>(null);
  protected readonly askText = signal('');

  protected readonly query = signal('');
  protected readonly searchFocused = signal(false);

  protected readonly current = computed<TimelineYear | undefined>(() => this.timeline()?.years.find((y) => y.year === this.year()));
  protected readonly stats = computed<ScenarioStats | undefined>(() => this.scenario()?.stats ?? this.current()?.stats);
  protected readonly kindLabel = computed(() => this.t().kind[this.current()?.kind ?? 'plan']);
  protected readonly isFutureKind = computed(() => (this.current()?.kind ?? 'present') !== 'present');
  protected readonly yearIndex = computed(() => Math.max(0, this.timeline()?.years.findIndex((y) => y.year === this.year()) ?? 0));
  protected readonly note = computed(() =>
    this.view() === 'region' && this.region() ? `${this.region()!.note} ${this.scenario()?.note ?? ''}` : (this.scenario()?.note ?? this.timeline()?.note ?? ''),
  );
  /** Every source of the data, for the "Data sources" panel. */
  protected readonly allSources = computed<SourceRef[]>(() =>
    Object.entries({ ...(this.scenario()?.sources ?? this.timeline()?.sources ?? {}), ...(this.region()?.sources ?? {}) }).map(([id, s]) => ({ id, ...s })),
  );
  /** Sources behind the population and rail figures of the current year. */
  protected readonly statSources = computed<SourceRef[]>(() => {
    const s = this.scenario();
    if (!s) return [];
    const ids = [...new Set([...s.statNotes.railKm.sources, ...s.statNotes.population.sources])];
    return ids.filter((id) => s.sources[id]).map((id) => ({ id, ...s.sources[id] }));
  });

  private readonly hubList = computed<HubProps[]>(() => (this.scenario()?.layers.hubs.features ?? []).map((f) => f.properties as unknown as HubProps));
  protected readonly suggestions = computed<Suggestion[]>(() => {
    const q = normalizeText(this.query());
    if (!q) return [];
    const hubs: Suggestion[] = this.hubList()
      .filter((h) => normalizeText(`${h.name} ${h.area} ${h.role}`).includes(q))
      .map((h) => ({ type: 'hub', slug: h.slug, name: h.name, sub: h.role }));
    const corridors: Suggestion[] = (this.region()?.corridors ?? [])
      .filter((c) => normalizeText(`${c.province} ${c.formerly} ${c.label} ${c.nodes.map((n) => n.name).join(' ')}`).includes(q))
      .map((c) => ({ type: 'corridor', slug: c.slug, name: `${c.province} · ${c.direction}`, sub: c.label }));
    // The view in use first.
    return (this.view() === 'region' ? [...corridors, ...hubs] : [...hubs, ...corridors]).slice(0, 7);
  });

  /** Headline figures of the region view (counted from the regional infrastructure shown in this year). */
  protected readonly regionStats = computed(() => {
    const r = this.region();
    if (!r) return null;
    const infra = [...r.layers.infraLines.features, ...r.layers.infraPoints.features].map((f) => (f.properties as { status: Status }).status);
    return {
      corridors: r.corridors.length,
      building: infra.filter((s) => s === 'construction').length,
      planned: infra.filter((s) => s === 'plan').length,
    };
  });
  protected readonly shownCorridors = computed(() => {
    const themes = this.themeFilter();
    return (this.region()?.corridors ?? []).filter((c) => !themes.length || themes.includes(c.theme));
  });

  constructor() {
    const yearParam = Number(this.params.get('year'));
    if (yearParam) this.year.set(yearParam);
    const hubParam = this.params.get('hub');
    if (hubParam && SLUG.test(hubParam)) this.selectedSlug.set(hubParam);
    const corridorParam = this.params.get('corridor');
    if (corridorParam && SLUG.test(corridorParam)) this.corridorSlug.set(corridorParam);

    toObservable(computed(() => ({ lang: this.lang(), reload: this.reload() })))
      .pipe(
        switchMap(({ lang }) => this.api.timeline(lang).pipe(catchError((e: unknown) => (this.error.set(describeError(e, lang)), EMPTY)))),
        takeUntilDestroyed(),
      )
      .subscribe((timeline) => {
        this.timeline.set(timeline);
        // A shared link with an unknown year falls back to the default milestone.
        if (!timeline.years.some((y) => y.year === this.year())) this.year.set(DEFAULT_YEAR);
      });

    toObservable(computed(() => ({ year: this.year(), lang: this.lang(), reload: this.reload() })))
      .pipe(
        tap(() => this.loading.set(true)),
        switchMap(({ year, lang }) =>
          this.api.scenario(year, lang).pipe(
            catchError((e: unknown) => {
              this.error.set(describeError(e, lang));
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

    // The Capital Region data: loaded with the first scenario (search covers provinces too) and per year / language.
    toObservable(computed(() => ({ year: this.year(), lang: this.lang(), reload: this.reload() })))
      .pipe(
        switchMap(({ year, lang }) => this.api.region(year, lang).pipe(catchError(() => of(null)))),
        takeUntilDestroyed(),
      )
      .subscribe((region) => this.region.set(region));

    toObservable(computed(() => ({ slug: this.corridorSlug(), year: this.year(), lang: this.lang() })))
      .pipe(
        tap(({ slug }) => {
          if (!slug) this.corridor.set(null);
        }),
        switchMap(({ slug, year, lang }) => (slug ? this.api.corridor(slug, year, lang).pipe(catchError(() => (this.corridorSlug.set(null), EMPTY))) : EMPTY)),
        takeUntilDestroyed(),
      )
      .subscribe((corridor) => this.corridor.set(corridor));

    // Reload the selected pole whenever the pole, the year or the language changes.
    toObservable(computed(() => ({ slug: this.selectedSlug(), year: this.year(), lang: this.lang() })))
      .pipe(
        tap(({ slug }) => {
          if (!slug) this.hub.set(null);
        }),
        switchMap(({ slug, year, lang }) => (slug ? this.api.hub(slug, year, lang).pipe(catchError(() => (this.selectedSlug.set(null), EMPTY))) : EMPTY)),
        takeUntilDestroyed(),
      )
      .subscribe((hub) => this.hub.set(hub));

    // Keep the address bar on the current view, so it can be shared or bookmarked.
    effect(() => {
      const url = this.shareUrl();
      if (typeof history !== 'undefined') history.replaceState(history.state, '', url.slice(location.origin.length));
    });

    this.destroyRef.onDestroy(() => this.stopPlaying());
  }

  /** Link to the current milestone, view, pole or direction, and language. */
  private shareUrl(): string {
    const params = new URLSearchParams({ year: String(this.year()) });
    if (this.view() === 'region') params.set('view', 'region');
    const slug = this.selectedSlug();
    if (slug) params.set('hub', slug);
    const corridor = this.corridorSlug();
    if (corridor && this.view() === 'region') params.set('corridor', corridor);
    if (this.lang() === 'en') params.set('lang', 'en');
    return `${location.origin}${location.pathname}?${params.toString()}`;
  }

  protected async share(): Promise<void> {
    const url = this.shareUrl();
    try {
      if (navigator.share) {
        await navigator.share({ title: `Hanoi Future Map · ${this.year()}`, url });
        return;
      }
      try {
        await navigator.clipboard.writeText(url);
      } catch {
        // Clipboard API refused (e.g. page not focused): fall back to a hidden field + copy
        const field = document.createElement('textarea');
        field.value = url;
        field.style.cssText = 'position:fixed;opacity:0;';
        document.body.appendChild(field);
        field.select();
        document.execCommand?.('copy');
        field.remove();
      }
      this.shareCopied.set(true);
      setTimeout(() => this.shareCopied.set(false), 2000);
    } catch {
      // share sheet closed — the link is in the address bar anyway
    }
  }

  protected toggleLang(): void {
    const next: Lang = this.lang() === 'vi' ? 'en' : 'vi';
    this.lang.set(next);
    try {
      localStorage.setItem(FM_LANG_KEY, next);
    } catch {
      // storage blocked — not remembered
    }
    this.questions.set([]);
    this.answer.set(null);
    this.compare.set(null);
    if (this.askOpen()) this.loadQuestions();
    if (this.compareOpen()) this.loadCompare(this.compareYears());
  }

  // ------------------------------------------------------------- figures
  protected populationText(p: { min: number; max: number }): string {
    const fmt = (n: number) => (this.lang() === 'vi' ? String(n).replace('.', ',') : String(n));
    return p.min === p.max ? fmt(p.min) : `${fmt(p.min)}–${fmt(p.max)}`;
  }

  protected railText(km: number): string {
    return this.lang() === 'vi' ? String(km).replace('.', ',') : String(km);
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
    if (key === 'hubs') return stats.poles;
    if (key === 'metro') return stats.linesOperating + stats.linesConstruction + stats.linesPlanned;
    if (key === 'airports') return stats.airports;
    return null;
  }

  protected toggle3d(): void {
    this.mode3d.update((v) => !v);
  }

  protected overview(): void {
    this.viewToken.update((v) => v + 1);
    this.closeHub();
    this.closeCorridor();
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
    else if (this.corridorSlug()) this.closeCorridor();
    else if (this.askOpen()) this.closeAsk();
    else if (this.sourcesOpen()) this.sourcesOpen.set(false);
  }

  // ------------------------------------------------------------- poles & search
  protected selectHub(slug: string, fly = true): void {
    this.selectedSlug.set(slug);
    this.query.set('');
    this.searchFocused.set(false);
    if (fly) this.flyTarget.set({ slug, token: ++this.flyCount });
  }

  protected closeHub(): void {
    this.selectedSlug.set(null);
  }

  protected onQuery(event: Event): void {
    this.query.set((event.target as HTMLInputElement).value);
  }

  protected pickFirstSuggestion(): void {
    const first = this.suggestions()[0];
    if (first) this.pick(first);
  }

  protected pick(s: Suggestion): void {
    if (s.type === 'hub') {
      this.setView('city');
      this.selectHub(s.slug);
    } else {
      this.selectCorridor(s.slug);
    }
  }

  // ------------------------------------------------------------- Capital Region
  protected setView(view: MapView): void {
    if (view === this.view()) return;
    this.view.set(view);
    if (view === 'city') this.corridorSlug.set(null);
    else this.selectedSlug.set(null);
  }

  protected selectCorridor(slug: string): void {
    this.view.set('region');
    this.selectedSlug.set(null);
    this.corridorSlug.set(slug);
    this.query.set('');
    this.searchFocused.set(false);
  }

  protected closeCorridor(): void {
    this.corridorSlug.set(null);
  }

  /** From a direction card to one of Hanoi's poles: back to the city view, on that pole. */
  protected showPole(slug: string): void {
    this.corridorSlug.set(null);
    this.view.set('city');
    this.selectHub(slug);
  }

  protected toggleTheme(theme: CorridorTheme): void {
    const current = this.themeFilter();
    this.themeFilter.set(current.includes(theme) ? current.filter((t) => t !== theme) : [...current, theme]);
  }

  protected nodeNames(c: CorridorSummary): string {
    return c.nodes.map((n) => n.name).join(', ');
  }

  protected corridorOf(slug: string): CorridorSummary | undefined {
    return this.region()?.corridors.find((c) => c.slug === slug);
  }

  /** The sources of a direction card, by id. */
  protected sourcesOf(ids: readonly string[]): SourceRef[] {
    const all = this.region()?.sources ?? {};
    return ids.filter((id) => all[id]).map((id) => ({ id, ...all[id] }));
  }

  /** Poles named in the answer that are on the map at this milestone (as chips to jump to). */
  protected readonly answerPoles = computed(() => {
    const slugs = this.answer()?.highlights ?? [];
    return this.hubList().filter((h) => slugs.includes(h.slug));
  });

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
      .compare(years, this.lang())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (result) => this.compare.set(result),
        error: (e: unknown) => this.compareError.set(describeError(e, this.lang())),
      });
  }

  protected delta(value: number): string {
    const sign = value > 0 ? '+' : '';
    const text = Number.isInteger(value) ? String(value) : value.toFixed(1);
    return `${sign}${this.lang() === 'vi' ? text.replace('.', ',') : text}`;
  }

  // ------------------------------------------------------------- questions
  protected openAsk(): void {
    this.askOpen.set(true);
    if (this.questions().length === 0) this.loadQuestions();
  }

  private loadQuestions(): void {
    this.api
      .questions(this.lang())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (r) => this.questions.set(r.questions),
        error: (e: unknown) => this.askError.set(describeError(e, this.lang())),
      });
  }

  protected ask(question: Question): void {
    this.askedId.set(question.id);
    this.run(this.api.ask(question.id, this.year(), this.lang()));
  }

  protected onAskInput(event: Event): void {
    this.askText.set((event.target as HTMLInputElement).value);
  }

  protected askFree(event: Event): void {
    event.preventDefault();
    const text = this.askText().trim();
    if (text.length < 2 || this.asking()) return;
    this.askedId.set(null);
    this.run(this.api.askAi(text, this.year(), this.lang()));
  }

  private run(request: ReturnType<FutureMapService['ask']>): void {
    this.asking.set(true);
    this.askError.set(null);
    request.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (answer) => {
        this.answer.set(answer);
        this.asking.set(false);
        this.highlights.set(answer.highlights);
        if (answer.highlights.length === 1) this.flyTarget.set({ slug: answer.highlights[0], token: ++this.flyCount });
      },
      error: (e: unknown) => {
        this.askError.set(describeError(e, this.lang()));
        this.asking.set(false);
      },
    });
  }

  /** Who answered: the rules, Claude, or the template answerer. */
  protected answeredBy(a: Answer): string {
    const t = this.t();
    if (a.outOfScope) return t.outOfScope;
    if (a.source === 'rules') return t.byRules;
    return a.provider === 'anthropic' ? t.byClaude : t.byMock;
  }

  protected closeAsk(): void {
    this.askOpen.set(false);
    this.highlights.set([]);
  }

  protected retry(): void {
    this.error.set(null);
    this.reload.update((n) => n + 1);
  }
}
