import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { IconComponent } from '../../components/icon/icon.component';
import { WeightsPanelComponent } from '../../components/weights-panel/weights-panel.component';
import { PreferencesService, ThemeChoice } from '../../services/preferences.service';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [IconComponent, WeightsPanelComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="ls-page ls-page--narrow">
      <header>
        <h1 class="ls-title">Cá nhân</h1>
        <p class="ls-subtitle">Thiết lập giao diện và trọng số mặc định. Mọi thứ được lưu trên trình duyệt này.</p>
      </header>

      <section class="ls-card">
        <h2 class="ls-section-title">Giao diện</h2>
        <div class="seg" role="radiogroup" aria-label="Giao diện">
          @for (option of themes; track option.value) {
            <button
              type="button"
              role="radio"
              class="ls-chip"
              [class.is-on]="prefs.theme() === option.value"
              [attr.aria-checked]="prefs.theme() === option.value"
              (click)="prefs.setTheme(option.value)"
            >
              <ls-icon [name]="option.icon" [size]="15" /> {{ option.label }}
            </button>
          }
        </div>
      </section>

      <section class="ls-card">
        <h2 class="ls-section-title">Trọng số Living Score của bạn</h2>
        <p class="hint">Trọng số này được dùng ở bản đồ, trang chi tiết, so sánh và mục đã lưu để tạo Personalized Living Score.</p>
        <ls-weights-panel />
      </section>

      <section class="ls-card">
        <h2 class="ls-section-title">Dữ liệu trên thiết bị</h2>
        <p class="hint">
          Đã lưu {{ prefs.saved().length }} khu vực · đang so sánh {{ prefs.compareSelection().length }} khu vực.
        </p>
        <button type="button" class="ls-btn ls-btn-ghost" (click)="clear()"><ls-icon name="trash" [size]="16" /> Xoá dữ liệu cá nhân</button>
      </section>

      <p class="foot"><ls-icon name="info" [size]="14" /> Hanoi Living Score MVP — dữ liệu minh hoạ (SAMPLE DATA), chưa phải số liệu chính thức.</p>
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
  protected readonly themes: Array<{ value: ThemeChoice; label: string; icon: string }> = [
    { value: 'system', label: 'Theo hệ thống', icon: 'layers' },
    { value: 'light', label: 'Sáng', icon: 'sun' },
    { value: 'dark', label: 'Tối', icon: 'moon' },
  ];

  protected clear(): void {
    if (confirm('Xoá khu vực đã lưu, danh sách so sánh, trọng số và giao diện đã chọn?')) this.prefs.clearAll();
  }
}
