'use strict';
/**
 * AI Property Intelligence — turns the model (model.js) and the published market figures (market.js) into the responses
 * the API serves, in Vietnamese or English. Every number comes from a cited source.
 */
const { normalizeText } = require('../living-score/common/text');
const { notFound } = require('../living-score/common/http');
const { getSeedData } = require('../living-score/seed/seed-data');
const { LOCATIONS: COPILOT_LOCATIONS } = require('../business-copilot/data');
const M = require('./model');
const MK = require('./market');

const { L, round1, round2 } = M;
const fmt = (n, lang, digits = 1) => n.toLocaleString(lang === 'en' ? 'en-US' : 'vi-VN', { maximumFractionDigits: digits });
const km = (d, lang) => (d < 1 ? `${Math.round(d * 1000 / 10) * 10} m` : `${fmt(round1(d), lang)} km`);

const METHOD = {
  vi:
    'Điểm tiềm năng (0–100) = trung bình có trọng số của 6 tiêu chí, so tương đối giữa 79 phường/xã: kết nối metro & xe buýt 25% (khoảng cách tới ga metro đang chạy, mật độ điểm xe buýt), ' +
    'hạ tầng sắp có 25% (metro, cầu, Vành đai 4 đang xây hoặc đã quy hoạch trong vòng 4 km), cực phát triển theo QĐ 2512 15% (lõi trung tâm hiện hữu tính một nửa), ' +
    'tiện ích đô thị 15% (trường, y tế, siêu thị/chợ, công viên trên km²), mật độ dân cư 10%, phát triển mới 10% (công trường, chung cư trên km²). ' +
    'Phường/xã chưa có số dân thì tính trên 5 tiêu chí còn lại.',
  en:
    'Potential score (0–100) = weighted mean of 6 criteria, relative between the 79 wards/communes: metro & bus access 25% (distance to a metro station in service, bus stops per km²), ' +
    'infrastructure coming 25% (metro, bridges and Ring Road 4 being built or planned within 4 km), growth pole of Decision 2512 15% (the existing central city counts half), ' +
    'urban amenities 15% (schools, health, supermarkets/markets, parks per km²), population density 10%, new development 10% (construction sites, apartment buildings per km²). ' +
    'Communes without a population figure are scored on the other five.',
};
const CAVEAT = {
  vi: 'Mọi số liệu có nguồn, nhưng đây không phải định giá hay lời khuyên đầu tư. Giá đất là bảng giá Nhà nước (thường thấp hơn giá thị trường); giá căn hộ là giá chào bán/rao bán được công bố, không phải giá giao dịch.',
  en: 'Every figure is cited, but this is not a valuation or investment advice. Land prices are the official table (usually below market); apartment prices are published asking prices, not transaction prices.',
};

// ---------------------------------------------------------------- wards
function findWard(slug) {
  const ward = M.WARD_BY_SLUG.get(slug);
  if (!ward) throw notFound(`Không tìm thấy phường/xã "${slug}".`);
  return ward;
}

function wardSummary(w) {
  const s = M.SCORES.get(w.slug);
  const f = M.FACTS.get(w.slug);
  return {
    slug: w.slug,
    name: w.name,
    shortName: w.shortName,
    center: w.centroid,
    score: s.score,
    rank: M.rankOf(w.slug),
    total: M.WARDS.length,
    partial: s.partial,
    population: w.population ?? null,
    density: f.density,
    metro: { name: f.station.item.name, line: f.station.item.line, distanceM: Math.round(f.station.d * 1000) },
  };
}

function listWards() {
  return M.RANKED.map((slug) => wardSummary(M.WARD_BY_SLUG.get(slug)));
}

function infraView(item, d, lang, horizon = 2026) {
  return {
    id: item.id,
    kind: item.kind,
    name: L(item.name, lang),
    note: L(item.note, lang),
    status: item.status,
    statusAt: M.statusAt(item, horizon),
    openYear: item.openYear,
    schematic: item.schematic,
    distanceKm: d === null ? null : round1(d),
    sources: M.sourceList(item.sources, lang),
  };
}

function criterionDetail(key, w, f, lang) {
  const en = lang === 'en';
  const c = f.c;
  switch (key) {
    case 'connectivity':
      return en
        ? `Nearest station in service: ${f.station.item.name} (line ${f.station.item.line}), ${km(f.station.d, lang)} · ${c.bus} bus stops in the ward`
        : `Ga đang chạy gần nhất: ${f.station.item.name} (tuyến ${f.station.item.line}), cách ${km(f.station.d, lang)} · ${c.bus} điểm xe buýt trong phường/xã`;
    case 'infrastructure': {
      const near = f.infra.slice(0, 3).map((x) => `${L(x.item.name, lang)} (${x.item.openYear ?? '—'}, ${km(x.d, lang)})`);
      return near.length ? near.join(' · ') : en ? 'Nothing being built or planned within 4 km' : 'Không có công trình đang xây/quy hoạch trong 4 km';
    }
    case 'planning': {
      const inside = f.poles.filter((x) => x.d <= x.pole.radiusKm);
      if (inside.length) return (en ? 'Inside: ' : 'Nằm trong: ') + inside.map((x) => L(x.pole.name, lang)).join(' · ');
      const next = f.poles[0];
      return next ? `${en ? 'Nearest pole' : 'Cực gần nhất'}: ${L(next.pole.name, lang)} (${km(next.d - next.pole.radiusKm, lang)} ${en ? 'outside' : 'bên ngoài'})` : en ? 'Far from the development poles' : 'Xa các cực phát triển';
    }
    case 'amenities':
      return en
        ? `${c.education} schools · ${c.health} hospitals/clinics · ${c.shopping} supermarkets/markets · ${c.parks} parks (${fmt(c.parkHa, lang)} ha)`
        : `${c.education} trường · ${c.health} bệnh viện/phòng khám · ${c.shopping} siêu thị/chợ · ${c.parks} công viên (${fmt(c.parkHa, lang)} ha)`;
    case 'population':
      return w.population
        ? en
          ? `${fmt(w.population, lang)} residents · ${fmt(f.density, lang)}/km² (01/07/2025)`
          : `${fmt(w.population, lang)} người · ${fmt(f.density, lang)} người/km² (1/7/2025)`
        : en
          ? 'No population figure yet — score uses the other criteria'
          : 'Chưa có số dân — điểm tính trên các tiêu chí còn lại';
    default:
      return en
        ? `${fmt(w.constructionHa, lang)} ha of construction sites · ${w.counts.apartments} apartment buildings`
        : `${fmt(w.constructionHa, lang)} ha công trường · ${w.counts.apartments} toà chung cư`;
  }
}

const seedAreas = getSeedData().areas;
function links(w, f, lang) {
  const nearest = (list, at) => list.map((x) => ({ x, d: M.distKm(at(x), w.centroid) })).sort((a, b) => a.d - b.d)[0];
  const ls = nearest(seedAreas, (a) => [a.centroid.lng, a.centroid.lat]);
  const cp = nearest(COPILOT_LOCATIONS, (l) => l.center);
  const pole = f.poles.find((x) => x.d <= x.pole.radiusKm) ?? null;
  return {
    opportunity: w.slug,
    livingScore: ls && ls.d <= 3 ? { slug: ls.x.slug, name: lang === 'en' ? ls.x.nameEn ?? ls.x.name : ls.x.name } : null,
    futureMap: pole ? { hub: pole.pole.slug, name: L(pole.pole.name, lang) } : null,
    copilot: cp && cp.d <= 4 ? { slug: cp.x.slug, name: cp.x.name } : null,
  };
}

// ---------------------------------------------------------------- prices (official land prices, published market figures)
function landView(slug) {
  const land = M.landOf(slug);
  if (!land) return null;
  return { ...land, cityMedian: M.LAND_CITY_MEDIAN, unit: 'tr/m²' };
}

/** City-wide apartment market (CBRE quarters, Savills Q2/2026), with their sources. */
function cityMarket(lang) {
  return {
    quarters: MK.QUARTERS.map((q) => ({ ...q, source: M.sourceList([q.source], lang)[0] })),
    savills: { ...MK.SAVILLS, note: L(MK.SAVILLS.note, lang), source: M.sourceList([MK.SAVILLS.source], lang)[0] },
    latest: MK.LATEST.primary,
  };
}

function priceLabel(p, lang) {
  if (p.max === null) return lang === 'en' ? `over ${p.min}` : `trên ${p.min}`;
  return p.min === p.max ? `~${fmt(p.min, lang)}` : `${fmt(p.min, lang)}–${fmt(p.max, lang)}`;
}
const midPrice = (p) => (p.max === null ? p.min : (p.min + p.max) / 2);

function getWard(slug, lang) {
  const w = findWard(slug);
  const f = M.FACTS.get(slug);
  const s = M.SCORES.get(slug);
  const projects = M.PROJECTS.map((p) => ({ p, d: M.distKm(p.coords, w.centroid), inside: M.PROJECT_WARD.get(p.slug)?.slug === slug }))
    .filter((x) => x.inside || x.d <= 4)
    .sort((a, b) => Number(b.inside) - Number(a.inside) || a.d - b.d)
    .map((x) => ({ ...projectSummary(x.p, lang), inWard: x.inside, distanceM: Math.round(x.d * 1000) }));
  const building = f.building ? { name: f.building.item.name, line: f.building.item.line, distanceM: Math.round(f.building.d * 1000), openYear: 2027 } : null;
  return {
    ...wardSummary(w),
    areaKm2: w.areaKm2,
    populationDate: w.populationDate ?? null,
    criteria: M.CRITERIA.map((c) => ({ key: c.key, code: c.code, label: L(c.label, lang), tone: c.tone, weight: c.weight, value: s.values[c.key], detail: criterionDetail(c.key, w, f, lang) })),
    facts: {
      stationsInside: f.stationsInside,
      nearestStation: { name: f.station.item.name, line: f.station.item.line, distanceM: Math.round(f.station.d * 1000) },
      buildingStation: building,
      counts: f.c,
      constructionHa: w.constructionHa,
      apartments: w.counts.apartments,
      offices: w.counts.offices,
    },
    infra: f.infra.map((x) => infraView(x.item, x.d, lang)),
    poles: f.poles.map((x) => ({ slug: x.pole.slug, name: L(x.pole.name, lang), role: L(x.pole.role, lang), inside: x.d <= x.pole.radiusKm, distanceKm: round1(Math.max(0, x.d - x.pole.radiusKm)) })),
    landPrice: landView(slug),
    market: cityMarket(lang),
    projects,
    links: links(w, f, lang),
    method: METHOD[lang],
    caveat: CAVEAT[lang],
    sources: M.sourceList(
      [
        ...M.CRITERIA.flatMap((c) => M.CRITERION_SOURCES[c.key]),
        ...f.infra.flatMap((x) => x.item.sources),
        'landPrice',
        ...MK.QUARTERS.map((q) => q.source),
        MK.SAVILLS.source,
        ...projects.map((p) => p.sourceId),
      ],
      lang,
    ),
  };
}

// ---------------------------------------------------------------- projects (real, prices as published)
function findProject(slug) {
  const project = M.PROJECTS.find((p) => p.slug === slug);
  if (!project) throw notFound(`Không tìm thấy dự án "${slug}".`);
  return project;
}

function projectSummary(p, lang) {
  const ward = M.PROJECT_WARD.get(p.slug);
  return {
    slug: p.slug,
    name: p.name,
    street: p.street,
    ward: ward ? { slug: ward.slug, name: ward.name } : null,
    coords: p.coords,
    approx: p.approx,
    price: { min: p.min, max: p.max, label: priceLabel(p, lang), kind: p.kind, kindLabel: L(MK.KIND[p.kind], lang) },
    sourceId: p.source,
  };
}

function proximityRows(a, lang) {
  const en = lang === 'en';
  const todGap = Math.max(0, a.station.distanceM - M.TOD_RADIUS_M);
  const rows = [
    { key: 'metro', label: en ? 'Nearest metro' : 'Ga metro gần nhất', detail: `${a.station.name} · ${en ? 'line' : 'tuyến'} ${a.station.line}`, distanceM: a.station.distanceM, tone: 'mobility' },
    {
      key: 'tod',
      label: en ? 'TOD distance' : 'Khoảng cách TOD',
      detail: todGap === 0 ? (en ? `inside the ${M.TOD_RADIUS_M} m ring` : `trong vòng ${M.TOD_RADIUS_M} m`) : en ? `outside the ${M.TOD_RADIUS_M} m ring` : `ngoài vòng ${M.TOD_RADIUS_M} m`,
      distanceM: todGap,
      tone: 'mobility',
    },
  ];
  if (a.school) rows.push({ key: 'school', label: en ? 'Schools' : 'Trường học', detail: en ? `${a.schoolsWithin} within 1.5 km` : `${a.schoolsWithin} trường trong 1,5 km`, distanceM: a.school.distanceM });
  if (a.health) rows.push({ key: 'hospital', label: en ? 'Health' : 'Y tế', detail: a.health.name, distanceM: a.health.distanceM });
  if (a.shop) rows.push({ key: 'mall', label: en ? 'Shopping' : 'Mua sắm', detail: a.shop.name, distanceM: a.shop.distanceM });
  if (a.park) rows.push({ key: 'park', label: en ? 'Green space' : 'Cây xanh', detail: `${a.park.name} · ${fmt(a.park.ha, lang)} ha`, distanceM: a.park.distanceM, tone: 'growth' });
  return rows;
}

/** What a typical 70 m² unit costs at the published price per m² (simple multiplication, billion VND). */
const UNIT_M2 = 70;

function getProject(slug, lang) {
  const p = findProject(slug);
  const a = M.around(p.coords, lang);
  const ward = M.PROJECT_WARD.get(p.slug);
  const nearby = M.PROJECTS.filter((o) => o.slug !== p.slug)
    .map((o) => ({ o, d: M.distKm(p.coords, o.coords) }))
    .sort((x, y) => x.d - y.d)
    .slice(0, 4)
    .map(({ o, d }) => ({ ...projectSummary(o, lang), distanceM: Math.round(d * 1000) }));
  const latest = MK.LATEST.primary;
  return {
    ...projectSummary(p, lang),
    osm: p.osm,
    note: L(p.note, lang),
    unit: {
      m2: UNIT_M2,
      min: round2((p.min * UNIT_M2) / 1000),
      max: p.max === null ? null : round2((p.max * UNIT_M2) / 1000),
    },
    vsMarket: { pct: Math.round((midPrice(p) / latest - 1) * 100), market: latest, quarter: MK.LATEST.quarter },
    landPrice: ward ? landView(ward.slug) : null,
    station: { name: a.station.name, line: a.station.line, coords: a.station.coords, distanceM: a.station.distanceM },
    todRadiusM: M.TOD_RADIUS_M,
    proximity: proximityRows(a, lang),
    pois: a.pois,
    plannedInfra: a.infra.map((x) => infraView(x.item, x.d, lang)),
    nearby,
    market: cityMarket(lang),
    sources: M.sourceList([p.source, MK.LATEST.source, 'landPrice', 'osmAmenities', 'viupRail', ...a.infra.flatMap((x) => x.item.sources)], lang),
  };
}

function listProjects(lang) {
  return M.PROJECTS.map((p) => projectSummary(p, lang));
}

// ---------------------------------------------------------------- search / overview
function search(query, lang) {
  const q = normalizeText(query);
  if (!q) return { results: [] };
  // Word-prefix match ("gia" also finds Giảng Võ), whole words first: "gia" lists Gia Lâm before Giảng Võ.
  const matches = (text) => ` ${normalizeText(text)}`.includes(` ${q}`);
  const whole = (text) => ` ${normalizeText(text)} `.includes(` ${q} `);
  const wards = M.WARDS.filter((w) => matches(w.name))
    .sort((a, b) => Number(whole(b.name)) - Number(whole(a.name)) || M.rankOf(a.slug) - M.rankOf(b.slug))
    .map((w) => ({ type: 'ward', slug: w.slug, name: w.name, detail: `${lang === 'en' ? 'Score' : 'Điểm'} ${M.SCORES.get(w.slug).score} · #${M.rankOf(w.slug)}` }));
  const projects = M.PROJECTS.filter((p) => matches(p.name)).map((p) => ({
    type: 'project',
    slug: p.slug,
    name: p.name,
    detail: `${M.PROJECT_WARD.get(p.slug)?.name ?? p.street} · ${priceLabel(p, lang)} tr/m²`,
  }));
  return { results: [...wards, ...projects].slice(0, 8) };
}

/** Featured ward: outside the existing central city, the most growth-driven one (infrastructure + pole + new development). */
const growth = (slug) => ['infrastructure', 'planning', 'development'].reduce((s, k) => s + M.SCORES.get(slug).values[k], 0);
const FEATURED = M.RANKED.filter((slug) => !M.FACTS.get(slug).poles.some((x) => x.pole.slug === 'trung-tam' && x.d <= x.pole.radiusKm)).sort((a, b) => growth(b) - growth(a))[0];

function overview(lang) {
  const w = getWard(FEATURED, lang);
  const top = w.infra[0] ?? null;
  return {
    note: CAVEAT[lang],
    dataUpdated: [M.INFRA_OSM.osmBase, M.LAND.osmBase, require('../opportunity/data/hanoi-wards.json').osmBase].filter(Boolean).sort().at(-1)?.slice(0, 10) ?? null,
    horizons: M.HORIZONS,
    stats: { wards: M.WARDS.length, infra: M.INFRA.filter((i) => i.status !== 'operating').length, poles: M.POLES.length, projects: M.PROJECTS.length, horizon: Math.max(...M.HORIZONS) },
    featured: {
      slug: w.slug,
      name: w.name,
      score: w.score,
      rank: w.rank,
      center: w.center,
      criteria: w.criteria.filter((c) => ['connectivity', 'infrastructure', 'planning'].includes(c.key)),
      topInfra: top,
      landPrice: w.landPrice,
    },
    market: { quarter: MK.LATEST.quarter, primary: MK.LATEST.primary },
    defaultQuestion: lang === 'en' ? `Is ${w.name} a good place to buy for the next 5 years?` : `${w.name} có đáng mua để ở và đầu tư trong 5 năm tới không?`,
    method: METHOD[lang],
  };
}

module.exports = {
  METHOD,
  CAVEAT,
  findWard,
  findProject,
  wardSummary,
  listWards,
  getWard,
  listProjects,
  getProject,
  projectSummary,
  priceLabel,
  midPrice,
  landView,
  cityMarket,
  infraView,
  criterionDetail,
  search,
  overview,
  FEATURED,
  UNIT_M2,
  km,
  fmt,
};
