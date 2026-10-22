'use strict';
/**
 * Driving times between every pair of wards (data/commute.json, built by `npm run data:wardtimes`): OSRM on OpenStreetMap
 * roads, by car, free-flow (no traffic). Used by the career compass: which wards can be reached from home within N minutes.
 */
const fs = require('node:fs');
const path = require('node:path');
const M = require('./model');

const FILE = path.join(__dirname, 'data', 'commute.json');
const DATA = fs.existsSync(FILE) ? JSON.parse(fs.readFileSync(FILE, 'utf8')) : null;
const INDEX = new Map((DATA?.slugs ?? []).map((slug, i) => [slug, i]));

/** Minutes by car from a ward to every ward (itself 0; null: no route), or null when there is no data for the ward. */
function minutesFrom(slug, lang = 'vi') {
  const i = INDEX.get(slug);
  if (i === undefined) return null;
  const row = DATA.minutes[i];
  return {
    from: slug,
    generatedAt: DATA.generatedAt,
    source: lang === 'en' ? DATA.sourceEn : DATA.source,
    license: DATA.license,
    note:
      lang === 'en'
        ? 'By car, free-flow (no traffic), between ward centres: rush hour is usually much longer, and a motorbike is often quicker.'
        : 'Đi ô tô, đường thông thoáng (chưa tính kẹt xe), giữa tâm các phường/xã: giờ cao điểm thường lâu hơn nhiều, xe máy nhiều khi nhanh hơn.',
    minutes: Object.fromEntries(DATA.slugs.map((s, j) => [s, row[j]])),
  };
}

const PLACES = new Map(M.TRAVEL.destinations.map((d) => [d.id, d]));

/**
 * Minutes by car from every ward to one place of work: a ward (the column of the matrix) or one of the reference places
 * (Hồ Gươm, the Cầu Giấy – Duy Tân offices, Nội Bài), whose times come with the ward travel data. Null when unknown.
 */
function minutesTo(target, lang = 'vi') {
  const note =
    lang === 'en'
      ? 'By car, free-flow (no traffic): rush hour is usually much longer, and a motorbike is often quicker.'
      : 'Đi ô tô, đường thông thoáng (chưa tính kẹt xe): giờ cao điểm thường lâu hơn nhiều, xe máy nhiều khi nhanh hơn.';
  const meta = { to: target, generatedAt: DATA?.generatedAt ?? M.TRAVEL.generatedAt, license: DATA?.license ?? M.TRAVEL.license, note };
  if (PLACES.has(target)) {
    const place = PLACES.get(target);
    return {
      ...meta,
      name: lang === 'en' ? place.name.en : place.name.vi,
      source: lang === 'en' ? M.TRAVEL.sourceEn : M.TRAVEL.source,
      minutes: Object.fromEntries(M.WARDS.map((w) => [w.slug, M.TRAVEL.wards[w.slug]?.[target]?.minutes ?? null])),
    };
  }
  const j = INDEX.get(target);
  if (j === undefined) return null;
  return {
    ...meta,
    name: M.WARD_BY_SLUG.get(target)?.name ?? target,
    source: lang === 'en' ? DATA.sourceEn : DATA.source,
    minutes: Object.fromEntries(DATA.slugs.map((s, i) => [s, DATA.minutes[i][j]])),
  };
}

module.exports = { minutesFrom, minutesTo, HAS_DATA: Boolean(DATA) };
