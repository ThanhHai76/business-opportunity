'use strict';
/**
 * "Ask Property AI" — a rule-based analyst. It reads the question, works out the intent
 * (analyze / compare / price / future / report / project) and the districts or project it is
 * about, then assembles an answer purely from the SAMPLE DATA via the engine. No LLM involved:
 * every sentence is a template filled with engine numbers, so the answer is reproducible.
 */
const { normalizeText } = require('../living-score/common/text');
const data = require('./data');
const engine = require('./engine');

const INTENTS = ['analyze', 'compare', 'price', 'future', 'report', 'project'];
const DEFAULT_DISTRICT = 'gia-lam';

const KEYWORDS = {
  compare: ['compare', 'versus', ' vs ', 'so sanh', 'better than', 'which is better'],
  // No bare "gia": it is also the first word of "Gia Lâm".
  price: ['price', 'cost', 'gia ban', 'gia nha', 'muc gia', 'tr m2', 'expensive', 'cheap', 'valuation', 'value'],
  future: ['future', 'scenario', 'forecast', '2030', '2045', 'tuong lai', 'kich ban', 'long term', 'plan'],
  report: ['report', 'bao cao', 'summary', 'tom tat', 'memo'],
};

const OUTLOOK_TONE = { Positive: 'good', Neutral: 'neutral', Cautious: 'bad' };
const fmtInt = (n) => new Intl.NumberFormat('en-US').format(n);
const pct = (n) => `${n > 0 ? '+' : ''}${n}%`;

function mentionedDistricts(text) {
  const padded = ` ${text} `;
  return data.DISTRICTS.filter((d) => padded.includes(` ${normalizeText(d.name)} `)).map((d) => d.slug);
}

function mentionedProject(text) {
  return data.PROJECTS.find((p) => text.includes(normalizeText(p.name)))?.slug ?? null;
}

function detectIntent(text, districts, project) {
  const padded = ` ${text} `;
  if (districts.length >= 2 || KEYWORDS.compare.some((k) => padded.includes(k))) return 'compare';
  if (project) return 'project';
  for (const intent of ['report', 'future', 'price']) {
    if (KEYWORDS[intent].some((k) => padded.includes(k))) return intent;
  }
  return 'analyze';
}

function scenarioList(d) {
  const s = d.insight.scenarios;
  return [
    { key: 'bear', label: 'Bear', ...s.bear },
    { key: 'base', label: 'Base', ...s.base },
    { key: 'bull', label: 'Bull', ...s.bull },
  ];
}

function analyze(slug) {
  const raw = engine.findDistrict(slug);
  const d = engine.getDistrict(slug);
  const i = raw.insight;
  return {
    outlook: { label: i.outlook, tone: OUTLOOK_TONE[i.outlook] },
    summary: i.summary,
    rows: [
      { label: 'Growth drivers', tone: 'growth', text: i.drivers },
      { label: 'Infrastructure', tone: 'mobility', text: i.infrastructure },
      { label: 'Planning', tone: 'planning', text: i.planning },
      {
        label: 'Demand',
        tone: 'growth',
        text: `${i.demand}; absorption ${d.metrics.absorption}%, ${d.metrics.absorption >= d.metrics.cityAbsorption ? 'above' : 'below'} city avg ${d.metrics.cityAbsorption}%`,
      },
      { label: 'Risks', tone: 'risk', text: i.risks },
    ],
    scenarios: scenarioList(raw),
    callout: { title: 'Recommended strategy', text: i.strategy },
  };
}

function compare(slugs) {
  const list = slugs.map((s) => engine.getDistrict(s));
  const best = [...list].sort((a, b) => b.growthScore - a.growthScore || a.risk - b.risk)[0];
  const safest = [...list].sort((a, b) => a.risk - b.risk)[0];
  const cheapest = [...list].sort((a, b) => a.pricePerM2 - b.pricePerM2)[0];
  const names = list.map((d) => d.name).join(', ');
  const summary =
    best.slug === safest.slug
      ? `${best.name} leads on both growth (${best.growthScore}) and risk (${best.risk}) among ${names}.`
      : `${best.name} has the strongest growth score (${best.growthScore}); ${safest.name} is the lower-risk pick (risk ${safest.risk}).`;
  return {
    outlook: { label: `Top pick: ${best.name}`, tone: 'good' },
    summary,
    table: {
      columns: ['District', 'Score', 'tr/m²', 'YoY', 'Absorp.', 'Risk'],
      rows: list.map((d) => [d.name, String(d.growthScore), String(d.pricePerM2), pct(d.yoy), `${d.metrics.absorption}%`, String(d.risk)]),
      highlight: list.indexOf(best),
    },
    rows: [
      { label: 'Best growth', tone: 'growth', text: `${best.name} · rank #${best.rank} of ${best.total}` },
      { label: 'Lowest risk', tone: 'mobility', text: `${safest.name} · risk ${safest.risk}/100` },
      { label: 'Cheapest entry', tone: 'planning', text: `${cheapest.name} · ${cheapest.pricePerM2} tr/m²` },
    ],
    callout: {
      title: 'Which to pick',
      text: `For a 5-year growth play choose ${best.name}; for income and stability choose ${safest.name}.`,
    },
  };
}

function price(slug) {
  const raw = engine.findDistrict(slug);
  const d = engine.getDistrict(slug);
  const all = engine.listDistricts().sort((a, b) => b.pricePerM2 - a.pricePerM2);
  const priceRank = all.findIndex((x) => x.slug === slug) + 1;
  const projectPrices = d.projects.map((p) => p.pricePerM2);
  const topUplift = [...d.infraImpacts].sort((a, b) => b.uplift - a.uplift)[0];
  const base = raw.insight.scenarios.base;
  const cityChange = Math.round((d.priceTrend.city.at(-1) / d.priceTrend.city[0] - 1) * 100);
  const rows = [
    { label: 'Current', tone: 'growth', text: `${d.pricePerM2} tr/m², ${pct(d.yoy)} YoY · #${priceRank} most expensive of ${d.total}` },
    { label: '6-year change', tone: 'growth', text: `${pct(d.priceTrend.change6y)} since 2020 vs ${pct(cityChange)} city average` },
    { label: 'Biggest driver', tone: 'mobility', text: `${topUplift.name}: est. +${topUplift.uplift}% uplift nearby` },
    { label: 'Rental yield', tone: 'planning', text: `${d.metrics.rentalYield}% gross vs city avg ${d.metrics.cityRentalYield}%` },
  ];
  if (projectPrices.length) {
    const lo = Math.min(...projectPrices);
    const hi = Math.max(...projectPrices);
    rows.push({
      label: 'Projects',
      tone: 'planning',
      text: `${projectPrices.length} tracked, ${lo === hi ? lo : `${lo}–${hi}`} tr/m²`,
    });
  }
  return {
    outlook: { label: d.yoy >= 10 ? 'Momentum: strong' : d.yoy >= 7 ? 'Momentum: steady' : 'Momentum: slow', tone: d.yoy >= 10 ? 'good' : d.yoy >= 7 ? 'neutral' : 'bad' },
    summary: `${d.name} trades at ${d.pricePerM2} tr/m² after ${pct(d.yoy)} over the last year. Base case adds ${pct(base.change)} over 5 years (${base.note.toLowerCase()}).`,
    rows,
    scenarios: scenarioList(raw),
    callout: { title: 'Price view', text: raw.insight.strategy },
  };
}

function future(slug) {
  const raw = engine.findDistrict(slug);
  const d = engine.getDistrict(slug);
  const byYear = (to) =>
    d.timeline.items
      .filter((t) => t.end <= to && t.end > (to === 2027 ? 0 : to === 2030 ? 2027 : 2030))
      .map((t) => `${t.name} (${t.end})`);
  const zones = (from) => data.PLANNING_ZONES.filter((z) => z.district === slug && z.from === from).map((z) => z.name);
  const rows = [
    { label: 'By 2027', tone: 'planning', list: [...byYear(2027), ...zones(2026)] },
    { label: 'By 2030', tone: 'mobility', list: [...byYear(2030), ...zones(2030)] },
    { label: 'By 2045', tone: 'growth', list: [...byYear(2045), ...zones(2045)] },
  ]
    .filter((r) => r.list.length)
    .map((r) => ({ label: r.label, tone: r.tone, text: r.list.join('; ') }));
  rows.push({ label: 'Population', tone: 'growth', text: `${d.population.now}k today → ${d.population.points[2].value}k by 2030 (${d.population.cagr}% CAGR so far)` });
  return {
    outlook: { label: `Outlook: ${raw.insight.outlook}`, tone: OUTLOOK_TONE[raw.insight.outlook] },
    summary: `Three 5-year scenarios for ${d.name}, weighted by how likely the committed infrastructure is to arrive on time.`,
    rows,
    scenarios: scenarioList(raw),
    callout: { title: 'What would change the view', text: raw.insight.risks },
  };
}

function report(slug) {
  const raw = engine.findDistrict(slug);
  const d = engine.getDistrict(slug);
  const top = d.criteria.filter((c) => c.key !== 'risk').sort((a, b) => b.value - a.value).slice(0, 2);
  return {
    outlook: { label: `Score ${d.growthScore} · #${d.rank}`, tone: OUTLOOK_TONE[raw.insight.outlook] },
    summary: `Investment brief for ${d.name}: ${raw.insight.summary}`,
    rows: [
      { label: 'Strengths', tone: 'growth', text: top.map((c) => `${c.label} ${c.value}`).join(', ') },
      { label: 'Market', tone: 'planning', text: `${d.pricePerM2} tr/m² (${pct(d.yoy)} YoY), absorption ${d.metrics.absorption}%` },
      { label: 'Supply', tone: 'planning', text: `${fmtInt(d.metrics.pipelineUnits)} units in ${d.metrics.pipelineProjects} projects` },
      { label: 'Income', tone: 'mobility', text: `Rental yield ${d.metrics.rentalYield}% (city ${d.metrics.cityRentalYield}%)` },
      { label: 'Risks', tone: 'risk', text: `Risk ${d.risk}/100 — ${raw.insight.risks}` },
    ],
    scenarios: scenarioList(raw),
    callout: { title: 'Recommended strategy', text: raw.insight.strategy },
  };
}

function project(slug) {
  const p = engine.getProject(slug);
  const base5y = Math.round(p.estimate.value * (1 + p.baseScenario.change / 100) * 100) / 100;
  return {
    outlook: {
      label: p.riskScore <= 30 ? 'Risk: low' : p.riskScore <= 45 ? 'Risk: medium' : 'Risk: elevated',
      tone: p.riskScore <= 30 ? 'good' : p.riskScore <= 45 ? 'neutral' : 'bad',
    },
    summary: `${p.name} (${p.districtName}) is priced at ${p.pricePerM2} tr/m², ${pct(p.vsDistrict)} vs the district. A typical ${p.typical.m2} m² unit is about ${p.estimate.value} tỷ.`,
    rows: [
      { label: 'Location', tone: 'mobility', text: `${p.station.distanceM} m to ${p.station.name} (${p.station.line})` },
      { label: 'Development', tone: 'growth', text: `Score ${p.devScore} · ${p.devNote}` },
      { label: 'Sales', tone: 'planning', text: `${p.soldPct}% sold · handover ${p.handover}` },
      { label: 'Base case', tone: 'growth', text: `~${base5y} tỷ in 5 years (${p.baseScenario.note.toLowerCase()})` },
      { label: 'Risks', tone: 'risk', text: `Risk ${p.riskScore}/100 · ${p.riskNote}` },
    ],
    callout: { title: 'AI take', text: p.aiTake },
  };
}

const FOLLOW_UPS = {
  analyze: ['Compare Areas', 'Price Analysis', 'Future Scenario'],
  compare: ['Analyze Area', 'Price Analysis'],
  price: ['Future Scenario', 'Investment Report'],
  future: ['Price Analysis', 'Investment Report'],
  report: ['Compare Areas', 'Future Scenario'],
  project: ['Analyze Area', 'Price Analysis'],
};

/**
 * @param {{ question: string, intent?: string, district?: string, project?: string }} input
 */
function answer(input) {
  const text = normalizeText(input.question);
  const districts = mentionedDistricts(text);
  const projectSlug = mentionedProject(text) ?? (input.intent === 'project' ? input.project ?? null : null);
  const intent = input.intent ?? detectIntent(text, districts, projectSlug);
  const focus = districts[0] ?? input.district ?? (projectSlug ? engine.findProject(projectSlug).district : DEFAULT_DISTRICT);
  engine.findDistrict(focus); // 404 for an unknown context district

  let body;
  switch (intent) {
    case 'compare': {
      const picked = [...new Set([focus, ...districts])];
      if (picked.length < 2) {
        const others = engine.listDistricts().filter((d) => d.slug !== focus).slice(0, 2).map((d) => d.slug);
        picked.push(...others);
      }
      body = compare(picked.slice(0, 4));
      break;
    }
    case 'price':
      body = price(focus);
      break;
    case 'future':
      body = future(focus);
      break;
    case 'report':
      body = report(focus);
      break;
    case 'project':
      body = projectSlug ? project(projectSlug) : analyze(focus);
      break;
    default:
      body = analyze(focus);
  }

  const d = engine.findDistrict(focus);
  return {
    question: input.question,
    intent: intent === 'project' && !projectSlug ? 'analyze' : intent,
    engine: 'rule-based',
    sampleData: true,
    district: { slug: d.slug, name: d.name },
    project: projectSlug ? { slug: projectSlug, name: engine.findProject(projectSlug).name } : null,
    ...body,
    followUps: FOLLOW_UPS[intent] ?? FOLLOW_UPS.analyze,
  };
}

module.exports = { INTENTS, answer };
