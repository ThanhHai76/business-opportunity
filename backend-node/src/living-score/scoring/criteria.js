"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SCORE_BANDS = exports.BAND_KEYS = exports.CRITERIA = exports.CRITERION_KEYS = void 0;
exports.isCriterionKey = isCriterionKey;
exports.CRITERION_KEYS = [
    'transportation',
    'education',
    'healthcare',
    'greenSpace',
    'amenities',
    'safety',
    'environment',
    'cost',
];
/**
 * Single source of truth for the criteria and their default weights.
 * The UI reads this through GET /api/scoring/criteria instead of hard-coding it.
 * For every criterion a higher score is better (for "cost" that means cheaper / more affordable).
 */
exports.CRITERIA = [
    {
        key: 'transportation',
        label: 'Giao thông',
        labelEn: 'Transportation',
        description: 'Kết nối metro/buýt, mật độ đường và mức độ thuận tiện di chuyển.',
        defaultWeight: 20,
    },
    {
        key: 'education',
        label: 'Giáo dục',
        labelEn: 'Education',
        description: 'Số lượng và chất lượng trường học các cấp, cơ sở đào tạo.',
        defaultWeight: 15,
    },
    {
        key: 'healthcare',
        label: 'Y tế',
        labelEn: 'Healthcare',
        description: 'Bệnh viện, phòng khám và khả năng tiếp cận dịch vụ y tế.',
        defaultWeight: 10,
    },
    {
        key: 'greenSpace',
        label: 'Không gian xanh',
        labelEn: 'Green Space',
        description: 'Công viên, hồ nước và mật độ cây xanh.',
        defaultWeight: 10,
    },
    {
        key: 'amenities',
        label: 'Tiện ích',
        labelEn: 'Amenities',
        description: 'Siêu thị, trung tâm thương mại, quán cà phê và dịch vụ hằng ngày.',
        defaultWeight: 15,
    },
    {
        key: 'safety',
        label: 'An ninh',
        labelEn: 'Safety',
        description: 'Mức độ an toàn, trật tự và cảm giác an tâm khi sinh sống.',
        defaultWeight: 10,
    },
    {
        key: 'environment',
        label: 'Môi trường',
        labelEn: 'Environment',
        description: 'Chất lượng không khí, tiếng ồn và mức độ yên tĩnh.',
        defaultWeight: 10,
    },
    {
        key: 'cost',
        label: 'Chi phí',
        labelEn: 'Cost',
        description: 'Mức độ dễ chịu về giá thuê/mua và chi phí sinh hoạt (điểm cao = chi phí thấp).',
        defaultWeight: 10,
    },
];
exports.BAND_KEYS = ['excellent', 'good', 'fair', 'low'];
/** Ordered from the highest band to the lowest. */
exports.SCORE_BANDS = [
    { key: 'excellent', min: 75, label: 'Rất đáng sống' },
    { key: 'good', min: 65, label: 'Đáng sống' },
    { key: 'fair', min: 50, label: 'Trung bình' },
    { key: 'low', min: 0, label: 'Cần cân nhắc' },
];
function isCriterionKey(value) {
    return exports.CRITERION_KEYS.includes(value);
}
