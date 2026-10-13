import { CriterionKey } from './pi.models';

/** The six criteria of the potential score, in display order, with the server's default weights (percent). */
export const CRITERIA_KEYS: CriterionKey[] = ['connectivity', 'infrastructure', 'planning', 'amenities', 'population', 'development'];
export type Weights = Record<CriterionKey, number>;
export const DEFAULT_WEIGHTS: Weights = { connectivity: 25, infrastructure: 25, planning: 15, amenities: 15, population: 10, development: 10 };

export const isDefaultWeights = (w: Weights): boolean => CRITERIA_KEYS.every((k) => w[k] === DEFAULT_WEIGHTS[k]);

/**
 * Weighted mean of the criteria that have a value (a commune without a population figure is scored on the others),
 * like the server's score; 0 when every weight is 0.
 */
export function weightedScore(values: Record<CriterionKey, number | null>, w: Weights): number {
  let sum = 0;
  let total = 0;
  for (const k of CRITERIA_KEYS) {
    const v = values[k];
    if (v === null || v === undefined || !w[k]) continue;
    sum += w[k] * v;
    total += w[k];
  }
  return total ? Math.round(sum / total) : 0;
}

/** Score and rank (1 = best, ties share the higher rank order of the list) of every ward under the given weights. */
export function rankWards<T extends { slug: string; values: Record<CriterionKey, number | null> }>(wards: T[], w: Weights): Map<string, { score: number; rank: number }> {
  const scored = wards.map((x) => ({ slug: x.slug, score: weightedScore(x.values, w) })).sort((a, b) => b.score - a.score);
  return new Map(scored.map((x, i) => [x.slug, { score: x.score, rank: i + 1 }]));
}

/** "25,25,15,15,10,10" ⇄ weights, for share links. Invalid input gives null. */
export const encodeWeights = (w: Weights): string => CRITERIA_KEYS.map((k) => w[k]).join(',');
export function decodeWeights(text: string | null | undefined): Weights | null {
  if (!text) return null;
  const parts = text.split(',').map(Number);
  if (parts.length !== CRITERIA_KEYS.length || parts.some((n) => !Number.isInteger(n) || n < 0 || n > 100)) return null;
  if (parts.every((n) => n === 0)) return null;
  return Object.fromEntries(CRITERIA_KEYS.map((k, i) => [k, parts[i]])) as Weights;
}
