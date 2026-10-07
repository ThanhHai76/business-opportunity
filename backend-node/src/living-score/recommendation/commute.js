'use strict';
const fs = require('node:fs');
const path = require('node:path');

const FILE = path.join(__dirname, '..', 'data', 'commute.json');

let table;
function load() {
  if (table === undefined) {
    try {
      table = JSON.parse(fs.readFileSync(FILE, 'utf8'));
    } catch {
      table = null; // no table yet (`npm run data:commute`): callers fall back to straight-line distance
    }
  }
  return table;
}

/**
 * Road travel between two areas from the OSRM table: { minutes, km, source } or null when unknown.
 * Driving, free-flow — real rush-hour times are longer.
 */
function roadCommute(fromSlug, toSlug, lang = 'vi') {
  const t = load();
  if (!t) return null;
  const i = t.slugs.indexOf(fromSlug);
  const j = t.slugs.indexOf(toSlug);
  if (i < 0 || j < 0) return null;
  const minutes = t.minutes[i][j];
  const km = t.km[i][j];
  if (minutes === null || km === null) return null;
  return { minutes, km, source: lang === 'en' ? t.sourceEn : t.source };
}

module.exports = { roadCommute };
