import { AREAS, AREAS_OF, WorkArea } from './career.data';
import { CareerLang, areaIn, localeOf } from './career.local';

export type LngLat = [number, number];

export interface WardPoint {
  slug: string;
  name: string;
  center: LngLat;
}

/** Driving times from a ward (the `travel` of /api/property-intel/wards/:slug): by car, free-flow. */
export interface TravelItems {
  items: { id: string; name: string; minutes: number | null; km: number | null }[];
}

/** Straight-line distance in km (haversine). */
export function lineKm(a: LngLat, b: LngLat): number {
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b[1] - a[1]);
  const dLng = rad(b[0] - a[0]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[1])) * Math.cos(rad(b[1])) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

export type Commute = { kind: 'drive'; minutes: number; km: number } | { kind: 'line'; km: number };

/** How far an area is from a ward: the routed driving time where there is one, a straight line to the pole's centre otherwise. */
export function commuteTo(area: WorkArea, ward: WardPoint, travel: TravelItems | null): Commute | null {
  if (area.routed) {
    const item = travel?.items.find((i) => i.id === area.routed);
    return item && item.minutes !== null && item.km !== null ? { kind: 'drive', minutes: item.minutes, km: item.km } : null;
  }
  return area.center ? { kind: 'line', km: lineKm(ward.center, area.center) } : null;
}

/** The wards whose centres are closest to an area's centre (for "where to live near this work"). */
export function nearestWards(area: WorkArea, wards: WardPoint[], count = 3): { ward: WardPoint; km: number }[] {
  // Only the planned poles: for a reference place the distance is a driving time, and no one chooses a home by it.
  if (area.kind !== 'plan' || !area.center) return [];
  const center = area.center;
  return wards
    .map((ward) => ({ ward, km: lineKm(ward.center, center) }))
    .sort((a, b) => a.km - b.km)
    .slice(0, count);
}

export interface Placement {
  area: WorkArea;
  commute: Commute | null;
  /** Only for planned areas: where to live nearby. */
  near: { ward: WardPoint; km: number }[];
}

/** The areas of a direction with their distance from the ward the visitor lives in (null ward: no distances). */
export function placementsFor(directionId: string, ward: WardPoint | null, wards: WardPoint[], travel: TravelItems | null, lang: CareerLang = 'vi'): Placement[] {
  return (AREAS_OF[directionId] ?? []).map((id) => {
    const area = areaIn(AREAS[id], lang);
    return { area, commute: ward ? commuteTo(area, ward, travel) : null, near: area.kind === 'plan' ? nearestWards(area, wards) : [] };
  });
}

export function commuteText(c: Commute | null, lang: CareerLang = 'vi'): string {
  if (!c) return '';
  const km = c.km.toLocaleString(localeOf(lang), { maximumFractionDigits: 1 });
  if (lang === 'en') return c.kind === 'drive' ? `about ${c.minutes} minutes by car (${km} km, traffic not included)` : `about ${km} km in a straight line (the real route is longer)`;
  return c.kind === 'drive' ? `khoảng ${c.minutes} phút lái xe (${km} km, chưa tính kẹt xe)` : `khoảng ${km} km theo đường chim bay (đường đi thực tế dài hơn)`;
}
