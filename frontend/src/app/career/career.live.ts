import { MetroHorizon, MetroPoint } from '../property-intel/pi.models';
import type { CareerLang } from './career.local';
import { sharedLines } from './career.reach';

/** Drive-time limits (minutes by car, no traffic) offered for "how far from each workplace". */
export const LIVE_LIMITS = [15, 20, 30, 45] as const;
export type LiveLimit = (typeof LIVE_LIMITS)[number];

/** Nearest first, or cheapest land first. */
export type LiveSort = 'time' | 'price';

/** A place of work and the minutes by car from every ward to it. */
export interface Workplace {
  id: string;
  name: string;
  minutes: Record<string, number | null>;
  /** The metro lines near it, when known. */
  metro: MetroPoint | null;
}

export interface Candidate {
  slug: string;
  name: string;
  /** Official land price (median VT1, million VND/m²): a rough sign of what living there costs, usually below the market. */
  landMedian: number | null;
}

export interface LiveRow {
  slug: string;
  name: string;
  /** Minutes to each workplace, in the order given. */
  minutes: number[];
  /** The longest of them: what the least convenient workplace costs. */
  worst: number;
  sum: number;
  landMedian: number | null;
  /** The first horizon at which this ward is on a metro line shared with every workplace (null: never). */
  metroFrom: MetroHorizon | null;
}

const HORIZON_ORDER: MetroHorizon[] = ['now', 'soon', 'plan'];

/** When a ward is on a line shared with every workplace: now, from 2027, under the plan, or not at all. */
export function metroFrom(home: MetroPoint | null | undefined, workplaces: (MetroPoint | null)[]): MetroHorizon | null {
  if (!home || workplaces.length === 0 || workplaces.some((w) => !w)) return null;
  return HORIZON_ORDER.find((h) => workplaces.every((w) => sharedLines(home, w, h).length > 0)) ?? null;
}

/**
 * The wards that can be lived in with every workplace within `limit` minutes, best first. By time: the one whose
 * longest trip is shortest, then the shortest total. By price: the cheapest official land first (wards without a price
 * last), then the same. The workplace's own ward counts: living where you work is an answer.
 */
export function rankHomes(candidates: Candidate[], workplaces: Workplace[], limit: number, sort: LiveSort, metroOf: (slug: string) => MetroPoint | undefined = () => undefined): LiveRow[] {
  if (workplaces.length === 0) return [];
  const rows: LiveRow[] = [];
  for (const c of candidates) {
    const minutes = workplaces.map((w) => w.minutes[c.slug]);
    if (minutes.some((m) => m === null || m === undefined || m > limit)) continue;
    const times = minutes as number[];
    rows.push({
      slug: c.slug,
      name: c.name,
      minutes: times,
      worst: Math.max(...times),
      sum: times.reduce((a, b) => a + b, 0),
      landMedian: c.landMedian,
      metroFrom: metroFrom(metroOf(c.slug), workplaces.map((w) => w.metro)),
    });
  }
  const byTime = (a: LiveRow, b: LiveRow) => a.worst - b.worst || a.sum - b.sum || a.name.localeCompare(b.name, 'vi');
  const byPrice = (a: LiveRow, b: LiveRow) => (a.landMedian ?? Infinity) - (b.landMedian ?? Infinity) || byTime(a, b);
  return rows.sort(sort === 'price' ? byPrice : byTime);
}

/** The class of each ward on the map (4: the nearest fifth … 0: the farthest) among the rows; wards outside the limit have none. */
export function liveClasses(rows: LiveRow[]): Map<string, number> {
  const out = new Map<string, number>();
  const ordered = [...rows].sort((a, b) => a.worst - b.worst || a.sum - b.sum);
  ordered.forEach((r, i) => out.set(r.slug, 4 - Math.min(4, Math.floor((i * 5) / ordered.length))));
  return out;
}

export const METRO_FROM_TEXT: Record<MetroHorizon, string> = { now: 'có từ nay', soon: 'từ 2027', plan: 'theo quy hoạch' };

export const metroFromTextIn = (lang: CareerLang): Record<MetroHorizon, string> => (lang === 'vi' ? METRO_FROM_TEXT : { now: 'available today', soon: 'from 2027', plan: 'under the plan' });
