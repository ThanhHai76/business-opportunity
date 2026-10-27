import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { LegalLinksComponent } from '../legal/legal-links.component';
import { Subscription } from 'rxjs';
import { AccountService, accountError } from '../../services/account.service';
import { BillingService, Order, Product } from '../../services/billing.service';
import { SiteLangService } from '../../services/site-lang.service';
import { PREMIUM_TEXT } from './premium.i18n';

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
        <p class="pm__eyebrow">{{ tx().eyebrow }}</p>
        <h1>{{ tx().title }}</h1>
        <p class="pm__lead">{{ tx().lead }}</p>
      </header>

      @if (account.user()) {
        <section class="pm__status" aria-labelledby="pm-status">
          <h2 id="pm-status">{{ tx().yourAccount }}</h2>
          @if (billing.ai(); as ai) {
            <dl>
              <div>
                <dt>{{ tx().plan }}</dt>
                <dd>
                  @if (ai.premium) {
                    <strong class="pm__badge">Premium</strong> {{ tx().until }} {{ date(ai.premiumUntil) }}
                  } @else {
                    {{ tx().free }}
                  }
                </dd>
              </div>
              <div>
                <dt>{{ tx().aiToday }}</dt>
                <dd>
                  @if (ai.premium) {
                    {{ ai.premiumLeft }}/{{ ai.premiumPerDay }} {{ tx().premiumSuffix }}
                  }
                  {{ ai.freeLeft }}/{{ ai.freePerDay }} {{ tx().freeSuffix }}
                </dd>
              </div>
              <div>
                <dt>{{ tx().storyToday }}</dt>
                <dd>{{ ai.storyFreeLeft }}/{{ ai.storyFreePerDay }} {{ tx().freeSuffix }}@if (ai.premium) { {{ tx().orPremium }} }</dd>
              </div>
              <div>
                <dt>{{ tx().bought }}</dt>
                <dd>{{ ai.aiCredits }}</dd>
              </div>
              <div>
                <dt>{{ tx().creditsReport }}</dt>
                <dd>{{ billing.credits() ?? 0 }}</dd>
              </div>
            </dl>
          } @else {
            <p class="pm__muted">{{ tx().loading }}</p>
          }
        </section>
      }

      <section class="pm__plans" aria-labelledby="pm-plans">
        <h2 id="pm-plans" class="pm__sr">{{ tx().compare }}</h2>
        <article class="pm__plan">
          <h3>{{ tx().freeTitle }}</h3>
          <p class="pm__price">{{ vnd(0) }}</p>
          <ul>
            @for (f of tx().freeFeatures; track f) {
              <li>{{ f }}</li>
            }
            <li><strong>{{ tx().freeDaily(limits().freePerDay) }}</strong></li>
            <li><strong>{{ tx().freeStory(limits().storyFreePerDay) }}</strong></li>
            @for (f of tx().freeTail; track f) {
              <li>{{ f }}</li>
            }
          </ul>
          @if (!account.user()) {
            <button type="button" class="pm__btn" (click)="account.dialogOpen.set(true)">{{ tx().signInFree }}</button>
          }
        </article>

        <article class="pm__plan pm__plan--premium">
          <h3>Premium</h3>
          @if (premium()[0]; as p) {
            <p class="pm__price">{{ vnd(p.amountVnd) }} <small>{{ tx().perDays(p.premiumDays) }}</small></p>
          }
          <ul>
            <li>{{ tx().premiumPre }}</li>
            <li><strong>{{ tx().premiumDaily(limits().premiumPerDay) }}</strong></li>
            <li><strong>{{ tx().premiumFeatures.bizLabel }}</strong> {{ tx().premiumFeatures.biz }}</li>
            <li><strong>{{ tx().premiumFeatures.propLabel }}</strong> {{ tx().premiumFeatures.prop }}</li>
            <li><strong>{{ tx().premiumFeatures.brandLabel }}</strong> {{ tx().premiumFeatures.brand }}</li>
            <li>{{ tx().premiumFeatures.save }}</li>
            <li><strong>{{ tx().premiumFeatures.careerLabel }}</strong> {{ tx().premiumFeatures.career }}</li>
            <li>{{ tx().premiumFeatures.credits }}</li>
            <li>{{ tx().premiumFeatures.extend }}</li>
          </ul>
          <div class="pm__buy">
            @for (p of premium(); track p.id) {
              <div class="pm__offer">
                <span>
                  <b>{{ p.name[lang()] }}</b>
                  <small>{{ vnd(p.amountVnd) }}@if (p.credits) {{{ tx().withCredits(p.credits) }}}</small>
                </span>
                <button type="button" class="pm__btn pm__btn--primary" [disabled]="!canBuy() || busy()" (click)="buy(p)">{{ tx().buy }}</button>
              </div>
            }
          </div>
        </article>
      </section>

      <section class="pm__packs" aria-labelledby="pm-packs">
        <h2 id="pm-packs">{{ tx().packsTitle }}</h2>
        <p class="pm__muted">{{ tx().packsHint }}</p>
        <div class="pm__grid">
          @for (p of packs(); track p.id) {
            <div class="pm__pack">
              <b>{{ p.name[lang()] }}</b>
              <span class="pm__price">{{ vnd(p.amountVnd) }}</span>
              <small>{{ vnd(p.amountVnd / p.aiCredits) }} {{ tx().perQuestion }}</small>
              <button type="button" class="pm__btn" [disabled]="!canBuy() || busy()" (click)="buy(p)">{{ tx().buy }}</button>
            </div>
          }
        </div>
        <p class="pm__muted">
          {{ lang() === 'en' ? 'Detailed feasibility reports (36-month cash flow, sensitivity, PDF) are bought with credits right in the' : 'Báo cáo khả thi chi tiết (dòng tiền 36 tháng, độ nhạy, PDF) mua theo credit ngay trong' }}
          <a routerLink="/opportunity-map">{{ tx().reportsLink }}</a>.
        </p>
      </section>

      @if (!billing.enabled()) {
        <p class="pm__msg is-error" role="status">{{ tx().billingOff }}</p>
      } @else if (!account.user()) {
        <p class="pm__msg" role="status">
          {{ tx().signInToBuy }}
          <button type="button" class="pm__btn" (click)="account.dialogOpen.set(true)">{{ tx().signIn }}</button>
        </p>
      }
      @if (waiting(); as o) {
        <p class="pm__msg" role="status">
          {{ tx().waiting(o.orderCode) }}
          <button type="button" class="pm__btn" (click)="cancel(o)">{{ tx().cancel }}</button>
        </p>
      }
      @if (message(); as m) {
        <p class="pm__msg" [class.is-error]="m.error" role="status">{{ m.text }}</p>
      }

      <p class="pm__note">
        {{ lang() === 'en' ? 'A question is only used when the answer is really written by the AI; if the AI fails and the system answers from a template, the question is given back. Free and Premium questions are counted by day (Vietnam time). By buying you agree to the' : 'Một lượt chỉ bị trừ khi câu trả lời thật sự do AI viết; nếu AI lỗi và hệ thống trả lời theo mẫu, lượt được hoàn lại. Lượt miễn phí và Premium tính theo ngày (giờ Việt Nam). Khi mua, bạn đồng ý với' }}
        <a routerLink="/terms">{{ tx().terms }}</a> {{ lang() === 'en' ? 'and the' : 'và' }} <a routerLink="/refund">{{ tx().refund }}</a>.
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
  private readonly site = inject(SiteLangService);
  protected readonly lang = this.site.lang;
  /** The page's words, in the site's language. */
  protected readonly tx = computed(() => PREMIUM_TEXT[this.site.lang()]);
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
    return this.site.lang() === 'en' ? `${Math.round(v).toLocaleString('en-US')} ₫` : `${vndFormat.format(Math.round(v))} đ`;
  }

  protected date(iso: string | null): string {
    return iso ? new Date(iso).toLocaleDateString(this.site.lang() === 'en' ? 'en-GB' : 'vi-VN', { day: 'numeric', month: 'numeric', year: 'numeric' }) : '';
  }

  protected buy(product: Product): void {
    if (this.busy() || !this.canBuy()) return;
    // Opened now, while the click still counts as the user's, so the browser does not block it later.
    const tab = window.open('', '_blank');
    if (!tab) {
      this.message.set({ text: this.tx().popupBlocked, error: true });
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
      const tx = this.tx();
      const parts = [g?.premiumDays ? tx.paidDays(g.premiumDays) : '', g?.aiCredits ? tx.paidQuestions(g.aiCredits) : '', g?.reportCredits ? tx.paidCredits(g.reportCredits) : ''].filter(Boolean);
      this.message.set({ text: tx.paid(parts.join(', ') || tx.paidFallback), error: false });
      this.billing.refresh();
    } else {
      this.message.set({ text: order.status === 'cancelled' ? this.tx().cancelled : this.tx().expired, error: true });
    }
  }
}
