'use strict';
/**
 * Business simulator: the user's own assumptions (budget, expected revenue, max rent, size...) applied to
 * every candidate district. All outputs are SIMULATED ESTIMATES built on demo data.
 */
const { LOCATIONS } = require('./data');
const { computeScore, toMillions, rentFor } = require('./scoring');

const round1 = (n) => Math.round(n * 10) / 10;

function riskLevel({ withinBudget, breakEvenMonth, marginPct, competitionLabel }) {
  let points = 0;
  if (!withinBudget) points += 2;
  if (breakEvenMonth === null) points += 2;
  else if (breakEvenMonth > 15) points += 1;
  if (marginPct < 10) points += 2;
  else if (marginPct < 20) points += 1;
  if (competitionLabel === 'High') points += 1;
  return points >= 4 ? 'High' : points >= 2 ? 'Medium' : 'Low';
}

/**
 * @param input { category, budgetVnd, targetCustomers, expectedRevenueVnd?, maxRentVnd?, sizeM2?, districts[] }
 */
function simulate(input) {
  const { category, budgetVnd } = input;
  const sizeM2 = input.sizeM2 ?? category.avgSizeM2;
  const sizeFactor = sizeM2 / category.avgSizeM2;
  const candidates = input.districts?.length ? LOCATIONS.filter((l) => input.districts.includes(l.slug)) : LOCATIONS;

  const results = candidates.map((location) => {
    const s = computeScore(location, category, budgetVnd);
    const rent = rentFor(location, category, sizeM2);
    const engineRevenue = s.revenuePotentialMillions * 1_000_000 * Math.sqrt(sizeFactor);
    // The user's expectation is blended with the engine's estimate so an optimistic guess cannot dominate.
    const revenue = input.expectedRevenueVnd ? engineRevenue * 0.5 + input.expectedRevenueVnd * 0.5 : engineRevenue;
    const m = category.costModel;
    const variable = revenue * (m.cogsRatio + m.marketingPct + m.otherPct);
    const fixed = rent + m.staffFte * Math.max(1, Math.round(sizeFactor)) * m.staffSalaryVnd + m.utilitiesPerM2Vnd * sizeM2;
    const cost = variable + fixed;
    const profit = revenue - cost;
    const setup = category.setupCostPerM2Vnd * sizeM2 + rent * 3 + Math.max(10_000_000, cost * 0.1);
    let cumulative = -setup;
    let breakEvenMonth = null;
    for (let month = 1; month <= 36 && breakEvenMonth === null; month++) {
      const ramp = Math.min(1, 0.42 + 0.58 * (month / 9));
      const monthRevenue = revenue * ramp;
      cumulative += monthRevenue - (monthRevenue * (m.cogsRatio + m.marketingPct + m.otherPct) + fixed);
      if (cumulative >= 0) breakEvenMonth = month;
    }
    const marginPct = revenue > 0 ? Math.round((profit / revenue) * 100) : 0;
    const withinBudget = setup <= budgetVnd;
    const rentOk = !input.maxRentVnd || rent <= input.maxRentVnd;
    return {
      slug: location.slug,
      name: location.name,
      businessScore: s.totalScore,
      rentMillions: toMillions(rent),
      revenueMillions: toMillions(revenue),
      costMillions: toMillions(cost),
      profitMillions: toMillions(profit),
      marginPct,
      initialInvestmentMillions: toMillions(setup),
      breakEvenMonth,
      withinBudget,
      rentOk,
      riskLevel: riskLevel({ withinBudget, breakEvenMonth, marginPct, competitionLabel: s.competitionLabel }),
      competitionLabel: s.competitionLabel,
    };
  });

  const eligible = results.filter((r) => r.rentOk);
  const order = (a, b) =>
    Number(b.withinBudget) - Number(a.withinBudget) || b.profitMillions - a.profitMillions || b.businessScore - a.businessScore;
  eligible.sort(order);
  const excluded = results.filter((r) => !r.rentOk).map((r) => ({ slug: r.slug, name: r.name, rentMillions: r.rentMillions }));

  const best = eligible[0] ?? null;
  return {
    category: { key: category.key, name: category.name, nameVi: category.nameVi },
    inputs: {
      budgetMillions: toMillions(budgetVnd),
      sizeM2,
      targetCustomers: input.targetCustomers ?? [],
      expectedRevenueMillions: input.expectedRevenueVnd ? toMillions(input.expectedRevenueVnd) : null,
      maxRentMillions: input.maxRentVnd ? toMillions(input.maxRentVnd) : null,
      districts: input.districts ?? [],
    },
    results: eligible,
    excluded,
    summary: best
      ? {
          recommended: eligible.slice(0, 3).map((r) => r.slug),
          monthlyCostMillions: best.costMillions,
          monthlyRevenueMillions: best.revenueMillions,
          monthlyProfitMillions: best.profitMillions,
          breakEvenMonth: best.breakEvenMonth,
          riskLevel: best.riskLevel,
          initialInvestmentMillions: best.initialInvestmentMillions,
          paybackYears: best.breakEvenMonth ? round1(best.breakEvenMonth / 12) : null,
        }
      : null,
  };
}

module.exports = { simulate };
