import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

/** The three legal links, for a page footer or under a form. */
@Component({
  selector: 'app-legal-links',
  standalone: true,
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<nav class="ll" aria-label="Pháp lý"><a routerLink="/terms">Điều khoản</a><a routerLink="/privacy">Quyền riêng tư</a><a routerLink="/refund">Hoàn tiền</a></nav>`,
  styles: `
    .ll { display: flex; flex-wrap: wrap; justify-content: center; gap: 6px 16px; padding: 16px; font-size: 13px; }
    a { color: var(--app-ink-dim); text-decoration: none; }
    a:hover { color: var(--app-biz); text-decoration: underline; }
  `,
})
export class LegalLinksComponent {}
