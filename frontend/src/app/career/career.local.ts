import { initialSiteLang } from '../services/site-lang.service';
import { AREAS, CHANNELS, CONTEXT, Channel, DIRECTIONS, Direction, Fact, POLICIES, Policy, SIGNALS, Source, WorkArea } from './career.data';
import { EN_AREAS, EN_CHANNELS, EN_CONTEXT, EN_DIRECTIONS, EN_POLICIES, EN_SIGNALS, EN_SOURCE_KIND, EN_SOURCE_TITLES } from './career.en';

/** The page is written in Vietnamese and English; the figures and their sources are the same in both. */
export type CareerLang = 'vi' | 'en';

/** The locale for numbers and dates. */
export const localeOf = (lang: CareerLang): string => (lang === 'en' ? 'en-GB' : 'vi-VN');

/** The site's language: ?lang=en in the address, else the one chosen anywhere on the site, else Vietnamese. */
export const initialCareerLang = (): CareerLang => initialSiteLang();

const directionCache = new Map<string, Direction>();

export function directionIn(d: Direction, lang: CareerLang): Direction {
  const en = EN_DIRECTIONS[d.id];
  if (lang === 'vi' || !en) return d;
  let out = directionCache.get(d.id);
  if (!out) {
    out = {
      ...d,
      name: en.name,
      blurb: en.blurb,
      facts: d.facts.map((f, i) => ({ ...f, text: en.facts[i] ?? f.text })),
      roles: en.roles,
      skills: en.skills,
      steps: d.steps.map((s, i) => ({ when: en.steps[i]?.[0] ?? s.when, text: en.steps[i]?.[1] ?? s.text })),
      tools: d.tools.map((t, i) => ({ ...t, label: en.tools[i] ?? t.label })),
    };
    directionCache.set(d.id, out);
  }
  return out;
}

export const directionsIn = (lang: CareerLang): Direction[] => DIRECTIONS.map((d) => directionIn(d, lang));

export function contextIn(lang: CareerLang): { value: string; label: string; sources: string[] }[] {
  return CONTEXT.map((c, i) => (lang === 'en' && EN_CONTEXT[i] ? { ...c, value: EN_CONTEXT[i][0], label: EN_CONTEXT[i][1] } : c));
}

export function signalsIn(lang: CareerLang): Record<string, Fact> {
  return lang === 'vi' ? SIGNALS : Object.fromEntries(Object.entries(SIGNALS).map(([id, f]) => [id, { ...f, text: EN_SIGNALS[id] ?? f.text }]));
}

export function policiesIn(lang: CareerLang): Policy[] {
  return POLICIES.map((p, i) => (lang === 'en' && EN_POLICIES[i] ? { ...p, title: EN_POLICIES[i][0], text: EN_POLICIES[i][1] } : p));
}

export function channelsIn(lang: CareerLang): Channel[] {
  return CHANNELS.map((c, i) => (lang === 'en' && EN_CHANNELS[i] ? { ...c, name: EN_CHANNELS[i].name, text: EN_CHANNELS[i].text } : c));
}

export function areaIn(a: WorkArea, lang: CareerLang): WorkArea {
  const en = EN_AREAS[a.id];
  return lang === 'en' && en ? { ...a, name: en[0], note: en[1] } : a;
}

export function areasIn(lang: CareerLang): Record<string, WorkArea> {
  return lang === 'vi' ? AREAS : Object.fromEntries(Object.entries(AREAS).map(([id, a]) => [id, areaIn(a, lang)]));
}

/** A source's title: the Vietnamese one, except for the one that describes a method, which is glossed in English. */
export const sourceTitleIn = (s: Source, lang: CareerLang): string => (lang === 'en' ? (EN_SOURCE_TITLES[s.id] ?? s.title) : s.title);
export const sourceKindIn = (kind: Source['kind'], lang: CareerLang): string =>
  lang === 'en' ? EN_SOURCE_KIND[kind] : kind === 'official' ? 'văn bản, số liệu chính thức' : kind === 'computed' ? 'số liệu tính từ dữ liệu mở' : 'báo chí đưa tin';
