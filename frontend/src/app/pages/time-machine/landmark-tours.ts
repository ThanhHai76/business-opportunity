import { LANDMARK_INFO } from './landmark-info';

/**
 * Suggested walking tours through the Time Machine landmarks. Distances are estimates from the straight
 * line between stops × WALK_FACTOR (streets are never straight); the Google Maps link gives the real route.
 * No opening hours or ticket prices here — those change and have no source in this project.
 */
export interface Tour {
  id: string;
  name: string;
  description: string;
  /** Landmark keys in walking order. */
  stops: string[];
}

export const TOURS: Tour[] = [
  {
    id: 'lake-old-quarter',
    name: 'Hồ Gươm & phố cổ',
    description: 'Từ Tháp Rùa đi qua 36 phố phường, chợ Đồng Xuân rồi ra cầu Long Biên ngắm sông Hồng.',
    stops: ['hoan-kiem', 'old-quarter', 'dong-xuan', 'long-bien'],
  },
  {
    id: 'french-quarter',
    name: 'Khu phố Pháp',
    description: 'Những công trình thời Pháp quanh Hồ Gươm: Nhà thờ Lớn, nhà tù Hỏa Lò và Nhà hát Lớn.',
    stops: ['hoan-kiem', 'nha-tho-lon', 'hoa-lo', 'opera-house'],
  },
  {
    id: 'citadel-ba-dinh',
    name: 'Văn Miếu, Hoàng thành & Ba Đình',
    description: 'Từ ga Hà Nội qua trường đại học đầu tiên, Cột cờ, quảng trường Ba Đình, Chùa Một Cột tới Hồ Tây.',
    stops: ['ga-ha-noi', 'van-mieu', 'hoang-thanh', 'ba-dinh', 'mot-cot', 'tran-quoc'],
  },
];

/** Streets are longer than the straight line; 1.3 is a common rule of thumb for a city grid. */
const WALK_FACTOR = 1.3;
const WALK_KMH = 4.5;

export function haversineKm([lng1, lat1]: [number, number], [lng2, lat2]: [number, number]): number {
  const rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad;
  const dLng = (lng2 - lng1) * rad;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(a));
}

/** Estimated walking km for each leg (index i = from stop i to stop i+1), plus totals. */
export function tourLegs(tour: Tour): { legsKm: number[]; totalKm: number; walkMinutes: number } {
  const coords = tour.stops.map((key) => LANDMARK_INFO[key].lngLat);
  const legsKm = coords.slice(1).map((c, i) => haversineKm(coords[i], c) * WALK_FACTOR);
  const totalKm = legsKm.reduce((sum, km) => sum + km, 0);
  return { legsKm, totalKm, walkMinutes: Math.round((totalKm / WALK_KMH) * 60) };
}

/** Google Maps walking directions through every stop, in order. */
export function tourMapsUrl(tour: Tour): string {
  const point = (key: string) => {
    const [lng, lat] = LANDMARK_INFO[key].lngLat;
    return `${lat},${lng}`;
  };
  const [first, ...rest] = tour.stops;
  const last = rest.pop() ?? first;
  const params = new URLSearchParams({ api: '1', origin: point(first), destination: point(last), travelmode: 'walking' });
  if (rest.length) params.set('waypoints', rest.map(point).join('|'));
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}
