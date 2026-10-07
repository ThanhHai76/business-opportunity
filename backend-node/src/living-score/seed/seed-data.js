"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSeedData = getSeedData;
exports.dataInfo = dataInfo;
exports.AREA_DEFINITIONS = exports.DATA_INFO = void 0;
/**
 * Living Score data, computed from an OpenStreetMap snapshot (data/osm-hanoi.json, `npm run data:living`).
 *
 * - Areas: thirteen areas around the centres of former urban districts (before the 2025 reorganisation of
 *   administrative units, which removed the district level). Their outlines are illustrative cells, NOT
 *   administrative boundaries; each area also lists the new (2025) wards its measuring circle falls in.
 * - Five criteria are measured from OSM within WALK_KM of each area's centre (what someone living there can reach
 *   on foot): places, park and lake share of that circle, metro stations and bus stops. Measuring a fixed circle
 *   keeps large, partly rural areas comparable with small central ones. Each score is relative: 100 = the highest
 *   of the areas. Safety, environment and cost have no open per-area data, so they are not scored at all
 *   (see MISSING_CRITERIA) rather than guessed.
 * - Text is bilingual ({ vi, en }); the services pick the language of the request.
 * - Places shown on the map are the named OSM places inside each area's cell.
 */
const text_1 = require("../common/text");
const geometry_1 = require("./geometry");
const osm = require("../data/osm-hanoi.json");

exports.AREA_DEFINITIONS = [
    { slug: 'cau-giay', name: 'Cầu Giấy', nameEn: 'Cau Giay', center: [105.796, 21.0333], radiusKm: 2.8 },
    { slug: 'tay-ho', name: 'Tây Hồ', nameEn: 'Tay Ho', center: [105.8285, 21.0655], radiusKm: 3.5 },
    { slug: 'ba-dinh', name: 'Ba Đình', nameEn: 'Ba Dinh', center: [105.815, 21.0355], radiusKm: 2.4 },
    { slug: 'hoan-kiem', name: 'Hoàn Kiếm', nameEn: 'Hoan Kiem', center: [105.8542, 21.0285], radiusKm: 1.6 },
    { slug: 'dong-da', name: 'Đống Đa', nameEn: 'Dong Da', center: [105.8285, 21.0175], radiusKm: 2.2 },
    { slug: 'hai-ba-trung', name: 'Hai Bà Trưng', nameEn: 'Hai Ba Trung', center: [105.8555, 21.0055], radiusKm: 2 },
    { slug: 'thanh-xuan', name: 'Thanh Xuân', nameEn: 'Thanh Xuan', center: [105.81, 20.993], radiusKm: 2.4 },
    { slug: 'hoang-mai', name: 'Hoàng Mai', nameEn: 'Hoang Mai', center: [105.8455, 20.978], radiusKm: 3.2 },
    { slug: 'bac-tu-liem', name: 'Bắc Từ Liêm', nameEn: 'Bac Tu Liem', center: [105.768, 21.066], radiusKm: 3.6 },
    { slug: 'nam-tu-liem', name: 'Nam Từ Liêm', nameEn: 'Nam Tu Liem', center: [105.765, 21.013], radiusKm: 3.6 },
    { slug: 'long-bien', name: 'Long Biên', nameEn: 'Long Bien', center: [105.89, 21.045], radiusKm: 5.5 },
    { slug: 'ha-dong', name: 'Hà Đông', nameEn: 'Ha Dong', center: [105.77, 20.96], radiusKm: 5.5 },
    { slug: 'dong-anh', name: 'Đông Anh', nameEn: 'Dong Anh', center: [105.845, 21.14], radiusKm: 8 },
];
const AREAS = exports.AREA_DEFINITIONS;
const N = AREAS.length;

/** OSM place types counted by each criterion. */
const GROUPS = {
    education: ['school', 'kindergarten', 'college', 'university'],
    healthcare: ['hospital', 'clinic'],
    amenities: ['supermarket', 'convenience', 'mall', 'marketplace', 'cafe'],
};
/** OSM types shown as map points, grouped into the four amenity types of the API. */
const MAP_TYPE = {
    school: 'school', kindergarten: 'school', college: 'school', university: 'school',
    hospital: 'hospital', clinic: 'hospital',
    supermarket: 'shopping', mall: 'shopping', marketplace: 'shopping',
};
const INTERNATIONAL = /quoc te|international|intl/;
/** Radius (km) around an area's centre in which places are counted: about a 20-minute walk. */
const WALK_KM = 1.5;
/** A new ward is listed for an area when it covers at least this share of the measuring circle. */
const WARD_MIN_PCT = 8;

const round1 = (n) => Math.round(n * 10) / 10;
const fmt = {
    vi: (n) => round1(n).toLocaleString('vi-VN', { maximumFractionDigits: 1 }),
    en: (n) => round1(n).toLocaleString('en-US', { maximumFractionDigits: 1 }),
};
const osmDate = {
    vi: osm.osmBase ? osm.osmBase.slice(0, 10).split('-').reverse().join('/') : 'không rõ',
    en: osm.osmBase ? osm.osmBase.slice(0, 10) : 'unknown',
};

const DATA_INFO_TEXT = {
    vi: {
        method: `Đếm địa điểm và đo diện tích công viên, hồ ao trên OpenStreetMap trong bán kính 1,5 km (khoảng 20 phút đi bộ) quanh trung tâm mỗi khu vực. Điểm là tương đối giữa ${N} khu vực: 100 = khu vực cao nhất, theo thang căn bậc hai (địa điểm đầu tiên gần nhà có giá trị hơn địa điểm thứ một trăm). An ninh, môi trường và chi phí chưa có dữ liệu mở theo khu vực nên không được tính.`,
        caveat: 'OpenStreetMap do cộng đồng đóng góp nên có thể thiếu địa điểm, nhất là ở vùng ven; số liệu phù hợp để so sánh tương đối giữa các khu vực, không phải thống kê chính thức.',
        areaNote: 'Khu vực quanh trung tâm các quận cũ (trước khi sắp xếp đơn vị hành chính năm 2025); vùng tô màu là hình minh hoạ, không phải địa giới hành chính. Mỗi khu vực ghi kèm các phường mới mà vùng đo đi qua.',
    },
    en: {
        method: `Places are counted, and park and lake areas measured, on OpenStreetMap within 1.5 km (about a 20-minute walk) of each area's centre. Scores are relative between the ${N} areas: 100 = the best area, on a square-root scale (the first places near home matter more than the hundredth). Safety, environment and cost have no open per-area data, so they are not scored.`,
        caveat: 'OpenStreetMap is built by volunteers and can miss places, especially on the outskirts; the figures are for comparing areas with each other, not official statistics.',
        areaNote: 'Areas around the centres of the former districts (before the 2025 reorganisation of administrative units); the shaded shapes are illustrative, not administrative boundaries. Each area lists the new wards its measuring circle falls in.',
    },
};
/** Where the numbers come from, in the requested language. */
function dataInfo(lang = 'vi') {
    return {
        source: 'OpenStreetMap contributors',
        license: 'ODbL 1.0',
        licenseUrl: 'https://www.openstreetmap.org/copyright',
        osmDate: osm.osmBase,
        walkKm: WALK_KM,
        areaCount: N,
        ...DATA_INFO_TEXT[lang === 'en' ? 'en' : 'vi'],
    };
}
/** Vietnamese data info (kept for callers that do not localise). */
exports.DATA_INFO = dataInfo('vi');

/** Ray-casting point-in-polygon on a [lng, lat] ring. */
function inRing([x, y], ring) {
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const [xi, yi] = ring[i];
        const [xj, yj] = ring[j];
        if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
}

function ringAreaKm2(ring, frame) {
    const pts = ring.map((p) => frame.project(p));
    let sum = 0;
    for (let i = 0; i < pts.length - 1; i++) sum += pts[i][0] * pts[i + 1][1] - pts[i + 1][0] * pts[i][1];
    return Math.abs(sum) / 2;
}

/**
 * Relative 0-100 score: 100 for the highest value among the areas, on a square-root scale — the first cafés,
 * schools or bus stops near home matter more than the hundredth, so one very dense area does not flatten the rest.
 */
const relative = (values) => {
    const max = Math.max(...values);
    return values.map((v) => (max > 0 ? Math.round(100 * Math.sqrt(v / max)) : 0));
};

/** Distance in km between two [lng, lat] points (equirectangular — fine within a city). */
function distanceKm([lng1, lat1], [lng2, lat2]) {
    const kx = 111.32 * Math.cos((((lat1 + lat2) / 2) * Math.PI) / 180);
    return Math.hypot((lng2 - lng1) * kx, (lat2 - lat1) * 110.574);
}

/** Calls visit(index) for every raster cell whose centre lies within the walking circle. */
function forEachCellInCircle(center, rows, cols, visit) {
    const { cellDeg, south, west } = osm.raster;
    const dLat = WALK_KM / 110.574;
    const dLng = WALK_KM / (111.32 * Math.cos((center[1] * Math.PI) / 180));
    for (let r = Math.floor((center[1] - dLat - south) / cellDeg); r <= Math.floor((center[1] + dLat - south) / cellDeg); r++) {
        for (let c = Math.floor((center[0] - dLng - west) / cellDeg); c <= Math.floor((center[0] + dLng - west) / cellDeg); c++) {
            if (r < 0 || c < 0 || r >= rows || c >= cols) continue;
            if (distanceKm(center, [west + (c + 0.5) * cellDeg, south + (r + 0.5) * cellDeg]) > WALK_KM) continue;
            visit(r * cols + c);
        }
    }
}
const decoded = new Map();
function decode(base64) {
    if (!decoded.has(base64)) decoded.set(base64, Buffer.from(base64, 'base64'));
    return decoded.get(base64);
}

/** Share (%) of the walking circle covered by a coverage raster (parks, water). */
function coveragePct(layer, center) {
    const bits = decode(layer.bits);
    let total = 0;
    let set = 0;
    forEachCellInCircle(center, layer.rows, layer.cols, (i) => {
        total++;
        if (bits[i >> 3] & (1 << (i & 7))) set++;
    });
    return total ? round1((100 * set) / total) : 0;
}

/** New (2025) wards the walking circle falls in, largest share first: [{ name, pct }]. */
function wardsOf(center) {
    const wards = osm.wards;
    if (!wards) return [];
    const cells = decode(wards.raster.cells);
    const counts = new Map();
    let total = 0;
    forEachCellInCircle(center, wards.raster.rows, wards.raster.cols, (i) => {
        total++;
        if (cells[i]) counts.set(cells[i], (counts.get(cells[i]) ?? 0) + 1);
    });
    return [...counts.entries()]
        .map(([code, n]) => ({ name: wards.names[code - 1], pct: Math.round((100 * n) / total) }))
        .filter((w) => w.pct >= WARD_MIN_PCT)
        .sort((a, b) => b.pct - a.pct);
}
/** "Phường Láng" -> "Láng ward", "Xã Đông Anh" -> "Đông Anh commune". */
function wardNameEn(name) {
    const m = /^(Phường|Xã)\s+(.+)$/.exec(name);
    return m ? `${m[2]} ${m[1] === 'Phường' ? 'ward' : 'commune'}` : name;
}

/** Raw measurements within WALK_KM of an area's centre, from the OSM snapshot. */
function measure(center) {
    const near = (point) => distanceKm(center, point) <= WALK_KM;
    const inside = osm.pois.filter(([, lng, lat]) => near([lng, lat]));
    const count = (types) => inside.filter(([t]) => types.includes(t)).length;
    const parks = osm.parks.filter(([lng, lat]) => near([lng, lat]));
    // Named lakes that reach into the circle: centre within the walking radius plus the lake's own radius.
    const lakes = osm.lakes
        .filter(([lng, lat, m2]) => distanceKm(center, [lng, lat]) <= WALK_KM + Math.sqrt(m2 / Math.PI) / 1000)
        .sort((a, b) => b[2] - a[2])
        .map((l) => l[3]);
    const metro = inside.filter(([t]) => t === 'metro').map((p) => p[3]);
    const international = inside.filter(([t, , , name]) => GROUPS.education.includes(t) && name && INTERNATIONAL.test((0, text_1.normalizeText)(name))).length;
    return {
        education: count(GROUPS.education),
        healthcare: count(GROUPS.healthcare),
        amenities: count(GROUPS.amenities),
        cafes: count(['cafe']),
        busStops: count(['bus']),
        metroStations: metro,
        parks: parks.length,
        lakes: [...new Set(lakes)].slice(0, 3),
        // Share of the walking circle covered by parks / by lakes and ponds (rivers and canals excluded).
        parkPct: coveragePct(osm.raster.park, center),
        waterPct: coveragePct(osm.raster.water, center),
        internationalSchools: international,
        wards: wardsOf(center),
    };
}

/**
 * Schematic metro lines and stations (approximate routes). Other modules (Future Map, Business Copilot,
 * Property Intelligence) draw from this; the Living Score map uses `metro` below, built from OSM.
 */
function buildInfrastructure() {
    const line = (name, status, coordinates) => ({
        name,
        kind: 'metro_line',
        status,
        geometry: { type: 'LineString', coordinates },
    });
    const station = (name, status, lng, lat) => ({
        name,
        kind: 'metro_station',
        status,
        geometry: { type: 'Point', coordinates: [lng, lat] },
    });
    const line2A = [
        ['Cát Linh', 105.8265, 21.0289],
        ['La Thành', 105.8225, 21.0243],
        ['Thái Hà', 105.8206, 21.0162],
        ['Láng', 105.8132, 21.0087],
        ['Thượng Đình', 105.8095, 20.9998],
        ['Vành Đai 3', 105.8045, 20.9925],
        ['Phùng Khoang', 105.7935, 20.9852],
        ['Văn Quán', 105.7887, 20.9795],
        ['Hà Đông', 105.7745, 20.9694],
        ['La Khê', 105.7682, 20.9628],
        ['Văn Khê', 105.7627, 20.9585],
        ['Yên Nghĩa', 105.7396, 20.9459],
    ];
    const line3Elevated = [
        ['Nhổn', 105.7313, 21.05],
        ['Minh Khai', 105.7401, 21.0451],
        ['Phú Diễn', 105.7479, 21.0434],
        ['Cầu Diễn', 105.7563, 21.0393],
        ['Lê Đức Thọ', 105.7635, 21.0368],
        ['Đại học Quốc gia', 105.7823, 21.0383],
        ['Chùa Hà', 105.791, 21.0342],
        ['Cầu Giấy', 105.7985, 21.0333],
    ];
    const line3Underground = [
        ['Kim Mã', 105.816, 21.0308],
        ['Hà Nội', 105.8412, 21.0245],
    ];
    const toCoords = (rows) => rows.map(([, lng, lat]) => [lng, lat]);
    return [
        line('Tuyến 2A Cát Linh – Hà Đông', 'operating', toCoords(line2A)),
        ...line2A.map(([name, lng, lat]) => station(`Ga ${name}`, 'operating', lng, lat)),
        line('Tuyến 3 Nhổn – Cầu Giấy (trên cao)', 'operating', toCoords(line3Elevated)),
        ...line3Elevated.map(([name, lng, lat]) => station(`Ga ${name}`, 'operating', lng, lat)),
        line('Tuyến 3 Cầu Giấy – Ga Hà Nội (ngầm)', 'under_construction', [
            [105.7985, 21.0333],
            [105.816, 21.0308],
            [105.8265, 21.0289],
            [105.8412, 21.0245],
        ]),
        ...line3Underground.map(([name, lng, lat]) => station(`Ga ${name}`, 'under_construction', lng, lat)),
        line('Tuyến 2 Nam Thăng Long – Trần Hưng Đạo (dự kiến)', 'planned', [
            [105.7885, 21.079],
            [105.8, 21.068],
            [105.81, 21.056],
            [105.814, 21.042],
            [105.825, 21.033],
            [105.84, 21.029],
            [105.852, 21.024],
            [105.86, 21.016],
        ]),
        line('Tuyến 1 Yên Viên – Ngọc Hồi (dự kiến)', 'planned', [
            [105.935, 21.076],
            [105.91, 21.06],
            [105.885, 21.048],
            [105.86, 21.033],
            [105.844, 21.0245],
            [105.842, 21.015],
            [105.84, 20.995],
            [105.842, 20.975],
            [105.844, 20.95],
            [105.846, 20.925],
            [105.848, 20.906],
        ]),
        station('Ga Yên Viên (dự kiến)', 'planned', 105.935, 21.076),
        station('Ga Ngọc Hồi (dự kiến)', 'planned', 105.848, 20.906),
        station('Ga Nam Thăng Long (dự kiến)', 'planned', 105.7885, 21.079),
    ];
}

/**
 * Metro for the Living Score map: track in service and under construction as mapped on OpenStreetMap, stations
 * in service from OSM, and — only for lines not built yet — the approximate planned routes.
 */
const LINE_NAMES = { T2A: 'Tuyến 2A Cát Linh – Hà Đông', T3: 'Tuyến 3 Nhổn – Cầu Giấy (trên cao)' };
function buildMetro(schematic) {
    const operatingStations = osm.pois.filter(([t]) => t === 'metro').map(([, lng, lat]) => [lng, lat]);
    // OSM also tags some planned routes as subway (e.g. line 2): a line counts as in service only when its track
    // passes at least two stations in service.
    const servesStations = (coords) =>
        operatingStations.filter((st) => coords.some((way) => way.some((p) => distanceKm(p, st) <= 0.15))).length >= 2;
    const osmLines = (osm.metroLines ?? []).filter((l) => l.status !== 'operating' || servesStations(l.coords)).map((l) => ({
        name: l.status === 'operating' ? (LINE_NAMES[l.ref] ?? `Tuyến ${l.ref.replace(/^T/, '')}`) : 'Tuyến 3 Cầu Giấy – Ga Hà Nội (đoạn ngầm đang xây dựng)',
        kind: 'metro_line',
        status: l.status,
        source: 'osm',
        geometry: { type: 'MultiLineString', coordinates: l.coords },
    }));
    if (!osmLines.length) return schematic; // snapshot without metro lines: fall back to the schematic ones
    const stations = osm.pois
        .filter(([t]) => t === 'metro')
        .map(([, lng, lat, name]) => ({ name: `Ga ${name}`, kind: 'metro_station', status: 'operating', source: 'osm', geometry: { type: 'Point', coordinates: [lng, lat] } }));
    const planned = schematic.filter((i) => i.status === 'planned').map((i) => ({ ...i, source: 'plan' }));
    return [...osmLines, ...stations, ...planned];
}

const CRITERION_LABEL = {
    vi: { transportation: 'Giao thông', education: 'Giáo dục', healthcare: 'Y tế', greenSpace: 'Không gian xanh', amenities: 'Tiện ích' },
    en: { transportation: 'Transportation', education: 'Education', healthcare: 'Healthcare', greenSpace: 'Green space', amenities: 'Amenities' },
};

/** Human-readable measurements behind each score (shown next to the score, and given to the AI). */
function metricsOf(m) {
    const vi = `trong bán kính ${fmt.vi(WALK_KM)} km`;
    const en = `within ${fmt.en(WALK_KM)} km`;
    const stations = m.metroStations.join(', ');
    const lakes = m.lakes.join(', ');
    return [
        {
            criterion: 'transportation',
            text: {
                vi: `${m.metroStations.length ? `${m.metroStations.length} ga metro đang khai thác (${stations})` : 'Chưa có ga metro đang khai thác'} và ${m.busStops} điểm dừng xe buýt ${vi}`,
                en: `${m.metroStations.length ? `${m.metroStations.length} metro station${m.metroStations.length > 1 ? 's' : ''} in service (${stations})` : 'No metro station in service'} and ${m.busStops} bus stops ${en}`,
            },
        },
        {
            criterion: 'education',
            text: {
                vi: `${m.education} trường học, trường mầm non và cơ sở đào tạo ${vi}${m.internationalSchools ? `, trong đó ${m.internationalSchools} trường có tên "quốc tế"` : ''}`,
                en: `${m.education} schools, kindergartens and colleges ${en}${m.internationalSchools ? `, ${m.internationalSchools} of them named "international"` : ''}`,
            },
        },
        {
            criterion: 'healthcare',
            text: { vi: `${m.healthcare} cơ sở y tế (bệnh viện, phòng khám) ${vi}`, en: `${m.healthcare} hospitals and clinics ${en}` },
        },
        {
            criterion: 'greenSpace',
            text: {
                vi: `Công viên phủ khoảng ${fmt.vi(m.parkPct)}%, hồ và ao khoảng ${fmt.vi(m.waterPct)}% diện tích ${vi}${lakes ? ` — ${lakes}` : ''}`,
                en: `Parks cover about ${fmt.en(m.parkPct)}% and lakes and ponds about ${fmt.en(m.waterPct)}% of the area ${en}${lakes ? ` — ${lakes}` : ''}`,
            },
        },
        {
            criterion: 'amenities',
            text: {
                vi: `${m.amenities} siêu thị, cửa hàng tiện lợi, chợ, trung tâm thương mại và quán cà phê ${vi}`,
                en: `${m.amenities} supermarkets, convenience stores, markets, malls and cafés ${en}`,
            },
        },
    ];
}

function describe(d, m) {
    const wardsVi = m.wards.map((w) => `${w.name} (${w.pct}%)`).join(', ');
    const wardsEn = m.wards.map((w) => `${wardNameEn(w.name)} (${w.pct}%)`).join(', ');
    return {
        vi: `Khu vực quanh trung tâm quận ${d.name} cũ (trước khi sắp xếp đơn vị hành chính năm 2025). Điểm đo trong bán kính ${fmt.vi(WALK_KM)} km quanh trung tâm, từ dữ liệu OpenStreetMap ngày ${osmDate.vi}.${wardsVi ? ` Vùng đo nằm trong: ${wardsVi}.` : ''}`,
        en: `The area around the centre of the former ${d.nameEn} district (before the 2025 reorganisation of administrative units). Measured within ${fmt.en(WALK_KM)} km of the centre, from OpenStreetMap data of ${osmDate.en}.${wardsEn ? ` The measuring circle lies in: ${wardsEn}.` : ''}`,
    };
}

function buildSeedData() {
    const sites = AREAS.map((d) => ({ id: d.slug, center: d.center, radiusKm: d.radiusKm }));
    const frame = new geometry_1.GeoFrame([105.83, 21.04]);
    const cells = (0, geometry_1.buildIllustrativeCells)(sites, frame);
    const measured = AREAS.map((d) => measure(d.center));
    const areaKm2 = AREAS.map((d) => round1(ringAreaKm2(cells.get(d.slug), frame)));

    // Counts within the walking circle (and park + water share) → relative 0-100 scores.
    const counts = (key) => measured.map((m) => m[key]);
    const bus = relative(counts('busStops'));
    const metro = relative(measured.map((m) => m.metroStations.length));
    const scores = {
        transportation: bus.map((b, i) => Math.round(0.6 * b + 0.4 * metro[i])),
        education: relative(counts('education')),
        healthcare: relative(counts('healthcare')),
        // Water counts half: a lake is open space to walk around, but not somewhere to sit in the shade.
        greenSpace: relative(measured.map((m) => m.parkPct + 0.5 * m.waterPct)),
        amenities: relative(counts('amenities')),
    };
    const rankOf = (key, i) => 1 + scores[key].filter((v) => v > scores[key][i]).length;

    const areas = AREAS.map((d, i) => {
        const m = measured[i];
        const areaScores = {
            transportation: scores.transportation[i],
            education: scores.education[i],
            healthcare: scores.healthcare[i],
            greenSpace: scores.greenSpace[i],
            amenities: scores.amenities[i],
        };
        const metrics = metricsOf(m);
        const keys = Object.keys(CRITERION_LABEL.vi);
        const metricText = (k, lang) => metrics.find((x) => x.criterion === k).text[lang];
        const byScore = [...keys].sort((a, b) => areaScores[b] - areaScores[a]);
        // Top 3 / bottom 3 among the areas; otherwise the area's own strongest / weakest criterion.
        const strong = keys.filter((k) => rankOf(k, i) <= 3);
        const weak = keys.filter((k) => rankOf(k, i) > N - 3);
        const pros = (strong.length ? strong : byScore.slice(0, 1)).map((k) => ({
            vi: `${CRITERION_LABEL.vi[k]}: đứng thứ ${rankOf(k, i)}/${N} khu vực — ${metricText(k, 'vi')}.`,
            en: `${CRITERION_LABEL.en[k]}: ranked ${rankOf(k, i)} of ${N} areas — ${metricText(k, 'en')}.`,
        }));
        const weakest = byScore.at(-1);
        const cons = weak.length
            ? weak.map((k) => ({
                vi: `${CRITERION_LABEL.vi[k]}: đứng thứ ${rankOf(k, i)}/${N} khu vực.`,
                en: `${CRITERION_LABEL.en[k]}: ranked ${rankOf(k, i)} of ${N} areas.`,
            }))
            : [{
                vi: `${CRITERION_LABEL.vi[weakest]} là tiêu chí yếu nhất của khu vực (thứ ${rankOf(weakest, i)}/${N}) — ${metricText(weakest, 'vi')}.`,
                en: `${CRITERION_LABEL.en[weakest]} is the area's weakest criterion (${rankOf(weakest, i)} of ${N}) — ${metricText(weakest, 'en')}.`,
            }];
        return {
            slug: d.slug,
            name: d.name,
            nameEn: d.nameEn,
            // Searching for a new ward ("Phường Láng") finds the areas it falls in.
            searchText: (0, text_1.normalizeText)(`${d.name} ${d.nameEn} ${m.wards.map((w) => w.name).join(' ')}`),
            description: describe(d, m),
            areaKm2: areaKm2[i],
            centroid: { lng: d.center[0], lat: d.center[1] },
            boundary: { type: 'Polygon', coordinates: [cells.get(d.slug)] },
            scores: areaScores,
            metrics,
            facts: {
                metroStations: m.metroStations,
                internationalSchools: m.internationalSchools,
                cafes: m.cafes,
                parkPct: m.parkPct,
                waterPct: m.waterPct,
                lakes: m.lakes,
                busStops: m.busStops,
                wards: m.wards,
            },
            pros,
            cons,
        };
    });

    // Named OSM places inside each area's cell, as map points (unnamed ones are counted, not listed).
    const amenities = AREAS.flatMap((d) => [
        ...osm.pois
            .filter(([t, lng, lat, name]) => MAP_TYPE[t] && name && inRing([lng, lat], cells.get(d.slug)))
            .map(([t, lng, lat, name]) => ({ areaSlug: d.slug, type: MAP_TYPE[t], name, searchText: (0, text_1.normalizeText)(name), lng, lat })),
        ...osm.parks
            .filter(([lng, lat, , name]) => name && inRing([lng, lat], cells.get(d.slug)))
            .map(([lng, lat, , name]) => ({ areaSlug: d.slug, type: 'park', name, searchText: (0, text_1.normalizeText)(name), lng, lat })),
    ]);

    // Knowledge snippets for the AI (Vietnamese; the model answers in the language requested).
    const metricVi = (a, k) => a.metrics.find((x) => x.criterion === k).text.vi;
    const knowledge = areas.flatMap((a) => [
        { areaSlug: a.slug, topic: 'overview', content: `${a.description.vi} ${a.pros.map((p) => p.vi).join(' ')}` },
        { areaSlug: a.slug, topic: 'transport', content: metricVi(a, 'transportation') },
        { areaSlug: a.slug, topic: 'family', content: `${metricVi(a, 'education')}; ${metricVi(a, 'healthcare')}; ${metricVi(a, 'greenSpace')}.` },
        { areaSlug: a.slug, topic: 'lifestyle', content: metricVi(a, 'amenities') },
    ]);
    const infrastructure = buildInfrastructure();
    return { areas, amenities, infrastructure, metro: buildMetro(infrastructure), knowledge };
}
let cached;
/** Deterministic and memoised: every call (and every process) sees the same data. */
function getSeedData() {
    cached ??= buildSeedData();
    return cached;
}
