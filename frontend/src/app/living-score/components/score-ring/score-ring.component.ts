import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { LivingMetaService } from '../../services/living-meta.service';

const CIRCUMFERENCE = 2 * Math.PI * 42;

/** Circular Living Score gauge, coloured by the score band. */
@Component({
  selector: 'ls-score-ring',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="ring" [style.width.px]="size()" [style.height.px]="size()" role="img" [attr.aria-label]="'Điểm ' + score() + ' trên 100'">
      <svg viewBox="0 0 100 100" [attr.width]="size()" [attr.height]="size()">
        <circle class="track" cx="50" cy="50" r="42" fill="none" stroke-width="9" />
        <circle
          cx="50"
          cy="50"
          r="42"
          fill="none"
          stroke-width="9"
          stroke-linecap="round"
          [attr.stroke]="color()"
          [attr.stroke-dasharray]="circumference"
          [attr.stroke-dashoffset]="offset()"
          transform="rotate(-90 50 50)"
        />
      </svg>
      <div class="label">
        <strong [style.color]="color()" [style.font-size.px]="size() * 0.3">{{ display() }}</strong>
        @if (showMax()) {
          <span [style.font-size.px]="Math.max(9, size() * 0.115)">/100</span>
        }
      </div>
    </div>
  `,
  styles: [
    `
      :host {
        display: inline-block;
        line-height: 0;
      }
      .ring {
        position: relative;
      }
      .track {
        stroke: var(--ls-line);
      }
      circle:not(.track) {
        transition: stroke-dashoffset 0.6s ease, stroke 0.3s ease;
      }
      .label {
        position: absolute;
        inset: 0;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        line-height: 1;
      }
      strong {
        font-weight: 800;
        letter-spacing: -0.02em;
        font-variant-numeric: tabular-nums;
      }
      span {
        margin-top: 2px;
        color: var(--ls-ink-faint);
      }
    `,
  ],
})
export class ScoreRingComponent {
  private readonly meta = inject(LivingMetaService);
  protected readonly Math = Math;
  protected readonly circumference = CIRCUMFERENCE;

  readonly score = input.required<number>();
  readonly size = input(88);
  readonly showMax = input(true);

  protected readonly color = computed(() => this.meta.colorFor(this.score()));
  protected readonly offset = computed(() => CIRCUMFERENCE * (1 - Math.min(100, Math.max(0, this.score())) / 100));
  protected readonly display = computed(() => Math.round(this.score()));
}
