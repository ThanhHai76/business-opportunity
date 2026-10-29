import { daysBetween, StatRow, summarize } from './stats';

const row = (day: string, event: string, key: string, n: number): StatRow => ({ day, event, key, n });

describe('daysBetween', () => {
  it('lists every day, both ends included, across a month end', () => {
    expect(daysBetween('2026-10-30', '2026-11-02')).toEqual(['2026-10-30', '2026-10-31', '2026-11-01', '2026-11-02']);
  });

  it('is empty for a bad start (before the server answered)', () => {
    expect(daysBetween('', '2026-10-28')).toEqual([]);
  });
});

describe('summarize', () => {
  const rows = [
    row('2026-10-26', 'page_view', '/', 10),
    row('2026-10-27', 'page_view', '/', 5),
    row('2026-10-27', 'page_view', '/premium', 20),
    row('2026-10-27', 'page_view', '/career', 7),
    row('2026-10-27', 'signup', '', 3),
    row('2026-10-27', 'checkout_start', 'premium-month', 4),
    row('2026-10-27', 'order_paid', 'premium-month', 1),
    row('2026-10-28', 'order_paid', 'reports-5', 1),
  ];
  const s = summarize(rows, '2026-10-26', '2026-10-28');

  it('totals every event', () => {
    expect(s.totals['page_view']).toBe(42);
    expect(s.totals['signup']).toBe(3);
    expect(s.totals['order_paid']).toBe(2);
  });

  it('ranks the pages by views, adding the days up', () => {
    expect(s.pages).toEqual([
      { path: '/premium', n: 20 },
      { path: '/', n: 15 },
      { path: '/career', n: 7 },
    ]);
  });

  it('gives views per day with no gap, and a day with none counts zero', () => {
    expect(s.daily).toEqual([
      { day: '2026-10-26', n: 10 },
      { day: '2026-10-27', n: 32 },
      { day: '2026-10-28', n: 0 },
    ]);
  });

  it('follows the Premium page to the payment, with the share kept at each step', () => {
    expect(s.funnel.map((f) => f.n)).toEqual([20, 4, 2]);
    expect(s.funnel.map((f) => f.pct)).toEqual([null, 20, 50]);
  });

  it('counts paid orders by product', () => {
    expect(s.paidByProduct).toEqual([
      { product: 'premium-month', n: 1 },
      { product: 'reports-5', n: 1 },
    ]);
  });

  it('shows no percentage instead of dividing by zero', () => {
    const empty = summarize([], '2026-10-27', '2026-10-27');
    expect(empty.funnel.map((f) => f.pct)).toEqual([null, null, null]);
    expect(empty.pages).toEqual([]);
    expect(empty.daily).toEqual([{ day: '2026-10-27', n: 0 }]);
  });
});
