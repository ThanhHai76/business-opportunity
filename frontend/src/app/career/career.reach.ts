import { MetroHorizon, MetroPoint } from '../property-intel/pi.models';
import { WardFigure } from './career.jobmap';

/** Drive-time limits offered, in minutes by car with no traffic. Wider limits would cover the whole 79-ward area. */
export const ZONES = [15, 20, 30, 45] as const;
export type Zone = (typeof ZONES)[number];

export interface ZoneSummary {
  /** Wards (home included) within the limit. */
  inRange: Set<string>;
  wards: number;
  total: number;
  /** Places of the chosen sector in the wards within the limit (wards without data count for nothing). */
  places: number;
  /** The wards of the zone with the most places of the sector. */
  top: { slug: string; name: string; count: number }[];
}

/** Which wards can be reached from home within `limit` minutes, and how many places of the sector they hold. */
export function reachSummary(minutes: Record<string, number | null>, limit: number, figures: WardFigure[], topCount = 3): ZoneSummary {
  const inRange = new Set(Object.entries(minutes).filter(([, m]) => m !== null && m <= limit).map(([slug]) => slug));
  const inside = figures.filter((f) => inRange.has(f.slug));
  return {
    inRange,
    wards: inRange.size,
    total: Object.keys(minutes).length,
    places: inside.reduce((sum, f) => sum + (f.count ?? 0), 0),
    top: inside
      .filter((f): f is WardFigure & { count: number } => f.count !== null && f.count > 0)
      .sort((a, b) => b.count - a.count)
      .slice(0, topCount)
      .map((f) => ({ slug: f.slug, name: f.name, count: f.count })),
  };
}

export const METRO_HORIZONS: { id: MetroHorizon; label: string; hint: string }[] = [
  { id: 'now', label: 'Hiện nay', hint: 'Ga đang vận hành' },
  { id: 'soon', label: '2027', hint: 'Thêm các ga đang thi công (đoạn ngầm tuyến 3), dự kiến 2027' },
  { id: 'plan', label: 'Theo quy hoạch', hint: 'Thêm các tuyến theo quy hoạch (khoảng 2035); hành lang chỉ là sơ đồ, chưa có vị trí ga' },
];

/** How a ward is served by metro, seen from home: on a line shared with home, on other lines, or not at all. */
export type MetroClass = 'same' | 'any' | 'none';

export function sharedLines(a: MetroPoint | null | undefined, b: MetroPoint | null | undefined, h: MetroHorizon): string[] {
  if (!a || !b) return [];
  return a.lines[h].filter((l) => b.lines[h].includes(l));
}

export function metroClass(ward: MetroPoint | undefined, home: MetroPoint | null, h: MetroHorizon): MetroClass {
  if (!ward || ward.lines[h].length === 0) return 'none';
  return home && sharedLines(home, ward, h).length ? 'same' : 'any';
}

export type LinkKind = 'direct' | 'transfer' | 'noHome' | 'noPlace';

export interface MetroLink {
  kind: LinkKind;
  /** The lines they have in common (direct). */
  lines: string[];
}

/** Whether home and a place of work are on a common metro line at a horizon: the data has no timetable, so no times. */
export function metroLink(home: MetroPoint | null | undefined, place: MetroPoint | undefined, h: MetroHorizon): MetroLink {
  if (!home || home.lines[h].length === 0) return { kind: 'noHome', lines: [] };
  if (!place || place.lines[h].length === 0) return { kind: 'noPlace', lines: [] };
  const lines = sharedLines(home, place, h);
  return lines.length ? { kind: 'direct', lines } : { kind: 'transfer', lines: [] };
}

export const LINK_TEXT: Record<LinkKind, string> = {
  direct: 'Cùng tuyến',
  transfer: 'Khác tuyến (đổi tuyến, hoặc chưa có đường nối theo dữ liệu)',
  noHome: 'Nhà bạn chưa gần ga',
  noPlace: 'Nơi làm chưa gần ga',
};
