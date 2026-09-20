# Bản đồ Cơ hội Kinh doanh (Business Opportunity Map)

MVP demo cho ý tưởng **"Google Maps cho cơ hội kinh doanh"**: chọn một khu vực trên bản đồ (TP. Hồ Chí Minh hoặc Hà Nội), hệ thống phân tích xu hướng khu vực (dân số, hạ tầng metro, chung cư mới, trường học, văn phòng) và gợi ý top loại hình kinh doanh (☕ Cafe, 🍜 F&B, 🏋️ Gym, 🧒 Giáo dục trẻ em, 🛒 Cửa hàng tiện lợi, 💇 Beauty/Spa, 🏥 Nhà thuốc/Y tế, 🐾 Thú cưng, 🏠 Bất động sản/Môi giới, 🧺 Giặt ủi, 📚 Nhà sách/Văn phòng phẩm, 🚗 Sửa xe/Rửa xe) phù hợp nhất, kèm điểm số và mức độ cạnh tranh hiện tại.

- **Frontend**: Angular 18 (standalone components) + Leaflet/OpenStreetMap, có nút chuyển đổi TP. Hồ Chí Minh / Hà Nội.
- **Backend**: **hai bản tương đương** cho Bản đồ Cơ hội Kinh doanh, chọn một để chạy (riêng Hanoi Living Score chỉ có ở bản Node):
  - `backend/` — Python, FastAPI + SQLAlchemy + SQLite
  - `backend-node/` — Node.js, Express, dữ liệu giữ trong bộ nhớ (không cần DB); đồng thời phục vụ Hanoi Living Score ở `/api/living-score`

  Cả hai cùng expose đúng một bộ API, cùng một scoring engine (trọng số theo từng chỉ số, trừ điểm theo mức độ bão hòa thị trường), cùng một bộ dữ liệu — frontend không cần biết đang nói chuyện với backend nào. **Chỉ chạy MỘT trong hai** (cùng cổng 8000).
- **Dữ liệu**: dữ liệu mô phỏng (mock) cho 10 khu vực thật ở TP.HCM + 10 khu vực thật ở Hà Nội. Thay bằng nguồn dữ liệu thật (dân số, quy hoạch metro, giấy phép xây dựng, POI từ OpenStreetMap Overpass...) khi lên production, các phần còn lại của app không cần thay đổi.

## Điều hướng chung

Cả ba công cụ (Bản đồ Cơ hội Kinh doanh, Hanoi Time Machine, Hanoi Living Score) dùng **một thanh điều hướng chung** `frontend/src/app/components/site-nav/`,
đặt trong `AppComponent`: logo "Hà Nội 100 năm" (về Trang chủ) và ba tab. Mỗi trang chỉ giữ thanh phụ riêng cho việc của nó
(chọn thành phố / mục lục chương / Khám phá · So sánh · AI · Đã lưu · Cá nhân). Chiều cao thanh chung là biến CSS `--site-nav-h` (`styles.css`);
trang chiếm cả khung nhìn phải trừ biến này thay vì dùng `100vh`.

### Giao diện sáng / tối

Nút mặt trăng/mặt trời trên thanh chung đổi giao diện cho **toàn bộ** ứng dụng (Trang chủ, Cơ hội Kinh doanh, Time Machine, Living Score).
`ThemeService` (`frontend/src/app/services/theme.service.ts`) lưu lựa chọn ở `localStorage` (`hanoi100.theme`: `light` | `dark` | `system`), mặc định theo hệ điều hành,
và ghi kết quả vào `<html data-theme="light|dark">` (một script nhỏ trong `index.html` áp dụng trước khi vẽ để không bị nháy màu).
Bộ màu dùng chung là các biến `--app-*` trong `frontend/src/styles.css`; mỗi trang đọc các biến này (Time Machine có bộ token sáng riêng `--tm-*`).
Trang "Cá nhân" của Living Score vẫn có lựa chọn Theo hệ thống / Sáng / Tối, cùng điều khiển một theme.

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
├── backend-node/              # Bản Node.js (Express) — Bản đồ Cơ hội KD + Hanoi Living Score
│   ├── server.js               # Bản đồ Cơ hội KD (/api/...) + mount Living Score, CORS
│   ├── src/
│   │   ├── data.js             # CITIES: 10 khu vực TP.HCM + 10 khu vực Hà Nội
│   │   ├── scoring.js          # Cùng công thức chấm điểm như bản Python
│   │   └── living-score/       # Hanoi Living Score (/api/living-score/...) — xem mục bên dưới
│   ├── database/living-score/  # 01-schema.sql — schema PostgreSQL/PostGIS
│   ├── test/                   # node --test: API cơ hội KD + toàn bộ Living Score
│   ├── Dockerfile · .env.example
│   └── package.json
├── docker-compose.yml        # PostGIS + Redis + backend-node + frontend (nginx)
└── frontend/                 # Angular 18 (Trang chủ + 3 công cụ), có Dockerfile + nginx.conf
    └── src/app/
        ├── app.component.*         # Thanh điều hướng chung + router-outlet
        ├── components/site-nav/    # Thanh điều hướng chung (logo Hà Nội 100 năm + 3 tab)
        ├── components/map|area-panel|legend/   # Bản đồ Cơ hội Kinh doanh (Leaflet)
        ├── pages/                  # home, opportunity-map, time-machine
        ├── living-score/           # Hanoi Living Score (lazy route /living-score, MapLibre)
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
- `/api/living-score/...` — Hanoi Living Score (chỉ có ở bản Node, xem mục bên dưới)

## Chạy Frontend (Angular)

```bash
cd frontend
npm install
npm start        # = ng serve, chạy tại http://localhost:4200
```

Mặc định frontend gọi backend tại `http://localhost:8000` (cấu hình trong `frontend/src/app/config.ts`, đổi `API_BASE_URL` khi deploy). Nút chuyển thành phố ở góc trên bên phải tự lấy danh sách qua `GET /api/cities` — hoạt động giống hệt nhau dù chạy backend nào.

**Lưu ý:** phải chạy backend trước (hoặc song song) thì bản đồ mới có dữ liệu — CORS đã được mở sẵn cho `http://localhost:4200`.

## Hanoi Living Score (`/living-score`, API `/api/living-score`)

Chấm điểm mức độ đáng sống của từng khu vực Hà Nội (8 tiêu chí), bản đồ MapLibre, so sánh 2–3 khu vực và AI gợi ý Top 3:
`Bản đồ → Tìm khu vực → Living Score → Chi tiết khu vực → So sánh → AI gợi ý`.

> ⚠️ **Toàn bộ dữ liệu là SAMPLE DATA** (minh hoạ): điểm số, giá thuê, dân số, tiện ích, ranh giới khu vực và tuyến metro
> **không phải số liệu chính thức**. Giao diện, API và README đều gắn nhãn này. Hãy thay module seed bằng pipeline dữ liệu thật
> trước khi dùng cho mục đích nghiêm túc.

Backend nằm trong cùng server Express (`backend-node/src/living-score/`, cổng 8000), frontend là một feature lazy-load của app Angular.

```
Angular (frontend, route /living-score)
        ↓ REST/JSON
backend-node  /api/living-score/*
   ├─ Scoring Engine  ── tính Living Score (mặc định + cá nhân hoá) — KHÔNG hard-code ở UI
   ├─ Recommendation  ── xếp hạng theo quy tắc → truy xuất ngữ cảnh (RAG) → LLM viết lời giải thích
   ├─ Cache           ── Redis (tự rơi về cache in-process nếu Redis không có)
   └─ Data source     ── PostgreSQL + PostGIS   |   in-memory (cùng bộ SAMPLE DATA, không cần DB)
```

### Chạy nhanh (không cần database)

Yêu cầu: Node.js ≥ 20.12. Mặc định `DATA_SOURCE=memory`.

```bash
cd backend-node && npm install && npm start      # http://localhost:8000  (health: /api/living-score/health)
cd frontend && npm install && npm start          # http://localhost:4200/living-score
```

### Docker (PostgreSQL/PostGIS + Redis + API + frontend)

```bash
export ANTHROPIC_API_KEY=sk-ant-...      # (tuỳ chọn) bật lời giải thích do AI viết
docker compose up --build                # ở thư mục gốc dự án
```

- Frontend: <http://localhost:8080> (Trang chủ, `/opportunity-map`, `/time-machine`, `/living-score`)
- API: <http://localhost:8000/api/living-score/health> · Postgres: `localhost:5432` (user/pass/db: `living` / `living` / `living_score`)

Schema (`backend-node/database/living-score/`) được áp dụng tự động ở lần khởi động đầu; backend tự nạp SAMPLE DATA khi bảng `areas` trống (`AUTO_SEED=true`).
Nạp lại từ đầu: `SEED_RESET=true npm run seed:living` (trong `backend-node/`). Chỉ chạy Postgres/Redis bằng Docker rồi chạy API local:
`docker compose up db redis`, sau đó `cp .env.example .env` trong `backend-node/` và đặt `DATA_SOURCE=postgres`.

### Biến môi trường (`backend-node/.env.example`, nạp tự động từ `.env`)

| Biến | Mặc định | Ý nghĩa |
|---|---|---|
| `PORT` | `8000` | Cổng API |
| `CORS_ORIGIN` | — | Origin frontend bổ sung (mọi `http://localhost:*` luôn được phép) |
| `DATA_SOURCE` | `memory` | `memory` hoặc `postgres` |
| `DATABASE_URL` | — | Bắt buộc khi `postgres` |
| `AUTO_SEED` | `true` | Nạp SAMPLE DATA khi bảng `areas` trống |
| `REDIS_URL` | — | Trống = dùng cache in-process |
| `CACHE_TTL_SECONDS` | `300` | `0` = tắt cache |
| `ANTHROPIC_API_KEY` | — | Trống = AI dùng giải thích theo quy tắc (`mode: "rules"`) |
| `LLM_MODEL` | `claude-opus-5` | Model dùng cho lời giải thích |
| `LLM_TIMEOUT_MS` | `45000` | Timeout gọi LLM |

Cấu hình Living Score được validate bằng Zod khi khởi động — sai cấu hình sẽ báo lỗi rõ ràng và dừng ngay.

### Scoring Engine (Living Score)

Trọng số mặc định (tổng 100%): Transportation 20 · Education 15 · Healthcare 10 · Green Space 10 · Amenities 15 · Safety 10 · Environment 10 · Cost 10.

`Living Score = Σ (điểm tiêu chí × trọng số chuẩn hoá)` — mọi phép tính nằm trong `backend-node/src/living-score/scoring/scoring.service.js`.
UI chỉ **hiển thị**; nhãn tiêu chí, trọng số mặc định và ngưỡng màu (band) đều lấy từ `GET /api/living-score/scoring/criteria`.

- Với tiêu chí **Cost**, điểm cao = chi phí thấp/dễ chịu.
- Cá nhân hoá: thêm `?weights=transportation:40,cost:5` vào các endpoint GET (mỗi giá trị 0–100, tự chuẩn hoá về 100%).
- Band: `excellent ≥ 75` · `good ≥ 65` · `fair ≥ 50` · `low`.

### AI Recommendation (LLM + RAG)

`POST /api/living-score/recommendations` nhận ngân sách, nơi làm việc/học tập, gia đình/độc thân, sở thích và mức ưu tiên (0–5) cho từng tiêu chí.

1. **Xếp hạng xác định (deterministic)**: trọng số = trọng số mặc định × (ưu tiên/3) × hệ số hoàn cảnh × hệ số sở thích → Scoring Engine chấm điểm →
   nhân hệ số ngân sách (vượt giá thuê bị trừ, tối thiểu ×0,5) và hệ số quãng đường tới nơi làm việc (đường chim bay, tối thiểu ×0,8) → Top 3.
2. **Retrieval (RAG)**: `KnowledgeService` lấy các đoạn kiến thức (bảng `area_knowledge`) phù hợp nhất với ưu tiên của người dùng.
   Retrieval hiện dựa trên chủ đề; hướng nâng cấp: thêm cột `embedding` (pgvector) và xếp hạng theo độ tương đồng.
3. **LLM (Anthropic API)**: chỉ *diễn đạt lại* — nhận điểm/ngữ cảnh đã tính, trả về `summary`, `reasons`, `pros`, `cons` theo JSON schema (Zod). Prompt cấm
   bịa số liệu và bắt buộc nhắc dữ liệu là mẫu. LLM **không** được đổi điểm hay thứ hạng. Bật `fallbacks: "default"` để tự chuyển model nếu bị từ chối.
4. Không có API key / LLM lỗi / bị từ chối → tự động dùng giải thích theo quy tắc (`mode: "rules"` + `notice`).

Đầu vào của người dùng chỉ gồm số và enum (không có văn bản tự do) nên không có đường prompt-injection; endpoint bị giới hạn 10 request/phút và kết quả được cache 10 phút.

### REST API Living Score (tiền tố `/api/living-score`)

| Method | Đường dẫn | Mô tả |
|---|---|---|
| GET | `/health` | Trạng thái API, data source, cache, AI |
| GET | `/scoring/criteria` | Tiêu chí, trọng số mặc định, band |
| GET | `/areas?q=&sort=score\|name\|rent&weights=` | Danh sách khu vực + Living Score |
| GET | `/areas/geojson?criterion=&weights=` | Polygon GeoJSON tô màu theo điểm (cho bản đồ) |
| GET | `/areas/:slug?weights=` | Chi tiết: điểm, breakdown, ưu/nhược điểm, tiện ích |
| GET | `/compare?slugs=a,b[,c]&weights=` | So sánh 2–3 khu vực |
| GET | `/amenities?types=school,hospital&bbox=&area=` | Tiện ích (GeoJSON point), lọc theo loại/khung nhìn |
| GET | `/infrastructure` | Metro & hạ tầng (đang chạy / đang xây / dự kiến) |
| GET | `/search?q=` | Tìm khu vực & địa điểm, không phân biệt dấu |
| POST | `/recommendations` | AI gợi ý Top 3 |

Lỗi luôn có dạng `{ statusCode, error, message, path, timestamp }`. Query/body được validate (parser riêng + Zod) — dữ liệu lạ trả `400`.
(Các endpoint của Bản đồ Cơ hội Kinh doanh giữ nguyên định dạng lỗi `{ detail }` cũ.)

### Dữ liệu & PostGIS

Schema ở `backend-node/database/living-score/01-schema.sql`: `areas` (boundary `Polygon`, centroid `Point`), `area_scores`, `area_notes`, `amenities`,
`infrastructure`, `area_knowledge`; index GIST trên các cột hình học. Backend đọc hình học bằng `ST_AsGeoJSON`, lọc viewport bằng `&&`/`ST_MakeEnvelope`.
Ranh giới khu vực là **hình minh hoạ** (ô Voronoi cắt theo bán kính quanh tâm khu vực) — không phải ranh giới hành chính. Tuyến/ga metro chỉ xấp xỉ.

### Kiểm thử

```bash
cd backend-node && npm test      # node --test: scoring, seed, recommendation engine, toàn bộ REST API (cơ hội KD + Living Score, data source in-memory)
```

### Giới hạn hiện tại

- Đang dùng SAMPLE DATA; cần pipeline dữ liệu thật (thống kê, OSM/Overpass, dữ liệu hạ tầng) và ranh giới hành chính thật.
- Chưa có đăng nhập: khu vực đã lưu, danh sách so sánh, trọng số và giao diện được lưu ở `localStorage` của trình duyệt.
- Bản đồ nền dùng tile OpenStreetMap (miễn phí, chỉ phù hợp demo — production cần nhà cung cấp tile riêng).
- Retrieval RAG mới theo chủ đề; nên chuyển sang pgvector khi kho tri thức lớn hơn.
- Phần PostgreSQL/PostGIS, Redis và Docker chưa được chạy kiểm thử trong môi trường phát triển ban đầu — hãy chạy `docker compose up --build` và xem `/api/living-score/health`.

## Ảnh thật của Hanoi Time Machine

Mục timeline và bảng chi tiết trên bản đồ của Time Machine hiển thị **ảnh thật** của 5 địa danh, lấy từ Wikimedia Commons (phạm vi công cộng hoặc Creative Commons).
Ảnh nằm ở `frontend/public/images/time-machine/<địa-danh>-<mốc>.jpg`; danh sách, chú thích, tác giả, giấy phép và liên kết trang gốc nằm trong
`frontend/src/app/pages/time-machine/time-machine-photos.ts` (mỗi ảnh hiện đủ ghi nguồn và link về trang Commons).

- Ảnh tư liệu ghi **đúng năm chụp** trong chú thích; vài ảnh gần mốc thay vì đúng mốc (ví dụ Hồ Gươm ~1900 cho mốc 1926, Giao thông Hà Nội 1978 cho mốc 1975, mít tinh trước Nhà Hát Lớn 8/1945 cho mốc 1954).
- Ô nào chưa có ảnh phù hợp (Hồ Gươm 1975, Ba Đình 1926, Văn Miếu 1954/1975, Nhà Hát Lớn 1975) vẫn dùng hình minh hoạ và có ghi chú "Chưa có ảnh tư liệu".
- Mốc 2050/2100 là kịch bản tương lai nên luôn dùng hình minh hoạ, không thể có ảnh thật.
- Muốn thêm/đổi ảnh: chép file vào thư mục trên, thêm một mục vào `LANDMARK_PHOTOS` (kèm tác giả và giấy phép). Giấy phép CC BY / BY-SA yêu cầu ghi nguồn — giữ nguyên `author`, `license`, `pageUrl`.

## Cách hoạt động của scoring engine (Bản đồ Cơ hội Kinh doanh)

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
