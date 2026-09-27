# Bản đồ Cơ hội Kinh doanh (Business Opportunity Map)

MVP demo cho ý tưởng **"Google Maps cho cơ hội kinh doanh"**: chọn một khu vực trên bản đồ (TP. Hồ Chí Minh hoặc Hà Nội), hệ thống phân tích xu hướng khu vực (dân số, hạ tầng metro, chung cư mới, trường học, văn phòng) và gợi ý top loại hình kinh doanh (☕ Cafe, 🍜 F&B, 🏋️ Gym, 🧒 Giáo dục trẻ em, 🛒 Cửa hàng tiện lợi, 💇 Beauty/Spa, 🏥 Nhà thuốc/Y tế, 🐾 Thú cưng, 🏠 Bất động sản/Môi giới, 🧺 Giặt ủi, 📚 Nhà sách/Văn phòng phẩm, 🚗 Sửa xe/Rửa xe) phù hợp nhất, kèm điểm số và mức độ cạnh tranh hiện tại.

- **Frontend**: Angular 18 (standalone components) + Leaflet/OpenStreetMap, có nút chuyển đổi TP. Hồ Chí Minh / Hà Nội.
- **Backend**: **hai bản tương đương** cho Bản đồ Cơ hội Kinh doanh, chọn một để chạy (riêng Hanoi Living Score chỉ có ở bản Node):
  - `backend/` — Python, FastAPI + SQLAlchemy + SQLite
  - `backend-node/` — Node.js, Express, dữ liệu giữ trong bộ nhớ (không cần DB); đồng thời phục vụ Hanoi Living Score ở `/api/living-score`

  Cả hai cùng expose đúng một bộ API, cùng một scoring engine (trọng số theo từng chỉ số, trừ điểm theo mức độ bão hòa thị trường), cùng một bộ dữ liệu — frontend không cần biết đang nói chuyện với backend nào. **Chỉ chạy MỘT trong hai** (cùng cổng 8000).
- **Dữ liệu**: dữ liệu mô phỏng (mock) cho 10 khu vực thật ở TP.HCM + 10 khu vực thật ở Hà Nội. Thay bằng nguồn dữ liệu thật (dân số, quy hoạch metro, giấy phép xây dựng, POI từ OpenStreetMap Overpass...) khi lên production, các phần còn lại của app không cần thay đổi.

## Điều hướng chung

Cả sáu công cụ (Bản đồ Cơ hội Kinh doanh, Hanoi Time Machine, Hanoi Living Score, Hanoi Future Map, Hanoi Business Copilot, AI Property Intelligence) dùng **một thanh điều hướng chung** `frontend/src/app/components/site-nav/`,
đặt trong `AppComponent`: logo "Hà Nội 100 năm" (về Trang chủ) và sáu tab. Mỗi trang chỉ giữ thanh phụ riêng cho việc của nó
(chọn thành phố / mục lục chương / Khám phá · So sánh · AI · Đã lưu · Cá nhân). Chiều cao thanh chung là biến CSS `--site-nav-h` (`styles.css`);
trang chiếm cả khung nhìn phải trừ biến này thay vì dùng `100vh`.

### Giao diện sáng / tối

Nút mặt trăng/mặt trời trên thanh chung đổi giao diện cho **toàn bộ** ứng dụng (Trang chủ, Cơ hội Kinh doanh, Time Machine, Living Score, Future Map, Business Copilot, Property Intelligence).
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
│   │   ├── living-score/       # Hanoi Living Score (/api/living-score/...) — xem mục bên dưới
│   │   ├── future-map/         # Hanoi Future Map (/api/future-map/...) — dữ liệu kịch bản 2026-2100
│   │   ├── business-copilot/   # Hanoi Business Copilot (/api/business-copilot/...) — dữ liệu demo
│   │   └── property-intel/     # AI Property Intelligence (/api/property-intel/...) — dữ liệu mẫu
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
        ├── future-map/             # Hanoi Future Map (lazy route /future-map, MapLibre)
        ├── business-copilot/       # Hanoi Business Copilot (lazy route /business-copilot)
        ├── property-intel/         # AI Property Intelligence (lazy route /property-intelligence, MapLibre)
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
| `AI_PROVIDER` | `auto` | Business Copilot: `auto` (Claude nếu có key) hoặc `mock` |

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

## Hanoi Future Map (`/future-map`, API `/api/future-map`)

Bản đồ tương lai của Thủ đô trên timeline **2026 → 2030 → 2050 → 2100**: kéo (hoặc bấm ▶ để phát) để xem metro, vành đai, vùng TOD, hành lang xanh, sân bay/logistics và các **cực tăng trưởng** xuất hiện dần.

- **10 lớp bản đồ** bật/tắt độc lập: Metro, Vùng TOD, Khu vực phát triển, Vành đai & cao tốc, Hành lang xanh, Sông Hồng & mặt nước, Sân bay/Logistics, Cực tăng trưởng, Trục phát triển, Ranh giới quy hoạch.
- **Thẻ cực tăng trưởng** (bấm vào cực trên bản đồ hoặc tìm theo tên): 4 chỉ số (phát triển, TOD, xanh, kết nối), số tuyến metro chạm tới, sân bay/logistics, và bảng điểm qua từng mốc. Điểm TOD và kết nối **tính từ số tuyến metro thật sự chạm tới cực** ở mốc đó nên thay đổi khi kéo timeline.
- **2D / 3D** (nâng khối khu phát triển theo điểm, nghiêng camera), toàn màn hình, **so sánh 2–3 mốc**, và **hỏi đáp** với 6 câu hỏi có sẵn (TOD cao nhất, xanh nhất, tăng trưởng nhanh nhất, kết nối sân bay, mạng metro, mốc này khác gì mốc trước).
- Giao diện sáng/tối theo theme chung của ứng dụng.

> ⚠️ **Toàn bộ là dữ liệu KỊCH BẢN minh hoạ** (`backend-node/src/future-map/data.js`): lấy cảm hứng từ các định hướng phát triển đã công bố nhưng **không phải bản đồ quy hoạch chính thức, không phải dự báo**. Vị trí là xấp xỉ; dân số, tỷ lệ xanh và điểm số là giả định của bản demo.
> Giao diện luôn ghi rõ điều này (chú thích "Kịch bản minh hoạ" và mục "Nguồn dữ liệu"). Câu trả lời ở mục hỏi đáp được **tính bằng quy tắc trên dữ liệu kịch bản, không do mô hình AI viết** — và cũng được ghi rõ như vậy.

API (tiền tố `/api/future-map`, cùng định dạng lỗi với Living Score):

| Method | Đường dẫn | Mô tả |
|---|---|---|
| GET | `/timeline` | Các mốc thời gian, chỉ số tổng quan, tâm bản đồ |
| GET | `/scenario?year=2050` | Toàn bộ lớp bản đồ (GeoJSON) + chỉ số cho một mốc |
| GET | `/hubs/:slug?year=2050` | Một cực: điểm, số tuyến metro, điểm qua các mốc |
| GET | `/compare?years=2030,2050,2100` | So sánh 2–3 mốc + mức thay đổi |
| GET | `/questions` | Danh sách câu hỏi có sẵn |
| POST | `/ask` | `{ "question": "top-tod", "year": 2050 }` → câu trả lời tính từ dữ liệu |

Frontend nằm ở `frontend/src/app/future-map/` (bản đồ MapLibre với nền OpenStreetMap được làm tối/sáng, lớp phát sáng bằng line-blur, marker HTML cho các cực). Tuyến metro 1, 2, 2A, 3 dùng lại hình học từ dữ liệu mẫu của Living Score. Kiểm thử: `cd backend-node && npm test` (có bộ test riêng `test/future-map.test.js`).

## Hanoi Business Copilot (`/business-copilot`, API `/api/business-copilot`)

Nền tảng location intelligence trả lời câu hỏi **"Tôi nên mở cửa hàng tiếp theo ở đâu tại Hà Nội?"**. Nhập ý tưởng tự nhiên
(tiếng Việt hoặc tiếng Anh, ví dụ *"I have 500M VND and want to open a coffee shop"* hay *"Tôi có 1,2 tỷ, muốn mở nhà hàng"*) →
Copilot nhận ra loại hình + ngân sách → xếp hạng **Top 10** khu vực theo Business Score → chi tiết, so sánh, mô phỏng, hỏi AI, xuất báo cáo.

> ⚠️ **Toàn bộ là dữ liệu DEMO / ƯỚC TÍNH** (`backend-node/src/business-copilot/data.js`): dân số, thu nhập, giá thuê, đối thủ, lưu lượng
> khách, doanh thu, chi phí đều là số minh hoạ — **không phải số liệu thị trường**. Giao diện, API và báo cáo đều ghi nhãn này.

**Các trang** (thanh điều hướng riêng của Copilot): Dashboard · Explore Locations (bản đồ MapLibre 10 lớp: Business Score, heatmap nhu cầu,
mật độ dân số, đối thủ, metro, trường học, văn phòng, mua sắm, đường chính, vùng phát triển) · Market Data (bảng sắp xếp được) · Competitors ·
Compare (2–3 khu vực, radar + bảng) · Simulator (form nhập giả định → khu vực đề xuất, chi phí, doanh thu, lợi nhuận, hoà vốn, rủi ro) ·
Reports (9 mục, lưu trên trình duyệt, **Xuất PDF** qua hộp thoại in) · AI Copilot. Trợ lý Copilot cũng mở được ở mọi trang (nút "Ask AI" / "Copilot").

**Business Score** (`scoring.js`) = trung bình có trọng số của Nhu cầu 26 · Cạnh tranh 16 · Giá thuê 14 · Lưu lượng 14 · Tiếp cận 10 ·
Tăng trưởng 10 · Phù hợp ngân sách 10, rồi hiệu chỉnh tuyến tính về thang 0–100. Nhu cầu dùng trọng số riêng cho từng loại hình (quán cà phê nặng
về dân văn phòng/sinh viên, phòng gym nặng về dân cư/thu nhập…). Chi phí, doanh thu 18 tháng và điểm hoà vốn tính từ mô hình chi phí của từng loại hình.

**AI** (`ai-provider.js`): lớp trừu tượng `AIProvider` (`name`, `model`, `explain({ task, question, facts })`). AI **chỉ diễn đạt** — mọi con số do
engine tính và truyền vào. Mặc định `AI_PROVIDER=auto`: dùng Claude (Anthropic SDK) khi có `ANTHROPIC_API_KEY`, nếu không (hoặc khi lỗi/bị từ chối)
dùng `MockAIProvider` trả lời theo quy tắc. Thêm OpenAI/Gemini = viết một lớp cùng giao diện và đăng ký trong `PROVIDERS`. Câu trả lời của Copilot
luôn có cấu trúc **Khuyến nghị → Bằng chứng → Điểm → Rủi ro → Bước tiếp theo**; hiện nhận 6 ý định: gợi ý vị trí, ít cạnh tranh nhất, so sánh,
cao cấp, "nên kinh doanh gì ở X", phân tích một quận.

| Method | Đường dẫn (tiền tố `/api/business-copilot`) | Mô tả |
|---|---|---|
| GET | `/categories` | 6 loại hình |
| GET | `/locations?category=&budget=` | 10 khu vực xếp hạng |
| GET | `/locations/:id` · `/locations/:id/business-score` · `/locations/:id/competitors` | Chi tiết / điểm / đối thủ |
| GET | `/recommendations?category=&budget=&limit=` | Top N + nhận định AI + heatmap cơ hội |
| GET | `/map/layers?category=&budget=` | 10 lớp GeoJSON |
| POST | `/analyze` | `{ message }` câu tự nhiên → Top 10 |
| POST | `/compare` | `{ locations: [2–3 slug], category?, budgetVnd? }` |
| POST | `/simulate` | `{ category, budgetVnd, sizeM2?, expectedRevenueVnd?, maxRentVnd?, targetCustomers?, districts? }` |
| POST | `/ai/analyze` | `{ question, context? }` — AI Copilot |
| POST | `/report` | `{ category?, budgetVnd?, location? }` — báo cáo 9 mục |

Kiểm thử: `cd backend-node && npm test` (bộ `test/business-copilot.test.js`).

**Khác biệt so với đặc tả gốc (cố ý, để khớp kiến trúc đang có của dự án):** backend là module Express trong `backend-node` (không phải NestJS riêng);
dữ liệu chạy in-memory — chưa có bảng PostgreSQL/PostGIS và Redis cho Copilot (các thực thể trong spec tương ứng với cấu trúc trong `data.js`/`scoring.js`,
có thể chuyển sang Postgres theo mẫu của Living Score); CSS thuần theo token sáng/tối của app (không dùng Tailwind); biểu đồ SVG tự viết (không dùng ECharts);
AI provider hiện có mock + Anthropic (chưa có OpenAI/Gemini).

## AI Property Intelligence (`/property-intelligence`, API `/api/property-intel`)

Dựng theo bộ thiết kế *AI Property Intelligence* (3 màn: Main Dashboard · Property Deep Dive · Hero), giao diện tiếng Anh như thiết kế,
nền tối theo đúng bảng màu thiết kế và có bản sáng dùng chung nút đổi giao diện. Ba trang, chung một thanh sản phẩm (tabs, tìm kiếm ⌘K / Ctrl K
có breadcrumb, ngày cập nhật dữ liệu, chuyển VND/USD):

- **Overview** (`/property-intelligence`): hero "See the data behind every property", ô hỏi AI, số liệu tổng, thẻ quận nổi bật trên nền bản đồ.
- **Map Intelligence** (`/property-intelligence/map`): panel lớp bản đồ (quy hoạch, dự án phát triển, metro, TOD, hạ tầng, dự án BĐS,
  heatmap giá, trường/bệnh viện, mật độ dân số, cây xanh; preset; nền Satellite/Dark/Terrain; mốc quy hoạch 2026/2030/2045), bản đồ MapLibre
  (bấm quận để chọn, bấm chấm dự án để mở chi tiết, lens Growth/Price/Risk, 3D), khung **Ask Property AI** (⌘J / Ctrl J, 5 nút hành động nhanh),
  5 biểu đồ (xu hướng giá, tác động hạ tầng, cung–cầu, dân số, dòng thời gian phát triển) và thẻ quận (Growth Score 8 tiêu chí, chỉ số thị trường,
  dự án đang theo dõi, value chain).
- **Project deep dive** (`/property-intelligence/projects/:slug`): bản đồ cận cảnh (vòng TOD 800 m quanh ga gần nhất, vùng đi bộ 10 phút / lái xe
  20 phút, tiện ích, dự án lân cận), giá ước tính, giá/m² so với quận, lịch sử giá 1Y/3Y/5Y, điểm phát triển/rủi ro, khoảng cách tiện ích,
  hạ tầng sắp tới, dự án lân cận, AI Take; nút **+ Watchlist** và **Generate Investment Report** (hộp thoại báo cáo, in/PDF).

> ⚠️ **Toàn bộ là SAMPLE DATA** (`backend-node/src/property-intel/data.js`): giá, điểm, dự án (tên dự án là hư cấu), kịch bản đều là số minh hoạ.
> Tuyến metro lấy từ seed của Living Score (gần đúng); cầu, Vành đai 4, vùng quy hoạch và ranh giới quận là phác thảo. Không phải số liệu chính thức,
> không phải khuyến nghị đầu tư.

**Growth Score** = trung bình có trọng số của Planning 20 · Infrastructure 20 · Price Potential 20 · Connectivity 15 · Demand 15 ·
Urban Development 5 · Population Growth 5 (Investment Risk hiển thị riêng). Khoảng cách tới ga/tiện ích tính bằng haversine trên toạ độ mẫu.
**Ask Property AI** (`analyst.js`) là bộ phân tích **theo quy tắc**: nhận diện ý định (analyze / compare / price / future / report / project) và
quận/dự án được nhắc tới (tiếng Việt có dấu hay không dấu đều được), rồi ghép câu trả lời hoàn toàn từ dữ liệu mẫu — chưa gọi LLM.

| Method | Đường dẫn (tiền tố `/api/property-intel`) | Mô tả |
|---|---|---|
| GET | `/overview` | Số liệu hero, quận nổi bật, ngày dữ liệu, tỷ giá mẫu |
| GET | `/districts` · `/districts/:slug` | 10 quận xếp hạng · chi tiết một quận |
| GET | `/projects` · `/projects/:slug` | 10 dự án · phân tích sâu một dự án |
| GET | `/map?horizon=2026\|2030\|2045` | Các lớp GeoJSON theo mốc quy hoạch |
| GET | `/search?q=` | Tìm quận/dự án (theo đầu từ, bỏ dấu) |
| POST | `/ask` | `{ question, intent?, district?, project? }` — Ask Property AI |

Kiểm thử: `cd backend-node && npm test` (bộ `test/property-intel.test.js`).

## Ảnh thật của Hanoi Time Machine

Mục timeline và bảng chi tiết trên bản đồ của Time Machine hiển thị **ảnh thật** của 13 địa danh (Hồ Gươm, Phố Cổ, Ba Đình, Văn Miếu, Nhà Hát Lớn, Chùa Một Cột, Hoàng thành Thăng Long, Cầu Long Biên, Nhà thờ Lớn, Hồ Tây & chùa Trấn Quốc, Nhà tù Hỏa Lò, Chợ Đồng Xuân, Ga Hà Nội), lấy từ Wikimedia Commons (phạm vi công cộng hoặc Creative Commons).
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
