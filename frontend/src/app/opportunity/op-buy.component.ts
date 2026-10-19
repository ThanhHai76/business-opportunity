import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, input, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { EMPTY, Subscription, catchError, filter, switchMap, take, timer } from 'rxjs';
import { AccountService, accountError } from '../services/account.service';
import { BillingService, Order, PaidReportRequest, Product } from '../services/billing.service';
import { OpText } from './op-i18n';
import { Lang } from './op.models';

const POLL_MS = 3000;

/**
 * Buying a full feasibility report, inside the ward report dialog: sign in → buy credits (the provider's checkout
 * opens in a new tab while this page polls the order) → create the report with one credit → open its printable page.
 * The server computes the report from `request`; the page never sends figures.
 */
@Component({
  selector: 'app-op-buy',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="buy" aria-labelledby="op-buy-title">
      <h3 id="op-buy-title">{{ t().title }}</h3>
      @if (!billing.enabled()) {
        <p class="muted">{{ t().off }}</p>
      } @else {
        <p>{{ t().intro }}</p>
        <ul>
          @for (line of t().includes; track $index) {
            <li>{{ line }}</li>
          }
        </ul>
        @if (!account.user()) {
          <button type="button" class="op-btn op-btn--primary" (click)="signIn.emit()">{{ t().signIn }}</button>
        } @else {
          @if (credits() > 0) {
            <p class="row">
              <strong>{{ t().credits(credits()) }}</strong>
              <button type="button" class="op-btn op-btn--primary" [disabled]="busy() || !request()" (click)="create()">
                {{ busy() ? t().creating : t().create }}
              </button>
            </p>
          }
          @if (waiting(); as o) {
            <p class="row status" role="status">
              {{ t().waiting }}
              <button type="button" class="op-btn" (click)="cancel(o)">{{ t().cancelWait }}</button>
            </p>
          } @else {
            <h4>{{ credits() > 0 ? t().buyMore : t().buyTitle }}</h4>
            <div class="packs">
              @for (p of billing.reportProducts(); track p.id) {
                <div class="pack">
                  <b>{{ p.name[lang()] }}</b>
                  <span class="price">{{ vnd(p.amountVnd) }}</span>
                  @if (p.credits > 1) {
                    <small>{{ t().perReport(vnd(p.amountVnd / p.credits)) }}</small>
                  }
                  <button type="button" class="op-btn" [disabled]="busy()" (click)="buy(p)">{{ t().buy }}</button>
                </div>
              }
            </div>
          }
          @if (message(); as m) {
            <p class="message" [class.is-error]="m.error" role="status">{{ m.text }}</p>
          }
          @if (billing.reports().length) {
            <h4>{{ t().mine }}</h4>
            <ul class="mine">
              @for (r of billing.reports(); track r.id) {
                <li>
                  <span>{{ r.title }}</span>
                  <small>{{ date(r.createdAt) }}</small>
                  <a [href]="billing.printUrl(r.id)" target="_blank" rel="noopener">{{ t().view }}</a>
                </li>
              }
            </ul>
          }
        }
        <p class="note">{{ t().note }}</p>
      }
    </section>
  `,
  styles: `
    :host { display: block; }
    .buy { margin-top: 14px; padding: 14px 16px; border: 1px solid var(--op-accent); border-radius: 12px; background: var(--op-accent-soft); }
    h3 { margin: 0 0 6px; font-size: 15px; }
    h4 { margin: 14px 0 6px; font-size: 13px; }
    p { margin: 6px 0; font-size: 13px; }
    ul { margin: 4px 0; padding-left: 18px; font-size: 12.5px; }
    .row { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 12px; }
    .muted, .note { color: var(--op-ink-dim); }
    .note { font-size: 11.5px; margin-top: 12px; }
    .packs { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 8px; }
    .pack { display: flex; flex-direction: column; gap: 2px; padding: 10px 12px; border: 1px solid var(--op-line); border-radius: 10px; background: var(--app-surface); }
    .pack .price { font-size: 18px; font-weight: 700; }
    .pack small { color: var(--op-ink-dim); }
    .pack button { margin-top: 6px; align-self: flex-start; }
    .status { color: var(--op-ink); }
    .message { font-weight: 600; color: var(--op-accent); }
    .message.is-error { color: var(--op-warn); }
    .mine { list-style: none; padding: 0; display: flex; flex-direction: column; gap: 4px; }
    .mine li { display: flex; flex-wrap: wrap; gap: 4px 10px; align-items: baseline; }
    .mine span { flex: 1 1 200px; }
    .mine small { color: var(--op-ink-dim); }
    .mine a { color: var(--op-accent); font-weight: 600; }
    /* Same as the page's .op-btn (component styles are scoped, so the page's rule does not reach in here). */
    .op-btn { display: inline-flex; align-items: center; gap: 6px; padding: 6px 11px; border: 1px solid var(--op-line); border-radius: 999px; background: var(--app-surface); color: inherit; font: inherit; font-size: 12.5px; font-weight: 700; cursor: pointer; }
    .op-btn--primary { border-color: transparent; background: var(--op-accent); color: #fff; }
    button[disabled] { opacity: 0.6; cursor: default; }
  `,
})
export class OpBuyComponent {
  protected readonly billing = inject(BillingService);
  protected readonly account = inject(AccountService);
  private readonly destroyRef = inject(DestroyRef);

  readonly t = input.required<OpText['buy']>();
  readonly lang = input.required<Lang>();
  /** The report to create: business type, ward, horizon and the user's current assumptions (null: nothing open). */
  readonly request = input<PaidReportRequest | null>(null);
  /** The buyer must sign in first. The parent opens the sign-in dialog (and gets this dialog out of its way). */
  readonly signIn = output<void>();

  protected readonly credits = computed(() => this.billing.credits() ?? 0);
  protected readonly busy = signal(false);
  protected readonly waiting = signal<Order | null>(null);
  protected readonly message = signal<{ text: string; error: boolean } | null>(null);
  private poll?: Subscription;

  constructor() {
    this.billing.refresh();
    this.destroyRef.onDestroy(() => this.poll?.unsubscribe());
  }

  protected vnd(v: number): string {
    return `${new Intl.NumberFormat(this.lang() === 'en' ? 'en-US' : 'vi-VN', { maximumFractionDigits: 0 }).format(v)} đ`;
  }

  protected date(iso: string): string {
    return new Date(iso).toLocaleDateString(this.lang() === 'en' ? 'en-GB' : 'vi-VN', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  /** Opens a tab now, while the click still counts as the user's, so the browser does not block it later. */
  private openTab(): Window | null {
    const tab = window.open('', '_blank');
    if (tab) tab.opener = null;
    else this.message.set({ text: this.t().popup, error: true });
    return tab;
  }

  protected create(): void {
    const request = this.request();
    if (!request || this.busy()) return;
    const tab = this.openTab();
    if (!tab) return;
    this.busy.set(true);
    this.message.set(null);
    this.billing
      .createReport(request)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (r) => {
          this.busy.set(false);
          tab.location.href = this.billing.printUrl(r.report.id);
        },
        error: (e) => {
          this.busy.set(false);
          tab.close();
          this.message.set({ text: accountError(e), error: true });
          this.billing.refresh();
        },
      });
  }

  protected buy(product: Product): void {
    if (this.busy()) return;
    const tab = this.openTab();
    if (!tab) return;
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

  /** Polls the order until it is no longer pending. */
  private watch(order: Order): void {
    this.poll?.unsubscribe();
    this.waiting.set(order);
    this.poll = timer(POLL_MS, POLL_MS)
      .pipe(
        // A failed check (network blip) is skipped; the next tick asks again.
        switchMap(() => this.billing.order(order.id).pipe(catchError(() => EMPTY))),
        filter(({ order: o }) => o.status !== 'pending'),
        take(1),
      )
      .subscribe(({ order: o }) => this.settle(o));
  }

  private settle(order: Order): void {
    this.poll?.unsubscribe();
    this.waiting.set(null);
    if (order.status === 'paid') {
      this.message.set({ text: this.t().paid(order.credits), error: false });
      this.billing.refresh();
    } else {
      this.message.set({ text: this.t().failed[order.status] ?? order.status, error: true });
    }
  }
}
