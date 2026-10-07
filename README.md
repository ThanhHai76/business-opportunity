# Hà Nội 100 năm — Bản đồ Cơ hội Kinh doanh và các công cụ đô thị

Bộ công cụ về Hà Nội: **Bản đồ Cơ hội Kinh doanh**, Hanoi Time Machine, Hanoi Living Score, Hanoi Future Map, Hanoi Business Copilot,
AI Property Intelligence.

- **Frontend**: Angular 18 (standalone components, signals) + MapLibre GL với nền OpenFreeMap.
- **Backend**: `backend-node/` — Node.js/Express, dữ liệu đọc từ file (không bắt buộc DB), cổng 8000.
  (Thư mục `backend/` là bản Python/FastAPI cũ của Bản đồ Cơ hội Kinh doanh — có TP.HCM, dữ liệu mô phỏng; **không còn tương thích** với frontend hiện tại.)

### Bản đồ Cơ hội Kinh doanh (`/opportunity-map`, API `/api/opportunity`)

Phường nào ở Hà Nội nên mở gì — hôm nay và 3–5 năm tới? Bản đồ tô màu **79 phường/xã mới (2025)** của Hà Nội (khu vực đô thị và ven đô)
theo điểm cơ hội của **12 ngành** (☕ cà phê, 🍜 ăn uống, 🏋️ gym, 🧒 giáo dục trẻ em, 🛒 tiện lợi, 💇 làm đẹp, 🏥 nhà thuốc/phòng khám, 🐾 thú cưng,
🏠 môi giới BĐS, 🧺 giặt ủi, 📚 nhà sách, 🚗 sửa/rửa xe).

- **Dữ liệu thật từ OpenStreetMap** (`npm run data:opportunity` → `backend-node/src/opportunity/data/hanoi-wards.json`): ranh giới và **dân số
  phường/xã (1/7/2025, nguồn gis.vn)**, số cơ sở kinh doanh từng ngành (mức cạnh tranh), văn phòng, chung cư, trường học, ga metro đang chạy,
  công trường đang xây (`landuse=construction`) và đoạn metro đang xây.
- **Cách tính** (`src/opportunity/model.js`): Nhu cầu = dân số và các tín hiệu nhu cầu theo trọng số từng ngành, tương đối giữa các phường (thang căn bậc hai,
  100 = cao nhất). Cạnh tranh = số cơ sở cùng ngành trên 10.000 dân, tương đối. **Cơ hội = nhu cầu − 0,4 × cạnh tranh.** Mốc **2030** cộng thêm
  0,25 × tín hiệu tăng trưởng (công trình đang xây trong phường, metro đang xây gần đó).
- **Trung thực về dữ liệu**: phường/xã chưa có dân số trên OSM không được chấm (tô xám). Ngành OSM ghi nhận quá ít trên toàn bản đồ (< 100 cơ sở: gym,
  thú cưng, môi giới, giặt ủi, nhà sách) gắn "dữ liệu thưa" và không bao giờ là gợi ý hàng đầu; phường có độ phủ OSM quá thấp so với dân số gắn cờ
  độ tin cậy thấp. Mọi màn hình đều ghi rõ OSM chưa đủ cửa hàng nhỏ — cần khảo sát thực địa.
- **Hai cách dùng**: chọn ngành trước (bản đồ tô theo ngành đó, xếp hạng 10 phường tốt nhất có số trên bản đồ) hoặc chọn phường trước (gợi ý ngành).
  Thẻ phường giải thích điểm từng thành phần (dân số, văn phòng, chung cư, trường học, metro, tăng trưởng, trừ cạnh tranh), hiện đối thủ trên bản đồ,
  thêm vào **so sánh 2–3 phường**, liên kết **Business Copilot** (khu vực gần nhất).
- **Hỏi AI**: Claude trả lời chỉ từ dữ liệu khi có `ANTHROPIC_API_KEY`, nếu không thì trả lời tự động từ dữ liệu; server chỉ giữ phường, ngành và nguồn có thật.
- **Song ngữ** Việt/Anh, **link chia sẻ** giữ ngành, mốc, phường, danh sách so sánh (`?type=cafe&horizon=2030&ward=phuong-lang&compare=…&lang=en`).

| Method | Đường dẫn | Mô tả |
|---|---|---|
| GET | `/api/opportunity/types` | 12 ngành, trọng số nhu cầu, độ đầy đủ dữ liệu |
| GET | `/api/opportunity/wards?type=&horizon=now\|2030` | GeoJSON phường/xã + điểm (theo ngành, hoặc ngành tốt nhất), cách tính, nguồn |
| GET | `/api/opportunity/wards/:slug?horizon=` | Một phường: số liệu, điểm 12 ngành kèm phân rã, độ phủ OSM, liên kết Copilot |
| GET | `/api/opportunity/wards/:slug/places?type=` | Các cơ sở cùng ngành trong phường (đối thủ) |
| GET | `/api/opportunity/compare?slugs=a,b[,c]&type=` | So sánh 2–3 phường |
| POST | `/api/opportunity/ask` | `{ question, type?, ward?, horizon?, lang? }` → câu trả lời từ dữ liệu |

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
├── backend/                  # Bản Python (FastAPI) cũ — không còn dùng với frontend hiện tại
│   ├── app/
│   │   ├── main.py           # API endpoints + CORS
│   │   ├── models.py         # SQLAlchemy model Area
│   │   ├── scoring.py        # Công thức tính điểm cơ hội theo loại hình KD
│   │   ├── seed_data.py      # 10 khu vực demo (mock data)
│   │   ├── schemas.py        # Pydantic response models
│   │   └── database.py
│   └── requirements.txt
├── backend-node/              # Node.js (Express) — API của mọi công cụ
│   ├── server.js               # Mount các router, CORS
│   ├── scripts/                # Dựng dữ liệu từ OpenStreetMap/OSRM (npm run data:*)
│   ├── src/
│   │   ├── opportunity/        # Bản đồ Cơ hội Kinh doanh (/api/opportunity/...) — phường/xã Hà Nội, dữ liệu OSM
│   │   ├── living-score/       # Hanoi Living Score (/api/living-score/...) — xem mục bên dưới
│   │   ├── future-map/         # Hanoi Future Map (/api/future-map/...) — quy hoạch có nguồn 2026-2065 + Vùng Thủ đô
│   │   ├── business-copilot/   # Hanoi Business Copilot (/api/business-copilot/...) — dữ liệu demo
│   │   └── property-intel/     # AI Property Intelligence (/api/property-intel/...) — phường/xã, giá đất 2026, thị trường, dự án
│   ├── database/living-score/  # 01-schema.sql — schema PostgreSQL/PostGIS
│   ├── test/                   # node --test: mọi API
│   ├── Dockerfile · .env.example
│   └── package.json
├── docker-compose.yml        # PostGIS + Redis + backend-node + frontend (nginx)
└── frontend/                 # Angular 18 (Trang chủ + 3 công cụ), có Dockerfile + nginx.conf
    └── src/app/
        ├── app.component.*         # Thanh điều hướng chung + router-outlet
        ├── components/site-nav/    # Thanh điều hướng chung (logo Hà Nội 100 năm + 3 tab)
        ├── opportunity/            # Bản đồ Cơ hội Kinh doanh (lazy route /opportunity-map, MapLibre)
        ├── pages/                  # home, time-machine
        ├── living-score/           # Hanoi Living Score (lazy route /living-score, MapLibre)
        ├── future-map/             # Hanoi Future Map (lazy route /future-map, MapLibre)
        ├── business-copilot/       # Hanoi Business Copilot (lazy route /business-copilot)
        └── property-intel/         # AI Property Intelligence (lazy route /property-intelligence, MapLibre)
```

## Chạy Backend

```bash
cd backend-node
npm install
npm start        # hoặc: npm run dev (tự restart khi sửa code)
```

Backend chạy tại `http://localhost:8000`; các API: `/api/opportunity`, `/api/living-score`, `/api/future-map`, `/api/business-copilot`,
`/api/property-intel`, `/api/time-machine`.

## Chạy Frontend (Angular)

```bash
cd frontend
npm install
npm start        # = ng serve, chạy tại http://localhost:4200
```

Mặc định frontend gọi backend tại `http://localhost:8000` (cấu hình trong `frontend/src/app/config.ts`, đổi `API_BASE_URL` khi deploy).

**Lưu ý:** phải chạy backend trước (hoặc song song) thì bản đồ mới có dữ liệu — CORS đã được mở sẵn cho `http://localhost:4200`.

## Hanoi Living Score (`/living-score`, API `/api/living-score`)

Chấm điểm mức độ đáng sống quanh 13 quận cũ của Hà Nội (5 tiêu chí có dữ liệu), bản đồ MapLibre, so sánh 2–3 khu vực và AI gợi ý Top 3,
song ngữ Việt/Anh (`?lang=en` cho cả API lẫn giao diện) và link chia sẻ kèm trọng số (`?w=transportation:30,…`):
`Bản đồ → Tìm khu vực → Living Score → Chi tiết khu vực → So sánh → AI gợi ý`.

**Dữ liệu:** điểm được tính từ một bản chụp **OpenStreetMap** (© OpenStreetMap contributors, giấy phép ODbL) —
`backend-node/src/living-score/data/osm-hanoi.json`, tạo lại bằng `npm run data:living` (Overpass API, trong `backend-node/`).
Thời gian đi đường giữa các khu vực: `data/commute.json`, tạo bằng `npm run data:commute` (bảng OSRM trên đường bộ OSM, ô tô, khi đường thông thoáng).

- Mỗi khu vực là vùng quanh trung tâm một **quận cũ** (trước khi sắp xếp đơn vị hành chính năm 2025, khi cấp quận không còn);
  vùng tô màu trên bản đồ là hình minh hoạ, không phải địa giới hành chính. Mỗi khu vực ghi kèm các **phường/xã mới (2025)** mà vòng 1,5 km
  đi qua và tỷ lệ của từng phường (ranh giới admin_level 6 trên OSM); tìm kiếm theo tên phường mới (VD "phường Láng") cũng ra khu vực.
- Mọi số liệu được đo trong **bán kính 1,5 km** (khoảng 20 phút đi bộ) quanh trung tâm: số ga metro đang khai thác và điểm dừng xe buýt,
  trường học/mầm non/cơ sở đào tạo, bệnh viện/phòng khám, siêu thị/cửa hàng tiện lợi/chợ/TTTM/quán cà phê, và tỷ lệ diện tích công viên và hồ ao
  (từ lưới phủ ~100 m dựng từ polygon OSM; sông, kênh không tính).
- Điểm là **tương đối** giữa 10 khu vực (100 = khu vực cao nhất) theo thang căn bậc hai — địa điểm đầu tiên gần nhà có giá trị hơn địa điểm thứ một trăm.
- **An ninh, môi trường (không khí, tiếng ồn) và chi phí (giá thuê/bán) chưa có dữ liệu mở theo khu vực** nên không được chấm và không có trọng số;
  giao diện hiển thị "chưa có dữ liệu" thay vì đoán.
- OSM do cộng đồng đóng góp nên có thể thiếu địa điểm (nhất là vùng ven) — số liệu dùng để so sánh tương đối, không phải thống kê chính thức.
- Lớp metro: tuyến và ga đang chạy, đoạn đang xây theo OSM (một tuyến chỉ được coi là đang chạy khi đường ray đi qua ít nhất 2 ga đang
  khai thác — OSM có gắn nhãn cả tuyến 2 chưa xây); tuyến dự kiến là hướng tuyến xấp xỉ.

Backend nằm trong cùng server Express (`backend-node/src/living-score/`, cổng 8000), frontend là một feature lazy-load của app Angular.

```
Angular (frontend, route /living-score)
        ↓ REST/JSON
backend-node  /api/living-score/*
   ├─ Scoring Engine  ── tính Living Score (mặc định + cá nhân hoá) — KHÔNG hard-code ở UI
   ├─ Recommendation  ── xếp hạng theo quy tắc → truy xuất ngữ cảnh (RAG) → LLM viết lời giải thích
   ├─ Cache           ── Redis (tự rơi về cache in-process nếu Redis không có)
   └─ Data source     ── PostgreSQL + PostGIS   |   in-memory (cùng dữ liệu tính từ OSM, không cần DB)
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

Schema (`backend-node/database/living-score/`) được áp dụng tự động ở lần khởi động đầu; backend tự nạp dữ liệu khi bảng `areas` trống (`AUTO_SEED=true`).
Database tạo từ schema cũ (dữ liệu mẫu có giá thuê, dân số): chạy `02-osm-data.sql` rồi nạp lại với `SEED_RESET=true`.
Nạp lại từ đầu: `SEED_RESET=true npm run seed:living` (trong `backend-node/`). Chỉ chạy Postgres/Redis bằng Docker rồi chạy API local:
`docker compose up db redis`, sau đó `cp .env.example .env` trong `backend-node/` và đặt `DATA_SOURCE=postgres`.

### Biến môi trường (`backend-node/.env.example`, nạp tự động từ `.env`)

| Biến | Mặc định | Ý nghĩa |
|---|---|---|
| `PORT` | `8000` | Cổng API |
| `CORS_ORIGIN` | — | Origin frontend bổ sung (mọi `http://localhost:*` luôn được phép) |
| `DATA_SOURCE` | `memory` | `memory` hoặc `postgres` |
| `DATABASE_URL` | — | Bắt buộc khi `postgres` |
| `AUTO_SEED` | `true` | Nạp dữ liệu khi bảng `areas` trống |
| `REDIS_URL` | — | Trống = dùng cache in-process |
| `CACHE_TTL_SECONDS` | `300` | `0` = tắt cache |
| `ANTHROPIC_API_KEY` | — | Trống = AI dùng giải thích theo quy tắc (`mode: "rules"`) |
| `LLM_MODEL` | `claude-opus-5` | Model dùng cho lời giải thích |
| `LLM_TIMEOUT_MS` | `45000` | Timeout gọi LLM |
| `AI_PROVIDER` | `auto` | Business Copilot: `auto` (Claude nếu có key) hoặc `mock` |

Cấu hình Living Score được validate bằng Zod khi khởi động — sai cấu hình sẽ báo lỗi rõ ràng và dừng ngay.

### Scoring Engine (Living Score)

Trọng số mặc định (tổng 100%): Transportation 25 · Education 20 · Healthcare 15 · Green Space 15 · Amenities 25.
Giao thông = 60% điểm xe buýt + 40% điểm metro; Không gian xanh = % công viên + ½ × % hồ ao.

`Living Score = Σ (điểm tiêu chí × trọng số chuẩn hoá)` — mọi phép tính nằm trong `backend-node/src/living-score/scoring/scoring.service.js`.
UI chỉ **hiển thị**; nhãn tiêu chí, trọng số mặc định và ngưỡng màu (band) đều lấy từ `GET /api/living-score/scoring/criteria`.

- Cá nhân hoá: thêm `?weights=transportation:40,amenities:5` vào các endpoint GET (mỗi giá trị 0–100, tự chuẩn hoá về 100%).
- `GET /scoring/criteria` trả thêm `missing` (an ninh, môi trường, chi phí — chưa có dữ liệu) và `data` (nguồn, giấy phép, ngày OSM, phương pháp).
- Band: `excellent ≥ 75` · `good ≥ 65` · `fair ≥ 50` · `low`.

### AI Recommendation (LLM + RAG)

`POST /api/living-score/recommendations` nhận nơi làm việc/học tập, gia đình/độc thân, sở thích (cà phê, metro, trường quốc tế, công viên – hồ),
mức ưu tiên (0–5) cho từng tiêu chí và `lang` (`vi`/`en`). Không có ngân sách vì chưa có dữ liệu giá thuê đáng tin.

1. **Xếp hạng xác định (deterministic)**: trọng số = trọng số mặc định × (ưu tiên/3) × hệ số hoàn cảnh × hệ số sở thích → Scoring Engine chấm điểm →
   nhân hệ số thời gian đi đường tới nơi làm việc (bảng OSRM; ≤ 15 phút không trừ, tối thiểu ×0,8; không có bảng thì dùng đường chim bay) → Top 3. Lý do theo sở thích dẫn số liệu OSM
   (ví dụ "có 3 ga metro trong bán kính 1,5 km").
2. **Retrieval (RAG)**: `KnowledgeService` lấy các đoạn kiến thức (bảng `area_knowledge`) phù hợp nhất với ưu tiên của người dùng.
   Retrieval hiện dựa trên chủ đề; hướng nâng cấp: thêm cột `embedding` (pgvector) và xếp hạng theo độ tương đồng.
3. **LLM (Anthropic API)**: chỉ *diễn đạt lại* — nhận điểm, số liệu đo được (`measurements`, `facts`) và ngữ cảnh đã tính, trả về `summary`, `reasons`,
   `pros`, `cons` theo JSON schema (Zod). Prompt cấm bịa số liệu, cấm bàn về giá thuê/an ninh/không khí (không có dữ liệu) và yêu cầu gọi đúng "khu vực quanh
   quận cũ". LLM **không** được đổi điểm hay thứ hạng. Nguồn (OSM, ODbL, ngày dữ liệu) do server gắn vào `sources`, không do model viết.
   Bật `fallbacks: "default"` để tự chuyển model nếu bị từ chối.
4. Không có API key / LLM lỗi / bị từ chối → tự động dùng giải thích theo quy tắc (`mode: "rules"` + `notice`).

Đầu vào của người dùng chỉ gồm số và enum (không có văn bản tự do) nên không có đường prompt-injection; endpoint bị giới hạn 10 request/phút và kết quả được cache 10 phút.

### REST API Living Score (tiền tố `/api/living-score`)

| Method | Đường dẫn | Mô tả |
|---|---|---|
| GET | `/health` | Trạng thái API, data source, cache, AI |
| GET | `/scoring/criteria` | Tiêu chí, trọng số mặc định, band |
| GET | `/areas?q=&sort=score\|name&weights=` | Danh sách khu vực + Living Score + số liệu OSM (`facts`) |
| GET | `/areas/geojson?criterion=&weights=` | Polygon GeoJSON tô màu theo điểm (cho bản đồ) |
| GET | `/areas/:slug?weights=` | Chi tiết: điểm, breakdown, số liệu từng tiêu chí (`metrics`), tiêu chí chưa có dữ liệu, ưu/nhược điểm, địa điểm |
| GET | `/compare?slugs=a,b[,c]&weights=` | So sánh 2–3 khu vực |
| GET | `/amenities?types=school,hospital&bbox=&area=` | Tiện ích (GeoJSON point), lọc theo loại/khung nhìn |
| GET | `/infrastructure` | Metro & hạ tầng (đang chạy / đang xây / dự kiến) |
| GET | `/search?q=` | Tìm khu vực & địa điểm, không phân biệt dấu |
| POST | `/recommendations` | AI gợi ý Top 3 |

Lỗi luôn có dạng `{ statusCode, error, message, path, timestamp }`. Query/body được validate (parser riêng + Zod) — dữ liệu lạ trả `400`.
(Đường dẫn không tồn tại ngoài các router trả `{ detail: 'Not found' }`.)

### Dữ liệu & PostGIS

Schema ở `backend-node/database/living-score/01-schema.sql`: `areas` (boundary `Polygon`, centroid `Point`), `area_scores`, `area_notes`, `amenities`,
`infrastructure`, `area_knowledge`; index GIST trên các cột hình học. Backend đọc hình học bằng `ST_AsGeoJSON`, lọc viewport bằng `&&`/`ST_MakeEnvelope`.
Ranh giới khu vực là **hình minh hoạ** (ô Voronoi cắt theo bán kính quanh tâm khu vực) — không phải ranh giới hành chính. Tuyến/ga metro chỉ xấp xỉ.

### Kiểm thử

```bash
cd backend-node && npm test      # node --test: scoring, seed, recommendation engine, toàn bộ REST API (cơ hội KD + Living Score, data source in-memory)
```

### Giới hạn hiện tại

- An ninh, môi trường, giá thuê chưa có nguồn dữ liệu mở theo khu vực.
- Điểm vẫn chấm theo 13 khu vực quanh quận cũ (mỗi khu vực ghi kèm phường mới); chấm điểm riêng cho từng phường/xã mới là bước tiếp theo.
- Thời gian đi đường là ô tô khi đường thông thoáng (OSRM), chưa tính kẹt xe giờ cao điểm hay xe buýt/metro.
- Chưa có đăng nhập: khu vực đã lưu, danh sách so sánh, trọng số và giao diện được lưu ở `localStorage` của trình duyệt.
- Bản đồ nền dùng OpenFreeMap (vector tiles miễn phí, không cần key; dữ liệu © OpenStreetMap).
- Retrieval RAG mới theo chủ đề; nên chuyển sang pgvector khi kho tri thức lớn hơn.
- Phần PostgreSQL/PostGIS, Redis và Docker chưa được chạy kiểm thử trong môi trường phát triển ban đầu — hãy chạy `docker compose up --build` và xem `/api/living-score/health`.

## Hanoi Future Map (`/future-map`, API `/api/future-map`)

Bản đồ tương lai của Thủ đô theo các mốc của **Quy hoạch tổng thể Thủ đô tầm nhìn 100 năm**: **2026 (hiện trạng) → 2035 → 2045 → 2065**.
Kéo timeline (hoặc bấm ▶) để xem metro, vành đai, vùng TOD, không gian xanh, sân bay và **9 cực phát triển, 9 trục động lực** xuất hiện dần.

**Hai phạm vi bản đồ** (nút "Hà Nội / Vùng Thủ đô"):

- **Hà Nội** — 9 lớp bật/tắt độc lập; thẻ từng cực (vai trò, tuyến metro liên quan, trục động lực, các **hướng kết nối vùng** mà cực hướng về); 2D/3D, so sánh 2–3 mốc.
- **Vùng Thủ đô** — Hà Nội là hạt nhân, nối 6 tỉnh, thành lân cận (tên sau sắp xếp 2025): Thái Nguyên (Bắc), Bắc Ninh (Đông Bắc), Hưng Yên (Đông Nam),
  TP Hải Phòng (Đông), Ninh Bình (Nam), Phú Thọ (Tây Bắc). Ranh giới thật của Hà Nội (viền vàng, hạt nhân) và 6 tỉnh (tô theo chủ đề) lấy từ
  OpenStreetMap (`npm run data:provinces` → `src/future-map/data/provinces.json`, đã đơn giản hoá; phần lãnh hải được lớp nước của bản đồ nền che).
  Mỗi hướng có mũi tên màu theo chủ đề (công nghiệp, logistics, du lịch, y tế – dịch vụ),
  bộ lọc chủ đề, thời gian lái xe từ trung tâm Hà Nội, và thẻ chi tiết: chức năng, tên tỉnh trước sáp nhập, điểm đáng chú ý kèm nguồn, hạ tầng dọc hướng
  (cao tốc, đường sắt Lào Cai – Hà Nội – Hải Phòng, đường sắt tốc độ cao Bắc – Nam, vành đai 4 và 5, sân bay Gia Bình, Bệnh viện Bạch Mai cơ sở 2) với
  trạng thái theo từng mốc, các cực của Hà Nội hướng về đó, và liên kết sang Living Score (gợi ý nơi sống nếu đi làm theo hướng này) và Business Copilot.

**Dữ liệu có nguồn** (`backend-node/src/future-map/data.js`, `region.js`): mỗi đối tượng ghi nguồn — QĐ 2512/QĐ-UBND (2026), QĐ 1668/QĐ-TTg và 1569/QĐ-TTg (2024),
NQ 188/2025/QH15, NQ 202/2025/QH15 (sắp xếp tỉnh), cổng thông tin Hà Nội và báo chí (Báo Chính phủ, Dân trí, Thanh Niên, Tuổi Trẻ, VnEconomy…).
Chức năng của từng hướng vùng trích từ **phóng sự VTV24** và được ghi rõ là như vậy (không phải nguyên văn quy hoạch). Hình học là **sơ đồ gần đúng**.
Thời gian lái xe: bảng OSRM trên đường bộ OSM (khi đường thông thoáng), tạo bằng `npm run data:region` → `src/future-map/data/region-times.json`.

**Hỏi đáp**: câu hỏi gợi ý (trả lời bằng quy tắc từ dữ liệu, kể cả 3 câu về vùng Thủ đô) và câu hỏi tự do — Claude trả lời chỉ từ dữ liệu có nguồn khi có
`ANTHROPIC_API_KEY`, nếu không thì trả lời tự động từ dữ liệu; server chỉ giữ các mã nguồn có thật và tự gắn trích dẫn. Song ngữ Việt/Anh, link chia sẻ
giữ mốc, phạm vi, cực/hướng đang chọn (`?year=2035&view=region&corridor=hai-phong&lang=en`).

API (tiền tố `/api/future-map`, đều nhận `lang=vi|en`):

| Method | Đường dẫn | Mô tả |
|---|---|---|
| GET | `/timeline` | Các mốc, chỉ số có nguồn |
| GET | `/scenario?year=2035` | Lớp bản đồ Hà Nội (GeoJSON) + chỉ số của một mốc |
| GET | `/hubs/:slug?year=2035` | Một cực: vai trò, tuyến, trục, hướng kết nối vùng, nguồn |
| GET | `/region?year=2035` | Vùng Thủ đô: 6 hướng, mũi tên, hạ tầng vùng, nguồn |
| GET | `/region/corridors/:slug?year=2035` | Một hướng: chức năng, điểm đáng chú ý, hạ tầng theo mốc, cực liên quan, thời gian lái xe |
| GET | `/compare?years=2026,2035,2065` | So sánh 2–3 mốc |
| GET | `/questions` | Câu hỏi gợi ý |
| POST | `/ask` | `{ "question": "region-commute", "year": 2026 }` → trả lời bằng quy tắc |
| POST | `/ask-ai` | `{ "question": "Bắc Ninh sẽ phát triển thế nào?", "year": 2035 }` → Claude hoặc trả lời tự động |

Frontend: `frontend/src/app/future-map/` (MapLibre, nền OpenFreeMap). Kiểm thử: `cd backend-node && npm test` (`test/future-map.test.js`).

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

Phường/xã nào ở Hà Nội đang có metro, cầu, Vành đai 4 và cực phát triển mới — và điều đó có ý nghĩa gì với nơi định mua.
Đơn vị là **79 phường/xã mới (2025)** (cùng bộ ranh giới với Bản đồ Cơ hội Kinh doanh). Giao diện **Việt/Anh** (nút chuyển trên thanh sản phẩm),
nền bản đồ **OpenFreeMap** (vector, không cần key; ảnh vệ tinh Esri là tuỳ chọn; tự dùng nền trơn nếu tải nền quá 8 giây). Ba trang:

- **Tổng quan** (`/property-intelligence`): ô hỏi AI, số liệu tổng, thẻ phường nổi bật (phường ngoài lõi trung tâm có nhiều hạ tầng sắp có,
  cực phát triển và công trình mới nhất).
- **Bản đồ phân tích** (`/property-intelligence/map`): 79 phường/xã có tên hiện cả khi nhìn toàn thành phố, tô màu theo điểm tiềm năng /
  kết nối metro / hạ tầng sắp có; lớp cực phát triển (QĐ 2512), công trường (OSM), metro, vùng TOD 800 m, cầu & Vành đai 4, trường & y tế,
  mật độ dân cư, công viên, dự án và nhiệt độ giá (minh hoạ); mốc **2026 / 2030 / 2045** đổi trạng thái công trình (đang xây → dự kiến xong).
  Bảng phường: điểm, hạng, **vì sao có điểm này** (6 tiêu chí kèm số liệu), hạ tầng trong 4 km (năm dự kiến, nguồn), cực phát triển,
  **giá đất Nhà nước 2026** của phường, **thị trường căn hộ Hà Nội** theo quý, dự án có giá công bố gần đó, **liên kết** sang Bản đồ Cơ hội
  Kinh doanh, Living Score, Future Map, Business Copilot, danh sách nguồn, nút **Chia sẻ** (link `?ward=&horizon=&lang=`).
  Có thể tô màu bản đồ theo giá đất Nhà nước.
- **Dự án** (`/property-intelligence/projects/:slug`): 12 dự án có giá được báo chí công bố, đặt ở vị trí thật trên OSM — giá/m² và loại giá,
  so với giá sơ cấp trung bình Hà Nội (CBRE), giá căn 70 m² theo giá đó, giá đất Nhà nước của phường, ga metro, trường, y tế, công viên,
  hạ tầng sắp có trong 3 km; báo cáo in/PDF có nguồn.

**Dữ liệu thật** (`model.js`): ranh giới + dân số 1/7/2025 (OSM, gis.vn), chung cư và công trường (`data:opportunity`); trường, y tế, siêu thị/chợ,
công viên, điểm xe buýt, ga metro (`data:living`); tuyến metro đang chạy/đang xây (OSM) và tuyến quy hoạch, 9 cực phát triển (dữ liệu Future Map,
có nguồn QĐ 2512, NQ 188…); hình học **Vành đai 4** và các cầu **Trần Hưng Đạo, Tứ Liên, Thượng Cát** đang xây cùng công trường ≥ 2 ha
(`npm run data:property` → `src/property-intel/data/infra-osm.json`), tiến độ theo báo Nhân Dân, CafeF, Dân Việt.

**Điểm tiềm năng** (0–100, so tương đối giữa 79 phường/xã) = kết nối metro & xe buýt 25% · hạ tầng sắp có 25% (đang xây ×1, quy hoạch ×0,5,
trong 4 km) · cực phát triển QĐ 2512 15% (lõi trung tâm hiện hữu tính một nửa) · tiện ích đô thị 15% · mật độ dân cư 10% · phát triển mới 10%.
Xã chưa có số dân được chấm trên 5 tiêu chí còn lại và gắn nhãn.

**Giá — mọi con số có nguồn:**

- **Giá đất Nhà nước 2026** theo phường (`npm run data:landprice` → `src/property-intel/data/land-price.json`): bảng giá đất của
  Nghị quyết 52/2025/NQ-HĐND (áp dụng từ 1/1/2026, 17 khu vực), giá đất ở VT1 (mặt đường). Tên đường trong bảng được ghép với đường cùng tên
  trên OpenStreetMap thuộc các phường của khu vực đó; giá của phường = trung vị (và cao nhất) các tuyến tìm thấy. 67/79 phường tính từ đường của
  chính mình, 11 phường/xã (chủ yếu xã, nơi bảng ghi theo đoạn tuyến) dùng trung vị khu vực và được ghi chú. Bản Excel lấy từ bản tổng hợp của
  thuviennhadat.vn. Giá Nhà nước thường thấp hơn giá thị trường nhiều — trang ghi rõ điều này.
- **Thị trường căn hộ Hà Nội** (`market.js`): giá sơ cấp, thứ cấp, số căn mở bán/bán được theo quý IV/2025, I/2026, II/2026 của CBRE và giá
  quý II/2026 của Savills, mỗi quý dẫn bài báo đăng lại báo cáo. Các báo cáo không chia theo phường nên đây là số toàn thành phố.
  Số căn mở bán quý II/2026 suy ra từ 16.600 căn nửa đầu năm (có ghi chú).
- **12 dự án** có giá chào bán / dự kiến / rao bán được báo chí công bố năm 2026 (Người Quan Sát, VietNamNet), toạ độ từ OSM; CT14 Mandala
  đặt gần đúng ở phường Yên Sở (bài chỉ nêu phường). Đây là giá chào bán, không phải giá giao dịch.
- Đã bỏ: giá theo quận mẫu, tỷ lệ hấp thụ và lợi suất mẫu, kịch bản tăng giá, lịch sử giá nội suy, điểm phát triển/rủi ro dự án và nút đổi
  VND/USD (tỷ giá không có nguồn).

**Hỏi Property AI** (`analyst.js`): khi có `ANTHROPIC_API_KEY`, Claude trả lời **chỉ từ dữ liệu trang** (khối dữ liệu được cache), trả về mã
phường/dự án/nguồn; server giữ lại mã có thật, tự gắn bảng so sánh và đường dẫn nguồn. Câu hỏi về giá được trả lời bằng giá đất Nhà nước,
thị trường căn hộ và giá dự án gần đó, luôn nói rõ loại giá. Không có key (hoặc Claude lỗi) thì dùng bộ trả lời
theo mẫu trên cùng dữ liệu. Nhận diện ý định (phân tích / so sánh / giá / hạ tầng tương lai / báo cáo / dự án) và tên phường/xã có dấu hay không dấu.

| Method | Đường dẫn (tiền tố `/api/property-intel`, mọi GET nhận `lang=vi\|en`) | Mô tả |
|---|---|---|
| GET | `/overview` | Số liệu tổng, phường nổi bật, ngày dữ liệu, cách tính |
| GET | `/wards` · `/wards/:slug` | 79 phường/xã xếp hạng · chi tiết (tiêu chí, hạ tầng, cực, giá đất, thị trường, dự án, liên kết, nguồn) |
| GET | `/projects` · `/projects/:slug` | 12 dự án có giá công bố · phân tích sâu với bối cảnh thật |
| GET | `/map?horizon=2026\|2030\|2045` | Các lớp GeoJSON theo mốc |
| GET | `/search?q=` | Tìm phường/xã (khớp nguyên từ trước) và dự án |
| POST | `/ask` | `{ question, intent?, ward?, project?, lang? }` → câu trả lời có nguồn |

Kiểm thử: `cd backend-node && npm test` (bộ `test/property-intel.test.js`, `test/landprice.test.js`), `cd frontend && npx ng test` (`property-intel/pi.spec.ts`).

## Ảnh thật của Hanoi Time Machine

Mục timeline và bảng chi tiết trên bản đồ của Time Machine hiển thị **ảnh thật** của 13 địa danh (Hồ Gươm, Phố Cổ, Ba Đình, Văn Miếu, Nhà Hát Lớn, Chùa Một Cột, Hoàng thành Thăng Long, Cầu Long Biên, Nhà thờ Lớn, Hồ Tây & chùa Trấn Quốc, Nhà tù Hỏa Lò, Chợ Đồng Xuân, Ga Hà Nội), lấy từ Wikimedia Commons (phạm vi công cộng hoặc Creative Commons).
Ảnh nằm ở `frontend/public/images/time-machine/<địa-danh>-<mốc>.jpg`; danh sách, chú thích, tác giả, giấy phép và liên kết trang gốc nằm trong
`frontend/src/app/pages/time-machine/time-machine-photos.ts` (mỗi ảnh hiện đủ ghi nguồn và link về trang Commons).

- Ảnh tư liệu ghi **đúng năm chụp** trong chú thích; vài ảnh gần mốc thay vì đúng mốc (ví dụ Hồ Gươm ~1900 cho mốc 1926, Giao thông Hà Nội 1978 cho mốc 1975, mít tinh trước Nhà Hát Lớn 8/1945 cho mốc 1954).
- Ô nào chưa có ảnh phù hợp (Hồ Gươm 1975, Ba Đình 1926, Văn Miếu 1954/1975, Nhà Hát Lớn 1975) vẫn dùng hình minh hoạ và có ghi chú "Chưa có ảnh tư liệu".
- Mốc 2050/2100 là kịch bản tương lai nên luôn dùng hình minh hoạ, không thể có ảnh thật.
- Muốn thêm/đổi ảnh: chép file vào thư mục trên, thêm một mục vào `LANDMARK_PHOTOS` (kèm tác giả và giấy phép). Giấy phép CC BY / BY-SA yêu cầu ghi nguồn — giữ nguyên `author`, `license`, `pageUrl`.

## Hướng phát triển tiếp (Bản đồ Cơ hội Kinh doanh)

- Bổ sung nguồn cửa hàng đầy đủ hơn OSM (ví dụ dữ liệu đăng ký kinh doanh) để mức cạnh tranh sát thực tế.
- Chấm thêm các xã ngoại thành khi có số liệu dân số; thêm giá thuê mặt bằng khi có nguồn đáng tin.
- Cho phép vẽ bán kính quanh một địa chỉ thay vì chỉ theo ranh giới phường/xã.

## Lưu ý môi trường

Máy chủ ô bản đồ `tile.openstreetmap.org` từ chối kết nối trên một số mạng, nên mọi bản đồ dùng nền vector **OpenFreeMap** (không cần key).
Các bản đồ được vẽ dữ liệu ngay khi style đã nạp (`style.load`), không chờ mọi ô nền — một ô nền bị treo không còn làm mất lớp dữ liệu.
