import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { formatInt, formatNum } from '../pi-format';
import { CRITERIA_KEYS } from '../pi-weights';
import { CriterionKey, WardSummary } from '../pi.models';
import { PiStateService } from '../pi.service';

interface Row {
  key: string;
  label: string;
  cells: string[];
  /** Index of the best value (null when not comparable). */
  best: number | null;
}

/** Side-by-side comparison of up to three wards, from the ward list already loaded (no extra request). */
@Component({
  selector: 'pi-compare',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let tx = state.t();
    <section class="cmp pi-glass" [attr.aria-label]="tx.compare.title(wards().length)">
      <header class="cmp__head">
        <strong>{{ tx.compare.title(wards().length) }}</strong>
        <div class="cmp__actions">
          <button type="button" class="pi-btn pi-btn--small" (click)="state.setCompare([])">{{ tx.compare.clear }}</button>
          <button type="button" class="pi-btn pi-btn--small" (click)="closed.emit()">{{ tx.compare.close }}</button>
        </div>
      </header>
      @if (wards().length < 2) {
        <p class="cmp__hint">{{ tx.compare.hint }}</p>
      }
      <div class="cmp__table" role="table" [style.--cols]="wards().length">
        <div class="cmp__row cmp__row--head" role="row">
          <span role="columnheader"></span>
          @for (w of wards(); track w.slug) {
            <span role="columnheader" class="cmp__ward">
              <button type="button" class="cmp__name" (click)="select.emit(w.slug)">{{ w.shortName }}</button>
              <button type="button" class="cmp__x" (click)="state.toggleCompare(w.slug)" [attr.aria-label]="tx.compare.remove + ' ' + w.name">×</button>
            </span>
          }
        </div>
        @for (r of rows(); track r.key) {
          <div class="cmp__row" role="row">
            <span role="rowheader">{{ r.label }}</span>
            @for (c of r.cells; track $index; let i = $index) {
              <span role="cell" class="pi-mono" [class.is-best]="r.best === i && wards().length > 1">{{ c }}</span>
            }
          </div>
        }
      </div>
    </section>
  `,
  styles: [
    `
      .cmp {
        display: flex;
        flex-direction: column;
        gap: 8px;
        padding: 12px 14px;
        border-radius: 10px;
        max-height: 100%;
        overflow: auto;
        color: var(--pi-ink);
      }
      .cmp__head {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 8px;
        font-size: 13px;
      }
      .cmp__actions {
        display: flex;
        gap: 6px;
      }
      .cmp__hint {
        margin: 0;
        font-size: 11.5px;
        color: var(--pi-dim);
      }
      .cmp__row {
        display: grid;
        grid-template-columns: 150px repeat(var(--cols, 1), minmax(70px, 1fr));
        gap: 8px;
        align-items: baseline;
        padding: 3px 0;
        border-bottom: 1px solid var(--pi-line);
        font-size: 12px;
      }
      .cmp__row > span:not(:first-child) {
        text-align: right;
      }
      .cmp__row--head {
        font-weight: 600;
      }
      .cmp__ward {
        display: flex;
        justify-content: flex-end;
        gap: 4px;
      }
      .cmp__name,
      .cmp__x {
        border: 0;
        background: none;
        color: inherit;
        font: inherit;
        cursor: pointer;
        padding: 0;
      }
      .cmp__name:hover {
        color: var(--pi-cyan);
        text-decoration: underline;
      }
      .cmp__x {
        color: var(--pi-faint);
      }
      .is-best {
        color: var(--pi-green);
        font-weight: 700;
      }
    `,
  ],
})
export class PiCompareComponent {
  protected readonly state = inject(PiStateService);
  /** The compared wards, in the order they were added. */
  readonly wards = input.required<WardSummary[]>();
  /** Score and rank under the user's weights. */
  readonly ranking = input<Map<string, { score: number; rank: number }> | null>(null);
  readonly select = output<string>();
  readonly closed = output<void>();

  protected readonly rows = computed<Row[]>(() => {
    const t = this.state.t();
    const lang = this.state.lang();
    const ws = this.wards();
    const rk = this.ranking();
    const best = (values: (number | null)[], high: boolean): number | null => {
      const v = values.map((x, i) => ({ x, i })).filter((p): p is { x: number; i: number } => p.x !== null);
      if (v.length < 2) return null;
      return v.sort((a, b) => (high ? b.x - a.x : a.x - b.x))[0].i;
    };
    const num = (v: number | null, digits = 1) => (v === null ? '—' : formatNum(v, lang, digits));
    const score = ws.map((w) => rk?.get(w.slug)?.score ?? w.score);
    const rows: Row[] = [
      { key: 'score', label: t.compare.rows.score, cells: score.map(String), best: best(score, true) },
      { key: 'rank', label: t.compare.rows.rank, cells: ws.map((w) => `#${rk?.get(w.slug)?.rank ?? w.rank}`), best: best(score, true) },
      ...CRITERIA_KEYS.map((k: CriterionKey) => {
        const v = ws.map((w) => w.values[k]);
        return { key: k, label: t.criteriaLabels[k], cells: v.map((x) => (x === null ? '—' : String(x))), best: best(v, true) };
      }),
      { key: 'land', label: t.compare.rows.land, cells: ws.map((w) => num(w.landMedian)), best: null },
      { key: 'centre', label: t.compare.rows.centre, cells: ws.map((w) => (w.drive?.centre == null ? '—' : t.ward.travel.minutes(w.drive.centre))), best: best(ws.map((w) => w.drive?.centre ?? null), false) },
      { key: 'metro', label: t.compare.rows.metro, cells: ws.map((w) => (w.drive?.metro == null ? '—' : t.ward.travel.minutes(w.drive.metro))), best: best(ws.map((w) => w.drive?.metro ?? null), false) },
      { key: 'population', label: t.compare.rows.population, cells: ws.map((w) => (w.population === null ? '—' : formatInt(w.population, lang))), best: null },
      { key: 'density', label: t.compare.rows.density, cells: ws.map((w) => (w.density === null ? '—' : formatInt(w.density, lang))), best: null },
    ];
    return rows;
  });
}
