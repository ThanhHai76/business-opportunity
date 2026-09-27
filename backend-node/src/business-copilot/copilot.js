'use strict';
/**
 * AI Business Copilot: routes a free-text question to an intent, computes the facts with the engine,
 * then lets the AI provider word the answer as Recommendation → Evidence → Scores → Risks → Next actions.
 */
const { normalizeText } = require('../living-score/common/text');
const { CATEGORIES, LOCATIONS, CATEGORY_BY_KEY, LOCATION_BY_SLUG } = require('./data');
const { parsePrompt } = require('./nlp');
const { rank, locationDetail, compareLocations, computeScore, DEFAULT_BUDGET_VND } = require('./scoring');
const { explainWithFallback } = require('./ai-provider');

const has = (text, words) => words.some((w) => text.includes(w));
const LEVEL_VI = { Low: 'thấp', Medium: 'trung bình', High: 'cao' };

function detectIntent(normalized, parsed) {
  if (parsed.districts.length >= 2) return 'compare';
  if (has(normalized, ['lowest competition', 'least competition', 'it canh tranh', 'canh tranh thap', 'it doi thu'])) return 'low-competition';
  if (has(normalized, ['premium', 'cao cap', 'sang trong', 'high end', 'luxury'])) return 'premium';
  if (has(normalized, ['what type', 'what business', 'loai hinh nao', 'kinh doanh gi', 'mo gi', 'nen kinh doanh'])) return 'category-fit';
  // One named district and no "where/which" question -> talk about that district.
  if (parsed.districts.length === 1 && !has(normalized, [' where ', ' o dau ', ' khu nao ', ' quan nao '])) return 'location';
  if (parsed.category || parsed.budgetVnd || has(normalized, ['where', 'o dau', 'khu nao', 'quan nao', 'mo quan', 'open'])) return 'recommend';
  if (parsed.districts.length === 1) return 'location';
  return 'help';
}

function scoresRows(detail) {
  return [
    { label: 'Business Score', value: detail.totalScore },
    { label: 'Nhu cầu', value: detail.scores.demand },
    { label: 'Cạnh tranh', value: detail.scores.competition },
    { label: 'Giá thuê', value: detail.scores.rent },
    { label: 'Lưu lượng', value: detail.scores.traffic },
    { label: 'Tiếp cận', value: detail.scores.accessibility },
    { label: 'Tăng trưởng', value: detail.scores.growth },
  ];
}

function locationFacts(detail) {
  return {
    name: detail.name,
    categoryVi: detail.category.nameVi,
    totalScore: detail.totalScore,
    scores: detail.scores,
    competitionLabel: detail.competitionLabel,
    evidence: detail.evidence,
    risks: detail.risks,
    recommendation: detail.recommendation,
    revenuePotentialMillions: detail.revenuePotentialMillions,
    monthlyCostMillions: detail.monthlyCostMillions,
    breakEvenMonth: detail.breakEvenMonth,
    estRentMillions: detail.estRentMillions,
  };
}

/**
 * @param providers { primary, fallback } from createAIProvider
 * @param input { question, context?: { category?, budgetVnd?, location? } }
 */
async function answer(providers, input) {
  const question = input.question.trim();
  const normalized = ` ${normalizeText(question)} `;
  const parsed = parsePrompt(question);
  const ctx = input.context ?? {};
  const category = CATEGORY_BY_KEY.get(parsed.category ?? ctx.category ?? 'coffee-shop');
  const budgetVnd = parsed.budgetVnd ?? ctx.budgetVnd ?? DEFAULT_BUDGET_VND;
  const intent = detectIntent(normalized, parsed);
  const base = { intent, question, category: { key: category.key, nameVi: category.nameVi }, budgetMillions: budgetVnd / 1e6, demo: true };

  let task = 'general';
  let facts;
  let scores = [];
  let locations = [];

  if (intent === 'compare') {
    const slugs = parsed.districts.slice(0, 3);
    const result = compareLocations(slugs, category, budgetVnd);
    task = 'compare';
    facts = { ...result, winnerName: LOCATION_BY_SLUG.get(result.winner).name, names: Object.fromEntries(result.locations.map((l) => [l.slug, l.name])) };
    scores = result.locations.map((l) => ({ label: l.name, value: l.businessScore }));
    locations = slugs;
  } else if (intent === 'recommend') {
    const ranking = rank(category, budgetVnd);
    const top = ranking.slice(0, 3);
    task = 'recommendations';
    facts = {
      categoryVi: category.nameVi,
      budgetMillions: budgetVnd / 1e6,
      top,
      overBudget: ranking.filter((r) => !r.withinBudget).map((r) => r.name),
    };
    scores = facts.top.map((t) => ({ label: t.name, value: t.businessScore }));
    locations = facts.top.map((t) => t.slug);
  } else if (intent === 'location') {
    const detail = locationDetail(LOCATION_BY_SLUG.get(parsed.districts[0]), category, budgetVnd);
    task = 'location';
    facts = locationFacts(detail);
    scores = scoresRows(detail);
    locations = [detail.slug];
  } else if (intent === 'low-competition') {
    const ranking = rank(category, budgetVnd).sort((a, b) => b.scores.competition - a.scores.competition);
    const top = ranking.slice(0, 3);
    facts = {
      summary: `Với ${category.nameVi.toLowerCase()}, ${top[0].name} có mức cạnh tranh thấp nhất (điểm cạnh tranh ${top[0].scores.competition}/100 — càng cao càng ít đối thủ), tiếp theo là ${top[1].name} và ${top[2].name}.`,
      recommendation: `Cân nhắc ${top[0].name} nếu bạn muốn vào sớm; kiểm tra thêm nhu cầu (${top[0].scores.demand}/100) trước khi quyết định.`,
      evidence: top.map((t) => `${t.name}: cạnh tranh ${LEVEL_VI[t.competitionLabel]}, nhu cầu ${t.scores.demand}, Business Score ${t.businessScore}`),
      risks: ['Ít đối thủ đôi khi phản ánh nhu cầu thấp — hãy xem cả điểm nhu cầu'],
      nextActions: [`Mở chi tiết ${top[0].name}`, 'So sánh 3 khu vực này'],
    };
    scores = top.map((t) => ({ label: t.name, value: t.scores.competition }));
    locations = top.map((t) => t.slug);
  } else if (intent === 'premium') {
    const premiumCategory = parsed.category ? category : CATEGORY_BY_KEY.get('restaurant');
    const scored = LOCATIONS.map((l) => {
      const s = computeScore(l, premiumCategory, Math.max(budgetVnd, 1_500_000_000));
      const fit = Math.round(l.incomeIndex * 0.45 + l.visitorIndex * 0.3 + s.scores.demand * 0.25);
      return { slug: l.slug, name: l.name, fit, income: l.incomeIndex, visitors: l.visitorIndex, rent: s.estRentMillions };
    }).sort((a, b) => b.fit - a.fit);
    const top = scored.slice(0, 3);
    facts = {
      summary: `Cho ${premiumCategory.nameVi.toLowerCase()} cao cấp, ${top[0].name}, ${top[1].name} và ${top[2].name} phù hợp nhất nhờ thu nhập và khách vãng lai cao.`,
      recommendation: `Ưu tiên ${top[0].name}; chuẩn bị ngân sách thuê cao hơn (~${top[0].rent} tr/tháng theo ước tính).`,
      evidence: top.map((t) => `${t.name}: chỉ số thu nhập ${t.income}, khách vãng lai ${t.visitors}, độ phù hợp cao cấp ${t.fit}/100`),
      risks: ['Giá thuê ở khu cao cấp cao, thời gian hoà vốn dài hơn'],
      nextActions: ['Mô phỏng với ngân sách ≥ 1,5 tỷ', 'Xem bản đồ lớp mua sắm & khách vãng lai'],
    };
    scores = top.map((t) => ({ label: t.name, value: t.fit }));
    locations = top.map((t) => t.slug);
  } else if (intent === 'category-fit') {
    const slug = parsed.districts[0] ?? ctx.location ?? 'cau-giay';
    const location = LOCATION_BY_SLUG.get(slug) ?? LOCATION_BY_SLUG.get('cau-giay');
    const byCategory = CATEGORIES.map((c) => ({ c, s: computeScore(location, c, budgetVnd) })).sort((a, b) => b.s.totalScore - a.s.totalScore);
    facts = {
      summary: `Tại ${location.name}, loại hình phù hợp nhất với ngân sách ${budgetVnd / 1e6} triệu là ${byCategory[0].c.nameVi.toLowerCase()} (${byCategory[0].s.totalScore}/100), sau đó là ${byCategory[1].c.nameVi.toLowerCase()} và ${byCategory[2].c.nameVi.toLowerCase()}.`,
      recommendation: `Bắt đầu với ${byCategory[0].c.nameVi.toLowerCase()}.`,
      evidence: byCategory.slice(0, 3).map(({ c, s }) => `${c.nameVi}: ${s.totalScore}/100, cạnh tranh ${LEVEL_VI[s.competitionLabel]}${s.withinBudget ? '' : ', vượt ngân sách'}`),
      risks: byCategory.filter(({ s }) => !s.withinBudget).map(({ c }) => `${c.nameVi} vượt ngân sách ban đầu`).slice(0, 2),
      nextActions: ['Mở chi tiết khu vực', 'Chạy mô phỏng cho loại hình đứng đầu'],
    };
    scores = byCategory.map(({ c, s }) => ({ label: c.nameVi, value: s.totalScore }));
    locations = [location.slug];
  }

  const { narrative, provider, model, fellBack } = await explainWithFallback(providers, { task, question, facts: facts ?? {} });
  return { ...base, answer: narrative, scores, locations, provider, model, notice: fellBack ? 'AI tạm thời không khả dụng — đang dùng câu trả lời theo quy tắc.' : undefined };
}

const EXAMPLE_QUESTIONS = [
  'Where should I open a coffee shop with 500M?',
  'Quận nào có ít cạnh tranh nhất cho quán cà phê?',
  'So sánh Cầu Giấy và Hà Đông',
  'Tìm khu vực phù hợp cho nhà hàng cao cấp',
  'Ở Tây Hồ nên kinh doanh gì?',
];

module.exports = { answer, detectIntent, EXAMPLE_QUESTIONS };
