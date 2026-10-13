import { WardProps } from './op.models';

/** One row of the market table: a scored ward with the figures behind its score for the selected type. */
export interface MarketRow {
  slug: string;
  name: string;
  score: number | null;
  demand: number | null;
  competition: number | null;
  count: number | null;
  per10k: number | null;
  population: number | null;
  landMedian: number | null;
  /** Demand above the median ward and competition below it: room for one more business of the type. */
  gap: boolean;
}

export type MarketKey = 'name' | 'score' | 'demand' | 'competition' | 'count' | 'per10k' | 'population' | 'landMedian';
export interface MarketSort {
  key: MarketKey;
  desc: boolean;
}
export interface MarketFilter {
  query: string;
  gapsOnly: boolean;
}

const median = (values: number[]) => {
  const v = [...values].sort((a, b) => a - b);
  return v.length ? v[Math.floor(v.length / 2)] : null;
};
const fold = (text: string) => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/gi, 'd').toLowerCase();

/** Scored wards as table rows; `gap` needs the type's demand and competition (absent with no type selected). */
export function marketRows(wards: WardProps[]): MarketRow[] {
  const scored = wards.filter((w) => w.scored);
  const known = (values: Array<number | undefined>) => values.filter((v): v is number => typeof v === 'number');
  const medDemand = median(known(scored.map((w) => w.demand)));
  const medCompetition = median(known(scored.map((w) => w.competition)));
  return scored.map((w) => ({
    slug: w.slug,
    name: w.name,
    score: w.score,
    demand: w.demand ?? null,
    competition: w.competition ?? null,
    count: w.count ?? null,
    per10k: w.per10k ?? null,
    population: w.population,
    landMedian: w.landMedian,
    gap:
      medDemand !== null &&
      medCompetition !== null &&
      w.demand !== undefined &&
      w.competition !== undefined &&
      w.demand >= medDemand &&
      w.competition < medCompetition,
  }));
}

/** Filtered and sorted rows; missing values always go last. */
export function sortMarket(rows: MarketRow[], sort: MarketSort, filter: MarketFilter): MarketRow[] {
  const q = fold(filter.query.trim());
  const dir = sort.desc ? -1 : 1;
  return rows
    .filter((r) => (!filter.gapsOnly || r.gap) && (!q || fold(r.name).includes(q)))
    .sort((a, b) => {
      if (sort.key === 'name') return dir * a.name.localeCompare(b.name, 'vi');
      const x = a[sort.key];
      const y = b[sort.key];
      if (x === null || y === null) return x === y ? 0 : x === null ? 1 : -1;
      return dir * (x - y) || a.name.localeCompare(b.name, 'vi');
    });
}

/** The rows as CSV (UTF-8 with BOM so Excel reads the Vietnamese names). */
export function marketCsv(rows: MarketRow[], headers: Record<MarketKey | 'gap', string>): string {
  const keys: Array<MarketKey | 'gap'> = ['name', 'score', 'demand', 'competition', 'count', 'per10k', 'population', 'landMedian', 'gap'];
  const cell = (v: unknown) => {
    const s = v === null || v === undefined ? '' : typeof v === 'boolean' ? (v ? '1' : '0') : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return '\ufeff' + [keys.map((k) => cell(headers[k])).join(','), ...rows.map((r) => keys.map((k) => cell(r[k])).join(','))].join('\n');
}
