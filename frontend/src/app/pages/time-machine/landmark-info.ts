/**
 * Where each Time Machine landmark is, and where its stories come from.
 * Coordinates are [lng, lat] (MapLibre order). Sources are the references the historical stories
 * (1926 → 2026) were summarised from; the 2050/2100 scenarios are not sourced.
 */
export interface LandmarkSource {
  title: string;
  /** Publisher shown after the title, e.g. "Wikipedia tiếng Việt". */
  site: string;
  url: string;
}

export interface LandmarkInfo {
  lngLat: [number, number];
  sources: LandmarkSource[];
}

const wiki = (title: string): LandmarkSource => ({
  title,
  site: 'Wikipedia tiếng Việt',
  url: `https://vi.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, '_'))}`,
});

export const LANDMARK_INFO: Record<string, LandmarkInfo> = {
  'hoan-kiem': { lngLat: [105.8522, 21.0288], sources: [wiki('Hồ Hoàn Kiếm'), wiki('Tháp Rùa')] },
  'old-quarter': { lngLat: [105.85, 21.0347], sources: [wiki('Khu phố cổ Hà Nội')] },
  'ba-dinh': { lngLat: [105.8363, 21.0374], sources: [wiki('Quảng trường Ba Đình'), wiki('Lăng Chủ tịch Hồ Chí Minh')] },
  'van-mieu': { lngLat: [105.8355, 21.0285], sources: [wiki('Văn Miếu – Quốc Tử Giám')] },
  'opera-house': { lngLat: [105.8577, 21.0243], sources: [wiki('Nhà hát Lớn Hà Nội')] },
  'mot-cot': { lngLat: [105.8336, 21.0359], sources: [wiki('Chùa Một Cột')] },
  'hoang-thanh': { lngLat: [105.8397, 21.0326], sources: [wiki('Hoàng thành Thăng Long'), wiki('Cột cờ Hà Nội')] },
  'long-bien': { lngLat: [105.8611, 21.0437], sources: [wiki('Cầu Long Biên')] },
  'nha-tho-lon': { lngLat: [105.8489, 21.0287], sources: [wiki('Nhà thờ Lớn Hà Nội'), wiki('Chùa Báo Thiên')] },
  'tran-quoc': { lngLat: [105.8368, 21.048], sources: [wiki('Chùa Trấn Quốc'), wiki('Hồ Tây')] },
  'hoa-lo': { lngLat: [105.8466, 21.0253], sources: [wiki('Nhà tù Hỏa Lò')] },
  'dong-xuan': { lngLat: [105.8497, 21.0383], sources: [wiki('Chợ Đồng Xuân')] },
  'ga-ha-noi': { lngLat: [105.8413, 21.0245], sources: [wiki('Ga Hà Nội')] },
};

/** Google Maps directions to the landmark (opens the app on phones). */
export function directionsUrl(lngLat: [number, number]): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${lngLat[1]},${lngLat[0]}`;
}
