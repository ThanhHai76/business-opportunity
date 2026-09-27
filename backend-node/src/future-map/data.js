'use strict';
/**
 * ⚠ SCENARIO DATA ⚠
 * Everything here is an illustrative "what could Hanoi look like" scenario for the Hanoi Future Map demo. It is
 * inspired by publicly discussed directions (a multi-centre, green capital region with metro-oriented growth) but it
 * is NOT an official planning map: geometry is approximate, numbers are made up for the demo, and nothing here
 * should be quoted as a plan, forecast or statistic.
 */
const { getSeedData } = require('../living-score/seed/seed-data');
const { circleLine, circleRing, bufferLine } = require('./geo');

const CENTER = [105.852, 21.028];

const SCENARIO_NOTE =
  'Kịch bản minh hoạ lấy cảm hứng từ các định hướng phát triển đã công bố — không phải bản đồ quy hoạch chính thức và không phải dự báo. ' +
  'Vị trí là xấp xỉ, số liệu là giả định của bản demo.';

/** The four points on the timeline. `greenPct` and `population` (million) are scenario assumptions. */
const YEARS = [
  {
    year: 2026,
    label: 'Hiện tại',
    kind: 'present',
    headline: 'Hà Nội hôm nay — đô thị một lõi, metro bắt đầu vận hành',
    greenPct: 21,
    population: 8.7,
  },
  {
    year: 2030,
    label: 'Giai đoạn chuyển tiếp',
    kind: 'plan',
    headline: 'Chuyển tiếp — metro nối dài, vành đai 4 hình thành, các cực mới bắt đầu lộ diện',
    greenPct: 26,
    population: 9.6,
  },
  {
    year: 2050,
    label: 'Kịch bản 2050',
    kind: 'scenario',
    headline: 'Đa trung tâm – Đa cực – Xanh và Thông minh',
    greenPct: 40,
    population: 10.2,
  },
  {
    year: 2100,
    label: 'Kịch bản viễn tưởng',
    kind: 'vision',
    headline: 'Viễn cảnh 2100 — vùng đô thị sông Hồng liên kết với các đô thị vệ tinh',
    greenPct: 44,
    population: 12.4,
  },
];
const YEAR_VALUES = YEARS.map((y) => y.year);

// ---------------------------------------------------------------- growth hubs
/**
 * `year` = first scenario in which the hub appears. `scores` are the mature (2050) values, 0-100; the scenario
 * builder scales them by year and by how many metro lines actually reach the hub in that year.
 */
const HUBS = [
  {
    slug: 'trung-tam',
    name: 'Trung tâm lịch sử',
    role: 'Lõi di sản',
    year: 2026,
    center: [105.85, 21.03],
    radiusKm: 2.6,
    tags: ['metro', 'tod', 'heritage'],
    scores: { development: 62, tod: 80, green: 55, connectivity: 90 },
    blurb: 'Lõi Hoàn Kiếm – Ba Đình được bảo tồn; kịch bản ưu tiên đi bộ, giảm xe cá nhân và giữ mật độ thấp.',
  },
  {
    slug: 'nam-thang-long',
    name: 'Nam Thăng Long',
    role: 'Growth Hub',
    year: 2026,
    center: [105.795, 21.075],
    radiusKm: 3,
    tags: ['metro', 'tod', 'development'],
    scores: { development: 78, tod: 72, green: 68, connectivity: 76 },
    blurb: 'Khu đô thị mới ven Hồ Tây và sông Hồng, gắn với các tuyến metro hướng Tây Bắc.',
  },
  {
    slug: 'ha-dong',
    name: 'Hà Đông',
    role: 'Growth Hub',
    year: 2026,
    center: [105.77, 20.965],
    radiusKm: 3.5,
    tags: ['metro', 'tod', 'development'],
    scores: { development: 80, tod: 82, green: 60, connectivity: 80 },
    blurb: 'Cửa ngõ phía Tây Nam, đã có metro và là điểm đầu của trục phát triển đi Hoà Lạc.',
  },
  {
    slug: 'long-bien',
    name: 'Long Biên',
    role: 'Growth Hub',
    year: 2026,
    center: [105.905, 21.05],
    radiusKm: 3.5,
    tags: ['tod', 'development'],
    scores: { development: 76, tod: 70, green: 62, connectivity: 74 },
    blurb: 'Khu đô thị bên kia sông Hồng, kết nối trung tâm qua các cầu và trục Bắc – Nam phía Đông.',
  },
  {
    slug: 'thanh-tri',
    name: 'Thanh Trì',
    role: 'Growth Hub',
    year: 2026,
    center: [105.86, 20.925],
    radiusKm: 3.5,
    tags: ['metro', 'development', 'green'],
    scores: { development: 74, tod: 68, green: 72, connectivity: 70 },
    blurb: 'Vùng đệm phía Nam với công viên Yên Sở và quỹ đất phát triển dọc trục Pháp Vân – Cầu Giẽ.',
  },
  {
    slug: 'dong-anh',
    name: 'Đông Anh',
    role: 'Growth Hub',
    year: 2026,
    center: [105.85, 21.145],
    radiusKm: 5,
    tags: ['metro', 'tod', 'development', 'airport', 'logistics'],
    scores: { development: 88, tod: 85, green: 70, connectivity: 82 },
    blurb: 'Cực tăng trưởng phía Bắc sông Hồng, gần Nội Bài, kết hợp đô thị mới, thương mại và logistics.',
  },
  {
    slug: 'me-linh',
    name: 'Mê Linh',
    role: 'Đô thị vệ tinh',
    year: 2030,
    center: [105.715, 21.18],
    radiusKm: 4,
    tags: ['development', 'airport'],
    scores: { development: 70, tod: 64, green: 66, connectivity: 68 },
    blurb: 'Đô thị vệ tinh phía Tây Bắc, gắn với hành lang Nội Bài và vùng công nghiệp sạch.',
  },
  {
    slug: 'gia-lam',
    name: 'Gia Lâm',
    role: 'Growth Hub',
    year: 2030,
    center: [105.96, 21.015],
    radiusKm: 4,
    tags: ['tod', 'development', 'logistics'],
    scores: { development: 79, tod: 66, green: 60, connectivity: 72 },
    blurb: 'Cửa ngõ phía Đông với trung tâm logistics và cảng cạn, hướng ra Hải Phòng.',
  },
  {
    slug: 'hoa-lac',
    name: 'Hòa Lạc',
    role: 'Đô thị đổi mới sáng tạo',
    year: 2030,
    center: [105.53, 21.01],
    radiusKm: 6,
    tags: ['metro', 'development', 'green', 'innovation'],
    scores: { development: 84, tod: 72, green: 82, connectivity: 64 },
    blurb: 'Khu công nghệ cao và đổi mới sáng tạo giữa vùng xanh phía Tây, nối trung tâm qua trục Thăng Long.',
  },
  {
    slug: 'soc-son',
    name: 'Sóc Sơn',
    role: 'Đô thị vệ tinh',
    year: 2050,
    center: [105.85, 21.265],
    radiusKm: 5,
    tags: ['airport', 'green', 'development'],
    scores: { development: 72, tod: 60, green: 84, connectivity: 66 },
    blurb: 'Đô thị sân bay – sinh thái phía Bắc, kết nối trực tiếp với Nội Bài.',
  },
  {
    slug: 'son-tay',
    name: 'Sơn Tây',
    role: 'Đô thị vệ tinh',
    year: 2050,
    center: [105.5, 21.135],
    radiusKm: 4,
    tags: ['metro', 'green', 'heritage'],
    scores: { development: 60, tod: 55, green: 90, connectivity: 58 },
    blurb: 'Đô thị di sản và du lịch sinh thái dưới chân núi Ba Vì, giữ mật độ thấp.',
  },
  {
    slug: 'xuan-mai',
    name: 'Xuân Mai',
    role: 'Đô thị vệ tinh',
    year: 2050,
    center: [105.575, 20.9],
    radiusKm: 4,
    tags: ['development', 'green'],
    scores: { development: 68, tod: 58, green: 76, connectivity: 60 },
    blurb: 'Đô thị giáo dục – công nghiệp phía Tây Nam trên hành lang quốc lộ 6.',
  },
  {
    slug: 'phu-xuyen',
    name: 'Phú Xuyên',
    role: 'Đô thị vệ tinh',
    year: 2050,
    center: [105.9, 20.73],
    radiusKm: 5,
    tags: ['airport', 'logistics', 'development'],
    scores: { development: 74, tod: 62, green: 66, connectivity: 72 },
    blurb: 'Cực phía Nam gắn với sân bay thứ hai (kịch bản) và logistics vùng.',
  },
  {
    slug: 'van-giang',
    name: 'Văn Giang (liên kết vùng)',
    role: 'Liên kết vùng',
    year: 2100,
    center: [105.95, 20.915],
    radiusKm: 3.5,
    tags: ['metro', 'development'],
    scores: { development: 70, tod: 58, green: 64, connectivity: 70 },
    blurb: 'Khu liên kết Hà Nội – Hưng Yên trong kịch bản vùng đô thị sông Hồng.',
  },
];

// ---------------------------------------------------------------- metro
const infra = getSeedData().infrastructure.filter((i) => i.kind === 'metro_line');
const seedLine = (prefix) => {
  const line = infra.find((l) => l.name.startsWith(prefix));
  if (!line) throw new Error(`future-map: missing seed metro line "${prefix}"`);
  return line.geometry.coordinates;
};

const METRO_LINES = [
  { id: 'metro-2a', name: 'Tuyến 2A Cát Linh – Hà Đông', color: '#ffb020', year: 2026, coords: seedLine('Tuyến 2A') },
  { id: 'metro-3', name: 'Tuyến 3 Nhổn – Cầu Giấy (trên cao)', color: '#3b9cff', year: 2026, coords: seedLine('Tuyến 3 Nhổn') },
  { id: 'metro-3', name: 'Tuyến 3 Cầu Giấy – Ga Hà Nội (ngầm)', color: '#3b9cff', year: 2030, coords: seedLine('Tuyến 3 Cầu Giấy') },
  {
    id: 'metro-3',
    name: 'Tuyến 3 kéo dài về Hoàng Mai (kịch bản)',
    color: '#3b9cff',
    year: 2050,
    coords: [
      [105.8412, 21.0245],
      [105.85, 21.0],
      [105.86, 20.982],
    ],
  },
  { id: 'metro-2', name: 'Tuyến 2 Nam Thăng Long – Trần Hưng Đạo', color: '#2dd4bf', year: 2050, coords: seedLine('Tuyến 2 Nam') },
  { id: 'metro-1', name: 'Tuyến 1 Yên Viên – Ngọc Hồi', color: '#ff4d6d', year: 2050, coords: seedLine('Tuyến 1 Yên') },
  {
    id: 'metro-airport',
    name: 'Tuyến Trung tâm – Nội Bài – Sóc Sơn (kịch bản)',
    color: '#22d3ee',
    year: 2050,
    coords: [
      [105.85, 21.03],
      [105.845, 21.085],
      [105.85, 21.145],
      [105.815, 21.2],
      [105.807, 21.221],
      [105.84, 21.265],
    ],
  },
  {
    id: 'metro-west',
    name: 'Tuyến Hà Đông – Hòa Lạc – Sơn Tây (kịch bản)',
    color: '#a3e635',
    year: 2050,
    coords: [
      [105.7745, 20.9694],
      [105.7, 20.99],
      [105.62, 21.0],
      [105.53, 21.01],
      [105.505, 21.075],
      [105.5, 21.135],
    ],
  },
  {
    id: 'metro-north',
    name: 'Tuyến Đông Anh – Mê Linh (kịch bản)',
    color: '#f472b6',
    year: 2050,
    coords: [
      [105.85, 21.145],
      [105.78, 21.16],
      [105.715, 21.18],
    ],
  },
  {
    id: 'metro-south',
    name: 'Tuyến Trung tâm – Thanh Trì – Phú Xuyên (kịch bản)',
    color: '#c084fc',
    year: 2100,
    coords: [
      [105.848, 20.975],
      [105.86, 20.925],
      [105.885, 20.83],
      [105.9, 20.73],
    ],
  },
  {
    id: 'metro-east',
    name: 'Tuyến Long Biên – Gia Lâm – Văn Giang (kịch bản)',
    color: '#fb923c',
    year: 2100,
    coords: [
      [105.86, 21.033],
      [105.905, 21.05],
      [105.96, 21.015],
      [105.95, 20.915],
    ],
  },
  {
    id: 'metro-ring',
    name: 'Vành đai metro (kịch bản)',
    color: '#e2e8f0',
    year: 2100,
    coords: circleLine(CENTER, 9, { wobble: 0.04, phase: 1 }),
  },
];

// ---------------------------------------------------------------- roads
const EXPRESSWAYS = [
  {
    name: 'Đại lộ Thăng Long – Hòa Lạc',
    year: 2026,
    coords: [
      [105.8, 21.03],
      [105.72, 21.03],
      [105.62, 21.015],
      [105.53, 21.01],
    ],
  },
  {
    name: 'Nội Bài – Nhật Tân',
    year: 2026,
    coords: [
      [105.83, 21.07],
      [105.822, 21.12],
      [105.805, 21.2],
      [105.807, 21.221],
    ],
  },
  {
    name: 'Pháp Vân – Cầu Giẽ',
    year: 2026,
    coords: [
      [105.85, 20.95],
      [105.86, 20.88],
      [105.88, 20.8],
      [105.9, 20.7],
    ],
  },
  {
    name: 'Hà Nội – Hải Phòng',
    year: 2026,
    coords: [
      [105.9, 21.02],
      [105.98, 21.0],
      [106.08, 20.95],
    ],
  },
  {
    name: 'Hà Nội – Thái Nguyên',
    year: 2030,
    coords: [
      [105.83, 21.14],
      [105.87, 21.22],
      [105.86, 21.32],
    ],
  },
];
const RING_ROADS = [
  { name: 'Vành đai 1', year: 2026, radiusKm: 1.9 },
  { name: 'Vành đai 2', year: 2026, radiusKm: 4.6 },
  { name: 'Vành đai 3', year: 2026, radiusKm: 8.5 },
  { name: 'Vành đai 4', year: 2030, radiusKm: 17 },
  { name: 'Vành đai 5', year: 2050, radiusKm: 30 },
];

// ---------------------------------------------------------------- water & green
const RED_RIVER = [
  [105.42, 21.21],
  [105.48, 21.17],
  [105.55, 21.15],
  [105.62, 21.13],
  [105.7, 21.13],
  [105.76, 21.14],
  [105.8, 21.14],
  [105.82, 21.095],
  [105.842, 21.06],
  [105.858, 21.043],
  [105.872, 21.01],
  [105.888, 20.975],
  [105.9, 20.93],
  [105.91, 20.87],
  [105.92, 20.8],
  [105.93, 20.72],
];
const DUONG_RIVER = [
  [105.875, 21.065],
  [105.93, 21.075],
  [106.0, 21.09],
  [106.08, 21.1],
];
const WEST_LAKE = circleRing([105.822, 21.058], 1.5, { wobble: 0.12, phase: 0.6 });

const GREEN_AREAS = [
  { name: 'Rừng và núi Ba Vì – Sơn Tây', kind: 'park', year: 2026, polygon: [circleRing([105.42, 21.1], 9, { wobble: 0.12, phase: 0.3 })] },
  { name: 'Công viên Yên Sở', kind: 'park', year: 2026, polygon: [circleRing([105.865, 20.96], 1.8, { wobble: 0.1, phase: 1.1 })] },
  { name: 'Vùng xanh Sóc Sơn', kind: 'park', year: 2030, polygon: [circleRing([105.85, 21.315], 6, { wobble: 0.12, phase: 2 })] },
  { name: 'Hành lang xanh sông Hồng', kind: 'corridor', year: 2030, polygon: [bufferLine(RED_RIVER, 1.1)] },
  { name: 'Hành lang xanh sông Đuống', kind: 'corridor', year: 2050, polygon: [bufferLine(DUONG_RIVER, 0.8)] },
  {
    name: 'Vành đai xanh Thủ đô',
    kind: 'belt',
    year: 2050,
    polygon: [circleRing(CENTER, 27, { wobble: 0.07, phase: 0.4 }), circleRing(CENTER, 20, { wobble: 0.07, phase: 0.4 }).reverse()],
  },
];

// ---------------------------------------------------------------- airports & logistics
const AIRPORTS = [
  { name: 'Sân bay Nội Bài', kind: 'airport', status: 'operating', year: 2026, at: [105.807, 21.221] },
  { name: 'Sân bay thứ hai (kịch bản)', kind: 'airport', status: 'scenario', year: 2050, at: [105.92, 20.71] },
  { name: 'Cảng cạn Gia Lâm', kind: 'logistics', status: 'operating', year: 2026, at: [105.975, 21.035] },
  { name: 'Trung tâm logistics Đông Anh', kind: 'logistics', status: 'plan', year: 2030, at: [105.875, 21.19] },
  { name: 'Logistics Phú Xuyên', kind: 'logistics', status: 'scenario', year: 2050, at: [105.915, 20.765] },
];

// ---------------------------------------------------------------- development axes
const AXES = [
  { name: 'Trục Bắc – Nội Bài', slugs: ['trung-tam', 'dong-anh', 'soc-son'] },
  { name: 'Trục Tây – Hòa Lạc', slugs: ['trung-tam', 'ha-dong', 'hoa-lac', 'son-tay'] },
  { name: 'Trục Tây Nam – Xuân Mai', slugs: ['ha-dong', 'xuan-mai'] },
  { name: 'Trục Nam – Phú Xuyên', slugs: ['trung-tam', 'thanh-tri', 'phu-xuyen'] },
  { name: 'Trục Đông – Gia Lâm', slugs: ['trung-tam', 'long-bien', 'gia-lam', 'van-giang'] },
  { name: 'Trục Tây Bắc – Mê Linh', slugs: ['trung-tam', 'nam-thang-long', 'me-linh'] },
  { name: 'Trục Bắc – Nam sông Hồng', slugs: ['dong-anh', 'long-bien', 'thanh-tri'] },
];

module.exports = {
  CENTER,
  SCENARIO_NOTE,
  YEARS,
  YEAR_VALUES,
  HUBS,
  METRO_LINES,
  EXPRESSWAYS,
  RING_ROADS,
  RED_RIVER,
  DUONG_RIVER,
  WEST_LAKE,
  GREEN_AREAS,
  AIRPORTS,
  AXES,
};
