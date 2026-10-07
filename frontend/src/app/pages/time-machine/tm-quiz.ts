/**
 * Quiz generation for Education mode, as pure functions (no DOM), so it can be unit-tested
 * (tm-quiz.spec.ts). Questions come only from the landmarks' dated events.
 */
export interface EventRef {
  /** `${landmarkKey}#${indexInItsEvents}` — stable across languages. */
  id: string;
  key: string;
  year: string;
  sort: number;
  text: string;
}

/**
 * A question is stored as structure only (which event, option years or landmark keys), so switching
 * language re-words it without changing the quiz.
 */
export interface Question {
  kind: 'year' | 'place';
  eventId: string;
  /** Years (kind 'year') or landmark keys (kind 'place'). */
  values: string[];
  answer: number;
}

/** The part of the page's data a quiz needs (TmContext provides it). */
export interface QuizData {
  keys(): string[];
  name(key: string): string;
  events(key: string): Array<{ year: string; sort: number; text: string }>;
  tours(): Array<{ id: string; stops: string[] }>;
}

/** Small seeded PRNG, so an assignment link gives every student the same questions. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffle<T>(items: T[], rng: () => number): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export const fold = (text: string): string =>
  text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase();

export const isYear = (label: string): boolean => /^\d{4}$/.test(label);

/**
 * True when the event text gives away which landmark it is about: it contains two consecutive words of the
 * name ("nhà tù", "nhà hát") or one long word of it ("prison", "opera").
 */
export function givesAway(text: string, name: string): boolean {
  const words = (s: string) => fold(s).split(/[^a-z0-9]+/).filter(Boolean);
  const t = ` ${words(text).join(' ')} `;
  const n = words(name);
  return n.some((w, i) => (i > 0 && t.includes(` ${n[i - 1]} ${w} `)) || (w.length >= 5 && t.includes(` ${w} `)));
}

/** Landmark keys of a quiz scope: 'all', 'lm:<key>' or 'tour:<id>' ([] if unknown). */
export function scopeKeys(data: QuizData, scope: string): string[] {
  if (scope === 'all') return data.keys();
  if (scope.startsWith('lm:')) return data.keys().filter((k) => k === scope.slice(3));
  if (scope.startsWith('tour:')) return data.tours().find((t) => t.id === scope.slice(5))?.stops ?? [];
  return [];
}

export function eventsOf(data: QuizData, keys: string[]): EventRef[] {
  return keys.flatMap((key) => data.events(key).map((e, i) => ({ id: `${key}#${i}`, key, ...e })));
}

export function eventById(data: QuizData, id: string): EventRef | undefined {
  const [key, i] = id.split('#');
  const e = data.events(key)[Number(i)];
  return e ? { id, key, ...e } : undefined;
}

/**
 * "In which year…?" for events with a plain year, and "Which landmark…?" for events whose text doesn't give
 * the answer away. Each event is used at most once; distractor years are the nearest other years in the
 * whole data set. The same (data, scope, count, seed) always gives the same questions.
 */
export function buildQuestions(data: QuizData, scope: string, count: number, seed: number): Question[] {
  const rng = mulberry32(seed);
  const allYears = [...new Set(eventsOf(data, data.keys()).filter((e) => isYear(e.year)).map((e) => Number(e.year)))];
  const candidates: Array<{ kind: 'year' | 'place'; event: EventRef }> = [];
  for (const event of eventsOf(data, scopeKeys(data, scope))) {
    if (isYear(event.year)) candidates.push({ kind: 'year', event });
    if (event.text.length >= 25 && !givesAway(event.text, data.name(event.key))) candidates.push({ kind: 'place', event });
  }
  const used = new Set<string>();
  const picked = shuffle(candidates, rng)
    .filter((c) => !used.has(c.event.id) && used.add(c.event.id))
    .slice(0, count);

  return picked.map(({ kind, event }) => {
    let correct: string;
    let others: string[];
    if (kind === 'year') {
      const year = Number(event.year);
      const near = allYears
        .filter((y) => y !== year)
        .sort((a, b) => Math.abs(a - year) - Math.abs(b - year))
        .slice(0, 6);
      correct = event.year;
      others = shuffle(near, rng).slice(0, 3).map(String);
    } else {
      correct = event.key;
      others = shuffle(data.keys().filter((k) => k !== event.key), rng).slice(0, 3);
    }
    const values = shuffle([correct, ...others], rng);
    return { kind, eventId: event.id, values, answer: values.indexOf(correct) };
  });
}
