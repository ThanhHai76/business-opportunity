import { Pipe, PipeTransform } from '@angular/core';
import { CategoryKey, Level } from '../bc.models';

export const LEVEL_VI: Record<Level, string> = { Low: 'Thấp', Medium: 'Trung bình', High: 'Cao' };

export const CATEGORY_OPTIONS: Array<{ key: CategoryKey; label: string; icon: string; prompt: string }> = [
  { key: 'coffee-shop', label: 'Quán cà phê', icon: 'coffee', prompt: 'mở quán cà phê' },
  { key: 'restaurant', label: 'Nhà hàng', icon: 'utensils', prompt: 'mở nhà hàng' },
  { key: 'retail-store', label: 'Cửa hàng bán lẻ', icon: 'bag', prompt: 'mở cửa hàng bán lẻ' },
  { key: 'gym', label: 'Phòng gym', icon: 'dumbbell', prompt: 'mở phòng gym' },
  { key: 'pharmacy', label: 'Nhà thuốc', icon: 'pill', prompt: 'mở nhà thuốc' },
  { key: 'convenience-store', label: 'Cửa hàng tiện lợi', icon: 'store', prompt: 'mở cửa hàng tiện lợi' },
];

/** 1234.5 (millions) -> "1.234,5 tr"; >= 1000 tr shown as tỷ. */
export function money(millions: number | null | undefined): string {
  if (millions === null || millions === undefined) return '—';
  if (Math.abs(millions) >= 1000) return `${new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 2 }).format(millions / 1000)} tỷ`;
  return `${new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 1 }).format(millions)} tr`;
}

@Pipe({ name: 'money', standalone: true })
export class MoneyPipe implements PipeTransform {
  transform(value: number | null | undefined): string {
    return money(value);
  }
}

@Pipe({ name: 'level', standalone: true })
export class LevelPipe implements PipeTransform {
  transform(value: Level | null | undefined): string {
    return value ? LEVEL_VI[value] : '—';
  }
}

export function budgetLabel(vnd: number): string {
  return money(vnd / 1_000_000).replace(' tr', 'M').replace(' tỷ', ' tỷ') + ' ₫';
}
