/** One counter of the server: how many times `event` happened on `day` (with a page path or a label as `key`). */
export interface StatRow {
  day: string;
  event: string;
  key: string;
  n: number;
}

export interface Summary {
  totals: Partial<Record<string, number>>;
  /** Pages by views, most viewed first. */
  pages: { path: string; n: number }[];
  /** Page views per day, oldest first, with no gap between the first and the last day. */
  daily: { day: string; n: number }[];
  /** Paid orders per product, most first. */
  paidByProduct: { product: string; n: number }[];
  /** Premium page views → checkouts started → orders paid, with the share of the step before. */
  funnel: { label: string; n: number; pct: number | null }[];
}

const sum = (rows: StatRow[]): number => rows.reduce((s, r) => s + r.n, 0);

/** The days from `since` to `until` (YYYY-MM-DD), both included. */
export function daysBetween(since: string, until: string): string[] {
  const out: string[] = [];
  for (let t = Date.parse(`${since}T00:00:00Z`); t <= Date.parse(`${until}T00:00:00Z`) && out.length < 400; t += 86_400_000) out.push(new Date(t).toISOString().slice(0, 10));
  return out;
}

/** Turns the server's counters into the numbers the page shows. */
export function summarize(rows: StatRow[], since: string, until: string): Summary {
  const by = (event: string) => rows.filter((r) => r.event === event);
  const totals: Record<string, number> = {};
  for (const r of rows) totals[r.event] = (totals[r.event] ?? 0) + r.n;

  const views = by('page_view');
  const perPage = new Map<string, number>();
  for (const r of views) perPage.set(r.key, (perPage.get(r.key) ?? 0) + r.n);
  const perDay = new Map<string, number>();
  for (const r of views) perDay.set(r.day, (perDay.get(r.day) ?? 0) + r.n);

  const paid = new Map<string, number>();
  for (const r of by('order_paid')) paid.set(r.key, (paid.get(r.key) ?? 0) + r.n);

  const premiumViews = sum(views.filter((r) => r.key === '/premium'));
  const started = totals['checkout_start'] ?? 0;
  const paidTotal = totals['order_paid'] ?? 0;
  const pct = (n: number, of: number): number | null => (of > 0 ? Math.round((n / of) * 1000) / 10 : null);

  return {
    totals,
    pages: [...perPage].map(([path, n]) => ({ path, n })).sort((a, b) => b.n - a.n || a.path.localeCompare(b.path)),
    daily: daysBetween(since, until).map((day) => ({ day, n: perDay.get(day) ?? 0 })),
    paidByProduct: [...paid].map(([product, n]) => ({ product, n })).sort((a, b) => b.n - a.n || a.product.localeCompare(b.product)),
    funnel: [
      { label: 'Xem trang Premium', n: premiumViews, pct: null },
      { label: 'Bắt đầu thanh toán', n: started, pct: pct(started, premiumViews) },
      { label: 'Thanh toán thành công', n: paidTotal, pct: pct(paidTotal, started) },
    ],
  };
}
