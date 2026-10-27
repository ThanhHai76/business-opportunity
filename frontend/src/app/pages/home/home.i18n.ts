import type { SiteLang } from '../../services/site-lang.service';

/** A need of a visitor and the tool that answers it (the quick start under the title). */
export interface Intent {
  id: string;
  icon: string;
  /** In the visitor's words. */
  want: string;
  /** What they will see. */
  tool: string;
  path: string;
  query?: Record<string, string>;
  accent: 'biz' | 'career' | 'property' | 'live' | 'future' | 'time';
}

/** One of the six tool cards. */
export interface ToolCard {
  id: 'future' | 'time' | 'biz' | 'career' | 'property' | 'live';
  path: string;
  icon: string;
  eyebrow: string;
  title: string;
  desc: string;
  meta: [string, string, string];
  cta: string;
}

export interface HomeText {
  eyebrow: string;
  title: string;
  sub: string;
  quickTitle: string;
  quickSub: string;
  quickTrust: string;
  wardTitle: string;
  wardSub: string;
  wardPlaceholder: string;
  wardGo: string;
  wardAll: string;
  intents: Intent[];
  groups: Record<'explore' | 'biz' | 'property', { title: string; hint: string }>;
  cards: ToolCard[];
  promoTitle: string;
  promoFree: string;
  promoMetered: (daily: number, story: number, premium: number) => string;
  promoUnmetered: string;
  promoSignIn: string;
  promoUpgrade: string;
  promoManage: string;
  footer: string;
}

export const HOME_TEXT: Record<SiteLang, HomeText> = {
  vi: {
    eyebrow: 'Năm công cụ · Ba nhóm · Một bản đồ khởi đầu',
    title: 'Chọn cách bạn muốn khám phá thành phố',
    sub: 'Từ cơ hội kinh doanh, hành trình xuyên thời gian đến việc chọn nơi an cư — năm công cụ tương tác dựng trên nền bản đồ đô thị, phục vụ năm mục đích rất khác nhau.',
    quickTitle: 'Bạn đang cần gì?',
    quickSub: 'Chọn điều gần nhất với bạn, chúng tôi đưa bạn tới đúng công cụ. Không cần đăng nhập để bắt đầu.',
    wardTitle: 'Tra cứu phường/xã của bạn',
    wardSub: 'Dân số, diện tích, ga metro gần nhất và ngành nổi bật của từng phường/xã trong 126 đơn vị mới.',
    wardPlaceholder: 'Ví dụ: Cầu Giấy, Hoàn Kiếm',
    wardGo: 'Tra cứu',
    wardAll: 'Xem cả danh sách',
    quickTrust: 'Mỗi con số có nguồn: dữ liệu OpenStreetMap, danh sách xã phường chính thức, văn bản và số liệu của cơ quan nhà nước. Chỗ nào chưa chắc chắn, chúng tôi nói rõ.',
    intents: [
      { id: 'shop', icon: '☕', want: 'Tôi muốn mở quán hoặc cửa hàng', tool: 'Mở gì ở đâu · phường nào hợp, có lời không', path: '/opportunity-map', accent: 'biz' },
      { id: 'job', icon: '💼', want: 'Tôi muốn tìm hướng nghề hoặc việc làm', tool: 'La bàn nghề nghiệp · 5 câu hỏi, kế hoạch 30 ngày', path: '/career', accent: 'career' },
      { id: 'home', icon: '🏠', want: 'Tôi muốn chọn nơi sống', tool: 'Điểm đáng sống · hợp với điều bạn quan tâm', path: '/living-score', accent: 'live' },
      { id: 'invest', icon: '📈', want: 'Tôi cân nhắc mua nhà hoặc đầu tư', tool: 'Chấm điểm bất động sản · tiềm năng từng phường', path: '/property-intelligence', accent: 'property' },
      { id: 'future', icon: '🛰️', want: 'Tôi muốn biết Hà Nội sẽ ra sao', tool: 'Hà Nội tương lai · quy hoạch đến 2065', path: '/future-map', accent: 'future' },
      { id: 'past', icon: '🏛️', want: 'Tôi tò mò về Hà Nội xưa', tool: 'Hà Nội xưa và nay · kể chuyện theo từng nơi', path: '/time-machine', accent: 'time' },
    ],
    groups: {
      explore: { title: 'Khám phá Hà Nội', hint: 'Lịch sử, quy hoạch, tương lai' },
      biz: { title: 'Kinh doanh và việc làm', hint: 'Mở quán, tìm hướng nghề nghiệp' },
      property: { title: 'Bất động sản', hint: 'Mua nhà, đầu tư, chọn nơi ở' },
    },
    cards: [
      { id: 'future', path: '/future-map', icon: '🛰️', eyebrow: 'Tầm nhìn · Quy hoạch & tương lai', title: 'Hà Nội tương lai', desc: 'Quy hoạch Thủ đô trên bản đồ, từ hiện trạng 2026 đến tầm nhìn 2065: 9 cực phát triển, 9 trục động lực, metro đang chạy, đang thi công và theo quy hoạch — mỗi đối tượng ghi nguồn; hỏi đáp, so sánh các mốc.', meta: ['4 mốc · 9 cực phát triển · 9 lớp bản đồ · Việt/Anh', 'Theo QĐ 2512/QĐ-UBND, 1668 và 1569/QĐ-TTg — hình học là sơ đồ', 'Dành cho người quan tâm quy hoạch, nhà đầu tư, sinh viên đô thị'], cta: 'Khám phá Hà Nội tương lai' },
      { id: 'time', path: '/time-machine', icon: '🕰️', eyebrow: 'Trải nghiệm · Văn hoá & giáo dục', title: 'Hà Nội xưa và nay', desc: 'Chọn một địa danh, kéo timeline từ 1926 đến 2100, nghe AI kể chuyện lịch sử có nguồn xác thực — hoặc mở chế độ AR để đặt Hà Nội xưa và những kịch bản tương lai lên đúng khung cảnh bạn đang đứng.', meta: ['1926 → 2100 · 13 địa danh tiêu biểu', 'Historical Mode có nguồn · Future Mode gắn nhãn kịch bản', 'Dành cho du khách, trường học, bảo tàng'], cta: 'Bước vào cỗ máy thời gian' },
      { id: 'biz', path: '/opportunity-map', icon: '🗺️', eyebrow: 'B2B · Phân tích thị trường', title: 'Mở gì ở đâu', desc: 'Phường nào ở Hà Nội nên mở gì — hôm nay và 3–5 năm tới — và có lời không? Điểm cơ hội cho 12 ngành theo từng phường/xã mới (2025) từ dữ liệu OpenStreetMap, kèm máy tính khả thi (doanh thu, chi phí, hoàn vốn theo số của bạn), so sánh, hỏi AI và báo cáo.', meta: ['79 phường/xã · 12 ngành · mốc hiện tại và 2030 · tính khả thi', 'Chấm điểm minh bạch, mỗi điểm có số liệu và nguồn', 'Dành cho chủ shop, SME, F&B, chuỗi bán lẻ, nhà đầu tư'], cta: 'Tìm nơi mở cửa hàng' },
      { id: 'career', path: '/career', icon: '🧭', eyebrow: 'Người tìm việc · Định hướng nghề nghiệp', title: 'La bàn nghề nghiệp Hà Nội', desc: 'Trả lời 5 câu hỏi ngắn để thấy những hướng nghề hợp với bạn theo cách Hà Nội đang thay đổi: công nghệ cao, xây dựng, logistics, bán lẻ, du lịch, tài chính hoặc tự kinh doanh — kèm kỹ năng, lộ trình và nơi tìm việc chính thống.', meta: ['7 hướng nghề · số liệu thị trường lao động và quy hoạch có nguồn', 'Chính sách hỗ trợ người thất nghiệp theo Luật Việc làm 2025', 'Dành cho người thất nghiệp, đổi nghề, sinh viên mới ra trường và người đang đi làm muốn xem thị trường'], cta: 'Tìm hướng đi nghề nghiệp' },
      { id: 'property', path: '/property-intelligence', icon: '🏙️', eyebrow: 'Nhà đầu tư · Bất động sản', title: 'Chấm điểm bất động sản', desc: 'Điểm tiềm năng của 79 phường/xã Hà Nội từ dữ liệu thật: khoảng cách tới metro, cầu và Vành đai 4 đang xây, tuyến metro quy hoạch, cực phát triển theo QĐ 2512, tiện ích và dân cư — hỏi AI “Phường Bồ Đề có đáng mua trong 5 năm tới?”.', meta: ['79 phường/xã · mốc quy hoạch 2026 / 2030 / 2045 · Việt/Anh', 'Giá đất Nhà nước 2026, thị trường CBRE/Savills, 24 dự án, thời gian lái xe — mọi số có nguồn', 'Dành cho người mua nhà, nhà đầu tư, môi giới'], cta: 'Xem điểm bất động sản' },
      { id: 'live', path: '/living-score', icon: '📍', eyebrow: 'Người ở · Chọn nơi an cư', title: 'Điểm đáng sống', desc: 'Chấm điểm mức độ đáng sống quanh 10 quận cũ của Hà Nội theo giao thông, giáo dục, y tế, công viên – hồ nước và tiện ích, đo từ dữ liệu OpenStreetMap — so sánh 2–3 khu vực và nhận gợi ý cá nhân hoá từ AI.', meta: ['10 khu vực · 5 tiêu chí có dữ liệu · điểm cá nhân hoá', 'Bản đồ, so sánh, AI gợi ý Top 3 kèm lý do', 'Dành cho người tìm nhà, gia đình trẻ, người chuyển việc'], cta: 'Tìm nơi sống phù hợp' },
    ],
    promoTitle: 'Dùng thử miễn phí, nâng cấp khi cần',
    promoFree: 'Bản đồ, điểm số và câu trả lời cơ bản luôn miễn phí.',
    promoMetered: (daily, story, premium) => `Đăng nhập để nhận ${daily} lượt AI chuyên sâu mỗi ngày (${story} lượt cho Hà Nội xưa và nay). Premium nâng lên ${premium} lượt mỗi ngày.`,
    promoUnmetered: 'Premium thêm lượt hỏi AI chuyên sâu và credit báo cáo.',
    promoSignIn: 'Đăng nhập dùng thử',
    promoUpgrade: '★ Nâng cấp Premium',
    promoManage: 'Quản lý Premium',
    footer: 'Demo dự án bản đồ đô thị tương tác · © 2026',
  },
  en: {
    eyebrow: 'Five tools · Three groups · One map to start',
    title: 'Choose how you want to explore the city',
    sub: 'From business opportunities and a journey through time to choosing where to live: five interactive tools built on an urban map, for five very different purposes.',
    quickTitle: 'What do you need?',
    quickSub: 'Pick what is closest to you and we will take you to the right tool. No sign-in needed to start.',
    wardTitle: 'Look up your ward or commune',
    wardSub: 'Population, area, nearest metro station and top sector for each of the 126 new wards and communes.',
    wardPlaceholder: 'For example: Cau Giay, Hoan Kiem',
    wardGo: 'Look up',
    wardAll: 'See the full list',
    quickTrust: 'Every figure has a source: OpenStreetMap data, the official list of wards and communes, documents and statistics of State agencies. Where we are not sure, we say so.',
    intents: [
      { id: 'shop', icon: '☕', want: 'I want to open a café or shop', tool: 'Business Opportunity Map · which ward suits it, and does it pay', path: '/opportunity-map', accent: 'biz' },
      { id: 'job', icon: '💼', want: 'I want to find a career path or a job', tool: 'Career Compass · 5 questions, a 30-day plan', path: '/career', accent: 'career' },
      { id: 'home', icon: '🏠', want: 'I want to choose where to live', tool: 'Living Score · fitted to what you care about', path: '/living-score', accent: 'live' },
      { id: 'invest', icon: '📈', want: 'I am thinking of buying a home or investing', tool: 'AI Property Intelligence · the potential of each ward', path: '/property-intelligence', accent: 'property' },
      { id: 'future', icon: '🛰️', want: 'I want to know what Hanoi will look like', tool: 'Hanoi Future Map · the plan to 2065', path: '/future-map', accent: 'future' },
      { id: 'past', icon: '🏛️', want: 'I am curious about old Hanoi', tool: 'Hanoi Time Machine · stories place by place', path: '/time-machine', accent: 'time' },
    ],
    groups: {
      explore: { title: 'Explore Hanoi', hint: 'History, planning, the future' },
      biz: { title: 'Business and jobs', hint: 'Open a shop, find a career path' },
      property: { title: 'Real estate', hint: 'Buy a home, invest, choose where to live' },
    },
    cards: [
      { id: 'future', path: '/future-map', icon: '🛰️', eyebrow: 'Vision · Planning & the future', title: 'Hanoi Future Map', desc: "The Capital's plan on a map, from the present in 2026 to the vision of 2065: 9 development poles, 9 growth axes, metro running, under construction and planned. Every object cites its source; ask questions and compare the milestones.", meta: ['4 milestones · 9 poles · 9 map layers · Vietnamese/English', 'Per Decisions 2512/QĐ-UBND, 1668 and 1569/QĐ-TTg; the geometry is a sketch', 'For anyone interested in planning, investors, urban-studies students'], cta: 'Explore the future of Hanoi' },
      { id: 'time', path: '/time-machine', icon: '🕰️', eyebrow: 'Experience · Culture & education', title: 'Hanoi Time Machine', desc: 'Pick a landmark, drag the timeline from 1926 to 2100 and hear the AI tell its history with real sources, or open AR to place old Hanoi and future scenarios in the very scene you are standing in.', meta: ['1926 → 2100 · 13 landmarks', 'Historical Mode is sourced · Future Mode labels each scenario', 'For visitors, schools, museums'], cta: 'Step into the time machine' },
      { id: 'biz', path: '/opportunity-map', icon: '🗺️', eyebrow: 'B2B · Market analysis', title: 'Business Opportunity Map', desc: 'Which ward of Hanoi should open what, today and in 3–5 years, and would it pay? Opportunity scores for 12 sectors in each new ward and commune (2025) from OpenStreetMap data, with a feasibility calculator (revenue, costs, payback from your own numbers), comparison, AI questions and reports.', meta: ['79 wards and communes · 12 sectors · today and 2030 · feasibility', 'Transparent scoring: every score has its figures and sources', 'For shop owners, SMEs, F&B, retail chains, investors'], cta: 'Find where to open a shop' },
      { id: 'career', path: '/career', icon: '🧭', eyebrow: 'Job seekers · Career guidance', title: 'Hanoi Career Compass', desc: 'Answer 5 short questions to see the career paths that suit you as Hanoi changes: high technology, construction, logistics, retail, tourism, finance or running your own business, with skills, a path and the official places to look for work.', meta: ['7 career paths · labour market and planning figures with sources', 'Support for the unemployed under the Employment Law 2025', 'For the unemployed, career changers, new graduates and people in work who want to see the market'], cta: 'Find your career path' },
      { id: 'property', path: '/property-intelligence', icon: '🏙️', eyebrow: 'Investors · Real estate', title: 'AI Property Intelligence', desc: 'The potential of 79 wards and communes of Hanoi from real data: distance to the metro, to the bridges and Ring Road 4 under construction, planned metro lines, development poles under Decision 2512, amenities and residents. Ask the AI, "Is Phường Bồ Đề worth buying in over the next 5 years?".', meta: ['79 wards and communes · planning milestones 2026 / 2030 / 2045 · Vietnamese/English', 'State land prices 2026, CBRE/Savills market, 24 projects, driving times — every figure has a source', 'For home buyers, investors, brokers'], cta: 'See the property scores' },
      { id: 'live', path: '/living-score', icon: '📍', eyebrow: 'Residents · Choosing a home', title: 'Living Score', desc: 'Scores how liveable the 10 old districts of Hanoi are for transport, education, health, parks and lakes, and amenities, measured from OpenStreetMap data. Compare 2–3 areas and get personalised suggestions from the AI.', meta: ['10 areas · 5 criteria with data · personalised score', 'Map, comparison, an AI Top 3 with reasons', 'For home seekers, young families, people changing jobs'], cta: 'Find where to live' },
    ],
    promoTitle: 'Try it free, upgrade when you need to',
    promoFree: 'The maps, the scores and the basic answers are always free.',
    promoMetered: (daily, story, premium) => `Sign in to get ${daily} in-depth AI questions a day (${story} for Hanoi Time Machine). Premium raises it to ${premium} a day.`,
    promoUnmetered: 'Premium adds in-depth AI questions and report credits.',
    promoSignIn: 'Sign in to try',
    promoUpgrade: '★ Upgrade to Premium',
    promoManage: 'Manage Premium',
    footer: 'An interactive urban map demo project · © 2026',
  },
};
