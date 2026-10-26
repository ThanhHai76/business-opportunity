import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { FEEDBACK_API_URL } from '../../config';

export type ReportLang = 'vi' | 'en';

const TEXT = {
  vi: {
    open: 'Báo sai số liệu',
    title: (name: string) => `Báo sai số liệu: ${name}`,
    what: 'Số liệu nào sai, và đúng là gì? Nếu có, hãy ghi nguồn (đường dẫn hoặc tên văn bản).',
    contact: 'Email hoặc số điện thoại, nếu bạn muốn được báo lại (không bắt buộc)',
    send: 'Gửi báo cáo',
    sending: 'Đang gửi…',
    cancel: 'Đóng',
    thanks: 'Cảm ơn bạn. Chúng tôi sẽ kiểm tra và sửa nếu số liệu sai.',
    tooShort: 'Hãy mô tả số liệu sai bằng ít nhất 10 ký tự.',
    tooMany: 'Bạn đã gửi nhiều báo cáo trong thời gian ngắn. Hãy thử lại sau.',
    failed: 'Chưa gửi được. Hãy thử lại sau.',
    counter: (n: number) => `${n}/1000`,
    trap: 'Để trống ô này',
  },
  en: {
    open: 'Report a data error',
    title: (name: string) => `Report a data error: ${name}`,
    what: 'Which figure is wrong, and what is right? If you can, add the source (a link or the name of the document).',
    contact: 'Email or phone, if you would like a reply (optional)',
    send: 'Send report',
    sending: 'Sending…',
    cancel: 'Close',
    thanks: 'Thank you. We will check it and correct the figure if it is wrong.',
    tooShort: 'Please describe the wrong figure in at least 10 characters.',
    tooMany: 'You have sent several reports in a short time. Please try again later.',
    failed: 'Could not send it. Please try again later.',
    counter: (n: number) => `${n}/1000`,
    trap: 'Leave this field empty',
  },
} as const;

/**
 * "Báo sai số liệu": a visitor tells us a figure about a ward or a source is wrong. A small button that opens a short
 * form under it; the report goes to POST /api/feedback/data-report (src/feedback in the backend), no account needed.
 * The form closes and clears when the ward or source it is about changes.
 */
@Component({
  selector: 'app-report-issue',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="ri" [class.ri--compact]="compact()">
      @if (!open()) {
        <button type="button" class="ri__open" aria-haspopup="true" (click)="open.set(true)">
          <span aria-hidden="true">⚑</span> {{ tx().open }}
        </button>
      } @else {
        <form class="ri__form" (submit)="submit($event)" [attr.aria-label]="tx().title(targetName() || target())">
          <p class="ri__title">{{ tx().title(targetName() || target()) }}</p>
          @if (state() === 'sent') {
            <p class="ri__ok" role="status">{{ tx().thanks }}</p>
            <button type="button" class="ri__btn" (click)="close()">{{ tx().cancel }}</button>
          } @else {
            <label class="ri__field">
              <span>{{ tx().what }}</span>
              <textarea name="message" rows="4" maxlength="1000" [value]="message()" (input)="message.set($any($event.target).value)"></textarea>
              <small>{{ tx().counter(message().length) }}</small>
            </label>
            <label class="ri__field">
              <span>{{ tx().contact }}</span>
              <input name="contact" maxlength="120" autocomplete="email" [value]="contact()" (input)="contact.set($any($event.target).value)" />
            </label>
            <!-- A trap for bots: people never see or fill this -->
            <label class="ri__trap" aria-hidden="true">{{ tx().trap }}<input name="website" tabindex="-1" autocomplete="off" [value]="website()" (input)="website.set($any($event.target).value)" /></label>
            @if (error(); as e) {
              <p class="ri__err" role="alert">{{ e }}</p>
            }
            <div class="ri__row">
              <button type="submit" class="ri__btn ri__btn--primary" [disabled]="state() === 'sending'">{{ state() === 'sending' ? tx().sending : tx().send }}</button>
              <button type="button" class="ri__btn" (click)="close()">{{ tx().cancel }}</button>
            </div>
          }
        </form>
      }
    </div>
  `,
  styles: `
    :host { display: block; }
    .ri { margin-top: 6px; font-size: 13px; }
    .ri__open { padding: 4px 0; border: 0; background: none; color: var(--app-ink-dim, #6b7280); font: inherit; font-size: 12.5px; cursor: pointer; text-decoration: underline; text-underline-offset: 2px; }
    .ri__open:hover { color: var(--app-career, var(--op-accent, #0f766e)); }
    .ri__open:focus-visible, .ri__btn:focus-visible, .ri textarea:focus-visible, .ri input:focus-visible { outline: 2px solid var(--app-career, var(--op-accent, #0f766e)); outline-offset: 2px; }
    .ri__form { display: grid; gap: 8px; padding: 10px 12px; border: 1px solid var(--app-line, var(--op-line, #d1d5db)); border-radius: 10px; background: var(--app-surface-2, transparent); color: var(--app-ink, inherit); }
    .ri__title { margin: 0; font-weight: 700; }
    .ri__field { display: grid; gap: 4px; }
    .ri__field span { color: var(--app-ink-dim, #6b7280); }
    .ri__field small { justify-self: end; color: var(--app-ink-dim, #6b7280); }
    .ri textarea, .ri input { width: 100%; box-sizing: border-box; padding: 7px 9px; border: 1px solid var(--app-line, var(--op-line, #d1d5db)); border-radius: 8px; background: var(--app-surface, #fff); color: inherit; font: inherit; resize: vertical; }
    .ri__trap { position: absolute; left: -9999px; width: 1px; height: 1px; overflow: hidden; }
    .ri__row { display: flex; flex-wrap: wrap; gap: 8px; }
    .ri__btn { padding: 7px 14px; min-height: 36px; border: 1px solid var(--app-line, #d1d5db); border-radius: 999px; background: transparent; color: inherit; font: inherit; font-weight: 600; cursor: pointer; }
    .ri__btn--primary { border-color: var(--app-career, var(--op-accent, #0f766e)); background: var(--app-career, var(--op-accent, #0f766e)); color: #fff; }
    .ri__btn[disabled] { opacity: 0.6; cursor: progress; }
    .ri__ok { margin: 0; color: var(--app-career, #0f766e); font-weight: 600; }
    .ri__err { margin: 0; color: #b91c1c; }
  `,
})
export class ReportIssueComponent {
  private readonly http = inject(HttpClient);

  /** What the report is about: a ward (its slug) or a source (its id). */
  readonly kind = input.required<'ward' | 'source'>();
  readonly target = input.required<string>();
  readonly targetName = input<string>('');
  /** The page it was sent from (opportunity, career…). */
  readonly page = input<string>('');
  readonly lang = input<ReportLang>('vi');
  /** Smaller, for use inside a list. */
  readonly compact = input(false);

  protected readonly tx = computed(() => TEXT[this.lang()]);
  protected readonly open = signal(false);
  protected readonly message = signal('');
  protected readonly contact = signal('');
  protected readonly website = signal('');
  protected readonly state = signal<'idle' | 'sending' | 'sent'>('idle');
  protected readonly error = signal<string | null>(null);

  constructor() {
    // Another ward or source: start again.
    effect(() => {
      this.kind();
      this.target();
      untracked(() => this.reset());
    });
  }

  private reset(): void {
    this.open.set(false);
    this.message.set('');
    this.contact.set('');
    this.website.set('');
    this.state.set('idle');
    this.error.set(null);
  }

  protected close(): void {
    this.reset();
  }

  protected submit(event: Event): void {
    event.preventDefault();
    if (this.state() === 'sending') return;
    const message = this.message().trim();
    if (message.length < 10) {
      this.error.set(this.tx().tooShort);
      return;
    }
    this.error.set(null);
    this.state.set('sending');
    const contact = this.contact().trim();
    const name = this.targetName().trim();
    const page = this.page().trim();
    this.http
      .post(`${FEEDBACK_API_URL}/data-report`, {
        kind: this.kind(),
        target: this.target(),
        ...(name ? { targetName: name.slice(0, 120) } : {}),
        ...(page ? { page } : {}),
        message,
        ...(contact ? { contact } : {}),
        ...(this.website() ? { website: this.website() } : {}),
      })
      .subscribe({
        next: () => this.state.set('sent'),
        error: (e: unknown) => {
          this.state.set('idle');
          const status = e instanceof HttpErrorResponse ? e.status : 0;
          this.error.set(status === 429 ? this.tx().tooMany : status === 400 ? this.tx().tooShort : this.tx().failed);
        },
      });
  }
}
