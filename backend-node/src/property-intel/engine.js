'use strict';
/**
 * AI Property Intelligence — deterministic engine. Turns the SAMPLE DATA in data.js into the
 * responses the API serves: growth scores and ranks, price series, project valuations and
 * proximity (real distances between the sample coordinates). No randomness at request time.
 */
const { haversineKm } = require('../living-score/common/geo');
const { normalizeText } = require('../living-score/common/text');
const { mulberry32, hashString } = require('../living-score/seed/geometry');
const { notFound } = require('../living-score/common/http');
const data = require('./data');

const round1 = (n) => Math.round(n * 10) / 10;
const round2 = (n) => Math.round(n * 100) / 100;
const avg = (values) => values.reduce((s, v) => s + v, 0) / values.length;
const toPoint = ([lng, lat]) => ({ lng, lat });
const distanceM = (a, b) => Math.round(haversineKm(toPoint(a), toPoint(b)) * 1000);

const TOD_RADIUS_M = 800;
const PRICE_YEARS = [2020, 2021, 2022, 2023, 2024, 2025, 2026];
/** Project histories are quarterly, Q3 2021 → Q3 2026 (21 points). */
const QUARTERS = Array.from({ length: 21 }, (_, i) => {
  const q = ((2 + i) % 4) + 1;
  const year = 2021 + Math.floor((2 + i) / 4);
  return `Q${q} '${String(year).slice(2)}`;
});

// ---------------------------------------------------------------- districts

const growthScoreExact = (scores) => data.CRITERIA.reduce((sum, c) => sum + c.weight * scores[c.key], 0);

/** 2020 → 2026 yearly series: geometric from 2020 to last year, then the stated YoY jump. */
function priceSeries({ y2020, now, yoy }) {
  const lastYear = now / (1 + yoy);
  const steps = 5;
  const series = Array.from({ length: steps + 1 }, (_, i) => y2020 * (lastYear / y2020) ** (i / steps));
  series.push(now);
  return series.map(round1);
}

const RANKED = [...data.DISTRICTS]
  .map((d) => ({ slug: d.slug, exact: growthScoreExact(d.scores) }))
  .sort((a, b) => b.exact - a.exact);

const CITY = {
  absorption: Math.round(avg(data.DISTRICTS.map((d) => d.absorption))),
  rentalYield: round1(avg(data.DISTRICTS.map((d) => d.rentalYield))),
  priceNow: round1(avg(data.DISTRICTS.map((d) => d.price.now))),
  priceSeries: PRICE_YEARS.map((_, i) => round1(avg(data.DISTRICTS.map((d) => priceSeries(d.price)[i])))),
};

function findDistrict(slug) {
  const district = data.DISTRICTS.find((d) => d.slug === slug);
  if (!district) throw notFound(`Không tìm thấy khu vực "${slug}".`);
  return district;
}

function districtSummary(d) {
  const rank = RANKED.findIndex((r) => r.slug === d.slug) + 1;
  return {
    slug: d.slug,
    name: d.name,
    center: d.center,
    growthScore: Math.round(growthScoreExact(d.scores)),
    rank,
    pricePerM2: d.price.now,
    yoy: round1(d.price.yoy * 100),
    risk: d.scores.risk,
    absorption: d.absorption,
  };
}

function listDistricts() {
  return RANKED.map((r) => districtSummary(findDistrict(r.slug)));
}

function getDistrict(slug) {
  const d = findDistrict(slug);
  const summary = districtSummary(d);
  const series = priceSeries(d.price);
  const cagr = (d.population.now / d.population.y2020) ** (1 / 6) - 1;
  return {
    ...summary,
    tagline: d.tagline,
    areaKm2: d.areaKm2,
    total: data.DISTRICTS.length,
    scoreDelta: summary.growthScore - d.scoreQ1,
    aiConfidence: d.aiConfidence,
    criteria: data.CRITERIA.map((c) => ({ key: c.key, code: c.code, label: c.label, tone: c.tone, value: d.scores[c.key] })),
    metrics: {
      pricePerM2: d.price.now,
      yoy: round1(d.price.yoy * 100),
      absorption: d.absorption,
      absorptionDeltaQoQ: d.absorptionDeltaQoQ,
      pipelineUnits: d.pipeline.units,
      pipelineProjects: d.pipeline.projects,
      rentalYield: d.rentalYield,
      cityRentalYield: CITY.rentalYield,
      cityAbsorption: CITY.absorption,
    },
    priceTrend: {
      years: PRICE_YEARS,
      district: series,
      city: CITY.priceSeries,
      change6y: Math.round((d.price.now / d.price.y2020 - 1) * 100),
    },
    infraImpacts: d.infraImpacts,
    supplyDemand: d.supplyDemand,
    population: {
      points: [
        { label: '2020', value: d.population.y2020 },
        { label: '2026', value: d.population.now },
        { label: '2030F', value: d.population.y2030, forecast: true },
      ],
      now: d.population.now,
      cagr: round1(cagr * 100),
    },
    timeline: { from: 2025, to: 2032, now: 2026, items: d.timeline },
    projects: data.PROJECTS.filter((p) => p.district === d.slug).map(projectSummary),
  };
}

// ---------------------------------------------------------------- projects

function findProject(slug) {
  const project = data.PROJECTS.find((p) => p.slug === slug);
  if (!project) throw notFound(`Không tìm thấy dự án "${slug}".`);
  return project;
}

function projectSummary(p) {
  return {
    slug: p.slug,
    name: p.name,
    tower: p.tower,
    district: p.district,
    districtName: findDistrict(p.district).name,
    coords: p.coords,
    pricePerM2: p.pricePerM2,
    soldPct: p.soldPct,
    handover: p.handover,
  };
}

const GENERIC_POIS = [
  { kind: 'school', name: 'Primary school' },
  { kind: 'school', name: 'Secondary school' },
  { kind: 'school', name: 'Kindergarten' },
  { kind: 'hospital', name: 'District hospital' },
  { kind: 'mall', name: 'Shopping centre' },
  { kind: 'park', name: 'Neighbourhood park' },
];

/** Landmarks around a project: its own list, or deterministic generic ones 250-1,300 m away. */
function projectPois(p) {
  if (p.pois) return p.pois;
  const rand = mulberry32(hashString(p.slug));
  return GENERIC_POIS.map((poi) => {
    const angle = rand() * Math.PI * 2;
    const km = 0.25 + rand() * 1.05;
    const dLat = (km * Math.sin(angle)) / 110.574;
    const dLng = (km * Math.cos(angle)) / (111.32 * Math.cos((p.coords[1] * Math.PI) / 180));
    return { ...poi, coords: [round6(p.coords[0] + dLng), round6(p.coords[1] + dLat)] };
  });
}
const round6 = (n) => Math.round(n * 1e6) / 1e6;

function nearestStation(coords) {
  return data.STATIONS.map((s) => ({ ...s, distanceM: distanceM(coords, s.coords) })).sort((a, b) => a.distanceM - b.distanceM)[0];
}

function proximity(p, pois) {
  const station = nearestStation(p.coords);
  const withDistance = pois.map((poi) => ({ ...poi, distanceM: distanceM(p.coords, poi.coords) }));
  const nearest = (kind) => withDistance.filter((x) => x.kind === kind).sort((a, b) => a.distanceM - b.distanceM)[0];
  const schools = withDistance.filter((x) => x.kind === 'school');
  const todGap = Math.max(0, station.distanceM - TOD_RADIUS_M);
  const rows = [
    { key: 'metro', label: 'Nearby Metro', detail: `${station.name} · ${station.line}`, distanceM: station.distanceM, tone: 'mobility' },
    { key: 'tod', label: 'TOD Distance', detail: todGap === 0 ? 'inside core ring' : `outside ${TOD_RADIUS_M} m ring`, distanceM: todGap, tone: 'mobility' },
  ];
  const school = nearest('school');
  if (school) {
    const within = schools.filter((s) => s.distanceM <= 1500).length;
    rows.push({ key: 'school', label: 'Schools', detail: `${within} within 1.5 km`, distanceM: school.distanceM });
  }
  const hospital = nearest('hospital');
  if (hospital) rows.push({ key: 'hospital', label: 'Hospitals', detail: hospital.name, distanceM: hospital.distanceM });
  const mall = nearest('mall');
  if (mall) rows.push({ key: 'mall', label: 'Shopping', detail: mall.name, distanceM: mall.distanceM });
  const park = nearest('park');
  if (park) rows.push({ key: 'park', label: 'Green Space', detail: park.name, distanceM: park.distanceM, tone: 'growth' });
  return { station, rows };
}

/** Quarterly price history between price5y and today with a small deterministic wobble. */
function projectHistory(p) {
  const rand = mulberry32(hashString(`${p.slug}:history`));
  const last = QUARTERS.length - 1;
  return QUARTERS.map((label, i) => {
    const base = p.price5y * (p.pricePerM2 / p.price5y) ** (i / last);
    const wobble = i === 0 || i === last ? 1 : 1 + (rand() - 0.5) * 0.025;
    return { label, value: round1(base * wobble) };
  });
}

function getProject(slug) {
  const p = findProject(slug);
  const district = findDistrict(p.district);
  const pois = projectPois(p);
  const { station, rows } = proximity(p, pois);
  const estimate = (p.pricePerM2 * p.typical.m2) / 1000; // tỷ VND
  const nearby = data.PROJECTS.filter((o) => o.slug !== p.slug)
    .map((o) => ({ o, d: distanceM(p.coords, o.coords), same: o.district === p.district }))
    .sort((a, b) => Number(b.same) - Number(a.same) || a.d - b.d)
    .slice(0, 3)
    .map(({ o, d }) => ({ ...projectSummary(o), distanceM: d }));
  return {
    ...projectSummary(p),
    ward: p.ward,
    floors: p.floors,
    units: p.units,
    typical: p.typical,
    estimate: { value: round2(estimate), plusMinus: round2(estimate * 0.04), m2: p.typical.m2 },
    vsDistrict: round1((p.pricePerM2 / district.price.now - 1) * 100),
    districtPricePerM2: district.price.now,
    history: { points: projectHistory(p), milestone: p.milestone },
    devScore: p.devScore,
    devNote: p.devNote,
    riskScore: p.riskScore,
    riskNote: p.riskNote,
    station: { name: station.name, line: station.line, coords: station.coords, distanceM: station.distanceM },
    todRadiusM: TOD_RADIUS_M,
    proximity: rows,
    pois,
    plannedInfra: p.plannedInfra,
    nearby,
    aiTake: p.aiTake,
    baseScenario: district.insight.scenarios.base,
  };
}

function listProjects() {
  return data.PROJECTS.map(projectSummary);
}

// ---------------------------------------------------------------- search / overview

function search(query) {
  const q = normalizeText(query);
  if (!q) return { results: [] };
  // Word-prefix match: "gia" finds Gia Lâm but not Cầu Giấy.
  const matches = (text) => ` ${normalizeText(text)}`.includes(` ${q}`);
  const districts = data.DISTRICTS.filter((d) => matches(d.name)).map((d) => ({
    type: 'district',
    slug: d.slug,
    name: d.name,
    detail: `District · score ${districtSummary(d).growthScore}`,
  }));
  const projects = data.PROJECTS.filter((p) => matches(`${p.name} ${p.ward}`)).map((p) => ({
    type: 'project',
    slug: p.slug,
    name: p.name,
    detail: `${findDistrict(p.district).name} · ${p.pricePerM2} tr/m²`,
  }));
  return { results: [...districts, ...projects].slice(0, 8) };
}

function overview() {
  const featured = getDistrict('gia-lam');
  return {
    sampleData: true,
    note: 'SAMPLE DATA — prices, scores, projects and scenarios are illustrative, not official market or planning data.',
    dataUpdated: data.DATA_UPDATED,
    vndPerUsd: data.VND_PER_USD,
    horizons: data.PLANNING_HORIZONS,
    stats: { districts: data.DISTRICTS.length, projects: data.PROJECTS.length, horizon: Math.max(...data.PLANNING_HORIZONS) },
    featured: {
      slug: featured.slug,
      name: featured.name,
      growthScore: featured.growthScore,
      center: featured.center,
      criteria: featured.criteria.filter((c) => ['connectivity', 'pricePotential', 'risk'].includes(c.key)),
      topUplift: featured.infraImpacts[0],
    },
    defaultQuestion: 'Is Gia Lâm a good area to buy property for the next 5 years?',
  };
}

module.exports = {
  CITY,
  TOD_RADIUS_M,
  findDistrict,
  findProject,
  listDistricts,
  getDistrict,
  listProjects,
  getProject,
  projectPois,
  search,
  overview,
};
