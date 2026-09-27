import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, ViewChild, effect, inject, input, output, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { IconComponent } from '../../living-score/components/icon/icon.component';
import { CopilotAnswer } from '../bc.models';
import { BcApiService, BcStateService, describeError } from '../bc.service';
import { BcBarComponent } from './bc-charts';

interface Turn {
  id: number;
  question: string;
  answer?: CopilotAnswer;
  error?: string;
}

const EXAMPLES = [
  'Where should I open a coffee shop with 500M?',
  'Quận nào có ít cạnh tranh nhất?',
  'So sánh Cầu Giấy và Hà Đông',
  'Tìm khu vực phù hợp cho nhà hàng cao cấp',
  'Ở Tây Hồ nên kinh doanh gì?',
];

/** The Hanoi Business Copilot conversation. Used full-page and in the side drawer. */
@Component({
  selector: 'bc-copilot-chat',
  standalone: true,
  imports: [IconComponent, RouterLink, BcBarComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="cc" [class.cc--compact]="compact()">
      <header class="cc-head">
        <span class="cc-mark" aria-hidden="true"><ls-icon name="sparkles" [size]="18" /></span>
        <div>
          <h2>Hanoi Business Copilot</h2>
          <p>Hỏi về khu vực, đối thủ, chi phí — trả lời từ dữ liệu demo</p>
        </div>
        @if (compact()) {
          <button type="button" class="cc-x" (click)="closed.emit()" aria-label="Đóng"><ls-icon name="x" [size]="16" /></button>
        }
      </header>

      <div class="cc-body" #body aria-live="polite">
        @if (turns().length === 0) {
          <div class="cc-empty">
            <p class="bc-eyebrow">Gợi ý câu hỏi</p>
            @for (q of examples; track q) {
              <button type="button" class="cc-example" (click)="ask(q)"><ls-icon name="message" [size]="14" /> {{ q }}</button>
            }
          </div>
        }
        @for (t of turns(); track t.id) {
          <div class="cc-q">{{ t.question }}</div>
          @if (t.answer; as a) {
            <article class="cc-a">
              <p class="cc-summary">{{ a.answer.summary }}</p>
              <section>
                <h3><ls-icon name="check" [size]="14" /> Khuyến nghị</h3>
                <p>{{ a.answer.recommendation }}</p>
              </section>
              @if (a.answer.evidence.length) {
                <section>
                  <h3><ls-icon name="info" [size]="14" /> Bằng chứng</h3>
                  <ul>@for (e of a.answer.evidence; track e) { <li>{{ e }}</li> }</ul>
                </section>
              }
              @if (a.scores.length) {
                <section>
                  <h3><ls-icon name="chart" [size]="14" /> Điểm</h3>
                  <div class="cc-scores">
                    @for (s of a.scores.slice(0, 7); track s.label) {
                      <span class="cc-score__label">{{ s.label }}</span>
                      <bc-bar [value]="s.value" />
                      <b>{{ s.value }}</b>
                    }
                  </div>
                </section>
              }
              @if (a.answer.risks.length) {
                <section>
                  <h3><ls-icon name="alert" [size]="14" /> Rủi ro</h3>
                  <ul>@for (r of a.answer.risks; track r) { <li>{{ r }}</li> }</ul>
                </section>
              }
              @if (a.answer.nextActions.length) {
                <section>
                  <h3><ls-icon name="arrow-right" [size]="14" /> Bước tiếp theo</h3>
                  <ul>@for (n of a.answer.nextActions; track n) { <li>{{ n }}</li> }</ul>
                </section>
              }
              @if (a.locations.length) {
                <div class="cc-links">
                  @for (slug of a.locations; track slug) {
                    <a class="bc-chip" [routerLink]="['/business-copilot/location', slug]" (click)="closed.emit()">{{ nameOf(slug) }} →</a>
                  }
                </div>
              }
              <footer>
                {{ a.provider === 'mock' ? 'Trả lời theo quy tắc (mock AI)' : 'AI: ' + (a.model ?? a.provider) }} · Dữ liệu demo / ước tính
                @if (a.notice) { · {{ a.notice }} }
              </footer>
            </article>
          } @else if (t.error) {
            <div class="cc-a cc-a--error" role="alert">{{ t.error }}</div>
          } @else {
            <div class="cc-a cc-thinking"><span class="bc-spinner"></span> Đang phân tích Hà Nội…</div>
          }
        }
      </div>

      <form class="cc-input" (submit)="$event.preventDefault(); ask(draft())">
        <input
          type="text"
          [value]="draft()"
          (input)="draft.set($any($event.target).value)"
          placeholder="Hỏi Copilot, ví dụ: So sánh Cầu Giấy và Tây Hồ"
          aria-label="Câu hỏi cho Copilot"
          maxlength="600"
        />
        <button type="submit" class="bc-btn bc-btn--primary" [disabled]="!draft().trim() || busy()" aria-label="Gửi"><ls-icon name="send" [size]="15" /></button>
      </form>
    </div>
  `,
  styles: [
    `
      :host{display:flex;flex-direction:column;min-height:0;height:100%}
      .cc{display:flex;flex-direction:column;height:100%;min-height:0}
      .cc-head{display:flex;align-items:center;gap:10px;padding:14px 16px;border-bottom:1px solid var(--bc-line)}
      .cc-head>div{flex:1;min-width:0}
      .cc-head h2{font-size:15px;font-weight:800}
      .cc-head p{font-size:12px;color:var(--bc-faint)}
      .cc-mark{display:grid;place-items:center;width:34px;height:34px;border-radius:10px;color:#fff;background:linear-gradient(135deg,#2563eb,#7c3aed)}
      .cc-x{display:grid;place-items:center;width:30px;height:30px;border-radius:8px;border:1px solid var(--bc-line);background:none}
      .cc-body{flex:1;min-height:0;overflow-y:auto;padding:16px;display:flex;flex-direction:column;gap:10px}
      .cc-empty{display:grid;gap:8px}
      .cc-example{display:flex;align-items:center;gap:8px;padding:10px 12px;text-align:left;border:1px solid var(--bc-line);border-radius:12px;background:var(--bc-surface-2);font-size:13px;font-weight:600}
      .cc-example:hover{border-color:var(--bc-accent)}
      .cc-q{align-self:flex-end;max-width:85%;padding:9px 13px;border-radius:14px 14px 4px 14px;background:var(--bc-accent);color:#fff;font-size:13.5px}
      .cc-a{align-self:stretch;display:grid;gap:10px;padding:13px 14px;border-radius:14px 14px 14px 4px;border:1px solid var(--bc-line);background:var(--bc-surface-2);font-size:13px}
      .cc-a--error{color:var(--bc-bad)}
      .cc-thinking{display:flex;align-items:center;gap:10px;color:var(--bc-dim)}
      .cc-summary{font-weight:700;font-size:13.5px}
      .cc-a h3{display:flex;align-items:center;gap:6px;font:700 10px/1.3 var(--bc-mono);letter-spacing:.1em;text-transform:uppercase;color:var(--bc-accent);margin-bottom:4px}
      .cc-a ul{margin:0;padding-left:17px;display:grid;gap:3px;color:var(--bc-dim)}
      .cc-a section>p{color:var(--bc-dim)}
      .cc-scores{display:grid;grid-template-columns:minmax(80px,auto) 1fr 28px;align-items:center;gap:6px 10px}
      .cc-scores b{text-align:right;font-variant-numeric:tabular-nums}
      .cc-score__label{font-size:12px;color:var(--bc-dim)}
      .cc-links{display:flex;flex-wrap:wrap;gap:6px}
      .cc-a footer{font-size:11px;color:var(--bc-faint)}
      .cc-input{display:flex;gap:8px;padding:12px 16px;border-top:1px solid var(--bc-line)}
      .cc-input input{flex:1;min-width:0;height:40px;padding:0 12px;border:1px solid var(--bc-line);border-radius:10px;background:var(--bc-surface);color:var(--bc-ink)}
      .cc-input .bc-btn{height:40px;width:44px;padding:0}
    `,
  ],
})
export class BcCopilotChatComponent {
  private readonly api = inject(BcApiService);
  private readonly state = inject(BcStateService);
  private readonly destroyRef = inject(DestroyRef);
  @ViewChild('body') private body?: ElementRef<HTMLDivElement>;

  readonly compact = input(false);
  readonly closed = output<void>();

  protected readonly examples = EXAMPLES;
  protected readonly turns = signal<Turn[]>([]);
  protected readonly draft = signal('');
  protected readonly busy = signal(false);
  private id = 0;

  private static readonly NAMES: Record<string, string> = {
    'cau-giay': 'Cầu Giấy', 'ha-dong': 'Hà Đông', 'tay-ho': 'Tây Hồ', 'hoan-kiem': 'Hoàn Kiếm', 'dong-da': 'Đống Đa',
    'thanh-xuan': 'Thanh Xuân', 'hai-ba-trung': 'Hai Bà Trưng', 'gia-lam': 'Gia Lâm', 'long-bien': 'Long Biên', 'nam-tu-liem': 'Nam Từ Liêm',
  };

  constructor() {
    effect(() => {
      const seed = this.state.copilotSeed();
      if (!seed) return;
      untracked(() => {
        this.state.copilotSeed.set(null);
        this.ask(seed);
      });
    });
  }

  protected nameOf(slug: string): string {
    return BcCopilotChatComponent.NAMES[slug] ?? slug;
  }

  protected ask(question: string): void {
    const q = question.trim();
    if (!q || this.busy()) return;
    const id = ++this.id;
    this.turns.update((t) => [...t, { id, question: q }]);
    this.draft.set('');
    this.busy.set(true);
    this.scroll();
    this.api
      .ask(q, { category: this.state.category(), budgetVnd: this.state.budgetVnd(), location: this.state.selected() ?? undefined })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (answer) => this.finish(id, { answer }),
        error: (e: unknown) => this.finish(id, { error: describeError(e) }),
      });
  }

  private finish(id: number, patch: Partial<Turn>): void {
    this.turns.update((list) => list.map((t) => (t.id === id ? { ...t, ...patch } : t)));
    this.busy.set(false);
    this.scroll();
  }

  private scroll(): void {
    queueMicrotask(() => setTimeout(() => this.body?.nativeElement.scrollTo({ top: this.body.nativeElement.scrollHeight, behavior: 'smooth' })));
  }
}
