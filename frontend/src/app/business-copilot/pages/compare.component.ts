import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { EMPTY, catchError, switchMap, tap } from 'rxjs';
import { IconComponent } from '../../living-score/components/icon/icon.component';
import { CompareResult } from '../bc.models';
import { BcApiService, BcStateService, describeError } from '../bc.service';
import { BC_CHARTS, RadarSeries, SERIES_COLORS } from '../shared/bc-charts';
import { CATEGORY_OPTIONS, LEVEL_VI } from '../shared/bc-format';

const ALL = [
  ['cau-giay', 'Cầu Giấy'], ['ha-dong', 'Hà Đông'], ['tay-ho', 'Tây Hồ'], ['hoan-kiem', 'Hoàn Kiếm'], ['dong-da', 'Đống Đa'],
  ['thanh-xuan', 'Thanh Xuân'], ['hai-ba-trung', 'Hai Bà Trưng'], ['gia-lam', 'Gia Lâm'], ['long-bien', 'Long Biên'], ['nam-tu-liem', 'Nam Từ Liêm'],
] as const;

@Component({
  selector: 'bc-compare',
  standalone: true,
  imports: [IconComponent, RouterLink, ...BC_CHARTS],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="pg-head">
      <div>
        <p class="bc-eyebrow bc-eyebrow--accent">Compare Locations</p>
        <h1>So sánh khu vực · {{ categoryLabel() }}</h1>
        <p>Chọn 2–3 khu vực. Giá trị tốt nhất mỗi dòng được tô xanh.</p>
      </div>
      <label class="bc-field">Loại hình
        <select (change)="setCategory($any($event.target).value)">
          @for (c of categories; track c.key) { <option [value]="c.key" [selected]="c.key === state.category()">{{ c.label }}</option> }
        </select>
      </label>
    </header>

    <div class="cp-pick" role="group" aria-label="Chọn khu vực">
      @for (l of all; track l[0]) {
        <button type="button" class="bc-chip" [class.is-on]="state.compare().includes(l[0])" [attr.aria-pressed]="state.compare().includes(l[0])" (click)="toggle(l[0])">
          @if (state.compare().includes(l[0])) { <span class="bc-dot" [style.color]="colorOf(l[0])"></span> }
          {{ l[1] }}
        </button>
      }
    </div>
    @if (hint()) { <p class="cp-hint">{{ hint() }}</p> }

    @if (result(); as r) {

      <div class="cp-scores">
        @for (l of r.locations; track l.slug; let i = $index) {
          <a class="bc-card cp-score" [routerLink]="['/business-copilot/location', l.slug]" [style.border-top-color]="colors[i]">
            <bc-ring [score]="l.businessScore" [size]="72" />
            <div><b>{{ l.name }}</b>@if (l.slug === r.winner) { <span class="bc-pill bc-pill--good">Điểm cao nhất</span> }</div>
          </a>
        }
      </div>
      <div class="cp-grid">
        <section class="bc-card">
          <div class="bc-card__head"><h2>Biểu đồ radar</h2></div>
          <bc-radar [axes]="axes" [series]="radar()" />
          <ul class="cp-legend">@for (s of radar(); track s.name) { <li><i [style.background]="s.color"></i>{{ s.name }}</li> }</ul>
        </section>
        <section class="bc-card">
          <div class="bc-card__head"><h2>Bảng so sánh</h2><span class="bc-eyebrow">Demo / ước tính</span></div>
          <div class="bc-scroll">
            <table class="bc-table">
              <thead><tr><th>Chỉ số</th>@for (l of r.locations; track l.slug) { <th>{{ l.name }}</th> }</tr></thead>
              <tbody>
                @for (m of r.metrics; track m.key) {
                  <tr><th scope="row">{{ m.label }}</th>@for (l of r.locations; track l.slug) { <td [class.is-best]="m.best.includes(l.slug)">{{ fmt(m.key, m.values[l.slug]) }}</td> }</tr>
                }
              </tbody>
            </table>
          </div>
          <p class="cp-summary"><ls-icon name="sparkles" [size]="14" /> {{ r.summary }}</p>
          <button type="button" class="bc-btn bc-btn--ai bc-btn--sm" (click)="askAi(r)">Hỏi AI về so sánh này</button>
        </section>
      </div>
    } @else if (error()) {
      <div class="bc-card bc-state bc-state--error" role="alert">{{ error() }}</div>
    } @else {
      <div class="bc-skel" style="height: 360px"></div>
    }
  `,
  styles: [
    `
      :host{display:block}
      .cp-pick{display:flex;flex-wrap:wrap;gap:8px;margin:14px 0 6px}
      .cp-hint{font-size:12px;color:var(--bc-warn)}
      .cp-scores{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px;margin:12px 0}
      .cp-score{display:flex;align-items:center;gap:14px;border-top:4px solid}
      .cp-score b{display:block;font-size:17px;margin-bottom:4px}
      .cp-grid{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.3fr);gap:14px;align-items:start}
      .cp-legend{list-style:none;margin:8px 0 0;padding:0;display:flex;justify-content:center;gap:14px;font-size:13px;font-weight:600}
      .cp-legend i{display:inline-block;width:11px;height:11px;border-radius:3px;margin-right:6px;vertical-align:-1px}
      .cp-summary{display:flex;gap:7px;margin:12px 0;padding:10px 12px;border-radius:10px;background:var(--bc-accent-bg);color:var(--bc-accent-ink);font-size:13px}
      @media (max-width:1000px){.cp-grid{grid-template-columns:1fr}}
    `,
  ],
})
export class BcCompareComponent {
  private readonly api = inject(BcApiService);
  protected readonly state = inject(BcStateService);
  protected readonly all = ALL;
  protected readonly categories = CATEGORY_OPTIONS;
  protected readonly colors = SERIES_COLORS;
  protected readonly axes = ['Nhu cầu', 'Cạnh tranh', 'Giá thuê', 'Lưu lượng', 'Tiếp cận', 'Tăng trưởng'];
  protected readonly result = signal<CompareResult | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly hint = signal('');
  protected readonly categoryLabel = computed(() => CATEGORY_OPTIONS.find((c) => c.key === this.state.category())?.label ?? '');

  protected readonly radar = computed<RadarSeries[]>(() =>
    (this.result()?.locations ?? []).map((l, i) => ({
      name: l.name,
      color: SERIES_COLORS[i],
      values: [l.scores.demand, l.scores.competition, l.scores.rent, l.scores.traffic, l.scores.accessibility, l.scores.growth],
    })),
  );

  constructor() {
    toObservable(computed(() => ({ slugs: this.state.compare(), cat: this.state.category(), budget: this.state.budgetVnd() })))
      .pipe(
        tap(() => this.error.set(null)),
        switchMap(({ slugs, cat, budget }) =>
          slugs.length >= 2
            ? this.api.compare(slugs, cat, budget).pipe(
                catchError((e: unknown) => {
                  this.error.set(describeError(e));
                  return EMPTY;
                }),
              )
            : EMPTY,
        ),
        takeUntilDestroyed(),
      )
      .subscribe((r) => this.result.set(r));
  }

  protected colorOf(slug: string): string {
    return SERIES_COLORS[this.state.compare().indexOf(slug)] ?? 'currentColor';
  }

  protected toggle(slug: string): void {
    const ok = this.state.toggleCompare(slug);
    this.hint.set(ok ? '' : 'Cần ít nhất 2 khu vực để so sánh.');
  }

  protected setCategory(key: string): void {
    this.state.set({ category: key as never });
  }

  protected fmt(key: string, v: number | string | null): string {
    if (v === null || v === undefined) return '—';
    if (key === 'investment') return LEVEL_VI[v as 'Low'] ?? String(v);
    if (key === 'breakEven') return `Tháng ${v}`;
    return String(v);
  }

  protected askAi(r: CompareResult): void {
    this.state.askCopilot(`So sánh ${r.locations.map((l) => l.name).join(' và ')}`);
  }
}
