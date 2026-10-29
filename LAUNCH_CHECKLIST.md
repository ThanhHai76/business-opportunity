# Danh sách việc trước khi đưa Hanoi Century Vista lên mạng

Cập nhật lần cuối: 23/10/2026. Đánh dấu `[x]` khi xong. Hướng dẫn triển khai chi tiết nằm ở [DEPLOY.md](DEPLOY.md).

**Gợi ý lộ trình:** mở bản **miễn phí** trước (nhóm 1, trừ PayOS), làm nhóm 2 trong lúc theo dõi phản hồi, bật thu tiền khi pháp lý và thanh toán đã sẵn sàng.

## 1. Bắt buộc trước khi mở công khai

- [ ] Commit và push các thay đổi đang dở (metro dùng chung, dữ liệu phường chính thức, mầm non, số liệu La bàn nghề nghiệp, bản tiếng Anh, nút báo sai số liệu, giao diện sáng mặc định, sửa thanh công cụ Hà Nội tương lai; *chưa commit tới 23/10/2026*), rồi xem CI trên GitHub Actions (job `production-stack`) có xanh không.
- [ ] Mua tên miền, thuê máy chủ, trỏ DNS, xin chứng chỉ HTTPS thật (Let's Encrypt). *Chưa kiểm chứng: DEPLOY.md mục 13.* Cách tạm không cần tên miền: đã chia sẻ thử qua Cloudflare Quick Tunnel (`deploy/share-local.js` và `cloudflared`, 22–23/10/2026); địa chỉ đổi mỗi lần chạy và chỉ sống khi máy bật, không thay cho máy chủ thật. Có thể dùng tên miền sslip.io trên VPS (chưa thử).
- [ ] Chạy thử trên máy chủ Linux thật (mới thử trên Docker Desktop của Windows).
- [ ] Cấu hình gửi email thật (`SMTP_URL`, `MAIL_FROM`) và thử email xác minh, quên mật khẩu. *Chưa thử với SMTP thật.*
- [ ] Nhờ người có chuyên môn xem lại **Điều khoản** và **Chính sách bảo mật** (bản trong dự án là bản mẫu); điền địa chỉ email liên hệ thật.
- [ ] Nếu bán hàng: hỏi luật sư hoặc kế toán về nghĩa vụ đăng ký website thương mại điện tử, hoá đơn và chính sách hoàn tiền.
- [ ] Quyết định cách thu tiền: mở **miễn phí hoàn toàn** trước (`BILLING_PROVIDER=off`, mọi tính năng mở), hoặc bán thủ công bằng chuyển khoản. Đã đăng ký tài khoản PayOS và **đã viết code PayOS** (`BILLING_PROVIDER=payos`, `src/billing/payos-provider.js`, 23/10/2026; mới thử với API giả). Còn cần: điền Client ID, API Key, Checksum Key vào `.env`, có địa chỉ webhook HTTPS cố định rồi chạy `npm run payos:webhook`, thử một đơn thật nhỏ (xem DEPLOY.md mục 11).
- [ ] Thêm `ANTHROPIC_API_KEY` và **đặt trần chi tiêu** trong Claude Console. Hiện AI trả lời theo mẫu.
- [ ] Bật sao lưu tự động (`deploy/backup.sh`) và chép bản sao ra ngoài máy chủ; thử khôi phục một lần.
- [ ] Chạy hết checklist bảo mật ở DEPLOY.md mục 10 (quyền `.env`, tường lửa, SSH bằng khoá…).

## 2. Nên làm trong 2–4 tuần đầu

**Độ tin cậy của dữ liệu**
- [x] Gắn nhãn "trên OpenStreetMap" cạnh văn phòng, chung cư, trường học trong bảng phường của Mở gì ở đâu; ghi chú "có thể thấp hơn thực tế"; tách riêng số mầm non khỏi trường học. *Xong 22/10/2026.*
- [x] Đối chiếu **dân số và diện tích** từng phường với danh sách 126 xã, phường sau sắp xếp (Báo Hà Nội Mới). Đã sửa Phú Thượng và 16 xã; 79/79 đơn vị có dân số chính thức; diện tích ranh giới lệch dưới 8%. *Đã đối chiếu tên và số đơn vị với Nghị quyết 1656/NQ-UBTVQH15 (23/10/2026): đúng 126 đơn vị, 51 phường và 75 xã, khớp 126/126 tên. Nghị quyết không ghi diện tích, dân số từng đơn vị nên hai số này vẫn theo danh sách Báo Hà Nội Mới; số chính thức nằm trong đề án của Chính phủ (chưa tìm thấy bản công khai).*
- [x] Đối chiếu các số của **La bàn nghề nghiệp** (22/10/2026): thống kê chung dùng số Cục Thống kê quý II/2026; dự báo 6%/5%/4% ghi đúng nguồn (Trung tâm DVVL Hà Nội, 1/2026, không phải quý 2); chính sách thất nghiệp sửa theo Luật Việc làm 74/2025/QH15 (Điều 37–39). *Kế hoạch 212/KH-UBND (2/6/2026) nay dẫn cổng thông tin UBND thành phố (nguồn chính thức, bản tiếng Anh; chưa có bản văn bản gốc tiếng Việt). "Thiếu 50.000 lao động chất lượng cao" là ước tính trong dự báo quý II/2026 của Trung tâm Dịch vụ việc làm Hà Nội, chỉ có qua báo chí (23/10/2026).* Cập nhật `DATA_DATE` mỗi lần rà lại.
- [x] Nút **"Báo sai số liệu"** trên mỗi phường (Mở gì ở đâu, bản đồ việc làm) và mỗi nguồn (danh sách nguồn của hai trang). Báo cáo lưu ở bảng `data_reports`; xem ở trang `/admin/reports` (điền email của bạn vào `ADMIN_EMAILS` trong `.env`, đăng nhập bằng tài khoản đã xác minh; 27/10/2026) hoặc bằng `npm run reports:list`. *Chưa báo qua email khi có báo cáo mới.* (23/10/2026)
- [ ] Đặt lịch rà soát số liệu việc làm mỗi quý (đã có lịch cho thị trường bất động sản).
- [x] Living Score và Mở gì ở đâu dùng chung `src/metro/stations.js` (toạ độ ga bám OpenStreetMap).

**Kỹ thuật và vận hành**
- [x] Giao diện **sáng là mặc định** khi vào lần đầu (23/10/2026); người đã chọn tối vẫn giữ lựa chọn.
- [x] Sửa thanh công cụ trang Hà Nội tương lai đè lên thẻ số liệu khi cửa sổ thấp (23/10/2026). *Chưa kiểm tra trên điện thoại thật.*
- [ ] Giám sát: kiểm tra trang còn sống, nhận cảnh báo lỗi; xem lại việc đo lượng truy cập đã đúng quy định chưa.
- [ ] Bật CSP (chính sách nội dung) sau khi thử kỹ vì bản đồ và font tải từ nhiều nguồn.
- [ ] Thử trên Safari, iPhone và điện thoại Android thật (mới thử bằng Chrome và giả lập).
- [ ] Đo tải của một máy chủ nhỏ.
- [x] **Thống kê truy cập tự lưu** (27/10/2026): xem ở `/admin/stats` (lượt xem từng trang, đăng ký, tra cứu, đường đi Premium → bắt đầu thanh toán → thanh toán, mở báo cáo mẫu). Chỉ là bộ đếm, không IP, không cookie, tôn trọng Do Not Track. *Các số chỉ có khi trang có người dùng thật; cần có ít nhất vài chục lượt trước khi rút ra kết luận.*
- [x] **Báo cáo mẫu miễn phí** của gói trả phí (`/api/reports/sample`), có link ở hộp báo cáo đầy đủ và trang Premium (27/10/2026).
- [x] Trang **giải thích điểm** bằng lời thường (`/giai-thich-diem`, song ngữ, 27/10/2026): ba loại điểm, cách tính, điều điểm số không nói. *Khi đổi công thức hoặc trọng số ở máy chủ, sửa `score-guide.i18n.ts` và `score-help.component.ts` cho khớp.* Có dấu **?** cạnh điểm ở Mở gì ở đâu, Điểm đáng sống và Chấm điểm bất động sản.
- [x] Trang riêng cho 126 phường/xã (`/phuong-xa/<tên>`, có trong sitemap và có ảnh xem trước riêng, 27/10/2026). *47 đơn vị nằm ngoài khu vực dữ liệu OSM chỉ có số liệu chính thức, chưa có điểm cơ hội.*
- [x] Ảnh xem trước khi dán link: mỗi trang công cụ có tiêu đề, mô tả, link chuẩn và thẻ chia sẻ riêng (`frontend/scripts/route-meta.mjs`, 26/10/2026). *Chưa thử dán link thật vào Facebook/Zalo (cần địa chỉ công khai); ảnh xem trước vẫn dùng chung một ảnh `og-image.png`.*
- [x] Trang chủ có phần "Bạn đang cần gì?" dẫn người mới tới đúng công cụ (26/10/2026).
- [x] Rà cấu trúc truy cập (nhãn nút, ô nhập, h1, vùng main) ở 9 trang bằng Chrome: đã sửa trang Mở gì ở đâu, Hà Nội tương lai, bản đồ BĐS. *Chưa rà độ tương phản màu, thứ tự Tab và đọc bằng trình đọc màn hình.*
- [ ] Hiệu năng trên điện thoại chậm: đo giả lập 4G chậm, CPU chậm 4 lần, các trang bản đồ có LCP khoảng 9 giây (trang chủ, La bàn nghề nghiệp khoảng 4,7 giây). Số này đo trên bản chạy không nén; trên máy chủ thật Caddy nén nên nhỏ hơn. *Cần đo lại trên máy chủ thật.*
- [x] Tải về dữ liệu cá nhân: nút trong mục Tài khoản, cần nhập lại mật khẩu, một tệp JSON (`POST /api/account/me/export`, 26/10/2026). Trang Quyền riêng tư đã cập nhật.
- [x] Kiểm thử đầu-cuối bằng Chrome thật cho 12 luồng chính, gồm quên mật khẩu, phường/xã, giải thích điểm và trang quản trị (`npm run test:e2e` trong `backend-node`, 27/10/2026). Đã thêm job `e2e` vào `.github/workflows/ci.yml`. *Job này chưa được chạy trên GitHub (chưa đẩy lên); lần đẩy đầu tiên cần xem nó có xanh không. Chưa phủ bản đồ và hỏi đáp AI.*

## 3. Sau khi có người dùng thật

- [ ] Kết nối PayOS: *code xong (23/10/2026)*; còn đăng ký webhook và thử một đơn nhỏ thật. Quy trình hoàn tiền và hoá đơn.
- [x] Bản tiếng Anh cho La bàn nghề nghiệp (22/10/2026), và **một nút ngôn ngữ chung** VI/EN cho cả trang (thanh chung, Trang chủ, Premium, tài khoản, Điều khoản, các công cụ; 26/10/2026). *Bản tiếng Anh của Điều khoản/Quyền riêng tư/Hoàn tiền là bản dịch nháp, cần người có chuyên môn xem; thông báo lỗi từ máy chủ dịch theo mã lỗi, chưa phủ hết.*
- [ ] Hỏi AI định hướng nghề.
- [ ] Hướng dẫn lần đầu cho người mới (trang chủ có nhiều công cụ).
- [ ] Làm video giới thiệu; nói chuyện với vài khách thật trước khi chốt giá.
- [ ] Gửi email nhắc việc theo kế hoạch nghề nghiệp (cần hệ thống gửi email chạy định kỳ).
- [ ] Bổ sung dữ liệu: chung cư theo số tầng, số doanh nghiệp theo phường nếu có nguồn công khai.
