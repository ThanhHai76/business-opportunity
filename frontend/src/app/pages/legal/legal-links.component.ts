import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SiteLangService } from '../../services/site-lang.service';

/** The footer links: the directory of wards and communes, then the three legal pages. */
@Component({
  selector: 'app-legal-links',
  standalone: true,
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<nav class="ll" [attr.aria-label]="tx().aria"><a routerLink="/phuong-xa">{{ tx().wards }}</a><a routerLink="/giai-thich-diem">{{ tx().guide }}</a><a routerLink="/terms">{{ tx().terms }}</a><a routerLink="/privacy">{{ tx().privacy }}</a><a routerLink="/refund">{{ tx().refund }}</a></nav>`,
  styles: `
    .ll { display: flex; flex-wrap: wrap; justify-content: center; gap: 6px 16px; padding: 16px; font-size: 13px; }
    a { color: var(--app-ink-dim); text-decoration: none; }
    a:hover { color: var(--app-biz); text-decoration: underline; }
  `,
})
export class LegalLinksComponent {
  private readonly site = inject(SiteLangService);
  protected readonly tx = computed(() =>
    this.site.lang() === 'en' ? { aria: 'Links', wards: 'Wards and communes', guide: 'What scores mean', terms: 'Terms', privacy: 'Privacy', refund: 'Refunds' } : { aria: 'Liên kết', wards: 'Phường/xã', guide: 'Giải thích điểm', terms: 'Điều khoản', privacy: 'Quyền riêng tư', refund: 'Hoàn tiền' },
  );
}
