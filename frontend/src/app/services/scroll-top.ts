import { inject } from '@angular/core';
import { NavigationEnd, NavigationStart, Router } from '@angular/router';

/** The path of an address: no query and no fragment ("/phuong-xa/cau-giay?lang=en#x" → "/phuong-xa/cau-giay"). */
export const pathOf = (url: string): string => url.split(/[?#]/)[0] || '/';

/**
 * Whether arriving at `next` should bring the page back to its top: only when it is another page (a change of the
 * query, as the filters and tabs of a tool make, keeps the place), not when it is an address with a #fragment (the page
 * scrolls to that part itself), and not on back/forward (the browser returns to where the visitor was).
 */
export function shouldScrollTop(previous: string | null, next: string, trigger: string | undefined): boolean {
  if (previous === null) return false;
  if (trigger === 'popstate') return false;
  if (next.includes('#')) return false;
  return pathOf(next) !== pathOf(previous);
}

/** Starts the scrolling to the top on a new page. Call from an injection context. */
export function startScrollToTop(): void {
  if (typeof window === 'undefined') return;
  const router = inject(Router);
  let previous: string | null = null;
  let trigger: string | undefined;
  router.events.subscribe((e) => {
    if (e instanceof NavigationStart) trigger = e.navigationTrigger;
    else if (e instanceof NavigationEnd) {
      if (shouldScrollTop(previous, e.urlAfterRedirects, trigger)) window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
      previous = e.urlAfterRedirects;
    }
  });
}
