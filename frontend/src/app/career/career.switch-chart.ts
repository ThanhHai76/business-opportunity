import { CASE_IDS, CURVE_MONTHS, CaseId, CaseResult } from './career.switch';

export const CHART = { width: 600, height: 220, left: 46, right: 12, top: 12, bottom: 28 } as const;

export interface ChartData {
  lines: { id: CaseId; d: string }[];
  /** y of the zero line (where the total gain is nil), or null when it is off the chart. */
  zeroY: number | null;
  /** The lowest and highest value drawn, for the labels at the left. */
  min: number;
  max: number;
  /** x and label of the months on the bottom axis. */
  ticks: { x: number; label: string }[];
  /** y of the min and max labels. */
  minY: number;
  maxY: number;
}

/** The three curves of one option as SVG paths (the same drawing is used on the page and on the printed sheet). */
export function chartData(results: Record<CaseId, CaseResult>): ChartData {
  const { width, height, left, right, top, bottom } = CHART;
  const all = CASE_IDS.flatMap((id) => results[id].curve);
  let min = Math.min(0, ...all);
  let max = Math.max(0, ...all);
  if (max - min < 1) {
    max = min + 1;
  }
  const x = (month: number): number => left + (month / CURVE_MONTHS) * (width - left - right);
  const y = (value: number): number => top + (1 - (value - min) / (max - min)) * (height - top - bottom);
  const r = (n: number): string => (Math.round(n * 10) / 10).toString();
  return {
    lines: CASE_IDS.map((id) => ({ id, d: results[id].curve.map((v, m) => `${m === 0 ? 'M' : 'L'}${r(x(m))} ${r(y(v))}`).join(' ') })),
    zeroY: min <= 0 && max >= 0 ? y(0) : null,
    min,
    max,
    ticks: [0, 12, 24, 36, 48, 60].map((m) => ({ x: x(m), label: String(m) })),
    minY: y(min),
    maxY: y(max),
  };
}
