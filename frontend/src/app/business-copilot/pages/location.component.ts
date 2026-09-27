import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { EMPTY, catchError, map, switchMap, tap } from 'rxjs';
import { IconComponent } from '../../living-score/components/icon/icon.component';
import { CopilotAnswer, LocationDetail } from '../bc.models';
import { BcApiService, BcStateService, describeError } from '../bc.service';
import { BC_CHARTS } from '../shared/bc-charts';
import { LevelPipe, MoneyPipe } from '../shared/bc-format';

/** Location Intelligence: the full breakdown for one area and the current business idea. */
@Component({
  selector: 'bc-location',
  standalone: true,
  imports: [IconComponent, RouterLink, MoneyPipe, LevelPipe, ...BC_CHARTS],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <a class="bc-btn bc-btn--sm lo-back" routerLink="/business-copilot"><ls-icon name="arrow-left" [size]="14" /> Dashboard</a>
    @if (d(); as d) {
      <section class="bc-card lo-head">
        <bc-ring [score]="d.totalScore" [size]="92" />
        <div>
          <p class="bc-eyebrow bc-eyebrow--accent">{{ d.name }} — Business Intelligence · {{ d.category.nameVi }}</p>
          <h1>{{ d.name }} <small>{{ d.totalScore }}/100</small></h1>
          <p>{{ d.cluster }} · hạng #{{ d.rank }}/{{ d.rankOf }} · {{ d.withinBudget ? 'trong ngân sách' : 'vượt ngân sách' }} {{ d.budgetMillions | money }}</p>
        </div>
        <div class="lo-actions">
          <button type="button" class="bc-btn" (click)="toCompare(d.slug)">+ So sánh</button>
          <button type="button" class="bc-btn" routerLink="/business-copilot/simulator">Mô phỏng</button>
          <button type="button" class="bc-btn bc-btn--dark" (click)="toReport(d.slug)">Tạo báo cáo</button>
        </div>
      </section>

      <div class="lo-grid">
        <section class="bc-card">
          <div class="bc-card__head"><h2>Phân rã điểm</h2><span class="bc-eyebrow">0–100</span></div>
          <div class="lo-bars">
            @for (row of breakdown(); track row.label) {
              <span>{{ row.label }}</span><bc-bar [value]="row.value" /><b>{{ row.value }}</b>
            }
          </div>
        </section>

        <section class="bc-card lo-why">
          <div class="bc-card__head"><h2><ls-icon name="sparkles" [size]="16" /> Vì sao chọn khu vực này?</h2><span class="bc-eyebrow bc-eyebrow--accent">{{ ai()?.provider === 'mock' ? 'Mock AI' : 'AI' }}</span></div>
          @if (ai(); as a) {
            <p class="lo-summary">{{ a.answer.summary }}</p>
            <ul>@for (e of a.answer.evidence; track e) { <li>{{ e }}</li> }</ul>
            <p class="lo-reco"><b>Khuyến nghị:</b> {{ a.answer.recommendation }}</p>
          } @else {
            <div class="bc-skel" style="height: 140px"></div>
          }
        </section>

        <section class="bc-card">
          <div class="bc-card__head"><h2>Dữ liệu khu vực</h2><span class="bc-eyebrow">Demo</span></div>
          <dl class="lo-facts">
            <dt>Dân số</dt><dd>{{ d.attributes.population.toLocaleString('vi-VN') }}</dd>
            <dt>Diện tích</dt><dd>{{ d.attributes.areaKm2 }} km²</dd>
            <dt>Mật độ khách</dt><dd>{{ d.customerDensityKPerKm2 }}k/km²</dd>
            <dt>Chỉ số thu nhập</dt><dd>{{ d.attributes.incomeIndex }}/100</dd>
            <dt>Nhân viên văn phòng</dt><dd>{{ d.attributes.officeWorkersK }}k</dd>
            <dt>Sinh viên</dt><dd>{{ d.attributes.studentsK }}k · {{ d.attributes.universities }} ĐH</dd>
            <dt>Trường học</dt><dd>{{ d.attributes.schools }}</dd>
            <dt>Toà văn phòng</dt><dd>{{ d.attributes.offices }}</dd>
            <dt>Metro gần nhất</dt><dd>{{ d.attributes.nearestMetro ? d.attributes.nearestMetro.line + ' · ' + d.attributes.nearestMetro.station + ' (' + d.attributes.nearestMetro.distanceM + ' m)' : 'Chưa có' }}</dd>
            <dt>Vùng phát triển</dt><dd>{{ d.attributes.developmentZone ? 'Có' : 'Không' }}</dd>
          </dl>
        </section>

        <section class="bc-card">
          <div class="bc-card__head"><h2>Tài chính ước tính</h2><span class="bc-eyebrow">18 tháng</span></div>
          <div class="lo-kpis">
            <div><span class="bc-eyebrow">Doanh thu</span><b>{{ d.revenuePotentialMillions | money }}</b></div>
            <div><span class="bc-eyebrow">Chi phí</span><b>{{ d.monthlyCostMillions | money }}</b></div>
            <div><span class="bc-eyebrow">Biên LN</span><b>{{ d.netMarginPct }}%</b></div>
            <div><span class="bc-eyebrow">Hoà vốn</span><b>{{ d.breakEvenMonth ? 'T' + d.breakEvenMonth : '>18' }}</b></div>
          </div>
          <bc-revenue-chart [series]="d.revenueSeries" [breakEven]="d.breakEvenMonth" />
        </section>

        <section class="bc-card">
          <div class="bc-card__head"><h2>Lưu lượng khách</h2><span class="bc-eyebrow">Cao điểm {{ d.footTraffic.peak.day }} {{ d.footTraffic.peak.from }}</span></div>
          <bc-traffic-heat [grid]="d.footTraffic.grid" [days]="d.footTraffic.days" [hours]="d.footTraffic.hours" />
        </section>

        <section class="bc-card">
          <div class="bc-card__head"><h2>Đối thủ</h2><span class="bc-eyebrow">{{ d.competitors.total }} · <span [class]="'bc-level--' + d.competitionLabel">{{ d.competitionLabel | level }}</span></span></div>
          <table class="bc-table">
            <thead><tr><th>Loại</th><th>Số lượng</th><th>Tiếp cận</th></tr></thead>
            <tbody>@for (s of d.competitors.subtypes; track s.key) { <tr><td>{{ s.label }}</td><td>{{ s.count }}</td><td>{{ s.reachK }}k</td></tr> }</tbody>
          </table>
          <p class="lo-gap"><b>Khoảng trống thị trường:</b> {{ d.competitorGap }}</p>
        </section>

        <section class="bc-card">
          <div class="bc-card__head"><h2>Rủi ro</h2></div>
          <ul class="lo-list">@for (r of d.risks; track r.text) { <li><span class="bc-pill" [class.bc-pill--bad]="r.severity === 'High'" [class.bc-pill--warn]="r.severity === 'Medium'" [class.bc-pill--good]="r.severity === 'Low'">{{ r.severity | level }}</span> {{ r.text }}</li> }</ul>
          <div class="bc-card__head" style="margin-top: 16px"><h2>Cơ hội tăng trưởng</h2></div>
          <ul class="lo-list">@for (g of d.growthOpportunities; track g.text) { <li><span class="bc-pill bc-pill--good">{{ g.timing === 'Now' ? 'Ngay' : g.timing }}</span> {{ g.text }}</li> }</ul>
        </section>

        <section class="bc-card">
          <div class="bc-card__head"><h2>Khách hàng mục tiêu</h2></div>
          <div class="lo-bars">@for (c of d.targetCustomers; track c.key) { <span>{{ c.label }}</span><bc-bar [value]="c.pct" color="var(--bc-accent)" /><b>{{ c.pct }}%</b> }</div>
        </section>
      </div>
      <p class="bc-note"><ls-icon name="info" [size]="13" /> {{ d.note }}</p>
    } @else if (error()) {
      <div class="bc-card bc-state bc-state--error" role="alert"><ls-icon name="alert" [size]="22" /><p>{{ error() }}</p></div>
    } @else {
      <div class="bc-skel" style="height: 120px"></div>
      <div class="bc-skel" style="height: 420px; margin-top: 14px"></div>
    }
  `,
  styles: [
    `
      :host{display:block}
      .lo-back{margin-bottom:12px}
      .lo-head{display:flex;align-items:center;gap:18px;flex-wrap:wrap;margin-bottom:14px}
      .lo-head>div:nth-child(2){flex:1;min-width:220px}
      .lo-head h1{font-size:28px;font-weight:800;margin-top:4px}
      .lo-head h1 small{font-size:15px;color:var(--bc-faint)}
      .lo-head p:last-child{color:var(--bc-faint);font-size:13px}
      .lo-actions{display:flex;gap:8px;flex-wrap:wrap}
      .lo-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(340px,1fr));gap:14px}
      .lo-bars{display:grid;grid-template-columns:minmax(110px,auto) 1fr 32px;align-items:center;gap:9px 12px;font-size:13px}
      .lo-bars b{text-align:right;font-variant-numeric:tabular-nums}
      .lo-bars span{color:var(--bc-dim)}
      .lo-why h2{display:flex;align-items:center;gap:6px}
      .lo-summary{font-weight:600}
      .lo-why ul{margin:10px 0;padding-left:18px;color:var(--bc-dim);display:grid;gap:4px;font-size:13px}
      .lo-reco{padding:9px 11px;border-radius:10px;background:var(--bc-accent-bg);color:var(--bc-accent-ink);font-size:13px}
      .lo-facts{display:grid;grid-template-columns:auto 1fr;gap:7px 16px;margin:0;font-size:13px}
      .lo-facts dt{color:var(--bc-faint)}
      .lo-facts dd{margin:0;text-align:right;font-weight:600}
      .lo-kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:10px}
      .lo-kpis b{display:block;font-size:18px}
      .lo-gap{margin-top:12px;padding:9px 11px;border-radius:10px;background:var(--bc-good-bg);color:var(--bc-good);font-size:12.5px}
      .lo-list{list-style:none;margin:0;padding:0;display:grid;gap:8px;font-size:13px}
    `,
  ],
})
export class BcLocationComponent {
  private readonly api = inject(BcApiService);
  private readonly state = inject(BcStateService);
  private readonly router = inject(Router);

  private readonly route = inject(ActivatedRoute);
  protected readonly d = signal<LocationDetail | null>(null);
  protected readonly ai = signal<CopilotAnswer | null>(null);
  protected readonly error = signal<string | null>(null);

  protected readonly breakdown = computed(() => {
    const d = this.d();
    if (!d) return [];
    const office = Math.min(100, Math.round((d.attributes.officeWorkersK / 62) * 100));
    const pop = Math.min(100, Math.round((d.attributes.population / 380_000) * 100));
    return [
      { label: 'Nhu cầu', value: d.scores.demand },
      { label: 'Cạnh tranh (cao = ít)', value: d.scores.competition },
      { label: 'Giá thuê', value: d.scores.rent },
      { label: 'Lưu lượng khách', value: d.scores.traffic },
      { label: 'Tiếp cận metro', value: d.scores.accessibility },
      { label: 'Mật độ văn phòng', value: office },
      { label: 'Dân số', value: pop },
      { label: 'Chi tiêu khách hàng', value: d.attributes.incomeIndex },
      { label: 'Tiềm năng tăng trưởng', value: d.scores.growth },
      { label: 'Phù hợp ngân sách', value: d.scores.budgetFit },
    ];
  });

  constructor() {
    this.route.paramMap
      .pipe(
        map((p) => p.get('slug') ?? ''),
        tap(() => {
          this.d.set(null);
          this.ai.set(null);
          this.error.set(null);
        }),
        switchMap((slug) =>
          this.api.location(slug, this.state.category(), this.state.budgetVnd()).pipe(
            tap((d) => {
              this.d.set(d);
              this.state.set({ selected: d.slug });
            }),
            switchMap((d) => this.api.ask(`Phân tích ${d.name} cho ${d.category.nameVi.toLowerCase()}`, { category: this.state.category(), budgetVnd: this.state.budgetVnd(), location: d.slug })),
            catchError((e: unknown) => {
              if (!this.d()) this.error.set(describeError(e));
              return EMPTY;
            }),
          ),
        ),
        takeUntilDestroyed(),
      )
      .subscribe((a) => this.ai.set(a));
  }

  protected toCompare(slug: string): void {
    const list = this.state.compare().filter((s) => s !== slug);
    this.state.set({ compare: [slug, ...list].slice(0, 3) });
    void this.router.navigate(['/business-copilot/compare']);
  }

  protected toReport(slug: string): void {
    void this.router.navigate(['/business-copilot/reports'], { queryParams: { location: slug, generate: 1 } });
  }
}
