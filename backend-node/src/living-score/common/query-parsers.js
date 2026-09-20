'use strict';
const { badRequest, singleString } = require('./http');
const { AMENITY_TYPES } = require('../data/living.types');
const { CRITERION_KEYS, isCriterionKey } = require('../scoring/criteria');

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const AREA_SORTS = ['score', 'name', 'rent'];

/** "transportation:20,education:15" -> { transportation: 20, education: 15 } (each value 0-100). */
function parseWeights(raw) {
  const value = singleString(raw, 'weights');
  if (value === undefined || value.trim() === '') return undefined;
  const result = {};
  for (const part of value.split(',')) {
    const [key, rawWeight, ...rest] = part.split(':').map((s) => s.trim());
    if (!key || rawWeight === undefined || rest.length > 0 || !isCriterionKey(key)) {
      throw badRequest(
        `Tham số weights không hợp lệ. Dùng dạng "tiêu_chí:giá_trị" với tiêu chí thuộc: ${CRITERION_KEYS.join(', ')}.`,
      );
    }
    const weight = Number(rawWeight);
    if (rawWeight === '' || !Number.isFinite(weight) || weight < 0 || weight > 100) {
      throw badRequest(`Trọng số của "${key}" phải là số từ 0 đến 100.`);
    }
    if (result[key] !== undefined) throw badRequest(`Tiêu chí "${key}" bị lặp trong tham số weights.`);
    result[key] = weight;
  }
  return result;
}

/** "cau-giay,tay-ho" -> ['cau-giay', 'tay-ho'] with size limits. */
function parseSlugList(raw, { min, max }) {
  const value = singleString(raw, 'slugs') ?? '';
  const slugs = [...new Set(value.split(',').map((s) => s.trim()).filter(Boolean))];
  if (slugs.length < min || slugs.length > max) {
    throw badRequest(`Tham số slugs cần từ ${min} đến ${max} khu vực, cách nhau bằng dấu phẩy.`);
  }
  const invalid = slugs.find((s) => !SLUG_PATTERN.test(s));
  if (invalid) throw badRequest(`Slug không hợp lệ: "${invalid}".`);
  return slugs;
}

function parseCriterion(raw) {
  const value = singleString(raw, 'criterion');
  if (value === undefined || value === '') return undefined;
  if (!isCriterionKey(value)) throw badRequest(`criterion phải thuộc: ${CRITERION_KEYS.join(', ')}.`);
  return value;
}

function parseAmenityTypes(raw) {
  const value = singleString(raw, 'types');
  if (value === undefined || value.trim() === '') return undefined;
  const types = [...new Set(value.split(',').map((s) => s.trim()).filter(Boolean))];
  const invalid = types.find((t) => !AMENITY_TYPES.includes(t));
  if (invalid) throw badRequest(`types không hợp lệ: "${invalid}". Cho phép: ${AMENITY_TYPES.join(', ')}.`);
  return types;
}

/** "minLng,minLat,maxLng,maxLat" -> { minLng, minLat, maxLng, maxLat }. */
function parseBbox(raw) {
  const value = singleString(raw, 'bbox');
  if (value === undefined || value.trim() === '') return undefined;
  const parts = value.split(',').map((s) => Number(s.trim()));
  if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n))) {
    throw badRequest('bbox phải có dạng "minLng,minLat,maxLng,maxLat".');
  }
  const [minLng, minLat, maxLng, maxLat] = parts;
  if (
    minLng >= maxLng ||
    minLat >= maxLat ||
    Math.abs(minLng) > 180 ||
    Math.abs(maxLng) > 180 ||
    Math.abs(minLat) > 90 ||
    Math.abs(maxLat) > 90
  ) {
    throw badRequest('bbox không hợp lệ (kiểm tra thứ tự min/max và phạm vi toạ độ).');
  }
  return { minLng, minLat, maxLng, maxLat };
}

function parseSort(raw) {
  const value = singleString(raw, 'sort');
  if (value === undefined || value === '') return 'score';
  if (!AREA_SORTS.includes(value)) throw badRequest(`sort phải thuộc: ${AREA_SORTS.join(', ')}.`);
  return value;
}

/** Trims a free-text query and rejects over-long input. */
function parseSearchText(raw, { max, required = false }) {
  const value = singleString(raw, 'q');
  const text = value?.trim();
  if (!text) {
    if (required) throw badRequest('Thiếu từ khoá tìm kiếm (q).');
    return undefined;
  }
  if (text.length > max) throw badRequest(`Từ khoá tìm kiếm tối đa ${max} ký tự.`);
  return text;
}

/** Validates a slug used as a path or query parameter. */
function parseSlug(value, name = 'Slug khu vực') {
  if (typeof value !== 'string' || value.length > 80 || !SLUG_PATTERN.test(value)) {
    throw badRequest(`${name} không hợp lệ.`);
  }
  return value;
}

module.exports = {
  parseWeights,
  parseSlugList,
  parseCriterion,
  parseAmenityTypes,
  parseBbox,
  parseSort,
  parseSearchText,
  parseSlug,
};
