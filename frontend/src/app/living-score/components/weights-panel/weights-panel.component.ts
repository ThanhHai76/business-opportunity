import { ChangeDetectionStrategy, Component, computed, inject, output } from '@angular/core';
import { CRITERION_ICONS } from '../../living-score.constants';
import { CRITERION_KEYS, CriterionKey, CriterionMap } from '../../models/living-score.models';
import { LivingMetaService } from '../../services/living-meta.service';
import { PreferencesService, fullWeights } from '../../services/preferences.service';
import { IconComponent } from '../icon/icon.component';

/**
 * Sliders for the personalised weights. It only stores the numbers — the Living Score itself is
 * always recomputed by the backend Scoring Engine when the parent reloads its data.
 */
@Component({
  selector: 'ls-weights-panel',
  standalone: true,
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="head">
      <strong>Trọng số cá nhân hoá</strong>
      <button type="button" class="reset" (click)="reset()" [disabled]="!prefs.weights()">
        <ls-icon name="refresh" [size]="14" /> Đặt lại
      </button>
    </div>
    @if (meta.ready()) {
      <div class="rows">
        @for (row of rows(); track row.key) {
          <div class="row">
            <label [for]="'w-' + row.key" class="label">
              <ls-icon [name]="row.icon" [size]="15" />
              <span>{{ row.label }}</span>
              <output>{{ row.value }} <small>· {{ row.pct }}%</small></output>
            </label>
            <input
              class="ls-range"
              type="range"
              min="0"
              max="100"
              step="5"
              [id]="'w-' + row.key"
              [value]="row.value"
              (input)="onInput(row.key, $event)"
            />
          </div>
        }
      </div>
      <p class="note">
        {{ prefs.weights() ? 'Đang dùng điểm cá nhân hoá — tổng trọng số được chuẩn hoá về 100%.' : 'Đang dùng trọng số mặc định. Kéo thanh trượt để cá nhân hoá.' }}
      </p>
    }
  `,
  styles: [
    `
      :host {
        display: block;
      }
      .head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 12px;
        font-size: 13px;
      }
      .reset {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        font-size: 12px;
        font-weight: 600;
        color: var(--ls-accent-ink);
        padding: 4px 8px;
        border-radius: 8px;
      }
      .reset:disabled {
        color: var(--ls-ink-faint);
        cursor: default;
      }
      .reset:not(:disabled):hover {
        background: var(--ls-accent-soft);
      }
      .rows {
        display: grid;
        gap: 12px;
      }
      .label {
        display: flex;
        align-items: center;
        gap: 7px;
        font-size: 12.5px;
        color: var(--ls-ink-dim);
        margin-bottom: 4px;
      }
      .label span {
        flex: 1;
        color: var(--ls-ink);
        font-weight: 600;
      }
      output {
        font-variant-numeric: tabular-nums;
        font-weight: 700;
        color: var(--ls-ink);
      }
      small {
        color: var(--ls-ink-faint);
        font-weight: 500;
      }
      .note {
        margin: 12px 0 0;
        font-size: 11.5px;
        line-height: 1.5;
        color: var(--ls-ink-faint);
      }
    `,
  ],
})
export class WeightsPanelComponent {
  protected readonly prefs = inject(PreferencesService);
  protected readonly meta = inject(LivingMetaService);

  /** Fires after every change so the parent can reload scores. */
  readonly changed = output<void>();

  protected readonly rows = computed(() => {
    const values = fullWeights(this.prefs.weights(), this.meta.defaultWeights());
    const total = CRITERION_KEYS.reduce((sum, key) => sum + values[key], 0) || 1;
    return CRITERION_KEYS.map((key) => ({
      key,
      label: this.meta.label(key),
      icon: CRITERION_ICONS[key],
      value: values[key],
      pct: Math.round((values[key] / total) * 100),
    }));
  });

  protected onInput(key: CriterionKey, event: Event): void {
    const value = Number((event.target as HTMLInputElement).value);
    const next: CriterionMap = { ...fullWeights(this.prefs.weights(), this.meta.defaultWeights()), [key]: value };
    const defaults = this.meta.defaultWeights();
    const isDefault = CRITERION_KEYS.every((k) => next[k] === defaults[k]);
    this.prefs.setWeights(isDefault ? null : next);
    this.changed.emit();
  }

  protected reset(): void {
    this.prefs.resetWeights();
    this.changed.emit();
  }
}
