'use strict';
/**
 * Builds what the Future Map shows for one timeline year and language, from data.js. Nothing here invents
 * numbers: figures are the ones quoted in data.js, each with its sources.
 */
const { badRequest, notFound } = require('../living-score/common/http');
const { bufferLine, circleLine, circleRing, distanceKm, lineLengthKm } = require('./geo');
const D = require('./data');
const R = require('./region');

/** Plan sources (data.js) and Capital Region sources (region.js) share one id space. */
const ALL_SOURCES = { ...D.SOURCES, ...R.REGION_SOURCES };

const round1 = (n) => Math.round(n * 10) / 10;
const fc = (features) => ({ type: 'FeatureCollection', features });
const feature = (geometry, properties) => ({ type: 'Feature', geometry, properties });

const LANGS = ['vi', 'en'];
/** Bilingual text ({ vi, en }) in one language. */
const L = (text, lang) => (text && typeof text === 'object' ? (text[lang] ?? text.vi) : text);

const YEAR_META = new Map(D.YEARS.map((y) => [y.year, y]));
const HUB_BY_SLUG = new Map(D.HUBS.map((h) => [h.slug, h]));

function requireYear(value) {
  const year = Number(value);
  if (!YEAR_META.has(year)) throw badRequest(`year phải thuộc: ${D.YEAR_VALUES.join(', ')}.`);
  return year;
}

function requireLang(value) {
  const lang = value ?? 'vi';
  if (!LANGS.includes(lang)) throw badRequest('lang phải là vi hoặc en.');
  return lang;
}

const previousYear = (year) => D.YEAR_VALUES[D.YEAR_VALUES.indexOf(year) - 1];
const visible = (item, year) => item.year <= year;
/** Status in a given year: something under construction counts as operating from its opening year on. */
const statusIn = (item, year) => (item.status === 'construction' && item.openYear && year >= item.openYear ? 'operating' : item.status);

/** The sources an answer or panel refers to, in citation form. */
const sourceList = (ids) => [...new Set(ids)].filter((id) => ALL_SOURCES[id]).map((id) => ({ id, ...ALL_SOURCES[id] }));

const visibleLines = (year) => D.METRO_LINES.filter((l) => visible(l, year));

// ---------------------------------------------------------------- stats
function buildStats(year) {
  const meta = YEAR_META.get(year);
  const lines = visibleLines(year);
  const count = (status) => lines.filter((l) => statusIn(l, year) === status).length;
  return {
    population: { min: meta.population.min, max: meta.population.max },
    railKm: meta.railKm.value,
    poles: D.HUBS.filter((h) => visible(h, year)).length,
    linesOperating: count('operating'),
    linesConstruction: count('construction'),
    linesPlanned: count('plan'),
    airports: D.AIRPORTS.filter((a) => visible(a, year)).length,
  };
}

/** The stats with their wording and sources, for the side panel. */
function statNotes(year, lang) {
  const meta = YEAR_META.get(year);
  return {
    population: { note: L(meta.population.note, lang), sources: meta.population.sources },
    railKm: { note: L(meta.railKm.note, lang), sources: meta.railKm.sources },
  };
}

// ---------------------------------------------------------------- poles
function linesNear(hub, year) {
  const reach = hub.radiusKm + 1.5;
  return visibleLines(year).filter((line) => line.coords.some((c) => distanceKm(c, hub.center) <= reach));
}

function axesOf(hub) {
  return D.AXES.filter((a) => a.slugs.includes(hub.slug) || (a.river && hub.slug === 'song-hong'));
}

function hubView(hub, year, lang) {
  return {
    slug: hub.slug,
    name: L(hub.name, lang),
    area: L(hub.area, lang),
    role: L(hub.role, lang),
    center: hub.center,
    radiusKm: hub.radiusKm,
    tags: hub.tags,
    status: hub.status,
    firstYear: hub.year,
    isNew: hub.year > (previousYear(year) ?? 0) && hub.year <= year,
    sources: hub.sources,
  };
}

// ---------------------------------------------------------------- layers
function buildLayers(year, lang) {
  const prev = previousYear(year) ?? 0;
  const isNew = (item) => item.year > prev && item.year <= year;

  const lines = visibleLines(year);
  const metroLines = fc(
    lines.map((l) =>
      feature(
        { type: 'LineString', coordinates: l.coords },
        {
          id: l.id,
          name: L(l.name, lang),
          note: L(l.note, lang) ?? null,
          color: l.color,
          status: statusIn(l, year),
          schematic: !!l.schematic,
          year: l.year,
          lengthKm: round1(lineLengthKm(l.coords)),
          isNew: isNew(l),
          sources: l.sources,
        },
      ),
    ),
  );

  // Stations only where the route is not schematic (the seed data's vertices are the stations).
  const stationKeys = new Set();
  const stations = [];
  for (const l of lines.filter((line) => !line.schematic)) {
    for (const c of l.coords) {
      const key = `${c[0].toFixed(3)},${c[1].toFixed(3)}`;
      if (stationKeys.has(key)) continue;
      stationKeys.add(key);
      stations.push(feature({ type: 'Point', coordinates: c }, { line: l.id, color: l.color, status: statusIn(l, year) }));
    }
  }

  // TOD: a 500 m walking catchment around the stations of lines in service or being built (Resolution 188 promotes TOD).
  const tod = fc(
    stations
      .filter((s) => s.properties.status !== 'plan')
      .map((s) => feature({ type: 'Polygon', coordinates: [circleRing(s.geometry.coordinates, 0.5, { points: 24 })] }, { name: 'TOD 500 m', height: 300, sources: ['nq188'] })),
  );

  const roads = fc([
    ...D.RING_ROADS.filter((r) => visible(r, year)).map((r, i) =>
      feature(
        { type: 'LineString', coordinates: circleLine(D.CENTER, r.radiusKm, { wobble: 0.05, phase: i + 0.5 }) },
        { kind: 'ring', name: L(r.name, lang), note: L(r.note, lang) ?? null, status: statusIn(r, year), schematic: true, year: r.year, isNew: isNew(r), sources: r.sources },
      ),
    ),
    ...D.EXPRESSWAYS.filter((r) => visible(r, year)).map((r) =>
      feature({ type: 'LineString', coordinates: r.coords }, { kind: 'expressway', name: L(r.name, lang), status: statusIn(r, year), schematic: true, year: r.year, isNew: isNew(r), sources: r.sources }),
    ),
  ]);

  const green = fc(
    D.GREEN_AREAS.filter((g) => visible(g, year)).map((g) =>
      feature({ type: 'Polygon', coordinates: g.polygon }, { name: L(g.name, lang), kind: g.kind, status: g.status, schematic: !!g.schematic, year: g.year, isNew: isNew(g), sources: g.sources }),
    ),
  );

  const water = fc([
    feature({ type: 'LineString', coordinates: D.RED_RIVER }, { name: lang === 'en' ? 'Red River' : 'Sông Hồng', kind: 'river' }),
    feature({ type: 'LineString', coordinates: D.DUONG_RIVER }, { name: lang === 'en' ? 'Đuống River' : 'Sông Đuống', kind: 'river' }),
    feature({ type: 'Polygon', coordinates: [D.WEST_LAKE] }, { name: lang === 'en' ? 'West Lake' : 'Hồ Tây', kind: 'lake' }),
  ]);

  const airports = fc(
    D.AIRPORTS.filter((a) => visible(a, year)).map((a) =>
      feature({ type: 'Point', coordinates: a.at }, { name: L(a.name, lang), note: L(a.note, lang) ?? null, kind: a.kind, status: a.status, isNew: isNew(a), sources: a.sources }),
    ),
  );

  const hubs = D.HUBS.filter((h) => visible(h, year));
  const hubViews = hubs.map((h) => hubView(h, year, lang));
  const hubPoints = fc(hubViews.map((h) => feature({ type: 'Point', coordinates: h.center }, h)));

  // Pole areas (approximate). Heights only give the 3D view some relief; they are not data.
  const zones = fc(
    hubViews.map((h, i) =>
      feature(
        { type: 'Polygon', coordinates: [h.slug === 'song-hong' ? bufferedRiverCore() : circleRing(h.center, h.radiusKm, { wobble: 0.14, phase: i })] },
        { slug: h.slug, name: h.name, status: h.status, height: h.slug === 'trung-tam' ? 1800 : 1100, isNew: h.isNew },
      ),
    ),
  );

  const shown = new Set(hubs.map((h) => h.slug));
  const axes = fc(
    D.AXES.filter((a) => visible(a, year))
      .map((a) => ({ ...a, coords: a.river ? D.RED_RIVER.slice(5, 13) : a.slugs.filter((s) => shown.has(s)).map((s) => HUB_BY_SLUG.get(s).center) }))
      .filter((a) => a.coords.length >= 2)
      .map((a) => feature({ type: 'LineString', coordinates: a.coords }, { name: L(a.name, lang), theme: L(a.theme, lang), schematic: true, sources: a.sources })),
  );

  return { metroLines, metroStations: fc(stations), roads, green, water, airports, hubs: hubPoints, zones, tod, axes };
}

/** The Red River pole: the river corridor through the central city. */
function bufferedRiverCore() {
  return bufferLine(D.RED_RIVER.slice(7, 12), 1.4);
}

// ---------------------------------------------------------------- endpoints
const cache = new Map();

function getScenario(value, langValue) {
  const year = requireYear(value);
  const lang = requireLang(langValue);
  const key = `${year}|${lang}`;
  if (!cache.has(key)) {
    const meta = YEAR_META.get(year);
    cache.set(key, {
      year,
      lang,
      label: L(meta.label, lang),
      kind: meta.kind,
      headline: L(meta.headline, lang),
      stats: buildStats(year),
      statNotes: statNotes(year, lang),
      layers: buildLayers(year, lang),
      sources: D.SOURCES,
      note: L(D.NOTE, lang),
    });
  }
  return cache.get(key);
}

function getTimeline(langValue) {
  const lang = requireLang(langValue);
  return {
    years: D.YEARS.map((y) => ({ year: y.year, label: L(y.label, lang), kind: y.kind, headline: L(y.headline, lang), stats: buildStats(y.year) })),
    center: D.CENTER,
    sources: D.SOURCES,
    note: L(D.NOTE, lang),
  };
}

function getHub(slug, value, langValue) {
  const year = requireYear(value);
  const lang = requireLang(langValue);
  const hub = HUB_BY_SLUG.get(slug);
  if (!hub) throw notFound(`Không tìm thấy cực phát triển "${slug}".`);
  const lines = linesNear(hub, Math.max(year, hub.year));
  return {
    ...hubView(hub, year, lang),
    year,
    presentInYear: year >= hub.year,
    lines: lines.map((l) => ({ name: L(l.name, lang), status: statusIn(l, year), schematic: !!l.schematic, color: l.color })),
    axes: axesOf(hub).map((a) => ({ name: L(a.name, lang), theme: L(a.theme, lang) })),
    // Capital Region corridors this pole faces (see region.js).
    corridors: R.CORRIDORS.filter((c) => c.poles.includes(hub.slug)).map((c) => ({
      slug: c.slug,
      theme: c.theme,
      direction: L(c.direction, lang),
      province: L(c.province, lang),
      label: L(c.label, lang),
    })),
    sourceList: sourceList([...hub.sources, ...lines.flatMap((l) => l.sources)]),
    note: L(D.NOTE, lang),
  };
}

function compareYears(values, langValue) {
  const lang = requireLang(langValue);
  const years = [...new Set(values.map(requireYear))].sort((a, b) => a - b);
  if (years.length < 2 || years.length > 3) throw badRequest('years cần 2 hoặc 3 mốc khác nhau, ví dụ years=2026,2035,2065.');
  const columns = years.map((y) => ({ year: y, label: L(YEAR_META.get(y).label, lang), kind: YEAR_META.get(y).kind, stats: buildStats(y) }));
  const first = columns[0].stats;
  const last = columns[columns.length - 1].stats;
  const delta = {
    railKm: round1(last.railKm - first.railKm),
    poles: last.poles - first.poles,
    linesOperating: last.linesOperating - first.linesOperating,
    populationMin: round1(last.population.min - first.population.min),
    populationMax: round1(last.population.max - first.population.max),
  };
  const ids = years.flatMap((y) => [...YEAR_META.get(y).population.sources, ...YEAR_META.get(y).railKm.sources]);
  return { years: columns, delta, from: years[0], to: years[years.length - 1], sourceList: sourceList(ids), note: L(D.NOTE, lang) };
}

// ---------------------------------------------------------------- preset questions (answered from the data)
const QUESTIONS = [
  { id: 'year-summary', text: { vi: 'Mốc này có gì theo quy hoạch?', en: 'What does the plan set for this milestone?' } },
  { id: 'poles', text: { vi: '9 cực phát triển là những khu nào?', en: 'Which are the 9 development poles?' } },
  { id: 'axes', text: { vi: '9 trục động lực nối những đâu?', en: 'What do the 9 dynamic axes connect?' } },
  { id: 'rail', text: { vi: 'Đường sắt đô thị sẽ phát triển thế nào?', en: 'How will urban rail grow?' } },
  { id: 'population', text: { vi: 'Dân số dự báo ra sao?', en: 'What is the population forecast?' } },
  { id: 'airports', text: { vi: 'Hà Nội sẽ có những sân bay nào?', en: 'Which airports will Hanoi have?' } },
  { id: 'region', text: { vi: 'Hà Nội kết nối vùng Thủ đô theo những hướng nào?', en: 'In which directions does Hanoi connect to the Capital Region?' } },
  { id: 'region-logistics', text: { vi: 'Hướng nào phát triển công nghiệp, logistics?', en: 'Which directions are for industry and logistics?' } },
  { id: 'region-commute', text: { vi: 'Từ trung tâm Hà Nội đi các tỉnh lân cận mất bao lâu?', en: 'How long does it take to drive from central Hanoi to the neighbouring provinces?' } },
];
const QUESTION_IDS = QUESTIONS.map((q) => q.id);

/** "Cửa ngõ phía Nam" -> "cửa ngõ phía Nam" (proper nouns further on keep their capitals). */
const lowerFirst = (text) => text.charAt(0).toLowerCase() + text.slice(1);

const popText = (p, lang) => (p.min === p.max ? `${String(p.min).replace('.', lang === 'vi' ? ',' : '.')}` : `${p.min}–${p.max}`) + (lang === 'vi' ? ' triệu' : ' million');

function answerQuestion(id, value, langValue) {
  if (!QUESTION_IDS.includes(id)) throw badRequest(`question phải thuộc: ${QUESTION_IDS.join(', ')}.`);
  const year = requireYear(value);
  const lang = requireLang(langValue);
  const t = (vi, en) => (lang === 'en' ? en : vi);
  const meta = YEAR_META.get(year);
  let answer;
  let highlights = [];
  let ids = [];

  if (id === 'region' || id === 'region-logistics' || id === 'region-commute') {
    const picked = id === 'region-logistics' ? R.CORRIDORS.filter((c) => c.theme === 'industry' || c.theme === 'logistics') : R.CORRIDORS;
    const times = regionTimes();
    ids = [...new Set([...picked.flatMap((c) => c.sources), ...(id === 'region-commute' ? ['osrm'] : [])])];
    // Travel times are about the provinces, not Hanoi's poles: nothing to highlight on the city map.
    highlights = id === 'region-commute' ? [] : [...new Set(picked.flatMap((c) => c.poles))];
    if (id === 'region-commute') {
      answer =
        t('Thời gian lái xe từ trung tâm Hà Nội (Hoàn Kiếm) khi đường thông thoáng, chưa tính kẹt xe: ', 'Driving time from central Hanoi (Hoàn Kiếm) in free-flowing traffic, without congestion: ') +
        picked
          .filter((c) => times[c.slug])
          .map((c) => `${L(c.province, lang)} ~${times[c.slug].minutes} ${t('phút', 'min')} (${times[c.slug].km} km)`)
          .join('; ') +
        '.';
    } else {
      answer =
        t('Theo quy hoạch 100 năm, Hà Nội là hạt nhân của vùng Thủ đô, kết nối các tỉnh lân cận: ', 'Under the 100-year plan, Hanoi is the core of the Capital Region, linked to its neighbours: ') +
        picked.map((c) => `${L(c.direction, lang)} — ${L(c.province, lang)}: ${lowerFirst(L(c.label, lang))}${c.labelSource === 'vtv24Region' ? t(' (theo VTV24)', ' (per VTV24)') : ''}`).join('; ') +
        '.';
    }
  } else if (id === 'poles') {
    highlights = D.HUBS.map((h) => h.slug);
    ids = ['qd2512Poles', 'poleRoles'];
    answer = t('Quy hoạch tổng thể tầm nhìn 100 năm xác định 9 cực phát triển: ', 'The 100-year plan sets 9 development poles: ') + D.HUBS.map((h) => `${L(h.name, lang)} (${L(h.role, lang).toLowerCase()})`).join('; ') + '.';
  } else if (id === 'axes') {
    ids = ['qd2512Poles'];
    answer = t('9 trục động lực: ', 'The 9 dynamic axes: ') + D.AXES.map((a) => `${L(a.name, lang)} — ${L(a.theme, lang)}`).join('; ') + '.';
  } else if (id === 'rail') {
    ids = [...new Set(D.YEARS.flatMap((y) => y.railKm.sources)), 'nq188'];
    answer =
      D.YEARS.map((y) => `${y.year}: ${L(y.railKm.note, lang)}`).join(' → ') +
      t(
        '. Các dự án ưu tiên theo Nghị quyết 188/2025/QH15 gồm tuyến 1, 2, 2A kéo dài, 3 kéo dài và 5 (hướng tuyến trên bản đồ là sơ đồ).',
        '. Priority projects under Resolution 188/2025/QH15 include lines 1, 2, the 2A and 3 extensions, and line 5 (routes on the map are schematic).',
      );
  } else if (id === 'population') {
    ids = [...new Set(D.YEARS.flatMap((y) => y.population.sources))];
    answer = D.YEARS.map((y) => `${y.year}: ${popText(y.population, lang)} (${L(y.population.note, lang)})`).join('; ') + '.';
  } else if (id === 'airports') {
    ids = D.AIRPORTS.flatMap((a) => a.sources);
    highlights = D.HUBS.filter((h) => h.tags.includes('airport')).map((h) => h.slug);
    answer = D.AIRPORTS.map((a) => `${L(a.name, lang)}${a.note ? ` — ${L(a.note, lang)}` : ''}`).join('; ') + '.';
  } else {
    const prev = previousYear(year);
    const stats = buildStats(year);
    ids = [...meta.population.sources, ...meta.railKm.sources, 'qd2512'];
    const newPoles = D.HUBS.filter((h) => h.year === year);
    const newLines = D.METRO_LINES.filter((l) => l.year === year);
    const opened = D.METRO_LINES.concat(D.RING_ROADS).filter((x) => x.openYear && x.openYear <= year && (!prev || x.openYear > prev));
    highlights = newPoles.map((h) => h.slug);
    answer =
      `${L(meta.headline, lang)}. ` +
      t(`Dân số: ${popText(meta.population, lang)} (${L(meta.population.note, lang)}); đường sắt đô thị: ${L(meta.railKm.note, lang)}; ${stats.poles} cực phát triển trên bản đồ.`,
        `Population: ${popText(meta.population, lang)} (${L(meta.population.note, lang)}); urban rail: ${L(meta.railKm.note, lang)}; ${stats.poles} development poles on the map.`) +
      (newPoles.length ? t(` Xuất hiện từ mốc này: ${newPoles.length} cực phát triển theo QĐ 2512.`, ` New at this milestone: ${newPoles.length} development poles from Decision 2512.`) : '') +
      (newLines.length ? t(` ${newLines.length} đoạn tuyến metro ưu tiên được vẽ (sơ đồ).`, ` ${newLines.length} priority metro sections are drawn (schematic).`) : '') +
      (opened.length ? t(` Đi vào khai thác theo kế hoạch: ${opened.map((x) => L(x.name, lang)).join(', ')}.`, ` Due to open by now: ${opened.map((x) => L(x.name, lang)).join(', ')}.`) : '');
  }

  return { id, question: L(QUESTIONS.find((q) => q.id === id).text, lang), year, answer, highlights, sources: sourceList(ids), source: 'rules', note: L(D.NOTE, lang) };
}

function questions(langValue) {
  const lang = requireLang(langValue);
  return QUESTIONS.map((q) => ({ id: q.id, text: L(q.text, lang) }));
}

/** Everything the AI answerer may use, in one language (compact, source ids kept). */
function knowledge(lang) {
  return {
    milestones: D.YEARS.map((y) => ({ year: y.year, label: L(y.label, lang), headline: L(y.headline, lang), population: { ...y.population, note: L(y.population.note, lang) }, railKm: { ...y.railKm, note: L(y.railKm.note, lang) } })),
    poles: D.HUBS.map((h) => ({ slug: h.slug, name: L(h.name, lang), area: L(h.area, lang), role: L(h.role, lang), sources: h.sources })),
    axes: D.AXES.map((a) => ({ name: L(a.name, lang), theme: L(a.theme, lang), poles: a.slugs, sources: a.sources })),
    metroLines: D.METRO_LINES.map((l) => ({ name: L(l.name, lang), status: l.status, openYear: l.openYear ?? null, note: L(l.note, lang), sources: l.sources })),
    ringRoads: D.RING_ROADS.map((r) => ({ name: L(r.name, lang), status: r.status, openYear: r.openYear ?? null, note: L(r.note, lang) ?? null, sources: r.sources })),
    airports: D.AIRPORTS.map((a) => ({ name: L(a.name, lang), status: a.status, note: L(a.note, lang) ?? null, sources: a.sources })),
    green: D.GREEN_AREAS.map((g) => ({ name: L(g.name, lang), status: g.status, sources: g.sources })),
    capitalRegion: {
      corridors: R.CORRIDORS.map((c) => ({
        slug: c.slug,
        direction: L(c.direction, lang),
        province: L(c.province, lang),
        formerly: L(c.formerly, lang),
        theme: L(R.THEMES[c.theme], lang),
        role: L(c.label, lang),
        roleQuotedFrom: c.labelSource === 'vtv24Region' ? 'VTV24 report (not plan text)' : c.labelSource,
        facts: c.facts.map((f) => ({ text: L(f.text, lang), sources: f.sources })),
        drivingFromCentre: regionTimes()[c.slug] ?? null,
        faces: c.poles,
        sources: c.sources,
      })),
      infrastructure: R.INFRA.map((i) => ({ name: L(i.name, lang), status: i.status, openYear: i.openYear ?? null, note: L(i.note, lang) ?? null, sources: i.sources })),
      drivingTimesSource: 'osrm',
    },
    sourceIds: Object.keys(ALL_SOURCES),
  };
}

// ---------------------------------------------------------------- the Capital Region (region.js)
const CORRIDOR_BY_SLUG = new Map(R.CORRIDORS.map((c) => [c.slug, c]));
const REGION_NOTE = {
  vi:
    'Vùng Thủ đô theo phạm vi nghiên cứu của Quy hoạch tổng thể Thủ đô tầm nhìn 100 năm; tên tỉnh sau sắp xếp năm 2025 (NQ 202/2025/QH15). ' +
    'Chức năng từng hướng trích từ phóng sự VTV24 (ghi rõ), không phải nguyên văn quy hoạch. Hình học là sơ đồ; thời gian lái xe tính bằng OSRM khi đường thông thoáng.',
  en:
    "The Capital Region as studied by the 100-year Capital master plan; province names after the 2025 merger (Resolution 202/2025/QH15). " +
    'The role of each direction is quoted from a VTV24 report (marked as such), not plan text. Geometry is schematic; driving times come from OSRM in free-flowing traffic.',
};

let provinces;
/** Outlines of Hanoi and the six provinces (OSM, `npm run data:provinces`); empty when the file is missing. */
function provinceOutlines() {
  if (provinces === undefined) {
    try {
      provinces = require('./data/provinces.json').features;
    } catch {
      provinces = [];
    }
  }
  return provinces;
}

let times;
/** Driving times from central Hanoi ({ slug: { minutes, km } }), from `npm run data:region`; {} when missing. */
function regionTimes() {
  if (times === undefined) {
    try {
      times = require('./data/region-times.json').times;
    } catch {
      times = {};
    }
  }
  return times;
}

/** Point `km` from `from` towards `to` (equirectangular — fine at this scale). */
function towards(from, to, km) {
  const kx = 111.32 * Math.cos((from[1] * Math.PI) / 180);
  const dx = (to[0] - from[0]) * kx;
  const dy = (to[1] - from[1]) * 110.574;
  const len = Math.hypot(dx, dy) || 1;
  return [round5(from[0] + ((dx / len) * km) / kx), round5(from[1] + ((dy / len) * km) / 110.574)];
}
const round5 = (n) => Math.round(n * 1e5) / 1e5;

/** Arrowhead triangle at the end of a straight arrow (`lengthKm` long, `widthKm` wide). */
function arrowhead(from, tip, lengthKm = 5, widthKm = 4.5) {
  const base = towards(tip, from, lengthKm);
  const kx = 111.32 * Math.cos((tip[1] * Math.PI) / 180);
  const dx = (tip[0] - from[0]) * kx;
  const dy = (tip[1] - from[1]) * 110.574;
  const len = Math.hypot(dx, dy) || 1;
  const nx = (-dy / len) * (widthKm / 2);
  const ny = (dx / len) * (widthKm / 2);
  return [tip, [round5(base[0] + nx / kx), round5(base[1] + ny / 110.574)], [round5(base[0] - nx / kx), round5(base[1] - ny / 110.574)], tip];
}

function corridorSummary(c, lang) {
  return {
    slug: c.slug,
    theme: c.theme,
    themeLabel: L(R.THEMES[c.theme], lang),
    direction: L(c.direction, lang),
    province: L(c.province, lang),
    formerly: L(c.formerly, lang),
    label: L(c.label, lang),
    labelSource: c.labelSource,
    destination: c.destination,
    nodes: c.nodes,
    travel: regionTimes()[c.slug] ?? null,
    poles: c.poles.map((slug) => ({ slug, name: L(HUB_BY_SLUG.get(slug).name, lang) })),
    gateway: c.gateway,
  };
}

function regionInfraView(item, year, lang) {
  return {
    id: item.id,
    kind: item.kind,
    name: L(item.name, lang),
    note: L(item.note, lang) ?? null,
    status: statusIn(item, year),
    openYear: item.openYear ?? null,
    firstYear: item.year,
    schematic: !!item.schematic,
    sources: item.sources,
  };
}

const regionCache = new Map();
/** Everything the "Vùng Thủ đô" view draws for one year and language. */
function getRegion(value, langValue) {
  const year = requireYear(value);
  const lang = requireLang(langValue);
  const key = `${year}|${lang}`;
  if (!regionCache.has(key)) {
    const corridors = R.CORRIDORS.filter((c) => visible(c, year));
    // Arrows start a little outside the centre so they read as leaving Hanoi, and stop just short of the town.
    const arrows = corridors.map((c) => {
      const start = towards(R.ORIGIN, c.destination, 9);
      const tip = towards(c.destination, R.ORIGIN, 3);
      return { c, start, tip };
    });
    const infra = R.INFRA.filter((i) => visible(i, year));
    regionCache.set(key, {
      year,
      lang,
      origin: R.ORIGIN,
      themes: Object.fromEntries(Object.entries(R.THEMES).map(([k, v]) => [k, L(v, lang)])),
      corridors: corridors.map((c) => corridorSummary(c, lang)),
      layers: {
        // Province areas, tinted by the theme of their direction; Hanoi is the core.
        provinces: fc(
          provinceOutlines().map((f) => {
            const c = f.properties.corridor ? CORRIDOR_BY_SLUG.get(f.properties.corridor) : null;
            return feature(f.geometry, {
              slug: f.properties.slug,
              corridor: c?.slug ?? null,
              theme: c?.theme ?? 'core',
              name: c ? L(c.province, lang) : lang === 'en' ? 'Hanoi' : 'Hà Nội',
              formerly: c ? L(c.formerly, lang) : null,
            });
          }),
        ),
        arrows: fc(arrows.map(({ c, start, tip }) => feature({ type: 'LineString', coordinates: [start, tip] }, { slug: c.slug, theme: c.theme, label: L(c.label, lang) }))),
        arrowheads: fc(arrows.map(({ c, start, tip }) => feature({ type: 'Polygon', coordinates: [arrowhead(start, tip)] }, { slug: c.slug, theme: c.theme }))),
        destinations: fc(
          corridors.map((c) =>
            feature({ type: 'Point', coordinates: c.destination }, { slug: c.slug, theme: c.theme, province: L(c.province, lang), label: L(c.label, lang), direction: L(c.direction, lang) }),
          ),
        ),
        nodes: fc(corridors.flatMap((c) => c.nodes.map((n) => feature({ type: 'Point', coordinates: n.at }, { slug: c.slug, theme: c.theme, name: n.name })))),
        infraLines: fc(
          infra
            .filter((i) => i.coords)
            .map((i) => feature({ type: 'LineString', coordinates: i.coords }, { ...regionInfraView(i, year, lang) })),
        ),
        infraPoints: fc(infra.filter((i) => i.at).map((i) => feature({ type: 'Point', coordinates: i.at }, { ...regionInfraView(i, year, lang) }))),
      },
      sources: ALL_SOURCES,
      note: L(REGION_NOTE, lang),
    });
  }
  return regionCache.get(key);
}

function getCorridor(slug, value, langValue) {
  const year = requireYear(value);
  const lang = requireLang(langValue);
  const c = CORRIDOR_BY_SLUG.get(slug);
  if (!c) throw notFound(`Không tìm thấy hướng kết nối "${slug}".`);
  const infra = c.via.map((id) => {
    const own = R.INFRA.find((i) => i.id === id);
    if (own) return { ...regionInfraView(own, year, lang), shownFrom: own.year };
    const ext = R.EXTERNAL_INFRA[id];
    return { id, kind: 'ring', name: L(ext, lang), note: null, status: statusIn(ext, year), openYear: ext.openYear ?? null, schematic: true, sources: ext.sources, shownFrom: 2026 };
  });
  const travel = regionTimes()[c.slug] ?? null;
  return {
    ...corridorSummary(c, lang),
    year,
    facts: c.facts.map((f) => ({ text: L(f.text, lang), sources: f.sources })),
    infrastructure: infra,
    sourceList: sourceList([...c.sources, ...infra.flatMap((i) => i.sources), ...(travel ? ['osrm'] : [])]),
    note: L(REGION_NOTE, lang),
  };
}

module.exports = { getRegion, getCorridor, CORRIDOR_SLUGS: R.CORRIDORS.map((c) => c.slug), getScenario, getTimeline, getHub, compareYears, answerQuestion, questions, knowledge, sourceList, requireYear, requireLang, QUESTION_IDS, YEAR_VALUES: D.YEAR_VALUES, HUB_SLUGS: D.HUBS.map((h) => h.slug) };
