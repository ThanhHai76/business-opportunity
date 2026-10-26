import { AREAS, CHANNELS, CONTEXT, DIRECTIONS, POLICIES, SIGNALS, SOURCES } from './career.data';
import { EN_AREAS, EN_CHANNELS, EN_CONTEXT, EN_DIRECTIONS, EN_POLICIES, EN_SIGNALS } from './career.en';
import { labelsIn } from './career.labels';
import { areasIn, channelsIn, contextIn, directionsIn, initialCareerLang, policiesIn, signalsIn, sourceKindIn, sourceTitleIn } from './career.local';
import { EMPTY_PROFILE, Profile, rankDirections } from './career.logic';
import { buildPlan, phasesIn } from './career.plan';
import { commuteText } from './career.geo';
import { planPrintHtml } from './career.print';
import { legend } from './career.jobmap';
import { metroHorizonsIn } from './career.reach';
import { CAREER_TEXT, JOBMAP_TEXT } from './career.ui';

/** Letters that only Vietnamese uses: English text must have none, apart from the proper names below. */
const VIETNAMESE = /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i;
const NAMES = [
  'Hòa Lạc', 'Hoàn Kiếm', 'Cầu Giấy', 'Duy Tân', 'Nội Bài', 'Đông Anh', 'Mê Linh', 'Sóc Sơn', 'Gia Lâm', 'Long Biên', 'Hải Phòng', 'Thường Tín', 'Phú Xuyên',
  'Xuân Mai', 'Chương Mỹ', 'Sơn Tây', 'Ba Vì', 'Sàn giao dịch việc làm quốc gia', 'Cổng việc làm thành phố Hà Nội', 'Việt Nam',
  // English has these loanwords with their accents.
  'café', 'Café',
];
const plain = (text: string): string => NAMES.reduce((t, n) => t.split(n).join(''), text);
const strings = (value: unknown): string[] =>
  typeof value === 'string' ? [value] : Array.isArray(value) ? value.flatMap(strings) : value && typeof value === 'object' ? Object.values(value).flatMap(strings) : [];
const noVietnamese = (value: unknown): string[] => strings(value).filter((t) => VIETNAMESE.test(plain(t)));

const profile = (p: Partial<Profile>): Profile => ({ ...EMPTY_PROFILE, situation: 'unemployed', backgrounds: ['tech'], education: 1, time: 1, work: 'employee', ...p });

describe('Career compass in English: the content', () => {
  it('has every direction, with the same number of facts, roles, skills, steps and tool links as the Vietnamese one', () => {
    expect(Object.keys(EN_DIRECTIONS).sort()).toEqual(DIRECTIONS.map((d) => d.id).sort());
    for (const d of DIRECTIONS) {
      const en = EN_DIRECTIONS[d.id];
      expect(en.facts.length).withContext(d.id + ' facts').toBe(d.facts.length);
      expect(en.roles.length).withContext(d.id + ' roles').toBe(d.roles.length);
      expect(en.skills.length).withContext(d.id + ' skills').toBe(d.skills.length);
      expect(en.steps.length).withContext(d.id + ' steps').toBe(d.steps.length);
      expect(en.tools.length).withContext(d.id + ' tools').toBe(d.tools.length);
    }
  });

  it('keeps the figures, the citations and the links of the data when it speaks English', () => {
    const en = directionsIn('en');
    en.forEach((d, i) => {
      expect(d.facts.map((f) => f.sources)).toEqual(DIRECTIONS[i].facts.map((f) => f.sources));
      expect(d.tools.map((t) => t.path)).toEqual(DIRECTIONS[i].tools.map((t) => t.path));
      expect(d.fit).toEqual(DIRECTIONS[i].fit);
    });
    // Every percentage and number in a Vietnamese fact is also in the English one (single digits are months in dates: 1/2026 is January 2026).
    const numbers = (t: string) => (t.match(/\d[\d.,]*%?/g) ?? []).map((n) => n.replace(/[.,]/g, '')).filter((n) => n.length > 1 && n !== '2026').sort();
    DIRECTIONS.forEach((d, i) => d.facts.forEach((f, j) => expect(numbers(en[i].facts[j].text)).withContext(d.id + ' fact ' + j).toEqual(numbers(f.text))));
  });

  it('translates the general picture, the signals, the policies, the channels and the places in full', () => {
    expect(EN_CONTEXT.length).toBe(CONTEXT.length);
    expect(EN_POLICIES.length).toBe(POLICIES.length);
    expect(EN_CHANNELS.length).toBe(CHANNELS.length);
    expect(Object.keys(EN_SIGNALS).sort()).toEqual(Object.keys(SIGNALS).sort());
    expect(Object.keys(EN_AREAS).sort()).toEqual(Object.keys(AREAS).sort());
    // The sources and addresses stay those of the Vietnamese data.
    expect(contextIn('en').map((c) => c.sources)).toEqual(CONTEXT.map((c) => c.sources));
    expect(policiesIn('en').map((p) => p.sources)).toEqual(POLICIES.map((p) => p.sources));
    expect(channelsIn('en').map((c) => c.url)).toEqual(CHANNELS.map((c) => c.url));
    expect(Object.values(signalsIn('en')).map((s) => s.sources)).toEqual(Object.values(SIGNALS).map((s) => s.sources));
    expect(Object.values(areasIn('en')).map((a) => [a.id, a.center, a.sources])).toEqual(Object.values(AREAS).map((a) => [a.id, a.center, a.sources]));
  });

  it('has no Vietnamese words left in the English content (proper names aside)', () => {
    expect(noVietnamese([EN_DIRECTIONS, EN_CONTEXT, EN_SIGNALS, EN_POLICIES, EN_AREAS])).toEqual([]);
    expect(noVietnamese(channelsIn('en').map((c) => c.text))).toEqual([]);
    expect(noVietnamese(labelsIn('en'))).toEqual([]);
    expect(noVietnamese(phasesIn('en'))).toEqual([]);
  });

  it('says the same law in both languages: the cap, the 10 working days and the 6 months of training', () => {
    const en = policiesIn('en').map((p) => p.text).join(' ');
    expect(en).toContain('5 times the regional minimum wage');
    expect(en).toContain('10 working days');
    expect(en).toContain('11th working day');
    expect(en).toContain('6 months');
  });

  it('keeps the titles of the sources in Vietnamese, apart from the one that describes a method', () => {
    const titles = SOURCES.map((s) => sourceTitleIn(s, 'en'));
    expect(titles.filter((t, i) => t !== SOURCES[i].title).length).toBe(1);
    expect(sourceTitleIn(SOURCES.find((s) => s.id === 'nso-q2-2026')!, 'en')).toBe(SOURCES.find((s) => s.id === 'nso-q2-2026')!.title);
    expect(sourceKindIn('official', 'en')).toBe('official document or statistic');
    expect(sourceKindIn('press', 'vi')).toBe('báo chí đưa tin');
  });
});

describe('Career compass in English: ranking, plan and print', () => {
  it('ranks the same directions in the same order, with reasons in English', () => {
    const p = profile({ situation: 'graduate', backgrounds: ['tech'], education: 1, time: 0, work: 'employee' });
    const vi = rankDirections(p);
    const en = rankDirections(p, directionsIn('en'), 'en');
    expect(en.map((r) => [r.direction.id, r.score])).toEqual(vi.map((r) => [r.direction.id, r.score]));
    expect(noVietnamese(en.map((r) => [r.reasons, r.cautions]))).toEqual([]);
    expect(en.flatMap((r) => r.reasons).join(' ')).toMatch(/Close to your background \(technology, electrical–electronics\)/);
    const self = rankDirections(profile({ backgrounds: ['service'], work: 'employee' }), directionsIn('en'), 'en').find((r) => r.direction.id === 'self')!;
    expect(self.cautions.join(' ')).toContain('self-employment');
  });

  it('builds a 30-day plan with the same steps (and the same ids, so ticks carry over) in English', () => {
    for (const d of DIRECTIONS) {
      for (const situation of ['unemployed', 'graduate', 'employed'] as const) {
        for (const work of ['employee', 'self'] as const) {
          const p = profile({ situation, work, education: 0, time: 0 });
          const vi = buildPlan(p, d);
          const en = buildPlan(p, directionsIn('en').find((x) => x.id === d.id)!, 'en');
          expect(en.map((i) => [i.id, i.phase])).toEqual(vi.map((i) => [i.id, i.phase]));
          expect(noVietnamese(en.map((i) => [i.text, (i.links ?? []).map((l) => l.label)]))).withContext(d.id).toEqual([]);
        }
      }
    }
  });

  it('prints the plan in English: its headings, dates, places and the Vietnamese titles of the sources', () => {
    const d = directionsIn('en').find((x) => x.id === 'semiconductor')!;
    const p = profile({ situation: 'graduate', education: 2, time: 2 });
    const html = planPrintHtml({
      lang: 'en',
      direction: d,
      items: buildPlan(p, d, 'en'),
      done: new Set(['cv']),
      profile: p,
      ranked: rankDirections(p, directionsIn('en'), 'en').find((r) => r.direction.id === 'semiconductor') ?? null,
      places: [{ name: 'Western pole: Hòa Lạc', kind: 'plan', note: 'Plan: a science and technology city.', commute: commuteText({ kind: 'line', km: 30.4 }, 'en'), near: 'Xã Thạch Thất (3 km)', sources: ['qd2512-poles'] }],
      wardName: 'Phường Cầu Giấy',
      startedAt: '2026-10-01T00:00:00.000Z',
      generatedAt: new Date('2026-10-22T00:00:00.000Z'),
      brand: null,
    });
    expect(html).toContain('<html lang="en">');
    for (const text of ['Career plan: High technology and semiconductors', 'About you', 'Why this direction', 'How Hanoi is changing', '30-day plan', 'Official places to look for work', 'Save PDF / Print', 'Week 1 · Prepare', 'Fit: ', 'under the plan', 'From Phường Cầu Giấy: about 30.4 km in a straight line']) {
      expect(html).withContext(text).toContain(text);
    }
    // The sources keep their Vietnamese titles; nothing else on the page is in Vietnamese except names.
    expect(html).toContain('Quy hoạch Hà Nội 100 năm');
    const body = html.slice(html.indexOf('<div class="page">'), html.indexOf('<h2>Sources</h2>'));
    expect(noVietnamese(body.replace(/<[^>]+>/g, ' ').split('\n').filter((l) => !/Phường|Xã/.test(l)))).toEqual([]);
    expect(html).not.toContain('Kế hoạch 30 ngày');
  });

  it('writes distances, the map legend and the metro horizons in English', () => {
    expect(commuteText({ kind: 'drive', minutes: 23, km: 12.5 }, 'en')).toBe('about 23 minutes by car (12.5 km, traffic not included)');
    expect(commuteText({ kind: 'drive', minutes: 23, km: 12.5 })).toContain('phút lái xe');
    expect(legend([5, 20], 0, 'en').at(-1)?.label).toBe('20 or more');
    expect(legend([5, 20]).at(-1)?.label).toBe('20 trở lên');
    expect(metroHorizonsIn('en').map((h) => h.label)).toEqual(['Today', '2027', 'Under the plan']);
    expect(metroHorizonsIn('vi').map((h) => h.label)).toEqual(['Hiện nay', '2027', 'Theo quy hoạch']);
  });

  it('reads the language from the address, then from the browser, else Vietnamese', () => {
    expect(['vi', 'en']).toContain(initialCareerLang());
  });
});

describe('Career compass in English: the page and the job map text', () => {
  const shape = (value: unknown): unknown =>
    typeof value === 'function' ? 'fn' : value && typeof value === 'object' ? Object.fromEntries(Object.entries(value).map(([k, v]) => [k, shape(v)])) : typeof value;

  it('has the same words in both languages, and no Vietnamese in the English ones', () => {
    expect(shape(CAREER_TEXT.en)).toEqual(shape(CAREER_TEXT.vi));
    expect(shape(JOBMAP_TEXT.en)).toEqual(shape(JOBMAP_TEXT.vi));
    // The functions are checked by calling them.
    const calls = [
      CAREER_TEXT.en.from('X', 'about 5 km'), CAREER_TEXT.en.fewer(5), CAREER_TEXT.en.more(2), CAREER_TEXT.en.how({ background: 40, training: 25, education: 20, work: 15 }),
      CAREER_TEXT.en.premiumPlans(5), CAREER_TEXT.en.planHead('x'), CAREER_TEXT.en.planSub('1/10/2026', 'day 3 of 30'), CAREER_TEXT.en.dayOf(3), CAREER_TEXT.en.tasks(1, 9),
      CAREER_TEXT.en.planLimit(1), CAREER_TEXT.en.sourcesNote('22/10/2026'),
      JOBMAP_TEXT.en.minutes(15), JOBMAP_TEXT.en.fromHome('X'), JOBMAP_TEXT.en.line('2A'), JOBMAP_TEXT.en.legendMetroKm('1.5'), JOBMAP_TEXT.en.liveNone('x', 20),
      JOBMAP_TEXT.en.liveTop(12), JOBMAP_TEXT.en.colTo('x'), JOBMAP_TEXT.en.liveNote('1.5'), JOBMAP_TEXT.en.metroNote('1.5'), JOBMAP_TEXT.en.endNote3('OSRM'), JOBMAP_TEXT.en.metroCell.line('2A'),
    ];
    expect(noVietnamese([CAREER_TEXT.en, JOBMAP_TEXT.en, calls])).toEqual([]);
  });

  it('names the same tabs in both languages', () => {
    expect(Object.keys(CAREER_TEXT.en.tabs)).toEqual(['paths', 'plan', 'market', 'map', 'support']);
    expect(CAREER_TEXT.vi.tabs.map).toBe('Bản đồ');
  });
});
