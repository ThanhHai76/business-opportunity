'use strict';
/**
 * Hanoi Business Opportunity Report. Returned as structured sections so the same payload can later
 * feed a PDF renderer (the frontend renders it and uses the browser's print-to-PDF today).
 */
const { LOCATION_BY_SLUG } = require('./data');
const { rank, locationDetail } = require('./scoring');
const { explainWithFallback } = require('./ai-provider');

async function buildReport(providers, { category, budgetVnd, location }) {
  const ranking = rank(category, budgetVnd);
  const slug = location ?? ranking[0].slug;
  const detail = locationDetail(LOCATION_BY_SLUG.get(slug), category, budgetVnd);
  const alternatives = ranking.filter((r) => r.slug !== slug).slice(0, 3);

  const { narrative, provider, model } = await explainWithFallback(providers, {
    task: 'location',
    facts: {
      name: detail.name,
      categoryVi: category.nameVi,
      totalScore: detail.totalScore,
      scores: detail.scores,
      competitionLabel: detail.competitionLabel,
      evidence: detail.evidence,
      risks: detail.risks,
      recommendation: detail.recommendation,
      revenuePotentialMillions: detail.revenuePotentialMillions,
      breakEvenMonth: detail.breakEvenMonth,
    },
  });

  return {
    title: 'HANOI BUSINESS OPPORTUNITY REPORT',
    generatedAt: new Date().toISOString(),
    business: { key: category.key, name: category.name, nameVi: category.nameVi },
    budgetMillions: budgetVnd / 1e6,
    recommendedLocation: { slug: detail.slug, name: detail.name, cluster: detail.cluster },
    businessScore: detail.totalScore,
    provider,
    model,
    sections: {
      executiveSummary: { summary: narrative.summary, recommendation: narrative.recommendation },
      marketDemand: {
        demandScore: detail.scores.demand,
        trafficScore: detail.scores.traffic,
        customerDensityKPerKm2: detail.customerDensityKPerKm2,
        peak: detail.footTraffic.peak,
        weekendChangePct: detail.footTraffic.weekendChangePct,
        evidence: detail.evidence,
      },
      competition: {
        label: detail.competitionLabel,
        score: detail.scores.competition,
        total: detail.competitors.total,
        subtypes: detail.competitors.subtypes,
        gap: detail.competitorGap,
      },
      estimatedCosts: {
        initialInvestment: detail.initialInvestment,
        monthlyCosts: detail.monthlyCosts,
        revenuePotentialMillions: detail.revenuePotentialMillions,
        netMarginPct: detail.netMarginPct,
        breakEvenMonth: detail.breakEvenMonth,
      },
      customerProfile: detail.targetCustomers,
      locationAnalysis: { scores: detail.scores, attributes: detail.attributes, alternatives },
      growthPotential: { growthScore: detail.scores.growth, opportunities: detail.growthOpportunities },
      risks: detail.risks,
      aiRecommendation: { recommendation: narrative.recommendation, nextActions: narrative.nextActions },
    },
    demo: true,
  };
}

module.exports = { buildReport };
