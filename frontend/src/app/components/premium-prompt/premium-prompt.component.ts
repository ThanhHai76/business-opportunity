import { ChangeDetectionStrategy, Component, HostListener, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { AccountService } from '../../services/account.service';
import { BillingService } from '../../services/billing.service';
import { PremiumPromptService } from '../../services/premium-prompt.service';

const TEXT = {
  vi: {
    title: 'Tính năng Premium',
    body: 'dành cho tài khoản Premium.',
    perks: ['Mốc 2030 trên toàn bản đồ Mở gì ở đâu, kế hoạch đầy đủ và xuất CSV', 'Lớp quy hoạch 2030 và 2045, trọng số tuỳ chỉnh, so sánh tới 5 phường, theo dõi không giới hạn', 'Báo cáo PDF mang tên và liên hệ của bạn, lưu tới 100 báo cáo kèm ghi chú', 'La bàn nghề nghiệp: lưu tới 5 kế hoạch trong tài khoản, xuất PDF, tìm nơi ở theo nơi làm', 'Nhiều lượt hỏi AI chuyên sâu mỗi ngày'],
    from: (price: string, days: number) => `Từ ${price} cho ${days} ngày.`,
    see: 'Xem gói Premium',
    later: 'Để sau',
    signin: 'Đã có Premium? Đăng nhập',
    close: 'Đóng',
  },
  en: {
    title: 'Premium feature',
    body: 'is for Premium accounts.',
    perks: ['The 2030 horizon on the whole What to Open Where map, the full plan and CSV export', 'The 2030 and 2045 planning layers, custom weights, comparing up to 5 wards, an unlimited watchlist', 'PDF reports with your own name and contact, up to 100 saved reports with notes', 'Career compass: up to 5 plans kept in your account, PDF export, finding where to live for your work', 'More in-depth AI questions a day'],
    from: (price: string, days: number) => `From ${price} for ${days} days.`,
    see: 'See Premium',
    later: 'Not now',
    signin: 'Already Premium? Sign in',
    close: 'Close',
  },
};

/** The upgrade prompt opened by PremiumPromptService when a visitor reaches for a Premium feature. */
@Component({
  selector: 'app-premium-prompt',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (prompt.ask(); as a) {
      <div class="pp-backdrop" (click)="prompt.close()"></div>
      <div class="pp" role="dialog" aria-modal="true" aria-labelledby="pp-title">
        <div class="pp__head">
          <h2 id="pp-title"><span aria-hidden="true">★</span> {{ tx().title }}</h2>
          <button type="button" class="pp__x" (click)="prompt.close()" [attr.aria-label]="tx().close">✕</button>
        </div>
        <p class="pp__lead"><strong>{{ a.feature }}</strong> {{ tx().body }}</p>
        <ul class="pp__perks">
          @for (p of tx().perks; track p) {
            <li>{{ p }}</li>
          }
        </ul>
        @if (cheapest(); as c) {
          <p class="pp__price">{{ tx().from(c.price, c.days) }}</p>
        }
        <div class="pp__actions">
          <button type="button" class="pp__btn pp__btn--primary" (click)="seePremium()">{{ tx().see }}</button>
          <button type="button" class="pp__btn" (click)="prompt.close()">{{ tx().later }}</button>
        </div>
        @if (!account.user()) {
          <button type="button" class="pp__link" (click)="signIn()">{{ tx().signin }}</button>
        }
      </div>
    }
  `,
  styles: [
    `
      :host {
        display: contents;
      }
      .pp-backdrop {
        position: fixed;
        inset: 0;
        z-index: 1400;
        background: rgba(10, 8, 5, 0.45);
      }
      .pp {
        position: fixed;
        z-index: 1401;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        width: min(420px, calc(100vw - 32px));
        max-height: calc(100dvh - 32px);
        overflow-y: auto;
        display: grid;
        gap: 12px;
        padding: 20px;
        border: 1px solid var(--app-line);
        border-radius: 16px;
        background: var(--app-surface);
        color: var(--app-ink);
        box-shadow: var(--app-shadow);
        font: 14px/1.45 'Manrope', -apple-system, 'Segoe UI', sans-serif;
      }
      .pp__head {
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
      h2 {
        margin: 0;
        font-size: 18px;
      }
      h2 span {
        color: #d97706;
      }
      .pp__x {
        width: 32px;
        height: 32px;
        border: 0;
        border-radius: 8px;
        background: transparent;
        color: var(--app-ink-dim);
        cursor: pointer;
      }
      .pp__x:hover {
        background: var(--app-surface-2);
      }
      .pp__lead,
      .pp__price {
        margin: 0;
      }
      .pp__price {
        color: var(--app-ink-dim);
        font-size: 13px;
      }
      .pp__perks {
        margin: 0;
        padding-left: 18px;
        display: grid;
        gap: 4px;
        color: var(--app-ink-dim);
        font-size: 13px;
      }
      .pp__actions {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
      }
      .pp__btn {
        padding: 9px 14px;
        border: 1px solid var(--app-line);
        border-radius: 10px;
        background: var(--app-surface);
        color: var(--app-ink);
        font: inherit;
        font-weight: 700;
        cursor: pointer;
      }
      .pp__btn--primary {
        border-color: transparent;
        background: var(--app-biz);
        color: #fff;
      }
      .pp__link {
        justify-self: start;
        padding: 0;
        border: 0;
        background: none;
        color: var(--app-biz);
        font: inherit;
        font-size: 13px;
        font-weight: 700;
        cursor: pointer;
      }
    `,
  ],
})
export class PremiumPromptComponent {
  protected readonly prompt = inject(PremiumPromptService);
  protected readonly account = inject(AccountService);
  private readonly billing = inject(BillingService);
  private readonly router = inject(Router);

  protected readonly tx = computed(() => TEXT[this.prompt.ask()?.lang ?? 'vi']);
  /** The cheapest Premium plan, for the "from ... for ... days" line. */
  protected readonly cheapest = computed(() => {
    const lang = this.prompt.ask()?.lang ?? 'vi';
    const plan = [...this.billing.premiumProducts()].sort((a, b) => a.amountVnd - b.amountVnd)[0];
    if (!plan) return null;
    const price = plan.amountVnd.toLocaleString(lang === 'vi' ? 'vi-VN' : 'en-US') + ' ₫';
    return { price, days: plan.premiumDays };
  });

  /** Esc closes the prompt only, not the page's own panels underneath (their listeners come after this one). */
  @HostListener('document:keydown.escape', ['$event'])
  protected onEscape(event: Event): void {
    if (!this.prompt.ask()) return;
    event.stopImmediatePropagation();
    this.prompt.close();
  }

  protected seePremium(): void {
    this.prompt.close();
    void this.router.navigateByUrl('/premium');
  }

  protected signIn(): void {
    this.prompt.close();
    this.account.dialogOpen.set(true);
  }
}
