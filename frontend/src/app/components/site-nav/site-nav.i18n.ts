import type { SiteLang } from '../../services/site-lang.service';

export type ToolKey = 'biz' | 'time' | 'live' | 'future' | 'property' | 'career';

/** The words of the top bar, in both languages. The tool names are the ones each tool uses for itself. */
export interface NavText {
  brandAria: string;
  chooseTool: string;
  tools: Record<ToolKey, { label: string; short: string; hint: string }>;
  groups: Record<'explore' | 'biz' | 'property', { label: string; hint: string }>;
  upgrade: string;
  premium: string;
  signIn: string;
  accountOf: (email: string) => string;
  themeToLight: string;
  themeToDark: string;
  lightTitle: string;
  darkTitle: string;
  langAria: string;
  langShort: string;
  menuClose: string;
  menuOpen: string;
  home: string;
  homeHint: string;
  yourPremium: string;
  upgradePremium: string;
  premiumHint: string;
  nudgeFree: (daily: number, story: number) => string;
  nudgeSave: string;
  nudgeSignIn: string;
  nudgeLeft: (free: number, bought: number, premiumPerDay: number) => string;
  nudgeUsed: (premiumPerDay: number) => string;
  nudgePremium: string;
  nudgeUpgrade: string;
  nudgeHide: string;
}

export const NAV_TEXT: Record<SiteLang, NavText> = {
  vi: {
    brandAria: 'Hanoi Century Vista — trang chủ',
    chooseTool: 'Chọn công cụ',
    tools: {
      future: { label: 'Hà Nội tương lai', short: 'Tương lai', hint: 'Quy hoạch Thủ đô 2026 → 2085, có nguồn' },
      time: { label: 'Hà Nội xưa và nay', short: 'Xưa và nay', hint: 'Du hành thời gian 1926 → 2100, có AR' },
      live: { label: 'Điểm đáng sống', short: 'Đáng sống', hint: 'Chấm điểm nơi an cư từ dữ liệu OpenStreetMap' },
      property: { label: 'Chấm điểm bất động sản', short: 'Điểm BĐS', hint: 'Tiềm năng 79 phường/xã: metro, hạ tầng, quy hoạch' },
      biz: { label: 'Mở gì ở đâu', short: 'Mở gì ở đâu', hint: 'Phường nào nên mở gì, có lời không — dữ liệu OSM' },
      career: { label: 'La bàn nghề nghiệp', short: 'Nghề nghiệp', hint: 'Hướng nghề theo cách Hà Nội thay đổi, có nguồn' },
    },
    groups: {
      explore: { label: 'Khám phá Hà Nội', hint: 'Lịch sử, quy hoạch, tương lai' },
      biz: { label: 'Kinh doanh và việc làm', hint: 'Mở quán, tìm hướng nghề nghiệp' },
      property: { label: 'Bất động sản', hint: 'Mua nhà, đầu tư, chọn nơi ở' },
    },
    upgrade: 'Nâng cấp',
    premium: 'Premium',
    signIn: 'Đăng nhập',
    accountOf: (email) => `Tài khoản: ${email}`,
    themeToLight: 'Chuyển sang giao diện sáng',
    themeToDark: 'Chuyển sang giao diện tối',
    lightTitle: 'Giao diện sáng',
    darkTitle: 'Giao diện tối',
    langAria: 'Chuyển sang tiếng Anh (English)',
    langShort: 'EN',
    menuClose: 'Đóng menu',
    menuOpen: 'Mở menu công cụ',
    home: 'Trang chủ',
    homeHint: 'Tổng quan sáu công cụ theo ba nhóm',
    yourPremium: 'Premium của bạn',
    upgradePremium: 'Nâng cấp Premium',
    premiumHint: 'Thêm lượt hỏi AI chuyên sâu, credit báo cáo',
    nudgeFree: (daily, story) => `Dùng thử miễn phí: đăng nhập để nhận ${daily} lượt AI chuyên sâu mỗi ngày (Hà Nội xưa và nay ${story}).`,
    nudgeSave: 'Đăng nhập để lưu báo cáo và mở trên mọi thiết bị.',
    nudgeSignIn: 'Đăng nhập miễn phí',
    nudgeLeft: (free, bought, perDay) => `Hôm nay bạn còn ${free} lượt AI miễn phí${bought ? ` và ${bought} lượt đã mua` : ''}. Premium: ${perDay} lượt mỗi ngày.`,
    nudgeUsed: (perDay) => `Bạn đã dùng hết lượt AI miễn phí hôm nay. Premium: ${perDay} lượt mỗi ngày.`,
    nudgePremium: 'Premium: thêm lượt hỏi AI chuyên sâu và credit báo cáo.',
    nudgeUpgrade: 'Nâng cấp Premium',
    nudgeHide: 'Ẩn lời mời này',
  },
  en: {
    brandAria: 'Hanoi Century Vista — home',
    chooseTool: 'Choose a tool',
    tools: {
      future: { label: 'Hanoi Future Map', short: 'Future', hint: 'The Capital plan 2026 → 2085, with sources' },
      time: { label: 'Hanoi Time Machine', short: 'Then & now', hint: 'Time travel 1926 → 2100, with AR' },
      live: { label: 'Living Score', short: 'Livability', hint: 'Where to live, scored from OpenStreetMap data' },
      property: { label: 'AI Property Intelligence', short: 'Property', hint: 'The potential of 79 wards: metro, infrastructure, planning' },
      biz: { label: 'Business Opportunity Map', short: 'What to open', hint: 'Which ward suits which business, and does it pay — OSM data' },
      career: { label: 'Hanoi Career Compass', short: 'Careers', hint: 'Career paths as Hanoi changes, with sources' },
    },
    groups: {
      explore: { label: 'Explore Hanoi', hint: 'History, planning, the future' },
      biz: { label: 'Business and jobs', hint: 'Open a shop, find a career path' },
      property: { label: 'Real estate', hint: 'Buy a home, invest, choose where to live' },
    },
    upgrade: 'Upgrade',
    premium: 'Premium',
    signIn: 'Sign in',
    accountOf: (email) => `Account: ${email}`,
    themeToLight: 'Switch to the light theme',
    themeToDark: 'Switch to the dark theme',
    lightTitle: 'Light theme',
    darkTitle: 'Dark theme',
    langAria: 'Chuyển sang tiếng Việt (Vietnamese)',
    langShort: 'VI',
    menuClose: 'Close the menu',
    menuOpen: 'Open the tools menu',
    home: 'Home',
    homeHint: 'An overview of the six tools in three groups',
    yourPremium: 'Your Premium',
    upgradePremium: 'Upgrade to Premium',
    premiumHint: 'More in-depth AI questions and report credits',
    nudgeFree: (daily, story) => `Try it free: sign in to get ${daily} in-depth AI questions a day (Hanoi Time Machine: ${story}).`,
    nudgeSave: 'Sign in to save reports and open them on any device.',
    nudgeSignIn: 'Sign in free',
    nudgeLeft: (free, bought, perDay) => `You have ${free} free AI question${free === 1 ? '' : 's'} left today${bought ? ` and ${bought} bought` : ''}. Premium: ${perDay} a day.`,
    nudgeUsed: (perDay) => `You have used today's free AI questions. Premium: ${perDay} a day.`,
    nudgePremium: 'Premium: more in-depth AI questions and report credits.',
    nudgeUpgrade: 'Upgrade to Premium',
    nudgeHide: 'Hide this invitation',
  },
};
