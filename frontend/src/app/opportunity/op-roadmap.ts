import { Assumptions, computeFeasibility } from './op-feasibility';
import { Lang } from './op.models';

/**
 * Roadmap for opening a shop: seven steps, the same for every business type except the licence step, which says what
 * that type needs. Times and fees are indicative ranges (rules and fees change; the page says so and dates the text).
 * The Premium layer turns the steps into numbers for the user's own plan: costs from the feasibility calculator,
 * a calendar from a start date, and the cash to have before opening.
 */
export const ROADMAP_UPDATED = '2026-10';

export type StepId = 'lease' | 'register' | 'tax' | 'permit' | 'fire' | 'fitout' | 'launch';

type Text = Record<Lang, string>;
type Range = [number, number];

interface StepDef {
  id: StepId;
  /** Steps that must be done before this one starts. */
  after: StepId[];
  title: Text;
  body: Text;
  link?: { label: Text; url: string };
}

const STEPS: StepDef[] = [
  {
    id: 'lease',
    after: [],
    title: { vi: 'Chốt mặt bằng và hợp đồng thuê', en: 'Secure the premises and the lease' },
    body: {
      vi: 'Xem mặt bằng vào giờ đông và giờ vắng. Hợp đồng thuê cần ghi rõ thời hạn, giá, tăng giá theo năm, tiền cọc, và chủ nhà cho phép đặt địa chỉ kinh doanh. Nhờ người am hiểu đọc hợp đồng trước khi đặt cọc.',
      en: 'Visit at busy and quiet hours. The lease should state the term, the rent, yearly increases and the deposit, and let you register the address as your business address. Have someone who knows leases read it before you pay a deposit.',
    },
  },
  {
    id: 'register',
    after: ['lease'],
    title: { vi: 'Đăng ký kinh doanh', en: 'Register the business' },
    body: {
      vi: 'Hộ kinh doanh đăng ký ở bộ phận một cửa của UBND phường/xã nơi đặt địa điểm (hoặc trực tuyến); thời hạn xử lý theo luật khoảng 3 ngày làm việc. Muốn xuất hóa đơn cho doanh nghiệp hay có nhiều đối tác thì cân nhắc lập công ty. Ghi đúng ngành nghề, vì giấy phép chuyên ngành dựa vào đó.',
      en: 'A household business registers at the one-stop desk of the ward People’s Committee where the shop is (or online); the legal time limit is about 3 working days. Consider a company if you invoice businesses or have partners. List the right trade, because later permits depend on it.',
    },
    link: { label: { vi: 'Cổng dịch vụ công quốc gia', en: 'National public service portal' }, url: 'https://dichvucong.gov.vn' },
  },
  {
    id: 'tax',
    after: ['register'],
    title: { vi: 'Thuế, tài khoản ngân hàng và hóa đơn', en: 'Tax, bank account and invoices' },
    body: {
      vi: 'Từ 1/1/2026 hộ kinh doanh chuyển từ thuế khoán sang kê khai theo doanh thu thực tế, và thông báo số tài khoản ngân hàng dùng cho kinh doanh. Hóa đơn điện tử bắt buộc từ một mức doanh thu nhất định. Ngưỡng miễn thuế và ngưỡng hóa đơn đã đổi nhiều lần, hãy xem văn bản mới nhất.',
      en: 'From 1 January 2026 household businesses move from flat-rate tax to declaring actual revenue, and tell the tax office the bank account used for the business. E-invoices are compulsory above a revenue level. The tax-free and invoice thresholds have changed several times: check the latest text.',
    },
    link: { label: { vi: 'Thuế điện tử', en: 'Tax portal' }, url: 'https://thuedientu.gdt.gov.vn' },
  },
  {
    id: 'permit',
    after: ['register'],
    title: { vi: 'Giấy phép theo ngành', en: 'Trade-specific permits' },
    body: { vi: '', en: '' },
  },
  {
    id: 'fire',
    after: ['lease'],
    title: { vi: 'Phòng cháy chữa cháy và an toàn', en: 'Fire safety' },
    body: {
      vi: 'Hỏi UBND phường hoặc cơ quan PCCC khu vực xem địa điểm có thuộc diện phải thẩm duyệt hay kiểm tra PCCC không. Dù không thuộc diện, vẫn nên có bình chữa cháy, lối thoát nạn thông thoáng, đi dây điện an toàn và bảng nội quy.',
      en: 'Ask the ward office or the local fire department whether the place needs a fire-safety review or inspection. Even if not, have extinguishers, clear exits, safe wiring and posted rules.',
    },
  },
  {
    id: 'fitout',
    after: ['lease'],
    title: { vi: 'Thi công, thiết bị và tuyển người', en: 'Fit-out, equipment and hiring' },
    body: {
      vi: 'Chốt bản vẽ và dự toán trước khi thi công, đặt thiết bị dài ngày chờ sớm. Tuyển và đào tạo nhân viên trước ngày mở; ký hợp đồng lao động và đăng ký bảo hiểm xã hội theo quy định.',
      en: 'Fix the drawings and the budget before building, and order long-lead equipment early. Hire and train staff before opening; sign work contracts and register social insurance as required.',
    },
  },
  {
    id: 'launch',
    after: ['tax', 'permit', 'fire', 'fitout'],
    title: { vi: 'Biển hiệu, mở thử và khai trương', en: 'Signage, soft opening and launch' },
    body: {
      vi: 'Làm biển hiệu đúng quy định của địa phương, mở thử vài ngày để sửa lỗi vận hành, rồi mới khai trương. Giữ chương trình khuyến mãi vừa phải, vì tháng đầu doanh thu thường thấp hơn mức ổn định.',
      en: 'Put up signage as local rules allow, run a few days of soft opening to fix operations, then launch. Keep promotions modest: month one is usually below steady sales.',
    },
  },
];

interface PermitDef {
  text: Text;
  days: Range;
  cost: Range;
  link?: { label: Text; url: string };
}

const PERMITS: Record<string, PermitDef> = {
  cafe: {
    text: {
      vi: 'Quán cà phê, đồ uống: điều kiện an toàn thực phẩm (giấy chứng nhận hoặc thủ tục tương ứng với quy mô, hỏi cơ quan y tế hay phường), khám sức khỏe và xác nhận tập huấn kiến thức an toàn thực phẩm cho người pha chế.',
      en: 'Cafés and drinks: food-safety conditions (a certificate or the procedure that fits your size: ask the health office or the ward), plus health checks and food-safety training for staff who handle food.',
    },
    days: [10, 30],
    cost: [1_000_000, 5_000_000],
  },
  fnb: {
    text: {
      vi: 'Nhà hàng, quán ăn: giấy chứng nhận cơ sở đủ điều kiện an toàn thực phẩm, khám sức khỏe và tập huấn cho người chế biến, hợp đồng thu gom rác và xử lý nước thải dầu mỡ. Bán rượu bia, mở nhạc, có giờ khuya cần xin thêm.',
      en: 'Restaurants: a food-safety certificate, health checks and training for kitchen staff, waste collection and grease-water handling. Selling alcohol, playing music or opening late needs extra approval.',
    },
    days: [15, 40],
    cost: [2_000_000, 8_000_000],
  },
  convenience: {
    text: {
      vi: 'Cửa hàng tiện lợi: an toàn thực phẩm nếu bán thực phẩm; rượu và thuốc lá cần giấy phép bán lẻ riêng; hàng tươi sống cần nguồn gốc và kiểm dịch.',
      en: 'Convenience stores: food safety if you sell food; alcohol and tobacco need their own retail licences; fresh goods need proof of origin and inspection.',
    },
    days: [10, 30],
    cost: [1_000_000, 6_000_000],
  },
  pharmacy: {
    text: {
      vi: 'Nhà thuốc: chứng chỉ hành nghề dược của người phụ trách chuyên môn và giấy chứng nhận đủ điều kiện kinh doanh dược (thực hành tốt GPP). Đây là ngành điều kiện nặng nhất trong danh sách, nên bắt đầu sớm nhất có thể.',
      en: 'Pharmacies: a pharmacist’s practising certificate for the person in charge and a certificate of eligibility to trade (Good Pharmacy Practice). The heaviest conditions on the list: start as early as you can.',
    },
    days: [30, 90],
    cost: [5_000_000, 30_000_000],
  },
  education: {
    text: {
      vi: 'Trung tâm dạy học: đăng ký hoạt động theo loại hình (kỹ năng, ngoại ngữ, dạy thêm) với cơ quan giáo dục, điều kiện về giáo viên, diện tích và an toàn cho học sinh.',
      en: 'Learning centres: register the activity with the education authority by type (skills, languages, tutoring), with conditions on teachers, floor area and pupil safety.',
    },
    days: [30, 90],
    cost: [2_000_000, 15_000_000],
  },
  gym: {
    text: {
      vi: 'Phòng tập: điều kiện kinh doanh dịch vụ thể thao (cơ sở vật chất, huấn luyện viên có chứng nhận, sơ cứu, bảo hiểm), thông báo với cơ quan quản lý thể thao.',
      en: 'Gyms: conditions for sports services (facilities, certified trainers, first aid, insurance) and a notice to the sports authority.',
    },
    days: [15, 45],
    cost: [2_000_000, 10_000_000],
  },
  beauty: {
    text: {
      vi: 'Làm đẹp: cắt tóc, nail, spa không xâm lấn chủ yếu cần đăng ký kinh doanh và điều kiện vệ sinh. Dịch vụ có xâm lấn (tiêm, phun xăm sâu, laser) cần giấy phép y tế và người hành nghề có chứng chỉ.',
      en: 'Beauty: hair, nails and non-invasive spa mostly need registration and hygiene conditions. Invasive services (injections, deep tattooing, lasers) need a medical licence and certified practitioners.',
    },
    days: [7, 30],
    cost: [500_000, 5_000_000],
  },
  petshop: {
    text: {
      vi: 'Cửa hàng thú cưng: nguồn gốc và tiêm phòng vật nuôi, kiểm dịch khi cần; bán thuốc thú y cần chứng chỉ riêng.',
      en: 'Pet shops: proof of origin and vaccination for animals, inspection when needed; selling veterinary medicine needs its own certificate.',
    },
    days: [7, 30],
    cost: [500_000, 5_000_000],
  },
  realestate: {
    text: {
      vi: 'Môi giới bất động sản: điều kiện theo Luật Kinh doanh bất động sản về pháp nhân và nhân sự. Hộ kinh doanh có thể không đủ điều kiện, hãy hỏi trước khi chọn hình thức.',
      en: 'Real-estate brokerage: conditions under the Real Estate Business Law on the legal entity and staff. A household business may not qualify, so ask before you choose the form.',
    },
    days: [15, 60],
    cost: [2_000_000, 20_000_000],
  },
  laundry: {
    text: {
      vi: 'Giặt là: nước thải và hóa chất, cam kết hoặc đăng ký môi trường theo quy mô; điện, nước và PCCC cho máy sấy.',
      en: 'Laundries: waste water and chemicals (an environmental commitment or registration by size), plus power, water and fire safety for dryers.',
    },
    days: [7, 30],
    cost: [500_000, 5_000_000],
  },
  bookstore: {
    text: {
      vi: 'Nhà sách: văn phòng phẩm thông thường chỉ cần đăng ký kinh doanh; kinh doanh xuất bản phẩm phải đáp ứng điều kiện của ngành xuất bản.',
      en: 'Bookshops: ordinary stationery needs only registration; selling publications must meet the publishing sector’s conditions.',
    },
    days: [7, 30],
    cost: [0, 3_000_000],
  },
  carwash: {
    text: {
      vi: 'Rửa xe: nước thải và dầu mỡ (cam kết bảo vệ môi trường, đấu nối thoát nước), xin phép nếu dùng vỉa hè hoặc lòng đường.',
      en: 'Car washes: waste water and oil (an environmental commitment, a drain connection) and permission if you use the pavement or road.',
    },
    days: [10, 40],
    cost: [1_000_000, 10_000_000],
  },
};

const FALLBACK_PERMIT: PermitDef = {
  text: {
    vi: 'Hỏi bộ phận một cửa của phường xem ngành này có điều kiện kinh doanh hoặc giấy phép chuyên ngành nào không.',
    en: 'Ask the ward’s one-stop desk whether this trade has operating conditions or a sector licence.',
  },
  days: [7, 30],
  cost: [500_000, 5_000_000],
};

const FIRE_DAYS: Range = [3, 20];
const FIRE_COST: Range = [2_000_000, 10_000_000];
const REGISTER_DAYS: Range = [3, 10];
const TAX_DAYS: Range = [3, 10];
const LEASE_DAYS: Range = [14, 45];
const LAUNCH_DAYS: Range = [7, 14];
/** Months of fixed costs (rent, staff, utilities) to hold in cash after opening. */
export const RUNWAY_MONTHS = 3;

export interface RoadmapStepView {
  id: StepId;
  title: string;
  body: string;
  link: { label: string; url: string } | null;
  /** Calendar days the step takes, and when it can start and finish counted from the start date (earliest and latest). */
  days: Range;
  start: Range;
  end: Range;
  /** Cash the step needs (VND), a range. */
  cost: Range;
  /** What the cost is made of, shown beside it. */
  costNote: string;
}

export interface RoadmapView {
  steps: RoadmapStepView[];
  /** Days from the start date to the launch: earliest and latest. */
  total: Range;
  /** Cash before opening (the sum of the steps), and the runway after it. */
  cash: Range;
  runway: number;
  /** The user's budget minus the cash before opening and the runway (negative: short), for the lower and upper estimate. */
  gap: Range;
  budget: number;
}

/** The step's licence text for a business type (also the fallback for a type the list does not know). */
export const permitText = (type: string, lang: Lang): string => (PERMITS[type] ?? FALLBACK_PERMIT).text[lang];

const costNote = (id: StepId, lang: Lang): string => {
  const vi: Record<StepId, string> = {
    lease: 'Tiền cọc theo số tháng trong bảng giả định',
    register: 'Lệ phí đăng ký nhỏ, tính trong giấy phép',
    tax: 'Chủ yếu là công sức, có thể thuê kế toán',
    permit: 'Lệ phí, khám sức khỏe, tập huấn, hồ sơ',
    fire: 'Bình chữa cháy, biển báo, đi dây điện',
    fitout: 'Diện tích × chi phí fit-out trong bảng giả định',
    launch: 'Một tháng chi phí marketing và khác',
  };
  const en: Record<StepId, string> = {
    lease: 'Deposit: the months set in your assumptions',
    register: 'A small registration fee, counted in the permits',
    tax: 'Mostly effort; you may hire an accountant',
    permit: 'Fees, health checks, training, paperwork',
    fire: 'Extinguishers, signs, wiring',
    fitout: 'Area × the fit-out cost in your assumptions',
    launch: 'One month of marketing and other costs',
  };
  return (lang === 'en' ? en : vi)[id];
};

/** The roadmap for a business type under the user's assumptions (already adjusted for the ward when the plan does so). */
export function buildRoadmap(type: string, a: Assumptions, lang: Lang): RoadmapView {
  const permit = PERMITS[type] ?? FALLBACK_PERMIT;
  const f = computeFeasibility(a);
  const rent = a.rentPerM2 * a.sizeM2;
  const deposit = rent * a.depositMonths;
  const fitout = a.setupPerM2 * a.sizeM2;
  const launch = Math.round((f.revenue * a.otherPct) / 100);
  const fitDays: Range = [Math.round(15 + a.sizeM2 * 0.2), Math.round(30 + a.sizeM2 * 0.6)];

  const days: Record<StepId, Range> = { lease: LEASE_DAYS, register: REGISTER_DAYS, tax: TAX_DAYS, permit: permit.days, fire: FIRE_DAYS, fitout: fitDays, launch: LAUNCH_DAYS };
  const cost: Record<StepId, Range> = {
    lease: [deposit, deposit],
    register: [0, 0],
    tax: [0, 0],
    permit: permit.cost,
    fire: FIRE_COST,
    fitout: [fitout, fitout],
    launch: [launch, launch],
  };

  const done = new Map<StepId, { start: Range; end: Range }>();
  const steps = STEPS.map((def): RoadmapStepView => {
    const start: Range = [Math.max(0, ...def.after.map((id) => done.get(id)!.end[0])), Math.max(0, ...def.after.map((id) => done.get(id)!.end[1]))];
    const end: Range = [start[0] + days[def.id][0], start[1] + days[def.id][1]];
    done.set(def.id, { start, end });
    return {
      id: def.id,
      title: def.title[lang],
      body: def.id === 'permit' ? permit.text[lang] : def.body[lang],
      link: def.id === 'permit' ? null : def.link ? { label: def.link.label[lang], url: def.link.url } : null,
      days: days[def.id],
      start,
      end,
      cost: cost[def.id],
      costNote: costNote(def.id, lang),
    };
  });

  const total: Range = [Math.max(...steps.map((s) => s.end[0])), Math.max(...steps.map((s) => s.end[1]))];
  const cash: Range = [steps.reduce((s, x) => s + x.cost[0], 0), steps.reduce((s, x) => s + x.cost[1], 0)];
  const runway = (f.costs.rent + f.costs.staff + f.costs.utilities) * RUNWAY_MONTHS;
  return { steps, total, cash, runway, gap: [a.budget - cash[1] - runway, a.budget - cash[0] - runway], budget: a.budget };
}

/** Plain-text checklist (for copying or saving), in the page's language. */
export function checklistText(view: RoadmapView, ctx: { title: string; start: Date; lang: Lang; money: (v: number) => string; done: ReadonlySet<StepId> }): string {
  const day = (offset: number) => new Date(ctx.start.getTime() + offset * 86_400_000).toLocaleDateString(ctx.lang === 'en' ? 'en-GB' : 'vi-VN');
  const range = (r: Range) => (r[0] === r[1] ? ctx.money(r[0]) : `${ctx.money(r[0])} – ${ctx.money(r[1])}`);
  const lines = [ctx.title, ''];
  view.steps.forEach((s, i) => {
    lines.push(`${ctx.done.has(s.id) ? '[x]' : '[ ]'} ${i + 1}. ${s.title}`);
    lines.push(`    ${day(s.end[0])} – ${day(s.end[1])} · ${range(s.cost)}`);
  });
  lines.push('', `${ctx.lang === 'en' ? 'Launch' : 'Khai trương'}: ${day(view.total[0])} – ${day(view.total[1])}`);
  lines.push(`${ctx.lang === 'en' ? 'Cash before opening' : 'Tiền cần trước khi mở'}: ${range(view.cash)}`);
  lines.push(`${ctx.lang === 'en' ? 'Working capital' : 'Vốn lưu động'} (${RUNWAY_MONTHS}): ${ctx.money(view.runway)}`);
  lines.push('', ctx.lang === 'en' ? `Indicative, as of ${ROADMAP_UPDATED}. Confirm rules and fees with the authorities.` : `Tham khảo, cập nhật ${ROADMAP_UPDATED}. Hãy xác nhận quy định và lệ phí với cơ quan có thẩm quyền.`);
  return lines.join('\n');
}
