import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { IconComponent } from '../../living-score/components/icon/icon.component';
import { Report } from '../bc.models';
import { BcApiService, BcStateService, describeError } from '../bc.service';
import { BC_CHARTS } from '../shared/bc-charts';
import { LevelPipe, MoneyPipe } from '../shared/bc-format';
import { BcCopilotChatComponent } from '../shared/bc-copilot-chat.component';
import { BcFiltersComponent } from './market.component';

const STORE = 'hbc.reports';

interface SavedReport {
  id: string;
  title: string;
  business: string;
  location: string;
  score: number;
  budgetMillions: number;
  generatedAt: string;
  category: string;
  slug: string;
}

function loadSaved(): SavedReport[] {
  try {
    return JSON.parse(localStorage.getItem(STORE) ?? '[]') as SavedReport[];
  } catch {
    return [];
  }
}

@Component({
  selector: 'bc-reports',
  standalone: true,
  imports: [IconComponent, RouterLink, DatePipe, MoneyPipe, LevelPipe, BcFiltersComponent, ...BC_CHARTS],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="pg-head no-print">
      <div>
        <p class="bc-eyebrow bc-eyebrow--accent">Reports</p>
        <h1>Báo cáo cơ hội kinh doanh</h1>
        <p>Tạo báo cáo cho ý tưởng hiện tại. Xuất PDF bằng hộp thoại in của trình duyệt.</p>
      </div>
      <div class="rp-actions">
        <bc-filters />
        <button type="button" class="bc-btn bc-btn--dark" (click)="generate()" [disabled]="busy()">
          @if (busy()) { <span class="bc-spinner"></span> } <ls-icon name="file" [size]="15" /> Tạo báo cáo
        </button>
      </div>
    </header>

    @if (error(); as e) {
      <div class="bc-card bc-state bc-state--error" role="alert">{{ e }}</div>
    }

    @if (report(); as r) {
      <article class="bc-card rp" aria-label="Báo cáo">
        <header class="rp-head">
          <div>
            <p class="bc-eyebrow bc-eyebrow--accent">{{ r.title }}</p>
            <h1>{{ r.business.nameVi }} tại {{ r.recommendedLocation.name }}</h1>
            <p>{{ r.recommendedLocation.cluster }} · tạo lúc {{ r.generatedAt | date: 'HH:mm dd/MM/yyyy' }} · {{ r.provider === 'mock' ? 'Mock AI' : 'AI' }}</p>
          </div>
          <bc-ring [score]="r.businessScore" [size]="84" />
        </header>
        <dl class="rp-meta">
          <div><dt>Loại hình</dt><dd>{{ r.business.nameVi }}</dd></div>
          <div><dt>Ngân sách</dt><dd>{{ r.budgetMillions | money }}</dd></div>
          <div><dt>Khu vực đề xuất</dt><dd>{{ r.recommendedLocation.name }}</dd></div>
          <div><dt>Business Score</dt><dd>{{ r.businessScore }}/100</dd></div>
        </dl>

        <section><h2>1. Tóm tắt điều hành</h2><p>{{ r.sections.executiveSummary.summary }}</p><p class="rp-reco">{{ r.sections.executiveSummary.recommendation }}</p></section>

        <section>
          <h2>2. Nhu cầu thị trường</h2>
          <p>Điểm nhu cầu {{ r.sections.marketDemand.demandScore }}/100, lưu lượng {{ r.sections.marketDemand.trafficScore }}/100, mật độ khách {{ r.sections.marketDemand.customerDensityKPerKm2 }}k/km². Cao điểm {{ r.sections.marketDemand.peak.day }} {{ r.sections.marketDemand.peak.from }}–{{ r.sections.marketDemand.peak.to }}; cuối tuần {{ r.sections.marketDemand.weekendChangePct }}% so với ngày thường.</p>
          <ul>@for (e of r.sections.marketDemand.evidence; track e) { <li>{{ e }}</li> }</ul>
        </section>

        <section>
          <h2>3. Cạnh tranh</h2>
          <p>{{ r.sections.competition.total }} đối thủ trong bán kính 500 m — mức {{ r.sections.competition.label | level }} (điểm {{ r.sections.competition.score }}/100).</p>
          <table class="bc-table"><thead><tr><th>Nhóm</th><th>Số lượng</th><th>Tiếp cận</th></tr></thead>
            <tbody>@for (s of r.sections.competition.subtypes; track s.key) { <tr><td>{{ s.label }}</td><td>{{ s.count }}</td><td>{{ s.reachK }}k</td></tr> }</tbody></table>
          <p class="rp-gap">Khoảng trống: {{ r.sections.competition.gap }}</p>
        </section>

        <section>
          <h2>4. Chi phí ước tính</h2>
          <div class="rp-two">
            <table class="bc-table"><thead><tr><th>Chi phí hằng tháng</th><th>tr ₫</th></tr></thead>
              <tbody>
                @for (c of r.sections.estimatedCosts.monthlyCosts.items; track c.key) { <tr><td>{{ c.label }}</td><td>{{ c.millions }}</td></tr> }
                <tr class="rp-total"><td>Tổng</td><td>{{ r.sections.estimatedCosts.monthlyCosts.totalMillions }}</td></tr>
              </tbody></table>
            <table class="bc-table"><thead><tr><th>Vốn ban đầu</th><th>tr ₫</th></tr></thead>
              <tbody>
                <tr><td>Thi công</td><td>{{ r.sections.estimatedCosts.initialInvestment.fitOutMillions }}</td></tr>
                <tr><td>Thiết bị</td><td>{{ r.sections.estimatedCosts.initialInvestment.equipmentMillions }}</td></tr>
                <tr><td>Đặt cọc</td><td>{{ r.sections.estimatedCosts.initialInvestment.depositMillions }}</td></tr>
                <tr><td>Vốn lưu động</td><td>{{ r.sections.estimatedCosts.initialInvestment.workingCapitalMillions }}</td></tr>
                <tr class="rp-total"><td>Tổng</td><td>{{ r.sections.estimatedCosts.initialInvestment.totalMillions }}</td></tr>
              </tbody></table>
          </div>
          <p>Doanh thu ổn định ~{{ r.sections.estimatedCosts.revenuePotentialMillions | money }}/tháng, biên lợi nhuận {{ r.sections.estimatedCosts.netMarginPct }}%, hoà vốn {{ r.sections.estimatedCosts.breakEvenMonth ? 'tháng ' + r.sections.estimatedCosts.breakEvenMonth : 'sau 18 tháng' }}.</p>
        </section>

        <section>
          <h2>5. Chân dung khách hàng</h2>
          <div class="rp-bars">@for (c of r.sections.customerProfile; track c.key) { <span>{{ c.label }}</span><bc-bar [value]="c.pct" color="var(--bc-accent)" /><b>{{ c.pct }}%</b> }</div>
        </section>

        <section>
          <h2>6. Phân tích vị trí</h2>
          <div class="rp-bars">
            <span>Nhu cầu</span><bc-bar [value]="r.sections.locationAnalysis.scores.demand" /><b>{{ r.sections.locationAnalysis.scores.demand }}</b>
            <span>Cạnh tranh</span><bc-bar [value]="r.sections.locationAnalysis.scores.competition" /><b>{{ r.sections.locationAnalysis.scores.competition }}</b>
            <span>Giá thuê</span><bc-bar [value]="r.sections.locationAnalysis.scores.rent" /><b>{{ r.sections.locationAnalysis.scores.rent }}</b>
            <span>Lưu lượng</span><bc-bar [value]="r.sections.locationAnalysis.scores.traffic" /><b>{{ r.sections.locationAnalysis.scores.traffic }}</b>
            <span>Tiếp cận</span><bc-bar [value]="r.sections.locationAnalysis.scores.accessibility" /><b>{{ r.sections.locationAnalysis.scores.accessibility }}</b>
          </div>
          <p>Phương án thay thế: @for (a of r.sections.locationAnalysis.alternatives; track a.slug; let last = $last) { {{ a.name }} ({{ a.businessScore }}){{ last ? '' : ', ' }} }</p>
        </section>

        <section>
          <h2>7. Tiềm năng tăng trưởng</h2>
          <p>Điểm tăng trưởng {{ r.sections.growthPotential.growthScore }}/100.</p>
          <ul>@for (g of r.sections.growthPotential.opportunities; track g.text) { <li>{{ g.text }} ({{ g.timing === 'Now' ? 'ngay' : g.timing }})</li> }</ul>
        </section>

        <section>
          <h2>8. Rủi ro</h2>
          <ul>@for (x of r.sections.risks; track x.text) { <li>{{ x.text }} — <b [class]="'bc-level--' + x.severity">{{ x.severity | level }}</b></li> }</ul>
        </section>

        <section>
          <h2>9. Khuyến nghị của AI</h2>
          <p class="rp-reco">{{ r.sections.aiRecommendation.recommendation }}</p>
          <ol>@for (n of r.sections.aiRecommendation.nextActions; track n) { <li>{{ n }}</li> }</ol>
        </section>

        <footer class="rp-foot">{{ r.note }}</footer>
        <div class="rp-bottom no-print">
          <button type="button" class="bc-btn bc-btn--primary" (click)="print()"><ls-icon name="download" [size]="15" /> Xuất báo cáo (PDF)</button>
          <a class="bc-btn" [routerLink]="['/business-copilot/location', r.recommendedLocation.slug]">Xem khu vực</a>
        </div>
      </article>
    } @else if (!busy()) {
      <div class="bc-card bc-state"><ls-icon name="file" [size]="26" /><p>Chưa có báo cáo. Chọn loại hình, ngân sách rồi bấm “Tạo báo cáo”.</p></div>
    } @else {
      <div class="bc-skel" style="height: 480px"></div>
    }

    @if (saved().length) {
      <section class="bc-card rp-saved no-print">
        <div class="bc-card__head"><h2>Báo cáo đã tạo</h2><span class="bc-eyebrow">Lưu trên trình duyệt</span></div>
        <ul>
          @for (s of saved(); track s.id) {
            <li>
              <button type="button" (click)="reopen(s)"><b>{{ s.business }} · {{ s.location }}</b><span>{{ s.score }}/100 · {{ s.budgetMillions | money }} · {{ s.generatedAt | date: 'dd/MM HH:mm' }}</span></button>
            </li>
          }
        </ul>
      </section>
    }
  `,
  styles: [
    `
      :host{display:block}
      .rp-actions{display:flex;align-items:flex-end;gap:10px;flex-wrap:wrap}
      .rp{margin-top:12px;padding:26px 30px;display:grid;gap:18px}
      .rp-head{display:flex;justify-content:space-between;gap:16px;align-items:center;padding-bottom:14px;border-bottom:2px solid var(--bc-ink)}
      .rp-head h1{font-size:24px;font-weight:800;margin-top:4px}
      .rp-head p:last-child{color:var(--bc-faint);font-size:12.5px}
      .rp-meta{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin:0}
      .rp-meta div{padding:10px 12px;border-radius:10px;background:var(--bc-surface-2)}
      .rp-meta dt{font:700 10px/1.3 var(--bc-mono);letter-spacing:.08em;text-transform:uppercase;color:var(--bc-faint)}
      .rp-meta dd{margin:2px 0 0;font-weight:800}
      .rp section h2{font-size:15px;font-weight:800;margin-bottom:6px}
      .rp section p,.rp section li{font-size:13.5px;color:var(--bc-dim)}
      .rp section ul,.rp section ol{margin:6px 0 0;padding-left:20px;display:grid;gap:3px}
      .rp-reco{margin-top:6px;padding:10px 12px;border-radius:10px;background:var(--bc-accent-bg);color:var(--bc-accent-ink)!important;font-weight:700}
      .rp-gap{margin-top:8px;color:var(--bc-good)!important}
      .rp-two{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:8px}
      .rp-total td{font-weight:800;color:var(--bc-ink)}
      .rp section>.bc-table{max-width:560px}
      .rp-bars{display:grid;grid-template-columns:minmax(120px,auto) 1fr 36px;gap:8px 12px;align-items:center;font-size:13px;max-width:560px}
      .rp-bars b{text-align:right}
      .rp-foot{padding-top:12px;border-top:1px solid var(--bc-line);font-size:11.5px;color:var(--bc-faint)}
      .rp-bottom{display:flex;gap:8px}
      .rp-saved{margin-top:14px}
      .rp-saved ul{list-style:none;margin:0;padding:0;display:grid;gap:6px}
      .rp-saved button{width:100%;display:flex;justify-content:space-between;gap:10px;padding:10px 12px;border:1px solid var(--bc-line);border-radius:10px;background:var(--bc-surface-2);text-align:left;font-size:13px}
      .rp-saved span{color:var(--bc-faint)}
      @media (max-width:760px){.rp{padding:18px}.rp-meta,.rp-two{grid-template-columns:1fr 1fr}}
      @media print{
        :host ::ng-deep .no-print{display:none!important}
        .rp{border:0;box-shadow:none;padding:0}
      }
    `,
  ],
})
export class BcReportsComponent {
  private readonly api = inject(BcApiService);
  private readonly state = inject(BcStateService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly route = inject(ActivatedRoute);

  protected readonly report = signal<Report | null>(null);
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly saved = signal<SavedReport[]>(loadSaved());
  private location: string | undefined;

  constructor() {
    const q = this.route.snapshot.queryParamMap;
    this.location = q.get('location') ?? undefined;
    if (q.get('generate')) this.generate();
  }

  protected generate(location = this.location): void {
    this.busy.set(true);
    this.error.set(null);
    this.api
      .report(this.state.category(), this.state.budgetVnd(), location)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (r) => {
          this.report.set(r);
          this.busy.set(false);
          this.location = undefined;
          this.remember(r);
        },
        error: (e: unknown) => {
          this.error.set(describeError(e));
          this.busy.set(false);
        },
      });
  }

  private remember(r: Report): void {
    const entry: SavedReport = {
      id: `${r.business.key}-${r.recommendedLocation.slug}-${r.budgetMillions}`,
      title: r.title,
      business: r.business.nameVi,
      location: r.recommendedLocation.name,
      score: r.businessScore,
      budgetMillions: r.budgetMillions,
      generatedAt: r.generatedAt,
      category: r.business.key,
      slug: r.recommendedLocation.slug,
    };
    const next = [entry, ...this.saved().filter((s) => s.id !== entry.id)].slice(0, 8);
    this.saved.set(next);
    try {
      localStorage.setItem(STORE, JSON.stringify(next));
    } catch {
      // storage blocked — list lives for this session only
    }
  }

  protected reopen(s: SavedReport): void {
    this.state.set({ category: s.category as never, budgetVnd: s.budgetMillions * 1_000_000 });
    this.generate(s.slug);
  }

  protected print(): void {
    window.print();
  }
}

@Component({
  selector: 'bc-copilot-page',
  standalone: true,
  imports: [BcCopilotChatComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<div class="bc-card cp-page"><bc-copilot-chat /></div>`,
  styles: [':host{display:block}.cp-page{padding:0;height:calc(100dvh - var(--site-nav-h, 0px) - var(--bc-topbar-h) - 58px);min-height:520px;display:flex;flex-direction:column;overflow:hidden;max-width:920px;margin:0 auto}'],
})
export class BcCopilotPageComponent {}
