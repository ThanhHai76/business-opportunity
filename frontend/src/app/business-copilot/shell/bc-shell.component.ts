import { ChangeDetectionStrategy, Component, HostListener, ViewEncapsulation, computed, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { IconComponent } from '../../living-score/components/icon/icon.component';
import { ThemeService } from '../../services/theme.service';
import { normalizeText } from '../../utils/text';
import { BcStateService } from '../bc.service';
import { BcCopilotChatComponent } from '../shared/bc-copilot-chat.component';

const LOCATIONS: Array<{ slug: string; name: string }> = [
  { slug: 'cau-giay', name: 'Cầu Giấy' },
  { slug: 'ha-dong', name: 'Hà Đông' },
  { slug: 'tay-ho', name: 'Tây Hồ' },
  { slug: 'hoan-kiem', name: 'Hoàn Kiếm' },
  { slug: 'dong-da', name: 'Đống Đa' },
  { slug: 'thanh-xuan', name: 'Thanh Xuân' },
  { slug: 'hai-ba-trung', name: 'Hai Bà Trưng' },
  { slug: 'gia-lam', name: 'Gia Lâm' },
  { slug: 'long-bien', name: 'Long Biên' },
  { slug: 'nam-tu-liem', name: 'Nam Từ Liêm' },
];

/** Frame of the Business Copilot: product top bar, search, "Ask AI" and the persistent assistant drawer. */
@Component({
  selector: 'bc-shell',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, IconComponent, BcCopilotChatComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: '../bc.css',
  encapsulation: ViewEncapsulation.None,
  host: { style: 'display:block' },
  template: `
    <div class="bc" [attr.data-theme]="theme.effective()">
      <header class="bc-top">
        <a class="bc-brand" routerLink="/business-copilot" aria-label="Hanoi Business Copilot — Dashboard">
          <span class="bc-brand__mark" aria-hidden="true"><i></i></span>
          <div>
            <b>HANOI BUSINESS COPILOT</b>
            <small>LOCATION INTELLIGENCE</small>
          </div>
        </a>
        <nav class="bc-nav" aria-label="Điều hướng Business Copilot">
          @for (item of nav; track item.path) {
            <a [routerLink]="item.path" routerLinkActive="is-active" [routerLinkActiveOptions]="{ exact: item.exact }" [class.is-ai]="item.ai">{{ item.label }}</a>
          }
        </nav>
        <div class="bc-top__right">
          <label class="bc-search">
            <ls-icon name="search" [size]="15" />
            <input
              type="search"
              placeholder="Tìm quận, khu vực, câu hỏi…"
              aria-label="Tìm khu vực hoặc hỏi AI"
              [value]="query()"
              (input)="query.set($any($event.target).value)"
              (keydown.enter)="submitSearch()"
              (focus)="focused.set(true)"
              (blur)="focused.set(false)"
            />
            <kbd>↵</kbd>
            @if (focused() && suggestions().length) {
              <ul class="bc-suggest" role="listbox">
                @for (s of suggestions(); track s.slug) {
                  <li><button type="button" (mousedown)="openLocation(s.slug)">{{ s.name }} <small>Location intelligence</small></button></li>
                }
              </ul>
            }
          </label>
          <button type="button" class="bc-btn bc-btn--dark" (click)="state.copilotOpen.set(true)"><ls-icon name="sparkles" [size]="15" /><span>Ask AI</span></button>
        </div>
      </header>

      <main class="bc-main">
        <router-outlet />
      </main>

      @if (!state.copilotOpen()) {
        <button type="button" class="bc-fab" (click)="state.copilotOpen.set(true)" aria-label="Mở Hanoi Business Copilot"><ls-icon name="sparkles" [size]="18" /> Copilot</button>
      }

      @if (state.copilotOpen()) {
        <div class="bc-drawer-backdrop" (click)="state.copilotOpen.set(false)"></div>
        <aside class="bc-drawer" role="dialog" aria-modal="true" aria-label="Hanoi Business Copilot">
          <bc-copilot-chat [compact]="true" (closed)="state.copilotOpen.set(false)" />
        </aside>
      }
    </div>
  `,
})
export class BcShellComponent {
  protected readonly theme = inject(ThemeService);
  protected readonly state = inject(BcStateService);
  private readonly router = inject(Router);

  protected readonly nav = [
    { path: '/business-copilot', label: 'Dashboard', exact: true, ai: false },
    { path: '/business-copilot/explore', label: 'Explore Locations', exact: false, ai: false },
    { path: '/business-copilot/market', label: 'Market Data', exact: false, ai: false },
    { path: '/business-copilot/competitors', label: 'Competitors', exact: false, ai: false },
    { path: '/business-copilot/compare', label: 'Compare', exact: false, ai: false },
    { path: '/business-copilot/simulator', label: 'Simulator', exact: false, ai: false },
    { path: '/business-copilot/reports', label: 'Reports', exact: false, ai: false },
    { path: '/business-copilot/copilot', label: 'AI Copilot', exact: false, ai: true },
  ];

  protected readonly query = signal('');
  protected readonly focused = signal(false);
  protected readonly suggestions = computed(() => {
    const q = normalizeText(this.query());
    return q ? LOCATIONS.filter((l) => normalizeText(l.name).includes(q)).slice(0, 5) : [];
  });

  protected openLocation(slug: string): void {
    this.query.set('');
    this.state.set({ selected: slug });
    void this.router.navigate(['/business-copilot/location', slug]);
  }

  protected submitSearch(): void {
    const first = this.suggestions()[0];
    if (first) return this.openLocation(first.slug);
    const q = this.query().trim();
    if (q) {
      this.query.set('');
      this.state.askCopilot(q);
    }
  }

  @HostListener('document:keydown.escape')
  protected onEscape(): void {
    this.state.copilotOpen.set(false);
  }
}
