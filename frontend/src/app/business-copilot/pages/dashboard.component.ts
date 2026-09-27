import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { EMPTY, catchError, switchMap, tap } from 'rxjs';
import { IconComponent } from '../../living-score/components/icon/icon.component';
import { CompareResult, LocationDetail, Recommendations } from '../bc.models';
import { BcApiService, BcStateService, describeError } from '../bc.service';
import { BC_CHARTS, scoreTone } from '../shared/bc-charts';
import { CATEGORY_OPTIONS, LevelPipe, MoneyPipe, budgetLabel } from '../shared/bc-format';

const FACTORS = ['Dân số', 'Thu nhập', 'Đối thủ', 'Giá thuê', 'Lưu lượng khách', 'Metro', 'Trường học', 'Văn phòng', 'Quy hoạch', 'Nhu cầu địa phương'];

@Component({
  selector: 'bc-dashboard',
  standalone: true,
  imports: [IconComponent, RouterLink, MoneyPipe, LevelPipe, ...BC_CHARTS],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css',
})
export class BcDashboardComponent {
  private readonly api = inject(BcApiService);
  protected readonly state = inject(BcStateService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly categories = CATEGORY_OPTIONS;
  protected readonly factors = FACTORS;
  protected readonly tone = scoreTone;

  protected readonly recs = signal<Recommendations | null>(null);
  protected readonly recsError = signal<string | null>(null);
  protected readonly analyzing = signal(false);
  protected readonly detail = signal<LocationDetail | null>(null);
  protected readonly detailLoading = signal(false);
  protected readonly compare = signal<CompareResult | null>(null);

  protected readonly selectedSlug = computed(() => {
    const list = this.recs()?.recommendations ?? [];
    const wanted = this.state.selected();
    return list.find((r) => r.slug === wanted)?.slug ?? list[0]?.slug ?? null;
  });
  protected readonly budget = computed(() => budgetLabel(this.state.budgetVnd()));
  protected readonly categoryLabel = computed(() => CATEGORY_OPTIONS.find((c) => c.key === this.state.category())?.label ?? '');

  protected readonly tiles = computed(() => {
    const d = this.detail();
    if (!d) return [];
    return [
      { label: 'Nhu cầu', value: `${d.scores.demand}`, unit: '/100', bar: d.scores.demand },
      { label: 'Cạnh tranh', value: this.levelVi(d.competitionLabel), unit: '', bar: d.scores.competition, color: 'var(--bc-warn)' },
      { label: 'Tiền thuê ước tính', value: `${Math.round(d.estRentMillions)}`, unit: 'tr/tháng', bar: d.scores.rent, color: 'var(--bc-warn)' },
      { label: 'Mật độ khách', value: `${d.customerDensityKPerKm2}`, unit: 'k/km²', bar: Math.min(100, d.customerDensityKPerKm2 * 3), color: 'var(--bc-accent)' },
      { label: 'Lưu lượng khách', value: `${d.scores.traffic}`, unit: '/100', bar: d.scores.traffic },
      { label: 'Tiếp cận', value: `${d.scores.accessibility}`, unit: '/100', bar: d.scores.accessibility, color: '#06b6d4' },
      { label: 'Mức đầu tư', value: this.levelVi(d.investmentLevel), unit: '', bar: d.investmentLevel === 'Low' ? 35 : d.investmentLevel === 'Medium' ? 65 : 92, color: 'var(--bc-warn)' },
      { label: 'Doanh thu tiềm năng', value: `${Math.round(d.revenuePotentialMillions)}`, unit: 'tr/tháng', bar: Math.min(100, d.revenuePotentialMillions / 3), color: 'var(--bc-good)' },
    ];
  });

  protected readonly costBar = computed(() => {
    const d = this.detail();
    if (!d) return [];
    const colors = ['#f59e0b', '#fb923c', '#fdba74', '#fcd34d', '#fde68a', '#e5e7eb'];
    return d.monthlyCosts.items.map((item, i) => ({ ...item, color: colors[i], pct: (item.millions / d.monthlyCosts.totalMillions) * 100 }));
  });

  protected readonly round = Math.round;

  protected readonly customerColors = ['#2563eb', '#06b6d4', '#16a34a', '#8b5cf6'];

  constructor() {
    this.loadRecommendations();

    toObservable(computed(() => ({ slug: this.selectedSlug(), cat: this.state.category(), budget: this.state.budgetVnd() })))
      .pipe(
        tap(({ slug }) => slug && this.detailLoading.set(true)),
        switchMap(({ slug, cat, budget }) =>
          slug
            ? this.api.location(slug, cat, budget).pipe(
                catchError(() => {
                  this.detailLoading.set(false);
                  return EMPTY;
                }),
              )
            : EMPTY,
        ),
        takeUntilDestroyed(),
      )
      .subscribe((d) => {
        this.detail.set(d);
        this.detailLoading.set(false);
      });
  }

  private levelVi(level: 'Low' | 'Medium' | 'High'): string {
    return { Low: 'Thấp', Medium: 'Trung bình', High: 'Cao' }[level];
  }

  private loadRecommendations(): void {
    this.api
      .recommendations(this.state.category(), this.state.budgetVnd())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (r) => this.applyRecs(r),
        error: (e: unknown) => this.recsError.set(describeError(e)),
      });
  }

  private applyRecs(r: Recommendations): void {
    this.recsError.set(null);
    this.recs.set(r);
    const top3 = r.recommendations.slice(0, 3).map((x) => x.slug);
    this.api
      .compare(top3, r.category.key, r.budgetMillions * 1_000_000)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({ next: (c) => this.compare.set(c), error: () => this.compare.set(null) });
  }

  protected onPrompt(event: Event): void {
    this.state.set({ prompt: (event.target as HTMLTextAreaElement).value });
  }

  protected useCategory(key: string, prompt: string): void {
    this.state.set({ prompt: `Tôi có ${Math.round(this.state.budgetVnd() / 1_000_000)} triệu, muốn ${prompt} ở Hà Nội.` });
    void key;
  }

  protected analyze(): void {
    const message = this.state.prompt().trim();
    if (!message || this.analyzing()) return;
    this.analyzing.set(true);
    this.recsError.set(null);
    this.api
      .analyze(message)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (r) => {
          this.analyzing.set(false);
          this.state.set({ category: r.category.key, budgetVnd: r.parsed?.budgetVnd ?? this.state.budgetVnd(), selected: r.recommendations[0]?.slug ?? null });
          this.applyRecs(r);
        },
        error: (e: unknown) => {
          this.analyzing.set(false);
          this.recsError.set(describeError(e));
        },
      });
  }

  protected select(slug: string): void {
    this.state.set({ selected: slug });
  }

  protected askAbout(): void {
    const d = this.detail();
    this.state.askCopilot(d ? `Vì sao ${d.name} phù hợp cho ${d.category.nameVi.toLowerCase()}? Rủi ro là gì?` : 'Tôi nên mở kinh doanh ở đâu?');
  }

  protected goCompare(): void {
    const list = this.recs()?.recommendations ?? [];
    const sel = this.selectedSlug();
    const others = list.filter((r) => r.slug !== sel).slice(0, 2).map((r) => r.slug);
    this.state.set({ compare: sel ? [sel, ...others] : others });
    void this.router.navigate(['/business-copilot/compare']);
  }

  protected goSimulate(): void {
    void this.router.navigate(['/business-copilot/simulator']);
  }

  protected goReport(): void {
    void this.router.navigate(['/business-copilot/reports'], { queryParams: { location: this.selectedSlug(), generate: 1 } });
  }

  protected compareValue(metricKey: string, slug: string): string {
    const m = this.compare()?.metrics.find((x) => x.key === metricKey);
    const v = m?.values[slug];
    if (v === null || v === undefined) return '—';
    if (metricKey === 'rent' || metricKey === 'revenue') return `${Math.round(Number(v))}tr`;
    if (metricKey === 'breakEven') return `T${v}`;
    if (metricKey === 'investment') return ({ Low: 'Thấp', Medium: 'TB', High: 'Cao' } as Record<string, string>)[String(v)] ?? String(v);
    if (metricKey === 'competition') return `${v}`;
    return `${v}`;
  }

  protected isBest(metricKey: string, slug: string): boolean {
    return this.compare()?.metrics.find((x) => x.key === metricKey)?.best.includes(slug) ?? false;
  }

  protected readonly compareRows = [
    { key: 'businessScore', label: 'Điểm' },
    { key: 'demand', label: 'Nhu cầu' },
    { key: 'competition', label: 'Cạnh tranh' },
    { key: 'rent', label: 'Tiền thuê' },
    { key: 'traffic', label: 'Lưu lượng' },
    { key: 'revenue', label: 'Doanh thu' },
    { key: 'breakEven', label: 'Hoà vốn' },
    { key: 'investment', label: 'Đầu tư' },
  ];

  protected severityClass(level: string): string {
    return level === 'High' ? 'bc-pill--bad' : level === 'Medium' ? 'bc-pill--warn' : 'bc-pill--good';
  }
}
