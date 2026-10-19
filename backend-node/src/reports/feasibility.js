'use strict';
/**
 * Feasibility calculator of the Business Opportunity Map, server side (for paid reports, which the server computes
 * and freezes). Same formulas as frontend/src/app/opportunity/op-feasibility.ts — change both together;
 * test/reports.test.js checks the two agree on the defaults.
 */

const base = { daysOpen: 30, rentPerM2: 350_000, depositMonths: 3, budget: 500_000_000, rampMonths: 6, rampStartPct: 50 };

const DEFAULT_ASSUMPTIONS = {
  cafe: { ...base, basis: 'day', customers: 120, ticket: 45_000, sizeM2: 60, cogsPct: 30, staff: 4, salary: 9_000_000, utilitiesPerM2: 115_000, otherPct: 4.3, setupPerM2: 5_400_000 },
  fnb: { ...base, basis: 'day', customers: 150, ticket: 120_000, sizeM2: 110, cogsPct: 34, staff: 8, salary: 8_500_000, utilitiesPerM2: 140_000, otherPct: 5.5, setupPerM2: 4_800_000 },
  gym: { ...base, basis: 'month', customers: 300, ticket: 600_000, sizeM2: 200, cogsPct: 8, staff: 6, salary: 10_000_000, utilitiesPerM2: 95_000, otherPct: 8, setupPerM2: 2_600_000 },
  education: { ...base, basis: 'month', customers: 60, ticket: 2_500_000, sizeM2: 150, cogsPct: 15, staff: 6, salary: 10_000_000, utilitiesPerM2: 60_000, otherPct: 8, setupPerM2: 4_000_000 },
  convenience: { ...base, basis: 'day', customers: 250, ticket: 60_000, sizeM2: 60, cogsPct: 66, staff: 5, salary: 7_500_000, utilitiesPerM2: 130_000, otherPct: 3.2, setupPerM2: 4_400_000 },
  beauty: { ...base, basis: 'day', customers: 25, ticket: 250_000, sizeM2: 60, cogsPct: 20, staff: 4, salary: 8_000_000, utilitiesPerM2: 100_000, otherPct: 6, setupPerM2: 5_000_000 },
  pharmacy: { ...base, basis: 'day', customers: 80, ticket: 120_000, sizeM2: 40, cogsPct: 62, staff: 3, salary: 9_500_000, utilitiesPerM2: 90_000, otherPct: 3.5, setupPerM2: 6_500_000 },
  petshop: { ...base, basis: 'day', customers: 30, ticket: 250_000, sizeM2: 60, cogsPct: 50, staff: 3, salary: 8_000_000, utilitiesPerM2: 90_000, otherPct: 5, setupPerM2: 4_000_000 },
  realestate: { ...base, basis: 'month', customers: 3, ticket: 30_000_000, sizeM2: 40, cogsPct: 0, staff: 4, salary: 8_000_000, utilitiesPerM2: 60_000, otherPct: 15, setupPerM2: 3_000_000 },
  laundry: { ...base, basis: 'day', customers: 40, ticket: 60_000, sizeM2: 40, cogsPct: 25, staff: 2, salary: 7_000_000, utilitiesPerM2: 150_000, otherPct: 5, setupPerM2: 6_000_000 },
  bookstore: { ...base, basis: 'day', customers: 60, ticket: 120_000, sizeM2: 80, cogsPct: 60, staff: 3, salary: 7_500_000, utilitiesPerM2: 80_000, otherPct: 4, setupPerM2: 3_500_000 },
  carwash: { ...base, basis: 'day', customers: 40, ticket: 80_000, sizeM2: 100, cogsPct: 15, staff: 4, salary: 8_000_000, utilitiesPerM2: 60_000, otherPct: 5, setupPerM2: 3_000_000 },
};

const defaultsFor = (type) => ({ ...(DEFAULT_ASSUMPTIONS[type] ?? DEFAULT_ASSUMPTIONS.cafe) });

const HORIZON_MONTHS = 36;

/** Sales level of month m (1-based): linear from rampStartPct to 100 % over rampMonths. */
const rampLevel = (a, m) => (a.rampMonths > 0 ? Math.min(1, a.rampStartPct / 100 + ((1 - a.rampStartPct / 100) * (m - 1)) / a.rampMonths) : 1);

/** Monthly profit and loss at full sales, investment, and the cash curve with the ramp-up (all VND). */
function computeFeasibility(a) {
  const visits = a.basis === 'day' ? a.customers * a.daysOpen : a.customers;
  const revenue = visits * a.ticket;
  const rent = a.rentPerM2 * a.sizeM2;
  const staff = a.staff * a.salary;
  const utilities = a.utilitiesPerM2 * a.sizeM2;
  const cogs = (revenue * a.cogsPct) / 100;
  const other = (revenue * a.otherPct) / 100;
  const total = rent + staff + utilities + cogs + other;
  const profit = revenue - total;
  const investment = a.setupPerM2 * a.sizeM2 + rent * a.depositMonths;
  const contribution = a.ticket * (1 - (a.cogsPct + a.otherPct) / 100);
  const fixed = rent + staff + utilities;
  const perPeriod = contribution > 0 ? fixed / contribution : null;
  const variableShare = (a.cogsPct + a.otherPct) / 100;
  const cumulative = [];
  let cash = -(a.setupPerM2 * a.sizeM2 + rent * a.depositMonths);
  let payback = null;
  for (let m = 1; m <= HORIZON_MONTHS; m++) {
    const sales = revenue * rampLevel(a, m);
    cash += sales * (1 - variableShare) - fixed;
    cumulative.push(cash);
    if (payback === null && cash >= 0) payback = m;
  }
  return {
    revenue,
    costs: { rent, staff, cogs, utilities, other, total },
    profit,
    marginPct: revenue > 0 ? (profit / revenue) * 100 : 0,
    investment,
    paybackMonths: profit > 0 ? payback : null,
    cumulative,
    breakEvenCustomers: perPeriod === null ? null : Math.ceil(a.basis === 'day' ? perPeriod / Math.max(1, a.daysOpen) : perPeriod),
    budgetGap: a.budget - investment,
  };
}

/** Month by month: sales level, sales, variable and fixed costs, cash of the month and cumulative cash (report table). */
function monthlyCashFlow(a) {
  const r = computeFeasibility(a);
  const fixed = r.costs.rent + r.costs.staff + r.costs.utilities;
  const variableShare = (a.cogsPct + a.otherPct) / 100;
  return r.cumulative.map((cumulative, i) => {
    const level = rampLevel(a, i + 1);
    const sales = r.revenue * level;
    const variable = sales * variableShare;
    return { month: i + 1, levelPct: level * 100, sales, variable, fixed, cash: sales - variable - fixed, cumulative };
  });
}

/** Points: over budget +2; no payback +2 (after 18 months +1); margin < 10 % +2 (< 20 % +1); competition 66+ +1. */
function riskOf(r, fits, competition) {
  const found = [];
  if (!fits) found.push(['budget', 2]);
  if (r.paybackMonths === null) found.push(['noPayback', 2]);
  else if (r.paybackMonths > 18) found.push(['slowPayback', 1]);
  if (r.marginPct < 10) found.push(['thinMargin', 2]);
  else if (r.marginPct < 20) found.push(['lowMargin', 1]);
  if ((competition ?? 0) >= 66) found.push(['crowded', 1]);
  const points = found.reduce((sum, [, p]) => sum + p, 0);
  return { level: points >= 4 ? 'high' : points >= 2 ? 'medium' : 'low', reasons: found.map(([reason]) => reason) };
}

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const median = (values) => {
  const v = [...values].sort((a, b) => a - b);
  return v.length ? v[Math.floor(v.length / 2)] : 0;
};

/**
 * The plan across wards: customers scaled by the ward's opportunity score against the median ward (×0.6–1.4), rent by
 * its official land price against the city median (×0.5–2.5) when `adjust`. Wards that fit the budget first, then by profit.
 */
function planWards(wards, a, landCityMedian, adjust) {
  const medScore = median(wards.map((w) => w.score)) || 1;
  return wards
    .map((w) => {
      const factors = adjust
        ? {
            customers: clamp(w.score / medScore, 0.6, 1.4),
            rent: w.landMedian && landCityMedian ? clamp(w.landMedian / landCityMedian, 0.5, 2.5) : 1,
          }
        : { customers: 1, rent: 1 };
      const result = computeFeasibility({ ...a, customers: Math.round(a.customers * factors.customers), rentPerM2: Math.round(a.rentPerM2 * factors.rent) });
      const fits = result.investment <= a.budget;
      return { ...w, factors, result, fits, risk: riskOf(result, fits, w.competition) };
    })
    .sort((x, y) => Number(y.fits) - Number(x.fits) || y.result.profit - x.result.profit);
}

module.exports = { DEFAULT_ASSUMPTIONS, defaultsFor, HORIZON_MONTHS, computeFeasibility, monthlyCashFlow, riskOf, planWards };
