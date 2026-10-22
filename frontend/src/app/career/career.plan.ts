import { AREAS_OF, CHANNELS, DIRECTIONS, Direction } from './career.data';
import { EDU_LABEL, EMPTY_PROFILE, Profile, TRAIN_LABEL } from './career.logic';

export type Phase = 'w1' | 'w2' | 'w34';

export const PHASES: { id: Phase; title: string; hint: string }[] = [
  { id: 'w1', title: 'Tuần 1 · Chuẩn bị', hint: 'Hồ sơ, tài khoản, và bước đầu tiên của hướng bạn chọn' },
  { id: 'w2', title: 'Tuần 2 · Học và thử', hint: 'Học nền tảng, xem nơi làm việc' },
  { id: 'w34', title: 'Tuần 3–4 · Hành động', hint: 'Ứng tuyển hoặc thử kinh doanh nhỏ, rồi nhìn lại' },
];

export interface PlanLink {
  label: string;
  /** An address on this site. */
  path?: string;
  /** An outside address. */
  href?: string;
}

export interface PlanItem {
  id: string;
  phase: Phase;
  text: string;
  links?: PlanLink[];
  /** Source ids the text relies on (listed at the end of the page). */
  sources?: string[];
}

/** The plan the visitor chose: a direction, when it was started and what they ticked off. Kept in this browser. */
export interface PlanState {
  directionId: string;
  startedAt: string;
  done: string[];
  /** When it last changed (the newer copy wins when this browser and the account differ). */
  updatedAt?: string;
}

const PORTALS: PlanLink[] = CHANNELS.map((c) => ({ label: c.name, href: c.url }));

/**
 * The 30-day checklist for a direction: the same few steps for everyone (CV, official accounts, support), then the
 * direction's own steps, then applying (or testing a small business). It is advice for the visitor to follow, not data.
 */
export function buildPlan(p: Profile, d: Direction): PlanItem[] {
  const graduate = p.situation === 'graduate';
  // Someone in work is looking around, not necessarily leaving: the plan keeps the job and compares.
  const working = p.situation === 'employed';
  const self = d.workType === 'self' || (d.workType === 'both' && p.work === 'self');
  const items: PlanItem[] = [
    {
      id: 'cv',
      phase: 'w1',
      text: graduate
        ? 'Viết CV một trang: học vấn, dự án, thực tập và kỹ năng nổi bật.'
        : working
          ? 'Cập nhật CV một trang với thành tích gần đây, để sẵn sàng khi có cơ hội tốt.'
          : `Cập nhật CV một trang: kinh nghiệm, kết quả cụ thể và kỹ năng, viết theo hướng "${d.name}".`,
    },
    { id: 'accounts', phase: 'w1', text: 'Tạo hồ sơ trên Sàn giao dịch việc làm quốc gia và Cổng việc làm Hà Nội.', links: PORTALS, sources: ['nhandan-san-qg', 'vneconomy-cong-hn'] },
    {
      id: 'support',
      phase: 'w1',
      text: graduate
        ? 'Hỏi trung tâm dịch vụ việc làm về tư vấn và giới thiệu việc làm.'
        : working
          ? 'Tìm hiểu trước quyền lợi bảo hiểm thất nghiệp của bạn (điều kiện, mức hưởng, thủ tục) để biết khi cân nhắc đổi việc.'
          : 'Nếu bạn đã đóng bảo hiểm thất nghiệp: hỏi trung tâm dịch vụ việc làm hoặc cơ quan bảo hiểm xã hội về điều kiện, hồ sơ, thời hạn hưởng trợ cấp và hỗ trợ đào tạo.',
      sources: ['luat-viec-lam', 'lsvn-bhtn'],
    },
    ...(working ? [{ id: 'keep', phase: 'w1' as const, text: 'Giữ việc hiện tại trong lúc tìm hiểu: dành vài giờ mỗi tuần để học hoặc thử, chưa cần vội nghỉ việc.' }] : []),
    { id: 'first', phase: 'w1', text: d.steps[0].text },
    { id: 'learn', phase: 'w2', text: d.steps[1].text },
  ];

  if (p.time !== null && d.training > p.time) {
    items.push({ id: 'time', phase: 'w2', text: `Hướng này thường cần chuẩn bị ${TRAIN_LABEL[d.training]}, dài hơn thời gian bạn có: tìm việc tạm hoặc bán thời gian trong lúc học.` });
  }
  if (p.education !== null && d.minEducation > p.education) {
    items.push({ id: 'edu', phase: 'w2', text: `Hướng này thường hỏi trình độ ${EDU_LABEL[d.minEducation]}: tìm khoá nghề hoặc chứng chỉ có thể thay thế, và hỏi người đang làm trong ngành.` });
  }
  if ((AREAS_OF[d.id] ?? []).length) {
    items.push({ id: 'where', phase: 'w2', text: 'Xem phần "Nơi làm việc" của hướng này: khu vực nào, cách nơi bạn ở bao xa.' });
  }

  if (self) {
    items.push(
      { id: 'calc', phase: 'w34', text: 'Tính thử lãi lỗ bằng máy tính khả thi của Mở gì ở đâu, với số của chính bạn.', links: [{ label: 'Mở gì ở đâu', path: '/opportunity-map' }] },
      { id: 'scout', phase: 'w34', text: 'Khảo sát thực địa vài phường có điểm cơ hội cao và hỏi giá thuê thật.' },
    );
  } else {
    items.push(
      {
        id: 'apply',
        phase: 'w34',
        text: working
          ? 'Nếu quyết định đổi việc, ứng tuyển đều mỗi tuần (ví dụ 3–5 vị trí) qua kênh chính thống; nếu chưa, so sánh đãi ngộ và cơ hội phát triển hiện tại với thị trường.'
          : 'Ứng tuyển đều mỗi tuần (ví dụ 3–5 vị trí) qua kênh chính thống và ghi lại kết quả.',
      },
      { id: 'contact', phase: 'w34', text: 'Nhắn hỏi người quen hoặc đồng nghiệp cũ trong ngành về cơ hội.' },
    );
  }
  items.push({ id: 'review', phase: 'w34', text: 'Cuối tháng: xem lại việc đã làm được và chỉnh hướng nếu cần (có thể làm lại bảng hỏi ở đầu trang).' });
  return items;
}

/** What comes after the 30 days: the last step of the direction's path. */
export function afterThirtyDays(d: Direction): string {
  return d.steps[d.steps.length - 1].text;
}

export const startPlan = (directionId: string, now: Date = new Date()): PlanState => ({ directionId, startedAt: now.toISOString(), done: [], updatedAt: now.toISOString() });

export function toggleItem(plan: PlanState, id: string, now: Date = new Date()): PlanState {
  return { ...plan, done: plan.done.includes(id) ? plan.done.filter((x) => x !== id) : [...plan.done, id], updatedAt: now.toISOString() };
}

/** The steps a direction's plan can have for any visitor (some only appear for some answers). */
export function knownItemIds(directionId: string): PlanItem[] {
  const d = DIRECTIONS.find((x) => x.id === directionId);
  if (!d) return [];
  const variants: Profile[] = [
    { ...EMPTY_PROFILE, situation: 'employed', education: 0, time: 0, work: 'employee' },
    { ...EMPTY_PROFILE, situation: 'graduate', education: 2, time: 2, work: 'self' },
  ];
  return variants.flatMap((p) => buildPlan(p, d));
}

/** A stored plan, or null when it is not one (an unknown direction, a damaged value). Ticks of items that no longer exist are dropped. */
export function parsePlan(raw: unknown, items: (directionId: string) => PlanItem[] = knownItemIds): PlanState | null {
  const x = raw as Partial<PlanState> | null;
  if (!x || typeof x.directionId !== 'string' || !DIRECTIONS.some((d) => d.id === x.directionId)) return null;
  if (typeof x.startedAt !== 'string' || Number.isNaN(Date.parse(x.startedAt))) return null;
  const known = new Set(items(x.directionId).map((i) => i.id));
  const done = (Array.isArray(x.done) ? x.done : []).filter((id): id is string => typeof id === 'string' && (known.size === 0 || known.has(id)));
  const updatedAt = typeof x.updatedAt === 'string' && !Number.isNaN(Date.parse(x.updatedAt)) ? x.updatedAt : undefined;
  return { directionId: x.directionId, startedAt: x.startedAt, done: [...new Set(done)], ...(updatedAt ? { updatedAt } : {}) };
}

/** When a plan last changed. */
export const changedAt = (p: PlanState): number => Date.parse(p.updatedAt ?? p.startedAt);

/** Plans from storage: only real ones, one per direction (the newest), newest first. */
export function parsePlans(raw: unknown): PlanState[] {
  const byDirection = new Map<string, PlanState>();
  for (const item of Array.isArray(raw) ? raw : []) {
    const plan = parsePlan(item);
    const seen = plan ? byDirection.get(plan.directionId) : undefined;
    if (plan && (!seen || changedAt(plan) > changedAt(seen))) byDirection.set(plan.directionId, plan);
  }
  return [...byDirection.values()].sort((a, b) => changedAt(b) - changedAt(a));
}

/** Which day of the 30 it is (1–30), or null once the 30 days are over. */
export function dayOf(plan: PlanState, now: Date = new Date()): number | null {
  const day = Math.floor((now.getTime() - Date.parse(plan.startedAt)) / 86_400_000) + 1;
  return day >= 1 && day <= 30 ? day : null;
}
