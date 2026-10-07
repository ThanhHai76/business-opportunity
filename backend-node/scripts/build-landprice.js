'use strict';
/**
 * Official land prices of Hanoi (2026) by ward — from the land price table of Resolution 52/2025/NQ-HĐND.
 *
 *   npm run data:landprice [-- path/to/bang-gia-dat-o-2026-ha-noi.xlsx]
 *     → src/property-intel/data/land-price.json
 *
 * The table (Appendices 01–17) is organised in 17 price zones; each zone lists the wards/communes it applies to and a
 * price per street (or road section) for positions VT1–VT4 (VT1 = plots facing the street). We use the residential
 * VT1 price ("giá đất ở", thousand VND/m², stored here as million VND/m²).
 *
 * Streets are placed in wards with OpenStreetMap: every named road of the zone's wards whose name matches the table
 * is counted in the ward its pieces lie in. A ward's figure is the median (and the maximum) of the VT1 prices of the
 * streets found in it; wards where no street could be matched (mostly communes, whose table rows describe road
 * sections rather than street names) get their zone's median and are flagged `zoneOnly`.
 *
 * The workbook is the transcription of the appendices published by thuviennhadat.vn (downloaded when no path is given).
 */
const fs = require('node:fs');
const path = require('node:path');
const { readXlsx } = require('./lib/xlsx-lite');
const WARDS = require('../src/opportunity/data/hanoi-wards.json').wards;

const XLSX_URL = 'https://cdn.thuviennhadat.vn/upload/hinh-anh-bai-viet/TTR/thang-12-2025/06/bang-gia-dat-o-2026-ha-noi.xlsx';
const OUT = path.join(__dirname, '..', 'src', 'property-intel', 'data', 'land-price.json');
const ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
];
const UA = 'hanoi100-property-intel/1.0 (data snapshot)';

const fold = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd').toLowerCase().replace(/\s+/g, ' ').trim();
const round1 = (n) => Math.round(n * 10) / 10;
const median = (values) => {
  const v = [...values].sort((a, b) => a - b);
  return v.length ? (v.length % 2 ? v[(v.length - 1) / 2] : (v[v.length / 2 - 1] + v[v.length / 2]) / 2) : null;
};

/** Table cells mix numbers (96.249 = 96,249 thousand VND), Vietnamese-formatted text ("17.910") and raw thousands (974). */
function price(cell) {
  const n = typeof cell === 'number' ? cell : typeof cell === 'string' ? Number(cell.trim().replace(/\s/g, '')) : NaN;
  if (!Number.isFinite(n) || n <= 0) return null;
  return n > 800 ? n / 1000 : n; // raw thousands: the highest legitimate VT1 is ~702 million VND/m²
}

/** "Âu Cơ (Trong đê)" → "âu cơ"; "An Dương Vương (…) đoạn ngoài đê" → "an dương vương". */
function streetKey(name) {
  return String(name)
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\s+(đoạn|từ)\s.*$/i, '')
    .replace(/^[-–\s]+/, '')
    .replace(/^(phố|đường|đại lộ)\s+/i, '')
    .replace(/[:;,.].*$/, '')
    .normalize('NFC')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}
/** Display name: without the section description ("Đường 23B (đoạn từ …)" → "Đường 23B"). */
const shortName = (name) => name.replace(/\s*\(.*$/, '').replace(/\s*[:;].*$/, '').trim();
const osmKey = (name) => streetKey(String(name).replace(/^(phố|đường|đại lộ)\s+/i, ''));

// ---------------------------------------------------------------- the table
function parseZones(sheets) {
  return sheets.map((sheet, i) => {
    const head = sheet.rows.slice(0, 10).map((r) => r.filter(Boolean).join(' '));
    const applies = head.find((t) => /^Áp dụng/i.test(t)) ?? '';
    const wardNames = applies
      .replace(/^.*?(phường|xã)\s*:?\s*/i, '')
      .replace(/[).]+$/, '')
      .split(/,|\svà\s/)
      .map((s) => s.trim().replace(/^(các\s+)?((phường|xã)\s*:?\s*)+/i, '').trim())
      .filter(Boolean);
    // Header row with "VT1": the first VT1 column belongs to "Giá đất ở" (residential).
    const vtRow = sheet.rows.findIndex((r) => r.includes('VT1'));
    const vt1 = sheet.rows[vtRow].indexOf('VT1');
    const nameCol = 1;
    const streets = [];
    let parent = null;
    for (const row of sheet.rows.slice(vtRow + 1)) {
      const name = row[nameCol];
      if (typeof name !== 'string' || !name.trim()) continue;
      const v = price(row[vt1]);
      // Rows with a number in TT start a street; "-" rows and blank-TT rows are its sections.
      if (row[0] !== null && row[0] !== '-' && !/^[IVX]+$/.test(String(row[0]))) parent = name;
      if (v === null) continue;
      const label = row[0] === '-' || row[0] === null ? (parent && !name.startsWith('-') && row[0] === null ? parent : name) : name;
      streets.push({ name: label.replace(/^[-\s]+/, '').trim(), key: streetKey(label), vt1: round1(v) });
    }
    return { zone: i + 1, wardNames, streets };
  });
}

// ---------------------------------------------------------------- OSM roads
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function overpass(query) {
  let lastError;
  for (const [round, url] of [...ENDPOINTS.map((u) => [0, u]), ...ENDPOINTS.map((u) => [1, u])]) {
    if (round === 1) await pause(20_000);
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded', 'user-agent': UA },
        body: new URLSearchParams({ data: query }).toString(),
        signal: AbortSignal.timeout(300_000),
      });
      const text = await res.text();
      if (!res.ok || !text.startsWith('{')) throw new Error(`${url}: HTTP ${res.status} ${text.slice(0, 60).replace(/\s+/g, ' ')}`);
      return { json: JSON.parse(text), url };
    } catch (error) {
      lastError = error;
      console.warn(`Overpass failed (${error.message}); trying again.`);
    }
  }
  throw lastError;
}

function inRing([x, y], ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
const inGeometry = (p, g) => (g.type === 'Polygon' ? [g.coordinates] : g.coordinates).some((poly) => inRing(p, poly[0]) && !poly.slice(1).some((h) => inRing(p, h)));

// ---------------------------------------------------------------- main
async function main() {
  let file = process.argv[2];
  if (!file) {
    file = path.join(require('node:os').tmpdir(), 'bang-gia-dat-o-2026-ha-noi.xlsx');
    console.log('Downloading the land price workbook…');
    const res = await fetch(XLSX_URL, { headers: { 'user-agent': UA } });
    if (!res.ok) throw new Error(`Download failed: HTTP ${res.status}`);
    fs.writeFileSync(file, Buffer.from(await res.arrayBuffer()));
  }
  const zones = parseZones(readXlsx(file));

  const wardByName = new Map(WARDS.map((w) => [fold(w.name.replace(/^(Phường|Xã)\s+/, '')), w]));
  const zoneOfWard = new Map();
  for (const z of zones) {
    for (const n of z.wardNames) {
      // The transcription has typos and cut-off names ("Đồng Đa", "Lán"): exact match first, then a unique prefix.
      const key = fold(n) === 'dong da' ? 'dong da' : fold(n);
      const prefixed = [...wardByName.keys()].filter((k) => k.startsWith(key));
      const w = wardByName.get(key) ?? (prefixed.length === 1 ? wardByName.get(prefixed[0]) : null);
      if (w && !zoneOfWard.has(w.slug)) zoneOfWard.set(w.slug, z.zone);
    }
  }

  const xs = WARDS.flatMap((w) => (w.geometry.type === 'Polygon' ? [w.geometry.coordinates] : w.geometry.coordinates).flatMap((p) => p[0]));
  const bbox = [Math.min(...xs.map((p) => p[1])), Math.min(...xs.map((p) => p[0])), Math.max(...xs.map((p) => p[1])), Math.max(...xs.map((p) => p[0]))].map((n) => n.toFixed(3));
  console.log('Downloading named roads from OpenStreetMap…');
  const roads = await overpass(`[out:json][timeout:240];way["highway"]["name"](${bbox.join(',')});out center tags;`);
  const byKey = new Map();
  for (const e of roads.json.elements) {
    if (!e.center) continue;
    for (const tag of ['name', 'name:vi', 'alt_name', 'old_name']) {
      if (!e.tags?.[tag]) continue;
      const key = osmKey(e.tags[tag]);
      if (!byKey.has(key)) byKey.set(key, []);
      byKey.get(key).push([e.center.lon, e.center.lat]);
    }
  }

  // Street → wards of its zone that its OSM pieces lie in.
  const perWard = new Map();
  let matchedStreets = 0;
  for (const z of zones) {
    const zoneWards = WARDS.filter((w) => zoneOfWard.get(w.slug) === z.zone);
    const best = new Map(); // key → highest VT1 of its sections
    for (const s of z.streets) if (!best.has(s.key) || best.get(s.key).vt1 < s.vt1) best.set(s.key, s);
    for (const [key, s] of best) {
      const points = byKey.get(key);
      if (!points) continue;
      const hit = new Set(zoneWards.filter((w) => points.some((p) => inGeometry(p, w.geometry))).map((w) => w.slug));
      if (hit.size) matchedStreets += 1;
      for (const slug of hit) {
        if (!perWard.has(slug)) perWard.set(slug, []);
        perWard.get(slug).push({ name: shortName(s.name), vt1: s.vt1 });
      }
    }
  }

  const zoneStats = zones.map((z) => {
    const v = z.streets.map((s) => s.vt1);
    return { zone: z.zone, wards: z.wardNames, rows: z.streets.length, medianVT1: round1(median(v)), maxVT1: round1(Math.max(...v)) };
  });
  const wards = {};
  for (const w of WARDS) {
    const zone = zoneOfWard.get(w.slug) ?? null;
    const list = (perWard.get(w.slug) ?? []).sort((a, b) => b.vt1 - a.vt1);
    if (list.length >= 3) {
      wards[w.slug] = { zone, medianVT1: round1(median(list.map((s) => s.vt1))), maxVT1: list[0].vt1, streets: list.length, top: list.slice(0, 5), zoneOnly: false };
    } else if (zone) {
      const z = zoneStats[zone - 1];
      wards[w.slug] = { zone, medianVT1: z.medianVT1, maxVT1: list[0]?.vt1 ?? z.maxVT1, streets: list.length, top: list.slice(0, 5), zoneOnly: true };
    } else {
      wards[w.slug] = null;
    }
  }

  const out = {
    source: 'Nghị quyết 52/2025/NQ-HĐND (26/11/2025) — bảng giá đất áp dụng từ 01/01/2026; giá đất ở VT1 (mặt đường), triệu đồng/m²',
    workbook: XLSX_URL,
    osmBase: roads.json.osm3s?.timestamp_osm_base ?? null,
    generatedAt: new Date().toISOString(),
    unit: 'million VND per m²',
    zones: zoneStats,
    wards,
  };
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, `${JSON.stringify(out)}\n`);
  const values = Object.values(wards).filter(Boolean);
  console.log(
    `Wrote ${path.relative(process.cwd(), OUT)}: ${zones.length} zones, ${zones.reduce((s, z) => s + z.streets.length, 0)} priced rows, ` +
      `${matchedStreets} streets placed with OSM; ${values.filter((v) => !v.zoneOnly).length} wards from their own streets, ` +
      `${values.filter((v) => v.zoneOnly).length} from the zone median, ${Object.values(wards).filter((v) => !v).length} without a zone.`,
  );
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}

module.exports = { price, streetKey, parseZones };
