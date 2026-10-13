import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ACCOUNT_API_URL } from '../config';
import { defaultsFor } from './op-feasibility';
import { MAX_REPORTS, REPORTS_KEY, SavedReport, SavedReportsStore } from './op-reports';

const report = (ward: string, type = 'cafe', horizon: 'now' | '2030' = 'now'): Omit<SavedReport, 'id' | 'savedAt'> => ({
  type,
  typeName: 'Quán cà phê',
  icon: '☕',
  ward,
  wardName: `Phường ${ward}`,
  horizon,
  score: 60,
  demand: 70,
  competition: 25,
  count: 10,
  assumptions: defaultsFor(type),
  result: { revenue: 100, costs: 80, profit: 20, marginPct: 20, investment: 300, paybackMonths: 15, budgetGap: 50 },
  risk: 'low',
});

/** A fresh app: the store, the mocked API, and the first /me answer (signed out unless a user is given). */
function fresh(user: { id: string; email: string } | null = null, enabled = user !== null) {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
  const store = TestBed.inject(SavedReportsStore);
  const http = TestBed.inject(HttpTestingController);
  http.expectOne(`${ACCOUNT_API_URL}/me`).flush({ enabled, user: user && { ...user, displayName: null, createdAt: '2026-10-01T00:00:00Z' } });
  TestBed.flushEffects();
  return { store, http };
}
const serverCopy = (r: Omit<SavedReport, 'id' | 'savedAt'>, id: string): SavedReport => ({ ...r, id, savedAt: '2026-10-09T10:00:00.000Z' });

describe('Saved reports (in this browser)', () => {
  beforeEach(() => localStorage.removeItem(REPORTS_KEY));
  afterEach(() => localStorage.removeItem(REPORTS_KEY));

  it('saves newest first, replaces the same type + ward + horizon, and keeps them after a reload', () => {
    const { store, http } = fresh();
    store.save(report('a'));
    store.save(report('b'));
    store.save(report('a', 'cafe', '2030'));
    store.save({ ...report('a'), score: 61 });
    expect(store.list().map((r) => `${r.ward}/${r.horizon}`)).toEqual(['a/now', 'a/2030', 'b/now']);
    expect(store.list()[0].score).toBe(61);
    expect(store.has('cafe', 'b', 'now')).toBeTrue();
    http.verify(); // signed out: nothing is sent

    const ids = store.list().map((r) => r.id);
    expect(fresh().store.list().map((r) => r.id)).toEqual(ids);
  });

  it('removes one, clears all and keeps at most the limit', () => {
    const { store } = fresh();
    for (let i = 0; i < MAX_REPORTS + 5; i++) store.save(report(`w${i}`));
    expect(store.list().length).toBe(MAX_REPORTS);
    store.remove(store.list()[0].id);
    expect(store.list().length).toBe(MAX_REPORTS - 1);
    store.clear();
    expect(fresh().store.list()).toEqual([]);
  });

  it('ignores broken data in storage', () => {
    localStorage.setItem(REPORTS_KEY, JSON.stringify([{ id: 1 }, null, 'x', { ...report('ok'), id: 'k', savedAt: '2026-10-01T00:00:00Z' }]));
    expect(fresh().store.list().map((r) => r.ward)).toEqual(['ok']);
    localStorage.setItem(REPORTS_KEY, '{not json');
    expect(fresh().store.list()).toEqual([]);
  });
});

describe('Saved reports (in the account)', () => {
  const user = { id: 'u1', email: 'an@example.com' };
  beforeEach(() => localStorage.removeItem(REPORTS_KEY));
  afterEach(() => localStorage.removeItem(REPORTS_KEY));

  it('moves the reports of this browser into the account on sign-in, then forgets them locally', () => {
    localStorage.setItem(REPORTS_KEY, JSON.stringify([{ ...report('phuong-lang'), id: 'local-1', savedAt: '2026-10-01T00:00:00Z' }]));
    const { store, http } = fresh(user);
    const req = http.expectOne(`${ACCOUNT_API_URL}/reports/import`);
    expect(req.request.withCredentials).toBeTrue();
    expect(req.request.body.items.map((r: SavedReport) => r.ward)).toEqual(['phuong-lang']);
    req.flush({ items: [serverCopy(report('phuong-lang'), 's-1'), serverCopy(report('phuong-cau-giay'), 's-2')] });
    expect(store.list().map((r) => r.id)).toEqual(['s-1', 's-2']);
    expect(localStorage.getItem(REPORTS_KEY)).toBeNull();
    expect(store.inAccount()).toBeTrue();
  });

  it('just loads the account list when the browser has none', () => {
    const { store, http } = fresh(user);
    http.expectOne(`${ACCOUNT_API_URL}/reports`).flush({ items: [serverCopy(report('a'), 's-1')] });
    expect(store.list().map((r) => r.id)).toEqual(['s-1']);
  });

  it('saves to and deletes from the account; the server id replaces the temporary one', () => {
    const { store, http } = fresh(user);
    http.expectOne(`${ACCOUNT_API_URL}/reports`).flush({ items: [] });
    const temp = store.save(report('b'));
    expect(store.list()[0].id).toBe(temp.id); // shown at once
    const put = http.expectOne({ method: 'PUT', url: `${ACCOUNT_API_URL}/reports` });
    expect(put.request.body.ward).toBe('b');
    put.flush({ item: serverCopy(report('b'), 's-9') });
    expect(store.list()[0].id).toBe('s-9');
    expect(localStorage.getItem(REPORTS_KEY)).toBeNull(); // never written to the browser

    store.remove('s-9');
    http.expectOne({ method: 'DELETE', url: `${ACCOUNT_API_URL}/reports/s-9` }).flush(null, { status: 204, statusText: 'No Content' });
    expect(store.list()).toEqual([]);
  });

  it('keeps the browser reports when moving them fails, and says why', () => {
    localStorage.setItem(REPORTS_KEY, JSON.stringify([{ ...report('a'), id: 'local-1', savedAt: '2026-10-01T00:00:00Z' }]));
    const { store, http } = fresh(user);
    http.expectOne(`${ACCOUNT_API_URL}/reports/import`).flush({ message: 'Lỗi máy chủ, vui lòng thử lại.' }, { status: 500, statusText: 'Server Error' });
    expect(store.list().map((r) => r.id)).toEqual(['local-1']);
    expect(localStorage.getItem(REPORTS_KEY)).not.toBeNull();
    expect(store.syncError()).toBe('Lỗi máy chủ, vui lòng thử lại.');
  });
});
