/**
 * Opportunity scoring engine — same weighted-sum model as the FastAPI
 * version (see ../../backend/app/scoring.py) and the standalone demo, so
 * all three surfaces agree on every number.
 *
 * demand_score       = weighted sum of an area's growth metrics (0-100)
 * opportunity_score  = demand_score, discounted by how saturated that
 *                       business type already is in the area (0-100)
 */

const METRIC_LABELS = {
  population_growth: 'Dân số',
  metro_growth: 'Hạ tầng Metro',
  apartment_growth: 'Chung cư mới',
  school_growth: 'Trường học',
  office_growth: 'Văn phòng',
};

const BUSINESS_TYPES = {
  cafe: {
    name: 'Quán Cafe',
    icon: '☕',
    description: 'Cafe, coffee to-go, không gian làm việc',
    weights: { population_growth: 0.25, office_growth: 0.30, apartment_growth: 0.20, school_growth: 0.10, metro_growth: 0.15 },
  },
  fnb: {
    name: 'Nhà hàng / F&B',
    icon: '🍜',
    description: 'Nhà hàng, quán ăn, đồ ăn nhanh',
    weights: { population_growth: 0.30, apartment_growth: 0.25, office_growth: 0.20, metro_growth: 0.15, school_growth: 0.10 },
  },
  gym: {
    name: 'Gym / Fitness',
    icon: '🏋️',
    description: 'Phòng gym, yoga, fitness center',
    weights: { population_growth: 0.25, apartment_growth: 0.40, office_growth: 0.25, metro_growth: 0.05, school_growth: 0.05 },
  },
  education: {
    name: 'Giáo dục trẻ em',
    icon: '🧒',
    description: 'Mầm non, trung tâm ngoại ngữ, năng khiếu',
    weights: { population_growth: 0.30, school_growth: 0.40, apartment_growth: 0.25, office_growth: 0, metro_growth: 0.05 },
  },
  convenience: {
    name: 'Cửa hàng tiện lợi',
    icon: '🛒',
    description: 'Minimart, convenience store 24/7',
    weights: { population_growth: 0.35, metro_growth: 0.25, apartment_growth: 0.30, office_growth: 0.05, school_growth: 0.05 },
  },
  beauty: {
    name: 'Beauty / Spa',
    icon: '💇',
    description: 'Salon tóc, spa, nail, chăm sóc sắc đẹp',
    weights: { population_growth: 0.25, apartment_growth: 0.30, office_growth: 0.20, metro_growth: 0.15, school_growth: 0.10 },
  },
  pharmacy: {
    name: 'Nhà thuốc / Y tế',
    icon: '🏥',
    description: 'Nhà thuốc, phòng khám tư, dịch vụ y tế cơ bản',
    weights: { population_growth: 0.35, apartment_growth: 0.35, school_growth: 0.10, office_growth: 0.10, metro_growth: 0.10 },
  },
  petshop: {
    name: 'Thú cưng',
    icon: '🐾',
    description: 'Pet shop, spa thú cưng, phòng khám thú y',
    weights: { population_growth: 0.30, apartment_growth: 0.40, office_growth: 0.15, metro_growth: 0.10, school_growth: 0.05 },
  },
  realestate: {
    name: 'Bất động sản / Môi giới',
    icon: '🏠',
    description: 'Văn phòng môi giới, sàn giao dịch bất động sản',
    weights: { apartment_growth: 0.45, metro_growth: 0.25, population_growth: 0.15, office_growth: 0.10, school_growth: 0.05 },
  },
  laundry: {
    name: 'Giặt ủi',
    icon: '🧺',
    description: 'Giặt sấy tự động/công nghiệp, giặt ủi theo giờ',
    weights: { apartment_growth: 0.35, office_growth: 0.25, population_growth: 0.25, metro_growth: 0.10, school_growth: 0.05 },
  },
  bookstore: {
    name: 'Nhà sách / Văn phòng phẩm',
    icon: '📚',
    description: 'Nhà sách, văn phòng phẩm, đồ dùng học tập',
    weights: { school_growth: 0.40, population_growth: 0.30, apartment_growth: 0.20, office_growth: 0.05, metro_growth: 0.05 },
  },
  carwash: {
    name: 'Sửa xe / Rửa xe',
    icon: '🚗',
    description: 'Rửa xe, bảo dưỡng, sửa chữa ô tô - xe máy',
    weights: { population_growth: 0.35, apartment_growth: 0.30, office_growth: 0.20, school_growth: 0.10, metro_growth: 0.05 },
  },
};

function clip(value, lo = 0, hi = 100) {
  return Math.max(lo, Math.min(hi, value));
}

/**
 * @param {Record<string, number>} metrics
 * @param {Record<string, number>} competition
 * @returns array of opportunities, sorted by opportunity_score desc
 */
function scoreArea(metrics, competition) {
  const results = Object.entries(BUSINESS_TYPES).map(([typeId, spec]) => {
    const weights = spec.weights;
    let demand = 0;
    for (const metric in weights) {
      demand += (metrics[metric] || 0) * weights[metric];
    }
    const comp = competition[typeId] != null ? competition[typeId] : 30;
    const opportunity = clip(demand - comp * 0.4);

    const drivers = Object.entries(weights)
      .filter(([, w]) => w > 0)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 2)
      .map(([metric]) => METRIC_LABELS[metric]);

    return {
      type_id: typeId,
      name: spec.name,
      icon: spec.icon,
      description: spec.description,
      demand_score: Math.round(demand * 10) / 10,
      competition_index: Math.round(comp * 10) / 10,
      opportunity_score: Math.round(opportunity * 10) / 10,
      top_drivers: drivers,
    };
  });

  results.sort((a, b) => b.opportunity_score - a.opportunity_score);
  return results;
}

module.exports = { BUSINESS_TYPES, METRIC_LABELS, scoreArea };
