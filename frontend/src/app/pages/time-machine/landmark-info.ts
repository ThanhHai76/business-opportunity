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

/** A dated event in the landmark's history. `year` is what's shown ("1946–47"), `sort` places it on the timeline. */
export interface LandmarkEvent {
  year: string;
  sort: number;
  text: string;
}

export interface LandmarkInfo {
  lngLat: [number, number];
  sources: LandmarkSource[];
}

/**
 * Which of the six eras an event belongs to, so clicking it moves the time slider there.
 * Before 1946 → 1926, 1946–1964 → 1954, 1965–1995 → 1975, from 1996 → 2026.
 */
export function eraForYear(year: number): '1926' | '1954' | '1975' | '2026' {
  if (year < 1946) return '1926';
  if (year < 1965) return '1954';
  if (year < 1996) return '1975';
  return '2026';
}

const ev = (year: string | number, text: string): LandmarkEvent => ({ year: String(year), sort: parseInt(String(year), 10), text });

/** Key events per landmark, oldest first — only facts covered by the landmark's sources. */
export const LANDMARK_EVENTS: Record<string, LandmarkEvent[]> = {
  'hoan-kiem': [
    ev(1865, 'Nguyễn Văn Siêu tu sửa đền Ngọc Sơn, dựng cầu Thê Húc'),
    ev(1886, 'Tháp Rùa được xây trên gò giữa hồ'),
    ev(1954, '10/10: đoàn quân giải phóng tiếp quản Thủ đô'),
    ev(2016, 'Cụ Rùa Hồ Gươm mất (1/2016); phố đi bộ quanh hồ mở từ 9/2016'),
  ],
  'old-quarter': [
    ev(1889, 'Chợ Đồng Xuân khai trương — trung tâm buôn bán của 36 phố phường'),
    ev('1946–47', 'Liên khu I chiến đấu 60 ngày đêm trong lòng phố cổ'),
  ],
  'ba-dinh': [
    ev(1945, '2/9: Chủ tịch Hồ Chí Minh đọc Tuyên ngôn Độc lập tại quảng trường'),
    ev(1954, 'Tiếp quản Thủ đô; Ba Đình trở thành trung tâm chính trị'),
    ev(1975, '29/8: Lăng Chủ tịch Hồ Chí Minh khánh thành'),
  ],
  'van-mieu': [
    ev(1070, 'Vua Lý Thánh Tông cho dựng Văn Miếu'),
    ev(1076, 'Quốc Tử Giám — trường đại học đầu tiên của Việt Nam'),
    ev(1805, 'Khuê Văn Các được xây'),
    ev(2010, '82 bia tiến sĩ được UNESCO công nhận Di sản tư liệu thế giới'),
  ],
  'opera-house': [
    ev(1901, 'Khởi công theo mẫu Nhà hát Opéra Garnier (Paris)'),
    ev(1911, 'Hoàn thành'),
    ev(1945, '19/8: cuộc mít tinh tại quảng trường Nhà hát mở đầu giành chính quyền ở Hà Nội'),
    ev(1997, 'Hoàn tất đợt trùng tu lớn'),
  ],
  'mot-cot': [
    ev(1049, 'Vua Lý Thái Tông dựng chùa hình bông sen trên một cột'),
    ev(1954, '11/9: quân Pháp đặt mìn phá chùa trước khi rút'),
    ev(1955, 'Chùa được dựng lại theo kiến trúc cũ'),
  ],
  'hoang-thanh': [
    ev(1010, 'Lý Thái Tổ dời đô về Thăng Long'),
    ev(1812, 'Cột cờ Hà Nội được xây dưới thời Gia Long'),
    ev(1954, 'Khu thành cổ trở thành nơi làm việc của Bộ Quốc phòng'),
    ev(2010, 'Khu trung tâm Hoàng thành được UNESCO công nhận Di sản thế giới'),
  ],
  'long-bien': [
    ev(1898, 'Khởi công cầu Paul Doumer'),
    ev(1902, 'Khánh thành — cây cầu đầu tiên bắc qua sông Hồng'),
    ev(1954, 'Lính Pháp rút qua cầu; cầu đổi tên thành Long Biên'),
    ev(1967, 'Bị máy bay Mỹ ném bom'),
    ev(1972, 'Nhiều nhịp bị đánh sập, được sửa chữa để thông tuyến'),
  ],
  'nha-tho-lon': [
    ev(1884, 'Khởi công trên nền chùa Báo Thiên cũ'),
    ev(1886, 'Khánh thành dịp Giáng sinh'),
  ],
  'tran-quoc': [
    { year: 'Thế kỷ 6', sort: 545, text: 'Chùa được dựng bên bờ sông Hồng dưới thời Lý Nam Đế' },
    ev(1615, 'Chùa được dời ra gò Kim Ngư giữa hồ'),
    ev(1957, 'Đê Cổ Ngư được tôn tạo và đổi tên thành đường Thanh Niên'),
  ],
  'hoa-lo': [
    ev(1896, 'Người Pháp xây nhà tù trung ương (Maison Centrale)'),
    ev(1954, 'Chính quyền Việt Nam tiếp quản nhà tù'),
    { year: '1964–73', sort: 1968, text: 'Giam giữ phi công Mỹ — "Hanoi Hilton"' },
    ev(1993, 'Phần lớn khu nhà tù bị phá dỡ để xây cao ốc; phần còn lại thành di tích'),
  ],
  'dong-xuan': [
    ev(1889, 'Khai trương với mái tôn năm gian'),
    ev('1946–47', 'Chiến trường ác liệt trong những ngày kháng chiến'),
    ev(1994, 'Hoả hoạn lớn; chợ được xây lại, giữ mặt tiền cũ'),
  ],
  'ga-ha-noi': [
    ev(1902, 'Nhà ga trung tâm (ga Hàng Cỏ) hoàn thành'),
    ev(1972, 'Trúng bom Mỹ; đại sảnh bị đánh sập hoàn toàn'),
    { year: 'Sau 1975', sort: 1976, text: 'Đổi tên thành ga Hà Nội; đại sảnh được xây lại theo kiến trúc mới' },
  ],
};

const wiki = (title: string): LandmarkSource => ({
  title,
  site: 'Wikipedia tiếng Việt',
  url: `https://vi.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, '_'))}`,
});

/** Site label of a landmark's official website (tours link to these). */
export const OFFICIAL_SITE = 'Trang chính thức của di tích';
const OFFICIAL = OFFICIAL_SITE;

export const LANDMARK_INFO: Record<string, LandmarkInfo> = {
  'hoan-kiem': { lngLat: [105.8522, 21.0288], sources: [wiki('Hồ Hoàn Kiếm'), wiki('Tháp Rùa')] },
  'old-quarter': { lngLat: [105.85, 21.0347], sources: [wiki('Khu phố cổ Hà Nội'), wiki('Chợ Đồng Xuân'), wiki('Trận Hà Nội (1946)')] },
  'ba-dinh': { lngLat: [105.8363, 21.0374], sources: [wiki('Quảng trường Ba Đình'), wiki('Lăng Chủ tịch Hồ Chí Minh')] },
  'van-mieu': { lngLat: [105.8355, 21.0285], sources: [
      wiki('Văn Miếu – Quốc Tử Giám'),
      { title: 'Văn Miếu – Quốc Tử Giám', site: OFFICIAL, url: 'https://vanmieu.gov.vn/vi' },
    ],
  },
  'opera-house': { lngLat: [105.8577, 21.0243], sources: [wiki('Nhà hát Lớn Hà Nội')] },
  'mot-cot': { lngLat: [105.8336, 21.0359], sources: [wiki('Chùa Một Cột')] },
  'hoang-thanh': { lngLat: [105.8397, 21.0326], sources: [
      wiki('Hoàng thành Thăng Long'),
      wiki('Cột cờ Hà Nội'),
      { title: 'Hoàng thành Thăng Long', site: OFFICIAL, url: 'https://hoangthanhthanglong.vn/' },
      { title: 'Central Sector of the Imperial Citadel of Thang Long – Hanoi', site: 'UNESCO World Heritage Centre', url: 'https://whc.unesco.org/en/list/1328' },
    ],
  },
  'long-bien': { lngLat: [105.8611, 21.0437], sources: [wiki('Cầu Long Biên')] },
  'nha-tho-lon': { lngLat: [105.8489, 21.0287], sources: [wiki('Nhà thờ Lớn Hà Nội'), wiki('Chùa Báo Thiên')] },
  'tran-quoc': { lngLat: [105.8368, 21.048], sources: [wiki('Chùa Trấn Quốc'), wiki('Hồ Tây')] },
  'hoa-lo': { lngLat: [105.8466, 21.0253], sources: [wiki('Nhà tù Hỏa Lò'), { title: 'Di tích Nhà tù Hỏa Lò', site: OFFICIAL, url: 'https://hoalo.vn/' }] },
  'dong-xuan': { lngLat: [105.8497, 21.0383], sources: [wiki('Chợ Đồng Xuân')] },
  'ga-ha-noi': { lngLat: [105.8413, 21.0245], sources: [wiki('Ga Hà Nội')] },
};

/** Google Maps directions to the landmark (opens the app on phones). */
export function directionsUrl(lngLat: [number, number]): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${lngLat[1]},${lngLat[0]}`;
}
