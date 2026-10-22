import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { LegalLinksComponent } from '../legal/legal-links.component';
import { Subscription } from 'rxjs';
import { AccountService, accountError } from '../../services/account.service';
import { BillingService, Order, Product } from '../../services/billing.service';

const vndFormat = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 });

/**
 * Premium and in-depth AI questions: what each plan gives, the signed-in user's allowances, and buying (the provider's
 * checkout opens in a new tab while this page polls the order — same flow as the report packs on the Opportunity Map).
 */
@Component({
  selector: 'app-premium',
  standalone: true,
  imports: [RouterLink, LegalLinksComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="pm">
      <header class="pm__hero">
        <p class="pm__eyebrow">Gói & lượt hỏi AI</p>
        <h1>Premium và lượt hỏi AI chuyên sâu</h1>
        <p class="pm__lead">
          Bản đồ, điểm số và câu trả lời cơ bản luôn miễn phí. Câu trả lời do AI phân tích sâu từ dữ liệu
          (Mở gì ở đâu, Hà Nội tương lai, Chấm điểm bất động sản, Điểm đáng sống, kể chuyện Hà Nội xưa và nay) dùng lượt hỏi AI.
        </p>
      </header>

      @if (account.user()) {
        <section class="pm__status" aria-labelledby="pm-status">
          <h2 id="pm-status">Tài khoản của bạn</h2>
          @if (billing.ai(); as ai) {
            <dl>
              <div>
                <dt>Gói</dt>
                <dd>
                  @if (ai.premium) {
                    <strong class="pm__badge">Premium</strong> đến {{ date(ai.premiumUntil) }}
                  } @else {
                    Miễn phí
                  }
                </dd>
              </div>
              <div>
                <dt>Lượt AI hôm nay</dt>
                <dd>
                  @if (ai.premium) {
                    {{ ai.premiumLeft }}/{{ ai.premiumPerDay }} Premium ·
                  }
                  {{ ai.freeLeft }}/{{ ai.freePerDay }} miễn phí
                </dd>
              </div>
              <div>
                <dt>Lượt kể chuyện Hà Nội xưa và nay hôm nay</dt>
                <dd>{{ ai.storyFreeLeft }}/{{ ai.storyFreePerDay }} miễn phí@if (ai.premium) { · hoặc dùng lượt Premium }</dd>
              </div>
              <div>
                <dt>Lượt AI đã mua</dt>
                <dd>{{ ai.aiCredits }}</dd>
              </div>
              <div>
                <dt>Credit báo cáo khả thi</dt>
                <dd>{{ billing.credits() ?? 0 }}</dd>
              </div>
            </dl>
          } @else {
            <p class="pm__muted">Đang tải…</p>
          }
        </section>
      }

      <section class="pm__plans" aria-labelledby="pm-plans">
        <h2 id="pm-plans" class="pm__sr">So sánh gói</h2>
        <article class="pm__plan">
          <h3>Miễn phí</h3>
          <p class="pm__price">0 đ</p>
          <ul>
            <li>Mọi bản đồ và điểm số hôm nay</li>
            <li>Xem thử mốc 2030 từng phường, 3 phường hợp kế hoạch nhất, so sánh 2 phường, theo dõi 3 mục</li>
            <li>Câu trả lời cơ bản (theo mẫu, từ dữ liệu) không giới hạn</li>
            <li><strong>{{ limits().freePerDay }} câu trả lời AI chuyên sâu mỗi ngày</strong> khi đăng nhập</li>
            <li>Thêm <strong>{{ limits().storyFreePerDay }} lượt AI kể chuyện mỗi ngày</strong> ở Hà Nội xưa và nay</li>
            <li>Lưu 5 báo cáo, mở trên mọi thiết bị</li>
            <li>La bàn nghề nghiệp: bảng hỏi, kết quả, thị trường, bản đồ ngành nghề, vùng đi làm và metro; 1 kế hoạch 30 ngày lưu trên trình duyệt</li>
          </ul>
          @if (!account.user()) {
            <button type="button" class="pm__btn" (click)="account.dialogOpen.set(true)">Đăng nhập miễn phí</button>
          }
        </article>

        <article class="pm__plan pm__plan--premium">
          <h3>Premium</h3>
          @if (premium()[0]; as p) {
            <p class="pm__price">{{ vnd(p.amountVnd) }} <small>/ {{ p.premiumDays }} ngày</small></p>
          }
          <ul>
            <li>Mọi thứ của gói Miễn phí</li>
            <li><strong>{{ limits().premiumPerDay }} câu trả lời AI chuyên sâu mỗi ngày</strong>, dùng chung cho cả 5 công cụ, kể cả Hà Nội xưa và nay</li>
            <li><strong>Mở gì ở đâu:</strong> mốc 2030 trên toàn bản đồ, danh sách đầy đủ theo kế hoạch, xuất CSV</li>
            <li><strong>Chấm điểm bất động sản:</strong> lớp quy hoạch 2030 và 2045, trọng số tuỳ chỉnh, so sánh tới 5 phường và xuất CSV, theo dõi không giới hạn</li>
            <li><strong>Báo cáo khả thi mang thương hiệu của bạn:</strong> tên công ty, liên hệ và lời nhắn trên bản PDF gửi khách (dành cho môi giới)</li>
            <li>Lưu tới 100 báo cáo, kèm ghi chú và thẻ cho từng báo cáo</li>
            <li><strong>La bàn nghề nghiệp:</strong> lưu kế hoạch vào tài khoản (tới 5 kế hoạch, mọi thiết bị), xuất PDF kế hoạch mang tên và liên hệ của bạn (cho tư vấn viên, trung tâm đào tạo), tìm nơi ở theo nơi làm</li>
            <li>Kèm credit báo cáo khả thi (xuất PDF) theo gói</li>
            <li>Mua thêm thì cộng dồn thời hạn</li>
          </ul>
          <div class="pm__buy">
            @for (p of premium(); track p.id) {
              <div class="pm__offer">
                <span>
                  <b>{{ p.name.vi }}</b>
                  <small>{{ vnd(p.amountVnd) }}@if (p.credits) { · kèm {{ p.credits }} credit báo cáo}</small>
                </span>
                <button type="button" class="pm__btn pm__btn--primary" [disabled]="!canBuy() || busy()" (click)="buy(p)">Mua</button>
              </div>
            }
          </div>
        </article>
      </section>

      <section class="pm__packs" aria-labelledby="pm-packs">
        <h2 id="pm-packs">Gói lượt hỏi AI</h2>
        <p class="pm__muted">Dùng sau khi hết lượt miễn phí (và lượt Premium) trong ngày. Không hết hạn.</p>
        <div class="pm__grid">
          @for (p of packs(); track p.id) {
            <div class="pm__pack">
              <b>{{ p.name.vi }}</b>
              <span class="pm__price">{{ vnd(p.amountVnd) }}</span>
              <small>{{ vnd(p.amountVnd / p.aiCredits) }} / lượt</small>
              <button type="button" class="pm__btn" [disabled]="!canBuy() || busy()" (click)="buy(p)">Mua</button>
            </div>
          }
        </div>
        <p class="pm__muted">
          Báo cáo khả thi chi tiết (dòng tiền 36 tháng, độ nhạy, PDF) mua theo credit ngay trong
          <a routerLink="/opportunity-map">Mở gì ở đâu</a>.
        </p>
      </section>

      @if (!billing.enabled()) {
        <p class="pm__msg is-error" role="status">Thanh toán chưa được bật trên máy chủ này.</p>
      } @else if (!account.user()) {
        <p class="pm__msg" role="status">
          Đăng nhập để mua gói.
          <button type="button" class="pm__btn" (click)="account.dialogOpen.set(true)">Đăng nhập</button>
        </p>
      }
      @if (waiting(); as o) {
        <p class="pm__msg" role="status">
          Đang chờ thanh toán đơn {{ o.orderCode }} ở tab vừa mở…
          <button type="button" class="pm__btn" (click)="cancel(o)">Huỷ</button>
        </p>
      }
      @if (message(); as m) {
        <p class="pm__msg" [class.is-error]="m.error" role="status">{{ m.text }}</p>
      }

      <p class="pm__note">
        Một lượt chỉ bị trừ khi câu trả lời thật sự do AI viết; nếu AI lỗi và hệ thống trả lời theo mẫu, lượt được
        hoàn lại. Lượt miễn phí và Premium tính theo ngày (giờ Việt Nam). Khi mua, bạn đồng ý với
        <a routerLink="/terms">Điều khoản</a> và <a routerLink="/refund">Chính sách hoàn tiền</a>.
      </p>
      <app-legal-links />
    </main>
  `,
  styles: `
    :host { display: block; min-height: 100%; background: var(--app-bg); color: var(--app-ink); font-family: 'Manrope', -apple-system, 'Segoe UI', sans-serif; line-height: 1.55; }
    .pm { max-width: 960px; margin: 0 auto; padding: 32px 16px 56px; display: grid; gap: 24px; }
    .pm__hero h1 { font-family: 'Fraunces', Georgia, serif; font-weight: 560; font-size: clamp(26px, 4.4vw, 40px); line-height: 1.15; margin: 4px 0 10px; }
    .pm__eyebrow { margin: 0; font-size: 12px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: var(--app-time); }
    .pm__lead { margin: 0; color: var(--app-ink-dim); max-width: 680px; }
    h2 { font-size: 18px; margin: 0 0 8px; }
    h3 { font-size: 18px; margin: 0; }
    .pm__sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }
    .pm__status, .pm__plan, .pm__pack { border: 1px solid var(--app-line); border-radius: 14px; background: var(--app-surface); }
    .pm__status { padding: 16px 18px; }
    .pm__status dl { display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 12px; margin: 0; }
    .pm__status dt { font-size: 12px; color: var(--app-ink-dim); }
    .pm__status dd { margin: 2px 0 0; font-weight: 700; }
    .pm__badge { display: inline-block; padding: 1px 8px; border-radius: 999px; background: var(--app-time); color: #fff; font-size: 12px; }
    .pm__plans { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 16px; }
    .pm__plan { padding: 20px; display: flex; flex-direction: column; gap: 10px; }
    .pm__plan--premium { border: 2px solid var(--app-time); background: linear-gradient(var(--app-time-soft), var(--app-surface) 60%); }
    .pm__plan ul { margin: 0; padding-left: 18px; display: grid; gap: 4px; font-size: 14px; }
    .pm__price { margin: 0; font-size: 26px; font-weight: 800; }
    .pm__price small { font-size: 13px; font-weight: 600; color: var(--app-ink-dim); }
    .pm__buy { display: grid; gap: 8px; margin-top: auto; }
    .pm__offer { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 10px 12px; border: 1px solid var(--app-line); border-radius: 10px; background: var(--app-surface); }
    .pm__offer span { display: grid; }
    .pm__offer small, .pm__pack small { color: var(--app-ink-dim); font-size: 12px; }
    .pm__grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px; margin: 10px 0; }
    .pm__pack { padding: 14px 16px; display: flex; flex-direction: column; gap: 4px; }
    .pm__pack .pm__btn { align-self: flex-start; margin-top: 6px; }
    .pm__btn { display: inline-flex; align-items: center; justify-content: center; padding: 8px 14px; border: 1px solid var(--app-line); border-radius: 999px; background: var(--app-surface); color: inherit; font: inherit; font-size: 14px; font-weight: 700; cursor: pointer; min-height: 40px; }
    .pm__btn--primary { border-color: transparent; background: var(--app-time); color: #fff; }
    .pm__btn[disabled] { opacity: 0.55; cursor: default; }
    .pm__btn:focus-visible { outline: 2px solid var(--app-time); outline-offset: 2px; }
    .pm__muted { color: var(--app-ink-dim); font-size: 14px; margin: 0; }
    .pm__muted a { color: var(--app-time); font-weight: 700; }
    .pm__msg { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 12px; margin: 0; padding: 12px 14px; border-radius: 10px; background: var(--app-time-soft); font-weight: 600; }
    .pm__msg.is-error { background: var(--app-biz-soft); color: var(--app-biz); }
    .pm__note { font-size: 12.5px; color: var(--app-ink-faint); margin: 0; }
  `,
})
export class PremiumComponent {
  protected readonly account = inject(AccountService);
  protected readonly billing = inject(BillingService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly premium = this.billing.premiumProducts;
  protected readonly packs = this.billing.aiProducts;
  protected readonly limits = this.billing.aiLimits;
  protected readonly canBuy = computed(() => this.billing.enabled() && !!this.account.user());

  protected readonly busy = signal(false);
  protected readonly waiting = signal<Order | null>(null);
  protected readonly message = signal<{ text: string; error: boolean } | null>(null);
  private poll?: Subscription;

  constructor() {
    this.billing.refresh();
    this.destroyRef.onDestroy(() => this.poll?.unsubscribe());
  }

  protected vnd(v: number): string {
    return `${vndFormat.format(Math.round(v))} đ`;
  }

  protected date(iso: string | null): string {
    return iso ? new Date(iso).toLocaleDateString('vi-VN', { day: 'numeric', month: 'numeric', year: 'numeric' }) : '';
  }

  protected buy(product: Product): void {
    if (this.busy() || !this.canBuy()) return;
    // Opened now, while the click still counts as the user's, so the browser does not block it later.
    const tab = window.open('', '_blank');
    if (!tab) {
      this.message.set({ text: 'Trình duyệt đã chặn tab thanh toán — hãy cho phép cửa sổ bật lên rồi thử lại.', error: true });
      return;
    }
    tab.opener = null;
    this.busy.set(true);
    this.message.set(null);
    this.billing
      .checkout(product.id, location.href)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ order, checkoutUrl }) => {
          this.busy.set(false);
          tab.location.href = checkoutUrl;
          this.watch(order);
        },
        error: (e) => {
          this.busy.set(false);
          tab.close();
          this.message.set({ text: accountError(e), error: true });
        },
      });
  }

  protected cancel(order: Order): void {
    this.billing.cancel(order.id).subscribe({ next: ({ order: o }) => this.settle(o), error: (e) => this.message.set({ text: accountError(e), error: true }) });
  }

  private watch(order: Order): void {
    this.poll?.unsubscribe();
    this.waiting.set(order);
    this.poll = this.billing.watch(order.id).subscribe((o) => this.settle(o));
  }

  private settle(order: Order): void {
    this.poll?.unsubscribe();
    this.waiting.set(null);
    if (order.status === 'paid') {
      const g = order.grants;
      const parts = [
        g?.premiumDays ? `${g.premiumDays} ngày Premium` : '',
        g?.aiCredits ? `${g.aiCredits} lượt hỏi AI` : '',
        g?.reportCredits ? `${g.reportCredits} credit báo cáo` : '',
      ].filter(Boolean);
      this.message.set({ text: `Thanh toán thành công — đã cộng ${parts.join(', ') || 'gói đã mua'}.`, error: false });
      this.billing.refresh();
    } else {
      this.message.set({ text: order.status === 'cancelled' ? 'Đã huỷ thanh toán.' : 'Đơn đã hết hạn — bạn có thể mua lại.', error: true });
    }
  }
}
