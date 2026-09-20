"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HOUSEHOLD_EFFECTS = exports.INTEREST_EFFECTS = exports.INTEREST_KEYS = exports.HOUSEHOLD_LABELS = exports.HOUSEHOLD_TYPES = void 0;
exports.HOUSEHOLD_TYPES = ['single', 'couple', 'family_with_kids'];
exports.HOUSEHOLD_LABELS = {
    single: 'Độc thân',
    couple: 'Cặp đôi',
    family_with_kids: 'Gia đình có con nhỏ',
};
exports.INTEREST_KEYS = [
    'cafes',
    'metro_access',
    'international_schools',
    'high_safety',
    'green_space',
    'quiet_environment',
];
/** How each interest nudges the weight of one criterion. */
exports.INTEREST_EFFECTS = {
    cafes: { criterion: 'amenities', multiplier: 1.3, label: 'Nhiều quán cà phê & tiện ích' },
    metro_access: { criterion: 'transportation', multiplier: 1.3, label: 'Dễ tiếp cận metro' },
    international_schools: { criterion: 'education', multiplier: 1.3, label: 'Gần trường quốc tế' },
    high_safety: { criterion: 'safety', multiplier: 1.4, label: 'Khu vực an ninh cao' },
    green_space: { criterion: 'greenSpace', multiplier: 1.3, label: 'Nhiều cây xanh, công viên' },
    quiet_environment: { criterion: 'environment', multiplier: 1.3, label: 'Môi trường yên tĩnh, trong lành' },
};
/** Household situation multipliers applied on top of the base weights. */
exports.HOUSEHOLD_EFFECTS = {
    single: { transportation: 1.1, amenities: 1.1, cost: 1.1 },
    couple: { amenities: 1.1, safety: 1.05 },
    family_with_kids: { education: 1.4, safety: 1.3, greenSpace: 1.2, healthcare: 1.2 },
};
