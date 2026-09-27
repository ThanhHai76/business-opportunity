'use strict';
const { badRequest, notFound } = require('../living-score/common/http');
const { circleLine, circleRing, distanceKm, lineLengthKm } = require('./geo');
const D = require('./data');

const clamp = (n) => Math.max(0, Math.min(100, Math.round(n)));
const round1 = (n) => Math.round(n * 10) / 10;
const fc = (features) => ({ type: 'FeatureCollection', features });
const feature = (geometry, properties) => ({ type: 'Feature', geometry, properties });

const YEAR_META = new Map(D.YEARS.map((y) => [y.year, y]));
const HUB_BY_SLUG = new Map(D.HUBS.map((h) => [h.slug, h]));

/** How mature a hub is in each scenario year (hubs reach their listed scores in 2050). */
const DEV_FACTOR = { 2026: 0.58, 2030: 0.74, 2050: 1, 2100: 1.04 };
const GREEN_FACTOR = { 2026: 0.92, 2030: 0.95, 2050: 1, 2100: 1.03 };

function requireYear(value) {
  const year = Number(value);
  if (!YEAR_META.has(year)) throw badRequest(`year phải thuộc: ${D.YEAR_VALUES.join(', ')}.`);
  return year;
}

const previousYear = (year) => D.YEAR_VALUES[D.YEAR_VALUES.indexOf(year) - 1];
const visible = (item, year) => item.year <= year;

// ---------------------------------------------------------------- metro helpers
function visibleLines(year) {
  return D.METRO_LINES.filter((l) => visible(l, year));
}

/** Distinct metro lines with a vertex close to the hub (its radius plus a 1.2 km catchment). */
function linesServing(hub, year) {
  const reach = hub.radiusKm + 1.2;
  const ids = new Set();
  for (const line of visibleLines(year)) {
    if (line.id === 'metro-ring') continue;
    if (line.coords.some((c) => distanceKm(c, hub.center) <= reach)) ids.add(line.id);
  }
  return ids;
}

const MAX_SERVING = new Map(D.HUBS.map((h) => [h.slug, linesServing(h, 2100).size]));

function hubScores(hub, year) {
  const maxLines = MAX_SERVING.get(hub.slug);
  const ratio = maxLines > 0 ? linesServing(hub, year).size / maxLines : DEV_FACTOR[year];
  return {
    development: clamp(hub.scores.development * DEV_FACTOR[year]),
    tod: clamp(hub.scores.tod * (0.35 + 0.65 * ratio)),
    green: clamp(hub.scores.green * GREEN_FACTOR[year]),
    connectivity: clamp(hub.scores.connectivity * (0.5 + 0.5 * ratio)),
  };
}

function hubFacts(hub, year) {
  const serving = linesServing(hub, year);
  return {
    metroLines: serving.size,
    metroLineNames: [...serving].map((id) => D.METRO_LINES.find((l) => l.id === id).name.replace(/\s*\(.*\)$/, '')),
    newUrbanArea: hub.tags.includes('development'),
    airportConnection: hub.tags.includes('airport'),
    commercialLogistics: hub.tags.includes('logistics'),
  };
}

function hubView(hub, year) {
  return {
    slug: hub.slug,
    name: hub.name,
    role: hub.role,
    center: hub.center,
    radiusKm: hub.radiusKm,
    tags: hub.tags,
    firstYear: hub.year,
    scores: hubScores(hub, year),
    facts: hubFacts(hub, year),
    isNew: hub.year > (previousYear(year) ?? 0) && hub.year <= year,
    blurb: hub.blurb,
  };
}

// ---------------------------------------------------------------- scenario payload
function buildLayers(year) {
  const prev = previousYear(year) ?? 0;
  const isNew = (item) => item.year > prev && item.year <= year;

  const lines = visibleLines(year);
  const metroLines = fc(
    lines.map((l) =>
      feature(
        { type: 'LineString', coordinates: l.coords },
        { id: l.id, name: l.name, color: l.color, year: l.year, lengthKm: round1(lineLengthKm(l.coords)), isNew: isNew(l) },
      ),
    ),
  );

  const stationKeys = new Set();
  const stations = [];
  for (const l of lines) {
    if (l.id === 'metro-ring') continue;
    for (const c of l.coords) {
      const key = `${c[0].toFixed(3)},${c[1].toFixed(3)}`;
      if (stationKeys.has(key)) continue;
      stationKeys.add(key);
      stations.push(feature({ type: 'Point', coordinates: c }, { line: l.id, color: l.color }));
    }
  }

  const roads = fc([
    ...D.RING_ROADS.filter((r) => visible(r, year)).map((r, i) =>
      feature(
        { type: 'LineString', coordinates: circleLine(D.CENTER, r.radiusKm, { wobble: 0.05, phase: i + 0.5 }) },
        { kind: 'ring', name: r.name, year: r.year, isNew: isNew(r) },
      ),
    ),
    ...D.EXPRESSWAYS.filter((r) => visible(r, year)).map((r) =>
      feature({ type: 'LineString', coordinates: r.coords }, { kind: 'expressway', name: r.name, year: r.year, isNew: isNew(r) }),
    ),
  ]);

  const green = fc(
    D.GREEN_AREAS.filter((g) => visible(g, year)).map((g) =>
      feature({ type: 'Polygon', coordinates: g.polygon }, { name: g.name, kind: g.kind, year: g.year, isNew: isNew(g) }),
    ),
  );

  const water = fc([
    feature({ type: 'LineString', coordinates: D.RED_RIVER }, { name: 'Sông Hồng', kind: 'river' }),
    feature({ type: 'LineString', coordinates: D.DUONG_RIVER }, { name: 'Sông Đuống', kind: 'river' }),
    feature({ type: 'Polygon', coordinates: [D.WEST_LAKE] }, { name: 'Hồ Tây', kind: 'lake' }),
  ]);

  const airports = fc(
    D.AIRPORTS.filter((a) => visible(a, year)).map((a) =>
      feature({ type: 'Point', coordinates: a.at }, { name: a.name, kind: a.kind, status: a.status, isNew: isNew(a) }),
    ),
  );

  const hubs = D.HUBS.filter((h) => visible(h, year));
  const hubViews = hubs.map((h) => hubView(h, year));
  const hubPoints = fc(hubViews.map((h) => feature({ type: 'Point', coordinates: h.center }, h)));

  const zones = fc(
    hubViews.map((h, i) =>
      feature(
        { type: 'Polygon', coordinates: [circleRing(h.center, h.radiusKm, { wobble: 0.14, phase: i })] },
        { slug: h.slug, name: h.name, development: h.scores.development, height: h.scores.development * 24, isNew: h.isNew },
      ),
    ),
  );

  const tod = fc(
    hubViews
      .filter((h) => h.tags.includes('tod') && h.facts.metroLines > 0)
      .map((h, i) =>
        feature(
          { type: 'Polygon', coordinates: [circleRing(h.center, 1 + h.radiusKm * 0.18, { wobble: 0.1, phase: i + 2 })] },
          { slug: h.slug, name: `TOD ${h.name}`, tod: h.scores.tod, height: h.scores.tod * 32 },
        ),
      ),
  );

  const boundaries = fc([
    feature({ type: 'Polygon', coordinates: [circleRing(D.CENTER, 11, { wobble: 0.06, phase: 0.2 })] }, { name: 'Vùng đô thị lõi' }),
    ...hubViews.map((h, i) =>
      feature({ type: 'Polygon', coordinates: [circleRing(h.center, h.radiusKm * 1.7, { wobble: 0.1, phase: i + 4 })] }, { name: `Vùng quy hoạch ${h.name}` }),
    ),
  ]);

  const shown = new Set(hubs.map((h) => h.slug));
  const axes = fc(
    D.AXES.map((a) => ({ ...a, hubs: a.slugs.map((s) => HUB_BY_SLUG.get(s)) }))
      .map((a) => ({ ...a, cut: a.hubs.filter((h) => shown.has(h.slug)) }))
      .filter((a) => a.cut.length >= 2)
      .map((a) => feature({ type: 'LineString', coordinates: a.cut.map((h) => h.center) }, { name: a.name })),
  );

  return { metroLines, metroStations: fc(stations), roads, green, water, airports, hubs: hubPoints, zones, tod, boundaries, axes };
}

function buildStats(year) {
  const meta = YEAR_META.get(year);
  const lines = visibleLines(year).filter((l) => l.id !== 'metro-ring');
  const ring = visibleLines(year).find((l) => l.id === 'metro-ring');
  const lineIds = new Set(visibleLines(year).map((l) => l.id));
  const km = lines.reduce((sum, l) => sum + lineLengthKm(l.coords), 0) + (ring ? lineLengthKm(ring.coords) : 0);
  return {
    metroLines: lineIds.size,
    metroKm: Math.round(km),
    hubs: D.HUBS.filter((h) => visible(h, year)).length,
    airports: D.AIRPORTS.filter((a) => visible(a, year) && a.kind === 'airport').length,
    greenPct: meta.greenPct,
    population: meta.population,
  };
}

const cache = new Map();

/** Everything the map needs for one timeline year. Deterministic, so it is memoised. */
function getScenario(value) {
  const year = requireYear(value);
  if (!cache.has(year)) {
    const meta = YEAR_META.get(year);
    cache.set(year, {
      year,
      label: meta.label,
      kind: meta.kind,
      headline: meta.headline,
      stats: buildStats(year),
      layers: buildLayers(year),
      scenario: true,
      note: D.SCENARIO_NOTE,
    });
  }
  return cache.get(year);
}

function getTimeline() {
  return {
    years: D.YEARS.map((y) => ({ year: y.year, label: y.label, kind: y.kind, headline: y.headline, stats: buildStats(y.year) })),
    center: D.CENTER,
    scenario: true,
    note: D.SCENARIO_NOTE,
  };
}

// ---------------------------------------------------------------- hub detail & compare
function getHub(slug, value) {
  const year = requireYear(value);
  const hub = HUB_BY_SLUG.get(slug);
  if (!hub) throw notFound(`Không tìm thấy cực phát triển "${slug}".`);
  const byYear = D.YEAR_VALUES.filter((y) => y >= hub.year).map((y) => ({ year: y, scores: hubScores(hub, y), metroLines: linesServing(hub, y).size }));
  const present = year >= hub.year;
  return {
    ...(present ? hubView(hub, year) : { slug: hub.slug, name: hub.name, role: hub.role, center: hub.center, firstYear: hub.year, blurb: hub.blurb }),
    year,
    presentInYear: present,
    byYear,
    scenario: true,
    note: D.SCENARIO_NOTE,
  };
}

function compareYears(values) {
  const years = [...new Set(values.map(requireYear))].sort((a, b) => a - b);
  if (years.length < 2 || years.length > 3) throw badRequest('years cần 2 hoặc 3 mốc khác nhau, ví dụ years=2030,2050,2100.');
  const columns = years.map((y) => ({ year: y, label: YEAR_META.get(y).label, kind: YEAR_META.get(y).kind, stats: buildStats(y) }));
  const first = columns[0].stats;
  const last = columns[columns.length - 1].stats;
  const delta = Object.fromEntries(Object.keys(first).map((k) => [k, round1(last[k] - first[k])]));
  return { years: columns, delta, from: years[0], to: years[years.length - 1], scenario: true, note: D.SCENARIO_NOTE };
}

// ---------------------------------------------------------------- questions (preset, answered from the data)
const QUESTIONS = [
  { id: 'year-summary', text: 'Mốc này khác gì so với mốc trước?' },
  { id: 'top-tod', text: 'Khu nào có tiềm năng TOD cao nhất?' },
  { id: 'greenest', text: 'Đâu là những cực xanh nhất?' },
  { id: 'fastest-growth', text: 'Cực nào tăng trưởng nhanh nhất từ hôm nay?' },
  { id: 'airport-link', text: 'Các cực nào kết nối với sân bay?' },
  { id: 'metro-growth', text: 'Mạng lưới metro mở rộng thế nào theo thời gian?' },
];
const QUESTION_IDS = QUESTIONS.map((q) => q.id);

const topBy = (views, pick, n) => [...views].sort((a, b) => pick(b) - pick(a) || a.name.localeCompare(b.name, 'vi')).slice(0, n);
const listNames = (items) => items.map((h) => `${h.name} (${h.value})`).join(', ');

function answerQuestion(id, value) {
  if (!QUESTION_IDS.includes(id)) throw badRequest(`question phải thuộc: ${QUESTION_IDS.join(', ')}.`);
  const year = requireYear(value);
  const meta = YEAR_META.get(year);
  const views = D.HUBS.filter((h) => visible(h, year)).map((h) => hubView(h, year));
  const stats = buildStats(year);
  const question = QUESTIONS.find((q) => q.id === id).text;
  let answer;
  let highlights = [];

  if (id === 'top-tod') {
    const top = topBy(views, (h) => h.scores.tod, 3).map((h) => ({ ...h, value: h.scores.tod }));
    highlights = top.map((h) => h.slug);
    answer = `Trong kịch bản ${year}, ba cực có điểm TOD cao nhất là ${listNames(top)}. Điểm TOD tăng theo số tuyến metro chạm tới cực: ${top
      .map((h) => `${h.name} có ${h.facts.metroLines} tuyến`)
      .join('; ')}.`;
  } else if (id === 'greenest') {
    const top = topBy(views, (h) => h.scores.green, 3).map((h) => ({ ...h, value: h.scores.green }));
    highlights = top.map((h) => h.slug);
    answer = `Các cực xanh nhất trong kịch bản ${year}: ${listNames(top)}. Toàn thành phố ước đạt khoảng ${stats.greenPct}% diện tích xanh theo giả định của kịch bản.`;
  } else if (id === 'fastest-growth') {
    if (year === D.YEAR_VALUES[0]) {
      answer = 'Đang ở mốc hiện tại nên chưa có mức tăng để so sánh. Hãy chọn một mốc sau (2030, 2050 hoặc 2100).';
    } else {
      const growth = D.HUBS.filter((h) => visible(h, D.YEAR_VALUES[0]))
        .map((h) => ({ ...h, value: hubScores(h, year).development - hubScores(h, D.YEAR_VALUES[0]).development }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 3);
      highlights = growth.map((h) => h.slug);
      answer = `Từ ${D.YEAR_VALUES[0]} đến ${year}, điểm phát triển tăng nhanh nhất ở ${growth.map((h) => `${h.name} (+${h.value})`).join(', ')}. Đây là các cực đã có nền tảng hôm nay và được hưởng lợi nhiều nhất từ metro và vành đai.`;
    }
  } else if (id === 'airport-link') {
    const linked = views.filter((h) => h.facts.airportConnection);
    highlights = linked.map((h) => h.slug);
    const airports = D.AIRPORTS.filter((a) => a.kind === 'airport' && visible(a, year)).map((a) => a.name);
    answer = linked.length
      ? `Ở mốc ${year} có ${linked.length} cực gắn với sân bay (${airports.join(', ')}): ${linked.map((h) => h.name).join(', ')}.`
      : 'Ở mốc này chưa có cực nào được gắn với sân bay trong kịch bản.';
  } else if (id === 'metro-growth') {
    answer = D.YEAR_VALUES.map((y) => {
      const s = buildStats(y);
      return `${y}: ${s.metroLines} tuyến, khoảng ${s.metroKm} km`;
    }).join(' → ');
    answer = `Mạng metro theo kịch bản — ${answer}. Con số là ước lượng từ hình học minh hoạ, không phải chiều dài chính thức.`;
  } else {
    const prev = previousYear(year);
    if (!prev) {
      answer = `${meta.headline}. Đây là mốc xuất phát: ${stats.metroLines} tuyến metro, ${stats.hubs} cực phát triển, dân số khoảng ${stats.population} triệu.`;
    } else {
      const before = buildStats(prev);
      const newLines = new Set(visibleLines(year).filter((l) => l.year > prev).map((l) => l.id));
      const newHubs = D.HUBS.filter((h) => h.year > prev && h.year <= year);
      highlights = newHubs.map((h) => h.slug);
      answer =
        `So với ${prev}: metro từ ${before.metroLines} lên ${stats.metroLines} tuyến (+${stats.metroKm - before.metroKm} km), ` +
        `${newHubs.length ? `thêm ${newHubs.length} cực mới (${newHubs.map((h) => h.name).join(', ')})` : 'không thêm cực mới'}, ` +
        `diện tích xanh ${before.greenPct}% → ${stats.greenPct}%, dân số ${before.population} → ${stats.population} triệu` +
        `${newLines.size ? ` (${newLines.size} tuyến metro mới hoặc mở rộng)` : ''}.`;
    }
  }

  return { id, question, year, answer, highlights, source: 'rules', scenario: true, note: D.SCENARIO_NOTE };
}

module.exports = { getScenario, getTimeline, getHub, compareYears, answerQuestion, QUESTIONS, QUESTION_IDS, YEAR_VALUES: D.YEAR_VALUES };
