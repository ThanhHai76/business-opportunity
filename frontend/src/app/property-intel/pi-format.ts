import { Pipe, PipeTransform } from '@angular/core';
import { Lang } from './pi.models';

const locale = (lang: Lang) => (lang === 'en' ? 'en-US' : 'vi-VN');

/** A number in the language's format: 68.4 → "68,4" in Vietnamese. */
export function formatNum(n: number, lang: Lang, digits = 1): string {
  return n.toLocaleString(locale(lang), { maximumFractionDigits: digits });
}

export const formatInt = (n: number, lang: Lang = 'vi'): string => formatNum(Math.round(n), lang, 0);
export const signed = (n: number, lang: Lang = 'vi', suffix = '%'): string => `${n > 0 ? '+' : ''}${formatNum(n, lang)}${suffix}`;

/** A total in billion VND ("9,8 tỷ" / "9.8 bn VND"). */
export function formatBillion(ty: number, lang: Lang = 'vi'): string {
  return `${formatNum(ty, lang, 2)} ${lang === 'en' ? 'bn VND' : 'tỷ'}`;
}

export function formatDistance(m: number, lang: Lang = 'vi'): string {
  return m < 1000 ? `${Math.round(m / 10) * 10} m` : `${formatNum(m / 1000, lang)} km`;
}

@Pipe({ name: 'piDistance', standalone: true })
export class PiDistancePipe implements PipeTransform {
  transform(m: number, lang: Lang = 'vi'): string {
    return formatDistance(m, lang);
  }
}

@Pipe({ name: 'piNum', standalone: true })
export class PiNumPipe implements PipeTransform {
  transform(n: number, lang: Lang = 'vi', digits = 1): string {
    return formatNum(n, lang, digits);
  }
}

/**
 * SVG polyline points for a series drawn into a w×h box (y grows downwards), with a shared
 * min/max so several series can sit on the same scale.
 */
export function linePoints(values: number[], w: number, h: number, min: number, max: number, pad = 6): string {
  const span = max - min || 1;
  const step = values.length > 1 ? w / (values.length - 1) : 0;
  return values.map((v, i) => `${round(i * step)},${round(h - pad - ((v - min) / span) * (h - pad * 2))}`).join(' ');
}

/** Same as linePoints, closed down to the baseline for an area fill. */
export function areaPoints(values: number[], w: number, h: number, min: number, max: number, pad = 6): string {
  return `${linePoints(values, w, h, min, max, pad)} ${w},${h} 0,${h}`;
}

const round = (n: number) => Math.round(n * 10) / 10;
