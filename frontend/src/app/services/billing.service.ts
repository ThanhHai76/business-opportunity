import { HttpClient } from '@angular/common/http';
import { Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import { EMPTY, Observable, catchError, filter, map, switchMap, take, tap, timer } from 'rxjs';
import { BILLING_API_URL, REPORTS_API_URL } from '../config';
import { AccountService } from './account.service';

export type ProductKind = 'report' | 'ai' | 'premium';

export interface Product {
  id: string;
  /** report: feasibility report credits · ai: in-depth AI questions · premium: days of Premium. */
  kind: ProductKind;
  /** Report credits it adds (Premium includes some). */
  credits: number;
  aiCredits: number;
  premiumDays: number;
  amountVnd: number;
  name: { vi: string; en: string };
}

/** In-depth AI questions per day (Vietnam time): every account, and with Premium. */
export interface AiLimits {
  freePerDay: number;
  /** Free answers a day of the Time Machine storyteller (an allowance of its own). */
  storyFreePerDay: number;
  premiumPerDay: number;
}

/** An account's Premium and AI allowances (GET /api/billing/me → ai, and every metered AI answer). */
export interface AiStatus {
  premium: boolean;
  premiumUntil: string | null;
  freePerDay: number;
  freeLeft: number;
  storyFreePerDay: number;
  storyFreeLeft: number;
  premiumPerDay: number;
  premiumLeft: number;
  aiCredits: number;
}

/**
 * What a metered AI answer says about its cost (absent when the server does not meter AI answers).
 * charged: which allowance paid for the AI answer; null when the answer is the basic one, because
 * reason = signin (not signed in) | no_quota (nothing left today) | unavailable (the AI failed; nothing was used).
 */
export interface AiQuota extends Partial<AiStatus> {
  charged: 'free' | 'premium' | 'credit' | null;
  reason: 'signin' | 'no_quota' | 'unavailable' | null;
  signedIn: boolean;
  /** The free allowance of the tool that was asked: its size (also for a visitor) and what is left. */
  toolFreePerDay?: number;
  toolFreeLeft?: number;
}

export type OrderStatus = 'pending' | 'paid' | 'cancelled' | 'expired';

export interface Order {
  id: string;
  orderCode: number;
  product: string;
  credits: number;
  /** What the order adds when paid. */
  grants?: { reportCredits: number; aiCredits: number; premiumDays: number };
  amountVnd: number;
  status: OrderStatus;
  createdAt: string;
  expiresAt: string;
  paidAt: string | null;
}

export interface PaidReport {
  id: string;
  kind: string;
  title: string;
  createdAt: string;
  type: string;
  ward: string;
  horizon: string;
}

/** What a paid feasibility report is computed from (the server checks and computes it). */
export interface PaidReportRequest {
  type: string;
  ward: string;
  horizon: string;
  assumptions: object;
}

const opts = { withCredentials: true } as const;

/**
 * Report credits, AI question packs, Premium and paid reports (backend-node /api/billing and /api/reports). What an
 * order buys is added by the payment provider's webhook on the server; the page only polls the order until it is paid.
 */
@Injectable({ providedIn: 'root' })
export class BillingService {
  private readonly http = inject(HttpClient);
  private readonly account = inject(AccountService);

  /** Something is for sale on this server (a payment provider is set up and accounts are on). */
  readonly enabled = signal(false);
  readonly products = signal<Product[]>([]);
  /** The signed-in user's credits (null: not known yet, or signed out). */
  readonly credits = signal<number | null>(null);
  readonly reports = signal<PaidReport[]>([]);
  /** The signed-in user's Premium and AI allowances (null: not known yet, or signed out). */
  readonly ai = signal<AiStatus | null>(null);
  readonly aiLimits = signal<AiLimits>({ freePerDay: 3, storyFreePerDay: 5, premiumPerDay: 50 });
  /** The server counts in-depth AI answers per account (false: AI answers are free for everyone). */
  readonly aiMetering = signal(false);

  readonly reportProducts = computed(() => this.products().filter((p) => (p.kind ?? 'report') === 'report'));
  readonly aiProducts = computed(() => this.products().filter((p) => p.kind === 'ai'));
  readonly premiumProducts = computed(() => this.products().filter((p) => p.kind === 'premium'));

  constructor() {
    this.http.get<{ enabled: boolean; products: Product[]; aiLimits?: AiLimits; aiMetering?: boolean }>(`${BILLING_API_URL}/products`).subscribe({
      next: (r) => {
        this.enabled.set(r.enabled);
        this.products.set(r.products);
        if (r.aiLimits) this.aiLimits.set(r.aiLimits);
        this.aiMetering.set(Boolean(r.aiMetering));
      },
      error: () => this.enabled.set(false),
    });
    // Signing in or out changes whose credits and reports these are.
    effect(() => {
      const user = this.account.user();
      untracked(() => (user ? this.refresh() : (this.credits.set(null), this.reports.set([]), this.ai.set(null))));
    });
  }

  refresh(): void {
    if (!this.account.user()) return;
    this.http.get<{ credits: number; ai?: AiStatus | null }>(`${BILLING_API_URL}/me`, opts).subscribe({
      next: (r) => {
        this.credits.set(r.credits);
        this.ai.set(r.ai ?? null);
      },
      error: () => undefined,
    });
    this.http.get<{ items: PaidReport[] }>(REPORTS_API_URL, opts).subscribe({ next: (r) => this.reports.set(r.items), error: () => undefined });
  }

  checkout(product: string, returnUrl: string): Observable<{ order: Order; checkoutUrl: string }> {
    return this.http.post<{ order: Order; checkoutUrl: string }>(`${BILLING_API_URL}/checkout`, { product, returnUrl }, opts);
  }

  order(id: string): Observable<{ order: Order }> {
    return this.http.get<{ order: Order }>(`${BILLING_API_URL}/orders/${encodeURIComponent(id)}`, opts);
  }

  /** Polls an order until it is no longer pending (a failed check is skipped; the next tick asks again). */
  watch(id: string, everyMs = 3000): Observable<Order> {
    return timer(everyMs, everyMs).pipe(
      switchMap(() => this.order(id).pipe(catchError(() => EMPTY))),
      map(({ order }) => order),
      filter((o) => o.status !== 'pending'),
      take(1),
    );
  }

  /** Keeps the shown allowances in step with what a metered AI answer reported. */
  applyQuota(quota: AiQuota | null | undefined): void {
    if (!quota?.signedIn || quota.freeLeft === undefined) return;
    this.ai.set({
      premium: Boolean(quota.premium),
      premiumUntil: quota.premiumUntil ?? null,
      freePerDay: quota.freePerDay ?? this.aiLimits().freePerDay,
      freeLeft: quota.freeLeft,
      storyFreePerDay: quota.storyFreePerDay ?? this.aiLimits().storyFreePerDay,
      storyFreeLeft: quota.storyFreeLeft ?? 0,
      premiumPerDay: quota.premiumPerDay ?? 0,
      premiumLeft: quota.premiumLeft ?? 0,
      aiCredits: quota.aiCredits ?? 0,
    });
  }

  cancel(id: string): Observable<{ order: Order }> {
    return this.http.post<{ order: Order }>(`${BILLING_API_URL}/orders/${encodeURIComponent(id)}/cancel`, null, opts);
  }

  createReport(request: PaidReportRequest): Observable<{ report: PaidReport; credits: number }> {
    return this.http.post<{ report: PaidReport; credits: number }>(REPORTS_API_URL, request, opts).pipe(
      tap((r) => {
        this.credits.set(r.credits);
        this.reports.update((list) => [r.report, ...list]);
      }),
    );
  }

  /** The printable page of a paid report (the browser saves it as PDF). Opened in a new tab with the session cookie. */
  printUrl(id: string): string {
    return `${REPORTS_API_URL}/${encodeURIComponent(id)}/print`;
  }
}
