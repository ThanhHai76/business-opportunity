# Đưa Hanoi Century Vista lên mạng

Hướng dẫn này dùng **một máy chủ Linux (VPS)** chạy toàn bộ bằng Docker. Các file đã chuẩn bị sẵn:

| File | Việc của nó |
|---|---|
| `docker-compose.prod.yml` | Cả hệ thống: Caddy (HTTPS), nginx (giao diện), backend, PostgreSQL + PostGIS, Redis. Chỉ Caddy mở cổng 80 và 443 ra ngoài |
| `deploy/Caddyfile` | Tự xin và gia hạn chứng chỉ HTTPS miễn phí, chuyển `www` về tên miền chính, đưa `/api/*` về backend |
| `.env.production.example` | Mẫu file cấu hình `.env` (mật khẩu, tên miền, khoá AI, email) |
| `deploy/backup.sh` | Sao lưu database |
| `deploy/update.sh` | Cập nhật mã nguồn mới từ GitHub (có sao lưu trước) |

```
Người dùng ──HTTPS──► Caddy ──┬─ /api/*  ──► backend ──► PostgreSQL/PostGIS, Redis
                              └─ còn lại ──► nginx (bản build Angular)
```

> **Đã kiểm chứng bằng Docker thật** (Docker Desktop 4.96 trên Windows, ngày 21/10/2026): file compose và `Caddyfile` hợp lệ; hai
> image build được; database, Redis và backend khởi động và báo khoẻ mạnh; cả chuỗi Caddy → nginx → backend chạy qua HTTPS (chuyển
> HTTP sang HTTPS, tiêu đề bảo mật, đường dẫn Angular, đăng ký và cookie `Secure`, chặn nguồn lạ, chặn thân yêu cầu quá lớn); chỉ Caddy
> mở cổng ra ngoài; sao lưu và khôi phục theo đúng các lệnh bên dưới. Job `production-stack` trong `.github/workflows/ci.yml` lặp
> lại phần build và khởi động trên GitHub. Chưa thử: xem mục 13.

---

## 0. Chạy thử trên máy của bạn (trước khi thuê máy chủ)

Cần Docker Desktop đang chạy, và cổng 80, 443 còn trống.

1. Tạo file `.env` (PowerShell: `Copy-Item .env.production.example .env`) rồi điền: `DOMAIN=localhost`, `ACME_EMAIL=bất-kỳ@example.com`,
   `POSTGRES_PASSWORD=` một chuỗi ngẫu nhiên chỉ gồm chữ và số.
2. Chạy **đúng một lệnh** (build lần đầu mất vài phút):
   ```bash
   docker compose -f docker-compose.prod.yml up -d --build --wait
   ```
3. Mở **https://localhost**. Trình duyệt sẽ cảnh báo "kết nối không riêng tư", vì chứng chỉ do Caddy tự cấp cho máy bạn (chưa ai tin).
   Chọn *Nâng cao* rồi *Tiếp tục tới localhost*. Trên máy chủ thật với tên miền thật thì không có cảnh báo này.
4. Dừng: `docker compose -f docker-compose.prod.yml stop`. Bật lại: `... up -d` (dữ liệu giữ nguyên). Xoá hết kể cả dữ liệu: `... down -v`.

> **Đừng bật từng image bằng nút Run trong Docker Desktop.** Các image này chỉ chạy đúng khi `docker compose` nối chúng với nhau (nginx tìm
> `backend` theo tên, backend tìm `db` và `redis`, database cần mật khẩu từ `.env`); bật lẻ thì trang không vào được.
>
> Chế độ này là "production": **không có cổng thanh toán giả** nên không thử được luồng mua hàng. Muốn thử luồng mua, chạy bản phát
> triển (`npm start` trong `backend-node` và `frontend`, mở `http://localhost:4200`).

## 1. Chuẩn bị

- **Tên miền** `hanoicenturyvista.com`. Mã nguồn dùng đúng tên này cho link chuẩn,
  sơ đồ trang và ảnh chia sẻ (`frontend/src/app/config.ts`).
- **Máy chủ (VPS)** Linux **x86_64**, Ubuntu 24.04 LTS, từ 2 CPU / 4 GB RAM / 40 GB ổ đĩa. Chọn vị trí gần người dùng (Việt Nam hoặc Singapore).
  Đừng chọn máy kiến trúc ARM: image PostGIS chưa được kiểm tra trên ARM.
- Tài khoản GitHub có quyền đọc kho mã. Nếu kho là **private**, tạo một *deploy key* (chỉ đọc) hoặc token để máy chủ tải mã về.
- Tuỳ chọn: tài khoản **dịch vụ gửi email SMTP** (Brevo, SendGrid, Resend…) và **khoá API Anthropic** (xem `.env.production.example`).
- Bật **xác thực hai bước** ở nơi bán tên miền, VPS và GitHub. Ai chiếm được tài khoản tên miền là chiếm được cả trang.

## 2. Trỏ tên miền về máy chủ

Ở nơi bạn mua tên miền (hoặc Cloudflare), tạo hai bản ghi DNS:

| Loại | Tên | Giá trị |
|---|---|---|
| A | `@` | địa chỉ IP của VPS |
| A | `www` | địa chỉ IP của VPS |

- **Làm bước này trước khi chạy lần đầu**: nếu DNS chưa trỏ đúng, Caddy không xin được chứng chỉ.
- Nếu dùng Cloudflare, để hai bản ghi ở chế độ **"DNS only"** (đám mây xám), ít nhất trong lần chạy đầu.
- Kiểm tra: `nslookup hanoicenturyvista.com` phải ra IP của VPS (có thể mất vài phút đến vài giờ).

## 3. Chuẩn bị máy chủ

Đăng nhập lần đầu bằng `ssh root@<IP>` (hoặc tài khoản mà nhà cung cấp cho), rồi chạy:

```bash
apt update && apt -y upgrade

# Tài khoản làm việc hằng ngày, không dùng root
adduser deploy
usermod -aG sudo deploy
rsync --archive --chown=deploy:deploy ~/.ssh /home/deploy     # chép khoá SSH sang

# Tường lửa: chỉ mở SSH, web
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 443/udp
ufw --force enable

# Docker
curl -fsSL https://get.docker.com | sh
usermod -aG docker deploy
```

Mở **một cửa sổ mới**, đăng nhập thử `ssh deploy@<IP>`. Chỉ khi đăng nhập được mới tiếp tục. Sau đó nên tắt đăng nhập SSH bằng mật khẩu
(chỉ dùng khoá): đặt `PasswordAuthentication no` trong `/etc/ssh/sshd_config.d/99-hardening.conf`, rồi `sudo systemctl reload ssh`.

> `ufw` không chặn được cổng do Docker tự mở. Vì vậy `docker-compose.prod.yml` chỉ mở đúng cổng 80 và 443. Đừng thêm `ports:` cho
> `db`, `redis` hay `backend`.

## 4. Lấy mã nguồn và cấu hình

Đăng nhập bằng `deploy` rồi:

```bash
git clone https://github.com/ThanhHai76/business-opportunity.git hanoi-century-vista
cd hanoi-century-vista

cp .env.production.example .env
chmod 600 .env
nano .env
```

Trong `.env`, **bắt buộc** điền 3 giá trị:

| Biến | Giá trị |
|---|---|
| `DOMAIN` | `hanoicenturyvista.com` (không có `https://`, không có `www`) |
| `ACME_EMAIL` | email của bạn, để Let's Encrypt báo trước khi chứng chỉ hết hạn |
| `POSTGRES_PASSWORD` | mật khẩu dài, ngẫu nhiên, chỉ gồm chữ và số: `openssl rand -hex 24` |

Các biến còn lại (AI, email, thanh toán) có thể để trống lúc đầu và điền sau. **File `.env` là bí mật**: không commit, không gửi vào
chat, không chụp màn hình.

## 5. Chạy lần đầu

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

Lần đầu mất vài phút (tải image và build giao diện). Theo dõi:

```bash
docker compose -f docker-compose.prod.yml ps                       # tất cả phải "running", backend "healthy"
docker compose -f docker-compose.prod.yml logs -f backend caddy    # Ctrl+C để thoát
```

Lần chạy đầu backend tự tạo bảng và nạp dữ liệu 79 phường/xã (vài giây); Caddy tự xin chứng chỉ HTTPS.

## 6. Kiểm tra

- [ ] `https://hanoicenturyvista.com` mở được, có ổ khoá; `http://` tự chuyển sang `https://`; `www.` chuyển về tên miền chính.
- [ ] `https://hanoicenturyvista.com/api/health` trả `{"status":"ok"}`.
- [ ] Đăng ký một tài khoản thử, đăng xuất, đăng nhập lại (cookie đăng nhập chỉ hoạt động qua HTTPS).
- [ ] Mở **Mở gì ở đâu**, chọn ngành, bấm một phường: có điểm và bản đồ.
- [ ] Mở **Chấm điểm bất động sản** và **Điểm đáng sống**.
- [ ] Xoá tài khoản thử (trong hộp tài khoản) sau khi kiểm tra.

## 7. Email (xác minh tài khoản, quên mật khẩu)

Không có `SMTP_URL` thì hai tính năng này **tắt**. Để bật:

1. Tạo tài khoản ở một dịch vụ gửi email, lấy địa chỉ SMTP.
2. Điền `SMTP_URL` và `MAIL_FROM` trong `.env`.
3. Ở dịch vụ đó, thêm bản ghi **SPF** và **DKIM** cho tên miền của bạn (họ hướng dẫn sẵn), nếu không thư dễ vào mục thư rác.
4. `docker compose -f docker-compose.prod.yml up -d`, rồi thử "Quên mật khẩu".

Khi có SMTP thật, mua báo cáo và gói trả phí sẽ yêu cầu email đã xác minh (đổi bằng `REQUIRE_VERIFIED_EMAIL`).

## 8. AI (khi bạn sẵn sàng trả phí cho AI)

1. Lấy khoá trong Claude Console, **đặt trần chi tiêu hằng tháng** ở trang Billing của Console (khi chạm trần, hệ thống tự dùng câu trả lời
   tự động, không tốn thêm).
2. Điền `ANTHROPIC_API_KEY` (và `LLM_MODEL` nếu muốn đổi) trong `.env`, rồi `docker compose -f docker-compose.prod.yml up -d`.
3. Khi có khoá, hệ thống **tự bật đếm lượt hỏi AI** theo tài khoản (3 câu miễn phí mỗi ngày, Premium 50 câu).

## 9. Vận hành

**Xem trạng thái và nhật ký**

```bash
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs --tail=100 backend
docker stats --no-stream
```

**Cập nhật khi có mã mới:** `bash deploy/update.sh` (sao lưu, kéo mã, build lại, khởi động lại phần thay đổi). Dữ liệu trong database được giữ nguyên.

**Sao lưu**

```bash
bash deploy/backup.sh                     # một bản ngay bây giờ, vào thư mục backups/ (giữ 14 ngày)
crontab -e                                # thêm dòng sau để chạy mỗi đêm lúc 2 giờ 30:
30 2 * * * cd /home/deploy/hanoi-century-vista && bash deploy/backup.sh >> backups/backup.log 2>&1
```

Bản sao nằm cùng máy chủ nên **mất theo máy chủ**. Hãy chép định kỳ sang nơi khác (máy của bạn bằng `scp`, hoặc dịch vụ lưu trữ bằng `rclone`).
Nhiều nhà cung cấp VPS cũng có sẵn tính năng sao lưu cả máy chủ (snapshot): nên bật thêm.

**Khôi phục từ bản sao lưu** (xoá toàn bộ dữ liệu hiện tại, chỉ làm khi cần):

```bash
C="docker compose -f docker-compose.prod.yml"
$C stop backend
$C exec -T db psql -U living -d postgres -c "DROP DATABASE living_score;" -c "CREATE DATABASE living_score OWNER living ENCODING 'UTF8' TEMPLATE template0;"
gunzip -c backups/<tên-file>.sql.gz | $C exec -T db psql -U living -d living_score
$C start backend
```

> Các lệnh sao lưu và khôi phục này đã được thử trên một stack thật: xoá hết tài khoản, khôi phục từ bản sao lưu, tài khoản và 79 phường
> trở lại đủ, không có lỗi. Dù vậy, hãy thử một lần trên máy chủ của bạn (với dữ liệu thử) trước khi bạn thật sự cần đến nó.

**Đổi mật khẩu database:** `POSTGRES_PASSWORD` chỉ có tác dụng **lúc database được tạo lần đầu**. Đổi trong `.env` sau đó sẽ làm backend không
đăng nhập được. Muốn đổi, chạy trước `$C exec db psql -U living -d living_score -c "ALTER USER living PASSWORD '<mật-khẩu-mới>';"`
rồi mới sửa `.env` và `up -d`.

**Cập nhật hệ điều hành:** `sudo apt update && sudo apt upgrade` mỗi tháng, khởi động lại máy khi được yêu cầu (các container tự chạy lại).

**Giám sát:** đặt một dịch vụ theo dõi miễn phí (như UptimeRobot) vào `https://hanoicenturyvista.com/api/health` để nhận báo khi trang sập.

## 10. Bảo mật: danh sách kiểm tra

- [ ] `.env` có quyền `600` và không nằm trong Git (đã có trong `.gitignore`).
- [ ] `sudo ufw status` chỉ cho OpenSSH, 80, 443. `docker compose ps` chỉ cho thấy cổng của `caddy`.
- [ ] Đăng nhập SSH bằng khoá, đã tắt mật khẩu.
- [ ] Trần chi tiêu đã đặt trong Claude Console.
- [ ] Đã bật sao lưu tự động và chép bản sao ra ngoài máy chủ.
- [ ] Trang điều khoản và chính sách bảo mật đã được người có chuyên môn xem lại (bản trong dự án là bản mẫu).
- [ ] Lưu ý: Caddy gửi tiêu đề HSTS (trình duyệt nhớ "chỉ dùng HTTPS" trong 1 năm). Đừng gỡ HTTPS khỏi tên miền sau khi bật.
- Chưa cấu hình **CSP** (chính sách nội dung): bản đồ và font tải từ nhiều nguồn nên cần thử kỹ trước khi bật.

## 11. Thanh toán chưa bật: việc cần biết

Ở production, cổng thanh toán giả bị **từ chối có chủ đích** và `BILLING_PROVIDER` mặc định `off`. Vì vậy cho tới khi kết nối PayOS:

- Nút **Báo cáo đầy đủ**, gói AI và Premium sẽ báo "chưa bật bán".
- Báo cáo tóm tắt, máy tính khả thi và mọi công cụ khác vẫn dùng bình thường.
- Bạn có thể bán thủ công (khách chuyển khoản, bạn làm báo cáo) trong lúc chờ.

### Bật PayOS (code đã có: `backend-node/src/billing/payos-provider.js`)

1. Trên my.payos.vn, tạo **kênh thanh toán** gắn tài khoản ngân hàng nhận tiền, lấy **Client ID**, **API Key**, **Checksum Key**.
2. Điền vào `.env` trên máy chủ: `BILLING_PROVIDER=payos`, `PAYOS_CLIENT_ID=…`, `PAYOS_API_KEY=…`, `PAYOS_CHECKSUM_KEY=…`
   (không commit, không gửi cho ai). Tài khoản ngân hàng **đã liên kết** qua PayOS có thể đặt `PAYOS_DESCRIPTION_MAX=25`.
3. Cần **SMTP thật** trước: người mua phải xác minh email (mục 7).
4. Khởi động lại: `docker compose -f docker-compose.prod.yml up -d`.
5. Đăng ký địa chỉ nhận thông báo thanh toán (PayOS gửi thử một giao dịch tới đó trước):
   `docker compose -f docker-compose.prod.yml exec backend npm run payos:webhook -- https://TÊN-MIỀN/api/billing/webhook/payos`
6. Mua thử gói rẻ nhất (49.000đ) bằng tài khoản của bạn; kiểm tra đơn chuyển sang "đã thanh toán" và lượt được cộng.
7. Nếu khách chuyển sai số tiền, đơn **không** được cộng và log ghi `paid … expected …`: kiểm tra và xử lý tay.

*Chưa thử với PayOS thật: mới thử bằng API PayOS giả trong kiểm thử.*

## 12. Khi gặp sự cố

| Dấu hiệu | Nguyên nhân thường gặp và cách xử lý |
|---|---|
| Trình duyệt báo "không an toàn", Caddy ghi lỗi chứng chỉ | DNS chưa trỏ về VPS, cổng 80/443 bị chặn (tường lửa của nhà cung cấp VPS), hoặc Cloudflare đang bật proxy. Xem `logs caddy` |
| Trang báo 502 | Backend chưa sẵn sàng hoặc đã dừng. `ps` rồi `logs --tail=100 backend` |
| `docker compose` báo "Đặt DOMAIN/POSTGRES_PASSWORD…" | Thiếu giá trị bắt buộc trong `.env` |
| Backend dừng, log nhắc "password authentication failed" | `POSTGRES_PASSWORD` trong `.env` khác với mật khẩu lúc database được tạo (xem mục đổi mật khẩu) |
| Đăng nhập xong vẫn như chưa đăng nhập | Đang vào bằng `http://` thay vì `https://` (cookie đặt cờ `Secure`) |
| Ai cũng bị "thử quá nhiều lần" | Sai số lớp proxy nên mọi người bị coi cùng một IP. Cấu hình này đặt `TRUST_PROXY=1` đúng cho "Caddy → backend"; đừng thêm proxy khác phía trước mà không chỉnh |
| Ổ đĩa đầy | `docker system df`, `docker image prune -a`, xoá bớt `backups/` cũ. Nhật ký container đã giới hạn 30 MB mỗi dịch vụ |

## 13. Những gì chưa được kiểm chứng

- Việc xin chứng chỉ HTTPS thật của Let's Encrypt trên tên miền thật (đã thử với `localhost`, nơi Caddy dùng chứng chỉ nội bộ).
- Chạy trên một máy chủ Linux thật (đã thử trên Docker Desktop của Windows; cùng image, nhưng chưa phải VPS).
- Máy chủ kiến trúc ARM.
- Gửi email thật qua SMTP.
- Tải lưu lượng lớn: chưa đo mức chịu tải của một máy chủ nhỏ.
