import { Injectable, signal } from '@angular/core';

export type PromptLang = 'vi' | 'en';

/** What the Premium prompt says: the feature that was asked for, in the page's language. */
export interface PremiumAsk {
  feature: string;
  lang: PromptLang;
}

/** True when an HTTP error is the server's "this is Premium" answer (402, code premium_required). */
export function isPremiumRequired(error: unknown): boolean {
  const e = error as { status?: number; error?: { code?: string } } | null;
  return e?.status === 402 && e.error?.code === 'premium_required';
}

/** Asks a visitor to upgrade when they reach for a Premium feature (shown by PremiumPromptComponent, in the app shell). */
@Injectable({ providedIn: 'root' })
export class PremiumPromptService {
  readonly ask = signal<PremiumAsk | null>(null);

  open(feature: string, lang: PromptLang = 'vi'): void {
    this.ask.set({ feature, lang });
  }

  close(): void {
    this.ask.set(null);
  }
}
