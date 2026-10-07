'use strict';
/**
 * Hanoi Future Map — the Capital Region (Vùng Thủ đô): how Hanoi connects to its neighbouring provinces.
 *
 * - Scope: the 100-year plan (QĐ 2512/QĐ-UBND) studies Hanoi's links with the Capital Region and the neighbouring
 *   provinces Phú Thọ, Thái Nguyên, Bắc Ninh, Hưng Yên, Ninh Bình and Hải Phòng. Province names are the ones after
 *   the 2025 merger of provinces (Resolution 202/2025/QH15); the former names are kept for orientation.
 * - The function of each corridor ("label") is quoted from the VTV24 report on the Capital Region (09/2026); it is
 *   marked as such (`labelSource: 'vtv24'`), never presented as plan text. Facts and infrastructure carry their own
 *   sources, checked when this file was written (30/09/2026).
 * - Geometry is schematic: node positions are town centres, corridors and planned routes are straight or simplified.
 */

const REGION_SOURCES = {
  vtv24Region: {
    title: 'Phóng sự VTV24 về liên kết vùng Thủ đô: chức năng các hướng Thái Nguyên, Bắc Ninh, Hưng Yên, Hải Phòng, Ninh Bình, Phú Thọ (09/2026)',
    publisher: 'VTV24 — Đài Truyền hình Việt Nam',
    url: null,
  },
  qd2512Scope: {
    title: 'Quy hoạch tổng thể Thủ đô tầm nhìn 100 năm: phạm vi, quy mô, định hướng phát triển (19/3/2026)',
    publisher: 'Cổng thông tin điện tử Hà Nội',
    url: 'https://hanoi.gov.vn/infographics/quy-hoach-tong-the-thu-do-tam-nhin-100-nam-pham-vi-quy-mo-dinh-huong-phat-trien-4260319200941471.htm',
  },
  nq202: {
    title: 'Nghị quyết 202/2025/QH15 (12/6/2025) về sắp xếp đơn vị hành chính cấp tỉnh',
    publisher: 'Quốc hội',
    url: 'https://vanban.chinhphu.vn/?pageid=27160&docid=213930',
  },
  phuThoMerger: {
    title: 'Tên gọi, trụ sở 148 xã, phường mới tỉnh Phú Thọ (hợp nhất Phú Thọ, Vĩnh Phúc, Hòa Bình; trung tâm Việt Trì)',
    publisher: 'Báo Tuổi Trẻ',
    url: 'https://tuoitre.vn/ten-goi-dia-chi-tru-so-lam-viec-148-xa-phuong-moi-tinh-phu-tho-20250626163502996.htm',
  },
  giaBinh: {
    title: 'Đại công trường xây dựng sân bay Gia Bình sau hơn 7 tháng thi công (9/4/2026)',
    publisher: 'Báo Dân trí',
    url: 'https://dantri.com.vn/thoi-su/dai-cong-truong-xay-dung-san-bay-gia-binh-sau-hon-7-thang-thi-cong-20260409071102073.htm',
  },
  laoCaiRail: {
    title: 'Dự án đường sắt Lào Cai – Hà Nội – Hải Phòng chậm tiến độ (18/6/2026)',
    publisher: 'Báo Thanh Niên',
    url: 'https://thanhnien.vn/du-an-duong-sat-lao-cai-ha-noi-hai-phong-cham-tien-do-185260618013947087.htm',
  },
  laoCaiRailStart: {
    title: 'Khởi công đồng loạt 5 nhà ga trên tuyến đường sắt Lào Cai – Hà Nội – Hải Phòng (19/12/2025)',
    publisher: 'Báo Chính phủ',
    url: 'https://baochinhphu.vn/khoi-cong-dong-loat-5-nha-ga-tren-tuyen-duong-sat-lao-cai-ha-noi-hai-phong-102251219081744494.htm',
  },
  hsr: {
    title: 'Khi nào khởi công "siêu dự án" đường sắt tốc độ cao Bắc – Nam? (9/9/2026)',
    publisher: 'Autopro',
    url: 'https://autopro.com.vn/khi-nao-khoi-cong-sieu-du-an-duong-sat-toc-do-cao-bac-nam-177260909142430589.chn',
  },
  hsrRoute: {
    title: 'Xây dựng đường sắt tốc độ cao Bắc – Nam (điểm đầu ga Ngọc Hồi, dài khoảng 1.541 km)',
    publisher: 'VnExpress',
    url: 'https://vnexpress.net/xay-dung-duong-sat-toc-do-cao-bac-nam-vao-thang-12-2026-4878208.html',
  },
  ring5: {
    title: 'Hà Nội kiến nghị tăng quy mô đường Vành đai 5 – Vùng Thủ đô từ 6 lên 8 làn xe (1/6/2026)',
    publisher: 'VnEconomy',
    url: 'https://vneconomy.vn/ha-noi-kien-nghi-tang-quy-mo-duong-vanh-dai-5-vung-thu-do-tu-6-len-8-lan-xe.htm',
  },
  bachMai2: {
    title: 'Bệnh viện Bạch Mai cơ sở 2 chính thức hoạt động (26/6/2026)',
    publisher: 'Báo Tuổi Trẻ',
    url: 'https://tuoitre.vn/benh-vien-bach-mai-co-so-2-chinh-thuc-hoat-dong-nguoi-dan-vui-mung-vi-duoc-kham-chua-benh-gan-nha-100260626112256892.htm',
  },
  songCong2: {
    title: 'Phấn đấu hoàn thành Dự án Khu công nghiệp Sông Công II giai đoạn 2 trong năm 2026 (04/2026)',
    publisher: 'Báo Thái Nguyên',
    url: 'https://baothainguyen.vn/thoi-su-thai-nguyen/202604/phan-dau-hoan-thanh-du-an-khu-cong-nghiep-song-cong-ii-giai-doan-2-trong-nam-2026-3ac6d79/',
  },
  hnLogistics: {
    title: 'Hà Nội mở rộng mạng lưới logistics đa phương thức kết nối chuỗi cảng biển giai đoạn 2026–2030',
    publisher: 'Báo Sức khỏe & Đời sống',
    url: 'https://phapluat.suckhoedoisong.vn/ha-noi-mo-rong-mang-luoi-logistics-da-phuong-thuc-ket-noi-chuoi-cang-bien-giai-doan-2026-2030-285726.html',
  },
  osmProvinces: {
    title: 'Ranh giới Hà Nội và 6 tỉnh, thành lân cận (sau sắp xếp 2025) — OpenStreetMap, đã đơn giản hoá',
    publisher: 'OpenStreetMap contributors',
    url: 'https://www.openstreetmap.org/relation/1903516',
  },
  osrm: {
    title: 'Thời gian lái xe tính bằng OSRM trên mạng đường OpenStreetMap (khi đường thông thoáng, chưa tính kẹt xe)',
    publisher: 'Project OSRM / OpenStreetMap contributors',
    url: 'https://project-osrm.org/',
  },
};

/** Themes of the corridors (colours in the frontend). */
const THEMES = {
  industry: { vi: 'Công nghiệp', en: 'Industry' },
  logistics: { vi: 'Logistics', en: 'Logistics' },
  tourism: { vi: 'Du lịch', en: 'Tourism' },
  health: { vi: 'Y tế – dịch vụ', en: 'Health & services' },
};

/** Where every corridor starts on the map: the centre of Hanoi (Hoàn Kiếm). */
const ORIGIN = [105.8542, 21.0285];

const MERGED = ['nq202'];
/**
 * The six directions. `poles` link to the 9 development poles of data.js (which part of Hanoi faces this way);
 * `gateway` names the Hanoi area to live in / look at for this direction on the other pages.
 */
const CORRIDORS = [
  {
    slug: 'thai-nguyen',
    theme: 'industry',
    direction: { vi: 'Hướng Bắc', en: 'North' },
    province: { vi: 'Thái Nguyên', en: 'Thái Nguyên' },
    formerly: { vi: 'Thái Nguyên + Bắc Kạn (trước 7/2025)', en: 'Thái Nguyên + Bắc Kạn (before 07/2025)' },
    destination: [105.8442, 21.5942],
    nodes: [
      { name: 'Phổ Yên', at: [105.873, 21.415] },
      { name: 'Sông Công', at: [105.845, 21.483] },
      { name: 'TP Thái Nguyên', at: [105.8442, 21.5942] },
    ],
    label: { vi: 'Chuỗi đô thị liên kết công nghiệp bán dẫn', en: 'Chain of towns linked by the semiconductor industry' },
    labelSource: 'vtv24Region',
    facts: [
      {
        text: {
          vi: 'Khu công nghiệp Sông Công II giai đoạn 2 phấn đấu hoàn thành trong năm 2026; cụm Sông Công – Phổ Yên nằm dọc cao tốc Hà Nội – Thái Nguyên.',
          en: 'Sông Công II industrial park, phase 2, is due for completion in 2026; the Sông Công – Phổ Yên cluster lies along the Hanoi – Thái Nguyên expressway.',
        },
        sources: ['songCong2'],
      },
    ],
    via: ['exp-thai-nguyen', 'ring5'],
    poles: ['bac'],
    gateway: { living: 'dong-anh', business: null },
  },
  {
    slug: 'bac-ninh',
    theme: 'industry',
    direction: { vi: 'Hướng Đông Bắc', en: 'North-east' },
    province: { vi: 'Bắc Ninh', en: 'Bắc Ninh' },
    formerly: { vi: 'Bắc Ninh + Bắc Giang (trước 7/2025)', en: 'Bắc Ninh + Bắc Giang (before 07/2025)' },
    destination: [106.076, 21.186],
    nodes: [
      { name: 'TP Bắc Ninh', at: [106.076, 21.186] },
      { name: 'Sân bay Gia Bình', at: [106.18, 21.06] },
    ],
    label: { vi: 'Cửa ngõ hàng không mới: sân bay quốc tế Gia Bình', en: 'New air gateway: Gia Bình international airport' },
    labelSource: 'giaBinh',
    facts: [
      {
        text: {
          vi: 'Sân bay quốc tế Gia Bình đang xây dựng theo tiêu chuẩn 4F, công suất khoảng 30 triệu khách/năm đến 2030; mục tiêu khai thác giai đoạn đầu cuối năm 2026, phục vụ APEC 2027.',
          en: 'Gia Bình international airport is under construction to ICAO 4F, about 30 million passengers a year by 2030; first-phase operation is targeted for the end of 2026, for APEC 2027.',
        },
        sources: ['giaBinh'],
      },
      {
        text: {
          vi: 'Quy hoạch 100 năm có trục động lực Hồ Tây – Cổ Loa – sân bay Gia Bình.',
          en: 'The 100-year plan has a West Lake – Cổ Loa – Gia Bình airport dynamic axis.',
        },
        sources: ['qd2512Poles'],
      },
    ],
    via: ['airport-gia-binh', 'ring4', 'ring5'],
    poles: ['bac', 'dong'],
    gateway: { living: 'long-bien', business: 'long-bien' },
  },
  {
    slug: 'hung-yen',
    theme: 'logistics',
    direction: { vi: 'Hướng Đông Nam', en: 'South-east' },
    province: { vi: 'Hưng Yên', en: 'Hưng Yên' },
    formerly: { vi: 'Hưng Yên + Thái Bình (trước 7/2025) — nay có bờ biển', en: 'Hưng Yên + Thái Bình (before 07/2025) — now with a coastline' },
    destination: [106.05, 20.65],
    nodes: [
      { name: 'Mỹ Hào – Phố Nối', at: [106.03, 20.93] },
      { name: 'TP Hưng Yên', at: [106.05, 20.65] },
    ],
    label: { vi: 'Hậu phương sản xuất, logistics thông minh hướng biển', en: 'Production hinterland, smart sea-bound logistics' },
    labelSource: 'vtv24Region',
    facts: [
      {
        text: {
          vi: 'Sau sáp nhập với Thái Bình, tỉnh Hưng Yên mới có bờ biển — hướng ra biển gần nhất về phía Đông Nam của Hà Nội.',
          en: 'Merged with Thái Bình, the new Hưng Yên province has a coastline — the nearest sea outlet south-east of Hanoi.',
        },
        sources: ['nq202'],
      },
      {
        text: {
          vi: 'Giai đoạn 2026–2030 Hà Nội phát triển hạ tầng logistics tích hợp kết nối trực tiếp cảng biển, cửa khẩu.',
          en: 'In 2026–2030 Hanoi is building integrated logistics infrastructure with direct links to seaports and border gates.',
        },
        sources: ['hnLogistics'],
      },
    ],
    via: ['ring4', 'exp-hai-phong', 'ring5'],
    poles: ['dong', 'thuong-tin-phu-xuyen'],
    gateway: { living: 'long-bien', business: 'gia-lam' },
  },
  {
    slug: 'hai-phong',
    theme: 'logistics',
    direction: { vi: 'Hướng Đông', en: 'East' },
    province: { vi: 'TP Hải Phòng', en: 'Hải Phòng city' },
    formerly: { vi: 'Hải Phòng + Hải Dương (trước 7/2025)', en: 'Hải Phòng + Hải Dương (before 07/2025)' },
    destination: [106.68, 20.86],
    nodes: [
      { name: 'Đô thị Hải Dương', at: [106.33, 20.94] },
      { name: 'TP Hải Phòng (cảng biển)', at: [106.68, 20.86] },
    ],
    label: {
      vi: 'Đô thị Hải Dương: trung tâm dịch vụ hỗ trợ công nghiệp, điểm trung chuyển dọc cao tốc 5B nối Thủ đô ra cảng biển',
      en: 'Hải Dương: a centre of industrial support services and a transshipment point on the 5B expressway from the Capital to the seaport',
    },
    labelSource: 'vtv24Region',
    facts: [
      {
        text: {
          vi: 'Tuyến đường sắt Lào Cai – Hà Nội – Hải Phòng đã khởi công 5 nhà ga (19/12/2025), mục tiêu hoàn thành chậm nhất 2030; tuyến chính dự kiến khởi công từ 12/2026 (đang chậm 8–10 tháng).',
          en: 'The Lào Cai – Hanoi – Hải Phòng railway started work on 5 stations (19/12/2025), due by 2030 at the latest; the main line is expected to start from 12/2026 (running 8–10 months late).',
        },
        sources: ['laoCaiRailStart', 'laoCaiRail'],
      },
    ],
    via: ['exp-hai-phong', 'rail-lao-cai-hai-phong', 'ring4', 'ring5'],
    poles: ['dong'],
    gateway: { living: 'long-bien', business: 'gia-lam' },
  },
  {
    slug: 'ninh-binh',
    theme: 'health',
    direction: { vi: 'Hướng Nam', en: 'South' },
    province: { vi: 'Ninh Bình', en: 'Ninh Bình' },
    formerly: { vi: 'Ninh Bình + Hà Nam + Nam Định (trước 7/2025)', en: 'Ninh Bình + Hà Nam + Nam Định (before 07/2025)' },
    destination: [105.975, 20.25],
    nodes: [
      { name: 'Duy Tiên – Đồng Văn', at: [105.93, 20.64] },
      { name: 'Phủ Lý', at: [105.918, 20.54] },
      { name: 'TP Ninh Bình', at: [105.975, 20.25] },
    ],
    label: { vi: 'Cửa ngõ phía Nam: y tế và dịch vụ (Phủ Lý, Duy Tiên)', en: 'Southern gateway: health care and services (Phủ Lý, Duy Tiên)' },
    labelSource: 'vtv24Region',
    facts: [
      {
        text: {
          vi: 'Bệnh viện Bạch Mai cơ sở 2 (1.000 giường) chính thức hoạt động từ 26/6/2026 — hơn 1.500 lượt khám ngày đầu.',
          en: 'Bạch Mai Hospital branch 2 (1,000 beds) opened on 26/06/2026 — over 1,500 patients on its first day.',
        },
        sources: ['bachMai2'],
      },
    ],
    via: ['exp-phap-van', 'hsr', 'ring4', 'ring5'],
    poles: ['thuong-tin-phu-xuyen', 'van-dinh-dai-nghia'],
    gateway: { living: 'hoang-mai', business: null },
  },
  {
    slug: 'phu-tho',
    theme: 'tourism',
    direction: { vi: 'Hướng Tây Bắc', en: 'North-west' },
    province: { vi: 'Phú Thọ', en: 'Phú Thọ' },
    formerly: { vi: 'Phú Thọ + Vĩnh Phúc + Hòa Bình (trước 7/2025)', en: 'Phú Thọ + Vĩnh Phúc + Hòa Bình (before 07/2025)' },
    destination: [105.402, 21.322],
    nodes: [
      { name: 'Vĩnh Yên', at: [105.597, 21.31] },
      { name: 'Việt Trì', at: [105.402, 21.322] },
    ],
    label: { vi: 'Quần thể du lịch sinh thái – tâm linh', en: 'Eco and spiritual tourism cluster' },
    labelSource: 'vtv24Region',
    facts: [
      {
        text: {
          vi: 'Tỉnh Phú Thọ mới hợp nhất Phú Thọ, Vĩnh Phúc, Hòa Bình từ 1/7/2025 (148 xã, phường), trung tâm hành chính tại Việt Trì.',
          en: 'The new Phú Thọ province merges Phú Thọ, Vĩnh Phúc and Hòa Bình from 01/07/2025 (148 communes and wards), with its centre in Việt Trì.',
        },
        sources: ['phuThoMerger', 'nq202'],
      },
    ],
    via: ['exp-lao-cai', 'rail-lao-cai-hai-phong', 'ring5'],
    poles: ['son-tay-ba-vi', 'hoa-lac', 'xuan-mai', 'bac'],
    gateway: { living: 'bac-tu-liem', business: 'nam-tu-liem' },
  },
].map((c) => ({ ...c, year: 2026, sources: [...new Set([...(c.labelSource ? [c.labelSource] : []), 'qd2512Scope', ...MERGED, ...c.facts.flatMap((f) => f.sources)])] }));

/**
 * Regional infrastructure along the corridors. `status`/`openYear` as in data.js: construction counts as
 * operating from its opening year. Expressways in service follow OSM; planned lines are schematic.
 */
const INFRA = [
  {
    id: 'exp-lao-cai',
    kind: 'expressway',
    year: 2026,
    status: 'operating',
    name: { vi: 'Cao tốc Nội Bài – Lào Cai (qua Vĩnh Yên, Việt Trì)', en: 'Nội Bài – Lào Cai expressway (via Vĩnh Yên, Việt Trì)' },
    coords: [[105.807, 21.221], [105.62, 21.29], [105.45, 21.33], [105.3, 21.4]],
    sources: ['osm'],
  },
  {
    id: 'exp-thai-nguyen',
    kind: 'expressway',
    year: 2026,
    status: 'operating',
    name: { vi: 'Cao tốc Hà Nội – Thái Nguyên', en: 'Hanoi – Thái Nguyên expressway' },
    coords: [[105.83, 21.14], [105.86, 21.3], [105.87, 21.42], [105.845, 21.56]],
    sources: ['osm'],
  },
  {
    id: 'exp-hai-phong',
    kind: 'expressway',
    year: 2026,
    status: 'operating',
    name: { vi: 'Cao tốc Hà Nội – Hải Phòng (5B)', en: 'Hanoi – Hải Phòng expressway (5B)' },
    coords: [[105.9, 21.02], [106.05, 20.94], [106.33, 20.9], [106.55, 20.85], [106.72, 20.84]],
    sources: ['osm'],
  },
  {
    id: 'exp-phap-van',
    kind: 'expressway',
    year: 2026,
    status: 'operating',
    name: { vi: 'Cao tốc Pháp Vân – Cầu Giẽ – Ninh Bình', en: 'Pháp Vân – Cầu Giẽ – Ninh Bình expressway' },
    coords: [[105.85, 20.95], [105.9, 20.75], [105.93, 20.6], [105.95, 20.4], [105.98, 20.26]],
    sources: ['osm'],
  },
  {
    id: 'ring5',
    kind: 'ring',
    year: 2035,
    status: 'plan',
    schematic: true,
    name: { vi: 'Vành đai 5 – Vùng Thủ đô (khoảng 340 km, đang lập báo cáo tiền khả thi)', en: 'Ring Road 5 – Capital Region (about 340 km, pre-feasibility study)' },
    coords: [
      [105.57, 20.9], [105.47, 21.13], [105.6, 21.35], [105.85, 21.48], [106.2, 21.3], [106.33, 20.94],
      [106.05, 20.65], [105.92, 20.54], [105.72, 20.68], [105.57, 20.9],
    ],
    sources: ['ring5'],
  },
  {
    id: 'rail-lao-cai-hai-phong',
    kind: 'railway',
    year: 2026,
    status: 'construction',
    openYear: 2030,
    schematic: true,
    name: { vi: 'Đường sắt Lào Cai – Hà Nội – Hải Phòng (khổ tiêu chuẩn)', en: 'Lào Cai – Hanoi – Hải Phòng railway (standard gauge)' },
    coords: [[105.3, 21.4], [105.4, 21.32], [105.62, 21.28], [105.8, 21.14], [105.93, 21.07], [106.1, 20.98], [106.33, 20.93], [106.55, 20.87], [106.8, 20.84]],
    sources: ['laoCaiRailStart', 'laoCaiRail'],
  },
  {
    id: 'hsr',
    kind: 'railway',
    year: 2035,
    status: 'plan',
    schematic: true,
    name: { vi: 'Đường sắt tốc độ cao Bắc – Nam (điểm đầu ga Ngọc Hồi)', en: 'North – South high-speed railway (starts at Ngọc Hồi station)' },
    note: { vi: 'mục tiêu khởi công 12/2027', en: 'groundbreaking targeted for 12/2027' },
    coords: [[105.848, 20.906], [105.9, 20.7], [105.93, 20.52], [105.97, 20.3], [105.95, 20.1]],
    sources: ['hsrRoute', 'hsr'],
  },
  {
    id: 'airport-gia-binh',
    kind: 'airport',
    year: 2026,
    status: 'construction',
    openYear: 2027,
    name: { vi: 'Sân bay quốc tế Gia Bình (Bắc Ninh)', en: 'Gia Bình international airport (Bắc Ninh)' },
    note: { vi: 'tiêu chuẩn 4F, ~30 triệu khách/năm đến 2030; khai thác giai đoạn đầu dự kiến cuối 2026', en: 'ICAO 4F, ~30 million passengers a year by 2030; first phase due end of 2026' },
    at: [106.18, 21.06],
    sources: ['giaBinh'],
  },
  {
    id: 'hospital-bach-mai-2',
    kind: 'hospital',
    year: 2026,
    status: 'operating',
    name: { vi: 'Bệnh viện Bạch Mai cơ sở 2 (Ninh Bình)', en: 'Bạch Mai Hospital branch 2 (Ninh Bình)' },
    note: { vi: '1.000 giường, hoạt động từ 26/6/2026', en: '1,000 beds, open since 26/06/2026' },
    at: [105.92, 20.53],
    sources: ['bachMai2'],
  },
];

/** Ring Road 4 lives in data.js (RING_ROADS); corridors refer to it by this id. */
const EXTERNAL_INFRA = { ring4: { vi: 'Vành đai 4 – Vùng Thủ đô', en: 'Ring Road 4 – Capital Region', status: 'construction', openYear: 2027, sources: ['ring4'] } };

module.exports = { REGION_SOURCES, THEMES, ORIGIN, CORRIDORS, INFRA, EXTERNAL_INFRA };
