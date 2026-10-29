/**
 * The career-change calculator ("Bài toán đổi nghề"): what changing career costs, and when it pays back, from the
 * numbers the person types in. Nothing here is a forecast of anyone's income: there are no per-career figures in it,
 * because none with a source exists for Hà Nội. The only figures that come with a source are the reference points
 * shown beside the boxes (SWITCH_REFERENCES), each saying its scope.
 *
 * All money is in millions of đồng (per month, or once for the fees); months are whole months.
 */

export interface SwitchInput {
  /** What the person calls this option ("Học kế toán", "Lái xe công nghệ"…). */
  name: string;
  /** Income per month today (0 when not working). */
  currentIncome: number;
  /** Once: tuition, books, exams, travel for the training. */
  fees: number;
  studyMonths: number;
  /** Months between the end of the training and the first pay in the new work. */
  searchMonths: number;
  /** Income per month while studying and looking for work (a side job, an allowance; 0 for none). */
  bridgeIncome: number;
  /** Income per month in the first month of the new work. */
  newIncome: number;
  /** Raise, in percent, at every 12 months of the new work. */
  raisePct: number;
  /** Spending that cannot be cut, per month. */
  expenses: number;
}

export type CaseId = 'careful' | 'base' | 'bright';
export const CASE_IDS: readonly CaseId[] = ['careful', 'base', 'bright'];

/** The two other cases are the person's numbers moved by a fixed amount (shown on the page), not a forecast. */
export const CASES: Record<CaseId, { incomeFactor: number; searchShift: number }> = {
  careful: { incomeFactor: 0.85, searchShift: 2 },
  base: { incomeFactor: 1, searchShift: 0 },
  bright: { incomeFactor: 1.1, searchShift: -1 },
};

/** Months looked at: a payback later than this is reported as "not within 10 years". */
export const HORIZON = 120;
/** Months drawn on the curve and reported as the gain after 12, 24, 36 and 60 months. */
export const CURVE_MONTHS = 60;
export const NET_AT = [12, 24, 36, 60] as const;

export interface CaseResult {
  id: CaseId;
  /** The first-month income and the months of job search this case used. */
  newIncome: number;
  searchMonths: number;
  /** Tuition and the income given up during the training and the search. */
  totalCost: number;
  /** The month from which the total gain stays at zero or more; null when it does not within HORIZON. */
  paybackMonths: number | null;
  /** Total gain (income above today's, minus the costs) after 12 / 24 / 36 / 60 months. */
  net: Record<(typeof NET_AT)[number], number>;
  /** Money needed to get through the change: fees plus the spending the bridge income does not cover. */
  buffer: number;
  /** The same, in months of spending (null when no spending was given). */
  bufferMonths: number | null;
  /** The total gain at month 0..CURVE_MONTHS, for the chart. */
  curve: number[];
}

export const EMPTY_INPUT: SwitchInput = {
  name: '',
  currentIncome: 0,
  fees: 0,
  studyMonths: 3,
  searchMonths: 2,
  bridgeIncome: 0,
  newIncome: 0,
  raisePct: 0,
  expenses: 0,
};

/** An example to look at the result (clearly not data): 3 months of training, then 2 months looking for work. */
export const EXAMPLE_INPUT: SwitchInput = {
  name: '',
  currentIncome: 10,
  fees: 6,
  studyMonths: 3,
  searchMonths: 2,
  bridgeIncome: 2,
  newIncome: 15,
  raisePct: 5,
  expenses: 8,
};

const clamp = (value: unknown, min: number, max: number, whole = false): number => {
  const n = typeof value === 'number' && Number.isFinite(value) ? value : 0;
  const bounded = Math.min(max, Math.max(min, n));
  return whole ? Math.round(bounded) : Math.round(bounded * 100) / 100;
};

/** Keeps every number inside what makes sense (nothing negative, months whole), whatever was typed or stored. */
export function sanitize(input: Partial<SwitchInput> | null | undefined): SwitchInput {
  const i = input ?? {};
  return {
    name: typeof i.name === 'string' ? i.name.slice(0, 60) : '',
    currentIncome: clamp(i.currentIncome, 0, 10_000),
    fees: clamp(i.fees, 0, 100_000),
    studyMonths: clamp(i.studyMonths, 0, 60, true),
    searchMonths: clamp(i.searchMonths, 0, 36, true),
    bridgeIncome: clamp(i.bridgeIncome, 0, 10_000),
    newIncome: clamp(i.newIncome, 0, 10_000),
    raisePct: clamp(i.raisePct, 0, 50),
    expenses: clamp(i.expenses, 0, 10_000),
  };
}

/** Whether there is enough to calculate (the income of the new work). */
export const isComplete = (input: SwitchInput): boolean => input.newIncome > 0;

function caseResult(id: CaseId, input: SwitchInput): CaseResult {
  const shape = CASES[id];
  const newIncome = Math.round(input.newIncome * shape.incomeFactor * 100) / 100;
  const searchMonths = Math.max(0, input.searchMonths + shape.searchShift);
  const bridgeMonths = input.studyMonths + searchMonths;
  const incomeIn = (month: number): number => {
    if (month <= bridgeMonths) return input.bridgeIncome;
    const worked = month - bridgeMonths;
    return newIncome * Math.pow(1 + input.raisePct / 100, Math.floor((worked - 1) / 12));
  };

  // Total gain at the end of each month: income above today's, minus the fees paid at the start.
  const gain: number[] = [-input.fees];
  for (let m = 1; m <= HORIZON; m++) gain.push(gain[m - 1] + incomeIn(m) - input.currentIncome);

  let lastBelow = -1;
  for (let m = 0; m <= HORIZON; m++) if (gain[m] < 0) lastBelow = m;
  const paybackMonths = lastBelow < 0 ? 0 : lastBelow >= HORIZON ? null : lastBelow + 1;

  let lost = 0;
  let uncovered = 0;
  for (let m = 1; m <= bridgeMonths; m++) {
    lost += Math.max(0, input.currentIncome - input.bridgeIncome);
    uncovered += Math.max(0, input.expenses - input.bridgeIncome);
  }
  const r2 = (n: number): number => Math.round(n * 100) / 100;
  const buffer = r2(input.fees + uncovered);
  return {
    id,
    newIncome,
    searchMonths,
    totalCost: r2(input.fees + lost),
    paybackMonths,
    net: { 12: r2(gain[12]), 24: r2(gain[24]), 36: r2(gain[36]), 60: r2(gain[60]) },
    buffer,
    bufferMonths: input.expenses > 0 ? Math.round((buffer / input.expenses) * 10) / 10 : null,
    curve: gain.slice(0, CURVE_MONTHS + 1).map(r2),
  };
}

/** The three cases of one option. */
export function compute(input: SwitchInput): Record<CaseId, CaseResult> {
  const clean = sanitize(input);
  return { careful: caseResult('careful', clean), base: caseResult('base', clean), bright: caseResult('bright', clean) };
}

export type Remark = 'noGain' | 'slow' | 'noSpending' | 'longBridge';

/** What to say beside the result, from the base case. */
export function remarks(input: SwitchInput, base: CaseResult): Remark[] {
  const out: Remark[] = [];
  if (base.paybackMonths === null) out.push('noGain');
  else if (base.paybackMonths > 36) out.push('slow');
  if (input.expenses <= 0) out.push('noSpending');
  if (input.studyMonths + input.searchMonths >= 12) out.push('longBridge');
  return out;
}

// ---------------------------------------------------------------- what is kept in the browser
export const MAX_OPTIONS = 3;
const KEY = 'hcv.career.switch.v1';

export function loadOptions(): SwitchInput[] {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? 'null') as unknown;
    if (Array.isArray(raw) && raw.length) return raw.slice(0, MAX_OPTIONS).map((x) => sanitize(x as Partial<SwitchInput>));
  } catch {
    /* no storage, or something else stored there: start empty */
  }
  return [{ ...EMPTY_INPUT }];
}

export function saveOptions(options: SwitchInput[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(options.slice(0, MAX_OPTIONS).map(sanitize)));
  } catch {
    /* private mode: the numbers simply are not kept */
  }
}

// ---------------------------------------------------------------- reference points with a source
export interface ReferenceSource {
  vi: string;
  en: string;
  publisher: string;
  url: string;
}

export interface Reference {
  id: string;
  /** Which box it helps with. */
  field: 'income' | 'training';
  vi: string;
  en: string;
  sources: ReferenceSource[];
}

const NSO_2025: ReferenceSource = {
  vi: 'Thông cáo báo chí về tình hình dân số, lao động, việc làm quý IV và năm 2025',
  en: 'Press release on population, labour and employment, Q4 and the whole of 2025',
  publisher: 'Cục Thống kê',
  url: 'https://www.nso.gov.vn/tin-tuc-thong-ke/2026/01/thong-cao-bao-chi-ve-tinh-hinh-dan-so-lao-dong-viec-lam-quy-iv-va-nam-2025/',
};

/** The figures found with a source (checked 10/2026). They are national, or about one sector: none is a promise for a person. */
export const SWITCH_REFERENCES: Reference[] = [
  {
    id: 'avg2025',
    field: 'income',
    vi: 'Thu nhập bình quân của người lao động cả nước năm 2025: khoảng 8,4 triệu đồng/tháng (Bộ Nội vụ ghi 8,31 triệu); khu vực thành thị khoảng 10,1 triệu.',
    en: 'Average income of workers nationwide in 2025: about VND 8.4 million a month (the Ministry of Home Affairs gives 8.31 million); about 10.1 million in urban areas.',
    sources: [
      NSO_2025,
      {
        vi: 'Thu nhập bình quân của lao động năm 2025 là 8,4 triệu đồng/tháng, tăng 8,9% so với năm trước',
        en: 'Average income of workers in 2025 is VND 8.4 million a month, up 8.9% on the year before',
        publisher: 'Vietstock (theo Cục Thống kê)',
        url: 'https://vietstock.vn/2026/01/thu-nhap-binh-quan-cua-lao-dong-nam-2025-la-84-trieu-dongthang-tang-89-so-voi-nam-truoc-4265-1388020.htm',
      },
    ],
  },
  {
    id: 'sectors2025q1',
    field: 'income',
    vi: 'Theo ngành, quý I/2025, cả nước: tài chính, ngân hàng, bảo hiểm 13,9 triệu; bán buôn, bán lẻ 9,4 triệu; chế biến, chế tạo 9,1 triệu; khu vực dịch vụ 9,9 triệu đồng/tháng.',
    en: 'By sector, Q1 2025, nationwide: finance, banking and insurance 13.9 million; wholesale and retail 9.4 million; manufacturing 9.1 million; the services sector 9.9 million a month.',
    sources: [
      {
        vi: 'Quý I/2025, thu nhập bình quân của người lao động tăng ở hầu hết các ngành kinh tế',
        en: 'Q1 2025: the average income of workers rose in almost every sector',
        publisher: 'VnEconomy',
        url: 'https://vneconomy.vn/quy-1-2025-thu-nhap-binh-quan-cua-nguoi-lao-dong-tang-o-hau-het-cac-nganh-kinh-te.htm',
      },
    ],
  },
  {
    id: 'semiconductor',
    field: 'income',
    vi: 'Kỹ thuật viên bán dẫn ở Hà Nội: thu nhập phổ biến 15–25 triệu đồng/tháng, tuỳ vị trí và kinh nghiệm (Trung tâm Dịch vụ việc làm Hà Nội, qua báo chí).',
    en: 'Semiconductor technicians in Hà Nội: usually VND 15–25 million a month, depending on the post and experience (Hà Nội Employment Service Centre, via the press).',
    sources: [
      {
        vi: 'Hà Nội cần khoảng 50.000 lao động chất lượng cao (dự báo quý II/2026)',
        en: 'Hà Nội needs about 50,000 high-quality workers (forecast for Q2 2026)',
        publisher: 'VnEconomy',
        url: 'https://vneconomy.vn/ha-noi-dang-thieu-khoang-50000-lao-dong-chat-luong-cao.htm',
      },
    ],
  },
  {
    id: 'plan69',
    field: 'training',
    vi: 'Hà Nội dự kiến đào tạo nghề trình độ sơ cấp và dưới 3 tháng cho hơn 17.000 lao động năm 2026 (Kế hoạch 69/KH-UBND ngày 25/2/2026), ưu tiên một số nhóm như lao động nông thôn, phụ nữ, người khuyết tật. Mức hỗ trợ học phí: hỏi cơ sở đào tạo và trung tâm dịch vụ việc làm.',
    en: 'Hà Nội plans to train more than 17,000 workers in elementary courses and courses under 3 months in 2026 (Plan 69/KH-UBND of 25 Feb 2026), with priority for groups such as rural workers, women and people with disabilities. How much of the fee is supported: ask the training provider and the employment service centre.',
    sources: [
      {
        vi: 'Hà Nội đào tạo nghề cho hơn 17.000 lao động trình độ sơ cấp, dưới 3 tháng',
        en: 'Hà Nội trains more than 17,000 workers in elementary courses and courses under 3 months',
        publisher: 'Tạp chí Công Thương',
        url: 'https://tapchicongthuong.vn/ha-noi-dao-tao-nghe-cho-hon-17-000-lao-dong-trinh-do-so-cap--duoi-3-thang-460720.htm',
      },
    ],
  },
  {
    id: 'draft100',
    field: 'training',
    vi: 'Chỉ là dự thảo, chưa phải quy định: hỗ trợ 100% học phí cho người học các ngành nghề trọng điểm trình độ trung cấp và cao đẳng, giai đoạn 2026–2031. Không dùng làm số chắc chắn.',
    en: 'A draft only, not yet a rule: supporting 100% of the fees for those who study priority trades at intermediate and college level, 2026–2031. Do not count on it.',
    sources: [
      {
        vi: 'Hà Nội dự kiến hỗ trợ 100% học phí cho người học các ngành nghề trọng điểm',
        en: 'Hà Nội plans to support 100% of the fees for priority trades',
        publisher: 'Báo Đại biểu Nhân dân',
        url: 'https://daibieunhandan.vn/ha-noi-du-kien-ho-tro-100-hoc-phi-cho-nguoi-hoc-cac-nganh-nghe-trong-diem-10417628.html',
      },
    ],
  },
];
