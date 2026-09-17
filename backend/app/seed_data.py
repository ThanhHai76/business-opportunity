"""Synthetic (mock) demo dataset: 10 real HCMC districts/zones with
hand-authored growth metrics + competition indices, chosen to tell a
believable "where should I open a business" story out of the box.

Replace this module with a real ingestion pipeline (census data, metro
master plan, building permits, POI density from OSM Overpass, etc.) when
moving past the MVP — nothing else in the app needs to change, since
everything downstream only depends on the Area model's fields.
"""
import json
from sqlalchemy.orm import Session
from .models import Area


def _square(lat: float, lng: float, half_lat: float = 0.007, half_lng: float = 0.009):
    """Build a simple closed rectangle ring around a center point — good
    enough to render a plausible-looking zone on the map for a demo."""
    return [
        [
            [lng - half_lng, lat - half_lat],
            [lng + half_lng, lat - half_lat],
            [lng + half_lng, lat + half_lat],
            [lng - half_lng, lat + half_lat],
            [lng - half_lng, lat - half_lat],
        ]
    ]


CITIES = {
    "hcm": "TP. Hồ Chí Minh",
    "hanoi": "Hà Nội",
}

HCM_AREAS = [
    dict(
        slug="vinhomes-grand-park",
        name="Vinhomes Grand Park",
        district="TP. Thủ Đức",
        lat=10.8412, lng=106.8330,
        metrics=dict(population_growth=88, metro_growth=55, apartment_growth=95, school_growth=80, office_growth=25),
        competition=dict(cafe=20, fnb=25, gym=15, education=20, convenience=15, beauty=15, pharmacy=20, petshop=15, realestate=45, laundry=15, bookstore=15, carwash=20),
        summary="Đại đô thị mới hình thành từ 2020, dân cư trẻ đổ về nhanh. Mật độ chung cư và trường học tăng vọt nhưng dịch vụ thương mại chưa theo kịp — nhiều khoảng trống thị trường.",
    ),
    dict(
        slug="thao-dien",
        name="Thảo Điền",
        district="TP. Thủ Đức",
        lat=10.8030, lng=106.7378,
        metrics=dict(population_growth=55, metro_growth=70, apartment_growth=50, school_growth=60, office_growth=65),
        competition=dict(cafe=75, fnb=70, gym=55, education=45, convenience=50, beauty=70, pharmacy=55, petshop=55, realestate=40, laundry=45, bookstore=40, carwash=45),
        summary="Khu chuyên gia nước ngoài lâu năm, hạ tầng Metro số 1 thuận lợi, nhưng phân khúc cafe/F&B/beauty đã khá bão hòa với nhiều thương hiệu lớn.",
    ),
    dict(
        slug="phu-my-hung",
        name="Phú Mỹ Hưng",
        district="Quận 7",
        lat=10.7295, lng=106.7009,
        metrics=dict(population_growth=45, metro_growth=20, apartment_growth=40, school_growth=55, office_growth=70),
        competition=dict(cafe=65, fnb=60, gym=50, education=50, convenience=55, beauty=60, pharmacy=55, petshop=45, realestate=35, laundry=45, bookstore=45, carwash=40),
        summary="Khu đô thị kiểu mẫu đã phát triển ổn định, dân số tăng chậm lại. Khối văn phòng đang mở rộng nhưng bán lẻ - dịch vụ đã tương đối đầy đủ.",
    ),
    dict(
        slug="quan-1",
        name="Trung tâm Quận 1",
        district="Quận 1",
        lat=10.7769, lng=106.7009,
        metrics=dict(population_growth=15, metro_growth=85, apartment_growth=10, school_growth=20, office_growth=90),
        competition=dict(cafe=90, fnb=88, gym=70, education=60, convenience=75, beauty=85, pharmacy=75, petshop=40, realestate=30, laundry=60, bookstore=70, carwash=35),
        summary="Trung tâm hành chính - tài chính, mật độ văn phòng và giá thuê cao nhất thành phố, nhưng gần như bão hòa toàn bộ ngành dịch vụ mặt tiền.",
    ),
    dict(
        slug="binh-thanh",
        name="Vinhomes Central Park",
        district="Quận Bình Thạnh",
        lat=10.7955, lng=106.7218,
        metrics=dict(population_growth=60, metro_growth=50, apartment_growth=75, school_growth=55, office_growth=75),
        competition=dict(cafe=55, fnb=50, gym=45, education=40, convenience=45, beauty=50, pharmacy=50, petshop=40, realestate=50, laundry=45, bookstore=35, carwash=40),
        summary="Khu vực quanh Landmark 81 đang chuyển mình thành trung tâm mới. Chung cư cao cấp và văn phòng tăng nhanh, dịch vụ đi theo nhưng chưa bão hòa.",
    ),
    dict(
        slug="go-vap",
        name="Gò Vấp",
        district="Quận Gò Vấp",
        lat=10.8386, lng=106.6650,
        metrics=dict(population_growth=75, metro_growth=15, apartment_growth=45, school_growth=50, office_growth=25),
        competition=dict(cafe=40, fnb=45, gym=35, education=35, convenience=40, beauty=40, pharmacy=45, petshop=30, realestate=30, laundry=30, bookstore=30, carwash=40),
        summary="Quận đông dân cư trẻ, mật độ nhà trọ và hộ gia đình trẻ cao. Nhu cầu dịch vụ thiết yếu lớn nhưng hạ tầng metro còn hạn chế.",
    ),
    dict(
        slug="tan-binh",
        name="Tân Bình",
        district="Quận Tân Bình",
        lat=10.8014, lng=106.6528,
        metrics=dict(population_growth=40, metro_growth=20, apartment_growth=30, school_growth=30, office_growth=55),
        competition=dict(cafe=55, fnb=55, gym=45, education=35, convenience=50, beauty=50, pharmacy=50, petshop=35, realestate=30, laundry=40, bookstore=40, carwash=40),
        summary="Gần sân bay Tân Sơn Nhất, nhiều văn phòng và cơ quan, dân cư ổn định. Mức độ cạnh tranh dịch vụ ở mức trung bình - cao.",
    ),
    dict(
        slug="quan-7-tay",
        name="Q7 - Nguyễn Văn Linh mở rộng",
        district="Quận 7",
        lat=10.7550, lng=106.6980,
        metrics=dict(population_growth=80, metro_growth=25, apartment_growth=85, school_growth=70, office_growth=35),
        competition=dict(cafe=35, fnb=35, gym=30, education=30, convenience=30, beauty=30, pharmacy=30, petshop=25, realestate=50, laundry=25, bookstore=30, carwash=30),
        summary="Hàng loạt chung cư mới bàn giao 2023-2025, dân số trẻ tăng mạnh, trường học mở rộng theo. Dịch vụ thương mại vẫn còn thưa.",
    ),
    dict(
        slug="binh-tan",
        name="Bình Tân",
        district="Quận Bình Tân",
        lat=10.7652, lng=106.6060,
        metrics=dict(population_growth=85, metro_growth=10, apartment_growth=50, school_growth=45, office_growth=15),
        competition=dict(cafe=25, fnb=30, gym=20, education=25, convenience=30, beauty=25, pharmacy=30, petshop=15, realestate=25, laundry=20, bookstore=20, carwash=30),
        summary="Quận đông dân lao động - công nhân bậc nhất thành phố, sức mua đại chúng lớn. Mật độ cửa hàng dịch vụ hiện đại còn thấp.",
    ),
    dict(
        slug="khu-cong-nghe-cao",
        name="Khu Công nghệ cao",
        district="TP. Thủ Đức",
        lat=10.8410, lng=106.7998,
        metrics=dict(population_growth=50, metro_growth=45, apartment_growth=40, school_growth=25, office_growth=80),
        competition=dict(cafe=30, fnb=35, gym=25, education=20, convenience=30, beauty=25, pharmacy=25, petshop=20, realestate=30, laundry=30, bookstore=20, carwash=25),
        summary="Khu công nghệ cao thu hút hàng chục nghìn kỹ sư, việc làm văn phòng tăng nhanh, nhưng dịch vụ ăn uống - tiện ích quanh khu vẫn còn thiếu.",
    ),
]

HANOI_AREAS = [
    dict(
        slug="vinhomes-ocean-park",
        name="Vinhomes Ocean Park",
        district="Gia Lâm",
        lat=21.0031, lng=105.9330,
        metrics=dict(population_growth=90, metro_growth=20, apartment_growth=95, school_growth=85, office_growth=15),
        competition=dict(cafe=15, fnb=20, gym=10, education=15, convenience=10, beauty=10, pharmacy=15, petshop=12, realestate=45, laundry=12, bookstore=15, carwash=15),
        summary="Đại đô thị mới lớn nhất phía Đông Hà Nội, dân cư trẻ đổ về nhanh từ 2020. Chung cư và trường học tăng vọt nhưng thương mại - dịch vụ vẫn còn rất thưa — khoảng trống thị trường lớn.",
    ),
    dict(
        slug="vinhomes-smart-city",
        name="Vinhomes Smart City",
        district="Nam Từ Liêm",
        lat=21.0140, lng=105.7440,
        metrics=dict(population_growth=88, metro_growth=35, apartment_growth=92, school_growth=80, office_growth=30),
        competition=dict(cafe=20, fnb=22, gym=15, education=18, convenience=15, beauty=12, pharmacy=18, petshop=15, realestate=48, laundry=15, bookstore=18, carwash=18),
        summary="Khu đô thị thông minh phía Tây, quy mô tương đương Ocean Park. Hạ tầng nội khu hiện đại, dân cư tăng nhanh, nhưng dịch vụ bên ngoài các trung tâm thương mại nội khu vẫn còn ít.",
    ),
    dict(
        slug="times-city",
        name="Times City",
        district="Hai Bà Trưng",
        lat=20.9973, lng=105.8663,
        metrics=dict(population_growth=55, metro_growth=25, apartment_growth=50, school_growth=60, office_growth=55),
        competition=dict(cafe=55, fnb=50, gym=45, education=40, convenience=50, beauty=50, pharmacy=50, petshop=40, realestate=35, laundry=42, bookstore=42, carwash=38),
        summary="Khu đô thị đã đi vào ổn định gần chục năm, dân cư đông đúc, tiện ích nội khu đầy đủ. Thị trường dịch vụ xung quanh đã tương đối bão hòa.",
    ),
    dict(
        slug="hoan-kiem",
        name="Phố cổ Hoàn Kiếm",
        district="Hoàn Kiếm",
        lat=21.0285, lng=105.8542,
        metrics=dict(population_growth=10, metro_growth=40, apartment_growth=5, school_growth=15, office_growth=75),
        competition=dict(cafe=92, fnb=90, gym=60, education=45, convenience=70, beauty=85, pharmacy=70, petshop=35, realestate=25, laundry=55, bookstore=75, carwash=30),
        summary="Trung tâm lịch sử - du lịch, giá thuê mặt tiền cao bậc nhất Hà Nội, gần như không còn quỹ đất xây mới. Ngành dịch vụ ăn uống, cà phê đã bão hòa sâu.",
    ),
    dict(
        slug="cau-giay",
        name="Cầu Giấy",
        district="Cầu Giấy",
        lat=21.0333, lng=105.7960,
        metrics=dict(population_growth=45, metro_growth=45, apartment_growth=45, school_growth=40, office_growth=80),
        competition=dict(cafe=65, fnb=62, gym=55, education=45, convenience=55, beauty=58, pharmacy=55, petshop=40, realestate=40, laundry=48, bookstore=45, carwash=42),
        summary="Trung tâm công nghệ - văn phòng của Hà Nội (Keangnam, các tập đoàn CNTT lớn), lượng nhân viên văn phòng tăng liên tục, cạnh tranh dịch vụ ở mức khá cao.",
    ),
    dict(
        slug="tay-ho",
        name="Tây Hồ",
        district="Tây Hồ",
        lat=21.0687, lng=105.8228,
        metrics=dict(population_growth=40, metro_growth=15, apartment_growth=40, school_growth=50, office_growth=45),
        competition=dict(cafe=78, fnb=72, gym=50, education=42, convenience=45, beauty=68, pharmacy=55, petshop=55, realestate=35, laundry=42, bookstore=38, carwash=38),
        summary="Khu vực người nước ngoài và giới trung lưu lâu năm quanh Hồ Tây, cảnh quan đẹp. Phân khúc cafe, nhà hàng, beauty cao cấp đã có rất nhiều thương hiệu.",
    ),
    dict(
        slug="long-bien",
        name="Long Biên",
        district="Long Biên",
        lat=21.0378, lng=105.8850,
        metrics=dict(population_growth=70, metro_growth=20, apartment_growth=68, school_growth=55, office_growth=30),
        competition=dict(cafe=35, fnb=38, gym=30, education=32, convenience=35, beauty=30, pharmacy=32, petshop=25, realestate=40, laundry=28, bookstore=28, carwash=32),
        summary="Bờ Bắc sông Hồng đang đô thị hóa nhanh nhờ hàng loạt cầu mới và chung cư trung cấp. Dân số trẻ tăng đều, dịch vụ thương mại vẫn theo chưa kịp tốc độ xây dựng.",
    ),
    dict(
        slug="ha-dong",
        name="Hà Đông",
        district="Hà Đông",
        lat=20.9715, lng=105.7767,
        metrics=dict(population_growth=82, metro_growth=55, apartment_growth=55, school_growth=50, office_growth=25),
        competition=dict(cafe=32, fnb=35, gym=25, education=30, convenience=35, beauty=28, pharmacy=35, petshop=22, realestate=32, laundry=28, bookstore=28, carwash=32),
        summary="Quận đông dân bậc nhất Hà Nội, giá nhà dễ tiếp cận, có tuyến đường sắt đô thị Cát Linh - Hà Đông chạy qua. Sức mua đại chúng lớn, dịch vụ hiện đại còn ít so với dân số.",
    ),
    dict(
        slug="dong-anh",
        name="Đông Anh",
        district="Đông Anh",
        lat=21.1234, lng=105.8500,
        metrics=dict(population_growth=65, metro_growth=10, apartment_growth=35, school_growth=30, office_growth=15),
        competition=dict(cafe=15, fnb=18, gym=12, education=15, convenience=18, beauty=12, pharmacy=15, petshop=10, realestate=25, laundry=12, bookstore=12, carwash=18),
        summary="Khu vực phía Bắc sông Hồng được quy hoạch lên thành phố mới, gần cầu Nhật Tân và sân bay Nội Bài. Dân số bắt đầu tăng nhưng thị trường dịch vụ gần như còn sơ khai.",
    ),
    dict(
        slug="my-dinh",
        name="Mỹ Đình",
        district="Nam Từ Liêm",
        lat=21.0158, lng=105.7822,
        metrics=dict(population_growth=50, metro_growth=30, apartment_growth=48, school_growth=42, office_growth=58),
        competition=dict(cafe=58, fnb=55, gym=48, education=40, convenience=52, beauty=50, pharmacy=52, petshop=38, realestate=38, laundry=42, bookstore=38, carwash=40),
        summary="Khu thể thao - hội nghị - văn phòng đã phát triển ổn định quanh Sân vận động Mỹ Đình. Dân cư trung lưu đông, cạnh tranh dịch vụ ở mức trung bình khá.",
    ),
]

AREAS_BY_CITY = {
    "hcm": HCM_AREAS,
    "hanoi": HANOI_AREAS,
}


def seed(db: Session):
    if db.query(Area).count() > 0:
        return
    for city_id, entries in AREAS_BY_CITY.items():
        for entry in entries:
            area = Area(
                slug=entry["slug"],
                name=entry["name"],
                district=entry["district"],
                city_id=city_id,
                city=CITIES[city_id],
                lat=entry["lat"],
                lng=entry["lng"],
                geometry_json=json.dumps(_square(entry["lat"], entry["lng"])),
                summary=entry["summary"],
                competition_json=json.dumps(entry["competition"]),
                **entry["metrics"],
            )
            db.add(area)
    db.commit()
