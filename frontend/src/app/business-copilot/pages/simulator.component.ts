import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { IconComponent } from '../../living-score/components/icon/icon.component';
import { CategoryKey, SimulationResult } from '../bc.models';
import { BcApiService, BcStateService, describeError } from '../bc.service';
import { CATEGORY_OPTIONS, LevelPipe, MoneyPipe } from '../shared/bc-format';

const DISTRICTS = [
  ['cau-giay', 'Cầu Giấy'], ['ha-dong', 'Hà Đông'], ['tay-ho', 'Tây Hồ'], ['hoan-kiem', 'Hoàn Kiếm'], ['dong-da', 'Đống Đa'],
  ['thanh-xuan', 'Thanh Xuân'], ['hai-ba-trung', 'Hai Bà Trưng'], ['gia-lam', 'Gia Lâm'], ['long-bien', 'Long Biên'], ['nam-tu-liem', 'Nam Từ Liêm'],
] as const;
const CUSTOMERS = [
  ['office', 'Nhân viên văn phòng'],
  ['students', 'Sinh viên'],
  ['residents', 'Cư dân'],
  ['visitors', 'Khách vãng lai'],
] as const;

@Component({
  selector: 'bc-simulator',
  standalone: true,
  imports: [ReactiveFormsModule, IconComponent, RouterLink, MoneyPipe, LevelPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="pg-head">
      <div>
        <p class="bc-eyebrow bc-eyebrow--accent">Business Simulator</p>
        <h1>Mô phỏng kinh doanh của bạn</h1>
        <p>Nhập giả định của bạn — hệ thống áp lên từng khu vực. <b>Mọi con số là ước tính mô phỏng từ dữ liệu demo.</b></p>
      </div>
    </header>

    <div class="sm">
      <form class="bc-card sm-form" [formGroup]="form" (ngSubmit)="run()">
        <label class="bc-field">Loại hình kinh doanh
          <select formControlName="category">@for (c of categories; track c.key) { <option [value]="c.key">{{ c.label }}</option> }</select>
        </label>
        <label class="bc-field">Vốn đầu tư (triệu VND)
          <input type="number" formControlName="budgetMillions" min="50" max="50000" step="50" />
          @if (form.controls.budgetMillions.invalid) { <small class="err">Từ 50 đến 50.000 triệu</small> }
        </label>
        <label class="bc-field">Doanh thu kỳ vọng/tháng (triệu, tuỳ chọn)
          <input type="number" formControlName="expectedRevenueMillions" min="0" step="10" placeholder="Để trống = dùng ước tính" />
        </label>
        <label class="bc-field">Tiền thuê tối đa/tháng (triệu, tuỳ chọn)
          <input type="number" formControlName="maxRentMillions" min="0" step="5" placeholder="Không giới hạn" />
        </label>
        <label class="bc-field">Diện tích (m²)
          <input type="number" formControlName="sizeM2" min="15" max="2000" step="5" />
          <small>Mặc định theo loại hình</small>
        </label>
        <fieldset class="sm-set">
          <legend>Khách hàng mục tiêu</legend>
          @for (c of customers; track c[0]) {
            <button type="button" class="bc-chip" [class.is-on]="targets().includes(c[0])" (click)="toggle(targets, c[0])">{{ c[1] }}</button>
          }
        </fieldset>
        <fieldset class="sm-set">
          <legend>Quận ưu tiên <small>(trống = tất cả)</small></legend>
          @for (d of districts; track d[0]) {
            <button type="button" class="bc-chip" [class.is-on]="picked().includes(d[0])" (click)="toggle(picked, d[0])">{{ d[1] }}</button>
          }
        </fieldset>
        <button type="submit" class="bc-btn bc-btn--primary" [disabled]="form.invalid || busy()">
          @if (busy()) { <span class="bc-spinner"></span> } Chạy mô phỏng
        </button>
      </form>

      <div class="sm-out">
        @if (error()) {
          <div class="bc-card bc-state bc-state--error" role="alert">{{ error() }}</div>
        }
        @if (result(); as r) {
          @if (r.summary; as s) {
            <section class="bc-card sm-sum">
              <div><p class="bc-eyebrow">Khu vực đề xuất</p><b>{{ names(s.recommended) }}</b></div>
              <div><p class="bc-eyebrow">Chi phí/tháng</p><b>{{ s.monthlyCostMillions | money }}</b></div>
              <div><p class="bc-eyebrow">Doanh thu/tháng</p><b>{{ s.monthlyRevenueMillions | money }}</b></div>
              <div><p class="bc-eyebrow">Lợi nhuận/tháng</p><b [class.neg]="s.monthlyProfitMillions < 0">{{ s.monthlyProfitMillions | money }}</b></div>
              <div><p class="bc-eyebrow">Hoà vốn</p><b>{{ s.breakEvenMonth ? 'Tháng ' + s.breakEvenMonth : '> 36 tháng' }}</b></div>
              <div><p class="bc-eyebrow">Rủi ro</p><b [class]="'bc-level--' + s.riskLevel">{{ s.riskLevel | level }}</b></div>
            </section>
          } @else {
            <div class="bc-card bc-state">Không có khu vực nào khớp — nới tiền thuê tối đa hoặc chọn thêm quận.</div>
          }
          <section class="bc-card">
            <div class="bc-card__head"><h2>Kết quả theo khu vực</h2><span class="bc-eyebrow">Mô phỏng · ước tính</span></div>
            <div class="bc-scroll">
              <table class="bc-table">
                <thead><tr><th>Khu vực</th><th>Điểm</th><th>Thuê</th><th>Doanh thu</th><th>Chi phí</th><th>Lợi nhuận</th><th>Vốn ban đầu</th><th>Hoà vốn</th><th>Rủi ro</th></tr></thead>
                <tbody>
                  @for (row of r.results; track row.slug) {
                    <tr>
                      <td><a [routerLink]="['/business-copilot/location', row.slug]">{{ row.name }}</a>@if (!row.withinBudget) { <span class="bc-pill bc-pill--bad">vượt vốn</span> }</td>
                      <td>{{ row.businessScore }}</td>
                      <td>{{ row.rentMillions | money }}</td>
                      <td>{{ row.revenueMillions | money }}</td>
                      <td>{{ row.costMillions | money }}</td>
                      <td [class.neg]="row.profitMillions < 0" [class.is-best]="row.profitMillions > 0">{{ row.profitMillions | money }}</td>
                      <td>{{ row.initialInvestmentMillions | money }}</td>
                      <td>{{ row.breakEvenMonth ? 'T' + row.breakEvenMonth : '>36' }}</td>
                      <td [class]="'bc-level--' + row.riskLevel">{{ row.riskLevel | level }}</td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
            @if (r.excluded.length) {
              <p class="sm-excl">Loại do vượt tiền thuê tối đa: {{ excludedText(r) }}</p>
            }
          </section>
        } @else {
          <div class="bc-card bc-state"><ls-icon name="sliders" [size]="24" /><p>Điền giả định bên trái rồi bấm “Chạy mô phỏng”.</p></div>
        }
      </div>
    </div>
  `,
  styles: [
    `
      :host{display:block}
      .sm{display:grid;grid-template-columns:340px minmax(0,1fr);gap:14px;align-items:start;margin-top:12px}
      .sm-form{display:grid;gap:12px}
      .sm-set{border:0;padding:0;margin:0;display:flex;flex-wrap:wrap;gap:6px}
      .sm-set legend{font-size:12.5px;font-weight:700;color:var(--bc-dim);margin-bottom:6px}
      .sm-set legend small{font-weight:500;color:var(--bc-faint)}
      .err{color:var(--bc-bad)!important}
      .sm-out{display:grid;gap:14px;min-width:0}
      .sm-sum{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:12px}
      .sm-sum b{display:block;font-size:18px;margin-top:2px}
      .neg{color:var(--bc-bad)!important}
      .sm-excl{margin-top:10px;font-size:12px;color:var(--bc-faint)}
      @media (max-width:980px){.sm{grid-template-columns:1fr}}
    `,
  ],
})
export class BcSimulatorComponent {
  private readonly api = inject(BcApiService);
  private readonly state = inject(BcStateService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly fb = inject(NonNullableFormBuilder);

  protected readonly categories = CATEGORY_OPTIONS;
  protected readonly districts = DISTRICTS;
  protected readonly customers = CUSTOMERS;
  protected readonly targets = signal<string[]>(['office']);
  protected readonly picked = signal<string[]>([]);
  protected readonly result = signal<SimulationResult | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly busy = signal(false);

  protected readonly form = this.fb.group({
    category: this.fb.control<CategoryKey>(this.state.category()),
    budgetMillions: this.fb.control(this.state.budgetMillions(), [Validators.required, Validators.min(50), Validators.max(50_000)]),
    expectedRevenueMillions: this.fb.control<number | null>(null as unknown as number),
    maxRentMillions: this.fb.control<number | null>(null as unknown as number),
    sizeM2: this.fb.control(61, [Validators.min(15), Validators.max(2000)]),
  });

  constructor() {
    this.form.controls.category.valueChanges.pipe(takeUntilDestroyed()).subscribe((key) => {
      const sizes: Record<CategoryKey, number> = { 'coffee-shop': 61, restaurant: 110, 'retail-store': 80, gym: 260, pharmacy: 40, 'convenience-store': 60 };
      this.form.controls.sizeM2.setValue(sizes[key]);
    });
    this.run();
  }

  protected toggle(list: typeof this.targets, key: string): void {
    list.update((v) => (v.includes(key) ? v.filter((x) => x !== key) : [...v, key]));
  }

  protected names(slugs: string[]): string {
    return slugs.map((s) => DISTRICTS.find((d) => d[0] === s)?.[1] ?? s).join(', ');
  }

  protected excludedText(r: SimulationResult): string {
    return r.excluded.map((e) => `${e.name} (${Math.round(e.rentMillions)}tr)`).join(', ');
  }

  protected run(): void {
    if (this.form.invalid) return;
    const v = this.form.getRawValue();
    this.busy.set(true);
    this.error.set(null);
    this.state.set({ category: v.category, budgetVnd: v.budgetMillions * 1_000_000 });
    this.api
      .simulate({
        category: v.category,
        budgetVnd: Math.round(v.budgetMillions * 1_000_000),
        sizeM2: v.sizeM2 || undefined,
        expectedRevenueVnd: v.expectedRevenueMillions ? Math.round(v.expectedRevenueMillions * 1_000_000) : undefined,
        maxRentVnd: v.maxRentMillions ? Math.round(v.maxRentMillions * 1_000_000) : undefined,
        targetCustomers: this.targets(),
        districts: this.picked().length ? this.picked() : undefined,
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (r) => {
          this.result.set(r);
          this.busy.set(false);
        },
        error: (e: unknown) => {
          this.error.set(describeError(e));
          this.busy.set(false);
        },
      });
  }
}
