import { Pipe, PipeTransform } from '@angular/core';
import { DICT, Lang } from '../i18n/ls-i18n';
import { AreaFacts } from '../models/living-score.models';

const formats = new Map<string, Intl.NumberFormat>();
function formatter(lang: Lang, digits: number): Intl.NumberFormat {
  const key = `${lang}:${digits}`;
  if (!formats.has(key)) {
    formats.set(key, new Intl.NumberFormat(lang === 'en' ? 'en-US' : 'vi-VN', { maximumFractionDigits: digits }));
  }
  return formats.get(key)!;
}

/** Number in the interface language: 29.9 -> "29,9" (vi) / "29.9" (en); 292000 -> "292.000" / "292,000". */
export function formatNum(value: number, lang: Lang = 'vi', digits = 0): string {
  return formatter(lang, digits).format(value);
}

/** `{{ x | num: lang() : 1 }}` — at most `digits` decimals. */
@Pipe({ name: 'num', standalone: true })
export class NumPipe implements PipeTransform {
  transform(value: number | null | undefined, lang: Lang = 'vi', digits = 0): string {
    return value === null || value === undefined ? '—' : formatNum(value, lang, digits);
  }
}

/** Short OpenStreetMap summary for list rows: "3 ga metro · 80 quán cà phê". */
@Pipe({ name: 'facts', standalone: true })
export class FactsPipe implements PipeTransform {
  transform(facts: AreaFacts | null | undefined, lang: Lang = 'vi'): string {
    if (!facts) return '';
    const t = DICT[lang].facts;
    const metro = facts.metroStations.length ? t.metro(facts.metroStations.length) : t.noMetro;
    return `${metro} · ${t.cafes(formatNum(facts.cafes, lang))}`;
  }
}
