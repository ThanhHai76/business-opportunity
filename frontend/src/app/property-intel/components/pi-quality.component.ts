import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { Lang } from '../pi.models';
import { SourceQuality, isEstimate, qualityText } from './pi-quality.view';

/** The data label next to a source: its kind, how far to trust it and the date of the data. */
@Component({
  selector: 'pi-quality',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<span class="q" [class.q--estimate]="estimate()" [class.q--firm]="!estimate()" [attr.data-confidence]="quality()?.confidence ?? 'none'">{{ text() }}</span>`,
  styles: `
    .q { display: inline-block; margin-left: 6px; padding: 1px 7px; border-radius: 999px; border: 1px solid currentColor; font-size: 10.5px; line-height: 1.5; font-weight: 600; white-space: normal; vertical-align: baseline; }
    .q--firm { color: #5ad19a; }
    .q--estimate { color: #f0b254; }
  `,
})
export class PiQualityComponent {
  readonly quality = input<SourceQuality | null | undefined>(null);
  readonly lang = input<Lang>('vi');
  protected readonly text = computed(() => qualityText(this.quality(), this.lang()));
  protected readonly estimate = computed(() => isEstimate(this.quality()));
}
