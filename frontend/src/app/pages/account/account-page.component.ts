import { HttpClient } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { Observable } from 'rxjs';
import { PasswordFieldComponent } from '../../components/password-field/password-field.component';
import { ACCOUNT_TEXT } from '../../components/account/account.i18n';
import { FEEDBACK_API_URL } from '../../config';
import { AccountService, accountError } from '../../services/account.service';
import { BillingService } from '../../services/billing.service';
import { SiteLangService } from '../../services/site-lang.service';

/** Hands a value to the browser as a downloaded .json file. */
export function downloadJson(data: unknown, filename: string): void {
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/**
 * /tai-khoan: the signed-in person's account in sections (profile, plan, security, their data, administration).
 * Signing in and up stay in the small dialog of the header; this page is where one comes back to manage the account.
 */
@Component({
  selector: 'app-account-page',
  standalone: true,
  imports: [RouterLink, PasswordFieldComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="ap">
      <a class="ap__back" routerLink="/">← {{ tx().home }}</a>

      @if (!account.ready()) {
        <p class="ap__hint">{{ tx().working }}</p>
      } @else if (account.user()) {
        @let u = account.user()!;

        <header class="ap__hero">
          <span class="ap__avatar" aria-hidden="true">{{ initial(u) }}</span>
          <div class="ap__id">
            <h1>{{ u.displayName || u.email }}</h1>
            @if (u.displayName) {
              <p class="ap__mail">{{ u.email }}</p>
            }
            @if (account.mail()) {
              <span class="ap__badge" [class.is-ok]="u.emailVerified">{{ u.emailVerified ? tx().verifiedBadge : tx().unverifiedBadge }}</span>
            }
          </div>
          <button type="button" class="ap__btn" (click)="logout()" [disabled]="busy()">{{ tx().signOut }}</button>
        </header>
        <p class="ap__lead">{{ tx().noteSaved }}</p>

        @if (account.mail() && !u.emailVerified) {
          <div class="ap__verify" role="status">
            <span>{{ tx().verifyNeeded }}</span>
            <button type="button" class="ap__btn ap__btn--primary" (click)="resend()" [disabled]="busy()">{{ tx().resend }}</button>
          </div>
        }

        @if (error(); as e) {
          <p class="ap__error" role="alert">{{ e }}</p>
        }
        @if (done(); as d) {
          <p class="ap__done" role="status">{{ d }}</p>
        }

        <div class="ap__grid">
          @if (billing.enabled()) {
            <section class="ap__card ap__plan" [class.is-premium]="billing.ai()?.premium" aria-labelledby="ap-plan">
              <h2 id="ap-plan">{{ tx().sectionPlan }}</h2>
              @if (billing.ai(); as ai) {
                <p class="ap__tier">
                  <strong>{{ ai.premium ? 'Premium' : tx().planFree }}</strong>
                  @if (ai.premium && ai.premiumUntil) {
                    <small>{{ tx().planUntil(day(ai.premiumUntil)) }}</small>
                  }
                </p>
                <dl class="ap__stats">
                  <div>
                    <dd>{{ ai.premium ? ai.premiumLeft + ai.freeLeft : ai.freeLeft }}</dd>
                    <dt>{{ tx().statAi }}</dt>
                  </div>
                  <div>
                    <dd>{{ ai.storyFreeLeft }}</dd>
                    <dt>{{ tx().statStory }}</dt>
                  </div>
                  <div>
                    <dd>{{ ai.aiCredits }}</dd>
                    <dt>{{ tx().statBought }}</dt>
                  </div>
                </dl>
              }
              <a class="ap__btn ap__btn--primary" routerLink="/premium">{{ billing.ai()?.premium ? tx().manage : tx().upgrade }}</a>
            </section>
          }

          <section class="ap__card" aria-labelledby="ap-profile">
            <h2 id="ap-profile">{{ tx().sectionProfile }}</h2>
            <form class="ap__form" (submit)="$event.preventDefault(); saveName()">
              <label>
                <span>{{ tx().displayName }}</span>
                <input type="text" name="name" maxlength="80" autocomplete="nickname" [value]="u.displayName ?? ''" (input)="name.set($any($event.target).value)" />
              </label>
              <button type="submit" class="ap__btn ap__btn--primary" [disabled]="busy()">{{ tx().saveName }}</button>
            </form>
          </section>

          <section class="ap__card" aria-labelledby="ap-security">
            <h2 id="ap-security">{{ tx().sectionSecurity }}</h2>
            <form class="ap__form" (submit)="$event.preventDefault(); changePassword()">
              <label>
                <span>{{ tx().currentPassword }}</span>
                <app-password-field name="current" autocomplete="current-password" (valueChange)="password.set($event)" />
              </label>
              <label>
                <span>{{ tx().newPassword }}</span>
                <app-password-field name="new" autocomplete="new-password" [minlength]="8" (valueChange)="newPassword.set($event)" />
              </label>
              <button type="submit" class="ap__btn ap__btn--primary" [disabled]="busy()">{{ tx().changePassword }}</button>
              <small class="ap__hint">{{ tx().otherDevices }}</small>
            </form>
          </section>

          <section class="ap__card" aria-labelledby="ap-data">
            <h2 id="ap-data">{{ tx().sectionData }}</h2>
            <form class="ap__form" (submit)="$event.preventDefault(); exportData()">
              <h3>{{ tx().exportTitle }}</h3>
              <p class="ap__hint">{{ tx().exportHint }}</p>
              <label>
                <span>{{ tx().confirmPassword }}</span>
                <app-password-field name="export" autocomplete="current-password" (valueChange)="exportPassword.set($event)" />
              </label>
              <button type="submit" class="ap__btn" [disabled]="busy()">{{ busy() ? tx().exportBusy : tx().exportButton }}</button>
            </form>
          </section>

          @if (admin()) {
            <section class="ap__card" aria-labelledby="ap-admin">
              <h2 id="ap-admin">{{ tx().sectionAdmin }}</h2>
              <div class="ap__links">
                <a routerLink="/admin/reports">{{ tx().adminReports }} <span aria-hidden="true">→</span></a>
                <a routerLink="/admin/stats">{{ tx().adminStats }} <span aria-hidden="true">→</span></a>
              </div>
            </section>
          }
        </div>

        <details class="ap__card ap__danger">
          <summary>{{ tx().deleteTitle }}</summary>
          <form class="ap__form" (submit)="$event.preventDefault(); deleteAccount()">
            <p class="ap__hint">{{ tx().deleteHint }}</p>
            <label>
              <span>{{ tx().confirmPassword }}</span>
              <app-password-field name="confirm" autocomplete="current-password" (valueChange)="deletePassword.set($event)" />
            </label>
            <button type="submit" class="ap__btn ap__btn--danger" [disabled]="busy()">{{ tx().deleteButton }}</button>
          </form>
        </details>
      } @else {
        <section class="ap__card ap__signin">
          <h1>{{ tx().titleAccount }}</h1>
          <p>{{ tx().noteLogin }}</p>
          <button type="button" class="ap__btn ap__btn--primary" (click)="account.dialogOpen.set(true)">{{ tx().signIn }}</button>
        </section>
      }
    </main>
  `,
  styles: [
    `
      :host {
        display: block;
        background: var(--app-bg);
        color: var(--app-ink);
        min-height: 100dvh;
      }
      .ap {
        max-width: 920px;
        margin: 0 auto;
        padding: 20px 16px 72px;
        display: grid;
        gap: 16px;
        font: 14px/1.5 'Manrope', -apple-system, 'Segoe UI', sans-serif;
      }
      .ap p,
      .ap h1,
      .ap h2,
      .ap h3,
      .ap dl,
      .ap dd,
      .ap dt {
        margin: 0;
      }
      .ap__back {
        justify-self: start;
        color: var(--app-ink-dim);
        font-weight: 700;
        text-decoration: none;
      }
      .ap__back:hover {
        color: var(--app-biz);
      }
      .ap__hero {
        display: flex;
        align-items: center;
        gap: 16px;
        padding: 20px;
        border: 1px solid var(--app-line);
        border-radius: 18px;
        background: var(--app-surface);
        box-shadow: var(--app-shadow);
      }
      .ap__avatar {
        flex: none;
        display: grid;
        place-items: center;
        width: 56px;
        height: 56px;
        border-radius: 50%;
        background: var(--app-biz);
        color: #fff;
        font-size: 24px;
        font-weight: 800;
      }
      .ap__id {
        flex: 1;
        min-width: 0;
        display: grid;
        gap: 4px;
        justify-items: start;
      }
      .ap__id h1 {
        max-width: 100%;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        font-size: 22px;
        line-height: 1.2;
      }
      .ap__mail {
        max-width: 100%;
        overflow: hidden;
        text-overflow: ellipsis;
        color: var(--app-ink-dim);
      }
      .ap__badge {
        padding: 2px 10px;
        border-radius: 999px;
        background: color-mix(in srgb, #d97706 14%, transparent);
        color: #b45309;
        font-size: 12px;
        font-weight: 700;
      }
      .ap__badge.is-ok {
        background: var(--app-career-soft);
        color: var(--app-career);
      }
      .ap__lead {
        color: var(--app-ink-dim);
      }
      .ap__grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 16px;
        align-items: start;
      }
      .ap__card {
        display: grid;
        gap: 14px;
        padding: 20px;
        border: 1px solid var(--app-line);
        border-radius: 16px;
        background: var(--app-surface);
      }
      .ap__card h2 {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 15px;
        font-weight: 800;
      }
      .ap__card h2::before {
        content: '';
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: var(--app-biz);
      }
      .ap__card h3 {
        font-size: 14px;
      }
      .ap__plan {
        grid-column: 1 / -1;
        border-color: transparent;
        background: var(--app-time-soft);
      }
      .ap__plan.is-premium h2::before {
        background: var(--app-time);
      }
      .ap__tier {
        display: flex;
        align-items: baseline;
        gap: 8px;
      }
      .ap__tier strong {
        font-size: 22px;
      }
      .ap__tier small {
        color: var(--app-ink-dim);
      }
      .ap__stats {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 10px;
      }
      .ap__stats div {
        display: grid;
        gap: 2px;
        padding: 12px;
        border-radius: 12px;
        background: var(--app-surface);
      }
      .ap__stats dd {
        font-size: 24px;
        font-weight: 800;
        line-height: 1.1;
      }
      .ap__stats dt {
        color: var(--app-ink-dim);
        font-size: 12px;
        font-weight: 600;
      }
      .ap__hint {
        color: var(--app-ink-dim);
        font-size: 13px;
      }
      .ap__form {
        display: grid;
        gap: 12px;
      }
      label {
        display: grid;
        gap: 5px;
        font-size: 12.5px;
        font-weight: 700;
        color: var(--app-ink-dim);
      }
      input {
        padding: 10px 12px;
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
      .ap__btn {
        justify-self: start;
        padding: 9px 16px;
        border: 1px solid var(--app-line);
        border-radius: 10px;
        background: var(--app-surface);
        color: var(--app-ink);
        font: inherit;
        font-weight: 700;
        text-decoration: none;
        cursor: pointer;
      }
      .ap__btn:hover:not(:disabled) {
        border-color: var(--app-ink-faint);
      }
      .ap__btn--primary,
      .ap__btn--primary:hover:not(:disabled) {
        border-color: transparent;
        background: var(--app-biz);
        color: #fff;
      }
      :host-context(:root[data-theme='dark']) .ap__btn--primary,
      :host-context(:root[data-theme='dark']) .ap__avatar {
        color: #1b1712;
      }
      .ap__btn--danger {
        border-color: #dc2626;
        color: #dc2626;
      }
      .ap__btn:disabled {
        opacity: 0.6;
        cursor: progress;
      }
      .ap__links {
        display: grid;
        gap: 8px;
      }
      .ap__links a {
        display: flex;
        justify-content: space-between;
        padding: 11px 14px;
        border: 1px solid var(--app-line);
        border-radius: 10px;
        color: var(--app-ink);
        font-weight: 700;
        text-decoration: none;
      }
      .ap__links a:hover {
        border-color: var(--app-biz);
        color: var(--app-biz);
      }
      .ap__danger {
        border-color: color-mix(in srgb, #dc2626 35%, var(--app-line));
      }
      .ap__danger summary {
        color: #dc2626;
        font-weight: 800;
        cursor: pointer;
      }
      .ap__danger[open] summary {
        margin-bottom: 14px;
      }
      .ap__verify {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
        padding: 12px 16px;
        border: 1px solid #d97706;
        border-radius: 12px;
        background: color-mix(in srgb, #d97706 10%, transparent);
      }
      .ap__error {
        padding: 10px 14px;
        border-radius: 10px;
        background: color-mix(in srgb, #dc2626 12%, transparent);
        color: #dc2626;
        font-weight: 600;
      }
      .ap__done {
        padding: 10px 14px;
        border-radius: 10px;
        background: var(--app-career-soft);
        color: var(--app-career);
        font-weight: 600;
      }
      .ap__signin {
        max-width: 420px;
        justify-items: start;
      }
      @media (max-width: 720px) {
        .ap__grid {
          grid-template-columns: 1fr;
        }
        .ap__hero {
          flex-wrap: wrap;
        }
        .ap__stats {
          grid-template-columns: 1fr;
        }
        .ap__stats div {
          grid-template-columns: auto 1fr;
          align-items: baseline;
          gap: 10px;
        }
      }
    `,
  ],
})
export class AccountPageComponent {
  protected readonly account = inject(AccountService);
  protected readonly billing = inject(BillingService);
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly site = inject(SiteLangService);

  protected readonly tx = computed(() => ACCOUNT_TEXT[this.site.lang()]);
  /** Whether this account may read the administration pages (the server decides). */
  protected readonly admin = signal(false);
  private readonly adminCheck = effect(() => {
    if (!this.account.user()) {
      untracked(() => this.admin.set(false));
      return;
    }
    this.http.get<{ admin: boolean }>(`${FEEDBACK_API_URL}/admin/me`, { withCredentials: true }).subscribe({
      next: (r) => this.admin.set(r.admin === true),
      error: () => this.admin.set(false),
    });
  });

  protected readonly name = signal(this.account.user()?.displayName ?? '');
  protected readonly password = signal('');
  protected readonly newPassword = signal('');
  protected readonly exportPassword = signal('');
  protected readonly deletePassword = signal('');
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly done = signal<string | null>(null);

  protected initial(u: { displayName: string | null; email: string }): string {
    return (u.displayName || u.email).trim().charAt(0).toUpperCase();
  }

  protected day(iso: string): string {
    return new Date(iso).toLocaleDateString(this.site.lang() === 'en' ? 'en-GB' : 'vi-VN', { day: 'numeric', month: 'numeric', year: 'numeric' });
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

  protected resend(): void {
    this.run(this.account.resendVerification(), () => this.done.set(this.tx().doneResent));
  }

  protected saveName(): void {
    this.run(this.account.updateName(this.name()), () => this.done.set(this.tx().doneName));
  }

  protected changePassword(): void {
    this.run(this.account.changePassword(this.password(), this.newPassword()), () => this.done.set(this.tx().donePassword));
  }

  protected exportData(): void {
    this.run(this.account.exportData(this.exportPassword()), (data) => {
      downloadJson(data, `hanoi-century-vista-du-lieu-${new Date().toISOString().slice(0, 10)}.json`);
      this.done.set(this.tx().doneExport);
    });
  }

  protected deleteAccount(): void {
    if (!confirm(this.tx().confirmDelete)) return;
    this.run(this.account.deleteAccount(this.deletePassword()), () => void this.router.navigateByUrl('/'));
  }

  protected logout(): void {
    this.run(this.account.logout(), () => void this.router.navigateByUrl('/'));
  }
}
