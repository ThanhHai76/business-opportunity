import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SiteLangService } from '../../services/site-lang.service';

/** The three legal links, for a page footer or under a form. */
@Component({
  selector: 'app-legal-links',
  standalone: true,
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<nav class="ll" [attr.aria-label]="tx().aria"><a routerLink="/terms">{{ tx().terms }}</a><a routerLink="/privacy">{{ tx().privacy }}</a><a routerLink="/refund">{{ tx().refund }}</a></nav>`,
  styles: `
    .ll { display: flex; flex-wrap: wrap; justify-content: center; gap: 6px 16px; padding: 16px; font-size: 13px; }
    a { color: var(--app-ink-dim); text-decoration: none; }
    a:hover { color: var(--app-biz); text-decoration: underline; }
  `,
})
export class LegalLinksComponent {
  private readonly site = inject(SiteLangService);
  protected readonly tx = computed(() =>
    this.site.lang() === 'en' ? { aria: 'Legal', terms: 'Terms', privacy: 'Privacy', refund: 'Refunds' } : { aria: 'Pháp lý', terms: 'Điều khoản', privacy: 'Quyền riêng tư', refund: 'Hoàn tiền' },
  );
}
