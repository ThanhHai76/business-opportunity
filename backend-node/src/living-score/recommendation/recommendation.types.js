"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HOUSEHOLD_EFFECTS = exports.INTEREST_EFFECTS = exports.INTEREST_KEYS = exports.HOUSEHOLD_LABELS_EN = exports.HOUSEHOLD_LABELS = exports.HOUSEHOLD_TYPES = void 0;
exports.HOUSEHOLD_TYPES = ['single', 'couple', 'family_with_kids'];
exports.HOUSEHOLD_LABELS = {
    single: 'Độc thân',
    couple: 'Cặp đôi',
    family_with_kids: 'Gia đình có con nhỏ',
};
exports.HOUSEHOLD_LABELS_EN = {
    single: 'Single',
    couple: 'Couple',
    family_with_kids: 'Family with young children',
};
exports.INTEREST_KEYS = [
    'cafes',
    'metro_access',
    'international_schools',
    'green_space',
];
/** How each interest nudges the weight of one criterion. */
exports.INTEREST_EFFECTS = {
    cafes: { criterion: 'amenities', multiplier: 1.3, label: 'Nhiều quán cà phê & tiện ích', labelEn: 'Lots of cafés & amenities' },
    metro_access: { criterion: 'transportation', multiplier: 1.3, label: 'Dễ tiếp cận metro', labelEn: 'Easy metro access' },
    international_schools: { criterion: 'education', multiplier: 1.3, label: 'Gần trường quốc tế', labelEn: 'Near international schools' },
    green_space: { criterion: 'greenSpace', multiplier: 1.3, label: 'Nhiều công viên, hồ nước', labelEn: 'Parks and lakes' },
};
/** Household situation multipliers applied on top of the base weights. */
exports.HOUSEHOLD_EFFECTS = {
    single: { transportation: 1.1, amenities: 1.2 },
    couple: { amenities: 1.1, greenSpace: 1.1 },
    family_with_kids: { education: 1.4, greenSpace: 1.2, healthcare: 1.3 },
};
