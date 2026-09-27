import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { EMPTY, catchError, forkJoin, switchMap } from 'rxjs';
import { IconComponent } from '../../living-score/components/icon/icon.component';
import { CategoryKey, LocationDetail, LocationSummary } from '../bc.models';
import { BcApiService, BcStateService, describeError } from '../bc.service';
import { BC_CHARTS } from '../shared/bc-charts';
import { CATEGORY_OPTIONS, LevelPipe, MoneyPipe } from '../shared/bc-format';

type SortKey = 'businessScore' | 'demand' | 'competition' | 'rent' | 'traffic' | 'accessibility' | 'growth' | 'revenue' | 'breakEven';

const BUDGETS = [300, 500, 800, 1_000, 1_500, 2_000, 3_000];

/** Shared filter bar: business type + budget, stored in BcStateService. */
@Component({
  selector: 'bc-filters',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="fl">
      <label class="bc-field">Loại hình
        <select (change)="state.set({ category: $any($event.target).value })">
          @for (c of categories; track c.key) { <option [value]="c.key" [selected]="c.key === state.category()">{{ c.label }}</option> }
        </select>
      </label>
      <label class="bc-field">Ngân sách
        <select (change)="state.set({ budgetVnd: +$any($event.target).value * 1000000 })">
          @for (b of budgets(); track b) { <option [value]="b" [selected]="b === state.budgetMillions()">{{ b >= 1000 ? b / 1000 + ' tỷ' : b + ' triệu' }}</option> }
        </select>
      </label>
    </div>
  `,
  styles: [':host{display:block}.fl{display:flex;gap:10px;flex-wrap:wrap}.fl .bc-field{min-width:170px}'],
})
export class BcFiltersComponent {
  protected readonly state = inject(BcStateService);
  protected readonly categories = CATEGORY_OPTIONS;
  protected readonly budgets = computed(() => (BUDGETS.includes(this.state.budgetMillions()) ? BUDGETS : [...BUDGETS, this.state.budgetMillions()].sort((a, b) => a - b)));
}

@Component({
  selector: 'bc-market',
  standalone: true,
  imports: [IconComponent, BcFiltersComponent, MoneyPipe, LevelPipe, ...BC_CHARTS],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="pg-head">
      <div>
        <p class="bc-eyebrow bc-eyebrow--accent">Market Data</p>
        <h1>Dữ liệu thị trường theo khu vực</h1>
        <p>Bấm tiêu đề cột để sắp xếp · bấm một dòng để xem chi tiết. Dữ liệu demo / ước tính.</p>
      </div>
      <bc-filters />
    </header>
    <section class="bc-card" style="margin-top: 12px">
      @if (error(); as e) {
        <div class="bc-state bc-state--error" role="alert">{{ e }}</div>
      } @else if (rows().length === 0) {
        <div class="bc-skel" style="height: 380px"></div>
      } @else {
        <div class="bc-scroll">
          <table class="bc-table mk">
            <thead>
              <tr>
                <th>Khu vực</th>
                @for (c of columns; track c.key) {
                  <th><button type="button" class="mk-sort" (click)="sortBy(c.key)" [attr.aria-sort]="sort() === c.key ? (asc() ? 'ascending' : 'descending') : 'none'">{{ c.label }} {{ sort() === c.key ? (asc() ? '↑' : '↓') : '' }}</button></th>
                }
                <th>Cạnh tranh</th>
                <th>Đầu tư</th>
              </tr>
            </thead>
            <tbody>
              @for (r of rows(); track r.slug) {
                <tr (click)="open(r.slug)" tabindex="0" (keydown.enter)="open(r.slug)">
                  <td><b>{{ r.name }}</b><small>{{ r.cluster }}</small></td>
                  <td><span class="mk-score"><bc-bar [value]="r.businessScore" />{{ r.businessScore }}</span></td>
                  <td>{{ r.scores.demand }}</td>
                  <td>{{ r.scores.competition }}</td>
                  <td>{{ r.estRentMillions | money }}</td>
                  <td>{{ r.scores.traffic }}</td>
                  <td>{{ r.scores.accessibility }}</td>
                  <td>{{ r.scores.growth }}</td>
                  <td>{{ r.revenuePotentialMillions | money }}</td>
                  <td>{{ r.breakEvenMonth ? 'T' + r.breakEvenMonth : '>18' }}</td>
                  <td [class]="'bc-level--' + r.competitionLabel">{{ r.competitionLabel | level }}</td>
                  <td>{{ r.investmentLevel | level }}@if (!r.withinBudget) { <span class="bc-pill bc-pill--bad">vượt</span> }</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
    </section>
    <p class="bc-note"><ls-icon name="info" [size]="13" /> Số liệu minh hoạ cho MVP, không phải số liệu thị trường chính thức.</p>
  `,
  styles: [
    `
      :host{display:block}
      .mk tbody tr{cursor:pointer}
      .mk tbody tr:hover{background:var(--bc-surface-2)}
      .mk td small{display:block;font-size:11px;color:var(--bc-faint)}
      .mk-sort{border:0;background:none;padding:0;font:inherit;color:inherit;letter-spacing:inherit;text-transform:inherit;white-space:nowrap}
      .mk-score{display:grid;grid-template-columns:60px 24px;gap:8px;align-items:center;justify-content:end}
    `,
  ],
})
export class BcMarketComponent {
  private readonly api = inject(BcApiService);
  private readonly state = inject(BcStateService);
  private readonly router = inject(Router);
  private readonly data = signal<LocationSummary[]>([]);
  protected readonly error = signal<string | null>(null);
  protected readonly sort = signal<SortKey>('businessScore');
  protected readonly asc = signal(false);

  protected readonly columns: Array<{ key: SortKey; label: string }> = [
    { key: 'businessScore', label: 'Điểm' },
    { key: 'demand', label: 'Nhu cầu' },
    { key: 'competition', label: 'Cạnh tranh*' },
    { key: 'rent', label: 'Thuê/tháng' },
    { key: 'traffic', label: 'Lưu lượng' },
    { key: 'accessibility', label: 'Tiếp cận' },
    { key: 'growth', label: 'Tăng trưởng' },
    { key: 'revenue', label: 'Doanh thu' },
    { key: 'breakEven', label: 'Hoà vốn' },
  ];

  protected readonly rows = computed(() => {
    const pick = (r: LocationSummary): number => {
      switch (this.sort()) {
        case 'businessScore':
          return r.businessScore;
        case 'rent':
          return r.estRentMillions;
        case 'revenue':
          return r.revenuePotentialMillions;
        case 'breakEven':
          return r.breakEvenMonth ?? 99;
        default:
          return r.scores[this.sort() as 'demand'];
      }
    };
    const dir = this.asc() ? 1 : -1;
    return [...this.data()].sort((a, b) => (pick(a) - pick(b)) * dir);
  });

  constructor() {
    toObservable(computed(() => ({ c: this.state.category() as CategoryKey, b: this.state.budgetVnd() })))
      .pipe(
        switchMap(({ c, b }) =>
          this.api.recommendations(c, b).pipe(
            catchError((e: unknown) => {
              this.error.set(describeError(e));
              return EMPTY;
            }),
          ),
        ),
        takeUntilDestroyed(),
      )
      .subscribe((r) => {
        this.error.set(null);
        this.data.set(r.recommendations);
      });
  }

  protected sortBy(key: SortKey): void {
    if (this.sort() === key) this.asc.update((v) => !v);
    else {
      this.sort.set(key);
      this.asc.set(key === 'rent' || key === 'breakEven');
    }
  }

  protected open(slug: string): void {
    this.state.set({ selected: slug });
    void this.router.navigate(['/business-copilot/location', slug]);
  }
}

@Component({
  selector: 'bc-competitors',
  standalone: true,
  imports: [IconComponent, BcFiltersComponent, LevelPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="pg-head">
      <div>
        <p class="bc-eyebrow bc-eyebrow--accent">Competitors</p>
        <h1>Bức tranh cạnh tranh</h1>
        <p>Số đối thủ trong bán kính 500 m theo từng nhóm · dữ liệu demo.</p>
      </div>
      <bc-filters />
    </header>
    @if (error(); as e) {
      <div class="bc-card bc-state bc-state--error" role="alert">{{ e }}</div>
    } @else {
      <div class="ct">
        @for (d of details(); track d.slug) {
          <section class="bc-card ct-card">
            <div class="bc-card__head">
              <h2>{{ d.name }}</h2>
              <span class="bc-pill" [class.bc-pill--good]="d.competitionLabel === 'Low'" [class.bc-pill--warn]="d.competitionLabel === 'Medium'" [class.bc-pill--bad]="d.competitionLabel === 'High'">{{ d.competitionLabel | level }}</span>
            </div>
            <p class="ct-total"><b>{{ d.competitors.total }}</b> đối thủ · điểm cạnh tranh {{ d.scores.competition }}/100</p>
            <div class="ct-stack">
              @for (s of d.competitors.subtypes; track s.key; let i = $index) {
                <i [style.flex]="s.count" [style.background]="palette[i]" [title]="s.label + ': ' + s.count"></i>
              }
            </div>
            <ul class="ct-list">
              @for (s of d.competitors.subtypes; track s.key; let i = $index) {
                <li><span [style.background]="palette[i]"></span>{{ s.label }}<b>{{ s.count }}</b><small>{{ s.reachK }}k lượt/tháng</small></li>
              }
            </ul>
            <p class="ct-gap">{{ d.competitorGap }}</p>
          </section>
        } @empty {
          @for (i of [1, 2, 3, 4, 5, 6]; track i) { <div class="bc-skel" style="height: 230px"></div> }
        }
      </div>
    }
  `,
  styles: [
    `
      :host{display:block}
      .ct{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:14px;margin-top:12px}
      .ct-total{font-size:13px;color:var(--bc-dim);margin-bottom:10px}
      .ct-total b{font-size:22px;color:var(--bc-ink)}
      .ct-stack{display:flex;gap:2px;height:8px;border-radius:999px;overflow:hidden;margin-bottom:10px}
      .ct-list{list-style:none;margin:0;padding:0;display:grid;gap:6px;font-size:12.5px}
      .ct-list li{display:grid;grid-template-columns:10px 1fr auto auto;gap:8px;align-items:center;color:var(--bc-dim)}
      .ct-list span{width:9px;height:9px;border-radius:2px}
      .ct-list b{color:var(--bc-ink)}
      .ct-list small{color:var(--bc-faint);min-width:86px;text-align:right}
      .ct-gap{margin-top:10px;padding:8px 10px;border-radius:10px;background:var(--bc-good-bg);color:var(--bc-good);font-size:12px}
    `,
  ],
})
export class BcCompetitorsComponent {
  private readonly api = inject(BcApiService);
  private readonly state = inject(BcStateService);
  protected readonly palette = ['#ef4444', '#8b5cf6', '#f59e0b', '#94a3b8'];
  protected readonly details = signal<LocationDetail[]>([]);
  protected readonly error = signal<string | null>(null);

  constructor() {
    const slugs = ['cau-giay', 'ha-dong', 'tay-ho', 'hoan-kiem', 'dong-da', 'thanh-xuan', 'hai-ba-trung', 'gia-lam', 'long-bien', 'nam-tu-liem'];
    toObservable(computed(() => ({ c: this.state.category(), b: this.state.budgetVnd() })))
      .pipe(
        switchMap(({ c, b }) => {
          this.details.set([]);
          return forkJoin(slugs.map((s) => this.api.location(s, c, b))).pipe(
            catchError((e: unknown) => {
              this.error.set(describeError(e));
              return EMPTY;
            }),
          );
        }),
        takeUntilDestroyed(),
      )
      .subscribe((list) => this.details.set([...list].sort((a, b) => a.competitors.total - b.competitors.total)));
  }
}
