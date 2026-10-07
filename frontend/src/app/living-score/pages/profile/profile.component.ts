import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { IconComponent } from '../../components/icon/icon.component';
import { WeightsPanelComponent } from '../../components/weights-panel/weights-panel.component';
import { LangService } from '../../services/lang.service';
import { PreferencesService, ThemeChoice } from '../../services/preferences.service';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [IconComponent, WeightsPanelComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="ls-page ls-page--narrow">
      <header>
        <h1 class="ls-title">{{ t().profile.title }}</h1>
        <p class="ls-subtitle">{{ t().profile.subtitle }}</p>
      </header>

      <section class="ls-card">
        <h2 class="ls-section-title">{{ t().profile.appearance }}</h2>
        <div class="seg" role="radiogroup" [attr.aria-label]="t().profile.appearance">
          @for (option of themes; track option.value) {
            <button
              type="button"
              role="radio"
              class="ls-chip"
              [class.is-on]="prefs.theme() === option.value"
              [attr.aria-checked]="prefs.theme() === option.value"
              (click)="prefs.setTheme(option.value)"
            >
              <ls-icon [name]="option.icon" [size]="15" /> {{ t().theme[option.value] }}
            </button>
          }
        </div>
      </section>

      <section class="ls-card">
        <h2 class="ls-section-title">{{ t().shell.language }}</h2>
        <div class="seg" role="radiogroup" [attr.aria-label]="t().shell.language">
          @for (option of languages; track option.value) {
            <button
              type="button"
              role="radio"
              class="ls-chip"
              [class.is-on]="langService.lang() === option.value"
              [attr.aria-checked]="langService.lang() === option.value"
              (click)="langService.set(option.value)"
            >
              <ls-icon name="globe" [size]="15" /> {{ option.label }}
            </button>
          }
        </div>
      </section>

      <section class="ls-card">
        <h2 class="ls-section-title">{{ t().profile.weightsTitle }}</h2>
        <p class="hint">{{ t().profile.weightsHint }}</p>
        <ls-weights-panel />
      </section>

      <section class="ls-card">
        <h2 class="ls-section-title">{{ t().profile.device }}</h2>
        <p class="hint">{{ t().profile.deviceSummary(prefs.saved().length, prefs.compareSelection().length) }}</p>
        <button type="button" class="ls-btn ls-btn-ghost" (click)="clear()"><ls-icon name="trash" [size]="16" /> {{ t().profile.clear }}</button>
      </section>

      <p class="foot"><ls-icon name="info" [size]="14" /> {{ t().profile.foot }}</p>
    </div>
  `,
  styles: [
    `
      .ls-page {
        display: grid;
        gap: 18px;
      }
      .seg {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
      }
      .hint {
        margin: 0 0 14px;
        font-size: 13px;
        color: var(--ls-ink-dim);
      }
      .foot {
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 12px;
        color: var(--ls-ink-faint);
      }
    `,
  ],
})
export class ProfileComponent {
  protected readonly prefs = inject(PreferencesService);
  protected readonly langService = inject(LangService);
  protected readonly t = this.langService.t;
  protected readonly themes: Array<{ value: ThemeChoice; icon: string }> = [
    { value: 'system', icon: 'layers' },
    { value: 'light', icon: 'sun' },
    { value: 'dark', icon: 'moon' },
  ];
  protected readonly languages = [
    { value: 'vi' as const, label: 'Tiếng Việt' },
    { value: 'en' as const, label: 'English' },
  ];

  protected clear(): void {
    if (confirm(this.t().profile.confirm)) this.prefs.clearAll();
  }
}
