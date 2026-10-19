import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  HostListener,
  Injector,
  ViewChild,
  afterNextRender,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { EMPTY, catchError, of, switchMap, tap } from 'rxjs';
import { IconComponent } from '../living-score/components/icon/icon.component';
import { ThemeService } from '../services/theme.service';
import { normalizeText } from '../utils/text';
import { FeasibilityStore, RiskReason, computeFeasibility, planWards, riskOf } from './op-feasibility';
import { OpFeasibilityComponent } from './op-feasibility.component';
import { MarketKey, MarketSort, marketCsv, marketRows, sortMarket } from './op-market';
import { parseIdeaLocal } from './op-parse';
import { AccountService } from '../services/account.service';
import { PaidReportRequest } from '../services/billing.service';
import { OpBuyComponent } from './op-buy.component';
import { AiQuotaComponent } from '../components/ai-quota/ai-quota.component';
import { SavedReport, SavedReportsStore } from './op-reports';
import { OpRadarComponent, RadarSeries } from './op-radar.component';
import { OP_LANG_KEY, OP_TEXT } from './op-i18n';
import { OpMapComponent, SCORE_STOPS } from './op-map.component';
import { AskAnswer, BusinessType, CompareResponse, Horizon, Lang, Opportunity, ParsedIdea, Signal, WardDetail, WardProps, WardsResponse } from './op.models';
import { OpportunityService, describeError } from './op.service';

const SLUG = /^[a-z0-9-]{1,60}$/;
const MAX_COMPARE = 3;

function initialLang(params: URLSearchParams): Lang {
  const fromUrl = params.get('lang');
  if (fromUrl === 'vi' || fromUrl === 'en') return fromUrl;
  try {
    return localStorage.getItem(OP_LANG_KEY) === 'en' ? 'en' : 'vi';
  } catch {
    return 'vi';
  }
}

/**
 * Business Opportunity Map — Hanoi wards (2025) coloured by how promising a business type is there, today or in
 * 3–5 years, from OpenStreetMap data. Pick a type first (where should I open X?) or a ward (what should I open
 * here?); every score opens up into the figures behind it. The ward panel also checks whether the business would pay
 * (feasibility calculator on the user's assumptions) and prints a report — the former Business Copilot, merged here.
 */
@Component({
  selector: 'app-opportunity',
  standalone: true,
  imports: [OpMapComponent, IconComponent, RouterLink, OpFeasibilityComponent, OpRadarComponent, OpBuyComponent, AiQuotaComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './opportunity.component.html',
  styleUrl: './opportunity.component.css',
})
export class OpportunityComponent {
  private readonly api = inject(OpportunityService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly injector = inject(Injector);
  protected readonly theme = inject(ThemeService).effective;
  @ViewChild(OpMapComponent) protected map?: OpMapComponent;

  private readonly params = new URLSearchParams(typeof location === 'undefined' ? '' : location.search);
  protected readonly lang = signal<Lang>(initialLang(this.params));
  protected readonly t = computed(() => OP_TEXT[this.lang()]);
  protected readonly scoreStops = SCORE_STOPS;

  protected readonly types = signal<BusinessType[]>([]);
  protected readonly type = signal<string | null>(this.validSlug(this.params.get('type')));
  protected readonly horizon = signal<Horizon>(this.params.get('horizon') === '2030' ? '2030' : 'now');
  protected readonly wards = signal<WardsResponse | null>(null);
  protected readonly error = signal<string | null>(null);
  private readonly reload = signal(0);

  protected readonly selected = signal<string | null>(this.validSlug(this.params.get('ward')));
  protected readonly detail = signal<WardDetail | null>(null);
  protected readonly flyToken = signal(0);
  protected readonly showPlaces = signal(false);
  protected readonly places = signal<GeoJSON.FeatureCollection | null>(null);

  protected readonly query = signal('');
  protected readonly compare = signal<string[]>((this.params.get('compare') ?? '').split(',').filter((s) => SLUG.test(s)).slice(0, MAX_COMPARE));
  protected readonly compareOpen = signal(false);
  protected readonly compareResult = signal<CompareResponse | null>(null);
  protected readonly askOpen = signal(false);
  protected readonly askText = signal('');
  protected readonly asking = signal(false);
  protected readonly answer = signal<AskAnswer | null>(null);
  protected readonly askError = signal<string | null>(null);
  protected readonly methodOpen = signal(false);
  protected readonly reportOpen = signal(false);
  protected readonly feasStore = inject(FeasibilityStore);
  /** Feasibility of the business type in focus, on the user's assumptions (for the report). */
  protected readonly feasibility = computed(() => {
    const f = this.focus();
    return f ? { type: f.type, a: this.feasStore.get(f.type), r: computeFeasibility(this.feasStore.get(f.type)) } : null;
  });
  /** Risk of the type in focus on the user's assumptions (for the report). */
  protected readonly reportRisk = computed(() => {
    const fe = this.feasibility();
    return fe ? riskOf(fe.r, fe.r.budgetGap >= 0, this.focus()?.competition) : null;
  });
  /** What a paid report of the open ward would be computed from (the server computes it). */
  protected readonly buyRequest = computed<PaidReportRequest | null>(() => {
    const f = this.focus();
    const d = this.detail();
    return f && d ? { type: f.type, ward: d.slug, horizon: this.horizon(), assumptions: this.feasStore.get(f.type) } : null;
  });
  /** Straight from the ward panel: the report dialog, scrolled down to the paid report panel at its end. */
  protected openFullReport(): void {
    this.reportOpen.set(true);
    afterNextRender(() => document.getElementById('op-buy')?.scrollIntoView({ block: 'start' }), { injector: this.injector });
  }
  /** Set while the sign-in dialog opened from the paid report panel is showing. */
  private readonly resumeBuy = signal(false);
  /**
   * The sign-in dialog lives in the site header, under this page's report dialog: close the report first, and
   * reopen it on the paid panel when the sign-in dialog closes.
   */
  protected signInToBuy(): void {
    this.reportOpen.set(false);
    this.resumeBuy.set(true);
    this.account.dialogOpen.set(true);
  }
  // ------------------------------------------------------------- saved reports (this browser only)
  protected readonly reports = inject(SavedReportsStore);
  protected readonly account = inject(AccountService);
  protected readonly reportsOpen = signal(false);
  protected readonly justSaved = signal(false);
  // ------------------------------------------------------------- business plan (type + budget → wards)
  protected readonly planOn = signal(false);
  protected readonly planText = signal('');
  protected readonly planAdjust = signal(true);
  protected readonly parsing = signal(false);
  protected readonly planNote = signal<string | null>(null);
  /** Every scored ward for the selected type under the user's plan, best first. */
  protected readonly planRows = computed(() => {
    const type = this.type();
    const w = this.wards();
    if (!this.planOn() || !type || !w) return [];
    const list = this.wardList()
      .filter((x) => x.scored && x.score !== null)
      .map((x) => ({ slug: x.slug, name: x.name, score: x.score ?? 0, landMedian: x.landMedian ?? null, competition: x.competition ?? null }));
    return planWards(list, this.feasStore.get(type), w.meta.landCityMedian, this.planAdjust());
  });
  /** The plan's adjustment for the open ward (passed to its feasibility box). */
  protected readonly wardFactors = computed(() => (this.planOn() && this.planAdjust() ? (this.planRows().find((r) => r.slug === this.selected())?.factors ?? null) : null));
  protected readonly planBudget = computed(() => (this.type() ? this.feasStore.get(this.type()!).budget : 0));

  // ------------------------------------------------------------- market table (every scored ward, sortable)
  protected readonly marketOpen = signal(false);
  protected readonly marketSort = signal<MarketSort>({ key: 'score', desc: true });
  protected readonly marketQuery = signal('');
  protected readonly marketGaps = signal(false);
  private readonly marketAll = computed(() => marketRows(this.wardList()));
  protected readonly marketView = computed(() => sortMarket(this.marketAll(), this.marketSort(), { query: this.marketQuery(), gapsOnly: this.marketGaps() }));
  protected readonly marketCount = computed(() => this.marketAll().length);
  /** With a type selected but no demand figures, the backend predates the market table. */
  protected readonly marketOld = computed(() => !!this.type() && this.marketAll().length > 0 && this.marketAll().every((r) => r.demand === null));
  /** Columns: the type's figures only when a type is selected. */
  protected readonly shownCols = computed<MarketKey[]>(() =>
    this.type() ? ['name', 'score', 'demand', 'competition', 'count', 'per10k', 'population', 'landMedian'] : ['name', 'score', 'population', 'landMedian'],
  );

  // ------------------------------------------------------------- compare radar
  private readonly radarSignals: Signal[] = ['population', 'offices', 'apartments', 'schools', 'metro'];
  /** Axes and one shape per compared ward; null when a ward is not scored or the backend sends no signals. */
  protected readonly radar = computed<{ axes: string[]; series: RadarSeries[] } | null>(() => {
    const c = this.compareResult();
    if (!c || c.wards.some((w) => !w.signals || !w.focus)) return null;
    const t = this.t();
    const axes = [...this.radarSignals.map((s) => t.signals[s]), ...(c.type ? [t.radar.lessCompetition] : []), t.score];
    const series = c.wards.map((w) => ({
      name: w.name,
      values: [...this.radarSignals.map((s) => w.signals![s]), ...(c.type ? [100 - w.focus!.competition] : []), w.focus!.opportunity],
    }));
    return { axes, series };
  });

  // ------------------------------------------------------------- competitors list
  protected readonly rivalsOpen = signal(false);
  protected readonly rivals = signal<{ named: string[]; unnamed: number } | null>(null);

  protected readonly copied = signal(false);
  /** Left panel; on small screens it folds away while a ward is open, so the map stays visible. */
  protected readonly panelOpen = signal(!(this.selected() && this.isSmall()));

  protected readonly selectedType = computed(() => this.types().find((x) => x.key === this.type()) ?? null);
  private readonly wardList = computed(() => (this.wards()?.features ?? []).map((f) => f.properties as unknown as WardProps));
  /** Best wards for the selected type (or by their top type), for the list in the left panel. */
  protected readonly ranking = computed(() =>
    this.wardList()
      .filter((w) => w.scored && w.score !== null)
      .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
      .slice(0, 12),
  );
  protected readonly suggestions = computed(() => {
    const q = normalizeText(this.query());
    if (!q) return [];
    return this.wardList()
      .filter((w) => normalizeText(w.name).includes(q))
      .slice(0, 6);
  });
  /** The selected type in the ward panel (or the ward's best type when no type is selected). */
  protected readonly focus = computed<Opportunity | null>(() => {
    const d = this.detail();
    if (!d?.scored) return null;
    return (this.type() ? d.opportunities.find((o) => o.type === this.type()) : d.opportunities[0]) ?? null;
  });
  protected readonly others = computed(() => {
    const d = this.detail();
    const f = this.focus();
    return (d?.opportunities ?? []).filter((o) => o.type !== f?.type).slice(0, 6);
  });
  protected readonly compareNames = computed(() => this.compare().map((slug) => this.wardList().find((w) => w.slug === slug)?.name ?? slug));

  constructor() {
    toObservable(computed(() => this.lang()))
      .pipe(
        switchMap((lang) => this.api.types(lang).pipe(catchError(() => of(null)))),
        takeUntilDestroyed(),
      )
      .subscribe((r) => {
        if (!r) return;
        this.types.set(r.types);
        if (this.type() && !r.types.some((x) => x.key === this.type())) this.type.set(null);
      });

    toObservable(computed(() => ({ type: this.type(), horizon: this.horizon(), lang: this.lang(), reload: this.reload() })))
      .pipe(
        switchMap(({ type, horizon, lang }) =>
          this.api.wards(type, horizon, lang).pipe(
            catchError((e: unknown) => {
              this.error.set(describeError(e, lang));
              return EMPTY;
            }),
          ),
        ),
        takeUntilDestroyed(),
      )
      .subscribe((w) => {
        this.error.set(null);
        this.wards.set(w);
      });

    toObservable(computed(() => ({ slug: this.selected(), horizon: this.horizon(), lang: this.lang() })))
      .pipe(
        tap(({ slug }) => {
          if (!slug) this.detail.set(null);
        }),
        switchMap(({ slug, horizon, lang }) => (slug ? this.api.ward(slug, horizon, lang).pipe(catchError(() => (this.selected.set(null), EMPTY))) : EMPTY)),
        takeUntilDestroyed(),
      )
      .subscribe((d) => this.detail.set(d));

    // Competitors of the focused type in the selected ward.
    toObservable(computed(() => ({ slug: this.selected(), type: this.focus()?.type ?? null, show: this.showPlaces() })))
      .pipe(
        switchMap(({ slug, type, show }) => (slug && type && show ? this.api.places(slug, type).pipe(catchError(() => of(null))) : of(null))),
        takeUntilDestroyed(),
      )
      .subscribe((p) => this.places.set(p));

    // Names of the competitors, when the list is open.
    toObservable(computed(() => ({ slug: this.selected(), type: this.focus()?.type ?? null, open: this.rivalsOpen() })))
      .pipe(
        switchMap(({ slug, type, open }) => (slug && type && open ? this.api.places(slug, type).pipe(catchError(() => of(null))) : of(null))),
        takeUntilDestroyed(),
      )
      .subscribe((fc) => {
        if (!fc) return this.rivals.set(null);
        const names = fc.features.map((f) => (f.properties as { name?: string | null })?.name ?? '').map((n) => n.trim());
        this.rivals.set({ named: [...new Set(names.filter(Boolean))].sort((a, b) => a.localeCompare(b, 'vi')), unnamed: names.filter((n) => !n).length });
      });

    // Keep the address bar on the current view so it can be shared.
    effect(() => {
      const url = this.shareUrl();
      if (typeof history !== 'undefined') history.replaceState(history.state, '', url.slice(location.origin.length));
    });

    // Back to the paid report panel once the sign-in dialog opened from it closes (signed in or not).
    effect(() => {
      if (!this.resumeBuy() || this.account.dialogOpen()) return;
      untracked(() => {
        this.resumeBuy.set(false);
        this.openFullReport();
      });
    });
    if (this.selected()) setTimeout(() => this.flyToken.update((n) => n + 1), 1500);
  }

  private isSmall(): boolean {
    return typeof window !== 'undefined' && window.innerWidth <= 1100;
  }

  private validSlug(value: string | null): string | null {
    return value && SLUG.test(value) ? value : null;
  }

  private shareUrl(): string {
    const p = new URLSearchParams();
    if (this.type()) p.set('type', this.type()!);
    if (this.horizon() === '2030') p.set('horizon', '2030');
    if (this.selected()) p.set('ward', this.selected()!);
    if (this.compare().length) p.set('compare', this.compare().join(','));
    if (this.lang() === 'en') p.set('lang', 'en');
    const qs = p.toString();
    return `${location.origin}${location.pathname}${qs ? `?${qs}` : ''}`;
  }

  // ------------------------------------------------------------- business plan
  /** Reads the idea ("Tôi có 500 triệu, muốn mở quán cà phê"), then ranks the wards for it. */
  protected runPlan(): void {
    const text = this.planText().trim();
    if (!text || this.parsing()) return;
    this.parsing.set(true);
    this.api.parse(text, this.lang()).subscribe({
      next: (idea) => {
        this.parsing.set(false);
        this.applyIdea(idea);
      },
      error: (e: unknown) => {
        this.parsing.set(false);
        // An older backend has no /parse route (404), or it is unreachable: read the idea here instead.
        const status = (e as { status?: number } | null)?.status;
        if (status === 404 || status === 0) this.applyIdea(parseIdeaLocal(text, this.types(), this.wardList()));
        else this.planNote.set(describeError(e, this.lang()));
      },
    });
  }

  private applyIdea(idea: ParsedIdea): void {
    const t = this.t().plan;
    const notes: string[] = [];
    if (idea.type) this.setType(idea.type);
    if (idea.type && idea.budget) this.feasStore.set(idea.type, { budget: idea.budget });
    if (!idea.type && !this.type()) notes.push(t.needType);
    if (!idea.budget) notes.push(t.needBudget);
    const type = idea.type ?? this.type();
    if (type) {
      const name = idea.typeName ?? this.types().find((x) => x.key === type)?.name ?? type;
      notes.unshift(t.understood(name, this.money(this.feasStore.get(type).budget)));
    }
    this.planNote.set(notes.join(' '));
    this.planOn.set(!!type);
    if (idea.ward) this.selectWard(idea.ward.slug, true);
  }

  protected setPlanBudget(value: string): void {
    const n = Number(value);
    if (this.type() && Number.isFinite(n) && n >= 0) this.feasStore.set(this.type()!, { budget: n });
  }

  // ------------------------------------------------------------- market table
  protected sortBy(key: MarketKey): void {
    const cur = this.marketSort();
    // Names read A→Z first, figures high→low first; the same column again flips the order.
    this.marketSort.set(cur.key === key ? { key, desc: !cur.desc } : { key, desc: key !== 'name' });
  }

  protected ariaSort(key: MarketKey): 'ascending' | 'descending' | 'none' {
    const cur = this.marketSort();
    return cur.key !== key ? 'none' : cur.desc ? 'descending' : 'ascending';
  }

  protected openFromMarket(slug: string): void {
    this.marketOpen.set(false);
    this.selectWard(slug, true);
  }

  protected downloadCsv(): void {
    const m = this.t().market;
    const blob = new Blob([marketCsv(this.marketView(), m.cols)], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `co-hoi-kinh-doanh-${this.type() ?? 'tat-ca'}-${this.horizon()}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  // ------------------------------------------------------------- saved reports
  protected saveReport(): void {
    const d = this.detail();
    const f = this.focus();
    const fe = this.feasibility();
    const risk = this.reportRisk();
    if (!d || !f || !fe || !risk) return;
    this.reports.save({
      type: f.type,
      typeName: f.name,
      icon: f.icon,
      ward: d.slug,
      wardName: d.name,
      horizon: this.horizon(),
      score: f.opportunity,
      demand: f.demand,
      competition: f.competition,
      count: f.count,
      assumptions: fe.a,
      result: {
        revenue: fe.r.revenue,
        costs: fe.r.costs.total,
        profit: fe.r.profit,
        marginPct: fe.r.marginPct,
        investment: fe.r.investment,
        paybackMonths: fe.r.paybackMonths,
        budgetGap: fe.r.budgetGap,
      },
      risk: risk.level,
    });
    this.justSaved.set(true);
    setTimeout(() => this.justSaved.set(false), 2000);
  }

  /** Back to the saved type, horizon and assumptions, then the ward's report. */
  protected reopenReport(r: SavedReport): void {
    this.reportsOpen.set(false);
    this.setType(r.type);
    this.horizon.set(r.horizon);
    this.feasStore.set(r.type, r.assumptions);
    this.selectWard(r.ward, true);
    this.reportOpen.set(true);
  }

  protected clearReports(): void {
    if (confirm(this.t().saved.confirmClear)) this.reports.clear();
  }

  protected savedDate(iso: string): string {
    return new Date(iso).toLocaleDateString(this.lang() === 'en' ? 'en-GB' : 'vi-VN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  protected riskTitle(reasons: RiskReason[]): string {
    const r = this.t().risk;
    return reasons.length ? reasons.map((k) => r.reasons[k]).join(', ') : r.none;
  }

  protected exitPlan(): void {
    this.planOn.set(false);
    this.planNote.set(null);
  }

  // ------------------------------------------------------------- choices
  protected setType(key: string | null): void {
    this.type.set(key);
    this.answer.set(null);
    this.rivalsOpen.set(false);
    if (!key) this.planOn.set(false);
  }

  protected setHorizon(h: Horizon): void {
    this.horizon.set(h);
  }

  protected selectWard(slug: string, fly = false): void {
    this.selected.set(slug);
    this.query.set('');
    if (this.isSmall()) this.panelOpen.set(false);
    if (fly) this.flyToken.update((n) => n + 1);
  }

  protected today(): string {
    return new Date().toLocaleDateString(this.lang() === 'en' ? 'en-GB' : 'vi-VN', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  /** VND as "45,6 tr" / "1,25 tỷ". */
  protected money(v: number): string {
    const f = this.t().feas;
    const abs = Math.abs(v);
    return `${v < 0 ? '−' : ''}${abs >= 1e9 ? `${this.num(abs / 1e9, 2)} ${f.unitBillion}` : `${this.num(abs / 1e6, 1)} ${f.unitMillion}`}`;
  }

  protected closeWard(): void {
    this.selected.set(null);
    this.showPlaces.set(false);
  }

  protected onQuery(event: Event): void {
    this.query.set((event.target as HTMLInputElement).value);
  }

  protected toggleLang(): void {
    const next: Lang = this.lang() === 'vi' ? 'en' : 'vi';
    this.lang.set(next);
    this.answer.set(null);
    this.compareResult.set(null);
    try {
      localStorage.setItem(OP_LANG_KEY, next);
    } catch {
      /* not remembered */
    }
    if (this.compareOpen()) this.loadCompare();
  }

  // ------------------------------------------------------------- compare
  protected inCompare(slug: string): boolean {
    return this.compare().includes(slug);
  }

  protected toggleCompare(slug: string): void {
    const list = this.compare();
    if (list.includes(slug)) this.compare.set(list.filter((s) => s !== slug));
    else if (list.length < MAX_COMPARE) this.compare.set([...list, slug]);
    if (this.compareOpen()) this.loadCompare();
  }

  protected openCompare(): void {
    this.compareOpen.set(true);
    this.loadCompare();
  }

  private loadCompare(): void {
    this.compareResult.set(null);
    if (this.compare().length < 2) return;
    this.api
      .compare(this.compare(), this.type(), this.horizon(), this.lang())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({ next: (r) => this.compareResult.set(r), error: () => this.compareResult.set(null) });
  }

  // ------------------------------------------------------------- ask
  protected onAskInput(event: Event): void {
    this.askText.set((event.target as HTMLInputElement).value);
  }

  protected ask(event: Event): void {
    event.preventDefault();
    const q = this.askText().trim();
    if (q.length < 2 || this.asking()) return;
    this.asking.set(true);
    this.askError.set(null);
    this.api
      .ask(q, { type: this.type(), ward: this.selected(), horizon: this.horizon(), lang: this.lang() })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (a) => {
          this.answer.set(a);
          this.asking.set(false);
        },
        error: (e: unknown) => {
          this.askError.set(describeError(e, this.lang()));
          this.asking.set(false);
        },
      });
  }

  protected answeredBy(a: AskAnswer): string {
    const by = this.t().askBy;
    return a.outOfScope ? by['out'] : (by[a.provider] ?? by['mock']);
  }

  // ------------------------------------------------------------- share & misc
  protected async share(): Promise<void> {
    const url = this.shareUrl();
    try {
      if (navigator.share && matchMedia('(pointer: coarse)').matches) {
        await navigator.share({ title: this.t().title, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      this.copied.set(true);
      setTimeout(() => this.copied.set(false), 2000);
    } catch {
      /* share sheet closed or clipboard refused — the link is in the address bar */
    }
  }

  protected retry(): void {
    this.error.set(null);
    this.reload.update((n) => n + 1);
  }

  @HostListener('document:keydown.escape')
  protected onEscape(): void {
    if (this.compareOpen()) this.compareOpen.set(false);
    else if (this.marketOpen()) this.marketOpen.set(false);
    else if (this.reportsOpen()) this.reportsOpen.set(false);
    else if (this.askOpen()) this.askOpen.set(false);
    else if (this.reportOpen()) this.reportOpen.set(false);
    else if (this.methodOpen()) this.methodOpen.set(false);
    else if (this.selected()) this.closeWard();
  }

  /** 29.9 → "29,9" in Vietnamese. */
  protected num(value: number | null | undefined, digits = 1): string {
    if (value === null || value === undefined) return '—';
    return value.toLocaleString(this.lang() === 'en' ? 'en-US' : 'vi-VN', { maximumFractionDigits: digits });
  }

  protected bandColor(score: number | null): string {
    if (score === null) return 'var(--op-ink-faint)';
    let color = SCORE_STOPS[0][1];
    for (const [v, c] of SCORE_STOPS) if (score >= v) color = c;
    return color;
  }

  protected shortName(name: string): string {
    return name.replace(/^(Phường|Xã)\s+/, '');
  }

  protected typeOf(key: string): BusinessType | undefined {
    return this.types().find((x) => x.key === key);
  }
}
