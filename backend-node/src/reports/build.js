'use strict';
/**
 * Builds the content of a paid feasibility report: the ward's opportunity score for a business type, the user's
 * plan month by month, what-if scenarios, and the best other wards for the same plan. Everything is computed here and
 * stored with the report, so it reads the same however the data changes later.
 */
const { wardDetail, wardsGeoJson } = require('../opportunity');
const LAND = require('../property-intel/data/land-price.json');
const { badRequest } = require('../accounts/errors');
const { HORIZON_MONTHS, computeFeasibility, defaultsFor, monthlyCashFlow, planWards, riskOf } = require('./feasibility');

const REPORT_VERSION = 1;
const ALTERNATIVES = 5;

/** What-if scenarios on the user's own plan. */
const SCENARIOS = [
  { key: 'customersDown', label: 'Khách ít hơn 20%', apply: (a) => ({ ...a, customers: Math.round(a.customers * 0.8) }) },
  { key: 'customersUp', label: 'Khách nhiều hơn 20%', apply: (a) => ({ ...a, customers: Math.round(a.customers * 1.2) }) },
  { key: 'ticketDown', label: 'Chi tiêu mỗi khách giảm 10%', apply: (a) => ({ ...a, ticket: Math.round(a.ticket * 0.9) }) },
  { key: 'rentUp', label: 'Giá thuê tăng 20%', apply: (a) => ({ ...a, rentPerM2: Math.round(a.rentPerM2 * 1.2) }) },
];

const summary = (r) => ({ revenue: r.revenue, profit: r.profit, marginPct: r.marginPct, investment: r.investment, paybackMonths: r.paybackMonths });
const sameAssumptions = (a, b) => Object.keys(b).every((k) => a[k] === b[k]);

/**
 * @param input { type, ward, horizon, assumptions } (validated by the router)
 * @throws AccountError 400 when the ward has no score for the type (nothing is charged then)
 */
function buildFeasibilityReport({ type, ward, horizon, assumptions }, now = new Date()) {
  let detail;
  try {
    detail = wardDetail(ward, horizon, 'vi');
  } catch {
    throw badRequest('Không tìm thấy phường/xã này.', 'unknown_ward');
  }
  const opp = detail.opportunities.find((o) => o.type === type);
  if (!detail.scored || !opp) throw badRequest('Phường/xã này chưa đủ dữ liệu để chấm điểm ngành này.', 'not_scored');

  const geo = wardsGeoJson(type, horizon, 'vi');
  const props = geo.features.find((f) => f.properties.slug === ward).properties;

  const a = { ...assumptions };
  const feasibility = computeFeasibility(a);
  const fits = feasibility.investment <= a.budget;

  const scored = geo.features
    .map((f) => f.properties)
    .filter((p) => p.scored && p.score !== null)
    .map((p) => ({ slug: p.slug, name: p.name, score: p.score, landMedian: p.landMedian ?? null, competition: p.competition ?? null }));
  const plan = planWards(scored, a, geo.meta.landCityMedian, true);
  const here = plan.findIndex((p) => p.slug === ward);
  const row = (p) => ({ slug: p.slug, name: p.name, score: p.score, factors: p.factors, fits: p.fits, risk: p.risk.level, ...summary(p.result) });

  return {
    version: REPORT_VERSION,
    generatedAt: now.toISOString(),
    lang: 'vi',
    horizon,
    horizonMonths: HORIZON_MONTHS,
    type: { key: type, name: geo.meta.type.name, icon: geo.meta.type.icon },
    ward: {
      slug: ward,
      name: detail.name,
      population: detail.facts.population,
      areaKm2: detail.facts.areaKm2,
      metroStations: detail.facts.metroStations,
      landMedian: props.landMedian ?? null,
      landCityMedian: geo.meta.landCityMedian,
    },
    score: {
      opportunity: opp.opportunity,
      demand: opp.demand,
      competition: opp.competition,
      count: opp.count,
      per10k: opp.per10k,
      confidence: opp.confidence,
      rank: props.rank,
      of: geo.meta.scoredWards,
      drivers: opp.drivers,
    },
    assumptions: a,
    assumptionsAreDefault: sameAssumptions(a, defaultsFor(type)),
    feasibility,
    fits,
    risk: riskOf(feasibility, fits, opp.competition),
    monthly: monthlyCashFlow(a),
    sensitivity: SCENARIOS.map((s) => ({ key: s.key, label: s.label, ...summary(computeFeasibility(s.apply(a))) })),
    plan: {
      rank: here + 1,
      of: plan.length,
      here: here >= 0 ? row(plan[here]) : null,
      alternatives: plan.filter((p) => p.slug !== ward).slice(0, ALTERNATIVES).map(row),
    },
    method: detail.method,
    caveat: detail.caveat,
    dataDate: geo.meta.osmDate,
    sources: [...detail.sources, { id: 'land', title: LAND.source, publisher: 'HĐND TP Hà Nội', url: LAND.workbook }],
  };
}

const reportTitle = (c) => `${c.type.name} · ${c.ward.name} · ${c.horizon === '2030' ? 'mốc 2030' : 'hiện tại'}`;

module.exports = { buildFeasibilityReport, reportTitle, REPORT_VERSION, SCENARIOS };
