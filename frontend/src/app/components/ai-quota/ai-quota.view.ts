import { AiQuota } from '../../services/billing.service';

export type QuotaLang = 'vi' | 'en';

const TEXT = {
  vi: {
    free: (left: number, per: number) => `Câu trả lời AI chuyên sâu · còn ${left}/${per} lượt miễn phí hôm nay`,
    premium: (left: number) => `Premium · còn ${left} lượt AI chuyên sâu hôm nay`,
    credit: (left: number) => `Đã dùng 1 lượt AI đã mua · còn ${left} lượt`,
    signin: (per: number) => `Đây là câu trả lời cơ bản (không dùng AI). Đăng nhập để có ${per} câu trả lời AI chuyên sâu miễn phí mỗi ngày.`,
    noQuota: 'Bạn đã dùng hết lượt AI chuyên sâu hôm nay — đây là câu trả lời cơ bản.',
    unavailable: 'AI tạm thời không khả dụng — đây là câu trả lời cơ bản, không trừ lượt.',
    signInBtn: 'Đăng nhập',
    buy: 'Mua lượt AI hoặc Premium',
    plans: 'Xem gói',
  },
  en: {
    free: (left: number, per: number) => `In-depth AI answer · ${left}/${per} free left today`,
    premium: (left: number) => `Premium · ${left} in-depth AI answers left today`,
    credit: (left: number) => `Used 1 bought AI question · ${left} left`,
    signin: (per: number) => `This is the basic answer (no AI). Sign in for ${per} free in-depth AI answers a day.`,
    noQuota: 'You have used today’s in-depth AI answers — this is the basic answer.',
    unavailable: 'The AI is unavailable right now — this is the basic answer; nothing was used.',
    signInBtn: 'Sign in',
    buy: 'Buy AI questions or Premium',
    plans: 'See plans',
  },
};

export const quotaText = (lang: QuotaLang) => TEXT[lang] ?? TEXT.vi;

export interface QuotaView {
  text: string;
  /** The answer is the basic one (not written by the AI). */
  basic: boolean;
  /** What to offer next: sign in, buy AI questions or Premium, see the plans. */
  action: 'signin' | 'buy' | 'plans' | null;
}

/**
 * What the line under a metered AI answer says: which allowance paid for it, or why the basic answer was given.
 * `null` when the server does not meter AI answers (no `quota`). The free allowance shown is the asked tool's own
 * (`toolFree…`: the Time Machine storyteller has more free answers than the other tools).
 */
export function quotaView(q: AiQuota | null | undefined, lang: QuotaLang, fallbackFreePerDay: number): QuotaView | null {
  if (!q) return null;
  const t = quotaText(lang);
  const per = q.toolFreePerDay ?? q.freePerDay ?? fallbackFreePerDay;
  if (q.charged === 'free') return { text: t.free(q.toolFreeLeft ?? q.freeLeft ?? 0, per), basic: false, action: 'plans' };
  if (q.charged === 'premium') return { text: t.premium(q.premiumLeft ?? 0), basic: false, action: null };
  if (q.charged === 'credit') return { text: t.credit(q.aiCredits ?? 0), basic: false, action: 'plans' };
  if (q.reason === 'signin') return { text: t.signin(per), basic: true, action: 'signin' };
  if (q.reason === 'no_quota') return { text: t.noQuota, basic: true, action: 'buy' };
  if (q.reason === 'unavailable') return { text: t.unavailable, basic: true, action: null };
  return null;
}
