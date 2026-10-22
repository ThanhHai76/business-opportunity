/**
 * Data of "La bàn nghề nghiệp Hà Nội": the sourced facts, the career directions and the support channels.
 * Every figure names its source (ids in SOURCES). Most sources are press reports of official statements: the figures
 * must be checked against the original documents before they are relied on (see the note on the page).
 * Nothing here is a forecast of the page's own: where no figure was found, the text says only what the plan says.
 */

export type Background = 'tech' | 'engineering' | 'sales' | 'logistics' | 'service' | 'finance' | 'other';
/** Education reached: 0 high school or less, 1 vocational / college, 2 university or more. */
export type Education = 0 | 1 | 2;
/** Time available to train before working: 0 none, 1 a few months, 2 a year or more. */
export type TrainTime = 0 | 1 | 2;
export type WorkType = 'employee' | 'self' | 'either';
export type Situation = 'unemployed' | 'switching' | 'graduate' | 'employed';

export interface Source {
  id: string;
  title: string;
  publisher: string;
  url: string;
  /** official: a document or statistic of the State · press: a news report of one · computed: figures the site computed from open data. */
  kind: 'official' | 'press' | 'computed';
}

export const DATA_DATE = '21/10/2026';

export const SOURCES: Source[] = [
  { id: 'nso-q2-2026', title: 'Thông cáo báo chí về tình hình lao động, việc làm quý II năm 2026', publisher: 'Cục Thống kê', url: 'https://www.nso.gov.vn/wp-content/uploads/2026/07/Thong-cao-bao-chi-Lao-dong-viec-lam-QII.2026.pdf', kind: 'official' },
  { id: 'vneconomy-q1-2026', title: 'Quý I/2026: tình trạng thất nghiệp cơ bản được kiểm soát', publisher: 'VnEconomy', url: 'https://vneconomy.vn/quy-12026-tinh-trang-that-nghiep-co-ban-duoc-kiem-soat.htm', kind: 'press' },
  { id: 'vneconomy-50000', title: 'Hà Nội đang thiếu khoảng 50.000 lao động chất lượng cao', publisher: 'VnEconomy', url: 'https://vneconomy.vn/ha-noi-dang-thieu-khoang-50000-lao-dong-chat-luong-cao.htm', kind: 'press' },
  { id: 'dbnd-tuyen-dung', title: 'Hà Nội duy trì xu hướng tích cực với nhu cầu tuyển dụng ở mức cao', publisher: 'Báo Đại biểu Nhân dân', url: 'https://daibieunhandan.vn/ha-noi-duy-tri-xu-huong-tich-cuc-voi-nhu-cau-tuyen-dung-o-muc-cao-10404912.html', kind: 'press' },
  { id: 'dn-40000', title: 'Hà Nội cần khoảng 40.000 lao động trong tháng 1/2026', publisher: 'Doanh nghiệp & Hội nhập', url: 'https://doanhnghiephoinhap.vn/ha-noi-can-khoang-40000-lao-dong-trong-thang-12026-126375.html', kind: 'press' },
  { id: 'dn-143089', title: 'Thị trường lao động Hà Nội tăng nhiệt, doanh nghiệp ưu tiên nhân sự chất lượng cao', publisher: 'Doanh nghiệp & Hội nhập', url: 'https://doanhnghiephoinhap.vn/thi-truong-lao-dong-ha-noi-tang-nhiet-doanh-nghiep-uu-tien-nhan-su-chat-luong-cao-143089.html', kind: 'press' },
  { id: 'baodautu-bandan', title: 'Giải cơn khát nhân lực bán dẫn', publisher: 'Báo Đầu tư', url: 'https://baodautu.vn/giai-con-khat-nhan-luc-ban-dan-d453594.html', kind: 'press' },
  { id: 'qh1569-vcci', title: 'Phê duyệt Quy hoạch Thủ đô Hà Nội thời kỳ 2021–2030, tầm nhìn đến năm 2050 (QĐ 1569/QĐ-TTg)', publisher: 'VCCI', url: 'https://vcci.com.vn/tin-tuc/phe-duyet-quy-hoach-thu-do-ha-noi-thoi-ky-2021-2030-tam-nhin-den-nam-2050', kind: 'press' },
  { id: 'qd2512-poles', title: 'Quy hoạch Hà Nội 100 năm: 9 cực phát triển, 9 trung tâm lớn, 9 trục động lực (29/6/2026)', publisher: 'Báo Tiền Phong', url: 'https://tienphong.vn/quy-hoach-ha-noi-100-nam-9-cuc-phat-trien-9-trung-tam-lon-9-truc-dong-luc-post1855351.tpo', kind: 'press' },
  { id: 'pole-roles', title: 'Hà Nội định hướng 9 cực phát triển (28/1/2026)', publisher: 'Quỹ Đầu tư phát triển TP Hà Nội', url: 'https://quydautuphattrien.hanoi.gov.vn/ban-tin/ha-noi-dinh-huong-9-cuc-phat-trien-565.html', kind: 'official' },
  { id: 'osrm', title: 'Thời gian lái xe tính bằng OSRM trên mạng đường OpenStreetMap (đường thông thoáng, chưa tính kẹt xe)', publisher: 'Chấm điểm bất động sản · © OpenStreetMap contributors (ODbL)', url: 'https://project-osrm.org', kind: 'computed' },
  { id: 'luat-viec-lam', title: 'Luật Việc làm số 74/2025/QH15', publisher: 'LuatVietnam', url: 'https://luatvietnam.vn/lao-dong/luat-viec-lam-cua-quoc-hoi-so-74-2025-qh15-405176-d1.html', kind: 'official' },
  { id: 'lsvn-bhtn', title: 'Người thất nghiệp được hưởng những chế độ nào theo Luật Việc làm 2025', publisher: 'LSVN', url: 'https://lsvn.vn/nguoi-that-nghiep-duoc-huong-nhung-che-do-nao-theo-luat-viec-lam-2025-a170703.html', kind: 'press' },
  { id: 'nhandan-san-qg', title: 'Sàn Giao dịch việc làm quốc gia: nền tảng số kết nối người lao động và doanh nghiệp', publisher: 'Báo Nhân Dân', url: 'https://nhandan.vn/post-955497.html', kind: 'press' },
  { id: 'vneconomy-cong-hn', title: 'Chính thức kích hoạt Cổng thông tin việc làm thành phố Hà Nội', publisher: 'VnEconomy', url: 'https://vneconomy.vn/chinh-thuc-kich-hoat-cong-thong-tin-viec-lam-thanh-pho-ha-noi.htm', kind: 'press' },
];

/** What the page says about the job market as a whole: national figures (no Hà Nội figure was found). */
export const CONTEXT = [
  { value: '8,86%', label: 'thanh niên 15–24 tuổi thất nghiệp, quý I/2026 (cả nước)', sources: ['vneconomy-q1-2026'] },
  { value: '10,7%', label: 'cùng nhóm tuổi ở khu vực thành thị', sources: ['vneconomy-q1-2026'] },
  { value: '≈ 1,6 triệu', label: 'thanh niên 15–24 tuổi không làm việc, không đi học, không đào tạo', sources: ['vneconomy-q1-2026'] },
  { value: '≈ 2,2%', label: 'tỷ lệ thất nghiệp chung, 6 tháng đầu 2026 (cả nước)', sources: ['nso-q2-2026'] },
];

export interface Fact {
  text: string;
  sources: string[];
}

export interface ToolLink {
  label: string;
  path: string;
}

export interface Step {
  when: string;
  text: string;
}

export interface Direction {
  id: string;
  name: string;
  icon: string;
  /** One line on what the work is. */
  blurb: string;
  /** How well each background leads here, 0 (not at all) to 3 (directly). */
  fit: Record<Background, 0 | 1 | 2 | 3>;
  /** The lowest education level that is usually asked. */
  minEducation: Education;
  /** Training needed before starting, for someone new to it. */
  training: TrainTime;
  workType: 'employee' | 'self' | 'both';
  /** What the sources say about this direction in Hà Nội. */
  facts: Fact[];
  /** Example roles (generic, not job offers). */
  roles: string[];
  skills: string[];
  steps: Step[];
  tools: ToolLink[];
}

export const DIRECTIONS: Direction[] = [
  {
    id: 'semiconductor',
    name: 'Công nghệ cao và bán dẫn',
    icon: '🔬',
    blurb: 'Vận hành, kiểm định, bảo trì thiết bị và sản xuất trong các nhà máy, khu công nghệ cao.',
    fit: { tech: 3, engineering: 3, sales: 0, logistics: 0, service: 0, finance: 0, other: 1 },
    minEducation: 1,
    training: 2,
    workType: 'employee',
    facts: [
      { text: 'Hà Nội đang thiếu khoảng 50.000 lao động chất lượng cao, tập trung ở công nghệ cao, kỹ thuật và phát triển bền vững.', sources: ['vneconomy-50000'] },
      { text: 'Kế hoạch 212/KH-UBND đặt mục tiêu đến 2030 đào tạo ít nhất 22.000 nhân lực trình độ đại học trở lên cho ngành bán dẫn, và hình thành trường đại học công nghệ quốc tế tại Khu Công nghệ cao Hòa Lạc.', sources: ['baodautu-bandan'] },
      { text: 'Báo chí nêu mức thu nhập phổ biến của kỹ thuật viên bán dẫn là 15–25 triệu đồng/tháng (tham khảo, thay đổi theo vị trí và kinh nghiệm).', sources: ['vneconomy-50000'] },
    ],
    roles: ['Kỹ thuật viên vận hành thiết bị', 'Kỹ thuật viên kiểm định chất lượng', 'Kỹ sư điện – điện tử', 'Kỹ sư quy trình'],
    skills: ['Điện – điện tử cơ bản', 'Đọc bản vẽ và quy trình kỹ thuật', 'Tiếng Anh kỹ thuật', 'Làm việc theo ca và quy chuẩn sạch'],
    steps: [
      { when: 'Tuần đầu', text: 'Xác định bạn muốn làm kỹ thuật viên (cao đẳng/trung cấp) hay kỹ sư (đại học), vì lộ trình khác nhau.' },
      { when: '1–3 tháng', text: 'Học nền tảng điện – điện tử và tiếng Anh kỹ thuật; hỏi trung tâm dịch vụ việc làm về khoá đào tạo nghề liên quan.' },
      { when: '6–12 tháng', text: 'Tìm vị trí học việc hoặc thực tập tại nhà máy, khu công nghệ cao; theo dõi tin tuyển trên sàn việc làm chính thống.' },
    ],
    tools: [
      { label: 'Xem quy hoạch Hòa Lạc và khu công nghệ', path: '/future-map' },
      { label: 'Tìm nơi ở gần nơi làm', path: '/living-score' },
    ],
  },
  {
    id: 'engineering',
    name: 'Kỹ thuật, chế tạo và xây dựng',
    icon: '🏗️',
    blurb: 'Thợ và kỹ thuật viên điện, cơ khí, xây dựng, hoàn thiện; giám sát thi công; vận hành nhà máy.',
    fit: { tech: 1, engineering: 3, sales: 0, logistics: 1, service: 0, finance: 0, other: 1 },
    minEducation: 0,
    training: 1,
    workType: 'both',
    facts: [
      { text: 'Dự báo quý 2/2026: nhu cầu tuyển ngành chế biến, chế tạo và xây dựng tăng khoảng 5%.', sources: ['dbnd-tuyen-dung', 'dn-40000'] },
      { text: 'Các dự án hạ tầng và đô thị là một động lực nhu cầu nhân lực xây dựng của Hà Nội (theo báo chí tháng 7/2026).', sources: ['dn-143089'] },
    ],
    roles: ['Thợ điện, thợ cơ khí, thợ hàn', 'Công nhân và tổ trưởng xây dựng', 'Giám sát thi công', 'Nhân viên vận hành máy'],
    skills: ['Tay nghề có chứng chỉ', 'An toàn lao động', 'Đọc bản vẽ', 'Quản lý đội nhóm (cho vị trí giám sát)'],
    steps: [
      { when: 'Tuần đầu', text: 'Chọn một nghề cụ thể (điện, cơ khí, hàn, hoàn thiện…) thay vì "làm xây dựng" chung chung.' },
      { when: '1–3 tháng', text: 'Học nghề ngắn hạn lấy chứng chỉ; người đã đóng bảo hiểm thất nghiệp hỏi về hỗ trợ đào tạo nghề.' },
      { when: '3–6 tháng', text: 'Vào đội thi công hoặc nhà máy theo tin tuyển chính thống; có thể nhận việc nhỏ lẻ để tích luỹ kinh nghiệm.' },
    ],
    tools: [
      { label: 'Xem các dự án hạ tầng đang xây', path: '/future-map' },
      { label: 'Mở xưởng, cửa hàng dịch vụ kỹ thuật', path: '/opportunity-map' },
    ],
  },
  {
    id: 'logistics',
    name: 'Vận tải và logistics',
    icon: '🚚',
    blurb: 'Kho bãi, điều phối, giao nhận, vận hành đội xe, chứng từ xuất nhập khẩu.',
    fit: { tech: 1, engineering: 1, sales: 1, logistics: 3, service: 1, finance: 1, other: 1 },
    minEducation: 0,
    training: 1,
    workType: 'employee',
    facts: [
      { text: 'Dự báo quý 2/2026: nhu cầu tuyển ngành vận tải và logistics tăng khoảng 4%.', sources: ['dbnd-tuyen-dung', 'dn-40000'] },
      { text: 'Logistics là một trong các ngành dịch vụ được định hướng phát triển trong Quy hoạch Thủ đô 2021–2030.', sources: ['qh1569-vcci'] },
    ],
    roles: ['Nhân viên kho', 'Nhân viên điều phối, giao nhận', 'Nhân viên chứng từ', 'Tài xế, quản lý đội xe'],
    skills: ['Phần mềm quản lý kho và đơn hàng', 'Excel', 'Tiếng Anh giao dịch cơ bản', 'Giấy phép lái xe phù hợp (với tài xế)'],
    steps: [
      { when: 'Tuần đầu', text: 'Chọn mảng: kho, giao nhận, chứng từ hay điều phối. Mỗi mảng cần kỹ năng khác nhau.' },
      { when: '1–3 tháng', text: 'Học phần mềm kho và Excel; với chứng từ, học quy trình xuất nhập khẩu cơ bản.' },
      { when: '3–6 tháng', text: 'Ứng tuyển vị trí nhân viên hoặc phụ kho trước, rồi lên điều phối khi có kinh nghiệm.' },
    ],
    tools: [{ label: 'Xem trục giao thông và cực phát triển', path: '/future-map' }],
  },
  {
    id: 'retail',
    name: 'Bán lẻ, bán buôn và chăm sóc khách hàng',
    icon: '🛍️',
    blurb: 'Bán hàng tại cửa hàng và trực tuyến, chăm sóc khách hàng, quản lý ca và cửa hàng.',
    fit: { tech: 0, engineering: 0, sales: 3, logistics: 1, service: 3, finance: 1, other: 2 },
    minEducation: 0,
    training: 0,
    workType: 'employee',
    facts: [
      { text: 'Dự báo quý 2/2026: nhu cầu tuyển ngành bán buôn, bán lẻ tăng khoảng 6%, mức tăng cao nhất trong các nhóm được nêu.', sources: ['dbnd-tuyen-dung', 'dn-40000'] },
      { text: 'Tháng 1/2026 Hà Nội ước cần tuyển khoảng 40.000 vị trí, tập trung ở bán buôn, bán lẻ, chế biến chế tạo, xây dựng, vận tải và logistics.', sources: ['dn-40000'] },
    ],
    roles: ['Nhân viên bán hàng', 'Nhân viên chăm sóc khách hàng', 'Trưởng ca, quản lý cửa hàng', 'Bán hàng trực tuyến'],
    skills: ['Giao tiếp và tư vấn', 'Phần mềm bán hàng, Excel', 'Bán hàng trực tuyến', 'Quản lý ca và tồn kho (cho vị trí quản lý)'],
    steps: [
      { when: 'Tuần đầu', text: 'Có thể bắt đầu ngay: ứng tuyển vị trí nhân viên; chọn chuỗi hoặc cửa hàng có đào tạo đầu vào.' },
      { when: '1–3 tháng', text: 'Học thêm bán hàng trực tuyến và phần mềm bán hàng để tăng cơ hội và thu nhập.' },
      { when: '6–12 tháng', text: 'Hướng tới trưởng ca hoặc quản lý cửa hàng; hoặc cân nhắc tự mở cửa hàng nhỏ (xem Mở gì ở đâu).' },
    ],
    tools: [{ label: 'Phường nào hợp mở cửa hàng', path: '/opportunity-map' }],
  },
  {
    id: 'tourism',
    name: 'Du lịch, ăn uống và dịch vụ',
    icon: '🍜',
    blurb: 'Nhà hàng, quán cà phê, khách sạn, hướng dẫn và điều hành tour, dịch vụ cá nhân.',
    fit: { tech: 0, engineering: 0, sales: 2, logistics: 0, service: 3, finance: 0, other: 2 },
    minEducation: 0,
    training: 0,
    workType: 'both',
    facts: [
      { text: 'Du lịch, thương mại và dịch vụ là nhóm ngành được định hướng phát triển trong Quy hoạch Thủ đô 2021–2030.', sources: ['qh1569-vcci'] },
      { text: 'Thương mại – dịch vụ và F&B là các lĩnh vực có nhu cầu nhân lực lớn (theo báo chí tháng 7/2026).', sources: ['dn-143089'] },
    ],
    roles: ['Nhân viên phục vụ, pha chế, bếp', 'Lễ tân, buồng phòng', 'Hướng dẫn viên, điều hành tour', 'Quản lý nhà hàng, quán'],
    skills: ['Phục vụ và giao tiếp', 'Tiếng Anh giao tiếp', 'An toàn thực phẩm', 'Quản lý ca (cho vị trí quản lý)'],
    steps: [
      { when: 'Tuần đầu', text: 'Có thể bắt đầu ngay với vị trí phục vụ, pha chế hoặc lễ tân.' },
      { when: '1–3 tháng', text: 'Học tiếng Anh giao tiếp và chứng chỉ nghiệp vụ liên quan (pha chế, an toàn thực phẩm, hướng dẫn viên).' },
      { when: '6–12 tháng', text: 'Lên vị trí quản lý ca; hoặc mở quán nhỏ khi đã hiểu vận hành — xem phường hợp mở ngành này trong Mở gì ở đâu.' },
    ],
    tools: [
      { label: 'Phường nào hợp mở quán', path: '/opportunity-map' },
      { label: 'Khám phá Hà Nội xưa và nay', path: '/time-machine' },
    ],
  },
  {
    id: 'finance',
    name: 'Tài chính, ngân hàng, bảo hiểm và kinh tế số',
    icon: '💼',
    blurb: 'Kế toán, tín dụng, tư vấn bảo hiểm, phân tích dữ liệu, vận hành thương mại điện tử và sản phẩm số.',
    fit: { tech: 2, engineering: 0, sales: 2, logistics: 1, service: 0, finance: 3, other: 1 },
    minEducation: 1,
    training: 1,
    workType: 'employee',
    facts: [
      { text: 'Tài chính, ngân hàng, bảo hiểm và kinh tế số nằm trong định hướng phát triển ngành dịch vụ của Quy hoạch Thủ đô 2021–2030.', sources: ['qh1569-vcci'] },
      { text: 'Hà Nội đang thiếu lao động chất lượng cao; doanh nghiệp ưu tiên nhân sự có chuyên môn (theo báo chí tháng 7/2026).', sources: ['vneconomy-50000', 'dn-143089'] },
    ],
    roles: ['Kế toán, kiểm toán viên', 'Chuyên viên tín dụng, tư vấn bảo hiểm', 'Phân tích dữ liệu', 'Vận hành thương mại điện tử'],
    skills: ['Kế toán và Excel nâng cao', 'Phân tích dữ liệu cơ bản', 'Chứng chỉ nghề (kế toán, bảo hiểm…)', 'Tiếng Anh'],
    steps: [
      { when: 'Tuần đầu', text: 'Chọn mảng: kế toán, tín dụng/bảo hiểm hay dữ liệu và thương mại điện tử.' },
      { when: '1–3 tháng', text: 'Học Excel nâng cao và nền tảng của mảng đã chọn; lấy chứng chỉ nghề khi cần.' },
      { when: '6–12 tháng', text: 'Ứng tuyển vị trí trợ lý hoặc thực tập; xây hồ sơ có sản phẩm thật (bảng phân tích, báo cáo mẫu).' },
    ],
    tools: [{ label: 'Xem quy hoạch trung tâm tài chính, dịch vụ', path: '/future-map' }],
  },
  {
    id: 'self',
    name: 'Tự kinh doanh nhỏ',
    icon: '🏪',
    blurb: 'Mở quán, cửa hàng hoặc dịch vụ nhỏ, bắt đầu từ vốn vừa phải.',
    fit: { tech: 1, engineering: 1, sales: 3, logistics: 1, service: 3, finance: 1, other: 2 },
    minEducation: 0,
    training: 1,
    workType: 'self',
    facts: [
      { text: 'Trang này không có số liệu thống kê về tự kinh doanh. Mở gì ở đâu chấm điểm cơ hội cho 12 ngành ở 79 phường/xã từ dữ liệu OpenStreetMap, kèm máy tính khả thi theo số của bạn.', sources: [] },
    ],
    roles: ['Chủ quán cà phê, quán ăn', 'Chủ cửa hàng tiện lợi, tạp hoá', 'Dịch vụ làm đẹp, giặt ủi, sửa xe', 'Bán hàng trực tuyến'],
    skills: ['Tính chi phí và dòng tiền', 'Chọn địa điểm', 'Quản lý nhân viên và tồn kho', 'Marketing cơ bản'],
    steps: [
      { when: 'Tuần đầu', text: 'Chọn ngành và tính thử lãi lỗ bằng máy tính khả thi, với số của chính bạn.' },
      { when: '1–3 tháng', text: 'Khảo sát thực địa vài phường có điểm cao; hỏi giá thuê thật; làm thử với quy mô nhỏ.' },
      { when: '6–12 tháng', text: 'Mở với vốn bạn chịu được rủi ro; nên có thêm thu nhập khác trong giai đoạn đầu.' },
    ],
    tools: [{ label: 'Mở Mở gì ở đâu', path: '/opportunity-map' }],
  },
];

export interface Policy {
  title: string;
  text: string;
  sources: string[];
}

/** What the Employment Law 2025 gives to the unemployed (summarised from the sources: check the law itself). */
export const POLICIES: Policy[] = [
  { title: 'Bốn chế độ bảo hiểm thất nghiệp', text: 'Tư vấn và giới thiệu việc làm; hỗ trợ đào tạo, nâng cao kỹ năng nghề; trợ cấp thất nghiệp; hỗ trợ doanh nghiệp đào tạo để duy trì việc làm.', sources: ['luat-viec-lam', 'lsvn-bhtn'] },
  { title: 'Trợ cấp thất nghiệp', text: 'Mỗi tháng bằng 60% mức lương bình quân đóng bảo hiểm thất nghiệp của 6 tháng gần nhất, có mức trần. Đóng đủ 12 đến dưới 36 tháng được hưởng 3 tháng; mỗi 12 tháng đóng thêm được thêm 1 tháng, tối đa 12 tháng.', sources: ['lsvn-bhtn'] },
  { title: 'Thời gian chờ', text: 'Từ 1/1/2026, thời gian giải quyết sau khi nộp hồ sơ rút còn 10 ngày làm việc (trước đây 15 ngày).', sources: ['lsvn-bhtn'] },
  { title: 'Hỗ trợ đào tạo', text: 'Người tham gia bảo hiểm thất nghiệp có thể được hỗ trợ khi học nâng cao kỹ năng nghề. Hãy hỏi trung tâm dịch vụ việc làm về điều kiện và mức hỗ trợ hiện hành.', sources: ['luat-viec-lam', 'lsvn-bhtn'] },
];

export interface Channel {
  name: string;
  url: string;
  text: string;
  sources: string[];
}

export const CHANNELS: Channel[] = [
  { name: 'Sàn giao dịch việc làm quốc gia', url: 'https://vieclam.gov.vn', text: 'Của Bộ Nội vụ, kết nối người lao động và doanh nghiệp trên cả nước; thông tin người tìm việc được xác thực qua định danh điện tử VNeID.', sources: ['nhandan-san-qg'] },
  { name: 'Cổng việc làm thành phố Hà Nội', url: 'https://congvieclam.hanoi.gov.vn', text: 'Của Trung tâm Dịch vụ việc làm Hà Nội, ra mắt tháng 12/2025.', sources: ['vneconomy-cong-hn'] },
];

/**
 * A place to work, and what is known about it. The ids are those of the places in GET /api/property-intel/metro-reach. `routed` areas are the destinations the driving times of Chấm điểm bất động sản
 * are computed to (OSRM). `plan` areas are the development poles of the Capital's plan: where the plan points growth, not
 * places that already have the jobs; their distance from a ward is a straight line between approximate centres.
 */
export interface WorkArea {
  id: string;
  name: string;
  kind: 'now' | 'plan';
  /** The destination id in the driving-time data (centre, offices, airport). */
  routed?: 'centre' | 'offices' | 'airport';
  /** [lng, lat]: the centre of the reference place, or the approximate centre of the districts a pole names (the straight-line distance, the map). */
  center?: [number, number];
  note: string;
  sources: string[];
}

const POLE = ['qd2512-poles', 'pole-roles'];
const LANDMARK = 'Điểm mốc dùng để tính thời gian đi lại, không phải danh sách nơi tuyển dụng.';

export const AREAS: Record<string, WorkArea> = {
  centre: { id: 'centre', name: 'Khu trung tâm (quanh Hồ Gươm)', kind: 'now', routed: 'centre', center: [105.8522, 21.0287], note: LANDMARK, sources: ['osrm'] },
  offices: { id: 'offices', name: 'Khu văn phòng Cầu Giấy – Duy Tân', kind: 'now', routed: 'offices', center: [105.7835, 21.0306], note: LANDMARK, sources: ['osrm'] },
  airport: { id: 'airport', name: 'Sân bay Nội Bài', kind: 'now', routed: 'airport', center: [105.8067, 21.2187], note: LANDMARK, sources: ['osrm'] },
  bac: { id: 'bac', name: 'Cực phía Bắc: Đông Anh – Mê Linh – Sóc Sơn', kind: 'plan', center: [105.8, 21.18], note: 'Quy hoạch: dịch vụ quốc tế, thương mại, tài chính, logistics gắn với sân bay Nội Bài và công nghiệp công nghệ cao.', sources: POLE },
  dong: { id: 'dong', name: 'Cực phía Đông: Gia Lâm – Long Biên', kind: 'plan', center: [105.93, 21.03], note: 'Quy hoạch: cửa ngõ phía Đông với thương mại, dịch vụ, logistics hiện đại gắn Quốc lộ 5 và cao tốc Hà Nội – Hải Phòng.', sources: POLE },
  'thuong-tin-phu-xuyen': { id: 'thuong-tin-phu-xuyen', name: 'Cực phía Nam: Thường Tín – Phú Xuyên', kind: 'plan', center: [105.88, 20.8], note: 'Quy hoạch: công nghiệp, logistics, đầu mối giao thông đa phương thức gắn sân bay phía Nam và đường sắt tốc độ cao.', sources: POLE },
  'xuan-mai': { id: 'xuan-mai', name: 'Cực Tây Nam: Xuân Mai – Chương Mỹ', kind: 'plan', center: [105.6, 20.9], note: 'Quy hoạch: giáo dục – đào tạo, y tế và du lịch sinh thái.', sources: POLE },
  'hoa-lac': { id: 'hoa-lac', name: 'Cực phía Tây: Hòa Lạc', kind: 'plan', center: [105.52, 21.01], note: 'Quy hoạch: đô thị khoa học công nghệ, đổi mới sáng tạo (Khu Công nghệ cao, Đại học Quốc gia).', sources: [...POLE, 'baodautu-bandan'] },
  'son-tay-ba-vi': { id: 'son-tay-ba-vi', name: 'Cực Tây Bắc: Sơn Tây – Ba Vì', kind: 'plan', center: [105.47, 21.12], note: 'Quy hoạch: đô thị văn hoá – lịch sử và du lịch.', sources: POLE },
  'song-hong': { id: 'song-hong', name: 'Cực không gian sông Hồng', kind: 'plan', center: [105.87, 21.045], note: 'Quy hoạch: cực cảnh quan đặc biệt với tài chính, thương mại, dịch vụ, du lịch.', sources: POLE },
};

/** The areas of each direction (ids of AREAS), in the order shown. Self-employment has none: it depends on the street, not the district. */
export const AREAS_OF: Record<string, string[]> = {
  semiconductor: ['hoa-lac', 'bac'],
  engineering: ['thuong-tin-phu-xuyen', 'bac'],
  logistics: ['airport', 'bac', 'dong', 'thuong-tin-phu-xuyen'],
  retail: ['centre', 'dong', 'song-hong'],
  tourism: ['centre', 'song-hong', 'son-tay-ba-vi', 'xuan-mai'],
  finance: ['offices', 'centre', 'song-hong', 'bac'],
  self: [],
};

/**
 * What the sources say about the market of each direction, in one line (for the market table, for people already in work
 * who want to compare). Signals from public sources, not wages and not the number of vacancies open.
 */
export const SIGNALS: Record<string, Fact> = {
  semiconductor: { text: 'Hà Nội thiếu khoảng 50.000 lao động chất lượng cao, tập trung ở công nghệ cao và kỹ thuật.', sources: ['vneconomy-50000'] },
  engineering: { text: 'Dự báo quý 2/2026: nhu cầu tuyển ngành chế biến, chế tạo và xây dựng tăng khoảng 5%.', sources: ['dbnd-tuyen-dung', 'dn-40000'] },
  logistics: { text: 'Dự báo quý 2/2026: nhu cầu tuyển ngành vận tải và logistics tăng khoảng 4%.', sources: ['dbnd-tuyen-dung', 'dn-40000'] },
  retail: { text: 'Dự báo quý 2/2026: nhu cầu tuyển ngành bán buôn, bán lẻ tăng khoảng 6%, cao nhất trong các nhóm được nêu.', sources: ['dbnd-tuyen-dung', 'dn-40000'] },
  tourism: { text: 'Du lịch, thương mại và dịch vụ nằm trong định hướng quy hoạch; F&B có nhu cầu nhân lực lớn (báo chí tháng 7/2026).', sources: ['qh1569-vcci', 'dn-143089'] },
  finance: { text: 'Tài chính, ngân hàng, bảo hiểm và kinh tế số nằm trong định hướng quy hoạch; doanh nghiệp ưu tiên nhân sự chuyên môn.', sources: ['qh1569-vcci', 'dn-143089'] },
  self: { text: 'Không có số liệu thống kê ở đây; xem điểm cơ hội từng phường và máy tính khả thi trong Mở gì ở đâu.', sources: [] },
};
