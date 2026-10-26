import { AREAS, WorkArea } from './career.data';
import { CareerLang, localeOf } from './career.local';

/** What the colours show: how many places of the sector the map has in the ward, or how many per 10,000 residents. */
export type Metric = 'count' | 'per10k';

/** Light to dark green: few places to many. */
export const RAMP = ['#d9f0e1', '#a5dbb8', '#6cc08d', '#2f9d63', '#176b42'];
export const NO_DATA = '#9aa3ad';

export interface WardFigure {
  slug: string;
  name: string;
  /** null: the map has no data for this ward. */
  count: number | null;
  per10k: number | null;
  population: number | null;
  /** Official land price of the ward (2026 table, median VT1, million VND/m²): what the State sets, usually below the market. */
  landMedian: number | null;
}

export function figureOf(properties: Record<string, unknown>): WardFigure {
  const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
  const scored = properties['scored'] === true;
  return {
    slug: String(properties['slug'] ?? ''),
    name: String(properties['name'] ?? ''),
    count: scored ? num(properties['count']) : null,
    per10k: scored ? num(properties['per10k']) : null,
    population: num(properties['population']),
    landMedian: num(properties['landMedian']),
  };
}

/**
 * The upper limits of the colour classes (one fewer than the classes): quantiles of the values above zero, so the
 * colours tell wards apart even when a few central wards have many times more places than the rest. Fewer limits
 * when there are fewer distinct values.
 */
export function breaks(values: (number | null)[], classes = RAMP.length): number[] {
  const v = values.filter((x): x is number => x !== null && x > 0).sort((a, b) => a - b);
  if (v.length < 2) return [];
  const out: number[] = [];
  for (let i = 1; i < classes; i++) {
    const at = v[Math.min(v.length - 1, Math.floor((i * v.length) / classes))];
    if (!out.length || at > out[out.length - 1]) out.push(at);
  }
  return out;
}

/** The class (0 = lowest) of a value; null for no data, and 0 for no places. */
export function classOf(value: number | null, limits: number[]): number | null {
  if (value === null) return null;
  let c = 0;
  for (const l of limits) if (value >= l) c++;
  return c;
}

export function legend(limits: number[], digits = 0, lang: CareerLang = 'vi'): { color: string; label: string }[] {
  const fmt = (n: number) => n.toLocaleString(localeOf(lang), { maximumFractionDigits: digits });
  const lows = [0, ...limits];
  return lows.map((low, i) => ({
    color: RAMP[Math.min(i, RAMP.length - 1)],
    label: i === lows.length - 1 ? (lang === 'en' ? `${fmt(low)} or more` : `${fmt(low)} trở lên`) : `${fmt(low)}–${fmt(limits[i])}`,
  }));
}

export interface Marker {
  id: string;
  name: string;
  kind: 'now' | 'plan';
  lngLat: [number, number];
}

/** The planned poles and the reference places, as points for the map. */
export function markers(areas: Record<string, WorkArea> = AREAS): Marker[] {
  return Object.values(areas)
    .filter((a) => a.center)
    .map((a) => ({ id: a.id, name: a.name, kind: a.kind, lngLat: a.center as [number, number] }));
}

/** The sectors that are thick around a ward: the most places first, those with none left out. */
export function topSectors<T extends { count: number }>(opportunities: T[], limit = 5): T[] {
  return [...opportunities].filter((o) => o.count > 0).sort((a, b) => b.count - a.count).slice(0, limit);
}
