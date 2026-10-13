import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { OpText } from './op-i18n';
import { Assumptions, FeasibilityStore, HORIZON_MONTHS, computeFeasibility } from './op-feasibility';
import { Lang } from './op.models';

type Field = { key: keyof Assumptions; label: (t: OpText['feas']) => string; step: number };

/** "Tính khả thi" — the profit-and-loss calculator for the selected business type (merged from the Business Copilot). */
@Component({
  selector: 'op-feasibility',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let f = text().feas;
    @let r = result();
    <section class="feas" [attr.aria-label]="f.title">
      <div class="feas__head">
        <span class="op-eyebrow">{{ f.title }} · {{ typeName() }}</span>
        <span class="feas__tag" [class.is-yours]="!store.isDefault(type())">{{ store.isDefault(type()) ? f.assumed : f.yours }}</span>
      </div>
      <p class="feas__intro">{{ f.intro }}</p>
      @if (competitors() !== null) {
        <p class="feas__hint">{{ f.competitors(competitors()!) }}</p>
      }
      @if (adjusted(); as fx) {
        <p class="feas__hint feas__adj">{{ f.adjusted(num(fx.customers, 2), num(fx.rent, 2)) }}</p>
      }

      <div class="feas__results" aria-live="polite">
        <div>
          <span>{{ f.results.revenue }}</span>
          <strong>{{ money(r.revenue) }}</strong>
        </div>
        <div>
          <span>{{ f.results.costs }}</span>
          <strong>{{ money(r.costs.total) }}</strong>
        </div>
        <div [class.is-loss]="r.profit < 0" [class.is-gain]="r.profit > 0">
          <span>{{ f.results.profit }}</span>
          <strong>{{ money(r.profit) }}</strong>
          <em>{{ f.results.margin(num(r.marginPct, 0)) }}</em>
        </div>
        <div>
          <span>{{ f.results.payback }}</span>
          <strong>{{ r.paybackMonths === null ? '—' : f.results.paybackValue(r.paybackMonths) }}</strong>
          <em>{{ f.results.investment }} {{ money(r.investment) }}</em>
        </div>
        <div class="feas__wide">
          <span>{{ f.results.breakEven }}</span>
          <strong>{{ r.breakEvenCustomers === null ? '—' : f.results.breakEvenValue(num(r.breakEvenCustomers, 0), a().basis === 'day') }}</strong>
          <em [class.is-loss]="r.budgetGap < 0">{{ r.budgetGap >= 0 ? f.results.budgetOk(money(r.budgetGap)) : f.results.budgetShort(money(-r.budgetGap)) }}</em>
        </div>
      </div>
      @if (r.paybackMonths === null) {
        <p class="feas__hint is-loss">{{ f.results.noPayback }}</p>
      }

      <div class="feas__bar" role="img" [attr.aria-label]="f.results.costs">
        @for (c of breakdown(); track c.key) {
          <i [style.flex-grow]="c.value" [attr.data-k]="c.key" [title]="c.label + ': ' + money(c.value)"></i>
        }
      </div>
      <div class="feas__legend">
        @for (c of breakdown(); track c.key) {
          <span [attr.data-k]="c.key"><b></b>{{ c.label }} {{ money(c.value) }}</span>
        }
      </div>

      @if (chart(); as c) {
        <div class="feas__cash">
          <div class="feas__cash-head">
            <span>{{ f.cashflow.title }}</span>
            <small>{{ r.paybackMonths === null ? f.cashflow.none : f.cashflow.payback(r.paybackMonths) }}</small>
          </div>
          <svg viewBox="0 0 300 90" preserveAspectRatio="none" role="img" [attr.aria-label]="f.cashflow.title + ' · ' + f.cashflow.sub">
            <line x1="0" [attr.y1]="c.zero" x2="300" [attr.y2]="c.zero" class="feas__zero" />
            <polygon [attr.points]="c.area" class="feas__area" />
            <polyline [attr.points]="c.line" class="feas__line" vector-effect="non-scaling-stroke" />
            @if (c.payX !== null) {
              <line [attr.x1]="c.payX" y1="0" [attr.x2]="c.payX" y2="90" class="feas__pay" vector-effect="non-scaling-stroke" />
            }
          </svg>
          <div class="feas__cash-axis"><span>1</span><span>12</span><span>24</span><span>36 {{ f.cashflow.month }}</span></div>
          <small class="feas__cash-sub">{{ money(c.min) }} → {{ money(c.max) }} · {{ f.cashflow.sub }}</small>
        </div>
      }

      <details class="feas__form">
        <summary>{{ f.groups.sales }} · {{ f.groups.place }} · {{ f.groups.costs }} · {{ f.groups.money }}</summary>
        <div class="feas__grid">
          @for (fld of fields(); track fld.key) {
            <label>
              <span>{{ fld.label(f) }}</span>
              <input type="number" min="0" [step]="fld.step" [value]="a()[fld.key]" (change)="set(fld.key, $any($event.target).value)" />
            </label>
          }
        </div>
        @if (!store.isDefault(type())) {
          <button type="button" class="op-btn" (click)="store.reset(type())">{{ f.reset }}</button>
        }
      </details>
    </section>
  `,
  styles: [
    `
      .feas {
        display: flex;
        flex-direction: column;
        gap: 8px;
        padding: 12px;
        border: 1px solid var(--op-line);
        border-radius: 12px;
      }
      .feas__head {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 8px;
      }
      .feas__head .op-eyebrow {
        margin: 0;
      }
      .feas__tag {
        padding: 1px 6px;
        border-radius: 4px;
        font-size: 10px;
        font-weight: 800;
        letter-spacing: 0.05em;
        color: var(--op-warn);
        border: 1px solid var(--op-warn);
      }
      .feas__tag.is-yours {
        color: var(--op-accent);
        border-color: var(--op-accent);
      }
      .feas__intro,
      .feas__hint {
        margin: 0;
        font-size: 12px;
        line-height: 1.45;
        color: var(--op-ink-dim);
      }
      .feas__results {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 6px;
      }
      .feas__results > div {
        display: flex;
        flex-direction: column;
        gap: 2px;
        padding: 8px 10px;
        border-radius: 8px;
        background: var(--op-accent-soft);
      }
      .feas__results span {
        font-size: 11px;
        color: var(--op-ink-faint);
      }
      .feas__results strong {
        font-size: 17px;
        color: var(--op-ink);
      }
      .feas__results em {
        font-size: 11px;
        font-style: normal;
        color: var(--op-ink-dim);
      }
      .feas__wide {
        grid-column: 1 / -1;
      }
      .is-loss strong,
      em.is-loss,
      .feas__hint.is-loss {
        color: var(--op-warn) !important;
      }
      .is-gain strong {
        color: var(--op-accent);
      }
      .feas__bar {
        display: flex;
        height: 8px;
        border-radius: 4px;
        overflow: hidden;
        background: var(--op-line);
      }
      .feas__bar i,
      .feas__legend b {
        background: var(--k);
      }
      [data-k='rent'] {
        --k: #f08a4b;
      }
      [data-k='staff'] {
        --k: #5b8def;
      }
      [data-k='cogs'] {
        --k: #f2b134;
      }
      [data-k='utilities'] {
        --k: #2bb3a3;
      }
      [data-k='other'] {
        --k: #9b7bff;
      }
      .feas__legend {
        display: flex;
        flex-wrap: wrap;
        gap: 4px 10px;
        font-size: 11px;
        color: var(--op-ink-dim);
      }
      .feas__legend b {
        display: inline-block;
        width: 8px;
        height: 8px;
        margin-right: 4px;
        border-radius: 2px;
      }
      .feas__adj {
        color: var(--op-accent);
      }
      .feas__cash {
        display: flex;
        flex-direction: column;
        gap: 4px;
      }
      .feas__cash-head {
        display: flex;
        justify-content: space-between;
        gap: 8px;
        font-size: 12px;
        font-weight: 700;
      }
      .feas__cash-head small,
      .feas__cash-sub {
        font-size: 11px;
        font-weight: 500;
        color: var(--op-ink-dim);
      }
      .feas__cash svg {
        width: 100%;
        height: 90px;
      }
      .feas__zero {
        stroke: var(--op-line);
        stroke-width: 1;
      }
      .feas__area {
        fill: var(--op-accent-soft);
      }
      .feas__line {
        fill: none;
        stroke: var(--op-accent);
        stroke-width: 2;
      }
      .feas__pay {
        stroke: var(--op-warn);
        stroke-width: 1.5;
        stroke-dasharray: 3 3;
      }
      .feas__cash-axis {
        display: flex;
        justify-content: space-between;
        font-size: 10px;
        color: var(--op-ink-faint);
      }
      .feas__form summary {
        cursor: pointer;
        font-size: 12px;
        font-weight: 700;
        color: var(--op-accent);
      }
      .feas__grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 8px;
        margin: 8px 0;
      }
      .feas__grid label {
        display: flex;
        flex-direction: column;
        gap: 3px;
        font-size: 11px;
        color: var(--op-ink-dim);
      }
      .feas__grid input {
        width: 100%;
        padding: 5px 7px;
        border: 1px solid var(--op-line);
        border-radius: 6px;
        background: var(--app-surface);
        color: var(--op-ink);
        font: inherit;
        font-size: 12.5px;
      }
    `,
  ],
})
export class OpFeasibilityComponent {
  protected readonly store = inject(FeasibilityStore);
  readonly type = input.required<string>();
  readonly typeName = input('');
  /** Places of this type OpenStreetMap shows in the ward (null when unknown). */
  readonly competitors = input<number | null>(null);
  readonly text = input.required<OpText>();
  /** Plan adjustments for this ward (customers, rent multipliers); null = the user's figures as typed. */
  readonly factors = input<{ customers: number; rent: number } | null>(null);
  readonly lang = input<Lang>('vi');

  /** The user's assumptions (what the form edits). */
  protected readonly a = computed(() => this.store.get(this.type()));
  protected readonly adjusted = computed(() => {
    const fx = this.factors();
    return fx && (Math.abs(fx.customers - 1) > 0.005 || Math.abs(fx.rent - 1) > 0.005) ? fx : null;
  });
  /** Results: with the ward's plan adjustments when there are any. */
  protected readonly result = computed(() => {
    const a = this.a();
    const fx = this.adjusted();
    return computeFeasibility(fx ? { ...a, customers: Math.round(a.customers * fx.customers), rentPerM2: Math.round(a.rentPerM2 * fx.rent) } : a);
  });
  /** Cumulative cash curve, scaled into a 300 × 90 box. */
  protected readonly chart = computed(() => {
    const c = this.result().cumulative;
    if (!c.length) return null;
    const min = Math.min(0, ...c);
    const max = Math.max(0, ...c);
    const span = max - min || 1;
    const x = (i: number) => Math.round((i / (HORIZON_MONTHS - 1)) * 3000) / 10;
    const y = (v: number) => Math.round((84 - ((v - min) / span) * 78) * 10) / 10;
    const pts = c.map((v, i) => `${x(i)},${y(v)}`).join(' ');
    const pay = this.result().paybackMonths;
    return { line: pts, area: `${pts} 300,${y(0)} 0,${y(0)}`, zero: y(0), payX: pay === null ? null : x(pay - 1), min, max };
  });
  protected readonly breakdown = computed(() => {
    const c = this.result().costs;
    const b = this.text().feas.results.breakdown;
    return (['rent', 'staff', 'cogs', 'utilities', 'other'] as const).map((key) => ({ key, label: b[key], value: c[key] }));
  });
  protected readonly fields = computed<Field[]>(() => [
    { key: 'customers', label: (t) => (this.a().basis === 'day' ? t.fields.customersDay : t.fields.customersMonth), step: 1 },
    { key: 'ticket', label: (t) => t.fields.ticket, step: 5_000 },
    ...(this.a().basis === 'day' ? [{ key: 'daysOpen' as const, label: (t: OpText['feas']) => t.fields.daysOpen, step: 1 }] : []),
    { key: 'sizeM2', label: (t) => t.fields.sizeM2, step: 5 },
    { key: 'rentPerM2', label: (t) => t.fields.rentPerM2, step: 10_000 },
    { key: 'cogsPct', label: (t) => t.fields.cogsPct, step: 1 },
    { key: 'staff', label: (t) => t.fields.staff, step: 1 },
    { key: 'salary', label: (t) => t.fields.salary, step: 500_000 },
    { key: 'utilitiesPerM2', label: (t) => t.fields.utilitiesPerM2, step: 5_000 },
    { key: 'otherPct', label: (t) => t.fields.otherPct, step: 0.5 },
    { key: 'setupPerM2', label: (t) => t.fields.setupPerM2, step: 100_000 },
    { key: 'depositMonths', label: (t) => t.fields.depositMonths, step: 1 },
    { key: 'budget', label: (t) => t.fields.budget, step: 10_000_000 },
    { key: 'rampMonths', label: (t) => t.fields.rampMonths, step: 1 },
    { key: 'rampStartPct', label: (t) => t.fields.rampStartPct, step: 5 },
  ]);

  protected set(key: keyof Assumptions, value: string): void {
    const n = Number(value);
    if (!Number.isFinite(n) || n < 0) return;
    this.store.set(this.type(), { [key]: n } as Partial<Assumptions>);
  }

  protected num(n: number, digits = 1): string {
    return n.toLocaleString(this.lang() === 'en' ? 'en-US' : 'vi-VN', { maximumFractionDigits: digits });
  }

  /** "45,6 tr" / "1,25 tỷ" (VND). */
  protected money(v: number): string {
    const f = this.text().feas;
    const abs = Math.abs(v);
    const sign = v < 0 ? '−' : '';
    return abs >= 1e9 ? `${sign}${this.num(abs / 1e9, 2)} ${f.unitBillion}` : `${sign}${this.num(abs / 1e6, 1)} ${f.unitMillion}`;
  }
}
