import type { SiteLang } from '../../services/site-lang.service';

/** The words of the Premium page, in both languages. */
export interface PremiumText {
  eyebrow: string;
  title: string;
  lead: string;
  yourAccount: string;
  plan: string;
  free: string;
  until: string;
  aiToday: string;
  premiumSuffix: string;
  freeSuffix: string;
  storyToday: string;
  orPremium: string;
  bought: string;
  creditsReport: string;
  loading: string;
  compare: string;
  freeTitle: string;
  freeFeatures: [string, string, string];
  freeDaily: (n: number) => string;
  freeStory: (n: number) => string;
  freeTail: [string, string];
  signInFree: string;
  perDays: (n: number) => string;
  premiumPre: string;
  premiumDaily: (n: number) => string;
  premiumFeatures: { bizLabel: string; biz: string; propLabel: string; prop: string; brandLabel: string; brand: string; save: string; careerLabel: string; career: string; credits: string; extend: string };
  withCredits: (n: number) => string;
  buy: string;
  packsTitle: string;
  packsHint: string;
  perQuestion: string;
  packsReport: (link: string) => string;
  reportsLink: string;
  billingOff: string;
  signInToBuy: string;
  signIn: string;
  waiting: (code: number) => string;
  cancel: string;
  note: (terms: string, refund: string) => string;
  terms: string;
  refund: string;
  popupBlocked: string;
  paid: (parts: string) => string;
  paidDays: (n: number) => string;
  paidQuestions: (n: number) => string;
  paidCredits: (n: number) => string;
  paidFallback: string;
  cancelled: string;
  expired: string;
}

export const PREMIUM_TEXT: Record<SiteLang, PremiumText> = {
  vi: {
    eyebrow: 'Gói & lượt hỏi AI',
    title: 'Premium và lượt hỏi AI chuyên sâu',
    lead: 'Bản đồ, điểm số và câu trả lời cơ bản luôn miễn phí. Câu trả lời do AI phân tích sâu từ dữ liệu (Mở gì ở đâu, Hà Nội tương lai, Chấm điểm bất động sản, Điểm đáng sống, kể chuyện Hà Nội xưa và nay) dùng lượt hỏi AI.',
    yourAccount: 'Tài khoản của bạn',
    plan: 'Gói',
    free: 'Miễn phí',
    until: 'đến',
    aiToday: 'Lượt AI hôm nay',
    premiumSuffix: 'Premium ·',
    freeSuffix: 'miễn phí',
    storyToday: 'Lượt kể chuyện Hà Nội xưa và nay hôm nay',
    orPremium: ' · hoặc dùng lượt Premium',
    bought: 'Lượt AI đã mua',
    creditsReport: 'Credit báo cáo khả thi',
    loading: 'Đang tải…',
    compare: 'So sánh gói',
    freeTitle: 'Miễn phí',
    freeFeatures: ['Mọi bản đồ và điểm số hôm nay', 'Xem thử mốc 2030 từng phường, 3 phường hợp kế hoạch nhất, so sánh 2 phường, theo dõi 3 mục', 'Câu trả lời cơ bản (theo mẫu, từ dữ liệu) không giới hạn'],
    freeDaily: (n) => `${n} câu trả lời AI chuyên sâu mỗi ngày`,
    freeStory: (n) => `${n} lượt AI kể chuyện mỗi ngày`,
    freeTail: ['Lưu 5 báo cáo, mở trên mọi thiết bị', 'La bàn nghề nghiệp: bảng hỏi, kết quả, thị trường, bản đồ ngành nghề, vùng đi làm và metro; 1 kế hoạch 30 ngày lưu trên trình duyệt'],
    signInFree: 'Đăng nhập miễn phí',
    perDays: (n) => `/ ${n} ngày`,
    premiumPre: 'Mọi thứ của gói Miễn phí',
    premiumDaily: (n) => `${n} câu trả lời AI chuyên sâu mỗi ngày`,
    premiumFeatures: {
      bizLabel: 'Mở gì ở đâu:',
      biz: 'mốc 2030 trên toàn bản đồ, danh sách đầy đủ theo kế hoạch, xuất CSV',
      propLabel: 'Chấm điểm bất động sản:',
      prop: 'lớp quy hoạch 2030 và 2045, trọng số tuỳ chỉnh, so sánh tới 5 phường và xuất CSV, theo dõi không giới hạn',
      brandLabel: 'Báo cáo khả thi mang thương hiệu của bạn:',
      brand: 'tên công ty, liên hệ và lời nhắn trên bản PDF gửi khách (dành cho môi giới)',
      save: 'Lưu tới 100 báo cáo, kèm ghi chú và thẻ cho từng báo cáo',
      careerLabel: 'La bàn nghề nghiệp:',
      career: 'lưu kế hoạch vào tài khoản (tới 5 kế hoạch, mọi thiết bị), xuất PDF kế hoạch mang tên và liên hệ của bạn (cho tư vấn viên, trung tâm đào tạo), tìm nơi ở theo nơi làm; bài toán đổi nghề: so sánh tới 3 hướng và xuất PDF lộ trình chuyển nghề',
      credits: 'Kèm credit báo cáo khả thi (xuất PDF) theo gói',
      extend: 'Mua thêm thì cộng dồn thời hạn',
    },
    withCredits: (n) => ` · kèm ${n} credit báo cáo`,
    buy: 'Mua',
    packsTitle: 'Gói lượt hỏi AI',
    packsHint: 'Dùng sau khi hết lượt miễn phí (và lượt Premium) trong ngày. Không hết hạn.',
    perQuestion: '/ lượt',
    packsReport: () => '',
    reportsLink: 'Mở gì ở đâu',
    billingOff: 'Thanh toán chưa được bật trên máy chủ này.',
    signInToBuy: 'Đăng nhập để mua gói.',
    signIn: 'Đăng nhập',
    waiting: (code) => `Đang chờ thanh toán đơn ${code} ở tab vừa mở…`,
    cancel: 'Huỷ',
    note: () => '',
    terms: 'Điều khoản',
    refund: 'Chính sách hoàn tiền',
    popupBlocked: 'Trình duyệt đã chặn tab thanh toán — hãy cho phép cửa sổ bật lên rồi thử lại.',
    paid: (parts) => `Thanh toán thành công — đã cộng ${parts}.`,
    paidDays: (n) => `${n} ngày Premium`,
    paidQuestions: (n) => `${n} lượt hỏi AI`,
    paidCredits: (n) => `${n} credit báo cáo`,
    paidFallback: 'gói đã mua',
    cancelled: 'Đã huỷ thanh toán.',
    expired: 'Đơn đã hết hạn — bạn có thể mua lại.',
  },
  en: {
    eyebrow: 'Plans & AI questions',
    title: 'Premium and in-depth AI questions',
    lead: 'The maps, the scores and the basic answers are always free. Answers that the AI analyses in depth from the data (Business Opportunity Map, Hanoi Future Map, AI Property Intelligence, Living Score, the Hanoi Time Machine storyteller) use AI questions.',
    yourAccount: 'Your account',
    plan: 'Plan',
    free: 'Free',
    until: 'until',
    aiToday: 'AI questions today',
    premiumSuffix: 'Premium ·',
    freeSuffix: 'free',
    storyToday: 'Hanoi Time Machine stories today',
    orPremium: ' · or use Premium questions',
    bought: 'AI questions bought',
    creditsReport: 'Feasibility report credits',
    loading: 'Loading…',
    compare: 'Compare the plans',
    freeTitle: 'Free',
    freeFeatures: ['Every map and score as it is today', 'A preview of 2030 for each ward, the 3 best-fitting wards, comparing 2 wards, watching 3 items', 'Unlimited basic answers (from templates, built from the data)'],
    freeDaily: (n) => `${n} in-depth AI answers a day`,
    freeStory: (n) => `${n} AI storytelling questions a day`,
    freeTail: ['Save 5 reports and open them on any device', 'Career Compass: the questions, results, market, sector map, commuting zone and metro; one 30-day plan kept in the browser'],
    signInFree: 'Sign in free',
    perDays: (n) => `/ ${n} days`,
    premiumPre: 'Everything in the Free plan',
    premiumDaily: (n) => `${n} in-depth AI answers a day`,
    premiumFeatures: {
      bizLabel: 'Business Opportunity Map:',
      biz: 'the 2030 horizon on the whole map, the full list of fitting wards, CSV export',
      propLabel: 'AI Property Intelligence:',
      prop: 'the 2030 and 2045 planning layers, custom weights, comparing up to 5 wards with CSV export, unlimited watching',
      brandLabel: 'Feasibility reports with your own branding:',
      brand: 'your company, contact details and a message on the PDF you send to clients (for brokers)',
      save: 'Save up to 100 reports, with a note and tags for each',
      careerLabel: 'Career Compass:',
      career: 'plans kept in your account (up to 5, on every device), a PDF of the plan with your name and contact details (for advisers and training centres), and where to live for the work; the career-change calculator: compare up to 3 options and export a PDF of the plan',
      credits: 'Includes feasibility report credits (PDF export) with the plan',
      extend: 'Buying again adds to the time left',
    },
    withCredits: (n) => ` · with ${n} report credit${n === 1 ? '' : 's'}`,
    buy: 'Buy',
    packsTitle: 'AI question packs',
    packsHint: 'Used once the free questions (and the Premium ones) of the day run out. They do not expire.',
    perQuestion: '/ question',
    packsReport: () => '',
    reportsLink: 'Business Opportunity Map',
    billingOff: 'Payments are not turned on on this server.',
    signInToBuy: 'Sign in to buy a plan.',
    signIn: 'Sign in',
    waiting: (code) => `Waiting for the payment of order ${code} in the tab that just opened…`,
    cancel: 'Cancel',
    note: () => '',
    terms: 'Terms',
    refund: 'Refund policy',
    popupBlocked: 'Your browser blocked the payment tab: allow pop-ups and try again.',
    paid: (parts) => `Payment received: ${parts} added.`,
    paidDays: (n) => `${n} days of Premium`,
    paidQuestions: (n) => `${n} AI questions`,
    paidCredits: (n) => `${n} report credits`,
    paidFallback: 'the plan you bought',
    cancelled: 'The payment was cancelled.',
    expired: 'The order expired: you can buy again.',
  },
};
