'use strict';
/**
 * Business Opportunity Map — scoring model for the wards/communes (2025) of Hanoi.
 *
 * Every number comes from data/hanoi-wards.json (OpenStreetMap, `npm run data:opportunity`):
 *
 *   demand       (0-100)  weighted mix of the ward's population and demand signals (offices, apartment buildings,
 *                          schools, metro stations in service). Each signal is relative between the scored wards,
 *                          on a square-root scale (100 = the highest ward).
 *   competition  (0-100)  businesses of that type per 10,000 residents, relative between the wards (100 = densest).
 *   opportunity  (0-100)  demand − 0.4 × competition.
 *
 * Horizon 2030 ("in 3–5 years") adds a growth signal: construction sites (landuse=construction) in the ward and
 * metro track under construction nearby (line 3, underground section). demand₂₀₃₀ = min(100, demand + 0.25 × growth).
 *
 * Only wards with a population figure are scored. Confidence is 'low' when OSM maps the business type sparsely
 * across Hanoi, or when the ward itself has few businesses mapped for its population (OSM coverage) — then the
 * competition figure is unreliable. Low-confidence types never become a ward's top suggestion.
 */
const DATA = require('./data/hanoi-wards.json');

const SIGNALS = ['population', 'offices', 'apartments', 'schools', 'metro'];
const SIGNAL_LABELS = {
  vi: { population: 'Dân số', offices: 'Văn phòng', apartments: 'Chung cư', schools: 'Trường học', metro: 'Ga metro', growth: 'Công trình đang xây & metro sắp mở' },
  en: { population: 'Population', offices: 'Offices', apartments: 'Apartment buildings', schools: 'Schools', metro: 'Metro stations', growth: 'Construction & metro coming' },
};

/** The 12 business types: what they sell to, as weights over the demand signals (they sum to 1). */
const TYPES = {
  cafe: { icon: '☕', name: { vi: 'Quán cà phê', en: 'Café' }, desc: { vi: 'Cà phê, đồ uống mang đi, không gian làm việc', en: 'Coffee, take-away drinks, co-working' }, weights: { population: 0.25, offices: 0.3, apartments: 0.2, schools: 0.1, metro: 0.15 } },
  fnb: { icon: '🍜', name: { vi: 'Nhà hàng / ăn uống', en: 'Restaurant / food' }, desc: { vi: 'Nhà hàng, quán ăn, đồ ăn nhanh', en: 'Restaurants, eateries, fast food' }, weights: { population: 0.3, apartments: 0.25, offices: 0.2, metro: 0.15, schools: 0.1 } },
  gym: { icon: '🏋️', name: { vi: 'Gym / fitness', en: 'Gym / fitness' }, desc: { vi: 'Phòng gym, yoga, fitness', en: 'Gyms, yoga, fitness centres' }, weights: { population: 0.25, apartments: 0.4, offices: 0.25, metro: 0.05, schools: 0.05 } },
  education: { icon: '🧒', name: { vi: 'Giáo dục trẻ em', en: "Children's education" }, desc: { vi: 'Mầm non, trung tâm ngoại ngữ, năng khiếu', en: 'Pre-schools, language and arts centres' }, weights: { population: 0.3, schools: 0.4, apartments: 0.25, offices: 0, metro: 0.05 } },
  convenience: { icon: '🛒', name: { vi: 'Cửa hàng tiện lợi', en: 'Convenience store' }, desc: { vi: 'Minimart, cửa hàng tiện lợi, siêu thị mini', en: 'Minimarts, convenience stores' }, weights: { population: 0.35, metro: 0.25, apartments: 0.3, offices: 0.05, schools: 0.05 } },
  beauty: { icon: '💇', name: { vi: 'Làm đẹp / spa', en: 'Beauty / spa' }, desc: { vi: 'Salon tóc, spa, nail', en: 'Hair salons, spas, nails' }, weights: { population: 0.25, apartments: 0.3, offices: 0.2, metro: 0.15, schools: 0.1 } },
  pharmacy: { icon: '🏥', name: { vi: 'Nhà thuốc / phòng khám', en: 'Pharmacy / clinic' }, desc: { vi: 'Nhà thuốc, phòng khám tư, nha khoa', en: 'Pharmacies, private clinics, dentists' }, weights: { population: 0.35, apartments: 0.35, schools: 0.1, offices: 0.1, metro: 0.1 } },
  petshop: { icon: '🐾', name: { vi: 'Thú cưng', en: 'Pets' }, desc: { vi: 'Cửa hàng thú cưng, phòng khám thú y', en: 'Pet shops, vets' }, weights: { population: 0.3, apartments: 0.4, offices: 0.15, metro: 0.1, schools: 0.05 } },
  realestate: { icon: '🏠', name: { vi: 'Môi giới bất động sản', en: 'Real-estate agency' }, desc: { vi: 'Văn phòng môi giới, sàn giao dịch', en: 'Estate agents' }, weights: { apartments: 0.45, metro: 0.25, population: 0.15, offices: 0.1, schools: 0.05 } },
  laundry: { icon: '🧺', name: { vi: 'Giặt ủi', en: 'Laundry' }, desc: { vi: 'Giặt sấy tự động, giặt ủi theo giờ', en: 'Self-service and drop-off laundry' }, weights: { apartments: 0.35, offices: 0.25, population: 0.25, metro: 0.1, schools: 0.05 } },
  bookstore: { icon: '📚', name: { vi: 'Nhà sách / văn phòng phẩm', en: 'Books / stationery' }, desc: { vi: 'Nhà sách, văn phòng phẩm, đồ dùng học tập', en: 'Bookshops, stationery' }, weights: { schools: 0.4, population: 0.3, apartments: 0.2, offices: 0.05, metro: 0.05 } },
  carwash: { icon: '🚗', name: { vi: 'Sửa xe / rửa xe', en: 'Car & motorbike care' }, desc: { vi: 'Rửa xe, sửa chữa ô tô, xe máy', en: 'Car wash, car and motorbike repair' }, weights: { population: 0.35, apartments: 0.3, offices: 0.2, schools: 0.1, metro: 0.05 } },
};
const TYPE_KEYS = Object.keys(TYPES);
const HORIZONS = ['now', '2030'];
/** Below this many places across the whole map, OSM is too incomplete to judge competition for a type. */
const SPARSE_TOTAL = 100;
const COMPETITION_WEIGHT = 0.4;
const GROWTH_SHARE = 0.25;

const round1 = (n) => Math.round(n * 10) / 10;
/** Square-root relative scale: 100 for the highest value. */
const relative = (values) => {
  const max = Math.max(...values);
  return values.map((v) => (max > 0 ? 100 * Math.sqrt(Math.max(0, v) / max) : 0));
};

const scored = DATA.wards.filter((w) => w.population);
const raw = {
  population: scored.map((w) => w.population),
  offices: scored.map((w) => w.counts.offices),
  apartments: scored.map((w) => w.counts.apartments),
  schools: scored.map((w) => w.counts.schools),
  metro: scored.map((w) => w.metroStations.length),
};
const norm = Object.fromEntries(SIGNALS.map((s) => [s, relative(raw[s])]));
// Growth (3–5 years): construction area and metro track being built within reach of the ward.
const metroBuilding = scored.map((w) => (w.metroBuildingKm === null ? 0 : w.metroBuildingKm <= 1.5 ? 100 : w.metroBuildingKm <= 3 ? 50 : 0));
const constructionNorm = relative(scored.map((w) => w.constructionHa));
const growth = scored.map((_, i) => 0.6 * constructionNorm[i] + 0.4 * metroBuilding[i]);

const totals = Object.fromEntries(TYPE_KEYS.map((t) => [t, DATA.wards.reduce((s, w) => s + w.counts[t], 0)]));
const density = Object.fromEntries(TYPE_KEYS.map((t) => [t, scored.map((w) => (w.counts[t] / w.population) * 10_000)]));
const competitionNorm = Object.fromEntries(TYPE_KEYS.map((t) => [t, relative(density[t])]));
// OSM coverage of a ward: businesses mapped per 10,000 residents, relative to the median ward (1 = median).
const mapped = scored.map((w) => (TYPE_KEYS.reduce((s, t) => s + w.counts[t], 0) / w.population) * 10_000);
const median = [...mapped].sort((a, b) => a - b)[Math.floor(mapped.length / 2)] || 1;
const coverage = mapped.map((m) => m / median);
/** A ward whose mapped businesses fall below this share of the median ward is too thinly mapped to judge competition. */
const LOW_COVERAGE = 0.35;

/** Score of one type in one scored ward (index into `scored`). */
function scoreAt(i, type, horizon) {
  const spec = TYPES[type];
  const parts = SIGNALS.map((s) => ({ signal: s, weight: spec.weights[s] ?? 0, value: norm[s][i] }));
  const demandNow = parts.reduce((sum, p) => sum + p.weight * p.value, 0);
  const demand = horizon === '2030' ? Math.min(100, demandNow + GROWTH_SHARE * growth[i]) : demandNow;
  const competition = competitionNorm[type][i];
  return {
    type,
    opportunity: round1(Math.max(0, Math.min(100, demand - COMPETITION_WEIGHT * competition))),
    demand: round1(demand),
    competition: round1(competition),
    count: scored[i].counts[type],
    per10k: round1(density[type][i]),
    confidence: totals[type] < SPARSE_TOTAL || coverage[i] < LOW_COVERAGE ? 'low' : 'ok',
    sparseType: totals[type] < SPARSE_TOTAL,
    parts: parts.map((p) => ({ ...p, value: round1(p.value) })),
    growth: horizon === '2030' ? round1(growth[i]) : null,
  };
}

const SCORED_INDEX = new Map(scored.map((w, i) => [w.slug, i]));
const WARD_BY_SLUG = new Map(DATA.wards.map((w) => [w.slug, w]));

/** All types for one ward, best first; null when the ward is not scored (no population figure). */
function scoresFor(slug, horizon) {
  const i = SCORED_INDEX.get(slug);
  if (i === undefined) return null;
  // Types with reliable data first, then the rest — so a ward's top suggestion never rests on missing data.
  return TYPE_KEYS.map((t) => scoreAt(i, t, horizon)).sort((a, b) => Number(a.sparseType) - Number(b.sparseType) || b.opportunity - a.opportunity);
}

/** One type across all scored wards, best first. */
function rankingFor(type, horizon) {
  return scored.map((w, i) => ({ slug: w.slug, ...scoreAt(i, type, horizon) })).sort((a, b) => b.opportunity - a.opportunity);
}

module.exports = {
  DATA,
  TYPES,
  TYPE_KEYS,
  HORIZONS,
  SIGNALS,
  SIGNAL_LABELS,
  SPARSE_TOTAL,
  COMPETITION_WEIGHT,
  GROWTH_SHARE,
  totals,
  WARD_BY_SLUG,
  scoresFor,
  rankingFor,
  isScored: (slug) => SCORED_INDEX.has(slug),
  growthOf: (slug) => (SCORED_INDEX.has(slug) ? round1(growth[SCORED_INDEX.get(slug)]) : null),
  /** OSM coverage of a scored ward (1 = median ward) and whether it is too thin to judge competition. */
  coverageOf: (slug) => {
    const i = SCORED_INDEX.get(slug);
    return i === undefined ? null : { ratio: round1(coverage[i]), low: coverage[i] < LOW_COVERAGE, perTenThousand: round1(mapped[i]) };
  },
};
