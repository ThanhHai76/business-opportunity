# Bản đồ Cơ hội Kinh doanh (Business Opportunity Map)

MVP demo cho ý tưởng **"Google Maps cho cơ hội kinh doanh"**: chọn một khu vực trên bản đồ (TP. Hồ Chí Minh hoặc Hà Nội), hệ thống phân tích xu hướng khu vực (dân số, hạ tầng metro, chung cư mới, trường học, văn phòng) và gợi ý top loại hình kinh doanh (☕ Cafe, 🍜 F&B, 🏋️ Gym, 🧒 Giáo dục trẻ em, 🛒 Cửa hàng tiện lợi, 💇 Beauty/Spa, 🏥 Nhà thuốc/Y tế, 🐾 Thú cưng, 🏠 Bất động sản/Môi giới, 🧺 Giặt ủi, 📚 Nhà sách/Văn phòng phẩm, 🚗 Sửa xe/Rửa xe) phù hợp nhất, kèm điểm số và mức độ cạnh tranh hiện tại.

- **Frontend**: Angular 18 (standalone components) + Leaflet/OpenStreetMap, có nút chuyển đổi TP. Hồ Chí Minh / Hà Nội.
- **Backend**: **hai bản tương đương**, chọn một để chạy:
  - `backend/` — Python, FastAPI + SQLAlchemy + SQLite
  - `backend-node/` — Node.js, Express, dữ liệu giữ trong bộ nhớ (không cần DB)

  Cả hai cùng expose đúng một bộ API, cùng một scoring engine (trọng số theo từng chỉ số, trừ điểm theo mức độ bão hòa thị trường), cùng một bộ dữ liệu — frontend không cần biết đang nói chuyện với backend nào. **Chỉ chạy MỘT trong hai** (cùng cổng 8000).
- **Dữ liệu**: dữ liệu mô phỏng (mock) cho 10 khu vực thật ở TP.HCM + 10 khu vực thật ở Hà Nội. Thay bằng nguồn dữ liệu thật (dân số, quy hoạch metro, giấy phép xây dựng, POI từ OpenStreetMap Overpass...) khi lên production, các phần còn lại của app không cần thay đổi.

## Cấu trúc thư mục

```
project/
├── backend/                  # Bản Python (FastAPI + SQLite) — có cả TP.HCM + Hà Nội
│   ├── app/
│   │   ├── main.py           # API endpoints + CORS
│   │   ├── models.py         # SQLAlchemy model Area
│   │   ├── scoring.py        # Công thức tính điểm cơ hội theo loại hình KD
│   │   ├── seed_data.py      # 10 khu vực demo (mock data)
│   │   ├── schemas.py        # Pydantic response models
│   │   └── database.py
│   └── requirements.txt
├── backend-node/              # Bản Node.js (Express) — có cả TP.HCM + Hà Nội
│   ├── server.js               # API endpoints + CORS
│   ├── src/
│   │   ├── data.js             # CITIES: 10 khu vực TP.HCM + 10 khu vực Hà Nội
│   │   └── scoring.js          # Cùng công thức chấm điểm như bản Python
│   └── package.json
└── frontend/                 # Angular 18 (dùng chung cho cả hai backend)
    └── src/app/
        ├── app.component.ts/html   # Nút chuyển thành phố + layout chính
        ├── components/map/         # Bản đồ Leaflet, tô màu theo điểm cơ hội
        ├── components/area-panel/  # Panel chi tiết khu vực + xếp hạng cơ hội
        ├── components/legend/      # Chú giải thang màu
        └── services/area.service.ts
```

## Chạy Backend — chọn 1 trong 2

### Cách A: Node.js / Express (khuyến nghị — có cả TP.HCM + Hà Nội, không cần cài Python)

```bash
cd backend-node
npm install
npm start        # hoặc: npm run dev (tự restart khi sửa code, cần Node >= 18)
```

### Cách B: Python / FastAPI (đầy đủ TP.HCM + Hà Nội)

```bash
cd backend
python3 -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

Dù chọn cách nào, backend đều chạy tại `http://localhost:8000` với đúng cùng một bộ API:
- `GET /api/cities` — danh sách thành phố hỗ trợ
- `GET /api/business-types` — danh mục 12 loại hình kinh doanh
- `GET /api/areas?city=hcm|hanoi` — GeoJSON FeatureCollection khu vực của 1 thành phố (dùng để vẽ bản đồ; tham số `city` mặc định `hcm`)
- `GET /api/areas/{slug}` — chi tiết 1 khu vực theo slug: chỉ số tăng trưởng + danh sách cơ hội đã xếp hạng

## Chạy Frontend (Angular)

```bash
cd frontend
npm install
npm start        # = ng serve, chạy tại http://localhost:4200
```

Mặc định frontend gọi backend tại `http://localhost:8000` (cấu hình trong `frontend/src/app/config.ts`, đổi `API_BASE_URL` khi deploy). Nút chuyển thành phố ở góc trên bên phải tự lấy danh sách qua `GET /api/cities` — hoạt động giống hệt nhau dù chạy backend nào.

**Lưu ý:** phải chạy backend trước (hoặc song song) thì bản đồ mới có dữ liệu — CORS đã được mở sẵn cho `http://localhost:4200`.

## Cách hoạt động của scoring engine

Với mỗi khu vực, mỗi loại hình kinh doanh có một bộ trọng số riêng áp lên 5 chỉ số tăng trưởng (0–100):

```
demand_score = Σ (metric_i × weight_i)
opportunity_score = demand_score − competition_index × 0.4   (giới hạn 0–100)
```

Ví dụ: Gym được tính trọng số cao cho "chung cư mới" (0.4) vì gym thường ăn theo mật độ dân cư chung cư; Giáo dục trẻ em được tính trọng số cao cho "trường học" + "dân số". `competition_index` mô phỏng mức độ bão hòa thị trường hiện tại của loại hình đó tại khu vực — khu trung tâm Quận 1 hay Phố cổ Hoàn Kiếm có `competition_index` rất cao nên dù `demand_score` không thấp, `opportunity_score` cuối cùng vẫn thấp (thị trường đã bão hòa).

Công thức được cài đặt giống hệt nhau ở `backend/app/scoring.py` (Python) và `backend-node/src/scoring.js` (Node) — một mô hình weighted-sum minh bạch, dễ diễn giải "vì sao" cho khách hàng B2B (chủ shop, nhà đầu tư, môi giới...), thay vì hộp đen khó giải thích.

## Hướng phát triển tiếp (gợi ý cho B2B)

- Thay mock data bằng dữ liệu thật: dân số (GSO/Tổng cục Thống kê), quy hoạch metro, giấy phép xây dựng chung cư, mật độ POI cạnh tranh (OpenStreetMap Overpass API hoặc Google Places).
- Đồng bộ dữ liệu 2 backend về 1 nguồn thật (DB thật) thay vì mock trùng lặp ở cả `backend/` và `backend-node/`.
- Thêm trang so sánh 2 khu vực song song.
- Thêm đăng nhập (JWT) để lưu khu vực yêu thích / lịch sử tra cứu — nền tảng cho gói trả phí B2B (chủ shop, chuỗi bán lẻ, môi giới, nhà đầu tư).
- Thêm dashboard admin để nhập/sửa dữ liệu khu vực thay vì chỉ qua seed script.
- Cho phép vẽ polygon tùy ý (bán kính quanh 1 địa chỉ) thay vì chỉ chọn theo ranh giới quận có sẵn.
- Mở rộng bản Node để thêm các thành phố khác ngoài TP.HCM/Hà Nội.

## Lưu ý môi trường

Trong sandbox dùng để build project này, tile bản đồ nền OpenStreetMap không tải được do chính sách mạng của sandbox (không phải lỗi của app) — bản đồ vẫn hiển thị đúng các khu vực (polygon tô màu theo điểm cơ hội) và panel chi tiết hoạt động bình thường. Khi chạy trên máy của bạn (không bị giới hạn mạng), tile nền OpenStreetMap sẽ hiển thị bình thường.
