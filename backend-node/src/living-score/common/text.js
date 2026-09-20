"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeText = normalizeText;
exports.round1 = round1;
exports.clamp = clamp;
/**
 * Lower-cases, strips Vietnamese diacritics and collapses punctuation so that
 * "Cầu Giấy", "cau giay" and "CẦU-GIẤY" all normalise to "cau giay".
 */
function normalizeText(input) {
    return input
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .replace(/đ/gi, 'd')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, ' ')
        .trim();
}
function round1(value) {
    return Math.round(value * 10) / 10;
}
function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
}
