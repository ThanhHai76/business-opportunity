'use strict';
/**
 * Business Score engine for the Hanoi Business Copilot. Every number it produces is a DEMO ESTIMATE
 * derived from the demo attributes in data.js — deterministic, explainable, and never presented as
 * real market data. The AI layer only rewords what is computed here.
 */
const { badRequest, notFound } = require('../living-score/common/http');
const { CATEGORIES, LOCATIONS, CATEGORY_BY_KEY, LOCATION_BY_SLUG } = require('./data');
const { seededRandom } = require('./prng');

const clamp = (n, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, n));
const round = (n) => Math.round(n);
const round1 = (n) => Math.round(n * 10) / 10;
const toMillions = (vnd) => round1(vnd / 1_000_000);

/** Weights of the composite Business Score (sum = 1). */
const SCORE_WEIGHTS = { demand: 0.26, competition: 0.16, rent: 0.14, traffic: 0.14, accessibility: 0.1, growth: 0.1, budgetFit: 0.1 };

const DEFAULT_BUDGET_VND = 500_000_000;
const MIN_BUDGET_VND = 50_000_000;
const MAX_BUDGET_VND = 50_000_000_000;

// ------------------------------------------------------------------ validation helpers
function requireCategory(key) {
  const category = CATEGORY_BY_KEY.get(key ?? 'coffee-shop');
  if (!category) throw badRequest(`category phải thuộc: ${CATEGORIES.map((c) => c.key).join(', ')}.`);
  return category;
}

function requireLocation(slug) {
  const location = LOCATION_BY_SLUG.get(slug);
  if (!location) throw notFound(`Không tìm thấy khu vực "${slug}".`);
  return location;
}

function requireBudget(value) {
  if (value === undefined || value === null || value === '') return DEFAULT_BUDGET_VND;
  const budget = Number(value);
  if (!Number.isFinite(budget) || budget < MIN_BUDGET_VND || budget > MAX_BUDGET_VND) {
    throw badRequest(`budget phải là số VND từ ${MIN_BUDGET_VND.toLocaleString('vi-VN')} đến ${MAX_BUDGET_VND.toLocaleString('vi-VN')}.`);
  }
  return Math.round(budget);
}

// ------------------------------------------------------------------ normalisation across the 10 areas
const ATTRS = {
  officeWorkers: (l) => l.officeWorkersK,
  students: (l) => l.studentsK,
  footTraffic: (l) => l.footTrafficIndex,
  income: (l) => l.incomeIndex,
  population: (l) => l.population,
  visitors: (l) => l.visitorIndex,
};
const RANGES = Object.fromEntries(
  Object.entries(ATTRS).map(([key, pick]) => {
    const values = LOCATIONS.map(pick);
    return [key, { min: Math.min(...values), max: Math.max(...values) }];
  }),
);
const norm = (key, location) => {
  const { min, max } = RANGES[key];
  return max === min ? 50 : ((ATTRS[key](location) - min) / (max - min)) * 100;
};

// ------------------------------------------------------------------ competitors
/** Demo competitor counts per subtype, higher where demand (and so competition) is naturally higher. */
function competitorsFor(location, category) {
  const demandRaw = rawDemand(location, category);
  // Established commercial districts are more saturated than new suburban ones.
  const total = round((8 + demandRaw * 0.34) * (0.55 + 0.6 * location.marketMaturity) + seededRandom(`${location.slug}|${category.key}|total`) * 5);
  const shares = category.competitionSubtypes.map((s, i) => 0.6 + seededRandom(`${location.slug}|${category.key}|${s.key}`) * (i === 2 ? 1.2 : 0.8));
  const shareSum = shares.reduce((a, b) => a + b, 0);
  let assigned = 0;
  const subtypes = category.competitionSubtypes.map((s, i) => {
    const count = i === shares.length - 1 ? total - assigned : round((total * shares[i]) / shareSum);
    assigned += count;
    const perOutlet = 1.8 + seededRandom(`${location.slug}|${s.key}|reach`) * 7;
    return { key: s.key, label: s.label, count: Math.max(0, count), reachK: round(Math.max(0, count) * perOutlet) };
  });
  return { total, subtypes };
}

function rawDemand(location, category) {
  const w = category.demandWeights;
  const sum = Object.values(w).reduce((a, b) => a + b, 0);
  return Object.entries(w).reduce((acc, [key, weight]) => acc + weight * norm(key, location), 0) / sum;
}

function saturationLabel(ratio) {
  if (ratio < 0.34) return 'Low';
  if (ratio < 0.5) return 'Medium';
  return 'High';
}

// ------------------------------------------------------------------ money model
/** Monthly rent for the category's typical size (large formats such as gyms rent cheaper upper floors). */
function rentFor(location, category, sizeM2 = category.avgSizeM2) {
  return location.avgRentVndPerM2 * sizeM2 * (category.rentFactor ?? 1);
}

function costModel(location, category, revenueVnd) {
  const m = category.costModel;
  const rent = rentFor(location, category);
  const staff = m.staffFte * m.staffSalaryVnd;
  const cogs = revenueVnd * m.cogsRatio;
  const utilities = m.utilitiesPerM2Vnd * category.avgSizeM2;
  const marketing = revenueVnd * m.marketingPct;
  const other = revenueVnd * m.otherPct;
  return {
    rent,
    staff,
    cogs,
    utilities,
    marketing,
    other,
    total: rent + staff + cogs + utilities + marketing + other,
    staffFte: m.staffFte,
  };
}

function initialInvestment(location, category, monthlyCostVnd) {
  const setup = category.setupCostPerM2Vnd * category.avgSizeM2;
  const rent = rentFor(location, category);
  const fitOut = setup * 0.61;
  const equipment = setup * 0.39;
  const deposit = rent * 3;
  const workingCapital = Math.max(10_000_000, monthlyCostVnd * 0.1);
  return { fitOut, equipment, deposit, workingCapital, total: fitOut + equipment + deposit + workingCapital };
}

const RAMP_MONTHS = 9;
/** 18-month ramp-up: revenue climbs to maturity over RAMP_MONTHS; returns the series and the break-even month. */
function revenueSeries(location, category, maturityRevenueVnd, initialVnd) {
  const months = [];
  let cumulative = -initialVnd;
  let breakEvenMonth = null;
  for (let m = 1; m <= 18; m++) {
    const ramp = Math.min(1, 0.42 + 0.58 * (m / RAMP_MONTHS));
    const revenue = maturityRevenueVnd * ramp;
    const cost = costModel(location, category, revenue).total;
    cumulative += revenue - cost;
    if (breakEvenMonth === null && cumulative >= 0) breakEvenMonth = m;
    months.push({ month: m, revenue: toMillions(revenue), cost: toMillions(cost), cumulative: toMillions(cumulative), afterBreakEven: breakEvenMonth !== null });
  }
  return { months, breakEvenMonth };
}

// ------------------------------------------------------------------ the score
function computeScore(location, category, budgetVnd) {
  const demandRaw = rawDemand(location, category);
  const demand = clamp(round(46 + demandRaw * 0.5));

  const competitors = competitorsFor(location, category);
  const saturation = competitors.total / (demand * 1.05);
  const competitionLabel = saturationLabel(saturation);
  const competition = clamp(round(100 - saturation * 72));

  const traffic = clamp(round(location.footTrafficIndex * 0.9 + 11));
  const accessibility = clamp(round(location.metroAccessibility * 0.9 + 12));
  const growth = clamp(
    round(48 + (location.developmentZone ? 20 : 0) + (location.metroLines > 0 ? 10 : 0) + norm('population', location) * 0.08 + seededRandom(`${location.slug}|growth`) * 10),
  );

  const competitionFactor = 0.55 + 0.45 * (competition / 100);
  const dailyCustomers = category.dailyCustomersAtFull * (demand / 100) * competitionFactor;
  // Affluent areas sustain a higher average ticket (premium pricing).
  const ticketVnd = category.avgTicketVnd * (0.85 + (location.incomeIndex / 100) * 0.35);
  const revenueVnd = dailyCustomers * ticketVnd * 30;
  const costs = costModel(location, category, revenueVnd);
  const investment = initialInvestment(location, category, costs.total);
  const series = revenueSeries(location, category, revenueVnd, investment.total);

  const rentReference = budgetVnd * 0.08;
  const rent = clamp(round(100 - (costs.rent / rentReference) * 45), 15, 98);

  const investmentRatio = investment.total / budgetVnd;
  const investmentLevel = investmentRatio <= 0.7 ? 'Low' : investmentRatio <= 1 ? 'Medium' : 'High';
  const withinBudget = investmentRatio <= 1;
  const budgetFit = withinBudget ? clamp(round(100 - Math.max(0, investmentRatio - 0.6) * 60)) : clamp(round(75 - (investmentRatio - 1) * 90));

  const components = { demand, competition, rent, traffic, accessibility, growth, budgetFit };
  const weighted = Object.entries(SCORE_WEIGHTS).reduce((acc, [k, w]) => acc + w * components[k], 0);
  // Linear calibration: spreads the weighted mean (which clusters around 65-82) over the range users read (~70-92).
  const total = clamp(round(weighted * 1.25 - 10));

  const customerDensity = round1(
    (location.population + location.officeWorkersK * 1000 * 0.6 + location.studentsK * 1000 * 0.4) / location.areaKm2 / 1000,
  );
  const netMargin = revenueVnd > 0 ? round(((revenueVnd - costs.total) / revenueVnd) * 100) : 0;

  return {
    totalScore: total,
    scores: { demand, competition, rent, traffic, accessibility, growth, budgetFit },
    competitionLabel,
    competitors,
    customerDensityKPerKm2: customerDensity,
    estRentMillions: toMillions(costs.rent),
    revenuePotentialMillions: toMillions(revenueVnd),
    monthlyCostMillions: toMillions(costs.total),
    netMarginPct: netMargin,
    breakEvenMonth: series.breakEvenMonth,
    revenueSeries: series.months,
    investmentLevel,
    withinBudget,
    initialInvestment: {
      totalMillions: toMillions(investment.total),
      fitOutMillions: toMillions(investment.fitOut),
      equipmentMillions: toMillions(investment.equipment),
      depositMillions: toMillions(investment.deposit),
      workingCapitalMillions: toMillions(investment.workingCapital),
    },
    monthlyCosts: {
      totalMillions: toMillions(costs.total),
      items: [
        { key: 'rent', label: 'Tiền thuê mặt bằng', millions: toMillions(costs.rent) },
        { key: 'staff', label: `Nhân sự (${costs.staffFte} FTE)`, millions: toMillions(costs.staff) },
        { key: 'cogs', label: 'Nguyên liệu & giá vốn', millions: toMillions(costs.cogs) },
        { key: 'utilities', label: 'Điện nước', millions: toMillions(costs.utilities) },
        { key: 'marketing', label: 'Marketing', millions: toMillions(costs.marketing) },
        { key: 'other', label: 'Chi phí khác', millions: toMillions(costs.other) },
      ],
    },
    confidence: round1(0.78 + seededRandom(`${location.slug}|${category.key}|conf`) * 0.14),
  };
}

// ------------------------------------------------------------------ views
function locationSummary(location, category, budgetVnd) {
  const s = computeScore(location, category, budgetVnd);
  return {
    slug: location.slug,
    name: location.name,
    cluster: location.cluster,
    center: location.center,
    businessScore: s.totalScore,
    scores: s.scores,
    competitionLabel: s.competitionLabel,
    estRentMillions: s.estRentMillions,
    footTraffic: s.scores.traffic,
    accessibility: s.scores.accessibility,
    customerDensityKPerKm2: s.customerDensityKPerKm2,
    investmentLevel: s.investmentLevel,
    withinBudget: s.withinBudget,
    revenuePotentialMillions: s.revenuePotentialMillions,
    breakEvenMonth: s.breakEvenMonth,
    tags: highlightTags(location, s),
  };
}

function highlightTags(location, s) {
  const tags = [];
  if (s.scores.demand >= 85) tags.push('High demand');
  if (location.officeWorkersK >= 35) tags.push('Office density');
  if (s.scores.traffic >= 85) tags.push('Strong traffic');
  if (s.scores.rent >= 70) tags.push('Affordable rent');
  else if (s.scores.rent >= 55) tags.push('Competitive rent');
  if (s.competitionLabel === 'Low') tags.push('Low competition');
  if (location.developmentZone) tags.push('Growth zone');
  if (location.studentsK >= 40) tags.push('Student hub');
  return tags.slice(0, 4);
}

function rank(category, budgetVnd) {
  return LOCATIONS.map((l) => locationSummary(l, category, budgetVnd))
    .sort((a, b) => b.businessScore - a.businessScore || a.name.localeCompare(b.name, 'vi'))
    .map((s, i) => ({ rank: i + 1, ...s }));
}

// ------------------------------------------------------------------ derived panels
/** Share of demand by customer segment (percent, sums to 100). */
function targetCustomers(location, category) {
  const w = category.demandWeights;
  const raw = {
    office: location.officeWorkersK * (w.officeWorkers ?? 0) * 10,
    students: location.studentsK * (w.students ?? 0) * 10,
    residents: (location.population / 1000) * (w.population ?? 0) * 0.9,
    visitors: location.visitorIndex * (w.visitors ?? 0) * 7,
  };
  const total = Object.values(raw).reduce((a, b) => a + b, 0) || 1;
  const pct = Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, round((v / total) * 100)]));
  const drift = 100 - Object.values(pct).reduce((a, b) => a + b, 0);
  const largest = Object.entries(pct).sort((a, b) => b[1] - a[1])[0][0];
  pct[largest] += drift;
  return [
    { key: 'office', label: 'Nhân viên văn phòng', pct: pct.office },
    { key: 'students', label: 'Sinh viên', pct: pct.students },
    { key: 'residents', label: 'Cư dân', pct: pct.residents },
    { key: 'visitors', label: 'Khách vãng lai', pct: pct.visitors },
  ];
}

const HOURS = Array.from({ length: 15 }, (_, i) => 7 + i); // 7h..21h
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const DAYS_VI = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];

function hourCurve(archetype, h) {
  const bump = (center, width, height) => height * Math.exp(-((h - center) ** 2) / (2 * width ** 2));
  switch (archetype) {
    case 'morning':
      return 0.25 + bump(8, 1.1, 0.75) + bump(12.5, 1.2, 0.45) + bump(15.5, 1.5, 0.3);
    case 'meals':
      return 0.15 + bump(12, 1.1, 0.8) + bump(19, 1.4, 0.85);
    case 'afternoon':
      return 0.2 + bump(16, 2.2, 0.55) + bump(20, 1.3, 0.5);
    case 'bimodal':
      return 0.15 + bump(7, 0.9, 0.7) + bump(18.5, 1.3, 0.85);
    case 'evening':
      return 0.35 + bump(18.5, 2, 0.5);
    default:
      return 0.4 + bump(12, 2, 0.25) + bump(20, 1.6, 0.4);
  }
}

/** Weekly foot-traffic heatmap (0-100) for the category's typical hours, with the peak slot. */
function footTrafficHeatmap(location, category) {
  const officeHeavy = location.officeWorkersK / Math.max(1, location.population / 1000) > 0.15;
  const leisure = location.slug === 'tay-ho' || location.slug === 'hoan-kiem';
  const weekendFactor = leisure ? 1.15 : officeHeavy ? 0.45 : 0.85;
  const scale = location.footTrafficIndex / 100;
  let peak = { value: -1, day: 0, hour: 7 };
  const grid = DAYS.map((_, d) => {
    const dayFactor = d >= 5 ? weekendFactor : 1 - d * 0.02;
    return HOURS.map((h) => {
      const jitter = 0.9 + seededRandom(`${location.slug}|${category.key}|${d}|${h}`) * 0.2;
      const value = clamp(round(hourCurve(category.traffic, h) * dayFactor * scale * jitter * 100));
      if (value > peak.value) peak = { value, day: d, hour: h };
      return value;
    });
  });
  const weekday = grid.slice(0, 5).flat().reduce((a, b) => a + b, 0) / 75;
  const weekend = grid.slice(5).flat().reduce((a, b) => a + b, 0) / 30;
  return {
    days: DAYS_VI,
    hours: HOURS,
    grid,
    peak: { day: DAYS_VI[peak.day], from: `${peak.hour}:00`, to: `${peak.hour + 1}:00` },
    weekendChangePct: round(((weekend - weekday) / weekday) * 100),
  };
}

const GRID_W = 14;
const GRID_H = 11;
/** Schematic city-wide opportunity grid: demand minus competition, blurred around each area. */
function opportunityHeatmap(category, budgetVnd, topSlugs) {
  const lngs = LOCATIONS.map((l) => l.center[0]);
  const lats = LOCATIONS.map((l) => l.center[1]);
  const bounds = { minLng: Math.min(...lngs) - 0.03, maxLng: Math.max(...lngs) + 0.03, minLat: Math.min(...lats) - 0.03, maxLat: Math.max(...lats) + 0.03 };
  const scored = LOCATIONS.map((l) => ({ l, s: computeScore(l, category, budgetVnd) }));
  const cells = [];
  for (let y = 0; y < GRID_H; y++) {
    const row = [];
    for (let x = 0; x < GRID_W; x++) {
      const lng = bounds.minLng + ((x + 0.5) / GRID_W) * (bounds.maxLng - bounds.minLng);
      const lat = bounds.maxLat - ((y + 0.5) / GRID_H) * (bounds.maxLat - bounds.minLat);
      let value = 0;
      for (const { l, s } of scored) {
        const d = Math.hypot((lng - l.center[0]) * 1.04, lat - l.center[1]);
        value += (s.scores.demand * 0.6 + s.scores.competition * 0.4) * Math.exp(-(d ** 2) / (2 * 0.028 ** 2));
      }
      row.push(value);
    }
    cells.push(row);
  }
  const max = Math.max(...cells.flat()) || 1;
  const grid = cells.map((row) => row.map((v) => round((v / max) * 100)));
  const markers = topSlugs.map((slug, i) => {
    const l = LOCATION_BY_SLUG.get(slug);
    return {
      rank: i + 1,
      slug,
      name: l.name,
      x: round1((l.center[0] - bounds.minLng) / (bounds.maxLng - bounds.minLng)),
      y: round1((bounds.maxLat - l.center[1]) / (bounds.maxLat - bounds.minLat)),
    };
  });
  return { width: GRID_W, height: GRID_H, grid, markers };
}

function whyEvidence(location, category, s) {
  const evidence = [];
  if (location.officeWorkersK >= 20) evidence.push(`${location.officeWorkersK}k nhân viên văn phòng trong bán kính 1 km`);
  if (location.nearestMetro) evidence.push(`Metro ${location.nearestMetro.line} · ga ${location.nearestMetro.station} cách ${location.nearestMetro.distanceM} m`);
  if (location.universities > 0) evidence.push(`${location.universities} trường đại học · ${location.studentsK}k sinh viên`);
  else if (location.incomeIndex >= 75) evidence.push(`Thu nhập khu vực thuộc nhóm cao (chỉ số ${location.incomeIndex}/100)`);
  if (evidence.length < 3) evidence.push(`Lưu lượng khách ${s.scores.traffic}/100, mật độ khách ${s.customerDensityKPerKm2}k/km²`);
  return evidence.slice(0, 3);
}

function risks(location, category, s, heat) {
  const out = [];
  if (s.competitionLabel !== 'Low') {
    out.push({ text: `Đối thủ chuỗi mở rộng trong bán kính 300 m`, severity: s.competitionLabel === 'High' ? 'High' : 'Medium' });
  }
  if (heat.weekendChangePct <= -30) out.push({ text: `Lưu lượng cuối tuần giảm ~${Math.abs(heat.weekendChangePct)}%`, severity: 'Medium' });
  out.push({ text: `Điều khoản tăng giá thuê +${location.avgRentVndPerM2 >= 600_000 ? 10 : 8}%/năm`, severity: location.avgRentVndPerM2 >= 800_000 ? 'Medium' : 'Low' });
  if (!s.withinBudget) out.push({ text: 'Vốn đầu tư ban đầu vượt ngân sách đã nhập', severity: 'High' });
  if (s.breakEvenMonth === null) out.push({ text: 'Chưa hoà vốn trong 18 tháng theo mô phỏng', severity: 'High' });
  return out.slice(0, 4);
}

function growthOpportunities(location, category) {
  const out = [];
  if (location.nearestMetro) out.push({ text: `Lượng khách metro ${location.nearestMetro.line} tăng → thêm khách vãng lai`, timing: '2026' });
  if (location.officeWorkersK >= 30 && category.traffic === 'morning') out.push({ text: 'Chỗ ngồi làm việc 7–9h sáng cho dân văn phòng', timing: 'Now' });
  if (location.officeWorkersK >= 25) out.push({ text: 'Đơn giao hàng B2B cho văn phòng lân cận', timing: 'Now' });
  if (location.developmentZone) out.push({ text: 'Khu đô thị mới đang lấp đầy cư dân', timing: '2027' });
  if (location.studentsK >= 30) out.push({ text: 'Ưu đãi sinh viên giờ thấp điểm', timing: 'Now' });
  return out.slice(0, 3);
}

function competitorGap(location, category, heat) {
  const late = 55 + round(seededRandom(`${location.slug}|${category.key}|gap`) * 25);
  const gaps = {
    morning: `chỗ ngồi làm việc kèm mang đi nhanh trước 9h; ${late}% quán lân cận mở cửa sau 8h`,
    meals: `thực đơn trưa nhanh dưới 15 phút; ${late}% nhà hàng lân cận chỉ mạnh buổi tối`,
    afternoon: `mở cửa đến 22h; ${late}% cửa hàng lân cận đóng trước 21h`,
    bimodal: `lớp nhóm buổi sáng sớm; ${late}% phòng tập lân cận mở sau 6h`,
    evening: `mở 24/7; ${late}% nhà thuốc lân cận đóng trước 22h`,
    broad: `quầy đồ ăn nóng mang đi; ${late}% cửa hàng lân cận chưa có`,
  };
  return gaps[category.traffic];
}

function recommendation(s) {
  if (!s.withinBudget) return 'Cân nhắc — vượt ngân sách';
  if (s.totalScore >= 85) return 'Nên mở tại đây · thuê 3+ năm';
  if (s.totalScore >= 75) return 'Phù hợp · thử nghiệm quy mô nhỏ';
  return 'Cân nhắc kỹ trước khi mở';
}

/** Everything the dashboard's right-hand side shows for one location. */
function locationDetail(location, category, budgetVnd) {
  const s = computeScore(location, category, budgetVnd);
  const ranking = rank(category, budgetVnd);
  const position = ranking.findIndex((r) => r.slug === location.slug) + 1;
  const heat = footTrafficHeatmap(location, category);
  return {
    slug: location.slug,
    name: location.name,
    cluster: location.cluster,
    center: location.center,
    category: { key: category.key, name: category.name, nameVi: category.nameVi },
    budgetMillions: toMillions(budgetVnd),
    rank: position,
    rankOf: ranking.length,
    ...s,
    fitLabel: s.totalScore >= 85 ? 'Strong fit' : s.totalScore >= 72 ? 'Good fit' : 'Weak fit',
    attributes: {
      population: location.population,
      areaKm2: location.areaKm2,
      incomeIndex: location.incomeIndex,
      officeWorkersK: location.officeWorkersK,
      studentsK: location.studentsK,
      schools: location.schools,
      universities: location.universities,
      offices: location.offices,
      nearestMetro: location.nearestMetro,
      developmentZone: location.developmentZone,
    },
    evidence: whyEvidence(location, category, s),
    targetCustomers: targetCustomers(location, category),
    footTraffic: heat,
    competitorGap: competitorGap(location, category, heat),
    risks: risks(location, category, s, heat),
    growthOpportunities: growthOpportunities(location, category),
    recommendation: recommendation(s),
  };
}

/** 2-3 locations side by side with the best value per metric flagged. */
function compareLocations(slugs, category, budgetVnd) {
  const rows = slugs.map((slug) => {
    const l = requireLocation(slug);
    const s = computeScore(l, category, budgetVnd);
    return { slug, name: l.name, s };
  });
  const metric = (key, label, pick, betterIsHigher = true, format = (v) => v) => {
    const values = rows.map((r) => pick(r.s));
    const numeric = values.map((v) => (typeof v === 'number' ? v : null));
    const valid = numeric.filter((v) => v !== null);
    const best = valid.length ? (betterIsHigher ? Math.max(...valid) : Math.min(...valid)) : null;
    return {
      key,
      label,
      values: Object.fromEntries(rows.map((r, i) => [r.slug, format(values[i])])),
      best: rows.filter((_, i) => numeric[i] !== null && numeric[i] === best).map((r) => r.slug),
    };
  };
  const levelRank = { Low: 1, Medium: 2, High: 3 };
  const metrics = [
    metric('businessScore', 'Business Score', (s) => s.totalScore),
    metric('demand', 'Nhu cầu', (s) => s.scores.demand),
    metric('competition', 'Cạnh tranh (cao = ít đối thủ)', (s) => s.scores.competition),
    metric('rent', 'Tiền thuê (tr/tháng)', (s) => s.estRentMillions, false),
    metric('traffic', 'Lưu lượng khách', (s) => s.scores.traffic),
    metric('accessibility', 'Tiếp cận', (s) => s.scores.accessibility),
    metric('growth', 'Tăng trưởng', (s) => s.scores.growth),
    metric('revenue', 'Doanh thu (tr/tháng)', (s) => s.revenuePotentialMillions),
    metric('breakEven', 'Hoà vốn (tháng)', (s) => s.breakEvenMonth ?? 99, false, (v) => (v === 99 ? null : v)),
    metric('investment', 'Mức đầu tư', (s) => levelRank[s.investmentLevel], false, (v) => Object.keys(levelRank).find((k) => levelRank[k] === v)),
  ];
  const winner = [...rows].sort((a, b) => b.s.totalScore - a.s.totalScore)[0];
  const fastest = [...rows].filter((r) => r.s.breakEvenMonth !== null).sort((a, b) => a.s.breakEvenMonth - b.s.breakEvenMonth)[0];
  const leadsOn = metrics.filter((m) => ['demand', 'traffic', 'competition', 'rent'].includes(m.key) && m.best.length === 1 && m.best[0] === winner.slug).map((m) => m.label.split(' (')[0].toLowerCase());
  const summary =
    `${winner.name} dẫn đầu${leadsOn.length ? ` về ${leadsOn.join(', ')}` : ' về tổng điểm'}.` +
    (fastest ? ` ${fastest.name} hoà vốn nhanh nhất (tháng ${fastest.s.breakEvenMonth}).` : '');
  return {
    category: { key: category.key, name: category.name, nameVi: category.nameVi },
    budgetMillions: toMillions(budgetVnd),
    locations: rows.map((r) => ({ slug: r.slug, name: r.name, businessScore: r.s.totalScore, scores: r.s.scores })),
    metrics,
    winner: winner.slug,
    summary,
  };
}

module.exports = {
  SCORE_WEIGHTS,
  DEFAULT_BUDGET_VND,
  requireCategory,
  requireLocation,
  requireBudget,
  computeScore,
  locationSummary,
  locationDetail,
  rank,
  compareLocations,
  competitorsFor,
  opportunityHeatmap,
  toMillions,
  rentFor,
};
