import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { IconComponent } from '../icon/icon.component';

/** Consistent loading / empty / error placeholder. */
@Component({
  selector: 'ls-state',
  standalone: true,
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="state" [class.error]="kind() === 'error'" [attr.role]="kind() === 'error' ? 'alert' : 'status'">
      @switch (kind()) {
        @case ('loading') {
          <span class="spinner" aria-hidden="true"></span>
        }
        @case ('error') {
          <span class="badge"><ls-icon name="alert" [size]="22" /></span>
        }
        @default {
          <span class="badge"><ls-icon [name]="icon()" [size]="22" /></span>
        }
      }
      <strong>{{ title() }}</strong>
      @if (message()) {
        <p>{{ message() }}</p>
      }
      @if (actionLabel()) {
        <button type="button" class="ls-btn ls-btn-soft" (click)="action.emit()">{{ actionLabel() }}</button>
      }
    </div>
  `,
  styles: [
    `
      .state {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 10px;
        padding: 36px 20px;
        text-align: center;
        color: var(--ls-ink-dim);
      }
      strong {
        color: var(--ls-ink);
        font-size: 15px;
      }
      p {
        margin: 0;
        max-width: 42ch;
        font-size: 13.5px;
        line-height: 1.55;
      }
      .badge {
        width: 44px;
        height: 44px;
        border-radius: 14px;
        display: grid;
        place-items: center;
        background: var(--ls-accent-soft);
        color: var(--ls-accent-ink);
      }
      .error .badge {
        background: var(--ls-danger-soft);
        color: var(--ls-danger);
      }
      .spinner {
        width: 26px;
        height: 26px;
        border-radius: 50%;
        border: 3px solid var(--ls-line);
        border-top-color: var(--ls-accent);
        animation: spin 0.8s linear infinite;
      }
      @keyframes spin {
        to {
          transform: rotate(360deg);
        }
      }
      @media (prefers-reduced-motion: reduce) {
        .spinner {
          animation-duration: 2.4s;
        }
      }
    `,
  ],
})
export class StateMessageComponent {
  readonly kind = input<'loading' | 'empty' | 'error'>('empty');
  readonly title = input.required<string>();
  readonly message = input<string>('');
  readonly icon = input('info');
  readonly actionLabel = input<string>('');
  readonly action = output<void>();
}
