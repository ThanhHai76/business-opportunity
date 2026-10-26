# Hanoi Century Vista — Bản đồ Cơ hội Kinh doanh và các công cụ đô thị

Bộ công cụ về Hà Nội: **Bản đồ Cơ hội Kinh doanh**, Hanoi Time Machine, Hanoi Living Score, Hanoi Future Map,
AI Property Intelligence.

**Tên hiển thị cho người dùng** (giao diện tiếng Việt; giao diện tiếng Anh giữ tên tiếng Anh; đường dẫn URL và API không đổi).
Phần còn lại của README gọi công cụ bằng tên kỹ thuật ở cột giữa:

| Tên hiển thị | Tên kỹ thuật | Đường dẫn |
|---|---|---|
| Mở gì ở đâu | Bản đồ Cơ hội Kinh doanh (Business Opportunity Map) | `/opportunity-map` |
| Hà Nội xưa và nay | Hanoi Time Machine | `/time-machine` |
| Hà Nội tương lai | Hanoi Future Map | `/future-map` |
| Chấm điểm bất động sản | AI Property Intelligence (trợ lý: "AI bất động sản" / Property AI) | `/property-intelligence` |
| Điểm đáng sống | Hanoi Living Score | `/living-score` |
| La bàn nghề nghiệp Hà Nội | Career compass (định hướng việc làm, chỉ giao diện) | `/career` |

Đổi tên hiển thị ở: `components/site-nav/site-nav.component.ts` (thanh điều hướng), `pages/home/home.component.html` (thẻ trang chủ),
`app.routes.ts` · `living-score.routes.ts` · `pi.routes.ts` (tiêu đề tab), `services/seo.service.ts` và `index.html` (mô tả cho công cụ tìm kiếm),
và các file `*-i18n.ts` của từng công cụ.

- **Frontend**: Angular 18 (standalone components, signals) + MapLibre GL với nền OpenFreeMap.
- **Backend**: `backend-node/` — Node.js/Express, dữ liệu đọc từ file (không bắt buộc DB), cổng 8000.

### Bản đồ Cơ hội Kinh doanh (`/opportunity-map`, API `/api/opportunity`)

Phường nào ở Hà Nội nên mở gì — hôm nay và 3–5 năm tới? Bản đồ tô màu **79 phường/xã mới (2025)** của Hà Nội (khu vực đô thị và ven đô)
theo điểm cơ hội của **12 ngành** (☕ cà phê, 🍜 ăn uống, 🏋️ gym, 🧒 giáo dục trẻ em, 🛒 tiện lợi, 💇 làm đẹp, 🏥 nhà thuốc/phòng khám, 🐾 thú cưng,
🏠 môi giới BĐS, 🧺 giặt ủi, 📚 nhà sách, 🚗 sửa/rửa xe).

- **Dữ liệu thật từ OpenStreetMap** (`npm run data:opportunity` → `backend-node/src/opportunity/data/hanoi-wards.json`): ranh giới và **dân số
  phường/xã**, số cơ sở kinh doanh từng ngành (mức cạnh tranh), văn phòng, chung cư, trường học và **mầm non (đếm riêng,
  `npm run data:kindergartens`)**, ga metro đang chạy, công trường đang xây (`landuse=construction`) và đoạn metro đang xây. Bảng chi tiết phường ghi
  rõ các số văn phòng, chung cư, trường, mầm non là **đếm trên OpenStreetMap, có thể thấp hơn thực tế**.
- **Dân số và diện tích chính thức**: dân số từng phường/xã (1/7/2025) lấy từ danh sách 126 xã, phường sau sắp xếp
  (`src/opportunity/data/ward-list-2025.json`, nguồn Báo Hà Nội Mới), áp bằng `npm run data:wards-official` (và tự áp khi dựng lại dữ liệu OSM).
  Test `ward-data.test.js` kiểm tra mọi phường khớp danh sách và diện tích ranh giới lệch dưới 8%.
- **Ga metro dùng chung** (`src/metro/stations.js`, `npm run data:stations`): toạ độ ga bám OpenStreetMap, dùng cho cả Mở gì ở đâu và Chấm điểm bất động sản.
- **Cách tính** (`src/opportunity/model.js`): Nhu cầu = dân số và các tín hiệu nhu cầu theo trọng số từng ngành, tương đối giữa các phường (thang căn bậc hai,
  100 = cao nhất). Cạnh tranh = số cơ sở cùng ngành trên 10.000 dân, tương đối. **Cơ hội = nhu cầu − 0,4 × cạnh tranh.** Mốc **2030** cộng thêm
  0,25 × tín hiệu tăng trưởng (công trình đang xây trong phường, metro đang xây gần đó).
- **Trung thực về dữ liệu**: phường/xã chưa có dân số trên OSM không được chấm (tô xám). Ngành OSM ghi nhận quá ít trên toàn bản đồ (< 100 cơ sở: gym,
  thú cưng, môi giới, giặt ủi, nhà sách) gắn "dữ liệu thưa" và không bao giờ là gợi ý hàng đầu; phường có độ phủ OSM quá thấp so với dân số gắn cờ
  độ tin cậy thấp. Mọi màn hình đều ghi rõ OSM chưa đủ cửa hàng nhỏ — cần khảo sát thực địa.
- **Hai cách dùng**: chọn ngành trước (bản đồ tô theo ngành đó, xếp hạng 10 phường tốt nhất có số trên bản đồ) hoặc chọn phường trước (gợi ý ngành).
  Thẻ phường giải thích điểm từng thành phần (dân số, văn phòng, chung cư, trường học, metro, tăng trưởng, trừ cạnh tranh), hiện đối thủ trên bản đồ,
  thêm vào **so sánh 2–3 phường**, liên kết AI Property Intelligence.
- **Tính khả thi** (gộp từ Business Copilot cũ): máy tính lãi/lỗ cho ngành đang chọn — doanh thu, chi phí (thuê, lương, giá vốn, điện nước,
  khác), lãi/tháng, vốn ban đầu, thời gian hoàn vốn, số khách cần để hoà vốn, vốn đủ hay thiếu. Đây là máy tính trên **giả định của người dùng**
  (số mặc định theo ngành chỉ là điểm xuất phát, gắn nhãn "GIẢ ĐỊNH"), không phải dữ liệu thị trường. **Báo cáo** in/PDF cho phường + ngành
  gồm điểm, phân rã, kết quả tính khả thi, giả định đã dùng và nguồn. Có **dòng tiền lũy kế 36 tháng** với giai đoạn khởi động (doanh thu
  tăng dần trong vài tháng đầu) và tháng hoà vốn.
- **Lập kế hoạch kinh doanh**: gõ ý tưởng tự nhiên (*"Tôi có 800 triệu, muốn mở nhà thuốc"*, *"I have 500M VND for a coffee shop"*) →
  `POST /api/opportunity/parse` nhận ra ngành, vốn, phường → xếp hạng phường/xã theo **lãi mỗi tháng trên giả định của bạn**, phường đủ vốn
  trước. Tuỳ chọn "Điều chỉnh theo từng phường": lượng khách theo điểm cơ hội (×0,6–1,4) và giá thuê theo giá đất Nhà nước 2026 (×0,5–2,5)
  so với phường trung vị — là giả định tương đối, có ghi chú ở từng phường. Mỗi phường có nhãn **rủi ro Thấp/Vừa/Cao** theo điểm: vượt vốn +2,
  không hoàn vốn trong 36 tháng +2 (sau 18 tháng +1), biên lãi < 10% +2 (< 20% +1), cạnh tranh ≥ 66 +1; từ 4 điểm là cao, 2–3 là vừa (cũng có trong báo cáo).
  Nếu backend chưa có `/parse` (bản cũ, 404) hoặc không kết nối được, trình duyệt tự đọc ý tưởng (`op-parse.ts`, cùng quy tắc).
- **Bảng thị trường**: mọi phường/xã đã chấm điểm trong một bảng — điểm, nhu cầu, cạnh tranh, số cơ sở, /10.000 dân, dân số, giá đất Nhà nước;
  bấm tiêu đề để sắp xếp, lọc theo tên, lọc **"chỗ còn trống"** (nhu cầu ≥ trung vị và cạnh tranh < trung vị), tải **CSV** (UTF-8, mở được bằng Excel).
- **So sánh** có **biểu đồ radar**: dân số, văn phòng, chung cư, trường học, metro, ít cạnh tranh, điểm cơ hội — mỗi trục 0–100 so với mọi phường.
- **Đối thủ cùng ngành**: danh sách tên các cơ sở OpenStreetMap ghi nhận trong phường, nút hiện trên bản đồ.
- **Hỏi AI**: Claude trả lời chỉ từ dữ liệu khi có `ANTHROPIC_API_KEY`, nếu không thì trả lời tự động từ dữ liệu; server chỉ giữ phường, ngành và nguồn có thật.
  Câu trả lời có cấu trúc: **Kết luận** (một câu), **Lý do** (1–4 ý kèm số liệu), **Rủi ro** (0–3 ý), và các phường/xã để mở trên bản đồ
  (trường `verdict`, `reasons[]`, `risks[]`; `answer` vẫn giữ toàn văn cho tương thích).
- **Báo cáo đã lưu**: nút "Lưu báo cáo" trong báo cáo, danh sách "Đã lưu (n)" trên thanh công cụ để mở lại (khôi phục ngành, mốc, giả định) hoặc xoá.
  Lưu **chỉ trong trình duyệt** (`localStorage`, tối đa 30, cùng ngành + phường + mốc thì thay bản cũ), không gửi lên server.
- **Song ngữ** Việt/Anh, **link chia sẻ** giữ ngành, mốc, phường, danh sách so sánh (`?type=cafe&horizon=2030&ward=phuong-lang&compare=…&lang=en`).

| Method | Đường dẫn | Mô tả |
|---|---|---|
| GET | `/api/opportunity/types` | 12 ngành, trọng số nhu cầu, độ đầy đủ dữ liệu |
| GET | `/api/opportunity/wards?type=&horizon=now\|2030` | GeoJSON phường/xã + điểm (theo ngành: kèm nhu cầu, cạnh tranh, số cơ sở, /10.000 dân; hoặc ngành tốt nhất), giá đất, cách tính, nguồn |
| GET | `/api/opportunity/wards/:slug?horizon=` | Một phường: số liệu, điểm 12 ngành kèm phân rã, độ phủ OSM |
| GET | `/api/opportunity/wards/:slug/places?type=` | Các cơ sở cùng ngành trong phường (đối thủ) |
| GET | `/api/opportunity/compare?slugs=a,b[,c]&type=` | So sánh 2–3 phường (kèm `signals` 0–100 cho biểu đồ radar) |
| POST | `/api/opportunity/parse` | `{ text, lang? }` → `{ type, budget, ward }` từ ý tưởng kinh doanh |
| POST | `/api/opportunity/ask` | `{ question, type?, ward?, horizon?, lang? }` → `{ answer, verdict, reasons[], risks[], wards[], types[], sources[] }` từ dữ liệu |

## Điều hướng chung

Cả năm công cụ (Bản đồ Cơ hội Kinh doanh, Hanoi Time Machine, Hanoi Living Score, Hanoi Future Map, AI Property Intelligence) dùng **một thanh điều hướng chung** `frontend/src/app/components/site-nav/`,
đặt trong `AppComponent`: logo "Hanoi Century Vista" (về Trang chủ) và sáu tab. Mỗi trang chỉ giữ thanh phụ riêng cho việc của nó
(chọn thành phố / mục lục chương / Khám phá · So sánh · AI · Đã lưu · Cá nhân). Chiều cao thanh chung là biến CSS `--site-nav-h` (`styles.css`);
trang chiếm cả khung nhìn phải trừ biến này thay vì dùng `100vh`.

### Giao diện sáng / tối

Nút mặt trăng/mặt trời trên thanh chung đổi giao diện cho **toàn bộ** ứng dụng (Trang chủ, Cơ hội Kinh doanh, Time Machine, Living Score, Future Map, Property Intelligence).
`ThemeService` (`frontend/src/app/services/theme.service.ts`) lưu lựa chọn ở `localStorage` (`hanoi100.theme`: `light` | `dark` | `system`), mặc định theo hệ điều hành,
và ghi kết quả vào `<html data-theme="light|dark">` (một script nhỏ trong `index.html` áp dụng trước khi vẽ để không bị nháy màu).
Bộ màu dùng chung là các biến `--app-*` trong `frontend/src/styles.css`; mỗi trang đọc các biến này (Time Machine có bộ token sáng riêng `--tm-*`).
Trang "Cá nhân" của Living Score vẫn có lựa chọn Theo hệ thống / Sáng / Tối, cùng điều khiển một theme.

## Cấu trúc thư mục

```
project/
├── backend-node/              # Node.js (Express) — API của mọi công cụ
│   ├── server.js               # Mount các router, CORS
│   ├── scripts/                # Dựng dữ liệu từ OpenStreetMap/OSRM (npm run data:*)
│   ├── src/
│   │   ├── opportunity/        # Bản đồ Cơ hội Kinh doanh (/api/opportunity/...) — phường/xã Hà Nội, dữ liệu OSM
│   │   ├── living-score/       # Hanoi Living Score (/api/living-score/...) — xem mục bên dưới
│   │   ├── future-map/         # Hanoi Future Map (/api/future-map/...) — quy hoạch có nguồn 2026-2065 + Vùng Thủ đô
│   │   ├── property-intel/     # AI Property Intelligence (/api/property-intel/...) — phường/xã, giá đất 2026, thị trường, dự án
│   │   ├── accounts/           # Tài khoản, phiên đăng nhập, báo cáo đã lưu (/api/account/...)
│   │   ├── billing/            # Mua lượt báo cáo: gói, đơn hàng, webhook, cổng giả (/api/billing/...)
│   │   └── reports/            # Báo cáo khả thi trả phí: tính trên server, trang in PDF (/api/reports/...)
│   ├── database/living-score/  # 01-schema.sql — schema PostgreSQL/PostGIS
│   ├── database/accounts/      # 01-schema.sql tài khoản · 02-billing.sql đơn hàng, lượt, báo cáo trả phí
│   ├── test/                   # node --test: mọi API
│   ├── Dockerfile · .env.example
│   └── package.json
├── docker-compose.yml        # PostGIS + Redis + backend-node + frontend (nginx)
└── frontend/                 # Angular 18 (Trang chủ + 3 công cụ), có Dockerfile + nginx.conf
    └── src/app/
        ├── app.component.*         # Thanh điều hướng chung + router-outlet
        ├── components/site-nav/    # Thanh điều hướng chung (logo Hanoi Century Vista + 3 tab)
        ├── opportunity/            # Bản đồ Cơ hội Kinh doanh (lazy route /opportunity-map, MapLibre)
        ├── pages/                  # home, time-machine
        ├── living-score/           # Hanoi Living Score (lazy route /living-score, MapLibre)
        ├── future-map/             # Hanoi Future Map (lazy route /future-map, MapLibre)
        ├── property-intel/         # AI Property Intelligence (lazy route /property-intelligence, MapLibre)
        └── career/                 # La bàn nghề nghiệp Hà Nội (lazy route /career): dữ liệu có nguồn, xếp hạng bằng quy tắc
```

## Chạy Backend

```bash
cd backend-node
npm install
npm start        # hoặc: npm run dev (tự restart khi sửa code)
```

Backend chạy tại `http://localhost:8000`; các API: `/api/opportunity`, `/api/living-score`, `/api/future-map`,
`/api/property-intel`, `/api/time-machine`.

## Chạy Frontend (Angular)

```bash
cd frontend
npm install
npm start        # = ng serve, chạy tại http://localhost:4200
```

Trên localhost frontend gọi backend tại `http://localhost:8000`; khi deploy (tên miền khác localhost) frontend gọi `/api` trên **chính tên miền
của trang** — nginx chuyển tiếp sang backend (`frontend/nginx.conf`). Cấu hình trong `frontend/src/app/config.ts`.

**Ảnh xem trước khi chia sẻ link** (Facebook, Zalo, Messenger đọc thẻ trong file HTML, không chạy JavaScript): sau `ng build`, `npm run build` chạy
`scripts/route-meta.mjs` tạo thêm `career.html`, `opportunity-map.html`… — bản sao của `index.html` với tiêu đề, mô tả, link chuẩn và thẻ chia sẻ riêng
của từng trang (tiêu đề lấy từ `app.routes.ts`, mô tả từ `seo.service.ts`). `frontend/nginx.conf` phục vụ `/career` từ `career.html`.
Thêm một trang mới: thêm vào `PAGES` của script đó và vào `ROUTE_DESCRIPTIONS`.

**Lưu ý:** phải chạy backend trước (hoặc song song) thì bản đồ mới có dữ liệu — CORS đã được mở sẵn cho `http://localhost:4200`.

## Tài khoản & lưu báo cáo (API `/api/account`, PostgreSQL)

Đăng ký / đăng nhập bằng email + mật khẩu (nút **Đăng nhập** trên thanh chung). Báo cáo lưu trên Bản đồ Cơ hội Kinh doanh được giữ
**trong tài khoản** và mở được trên mọi thiết bị; chưa đăng nhập thì vẫn lưu trong trình duyệt như trước. Khi đăng nhập, báo cáo đang có
trong trình duyệt được **chuyển vào tài khoản** (bản mới hơn trong tài khoản không bị ghi đè) rồi xoá khỏi trình duyệt.

- **Bảng** (`backend-node/database/accounts/01-schema.sql`, server tự tạo khi khởi động — chạy được cả trên Supabase/Neon/RDS):
  `app_users` (email duy nhất không phân biệt hoa thường, mật khẩu băm **scrypt**), `app_sessions` (chỉ lưu **SHA-256** của token phiên),
  `saved_items` (mỗi mục một dòng, nội dung `JSONB`, `kind` + `item_key` duy nhất theo người dùng — dùng chung cho các loại mục lưu sau này:
  phường đã lưu của Living Score, danh sách theo dõi của Property Intel…). Xoá tài khoản xoá luôn phiên và mọi mục đã lưu (`ON DELETE CASCADE`).
- **Phiên đăng nhập**: token ngẫu nhiên 32 byte trong cookie `h100_sid` — `HttpOnly`, `SameSite=Lax`, `Path=/api`, `Secure` khi production,
  hạn 30 ngày. Đổi mật khẩu đăng xuất mọi thiết bị khác.
- **Bảo mật**: chống CSRF (yêu cầu thay đổi dữ liệu phải đến từ origin của ứng dụng), giới hạn 10 lần đăng nhập / 15 phút và 10 lần đăng ký /
  giờ theo IP, sai email hay sai mật khẩu trả cùng một thông báo và mất cùng thời gian, dữ liệu vào kiểm tra bằng Zod (`strictObject`),
  tối đa 30 báo cáo mỗi người.
- **Chế độ** (`ACCOUNTS`): `auto` (mặc định — bật khi có `DATABASE_URL`; nếu không kết nối được database thì tắt tài khoản, các công cụ khác vẫn
  chạy), `postgres` (bắt buộc, server dừng nếu lỗi), `memory` (chỉ để phát triển, mất khi khởi động lại), `off`. Database phải dùng **UTF8**
  (server kiểm tra khi khởi động).

| Method | Đường dẫn | Mô tả |
|---|---|---|
| GET | `/api/account/me` | `{ enabled, user }` — không bao giờ 401 |
| POST | `/register` · `/login` · `/logout` | Đăng ký · đăng nhập (đặt cookie) · đăng xuất |
| PATCH · DELETE | `/me` | Đổi tên hiển thị · xoá tài khoản (cần mật khẩu) |
| POST | `/me/password` | Đổi mật khẩu |
| GET · PUT · DELETE | `/reports` | Danh sách · lưu (cùng ngành + phường + mốc thì thay bản cũ) · xoá tất cả |
| POST · DELETE | `/reports/import` · `/reports/:id` | Chuyển báo cáo từ trình duyệt vào tài khoản · xoá một báo cáo |

**Kiểm thử**: `npm test` chạy bộ kiểm thử tài khoản trên store trong bộ nhớ; đặt `TEST_DATABASE_URL=postgres://…` (database dùng một lần —
bảng bị xoá sạch) để chạy cùng bộ đó trên PostgreSQL thật.

### Thanh toán & báo cáo trả phí (API `/api/billing`, `/api/reports`)

Giai đoạn 1 bán **lượt báo cáo**: mỗi lượt đổi được một **báo cáo khả thi đầy đủ** cho một ngành + phường + mốc, theo giả định hiện tại của
người dùng. Trên Bản đồ Cơ hội Kinh doanh: mở **Báo cáo** của một phường → **Báo cáo đầy đủ (PDF)** → đăng nhập → chọn gói → thanh toán ở
tab mới (trang này tự cập nhật khi tiền về) → **Tạo báo cáo** → trang in mở ở tab mới, trình duyệt lưu thành PDF.

- **Báo cáo do server tính và lưu cố định** (`src/reports/`): trang chỉ gửi ngành, phường, mốc và giả định; server tính lại (công thức giống
  `op-feasibility.ts` — kiểm thử so khớp giả định mặc định hai bên) và giữ nguyên số liệu lúc tạo. Gồm: tóm tắt, nhu cầu và cạnh tranh của phường,
  kết quả kinh doanh và vốn, dòng tiền 36 tháng (biểu đồ + bảng), 4 kịch bản, rủi ro, 5 phường hợp hơn với cùng kế hoạch, giả định, nguồn.
  Dữ liệu vào sai (phường không có, chưa có điểm) bị từ chối **trước khi** trừ lượt. Báo cáo viết bằng tiếng Việt.
- **Gói và giá**: `backend-node/src/billing/products.js` (`report_1` 199.000 đ · `report_3` 449.000 đ — đổi tại đây).
- **Bảng** (`database/accounts/02-billing.sql`, server tự tạo): `billing_orders` (mã đơn số cho cổng thanh toán; xoá tài khoản vẫn giữ đơn để
  đối soát), `credit_ledger` (sổ cộng/trừ lượt — số dư là tổng; mỗi đơn chỉ được cộng một lần), `paid_reports`.
- **Chỉ webhook đã kiểm chữ ký mới cộng lượt** — không bao giờ dựa vào việc trình duyệt quay về `returnUrl`. Webhook lặp lại không cộng thêm;
  sai số tiền thì không cộng và ghi log để kiểm tra tay; trả tiền cho đơn đã huỷ/hết hạn vẫn được cộng (tiền đã về). Trừ lượt nằm trong
  transaction có khoá theo người dùng: tạo hai báo cáo cùng lúc không dùng chung một lượt. `returnUrl` chỉ được trỏ về trang của ứng dụng.
- **Cổng thanh toán** (`BILLING_PROVIDER`): `mock` — cổng **giả** để thử cả luồng không cần tiền (mặc định khi không phải production; production
  từ chối khởi động với `mock`); `off` — không bán (mặc định ở production); `payos` — thanh toán thật qua **PayOS** (VietQR, `src/billing/payos-provider.js`):
  cần `PAYOS_CLIENT_ID`, `PAYOS_API_KEY`, `PAYOS_CHECKSUM_KEY`. Đơn gửi sang PayOS có chữ ký HMAC-SHA256, nội dung chuyển khoản `HCV<mã đơn>`
  (tối đa `PAYOS_DESCRIPTION_MAX` ký tự), hết hạn cùng đơn (30 phút). Webhook `POST /api/billing/webhook/payos` kiểm chữ ký của `data`
  (khoá xếp theo bảng chữ cái); chỉ giao dịch `code: "00"` mới được cộng; giao dịch thử khi đăng ký webhook trả 200 mà không cộng gì.
  Đăng ký địa chỉ webhook: `npm run payos:webhook -- https://tên-miền/api/billing/webhook/payos`. `PAYOS_ORDER_OFFSET` cộng vào mã đơn để
  máy thử và máy thật không gửi trùng mã. Kiểm thử: `test/payos.test.js` (API PayOS giả, không cần mạng).

| Method | Đường dẫn | Mô tả |
|---|---|---|
| GET | `/api/billing/products` | `{ enabled, provider, products }` — công khai |
| GET | `/api/billing/me` | `{ credits, orders }` (10 đơn gần nhất) |
| POST | `/api/billing/checkout` | `{ product, returnUrl }` → `{ order, checkoutUrl }` |
| GET · POST | `/api/billing/orders/:id` · `/orders/:id/cancel` | Trạng thái đơn (`pending`/`paid`/`cancelled`/`expired`) · huỷ |
| POST | `/api/billing/webhook/:provider` | Thông báo thanh toán từ cổng (có chữ ký) |
| POST · GET | `/api/reports` | Tạo báo cáo (trừ 1 lượt, `402 no_credits` khi hết) · danh sách |
| GET | `/api/reports/:id` · `/api/reports/:id/print` | Nội dung · trang in A4 (lưu PDF) |

### Đưa lên mạng

**Hướng dẫn từng bước cho một máy chủ Linux (Docker + HTTPS tự động + sao lưu): xem [DEPLOY.md](DEPLOY.md)**
(`docker-compose.prod.yml`, `deploy/Caddyfile`, `.env.production.example`, `deploy/backup.sh`, `deploy/update.sh`).
Các ý dưới đây là điều kiện chung, dù bạn triển khai theo cách nào:

1. **PostgreSQL 13+ (UTF8)**: tự chạy (`docker compose up`) hoặc dịch vụ quản lý (Supabase, Neon, Railway…) → đặt `DATABASE_URL`.
2. **HTTPS** (Let's Encrypt / Cloudflare) rồi đặt `COOKIE_SECURE=true` (mặc định đã bật khi `NODE_ENV=production`).
3. Phục vụ trang và API trên **cùng một tên miền**: nginx của frontend đã chuyển `/api/` sang backend; đặt `TRUST_PROXY=1` để giới hạn
   tần suất theo IP thật, và `CORS_ORIGIN=https://<tên-miền>`.
4. `NODE_ENV=production` (localhost không còn được tin cậy về CORS/CSRF). Sao lưu database định kỳ.
5. Quên mật khẩu và xác minh email cần dịch vụ gửi email (`SMTP_URL`, `MAIL_FROM`, `APP_URL`); không có thì hai tính năng này tắt.
   Chưa có đăng nhập bằng Google.

## Hanoi Living Score (`/living-score`, API `/api/living-score`)

Chấm điểm mức độ đáng sống của **79 phường/xã** Hà Nội sau sắp xếp 2025 (5 tiêu chí có dữ liệu), bản đồ MapLibre, so sánh 2–3 phường/xã và AI gợi ý Top 3,
song ngữ Việt/Anh (`?lang=en` cho cả API lẫn giao diện) và link chia sẻ kèm trọng số (`?w=transportation:30,…`):
`Bản đồ → Tìm khu vực → Living Score → Chi tiết khu vực → So sánh → AI gợi ý`.

**Dữ liệu:** điểm được tính từ một bản chụp **OpenStreetMap** (© OpenStreetMap contributors, giấy phép ODbL) —
`backend-node/src/living-score/data/osm-hanoi.json`, tạo lại bằng `npm run data:living` (Overpass API, trong `backend-node/`).
Thời gian đi đường giữa các phường/xã: `data/commute.json` (79 × 79), tạo bằng `npm run data:commute` (bảng OSRM trên đường bộ OSM, ô tô, khi đường thông thoáng).

- Mỗi khu vực là một **phường/xã sau sắp xếp 2025**, ranh giới thật (OSM admin_level 6) lấy từ `src/opportunity/data/hanoi-wards.json` —
  **cùng bộ, cùng slug** với Bản đồ Cơ hội Kinh doanh và AI Property Intelligence, nên ba công cụ liên kết thẳng tới nhau theo phường.
  Phường có hình dạng lạ mà tâm hình học nằm ngoài ranh giới (Lĩnh Nam, Xuân Phương) được đo từ điểm nằm sâu nhất bên trong.
- Trước 10/2026 Living Score dùng 13 vùng minh hoạ quanh quận cũ; slug cũ (`cau-giay`, `tay-ho`…) vẫn mở được — API trả về phường chứa
  tâm quận cũ (`LEGACY_SLUGS`), giao diện sửa địa chỉ và tự chuyển danh sách đã lưu/so sánh trong trình duyệt sang slug mới.
- Mọi số liệu được đo trong **bán kính 1,5 km** (khoảng 20 phút đi bộ) quanh trung tâm: số ga metro đang khai thác và điểm dừng xe buýt,
  trường học/mầm non/cơ sở đào tạo, bệnh viện/phòng khám, siêu thị/cửa hàng tiện lợi/chợ/TTTM/quán cà phê, và tỷ lệ diện tích công viên và hồ ao
  (từ lưới phủ ~100 m dựng từ polygon OSM; sông, kênh không tính).
- Điểm là **tương đối** giữa 79 phường/xã (100 = nơi cao nhất) theo thang căn bậc hai — địa điểm đầu tiên gần nhà có giá trị hơn địa điểm thứ một trăm.
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

Schema `01-schema.sql` (`backend-node/database/living-score/`) được backend áp dụng mỗi lần khởi động khi `DATA_SOURCE=postgres` (idempotent);
backend tự nạp dữ liệu khi bảng `areas` trống (`AUTO_SEED=true`).
Postgres cài thẳng trên máy (không Docker): cần cài PostGIS, và tạo extension một lần bằng superuser vì user `living` không có quyền:
`psql -U postgres -d living_score -c "CREATE EXTENSION postgis;"`.
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
| `AI_PROVIDER` | `auto` | Hỏi AI của Cơ hội KD, Future Map, Time Machine, Property AI: `auto` (Claude nếu có key) hoặc `mock` (`src/ai-config.js`) |

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
   `pros`, `cons` theo JSON schema (Zod). Prompt cấm bịa số liệu, cấm bàn về giá thuê/an ninh/không khí (không có dữ liệu) và yêu cầu gọi đúng tên
   phường/xã (không gọi là quận). LLM **không** được đổi điểm hay thứ hạng. Nguồn (OSM, ODbL, ngày dữ liệu) do server gắn vào `sources`, không do model viết.
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

Schema ở `backend-node/database/living-score/01-schema.sql`: `areas` (boundary `MultiPolygon`, centroid `Point`), `area_scores`, `area_notes`, `amenities`,
`infrastructure`, `area_knowledge`; index GIST trên các cột hình học. Backend đọc hình học bằng `ST_AsGeoJSON`, lọc viewport bằng `&&`/`ST_MakeEnvelope`.
Ranh giới là ranh giới phường/xã trên OSM. Database tạo trước 10/2026: chạy `03-wards-2025.sql` rồi nạp lại với `SEED_RESET=true` (slug đổi).
Tuyến/ga metro dự kiến chỉ xấp xỉ.

### Kiểm thử

```bash
cd backend-node && npm test      # node --test: scoring, seed, recommendation engine, toàn bộ REST API (cơ hội KD + Living Score, data source in-memory)
```

### Giới hạn hiện tại

- An ninh, môi trường, giá thuê chưa có nguồn dữ liệu mở theo khu vực.
- Với xã rộng (> 15 km²), vòng đo 1,5 km chỉ phản ánh khu trung tâm; xã vùng ven điểm thấp một phần vì OSM còn thiếu địa điểm.
- Thời gian đi đường là ô tô khi đường thông thoáng (OSRM), chưa tính kẹt xe giờ cao điểm hay xe buýt/metro.
- Chưa có đăng nhập: khu vực đã lưu, danh sách so sánh, trọng số và giao diện được lưu ở `localStorage` của trình duyệt.
- Bản đồ nền dùng OpenFreeMap (vector tiles miễn phí, không cần key; dữ liệu © OpenStreetMap).
- Retrieval RAG mới theo chủ đề; nên chuyển sang pgvector khi kho tri thức lớn hơn.
- Phần PostgreSQL/PostGIS, Redis và Docker chưa được chạy kiểm thử trong môi trường phát triển ban đầu — hãy chạy `docker compose up --build` và xem `/api/living-score/health`.

## La bàn nghề nghiệp Hà Nội (`/career`)

Định hướng việc làm cho người thất nghiệp, đổi nghề, sinh viên mới ra trường và người đang đi làm muốn tham khảo thị trường: 5 câu hỏi → các hướng nghề hợp nhất, kèm điều nguồn công khai nói về Hà Nội, kỹ năng, lộ trình, chính sách hỗ trợ (Luật Việc làm 2025) và kênh việc làm chính thống. **Không đăng tin tuyển dụng.**
Trang chia 5 tab (có thể mở thẳng bằng `?tab=`: `paths`, `plan`, `market`, `map`, `support`): Hướng nghề của bạn (bảng hỏi và kết quả), Kế hoạch 30 ngày (kèm tiến độ trên tab), Thị trường, Bản đồ (tạo khi mở lần đầu và giữ nguyên ngành, nhà, vùng đã chọn khi đổi tab), Hỗ trợ và nơi tìm việc; phần Nguồn luôn nằm dưới cùng.
**Báo sai số liệu**: mỗi phường và mỗi nguồn có nút gửi báo cáo (component `report-issue`, API `POST /api/feedback/data-report`, không cần tài khoản, giới hạn 5 báo cáo/giờ mỗi địa chỉ và 300/ngày cả trang, có ô bẫy bot). Lưu ở bảng `data_reports` (`database/accounts/07-data-reports.sql`); đọc bằng `npm run reports:list`. Không có cơ sở dữ liệu thì báo cáo chỉ ghi vào log và bộ nhớ.

**Hai ngôn ngữ**: tiếng Việt và tiếng Anh (nút đổi ở đầu trang, `?lang=en`, nhớ lựa chọn dùng chung khoá với Mở gì ở đâu, tiêu đề trang đổi theo). Con số, trích dẫn và liên kết nằm một chỗ ở `career.data.ts`; lời tiếng Anh ở `career.en.ts` (nội dung), `career.ui.ts` (chữ của trang và bản đồ), cùng tham số `lang` của `career.logic.ts`, `career.plan.ts`, `career.print.ts` (bản in PDF). Tên nguồn giữ nguyên tiếng Việt. Kiểm thử `career-en.spec.ts` bắt lỗi thiếu bản dịch, lệch con số/nguồn so với bản tiếng Việt và chữ tiếng Việt còn sót.

Chỉ có giao diện (không có API): dữ liệu nằm ở `frontend/src/app/career/career.data.ts`, mỗi con số gắn mã nguồn trích dẫn (có kiểm thử: mọi nguồn được dẫn đều có trong danh sách và ngược lại).
Mỗi hướng có mục **Nơi làm việc và nơi ở**: các điểm mốc đã có thời gian lái xe (OSRM, từ API Chấm điểm bất động sản) và các cực phát triển theo quy hoạch (khoảng cách đường chim bay, ghi rõ chưa phải nơi đã có việc làm); và **kế hoạch 30 ngày** (`career.plan.ts`) có checklist tick, lưu trên trình duyệt.
**Bản đồ ngành nghề theo khu vực** (`job-map-section.component.ts`, tải lười khi cuộn tới): chọn một trong 12 ngành dịch vụ của Mở gì ở đâu, tô 79 phường/xã theo số cơ sở (hoặc mật độ trên 10.000 dân; 5 nhóm theo phân vị, `career.jobmap.ts`), phủ lớp cực theo quy hoạch và điểm mốc; bấm một phường để xem ngành dày quanh đó. Là dấu hiệu nơi ngành tập trung (OpenStreetMap), **không phải số vị trí tuyển dụng**; công nghiệp, bán dẫn, logistics không tô màu vì không có số cơ sở đáng tin.
Từ phường người dùng ở, bản đồ còn có **vùng đi làm bằng ô tô** (15/20/30/45 phút, phường ngoài vùng bị làm mờ; ma trận thời gian giữa 79 phường từ OSRM, `npm run data:wardtimes` → `property-intel/data/commute.json`, API `GET /api/property-intel/commute/:slug`) và lớp **metro** ở ba mốc (hiện nay, 2027 khi các ga đang thi công mở, theo quy hoạch; API `GET /api/property-intel/metro-reach`, ga trong 1,5 km): phường nào cùng tuyến metro với nhà, và nhà nối với từng nơi làm bằng metro hay không. Dữ liệu chưa có lịch chạy nên **không ước tính thời gian đi metro**; hành lang tuyến theo quy hoạch chỉ là sơ đồ.
**Premium** (khoá khi đang bán Premium): lưu kế hoạch và câu trả lời vào tài khoản (`career.store.ts`: trình duyệt trước, đồng bộ `GET/PUT/DELETE /api/account/career/…`, tối đa 5 kế hoạch, gộp bản mới hơn khi đăng nhập, xoá bản trên trình duyệt khi đăng xuất; bảng `saved_items` thêm loại `career_plan`, `career_profile` ở `06-career.sql`), xuất PDF kế hoạch (`career.print.ts`, mang thông tin tư vấn viên đã lưu ở `/api/reports/brand`) và lớp **Nơi ở theo nơi làm** (`career.live.ts`: chọn 1–2 nơi làm, xếp các phường theo thời gian đi hoặc giá đất nhà nước thấp nhất, kèm metro cùng tuyến; API `GET /api/property-intel/commute-to/:target`). Gói miễn phí giữ 1 kế hoạch trên trình duyệt.
Xếp hạng bằng quy tắc minh bạch ở `career.logic.ts` (nền tảng 40, thời gian học 25, trình độ 20, làm thuê/tự kinh doanh 15), hiển thị trên trang. Phần lớn nguồn là báo chí dẫn số liệu nhà nước: **đối chiếu văn bản gốc trước khi dựa vào số liệu**, và cập nhật `DATA_DATE` khi rà lại.

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
  trạng thái theo từng mốc, các cực của Hà Nội hướng về đó, và liên kết sang Living Score (gợi ý nơi sống nếu đi làm theo hướng này) và Bản đồ cơ hội kinh doanh (phường/xã ở cửa ngõ).

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

## Business Copilot → đã gộp vào Bản đồ Cơ hội Kinh doanh

Business Copilot cũ (10 quận, dữ liệu dân số/thu nhập/giá thuê/đối thủ **demo**) trùng mục đích với Bản đồ Cơ hội Kinh doanh nên đã được gộp:
phần chấm điểm khu vực dùng dữ liệu thật theo 79 phường/xã của Bản đồ cơ hội; phần mô phỏng tài chính trở thành **Tính khả thi** trên giả định
của người dùng; báo cáo in/PDF và lưu báo cáo, bảng dữ liệu thị trường (sắp xếp/lọc/CSV), radar so sánh, mức rủi ro và câu trả lời AI có cấu trúc giữ lại. Dữ liệu demo đã xoá (`backend-node/src/business-copilot`, `frontend/src/app/business-copilot`).
Mọi đường dẫn cũ `/business-copilot/...` chuyển về `/opportunity-map`; cấu hình AI dùng chung chuyển sang `backend-node/src/ai-config.js`.

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
  Kinh doanh, Living Score, Future Map, danh sách nguồn, nút **Chia sẻ** (link `?ward=&horizon=&lang=`).
  Có thể tô màu bản đồ theo giá đất Nhà nước.
  **Chỉnh trọng số** 6 tiêu chí (điểm, hạng và màu bản đồ tính lại ngay trên trang; link chia sẻ giữ trọng số `?w=`),
  **so sánh** tối đa 3 phường cạnh nhau (`?c=`), **theo dõi** phường/dự án (nút ★ trên thanh trên cùng), **báo cáo phường** in/PDF.
  Lớp trường học & y tế (~2.000 điểm) chỉ tải khi bật (`/map/social`).
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
  chính mình (ghép theo tên đường và theo số hiệu QL./ĐT. của OSM), 8 xã dùng trung vị khu vực và được ghi chú. Bản Excel lấy từ bản tổng
  hợp của thuviennhadat.vn; lỗi chép đã biết được sửa trong script ("Lán" → Láng, "Đông Sơn" → Sơn Đồng ở khu vực 9). Bản PDF phụ lục
  chính thức là ảnh scan nên chưa đối chiếu tự động được từng dòng. Giá Nhà nước thường thấp hơn giá thị trường nhiều — trang ghi rõ điều này.
- **Thị trường căn hộ Hà Nội** (`market.js`): giá sơ cấp, thứ cấp, số căn mở bán/bán được theo quý IV/2025, I/2026, II/2026 của CBRE và giá
  quý II/2026 của Savills, mỗi quý dẫn bài báo đăng lại báo cáo. Các báo cáo không chia theo phường nên đây là số toàn thành phố.
  Số căn mở bán quý II/2026 suy ra từ 16.600 căn nửa đầu năm (có ghi chú).
- **24 dự án** có giá được báo chí công bố năm 2026 (Người Quan Sát, VietNamNet, VietnamFinance, Báo Xây dựng, CafeF, Vietstock), toạ độ từ
  OSM: giá chào bán / dự kiến / rao bán / môi giới chào và **6 dự án nhà ở xã hội** (giá tạm tính, tô viền xanh trên bản đồ, không so với
  giá thương mại). Dự án bài báo chỉ nêu phường thì đặt gần đúng ở tâm phường và ghi chú. Đây là giá chào bán, không phải giá giao dịch.
- **Thời gian lái xe** (`npm run data:travel` → `src/property-intel/data/travel.json`): từ tâm mỗi phường và từng dự án tới Hồ Gươm, khu văn
  phòng Cầu Giấy – Duy Tân, sân bay Nội Bài và ga metro gần nhất theo đường bộ — OSRM trên mạng đường OSM, đường thông thoáng (chưa tính kẹt xe).
- **Ga metro dùng chung** (`src/metro/stations.js`, `npm run data:stations` → `src/metro/data/metro-stations.json`): ga nào có, thuộc tuyến nào, đang chạy hay đang xây lấy từ bản chụp của Điểm đáng sống, còn **toạ độ lấy từ các nút ga trên OpenStreetMap** (bản chụp lệch tới ~1 km nên từng xếp nhầm ga vào phường bên cạnh). Bản đồ Cơ hội Kinh doanh, Chấm điểm bất động sản và La bàn nghề nghiệp cùng dùng bộ này; mỗi phường có "ga trong phường" và "ga gần nhất", và điểm cơ hội tính theo độ gần ga. Kiểm thử `metro-stations.test.js` bắt lỗi nếu hai công cụ lệch nhau.
- **Cập nhật mỗi quý**: thêm bài báo vào `SOURCES` và quý mới vào `QUARTERS` trong `market.js` (ghi rõ số suy ra), thêm dự án có giá công bố,
  chạy `npm run data:travel` rồi `npm test`. Số liệu hiện tính đến quý II/2026.
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
| GET | `/map/social` | Trường học & cơ sở y tế (tải khi bật lớp) |
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
