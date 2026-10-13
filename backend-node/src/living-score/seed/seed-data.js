"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSeedData = getSeedData;
exports.dataInfo = dataInfo;
exports.LEGACY_SLUGS = exports.AREA_DEFINITIONS = exports.DATA_INFO = void 0;
/**
 * Living Score data, computed from an OpenStreetMap snapshot (data/osm-hanoi.json, `npm run data:living`).
 *
 * - Areas: the wards and communes of the 2025 reorganisation of administrative units, with their real boundaries —
 *   the same set as the Business Opportunity Map and AI Property Intelligence (src/opportunity/data/hanoi-wards.json),
 *   so a ward has the same slug in all three tools.
 * - Five criteria are measured from OSM within WALK_KM of each ward's centre (what someone living there can reach
 *   on foot): places, park and lake share of that circle, metro stations and bus stops. Measuring a fixed circle
 *   keeps large, partly rural communes comparable with small central wards. Each score is relative: 100 = the highest
 *   of the wards. Safety, environment and cost have no open per-area data, so they are not scored at all
 *   (see MISSING_CRITERIA) rather than guessed.
 * - Text is bilingual ({ vi, en }); the services pick the language of the request.
 * - Places shown on the map are the named OSM places inside each ward's boundary.
 */
const text_1 = require("../common/text");
const osm = require("../data/osm-hanoi.json");
const WARDS = require("../../opportunity/data/hanoi-wards.json").wards;

/** "Phường Láng" -> "Láng ward", "Xã Đông Anh" -> "Đông Anh commune". */
function wardNameEn(name) {
    const m = /^(Phường|Xã)\s+(.+)$/.exec(name);
    return m ? `${m[2]} ${m[1] === 'Phường' ? 'ward' : 'commune'}` : name;
}

/** Even-odd point-in-polygon over a GeoJSON Polygon / MultiPolygon (holes excluded). */
function inGeometry([x, y], geometry) {
    const polygons = geometry.type === 'MultiPolygon' ? geometry.coordinates : [geometry.coordinates];
    return polygons.some((rings) => {
        let inside = false;
        for (const ring of rings) {
            for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
                const [xi, yi] = ring[i];
                const [xj, yj] = ring[j];
                if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
            }
        }
        return inside;
    });
}

/**
 * Centre of the walking circle: the ward's centroid, or — for an oddly shaped ward whose centroid falls outside it —
 * the point of a ~100 m grid inside the ward that lies deepest inside (farthest from any grid point outside).
 */
function centreOf(w) {
    if (inGeometry(w.centroid, w.geometry)) return w.centroid;
    const pts = (w.geometry.type === 'MultiPolygon' ? w.geometry.coordinates.flat(2) : w.geometry.coordinates.flat());
    const [x0, y0, x1, y1] = [Math.min(...pts.map((p) => p[0])), Math.min(...pts.map((p) => p[1])), Math.max(...pts.map((p) => p[0])), Math.max(...pts.map((p) => p[1]))];
    const step = 0.001;
    const inside = [];
    const outside = [];
    for (let x = x0 - step; x <= x1 + step; x += step) {
        for (let y = y0 - step; y <= y1 + step; y += step) (inGeometry([x, y], w.geometry) ? inside : outside).push([x, y]);
    }
    let best = w.centroid;
    let bestDepth = -1;
    for (const p of inside) {
        let depth = Infinity;
        for (const q of outside) depth = Math.min(depth, (p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2);
        if (depth > bestDepth) [best, bestDepth] = [p, depth];
    }
    return [Math.round(best[0] * 1e5) / 1e5, Math.round(best[1] * 1e5) / 1e5];
}

exports.AREA_DEFINITIONS = WARDS.map((w) => ({
    slug: w.slug,
    name: w.name,
    nameEn: wardNameEn(w.name),
    center: centreOf(w),
    boundary: w.geometry,
    areaKm2: w.areaKm2,
    population: w.population ?? null,
}));

/**
 * Before 10/2026 the areas were thirteen illustrative cells around the former district centres. Old links and saved
 * lists keep working: each old slug points to the ward that now contains that centre.
 */
const FORMER_CENTRES = {
    'cau-giay': [105.796, 21.0333], 'tay-ho': [105.8285, 21.0655], 'ba-dinh': [105.815, 21.0355],
    'hoan-kiem': [105.8542, 21.0285], 'dong-da': [105.8285, 21.0175], 'hai-ba-trung': [105.8555, 21.0055],
    'thanh-xuan': [105.81, 20.993], 'hoang-mai': [105.8455, 20.978], 'bac-tu-liem': [105.768, 21.066],
    'nam-tu-liem': [105.765, 21.013], 'long-bien': [105.89, 21.045], 'ha-dong': [105.77, 20.96], 'dong-anh': [105.845, 21.14],
};
exports.LEGACY_SLUGS = Object.fromEntries(Object.entries(FORMER_CENTRES)
    .map(([old, centre]) => [old, exports.AREA_DEFINITIONS.find((a) => inGeometry(centre, a.boundary))?.slug])
    .filter(([, slug]) => slug));
const AREAS = exports.AREA_DEFINITIONS;
const N = AREAS.length;
/** Pros and cons name a criterion when the ward is in the top / bottom tenth for it. */
const EDGE = Math.max(3, Math.round(N / 10));

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
        method: `Đếm địa điểm và đo diện tích công viên, hồ ao trên OpenStreetMap trong bán kính 1,5 km (khoảng 20 phút đi bộ) quanh trung tâm mỗi phường/xã. Điểm là tương đối giữa ${N} phường/xã: 100 = nơi cao nhất, theo thang căn bậc hai (địa điểm đầu tiên gần nhà có giá trị hơn địa điểm thứ một trăm). An ninh, môi trường và chi phí chưa có dữ liệu mở theo khu vực nên không được tính.`,
        caveat: 'OpenStreetMap do cộng đồng đóng góp nên có thể thiếu địa điểm, nhất là ở vùng ven; số liệu phù hợp để so sánh tương đối giữa các phường/xã, không phải thống kê chính thức.',
        areaNote: `${N} phường/xã sau sắp xếp đơn vị hành chính năm 2025, ranh giới theo OpenStreetMap — cùng bộ với Bản đồ cơ hội kinh doanh và AI Property Intelligence. Với xã rộng, vòng đo 1,5 km chỉ phản ánh khu trung tâm.`,
    },
    en: {
        method: `Places are counted, and park and lake areas measured, on OpenStreetMap within 1.5 km (about a 20-minute walk) of each ward's centre. Scores are relative between the ${N} wards and communes: 100 = the best one, on a square-root scale (the first places near home matter more than the hundredth). Safety, environment and cost have no open per-area data, so they are not scored.`,
        caveat: 'OpenStreetMap is built by volunteers and can miss places, especially on the outskirts; the figures are for comparing wards with each other, not official statistics.',
        areaNote: `${N} wards and communes of the 2025 reorganisation of administrative units, boundaries from OpenStreetMap — the same set as the Business Opportunity Map and AI Property Intelligence. For a large commune the 1.5 km circle only reflects its centre.`,
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
    };
}

/**
 * Schematic metro lines and stations (approximate routes). Other modules (Future Map, Property Intelligence,
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

function describe(d) {
    const pop = d.population ? { vi: `, khoảng ${d.population.toLocaleString('vi-VN')} dân`, en: `, about ${d.population.toLocaleString('en-US')} residents` } : { vi: '', en: '' };
    const wide = d.areaKm2 > 15;
    return {
        vi: `${d.name} (đơn vị hành chính từ 2025, ${fmt.vi(d.areaKm2)} km²${pop.vi}). Điểm đo trong bán kính ${fmt.vi(WALK_KM)} km quanh trung tâm, từ dữ liệu OpenStreetMap ngày ${osmDate.vi}.${wide ? ' Phường/xã rộng nên vòng đo chỉ phản ánh khu trung tâm.' : ''}`,
        en: `${d.nameEn} (administrative unit since 2025, ${fmt.en(d.areaKm2)} km²${pop.en}). Measured within ${fmt.en(WALK_KM)} km of its centre, from OpenStreetMap data of ${osmDate.en}.${wide ? ' It is large, so the circle only reflects its centre.' : ''}`,
    };
}

function buildSeedData() {
    const measured = AREAS.map((d) => measure(d.center));

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
        // Top / bottom tenth of the wards; otherwise the ward's own strongest / weakest criterion.
        const strong = keys.filter((k) => rankOf(k, i) <= EDGE);
        const weak = keys.filter((k) => rankOf(k, i) > N - EDGE);
        const pros = (strong.length ? strong : byScore.slice(0, 1)).map((k) => ({
            vi: `${CRITERION_LABEL.vi[k]}: đứng thứ ${rankOf(k, i)}/${N} phường/xã — ${metricText(k, 'vi')}.`,
            en: `${CRITERION_LABEL.en[k]}: ranked ${rankOf(k, i)} of ${N} wards — ${metricText(k, 'en')}.`,
        }));
        const weakest = byScore.at(-1);
        const cons = weak.length
            ? weak.map((k) => ({
                vi: `${CRITERION_LABEL.vi[k]}: đứng thứ ${rankOf(k, i)}/${N} phường/xã.`,
                en: `${CRITERION_LABEL.en[k]}: ranked ${rankOf(k, i)} of ${N} wards.`,
            }))
            : [{
                vi: `${CRITERION_LABEL.vi[weakest]} là tiêu chí yếu nhất ở đây (thứ ${rankOf(weakest, i)}/${N}) — ${metricText(weakest, 'vi')}.`,
                en: `${CRITERION_LABEL.en[weakest]} is its weakest criterion (${rankOf(weakest, i)} of ${N}) — ${metricText(weakest, 'en')}.`,
            }];
        return {
            slug: d.slug,
            name: d.name,
            nameEn: d.nameEn,
            searchText: (0, text_1.normalizeText)(`${d.name} ${d.nameEn}`),
            description: describe(d),
            areaKm2: d.areaKm2,
            centroid: { lng: d.center[0], lat: d.center[1] },
            boundary: d.boundary,
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
                population: d.population,
            },
            pros,
            cons,
        };
    });

    // Named OSM places inside each ward's boundary, as map points (unnamed ones are counted, not listed).
    const bboxOf = (g) => {
        const pts = (g.type === 'MultiPolygon' ? g.coordinates.flat(2) : g.coordinates.flat());
        return [Math.min(...pts.map((p) => p[0])), Math.min(...pts.map((p) => p[1])), Math.max(...pts.map((p) => p[0])), Math.max(...pts.map((p) => p[1]))];
    };
    const named = [
        ...osm.pois.filter(([t, , , name]) => MAP_TYPE[t] && name).map(([t, lng, lat, name]) => ({ type: MAP_TYPE[t], name, lng, lat })),
        ...osm.parks.filter(([, , , name]) => name).map(([lng, lat, , name]) => ({ type: 'park', name, lng, lat })),
    ];
    const amenities = AREAS.flatMap((d) => {
        const [w, s, e, n] = bboxOf(d.boundary);
        return named
            .filter((p) => p.lng >= w && p.lng <= e && p.lat >= s && p.lat <= n && inGeometry([p.lng, p.lat], d.boundary))
            .map((p) => ({ areaSlug: d.slug, ...p, searchText: (0, text_1.normalizeText)(p.name) }));
    });

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
