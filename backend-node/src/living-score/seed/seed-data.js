"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSeedData = getSeedData;
const text_1 = require("../common/text");
const geometry_1 = require("./geometry");
const AREA_DEFINITIONS = [
    {
        slug: 'cau-giay',
        name: 'Cầu Giấy',
        nameEn: 'Cau Giay',
        center: [105.796, 21.0333],
        radiusKm: 2.8,
        population: 292000,
        areaKm2: 12.04,
        avgRentVnd: 9_500_000,
        avgPricePerM2Vnd: 78_000_000,
        scores: [88, 90, 72, 55, 92, 78, 55, 45],
        description: 'Khu vực tập trung nhiều văn phòng, trường đại học và toà nhà công nghệ; đi lại thuận tiện nhưng giá thuê cao và ùn tắc giờ cao điểm.',
        pros: ['Gần nhiều trường đại học và công ty công nghệ', 'Kết nối giao thông công cộng tốt, gần tuyến metro số 3'],
        cons: ['Giá thuê cao hơn mặt bằng chung', 'Ùn tắc vào giờ cao điểm'],
        knowledge: {
            transport: 'Cầu Giấy có nhiều tuyến buýt và tuyến metro số 3 chạy qua, thuận tiện đi làm ở khu vực trung tâm và các khu công nghệ.',
            family: 'Khu vực có nhiều trường học các cấp và các trường đại học, phù hợp gia đình ưu tiên giáo dục; giờ cao điểm đưa đón con dễ ùn tắc.',
            lifestyle: 'Quán cà phê, nhà hàng và không gian làm việc chung mọc dày, phù hợp người trẻ và nhân viên văn phòng.',
        },
    },
    {
        slug: 'tay-ho',
        name: 'Tây Hồ',
        nameEn: 'Tay Ho',
        center: [105.823, 21.07],
        radiusKm: 3.5,
        population: 160000,
        areaKm2: 24.0,
        avgRentVnd: 12_000_000,
        avgPricePerM2Vnd: 95_000_000,
        scores: [65, 78, 70, 92, 80, 85, 84, 35],
        description: 'Khu ven Hồ Tây nhiều không gian xanh, cộng đồng người nước ngoài và dịch vụ cao cấp; yên tĩnh nhưng chi phí sinh hoạt cao.',
        pros: ['Không gian xanh và mặt nước rộng', 'Môi trường yên tĩnh, an ninh tốt'],
        cons: ['Chi phí thuê nhà và sinh hoạt cao', 'Giao thông công cộng còn hạn chế'],
        knowledge: {
            transport: 'Di chuyển chủ yếu bằng xe cá nhân hoặc buýt; kết nối trực tiếp bằng metro còn hạn chế.',
            family: 'Có các trường quốc tế và khu dân cư yên tĩnh ven Hồ Tây, phù hợp gia đình muốn môi trường thoáng và an ninh tốt.',
            lifestyle: 'Nhiều quán cà phê, nhà hàng ven hồ và đường đi dạo; cộng đồng người nước ngoài đông, dịch vụ cao cấp.',
        },
    },
    {
        slug: 'ba-dinh',
        name: 'Ba Đình',
        nameEn: 'Ba Dinh',
        center: [105.815, 21.0355],
        radiusKm: 2.4,
        population: 226000,
        areaKm2: 9.21,
        avgRentVnd: 10_500_000,
        avgPricePerM2Vnd: 120_000_000,
        scores: [82, 85, 90, 75, 80, 92, 68, 38],
        description: 'Trung tâm hành chính – chính trị với nhiều cơ quan, đại sứ quán, bệnh viện lớn và khu dân cư ổn định.',
        pros: ['Y tế và giáo dục chất lượng cao', 'An ninh tốt, nhiều cây xanh trên các tuyến phố'],
        cons: ['Giá nhà thuộc nhóm cao', 'Quỹ nhà ở mới hạn chế'],
        knowledge: {
            transport: 'Nhiều tuyến buýt và đường lớn nối vào trung tâm; một số tuyến phố có hạn chế phương tiện vào giờ cao điểm.',
            family: 'Tập trung bệnh viện lớn và trường học lâu năm; khu dân cư ổn định, an ninh tốt.',
            lifestyle: 'Nhiều công viên, hồ và không gian công cộng; nhịp sống yên bình hơn khu Phố cổ.',
        },
    },
    {
        slug: 'hoan-kiem',
        name: 'Hoàn Kiếm',
        nameEn: 'Hoan Kiem',
        center: [105.8542, 21.0285],
        radiusKm: 1.6,
        population: 150000,
        areaKm2: 5.29,
        avgRentVnd: 13_000_000,
        avgPricePerM2Vnd: 180_000_000,
        scores: [90, 80, 88, 60, 95, 80, 50, 25],
        description: 'Trung tâm lịch sử – thương mại quanh Hồ Gươm và Phố cổ; tiện ích dày đặc nhưng đông đúc và giá cao.',
        pros: ['Tiện ích và dịch vụ dày đặc, đi bộ được nhiều nơi', 'Kết nối giao thông công cộng thuận tiện'],
        cons: ['Đông đúc, ồn ào và ô nhiễm không khí', 'Giá thuê và giá bán cao nhất trong nhóm'],
        knowledge: {
            transport: 'Đi bộ, xe đạp và buýt là chính; gần ga đường sắt và nhiều điểm trung chuyển công cộng.',
            family: 'Nhiều trường học truyền thống nhưng không gian sống chật, đông đúc và ồn ào.',
            lifestyle: 'Ẩm thực, cà phê và mua sắm phong phú ngay quanh Hồ Gươm và Phố cổ; phù hợp người thích nhịp sống đô thị sôi động.',
        },
    },
    {
        slug: 'dong-da',
        name: 'Đống Đa',
        nameEn: 'Dong Da',
        center: [105.8285, 21.0175],
        radiusKm: 2.2,
        population: 370000,
        areaKm2: 9.96,
        avgRentVnd: 9_000_000,
        avgPricePerM2Vnd: 95_000_000,
        scores: [85, 82, 85, 50, 88, 72, 48, 50],
        description: 'Quận nội đô đông dân cư, nhiều trường đại học, bệnh viện và chợ truyền thống; mật độ xây dựng cao.',
        pros: ['Nhiều bệnh viện, trường học và chợ', 'Giá thuê thấp hơn Ba Đình và Hoàn Kiếm'],
        cons: ['Mật độ dân cư cao, ít cây xanh', 'Nhiều ngõ nhỏ, khó tìm chỗ đỗ xe'],
        knowledge: {
            transport: 'Nhiều tuyến buýt và đường vành đai đi qua, kết nối tốt tới cả phía Bắc và phía Nam thành phố.',
            family: 'Nhiều trường học, bệnh viện và chợ truyền thống trong bán kính gần; mật độ dân cư cao.',
            lifestyle: 'Ẩm thực đường phố và quán cà phê giá bình dân, phù hợp sinh viên và người đi làm.',
        },
    },
    {
        slug: 'thanh-xuan',
        name: 'Thanh Xuân',
        nameEn: 'Thanh Xuan',
        center: [105.81, 20.993],
        radiusKm: 2.4,
        population: 290000,
        areaKm2: 9.11,
        avgRentVnd: 8_000_000,
        avgPricePerM2Vnd: 70_000_000,
        scores: [78, 72, 70, 55, 75, 70, 55, 62],
        description: 'Khu dân cư đông đúc phía Tây Nam nội đô, nhiều chung cư và tuyến metro số 2A đi qua; giá thuê ở mức trung bình.',
        pros: ['Giá thuê hợp lý so với nội đô', 'Có tuyến metro số 2A và nhiều tuyến buýt'],
        cons: ['Mật độ dân cư cao, thiếu công viên lớn', 'Giờ cao điểm đông đúc'],
        knowledge: {
            transport: 'Có tuyến metro số 2A và nhiều tuyến buýt; di chuyển vào trung tâm khá thuận tiện ngoài giờ cao điểm.',
            family: 'Nhiều chung cư và khu dân cư đông đúc, giá thuê dễ chịu cho gia đình trẻ; công viên lớn còn ít.',
            lifestyle: 'Dịch vụ thiết yếu đầy đủ, nhiều quán ăn bình dân và trung tâm thương mại quanh các trục lớn.',
        },
    },
    {
        slug: 'nam-tu-liem',
        name: 'Nam Từ Liêm',
        nameEn: 'Nam Tu Liem',
        center: [105.765, 21.013],
        radiusKm: 3.6,
        population: 265000,
        areaKm2: 32.17,
        avgRentVnd: 7_500_000,
        avgPricePerM2Vnd: 60_000_000,
        scores: [68, 75, 65, 80, 72, 80, 78, 70],
        description: 'Khu đô thị mới phía Tây với nhiều chung cư, khu thể thao Mỹ Đình và không gian xanh rộng.',
        pros: ['Nhiều khu đô thị mới, không gian thoáng', 'Giá thuê tốt hơn khu trung tâm'],
        cons: ['Phụ thuộc phương tiện cá nhân', 'Hạ tầng dịch vụ chưa đồng đều'],
        knowledge: {
            transport: 'Nằm gần các trục đường lớn phía Tây; nhiều người dùng xe cá nhân, tuyến metro số 3 đang mở rộng kết nối.',
            family: 'Nhiều khu đô thị mới có trường học nội khu, công viên và sân chơi, phù hợp gia đình có con nhỏ.',
            lifestyle: 'Khu thể thao Mỹ Đình và các trung tâm thương mại mới; không gian thoáng, ít đông đúc hơn nội đô.',
        },
    },
    {
        slug: 'long-bien',
        name: 'Long Biên',
        nameEn: 'Long Bien',
        center: [105.89, 21.045],
        radiusKm: 5.5,
        population: 300000,
        areaKm2: 60.38,
        avgRentVnd: 6_000_000,
        avgPricePerM2Vnd: 50_000_000,
        scores: [55, 58, 58, 68, 60, 72, 66, 78],
        description: 'Khu vực bờ Đông sông Hồng đang phát triển với nhiều khu đô thị mới, giá thuê thấp.',
        pros: ['Chi phí thuê thấp', 'Nhiều khu đô thị mới, không gian thoáng'],
        cons: ['Kết nối vào nội đô phụ thuộc các cầu qua sông Hồng', 'Tiện ích và cơ sở y tế còn ít'],
        knowledge: {
            transport: 'Cần qua các cầu bắc qua sông Hồng để vào nội đô; buýt là phương tiện công cộng chính.',
            family: 'Nhiều khu đô thị mới với giá thuê thấp; trường học và cơ sở y tế đang tiếp tục phát triển.',
            lifestyle: 'Không gian xanh ven sông và khu đô thị thoáng đãng; dịch vụ ăn uống, giải trí còn ít hơn nội đô.',
        },
    },
    {
        slug: 'ha-dong',
        name: 'Hà Đông',
        nameEn: 'Ha Dong',
        center: [105.77, 20.96],
        radiusKm: 5.5,
        population: 380000,
        areaKm2: 49.64,
        avgRentVnd: 6_500_000,
        avgPricePerM2Vnd: 55_000_000,
        scores: [72, 66, 70, 62, 68, 68, 60, 74],
        description: 'Quận phía Tây Nam có tuyến metro số 2A (Cát Linh – Hà Đông) và nhiều khu đô thị; chi phí thuê hợp lý.',
        pros: ['Có tuyến metro 2A kết nối nội đô', 'Giá thuê hợp lý'],
        cons: ['Khoảng cách xa trung tâm', 'Ùn tắc trên các trục kết nối vào nội đô'],
        knowledge: {
            transport: 'Có tuyến metro số 2A (Cát Linh – Hà Đông) và nhiều tuyến buýt kết nối với nội đô.',
            family: 'Nhiều khu đô thị và chung cư với mức giá hợp lý; trường học và bệnh viện tập trung dọc các trục chính.',
            lifestyle: 'Trung tâm thương mại và chợ đầu mối phục vụ nhu cầu hằng ngày; nhịp sống thoải mái hơn trung tâm.',
        },
    },
    {
        slug: 'dong-anh',
        name: 'Đông Anh',
        nameEn: 'Dong Anh',
        center: [105.845, 21.14],
        radiusKm: 8,
        population: 430000,
        areaKm2: 182.3,
        avgRentVnd: 4_200_000,
        avgPricePerM2Vnd: 40_000_000,
        scores: [32, 40, 42, 70, 35, 58, 68, 92],
        description: 'Huyện ngoại thành phía Bắc với quỹ đất lớn, giá rẻ; hạ tầng đang phát triển nhưng còn xa trung tâm.',
        pros: ['Chi phí thuê thấp nhất', 'Không gian rộng, mật độ dân cư thấp'],
        cons: ['Xa trung tâm, thời gian di chuyển dài', 'Tiện ích, trường học, y tế còn hạn chế'],
        knowledge: {
            transport: 'Cách trung tâm khá xa, phụ thuộc nhiều vào xe cá nhân; hạ tầng giao thông đang được đầu tư.',
            family: 'Quỹ đất rộng, giá thuê thấp và không gian thoáng; trường học, bệnh viện còn ít và phân tán.',
            lifestyle: 'Dịch vụ tiện ích còn thưa; phù hợp người ưu tiên chi phí thấp và không gian yên tĩnh.',
        },
    },
];
const AMENITY_LABEL = {
    school: 'Trường học',
    hospital: 'Cơ sở y tế',
    park: 'Công viên',
    shopping: 'Trung tâm mua sắm',
};
const formatMillions = (vnd) => `${(vnd / 1_000_000).toLocaleString('vi-VN', { maximumFractionDigits: 1 })} triệu đồng`;
function toScores(tuple) {
    const [transportation, education, healthcare, greenSpace, amenities, safety, environment, cost] = tuple;
    return { transportation, education, healthcare, greenSpace, amenities, safety, environment, cost };
}
function amenityCounts(scores) {
    return {
        school: 2 + Math.floor(scores.education / 30),
        hospital: 1 + Math.floor(scores.healthcare / 45),
        park: 1 + Math.floor(scores.greenSpace / 35),
        shopping: 2 + Math.floor(scores.amenities / 30),
    };
}
function generateAmenities(def, frame, projectedCentres, ownIndex) {
    const rng = (0, geometry_1.mulberry32)((0, geometry_1.hashString)(def.slug));
    const [cx, cy] = projectedCentres[ownIndex];
    const result = [];
    for (const [type, count] of Object.entries(amenityCounts(toScores(def.scores)))) {
        for (let n = 1; n <= count; n++) {
            let point = [cx, cy];
            for (let attempt = 0; attempt < 80; attempt++) {
                const angle = rng() * 2 * Math.PI;
                const distance = Math.sqrt(rng()) * 0.62 * def.radiusKm;
                const candidate = [cx + distance * Math.cos(angle), cy + distance * Math.sin(angle)];
                const nearest = projectedCentres.reduce((best, [px, py], index) => {
                    const d = (candidate[0] - px) ** 2 + (candidate[1] - py) ** 2;
                    return d < best.d ? { d, index } : best;
                }, { d: Infinity, index: -1 });
                if (nearest.index === ownIndex) {
                    point = candidate;
                    break;
                }
            }
            const [lng, lat] = frame.unproject(point);
            const name = `${AMENITY_LABEL[type]} mẫu ${n} – ${def.name}`;
            result.push({
                areaSlug: def.slug,
                type,
                name,
                searchText: (0, text_1.normalizeText)(name),
                rating: Math.round((3.5 + rng() * 1.3) * 10) / 10,
                lng,
                lat,
            });
        }
    }
    return result;
}
/** Illustrative metro geometry (approximate, hand-placed). Verify against official sources before real use. */
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
function buildSeedData() {
    const sites = AREA_DEFINITIONS.map((d) => ({ id: d.slug, center: d.center, radiusKm: d.radiusKm }));
    const frame = new geometry_1.GeoFrame([105.83, 21.04]);
    const cells = (0, geometry_1.buildIllustrativeCells)(sites, frame);
    const projectedCentres = sites.map((s) => frame.project(s.center));
    const areas = AREA_DEFINITIONS.map((d) => ({
        slug: d.slug,
        name: d.name,
        nameEn: d.nameEn,
        searchText: (0, text_1.normalizeText)(`${d.name} ${d.nameEn}`),
        description: d.description,
        population: d.population,
        areaKm2: d.areaKm2,
        avgRentVnd: d.avgRentVnd,
        avgPricePerM2Vnd: d.avgPricePerM2Vnd,
        centroid: { lng: d.center[0], lat: d.center[1] },
        boundary: { type: 'Polygon', coordinates: [cells.get(d.slug)] },
        scores: toScores(d.scores),
        pros: [...d.pros],
        cons: [...d.cons],
    }));
    const amenities = AREA_DEFINITIONS.flatMap((d, index) => generateAmenities(d, frame, projectedCentres, index));
    const knowledge = AREA_DEFINITIONS.flatMap((d) => [
        { areaSlug: d.slug, topic: 'overview', content: d.description },
        {
            areaSlug: d.slug,
            topic: 'cost',
            content: `Giá thuê tham khảo khoảng ${formatMillions(d.avgRentVnd)}/tháng cho căn hộ 1–2 phòng ngủ (dữ liệu mẫu, không phải số liệu chính thức).`,
        },
        { areaSlug: d.slug, topic: 'transport', content: d.knowledge.transport },
        { areaSlug: d.slug, topic: 'family', content: d.knowledge.family },
        { areaSlug: d.slug, topic: 'lifestyle', content: d.knowledge.lifestyle },
    ]);
    return { areas, amenities, infrastructure: buildInfrastructure(), knowledge };
}
let cached;
/** Deterministic and memoised: every call (and every process) sees the same data. */
function getSeedData() {
    cached ??= buildSeedData();
    return cached;
}
