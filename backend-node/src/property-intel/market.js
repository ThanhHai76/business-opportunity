'use strict';
/**
 * AI Property Intelligence — apartment market of Hanoi and real projects, as published (every number cites its source).
 *
 *   QUARTERS  city-wide figures from CBRE Vietnam's quarterly briefings (as reported by the press), plus Savills' Q2/2026
 *             average. CBRE's "whole market" average covers Hanoi and nearby projects; the Q1/2026 briefing also gave a
 *             Hanoi-only figure. Prices exclude VAT and maintenance fee, before discounts (million VND per m²).
 *   PROJECTS  apartment projects whose price was published in 2026, at their OpenStreetMap location. `kind` says what
 *             the price is: an asking price for new units ('offer'), an expected launch price ('expected') or resale
 *             asking prices surveyed by the newspaper ('listing'). Not transaction prices.
 *
 *           'broker' is a broker's quote reported by the press; 'social' is a social-housing price (provisional until the
 *           Department of Construction appraises it).
 * A project whose location the price article does not give takes it from another cited article (`locationSource`).
 *
 * Quarterly update (CBRE briefs the press in the first weeks after each quarter, Savills a few weeks later):
 *   1. add the article to SOURCES (title with the date, publisher, url);
 *   2. append the quarter to QUARTERS (primary, secondary or its change, launched, sold, absorption) and/or update SAVILLS;
 *      mark derived figures (`launchedDerived`);
 *   3. add projects whose price the press published, with their OpenStreetMap location;
 *   4. `npm run data:travel` for the new projects' driving times, then `npm test`.
 */

const SOURCES = {
  cbreQ4_2025: {
    title: 'CBRE: giá sơ cấp trung bình toàn thị trường Hà Nội quý IV/2025 hơn 78 triệu đồng/m², 14.905 căn mở bán, hơn 13.500 căn bán được (15/1/2026)',
    titleEn: 'CBRE: Hanoi Q4/2025 whole-market primary average over VND 78 million/m², 14,905 units launched, over 13,500 sold (15/01/2026)',
    publisher: 'Báo Dân trí',
    url: 'https://dantri.com.vn/bat-dong-san/can-ho-co-gia-tren-120-trieu-dongm2-lap-ky-luc-moi-20260115092918998.htm',
  },
  cbreQ1_2026: {
    title: 'CBRE: chung cư Hà Nội quý I/2026 — 8.010 căn mở bán, 5.382 căn bán được, giá sơ cấp 84 triệu đồng/m² toàn thị trường, 102 triệu tại Hà Nội (23/4/2026)',
    titleEn: 'CBRE: Hanoi condominiums Q1/2026 — 8,010 units launched, 5,382 sold, primary VND 84 million/m² whole market, 102 million in Hanoi (23/04/2026)',
    publisher: 'Reatimes',
    url: 'https://reatimes.vn/chung-cu-ha-noi-quy-i-2026-nguon-cung-moi-lap-dinh-sau-5-nam-mat-bang-gia-cham-nguong-100-trieu-m2-202260423002950668.htm',
  },
  cbreQ2_2026: {
    title: 'CBRE: Hà Nội quý II/2026 — 16.600 căn mở bán nửa đầu năm, hơn 5.800 căn bán được trong quý (68%), giá trung bình xấp xỉ 95 triệu đồng/m² (7/7/2026)',
    titleEn: 'CBRE: Hanoi Q2/2026 — 16,600 units launched in H1, over 5,800 sold in the quarter (68%), average about VND 95 million/m² (07/07/2026)',
    publisher: 'Thời báo Tài chính Việt Nam',
    url: 'https://thoibaotaichinhvietnam.vn/ha-noi-suc-hap-thu-cua-thi-truong-can-ho-co-dau-hieu-chung-lai-200293.html',
  },
  savillsQ2_2026: {
    title: 'Savills: giá chào bán sơ cấp căn hộ Hà Nội quý II/2026 khoảng 116 triệu đồng/m², tăng 16% theo quý, 27% theo năm (13/8/2026)',
    titleEn: 'Savills: Hanoi primary apartment asking price Q2/2026 about VND 116 million/m², +16% QoQ, +27% YoY (13/08/2026)',
    publisher: 'Người Quan Sát',
    url: 'https://nguoiquansat.vn/chung-cu-ha-noi-quy-ii-2026-gia-tang-16-can-ho-duoi-70-trieu-m2-gan-nhu-bien-mat-310176.html',
  },
  launches2026: {
    title: 'Loạt dự án chung cư Hà Nội mở bán đầu năm 2026: giá trung bình đạt 100 triệu đồng/m² (20/3/2026)',
    titleEn: 'Hanoi apartment projects launched in early 2026: average VND 100 million/m² (20/03/2026)',
    publisher: 'Người Quan Sát',
    url: 'https://nguoiquansat.vn/loat-du-an-chung-cu-ha-noi-mo-ban-dau-nam-2026-gia-trung-binh-dat-100-trieu-dong-m2-280422.html',
  },
  listings2026: {
    title: 'Giá căn hộ Hà Nội lên 128 triệu đồng/m² — khảo sát giá rao bán một số dự án (24/4/2026)',
    titleEn: 'Hanoi apartment prices reach VND 128 million/m² — survey of asking prices at several projects (24/04/2026)',
    publisher: 'VietNamNet',
    url: 'https://vietnamnet.vn/gia-can-ho-ha-noi-len-128-trieu-dong-m2-thi-truong-thu-cap-bat-dau-giam-gia-2509927.html',
  },
  listingsAug2026: {
    title: 'Chung cư Hà Nội lên tới 123 triệu đồng/m² — giá rao bán một số dự án căn hộ (21/8/2026)',
    titleEn: 'Hanoi condominiums up to VND 123 million/m² — asking prices at several apartment projects (21/08/2026)',
    publisher: 'VietNamNet',
    url: 'https://vietnamnet.vn/chung-cu-ha-noi-len-toi-123-trieu-dong-m2-xuat-hien-dieu-dang-chu-y-2547628.html',
  },
  parkCentric2026: {
    title: 'Chung cư Hà Nội Park Centric: mới bắt đầu thi công, môi giới đã chào giá tới 150 triệu đồng/m² (21/3/2026)',
    titleEn: 'Hà Nội Park Centric: construction just started, brokers already quote up to VND 150 million/m² (21/03/2026)',
    publisher: 'VietnamFinance',
    url: 'https://vietnamfinance.vn/chung-cu-ha-noi-park-centric-moi-bat-dau-thi-cong-moi-gioi-da-chao-gia-toi-150-trieu-dong-m2-d141858.html',
  },
  social2026: {
    title: 'Điểm danh loạt dự án nhà ở xã hội ở Hà Nội mở bán, khởi công năm 2026 (4/3/2026)',
    titleEn: 'Social housing projects in Hanoi opening for sale or starting construction in 2026 (04/03/2026)',
    publisher: 'Báo Xây dựng',
    url: 'https://batdongsan.baoxaydung.vn/diem-danh-loat-du-an-nha-o-xa-hoi-o-ha-noi-mo-ban-khoi-cong-nam-2026-192260304181649362.htm',
  },
  socialPrices2026: {
    title: 'Nhà ở xã hội tại Hà Nội thiết lập mặt bằng giá mới (4/3/2026)',
    titleEn: 'Social housing in Hanoi sets a new price level (04/03/2026)',
    publisher: 'CafeF',
    url: 'https://cafef.vn/nha-o-xa-hoi-tai-ha-noi-thiet-lap-mat-bang-gia-moi-188260304101733767.chn',
  },
  minhGiang2026: {
    title: 'Hà Nội sắp mở bán căn hộ chung cư giá 24 triệu/m² — nhà ở xã hội Minh Giang – Đầm Và, xã Mê Linh (18/8/2026)',
    titleEn: 'Hanoi to sell apartments at VND 24 million/m² — Minh Giang – Đầm Và social housing, Mê Linh (18/08/2026)',
    publisher: 'Vietstock',
    url: 'https://vietstock.vn/2026/08/ha-noi-sap-mo-ban-can-ho-chung-cu-gia-24-trieum2-4222-1482398.htm',
  },
  savillsProjects2026: {
    title: 'Savills: Top 15 chung cư mới đáng chú ý tại Hà Nội 2026 — vị trí dự án (16/7/2026)',
    titleEn: 'Savills: 15 notable new condominiums in Hanoi 2026 — project locations (16/07/2026)',
    publisher: 'Savills Việt Nam',
    url: 'https://www.savills.co.nz/blog/article/237994-0/vietnam-viet/du-an-moi-tai-ha-noi.aspx',
  },
};

/** City-wide quarters (CBRE). `launched` for Q2/2026 is derived: 16,600 in H1 − 8,010 in Q1. */
const QUARTERS = [
  { quarter: 'Q4/2025', primary: 78, secondary: 62, launched: 14_905, sold: 13_500, source: 'cbreQ4_2025' },
  { quarter: 'Q1/2026', primary: 84, primaryHanoi: 102, secondary: 62, launched: 8_010, sold: 5_382, source: 'cbreQ1_2026' },
  { quarter: 'Q2/2026', primary: 95, secondaryChangeQoQ: -3, launched: 8_590, launchedDerived: true, sold: 5_800, absorptionPct: 68, source: 'cbreQ2_2026' },
];
const SAVILLS = { quarter: 'Q2/2026', primary: 116, qoqPct: 16, yoyPct: 27, note: { vi: 'không có nguồn cung mới dưới 70 triệu đồng/m²', en: 'no new supply below VND 70 million/m²' }, source: 'savillsQ2_2026' };
const LATEST = QUARTERS.at(-1);

const KIND = {
  offer: { vi: 'giá chào bán sơ cấp', en: 'primary asking price' },
  expected: { vi: 'giá dự kiến mở bán', en: 'expected launch price' },
  listing: { vi: 'giá rao bán do báo khảo sát', en: 'asking price surveyed by the press' },
  broker: { vi: 'giá môi giới chào, báo đưa tin', en: 'broker quote reported by the press' },
  social: { vi: 'nhà ở xã hội, giá tạm tính', en: 'social housing, provisional price' },
};

/** `osm` is the OpenStreetMap object the location comes from; `approx` marks a location taken from the ward named in the article. */
const PROJECTS = [
  { slug: 'vinhomes-metropolis', name: 'Vinhomes Metropolis', coords: [105.81513, 21.03146], osm: 'way/840982441', min: 192, max: 258, kind: 'listing', source: 'listings2026', street: 'Liễu Giai – Kim Mã' },
  { slug: 'd-le-roi-soleil', name: "D'. Le Roi Soleil", coords: [105.82696, 21.0653], osm: 'way/870823032', min: 170, max: 223, kind: 'listing', source: 'listings2026', street: 'Xuân Diệu' },
  { slug: 'vinhomes-skylake', name: 'Vinhomes Skylake', coords: [105.78182, 21.02002], osm: 'relation/21425898', min: 140, max: 178, kind: 'listing', source: 'listings2026', street: 'Phạm Hùng' },
  { slug: 'hoang-thanh-tower', name: 'Hoàng Thành Tower', coords: [105.8506, 21.0114], osm: 'way/839899590', min: 180, max: 212, kind: 'listing', source: 'listings2026', street: 'Mai Hắc Đế' },
  {
    slug: 'imperia-sky-park',
    name: 'Imperia Sky Park',
    coords: [105.72377, 21.00948],
    osm: 'way/1503809106',
    min: 90,
    max: 100,
    kind: 'offer',
    source: 'launches2026',
    street: 'An Khánh',
    note: { vi: 'liền kề Vinhomes Smart City và tuyến metro số 5 (Văn Cao – Hòa Lạc)', en: 'next to Vinhomes Smart City and metro line 5 (Văn Cao – Hòa Lạc)' },
  },
  { slug: 'metropoli-5', name: 'Metropoli 5', coords: [105.73066, 21.00638], osm: 'way/1503809107', min: 96, max: 96, kind: 'offer', source: 'launches2026', street: 'An Khánh' },
  {
    slug: 'ct14-mandala',
    name: 'CT14 Mandala',
    coords: null,
    approxWard: 'phuong-yen-so',
    osm: null,
    min: 80,
    max: 90,
    kind: 'expected',
    source: 'launches2026',
    street: 'Yên Sở',
    note: { vi: 'khoảng 190 căn hộ 2–3 phòng ngủ', en: 'about 190 two- and three-bedroom units' },
  },
  {
    slug: 'dong-luc-tower',
    name: 'Động Lực Tower',
    coords: [105.80998, 20.99001],
    osm: 'way/1547126793',
    min: 120,
    max: 120,
    kind: 'offer',
    source: 'launches2026',
    street: 'Khương Đình',
    note: { vi: 'một tòa 24 tầng', en: 'one 24-storey tower' },
  },
  { slug: 'handico-complex', name: 'Handico Complex', coords: [105.80248, 21.00339], osm: 'way/1436615523', min: 110, max: 120, kind: 'offer', source: 'launches2026', street: 'Lê Văn Lương' },
  { slug: 'rivea-residences', name: 'Rivea Residences', coords: [105.87694, 20.99504], osm: 'way/1511491223', min: 120, max: 120, kind: 'offer', source: 'launches2026', street: 'Vĩnh Hưng' },
  {
    slug: 'an-binh-homeland',
    name: 'An Bình Home Land',
    coords: [105.74173, 20.98592],
    osm: 'way/1454445031',
    min: 70,
    max: 80,
    kind: 'offer',
    source: 'launches2026',
    street: 'Dương Nội',
    note: { vi: 'gần Aeon Mall Hà Đông', en: 'near Aeon Mall Hà Đông' },
  },
  {
    slug: 'the-flame-vine',
    name: 'The Flame Vine (Hinode Royal Park)',
    coords: [105.71793, 21.05544],
    osm: 'way/1117319950',
    approx: true,
    min: 70,
    max: null,
    kind: 'offer',
    source: 'launches2026',
    street: 'Hoài Đức',
    note: { vi: 'giá "trên 70 triệu đồng/m²"; vị trí là khu đô thị Hinode Royal Park', en: 'price "over VND 70 million/m²"; location is the Hinode Royal Park urban area' },
  },
  // ---------------------------------------------------------------- added 10/2026
  { slug: 'hateco-laroma', name: 'Hateco Laroma', coords: [105.80395, 21.02171], osm: 'way/1128134179', min: 133, max: 140, kind: 'listing', source: 'listingsAug2026', street: 'Huỳnh Thúc Kháng' },
  {
    slug: 'bamboo-airways-tower',
    name: 'Bamboo Airways Tower',
    coords: [105.79472, 21.0342],
    osm: 'way/843817901',
    min: 97,
    max: 103,
    kind: 'listing',
    source: 'listingsAug2026',
    street: '265 Cầu Giấy',
    note: { vi: 'toà tại 265 Cầu Giấy (OpenStreetMap ghi tên The West)', en: 'the tower at 265 Cầu Giấy (named The West on OpenStreetMap)' },
  },
  { slug: 'song-hong-park-view', name: 'Sông Hồng Park View', coords: [105.81713, 21.01461], osm: 'way/1082814006', min: 98, max: 105, kind: 'listing', source: 'listingsAug2026', street: 'Thái Hà' },
  { slug: 'sunshine-garden', name: 'Sunshine Garden', coords: [105.87092, 20.99237], osm: 'way/872186252', min: 80, max: 87, kind: 'listing', source: 'listingsAug2026', street: 'Dương Văn Bé' },
  {
    slug: 'hanoi-park-centric',
    name: 'Hà Nội Park Centric',
    coords: null,
    approxWard: 'phuong-bo-de',
    osm: null,
    min: 130,
    max: 150,
    kind: 'broker',
    source: 'parkCentric2026',
    street: 'Lý Sơn',
    note: { vi: 'lô N0-22, cầu vượt nút giao Long Biên; mới bắt đầu thi công', en: 'plot N0-22 by the Long Biên interchange; construction just started' },
  },
  {
    slug: 'lumiere-essence-peak',
    name: 'Lumiere Essence Peak',
    coords: [105.86464, 21.08938],
    osm: 'way/1332178977',
    approx: true,
    min: 140,
    max: 170,
    kind: 'offer',
    source: 'launches2026',
    locationSource: 'savillsProjects2026',
    street: 'Global Gate, Đông Anh',
    note: { vi: 'căn có thang máy riêng khoảng 200 triệu đồng/m²; vị trí là khu đô thị Global Gate', en: 'private-lift units about VND 200 million/m²; location is the Global Gate urban area' },
  },
  {
    slug: 'noxh-ha-dinh-n01',
    name: 'Nhà ở xã hội N01 Hạ Đình',
    coords: [105.80378, 20.98527],
    osm: 'way/1209467129',
    min: 25,
    max: 25,
    kind: 'social',
    source: 'social2026',
    street: 'Hạ Đình',
    note: { vi: 'giá khoảng 25 triệu đồng/m²; dự kiến hoàn thành quý IV/2027', en: 'about VND 25 million/m²; due to be completed Q4/2027' },
  },
  {
    slug: 'noxh-486-ngoc-hoi',
    name: 'Nhà ở xã hội 486 Ngọc Hồi',
    coords: null,
    approxWard: 'xa-ngoc-hoi',
    osm: null,
    min: 24.7,
    max: 24.7,
    kind: 'social',
    source: 'socialPrices2026',
    street: '486 Ngọc Hồi',
    note: { vi: '160 căn nhà ở xã hội trong toà 15 tầng; căn 40–59 m² từ 988 triệu đồng', en: '160 social-housing units in a 15-storey block; 40–59 m² units from VND 988 million' },
  },
  {
    slug: 'noxh-tay-nam-kim-giang',
    name: 'Nhà ở xã hội KĐT Tây Nam Kim Giang',
    coords: null,
    approxWard: 'phuong-dinh-cong',
    osm: null,
    min: 28,
    max: 28,
    kind: 'social',
    source: 'social2026',
    street: '300 Nguyễn Xiển',
    note: { vi: 'giá khoảng 28 triệu đồng/m²; dự kiến bàn giao quý II/2027', en: 'about VND 28 million/m²; handover due Q2/2027' },
  },
  {
    slug: 'noxh-kim-hoa-ct2',
    name: 'Nhà ở xã hội CT2 KĐT Kim Hoa',
    coords: [105.73649, 21.22835],
    osm: 'node/13230585339',
    approx: true,
    min: 19.8,
    max: 19.8,
    kind: 'social',
    source: 'socialPrices2026',
    street: 'Kim Hoa, Mê Linh',
    note: { vi: '648 căn bán và 72 căn thuê mua; căn 62,8–69,8 m² giá 1,24–1,38 tỷ đồng', en: '648 units for sale and 72 for rent-to-own; 62.8–69.8 m² units at VND 1.24–1.38 billion' },
  },
  {
    slug: 'noxh-tan-lap',
    name: 'Nhà ở xã hội Tân Lập (Đan Phượng)',
    coords: [105.71225, 21.08545],
    osm: 'relation/17985280',
    approx: true,
    min: 29,
    max: 29,
    kind: 'social',
    source: 'socialPrices2026',
    street: 'Tân Lập, Ô Diên',
    note: { vi: '459 căn trong toà 21 tầng; vị trí là xã Tân Lập cũ', en: '459 units in a 21-storey block; location is the former Tân Lập commune' },
  },
  {
    slug: 'noxh-minh-giang-dam-va',
    name: 'Nhà ở xã hội Minh Giang – Đầm Và',
    coords: null,
    approxWard: 'xa-me-linh',
    osm: null,
    min: 24,
    max: 24,
    kind: 'social',
    source: 'minhGiang2026',
    street: 'Mê Linh',
    note: { vi: '793 căn (713 căn bán); dự kiến mở bán quý I/2027', en: '793 units (713 for sale); sales expected Q1/2027' },
  },
];

module.exports = { SOURCES, QUARTERS, SAVILLS, LATEST, KIND, PROJECTS };
