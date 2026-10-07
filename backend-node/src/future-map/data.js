'use strict';
/**
 * Hanoi Future Map data — grounded in the approved plans for the capital.
 *
 * Every map object carries a `status` and the ids of the SOURCES it comes from:
 *   operating     exists today (geometry from the project's seed data or drawn after OpenStreetMap)
 *   construction  being built; `openYear` = expected opening, after which it is shown as operating
 *   plan          in an approved plan or a National Assembly resolution, not built yet
 *
 * What is NOT official: all geometry is schematic (approximate centres, simplified routes, ring roads as
 * circles) — the plans' own maps are the reference. Figures are quoted from the sources, never computed.
 * Text is bilingual ({ vi, en }); scenario.js picks the language.
 */
const { getSeedData } = require('../living-score/seed/seed-data');
const { circleRing, bufferLine } = require('./geo');

const CENTER = [105.852, 21.028];

/** Documents and articles the data is taken from (all read when the data was compiled, 09/2026). */
const SOURCES = {
  qd2512: {
    title: 'Quyết định 2512/QĐ-UBND (13/5/2026) — Quy hoạch tổng thể Thủ đô Hà Nội tầm nhìn 100 năm',
    publisher: 'UBND TP Hà Nội',
    url: 'https://vanban.hanoi.gov.vn/van-ban/phe-duyet-quy-hoach-tong-the-thu-do-ha-noi-tam-nhin-100-nam-246238',
  },
  qd2512Poles: {
    title: 'Quy hoạch Hà Nội 100 năm: 9 cực phát triển, 9 trung tâm lớn, 9 trục động lực (29/6/2026)',
    publisher: 'Báo Tiền Phong',
    url: 'https://tienphong.vn/quy-hoach-ha-noi-100-nam-9-cuc-phat-trien-9-trung-tam-lon-9-truc-dong-luc-post1855351.tpo',
  },
  poleRoles: {
    title: 'Hà Nội định hướng 9 cực phát triển (28/1/2026)',
    publisher: 'Quỹ Đầu tư phát triển TP Hà Nội',
    url: 'https://quydautuphattrien.hanoi.gov.vn/ban-tin/ha-noi-dinh-huong-9-cuc-phat-trien-565.html',
  },
  qd2512Population: {
    title: 'Hà Nội thông qua quy hoạch 100 năm (14/5/2026)',
    publisher: 'VnExpress',
    url: 'https://vnexpress.net/ha-noi-thong-qua-quy-hoach-100-nam-5073768.html',
  },
  qd2512Rail: {
    title: 'Hà Nội quy hoạch gần 1.200 km đường sắt (22/5/2026)',
    publisher: 'VnExpress',
    url: 'https://vnexpress.net/ha-noi-quy-hoach-gan-1-200-km-duong-sat-5076288.html',
  },
  qd1668: {
    title: 'Quyết định 1668/QĐ-TTg (27/12/2024) — Điều chỉnh Quy hoạch chung Thủ đô Hà Nội đến năm 2045, tầm nhìn đến năm 2065',
    publisher: 'Thủ tướng Chính phủ',
    url: 'https://vanban.chinhphu.vn/?pageid=27160&docid=212179',
  },
  qd1569: {
    title: 'Quyết định 1569/QĐ-TTg (12/12/2024) — Quy hoạch Thủ đô Hà Nội thời kỳ 2021–2030, tầm nhìn đến năm 2050',
    publisher: 'Thủ tướng Chính phủ',
    url: 'https://vanban.chinhphu.vn/?pageid=27160&docid=211993',
  },
  nq188: {
    title: 'Nghị quyết 188/2025/QH15 — Cơ chế đặc thù phát triển mạng lưới đường sắt đô thị tại Hà Nội, TP.HCM',
    publisher: 'Quốc hội',
    url: 'https://vanban.chinhphu.vn/?docid=212948&pageid=27160',
  },
  railPriority: {
    title: 'Phát triển hệ thống mạng lưới đường sắt đô thị Hà Nội (25/5/2025)',
    publisher: 'Báo Hà Nội Mới',
    url: 'https://hanoimoi.vn/phat-trien-he-thong-mang-luoi-duong-sat-do-thi-ha-noi-703441.html',
  },
  viupRail: {
    title: 'Quy hoạch hệ thống đường sắt đô thị gắn với TOD trong Quy hoạch chung Thủ đô đến 2045, tầm nhìn 2065',
    publisher: 'Viện Quy hoạch đô thị và nông thôn quốc gia (VIUP)',
    url: 'https://www.viup.vn/vn/Quy-hoach-he-thong-giao-thong-cong-cong-trong-do-thi-n211-Quy-hoach-he-thong-duong-sat-do-thi-gan-voi-phat-trien-do-thi-theo-mo-hinh-tod-trong-quy-hoach-chung-thu-do-ha-noi-den-nam-2045-tam-nhin-den-nam-2065-d29279.html',
  },
  ring4: {
    title: 'Đường vành đai 4 (Hà Nội)',
    publisher: 'Wikipedia tiếng Việt',
    url: 'https://vi.wikipedia.org/wiki/%C4%90%C6%B0%E1%BB%9Dng_v%C3%A0nh_%C4%91ai_4_(H%C3%A0_N%E1%BB%99i)',
  },
  airport2: {
    title: 'Vị trí dự tính để Hà Nội xây dựng sân bay thứ hai nằm ở đâu?',
    publisher: 'Báo Nhân Dân',
    url: 'https://nhandan.vn/vi-tri-du-tinh-de-ha-noi-xay-dung-san-bay-thu-hai-nam-o-dau-post948307.html',
  },
  population2024: {
    title: 'Hà Nội thực hiện hiệu quả các mục tiêu về dân số (dân số trung bình 2024: 8.666.136 người)',
    publisher: 'Chi cục Dân số TP Hà Nội',
    url: 'https://dansohanoi.gov.vn/news/Bao-cao/ha-noi-thuc-hien-hieu-qua-cac-muc-tieu-ve-dan-so-774.html',
  },
  osm: {
    title: 'OpenStreetMap — hiện trạng đường, sông, hồ, sân bay (vẽ lại dạng sơ đồ)',
    publisher: 'OpenStreetMap contributors',
    url: 'https://www.openstreetmap.org/#map=11/21.03/105.85',
  },
};

const NOTE = {
  vi:
    'Dữ liệu lấy từ các quy hoạch đã phê duyệt (QĐ 2512/QĐ-UBND 2026, QĐ 1668/QĐ-TTg và 1569/QĐ-TTg 2024) và Nghị quyết 188/2025/QH15 — mỗi đối tượng ghi nguồn. ' +
    'Hình học là sơ đồ gần đúng (vị trí cực, hướng tuyến, vành đai), không thay thế bản vẽ quy hoạch chính thức.',
  en:
    'Data comes from the approved plans (Decision 2512/QĐ-UBND 2026, Decisions 1668/QĐ-TTg and 1569/QĐ-TTg 2024) and Resolution 188/2025/QH15 — every object cites its source. ' +
    'Geometry is schematic (pole locations, routes, ring roads) and does not replace the official plan drawings.',
};

/**
 * The timeline follows the milestones of the 100-year plan (QĐ 2512). `population` and `railKm` are quoted
 * figures (million people / km of urban rail and mass transit), with the source of each.
 */
const YEARS = [
  {
    year: 2026,
    kind: 'present',
    label: { vi: 'Hiện trạng', en: 'Today' },
    headline: { vi: 'Hà Nội hôm nay: 2 tuyến metro đang chạy, Vành đai 4 đang thi công', en: 'Hanoi today: 2 metro lines running, Ring Road 4 under construction' },
    population: { min: 8.67, max: 8.67, note: { vi: 'dân số trung bình năm 2024', en: 'average population, 2024' }, sources: ['population2024'] },
    railKm: { value: 21.6, note: { vi: 'đang vận hành: tuyến 2A (13,1 km) + đoạn trên cao tuyến 3 (8,5 km)', en: 'in service: line 2A (13.1 km) + elevated part of line 3 (8.5 km)' }, sources: ['viupRail'] },
  },
  {
    year: 2035,
    kind: 'plan',
    label: { vi: 'Mốc 2035', en: '2035 milestone' },
    headline: { vi: 'Mục tiêu: đô thị xanh, thông minh, hiện đại', en: 'Goal: a green, smart, modern city' },
    population: { min: 14, max: 15, note: { vi: 'dự báo', en: 'forecast' }, sources: ['qd2512Population'] },
    railKm: { value: 500, note: { vi: 'mục tiêu khoảng 500 km đường sắt đô thị', en: 'target: about 500 km of urban rail' }, sources: ['qd2512Rail'] },
  },
  {
    year: 2045,
    kind: 'plan',
    label: { vi: 'Mốc 2045', en: '2045 milestone' },
    headline: { vi: 'Mục tiêu: một trung tâm đổi mới sáng tạo quan trọng', en: 'Goal: a major centre of innovation' },
    population: { min: 15, max: 16, note: { vi: 'dự báo', en: 'forecast' }, sources: ['qd2512Population'] },
    railKm: { value: 979, note: { vi: 'hoàn thành mạng đường sắt đô thị và vận tải khối lượng lớn (979 km)', en: 'urban rail and mass-transit network complete (979 km)' }, sources: ['qd2512Rail'] },
  },
  {
    year: 2065,
    kind: 'vision',
    label: { vi: 'Tầm nhìn 2065', en: '2065 vision' },
    headline: { vi: 'Tầm nhìn: thành phố toàn cầu, phát triển cao và bền vững', en: 'Vision: a global city, highly and sustainably developed' },
    population: { min: 17, max: 19, note: { vi: 'dự báo; khống chế tối đa không quá 20 triệu', en: 'forecast; capped at 20 million' }, sources: ['qd2512Population'] },
    railKm: { value: 979, note: { vi: 'mạng lưới theo quy hoạch (979 km)', en: 'network in the plan (979 km)' }, sources: ['qd2512Rail'] },
  },
];
const YEAR_VALUES = YEARS.map((y) => y.year);

// ---------------------------------------------------------------- the 9 development poles (QĐ 2512)
/**
 * `center`/`radiusKm` are approximate (the centre of the districts named), for drawing only. `year` is when
 * the pole is first shown: the central area exists today, the others are shown from the first plan milestone.
 */
const POLE_SOURCES = ['qd2512Poles', 'poleRoles'];
const HUBS = [
  {
    slug: 'trung-tam',
    year: 2026,
    center: [105.83, 21.02],
    radiusKm: 5.5,
    tags: ['heritage', 'metro'],
    name: { vi: 'Đô thị trung tâm (hữu ngạn sông Hồng)', en: 'Central city (right bank of the Red River)' },
    area: { vi: 'Lõi lịch sử và vùng mở rộng hữu ngạn sông Hồng', en: 'Historic core and its extension on the right bank' },
    role: { vi: 'Lõi lịch sử mở rộng — cực văn hoá, lịch sử, chính trị', en: 'Extended historic core — the cultural, historical and political pole' },
  },
  {
    slug: 'bac',
    year: 2035,
    center: [105.8, 21.18],
    radiusKm: 8,
    tags: ['airport', 'innovation'],
    name: { vi: 'Cực phía Bắc: Đông Anh – Mê Linh – Sóc Sơn', en: 'North pole: Đông Anh – Mê Linh – Sóc Sơn' },
    area: { vi: 'Đông Anh, Mê Linh, Sóc Sơn', en: 'Đông Anh, Mê Linh, Sóc Sơn' },
    role: { vi: 'Dịch vụ quốc tế, thương mại, tài chính, logistics gắn với sân bay Nội Bài và công nghiệp công nghệ cao', en: 'International services, trade, finance and logistics tied to Nội Bài airport and high-tech industry' },
  },
  {
    slug: 'dong',
    year: 2035,
    center: [105.93, 21.03],
    radiusKm: 5,
    tags: ['logistics'],
    name: { vi: 'Cực phía Đông: Gia Lâm – Long Biên', en: 'East pole: Gia Lâm – Long Biên' },
    area: { vi: 'Gia Lâm, Long Biên', en: 'Gia Lâm, Long Biên' },
    role: { vi: 'Cửa ngõ phía Đông: thương mại, dịch vụ, logistics hiện đại gắn Quốc lộ 5 và cao tốc Hà Nội – Hải Phòng', en: 'Eastern gateway: trade, services and modern logistics along National Route 5 and the Hanoi – Hai Phong expressway' },
  },
  {
    slug: 'thuong-tin-phu-xuyen',
    year: 2035,
    center: [105.88, 20.8],
    radiusKm: 7,
    tags: ['logistics', 'airport'],
    name: { vi: 'Cực phía Nam: Thường Tín – Phú Xuyên', en: 'South pole: Thường Tín – Phú Xuyên' },
    area: { vi: 'Thường Tín, Phú Xuyên', en: 'Thường Tín, Phú Xuyên' },
    role: { vi: 'Công nghiệp, logistics, đầu mối giao thông đa phương thức gắn sân bay phía Nam và đường sắt tốc độ cao', en: 'Industry, logistics and a multimodal hub tied to the southern airport and high-speed rail' },
  },
  {
    slug: 'van-dinh-dai-nghia',
    year: 2035,
    center: [105.76, 20.71],
    radiusKm: 5,
    tags: ['green', 'heritage'],
    name: { vi: 'Cực phía Nam: Vân Đình – Đại Nghĩa', en: 'South pole: Vân Đình – Đại Nghĩa' },
    area: { vi: 'Vân Đình, Đại Nghĩa', en: 'Vân Đình, Đại Nghĩa' },
    role: { vi: 'Đô thị sinh thái, cảnh quan sông nước, gắn di sản và sân bay phía Nam', en: 'Eco-city of rivers and landscape, tied to heritage and the southern airport' },
  },
  {
    slug: 'xuan-mai',
    year: 2035,
    center: [105.6, 20.9],
    radiusKm: 5,
    tags: ['green'],
    name: { vi: 'Cực Tây Nam: Xuân Mai – Chương Mỹ', en: 'South-west pole: Xuân Mai – Chương Mỹ' },
    area: { vi: 'Xuân Mai, Chương Mỹ', en: 'Xuân Mai, Chương Mỹ' },
    role: { vi: 'Giáo dục – đào tạo, y tế và du lịch sinh thái', en: 'Education and training, healthcare and eco-tourism' },
  },
  {
    slug: 'hoa-lac',
    year: 2035,
    center: [105.52, 21.01],
    radiusKm: 6,
    tags: ['innovation', 'green'],
    name: { vi: 'Cực phía Tây: Hòa Lạc', en: 'West pole: Hòa Lạc' },
    area: { vi: 'Hòa Lạc (Khu công nghệ cao, Đại học Quốc gia)', en: 'Hòa Lạc (Hi-Tech Park, National University)' },
    role: { vi: 'Đô thị khoa học công nghệ, đổi mới sáng tạo', en: 'City of science, technology and innovation' },
  },
  {
    slug: 'son-tay-ba-vi',
    year: 2035,
    center: [105.47, 21.12],
    radiusKm: 6.5,
    tags: ['heritage', 'green'],
    name: { vi: 'Cực Tây Bắc: Sơn Tây – Ba Vì', en: 'North-west pole: Sơn Tây – Ba Vì' },
    area: { vi: 'Sơn Tây, Ba Vì', en: 'Sơn Tây, Ba Vì' },
    role: { vi: 'Đô thị văn hoá – lịch sử, du lịch, gắn nhiệm vụ quốc phòng', en: 'Cultural-historical city and tourism, with defence functions' },
  },
  {
    slug: 'song-hong',
    year: 2035,
    center: [105.87, 21.045],
    radiusKm: 2.5,
    tags: ['green'],
    name: { vi: 'Cực không gian sông Hồng', en: 'Red River space pole' },
    area: { vi: 'Hai bờ sông Hồng qua đô thị trung tâm', en: 'Both banks of the Red River through the central city' },
    role: { vi: 'Cực cảnh quan đặc biệt: tài chính, thương mại, dịch vụ, du lịch', en: 'Special landscape pole: finance, trade, services and tourism' },
  },
].map((hub) => ({ ...hub, status: hub.year === 2026 ? 'operating' : 'plan', sources: POLE_SOURCES }));

// ---------------------------------------------------------------- urban rail
const infra = getSeedData().infrastructure.filter((i) => i.kind === 'metro_line');
const seedLine = (prefix) => {
  const line = infra.find((l) => l.name.startsWith(prefix));
  if (!line) throw new Error(`future-map: missing seed metro line "${prefix}"`);
  return line.geometry.coordinates;
};

const PRIORITY = ['nq188', 'railPriority'];
/**
 * Lines in service, under construction, and the priority projects listed under Resolution 188/2025/QH15.
 * The rest of the 979 km network is only counted in the timeline figures: its routes are not drawn.
 * Routes marked `schematic` are simplified (start – via – end), not alignments.
 */
const METRO_LINES = [
  { id: 'metro-2a', color: '#ffb020', year: 2026, status: 'operating', sources: ['viupRail'], coords: seedLine('Tuyến 2A'), name: { vi: 'Tuyến 2A Cát Linh – Hà Đông', en: 'Line 2A Cát Linh – Hà Đông' }, note: { vi: '13,1 km, 12 ga, vận hành từ 2021', en: '13.1 km, 12 stations, in service since 2021' } },
  { id: 'metro-3', color: '#3b9cff', year: 2026, status: 'operating', sources: ['viupRail'], coords: seedLine('Tuyến 3 Nhổn'), name: { vi: 'Tuyến 3 Nhổn – Cầu Giấy (trên cao)', en: 'Line 3 Nhổn – Cầu Giấy (elevated)' }, note: { vi: '8,5 km trên cao, vận hành thương mại từ 8/2024', en: '8.5 km elevated, in commercial service since 08/2024' } },
  { id: 'metro-3', color: '#3b9cff', year: 2026, status: 'construction', openYear: 2027, sources: ['viupRail', 'railPriority'], coords: seedLine('Tuyến 3 Cầu Giấy'), name: { vi: 'Tuyến 3 Cầu Giấy – Ga Hà Nội (ngầm)', en: 'Line 3 Cầu Giấy – Hanoi Station (underground)' }, note: { vi: 'đoạn ngầm khoảng 4–4,5 km (các nguồn ghi khác nhau), mục tiêu hoàn thành 2027', en: 'about 4–4.5 km underground (sources differ), due 2027' } },
  { id: 'metro-3', color: '#3b9cff', year: 2035, status: 'plan', schematic: true, sources: PRIORITY, coords: [[105.8412, 21.0245], [105.848, 20.99], [105.862, 20.966]], name: { vi: 'Tuyến 3 kéo dài Ga Hà Nội – Yên Sở', en: 'Line 3 extension Hanoi Station – Yên Sở' }, note: { vi: 'dự án ưu tiên', en: 'priority project' } },
  { id: 'metro-2', color: '#2dd4bf', year: 2035, status: 'plan', sources: PRIORITY, coords: seedLine('Tuyến 2 Nam'), name: { vi: 'Tuyến 2 Nam Thăng Long – Trần Hưng Đạo', en: 'Line 2 Nam Thăng Long – Trần Hưng Đạo' }, note: { vi: 'dự án ưu tiên', en: 'priority project' } },
  { id: 'metro-2', color: '#2dd4bf', year: 2035, status: 'plan', schematic: true, sources: PRIORITY, coords: [[105.852, 21.021], [105.835, 21.005], [105.815, 20.996]], name: { vi: 'Tuyến 2 Trần Hưng Đạo – Thượng Đình', en: 'Line 2 Trần Hưng Đạo – Thượng Đình' }, note: { vi: 'dự án ưu tiên', en: 'priority project' } },
  { id: 'metro-2', color: '#2dd4bf', year: 2035, status: 'plan', schematic: true, sources: PRIORITY, coords: [[105.795, 21.075], [105.8, 21.14], [105.807, 21.215]], name: { vi: 'Tuyến 2 Nam Thăng Long – Nội Bài', en: 'Line 2 Nam Thăng Long – Nội Bài' }, note: { vi: 'dự án ưu tiên', en: 'priority project' } },
  { id: 'metro-2a', color: '#ffb020', year: 2035, status: 'plan', schematic: true, sources: PRIORITY, coords: [[105.7745, 20.9694], [105.7, 20.94], [105.577, 20.899]], name: { vi: 'Tuyến 2A kéo dài Hà Đông – Xuân Mai', en: 'Line 2A extension Hà Đông – Xuân Mai' }, note: { vi: 'dự án ưu tiên', en: 'priority project' } },
  { id: 'metro-5', color: '#a3e635', year: 2035, status: 'plan', schematic: true, sources: PRIORITY, coords: [[105.818, 21.042], [105.812, 21.03], [105.8, 21.02], [105.7, 21.02], [105.53, 21.01]], name: { vi: 'Tuyến 5 Văn Cao – Ngọc Khánh – Láng – Hòa Lạc', en: 'Line 5 Văn Cao – Ngọc Khánh – Láng – Hòa Lạc' }, note: { vi: 'dự án ưu tiên', en: 'priority project' } },
  { id: 'metro-1', color: '#ff4d6d', year: 2035, status: 'plan', sources: PRIORITY, coords: seedLine('Tuyến 1 Yên'), name: { vi: 'Tuyến 1 Yên Viên – Ngọc Hồi', en: 'Line 1 Yên Viên – Ngọc Hồi' }, note: { vi: 'dự án ưu tiên', en: 'priority project' } },
];

// ---------------------------------------------------------------- roads
/** Existing expressways and avenues (as on OpenStreetMap), drawn as simplified lines. */
const EXPRESSWAYS = [
  { year: 2026, status: 'operating', sources: ['osm'], name: { vi: 'Đại lộ Thăng Long', en: 'Thăng Long Avenue' }, coords: [[105.8, 21.03], [105.72, 21.03], [105.62, 21.015], [105.53, 21.01]] },
  { year: 2026, status: 'operating', sources: ['osm'], name: { vi: 'Đường Võ Nguyên Giáp (Nhật Tân – Nội Bài)', en: 'Võ Nguyên Giáp road (Nhật Tân – Nội Bài)' }, coords: [[105.83, 21.07], [105.822, 21.12], [105.805, 21.2], [105.807, 21.221]] },
  { year: 2026, status: 'operating', sources: ['osm'], name: { vi: 'Cao tốc Pháp Vân – Cầu Giẽ', en: 'Pháp Vân – Cầu Giẽ expressway' }, coords: [[105.85, 20.95], [105.86, 20.88], [105.88, 20.8], [105.9, 20.7]] },
  { year: 2026, status: 'operating', sources: ['osm'], name: { vi: 'Cao tốc Hà Nội – Hải Phòng', en: 'Hanoi – Hai Phong expressway' }, coords: [[105.9, 21.02], [105.98, 21.0], [106.08, 20.95]] },
  { year: 2026, status: 'operating', sources: ['osm'], name: { vi: 'Cao tốc Hà Nội – Thái Nguyên', en: 'Hanoi – Thái Nguyên expressway' }, coords: [[105.83, 21.14], [105.87, 21.22], [105.86, 21.32]] },
];
/** Ring roads, drawn as circles at roughly their distance from the centre. */
const RING_ROADS = [
  { year: 2026, status: 'operating', sources: ['osm'], radiusKm: 1.9, name: { vi: 'Vành đai 1', en: 'Ring Road 1' } },
  { year: 2026, status: 'operating', sources: ['osm'], radiusKm: 4.6, name: { vi: 'Vành đai 2', en: 'Ring Road 2' } },
  { year: 2026, status: 'operating', sources: ['osm'], radiusKm: 8.5, name: { vi: 'Vành đai 3', en: 'Ring Road 3' } },
  {
    year: 2026,
    status: 'construction',
    openYear: 2027,
    sources: ['ring4'],
    radiusKm: 17,
    name: { vi: 'Vành đai 4 – Vùng Thủ đô', en: 'Ring Road 4 – Capital Region' },
    note: { vi: '112,8 km (58,2 km qua Hà Nội), khởi công 6/2023, dự kiến khai thác 2027', en: '112.8 km (58.2 km in Hanoi), started 06/2023, due to open 2027' },
  },
];

// ---------------------------------------------------------------- water & green
const RED_RIVER = [
  [105.42, 21.21], [105.48, 21.17], [105.55, 21.15], [105.62, 21.13], [105.7, 21.13], [105.76, 21.14], [105.8, 21.14], [105.82, 21.095],
  [105.842, 21.06], [105.858, 21.043], [105.872, 21.01], [105.888, 20.975], [105.9, 20.93], [105.91, 20.87], [105.92, 20.8], [105.93, 20.72],
];
const DUONG_RIVER = [[105.875, 21.065], [105.93, 21.075], [106.0, 21.09], [106.08, 21.1]];
const WEST_LAKE = circleRing([105.822, 21.058], 1.5, { wobble: 0.12, phase: 0.6 });

const GREEN_AREAS = [
  { kind: 'park', year: 2026, status: 'operating', sources: ['osm'], name: { vi: 'Vườn quốc gia Ba Vì', en: 'Ba Vì National Park' }, polygon: [circleRing([105.38, 21.07], 7, { wobble: 0.12, phase: 0.3 })] },
  { kind: 'park', year: 2026, status: 'operating', sources: ['osm'], name: { vi: 'Công viên Yên Sở', en: 'Yên Sở Park' }, polygon: [circleRing([105.865, 20.96], 1.8, { wobble: 0.1, phase: 1.1 })] },
  { kind: 'park', year: 2026, status: 'operating', sources: ['osm'], name: { vi: 'Rừng Sóc Sơn', en: 'Sóc Sơn forest' }, polygon: [circleRing([105.85, 21.315], 5, { wobble: 0.12, phase: 2 })] },
  {
    kind: 'corridor',
    year: 2035,
    status: 'plan',
    sources: ['qd2512', 'qd2512Poles'],
    name: { vi: 'Trục cảnh quan sinh thái – văn hoá sông Hồng', en: 'Red River ecological and cultural landscape axis' },
    polygon: [bufferLine(RED_RIVER, 1.1)],
  },
  {
    kind: 'belt',
    year: 2035,
    status: 'plan',
    schematic: true,
    sources: ['qd1668'],
    name: { vi: 'Hành lang xanh, nêm xanh ngăn cách các đô thị (sơ đồ)', en: 'Green corridors and wedges between the towns (schematic)' },
    polygon: [circleRing(CENTER, 27, { wobble: 0.07, phase: 0.4 }), circleRing(CENTER, 20, { wobble: 0.07, phase: 0.4 }).reverse()],
  },
];

// ---------------------------------------------------------------- airports
const AIRPORTS = [
  { kind: 'airport', year: 2026, status: 'operating', sources: ['osm'], at: [105.807, 21.221], name: { vi: 'Cảng hàng không quốc tế Nội Bài', en: 'Nội Bài International Airport' } },
  {
    kind: 'airport',
    year: 2045,
    status: 'plan',
    sources: ['airport2', 'qd1668'],
    at: [105.78, 20.7],
    name: { vi: 'Cảng hàng không thứ hai vùng Thủ đô (vị trí nghiên cứu)', en: 'Second Capital Region airport (site under study)' },
    note: { vi: 'phía Nam, khu vực Ứng Hòa; khoảng 1.500 ha; ưu tiên giai đoạn 2031–2045', en: 'in the south, around Ứng Hòa; about 1,500 ha; priority for 2031–2045' },
  },
];

// ---------------------------------------------------------------- the 9 dynamic axes (QĐ 2512)
/** Drawn as schematic connectors between the poles they link (`river: true` follows the Red River). */
const AXES = [
  { slugs: ['trung-tam', 'bac'], name: { vi: 'Trục Nhật Tân – Nội Bài, Bắc Thăng Long – Nội Bài', en: 'Nhật Tân – Nội Bài and Bắc Thăng Long – Nội Bài axis' }, theme: { vi: 'hội nhập quốc tế', en: 'international integration' } },
  { slugs: ['trung-tam', 'bac'], name: { vi: 'Trục Hồ Tây – Cổ Loa – sân bay Gia Bình', en: 'West Lake – Cổ Loa – Gia Bình airport axis' }, theme: { vi: 'văn hoá, lịch sử, kinh tế', en: 'culture, history and economy' } },
  { slugs: ['trung-tam', 'dong'], name: { vi: 'Trục Quốc lộ 5 / cao tốc Hà Nội – Hải Phòng', en: 'National Route 5 / Hanoi – Hai Phong expressway axis' }, theme: { vi: 'thương mại, dịch vụ logistics', en: 'trade and logistics services' } },
  { slugs: ['trung-tam', 'thuong-tin-phu-xuyen'], name: { vi: 'Trục Quốc lộ 1A / cao tốc Pháp Vân – Cầu Giẽ', en: 'National Route 1A / Pháp Vân – Cầu Giẽ expressway axis' }, theme: { vi: 'công nghiệp hỗ trợ, logistics phía Nam', en: 'supporting industry and southern logistics' } },
  { slugs: ['trung-tam', 'van-dinh-dai-nghia'], name: { vi: 'Trục Quốc lộ 21B / Quốc lộ 21C', en: 'National Route 21B / 21C axis' }, theme: { vi: 'văn hoá – du lịch và dịch vụ hỗ trợ', en: 'culture, tourism and support services' } },
  { slugs: ['trung-tam', 'xuan-mai'], name: { vi: 'Trục Quốc lộ 6 / Hà Đông – Xuân Mai', en: 'National Route 6 / Hà Đông – Xuân Mai axis' }, theme: { vi: 'đô thị sinh thái, cửa ngõ Tây Bắc', en: 'eco-city and north-west gateway' } },
  { slugs: ['trung-tam', 'hoa-lac', 'son-tay-ba-vi'], name: { vi: 'Trục Đại lộ Thăng Long / Hồ Tây – Ba Vì', en: 'Thăng Long Avenue / West Lake – Ba Vì axis' }, theme: { vi: 'khoa học công nghệ, văn hoá vùng', en: 'science, technology and regional culture' } },
  { slugs: ['trung-tam', 'son-tay-ba-vi'], name: { vi: 'Trục Quốc lộ 32 / Tây Thăng Long', en: 'National Route 32 / Tây Thăng Long axis' }, theme: { vi: 'kết nối văn hoá, di sản', en: 'cultural and heritage links' } },
  { slugs: [], river: true, name: { vi: 'Trục cảnh quan sông Hồng', en: 'Red River landscape axis' }, theme: { vi: 'tài chính, thương mại, du lịch', en: 'finance, trade and tourism' } },
].map((axis) => ({ ...axis, year: 2035, status: 'plan', schematic: true, sources: ['qd2512Poles'] }));

module.exports = {
  CENTER,
  SOURCES,
  NOTE,
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
