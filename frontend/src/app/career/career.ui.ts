import type { CareerLang } from './career.local';

/** The words of the page itself (the content and its figures are in career.data.ts and career.en.ts). */
export interface CareerText {
  docTitle: string;
  language: string;
  eyebrow: string;
  title: string;
  lead: string;
  tabsLabel: string;
  tabs: { paths: string; plan: string; switch: string; market: string; map: string; support: string };
  aboutYou: string;
  q1: string;
  q2: string;
  q2Hint: string;
  q3: string;
  q4: string;
  q5: string;
  q6: string;
  q6Hint: string;
  notChosen: string;
  wardAria: string;
  seeResults: string;
  answerAll: string;
  calcLink: string;
  calcCost: string;
  redo: string;
  resultsTitle: string;
  resultsNote: string;
  employedNote: string;
  seeMap: string;
  details: string;
  hanoi: string;
  roles: string;
  skills: string;
  route: string;
  placesTitle: string;
  planTag: string;
  landmarkTag: string;
  from: (ward: string, text: string) => string;
  nearestWards: string;
  nearKm: string;
  chooseWard: string;
  placesNote: string;
  fewer: (n: number) => string;
  more: (n: number) => string;
  howTitle: string;
  how: (w: { background: number; training: number; education: number; work: number }) => string;
  levels: { high: string; medium: string; low: string };
  plansLabel: string;
  premiumPlans: (max: number) => string;
  planHead: (name: string) => string;
  planSub: (started: string, dayText: string) => string;
  dayOf: (day: number) => string;
  over30: string;
  tasks: (done: number, total: number) => string;
  progressAria: string;
  after: string;
  exportPdf: string;
  exportHint: string;
  exportBlocked: string;
  brandTeaser: string;
  brandHint: string;
  keepNote: string;
  clear: string;
  emptyTitle: string;
  emptyText: string;
  emptyButton: string;
  syncing: string;
  saved: string;
  planOn: string;
  planExtra: string;
  planStart: string;
  planLimit: (max: number) => string;
  askSave: string;
  askMany: string;
  askPdf: string;
  contextTitle: string;
  contextNote: string;
  marketTitle: string;
  marketNote: string;
  colField: string;
  colSignal: string;
  yours: string;
  supportTitle: string;
  policiesTitle: string;
  policiesNote: string;
  findTitle: string;
  findNote: string;
  sourcesTitle: string;
  sourcesNote: (date: string) => string;
  sourcesLang: string;
  mapLoading: string;
}

export const CAREER_TEXT: Record<CareerLang, CareerText> = {
  vi: {
    docTitle: 'La bàn nghề nghiệp Hà Nội · Hanoi Century Vista',
    language: 'Đổi ngôn ngữ',
    eyebrow: 'Việc làm · Định hướng nghề nghiệp',
    title: 'La bàn nghề nghiệp Hà Nội',
    lead: 'Dành cho người đang thất nghiệp, muốn đổi nghề, mới ra trường, và cả người đang đi làm muốn tham khảo thị trường việc làm. Trả lời 5 câu hỏi ngắn để thấy những hướng nghề hợp với bạn, gắn với cách Hà Nội đang thay đổi. Mỗi con số đều có nguồn.',
    tabsLabel: 'Các phần của trang',
    tabs: { paths: 'Hướng nghề của bạn', plan: 'Kế hoạch 30 ngày', switch: 'Đổi nghề', market: 'Thị trường', map: 'Bản đồ', support: 'Hỗ trợ và nơi tìm việc' },
    aboutYou: 'Về bạn',
    q1: '1. Bạn đang ở hoàn cảnh nào?',
    q2: '2. Nghề hiện tại, nghề cũ hoặc ngành đã học của bạn?',
    q2Hint: 'Chọn một hoặc nhiều',
    q3: '3. Trình độ cao nhất của bạn?',
    q4: '4. Bạn có bao lâu để học thêm trước khi bắt đầu việc mới?',
    q5: '5. Bạn muốn làm thuê hay tự kinh doanh?',
    q6: '6. Bạn đang ở phường/xã nào?',
    q6Hint: 'Không bắt buộc: để xem khoảng cách tới nơi làm việc',
    notChosen: 'Chưa chọn',
    wardAria: 'Phường hoặc xã bạn đang ở',
    seeResults: 'Xem hướng nghề của bạn ↓',
    answerAll: 'Trả lời đủ 5 câu đầu để xem kết quả (câu 6 không bắt buộc). Câu trả lời chỉ lưu trên trình duyệt này.',
    calcLink: 'Muốn biết đổi nghề tốn bao nhiêu và bao lâu hoàn vốn? Tính ở tab Đổi nghề →',
    calcCost: 'Tính chi phí đổi sang hướng này',
    redo: 'Làm lại',
    resultsTitle: 'Hướng nghề gợi ý cho bạn',
    resultsNote: 'Xếp theo mức phù hợp với câu trả lời của bạn. Đây là gợi ý để bạn tìm hiểu thêm, không phải lời hứa có việc làm.',
    employedNote: 'Bạn không cần đổi việc: hãy dùng kết quả để so sánh nghề hiện tại với các hướng khác và với thị trường.',
    seeMap: 'Xem bản đồ ngành nghề theo khu vực ↓',
    details: 'Hà Nội đang thay đổi thế nào, kỹ năng và bước đầu tiên',
    hanoi: 'Hà Nội',
    roles: 'Vị trí thường gặp',
    skills: 'Kỹ năng cần có',
    route: 'Gợi ý lộ trình',
    placesTitle: 'Nơi làm việc và nơi ở',
    planTag: 'Theo quy hoạch',
    landmarkTag: 'Điểm mốc',
    from: (ward, text) => `Từ ${ward}: ${text}.`,
    nearestWards: 'Phường/xã gần nhất trong 79 nơi có dữ liệu:',
    nearKm: 'km',
    chooseWard: 'Chọn phường/xã bạn ở (câu 6) để xem khoảng cách.',
    placesNote: 'Cực theo quy hoạch là hướng phát triển, chưa phải nơi đã có sẵn việc làm, và danh sách phường/xã chỉ gồm 79 nơi mà Chấm điểm bất động sản có dữ liệu (chưa phủ hết các xã xa trung tâm). Thời gian lái xe tính bằng ô tô, đường thông thoáng, giờ cao điểm lâu hơn nhiều.',
    fewer: (n) => 'Chỉ xem ' + n + ' hướng đầu',
    more: (n) => 'Xem thêm ' + n + ' hướng khác',
    howTitle: 'Cách tính điểm phù hợp',
    how: (w) =>
      `Điểm tối đa 100: nền tảng gần với hướng nghề (${w.background}), thời gian học thêm đủ chưa (${w.training}), trình độ thường được hỏi (${w.education}), và hợp với việc làm thuê hay tự kinh doanh bạn chọn (${w.work}). Điểm không tính đến lương hay số tin tuyển, vì chưa có số liệu đủ tin cậy cho từng vị trí.`,
    levels: { high: 'Phù hợp cao', medium: 'Phù hợp vừa', low: 'Ít phù hợp' },
    plansLabel: 'Kế hoạch đã lưu',
    premiumPlans: (max) => `Lưu kế hoạch vào tài khoản, mở trên mọi thiết bị và giữ tới ${max} kế hoạch cùng lúc (Premium)`,
    planHead: (name) => `Kế hoạch 30 ngày: ${name}`,
    planSub: (started, dayText) => `Bắt đầu ${started} · ${dayText}`,
    dayOf: (day) => `ngày thứ ${day}/30`,
    over30: 'đã qua 30 ngày: xem lại và chỉnh kế hoạch nếu cần',
    tasks: (done, total) => `${done}/${total} việc`,
    progressAria: 'Tiến độ kế hoạch',
    after: 'Sau 30 ngày:',
    exportPdf: 'Xuất PDF kế hoạch',
    exportHint: 'Mở trang in của trình duyệt: chọn "Lưu dưới dạng PDF".',
    exportBlocked: 'Trình duyệt đã chặn tab mới: hãy cho phép cửa sổ bật lên rồi thử lại.',
    brandTeaser: 'In kế hoạch mang tên và liên hệ của bạn (dành cho tư vấn viên, giáo viên hướng nghiệp, trung tâm đào tạo)',
    brandHint: 'Bản PDF kế hoạch nghề nghiệp sẽ mang tên công ty, tên và liên hệ của bạn thay cho tên trang web, để bạn gửi học viên hoặc khách hàng.',
    keepNote: 'Đây là gợi ý để bạn tự theo dõi, lưu trên trình duyệt này.',
    clear: 'Xoá kế hoạch',
    emptyTitle: 'Kế hoạch 30 ngày',
    emptyText: 'Bạn chưa có kế hoạch. Chọn một hướng nghề rồi bấm "Lập kế hoạch 30 ngày cho hướng này": bạn sẽ có danh sách việc theo từng tuần để tick khi làm xong.',
    emptyButton: 'Xem hướng nghề của bạn',
    syncing: 'Đang đồng bộ với tài khoản…',
    saved: '✓ Đã lưu vào tài khoản của bạn: mở được trên mọi thiết bị.',
    planOn: '✓ Đang theo kế hoạch này',
    planExtra: '★ Lập thêm kế hoạch (Premium)',
    planStart: 'Lập kế hoạch 30 ngày cho hướng này',
    planLimit: (max) => `Bạn đang giữ ${max} kế hoạch, là mức tối đa: hãy xoá bớt một kế hoạch rồi lập kế hoạch mới.`,
    askSave: 'Lưu kế hoạch vào tài khoản',
    askMany: 'Giữ nhiều kế hoạch cùng lúc',
    askPdf: 'Xuất PDF kế hoạch nghề nghiệp',
    contextTitle: 'Bức tranh chung',
    contextNote: 'Chưa tìm thấy số liệu thất nghiệp riêng của Hà Nội: đây là số liệu cả nước.',
    marketTitle: 'Thị trường theo hướng nghề',
    marketNote: 'Mỗi hướng nghề một dòng tín hiệu từ nguồn công khai, để bạn so sánh. Đây không phải mức lương hay số vị trí đang tuyển.',
    colField: 'Hướng nghề',
    colSignal: 'Tín hiệu từ nguồn công khai',
    yours: 'gần nghề của bạn',
    supportTitle: 'Hỗ trợ và nơi tìm việc chính thống',
    policiesTitle: 'Chính sách cho người thất nghiệp',
    policiesNote: 'Tóm tắt từ Luật Việc làm 2025 (có hiệu lực từ 1/1/2026). Mức hưởng, điều kiện và thủ tục thay đổi: hãy hỏi trung tâm dịch vụ việc làm hoặc cơ quan bảo hiểm xã hội trước khi quyết định.',
    findTitle: 'Nơi tìm việc',
    findNote: 'Trang này không đăng tin tuyển dụng. Hãy dùng các kênh chính thống và cảnh giác với lời mời việc làm đòi tiền đặt cọc.',
    sourcesTitle: 'Nguồn',
    sourcesNote: (date) =>
      `Dữ liệu tổng hợp ngày ${date} từ nguồn công khai. Phần lớn là báo chí dẫn lại số liệu và kế hoạch của cơ quan nhà nước, chưa phải văn bản gốc: hãy đối chiếu trước khi dùng cho quyết định quan trọng. Đây là công cụ tham khảo, không đảm bảo việc làm hay thu nhập.`,
    sourcesLang: '',
    mapLoading: 'Đang tải bản đồ…',
  },
  en: {
    docTitle: 'Hanoi Career Compass · Hanoi Century Vista',
    language: 'Change language',
    eyebrow: 'Jobs · Career guidance',
    title: 'Hanoi Career Compass',
    lead: 'For people who are unemployed, want to change careers or have just graduated, and also for people already working who want to look at the job market. Answer 5 short questions to see the career directions that suit you, tied to how Hanoi is changing. Every figure has a source.',
    tabsLabel: 'Sections of the page',
    tabs: { paths: 'Your career paths', plan: '30-day plan', switch: 'Switching careers', market: 'Job market', map: 'Map', support: 'Support and where to look' },
    aboutYou: 'About you',
    q1: '1. What is your situation?',
    q2: '2. Your current or former job, or field of study?',
    q2Hint: 'Choose one or more',
    q3: '3. Your highest level of education?',
    q4: '4. How long do you have to learn before starting a new job?',
    q5: '5. Do you want to be an employee or run your own business?',
    q6: '6. Which ward or commune do you live in?',
    q6Hint: 'Optional: to see the distance to places of work',
    notChosen: 'Not chosen',
    wardAria: 'The ward or commune you live in',
    seeResults: 'See your career paths ↓',
    answerAll: 'Answer the first 5 questions to see the results (question 6 is optional). Your answers are kept only in this browser.',
    calcLink: 'Want to know what a change costs and when it pays back? Work it out in the Switching careers tab →',
    calcCost: 'Work out the cost of switching to this',
    redo: 'Start over',
    resultsTitle: 'Career paths suggested for you',
    resultsNote: 'Ranked by how well they fit your answers. These are suggestions to explore, not a promise of a job.',
    employedNote: 'You do not need to change jobs: use the results to compare your current work with other directions and with the market.',
    seeMap: 'See the job map by area ↓',
    details: 'How Hanoi is changing, skills and first steps',
    hanoi: 'Hanoi',
    roles: 'Common roles',
    skills: 'Skills needed',
    route: 'Suggested path',
    placesTitle: 'Where to work and where to live',
    planTag: 'Under the plan',
    landmarkTag: 'Reference point',
    from: (ward, text) => `From ${ward}: ${text}.`,
    nearestWards: 'Nearest wards and communes among the 79 with data:',
    nearKm: 'km',
    chooseWard: 'Choose the ward or commune you live in (question 6) to see the distance.',
    placesNote: 'A planned pole is a direction of development, not a place that already has the jobs, and the list of wards and communes covers only the 79 that AI Property Intelligence has data for (not yet the communes far from the centre). Driving times are by car on free-flowing roads; rush hour is much longer.',
    fewer: (n) => 'Show only the first ' + n,
    more: (n) => 'Show ' + n + ' more',
    howTitle: 'How the fit score is worked out',
    how: (w) =>
      `The score is out of 100: how close your background is to the direction (${w.background}), whether the time you have to train is enough (${w.training}), the education usually asked (${w.education}), and whether it matches being an employee or self-employed as you chose (${w.work}). It does not take pay or the number of postings into account, because there are no reliable figures for each role.`,
    levels: { high: 'Strong fit', medium: 'Moderate fit', low: 'Weak fit' },
    plansLabel: 'Saved plans',
    premiumPlans: (max) => `Save plans to your account, open them on any device and keep up to ${max} plans at once (Premium)`,
    planHead: (name) => `30-day plan: ${name}`,
    planSub: (started, dayText) => `Started ${started} · ${dayText}`,
    dayOf: (day) => `day ${day} of 30`,
    over30: 'the 30 days are over: review and adjust the plan if needed',
    tasks: (done, total) => `${done}/${total} tasks`,
    progressAria: 'Plan progress',
    after: 'After 30 days:',
    exportPdf: 'Export the plan as PDF',
    exportHint: 'Opens your browser\'s print page: choose "Save as PDF".',
    exportBlocked: 'Your browser blocked the new tab: allow pop-ups and try again.',
    brandTeaser: 'Print the plan with your own name and contact details (for advisers, career teachers and training centres)',
    brandHint: 'The PDF of the career plan will carry your company, name and contact details instead of the site\'s name, so you can send it to students or clients.',
    keepNote: 'This is guidance for you to follow yourself, kept in this browser.',
    clear: 'Delete the plan',
    emptyTitle: '30-day plan',
    emptyText: 'You have no plan yet. Choose a career path, then press "Make a 30-day plan for this path": you will get a week-by-week list of tasks to tick off.',
    emptyButton: 'See your career paths',
    syncing: 'Syncing with your account…',
    saved: '✓ Saved to your account: open it on any device.',
    planOn: '✓ Following this plan',
    planExtra: '★ Add another plan (Premium)',
    planStart: 'Make a 30-day plan for this path',
    planLimit: (max) => `You are keeping ${max} plans, the maximum: delete one before making a new plan.`,
    askSave: 'Save plans to your account',
    askMany: 'Keep several plans at once',
    askPdf: 'Export the career plan as PDF',
    contextTitle: 'The general picture',
    contextNote: 'No unemployment figures for Hanoi alone were found: these are national figures.',
    marketTitle: 'The job market by career path',
    marketNote: 'One line of signals from public sources for each path, so you can compare. These are not pay levels or numbers of open positions.',
    colField: 'Career path',
    colSignal: 'Signal from public sources',
    yours: 'close to your field',
    supportTitle: 'Support and official places to look for work',
    policiesTitle: 'Support for the unemployed',
    policiesNote: 'A summary of the Employment Law 2025 (in force from 1 January 2026). Amounts, conditions and procedures change: ask the employment service centre or the social insurance office before deciding.',
    findTitle: 'Where to look for work',
    findNote: 'This site does not post job ads. Use the official channels and be wary of job offers that ask for a deposit.',
    sourcesTitle: 'Sources',
    sourcesNote: (date) =>
      `Compiled on ${date} from public sources. Most are press reports repeating the figures and plans of State agencies, not the original documents: check them before using them for an important decision. This is a reference tool and does not guarantee a job or income.`,
    sourcesLang: 'The titles of the sources are in Vietnamese, as published.',
    mapLoading: 'Loading the map…',
  },
};

/** The words of the job map (the map of sectors, metro and where to live). */
export interface JobMapText {
  title: string;
  lead1: string;
  leadBold: string;
  lead2: string;
  layersAria: string;
  layerSector: string;
  layerMetro: string;
  layerLive: string;
  sectorAria: string;
  colourAria: string;
  metricCount: string;
  metricDensity: string;
  markersCheck: string;
  homeAria: string;
  homeLabel: string;
  notChosen: string;
  wardAria: string;
  driveIn: string;
  zoneAria: string;
  all: string;
  minutes: (n: number) => string;
  zoneTitleOn: string;
  zoneTitleOff: string;
  metroAt: string;
  metroAria: string;
  liveAria: string;
  liveHint: string;
  work1: string;
  work1Aria: string;
  work2: string;
  work2Aria: string;
  chooseWork: string;
  none: string;
  landmarks: string;
  wards: string;
  eachWork: string;
  limitAria: string;
  sortBy: string;
  sortAria: string;
  sortTime: string;
  sortPrice: string;
  zoneFrom: string;
  zoneIn: string;
  zoneDrive: string;
  zoneReach: string;
  zoneWardsOf: string;
  zoneWith: string;
  zonePlaces: string;
  zoneDensest: string;
  zoneFaded: string;
  metroWards: string;
  metroIn: string;
  metroPlan: string;
  homeLines: string;
  homeShare: string;
  homeNone: string;
  sparse: string;
  mapAria: string;
  mapError: string;
  people: string;
  deselect: string;
  fromHome: (home: string) => string;
  driveNote: string;
  places: string;
  perTenK: string;
  noSector: string;
  noSectorWard: string;
  selectedSector: string;
  metroWithin: string;
  line: (lines: string) => string;
  noneYet: string;
  thick: string;
  loading: string;
  osmCount: string;
  noSectors: string;
  imHere: string;
  hereNow: string;
  openMap: string;
  property: string;
  pickWard: string;
  pickWardHint: string;
  legend: string;
  legendNoWork: string;
  legendOutside: string;
  legendSame: string;
  legendMetro: string;
  legendMetroKm: (km: string) => string;
  legendNoMetro: string;
  legendNoData: string;
  legendOutZone: string;
  legendPole: string;
  legendMark: string;
  liveTitle: string;
  liveNone: (names: string, limit: number) => string;
  liveSome: string;
  liveTop: (n: number) => string;
  colWard: string;
  colTo: (name: string) => string;
  colLand: string;
  colLandTitle: string;
  colMetro: string;
  minutesCell: (n: number) => string;
  perM2: string;
  liveNote: (km: string) => string;
  metroTitle: string;
  colWork: string;
  metroNote: (km: string) => string;
  caveatDefault: string;
  endNote1: string;
  endNote2: string;
  endNote3: (source: string) => string;
  defaultSource: string;
  and: string;
  liveLegend: { near: string; mid: string; far: string };
  liveAsk: string;
  metroCell: { line: (lines: string) => string; transfer: string };
  horizonNow: string;
  horizonSoon: string;
  horizonPlan: string;
  none2: string;
}

export const JOBMAP_TEXT: Record<CareerLang, JobMapText> = {
  vi: {
    title: 'Bản đồ ngành nghề theo khu vực',
    lead1: 'Chọn một ngành dịch vụ để thấy phường nào có nhiều cơ sở của ngành đó trên bản đồ. Đây là dấu hiệu nơi ngành tập trung,',
    leadBold: 'không phải số vị trí đang tuyển',
    lead2: '. Chọn phường bạn ở để xem vùng đi làm và metro. Bấm vào một phường để xem những ngành đang dày quanh đó.',
    layersAria: 'Lớp bản đồ',
    layerSector: 'Ngành nghề',
    layerMetro: 'Metro',
    layerLive: 'Nơi ở theo nơi làm',
    sectorAria: 'Ngành',
    colourAria: 'Cách tô màu theo ngành',
    metricCount: 'Số cơ sở',
    metricDensity: 'Mật độ trên 10.000 dân',
    markersCheck: 'Hiện cực theo quy hoạch và điểm mốc',
    homeAria: 'Từ nhà bạn',
    homeLabel: 'Nhà bạn ở',
    notChosen: 'Chưa chọn',
    wardAria: 'Phường hoặc xã bạn đang ở',
    driveIn: 'Đi làm bằng ô tô, trong',
    zoneAria: 'Vùng đi làm bằng ô tô',
    all: 'Tất cả',
    minutes: (n) => `${n} phút`,
    zoneTitleOn: 'Lái xe, đường thông thoáng',
    zoneTitleOff: 'Chọn phường bạn ở trước',
    metroAt: 'Metro ở mốc',
    metroAria: 'Mốc thời gian của metro',
    liveAria: 'Nơi ở theo nơi làm',
    liveHint: 'Chọn nơi làm của bạn (và của người cùng ở, nếu có). Bản đồ tô các phường/xã mà từ đó đi tới mọi nơi làm trong giới hạn thời gian; càng gần càng đậm.',
    work1: 'Nơi làm 1',
    work1Aria: 'Nơi làm thứ nhất',
    work2: 'Nơi làm 2 (không bắt buộc)',
    work2Aria: 'Nơi làm thứ hai',
    chooseWork: 'Chọn nơi làm',
    none: 'Không có',
    landmarks: 'Điểm mốc',
    wards: 'Phường/xã',
    eachWork: 'Mỗi nơi làm, tối đa',
    limitAria: 'Giới hạn thời gian',
    sortBy: 'Xếp theo',
    sortAria: 'Cách xếp',
    sortTime: 'Gần nơi làm nhất',
    sortPrice: 'Giá đất thấp nhất',
    zoneFrom: 'Từ',
    zoneIn: ', trong',
    zoneDrive: 'lái xe (đường thông thoáng) đến được',
    zoneReach: 'phường/xã',
    zoneWardsOf: '',
    zoneWith: 'với',
    zonePlaces: 'cơ sở',
    zoneDensest: 'Dày nhất:',
    zoneFaded: 'Phường ngoài vùng bị làm mờ. Giờ cao điểm thường lâu hơn nhiều, nên coi đây là vùng gần nhất có thể.',
    metroWards: 'phường/xã có ga metro trong',
    metroIn: 'km',
    metroPlan: 'hoặc nằm gần hành lang tuyến theo quy hoạch (sơ đồ, chưa có vị trí ga)',
    homeLines: 'Nhà bạn đi được tuyến',
    homeShare: 'phường/xã khác nằm trên cùng tuyến.',
    homeNone: 'Nhà bạn chưa gần ga ở mốc này.',
    sparse: 'Ngành này có rất ít cơ sở trên bản đồ OpenStreetMap, nên màu sắc chưa đáng tin. Hãy xem các ngành khác hoặc khảo sát thực tế.',
    mapAria: 'Bản đồ các phường Hà Nội tô màu theo ngành đã chọn hoặc theo metro',
    mapError: 'Chưa tải được dữ liệu bản đồ. Hãy thử lại sau.',
    people: 'dân',
    deselect: 'Bỏ chọn phường',
    fromHome: (home) => `Từ ${home}`,
    driveNote: 'lái xe, đường thông thoáng',
    places: 'Cơ sở',
    perTenK: 'Trên 10.000 dân',
    noSector: 'Ngành đã chọn',
    noSectorWard: 'Chưa có dữ liệu ngành này ở phường.',
    selectedSector: 'Ngành đã chọn',
    metroWithin: 'Metro trong',
    line: (lines) => `Tuyến ${lines}`,
    noneYet: 'Chưa có',
    thick: 'Ngành đang dày quanh đây',
    loading: 'Đang tải…',
    osmCount: 'Số cơ sở trên OpenStreetMap',
    noSectors: 'Chưa có dữ liệu các ngành ở phường này.',
    imHere: 'Tôi ở phường này',
    hereNow: '✓ Phường bạn đang ở',
    openMap: 'Mở gì ở đâu →',
    property: 'Điểm bất động sản →',
    pickWard: 'Chọn một phường',
    pickWardHint: 'Bấm vào một phường trên bản đồ để xem chi tiết: số cơ sở của ngành đã chọn, những ngành đang dày quanh đó, thời gian từ nhà bạn và metro gần đó.',
    legend: 'Chú giải',
    legendNoWork: 'Chưa chọn nơi làm',
    legendOutside: 'Ngoài giới hạn thời gian',
    legendSame: 'Cùng tuyến metro với nhà bạn',
    legendMetro: 'Có metro, khác tuyến',
    legendMetroKm: (km) => `Có metro trong ${km} km`,
    legendNoMetro: 'Chưa có metro',
    legendNoData: 'Chưa có dữ liệu',
    legendOutZone: 'Ngoài vùng đi làm',
    legendPole: 'Cực theo quy hoạch',
    legendMark: 'Điểm mốc (Hồ Gươm, Cầu Giấy – Duy Tân, Nội Bài)',
    liveTitle: 'Nơi ở gợi ý',
    liveNone: (names, limit) => `Không có phường/xã nào đi tới ${names} trong ${limit} phút. Thử nới giới hạn thời gian.`,
    liveSome: 'phường/xã đi tới',
    liveTop: (n) => `Đang hiện ${n} phường/xã đứng đầu.`,
    colWard: 'Phường/xã',
    colTo: (name) => `Tới ${name}`,
    colLand: 'Giá đất NN',
    colLandTitle: 'Giá đất nhà nước, trung vị VT1, triệu đồng/m²: thường thấp hơn giá thị trường',
    colMetro: 'Metro cùng tuyến',
    minutesCell: (n) => `${n} phút`,
    perM2: 'tr/m²',
    liveNote: (km) =>
      `Thời gian là lái ô tô giữa tâm các phường/xã, đường thông thoáng; giờ cao điểm lâu hơn nhiều. Giá đất là bảng giá nhà nước 2026, chỉ là dấu hiệu thô về chi phí ở, không phải giá thuê hay giá bán. "Metro cùng tuyến" nghĩa là ga trong ${km} km quanh nhà và quanh mọi nơi làm có chung một tuyến; chưa có thời gian đi metro. Đây là gợi ý để đi xem, không thay cho khảo sát thực tế.`,
    metroTitle: 'Nhà bạn nối với nơi làm việc bằng metro không?',
    colWork: 'Nơi làm việc',
    metroNote: (km) =>
      `Chỉ cho biết nhà và nơi làm có cùng một tuyến metro trong ${km} km quanh ga hay không; dữ liệu chưa có thời gian đi hay lịch chạy. Ô "Khác tuyến" có thể vẫn đi được bằng cách đổi tuyến. Mốc quy hoạch chỉ là hành lang sơ đồ của tuyến dự kiến, chưa có vị trí ga.`,
    caveatDefault: 'OpenStreetMap do cộng đồng đóng góp và chưa ghi nhận đủ cửa hàng nhỏ.',
    endNote1: 'Số cơ sở khác số vị trí tuyển dụng: chỉ dùng để thấy ngành nào tập trung ở đâu. Cực theo quy hoạch là hướng phát triển, chưa phải nơi đã có sẵn việc làm.',
    endNote2: 'Công nghiệp, bán dẫn, logistics và xây dựng không có số cơ sở đáng tin trên bản đồ nên không tô màu; hãy xem lớp quy hoạch và mục "Nơi làm việc" của từng hướng nghề.',
    endNote3: (source) => `Thời gian đi lại tính bằng ô tô giữa tâm các phường/xã, đường thông thoáng (${source}); xe máy nhiều khi nhanh hơn, giờ cao điểm lâu hơn nhiều.`,
    defaultSource: 'OSRM trên đường OpenStreetMap',
    and: ' và ',
    liveLegend: { near: 'Gần nơi làm nhất', mid: 'Vừa', far: 'Xa hơn (vẫn trong giới hạn)' },
    liveAsk: 'Tìm nơi ở theo nơi làm',
    metroCell: { line: (lines) => `✓ tuyến ${lines}`, transfer: 'Khác tuyến' },
    horizonNow: 'Hiện nay',
    horizonSoon: '2027',
    horizonPlan: 'Theo quy hoạch',
    none2: '–',
  },
  en: {
    title: 'Job map by area',
    lead1: 'Choose a service sector to see which wards have the most places of that sector on the map. This shows where the sector is concentrated,',
    leadBold: 'not the number of open positions',
    lead2: '. Choose the ward you live in to see your commuting zone and the metro. Click a ward to see which sectors are thick around it.',
    layersAria: 'Map layers',
    layerSector: 'Sectors',
    layerMetro: 'Metro',
    layerLive: 'Where to live for work',
    sectorAria: 'Sector',
    colourAria: 'How to colour by sector',
    metricCount: 'Number of places',
    metricDensity: 'Density per 10,000 residents',
    markersCheck: 'Show planned poles and reference points',
    homeAria: 'From your home',
    homeLabel: 'Where you live',
    notChosen: 'Not chosen',
    wardAria: 'The ward or commune you live in',
    driveIn: 'Commuting by car, within',
    zoneAria: 'Commuting zone by car',
    all: 'All',
    minutes: (n) => `${n} min`,
    zoneTitleOn: 'By car, free-flowing roads',
    zoneTitleOff: 'Choose the ward you live in first',
    metroAt: 'Metro at',
    metroAria: 'Metro time horizon',
    liveAria: 'Where to live for work',
    liveHint: 'Choose your workplace (and your housemate\'s, if any). The map colours the wards and communes from which every workplace is within the time limit; the closer, the darker.',
    work1: 'Workplace 1',
    work1Aria: 'First workplace',
    work2: 'Workplace 2 (optional)',
    work2Aria: 'Second workplace',
    chooseWork: 'Choose a workplace',
    none: 'None',
    landmarks: 'Reference points',
    wards: 'Wards and communes',
    eachWork: 'To each workplace, at most',
    limitAria: 'Time limit',
    sortBy: 'Sort by',
    sortAria: 'Sort order',
    sortTime: 'Closest to work',
    sortPrice: 'Lowest land price',
    zoneFrom: 'From',
    zoneIn: ', within',
    zoneDrive: 'by car (free-flowing roads) you can reach',
    zoneReach: 'wards and communes',
    zoneWardsOf: '',
    zoneWith: 'with',
    zonePlaces: 'places:',
    zoneDensest: 'Densest:',
    zoneFaded: 'Wards outside the zone are faded. Rush hour is usually much longer, so treat this as the nearest possible zone.',
    metroWards: 'wards and communes have a metro station within',
    metroIn: 'km',
    metroPlan: 'or lie near a planned line corridor (a sketch, no station sites yet)',
    homeLines: 'From your home you can use line',
    homeShare: 'other wards and communes are on the same line.',
    homeNone: 'Your home is not near a station at this horizon.',
    sparse: 'This sector has very few places on the OpenStreetMap map, so the colours are not reliable. Look at other sectors, or check on the ground.',
    mapAria: 'Map of Hanoi wards coloured by the chosen sector or by metro',
    mapError: 'The map data could not be loaded. Please try again later.',
    people: 'residents',
    deselect: 'Deselect the ward',
    fromHome: (home) => `From ${home}`,
    driveNote: 'by car, free-flowing roads',
    places: 'Places',
    perTenK: 'Per 10,000 residents',
    noSector: 'Chosen sector',
    noSectorWard: 'No data for this sector in the ward.',
    selectedSector: 'Chosen sector',
    metroWithin: 'Metro within',
    line: (lines) => `Line ${lines}`,
    noneYet: 'None yet',
    thick: 'Sectors that are thick around here',
    loading: 'Loading…',
    osmCount: 'Number of places on OpenStreetMap',
    noSectors: 'No data for the sectors of this ward.',
    imHere: 'I live in this ward',
    hereNow: '✓ The ward you live in',
    openMap: 'Business Opportunity Map →',
    property: 'AI Property Intelligence →',
    pickWard: 'Choose a ward',
    pickWardHint: 'Click a ward on the map for details: the number of places in the chosen sector, the sectors that are thick around it, the time from your home and the metro nearby.',
    legend: 'Legend',
    legendNoWork: 'No workplace chosen',
    legendOutside: 'Outside the time limit',
    legendSame: 'On the same metro line as your home',
    legendMetro: 'Has metro, different line',
    legendMetroKm: (km) => `Has metro within ${km} km`,
    legendNoMetro: 'No metro yet',
    legendNoData: 'No data',
    legendOutZone: 'Outside the commuting zone',
    legendPole: 'Planned pole',
    legendMark: 'Reference points (Hoàn Kiếm Lake, Cầu Giấy – Duy Tân, Nội Bài)',
    liveTitle: 'Suggested places to live',
    liveNone: (names, limit) => `No ward or commune reaches ${names} within ${limit} minutes. Try widening the time limit.`,
    liveSome: 'wards and communes reach',
    liveTop: (n) => `Showing the top ${n}.`,
    colWard: 'Ward / commune',
    colTo: (name) => `To ${name}`,
    colLand: 'State land price',
    colLandTitle: 'State land price, median of VT1, million VND/m²: usually lower than the market price',
    colMetro: 'Metro on the same line',
    minutesCell: (n) => `${n} min`,
    perM2: 'M/m²',
    liveNote: (km) =>
      `Times are by car between ward centres on free-flowing roads; rush hour is much longer. The land price is the 2026 State price table, only a rough sign of the cost of living there, not a rent or a sale price. "Metro on the same line" means that stations within ${km} km of home and of every workplace share a line; there are no metro travel times. These are suggestions to go and see, not a substitute for checking on the ground.`,
    metroTitle: 'Is your home connected to the workplaces by metro?',
    colWork: 'Workplace',
    metroNote: (km) =>
      `This only says whether home and workplace have a metro line in common within ${km} km of a station; the data has no travel times or timetables. A "Different line" cell may still be reachable by changing lines. The plan horizon is only a sketch of the planned lines, with no station sites yet.`,
    caveatDefault: 'OpenStreetMap is contributed by volunteers and does not yet record every small shop.',
    endNote1: 'The number of places is not the number of job openings: use it only to see which sectors are concentrated where. A planned pole is a direction of development, not a place that already has the jobs.',
    endNote2: 'Industry, semiconductors, logistics and construction have no reliable count of places on the map, so they are not coloured; see the plan markers and the "Where to work" part of each career path.',
    endNote3: (source) => `Travel times are by car between ward centres on free-flowing roads (${source}); a motorbike is often quicker, and rush hour is much longer.`,
    defaultSource: 'OSRM on the OpenStreetMap road network',
    and: ' and ',
    liveLegend: { near: 'Closest to work', mid: 'Middle', far: 'Further (still within the limit)' },
    liveAsk: 'Find where to live for work',
    metroCell: { line: (lines) => `✓ line ${lines}`, transfer: 'Different line' },
    horizonNow: 'Today',
    horizonSoon: '2027',
    horizonPlan: 'Under the plan',
    none2: '–',
  },
};
