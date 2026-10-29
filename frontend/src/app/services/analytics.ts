import { inject } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs';
import { ANALYTICS, ANALYTICS_API_URL } from '../config';

/**
 * Two kinds of statistics, both without cookies:
 *  - the site's own counters (backend-node src/analytics): which pages are opened, how many sign-ups, ward look-ups and
 *    "?" clicks. Counters only: nothing about the visitor is sent or kept. A browser that asks not to be tracked
 *    (Do Not Track) sends nothing. Needs no account at a third party.
 *  - optionally, a Plausible-compatible script, off unless ANALYTICS.domain is set in config.ts.
 */

/** The events a page may send; the server refuses any other (it counts checkouts and payments itself). */
export type SiteEvent = 'page_view' | 'signup' | 'ward_lookup' | 'score_help';

let enabled = true;
/** Tests switch the counters off (they would call a server that is not there). */
export const setAnalyticsForTests = (on: boolean): void => {
  enabled = on;
};

const doNotTrack = (): boolean => typeof navigator !== 'undefined' && (navigator.doNotTrack === '1' || (window as unknown as { doNotTrack?: string }).doNotTrack === '1');

function send(event: SiteEvent, key?: string): void {
  if (!enabled || typeof fetch === 'undefined' || doNotTrack()) return;
  fetch(`${ANALYTICS_API_URL}/event`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(key ? { event, key } : { event }),
    credentials: 'omit',
    keepalive: true,
  }).catch(() => undefined); // statistics never get in the way
}

/** Starts the counters (a page view per page) and the optional Plausible script. Call from an injection context. */
export function startAnalytics(): void {
  if (typeof document === 'undefined') return;
  inject(Router)
    .events.pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
    .subscribe((e) => {
      const path = e.urlAfterRedirects.split(/[?#]/)[0];
      // The administrator's own pages are not part of the picture.
      if (!path.startsWith('/admin')) send('page_view', path);
    });

  if (!ANALYTICS.domain) return;
  const script = document.createElement('script');
  script.defer = true;
  script.dataset['domain'] = ANALYTICS.domain;
  script.src = ANALYTICS.script;
  document.head.appendChild(script);
  (window as unknown as { plausible?: unknown }).plausible ??= function (...args: unknown[]) {
    ((window as unknown as { plausible: { q?: unknown[] } }).plausible.q ??= []).push(args);
  };
}

/** Counts an event (and sends it to Plausible when that is on). `key` is a short label, e.g. the tool a "?" belongs to. */
export function track(event: Exclude<SiteEvent, 'page_view'>, key?: string): void {
  send(event, key);
  if (!ANALYTICS.domain || typeof window === 'undefined') return;
  const plausible = (window as unknown as { plausible?: (name: string, options?: { props: Record<string, unknown> }) => void }).plausible;
  plausible?.(event, key ? { props: { key } } : undefined);
}
