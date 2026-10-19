import { ChangeDetectionStrategy, Component, computed, effect, inject, input, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AccountService } from '../../services/account.service';
import { AiQuota, BillingService } from '../../services/billing.service';
import { QuotaLang, quotaText, quotaView } from './ai-quota.view';

/**
 * One line under a metered AI answer: which allowance paid for it, or why the basic answer was given and what to do
 * (sign in, buy AI questions or Premium). Shows nothing when the server does not meter AI answers (no `quota`).
 */
@Component({
  selector: 'app-ai-quota',
  standalone: true,
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (view(); as v) {
      <p class="aq" [class.aq--basic]="v.basic" role="status">
        <span class="aq__dot" aria-hidden="true"></span>
        <span class="aq__text">{{ v.text }}</span>
        @if (v.action === 'signin') {
          <button type="button" class="aq__btn" (click)="account.dialogOpen.set(true)">{{ tx().signInBtn }}</button>
        } @else if (v.action === 'buy') {
          <a class="aq__btn" routerLink="/premium">{{ tx().buy }}</a>
        } @else if (v.action === 'plans') {
          <a class="aq__link" routerLink="/premium">{{ tx().plans }}</a>
        }
      </p>
    }
  `,
  styles: `
    :host { display: block; }
    .aq {
      display: flex; flex-wrap: wrap; align-items: center; gap: 6px 10px; margin: 8px 0 0; padding: 7px 10px;
      border: 1px solid var(--app-line, rgba(127, 127, 127, 0.3)); border-radius: 10px;
      font-size: 12px; line-height: 1.45; color: var(--app-ink-dim, inherit);
      background: color-mix(in srgb, var(--app-time, #b8862b) 6%, transparent);
    }
    .aq--basic { background: color-mix(in srgb, var(--app-time, #b8862b) 12%, transparent); color: var(--app-ink, inherit); }
    .aq__dot { width: 7px; height: 7px; border-radius: 50%; background: var(--app-time, #b8862b); flex: none; }
    .aq--basic .aq__dot { background: var(--app-ink-dim, #888); }
    .aq__text { flex: 1 1 200px; }
    .aq__btn {
      display: inline-flex; align-items: center; padding: 4px 10px; border: 0; border-radius: 999px; cursor: pointer;
      background: var(--app-time, #b8862b); color: #fff; font: inherit; font-weight: 700; text-decoration: none; white-space: nowrap;
    }
    .aq__link { color: var(--app-time, #b8862b); font-weight: 700; text-decoration: none; white-space: nowrap; }
    .aq__btn:focus-visible, .aq__link:focus-visible { outline: 2px solid var(--app-time, #b8862b); outline-offset: 2px; }
  `,
})
export class AiQuotaComponent {
  protected readonly account = inject(AccountService);
  private readonly billing = inject(BillingService);

  readonly quota = input<AiQuota | null | undefined>(null);
  readonly lang = input<QuotaLang>('vi');

  protected readonly tx = computed(() => quotaText(this.lang()));

  protected readonly view = computed(() => quotaView(this.quota(), this.lang(), this.billing.aiLimits().freePerDay));

  constructor() {
    // The header and the Premium page show the same allowances as the last answer.
    effect(() => {
      const q = this.quota();
      untracked(() => this.billing.applyQuota(q));
    });
  }
}
