'use strict';
/**
 * AI Property Intelligence — the REAL-DATA model, by ward/commune of Hanoi (after the 2025 reorganisation).
 *
 * Sources (all snapshots on disk, nothing fetched at request time):
 *   - wards, population (01/07/2025, gis.vn), apartments, construction land  ← opportunity/data/hanoi-wards.json (OSM)
 *   - schools, hospitals/clinics, shops, parks, bus stops                     ← living-score/data/osm-hanoi.json (OSM)
 *   - metro lines and stations in service / under construction                ← Living Score seed (OSM)
 *   - planned metro lines, the 9 development poles of the 100-year plan       ← future-map/data.js (approved plans, cited)
 *   - Ring Road 4, Red River bridges under construction, construction sites   ← property-intel/data/infra-osm.json (OSM)
 *
 * Potential score (0-100) of a ward = weighted mean of six criteria, each relative between the wards:
 *   connectivity 25%   distance to the nearest metro station in service (100 within 500 m, 0 from 5 km) + bus stops/km²
 *   infrastructure 25% metro, bridges and Ring Road 4 being built (×1) or planned (×0.5) within 4 km
 *   planning 15%       inside one of the development poles of the 100-year plan (Decision 2512/QĐ-UBND, 2026); the existing
 *                      central city counts half — the plan grows the new poles and eases density in the core
 *   amenities 15%      schools, hospitals/clinics, supermarkets/markets/malls and parks per km² (OSM)
 *   population 10%     residents per km² (01/07/2025) — missing for some communes: the score then uses the other five
 *   development 10%    construction land and apartment buildings per km² (OSM)
 * Prices are real and cited too: the official land price table of 2026 by ward (data/land-price.json, `npm run
 * data:landprice`), and the apartment market and projects as published by CBRE, Savills and the press (market.js).
 */
const fs = require('node:fs');
const path = require('node:path');
const WARDS_DATA = require('../opportunity/data/hanoi-wards.json');
const OSM = require('../living-score/data/osm-hanoi.json');
const { getSeedData } = require('../living-score/seed/seed-data');
const FM = require('../future-map/data');
const MK = require('./market');
const LAND = require('./data/land-price.json');

const INFRA_FILE = path.join(__dirname, 'data', 'infra-osm.json');
const INFRA_OSM = fs.existsSync(INFRA_FILE)
  ? JSON.parse(fs.readFileSync(INFRA_FILE, 'utf8'))
  : { osmBase: null, ring4: { lines: [], km: 0 }, bridges: [], construction: [] };

const HORIZONS = [2026, 2030, 2045];
const TOD_RADIUS_M = 800;
const round1 = (n) => Math.round(n * 10) / 10;
const round2 = (n) => Math.round(n * 100) / 100;
const L = (text, lang) => (text && typeof text === 'object' ? (text[lang] ?? text.vi) : text);

// ---------------------------------------------------------------- geometry (equirectangular, fine at city scale)
const KM_LAT = 110.574;
const kmLng = (lat) => 111.32 * Math.cos((lat * Math.PI) / 180);
const distKm = (a, b) => Math.hypot((b[0] - a[0]) * kmLng((a[1] + b[1]) / 2), (b[1] - a[1]) * KM_LAT);

function segmentKm(p, a, b) {
  const k = kmLng(p[1]);
  const [ax, ay, bx, by, px, py] = [a[0] * k, a[1] * KM_LAT, b[0] * k, b[1] * KM_LAT, p[0] * k, p[1] * KM_LAT];
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  const t = len2 ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2)) : 0;
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}
/** Shortest distance (km) from a point to any of the lines. */
function linesKm(p, lines) {
  let best = Infinity;
  for (const line of lines) {
    if (line.length === 1) best = Math.min(best, distKm(p, line[0]));
    for (let i = 1; i < line.length; i++) best = Math.min(best, segmentKm(p, line[i - 1], line[i]));
  }
  return best;
}
function inRing([x, y], ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
const inPolygon = (p, rings) => inRing(p, rings[0]) && !rings.slice(1).some((hole) => inRing(p, hole));
function inGeometry(p, geometry) {
  if (geometry.type === 'Polygon') return inPolygon(p, geometry.coordinates);
  return geometry.coordinates.some((poly) => inPolygon(p, poly));
}
function bboxOf(geometry) {
  const polys = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;
  const b = [Infinity, Infinity, -Infinity, -Infinity];
  for (const poly of polys) for (const [x, y] of poly[0]) [b[0], b[1], b[2], b[3]] = [Math.min(b[0], x), Math.min(b[1], y), Math.max(b[2], x), Math.max(b[3], y)];
  return b;
}

// ---------------------------------------------------------------- sources
const fmSource = (id) => ({ id, ...FM.SOURCES[id] });
const SOURCES = {
  population: {
    title: 'Ranh giới và dân số phường/xã mới (1/7/2025) — thẻ population trên OpenStreetMap, nguồn gis.vn',
    titleEn: 'Boundaries and population of the new wards/communes (01/07/2025) — OpenStreetMap population tag, source gis.vn',
    publisher: 'OpenStreetMap contributors / gis.vn',
    url: 'https://www.openstreetmap.org/relation/1903516',
  },
  osmAmenities: {
    title: `Trường học, bệnh viện/phòng khám, siêu thị/chợ, công viên, điểm xe buýt, ga metro — OpenStreetMap (${OSM.osmBase?.slice(0, 10) ?? '—'})`,
    titleEn: `Schools, hospitals/clinics, supermarkets/markets, parks, bus stops, metro stations — OpenStreetMap (${OSM.osmBase?.slice(0, 10) ?? '—'})`,
    publisher: 'OpenStreetMap contributors (ODbL)',
    url: 'https://www.openstreetmap.org/copyright',
  },
  osmDevelopment: {
    title: `Công trường (landuse=construction) và chung cư — OpenStreetMap (${WARDS_DATA.osmBase?.slice(0, 10) ?? '—'})`,
    titleEn: `Construction sites (landuse=construction) and apartment buildings — OpenStreetMap (${WARDS_DATA.osmBase?.slice(0, 10) ?? '—'})`,
    publisher: 'OpenStreetMap contributors (ODbL)',
    url: 'https://www.openstreetmap.org/copyright',
  },
  osmInfra: {
    title: `Hình học Vành đai 4 và các cầu sông Hồng đang xây — OpenStreetMap (${INFRA_OSM.osmBase?.slice(0, 10) ?? '—'})`,
    titleEn: `Geometry of Ring Road 4 and the Red River bridges under construction — OpenStreetMap (${INFRA_OSM.osmBase?.slice(0, 10) ?? '—'})`,
    publisher: 'OpenStreetMap contributors (ODbL)',
    url: 'https://www.openstreetmap.org/copyright',
  },
  bridges2025: {
    title: 'Hà Nội quyết định thời gian xây dựng cầu Tứ Liên, cầu Trần Hưng Đạo và cầu Ngọc Hồi (thực hiện 2025–2027)',
    titleEn: 'Hanoi sets the construction period of the Tứ Liên, Trần Hưng Đạo and Ngọc Hồi bridges (2025–2027)',
    publisher: 'Báo Nhân Dân',
    url: 'https://nhandan.vn/ha-noi-chot-thoi-gian-xay-dung-cau-tu-lien-va-cau-tran-hung-dao-post861645.html',
  },
  tranHungDao: {
    title: 'Cầu Trần Hưng Đạo 16.200 tỷ đồng đã hoàn thành toàn bộ cọc khoan nhồi (9/2026)',
    titleEn: 'Trần Hưng Đạo Bridge (VND 16.2 trillion) completes all bored piles (09/2026)',
    publisher: 'CafeF',
    url: 'https://cafef.vn/sieu-cau-vuot-song-hong-16200-ty-dong-noi-khu-pho-co-voi-long-bien-do-sun-group-trien-khai-da-hoan-thanh-toan-bo-coc-khoan-nhoi-hon-26000-tan-thep-dang-duoc-gia-cong-188260903113559516.chn',
  },
  thuongCat: {
    title: 'Dự án cầu Thượng Cát hơn 7.300 tỷ đồng chậm tiến độ, lãnh đạo UBND TP Hà Nội yêu cầu làm rõ nguyên nhân',
    titleEn: 'Thượng Cát Bridge (VND 7.3 trillion) behind schedule; Hanoi asks for the reasons',
    publisher: 'Báo Dân Việt',
    url: 'https://danviet.vn/du-an-cau-thuong-cat-hon-7300-ty-dong-cham-tien-do-lanh-dao-ubnd-tp-ha-noi-yeu-cau-lam-ro-nguyen-nhan-d1445323.html',
  },
  landPrice: {
    title: 'Nghị quyết 52/2025/NQ-HĐND (26/11/2025) — Bảng giá đất TP Hà Nội áp dụng từ 01/01/2026 (giá đất ở VT1); bản Excel tổng hợp của thuviennhadat.vn, tuyến đường đặt vào phường bằng OpenStreetMap',
    titleEn: 'Resolution 52/2025/NQ-HĐND (26/11/2025) — Hanoi land price table from 01/01/2026 (residential, street-front VT1); Excel transcription by thuviennhadat.vn, streets placed in wards with OpenStreetMap',
    publisher: 'HĐND TP Hà Nội',
    url: 'https://luatvietnam.vn/dat-dai/nghi-quyet-52-2025-nq-hdnd-ha-noi-bang-gia-dat-lan-dau-ap-dung-tu-01-01-2026-420193-d2.html',
  },
  ...MK.SOURCES,
};
for (const id of ['viupRail', 'railPriority', 'nq188', 'ring4', 'qd2512Poles', 'poleRoles']) {
  const s = FM.SOURCES[id];
  SOURCES[id] = { title: s.title, titleEn: s.title, publisher: s.publisher, url: s.url };
}
const sourceList = (ids, lang) =>
  [...new Set(ids)].filter((id) => SOURCES[id]).map((id) => ({ id, title: lang === 'en' ? SOURCES[id].titleEn : SOURCES[id].title, publisher: SOURCES[id].publisher, url: SOURCES[id].url }));

// ---------------------------------------------------------------- metro (in service / under construction: OSM via the Living Score seed)
const seed = getSeedData();
const seedLines = seed.infrastructure.filter((i) => i.kind === 'metro_line' && i.status !== 'planned');
const lineRef = (name) => /Tuyến (\w+)/.exec(name)?.[1] ?? '';
const STATIONS = seed.infrastructure
  .filter((i) => i.kind === 'metro_station' && i.status !== 'planned')
  .map((i) => {
    const coords = i.geometry.coordinates;
    const line = [...seedLines].sort((a, b) => linesKm(coords, [a.geometry.coordinates]) - linesKm(coords, [b.geometry.coordinates]))[0];
    const name = i.name.replace(/^Ga /, '');
    return { slug: name.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd').toLowerCase().replace(/[^a-z0-9]+/g, '-'), name, line: lineRef(line.name), status: i.status === 'operating' ? 'operating' : 'construction', coords };
  });
const OPERATING_STATIONS = STATIONS.filter((s) => s.status === 'operating');

// ---------------------------------------------------------------- infrastructure catalogue (every item cites its sources)
const KIND_WEIGHT = { metro: 1, bridge: 0.8, ring: 0.7 };
const INFRA = [
  ...FM.METRO_LINES.map((m, i) => ({
    id: `${m.id}-${i}`,
    kind: 'metro',
    name: m.name,
    note: m.note ?? null,
    status: m.status,
    openYear: m.openYear ?? (m.status === 'plan' ? m.year : null),
    schematic: !!m.schematic,
    color: m.color,
    lines: [m.coords],
    sources: m.sources,
  })),
  ...(INFRA_OSM.ring4.lines.length
    ? [
        {
          id: 'ring-road-4',
          kind: 'ring',
          name: { vi: 'Vành đai 4 – Vùng Thủ đô', en: 'Ring Road 4 – Capital Region' },
          note: { vi: '112,8 km (58,2 km qua Hà Nội), khởi công 6/2023, dự kiến khai thác 2027', en: '112.8 km (58.2 km in Hanoi), started 06/2023, due to open 2027' },
          status: 'construction',
          openYear: 2027,
          schematic: false,
          lines: INFRA_OSM.ring4.lines,
          sources: ['ring4', 'osmInfra'],
        },
      ]
    : []),
  ...INFRA_OSM.bridges.map((b) => {
    const meta = {
      'bridge-tran-hung-dao': {
        name: { vi: 'Cầu Trần Hưng Đạo', en: 'Trần Hưng Đạo Bridge' },
        note: { vi: 'nối Hoàn Kiếm – Bồ Đề, thi công 2025–2027', en: 'links Hoàn Kiếm and Bồ Đề, built 2025–2027' },
        sources: ['bridges2025', 'tranHungDao', 'osmInfra'],
      },
      'bridge-tu-lien': {
        name: { vi: 'Cầu Tứ Liên', en: 'Tứ Liên Bridge' },
        note: { vi: 'nối Tây Hồ – Đông Anh, thi công 2025–2027', en: 'links Tây Hồ and Đông Anh, built 2025–2027' },
        sources: ['bridges2025', 'osmInfra'],
      },
      'bridge-thuong-cat': {
        name: { vi: 'Cầu Thượng Cát', en: 'Thượng Cát Bridge' },
        note: { vi: 'nối Bắc Từ Liêm – Đông Anh, mục tiêu 2027, đang chậm tiến độ', en: 'links Bắc Từ Liêm and Đông Anh, due 2027, behind schedule' },
        sources: ['thuongCat', 'osmInfra'],
      },
    }[b.id];
    return { id: b.id, kind: 'bridge', ...meta, status: 'construction', openYear: 2027, schematic: false, lines: b.lines };
  }),
];
const INFRA_BY_ID = new Map(INFRA.map((i) => [i.id, i]));

/** Status of an item at a planning horizon: built by then (if on schedule), being built, or only planned. */
function statusAt(item, horizon) {
  if (item.status === 'operating') return 'operating';
  if (item.openYear && item.openYear <= horizon) return 'expected';
  return item.status === 'construction' ? 'construction' : 'plan';
}

/** The central city is an existing pole: the plan eases its density, so it counts half for growth. */
const POLES = FM.HUBS.map((h) => ({ slug: h.slug, name: h.name, role: h.role, center: h.center, radiusKm: h.radiusKm, year: h.year, factor: h.slug === 'trung-tam' ? 0.5 : 1, sources: ['qd2512Poles', 'poleRoles'] }));

// ---------------------------------------------------------------- wards and what lies in them
const WARDS = WARDS_DATA.wards.map((w) => ({ ...w, bbox: bboxOf(w.geometry), shortName: w.name.replace(/^(Phường|Xã)\s+/, '') }));
const WARD_BY_SLUG = new Map(WARDS.map((w) => [w.slug, w]));
function wardAt(p) {
  return WARDS.find((w) => p[0] >= w.bbox[0] && p[0] <= w.bbox[2] && p[1] >= w.bbox[1] && p[1] <= w.bbox[3] && inGeometry(p, w.geometry)) ?? null;
}

const POI_GROUP = { school: 'education', kindergarten: 'education', college: 'education', university: 'education', hospital: 'health', clinic: 'health', supermarket: 'shopping', mall: 'shopping', marketplace: 'shopping', bus: 'bus' };
const POIS = OSM.pois.map(([kind, lng, lat, name]) => ({ kind, coords: [lng, lat], name: name ?? null }));
const PARKS = OSM.parks.map(([lng, lat, areaM2, name]) => ({ coords: [lng, lat], ha: round1(areaM2 / 10_000), name: name ?? null }));

const counts = new Map(WARDS.map((w) => [w.slug, { education: 0, health: 0, shopping: 0, bus: 0, parks: 0, parkHa: 0 }]));
for (const poi of POIS) {
  const group = POI_GROUP[poi.kind];
  if (!group) continue;
  const w = wardAt(poi.coords);
  if (w) counts.get(w.slug)[group] += 1;
}
for (const park of PARKS) {
  const w = wardAt(park.coords);
  if (!w) continue;
  const c = counts.get(w.slug);
  c.parks += 1;
  c.parkHa = round1(c.parkHa + park.ha);
}

// ---------------------------------------------------------------- criteria
const CRITERIA = [
  { key: 'connectivity', code: 'MT', tone: 'mobility', weight: 0.25, label: { vi: 'Kết nối metro & xe buýt', en: 'Metro & bus access' } },
  { key: 'infrastructure', code: 'IN', tone: 'mobility', weight: 0.25, label: { vi: 'Hạ tầng sắp có', en: 'Infrastructure coming' } },
  { key: 'planning', code: 'PL', tone: 'planning', weight: 0.15, label: { vi: 'Cực phát triển (QĐ 2512)', en: 'Growth pole (Decision 2512)' } },
  { key: 'amenities', code: 'TI', tone: 'growth', weight: 0.15, label: { vi: 'Tiện ích đô thị', en: 'Urban amenities' } },
  { key: 'population', code: 'DC', tone: 'growth', weight: 0.1, label: { vi: 'Mật độ dân cư', en: 'Population density' } },
  { key: 'development', code: 'PT', tone: 'planning', weight: 0.1, label: { vi: 'Phát triển mới', en: 'New development' } },
];
const CRITERION_SOURCES = {
  connectivity: ['osmAmenities', 'viupRail'],
  infrastructure: ['viupRail', 'nq188', 'railPriority', 'ring4', 'bridges2025', 'thuongCat', 'osmInfra'],
  planning: ['qd2512Poles', 'poleRoles'],
  amenities: ['osmAmenities'],
  population: ['population'],
  development: ['osmDevelopment'],
};

/** Square-root relative scale: 100 for the highest value. */
function relative(values) {
  const max = Math.max(...values.filter((v) => v !== null));
  return values.map((v) => (v === null ? null : max > 0 ? 100 * Math.sqrt(Math.max(0, v) / max) : 0));
}
const nearKm = (d, full, zero) => (d <= full ? 1 : d >= zero ? 0 : (zero - d) / (zero - full));

function nearestOf(p, list) {
  let best = null;
  for (const item of list) {
    const d = distKm(p, item.coords);
    if (!best || d < best.d) best = { item, d };
  }
  return best;
}

const facts = WARDS.map((w) => {
  const c = counts.get(w.slug);
  const station = nearestOf(w.centroid, OPERATING_STATIONS);
  const building = nearestOf(w.centroid, STATIONS.filter((s) => s.status === 'construction'));
  const infra = INFRA.filter((i) => i.status !== 'operating')
    .map((i) => ({ item: i, d: linesKm(w.centroid, i.lines) }))
    .filter((x) => x.d <= 4)
    .sort((a, b) => a.d - b.d);
  const poles = POLES.map((p) => ({ pole: p, d: distKm(w.centroid, p.center) }))
    .filter((x) => x.d <= x.pole.radiusKm + 5)
    .sort((a, b) => a.d - b.d - (a.pole.radiusKm - b.pole.radiusKm) / 10);
  return {
    w,
    c,
    station,
    building,
    infra,
    poles,
    stationsInside: OPERATING_STATIONS.filter((s) => inGeometry(s.coords, w.geometry)).map((s) => s.name),
    density: w.population ? Math.round(w.population / w.areaKm2) : null,
  };
});

const raw = {
  metro: facts.map((f) => 100 * nearKm(f.station.d, 0.5, 5)),
  bus: relative(facts.map((f) => f.c.bus / f.w.areaKm2)),
  infrastructure: relative(facts.map((f) => f.infra.reduce((s, x) => s + (x.item.status === 'construction' ? 1 : 0.5) * KIND_WEIGHT[x.item.kind] * nearKm(x.d, 1, 4), 0))),
  planning: facts.map((f) => Math.max(0, ...f.poles.map((x) => 100 * x.pole.factor * nearKm(x.d, x.pole.radiusKm, x.pole.radiusKm + 5)))),
  amenities: relative(facts.map((f) => (f.c.education + f.c.health + f.c.shopping + f.c.parks) / f.w.areaKm2)),
  population: relative(facts.map((f) => f.density)),
  construction: relative(facts.map((f) => f.w.constructionHa / f.w.areaKm2)),
  apartments: relative(facts.map((f) => f.w.counts.apartments / f.w.areaKm2)),
};

const SCORES = new Map(
  facts.map((f, i) => {
    const values = {
      connectivity: Math.round(0.7 * raw.metro[i] + 0.3 * raw.bus[i]),
      infrastructure: Math.round(raw.infrastructure[i]),
      planning: Math.round(raw.planning[i]),
      amenities: Math.round(raw.amenities[i]),
      population: raw.population[i] === null ? null : Math.round(raw.population[i]),
      development: Math.round(0.6 * raw.construction[i] + 0.4 * raw.apartments[i]),
    };
    const used = CRITERIA.filter((c) => values[c.key] !== null);
    const score = Math.round(used.reduce((s, c) => s + c.weight * values[c.key], 0) / used.reduce((s, c) => s + c.weight, 0));
    return [f.w.slug, { values, score, partial: used.length < CRITERIA.length }];
  }),
);
const RANKED = [...SCORES].sort((a, b) => b[1].score - a[1].score).map(([slug]) => slug);
const FACTS = new Map(facts.map((f) => [f.w.slug, f]));
const rankOf = (slug) => RANKED.indexOf(slug) + 1;

// ---------------------------------------------------------------- prices: official land prices, real projects
/** Land price of a ward (million VND/m², VT1), with its rank among the wards that have one (1 = most expensive). */
const LAND_RANKED = Object.entries(LAND.wards)
  .filter(([, v]) => v)
  .sort((a, b) => b[1].medianVT1 - a[1].medianVT1)
  .map(([slug]) => slug);
const landOf = (slug) => (LAND.wards[slug] ? { ...LAND.wards[slug], rank: LAND_RANKED.indexOf(slug) + 1, ranked: LAND_RANKED.length } : null);
const LAND_CITY_MEDIAN = (() => {
  const v = LAND_RANKED.map((slug) => LAND.wards[slug].medianVT1);
  return v[Math.floor(v.length / 2)];
})();

/** Real projects at their location; a project known only by its ward sits at the ward's centre (`approx`). */
const PROJECTS = MK.PROJECTS.map((p) => {
  const coords = p.coords ?? WARD_BY_SLUG.get(p.approxWard).centroid;
  return { ...p, coords, approx: p.approx || !p.coords };
});
const PROJECT_WARD = new Map(PROJECTS.map((p) => [p.slug, wardAt(p.coords)]));

// ---------------------------------------------------------------- around a point (project deep dive)
function around(p, lang) {
  const station = nearestOf(p, OPERATING_STATIONS);
  const near = (kinds) => POIS.filter((x) => kinds.includes(x.kind)).map((x) => ({ ...x, d: distKm(p, x.coords) })).sort((a, b) => a.d - b.d);
  const schools = near(['school', 'kindergarten']);
  const hospitals = near(['hospital']);
  const clinics = near(['clinic']);
  const shops = near(['mall', 'supermarket', 'marketplace']);
  const parks = PARKS.filter((x) => x.ha >= 0.5).map((x) => ({ ...x, d: distKm(p, x.coords) })).sort((a, b) => a.d - b.d);
  const health = hospitals[0] && (!clinics[0] || hospitals[0].d <= clinics[0].d + 1) ? hospitals[0] : clinics[0];
  const unnamed = { school: { vi: 'Trường học', en: 'School' }, hospital: { vi: 'Cơ sở y tế', en: 'Health facility' }, mall: { vi: 'Siêu thị / chợ', en: 'Supermarket / market' }, park: { vi: 'Công viên', en: 'Park' } };
  const poi = (kind, x) => (x ? { kind, name: x.name ?? L(unnamed[kind], lang), coords: x.coords, distanceM: Math.round(x.d * 1000) } : null);
  return {
    station: { ...station.item, distanceM: Math.round(station.d * 1000) },
    schoolsWithin: schools.filter((x) => x.d <= 1.5).length,
    school: poi('school', schools[0]),
    health: poi('hospital', health),
    shop: poi('mall', shops[0]),
    park: parks[0] ? { ...poi('park', parks[0]), ha: parks[0].ha } : null,
    pois: [poi('school', schools[0]), poi('school', schools[1]), poi('hospital', health), poi('mall', shops[0]), parks[0] ? { ...poi('park', parks[0]), ha: parks[0].ha } : null].filter(Boolean),
    infra: INFRA.filter((i) => i.status !== 'operating')
      .map((i) => ({ item: i, d: linesKm(p, i.lines) }))
      .filter((x) => x.d <= 3)
      .sort((a, b) => a.d - b.d),
  };
}

module.exports = {
  HORIZONS,
  TOD_RADIUS_M,
  WARDS,
  WARD_BY_SLUG,
  CRITERIA,
  CRITERION_SOURCES,
  SCORES,
  RANKED,
  FACTS,
  STATIONS,
  INFRA,
  INFRA_BY_ID,
  INFRA_OSM,
  POLES,
  POIS,
  PARKS,
  SOURCES,
  LAND,
  LAND_CITY_MEDIAN,
  landOf,
  PROJECTS,
  PROJECT_WARD,
  L,
  round1,
  round2,
  distKm,
  rankOf,
  statusAt,
  sourceList,
  wardAt,
  around,
};
