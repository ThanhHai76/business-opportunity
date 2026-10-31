import { AfterViewInit, ChangeDetectionStrategy, Component, ElementRef, HostListener, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Observable } from 'rxjs';
import { AccountService, accountError } from '../../services/account.service';
import { SiteLangService } from '../../services/site-lang.service';
import { PasswordFieldComponent } from '../password-field/password-field.component';
import { ACCOUNT_TEXT } from './account.i18n';

type View = 'login' | 'register';

/**
 * Sign in / sign up. Once signed in it only points to the account page (/tai-khoan), where the account is managed,
 * and keeps a sign-out button.
 * Shown by the site header while AccountService.dialogOpen() is true.
 */
@Component({
  selector: 'app-account-dialog',
  standalone: true,
  imports: [RouterLink, PasswordFieldComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="ad-backdrop" (click)="close()"></div>
    <div class="ad" role="dialog" aria-modal="true" aria-labelledby="ad-title">
      <div class="ad__head">
        <h2 id="ad-title">{{ account.user() ? tx().titleAccount : view() === 'register' ? tx().titleRegister : tx().titleLogin }}</h2>
        <button type="button" class="ad__x" (click)="close()" [attr.aria-label]="tx().close">✕</button>
      </div>

      @if (account.user(); as u) {
        <p class="ad__who">
          <strong>{{ u.displayName || u.email }}</strong>
          @if (u.displayName) {
            <small>{{ u.email }}</small>
          }
        </p>
        <a class="ad__btn" routerLink="/tai-khoan" (click)="close()">{{ tx().openAccount }}</a>
        <button type="button" class="ad__btn ad__btn--primary" (click)="logout()" [disabled]="busy()">{{ tx().signOut }}</button>
      } @else {
        <p class="ad__note">
          {{ view() === 'register' ? tx().noteRegister : tx().noteLogin }}
        </p>
        <form class="ad__form" (submit)="$event.preventDefault(); submit()">
          @if (view() === 'register') {
            <label>
              <span>{{ tx().nameOptional }}</span>
              <input type="text" name="name" maxlength="80" autocomplete="nickname" (input)="name.set($any($event.target).value)" />
            </label>
          }
          <label>
            <span>{{ tx().email }}</span>
            <input #first type="email" name="email" autocomplete="email" required maxlength="254" (input)="email.set($any($event.target).value)" />
          </label>
          <label>
            <span>{{ tx().password }}{{ view() === 'register' ? tx().passwordMin : '' }}</span>
            <app-password-field name="password" [minlength]="view() === 'register' ? 8 : null" [autocomplete]="view() === 'register' ? 'new-password' : 'current-password'" (valueChange)="password.set($event)" />
          </label>
          @if (view() === 'register') {
            <label class="ad__check">
              <input type="checkbox" name="terms" required (change)="terms.set($any($event.target).checked)" />
              <span>{{ tx().termsPre }}<a routerLink="/terms" target="_blank" rel="noopener">{{ tx().termsLink }}</a>{{ tx().termsAnd }}<a routerLink="/privacy" target="_blank" rel="noopener">{{ tx().privacyLink }}</a>{{ tx().termsPost }}</span>
            </label>
          }
          <button type="submit" class="ad__btn ad__btn--primary" [disabled]="busy()">
            {{ busy() ? tx().working : view() === 'register' ? tx().create : tx().signIn }}
          </button>
          @if (view() === 'login' && account.mail()) {
            <a class="ad__forgot" routerLink="/forgot-password" (click)="close()">{{ tx().forgot }}</a>
          }
        </form>
        <p class="ad__switch">
          @if (view() === 'register') {
            {{ tx().haveAccount }} <button type="button" (click)="switchTo('login')">{{ tx().signIn }}</button>
          } @else {
            {{ tx().noAccount }} <button type="button" (click)="switchTo('register')">{{ tx().create }}</button>
          }
        </p>
      }

      @if (error(); as e) {
        <p class="ad__error" role="alert">{{ e }}</p>
      }
      @if (done(); as d) {
        <p class="ad__done" role="status">{{ d }}</p>
      }
    </div>
  `,
  styles: [
    `
      :host {
        position: fixed;
        inset: 0;
        z-index: 1000;
        display: grid;
        place-items: center;
        padding: 16px;
      }
      .ad-backdrop {
        position: absolute;
        inset: 0;
        background: rgba(10, 8, 5, 0.45);
      }
      .ad {
        position: relative;
        width: min(400px, 100%);
        max-height: calc(100dvh - 32px);
        overflow-y: auto;
        display: grid;
        gap: 12px;
        padding: 20px;
        border: 1px solid var(--app-line);
        border-radius: 16px;
        background: var(--app-surface);
        color: var(--app-ink);
        box-shadow: var(--app-shadow);
        font: 14px/1.45 'Manrope', -apple-system, 'Segoe UI', sans-serif;
      }
      .ad__head {
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
      h2 {
        margin: 0;
        font-size: 18px;
      }
      .ad__x {
        width: 32px;
        height: 32px;
        border: 0;
        border-radius: 8px;
        background: transparent;
        color: var(--app-ink-dim);
        cursor: pointer;
      }
      .ad__x:hover {
        background: var(--app-surface-2);
      }
      .ad__note,
      .ad__hint {
        margin: 0;
        color: var(--app-ink-dim);
        font-size: 13px;
      }
      .ad__who {
        margin: 0;
        display: grid;
      }
      .ad__who small {
        color: var(--app-ink-dim);
      }
      .ad__form {
        display: grid;
        gap: 10px;
      }
      label {
        display: grid;
        gap: 4px;
        font-size: 12.5px;
        font-weight: 700;
        color: var(--app-ink-dim);
      }
      input {
        padding: 9px 11px;
        border: 1px solid var(--app-line);
        border-radius: 10px;
        background: var(--app-surface-2);
        color: var(--app-ink);
        font: inherit;
        font-weight: 500;
      }
      input:focus-visible {
        outline: 2px solid var(--app-biz);
        outline-offset: 1px;
      }
      .ad__btn {
        padding: 9px 14px;
        border: 1px solid var(--app-line);
        border-radius: 10px;
        background: var(--app-surface);
        color: var(--app-ink);
        font: inherit;
        font-weight: 700;
        cursor: pointer;
      }
      .ad__btn--primary {
        border-color: transparent;
        background: var(--app-biz);
        color: #fff;
      }
      .ad__btn:disabled {
        opacity: 0.6;
        cursor: progress;
      }
      .ad__switch {
        margin: 0;
        font-size: 13px;
        color: var(--app-ink-dim);
      }
      .ad__switch button {
        padding: 0;
        border: 0;
        background: none;
        color: var(--app-biz);
        font: inherit;
        font-weight: 700;
        cursor: pointer;
      }
      .ad__check { display: flex; gap: 8px; align-items: flex-start; font-weight: 500; }
      .ad__check input { margin-top: 3px; }
      .ad__check a, .ad__forgot { color: var(--app-biz); font-weight: 700; }
      .ad__forgot { font-size: 13px; }
      .ad__error {
        margin: 0;
        padding: 8px 10px;
        border-radius: 8px;
        background: color-mix(in srgb, #dc2626 12%, transparent);
        color: #dc2626;
        font-size: 13px;
      }
      .ad__done {
        margin: 0;
        color: var(--app-ink-dim);
        font-size: 13px;
      }
    `,
  ],
})
export class AccountDialogComponent implements AfterViewInit {
  protected readonly account = inject(AccountService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  private readonly site = inject(SiteLangService);
  /** The dialog's words, in the site's language. */
  protected readonly tx = computed(() => ACCOUNT_TEXT[this.site.lang()]);
  protected readonly view = signal<View>('login');
  protected readonly email = signal('');
  protected readonly password = signal('');
  protected readonly name = signal('');
  protected readonly terms = signal(false);
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly done = signal<string | null>(null);

  ngAfterViewInit(): void {
    this.host.nativeElement.querySelector<HTMLInputElement>('input')?.focus();
  }

  @HostListener('document:keydown.escape')
  protected close(): void {
    this.account.dialogOpen.set(false);
  }

  protected switchTo(view: View): void {
    this.view.set(view);
    this.error.set(null);
    setTimeout(() => this.host.nativeElement.querySelector<HTMLInputElement>('input')?.focus());
  }

  private run<T = unknown>(call: Observable<T>, onDone: (value: T) => void): void {
    if (this.busy()) return;
    this.busy.set(true);
    this.error.set(null);
    this.done.set(null);
    call.subscribe({
      next: (value) => {
        this.busy.set(false);
        onDone(value);
      },
      error: (e: unknown) => {
        this.busy.set(false);
        this.error.set(accountError(e));
      },
    });
  }

  protected submit(): void {
    const email = this.email().trim();
    const password = this.password();
    const call = this.view() === 'register' ? this.account.register(email, password, this.name(), this.terms()) : this.account.login(email, password);
    const registering = this.view() === 'register';
    this.run(call, () => {
      // A new account with email on: stay open and say where the verification mail went (it may be in the spam folder).
      if (registering && this.account.mail()) this.done.set(this.tx().doneRegistered(email));
      else this.close();
    });
  }

  protected logout(): void {
    this.run(this.account.logout(), () => this.close());
  }
}
