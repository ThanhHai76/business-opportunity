import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { BillingService } from '../services/billing.service';
import { PremiumPromptService } from '../services/premium-prompt.service';
import { CareerLang, localeOf } from './career.local';
import { CHART, chartData } from './career.switch-chart';
import { switchPrintHtml } from './career.switch-print';
import { SWITCH_TEXT } from './career.switch-text';
import { CASE_IDS, EMPTY_INPUT, EXAMPLE_INPUT, MAX_OPTIONS, NET_AT, SWITCH_REFERENCES, SwitchInput, compute, isComplete, loadOptions, remarks, saveOptions, sanitize } from './career.switch';

/**
 * The career-change calculator tab of the Career Compass (career.switch.ts): the person types their own numbers and
 * reads what the change costs, the money to set aside and when it pays back. One option is free; comparing up to three
 * and the printable PDF are Premium. The numbers stay in this browser (nothing is sent).
 */
@Component({
  selector: 'app-career-switch',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="sw" aria-labelledby="sw-title">
      <h2 id="sw-title">{{ tx().title }}</h2>
      <p class="sw__lead">{{ tx().lead }}</p>
      <p class="sw__notice">{{ tx().notice }}</p>

      <div class="sw__options" role="group" [attr.aria-label]="tx().optionsLabel">
        @for (o of options(); track $index) {
          <button type="button" class="sw__opt" [class.is-on]="$index === active()" [attr.aria-pressed]="$index === active()" (click)="active.set($index)">
            {{ label(o, $index) }}
          </button>
        }
        @if (options().length < maxOptions) {
          <button type="button" class="sw__opt sw__opt--add" (click)="add()">
            @if (locked()) {<span aria-hidden="true">★</span>} + {{ tx().addOption }}
          </button>
        }
      </div>

      <div class="sw__form">
        <label class="sw__field sw__field--wide">
          <span>{{ tx().name }}</span>
          <input type="text" maxlength="60" [value]="current().name" [placeholder]="tx().namePlaceholder" (input)="setName($event)" />
        </label>
        @for (f of tx().fields; track f.key) {
          <label class="sw__field">
            <span>{{ f.label }}</span>
            <span class="sw__box">
              <input type="number" inputmode="decimal" min="0" step="any" [name]="f.key" [value]="current()[f.key] || ''" placeholder="0" (input)="setField(f.key, $event)" />
              <em>{{ f.unit }}</em>
            </span>
            <small>{{ f.hint }}</small>
          </label>
        }
      </div>
      <div class="sw__actions">
        <button type="button" class="sw__btn" (click)="fillExample()">{{ tx().example }}</button>
        <button type="button" class="sw__btn" (click)="clear()">{{ tx().clear }}</button>
        @if (options().length > 1) {
          <button type="button" class="sw__btn" (click)="remove()">{{ tx().removeOption }}</button>
        }
      </div>
      <p class="sw__small">{{ tx().exampleNote }}</p>

      <details class="sw__refs">
        <summary>{{ tx().refsTitle }}</summary>
        <p class="sw__small">{{ tx().refsNote }} {{ tx().refsChecked }}</p>
        @for (group of refGroups(); track group.title) {
          <h3>{{ group.title }}</h3>
          <ul>
            @for (r of group.items; track r.id) {
              <li>
                {{ lang() === 'en' ? r.en : r.vi }}
                @for (s of r.sources; track s.url) {
                  <a [href]="s.url" target="_blank" rel="noopener noreferrer" [title]="lang() === 'en' ? s.en : s.vi">[{{ s.publisher }}]</a>
                }
              </li>
            }
          </ul>
        }
      </details>

      <section class="sw__results" aria-labelledby="sw-results">
        <h3 id="sw-results">{{ tx().resultsTitle }}</h3>
        @if (!complete()) {
          <p class="sw__small">{{ tx().needNew }}</p>
        } @else {
          @let r = results();
          <div class="sw__tablewrap">
            <table class="sw__table">
              <thead>
                <tr>
                  <th scope="col"><span class="sw__vh">{{ tx().resultsTitle }}</span></th>
                  @for (id of caseIds; track id) {
                    <th scope="col" [class.is-base]="id === 'base'">{{ tx().cases[id] }}</th>
                  }
                </tr>
              </thead>
              <tbody>
                <tr>
                  <th scope="row">{{ tx().rowNewIncome }}</th>
                  @for (id of caseIds; track id) {<td [class.is-base]="id === 'base'">{{ num(r[id].newIncome) }}</td>}
                </tr>
                <tr>
                  <th scope="row">{{ tx().rowSearch }}</th>
                  @for (id of caseIds; track id) {<td [class.is-base]="id === 'base'">{{ r[id].searchMonths }}</td>}
                </tr>
                <tr>
                  <th scope="row">{{ tx().rowCost }}<small>{{ tx().rowCostHint }}</small></th>
                  @for (id of caseIds; track id) {<td [class.is-base]="id === 'base'">{{ num(r[id].totalCost) }}</td>}
                </tr>
                <tr class="sw__key">
                  <th scope="row">{{ tx().rowPayback }}</th>
                  @for (id of caseIds; track id) {<td [class.is-base]="id === 'base'"><strong>{{ tx().payback(r[id].paybackMonths) }}</strong></td>}
                </tr>
                @for (m of netAt; track m) {
                  <tr>
                    <th scope="row">{{ tx().rowNet(m) }}</th>
                    @for (id of caseIds; track id) {<td [class.is-base]="id === 'base'" [class.is-neg]="r[id].net[m] < 0">{{ signed(r[id].net[m]) }}</td>}
                  </tr>
                }
                <tr>
                  <th scope="row">{{ tx().rowBuffer }}<small>{{ tx().rowBufferHint }}</small></th>
                  @for (id of caseIds; track id) {
                    <td [class.is-base]="id === 'base'">
                      {{ num(r[id].buffer) }}
                      @if (r[id].bufferMonths !== null) {<small>{{ tx().bufferMonths(num(r[id].bufferMonths!)) }}</small>}
                    </td>
                  }
                </tr>
              </tbody>
            </table>
          </div>
          <p class="sw__small">{{ tx().caseNote }}</p>
          @for (k of remarkList(); track k) {
            <p class="sw__remark" role="note">{{ tx().remarks[k] }}</p>
          }

          <h4>{{ tx().chartTitle }}</h4>
          @let c = chart();
          <svg class="sw__chart" [attr.viewBox]="'0 0 ' + box.width + ' ' + box.height" role="img" [attr.aria-label]="tx().chartAria(tx().payback(r.base.paybackMonths))">
            @if (c.zeroY !== null) {
              <line [attr.x1]="box.left" [attr.x2]="box.width - box.right" [attr.y1]="c.zeroY" [attr.y2]="c.zeroY" class="sw__zero" />
            }
            <text [attr.x]="box.left - 6" [attr.y]="c.maxY + 4" text-anchor="end">{{ num(c.max) }}</text>
            <text [attr.x]="box.left - 6" [attr.y]="c.minY + 4" text-anchor="end">{{ num(c.min) }}</text>
            @for (k of c.ticks; track k.label) {
              <text [attr.x]="k.x" [attr.y]="box.height - box.bottom + 16" text-anchor="middle">{{ k.label }}</text>
            }
            @for (l of c.lines; track l.id) {
              <path [attr.d]="l.d" [attr.class]="'sw__line sw__line--' + l.id" />
            }
          </svg>
          <p class="sw__legend">
            @for (id of caseIds; track id) {<span><i [attr.class]="'sw__dot sw__dot--' + id"></i>{{ tx().cases[id] }}</span>}
            <span>({{ tx().month }})</span>
          </p>
        }
      </section>

      @if (comparison().length > 1) {
        <section class="sw__compare" aria-labelledby="sw-compare">
          <h3 id="sw-compare">{{ tx().compareTitle }}</h3>
          <div class="sw__tablewrap">
            <table class="sw__table">
              <thead>
                <tr>
                  <th scope="col"><span class="sw__vh">{{ tx().compareTitle }}</span></th>
                  @for (c of comparison(); track c.index) {<th scope="col">{{ c.name }}</th>}
                </tr>
              </thead>
              <tbody>
                <tr><th scope="row">{{ tx().rowCost }}</th>@for (c of comparison(); track c.index) {<td>{{ num(c.base.totalCost) }}</td>}</tr>
                <tr class="sw__key"><th scope="row">{{ tx().rowPayback }}</th>@for (c of comparison(); track c.index) {<td><strong>{{ tx().payback(c.base.paybackMonths) }}</strong></td>}</tr>
                <tr><th scope="row">{{ tx().rowNet(24) }}</th>@for (c of comparison(); track c.index) {<td [class.is-neg]="c.base.net[24] < 0">{{ signed(c.base.net[24]) }}</td>}</tr>
                <tr><th scope="row">{{ tx().rowNet(36) }}</th>@for (c of comparison(); track c.index) {<td [class.is-neg]="c.base.net[36] < 0">{{ signed(c.base.net[36]) }}</td>}</tr>
                <tr><th scope="row">{{ tx().rowBuffer }}</th>@for (c of comparison(); track c.index) {<td>{{ num(c.base.buffer) }}</td>}</tr>
              </tbody>
            </table>
          </div>
          <p class="sw__small">{{ tx().compareNote }}</p>
        </section>
      }

      <div class="sw__export">
        @if (locked()) {
          <button type="button" class="sw__btn sw__btn--premium" (click)="exportPdf()"><span aria-hidden="true">★</span> {{ tx().exportPdf }}</button>
          <p class="sw__small">{{ tx().premiumNote }}</p>
        } @else {
          <button type="button" class="sw__btn sw__btn--primary" (click)="exportPdf()" [disabled]="!anyComplete()">{{ tx().exportPdf }}</button>
          <p class="sw__small">{{ tx().exportHint }}</p>
        }
        @if (exportMessage(); as m) {
          <p class="sw__remark" role="alert">{{ m }}</p>
        }
      </div>
    </section>
  `,
  styles: [
    `
      .sw { display: grid; gap: 14px; }
      .sw h2, .sw h3, .sw h4, .sw p { margin: 0; }
      .sw h2 { font-size: 20px; }
      .sw h3 { font-size: 15px; }
      .sw h4 { font-size: 13px; color: var(--app-ink-dim); margin-top: 6px; }
      .sw__lead { color: var(--app-ink-dim); }
      .sw__notice { padding: 10px 14px; border-left: 4px solid var(--app-career); border-radius: 8px; background: var(--app-career-soft); font-size: 13px; }
      .sw__small { color: var(--app-ink-dim); font-size: 12.5px; }
      .sw__options { display: flex; flex-wrap: wrap; gap: 8px; }
      .sw__opt { padding: 7px 14px; border: 1px solid var(--app-line); border-radius: 999px; background: var(--app-surface); color: var(--app-ink); font: inherit; font-weight: 700; cursor: pointer; }
      .sw__opt.is-on { border-color: transparent; background: var(--app-career); color: #fff; }
      .sw__opt--add { border-style: dashed; color: var(--app-ink-dim); }
      .sw__opt--add span { color: #d97706; }
      .sw__form { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px 16px; padding: 16px; border: 1px solid var(--app-line); border-radius: 14px; background: var(--app-surface); }
      .sw__field { display: grid; gap: 4px; align-content: start; font-size: 12.5px; font-weight: 700; color: var(--app-ink-dim); }
      .sw__field--wide { grid-column: 1 / -1; }
      .sw__field small { font-weight: 500; font-size: 12px; color: var(--app-ink-faint); }
      .sw__box { display: flex; align-items: center; gap: 8px; }
      .sw__box em { font-style: normal; font-weight: 500; font-size: 12px; white-space: nowrap; }
      .sw input { width: 100%; min-width: 0; padding: 9px 11px; border: 1px solid var(--app-line); border-radius: 10px; background: var(--app-surface-2); color: var(--app-ink); font: inherit; font-weight: 500; }
      .sw input:focus-visible { outline: 2px solid var(--app-career); outline-offset: 1px; }
      .sw__actions { display: flex; flex-wrap: wrap; gap: 8px; }
      .sw__btn { padding: 8px 14px; border: 1px solid var(--app-line); border-radius: 10px; background: var(--app-surface); color: var(--app-ink); font: inherit; font-weight: 700; cursor: pointer; }
      .sw__btn--primary { border-color: transparent; background: var(--app-career); color: #fff; }
      .sw__btn--premium { border-color: #d97706; color: #b45309; }
      .sw__btn--premium span { color: #d97706; }
      .sw__btn:disabled { opacity: 0.55; cursor: not-allowed; }
      .sw__refs { padding: 12px 16px; border: 1px solid var(--app-line); border-radius: 14px; background: var(--app-surface); }
      .sw__refs summary { cursor: pointer; font-weight: 700; }
      .sw__refs h3 { margin-top: 10px; font-size: 13px; color: var(--app-ink-dim); }
      .sw__refs ul { margin: 6px 0 0; padding-left: 18px; display: grid; gap: 6px; font-size: 13px; }
      .sw__refs a { color: var(--app-career); font-size: 12px; margin-left: 4px; }
      .sw__results { display: grid; gap: 10px; padding: 16px; border: 1px solid var(--app-line); border-radius: 14px; background: var(--app-surface); }
      .sw__tablewrap { overflow-x: auto; }
      .sw__table { width: 100%; border-collapse: collapse; font-size: 13px; }
      .sw__table th, .sw__table td { padding: 8px 10px; border-bottom: 1px solid var(--app-line-soft); text-align: right; vertical-align: top; }
      .sw__table th:first-child { text-align: left; font-weight: 600; min-width: 170px; }
      .sw__table thead th { font-weight: 700; color: var(--app-ink-dim); }
      .sw__table th small, .sw__table td small { display: block; font-weight: 500; font-size: 11.5px; color: var(--app-ink-faint); }
      .sw__table .is-base { background: var(--app-career-soft); }
      .sw__table .is-neg { color: #dc2626; }
      .sw__key td, .sw__key th { font-size: 14px; }
      .sw__vh { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
      .sw__remark { padding: 9px 12px; border: 1px solid #d97706; border-radius: 10px; background: color-mix(in srgb, #d97706 9%, transparent); font-size: 13px; }
      .sw__chart { width: 100%; height: auto; max-height: 260px; }
      .sw__chart text { font-size: 10px; fill: var(--app-ink-dim); }
      .sw__zero { stroke: var(--app-ink-faint); stroke-dasharray: 4 3; }
      .sw__line { fill: none; stroke-width: 1.5; }
      .sw__line--base { stroke: var(--app-career); stroke-width: 2.8; }
      .sw__line--careful { stroke: #d97706; }
      .sw__line--bright { stroke: #2563eb; }
      .sw__legend { display: flex; flex-wrap: wrap; gap: 14px; font-size: 12px; color: var(--app-ink-dim); }
      .sw__dot { display: inline-block; width: 14px; height: 3px; margin-right: 5px; vertical-align: middle; }
      .sw__dot--base { background: var(--app-career); }
      .sw__dot--careful { background: #d97706; }
      .sw__dot--bright { background: #2563eb; }
      .sw__compare { display: grid; gap: 8px; padding: 16px; border: 1px solid var(--app-line); border-radius: 14px; background: var(--app-surface); }
      .sw__export { display: grid; gap: 6px; justify-items: start; }
      @media (max-width: 640px) { .sw__form { grid-template-columns: 1fr; } }
    `,
  ],
})
export class CareerSwitchComponent {
  readonly lang = input<CareerLang>('vi');
  /** A name for the option still without one (the direction the person came from). */
  readonly suggestedName = input('');

  private readonly billing = inject(BillingService);
  private readonly premiumPrompt = inject(PremiumPromptService);
  protected readonly locked = this.billing.premiumLocked;

  protected readonly tx = computed(() => SWITCH_TEXT[this.lang()]);
  protected readonly caseIds = CASE_IDS;
  protected readonly netAt = NET_AT;
  protected readonly maxOptions = MAX_OPTIONS;
  protected readonly box = CHART;

  protected readonly options = signal<SwitchInput[]>(loadOptions());
  protected readonly active = signal(0);
  protected readonly exportMessage = signal<string | null>(null);
  private readonly keep = effect(() => saveOptions(this.options()));
  private readonly suggest = effect(() => {
    const name = this.suggestedName();
    if (name && !untracked(() => this.current().name.trim())) untracked(() => this.update({ name }));
  });

  protected readonly current = computed(() => this.options()[this.active()] ?? this.options()[0]);
  protected readonly complete = computed(() => isComplete(this.current()));
  protected readonly results = computed(() => compute(this.current()));
  protected readonly remarkList = computed(() => remarks(this.current(), this.results().base));
  protected readonly chart = computed(() => chartData(this.results()));
  protected readonly anyComplete = computed(() => this.options().some(isComplete));

  /** The options that have their numbers, for the comparison (their own base case). */
  protected readonly comparison = computed(() =>
    this.options()
      .map((o, index) => ({ index, name: this.label(o, index), complete: isComplete(o), base: compute(o).base }))
      .filter((c) => c.complete),
  );

  protected readonly refGroups = computed(() => {
    const t = this.tx();
    return [
      { title: t.refsIncome, items: SWITCH_REFERENCES.filter((r) => r.field === 'income') },
      { title: t.refsTraining, items: SWITCH_REFERENCES.filter((r) => r.field === 'training') },
    ];
  });

  private readonly nf = computed(() => new Intl.NumberFormat(localeOf(this.lang()), { maximumFractionDigits: 1 }));
  protected num(n: number): string {
    return this.nf().format(n);
  }
  protected signed(n: number): string {
    return (n > 0 ? '+' : '') + this.num(n);
  }

  protected label(o: SwitchInput, index: number): string {
    return o.name.trim() || this.tx().option(index + 1);
  }

  private update(change: Partial<SwitchInput>): void {
    const i = this.active();
    this.options.update((list) => list.map((o, k) => (k === i ? sanitize({ ...o, ...change }) : o)));
  }

  protected setName(event: Event): void {
    this.update({ name: (event.target as HTMLInputElement).value });
  }

  protected setField(key: keyof Omit<SwitchInput, 'name'>, event: Event): void {
    const value = (event.target as HTMLInputElement).valueAsNumber;
    this.update({ [key]: Number.isFinite(value) ? value : 0 });
  }

  protected fillExample(): void {
    this.update({ ...EXAMPLE_INPUT, name: this.current().name });
  }

  protected clear(): void {
    this.update({ ...EMPTY_INPUT, name: this.current().name });
  }

  /** A second and third option are Premium. */
  protected add(): void {
    if (this.locked()) return this.premiumPrompt.open(this.tx().askMore, this.lang());
    this.options.update((list) => [...list, { ...EMPTY_INPUT }]);
    this.active.set(this.options().length - 1);
  }

  protected remove(): void {
    const i = this.active();
    this.options.update((list) => (list.length > 1 ? list.filter((_, k) => k !== i) : list));
    this.active.set(Math.min(i, this.options().length - 1));
  }

  /** Opens the printable plan in a new tab (Premium); a Premium account with saved details gets them on it. */
  protected exportPdf(): void {
    if (this.locked()) return this.premiumPrompt.open(this.tx().askPdf, this.lang());
    this.exportMessage.set(null);
    const html = switchPrintHtml({
      lang: this.lang(),
      options: this.options().filter(isComplete),
      generatedAt: new Date(),
      brand: this.billing.brand(),
      references: SWITCH_REFERENCES,
    });
    const url = URL.createObjectURL(new Blob([html], { type: 'text/html;charset=utf-8' }));
    const tab = window.open(url, '_blank');
    if (!tab) this.exportMessage.set(this.tx().exportBlocked);
    setTimeout(() => URL.revokeObjectURL(url), 120_000);
  }
}
