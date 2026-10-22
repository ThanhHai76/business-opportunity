import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { fakeAsync, TestBed, tick } from '@angular/core/testing';
import { signal } from '@angular/core';
import { ACCOUNT_API_URL } from '../config';
import { AccountService } from '../services/account.service';
import { BillingService } from '../services/billing.service';
import { EMPTY_PROFILE, Profile } from './career.logic';
import { PlanState } from './career.plan';
import { CareerStore, MAX_PLANS } from './career.store';

const KEYS = ['hanoi100.career.profile', 'hanoi100.career.plans', 'hanoi100.career.plan'];
const PROFILE: Profile = { ...EMPTY_PROFILE, situation: 'graduate', backgrounds: ['tech'], education: 2, time: 2, work: 'employee', ward: 'phuong-tay-ho' };
const plan = (directionId: string, at: string, done: string[] = []): PlanState => ({ directionId, startedAt: at, done, updatedAt: at });

/** A fresh app: the store, the mocked API, and the first /me answer. `premium` says what the billing service reports. */
function setup(opts: { signedIn: boolean; locked: boolean }) {
  TestBed.resetTestingModule();
  const billing = { premiumLocked: signal(opts.locked), premiumGating: signal(true), ai: signal(opts.locked ? null : { premium: true }) };
  TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting(), { provide: BillingService, useValue: billing }] });
  const store = TestBed.inject(CareerStore);
  const http = TestBed.inject(HttpTestingController);
  const account = TestBed.inject(AccountService);
  http.expectOne(`${ACCOUNT_API_URL}/me`).flush({ enabled: true, user: opts.signedIn ? { id: 'u1', email: 'a@b.vn', displayName: null, createdAt: '2026-10-01T00:00:00Z' } : null });
  TestBed.flushEffects();
  return { store, http, account, billing };
}

describe('Career compass store', () => {
  beforeEach(() => KEYS.forEach((k) => localStorage.removeItem(k)));
  afterEach(() => KEYS.forEach((k) => localStorage.removeItem(k)));

  describe('without Premium', () => {
    it('keeps one plan, says when there is no room for another, and keeps it in this browser', () => {
      const { store, http } = setup({ signedIn: false, locked: true });
      expect(store.limit()).toBe(1);
      expect(store.start('retail')).toBe('started');
      expect(store.start('logistics')).toBe('limit');
      expect(store.start('retail')).toBe('exists');
      TestBed.flushEffects();
      expect(JSON.parse(localStorage.getItem('hanoi100.career.plans')!)[0].directionId).toBe('retail');
      store.toggle('cv');
      expect(store.active()?.done).toEqual(['cv']);
      store.remove('retail');
      expect(store.plans()).toEqual([]);
      http.verify(); // nothing is sent
    });

    it('carries over the single plan an earlier version of the page kept', () => {
      localStorage.setItem('hanoi100.career.plan', JSON.stringify({ directionId: 'tourism', startedAt: '2026-10-01T00:00:00.000Z', done: ['cv'] }));
      const { store } = setup({ signedIn: false, locked: true });
      expect(store.plans().map((p) => p.directionId)).toEqual(['tourism']);
      expect(store.plans()[0].done).toEqual(['cv']);
    });

    it('does not sync a signed-in free account', () => {
      const { store, http } = setup({ signedIn: true, locked: true });
      expect(store.inAccount()).toBeFalse();
      store.start('retail');
      TestBed.flushEffects();
      http.verify();
    });
  });

  describe('with Premium, signed in', () => {
    it('merges this browser and the account (the newer plan wins), then pushes what only the browser has', fakeAsync(() => {
      localStorage.setItem('hanoi100.career.plans', JSON.stringify([plan('retail', '2026-10-01T00:00:00.000Z', ['cv']), plan('logistics', '2026-10-05T00:00:00.000Z', ['first'])]));
      const { store, http } = setup({ signedIn: true, locked: false });
      expect(store.inAccount()).toBeTrue();
      const get = http.expectOne(`${ACCOUNT_API_URL}/career`);
      get.flush({ profile: PROFILE, plans: [{ directionId: 'retail', startedAt: '2026-10-01T00:00:00.000Z', done: ['cv', 'accounts'], updatedAt: '2026-10-09T00:00:00.000Z' }] });
      TestBed.flushEffects();
      expect(store.plans().map((p) => p.directionId).sort()).toEqual(['logistics', 'retail']);
      expect(store.plans().find((p) => p.directionId === 'retail')?.done).toEqual(['cv', 'accounts']); // the account's is newer
      expect(store.profile().ward).toBe('phuong-tay-ho'); // nothing was answered here: the account's answers
      tick(1000);
      const put = http.expectOne(`${ACCOUNT_API_URL}/career/plans/logistics`);
      expect(put.request.method).toBe('PUT');
      expect(put.request.body).toEqual({ startedAt: '2026-10-05T00:00:00.000Z', done: ['first'] });
      put.flush({ plan: {} });
      http.verify(); // retail was already the same in the account: not sent again
    }));

    it('pushes a tick, a new answer and a removed plan, a moment after each change', fakeAsync(() => {
      const { store, http } = setup({ signedIn: true, locked: false });
      http.expectOne(`${ACCOUNT_API_URL}/career`).flush({ profile: null, plans: [] });
      TestBed.flushEffects();
      tick(1000);
      store.start('finance');
      store.toggle('cv');
      store.profile.set(PROFILE);
      TestBed.flushEffects();
      tick(1000);
      const plans = http.expectOne(`${ACCOUNT_API_URL}/career/plans/finance`);
      expect(plans.request.body.done).toEqual(['cv']); // one request for the changes made together
      plans.flush({ plan: {} });
      http.expectOne(`${ACCOUNT_API_URL}/career/profile`).flush({ profile: PROFILE });

      store.remove('finance');
      TestBed.flushEffects();
      tick(1000);
      expect(http.expectOne(`${ACCOUNT_API_URL}/career/plans/finance`).request.method).toBe('DELETE');
      http.verify();
    }));

    it('keeps up to five plans, and says the account is the one refusing when it does', fakeAsync(() => {
      const { store, http } = setup({ signedIn: true, locked: false });
      http.expectOne(`${ACCOUNT_API_URL}/career`).flush({ profile: null, plans: [] });
      TestBed.flushEffects();
      tick(1000);
      expect(store.limit()).toBe(MAX_PLANS);
      for (const id of ['retail', 'logistics', 'tourism', 'finance', 'engineering']) expect(store.start(id)).toBe('started');
      expect(store.start('semiconductor')).toBe('limit');
      TestBed.flushEffects();
      tick(1000);
      const requests = http.match((r) => r.url.includes('/career/plans/'));
      expect(requests.length).toBe(5);
      requests.slice(1).forEach((r) => r.flush({ plan: {} }));
      requests[0].flush({ message: 'Lưu kế hoạch nghề nghiệp vào tài khoản dành cho tài khoản Premium.' }, { status: 402, statusText: 'Payment Required' });
      expect(store.syncError()).toContain('Premium');
      expect(store.plans().length).toBe(5); // the browser still has them
    }));

    it('leaves nothing in the browser after signing out, and keeps it when only Premium ends', fakeAsync(() => {
      const { store, http, account, billing } = setup({ signedIn: true, locked: false });
      http.expectOne(`${ACCOUNT_API_URL}/career`).flush({ profile: null, plans: [] });
      store.start('retail');
      store.profile.set(PROFILE);
      TestBed.flushEffects();
      tick(1000);
      http.match(() => true).forEach((r) => r.flush({}));
      expect(localStorage.getItem('hanoi100.career.plans')).not.toBeNull();

      // Premium ends, still signed in: the data stays (read-only use, one plan).
      billing.premiumLocked.set(true);
      TestBed.flushEffects();
      expect(store.plans().length).toBe(1);
      expect(store.inAccount()).toBeFalse();

      // Signing out of a synced account removes the browser's copy.
      billing.premiumLocked.set(false);
      TestBed.flushEffects();
      http.match(() => true).forEach((r) => r.flush({ profile: null, plans: [] }));
      account.user.set(null);
      TestBed.flushEffects();
      expect(store.plans()).toEqual([]);
      expect(store.profile()).toEqual(EMPTY_PROFILE);
      expect(localStorage.getItem('hanoi100.career.plans')).toBeNull();
      expect(localStorage.getItem('hanoi100.career.profile')).toBeNull();
    }));
  });
});
