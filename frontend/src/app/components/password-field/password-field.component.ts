import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';

/**
 * A password box with an eye button that shows or hides what was typed. It stands where a plain
 * `<input type="password">` stood: the same name, autocomplete and minlength, and `valueChange` instead of `(input)`.
 * The button is not part of the tab order of the form's submit, and says what it will do ("Hiện mật khẩu" / "Ẩn mật khẩu").
 */
@Component({
  selector: 'app-password-field',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span class="pf">
      <input
        [type]="shown() ? 'text' : 'password'"
        [attr.name]="name()"
        [attr.autocomplete]="autocomplete()"
        [attr.minlength]="minlength()"
        [required]="required()"
        autocapitalize="off"
        autocorrect="off"
        spellcheck="false"
        (input)="valueChange.emit($any($event.target).value)"
      />
      <button type="button" class="pf__eye" [attr.aria-label]="label()" [attr.aria-pressed]="shown()" [title]="label()" (click)="shown.set(!shown())">
        @if (shown()) {
          <!-- eye with a slash: the password is visible, press to hide -->
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M3 3l18 18" />
            <path d="M10.6 6.2A9.8 9.8 0 0 1 12 6c5.2 0 8.7 4.4 9.6 6-0.4 0.7-1.2 1.8-2.4 2.9M6.6 7.7C4.4 9.2 3 11.2 2.4 12c0.9 1.6 4.4 6 9.6 6 1.5 0 2.8-0.4 4-1" />
            <path d="M9.9 10A3 3 0 0 0 14 14.1" />
          </svg>
        } @else {
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M2.4 12C3.3 10.4 6.8 6 12 6s8.7 4.4 9.6 6c-0.9 1.6-4.4 6-9.6 6S3.3 13.6 2.4 12z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        }
      </button>
    </span>
  `,
  styles: `
    :host { display: block; }
    .pf { position: relative; display: block; }
    input { width: 100%; box-sizing: border-box; padding: 9px 42px 9px 11px; border: 1px solid var(--app-line); border-radius: 10px; background: var(--app-surface-2); color: var(--app-ink); font: inherit; font-weight: 500; }
    input:focus-visible { outline: 2px solid var(--app-biz); outline-offset: 1px; }
    .pf__eye { position: absolute; top: 50%; right: 4px; transform: translateY(-50%); display: grid; place-items: center; width: 34px; height: 34px; padding: 0; border: 0; border-radius: 8px; background: transparent; color: var(--app-ink-dim); cursor: pointer; }
    .pf__eye:hover { color: var(--app-ink); background: color-mix(in srgb, var(--app-ink) 8%, transparent); }
    .pf__eye:focus-visible { outline: 2px solid var(--app-biz); outline-offset: 1px; }
  `,
})
export class PasswordFieldComponent {
  readonly name = input('password');
  readonly autocomplete = input<'current-password' | 'new-password'>('current-password');
  readonly minlength = input<number | null>(null);
  readonly required = input(true);
  readonly valueChange = output<string>();

  protected readonly shown = signal(false);
  protected readonly label = computed(() => (this.shown() ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'));
}
