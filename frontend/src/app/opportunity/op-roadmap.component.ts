import { ChangeDetectionStrategy, Component, computed, effect, inject, input, model, output, signal } from '@angular/core';
import { OpText } from './op-i18n';
import { FeasibilityStore } from './op-feasibility';
import { ROADMAP_UPDATED, RUNWAY_MONTHS, StepId, buildRoadmap, checklistText } from './op-roadmap';
import { Lang } from './op.models';

const TEXT = {
  vi: {
    title: 'Lộ trình mở quán',
    summary: (a: number, b: number) => `7 bước · khoảng ${a}–${b} ngày`,
    intro: 'Bảy bước từ chọn mặt bằng đến khai trương. Thời gian là ước chừng và thay đổi theo hồ sơ của bạn.',
    days: (a: number, b: number) => `${a}–${b} ngày`,
    ward: (name: string) => `Nộp hồ sơ tại phường/xã ${name} hoặc theo hướng dẫn của cổng dịch vụ công.`,
    done: 'Đánh dấu đã xong',
    official: 'Trang chính thức',
    premiumTitle: 'Lộ trình theo kế hoạch của bạn',
    premiumHint: 'Lịch cụ thể theo ngày bắt đầu, chi phí từng bước từ bảng giả định của bạn, tiền cần có trước khi mở, danh sách để lưu và tích dần.',
    unlock: 'Mở lộ trình cá nhân hoá',
    start: 'Ngày bắt đầu',
    launch: 'Khai trương dự kiến',
    earliest: 'sớm nhất',
    latest: 'muộn nhất',
    cash: 'Tiền cần trước khi mở',
    cashHint: 'Cọc, fit-out, giấy phép, PCCC, marketing tháng đầu',
    runway: (m: number) => `Vốn lưu động ${m} tháng đầu`,
    runwayHint: 'Thuê, lương, điện nước khi doanh thu chưa lên',
    fits: (v: string) => `Ngân sách ${v} đủ cho cả hai`,
    short: (v: string) => `Ngân sách thiếu ${v} (ước tính cao)`,
    maybe: (v: string) => `Đủ nếu chi phí ở mức thấp, còn dư ${v}`,
    copy: 'Sao chép danh sách',
    copied: 'Đã sao chép',
    save: 'Tải về (.txt)',
    progressSaved: 'Tiến độ được lưu trên trình duyệt này.',
    cost: 'Chi phí',
    when: 'Dự kiến xong',
    note: `Thông tin tham khảo, cập nhật ${ROADMAP_UPDATED}; không phải tư vấn pháp lý. Quy định và lệ phí thay đổi, hãy xác nhận với UBND phường và cơ quan chuyên ngành trước khi chi tiền.`,
  },
  en: {
    title: 'Roadmap to opening',
    summary: (a: number, b: number) => `7 steps · about ${a}–${b} days`,
    intro: 'Seven steps from choosing the premises to launch. Times are estimates and depend on your paperwork.',
    days: (a: number, b: number) => `${a}–${b} days`,
    ward: (name: string) => `File at the ${name} ward office or as the public service portal directs.`,
    done: 'Mark as done',
    official: 'Official site',
    premiumTitle: 'Your plan’s roadmap',
    premiumHint: 'A calendar from your start date, each step’s cost from your own assumptions, the cash to have before opening, and a list to save and tick off.',
    unlock: 'Unlock the personal roadmap',
    start: 'Start date',
    launch: 'Expected launch',
    earliest: 'earliest',
    latest: 'latest',
    cash: 'Cash before opening',
    cashHint: 'Deposit, fit-out, permits, fire safety, first-month marketing',
    runway: (m: number) => `Working capital, first ${m} months`,
    runwayHint: 'Rent, wages, utilities while sales ramp up',
    fits: (v: string) => `Your budget of ${v} covers both`,
    short: (v: string) => `Your budget is ${v} short (high estimate)`,
    maybe: (v: string) => `Enough if costs are at the low end, ${v} to spare`,
    copy: 'Copy the list',
    copied: 'Copied',
    save: 'Download (.txt)',
    progressSaved: 'Progress is saved in this browser.',
    cost: 'Cost',
    when: 'Expected done',
    note: `Indicative, as of ${ROADMAP_UPDATED}; not legal advice. Rules and fees change: confirm with the ward office and the sector authority before you spend.`,
  },
};

const isoToday = (): string => new Date().toLocaleDateString('sv-SE');
const storageKey = (type: string, ward: string): string => `hcv.roadmap.${type}.${ward}`;

/** "Lộ trình mở quán": free checklist of the seven steps; Premium adds dates, costs, the cash needed, and saved progress. */
@Component({
  selector: 'op-roadmap',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let x = s();
    <details class="rm" [open]="open()" (toggle)="open.set($any($event.target).open)">
      <summary class="rm__head">
        <span class="rm__eyebrow">{{ x.title }} · {{ typeName() }}</span>
        <small>{{ x.summary(view().total[0], view().total[1]) }}</small>
      </summary>
      <p class="rm__muted">{{ x.intro }}</p>

      <ol class="rm__steps">
        @for (st of view().steps; track st.id; let i = $index) {
          <li [class.is-done]="done().has(st.id)">
            <label class="rm__tick">
              <input type="checkbox" [checked]="done().has(st.id)" (change)="toggle(st.id)" [attr.aria-label]="x.done + ': ' + st.title" />
              <span class="rm__no" aria-hidden="true">{{ i + 1 }}</span>
            </label>
            <div class="rm__main">
              <strong>{{ st.title }}</strong>
              <p>{{ st.body }}</p>
              @if (st.id === 'register') {
                <p class="rm__muted">{{ x.ward(wardName()) }}</p>
              }
              <div class="rm__meta">
                <span>{{ x.days(st.days[0], st.days[1]) }}</span>
                @if (!locked()) {
                  <span>{{ x.when }}: {{ date(st.end[0]) }} – {{ date(st.end[1]) }}</span>
                  @if (st.cost[1] > 0) {
                    <span title="{{ st.costNote }}">{{ x.cost }}: {{ range(st.cost) }}</span>
                  }
                }
                @if (st.link; as l) {
                  <a [href]="l.url" target="_blank" rel="noopener noreferrer">{{ l.label }} ↗</a>
                }
              </div>
            </div>
          </li>
        }
      </ol>

      @if (locked()) {
        <div class="rm__lock">
          <strong><span aria-hidden="true">★</span> {{ x.premiumTitle }}</strong>
          <p>{{ x.premiumHint }}</p>
          <button type="button" class="rm__btn rm__btn--pro" (click)="upgrade.emit()">{{ x.unlock }}</button>
        </div>
      } @else {
        @let v = view();
        <div class="rm__pro">
          <strong>{{ x.premiumTitle }}</strong>
          <label class="rm__start">
            <span>{{ x.start }}</span>
            <input type="date" [value]="start()" (change)="setStart($any($event.target).value)" />
          </label>
          <div class="rm__stats">
            <div>
              <span>{{ x.launch }}</span>
              <strong>{{ date(v.total[0]) }} – {{ date(v.total[1]) }}</strong>
              <em>{{ x.earliest }} – {{ x.latest }}</em>
            </div>
            <div>
              <span>{{ x.cash }}</span>
              <strong>{{ range(v.cash) }}</strong>
              <em>{{ x.cashHint }}</em>
            </div>
            <div>
              <span>{{ x.runway(runwayMonths) }}</span>
              <strong>{{ money(v.runway) }}</strong>
              <em>{{ x.runwayHint }}</em>
            </div>
          </div>
          <p class="rm__verdict" [class.is-short]="v.gap[0] < 0 && v.gap[1] < 0" [class.is-maybe]="v.gap[0] < 0 && v.gap[1] >= 0">
            @if (v.gap[0] >= 0) {
              {{ x.fits(money(v.budget)) }}
            } @else if (v.gap[1] >= 0) {
              {{ x.maybe(money(v.gap[1])) }}
            } @else {
              {{ x.short(money(-v.gap[0])) }}
            }
          </p>
          <div class="rm__actions">
            <button type="button" class="rm__btn" (click)="copy()">{{ copied() ? x.copied : x.copy }}</button>
            <button type="button" class="rm__btn" (click)="download()">{{ x.save }}</button>
          </div>
          <p class="rm__muted">{{ x.progressSaved }}</p>
        </div>
      }
      <p class="rm__muted rm__note">{{ x.note }}</p>
    </details>
  `,
  styles: [
    `
      .rm {
        display: flex;
        flex-direction: column;
        gap: 8px;
        padding: 12px;
        border: 1px solid var(--op-line);
        border-radius: 12px;
      }
      .rm__head {
        list-style: none;
        display: flex;
        flex-direction: column;
        gap: 2px;
        cursor: pointer;
      }
      .rm__head small {
        font-size: 12px;
        color: var(--op-ink-dim);
      }
      .rm__head {
        position: relative;
        padding-right: 18px;
      }
      .rm__head::after {
        content: '▸';
        position: absolute;
        right: 2px;
        top: 2px;
        color: var(--op-ink-faint);
      }
      .rm[open] > .rm__head::after {
        content: '▾';
      }
      .rm[open] > .rm__head {
        margin-bottom: 4px;
      }
      .rm__eyebrow {
        font-size: 11px;
        font-weight: 800;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        color: var(--op-ink-faint);
      }
      .rm__muted {
        margin: 0;
        font-size: 12px;
        line-height: 1.45;
        color: var(--op-ink-dim);
      }
      .rm__note {
        font-size: 11px;
        color: var(--op-ink-faint);
      }
      .rm__steps {
        list-style: none;
        margin: 0;
        padding: 0;
        display: flex;
        flex-direction: column;
        gap: 10px;
      }
      .rm__steps li {
        display: grid;
        grid-template-columns: 28px 1fr;
        gap: 8px;
      }
      .rm__tick {
        position: relative;
        width: 28px;
        height: 28px;
        cursor: pointer;
      }
      .rm__tick input {
        position: absolute;
        inset: 0;
        opacity: 0;
        cursor: pointer;
        margin: 0;
      }
      .rm__no {
        display: grid;
        place-items: center;
        width: 28px;
        height: 28px;
        border-radius: 50%;
        border: 1.5px solid var(--op-accent);
        color: var(--op-accent);
        font-size: 12px;
        font-weight: 800;
      }
      .rm__tick input:checked + .rm__no {
        background: var(--op-accent);
        color: var(--app-surface);
      }
      .rm__tick input:focus-visible + .rm__no {
        outline: 2px solid var(--op-accent);
        outline-offset: 2px;
      }
      .is-done .rm__main strong {
        text-decoration: line-through;
        opacity: 0.65;
      }
      .rm__main strong {
        font-size: 13.5px;
        color: var(--op-ink);
      }
      .rm__main p {
        margin: 2px 0 0;
        font-size: 12.5px;
        line-height: 1.5;
        color: var(--op-ink-dim);
      }
      .rm__main p.rm__muted {
        font-size: 11.5px;
      }
      .rm__meta {
        display: flex;
        flex-wrap: wrap;
        gap: 4px 10px;
        margin-top: 4px;
        font-size: 11.5px;
        color: var(--op-ink-faint);
      }
      .rm__meta a {
        color: var(--op-accent);
      }
      .rm__lock,
      .rm__pro {
        display: flex;
        flex-direction: column;
        gap: 8px;
        padding: 10px 12px;
        border-radius: 10px;
      }
      .rm__lock {
        border: 1px dashed color-mix(in srgb, #d97706 55%, transparent);
        background: color-mix(in srgb, #d97706 8%, transparent);
      }
      .rm__lock p {
        margin: 0;
        font-size: 12.5px;
        line-height: 1.45;
        color: var(--op-ink-dim);
      }
      .rm__lock strong span {
        color: #d97706;
      }
      .rm__pro {
        background: var(--op-accent-soft);
      }
      .rm__start {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        font-size: 12px;
        color: var(--op-ink-dim);
      }
      .rm__start input {
        padding: 5px 7px;
        border: 1px solid var(--op-line);
        border-radius: 6px;
        background: var(--app-surface);
        color: var(--op-ink);
        font: inherit;
        font-size: 12.5px;
      }
      .rm__stats {
        display: grid;
        gap: 6px;
      }
      .rm__stats > div {
        display: flex;
        flex-direction: column;
        gap: 2px;
        padding: 8px 10px;
        border-radius: 8px;
        background: var(--app-surface);
      }
      .rm__stats span {
        font-size: 11px;
        color: var(--op-ink-faint);
      }
      .rm__stats strong {
        font-size: 15px;
        color: var(--op-ink);
      }
      .rm__stats em {
        font-size: 11px;
        font-style: normal;
        color: var(--op-ink-dim);
      }
      .rm__verdict {
        margin: 0;
        font-size: 12.5px;
        font-weight: 700;
        color: var(--op-accent);
      }
      .rm__verdict.is-maybe {
        color: var(--op-warn);
      }
      .rm__verdict.is-short {
        color: #c0392b;
      }
      .rm__actions {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
      }
      .rm__btn {
        padding: 7px 12px;
        border: 1px solid var(--op-line);
        border-radius: 8px;
        background: var(--app-surface);
        color: var(--op-ink);
        font: inherit;
        font-size: 12.5px;
        font-weight: 700;
        cursor: pointer;
      }
      .rm__btn--pro {
        align-self: flex-start;
        border-color: #d97706;
        color: #b45309;
      }
    `,
  ],
})
export class OpRoadmapComponent {
  private readonly store = inject(FeasibilityStore);
  readonly type = input.required<string>();
  readonly typeName = input('');
  readonly wardSlug = input('');
  readonly wardName = input('');
  readonly text = input.required<OpText>();
  readonly lang = input<Lang>('vi');
  /** Plan adjustments for this ward (customers, rent multipliers); null = the user's figures as typed. */
  readonly factors = input<{ customers: number; rent: number } | null>(null);
  /** Premium is for sale and this visitor does not have it. */
  readonly locked = input(false);
  /** Whether the roadmap is unfolded (the panel's roadmap button opens it). */
  readonly open = model(false);
  /** The visitor asked to unlock the Premium part. */
  readonly upgrade = output<void>();

  protected readonly runwayMonths = RUNWAY_MONTHS;
  protected readonly s = computed(() => TEXT[this.lang()]);
  protected readonly start = signal(isoToday());
  protected readonly done = signal<ReadonlySet<StepId>>(new Set());
  protected readonly copied = signal(false);

  protected readonly view = computed(() => {
    const a = this.store.get(this.type());
    const fx = this.factors();
    const adjusted = fx ? { ...a, customers: Math.round(a.customers * fx.customers), rentPerM2: Math.round(a.rentPerM2 * fx.rent) } : a;
    return buildRoadmap(this.type(), adjusted, this.lang());
  });

  constructor() {
    // Saved progress belongs to Premium: loaded per shop type and ward, written on every tick.
    effect(() => {
      const key = storageKey(this.type(), this.wardSlug());
      const locked = this.locked();
      this.done.set(locked ? new Set() : this.read(key));
    }, { allowSignalWrites: true });
  }

  private read(key: string): Set<StepId> {
    try {
      const raw = JSON.parse(localStorage.getItem(key) ?? 'null') as { done?: StepId[]; start?: string } | null;
      if (raw?.start && /^\d{4}-\d{2}-\d{2}$/.test(raw.start)) this.start.set(raw.start);
      return new Set(Array.isArray(raw?.done) ? raw.done : []);
    } catch {
      return new Set();
    }
  }

  private persist(): void {
    if (this.locked()) return;
    try {
      localStorage.setItem(storageKey(this.type(), this.wardSlug()), JSON.stringify({ done: [...this.done()], start: this.start() }));
    } catch {
      // Storage may be blocked: the ticks still work for this visit.
    }
  }

  protected toggle(id: StepId): void {
    const next = new Set(this.done());
    if (!next.delete(id)) next.add(id);
    this.done.set(next);
    this.persist();
  }

  protected setStart(value: string): void {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return;
    this.start.set(value);
    this.persist();
  }

  private startDate(): Date {
    return new Date(`${this.start()}T00:00:00`);
  }

  protected date(offsetDays: number): string {
    const d = new Date(this.startDate().getTime() + offsetDays * 86_400_000);
    return d.toLocaleDateString(this.lang() === 'en' ? 'en-GB' : 'vi-VN');
  }

  protected money(v: number): string {
    const f = this.text().feas;
    const abs = Math.abs(v);
    const sign = v < 0 ? '−' : '';
    const num = (n: number, d: number) => n.toLocaleString(this.lang() === 'en' ? 'en-US' : 'vi-VN', { maximumFractionDigits: d });
    return abs >= 1e9 ? `${sign}${num(abs / 1e9, 2)} ${f.unitBillion}` : `${sign}${num(abs / 1e6, 1)} ${f.unitMillion}`;
  }

  protected range(r: [number, number]): string {
    return r[0] === r[1] ? this.money(r[0]) : `${this.money(r[0])} – ${this.money(r[1])}`;
  }

  private list(): string {
    return checklistText(this.view(), {
      title: `${this.s().title} · ${this.typeName()} · ${this.wardName()}`,
      start: this.startDate(),
      lang: this.lang(),
      money: (v) => this.money(v),
      done: this.done(),
    });
  }

  protected async copy(): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.list());
      this.copied.set(true);
      setTimeout(() => this.copied.set(false), 2_000);
    } catch {
      // Clipboard blocked: the download still works.
    }
  }

  protected download(): void {
    const url = URL.createObjectURL(new Blob([this.list()], { type: 'text/plain;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `lo-trinh-mo-quan-${this.type()}-${this.wardSlug() || 'ha-noi'}.txt`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5_000);
  }
}
