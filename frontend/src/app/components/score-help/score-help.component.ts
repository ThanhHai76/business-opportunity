import { ChangeDetectionStrategy, Component, ElementRef, HostListener, computed, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SiteLangService } from '../../services/site-lang.service';

export type ScoreTopic = 'opportunity' | 'living' | 'property';

/** The short answers; the full ones are on /giai-thich-diem (src/app/pages/guide), under the same ids. */
export const SCORE_HELP: Record<'vi' | 'en', { label: string; more: string; close: string; text: Record<ScoreTopic, string> }> = {
  vi: {
    label: 'Điểm này nghĩa là gì?',
    more: 'Giải thích đầy đủ',
    close: 'Đóng',
    text: {
      opportunity: 'Điểm 0-100 so với các phường khác: nhu cầu của khách trừ đi một phần cạnh tranh. Dùng để chọn phường xem trước, không phải dự báo doanh thu.',
      living: 'Điểm 0-100 so với các khu vực khác, tính từ giao thông, giáo dục, y tế, không gian xanh và tiện ích trong 1,5 km. Bạn tự chỉnh mức quan trọng của từng tiêu chí.',
      property: 'Điểm 0-100 so với các phường khác, gộp sáu tiêu chí: kết nối, hạ tầng sắp có, cực phát triển, tiện ích, mật độ dân cư, phát triển mới. Không phải dự báo giá.',
    },
  },
  en: {
    label: 'What does this score mean?',
    more: 'Full explanation',
    close: 'Close',
    text: {
      opportunity: 'A 0-100 score against other wards: customer demand minus a part of competition. Use it to pick wards to look at first, not as a revenue forecast.',
      living: 'A 0-100 score against other areas, from transport, education, healthcare, green space and amenities within 1.5 km. You set how much each criterion matters.',
      property: 'A 0-100 score against other wards that combines six criteria: connectivity, infrastructure coming, growth pole, amenities, population density, new development. Not a price forecast.',
    },
  },
};

/** A small "?" that opens a short explanation of a score, with a link to the full one. */
@Component({
  selector: 'app-score-help',
  standalone: true,
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button type="button" class="sh__btn" [attr.aria-label]="tx().label" [attr.aria-expanded]="open()" (click)="toggle($event)">?</button>
    @if (open()) {
      <span class="sh__pop" role="note">
        <span>{{ tx().text[topic()] }}</span>
        <a [routerLink]="['/giai-thich-diem']" [fragment]="topic()" (click)="open.set(false)">{{ tx().more }} →</a>
      </span>
    }
  `,
  styles: `
    :host { position: relative; display: inline-block; vertical-align: middle; margin-left: 6px; font-weight: 400; font-size: 13px; line-height: 1.45; text-transform: none; letter-spacing: normal; }
    .sh__btn { width: 20px; height: 20px; padding: 0; border: 1px solid currentColor; border-radius: 50%; background: transparent; color: inherit; font: inherit; font-size: 12px; font-weight: 700; line-height: 1; cursor: pointer; opacity: 0.7; }
    .sh__btn:hover, .sh__btn:focus-visible, .sh__btn[aria-expanded='true'] { opacity: 1; }
    .sh__pop { position: absolute; z-index: 50; top: calc(100% + 6px); left: 0; width: min(280px, 80vw); padding: 10px 12px; display: grid; gap: 6px; border: 1px solid var(--app-line, #ccc); border-radius: 10px; background: var(--app-surface, #fff); color: var(--app-ink, #222); box-shadow: 0 10px 28px -12px rgba(0, 0, 0, 0.35); text-align: left; }
    .sh__pop a { color: var(--app-biz, #a34); font-weight: 700; text-decoration: none; }
  `,
})
export class ScoreHelpComponent {
  readonly topic = input.required<ScoreTopic>();
  private readonly site = inject(SiteLangService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  protected readonly tx = computed(() => SCORE_HELP[this.site.lang()]);
  protected readonly open = signal(false);

  protected toggle(event: Event): void {
    event.stopPropagation(); // the "?" sits inside headings and cards that react to clicks
    this.open.update((v) => !v);
  }

  @HostListener('document:click', ['$event'])
  protected outside(event: Event): void {
    if (this.open() && !this.host.nativeElement.contains(event.target as Node)) this.open.set(false);
  }

  @HostListener('document:keydown.escape')
  protected escape(): void {
    this.open.set(false);
  }
}
