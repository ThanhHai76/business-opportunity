import { Pipe, PipeTransform } from '@angular/core';

const vndFormat = new Intl.NumberFormat('vi-VN');
const millionsFormat = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 1 });

/** 9500000 -> "9.500.000đ" */
@Pipe({ name: 'vnd', standalone: true })
export class VndPipe implements PipeTransform {
  transform(value: number | null | undefined): string {
    return value === null || value === undefined ? '—' : `${vndFormat.format(Math.round(value))}đ`;
  }
}

/** 9500000 -> "9,5 triệu" */
@Pipe({ name: 'millions', standalone: true })
export class MillionsPipe implements PipeTransform {
  transform(value: number | null | undefined): string {
    return value === null || value === undefined ? '—' : `${millionsFormat.format(value / 1_000_000)} triệu`;
  }
}

/** 292000 -> "292.000" */
@Pipe({ name: 'num', standalone: true })
export class NumPipe implements PipeTransform {
  transform(value: number | null | undefined): string {
    return value === null || value === undefined ? '—' : vndFormat.format(value);
  }
}
