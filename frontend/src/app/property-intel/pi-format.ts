import { Pipe, PipeTransform } from '@angular/core';
import { Currency } from './pi.models';

const usd0 = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
const int = new Intl.NumberFormat('en-US');

/** Price per m² given in "tr" (million VND): "68.4 tr" or "$2,693". */
export function formatPerM2(tr: number, currency: Currency, vndPerUsd: number): string {
  return currency === 'VND' ? `${tr} tr` : usd0.format((tr * 1e6) / vndPerUsd);
}

/** Unit caption for a per-m² axis or column. */
export function perM2Unit(currency: Currency): string {
  return currency === 'VND' ? 'tr/m²' : '$/m²';
}

/** Total price given in "tỷ" (billion VND): "5.39 tỷ" or "$212k". */
export function formatTotal(ty: number, currency: Currency, vndPerUsd: number): string {
  if (currency === 'VND') return `${ty} tỷ`;
  const usd = (ty * 1e9) / vndPerUsd;
  return usd >= 1e6 ? `$${(usd / 1e6).toFixed(2)}M` : `$${Math.round(usd / 1000)}k`;
}

export function formatDistance(m: number): string {
  return m < 1000 ? `${m} m` : `${(m / 1000).toFixed(1)} km`;
}

export const formatInt = (n: number): string => int.format(n);
export const signed = (n: number, suffix = '%'): string => `${n > 0 ? '+' : ''}${n}${suffix}`;

@Pipe({ name: 'piPerM2', standalone: true })
export class PiPerM2Pipe implements PipeTransform {
  transform(tr: number, currency: Currency, vndPerUsd: number): string {
    return formatPerM2(tr, currency, vndPerUsd);
  }
}

@Pipe({ name: 'piTotal', standalone: true })
export class PiTotalPipe implements PipeTransform {
  transform(ty: number, currency: Currency, vndPerUsd: number): string {
    return formatTotal(ty, currency, vndPerUsd);
  }
}

@Pipe({ name: 'piDistance', standalone: true })
export class PiDistancePipe implements PipeTransform {
  transform(m: number): string {
    return formatDistance(m);
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
