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
 * Lumiere Essence Peak (140–170 million VND/m², same article) is left out: the article gives no location.
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
];

module.exports = { SOURCES, QUARTERS, SAVILLS, LATEST, KIND, PROJECTS };
