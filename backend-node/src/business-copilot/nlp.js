'use strict';
/**
 * Tiny rule-based parser for business prompts in Vietnamese or English, e.g.
 *   "I have 500M VND and want to open a coffee shop in Hanoi."
 *   "Tôi có 1,2 tỷ, muốn mở nhà hàng ở Cầu Giấy"
 * It never guesses wildly: anything it cannot find is reported as missing so the UI/AI can ask.
 */
const { normalizeText } = require('../living-score/common/text');
const { CATEGORIES, LOCATIONS } = require('./data');

const CATEGORY_KEYWORDS = {
  'coffee-shop': ['coffee', 'cafe', 'ca phe', 'cafe shop', 'quan ca phe', 'tra sua', 'bubble tea', 'espresso'],
  restaurant: ['restaurant', 'nha hang', 'quan an', 'bistro', 'dining', 'an uong', 'f b', 'fnb', 'lau', 'nuong'],
  'retail-store': ['retail', 'shop', 'store', 'cua hang', 'ban le', 'thoi trang', 'fashion', 'boutique'],
  gym: ['gym', 'fitness', 'phong tap', 'the hinh', 'yoga', 'pilates'],
  pharmacy: ['pharmacy', 'nha thuoc', 'hieu thuoc', 'drugstore', 'thuoc'],
  'convenience-store': ['convenience', 'tien loi', 'mini mart', 'minimart', 'tap hoa', 'grocery', 'sieu thi mini'],
};
// "cua hang tien loi" contains "cua hang"; check the more specific categories first.
const CATEGORY_ORDER = ['convenience-store', 'coffee-shop', 'pharmacy', 'gym', 'restaurant', 'retail-store'];

const UNIT = {
  ty: 1_000_000_000,
  ti: 1_000_000_000,
  b: 1_000_000_000,
  bn: 1_000_000_000,
  billion: 1_000_000_000,
  trieu: 1_000_000,
  tr: 1_000_000,
  m: 1_000_000,
  million: 1_000_000,
  mil: 1_000_000,
  k: 1_000,
  nghin: 1_000,
  ngan: 1_000,
};

/** Finds the first money amount, e.g. "500M", "500 triệu", "1,2 tỷ", "1.5B", "800,000,000 VND". */
function parseBudget(text) {
  const plain = text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase();
  const withUnit = plain.match(/(\d+(?:[.,]\d+)?)\s*(ty|ti|billion|bn|b|trieu|tr|million|mil|m|nghin|ngan|k)\b/);
  if (withUnit) {
    const value = Number(withUnit[1].replace(',', '.'));
    const amount = Math.round(value * UNIT[withUnit[2]]);
    if (Number.isFinite(amount) && amount > 0) return amount;
  }
  const raw = plain.match(/(\d{1,3}(?:[.,\s]\d{3}){2,})\s*(?:vnd|dong|d)?/);
  if (raw) {
    const amount = Number(raw[1].replace(/[.,\s]/g, ''));
    if (Number.isFinite(amount) && amount >= 1_000_000) return amount;
  }
  return null;
}

function parseCategory(normalized) {
  const padded = ` ${normalized} `;
  for (const key of CATEGORY_ORDER) {
    if (CATEGORY_KEYWORDS[key].some((kw) => padded.includes(` ${kw} `) || padded.includes(` ${kw}`))) return key;
  }
  return null;
}

function parseDistricts(normalized) {
  return LOCATIONS.filter((l) => normalized.includes(normalizeText(l.name))).map((l) => l.slug);
}

function parsePrompt(message) {
  const normalized = normalizeText(message);
  const budgetVnd = parseBudget(message);
  const category = parseCategory(normalized);
  const districts = parseDistricts(normalized);
  const missing = [];
  if (!category) missing.push('category');
  if (!budgetVnd) missing.push('budget');
  return { category, budgetVnd, districts, missing };
}

module.exports = { parsePrompt, parseBudget, parseCategory, CATEGORY_KEYWORDS, SUPPORTED: CATEGORIES.map((c) => c.key) };
