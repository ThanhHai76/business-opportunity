import { ANALYTICS } from '../config';

/**
 * Optional, cookieless page statistics (Plausible-compatible script). Off unless ANALYTICS.domain is set in config.ts.
 * `track()` records a named event (e.g. a purchase started); it does nothing while analytics is off.
 */
export function startAnalytics(): void {
  if (!ANALYTICS.domain || typeof document === 'undefined') return;
  const script = document.createElement('script');
  script.defer = true;
  script.dataset['domain'] = ANALYTICS.domain;
  script.src = ANALYTICS.script;
  document.head.appendChild(script);
  (window as unknown as { plausible?: unknown }).plausible ??= function (...args: unknown[]) {
    ((window as unknown as { plausible: { q?: unknown[] } }).plausible.q ??= []).push(args);
  };
}

export function track(event: string, props?: Record<string, string | number | boolean>): void {
  if (!ANALYTICS.domain || typeof window === 'undefined') return;
  const plausible = (window as unknown as { plausible?: (name: string, options?: { props: Record<string, unknown> }) => void }).plausible;
  plausible?.(event, props ? { props } : undefined);
}
