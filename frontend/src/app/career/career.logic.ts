import { Background, DIRECTIONS, Direction, Education, Situation, TrainTime, WorkType } from './career.data';
import { EN_BACKGROUNDS, EN_EDU, EN_TRAIN } from './career.en';
import type { CareerLang } from './career.local';

/** What the visitor says about themself (every answer is needed before directions are ranked). */
export interface Profile {
  situation: Situation | null;
  backgrounds: Background[];
  education: Education | null;
  time: TrainTime | null;
  work: WorkType | null;
  /** The ward or commune they live in (optional): only used to show distances to the places of work. */
  ward: string | null;
}

export const EMPTY_PROFILE: Profile = { situation: null, backgrounds: [], education: null, time: null, work: null, ward: null };

/** Whether anything was answered (an untouched profile is not worth keeping). */
export function hasAnswers(p: Profile): boolean {
  return p.situation !== null || p.backgrounds.length > 0 || p.education !== null || p.time !== null || p.work !== null || p.ward !== null;
}

const SITUATION_VALUES = ['unemployed', 'switching', 'graduate', 'employed'];
const WORK_VALUES = ['employee', 'self', 'either'];
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** A profile from storage or from the server: every field checked, anything unknown dropped. */
export function parseProfile(raw: unknown): Profile {
  const x = (raw ?? {}) as Partial<Record<keyof Profile, unknown>>;
  const level = (v: unknown): 0 | 1 | 2 | null => (v === 0 || v === 1 || v === 2 ? v : null);
  return {
    situation: SITUATION_VALUES.includes(x.situation as string) ? (x.situation as Profile['situation']) : null,
    backgrounds: (Array.isArray(x.backgrounds) ? x.backgrounds : []).filter((b): b is Background => typeof b === 'string' && b in BACKGROUND_LABEL),
    education: level(x.education),
    time: level(x.time),
    work: WORK_VALUES.includes(x.work as string) ? (x.work as Profile['work']) : null,
    ward: typeof x.ward === 'string' && x.ward.length <= 80 && SLUG.test(x.ward) ? x.ward : null,
  };
}

export function isComplete(p: Profile): boolean {
  return p.situation !== null && p.backgrounds.length > 0 && p.education !== null && p.time !== null && p.work !== null;
}

export type Level = 'high' | 'medium' | 'low';

export interface Ranked {
  direction: Direction;
  score: number;
  level: Level;
  /** Why it fits (or why not), from the answers. */
  reasons: string[];
  cautions: string[];
}

/** The weights of the score (they add up to 100), shown on the page so the ranking can be checked. */
export const WEIGHTS = { background: 40, training: 25, education: 20, work: 15 } as const;

export const TRAIN_LABEL: Record<TrainTime, string> = { 0: 'bắt đầu ngay', 1: 'vài tháng', 2: 'một năm trở lên' };
export const EDU_LABEL: Record<Education, string> = { 0: 'phổ thông', 1: 'trung cấp, cao đẳng', 2: 'đại học trở lên' };
export const BACKGROUND_LABEL: Record<Background, string> = {
  tech: 'công nghệ, điện – điện tử',
  engineering: 'kỹ thuật, cơ khí, xây dựng',
  sales: 'bán hàng, chăm sóc khách hàng',
  logistics: 'kho, vận tải, giao nhận',
  service: 'nhà hàng, khách sạn, du lịch',
  finance: 'kế toán, tài chính, ngân hàng',
  other: 'lĩnh vực khác',
};

export const trainLabel = (t: TrainTime, lang: CareerLang = 'vi'): string => (lang === 'en' ? EN_TRAIN[t] : TRAIN_LABEL[t]);
export const eduLabel = (e: Education, lang: CareerLang = 'vi'): string => (lang === 'en' ? EN_EDU[e] : EDU_LABEL[e]);
export const backgroundLabel = (b: Background, lang: CareerLang = 'vi'): string => (lang === 'en' ? EN_BACKGROUNDS[b] : BACKGROUND_LABEL[b]);

/** What the ranking says about a direction, in both languages. */
const RANK_TEXT = {
  vi: {
    close: (b: string) => `Gần với nền tảng của bạn (${b}).`,
    cross: 'Có thể chuyển sang từ nền tảng của bạn, cần học thêm.',
    far: 'Khác xa nền tảng của bạn: sẽ phải học gần như từ đầu.',
    now: 'Có thể bắt đầu ngay, không cần đào tạo dài.',
    enough: (t: string) => `Thời gian chuẩn bị bạn chọn (${t}) đủ để học nền tảng.`,
    short: (t: string) => `Thường cần chuẩn bị ${t}, dài hơn thời gian bạn có.`,
    edu: (e: string) => `Thường được hỏi trình độ ${e}; có thể bổ sung bằng khoá nghề.`,
    isSelf: 'Đây là hướng tự kinh doanh, bạn muốn làm thuê.',
    isEmployee: 'Đây chủ yếu là việc làm thuê, bạn muốn tự kinh doanh.',
  },
  en: {
    close: (b: string) => `Close to your background (${b}).`,
    cross: 'You could move across from your background, with some extra learning.',
    far: 'Far from your background: you would be learning almost from scratch.',
    now: 'You can start right away, with no long training.',
    enough: (t: string) => `The preparation time you chose (${t}) is enough to learn the basics.`,
    short: (t: string) => `Usually needs ${t} of preparation, longer than the time you have.`,
    edu: (e: string) => `Usually asks for ${e} education; a vocational course can make up for it.`,
    isSelf: 'This is a self-employment direction, and you want to be an employee.',
    isEmployee: 'This is mostly employment, and you want to be self-employed.',
  },
} as const;

/**
 * Ranks the directions for a profile. Transparent on purpose: how close the background is (40), whether the time
 * to train is enough (25), whether the education usually asked is reached (20), and whether it matches
 * employee / self-employed (15). With several backgrounds the closest one counts.
 */
export function rankDirections(p: Profile, directions: Direction[] = DIRECTIONS, lang: CareerLang = 'vi'): Ranked[] {
  if (!isComplete(p)) return [];
  const x = RANK_TEXT[lang];
  const education = p.education as Education;
  const time = p.time as TrainTime;
  const work = p.work as WorkType;
  return directions
    .map((d) => {
      const reasons: string[] = [];
      const cautions: string[] = [];

      const best = Math.max(...p.backgrounds.map((b) => d.fit[b])) as 0 | 1 | 2 | 3;
      const background = (WEIGHTS.background * best) / 3;
      if (best >= 2) {
        const from = p.backgrounds.find((b) => d.fit[b] === best) as Background;
        reasons.push(x.close(backgroundLabel(from, lang)));
      } else if (best === 1) reasons.push(x.cross);
      else cautions.push(x.far);

      const short = Math.max(0, d.training - time);
      const training = WEIGHTS.training - (WEIGHTS.training / 2) * short;
      if (d.training === 0) reasons.push(x.now);
      else if (short === 0) reasons.push(x.enough(trainLabel(time, lang)));
      else cautions.push(x.short(trainLabel(d.training, lang)));

      const gap = Math.max(0, d.minEducation - education);
      const edu = Math.max(0, WEIGHTS.education - (WEIGHTS.education / 2) * gap);
      if (gap > 0) cautions.push(x.edu(eduLabel(d.minEducation, lang)));

      const fitsWork = work === 'either' || d.workType === 'both' || d.workType === work;
      const workScore = fitsWork ? WEIGHTS.work : WEIGHTS.work * 0.2;
      if (!fitsWork) cautions.push(d.workType === 'self' ? x.isSelf : x.isEmployee);

      const score = Math.round(background + training + edu + workScore);
      const level: Level = score >= 70 ? 'high' : score >= 50 ? 'medium' : 'low';
      return { direction: d, score, level, reasons, cautions };
    })
    .sort(
      (a, b) =>
        b.score - a.score ||
        // On a tie, the one that is exactly what they want (employee or self-employed) comes first.
        Number(b.direction.workType === work) - Number(a.direction.workType === work) ||
        a.direction.name.localeCompare(b.direction.name, 'vi'),
    );
}
