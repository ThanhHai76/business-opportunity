import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ACCOUNT_API_URL, BILLING_API_URL, REPORTS_API_URL } from '../config';
import { BillingService } from './billing.service';
import { isPremiumRequired } from './premium-prompt.service';

const PRODUCTS = [{ id: 'report_1', credits: 1, amountVnd: 199_000, name: { vi: '1 báo cáo khả thi', en: '1 feasibility report' } }];
const REPORT = { id: 'r1', kind: 'opportunity_feasibility', title: 'Quán cà phê · Phường A · hiện tại', createdAt: '2026-10-13T00:00:00Z', type: 'cafe', ward: 'a', horizon: 'now' };

/** A fresh app: the service, the mocked API, the product list and the first /me answer. */
function fresh(signedIn: boolean, premiumGating = false) {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
  const billing = TestBed.inject(BillingService);
  const http = TestBed.inject(HttpTestingController);
  http.expectOne(`${BILLING_API_URL}/products`).flush({ enabled: true, provider: 'mock', products: PRODUCTS, premiumGating });
  http.expectOne(`${ACCOUNT_API_URL}/me`).flush({ enabled: true, user: signedIn ? { id: 'u1', email: 'a@b.vn', displayName: null, createdAt: '2026-10-01T00:00:00Z' } : null });
  TestBed.flushEffects();
  return { billing, http };
}

describe('BillingService', () => {
  it('knows what is for sale without a session, and asks nothing else when signed out', () => {
    const { billing, http } = fresh(false);
    expect(billing.enabled()).toBeTrue();
    expect(billing.products()[0].amountVnd).toBe(199_000);
    expect(billing.credits()).toBeNull();
    http.verify();
  });

  it('loads the credits and reports of the signed-in user', () => {
    const { billing, http } = fresh(true);
    http.expectOne(`${BILLING_API_URL}/me`).flush({ credits: 2, orders: [] });
    http.expectOne(REPORTS_API_URL).flush({ items: [REPORT] });
    expect(billing.credits()).toBe(2);
    expect(billing.reports().length).toBe(1);
    http.verify();
  });

  it('sends only the inputs of a report, and takes the credits left from the server', () => {
    const { billing, http } = fresh(true);
    http.expectOne(`${BILLING_API_URL}/me`).flush({ credits: 1, orders: [] });
    http.expectOne(REPORTS_API_URL).flush({ items: [] });
    const request = { type: 'cafe', ward: 'a', horizon: 'now', assumptions: { customers: 120 } };
    billing.createReport(request).subscribe();
    const req = http.expectOne(REPORTS_API_URL);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(request);
    expect(req.request.withCredentials).toBeTrue();
    req.flush({ report: REPORT, credits: 0 });
    expect(billing.credits()).toBe(0);
    expect(billing.reports()[0].id).toBe('r1');
    expect(billing.printUrl('r1')).toBe(`${REPORTS_API_URL}/r1/print`);
    http.verify();
  });

  it('sorts the products by kind (report packs, AI packs, Premium)', () => {
    const { billing } = fresh(false);
    billing.products.set([
      { ...PRODUCTS[0], kind: 'report', aiCredits: 0, premiumDays: 0 },
      { id: 'ai_30', kind: 'ai', credits: 0, aiCredits: 30, premiumDays: 0, amountVnd: 49_000, name: { vi: 'a', en: 'a' } },
      { id: 'premium_30d', kind: 'premium', credits: 1, aiCredits: 0, premiumDays: 30, amountVnd: 249_000, name: { vi: 'p', en: 'p' } },
    ]);
    expect(billing.reportProducts().map((p) => p.id)).toEqual(['report_1']);
    expect(billing.aiProducts().map((p) => p.id)).toEqual(['ai_30']);
    expect(billing.premiumProducts().map((p) => p.id)).toEqual(['premium_30d']);
  });

  it('loads the AI allowances, and follows the quota of each metered answer', () => {
    const { billing, http } = fresh(true);
    const ai = { premium: false, premiumUntil: null, freePerDay: 3, freeLeft: 3, storyFreePerDay: 5, storyFreeLeft: 5, premiumPerDay: 0, premiumLeft: 0, aiCredits: 0 };
    http.expectOne(`${BILLING_API_URL}/me`).flush({ credits: 0, ai, orders: [] });
    http.expectOne(REPORTS_API_URL).flush({ items: [] });
    expect(billing.ai()?.freeLeft).toBe(3);

    billing.applyQuota({ ...ai, charged: 'free', reason: null, signedIn: true, freeLeft: 2 });
    expect(billing.ai()?.freeLeft).toBe(2);
    // A visitor's answer says nothing about an account: nothing changes.
    billing.applyQuota({ charged: null, reason: 'signin', signedIn: false });
    expect(billing.ai()?.freeLeft).toBe(2);
    http.verify();
  });

  const AI = { premiumUntil: null, freePerDay: 3, freeLeft: 3, storyFreePerDay: 5, storyFreeLeft: 5, premiumPerDay: 0, premiumLeft: 0, aiCredits: 0 };

  it('locks the Premium features for a visitor while Premium is for sale, and for nobody when it is not', () => {
    expect(fresh(false, true).billing.premiumLocked()).toBeTrue();
    expect(fresh(false, false).billing.premiumLocked()).toBeFalse();
  });

  it('locks them for a free account only once its plan is known, and never for a Premium account', () => {
    const free = fresh(true, true);
    // Until /me answers the plan is unknown: no lock flashes for a Premium account.
    expect(free.billing.premiumLocked()).toBeFalse();
    free.http.expectOne(`${BILLING_API_URL}/me`).flush({ credits: 0, ai: { ...AI, premium: false }, orders: [] });
    free.http.expectOne(REPORTS_API_URL).flush({ items: [] });
    expect(free.billing.premiumLocked()).toBeTrue();

    const pro = fresh(true, true);
    pro.http.expectOne(`${BILLING_API_URL}/me`).flush({ credits: 0, ai: { ...AI, premium: true }, orders: [] });
    pro.http.expectOne(REPORTS_API_URL).flush({ items: [] });
    expect(pro.billing.premiumLocked()).toBeFalse();
  });
});

describe('isPremiumRequired', () => {
  it('recognises the server answer for a Premium feature, and only that', () => {
    expect(isPremiumRequired({ status: 402, error: { code: 'premium_required' } })).toBeTrue();
    expect(isPremiumRequired({ status: 402, error: { detail: 'Hết credit' } })).toBeFalse();
    expect(isPremiumRequired({ status: 500 })).toBeFalse();
    expect(isPremiumRequired(null)).toBeFalse();
  });
});
