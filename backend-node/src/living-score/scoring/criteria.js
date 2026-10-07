"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SCORE_BANDS = exports.BAND_KEYS = exports.MISSING_CRITERIA = exports.CRITERIA = exports.CRITERION_KEYS = void 0;
exports.isCriterionKey = isCriterionKey;
exports.CRITERION_KEYS = [
    'transportation',
    'education',
    'healthcare',
    'greenSpace',
    'amenities',
];
/**
 * Single source of truth for the criteria and their default weights.
 * The UI reads this through GET /api/scoring/criteria instead of hard-coding it.
 * For every criterion a higher score is better. Scores are relative between the areas (100 = the best area).
 */
exports.CRITERIA = [
    {
        key: 'transportation',
        label: 'Giao thông',
        labelEn: 'Transportation',
        description: 'Ga metro đang khai thác và điểm dừng xe buýt trong bán kính 1,5 km (OpenStreetMap).',
        descriptionEn: 'Metro stations in service and bus stops within 1.5 km (OpenStreetMap).',
        defaultWeight: 25,
    },
    {
        key: 'education',
        label: 'Giáo dục',
        labelEn: 'Education',
        description: 'Số trường học các cấp, trường mầm non và cơ sở đào tạo trong bán kính 1,5 km (OpenStreetMap).',
        descriptionEn: 'Schools, kindergartens and colleges within 1.5 km (OpenStreetMap).',
        defaultWeight: 20,
    },
    {
        key: 'healthcare',
        label: 'Y tế',
        labelEn: 'Healthcare',
        description: 'Số bệnh viện và phòng khám trong bán kính 1,5 km (OpenStreetMap).',
        descriptionEn: 'Hospitals and clinics within 1.5 km (OpenStreetMap).',
        defaultWeight: 15,
    },
    {
        key: 'greenSpace',
        label: 'Không gian xanh',
        labelEn: 'Green space',
        description: 'Tỷ lệ diện tích công viên và hồ ao trong bán kính 1,5 km (OpenStreetMap).',
        descriptionEn: 'Share of parks and lakes within 1.5 km (OpenStreetMap).',
        defaultWeight: 15,
    },
    {
        key: 'amenities',
        label: 'Tiện ích',
        labelEn: 'Amenities',
        description: 'Siêu thị, cửa hàng tiện lợi, chợ, trung tâm thương mại và quán cà phê trong bán kính 1,5 km (OpenStreetMap).',
        descriptionEn: 'Supermarkets, convenience stores, markets, malls and cafés within 1.5 km (OpenStreetMap).',
        defaultWeight: 25,
    },
];
/**
 * Criteria users often ask about but that have no open per-area data yet. They are shown as "no data"
 * and left out of the Living Score, instead of being guessed.
 */
exports.MISSING_CRITERIA = [
    { key: 'safety', label: 'An ninh', labelEn: 'Safety', reason: 'Chưa có dữ liệu mở về an ninh, trật tự theo khu vực.', reasonEn: 'No open data on safety per area yet.' },
    { key: 'environment', label: 'Môi trường', labelEn: 'Environment', reason: 'Chưa có dữ liệu mở về chất lượng không khí, tiếng ồn theo khu vực.', reasonEn: 'No open data on air quality or noise per area yet.' },
    { key: 'cost', label: 'Chi phí', labelEn: 'Cost', reason: 'Chưa có dữ liệu giá thuê, giá bán có nguồn đáng tin theo khu vực.', reasonEn: 'No reliable rent or price data per area yet.' },
];
exports.BAND_KEYS = ['excellent', 'good', 'fair', 'low'];
/** Ordered from the highest band to the lowest. */
exports.SCORE_BANDS = [
    { key: 'excellent', min: 75, label: 'Rất đáng sống', labelEn: 'Very liveable' },
    { key: 'good', min: 65, label: 'Đáng sống', labelEn: 'Liveable' },
    { key: 'fair', min: 50, label: 'Trung bình', labelEn: 'Average' },
    { key: 'low', min: 0, label: 'Cần cân nhắc', labelEn: 'Think twice' },
];
function isCriterionKey(value) {
    return exports.CRITERION_KEYS.includes(value);
}
