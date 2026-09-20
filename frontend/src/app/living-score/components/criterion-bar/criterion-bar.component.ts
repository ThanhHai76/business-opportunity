import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { CRITERION_ICONS } from '../../living-score.constants';
import { CriterionKey } from '../../models/living-score.models';
import { LivingMetaService } from '../../services/living-meta.service';
import { IconComponent } from '../icon/icon.component';

/** One criterion row: icon, label, optional weight, score and a band-coloured bar. */
@Component({
  selector: 'ls-criterion-bar',
  standalone: true,
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="head">
      <span class="name">
        <ls-icon [name]="icon()" [size]="16" />
        {{ label() }}
        @if (weightPct() !== null) {
          <small>· {{ weightPct() }}% trọng số</small>
        }
      </span>
      <strong>{{ value() }}<small>/100</small></strong>
    </div>
    <div class="track" role="progressbar" [attr.aria-valuenow]="value()" aria-valuemin="0" aria-valuemax="100" [attr.aria-label]="label()">
      <div class="fill" [style.width.%]="value()" [style.background]="color()"></div>
    </div>
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
        gap: 12px;
        font-size: 13px;
        margin-bottom: 6px;
      }
      .name {
        display: inline-flex;
        align-items: center;
        gap: 7px;
        color: var(--ls-ink);
        font-weight: 600;
      }
      small {
        color: var(--ls-ink-faint);
        font-weight: 500;
        font-size: 11px;
      }
      strong {
        font-variant-numeric: tabular-nums;
      }
      .track {
        height: 7px;
        border-radius: 999px;
        background: var(--ls-track);
        overflow: hidden;
      }
      .fill {
        height: 100%;
        border-radius: 999px;
        transition: width 0.5s ease;
      }
    `,
  ],
})
export class CriterionBarComponent {
  private readonly meta = inject(LivingMetaService);

  readonly criterion = input.required<CriterionKey>();
  readonly value = input.required<number>();
  readonly weightPct = input<number | null>(null);

  protected readonly label = computed(() => this.meta.label(this.criterion()));
  protected readonly icon = computed(() => CRITERION_ICONS[this.criterion()]);
  protected readonly color = computed(() => this.meta.colorFor(this.value()));
}
