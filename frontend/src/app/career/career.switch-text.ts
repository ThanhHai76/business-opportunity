import { CaseId, Remark, SwitchInput } from './career.switch';
import type { CareerLang } from './career.local';

type Field = { key: keyof Omit<SwitchInput, 'name'>; label: string; hint: string; unit: string };

/** The words of the career-change calculator and of its printed page, in both languages. */
export interface SwitchText {
  tab: string;
  title: string;
  lead: string;
  notice: string;
  option: (n: number) => string;
  addOption: string;
  removeOption: string;
  optionsLabel: string;
  name: string;
  namePlaceholder: string;
  fields: Field[];
  example: string;
  exampleNote: string;
  clear: string;
  refsTitle: string;
  refsNote: string;
  refsIncome: string;
  refsTraining: string;
  refsChecked: string;
  resultsTitle: string;
  needNew: string;
  cases: Record<CaseId, string>;
  caseNote: string;
  rowNewIncome: string;
  rowSearch: string;
  rowCost: string;
  rowCostHint: string;
  rowPayback: string;
  rowNet: (months: number) => string;
  rowBuffer: string;
  rowBufferHint: string;
  bufferMonths: (n: string) => string;
  payback: (months: number | null) => string;
  month: string;
  remarks: Record<Remark, string>;
  chartTitle: string;
  chartAria: (payback: string) => string;
  compareTitle: string;
  compareNote: string;
  askMore: string;
  askPdf: string;
  exportPdf: string;
  exportHint: string;
  exportBlocked: string;
  premiumNote: string;
  // printed page
  kicker: string;
  defaultBrand: string;
  prepared: string;
  madeOn: string;
  inputsTitle: string;
  sources: string;
  footer: string;
  analysis: string;
  toolbar: string;
  toolbarHint: string;
  pageTitle: string;
  untitled: (n: number) => string;
}

const fieldsVi: Field[] = [
  { key: 'currentIncome', label: 'Thu nhập hiện tại', hint: 'Mỗi tháng. Nhập 0 nếu bạn đang không đi làm.', unit: 'triệu đồng/tháng' },
  { key: 'fees', label: 'Chi phí học', hint: 'Một lần: học phí, giáo trình, lệ phí thi, đi lại.', unit: 'triệu đồng' },
  { key: 'studyMonths', label: 'Thời gian học', hint: 'Nhập 0 nếu không phải học thêm.', unit: 'tháng' },
  { key: 'searchMonths', label: 'Thời gian tìm việc sau khi học', hint: 'Từ lúc học xong đến tháng có lương đầu tiên.', unit: 'tháng' },
  { key: 'bridgeIncome', label: 'Thu nhập trong lúc học và tìm việc', hint: 'Làm thêm, trợ cấp… Nhập 0 nếu không có.', unit: 'triệu đồng/tháng' },
  { key: 'newIncome', label: 'Thu nhập tháng đầu ở nghề mới', hint: 'Số bạn tin nhất, tham khảo mục số liệu có nguồn bên dưới.', unit: 'triệu đồng/tháng' },
  { key: 'raisePct', label: 'Tăng thu nhập sau mỗi 12 tháng', hint: 'Để 0 nếu chưa chắc.', unit: '%' },
  { key: 'expenses', label: 'Chi tiêu tối thiểu mỗi tháng', hint: 'Dùng để tính số tiền cần có để đi hết giai đoạn chuyển.', unit: 'triệu đồng/tháng' },
];

const fieldsEn: Field[] = [
  { key: 'currentIncome', label: 'Income today', hint: 'Per month. Enter 0 if you are not working.', unit: 'million VND/month' },
  { key: 'fees', label: 'Cost of the training', hint: 'Once: tuition, books, exam fees, travel.', unit: 'million VND' },
  { key: 'studyMonths', label: 'Months of training', hint: 'Enter 0 if you need no further training.', unit: 'months' },
  { key: 'searchMonths', label: 'Months looking for work after the training', hint: 'From the end of the training to the first month with pay.', unit: 'months' },
  { key: 'bridgeIncome', label: 'Income while training and looking', hint: 'A side job, an allowance… Enter 0 for none.', unit: 'million VND/month' },
  { key: 'newIncome', label: 'Income in the first month of the new work', hint: 'The figure you trust most; see the sourced figures below for reference.', unit: 'million VND/month' },
  { key: 'raisePct', label: 'Raise after every 12 months', hint: 'Leave 0 if unsure.', unit: '%' },
  { key: 'expenses', label: 'Spending you cannot cut, per month', hint: 'Used to work out the money needed to get through the change.', unit: 'million VND/month' },
];

export const SWITCH_TEXT: Record<CareerLang, SwitchText> = {
  vi: {
    tab: 'Đổi nghề',
    title: 'Bài toán đổi nghề',
    lead: 'Bạn nhập số của chính mình; công cụ cho biết chuyển nghề tốn bao nhiêu, cần có bao nhiêu tiền dự phòng và bao lâu thì hoàn vốn.',
    notice: 'Kết quả tính đúng theo các số bạn nhập, không phải dự báo thu nhập của bạn hay của một nghề. Các số nhập được lưu trên trình duyệt này, không gửi đi đâu.',
    option: (n) => `Hướng ${n}`,
    addOption: 'Thêm hướng để so sánh',
    removeOption: 'Bỏ hướng này',
    optionsLabel: 'Các hướng chuyển nghề',
    name: 'Tên hướng (không bắt buộc)',
    namePlaceholder: 'Ví dụ: học kế toán',
    fields: fieldsVi,
    example: 'Điền số ví dụ',
    exampleNote: 'Số ví dụ chỉ để xem kết quả trông thế nào, không phải số liệu thật.',
    clear: 'Xoá số đã nhập',
    refsTitle: 'Số liệu có nguồn để tham khảo',
    refsNote: 'Đây là số trung bình cả nước hoặc của một ngành, không phải lời hứa cho một người. Chưa có số liệu có nguồn về thu nhập theo từng nghề ở Hà Nội và học phí từng khóa, nên hãy hỏi trực tiếp cơ sở đào tạo và doanh nghiệp.',
    refsIncome: 'Thu nhập',
    refsTraining: 'Đào tạo và hỗ trợ',
    refsChecked: 'Tra cứu tháng 10/2026.',
    resultsTitle: 'Kết quả',
    needNew: 'Nhập thu nhập tháng đầu ở nghề mới để xem kết quả.',
    cases: { careful: 'Thận trọng', base: 'Theo số của bạn', bright: 'Thuận lợi' },
    caseNote: 'Thận trọng: thu nhập mới thấp hơn 15% và tìm việc lâu hơn 2 tháng. Thuận lợi: cao hơn 10% và tìm việc sớm hơn 1 tháng (không dưới 0). Đây chỉ là cách dịch chuyển số của bạn, không phải dự báo.',
    rowNewIncome: 'Thu nhập mới dùng để tính',
    rowSearch: 'Tháng tìm việc',
    rowCost: 'Tổng chi phí chuyển nghề',
    rowCostHint: 'Chi phí học cộng thu nhập bị mất trong lúc học và tìm việc',
    rowPayback: 'Hoàn vốn sau',
    rowNet: (m) => `Chênh lệch tích luỹ sau ${m} tháng`,
    rowBuffer: 'Số tiền cần có để đi hết giai đoạn chuyển',
    rowBufferHint: 'Chi phí học cộng phần chi tiêu mà thu nhập tạm thời không bù được',
    bufferMonths: (n) => `≈ ${n} tháng chi tiêu`,
    payback: (m) => (m === null ? 'không trong 10 năm' : m === 0 ? 'ngay từ đầu' : `${m} tháng`),
    month: 'tháng',
    remarks: {
      noGain: 'Theo số bạn nhập, thu nhập mới không cao hơn mức hiện tại nên không hoàn vốn trong 10 năm. Có thể vẫn có lý do khác để đổi nghề (ổn định hơn, yêu thích hơn); hãy xem lại các số.',
      slow: 'Hoàn vốn sau hơn 3 năm: khá lâu, hãy cân nhắc kỹ và xem lại các giả định.',
      noSpending: 'Chưa nhập chi tiêu tối thiểu nên chưa tính được số tháng chi tiêu dự phòng.',
      longBridge: 'Giai đoạn học và tìm việc từ 12 tháng trở lên: cần chuẩn bị nguồn sống cho cả thời gian này.',
    },
    chartTitle: 'Chênh lệch tích luỹ so với giữ nguyên công việc hiện tại (triệu đồng)',
    chartAria: (p) => `Đồ thị chênh lệch tích luỹ trong 60 tháng của ba trường hợp; theo số của bạn, hoàn vốn ${p}.`,
    compareTitle: 'So sánh các hướng (theo số của bạn)',
    compareNote: 'Cột "Theo số của bạn" của từng hướng.',
    askMore: 'So sánh nhiều hướng chuyển nghề',
    askPdf: 'Xuất PDF lộ trình chuyển nghề',
    exportPdf: 'Xuất PDF lộ trình chuyển nghề',
    exportHint: 'Mở trang in của trình duyệt: chọn "Lưu dưới dạng PDF".',
    exportBlocked: 'Trình duyệt đã chặn tab mới: hãy cho phép cửa sổ bật lên rồi thử lại.',
    premiumNote: 'Gói Premium: so sánh tới 3 hướng chuyển nghề và xuất PDF mang tên, liên hệ của bạn.',
    kicker: 'Lộ trình chuyển nghề',
    defaultBrand: 'Hanoi Century Vista · La bàn nghề nghiệp Hà Nội',
    prepared: 'Chuẩn bị bởi',
    madeOn: 'Lập ngày',
    inputsTitle: 'Các số đã nhập',
    sources: 'Nguồn của các số liệu tham khảo',
    footer: 'Kết quả tính theo số do người lập nhập, không phải dự báo thu nhập của một người hay một nghề và không bảo đảm có việc. Các số liệu tham khảo là trung bình cả nước hoặc theo ngành, phần lớn do báo chí dẫn lại số liệu của cơ quan nhà nước: hãy đối chiếu với văn bản gốc trước khi quyết định.',
    analysis: ' Phân tích: Hanoi Century Vista.',
    toolbar: 'Lưu PDF / In',
    toolbarHint: 'Trong hộp thoại in, chọn "Lưu dưới dạng PDF".',
    pageTitle: ' · Hanoi Century Vista',
    untitled: (n) => `Hướng ${n}`,
  },
  en: {
    tab: 'Switching careers',
    title: 'The career-change calculator',
    lead: 'You enter your own numbers; the tool shows what a change of career costs, how much money you need to get through it, and when it pays back.',
    notice: 'The result follows exactly the numbers you type: it is not a forecast of your income or of any career. The numbers are kept in this browser and sent nowhere.',
    option: (n) => `Option ${n}`,
    addOption: 'Add an option to compare',
    removeOption: 'Remove this option',
    optionsLabel: 'Career-change options',
    name: 'Name of the option (optional)',
    namePlaceholder: 'For example: train as an accountant',
    fields: fieldsEn,
    example: 'Fill in example numbers',
    exampleNote: 'The example numbers only show what a result looks like; they are not real data.',
    clear: 'Clear the numbers',
    refsTitle: 'Sourced figures for reference',
    refsNote: 'These are national or one-sector averages, not a promise to any one person. There are no sourced figures for income by career in Hà Nội or for the fees of each course, so ask the training providers and employers directly.',
    refsIncome: 'Income',
    refsTraining: 'Training and support',
    refsChecked: 'Checked in October 2026.',
    resultsTitle: 'Result',
    needNew: 'Enter the income of the first month in the new work to see the result.',
    cases: { careful: 'Cautious', base: 'Your numbers', bright: 'Favourable' },
    caseNote: 'Cautious: the new income 15% lower and the job search 2 months longer. Favourable: 10% higher and 1 month shorter (never below 0). This only shifts your numbers; it is not a forecast.',
    rowNewIncome: 'New income used',
    rowSearch: 'Months looking for work',
    rowCost: 'Total cost of the change',
    rowCostHint: 'The training cost plus the income given up while training and looking',
    rowPayback: 'Pays back after',
    rowNet: (m) => `Cumulative gain after ${m} months`,
    rowBuffer: 'Money needed to get through the change',
    rowBufferHint: 'The training cost plus the spending the temporary income does not cover',
    bufferMonths: (n) => `≈ ${n} months of spending`,
    payback: (m) => (m === null ? 'not within 10 years' : m === 0 ? 'from the start' : `${m} months`),
    month: 'months',
    remarks: {
      noGain: 'With the numbers you typed, the new income is not higher than today’s, so it does not pay back within 10 years. There may still be other reasons to change (stability, liking the work); check the numbers again.',
      slow: 'It pays back after more than 3 years: quite long, so think it over and check the assumptions again.',
      noSpending: 'No spending was typed, so the months of spending to set aside cannot be worked out.',
      longBridge: 'Training and looking for work take 12 months or more: you need a way to live through all of it.',
    },
    chartTitle: 'Cumulative gain compared with keeping today’s work (million VND)',
    chartAria: (p) => `Chart of the cumulative gain over 60 months in the three cases; with your numbers it pays back ${p}.`,
    compareTitle: 'Comparing the options (with your numbers)',
    compareNote: 'The "Your numbers" column of each option.',
    askMore: 'Compare several career-change options',
    askPdf: 'Export the career-change plan as PDF',
    exportPdf: 'Export the career-change plan as PDF',
    exportHint: 'Opens your browser\'s print page: choose "Save as PDF".',
    exportBlocked: 'Your browser blocked the new tab: allow pop-ups and try again.',
    premiumNote: 'Premium: compare up to 3 options and export a PDF with your name and contact details.',
    kicker: 'Career-change plan',
    defaultBrand: 'Hanoi Century Vista · Hanoi Career Compass',
    prepared: 'Prepared by',
    madeOn: 'Prepared on',
    inputsTitle: 'The numbers entered',
    sources: 'Sources of the reference figures',
    footer: 'The result follows the numbers typed by the person who made it. It is not a forecast of anyone’s income or of any career, and it does not guarantee a job. The reference figures are national or sector averages, mostly press reports repeating the figures of State agencies, and in Vietnamese: check them against the original documents before deciding.',
    analysis: ' Analysis: Hanoi Century Vista.',
    toolbar: 'Save PDF / Print',
    toolbarHint: 'In the print box, choose "Save as PDF".',
    pageTitle: ' · Hanoi Century Vista',
    untitled: (n) => `Option ${n}`,
  },
};
