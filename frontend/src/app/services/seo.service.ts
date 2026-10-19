import { DOCUMENT } from '@angular/common';
import { Injectable, inject } from '@angular/core';
import { Meta } from '@angular/platform-browser';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs';
import { SITE_URL } from '../config';

const DEFAULT_DESCRIPTION =
  'Hanoi Century Vista: bản đồ cơ hội kinh doanh, cỗ máy thời gian, điểm sống, bản đồ tương lai và phân tích bất động sản cho Hà Nội.';

/** Description per route (first path segment). Anything not listed keeps the default. */
export const ROUTE_DESCRIPTIONS: Record<string, string> = {
  '': DEFAULT_DESCRIPTION,
  'opportunity-map': 'Bản đồ cơ hội kinh doanh Hà Nội: chấm điểm 79 phường/xã theo nhu cầu, cạnh tranh và rủi ro từ dữ liệu OpenStreetMap, kèm báo cáo và hỏi đáp AI.',
  'time-machine': 'Hanoi Time Machine: xem các công trình Hà Nội qua từng thời kỳ, từ ảnh tư liệu xưa tới kịch bản tương lai, và hỏi AI kể chuyện dựa trên dữ liệu có nguồn.',
  'living-score': 'Living Score: điểm chất lượng sống của từng khu vực Hà Nội theo tiêu chí bạn chọn.',
  'future-map': 'Hanoi Future Map: các mốc quy hoạch Hà Nội giai đoạn 2026–2065 và Vùng Thủ đô, có nguồn trích dẫn.',
  'property-intelligence': 'AI Property Intelligence: giá đất, thị trường và dự án bất động sản Hà Nội, kèm nguồn, ngày dữ liệu và độ tin cậy.',
  premium: 'Gói Premium và lượt hỏi AI chuyên sâu cho các công cụ của Hanoi Century Vista.',
  terms: 'Điều khoản sử dụng Hanoi Century Vista.',
  privacy: 'Chính sách quyền riêng tư của Hanoi Century Vista.',
  refund: 'Chính sách hoàn tiền của Hanoi Century Vista.',
};

/** Pages with no value in search results (links from emails, password screens). */
const NO_INDEX = new Set(['forgot-password', 'reset-password', 'verify-email']);

/**
 * Keeps the description, canonical link, robots and Open Graph / Twitter tags in step with the route.
 * Angular renders in the browser, so link previews (Facebook, Zalo…) read only the static tags in index.html; these
 * updates serve search engines that run JavaScript and the browser itself.
 */
@Injectable({ providedIn: 'root' })
export class SeoService {
  private readonly router = inject(Router);
  private readonly meta = inject(Meta);
  private readonly doc = inject(DOCUMENT);
  private started = false;

  start(): void {
    if (this.started) return;
    this.started = true;
    this.router.events.pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd)).subscribe((e) => this.apply(e.urlAfterRedirects));
  }

  apply(url: string): void {
    const path = url.split(/[?#]/)[0].replace(/^\/+|\/+$/g, '');
    const key = path.split('/')[0];
    const description = ROUTE_DESCRIPTIONS[key] ?? DEFAULT_DESCRIPTION;
    const canonical = `${SITE_URL}${path ? `/${path}` : '/'}`;
    const title = this.doc.title;
    this.meta.updateTag({ name: 'description', content: description });
    this.meta.updateTag({ name: 'robots', content: NO_INDEX.has(key) ? 'noindex, nofollow' : 'index, follow' });
    this.meta.updateTag({ property: 'og:title', content: title });
    this.meta.updateTag({ property: 'og:description', content: description });
    this.meta.updateTag({ property: 'og:url', content: canonical });
    this.meta.updateTag({ name: 'twitter:title', content: title });
    this.meta.updateTag({ name: 'twitter:description', content: description });
    let link = this.doc.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!link) {
      link = this.doc.createElement('link');
      link.rel = 'canonical';
      this.doc.head.appendChild(link);
    }
    link.href = canonical;
  }
}
