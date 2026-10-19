import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { LEGAL, legalIncomplete } from './legal.config';
import { LegalKind, legalDoc } from './legal-content';

/** Terms, Privacy and Refund pages: one component, the route's `kind` data picks the text. */
@Component({
  selector: 'app-legal',
  standalone: true,
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="lg">
      <nav class="lg__tabs" aria-label="Tài liệu pháp lý">
        <a routerLink="/terms" [class.on]="kind() === 'terms'">Điều khoản</a>
        <a routerLink="/privacy" [class.on]="kind() === 'privacy'">Quyền riêng tư</a>
        <a routerLink="/refund" [class.on]="kind() === 'refund'">Hoàn tiền</a>
      </nav>
      <h1>{{ doc().title }}</h1>
      <p class="lg__meta">Có hiệu lực từ {{ effective }}</p>
      @if (incomplete) {
        <p class="lg__warn" role="note">Bản nháp: thông tin đơn vị vận hành chưa được điền (legal.config.ts). Cần điền và nhờ chuyên gia pháp lý rà soát trước khi nhận thanh toán thật.</p>
      }
      <p class="lg__lead">{{ doc().lead }}</p>
      @for (s of doc().sections; track s.title) {
        <section>
          <h2>{{ s.title }}</h2>
          @for (p of s.body; track p) {
            @if (p.startsWith('- ')) {
              <p class="lg__li">{{ p.slice(2) }}</p>
            } @else {
              <p>{{ p }}</p>
            }
          }
        </section>
      }
      <p class="lg__back"><a routerLink="/">← Về trang chủ</a></p>
    </main>
  `,
  styles: `
    :host { display: block; min-height: 100%; background: var(--app-bg); color: var(--app-ink); font-family: 'Manrope', -apple-system, 'Segoe UI', sans-serif; line-height: 1.65; }
    .lg { max-width: 760px; margin: 0 auto; padding: 28px 16px 64px; }
    .lg__tabs { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 18px; }
    .lg__tabs a { padding: 6px 12px; border: 1px solid var(--app-line); border-radius: 999px; color: var(--app-ink-dim); text-decoration: none; font-size: 13px; font-weight: 700; }
    .lg__tabs a.on { background: var(--app-biz); border-color: transparent; color: #fff; }
    h1 { margin: 0 0 4px; font-size: 28px; line-height: 1.2; }
    h2 { margin: 26px 0 6px; font-size: 17px; }
    p { margin: 0 0 10px; }
    .lg__meta { color: var(--app-ink-dim); font-size: 13px; }
    .lg__lead { font-size: 15px; }
    .lg__li { position: relative; padding-left: 18px; }
    .lg__li::before { content: '•'; position: absolute; left: 4px; }
    .lg__warn { padding: 10px 12px; border: 1px dashed #d97706; border-radius: 10px; background: color-mix(in srgb, #d97706 10%, transparent); font-size: 13px; }
    .lg__back { margin-top: 32px; }
    .lg__back a { color: var(--app-biz); font-weight: 700; text-decoration: none; }
  `,
})
export class LegalComponent {
  private readonly route = inject(ActivatedRoute);
  protected readonly kind = toSignal(this.route.data.pipe(map((d) => d['kind'] as LegalKind)), { initialValue: 'terms' as LegalKind });
  protected readonly doc = computed(() => legalDoc(this.kind()));
  protected readonly incomplete = legalIncomplete();
  protected readonly effective = new Date(LEGAL.effectiveDate).toLocaleDateString('vi-VN', { day: 'numeric', month: 'numeric', year: 'numeric' });
}
