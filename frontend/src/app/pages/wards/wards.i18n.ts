import type { SiteLang } from '../../services/site-lang.service';

/** The words of the ward directory and of each ward's page, in both languages. */
export interface WardsText {
  title: string;
  intro: (n: number) => string;
  search: string;
  kindAll: string;
  kindWard: string;
  kindCommune: string;
  sortLabel: string;
  sortName: string;
  sortPopulation: string;
  sortDensity: string;
  shown: (n: number, total: number) => string;
  none: string;
  loading: string;
  failed: string;
  people: string;
  perKm2: string;
  topSector: string;
  noMapData: string;
  back: string;
  home: string;
  notFound: string;
  facts: string;
  population: (date: string) => string;
  area: string;
  density: string;
  kind: Record<'ward' | 'commune', string>;
  metro: string;
  metroNone: string;
  metroLine: (line: string, km: string) => string;
  opportunities: string;
  opportunitiesNote: string;
  scoreOf: string;
  lowData: string;
  uncovered: string;
  openMap: string;
  openProperty: string;
  sources: string;
}

export const WARDS_TEXT: Record<SiteLang, WardsText> = {
  vi: {
    title: 'Phường/xã của Hà Nội',
    intro: (n) => `${n} phường/xã của Hà Nội sau sắp xếp 2025, với dân số, diện tích và mật độ theo số liệu chính thức. Nơi bản đồ đã phủ sóng có thêm ga metro gần nhất và ngành có điểm cơ hội cao nhất.`,
    search: 'Tìm phường/xã',
    kindAll: 'Tất cả',
    kindWard: 'Phường',
    kindCommune: 'Xã',
    sortLabel: 'Sắp xếp',
    sortName: 'Tên',
    sortPopulation: 'Dân số',
    sortDensity: 'Mật độ',
    shown: (n, total) => `Hiển thị ${n}/${total}`,
    none: 'Không có phường/xã nào khớp.',
    loading: 'Đang tải…',
    failed: 'Không tải được dữ liệu. Vui lòng thử lại.',
    people: 'người',
    perKm2: 'người/km²',
    topSector: 'Ngành nổi bật',
    noMapData: 'Chưa có dữ liệu bản đồ',
    back: '← Tất cả phường/xã',
    home: 'Trang chủ',
    notFound: 'Không tìm thấy phường/xã này.',
    facts: 'Số liệu chính thức',
    population: (date) => `Dân số (${date})`,
    area: 'Diện tích',
    density: 'Mật độ',
    kind: { ward: 'Phường', commune: 'Xã' },
    metro: 'Ga metro gần nhất',
    metroNone: 'Chưa có ga trong khu vực dữ liệu',
    metroLine: (line, km) => `tuyến ${line}, cách ${km} km`,
    opportunities: 'Ngành có điểm cơ hội cao',
    opportunitiesNote: 'Điểm 0-100 so với các phường khác, từ dữ liệu OpenStreetMap; không phải dự báo doanh thu.',
    scoreOf: 'điểm',
    lowData: 'Dữ liệu ít, chỉ tham khảo',
    uncovered: 'Bản đồ chưa phủ khu vực này nên chưa có điểm cơ hội. Dân số và diện tích là số liệu chính thức.',
    openMap: 'Xem trên bản đồ Mở gì ở đâu',
    openProperty: 'Chấm điểm bất động sản',
    sources: 'Nguồn',
  },
  en: {
    title: 'Hanoi wards and communes',
    intro: (n) => `The ${n} wards and communes of Hanoi after the 2025 reorganisation, with population, area and density from official figures. Where the map reaches, you also get the nearest metro station and the sector with the highest opportunity score.`,
    search: 'Search wards and communes',
    kindAll: 'All',
    kindWard: 'Wards',
    kindCommune: 'Communes',
    sortLabel: 'Sort by',
    sortName: 'Name',
    sortPopulation: 'Population',
    sortDensity: 'Density',
    shown: (n, total) => `Showing ${n} of ${total}`,
    none: 'No ward or commune matches.',
    loading: 'Loading…',
    failed: 'Could not load the data. Please try again.',
    people: 'people',
    perKm2: 'people/km²',
    topSector: 'Top sector',
    noMapData: 'Not on the map yet',
    back: '← All wards and communes',
    home: 'Home',
    notFound: 'This ward or commune was not found.',
    facts: 'Official figures',
    population: (date) => `Population (${date})`,
    area: 'Area',
    density: 'Density',
    kind: { ward: 'Ward', commune: 'Commune' },
    metro: 'Nearest metro station',
    metroNone: 'None in the data area',
    metroLine: (line, km) => `line ${line}, ${km} km away`,
    opportunities: 'Sectors with a high opportunity score',
    opportunitiesNote: 'A 0-100 score against other wards, from OpenStreetMap data; not a revenue forecast.',
    scoreOf: 'score',
    lowData: 'Little data, indicative only',
    uncovered: 'The map does not cover this area yet, so there is no opportunity score. Population and area are official figures.',
    openMap: 'See it on the Business Opportunity Map',
    openProperty: 'AI Property Intelligence',
    sources: 'Sources',
  },
};
