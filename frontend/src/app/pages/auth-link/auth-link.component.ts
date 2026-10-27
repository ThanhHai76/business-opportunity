import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { PasswordFieldComponent } from '../../components/password-field/password-field.component';
import { SiteLangService } from '../../services/site-lang.service';
import { AUTH_TEXT } from './auth-link.i18n';
import { AccountService, accountError } from '../../services/account.service';

type Mode = 'forgot' | 'reset' | 'verify';

/**
 * The pages the emails point to, and the one that asks for the email:
 *   /forgot-password           ask for a reset link
 *   /reset-password?token=…    choose a new password
 *   /verify-email?token=…      confirm the address (done on load)
 */
@Component({
  selector: 'app-auth-link',
  standalone: true,
  imports: [RouterLink, PasswordFieldComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="al">
      @switch (mode) {
        @case ('forgot') {
          <h1>{{ tx().forgotTitle }}</h1>
          @if (sent()) {
            <p class="al__ok" role="status">{{ tx().forgotSent }}</p>
          } @else if (account.ready() && !account.mail()) {
            <p class="al__err">{{ tx().mailOff }}</p>
          } @else {
            <p>{{ tx().forgotAsk }}</p>
            <form (submit)="$event.preventDefault(); forgot()">
              <label><span>{{ tx().email }}</span><input type="email" name="email" autocomplete="email" required maxlength="254" (input)="email.set($any($event.target).value)" /></label>
              <button type="submit" [disabled]="busy()">{{ busy() ? tx().sending : tx().sendLink }}</button>
            </form>
          }
        }
        @case ('reset') {
          <h1>{{ tx().resetTitle }}</h1>
          @if (finished()) {
            <p class="al__ok" role="status">{{ tx().resetDone }}</p>
            <button type="button" (click)="account.dialogOpen.set(true)">{{ tx().signIn }}</button>
          } @else if (!token) {
            <p class="al__err">{{ tx().badLink }} <a routerLink="/forgot-password">{{ tx().newLink }}</a>.</p>
          } @else {
            <form (submit)="$event.preventDefault(); reset()">
              <label><span>{{ tx().newPassword }}</span><app-password-field name="password" autocomplete="new-password" [minlength]="8" (valueChange)="password.set($event)" /></label>
              <button type="submit" [disabled]="busy()">{{ busy() ? tx().saving : tx().changePassword }}</button>
            </form>
          }
        }
        @case ('verify') {
          <h1>{{ tx().verifyTitle }}</h1>
          @if (finished()) {
            <p class="al__ok" role="status">{{ tx().verified }}</p>
          } @else if (!error()) {
            <p>{{ tx().verifying }}</p>
          }
        }
      }
      @if (error(); as e) {
        <p class="al__err" role="alert">{{ e }}</p>
        @if (mode === 'forgot') {
          <!-- nothing: the form stays -->
        } @else if (mode === 'reset') {
          <p><a routerLink="/forgot-password">{{ tx().newLink }}</a></p>
        } @else {
          <p>{{ tx().verifyHint }}</p>
        }
      }
      <p class="al__back"><a routerLink="/">{{ tx().back }}</a></p>
    </main>
  `,
  styles: `
    :host { display: block; min-height: 100%; background: var(--app-bg); color: var(--app-ink); font-family: 'Manrope', -apple-system, 'Segoe UI', sans-serif; line-height: 1.55; }
    .al { max-width: 440px; margin: 0 auto; padding: 48px 16px; display: grid; gap: 14px; }
    h1 { margin: 0; font-size: 26px; }
    p { margin: 0; }
    form { display: grid; gap: 12px; }
    label { display: grid; gap: 4px; font-size: 12.5px; font-weight: 700; color: var(--app-ink-dim); }
    input { padding: 10px 12px; border: 1px solid var(--app-line); border-radius: 10px; background: var(--app-surface-2); color: var(--app-ink); font: inherit; }
    button { justify-self: start; padding: 10px 16px; border: 0; border-radius: 10px; background: var(--app-biz); color: #fff; font: inherit; font-weight: 700; cursor: pointer; }
    button:disabled { opacity: 0.6; cursor: progress; }
    a { color: var(--app-biz); font-weight: 700; text-decoration: none; }
    .al__ok { padding: 10px 12px; border-radius: 10px; background: color-mix(in srgb, #16a34a 12%, transparent); }
    .al__err { padding: 10px 12px; border-radius: 10px; background: color-mix(in srgb, #dc2626 12%, transparent); color: #dc2626; }
    .al__back { margin-top: 12px; }
  `,
})
export class AuthLinkComponent implements OnInit {
  protected readonly account = inject(AccountService);
  private readonly route = inject(ActivatedRoute);

  protected readonly mode: Mode = this.route.snapshot.data['mode'];
  protected readonly token = this.route.snapshot.queryParamMap.get('token') ?? '';
  protected readonly email = signal('');
  private readonly site = inject(SiteLangService);
  /** The page's words, in the site's language. */
  protected readonly tx = computed(() => AUTH_TEXT[this.site.lang()]);
  protected readonly password = signal('');
  protected readonly busy = signal(false);
  protected readonly sent = signal(false);
  protected readonly finished = signal(false);
  protected readonly error = signal<string | null>(null);

  ngOnInit(): void {
    if (this.mode !== 'verify') return;
    if (!this.token) {
      this.error.set(this.tx().badLinkExpired);
      return;
    }
    this.account.verifyEmail(this.token).subscribe({
      next: () => this.finished.set(true),
      error: (e: unknown) => this.error.set(accountError(e)),
    });
  }

  protected forgot(): void {
    if (this.busy()) return;
    this.busy.set(true);
    this.error.set(null);
    this.account.forgotPassword(this.email().trim()).subscribe({
      next: () => {
        this.busy.set(false);
        this.sent.set(true);
      },
      error: (e: unknown) => {
        this.busy.set(false);
        this.error.set(accountError(e));
      },
    });
  }

  protected reset(): void {
    if (this.busy()) return;
    this.busy.set(true);
    this.error.set(null);
    this.account.resetPassword(this.token, this.password()).subscribe({
      next: () => {
        this.busy.set(false);
        this.finished.set(true);
      },
      error: (e: unknown) => {
        this.busy.set(false);
        this.error.set(accountError(e));
      },
    });
  }
}
