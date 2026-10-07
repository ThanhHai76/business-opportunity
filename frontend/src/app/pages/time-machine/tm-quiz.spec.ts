import { LANDMARK_EVENTS } from './landmark-info';
import { TOURS } from './landmark-tours';
import { LANDMARKS } from './tm-data';
import { EN_EVENTS, EN_LANDMARKS } from './tm-i18n';
import { QuizData, buildQuestions, eventById, givesAway, mulberry32, scopeKeys, shuffle } from './tm-quiz';

/** The page's real data, in either language. */
function realData(lang: 'vi' | 'en'): QuizData {
  return {
    keys: () => Object.keys(LANDMARKS),
    name: (key) => (lang === 'en' ? EN_LANDMARKS[key].name : LANDMARKS[key].name),
    events: (key) =>
      (LANDMARK_EVENTS[key] ?? []).map((e, i) => {
        const en = lang === 'en' ? EN_EVENTS[key]?.[i] : undefined;
        return en ? { ...e, year: en.year ?? e.year, text: en.text } : e;
      }),
    tours: () => TOURS,
  };
}

describe('Time Machine quiz generation', () => {
  it('mulberry32 is deterministic and in [0, 1)', () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    const seq = Array.from({ length: 50 }, () => a());
    expect(Array.from({ length: 50 }, () => b())).toEqual(seq);
    expect(seq.every((x) => x >= 0 && x < 1)).toBeTrue();
  });

  it('shuffle keeps every item and does not mutate its input', () => {
    const items = [1, 2, 3, 4, 5, 6];
    const out = shuffle(items, mulberry32(7));
    expect(items).toEqual([1, 2, 3, 4, 5, 6]);
    expect([...out].sort()).toEqual(items);
  });

  it('spots names that give the answer away, with or without diacritics', () => {
    expect(givesAway('Người Pháp xây nhà tù trung ương', 'Nhà tù Hỏa Lò')).toBeTrue();
    expect(givesAway('The French build the central prison', 'Hoa Lo Prison')).toBeTrue();
    expect(givesAway('Khởi công theo mẫu Nhà hát Opéra Garnier', 'Nhà Hát Lớn')).toBeTrue();
    expect(givesAway('Khánh thành dịp Giáng sinh', 'Nhà thờ Lớn Hà Nội')).toBeFalse();
  });

  it('resolves scopes', () => {
    const data = realData('vi');
    expect(scopeKeys(data, 'all').length).toBe(13);
    expect(scopeKeys(data, 'lm:hoa-lo')).toEqual(['hoa-lo']);
    expect(scopeKeys(data, 'tour:french-quarter')).toEqual(['hoan-kiem', 'nha-tho-lon', 'hoa-lo', 'opera-house']);
    expect(scopeKeys(data, 'nonsense')).toEqual([]);
  });

  for (const lang of ['vi', 'en'] as const) {
    describe(`with the real data (${lang})`, () => {
      const data = realData(lang);

      it('gives the same quiz for the same seed, and a different one for another seed', () => {
        expect(buildQuestions(data, 'all', 10, 123)).toEqual(buildQuestions(data, 'all', 10, 123));
        expect(buildQuestions(data, 'all', 10, 123)).not.toEqual(buildQuestions(data, 'all', 10, 124));
      });

      it('builds well-formed questions for every scope and many seeds', () => {
        const scopes = ['all', ...TOURS.map((t) => `tour:${t.id}`), ...Object.keys(LANDMARKS).map((k) => `lm:${k}`)];
        for (const scope of scopes) {
          for (let seed = 1; seed <= 25; seed++) {
            const questions = buildQuestions(data, scope, 10, seed);
            expect(questions.length).toBeGreaterThan(0);
            expect(questions.length).toBeLessThanOrEqual(10);
            expect(new Set(questions.map((q) => q.eventId)).size).withContext('each event once').toBe(questions.length);
            for (const q of questions) {
              const event = eventById(data, q.eventId)!;
              expect(event).withContext(q.eventId).toBeDefined();
              expect(scopeKeys(data, scope)).toContain(event.key);
              expect(q.values.length).toBe(4);
              expect(new Set(q.values).size).withContext('distinct options').toBe(4);
              expect(q.values[q.answer]).toBe(q.kind === 'year' ? event.year : event.key);
              if (q.kind === 'place') expect(givesAway(event.text, data.name(event.key))).withContext(event.text).toBeFalse();
              if (q.kind === 'year') expect(q.values.every((v) => /^\d{4}$/.test(v))).toBeTrue();
            }
          }
        }
      });
    });
  }
});
