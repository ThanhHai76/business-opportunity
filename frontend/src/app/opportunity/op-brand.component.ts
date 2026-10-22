import { ChangeDetectionStrategy, Component, effect, inject, input, signal, untracked } from '@angular/core';
import { accountError } from '../services/account.service';
import { Brand, BillingService } from '../services/billing.service';
import { PremiumPromptService, isPremiumRequired } from '../services/premium-prompt.service';
import { OpText } from './op-i18n';
import { Lang } from './op.models';

const EMPTY: Brand = { company: '', name: '', phone: '', email: '', note: '' };

/**
 * The broker's own details on the printed report (Premium): company, name, phone, email and a note for the client.
 * Without Premium it is a teaser that opens the Premium prompt.
 */
@Component({
  selector: 'app-op-brand',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (billing.premiumLocked()) {
      <button type="button" class="teaser" (click)="prompt.open(teaser() ?? t().brand.teaser, lang())"><span aria-hidden="true">★</span> {{ teaser() ?? t().brand.teaser }}</button>
    } @else {
      <details class="brand" [open]="open()" (toggle)="open.set($any($event.target).open)">
        <summary>{{ t().brand.title }}</summary>
        <p class="hint">{{ hint() ?? t().brand.hint }}</p>
        <form (submit)="$event.preventDefault(); save()">
          <label><span>{{ t().brand.company }}</span><input name="company" maxlength="80" [value]="form().company" (input)="set('company', $event)" /></label>
          <label><span>{{ t().brand.name }}</span><input name="name" maxlength="80" autocomplete="name" [value]="form().name" (input)="set('name', $event)" /></label>
          <label><span>{{ t().brand.phone }}</span><input name="phone" maxlength="30" autocomplete="tel" [value]="form().phone" (input)="set('phone', $event)" /></label>
          <label><span>{{ t().brand.email }}</span><input name="email" type="email" maxlength="120" autocomplete="email" [value]="form().email" (input)="set('email', $event)" /></label>
          <label class="wide"><span>{{ t().brand.note }}</span><textarea name="note" rows="2" maxlength="300" [value]="form().note" (input)="set('note', $event)"></textarea></label>
          <div class="actions">
            <button type="submit" class="op-btn op-btn--primary" [disabled]="busy()">{{ t().brand.save }}</button>
            @if (billing.brand()) {
              <button type="button" class="op-btn" [disabled]="busy()" (click)="remove()">{{ t().brand.remove }}</button>
            }
          </div>
        </form>
        @if (message(); as m) {
          <p class="message" [class.is-error]="m.error" role="status">{{ m.text }}</p>
        }
      </details>
    }
  `,
  styles: `
    :host { display: block; margin-top: 10px; }
    .teaser { width: 100%; padding: 9px 12px; border: 1px dashed color-mix(in srgb, #d97706 55%, transparent); border-radius: 10px; background: color-mix(in srgb, #d97706 8%, transparent); color: inherit; font: inherit; font-size: 12.5px; font-weight: 700; text-align: left; cursor: pointer; }
    .teaser span { color: #d97706; }
    .brand { border: 1px solid var(--op-line); border-radius: 10px; padding: 8px 12px; background: var(--app-surface); }
    summary { cursor: pointer; font-size: 13px; font-weight: 700; }
    .hint { margin: 6px 0; font-size: 12px; color: var(--op-ink-dim); }
    form { display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 8px 10px; }
    label { display: grid; gap: 3px; font-size: 12px; font-weight: 700; color: var(--op-ink-dim); }
    .wide { grid-column: 1 / -1; }
    input, textarea { padding: 7px 9px; border: 1px solid var(--op-line); border-radius: 8px; background: var(--app-surface-2); color: var(--op-ink); font: inherit; font-weight: 500; resize: vertical; }
    .actions { grid-column: 1 / -1; display: flex; flex-wrap: wrap; gap: 8px; }
    .message { margin: 8px 0 0; font-size: 12.5px; font-weight: 600; color: var(--op-accent); }
    .message.is-error { color: var(--op-warn); }
    .op-btn { display: inline-flex; align-items: center; gap: 6px; padding: 6px 11px; border: 1px solid var(--op-line); border-radius: 999px; background: var(--app-surface); color: inherit; font: inherit; font-size: 12.5px; font-weight: 700; cursor: pointer; }
    .op-btn--primary { border-color: transparent; background: var(--op-accent); color: #fff; }
    button[disabled] { opacity: 0.6; cursor: default; }
  `,
})
export class OpBrandComponent {
  protected readonly billing = inject(BillingService);
  protected readonly prompt = inject(PremiumPromptService);

  readonly t = input.required<OpText['premium']>();
  readonly lang = input.required<Lang>();
  /** Words of its own for the offer and the explanation (the default is about the paid report). */
  readonly teaser = input<string | null>(null);
  readonly hint = input<string | null>(null);

  protected readonly open = signal(false);
  protected readonly form = signal<Brand>({ ...EMPTY });
  protected readonly busy = signal(false);
  protected readonly message = signal<{ text: string; error: boolean } | null>(null);

  constructor() {
    this.billing.loadBrand();
    // What is saved fills the form (also after another tab or a sign-in changed it).
    effect(() => {
      const saved = this.billing.brand();
      untracked(() => this.form.set({ ...EMPTY, ...saved }));
    });
  }

  protected set(key: keyof Brand, event: Event): void {
    const value = (event.target as HTMLInputElement | HTMLTextAreaElement).value;
    this.form.update((f) => ({ ...f, [key]: value }));
  }

  protected save(): void {
    const f = this.form();
    if (!f.company.trim() && !f.name.trim()) return this.message.set({ text: this.t().brand.needName, error: true });
    this.busy.set(true);
    this.billing.saveBrand({ company: f.company.trim(), name: f.name.trim(), phone: f.phone.trim(), email: f.email.trim(), note: f.note.trim() }).subscribe({
      next: () => (this.busy.set(false), this.message.set({ text: this.t().brand.saved, error: false })),
      error: (e: unknown) => this.failed(e),
    });
  }

  protected remove(): void {
    this.busy.set(true);
    this.billing.removeBrand().subscribe({
      next: () => (this.busy.set(false), this.message.set({ text: this.t().brand.removed, error: false })),
      error: (e: unknown) => this.failed(e),
    });
  }

  private failed(e: unknown): void {
    this.busy.set(false);
    if (isPremiumRequired(e)) this.prompt.open(this.teaser() ?? this.t().brand.teaser, this.lang());
    else this.message.set({ text: accountError(e), error: true });
  }
}
